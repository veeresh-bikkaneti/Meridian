# Branch status — fix/geo-endgame-overflow

Task 3 of the 2026-11-17 delegation brief: the small follow-up to
PR #526. **Stacked on #526** (`fix/mobile-header-overflow`, tip
`dbfcfdb7`, open unmerged): this branch is 526 + 3 commits. When 526
merges, this becomes plain main + its own work.

## Done (all six brief items)

1. **GeoDetective 320px overflow — fixed in SiteHeader's CSS.**
   Before [measured]: page 338px wide at 320; End game x 239.4 →
   right 338.2. The shell header's row gap, actions gap and the exit
   pill's inline padding now shrink below --bp-sm (tokens:
   --header-row-gap-sm, --header-actions-gap-sm,
   --header-exit-pad-sm), giving back ~40px in the header itself —
   no per-screen patch. After [measured]: scrollWidth 320 ===
   innerWidth; End game right edge exactly 300 (the padded content
   edge); its hit height stays ≥44px.
2. **layout-overflow e2e extended + added to CI.** GeoDetective and
   the Why Learn picker now assert the no-sideways-scroll contract
   at 320×568, 390×844, 768×1024, 1280×800, 1920×1080, and the spec
   joins CI's fixed e2e list in .github/workflows/node.js.yml (with
   the listing note in the workflow's comment style).
3. **--header-height split.** It was 19rem (304px) — the sheet's
   offset wearing the header's name. Now --header-height: 84px (the
   header's measured height; floors .site-header, no visual delta —
   heights re-measured identical: 84 phone / 86.75 desktop) and
   --sheet-offset (10rem desktop, 8.5rem below --bp-sm). Sheet at
   320×568 [measured]: top 304 → 136; box height 248 → 363;
   scrollHeight 363 === clientHeight 363 — **no inner scroll**. Q1
   contract held (header top ≤40, options + Dismiss tappable; the
   spec's sheet test passes and now pins the no-scroll fit).
4. **Header layer.** On Home the header computed to z-index 1 (the
   atlas lift outranks .site-header). A named rule at the lift's own
   weight (`.atlas-home > header.site-header`, plus its menu-open
   twin at --z-menu) claims --z-header for the header alone; the
   lift is untouched for other children. After [measured]: computed
   z-index 30 at all five viewports.
5. **526's literals tokenized.** 36rem → --sheet-max-width; the
   panel-exit's 4px → --space-2xs; the actions gap 14px →
   --header-actions-gap. The 639.5px media value stays a value with
   its --bp-sm citation: media conditions cannot read custom
   properties, so the cited token is the governing reference (the
   repo's established convention, also PR 3's).
6. **Adoption-spec flake cured.** homeControl in
   shared-shell-adoption.desktop.spec.ts now polls the Home
   control's box until it stops moving (the header entrance
   animation read 43.999996 mid-flight) before measuring; the ≥44
   assertion is unchanged. Proven stable: **3 passed × 3 consecutive
   runs**.

## Undo-the-fix check (recorded)

`git show 39085224 -- src/styles.css | git apply -R` + rebuild →
the extended spec goes red on both new pins: "GeoDetective 320x568
scrollWidth" (338 ≠ 320) and "sheet fits without inner scroll
(scrollHeight 363 vs clientHeight 248)". Fix restored, rebuilt,
spec 5/5 green again.

## Gates (targeted, per the narrow-testing rule)

- tsc --noEmit clean · npm test exit 0 · test:worker 235/235 ·
  typecheck:worker clean
- lint:nav ✓ · lint:subjects GATE PASSED · lint:content GATE
  PASSED · lint-cards GATE PASSED · check:provenance PASSED
- build:pages green · check:entry-size 323,810 B (limit 323,865)
- e2e hermetic (pinned Chromium): layout-overflow 5/5,
  shared-shell-adoption 3/3 ×3 runs

## Evidence

Before/after screenshots (real built artifact, real globe):
~/workspace/verify-evidence-endgame-fix/{before,after}/
geo-320x568.png + sheet-320x568.png.

## Next step / open questions

- Owner merges 526 first, then this PR (stack order). No merge
  without the owner's word.
- Nothing else open on this branch.

## Graph

No nodes or edges added or changed.
