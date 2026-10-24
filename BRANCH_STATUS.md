# BRANCH_STATUS — feat/card-redesign-build

**Branch:** `feat/card-redesign-build`
**Base:** origin/main @ `28c5fea` (PR #245 merged; rebased from `a59ee4c` — BRANCH_STATUS conflict resolved by keeping this branch's record, #245's record lives on main via #245)
**State: BUILD COMPLETE, local commit only — NOT pushed, NOT merged, NO PR
(coordinator handles push/PR after panel review + rebase).**

Council-decided card redesign (CARD-REDESIGN-MANIFEST.md, Chair-decided;
verdict mockups in `council-evidence/card-redesign-debate/mockups/`).
Builds ONLY items A–D below; everything else in the manifest is HELD.

## Scope (exactly this — no drive-by changes)

- **A. JOIN button** — nav "JOIN THE JOURNEY" (`.hv5-actions
  .hv5-btn-brown`): `min-height: 46px` inside the ≤1080px media query
  only. Measured 38.5px → 46px at 390/1080px; 46.8px at 1280px untouched;
  768px already 55px (wrapped nav) — the floor does not shrink it.
  Map-lines hero background untouched.
- **B. Split cards (Variant A), GeoDetective + Cold Trail** — `<img>`
  moved before `.hv5-txt` in JSX (DOM order, not CSS order); the
  `.hv5-split` row disabled for these cards only (`.hv5-stack`);
  full-width top image, 16/9, full-bleed to the card edges (replaces
  the 120px GD strip and the 238px CT bleed). Production art reused
  (desert-ruins, Patagonia peaks — the mockup's recognisable scene).
  Badge chip unchanged: dark #77591f on #efe3bc = 5.07:1 (the
  proposal's 1.28:1 pale-on-pale chip is NOT shipped). Locked
  GeoDetective tile untouched. Form: **S for both cards** (stretched
  CTA; see below).
- **C. Review my misses** — whole-card clickable ONLY when due > 0,
  via the stretched "Start review" CTA, plus the visible `REVIEW →`
  cue pill (aria-hidden, click-through). Empty/caught-up: no button,
  no cue, muted heading, not focusable/clickable. Duplicate
  `aria-label` + `h2` resolved via `aria-labelledby="review-title"`.
  `startReview` still fails closed on empty queues; `deck.enabled =
  false` still renders no card (unchanged).
- **D. Grid band, row-stretch only** — `.hv5-pages > .hv5-page`
  `grid-column: 1 / -1`. No-op at 390px and ≤680px (already single
  column). The 768 `.hv5-grid3` orphan is NOT built (separate /
  conditional). At 1280, About going full-width is band mechanics,
  not a claimed improvement (D-α). Sizing rule: journal entry art
  keeps its fixed 3/2 box (scales with the band); About paragraphs
  capped at 72ch.
- **E. Cold Trail deactivated = absent — SKIPPED, switch spec owed.**
  Verified absent: `src/game/coldtrail/store.ts` holds only `{v,
  caseIndex, stars, solved, current}` + the `meridian.coldtrail.open`
  screen-open flag; the card is unconditional; `coldTrailOpen` =
  screen-open-now, not deactivation. No switch was invented.

## Form R/S recommendation (coordinator makes the final pick)

- **Form S for GeoDetective, Cold Trail, and Review-due alike.**
  Reasoning: (1) a `<button>` cannot contain the `<h2>` — Form R
  would force dropping real heading semantics or using a
  `role="heading"` span; (2) GeoDetective has a genuine nested-
  interactive conflict that FORCES Form S: `EarnedBadgeRow` renders
  real badge `<button>`s (tap-to-expand blurbs) that must stay
  independently tappable — nesting them in a card-`<button>` is
  invalid and would fire the card action on chip taps; (3) one
  shared form keeps both game cards behaving identically. Consequence
  to record: with badges earned, GeoDetective has 1 card stop + 1
  stop per badge chip (pre-existing, required); with no badges, exactly
  1 stop. CTA text stays its accessible name; card articles carry no
  competing `aria-labelledby` name (removed from GD/CT); Review keeps
  its region name via `aria-labelledby` to the `h2` (existing E2E
  relies on `region "Review my misses"`).

## Parity account (measured, same Playwright harness, baseline = this branch pre-change)

1280 AFTER: grid2 GeoDetective | Cold Trail (593×561 each); grid3
Review | journal-card | For grown-ups (388×356 each, even row); then
About band 1208×251; then JOURNAL band 1208×3068; footer at y5380.
768 AFTER: grid2 337×440 each; grid3 Review | journal-card 337×396
+ orphan For grown-ups 337×378 (STILL THERE — not built); About band
696×251; JOURNAL band 696×2111; footer at y5471.

Page-length deltas, full document height (band + split + JOIN effects
combined): 390: 6388 → 6363 (−25; band itself no-op — pages heights
unchanged 341/1653); 768: 5469 → 5981 (+512); 1280: 4335 → 5869 (+1534).
Decomposition vs the council's minimal-band estimates (+363 @768 /
+296 @1280, which held journal height constant): the band mechanics
alone are +363/+296 only if journal height is frozen — but it is not:
full-width entries scale their 3/2 art, so JOURNAL grows 1627→2111
@768 (+484) and 2074→3068 @1280 (+994). Band totals: @768
251+22+2111 = 2384 vs before max(341,1627) = 1627 (+757); @1280
251+22+3068 = 3341 vs before max(274,2074) = 2074 (+1267). Remaining
doc delta: GD/CT split heights (684→440 @768, −244/row; 294→561 @1280,
+267/row) and JOIN +7.5px at 390/1080. The extra length is a
consequence of the specified rule (art keeps 3/2 at full width), not a
deviation from it — panel should confirm the taller journal art is
acceptable before merge.

## Commits (8, on top of base `d327dd3`)

- `tests/e2e/card-redesign.desktop.spec.ts` (new, 7 tests): JOIN
  heights; GD/CT split order + image/heading/paragraph/corner clicks;
  one focus stop + whole-card focus ring per game card; Review due
  clicks (heading/paragraph/cue/corner) + cue; Review empty/caught-up
  non-focusable/non-clickable; grid band geometry at 390/680/768/1280.
- Two real bugs found by the tests and fixed in this branch: (1)
  `.hv5-spot .hv5-txt` is `position:relative; z-index:1`, which put
  Review text above the stretch layer — fixed with a scoped
  `z-index:2` on the Review stretch layer; (2) that same relative
  `.hv5-txt` made the stretch `::after` size to the 62% text column
  instead of the card, so corner taps missed — fixed by scoping
  `.hv5-review-due .hv5-txt` to `position:static` (due state only).

## Gates (this branch, final head)

- `npx tsc --noEmit` — exit 0, no output.
- `npm test` — exit 0. Scripts suite: 834 tests, 825 pass / 0 fail /
  9 skipped. Src suite: 1489 tests, 1489 pass / 0 fail.
- `node scripts/lint-cards.mjs` — exit 0, prints `GATE PASSED`.
- `npm run build:pages` — exit 0.
- Playwright E2E, new spec only (`card-redesign.desktop.spec.ts`,
  desktop project): **7 passed, 0 failed** (final run; earlier runs
  6/7 exposed the two Review stretch bugs above, both fixed).

## HELD — not built (per brief)

Journal merge/rename/drop or anything journal-structural; footer
sentence link; Get Involved hide-empty; phone nav wrap; image
placeholder design; JOIN US card fate; splash orbs; anything
gradient-blend; anything stripping the map-lines theme or link
padding; 768 orphan reparenting; comparison-page housekeeping
(coordinator handles F separately — files live outside this repo).

## Pending

- Coordinator: Form R/S final pick (recommendation: S, above);
  panel review + rebase; push + PR (NOT done by this branch).
- Panel confirmation: taller full-width journal art (see parity
  account) and the 768 orphan reparenting design are still open.
- Still owed from the council (§7, not built here): scan watch,
  per-card name pins beyond CTA text, Cold Trail switch spec +
  reflow rule, journal usage data, 768 orphan design.
