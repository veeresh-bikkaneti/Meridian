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
  `npm test` — src suite 2,646/2,646, scripts suite ~~1,198 tests
  0 fail~~ CORRECTION (2026-11-15): the scripts "0 fail" claim does
  not reproduce at the shipped tip — `e2e-telemetry-guard` (c2)
  failed on a stale CONTEXT_FILES pin entry for
  `board.desktop.spec.ts` (left from #436; the v3 spec no longer
  calls `browser.newContext(`). Stale entry removed on this branch;
  guard test 6/6 after the cure; `node scripts/lint-cards.mjs` GATE PASSED;
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
- **Sitemap/indexing of /board** — RULED by the owner 2026-11-15
  (option b) and LANDED in the fixes run below: /board is in
  public/sitemap.xml, the route serves no noindex, and
  scripts/static-wellknown.test.mjs asserts both halves.

## Ruled out
- Any live data source for the board (GitHub or otherwise).
- Task-level detail on any public surface, in any form.
- Merging from this branch's author — owners merge after screenshots.

## Graph
Nodes to add (for the integrator; branch never edits graph.json):
- `board-v3` (feature) — the published-file scrum board: trail + molecular map.
- `board-status-publisher` (component) — scripts/board/publish-status.mjs + status-core.
- `decision-board-v3-ship` (decision) — Liz, 2026-11-15: "Ship the scrum board features v3"; motion sample approved 06:52 CT; theme-parity + discoverability corrections 06:58 CT (owner words, voice call).
- `decision-board-theme-switch` (decision) — Liz, 2026-11-15 (voice call): the board loads with the visitor's default system theme, but "they should be able to switch" — a visitor-facing light/dark switch on the board, never pinned, never locked to the system theme.

Edges:
- `board-v3` —supersedes→ `board-v2` (the Sprintbound/live-overlay board).
- `board-v3` —depends-on→ `board-status-publisher`.
- `board-v3` —decided-by→ `decision-board-v3-ship`.
- `board-v3` —decided-by→ `decision-board-theme-switch`.
- `board-status-publisher` —documents→ `board-v3`.

## Update — 2026-11-15 fixes run (owner: "Fix both")

Done, on top of the shipped tip:
- **Indexing fix:** /board added to public/sitemap.xml; the noindex
  meta removed from src/routes/board.tsx; the static-wellknown test
  flipped (NOINDEX_ROUTES mechanism kept, now empty; new positive
  test asserts /board is listed, serves no noindex, and that the
  deleted /board/issues is never listed).
- **Design uplift Top 3** (DESIGN-UPLIFT.md §2, exactly as specced):
  (1) one journey panel per feature — feature card + stops flat
  inside the .hv5-card-recipe panel, stop buttons a grid with the
  pill far right and the line full width, mirror buttons share the
  anatomy; a finished feature's gold border moved to the panel via
  :has (no finished feature exists in the data yet). (2) The map
  stage takes the atlas ground + 76px grid overlay from
  src/styles.css (the .atlas-bg recipe), 560px tall on desktop
  with the renderer height on the same >900px rule, atoms at
  SphereGeometry(0.85, 14, 10), bonds --atlas-stamp, halo
  --atlas-brass; the legend's bond swatch follows the bond colour.
  (3) Story banner at its true 64px, story card on --hv5-card with
  28px insets, the open stop's duplicated line hidden, the ⛔ span
  deleted — blocked stops carry the dashed frontier rule
  (.v3-blocked) and their line already says "Coming after: …".
- theme-parity.test.ts extended (not loosened): the atlas family
  is now pinned — tokens must exist in styles.css :root with the
  chart-room values, board.css must consume them via var(), and
  molecule-map.tsx's hexes must match the tokens.
- Gates: tsc clean; npm test green (src 2,649/2,649 incl. +3 atlas
  parity checks); lint-cards + lint:content GATE PASSED;
  build:pages OK; board:budget PASSED 170,571/184,320 B gz; board
  Playwright spec 10/10 on the built artifact; renderer measured
  22 draw calls / 14,228 triangles / 8 bonds (triangles rose from
  9,076 with the smoother atoms; cap 15,000).
- Before/after screenshots: ~/workspace/board-v3-ship/screenshots/
  {before,after}/ (five pairs at 1280×900, plus a dark-scheme map
  shot — the atlas family is scheme-following, exactly like the
  play screens' .atlas-bg: light scheme gives the light journal,
  dark scheme the dark chart room).
- Full record: ~/workspace/board-v3-ship/FIXES-REPORT.md.

Next step: independent Reality Checker + design re-gate (dispatched
separately by the parent). NOT merged — merge stays the owners' tap.
Open questions: the remaining † defaults above, unchanged.

## Cure run (2026-11-15) — telemetry pin + record correction

- Done: removed the stale `board.desktop.spec.ts` entry from
  CONTEXT_FILES in `scripts/e2e-telemetry-guard.test.mjs` — the
  (c2) pin failure at the shipped tip. The v3 board spec uses the
  shared fixtures + serveBuiltArtifact and never calls
  `browser.newContext(`; the pin entry dated from #436. Guard test
  6/6 after; full `npm test` at this head: scripts suite 1,200
  tests (1,189 pass, 0 fail), src suite 2,649/2,649. The gates
  record above carries the dated strike-and-correct for the
  original "0 fail" claim; the same correction is in the ship
  REPORT.md.
- E2E discrepancy (the gate saw 9/10; both crews reported 10/10):
  the board spec was re-run 2x at this head and 1x at pristine
  44c88eef — 10/10 every time, the grown-ups shell test ~2s
  against its 15s expect timeout. Classified environment/timing
  in the gate session, not code; the specific stall mechanism is
  unproven; no test or spec was edited. Full record:
  ~/workspace/board-v3-ship/CURE-REPORT.md.
- Next step: independent re-gate by the parent. NOT merged.
- Open questions: unchanged (the remaining † defaults; the
  light-scheme map ruling stays the owner's).

## Theme switch (2026-11-15) — system default, visitor can switch

Owner ruling (voice call): the board loads with the visitor's
default system theme, and visitors can switch light/dark
themselves. Built on top of the cure tip:

- A three-state control (System / Light / Dark — real buttons,
  aria-pressed, the view nav's own pill recipe) beside the Calm
  toggle. System is the default and sets NO attribute: the media
  query rules, exactly as before. Light/Dark set
  data-board-theme on the board root; board.css re-declares the
  18 scheme-varying tokens the board consumes (values copied
  verbatim from styles.css :root and its light media block), so
  the choice wins over the system scheme in both directions.
  The choice persists in localStorage
  (meridian-board-v3-theme). /board only — no global data-theme,
  no site-wide theme system.
- The 3D map follows live: bonds + selection halo read
  --atlas-stamp / --atlas-brass from the stage's computed style
  (CSS stays the single source of truth) at scene build and
  whenever the effective scheme changes. Status colours, label
  chips and lights are scheme-invariant by design, untouched.
- theme-parity.test.ts EXTENDED (+5 tests, nothing loosened):
  both override blocks are pinned value-for-value against BOTH
  styles.css scheme blocks (the light block is parsed now — the
  fixes gate's blind spot (a), closed for the board's copies),
  color-scheme is pinned per override, and the map's live token
  reads are asserted.
- E2E +2 tests (board spec): dark system → Light flips the map
  stage + bond swatch live, persists across reload, System
  recovers the media query; light system → Dark mirrors it. The
  two tests block service workers (the SW re-fetches navigations
  as non-navigation fetches, which the shell route 404s — a
  harness artifact; the SW has its own spec).
- Gates at this head: tsc clean; npm test green (scripts 1,189
  pass / 0 fail, src 2,654/2,654 incl. the +5 parity tests);
  test:worker 235/235; lint-cards + lint:content GATE PASSED;
  build:pages OK; board:budget PASSED 170,740/184,320 B gz;
  board Playwright spec: both theme tests pass in every run;
  the pre-existing grown-ups shell test is intermittent in this
  harness (SW-claim race on its second navigation — trace-proven
  at this head AND at the pre-change head; full tally in
  ~/workspace/board-v3-ship/SWITCH-REPORT.md).
- Screenshots: ~/workspace/board-v3-ship/screenshots/switch/
  (trail + map with Light forced on a dark system, trail + map
  with Dark forced on a light system, the control itself).
- Next step: independent gate by the parent. NOT merged — the
  merge stays the owners' tap on PR #499.
- Open questions: the grown-ups shell test's SW race is now
  mechanism-proven; whether to give that test the same
  serviceWorkers:"block" treatment is the gate's call, not this
  run's (no test beyond the two new ones was edited).
