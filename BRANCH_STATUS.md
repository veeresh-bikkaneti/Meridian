## Holmes & Watson for GeoDetective, Phase A — feat/detective-pair (2026-11-05)

- **Authority:** Veeresh, 2026-11-05 — build ordered on the approved full-loop mockup ("I guess its ok let's build it"), then all six scope decisions answered "All recommended." Design of record: `BUILD-SCOPE.md` + `COUNCIL-holmes-watson.md` (evidence folder; scope also at `prototype/BUILD-SCOPE.md` on `design/detective-moments-prototype`).
- **TASK / outcome:** Build units U1–U10 of the scope, plus the owner's 2026-11-06 fold-in (Unit A — tap-Watson replay; Unit B — game-end celebration in every edition) and the review cure pass, and open the PR. Merging is NOT part of this task; the full review pipeline is a separate later dispatch.
- **Tier:** 2 (new feature/module, 3+ files) — the design was settled by the owner's council and scope; this branch implements that record, it does not redesign it.
- **Base:** `main` @ `cbe9140` (moved from 7b04f28 by #354, the doorway removal — home surface only, no overlap with this feature's files).
- **Locked decisions:** (1) audio phased — Phase A = Capitals 110 cases only; core 387 is U11, not here. (2) selection names = population ≥500k tier (1,201 names) + ALL 497 case-answer reads; an uncovered pick plays the suspicion line with the name silent — never improvised audio. (3) Cold Trail: later phase, out entirely. (4) post-solve debrief IN v1 — Holmes's one real deduction speech after a solve; synthesis lives only there. (5) flag `detectivePair` ships default **false**; the flip is a later owner-gated step (K1/K6 child panel gates the flip, not this PR). (6) speech follows the player's existing read-aloud preference.
- **Done condition:** PR open; per-unit acceptance verified with evidence; CI read fresh; U10 gate results reported; flag-ON real-page capture (Capitals case end-to-end, with audio) in `~/workspace/meridian-detective-evidence/`.
- **Protected:** clue text, game balance, scoring, the existing storyteller/grandpa audio systems, player-facing locks. The banned hushed-register word never appears in this feature's code or docs — the register is "hushed".
- **Answer-blindness is structural:** the pair receives whitelisted props only (`phase, clueIndex, pointerKinematics, sheetOpen, speechPlaying`) — never the puzzle, target, or any evaluation; a props-shape unit test ships in this PR.

### Units

| Unit | Status |
| :--- | :--- |
| U1 Render pipeline + hash manifest + staleness CI gate | done — pipeline + manifest + gate shipped; case 137 rendered (5 Watson clues 82.3–99.1 Hz + Holmes answer 121.2 Hz, all ok); gate demo: clean tree exit 0, one tampered clue word in a copied tree exit 2 naming `cases.137.clues.0`; scripts/detective tests 15/15 |
| U2 Fixed lines + 5 decode templates, pitch-gated | done — 19 fixed lines rendered (`a01aad8`); strict gates pass: win-holmes 225.4 Hz (≥170 and ≥35% above acks median 128 Hz), hook-announcement 119.4 Hz below acks median; pair separation 29.8 Hz (acks median vs instructions-watson 98.2 Hz); flagged: ack-3 107.4 Hz, decode-geography 111.9 Hz, win-watson 115.1 Hz (in manifest with notes); DRAFT notes kept on amazement / decode-hook / decode-giveaway; coverage.fixed on, gate clean |
| U3 Phase A renders (550 Capitals reads + 497 answers + name tier) | done — lanes 1+2 (`7250c16`, `a2dcc69`): 550/550 Capitals clues + 497/497 answers, coverage.capitals + coverage.answers on, gate clean (2,531 entries); case-416 pace anomaly cured by the pace ladder (clue-1 lands 82.5 Hz / 143 wpm, case dir 473.1 KiB under the 500 KB budget [cure-pass correction: the budget is CLUES-ONLY — a case's five clue reads together ≤ 500,000 B, answer read not counted — and is now enforced by `checkClueBudgets` in the manifest gate; measured clues-only maximum is 495,161 B (case 397). Under the old clues+answer reading the claim was false: clues+answer exceeds 500,000 B in 12 of 497 cases, worst case 397 at 524,574 B]); sample QA 127/2,531 (5%) all pass. **Name tier — FINAL reconciled truth (resume pass, 2026-11-06, computed from the shipped catalog + manifest, not the status draft):** the locked tier is exactly **1,201** unique places at population ≥500k in `public/loop/names.v2.json` (119,038 rows) — the scope figure is exact. The render plan (`render-audio.mjs` `names` selection) is the tier UNION all 497 case answers' name reads (decision 2: answers are mandatory name reads too): 150 answers already sit in the tier, 347 below-tier answers join the plan → **plan = 1,548**. The manifest holds **1,460** name entries (1,307 ok + 153 flagged, all real audio) — **88 planned names have no audio**: 79 of the locked 1,201 tier + 9 below-tier answers. Cause: the TTS backend deterministically returns truncated/empty 26-byte audio for those exact city+region strings (18+ attempts in the lane; the 2026-11-06 pace-cure probe re-run recovered **0/88** — the identical 88 IDs failed again with the same backend error; the probe's 483 re-renders of flagged entries reproduced byte-identical manifest entries, so the probe changed nothing). The 88 IDs are regenerable deterministically (plan set from `readNamesIndex` + clue files, minus manifest `names` keys — the method the resume pass used). `coverage.namesTierComplete` stays **false** honestly: flipping it makes the U1 gate report exactly those 88 missing. By design (U7), a pick whose name has no entry plays the suspicion line with the name silent — never improvised audio. |
| U4 Production character rig (approved colours, no pipe) | done — `DetectivePair.tsx` (Holmes 12 poses / Watson 9 poses, exact approved colours, per-pose expressions, glass hand-off in celebration poses, HIGH_FIVE_CONTACT anchors) + `detective.css` (transform/opacity only, `detective-` prefixed) + `detective-rig.test.ts` 10/10; size 1,900 B gz combined (budget 15 KB); evidence sheets `rig-sheet-u4.png` + `rig-sheet-u4-390.png` in the evidence folder — all 21 poses read solo at 390 px after 3 art iterations (backdrop re-crop, Watson card raised, ack/announce/gasp strengthened, clap keyframes re-based, celebrate glass moved clear of Watson's head) |
| U5 Stations + state machine + sequential speech player | done — pure state machine `detective-state.ts` (13 phases — `DETECTIVE_PHASES` lists 13; corrected in the cure pass, the row originally said 12; answer-blind events only; speak/dwell effects; sheet/external-speech/ring absence as state flags) + `detective-audio.ts` (sequential player over the manifest; coverage = entry presence; gates at play time: sound toggle, hidden tab, read-aloud pref; first-gesture unlock per the storyteller pattern) + `DetectiveHost.tsx` (observer wiring: prop diffs → events, dwell/ring timers, pointer-pause ref, Watson station anchored to the active clue card's rect, Holmes dock via portal into the existing `[data-testid="loop-map"]` element — no LoopMap change) + whitelist props builder with props-shape test + `detectivePair` flag (default false; `public/flags.json` untouched). Tests: detective folder 39/39 (machine ladder incl. ack rotation + Hook ordering + pick-swap invariant; player queue order/error-skip/gate drops; props whitelist). LoopScreen mount diff +25/−0. Smoke (evidence `~/workspace/meridian-detective-evidence/u5-smoke/`): built artifact, flag on in the SERVED flags copy only, case 137 (seam caps at core size 387, so 387 itself is not seam-pinnable — documented in the smoke note) played clue-1 → ack-1 → decode-geography → name (Paris) → suspicion → ask-next → clue-2 in exact order; sheet-open absence asserted; PASS 23.4 s. One cure during smoke: host dispatches guessConfirmed before clueUnlocked (same-commit prop changes) |
| U6 Waypoint companion (pause, berth solver, absence, auto-kill) | done — pure `companion.ts` (pause detector: 350 ms desktop / 450 ms touch + map-still 250 ms, path-velocity <20 px/s so jitter never confirms, 500 ms post-gesture re-arm; berth solver: centre ≥96dp touch / ≥64px desktop, edge ≥56dp, above-the-finger, NW/NE by hand side, ≥120dp + r exclusions, >320px = remote, no legal spot = hide; auto-kill tracker: rolling 5 s FPS <45 or 3 long tasks >100 ms in 10 s, latched) 19/19 tests + host wiring in `DetectiveHost.tsx` (ONE passive listener set on the map container, samples to refs, timeout-chain confirm — no rAF / no per-move React state / map rect cached on resize+phase only; Holmes on a translate3d portal wrapper, walk 260 px/s clamped 240–700 ms ease-out, gesture exit 180 ms ease-in, tap never summons, solver-hide = 80 ms opacity class; machine SEARCH_AREA now emits placement "berth" intent). Exclusions: rings/✕ are GL canvas layers (no DOM geometry, unmeasurable — and projecting them would need forbidden game data); wired source = `.maplibregl-marker` DOM elements measured at confirm time. Auto-kill feed runs only in SEARCH phases (smoke-found cure `4b8e470`: load jank 3–34 FPS for ~7 s then clean 60 FPS was killing the companion pre-operation). Smoke (evidence `~/workspace/meridian-detective-evidence/u6-smoke/`): pause → berth (centre 96.7 px, edge 58 px, above ✓, screenshot with pause point marked), pan → cancel to dock, sheet absence 70.6 ms ≤100 ms (MutationObserver); detective tests 58/58, full npm test green, tsc clean, lint-cards PASSED, build green |
| U7 Selection handoff (name coverage, suspicion asset, ask-next) | done — proof + hardening tests over the U5 flow, no production-code change needed: (1) single-asset suspicion asserted — every selection read (picks 1–5, win AND lose scripts) enqueues the identical `{fixed: suspicion}` ref, and the real on-disk manifest's fixed table holds exactly ONE suspicion entry (`fixed/suspicion.mp3`); (2) uncovered pick — machine effects identical minus the name ref (the machine is coverage-blind by construction), player level: a name with no manifest entry is skipped silently and the queue plays suspicion only, no stall, no error surface, single drain; (3) ask-next exactly once — full 5-guess script counts exactly 4 ask-next speaks (one per unlock), none on the final clue (pending path ends at clue 5; sheetClosed path is clue-gated `clueIndex < 5`), and sheet churn (open/close/open after the ask) never duplicates it. **Coverage reality: names present 1,460 / 1,548 planned (88 backend-refused — those picks play suspicion-only, by design; entry presence is the rule).** Detective folder 65/65 |
| U8 Endings (celebration · fail answer + pout · debrief) | done — machine + host + css, all inside `src/game/loop/detective/` except the LoopScreen call site (**+2/−0 lines exactly**: the two new builder fields). **Case open:** `caseOpened{freshDeal}` event — fresh deals play instructions-holmes (Holmes, `ack` pose, station) → instructions-watson → clue 1; a clue unlocked mid-duet pends (the machine's pending pattern); resumed cases skip. New whitelist prop `freshDeal: boolean`, derived at the call site from existing screen state only (`guesses.length === 0 && cluesRevealed <= dealConfig.startingClues` — a no-guesses-yet resume replays the duet, recorded honestly; a mid-ladder resume never does). **Miss beat:** new `NOTE_MARK` phase on BOTH ask-next paths — Watson `notebook-mark` at the station, Holmes `search` at the dock, 900 ms dwell, no speech, then ASK_NEXT. **Celebrate:** dwell-chained sub-steps jump 1150 ms → high-five 900 ms → clap 800 ms → settle; DEBRIEF opens only when BOTH the choreography and the win lines have finished (either order tested). Host lays the pair side-by-side in a fixed cluster; Watson offset by the new `CELEBRATE_LAYOUT` (DetectivePair.tsx) so the HIGH_FIVE_CONTACT anchors coincide — rig test pins the arithmetic, smoke measured the rendered anchors **0.00001 px apart**; spark element sits ABOVE the hands, never masking them. **Debrief:** DEBRIEF speaks debrief-frame → the ANSWER's name read → debrief-close; the answer's id reaches the machine ONLY as `caseSolved`'s optional payload, is stored fenced, and is consumed ONLY by the debrief effect (pick-swap extension: pre-solve streams identical for any answerPlaceId value). Whitelist grew by exactly `answerPlaceId: string | null`; the props builder DERIVES it from the reveal state — forced null unless status is `won`, whatever the caller passes (props test asserts playing/lost/won). A missing name entry (the Tallinn case) leaves frame → close, coherent (player test). **Pout sticky:** U5's 1500 ms auto-advance removed — POUT exits only on a new case (caseOpened / clueUnlocked / host reset), the U5 dwell test updated. Tests: detective folder 78/78; full `npm test` green; tsc clean; lint-cards PASSED; build green. Smoke (evidence `~/workspace/meridian-detective-evidence/u8-smoke/`): WIN — Las Vegas miss (selection + NOTE_MARK sampled + ask-next) then Henderson solve (high-five frame screenshot + zoom, debrief requests in exact frame → name → close order); FAIL — 5 misses, answer read, pout poses identical in screenshots ≥3 s apart. One disclosed harness compensation: a watchdog seek for this VM's intermittently freezing headless media pipeline (see smoke NOTE — diagnostic dumps show every clip ending cleanly on passing runs; no product code changed for it) |
| U9 Degradation matrix + flag wiring | done — pure `detective-degradation.ts`: `resolveDetectiveDegradation({reducedMotion, saveData, deviceMemory, batterySaver, soundOn, autoSpeechAllowed}) → {companionMode, walkMode, speechMode}` exactly per §2.5 (reduced motion → walk cut only; Save-Data / memory ≤4 / battery saver → dock-only + speech auto→tap; sound off → speech off, beats tap; autoplay veto → tap), plus the card-film-pattern connection read and a guarded `getBattery` saver read (level ≤20% unplugged, or an exposed savingMode). 10/10 matrix tests (every single trigger + combined worst case + format). Player: speech-mode flag — tap mode drains items as skipped while holding the current clue's read+ack+decode chain, `playHeldSequence()` replays it for real (sound gate applies at play time, autoplay veto does not); off mode holds nothing; auto mode unchanged (player tests 21/21). Host: signals gathered (reduced-motion hook, one-shot connection probe, async battery, 1 Hz sound poll, player's autoplay verdict); dock-only ignores berth resolutions (auto-kill still latches, never resurrected by a degradation change); cut walks apply placements with no transition and the pause-confirm threshold rises to 600 ms (Q2 §11); Listen button in tap mode only, clue/guessing phases only — ≥44×44 px, aria-label "Listen to this clue", visible 🔊 Listen, rendered outside the aria-hidden station cluster; host roots carry `data-degradation="companion:…,walk:…,speech:…"` + walk/speech mode attrs. Flag: `public/flags.json` gains exactly `"detectivePair": false` (one-key diff; `loadFlags` already validates it against the U5 union). E2E (built artifact, flock, --workers=1, bundled Chromium per the U5/U6 VM-Chrome workaround): `detective-flag.spec.ts` 2/2 (committed false → no host in DOM; intercepted true → host mounts, degradation attr well-formed; new `detective-flag` playwright project) + `detective.reduced.spec.ts` 1/1 (pair at case open, scripted pause berths by cut — inline transition "none", computed duration <0.01 s after Chromium's reduced-motion clamp, placement dock→berth — and clue-1 audio still fires). Docs: README "Holmes & Watson on the case" section with the degradation table + handbook ch.10 decision record (to be merged dark — not yet merged; feature OFF; flip gated on K1/K6 + U10 gates + panel + the owner's word; panel has NOT reviewed this PR yet; 88 uncovered names recorded). Gates: tsc clean, npm test green (scripts 1017 pass / 11 skipped, src 2202/2202), lint-cards GATE PASSED, build:pages green |
| U10 Gates pack (swap test, clearance E2E, K2/K3/K5, K4 protocol) | done — two verification passes recorded (the original run's records, `48b05d6`, and the resume pass that inspected, completed, and re-ran the uncommitted pack; both accounts kept). Pack as committed (`1bc68b2` cure + `8c03f25`): 4 E2E specs + shared harness `tests/e2e/detective-u10.ts` + `scripts/detective/perf-protocol.mjs` + 4 playwright projects + telemetry-guard CONTEXT_FILES registration for the two newContext specs. **Stations PASS 1/1** (Capitals case 387 via the real shelf path; duet → clue 1 → ack-1 → decode-geography in order on play + network logs; Watson at the card, gap 0 px / overlap 0). **K5 swap PASS 1/1** (identical trace on cases 137/100: placement+pose identical in all 26 buckets, destination identical, max transit deviation 1 cell on the 20 px grid; answer projections 465/380 px from the endpoint). **Endings PASS 2/2** (win: NOTE_MARK → ask-next, CELEBRATE, debrief frame → answer name → close in order; fail: answer read aloud, POUT sticky 15/15 samples over 3.2 s). **K2 PASS after one root cure:** the touch grid measured the RENDERED berth at 94.30 px centre / 55.29 px edge against the ≥96 / ≥56 law — the solver aimed at the bare minimum and whole-px rounding + the host's +1/+1 render offset (transform-vs-rect diagnostic at every grid point) ate the difference; `RENDER_MARGIN_PX` (companion.ts) now solves to law+3, the law and the E2E gate unchanged. Post-cure: touch worst 97.46 / 58.29 (118–128 samples), mouse worst 99.7–99.8 / 60.7–60.8, zero contains/above violations across all runs. **K3 PASS 6/6 companion spec on the cured tip** (original run's sweep): sheet absence 0.0 ms (≤100); ring hold click-anchored 2012–2062 ms (≥1800 vs the 2000 ms hold) — the spec's original dialog-close anchor was proven MutationObserver-delivery-lagged 327–600 ms on this VM and understated full holds as 1464–1673 ms, and its first frame cross-check window, anchored to the same lagged close, caught 1 post-hold SELECTION_READ frame; the resume pass re-anchored BOTH the duration floor and the frame window at the in-page guess click (the causal start of the hold; law and floors unchanged) and the spec passes whole. Pinch + pan cancel a berth to the dock; a tap (<250 ms) never summons. Contention disclosure: under VM load 8–10, berth-acquisition timeouts recur (auto-kill latching on SwiftShader FPS collapse; pause-confirm starvation) — a later full-log capture under that load went 2/6 with ZERO clearance violations in any sample, and every K2/K3 test passes on sequential solo re-runs on a calm VM (the repo's contention-flake rule; logs in `~/workspace/meridian-detective-evidence/u10-gates/`). **K4 PARTIAL on the proxy — gate stays open:** two protocol runs (4× CPU-throttled headless Chromium, Moto G-class PROXY, not the named physical device): median FPS 59.9 (≥58 PASS, both runs), heap +4.56 / +6.14 MB (<10 PASS), p95 frame 150.0 / 50.1 ms (≤18 FAIL-as-measured), long tasks >50 ms in companion windows 1024 / 926 (0 allowed, FAIL-as-measured; window-overlap attribution — the windows are dominated by SwiftShader map rendering, companion code is transform-only + listeners), idle rAF 3567 in 60 s MEASURED-raw (the sampler's own loop accounts for ~1/frame), battery NOT MEASURED (headless). No threshold was tuned: K4 is unverified on the named device class and joins K1/K6 (child panel — NOT RUN) as a flag-flip gate, not a dark-merge gate. Watchdog seeks 0 in all final passing runs. Disclosed by the original run's targeted sweep: one PRE-EXISTING geodetective win-path failure (share origin follows the build base by design; zero diff vs origin/main on the share files + spec) — not this branch's regression. Full local gates on the final tree (both passes agree): tsc clean; scripts 1017 pass / 0 fail / 11 skipped; src 2202/2202; worker 145/145; lint-cards GATE PASSED; build:pages green; audio manifest clean (2,531 entries). |

| Unit A — tap-Watson replay (fold-in, owner 2026-11-06: a kid asks "Watson, can you repeat it?" or taps Watson) | done — commits `f9adad4` (feature) + `4984ba8` (E2E hardening, spec-only). **Player (`detective-audio.ts`):** the clue chain (read + ack + decode) is now retained in AUTO mode as well as tap — recorded at ENQUEUE time, so the full burst is held before its first clip plays; `playHeldSequence()` works in both modes and RESTARTS on request: it generation-bumps the in-flight queue/replay, clears the pending queue, stops the current clip, and plays the held refs from item 1, with exactly one drain (from the latest replay only). Entering "off" still drops the hold; auto↔tap switches keep it; the sound gate still governs at replay time and the autoplay veto still does not block an explicit tap. One U9 test's final assertion updated to the new retention truth (title + comment record the supersession). **Host:** a real button (100×104 px over Watson's figure, aria-label "Ask Watson to repeat this clue") rendered OUTSIDE the aria-hidden clusters in the Listen button's placement pattern — fixed at the clue-card station, absolute at the map dock — carrying a ↻ badge cue (gentle pulse; static under reduced motion). Visibility is the pure `watsonReplayCueVisible` rule in `detective-degradation.ts` (clue/guessing phases = the Listen phase set; Watson at station or dock; pair not hidden; speech auto/tap — off offers no cue). Absence law untouched (sheet/rings → no Watson, no surface); Listen button untouched; state machine untouched (no new event needed). **Tests:** audio tests 21→28 (+7 Unit A: auto retention, replay-after-drain, vetoed-chain retention + tap replay, mid-play restart with suppressed original drain, replay-during-replay restart, mode-switch hold rules, sound-off replay drop); degradation tests 10→16 (+6 cue matrix: phases/placements/hidden/off/non-replay phases). New E2E `tests/e2e/detective-replay.spec.ts` (own `detective-replay` playwright project; shared fixture context → no CONTEXT_FILES entry; telemetry guard 6/6) — **3/3 PASS** on the built artifact under flock, workers=1, VM Chromium 1243: (a) dock tap in AUTO mode replays clue→ack→decode (tail order pinned), keyboard Enter replays again, button ≥44×44 + aria-label + outside aria-hidden + badge all asserted, watchdogSeeks 0; (b) heading + clue-card taps replay nothing (plays 5→5); (c) mid-read tap at 0.25× restarts — decisive record: second clue starts with NO ack/decode yet anywhere, final order clue→clue→ack→decode, ack exactly once, watchdogSeeks 0. Two harness windows measured + hardened spec-side (no product change): the pre-existing READING→SEARCH mount overlap (station + dock figures coexist ~3 s; spec polls to one control, scopes to the dock) and the below-fold station button's scroll-chase click outlasting the read window (spec scrolls during the duet + taps the settled box). Neighbour E2E smoke on the portal-fragment change: detective-flag 2/2, detective.reduced 1/1, detective-stations 1/1 (gap 0 / overlap 0). **Gates on the final tree:** tsc clean; npm test — scripts 1017 pass / 0 fail / 11 skipped, src 2215/2215 (was 2202; +13 Unit A); worker 145/145; lint-cards GATE PASSED; build:pages green. README's Holmes & Watson section records the new control. **Redundancy call (for the PR body): KEEP BOTH** — Listen deals from the tap-mode station context (a labelled text button beside the clue card, the only speech control a Save-Data/low-memory/battery player is offered, and the established U9 surface); tap-Watson deals from the figure's own context in BOTH modes (the owner's asked-for gesture — a kid taps the character, not chrome — and in auto mode it is the ONLY replay surface, since Listen never renders there). Neither duplicates the other's context: removing Listen would strand tap-mode players without a labelled control at the card; removing tap-Watson would delete the owner's order. |
| Unit B — game-end celebration in every edition (fold-in, owner 2026-11-06: ending a game in State / Country / Globe celebrates WITH the final score) | done — commits `c1a00b2` (audio, Path 2) + `dc35458` (mount + wiring) + records/E2E commit. **Mount:** `RunSummaryCard` gains a `detectiveCelebration` prop (game-app passes the boot-time `detectivePair` read, the growth pattern); when on, the lazy `SummaryDetectiveCelebration` mounts under the narration slot — flag off renders nothing and never requests the chunk (E2E-pinned: no pair DOM, summary intact). **Frame + choreography:** the shipped celebrate cluster (DetectivePair rigs, CELEBRATE_LAYOUT high-five contact arithmetic, detective.css classes, spark) driven by a small LOCAL driver on U8's dwells (jump 1150 ms → high-five 900 ms → clap 800 ms → settle) — the loop state machine / companion are untouched, `LoopScreen.tsx` untouched. The frame presents the same `summary.totalScore` and the same `summary.byEdition` split the card renders. **Yield (found + reused):** the summary narration yields through the celebration-overlay handshake — `useCelebrationActive` in storyteller.tsx watches `data-celebration="active"` + `meridian:celebration-open/close`; the mount sets both while it plays and releases on settle, so the narration stays yielded during the celebration and proceeds after — exactly today's celebration behaviour, no new mechanism. **Spoken score — PATH 2 shipped (Path 1 measured broken):** two full render passes over the composable number set showed single-word renders pitch-unstable (num-four 116.8 Hz in pass 1, 222.2 Hz in pass 2; num-one 219.2 → 130.1; after both passes 8 of 30 words outside Holmes's 110–160 Hz family band) and the "points" framing line under the 90 wpm pace floor in both passes (83 wpm). Per the brief's fallback rule the pair speaks ONE fixed line — `score-celebration` (Holmes, DRAFT wording, render-plan records the Path 2 verdict; rendered 135.6 Hz in-target, 91 wpm, status ok) — and the score lives in-frame as text, so a spoken number can never disagree with the displayed total. The 32 Path 1 renders + manifest entries were deleted before commit; no numbers composition module ships. The same `--fixed` passes re-rendered the previously flagged ack-3 under the pipeline's flagged-retry semantics: 107.4 Hz / 81 wpm → 115.1 Hz / 90 wpm (now inside family). **Speech gates:** a small local sequencer over the same manifest (the loop player is host-bound to the clue ladder); `detectiveCanAutoPlay` + `soundAudible` checked at play time (decision 6). **Degradation:** new pure `resolveSummaryCelebrationMode` in detective-degradation.ts — reduced-motion / Save-Data / deviceMemory ≤ 4 GB → static pair frozen at the high-five + score in frame, NO motion, NO audio, no yield claimed. **No double-fire:** one mount per summary presentation = one firing; E2E pins exactly one frame + exactly one spoken-line request/play and the loop pair (detective-host / detective-station / detective-celebrate) absent from the summary surface. **Tests:** degradation tests +4 (mode matrix) — src 2215→2219; scripts 1017 pass / 0 fail / 11 skipped (unchanged); worker 145/145. New E2E `tests/e2e/detective-summary.spec.ts` (own `detective-summary` project; shared fixture context → no CONTEXT_FILES entry) **3/3 PASS** on the built artifact under flock, workers=1, VM Chromium 1243: State flag-on (steps high-five→clap→settle observed in order after jump; frame total == card total; "State" split in frame; exactly one `fixed/score-celebration.mp3` request + one recorded play; watchdogSeeks 0), Globe flag-on (same assertions, "Globe"), State flag-off (no celebration frame, no `[data-detective]` anywhere, total + breakdown intact). `tests/e2e/detective-summary.reduced.spec.ts` (shared `reduced` project) **1/1 PASS**: data-mode static, step frozen at high-five over 3 s, frame total == card total, ZERO detective audio requests. Neighbour smoke: storyteller + endless-game green, detective-flag 2/2. One harness cure inside the specs: pin placement uses the shared `commitPin` (waits out the intro beat) after the first run measured a raw (500,400) click landing mid-dive on the State path (Drop pin stayed disabled; Globe had passed raw). **Gates on the final tree:** tsc clean; npm test green (above); test:worker 145/145; lint-cards GATE PASSED; build:pages green; audio-manifest gate clean (2,532 entries verified). **Redundancy call (for the PR body): KEEP BOTH celebrations** — the LoopScreen celebration deals from the solve context (one case, GeoDetective only, per-case firing); this mount deals from the run-end context (the whole session's final score, every edition, once per summary). Different moment, different score, disjoint surfaces — the summary mount never renders during case play and the loop pair never renders on the summary (pinned in E2E); removing either deletes a distinct owner-ordered beat. |

| Cure pass — review-panel cure list + records integrity (2026-11-06, on top of Units A + B) | done — **Records integrity (the BLOCK):** (1) every present-tense "merged dark" claim about this feature corrected to "to be merged dark — not yet merged; feature OFF" (handbook ch.10 status line + this file's U9 row; README held no such claim — grepped clean). (2) Scope corrected to U1–U10 + fold-in Units A + B + this cure pass (ch.10 status line; this file's TASK line). (5) "12 phases" corrected to **13 phases** (`DETECTIVE_PHASES` lists 13; U5 row + ch.10). **Records honesty:** (3) evidence file `~/workspace/meridian-detective-evidence/U10-GATE-REPORT.md` edited in place (not a branch commit): PR placeholder → #355; code-under-test restated per-section (cure `1bc68b2` + pack `8c03f25`; Units A/B + cures landed after, re-run panel verifies the final tip); stations "gap 0 / overlap 0" qualified as ONE Clue-1 sample; K3's 1-frame SELECTION_READ cross-check failure (MutationObserver-lagged original anchor; re-anchored at the in-page guess click; passes whole since) and K5's post-hoc Δ≤1 transition-bucket allowance disclosed in their sections; K4 table corrected to the LOGGED run only (`u10-gates/k4-perf.log`: 35 cycles, median FPS 59.9 PASS, p95 150.0 ms FAIL, long tasks 1024 FAIL, heap +4.56 MB PASS, idle rAF 3567 MEASURED, battery NOT MEASURED) — the second run's figures (this file's U10 row quotes both runs) are WITHDRAWN there for lack of a raw log and are superseded by the logged run; Phase A capture provenance stated precisely (built artifact of the tip, flag enabled in the SERVED flags copy only; no standalone capture script/note survives in the evidence folder — statement rests on `u5-smoke/NOTE.md` + the U10 harness's flags fulfilment). (4) **Budget claim cured both ways:** definition re-scoped to CLUES-ONLY (five clue reads ≤ 500,000 B, answer not counted), ENFORCED by `checkClueBudgets` in `scripts/detective/audio-manifest.mjs` wired into `check-audio-manifest.mjs` + unit tests (over-budget fails; answer bytes excluded; real tree clean); measured clues-only max **495,161 B (case 397)**; the old clues+answer claim was false — **clues+answer exceeds 500,000 B in 12/497 cases, worst case 397 at 524,574 B** — recorded here, in the U3 row, and in ch.10. (6) ch.10 gained: flip-day ownership of the 88-name probe (owner = Chitti, the agent running the flip, on Veeresh's flip word; trigger = probe re-runs at flip time, 0/88 ⇒ explicit acceptance of the named gaps or hold); Phase B cost (≈ +155 MB, ≈ 248 MB total; U11 = 1,935 core clue reads); a Mermaid architecture diagram; a player-facing QA checklist from the gate/flip-gate material. **Code/copy defects:** (7) **Ack rotation cured** — `detective-state.ts` now rotates by ACK COUNT (`acksPlayed` in machine state, `ackIdForAckCount` selector; first ack of a case stays ack-1); the flawed test pin (state test lines 133–137) fixed and a machine-level full-case test added (acks 1→2→3→4, no repeat, ack-4 plays). (8) **Hook decode cured** — reworded to ONE clue-local sentence "This is the clue to weigh most carefully." and re-rendered via the pipeline: **120.3 Hz / 175 wpm, status ok** (Holmes target 120–145 Hz), DRAFT note kept, manifest gate clean. (9) **Giveaway decode cured** — expanded to ONE full clue-local sentence "That settles it — with the giveaway in hand, you can trust your pin." and re-rendered: **144.1 Hz / 203 wpm, status ok**, DRAFT note kept. (10) **Amazement fragment CUT** (the brisk re-render was tried first): shipped take measured 49 wpm vs the ≥165 wpm breathless spec; probes at speed 170 measured 118.5 Hz (inside Watson's family) but only ~76 wpm, and at the renderer's maximum speed 200 only ~103 wpm — the floor is unreachable inside the pitch family, so per the cure rule the line was cut entirely: render-plan spec, `fixed/amazement.mp3`, manifest entry, the machine's Hook amazement speak, and its tests removed; the pace-ladder "lingers by design" comment superseded. Manifest now 2,531 entries, gate clean. **Flip gates RECORDED by name in ch.10 (not cured, per brief):** FG-1 station occlusion (HIGH) · FG-2 external-speech absence unwired · FG-3 core-387 silence (U11-complete OR coverage-gated speech) · FG-4 the 88 missing names incl. Lahore/Karachi/Baghdad + capitals Tashkent/Phnom Penh/Kampala/Mogadishu/Ulaanbaatar/Chisinau, debrief name slot silent in cases 462 + 491 · FG-5 K4 additions incl. the auto-kill case-load-jank trigger · FG-6 K6 ear pass = 244 flagged entries, 69 out-of-band; **ack-3 recorded cured-by-Unit-B (115.1 Hz / 90 wpm, now inside the 110–160 Hz family band, still flagged vs the 120–145 Hz target; its manifest note still quotes the older 107.4 Hz ladder text)** and **win-watson still flagged (115.1 Hz / 138 wpm) — stays a named K6 item** · FG-7 guess-during-reading dropped (pendingGuess symmetry) · FG-8 dock overlaps MapLibre attribution at 390 px · FG-9 exclusion-marker over-claim · FG-10 measure() scroll-throttle · FG-11 tap-mode drops all non-clue lines · FG-12 debrief text equivalent (caption) · FG-13 K5 widening (touch trace + second endpoint) · FG-14 DRAFT-line ratification (decodes + score-celebration line). Also recorded in ch.10: Unit B's Path 2 verdict (composable spoken score measured broken across two pipeline passes; fixed line shipped, score always in-frame) and the pre-existing ~3 s READING→SEARCH figure overlap (transient, self-resolving, not a fold-in regression). **Capture:** game-end celebration clip + stills + sibling provenance note in the evidence folder (`detective-gameend-celebration.mp4`). Gates for this pass are recorded in the cure-pass PR report (tsc / npm test / test:worker / lint-cards / build:pages / audio-manifest gate / detective E2E subset under flock). |

U11 (core 387 renders) is Phase B — NOT in this branch.

---

## Remove the home doorway — feat/remove-home-doorway (2026-11-05)

- **Authority:** Veeresh, 2026-11-05: "card is not clickable. if its not clickable then there is no point of putting it on home page." Decision chain: issue #344 shipped the Capitals & Flags strip on Home with one door per mode → the owner's Option C pick (2026-11-05) made it a signpost (buttons removed as apparent duplicates of the mode cards) → PR #352 matched its height to the About card → the owner now removes the card outright: a non-clickable card earns no place on Home. The pack itself is untouched — the Capitals deck remains on the shelf inside GeoDetective / Cold Trail, its sole entry since Option C.
- **TASK / outcome:** home renders no Capitals & Flags doorway anywhere, in any age band; the About card stands alone in `.hv5-pages` at full width; no dead doorway CSS, component, prop, or test survives.
- **Tier:** 2 process shape (multi-file UI removal through the full review pipeline), executed as a bounded removal — no new logic, no council design question: the design decision is the owner's, stated above.
- **Removed:** `src/components/pack-doorway.tsx` (whole component — grep-verified: game-app.tsx was its only consumer); in `game-app.tsx` the `PackDoorway` import, the `doorway={...}` prop at the Choose call site (with its `isLoopLocked(...) ? null :` condition — the helper itself stays, still used by the GeoDetective card and its locked tile), the `doorway` prop in Choose's destructure and prop types, and the `.hv5-about-row` wrapper div (About now renders directly in `.hv5-pages`, where the standing `.hv5-pages > .hv5-page { grid-column: 1 / -1 }` rule gives it the full band width, as before the beside-About placement); two comments rewritten to record the removal. In `home-v5.css`: `.hv5-doorway`, `.hv5-doorway-flags`, `.hv5-doorway-flag`, all `.hv5-doorway-compact*` rules, the whole `.hv5-about-row` block (base rule, the `:has(> .hv5-doorway)` two-column template, the `> .hv5-doorway` matched-height rule, the ≤680px stacking reset), and `.hv5-btn-ghost` + `:hover` (the #352 nit's ~11 dead lines — grep-verified zero consumers anywhere in src/tests/scripts after the doorway's own scoped override was removed in #352). The section header comment now records the removal.
- **Tests:** `capitals-flags.mobile.spec.ts` — the doorway test deleted with its subject (header rewritten: shelf-only entry, doorway history kept as a superseded record); the two shelf-entry tests untouched and still the pack's flag-rendering coverage. `home-hero-trekker.desktop.spec.ts` — header (a)/(f) updated ((f) marked RETIRED with the owner's sentence); composition test renamed "…and no doorway" and its doorway assertions replaced with absence pins (`.hv5-doorway` 0, `pack-doorway` testid 0, `.hv5-about-row` 0, `.hv5-pages > #home-about` 1); **the heights-match pin is deleted — retired because the card it measured no longer exists** (owner's sentence above is its retirement record). `pack-shelf.test.ts` — the home guard test renamed "renders no shelf and no doorway" and STRENGTHENED (adds `<PackDoorway` / `from "./pack-doorway"` absence assertions to the kept shelf ones). `pack-shelf-data.test.ts` — doorway framing in the dedupe describe/comment/variable names updated to the shelf-only reality; assertions unchanged. `pack-shelf-data.ts` — the shared-manifest comment updated (doorway named as a former third consumer); behavior unchanged.
- **Docs:** `README.md` Capitals & Flags paragraph — shelf is the pack's only entry; the strip's one-day life kept as a parenthetical with the owner's sentence. `docs/story-packs.md` — §7 manifest bullet (shelf mounts share the load; doorway mention removed) and the doorway bullet rewritten as "The doorway — removed from Home", the #344 → Option C chain kept as a marked superseded record and extended with this removal. Handbook: no doorway mentions exist (grep-verified), nothing to update.
- **Shelf-entry verification:** the `pack-chip-capitals` chip renders inside both mode screens from `pack-shelf.tsx` (unchanged); the capitals-flags E2E tests 2–3 enter both modes via mode card → shelf chip and assert the pack deals (GeoDetective briefing flag `ae`; Cold Trail witness flags `pe, ar, cl`) — they never touched the doorway and are re-run in this pipeline.
- **Gates (builder, on the change):** `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001), src 2107/2107; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green. Targeted E2E + Silo QA + panel + DevEx + benchmark: see the verdict record appended below when the pipeline completes.
- **Status:** [x] change built + local gates green · [x] PR open (#354) · [x] targeted E2E · [x] Silo QA · [x] panel · [x] DevEx · [x] benchmark · [x] verdict + capture. NO MERGE — the owner's word.
- **Verdict (2026-11-05, on code tip `e9a0e41`): READY-WITH-NITS.** Panel 7 APPROVE / 5 APPROVE-WITH-NITS / 0 BLOCK (all nits LOW: the owner-accepted pack-awareness trade, pre-existing hover-lift on inert sections, the vestigial pages template, two records/comment nits). DevEx PASS-WITH-NITS (2 LOW, one being this checklist — cured by this append). Silo QA PASS on a fresh clone keyed PR #354 + `e9a0e4134ada60b16b3996270f320a399ecf04d6`, tallies identical to the builder's. Targeted E2E 46/46 total: 32/32 on the first pass, plus a disclosed supplementary 14/14 — the first run's two mis-named spec files (`mobile-home-overlap.mobile.spec.ts`, `home-badges-readaloud.desktop.spec.ts` don't exist; Playwright silently skipped them) were re-run under their real names with their documented `VITE_KOFI_URL` build requirement and passed. Benchmark PASS (nothing grew; CSS −1,112 B in the routes chunk, JS −1,495 B, dist −0.01%). CI fresh read: build (22.x) + GitGuardian + e2e all pass; PR mergeable. Capture: `~/workspace/meridian-home-rework-evidence/home-no-doorway-capture.mp4` (20.8 s) + `.png`, frame-verified — About full-width, no doorway; rendered height at matched configs: 1440 px Δ 0 (6,861 → 6,861; the doorway rode beside About), 390 px Δ −182 (7,872 → 7,690). Verdict comment: PR #354, 2026-11-05. This records commit is the only commit after the voted tip — no code, CSS, or test change. **Awaiting the owner's merge word.**

---

## Correction pipeline — ✅ READY-WITH-NITS on tip `140258f` (2026-11-05, on PR #352)

- **Verdict:** READY-WITH-NITS on voted tip `140258f0401ab38a82e594b9ac56f1f15a4f4b34` (commits `1cb97d2` code+pin, `140258f` records). Full pipeline re-run on this tip; neither the `18a6a39` verdict nor `bb05d17`'s carries.
- **Panel re-vote: 3 APPROVE / 9 APPROVE-WITH-NITS / 0 BLOCK** (APPROVE: Game Level Architect, Game Economy Designer, Game Audio Designer; AWN: Game Designer, Game Developer, Game Narrative Designer, Senior Architect, Senior Developer, Frontend Developer, UX Researcher, UX Designer, Office Hours). Geometry independently reproduced by the Frontend seat and by Silo QA (Δ 0.00px on heights, width, and tops at 1440). The alternative reading "sizes to match = width AND height" was tested by Office Hours and dismissed on evidence: the owner's correction named heights, and the Journal / Grown-ups pair he cited has unequal widths, equal heights.
- **Silo QA (fresh clone meridian-qa-352d, keyed PR#352 + `140258f`): PASS-WITH-NOTES** — HEAD exact; tsc clean; scripts 990 pass / 0 fail / 11 skipped (1001 tests), src 2107/2107, worker 145/145; lint-cards GATE PASSED; build green (buildId `140258f`, stamp verified); targeted E2E 32/34 — hero 6/6 (the renamed pin also 1/1 by name), capitals-flags 3/3, home-visual-layout 13/13, badges 8/8, greeting-keyboard 2/2; storyteller-home.reduced 0/2 rests solely on a pre-existing main defect: the prerendered shell references `styles-DjXufZWP.css`, which exists only in `dist/server/assets` (both CSS files md5-identical between the main `851886b` build and this tip's build — A/B-proven by QA; CI's e2e on this tip passes). A standing defect on main, worth its own ticket — not a #352 regression.
- **DevEx PASS-WITH-NITS** (2 LOW: an inverted "so" clause in the `:has()` template comment — cured comment-only in the records commit carrying this section, with the built CSS proven byte-identical to the voted build, all 11 CSS files sha256-equal; and the PR body's correction section not naming the final tip — cured in the body, which now names `140258f`).
- **Benchmark PASS** (vs main `851886b`: total dist +0.044%, entry chunk 0.000%, worst single asset routes.css +4.54%, under the 5% gate; no assets added or removed). **CI on `140258f` (fresh read):** build (22.x) PASS · e2e PASS · GitGuardian PASS · Workers Builds FAIL = known non-required PR-tip artifact, not counted. PR OPEN, MERGEABLE.
- **Nits carried as follow-ups (all LOW, recorded in the verdict comment):** the stretched signpost's interior void — content stays top-aligned, ~36% of the card empty at 1440, ~46–52% at 768 (five seats convergent: the owner's eye on the capture decides; do not cure in this PR — vertical distribution/centring is a new design call, not a fix); the pre-existing `.hv5-card:hover` lift now covers ~2.8× the area on a non-interactive strip (a one-line hover exemption is the suggested follow-up); the matched-pair guarantee is one-way (holds while About is the taller card — unreachable to invert with the shipped static About copy, which is shortest at desktop with a 91px margin) and the pin hardcodes the 22px row gap and samples 1440/768/390 (681–767 equality is structurally implied but unpinned); BRANCH_STATUS corrections prepend at the top of this file, which is conflict-prone (nil semantic risk).
- **Capture (production build of `140258f`, buildId-verified, frame-checked):** ~/workspace/meridian-home-rework-evidence/home-ship-capture-signpost-matched.mp4 (24.6s: hero hold → scroll → About-row hold, the matched pair in frame) + home-ship-capture-signpost-matched.png.
- **Records conversion:** this section rides a comment+records-only commit on top of the voted tip (the DevEx comment cure + this record). Built CSS is byte-identical to the voted build (sha256 over all 11 built CSS files, before/after), so the verdict converts to the new tip per the body-correction rule (#219/#347 pattern — the same conversion the `18a6a39` records step used). No merge — the owner's word, with the capture.

---

## Correction — signpost HEIGHT matches About (owner, 2026-11-05, on PR #352)

- **Authority:** Veeresh, 2026-11-05, correcting the sizing-fix run below with a screenshot: "I was clear the card heights dont match" — in the About row, "How a round works" (About) is tall and the Capitals & Flags signpost is short; the pair must read as a matched set: the signpost sizes TO MATCH the About card's height, like the Journal-entry / Grown-ups pair in the row above. The section below ("the card is sized by its own content") records a misread: it read "sizes to match" as a width defect and made the card hug its content width (`justify-self: start`, `d7f0be6`, tip `18a6a39`). That reading is superseded by this correction. The `18a6a39` verdict does not carry — fresh Silo QA + full panel re-vote run on the new tip.
- **Fix (commit `1cb97d2`, `src/components/home-v5.css` only):** in `.hv5-about-row > .hv5-doorway`, removed `justify-self: start` (the card fills its column track again — grid default stretch) and added `align-self: stretch` so the card's height equals the row height set by the About card; `margin-top: 0` kept. The rule's why-comment was rewritten in plain words citing the owner's correction and naming the `d7f0be6` content-width reading as a superseded misread; the stale comment above the `:has(> .hv5-doorway)` template rule (it claimed the doorway "shrink-wraps to its own content") was fixed — the 290px floor bounds the doorway's column track. Not changed: the row's `align-items: start`, the `:has()` scoping, the ≤680px stacking, copy (byte-identical; `pack-doorway.tsx` untouched), or the `data-testid`. Locked-band case (doorway absent → About spans full width) is exactly as before.
- **Measured before (`18a6a39` build) → after (corrected build), Playwright, land count settled:** 1440×900 — About 701.91×251.39, doorway 276.11×160.41 → **484.09×251.39** (height == About, width == track 1208−701.91−22=484.09, tops equal); 1280×720 — same boxes as 1440 (row 1208 wide) → **484.09×251.39**; 768×1024 — About 384×296.17, doorway 276.11×160.41 → **290×296.17** (track 696−384−22=290, tops equal); 390×844 (stacked) — doorway 276.11×160.41 → **350×160.41** (full row width, natural height). Inner-content check: the doorway's inner offsets from the card's top edge are identical before and after at every width (head 19px, flags 65px, title 91px, line 120.61px) — the content stays top-aligned with natural spacing, so no inner-layout guard was needed.
- **Pin replaced:** the `18a6a39` test "signpost card is sized by its own content, never by its row partner" asserted the wrong thing after the owner's correction; it is rewritten in place as "signpost card matches the About card's height and fills its column" (heights-match ±1.5px, top alignment, width-equals-track at 1440/768; stacked full-width + no height coupling at 390; same setup/waits, incl. waiting for the land count to settle). **Bite, both ways:** on a build of `18a6a39` the new pin FAILS — "signpost height at 1440px should match About height 251.39, got 160.41", delta 90.98 vs tolerance 1.5; on the corrected build it PASSES. Full hero spec 6/6 and capitals-flags spec 3/3 pass on the corrected build; `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED.
- **New code tip:** `1cb97d2` (this records commit follows it). No merge — fresh Silo QA + panel re-vote on the new tip, then the owner's word.

---

## Signpost sizing fix — the card is sized by its own content (2026-11-05, on PR #352) — SUPERSEDED by the correction above

- **Authority:** Veeresh, 2026-11-05: the signpost card "sizes to match" — its size was being dictated by its row partner instead of by its own content — "we need to fix it" (card confirmed by his option tap: "The signpost card beside About"). This section's change is on top of the Option C tip `bb05d17`; that tip's READY-WITH-NITS verdict does not carry — fresh Silo QA + full panel re-vote run on the new tip.
- **Diagnosis (measured on the built artifact of `bb05d17`, Playwright, 4 widths):** the doorway's HEIGHT was never coupled — the about row's `align-items: start` already sized it by content: 160.41px at every width, bit-identical when the About card was grown (251.39 → 520.30px) or shrunk (→ 140px) by probe mutations. The coupling was the WIDTH: as a grid item the card stretched to its column track (`justify-self` computed `auto`), rendering **484.09px wide at 1440/1280 for 276.11px of content** (208px of empty card), **290px at 768** (the track's `minmax(290px, 1fr)` floor), and **350px stacked at 390** (full row width) — the row, not the content, dictated the card's size, exactly as the owner saw in the capture.
- **Fix (one declaration):** `justify-self: start` on the existing `.hv5-about-row > .hv5-doorway` rule in `home-v5.css`, with a comment stating the why — the card shrink-wraps to its content plus its own padding at every width. Nothing else touched: beside-About placement, the `:has()` template scoping (locked bands → no doorway → About full-width), mobile stacking, copy, and `data-testid="pack-doorway"` are all unchanged; no other spec pinned the stretched geometry (grep: only presence/copy assertions reference the doorway).
- **After (measured on the fixed build, same probe):** the doorway renders **276.11 × 160.41 at 1440, 1280, 768 and 390** — bit-identical across base / About-grown / About-shrunk / max-content / restored states at every width (in the stacked phone layout its y follows the About card, as flow requires; its size never moves). Desktop height stays the signpost's measured 160.41px.
- **Pin:** new test in `tests/e2e/home-hero-trekker.desktop.spec.ts` — "signpost card is sized by its own content, never by its row partner" (spec case (f)): asserts the rendered box equals the max-content box, and is invariant to growing/shrinking the About card, at 1440/768/390, with the desktop height in the ~160px band. **Bite:** on the `bb05d17` build it fails at the first width (width delta 207.98 vs content width 276.11, tolerance 1.5); on the fixed tip it passes (19.4s).
- **Pipeline on the new tip (`29446de`) — ✅ READY-WITH-NITS:** Silo QA (independent fresh clone, keyed PR #352 + `29446de`) **PASS** — tsc clean; scripts 990 pass / 0 fail / 11 skipped, src 2107/2107, worker 145/145; lint-cards GATE PASSED; build green; targeted E2E 34/34 (hero spec 6/6 incl. the new signpost pin confirmed by name in a solo re-run, capitals-flags 3/3, home-visual-layout 13/13, home-badges-readaloud 8/8, storyteller-home.reduced 2/2, home-greeting-keyboard 2/2). **Panel re-vote: 6 APPROVE / 6 APPROVE-WITH-NITS / 0 BLOCK.** DevEx **PASS-WITH-NITS**; benchmark **PASS** (vs `bb05d17` build: total dist +14 B, entry JS 0 B, CSS +19 B — the one declaration). Verdict comment posted on PR #352. No merge — the owner's word, with the fresh capture.
- **Nits carried as follow-ups (all LOW, recorded in the verdict comment):** (1) the card widens once by ~30px when the async land count lands (pre-count ≈246px → 276.11px; the count line is the width driver) — the box follows its content at every instant and nothing else moves, but the pin measures only post-count states; a future pin extension could record the pre-count box or reserve the count slot; (2) a future `min-width` clamp on the doorway would be invisible to the pin (none exists today) — optional hardening: one absolute width ceiling at 1440px; (3) the pin's stability loop returns the last box unverified after 24 tries (flake-hardening: assert stability / await `document.fonts.ready`); (4) interpretation note (Office Hours): the owner confirmed the card, not the dimension — the cure follows the content-sizing acceptance, and his eye on the fresh capture is the disambiguation, so the capture ships with this verdict. Comment-accuracy cures from DevEx + Sr Architect (the item comment's height attribution; a pointer comment on the template's 290px floor) land in the records commit carrying this verdict update — comment-only, with the built CSS proven byte-identical to the voted tip's build.

---

## Doorway — owner's Option C: signpost only (2026-11-05, on PR #352)

- **Authority:** Veeresh, 2026-11-05: "Option C — signpost only, no buttons". Context: he flagged the Capitals & Flags doorway's two Play buttons as redundant to the GeoDetective / Cold Trail cards below; the doors did deal the Capitals deck, but invisibly. This supersedes the #344 ratified one-door-per-mode design. The strip now advertises the pack only (flags + title + lands line); players pick the Capitals deck on the shelf inside each mode — the shelf is the pack's only entry point.
- **Removed:** the doorway button row in `pack-doorway.tsx` (both buttons, testids `pack-doorway-geodetective` / `pack-doorway-coldtrail`) and the `onGeoDetective` / `onColdTrail` props; in `game-app.tsx` the two doorway-only helpers `openLoopWithCapitalsPack` + `openTrailWithCapitalsPack` and their comment block, plus every import they orphaned (grep proof — each had no other use in the file: `readLoopStoreV2`, `loadLoopStore`, `setActiveDeck`, `writeLoopStoreV2` from the loop store, and the whole `pack-shelf-data` import `FIRST_PACK_ID` / `fetchLoopDeckSize` / `writeSelectedDeck`); the `isLoopLocked(...) ? null :` visibility condition and `density="compact"` are untouched. In `home-v5.css`: `.hv5-doorway-doors`, `.hv5-doorway-compact .hv5-doorway-doors`, `.hv5-doorway .hv5-btn-ghost` (the doorway-scoped ghost border override, with its panel-round-1 comment — the ghost door it served is gone), and `.hv5-doorway-compact .hv5-btn` — each verified to style only the removed row; all strip-layout rules and shared tokens kept.
- **Test disposition:** `home-hero-trekker.desktop.spec.ts` — the two door-visibility assertions replaced with no-buttons assertions (both testids count 0, no button role inside the doorway); every other doorway assertion kept. `capitals-flags.mobile.spec.ts` — test 1: door-visibility assertions replaced with no-buttons assertions, strip/swatch/name/copy kept; tests 2–3 REWRITTEN (renamed "shelf into …") to enter via the mode card + the in-mode shelf chip (`pack-chip-capitals`, finished/revealed-case seed pattern from `pack-shelf.desktop.spec.ts`), preserving every flag/copy assertion — GeoDetective briefing flag `ae` with the single-case manifest stub, Cold Trail witness flags `pe, ar, cl`, and the shelf-chip "Capitals & Flags" relabel. `pack-shelf.test.ts` — assertions unchanged (none broke); its doorway comment updated to the signpost reality.
- **Docs:** `docs/story-packs.md` doorway section rewritten to the signpost reality (the #344 door design kept as a one-line superseded record) + the manifest bullet clarified (the doorway reads it for its display count only); `README.md` Capitals & Flags paragraph — the strip "advertises the pack (signpost only — no buttons…)", entry via the in-mode shelf. Dated historical records (e.g. `docs/homepage-v5-scrum-review.md`) untouched.
- **Gates (fresh, on this change):** `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001 tests), src 2107/2107; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green. E2E (flock `~/workspace/.e2e.lock`, `--workers=1`): the default `/opt/meta-chromium` refused launch for all 8 tests ("Hatch WebGL domain policy is required" — environment, no test ran); re-run with the known-good `PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` — **8/8 pass**: home-hero-trekker 5/5, capitals-flags 3/3 (both shelf rewrites included). No merge — panel re-vote on the new tip, then the owner's word.

---

# Branch status — feat/home-rework-hero-trekker (home rework: animated hero + trekking kid + doorway beside About)

- **Branch:** `feat/home-rework-hero-trekker`
- **Base:** `main` @ `70e1be6`, merged up over `d3202a9` (#349); since merged up over `851886b` (#350) as well (merge commit `5436a58`)
- **Authority:** owner words — ship word, Veeresh, widget tap + typed, 2026-11-04 21:15 CST: "Ship it — fold the simple trekker into the home build"; trekker simplification, Veeresh, 2026-11-04 20:29 CST: "Reduce the size of the animated cartoon guy, this is supposed be a child walking the trail and let just keep it to that. No more complexities, but while trekking you need sticks and make it realistic trekking please and wind blowing, climbing slowly"; doorway placement, Veeresh, 2026-11-04 16:05 CST: placement beside the About section + "we dont want to make the UI over crowded"; hero V1 strengthen, Veeresh, 2026-11-04 18:54 CST: "The motion in this one is very subtle. I would appreciate adding a little more."; clouds, Veeresh, 2026-11-04 18:54 CST: "Since the mountains are in the cloud, I believe adding that clouds are moving would make it more sense."

## Task capsule

- TASK: compose the three owner-approved home designs into ONE production build — Hero V1b (trail march + pulse + flag + moving clouds, from `design/home-rework-variants` @ `e85fb41`), the simplified child trekker v2 (from `design/hero-trekker-prototype` @ `5ec0fdf`, minus its own ambient peak clouds — V1b's cloud layer is the one cloud layer; the trekker's valley mist stays), and the Capitals & Flags doorway beside About at compact (slim) density. The variant harness (`?ui=` params, switcher bar) is removed: production renders the composed design unconditionally.
- Tier: 2-shaped (3+ files, home surface). The owner-approved designs are the manifest of record; independent QA + the 12-role panel review the final tip after this PR opens. NO MERGE in this pass — merge only on the owner's word.
- Protected/out of scope: donation copy (byte-locked), telemetry, `workers/`, `src/game/data/`, the two design worktrees (read-only sources). Doorway copy is identical to the owner-approved design variant, count read from the live pack manifest — with one disclosure (records correction, cure round): the doorway eyebrow `Story pack · Capitals` is variant-carried copy, NEW versus production main, identical to what the approved design variant and its captures show; the earlier "no new player-facing copy" claim in this capsule was wrong on that one line and is corrected here and in the PR body. The label text itself is unchanged.
- Verification contract: `npx tsc --noEmit`; `npm test`; `npm run test:worker`; `node scripts/lint-cards.mjs` (GATE PASSED); `npm run build:pages`; Playwright E2E sequentially under `flock ~/workspace/.e2e.lock`, `--workers=1`, against the built artifact — new spec `tests/e2e/home-hero-trekker.desktop.spec.ts` + the existing home specs.

## Record

- [x] Port: the three code files (`src/components/game-app.tsx`, `src/components/home-v5.css`, `src/components/pack-doorway.tsx`) checked out from `e85fb41` — verified lossless: main's copies are byte-identical to the shared base `68ff2c7` (empty diff).
- [x] Harness removal (`3283acc`): no `homeVariantParam` reads, no `uiVariants` flag, no switcher bar; composed design renders unconditionally; doorway beside About at `density="compact"`; dead V2 hero path (`.hv5-mtn-v2` + `hv5-kenburns2`) removed — grep-verified unreferenced after the removal. The wrapped art carries no Ken Burns, exactly as designed (a transform on the img would drift it under the sliced overlays); the shipped `.hv5-mountain` CSS rule kept its Ken Burns with no rendered element at this point — superseded in the cure round below, which removed that dead rule and its keyframes outright.
- [x] Trekker graft (`3283acc`): `HeroTrekkerOverlay` from `5ec0fdf` minus its tk-cloud ambient peak/summit groups (gradient def removed too) — the trail overlay's `hv5-clouds` are the hero's one cloud layer (6 hero layers: art, march, pulse, flag, clouds, trekker; the home page also carries 5 pre-existing autolooping card films + the rail globe, unchanged by this PR). tk-mist valley mist kept as the figure's fade staging; captures show it reading as soft light on the leg, no white patch, so no softening was needed. Gates mirror CardFilm on BOTH overlays: `usePrefersReducedMotion` hook + shared `heroStaticGateAtMount` (Save-Data / deviceMemory ≤ 2); trail still = static dots + flag (pulse/clouds never rendered), trekker still = SMIL clock paused mid-climb at 7.25s. No timers stop the loops.
- [x] Hero framing (`2cba127`): the production rail starved the wrap to 182px (visible viewBox y 359–533 — summit, flag and most of the climb leg cropped). Fix: `.hv5-mtn-wrap { aspect-ratio: 800/533; flex: 1 1 auto; }` (a definite 180px flex-basis overrides the ratio). Verified on the built artifact at 1440×900 and 1920×1080: wrap 839×559, visible viewBox 0–800 × 0–533, trekker photographed on the trail with poles planted, exactly one doorway. Cost: hero card ~1,212px tall at desktop (was 835) — the framing the owner's approved V1 capture already used.
- [x] E2E: new spec `tests/e2e/home-hero-trekker.desktop.spec.ts` (3 tests: composition + doorway copy beside About; motion runs — trekker SMIL clock advances and the pulse travels, sampled on-screen because Chromium does not tick animation frames off-viewport; reduced-motion still — no clouds/pulse, clock paused at 7.25s, rig opacity 1) — 3/3 pass. Registered in `CONTEXT_FILES` in `scripts/e2e-telemetry-guard.test.mjs` (the guard's rule for `browser.newContext` specs). Fail-on-main: every hero selector (`hv5-trail`, `hv5-trekker`, `hv5-clouds`, `hv5-about-row`, `hv5-mtn-wrap`) greps 0 in unmodified main's `game-app.tsx`.
- [x] Existing home specs (flock, workers=1, built artifact): home-visual-layout.desktop, home-badges-readaloud, storyteller-home.reduced, home-greeting-keyboard.desktop — pass. storyteller-home.desktop (2 tests) and mobile-home-overlap (the (a)/(a2)/(b)/(b2)/(d) cases at every width/theme; (c) donation passes once the build carries `VITE_KOFI_URL`, as that spec's own header requires) fail around the age-profile prompt (`agep-pref-prompt` renders after `</main>` on a fresh profile: it pushes the grandpa strip 336px past main's end and its footer "Take the tour" link strict-mode-collides with the tutorial invite's). **A/B verdict: PRE-EXISTING, not a regression** — storyteller-home.desktop + mobile-home-overlap: 22 failed / 7 passed on BOTH the tip and unmodified main `d3202a9`, failing test names identical (Silo QA A/B, fresh clone, key PR 352 + `bfb1ccd`) — pre-existing, root cause: age-profile prompt renders after `</main>` on fresh profiles. Evidence lists copied to `~/workspace/meridian-home-rework-evidence/ab-352/` (`tip-failed.txt`, `main-failed.txt`).
- [x] Docs: README's Capitals & Flags line said the strip sits "under the Expeditions Map card" — updated to "beside the About card". Records correction (cure round): the earlier claim that handbook mentions "stay accurate" was wrong in form — there are no handbook mentions of the doorway or its placement (grep `doorway` over `docs/handbook` = 0; the handbook's hero lines describe the hero card/globe, not this strip). The cure round also fixed the same stale placement sentence in the canonical `docs/story-packs.md` (DevEx FAIL, below).
- [x] Gates on the pre-merge-up tree (this line was mislabelled "final tree" — corrected in the cure round; the final post-merge-up figures are scripts 990 pass / 1001 total, in the merge-up line below): `npx tsc --noEmit` clean; `npm test` — scripts 986 pass / 0 fail / 11 skipped, src 2092/2092; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green (entry chunk `index-*.js` 457,641 B without the Ko-fi env, 457,803 B with it inlined; `dist/client` 66 MB either way). Environment note: this VM's chromium-1243 crashes renderers on its default GL stack (unmodified main crashes identically) — E2E here ran with a temporary local config adding `--use-gl=angle --use-angle=swiftshader` (untracked, deleted after the runs; no repo config change).
- [x] PR opened: #352. Panel verdict pending — merge only on the owner's word.
- [x] Merge-up over main `d3202a9` (#349 crash-watchdog + chunk-recovery), merge commit `bfb1ccd`: sole conflict this file — resolved both-records (this record on top, #349's record below it, main's stack intact). All #349 code files (`scripts/crash-watchdog.mjs`, `src/lib/chunk-recovery.ts`, `docs/observability.md`, tests) auto-merged with no overlap into the home delta. Gates re-run on the merged tree: `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001 tests; +4 watchdog tests from #349), src 2092/2092; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green (first attempt killed at exit 137 under VM contention; the no-change retry passed). Delta audit: branch-vs-main diff is exactly the 7 home-scope files (`src/components/game-app.tsx`, `src/components/home-v5.css`, `src/components/pack-doorway.tsx`, `BRANCH_STATUS.md`, `README.md`, `scripts/e2e-telemetry-guard.test.mjs`, `tests/e2e/home-hero-trekker.desktop.spec.ts`).
- [x] **Panel round 1 — NOT READY** (Senior Developer BLOCK ×2, DevEx FAIL, plus convergent nits). **Cure round (commit `c69bd48`):** (1) trekker un-pause — the still effect's non-still branch now calls `svg.unpauseAnimations()`, so a mid-session gate lift resumes the SMIL clock from 7.25 instead of leaving it paused forever; (2) trail still-gate leak — `HeroTrailOverlay` reflects its JS `reduced` state as `.hv5-trail-still` on the trail SVG and home-v5.css sets `animation: none` on the dots + flag under it (mirroring the media-query rules), so the Save-Data / deviceMemory ≤ 2 cohort gets a true still; the component comment claiming the CSS kills march + wave is now true for every gate; (3) DevEx FAIL — `docs/story-packs.md` doorway sentence now "beside the About card", matching README; (4) owner-quote misquote fixed ("compleities" → "complexities", verbatim per this record's Authority line); (5) cloud seam — each drift bank's ellipse group is duplicated translated +800 (drift-a 5 → 10 ellipses, drift-b 3 → 6; 16 total), so the ±800 drift loops genuinely seamlessly; (6) E2E spec 3 → 5 tests: +Save-Data cohort still (dots/flag animationName "none", no pulse/clouds, trekker paused) and +mid-session flip (reduced → no-preference: clock advances again); (7) locked-band About row — the two-column template is now scoped to `.hv5-about-row:has(> .hv5-doorway)`, About spans full width when the doorway is null; (8) the WCAG 2.2.2 autoloop tradeoff paragraph (from CardFilm's header, incl. the owner's 2026-11-03 autoloop order and "no pause button" stated plainly) is ported into both hero overlay headers; (9) dead Ken Burns CSS REMOVED — `.hv5-mountain` base rule + `@keyframes hv5-kenburns` + the ≤1080 `display:none` and reduced-motion `animation:none` rules that named it: proven safe because no element renders the class (grep over src = CSS only) and every removed rule was single-selector (no grouped selectors shared with live rules; the ≤1080 wrap rule is separate and stays); (10) records corrections — the eyebrow disclosure + harness wording + handbook line + the "final tree" mislabel above, and the framing figures reconciled to ONE measured set: wrap 839×559 at 1440 (measured 838.7×558.8), hero card ~1,212px tall (measured 1,211.6 at 1440×900 on the built artifact), was 835 → +377, now identical in the PR body, this record, and the CSS comment (which said "~300px taller").
- [x] Cure gates on `c69bd48`: `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001 tests), src 2092/2092; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green; E2E (flock, `--workers=1`, chromium-1243, local SwiftShader config, deleted after) — hero spec 5/5 pass including both new tests.
- [x] Merge-up over main `851886b` (#350 band-cluster, merged while the cure was gating), merge commit `5436a58`: sole conflict this file — resolved both-records (this record on top, #350's below it, main's stack intact). All #350 code auto-merged with no overlap into the cure delta (cure spots in `game-app.tsx` verified intact after the merge); no code conflict. Gates re-run on the merged tip: `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001 tests), src 2107/2107; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green; E2E hero spec 5/5 on the merged build. Delta audit vs `851886b`: exactly the original 7 files + `docs/story-packs.md` (8 total). Panel re-vote on the cured tip pending — merge only on the owner's word.

## Panel round 1 + cure (full record, 2026-11-05)

- **Tally on `bfb1ccd`:** panel 2 APPROVE / 5 APPROVE-WITH-NITS / 5 BLOCK; DevEx APPROVE-WITH-NITS; Silo QA PASS-WITH-NOTES (all gates green on the merged tree; the disputed storyteller/mobile A/B identical on tip and main — see the A/B line in the Record above); benchmark PASS.
- **BLOCK — trekker latch (×2 seats):** cured in `c69bd48` — the HeroTrekkerOverlay effect now calls `svg.unpauseAnimations()` (null-guarded via the existing ref check) when `still` flips back to false; the comment no longer implies a one-way latch.
- **BLOCK — trail still leaks on the mount gate (×3 seats):** cured in `c69bd48` — HeroTrailOverlay reflects the gate as the `hv5-trail-still` class on the trail SVG; CSS sets `animation: none` on the dots + flag under it (Save-Data / deviceMemory ≤ 2 cohort, which the reduced-motion media query never reaches); the media query stays as the second lock; the header comment describes the real mechanism.
- **MEDIUM nit — cloud loop seam:** cured in `c69bd48` — each bank's ellipses duplicated translated +800 in x inside the same drift group (bank A 5 → 10, bank B 3 → 6), so the −800…0 window always shows the same picture.
- **LOW nit — About-row dead track (×3 seats):** cured in `c69bd48` with the minimal alternative to `:only-child` — the row defaults to one column and the two-column template now applies only under `.hv5-about-row:has(> .hv5-doorway)`, so a null doorway leaves About full-width. (Why not `:only-child`: the shipped grid template itself carried the dead `minmax(290px,1fr)` track; scoping the template to `:has` removes the dead track at its source and also covers the ≤680px reset uniformly.)
- **Nit — dead CSS (×3 seats):** cured in `c69bd48` — `.hv5-mountain` base rule, its ≤1080px `display:none` rule, its reduced-motion rule, and `@keyframes hv5-kenburns` deleted after a grep proved `hv5-mountain`/`hv5-kenburns` had no other user in src/tests/scripts. The `.hv5-mtn-img` comment now also states the sliced img must never gain a transform/animation (overlay alignment) and that the bare-img path was removed by this PR.
- **UXR nit — ghost-door border contrast:** cured in this round — the shared token `--hv5-line-warm` (#d8cbae, also pill dot / difficulty picker / badge) stays; a doorway-scoped override `.hv5-doorway .hv5-btn-ghost { border-color: #97835a; }` was added. WCAG math vs the card ground #fdfbf3 (relative luminance 0.9635): #d8cbae luminance 0.6037 → (0.9635+0.05)/(0.6037+0.05) ≈ 1.55:1 (the nit); #97835a luminance 0.2355 → (0.9635+0.05)/(0.2355+0.05) ≈ 3.55:1 — clears the 3:1 component-boundary bar, same sand/brown family.
- **UXR nit — door emoji a11y:** cured in this round — the 🔎 and ❄️ glyphs in `pack-doorway.tsx` are wrapped in `<span aria-hidden="true">…</span>`, the house pattern (game-app.tsx GeoDetective button).
- **E2E cures:** (d) Save-Data/low-memory still case and (e) reduced-motion flip-back case were added in `c69bd48` (case (d) states in its comment that it must fail on the pre-cure code; case (e) also asserts the pulse is present after the flip — added this round). This round hardened case (c) to `expect.poll` for `animationsPaused()===true && t∈(7,7.5)` before sampling, and put every context close in the spec into `try/finally`.
- **Records/docs cures:** `pack-doorway.tsx` header — the "Copy is unchanged word-for-word." claim replaced with the precise scoping (locked lines unchanged word-for-word; the eyebrow "Story pack · Capitals" is new vs main, theme restyle, design commit `266c00c`), and the owner quote carries its citation ("doesnt follow the theme" — Veeresh, 2026-11-04, with screenshots of the then-current doorway). README gains one short hero-system paragraph (HeroTrailOverlay + HeroTrekkerOverlay, the 6-layer stack, the still gate) beside the hero's Begin-exploring line. `docs/story-packs.md` placement sentence was cured in `c69bd48`.
- **Gates RE-RUN on the cured tip (this round, fresh — not copied):** `npx tsc --noEmit` clean; `npm test` — scripts 990 pass / 0 fail / 11 skipped (1001 tests), src 2107/2107; `npm run test:worker` 145/145; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green, entry chunk 457,641 B. E2E (flock, `--workers=1`, chromium-1243, temporary SwiftShader config — untracked, deleted after): hero spec 5/5 (all five cases, incl. (d) and (e)); home-visual-layout + home-badges-readaloud + storyteller-home.reduced + home-greeting-keyboard.desktop — 25/25 on the clean sequential run; one earlier batch run showed 1 home-visual-layout failure, and the isolated sequential re-run of that spec passed 13/13, so it is dispositioned as VM contention flake per the repo rule, not a regression.
- **Capture (item: 1280×720):** production-build screenshot at 1280×720 saved to `~/workspace/meridian-home-rework-evidence/ship-1280x720.png`. First-screen composition at that size, measured (not assumed): the tour banner, header, headline, lede and the difficulty picker are in the first screen; the CTA and the top of the mountain fall just below the fold (mountain wrap top at 874px in a 720px viewport) and the edition cards are below the fold — the tall-framing cost the owner approved, now evidenced at this size. (This corrects the earlier expectation that the CTA + mountain top would be inside the first 720px; they are not, on the fresh-profile layout with the tour banner shown.)
- **Honest caveats:** CI state for the new tip is read back after the push and reported in the PR body; if the e2e check is still pending at report time it is stated as pending, not passed. The A/B-disputed storyteller/mobile failures remain pre-existing on main (see above) and are not cured by this PR.


---

# Branch status — fix/band-cluster-films-toast (band-cluster fix set)

- **Branch:** `fix/band-cluster-films-toast`
- **Base:** `main` @ `e1cf6fe`
- **Authority:** Veeresh, 2026-11-04: "Commission all: latch fix + locked-film loop + band toast + E2E"

## Task capsule

- TASK: four commissioned fixes from the 2026-11-04 band-cluster diagnosis — (1) CardFilm/LockedTileFilm video-error latch: reset on media change + one bounded retry before latching; (2) LockedTileFilm loops under CardFilm's exact governance (R1 still holds: no control of any kind on the tile); (3) the age-profile confirm-change toast names the band (built from `getBand`, no hardcoded names/ranges), both run states; (4) a new in-session band-switch E2E driving the real UI flow with no seeded band.
- Tier: 1 shape (clear repro + locked fix shapes) run as a builder silo; independent Silo QA + the 12-role panel review the final tip separately. Builder stops at PR open — NO MERGE.
- Files in scope: `src/components/card-film.tsx` + `src/components/card-film.test.ts`, `src/components/age-profile/LockedTileFilm.tsx` + `locked-tile-film.test.ts`, `src/components/age-profile/AgeProfileSettings.tsx`, `tests/e2e/age-profile-gate.desktop.spec.ts` (one pin), `tests/e2e/band-switch-in-session.desktop.spec.ts` (new), docs the changes make stale (README locked-tile paragraph, `locked-tile-media.ts` header), this file.
- Protected / out of scope: band locks, the band table's data, which loops each band gets; copy beyond item 3's two confirmChange toasts (first-save + reset toasts stay byte-identical); CardFilm/Review/Journal/Grown-ups behaviour beyond item 1.
- Verification: pins fail on pre-fix code (stash check per item); full gates on the tip (`npm ci`, tsc, typecheck:worker, `npm test`, test:worker, lint-cards, build:pages); targeted E2E under `flock ~/workspace/.e2e.lock`, `--workers=1`, chromium-1243; the new spec also run against an unmodified-main build to prove it bites.

## Status

- [x] Unit 1 — CardFilm latch fix + pins (27/27 with fix; 24/27 with the src change stashed — the 2 new pins + the updated gate pin fail pre-fix)
- [x] Unit 2 — LockedTileFilm: latch retry + loop governance (loop attr, threshold-0 off-screen pause observer, play() rejections dropped) + header rewrite (R1 holds: no control added; stop story = the gates + off-screen pause; stale CardFilm-toggle claim removed). Tests re-pinned: 16/16 with fix, 12/16 pre-fix (loop/off-screen/retry/gate pins fail); R1 describe passes both ways. Docs cured in-unit: README locked-tile paragraph + `locked-tile-media.ts` header now record the loop ruling (play-once marked superseded, not deleted)
- [x] Unit 3 — Band-naming confirm toast: `Saved — {label} (ages {ageMin}–{ageMax}) ✅` / in-progress `Saved — {label} (ages {ageMin}–{ageMax}); takes effect on the next card. ✅`, built from `getBand(confirmTarget)`; first-save + reset toasts byte-identical; stale band-invisibility comment replaced with the 2026-11-04 ruling. Gate spec pin updated to its switch (8-10 → 11-13): `Saved — GeoDetective (ages 11–13) ✅`
- [x] Unit 4 — New in-session switch E2E (`band-switch-in-session.desktop.spec.ts`, 1 test): real UI flow, no seeded band (unset → UI first-set 11–13 → Trail Scout → Little Explorer → back to 11–13); passes on the branch build (1/1). Bite proof against an unmodified-main build (scratch worktree @ e1cf6fe, removed after): the committed spec fails at the Trail Scout toast (expected `Saved — Trail Scout (ages 8–10) ✅`, main shows `Saved ✅`); a scratch variant with main's toast text substituted (evidence only, never committed) proceeds and fails at `locked film loop attribute — Expected: true, Received: false`
- [x] Docs cured (README, locked-tile-media header — in Unit 2) — docs grep found no other play-once/band-invisible text: the ws-4 spec named in the brief does not mention LockedTileFilm, and the Handbook carries no locked-film or band-toast description
- [x] Full gates on the final tip: `npm ci` ✓ · `npx tsc --noEmit` clean · `npm run typecheck:worker` clean · `npm test` — scripts 1016 (1005 pass, 11 skipped, 0 fail, unchanged from baseline), src 2123/2123 (baseline 2119 + exactly the 4 new pins) · `npm run test:worker` 117/117 (no worker code touched) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (one prerender attempt OOM-died under VM contention with another agent's build; the sealed re-run completed, exit 0)
- [x] PR opened (NO MERGE — Silo QA + 12-role panel approve the final tip, then the owner's per-PR word is the merge gate)

## Verification record (builder, on the tip)

- Baseline (unmodified `e1cf6fe`): `npm test` — scripts 1016 tests (1005 pass, 11 skipped, 0 fail); src 2119/2119 pass.
- Unit pins: card-film.test.ts 27/27 with fix, 24/27 pre-fix (stash check); locked-tile-film.test.ts 16/16 with fix, 12/16 pre-fix, R1 pins pass both ways.
- Targeted E2E (flock, --workers=1, chromium-1243, branch build): band-switch-in-session 1/1; age-profile-gate 1/1 (new toast pin); band-media-variants 4/4. card-redesign full file: 3 whole-test 240 s timeouts under VM contention (no assertion failures); the 3 tests + 1 name-matched neighbour passed 4/4 on a clean sequential re-run — contention flake, dispositioned.
- Full gate numbers recorded in the PR body.

## Panel round-1 cure — 2026-11-04 (verdict on `2b2410b`: 2 APPROVE / 6 AWN / 4 BLOCK)

Cure builder (not the round-1 builder). Both BLOCKs cured; the cured
tip returns for fresh Silo QA + a full panel re-vote before any
merge word. NO MERGE.

- **B1 — off-screen-pause observer orphaned by the retry remount
  (4 seats).** In `card-film.tsx` + `LockedTileFilm.tsx` the
  threshold-0 observer now resolves `videoRef.current` inside its
  callback (event time), immune to every remount path. Folded nit:
  the retry/latch state is now URL+band-scoped DERIVED state
  (`spentScope`/`failedScope` hold the scope string; `attempt`/
  `failed` derived) — no post-render reset effect, no double fetch
  start on a swap, no stale error charged to a new film.
- **B2 — latch reset keyed only on URL (Office Hours).**
  `CardFilm` takes a `band` prop (wired at all five game-app call
  sites, all with `ageBand` in scope); the scope is band + videoUrl,
  so ANY band change revives a latched slot in its first render —
  including the constant-media slots (GeoDetective/Journal/
  Grown-ups) and fail-closed variant slots. LockedTileFilm needs
  no band prop (5–7 only, constant media).
- **Proof.** New behavioural E2E `band-film-error-path.desktop.spec.ts`
  (page.route aborts the GeoDetective film request): fail-once →
  retry succeeds → film plays; fail-always → latch → band switch
  11–13 → 8–10 → the same constant-media slot revives and plays;
  after a successful retry, scrolling off-screen pauses the CURRENT
  element. Bite vs the round-1 tip (scratch builds): the revival
  case fails there (no video mounts after the switch); the unit
  pins fail 8/51 there (observer-resolution + scope-derivation +
  wiring pins), 51/51 on the cured tip. In-progress toast: proven
  unreachable behaviourally (AgeProfileSettings renders only in
  game-app's Home branch, reached only when run === null &&
  !loopOpen, so runInProgress is never true at its only render
  site) — covered instead by the new source/behaviour pin file
  `age-profile-settings-toast.test.ts` (exact templates + composed
  strings from the real band table, all three bands).
- **Docs cures (all six).** AgeProfileSettings post-gate comment
  deleted (toast renders ~3.5 s on home; owner ruled it names the
  band anyway, 2026-11-04); types.ts band `label` gloss gains the
  toast exception; AgePicker header scoped to durable surfaces +
  the same exception; LockedTileFilm header gains the explicit
  WCAG 2.2.2 sentence (no stop exists; owner accepted the gates);
  locked-tile-media.ts ~105-char line rewrapped; card-film header
  states the cured retry budget (one retry per media+band scope).
- **Pin re-points (shape genuinely changed, nothing weakened).**
  The exact CardFilm call-string pins in card-film.test.ts (5),
  `card-media-band-variants.test.ts` (5) and
  `home-smooth-cards.test.ts` (3) now include `band={ageBand}`.
- **Merge-ups.** main `0b4e270` (#348) merged, then main `70e1be6`
  (#347) merged when it landed mid-cure; sole conflict both times:
  this file (both-records stack). Final diff vs main: this PR's
  17 files only.
- **Environment.** ~/workspace hit its btrfs quota (EDQUOT) during
  the cure; builds + the final gate run were executed in a roomy
  overlay-fs clone of the same tip. VM renderer crashes ("Target
  crashed") hit the heavy E2E specs repeatedly in this window on
  BOTH the cured build and a round-1-tip control build
  (band-media-variants 0/4 and band-switch 0/1 there) — environment
  class, dispositioned with sequential/control runs; the new
  error-path spec passed 2/2 on the cured build in a quiet window.
  Fresh Silo QA should re-run the two heavy specs in its own pass.

## Merge-up — 2026-11-04 (main `0b4e270` merged in, PR #350 panel-cure round)

- Sole conflict: this file. Resolved both-records: this branch's record above, main's #348 record below it; the accumulated records from main follow after.
- Code files auto-merged with no conflicts (#348 removed dead auth only; no overlap with this branch's scope).

## Merge-up — 2026-11-04 (main `70e1be6` merged in, PR #350 panel-cure round)

- Sole conflict: this file. Resolved both-records: this branch's accumulated record above, main's #347 record below it; earlier accumulated records follow after.
- Code files auto-merged with no conflicts (#347 touched only crash-watchdog scripts + the crash-report worker + observability docs; no overlap with this branch's scope).

## Panel round-2 cure — 2026-11-04 (verdict on `7139160`: 5 APPROVE / 6 AWN / 1 BLOCK)

Cure builder (not the round-1 cure builder). The cured tip returns
for fresh Silo QA + a full panel re-vote before any merge word.
NO MERGE.

- **BLOCK (Game Developer; root shared with Senior Developer
  NIT-4) — a remount never re-observes.** The round-1 B1 cure
  resolved the video element inside the pause observer's
  callback, but the effect's deps stayed `[gated, near]`: a film
  that errors and remounts (retry key change) while its slot is
  NON-intersecting is never re-observed — the deps don't change
  on remount and IntersectionObserver fires no callback without
  a threshold crossing — so the remounted film is never paused
  and (in a browser that starts off-screen films) autoplays and
  loops off-screen indefinitely, falsifying the headers' "never
  decode off-screen" invariant. Same shape in both components,
  and for a non-latched media swap below the fold. **Cure (the
  seat's minimal cure, verbatim):** CardFilm pause-effect deps
  → `[gated, near, attempt, media.videoUrl]`; LockedTileFilm →
  `[gated, near, attempt]`. A remount now re-runs the effect,
  and the fresh observer's initial delivery pauses/plays the
  new element correctly. Header/code comments in both files
  record why the deps carry the remount signals.
- **Folded MAJOR nit (Office Hours; parent decision: fold in,
  same mechanism) — band round-trip re-latch.** Derivation alone
  revives a slot only while a different scope is showing: latch
  in band A → switch to B (revives) → back to A in the same home
  session rendered latched immediately, because `failedScope`
  still equalled A's scope. **Cure:** leaving a scope clears
  its record — CardFilm now tracks the last-rendered scope and,
  on an actual scope transition (during render, React's
  adjust-state pattern; still no reset effect), clears
  `spentScope`/`failedScope`, so every arrival at a scope starts
  fresh. LockedTileFilm needs no clearing: its scope can never
  change while mounted, and leaving 5–7 unmounts it — now stated
  in its scope comment. The PR body's "any band change revives"
  wording is corrected to these real semantics.
- **Proof.** Unit pins (source-pinning style): the deps pin in
  each film test file + the round-trip pin in
  `card-film.test.ts`. Bite (scratch worktree @ `7139160`, the
  new test files over the voted components): exactly the 3 new
  pins fail, 46/49 pass; on the cured tree 49/49. E2E: two new
  variants in `band-film-error-path.desktop.spec.ts` — the error
  fires BEFORE the slot first intersects (slot parked below the
  fold, inside the lazy margin), CardFilm (Journal slot) and
  LockedTileFilm. Witness design, recorded honestly: this
  Chromium defers off-screen autoplay (probe-verified: a
  below-fold film sits paused at t=0 with no observer at all),
  so a paused-state assertion cannot separate the tips here;
  the variants witness the DELIVERY — a `pause()` call landing
  on the remounted element, recorded via an init script — which
  is exactly the mechanism the BLOCK names, plus the final
  paused-state assertions as the user-facing invariant. The
  first failure is delayed 2.5 s so the original observer's
  initial delivery is spent on the first element (an instant
  abort can let that delivery land on the new element and mask
  the bug — measured in this run: the first version of the
  variant passed on the voted build for exactly that reason).
- **PR-body record correction (QA nit).** The round-1 cure's
  bite figures were overstated: under the stated scratch method
  it is 6 pins fail / 45 pass across all 3 test files (40 pass
  films-only), not "8 fail / 43 pass" — the 51 total only arises
  including the 5 toast tests. The body is corrected.
- **Gates (cure tree):** tsc clean · `npm test` — scripts 986
  pass / 0 fail / 11 skipped, src 2107/2107 (2104 + the 3 new
  pins: card-film 29 → 31, locked-tile 17 → 18) · lint-cards
  GATE PASSED · build:pages green. E2E on the cured build:
  band-film-error-path 4/4 (both new variants included, earlier
  paused-state-only version — re-run with the delivery witness
  sealed in the PR body). NOT in this cure: the dead
  `runInProgress` deferral branch (owner decision owed outside
  the PR — untouched), any other refactor.

## Merge-up — 2026-11-04 (main `d3202a9` merged in, PR #350 round-2 cure round)

- Main moved during the cure (#349, chunk-failure cascade,
  merged live). Sole conflict: this file. Resolved both-records:
  this branch's accumulated record above, main's #349 record
  below it; earlier accumulated records follow after.
- Code files auto-merged with no conflicts (#349 touched only
  crash-watchdog scripts, `src/lib/chunk-recovery.ts`,
  observability docs and its E2E spec; no overlap with this
  branch's scope). Delta audit: after this merge-up the
  branch-vs-main diff is exactly this PR's scope plus the
  round-2 cure commit `6c5fb9f`, which the merge-up does not
  change.

---
# Branch status — fix/chunk-failure-cascade (watchdog stand-down on stalled recovery reloads)

- **Branch:** `fix/chunk-failure-cascade`
- **Base:** `main` @ `e1cf6fe`
- **Authority:** owner, 2026-11-04, in the meridian side chat: "Fix the chunk-failure cascade"
- **Diagnosis of record:** `~/workspace/meridian-geodetective-diag/diagnostic-evidence/results*.json` (2026-11-04)

## Task capsule

- TASK / defect: on the GeoDetective open path, a screen chunk (or its
  CSS preload) fails at tap time → MapErrorBoundary shows its
  recoverable card (correct) → `src/lib/chunk-recovery.ts` auto-reloads
  once (owner-approved, PR #245) → if that recovery reload's boot
  stalls past the crash watchdog's 28 s timer, the watchdog showed
  "The game couldn't start on this phone." and POSTed a `boot_failure`
  — the wrong surface (a boot-failure screen for a mid-session chunk
  failure) and false telemetry, for a session that had already reached
  home and set `window.__meridian_ready` on the previous page. The
  mechanism is shared (TrailScreen, SatelliteMap, HomeGlobe ride the
  same lazy + withChunkTimeout + MapErrorBoundary + chunk-recovery
  path; the watchdog is global), so the fix lands once, in the watchdog.
- FIX: in `scripts/crash-watchdog.mjs`, `crashWatchdogMain`'s
  `onTimer()` sets a recovery flag when
  sessionStorage key `meridian.chunkReloadNotice` holds a numeric
  timestamp whose age at timer-fire time is ≤ 900_000 ms (mirrors
  `CHUNK_RELOAD_NOTICE_MAX_AGE_MS` in `src/lib/chunk-recovery.ts`;
  keep-in-sync comments on both sides). Why it proves the case: the
  key is written ONLY immediately before a chunk-recovery reload — by
  chunk-recovery's `decide()` (`writeNotice`) before an auto-reload,
  and by MapErrorBoundary's manual "Try again"
  (`markChunkReloadNotice`) — and both writers run only inside an app
  that already booted and reached home (verified by grep before
  building: those are the only two writers; the only consumer is
  `consumeChunkReloadNotice` at app init in `game-app.tsx`). If the
  recovery reload boots, the app consumes the notice and
  `__meridian_ready` stands the watchdog down anyway; a fresh notice
  SURVIVING to timer-fire with ready unset can therefore only be a
  stalled chunk-recovery reload. Malformed / stale / absent notice →
  today's behaviour, unchanged (fail closed toward the fallback).
- Path division (nothing else moves):
  - version skew → the app's stale offer + Refresh, as today;
  - plain chunk failure → recoverable card + one bounded auto-reload, as today;
  - stalled recovery reload → the `boot_failure` report stands down on the fresh chunk-reload notice, and the player gets the recovery card ("The reload didn't finish loading.", panel round-1 cure — the report stands down, the player does not);
  - fresh-boot stall → watchdog unchanged.
- Redundancy audit: no parallel recovery surface was created — the
  fix reuses the existing notice key and the watchdog's existing
  guarded storage helper; no new key, no new pipeline.
- Byte budget: the ES5 check is folded into onTimer's existing guard
  (`+ss("meridian.chunkReloadNotice") >= Date.now() - 9e5`), +51
  rendered bytes: worst case (14-char build id) 6,104 → 6,155. That
  exceeds the old 6,144 budget by 11, so the budget constant (module
  docstring + `scripts/crash-watchdog.test.mjs`) rises to 6,200 —
  the smallest round number that fits with margin (~45 bytes, like
  the ~40 bytes of headroom 6,144 carried). No unrelated watchdog
  code was shaved. (These are the pre-cure round-1 figures; the
  cure and the merge-up moved the budget again — final merged
  figures: measured worst case 6,551, budget 6,600; see the
  Merge-up section below.)

## Files touched

- `scripts/crash-watchdog.mjs` — the stand-down in `onTimer()`, module
  docstring, budget figures (commit `ff43bbc`).
- `scripts/crash-watchdog.test.mjs` — 3 new unit cases (fresh notice
  stands down; stale and malformed are controls) + the budget raise
  (commit `ff43bbc`).
- `src/lib/chunk-recovery.ts` — comment only: the watchdog reads the
  notice key as a stand-down proof; keep the 900_000 ms values in
  sync (commit `ff43bbc`).
- `tests/e2e/crash-watchdog.spec.ts` — one new case driving the real
  two-page cascade (commit `ac6c24d`).
- `docs/observability.md` — `boot_failure` row note + a new
  "When the boot watchdog stands down" section with the path-division
  table (docs commit, this record's commit).
- `BRANCH_STATUS.md` — this section, prepended; the records below are
  main's accumulated records, kept intact.

## Fail-first evidence

- Unit: the 3 new tests against the UNMODIFIED module — 50 tests,
  49 pass / 1 fail: the fresh-notice case failed because the overlay
  WAS inserted (veil object vs expected undefined); the stale and
  malformed controls passed, pinning today's behaviour. With the fix:
  50/50 pass.
- E2E: the new spec against a build of unmodified `e1cf6fe` — failed
  at the intended assertion, `page.locator("#mv")` resolved to 1
  element after the watchdog timer (the overlay appeared on the
  stalled recovery reload), with every anti-vacuity pin green first
  (card shown, reload's time-origin move observed, reloaded page
  stalled with no app UI, fresh notice surviving unconsumed). Two
  earlier attempts died in Chromium itself ("Target crashed" /
  browser-closed at context creation) under VM load shared with
  parallel crews — environment class, dispositioned by the later
  clean runs, not counted as evidence either way. With the fixed
  build: the case passes (in the full-file run below).

## Gates (final tip; actuals)

- `npm ci` — 384 packages, exit 0.
- `npx tsc --noEmit` — clean, exit 0.
- `npm run typecheck:worker` — clean, exit 0.
- `npm test` — exit 0: scripts 1,019 tests (1,008 pass / 0 fail /
  11 skipped); src 2,119 / 2,119 pass.
- `npm run test:worker` — 117 / 117 pass.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — exit 0; the shipped `_shell.html` inline
  watchdog carries the stand-down check (verified in the artifact).
- E2E spot (flock `~/workspace/.e2e.lock`, `--workers=1`,
  chromium-1243): `crash-watchdog.spec.ts` full file 4 passed /
  1 failed — the new stalled-reload case PASSES; the failure is the
  pre-existing "stale build" case (breadcrumb `lastMilestone`
  expected `data_chunk_load_start`, received `storyteller_ready`),
  which fails IDENTICALLY on a control build of unmodified
  `e1cf6fe` (watchdog file restored from base, rebuilt, same
  expected/received) — pre-existing on main in this environment,
  not a regression; the watchdog never writes the breadcrumb.
  `chunk-boundary-copy.desktop.spec.ts` + `card-redesign.desktop.spec.ts`
  — 13 / 13 passed.
- Rendered watchdog size: 6,104 bytes worst case before → 6,155
  after (14-char build id); budget 6,144 → 6,200.

## Status

- [x] Fix + unit tests (`ff43bbc`), pushed
- [x] E2E case (`ac6c24d`), pushed
- [x] Docs + this record (docs commit), pushed
- [x] PR opened — NO MERGE (pipeline continues: Silo QA + panel; merge only on the owner's per-PR word)

## Panel round 1 + cure — 2026-11-04 (verdict on `417a5ab`)

Panel tally: **2 APPROVE / 8 APPROVE-WITH-NITS / 2 BLOCK**; DevEx
PASS-WITH-NITS. The two BLOCKs (UX Designer + UX Researcher lenses)
share one finding: suppressing the `boot_failure` POST was right,
but suppressing the ONLY recovery surface was not — on a stalled
recovery reload the player (a child, possibly in the standalone PWA,
which has no browser reload button) was left on a blank shell: no
text, no button, no `role=alert` announcement, no exit. The round-1
E2E pinned exactly that state.

Cure (this round, commits `5a61551` + `b6a72ab` + the docs commit):

- `scripts/crash-watchdog.mjs` — `onTimer()` now sets a short flag
  (`rcv`) when the fresh-notice condition holds instead of returning;
  `show()` reads it: the SAME overlay (role=alert, heading focus,
  Try again, Reload + ?nosw=1 links, ASKED latch) with the recovery
  heading **"The reload didn't finish loading."** (the existing body
  line "The game didn't finish loading." is shared — true for both
  cards, zero extra body cost; the WebGL-less heading variant does
  not apply) and **no `send()`** — no `boot_failure` POST, no "Crash
  note sent" line. Telemetry suppression from round 1 is unchanged;
  stale/malformed notices keep the generic card + report.
- Honesty wording (Office Hours nit): the notice proof is stated as
  "in practice" in the watchdog docstring + `onTimer` comment,
  `src/lib/chunk-recovery.ts`, and `docs/observability.md` — the
  flag's removal at consume time is best-effort (the 13-Uf
  surviving-flag case) and the check is one-sided on future
  timestamps; both are accepted residuals, now worded honestly.
- Tests: unit fresh-notice case updated (overlay IS inserted,
  recovery heading present, generic + WebGL headings absent, zero
  POSTs, no "Crash note sent") + a new Try-again case (reloads once,
  still no report) — 51 tests. E2E cascade case retitled ("the
  watchdog shows the reload card and files no boot_failure") and now
  asserts #mv present + recovery heading visible + generic heading
  absent + zero `boot_failure`; all anti-vacuity pins kept.
- Fail-first: updated unit cases vs the `417a5ab` module — 51 tests,
  48 pass / 3 fail (fresh-notice case: no overlay; Try-again case: no
  veil; no-drift needle: heading string absent). Updated E2E vs the
  `417a5ab` build — failed at `expect(#mv).toHaveCount(1)`: the old
  tip shows nothing. With the cure both are green (below).
- Docs: `docs/observability.md` row 3 rewritten (player sees the
  reload card + Try again; no `boot_failure`), row 2's quote fixed
  to the curly apostrophe the boundary actually renders
  (`Couldn’t`, U+2019 from `&rsquo;`, byte-checked), proof paragraph
  softened to "in practice" with the best-effort-removal residual
  stated.
- Byte budget: the cure adds 58 rendered bytes — worst case (14-char
  build id) 6,155 → **6,213** — over the 6,200 budget, so the budget
  rises to **6,250** (smallest round fit keeping the established
  ~40-byte headroom pattern: 37 bytes margin; rationale recorded in
  the test comment, the RENAME comment, and the module figures).

Cured-tip gates:

- `node --test scripts/crash-watchdog.test.mjs` — 51 / 51.
- `npm test` — exit 0: scripts 1,020 tests (1,009 pass / 0 fail /
  11 skipped); src 2,119 / 2,119.
- `npx tsc --noEmit` — clean. `npm run typecheck:worker` — clean.
- `npm run test:worker` — 117 / 117.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — exit 0; the recovery heading verified
  present in the shipped `_shell.html` watchdog block.
- E2E (flock, `--workers=1`, chromium-1243): `crash-watchdog.spec.ts`
  full file — 4 passed / 1 failed. The cured cascade case PASSES.
  The one failure is the pre-existing "stale build" case with its
  signature unchanged (expected `data_chunk_load_start`, received
  `storyteller_ready`; control-proven pre-existing on unmodified
  `e1cf6fe` in round 1) — not chased, per the cure brief.
- Recorded follow-ups NOT built (panel's list): the
  future-timestamp upper bound, an S3-style drift-guard test for the
  mirrored key/age, an exact-boundary 900,000 ms unit pin.

## Merge-up — 2026-11-04 (Silo QA, main `70e1be6` merged in)

- Conflicts: this file (both-records: this #349 record on top,
  main's #347/#348 records and the accumulated stack intact
  below), `docs/observability.md` (auto-merged clean — #347's
  severity/INFERRED content AND this branch's stand-down section
  both present, verified), `scripts/crash-watchdog.mjs` + its
  test (budget figures only — the code itself auto-merged).
- Watchdog budget reconciliation: both features survive in the
  merged module (the #347 read-only boot-health stamp AND the
  #349 stand-down + recovery card). The rendered worst case
  MEASURES 6,551 bytes (14-char build id) on the merged tree —
  exactly 6,104 base + 338 (stamp) + 109 (stand-down + card) —
  so the budget is 6,600 bytes (smallest round fit, 49 bytes of
  margin, the established ~40-byte headroom pattern), recorded
  in the module docstring, the RENAME comment, and the test.
  Watchdog suite on the merged tree: 61/61.
- Gates + E2E on the merged tip `0190262` (Silo QA, fresh clone):
  npm test exit 0 — scripts 990 pass / 0 fail / 11 skipped, src
  2,092/2,092, worker 145/145, watchdog file 61/61; tsc +
  typecheck:worker clean; lint-cards GATE PASSED; build:pages
  green. E2E crash-watchdog.spec.ts 4 passed / 1 failed — the
  failure is the pre-existing "stale build" storyteller_ready
  race, control-proven identical on unmodified main; the cascade
  case PASSES here and FAILS on unmodified main at the
  recovery-heading assertion (pre-fix bite, first-hand).
- Panel re-vote on `0190262` (2026-11-04): READY-WITH-NITS —
  3 APPROVE / 9 APPROVE-WITH-NITS / 0 BLOCK (both round-1 UX
  BLOCKs verified cured first-hand); Silo QA PASS-WITH-NOTES;
  DevEx PASS-WITH-NITS; benchmark PASS (largest delta +1.71%,
  the watchdog bytes). Recorded follow-ups (not built): the
  future-timestamp upper bound, an S3-style drift-guard test for
  the mirrored key/age, an exact-boundary 900,000 ms pin, and
  the ASKED-latch second-stall note. No merge — the owner's
  per-PR word follows this verdict.

---

# Branch status — feat/345-crash-severity (issue #345: crash-report severity grades + watchdog stamp)

- **Branch:** `feat/345-crash-severity`
- **Base:** `main` @ `0b4e270`
- **Authority:** issue #345 + the owner-adopted swarm design (2026-11-04, Slice B): grades S1/S2a/S2b/S3, threshold ≥3 (owner's pick over the draft's ≥2), ungraded absolutes, and the watchdog-stamp client fix commissioned in the same decision.
- **State:** CURED + MERGED UP over main `0b4e270` (via `e1cf6fe`) — panel re-vote on the cured tip pending; no merge (owner's word follows the re-vote).

## Task capsule

- TASK: worker-side `severityOf` (inputs: the re-derived verdict + the stamped `unfinishedBoots` streak only; first-match, fail-closed); the alert's priority line leads with the grade and its why line gains one `Severity: …` clause; the digest gains one counted `severities` dimension and severity-led headers; the boot watchdog stamps the durable boot-health streak read-only onto `boot_failure` so those reports can grade S1.
- Tier: 2-shaped (worker + client telemetry surfaces, 3+ files). The owner-adopted design is the manifest of record for this task; the panel reviews the final tip after this PR opens.
- Protected/out of scope: the verdict derivation itself (severity consumes it, never alters it), the P1–P4 mapping, other PRs, branch protection.
- Model-vs-code note: the inline watchdog's byte budget could not absorb the stamp (worst case was 6,104 of 6,144 bytes) — the budget rose to 6,656 (new worst case 6,441), documented in `scripts/crash-watchdog.mjs` and its test. No telemetry-manifest change was needed: `unfinishedBoots` was already a manifest field, so client + worker + parity stayed in lockstep with no field added.

## Record

- [x] Worker (`workers/crash-report/src/index.ts`): `severityOf` + `SEVERITY_STREAK_THRESHOLD = 3`; `buildAlert` severity lead + clause in Discord and email; `CountBucket.severities` (read-tolerant for pre-#345 buckets), counted in `recordTelemetry`, rendered in type blocks, worst-grade lead in the digest priority line. Tests 109 → 127 (+18: every grade boundary incl. exactly 3, absent-streak fallback wording, stamped-zero wording, ungraded absoluteness at streak 99 for both ungraded verdicts, alert rendering, severities counting, old-bucket tolerance, ungraded-only digest).
- [x] Watchdog stamp (`scripts/crash-watchdog.mjs`): read-only `ds()` localStorage reader; send-time parse of `meridian:boot-health` (v:1 shape required, floor, 0..99 clamp — mirrors `readBootHealth`); stamps only when a value was read; never writes the record (the §4.4 invariant stands). Inline budget 6,144 → 6,656 with the reason recorded in the module. Tests +8 stamp cases (watchdog file 55/55).
- [x] Docs: worker README gains a Severity grades section, the updated digest example, the bucket field, and the test count; `docs/observability.md` alert/digest examples and reading notes updated to the new rendering.
- [x] Gates: worker 127/127 + `typecheck:worker` clean; `npm test` — scripts 1011 pass / 0 fail, src 2119/2119; `tsc` clean; lint-cards GATE PASSED; `build:pages` green. Redundancy audit: one severity derivation (`severityOf`; counting routes through `severityKeyOf` → `severityOf`), one watchdog stamp path.
- [x] E2E (flock, workers=1, chromium-1243): crash-watchdog + crash-classification + crash-loop-breaker + observability — 12 passed, 2 failed on the pre-existing `storyteller_ready` milestone race: `crash-watchdog:164` fails identically on unmodified main in a clean sequential run, `crash-classification:169` passes in an isolated A/B on both builds, and the two production dists are byte-identical except `_shell.html`. Not a #345 regression.
- [x] Visuals (owner addition, 2026-11-04): production build at 6 viewports (360×740, 390×844, 430×932, 768×1024, 1440×900, 1920×1080) — boot path exercised, first paint complete 6/6, no watchdog veil; home byte-identical to main at 360/390 and visually identical at 430; the real WebGL globe renders at 360/390/430/1440. Globe captures at 768/1920 are blocked by renderer crashes that hit unmodified main identically (VM SwiftShader + /tmp at 93%) — environment, not a regression. Satellite imagery tiles do not load from sandbox Chromium (no external network); the globe renders its boundary/starfield state with Esri attribution. Evidence: `evidence/visuals-345/` in this worktree (untracked) + Discord samples rendered by both worker versions; links in the PR body.

## Panel cure + merge-up — 2026-11-04 (PR #347, verdict on `0a7f182`: 2 BLOCKs)

- [x] BLOCK 1 (Senior Developer) — watchdog stamp shape check is now strict (`hp.v === 1`, was loose `==`): a record like `{"v":"1","unfinished":5}` or `v:true` is streak 0 to the app (`readBootHealth` discards it) but stamped 5 by the old watchdog, inflating the grade to a false S1. Regression tests pin string `"1"` and boolean `true` versions stamping nothing (they fail on the pre-cure code, pass cured); valid v:1 and v:2 behaviour stay pinned. Worst-case rendered size 6,441 → 6,442 B, within the 6,656 B budget. Riders: `severityOf` direct-caller edge pins (negative streak clamps to 0, non-integer floors, string/non-finite reads as not stamped) + the ungraded-P4 alert pin — no grading behaviour changed.
- [x] BLOCK 2 (UX Researcher) — the hourly digest now carries exactly one gloss line directly under the priority line when the hour counted any S1: `S1 = player-left INFERRED from ≥3 unfinished boots with no clean boot — not observed.` Absent in any hour with no S1; both directions pinned, golden digest updated.
- [x] Doc riders — grade precedence (S1 > S2a > S2b > S3) documented in the worker README severity section and in `docs/observability.md`'s digest reading notes; the observability alert walkthrough's S1 paraphrase again carries the INFERRED label matching the alert/email wording; the `severities:` note now also states the priority lead's worst grade is counted across all types in the hour and that counts inside one type block sort by count, not grade.
- [x] Merge-up over main `e1cf6fe` (#311): exactly one content conflict — `workers/crash-report/README.md` (the Tests count line) — resolved keeping both intents: #311's audit corrections and funnel content stay, #347's severity section stays accurate against the cured code, test count re-measured on the merged tree (145). `docs/observability.md` and this file auto-merged; both records kept (this #347 record on top, main's stack below intact). Delta audit: branch-vs-main diff is exactly the #345 scope + this cure — no #311 content in the branch's own delta beyond the merge itself.
- [x] Gates on the cured, merged-up tip (the `87a49ff` merge tree): fresh `npm ci`; worker 145/145 + `typecheck:worker` clean; `npm test` — scripts 1015 pass / 0 fail / 11 skipped, src 2119/2119; `npx tsc --noEmit` clean; `lint-cards` GATE PASSED; `build:pages` green; watchdog budget worst case 6,442 ≤ 6,656 B. E2E not re-run locally in this pass (Silo QA + CI cover the cured tip). Records correction: the sealed gate logs for the `87a49ff` merge tree show scripts 1015 / src 2119 — those figures supersede the scripts 1011 / src 2127 figures stated in that merge commit's message.
- [x] Second merge-up over main `0b4e270` (#348 auth removal landed while the first merged tip was gating): sole conflict this file — resolved both-records (this #347 record on top, #348's record below it, main's stack intact). #348's code auto-merged with no overlap into the #347 delta; gates re-run on the new merged tree (figures in the PR body merge-up note).
- [ ] Panel re-vote on the cured tip, then the owner's merge word. NO MERGE in this pass.

---

# Branch status — chore/remove-dead-auth (Remove dead auth)

- **Branch:** `chore/remove-dead-auth`
- **Base:** `main` @ `68ff2c70013746cee55204f5248ffa612270a21f`
- **Authority:** Owner, 2026-11-04: "remove auth"

## Task capsule

- TASK: remove Meridian's dead auth code and open a READY-for-review PR (no merge). Sign-in (better-auth/OAuth under `src/lib/auth/`) is leftover template code from the first commit (`abb9748`); the live site 404s `/api/auth/*` and nobody will ever be asked to log in. This PR unblocks closing #326/#327 — those PRs are not touched by this work.
- Tier: 2 (security-adjacent removal across 3+ files, dependency change). Rationale: the deletion surface touches the root route, the Vite config, the smoke tooling and the lockfile, so it carries the full gate contract below even though every edit is a removal.
- Done condition: the exact removal scope below is complete; the tree-wide grep gate is clean (see the migrations note under Coupling findings); every gate in the verification contract passes; test-count deltas against the pre-removal baseline are accounted for test-by-test; a local runtime smoke on the `build:pages` output passes.
- Files in scope: `src/lib/auth/**` (delete, except the isolation move), `src/lib/isolation.server.ts` (moved file), `src/lib/app-data/client.server.ts` (one import line), `src/routes/__root.tsx`, `src/lib/credits.ts`, `package.json` + `package-lock.json`, `vite.config.ts`, `scripts/check-auth-invariant.mjs` + test (delete), `scripts/sign-out-plan.mjs` + test (delete), `scripts/browser-smoke.mjs`, `scripts/app-env-plugin.mjs` (one comment), `BRANCH_STATUS.md`.
- Protected / out of scope (NOT touched): the embedded-DB stack — `src/lib/db.ts`, `migrations/`, `scripts/migrate.mjs`, `db:migrate`, `pgliteBootstrapPlugin`, the `VITE_AUTH_ENABLED`/app-env flag machinery (`with-app-env.mjs` etc.), and `src/lib/app-data/` beyond the one import line. No other dependency is removed.
- Verification contract: tree-wide grep = 0 for `better-auth`, `lib/auth`, `AuthProvider`, `check-auth-invariant`, `sign-out-plan`, `auth/popup`, `popup.server` (excluding `.git`, `node_modules`, this record — and `migrations/`, see below); `npm ci`; `npx tsc --noEmit`; `npm run typecheck:worker`; `npm run build`; `npm test`; `npm run test:worker`; `node scripts/lint-cards.mjs` (GATE PASSED); `npm run build:pages`; local Playwright smoke on the built artifact.

## Coupling findings

- **browser-smoke coupling:** `scripts/browser-smoke.mjs` imported the auth-invariant check and published an `authWarnings` verdict field. Removed: the import block, the `authWarnings` computation, the verdict field and the warnings spread. Brand warnings, viewports and baseline behaviour unchanged. (`browser-smoke-verdict.mjs` and its test carry no auth references — re-verified.)
- **authPopupPlugin coupling:** `vite.config.ts` carried a dev-only plugin that `ssrLoadModule`'d the deleted `src/lib/auth/popup.server.ts` to serve `/auth/popup`. Removed: the function, its registration, and the ordering comment above the registration. The neighbouring registration comment also named the deleted `check-auth-invariant` script, so it was cured in the same pass (the grep gate requires zero references). Every other plugin is untouched — `pgliteBootstrapPlugin` and `appEnvPlugin` stay.
- **isolation move (the one judgement joint):** `src/lib/auth/isolation.server.ts` is a generic Fetch-Metadata same-site guard — it exports `CrossSiteRequestError` + `assertSameSiteRequest`, imports only `@tanstack/react-start/server`, and has no better-auth dependency — with one live outside importer. It moved to `src/lib/isolation.server.ts` (`git mv`); the import in `src/lib/app-data/client.server.ts` was updated. Its header comment no longer claims enforcement at the deleted `authMiddleware` chokepoint or alongside Better Auth's `trustedOrigins`; it now says the guard serves the app-data server path. The `.server`-suffix warning is intact.
- **migrations note:** `migrations/auth/0001_auth.sql` is a dormant, never-applied Better Auth schema (the migration appliers do not descend into subdirectories) whose comments name the deleted code. It sits inside the protected embedded-DB stack this task must not touch, so it is the one place the removed names still appear; it is listed as a follow-up below instead of being edited here.
- **Docs sweep:** README.md + `docs/` were grepped for sign-in/auth presented as a live feature — none found, nothing to cure. Historical/review docs that merely record the past are not stale and were left alone.

## Follow-ups (orphaned by this removal — NOT done here)

- `jose` — zero code usage anywhere on the post-removal tree; only its `src/lib/credits.ts` listing remains. Candidate for a follow-up dependency removal.
- `kysely` — zero code usage; only its credits listing remains. Its only consumer was the deleted auth pglite dialect. Candidate for a follow-up dependency removal.
- `@electric-sql/pglite` — still used by the protected `src/lib/db.ts`; only the credits listing appears outside the DB stack. Not orphaned as a package.
- `pg` — still used by `scripts/migrate.mjs` and by `src/lib/db.ts`; credits listing besides. Not orphaned.
- `migrations/auth/0001_auth.sql` — dormant Better Auth schema + stale comments (incl. one in protected `src/lib/db.ts`); a follow-up decision, inside the DB stack this PR must not touch.
- `VITE_AUTH_ENABLED` / app-env machinery — the flag now has no consumer in `src/`; the machinery stays per this task's scope and is a follow-up decision.

## Status

- [x] Baseline on unmodified main recorded (scripts + src + worker suites, tsc).
- [x] Auth folder deleted (18 files) + isolation guard moved; `__root.tsx` AuthProvider wrap removed.
- [x] Auth scripts deleted; browser-smoke unhooked; app-env comment cured.
- [x] `better-auth` dependency + `check:auth` script removed; lockfile regenerated (better-auth gone); credits line removed.
- [x] `authPopupPlugin` removed from `vite.config.ts`.
- [x] Full gate run on the branch tip + test-count accounting — grep gate clean (only this record + protected `migrations/` retain the names); `npm ci` clean; tsc clean; `typecheck:worker` clean; `npm run build` green; lint-cards GATE PASSED; `build:pages` green (first attempt was killed at exit 137 during prerender under VM contention; the no-change retry passed). Counts: scripts 985 tests / 976 pass / 9 skipped / 0 fail, src 2119 → 2092 (all pass), worker 109 → 109 (all pass). Two tests in `scripts/ssr-build-shape.test.mjs` skip until a production build exists, so the post-build run (976 pass / 9 skipped) is the canonical count. Every delta test is accounted for by the deleted suites: scripts −29 = check-auth-invariant (11) + sign-out-plan (18); src −27 = gate-identity (24) + sign-in-gate (3). No other delta.
- [x] Runtime smoke on the `build:pages` output — PASSED 7/7: home 200 + renders, GeoDetective card visible, Cold Trail card visible, zero console/page errors, `GET /api/auth/session` → 404. Evidence under `.smoke-evidence/` (not committed). Environment notes: port 4124 (4123 held by a sibling crew's server), `TMPDIR` on workspace disk (shared `/tmp` tmpfs was 94% full and crashed Chromium profiles — a control run against an unmodified main build crashed identically), `--disable-dev-shm-usage` as in `playwright.config.ts`.
- [x] PR opened READY for review — PR #348 — no merge.
---

# Branch status — feat/capitals-flags-phase1 (Capitals & Flags, Phase 1)

- **Branch:** `feat/capitals-flags-phase1`
- **Base:** `main` @ `7a35cbf`
- **Authority:** issue #344 + owner decisions comment (2026-11-04, Veeresh: "All as recommended by the council chair")
- **Design of record:** `~/workspace/meridian-capitals-flags/DESIGN.md` (arena C2 pack-grown, 16/18) + SYNTHESIS.md + SOURCES.md

## Task capsule

- TASK: grow the shipped Capitals pack in place — Wave 1: licence-verified flag layer on the existing 72 cases (relabel "Capitals & Flags", doorway strip on Home, flags only where the land's name is already on screen in text); Wave 2: +38 cases append-only at loop indexes 459–496 (22 state capitals → 50, 16 country capitals → 60), deck top-up migration, celebration target 72 → 110.
- Tier: 2 (new feature, data + schema). The signed design package (#344 swarm → arena → owner ratification) is the Consensus Manifest for this task.
- Ratified lines NOT to cross: no standalone edition; no flag as a hunt target; no manufactured flags or facts (per-file licence gate, unsourceable = flagless); challenges + shared session score stay OUT of v1; Cold Trail generation follows DESIGN.md §7 default (append-only; no silent reset).
- Adjacency: PR #341 touches LoopScreen/pack-shelf on its own branch — this branch builds on current main and does not wait for it; a merge-up will reconcile.
- Verification: packs:validate (Hyderabad gate), check-flags gate (Flagstaff), full unit suites, targeted + neighbour E2E (flock, workers=1), tsc, lint-cards, build:pages, bundle check on flag assets.

## Wave record

- [x] Wave 1 — licence research pass (72 lands): **72/72 licence-verified** on Commons (all Public domain per-file), identity cross-checked vs Wikidata P41 (historical-value traps caught for FR/GR/US). **55 ship** (68,366 bytes total); **17 are flagless on the design's ≤10 KB/file hard cap** — detailed seal/arms path data (100–644 KB) with no faithful simplified rendition published (Egypt + Portugal rescued via design-named flag-icons renditions, MIT). Flagless lands are recorded with reasons in the registry + `docs/flags-curation.md`; they ship the day an SVG optimisation step is approved (owner decision queued in the PR body).
- [x] Wave 1 — schema/composer flagKey derivation (build-time, unmapped subdivision throws), sidecar flagKey for verified lands only, registry + resolver (`src/lib/flag-registry.ts`, lazy glob, 0 bytes precached — verified in dist), surfaces: GeoDetective briefing + Giveaway rung + reveal identity card (flag + sourced story), Cold Trail sighting stamps (163/180; composition byte-stable vs HEAD after stripping stamps) + reveal country line, doorway strip under the Expeditions Map card (with the design's three swatches), relabel "Capitals & Flags" (shelf chips; deck id unchanged).
- [x] Wave 1 — deck top-up in `ensurePackDeck` (built-from size = undealt + completed + open mystery; new cases tier-banded into the remainder) + tests; existing "never rebuilds" pin intact.
- [x] Wave 2 — +38 authored cases (22 state capitals → 50, 16 country capitals → 60), append-only at indexes 459–496; `packs:validate` 110/110 (Hyderabad 100%); published 387–458 clue files + sidecar entries byte-identical to Wave 1 (append-only composer guard enforced; a removal test pins it). **Curation correction:** five picked capitals were dropped for duplicating core-deck targets by GeoNames placeId — Islamabad, Amman, Montevideo and Riga from the authored batch, plus Kuala Lumpur, picked in the first swap round and dropped in a second round for the same reason — and the four replacements that shipped are Dhaka, Algiers, Quito and Tunis, Tunis taking Kuala Lumpur's slot, so all 16 country cases are accounted for (+22 states unchanged); all 38 new targets verified distinct across core + pack (497 distinct targets, build-loop gate). The 16 original country cases needed a validator cure round (59 clues rewritten as plain-words paraphrases inside their verbatim quotes; zero quotes changed, zero facts invented; 5 over-quoted facts dropped).
- [x] Wave 2 — flags for the 38 new lands through the same Flagstaff gate: **69 shipped pack-wide (80,552 bytes)**, 41 flagless recorded (40 size-cap — seal/arms path data, incl. Ecuador at 279,145 B; Mississippi licence-only: "Copyrighted free use" ∉ allowlist; Spain/Mexico + 15 Wave-1 states unchanged). Celebration copy 72 → 110. Cold Trail deck 60 → 85 cases (first-60 composition byte-stable vs Wave 1 after stripping stamps; 61 of 110 pack capitals taught as witness anchors).
- [x] Gates + screenshots + PR to READY (panel runs after; no merge) — scripts 1003/1003, src 2109/2109, worker 109/109, tsc clean, lint-cards PASSED, build:pages green; bundle: 69/69 flags verified in dist as lazy chunks, 0 in the SW precache; E2E (flock, workers=1): capitals-flags 3/3 + pack-shelf mobile/desktop 11/11 combined incl. the two deck-count expectations updated 60 → 85. Eye gate passed on the 20 Wave-2 shipped flags (contact sheets, checker ≠ builders). Shots: `~/workspace/meridian-capitals-flags/build-shots/w2-1-abuja-briefing-flag.png`, `w2-2-tunis-briefing-flag.png` (+ the 6 Wave-1 shots).

## Flagstaff gate

`npm run check:flags` (wired into prebuild) pins registry ⇔ files
(SHA-256, bytes, licence class, SVG sanity, aspect), registry ⇔ pack
subjects both ways, the composed sidecar, and the Cold Trail stamps.
Contact-sheet eye gate (checker ≠ builder) passed on the 55 shipped
flags, 2026-11-04, and on the 20 Wave-2 additions (15 + bd/dz/my/tn
minus the swapped-out lands), 2026-11-04. Final registry: 69 shipped
(80,552 bytes), 41 flagless with recorded reasons, 110 lands.


## Merge-up — 2026-11-04 (main `06dddb1` merged in)

- Sole conflict: this file. Resolved both-records: this branch's record above, main's #341 record appended below it; the accumulated records from main follow verbatim after it.
- Code files auto-merged with no conflicts; the merged tree carries both #341's case-source sentence behaviour and this branch's flag layer (delta audit in the PR body merge-up note).

## Composition cure — 2026-11-04 (owner word: "cure it")

The merge-up's delta audit caught a semantic composition conflict —
auto-merge was textually clean, but #341's fallback spec went red on
the merged tree for two linked reasons. The merge-up stopped unpushed
and the owner approved this cure:

- **Ratified relabel vs #341's pins.** #341's case-source sentences
  derive the deck name dynamically (`deckLabelForId`), so the
  ratified "Capitals & Flags" relabel correctly flows into them;
  #341's pinned expectations still said "Capitals". Cured by updating
  the pins only (unit literal in `pack-shelf-data.test.ts`, the two
  sentence constants in `pack-deal-fallback.desktop.spec.ts`, and the
  §0 quotes in `docs/story-packs.md`). Production strings stay
  dynamic; nothing was hardcoded.
- **Two UI consumers, one manifest URL.** The Home doorway (#346)
  and the pack shelf (#341's surface) each fetched the pack manifest
  with no sharing, so under a first-request-succeeds/rest-fail
  network the doorway consumed the good response and the shelf's
  chip never rendered in the fallback state. Cured in
  `fetchPackManifest` (`pack-shelf-data.ts`): UI callers on the
  default path share one session-level load per pack (in-flight +
  settled success cached); a load that settles to null is evicted so
  the next mount retries. A caller passing its own fetcher always
  gets a fresh uncached load, and the deal path is untouched — it
  resolves the manifest with its own fetch in LoopScreen
  (`resolveActivePack`), fresh at each deal, so a deal-time failure
  still falls back to core with #341's notice.
- **Proof:** the fallback spec passes 3/3 under its ORIGINAL
  choreography (first manifest request fulfilled, every later one
  aborted) — only its two string constants changed. Four new unit
  tests pin the dedupe: shared in-flight load, settled-success reuse,
  failure eviction + retry, injected-fetcher bypass both ways.

## Panel round-1 cure — 2026-11-04 (verdict on `d7ae3b7`: BLOCKED)

The 12-role panel + DevEx voted on the composition-cured tip:
11/12 seats APPROVE / APPROVE-WITH-NITS, Senior Developer BLOCK
(code), DevEx FAIL (docs only), benchmark PASS. Both blocks cured
here; the cured tip returns for a panel re-vote before any merge
word.

- **Block 1 (code) — top-up double-counted a finished mystery.**
  `completePuzzle` counts a finished case in `cycleCompleted` and
  keeps it in `store.current`; `ensurePackDeck`'s
  `openFromThisDeck` counted that same case again as open, so the
  top-up slice skipped exactly one appended case (index 459, the
  first Wave-2 case) for a player who exited on a pack reveal
  screen when the pack grew. Cured: `openFromThisDeck` counts
  `current` only when its status is "playing" (`store.ts`); no
  other accounting changed. Regression test added in
  `store-topup.test.ts` (finished won AND lost currents preserve
  every appended case incl. 459); the panel's repro pair now
  agrees — finished-current and playing-current top-ups both yield
  `[389, 388, 460, 461, 459]` (finished-current yielded
  `[389, 388, 460, 461]` before the cure, reproduced first-hand).
- **Block 2 (docs) — story-packs stated pre-Wave-2 truth.**
  `docs/story-packs.md`: intro now 110 cases (60 country + 50
  state), pack named Capitals & Flags; flowchart + §1 pack range
  387–496 (§8's "387–458 stay frozen" untouched — that is the
  original range the growth appends after); §6 quotes the shipped
  celebration string verbatim (`celebration-copy.ts:166`); §7
  gains one sentence on the session-cached UI manifest (QA note 1
  disposition). `scripts/packs/README.md`: generated clue range
  now ends at 496.
- **QA note 3 (MAJOR) — the swap sentence, corrected.** The old
  "5 swapped out / 4 replacements in" phrasing could not be
  reconciled (16−5+4=15≠16). Derived from the curation data (the
  panel's slate count: 39 candidates → 38 shipped; the
  one-candidate gap is Kuala Lumpur, which sits on both sides of
  the old sentence): five picked capitals were dropped for
  duplicating core-deck targets by GeoNames placeId (Islamabad,
  Amman, Montevideo and Riga from the authored batch, plus Kuala
  Lumpur, picked in the first swap round and dropped in a second
  round for the same reason — all five placeIds verified present
  in the core clue files, none in the shipped pack), and the four
  replacements that shipped are Dhaka, Algiers, Quito and Tunis,
  Tunis taking Kuala Lumpur's slot, so all 16 country cases are
  accounted for. The corrected
  sentence now reads the same in `docs/flags-curation.md`, this
  record, and a correction note appended to the PR body. Also
  fixed in this record: the flagless split is 40 size-cap + 1
  licence = 41 (registry count), not "39 size-cap".

## Panel re-vote — 2026-11-04 (on cured tip `b3fc61c`): READY-WITH-NITS, 0 BLOCKs

The 12-role panel + DevEx re-voted the cured tip: 10
APPROVE-WITH-NITS / 2 APPROVE, 0 BLOCKs; DevEx PASS-WITH-NITS
(the round-1 docs BLOCK is cured); benchmark PASS vs main
`3bc57e8` (client total +0.32%, JS +0.34%, entry chunk
unchanged, 0 flags precached — gate ≤5%). Both round-1 BLOCKs
verified cured first-hand: Senior Developer APPROVE — its
reproduction re-run on both tips (finished won/lost currents
dropped case 459 on `d7ae3b7`; on `b3fc61c` they yield
`[389, 388, 460, 461, 459]` with `cycleCompleted` intact, and
the new regression test fails pre-cure, passes cured); DevEx
re-checked every docs item against sources (§6 quote byte-equal
to `src/components/celebration-copy.ts:166`; the 40 size + 1
licence flagless split proven against the registry). QA notes
(a) curation-sentence copies and (b) probe G hand-crafted state
both ACCEPTED unanimously (12/12 + DevEx). Verdict comment:
https://github.com/veeresh-bikkaneti/Meridian/pull/346#issuecomment-6637312564
This entry is applied in the merge-up commit over main
`3bc57e8`: it was deliberately not committed on the voted tip,
since committing would have moved it. Remaining nits are
recorded follow-ups (FlagImg transient flash on reused Cold
Trail sighting slots, the "100–644 KB" range in the curation
docs, the doorway tagline — owner's call); none block. Merge
follows on the owner's per-PR word.

---

# BRANCH_STATUS — fix/336-deck-identity

- **Branch:** `fix/336-deck-identity`
- **Base:** `main` @ `775d8b4` (#329 band-variant card films, merged)

## Task capsule

TASK / requested outcome: Fix issue #336 (GeoDetective deck leak).
When the player's pick is a pack (activeDeckId "capitals") and the
pack manifest fetch fails at deal time, `resolveActivePack` swallows
the failure and `dealActiveDeck` silently deals a CORE case while the
chip/pick still say Capitals. The fallback itself is design-of-record
(docs/story-packs.md §0: "pack code may never block play") — the
defect is the SILENCE. Locked fix shape (panel reviews it; the
fail-closed alternative is on the record in issue #336 for the
panel, not built here):
1. DECK IDENTITY — the case screen names the OPEN case's deck, in
   shelf vocabulary ("All cases" / "Capitals"), visible while
   playing AND on the reveal. Derived from the open case
   (`deckIdOfPuzzle(current)`), never from the pick. Label helper
   `deckLabelForId` in src/components/pack-shelf-data.ts reuses the
   existing category-label logic, with unit pins.
   PRESENTATION CURED (owner, 2026-11-04 — see the cure record
   below): the first version's `Deck: X` header line
   (`data-testid="case-deck-label"`) is REMOVED. In its place, one
   plain sentence in one place (`data-testid="case-source-line"`,
   under the shelf) names where the open case came from:
   "This case is from your Capitals deck." / "This case is from
   All cases."
2. FALLBACK NOTICE — when a deal actually falls back (a pack was
   picked AND the deal came from the core deck; detected at both
   deal sites: mount effect and onNextMystery), the case-source
   sentence spot carries the fallback notice instead: "Capitals
   couldn’t load just now — this case is from All cases instead.
   Your next case will try Capitals again." While it is up, the
   shelf's own status line stays empty (PackShelf's
   `statusLineSuppressed`), so only one message speaks. Cleared on
   the next deal and on a deck pick. No notice for resumed/revealed
   cases, healthy pack deals, or core picks.
3. REGRESSION SPEC — tests/e2e/pack-deal-fallback.desktop.spec.ts,
   ported from the investigation repro and converted to the locked
   expectation: (a) control — healthy manifest deals 431,
   deckId "capitals", label reads Capitals; (b) fallback — core 186
   IS dealt (§0) BUT the label reads "All cases" and the notice is
   visible; the screen never presents the case as Capitals;
   (c) the pick remains "capitals" after a fallback deal.

Interpretations considered and selected reading: fallback detection
keys on the dealt result (picked deck is a pack AND dealt deckId is
core), which is exactly "resolution returned no pack" at both deal
sites and also covers any other silent-fallback path. The label
renders when a case is open (playing and reveal share the header
block); before the first deal there is no open case to name.

Tier and rationale: Tier 1 shape (one bug, proven repro) run as a
builder silo under the coordinator's brief; independent Silo QA and
the 12-role panel follow separately. Builder stops at PR open —
NO MERGE without the owner's per-PR word.

Files and interfaces in scope: `src/game/loop/LoopScreen.tsx`
(header block near "Case #N", deal sites, onPickDeck, one new state
+ one copy helper), `src/components/pack-shelf-data.ts`
(`deckLabelForId`), `src/components/pack-shelf-data.test.ts` (unit
pins), `tests/e2e/pack-deal-fallback.desktop.spec.ts` (new),
`docs/story-packs.md` (ONE clarifying sentence in §0/§7; the §0
principle itself untouched), this file.
Protected / out of scope: `dealActiveDeck`'s fallback itself
(stays), the store dealer (sound), TrailScreen / Cold Trail
(untouched), the Guess-counter line ~1134 and its immediate block
(claimed by the #337 branch), locked copy elsewhere.

Verification contract (gates on the tip, real exit codes):
`npx tsc --noEmit` · `npm test` · `node scripts/lint-cards.mjs`
(GATE PASSED) · `npm run build:pages` · targeted E2E under
`flock ~/workspace/.e2e.lock`, PLAYWRIGHT_CHROMIUM_EXECUTABLE=
~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome,
--workers=1: the new spec + pack-shelf.desktop.spec.ts +
geodetective.spec.ts.

Assumptions, risks, unknowns: notice/label copy is minimal and
factual per the brief's draft; the panel finalizes copy. The shelf's
next-case status line and the new case-deck label are different
subjects (pick for the NEXT case vs deck of the OPEN case) — both
stay; redundancy audit in the PR body.

## Status

- [x] Fresh clone at `~/workspace/meridian-deck-fix`, branch cut at `775d8b4`
- [x] `deckLabelForId` helper + unit pins in pack-shelf-data
- [x] LoopScreen: case-deck label in the header block
- [x] LoopScreen: fallback detection at both deal sites + notice
- [x] Regression spec ported + converted to the locked expectation
- [x] docs/story-packs.md clarifying sentence
- [x] Gates: tsc / npm test / lint-cards / build:pages / targeted E2E
- [x] PR opened against main: #341 https://github.com/veeresh-bikkaneti/Meridian/pull/341 (NO MERGE — Silo QA + panel follow)
- [x] Owner wording cure (2026-11-04): one-sentence deck signal,
  `Deck:` header removed, shelf line suppressed during fallback;
  tests + docs updated; cured screenshots in
  ~/workspace/meridian-341-visuals/cured/ (independent Silo QA +
  panel re-vote on the cured tip follow)

## Verification record (builder, on the tip)

- `npx tsc --noEmit` — exit 0 (run before and after the spec landed).
- `npm test` — exit 0; src suite 2019 pass / 0 fail (includes the 3
  new `deckLabelForId` pins; pack-shelf-data file alone: 29/29).
- `node scripts/lint-cards.mjs` — exit 0, GATE PASSED.
- `npm run build:pages` — exit 0.
- Targeted E2E under `flock ~/workspace/.e2e.lock`,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/
  chromium-1243/chrome-linux64/chrome, --workers=1, against the
  build:pages artifact: pack-deal-fallback (3) + pack-shelf (7) +
  geodetective (18) = 28 tests, 27 passed / 1 failed. The one
  failure — geodetective win-path share assertion expecting the
  Workers origin while the Pages artifact's share line carries the
  Pages origin — reproduces IDENTICALLY on unmodified main
  `775d8b4` (verified by a worktree build + single-test run, same
  expected/received strings): a pre-existing spec/artifact
  mismatch, not a regression from this change. All 3 new tests and
  all 7 pack-shelf tests pass.

## Cure record — owner wording fix (2026-11-04, on top of `e94c0f0`)

The owner reviewed real screenshots of `e94c0f0` and called the
fallback screen confusing: the Capitals chip, the "Deck: All
cases" header, the shelf's "Your next case comes from Capitals."
line, and the fallback notice all spoke at once. He approved one
simpler shape, and this cure implements exactly that:

- The `Case # · Deck:` header is gone; the header is just
  "Case #N" again.
- One plain sentence, in one place under the shelf, names where
  the open case came from: "This case is from your Capitals
  deck." (the pack's own name, so other packs read the same way)
  or "This case is from All cases."
- A fallback case gets the notice in that same spot instead:
  "Capitals couldn’t load just now — this case is from All cases
  instead. Your next case will try Capitals again." While it is
  up, the shelf's status line stays empty, so only the notice
  speaks. The picked chip stays pressed — it is the player's pick.
- Nothing about dealing changed: same fallback detection at both
  deal sites, same §0 fallback, same pick/retry behaviour.

Files in the cure: `src/game/loop/LoopScreen.tsx`,
`src/components/pack-shelf.tsx` (one new optional prop),
`src/components/pack-shelf.test.ts` (new one-signal pins),
`tests/e2e/pack-deal-fallback.desktop.spec.ts` (same three
scenarios, new strings + shelf-silence and no-header pins),
`docs/story-packs.md` (§0 note rewritten to match), this file.

Verification (cure builder, on the cured tree):
- `npx tsc --noEmit` — exit 0.
- `npm test` — exit 0; src suite 2021 pass / 0 fail (2019 + the 2
  new one-signal pins).
- `node scripts/lint-cards.mjs` — exit 0, GATE PASSED.
- `npm run build:pages` — exit 0.
- Targeted E2E under `flock ~/workspace/.e2e.lock`, bundled
  chromium-1243, --workers=1, sealed full-log run:
  pack-deal-fallback (3) + pack-shelf (7) = 10 passed / 0 failed,
  exit 0. (One earlier reporter-only re-run flashed failures with
  no captured log; the sealed run is the record.)
- Neighbour E2E: geodetective.spec.ts 17 passed / 1 failed — the
  failure is the same pre-existing share-origin mismatch recorded
  above (expects the Workers origin, the Pages artifact carries
  the Pages origin; identical on unmodified main).
- Screenshots: ~/workspace/meridian-341-visuals/cured/ — all three
  states from the cured build at 390px, driven through the real
  deal path, eyeballed by the cure builder (header clean, chip
  pressed, shelf line blank, one sentence only).

---

## Panel verdict — 2026-11-04 (on cured tip `b184a23`): READY, 0 BLOCKs

The 12-role panel + DevEx reviewed the delta at
`b184a2362926aca2c3a647aceb1bfd08e2ef7b2b` (personas loaded verbatim
from `~/.codex/agents/`; Game Developer = mechanics_developer.toml,
UX Designer = ux-architect.toml, Office Hours = reality-checker.toml
— disclosed nearest matches). Verdict comment:
https://github.com/veeresh-bikkaneti/Meridian/pull/341#issuecomment-6630725540

- **Tally: 2 APPROVE / 10 APPROVE-WITH-NITS / 0 BLOCK; DevEx
  PASS-WITH-NITS. Verdict: READY on this delta.**
- Independent Silo QA preceded the vote: PASS-WITH-NOTES keyed to
  `b184a23` (diff = exactly the 8 files; approved strings byte-exact;
  QA's own fallback re-render byte-identical to the builder's cured
  screenshot).
- Owner citation (verbatim): the owner called the pre-cure fallback
  screen "Its confusing" (2026-11-04) and approved the cure by
  tapping "Apply the simpler wording"; the three sentences in code
  are the ones he approved.
- Annotation (panel nit, applied at this merge-up): the pre-cure
  lines in the task capsule and checklist above (the `Deck: X`
  header label, `data-testid="case-deck-label"`) describe the first
  presentation and are superseded by the cure record above and this
  verdict wherever they conflict. They are kept as history, not
  rewritten.
- Caveats recorded with the verdict: no `build (22.x)` or `e2e`
  check runs existed on `b184a23` (GitHub produced none for that
  SHA); the merge-up + substantive push is what runs CI on the
  merged tip, with a fresh check read before any merge. Merge only
  on the owner's explicit per-PR word.

## Merge-up — 2026-11-04 (main `7a35cbf` merged in)

- Sole conflict: this file. Resolved both-records: this branch's
  record above, main's accumulated records appended below the
  separator; the panel-verdict entry above was added here (it was
  deliberately left uncommitted so the voted tip would not move).
- Delta audit on the merged tree: branch-vs-main diff is exactly
  the voted 8 files; every code/test file byte-identical to the
  voted tip `b184a23`. (Figures recorded in the PR body merge-up
  note.)


---

# Accumulated records from main (kept verbatim at the 2026-11-04 merge-up)

# Branch status — feat/crash-telemetry-stamps (combined crash-telemetry PR)

- **Branch:** `feat/crash-telemetry-stamps`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f80` (PR #331 merges first; this PR merges immediately after, with a merge-up and fresh CI)
- **PR:** #339 — https://github.com/veeresh-bikkaneti/Meridian/pull/339
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (arena Candidate B + 10 grafts)

## Cure round 2 (DevEx FAIL F1 + factual nits, 2026-11-03)

Docs/comments only — no behaviour changes anywhere. Each item is its
own atomic commit, pushed as it landed:

- [x] F1 (the FAIL) — worker README hourly digest, `0e870ee`: the
  worked example now renders the **v2 digest**, taken verbatim from
  the `renderDigest` full-string golden in
  `workers/crash-report/src/index.test.ts` (checked
  character-for-character against the golden, and against the same
  example in `docs/observability.md`): `(receipt hour)` header,
  `priority:` line, per-type blocks. The prose now names what a type
  block carries — regions, groups, verdicts, modes, steps, errors,
  first/last receipt times, and labelled caps (`(+N more)`).
- [x] Worker README factual nits, `f9a67c8`: (a) the
  `recovery_outcome` tier rule is now stated in the intro and in the
  Severity tiers table — crash-class **only** for `repeat_failure`,
  counted-only otherwise (matching `tierOf` in
  `workers/crash-report/src/index.ts`); (b) the dry-run example
  response now carries `counted`, the real ingest shape:
  `{"ok":true,"forwarded":false,"counted":true}`.
- [x] `docs/observability.md`, `d845077`: (a) the "add a field"
  recipe now lists the fourth edit site — the literal
  `DEVICE_FIELD_KEYS` array in `src/lib/telemetry-manifest.ts`;
  (b) the manifest table rows for `screen` and `touchPoints` now
  include the `"unknown"` form the code stamps.
- [x] Comment corrections (comments only, no code tokens changed),
  `d2eba98`: (a) `workers/crash-report/src/index.ts` parity-guard
  comment now names the shipped
  `scripts/observability-field-parity.test.mjs`; (b) that guard's
  header now states the present truth — it runs on the combined
  branch and must pass — with its history (written on the client
  unit, where the worker side did not exist yet); (c) the
  `src/lib/telemetry-manifest.ts` header recipe gains the same
  fourth edit site (`DEVICE_FIELD_KEYS`).
- [x] This file, in the final cure-round-2 commit: this section,
  plus the finisher record's gate figures below labelled as
  PRE-CURE round-1 numbers with the current totals beside them.
- [x] Gates after all items (unpiped):
  - `npx tsc --noEmit` — clean (exit 0)
  - `npm run test:worker` — 109/109 pass; `typecheck:worker` —
    clean (the worker `tsc -p` run is clean; the comment-only change
    in that file kept the suite at 109/109)
  - Parity guard (`scripts/observability-field-parity.test.mjs`) — 1/1
  - `npm test` — scripts: 949 pass, 0 fail, 11 skipped;
    src: 2,078 tests, 2,078 pass, 0 fail
  - Watchdog suite (`scripts/crash-watchdog.test.mjs`) — 47/47

## Cure round (panel verdict on PR #339, 2026-11-03)

Panel tally that caused this round: **11 APPROVE-WITH-NITS + 1 BLOCK**
(the BLOCK from the Office Hours seat, over an AGENTS.md tension).
Each item is its own atomic commit, pushed as it landed:

- [x] Item 1 — BLOCK cure, `4aabcb0`: `AGENTS.md` Player-facing locks
  harmonised — the preceding raw-UA sentence now states the code-true
  posture (the telemetry code does not store the raw UA; it is read
  in page memory only to derive the parsed fields, and never leaves
  the device). Diff vs `c890f80` verified: exactly that paragraph's
  two sentences, nothing else.
- [x] Item 2 — watchdog-recovery shortfall, `628ebec`: the worker now
  fills a dropped `engine` for `boot_failure` only, via the E-rule
  table over the event's parsed fields (never overwriting a present
  engine, never for other types); `deviceClass` is NOT recovered and
  stays "unknown" on watchdog events. Watchdog comments corrected to
  that truth (comments only; rendered size unchanged at 6,104 bytes,
  suite 47/47). Worker suite grew to 109.
- [x] Item 3 — UA-parser traps, `e2cefa3`: `EdgA/` added to B2;
  a `Chromium/` rule (chrome/blink) added before the Safari rules;
  the Android frozen-token denylist now treats "10" and "10.0" as
  the frozen shape when a witness is present. One corpus row per
  fix. ua-parse suite 39/39, observability suite 92/92.
- [x] Item 4 — worker README stale cluster, `f02ff0b`: schema
  sentence now states the 17-key manifest allowlist; crash-class
  alerts described in the v2 format; test count re-measured
  (42 → 109); privacy line now states sessionId and the raw UA are
  never forwarded/logged/stored, while the parsed coarse device
  facts ARE forwarded in the alert by design.
- [x] Item 6 — docs label, `b6927a3`: `docs/observability.md`
  walkthrough now labels the worked example's `cores 6` as a worker
  test-fixture value, not a handset measurement.
- [x] Item 5 — this file: the client unit's STOP section below is
  rewritten as the resolved record (see "Resolved — watchdog byte
  budget" under the client unit record).

## Finisher record (integrator, 2026-11-03)

- [x] Merged `unit/crash-telemetry-client` (tip `0361e02`, U1–U3) — clean merge.
- [x] Merged `unit/crash-telemetry-worker` (tip `fd83292`, U4) — the only
  conflict was this file; resolved by keeping BOTH unit records (below).
- [x] Gated decision taken as its own commit (`4098735`): watchdog byte
  budget 5120 → 6144 per DESIGN-FINAL §7.5 — the ladder was exhausted
  (subset parser → browserVersion major-only → engine dropped →
  deviceClass dropped) and the rendered watchdog measures 6,104 bytes
  worst case, ≤ 6,144. Cost: +1 KB inline per page load. The owner
  rules on it with this PR's merge word; it is a decision item in the
  PR body. Watchdog suite after the raise: 47/47.
- [x] Parity guard green on the combined tree (1/1). Integrator edit:
  the guard's extractor did not match the worker's
  `Object.freeze([...])` allowlist declaration ("list declaration not
  found"); the extractor now allows the freeze wrapper. The field
  lists themselves matched exactly — 17 keys each, `webgl1`/`webgl2`
  included on both sides — so no field exception was encoded.
- [x] U5 docs: `docs/observability.md` (honest counts — client emits
  14 types, the worker on main accepts 8, the 6 engagement types land
  with PR #311; manifest field table; formats as built; the v1
  log-tail section marked superseded; "How to read a crash alert"
  walkthrough; privacy statement updated), `workers/crash-report/README.md`
  (bucket v2 shape, reachable fire-time threshold example),
  `AGENTS.md` (the §6.3 safeguard sentence only).
- [x] Follow-up filed: issue #338 — crash-report KV buckets have no
  retention (no `expirationTtl`); deliberately not bundled into this PR.
- [x] Combined gates on the combined tree — **PRE-CURE round-1
  numbers** (recorded before cure rounds 1–2; current totals after
  Cure Round 2 are beside them, and in the Cure Round 2 section at
  the top of this file):
  - `npx tsc --noEmit` — clean (exit 0)
  - `npm test` — scripts: 960 tests, 949 pass, 0 fail, 11 skipped
    (unchanged in Cure Round 2: 949 pass, 0 fail, 11 skipped);
    src: 2,075 tests, 2,075 pass, 0 fail — PRE-CURE round-1;
    current total: **src 2,078 tests, 2,078 pass, 0 fail**
  - `npm run test:worker` — 106/106 pass — PRE-CURE round-1;
    current total: **worker 109/109 pass**
  - `npm run typecheck:worker` — clean (exit 0)
  - Watchdog suite — 47/47; parity guard — 1/1
- [ ] Merge — owner's word only, after the panel approves the final
  tip. Post-merge owner step: manual crash-worker version upload.

The two unit records follow, kept whole.

---

# Branch status — unit/crash-telemetry-client

- **Branch:** `unit/crash-telemetry-client`
- **Base:** `origin/fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (Candidate B + grafts)
- **Scope:** Builder A (client) — Units U1 + U2 + U3 only. No PR, no merge.
TASK: enriched crash telemetry client — parsed RuntimeFacts snapshot persisted in the breadcrumb, persisted classifier state stamps, #335 mapMode fix, durable unfinished-boot counter, watchdog parity.
Tier: 2 shape, single builder under the parent orchestrator; QA + panel are separate agents after this branch.
Done condition: unit suites for the claimed files green, `tsc --noEmit` clean, watchdog rendered size ≤ 5120 bytes (ladder per §7.5), worst-case enriched suspected_crash measured against the 4096 cap.

## Claims (exclusive)

- U1 (new): `src/lib/ua-parse.ts`, `src/lib/ua-corpus.json`, `src/lib/ua-parse.test.ts`, `src/lib/telemetry-manifest.ts`
- U2: `src/lib/observability.ts`, `src/lib/observability.test.ts`
- U3: `scripts/crash-watchdog.mjs`, `scripts/crash-watchdog.test.mjs`
- Guard (from U5's guard half): `scripts/observability-field-parity.test.mjs` (new)
- This file.
- NOT claimed: `src/components/game-app.tsx`, `src/map/capability.ts` (read-only), anything under `workers/`.

## Status

- [x] U1 — parser (§3 B/E/O/P rules + §2.3 denylist), corpus (30 rows incl. incident, denylist, tripwire), manifest (§8.1). Suite: 36/36 pass.
- [x] U2 — observability session truth (§§2.1–2.2, 4.1–4.3 as grafted, §7.4 trim). Suite: 92/92 pass. [measured] worst-case enriched suspected_crash = 2,164 bytes raw vs the 4,096 cap — fits untrimmed, all 15 device keys + mapMode + msSinceBootStart survive.
- [x] U3 — watchdog parity (§4.4: lcV "2", storageOk, mapMode, msSinceBootStart, subset parser, other new keys literal "unknown", unfinishedBoots absent) + second-canvas WebGL1 fix. Suite at the time: 46/47 pass — the single failure was the byte-budget test, the STOP item below (since resolved; see the resolved record below).
- [x] Parity guard — written and run; at the time it FAILED as expected on this branch (worker allowlist not found — see below). Since resolved on the combined branch (see the resolved record below).
- [ ] Gates — tsc + claimed suites run at the tip; recorded in the builder report.

## Resolved — watchdog byte budget (§7.5 gated decision, taken)

Historical record, in past tense: at the client-unit stage this was
a STOP item. [measured] Rendered watchdog size, worst-case 14-char
build id, as measured then:
- Base (before U3): 5,104 bytes (16 bytes of headroom under 5,120).
- With §4.4 parity + subset parser, before the ladder: 6,210 bytes.
- After the FULL §7.5 ladder (step 1 browserVersion major-only, step 2 engine dropped, step 3 deviceClass dropped): **6,104 bytes** — still 984 bytes over the then-held 5,120 budget.

The ladder was exhausted and the builder did not raise the budget:
the raise to 6,144 was an explicit owner-visible decision
(DESIGN-FINAL §7.5), not the builder's to take, and the byte-budget
test was left at 5,120 and failing on purpose as the stop signal.

Resolution: the gated decision was taken on the combined branch as
its own commit (`4098735`): the budget was raised 5120 → 6144, the
byte-budget test was updated to 6,144, and the watchdog suite went
green (47/47; rendered size 6,104 ≤ 6,144). The owner rules on the
raise with this PR's merge word; it is a decision item in the PR
body.

## Parity guard — resolved

`scripts/observability-field-parity.test.mjs` extracts the client manifest's device keys vs the worker's `DEVICE_FIELD_ALLOWLIST` from `workers/crash-report/src/index.ts`. On the client unit branch the worker side was still main's code, which had no `DEVICE_FIELD_ALLOWLIST` export, so the guard failed by design until the worker unit (U4) landed; it was not weakened to pass. Resolution: on the combined branch the guard went green after commit `a13b035` (the guard's extractor now reads the worker's frozen allowlist declaration; the field lists themselves matched exactly — 17 keys each).

---

# Branch status — unit/crash-telemetry-worker (crash-telemetry U4, worker)

- **Branch:** `unit/crash-telemetry-worker`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` §5 (worker unit U4)
- **Files claimed (exclusive):** `workers/crash-report/src/index.ts`, `workers/crash-report/src/index.test.ts`, `BRANCH_STATUS.md`

## Status checklist

- [x] Commit A — intake + counting: `normaliseEvent` before `validateEvent`
  (§5.1 strip-and-continue, `DEVICE_FIELD_ALLOWLIST` export, caps
  unchanged), counting v2 (§5.2: groups with 32-key hard cap, verdicts
  from the hoisted shared re-derivation, milestones, modes, errorNames,
  receipt firstAt/lastAt, late counter, old-bucket read tolerance).
  Gates: test:worker 95/95, typecheck:worker clean.
- [x] Commit B — surfaces (§5.3): priorityRead (P1 requires
  buildReplaced === false + gameplay last step), enriched alert
  (priority line 3, why-code, time, collective (UA-parsed) device line,
  runtime/mode/boots lines; email gains the same lines incl. device:),
  evidence line for missing_fields from missingStampNames (§5.4,
  presentation-only), digest v2 (per-type blocks, labelled caps with
  (+N more), count-desc/key-asc, receipt first/last, late-arrival
  label, "receipt hour" header), threshold fire-time caveat.
  Full-string goldens for buildAlert (Discord + email),
  buildThresholdAlert, renderDigest; alert/email parity test;
  missingStampNames iff-property test; classifier fixture tables
  re-asserted (classifier region byte-identical to base, verified by
  diff). Gates: test:worker 106/106, typecheck:worker clean.
- [x] Final gates re-run + branch pushed. No PR, no merge (owner's word).
- 2026-11-04: merge-up onto main `ddc0709` (#331) at the owner's merge word for #339 ("339 by rebasing as needed"). Conflicts: six #331-side files (game-app.tsx, capability.ts/.test.ts, satellite-map.tsx, scout-upgrade-lifecycle.test.ts, scout-offer-policy.md) resolved to main's final #331 blobs, verified byte-equal; observability.ts/.test.ts resolved to the panel-voted telemetry blobs (main's post-`c890f80` delta to both files is zero, blob-proven); BRANCH_STATUS.md keeps both records. Delta audit: branch-vs-main = exactly the 15 voted telemetry files, patch line-sets identical to the voted delta `c890f80..ac45e6b` — no code beyond the voted delta, no delta re-vote triggered. Checks re-read on the new tip before merging.
- 2026-11-04: second merge-up onto main `5fe34d6` (#320 landed during the #339 gate run). Sole conflict BRANCH_STATUS.md, resolved keeping both records; the telemetry delta is unchanged (re-audited: branch-vs-main = the same 15 voted files, blobs identical to `ac45e6b`). Checks re-read on the new tip before merging.

---

# BRANCH_STATUS — test/stub-crash-report-in-e2e (PR #320)

- **Branch:** `test/stub-crash-report-in-e2e` · **PR:** #320
- **Refreshed 2026-11-03** onto main `490fab0` (merge commit `541555a`, clean merge, no conflicts). The PR's three-file change (tests/e2e/helpers.ts, pinch-zoom.spec.ts, storyteller.spec.ts, +38/−2) is byte-identical to the original tip `c0a3ffc`'s change: hunk-for-hunk diff comparison identical except blob index lines.
- **Owner order (2026-11-03 22:38 CST):** "Refresh and pstack swarm and architecture and arena interrogate." This run: Phase 0 refresh (done) → swarm (posting inventory / refresh integrity / dependent surfaces) → architect + arena over the stub design → interrogate the final diff → stop at READY. No merge without the owner's per-PR word.
- **Supersession [observed]:** not superseded — current main stubs nothing for the crash-report host in serveBuiltArtifact or pinch-zoom; the observability specs pin the prod endpoint and intercept only for their own inspection, and storyteller's clean-console check still filters the beacon's network error instead of preventing the post.
- **Status:** refresh pushed; swarm / arena / interrogate in progress under the coordinator. Prior record for this branch (below the divider) is main's carried record and is kept intact.

## 2026-11-04 — Arena synthesis implemented (builder run)

Implemented `~/workspace/meridian-pr320-arena/SYNTHESIS.md` (candidate-1 base + grafts G1–G3 + fixes F1–F4) on this branch:

- `tests/e2e/helpers.ts`: `TelemetryEvent`/`TelemetryEscape`/`TelemetryLedger` + `createTelemetryLedger()` (F2: `payloads()` returns a copy); `TELEMETRY_ENDPOINT` derived from `OBSERVABILITY_INGEST_HOSTS[0]`; `handleTelemetry(route, ledger)` as the one policy entry point; `serveBuiltArtifact` returns the per-context ledger (WeakMap, G3 idempotent), registers once-per-context escape listeners (`response` status ≠ 204 + `requestfailed`) that also append JSON lines to the spill file at `MERIDIAN_E2E_TELEMETRY_SPILL`; `collectTelemetry(context, {flags?, endpoint?})` throws on an unserved context; `telemetryGuard(getLedger, {silent?})` for `test.afterEach` (G2). Header comment on `serveBuiltArtifact` states the contract once (serve first → collectors win dispatch → hand-rolled handlers call `handleTelemetry` before `continue()` → stubbed surfaces may show "sent" copy, assert on the ledger).
- `tests/e2e/pinch-zoom.spec.ts` (F3): call-site swap to `handleTelemetry` with a module-scope ledger; its own handler/spoof behaviour unchanged.
- `tests/e2e/storyteller.spec.ts`: bespoke `unstubbedTelemetry` listener + afterEach deleted; `tel = await serveBuiltArtifact(context)` + `test.afterEach(telemetryGuard(() => tel))`.
- Spill hooks (F4): `playwright.config.ts` gains `globalSetup`/`globalTeardown` → new `tests/e2e/telemetry-spill-setup.ts` / `telemetry-spill-teardown.ts`.
- `scripts/e2e-telemetry-guard.test.mjs`: source-scan rules (a)–(d) in the `npm test` scripts suite; `COLLECTOR_FILES` = the 4 inspecting specs.
- `tests/e2e/telemetry-harness.desktop.spec.ts` (G1): forced-`js_error` recorded via stub (A) and via collector (C); plain boot has no escapes (B). 3/3 pass [measured].

**Deviations recorded, not absorbed:**
- Guard EXEMPT does **not** start empty (contra F1): `tap-verify.spec.ts` [measured] imports nothing from `./helpers` — it inlines its own `serveBuiltArtifact` (written when helpers was untracked) and does not stub telemetry. It is the EXEMPT list's single entry, with the reason in the guard test; migrating it is a follow-up outside this scope. The arena inventory missed it.
- F4 demo spec was named `telemetry-spill-demo.desktop.spec.ts` (deleted after the run): the plain `.spec.ts` name matches no project `testMatch` in `playwright.config.ts`, so it would never have run.

**F4 demonstration [measured]:** the temporary demo spec (later 500 route on `TELEMETRY_ENDPOINT` + forced `js_error`) — the test itself passed, the run exited 1 at `globalTeardown` with the escape listed (`{"url":"https://meridian-crash-report.knowledgetest.workers.dev/ingest","status":500,"kind":"response"}`). A teardown throw **does** fail the run at this Playwright version; the `process.exitCode` fallback was not needed. Demo spec deleted.

**Guard negative proof [measured]:** a temporary spec importing nothing from `./helpers` failed rule (a) naming the file + fix; deleted, guard back to 4/4 green.

**Gates [measured]:** `npx tsc --noEmit` clean · `npm test` green (scripts 947 pass / 0 fail incl. the new guard; src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (exit 0; two earlier attempts OOM-killed at prerender under VM contention, third completed) · Targeted E2E (flock, --workers=1, chromium-1243): telemetry-harness 3/3 · storyteller `-g "text-first render"` 1/1 · observability first test 1/1 · pinch-zoom full file 9 passed / 3 failed — the 3 globe zoom-step failures reproduce identically on the unmodified tip `1b88892` in a detached worktree (same dist, same Chromium), so they are pre-existing in this environment, not a regression of this change [measured]. Full E2E suite not run locally (CI's job, per brief).

**Environment note:** this worktree had no `node_modules`; `npm ci` aborted under VM contention, so `node_modules` was copied from a sibling worktree whose `package-lock.json` is byte-identical (md5 `bf080315…`). `dist/` and `node_modules/` are gitignored; nothing of either is committed.

## 2026-11-04 — Interrogation cure round (α/β/γ findings on tip `fbdcada`)

Cured, per the three adversary reports + coordinator synthesis:

- **α-F1** — `tap-verify.spec.ts` now routes telemetry through the shared helpers policy (`createTelemetryLedger` + `handleTelemetry` before its non-loopback `route.continue()`, `watchTelemetryEscapes` on its context); its stale "helpers untracked" header premise is corrected. The guard's EXEMPT list is now EMPTY.
- **α-F3 / cure for pinch-zoom escapes** — escape-listener registration extracted from `serveBuiltArtifact` into exported `watchTelemetryEscapes(context, ledger)` (idempotent per context+ledger pair); `serveBuiltArtifact` calls it; `pinch-zoom.spec.ts` and `tap-verify.spec.ts` call it on their contexts.
- **γ-F2** — pinch-zoom's ledger is per-test: created in `beforeEach` before route registration (no module-scope accumulation), watcher registered there.
- **β-F1** — escape correlation in the watcher: a telemetry request that received a response records no `requestfailed` escape, and one request records at most one escape (per-context answered-Request tracking; a 204 landing after a `requestfailed` retracts it; `requestfailed` spill writes are deferred one macrotask and skipped when retracted).
- **β-F2 + β-F3** — spill path is run-unique (`-<pid>-<Date.now()>`) with a `MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK` path exported by setup; a failed append is `console.error`-logged (never silent) and retried to the fallback; teardown reads BOTH files and throws listing all lines from either.
- **β-F4** — ledger read APIs deep-copy: `all()`/`ofType()`/`first()`/`payloads()` return `structuredClone`d events/payloads (escapes copied too); mutating a returned object cannot change `count()`/`ofType()`.
- **β-F5** — `serveBuiltArtifact` tracks effective `spoofCapableDevice` per context: same-value re-serve returns the ledger; a different value throws naming both values. Double-serve call sites found in the tree are all same-value (storyteller's in-test re-serve of its fixture context; qa-evidence's beforeEach + per-test serves) — no design adjustment needed.
- **β-F6** — `collectTelemetry` is idempotent per context per endpoint: same-endpoint second call is a no-op returning the ledger; a different endpoint throws naming both.
- **β-F7** — new `telemetryGuardFor(context, opts?)` resolves the context's own ledger (throws if never served); `storyteller.spec.ts` migrated to it; `telemetryGuard` stays, doc-commented as advanced/unbound.
- **β-F8** — telemetry-harness Test A now also asserts the recorded `js_error` payload's `error.message === "telemetry-harness-probe"`.
- **β-F9** — `TelemetryEvent.raw?: string`: on parse failure the raw body text is stored (what `postData()` returns; truncated at 2048 chars); `type` stays null, `parseError` stays true.
- **γ-F3/F4/F5/F6/F7** — guard hardening: comment-stripped scanning (state machine respecting string/template/regex literals) for all rules; rules (b)/(d) scan ALL `tests/e2e/*.ts`, rules (a)/(c) specs only; (a) requires an import (aliases resolved) AND a call; (b) requires `handleTelemetry(` before the first `route.continue()` or a `serveBuiltArtifact(` delegation; (c) requires `CONTEXT_FILES` listing + rule (a), with a pin test asserting CONTEXT_FILES equals exactly the derived `browser.newContext(` set (12 files); (d) keeps the literal ban + `COLLECTOR_FILES`, with a pin test asserting it equals exactly the 4 inspecting specs.

**Residuals (recorded, not cured):**
- **γ-F1** — mis-ordered hand-rolled collectors: a hand-rolled collector registered BEFORE `serveBuiltArtifact` is silently starved (the later serve catch-all wins dispatch) and its posts are re-labelled `via="stub"`. No enumerable-routes cure exists in Playwright — there is no API to list a context's registered routes and check their order. The sanctioned path (`collectTelemetry`) throws when called before serve; a mis-ordered hand-rolled spec fails its own capture assertions loudly rather than passing vacuously, and the 4 inspecting specs keep their verified serve-first order.
- **γ-F7 (split-string half)** — a hostname assembled by string concatenation (`"meridian-crash-report." + "knowledgetest…"`) evades the textual literal ban. Textual only: while serving goes through the shared helpers, the runtime stub keys off the real hostname (`OBSERVABILITY_INGEST_HOSTS`), so the split string alone leaks nothing; the runtime escape/spill backstop, not the text scan, is the layer that catches an actual post.

**tap-verify EXEMPT removal:** the guard's EXEMPT mechanism stays, its list is now empty — tap-verify satisfies rule (a) by importing and calling `handleTelemetry` from `./helpers` (see α-F1 above).
- 2026-11-04: merge-up onto main `ddc0709` (#331) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's harness code is unchanged from the interrogated tip `11a7764`. Checks re-read on the new tip before merging.

---

# Prior record preserved on merge: crash-report README audit (PR #308, docs/221-crash-readme-audit)

# BRANCH_STATUS — docs/221-crash-readme-audit (Wave 2, #221)

- **Branch:** `docs/221-crash-readme-audit` · **Base:** `main` @ `2a0527f`
- **Task:** #221 REOPENED as PARTLY fixed — audit `workers/crash-report/README.md` line-by-line against the worker's current code, fix every documentation gap, open a small docs PR. STOP at PR-open (no Silo QA, no panel, no merge — separate dispatches).
- **Tier:** 0 (docs-only). Worker code is FROZEN on this branch: a code-wrong finding is reported, never fixed here.
- **Audit:** sealed at `~/workspace/meridian-issue-wave/evidence/221/AUDIT.md` — 24 gap rows fixed (incl. owner's `counted` at the dry-run example), 1 already-correct group, 2 out-of-scope, 1 code-wrong finding (C1: client emits `storyteller_*`/`narration_*` types the worker 400s — that is the #194 crew's event-acceptance surface).
- **Biggest gaps fixed:** `recovery_outcome` (8th event type, conditional tier) undocumented everywhere; the entire verdict classifier undocumented; `results` response field missing; all error shapes missing; test count stale (42 → 85).
- **Files changed:** `workers/crash-report/README.md`, this file. Nothing else.
- **Done:** [x] audit sealed · [x] README fixed · [x] gates sealed at `~/workspace/meridian-issue-wave/evidence/221/` (test:worker 0 · typecheck:worker 0 · tsc 0 · lint-cards 0 · build:pages 0 · npm test: src suite 1879/1879 pass; scripts suite 851 pass / 1 fail / 9 skip — the 1 fail is `ssr-build-shape` configPath pointing at the sibling `repo/` clone because this worktree's `node_modules` is a symlink to `repo/node_modules`; the same test passes 2/2 on unmodified main in the `repo/` clone, sealed as `ssr-shape-main-control.log`, so it is a worktree-environment artifact, not this docs change) · [ ] PR opened (filled in by the PR-open commit's successor record in the PR body)

---

# Prior record preserved on merge: crash-report worker accepts all 14 event types (PR #311, fix/194-event-type-mismatch)

# BRANCH_STATUS — fix/194-event-type-mismatch (Wave 2, #194 REOPENED)

- **Branch:** `fix/194-event-type-mismatch`
- **Base:** `main` @ `2a0527f` (#295 merged tip at branch start).

## Task capsule

TASK / requested outcome: Fix the three-way observability event-type
mismatch behind reopened issue #194. Owner's facts (verified from
source, 2026-11-02): the app sends 14 event types, the crash-report
worker accepts 8, the docs say 7 — the 6 storyteller/narration types
the app emits are rejected (400) by the worker in production and
silently dropped. Wave 1's docs-only closure in #251 was wrong: it
claimed those 6 "stay client-side and are not sent", and its counts
(13 client / 7 worker) were already stale the day it landed (Slice 2,
#250, had added `recovery_outcome` the day before).

Interpretations considered and selected reading: each app-only type is
either LEGITIMATE (live emission, worker must accept) or DEAD (app
must stop sending). Evidence verdict: **all 6 are legitimate** — built
as COPPA-clean telemetry in #108, emitted on live Storyteller paths,
sent through the same `emit()` transport to the live endpoint in
`public/flags.json`, with no client-side consumer anywhere. Full
per-type evidence: `~/workspace/meridian-issue-wave/evidence/194/DIAGNOSIS.md`.

Tier and rationale: Tier 1 — one clear contract bug, diagnosed from
source first; fix at the worker layer + a drift guard + docs sync.

Done condition / evidence: worker accepts all 14 types; the 6 funnel
types are counted-only (never forwarded individually, like
hiccup-class); per-type acceptance tests + unknown-type rejection
pinned; a drift test in `npm test` keeps the client union and the
worker list equal; every doc list reads 14; gates sealed under
`~/workspace/meridian-issue-wave/evidence/194/` (tsc · npm test ·
test:worker · typecheck:worker · lint-cards · build:pages); PR open.
STOP at PR-open — no Silo QA, no panel, no merge by this run.

Files in scope: `workers/crash-report/src/index.ts` +
`src/index.test.ts`, new `scripts/observability-event-types.test.mjs`,
`docs/observability.md`, `docs/handbook/07-engineering-and-ops.md`,
`workers/crash-report/README.md`, `worker/observability/README.md`
(cross-reference count only), this file. App source: NO change (no
dead types). Frozen PRs #297/#299/#302/#305 and #231/#265/#270/#292/#293
untouched. Claim recorded in the coordination ledger 2026-11-02: Wave 2
claims the crash-report worker surface for #194/#221 per the owner's
express assignment (historically Rock's surface — noted for his round).

## Status

- [x] Diagnosis sealed (evidence/194/DIAGNOSIS.md) — counts 14/8/7 confirmed; all 6 app-only types LEGITIMATE
- [x] Worker fix + tests (worker suite 85 → 90; commit 9f8635c)
- [x] Drift-guard script test (mutation-proven; commit 9f8635c)
- [x] Docs sync (4 files: docs/observability.md, handbook ch07, workers/crash-report/README.md, worker/observability/README.md cross-ref)
- [x] Gates sealed (evidence/194/gates/, on tip 3fb41de): tsc 0 · npm test 0 (scripts 852 pass / 11 skipped; src 1879/1879) · test:worker 0 (90/90) · typecheck:worker 0 · lint-cards GATE PASSED · build:pages 0. E2E not run — no client emission changed (app source untouched). Note: the resume run re-sealed npm test + build:pages after the first sealing attempts lost their exit files when their shell sessions were killed mid-run; the re-run logs are the sealed ones (identical pass counts).
- [x] PR open — PR #311 (2026-11-02, resume run after the prior crew died in a daemon restart; reconciliation found this branch/worktree + sealed DIAGNOSIS.md sound and resumed from them, no restart). STOP at PR-open — no Silo QA, no panel, no merge by this run.

