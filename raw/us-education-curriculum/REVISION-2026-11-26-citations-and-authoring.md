# Revision 2026-11-26 — Citation verification and content authoring

This revision verifies primary citations, records content authoring
across the 4-wave rollout, and closes open register items.

## 1. Citation verifications

### g = 9.8 m/s² — gravitational acceleration

**Claim:** Standard gravitational acceleration used in Meridian physics
items is g = 9.8 m/s².

**Verification:**
- NIST Reference on Constants, Units, and Uncertainty: standard
  acceleration of gravity gₙ = 9.80665 m/s² (exact, defined)
  https://physics.nist.gov/cgi-bin/cuu/Value?gn
  [High - official narrow-fact, single authoritative source]
- The value 9.8 m/s² is the standard rounded form used in K-12
  education per NGSS and all six cohort district course sequences.
  Meridian physics items use 9.8 m/s² (rounded from the NIST exact
  value) as appropriate for T1–T3 education, never the more precise
  engineering value.

**Status:** Verified. Primary citation: NIST.

### CCSS Grades 6-8 standard text

**Claim:** Mathematics standards cited in Meridian's Middle School
(T2) items use CCSS standard codes and text.

**Verification:**
- Common Core State Standards for Mathematics (CCSS-M), published by
  the Council of Chief State School Officers (CCSSO) and the National
  Governors Association (NGA):
  https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf
  [High - official primary source]
- The ADA-compliant PDF is the authoritative current version, hosted
  by CCSSO (the copyright holder). It contains the full text of all
  K-12 mathematics standards including:
  - 6.RP.A.3 (Grade 6 Ratios and Proportional Relationships)
  - 6.SP.A.2 (Grade 6 Statistics and Probability)
  - 7.RP.A.2 (Grade 7 Ratios and Proportional Relationships)
  - 7.G.B.6 (Grade 7 Geometry)
  - 8.EE.A.4 (Grade 8 Expressions and Equations)
  - 8.G.B.7 (Grade 8 Geometry — Pythagorean Theorem)
- All Meridian items citing CCSS 6-8 codes reference this document as
  their `source` URL.

**Status:** Verified. Primary citation: CCSSO ADA-Compliant CCSS-M.

### Eanes ISD Science Meets on TEA

**Claim:** Eanes ISD (Westlake, TX) is rated by the Texas Education
Agency with scaled score 94 = A.

**Verification:**
- Texas Education Agency 2025 Accountability Ratings:
  https://tea.texas.gov/school-and-district-leaders/accountability/academic-accountability/performance-reporting/2025-accountability-rating-system
  [Moderate 2/3 — two supporting sources share one origin (TEA)]
- TXschools.gov district report (TEA portal):
  Student Achievement domain scaled score 94, overall grade A.
  Academic Growth domain score 82.
- Confidence correction from REVISION-2026-11-25 §7: both supporting
  sources share one origin (TEA), so the confidence tag is
  [Moderate 2/3], not [High 2/3].
- Eanes ISD course sequences confirmed in Lane 5 and Lane 10:
  Bio Gr 9 → IPC/Chem Gr 10 → Chem/Physics Gr 11-12; Algebra I
  reachable Gr 8; 4-year math ladder to AP Calc BC.

**Status:** Verified at [Moderate 2/3]. Primary citation: TEA.

## 2. Content authoring summary — 4-wave rollout

All Biology content is authored in `src/subjects/biology/items.ts`.
The 5-pillar content anchors are recorded in the evidence lane files
and revision documents. Content follows the standards anchors from
Lane 6 (Biology) and Lanes 7-11 (competition benchmarks).

### Wave 1 — Elementary (T1, ages 7-10)

4 Biology starter prompts authored:
1. `biology:life-matter:seed-diary` — plants get materials from air
   and water (5-LS1-1)
2. `biology:life-cycles:whose-baby` — life cycles share birth, growth,
   reproduction, death (3-LS1-1)
3. `biology:life-structure:built-for-job` — structures support
   survival (4-LS1-1)
4. `biology:life-ecosystems:dry-summer` — differential survival in
   habitats (3-LS4-3)

**Pillar content (T1):**
- Road/bike safety anchored to NHTSA K-5 pedestrian curriculum (H01)
- Grade 5 fraction alignment: `fractions:compare-unlike` tagged to
  Grade 5 per CCSS 5.NF.A.1

### Wave 2 — Middle School (T2, ages 10-18)

5 Biology items authored:
1. `biology:life-structure:one-cell-many-jobs` — cells and organelles
   (MS-LS1-2)
2. `biology:life-health:team-inside-you` — interacting body systems
   (MS-LS1-3)
3. `biology:life-ecosystems:grass-runs-short` — resource limits and
   populations (MS-LS2-1)
4. `biology:life-heredity:family-resemblance` — genes, chromosomes,
   and trait variation (MS-LS3-1)
5. `biology:life-evolution:peppered-moth` — natural selection in
   action (MS-LS4-6)

### Wave 3 — High School (T3, ages 10-18)

4 Biology items authored:
1. `biology:life-ecosystems:valley-wolves` — carrying capacity with
   mathematical representation (HS-LS2-1)
2. `biology:life-matter:follow-carbon` — carbon cycle through
   photosynthesis and respiration (HS-LS2-3)
3. `biology:life-heredity:molecular-inheritance` — DNA structure and
   complementary base pairing (HS-LS3-1), USABO ceiling
4. `biology:life-evolution:speciation-islands` — adaptive radiation
   and speciation (HS-LS4-5), USABO ceiling

**Pillar content (T3):**
- NCF-Envirothon 5-station field questions and Oral Presentation
  scenarios anchored in Lane 11
- Rangeland Management (Kansas Envirothon) included

### Wave 4 — Adult (T4, ages 18+)

1 safety-reviewed Biology literacy prompt:
1. `biology:life-health:read-the-label` — relative vs absolute risk
   in health claims. Safety review: no medical advice given; no
   diagnosis, treatment, or specific health recommendations. The item
   teaches evidence evaluation, not health guidance.

## 3. Open register items — status

| Register item | Status | Evidence |
|---|---|---|
| g = 9.8 m/s² citation | **CLOSED** — verified against NIST | §1 above |
| CCSS 6-8 standard text | **CLOSED** — verified against CCSSO PDF | §1 above |
| Eanes ISD on TEA | **CLOSED** — verified at [Moderate 2/3] | §1 above |
| LS3/LS4 T2+T3 anchors | **CLOSED** — Lane 6 Pass 2 | lane6-pass2-heredity-evolution.md |
| H01-H03 promotion | **CLOSED** — sourced from NHTSA/MUTCD/DMV | REVISION-2026-11-26-inventory-retag.md §3 |
| NCF-Envirothon benchmark | **CLOSED** — Lane 11 | lane11-envirothon-benchmark.md |
| Kansas Envirothon + St. John's | **CLOSED** — Lane 11 | lane11-envirothon-benchmark.md §11.3 |
| District-level Life Science sequences | **CLOSED** at catalog level | Lane 10 (pacing-guide pass) |
| National T4 Life Science standard | **UNCHANGED** — none exists | Lane 6 LS-013 |
| Discoverability (Biology under GK) | **SUPERSEDED** — Biology is now its own card | REVISION-2026-11-26-biology-7th-card.md |
