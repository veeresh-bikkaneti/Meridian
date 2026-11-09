# BRANCH_STATUS — feat/holmes-follow (PB-1, pair-behaviour programme 1 of 3)

- **Branch:** `feat/holmes-follow` · **Base:** `main` @ `566c955` (PR #363 merged + live)
- **Owner spec:** restatement 2026-11-07 ~11:55 CST — Holmes follows the pointer/finger across the WHOLE PAGE and stays with it; returning to a home spot after a pause is "a big bug". Supersedes the waypoint-berth + dock-return model (#361–#363).
- **Flag:** `holmesFollow` — baked default `false` in `src/lib/flags.ts`, `public/flags.json` = `true` (ships ON in this PR; setting flags.json false is the one-line kill-switch back to PAUSE_BERTH).

## Done
- [x] New pure module `src/game/loop/detective/follow.ts`: follow solver (ring + edge perch, K2 clearance law 56/64 px, centre band 80–100 px, forbidden-rect rejection) + tier machine (PAGE_FOLLOW → PAUSE_BERTH → DOCK_ONLY; down on kill/dock/degradation verdicts, up on #362 re-qualification signals + case-open probe).
- [x] DetectiveHost reworked: window pointer wiring writes refs only; solves on ≥32 px displacement or ≥150 ms dwell, rate-limited 1/100 ms, against the CACHED forbidden set (rebuilt on scroll/resize/phase/case events only); fixed viewport portal render; positional memory in a ref across cases/phases; planted during scroll/pinch; speech lock; burst yield + return-to-last-pointer ~120 ms after idle; head-turn telegraph + single 0.3–0.8 s travel.
- [x] Deleted: `exitToDock`, the phase-exit dock snap, the >320 px remote rule, the berth solver in companion.ts (pause detector + auto-kill tracker kept; FG-5 latch untouched).
- [x] Unit gates: follow solver/tier tests fail-before/pass-after; companion coverage moved (berth-solver tests → follow tests); scripts 1021 pass / src 2262 pass / worker 145 pass; tsc clean; lint-cards PASSED.
- [x] Build: `npm run build:pages` exit 0 (needs XDG dirs on tmpfs on this VM — home quota exhausted).
- [x] E2E specs: NEW `detective-follow.spec.ts` (a)–(f) + telemetry-guard registration; REWRITTEN `detective-berth.spec.ts` (tier model), K2/K3 in `detective-companion.spec.ts` (above-point + pinch/pan-cancel rules deleted), staging C12 (remote rule deleted).
- [x] Docs: handbook ch.10 PB-1 banner + addendum; SPEC_CHECKLIST PB-1 section.

## Blocked / not done
- [ ] **E2E execution + 390/768/1280 render screenshots: ENVIRONMENT-BLOCKED on this VM.** The Chromium renderer crashes on game mount in all three installed browser builds, identically against the UNMODIFIED main build (donor dist control run) — not a PB-1 defect. Home disk quota is also exhausted (builds need the XDG redirect). Silo QA must run the detective E2E set + capture the three widths on a healthy runner before merge.
- [ ] Silo QA (independent) — coordinator's lane after this PR opens.
- [ ] 12-seat panel on the final tip — coordinator's lane.
- [ ] Benchmark (build bytes at tip) — coordinator's lane (bundle-report needs a healthy build env).

## Standing rules honoured
- HARD STOP at the owner's merge word — this branch is NOT merged.
- No branch-protection changes. No token/repo-scope changes.
- PB-2 (session/moments) and PB-3 (mute-by-character) are separate PRs, untouched here.

## Cure round (PR #364, 2026-11-07) — host fixes in DetectiveHost.tsx only
- **Cure B (flag-OFF data-companion integrity):** a legacy mirror state ("full"|"dock"|"killed") engaged only when holmesFollow is OFF, updated at the base/degradation effect, the case-change latch reset, and the auto-kill judge — the rendered data-companion is flag-branched at the single derivation point, so flag-OFF never reads "berth" again; tier machine + data-follow-tier untouched.
- **Cure D (bench "standing" collapse):** enterMap takes an onMap flag and records bench entry intent only for map-originated interactions (onDown containment, drag attributed by its down point, window wheel + off-map pinch pass false); onPauseConfirmed and the C2/C3 effects keep the unconditional default — heading clicks during the bench no longer arm intent, page-wide follow unchanged.
- **Cure C (zero-overlap, PRODUCT LAW):** every non-solver placement writer (first placement, enterMap, DOCK_ONLY perch) rebuilds forbidden rects fresh and tests Holmes's box before landing (perch scans the other viewport corners, bottom-left kept whenever legal; entry dock measured from the live map element); current-position eviction at the forbidden-rebuild effect and the scroll-end timer re-solves at the last pointer, re-perches in DOCK_ONLY, or burst-hides him (`.detective-host-holmes-hidden`) while a suspension holds — never painted over clue text, never travelling mid-speech. follow.ts untouched.
- **Cure D2 (follow-ON auto-entry at standing; owner PB-1 role model):** with `holmesFollow` ON, the C2 staging effect fires the existing `enterMap` path the moment the stage reaches "standing" — bench + intro are first-entry only, and once play starts Holmes takes his post on the map (entry dock first, follow machinery from there) instead of waiting for a first map touch; flag OFF is unchanged (map-originated intent only, cure D entry semantics preserved). DetectiveHost.tsx only; no stage timings, follow solver, speech, or Watson changes.
- **Cure C-precision (eviction narrowing):** `checkHolmesLegality` judges only settled states — while any motion signal is active (walking, follow telegraph state/timer, entry-pending, stamped travel landing from `applyFollowTarget`, `scrollingUntil`, `cameraBusyUntil`) it arms ONE deferred re-check (`evictionTimerRef`, fresh rebuild + re-entry at the latest motion horizon +30 ms, unmount-cleaned, cancelled when a new landing supersedes the arm) and returns; a settled illegal verdict inside the ~250 ms post-motion window must be confirmed by that re-check before the unchanged act path (re-perch / suspended hide / re-solve at lastPointer) fires — legal at confirm un-hides, never moves him. Bounded exposure: a genuinely illegal settled overlap whose trigger coincides with motion signals waits one defer/confirm cycle (~250–300 ms) before eviction; writer gates untouched, so no NEW illegal landing can be created in that window. Verify-only, no change: burst rects — `measureForbiddenRects` has no burst element and no +scrollY page-frame conversion (every rect is a raw viewport `getBoundingClientRect`), so the frame-unify item was skipped; anchor effect — the map/anchor measure effect never re-derives `holmesXY` from a live rect during scroll or travel, so the travel-guard item was skipped. DetectiveHost.tsx only; follow.ts/companion.ts untouched.
- **Gates on the cured tip:** tsc clean; npm test src 2262 pass / scripts suite pass (npm test exit 0); worker 145 pass; lint-cards GATE PASSED; build:pages exit 0.
- **Cure round 5 (residual diagnosis A–F + berth re-runs):** HOST — the FG-5 judge is no longer fed during follow travel or camera gestures (diagnosis D: the entry glide inside the judged window stepped the tier down at 768; diagnosis F: a pan's own long tasks killed to DOCK_ONLY mid-gesture). Feeding skips the `followTravelEndRef`/`cameraBusyUntil` horizons in DetectiveHost.tsx; the 45/55 FPS thresholds and companion.ts are unchanged, and sustained degradation at rest still kills (the 232 throttle test is the pin). SPECS — `waitArrived` requires a settled berth (two samples ≥250 ms apart within 2 px; a mid-glide baseline manufactured the (a)/(b)/(c)/(d) drifts, diagnosis A/B); follow (d) baselines at SELECTION_READ entry; follow (a) 390 asserts planted with the finger down, then dismisses the lift-tap confirm sheet and re-asserts after burst-return (diagnosis C); the K2 touch gate dismisses a lift-tap sheet before judging phase (diagnosis E); berth FAR/touch tier reads poll 30 s (232's bound) for FG-5 re-qualification latency, and the touch entry drag is a stepped 64 px pan (the 14 px form selected a place and deadlocked the idle wait). Round-5 tip `f3842da`.
- **Cure round 6:** HOST — judge gating now mirrors the legality eviction gate's full motion definition (walk/telegraph timers, entry pending, travel/scroll/camera horizons), so his own berth walks no longer feed the FG-5 tracker on either flag state. SPECS — `waitArrived`'s settle window is 900 ms (a camera-idle re-solve nudged him 12 px inside the 250 ms window); the follow spec's remaining immediate tier reads poll 30 s like berth's. Round-5 result that forced this round: berth touch + 232 green (stepped pan works; the throttled kill still fires at rest), follow (b)/(d) green; FAR/(f)/(a)/(c)/(e) still judge-latched on the VM runner.
- **Cure round 7 (trace diagnosis of round-6 residuals):** HOST — (i) judge window dilution cured: the tracker divides fed frames by wall-clock span, so motion-gated glides read ~34 fps at a true 60 and killed at every landing; `noteGate()` now prunes the tracker windows at every gate transition and SEARCH entry (thresholds untouched, unit test added). (ii) A step-down mid-glide stranded the berth (XY pinned at the perch, placement still "berth", pause consumed): tier recovery out of DOCK_ONLY re-solves once at the last pointer under a live berth claim. (iii) Sheet clicks polluted `lastPointer` (burst-return rejoined him at the dismiss button): pointer memory freezes while the sheet is open, and burst-return rebuilds the forbidden set before solving. SPECS — follow leg-2 arrival requires the settled condition inside its guarded loop; (a) 390 post-dismiss wait polls placement, not phase; closed-state sampler records phase transitions via MutationObserver; berth FAR logs the runner's sustained fps beside its tier poll (below the 55 fps re-qualify floor a latch is a capability wall — FAR's round-6 red run presented 13–19 fps, an environment verdict on that run).
- **Cure round 8 (diagnosis #2):** HOST — the camera-busy horizon now covers a drag's whole duration (pointerdown stamps it, moves with a pointer down re-stamp it); it was only a trailing 120 ms stamp and `startGesture` never fires during a single-pointer SEARCH_IDLE pan, so the judge ate the pan's own long tasks (K3 pan, confirmed from trace). SPECS — the K2 touch gate's catches name a destroyed-context poll error as an environment failure (the 360×640 page died of renderer loss after the reset drag; the round-5 sheet dismiss was proven working in that trace), and the K3 tap failure of round 6 was attributed from its trace: the step-down landed 13 ms before the tap press — the dilution kill, cured host-side in round 7 (K3 tap green on the round-7 tip).
- **Merge-up 2026-11-08:** main @ `9e49da3` (PR #365, GeoDetective End game) merged into this branch. Only conflict was this file (kept this branch's record, per the per-branch convention); `playwright.config.ts` auto-merged. The PR's own diff is unchanged in substance — merged-tree gates re-run before the census.

## Session-5 merge-up — main @ 63d8286 (PR #372, Watson-station cure) merged in 2026-11-08 ~14:0x CST
- Single content conflict was this file: BOTH records kept — this branch's PB-1 record above, and #372's record in full below under its own heading.
- Auto-merged cleanly: DetectiveHost.tsx (branch follow rewrite + #372 comment hunks), handbook ch.10, detective-staging.spec.ts (disjoint hunks), detective-state.ts + tests + endings/replay/sound/visibility/watson-walk specs (main side).
- STALE-CLAIM FIX (records): the old 'Blocked / not done' block claimed E2E execution + screenshots ENVIRONMENT-BLOCKED with renderer crashes and disk quota exhausted. That claim is SUPERSEDED — the Chromium launch-policy outage recovered (lane 1's finisher + the step-0 CSO sweep ran the full detective set on main @ 63d8286: 55/57 pass, the 2 failures being the known pre-existing #371 endings windows). E2E on the merged tree is re-run as this lane's census gate; see GATES-STATE.md session-5 section.

## Session-5 spec cures F5/F4/F3 (2026-11-09, diagnosis F1–F7 of record — spec-only, no assertion value changed, no production code touched)
- **F5 — `tests/e2e/detective-swap.spec.ts` (`0e854b8`):** the K5 in-page sampler read placement + companion mode only from `detective-host` (Watson-only on this branch, absent in SEARCH, so placement read `null` forever and the kill-invalidation was blind). Sampler now reads `detective-follow-root ?? detective-station ?? detective-host` (the detective-u10.ts carrier pattern); both `placement` and `mode` ride the same repaired `host` read. **Re-verification: FAIL (cure-failed, not iterated).** The seam is un-blinded — both cases completed clean on attempt 1 and placement read `berth` in all 26 comparable buckets — but the newly-reached timeline comparison now fails at spec:383: transit `gy` deviation 3 vs ≤1 allowed (test 48.9 s, run 64 s). Full log: `~/workspace/meridian-364-evidence/spec-cure-f5-rerun.log`.
- **F4 — `tests/e2e/detective-companion.spec.ts` (`0e39b31`):** `sampleBerth` gated every frame on the same dead `detective-host` selector; repaired to the same follow-root ?? station ?? host chain (the K2 touch grid shares this sampler). **Re-verification: FAIL (cure-failed, not iterated).** Mouse :660 produced the identical counter signature (`berths=0 remotes=6 hides=0 samples=0 remoteSamples=0`, `res.berths` Expected ≥2 Received 0 at :671; test 31.0 s, run 179 s incl. lock wait) — the mouse leg's blindness is therefore not (only) this sampler seam, and needs fresh diagnosis rather than a second blind edit. Touch :634 progressed past its first grid point (berth + clearance sampled) then failed on the known environment-labelled crash (`page lost during the post-drag poll (environment)`, :389) — explicitly out of this cure's scope. Full log: `~/workspace/meridian-364-evidence/spec-cure-f4-rerun.log`.
- **F3 — `tests/e2e/detective-follow.spec.ts` :593 only (`6719133`):** the (f) "sweep" ended parked for 600 ms — past the 350 ms desktop pause law and the 460 ms confirm chain — so Holmes lawfully berthed mid-sweep and his glide read as hold drift. Stimulus repaired only: the pointer keeps sweeping between the sweep end points for the same 600 ms window and the hold read lands right after a move. Hold assertion (≤8 px), the hover-pause second segment, and every other test in the file are byte-identical. **Re-verification: PASS** — `detective-follow.spec.ts:593`, 1 passed (34.8 s test, 38 s run). Full log: `~/workspace/meridian-364-evidence/spec-cure-f3-rerun.log`.
- Deliverable record: `~/workspace/meridian-364-evidence/spec-cures-f3f4f5.md`.

## Session-5 host-cure lane — F4 seam-2 + F7 re-check + F1/F6 (2026-11-09, parent redirect ~06:2x CST)
- **F4 seam-2 — `tests/e2e/detective-u10.ts` (`075c88a`):** the shared helpers `currentPlacement` (:454) and `companionMode` (:463) still read `detective-host ?? detective-station` — the second seam of F4's blindness (seam 1, the companion spec's private `sampleBerth`, was cured in `0e39b31` but K2 mouse stayed blind). Both helpers now read `detective-follow-root ?? detective-station ?? detective-host`. Spec-only, no assertion value changed. **Re-verification: K2 mouse :660 PASS (berths=2, samples=6 — was 0/0); K3 :691/:865/:899/:937 all PASS (pan holds the berth); swap :271 PASS; staging :483/:745 PASS; K2 touch :634 still fails on the known environment-labelled page-lost crash (:389), out of scope.** Full record: `~/workspace/meridian-364-evidence/host-cures-f7f6f1.md`.
- **F7 isolation (interim, no product cure applied):** temporary judge instrumentation (saved as `~/workspace/meridian-364-evidence/f7-wip-diff.patch`, tree reverted clean) showed the tracker fed ≈60 fps with zero gated ticks / zero noteGate calls / zero dropped long tasks during the berth:347 throttle window in both a library probe and a test-runner replica, while unmodified main killed on fps in 37.9 s the same morning. STEP 2 re-runs berth:347 on the seam-2 helpers before any product edit — see the deliverable.
- **F7 STEP 2 — re-check + cure attempt 1: FAILED VERIFICATION, REVERTED, lane STOPPED.** Berth:347 re-run on seam-2 helpers (clean build `e423a91`) still failed identically (`"killed"` vs `"full"`, 120 s at :382) — F7 is not sampler-mediated. Cure attempt 1 (judge effect only: unconditional feeding restored — judgeBusy gate, noteGate call sites and the long-task start filter removed; thresholds untouched) made **berth:347 PASS (35.1 s, latch fired, tier restored, landed (503,410))** but **K3 pan (:899) FAILED** — verbatim: `PB-1: a pan must not cancel the berth back to a dock — he stays` / Expected `"berth"` / Received `"dock"` (the pan's own jank false-kills under unconditional feeding — the rounds 5–8 gates' original problem). Cure reverted completely, tree clean, dist rebuilt to `e423a91`; diff preserved at `~/workspace/meridian-364-evidence/f7-cure-attempt1-diff.patch`. F1/F6 NOT attempted (protocol stop). Full record: `~/workspace/meridian-364-evidence/host-cures-f7f6f1.md`.
- **F7 design cure (attempt 2, parent-adjudicated) — FAILED VERIFICATION, REVERTED, lane STOPPED.** Phase 1 (one instrumented REAL berth:347 run, local-only debug build): the failure reproduced (`"full"` for 120 s) with **zero gated ticks in every 5 s bucket of the throttle window** (fed ≈55–60 fps throughout, mounts=1; gates fired only pre-throttle: 116 gated by walk/travel/scroll/camera/telegraph, noteGate mount 1 + transitions 5) — the starvation did not reproduce under instrumentation on a quiet machine (the brief's Heisenbug case: rate-8 slows CPU work but not rAF delivery), so the design proceeded from the code path + attempt-1 evidence. Attempt 2 (never committed): unconditional frame feeding restored; `noteGate` pruning kept ONLY at the follow-travel horizon's closing (never at mount, never at camera/scroll/walk/telegraph/entry); kill verdict suspended INSIDE the tracker while the camera-busy horizon is open (`companion.ts` `setVerdictSuspended`, thresholds untouched) + `judge()` held while the horizon is open; long tasks dropped only when wholly inside the travel/camera horizon. Gates: tsc clean; companion unit 18/18 (2 new suspension tests). **Verification in ONE batch: berth:347 PASS (32.1 s — latch fired, tier restored, landed (505,410)); K3 :691/:865/:937 PASS; K3 pan :899 FAIL — verbatim identical to attempt 1 (`PB-1: a pan must not cancel the berth back to a dock` / Expected `"berth"` / Received `"dock"`).** The kill fires after the gesture ends, on the accumulated window — the pan's jank has not aged out at verdict time on this VM. Cure reverted completely, dist rebuilt clean (buildId `e34016d` as emitted), **STOPPED — no third design without the parent's adjudication; F1/F6 NOT attempted.** Full record: `~/workspace/meridian-364-evidence/host-cures-f7f6f1.md` ("DESIGN CURE" section).
- **F7 attempt 3 (parent-adjudicated: unconditional feed + prune ONLY at camera-busy close, no verdict suspension, long tasks dropped only when wholly inside travel/camera horizon) — FAILED VERIFICATION, REVERTED, lane STOPPED — FINAL for the F7 design loop.** Implemented exactly as adjudicated in `DetectiveHost.tsx` only (diff preserved at `~/workspace/meridian-364-evidence/f7-cure-attempt3-diff.patch`, never committed; `companion.ts`/`follow.ts` untouched). Unit gates: `npx tsc --noEmit` clean; `npm test` exit 0 (final suite 2275/2275). Cure build exit 0, buildId `cb3a569` (HEAD-derived). **ONE-batch verification (one flock session, `--workers=1`): berth:347 GATE FAIL (2.6 m) — verbatim: Expected `"killed"` / Received `"full"`, timeout 120000 ms at spec:382; K3 :691 PASS (31.4 s), :865 PASS (21.7 s), :937 PASS (21.6 s), :899 GATE FAIL (25.9 s) — verbatim identical to attempts 1–2: `PB-1: a pan must not cancel the berth back to a dock — he stays` / Expected `"berth"` / Received `"dock"`; berth:236 WITNESS ONLY FAIL (2.0 m) — verbatim: `touch pause must berth (phase=SEARCH_IDLE, placement=dock, tier=null)` / Expected not null / Received: null at spec:338 (not a gate for this phase; F6 not touched).** No VM reboot or error-122 occurred during the batch (boot 06:51 UTC preceded it; up 18 min at batch end), so no environment re-run applied. Cure reverted completely, dist rebuilt clean (exit 0, buildId `cb3a569`), tracked tree clean. **STOPPED — Phases B (F1) and C (F6) NOT attempted, Phase D close-out did not run; per the brief this stop is FINAL for the F7 design loop (no fourth design; coordinator parks F7 and moves the lane to F1 → F6).** Full record: `~/workspace/meridian-364-evidence/host-cures-f7f6f1.md` ("ATTEMPT 3" section).
- **F7 — OPEN PANEL ITEM (explicit record, coordinator note 2026-11-09):** F7 (FG-5 kill-feed, `detective-berth.spec.ts:347`) is a **priced known defect** carried to the panel as an OPEN item — its price tag is the discriminator (unmodified main kills under the identical throttle stimulus in ~37 s; this branch does not) plus the three-attempt record above (attempt 1: unconditional feed → K3 pan false-kill; attempt 2: verdict suspension → post-gesture kill on the accumulated window; attempt 3: window reset at camera-busy close → both gates failed). It is **NOT a blocker being polished**: the design loop is CLOSED and **no fourth design will be attempted in this lane**. The panel judges PR #364 with F7 open and priced.
- **F1 LAND (parent adjudication 2026-11-09 ~01:42 CST) — FAILED VERIFICATION, BOTH COMMITS REVERTED, lane STOPPED (2026-11-09).** Landed as briefed in two commits: spec `4df3650` (`clueOverlap` visibility-aware: hidden class / computed visibility hidden / opacity 0 = not painted = no overlap; painted overlap still fails at 0 px², no thresholds changed) and product `9c888e8` (attempt-2 sheet-close hold from `f1-cure-attempt2-diff.patch` + reveal-on-arrival backstop in the `holmesXY` landing effect, `DetectiveHost.tsx`). Negative control PASSED as designed: on the un-cured dist (buildId `fb2cadf`) the touch test still FAILED with the painted overlap **7247.556640625**. Unit gates on the landed tree: tsc clean; build exit 0 (buildId `660c88e`); `npm test` exit 0 (scripts 1021 pass / 0 fail, src 2275/2275). **Verification batch (one flock session): the GATE `detective-follow.spec.ts` touch test FAILED with a NEW signature — `planted: x drifted` / Expected ≤ 8 / Received 164.04092407226562 at `assertPlanted` (post-dismiss sample): the overlap assert now passes, but the cure's lawful re-place moves him ~164 px from the `landed` rect the same assert pins at ≤ 8 px drift.** Sheet-burst (F2 evidence) FAILED `clue overlap during travel` Received 4138.2161293029785; rest-verify PASS (parked, drift 0, overlap 0); K3 :691/:865/:899/:937 all PASS. Per the brief's Step C rule, both commits were reverted (`aea7974` product, `f5ba4e9` spec — both files byte-identical to the starting tip `50761c6` afterwards), dist rebuilt clean (exit 0, buildId `f5ba4e9`, `_shell.html` present), tracked tree clean. **STOPPED — no further F1 variant in this lane; the drift-vs-re-place conflict in `assertPlanted` is for the parent/panel.** Full record: `~/workspace/meridian-364-evidence/host-cures-f1-f6.md` ("LAND" section); batch log: `f1-land-batch.log`.
- **F1 cure (sheet-close legality re-judge) — FAILED VERIFICATION, REVERTED, lane STOPPED (2026-11-09).** One attempt, exactly as briefed (`DetectiveHost.tsx` only, +47/−2, never committed; diff at `~/workspace/meridian-364-evidence/f1-cure-attempt1-diff.patch`): a `sheetClosed`-transition effect (stale scroll/camera horizons zeroed, forbidden rects rebuilt fresh, legality check run as a post-burst verdict) + the C-precision confirm deferral revisited for the post-burst state only (post-burst counts as the confirming measure and bypasses the settled gate; every other trigger unchanged). Pre-cure probes this session (instrumented `probe-f1.mjs` replicas, clean dist): the +568 dismiss scroll is a single native scroll event at dismiss +56 ms with NO JS scroll call — the sheet button measures at viewport y=1311 (the `fixed` sheet sits inside a transformed ancestor), so the spec's locator click scrolls the page to reach it, putting Clue 1 under the stored berth before Holmes remounts. Gates on the cure tree: tsc clean; build exit 0 (buildId `19f91e4` as emitted). **Re-verification: FAIL** — `detective-follow.spec.ts:341` alone under the flock, `--workers=1`: test 33.0 s, run 42 s, verbatim identical to pre-cure: `clue overlap while planted` / Expected 0 / Received **7247.556640625** at spec:199 from spec:416. No VM reboot or error-122 occurred. Cure reverted completely; dist rebuilt clean (exit 0, buildId `19f91e4`); tracked tree clean. **F6 NOT attempted** (protocol stop on a failed cure — shared file). Full record: `~/workspace/meridian-364-evidence/host-cures-f1-f6.md`; rerun log: `host-cure-f1-rerun.log`.

---

# BRANCH_STATUS — feat/watson-station (PR #372 record, merged to main @ 63d8286 — kept verbatim from origin/main)

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
`tests/e2e/detective-endings.spec.ts` (gap-closure round),
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
- [x] PR opened — PR #372 (opened by the pipeline finisher; the
  builder brief forbade the builder from opening it)
- [ ] Merge — on the owner's word / coordinator only, never the builder

## GATES STATE (finisher session, 2026-11-08 — updated after every gate)

Finisher: pipeline-finisher subagent (lane 1 of the owner's sequential
pipeline law). Base verified against **origin/main `9e49da3`** — the
local `main` ref is stale (#361-era `97d1dcf`); origin/main IS an
ancestor of this branch and the true branch diff is 11 files (709+/185−, measured at 3f3eaf0; later commits are docs-only).

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
- [x] Gate 4 — PR opened: PR #372; the parent's routing decision
  (a) is recorded — the N2-endings failure is routed to its own
  follow-up (issue #371) and this PR proceeds with the failure
  recorded honestly in the PR body.
- [ ] Gates 5–7 — panel + DevEx + benchmark ran on `3f3eaf0`
  (panel 13/13 in: 1 APPROVE, 10 APPROVE-WITH-NITS, 2 BLOCKs both
  adjudicated pre-existing/out-of-scope — game audio → PR #370/PR 2,
  game player → issues #371/#373 + PR #370/PR 2; DevEx records cure
  applied after the panel, confirmation re-vote follows); merge
  awaits the panel verdict on the cured tip + the parent's merge
  call on the standing audio BLOCK.

> **SUPERSEDED — records cure, 2026-11-08 (pipeline finisher).**
> This capsule's per-gap run statuses below are STALE: they were written
> before the re-runs and claim several gaps are "NOT YET RUN", nit-5 is
> "not taken", and the Chromium outage is current. All three are wrong
> now. The **GATES-STATE section above is the current record**: GAP 4
> (N7) RUN VERIFIED PASSING; GAP 2 endings windows RUN — FAILED on the
> pre-existing CELEBRATE/FAIL_READ overlap (issue #371); GAP 2
> guessing-chain + GAP 3 (N6) RUN VERIFIED PASSING (walk spec 9/9);
> nit-5 MEASUREMENT TAKEN (maxOverlap 0 px²); the Chromium outage is
> OVER. Where this capsule and GATES-STATE disagree, GATES-STATE wins.

## Gap-closure round (2026-11-08, Silo QA PASS-WITH-NITS follow-up)

Test-only pins for Silo QA's N1–N7 gaps; zero production-code changes.

- [x] **GAP 1 (N1) — pinned + PASSING** (`49f210d`): unit test
  "station law past guessing: THINKING_BEAT, FAIL_READ, POUT,
  DEBRIEF and CELEBRATE never dock Watson (owner ruling 2026-11-07)"
  in `detective-state.test.ts` — Watson's placement asserted
  "station" in all five phases (CELEBRATE across all four
  choreography steps). Full suite: `npm test` 2268/2268.
- [x] **GAP 4 (N7) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1a)** (`35db604`): endings
  spec "WIN in 2" asserts, after a 2 s settle, that no
  `case-137/clue-3.mp3`, `clue-4.mp3` or `clue-5.mp3` appears in
  either the play record or the network request list. RUN: verified
  passing inside the Gate 1a endings run — the test reached and
  passed this assertion before the run's N2-window failure (absence
  checks fail loudly, so reaching the absorb proves them).
  (Correction, same day: an earlier version of this capsule
  claimed this and the N2
  endings windows were PASSING on a "2 passed" endings run.
  That was a misread of truncated, piped output: the run's full
  output shows **2 failed**, both at browser launch. No endings
  test has passed in this round.)
- [x] **GAP 2 (N2), endings half — pinned, RUN (windows FAILED on the pre-existing overlap, issue #371)**
  (`35db604`): audit windows "WIN celebrate→debrief @ endings"
  (9 s, opens at CELEBRATE) and "FAIL fail-read→pout @ endings"
  (12 s, opens at the final miss) absorbed through `AuditTrail`
  at 0 px². RUN (GATES-STATE Gate 1a): both windows absorbed
  overlap up to 4,777.5 px² from Holmes's pre-existing
  celebration/fail-read placement (issue #371).
- [x] **GAP 2 (N2), guessing-chain half — pinned, RUN VERIFIED PASSING (walk spec 9/9, GATES-STATE Gate 1b)**
  (`368c201`): in the watson-walk main test (all 3 widths), a
  12 s audit window "guessing chain selection→note→ask-next"
  opens once SELECTION_READ is live + 300 ms (the documented
  ~200 ms guess-commit FLIP exclusion kept exactly), with a
  trace assertion that SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING were sampled in order and a play-order subsequence
  (name → suspicion → ask-next → clue-2). RUN: the window
  absorbed at 0 px² at all three widths.
- [x] **GAP 3 (N6) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1b)** (`368c201`): new
  watson-walk test "watson walk: tap on Watson MID-WALK is
  ignored — one figure, walk arrives, held clue read fires
  exactly once (phone 390)". Pins the shipped behaviour: during
  a speech-gated walk the replay cue is hidden and the figure
  cluster is pointer-events:none, so the tap is a no-op — walk
  still "walking" after the tap, exactly one
  `[data-detective="watson"]` in every walking sample (never >1
  anywhere), clue-2 read + ack-2 each exactly once. RUN: passing
  in the Gate 1b walk-spec run (9/9).
- [x] **OBSERVATION (nit 5) — MEASUREMENT TAKEN: maxOverlap 0 px² (GATES-STATE Gate 2).**
  The finisher re-ran the probe (audit sampler + per-frame
  phase, watsonWalk OFF via `fulfillFlagsStaging`, 390px, two
  4 s windows, 9,600 pair samples): maxOverlap 0 px² (log
  `e2e-nit5b.log`). The probe's strict READING gate never latched
  in the walk-off flow, so the windows are recorded under their
  actual phases in GATES-STATE Gate 2.
- **Chromium outage — RESOLVED (see GATES-STATE Gate 1).** At the
  time this capsule was written, every NEW Chromium launch on
  this VM failed with `Hatch WebGL domain policy is required
  for browser startup` (chrome_main_delegate.cc:1283) — a
  runtime policy delivery break, not a code issue. The finisher
  re-test found the outage OVER on the real spec path
  (Playwright + bundled chromium-1243 launches and renders).
  The re-runs prescribed here are DONE — GATES-STATE Gates 1a/1b
  record the results. Historical detail, kept for the record:
  the endings run started 10:42 (VM clock) **failed both tests at
  browserType.launch** with exactly this error (full output in
  the run log; error contexts under `test-results/`); a bare
  `chrome --headless --dump-dom about:blank` reproduced it and
  was still failing at 11:38. The binary's strings show it
  requires `--hatch-webgl-allowed-domains-file` + `-sha256`
  switches that are not present on disk. Re-run prescription
  (DONE):
  `npx playwright test tests/e2e/detective-endings.spec.ts --workers=1`
  then `npx playwright test tests/e2e/detective-watson-walk.spec.ts --workers=1`
  (read the full reporter output — a piped `tail` masks the
  playwright exit code; that masking caused the correction
  above).
- [x] Gap-round gates: `npx tsc --noEmit` clean ·
  `npm test` PASS 2268/2268 · `npm run test:worker` PASS 145/145 ·
  `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` PASS (exit 0)
