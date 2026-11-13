# Branch status, feat/journal-freedom-fighters-clips

One clip, `freedom-fighters:robben-island`, leaves Coming soon on `/play-lab` with its still, caption, and narration.

Status is STILLS READY. Draft PR is https://github.com/veeresh-bikkaneti/Meridian/pull/448. The motion script ships on `feat/journal-freedom-fighters-clips-video`.

## Task

Build the kept Robben Island clip from the screened caption and `clips.json`. Speak only those lines. Do not add clips. Do not commit the mp4.

## Base

`origin/main` at `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`. The dirty `mockup/scale-play` commits were not carried.

## Scope

- `docs/scaling/journals/freedom-fighters/screenplays/robben-island.md`
- `docs/scaling/journals/freedom-fighters/captions/robben-island.vtt`
- `public/images/journals/freedom-fighters/robben-island.webp`
- `public/videos/journals/freedom-fighters/robben-island.vtt`
- `public/audio/journals/freedom-fighters/robben-island.m4a`
- `src/play-lab/**`, `src/routes/play-lab.tsx`, `src/routeTree.gen.ts`
- `docs/scaling/journals/freedom-fighters/render-out/` is gitignored
- this file

## Done

- Screenplay written before the render. Beats are waiting, build, key moment, reaction, and settle.
- New storybook still, 1152 by 768. No existing watercolor matched this place.
- Caption and narration are the same three sentences.
- `/play-lab` shows the card through `CardFilm`. Any other id stays Coming soon.
- The mp4 stays in the gitignored render folder. `CardFilm` shows the still when that file is absent.
- Narration commit `925d0a23f4474b192b1c5258f1f3eab2311abcd2` replaces the first encode. Measured on the local mp4 after that pass: -18.0 LUFS, true peak -2.7 dBFS.

## Gates

- `node docs/scaling/journals/freedom-fighters/check-clips.mjs` passed, 1 clip.
- `node --experimental-strip-types --test src/play-lab/robben-island-clip.test.ts` passed, 3 tests.
- `node scripts/validate-journal-manifest.mjs` passed.
- `node scripts/detective/check-audio-manifest.mjs` passed, 4468 entries.
- `npm run lint:content` passed. 6 baselined violations, 0 new.
- `node scripts/lint-cards.mjs` passed.
- `npx tsc --noEmit` passed.
- End-to-end film tests were not run. `src/components/card-film.tsx` was not edited.

## Open

- Veeresh listens to the narration. This file cannot certify the voice by ear.
- The video draft PR URL is recorded in `docs/scaling/journals/freedom-fighters/SWARM_RESULT.md` on the video branch.
