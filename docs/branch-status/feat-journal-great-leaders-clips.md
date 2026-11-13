# Branch status — `feat/journal-great-leaders-clips`

## Task

Build the three KEEP great-leaders clips so a child sees the still, the real caption, and the narration. Skip CUT rows. Do not carry the dirty `mockup/scale-play` worktree.

## Base

- Branch starts at `origin/main` `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`.
- Parent worktree was dirty `mockup/scale-play` at `0487d67db0b7f9fbcae818cfe27cdf237f07040d`. That uncommitted dirt was not carried. The committed Play Lab files from that SHA were added, because `ProblemCard.tsx` does not exist on main and the placeholder lived there.

## Done

- Screenplays for lincoln-memorial, jhansi-fort, and netaji-bhawan.
- New stills, because `public/images/journal` has no watercolor for these three places. No text in the pictures.
- Public caption files and `public/videos/journals/great-leaders/manifest.json`.
- Play Lab shows `CardFilm` plus the caption text for the three KEEP ids. Lincoln's two-step questions stay. The placeholder badge and the one-line fake caption are gone. Jhansi and Netaji are not "Coming soon".
- `scripts/journal-still-motion.mjs` and `scripts/paint-great-leaders-stills.mjs`.
- `docs/scaling/journals/great-leaders/render-out/` is gitignored. No mp4 is committed.

## Video branch

`feat/journal-great-leaders-clips-video` starts from the stills commit. `docs/scaling/journals/great-leaders/video-attempt.md` records the blocked render. No clip mp4 was produced.

## Not done

- Narration audio is BLOCKED. The Kokoro ONNX cache used by `scripts/render-storyteller-voice.mjs` is missing at `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. `kokoro-js` is not resolvable from `C:\Users\veere\workspace\aidemo-pilot\engine`. `/opt/hatch/bin/tts` is absent. Nothing was downloaded.
- Clip mp4s were not rendered. There is no local `meridian-media` checkout, and there is no narration to mux.

## Checks

- `node docs/scaling/journals/great-leaders/check-clips.mjs` passed, 3 PROPOSED.
- `node scripts/validate-journal-manifest.mjs` passed on the existing 106-movie manifest.
- `node scripts/detective/check-audio-manifest.mjs` passed.
- `npm run lint:content` passed. `node scripts/lint-cards.mjs` passed.
- `npx tsc --noEmit` passed.
- `node --experimental-strip-types --test src/play-lab/play-lab.test.ts` passed, 12 tests.
- `card-film.tsx` was not edited. No e2e run.

## Resume

```
git fetch origin
git switch feat/journal-great-leaders-clips
node scripts/paint-great-leaders-stills.mjs
node --experimental-strip-types --test src/play-lab/play-lab.test.ts
```

Narration stays blocked until the ONNX cache above is already on disk. Then render with `scripts/journal-still-motion.mjs` and do not commit the mp4.
