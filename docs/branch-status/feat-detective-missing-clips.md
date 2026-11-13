# BRANCH_STATUS feat/detective-missing-clips

**Branch.** `feat/detective-missing-clips`

**Synced.** `origin/main` at `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`

**Scope.** The three detective moment lines already written in `MOMENT_LINES`. No journal film. No name clips. No new sentences.

## Done

- [x] Confirmed the three ids are absent from `FIXED_LINES` and from `public/audio/detective/manifest.json`.
- [x] Tried `scripts/detective/render-audio.mjs`. It stopped because `/opt/hatch/bin/tts` is not on this machine (exit 6).
- [x] Looked for the local Kokoro cache the storyteller render script names. The ONNX cache and `kokoro-js` are absent. The hexgrad snapshot's weight files are dangling symlinks. No male voice bins are on disk.
- [x] Left `FIXED_LINES` and the manifest unchanged. `coverage.fixed` is true, so new plan rows without files would fail the audio gate. The claim was dropped.
- [ ] Audio files for `beat-me`, `win-together`, and `truce-watson`. Not built.

## Gates

- [x] `node scripts/detective/check-audio-manifest.mjs` passed. Output was `detective audio: manifest clean (4468 entries verified)`. Exit 0.
- [x] `npx tsc --noEmit --project .scratch/tsconfig.detective-check.json` passed. Exit 0. That project file is gitignored and excludes only the untracked mockup `src/play-lab/components/ScaledHomeMockup.tsx`, which is not on this branch.
- [ ] `npx tsc --noEmit` failed, exit 2. The only errors are in that untracked mockup file. Not introduced by this branch.
- [ ] `node --test scripts/detective/render-plan.test.mjs` failed before any assertion. Exit 1. `tests 1`, `pass 0`, `fail 1`. Node on Windows opens `C:\C:\Users\...` because the test builds a path from `new URL().pathname`. Pre-existing. A direct import of `render-plan.mjs` (no clue-file read) still reports `FIXED_LINES.length` 26 and the three ids absent.
- [x] Full `npm test` was not run, by the slice rules.

## Listen

Nothing new. The three captions still have no clips. A later render, if it lands, should be heard in this order.

1. `beat-me`. Watson. `You beat me to it!`
2. `win-together`. Holmes. `We did it together!`
3. `truce-watson`. Watson. `Good try! We'll crack the next one together.`

## Notes

Money spent: 0. Council: NOT RUN. The mockup/scale-play working tree was not carried onto this branch. Its tracked changes sit in `stash@{0}` with the subject `mockup/scale-play tracked dirt, not part of detective-missing-clips`. That stash was not dropped.
