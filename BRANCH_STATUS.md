# BRANCH_STATUS — feat/geodetective-end-game

- **Branch:** `feat/geodetective-end-game` · **Base:** `main` @ `566c955` (PR #363 merged + live)
- **Design of record:** owner report + ruling (Veeresh, 2026-11-07, in the
  `meridian` side chat), diagnosis `DIAGNOSIS-endgame.md` (evidence folder),
  handbook ch.02 §2 (decision record lands with this PR).

## Task capsule

TASK / requested outcome: GeoDetective shipped with NO End game control,
no end-session action, and no session summary (diagnosis proven in code +
live DOM: mid-case controls are Editions / sound toggle / deck chips /
Hint / pair speech controls only; `src/game/loop/store.ts` has no
end/finish action; the only summary is the per-case reveal; leaving via
Editions is a pause — Home offers resume, case stays `playing`). Map
editions got the equivalent fix in #264. Build: an `endSession` store
action + a session summary surface + a header End game button beside
Editions whose confirm surface offers BOTH of the owner's capabilities.

OWNER RULING (Veeresh, 2026-11-07 14:27 CST, amended within the minute —
the amendment governs): the End game flow offers BOTH capabilities and
the player picks; neither is a stray-tap default:
1. **End outright** — session closes, summary shows; the in-flight case
   is discarded: not resumable, not counted solved or lost, streak
   untouched (it is not a loss).
2. **Pause & resume later** — session closes, summary shows (closed
   cases only); the in-flight case is preserved exactly (same
   clue/guess state) and Home offers resume afterwards; when later
   resumed and closed it counts once, when it closes.
Both paths show the summary and fire the pair's game-end celebration
on it (the #355 machinery/pattern).

Interpretations considered and selected reading:
- "Session summary" contents = the brief's own list, all standing
  store values: cases closed (totals.solved + totals.lost), the
  solved/lost split, current streak, best streak, per-deck progress
  (cycle, cycleCompleted, remaining, open-case flag). The loop store
  has no session-start snapshot and none is invented; copy never calls
  the standing totals "this session only".
- The classic `SummaryDetectiveCelebration` component is NOT reused:
  its props and frame are score-shaped (`totalScore`, per-edition
  score rows, "your score of N" aria) and GeoDetective has no score.
  Reused instead, verbatim: the machinery — DetectivePair rigs,
  CELEBRATE_LAYOUT, the U8 dwell timings, `createCelebrationLinePlayer`
  (the fixed "What a game! Well played, everyone!" line carries no
  number), and `resolveSummaryCelebrationMode`. A loop sibling mount
  (`LoopSummaryCelebration`) carries the loop's own stats in frame.
- Cold Trail does NOT share the loop store or screen (its own
  `src/game/coldtrail/store.ts` + `TrailScreen.tsx`; it borrows only
  LoopMap). It is therefore NOT cured by this PR — stated in the PR
  body; its equivalent is a follow-up on the owner's word.
- The brief's note that geodetective.spec.ts pins end-game-button
  count 0 was checked against main `566c955`: no such assertion
  exists in the tree (no `end-game` string in any GeoDetective spec).
  The diagnosis's runtime DOM enumeration (count 0 mid-case) is the
  evidence of absence. New E2E pins the presence + both paths.

Tier and rationale: Tier 2 — new feature, 3+ files, store-level state
semantics. Run as a builder silo under the coordinator's brief;
independent Silo QA + 12-seat panel + DevEx + benchmark follow.

Done condition / scenarios / evidence:
- Unit: `endSession` outright discards only a `playing` current (a
  finished current is untouched), never moves streak/totals/counters;
  pause returns the store unchanged; `loopSessionSummary` derives
  closed-only counts + per-deck progress incl. the open-case flag.
- E2E (new `tests/e2e/geodetective-endgame.spec.ts`): button present
  mid-case at 390/768/1280/1440; pause path at 390 + desktop (summary
  totals exclude the open case; Done → Home resume offer; resume
  restores the exact clue/guess state); outright path at 390 +
  desktop (summary shows; Home has NO resume offer; reopening deals a
  fresh case); a case closed after a pause-end counts exactly once;
  ending from a reveal (no case in flight) uses the single-confirm
  variant and counts the just-closed case; Editions-leave unchanged
  (existing geodetective suite stays green).
- Gates: tsc clean · npm test green · lint-cards GATE PASSED ·
  build:pages green · detective/geodetective E2E suites green ·
  post-merge live screenshots (button mid-case + summary, 390 + 1280,
  both hosts).

Files in scope: `src/game/loop/store.ts` (endSession +
loopSessionSummary + types), `src/game/loop/store.test.ts` (unit
pins), `src/game/loop/LoopScreen.tsx` (header button + choice dialog
+ summary switch), `src/game/loop/LoopSessionSummary.tsx` (new —
summary surface), `src/game/loop/LoopSummaryCelebration.tsx` (new —
pair celebration mount, lazy), `tests/e2e/geodetective-endgame.spec.ts`
(new), `docs/handbook/02-game-design-decisions.md` (§2 record),
`README.md` (one GeoDetective sentence), this file.
Protected / untouched: DetectiveHost/DetectivePair state machines,
the classic run/session flow (`game-app.tsx`, `session.ts`,
`run-summary.tsx`), Cold Trail, PR #340's header-counter line,
PR #364's detective files.

Dependencies / ordering: PR #340 (fix/337-guess-counter) touches the
LoopScreen header counter expression — read its diff; if it merges
first, merge-up over it (this PR does not touch that line). PR #364
(feat/holmes-follow) touches detective files only — different surface.
Verification contract: clean-silo QA keyed PR#+tip → 12-seat panel
(personas verbatim from ~/.codex/agents) → DevEx → benchmark → fresh
CI (build 22.x, e2e, GitGuardian) → merge on READY/READY-WITH-NITS
(ship-when-ready, owner's standing directive 2026-11-04) → live
build-meta both hosts + screenshots.
Assumptions / risks: the summary is a transient screen state (like
the classic summary) — a reload on the summary reopens the loop,
which resumes (pause) or deals fresh (outright); recorded, accepted.
An outright-discarded case: the original capsule claimed it was
consumed from its cycle (the clampDeckToPoolSize abandonment
precedent) and that the only consequence was a shortfall if that pack
later grew. **That framing was WRONG — corrected on the record
(panel round 1, Level Architect BLOCK, verified by the coordinator
against the code):** the pack shortfall fires on ordinary same-size
re-entry, not only after growth. A discarded pack case left the deck
accounting identity (closed + open + in-deck = cycle size) short by
one, so on the player's very next visit ensurePackDeck appended the
manifest's tail case as a false "new" case — a duplicate dealt twice
in one cycle — and a cycle containing a discard could "complete" one
case early while the celebration copy claimed "all / every". **Cure
(return-to-tail):** endSession's outright path returns the discarded
case's index to the TAIL of its own deck before clearing `current`
(guarded against duplicates). The case's progress is discarded — not
counted, streak/totals untouched, not resumable — but the case itself
stays in its cycle, may be dealt again fresh later in the cycle, and
the accounting identity stays exact.
Simpler / rejected: wiring the loop into the classic session
(`session.ts`/`requestEndGame`) — rejected: the loop is a separate
store, separate persistence namespace, and score-free; a bridge
would duplicate truth across two stores. Reusing
SummaryDetectiveCelebration — rejected above (score-shaped).
Budget: Tier 2 parent cap 400k tokens (repo default), shared across
coordinator + delegates.
Approvals: PR + merge under the coordinator's assignment
(ship-when-ready); branch protection untouched.

## Status

- [x] Diagnosis verified against main `566c955` (code + spec grep)
- [x] Capsule committed (first commit)
- [x] Store: endSession + loopSessionSummary + unit tests
- [x] UI: header button + two-option choice dialog
- [x] UI: LoopSessionSummary + LoopSummaryCelebration
- [x] E2E: geodetective-endgame.spec.ts (both paths, 4 widths)
- [x] Docs: handbook §2 record + README sentence
- [ ] Builder gates (tsc / npm test / lint-cards / build:pages)
  - Builder note (2026-11-07): tsc clean · npm test green · lint-cards GATE PASSED · E2E spec collects (7 tests). `build:pages` NOT green locally: 4 attempts, vite build completed + dist written every time, prerender crawl OOM-killed (exit 137) under concurrent crew load on the VM — CI build is the clean read.
- [x] PR opened — #365 https://github.com/veeresh-bikkaneti/Meridian/pull/365
- [x] Panel round 1 cure — Level Architect BLOCK (deck accounting) + Economy major nit cured by return-to-tail in `endSession`; Senior Developer / UX Researcher keyboard-modality guards, UX Designer summary fixes, Game Developer unit pins (items A–C in the PR body's "Panel round 1 — cure" section)
- [ ] Silo QA (keyed PR#+tip)
- [ ] Panel 12 seats by name + DevEx + benchmark
- [ ] Merge on verdict + branch deleted + tip SHA ledgered
- [ ] Live verification: build-meta both hosts + screenshots
