# Branch status — feat/v2-chemistry-more-items

## Goal

Stream A (Chemistry, v2): more playable items per age band from the
existing rows in `docs/scaling/chemistry/items.json`, using the shared
case flow only. No shipped item changes to other subjects; no new
screens, routes, pages or audio.

## Done

- `src/subjects/chemistry/items.ts`: `CHEMISTRY_ITEM_IDS` extended
  from 9 to 17 — the first 3 per band unchanged, new rows appended
  after them (cross-subject links first, buildsOn order kept):
  7-10 +magnet, +rebuild; 10-18 +particles, +water:cycle, +new-look,
  +rust, +identify, +detective; 18+ unchanged (no unplayed rows).
- `src/subjects/chemistry/answers.ts`: 8 new `AnswerEntry` records,
  each with a one-line derivation. Wording follows
  `docs/scaling/chemistry/fact-notes.md`: rust is iron exposed to
  oxygen and water (never "air"); new-look says "may", never "always".
  No biology in any question, choice or derivation. No numeric
  answers, so no row needs the typed-number kind (not on main;
  Stream B's PR #468 is a draft, unmerged).
- `src/subjects/chemistry/chemistry.test.ts`: counts updated
  (17 total; 5/9/3 per band); new sort-coverage test (every row
  listed except the held one) and a test pinning that no chemistry
  answer is numeric or year-based.
- `tests/e2e/chemistry-subject.spec.ts`: two new tests — one new
  item per band with new items (7-10 magnet, 10-18 particles),
  played through to the result via Next case. 18+ has no unplayed
  rows, so no new 18+ test.
- `playwright.config.ts`: new `chemistry-subject` project (mirrors
  `math-subject`, 1440×900). Deviation from the brief's file list —
  required: the spec had no project at all, so `npx playwright test`
  found 0 tests for it on main too (pre-existing gap from #439).
  Without this entry the brief's own e2e instruction cannot run.
  Same gap exists for `physics-subject.spec.ts` (not this stream).

## Sort (all 9 unplayed rows read)

- Fits multiple choice (8): magnet, rebuild (7-10); particles,
  water:cycle, new-look, rust, identify, detective (10-18).
- Fits a typed number (0): no chemistry row has a numeric answer.
- Needs a scene / held (1): `chemistry:water:where` (7-10) — its
  skill is pointing at water bodies on the globe, and as text its
  question is ambiguous (the vanished puddle's water vs the lake's).
- Flagged for educator review (not a judgment call, a settled fact
  the row does not state): `chemistry:elements:detective` — the
  answer relies on the Group 1 trend (reactivity increases down the
  column); the row states the column pattern but not the trend
  direction. Council note #6 also cautions against dealing HS-PS1-1
  content to grade 5; the row says no electron-counting is required.
- Disclosed limit: `chemistry:water:cycle` — the question tests the
  cycle path, not the ordering performance the objective names;
  ordering still needs a scene.

## Tests (final tree, targeted only)

- `npx tsc --noEmit`: clean.
- Unit: 58/58 subject tests pass (chemistry 8/8, incl. the 2 new
  tests; math, registry, picker-rows, why-learn-hero, all other
  subjects).
- `npm run lint:content`: GATE PASSED (6 baselined, 0 new).
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run build:pages`: green.
- E2E `--workers=1 --project=chemistry-subject`: 4/4 pass, no
  console/page errors (bundled Chromium 1248; /opt/meta-chromium
  will not launch in this VM, as in wave 1 / Stream B).

## Reviewer verdict (separate seat)

(To be pasted verbatim in the PR body once the seat reports.)

## Not checked

- No live-device listen (text only, no audio in this stream).
- CI on the PR (full suite + e2e) is the remaining gate.
- Educator review runs alongside, after release (progressive
  release, owner rule Nov 13) — not a gate.

## Not done / later

- `chemistry:water:where` — needs a scene (globe taps); a follow-up
  if a scene interaction lands for it.
- The `physics-subject.spec.ts` project gap (same as chemistry's
  was) — the Physics stream's call, not this one.
- Adopting `kind: "number"` / `followUp` in chemistry answers —
  no chemistry row needs either today.

## Graph

- Node: `feat/v2-chemistry-more-items` (branch), documents
  `src/subjects/chemistry/items.ts`, `answers.ts`,
  `chemistry.test.ts`, `tests/e2e/chemistry-subject.spec.ts`.
  No graph.json edit (integrator-only).
