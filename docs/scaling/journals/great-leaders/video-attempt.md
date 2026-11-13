# Video attempt

STATUS stays BLOCKED. The three KEEP clips have no narration audio, so no clip mp4 was rendered.

## Why it stopped

The Kokoro ONNX cache is missing at `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. `kokoro-js` is missing at `C:\Users\veere\workspace\aidemo-pilot\engine`. `/opt/hatch/bin/tts` is absent. The pytorch cache at `C:\Users\veere\.cache\huggingface\hub\models--hexgrad--Kokoro-82M` was left unused. Nothing was downloaded. `scripts/render-storyteller-voice.mjs` was not run.

`narrationUrl` stays null. `scripts/journal-still-motion.mjs` requires `--narration`, so it was not run for lincoln-memorial, jhansi-fort, or netaji-bhawan.

There is no local meridian-media checkout. Output stays in gitignored `docs/scaling/journals/great-leaders/render-out/`. No mp4 is committed to Meridian.

## Probe, not a clip

A 220 Hz sine, three seconds long, was muxed with the Lincoln still to check the script. The file is `docs/scaling/journals/great-leaders/render-out/probe.mp4`. It is not narration and it is not a clip.

Measured with ffprobe and ffmpeg ebur128.

- Duration 10.000000 seconds.
- Video h264, 1152x768, average frame rate 24/1.
- Audio aac, 48000 Hz, stereo.
- Full decode exit 0.
- True peak -1.2 dBFS, which meets the -1 dB ceiling.
- Integrated loudness -2.7 LUFS. That number is the limited sine, not speech at -18 LUFS.
- The script prints `no bed`.

Frames were extracted at 2 seconds, 6 seconds, and 9.5 seconds into the same gitignored folder.

Money is 0.
