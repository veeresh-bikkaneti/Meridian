# Consensus Manifest — A11Y reload announcement (PR #245 follow-up)

- **Tier:** 2 (Council), per `AGENTS.md` (touches the recovery module,
  3+ files, new storage key, new host seam). Protocol:
  `docs/ops/agent-council-protocol.md`.
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Scope:** fix the two items from the clean-context review of PR #245
  (`meridian-pr245-clean-review-2026-10-25.md`, Accessibility seat
  A11Y-1/2/4; re-check `meridian-pr245-recheck-2026-10-25.md` recorded
  them as knowingly-accept) after Liz reversed that accept on
  2026-10-25: "Yes fix them both." Side 1: the 1_500 ms auto-reload
  truncates `MapErrorBoundary`'s `role="alert"` announcement/focus.
  Side 2: after the reload the player gets no explanation of the
  change of context.
- **Base:** origin/main `d26b90a`. The task brief named main as
  `28c5fea` (the PR #245 squash); that commit is verified an ancestor
  of `d26b90a` (PRs #242/#243 landed after it), and the in-scope files
  `src/lib/chunk-recovery.ts`, `src/lib/chunk-recovery.test.ts`,
  `src/components/map-error-boundary.tsx` are byte-identical between
  `28c5fea` and `d26b90a`. The branch builds on the current base.
- **Council:** Chair/Arbiter (coordinator); Councilor A — ATDD
  (Phase 1); Councilor B — TDD contracts (Phase 2); Councilor C —
  adversarial skeptic (Phase 3, CHALLENGE with 3 blockers + 6 further
  findings; blockers repaired pre-sign-off per D7–D9 below, wording and
  state-machine findings adopted as D10–D11).

## Permitted footprint (maxima; exceeding any line stops the round)

| File | Max + | Max − |
| :--- | :--- | :--- |
| `src/lib/chunk-recovery.ts` | +140 | −40 |
| `src/lib/chunk-recovery.test.ts` | +700 | −60 |
| `src/components/game-app.tsx` (boot consume + one notice render + one state) | +50 | −5 |
| `src/components/map-error-boundary.tsx` (`retry()` only, + import) | +12 | −2 |
| `tests/e2e/chunk-recovery.desktop.spec.ts` | +300 | −15 |
| `BRANCH_STATUS.md` | record only | — |
| this manifest | new | — |

No other file may change. Protected and untouched: `src/game/data/**`,
`package-lock.json`, `package.json`, `public/sw.js`,
`src/lib/observability.ts`, `src/game/build-staleness.ts`,
`tests/e2e/crash-watchdog.spec.ts`, `tests/e2e/safari-launch.spec.ts`,
`tests/e2e/helpers.ts`. No new dependencies. No game-logic changes.
Episode latch, stand-down, and idempotent-install behaviour from the
PR #245 B1/B2 fix round are preserved and pinned by the existing
contracts, amended only where §Contracts says so.

## Decisions

- **D1 — Race pin (adopted from C finding 4, D1 precedent of the
  previous round).** The deferral applies only when the map error card
  is already on screen at the decision point,
  `CHUNK_RECOVERY_DELAY_MS` after the failure. A card that renders
  after the decision point gets no deferral in this round; that case
  is a documented non-fix, not coverage, and is stated in the module
  header and the report in exactly those terms. (In production the
  card is a React commit driven by the same rejection that dispatches
  `vite:preloadError`, so it precedes the decision point by ~1_500 ms
  of margin; Councilor A's contrary scenario is recorded unresolved
  in Objections.)
- **D2 — Boundary-specific predicate (C blocker 1; A independently).**
  The host gains `mapErrorCardVisible(): boolean`. The default
  implementation scans rendered body text (`innerText`, the
  `defaultStaleOfferVisible` precedent) for the exported constant
  `MAP_ERROR_CARD_COPY = "Couldn't load the map."` — the heading copy
  rendered only by `MapErrorBoundary`. No other `role="alert"` content
  can defer recovery, and no other alert is ever force-reloaded over.
  The probe never throws: any exception reads as `false`.
- **D3 — Dwell value (A's recommendation, Chair-ratified).**
  `CHUNK_ANNOUNCE_DWELL_MS = 10_000`, scheduled from the decision
  point. A card present at the decision therefore has at least
  10_000 ms on screen before the reload. Rationale (A): the card is
  ~20 words; ~120 wpm child screen-reader rates need ~10 s. The
  sighted cost is a longer wait on a dead-end card whose "Try again"
  button works throughout.
- **D4 — Decision order and deferral.** In `decide(deferred)`:
  (1) stale offer visible → stand down (unchanged); (2) episode
  active → block (unchanged); (3) if not `deferred` and the
  map error card is visible → schedule one deferred decision after
  `CHUNK_ANNOUNCE_DWELL_MS`, keep `decisionPending` true, write
  nothing, return; (4) if `deferred` and the card is still visible →
  reload path; if `deferred` and the card is gone → stand down
  (cancellation, C blocker 2: a player who recovered during the dwell
  is never yanked). Reload path = write stamp, write notice (D5),
  reload — in that order, each write independently guarded.
- **D5 — Notice write.** On every auto-reload, and on the boundary's
  manual "Try again" (D9), write `CHUNK_RELOAD_NOTICE_KEY =
  "meridian.chunkReloadNotice"` with the same timestamp string the
  reload writes to `CHUNK_RELOAD_KEY`. The write is best-effort: a
  throwing store never blocks or delays the reload.
- **D6 — Notice consume.** `consumeChunkReloadNotice(hostArg?)`:
  reads the notice key; removes it unconditionally whenever a value
  was present (best-effort); returns `true` only for a finite
  timestamp whose age is in `[0, CHUNK_RELOAD_NOTICE_MAX_AGE_MS]`
  (`900_000`, inclusive). Stale, malformed, and future values return
  `false` and are cleared, so a flag can never surface on a wrong
  later boot (C blocker 3b). Storage `null`/throwing → `false`,
  never throws.
- **D7 — Notice render (game-app).** One state
  (`chunkReloadNotice`), set in the boot effect that already calls
  `installChunkLoadRecovery()`; one render beside the `ageToast`
  render in the main return (the return the boot/restore paths land
  on; early-return error screens are out of coverage and that is
  recorded, per C finding 9). Element: `role="status"`,
  `data-testid="chunk-reload-notice"`, copy per D8, a Close button
  (`aria-label="Close"`). **No auto-dismiss timer** (A: a timed
  toast can be deleted before a screen reader reaches it). Dismissal
  is by Close only.
- **D8 — Notice copy.** "Meridian had to reload. You're back! Keep
  playing!" — A's wording with the middle sentence replaced (C
  blocker 3a): "You're back where you left off" claims a restoration
  that is false for review-deck/tutorial runs and unclean-shutdown
  boots; "You're back" claims only that the player is back in
  Meridian, which a fresh consumed flag guarantees. No cause is
  claimed (a preload failure can be a connection hiccup, not only a
  deploy — A's reasoning, kept).
- **D9 — Manual "Try again" (A Scenario 7).** `MapErrorBoundary.retry()`
  calls the exported `markChunkReloadNotice()` (no-arg, default
  storage, best-effort, never throws) before `window.location.reload()`,
  so a player who self-recovers during the dwell gets the same
  post-reload explanation and exactly one reload (the pending
  auto-reload timer dies with the page). The stale offer's Refresh
  button is NOT wired: that path already carries its own explanation
  and consent (A Scenario 3: no notice there).
- **D10 — Claim discipline (C finding 6).** Permitted claim, header
  and report: the reload is deferred so a map error card present at
  the decision point gets at least `CHUNK_ANNOUNCE_DWELL_MS` of
  additional dwell before navigation, and a post-reload notice
  explains the reload. Banned everywhere (module source, report):
  "announcement not truncated", "users hear the full announcement",
  any claim that WCAG 3.2.5 / A11Y-1 is *fixed* (a non-initiated
  reload with notice is a mitigation; 3.2.5 remains AAA-unmet), and
  the pre-existing banned strings ("never loop", "can never loop").
  No live screen-reader pass exists; this round does not close that
  untested item.
- **D11 — Verbatim scoped sentences** (pinned by contract 15-U):
  NOTICE: "The post-reload notice is promised only where session
  storage is writable; where storage is blocked the reload still
  happens and no notice is shown." DWELL: "The deferral applies
  only to a map error card already on screen at the decision point;
  a card that appears after the decision point does not defer the
  reload."

## 1. ATDD acceptance scenarios (Councilor A, as ratified)

- S1 Happy: SR child, map chunk fails, card appears and takes focus →
  no navigation while the card dwells (≥10 s from the decision
  point); then exactly one auto-reload; restored game shows the
  D8 notice via `role="status"` without moving focus.
- S2 Happy, sighted: card stays readable and "Try again" tappable
  for the whole dwell; notice explains the reload afterwards.
- S3 Rejection: stale offer on screen at the decision → no reload
  ever, no notice saved or shown (unchanged stand-down).
- S4 Rejection: unrelated error → no reload, no dwell, no notice.
- S5 Failure: episode already latched, card shows again → no second
  auto-reload across the whole dwell; no notice; "Try again" stays.
- S6 Edge: stale offer arrives during the dwell → deferred decision
  stands down; no reload, no stamp, no notice.
- S7 Edge: "Try again" tapped during the dwell → exactly one
  (manual) reload; post-reload notice shown (D9).
- S8 Edge (NOT adopted — D1 race pin): card renders after the
  decision point → reload proceeds on the original timing;
  documented non-fix.
- S9 Notice hygiene: shown exactly once; consumed at boot; never
  stale; Close dismisses; no auto-timeout.
- S10 Failure: storage blocked → reload still happens exactly once;
  no notice; no error surfaced.

## 2. TDD contracts (Councilor B, as ratified, Chair amendments noted)

Unit — `src/lib/chunk-recovery.test.ts`. Harness extensions are
additive only (fake state `cardVisible`/`cardThrows`; per-key
`setArgs`/`removeArgs`; selective `failSetKeys`; `seedNotice(age)`;
namespace import for new symbols so each RED stays granular).
Chair amendment to B §0/§2: `alertVisible` is `mapErrorCardVisible`
(D2), and the default-probe contracts 12-U are re-based on the body
text scan (stub `document.body.innerText`), not `querySelectorAll`.

- 11-U0 constant pin: `CHUNK_ANNOUNCE_DWELL_MS === 10_000` and
  `> CHUNK_RECOVERY_DELAY_MS`. RED: `undefined !== 10000`.
- 11-U defer-once: card visible → at T0+1_500 reloads 0, no stamp,
  no notice, pending timers `[10_000]`; at +9_999 reloads 0; at
  +1 reloads 1, stamp === notice === String(T0+11_500), one write
  per key. RED: `1 !== 0` at T0+1_500.
- 11-U2a card appearing during the 1_500 window still defers (probe
  is at decision time). RED as 11-U.
- 11-U2b GUARD: card clearing before the decision → reload on time
  at T0+1_500 with stamp+notice.
- 11-U3 deferral spent after one use: card still visible at the
  deferred decision → reloads; no third timer. Mutation: removing
  the once-guard → `0 !== 1` at T0+11_500.
- 11-U4 (Chair, C blocker 2) cancellation: card visible at first
  decision, gone during the dwell → deferred decision reloads 0,
  no stamp, no notice, no pending timers; a later failure with no
  card recovers normally at +1_500. RED: fails at the 11-U deferral
  asserts pre-fix; mutation (no card re-check) → `1 !== 0`.
- 11-U5 burst during the dwell: second failure schedules nothing
  (pending still `[10_000]`), reload at the original deferred time,
  one stamp, one notice. Mutation: `deepEqual([10000, 1500], …)`.
- 11-U6 stale beats card at the first decision: no dwell timer, no
  writes; offer clears, new failure defers and reloads (deferral
  was not spent). Mutation (card checked first): dwell timer at
  the stand-down.
- 11-U7 stale arriving during the dwell stands the deferred
  decision down; recovery re-arms afterwards.
- 11-U8 latch re-checked at the deferred decision: stamp written
  externally during the dwell → no reload, stamp untouched, no
  notice.
- 11-U9 active episode at the first decision blocks without
  spending the deferral; after the episode clears (30_000), a new
  failure defers and reloads.
- 11-U10 GUARD: throwing `mapErrorCardVisible()` reads as no card —
  reload on time, nothing escapes.
- 12-U default probe (stubWindow): body text containing
  "Couldn't load the map." → defer then reload across two flushes
  (RED `1 !== 0` after flush 1); body text without the copy (incl.
  other alert text) → reload at flush 1; throwing/missing body →
  reload at flush 1, no throw; body text = stale offer copy only →
  stand-down, no dwell timer recorded.
- 14-U1 every auto-reload writes the notice (incl. the no-card fast
  path), value === stamp value, exactly one write per key. RED:
  `undefined !== "1001500"`.
- 14-U2 notice-write failure never blocks the reload (selective
  `failSetKeys`). GUARD/mutation-only, labelled as such.
- 14-U3 `markChunkReloadNotice()`: writes the key with a finite
  timestamp via the default storage; throwing storage → no throw,
  no write.
- 13-U consume series (B §3 verbatim): 13-U0 constant pins
  (`"meridian.chunkReloadNotice"`, `900_000`); 13-Ua fresh → true
  once, removed once, second consume false; 13-Ub absent → false,
  zero writes; 13-Uc age exactly MAX → true+cleared, MAX+1 → false
  +cleared; 13-Ud malformed → false+cleared; 13-Ue future → false
  +cleared (deliberate divergence from the latch's future-stamp
  tolerance: a future notice is corrupt state, and a false
  announcement to a child is the harm being fixed); 13-Uf storage
  adversity never throws (null → false; getItem throws → false;
  removeItem throws on a fresh flag → true, best-effort);
  13-Ug consume touches no other key; 13-Uh no-arg default path.
- 15-U (Chair, D10/D11) source pin: module source contains both
  D11 sentences verbatim and none of the banned strings
  "announcement not truncated", "fully announced",
  "CHUNK_RELOAD_WINDOW_MS", "shouldAutoReloadChunk".

Existing-contract amendments (only these): `1-U`, `10-U`, `7-U`
total stamp-write counts 1 → 2 (stamp + notice, per-key attributed);
`2-U` stubWindow `sets` 1 → 2. All other existing unit contracts
pass unmodified, including `5B-SRC-U` (the `BLOCKED_SENTENCE` stays
verbatim). Existing e2e (`1-E`, `8-E`, `3A-E`, B1-EXT, `6-E`) pass
unmodified.

E2E — `tests/e2e/chunk-recovery.desktop.spec.ts` (B §5, ratified).

- Spike gate (before 11-E is written): on the current build, run
  the `safari-launch.spec.ts` recipe (context-route abort
  `**/satellite-map*.js`, click "Play the globe") with a page
  marker and NO synthetic dispatch; record whether a navigation
  follows the card within 5 s. Navigation → Branch A, write 11-E.
  No navigation → Branch B: recovery does not engage on this path
  today; write 11-E′ instead and report the finding to the Chair
  in `BRANCH_STATUS.md` — do not silently substitute.
- 11-E (Branch A): real aborted satellite-map chunk; recorders
  (context init script stamps `__crA11yNavAt` on the first
  post-alert navigation; MutationObserver captures the first
  `[role="alert"]` containing "load the map" into
  `__crA11yAlert {at, text}` in sessionStorage). Asserts: captured
  text contains the full card ("Couldn't load the map.", "Your
  game is safe", "Check your connection, then try again.",
  "Try again"); navigation follows and the guard stamp is
  non-null; `navAt - alertAt >= 10_000` and
  `<= 1_500 + 10_000 + 15_000` (upper bound labelled anti-hang).
  RED pre-fix: the dwell inequality fails with Received ≈1_200–
  1_450. Mutation: deleting the deferral reproduces it.
- 11-E′ (Branch B only): identical, plus the test dispatches
  `vite:preloadError` itself after the card is captured, and the
  primary oracle is `navAt - dispatchAt >= 1_500 + 10_000 - 250`
  (labelled coarse). Without the dispatch leg this variant can
  pass vacuously — flagged in the spec header.
- 13-E: synthetic dispatch on the menu (1-E path) → after the
  reload, exactly one `chunk-reload-notice` (role status, visible,
  non-empty text), notice key null in storage; a further manual
  reload shows no notice. RED pre-fix: visibility leg times out.
- 14-E: no alert on the menu (asserted precondition) → synthetic
  dispatch reloads on the plain 1_500 timing (coarse oracle:
  navigation completes ≥1_000 before the deferred time) AND the
  notice shows. Mutation target: unconditional deferral.
- 6-E2: 6-E's stale-offer recipe with the wait extended to
  1_500 + 10_000 + 2_000: marker alive, stamp null, notice null.

## 3. Scope boundary

- Protected files: as listed under the footprint table.
- Permitted diff footprint: the footprint table is binding.

## 4. Epistemic baseline

- Sources: the PR #245 clean-context review + re-check (on disk,
  read first-hand); repo `AGENTS.md` + council protocol (read
  first-hand); module + boundary + specs (read first-hand). No
  external facts are load-bearing; no web sources needed.
- Confidence: High on mechanism and contracts. Medium on the dwell
  value (A: no measured NVDA/JAWS/VoiceOver speak-time of the exact
  card at default rates exists; 10_000 is a judgement anchored to
  ~120 wpm child rates, not a measurement). D10's claim discipline
  is the mitigation for that Medium.

## Objections and dissent (recorded per protocol §4)

- **Councilor A — objection to D1/D3 anchoring, recorded
  unresolved:** A holds the dwell should be 10 s measured from
  when the alert first appears, so a slow device whose card
  renders after the 1_500 ms decision still gets a full
  announcement (A Scenario 8). The Chair adopts the decision-point
  pin (D1) on the previous round's D1 precedent and the
  same-rejection render ordering, and sizes the dwell at A's
  10_000 so every card the pin covers gets the full 10 s A asked
  for. The uncovered case is disclosed as a non-fix in the header
  (D11) and the report — it is not claimed as coverage.
- **Councilor C — CHALLENGE, disposition:** blockers 1–3 repaired
  by D2, D4 (cancellation), D5/D6/D8 (timestamped, truthful
  notice); findings 4–9 adopted as D1, D4/D11-U5, D10, the §2 e2e
  oracle design, D11, and the footprint table + D7 coverage note.
  C's closing position: "No objection to the direction… The
  blockers are predicate identity, cancellation, and notice
  truthfulness — all repairable within the proposed footprint."
- **Healthy-game limitation (carried, not widened in kind):** the
  previous round recorded that a player who recovers manually
  inside the 1_500 ms window can still be reloaded. This round
  lengthens the window on the card path only, and D4's
  cancellation (card gone → stand down) removes the yank for
  exactly the case where the card was the thing recovered from;
  the residual (healthy screen reached while the card was never
  shown) is pre-existing and unchanged.

## Baseline

The `crash-watchdog.spec.ts` "stale build" breadcrumb failure
(expected `data_chunk_load_start`, got `storyteller_ready`, spec
L217) is proven pre-existing on pristine `a59ee4c` (PR #245 review,
first-hand, two rounds). It is not chased here and must not get
worse; every other failure is this round's until proven pre-existing
the same way (pristine `28c5fea`/`d26b90a` comparison).

## Sign-off

- Chair/Arbiter: SIGNED — decisions D1–D11, contracts as ratified,
  A's objection recorded unresolved, C's challenge repaired or
  adopted as above. Execution token:
  `AUTH_RUN_TDD_IMPLEMENTATION`.
- Councilor A (ATDD): scenarios S1–S10 delivered; dwell value and
  notice terms adopted with the D8 copy deviation and the D1
  anchoring objection recorded.
- Councilor B (TDD): contracts delivered; Chair amendments
  (predicate re-base, 11-U4, 14-U3, 15-U, dwell 10_000) incorporated.
- Councilor C (adversarial skeptic): CHALLENGE issued; repairs are
  the Chair's sign-off conditions above.
- This manifest authorizes local commits on
  `fix/a11y-reload-announcement` only. No push, no PR, no merge:
  those remain Liz's separate steps.

## Footprint revision (Chair, recorded post-GREEN per C finding 9)

`src/lib/chunk-recovery.ts` landed at +173/−7 against the table's
+140 maximum. The overrun is the two exported functions the
contracts require (D5/D6/D9: `markChunkReloadNotice`,
`consumeChunkReloadNotice`, ~75 lines with their doc comments) plus
the D10/D11 header wording the source pin (15-U) makes load-bearing
— the estimate undercounted both. No scope change: same file, same
functions, no additional files. The maximum for
`src/lib/chunk-recovery.ts` is revised to +185/−40 and the overrun
is recorded here rather than absorbed silently. All other files are
inside their maxima (test +494/−12 of +700/−60; game-app +23/−1 of
+50/−5; map-error-boundary +5/−1 of +12/−2).

## Gate-round defect record (Chair)

First Playwright gate run: 11-E failed with dwell Received 1364 —
the deferral never fired in the built artifact. Root cause, found
first-hand: `MAP_ERROR_CARD_COPY` used an ASCII apostrophe while
`MapErrorBoundary` renders `&rsquo;` (U+2019), so the probe could
never match in production — while unit 12-Ua passed, its stub text
mirroring the same wrong character. Repairs, same footprint:
constant corrected to U+2019; 11-U0 extended to pin the constant
codepoint-for-codepoint against the boundary's rendered copy;
12-Ua's stub text is now built from the constant so the chain
constant → probe → stub cannot drift into a self-mirror again.
This is the round's own B1-pattern catch (a test pinning a path
production never takes), found by the e2e oracle doing its job.

## Errata (Reality Checker fix round)

- D2's statement of the card copy used an ASCII apostrophe; the
  boundary renders U+2019 and the shipped constant matches it
  (see the gate-round defect record). D2 is otherwise unchanged.
- The notice claim is scoped as the header now states it:
  show-once holds where the flag's removal succeeds; removal is
  best-effort (13-Uf). Any "exactly once" phrasing for the notice
  in this manifest's scenario list (S9) reads subject to that
  scope.
