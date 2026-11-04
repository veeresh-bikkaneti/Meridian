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
