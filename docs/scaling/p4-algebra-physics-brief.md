# P4 — Algebra Applied in Physics · Definition Brief

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**
**Packet:** P4 · **Branch (for the future build):** `feat/algebra-physics`
**Definition branch:** `feat/science-definitions` · **Date:** 2026-11-10
**Gating:** P3 landed + this definition signed + educator sign-off on file.
Build is NOT GO until all three hold. This brief prepares the definition;
it does not clear the gate.

> Nothing in this brief is approved. A named educator must sign the items
> in §6 in writing before P4 can build. No educator exists yet.
> The scientist seat is the Spatial Data Scientist persona, disclosed in
> §11. It cannot sign.

**Age groups (standard §1).** `7-10` (grades 2–5), `10-18` (grades 5–12),
`18+` (adults). Grade 5 may sit in either of the first two groups. P4's
skill is algebra, so **there is no algebra item in `7-10`** (standard §1;
`subject-progression-map.md`: no 7-10 round uses algebra or trigonometry).
The concrete "which trip is faster" picture, with no letters and no
formula, lives in P7, not here. `18+` uses the same high-school standards
as the top of `10-18`, with harder cases and adult copy. The game never
asks for an exact age.

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

- **`7-10` (grades 2–5): not in scope for algebra.** No letters standing
  for numbers, no trigonometry. This follows CCSS (EE starts at grade 6)
  and standard §1. It is not a hole to fill with an easier equation.
- **`10-18`, standard grades 6–7:** one-step and two-step linear equations;
  equivalent expressions. Algebra Detective's core. Grade 5 is not pulled
  up into this.
- **`10-18`, standard grade 8:** linear equations, systems (two
  equations), functions as models — Function Lab lives here at the
  earliest, and only if the educator agrees.
- **`10-18`, standard grades 9–12, and the whole `18+` group:** full
  algebra. Function Lab's home is this band per the lens breakdown;
  grade 8 is the earliest the educator may allow. `18+` does not add a
  new curriculum. It adds harder cases and adult wording.

**OPEN (not this brief's to invent):** which band meets algebra vs
functions is a P1-definition question (Q1/Q3 family). This brief records
the CCSS-derived map as the research answer for the educator to sign or
correct — it does not decide it.

### 2.2 Physics topics per group (NGSS physical science only)

Every formula below is a quantity the algebra acts on. A formula is in
the table only when a source states it. An NGSS code is attached only
when the performance expectation is actually about that relationship.
Where the PE does not print the symbols, the code is not pretended to be
the formula.

No life-science code. 5-PS3-1 is cut even though it begins with PS: its
text is energy in animals' food (see the scope spec §11).

| Group | Standard's grade | Topic the child solves | Formula on screen | Standard | Source |
|---|---|---|---|---|---|
| 7-10 | — | None. Algebra is out of this group. | — | — | Standard §1 |
| 10-18 | 6 | How long a trip takes at a steady speed, or what the speed was | v = d / t | CCSS 6.RP.A.3b (unit rate, constant speed). Not an NGSS formula. | https://www.thecorestandards.org/Math/Content/RP/ — accessed 2026-11-10 |
| 10-18 | 6–8 | How a bigger push, or a heavier object, changes the motion. Compare and predict. Do not rearrange F = ma. | No equation in this grade band | MS-PS2-2. MS-PS2-1 is Newton's **third** law (collisions), not the second, and is not this row. | MS-PS2-2: https://www.nextgenscience.org/disciplinary-core-idea/ps2a-forces-and-motion — accessed 2026-11-10. MS-PS2-1: https://my.nsta.org/ngss/DisplayStandard?view=pe&id=148 — accessed 2026-11-10 |
| 10-18 and 18+ | 9–12 | Net force, mass, and acceleration, one dimension | F = m · a | HS-PS2-1. The clarification names an object rolling down a ramp. | https://www.nextgenscience.org/sites/ngss/files/HS-PS2-1_Evidence%20Statements%20Jan%202015.pdf — accessed 2026-11-10. Formula symbols: toolscoops, MEDIUM, URL in §9 |
| 10-18 and 18+ | 9–12 | Kinetic energy from mass and speed | KE = ½ m v² | HS-PS3-1 (a computational energy model). The PE does not print these symbols. The DCI says kinetic energy depends on mass and speed. | PE text: https://my.nsta.org/ngss/DisplayStandard.aspx?view=topic&id=43 — accessed 2026-11-10. Symbols: toolscoops, MEDIUM |
| 10-18 and 18+ | 9–12 | Stored energy from height | PE = m · g · h | HS-PS3-2 (energy of motion and of relative position). MS-PS3-2 says assessment is **not** a calculation of potential energy, so this formula is not grades 6–8. Symbols are the textbook form, not the PE's own text. | Same NSTA topic page. Symbols: toolscoops, MEDIUM |
| 10-18 and 18+ | 9–12 | Work when the push is along the motion | W = F · d | **UNVERIFIED as an NGSS code.** No PE consulted for this update states W = F·d. The formula stays a textbook relation until the educator names a code or drops the row. | toolscoops, MEDIUM (URL in §9) |

**Earlier error, corrected here.** The previous table put F = m·a, W = F·d
on grades 6–8 under "MS-PS2-1/2 (Newton's second law)". MS-PS2-1 is the
third law. The second-law relationship in NGSS is HS-PS2-1. Grades 6–8
stay qualitative.

**Uniform-acceleration formulas** (v = u + at, s = ut + ½at², v² = u² + 2as)
were in the previous table under HS-PS2-1. HS-PS2-1 does not print them.
They are **out** until a source is named. Not moved, not renamed.

**Scope discipline:** P4's physics is *quantities in formulas only*, and
only in `10-18` and `18+`. Qualitative forces and motion — what happens
when the ramp is steeper or friction is higher — belong to P7 (see §5).
No formula appears in both packets' on-screen content. The sine form of
the ramp (OpenStax, cited in the scope spec) is a source for P7's rule,
not a P4 item, and it is never shown in `7-10`.

**Grade 5.** NGSS grade 5 physical science includes matter (5-PS1, see the
P6 brief) and 5-PS2-1 (gravity pulls down; assessment includes no
gravitational formula). 5-PS2-1 is a P7 prediction, not a P4 equation.
5-PS3-1 is cut (biology content). This brief does not invent a grade-5
algebra foothold.

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
- CCSS 6.RP.A.3b (constant speed) —
  https://www.thecorestandards.org/Math/Content/RP/ — accessed 2026-11-10.
- HS-PS2-1 evidence statement (ramp named in the clarification) —
  https://www.nextgenscience.org/sites/ngss/files/HS-PS2-1_Evidence%20Statements%20Jan%202015.pdf
  — accessed 2026-11-10.
- HS-PS3-1 / HS-PS3-2 topic page —
  https://my.nsta.org/ngss/DisplayStandard.aspx?view=topic&id=43 —
  accessed 2026-11-10.
- MS-PS2-1 (third law) —
  https://my.nsta.org/ngss/DisplayStandard?view=pe&id=148 — accessed
  2026-11-10.

## 10. Why first, bridge, use-it-elsewhere (standard §0)

**Why first (`10-18`, grade 6).** Hook, inside 5 seconds: "The bus trip is
180 miles. The bus goes 60 miles each hour. How long is the ride?" Those
three numbers are an illustrative scenario, not a measured trip. A child
who only counts cannot finish it. The one-sentence why, inside a minute:
"Speed is how the clock and the miles fit together. That is why the trip
has a time." Shown by a numeric answer with the unit (hours). Objective:
after this, a child in `10-18` can compute a constant speed or a time from
distance and speed, shown by a correct value plus unit. Standard:
CCSS 6.RP.A.3b.

**Why first (algebra, grades 7–12 and `18+`).** "The same bus went 180
miles in 3 hours at one steady speed. What was that speed?" The letter is
the missing speed. Objective: after this, the player can solve a one-step
linear equation whose unknown is a physical quantity, shown by the value
and the unit, without a hint. Standard: 7.EE.B.4a for the equation shape;
HS-PS2-1 when the unknown is a force or an acceleration (grades 9–12 and
`18+` only).

**Bridge.** Builds on fractions, rates, and big numbers (map steps M2 and
M3) before M4. Does not build on a physics unit the child has not had.
`7-10` is not given a bridge into algebra.

**Use it elsewhere** (cross-application web; not built, named so the
educator can sign the intent):
- the same rate prices a stall (money: price × quantity) — everyday
  arithmetic, no policy;
- the same equation times a trip between two places on the map
  (geography);
- force and energy formulas stay inside physics and are not re-taught as
  a chemistry rate. Chemistry rates are `10-18` / `18+` only and are
  P6's pointer, not a second problem bank here.

**Loop.** Hook → predict the value → see the check (the world states the
quantity; it does not lecture first) → one or two sentences of why → one
retry with a hint, then the review deck. No timer in any group unless the
player opts in. No timer control is offered to `7-10` because `7-10` has
no item.

**Mastery.** Confident = exact answer, with unit, and no hint (standard
§4, math bar).

## 11. Scientist seat (disclosed)

The scientist seat on this brief is the Spatial Data Scientist persona.
Imperfect fit: spatial statistics, not algebra or physics. It may ask
whether a row has a source. It does not certify F = m·a, and it cannot
sign the rubric in `docs/scaling/educator-gate-rubric.md`.

## 12. K-12 standard checklist (standard §9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] §10
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] bridge named; the playable check is specified, not built
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] §10 (money, geography)
- Bands served: [x] 10-18 and 18+. 7-10 excluded on purpose (no algebra)
- Objective per item, observable verb, "shown by": [x] §10 for the trip items; the rest of the bank is not written
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] §2. W = F·d is UNVERIFIED as an NGSS code
- Loop mapped: hook / predict / see / explain / retry: [x] §10
- Mastery "confident" bar for this subject: [x] exact answer, with unit, no hint
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts.md I2)
- Post-clip retrieval check (journal + any video): [x] no clip in this packet
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] a formula check does not need three.js; if a ramp is shown it uses P7's tiers and the same answer
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] tap or keyboard to enter or pick a value; no drag; read-aloud available; no timer by default
- Privacy: no PII, no identifiers, local-only records: [x]
- Content screen (§7a) passed; cut items logged with reason: [x] 5-PS3-1 and the mis-cited grades 6–8 formulas removed; no religion, sexuality, or contested politics
- Free: no revenue features; asset licences recorded: [x] no new asset
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] block below; NOT signed
```

## 13. Educator sign-off (empty)

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/p4-algebra-physics-brief.md (this commit)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

The §6 list is still what they sign. This block is not a signature.

