#!/usr/bin/env python3
"""Get timestamped tokens from Soniox for a specific audio file."""
import sys
import os
from pathlib import Path

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

audio_path = sys.argv[1] if len(sys.argv) > 1 else "demucs_test_output/RingVideo_20260531_033956.wav"

env = load_env()
from soniox.client import SonioxClient
client = SonioxClient(api_key=env['SONIOX_API_KEY'])

print(f"Transcribing {Path(audio_path).name} with Soniox...")
with open(audio_path, 'rb') as f:
    result = client.stt.transcribe_and_wait_with_tokens(file=f)

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(f"\n{'TIME':>8}  TEXT")
print("-" * 50)
for t in result.tokens:
    if t.text.strip():
        ms = getattr(t, 'start_ms', None) or getattr(t, 'start_time_ms', None) or 0
        secs = ms / 1000
        m, s = divmod(int(secs), 60)
        ts = f"{m}:{s:02d}.{int((secs % 1)*10)}"
        print(f"{ts:>8}  {t.text}")
