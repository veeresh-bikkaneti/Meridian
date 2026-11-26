# Lane 7 - National Competitions & Olympiads (Anchor 2)

**Purpose:** close audit gap A2 ("Competitive Exams & Olympiads: 0 hits repo-wide"). Every benchmark below is verified against the organizer's own official rules/eligibility page on 2026-11-26. This lane converts `docs/scaling/math-definition-spec.md` §3.5's ruling ("competitions, not curricula") into a **difficulty-ceiling layer**: competitions define the top of each tier's difficulty dial, not the syllabus.

**Meridian tiers:** T1 = Gr 2-5 (ages 7-10) · T2 = Gr 6-8 (11-14) · T3 = Gr 9-12 (14-18) · T4 = 18+.
**Confidence tags:** revised standard (REVISION-2026-11-25 §2): [High x/y] = 2+ independent primary/official sources, with a narrow-fact single-official-source exception; [Moderate x/y] = 1 official primary source; [Low] = secondary only. Eligibility rules quoted from the organizer's own official page are tagged [High - official narrow-fact].

---

## 7.1 Math competitions

| Competition | Organizer / official page | Eligibility (official) | Format | Meridian tier |
|---|---|---|---|---|
| **AMC 8** | Mathematical Association of America - https://maa.org/student-programs/amc/ | Grade 8 and below, under 15.5 on competition day [High - official narrow-fact] | 25 questions, 40 minutes, January, no calculator | T1 tail (Gr 5) through T2 (Gr 6-8) |
| **AMC 10** | MAA - https://maa.org/student-programs/amc/ | Grade 10 and below, under 17.5 on competition day [High - official narrow-fact] | 75 minutes, November A/B | T2 tail (Gr 8-10) into T3 (Gr 9-10) |
| **AMC 12** | MAA - https://maa.org/student-programs/amc/ | Grade 12 and below, under 19.5 on competition day [High - official narrow-fact] | 75 minutes, November A/B; feeds AIME → USAJMO/USAMO → IMO | T3 (Gr 11-12) ceiling |
| **MATHCOUNTS Competition Series** | MATHCOUNTS Foundation - https://www.mathcounts.org/programs/official-rules-procedures | Only U.S. students in grades 6-8 [High - official narrow-fact] | 4 levels (school, chapter, state, national); Sprint / Target / Team / Countdown rounds; calculators allowed in most rounds | T2 (Gr 6-8); Countdown round = live head-to-head format |

**Design use [Inferred]:** AMC 8 sets the T2 ceiling for arithmetic/algebraic reasoning; AMC 10/12 set the T3 ceiling for precalculus/olympiad-style problem solving; MATHCOUNTS sets the T2 ceiling for timed multi-step problem solving and mental math. T1 has no national math contest below grade 5 in this set; T1 stays standards-calibrated (CCSS Gr 2-5 ramp, Lane 1) with AMC 8 sample problems as extension only.

## 7.2 Science competitions & olympiads

| Competition | Organizer / official page | Eligibility (official) | Format | Meridian tier |
|---|---|---|---|---|
| **Science Olympiad Division A** | Science Olympiad Inc. - https://www.soinc.org/start-team/team-size-grade-levels | Elementary, through grade 6 (A1 K-3, A2 Gr 3-6); no national tournament | Local events only | T1 (Gr 2-5, Gr 6 edge) |
| **Science Olympiad Division B** | Science Olympiad Inc. - https://www.soinc.org (2026 Div B rules manual: Gr 6-9; max five 9th graders per team) [High - official narrow-fact] | Middle school, grades 6-9 | 23 events (bio, earth, chem, physics, engineering, inquiry); invitational → regional → state → national | T2 (Gr 6-8) |
| **Science Olympiad Division C** | Science Olympiad Inc. - https://www.soinc.org (2026 Div C rules manual: Gr 9-12; max seven 12th graders) [High - official narrow-fact] | High school, grades 9-12 | Same 23-event structure, national tournament | T3 (Gr 9-12) |
| **USAPhO (via F=ma)** | American Association of Physics Teachers - https://aapt.org/physicsteam/ | High school grades 9-12 (F=ma open to U.S. high school students; USAPhO restricted to citizens/permanent residents) [Moderate 1/2 - official page + AAPT results] | F=ma: 25-question, 75-min mechanics MCQ (~400 advance); USAPhO: 3-hour free-response; top 20 → U.S. Physics Team camp → 5 to IPhO | T3 ceiling, physics |
| **USNCO** | American Chemical Society - https://www.acs.org/education/olympiad/rules-and-eligibility.html | Enrolled in U.S. high school grades 9-12, under 20 on July 1, graduate no earlier than May 1 of competition year [High - official narrow-fact] | Local Section exam → National Exam (3 parts incl. 2 lab practicals) → Study Camp (top 20) → 4 to IChO | T3 ceiling, chemistry |
| **USABO** | Center for Excellence in Education - https://usabo-trc.org/usabo-guidelines-and-eligibility | U.S. students in grades 9-12 [Moderate 1/2 - official TRC + program pages] | Open Exam (50-min MCQ) → Semifinal (top ~10%) → National Finals (top 20) → 4 to IBO | T3 ceiling, biology / Living World |

**Design use [Inferred]:** Science Olympiad divisions map one-to-one onto Meridian's T1/T2/T3; its 23-event list is the inventory checklist for the science pillars at each tier. USAPhO/USNCO/USABO are the T3 ceilings for Physics, Chemistry, and the Living World strand respectively. T4 has no olympiad (all are grade-bound); T4 science stays application-tier (Lane 1 §5 ACT/AP bridges).

## 7.3 What this lane changes in the plan

1. `docs/scaling/math-definition-spec.md` §3.5's "competitions, not curricula" ruling stands for **syllabus**, and is amended for **ceiling**: AMC 8/10/12 and MATHCOUNTS now bound the top of the T2/T3 math difficulty dial [Inferred; owner's required direction 2026-11-26].
2. Every STEM matrix cell gains a competition ceiling tag: T2 math → AMC 8 / MATHCOUNTS; T3 math → AMC 10/12; T2 science → SciOly Div B; T3 science → SciOly Div C + USAPhO/USNCO/USABO.
3. Zero authoring yet: this lane is the benchmark layer only. Content records remain a later authoring wave (branch status, authoring queue).
