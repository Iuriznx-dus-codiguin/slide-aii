"""Male narration for the SlideAI ad with VoiceStudio's default engine,
k2-fsa/OmniVoice (https://github.com/debpalash/VoiceStudio).

1. Designs the narrator once with OmniVoice voice design
   ("male, young adult, low pitch", Portuguese) and keeps that take as the
   reference, so every line comes out in the same voice.
2. Renders each line of src/timeline.ts (VOICE_LINES) by cloning the
   reference. A line longer than its slot is re-rendered with OmniVoice's
   fixed-duration control so it fits.
3. Finishes each clip like a studio read (high-pass, gentle compression,
   presence lift, loudness -16 LUFS, 48 kHz) and records its length in
   src/voice.json, which the video reads to place and duck the narration.

Usage (inside a Python env with `omnivoice`, torch and torchaudio, or a
VoiceStudio install):

    node scripts/export-voice-lines.mjs > /tmp/lines.json
    python scripts/make-voice.py --lines /tmp/lines.json [--model k2-fsa/OmniVoice]

Then render the video again (npm run render / render:vertical).
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

import torch
import torchaudio

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "voice")
MANIFEST = os.path.join(ROOT, "src", "voice.json")

INSTRUCT = "male, young adult, low pitch"
LANGUAGE = "pt"  # VoiceStudio: plain Portuguese means Brazilian Portuguese
REF_TEXT = (
    "Olá! Com o Slaid Ei Ai, você descreve o tema e recebe uma apresentação completa, "
    "com roteiro, design e imagens, em menos de um minuto."
)
# Broadcast-style finishing chain (ffmpeg).
FINISH = (
    "highpass=f=75,"
    "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,"
    "equalizer=f=3500:t=q:w=1.2:g=2.5,"
    "loudnorm=I=-16:TP=-1.5:LRA=7,"
    "aresample=48000"
)


def generate(model, seed, **kw):
    torch.manual_seed(seed)
    t = time.time()
    audio = model.generate(language=LANGUAGE, num_step=32, guidance_scale=2.0, **kw)[0]
    print(f"  {audio.shape[-1] / model.sampling_rate:.2f}s of audio in {time.time() - t:.1f}s", flush=True)
    return audio


def finish(raw_path, out_path):
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", raw_path, "-af", FINISH, "-ac", "1", "-c:a", "pcm_s16le", out_path],
        check=True,
    )
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out_path],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(probe.stdout.strip()), 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", required=True, help="JSON from scripts/export-voice-lines.mjs")
    ap.add_argument("--model", default="k2-fsa/OmniVoice", help="HF repo id or local path")
    ap.add_argument("--device", default=None)
    ap.add_argument("--seed", type=int, default=7, help="seed for the voice design take")
    ap.add_argument("--only", default=None, help="comma-separated line ids to (re)render")
    args = ap.parse_args()

    from omnivoice.models.omnivoice import OmniVoice

    device = args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    dtype = torch.float16 if device == "cuda" else torch.float32
    model = OmniVoice.from_pretrained(args.model, device_map=device, dtype=dtype)
    sr = model.sampling_rate
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = tempfile.mkdtemp()

    ref_path = os.path.join(OUT_DIR, "_reference.wav")
    if not os.path.exists(ref_path):
        print("designing the narrator voice…", flush=True)
        ref = generate(model, args.seed, text=REF_TEXT, instruct=INSTRUCT)
        torchaudio.save(ref_path, ref, sr)

    lines = json.load(open(args.lines))
    only = set(args.only.split(",")) if args.only else None
    manifest = json.load(open(MANIFEST))
    clips = manifest.setdefault("clips", {})

    for i, line in enumerate(lines):
        if only and line["id"] not in only:
            continue
        print(f"{line['id']}: {line['text']}", flush=True)
        kw = dict(text=line["text"], ref_audio=ref_path, ref_text=REF_TEXT)
        audio = generate(model, 100 + i, **kw)
        if audio.shape[-1] / sr > line["max"] * 0.97:
            audio = generate(model, 100 + i, duration=line["max"] * 0.93, **kw)
        raw = os.path.join(tmp, f"{line['id']}.wav")
        torchaudio.save(raw, audio, sr)
        clips[line["id"]] = finish(raw, os.path.join(OUT_DIR, f"{line['id']}.wav"))
        print(f"  -> {clips[line['id']]}s (slot {line['max']}s)", flush=True)

    with open(MANIFEST, "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"updated {MANIFEST}")


if __name__ == "__main__":
    sys.exit(main())
