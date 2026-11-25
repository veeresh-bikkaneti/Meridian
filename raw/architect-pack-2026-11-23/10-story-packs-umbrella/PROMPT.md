# 10 — Story-pack umbrella: mountains & peaks, national parks, deserts, flags

## Intent (one line)
The wider famous-places detective-story programme beyond the three mocked packs: mountain ranges and peaks, national parks, deserts, and flags — each as clue-by-clue narrative cases.

## Why (origin)
Owner's recorded scope (issue #319; goal `meridian-famous-places-detective-stories`): future detective-style additions using **famous pieces only, never exhaustive globe coverage**. Capitals already shipped under this programme (PR #323); Rivers/Seas/Seaports are item 09. Drafting for the umbrella categories starts once the owner names the first category.

## Scope IN
- Category-by-category case packs on the same Capitals machinery, each needing its own target rule before any cases are written (the item-09 lesson: lines/areas need a point rule; a category without one does not ship).

## Scope OUT
- Starting any category before the owner names it. Exhaustive lists (every peak, every park) — the greatest-hits bar is the design.

## Locked decisions
- Famous pieces only; facts sourced and verified, never manufactured.
- Each category gets narrative the child solves clue by clue (the shipped five-tier clue structure).

## Acceptance criteria
- Owner names the first category → that category gets the item-09 treatment (target rule + mockups + his approval) before any build.

## Assets & related work (in this folder)
- `GOAL.md` — the programme record (scope, issue #319 reference).
- Worked example of the pattern: item 09's folder (DESIGN-NOTE.md).

## Open questions for the architect
1. Which umbrella category has the cleanest native point semantics (peaks are points; deserts are areas; parks are areas with famous points; flags are not places at all — how do flags play in a point game)?
2. Should flags fold into the Capitals & Flags rescue (item 12) instead of standing as their own pack?

## Status & evidence
- Scoped and recorded; no category named yet; no drafting started.
