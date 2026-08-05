#!/usr/bin/env python3
"""Time each STT service on a single file. Run 2 rounds to catch warmup effects."""
import time
import subprocess
import sys
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

env = load_env()
TEST_FILE = Path("demucs_test_output/RingVideo_20260529_113106.wav")  # longest file ~4MB

# Extract audio
wav = Path("demucs_test_output/bench_test.wav")
subprocess.run(['ffmpeg', '-i', str(TEST_FILE), '-vn', '-acodec', 'pcm_s16le',
                '-ar', '16000', '-ac', '1', '-y', str(wav)],
               capture_output=True)
file_size_mb = wav.stat().st_size / 1024 / 1024
audio_duration_s = 119  # 1m59s

print(f"Test file: {TEST_FILE.name}")
print(f"WAV size: {file_size_mb:.1f} MB  |  Audio duration: ~{audio_duration_s}s\n")

results = {}

# ── Whisper ───────────────────────────────────────────────────────────────────
from openai import OpenAI
oai = OpenAI(api_key=env['OPENAI_API_KEY'])

times = []
for i in range(2):
    t0 = time.time()
    with open(wav, 'rb') as f:
        oai.audio.transcriptions.create(model='whisper-1', file=f, response_format='text')
    times.append(time.time() - t0)
    print(f"  Whisper round {i+1}: {times[-1]:.1f}s")
results['Whisper'] = times

# ── ElevenLabs ────────────────────────────────────────────────────────────────
from elevenlabs import ElevenLabs
el = ElevenLabs(api_key=env['ELEVENLABS_API_KEY'])

times = []
for i in range(2):
    t0 = time.time()
    with open(wav, 'rb') as f:
        el.speech_to_text.convert(file=f, model_id='scribe_v2', tag_audio_events=False)
    times.append(time.time() - t0)
    print(f"  ElevenLabs round {i+1}: {times[-1]:.1f}s")
results['ElevenLabs Scribe'] = times

# ── Soniox ────────────────────────────────────────────────────────────────────
from soniox.client import SonioxClient
soniox = SonioxClient(api_key=env['SONIOX_API_KEY'])

times = []
for i in range(2):
    t0 = time.time()
    with open(wav, 'rb') as f:
        soniox.stt.transcribe_and_wait_with_tokens(file=f)
    times.append(time.time() - t0)
    print(f"  Soniox round {i+1}: {times[-1]:.1f}s")
results['Soniox'] = times

# ── Demucs (local CPU) ────────────────────────────────────────────────────────
import torch, soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model

model = get_model('htdemucs')
model.eval()
audio_np, sr = sf.read(str(wav), dtype='float32', always_2d=True)
audio_np = audio_np.T
mix = torch.from_numpy(audio_np)

times = []
for i in range(2):
    t0 = time.time()
    with torch.no_grad():
        apply_model(model, mix.unsqueeze(0), progress=False)
    times.append(time.time() - t0)
    print(f"  Demucs (CPU) round {i+1}: {times[-1]:.1f}s")
results['Demucs (CPU)'] = times

# ── Summary ───────────────────────────────────────────────────────────────────
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(f"\n{'='*55}")
print(f"  TIMING SUMMARY  ({audio_duration_s}s of audio)")
print(f"{'='*55}")
print(f"{'Service':<22} {'Round 1':>8} {'Round 2':>8} {'Avg':>8}  {'RT factor':>10}")
print("-"*55)
for name, times in results.items():
    avg = sum(times) / len(times)
    rtf = avg / audio_duration_s
    print(f"{name:<22} {times[0]:>7.1f}s {times[1]:>7.1f}s {avg:>7.1f}s  {rtf:>8.2f}x")
print()
print("RT factor = processing time / audio duration. <1.0x = faster than real-time.")
