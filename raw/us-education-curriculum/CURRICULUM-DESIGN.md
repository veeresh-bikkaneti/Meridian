# Meridian — U.S. Curriculum Design for Why Learn

**Date:** 2026-11-24 · **Status:** Design deliverable for owner decision — no code, no build authorisation implied.
**Method:** Phase 1 parallel research — **Subagent Group A / Cohort 1** (national standards · state standards · five brief-named district scope-and-sequences · Meridian's own inventory) plus **Subagent Group B / Cohort 2** (six ESSA-verified high-performance/high-growth districts, added on the owner's 2026-11-24 update; see Deliverable 0) → Phase 2 council of four education experts (Upper Elementary · Middle School · High School AP/Honors · Higher-Ed/Adult), each seat working in clean context from the evidence pack only.
**Evidence pack:** `evidence/lane1-national-standards.md`, `evidence/lane2-state-standards.md`, `evidence/lane3-districts.md`, `evidence/lane4-meridian-inventory.md`, `evidence/council-t1-elementary.md`, `evidence/council-t2-middleschool.md`, `evidence/council-t3-highschool.md`, `evidence/council-t4-adult.md`. Sources: `SOURCES.md`.

## How to read this document

- Every sourced claim carries a direct link in the evidence files and a confidence tag: **[High x/y]** = 3+ agreeing primary sources · **[Moderate x/y]** = 2 agreeing or 1 primary · **[Low x/y]** = 1 secondary or conflicting.
- **[Inferred]** = the council's or this synthesis's original analysis/recommendation. **[Tested]** = a direct read of Meridian's code or live site.
- Anything unverifiable is written as **"Data not available"** and listed again in the register at the end.
- **Product check [Tested]:** the live page at https://meridian.knowledgetest.workers.dev/#why-learn is a JavaScript app; its static HTML carries only the positioning line *"Geography, math and science"* (fetched 2026-11-24). All product substance below comes from code reads of `origin/main` (Lane 4).
- **Band context [Tested]:** Meridian's code today has exactly three bands — `AgeGroup = "7-10" | "10-18" | "18+"` (`src/subjects/registry.ts`) — and the owner's standing ruling is *keep current bands, target within them*. This document designs **four tiers** as briefed, and §A.5 shows how the four tiers collapse onto the three existing band buttons with no re-authoring.

---

## 0. District Sample Justification Table — who the design is calibrated against

The sample is **dual-cohort** (owner's update, 2026-11-24). **Cohort 1 — "Subagent Group A"**: the five major urban districts named in the original brief, researched for curriculum scope-and-sequence (Lane 3). **Cohort 2 — "Subagent Group B"**: six districts selected *strictly* from official state ESSA report-card portals for verified high performance **and** documented growth, two per rating-system family (Lane 5) — so the design is not calibrated only to big-city proficiency, which tracks family income as much as teaching.

### Cohort 1 — major districts (brief-named; curriculum sample, not an ESSA sample)

| District | State | Basis for inclusion | ESSA rating / proficiency / growth |
|---|---|---|---|
| NYC Public Schools | NY | Named in brief; largest U.S. district; official scope documents (Lane 3) | Data not available — not sampled on ESSA metrics |
| Los Angeles USD | CA | Named in brief; official curriculum maps (Lane 3) | Data not available — not sampled on ESSA metrics |
| Chicago Public Schools | IL | Named in brief; strongest official yield — Skyline curriculum + graduation requirements (Lane 3) | Data not available — not sampled on ESSA metrics |
| Miami-Dade County PS | FL | Named in brief; pacing-guide system verified (Lane 3) | Data not available — not sampled on ESSA metrics |
| Houston ISD | TX | Named in brief; TEKS-based (Lane 3) | Data not available — no public scope & sequence; ESSA metrics not sampled |

### Cohort 2 — ESSA-verified performance + growth sample (verbatim from `evidence/lane5-cohort2-essa.md`, Part 1)

| District | State | Rating family | Official portal link | Summative rating / tier | Assessment system | Reporting year | Proficiency — Math | Proficiency — Science | Proficiency — ELA | Growth metric + value |
|---|---|---|---|---|---|---|---|---|---|---|
| St. Johns County School District | FL | A — Letter-grade | https://www.fldoe.org/accountability/accountability-reporting/school-grades/index.stml | **A** (district grade; also named an Academically High-Performing District for 2025–26, which requires an "A" district grade for two consecutive years) [Moderate 2/3] | FAST (Florida Assessment of Student Thinking, B.E.S.T. standards; PM3 spring administration) | 2024–25 | 78.3% Level 3+ [Moderate 1/2 — secondary analysis of FDOE FAST data; see rationale] | Data not available (district-level science % not retrievable in text form from the FDOE portal in this pass) | 75.4% Level 3+ — highest in Florida [Moderate 1/2] | Learning Gains is a scored component of the FL district grade (ELA + Math gains, incl. lowest-25%); district-level Learning Gains % = Data not available in text-accessible portal form. Proficiency-change proxy [Inferred]: ELA 72% (2024) → 75.4% (2025) = **+3.4 pts**; Math 76% (2024) → 78.3% (2025) = **+2.3 pts** (calculation: simple point difference of the two published FDOE-derived rates; n = 67 FL county districts in the comparison set; school years 2023–24 vs 2024–25) [Low 1/2] |
| Chandler Unified School District #80 | AZ | A — Letter-grade | https://azreportcards.azed.gov/schools/detail/5964 (AZ School Report Cards portal — school-level view; district/LEA grade is computed from the same A–F public file) | **A** as an LEA/district in 2024–25; 31 of 44 schools (70.45%) earned A, 95% earned A or B [Moderate 2/3 — district board presentation of the ADE A–F public file + board-meeting report] | AASA (Arizona's Academic Standards Assessment, Gr 3–8 ELA/Math) + ACT (Gr 11) + AzSCI (science) | 2024–25 | 53% proficient (vs 32% statewide) [Moderate 1/2] | Data not available (district AzSCI % not published in the sources retrieved) | 58% proficient (vs 39% statewide) [Moderate 1/2] | A–F K–8 model weights **Growth at 50 of 100 points** (Student Growth Percentiles) — the largest single component; district growth-points value = Data not available. Documented change proxy: district Math proficiency **+2 pts year-over-year** in 2024–25, and A-rated schools rose 26 (2023–24) → 31 (2024–25) [Moderate 1/2] |
| Arlington Public Schools (District #24) | NE | B — Descriptive-tier (AQuESTT) | https://nep.education.ne.gov/ (Nebraska Education Profile, NEP — district snapshot for Arlington PS, 2024–25, as reproduced in the district's board packet) | **Excellent** — Final AQuESTT classification (top of Excellent / Great / Good / Needs Support to Improve) [Moderate 1/2] | NSCAS (Nebraska Student-Centered Assessment System, Gr 3–8) + ACT (Gr 11) | 2024–25 | 73% proficient (NSCAS Gr 3–8; state 58%) [Moderate 1/2] | 90% proficient (NSCAS Science, Gr 5 & 8; state 80%) [Moderate 1/2] | 70% proficient (NSCAS Gr 3–8; state 59%) [Moderate 1/2] | **Individual Score Growth: 55%** of students (NEP AQuESTT snapshot, "Student Achievement & Growth" panel); snapshot also reports Science Proficiency Status 82% and a 97% four-year graduation rate [Moderate 1/2] |
| Triad Community Unit School District #2 | IL | B — Descriptive-tier (ISBE summative designations) | https://www.illinoisreportcard.com/ (ISBE Illinois Report Card; district detail pattern: https://irc.isbe.net/District.aspx?source=trends&source2=iar.details&Districtid=05016064004 is the equivalent portal view for a peer district — Triad's own figures below are as published by the district from its 2024 Report Card) | **School-level designations only — Illinois issues NO district-level summative designation.** In Triad: Triad HS and Marine Elementary = **Exemplary** (HS in top 1.7% of IL high schools; Marine Elem in top 3.2% of IL elementary schools); remaining schools = Commendable [Moderate 1/2] | IAR (Illinois Assessment of Readiness, Gr 3–8) + ISA (Illinois Science Assessment, Gr 5, 8, 11) + SAT (Gr 11) | 2024 Report Card (2023–24 data) | 43.0% met/exceeded (state 28.4%) [Moderate 1/2] | 74.2% proficient/exemplary (ISA Gr 5, 8, 11; state 53.1%) [Moderate 1/2] | 53.2% met/exceeded (state 41.2%) [Moderate 1/2] | **Math growth percentile 55.5 in 2024, up from 51 in 2023** (+4.5 percentile points; calculation: 55.5 − 51 = 4.5; n = elementary/middle tested grades; school years 2022–23 vs 2023–24, ISBE growth-percentile method) [Moderate 1/2]. ELA growth percentile = Data not available |
| Eanes Independent School District | TX | C — Index (scaled-score) | https://rptsvr1.tea.texas.gov/cgi/sas/broker?_service=marykay&_program=perfrept.perfmast.sas&_debug=0&ccyy=2025&lev=D&id=227909&prgopt=reports/acct/summary.sas (TEA 2025 Accountability — district summary for Eanes ISD, 227909; public portal: TXschools.gov via https://tea.texas.gov/school-and-district-leaders/accountability/academic-accountability/performance-reporting/2025-accountability-rating-system) | **94 scaled score — A** (Student Achievement 94/A; Closing the Gaps 94/A) [High 2/3 — TEA district summary + TEA campus summaries in-district agree] | STAAR (State of Texas Assessments of Academic Readiness) | 2025 (2024–25) | 79% at Meets Grade Level or Above, district column, all grades tested [Moderate 1/2 — TEA 2025 School Report Card district column] | 81% at Meets Grade Level or Above, district column [Low 1/2 — parsed from TEA SRC table; verify in portal before design use] | 88% at Meets Grade Level or Above, district column [Moderate 1/2] | **School Progress, Part A — Academic Growth: scaled score 82 (B)**; School Progress overall scaled 83 (B) [High 2/3 — TEA district summary]. TEA's A–F is genuinely an index system: raw component scores are converted to 0–100 scaled scores before the A–F letter is assigned |
| Irvine Unified School District | CA | C — labelled "Index" in the brief; **actual format documented honestly: NO 100-point index and NO single summative grade.** The CA School Dashboard reports each indicator as a colour performance level (Blue > Green > Yellow > Orange > Red) built from Status (Distance From Standard, DFS, in points) × Change (year-over-year DFS movement) | https://www.caschooldashboard.org/reports/30736500000000/2026 (CA School Dashboard — Irvine Unified summary; CDS 30-73650) | Math = **Blue (highest level)**, +49 DFS, Change = Maintained; ELA = **High performance level**, +58.5 DFS, Change = Declined (as summarised in IUSD's official 2025–26 LCAP from the 2024 Dashboard) [Moderate 1/2] | CAASPP — Smarter Balanced Summative (ELA/Math, Gr 3–8 & 11) + CAST (California Science Test, Gr 5, 8 & HS) | Dashboard 2024 (2023–24 data) for DFS/colour; proficiency from 2024–25 SARC district columns | 70% met/exceeded, 2024–25 (69% in 2023–24) [Moderate 1/2 — official SARC district column] | 63.09% met/exceeded, 2024–25 (61.99% in 2023–24) [Moderate 1/2 — official SARC district column] | 74% met/exceeded, 2024–25 (73% in 2023–24) [Moderate 1/2 — official SARC district column] | California publishes **no student-growth percentile**. Its growth analogue is Dashboard **Change** in DFS: Math **Maintained at Blue** (+49 DFS); ELA **Declined** from a High status (+58.5 DFS). Science proficiency change [calculation]: 63.09 − 61.99 = **+1.10 pts**, 2023–24 → 2024–25, SARC district columns, n = Gr 5, 8 & HS tested students [Moderate 1/2] |

**Cohort 2 method notes [from Lane 5]:** selection order was state ESSA portals first (FDOE School Grades · ADE AZ School Report Cards · NDE Nebraska Education Profile · ISBE Illinois Report Card · TEA Accountability/TXschools.gov · CDE California School Dashboard), NCES for identity/enrollment context only. Two honest format findings: **Illinois issues no district-level summative designation** (Triad's row rests on its schools' designations — its high school sits in the state's top 1.7%), and **California has no 100-point index and no single summative grade** — Irvine's row documents the Dashboard's actual colour-level + Distance-From-Standard format rather than forcing the brief's label. Figures that could not be verified on an official portal are "Data not available" in Lane 5 (district-level Science proficiency for St. Johns and Chandler; Triad's ELA growth percentile; Eanes' Science Meets rate is tagged [Low] pending portal re-verification) — none were estimated.

**What Cohort 2 does to the design [Inferred, from Lane 5's closing note]:** it *confirms* Cohort 1's two load-bearing patterns from independent, high-growth districts — middle-school science is integrated, and the high-school science order runs Biology → Chemistry → Physics, with an integrated-bridge variant documented (Eanes' IPC-style course; Irvine's Earth-system framing) that matches the §B matrix's IPC on-ramp and Earth dual-home rulings. One divergence to note: civics appears at **Grade 8** in Chandler's documented sequence (Cohort 1's poles were Miami Grade 7 and the HS semester) — this widens, and does not overturn, the §D.4 P4 ruling to anchor civics inside T2. Standalone personal finance was **not evidenced in any Cohort 2 document** — the separable-unit ruling stands on Cohort 1/state evidence alone.

---

## A. Recommended tier structure [Inferred design, on the cited evidence]

### A.1 The four tiers

| Tier | Name | Ages | Grades | One-line character |
|---|---|---|---|---|
| **T1** | Upper Elementary | 7–10 | 2–5 | Concepts you can see and touch; no formal formulas |
| **T2** | Middle School | 11–14 | 6–8 | Relationships: "what happens to Y when X changes" |
| **T3** | High School | 14–18 | 9–12 | Formal tools: quantified models, formulas, evidence argued |
| **T4** | College & Adult | 18+ | Post-secondary & lifelong | Application-first: the concept inside a real adult decision |

**Boundary rule [Inferred]:** grade, not age, is the operative boundary. Age 14 appears in both T2 (Grade 8) and T3 (Grade 9) in the owner's brief; a learner's tier follows their grade placement, and the difficulty dial (§A.3) follows the tier.

### A.2 Why these boundaries — the evidence

1. **The national frameworks already band this way.** NGSS and the C3 Framework use performance-expectation endpoints at grades 2 / 5 / 8 / 12, and Common Core Math is grade-by-grade through Grade 8 before switching to high-school conceptual categories (Lane 1, §1–§3). The four tiers sit exactly on the 2 / 5 / 8 / 12 joints — no tier cuts through the middle of a framework band except T1, handled in §A.4.
2. **District practice confirms the joints.** All five researched districts run elementary / middle / high as separate curriculum structures with different course forms at each (Lane 3); the three researched states agree on grade-by-grade structure through Grade 8 and course-based structure in high school (Lane 2, §4).
3. **T4 has no standard — by evidence, not by oversight.** No national topic-by-topic standard exists for adults; the documented anchors are floors and bridges only: ACT readiness benchmarks (Math 22 → College Algebra readiness; Reading 22; Science 23; STEM 26) and AP as the T3-ceiling/credit bridge (Lane 1, §5), plus the voluntary AAC&U LEAP/VALUE framework. K-12 state frameworks document nothing for 18+ (Lane 2, §6). T4 is therefore designed as an **application layer**, not a fourth school level (Council T4 seat, §1).

### A.3 The difficulty dial — the council's central calibration finding

Quantification is the STEM difficulty dial, and it has hard national anchors (Lane 1, §7.2):

- **T1 = qualitative/observable.** Forces as pushes and pulls; faster = more energy; matter described by observable properties. NGSS explicitly bars defining unseen particles in grades 3–5 (5-PS1-3 boundary, Lane 1, §2c) [Moderate 1/1].
- **T2 = relational/proportional.** KE ∝ mass·speed² stated as a relationship by end of Grade 8; force–mass–motion dependence used as evidence (MS-PS2-2); formal algebra and functions begin (CCSS Grades 6–8) (Lane 1, §1d, §2e).
- **T3 = formal/quantified.** F_net = ma (HS-PS2-1); the mole as an atomic→macroscopic conversion (HS-PS1-7) — the mole appears **only** at high school, and NGSS bounds it away from rote stoichiometry; anything beyond that bound is labelled **AP extension**, never core (Lane 1, §2e, §4; Council T3 seat, §1–§2).

In Social Studies the dial is the **verb**, not the topic (Lane 1, §7.3, from C3 indicators): T1 *describe / explain* → T2 *assess / analyse consequences* → T3 *evaluate / critique complex causation and secondary arguments* → T4 *decide and act* [Inferred T4 verb].

**Calibration note on g:** the owner's brief used g = 9.8 m/s² as the example of a T3 formalism. The *placement* of quantified gravitation at high school is supported by the HS-PS2 anchors above; the specific numeric value was **not** verified from a primary source inside the evidence pack (Council T3 seat flagged this) — see the "Data not available" register. The design therefore rules "quantified gravitation at T3" and leaves the printed constant to be sourced at authoring time.

### A.4 The Grade 2 straddle — internal split of T1 [Inferred; Council T1 seat, §1.0]

T1 (Grades 2–5) is the one tier that crosses a framework joint: NGSS/C3 bands break at Grade 2 (K–2 vs 3–5). The council rules:

- Tag T1 internally as **T1a (Grade 2)** and **T1b (Grades 3–5)**, one family-facing shelf, internal gating only. A flat 7–10 pool deals Grade 5 content to 7-year-olds: Meridian's current 7–10 band holds 56 items with no grade field [Tested, Lane 4], and at least one inventoried item breaks the national fractions ramp if dealt early — `fractions:compare-unlike` belongs to Grade 5, while fractions-as-numbers begin in Grade 3 (Lane 1, §1d) [Moderate 1/1].
- The fractions ramp is treated as law inside T1: Gr 2 none-as-number → Gr 3 number line / special equivalence → Gr 4 equivalence + like denominators → Gr 5 unlike denominators, first and only there.

### A.5 Collapse to 3 buttons (UI constraint note) [Inferred]

If the picker must stay at three buttons — matching the current code bands and the owner's standing ruling — the four tiers collapse with **zero re-authoring**:

| Button (current band) | Carries | How the tiers survive inside it |
|---|---|---|
| **7–10** | T1 | T1a/T1b stays an internal grade tag (§A.4); invisible to families |
| **10–18** | T2 + T3 | Every item keeps its T2/T3 tag from the council's split rule (§D.4) as an internal difficulty field; the picker deals T2 before T3. A later move to 4 buttons is a display change only |
| **18+** | T4 | Unchanged |

The cost of collapsing is real and should be named: inside one 10–18 button, a Grade 6 learner and a Grade 11 learner share a shelf, so dealing order and the hunch/explanation depth must respect the internal tag — which is exactly the "target within them" work the owner already ruled in.

### A.6 Two structural rulings the tiers depend on

1. **Journals is a process tier, not a seventh subject** [Inferred; all four lanes converge]. No state or national framework names a "Journals" subject (Lane 2, §4). Its anchors are process anchors — CCSS informational reading + note-taking, NGSS Science & Engineering Practices, the C3 inquiry arc (question → evidence → communicated conclusion), AP Seminar/Research at the ceiling (Lane 1, §7.4). Design Journals as a practice layer that rises with the other categories at every tier.
2. **Geography is double-homed today and must be single-ruled** [Inferred; Lane 1, §7.5]. C3 treats geography as human/spatial (D2.Geo); NGSS Earth & Space is the physical Earth system; AP Human Geography is human. Ruling: **physical/spatial basics → General Knowledge; human, population and political geography → Social Studies**, cross-tagged, never silently duplicated.

---

## B. Concise curriculum matrix — standards × Meridian's 6 categories × 4 tiers

Anchors are the national frameworks (Lane 1) cross-checked against TX/NY/CA state structures (Lane 2, §4) and district practice (Lane 3). Depth words follow §A.3. Full citations live in the lane files.

| Category | T1 — Upper Elementary (Gr 2–5) | T2 — Middle School (Gr 6–8) | T3 — High School (Gr 9–12) | T4 — College & Adult (18+) |
|---|---|---|---|---|
| **Math** | CCSS grade-by-grade: place value, four operations, fractions ramp Gr 3→5, measurement, early data/geometry. All three states grade-by-grade (Lane 2, §4) | CCSS: ratios & proportional relationships, rational numbers, expressions/equations, functions begin; TX adds an advanced track reaching Algebra I in Gr 8 | CCSS conceptual categories (Number & Quantity, Algebra, Functions, Geometry, Statistics) sequenced by course: Algebra I → Geometry → Algebra II (or Integrated I/II/III in CA). AP ceiling: Calculus, Statistics | No topic standard — ACT Math 22 floor (College Algebra readiness). Designed as quantitative literacy for money/measurement decisions [Inferred] |
| **Physics** | Inside integrated elementary science everywhere; NGSS PS2/PS3/PS4 at observable level: pushes/pulls, energy transfer, light/sound (Lane 1, §2) | Inside integrated MS science in **every** documented district (NYC SCALE, LAUSD, CPS, Miami — Lane 3); NGSS MS-PS2/PS3 relational: force–mass dependence, KE ∝ m·v² | Splits by state: TX standalone Physics (+ IPC on-ramp); NY Regents Physics; CA integrated *Physics of the Universe*; CPS requires Physics in Gr 11. NGSS HS-PS2/PS3/PS4 quantified: F_net = ma. AP ceiling: Physics 1/2/C | No standard. Application layer: energy bills, home, travel, work [Inferred] |
| **Chemistry** | Observable matter only: states of matter, properties, mixtures, reversible change; **no defined particles** (NGSS 3–5 boundary) | NGSS MS-PS1: particle model arrives, atoms→molecules, characteristic properties, conservation in reactions (qualitative) | TX standalone Chemistry (+ IPC); NY Regents Chemistry; CA *Chemistry in the Earth System*; CPS requires Chemistry in Gr 10. NGSS HS-PS1: structure/properties, mole as conversion (bounded). AP ceiling: AP Chemistry (beyond the NGSS bound = AP extension) | No standard. Application layer: products, food, body, labels and dosage [Inferred] |
| **General Knowledge** (Geography / Earth & Space / Interdisciplinary) | Elementary Earth topics in science + geography strands in social studies everywhere; **Grade 4 is state history in TX, NY and CA** (a different state each time — Lane 2, D4). NGSS ESS at observable level: weather, water, Earth's patterns | Geography lives **inside** history/social studies in all 3 states (TX World Cultures, NY Eastern Hemisphere, CA World History & Geography) — no standalone geography course at T2. NGSS MS-ESS: Earth systems, resources, human impact, relational | Earth & Space placement splits: TX standalone Earth Systems Science course; NY Regents Earth & Space Sciences; Miami leads HS science with Earth/Space Gr 9; CA integrates ESS into all three HS science courses. AP ceiling: Human Geography, Environmental Science | No standard. Application layer: travel, place, planet, systems judgement [Inferred] |
| **Social Studies** (History / Civics / Economics / Human Geography) | Expanding horizons everywhere: self → community → state → nation; C3 verbs *describe/explain*. Gr 5 = U.S. history in CA pattern; state anchors differ (Lane 2, D4) | U.S. history placement differs: TX splits (Gr 5, Gr 8, HS since 1877) + repeats Texas history Gr 7; NY runs a 2-year U.S.+NY sequence Gr 7–8; CA runs World Gr 6–7 then U.S. Gr 8. **Civics: Miami requires a full Grade 7 civics year + EOC** (Lane 3). C3 verbs *assess/analyse* | **The most convergent cell in the map:** all 3 states require U.S. History + a government/civics semester + an economics semester (Lane 2, §4). World history ranges from NY's required 2 years to TX's World Geography *or* World History choice. Personal finance: TX fused ⅔ PFL + ⅓ econ (0.5 credit) · CA standalone semester (class of 2030–31) · NY inside Gr 12 Economics (Lane 2, D3). AP ceiling: US/World History, Gov, Econ, Human Geography | No standard. Application layer: the citizen's operating system — voting, taxes, contracts, local government [Inferred] |
| **Journals** (applied field notes / case studies) | Process anchors only: observation, dating, sorting evidence, "how do I know?" (Council T1, §1.6). No framework names the subject | Process anchors: NGSS SEPs, lab/field investigation requirements (TX Ch. 112; NY 1,200-minute lab rule), C3 inquiry arc Dimensions 1/3/4 (Lane 1, §7.4; Lane 2, §4) | Process tier at full rigour: documented investigations, source evaluation, communicated conclusions; AP Seminar/Research as ceiling | The learner's own life as the field: records, receipts, readings, before/after evidence [Inferred; Council T4, §2] |

**Reading the matrix [Inferred]:** two cells carry design warnings. (1) **T2 science is integrated in practice everywhere** — Meridian may keep Physics/Chemistry as picker categories, but T2 delivery should spiral topics interleaved across Grades 6–8, never "Grade 6 = Earth, Grade 8 = Physical" (Council T2, §1). (2) **Earth & Space cannot sit in one container** (Lane 2, D1): it is a standalone strand at T3 in TX/NY/Miami and a woven thread inside Physics/Chemistry in CA — the design gives it a dual home (GK strand + cross-tags), per Council T3, §1.7.

---

## C. Case-file prompts — "Why Do We Learn This?"

**Complete for all 24 cells** (6 categories × 4 tiers, 4 prompts per cell, 96 prompts). Every prompt is **[Inferred]** — original work by the Phase 2 council seat for that tier, written in Meridian's case-file style (hook question + the real-world situation + the concept it teaches), calibrated to the tier's dial in §A.3, and checked against Lane 4's inventory so cells extend Meridian's stock instead of repeating it (reuses are flagged by the seats). The four tier sections below are reproduced verbatim from the council memos in `evidence/`.

### C.1 — T1 Upper Elementary (from `evidence/council-t1-elementary.md` §4)

#### Math (extends Lane 4 T1 maths beyond number/measurement into data, geometry and money — domains present in Lane 1 §1a but absent from the inventory)

1. **[Inferred] "Why do we draw picture graphs instead of just saying the numbers?"** — Situation: the class votes on a pet for the class corner and needs everyone to see the winner at a glance. Concept: data representation — one picture stands for a count; reading and comparing a pictograph/bar graph. *(New: no data/graph item exists in Lane 4 T1 maths.)*
2. **[Inferred] "Why do some shapes tile a floor with no gaps and some leave holes?"** — Situation: choosing tiles for a bathroom floor / paving stones for a path. Concept: properties of 2-D shapes — angles and sides decide whether shapes fit together (geometry, qualitative). *(New: inventory geometry at T1 is perimeter/area only.)*
3. **[Inferred] "Why does the shopkeeper give us coins back?"** — Situation: paying for a snack with a larger coin/bill and checking the change. Concept: money values and subtraction as "how much more to reach the price" — counting up to make change. *(New: no money item in Lane 4 T1 maths.)*
4. **[Inferred] "Why does the calendar repeat its pattern every week?"** — Situation: working out what day a birthday, match or trip falls on, weeks from today. Concept: repeating patterns and multiples of 7 — pattern reasoning as early algebraic thinking, no symbols. *(Extends, does not repeat, `skip-count`: the inventoried item counts objects; this one reasons with a cycle.)*

#### Physics (all qualitative, per §1.2 ceiling)

1. **[Inferred] "Why does a drum wobble when you hit it?"** — Situation: a hand drum / stretched rubber band over a bowl in music class, rice grains dancing on the skin. Concept: sound is made by vibration — things that shake make sound, faster shaking = higher sound (qualitative only). *(New: no sound item in Lane 4 T1 physics; sound arrives only at 10–18 as `sound:medium`.)*
2. **[Inferred] "Why does a torch light up the whole tent, not just one spot?"** — Situation: camping / a power cut at home, one lamp lighting a room. Concept: light travels out in all directions and can be blocked or bounced — applied shadow/mirror reasoning in a new setting. *(Applies inventoried `shadow:blocks` / `mirror:sends-back` concepts; the situation and case are new — flagged as a deliberate application, not a new concept.)*
3. **[Inferred] "Why does the lamp only light when the loop is complete?"** — Situation: building a simple torch circuit with a battery, wire and bulb; it dies when one clip comes off. Concept: energy moved by electric current needs a complete path (4-PS3 family, Lane 1 §2c [Moderate 1/1]) — observed, never calculated. *(New: no circuits item anywhere in Lane 4 physics.)*
4. **[Inferred] T1a-safe — "Why does a swing keep going after one push — and slowly stop?"** — Situation: playground swing, one big push, counting how the swings get smaller. Concept: a push starts motion; motion winds down as the swing rubs the air and chains — first, felt encounter with "things slow down unless pushed," no friction vocabulary required at T1a, naming it at T1b. *(Neighbours inventoried `friction:measure-slide`; this case is about noticing the slow-down in free play, not measuring slide distance — flagged.)*

#### Chemistry (all inside the §1.3 boundary — observable only, no particles defined)

1. **[Inferred] "Why does a puddle disappear on a sunny day?"** — Situation: the morning puddle on the playground is gone by lunch, but the one in the shade is still there. Concept: evaporation as an observable change — liquid water leaves into the air faster when warm; described, not explained by particles. *(New: Lane 4 T1 chemistry has melt/freeze but no evaporation case.)*
2. **[Inferred] "Why does it fizz when we mix the powder and the lemon juice?"** — Situation: baking-soda-and-lemon/vinegar volcano or bath-bomb in a cup. Concept: mixing two familiar things can make something new happen — fizz, bubbles, colour/temperature change are the clues children observe and describe (Grade 5 investigation level, §1.3). *(New: no mixing-reaction observation case at Lane 4 T1; `reactions:new-look` sits at 10–18.)*
3. **[Inferred] "Why can we smell popcorn in the next room?"** — Situation: a smell spreading down a hallway with no fan and no one carrying it. Concept: smells travel through air on their own — a phenomenon to wonder at and track ("where is it strongest?"), explicitly *not* a particle lesson at T1. *(New topic; wording guards the NGSS no-defined-particles boundary, Lane 1 §2c [Moderate 1/1].)*
4. **[Inferred] T1a-safe — "Why does muddy water get clearer through a cloth?"** — Situation: filtering pond/stream water through cloth and sand on a nature walk, then comparing before/after jars. Concept: mixtures can be separated because pieces are different sizes — sieving/filtering as a hands-on mixture skill. *(New: Lane 4 T1 has sorting dry materials and magnet separation, but no filtering/separating a liquid mixture.)*

#### General Knowledge — Geography / Earth & Space (rebuilds the cell per §1.4; no landmark arithmetic)

1. **[Inferred] "Why does the Moon look like a different shape each week?"** — Situation: keeping a month of Moon drawings in a Journal and noticing the pattern repeat. Concept: the Moon's lit part changes in a regular cycle we can predict from watching (ESS1 patterns, observed only). *(New: no astronomy-pattern case in Lane 4 T1 GK.)*
2. **[Inferred] "Why are summer evenings light for so much longer?"** — Situation: playing outside after dinner in June vs going home in the dark in December. Concept: day length changes with the seasons in a yearly pattern — Earth-and-Sun pattern reasoning from lived experience, no tilt diagram required at T1a, simple model globe at T1b. *(New.)*
3. **[Inferred] "Why do farmers and sailors check the clouds every morning?"** — Situation: a class weather watch — today's clouds and wind vs tomorrow's actual weather, scored over two weeks. Concept: weather can be described, measured simply (rain gauge, thermometer in words of hotter/colder) and partly predicted from patterns; severe-weather preparation. *(New: no weather case in Lane 4 T1 GK.)*
4. **[Inferred] "Why does the stream behind the school always flow the same way — and where does it go?"** — Situation: following water on a local walk / map from a hill, through town, to a river or sea. Concept: water flows downhill and connects places — the water cycle as a journey story, and why towns and farms sit along the way. *(New; bridges to Social Studies' inventoried one-liner "Why towns grew beside rivers" without repeating any inventoried GK item.)*

#### Social Studies (fills the missing history / civics / economics per §1.5; verbs at describe/explain)

1. **[Inferred] T1a-safe — "Why does our class need rules — and who gets to change them?"** — Situation: the class writes its own rules in September, then votes to change one that isn't working. Concept: civics — rules exist to keep everyone safe and fair, and people can change rules through an agreed process (D2.Civ.12.3-5 in lived form, Lane 1 §3a [Low 1/1]). *(New: no civics case exists in Lane 4 T1 Social Studies.)*
2. **[Inferred] "Why can't the school fair sell everything for one coin?"** — Situation: planning a class bake sale / lemonade stand — ingredients cost money, helpers' time matters, buyers choose. Concept: economics — scarcity and choice; a price is a decision, not a label (grounded in D2.Eco.1.K-2 scarcity-as-decision-making, Lane 1 §3a [Low 1/1]). *(New: no economics case in Lane 4 T1.)*
3. **[Inferred] "Why do we keep old photographs of our town?"** — Situation: comparing a 100-year-old photo of the main street with the same corner today — what changed, what is still there? Concept: history — sources (photos, objects, elders' stories) tell us about the past; change and continuity side by side. *(New: no history case in Lane 4 T1.)*
4. **[Inferred] "Why do people in a snowy town build different houses from people in a hot, rainy town?"** — Situation: picture tour of homes around the world matched to their weather and land. Concept: human–environment interaction — culture and building adapt to place (D2.Geo.4.3-5 family, Lane 1 §3a [Low 1/1]). *(New: Lane 4 T1 geography is compass/area/steps only.)*

#### Journals (process cases per §1.6 — the child makes the field note, not just reads one)

1. **[Inferred] T1a-safe — "Why do explorers draw what they see instead of just remembering it?"** — Situation: draw a beetle/leaf/shell from life for five minutes, then compare drawings with the real thing tomorrow. Concept: observation — a drawing/note made on the spot holds detail memory loses; the core Journals skill. *(New: Lane 4 T1 Journals are all read-a-story cases; none asks the child to record.)*
2. **[Inferred] "Why do we write the date and place on every field note?"** — Situation: a mystery photo game — half the class's nature photos have no date/place and nobody can tell where or when they were taken. Concept: evidence — a note without when/where can't be checked or sorted (W.3.8-type note-taking/sorting, Lane 1 §1b [Moderate 1/1]). *(New.)*
3. **[Inferred] "Why does a weather diary only get interesting after a whole month?"** — Situation: recording weather, Moon or a growing bean every school day and hunting for the pattern at month's end. Concept: patterns appear over time — one day is an event, thirty days is evidence. *(New; deliberately pairs with the GK Moon/weather cases as the Journals process layer over the same phenomena.)*
4. **[Inferred] "Why do we ask 'How do you know that?' — kindly?"** — Situation: interviewing a grandparent, farmer or shopkeeper about how their job/town used to be, and writing down their exact words. Concept: sources — a person's memory is evidence with a name on it; checking one story against a photo or a second person. *(New: no interviewing/source case in Lane 4 T1 Journals.)*

---


### C.2 — T2 Middle School (from `evidence/council-t2-middleschool.md` §5)

Format per prompt: **Hook question** — real-world situation — *concept taught*. Reuse flagged against Lane 4 §b inventory; otherwise Extension.

### Math (4)
1. **"Why does the cheaper-looking phone plan end up costing more?"** — Comparing two phone/data plans with a base fee plus per-GB charge over a school semester. — *Proportional relationships and linear models: unit rate, $y = mx + b$ as a relationship.* [Extension — extends inventoried `math-applied:rates:linear-model` to a two-plan comparison]
2. **"Why do goalkeepers and game designers both care about a fair coin that isn't fair?"** — Testing whether a loot-box / free-throw / board-game spinner outcome matches its claimed chances over many trials. — *Probability and statistical inference: relative frequency approaches theoretical probability.* [Extension — no probability item in Lane 4 Math 10–18 list]
3. **"Why can your account go below zero — and what does 'below' even mean?"** — A lunch-card / savings balance, temperature drop, and elevation below sea level in one week of a 12-year-old's life. — *The Number System: negative rational numbers on a number line, operations with integers.* [Extension — no negative-number item in Lane 4 Math 10–18 list]
4. **"Why does the shortcut across the park actually save distance?"** — Measuring the diagonal path across a rectangular field vs walking two sides, checked with string and a map. — *Pythagorean theorem as a distance tool (Gr 8).* [Reuses inventoried topic: `math-applied:geometry:pythagoras` / `distance-points`]

### Physics (4)
1. **"Why does doubling your bike speed quadruple how hard it is to stop?"** — Braking distance and crash energy on a bike/scooter at 10 vs 20 km/h in the school zone. — *Kinetic energy ∝ mass × speed² (MS-PS3-1) as a relationship, not a calculation drill.* [Extension — deepens inventoried `physics:ramp:faster-hits-harder` (7–10) to T2 relational depth]
2. **"Why is the same push enough for an empty cart but not a full one?"** — Pushing loaded vs unloaded carts / sleds and measuring how motion changes. — *MS-PS2-2: motion change depends on sum of forces and mass — evidence for dependence.* [Reuses inventoried topic: `physics:push:mass`]
3. **"Why does a blanket 'make' you warm if it makes no heat?"** — Comparing temperature loss of warm water in insulated vs uninsulated bottles over a class period. — *Energy transfer, temperature as average kinetic energy of particles, systems and insulation.* [Extension — extends inventoried `physics:energy:transfer`]
4. **"Why can you hear the game through the wall but not see it?"** — Sound travelling through air, wood, and water vs light blocked by the same wall at a sleepover / swim meet. — *Waves: sound needs a medium, wave properties differ by type (MS-PS4).* [Reuses inventoried topic: `physics:sound:medium`]

### Chemistry (4)
1. **"Why does salt melt ice on the road but also rust the car?"** — Winter road treatment in a cold-climate town, followed through spring. — *Mixtures, dissolving, and properties change in context; trade-offs of a chemical solution.* [Reuses inventoried topic: `chemistry:states:road-salt` + `chemistry:reactions:rust`]
2. **"Why does the sealed bag weigh the same after the fizzy reaction pops?"** — Baking soda + vinegar reacting inside a sealed bag on a kitchen scale. — *Conservation of mass in a chemical reaction, argued from particle rearrangement (MS-PS1).* [Reuses inventoried topic: `chemistry:reactions:weight`]
3. **"Why can you un-mix trail mix but not un-bake a cake?"** — Separating a snack mix by hand vs trying to reverse baking, melting, and rusting. — *Physical vs chemical change; characteristic properties identify substances.* [Extension — extends inventoried `chemistry:reactions:new-look` / `chemistry:materials:identify`]
4. **"Why does perfume reach the back of the room if nobody blew it there?"** — A scent, food colouring in water, and steam from a hot drink spreading without a fan. — *Particle model of matter: atoms/molecules in motion explain diffusion and states.* [Reuses inventoried topic: `chemistry:states:particles`]

### General Knowledge — Geography / Earth & Space (4)
1. **"Why do earthquakes shake one side of your state and not the other?"** — Mapping recent quakes and volcanoes against plate boundaries to judge risk for a school trip. — *Plate tectonics and large-scale system interactions (MS-ESS2).* [Extension — no tectonics item in Lane 4 GK inventory]
2. **"Why does it rain on your hike but stay dry 20 km away?"** — A weekend storm, a rain shadow behind a mountain range, and a local forecast that got one town right and one wrong. — *Weather systems, water in Earth's surface processes, air-mass interaction (MS-ESS2).* [Extension — extends inventoried `chemistry:water:cycle` into Earth systems]
3. **"Why do we get seasons — and why is it summer in Sydney at Christmas?"** — Comparing daylight, Sun angle, and temperature in the learner's town vs Paris/Sydney across the year. — *Earth–Sun system, axial tilt, orbit patterns (MS-ESS1).* [Extension — extends inventoried `general-knowledge:mixed:paris-sydney-flight` from flight trivia to system explanation]
4. **"Why does the cliff show stripes — and what story do the stripes tell?"** — Reading layered rock and fossils on a canyon / road-cut visit to order events in Earth's past. — *Geological time scale from rock strata (end-of-Gr 8 endpoint).* [Extension — no strata item in Lane 4 GK inventory]

### Social Studies (4)
1. **"Why does your town have laws nobody voted for directly — and how could kids change one?"** — A local rule (skate park hours, library fines) traced from proposal to enforcement, with a petition that worked. — *Civics C3 6–8: assess rules/laws as means of addressing public problems (D2.Civ.12.6-8); institutions, participation.* [Extension — no civics item in Lane 4 Social Studies inventory, which is geography-math only]
2. **"Why did the price of the sold-out sneakers double overnight?"** — A limited drop, resale listings, and a store that chose not to raise prices. — *Economics: supply, demand, incentives, and consequences for different groups.* [Extension — no economics item in Lane 4 Social Studies inventory]
3. **"Why did cities grow where two rivers meet — and why do some shrink now?"** — Comparing a river-junction city, a port, and the learner's own town on maps across 200 years. — *Human geography: population patterns, human–environment interaction, density in context.* [Reuses inventoried topic: `social-studies:region:density` + `route:scale-ratio`, extended to historical causation]
4. **"Why did traders risk a desert crossing for salt and gold?"** — Following a medieval trade route (Andean roads / trans-Saharan / Silk Road choice) and what each side gained. — *History Gr 6–7: exchange networks, change and continuity, multiple perspectives on the same event.* [Extension — extends inventoried Journals `people-places:andean-roads` into Social Studies history]

### Journals — Applied Field Notes (4)
1. **"Why should you trust this viral 'science' post — or not?"** — A viral health/space claim shared in a group chat, checked against two sources and the original data. — *RI.7.8 trace/evaluate argument and claims; C3 Dimension 3 evaluating sources and using evidence.* [Extension — no source-evaluation item in Lane 4 Journals inventory]
2. **"Why did our bridge hold 2 kg yesterday and fail today?"** — A classroom spaghetti/card bridge design challenge, tested, redesigned, and retested with a field log. — *ETS1 engineering design (MS-ETS1): define problem, develop solutions, optimise; SEP data practices.* [Extension — no ETS1 item in Lane 4 Journals inventory]
3. **"Why is the creek behind school cloudy after rain — and who needs to know?"** — Learners sample/observe local water, log weather, photograph change, and write a note a city worker could act on. — *Field investigation: question → evidence → communicated conclusion (C3 Dimensions 1/3/4); Earth-systems observation.* [Extension — new field-note topic beyond Lane 4 Journals list]
4. **"Why did Eratosthenes measure the whole Earth with a stick and a shadow?"** — Replicating the shadow measurement with a partner class / simulated second location and comparing results. — *Applied measurement, evidence from indirect observation, historical science as field notes.* [Reuses inventoried topic: `people-places:eratosthenes-earth`]

---


### C.3 — T3 High School (from `evidence/council-t3-highschool.md` §5)

Format per Meridian's picker: hook question ("Why Do We Learn This?" case file) + real-world situation line + concept taught. **Reuse flag:** ● = extends an inventoried Lane 4 topic · ○ = new topic beyond inventory. All 24 prompts are **[Inferred]** design proposals, calibrated per §1.

### 5.1 Math (Functions / Modeling / Trig / Statistics)
1. ○ **"Why does your car loan cost way more than the sticker price?"** — A first-car loan at a stated APR over 48 months. *Concept: exponential/compound growth vs linear intuition; total cost of credit.*
2. ● **"Why does the ride-share price surge exactly when everyone wants one?"** (extends `rates:linear-model`) — Surge pricing on a rainy Friday night. *Concept: piecewise/linear models, slope as marginal price, interpreting parameters.*
3. ● **"Can you prove the shortcut across the lot really is shorter — and by how much?"** (extends `geometry:pythagoras` / `distance-points`) — Cutting the diagonal vs walking the edges, measured on a phone map. *Concept: Pythagorean theorem + coordinate distance as a verifiable claim.*
4. ○ **"Why does one viral post explode and another die?"** — Follower growth in the first 24 hours of two posts. *Concept: exponential vs linear vs logistic-shaped growth; fitting a model to real data (Statistics & Probability / Modeling).*

### 5.2 Physics (quantified: Fnet = ma, energy, waves)
1. ● **"Why does doubling your speed quadruple your braking distance?"** (rebuilds `ramp:higher-stored` / `energy:transfer` as calculated) — A new driver at 30 vs 60 mph. *Concept: KE ∝ v² (MS-PS3-1 → HS quantification); energy conservation in stopping.*
2. ● **"How much force does your seatbelt actually have to survive?"** (rebuilds `push:mass` / `push:table`) — A crash-test dummy decelerating from highway speed. *Concept: Fnet = ma (HS-PS2-1), one-dimensional; impulse intuition without the calculus.*
3. ○ **"Why does your phone lose signal in the elevator but the radio doesn't?"** — Wavelength vs the metal box you're standing in. *Concept: HS-PS4 waves — frequency/wavelength, EM radiation interacting with materials.*
4. ○ **"Why don't satellites fall down if gravity never switches off?"** — The phone in your hand getting GPS from orbit. *Concept: mathematical gravitation (HS-PS2-4) — inverse-square fall-off, perpetual free-fall as orbit.*

### 5.3 Chemistry (substructure, mole-bounded, reactions)
1. ● **"Why is the rusty gate heavier than the gate was?"** (rebuilds `reactions:rust` / `reactions:weight` at HS depth) — Weighing a rusted bike lock vs a new one. *Concept: conservation of atoms/mass (HS-PS1-7) with mole-as-conversion — the extra mass is oxygen, counted, not magic.*
2. ○ **"Why does the periodic table have that weird shape?"** — Finding your phone's elements (lithium, silicon, cobalt) on the table. *Concept: HS-PS1-1 — proton number orders the table; substructure explains the pattern.*
3. ● **"Why does road salt melt ice here but fail in a deep freeze?"** (extends `states:road-salt`) — A Midwestern January vs a mild coastal winter. *Concept: particles, freezing-point behaviour, and the limits of a model — when the explanation stops working.*
4. ○ **"How many atoms are in the aluminium can you're holding?"** — One drinks can, one balance, one mole conversion. *Concept: the mole as atomic→macroscopic conversion (HS-PS1-7, bounded — no rote stoichiometry drill).*

### 5.4 General Knowledge — Earth & Space / Geography / Interdisciplinary
1. ○ **"How do scientists know a rock is 4 billion years old if nobody was there?"** — Dating a canyon layer / a meteorite fragment. *Concept: ESS1.C HS endpoint — radioactive decay + isotopic content as a clock (Lane 1, §2c).*
2. ○ **"Why does your city flood in rain that your grandparents' city shrugged off?"** — A local flash-flood news clip from the student's own region. *Concept: HS-ESS2/ESS3 — water in Earth's systems + human impacts (pavement, drainage) as one system.*
3. ● **"Why is the shortest flight path on the map the curved one?"** (extends `mixed:paris-sydney-flight`; note `mixed:great-circle` already exists at 18+ — **reuse/downshift candidate, flag for T4 seat**) — Watching a flight tracker bend over the pole. *Concept: spherical Earth geometry + ESS1.B patterns; flat maps distort.*
4. ○ **"Why is your phone's weather app always a little bit wrong about your street?"** — Forecast says dry; your block gets soaked. *Concept: HS-ESS2.D weather/climate modelling — resolution, data, and why models have error bars.*

### 5.5 Social Studies — History / Civics / Economics / Human Geography
1. ○ **"Why did your first paycheck come out smaller than your hourly wage says it should?"** — A part-time job's first pay stub. *Concept: Economics + personal finance (separable unit, §1.5) — gross vs net, withholding, what the deductions fund (civics link).*
2. ○ **"Why does a minimum-wage rise help one worker and cost another their hours?"** — Two friends, same town, opposite outcomes after a wage change. *Concept: D2.Eco.1.9-12 — incentives and costs/benefits that differ by group; marginal thinking (full D2.Eco.2.9-12 text: Data not available).*
3. ○ **"Who actually decides whether your school day starts earlier?"** — A school-board vote on start times / a city curfew debate. *Concept: Civics 9–12 — institutions, levels of government, participation: where the decision legally lives and how a citizen acts on it (C3 Dimensions 1/4).*
4. ● **"Why are two neighbourhoods in the same city living in different centuries?"** (extends `region:density` to D2.Geo.2/11 level) — Satellite images + population density of the student's own metro area. *Concept: Human Geography 9–12 — spatial patterns, economic dynamics, resource access; evaluate, don't just describe.*

### 5.6 Journals — applied field notes (process tier)
1. ● **"Can you prove your school's Wi-Fi dead zones are where everyone says they are?"** (extends `technology:mobile-phone`) — A week of signal logging on the student's own phone, mapped by hand. *Concept: ETS1-style problem definition + SEP data collection; claim defended with own evidence (§1.6).*
2. ○ **"What does your street sound like at 7am vs 7pm — in numbers?"** — Phone decibel logging across a school week. *Concept: field measurement, sampling choices, and honest error — RI 9–10 technical-text reading + evidence sorting.*
3. ● **"Can you re-measure the Earth with a stick, like Eratosthenes did?"** (extends `people-places:eratosthenes-earth`) — Partner-school shadow measurements on the same day, compared live. *Concept: replication as a journal method — historical case re-performed, not just retold; geometry in service of evidence.*
4. ○ **"Write the field note that would convince a sceptic your local creek is changing."** — Three visits, photos, simple counts, one defended claim. *Concept: AP Seminar posture — question, source evaluation, communicated conclusion (C3 Dimensions 1/3/4); the T3 Journals ceiling in miniature.*

---


### C.4 — T4 College & Adult (from `evidence/council-t4-adult.md` §5)

**Format:** Hook question (Meridian style: "Why Do We Learn This?" case files — Lane 4 §(c) [Tested]) + real-world situation + concept taught. **All 24 prompts are [Inferred]** — new design proposals, not sourced standards. **Reuse key:** `REUSE` = extends a named inventoried 18+ item (Lane 4 §(b) [Tested]); `BRIDGE` = builds on an inventoried 10–18 item named in Lane 4 §(b) [Tested]; `NEW` = no inventoried antecedent.

### Math (money, work, measurement)

1. **"Why Do We Learn Percentages?"** — Situation: two job offers, one with a higher salary in a higher-tax, higher-rent city. — Concept: percent-of-what discipline; comparing net, not gross. `NEW` [Inferred]
2. **"Why Do We Learn Interest?"** — Situation: a credit card balance at a stated APR vs a savings account at a stated APY, same principal, one year. — Concept: compound growth in both directions; total cost vs monthly payment. `NEW` [Inferred] *(Tool half of the Math/Social Studies money cluster, §3.)*
3. **"Why Do We Learn to Split Shares?"** — Situation: three flatmates splitting rent, a deposit, and a shared car repair in unequal proportions they must defend to each other. — Concept: combining and comparing fractional/proportional shares. `REUSE` — extends `math-number:fractions:combine-shares` (18+) [Inferred]
4. **"Why Do We Learn to Check a Measurement?"** — Situation: a contractor's quote for flooring is priced by area; the learner measures the room and finds the quote's area is a third too large. — Concept: area, unit consistency, and estimation as fraud protection. `REUSE` — extends `math-applied:measure:survey-check` (18+); estimation stance also extends `math-number:tables:mental-strategies` (18+) [Inferred]

### Physics (home, travel, work)

5. **"Why Do We Learn About Energy?"** — Situation: a winter electricity bill doubles; the learner must find which appliance, run for how long, explains it. — Concept: energy = power × time; the kWh as a purchased unit; accounting for a "missing" quantity. `REUSE` — extends `physics:energy:missing` (18+) [Inferred]
6. **"Why Do We Learn About Speed and Stopping?"** — Situation: choosing a safe following distance and understanding why a small speed increase sharply lengthens braking distance. — Concept: kinetic energy scaling with the square of speed (T2 endpoint, MS-PS3 — Lane 1 §2e [Moderate 1/1]) applied to a driving decision; time–distance reasoning. `REUSE` — extends `physics:arrive:adult-time` (18+) [Inferred]
7. **"Why Do We Learn About Slope?"** — Situation: building a wheelchair-accessible ramp (or a moving ramp for furniture) that is legal, buildable, and not dangerously steep. — Concept: ratio as rise-over-run; slope as a standard you can measure and check. `REUSE` — extends `physics:ramp:adult-ratio` (18+) [Inferred]
8. **"Why Do We Learn About Levers?"** — Situation: moving a heavy appliance alone with a dolly, a plank, and a fulcrum — or choosing where to stand with a breaker bar on a seized bolt. — Concept: mechanical advantage; trading distance for force. `BRIDGE` — builds on `physics:lever:seesaw` (7–10) re-entered at adult load [Inferred]

### Chemistry (health, home, food)

9. **"Why Do We Learn About Concentration?"** — Situation: diluting a cleaning concentrate from its label ratio, and recognising why "double-strength" is a hazard, not a bargain. — Concept: concentration as amount per volume; dilution ratios. `NEW` [Inferred] *(Label literacy only — §4, cut 7.)*
10. **"Why Do We Learn About Reaction Rates?"** — Situation: food spoiling faster in a warm kitchen, and why refrigeration, sealing, and acidity each slow a different clock. — Concept: rate dependence on temperature, surface, and concentration. `REUSE` — extends `chemistry:reactions:rate` (18+) [Inferred]
11. **"Why Do We Learn That Mass Is Conserved?"** — Situation: a recipe scaled by weight, a fizzy reaction in a sealed vs open bottle, and a product claim that something "disappeared." — Concept: conservation of mass as an audit tool for everyday claims. `REUSE` — extends `chemistry:reactions:mass` (18+) [Inferred]
12. **"Why Do We Learn to Explain a Change?"** — Situation: rust on a bike left outside, tarnish, a cut apple browning — the learner must explain one change as a new substance forming, not a substance "wearing out." — Concept: chemical vs physical change, evidenced explanation. `REUSE` — extends `chemistry:reactions:explain` (18+); also builds on `chemistry:reactions:rust` (10–18) [Inferred]

### General Knowledge — Geography / Earth & Space / Interdisciplinary (travel, place, planet, health-systems)

13. **"Why Do We Learn About Great Circles?"** — Situation: a flight from North America to Asia arcs over the Arctic on the booking map, and a flat map says the "straight" route is shorter. — Concept: shortest path on a sphere vs straight line on a projection. `REUSE` — extends `general-knowledge:mixed:great-circle` (18+) [Inferred]
14. **"Why Do We Learn About Rivers and Flow?"** — Situation: choosing whether a house near a river is a bargain or a flood risk, using flow, catchment, and a flood map. — Concept: flow rate, watersheds, and hazard as a system (ESS3, Earth and Human Activity — Lane 1 §2b [Moderate 1/1]). `REUSE` — extends `general-knowledge:mixed:falls-flow` (18+) [Inferred]
15. **"Why Do We Learn About Time Zones?"** — Situation: scheduling a call and a medication schedule across a long-haul trip so neither the meeting nor the dose lands at 3 a.m. body time. — Concept: longitudinal time arithmetic; elapsed time across zones. `BRIDGE` — builds on `social-studies:compare:time-zones` (10–18), housed here as travel GK [Inferred]
16. **"Why Do We Learn About the Body's Systems?"** — Situation: reading a basic blood-panel result — a value, a reference range, and a "high" flag — and knowing what kind of question to bring to a clinician. — Concept: the body as regulated systems (feedback, ranges, rates); health numeracy. `NEW` [Inferred] *(The bounded Life Science strand — see §6. Literacy only, never advice — §4, cut 7.)*

### Social Studies — History / Civics / Economics / Human Geography (citizenship, money, travel)

17. **"Why Do We Learn About Interest and Credit?"** — Situation: two loan offers for the same car — lower monthly payment, longer term, higher total cost. — Concept: how lending institutions price time and risk; total cost of credit. `NEW` [Inferred] *(Institution half of the money cluster; Math #2 owns the tool — §4, cut 5.)*
18. **"Why Do We Learn About Taxes?"** — Situation: a first pay stub (or a freelancer's first quarterly bill) where the gross-to-net gap must be explained line by line. — Concept: marginal vs effective rates; what each deduction funds. `NEW` [Inferred]
19. **"Why Do We Learn How Laws Are Made?"** — Situation: a local ballot measure / council proposal the learner must vote on, with cost claims from both campaigns. — Concept: C3 civic processes at adult stakes — who decides, who pays, who benefits (D2.Eco.1.9-12 framing — Lane 1 §3a [Low 1/1]); evaluating a policy's costs/benefits across groups. `NEW` [Inferred]
20. **"Why Do We Learn the True Cost of a Trip?"** — Situation: two holiday options priced in different currencies with different taxes, fees, and exchange rates — the cheaper headline is not the cheaper trip. — Concept: total-cost comparison, currency conversion, fee structures. `REUSE` — extends `social-studies:compare:trip-cost` (18+); the map-distortion companion `social-studies:region:flat-map-area` (18+) is the natural paired case [Inferred]

### Journals — applied field notes / decision records (process tier)

21. **"Why Do We Keep a Field Note?"** — Situation: a home-energy journal — one week of meter readings and appliance notes that must convince a landlord (or a future self) where the bill comes from. — Concept: the inquiry process as a record: question → evidence → communicated conclusion (C3 Dimensions 1/3/4 pattern — Lane 1 §6.4 [Inferred]). `NEW` [Inferred] *(Pairs with Physics #5 by cross-link, not duplication — §4, cut 8.)*
22. **"Why Do We Learn to Measure a Mountain?"** — Situation: planning a high-altitude trek and reading why the stated height of a summit, and the thin air at it, change what a body can do. — Concept: altitude measurement, pressure, and acclimatisation as recorded observation. `REUSE` — extends `people-places:aconcagua-height` (18+, the band's sole Journals item) [Inferred]
23. **"Why Do We Test a Claim in the Field?"** — Situation: a travel guide / product review claims a place, a route, or a device performs a certain way; the learner designs a one-day check and records whether the claim survives. — Concept: evidence quality, sample size of one, honest recording of a disconfirming result. `NEW` [Inferred]
24. **"Why Do We Keep a Health Log?"** — Situation: logging sleep, symptoms, and medication timing for two weeks before a clinician visit, so the appointment works from data instead of memory. — Concept: longitudinal self-observation; correlation vs cause in your own notes; presenting a record another professional can act on. `NEW` [Inferred] *(Pairs with GK #16 — the Life Science strand's Journals half, §6.)*

**Coverage check [Inferred]:** 24 prompts = 4 per category, meeting the §3 minimum viable cell for every subject, including Journals (1 → 4) and GK (2 → 4). Reuse: 11 REUSE, 2 BRIDGE, 11 NEW — the build is roughly half extension of proven inventory, half new writing. Life domains covered: money (#1, #2, #3, #17, #18, #20), home (#4, #5, #7, #9, #21), health (#10, #16, #22, #24), work (#1, #8, #18), citizenship (#18, #19), travel (#13, #15, #20, #22, #23).

---


---

## D. Gap & priority recommendations

### D.1 The supply side — what Meridian actually holds [Tested, Lane 4]

Counts are a mechanical regex count of item records in `src/subjects/<subject>/items.ts` on `origin/main`, 2026-11-24, cross-checked against each file's own header totals (method in Lane 4). **n = 131 items.** Shares below are simple proportions (count ÷ 131 × 100), one decimal place:

| Category | Items | Calculation | Share of inventory |
|---|---:|---|---:|
| Math | 53 | 53 ÷ 131 = 0.405 | **40.5%** |
| Physics | 24 | 24 ÷ 131 = 0.183 | **18.3%** |
| Chemistry | 16 | 16 ÷ 131 = 0.122 | **12.2%** |
| Journals | 16 | 16 ÷ 131 = 0.122 | **12.2%** |
| Social Studies | 12 | 12 ÷ 131 = 0.092 | **9.2%** |
| General Knowledge | 10 | 10 ÷ 131 = 0.076 | **7.6%** |

By current band: 7–10 = 56 ÷ 131 = **42.7%** · 10–18 = 60 ÷ 131 = **45.8%** · 18+ = 15 ÷ 131 = **11.5%**.

### D.2 The demand side — what U.S. curricula actually weigh

1. **Science is four discipline families, and Meridian houses two and a half.** NGSS is structured as Physical Science, Life Science, Earth & Space Science, and Engineering Design (Lane 1, §2). Meridian fully houses Physical Science (split across Physics + Chemistry), houses Earth & Space partially (a strand inside General Knowledge), treats Engineering as process-only (Journals), and houses **Life Science nowhere**. Structural count: 1 of 4 NGSS discipline families — **25% of the framework's discipline structure** — has zero Meridian items (0 of 131).
2. **Life Science is roughly a third of enacted elementary science.** Documented unit shares: NYC Grade 2 — 1 of 3 science units is life science [Low 1/1, Lane 3]; Miami-Dade — 1 of 4 Bodies of Knowledge, every year [Low 1/1, Lane 3]; CPS — mixed integrated units [Moderate 2/2, Lane 3]. Unweighted mean of the two numeric shares: (33.3% + 25.0%) ÷ 2 = **29.2%** (method: simple mean; n = 2 districts with numeric shares; school years as documented in Lane 3; confidence **Low** — treat as directional, not precise).
3. **Social Studies is a full required subject with Meridian's second-thinnest stock.** C3 spans four disciplines (Civics, Economics, Geography, History) at every band (Lane 1, §3), and U.S. History + government + economics is the single most convergent high-school requirement across TX/NY/CA (Lane 2, §4). Against that weight Meridian holds 12 items (9.2%), and its T1 social-studies cell holds 4.
4. **General Knowledge is the thinnest category (7.6%) while carrying the widest brief** — Geography + Earth & Space + Interdisciplinary in one category, with the geography double-home problem (§A.6) and now the interim Life Science pressure (§D.3) both landing on it. Its 18+ cell holds 2 items; its T1 cell holds 5, none of them science (Council T1 seat, §5).
5. **The 10–18 stock is mostly middle-school depth — T3 is hollow.** The council's High School seat audited Lane 4's topic lists against the T3 anchors and found, inside the 60-item 10–18 pool: **0 items at quantified high-school depth in Physics, 0 at high-school depth in Chemistry, 0 at C3 evaluate/critique level in Social Studies** [Tested lists, Inferred depth judgement — Council T3 seat, §0]. Splitting the band by relabelling alone would create an empty T3 shelf in three categories.

### D.3 The Life Science question — the council did not reach one voice

This is the design's one open structural decision, and it belongs to the owner:

- **T1 seat — DISSENT for a 7th category** ("Life Science / Living World"), at least at T1–T2: LS is ~⅓ of enacted elementary science (§D.2.2), T1 General Knowledge is already the weakest cell, and invisible housing inside GK guarantees crowding-out. Fallback: a *named* Living World strand inside GK with a protected ≥⅓ share of T1 GK cases.
- **T2 seat — interim named sub-strand inside General Knowledge–Interdisciplinary now**; rejects "out of scope"; the permanent 7th-category choice goes to the owner; no NGSS-completeness claim until resolved.
- **T3 seat — DISSENT from the 6-category status quo**: named strand inside GK–Interdisciplinary as interim, 7th category recommended as the structural fix, and a mandatory *"Life Science not yet covered"* caveat on all T3 science claims until then (ACT's Science benchmark course is Biology; CPS requires Biology as the first HS science; AP Biology has nothing to cap — Lane 1, §5; Lane 3).
- **T4 seat — no 7th category for adults**: a bounded 3–4 case applied-health strand spread across GK + Journals + Chemistry (adults meet biology as health), explicitly *not* standards-required — for adult life-science curricula the pack's verdict is **Data not available**.

**Synthesis recommendation [Inferred]:** adopt the interim named strand inside General Knowledge now (all four seats accept it as at least a fallback), with the protected-share rule at T1–T2, and put the 7th-category question to the owner as a standalone decision with the T1/T3 dissents attached. Do not let any Meridian surface claim NGSS-complete science coverage until it is resolved.

### D.4 Priority build order [Inferred, from §D.1–§D.3 and the council memos]

1. **P1 — Re-tag before writing.** Apply the council's split rule to the 60 items in the 10–18 band (T2 seat, §2: *an item is T2 if a Grade 8 learner solves it by stating/testing a relationship without a T3 formalism* — per-category testable sentences in the memo), and add the internal T1a/T1b grade tag (§A.4), including retagging `fractions:compare-unlike` to Grade 5 only. No new content; this unlocks every later step and the 3-button collapse (§A.5).
2. **P2 — Build T3 where it is empty.** Physics, Chemistry, Social Studies and GK at T3 are build-new, not relabel (§D.2.5). The T3 prompts in §C.3 are the first authoring queue; quantification stays inside the NGSS bounds, with beyond-bound content labelled AP extension.
3. **P3 — Rebuild General Knowledge.** Thinnest category, widest brief: apply the geography single-home rule (§A.6), build the Earth & Space dual home (GK strand + Physics/Chemistry cross-tags), and host the interim Life Science strand here under its protected share.
4. **P4 — Grow Social Studies to its curriculum weight.** Anchor civics at Grade 7 inside T2 (Miami's documented placement) without removing the T3 civics semester; keep personal finance a *separable* unit with the three documented presentation modes (TX fused · CA standalone · NY inside-economics — Lane 2, D3).
5. **P5 — Close T4's sub-viable cells, then stop.** Journals 18+ (1 item) and GK 18+ (2 items) rise to the T4 seat's floor of 4 per category; T4 target is 24–36 cases total as an application layer — **no T4 expansion** until P1 is scheduled (Council T4 seat, §3).
6. **P6 — Chemistry guardrails, not volume.** Chemistry's T1 cell (5 items) is the best-calibrated science cell in the inventory (Council T1 seat, §1.3) — protect it; Chemistry growth belongs at T2 (particle model) and T3 (mole-bounded), per §A.3.

### D.5 Council agreements (all four seats, on the pack's evidence)

- Quantification is the STEM dial; verbs are the humanities dial (§A.3).
- T2 science delivery spirals integrated; categories are a picker convenience, not a teaching sequence.
- Physics/Chemistry stay separate categories, paid for with CA course aliases (*Physics of the Universe*, *Chemistry in the Earth System*) and a TX-IPC-style combined on-ramp at early T3 (Council T3, §1.7).
- Earth & Space gets a dual home; personal finance stays a separable unit.
- Journals is a process tier at every level.
- No single district's sequence is adopted wholesale (T1 seat dissent, accepted in synthesis): standards set coverage, districts inform delivery.

---

## "Data not available" register (consolidated)

Claims the programme needed but could not verify — dropped, not estimated:

1. **Houston ISD** — no public grade-by-grade scope & sequence exists on the district's current site; sequences unverifiable (Lane 3).
2. **Miami-Dade** — high-school social-studies order and elementary math topics unverifiable from official documents (Lane 3); several pacing-guide contents verified only via school-hosted mirrors, tagged Low/Moderate.
3. **LAUSD** — unit-level contents sit behind Drive links; topic-level detail unavailable (Lane 3).
4. **T4 / adult curricula** — no national topic-by-topic general-education standard exists in the sources; state K-12 frameworks document nothing for 18+ (Lane 1, §8; Lane 2, §6).
5. **AP course detail** — current AP Course & Exam Description unit weights / Big Idea wording unverified; published AP course totals conflict across sources (38/40/42) (Lane 1, §8).
6. **g = 9.8 m/s² as a sourced constant** — quantified gravitation at T3 is anchored (HS-PS2), but the numeric value itself was not verified from a primary source inside this pack (§A.3).
7. **Texas civics-test graduation requirement** — only bill/committee text found; not enacted text; do not design on it (Lane 2, §6). TX HB 27 (2025) personal-finance changes likewise not verified as final adopted TEKS.
8. **A single NYSED primary source** listing the full NY high-school science course set — course names rest partly on district secondary sources, tagged Low (Lane 2, §6).
9. **Verbatim CCSS Grades 6–8 standard-code text** — secondary syntheses only, tagged Low (Lane 1, §8).
10. **Item-by-item T2/T3 re-tag of the 60 items** — the rule exists (§D.4 P1); the re-tag itself is future work, not a finding.
11. **Cohort 2 partial figures** — district-level Science proficiency (St. Johns FL, Chandler AZ), Triad CUSD #2 ELA growth percentile, and several Cohort 2 per-district curriculum-sequence details are "Data not available" in Lane 5; Eanes ISD's Science Meets rate is [Low] pending portal re-verification. Illinois publishes no district-level summative designation, and California publishes no single summative grade or 100-point index (documented formats used instead — §0).

*End of deliverables. Phase 1 lane files and Phase 2 council memos: `evidence/`. Deduplicated sources: `SOURCES.md`.*
