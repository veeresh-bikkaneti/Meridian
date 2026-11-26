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

## Next step
- Lane 6 pass 2: T2/T3 records for LS3 heredity and LS4 evolution,
  plus state-standard corroboration for Lane 6 placements.
- Authoring queue (revision §8): T1 foundation prompts first, then
  T2, then T3, then the single safety-reviewed T4 literacy prompt.
  Each authoring wave is its own decision and lane.
- Authoring wave now unblocked by lanes 7-10: five-pillar content records per tier; H01-H03 promotable from UNVERIFIED to sourced via lane 9; USABO is the T3 ceiling for the Living World strand.

## Open questions
- Whether any of this research converts into build lanes; the tier
  design is calibrated to 4 tiers and folds back to the current
  3 bands (7-10 / 10-18 / 18+) per the owner's standing band ruling.
- Discoverability of Biology under the General Knowledge label is
  untested; it is one of the three 7th-category triggers.

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
