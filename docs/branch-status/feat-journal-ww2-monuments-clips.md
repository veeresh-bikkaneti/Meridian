# BRANCH_STATUS — feat/journal-ww2-monuments-clips

Narration for the kept ww2-monuments clips. Rebuilt from origin/main `160e987d`.

**Status: NARRATION IN. STILLS MISSING. VIDEO LATER. DO NOT MERGE.**

The voice is local Kokoro `am_michael`. It is not the voice on the live journal films.

## Done

- [x] Branch rebuilt from origin/main. No `src/play-lab/`. No `mockup/scale-play`.
- [x] Kept clips only. Cut clips were not rendered.
- [x] Captions retimed to the speech. The words are the screened caption, character for character.
- [x] Narration committed under `public/audio/journals/ww2-monuments/`.
- [x] One voice for every journal in this fix pass: Kokoro `am_michael`.

Voice check on "Hey kids, have you heard about this place?" at speed 1.0:

- `am_michael`: 2.283 s, median F0 123.1 Hz (kept)
- `bm_george`: 2.517 s, median F0 146.3 Hz (not used)
- `am_fenrir`: 1.963 s, median F0 142.0 Hz (not used)

`am_michael` is the deepest of the three. `am_fenrir` is shorter and brighter, so it stays out.

Loudness, measured on the committed m4a with ffmpeg ebur128:

- `arizona-how-far`: -18.6 LUFS, true peak -2.2 dBFS, 8.786 s
- `normandy-where`: -18.5 LUFS, true peak -2.3 dBFS, 7.936 s

Target was -18 LUFS and a true peak of -1.5 dBFS or lower.

## Not in this pull request

- Stills. A local open-weight image model did not run (torch=True, cuda=False, diffusers=False, FLUX cache=none). The earlier pictures were flat shapes or they added things the caption does not name. They are not on this branch.
- Video. No silent film, no sine probe, no wash.
- Media-host upload. Nothing was uploaded.

Kept clips: `arizona-how-far`, `normandy-where`.

Cut: none in clips.json.

## Files

- `docs/scaling/journals/ww2-monuments/arizona-how-far.vtt`
- `public/audio/journals/ww2-monuments/arizona-how-far.m4a`
- `docs/scaling/journals/ww2-monuments/screenplays/arizona-how-far.md`
- `docs/scaling/journals/ww2-monuments/normandy-where.vtt`
- `public/audio/journals/ww2-monuments/normandy-where.m4a`
- `docs/scaling/journals/ww2-monuments/screenplays/normandy-where.md`
- `docs/branch-status/feat-journal-ww2-monuments-clips.md`

Surviving pull request: #452. The video draft #453 is closed in favor of this one.

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

## Council

Round 1, 2026-11-13. No second round.

- Child-safety: PASS. Remembrance tone. No battle, weapon, death, or religion in the cues.
- History: PASS.
- Accessibility: PASS. No persona file exists for this seat. Cue words match the narration, and there is no video, so nothing flashes.
- QA: MUST-FIX. No still is in this pull request. A local open-weight image model did not run.

The missing still cannot be fixed on this machine. Spoken words were left as the screened caption.

## Graph

- Adds node: branch `feat/journal-ww2-monuments-clips` (docs/branch-status/feat-journal-ww2-monuments-clips.md), documents the ww2-monuments narration files above. Depends-on the ww2-monuments journal spec. No `graph.json` edit on this branch.
