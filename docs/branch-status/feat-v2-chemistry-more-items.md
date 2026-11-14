# Branch status — feat/v2-chemistry-more-items

## Goal

Stream A (Chemistry, v2): more playable items per age band from the
existing rows in `docs/scaling/chemistry/items.json`, using the shared
case flow only. No shipped item changes to other subjects; no new
screens, routes, pages or audio.

## Done

- `src/subjects/chemistry/items.ts`: `CHEMISTRY_ITEM_IDS` extended
  from 9 to 16 — the first 3 per band unchanged, new rows appended
  after them (cross-subject links first, buildsOn order kept):
  7-10 +magnet, +rebuild; 10-18 +particles, +water:cycle, +new-look,
  +rust, +identify; 18+ unchanged (no unplayed rows).
  `chemistry:elements:detective` was listed in the first commit and
  held after the round-1 reviewer verdict (BLOCKED, 2026-11-14) —
  see Sort.
- `src/subjects/chemistry/answers.ts`: 7 new `AnswerEntry` records,
  each with a one-line derivation. Wording follows
  `docs/scaling/chemistry/fact-notes.md`: rust is iron exposed to
  oxygen and water (never "air"); new-look says "may", never "always".
  No biology in any question, choice or derivation. No numeric
  answers, so no row needs the typed-number kind (not on main;
  Stream B's PR #468 is a draft, unmerged).
- `src/subjects/chemistry/chemistry.test.ts`: counts updated
  (16 total; 5/8/3 per band); new sort-coverage test (every row
  listed except the two held rows) and a test pinning that no
  chemistry answer is numeric or year-based.
- `tests/e2e/chemistry-subject.spec.ts`: two new tests — one new
  item per band with new items (7-10 magnet, 10-18 particles),
  played through to the result via Next case; the 10-18 walk is
  extended through water:cycle and new-look to rust, so 3 new
  10-18 items play in-app. 18+ has no unplayed rows, so no new
  18+ test.
- `playwright.config.ts`: new `chemistry-subject` project (mirrors
  `math-subject`, 1440×900). Deviation from the brief's file list —
  required: the spec had no project at all, so `npx playwright test`
  found 0 tests for it on main too (pre-existing gap from #439).
  Without this entry the brief's own e2e instruction cannot run.
  Same gap exists for `physics-subject.spec.ts` (not this stream).

## Sort (all 9 unplayed rows read)

- Fits multiple choice (7): magnet, rebuild (7-10); particles,
  water:cycle, new-look, rust, identify (10-18).
- Fits a typed number (0): no chemistry row has a numeric answer.
- Needs a scene / held (2): `chemistry:water:where` (7-10) — its
  skill is pointing at water bodies on the globe, and as text its
  question is ambiguous (the vanished puddle's water vs the lake's);
  `chemistry:elements:detective` (10-18) — held on the round-1
  reviewer verdict (BLOCKED, 2026-11-14): its answer needs the
  down-column reactivity trend, which its row never states, and the
  18+ explain item teaches same-column → "similar way", so "They
  react the same" is a reasonable pick from the game's own teaching.
  The row needs the trend stated, or a re-band to 18+ per council
  note #6, before it can ship. Council note #6 also cautions
  against dealing HS-PS1-1 content to grade 5; the row says no
  electron-counting is required.
- Disclosed limit: `chemistry:water:cycle` — the question tests the
  cycle path, not the ordering performance the objective names;
  ordering still needs a scene. The correct choice itself lists the
  path in order, so the reviewer accepted it as shipped — flagged
  for educator sign-off.

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

**Round 1 (2026-11-14 ~04:29 UTC, on tip `e44e0308`): BLOCKED** —
`chemistry:elements:detective` — the correct choice is not
derivable from the row's why/objective; nothing states the
direction of the Group 1 trend, and the sibling 18+ item
`chemistry:reactions:explain` teaches same-column → "It reacts in
a similar way", so a learner applying the game's own teaching
reasonably picks "They react the same". Exact fix: hold detective
out of `CHEMISTRY_ITEM_IDS` until the row states the down-column
trend or is re-banded 18+ per council note #6. Nits: (1)
water:cycle tests the path, not the ordering its objective names —
acceptable as shipped, flag for educator sign-off; (2) identify's
"Whether each block floats" distractor sits uneasily with the
objective's "Floating is not scored"; (3) longest new choices
(new-look 69, rebuild 60, water:cycle 55 chars) exceed every
shipped choice (~45) and the chemistry project runs at 1440×900
only — shorten or add a 390px check; (4) E2E plays only 2 of the
8 new items — consider walking the 10-18 case to rust. Playwright
config deviation ACCEPTED (mirrors math-subject; without it the
spec runs 0 tests, a pre-existing gap from #439).

**Cure (second commit, tip TBD):** detective held out of
`CHEMISTRY_ITEM_IDS` and its answer removed (counts 17→16, 10-18
9→8, held-set test covers both held rows); identify's float
distractor replaced with "How heavy each block is"; new-look
correct shortened to "It might be a new substance" (28 chars),
rebuild to "Yes — rebuild it longer with the same pieces" (44),
water:cycle to "Into the air, a cloud, back as rain or snow" (43) —
full reasoning stays in the derivations; 10-18 E2E walk extended
through water:cycle and new-look to rust (3 new 10-18 items play
in-app). **Round 2 (2026-11-14 ~04:36 UTC, on tip `0acba120`):**

VERDICT: APPROVE-WITH-NITS
1. Detective hold complete [measured] — answer entry removed (16 keys in answers.ts), removed from CHEMISTRY_ITEM_IDS, counts 16 total / 5-7-10 / 8-10-18 / 3-18+ in the test, held-set test asserts both chemistry:water:where and chemistry:elements:detective stay out while all other 16 of 18 rows are listed.
2. Chemistry unit tests 8/8 pass [measured] — re-ran `node --experimental-strip-types --test src/subjects/chemistry/chemistry.test.ts` on tip 0acba120: pass 8, fail 0.
3. Nit (2) cured [measured] — "How heavy each block is" is a fair wrong choice for identify: a common mistake (heavier = different material), a real property, not silly, and unlike float it does not collide with the objective's "Floating is not scored".
4. Nit (3) cured [measured] — shortened correct choices are unambiguous and correct: new-look "It might be a new substance" (27 chars) vs two "certainly" distractors, derivation keeps the reaction reasoning; rebuild 44 chars; water:cycle 43 chars, full path kept (air, cloud, back as rain or snow). All three now at/below the shipped max (47, mass). 1440×900-only coverage is acceptable for these three — they play in-app in the extended walk at that viewport.
5. Nit (4) cured [measured from spec read; run builder-reported] — the 10-18 walk now goes particles → water:cycle → new-look → rust, each solved with its exact correct string, result visible after rust, no-errors assertion kept. E2E chemistry-subject 4/4 [inferred].
6. 7 new derivations spot-checked against their rows in docs/scaling/chemistry/items.json [measured] — rebuild, particles, water:cycle, new-look, identify are directly derivable from why/objective; magnet ("iron bits") and rust (see nit 5) teach their fact in the choice with no reasonable competing distractor and nothing in-game teaching the opposite — no second detective-class defect.
7. Other gates [inferred, builder-reported, not re-run] — tsc clean, subject suite 58/58, lint:content GATE PASSED (6 baselined, 0 new), lint-cards GATE PASSED, build:pages green.

Remaining nits:
1. (Carried, round 1) water:cycle tests the path, not the ordering its objective names — acceptable as shipped, flag for educator sign-off.
2. Dangling curriculum link, docs/data only — items.json still has chemistry:reactions:explain buildsOn chemistry:elements:detective, a held row no learner ever plays; spec.md topic-22 table still lists detective beside explain. No runtime consumer validates buildsOn, no learner-facing break. Fix: re-point explain's buildsOn (e.g. to new-look) and annotate the spec table, or record as known.
3. Rust correct choice is 52 chars — longest in the subject, above every shipped choice (max 47). It does play in the extended walk at 1440×900, so covered there; 390px still unchecked for all choices.
4. E2E now plays 5 of 7 new items (magnet + particles/water:cycle/new-look/rust); rebuild and identify still have no in-app play-through.
5. Rust's mechanism (iron + oxygen + water → rust) is taught by the choice itself, not stated in its row — harmless here because both distractors deny any change, but educator sign-off should confirm the row needn't name rust.
6. Identify weight caveat — weighing could distinguish same-size blocks; the prompt states no sizes, and the scored property per the objective is dissolving. Educator sign-off to confirm.

No BLOCKED items. The round-1 BLOCKED cause is fully cured.

**Nit dispositions (builder):** (1) carried — flag for educator
sign-off, no change. (2) recorded as known — `items.json` is
read-only data (verified: explain's buildsOn points at detective,
items.json:248); the re-point belongs to the data owner in a
follow-up. The "spec.md topic-22 table" half does not check out —
no spec.md exists under docs/scaling/chemistry/; council-notes.md
mentions detective only as a caution, not a table. (3) deferred —
shortening rust's correct choice would strip the oxygen+water
mechanism the choice itself teaches. (4) deferred — rebuild and
identify are unit-tested; e2e covers 5 of 7 new items. (5) flag for
educator sign-off. (6) flag for educator sign-off.

## Not checked

- No live-device listen (text only, no audio in this stream).
- CI on the PR (full suite + e2e) is the remaining gate.
- Educator review runs alongside, after release (progressive
  release, owner rule Nov 13) — not a gate.

## Not done / later

- `chemistry:water:where` — needs a scene (globe taps); a follow-up
  if a scene interaction lands for it.
- `chemistry:elements:detective` — needs its row to state the
  down-column reactivity trend, or a re-band to 18+ per council
  note #6; a follow-up once the row is fixed.
- The `physics-subject.spec.ts` project gap (same as chemistry's
  was) — the Physics stream's call, not this one.
- Adopting `kind: "number"` / `followUp` in chemistry answers —
  no chemistry row needs either today.

## Graph

- Node: `feat/v2-chemistry-more-items` (branch), documents
  `src/subjects/chemistry/items.ts`, `answers.ts`,
  `chemistry.test.ts`, `tests/e2e/chemistry-subject.spec.ts`.
  No graph.json edit (integrator-only).
