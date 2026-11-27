# Branch status — research/us-education-curriculum

## Done
- US education curriculum research pack added as the first ingest of
  the repo knowledge base (AGENTS.md §13): the immutable pack lives
  in `raw/us-education-curriculum/`, with its summary at
  `wiki/sources/us-education-curriculum.md`, the concept page
  `wiki/concepts/why-learn-tiers.md`, and index + log updated.
  (Owner's instruction, 2026-11-24: "push all the research into a
  feature branch labeled research on US education curriculum";
  "Everything has to live in remote Gits".)
- Contents: CURRICULUM-DESIGN.md (district sample justification table
  for both cohorts, 4-tier structure + collapse-to-3 note, 6x4
  curriculum matrix, 96 case-file prompts, gap & priority
  recommendations, Data-not-available register), SOURCES.md (128
  deduplicated sources), evidence/ (5 research lanes + 4 council
  memos).
- Research only: no code, no content records, no behaviour change.
- Revision 2026-11-25 (owner's decision documents of 2026-11-25;
  owner's word "Fix it" 2026-11-26): added
  `raw/us-education-curriculum/REVISION-2026-11-25-living-world.md`
  and `raw/us-education-curriculum/evidence/lane6-life-science.md`;
  wiki summary, concept page, index, and log updated.
  - Living World adopted: Biology/Life Science is a protected
    first-class strand inside General Knowledge (id `life-science`,
    one-third T1–T2 GK planning target). Options A (7th category)
    and C (unprotected distribution) rejected, with triggers for
    revisiting a 7th category recorded.
  - Confidence standard replaced (High = 2+ independent primary
    sources, narrow-fact single-source exception). Audit of 475
    tags ruled 10 corrections, stated in the revision document
    because the original raw files are immutable.
  - Inventory audit: 78 items classified, 0 Primary Living World,
    0 cross-tagged, 0 of 8 domains represented. Every Living World
    item must be authored new.
  - Lane 6: 13 structured NGSS evidence records (LS-001 to LS-013).
    LS1/LS2 anchored T1–T3; LS3/LS4 anchored at T1 only; T4 has no
    national standard (Data not available).

- Revision 2026-11-26 (owner's required curriculum direction, 2026-11-26; responds to the external audit `meridian-audit-vs-plan-2026-11-26.md` of this branch @ 447ff41): competition-anchored rebuild of the five pillars on the existing T1-T4 tiers. Added `raw/us-education-curriculum/REVISION-2026-11-26-competition-anchored-rebuild.md` plus evidence lanes 7-10 (olympiads; young scientist + environmental competitions; safety/situational/riddles; district pacing-guide pass with the NCES CCD federal layer). Audit gaps A1-A5 and P1-P5 each mapped to a closing lane; 5 pillars x T1-T4 x competition benchmarks; depth rule = base anchor + competition ceiling anchor per cell. Competition eligibility verified on organizer official pages 2026-11-26; revised confidence standard (2026-11-25) applied. Wiki (us-education-curriculum, why-learn-tiers, index, log) updated; no existing raw file edited; research only, no code, no content records.
- Gap-closure pass 2026-11-26 (5 tasks + review pushback fixes):
  1. Promoted Biology to standalone 7th subject card (`src/subjects/biology/index.ts`, `items.ts`, `BiologyCase.tsx`, `src/subjects/shared/picker-rows.ts`, `SubjectPicker.tsx`), superseding the interim Living World strand decision (`raw/us-education-curriculum/REVISION-2026-11-26-biology-7th-card.md`, verbatim owner words recorded in `REVISION-2026-11-26-review-pushback-fixes.md` §5).
  2. Finished Biology Lane 6 Pass 2 (`raw/us-education-curriculum/evidence/lane6-pass2-heredity-evolution.md`): added 12 NGSS records (LS-014 to LS-025) for MS-LS3, MS-LS4, HS-LS3, HS-LS4 with TX/FL/CA corroboration and USABO as T3 ceiling.
  3. Added NCF-Envirothon & Kansas Envirothon benchmark (`raw/us-education-curriculum/evidence/lane11-envirothon-benchmark.md`) + pushback corrections (`REVISION-2026-11-26-review-pushback-fixes.md` §3): Kansas core 5 incl. Rangeland PLUS Current Issue & Oral Presentation; St. John's Catholic School (Beloit, KS) 2024 Geneva NY, 2025 Calgary 24th/51, 2026 Mississippi State Team #2640 (`499.00`), `"12th place"` downgraded to `[Moderate]`.
  4. Split `69` `10-18` items (`60` pre-existing: `35` T2 / `25` T3; `9` Biology: `5` T2 / `4` T3; total `40` T2 / `29` T3) and tagged `math-number:fractions:compare-unlike` to Grade 5 in `src/subjects/shared/tier-tags.ts` (data-only at runtime); `H01–H03` promoted in research pack while `docs/scaling/humanities/screened-topics.md:49` still reads `UNVERIFIED`.
  5. Verified primary citations (`g = 9.8 m/s²`, CCSS 6–8, Eanes ISD on TEA), authored Wave 1–4 Biology content (`src/subjects/biology/items.ts`), and added `biology` to `scripts/lint-subject-leads.mjs`. Updated `wiki/` pages and `wiki/log.md`.
  - Measured gates (`2026-11-26`): `src/subjects/*/*.test.ts` `342/342` PASS (`tier-tags.test.ts` `2/2`); `lint:nav` PASS; `lint-cards.mjs` PASS; `build:pages` PASS; `lint:subjects` exits 1 (`GATE FAILED (8)` on pre-existing `journals` mismatches; `biology` has `0` findings across `leads=1021`); Playwright E2E NOT RUN.
- Curriculum authoring & runtime wiring W1–W5 (`2026-11-26`):
  - **W1** (`57cc3a64`): authored 10 Wave A GK Pillars 3–5 items (road/bike/GDL safety H01–H03, situational awareness, competition riddles; 6 at `10-18`).
  - **W2** (`e5517c16`): authored 14 Wave B GK Environmental Studies items (NGSS ESS/LS2 at T1–T2 + NCF-Envirothon 5 stations, Oral Presentation, and Kansas Rangeland at T3; 11 at `10-18`) and cured Wave A leads.
  - **W3** (`42951e6d`): authored 6 Wave C quantitative T3 Olympiad-ceiling `10-18` items (2 Physics `F=ma`/USAPhO, 2 Chemistry USNCO, 2 Social Studies C3 9–12).
  - **W4** (`bade5445`): added Biology record validator, unit tests, and educator review packet.
  - **W5** (uncommitted): tagged all 23 new `10-18` items in `src/subjects/shared/tier-tags.ts` (92 total: 47 T2, 45 T3), added `sequenceByCurriculumTier(items, group)` (T2 before T3 for `10-18`, unchanged for `7-10`/`18+`), wired it in `src/subjects/shared/SubjectCase.tsx`, and added the 7-card picker + Biology case test in `tests/e2e/subjects-picker.desktop.spec.ts`.
  - Measured gates W5 (`2026-11-26`): `src/subjects/*/*.test.ts` `354/354` PASS (`tier-tags.test.ts` `4/4`); `npm run lint:nav` PASS; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` PASS; `npx tsc --noEmit` 0 errors in touched files (pre-existing `.stories.tsx` and `src/play-lab/components/ScaledHomeMockup.tsx` errors only); Playwright (`--workers=1`): `tests/e2e/subjects-picker.desktop.spec.ts` `7/7` PASS, `tests/e2e/home-layout.desktop.spec.ts` `6/14` PASS / `8` pre-existing FAIL (`credits-link` strict mode 2 elements across 6 viewports; `review on spot cards` 1 card in 3 columns at `768x1024` and `1280x800`).
- Review record (2026-11-26): Councilor C adversary review of the
  pushback-fixes tip (`6a6258b8`) ended with the verdict `NO OBJECTION`
  (reported by the owner in the 2026-11-26 session; written into this
  file per AGENTS.md section 5 because the review run did not record it
  here itself).
- Owner decision, verbatim, 2026-11-26, Biology 7th card (Option A),
  confirmed as the owner's own words in the 2026-11-26 session; also
  quoted in `raw/us-education-curriculum/REVISION-2026-11-26-review-pushback-fixes.md` section 5:

  > "1. Promote Biology to its own 7th subject card:
  > - Update `src/subjects/registry.ts` to add `biology` (`Biology`) as a standalone subject card alongside Math, Physics, Chemistry, Social Studies, Journals, and General Knowledge (keeping the 3 age bands: `7-10`, `10-18`, `18+`).
  > - Update the research/wiki decision docs to record that Option A (7th category) is now approved, superseding the interim General Knowledge strand decision."

  > "Biology (New Standalone 7th Card): Promoted out of General Knowledge so life sciences are clearly visible and never buried."

## Next step
- Educator review of the 14 authored Biology items and `SubjectPicker` visual layout with 7 subject cards.
- Author remaining 5-pillar content records (Envirothon, safety, riddles) into `general-knowledge` / `social-studies` / `journals` in the next build PR.

## Open questions
- National T4 Life Science standard: none exists (Lane 6 LS-013); T4 remains application-oriented biological literacy.
- **Blocked:** `meridian-audit-vs-plan-2026-11-26.md` is not present in this repository (`Data not available.` per `raw/us-education-curriculum/REVISION-2026-11-26-review-pushback-fixes.md` §4); ingest into `raw/` is blocked until the owner supplies the file.

## Ruled out
- No PR opened: the owner's instruction was to push the branch.
- No in-place edits to existing `raw/` files: corrections live in
  the dated revision document per AGENTS.md §13.

## Graph
- Add node: `raw/us-education-curriculum/CURRICULUM-DESIGN.md`
  (research pack) — documents the Why Learn curriculum design;
  decided-by the owner's research brief of 2026-11-24.
- Add node: `raw/us-education-curriculum/REVISION-2026-11-25-living-world.md`
  (revision) — adopts the Living World strand and the replaced
  confidence standard; decided-by the owner's decision documents of
  2026-11-25; documents
  `raw/us-education-curriculum/CURRICULUM-DESIGN.md`.
- Add node: `raw/us-education-curriculum/evidence/lane6-life-science.md`
  (evidence lane) — NGSS Life Science anchors for the Living World
  strand; documents the revision node above.
- Add node: `raw/us-education-curriculum/REVISION-2026-11-26-competition-anchored-rebuild.md` (revision) - rebuilds the plan on five pillars anchored in the six ESSA-verified districts plus national competition benchmarks; decided-by the owner's required curriculum direction of 2026-11-26; documents `raw/us-education-curriculum/CURRICULUM-DESIGN.md` and `raw/us-education-curriculum/REVISION-2026-11-25-living-world.md`.
- Add nodes: `raw/us-education-curriculum/evidence/lane7-competitions-olympiads.md`, `lane8-young-scientist-environmental.md`, `lane9-safety-situational-logic.md`, `lane10-district-pacing-pass.md` (evidence lanes) - competition/safety benchmarks and the district pacing-guide pass; document the 2026-11-26 revision node above.
- Add node: `raw/us-education-curriculum/REVISION-2026-11-26-review-pushback-fixes.md` (revision addendum) - pushback corrections, council finalization, and the owner-decision record; decided-by the owner's review pushback of 2026-11-26; documents the 2026-11-26 revision nodes above.
