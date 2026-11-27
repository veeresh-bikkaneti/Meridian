# Branch status — fix/TD-08.7-kanban-git-truth

## Branch

`fix/TD-08.7-kanban-git-truth`

## Base

`origin/main` at `45040bc6a62af42371ee04ab0509541c22b07a3e`
(verified by fetch 2026-11-26; main had not moved).

## PR

Draft #633: https://github.com/veeresh-bikkaneti/Meridian/pull/633
(head `7fd04925` after commit 1). Never merge, never mark
ready; a separate Reviewer runs `review.md` after each push.

## Goal

TD-08.7: make the build board truthful to git again — stay
truthful to git, refresh about every 5 minutes. Five breaks
(A–E), one commit each, in the order D, B, E, C, A.
`kanban.json` is never edited (owner ruling on unlocking the
ledger is pending); columns are derived from live GitHub at
render time. The 18-stories / 45-subtasks checker is locked.

Worktree: `~/workspace/td-08.7-work` (home disk, not /tmp:
the 441M checkout does not fit the 512M tmpfs).

## Baselines (measured on `45040bc6`, 2026-11-26)

- Entry JS gzip: 311,051 B (limit 323,865 B).
- `noUpwardImport`: 104. `noRawIo`: 0. Shell-ban total: 4.
- `game-app.tsx`: 6,397 lines, at ceiling, untouched.
- Narrow unit set (`kanban-data` + `kanban-live`): 84 pass / 0 fail.
- Ledger-only census (`boardCensus(snapshot, [])`): arch 8/23,
  tech-debt 8/17, product 3/7, all 19/47.

## Done

### Commit 1 — break D: Done only when every closes PR is merged

- `standingForPulls(infos)` in `kanban-data.ts`: the whole-set
  rule (blocked label wins; closed-unmerged superseded; any
  open non-draft → In review; else any open draft → In
  progress; Done only with ≥1 merged and no open pull).
- `deriveBoardItems` uses it (the `preferAdvanced` most-advanced
  rule is gone); the overlay path reads recorded `closes` PRs
  plus numbered auto pulls as one set through it (the
  `recordedLiveColumn` / `autoLiveColumn` / `preferForward`
  split is replaced by `liveStanding`), keeping the
  forward-only clamp and the every-closes-PR-fetched guard.
- Tests: 7 new (whole-set rule, TD-06.9 and TD-05.4 shapes
  via derive + overlay, blocked wins on a derived card).
  One deliberate assertion change: the "most advanced column"
  derive test now expects In review for merged + open
  (TD-09.1) — that was break D itself.
- Known wart, deferred to commit 4: in the overlay, a blocked
  label cannot surface while the forward-only clamp stands
  (Blocked ranks equal to Backlog), so the overlay blocked
  case is asserted at the `standingForPulls` / derive level
  only. Commit 4 removes the clamp for evidenced subtasks.
- Gates: tsc, lint:arch, lint:nav, game-app size, full unit
  suite, provenance — all pass (see commit-1 gate logs under
  `~/workspace/.td069-tmp/td087-c1-*`).

### Commit 2 — break B: read older pull requests within a fixed request budget

- Two tiers in `kanban-live.ts`: fast (pulls page 1 +
  branches, every refresh) and deep (pulls pages 2..5, cap
  500 PRs, 60-minute localStorage cache shared across tabs,
  merged by number with the fast tier winning). Deep pages
  run only when page 1 is full; a short page stops paging;
  page 6 is never requested. A failed deep page keeps the
  previous deep rows and never fails the check.
- `KANBAN_LIVE_CACHE_KEY` bumped v4 → v5 (cached shape
  unchanged in this commit, but the key moves with the fetch
  contract; the issues shape lands in commit 3).
- Fast-tier 403/429 surfaces `{ action: "fallback",
  rateLimited: true }` from `refreshKanbanLive` (the poller
  in commit 5 consumes it). `fetchKanbanLive` still resolves
  null on any failure.
- Tests: 7 new deep-tier unit tests (paging + merge,
  short-page stop, page-6 cap, fast-wins, 60-min deep cache
  with the exact 2-call steady state, failed deep page,
  rateLimited signal). Deliberate replacements: the "no page
  walking" unit test is gone (that was the old contract);
  the "v3 cache" test now asserts the v5 key. E2E budget
  test updated with a full-page fixture: 3 calls on first
  load (pulls p1 + pulls p2 + branches), pages `["2"]` only.
- Budget (this commit): steady state 2 calls per refresh,
  deep ≤ 4/hr, first load ≤ 6. Commit 3 adds the issues call
  (steady 3, first load ≤ 7).

## Ruled out / deferred

- Editing `kanban.json`, `scripts/board/publish-kanban.mjs`,
  the transport port, any `eslint/*-baseline.json`, the size
  check scripts, `game-app.tsx`, workflows, or another seat's
  PR (#629, #630, #632, #600). No cap raised, no baseline grown.
- No real GitHub calls in tests: fixtures and route mocks only.

## Open questions

- Ledger unlock / new TD IDs: owner ruling pending (see the
  PR body). Ids not in the ledger appear as extra cards only.
- The clean-room flake behind TD-06.9's hardening (#632) is a
  separate track; this branch does not touch it.

## Next step

Commit 3 (break E): open bug issues on the live board.
