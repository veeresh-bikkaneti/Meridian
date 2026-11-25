# Lane 4 — Meridian Inventory (Why Learn supply side) [Tested]

All product claims in this file are **[Tested]** — direct code reads of `origin/main` in repo `~/workspace/meridian-landmark-canon`, unless marked [Inferred] in §(d).

**Source-tree verification:** working tree at `feat/landmark-canon` (7e6c1653) is **stale/divergent** vs `origin/main` on `src/subjects` (`git diff origin/main --stat -- src/subjects`: 41 files, +1,568/−10,647). Therefore **all reads below are from `origin/main`**, extracted mechanically with `git archive origin/main src/subjects | tar -x -C /tmp/lane4`. No repo files were edited.

## Registry — `src/subjects/registry.ts` [Tested]

- `export type AgeGroup = "7-10" | "10-18" | "18+";` — exactly 3 bands; no grade field anywhere in the type.
- `UnitItem = { id, group: AgeGroup, objective, standard: {code, source} | "UNVERIFIED", why, buildsOn: string[], useElsewhere: string[] }` — **records carry no `title` field**; the topic identifier is `id` (used as the title/topic in §(b)).
- `SubjectModule = { id, title, groups: AgeGroup[], released: boolean, units: UnitItem[], load }`; only modules with `released === true` and `id === folder name` are listed by `selectReleased` / `listReleasedSubjects()` (discovery via `import.meta.glob("./*/index.ts")`).
- All 6 subject `index.ts` files declare `released: true`, `groups: ["7-10", "10-18", "18+"]`, titles: Math, Physics, Chemistry, General knowledge, Social studies, Journals (`src/subjects/{math,physics,chemistry,general-knowledge,social-studies,journals}/index.ts`).
- Planned order in `src/subjects/shared/picker-rows.ts` (`PLANNED_SUBJECTS`): math, physics, chemistry, general-knowledge, social-studies, journals.

## (a) Subject × band item-count table [Tested]

**Counting method (reproducible):** Python `re` over each subject's `src/subjects/<subject>/items.ts` on `origin/main`, matching the record pattern `"id": "<id>",` followed on the next line by `"group": "<band>",` followed by `"objective":` — i.e. one match = one object in the exported `*_RECORDS: SubjectItem[]` array (MATH_RECORDS / PHYSICS_RECORDS / CHEMISTRY_RECORDS / GENERAL_KNOWLEDGE_RECORDS / SOCIAL_STUDIES_RECORDS / JOURNAL_RECORDS). Cross-checks: (1) each file header states its total (Math 53, Physics 24, Chemistry 16, GK 10, Social Studies 12, Journals 16) — all match; (2) Journals header states its split `8 / 7 / 1 per band` — matches; Physics header states `12 / 9 / 3` — matches.

| Subject | 7–10 | 10–18 | 18+ | Total |
|---|---:|---:|---:|---:|
| Math | 22 | 28 | 3 | 53 |
| Physics | 12 | 9 | 3 | 24 |
| Chemistry | 5 | 8 | 3 | 16 |
| General Knowledge | 5 | 3 | 2 | 10 |
| Social Studies | 4 | 5 | 3 | 12 |
| Journals | 8 | 7 | 1 | 16 |
| **Total** | **56** | **60** | **15** | **131** |

**Math claim verification: VERIFIED.** Claim "Math 53 items (22 @7–10, 28 @10–18, 3 @18+)" matches the mechanical count exactly (53; 22 / 28 / 3).

## (b) Per-cell topic lists [Tested]

Topics are the record `id`s (no `title` field exists — see Registry note). Listed in file/deal order, grouped by band.

### Math — `src/subjects/math/items.ts`

**7-10 (22):** `math-number:groups:skip-count`, `math-number:groups:equal-groups`, `math-number:tables:buses`, `math-number:place:hundreds-tens-ones`, `math-number:place:compare`, `math-number:place:round`, `math-number:place:ten-times`, `math-number:tables:facts`, `math-number:tables:big-products`, `math-number:division:fair-share`, `math-number:division:unknown-factor`, `math-number:division:remainders`, `math-number:division:big-quotients`, `math-number:fractions:fair-parts`, `math-number:fractions:equivalent`, `math-number:fractions:compare-unlike`, `math-number:groups:arrays`, `math-applied:measure:longer-than`, `math-applied:measure:choose-unit`, `math-applied:measure:elapsed-time`, `math-applied:measure:perimeter`, `math-applied:measure:rect-area`

**10-18 (28):** `math-number:tables:multi-digit`, `math-applied:measure:convert-metric`, `math-number:fractions:percent`, `math-applied:geometry:scale-drawing`, `math-number:division:standard-algorithm`, `math-number:fractions:multiply`, `math-number:fractions:divide`, `math-applied:measure:accuracy`, `math-applied:rates:unit-rate`, `math-applied:rates:constant-speed`, `math-applied:rates:one-step`, `math-applied:rates:two-step`, `math-applied:trig:bearings`, `math-number:division:two-digit-divisors`, `math-number:fractions:add-unlike`, `math-applied:trig:missing-angle`, `math-number:place:decimal-shifts`, `math-applied:measure:volume-box`, `math-applied:geometry:coordinates`, `math-applied:geometry:pythagoras`, `math-applied:geometry:distance-points`, `math-applied:geometry:cylinder-volume`, `math-applied:rates:proportion`, `math-applied:rates:rearrange`, `math-applied:rates:linear-model`, `math-applied:trig:ratios`, `math-applied:trig:missing-side`, `math-applied:trig:triangle-area`

**18+ (3):** `math-number:tables:mental-strategies`, `math-number:fractions:combine-shares`, `math-applied:measure:survey-check`

### Physics — `src/subjects/physics/items.ts`

**7-10 (12):** `physics:push:which-way`, `physics:push:equal-pushes`, `physics:magnet:flip`, `physics:drop:down`, `physics:friction:measure-slide`, `physics:ramp:faster-hits-harder`, `physics:arrive:equal-steps`, `physics:lever:seesaw`, `physics:balance:tug`, `physics:energy:wound-moves`, `physics:shadow:blocks`, `physics:mirror:sends-back`

**10-18 (9):** `physics:arrive:unit-rate`, `physics:ramp:slope-ratio`, `physics:magnet:closer`, `physics:push:mass`, `physics:push:table`, `physics:ramp:higher-stored`, `physics:energy:transfer`, `physics:sound:medium`, `physics:mirror:three-ways`

**18+ (3):** `physics:ramp:adult-ratio`, `physics:arrive:adult-time`, `physics:energy:missing`

### Chemistry — `src/subjects/chemistry/items.ts`

**7-10 (5):** `chemistry:states:solid-liquid`, `chemistry:states:melt-freeze`, `chemistry:materials:sort`, `chemistry:materials:magnet`, `chemistry:pieces:rebuild`

**10-18 (8):** `chemistry:states:road-salt`, `chemistry:mixtures:dissolve`, `chemistry:reactions:weight`, `chemistry:states:particles`, `chemistry:water:cycle`, `chemistry:reactions:new-look`, `chemistry:reactions:rust`, `chemistry:materials:identify`

**18+ (3):** `chemistry:reactions:rate`, `chemistry:reactions:mass`, `chemistry:reactions:explain`

### General Knowledge — `src/subjects/general-knowledge/items.ts`

**7-10 (5):** `general-knowledge:mixed:opera-years-ago`, `general-knowledge:mixed:eiffel-antennas`, `general-knowledge:mixed:older-landmark`, `general-knowledge:mixed:falls-in-km`, `general-knowledge:mixed:trip-buses`

**10-18 (3):** `general-knowledge:mixed:everest-vs-falls`, `general-knowledge:mixed:paris-sydney-flight`, `general-knowledge:mixed:tower-angle`

**18+ (2):** `general-knowledge:mixed:great-circle`, `general-knowledge:mixed:falls-flow`

### Social Studies — `src/subjects/social-studies/items.ts`

**7-10 (4):** `social-studies:region:area-by-squares`, `social-studies:route:count-the-steps`, `social-studies:route:trip-clock`, `social-studies:place:compass-clue`

**10-18 (5):** `social-studies:region:density`, `social-studies:route:scale-ratio`, `social-studies:route:travel-time`, `social-studies:route:fastest-or-shortest`, `social-studies:compare:time-zones`

**18+ (3):** `social-studies:region:flat-map-area`, `social-studies:route:great-circle`, `social-studies:compare:trip-cost`

### Journals — `src/subjects/journals/items.ts`

**7-10 (8):** `great-leaders:lincoln-memorial`, `technology:first-phone`, `technology:eniac`, `modern-world:greenwich-zero`, `modern-world:liverpool-manchester`, `modern-world:hearts-content-cable`, `people-places:pont-du-gard`, `people-places:akashi-span`

**10-18 (7):** `technology:mobile-phone`, `great-leaders:lincoln-memorial:stretch`, `modern-world:greenwich-zero:stretch`, `modern-world:liverpool-manchester:stretch`, `modern-world:hearts-content-cable:stretch`, `people-places:eratosthenes-earth`, `people-places:andean-roads`

**18+ (1):** `people-places:aconcagua-height`

## (c) Picker / case-file format — `src/subjects/shared/SubjectPicker.tsx` [Tested]

**Screen framing (verbatim from JSX):**
- Eyebrow: `Case file · Why it matters`
- Heading (h1): `Why Do We Learn This?`
- Sub-line: `Pick a subject` when no band is set, otherwise `Pick a subject · Ages ${band}`
- Band ask lives on this page: `AgeBandControl` pills in the hero title block (3 pills unset; 1 selected-band pill once set). A card tap with profile status `unset` never opens a case — it scrolls/focuses to the pills instead.

**Card structure (per subject, Living Atlas anatomy):** 16:9 picture slot on top (CardFilm loop, or still) → badge (Lucide icon) + kicker (`Case file · <Title>`; journals ready-state kicker is `Latest journal entry`) → title + stamp chip (`<N> case(s)` when ready, `Coming soon` when not) → one-liner → go row pinned to bottom (`Open case →` when ready, `Coming soon` when disabled). Per-subject **Reset** button sits as a sibling at the card's bottom-right, disabled while that subject has no recorded progress. Ready = released module has ≥1 playable item for the current band (`src/subjects/shared/picker-rows.ts`); otherwise the row is a disabled "Coming soon" row. Spotlight walks ready cards on a 4 s clock (decoration only, off under prefers-reduced-motion).

**SUBJECT_ONE_LINERS verbatim** (`const SUBJECT_ONE_LINERS: Record<string, string>` in `SubjectPicker.tsx`, commented in code as "EDITABLE PLACEHOLDERS … the owner may reword"):

| Subject id | One-liner (verbatim) |
|---|---|
| math | "Why triangles hold up bridges" |
| physics | "Why a ball always comes back down" |
| chemistry | "Why bread rises and iron rusts" |
| general-knowledge | "Why places are where they are" |
| social-studies | "Why towns grew beside rivers" |
| journals | "Field notes from real places" |

Journals coming-soon render-site line (not in the map): `"New journals are on the way."`

**Case format** (`src/subjects/shared/SubjectCase.tsx`, shared generic flow; each subject's `<Subject>Case.tsx` is a thin wrapper passing title, test-id prefix, band items, answer lookup): problem read through the existing `ClueCard` using the item's `why` → shared `AnswerCard` asks one multiple-choice question (`answer.prompt` / `choices` / `correct`) → result mirrors LoopReveal language with the item's `useElsewhere` composed into a sentence (`used-in-line.ts`). Detective pair (Holmes/Watson) mounts once via `SubjectDetectiveHost`, answer-blind (only solved/wrongPick/finished booleans), gated on the `detectivePair` flag. Lose path: 2nd distinct wrong answer reveals supportive line + answer-first line + solved scene/summary where one exists (owner decision 2026-11-19, in file header).

## Clue scenes / films / progress & stamps — as recorded in code [Tested]

- **Clue scenes:** `scenes.ts` exists for 5 of 6 subjects, each exporting a `*_CLUE_SCENES: Record<string, ClueSceneDescription>` + `clueSceneFor(itemId)`: Math (`MATH_CLUE_SCENES`, ~37 top-level keys counted by regex over `src/subjects/math/scenes.ts` — partial coverage of its 53 items; SubjectCase header: "Math is the pilot"), Physics (24 keys = all 24 items), Chemistry (16 = all 16), Social Studies (12 = all 12), General Knowledge (9 literal keys in `GENERAL_KNOWLEDGE_CLUE_SCENES` + 1 computed opera scene via `operaSceneForYear(year)` = 10 items). **Journals has no `scenes.ts`** — its `items.ts` header: "No clip movie is rendered yet, so each case shows the clip's caption text as its lead" (captions via `src/subjects/journals/captions.ts` / `caption-files.ts`).
- **Picker card films:** `src/assets/why-learn/subject-card-media.ts` — `SUBJECT_CARD_MEDIA` has CardFilm loops for 5 subjects (math, physics, chemistry, social-studies, journals); **general-knowledge deliberately has NO film** (file header: animating the relief map redrew it wrong) — it uses the pristine globe still + `GkGlobeOverlay` motion. All subjects have stills (`SUBJECT_CARD_STILLS`).
- **Item media:** every subject's `items.ts` header states `media: []` for all its records (Math/Physics/Chemistry/GK/Social Studies) — no clip/still ids at item level; Journals records carry captions, not clip/still ids.
- **Progress wiring:** `src/subjects/shared/subject-progress.ts` is the sole owner of the per-subject progress store (one localStorage document: `{ [subjectId]: solvedUnitIds[] }`, no scores/attempts/answers). `SubjectCase.tsx` calls `recordUnitComplete(subjectId, item.id)` on a correct pick in the main phase; the picker reads it for each card's Reset enablement and `clearSubjectProgress(row.id)` clears only that subject. Global "Start over" clears all via `clearAllSubjectProgress`.
- **Stamps:** no stamp/badge-award system for subjects is recorded in `src/subjects/**` — the only "stamp" in the picker is the visual stamp chip on the card (`wl-chip-stamp`, showing case count / "Coming soon"). No per-item stamp collection wiring found. (Search: `grep -rin stamp src/subjects/`.)

## (d) First-pass thin/empty cells [Inferred]

- **No cell is empty:** all 18 subject × band cells have ≥1 item, so no picker row is "Coming soon" at any band on counts alone.
- **Thinnest band overall: 18+** — 15 of 131 items (11%). Thinnest cells: Journals 18+ = **1** (single item: `people-places:aconcagua-height`; a band with 1 case replays the same case every visit), GK 18+ = **2**, Math / Physics / Chemistry / Social Studies 18+ = **3 each**.
- **Math is the most lopsided:** 22 / 28 / 3 — its 18+ tier is 5.7% of its items despite Math being the largest subject (53).
- **GK (10) and Social Studies (12) are thin in absolute terms** at every band (2–5 per cell) vs Math's 22–28 in the two younger bands.
- **Mapping risk for the 4-tier design [Inferred]:** today's middle band `10–18` lumps what the new tiers split as T2 (11–14) + T3 (14–18) — there is **no per-item grade/age granularity inside `10–18`** in code (`AgeGroup` is the only axis), so T2 vs T3 supply cannot be separated from existing records without re-tagging all 60 items in that band (28 Math + 9 Physics + 8 Chemistry + 3 GK + 5 Social Studies + 7 Journals = 60); the band labels also overlap at the boundaries (age 10 is in both `7-10` and `10-18` as written, age 18 in both `10-18` and `18+`).
- **Journals is structurally different [Tested/Inferred]:** no clue scenes, caption-text leads, and 4 of its 16 records are `:stretch` variants of other records — its effective distinct-topic count is lower than 16.
