# Branch status for feat/journal-ww2-monuments-clips

Two kept World War monument clips show a still and their caption in Play Lab. The Coming soon stamp stays on every other item. Spoken narration is blocked. Local mp4 files stay out of this repo.

**Status: STILLS WIRED. NARRATION BLOCKED. VIDEO LOCAL ONLY.**

Stills draft is https://github.com/veeresh-bikkaneti/Meridian/pull/452. Video draft is https://github.com/veeresh-bikkaneti/Meridian/pull/453. The motion script commit is `3fd90ef10a34bb02927e738a8a790b4c61c3d90e`.

## Base

Branched from `origin/main` at `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`. The dirty `mockup/scale-play` commits are not in this branch. Play Lab files that already existed on that branch were copied so the stamp has a place to leave.

## Done

- [x] Screenplays for `normandy-where` and `arizona-how-far`, written before the renders.
- [x] Storybook stills at `public/images/journals/ww2-monuments/`. Flat watercolor washes. No text.
- [x] `JOURNAL_FILMS` maps those two ids to place name, caption, still, and video URL.
- [x] `ProblemCard` uses `CardFilm` for those ids. Other items keep the Coming soon stamp.
- [x] `docs/scaling/journals/ww2-monuments/render-out/` is gitignored.
- [x] `scripts/journal-still-motion.mjs` builds a 10.0 s, 1152x768, h264 and AAC mp4. That script lands on the video branch.

## Open

- [ ] Kokoro narration. The pinned voice would be `am_fenrir`. The ONNX cache path is missing, and the hub voice weights on disk are empty. No download.
- [ ] Veeresh listens. The muxed track is silence, so there is no speech to hear yet.
- [ ] Educator sign-off is still unsigned. No agent signs it.
- [ ] A `meridian-media` checkout is not on this machine. The app video URLs have no host. `CardFilm` shows the still.
- [ ] Council was not run. The band-film e2e spec was not run. `card-film.tsx` was not edited.

## Resume

```text
git fetch origin
git checkout feat/journal-ww2-monuments-clips
node scripts/validate-journal-manifest.mjs
node scripts/detective/check-audio-manifest.mjs
npm run lint:content
node scripts/lint-cards.mjs
npx tsc --noEmit
node --experimental-strip-types --test src/play-lab/journal-films.test.ts src/play-lab/play-lab.test.ts docs/scaling/journals/ww2-monuments/clips.test.mjs
```

Local renders, when the motion script is on the branch:

```text
node scripts/journal-still-motion.mjs --still public/images/journals/ww2-monuments/normandy-where.webp --narration docs/scaling/journals/ww2-monuments/render-out/silence.wav --out docs/scaling/journals/ww2-monuments/render-out/normandy-where.mp4
node scripts/journal-still-motion.mjs --still public/images/journals/ww2-monuments/arizona-how-far.webp --narration docs/scaling/journals/ww2-monuments/render-out/silence.wav --out docs/scaling/journals/ww2-monuments/render-out/arizona-how-far.mp4
```
