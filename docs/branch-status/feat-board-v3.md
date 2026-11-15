# feat/board-v3 — branch status

Base: origin/main `5fe47c1c` (verified latest at dispatch, 2026-11-15)

## Done

- **Phase 0 — reconciliation (the migration baseline, locked).**
  `scripts/board/reconcile-v3.mjs` runs the v2 derivation rule over
  `src/board/snapshot.json` × the captured GitHub pulls
  (`~/workspace/board-v2/live-verify/pulls-p1..p4.json`, 394 PRs) and
  reproduces exactly **46 stories, 8 waits, 20 done / 8 in progress /
  18 not started**, with exactly two flips vs the snapshot
  (held-finger-jitter-fix and math-subject-screen, in-progress →
  done). Outputs `src/board/migration-table.json` +
  `src/board/record-states.json`; the script hard-asserts the counts
  and exits 1 naming differing stories.
- **Phase 1 — published-file data layer.** `src/board/status-core.ts`
  (pure: derivation, task-based closure, phase lines, published-shape
  builder, banned-token scan, deterministic layout),
  `src/board/curation.json` (46 stories assigned exactly once, 8
  waits; tasks exist here for closure counting only),
  `scripts/board/publish-status.mjs` → `public/board-status.json`
  (source "generated") + `src/board/board-status-fallback.json`
  (source "manual"). The board reads ONLY this file. The live GitHub
  fetch, the PR overlay and `/board/issues` are **deleted**.
  `src/board/board-data.ts` rewritten: loader with disclosed manual
  fallback, staleness (>24h), one selection store mirrored to the
  URL, honest-celebration bookkeeping (never toasts on first visit).
  Tests: status-core 19 + board-data/theme-parity suites — all pass.
- **Phase 2 — trail + shell.** Trail view (epics → features → story
  stops; feature cards with the §4 animation family in the home-v5
  palette; status = icon + word; waiting stories name their blocker
  and jump to it), story card shared with the map, Calm mode,
  honest "Updated …" stamp + stale banner. Grown-ups shell
  (`InfoPage`) rebuilt in the game world: parchment/card shell,
  doors nav, one family graphic per page (atlas book / locked
  satchel / envelope); privacy text unchanged. Feature form in its
  §5 costume ("Ask for something new", invitation line, animated
  envelope, success points back at the board; plumbing untouched).
  Discoverability: homepage header nav "WHAT'S COMING", grown-ups
  card pair, footer doors row, doors nav on every grown-ups page.
  **Indexing unchanged** — /board stays noindex and out of the
  sitemap (owner ruling requested in the PR, not decided here).
- **Phase 3 — molecular map.** Lazy Three.js scene
  (`src/board/molecule-map.tsx`): story = atom (instanced), feature
  = translucent bubble, epic = cluster; bonds == the 8 recorded
  waits and nothing else; precomputed layout; one shared selection
  both ways (atom click ↔ trail card); custom orbit control (drag /
  wheel / pinch / keys, clamps, Reset, Esc); DOM mirror list carries
  every word; WebGL failure → honest list fallback; `board3d` kill
  switch (flags.ts + flags.json, default true). Measured on the
  built artifact: **22 draw calls** (target <25, cap 80), **9,076
  triangles** (<15k), lazy payload **170,425 B gz** of the 184,320 B
  budget (`npm run board:budget`).
- **Theme parity (owner correction 2026-11-15).** Board + grown-ups
  shell are built in the homepage's home-v5 language: tokens copied
  value-for-value from `src/components/home-v5.css`; the shipped
  v2 board's dark atlas palette is NOT carried into v3 surfaces.
  `src/board/theme-parity.test.ts` parses the homepage, board and
  grown-ups token blocks and fails on any drift.
- **Deleted v2 surfaces:** `src/routes/board_.issues.tsx`,
  `src/board/dependency-graph.tsx`, `story-map-view.tsx`,
  `story-card.tsx`, `story-inspector.tsx`, and — because their only
  consumer was the deleted story card — `card-characters.tsx`,
  `card-icons.tsx`, `card-character-map.ts` + their tests (v3 card
  art is the §4 animation family). Dead character CSS cut from
  board.css. `scripts/static-wellknown.test.mjs` noindex map updated
  (/board/issues removed; /board unchanged).
- **Gates (numbers from logs):** `npx tsc --noEmit` clean;
  `npm test` — src suite 2,646/2,646, scripts suite 1,198 tests
  0 fail; `node scripts/lint-cards.mjs` GATE PASSED;
  `npm run lint:content` GATE PASSED (6 baselined, 0 new);
  `npm run build:pages` OK; `npm run board:budget` PASSED
  (170,425 / 184,320 B gz); Playwright `board.desktop.spec.ts`
  10/10 on the built artifact (incl. fulfilled-published-file proof,
  atom-click via the stage probe, renderer budgets, calm, reduced
  motion end poses, grown-ups doors, home links).

## Correct rule table (pstack:correct, scoped to this board's history)

| Repeated mistake | Structural fix on this branch | Enforcement |
| --- | --- | --- |
| False live claims ("Live from GitHub" over a one-page fetch) | Live fetch + overlay deleted; board reads only the published file; header shows the file's own Updated stamp; >24h shows a stale banner; bundled fallback is disclosed in the header | Source-scan test in `board-data.test.ts` (no `api.github.com`, no liveness wording, no `fetchLive` in any board source); e2e asserts the Updated line and that GitHub is never called |
| Invented structure (dependency graphs denser than the truth) | Bonds are data: exactly the recorded waits in the published file; the map draws exactly those | `buildPublished` bond assertion in the publisher; unit test pins bonds == waits; e2e asserts `data-bond-count="8"` on the stage |
| Leaked internals (story IDs, PR numbers, task counts on public surfaces) | Published shape has no field that can carry tasks/records/counts; tasks live only in curation for closure counting and are never rendered | `scanBanned` over the published file (publisher + unit tests) and over the rendered DOM (e2e banned-word scan); published-shape field whitelist test |
| Stale-state reports (claiming counts not re-derived) | Migration baseline reproduced from captured API truth by a script that hard-asserts 46 / 8 / 20-8-18 and names drift | `scripts/board/reconcile-v3.mjs` + committed `migration-table.json`; drift test in `status-core.test.ts` |
| Stand-in visuals presented as the real thing | Screenshots come only from the built artifact (`serveBuiltArtifact`); the map's budget numbers come from the renderer's own counters on the stage dataset | e2e budget assertions read `renderer.info` via dataset; PR evidence rule: built-artifact screenshots only |
| Theme drift (board plainer/darker than the game) | v3 surfaces consume the homepage's home-v5 tokens, copied value-for-value | `theme-parity.test.ts` parses home-v5.css × board.css × info-page.css and fails on any value drift |

## Next
- Owner review of the PR screenshots; merge is the owners' tap.
- After merge: integrator folds the Graph list below into
  `docs/knowledge/graph.json`.

## Open questions (defaults built, awaiting owner ruling — †)
- Status words: "Not started yet / Working on it now / Done" († UI/UX plain set).
- Phase lines: "…in progress" style list (†).
- Homepage placement of board links: grown-ups area + header nav + footer († was grown-ups area; strengthened per the 2026-11-15 discoverability correction — nav/footer added, indexing untouched).
- Epic grouping: GeoDetective / School Subjects / Story Journals / Voices & Sound / Behind the Scenes († coordinator's draft; GeoDetective features owner-pinned).
- Behind the Scenes as a normal trail stop (†).
- Trailhead counts all 46 stories (†).
- 3D scene: molecule-only with DOM handoff (†).
- **Sitemap/indexing of /board** — currently noindex + absent from
  sitemap (board v2 step 15 owner design, kept). Options: (a) keep,
  (b) index + sitemap entry. NOT changed on this branch.

## Ruled out
- Any live data source for the board (GitHub or otherwise).
- Task-level detail on any public surface, in any form.
- Merging from this branch's author — owners merge after screenshots.

## Graph
Nodes to add (for the integrator; branch never edits graph.json):
- `board-v3` (feature) — the published-file scrum board: trail + molecular map.
- `board-status-publisher` (component) — scripts/board/publish-status.mjs + status-core.
- `decision-board-v3-ship` (decision) — Liz, 2026-11-15: "Ship the scrum board features v3"; motion sample approved 06:52 CT; theme-parity + discoverability corrections 06:58 CT (owner words, voice call).

Edges:
- `board-v3` —supersedes→ `board-v2` (the Sprintbound/live-overlay board).
- `board-v3` —depends-on→ `board-status-publisher`.
- `board-v3` —decided-by→ `decision-board-v3-ship`.
- `board-status-publisher` —documents→ `board-v3`.
