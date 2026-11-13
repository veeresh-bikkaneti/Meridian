# Technology journal swarm result

The three kept clips should leave Play Lab Coming soon with a still, the caption, and narration. Spend stays at zero.

STATUS: ISSUES

Narration audio is blocked. The stills, the captions, the Play Lab card, and the silent films are in place.

## SHAs

Base is origin/main `8eb34cb4305719f88ef8c2568e4dd624cbaf8608`.

Stills branch `feat/journal-technology-clips` tip `ee08ee20742ede757321bd037e28a3b5f91a8460`.

- `a6f7d5d8bfc58d20079f377aaa4a1c673cee305d` screenplays.
- `7f3f4ec0576bad3107288d590e72caac7e50e1f0` storybook stills.
- `1030b9d552b0f53b85d8991daf6e96c47c9a669a` Play Lab `journal-watch`.
- `ee08ee20742ede757321bd037e28a3b5f91a8460` branch status.

Video branch `feat/journal-technology-clips-video` script commit `03d8becb03ab64948b0c87c2da2ab8a16925b4fe`. The commit that added this result file is `e931b926caffd085e669d9b3f97f80855479cc67`. `git rebase` is denied in this session, so the video branch was not replayed onto the status commit. Pull request 458 targets the stills branch, so the stack on GitHub still has the status commit as its base. This checkout also carries `docs/branch-status/feat-journal-technology-clips.md` with the same bytes as `ee08ee20742ede757321bd037e28a3b5f91a8460`.

## Method

Screenplays quote the caption on beats 0 to 2, 2 to 4, 4 to 6, 6 to 8, and 8 to 10 seconds. Pillow draws the stills. `make-stills.py` never draws text. Play Lab uses a `journal-watch` spec and the existing `CardFilm` still fallback. `card-film.tsx` is unchanged.

`scripts/journal-still-motion.mjs` builds each film. Two zoompan segments of 126 frames crossfade for 0.5 seconds at 4.75 seconds, which is 240 frames at 24 fps, which is 10.000 seconds. A missing narration uses `anullsrc` and prints `no bed`. The script does not run `loudnorm` or `drawtext`. Output is gitignored under `docs/scaling/journals/technology/render-out/`. No meridian-media checkout exists, and this run did not clone one.

## Built and cut

Built: `technology:first-phone`, `technology:mobile-phone`, `technology:eniac`.

Cut: none.

## Tools

ffmpeg and ffprobe rendered and measured the films. Pillow drew the stills. Node ran the script and the gates. The Python module `kokoro` is absent. `node_modules/kokoro-js` is absent. `/opt/hatch/bin/tts` is absent. No paid voice and no paid video model ran. Origin CLI is absent, so the draft pull requests used `gh`.

Kokoro weights on disk, unused:

`C:\Users\veere\.cache\huggingface\hub\models--hexgrad--Kokoro-82M\snapshots\f3ff3571791e39611d31c381e3a41a3af07b4987`

`config.json`, `kokoro-v1_0.pth`, and `voices/af_heart.pt` are present. This run did not download.

## Money

0

## Pull requests

Draft stills pull request, base `main`:

https://github.com/veeresh-bikkaneti/Meridian/pull/457

Draft video pull request, base `feat/journal-technology-clips`:

https://github.com/veeresh-bikkaneti/Meridian/pull/458

Both were open and draft when created. Neither was merged.

## Council

NOT RUN

## Listen list

Veeresh is the ear check. Nobody in this run listened. The films are digital silence.

- `docs/scaling/journals/technology/render-out/first-phone.mp4`
- `docs/scaling/journals/technology/render-out/mobile-phone.mp4`
- `docs/scaling/journals/technology/render-out/eniac.mp4`

Caption text, for the day a voice file exists:

- first-phone: "Hey kids, have you heard about this place? Boston, 1876. A voice travelled down a wire."
- mobile-phone: "Hey kids, have you heard about this place? 1973. First public call from a phone you could carry."
- eniac: "Hey kids, have you heard about this place? Philadelphia, 1946. ENIAC, an early computer, filled a big room."

Missing voice files:

- `public/audio/journals/technology/first-phone.mp3`
- `public/audio/journals/technology/mobile-phone.mp3`
- `public/audio/journals/technology/eniac.mp3`

## Films

Each number below is one ffprobe or one ebur128 pass on the file in render-out. Full decode exited 0. Peak is under -1 dB because the samples are digital silence. Integrated -70.0 LUFS is the ebur128 silence floor. It is not a voice gained to -18 LUFS. Duration is 10.000000 because the file has 240 frames at 24 fps.

- first-phone.mp4: 654346 bytes, 10.000000 s, h264 1152x768, 24/1, 240 frames, aac 48000 Hz stereo, 470 audio frames, I -70.0 LUFS, peak -inf dBFS, bed `no bed`.
- mobile-phone.mp4: 918120 bytes, same timing and codecs, I -70.0 LUFS, peak -inf dBFS, bed `no bed`.
- eniac.mp4: 583006 bytes, same timing and codecs, I -70.0 LUFS, peak -inf dBFS, bed `no bed`.

Frames written at 2 s, 6 s, and 9.5 s under `docs/scaling/journals/technology/render-out/frames/`. This run looked at first-phone at all three times, and at mobile-phone and eniac at 6 s. No burned-in text. The phone is a solid brick with three arcs and no tower. ENIAC is cabinet rows with dull tube dots, no people, and no glow. The first-phone wave stays on the wire. The 2 s frame is 404188 bytes and the 9.5 s frame is 420734 bytes, so the zoompan did change the picture. The wave does not travel by itself.

A deleted local tone, not a product clip, proved the narration path in this session. The script stripped 37 ID3 bytes, printed bed `narration`, measured integrated -18.0 LUFS and peak -16.7 dBFS, and wrote a 10.000000 s 1152x768 film. The tone file was removed.

## Gates

Run on the stills tip before the pull requests. The video commit adds a Node script and a gitignore line. It does not change the TypeScript program.

- `node --experimental-strip-types --test src/play-lab/play-lab.test.ts`: 12 pass, 0 fail. This is not a zero-test run.
- `npx tsc --noEmit`: exit 0.
- `npm run lint:content`: GATE PASSED, violations 6, baselined 6, new 0, stale 0.
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `node docs/scaling/journals/technology/check-clips.mjs`: PASSED, 3 clips.
- `node scripts/validate-journal-manifest.mjs`: exit 0.
- `node scripts/detective/check-audio-manifest.mjs`: manifest clean, 4468 entries.

E2E did not run. `card-film.tsx` is untouched. `scripts/render-storyteller-voice.mjs` did not run.

## Defects

- Narration audio is blocked. The weights exist. The runtime does not. The three mp3 paths above are absent. Play Lab points the audio element at those paths, so the control will 404 until a local file is rendered with `allowRemoteModels=false`.
- The rendered mp4 files are not on the URL `CardFilm` requests (`videos/journals/technology/<clip>.mp4`). They stay in gitignored render-out, which is what this repo allows. In the app, the missing video falls back to the still. Veeresh listens to the render-out files.
- Cue times in the vtt files stay PROPOSED. There is no rendered speech to retime against.
- The first-phone screenplay asks the wave to move along the wire. The required zoompan move is a camera move on a still. The wave shape does not travel.
- Play Lab on origin/main has no home for these ids. This branch checks out the committed module from `0487d67db0b7f9fbcae818cfe27cdf237f07040d`, without the dirty mockup overlay and without `tests/e2e/play-lab.spec.ts`. Other journal workers who copy that module will collide on the interactive id list and on `ProblemCard`.
- The mockup stash is still in this worktree: `stash@{0}: On mockup/scale-play: hold mockup/scale-play tracked dirt; not part of technology clips`. It was not applied and it was not dropped.
