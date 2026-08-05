#!/usr/bin/env python3
"""
Re-transcribes a file with verbose_json to get timestamped segments.
Searches for a keyword and reports its time index.

Usage:
    python timestamp_lookup.py <audio_file> [--search keyword]
"""
import argparse
import json
import sys
import os
from pathlib import Path


def load_env_file():
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


def fmt_time(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', help='Audio file path (WAV)')
    parser.add_argument('--search', help='Keyword to find in transcript')
    parser.add_argument('--api-key')
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get('OPENAI_API_KEY') or load_env_file().get('OPENAI_API_KEY')
    if not api_key:
        sys.exit("ERROR: No OpenAI API key found.")

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    audio_path = Path(args.audio)
    print(f"Transcribing {audio_path.name} with verbose_json...")

    with open(audio_path, 'rb') as f:
        result = client.audio.transcriptions.create(
            model='whisper-1',
            file=f,
            response_format='verbose_json',
        )

    segments = result.segments or []
    print(f"\nTotal duration: {fmt_time(result.duration)}")
    print(f"Segments: {len(segments)}\n")

    def pr(text):
        print(text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
              .encode(sys.stdout.encoding or 'utf-8', errors='replace')
              .decode(sys.stdout.encoding or 'utf-8', errors='replace'))

    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    print(f"{'TIME':>6}  SEGMENT")
    print("-" * 60)
    for seg in segments:
        marker = " <<<" if args.search and args.search in seg.text else ""
        print(f"{fmt_time(seg.start):>6}  {seg.text.strip()}{marker}")

    if args.search:
        hits = [s for s in segments if args.search in s.text]
        if hits:
            print(f"\nFound '{args.search}' at:")
            for h in hits:
                print(f"  {fmt_time(h.start)} - {fmt_time(h.end)}")
        else:
            print(f"\n'{args.search}' not found in transcript.")

    out = audio_path.with_suffix('.segments.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump([{'start': s.start, 'end': s.end, 'text': s.text} for s in segments],
                  f, ensure_ascii=False, indent=2)
    print(f"\nFull segments saved: {out}")


if __name__ == '__main__':
    main()
