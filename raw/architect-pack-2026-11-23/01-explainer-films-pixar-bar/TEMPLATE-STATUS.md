# Series template — status

Branch: `template/series-template` (baseline `59546a3` on `main`).

## Done

- [x] Git: repo initialized, baseline commit of the one-off Moon pipeline.
- [x] Data-driven composition (`template/src/`): Episode renders any
  episode from `{episode, timing}` props — no episode data in code.
- [x] Camera-move presets (`template/src/cameraMoves.js`): DollyIn,
  DollyOut, Settle, Drift, LowArcAround, BackwardOrbit, Close-up,
  SnapZoom, Crane, SnapCrane, Tilt, PendulumSwing, Ground-Skim, FPV.
- [x] Components: ShotStage, Caption, TitleCard, EndCard (Moon styling is
  the default theme; episode.json can override theme + speaker colors).
- [x] TTS step (`template/scripts/tts.mjs`): beats → per-line clips with
  the pair's voices → timing.json (leadIn 0.5s, gap 0.3s defaults).
- [x] Render step (`template/scripts/render.mjs`): episode folder →
  `out/<slug>.mp4`, loudnorm −16 LUFS.
- [x] Moon re-expressed as data (`episodes/moon-phases/`): episode.json +
  timing.json + its stills/audio. Original `src/moon-index.jsx` untouched.
- [x] PROOF: Moon rendered through the template → `out/moon-phases.mp4`:
  45.1s, 1280×720, −16.59 LUFS (sample: 45.1s, −16.62). Title/caption/
  end-card frames spot-checked against the sample's beats.

## Also done

- [x] Stills step: `template/blender/still_engine.py` (spec-driven poses,
  placement, camera, lighting) + `template/blender/sets/moon_room.py`
  (extracted from build_scene.py) + `episodes/moon-phases/stills.json`.
  Smoke test: s1_gasp re-rendered in 63.5 s, 1280×720, mean RGB identical
  to the original still.
- [x] README runbook (episode recipe, timings, voices, camera vocabulary,
  style-roulette field).

## Still hardcoded / honest limits

- One set only (`moon_room`). A new location means a new set module —
  that is the intended extension point, not a gap in the episode format.
- The still engine's placement/camera modes (home/orbit, wide/orbitClose)
  are the moon set's staging vocabulary; other sets bring their own
  STAGING table.
- No lip sync and no facial-expression channel — a property of the game
  GLB rigs, unchanged from the sample.

## Budget

Cap 40k, checkpoint ~24k. The checkpoint state above (core + proof) was
committed at `69bba1f` before the stills step; the remaining units
(stills step, runbook) were finished inside the cap after that commit.
