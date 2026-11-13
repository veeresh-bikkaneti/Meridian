# Modern-world clip result

Goal. Three modern-world clips leave Play Lab Coming soon with a still, a caption, and narration.

STATUS PASS

## SHAs

- Base `origin/main` is `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`.
- Stills, captions, and narration are `edf602436c395351815477cbd412a1a12ea511de` on `feat/journal-modern-world-clips`.
- Play Lab wiring is `4a8ca6c3b435c8c2bb432c5b2a7aa1634b86a9eb`.
- First branch-status commit is `0779904ed29240bcaca06244992a4c13e1452336`.
- Still-motion renderer is `a1a919686c7fe0a15ec6a54e80df0e25a5412d01` on `feat/journal-modern-world-clips-video`.
- The commit that adds this file is the tip of `feat/journal-modern-world-clips-video` after that renderer commit.

## Method

Screenplays came first, one file per clip, with beats at 0-2, 2-4, 4-6, 6-8, and 8-10. Narration is the caption text joined from the existing VTT cues. Local Kokoro ONNX voice `am_fenrir` at speed 1.0 wrote the wavs. `allowRemoteModels` stayed off and nothing was downloaded. `scripts/render-modern-world-narration.py` measured ebur128, applied the gain to -18 LUFS, then limited with `alimiter=limit=0.841`. ffmpeg `scripts/journal-still-motion.mjs` then made a 10.0 s, 1152x768, 24 fps h264 and AAC film with zoompan, a 0.5 s fade at 5.5 s, a short 3 kHz eq from 3.5 s to 7.5 s, the same loudness target, and the same limiter. There is no music bed and no drawtext. The mp4 files are gitignored.

## Built and cut

Built only these KEEP ids.

- `modern-world:greenwich-zero`
- `modern-world:liverpool-manchester`
- `modern-world:hearts-content-cable`

`clips.json` is unchanged. No CUT entry was written.

## Tools

- ffmpeg and ffprobe from the local WinGet links.
- sharp from the junctioned `node_modules`, used only to raster the SVG stills. This ffmpeg build has no SVG decoder.
- Python `kokoro_onnx` with `C:\Users\veere\.cache\hyperframes\tts\models\kokoro-v1.0.onnx` and `C:\Users\veere\.cache\hyperframes\tts\voices\voices-v1.0.bin`.
- GitHub CLI `gh`. No Origin CLI on this machine.

Money 0. No Aria, no MAI_01, no paid TTS, no Veo, no Kling, and `scripts/render-storyteller-voice.mjs` was not run.

## Pull requests

- Stills draft against `main`: https://github.com/veeresh-bikkaneti/Meridian/pull/445
- Video draft against `feat/journal-modern-world-clips`: https://github.com/veeresh-bikkaneti/Meridian/pull/455

Neither PR was merged.

## Council

Council NOT RUN.

## Listen list

Veeresh's listen is the ear check.

- `public/audio/journals/modern-world/greenwich-zero.wav`
- `public/audio/journals/modern-world/liverpool-manchester.wav`
- `public/audio/journals/modern-world/hearts-content-cable.wav`
- `docs/scaling/journals/modern-world/render-out/greenwich-zero.mp4`
- `docs/scaling/journals/modern-world/render-out/liverpool-manchester.mp4`
- `docs/scaling/journals/modern-world/render-out/hearts-content-cable.mp4`

## Proof

Checked on 2026-11-13 in this worktree.

- `ffprobe` for all three films. Duration 10.000000, 1152x768, `avg_frame_rate` 24/1, h264, AAC 48000 Hz stereo. Sizes 403594, 339197, and 339146 bytes.
- Full decode `ffmpeg -f null` exit 0 for all three.
- Frames at 2 s, 6 s, and 9.5 s exist under `render-out/frames/`. Read this session. Greenwich tightens from 2 s to 6 s and settles a little by 9.5 s. Liverpool at 6 s shows a small steam engine between two roof clusters. Heart's Content at 6 s shows a ship, a cable entering the water, and a shore station. No burned-in text. No flags. No flash between those frames.
- ebur128 on the mp4 files. Greenwich I -18.1 LUFS, peak -4.2 dBFS. Liverpool I -18.0 LUFS, peak -4.1 dBFS. Heart's Content I -18.0 LUFS, peak -4.3 dBFS. Every peak is under -1 dB.
- `node scripts/validate-journal-manifest.mjs --manifest public/videos/journal-manifest.json --images-dir public/images/journal` exit 0. That script checks the 106 home films. It does not read the scaling manifest.
- `node scripts/detective/check-audio-manifest.mjs` exit 0, 4468 entries.
- `npm run lint:content` GATE PASSED, 6 baselined, 0 new.
- `node scripts/lint-cards.mjs` GATE PASSED.
- `.\node_modules\.bin\tsc.cmd --noEmit` exit 0.
- `node --experimental-strip-types --test src/play-lab/play-lab.test.ts` shows 12 pass, 0 fail. The caption test joins the VTT cues and matches `JOURNAL_FILMS` narration character for character.
- `git diff --stat 8eb34cb4305719f88ef8c2568e4dd624cbaf8608 -- src/components/card-film.tsx` is empty. E2E was not run.
- `git check-ignore` matches `.gitignore` line 31 for `render-out/greenwich-zero.mp4`.

## Proven defects

None that fail the still, caption, and narration bar.

Limits a later host still has to know.

- Play Lab's film URL is `/videos/journals/modern-world/<slug>.mp4`. That file is not in git. CardFilm already shows the still when the video request fails. Reduced motion also shows the still, from the untouched CardFilm path.
- The rendered motion is a zoom on one still. Heart's Content does not pan over to the station. The cable ends in the water, which matches the still.
- The voice was not accepted by ear in this pass.
