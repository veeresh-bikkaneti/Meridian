# P7 — Science Map (World That Responds) · Definition Brief

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**
**Packet:** P7 · **Branch (for the future build):** `feat/science-map`
**Definition branch:** `feat/science-definitions` · **Date:** 2026-11-10
**Gating:** P2 landed INCLUDING the simulation spike + this definition
signed + science educator sign-off on file. Build is NOT GO until all
hold. This brief prepares the definition; it does not clear the gate.

> Nothing in this brief is approved. A named science educator must sign
> the items in §6 in writing before P7 can build. No educator exists yet.
> The simulation rules are a subject-matter claim, not a code claim.

## 1. What P7 is

Science as a world that responds — not a quiz. A child acts on a small
simulation and sees the consequence: a plant wilts when water is missing,
a food web collapses when a link is removed, a droplet journeys through
the water cycle. The play surface is a living world, not a question card.
All four council seats endorse the responsive-world framing; three demand
the simulation question be answered early — hence the simulation spike in
P2, before math lands its shell contracts.

**One world first.** The description's science ideas (Plant Lab, Water
Cycle Journey, Food Web Weaver, Animal Homes, Body Quest, Element
Detective, Physics Playground, Cell Explorer) are proposals for the
definition to choose from. The definition chooses **ONE responsive system
first**. Do not build all eight at once. This brief recommends the choice
in §4; the educator confirms or changes it.

## 2. Topic map per band

Reference curriculum: **NGSS** (life science LS, earth/space science ESS,
physical science PS). Same caveat as the sibling briefs: NGSS is the
research reference, not the decided curriculum (Q1, OPEN); about 20
states adopted it outright, ~24 more use Framework-based standards, 44
states implemented Framework/NGSS-influenced standards (NSTA, "Ten Years
of NGSS", 2023 —
https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now — accessed 2026-11-10).
Texas and a few other states use their own frameworks. The signing
educator must confirm the jurisdiction.

| Band | Topics in scope (NGSS anchor) | Source |
|---|---|---|
| Grade 5 | Plants get materials for growth chiefly from air and water (5-LS1-1); movement of matter among plants, animals, decomposers, environment — food webs (5-LS2-1); Earth's systems interact — geosphere/biosphere/hydrosphere/atmosphere (5-ESS2-1); distribution of water on Earth — salt vs fresh water (5-ESS2-2); energy in food was once energy from the sun (5-PS3-1). | NGSS grade-5 DCI document (CA Dept. of Education, revised March 2015) — https://files.ecatholic.com/34356/documents/2025/7/5th%20Grade_NGSS%20Standards_DCI_mar2015.pdf — accessed 2026-11-10; InnerOrbit NGSS index — https://prometheus.innerorbit.com/ngss/standards/ — accessed 2026-11-10 |
| Grades 6–8 | Factors affecting plant growth (MS-LS1-5); effects of resource availability on organisms/populations (MS-LS2-1); interdependent relationships in ecosystems (MS-LS2-2); cycling of matter and flow of energy among living and nonliving parts (MS-LS2-3); water cycle driven by sun's energy and gravity (MS-ESS2-4); forces and motion — qualitative (MS-PS2-1/2); energy transfer (MS-PS3). | InnerOrbit NGSS index, same URL — accessed 2026-11-10; CA CDE NGSS listing — https://www2.cde.ca.gov/cacs/science — accessed 2026-11-10 |
| Grades 9–12 | Ecosystem dynamics and resilience (HS-LS2-6/7); energy flow and matter cycling at system scale (HS-LS2-3/4/5); Earth's systems and climate (HS-ESS2/3); forces, motion, energy — quantitative (HS-PS2/3). | NGSS HS standards (CA CDE NGSS listing, same URL) — accessed 2026-11-10 |

**Topics NOT in this brief's map:** human body systems in detail (Body
Quest) and cell biology (Cell Explorer) are **deferred candidates**, not
in the first-world scope — they need their own rule sets and their own
educator sign-off, and the one-world-first rule forbids bundling them in.
They are recorded as candidates, not as content.

## 3. Simulation rules as data

Every cause → effect rule is a checked data row with a source. A rule
with no source is UNVERIFIED and must not ship. No improvised outcomes.
The table below is the **rule-shape definition** (the columns and the
verification standard), with three worked example rows drawn from the
grade-5 anchors. The full rule set is build work, gated by the educator's
signature.

| Field | Meaning |
|---|---|
| `rule_id` | Stable id, e.g. `plant.no-water.wilts` |
| `cause` | The child's action / the state change (e.g. "no water for 3 days") |
| `effect` | The visible consequence (e.g. "plant wilts; leaves droop") |
| `source` | Primary science source (HIGH) or published standard (MEDIUM) — URL + date |
| `band` | Which band may meet this rule |
| `ngss` | The performance expectation it serves |

**Example rows (grade 5, from 5-LS1-1 / 5-LS2-1 / 5-ESS2):**

| rule_id | cause | effect | source | band | ngss |
|---|---|---|---|---|---|
| `plant.no-water.wilts` | Water withheld from a growing plant | Plant wilts; growth stops (plant matter comes chiefly from air and water, not soil — so withholding water, not soil, is what starves it) | NGSS 5-LS1-1 DCI: "plants get the materials they need for growth chiefly from air and water"; CA grade-5 DCI doc, same URL as §2 | 5 | 5-LS1-1 |
| `foodweb.remove-producer.collapse` | Producer (grass) removed from a food web | Herbivores lose food; their populations fall; predators that eat them fall in turn | NGSS 5-LS2-1: "develop a model to describe the movement of matter among plants, animals, decomposers, and the environment" — InnerOrbit index, same URL as §2 | 5 | 5-LS2-1 |
| `water.heat.evaporates` | Sun heats surface water | Water evaporates, rises, cools, condenses, falls as precipitation — the cycle continues | NGSS MS-ESS2-4: "the cycling of water through Earth's systems driven by energy from the sun and the force of gravity" — InnerOrbit index | 6–8 | MS-ESS2-4 |

**Confidence note:** the example rows are HIGH for the NGSS anchor text
and MEDIUM for the specific cause→effect wording — the wording is the
definition's paraphrase of the standard, and the signing educator must
confirm each row is a correct, non-misleading statement of the science.
A wrong simulation rule taught fluently is the silent failure this packet
cannot absorb; the verification gate (§5) is the mitigation.

## 4. The first world — recommendation

**Recommendation: Plant Lab first** (grade-5 band, 5-LS1-1 + 5-LS2-1),
with Food Web Weaver as the second world (not built in the same packet).

Reasons, stated for the educator to accept or reject:

1. Plant Lab's rules are the simplest verified set (water/air/light →
   growth or wilt) and sit in the youngest band Meridian serves (5th
   grade and up), so it reaches the whole audience.
2. It shares rules with the food-web world (producers are the base of
   5-LS2-1), so the second world reuses verified rules instead of
   starting from zero.
3. Water Cycle Journey is the strongest second-system candidate after
   Plant Lab (MS-ESS2-4), but it belongs to the 6–8 band — it narrows the
   audience if built first.

**This is a recommendation, not a decision.** The definition chooses one
world; the educator signs the choice. If the educator picks Food Web
Weaver or Water Cycle Journey instead, this brief is amended — the packet
does not build two worlds at once either way.

## 5. Judging rule — predict-then-see

1. The child **predicts** (what will happen if I do X?), then **tests**
   (do X, watch the world). Prediction and outcome are two distinct,
   visible moments.
2. The prediction is judged against the checked rule row (§3): right
   prediction / wrong prediction / near-miss (right direction, wrong
   magnitude or mechanism — e.g. predicts the plant wilts but says it is
   the soil that starves it).
3. The fail state is the world responding wrongly when the child is
   wrong — visibly, not as a score penalty alone. A plant that thrives
   when the child predicted wilt is a visible contradiction the game must
   show, not a number going down.
4. **No quiz surface.** A quiz with science words is dismissed — do not
   mock one, do not build one.
5. **No LLM near the data.** Outcomes come from the checked rule rows,
   never from model output.

### Judging test plan

A test walks: right prediction; wrong prediction; near-miss; and a
load-failure mid-experiment (simulation state survives — retry + state
preserved; failure never eats progress). A judging rule no test walks is
UNVERIFIED.

## 6. Machine-verification gate

1. **P2 simulation spike first.** Does the spike prove the shell contract
   can carry a responsive world? If it does not, this packet waits for a
   contract revision — it must not build a second, parallel engine in its
   own branch. Status: the spike does not exist yet (Q11, owner-only).
2. **Rules as checked data** (§3). Every rule a data row with a source.
3. **State survives load failure** — the failure path is tested, not
   described.
4. **Load budget** — measured numbers from P2. No numbers exist yet —
   UNVERIFIED until P2 lands.
5. **P4/P7 split agreed** — see §7.

## 7. P4/P7 physics split (agreed definition statement)

> **P4 = algebra applied to physics quantities** (solve for x in a
> formula: speed, force, energy). **P7 = predict-what-happens
> forces/motion** (act on a simulation and see the consequence: push it,
> drop it, remove a link — what happens?).

This split is recorded here and in the P4 brief. Physics Playground (one
of the description's eight ideas) therefore splits in two by nature: its
quantitative side (solve for the speed/force) is P4; its predictive side
(what happens when you push harder?) is P7. Neither packet builds the
other's half. If either packet's build finds the split unworkable, the
change is a definition amendment agreed by both packets and the educator.

## 8. What the educator must sign (listed, not signed)

No educator exists. Nothing below is signed. The named human educator /
SME (a **science educator**) must sign IN WRITING, before P7 can build:

1. The science topic map per band (§2).
2. The simulation rules (§3) — the simulation's correctness is a
   subject-matter claim, not a code claim.
3. The judging rule for this subject (§5).
4. The machine-verification gate (§6), demonstrated on one complete mode.
5. The first-world choice (§4) — Plant Lab, or the educator's alternative.

## 9. Readiness audit — four points, assessed honestly

| # | Point | Status |
|---|---|---|
| (i) | Named curriculum + topic map | NOT DEMONSTRATED — map researched from NGSS (§2), but no curriculum is named by the owner (Q1 OPEN) and no educator has signed. |
| (ii) | Machine-verifiable judging | NOT DEMONSTRATED — rule specified in §5; rule rows exist only as three examples (§3); the engine does not exist yet. |
| (iii) | Correctness without an LLM near the data | SPECIFIED, NOT DEMONSTRATED — the simulation-rules data is the mechanism (§3); the data set does not exist yet. |
| (iv) | Core verb a child gets just by looking | NOT DEMONSTRATED — no mockup exists; one world must be mocked first at 390px and 1280px, per-band, and pass "a child gets it just by looking" with a playtest, not an assertion. |

## 10. Open questions

- **Q11** (science spike authorization) — decider: owner only. OPEN.
  Blocks the spike (§6.1) and therefore P7's entire gate.
- **Q1** (educator + curriculum) — decider: owner. OPEN. Blocks the
  signature in §8.
- **P4/P7 split** — recorded as agreed in §7; build-time agreement still
  owed if either packet builds.
- **First-world choice** — decider: signing educator. OPEN (§4 is a
  recommendation, not a decision).
- **Body Quest / Cell Explorer** — deferred candidates (§2). Decider:
  educator + owner, in a later definition; not this packet's content.

## 11. Sources

- NGSS grade-5 DCI document (CA Dept. of Education, revised March 2015)
  — https://files.ecatholic.com/34356/documents/2025/7/5th%20Grade_NGSS%20Standards_DCI_mar2015.pdf — accessed 2026-11-10.
  (HIGH: verbatim DCI text, including 5-LS1-1 "plants get the materials
  they need for growth chiefly from air and water" and 5-LS2-1.)
- InnerOrbit NGSS standards index —
  https://prometheus.innerorbit.com/ngss/standards/ — accessed
  2026-11-10. (MEDIUM: third-party index quoting the official PEs
  verbatim — 5-ESS2-1/2, 5-LS1-1, 5-LS2-1, MS-LS1-5, MS-LS2-1/2/3,
  MS-ESS2-4.)
- CA Dept. of Education NGSS content-standards listing —
  https://www2.cde.ca.gov/cacs/science — accessed 2026-11-10. (HIGH.)
- NGSS adoption context — NSTA, "Ten Years of NGSS" (2023) —
  https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now — accessed 2026-11-10.
- Inputs: `meridian-scaling-lens-breakdown.md` §6 (P7);
  `meridian-scaling-work-packets.md` P7;
  `meridian-scaling-spec-breakdown.md` §3 P7.
