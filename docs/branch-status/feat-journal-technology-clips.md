# Branch status for feat/journal-technology-clips

Technology journal, stills branch. The three kept clips leave Play Lab Coming soon with a still and the caption. Spoken audio is not on this branch.

**Status: STILLS COMMITTED. Narration audio is BLOCKED. The render script is on feat/journal-technology-clips-video.**

## Task

Keep only `technology:first-phone`, `technology:mobile-phone`, and `technology:eniac`. Each clip needs a screenplay, a still, the existing caption, and a narration slot. Do not build a cut clip. Do not edit `card-film.tsx`.

Base is origin/main `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`.

## Commits on this branch

- `a6f7d5d8bfc58d20079f377aaa4a1c673cee305d` adds the three screenplays.
- `7f3f4ec0576bad3107288d590e72caac7e50e1f0` adds the three storybook stills.
- `1030b9d552b0f53b85d8991daf6e96c47c9a669a` shows the clips in Play Lab.

## What landed

Screenplays quote the caption for every spoken line. Beats are 0 to 2, 2 to 4, 4 to 6, 6 to 8, and 8 to 10 seconds.

Stills are `public/images/journals/technology/first-phone.webp`, `mobile-phone.webp`, and `eniac.webp`. `make-stills.py` draws no text.

Play Lab on origin/main has no player for these ids. This branch checks out the committed Play Lab module from `0487d67db0b7f9fbcae818cfe27cdf237f07040d` and adds `journal-watch`. `CardFilm` is the only still fallback. The dirty mockup overlay and `tests/e2e/play-lab.spec.ts` stayed off the branch.

`prompt` and `caption` are the caption text, character for character. The narration URL points at `public/audio/journals/technology/<clip>.mp3`. Those files are absent.

## Left off this branch

`scripts/journal-still-motion.mjs` and the `render-out/` gitignore line are on `feat/journal-technology-clips-video`. No mp4 is committed. Kokoro pytorch weights are on disk. The Kokoro runtime is not, so narration was not rendered.

## Gates run on this tree before the video commit

- `node --experimental-strip-types --test src/play-lab/play-lab.test.ts` reported 12 pass and 0 fail.
- `npx tsc --noEmit` exited 0.
- `npm run lint:content` reported GATE PASSED, with 6 baselined violations and 0 new.
- `node scripts/lint-cards.mjs` reported GATE PASSED.
- `node docs/scaling/journals/technology/check-clips.mjs` reported PASSED on 3 clips.
- `node scripts/validate-journal-manifest.mjs` exited 0.
- `node scripts/detective/check-audio-manifest.mjs` reported the detective audio manifest clean, 4468 entries.

E2E did not run. `card-film.tsx` is untouched.

## Open

Narration files are missing. Cue times in the vtt files stay PROPOSED. Council was not run. Money spent is 0. Veeresh listens to the films. The shipped films are silent until a local voice file exists.

Other journal workers who copy the same Play Lab commit will collide on the interactive id list and on `ProblemCard`.
