# feat/pixar-pair-reskin — branch status

**Task:** Re-model `public/models/detective/holmes.glb` + `watson.glb` in the
existing Blender pipeline (`scripts/detective3d/`) to the owner's finalized
Pixar-style look (bench reference: round soft proportions; Holmes —
deerstalker, red coat, long kind face; Watson — bowler, blue coat, round
face, moustache). Design is FINAL (owner, 2026-11-18 23:22 CST) — no look
approval stop. Only the look changes: same DetectivePair component, same
`pair3d` flag, same rig + pose set (`pair3d-poses.ts`), same speech/mouth
behaviour, same recorded beats. Draft PR; merge only on the owner's word.

**State (2026-11-18): BLOCKED on the build toolchain — see below.**
Worktree `~/workspace/meridian-pixar-pair` off origin/main `330925a9`.
Nothing modelled yet; no GLB touched.

## Blocker: no Blender / bpy on this machine [measured]

- The pipeline runs on Blender's Python module: `scripts/detective3d/README.md`
  says `pip install bpy`; `export_glb.py` was run as `../bvenv/bin/python`
  (a venv at `scripts/bvenv`, gitignored, not in any checkout).
- This machine has: no `blender` binary (PATH, /usr, /opt, ~/ searched),
  no `bpy` in the system Python, no `scripts/bvenv` in any of the ~90
  worktrees, no python3.11 / python3.13 / uv / pyenv.
- System Python is 3.12.3 only. PyPI metadata (read 2026-11-19): `bpy`
  wheels exist only for cp311 (Blender ≤ 5.0) and cp313 (≥ 5.1) — there is
  no cp312 wheel, so `pip install bpy` cannot work here.
- Unblock (one download, owner's approve/deny per the standing download
  rule — groundwork done by the coordinator):
  - What: official Blender 4.5.16 LTS standalone, Linux x64 —
    `blender-4.5.16-linux-x64.tar.xz`, 377,826,288 B (~360 MiB), from
    download.blender.org/release/Blender4.5/ (Blender Foundation).
  - SHA256 (from the official blender-4.5.16.sha256 file):
    `23432b064977908beb1ab4b7f32f024e7331105c875c187dce002aff84b10c11`
  - CVE check: api.osv.dev reports 0 known vulnerabilities for `bpy`
    (all versions). The tarball runs the repo's own scripts headless
    (`blender -b --python ...`); scripts stay byte-identical.
  - Extract under `~/workspace/tools/` (outside the repo); delete the
    tarball after hash verification. VM disk quota is tight — extraction
    is ~1.1 GB; the 8,552-file worktree checkout succeeded 2026-11-18,
    so headroom exists but is not guaranteed.

## Re-model plan (ready to run the moment the toolchain lands)

All changes inside `build_pair.py`'s two builders + one export knob.
Object-name prefixes stay identical (`h-head`, `h-nose`, `w-tache`, …)
because `export_glb.py` reparents by prefix; rig pivots, pose table and
mouth node are untouched.

- Proportions: bigger, rounder heads on both (Pixar ~1/3-of-height head);
  softer everything (rounder spheres, no sharp cone nose).
- Holmes: head rounder and a touch wider, long SOFT nose (tapered capsule,
  not the sharp cone), eyes ~1.5× with larger pupils, rosy cheek spheres,
  softer brows; deerstalker plaid shifted to the reference's brown-red
  check; coat stays brick-red plaid, body ~15% less gaunt.
- Watson: rounder fuller head + cheek spheres, bigger round nose,
  moustache fuller and dark brown (was ginger), bowler darker navy,
  blue plaid softened toward the reference's solid-looking coat.
- Budget: pair must land ≤ 500,000 B total. Current pair is 878,728 B
  (holmes 496,456 + watson 382,272) — over the brief's budget already.
  Lever: `bake_plaid` texture 1024² → 512² (the baked WEBP dominates each
  file) inside the existing decimation regime; measure per export.

## Gates (before any ship call)

1. Kid gates on game-size renders: find-Holmes ≥27/30, identity ≥27/30,
   expression ≥26/30, zero clue-text coverage, gaze/lean answer-leak
   check (one leak = BLOCK). No harness for these exists in the repo
   (searched tests/scripts/docs) — they run as scored render studies by
   an independent seat, as with the original pair.
2. Game-size renders, new pair beside current pair (PR evidence).
3. Owner-config playthrough on the built tip (tap mode, band 8–10,
   sound on, 390 + 1280, real taps; captures wait for both rig3d
   canvases to paint).
4. Targeted tests only (hermetic recipe): detective/pair unit + named
   e2e specs, tsc, lint:nav, check:provenance, build:pages, bundle
   within the repo limit (number stated in the PR).
5. Clean-context Silo QA re-runs gates + plays the playthrough.
6. Draft PR: before/after captures at 1920×1080, 1878×751, 1280×800,
   768×1024, 390×844, 320×568; budget number; rollback note (previous
   GLBs restorable from PR history). STOP at the owner's merge word.

## Graph
- No graph nodes/edges added by this branch. The pair's nodes already
  exist; only the GLB assets' appearance changes.
