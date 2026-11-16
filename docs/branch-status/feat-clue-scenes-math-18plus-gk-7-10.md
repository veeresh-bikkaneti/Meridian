# feat/clue-scenes-math-18plus-gk-7-10 — status

## Done

- Wave 3 of the visual-explanation expansion (plan:
  `visual-expansion-inventory`): the two covered Math items for
  ages 18+ and every general-knowledge item for ages 7-10 now
  carry a clue scene — three new kinds (share-bar,
  timeline-line, tower-measure) plus three earlier kinds reused
  (split-product for mental-strategies, scale-line for
  falls-in-km, bus-boarding for trip-buses) and timeline-line
  shared by the two year items — so 7 of the wave's 8 counted
  items have the three-act treatment; the eighth is held (below).
- split-product gained a compact bar rendering for many rows
  (24), used only when a description's rows exceed eight; the
  7-10 hall rendering is unchanged.
- General knowledge is wired for scenes for the first time:
  `src/subjects/general-knowledge/scenes.ts` (descriptions next
  to the answers, the math pattern) and scene + resultExtra
  hooks in GeneralKnowledgeCase.tsx mirroring MathCase, gated
  to ages 7-10. MathCase's gates widen to ages 18+ for both
  hooks; the held 18+ item has no description, so it stays
  scene-less.
- The opera item's description is built at play time from the
  shared years mechanism (the same one its answer uses): its
  stored script holds the method only — no baked-in year count
  in the script, captions or clip — and the film counts the
  gap off in decade hops computed from the current year.
- Act 3 inherited from the pilot amendment, not reinvented:
  each description carries its narrated summary (clip, script,
  beat map) in the solved-phase data path; the performance
  re-paces the solved beat to the narration through the shared
  voice channel, captions step under the film, and the full
  script stands as text in the result section. The seven new
  clips were rendered locally in the pilot clips' voice
  (am_michael) at the same loudness targets; scenes data,
  manifest and clip files agree (unit-pinned).
- Tests: the subjects suite passes, including the new data
  contracts (math 18+ coverage = the two covered items exactly,
  the held item description-free; general-knowledge 7-10
  coverage = the five dealt items exactly; labels digit-free;
  givens never the answer; beat maps pacing exactly the solved
  beat's steps; closings stating the answer — with the opera
  item's documented method-only exemption); tsc clean;
  nav/content/subjects lints pass; build green. Browser
  verification ran locally in headless Chromium against the
  built artifact (the disclosed Playwright substitute): checks
  over all 7 cases at desktop and 390 px plus a reduced-motion
  walk — all passed, no page errors. The e2e specs walk both
  subjects' deal orders for CI.
- Added JS: measured against the Wave 2 build — under the
  wave's 60 KB cap (figure in the PR body).

## Next step

- Owner review. Later waves follow the inventory's wave plan
  (Wave 4 = Physics 7-10); the owner confirmed the full
  expansion on 2026-11-14, so the waves proceed in order.

## Open questions

- Stacked on PR #487 (`feat/clue-scenes-math-10-18`, head
  `55b29fa9`), itself on main after the 2026-11-14 merge train.
  This branch is a single commit on #487's head; its diff is
  exactly this wave's files.
- The opera item's closing line states the method, not the
  answer — the documented exemption in the PR body. The answer
  itself is computed at play time and stated by the result
  card, as before this wave.
- The inventory flags none of this wave's seven built items
  for difficulty. Content unchanged — flags are the owner's
  decision, recorded in the PR body.

## Ruled out

- A scene for `math-applied:measure:survey-check`: held by the
  inventory as scene-resistant (a judgment rule, not a method);
  the owner's word only. It is counted in the band's total —
  the wave is 7 built + 1 held of the inventory's 8.
- A baked-in year count for the opera summary: the answer is a
  runtime year gap, so the script holds the method only and
  the counting is computed from the year at play time.
- New scene kinds for items the existing kinds already fit
  (mental-strategies rides split-product, falls-in-km rides
  scale-line, trip-buses rides bus-boarding — new descriptions
  only, plus split-product's compact many-rows rendering).

## Graph

No graph.json edit (branch rule). Nodes this branch would add:
the three wave-3 scene kinds as renderer concepts under the
clue scene system, plus the general-knowledge scenes module;
edges: each kind → the items it serves (share-bar →
fractions:combine-shares; timeline-line → mixed:opera-years-ago,
mixed:older-landmark; tower-measure → mixed:eiffel-antennas),
plus reuse edges split-product → tables:mental-strategies,
scale-line → mixed:falls-in-km and bus-boarding →
mixed:trip-buses.
