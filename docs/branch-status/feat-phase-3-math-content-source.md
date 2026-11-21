# Branch status — feat/phase-3-math-content-source

Branch: `feat/phase-3-math-content-source`, off `origin/main` 7bc4d8f2adb147816f309e1f4a5b0d38c4090dde (PR #548 merged).
Lane: Phase 3 math content source, one PR, math only. Cap 400k tokens (Tier 2).
Estimate: 200k–280k. Running total (estimate, no meter): ~165k after panel + cures (lead ~35k, arena ~11k, TDD ~4k, builder ~45k, lead verification/gates/e2e ~35k, cure worker ~15k, panel seats ~20k).
Other lanes open: Phase 0.3 ci-required, Phase 1 audio port, Phase 5.1 secrets.
This lane owns `src/subjects/math/` and `docs/scaling/contracts.md` only.
Shared hot spot: `eslint/layer-baseline.json` — remove only this lane's own
entries, never re-sort or reformat. Stop at a draft PR; merges are Veeresh's.

## Capsule (AGENTS.md §F)

TASK / requested outcome: each math item has one typed record (question,
answer, provenance, media rules), validated at build time. Screens read a
projection of that record; they never join files by hand.
Interpretations considered and selected reading: the brief's "one file holds
the math records" cannot literally mean a new `records.ts` that `items.ts`
re-exports from — see Architect below (content→feature is an upward import
under `eslint/layer-rule.mjs`, and a new baseline entry to bless it would
weaken the check). Narrow reversible reading, to be confirmed by the arena:
the records + zod schema live in the content-layer file that already owns
the item list (`items.ts`), `answers.ts` becomes the thin compat export
from it, the validator is a feature-layer sibling that imports down, and
the next math PR renames the host to `records.ts` and deletes `answers.ts`.
If the arena finds a guardrail-clean literal reading, the lead takes it
instead and records why here.
Tier and rationale: 2 — content schema, 3+ files.
Done condition / scenarios / evidence: (1) failing test first: a record
with its answer in its lead fails the validator; (2) projection-equality
test passes for all math items (old export JSON == new projection JSON);
(3) `npm run lint:subjects` PASS, no new baseline entries; (4) math e2e
only, `npx playwright test tests/e2e/*math* --workers=1`; (5) `npm run
lint:arch` PASS, content files import nothing from higher layers; (6) no
player-visible change, no mockup.
Files and interfaces in scope: `src/subjects/math/` (records, schema,
validator, compat exports, tests, fixture), `docs/scaling/contracts.md`
§I2 (contract change), one `prebuild` token in `package.json` to call the
validator, this status file. Protected / out of scope: `eslint/layer-
baseline.json` (shrink-only), all other subjects, `docs/scaling/math/*.json`
(curated upstream, not this lane's), `MathCase.tsx`, `scenes.ts`, `index.ts`
(unchanged consumers).
Dependencies / ordering: facts re-checked on 7bc4d8f2 → capsule → arena →
failing test → generator script moves records (never retyped, never model-
written) → compat wiring → validator wiring → gates → panel (max 2 rounds)
→ draft PR.
Ownership: lead (plan, brief, integrate, verify); builders/testers are
helper agents; review is a clean-context panel seat. Workspace:
`~/workspace/meridian-main`.
Verification contract: `npx tsc --noEmit`, `npm test`, `npm run
test:worker`, `node scripts/lint-cards.mjs`, `npm run build:pages`, `npm run
lint:nav`, `npm run lint:subjects`, `npm run check:provenance`, `npm run
check:entry-size`, `npm run lint:arch`, math Playwright specs only,
`--workers=1`. Each reported PASS / FAIL / NOT RUN.
Assumptions, risks, unknowns: (a) provenance for math is UNVERIFIED for
all 53 records — no verifiedOn date exists anywhere for these rows
(derivations were listed in PR bodies for educator sign-off, undated);
(b) math carries no clip/still media ids today, so the media-existence
check is vacuous until the arena names the id namespace; (c) the JSON row
files stay on disk as curated upstream but runtime stops reading them —
the projection-equality fixture proves the move changed nothing;
(d) persona files on disk are only `docs/ops/personas/` accessibility,
ui-designer, ux-architect — no math/content/schema persona, so panel seats
outside those lenses are VACANT, never improvised.
Simpler or rejected approach, and why: keep `items.ts` reading JSON and
put the schema beside it — rejected, two live sources, not one validated
source. Extend `lint:subjects` to be the validator — rejected unless the
arena picks it: it already covers GIVEAWAY/YEAR/MEASUREMENT, but the
missing-answer and unknown-media checks belong to the record validator,
and the brief orders a validator in prebuild.
Budget: parent cap 400k; child allocations inside it, never additions.
At 80% (320k) spawn nothing, ask Veeresh.
Approvals needed: draft PR only (brief authorizes it); merge is Veeresh's,
per-PR, pinned to head SHA. Checker: clean-context panel, max 2 rounds.
Escalation: content fix found by the validator → report, do not fix
(content fixes need the educator seat); new baseline entry needed → stop
and ask Veeresh.

## Facts re-checked on main 7bc4d8f2 (2026-11-20) [tested]

- `src/subjects/math/items.ts` 150 lines, `answers.ts` 436 lines
  (`wc -l`). Items are an adapter: `items.ts` reads curated rows from
  `docs/scaling/math/number/items.json` (33 rows) + `applied/items.json`
  (38 rows) = 71 rows; 53 are playable (`mathUnits()`), 53 answers in
  `MATH_ANSWERS`.
- `UnitItem` (`src/subjects/registry.ts:20-28`, `docs/scaling/contracts.md`
  §I2): id, group, objective, standard, why, buildsOn, useElsewhere. No
  answer, provenance, validation or media-leak fields.
- `npm run lint:subjects` enforces MEASUREMENT, YEAR, GIVEAWAY
  (`scripts/lint-subject-leads.mjs`); baseline holds 12 entries
  (`scripts/lint-subject-leads-baseline.json`, `entries` length 12).
- Card rule 5, AGENTS.md §11: no fabrication, no LLM near place data.
- `zod` is `^4.6.7` in `package.json:80`.
- `lint:subjects` dynamically imports every subject's `items.ts`
  (`itemsForGroup`) + `answers.ts` (`answerFor`) — compat exports must
  keep both functions working.
- Identity for provenance: `veeresh bikkaneti
  <57240576+veeresh-bikkaneti@users.noreply.github.com>` (`git config`).

## Statechart

States: `main-verified` → `capsule` → `arena` → `failing-test` →
`records-generated` → `compat-wired` → `validator-wired` → `gates-green`
→ `panel-review` → `draft-pr` → `done`.
Transitions: each state advances only on its evidence (arena picks
recorded; test fails for the predicted reason; fixture generated from
main; gates listed PASS). `panel-review` loops at most twice (cure →
scoped re-vote); a second REJECT stops the run and goes to Veeresh.
Stops: cap reached (80% → ask), validator finds a known baseline case
(report, do not fix content), a new baseline entry would be needed
(stop, ask Veeresh), educator-seat content fix needed (report only).

## Architect — layer map (ARCHITECTURE.md + eslint/layer-rule.mjs)

`classify()`: only `src/subjects/**/items.ts` and `answers.ts` are
Content (level 1). Every other `.ts` under `src/subjects/math/` is
Feature (level 5). Content may import only Content or lower — so a
Content file cannot import a Feature file, a `src/lib` (Domain) file,
or `../registry.ts` (Feature, `subjects/root` area) without an upward /
cross-area violation. Type-only imports count (baseline already holds
`src/subjects/math/items.ts|../registry.ts`).

- Records + zod schema: Content (level 1) — must live in `items.ts`
  (or `answers.ts`) to be importable by the other Content file.
  Imports: `zod` (package, ignored by the rule) only. No `src/` imports.
- `answers.ts` compat: Content (level 1) → imports `./items.ts`
  (Content, same area) only. Its current `../shared/answer.ts` and
  `../shared/years.ts` imports go away — their baseline entries become
  stale and must be REMOVED (own entries only).
- Validator: Feature (level 5) — imports `./items.ts` (down) + `zod`
  only. Run from `prebuild` via `node --experimental-strip-types`.
  No `../registry`, no `../shared`, no `scripts/` imports.
- `docs/scaling/contracts.md` §I2: doc, no layer. Mark as contract change.
- `MathCase.tsx`, `scenes.ts`, `index.ts`: Feature, unchanged consumers
  of `./items` / `./answers`.
- Generator script: one-off, run from `/tmp` or workspace scratch, NOT
  committed (dead code otherwise); command recorded here.

## Arena (pstack 5)

Choices put to two workers (one option each per choice): D1 records-file
home; D2 schema home; D3 compat shape; D4 validator placement + prebuild
wiring; D5 media-id namespace; D6 provenance value; D7 leadPolicy values;
D8 projection-equality fixture; D9 answer schema shape (choice/number
discriminated union vs AnswerEntry passthrough). Lead picks, records why
below.

Worker B (returned 2026-11-20, ~4k est): D1 records host `answers.ts`
(items becomes the projection); D2 only guardrail-clean option is inline
schema in the host; D3 `answers.ts` authoritative, `items.ts` thin
projection (reverses the capsule); D4 extend `scripts/lint-subject-
leads.mjs` as the validator, called by existing prebuild via
`lint:subjects`; D5 empty allowlist — `media: []` only until the educator
defines a namespace; D6 only guardrail-clean option is `"UNVERIFIED"`
for all 53; D7 single literal `"answer-not-in-lead"`; D8 in-memory
dual-export comparison in the test, no committed snapshot; D9 AnswerEntry
passthrough + zod `refine`. Risks noted: D1/D3 flip hides deal-order
bugs in the projection; D4 folds build checks into a lint script whose
baseline semantics differ; D5 blocks future media until a namespace lands.
Worker A (returned 2026-11-20, ~7k est, capsule-consistent): D1
MATH_RECORDS in `items.ts`, generated by script; D2 schema in same
`items.ts`; D3 `answers.ts` thin compat from `./items.ts`, drop
shared/years re-exports; D4 validator `src/subjects/math/validate.ts`
(Feature), prebuild via `node --experimental-strip-types`; D5 media ids
vs merged journal-manifest clip ids (I5); D6 `"UNVERIFIED"` for all 53;
D7 enum sole value `"no-answer-in-lead"`; D8 frozen JSON fixture from
main's old exports, deep-equal for all 53 ids; D9 AnswerEntry passthrough
+ refine (lazy followUp; number→value required, choice→correct ∈
choices). Risks: old-vs-new comparison is circular without the frozen
fixture — capture it before any move; zod duplicates AnswerEntry/UnitItem
shapes locally, so contracts.md must name `items.ts` canonical for math.

## Lead picks (2026-11-20, after both workers)

- D1: A — `items.ts` hosts MATH_RECORDS. It already owns the item list,
  deal order and `mathUnits()`; hosting in `answers.ts` (B) would make
  the projection carry deal order (B's own risk).
- D2: both agree — schema inline in the host file. No separate file:
  Content cannot import it.
- D3: A — `answers.ts` thin compat from `./items.ts` only. The
  yearsSince/currentYear re-export goes away IF its only consumer is
  `math.test.ts` (builder greps first); the test then imports from
  `../shared/years.ts` directly. Removing those imports makes their
  layer-baseline entries stale — remove exactly those entries.
- D4: A — `validate.ts` (Feature) + one prebuild token. B's
  extend-`lint:subjects` mixes build-fail semantics with the lint
  baseline's KNOWN/STALE semantics and touches `scripts/` outside the lane.
- D5: A — clip ids vs the merged journal manifest (I5); still ids vs
  the journal stills dir (builder verifies the dir exists; if no still
  registry exists, still ids fail and that is documented). B's empty
  allowlist would reject legitimate future media by design, but the
  brief's "a media id that does not exist" implies a real registry.
- D6: both agree — `"UNVERIFIED"` for all 53. Inventing a date would
  fabricate provenance.
- D7: B's literal `"answer-not-in-lead"` (single value, not an enum —
  one policy exists). The validator implements the SAME token rule as
  `lint:subjects` `findGiveaway` (correct-choice unique token in the
  lead, excluding prompt/other-choice/stop tokens); no stricter rule.
- D8: A — frozen JSON fixture captured from main's old exports BEFORE
  any edit. B's in-memory dual-export comparison is circular (compat IS
  the projection). Units compared in deal order; answers per id.
- D9: both agree — local zod mirror of AnswerEntry (importing
  `../shared/answer.ts` from Content is an upward import) + refines:
  number→value required, choice→correct ∈ choices. `choices` non-empty;
  the ≥3 rule stays a test assertion, not schema.
- D10 (lead, un-arena'd): MATH_RECORDS holds the 53 playable items
  only. The 18 answer-less JSON rows are not items yet (no answer, not
  dealt); `allMathRows()` keeps its current JSON-backed implementation
  and its 71-row test. The next math PR promotes rows into records when
  they get answers. The projection-equality fixture covers `mathUnits()`
  (53, in order) + `MATH_ANSWERS` (53, per id).

## How (pstack 6) — step list

0. Fixture first, before any edit: script (scratch, not committed) imports
   `items.ts`/`answers.ts` under `node --experimental-strip-types` on the
   unedited tree, writes `{units: mathUnits(), answers: MATH_ANSWERS}` to
   `src/subjects/math/__fixtures__/main-7bc4d8f2.json`. Verify: 53 units,
   53 answer keys, `git status` shows no source edits yet.
1. Failing test first: `src/subjects/math/records.test.ts` — (a) a record
   whose `why` contains its correct-choice token fails the validator;
   (b) a record with no answer fails; (c) projection-equality vs the
   fixture. Run it before the validator/records exist; predicted failure:
   import error on the missing module. Record the signature.
2. Generator script (scratch, not committed): reads
   `docs/scaling/math/number/items.json` + `applied/items.json` +
   `src/subjects/math/answers.ts`, emits the new `items.ts` (header
   comment, zod `SubjectItemSchema`/`AnswerSchema`, `MATH_RECORDS` in
   `WAVE1_ITEM_IDS` deal order, projections, `mathUnits`/
   `itemsForGroup`/`allMathRows`/`WAVE1_ITEM_IDS` preserved). Content
   bytes come from the script's input, never retyped.
3. Rewrite `answers.ts` thin: `MATH_ANSWERS`/`answerFor`/
   `MathAnswerEntry` projected from `MATH_RECORDS`; drop shared imports
   (pending the consumer grep in step D3).
4. `src/subjects/math/validate.ts`: imports `MATH_RECORDS` + schema from
   `./items.ts` + `zod` only; checks schema parse, answer present,
   giveaway (lint semantics), media-id existence (D5), stored current
   year (lint `findLiteralYear` semantics); CLI exits non-zero naming
   record id + rule; exports `validateMathRecords()` for the test.
5. Wire prebuild: append `&& node --experimental-strip-types
   src/subjects/math/validate.ts` to `package.json` `prebuild` (one token).
6. `docs/scaling/contracts.md` §I2: add the SubjectItem type, mark
   "Contract change (Phase 3, math first)", name `items.ts` canonical
   for math, provenance UNVERIFIED, leadPolicy `answer-not-in-lead`,
   media `[]` for math.
7. Gates (lead re-runs): `npx tsc --noEmit`, `npm test`, `npm run
   test:worker`, `node scripts/lint-cards.mjs`, `npm run build:pages`,
   `npm run lint:nav`, `npm run lint:subjects`, `npm run
   check:provenance`, `npm run check:entry-size`, `npm run lint:arch`,
   `npx playwright test tests/e2e/*math* --workers=1`. Remove stale
   layer-baseline entries for dropped imports only (verify via the
   baseline test / lint:arch output).
8. Panel review (evidence pack: diff, gate output, brief section), max 2
   rounds, scoped re-votes. Then draft PR with the template filled in.

Exact verify commands: `node --experimental-strip-types
--test src/subjects/math/records.test.ts` (confirm the runner from
`scripts/run-tests.mjs` first); `npm run lint:subjects`; `npm run
lint:arch`; `npx tsc --noEmit`; `npm run build:pages` (runs prebuild,
so it runs the validator); `npx playwright test tests/e2e/*math*
--workers=1`.

## Graph

Nodes/edges to add (integrator folds in; this branch does not edit
`docs/knowledge/graph.json`): SubjectItem schema node (supersedes the
I2 UnitItem shape for math), `math records` node under
`src/subjects/math/items.ts`, validator node (prebuild), contract-change
edge from `docs/scaling/contracts.md` §I2.

## Lead verification + gates (2026-11-20, lead re-ran everything)

Builder report (~45k est): records generated by
`node --experimental-strip-types /tmp/gen-math-records.mts`; records.test
3/3, math.test 11/11, lint:subjects PASS, lint:arch PASS, prebuild PASS
("math records: 53 valid"). Generator had one caught bug (double-escaped
`\d` in the verifiedOn regex), fixed to `[0-9]`, regenerated, re-verified.
Lead checked the diff itself: scope is exactly the allowed files
(contracts +30, baseline −3, package.json 2 lines, answers thin,
items +1834, math.test import move, new fixture/records.test/validate);
`answers.ts` imports only `./items.ts`; `validate.ts` imports only
`./items.ts` + node builtins and its giveaway/year mirrors match
`lint-subject-leads.mjs` token-for-token (STOP list, posesOptions,
date-stamp + PIN_YEAR exclusions); D5 registries verified (102 clip ids
from journal-manifest `movies`, 106 still stems from
`public/images/journal/*.webp`); projections are faithful (arrays copied,
optional answer fields kept only when defined).

Lead calls: (1) prebuild:pages also gets the validator token. The brief
says "validator in prebuild", but `npm run build:pages` runs
`prebuild:pages`, not `prebuild` — without the second token the shipped
Pages artifact would never be validated. One token, same line family;
`prebuild:dev` untouched (fast dev loop, out of the brief's letter).
Verified: `npm run prebuild:pages` prints "math records: 53 valid".
(2) Environment: `node_modules` was incomplete on this VM (no esbuild,
no @cloudflare) so tsc failed on 7 errors in OTHER lanes' test files
and build:pages failed on the missing plugin — zero errors in math
files. Repaired with `npm ci` (lockfile restore, 365 packages, no new
dependency), then re-ran. This is environment repair, not a code fix.

Gates (lead, on the branch tip): `npx tsc --noEmit` PASS (clean after
npm ci); `npm test` PASS 3003/3003, 0 fail; `npm run test:worker` PASS
235/235, 0 fail; `node scripts/lint-cards.mjs` GATE PASSED;
`npm run build:pages` PASS (with VITE_KOFI_URL set, per AGENTS.md);
`npm run lint:nav` PASS; `npm run lint:subjects` GATE PASSED (12 known
entries, no new); `npm run check:provenance` PASSED for
origin/main..HEAD; `npm run check:entry-size` PASS (entry JS gzip
319,536 B, limit 323,865 B, 4,329 B to spare — run after build:pages,
it needs dist/); `npm run lint:arch` PASS.
Playwright math e2e (`tests/e2e/*math* --workers=1`, bundled chromium
1243 via PLAYWRIGHT_CHROMIUM_EXECUTABLE — /opt/meta-chromium refuses
to start with "Hatch WebGL domain policy is required", exit 13, per
AGENTS.md): first run 36/36 failed at browser launch (wrong chrome);
second run (bundled chromium, flock, VITE_KOFI_URL set) 10/10 passed
then test 11 (math-clue-scene-1018.mobile: every 10-18 case) timed out
at its 600s setTimeout — `locator.click` on "Next case" retried 1168×
because `<footer class="agep-footer">` intercepts pointer events on
the mobile viewport. No UI/CSS/layout file changed in this PR (data
sourcing only; deal order fixture-proven identical; the same spec
passed on desktop), so this reads as a pre-existing mobile layout
failure, not a regression. Per AGENTS.md §9 it is a regression only
after a lone re-run fails too: lone re-run of that spec on this branch
pending, then the same spec on main (separate worktree) if it fails
again. Full-run result: 35 passed, 1 failed (29.9m).

VM restart (2026-11-20 ~14:13, uptime 0): the lone re-run was killed
mid-flight with no result, /tmp was wiped (both e2e logs and the scratch
generator `/tmp/gen-math-records.mts` are gone; the records themselves are
verified by the fixture test, so nothing of the change is lost), and the
test-results failure artifacts are gone too. Branch, node_modules,
bundled chromium and the main worktree survived; status is clean apart
from the intended files (e2e `*-shots/` noise removed). Lone re-run is
being repeated with its log in the workspace, not /tmp. Evidence for the
35/1 full run now rests on this file (test name, cause and retry count
were read from the error context before the restart).

## Graph (AGENTS.md §7 — integrator folds this in at merge)

Nodes to add:
- `spec:subject-item` (kind `spec`, path
  `docs/scaling/contracts.md` §I2b): SubjectItem — one validated record per
  subject item (answer, provenance, media, leadPolicy), math first.
- `src:math-records` (kind `src`, path `src/subjects/math/items.ts`):
  MATH_RECORDS + SubjectItemSchema, the single validated math source.
- `src:math-validator` (kind `src`, path `src/subjects/math/validate.ts`):
  build-time validator run from prebuild and prebuild:pages.
Edges to add:
- `src:math-records` `depends-on` `spec:subject-item`
- `src:math-validator` `depends-on` `src:math-records`
- `spec:subject-item` `depends-on` `doc:contracts` (if that node exists;
  otherwise on `docs/scaling/contracts.md` as a doc node)
- `src:math-records` `supersedes` the split math storage (JSON rows +
  separate answers module) — the old `answers.ts` becomes a one-release
  compat projection, deleted by the next math PR.

## Panel review — READY (2026-11-20 ~14:54 CST, final tip c1871f90)

Evidence pack: `docs/branch-status/panel-feat-phase-3-math-content-source/`
(PACK.md, diff.txt, TALLY.md, exp/ — local evidence, not committed).
Wave 1 (3 seats, clean context): UX Architect, UI Designer, Accessibility
Auditor — all APPROVE-WITH-NITS, zero BLOCKs. Nits: duplicate-id guard,
follow-up giveaway check, stale test header, §I2b wording (prebuild AND
prebuild:pages; 18 JSON-backed rows), AnswerEntry type pin, generator
note. Cures landed in one commit (c1871f90): records.test 5/5, tsc clean,
lint:subjects PASS, lint:arch clean, prebuild "math records: 53 valid",
build:pages rebuilt PASS. Scoped re-vote on the delta: 3/3 APPROVE.
Wave 2 experiential: played one math case end to end at 390px and
desktop on the cured tip's fresh build — identical first case, zero
errors, no player-visible change; artifacts exp/LOG.md + 8 screenshots +
session.mts. APPROVE.
Carried visibly: the educator / subject-expert seat is VACANT (no persona
file on disk). Content correctness rests on the frozen-fixture
byte-equality test + validator; the merge decision carries this vacancy.
Unslop: contracts §I2b and the PR body read clean (plain, factual, no
padded prose); no changes needed.

## Done / pending

- Done: base verified (7bc4d8f2), facts re-checked, capsule, statechart,
  architect map, arena (both workers, lead picks D1–D10), failing test
  (ERR_MODULE_NOT_FOUND on validate.ts, verified by lead), records
  generation, compat wiring, validator wiring (prebuild + prebuild:pages),
  contracts §I2b, all gates, math e2e resolved as pre-existing on main,
  panel review (2 rounds, READY), unslop, draft PR.
- E2E RESOLVED (2026-11-20): the lone re-run failed the same way, and
  the same spec on main 7bc4d8f2 (separate worktree, since removed) failed
  identically — same "Next case" click, same `<footer class="agep-footer">`
  intercept, same 600s timeout (log copied to
  e2e-math-mobile-main.log). Pre-existing main failure, not a regression:
  this PR touches no UI/CSS/layout file. Per AGENTS.md §4, a run matching
  main's known failures satisfies the §9 E2E gate: math e2e 35/36, the 1
  failure pre-existing.
- Pending: Veeresh's merge decision (per-PR, pinned to head SHA). Before
  merge: "Update branch" onto latest main, rerun gates, report synced
  head SHA.
- Open questions: none for Veeresh right now. If the validator finds a
  known baseline case, it will be reported, not fixed.
- Ruled out: new `records.ts` re-exported by `items.ts` (upward import);
  new baseline entry (weakens the check); extending `lint:subjects` as
  the validator (unless arena picks it); retyping records (script only).
