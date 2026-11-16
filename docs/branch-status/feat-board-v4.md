# feat/board-v4 — status

## Done
- Data (commit 13d30d5b): generation source (`scripts/board/board-v3-data.mjs`)
  carries `PLAYER_TITLES` for all 37 player-visible stories, `LINE_OVERRIDES`
  (pair-art "Drawing in progress"; tucked-away films "Finished"), and the
  9-item exclusion list (whole Behind the Scenes epic + subject registry +
  site-goes-live fix). `build-curation.mjs` fails rather than fall back to a
  snapshot title and reuses existing slugs (links/bonds never move).
  `publish-status.mjs` rejects dev language (`scanDevLanguage` in
  `src/board/status-core.ts`) and excluded slugs. Published file recomputed
  from real statuses: 37 stories, 16 done / 6 in progress / 15 not started,
  8 bonds unchanged by slug. Scan proof: 34 violations on the pre-v4 file,
  0 on the v4 file (logs in the build record).
- Trail (commit 66586f05): the owner-approved v4 sample productionized in
  `src/routes/board.tsx` + `src/board/trail-view.tsx` + board.css BOARD V4
  section — features-first falling panels, brass traveller + readout,
  parallax ground, mist bands, stories inside "See what's inside",
  chart-room dark trail scoped to the trail page, Calm/reduced-motion
  stills. Map (8 bonds, shared selection, DOM fallback, board3d kill
  switch), tip form and theme switch unchanged in behaviour.
- E2E spec updated to the v4 picture + one v4 trail test.

## Gates (local, CI order, logs in the build record)
- provenance / typecheck / build / lint:content / lint:subjects /
  lint:nav / test:worker / typecheck:worker / lint-cards GATE PASSED /
  build:pages / board:budget (170,740 B gz of 184,320 B): PASS.
- `npm test`: 2676 pass / 0 fail.
- `check:entry-size`: FAILS by 3,061 B — baseline-matched on pristine
  main in this VM (326,924 B vs this branch's 326,926 B): pre-existing
  in this environment, not a regression from this branch.
- E2E (built artifact, --workers=1): board spec 13/13 after one fix
  (overflow-x clip for the landing shadows at 390px, commit c5763413);
  grown-ups + credits + hydration + observability 19/22 with the 3
  failures (endgame-share ×2, round-loop 3D(a)) baseline-matched as
  identical failures on pristine main — pre-existing, zero regressions.
- Visual: 6 captures vs the sample's shots — parity on ground, words,
  traveller, panels, dark scheme, reduced-motion stills; differences
  are the retained production surfaces (view nav, story-stop rows,
  desktop two-column feature card).

## Next
- Push via API replay with tree-SHA verification. Merge is NOT
  authorized; no PR is opened by this branch's builder — the
  coordinator opens it after the independent Reality Checker passes.

## Open questions
- None blocking. Slugs deliberately kept stable (link keys, not player
  words) even where a slug still contains an old dev word.

## Graph
Nodes added:
- `board-v4` (feature): the player-words, features-first board trail.
Edges:
- `board-v4` —depends-on→ published board-status file (public/board-status.json)
- `board-v4` —governs→ scripts/board generation path (board-v3-data.mjs → build-curation.mjs → publish-status.mjs)
- `board-v4` —supersedes→ board v3 trail presentation (data contract and map unchanged)
