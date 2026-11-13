# BRANCH_STATUS — feat/journal-technology-clips

Narration for the kept technology clips. Rebuilt from origin/main `07caf92d`.

**Status: NARRATION IN. STILLS MISSING. VIDEO LATER. DO NOT MERGE.**

The voice is local Kokoro `am_michael`. It is not the voice on the live journal films.

## Done

- [x] Branch rebuilt from origin/main. No `src/play-lab/`. No `mockup/scale-play`.
- [x] Kept clips only. Cut clips were not rendered.
- [x] Captions retimed to the speech. The words are the screened caption, character for character.
- [x] Narration committed under `public/audio/journals/technology/`.
- [x] One voice for every journal in this fix pass: Kokoro `am_michael`.

Voice check on "Hey kids, have you heard about this place?" at speed 1.0:

- `am_michael`: 2.283 s, median F0 123.1 Hz (kept)
- `bm_george`: 2.517 s, median F0 146.3 Hz (not used)
- `am_fenrir`: 1.963 s, median F0 142.0 Hz (not used)

`am_michael` is the deepest of the three. `am_fenrir` is shorter and brighter, so it stays out.

Loudness, measured on the committed m4a with ffmpeg ebur128:

- `eniac`: -18.8 LUFS, true peak -2.8 dBFS, 8.445 s
- `first-phone`: -18.8 LUFS, true peak -2.9 dBFS, 7.549 s
- `mobile-phone`: -18.7 LUFS, true peak -2.0 dBFS, 7.229 s

Target was -18 LUFS and a true peak of -1.5 dBFS or lower.

## Not in this pull request

- Stills. A local open-weight image model did not run (torch=True, cuda=False, diffusers=False, FLUX cache=none). The earlier pictures were flat shapes or they added things the caption does not name. They are not on this branch.
- Video. No silent film, no sine probe, no wash.
- Media-host upload. Nothing was uploaded.

Kept clips: `eniac`, `first-phone`, `mobile-phone`.

Cut: none in clips.json.

## Files

- `docs/scaling/journals/technology/captions/eniac.vtt`
- `public/audio/journals/technology/eniac.m4a`
- `docs/scaling/journals/technology/screenplays/eniac.md`
- `docs/scaling/journals/technology/captions/first-phone.vtt`
- `public/audio/journals/technology/first-phone.m4a`
- `docs/scaling/journals/technology/screenplays/first-phone.md`
- `docs/scaling/journals/technology/captions/mobile-phone.vtt`
- `public/audio/journals/technology/mobile-phone.m4a`
- `docs/scaling/journals/technology/screenplays/mobile-phone.md`
- `docs/branch-status/feat-journal-technology-clips.md`

Surviving pull request: #457. The video draft #458 is closed in favor of this one.

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

- Adds node: branch `feat/journal-technology-clips` (docs/branch-status/feat-journal-technology-clips.md), documents the technology narration files above. Depends-on the technology journal spec. No `graph.json` edit on this branch.
