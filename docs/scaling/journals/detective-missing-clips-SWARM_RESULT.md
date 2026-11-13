# Detective missing clips

STATUS BLOCKED

The player already asks for three fixed lines. The render plan does not list them, so the player stays silent. This run did not add the rows or invent the audio. The audio gate would fail closed if the plan claimed files that are not on disk.

## SHAs

- origin/main: `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`
- Frame-time SHA: `8eb34cb4305719f88ef8c2568e4dd624cbaf8608` (same commit)
- Branch: `feat/detective-missing-clips`, created from that commit. The tip is the commit that adds this file.

## Method

1. Fetched `origin/main` and branched from it. Did not carry the dirty `mockup/scale-play` tree. Tracked dirt is in `stash@{0}` (`mockup/scale-play tracked dirt, not part of detective-missing-clips`). The stash was not dropped.
2. Read `MOMENT_LINES` in `src/game/loop/detective/detective-state.ts`. The captions are already the three sentences below. They were not edited.
3. Read `FIXED_LINES` and `VOICES` in `scripts/detective/render-plan.mjs`. Pinned voices are `avocado_v2:atlas` (Holmes) and `avocado_v2:pb1_music_02` (Watson). Length is 26. The three ids are absent.
4. Read `collectExpectedSpecs` in `scripts/detective/audio-manifest.mjs`. When `coverage.fixed` is true, every `FIXED_LINES` row must be in the manifest and the mp3 must exist. The live manifest has `coverage.fixed: true` and 26 fixed entries.
5. Ran `node scripts/detective/render-audio.mjs --fixed`. Exit 6. stderr said `required tool missing at /opt/hatch/bin/tts`.
6. Did not run `scripts/render-storyteller-voice.mjs`. Did not download models. Did not call a paid voice. Did not use Aria or MAI_01.
7. Local Kokoro, checked and not usable:
   - `kokoro-js` does not resolve. `C:\Users\veere\workspace\aidemo-pilot\engine` does not exist. `AIDEMO_ENGINE_DIR` is unset.
   - `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx` does not exist.
   - `C:\Users\veere\.cache\huggingface\hub\models--hexgrad--Kokoro-82M` lists `kokoro-v1_0.pth`, `voices\af_heart.pt`, and `voices\bf_emma.pt`. Those three paths are symlinks to missing blobs. The only real file in that snapshot is `config.json` (2351 bytes).
   - Python `kokoro` is not installed. `kokoro-onnx` 0.4.7 is installed and needs an ONNX file plus a voices `.bin`. Neither is on disk.
   - The only voice names in that cache are `af_heart` and `bf_emma`. Both are female. No local male voice bin was found, so no Holmes or Watson substitute was chosen.
8. Chose to leave the manifest unchanged, and to leave `FIXED_LINES` unchanged. Adding the three rows without mp3 files makes the gate report `missing` for each id. The slice says to drop the claim when new entries fail the gate.

## Clips built

None.

| id | speaker | caption | file |
| --- | --- | --- | --- |
| beat-me | Watson | You beat me to it! | not built |
| win-together | Holmes | We did it together! | not built |
| truce-watson | Watson | Good try! We'll crack the next one together. | not built |

Tools per clip: none. No ffprobe and no decode, because the three mp3 paths are absent (`Test-Path` false for each).

An existing Watson fixed line, `public/audio/detective/fixed/lets-find-clues.mp3`, was probed only as the pattern a future file should match. One ffprobe, one full decode, one ebur128 pass.

- ffprobe: codec mp3, 24000 Hz, 1 channel, 64000 bit/s, duration 1.824000 s, size 14629 bytes.
- `ffmpeg -v error -i` that file `-f null -` exit 0.
- ebur128: integrated -31.8 LUFS, true peak -13.6 dBFS. The detective renderer does not run loudnorm. It writes the TTS file and applies `volume=` only when `gainDb` is not 0. A future local render should measure with ebur128, not loudnorm, and keep the peak at or under -1 dB. This reference peak is already under that cap. One measurement, one file. Not a speed number.

## Money

0. No paid API. No account opened.

## Verification

- `node scripts/detective/check-audio-manifest.mjs` exit 0. Printed `detective audio: manifest clean (4468 entries verified)`.
- `node --input-type=module` import of `render-plan.mjs`: length 26, `beat-me` false, `win-together` false, `truce-watson` false.
- `node --test scripts/detective/render-plan.test.mjs` exit 1. `tests 1`, `pass 0`, `fail 1`. The file throws at line 17 before tests run. Path seen: `C:\C:\Users\veere\.grok\worktrees\repos-meridian\subagent-01a1d523-505c-7753-8f99-a062c0b0e0e1\public\loop\clues\137.json`. Git Bash hit the same Node error. WSL has no `node`.
- `npx tsc --noEmit` exit 2. Errors are only in untracked `src/play-lab/components/ScaledHomeMockup.tsx`.
- `npx tsc --noEmit --project .scratch/tsconfig.detective-check.json` exit 0. The overlay excludes that untracked file and is not committed (`.scratch/` is gitignored).
- Full `npm test` was not run.

## Council

NOT RUN.

## What Veeresh must listen to

Nothing from this branch. There is no new audio. When a machine with the pinned voices (or two distinct local male substitutes) renders the lines, listen in this order.

1. beat-me. Watson. "You beat me to it!"
2. win-together. Holmes. "We did it together!"
3. truce-watson. Watson. "Good try! We'll crack the next one together."

## Proven defects

1. The state machine emits `fixed:beat-me`, `fixed:win-together`, and `fixed:truce-watson`. `resolveDetectiveClip` returns null when `manifest.fixed` has no entry, and the player skips the id. All three ids are missing from the plan and the manifest on `8eb34cb4`. This branch does not fix that silence.
2. `scripts/detective/render-plan.test.mjs` does not start under Node on Windows. `new URL("../..", import.meta.url).pathname` is joined into a `C:\C:\...` path. Pre-existing. Not changed here.
3. The Kokoro cache entry under `models--hexgrad--Kokoro-82M` does not contain readable weights. The snapshot symlinks point at blobs that are not on disk.

## Throughput checkpoint

- Blocking first steps. Fetch, confirm the frame SHA, confirm the TTS binary is missing, confirm the Kokoro weights are missing, and confirm `coverage.fixed` makes a plan-only claim fail the gate. Those checks finished before any edit.
- Independent workstreams. Not used. There is no audio to split across workers.
- Shared mutable state. `FIXED_LINES` and `manifest.json` are one table. They were not written, so there was nothing to split.
- Smallest safe decomposition. One worker. Three rows in one frozen array are not three owners, and the render could not start.
