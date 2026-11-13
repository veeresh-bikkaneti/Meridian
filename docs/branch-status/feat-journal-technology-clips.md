# BRANCH_STATUS — feat/journal-technology-clips

Narration for the kept technology clips. Rebuilt from origin/main `160e987d`.

**Status: NARRATION IN. STILLS MISSING. VIDEO LATER. DO NOT MERGE.**

The voice is local Kokoro `am_michael`. It is not the voice on the live journal films.

## Done

- [x] Branch rebuilt from origin/main. No `src/play-lab/`. No `mockup/scale-play`.
- [x] Kept clips only. Cut clips were not rendered.
- [x] Captions retimed to the speech. first-phone and mobile-phone stay the screened caption, character for character. ENIAC's last cue is the owner line below.
- [x] Narration committed under `public/audio/journals/technology/`.
- [x] One voice for every journal in this fix pass: Kokoro `am_michael`.
- [x] Owner, 2026-11-13: the ENIAC cue is now "ENIAC, an early computer, needed a big room." (8 words, 18 in all, at the cap). Caption, screenplay and `transcripts.md` match. `eniac.m4a` re-rendered with Kokoro `am_michael` at -18.5 LUFS, peak -2.2 dBFS. `check-clips.mjs` passes.

Voice check on "Hey kids, have you heard about this place?" at speed 1.0:

- `am_michael`: 2.283 s, median F0 123.1 Hz (kept)
- `bm_george`: 2.517 s, median F0 146.3 Hz (not used)
- `am_fenrir`: 1.963 s, median F0 142.0 Hz (not used)

`am_michael` is the deepest of the three. `am_fenrir` is shorter and brighter, so it stays out.

Loudness, measured on the committed m4a with ffmpeg ebur128:

- `eniac`: -18.5 LUFS, true peak -1.8 dBFS, cue end 8.424 s (re-rendered 2026-11-13)
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

- Stills and film are still waiting on the FLUX worker. Do not ship a flat wash.
- Veeresh listens to the new `eniac.m4a`.
- Do not merge. Do not upload.

## Open questions

- Resolved 2026-11-13: the cue now reads "needed a big room" and `check-clips.mjs` passes at 18 words.
- `git rebase origin/main` was denied by the agent permission rule, so this branch was not rebased onto `eb7f91a3` (chemistry live). That commit does not touch these files.

## Ruled out

- Play Lab and the mockup/scale-play tree.
- `bm_george` and `am_fenrir` for these journals.
- Magnus hatch TTS is not on this machine, so the voice stays Kokoro `am_michael`. Detective clips `beat-me`, `win-together`, and `truce-watson` stay out for the same reason.

## Council

Round 1, 2026-11-13. No second round.

- Child-safety: MUST-FIX, not applied. The first-phone and eniac opening questions are the grade-4 items sources.md already assigns (4.NBT.B.4 and 4.MD.A.3). The spoken captions do not ask that arithmetic.
- History: the owner first asked for "stood in a big room" (19 words, over the cap), then changed it to "needed a big room" (18 words) on 2026-11-13.
- Accessibility: PASS. No persona file exists for this seat. Cue words match the narration, and there is no video, so nothing flashes.
- QA: MUST-FIX. No still is in this pull request. A local open-weight image model did not run.

The missing still cannot be fixed on this machine. The owner changed only the ENIAC spoken line on 2026-11-13. transcripts.md is still the screened source.

## Graph

- Adds node: branch `feat/journal-technology-clips` (docs/branch-status/feat-journal-technology-clips.md), documents the technology narration files above. Depends-on the technology journal spec. No `graph.json` edit on this branch.
