# BRANCH_STATUS — feat/watson-station

- **Branch:** `feat/watson-station` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Task:** Watson holds the clue-card station through the guessing phases.
- **Owner defect:** 2026-11-08 ~00:53 CST — Watson standing large at the
  map's bottom-left corner on the owner's phone during guessing.
- **Diagnosis of record:** `~/workspace/meridian-detective-evidence/diag-watson-corner/DIAGNOSIS.md`
  — the walk works on live production; when a clue read ends, the state
  machine enters `SEARCH_IDLE`, whose view parked Watson at placement
  "dock" (rendered inside the map, bottom-left), and `SEARCH_AREA` /
  `SELECTION_READ` / `ASK_NEXT` kept him docked. Owner's standing ruling
  (2026-11-07): "Watson stays at the clues once play starts."

## Task capsule

TASK / requested outcome: change Watson's placement from "dock" to
"station" in exactly four phases of `viewForState`
(`src/game/loop/detective/detective-state.ts`) — SEARCH_IDLE,
SEARCH_AREA, SELECTION_READ, ASK_NEXT — poses unchanged, no Holmes
placement or pose changed anywhere. Verify DetectiveHost needs no
logic change (it renders purely from the machine's placement), update
the unit + E2E pins that required Watson at the dock in the FULL
(non-degraded) path, and record the cure in the handbook.

Tier and rationale: Tier 1 builder silo under the coordinator's brief —
one proven mechanism, one view-table change. Independent clean-context
QA + panel verification are run by other agents, not the builder.

Done condition / evidence:
- Unit (TDD, RED first): the search-view pin flips dock → station; a
  new per-phase test pins SEARCH_AREA / SELECTION_READ / ASK_NEXT with
  Holmes-placement guards in all four phases. RED confirmed
  (dock ≠ station) before the cure; GREEN after.
- Host check: every `view.watson.placement === "dock"` consumer traced
  (`watsonOnMap`, `watsonReplayDockEl`, `mapSoundEl` guard, the map
  portal block) — all are placement-generic; in the cured phases the
  station cluster (figure, gutter transform, replay-at-station,
  station sound cluster) takes Watson and the map portal renders
  Holmes alone (the dock cluster markup is already conditional on
  `watsonOnMap`, so it tolerates Watson's absence). **Zero host logic
  changes** — only two stale comments updated.
- Degraded path untouched by design: dock-only companion
  (`data-companion="dock"` — Holmes's berth verdict), tap speech mode,
  and the "dock" member of `WatsonPlacement` (host fallback) all stay;
  E2E pins for that path were not modified.
- Gates: see Status below (real results, filled by the builder).

Files in scope: `src/game/loop/detective/detective-state.ts`,
`src/game/loop/detective/detective-state.test.ts`,
`src/game/loop/detective/DetectiveHost.tsx` (comments only),
`tests/e2e/detective-replay.spec.ts`, `tests/e2e/detective-sound.spec.ts`,
`tests/e2e/detective-visibility.spec.ts`,
`tests/e2e/detective-watson-walk.spec.ts`,
`tests/e2e/detective-staging.spec.ts` (comment only),
`docs/handbook/10-holmes-and-watson-pair.md` (new dated record section),
this file.

Collision note: the #364 lane (`feat/holmes-follow`) touches the same
two source files (`detective-state.ts`, `DetectiveHost.tsx`). This
branch is off `main` @ `9e49da3` and merges independently; whichever
lane merges second rebases over the other.

## Status

- [x] Diagnosis read in full; mechanism confirmed in code
- [x] Unit test RED (dock ≠ station in the four phases)
- [x] Cure: four placements → "station" + plain-tone why-comments — `63879d8`, pushed
- [x] Host audit: zero logic changes needed; stale header + map-render comments updated — `45865ff`, pushed
- [x] E2E pins updated (full path only; degraded pins untouched) — `c142574`, pushed
- [x] Handbook: "Watson station cure (2026-11-08)" record section — `d732610`, pushed
- [x] Builder gates:
  - `npx tsc --noEmit` — clean
  - `npm test` — PASS (final suite 2267/2267, 0 fail; command exit 0)
  - `npm run test:worker` — PASS (145/145, 0 fail)
  - `node scripts/lint-cards.mjs` — GATE PASSED
  - `npm run build:pages` — PASS (exit 0; prerender + fingerprint-sw
    completed. Two earlier local attempts were killed by VM restarts
    mid-build — environment, not build errors — and the gate was
    re-run clean to this result.)
- [ ] PR opened — NO: builder brief forbids opening PRs; the
  coordinator opens it after independent clean-context QA
- [ ] Merge — on the owner's word / coordinator only, never the builder

## GATES STATE (finisher session, 2026-11-08 — updated after every gate)

Finisher: pipeline-finisher subagent (lane 1 of the owner's sequential
pipeline law). Base verified against **origin/main `9e49da3`** — the
local `main` ref is stale (#361-era `97d1dcf`); origin/main IS an
ancestor of this branch and the true branch diff is 11 files (623+/185−).

- [x] Chromium launch RE-TEST: the WebGL-policy outage is OVER for the
  real spec path — Playwright + bundled chromium-1243 launches and
  renders the app. Two environment facts every E2E run here needs:
  (1) `PLAYWRIGHT_CHROMIUM_EXECUTABLE` must point at the bundled 1243
  binary (the config default `/opt/meta-chromium/chrome` refuses to
  launch); (2) runs go with `TMPDIR=$HOME/playwright-tmp` — the VM's
  /tmp is a 512 MB tmpfs that LANDED AT 100% under other lanes'
  profile/cache junk (since freed), and the home volume carries an
  EDQUOT **file-count** quota: Chromium dies with SIGBUS
  (`BUS_ADRERR`, "Creating shared memory … Disk quota exceeded (122)")
  once renderer shared-memory creation hits it.
- [x] **Gate 1a — `detective-endings.spec.ts`: RUN, 0 passed / 2 failed**
  (full reporter output read; logs in
  `~/workspace/meridian-detective-evidence/station-e2e-2026-11-08/`).
  Runs 1–3 died at the first click on environment (full /tmp, then the
  EDQUOT crash). **Run 4 (clean environment) played both tests end to
  end** — the complete WIN path and the full 5-guess FAIL path ran —
  and both failed on the NEW N2 audit windows only:
  - WIN: `WIN celebrate→debrief @ endings` — worst
    `map:high-five` over clue-2 text ("This is a hot desert cit…"),
    max overlap 4,777.5 px² over 2,900 samples.
  - FAIL: `FAIL fail-read→pout @ endings` — worst `map:think` over
    clue-4 text ("After the PEPCON disaste…"), max overlap 4,777.5 px²
    over 11,920 samples.
  - **N7 VERIFIED PASSING inside the WIN run:** no clue-3/4/5 clip in
    the play record or the network list after the guess-2 solve (the
    test reached and passed that assertion before failing at the N2
    absorb; absence checks fail loudly, so reaching the absorb proves
    them).
  - **What the failure IS (screenshots read first-hand):** at the
    1440 px endings viewport, Watson stands at his clue-card STATION
    (left gutter beside the active card — the cure working) and Holmes
    stands on the card's LEFT EDGE, his painted box overlapping the
    card's first text column. Holmes is the CELEBRATE/FAIL_READ layout
    partner placed beside Watson by the host's existing celebration
    layout — a phase this branch never touched (CELEBRATE was already
    "station" for Watson before the cure; FAIL_READ likewise). The
    sampler's "map:" prefix is its cluster label for Holmes, not a map
    position — in both failure screenshots **neither figure is on the
    map**; both stand at the clue cards. So: **pre-existing
    celebration/fail-read layout overlap, exposed by the NEW N2
    windows (Silo QA's own gap), not a regression of this cure.**
    Per the finisher brief (pin exposes a product bug → flag before
    touching production code) this is flagged to the parent for a
    routing decision; the pins are NOT loosened and production code
    is NOT touched by this session.
- [x] **Gate 1b — `detective-watson-walk.spec.ts`: 9 passed / 0 failed**
  (PLAYWRIGHT_EXIT=0, full output read; log `e2e-walk1.log` in the
  evidence dir). The main walk test at 390/768/1280 carries BOTH the
  N2 guessing-chain window (SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING sampled in order; window absorbed at 0 px²) and the clue-2
  walk window — **N2 guessing-chain half: PASSING**. The new mid-walk
  tap test passed — **N6: PASSING**. Kill-switch (watsonWalk OFF) and
  reduced-motion tests also passed.
- [x] **Gate 2 — nit-5 measurement TAKEN: maxOverlap 0 px²**
  (watsonWalk OFF via `fulfillFlagsStaging`, 390 px; throwaway probe,
  written → run → deleted; log `e2e-nit5b.log`). 9,600 figure/text
  pair samples across two 4 s windows: the first right after the
  unlock gesture (host not yet mounted — phase null, bench/CASE_OPEN
  window), the second starting 2.5 s after the guess commit (phase
  SELECTION_READ, spanning the guessing-chain into the clue-2 read).
  **No overlap anywhere on the walk-off path at 390 — nothing to
  route.** Caveat for the record: the probe's strict READING-phase
  gate never latched in the walk-off flow (the host mounts only after
  the duet drains), so the windows are labelled by their actual
  phases above, not by the intended READING label; the zero stands
  for the windows sampled.
- [x] Gate 3 — Silo QA delta re-key: the tip moved past `034535e`
  ONLY by this file's GATES-STATE commits (records, zero code/test
  changes) — the existing PASS-WITH-NITS + the now-run-verified gaps
  stand; no code delta exists to re-key. Stated per the finisher
  brief's either/or.
- [ ] Gates 4–7 — PR, panel, DevEx/benchmark, merge: BLOCKED on the
  parent's routing decision for the N2-endings finding above
  (pre-existing CELEBRATE/FAIL_READ layout overlap). Everything else
  in gates 1–3 is green: N1 (unit, prior round), N2 guessing-chain,
  N6, N7 PASSING; N2 endings windows FAIL on the pre-existing
  overlap; nit-5 = 0 px².

## Gap-closure round (2026-11-08, Silo QA PASS-WITH-NITS follow-up)

Test-only pins for Silo QA's N1–N7 gaps; zero production-code changes.

- [x] **GAP 1 (N1) — pinned + PASSING** (`49f210d`): unit test
  "station law past guessing: THINKING_BEAT, FAIL_READ, POUT,
  DEBRIEF and CELEBRATE never dock Watson (owner ruling 2026-11-07)"
  in `detective-state.test.ts` — Watson's placement asserted
  "station" in all five phases (CELEBRATE across all four
  choreography steps). Full suite: `npm test` 2268/2268.
- [ ] **GAP 4 (N7) — pinned, run UNVERIFIED** (`35db604`): endings
  spec "WIN in 2" now asserts, after a 2 s settle, that no
  `case-137/clue-3.mp3`, `clue-4.mp3` or `clue-5.mp3` appears in
  either the play record or the network request list. NOT YET
  RUN — see the Chromium outage below. (Correction, same day:
  an earlier version of this capsule claimed this and the N2
  endings windows were PASSING on a "2 passed" endings run.
  That was a misread of truncated, piped output: the run's full
  output shows **2 failed**, both at browser launch. No endings
  test has passed in this round.)
- [ ] **GAP 2 (N2), endings half — pinned, run UNVERIFIED**
  (`35db604`): audit windows "WIN celebrate→debrief @ endings"
  (9 s, opens at CELEBRATE) and "FAIL fail-read→pout @ endings"
  (12 s, opens at the final miss) absorbed through `AuditTrail`
  at 0 px². NOT YET RUN — see the Chromium outage below and the
  correction note under GAP 4.
- [ ] **GAP 2 (N2), guessing-chain half — pinned, run UNVERIFIED**
  (`368c201`): in the watson-walk main test (all 3 widths), a
  12 s audit window "guessing chain selection→note→ask-next"
  opens once SELECTION_READ is live + 300 ms (the documented
  ~200 ms guess-commit FLIP exclusion kept exactly), with a
  trace assertion that SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING were sampled in order and a play-order subsequence
  (name → suspicion → ask-next → clue-2). NOT YET RUN — see the
  Chromium outage below.
- [ ] **GAP 3 (N6) — pinned, run UNVERIFIED** (`368c201`): new
  watson-walk test "watson walk: tap on Watson MID-WALK is
  ignored — one figure, walk arrives, held clue read fires
  exactly once (phone 390)". Pins the shipped behaviour: during
  a speech-gated walk the replay cue is hidden and the figure
  cluster is pointer-events:none, so the tap is a no-op — walk
  still "walking" after the tap, exactly one
  `[data-detective="watson"]` in every walking sample (never >1
  anywhere), clue-2 read + ack-2 each exactly once. NOT YET
  RUN — see the Chromium outage below.
- [ ] **OBSERVATION (nit 5) — MEASUREMENT BLOCKED, not taken.**
  A throwaway probe spec (audit sampler + per-frame phase,
  watsonWalk OFF via `fulfillFlagsStaging`, 390px, clue-1 and
  post-guess clue-2 READING windows) was written and deleted
  unrun: no measurement number exists yet. Do not quote one.
  Re-run on Chromium recovery; the coordinator routes any real
  overlap separately (pre-existing station anchoring — out of
  this branch's scope either way).
- **Chromium outage (environment, evidenced):** every NEW
  Chromium launch on this VM currently fails with
  `Hatch WebGL domain policy is required for browser startup`
  (chrome_main_delegate.cc:1283). Evidence: the endings run
  started 10:42 (VM clock) **failed both tests at
  browserType.launch** with exactly this error (full output in
  the run log; error contexts under `test-results/`); a bare
  `chrome --headless --dump-dom about:blank` reproduces it and
  was still failing at 11:38. The binary's strings show it
  requires `--hatch-webgl-allowed-domains-file` + `-sha256`
  switches that are not present on disk — a runtime policy
  delivery break, not a code issue. Re-run ALL THREE touched
  E2E specs on recovery, sequentially under the flock:
  `npx playwright test tests/e2e/detective-endings.spec.ts --workers=1`
  then `npx playwright test tests/e2e/detective-watson-walk.spec.ts --workers=1`
  (read the full reporter output — a piped `tail` masks the
  playwright exit code; that masking caused the correction
  above).
- [x] Gap-round gates: `npx tsc --noEmit` clean ·
  `npm test` PASS 2268/2268 · `npm run test:worker` PASS 145/145 ·
  `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` PASS (exit 0)
