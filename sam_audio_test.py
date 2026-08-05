# SAM-Audio vs Demucs vs Raw — Ring Camera Audio Comparison
# Paste each cell into a Google Colab cell and run in order.
# Runtime: GPU (Runtime → Change runtime type → T4 GPU)
#
# BEFORE RUNNING:
#   1. Request access at https://huggingface.co/facebook/sam-audio-base
#   2. Get your HF token at https://huggingface.co/settings/tokens
#   3. Have your OpenAI API key ready

# ── CELL 1: Install dependencies ─────────────────────────────────────────────
# Takes ~3 minutes on first run
!pip install -q git+https://github.com/facebookresearch/sam-audio.git
!pip uninstall -y torchcodec -q
!pip install -q --no-cache-dir "torchcodec==0.7.0" -f https://download.pytorch.org/whl/torchcodec/
!pip install -q openai soundfile
print("Installation complete. If prompted to restart runtime, do so then continue from Cell 2.")

# ── CELL 2: API keys (paste when running in Colab — never commit real keys) ──
HF_TOKEN    = "PASTE-HUGGINGFACE-TOKEN-HERE"
OPENAI_KEY  = "PASTE-OPENAI-KEY-HERE"

from huggingface_hub import login
login(token=HF_TOKEN)
print("HuggingFace login OK")

# ── CELL 3: Upload audio files ────────────────────────────────────────────────
# Upload all 6 WAV files from C:/Users/David/Projects/meathead.ai/demucs_test_output/
# Files needed (the raw extracted WAVs, NOT the _vocals ones):
#   RingVideo_20260528_012116.wav
#   RingVideo_20260528_163907.wav
#   RingVideo_20260529_111652.wav
#   RingVideo_20260529_113106.wav
#   RingVideo_20260529_151432.wav
#   RingVideo_20260531_033956.wav
from google.colab import files
print("Select all 6 WAV files when the picker opens...")
uploaded = files.upload()
audio_files = sorted(uploaded.keys())
print(f"\nUploaded {len(audio_files)} files:")
for f in audio_files:
    print(f"  {f}")

# ── CELL 4: Check GPU ─────────────────────────────────────────────────────────
import torch
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if device.type == "cuda":
    props = torch.cuda.get_device_properties(0)
    print(f"GPU: {props.name}  VRAM: {props.total_memory/1e9:.1f} GB")
    if props.total_memory < 12e9:
        print("WARNING: Less than 12GB VRAM — model may OOM. Try Runtime → Change runtime type → A100.")
else:
    print("ERROR: No GPU found. Go to Runtime → Change runtime type → T4 GPU")

# ── CELL 5: Load SAM-Audio ────────────────────────────────────────────────────
# Downloads ~1GB model weights on first run
from sam_audio import SAMAudio, SAMAudioProcessor

MODEL_ID = "facebook/sam-audio-base"   # ~1B params, fits T4 15GB in FP16
print(f"Loading {MODEL_ID} (downloads ~1GB on first run)...")
model = SAMAudio.from_pretrained(MODEL_ID)
model = model.to(device=device, dtype=torch.float16).eval()
processor = SAMAudioProcessor.from_pretrained(MODEL_ID)
print("Model ready.")

# ── CELL 6: Run SAM-Audio separation on all files ────────────────────────────
import soundfile as sf
import numpy as np
import os

# Text prompt — describes what to KEEP (everything else is residual)
PROMPT = "a person speaking"

sam_output_files = {}

for audio_file in audio_files:
    print(f"\n[{audio_file}]")
    wav, sr = sf.read(audio_file, dtype='float32', always_2d=False)
    if wav.ndim > 1:
        wav = wav.mean(axis=1)  # mono

    inputs = processor(audios=[wav], descriptions=[PROMPT]).to(device)
    with torch.inference_mode():
        result = model.separate(inputs)

    separated = result.target[0].detach().float().cpu().numpy()

    out_name = audio_file.replace('.wav', '_sam_audio.wav')
    sf.write(out_name, separated, sr)
    sam_output_files[audio_file] = out_name
    print(f"  Saved: {out_name}  ({separated.shape[0]/sr:.1f}s)")

print("\nAll files processed.")

# ── CELL 7: Transcribe raw + SAM-Audio with Whisper ──────────────────────────
from openai import OpenAI
client = OpenAI(api_key=OPENAI_KEY)

KNOWN_QUALITY = {
    "RingVideo_20260528_012116": "GOOD",
    "RingVideo_20260528_163907": "BAD",
    "RingVideo_20260529_111652": "BAD (vocal music)",
    "RingVideo_20260529_113106": "MIXED (en+zh)",
    "RingVideo_20260529_151432": "GOOD",
    "RingVideo_20260531_033956": "NEW (zh, 2 speakers)",
}

def transcribe(path):
    with open(path, 'rb') as f:
        return (client.audio.transcriptions.create(
            model='whisper-1', file=f, response_format='text') or '').strip()

def wc(text):
    return len(text.split()) if text else 0

comparisons = []

for orig_file in audio_files:
    sam_file = sam_output_files[orig_file]
    stem = orig_file.replace('.wav', '')
    baseline = KNOWN_QUALITY.get(stem, '?')

    print(f"\n[{stem}]  baseline={baseline}")

    print("  Transcribing raw...", end=' ', flush=True)
    raw_text = transcribe(orig_file)
    print(f"{wc(raw_text)} words")

    print("  Transcribing SAM-Audio...", end=' ', flush=True)
    sam_text = transcribe(sam_file)
    print(f"{wc(sam_text)} words")

    rw, sw = wc(raw_text), wc(sam_text)
    if rw == 0 and sw == 0:   v = "BOTH EMPTY"
    elif rw == 0 and sw > 0:  v = "IMPROVED (raw empty -> SAM has content)"
    elif rw > 0 and sw == 0:  v = "DEGRADED (raw had content -> SAM empty)"
    elif sw/rw >= 0.85:       v = "SIMILAR (within 15%)"
    elif sw > rw:             v = "MORE (SAM longer)"
    else:                     v = f"FEWER (SAM {int((1-sw/rw)*100)}% fewer words)"

    print(f"  VERDICT: {v}")
    print(f"  RAW:       {raw_text[:120]}")
    print(f"  SAM-AUDIO: {sam_text[:120]}")

    comparisons.append({
        'file': stem, 'baseline': baseline,
        'raw_words': rw, 'sam_words': sw, 'verdict': v,
        'raw_text': raw_text, 'sam_text': sam_text
    })

# ── CELL 8: Summary table ─────────────────────────────────────────────────────
print(f"\n{'='*65}")
print("  SUMMARY — SAM-Audio vs Raw")
print(f"{'='*65}")
print(f"{'FILE':<35} {'BASE':<20} {'RAW':>5} {'SAM':>5}  VERDICT")
print("-"*65)
for r in comparisons:
    print(f"{r['file']:<35} {r['baseline']:<20} {r['raw_words']:>5} {r['sam_words']:>5}  {r['verdict']}")

# ── CELL 9: Save and download results ─────────────────────────────────────────
import json
from google.colab import files as colab_files

out_json = 'sam_audio_comparison.json'
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(comparisons, f, ensure_ascii=False, indent=2)

print("\nDownloading results...")
colab_files.download(out_json)
for sam_file in sam_output_files.values():
    colab_files.download(sam_file)
    print(f"  Downloaded: {sam_file}")

print("\nDone. Copy the JSON results back and share for analysis.")
