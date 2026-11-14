# Branch status — feat/v2-physics-more-items

## Goal

Stream A (v2): more playable physics items per age band. Read every
unplayed row in docs/scaling/physics/items.json and add the ones that
fit the shared multiple-choice AnswerCard, up to 10 new per band.
No shipped item changes except additions; no shared files touched.

## Done

- `src/subjects/physics/items.ts`: PHYSICS_ITEM_IDS grows 9 → 24 —
  all 24 curated rows are now live. 7-10: 3 → 12, 10-18: 3 → 9,
  18+: 3 → 3 (no unplayed 18+ rows exist). Deal order keeps the
  original first item per band, new items appended in buildsOn order.
- `src/subjects/physics/answers.ts`: 15 new AnswerEntries, each with
  a one-line derivation (see the PR body table).
- `src/subjects/physics/physics.test.ts`: slice counts 12/9/3 and
  units 24; v2 plan item `physics:arrive:equal-steps` pinned in the
  slice; equal-steps recompute (3 > 1); guard that no physics prompt
  carries a year literal (no physics row is year-based, so no pinned
  clock applies).
- `tests/e2e/physics-subject.spec.ts`: play-through helper plus two
  new tests — 7-10 plays new `physics:drop:down`, 10-18 plays new
  `physics:push:mass`, each to the result with no console errors.
- `playwright.config.ts`: new `physics-subject` project (mirrors
  `math-subject`, 1440×900). The physics spec matched NO project
  before this, so it could never run locally or in CI.

## Row sort (all 15 unplayed rows)

- Fits multiple choice (15): every unplayed row. "Tap X" objectives
  render as "pick X" choices — the mapping the first slice already
  used for `physics:push:which-way` (tap a direction → pick a
  direction) and `physics:arrive:unit-rate` (tap a cart → pick a
  cart). Two prompts reframed, not the rows: `physics:lever:seesaw`
  asks about the far end (the row's literal question gives its
  answer away), and `physics:shadow:blocks` asks the row's own
  "when is the book seen?" question.
- Fits a typed number (0): no row has a number answer that choices
  would give away. Stream B's `kind` field is not on main (PR #468
  draft, unmerged), so nothing was held for it.
- Needs a scene (0): no row needs picture comparison, path tracing,
  or a pin — every scene tap maps onto a choice.
- Held / judgment calls (0): no row's answer is a judgment call.

## Tests (final tree, targeted only)

- `npx tsc --noEmit`: clean.
- Unit: 56/56 subject tests pass (physics 5, registry, picker-rows,
  why-learn-hero, all other subjects).
- `npm run lint:content`: GATE PASSED (6 baselined, 0 new).
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run build:pages`: green.
- E2E `--workers=1 --project=physics-subject`: 4/4 pass, no
  console/page errors (bundled Chromium 1248; /opt/meta-chromium
  will not launch in this VM, as in wave 1 / Stream B).

## Reviewer verdict (separate seat, on ed0e7618)

VERDICT: APPROVE-WITH-NITS — see the PR body for the full text,
pasted verbatim. Educator seat: all 15 new answers follow from
their rows with correct physics and plausible-mistake distractors;
the two reframed prompts are faithful; no algebra/trig in 7-10,
nothing under 7, no biology/religion/politics, no judgment-call
answers. Accessibility seat: shared AnswerCard untouched, native
buttons at min-h-[44px], keyboard-reachable, reduced-motion path
unchanged. Unit tests re-run by the reviewer: 5/5 pass.
Nits, dispositioned: (N3) mirror:three-ways derivation overstated
"only the mirror reflects" — FIXED in e5528a6f (now "in this
model, the mirror is the one that reflects the light"). (N4)
shadow:blocks derivation now says "reflected light" — FIXED in
e5528a6f. (N1) friction:measure-slide tests only the prediction
half; the row's "shown by" is entering a centimetre reading
(typed-number territory) — ACCEPTED as a scope reduction, recorded
in the PR: the measurement entry belongs to a later typed-number
wave, the prediction question is what ships here. (N2)
balance:tug tests only the matching-pushes half; the stronger-push
direction is already covered by the played
physics:push:which-way — recorded in the PR. (N5)
ramp:higher-stored simplifies the row's "cart-and-Earth pair" to
"the cart" — acceptable for 10-18, noted only. The nit-fix commit
was re-verified by re-running all gates, not by the reviewer seat.

## Not checked

- No live-device listen (text only, no audio in this stream;
  `src/game/audio/voice-channel.ts` is on main, but physics items
  have no voice clips).
- CI on the PR (full suite + e2e) is the remaining gate.
- Educator review runs alongside, after release (progressive
  release, owner rule Nov 13) — not a gate.
- Mobile 390px playthrough of a new item (desktop 1440×900 only in
  the e2e run; AnswerCard buttons are 44px as before).

## Not done / later

- `/pstack`, `gstack`, `agent-agency` are NOT installed in this
  environment — plain sub-agents were used, as the brief allows.
- Follow-up PR for any rows beyond the 10-per-band cap: none needed
  — all 15 unplayed rows fit within the caps (9 + 6).

## Graph

- Node: `feat/v2-physics-more-items` (branch), documents
  `src/subjects/physics/items.ts`, `answers.ts`,
  `physics.test.ts`, `tests/e2e/physics-subject.spec.ts`.
  No graph.json edit (integrator-only).
