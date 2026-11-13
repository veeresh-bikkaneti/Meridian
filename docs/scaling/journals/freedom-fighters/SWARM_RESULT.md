# SWARM_RESULT, freedom-fighters:robben-island

STATUS is PASS.

## SHAs

- Frame-time base is `8eb34cb4305719f88ef8c2568e4dd624cbaf8608` (`origin/main`). The dirty `mockup/scale-play` commits were not carried.
- Screenplay `52c2e5010ba13f786291d58084bb86fe918a8439` on `feat/journal-freedom-fighters-clips`.
- Stills, caption, narration, and `/play-lab` card `9da035bbf6e2f7c5fa5f172eb749f1cd9510ff55`.
- Narration loudness follow-up `925d0a23f4474b192b1c5258f1f3eab2311abcd2`.
- Stills branch tip that records the draft PR `e857fdeeb70e417eff10122fdf272d979ee6012c`.
- Motion script `1589f680599b761f386ab50a87cd35f01e296ef1` on `feat/journal-freedom-fighters-clips-video`.

## Method

`/opt/hatch/bin/tts` is missing. Kokoro ran from the local cache only. No download. `allowRemoteModels` stayed unused because the transformers.js ONNX tree was not the runtime.

- Model `C:\Users\veere\.cache\hyperframes\tts\models\kokoro-v1.0.onnx` (325532387 bytes).
- Voices `C:\Users\veere\.cache\hyperframes\tts\voices\voices-v1.0.bin`.
- Runtime `kokoro_onnx` with local espeak. Voice `am_fenrir`. Speed 1.0. Language `en-us`.
- The transformers.js file the repo voice script expects is absent at `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. That script was not run.
- No Aria. No MAI_01. No paid voice.

Picture motion is `scripts/journal-still-motion.mjs` via local ffmpeg. 10.0 seconds, 1152x768, 24 fps, h264 High, yuv420p, AAC LC, 48000 Hz stereo. zoompan across five beats, short xfade, gentle eq and vignette on the 4 to 6 second beat. No drawtext. No paid or GPU video model.

Loudness is ebur128 gain, not loudnorm. Silence-removed speech measured -18.3 LUFS before gain. The limiter held the wav true peak at -1.0 dBFS only after the gain was cut by 0.8 dB, which left the wav timeline at -19.1 LUFS. A later 1.2 dB makeup on the encoded file, still under the limiter, measured -18.0 LUFS. No bed. Where the narrator is silent, the bed is silence.

The source wav was RIFF, so the 37-byte ID3 strip did not fire. The script still strips 37 bytes when the header is `ID3`.

There is no local meridian-media checkout. It was not cloned. The mp4 stays in gitignored `docs/scaling/journals/freedom-fighters/render-out/`.

## Clips

- Built `freedom-fighters:robben-island` only.
- Cut none. `clips.json` has no CUT list and no second clip was added.

Spoken text, character for character with the caption.

"Hey kids, have you heard about this place? Nelson Mandela was held here. Today it is a museum."

## Tools

- Local Kokoro (`kokoro_onnx`, `am_fenrir`).
- ffmpeg and ffprobe.
- `node scripts/journal-still-motion.mjs`.
- `gh` for two draft PRs.
- Money is 0.

## Pull requests

- Stills draft against `main` is https://github.com/veeresh-bikkaneti/Meridian/pull/448
- Video draft, based on the stills branch, is https://github.com/veeresh-bikkaneti/Meridian/pull/454

No merge.

## Council

Council NOT RUN.

## Listen list

Veeresh listens. This worker cannot certify the voice by ear.

- `public/audio/journals/freedom-fighters/robben-island.m4a` (committed, 10.000000 s, 84272 bytes).
- `docs/scaling/journals/freedom-fighters/render-out/robben-island.mp4` (local only, 10.000000 s, 1493781 bytes).
- Captions `public/videos/journals/freedom-fighters/robben-island.vtt`.

## Verify

- ffprobe duration 10.000000. h264 High, 1152x768, 24/1, 240 frames. AAC LC, 48000 Hz, stereo.
- Full decode exit 0.
- Frames at 2 s, 6 s, and 9.5 s are the watercolor still. No painted words. Sizes 892576, 798600, and 959277 bytes, so the frames are not identical. The 6 s frame is the closer key-moment crop.
- Encoded integrated loudness -18.0 LUFS. Loudness range 5.5 LU. True peak -2.7 dBFS. Peak gate is met.
- `check-clips.mjs` passed, 1 clip.
- `src/play-lab/robben-island-clip.test.ts` passed, 3 tests. Zero tests would have failed the gate.
- `validate-journal-manifest.mjs` passed.
- `check-audio-manifest.mjs` passed, 4468 detective entries. This clip is outside that manifest.
- `npm run lint:content` passed. 6 baselined, 0 new.
- `node scripts/lint-cards.mjs` passed.
- `npx tsc --noEmit` passed.
- End-to-end film tests were not run. `src/components/card-film.tsx` was not edited.

## Proven defects

No open gate failure remains.

Fixed before ship.

- The first limiter pass left the wav true peak at -0.8 dBFS. The script now backs the gain off until the wav true peak is at or under -1 dB. Final wav true peak in the passing run was -1.0 dBFS. Final encoded true peak was -2.7 dBFS.
- That same pass left the file at -19.2 LUFS. The encoded makeup of 1.2 dB brought the delivered file to -18.0 LUFS without crossing -1 dBFS.

Known limits, required by the slice.

- The mp4 is not in the repo, so `/videos/journals/freedom-fighters/robben-island.mp4` 404s. `CardFilm` shows the still. Narration is the separate m4a because `CardFilm` mutes the video element.
- `src/routeTree.gen.ts` was edited by hand so `/play-lab` is registered. `tsc --noEmit` passed.
- Play Lab did not exist on `origin/main`. This slice adds one route and one clip card. It does not carry `mockup/scale-play`.
