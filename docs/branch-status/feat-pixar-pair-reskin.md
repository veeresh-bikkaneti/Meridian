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

**State (2026-11-19): GATES COMPLETE. Draft PR #538 open; STOPPED at
the owner's merge word.** Worktree `~/workspace/meridian-pixar-pair`
off origin/main `330925a9`. Re-skin commit `30728d87` (pushed).

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

## Gates (all run on the branch tip)

- **E2E smoke set** (hermetic, owner-config vehicle: tap mode, band
  8–10, sound on): 20 passed / 1 failed. The failure —
  detective-owner-spec mute-button geometry (spec line 143) — is
  A/B-proven pre-existing: lone re-run on this branch fails
  identically, and the same test on unmodified main `330925a9`
  fails with the identical assertion. This diff touches no layout
  code. Known main debt, not a regression.
- **Owner-config playthrough + captures:** before/after sets at
  1920×1080, 1878×751, 1280×800, 768×1024, 390×844, 320×568 (deck +
  in-game + flank, 18 files each) in `~/workspace/pixar-pair-evidence/`
  (`before/`, `after/`). Mid-case state confirmed: Watson beside the
  active clue, Holmes at the bench, zero clue-text coverage.
  Temporary capture specs deleted after use (never committed).
- **Kid gates** (scored render studies, independent clean-context
  seats, figures at real game height 104 px; keys sealed from seats):
  - Find-Holmes / discrimination **30/30 PASS** — three independent
    seats; trait groups programmatically identical to the key on
    both sheets (F 30 cells, X 22 cells); zero ambiguous cells.
  - Identity **30/30 PASS** under the game's definitions (Holmes =
    red coat + deerstalker, no moustache, no magnifier; Watson =
    blue coat + bowler + moustache + magnifier). Disclosed: every
    un-briefed seat naming from cultural priors inverted the names
    (the magnifier reads as "Holmes") — identical in the current
    live pair; not a re-skin regression.
  - Expression **gate NOT MET as operationalized — disclosed for the
    owner's ship call.** Exact pose-token naming from stills: new
    pair 8/22 (strict prose mapping) to 16/22 (pose-attentive read)
    vs ≥26/30 equivalent. Baseline: the CURRENT pair scores 8/22
    under the identical method, same hit cells, same miss pattern —
    a property of the shared rig + pose set (no facial-expression
    channel; mouth flap only; subtle idle/think variants are
    near-duplicates), which this re-skin does not change. All seats
    agree the big beats read clearly at game size: celebrate,
    high-five, pout, gasp, clap. No re-runs were taken to chase the
    number and the gate was not lowered.
  - Zero clue-text coverage: observed first-hand at 1280 + 390 and
    confirmed by Silo QA.
- **Silo QA (clean context, did not build it): PASS on all 6 items**
  — diff scope exact (the 5 files above), GLB sizes exact vs the
  commit (old pair 878,728 B re-measured at `330925a9`), coverage
  PASS, gaze/lean answer-leak PASS (pose selection keyed only to
  game phase/step in `viewForState`; pair is answer-blind), rig
  contract 0 missing joints per figure, no unrelated commits.

## Next step

1. Owner's merge word on draft PR #538 (or his call on the disclosed
   expression-gate flag). Nothing merges or deploys without it.

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
