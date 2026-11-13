# People and places swarm result

STATUS: BLOCKED

Spoken captions were not produced. The shelf can show the still and the written caption. It cannot play the caption yet.

## SHAs

- Base `origin/main`: `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`
- Stills branch `feat/journal-people-places-clips`: `2c9c1f64baa3088019a26a2f1694bbee1eb7df39`
- Video motion commit on `feat/journal-people-places-clips-video`: `1bdfc2dd3272ca3c2583d9caa91ccc75aa123d22`
- Swarm result commit: `4e79f6374bea185e09d38df58c6a6cadea6f5921`

Dirty `mockup/scale-play` at `0487d67db0b7f9fbcae818cfe27cdf237f07040d` was not carried.

## Method

Play Lab is not on `origin/main`, so these five clips are a home shelf, not six new Play Lab ids. The shelf reuses `CardFilm`. `card-film.tsx` was not edited. There is no second fallback. Reduced motion still lands on `stillUrl` inside `CardFilm`.

`game-app.tsx` mounts `PeoplePlacesShelf` after the journal section. It does not add a seventh `<CardFilm` tag. The shelf passes one `CardFilm` per kept clip, the place name, and the caption. An audio element renders only when a narration file is listed. The map is empty.

Captions are copied from `clips.json` `narration` and checked against the caption txt. `clips.json` count stays PROPOSED.

Stills are a local PNG painter (`scripts/paint-people-places-stills.mjs`) encoded with ffmpeg libwebp. No text. No paid image tool.

Screenplays were written before the render. Narrator lines are quotes from the caption only.

Voice uses `scripts/render-people-places-voice.mjs` with `allowRemoteModels=false`. It does not download. `scripts/render-storyteller-voice.mjs` was not run.

Motion uses `scripts/journal-still-motion.mjs`. 10.0 s, 1152x768, 24 fps, h264 + AAC, zoompan, 0.5 s fade, no drawtext. Silence is `anullsrc` and the log line `no bed`. Loudness target for a real narration file is ebur128 to -18 LUFS, not loudnorm, then a limiter near -1 dB. That path was not exercised. A 37-byte ID3 strip is in the script and was not exercised.

No meridian-media checkout. Mp4 files stay in gitignored `docs/scaling/journals/people-places/render-out/`. They are not committed.

## Built

- people-places:akashi-span
- people-places:pont-du-gard
- people-places:eratosthenes-earth
- people-places:andean-roads
- people-places:aconcagua-height

## Cut

Never built and never narrated.

- maya-culture
- shaolin
- bodhidharma
- vivekananda
- zeus

Eratosthenes stays the measurement sentence in the screened caption. Ram Setu does not appear.

## Tools

- node tests, readability, manifest checks, lint, tsc
- ffmpeg 8.1 and ffprobe for webp and mp4
- local Kokoro check only. The ONNX cache is absent.
- gh for two draft pull requests
- Money: 0
- Not used: image generation, image-to-video, Aria, MAI, paid voice, `/opt/hatch/bin/tts`, npm install, clone of meridian-media

## Pull requests

- Stills draft against `main`: https://github.com/veeresh-bikkaneti/Meridian/pull/449
- Video draft against `feat/journal-people-places-clips`: https://github.com/veeresh-bikkaneti/Meridian/pull/450
- Not merged.

## Council

NOT RUN

## Listen list

Veeresh's listen is the ear check. Do not use the silent mp4 as that check. When a local Kokoro file exists, hear these five lines and nothing else.

1. akashi-span. Hey kids, have you heard about this place? Its middle span is 1,991 meters long.
2. pont-du-gard. Hey kids, have you heard about this place? This bridge in France has 35 arches on its top row.
3. eratosthenes-earth. Hey kids, have you heard about this place? In Alexandria, Eratosthenes multiplied 5,000 stadia by 50.
4. andean-roads. Hey kids, have you heard about this place? These Andean roads stretch about 30,000 kilometers.
5. aconcagua-height. Hey kids, have you heard about this place? Aconcagua, in Argentina, is the Americas' tallest peak. Its published heights disagree.

## Render numbers

Order is `clips.json`. Each full decode exited 0. Frames exist at 2, 6, and 9.5 s. Peak gate is `<= -1 dB`. `-inf` passes that gate and is not speech.

| clip | duration | picture | audio | file bitrate | integrated | peak | bed |
|---|---|---|---|---|---|---|---|
| akashi-span | 10.000000 | h264 yuv420p 1152x768 24 fps | AAC LC stereo 48000 Hz | 377 kb/s | -70 LUFS | -inf dBFS | no bed |
| pont-du-gard | 10.000000 | h264 yuv420p 1152x768 24 fps | AAC LC stereo 48000 Hz | 374 kb/s | -70 LUFS | -inf dBFS | no bed |
| eratosthenes-earth | 10.000000 | h264 yuv420p 1152x768 24 fps | AAC LC stereo 48000 Hz | 384 kb/s | -70 LUFS | -inf dBFS | no bed |
| andean-roads | 10.000000 | h264 yuv420p 1152x768 24 fps | AAC LC stereo 48000 Hz | 317 kb/s | -70 LUFS | -inf dBFS | no bed |
| aconcagua-height | 10.000000 | h264 yuv420p 1152x768 24 fps | AAC LC stereo 48000 Hz | 291 kb/s | -70 LUFS | -inf dBFS | no bed |

## Checks

- `node scripts/render-people-places-voice.mjs` exit 1. Narration BLOCKED. Missing `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`.
- `clips.test.mjs` 7 pass.
- `people-places-film.test.ts` 4 pass.
- `card-film.test.ts` and `home-smooth-cards.test.ts` 47 pass.
- readability, all kept lines under the band limit, exit 0.
- `validate-journal-manifest.mjs` exit 0.
- `check-audio-manifest.mjs` 4468 entries, exit 0.
- `lint:content` gate passed, 6 baselined, 0 new.
- `lint-cards.mjs` gate passed.
- `npx tsc --noEmit` exit 0.
- E2E not run. `card-film.tsx` was not edited.
- Full `npm test` not run.

## Proven defects

- No spoken file. The shelf does not render an audio element. The done line "still, caption, and narration" is only two of three.
- Hosted video is absent. `videoUrl` points at `videos/journals/people-places/<clip>.mp4`, which is not in git. CardFilm falls back to the still after the video errors. That is the existing player, not a new fallback.
- The mastered -18 LUFS voice path, the 4 to 6 second equalizer, the limiter on real speech, and the 37-byte ID3 strip were not run. Silence never enters that filter.
- The voice script also exits 1 if the ONNX directory exists, until a voice bin check is added. The proven failure today is the missing directory.
- Storybook limits, inspected at the 6 s frames and the stills. No burned-in text. Pont's top row is a scallop of small arches, not a counted 35. The Andean road sits on the near ridge and is almost straight on the right. Aconcagua is one grey peak with one white snow triangle. Akashi's cables meet in a V at the deck. Eratosthenes is a low block city, a short post, a small shadow, and a dotted arc.
- Caption VTT timings stay PROPOSED. No real voice was available to time them.
- Council was not run. A second model did not review the diff.
