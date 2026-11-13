# BRANCH_STATUS — feat/journal-people-places-clips

Stream: People and places journal. Stills shelf, then a silent local render on the video branch.

**Status: BLOCKED. Spoken caption is missing. Draft PRs, not merged.**

Base: `origin/main` at `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`. Dirty `mockup/scale-play` was not carried.

## This pass

```text
TASK: Five kept clips leave the shelf with a still, the caption, and that
  same caption spoken. Screenplay before render. No mp4 in this repo.
Done: still, caption, screenplay, silent 10s render. Narration blocked.
```

Built:

- people-places:akashi-span
- people-places:pont-du-gard
- people-places:eratosthenes-earth
- people-places:andean-roads
- people-places:aconcagua-height

Cut, never built:

- maya-culture
- shaolin
- bodhidharma
- vivekananda
- zeus

Done:

- [x] Home shelf reuses CardFilm. Caption matches `clips.json` narration and the caption txt. No "Coming soon". No quiz choices. `card-film.tsx` untouched.
- [x] Age bands. 7-10 sees two clips, 10-18 sees four, 18+ sees five.
- [x] Five storybook stills, no text, under `public/images/journals/people-places/`.
- [x] Screenplays in `docs/scaling/journals/people-places/screenplays/` before the render.
- [x] `clips.json` count stays PROPOSED.
- [x] Silent mp4s in gitignored `docs/scaling/journals/people-places/render-out/`. Each clip is 10.000000 s, h264 yuv420p 1152x768, 24 fps, AAC LC stereo 48000 Hz. Integrated -70 LUFS. Peak -inf dBFS. Printed "no bed". Full decode exit 0. Frames at 2, 6, and 9.5 s.
- [x] `node --test docs/scaling/journals/people-places/clips.test.mjs` — 7 pass.
- [x] `node --experimental-strip-types --test src/components/people-places-film.test.ts` — 4 pass.
- [x] `card-film.test.ts` and `home-smooth-cards.test.ts` — 47 pass. Game-app still has six `<CardFilm` tags.
- [x] readability, `validate-journal-manifest.mjs`, `check-audio-manifest.mjs`, `lint:content`, `lint-cards.mjs`, `tsc --noEmit` — exit 0.
- [x] Money 0. No paid voice, no paid video, no download.

Open:

- [ ] Narration. `scripts/render-people-places-voice.mjs` exits 1. Missing `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. allowRemoteModels=false. The shelf renders no audio element until a file is listed.
- [ ] Hosted video. No meridian-media checkout. `videoUrl` is not in git. CardFilm falls back to the still when the file 404s.
- [ ] Veeresh listen. The silent track is not the listen. Hear each caption once a real Kokoro file exists.
- [ ] Council NOT RUN.
- [x] Draft stills PR against main: https://github.com/veeresh-bikkaneti/Meridian/pull/449 at `2c9c1f64baa3088019a26a2f1694bbee1eb7df39`.
- [x] Draft video PR against the stills branch: https://github.com/veeresh-bikkaneti/Meridian/pull/450. Motion commit `1bdfc2dd3272ca3c2583d9caa91ccc75aa123d22`. Result commit `4e79f6374bea185e09d38df58c6a6cadea6f5921`. Not merged.

Resume: `git fetch origin`, check out `feat/journal-people-places-clips`, then the node commands above. Do not run `scripts/render-storyteller-voice.mjs`. Do not `npm test`.
