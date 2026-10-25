# Consensus Manifest — PR #245 chunk-recovery fix round (B1 + B2)

- **Tier:** 2 (Council). Fix round run as Tier 2 per Liz's follow-AGENTS.md
  direction 2026-10-25; the original build's Tier 1 provenance is
  unverifiable from disk. This manifest is the signed pre-code record the
  original build never had.
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Scope:** close the two blockers from the clean-context review of PR #245
  (`meridian-pr245-clean-review-2026-10-25.md`, Reality Checker gate):
  B1 (default-host install not idempotent on the production path) and B2
  ("it can never loop" overclaimed; stand-down had no test oracle).
- **Council:** Chair/Arbiter (coordinator); Councilor A — ATDD scenarios
  (Phase 1); Councilor B — TDD contracts (Phase 2, amended round 2);
  Councilor C — adversarial skeptic (Phase 3, two challenge rounds).

## Permitted footprint (maxima; exceeding any line stops the round)

| File | Max + | Max − |
| :--- | :--- | :--- |
| `src/lib/chunk-recovery.ts` | +120 | −70 |
| `src/lib/chunk-recovery.test.ts` | +480 | −120 |
| `tests/e2e/chunk-recovery.desktop.spec.ts` | +140 | −60 |
| `BRANCH_STATUS.md` | record only | — |
| this manifest | new | — |

No other file may change. Protected and untouched: `src/game/data/**`,
`package-lock.json`, `src/components/game-app.tsx`, `src/game/build-staleness.ts`,
`public/sw.js`, `tests/e2e/crash-watchdog.spec.ts`, `tests/e2e/helpers.ts`.
Host interface growth is limited to `storage.removeItem` on the chunk-recovery
host; no `clearTimeout` is added.

## Decisions

- **D1 — Decision wait stays 1_500 ms (candidate (a)).** The 8_000 ms
  probe-wait (candidate (b)) is rejected: it taxes no-probe boundary
  failures (the type specimen) 8 s for nothing, the app's probe has a
  hard-coded no-offer path, an 8_000 ms deadline still misses offers that
  render a tick after the fetch abort, and it would silently replace the
  owner's knowingly-accepted 1.5 s trade-off. Slow-probe behaviour is
  re-scoped in words and pinned by oracle 7-U.
- **D2 — Episode latch replaces the stamp-age window.** Rule set:
  `episodeActive` := a stamp is readable (sessionStorage, or the memory
  mirror when storage throws) AND the episode has not been cleared on this
  page; `episodeCleared` starts false at every install. Eligibility at
  install: stamp age > `CHUNK_EPISODE_MAX_AGE_MS` (900_000) is stale —
  cleared best-effort, no latch; age ≤ 900_000 latches. The clear countdown
  (`CHUNK_EPISODE_CLEAR_MS` = 30_000 of continuous failure-free time) is
  armed only (1) at install when an episode is active and (2) armed-or-
  restarted at each signature-failure observation while an episode is
  active; it is never armed by writing the stamp. The observation hook sits
  in the failure path after the signature check and before any
  decision-pending check, and uses `host.now()` captured at observation.
  Restarts use a per-install generation token (the host timer returns
  void); a firing timer clears only if its generation is current and
  `host.now()` ≥ its deadline. On completion: `removeItem(KEY)` once
  (best-effort), mirror cleared, `episodeCleared` := true. A decision
  while active-and-uncleared never reloads and never writes the stamp.
  All episode state, including the generation counter, is per-install
  closure state; the only module-level state is the two install guards.
- **D3 — `shouldAutoReloadChunk` is retired**, deleted with the
  `ChunkRecoveryDecision` interface and its window-gate test. No
  replacement predicate: latch supremacy is pinned behaviourally
  (3A-U-div, 4-U-max). `CHUNK_RELOAD_WINDOW_MS` is renamed
  `CHUNK_EPISODE_CLEAR_MS` = 30_000. `CHUNK_RECOVERY_DELAY_MS` = 1_500
  unchanged.
- **D4 — B1 guard re-keyed on the window object.** Default (no-arg)
  installs are guarded by a module-level WeakSet of window objects (the
  production path builds a fresh host per call; the window is the same
  object, so repeat no-arg installs and GameApp remounts now hit the
  guard). Explicit-host installs keep the host-keyed WeakSet.
- **D5 — Contract hygiene.** Contracts are black-box; mechanism assertions
  (pending-timer counts, generation values, decision-pending flags) are
  struck. E2E test 4-E is cut (90 s test ceiling; 4-U is the re-arm gate).
- **D6 — Rulings on Councilor B's residual flags.** S1: the install-time
  eligibility verdict is authoritative for the page's lifetime — a stale
  stamp never latches on that page even if `removeItem` throws at install.
  S2: countdown completion is unconditional on the completing page; a
  surviving stamp is governed at the next install by the normal rules.
  S3: any stamp write begins a new episode (`episodeCleared` := false at
  write); observations arm-or-restart whenever an episode is active,
  including on the originating page after its own write; only the write
  itself never arms; no page-origin exception.

## Chair repairs to Councilor C's round-2 objections (adopted pre-sign-off)

- **O1 → new contract 4-U-max** (see Contracts). Latch behaviour is now
  pinned past a total stamp age of 900_000 reached via restarts.
- **O2 → 3A-E control leg amended**: after the marker goes, the spec
  re-runs the boot gate ("Play the globe" visible), re-marks, and asserts
  the returned page's stamp is present, finite, and ≠ the seed.
- **O3 → new contract 9-Ud**: unrelated (non-signature) errors inside an
  active episode do not restart the countdown.
- **O4 → header wording amended** (final text below): the clear count is
  anchored to "when the episode became active on this page", the
  writing-page seam is stated, and re-arm is scoped to the completing
  page with the survivor rule stated.
- **O5 → NOT repaired; recorded verbatim as an accepted limitation** in
  the Objections section. Module re-evaluation (HMR, duplicated bundle
  copy) is a bundling property outside this module's scope; production
  ships one bundle copy. The word "idempotent" is not used unqualified
  for the default-host guard in the report or PR body.

## Final header claim wording (verbatim; replaces the "Reloads at most once per…" paragraph)

> Reloads at most once per episode. An episode begins when an auto-reload
> writes its timestamp to sessionStorage. At install, a readable stamp
> whose age is at most CHUNK_EPISODE_MAX_AGE_MS (900_000 ms) starts an
> episode on this page; an older stamp is stale, is cleared best-effort,
> and starts no episode. While an episode is active this handler does not
> reload again and does not rewrite the stamp. The episode ends after
> CHUNK_EPISODE_CLEAR_MS (30_000 ms) of continuous failure-free time on a
> page where the episode is active, counted from when the episode became
> active on this page (install, when install started it) or from the most
> recent chunk-failure observation on this page, whichever is later: the
> stamp is then removed (best-effort) and recovery re-arms on that page.
> A page that writes the stamp reloads immediately, so its own episode is
> judged by the next page's install; if a removal failed, the surviving
> stamp is judged again at that next install under the same age rule.
> That limit is demand-driven: a chunk that is never requested cannot
> fail; an idle page can end an episode without the broken chunk being
> retried — recovery then re-arms for the player's next attempt. When
> session storage is blocked, auto-recovery promises at most one
> auto-reload per page load when session storage is blocked, and it makes
> no promise that a later page load will be prevented from auto-reloading
> once again if the same chunk is still missing. The stand-down for the
> app's own recovery applies only to an offer already on screen at the
> decision point, CHUNK_RECOVERY_DELAY_MS after the failure; an offer
> that appears after that point does not stand this handler down.

Contract 5B-SRC-U pins the storage-blocked sentence verbatim in the module
source and bans the strings "never loop" and "can never loop" anywhere in
`src/lib/chunk-recovery.ts`.

## Contracts (name — label — substance; RED = must fail pre-fix with this signature)

Harness H1 (unchanged from Phase 2): duration-aware fake timers
(`{fn, ms, due}`), `advanceTimersBy` fires due timers in due order,
`flushTimers` abolished; event-time rule — tests set `state.now` before
firing; the module reads `host.now()` inside the listener.

- **1-U — DEFECT.** Fresh episode: fire at T0 → reload at T0+1_500;
  `setItem(KEY)` exactly once, value === String(T0+1_500). No-arm-by-write
  leg: +60_000 failure-free → stamp present, `removeItem` 0. Late leg:
  fire at T0+61_500 → reloads still 1. RED pre-fix: late leg reloads (2).
- **2-U — DEFECT.** Stub window, working Map storage, `document` stubbed;
  two no-arg installs → exactly 3 registrations (RED pre-fix: 6; 9 for
  three). One dispatch (every recorded listener of the type once, in
  registration order) → recorded decision timer has ms === 1_500 →
  exactly 1 reload, exactly 1 `setItem(KEY)`.
- **2-U-blocked — DEFECT.** Stub window whose `sessionStorage` methods all
  throw, reached through the default host's own bindings; two no-arg
  installs → 3 registrations (RED: 6); one dispatch → exactly 1 reload,
  no exception escapes (RED pre-fix: 2 — duplicate listener sets ×
  per-closure memory stamps); second dispatch → still 1 total.
- **3A-U — DEFECT.** Seed age 1_000; failure decision blocks (reloads 0,
  `setItem(KEY)` calls 0, stamp still the seed); failure-free to
  T0+30_000 → `removeItem` exactly once, store empty; next failure
  reloads. RED pre-fix: stamp never removed.
- **3A-U2 — DEFECT.** Seed age 300_000 latches (reloads 0, stamp
  untouched, no `removeItem` at install); boundary leg age exactly
  900_000 latches. RED pre-fix: reloads 1.
- **3A-U3 — DEFECT.** Seed age 900_001 → at install `removeItem` exactly
  once, no latch; failure at T0 → reloads 1, stamp ===
  String(T0+1_500). RED pre-fix: stamp still the stale seed, `removeItem`
  0. S1 sub-leg: `removeItem` throws at install → attempted exactly once;
  failure still reloads exactly once and writes a fresh stamp (no latch).
- **3A-U-div — DEFECT.** Shared storage, `removeItem` throws. Leg a:
  host #1 completes a 30_000 failure-free countdown (removal attempted
  once, throw swallowed, stamp survives). Leg b (S2 chain): a later
  failure on host #1 reloads once and writes a fresh stamp; a further
  failure on host #1 blocks (new episode). Leg c: host #2, fresh install,
  same storage, at T0+31_000 → failure blocks (reloads 0, no stamp
  write) although the stamp's age (32_000) exceeds CLEAR and the retired
  window. RED pre-fix: leg c reloads.
- **4-U — DEFECT.** Active episode; failures observed at T0+20_000 and
  T0+35_000 both block (re-arm by failure-free time, never stamp age);
  failure-free to the restarted deadline → `removeItem` once; next
  failure reloads, stamp === String(its decision time), new episode.
  RED pre-fix: the T0+35_000 failure reloads.
- **4-U-max — DEFECT (O1 repair).** Seed age 899_000 at install
  (latches). Observation #1 at T0+20_000 (total age 919_000) blocks, no
  stamp write. Observation #2 at T0+40_000 (total age 939_000 > MAX_AGE)
  blocks. Failure-free to T0+70_000 → `removeItem` once; next failure
  reloads 1 with a fresh stamp. RED pre-fix and RED for any
  age-cap-at-decision implementation: observation #1 reloads.
- **4-U-neg — unchanged (Phase 2).** Same page that wrote the stamp never
  re-arms on clock advance alone (+10 windows → still blocked).
- **5A-U — unchanged.** Throwing storage, explicit host: one reload per
  page; new leg — clock +10 windows on the same page → still 1 reload
  (RED pre-fix: 2).
- **5B — ORACLE.** Behavioural pin, explicit hosts only: two
  throwing-storage hosts each reload once per simulated page load.
- **5B-SRC-U — ORACLE.** Source-text assertion per the claim section.
- **6-U — unchanged, strengthened.** Stand-down: offer visible at the
  decision point → no reload AND `setCalls(KEY)` === 0 (guard not
  consumed); after the offer clears, a later failure reloads once.
- **6-E — ORACLE (e2e).** Sibling spec in
  `tests/e2e/chunk-recovery.desktop.spec.ts` using the crash-watchdog
  stale-build recipe (abort `**/assets/globe-*.js`, stub build-meta.json
  with a mismatched buildId) so the app's real new-version offer is
  visible; boot via the spec's boot marker path (`APP_NO_IDLE`). Set a
  page marker, assert the offer is visible, dispatch a synthetic
  `vite:preloadError`, wait D+2_000 = 3_500 → marker alive AND
  `sessionStorage[KEY]` still null (no navigation, no stamp). Must not
  depend on the watchdog spec's failing breadcrumb assertion;
  `crash-watchdog.spec.ts` itself is unchanged.
- **7-U — ORACLE (pinning; GREEN pre-fix by design).** Explicit host, no
  stamp, offer hidden: fire `vite:preloadError` at T, advance 1_500 →
  reloads 1, stamp written exactly once; only then set the offer visible
  → nothing changes (no second decision, reload not undone). Pins D1:
  an offer arriving after the decision point does not stand recovery
  down. (Replaces the deleted 7A-U/7B-U.)
- **8-U — DEFECT.** Fresh page, no stamp: fire a non-signature pageerror,
  two synthetic window ErrorEvents, and a generic unhandledrejection →
  no decision timer is ever scheduled (`pendingTimers()` deep-equal []),
  no reload, no stamp. RED by mutation: forcing the backstop to treat
  non-signature errors as signature failures must make this test fail.
- **8-E — DEFECT (e2e).** Standalone fresh-page spec function (split out
  of the old combined e2e test 1): the same three unrelated errors, wait
  D+2_000 = 3_500 → marker alive, stamp null. Mutation-verified with 8-U.
- **9-Ua — DEFECT.** Seed age 1_000; install at T0 arms the countdown
  (deadline T0+30_000). Observation at T0+20_000 (`state.now` set first)
  restarts it (deadline T0+50_000). Advance past the ORIGINAL deadline to
  T0+30_001 → stamp still present, `removeItem` 0 (stale generation
  no-ops). T0+49_999 → still present. T0+50_000 → `removeItem` exactly
  once, mirror cleared, episode cleared; a later failure reloads. RED
  pre-fix at T0+50_000 (stamp never removed); a naive second-timer
  implementation fails at T0+30_001.
- **9-Ub — ORACLE / convention.** Boundary tie is a fake-host convention
  only: `advanceTimersBy` landing exactly on a deadline fires the timer
  (the module's `host.now()` ≥ deadline check passes at equality);
  events fired after that advance observe the cleared episode. No RED.
- **9-Uc — DEFECT.** Active episode (seed age 1_000). Failure #1 observed
  at T0+20_000 restarts the countdown; failure #2 observed at +500 while
  failure #1's decision is still pending schedules no second decision
  but restarts the countdown again (observation hook before the
  decision-pending check). The pending decision blocks (no reload, no
  stamp write); the stamp clears only at second-observation + 30_000,
  `removeItem` exactly once. RED: an implementation with the hook
  inside/after the pending check clears at first-observation + 30_000.
- **9-Ud — DEFECT (O3 repair).** Active episode (seed age 1_000, install
  at T0, countdown deadline T0+30_000). At T0+20_000 fire an UNRELATED
  error (non-signature ErrorEvent via the error listener, plus a generic
  rejection via unhandledrejection). Advance to T0+30_000 → `removeItem`
  exactly once, stamp gone (the countdown was NOT restarted). Advance a
  further 1_500 and fire a signature failure → reloads 1 (the episode
  had ended). RED target: an implementation that restarts the countdown
  on any error keeps the stamp at T0+30_000 and fails.
- **10-U — unchanged (Phase 2).** Burst: three signature failures inside
  one deferral window collapse to exactly one pending decision (pending
  decision timers deep-equal [1_500]), one reload, one stamp write.
- **1-E — DEFECT (e2e, sole reload leg).** `tests/e2e/chunk-recovery.
  desktop.spec.ts`, first leg of the split e2e test 1: `serveBuilt
  Artifact`, boot marker passed ("Play the globe" visible, marker set);
  dispatch `vite:preloadError` → marker gone within the poll window and
  the sessionStorage stamp is present and parses finite.
- **B1-EXT — DEFECT (e2e, test 2 extended).** The real chunk-404 spec
  (abort the LoopScreen chunk route): after the auto-reload, a second
  rejection of the same chunk on the reloaded page is blocked by the
  latch (no second navigation), making the spec's "once" claim proven
  rather than titled.
- **3A-E — DEFECT (e2e).** Seed: boot marker passed first (dispatch is
  gated on "Play the globe" visible); in-page set
  `sessionStorage[KEY] = String(Date.now() − 1_000)`. HARD precondition:
  `expect(read back KEY).toBe(seed)` — a failed seed fails the test, it
  is never reclassified or skipped. Dispatch `vite:preloadError`; wait
  D+2_000 = 3_500 → marker alive, stamp still === seed (hard expect).
  Positive-control leg (O2 repair): in-page
  `sessionStorage.removeItem(KEY)`; dispatch the same event again →
  marker MUST go within a 30 s poll; then re-run the boot gate ("Play
  the globe" visible), set a fresh marker, and assert the returned
  page's stamp is present, parses finite, and ≠ the seed. (The blocked
  leg is behaviourally GREEN pre-fix — age 1_000 also blocks under the
  old window; this contract's defect target is the vacuous-pass mode:
  pre-fix form, a failed seed or dead listeners could not fail the
  test.)

## Objections and dissent (recorded per protocol §4)

- **Councilor A — objection to D1, recorded at sign-off (substance
  verbatim from A's Phase 1 report):** A advocates candidate (b)
  (recovery waits for the probe outcome; confidence Medium) over the
  adopted (a). Under (a) the slow-probe case loses the only explained,
  chosen recovery — exactly on the slowest connections; the cost of (b)
  is waiting on an already-broken screen, while the cost of (a) falls on
  the player's one chance to see the offer and choose. The Chair adopts
  (a) for the reasons in D1 and records this objection unresolved.
- **Councilor C — round-2 objections O1–O5:** O1, O2, O3, O4 repaired
  pre-sign-off (contracts 4-U-max, 9-Ud, the 3A-E healthy-endpoint leg,
  and the amended header wording above). **O5 is recorded verbatim as an
  accepted limitation:** "The window-keyed install guard is not
  idempotent under module re-evaluation (HMR or a duplicated bundle copy
  creates a fresh module-level WeakSet for the same window, restoring
  duplicate listener sets), and the 2-U/2-U-blocked single-import,
  fresh-window hygiene structurally cannot observe this; the package
  must record this as an accepted limitation rather than claim
  idempotence unqualified." Chair's note: module re-evaluation is a
  bundling property outside this module's scope; production ships one
  bundle copy; neither the report nor the PR body will claim the
  default-host guard's idempotence unqualified.
- **Healthy-game limitation (C round 1 §3), recorded as accepted:** the
  recovery decision has no health observable and the pending timer
  cannot be cancelled; a player who dismisses the error and reaches a
  healthy screen inside the 1_500 ms window can still be reloaded. This
  is pre-existing at the 1_500 ms reachability and is not widened by
  this round (candidate (b) would have widened it 5.3×; rejected in
  D1). Not fixed in this scope.

## Carried owner decisions (not engineering consensus; not changed by this round)

- The 1_500 ms reload truncates MapErrorBoundary's `role="alert"`
  announcement/focus (WCAG 3.2.5, AAA only; no A/AA failure). Surfaced
  to Liz with the review verdict as a knowingly-accept item; the
  deferral is unchanged by this round.
- Tier provenance (recorded in BRANCH_STATUS.md verbatim): "Fix round
  run as Tier 2 per Liz's follow-AGENTS.md direction 2026-10-25; the
  original build's Tier 1 provenance is unverifiable from disk."
- This manifest authorizes local commits on `fix/chunk-load-recovery`
  only. No push, no PR edit, no merge: those remain the parent's and
  Liz's separate steps.

## Baseline

The `crash-watchdog.spec.ts` "stale build" breadcrumb failure (expected
`data_chunk_load_start`, got `storyteller_ready`, spec L217) is proven
pre-existing on pristine main `a59ee4c`. It is not chased in this round
and must not get worse; every other failure is the round's until proven
pre-existing the same way.

## Sign-off

- Chair/Arbiter: SIGNED — decisions D1–D6, repairs O1–O4, limitation O5
  recorded, objection of Councilor A recorded. Execution token:
  `AUTH_RUN_TDD_IMPLEMENTATION`.
- Councilor A (ATDD): scenarios delivered; objection to D1 recorded
  above.
- Councilor B (TDD): contracts delivered and amended; residual flags
  ruled in D6.
- Councilor C (adversarial skeptic): round 1 CHALLENGE (10 points);
  round 2 CHALLENGE narrowed to O1–O5; O1–O4 repaired, O5 recorded
  verbatim at C's stated condition for the record.