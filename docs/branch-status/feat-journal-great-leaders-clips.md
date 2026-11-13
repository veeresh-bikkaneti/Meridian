# BRANCH_STATUS — feat/journal-great-leaders-clips

Narration for the kept great-leaders clips. Rebuilt from origin/main `07caf92d`.

**Status: NARRATION IN. STILLS MISSING. VIDEO LATER. DO NOT MERGE.**

The voice is local Kokoro `am_michael`. It is not the voice on the live journal films.

## Done

- [x] Branch rebuilt from origin/main. No `src/play-lab/`. No `mockup/scale-play`.
- [x] Kept clips only. Cut clips were not rendered.
- [x] Captions retimed to the speech. The words are the screened caption, character for character.
- [x] Narration committed under `public/audio/journals/great-leaders/`.
- [x] One voice for every journal in this fix pass: Kokoro `am_michael`.

Voice check on "Hey kids, have you heard about this place?" at speed 1.0:

- `am_michael`: 2.283 s, median F0 123.1 Hz (kept)
- `bm_george`: 2.517 s, median F0 146.3 Hz (not used)
- `am_fenrir`: 1.963 s, median F0 142.0 Hz (not used)

`am_michael` is the deepest of the three. `am_fenrir` is shorter and brighter, so it stays out.

Loudness, measured on the committed m4a with ffmpeg ebur128:

- `jhansi-fort`: -18.3 LUFS, true peak -2.8 dBFS, 6.312 s
- `lincoln-memorial`: -18.7 LUFS, true peak -2.3 dBFS, 10.886 s
- `netaji-bhawan`: -18.5 LUFS, true peak -2.8 dBFS, 7.964 s

Target was -18 LUFS and a true peak of -1.5 dBFS or lower.

## Not in this pull request

- Stills. A local open-weight image model did not run (torch=True, cuda=False, diffusers=False, FLUX cache=none). The earlier pictures were flat shapes or they added things the caption does not name. They are not on this branch.
- Video. No silent film, no sine probe, no wash.
- Media-host upload. Nothing was uploaded.

Kept clips: `jhansi-fort`, `lincoln-memorial`, `netaji-bhawan`.

Cut: none in clips.json.

## Files

- `docs/scaling/journals/great-leaders/captions/jhansi-fort.vtt`
- `public/audio/journals/great-leaders/jhansi-fort.m4a`
- `docs/scaling/journals/great-leaders/screenplays/jhansi-fort.md`
- `docs/scaling/journals/great-leaders/captions/lincoln-memorial.vtt`
- `public/audio/journals/great-leaders/lincoln-memorial.m4a`
- `docs/scaling/journals/great-leaders/screenplays/lincoln-memorial.md`
- `docs/scaling/journals/great-leaders/captions/netaji-bhawan.vtt`
- `public/audio/journals/great-leaders/netaji-bhawan.m4a`
- `docs/scaling/journals/great-leaders/screenplays/netaji-bhawan.md`
- `docs/branch-status/feat-journal-great-leaders-clips.md`

Surviving pull request: #447. The video draft #451 is closed in favor of this one.

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

- Adds node: branch `feat/journal-great-leaders-clips` (docs/branch-status/feat-journal-great-leaders-clips.md), documents the great-leaders narration files above. Depends-on the great-leaders journal spec. No `graph.json` edit on this branch.
