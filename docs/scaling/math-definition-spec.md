# Math Definition Spec — P1 curriculum + topic map, P3 Math v1 quiz-loop

> **Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**
>
> This file is a definition brief, not a build. No educator exists today
> (the educator seat is UNSTAFFED — no persona, no named human SME), so
> nothing in this file is signed and nothing in it is approved. P3 stays
> GATED until a named educator signs, in writing, the items listed in
> §8. No agent may sign this file, substitute a generic review, or write
> "approved" anywhere in it.
>
> - Workstream: WS2 — Math definition (P1 + P3), scaling-plan push
> - Branch: `feat/math-definition`
> - Base: origin/main `f37dea50`
> - Date prepared: 2026-11-10
> - Sources for this file: `~/workspace/meridian-scaling-lens-breakdown.md`
>   (§1 P1, §2 P3), `~/workspace/meridian-scaling-work-packets.md`
>   (P1, P3), `~/workspace/meridian-scaling-spec-breakdown.md` (§3 P1/P3).
>   Every factual claim in this file carries a live web source (URL +
>   access date 2026-11-10) or an explicit confidence level — see §9.

## 0. Scope, hard stops, what counts as done

### 0.1 Scope — in

- **P1:** named curriculum + topic map per band (5th grade and up);
  written math judging policy (exact-answer-only v1); machine-verification
  gate specified and demonstrated on one complete mode (worked example);
  error taxonomy with machine-checkable detectors; per-band presentation
  specs; home-mockup spec (the mockup artifact itself is NOT produced by
  this workstream — see §6.1); stacking-test falsification rule
  (pre-stated; the test itself is NOT run here — see §6.2); age-band
  split options with costs; load-budget baselining inputs (proposals).
- **P3 (definition only):** Math v1 quiz-loop definition — one math mode
  on the quiz loop, exact answers, judging details, equivalent-form rule
  recorded as an OPEN question, host wrap-up after every question,
  lazy-load guardrail, review-deck error-type wiring, funnel-event names
  (proposed), scoring base (proposed).

### 0.2 Scope — out (hard stops)

- No game code, no quiz implementation, no UI code, no mockup code.
- No merges, no PRs, no force-push. Merging stays the owner's word per
  PR per head.
- No educator sign-off. No "approved" anywhere.
- No 5–7 content (see §1). No algebra (P4). No tiny-model work (P9,
  parked). No behaviour change to the geography game.
- No owner question is settled in this file. Open questions (§9) are
  recorded, never decided.

### 0.3 What counts as done (for this workstream)

1. This spec exists on branch `feat/math-definition`, pushed to the
   remote, with the status banner above.
2. P1 acceptance items (a)–(c) and (f) from the lens breakdown are met
   as **drafts**: curriculum named with document + version + date;
   topic map covers every band with citations; judging policy written
   and testable; verification gate demonstrated on one complete mode
   (worked example, §5); age-band split options recorded with costs.
3. P3 quiz-loop definition is written (§4) with the equivalent-form
   rule explicitly OPEN.
4. Every factual claim carries a source or a confidence level (§9).
5. The file ends in a written **unsigned** state (§8) — P3 stays GATED.

### 0.4 What is explicitly NOT done by this workstream

- P1 acceptance (d): home mockup passes the 5-second find test for a
  10-year-old and a 16-year-old — **not run**. No mockup artifact
  exists; no child was tested. The mockup spec and the test protocol
  are written (§6.1); the artifact and the test are remaining P1 work.
- P1 acceptance (e): stacking test recorded result — **not run**. The
  pre-stated falsification rule is written (§6.2); the result is
  unrecorded until a mockup exists.
- P1 acceptance (c) in full: the verification gate is demonstrated on
  one mode as a worked example (§5); the executable gate wired into CI
  is P3 build work, not definition work.
- Educator sign-off (P1 acceptance (g) / §8): **blocked — no educator**.

## 1. Corrections to superseded facts

These corrections are applied throughout this file. Any older doc that
says otherwise is stale on these points.

| # | Superseded claim | Correction (decided) | Decider / date |
|---|---|---|---|
| 1 | Target audience "ages 8–10 first" (study §9.6) / 5–7 games (Number Hunt, Add-'Em-Up Café) in the project description | **Target is 5th grade and up** — kids who already know numbers and words. The game teaches them to USE numbers, not to learn numbers. No 5–7 math content is defined in this file. If the owner later re-admits 5–7, that is a new packet, not a widening of this one. | Owner, 2026-11-07 |
| 2 | Study Phase 4 "progression late" | Superseded by the debate: **thin progression contract in Phase 0** (one passport, one streak definition, one badge namespace — P2's work, not this file's). | Council, 2026-11-07 |
| 3 | Math ideas "Number Hunt / Add-'Em-Up Café" as v1 candidates | Out of scope (5–7 games). V1 candidates from the description that fit: **Times Table Races, Division Diner, Fraction Kitchen, Measure-Up Workshop** — subject to this topic map. | Packets P3; owner correction |
| 4 | Olympiad depth as a difficulty slider | **Dismissed by the council.** Olympiad is a mode or a separate subject — placed in this definition (§3.5), decision by the educator (Q10). | Council, 2026-11-07 |

## 2. P1 — Curriculum choice

### 2.1 Proposed primary curriculum: US Common Core State Standards for Mathematics (CCSSM)

- **Document:** Common Core State Standards for Mathematics, adopted
  June 2010 by the National Governors Association Center for Best
  Practices and the Council of Chief State School Officers.
- **Version/date:** 2010 edition, unchanged as the published standard
  (the grade-5 text is cited from the Oregon adoption, "Adopted October
  2010").
- **Why this one (draft rationale, not a decision):** it is a published,
  grade-by-grade standard with named codes per topic (e.g. 5.NBT.5,
  6.RP.3c, 7.RP.3), which is exactly what a topic map and a
  machine-verification gate need to cite. Every topic in §3 cites a
  CCSS code or is explicitly marked as Meridian-added enrichment.
- **Status: PROPOSAL.** The curriculum choice is item 1 of the six
  educator sign-off items (§8) and the owner's Q1. This file proposes;
  it does not choose.

Sources (accessed 2026-11-10):

- Grade 5 standards text:
  <https://core-docs.s3.amazonaws.com/documents/asset/uploaded_file/1045163/Grade_5_Mathematics_Common_Core_State_Standards.pdf>
- Grade 5, Oregon adoption (October 2010):
  <https://www.oregon.gov/ode/educator-resources/standards/mathematics/Documents/ccssm5.pdf>
- Grades 6–8 domain progressions (ratios, percent):
  <https://portal.ct.gov/-/media/sde/ct-core-standards/2014/08/ccss_math_6_8_domain_progressions.pdf>
- Grade 6–7 ratios/percent standard text:
  <https://www.onlinemathlearning.com/common-core-ratios-proportional-relationships.html>

### 2.2 Country variation — the cost of each option (Q1, owner decides)

The curriculum varies by country. The researcher's deliverable is the
cost of each option, not the decision.

| Option | What it means | Cost |
|---|---|---|
| A. One curriculum (CCSS) for all players | Topic map, bank, and judging written once. Currency/money contexts stay US dollars unless localised separately. | Cheapest. Risk: a UK or Indian child revises topics a year early/late vs their school. |
| B. One curriculum per jurisdiction (CCSS + UK National Curriculum + NCERT), same game code | Three topic maps; one shared judging engine; per-jurisdiction problem banks and money/currency contexts. | ~3× the definition and bank work; one extra switch in run config (jurisdiction). The game code does not fork — only content does. |
| C. One curriculum, jurisdiction overlays | CCSS base map; small overlay files that move/add topics per jurisdiction (e.g. UK Year 5 introduces percentages; NCERT Class 6–8 ordering differs). | Middle cost. Overlays must be educator-checked per jurisdiction; drift risk if the base moves and an overlay is not re-checked. |

Jurisdiction documents on file (accessed 2026-11-10):

- **UK:** National curriculum in England: mathematics programmes of
  study, Department for Education, updated 28 September 2021, still in
  force as of 2026 —
  <https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study>
  Key facts used: Year 5 number work includes fractions "including
  decimals and percentages"; by end of Year 4 pupils have memorised
  multiplication tables up to 12×12.
- **India:** NCERT mathematics textbooks (Math-Magic Class 5; Ganita
  Prakash Classes 6–7 under NCF-SE 2023; rationalised 2022 books for
  Class 8), National Council of Educational Research and Training —
  <https://www.ncertbooks.net/ncert-maths-books-class-6-12/>,
  <https://getschoolsinfo.com/ncert/syllabus-changes-2025-26>.
  Key facts used: Class 5 covers large numbers, multiplication and
  division, fractions, decimals, data handling; Classes 6–8 cover
  integers, fractions and decimals, simple equations, rational numbers.
  **Confidence: MEDIUM** — these are secondary summaries; the NCERT
  PDFs themselves were not re-read line by line for this draft.

**No option is decided here.** Decider: owner (Q1), with the educator
signing whichever option is picked.

### 2.3 What "revision, not new teaching" means for math

Meridian's standing content rule: playing revises what school already
taught; it never teaches new material. For math this means:

- Every v1 problem's underlying topic must be a topic the child's band
  has already met in school (cited in §3). A trick (e.g. a fast way to
  multiply 3-digit numbers) is a *method* layered on a taught topic, not
  a new topic — the underlying multiplication is already taught.
- Anything with no school citation at the band is **out of scope until
  cited** (UNVERIFIED), not "probably fine".

## 3. P1 — Topic map per band (5th grade and up)

Bands are stated in **school grades first, ages second**. The existing
repo bands are 5–7 / 8–10 / 11–13 (ages); bands 14–15 and 16–18 do not
exist yet — the split is Q8 (§6.3). Grade labels are used because the
curriculum is written by grade, and because the owner question Q8
explicitly asks whether bands follow school years/grades instead of
ages. Ages shown are typical US ages for the grade; they are approximate
and marked as such.

### Band A — Grade 5 (ages ~10–11)

School teaches (CCSS grade 5, HIGH — official standard text):

| Topic | CCSS code | What the game practises (v1) |
|---|---|---|
| Multi-digit whole-number multiplication | 5.NBT.5 — "Fluently multiply multi-digit whole numbers using the standard algorithm" | Times Table Races; multiplication to 3-digit × 2-digit (see tricks below) |
| Division, up to 4-digit dividends / 2-digit divisors | 5.NBT.6 | Division Diner: quotients with remainders; division as the inverse check on multiplication |
| Decimals to hundredths, all four operations | 5.NBT.7 | Money as decimals ($4.75 + $2.30); decimal multiplication/division in money contexts |
| Fractions: add/subtract unlike denominators | 5.NF.1 | Fraction Kitchen: unlike-denominator addition/subtraction with visual cut |
| Fraction as division | 5.NF.3 — "Interpret a fraction as division of the numerator by the denominator (a/b = a ÷ b)" | Fraction Kitchen: sharing/division reading of fractions |
| Numerical expressions, order of operations | 5.OA.1, 5.OA.2 | Short expressions with parentheses as warm-ups (not a separate mode) |
| Volume (measurement) | 5.MD | Measure-Up Workshop: volume of rectangular prisms as multiplication in context |

**Big-number tricks (Meridian-added method layer, not a CCSS topic):**
3-digit multiplication the fast way — e.g. 347 × 6 by splitting
(300×6 + 40×6 + 7×6), and 2-digit × 2-digit by near-base methods.
These are allowed because the underlying operation (5.NBT.5) is taught;
the trick is a faster method for the same taught operation. The trick
itself is **not** claimed to be in the curriculum — it is labelled
Meridian method, and the educator must confirm the method does not
teach a wrong shortcut (sign-off item 5 covers error taxonomy; the
method layer falls under sign-off item 2, the topic map).

**Percentages at Grade 5:** CCSS does **not** name percent in grade 5 —
the term first appears at 6.RP.3c (see Band B). The UK Year 5 programme
does include percentages. So: **percent problems are NOT in Band A
under the CCSS map**; under a UK overlay they are. This is a live
example of why Q1 (country variation) changes the map, and why no
percent item may ship in Band A until Q1 is answered. (HIGH — the
grade-5 and grade-6/7 standard texts were both read.)

**Money/currency at Grade 5:** money is a *context*, not a separate
CCSS topic at this grade. It enters through 5.NBT.7 (decimals to
hundredths) — prices, change, totals. Currency is USD in the CCSS map;
other currencies are a jurisdiction overlay (Q1).

### Band B — Grades 6–8 (ages ~11–14)

School teaches (CCSS grades 6–8, HIGH):

| Topic | CCSS code | What the game practises (v1) |
|---|---|---|
| Ratios, unit rates, unit pricing | 6.RP.1–3b | Unit-price comparisons; speed/rate problems |
| **Percent of a quantity** | 6.RP.3c — "Find a percent of a quantity as a rate per 100 (e.g., 30% of a quantity means 30/100 times the quantity); solve problems involving finding the whole, given a part and the percent" | Percent mode: find the percent, find the whole, find the part |
| Multistep ratio and percent problems | 7.RP.3 — "Use proportional relationships to solve multistep ratio and percent problems. Examples: simple interest, tax, markups and markdowns, gratuities and commissions, fees, percent increase and decrease, percent error" | Money/currency as the main context: tax, tip, discount, markup, simple interest, percent increase/decrease |
| Rational numbers, all four operations | 7.NS.1–3 | Signed-number arithmetic; division of fractions (7.NS.2) |
| Expressions and equations | 7.EE.1–4 | Evaluating and simplifying (judged exact-answer only in v1 — see §4.2; the equivalent-form rule is OPEN) |
| Exponents, scientific notation | 8.EE.1–4 | Powers of 10; big-number estimation (supports the tricks strand) |
| Linear equations, slope | 8.EE.5–8 | One-step and two-step equations as problems (exact numeric answer in v1) |
| Functions (intro) | 8.F.1–5 | Reading values from a function rule/table — v1 scope only if the educator confirms (sign-off item 2) |

**Percentiles at Grades 6–8:** "percentile" is a *statistics* concept,
not an arithmetic one. No CCSS standard before high school names
percentile. Grade 6 statistics (6.SP) covers mean/median/mode and
interquartile range — not percentile rank. So **percentile items are
NOT in Bands A or B** in v1. They belong, if anywhere, in Band D
statistics (HSS-ID) as enrichment, and only with educator sign-off.
The owner's phrase "percentages/percentiles" is therefore split in this
map: percentages are core (Bands B–C); percentiles are a later,
educator-gated statistics item. **Confidence: MEDIUM** — the absence of
"percentile" from the grade 6–8 standard text was verified in the
sources read; the high-school placement (S-ID) was not re-read for this
draft and is marked MEDIUM, not HIGH.

**Money/currency at Grades 6–8:** the main money strand. 7.RP.3's
examples *are* money contexts (simple interest, tax, markups and
markdowns, gratuities, commissions, fees). Money problems in v1 are
built on 7.RP.3 and 6.RP.3c only — no money topic outside those codes.

**Big-number tricks at Grades 6–8:** extend Band A: near-100
multiplication, squaring numbers ending in 5, percent-of-quantity
shortcuts (10% → 5% → 15%). Same rule: method layer on taught topics,
labelled Meridian method.

### Band C — Grades 9–10 (ages ~14–15)

School teaches (CCSS high-school conceptual categories, MEDIUM — the
high-school text was not re-read line by line for this draft):

| Topic | CCSS code (category) | What the game practises (v1) |
|---|---|---|
| Number and quantity; radicals, exponents | HSN-RN | Exact-value problems with radicals/exponents where the answer is a single exact number |
| Algebra: expressions, equations, inequalities | HSA-SSE, HSA-REI | Solving linear/quadratic equations for a numeric answer (exact-answer judging; equivalent-form rule OPEN, §4.2) |
| Functions: evaluating and interpreting | HSF-IF | Function-value problems (f(3) = ?) |
| Statistics: describing data | HSS-ID | Data summaries; percentile rank introduced here ONLY if the educator signs it (see Band B note) |

Band C is also where the **Olympiad entry point** sits (AMC 8 is grade
8 and below, under 15.5 years; AMC 10 is grade 10 and below, under
17.5 — see §3.5). Whether Band C content is "regular" or includes an
Olympiad mode is Q10.

### Band D — Grades 11–12 (ages ~16–18)

School teaches (CCSS high school, MEDIUM — same caveat as Band C):

| Topic | CCSS code (category) | What the game practises (v1) |
|---|---|---|
| Advanced algebra and functions | HSA, HSF (advanced) | Multi-step equation/function problems |
| Trigonometry (numeric values) | HSF-TF | Exact trig values (special angles) as numeric answers |
| Statistics and probability | HSS-ID, HSS-CP | Percentiles, standard deviation, probability — educator-gated enrichment |
| Precalculus fluency | — | Fast big-number and percent work under time pressure (competition prep) |

**16–18 register (Q7, owner decides):** the lens breakdown requires a
register decision (same brand or different — denser, faster, less
character-led). No register is chosen here. Options and their costs are
in §6.4. Any claim about "what teens like" is **LOW** unless it comes
from a playtest with that age group — no such playtest exists.

### 3.1 Topic-map coverage statement

Every band from Grade 5 up has a cited topic list above. Topics with
no curriculum citation are marked out of scope until cited. The map
covers arithmetic (all bands), big-number tricks (method layer,
Bands A–D), percentages (Bands B–D), percentiles (Band D only,
educator-gated), money/currency (Bands A–C as context; Band B as the
main strand), and Olympiad placement (§3.5).

### 3.2 Comparables (background only — never evidence for the curriculum choice)

Listed only so a later reader knows what exists. None of these justifies
any Meridian curriculum or judging choice.

- **Khan Academy** — lessons + practice, not games (owner's own
  framing from the scaling debate). Background only.
- **Brilliant.org** — maps its lessons to CCSS codes grade 3 through
  high school (used above as a cross-check on 6.RP.3 / 7.RP.3 wording,
  not as a curriculum source). Background only.
- **MATHCOUNTS / AMC 8** — competitions, not curricula (see §3.5).
  Background only.

No comparable was used as evidence for what Meridian should teach or
how it should judge. Any future comparable added here must carry the
same label.

### 3.5 Olympiad placement (Q10) — draft recommendation, decision open

Competitions, grounded (accessed 2026-11-10):

- **MOEMS Math Olympiad:** grades 4–8; Division E grades 4–6,
  Division M grades 6–8 —
  <https://achievable.me/exams/amc-8-10-12/resources/paths-to-the-math-olympiad-amc-8-vs-mathcounts/>
- **MATHCOUNTS:** grades 6–8; school → chapter → state → national;
  Sprint (30 problems, 40 min, no calculator), Target, Team, Countdown —
  same source; also
  <https://www.eduavenues.com/blog/best-math-competitions>
- **AMC 8:** grade 8 and below, under 15.5 years; 25 questions, 40
  minutes, once a year (January) —
  <https://achievable.me/exams/amc-8-10-12/resources/paths-to-the-math-olympiad-amc-8-vs-mathcounts/>,
  <https://www.eduavenues.com/blog/best-math-competitions>
- **AMC 10 / AMC 12:** grade 10 and below (under 17.5) / grade 12 and
  below (under 19.5); AMC 8 does not lead to AIME —
  <https://learn.modernagecoders.com/math-olympiad-amc-tutoring>

**Draft recommendation (proposal, NOT a decision):** Olympiad prep as
a **separate mode inside Math** ("Olympiad Training"), entered from
Bands B–D, using competition-style problems (multi-step, no
calculator, timed rounds modelled on MATHCOUNTS Sprint / AMC 8). Not a
difficulty slider (dismissed by the council); not a separate subject
(it is still maths, and the owner's aim is tricks + competition prep
inside math). The recommendation is a proposal for the educator; the
decision is the educator's (Q10), and without it Olympiad placement is
BLOCKED.

## 4. P1 — Judging policy (v1, written and testable)

### 4.1 The policy

**Exact-answer-only in v1. No partial credit. No equivalent forms.**

- The child's answer is judged right or wrong against one canonical
  answer, computed by the verification gate (§5), never trusted from
  the problem generator.
- No partial credit for shown working in v1. (Showing working may be a
  later-phase feature; it is not a v1 judging input.)
- No equivalent-form acceptance in v1: an answer that is mathematically
  equal to the canonical answer but written in a different form is
  **wrong** in v1. Examples: canonical `1/2`, child enters `2/4` →
  wrong in v1. Canonical `0.5`, child enters `1/2` → wrong in v1 (a
  decimal was asked for). This is harsh and deliberate: v1 judges one
  form so that the review deck never reinforces a form the game did not
  teach. Whether that harshness is right is the educator's call
  (sign-off item 3).
- A wrong answer in v1 is still a *learning* moment: the host wrap-up
  (§4.4) shows the worked solution after the question. The worked
  solution is shown, never silently withheld.

### 4.2 Input normalisation (parsing, not judging)

Before judging, the raw input is normalised. Normalisation is *not*
equivalent-form acceptance — it removes typing noise, not mathematical
difference:

| Normalisation | Example | Rule |
|---|---|---|
| Whitespace stripped | `" 42 "` → `42` | Always |
| Thousands separators removed | `"1,250"` → `1250` | Always |
| Currency symbols removed | `"$4.75"` → `4.75` | Always, when the problem is a money problem |
| Percent sign removed when a percent was asked for | `"25%"` → `25` | Always, when the problem asks for a percent |
| Trailing zeros in decimals kept as equal | `0.50` = `0.5` | Always — these are the same decimal value, not a different form |
| Negative sign | `"-3"` | Always — part of the number |

Anything not in this table is NOT normalised away. In particular:
`2/4` is not normalised to `1/2`; `0.5` is not normalised to `1/2`;
`2x + 6` is not normalised to `2(x + 3)`.

### 4.3 The test the policy must pass (judging walk)

A test must be able to walk all four cases; a policy no test can walk
is UNVERIFIED as a rule. These are the four cases (the test itself is
P3 build work; the cases are defined here):

1. **Right answer** — `7 × 8 = 56`, child enters `56` → correct.
2. **Wrong answer** — `7 × 8 = 56`, child enters `54` → wrong; error
   type recorded (see §4.5).
3. **Equivalent form rejected in v1** — problem asks for `1/2` as a
   fraction; child enters `2/4` → wrong in v1; error type recorded as
   `equivalent-form` (not a mistake type — a form rejection, so the
   review deck knows it was not a maths error).
4. **Near-miss with a carrying error** — `47 + 38 = 85`, child enters
   `75` (forgot the carry) → wrong; error type `carried-wrong`.

### 4.4 Equivalent-form rule for later phases — OPEN QUESTION (Q3)

**Status: OPEN. Not decided in this file.**

The lens breakdown says "decide, do not defer" — and also says "if the
decision needs the educator, mark it BLOCKED (Educator lens) rather
than guessing". This file follows the second instruction: the decision
needs the educator, so it is recorded as OPEN with both candidate
answers and their costs, and the decider is the educator + owner (Q3).

The question: is `2x + 6` the same as `2(x + 3)` for judging purposes
in a later phase?

| Candidate answer | What it means | Cost / risk |
|---|---|---|
| A. Yes — mathematically equal forms are the same answer | Judging needs a symbolic-equivalence check (an algebra engine, not string comparison). Partial credit for shown working becomes possible later. | A wrong equivalence check teaches wrong maths — the failure the mission cannot absorb. The check must itself be machine-verified. Larger build. |
| B. No — one canonical form per problem, forever | Judging stays string/numeric comparison. Simpler and safer. | Children who write a correct-but-different form are marked wrong; the game must then teach exactly which form it wants, every time, or it feels unfair. |

No candidate is picked here. The v1 position (neither form accepted
except the canonical one, §4.1) stands regardless of which candidate
wins later.

### 4.5 Error taxonomy (for the review deck)

Each error type has a worked example and a machine-checkable detector.
An error type with no detector is a proposal, not a rule.

| Error type | Worked example | Detector (machine-checkable predicate) |
|---|---|---|
| `carried-wrong` | `47 + 38`: child answers `75` (forgot to carry the 1 from 7+8=15) | Answer = correct answer − 10 × (number of missed carries), for single-carry cases; in general: answer differs from correct by a multiple of 10 in exactly one digit position that a carry would have filled. **Detector confidence: MEDIUM** — the predicate is stated; it has not been implemented or run. |
| `times-table-slip` | `7 × 8`: child answers `54` (used 6×9 or 7×7+5) | Answer = a×(b±1) or (a±1)×b for the problem's operands a, b. |
| `place-value-slip` | `25 × 4 = 100`: child answers `1000` or `10` | Answer = correct × 10^k or correct ÷ 10^k for integer k ≥ 1. |
| `decimal-point-slip` | `2.5 × 4 = 10`: child answers `100` or `1.0` | Answer = correct × 10^k or ÷ 10^k, where the problem involves decimals. (Overlaps `place-value-slip`; the deck records the problem type so the two are told apart.) |
| `fraction-added-denominators` | `1/2 + 1/3`: child answers `2/5` | Child's numerator = sum of numerators AND child's denominator = sum of denominators. |
| `percent-wrong-base` | "25% of 80": child answers `2000` (25 × 80, forgot ÷100) or `20` with the wrong base | Answer = percent × quantity (missing ÷100), or answer = percent of a different quantity named in the problem. |
| `operation-slip` | `48 ÷ 6`: child answers `54` (added instead of divided) | Answer = a + b (or a − b, a × b) where the problem asked for a different operation on the same operands. |
| `equivalent-form` (not a mistake) | Canonical `1/2`, child enters `2/4` | Answer is mathematically equal to canonical but not in canonical form. Recorded so the review deck does not treat a form rejection as a maths error. |

**Educator sign-off item 5:** the educator must confirm these are real
mistake types children make, at the right bands. Until then the
taxonomy is a draft.

### 4.6 What the policy does NOT cover (open, Q3)

- Tolerance: none in v1 (exact only). Any future tolerance (e.g. ±0.01
  for division decimals) is a scope change needing the owner's word +
  educator sign-off.
- Partial credit for shown working: out of v1.
- Speed in scoring: see §4.7 (P3) — not a judging input in v1.

## 5. P1 — Machine-verification gate (specified + demonstrated)

### 5.1 The gate, as an executable check

- **Input:** a generated problem (operands + operation + asked form).
- **Recomputation:** the expected answer is recomputed from the problem
  by an independent path — it is **never trusted from the generator**.
  (In the P3 build, that means a second, separately-written recompute
  function, not the generator's own answer field.)
- **Pass/fail rule:** PASS only if (a) the recomputed answer equals the
  generator's stated answer, (b) the answer is in the canonical form
  the problem asks for, and (c) the error-type detectors in §4.5 can
  classify at least the four judging-walk cases (§4.3) for this problem
  type. Any failure FAILS the build (CI or prebuild check — wired in
  P3, not here).
- **Where it runs:** prebuild check or CI. Wiring is P3 work; the rule
  is written here so P3 has something exact to wire.

### 5.2 Demonstration on one complete mode — "Times Table Races" (Band A)

The mode: multiplication of two whole numbers (2-digit × 1-digit and
3-digit × 2-digit), Band A, CCSS 5.NBT.5. Five problems, each verified
by independent recomputation (recomputed here by hand as the
demonstration; the P3 build recomputes by code).

| # | Problem | Generator's stated answer | Recomputed answer | Canonical form? | Verdict |
|---|---|---|---|---|---|
| 1 | 7 × 8 | 56 | 7 × 8 = 56 | Integer, exact | PASS |
| 2 | 347 × 6 | 2082 | 300×6=1800; 40×6=240; 7×6=42; 1800+240+42=2082 | Integer, exact | PASS |
| 3 | 124 × 35 | 4340 | 124×30=3720; 124×5=620; 3720+620=4340 | Integer, exact | PASS |
| 4 | 96 × 7 | 672 | 90×7=630; 6×7=42; 630+42=672 | Integer, exact | PASS |
| 5 | 503 × 4 | 2012 | 500×4=2000; 3×4=12; 2000+12=2012 | Integer, exact | PASS |

Worked judging-walk against problem 1 (`7 × 8`):

- Right answer `56` → correct.
- Wrong answer `54` → wrong; detector: `54 = 7 × 8 − 2`,
  and `54 ≠ 7×(8±1)` (49 or 63) and `54 ≠ (7±1)×8` (48 or 64) — so
  this particular wrong answer is **not** classified as
  `times-table-slip` by the stated detector; it is recorded as
  `unclassified-wrong` and the deck replays it as a plain miss. This
  is honest: the detector's coverage is limited, and the taxonomy must
  not pretend otherwise. (A `times-table-slip` example that the
  detector does catch: `7 × 8 → 48`, since `48 = 6 × 8 = (7−1)×8`.)
- Equivalent form: not applicable to an integer problem (no form
  variation exists for `56`).
- Near-miss with carrying error: not applicable to single-step
  multiplication; the carrying case is demonstrated on `47 + 38 → 75`
  in §4.3.

**What this demonstration proves:** the gate's shape works on one
complete mode — five problems, recomputation shown, verdicts recorded,
and one honest detector gap (`54` unclassified) written down rather
than hidden. **What it does not prove:** that an implemented gate
passes in CI. That is P3 build work, and the gate is UNVERIFIED as an
implementation until P3 wires it and it runs.

## 6. P1 — Presentation, home mockup, stacking test, age bands

### 6.1 Per-band presentation specs + home-mockup spec

**Status: SPEC WRITTEN; MOCKUP ARTIFACT NOT PRODUCED (docs-only
workstream).** The lens breakdown requires presentation specs mocked
at 390px and 1280px and a clickable home mockup. This workstream is
docs/briefs only (no code, and a clickable mockup is a built artifact),
so the specs below are written and the mockup is specified — the
artifact and its tests are remaining P1 work, listed in §0.4. A spec
with no mock is UNVERIFIED as a design claim, and this file says so
plainly.

**Per-band presentation specs (written, unmocked):**

| Band | Type scale | Density | Motion | Character prominence | Text length |
|---|---|---|---|---|---|
| Grade 5 (~10–11) | Largest; one idea per line | One problem per screen; big tap targets | Full host character, gentle motion | Host prominent; story first | Short sentences; numbers bigger than words |
| Grades 6–8 (~11–14) | Medium; two-line problems OK | Problem + working space on one screen | Host present, smaller; motion on feedback | Host as coach, not star | Short paragraphs allowed in the story wrap-up |
| Grades 9–10 (~14–15) | Medium-small; compact tables | Multi-step working visible | Motion only on feedback, not ambient | Host minimal; content leads | Full problem statements |
| Grades 11–12 (~16–18) | Smallest; dense is OK | Leaderboard/stats alongside the problem | Minimal ambient motion | Host optional/off by default (Q7) | Full text; no simplification |

**Confidence: LOW** for every row — no mock exists and no child of any
band has seen these specs. They are proposals for the mockup author,
not findings.

**Home-mockup spec (what the mockup must contain):**

1. All planned subjects present (geography + math at minimum; the
   other subjects as tiles when their definitions land).
2. "Continue first" ordering: the child's in-progress game is the
   first entry.
3. 3–4 entries above the fold at 390px.
4. Three lazy-load states visible: loading / slow / failed-offline.
5. **5-second find test protocol:** a 10-year-old and a 16-year-old,
   each with no adult help, must find the game they want in under 5
   seconds. The test is run with real children of those ages, or
   recorded as UNTESTED if it is only a self-run. **Not run; no
   children were involved in this workstream.**

### 6.2 Stacking test — pre-stated falsification rule (test NOT run)

**The rule (stated before any run, as required):** put one fake second
game tile on the clickable home mockup and give a child three tasks —
(1) start geography, (2) start the new game, (3) return to geography.
"Stacking is free" is **FALSE** if either: return-to-geography success
drops below the no-second-tile baseline, or time-to-first-play rises
above the baseline. The baseline is measured on the same mockup with
the fake tile removed, same child, same session order counterbalanced.

**Result: UNRECORDED.** No mockup exists yet, so the test cannot run.
A result without a pre-stated rule would be UNVERIFIED as evidence;
here the rule exists and the result is honestly absent.

### 6.3 Age-band split decision (Q8, owner decides) — options with costs

Existing repo bands: 5–7 / 8–10 / 11–13 (ages). Bands 14–15 and 16–18
do not exist yet.

| Option | Band table | Rung ceilings | Run-config snapshot | Cost |
|---|---|---|---|---|
| A. Two bands: 14–15 and 16–18 | 5 rows total (5–7, 8–10, 11–13, 14–15, 16–18) | Each band gets its own ceiling; 16–18 ceiling is the highest (competition-level) | Snapshot stores the band; bands are age-based as today | One extra band row vs today; two ceilings to set; matches the AMC 8 / AMC 10 / AMC 12 split (§3.5) |
| B. One band: 14–18 | 4 rows total | One ceiling for 14–18 — must fit both a 14-year-old and an 18-year-old, so it is either too hard for 14 or too easy for 18 | Simpler snapshot | Cheapest, but the ceiling compromise is real; the lens breakdown flags it as the question |
| C. School-year/grade bands instead of ages | Bands become Grade 5, Grades 6–8, Grades 9–10, Grades 11–12 (matching §3) | Ceilings follow the curriculum directly — no age→grade translation | Snapshot stores grade band; the existing age-profile code changes shape | Cleanest mapping to the curriculum, but the largest change to existing machinery; also needs an answer for children outside the US grade system (Q1) |

**No option is decided here.** Decider: owner (Q8), with the educator
confirming the band→topic mapping for the chosen option. This file's
topic map (§3) is written in grades so that it works under option C
and translates cleanly under options A/B.

### 6.4 16–18 register (Q7, owner decides) — options, no decision

| Option | What changes | Cost |
|---|---|---|
| A. Same brand, same host, denser UI | Only density/type scale change (see §6.1, Band D row) | Cheapest; risk: 16–18s read it as "a kids' game" — LOW confidence either way, no playtest exists |
| B. Different register: denser, faster, less character-led | Host becomes optional; humour that is not childish; escape-room-style cases and real challenge | New copy + new host behaviour for one band; needs playtest evidence with 16–18s before any claim about what they like |
| C. Same brand, host off by default for 16–18 | One flag; host wrap-up clips still play (the host rule is owner-decided for every question, §4.4 of the spec-breakdown) but the ambient character is gone | Cheapest real change; still needs the playtest |

**No option is decided here.** Decider: owner (Q7). Any claim about
"what teens like" without a playtest is LOW.

### 6.5 Home order vs branch order (Q6, owner decides)

Which subjects sit above the fold when all exist, and what gets
demoted. **No order is decided here.** Options with play-value
reasoning are the deliverable; the decision is the owner's (Q6).
The mockup spec (§6.1) requires "Continue first"; everything below
that is Q6. P2 must not hard-code a home order — this file does not
give it one.

### 6.6 Load budget (PROPOSAL, not measured)

Proposed starting numbers from the packets: initial JS ≤ 250 KB gzip;
per-game chunk ≤ 500 KB gzip. **These are PROPOSALS, not measurements
— LOW confidence as measurements.** The measured numbers come from
P2's first build. A breach is a block, never a silent raise. No number
in this file is presented as measured.

## 7. P3 — Math v1 quiz-loop definition

**Status: GATED.** P3 does not start building until (a) this definition
is signed by the educator (see §8 below — it is not) AND (b) P2 has
landed (shell split + `Question`/`Result` + thin contract +
import-boundary test — not landed at the time of writing). This section
is the definition P3 will build from, not the build.

### 7.1 The loop

One math mode on the existing quiz loop, mirroring the geography run
phases (`aim → story/done → summary` in `src/game/run.ts`) adapted for
math:

```
pick math → pick band → pick mode → question → answer → judge
  → host wrap-up (story + short clip) → next question …
  → summary (score, streak, review-deck misses)
```

- **Modes in v1 (subject to §3):** Times Table Races, Division Diner,
  Fraction Kitchen, Measure-Up Workshop — one complete mode plays end
  to end first; the others follow the same loop.
- **Topics per mode** cite §3; a topic with no map citation is out of
  scope for v1.
- **Bands in v1:** Grade 5 and Grades 6–8 first (the bands with HIGH
  curriculum citations). Bands C and D are defined here (§3) but their
  v1 inclusion needs the educator to confirm the content level for
  those bands (sign-off item 2) — the map is written, the build order
  is P3's call once signed.

### 7.2 Engine shape (definition, not code)

- **Problem engine:** generator + bank + difficulty tiers (the "place
  pool" analogue). Difficulty tiers map to P2's `Question` kind
  `problem`:
  - Tier 1 — within-band fluency (single operation, taught numbers).
  - Tier 2 — multi-step, tricks, money contexts (7.RP.3-style).
  - Tier 3 — competition-style challenge (AMC 8 / MATHCOUNTS flavour)
    — only if Olympiad placement (Q10, §3.5) puts challenge inside
    the mode; otherwise Tier 3 does not exist in v1.
- **Interface mapping to P2 (PROPOSAL, MEDIUM at best):** P2's
  `Question`/`Result` interfaces do not exist yet, so this mapping is
  a proposal, not a fact. Proposed `problem` payload: problem text,
  operand values, operation, asked form, unit/currency, difficulty
  tier, error-type tags. Proposed `Result` evidence: answer given,
  correct answer, working shown (if any), error type (§4.5). To be
  verified against P2's interface spec once it lands.

### 7.3 Judging in the loop

Exactly §4. Exact-answer-only in v1; the four-case judging walk
(§4.3) must be testable end to end in P3. Equivalent-form rule is
OPEN (§4.4). Any pressure to widen judging inside v1 is a scope
change needing the owner's word + educator sign-off.

### 7.4 Play surface (choice deferred to P3 design, mockup first)

Candidates from the packets — number line / ten-frame / equation
board — **one surface, chosen in P3 design, mockup first** (owner's
mockup-first rule). This file records the candidates and the selection
criteria; it does not choose:

- The surface must make the core verb visible in 2 seconds (the
  readiness audit, §7.10, point iv).
- The depth ladder is designed per subject: concrete objects →
  pictures → bare numbers → abstract symbols. Youngest band starts
  concrete; oldest band starts abstract. Mocked at 390px and 1280px
  for the youngest and oldest bands in scope — a ladder with no mock
  is a proposal.
- **Wrong-cut visibility rule (fractions):** a wrong fraction cut must
  be *visible* — the pizza is wrong, and the child can see why.
  Demonstrated in the P3 mockup, not asserted in text.
- **14–18 register for math:** escape-room cases, labs, real challenge,
  humour that is not childish — specified in P3 design; any claim
  about what teens like without a playtest is LOW.

### 7.5 Host wrap-up — after every question (decided by the owner)

Every question ends with the host story clip, win or lose, correct or
wrong. The clip retells the story (the worked solution for a maths
question — what the answer was and why) as a very small, short
animated cartoonish clip, not a lengthy explainer.

- **Length bound (PROPOSAL):** ≤ 8 seconds per clip. The owner said
  "very short"; 8 seconds is this file's proposed bound, not a decided
  number — the owner or educator confirms it. A clip with no length
  bound is out of scope.
- The wrap-up is part of the loop, not an optional extra: a question
  without a wrap-up is an incomplete loop.

### 7.6 Lazy-load guardrail (decided, hard rule)

- Nothing math-related loads before a kid picks math. The math chunk
  loads only on selection.
- Inside math, prefetch of the next 1–2 items only is allowed.
- A load failure must **never** reset a streak or eat a guess: retry +
  state preserved + offline fallback.
- Enforced by: import-boundary test (P2), no-interaction network trace
  on the P3 PR (nothing math-related loads before selection), three
  designed states per subject (loading / slow / failed-offline).
- Load budget: per-game chunk ≤ the P2-baselined number (proposal
  ≤ 500 KB gzip until measured — §6.6).

Note: the task brief records that **Q14 (lazy-load guardrail) has no
written answer from the owner** — the guardrail text above is the
council's rewritten guardrail from the debate, carried as decided in
the spec breakdown; if the owner has not confirmed it in writing,
that confirmation is still open (see §8, Q14).

### 7.7 Review deck wiring

The deck records **what kind of mistake it was, not just that it was
wrong** — using the error taxonomy in §4.5, with the new snapshot
fields (problem + working + error type). Misses are replayed by error
type. The failure the mission cannot absorb is the deck reinforcing a
wrong answer into fluency; the mitigation is the demonstrated
verification gate (§5).

### 7.8 Funnel events (proposed names)

Proposed new event names for P3 (registration with the worker's
accepted set is P3 work; an unregistered event is a drift-test
failure):

- `math_started`, `math_question_answered`,
  `math_question_missed` (with error-type field), `math_wrapup_played`,
  `math_mode_completed`.

**Alert-desirability is an owner decision** (which math funnel types
may page a human — study §10 Q7): recorded as a question in §8, not
decided here.

### 7.9 Scoring base (proposed, with inputs named)

Geography's base comes from distance; math needs a base from
correctness. Proposed v1 formula (PROPOSAL — P3 + educator confirm):

```
base_score = tier_multiplier × 100   (per correct first-try answer)
  tier_multiplier: Tier 1 = 1.0, Tier 2 = 1.5, Tier 3 = 2.0
  wrong answer = 0 for that question (no partial credit, §4.1)
  second chance (review-deck replay) = 50 (half credit, replay only)
```

Inputs named: correctness (first-try vs replay), tier. **Speed is NOT
an input in v1** — no speed term exists in this formula. Adding speed
is a scope change (it would reward fast guessing over careful
working, which cuts against "revision, not new teaching" for younger
bands). If the owner or educator wants speed, that is a new decision,
recorded in §8 as part of Q3.

### 7.10 Readiness audit for math (Researcher — four points)

| # | Audit point | State in this file |
|---|---|---|
| (i) | Named curriculum + topic map | **DRAFTED, UNSIGNED** — §2 + §3. Passes only when the educator signs it. |
| (ii) | Machine-verifiable judging rule | **SPECIFIED + DEMONSTRATED on one mode** — §4 + §5. Passes as an implementation only when P3 wires it and it runs in CI. |
| (iii) | Correctness checkable without an LLM near the data | **YES by construction** — recomputation (§5.1) needs no model. |
| (iv) | Core verb a child gets just by looking | **NOT DEMONSTRATED** — needs the P3 play-surface mockup + playtest (§7.4). Open. |

A point marked "will be done" is OPEN, not passed. Points (i) and (iv)
are OPEN; point (ii) is half-open (definition done, implementation not);
point (iii) is met.

## 8. Educator sign-off — BLOCKED (UNSTAFFED)

No educator persona exists. Nothing in this section is approved. The
named human educator / SME must sign IN WRITING, before P3 can build:

**P1 items:**

1. The curriculum choice (§2.1 proposed CCSS; Q1 country variation).
2. The school-topic map per band, 5th grade up (§3) — that each topic
   is what school teaches at that band.
3. The math judging policy — exact-answer-only in v1 (§4.1–4.3), and
   the equivalent-form rule for later phases (§4.4, currently OPEN).
4. The machine-verification gate, demonstrated on one complete mode
   (§5).
5. The error taxonomy (§4.5) — that the mistake types are real mistake
   types children make, at the right bands.
6. Olympiad placement — mode, difficulty, or separate subject (§3.5).

**P3 items (same signature, confirmed still valid for what was built):**

7. That the problem bank's content level is right for each band ("high
   content level" against 5th-grade readability).
8. That the loop as built matches this signed definition — if the build
   diverges from the signed definition, it is not signed.

**Blocked items: all eight. This file ends in a written "unsigned"
state. P3 stays GATED.**

## 9. Open owner questions (recorded, never settled)

| # | Question | Decider | Status |
|---|---|---|---|
| Q1 | Educator + curriculum: which curriculum, and does the map vary by country? (§2.2) | Owner + educator | OPEN — costs of options A/B/C recorded; no option picked |
| Q2 | Audience written confirmation: do the 5–7 games drop out? | Owner | OPEN — this file follows the owner's 2026-11-07 correction (5th grade and up) but the written confirmation is still owed |
| Q3 | Judging details: partial credit? equivalent forms? tolerance? speed in scoring? (§4.4, §4.6, §7.9) | Owner + educator | OPEN — v1 is exact-answer-only per the council; the later-phase equivalent-form rule is OPEN with both candidates costed |
| Q6 | Home order: which subjects sit above the fold, what gets demoted? (§6.5) | Owner | OPEN — options only, no order given |
| Q7 | 16–18 register: same brand or different? (§6.4) | Owner | OPEN — three options costed; no playtest exists |
| Q8 | Age-band split: 14–15 and 16–18 as two bands, or one 14–18 band; school years vs ages? (§6.3) | Owner | OPEN — three options costed; topic map written in grades so it works under any option |
| Q10 | Olympiad placement: mode, difficulty, or separate subject? (§3.5) | Educator | OPEN — draft recommendation is a separate mode; the council dismissed the difficulty slider |
| Q14 | Lazy-load guardrail: has the owner confirmed the rewritten guardrail in writing? (§7.6) | Owner | OPEN — no written answer from the owner on file; the council text is carried as decided in the spec breakdown |
| Q15 | Passport: who owns the one-passport contract, and is it confirmed? | Owner | OPEN — no written answer from the owner on file; P2 owns the thin contract, P1 does not decide it |
| — | P8's gate names v3 but the keeper is v4: does the owner's listen-approval of v4 satisfy the gate? | Owner | OPEN — recorded here because it gates journal work that shares the host-clip pipeline (§7.5); not a math decision, not settled here |
| — | Constitution-first ordering is conditional: if a single-jurisdiction constitution clears audit before math, build order changes | Owner / council | OPEN — recorded; this file assumes math-first ordering (owner + council, 2026-11-07) unless that condition triggers |
| — | Alert-desirability: which math funnel types may page a human? (§7.8) | Owner | OPEN (study §10 Q7) |

## 10. Verification block

Every research/factual claim in this file carries a live web source
(URL + date accessed 2026-11-10) or an explicit confidence level, per
the forcing rule. Claims without one are not done.

| Claim | Source / confidence |
|---|---|
| CCSS grade 5: 5.NBT.5, 5.NBT.6, 5.NBT.7, 5.NF.1, 5.NF.3, 5.OA.1–2 | HIGH — official CCSS grade-5 text, accessed 2026-11-10 (see §2.1) |
| CCSS grade 6: percent first appears at 6.RP.3c; grade 7: 7.RP.3 multistep percent problems (tax, tip, discount, interest) | HIGH — grade 6–8 domain progressions + standard text, accessed 2026-11-10 (see §2.1) |
| UK National Curriculum: Year 5 includes percentages; tables to 12×12 by end of Year 4; document updated 28 Sep 2021, in force 2026 | HIGH — gov.uk programmes of study, accessed 2026-11-10 (see §2.2) |
| NCERT Classes 5–8 maths coverage (Math-Magic; Ganita Prakash; rationalised 2022 books) | MEDIUM — secondary summaries, accessed 2026-11-10 (see §2.2); NCERT PDFs not re-read line by line |
| MOEMS grades 4–8 / Divisions E+M; MATHCOUNTS grades 6–8; AMC 8 grade 8 and below, under 15.5, 25 questions / 40 min; AMC 10/12 age caps | HIGH — competition pages, accessed 2026-11-10 (see §3.5) |
| Percentile placement (not named in CCSS before high school; belongs in Band D statistics if anywhere) | MEDIUM — verified absent from the grade 6–8 text read; high-school S-ID placement not re-read |
| CCSS high-school categories for Bands C–D (HSN, HSA, HSF, HSS) | MEDIUM — high-school standard text not re-read line by line for this draft |
| Load budget 250 KB / 500 KB gzip | LOW as measurements — proposals from the packets, not measurements; P2 measures |
| Per-band presentation specs (§6.1) | LOW — no mock, no child tested; proposals for the mockup author |
| Interface mapping to P2 `Question`/`Result` (§7.2) | MEDIUM at best — P2 interfaces do not exist yet; proposal, not fact |
| Error-taxonomy detectors (§4.5) | MEDIUM — predicates stated, not implemented or run |
| Verification gate demonstration (§5.2) | Worked example on paper — demonstrates the gate's shape on one mode; UNVERIFIED as an implementation until P3 wires it in CI |
| Home mockup 5-second find test; stacking test result | NOT RUN — no mockup exists; rule pre-stated (§6.2), result unrecorded |
| Everything in §8 (sign-off) | BLOCKED — no educator exists; nothing signed |

### Sources accessed 2026-11-10 (full list)

1. <https://core-docs.s3.amazonaws.com/documents/asset/uploaded_file/1045163/Grade_5_Mathematics_Common_Core_State_Standards.pdf>
2. <https://www.oregon.gov/ode/educator-resources/standards/mathematics/Documents/ccssm5.pdf>
3. <https://portal.ct.gov/-/media/sde/ct-core-standards/2014/08/ccss_math_6_8_domain_progressions.pdf>
4. <https://www.onlinemathlearning.com/common-core-ratios-proportional-relationships.html>
5. <https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study>
6. <https://www.ncertbooks.net/ncert-maths-books-class-6-12/>
7. <https://getschoolsinfo.com/ncert/syllabus-changes-2025-26>
8. <https://achievable.me/exams/amc-8-10-12/resources/paths-to-the-math-olympiad-amc-8-vs-mathcounts/>
9. <https://www.eduavenues.com/blog/best-math-competitions>
10. <https://learn.modernagecoders.com/math-olympiad-amc-tutoring>
11. <https://brilliant.org/help/standards-alignment/common-core-math-coverage/> (cross-check on 6.RP.3 / 7.RP.3 wording; background only)

---

## Sign-off block (unsigned)

| Role | Name | Signature | Date |
|---|---|---|---|
| Educator / SME | — (seat UNSTAFFED) | — | — |
| Owner (audience + Q1/Q2/Q6/Q7/Q8/Q14/Q15) | — | — | — |

**This file is UNSIGNED. P1 is complete as a draft; P3 stays GATED
until the signatures above exist. No agent signed this file.**
