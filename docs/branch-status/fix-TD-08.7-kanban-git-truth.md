# Branch status — fix/TD-08.7-kanban-git-truth

## Branch

`fix/TD-08.7-kanban-git-truth`

## Base

`origin/main` at `45040bc6a62af42371ee04ab0509541c22b07a3e`
(verified by fetch 2026-11-26; main had not moved).

## PR

Draft #633: https://github.com/veeresh-bikkaneti/Meridian/pull/633
(head `b823578e` after commit 4). Never merge, never mark
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

### Commit 3 — break E: show open bug issues on the live board

- One call per refresh: `GET /issues?labels=bug&state=open&
  per_page=100`, parsed defensively (`parseGithubIssues`;
  rows with a `pull_request` key are pulls and are skipped).
  The issues call is the one exception to whole-check-or-
  nothing: any failure leaves the board live with the note
  line reading "bug list unavailable".
- `KanbanLiveState` carries `issues` + `issuesUnavailable`;
  the session-cache key moved v5 → v6 because the cached
  shape changed (issues join it). New fixture
  `__fixtures__/github/issues.json` (#590, #478, one PR row
  that must be filtered).
- Bug cards (`deriveBugCards` in `kanban-data.ts`): visible
  Bug chip + issue link, lane `product`, excluded from the
  story/task census, separate count in the note line. Backlog
  by default; In progress when an OPEN pull's title or head
  ref mentions `#N` — a merged pull saying "Refs #N" does not
  move it. A ledger-linked bug (#478) still gets its own card.
- Tests: parse + cache round-trip (v6) + issues-failure
  cases in `kanban-live.test.ts` (every steady-state count
  moved 2 → 3, deep counts +1); `deriveBugCards` cases in
  `kanban-data.test.ts` (title/ref mentions, merged-ref
  negative, `#5901`/`#1590` non-matches). E2E budget test now
  mocks the issues payload and asserts both bug cards in
  their columns plus "2 open bugs" (4 calls on first load);
  the census test mocks an empty issues list.
- Budget (final): steady state 3 calls per refresh, deep
  ≤ 4/hr, first load ≤ 7.

### Commit 4 — break C: ledger stories in live mode, columns derived from GitHub

- The forward-only clamp is gone. `applyOverlay` now gives
  an evidenced subtask its live column in both directions
  (open draft pulls In review back to In progress; a
  closed-unmerged closes PR moves its subtask to Backlog
  with the note). With no evidence, filed Backlog/Blocked
  stands, and filed Done/In review/In progress falls back
  to Backlog with the note "not verified live" — the board
  never invents Done from the ledger alone. This also cures
  the commit-1 wart: a blocked label now surfaces through
  the overlay. The stale `deriveBoardItems` comment (most-
  advanced column) is corrected to the whole-set rule.
- The view finally calls `applyOverlay` on the snapshot
  subtasks with the live pulls/branches, and renders every
  ledger story in live mode (lane-filtered, free-to-claim
  ignored) with `storyRollup` over the live columns, plus
  `unledgeredCards` extras: a derived card whose id matches
  a ledger subtask num folds into that subtask row, cards
  keyed by a story num stay as extras, Unnumbered cards
  always stay. Column header counts equal the cards actually
  rendered (stories + extras + bugs). The count note now
  reads "last 500 updated PRs". On fallback the subtasks
  reset to the filed ones, so a stale overlay never shows
  in offline mode.
- Tests: 6 new in `kanban-data.test.ts` (unevidenced
  fallback for Done/In review/In progress/Backlog/Blocked,
  evidence beats the fallback, fold + story-num-extra
  cases). Deliberate assertion changes, all from the new
  rule: the recorded-fixture counts (arch In progress 0→1,
  In review 1→0 — exactly one subtask moves:
  arch-ports.game-app on open draft PR 571), the PR-571
  forward-only test, the closed-unmerged test (now Backlog
  + note), the work-branch "never a step back" test, the
  auto-signal test. The ledger-only census test is
  unchanged. E2E: budget test asserts 20 story cards (18
  ledger + FW-99.9 + TD-08.4), TD-01 in Backlog, no
  top-level TD-01.1; census test expands TD-02 to show the
  folded TD-02.5 row with its #571 chip, Architecture
  numbered cards 1→0, note "last 500 updated PRs".

### Commit 5 — break A: poll GitHub every 5 minutes while the board is visible

- `KANBAN_POLL_INTERVAL_MS` is the cache TTL itself (one
  value, no drift). `startKanbanPolling` in `kanban-live.ts`
  is React-free and injectable: ticks skip while hidden,
  while a refresh is in flight, and for 60 minutes after a
  rate-limited answer; the view starts it in the existing
  effect and stops it on unmount. `shouldRefetchKanbanLive`
  gains a `"tick"` event with ~5 s of slack so a tick
  landing just short of the TTL still refetches. A failed
  poll after a live success keeps the last good live state
  with the stamp "Live · fetched HH:MM (last check
  failed)"; the offline snapshot shows only when there was
  never a live success.
- Contract text now says "polls every 5 minutes while the
  board is visible (paused while hidden), plus a re-check
  on focus/visibility" in the `kanban-live.ts` header, the
  `shouldRefetchKanbanLive` doc, and the view header. The
  `rg` stale-claim check over `src/build-board`, `docs` and
  the kanban spec found no remaining "no interval /
  exactly two / 100 pulls / ledger-only rows stay" claim in
  the board's own paths (the only hits were unrelated docs).
  `docs/branch-status/feat-build-kanban.md` was NOT edited:
  its "deliberate" line is about the 5-minute TTL choice,
  not a no-poll design, and it is another branch's status
  file.
- Tests: 6 new in `kanban-live.test.ts` (tick slack,
  5 ticks / 25 fake minutes at the poll interval, hidden
  ticks skipped, 60-minute rate-limit back-off, no back-off
  on a plain failure, stop() + no re-entry). E2E: a new
  `page.clock` test — 5 minutes visible refetches (one
  failed pulls call: pulls fails first, so the round costs
  1 call), 5 minutes hidden makes no round, visible again
  re-checks at once and the next tick refetches again,
  with the stale stamp throughout.

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

Final head verification (e2e twice, `rg` stale-claim check,
`git diff --stat origin/main...HEAD`), rewrite of the #633
PR body, then the final report. Do not merge.
