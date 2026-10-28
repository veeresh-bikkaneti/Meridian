# BRANCH_STATUS — feat/reset-history-and-card-fix

- **Branch:** `feat/reset-history-and-card-fix` (PR pending)
- **Base:** `origin/main` at `ab21c1c` (2026-10-28 — PR #277 merged)
- **State:** **IN BUILD.** Tier-2 council manifest signed and committed
  alone (`f681e92`, D1–D17 incl. Chair addendum). NO MERGE — the owner
  merges on his per-PR word after the panel approves the final tip.
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
- [ ] Stage 4 — Part 1 build (Layer-2 RED recorded below → GREEN)
- [ ] Stage 5 — all 5 AGENTS.md gates on the final tip
- [ ] Stage 6 — full panel (12 seats + DevEx) on the final tip
- [ ] Stage 7 — PR opened (no merge)

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
  failures in these suites reproduce on pristine base `ab21c1c`
  (base: 239 distinct failures under current box load; tip adds ZERO
  new failures — stash-baseline attribution, logs in the run's /tmp).
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

_(builder fills: stub/no-op run → named behavioural failures, with the
command and the failing test names)_

## Carried dissents / open questions

- C2 dissent (all-history wipe entered from the misses card) — carried
  to the PR body; the owner's merge word is his ruling (manifest §7).
- C9-cut dissent (ReviewComplete surface) — carried (manifest §7).
- OQ1 badges/first-win kept; OQ2 `meridian.loop.v1` untouched;
  OQ3 flag-off players have no reset door in v1 (manifest §9).
