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

---

## 11. Number strand for three age groups — items as contract I2 data

**Added by the Stage A pass on `feat/math-definition`, 2026-11-10.** Sections
1 to 10 above are the earlier draft and are not edited here. This section
adds what the scaling standard asks for (`k12-learning-design-standard.md`,
cited by section, not copied) and the item list for the number strand
(counting, place value, multiplication, division, fractions). It is PROPOSED
and GATED like the rest: no real, named human educator has signed
`educator-gate-rubric.md`, and no agent can. Measurement, rates, algebra,
geometry and trigonometry belong to `feat/math-spec`.

**What changes against sections 1 to 10.** Owner ruling D1 (standard §1) sets
three groups, `7-10`, `10-18` and `18+`, so the "5th grade and up" audience in
§0 and §3 and the age-band question Q8 (§6.3) are overtaken for audience and
bands. §3's grade ladder is kept as the grade map for the `10-18` tier, and
the `7-10` tier (grades 2 to 5, picture first) and an `18+` tier are added
below. The curriculum (CCSS, Q1) and the educator calls are unchanged and
still open. The error taxonomy (§4.5), the verification gate (§5), the
scoring base (§7.9) and the review-deck wiring (§7.7) are reused, not
rebuilt.

### 11.1 Shape of the strand

Five units, in the order a child meets them. Every unit has a `7-10` entry
tier, and the `10-18` and `18+` tiers reuse the unit with harder items.

| Unit | What it is | Items (PROPOSED) |
|---|---|---|
| `groups` | Counting in groups, equal groups, arrays | 3 |
| `place` | Place value, comparing, rounding, tenfold shifts, powers of 10 | 6 |
| `tables` | **Times Table Races**: the v1 build target | 6 |
| `division` | Fair shares, the opposite of multiplying, remainders | 6 |
| `fractions` | Fair parts to percents and shares | 9 |

Total 30 items: 19 in `7-10`, 9 in `10-18`, 2 in `18+`. Counts are PROPOSED.
A `7-10` item uses only shops, bricks, sharing, buses, recipes and packing (the
map's age-band note), and never algebra, trigonometry, rates or formulas; the
test enforces it. Two `18+` items have no school code that fits an adult and
are `UNVERIFIED` with the reason stated. Group follows the standard's grade: 7-10 is
grades 2-5, 10-18 is grades 5-12, and `18+` only where no grade fits (checked item by item; `place:scientific`, 8.EE.A.3, moved to 10-18).

**Overlap with the applied strand.** `fractions:percent` (6.RP.A.3) sits here
because the map's M2 is "fractions and percentages". If `feat/math-spec` also
claims percent, the integrator decides; this branch drops it on request.

### 11.2 The items, as data (contract I2)

The source of truth is [`math/number/items.json`](math/number/items.json). The
table is generated from it; edit the JSON, never the table. The test
`math/number/items.test.mjs` checks the shape, the sources, `buildsOn`, the
age-group rules and that every id appears here. Standard codes were fetched on
2026-11-10 from `thecorestandards.org` (one domain page per grade); that proved
each code exists and showed the opening of its wording, not every sub-clause.
The educator confirms each code's fit (rubric A3). A code not fetched is
`UNVERIFIED`.

| Id | Group | Objective (observable, shown by) | Standard | Why first (opening problem) | Builds on | Use it elsewhere |
|---|---|---|---|---|---|---|
| `math-number:groups:skip-count` | 7-10 | After this, a child can count a pile of up to 1000 objects by 5s, 10s and 100s, shown by tapping the next number in the sequence and the total at the end. | [2.NBT.A.2](https://www.thecorestandards.org/Math/Content/2/NBT/) | Forty coins are spilled on the shop counter. Counting them one by one takes ages and slips; counting in 5s is quick. | none | economics: counting out change in coins by 5s and 10s |
| `math-number:groups:arrays` | 7-10 | After this, a child can find the total in a rectangle of up to 5 rows and 5 columns by adding the rows, shown by tapping the row totals and the final total. | [2.OA.C.4](https://www.thecorestandards.org/Math/Content/2/OA/) | A wall is built from rows of bricks and the builder needs the total without counting every brick. | `groups:skip-count` | everyday life: rows of bricks in a wall, rows of chairs in a hall |
| `math-number:groups:equal-groups` | 7-10 | After this, a child can explain a product as a number of equal groups of a given size, shown by choosing the picture of 5 groups of 7 for 5 × 7. | [3.OA.A.1](https://www.thecorestandards.org/Math/Content/3/OA/) | Four boxes hold 6 pencils each. How many pencils is that, and what is a short way to say it? | `groups:skip-count` | economics: price per item, packs of the same size on a shelf |
| `math-number:place:hundreds-tens-ones` | 7-10 | After this, a child can say how many hundreds, tens and ones are in a three-digit number, shown by building the number from hundreds, tens and ones tiles. | [2.NBT.A.1](https://www.thecorestandards.org/Math/Content/2/NBT/) | A cashier is handed 3 hundred notes, 4 tens and 5 ones. Which number is that, and why is the 3 worth more than the 5? | `groups:skip-count` | economics: making change from notes and coins |
| `math-number:place:compare` | 7-10 | After this, a child can compare two three-digit numbers, shown by tapping the larger one and choosing the right sign: greater than, equal to or less than. | [2.NBT.A.4](https://www.thecorestandards.org/Math/Content/2/NBT/) | Two routes to the lake: one is 358 steps, one is 385. Which is the longer walk, and how can you tell without counting? | `place:hundreds-tens-ones` | geography: comparing two distances on a map |
| `math-number:place:round` | 7-10 | After this, a child can round a whole number to the nearest 10 or 100, shown by placing it on a number line and tapping the nearer 10 or 100. | [3.NBT.A.1](https://www.thecorestandards.org/Math/Content/3/NBT/) | A school fair has 287 visitors and the sign-maker wants a round number for the banner. Is it about 200 or about 300? | `place:compare` | geography: about how many people live in a small town (populations) |
| `math-number:place:ten-times` | 7-10 | After this, a child can explain that a digit in one place is worth ten times the same digit one place to its right, shown by sliding digit tiles one place and naming the new value. | [4.NBT.A.1](https://www.thecorestandards.org/Math/Content/4/NBT/) | A path of 70 steps is stretched by a mapmaker to ten times as long. How many steps is that, and what happened to each digit? | `place:hundreds-tens-ones` | geography: a map where each square stands for ten times the distance |
| `math-number:tables:buses` | 7-10 | After this, a child can solve a word problem about equal groups using multiplication or division within 100, shown by tapping the number of buses for 24 children with 6 seats a bus. | [3.OA.A.3](https://www.thecorestandards.org/Math/Content/3/OA/) | The class trip has 24 children and each bus seats 6. How many buses do we book? Counting seats one by one is slow; groups of 6 are fast. | `groups:equal-groups` | geography: how many buses a school trip across the region needs |
| `math-number:tables:facts` | 7-10 | After this, a child can multiply and divide within 100 using the times tables, shown by giving the exact answer without a hint. | [3.OA.C.7](https://www.thecorestandards.org/Math/Content/3/OA/) | A shop sells pencils in packs of 4 and a customer wants 7 packs. The answer is already known if the 4 times table is known, so there is no need to count them again. | `tables:buses` | physics: a gear with 8 teeth turns 6 times, so how many teeth pass the mark |
| `math-number:tables:patterns` | 7-10 | After this, a child can spot and explain a pattern in the multiplication table, shown by tapping the cells that follow the pattern and checking an answer with it. | [3.OA.D.9](https://www.thecorestandards.org/Math/Content/3/OA/) | A stall-holder wants a quick way to check their counting of packs. A pattern in the table is a free double-check. | `tables:facts` | economics: checking a total at a stall before giving change |
| `math-number:tables:big-products` | 7-10 | After this, a child can multiply a number of up to four digits by a one-digit number, shown by building the product from place-value parts and entering the exact answer. | [4.NBT.B.5](https://www.thecorestandards.org/Math/Content/4/NBT/) | A hall has 8 rows of 126 chairs for a concert. The caretaker needs the total number of seats to print the tickets. | `tables:facts`, `place:hundreds-tens-ones` | economics: the cost of 8 tickets at 126 each at a small show |
| `math-number:tables:multi-digit` | 10-18 | After this, a child can multiply multi-digit whole numbers with the standard method, shown by entering the exact product and checking it with an estimate. | [5.NBT.B.5](https://www.thecorestandards.org/Math/Content/5/NBT/) | A floor is tiled in 23 rows of 47 tiles. Ordering by guessing wastes money; the exact total decides the order. | `tables:big-products` | economics: the cost of 47 items at a price of 23 each, then checking it by rounding |
| `math-number:tables:mental-strategies` | 18+ | After this, an adult can multiply two-digit numbers in their head by splitting, doubling and halving, shown by giving the exact answer and naming the strategy used. | UNVERIFIED | Splitting a bill or comparing two quotes at a counter, where there is no calculator in hand, goes faster with a clean mental method. Fit: mental strategies are an adult extension of 5.NBT.B.5 that no single code covers. | `tables:multi-digit` | economics: splitting a bill in your head |
| `math-number:place:decimal-shifts` | 10-18 | After this, a child can explain how a digit's value changes by a factor of 10 in both directions, shown by moving digits across a decimal point on a place-value chart and reading the new number. | [5.NBT.A.1](https://www.thecorestandards.org/Math/Content/5/NBT/) | A mapmaker draws 1 cm for 10 km and then wants a map ten times closer in. Every distance must shift one place; where does each digit land? | `place:ten-times` | geography: changing the scale of a map by a factor of 10 |
| `math-number:place:scientific` | 10-18 | After this, a child can write a very large or very small number as a single digit times a power of 10 and compare two such numbers, shown by choosing the matching form and the larger one. | [8.EE.A.3](https://www.thecorestandards.org/Math/Content/8/EE/) | Two quantities on the globe differ by many zeros and a long string of zeros hides which is larger. A power of 10 makes the gap visible. | `place:decimal-shifts` | geography: comparing the size of two areas on the globe, with real figures taken from a sourced list when the unit is built |
| `math-number:division:fair-share` | 7-10 | After this, a child can interpret a division as the size of each fair share, shown by dealing 12 snacks to 4 friends on screen and entering the share each friend gets. | [3.OA.A.2](https://www.thecorestandards.org/Math/Content/3/OA/) | Twelve snacks and four friends: is it fair, and how many does each get? | `groups:equal-groups` | economics: splitting a bill fairly among friends |
| `math-number:division:unknown-factor` | 7-10 | After this, a child can find a missing factor by thinking of a division as the opposite of multiplication, shown by completing 8 × ? = 40 and checking it by multiplying. | [3.OA.B.6](https://www.thecorestandards.org/Math/Content/3/OA/) | A box holds 8 pencils and there are 40 pencils to pack. How many boxes? Asking what times 8 makes 40 solves it. | `division:fair-share`, `tables:facts` | everyday life: packing boxes of equal size |
| `math-number:division:remainders` | 7-10 | After this, a child can solve a division problem that leaves a remainder and say what the remainder means, shown by choosing whether to round up for 26 children and 6-seat buses. | [4.OA.A.3](https://www.thecorestandards.org/Math/Content/4/OA/) | There are 26 children and each bus seats 6. Four buses leave two children behind, so what do we book? | `division:unknown-factor`, `tables:buses` | geography: how many vans a school trip needs when the last van is not full |
| `math-number:division:big-quotients` | 7-10 | After this, a child can divide a number of up to four digits by one digit and give the quotient and remainder, shown by entering both and checking them by multiplying. | [4.NBT.B.6](https://www.thecorestandards.org/Math/Content/4/NBT/) | A school library has 1,248 books to put on 8 shelves, evenly. How many go on each shelf, and does any book get left over? | `division:remainders`, `tables:big-products` | economics: splitting a bill, or a prize shared evenly |
| `math-number:division:two-digit-divisors` | 10-18 | After this, a child can divide a number of up to four digits by a two-digit number, shown by entering the quotient and remainder and checking it by multiplying. | [5.NBT.B.6](https://www.thecorestandards.org/Math/Content/5/NBT/) | A builder has 156 bricks to load onto pallets of 12 and needs the number of pallets and bricks left over. | `division:big-quotients` | everyday life: packing boxes, and what is left over |
| `math-number:division:standard-algorithm` | 10-18 | After this, a child can divide multi-digit numbers with the standard method, shown by entering an exact quotient and checking it by estimation. | [6.NS.B.2](https://www.thecorestandards.org/Math/Content/6/NS/) | A trip costs 4,368 in total and 28 people share the cost equally. What does each person pay? | `division:two-digit-divisors` | economics: splitting the cost of a trip among a group |
| `math-number:fractions:fair-parts` | 7-10 | After this, a child can name a unit fraction as one of several equal parts of a whole, shown by cutting a pizza into equal parts on screen and naming one part. | [3.NF.A.1](https://www.thecorestandards.org/Math/Content/3/NF/) | Four friends share one pizza. Cut it so nobody gets a bigger piece. What do we call one piece? | `division:fair-share` | geography: share of land, a map cut into 4 equal parts |
| `math-number:fractions:number-line` | 7-10 | After this, a child can place a fraction on a number line between 0 and 1, shown by tapping the point on a line divided into equal parts. | [3.NF.A.2](https://www.thecorestandards.org/Math/Content/3/NF/) | A hiker walks 3 of 4 equal parts of a trail. Where on the trail are they now? | `fractions:fair-parts` | geography: map scale, how far along a route in equal parts |
| `math-number:fractions:equivalent` | 7-10 | After this, a child can identify two fractions that are the same size, shown by matching 1/2 to 2/4 on a pair of equal strips. | [3.NF.A.3](https://www.thecorestandards.org/Math/Content/3/NF/) | One friend cut a pizza into 2 pieces and took 1; another cut into 4 pieces and took 2. Who has more? | `fractions:number-line` | chemistry: two jugs of juice mix are the same strength when they show the same fraction of juice |
| `math-number:fractions:compare-unlike` | 7-10 | After this, a child can compare two fractions with different denominators, shown by tapping the larger of 3/4 and 2/3 and choosing a common-denominator picture. | [4.NF.A.2](https://www.thecorestandards.org/Math/Content/4/NF/) | Two water bottles are 3/4 full and 2/3 full. Which one holds more water? | `fractions:equivalent` | chemistry: which of two mixes has more of the dissolved ingredient |
| `math-number:fractions:add-unlike` | 10-18 | After this, a child can add fractions with unlike denominators, shown by entering the exact sum and drawing it on a fraction bar. | [5.NF.A.1](https://www.thecorestandards.org/Math/Content/5/NF/) | A recipe wants 1/2 cup of one thing and 1/3 cup of another. How much is that altogether, so the bowl is big enough? | `fractions:compare-unlike` | everyday life: recipes |
| `math-number:fractions:multiply` | 10-18 | After this, a child can multiply a fraction by a whole number or a fraction, shown by shading an area model and entering the product. | [5.NF.B.4](https://www.thecorestandards.org/Math/Content/5/NF/) | A recipe needs 2/3 cup, but only half of the recipe is being made. How much is needed? | `fractions:add-unlike`, `division:fair-share` | chemistry: scaling a mixture down to half the batch |
| `math-number:fractions:divide` | 10-18 | After this, a child can divide a whole number by a fraction and a fraction by a fraction in a real situation, shown by entering how many pieces of a given size fit. | [6.NS.A.1](https://www.thecorestandards.org/Math/Content/6/NS/) | A roll of ribbon is 6 metres long and each ribbon takes 3/4 of a metre. How many ribbons? | `fractions:multiply`, `division:standard-algorithm` | economics: a budget split into portions of a fraction each |
| `math-number:fractions:percent` | 10-18 | After this, a child can find a percent of a quantity as a rate per 100, shown by entering 30% of 80 and checking it on a hundred grid. | [6.RP.A.3](https://www.thecorestandards.org/Math/Content/6/RP/) | A shop takes 30% off a price of 80. What do you pay, and how much did you save? | `fractions:multiply` | economics: discounts at a shop and a stall |
| `math-number:fractions:combine-shares` | 18+ | After this, an adult can combine fractions, percents and a division in one multi-step situation, shown by entering the final amount and the order of steps used. | UNVERIFIED | A group budget is shared by fractions of the total and some shares carry a discount. The real question is who pays what once everything is combined. Fit: no single code covers multi-step fraction and percent reasoning for adults. | `fractions:percent`, `fractions:divide` | economics: sharing a group budget when some items are discounted |

### 11.3 The "confident" bar and the three states (standard §4)

The geography rule (`docs/learning-outcomes.md` §3) uses distance from a pin.
Exact-answer math has no distance, so math gets its own bar. **PROPOSED for the
owner and the educator.** This is mastery, which is separate from the score in
§7.9; speed is not an input to either.

An **attempt** is one answer to one item-round. Each attempt carries: `itemId`,
`correct` (exact, per §4.1), `hintsUsed`, `triedAgain` (the retry after a
miss), `setting` (`opening` or an elsewhere setting such as `economics`),
`errorType` (§4.5, only on a miss) and `at`. No name, no identifier, no free
text, local only (standard §7).

- **Confident attempt:** `correct`, `hintsUsed` is 0 and `triedAgain` is false.
  Never speed: there are no timers in `7-10` (standard §6), and the bar must be
  the same for every group.
- **Explored:** at least one recorded attempt.
- **Growing:** at least two attempts, not Mastered, and the latest used fewer
  hints than the first or was correct when the first was not. (This replaces
  "the latest error is smaller than the first", which has no meaning for an
  exact answer.)
- **Mastered:** the two most recent attempts are both confident, and across the
  item's attempts there is one correct answer in the `opening` problem and one
  in a different setting (the "use it elsewhere" round). Standard §0 asks for
  two different settings; the opening problem counts as the everyday one.

**What the integrator must record.** `src/game/learning.ts` and
`src/game/review-deck.ts` are read-only for this branch. The attempt record
needs `correct`, `hintsUsed`, `triedAgain`, `setting` and `errorType`, and the
mastery function needs a subject-aware branch. Until then the subject module
keeps its own attempts in module state (contract I2 note) and exposes the same
three state names.

### 11.4 Review deck hookup (standard §4)

- Misses enter the same deck on the same `[0, 1, 3, 7, 14, 30]`-day ladder, as
  in §7.7. Error-type replay is a filter on that deck, not a second deck.
- Error types are the §4.5 list: `times-table-slip`, `place-value-slip`,
  `operation-slip`, `carried-wrong`, `decimal-point-slip`,
  `fraction-added-denominators`, `percent-wrong-base`, `unclassified-wrong`.
- **One new type is proposed, `remainder-dropped`.** Example: 26 children,
  6-seat buses, the child answers `4`. Detector: the problem asks for a
  number of containers, `a mod b` is not 0, and the answer equals
  `floor(a / b)`. Stated, not implemented or run (MEDIUM, like the rest of
  §4.5). It needs the educator's confirmation (sign-off item 5).
- A review round mixes 2 to 3 skills and rotates between the `opening` and an
  elsewhere setting (map, "How it plays"). Misses on a `useElsewhere` round
  return inside the other subject once it exists, and in an everyday-life
  round until then.
- Items whose answer is a quotient and a remainder need a canonical form for
  the §4.1 exact-answer rule. That is the open equivalent-form question (Q3),
  not decided here.

### 11.5 Times Table Races for the three groups (the v1 unit)

Plan only. Stage B is gated; nothing under `src/subjects/math-number/` exists.

- **Where it sits against §5.2.** The paper demonstration of the verification
  gate (§5.2) is on "Times Table Races" at Band A, CCSS 5.NBT.5, which is the
  `10-18` item `tables:multi-digit`. The `7-10` items (`tables:buses`,
  `tables:facts`, `tables:patterns`, `tables:big-products`) and `18+`
  (`tables:mental-strategies`) are **not** covered by that demonstration. Stage
  B runs the gate on them as code first. §5.2 stays a worked example on paper
  and UNVERIFIED as an implementation.
- **Hook (3 to 5 seconds):** "The class trip has 24 children and each bus seats
  6. How many buses?", shown as four pictured buses of six seats (standard §3).
- **Predict, see, explain, retry:** the child taps a number of buses before
  they fill; the buses fill in 6s; one or two short sentences explain; a miss
  gets one retry with a hint, then goes to the deck.
- **A "race" without a clock.** Standard §6 bans timers in `7-10`, so the race
  is the child's own bus moving along the trip as they answer, with a ghost bus
  of their last trip. No countdown anywhere in `7-10`. In `10-18` and `18+` an
  optional timer can be switched on and off. The title is owner copy still TODO
  (contract I1), and whether a clockless race fits the name is an owner
  question (11.8).
- **Tiers.** Full: a three.js scene (dynamic import, as `home-globe.tsx`) where
  buses fill with children. Lite: the same scene, low-poly, no shadows, 30 fps
  cap. Flat: 2D SVG buses with short gentle transitions, for reduced motion, no
  WebGL or Save-Data. The same question, cause and effect and scoring in all
  three (standard §5.2); tests assert it.
- **Accessibility.** 44 px tap targets, no drag, a live region that says what
  happened ("Four buses are full, 24 children are on board"), shape and sound
  as well as colour, read-aloud on by default in `7-10`.
- The educator evidence pack is in
  [`math/number/times-table-races-evidence-pack.md`](math/number/times-table-races-evidence-pack.md).

### 11.6 Privacy, free, and the content screen

No names, accounts or free text; attempts stay on the device and no network
call carries learning data (standard §7). No ads, payments or revenue features,
no new library (three.js is in the house stack, standard §5.1), and any asset
is open-licensed with its licence recorded beside it. The content screen
(standard §7a) was applied while writing and the test blocks living-thing and
contested-topic words. Cut log: none cut. Left out on purpose: eggs and fruit as
counting objects (avoids living-things content) and any real population or
area figure (none is sourced yet, so rounds use made-up classroom numbers, and
real figures must be sourced when built).

### 11.7 K-12 STANDARD block (standard §9)

An unchecked box means this file does not yet demonstrate the thing. A checked
box points to where.

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] every item's `why` in items.json (11.2); the one-sentence answer is still to be written at build
- Headline goal (§0): bridge to the previous subject + playable real-life application: [ ] math has no earlier subject; the bridge to physics and chemistry is `useElsewhere` prose only; the playable application exists as a plan (11.5), not built
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] one per item in items.json, each a setting from the map; the rounds themselves are not built
- Bands served: [x] 7-10, 10-18, 18+ (11.1); 7-10 is the entry tier of every unit; 18+ has 2 items, both UNVERIFIED
- Objective per item, observable verb, "shown by": [x] items.json, enforced by items.test.mjs
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] 28 codes fetched live 2026-11-10, 2 items UNVERIFIED; sub-clauses not checked, educator confirms fit
- Loop mapped: hook / predict / see / explain / retry: [x] 11.5 for the v1 unit; the other four units are mapped when their build is approved
- Mastery "confident" bar for this subject: [x] 11.3
- Review-deck hookup (same deck, same ladder): [x] 11.4 as a plan; wiring is integrator-only (learning.ts, review-deck.ts)
- Post-clip retrieval check (journal + any video): [x] not applicable, no clips in this strand
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] 11.5; parity tests come with Stage B
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] 11.5; axe and manual QA come with Stage B
- Privacy: no PII, no identifiers, local-only records: [x] 11.3 and 11.6
- Content screen (§7a) passed; cut items logged with reason: [x] 11.6, enforced by the word list in items.test.mjs; the educator runs rubric 17a
- Free: no revenue features; asset licences recorded: [x] 11.6; no assets exist yet
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] evidence pack in math/number/; not signed
```

### 11.8 Open owner questions from this section

Numbered `N1` to `N7` so they do not collide with Q1 to Q15 in §9.

| # | Question | Decider |
|---|---|---|
| N1 | "Times Table Races" is owner copy (TODO). Is a race with no timer in `7-10` acceptable under that name? | Owner |
| N2 | Mastered bar in 11.3: two confident in a row plus two settings, the opening problem counting as the everyday one. Alternatives: three in a row; one setting. | Owner + educator |
| N3 | `fractions:percent`: here or with `feat/math-spec`? | Integrator |
| N4 | The 30 items in 5 units are PROPOSED. Confirm, add or cut. | Owner |
| N5 | Build gate for Stage B (Times Table Races, `released: false`). | Owner |
| N6 | Is `remainder-dropped` (11.4) accepted as a new error type, and how is a quotient with a remainder written canonically (Q3)? | Educator + owner |
| N7 | This pass ran as Tier 0 (docs and data, nothing under `src/`); the 25k budget was exceeded (estimated, no meter). Raise or narrow before Stage B. | Owner |

The unsigned sign-off blocks above (§8 and the block at the end of this file)
and the rubric's own block in the evidence pack stay blank. No agent signed
anything.
