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

## Next
- Full local gate sequence (CI order), narrow regression e2e on the built
  artifact, visual captures vs the approved sample, push via API replay.
  Merge is NOT authorized; no PR is opened by this branch's builder.

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
