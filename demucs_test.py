#!/usr/bin/env python3
"""
Demucs vocal extraction test for Ring camera audio.

Bypasses the Demucs CLI (which fails on Python 3.14 due to torchaudio/torchcodec
DLL incompatibility) and calls the Demucs model directly via Python API.
Uses soundfile for all audio I/O — no torchaudio dependency.

Usage:
    python demucs_test.py
    python demucs_test.py --api-key sk-...

Requirements:
    pip install demucs soundfile openai
    ffmpeg on PATH: https://ffmpeg.org/download.html
"""

import argparse
import subprocess
import sys
import os
import json
from pathlib import Path
from datetime import datetime


VIDEO_FILES = [
    Path("C:/Users/David/Downloads/RingVideo_20260528_012116.mp4"),   # GOOD
    Path("C:/Users/David/Downloads/RingVideo_20260528_163907.mp4"),   # BAD  — empty transcript
    Path("C:/Users/David/Downloads/RingVideo_20260529_111652.mp4"),   # BAD  — Chinese + music
    Path("C:/Users/David/Downloads/RingVideo_20260529_113106.mp4"),   # MIXED — English/Chinese
    Path("C:/Users/David/Downloads/RingVideo_20260529_151432.mp4"),   # GOOD
    Path("C:/Users/David/Downloads/RingVideo_20260531_033956.mp4"),   # NEW  — Chinese only, two speakers
]

KNOWN_QUALITY = {
    "RingVideo_20260528_012116": "GOOD",
    "RingVideo_20260528_163907": "BAD",
    "RingVideo_20260529_111652": "BAD",
    "RingVideo_20260529_113106": "MIXED",
    "RingVideo_20260529_151432": "GOOD",
    "RingVideo_20260531_033956": "NEW",
}

OUTPUT_DIR = Path("demucs_test_output")


def load_env_file():
    candidates = [
        Path("C:/Users/David/Projects/.env"),
        Path(__file__).parent.parent / ".env",
        Path(__file__).parent / ".env",
    ]
    for path in candidates:
        if path.exists():
            env = {}
            for line in path.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, _, v = line.partition('=')
                    env[k.strip()] = v.strip()
            return env
    return {}


def check_ffmpeg():
    r = subprocess.run(['ffmpeg', '-version'], capture_output=True)
    if r.returncode != 0:
        sys.exit("ERROR: ffmpeg not found. Download from https://ffmpeg.org/download.html")


def extract_audio(video_path, output_path):
    """Extract audio as 44.1kHz stereo WAV (Demucs native format)."""
    cmd = [
        'ffmpeg', '-i', str(video_path),
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        '-y',
        str(output_path)
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")


def separate_vocals(audio_path, output_dir):
    """
    Run Demucs model directly via Python API.
    Loads audio with soundfile, runs model, saves vocals stem with soundfile.
    Completely bypasses torchaudio — avoids Python 3.14 torchcodec DLL issue.
    """
    import torch
    import numpy as np
    import soundfile as sf
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    # Load audio with soundfile (no torchaudio)
    audio_np, sr = sf.read(str(audio_path), dtype='float32', always_2d=True)
    # soundfile returns (samples, channels) — convert to (channels, samples)
    audio_np = audio_np.T
    mix = torch.from_numpy(audio_np)  # (channels, samples)

    # Load Demucs model (downloads ~80MB on first run to ~/.cache/torch/hub)
    model = get_model('htdemucs')
    model.eval()

    # Resample if needed (model expects model.samplerate, typically 44100)
    if sr != model.samplerate:
        import torch.nn.functional as F
        mix = F.interpolate(
            mix.unsqueeze(0),
            scale_factor=model.samplerate / sr,
            mode='linear',
            align_corners=False
        ).squeeze(0)

    # Run separation — output shape: (batch, sources, channels, samples)
    with torch.no_grad():
        sources = apply_model(model, mix.unsqueeze(0), progress=False)

    sources = sources.squeeze(0)  # (sources, channels, samples)

    # Find vocals index
    source_names = model.sources  # e.g. ['drums', 'bass', 'other', 'vocals']
    vocals_idx = source_names.index('vocals')
    vocals = sources[vocals_idx]  # (channels, samples)

    # Save with soundfile (no torchaudio)
    stem = Path(audio_path).stem
    vocals_path = output_dir / f"{stem}_vocals.wav"
    vocals_np = vocals.numpy().T  # (samples, channels)
    sf.write(str(vocals_path), vocals_np, model.samplerate)

    return vocals_path


def transcribe(audio_path, api_key):
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    with open(audio_path, 'rb') as f:
        result = client.audio.transcriptions.create(
            model='whisper-1',
            file=f,
            response_format='text',
        )
    return (result or '').strip()


def word_count(text):
    return len(text.split()) if text else 0


def verdict(raw, demucs):
    rw, dw = word_count(raw), word_count(demucs)
    if rw == 0 and dw == 0:   return "BOTH EMPTY"
    if rw == 0 and dw > 0:    return "IMPROVED   (raw empty -> Demucs has content)"
    if rw > 0 and dw == 0:    return "DEGRADED   (raw had content -> Demucs empty)"
    ratio = dw / rw
    if ratio >= 0.85:          return "SIMILAR    (word count within 15%)"
    if dw > rw:                return "MORE       (Demucs longer -- noise or better?)"
    return                             f"FEWER      (Demucs {int((1-ratio)*100)}% fewer words)"


def process_file(video_path, api_key):
    stem = video_path.stem
    result = {'file': stem, 'baseline': KNOWN_QUALITY.get(stem, '?')}

    try:
        # Step 1: Extract audio
        print("  1) Extracting audio...", end=' ', flush=True)
        audio_path = OUTPUT_DIR / f"{stem}.wav"
        extract_audio(video_path, audio_path)
        print(f"{audio_path.stat().st_size/1024/1024:.1f} MB")

        # Step 2: Demucs via Python API
        print("  2) Running Demucs (Python API, soundfile I/O)...", end=' ', flush=True)
        vocals_path = separate_vocals(audio_path, OUTPUT_DIR)
        print(f"done")

        # Step 3: Transcribe both
        print("  3) Transcribing raw...", end=' ', flush=True)
        raw_text = transcribe(audio_path, api_key)
        print(f"{word_count(raw_text)} words")

        print("     Transcribing Demucs vocals...", end=' ', flush=True)
        demucs_text = transcribe(vocals_path, api_key)
        print(f"{word_count(demucs_text)} words")

        v = verdict(raw_text, demucs_text)
        result.update({
            'raw_words': word_count(raw_text),
            'demucs_words': word_count(demucs_text),
            'verdict': v,
            'raw_text': raw_text,
            'demucs_text': demucs_text,
        })
        print(f"\n  VERDICT: {v}")

    except Exception as e:
        print(f"\n  ERROR: {e}")
        result['error'] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-key')
    parser.add_argument('--only', help='Run only files whose name contains this string (e.g. 033956)')
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get('OPENAI_API_KEY')
    if not api_key:
        env = load_env_file()
        api_key = env.get('OPENAI_API_KEY')
    if not api_key:
        sys.exit("ERROR: No OpenAI API key found in C:/Users/David/Projects/.env")

    check_ffmpeg()
    OUTPUT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results = []

    files_to_run = [f for f in VIDEO_FILES if not args.only or args.only in f.name]

    print(f"\n{'='*65}")
    print(f"  Demucs + Whisper Comparison — {len(files_to_run)} file(s)")
    print(f"  Note: first file downloads ~80MB Demucs model weights")
    print(f"{'='*65}")

    for video_path in files_to_run:
        stem = video_path.stem
        baseline = KNOWN_QUALITY.get(stem, '?')
        print(f"\n[{stem}]  (known: {baseline})")

        if not video_path.exists():
            print(f"  SKIPPED — not found")
            results.append({'file': stem, 'baseline': baseline, 'error': 'not found'})
            continue

        result = process_file(video_path, api_key)
        results.append(result)

    # Summary
    print(f"\n\n{'='*65}")
    print("  SUMMARY")
    print(f"{'='*65}")
    print(f"{'FILE':<35} {'BASE':<6} {'RAW':>5} {'DEMUCS':>7}  VERDICT")
    print("-"*65)
    for r in results:
        if 'error' in r:
            print(f"{r['file']:<35} {r['baseline']:<6}  ERROR: {r['error'][:30]}")
        else:
            print(f"{r['file']:<35} {r['baseline']:<6} {r['raw_words']:>5} {r['demucs_words']:>7}  {r['verdict']}")

    # Save reports
    report_path = OUTPUT_DIR / f"comparison_{timestamp}.txt"
    with open(report_path, 'w', encoding='utf-8', errors='replace') as f:
        f.write(f"Demucs vs Raw Audio — {timestamp}\n\n")
        for r in results:
            f.write(f"{'='*60}\n")
            f.write(f"FILE:     {r['file']}\n")
            f.write(f"BASELINE: {r.get('baseline','?')}\n")
            if 'error' in r:
                f.write(f"ERROR:    {r['error']}\n\n")
            else:
                f.write(f"VERDICT:  {r['verdict']}\n")
                f.write(f"RAW ({r['raw_words']} words):\n{r.get('raw_text','')}\n\n")
                f.write(f"DEMUCS ({r['demucs_words']} words):\n{r.get('demucs_text','')}\n\n")

    json_path = OUTPUT_DIR / f"comparison_{timestamp}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nFull transcripts saved:")
    print(f"  {report_path}")
    print(f"  {json_path}")


if __name__ == '__main__':
    main()
