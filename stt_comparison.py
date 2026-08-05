#!/usr/bin/env python3
"""
STT Comparison: Whisper vs ElevenLabs Scribe vs Soniox
Runs all 6 Ring videos through each service, compares transcripts.
Optionally also tests Demucs-preprocessed audio through each service.

Usage:
    python stt_comparison.py
    python stt_comparison.py --with-demucs    # also test Demucs vocals stems
    python stt_comparison.py --only 033956    # single file

Requirements:
    pip install openai elevenlabs soniox soundfile
    Keys auto-loaded from C:/Users/David/Projects/.env
"""

import argparse
import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

VIDEO_FILES = [
    Path("C:/Users/David/Downloads/RingVideo_20260528_012116.mp4"),
    Path("C:/Users/David/Downloads/RingVideo_20260528_163907.mp4"),
    Path("C:/Users/David/Downloads/RingVideo_20260529_111652.mp4"),
    Path("C:/Users/David/Downloads/RingVideo_20260529_113106.mp4"),
    Path("C:/Users/David/Downloads/RingVideo_20260529_151432.mp4"),
    Path("C:/Users/David/Downloads/RingVideo_20260531_033956.mp4"),
]

KNOWN_QUALITY = {
    "RingVideo_20260528_012116": "GOOD",
    "RingVideo_20260528_163907": "BAD",
    "RingVideo_20260529_111652": "BAD-music",
    "RingVideo_20260529_113106": "MIXED",
    "RingVideo_20260529_151432": "GOOD",
    "RingVideo_20260531_033956": "NEW-zh",
}

DEMUCS_DIR = Path("C:/Users/David/Projects/meathead.ai/demucs_test_output")
OUTPUT_DIR = Path("C:/Users/David/Projects/meathead.ai/stt_comparison_output")


def load_env():
    for path in [Path("C:/Users/David/Projects/.env"), Path(__file__).parent / ".env"]:
        if path.exists():
            env = {}
            for line in path.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, _, v = line.partition('=')
                    env[k.strip()] = v.strip()
            return env
    return {}


def extract_audio(mp4_path, wav_path):
    """Extract 16kHz mono WAV from MP4 for services that need a file."""
    subprocess.run([
        'ffmpeg', '-i', str(mp4_path), '-vn',
        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        '-y', str(wav_path)
    ], capture_output=True, check=True)


def transcribe_whisper(client, audio_path):
    with open(audio_path, 'rb') as f:
        return (client.audio.transcriptions.create(
            model='whisper-1', file=f, response_format='text') or '').strip()


def transcribe_elevenlabs(el_client, audio_path):
    """ElevenLabs Scribe v2 transcription."""
    with open(audio_path, 'rb') as f:
        result = el_client.speech_to_text.convert(
            file=f,
            model_id='scribe_v2',
            tag_audio_events=False,
        )
    return (result.text or '').strip()


def transcribe_soniox(soniox_key, audio_path):
    """Soniox transcription via official Python SDK."""
    try:
        from soniox.client import SonioxClient
    except ImportError:
        raise RuntimeError("pip install soniox")

    client = SonioxClient(api_key=soniox_key)
    with open(audio_path, 'rb') as f:
        result = client.stt.transcribe_and_wait_with_tokens(file=f)
    tokens = result.tokens or []
    return ''.join(t.text for t in tokens).strip()


def wc(text):
    return len(text.split()) if text else 0


def process_file(mp4_path, wav_path, demucs_wav, services, args):
    stem = mp4_path.stem
    results = {'file': stem, 'baseline': KNOWN_QUALITY.get(stem, '?')}

    for label, fn in services.items():
        audio = wav_path
        if label.startswith('demucs+') and demucs_wav:
            audio = demucs_wav
        elif label.startswith('demucs+'):
            results[label] = {'text': 'SKIP (no demucs stem)', 'words': 0}
            continue

        print(f"  {label}...", end=' ', flush=True)
        try:
            text = fn(audio)
            results[label] = {'text': text, 'words': wc(text)}
            print(f"{wc(text)} words")
        except Exception as e:
            results[label] = {'text': f'ERROR: {e}', 'words': 0}
            print(f"ERROR: {e}")

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--with-demucs', action='store_true',
                        help='Also test Demucs-preprocessed audio through each service')
    parser.add_argument('--only', help='Filter to files containing this string')
    parser.add_argument('--skip', help='Comma-separated service names to skip (e.g. soniox)')
    args = parser.parse_args()

    env = load_env()
    oai_key     = env.get('OPENAI_API_KEY')
    el_key      = env.get('ELEVENLABS_API_KEY')
    soniox_key  = env.get('SONIOX_API_KEY')

    missing = [k for k, v in [('OPENAI_API_KEY', oai_key), ('ELEVENLABS_API_KEY', el_key), ('SONIOX_API_KEY', soniox_key)] if not v]
    if missing:
        sys.exit(f"ERROR: Missing keys in Projects/.env: {', '.join(missing)}")

    from openai import OpenAI
    oai = OpenAI(api_key=oai_key)

    try:
        from elevenlabs import ElevenLabs
        el = ElevenLabs(api_key=el_key)
    except ImportError:
        sys.exit("ERROR: pip install elevenlabs")

    skip = set(s.strip() for s in (args.skip or '').split(',') if s.strip())

    # Build service map
    services = {}
    if 'whisper'    not in skip: services['whisper']    = lambda p: transcribe_whisper(oai, p)
    if 'elevenlabs' not in skip: services['elevenlabs'] = lambda p: transcribe_elevenlabs(el, p)
    if 'soniox'     not in skip: services['soniox']     = lambda p: transcribe_soniox(soniox_key, p)
    if args.with_demucs:
        services['demucs+whisper']    = lambda p: transcribe_whisper(oai, p)
        services['demucs+elevenlabs'] = lambda p: transcribe_elevenlabs(el, p)
        services['demucs+soniox']     = lambda p: transcribe_soniox(soniox_key, p)

    OUTPUT_DIR.mkdir(exist_ok=True)
    tmp_dir = OUTPUT_DIR / 'wav_tmp'
    tmp_dir.mkdir(exist_ok=True)

    files = [f for f in VIDEO_FILES if not args.only or args.only in f.name]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    all_results = []

    print(f"\n{'='*65}")
    print(f"  STT Comparison — {len(files)} files × {len(services)} services")
    print(f"{'='*65}")

    for mp4_path in files:
        stem = mp4_path.stem
        print(f"\n[{stem}]  ({KNOWN_QUALITY.get(stem, '?')})")

        if not mp4_path.exists():
            print("  SKIP — file not found")
            continue

        # Extract WAV
        wav_path = tmp_dir / f"{stem}.wav"
        print("  Extracting audio...", end=' ', flush=True)
        try:
            extract_audio(mp4_path, wav_path)
            print(f"{wav_path.stat().st_size/1024/1024:.1f} MB")
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        # Demucs vocals stem (pre-processed)
        demucs_wav = DEMUCS_DIR / f"{stem}_vocals.wav"
        if not demucs_wav.exists():
            demucs_wav = None

        result = process_file(mp4_path, wav_path, demucs_wav, services, args)
        all_results.append(result)

    # Summary
    svc_names = list(services.keys())
    print(f"\n\n{'='*75}")
    print("  SUMMARY")
    print(f"{'='*75}")
    header = f"{'FILE':<32} {'BASE':<10}" + ''.join(f"{s[:12]:>13}" for s in svc_names)
    print(header)
    print("-"*75)
    for r in all_results:
        row = f"{r['file']:<32} {r['baseline']:<10}"
        for s in svc_names:
            w = r.get(s, {}).get('words', '?')
            row += f"{str(w):>13}"
        print(row)

    # Full transcripts
    print(f"\n\n{'='*75}")
    print("  FULL TRANSCRIPTS")
    print(f"{'='*75}")
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    for r in all_results:
        print(f"\n[{r['file']}]")
        for s in svc_names:
            entry = r.get(s, {})
            print(f"  {s}: {entry.get('text','')[:200]}")

    # Save
    out = OUTPUT_DIR / f"stt_comparison_{timestamp}.json"
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nFull results: {out}")


if __name__ == '__main__':
    main()
