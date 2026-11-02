# Branch status — fix/289-share-first-tap

- **Branch:** `fix/289-share-first-tap`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #289 (Meridian issue-clearing wave,
PR W2) — find the true root cause of the swallowed first tap on the
summary's "Share score" button, fix it at the convicted layer, and earn
the removal of the `clickShareScoreWithRetry` mitigation from
`tests/e2e/endgame-share.spec.ts` (suite green on a single click in
repeated runs).

Tier and rationale: Tier 1 — one bug, clear repro, diagnosis-led; the
fix touches the two components the diagnosis convicted (summary
narration slot + narration first paint) plus the spec helper.

Done condition / evidence: swallow rate measured on unmodified main
first (instrumented probe, N=15, sealed logs); mechanism named from a
captured mid-tap event trace; after the fix, the same probe and the
real spec stay green on a single click in repeated runs (same N);
neighbour specs green; unit + typecheck + lint-cards green;
BRANCH_STATUS + PR with the diagnosis story. NO MERGE — merging is the
owner's step.

DEVIATION (labelled on the panel's request, PR #305 round 1): the
after-fix probe ran at N=5, not the same N=15 — the VM egress outage
(ERR_TUNNEL_CONNECTION_FAILED on the spec's console check, reproduced
identically on unmodified main) plus timebox cut the local runs. The
6.7% baseline is an existence proof from the probe, not a population
estimate, and 0/5 does not statistically exclude it; the verdict rests
on the deterministic mechanism proof (captured mid-tap trace +
constant-Y trajectory), the independent Silo QA reproduction, and CI
e2e green on the tip — not on the 0/5 count.

Files in scope: `src/components/run-summary.tsx`,
`src/components/storyteller.tsx`, `tests/e2e/endgame-share.spec.ts`,
this file. Out of scope: the share path itself (`share-action.ts`,
`share-button.tsx` — proven sound), any other narration host's
behaviour beyond the first-paint seeding (which only restores its
documented "caption text appears instantly" intent).

## Diagnosis (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- Baseline on unmodified main `2a0527f`: instrumented single-click
  probe ×15 — **1 swallowed (6.7%)**, 14 effected
  (`probe-baseline-*.log`, `baseline-tally.txt`). The original spec
  cannot show this rate: its retry helper masks first-click losses.
- The swallowed run (04) is captured end-to-end: at click time the
  lazy Storyteller narration had not yet mounted (no caption in the
  dialog); `pointerdown` hit "Share score", then within ~5 ms the
  narration chunk mounted its caption ABOVE the buttons, pushing the
  button out from under the pointer; `pointerup`/`click` therefore
  landed on the summary card, so the button's handler never ran
  (`__shareCalls` stayed 0, label stayed "Share score" — the exact
  reported symptom). A click whose pointerdown/up targets differ
  fires on their common ancestor, not on the button.
- Second contributor, measured by a 4 s layout trajectory probe
  (`probe-traj-*.log`): even after the chunk mounts, the caption
  painted EMPTY (22px, text length 0 — its words lived in a ref set
  by the mount effect) and popped to full height (61px) at the first
  reveal tick ~260 ms later, moving the buttons a second time.
- Ruled out: the share path (sound — calls reach 1 whenever the
  handler runs), hydration (summary mounts long after boot), inert /
  settle choreography on the summary (none gates these buttons), an
  overlay intercepting (event trace shows the click target was the
  card itself after the shift, never an overlay), late CSS (computed
  styles at first caption paint were already the styled values).

## Fix

- `run-summary.tsx`: the narration's `Suspense` fallback now reserves
  the caption's box — the same summary line rendered invisibly
  (`aria-hidden`) with the caption's exact box metrics (max-width,
  padding, border, banner text size/line-height/balance wrap) — so
  the chunk's late mount swaps into identical space and nothing below
  it moves, at any viewport width.
- `storyteller.tsx`: `wordsRef` is seeded with the line's words at
  first render instead of starting empty (the mount effect still
  re-seeds the same split). The caption's first paint now carries the
  full line, eliminating the empty→full pop for every narration host.
- `endgame-share.spec.ts`: `clickShareScoreWithRetry` replaced by a
  single click (`clickShareScore`); every exact assertion (exactly 1
  call, exact payload, "Shared ✓", clipboard sentinel intact) is
  unchanged and still gates the outcome. No assertion weakened.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- [x] Diagnosis on unmodified main: probe ×15, 1 swallowed, with the
  mid-tap event trace (`probe-baseline-04.log`)
- [x] Trajectory probe: button Y constant for 4 s after the summary
  opens on the fixed build (`probe-traj-after3.log`)
- [x] After-fix probe ×5: **5/5 EFFECTED, 0 swallowed**
  (`probe-after-summary.txt`)
- [x] Endgame-share spec, single click: share assertions pass in every
  after-fix run; one run's clipboard test fully green incl. clean
  console (`spec-final-1.log`). Remaining runs fail ONLY at
  `expectCleanConsole` on `ERR_TUNNEL_CONNECTION_FAILED` (external
  telemetry/contact fetches via the VM egress proxy) — the control
  run on unmodified main fails identically (`spec-control-main.log`),
  so this is an environment outage, not the change. CI on the tip is
  the canonical full-suite check.
- [x] Neighbours: storyteller spec **6/6 green**; session-score 5/8 —
  its 3 failures are pre-existing/main-known (idle-kill strict-mode =
  #296 per the wave PLAN; share-text expects the Workers origin on a
  Pages build; HUD toggle blocked by a by-design celebration
  overlay). Its two end-game summary tests pass.
- [x] Unit suite (861 + 1879 tests, 0 fail), typecheck, lint-cards —
  all green (`unit-after.*`, `typecheck-after.*`, `lint-cards-after.*`);
  build:pages green (`build-after3.*`)
- [x] Redundancy audit: `redundancy-audit.log` — one share entry
  point (`ShareButton` → `shareScore`); the fix adds no second path
  (the placeholder is invisible, aria-hidden, non-interactive)

## Status

- [x] Diagnosis reproduced, mechanism convicted, sealed
- [x] Fix at the convicted layers (narration slot + first paint)
- [x] Retry helper replaced by a single click
- [x] Repeated runs sealed (probe 5/5; spec share assertions green in
  every run — see the environment caveat in Evidence)
- [x] PR opened against main: **#305** (For #289)
- [x] Silo QA (clean context, independent): PASS on `22a8d36`
  (evidence/289/qa-silo/)
- [x] Panel round 1 on `22a8d36`: 1 APPROVE / 11 AWN / 0 BLOCK, DevEx
  PASS-WITH-NITS — cure applied for the convergent metric-drift nit
  (Architect MEDIUM + 5 seats): a KEEP IN SYNC warning now sits in the
  fallback comment in `run-summary.tsx`, and the probe-N deviation is
  labelled above. Dismiss/failure-growth shifts tracked in #306.
- [ ] Silo QA re-verification on the cured tip (a new commit voids the
  `22a8d36` QA entry) — coordinator
- [ ] Panel re-vote on the cured tip — coordinator
- [ ] Merge — owner's explicit per-PR word only

## Observed, not fixed (tracked in #306)

- The caption's designed auto-dismiss (after audio ends / text-only
  hold) still collapses its height seconds later, which moves the
  buttons then. That window opens only after a first gesture has
  started the narration, so it cannot eat the FIRST tap; changing the
  dismiss visuals is a design call, not part of #289's fix. Filed as
  issue #306 at the panel's request, together with the audio-failure
  caption-growth facet the Level Architect seat found.
