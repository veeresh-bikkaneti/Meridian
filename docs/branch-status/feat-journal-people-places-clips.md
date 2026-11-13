# BRANCH_STATUS — feat/journal-people-places-clips

Narration for the kept people-places clips. Rebuilt from origin/main `160e987d`.

**Status: NARRATION IN. STILLS MISSING. VIDEO LATER. DO NOT MERGE.**

The voice is local Kokoro `am_michael`. It is not the voice on the live journal films.

## Done

- [x] Branch rebuilt from origin/main. No `src/play-lab/`. No `mockup/scale-play`.
- [x] Kept clips only. Cut clips were not rendered.
- [x] Captions retimed to the speech. The words are the screened caption, character for character.
- [x] Narration committed under `public/audio/journals/people-places/`.
- [x] One voice for every journal in this fix pass: Kokoro `am_michael`.

Voice check on "Hey kids, have you heard about this place?" at speed 1.0:

- `am_michael`: 2.283 s, median F0 123.1 Hz (kept)
- `bm_george`: 2.517 s, median F0 146.3 Hz (not used)
- `am_fenrir`: 1.963 s, median F0 142.0 Hz (not used)

`am_michael` is the deepest of the three. `am_fenrir` is shorter and brighter, so it stays out.

Loudness, measured on the committed m4a with ffmpeg ebur128:

- `aconcagua-height`: -18.7 LUFS, true peak -1.8 dBFS, 8.704 s
- `akashi-span`: -18.5 LUFS, true peak -2.3 dBFS, 6.613 s
- `andean-roads`: -18.5 LUFS, true peak -2.6 dBFS, 7.637 s
- `eratosthenes-earth`: -18.5 LUFS, true peak -2.8 dBFS, 9.173 s
- `pont-du-gard`: -18.3 LUFS, true peak -2.0 dBFS, 6.613 s

Target was -18 LUFS and a true peak of -1.5 dBFS or lower.

## Not in this pull request

- Stills. A local open-weight image model did not run (torch=True, cuda=False, diffusers=False, FLUX cache=none). The earlier pictures were flat shapes or they added things the caption does not name. They are not on this branch.
- Video. No silent film, no sine probe, no wash.
- Media-host upload. Nothing was uploaded.

Kept clips: `aconcagua-height`, `akashi-span`, `andean-roads`, `eratosthenes-earth`, `pont-du-gard`.

Cut: `maya-culture`, `shaolin`, `bodhidharma`, `vivekananda`, `zeus`.

## Files

- `docs/scaling/journals/people-places/captions/aconcagua-height.vtt`
- `public/audio/journals/people-places/aconcagua-height.m4a`
- `docs/scaling/journals/people-places/screenplays/aconcagua-height.md`
- `docs/scaling/journals/people-places/captions/akashi-span.vtt`
- `public/audio/journals/people-places/akashi-span.m4a`
- `docs/scaling/journals/people-places/screenplays/akashi-span.md`
- `docs/scaling/journals/people-places/captions/andean-roads.vtt`
- `public/audio/journals/people-places/andean-roads.m4a`
- `docs/scaling/journals/people-places/screenplays/andean-roads.md`
- `docs/scaling/journals/people-places/captions/eratosthenes-earth.vtt`
- `public/audio/journals/people-places/eratosthenes-earth.m4a`
- `docs/scaling/journals/people-places/screenplays/eratosthenes-earth.md`
- `docs/scaling/journals/people-places/captions/pont-du-gard.vtt`
- `public/audio/journals/people-places/pont-du-gard.m4a`
- `docs/scaling/journals/people-places/screenplays/pont-du-gard.md`
- `docs/branch-status/feat-journal-people-places-clips.md`

Surviving pull request: #449. The video draft #450 is closed in favor of this one.

These clips are not in `public/videos/journal-manifest.json`, so the live player does not load them yet.

## Next

- Veeresh listens to each m4a above.
- Stills still need a local open-weight model. Do not ship a flat wash.
- Video follows after a real still exists.
- Do not merge. Do not upload.

## Ruled out

- Play Lab and the mockup/scale-play tree.
- `bm_george` and `am_fenrir` for these journals.
- Detective clips `beat-me`, `win-together`, and `truce-watson` (they need the hatch TTS, which is not on this machine).

## Graph

- Adds node: branch `feat/journal-people-places-clips` (docs/branch-status/feat-journal-people-places-clips.md), documents the people-places narration files above. Depends-on the people-places journal spec. No `graph.json` edit on this branch.
