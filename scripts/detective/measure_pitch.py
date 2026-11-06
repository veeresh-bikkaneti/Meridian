#!/usr/bin/env python3
"""Measure pitch (F0) stats of a speech file with numpy autocorrelation.

Ported from ~/workspace/meridian-voice-spec/measure_pitch.py (the voice
SPEC's reference implementation) so this repo is self-contained: the
detective render pipeline gates every line on the same measurement the
spec was built with. Method unchanged from the source.

Usage: python3 measure_pitch.py <audio-file>
Decodes to mono 16-bit WAV via ffmpeg, then tracks F0 frame by frame:
50 ms frames, 10 ms hop, autocorrelation peak search over 50-400 Hz,
a frame counts as voiced when its normalised autocorrelation peak > 0.45
and its RMS is above the noise floor. Reports median F0 and the
10th-90th percentile range over voiced frames, as JSON on stdout.
"""
import subprocess, sys, wave, io, json
import numpy as np

src = sys.argv[1]
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000",
     "-f", "wav", "pipe:1"],
    capture_output=True, check=True).stdout
w = wave.open(io.BytesIO(raw))
sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)
x /= 32768.0
duration = len(x) / sr

frame = int(0.050 * sr)          # 50 ms
hop = int(0.010 * sr)            # 10 ms
min_lag = int(sr / 400)          # 400 Hz ceiling
max_lag = int(sr / 50)           # 50 Hz floor
rms_all = np.sqrt(np.mean(x ** 2)) if len(x) else 0.0
floor = max(0.15 * rms_all, 1e-4)

f0s = []
for start in range(0, len(x) - frame, hop):
    seg = x[start:start + frame]
    rms = np.sqrt(np.mean(seg ** 2))
    if rms < floor:
        continue
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, mode="full")[frame - 1:]
    if ac[0] <= 0:
        continue
    acn = ac / ac[0]
    lo, hi = min_lag, min(max_lag, len(acn) - 1)
    lag = lo + int(np.argmax(acn[lo:hi]))
    if acn[lag] > 0.45:
        f0s.append(sr / lag)

f0s = np.array(f0s)
out = {"file": src, "duration_s": round(duration, 2),
       "voiced_frames": int(len(f0s))}
if len(f0s):
    out["f0_median_hz"] = round(float(np.median(f0s)), 1)
    out["f0_p10_hz"] = round(float(np.percentile(f0s, 10)), 1)
    out["f0_p90_hz"] = round(float(np.percentile(f0s, 90)), 1)
    out["f0_mean_hz"] = round(float(np.mean(f0s)), 1)
print(json.dumps(out, indent=1))
