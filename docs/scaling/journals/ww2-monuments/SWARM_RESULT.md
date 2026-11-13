# World War monuments clip result

STATUS BLOCKED

## SHAs

Origin main is `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`.

The stills commit is `3cd2ec84d319e3bb2fc8cf74c20429fb09531180` on `feat/journal-ww2-monuments-clips`.

The video commit is `3fd90ef10a34bb02927e738a8a790b4c61c3d90e` on `feat/journal-ww2-monuments-clips-video`. That commit adds `scripts/journal-still-motion.mjs`.

## Method

One ffprobe and one full ffmpeg decode per mp4, in clips.json order. First `normandy-where`, then `arizona-how-far`. Both runs were on 2026-11-13 in this worktree, after the final render.

```text
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate,nb_frames -of default=nw=1 <mp4>
ffmpeg -v error -i <mp4> -f null -
```

## Clips built

- `ww2-monuments:normandy-where`
- `ww2-monuments:arizona-how-far`

## Clips cut

None. `clips.json` has no CUT verdict.

## Tools per clip

Both clips used the same tools.

- Still. A local Pillow wash at 1152x768, saved as webp. No text.
- Narration. BLOCKED. The voice the existing Kokoro script pins is `am_fenrir`. No Magnus id and no Briggs id is on disk. The missing ONNX cache is `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. The hub folder `models--hexgrad--Kokoro-82M` has empty weight files. The mux input is `docs/scaling/journals/ww2-monuments/render-out/silence.wav` from `ffmpeg anullsrc`. That file is silence.
- Motion. `node scripts/journal-still-motion.mjs` with ffmpeg 8.1.2. The script logged `journal-still-motion: no bed`. Gain stayed 0.00 dB because integrated loudness was -70.0 LUFS and the script does not boost digital silence. Peak was -inf dBFS.
- No paid image, voice, or video service.

## Money

0

## Pull requests

- Stills draft. https://github.com/veeresh-bikkaneti/Meridian/pull/452
- Video draft. https://github.com/veeresh-bikkaneti/Meridian/pull/453

## Council

NOT RUN

## Band-film e2e

NOT RUN. `card-film.tsx` was not edited.

## What Veeresh must listen to

There is no speech in either mp4. A listen cannot check the caption until a local Kokoro `am_fenrir` take exists. The silent files are `docs/scaling/journals/ww2-monuments/render-out/normandy-where.mp4` and `docs/scaling/journals/ww2-monuments/render-out/arizona-how-far.mp4`.

The captions, character for character, are the lines a later take must speak.

Normandy. "Hey kids, have you heard about this place? Above the beach, it was dedicated in nineteen fifty-six. How many years ago?"

Arizona. "Hey kids, have you heard about this place? This Hawaii memorial is one hundred eighty-four feet long. How many ten-foot steps is that?"

## Measured numbers

Both mp4 files matched.

- Duration 10.000000 seconds.
- Video h264, yuv420p, 1152x768, frame rate 24/1, 240 frames.
- Audio aac, 470 frames.
- Full decode exit 0.
- ebur128 integrated loudness -70.0 LUFS. True peak -inf dBFS, which is under -1 dB.

Frames at 2 seconds, 6 seconds, and 9.5 seconds were opened and compared with the source washes. The 6 second frame is darker in the corners from the vignette. No text. No extra objects.

## Proven defects

- Narration is digital silence. The caption is not spoken. Integrated loudness stayed at -70.0 LUFS.
- The stills are flat color washes. They are not the painted storybook scenes used for the other journal notes. No text, people, or markers are in them.
- The app video URLs point at `/videos/journals/ww2-monuments/`. Those mp4 files are gitignored here. No `meridian-media` checkout is on disk, so the URLs have no host and CardFilm shows the still.
- The educator sign-off in the spec is unsigned. No agent signed it. The renders were made because this slice asked for them.
