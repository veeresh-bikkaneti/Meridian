# feat/pixar-pair-reskin — branch status

**Task:** Re-model `public/models/detective/holmes.glb` + `watson.glb` in
the existing Blender pipeline (`scripts/detective3d/`) to the owner's
finalized Pixar-style look (bench reference: round soft proportions;
Holmes — deerstalker, red coat, long kind face; Watson — bowler, blue
coat, round face, moustache). Design is FINAL (owner, 2026-11-18) — no
look approval stop; renders are evidence, not a vote. Only the look
changes: same DetectivePair component, same `pair3d` flag, same rig +
pose set (`pair3d-poses.ts`), same speech/mouth behaviour, same
recorded beats. Draft PR; merge only on the owner's word.

**State (2026-11-19): BUILD DONE at `30728d87` (pushed). Gates in
progress.** Worktree `~/workspace/meridian-pixar-pair` off origin/main
`330925a9`.

## Done

- **Toolchain:** Blender 4.5.16 LTS standalone installed at
  `~/workspace/tools/blender-4.5.16-linux-x64/` (owner-approved
  download, 377,826,288 B; SHA256 verified against the Foundation's
  published hash `23432b06…b10c11` before extraction; tarball deleted).
  Repo scripts run via the Blender binary with a small argv wrapper
  (`~/workspace/tools/bl_run.py`) — scripts byte-identical in how they
  execute. Baseline first: the UNMODIFIED pipeline reproduced the
  shipped pair (510,864 / 399,112 B vs shipped 496,456 / 382,272 B).
- **Re-model (`30728d87`):** all changes inside `build_pair.py`'s two
  builders + export knobs. Object-name prefixes unchanged (cheeks are
  named `h-head-cheek-*` / `w-head-cheek-*` so the exporter's prefix
  reparenting carries them onto the head pivots); rig pivots, pose
  table and mouth node untouched.
  - Both: bigger rounder heads, eyes ~1.5× (Holmes) / ~1.35× (Watson)
    with larger pupils, rosy cheek mounds.
  - Holmes: long SOFT nose (tapered capsule, was a sharp cone), head
    rounder/wider, body ~15% less gaunt, deerstalker plaid shifted to
    the reference's brown-red check, coat plaid softened.
  - Watson: rounder fuller head, bigger round nose, moustache fuller
    and dark brown (was ginger), bowler darker navy, blue plaid
    softened toward the reference's solid-looking coat.
- **Budget: pair = 428,424 B ≤ 500,000 B** (holmes 233,140 + watson
  195,284; was 878,728 B). [measured] The baked WEBP at 512² is only
  45,810 / 16,112 B — geometry dominated, so the plan's texture lever
  (1024² → 512², done) was necessary but not sufficient; the export's
  decimate cap was tuned inside the same regime (240 tris / 0.12
  floor → ~100 tris / 0.035 floor). Pair triangles 22,448 → 10,326.
- **Pose check:** `check_poses.py` renders all 22 game poses from the
  exported GLBs with the game's own pose table — zero missing joints,
  figures fit their frames. Before/after sheets in
  `~/workspace/pixar-pair-evidence/` (`pose-sheet-old/new.png`,
  `check-old/`, `check-new/`, `game-size/` 104 px pack).
- **Code gates on `30728d87`:** tsc clean · lint:nav clean ·
  check:provenance PASSED · build:pages green · entry JS gzip
  319,601 B vs 323,865 B limit · detective unit suite 224/224.

## Next step

1. E2E smoke set (owner-spec / selection-read / tapmode-selection /
   watson-walk): first run under heavy multi-crew VM load failed 4 —
   1 documented pre-existing (owner-spec mute-ordering, main debt) +
   3 environment-class (10-min click timeout, browser channel closed,
   frame-starved walk sampling). A lone re-run decides; a parallel
   independent run of the same set was in progress at last check.
2. Owner-config playthrough (tap mode, band 8-10, 390 + 1280, real
   taps, captures wait for both rig3d canvases) + before/after
   in-game captures at 1920×1080, 1878×751, 1280×800, 768×1024,
   390×844, 320×568 (temporary spec, deleted after use).
3. Clean-context Silo QA: kid gates (find-Holmes ≥27/30, identity
   ≥27/30, expression ≥26/30, zero clue-text coverage, gaze/lean
   answer-leak check) scored on the game-size pack + playthrough
   re-play.
4. Draft PR with the evidence; STOP at the owner's merge word.

## Open questions

- None for the owner. (The design is final; no approval stops.)

## Ruled out

- `pip install bpy`: no cp312 wheel exists (checked the first
  coordinator's prep) — the standalone Blender tarball is the route.
- Texture-only budget cure: measured insufficient (see above).
- Substituting another modelling pipeline: forbidden by the brief;
  the repo pipeline did the whole job.

## Graph

- No graph nodes/edges added by this branch. The pair's nodes already
  exist; only the GLB assets' appearance changes.
