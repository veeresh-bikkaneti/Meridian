# Revision 2026-11-26 - Competition-Anchored Rebuild of the Five Pillars

This revision rebuilds the curriculum plan on the owner's required
direction of 2026-11-26: anchor in **verified top-rated U.S. school
districts** (official Federal/State education-board data) and
**national competition standards**, across the branch's existing K-12
tiers (T1 Gr 2-5 · T2 Gr 6-8 · T3 Gr 9-12 · T4 18+), focused on five
pillars. It responds to the external audit
(`meridian-audit-vs-plan-2026-11-26.md`) of this branch @ `447ff41`.

Scope. Research and design only. No code, no content records, no
behaviour change. Files already in `raw/` stay immutable; this
document plus lanes 7-10 carry all corrections forward.

## 1. Gaps from the audit, and where each is fixed

| Audit item | Audit status | Fixed by |
|---|---|---|
| A1 Districts: pacing-guide pass open; St. Johns T3 + Chandler elementary "Data not available" | partial | `evidence/lane10-district-pacing-pass.md` (St. Johns T3 closed via SPP HS course sequence + Year-at-a-Glance + 2025-26 school catalogs; Chandler elementary closed via per-grade scope-and-sequence pages; NCES CCD federal layer; residual cells honestly registered) |
| A2 Olympiads/exams zero repo-wide (AMC 8/10/12, MathCounts, Science Olympiad, USAPhO, USNCO, USABO) | absent | `evidence/lane7-competitions-olympiads.md` |
| A3 Young Scientist zero (3M YSC, Thermo Fisher JIC, Regeneron ISEF) | absent | `evidence/lane8-young-scientist-environmental.md` §8.1 |
| A4 Environmental competitions zero (NCF-Envirothon, NOSB) | absent | `evidence/lane8-young-scientist-environmental.md` §8.2 |
| A5 Safety spec-only (H01-H03 UNVERIFIED); situational awareness 0 hits; riddles 0 hits | partial | `evidence/lane9-safety-situational-logic.md` (NHTSA/MUTCD/DMV sources; H01-H03 promotable; P4/P5 tier mappings) |
| P1 STEM depth calibrated to NGSS/AP, not competitions | partial | §4-§5 below: competition ceilings per tier (Lane 7/8) |
| P2 Environment: no competition case-file layer | partial | Lane 8 §8.2 (Envirothon stations + NOSB disciplines = T3 checklists) |
| P3 Traffic thin (no signage catalog, right-of-way, driving law, hazard anticipation) | thin | Lane 9 §9.1 |
| P4 Situational awareness absent | absent | Lane 9 §9.2 (protocol layer, honestly tagged [Inferred]) |
| P5 Educational riddles absent | absent | Lane 9 §9.3 (AMC/MATHCOUNTS/SciOly/NOSB logic benchmarks) |
| Reverse gaps: Social Studies, GK-trivia, Cohort 1 (unrated urban districts) invested against the plan's cut list | scope divergence | §3 below: the rebuild keeps NGSS/CCSS/C3 as the base layer but re-anchors calibration to Cohort 2 only; Cohort 1 stays as context, not baseline |

## 2. District anchors - verified top-rated districts, official data only

Calibration cohort = the six ESSA-verified districts (Lane 5), now
with a federal identity layer and a pacing-guide pass (Lane 10). No
sequence cell remains "Data not available" except where the district
publishes nothing (registered honestly in Lane 10 §10.4).

| District | Federal ID (NCES CCD) | State board portal + rating | Curriculum sequence source |
|---|---|---|---|
| St. Johns County SD, FL | CCD locator https://nces.ed.gov/ccd/districtsearch/ | FDOE School Grades: A; Academically High-Performing 2025-26 | SPP https://www.stjohns.k12.fl.us/spp/high/curriculum/ + Year-at-a-Glance pacing https://www.stjohns.k12.fl.us/year-at-a-glance/ + 2025-26 school course catalogs (Algebra I → Geometry → Algebra II → AP Pre-Calc → AP Calc AB/BC; AP Statistics branch) |
| Chandler USD #80, AZ | NCES 0401870 | ADE AZ Report Cards: A as LEA 2024-25 (31/44 schools A) | Per-grade scope-and-sequence pages cusd80.com/departments/curriculum-and-instruction + JH/HS catalogs (22-credit diploma; lab science = 3 of Biology/Chemistry/Physics/Earth Science/Integrated; Gr 8 Civics) |
| Arlington PS #24, NE | CCD locator | NEP: AQuESTT Excellent; Individual Score Growth 55% | Arlington HS Curriculum Guide (apseagles.org): JH/SH course indexes, subject sections; elementary not published (registered) |
| Triad CUSD #2, IL | NCES 1737350 | ISBE Report Card: all 4 schools Exemplary 2025; HS top 2% statewide | Grade-Level Information pages (K-8 + HS courses) tcusd2.org; standards-anchored, no single PDF (structural) |
| Eanes ISD, TX | CCD locator | TEA 2025: scaled 94 = A; Academic Growth 82 | WHS course catalog: Bio Gr 9 → IPC/Chem Gr 10 → Chem/Physics Gr 11-12; Algebra I reachable Gr 8; 4-yr math ladder to AP Calc BC |
| Irvine USD, CA | CCD locator | CA Dashboard: Math Blue +49 DFS Maintained | School catalogs: integrated NGSS Gr 7-8; Math I/II/III + Enhanced; Chemistry in the Earth System → Physics in the Universe |

Confidence: ratings [Moderate 2/3] to [High 2/3] per Lane 5; sequence
sources [Moderate 1/2] each (official district documents). Full URLs
and tags: `evidence/lane5-cohort2-essa.md` and
`evidence/lane10-district-pacing-pass.md`.

## 3. Scope ruling for the reverse gaps

- The rebuilt plan keeps **five pillars** (below). The pack's six
  categories remain the *delivery structure*; NGSS/CCSS/C3 remain the
  *base layer* every pillar cell still cites.
- Calibration baseline = Cohort 2 (the six verified districts) only.
  Cohort 1 (NYC, LAUSD, CPS, Miami-Dade, Houston) is demoted from
  "calibration baseline" to context, matching the plan's cut of
  unrated urban districts. Generic Social Studies and broad GK-trivia
  stay out of the five pillars; their matrix rows remain as base-layer
  content, not as pillar anchors. [Owner's required direction,
  2026-11-26]

## 4. The five pillars x tiers x national competition benchmarks

Tier key: T1 = Gr 2-5 (7-10) · T2 = Gr 6-8 (11-14) · T3 = Gr 9-12
(14-18) · T4 = 18+ (application layer, no competitions are
grade-bound to it).

### Pillar 1 - STEM (Math & Science), Olympiad / Young Scientist depth

| Tier | Base layer (standards + district sequences) | Competition benchmark (ceiling) |
|---|---|---|
| T1 | CCSS Gr 2-5 math ramp; NGSS 3-5; St. Johns/Chandler elementary scope-and-sequence | Science Olympiad Division A (through Gr 6); AMC 8 as extension only |
| T2 | CCSS 6-8 + integrated science (all six districts); Cohort 2 MS sequences | **AMC 8** (Gr ≤8), **MATHCOUNTS** (Gr 6-8, 4 rounds), **Science Olympiad Div B** (Gr 6-9, 23 events), **3M Young Scientist Challenge** (Gr 5-8), **Thermo Fisher JIC** (Gr 6-8) |
| T3 | HS course sequences above (Bio→Chem→Physics etc.); AP ceiling stays | **AMC 10/12** (Gr ≤10/≤12), **Science Olympiad Div C** (Gr 9-12), **USAPhO/F=ma**, **USNCO**, **USABO** (all Gr 9-12), **Regeneron ISEF** (Gr 9-12 research) |
| T4 | ACT/AP bridges (Lane 1 §5) | none (grade-bound); application layer only |

### Pillar 2 - Environmental Studies

| Tier | Base layer | Competition benchmark |
|---|---|---|
| T1 | NGSS ESS K-5 observable; Lane 6 LS2 ecosystems | SciOly Div A environment events |
| T2 | NGSS MS-ESS2/ESS3; integrated science; Lane 6 | SciOly Div B (ecology events) |
| T3 | HS ESS + district sequences (Eanes AP Env Sci, Irvine Earth-system framing) | **NCF-Envirothon** (Gr 9-12; 5 field stations: aquatic ecology, forestry, soils/land use, wildlife, current issue + oral presentation), **National Ocean Sciences Bowl** (HS teams; 8 disciplines incl. marine policy) |
| T4 | ESS3 application prompts | none |

### Pillar 3 - Traffic & Road Rules

| Tier | Content | Official source |
|---|---|---|
| T1 | Pedestrian safety: walking near traffic, crossing streets/intersections, parking lots; under-10 no solo crossing | NHTSA Child Pedestrian Safety Curriculum K-5 (nhtsa.gov) |
| T2 | Bike safety: helmet, rules of the road, riding with traffic, signals; sign recognition | NHTSA/FHWA Bicycle Safer Journey ages 10-14; MUTCD 11th Ed. Part 2 signs |
| T3 | Driving law, right-of-way, signage meaning, hazard anticipation, GDL | State DMV driver handbooks (FL/AZ/NE/IL/TX/CA) + NHTSA Teen Driving/GDL + MUTCD (mutcd.fhwa.dot.gov) |
| T4 | Adult driving decisions (braking distance KE ∝ v², following distance) | NHTSA teen/adult driving pages; pack T4 prompts |

### Pillar 4 - Situational Awareness

| Tier | Content | Source / status |
|---|---|---|
| T1 | Hazard recognition in own environment (crossings, parking lots, weather) | NHTSA K-5 lessons + pack severe-weather prompt [sourced] |
| T2 | Scanning routines, risk spotting in groups | NHTSA preteen/teen tips [sourced]; protocol framing [Inferred] |
| T3 | Hazard anticipation while walking/biking/driving | NHTSA teen driving + DMV handbooks [sourced] |
| T4 | Emergency decision-making (evacuation, triage, risk spotting) | Protocol layer scan→assess→decide→act [Inferred; no federal K-12 curriculum exists - Lane 9 §9.2] |

### Pillar 5 - Educational Riddles (competition-grade logic, lateral thinking, STEM-backed deduction)

| Tier | Benchmark | Source |
|---|---|---|
| T1 | Pattern/sequence riddles at Gr 2-5 level | CCSS Gr 2-5 base; AMC 8 sample problems as extension |
| T2 | Multi-step logic + lateral thinking; timed mental math | MATHCOUNTS Sprint/Target/Team/Countdown (Gr 6-8); AMC 8 |
| T3 | Olympiad logic + deduction events + team challenges | AMC 10/12; Science Olympiad Div C deduction events (Crime Busters, Disease Detectives, 23-event list); NOSB team challenge questions |
| T4 | Applied deduction in adult decisions | Protocol [Inferred] |

## 5. Depth re-calibration rule (adopted)

Every pillar cell now carries two anchors: a **base anchor** (standard
+ district sequence, as before) and a **ceiling anchor** (the
competition benchmark in §4). The difficulty dial (§A.3 of
CURRICULUM-DESIGN) keeps quantification as the axis; the ceiling
anchor decides how far up that axis a cell may climb at each tier.
`math-definition-spec.md` §3.5's ruling is amended accordingly: competitions
are not the syllabus, but they are the official difficulty ceiling
(Lane 7 §7.3). [Inferred; owner's required direction 2026-11-26]

## 6. What is deliberately not in this revision

- No content records, no `src/subjects` changes, no H01-H03 promotion
  yet (that is the next authoring wave, now unblocked by Lane 9's
  sources).
- Lane 6 pass 2 (LS3/LS4 at T2/T3) remains open from 2026-11-25; the
  USABO ceiling in §4 gives Living World its T3 benchmark when that
  pass lands.
- Confidence standard: revised standard of 2026-11-25 §2 applies to
  all lanes 7-10.

Sources: `evidence/lane7-competitions-olympiads.md`,
`evidence/lane8-young-scientist-environmental.md`,
`evidence/lane9-safety-situational-logic.md`,
`evidence/lane10-district-pacing-pass.md`, `evidence/lane5-cohort2-essa.md`,
`SOURCES.md` (original 128; lanes 7-10 add the official organizer and
district URLs inline at each claim).
