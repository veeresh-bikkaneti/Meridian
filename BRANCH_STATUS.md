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
   (`deckIdOfPuzzle(current)`), never from the pick. Placed in the
   LoopScreen header block near the "Case #N" line with
   `data-testid="case-deck-label"`, text `Deck: X`. Label helper
   `deckLabelForId` in src/components/pack-shelf-data.ts reuses the
   existing category-label logic, with unit pins.
2. FALLBACK NOTICE — when a deal actually falls back (a pack was
   picked AND the deal came from the core deck; detected at both
   deal sites: mount effect and onNextMystery), show a plain
   role="status" notice for that case: "Capitals couldn't load just
   now, so this case is from All cases. Your next case will try
   Capitals again." Cleared on the next deal and on a deck pick.
   No notice for resumed/revealed cases, healthy pack deals, or
   core picks.
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
- [ ] LoopScreen: case-deck label in the header block
- [ ] LoopScreen: fallback detection at both deal sites + notice
- [ ] Regression spec ported + converted to the locked expectation
- [ ] docs/story-packs.md clarifying sentence
- [ ] Gates: tsc / npm test / lint-cards / build:pages / targeted E2E
- [ ] PR opened against main (NO MERGE)
