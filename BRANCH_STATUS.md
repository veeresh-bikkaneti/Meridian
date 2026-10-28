# BRANCH_STATUS — feat/reset-history-and-card-fix

- **Branch:** `feat/reset-history-and-card-fix` (**PR #281**)
- **Base:** `origin/main` at `bf0f8be` — **rebased 2026-10-28** from
  the original base `ab21c1c` onto current main (#278 pre-flip
  hardening, #279 friendChallenges ON, #280 status record; friend
  challenges are LIVE on main — this branch changes nothing about
  them). The rebase's only content conflict was this file, resolved
  by whole-file supersession (the branch's own status record).
- **State:** **BUILT, GATED, PANELED — PR #281 OPEN, NO MERGE.**
  Panel on tip `2ea97fc` (pre-rebase): NOT READY as voted
  (5 APPROVE / 6 APPROVE-WITH-NITS / 1 BLOCK / DevEx FAIL) — the
  BLOCK's premise is refuted by a probe E2E on the final tip and
  the DevEx record cures are dispositioned in the PR body and the
  Panel record below. Final reconciliation (run report Stage 9):
  no sustained BLOCK — the Game Feel seat's final report is
  APPROVE-WITH-NITS; the DevEx FAIL stands on F1–F3, of which F2
  was cured by the Stage 8 rebase record and F3's wording is
  corrected in this file. The F1 documentation cure is committed
  on the owner's order (2026-10-28, "Cure the F1 docs, then
  re-vote"); the panel re-vote on the cured tip is the next step
  and its verdict will replace this paragraph. NO MERGE — the
  owner merges on his per-PR word.
- **Task:** owner's words 2026-10-28 — "reset means now game remembers
  how many i missed, soon it will become huge, I want game allowing
  user to reset the past misses, so i can reset and start over
  deleting his game history. also fix the button overlay."
- **Manifest:** `.council/manifests/2026-10-28-reset-history-and-card-fix.md`
  (APPROVED as amended, token `AUTH_RUN_TDD_IMPLEMENTATION`)

---

## What this branch delivers

1. **Part 1 — "Start over" reset (history wipe).** Entry points on the
   home Review card (deck total > 0) and on `ReviewComplete`; one
   `alertdialog` confirm mirroring `AgeProfileSettings` with locked
   copy (manifest §4). Clears exactly the manifest §2 CLEARED set
   (deck, learning, seen/cleared, loop + coldtrail stores and open
   flags, session + paused run + drop) via per-store owner-module
   clears composed by `src/game/reset-history.ts`; honest partial
   failure (`{cleared, failed}` + post-clear re-read, success toast
   only when `failed` is empty); home refreshes in place via
   `meridian:history-reset` + `historyResetEpoch` (D6/D14/D16).
   Badges and the first-win flag are KEPT (D2, open question OQ1).
2. **Part 2 — Review-card overlay fix.** The decorative REVIEW cue
   `.hv5-review-cue` sits inside the illustration box `.hv5-art` by
   construction; fix is scoped to the review card (manifest D9) with
   bounding-box non-overlap asserted at 360/390/1024/1280.

## Stage tracker

- [x] Stage 0 — clone, branch, `npm ci`
- [x] Stage 1 — research (store inventory, root causes)
- [x] Stage 2 — council manifest committed alone (`f681e92`)
- [x] Stage 3 — Part 2 build (see Part 2 record below)
- [x] Stage 4 — Part 1 build (Layer-2 RED recorded below → unit
  GREEN; E2E has two named open items carried to Stage 5 — see
  "Part 1 E2E state at commit 2" below)
- [x] Stage 5 — all 5 AGENTS.md gates on the final tip (see Gate
  record below)
- [x] Stage 6 — full panel (12 seats + DevEx) on tip `2ea97fc`:
  NOT READY as voted (see Panel record below)
- [x] Stage 7 — PR opened (**#281**, no merge); branch rebased onto
  `bf0f8be` at PR stage (this file was the only conflict)
- [ ] Stage 9 — DevEx F1 docs cure (owner's call 2026-10-28:
  "Cure the F1 docs, then re-vote"): §12 in
  `docs/learning-outcomes.md`, §14 in handbook ch. 02, one README
  paragraph, F3 wording correction in this file — docs-only commit;
  full panel re-vote on the cured tip follows (record:
  `~/workspace/meridian-reset/REVOTE-281.md`)

## Part 2 record (Stage 3)

- **Fix (as committed):** cue-only move in `src/components/home-v5.css` —
  `.hv5-review-cue` goes from `bottom:14px` to `top:14px` (top-right is
  the card's one empty zone: head content is left-anchored, art is
  bottom-anchored, and the in-flow CTA box occupies the bottom-left —
  measured at all four contract widths). Shared `.hv5-art` rule and
  sibling spot cards untouched.
- **Tests:** non-overlap assertions (single-evaluate rect snapshots,
  0.5px epsilon) at 360/390 in `mobile-home-overlap.spec.ts` and at
  1280/1024 in `card-redesign.desktop.spec.ts`. Desktop suite 11/11
  GREEN. Tip subset (22 tests): the new cue tests pass; all other
  failures in these suites reproduce on pristine base `ab21c1c`;
  tip adds ZERO new failures. (Attribution corrected per DevEx F3:
  an earlier draft of this record cited "239 distinct failures" —
  a figure that aggregates repeated runs and cannot be a
  distinct-test count for the ~37 tests in these suites. The
  attribution rests on the Stage 5 re-run of the 26-test mobile
  suite with the cue tests passing, log in
  `.tmp/gates/e2e-mobile2.log`.)
- **RED evidence:** pre-fix probe — cue box 100% × 97.8% inside the
  art box at 390px (`evidence/probe-part2-before-390.json`);
  `evidence/part2-before-390.png` shows the pill on the satchel.
  Disclosed gap: the builder's RED *test* run passed vacuously (its
  new assertions sit after base-failing tests in the same file), so
  the deterministic RED record is the probe, not a failing-test
  signature. The after screenshot is retaken in Stage 4.
- **Recovery note (coordinator, 2026-10-28):** the Part 2 builder's
  test runs were real (logs on disk), but its claimed commit never
  landed — the finished tree sat in `stash@{0}` after its baseline
  stash cycles, and its summary described an earlier fix iteration.
  The coordinator recovered the stash, verified the diff, and
  committed it. Both Part 2 suites get a mandatory re-run on the
  final tip at the Stage 5 gates.

## RED evidence (manifest D8 — Layer-2 run recorded before GREEN)

- **Command:** `node --experimental-strip-types --test src/game/reset-history.test.ts src/game/review-deck.test.ts src/game/trail.test.ts src/game/loop/store.test.ts src/game/coldtrail/store.test.ts`
- **Setup:** stub `resetHistory()` returning `{ cleared: [], failed: [] }`
  and stub per-store clears returning `false` (no-ops) — Layer-2, not
  Layer-1 (every import resolves; the failures are behavioural).
- **Result:** 143 tests, 127 pass (all pre-existing), **16 fail — every
  failure is a new Part 1 test:**
  - `U-R1 master sentinel: every cleared key gone, every kept key byte-identical` — `AssertionError: deep-equal: actual [] vs expected ['coldtrail','geodetective','learning','paused-run','review-deck','session','trail']` (the stub clears nothing)
  - `U-R2: a second reset is a no-op and still reports success`
  - `U-R3: throwing removeItem falls back to overwriting the empty value`
  - `U-R4: throwing enumeration fails only the trail store, never throws`
  - `U-R5: one blocked store does not abort the others`
  - `U-R6: injected storage is honoured — the globals are never touched`
  - `U-R7: the loop and coldtrail open flags are removed`
  - `U-R8: coldtrail v1-only seed cannot resurrect after reset`
  - `U-R8: trail v1-only seen keys cannot resurrect after reset`
  - `clearReviewDeck removes the deck key and reports success` — `false !== true`
  - `clearReviewDeck: a throwing removeItem falls back to the empty deck`
  - `clearTrailHistory removes seen v2 (scoped + unscoped), seen v1, and cleared marks only` — `false !== true`
  - `clearTrailHistory honours an injected storage and leaves the global alone` — `false !== true`
  - `clearLoopStore removes the v2 store and the open flag, never the v1 archive`
  - `clearLoopStore honours an injected storage and leaves the global alone`
  - `clearColdtrailStore removes v1 before v2, plus the open flag; load is fresh`
- The new negative-shape tests (blocked storage → `false`, never throws)
  pass against the stubs by construction; they bind the GREEN
  implementations, not the stubs.

## Part 1 E2E state at commit 2 (honest record, 2026-10-28)

- **Unit:** 209/209 pass (reset-history, review-deck, trail,
  loop/store, coldtrail/store, learning, session suites).
  `npx tsc --noEmit` clean; `npm run build:pages` succeeded.
- **E2E, final spec, single clean-queue pass (retries=0): 4 passed /
  2 failed.** Passing: home flow (locked copy, Esc/Keep, confirm,
  in-place card flip, storage read-back); visibility (empty deck +
  caught-up); ReviewComplete surface; Editions-paused variant (D13).
- **OPEN 1 — `reload proof: wiped open flags do not auto-open an
  edition after reload`:** fails at the mid-test home-heading wait.
  After leaving GeoDetective, the seeded `meridian.coldtrail.open=1`
  routes the app to the Cold Trail screen (GameApp branch precedence:
  loop > coldtrail > home), so Home never renders at that step and
  the post-reset assertions are not reached. This is a test-flow
  defect — the app follows its own precedence rules. Stage 5: fix
  the flow (also leave Cold Trail, or seed `coldtrail.open` only at
  the re-seed step) and re-run.
- **OPEN 2 — `TrailScreen entry after reset: fresh case, fresh star
  wallet`:** the final raw read-back of `meridian.coldtrail.v2` is
  null after entering Cold Trail post-reset (`stored` not.toBeNull
  fails). Needs Stage 5 diagnosis: lazy store write on the trail
  screen vs reset interference.
- **repeat-each=10 NOT achieved.** Best verified state is the single
  pass above. (An earlier spec revision passed 6/6 in one single
  pass, but repeat runs in this session were polluted by queued
  flock waiters from backgrounded commands sharing port 4123 and
  `test-results/` — those tallies are not trustworthy either way.)
  Stage 5 must run the `--repeat-each=10` gate on the final tip in a
  clean queue, one run at a time.
- **Extended suites not re-run on the final tip:** the D9-cured
  `card-redesign.desktop.spec.ts` and `mobile-home-overlap.spec.ts`
  are Stage 5 items.
- **Screenshot:** `evidence/part2-after-390.png` exists (35,556
  bytes, 2026-10-28 18:22 UTC) but predates the final Part 1 build
  (the dialog portal fix was built later) and its provenance was not
  verified in this run — retake at Stage 5 on the final tip.

## Gate record (Stage 5, coordinator-run on tip af30b09 + test cures)

- `npx tsc --noEmit` — exit 0.
- `npm test` — exit 0 (scripts 850 pass / 0 fail; src 1774 pass / 0
  fail — +21 new tests over the 1753 base).
- `npm run test:worker` — exit 0.
- `node scripts/lint-cards.mjs` — GATE PASSED, exit 0.
- `npm run build:pages` — exit 0. Benchmark: entry chunk
  `index-*.js` = 445,738 B vs main baseline 445,718 B → **+20 B**
  (flat; no benchmark regression). Rebuilt with the E2E-required
  `VITE_KOFI_URL` inlined: 445,900 B (+182 B vs baseline — the URL
  string; still flat).
- E2E reset-history: builder's clean single pass was 4/6; the two
  failures were diagnosed at Stage 5 as TEST defects, cured in the
  spec (product code untouched):
  1. Reload proof — the flow waited for Home while the seeded
     `meridian.coldtrail.open=1` correctly routed the app to Cold
     Trail (precedence loop > coldtrail > home). Cure: leave Cold
     Trail via "← All games" (clears its flag) before the home
     wait; landing on Cold Trail is now asserted as proof the
     second flag was live.
  2. TrailScreen entry — the final read-back demanded a persisted
     `meridian.coldtrail.v2`, but `loadColdtrail()` returns a fresh
     store WITHOUT persisting it (only the v1-migration path
     saves), so absence is the correct wiped state. Cure: read-back
     accepts null OR a fresh store (caseIndex 0 / solved 0 /
     current null) — a resurrected seed still fails.
- E2E reset-history on the cured spec: **single pass 6/6 (2.2m)**;
  **`--repeat-each=10`: 59 passed / 1 failed (25.7m)** — the one
  failure is the ReviewComplete test hitting the 240s test timeout
  on a `locator.evaluate` under box load; the same test passed in
  22.7s in the clean pass and in 9 of its 10 repeats. Recorded as a
  load flake, not an assertion failure.
- E2E card-redesign on the final tip: **11 passed (5.1m), exit 0**
  — includes the Part 2 non-overlap tests and the D9 tap-anywhere
  cure (focusable count 2 with the opener present).
- E2E mobile-home-overlap on the final tip: 6 passed / 20 failed
  (7.7m) — **the Part 2 cue tests pass at 360px and 390px**; all 20
  failures are the (a)/(a2)/(b)/(b2)/(d) groups that fail
  identically at base under this box's load (Stage 3 attribution).
  (First attempt was a harness error — the spec requires
  `VITE_KOFI_URL` in env; the recorded run has it.)
- Screenshot: `evidence/part2-after-390.png` RETAKEN on the final
  tip (coordinator, due seed, 390×844): REVIEW pill top-right clear
  of the illustration, and the new "Start over" opener visible
  under the due count. (evidence/ is untracked; paths cited in the
  PR body point at the run report.)
- Fresh CI read happens at PR time (CI runs on PRs, not branch
  pushes — verified empty).

## Panel record (Stage 6, on tip `2ea97fc`)

- APPROVE: Game Audio, Narrative, Level Architect, Senior
  Architect, Senior Developer.
- APPROVE-WITH-NITS: Game Designer, Economy, Frontend, UX
  Researcher, UX Designer, Office Hours.
- BLOCK: Game Developer — claimed a ReviewComplete reset leaves
  the in-memory session live. **Adjudicated REFUTED by the
  coordinator:** the confirm path is GameApp's `handleResetHistory`
  (→ `replaceSession(null)`) via the Play → PlayLoaded →
  ReviewComplete prop chain, traced independently by three other
  seats; and a probe E2E on the final tip replicating the seat's
  scenario passed (banked 171 → reset at ReviewComplete →
  `meridian.session` null → next game banks exactly 1 place).
- DevEx FAIL (documentation): three items dispositioned —
  (1) the claimed stale "(builder fills…)" RED placeholder does
  NOT exist in this file at the reviewed tip (grep-verified at
  `2ea97fc`; the full Layer-2 record sits under the RED evidence
  heading above) — finding does not match the record;
  (2) manifest errata, genuine and logged here: §6 names
  `src/game/passport/badges.ts` (actual `src/game/badges.ts`);
  D14(b)'s "effect deps" phrasing vs the implemented
  epoch-parameter design (functionally compliant);
  (3) `src/game/learning.ts` comment reword — genuine, left for
  the owner's cure-round call (product-file edit).
- Re-vote on the rebased tip + any cure round: the owner's call.

## Carried dissents / open questions

- C2 dissent (all-history wipe entered from the misses card) — carried
  to the PR body; the owner's merge word is his ruling (manifest §7).
- C9-cut dissent (ReviewComplete surface) — carried (manifest §7).
- OQ1 badges/first-win kept; OQ2 `meridian.loop.v1` untouched;
  OQ3 flag-off players have no reset door in v1 (manifest §9).
