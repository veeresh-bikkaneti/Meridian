# P4 — Algebra Applied in Physics · Definition Brief

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**
**Packet:** P4 · **Branch (for the future build):** `feat/algebra-physics`
**Definition branch:** `feat/science-definitions` · **Date:** 2026-11-10
**Gating:** P3 landed + this definition signed + educator sign-off on file.
Build is NOT GO until all three hold. This brief prepares the definition;
it does not clear the gate.

> Nothing in this brief is approved. A named educator must sign the items
> in §6 in writing before P4 can build. No educator exists yet.

## 1. What P4 is

Algebra applied to physics: solving for x where x is a physical quantity
(speed, time, force, energy), built on the GeoDetective deck/guess machine
— clues = solving steps, guesses = candidate values/forms — not on the
quiz loop. The hardest new component is an equation engine (a small
parser, not a CAS) plus an expression normalizer implementing the
definition's equivalent-form rule.

Candidate modes from the description (subject to the signed definition):
Algebra Detective, Equation Builder, Function Lab (oldest band only).

## 2. Topic map per band

Reference curriculum for the research below: **Common Core State Standards
for Mathematics** (Expressions & Equations domain) and **NGSS** for the
physics topics. NGSS is the research reference, not the decided
curriculum — the owner has not named a curriculum (Q1, OPEN), and NGSS
is not universal (Texas and a few other states use their own frameworks;
adoption depth varies — see §7). The signing educator must confirm the
jurisdiction.

### 2.1 Algebra per band (Common Core, HIGH — primary source)

| Band | What school teaches | CCSS anchor | Source |
|---|---|---|---|
| Grades 5 and below | No algebra. Arithmetic only; letters do not yet stand for numbers in equations. | — | CCSS EE domain begins at grade 6 (thecorestandards.org) |
| Grade 6 | Write/read/evaluate expressions with letters standing for numbers; solve one-variable equations of the form x + p = q and px = q (nonnegative rationals). | 6.EE.A.2, 6.EE.B.7 | http://www.thecorestandards.org/Math/Content/EE/ — accessed 2026-11-10 |
| Grade 7 | Generate equivalent expressions (add, subtract, factor, expand linear expressions); solve multi-step problems leading to px + q = r and p(x + q) = r. | 7.EE.A.1, 7.EE.B.4a | Same source |
| Grade 8 | Linear equations in one variable (one / infinite / no solutions); pairs of simultaneous linear equations; functions defined, evaluated, compared, and used to model relationships between quantities. | 8.EE.C.7, 8.EE.C.8, 8.F.1–4 | Same source |
| Grades 9–12 | Full high-school algebra: seeing structure in expressions, creating equations, reasoning with equations and inequalities. | HS-A.SSE, A.CED, A.REI | CCSS high-school algebra (oregon.gov CCSSM mirror) — accessed 2026-11-10 |

**Band assignment for P4 (definition claim, educator to confirm):**

- **5th grade (bottom band): NOT in scope for algebra.** P4 has no
  content for the youngest band; a 5th-grader meets algebra only later.
  This is a consequence of the CCSS map above, not a design choice.
- **Grades 6–7 (middle band):** one-step and two-step linear equations;
  equivalent expressions. Algebra Detective's core.
- **Grade 8 (upper-middle band):** linear equations, systems (two
  equations), functions as models — Function Lab lives here at the
  earliest, and only if the educator agrees.
- **Grades 9–12 (oldest band):** full algebra; Function Lab (graphs,
  changing x watches y move) is scoped here as its home band per the
  lens breakdown; grade 8 is the earliest the educator may allow.

**OPEN (not this brief's to invent):** which band meets algebra vs
functions is a P1-definition question (Q1/Q3 family). This brief records
the CCSS-derived map as the research answer for the educator to sign or
correct — it does not decide it.

### 2.2 Physics topics per band (NGSS, HIGH for the NGSS, MEDIUM for "what a given school teaches")

Every physics topic below is a formula the algebra acts on. Each formula
is a standard textbook relation; the source column is the verification
source for the eventual problem bank.

| Band | Physics topic | Formula | NGSS anchor | Source |
|---|---|---|---|---|
| Grades 6–8 | Average speed from distance and time | v = d / t | MS-PS2-2 (forces and motion; motion described by speed/direction) | https://www.toolscoops.com/2025/10/physics-formula-calculator-free-online.html — accessed 2026-11-10 |
| Grades 6–8 | Force from mass and acceleration | F = m · a | MS-PS2-1/2 (Newton's second law, qualitative at this band) | Same source |
| Grades 6–8 | Work from force and distance | W = F · d | MS-PS3-1/2 (energy transfer) | Same source |
| Grades 9–12 | Kinetic energy | KE = ½ m v² | HS-PS2-1, HS-PS3-1/2 | Same source |
| Grades 9–12 | Gravitational potential energy | PE = m · g · h | HS-PS3-1/2 | Same source |
| Grades 9–12 | Motion with uniform acceleration (v = u + at; s = ut + ½at²; v² = u² + 2as) | — | HS-PS2-1 | Same source (formula list) |

**Scope discipline:** P4's physics is *quantities in formulas only*.
Qualitative forces/motion — what happens when you push, drop, or remove
a force — belongs to P7 (see §5). No formula appears in both packets'
content.

**UNVERIFIED / not included:** no physics topic is claimed for grade 5
in this brief — NGSS grade 5 physical science is matter (5-PS1) and
energy in ecosystems (5-PS3-1), not mechanics. If the educator wants a
grade-5 physics foothold, they must name it; this brief does not invent
one.

## 3. Judging rule

### 3.1 The equivalent-form question (Q3 — OPEN)

**Question:** is `2x + 6` the same answer as `2(x + 3)`?

- This is decided in **P1's definition** (equivalent-form decision), not
  in this packet. This brief records the question and the two honest
  outcomes; it does not decide it.
- **Outcome A (normalizer):** the definition adopts an equivalence rule
  (e.g. "two expressions are the same answer iff they are algebraically
  identical after expansion and collection of like terms, over the
  rationals"), and the build implements an expression normalizer that
  implements exactly that rule.
- **Outcome B (exact-form):** if the normalizer cannot be built honestly
  at this scope, the packet **shrinks to exact-form judging and says
  so**. A normalizer that is confidently wrong is worse than none
  (packet rule, non-negotiable).

### 3.2 Judging rule as specified (for the build, once Q3 is decided)

1. **Value answers** (solve for x where x is a quantity, e.g. "how fast?"):
   judged numerically with a stated tolerance (tolerance value itself is
   a definition item for the educator — suggested: exact rational match,
   or ±1 in the last displayed digit; the educator picks).
2. **Form answers** (write the equation / expression): judged by the
   equivalent-form rule (Outcome A) or exact-string match (Outcome B).
3. **Units:** a value without its unit is a near-miss, not a pass
   (e.g. "40" for "40 m/s" is wrong-incomplete). The unit rule is part of
   the judging policy the educator signs.
4. **No partial credit in v1.** Shown working earns nothing by itself;
   any partial-credit policy is a later phase needing educator sign-off.
5. **No LLM near the judging data.** Judging is deterministic
   (parser/normalizer/numeric comparison), never model output.

### 3.3 Judging test plan (the test that must walk the rule)

A test walks, end to end, each of: right answer; wrong answer;
equivalent form accepted per the rule (Outcome A) or rejected (Outcome B);
near-miss (right number, wrong unit; right form, sign error; off-by-one
step). **A judging rule no test walks is UNVERIFIED** — the test is part
of the definition's done condition, not an afterthought.

## 4. Machine-verification gate

1. **Engine scope written:** the equation engine's scope (what it parses,
   what it refuses) is written in the build brief before code. A parser
   with no stated refusal set is incomplete.
2. **Normalizer implements the defined rule exactly** (Outcome A) — or
   the packet shrinks to exact-form judging and says so (Outcome B).
3. **Every physics problem machine-verified:** every problem in the bank
   is generated/checked by the engine (parse → solve → verify the
   answer), and every physics fact carries a citation with source and
   date. A physics fact with no citation is UNVERIFIED and out of scope.
4. **Deck-machine reuse traced to files:** each reused GeoDetective
   piece (shuffled deck, exactly-once-per-cycle, guess cap, win/loss) is
   traced to a file in `src/game/loop/`. A reuse claim with no file trace
   is UNVERIFIED.
5. **Interface check:** the `equation` Question kind payload and the
   `Result` evidence field (steps used) are verified against P2's
   interfaces; a mismatch found late is rework.

## 5. P4/P7 physics split (agreed definition statement)

> **P4 = algebra applied to physics quantities** (solve for x in a
> formula: speed, force, energy). **P7 = predict-what-happens
> forces/motion** (act on a simulation and see the consequence: push it,
> drop it, remove a link — what happens?).

This split is recorded here and in the P7 brief. It is the definition
both packets build against. If either packet's build finds the split
unworkable, the change is a definition amendment agreed by both packets
and the educator — not a unilateral build decision.

## 6. What the educator must sign (listed, not signed)

No educator exists. Nothing below is signed. The named human educator /
SME must sign IN WRITING, before P4 can build:

1. The algebra topic map per band (§2.1) — including the grade-5 exclusion
   and the Function Lab home band.
2. The physics topics per band (§2.2) — including the formula list and its
   sources.
3. The equivalent-form rule (Q3) — Outcome A (rule text) or Outcome B
   (exact-form, with the shrink stated).
4. The judging policy (§3.2) — tolerance, units rule, no-partial-credit.
5. The machine-verification gate (§4), demonstrated on one complete mode.
6. **Subject-matter correctness of the physics content.** A math educator
   alone is not enough if the physics is wrong; the signer must cover
   both math and physics, or two signers must sign.

## 7. Readiness audit — four points, assessed honestly

| # | Point | Status |
|---|---|---|
| (i) | Named curriculum + topic map | NOT DEMONSTRATED — map researched from CCSS + NGSS (§2), but no curriculum is named by the owner (Q1 OPEN) and no educator has signed. |
| (ii) | Machine-verifiable judging | NOT DEMONSTRATED — rule specified in §3, gate in §4; the engine and the judging test do not exist yet (build work, gated). |
| (iii) | Correctness without an LLM near the data | SPECIFIED, NOT DEMONSTRATED — judging is deterministic by design (§3.2.5); the problem bank does not exist yet. |
| (iv) | Core verb a child gets just by looking | NOT DEMONSTRATED — variable-manipulation UI and clue-reveal mockups do not exist yet; mockup-first is required before build, and the mockup must pass "a child gets it just by looking" with a playtest, not an assertion. |

## 8. Open questions

- **Q1** (educator + curriculum) — decider: owner. OPEN. Blocks the
  signature in §6 and audit point (i).
- **Q3** (equivalent-form rule) — decider: P1 definition + educator.
  OPEN. Blocks §3.1 and the normalizer design.
- **P1 band question** (which band meets algebra vs functions) — decider:
  P1 definition. OPEN; this brief's §2.1 is the research answer, not the
  decision.
- **P4/P7 split** — recorded as agreed in §5; build-time agreement still
  owed if either packet builds.

## 9. Sources

- Common Core State Standards, Mathematics, Expressions & Equations
  domain — http://www.thecorestandards.org/Math/Content/EE/ — accessed
  2026-11-10. (HIGH: primary standards document.)
- Common Core high-school algebra (CCSSM mirror, Oregon Dept. of
  Education) — https://www.oregon.gov/ode/educator-resources/standards/mathematics/Documents/ccssma.pdf — accessed 2026-11-10. (HIGH.)
- Physics formula list (v = d/t, F = m·a, KE = ½mv², W = F·d,
  PE = m·g·h) — https://www.toolscoops.com/2025/10/physics-formula-calculator-free-online.html — accessed 2026-11-10. (MEDIUM: formula
  aggregator, not a primary textbook; the formulas themselves are
  standard textbook relations. The educator's sign-off in §6.6 is the
  correctness check.)
- NGSS adoption context — ~20 states adopted outright, ~24 more use
  Framework-based standards; 44 states implemented Framework/NGSS-
  influenced standards (NSTA, "Ten Years of NGSS", 2023) —
  https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now — accessed 2026-11-10.
  (MEDIUM for "what a given school teaches"; HIGH for the NGSS itself.)
- Inputs: `meridian-scaling-lens-breakdown.md` §3 (P4);
  `meridian-scaling-work-packets.md` P4;
  `meridian-scaling-spec-breakdown.md` §3 P4.
