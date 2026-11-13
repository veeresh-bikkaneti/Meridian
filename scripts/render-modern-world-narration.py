"""Render the three modern-world narrations from the local Kokoro cache.

No download. If the model, the voices file, or kokoro_onnx is missing, exit 2
and print BLOCKED with the path. The spoken text must match the clip VTT.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs" / "scaling" / "journals" / "modern-world"
OUT = REPO / "public" / "audio" / "journals" / "modern-world"
MODEL = Path.home() / ".cache" / "hyperframes" / "tts" / "models" / "kokoro-v1.0.onnx"
VOICES = Path.home() / ".cache" / "hyperframes" / "tts" / "voices" / "voices-v1.0.bin"
VOICE = "am_fenrir"
SPEED = 1.0

SLUGS = (
    "greenwich-zero",
    "liverpool-manchester",
    "hearts-content-cable",
)


def narration_from_vtt(path: Path) -> str:
    cues: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed == "WEBVTT" or "-->" in trimmed or trimmed.startswith("NOTE"):
            continue
        cues.append(trimmed)
    return " ".join(cues)


def fail(msg: str) -> None:
    print(f"BLOCKED {msg}", file=sys.stderr)
    raise SystemExit(2)


def strip_id3(path: Path) -> None:
    data = path.read_bytes()
    if not data.startswith(b"ID3") or len(data) < 10:
        return
    size = int.from_bytes(data[6:10], "big")
    # Synchsafe size. The hatch tag this repo met was 37 bytes total.
    synchsafe = ((size & 0x7F000000) >> 3) | ((size & 0x7F0000) >> 2) | ((size & 0x7F00) >> 1) | (size & 0x7F)
    tag_len = 10 + synchsafe
    if data[:3] == b"ID3" and tag_len == 37:
        path.write_bytes(data[37:])
        return
    if tag_len < len(data):
        path.write_bytes(data[tag_len:])


def measure(path: Path) -> tuple[float, float]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(path),
            "-af",
            "ebur128=peak=true:framelog=quiet",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    log = proc.stderr
    integ = re.search(r"I:\s+([-\d.]+) LUFS", log)
    peak = re.search(r"Peak:\s+([-\d.]+) dBFS", log)
    if not integ or not peak:
        fail(f"could not measure {path}")
    return float(integ.group(1)), float(peak.group(1))


def master(path: Path) -> dict[str, float]:
    before_i, before_p = measure(path)
    gain = -18.0 - before_i
    tmp = path.with_suffix(".master.wav")
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-af",
            f"volume={gain:.4f}dB,alimiter=limit=0.841:level=0",
            "-ar",
            "24000",
            str(tmp),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        fail(f"ffmpeg master failed for {path}: {proc.stderr}")
    tmp.replace(path)
    after_i, after_p = measure(path)
    if after_p > -1.0:
        fail(f"{path} peak {after_p} dBFS is above -1 dB")
    return {
        "before_lufs": before_i,
        "before_peak": before_p,
        "gain_db": round(gain, 3),
        "after_lufs": after_i,
        "after_peak": after_p,
    }


def main() -> None:
    if not MODEL.is_file():
        fail(f"Kokoro model missing at {MODEL}")
    if not VOICES.is_file():
        fail(f"Kokoro voices missing at {VOICES}")
    try:
        import kokoro_onnx
        import soundfile as sf
    except ImportError as exc:
        fail(f"local kokoro import failed ({exc}). Model cache is {MODEL}")

    lines = {slug: narration_from_vtt(DOCS / f"{slug}.vtt") for slug in SLUGS}
    kokoro = kokoro_onnx.Kokoro(str(MODEL), str(VOICES))
    names = set(kokoro.get_voices())
    if VOICE not in names:
        fail(f"voice {VOICE} not in local voices file {VOICES}")

    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for slug, text in lines.items():
        samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED)
        dest = OUT / f"{slug}.wav"
        sf.write(str(dest), samples, rate)
        strip_id3(dest)
        loud = master(dest)
        duration = len(samples) / rate
        report.append(
            {
                "slug": slug,
                "seconds": round(duration, 3),
                "chars": len(text),
                "path": str(dest),
                **loud,
            }
        )
        print(f"{slug} {duration:.3f}s peak {loud['after_peak']} dBFS {dest}")
    print(json.dumps({"voice": VOICE, "speed": SPEED, "model": str(MODEL), "clips": report}))


if __name__ == "__main__":
    main()
