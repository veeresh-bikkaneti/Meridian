# P7 — Science Map (World That Responds) · Definition Brief

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF**
**Packet:** P7 · **Branch (for the future build):** `feat/science-map`
**Definition branch:** `feat/science-definitions` · **Date:** 2026-11-10
**Gating:** this definition signed by a named science educator, in writing,
and the owner lifts the build gate. Build is NOT GO. This brief prepares
the definition. It does not clear the gate.

> Nothing in this brief is approved. The simulation rules are a
> subject-matter claim, not a code claim. The scientist seat is the
> Spatial Data Scientist persona (§12). It cannot sign.

**Age groups (standard §1):** `7-10`, `10-18`, `18+`. No algebra and no
trigonometry on a `7-10` screen. Grade 5 (5-PS2-1) may sit in `7-10` or
as a bridge in `10-18`. The game never asks for an exact age.

## 1. What P7 is

Science as a world that responds — not a quiz. A child acts on a small
simulation and sees the consequence. The play surface is a scene, not a
question card. Predict-then-see is the verb: commit, then watch.

**One world first.** The old list (Plant Lab, Water Cycle Journey, Food
Web Weaver, Animal Homes, Body Quest, Element Detective, Cell Explorer)
is not the first world. Plants, animals, food webs, the body, and cells
are biology. They are cut (standard §2; owner, 2026-11-10). Element
Detective is P6, grades 9–12 and `18+` only. Water cycle stays an
environment link on the chemistry units, not this packet's first system.

The first world is **ramps and friction** (map step Ph1 in
`subject-progression-map.md`). Push, pull, steepness, and friction.
`7-10` sees it with blocks and hills. `10-18` and `18+` see the same
scene with a sharper cause, still as a prediction, not as an equation to
rearrange. Equations are P4.

## 2. Topic map (NGSS physical science, plus one earth-science link)

NGSS is the research reference, not the owner's chosen curriculum
(Q1, OPEN). About 20 states adopted it outright; about 24 more use
Framework-based standards; 44 states implemented standards influenced by
the Framework and/or NGSS (NSTA, "Ten Years of NGSS", 2023 —
https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now
— accessed 2026-11-10). Texas and some other states use their own
frameworks. The signing educator confirms the jurisdiction.

| Group | Standard's grade | What the child predicts | Code | Source (accessed 2026-11-10) |
|---|---|---|---|---|
| 7-10 | 3 | A push from one side starts the block; equal pushes from both sides do not | 3-PS2-1 | https://www.nextgenscience.org/disciplinary-core-idea/ps2a-forces-and-motion |
| 7-10 | 3 | After the block has rolled the same way, the next roll matches that pattern | 3-PS2-2 | Same page |
| 7-10 | 4 | The faster block has more motion energy. No number for the energy. | 4-PS3-1 | https://www.nextgenscience.org/sites/default/files/4th%20Topics%20Model%20Bundle%203_0.pdf |
| 7-10 | 4 | A bump changes how fast the blocks are moving | 4-PS3-3 | Same PDF |
| 7-10 or 10-18 | 5 | A released block moves down, not up | 5-PS2-1 | https://www.nextgenscience.org/search-standards — "Support an argument that the gravitational force exerted by Earth on objects is directed down." No formula. |
| 10-18 | 6–8 | A larger net force, or a smaller mass, changes the motion more. Qualitative. | MS-PS2-2 | Same PS2.A page as 3-PS2-1 |
| 10-18 | 6–8 | Higher on the ramp means more stored energy, compared, not calculated | MS-PS3-2 | https://www.nextgenscience.org/dci-arrangement/ms-ps3-energy — the clarification names a roller-coaster cart at different points on a hill, and says not to calculate potential energy |
| 10-18 and 18+ | 9–12 | The ramp is the setting for net force, mass, and acceleration. The child predicts the direction of the change. P4 owns rearranging F = m·a. | HS-PS2-1 | https://www.nextgenscience.org/sites/ngss/files/HS-PS2-1_Evidence%20Statements%20Jan%202015.pdf — clarification includes "an object rolling down a ramp" |

**Environment link (not a second world).** Steeper ground moves loose rock
downhill faster. Cite 4-ESS2-1 only for water, ice, wind, gravity, and
slope angle (the clarification names "angle of slope in the downhill
movement of water"). Do not teach vegetation or living organisms. Source:
https://my.nsta.org/ngss/DisplayStandard.aspx?view=pe&id=83 — accessed
2026-11-10. The living-things clauses are cut in §11.

**Not in this map:** any LS code, 5-PS3-1 (animals' food), kindergarten
K-PS2 (under 7), and any formula on a `7-10` screen.

## 3. Simulation rules as data

Every cause → effect rule is a checked row with a source. A rule with no
source does not ship. The table is the shape. Three rows are the first
world. Wording that goes past the quoted standard is MEDIUM and is for
the educator to confirm or reject. HIGH means the sentence is the
standard's or the textbook exercise's, not our paraphrase.

| Field | Meaning |
|---|---|
| `rule_id` | Stable id |
| `cause` | What the child sets before the scene plays |
| `effect` | What the scene must show |
| `source` | URL + what it actually says |
| `group` | `7-10`, `10-18`, or `18+` |
| `standard` | Code, or UNVERIFIED |

| rule_id | cause | effect | source | group | standard |
|---|---|---|---|---|---|
| `ramp.one-push.starts` | One push on a resting block; the other side is not pushed | The block starts moving toward the unpushed side | 3-PS2-1 clarification: an unbalanced force on one side of a ball can make it start moving (nextgenscience.org PS2.A page, §2) | 7-10 | 3-PS2-1 |
| `ramp.both-push.stays` | Equal pushes from both sides | The block does not start moving | Same clarification: balanced forces on both sides produce no motion. HIGH for that sentence. | 7-10 | 3-PS2-1 |
| `ramp.steeper.faster` | Same block, two ramps of the same length, one steeper, little friction | The block on the steeper ramp reaches the bottom first and is moving faster there | OpenStax College Physics for AP Courses, ch. 5 problem 8: acceleration down a frictionless incline is a = g sin θ, independent of mass (https://openstax.org/books/college-physics-ap-courses/pages/5-problems-exercises). HIGH for that exercise. MEDIUM for the child sentence "steeper finishes first," which is a reading of sin θ increasing between 0° and 90°. Not an NGSS sentence. | 7-10 sees the race with no formula. 10-18 and 18+ may hear the formula in the explain step. | 3-PS2-2 (predict from a pattern) is the *practice*; the *effect* is the OpenStax exercise, not 3-PS2-2's text |
| `ramp.more-friction.slower` | Same ramp, same block shape, more friction opposing the slide | The block speeds up less, and may not slide | Same OpenStax page, problem 9: a = g (sin θ − μk cos θ). When the friction term is large enough, acceleration is not down the ramp. HIGH for the exercise. MEDIUM for calling the second surface "more friction" rather than a measured μ. | 7-10: "this one is harder to slide." 10-18 and 18+: the explain step may name friction. No μ value is shown, because none is sourced for a real pair of surfaces here. | UNVERIFIED as an NGSS code. MS-PS2-2 is the force-and-mass PE, not a friction formula. |

`ramp.steeper.faster` must not be taught as "3-PS2-2 says steeper is
faster." 3-PS2-2 says a regular pattern lets you predict the next motion.
The steepness effect comes from the OpenStax exercise. The educator
either accepts that split or strikes the row.

## 4. The first world — ramps and friction

**Recommendation: ramps and friction first** (map Ph1), for all three
groups, with one scene and three wordings.

Why, for the educator to accept or reject:

1. It is the predict-then-see system the progression map already assigns
   to P7. The previous recommendation (Plant Lab, 5-LS1-1) is biology and
   is withdrawn.
2. The `7-10` version needs no formula, so the group that cannot have
   algebra still gets the idea.
3. The same scene is the "use it elsewhere" setting for later algebra
   (P4) and, in `10-18` and `18+` only, for the steepness of a ramp. This
   packet does not teach the sine function.

**Why first (`7-10`).** Hook, inside 5 seconds: "The class has to get a
box of books down to the gym. One ramp is steep. One is gentle. Which
one gets the box there first?" Illustrative, not a measured ramp. Why,
inside a minute: "A steeper ramp lets more of the downward pull slide
the box. That is why hills and ramps matter." The "more of the downward
pull" sentence is the MEDIUM reading of the OpenStax exercise in §3, not
a quote from NGSS. Objective: after this, a
child in `7-10` can predict which ramp the box finishes first, shown by
a tap on that ramp before the box moves. Standard: the effect row
`ramp.steeper.faster` (OpenStax), practiced as a prediction (3-PS2-2).

**`10-18` objective.** After this, the player can predict what happens
to the motion when the ramp gets steeper or the friction gets larger,
shown by a tap on the matching outcome before the scene plays. Standard:
MS-PS2-2 for force and mass; HS-PS2-1 at grades 9–12 for the ramp as the
net-force setting. They do not solve for a number in this packet.

**`18+` objective.** After this, an adult can predict the direction of
both changes at once (steeper speeds the block up; more friction slows
it) and can say "it does not slide" when the rule row says friction is
large enough that the block stays. Shown by that tap. No hidden μ and no
invented angle. Copy is adult. Standard: HS-PS2-1.

**Bridge.** `7-10` builds on measurement (map M1): which ramp is taller.
`10-18` and `18+` may also build on rates (M4) when that unit exists.
Builds-on for a `7-10` round does not list M4 (the map forbids it).

**Use it elsewhere.**
- Geography, all groups: the steeper hillside is the one loose rock runs
  down. Environment link in §2. No campaign about land use.
- `10-18` and `18+` only: the same ramp is where algebra (P4) later
  solves for a quantity. That round is P4's, scored there.
- Money: not in this scene. A loading ramp at a shop is everyday, not
  economics policy, and is optional colour, not a second skill.

## 5. Judging rule — predict-then-see

1. The child **predicts** (which outcome?), then **sees** the scene.
   Two distinct moments. Choices are taps (`choices` on the I4 scene).
   No drag.
2. The prediction is judged against the checked row (§3): right, wrong,
   or near-miss (right direction, wrong cause — for example "the steep
   one wins because it is longer" when the ramps were the same length).
3. The fail state is the world doing what the rule says when the child
   predicted the other thing. The steep ramp still wins if that is the
   row. A score change is not a substitute.
4. **No quiz surface.** Do not mock one. Do not build one.
5. **No LLM near the data.** Outcomes come from the rows.
6. **Scene contract.** `PredictSeeScene` in
   `src/scenes/predict-see/types.ts` (contracts.md I4). `mount` loads
   three.js with a dynamic `import("three")` inside the function, not at
   page load. Dispose on exit. Pause when the tab is hidden. The Flat
   tier draws the same rule in 2D: the box still ends on the steeper
   ramp, as a stepped diagram. Learning parity (standard §5.2): same
   question, same cause and effect, same score. Full and Lite may change
   beauty only. Thresholds for picking Full vs Lite stay PROPOSED until
   Phase 0 measures them.

### Motion tiers

| Tier | What the child gets |
|---|---|
| Full | three.js ramp and block, lighting allowed |
| Lite | same scene, low-poly, no shadows, capped at 30 fps |
| Flat | 2D steps, same winner, same words |

`prefers-reduced-motion` uses Flat. Nothing flashes more than 3 times a
second.

### Accessibility and privacy

Tap targets at least 44px. Text equivalent for every spoken prompt.
Read-aloud available; on by default in `7-10`. No timer in `7-10`; timers
off unless the player opts in, in every group. A live region announces
what happened ("The box on the steep ramp got there first"). Colour is
never the only signal. No names, no free text, no account. Records stay
on the device (standard §7).

### Judging test plan

A test walks: right prediction; wrong prediction; near-miss; and a
load-failure mid-slide (state survives; failure never eats progress).
A judging rule no test walks is UNVERIFIED. That test is build work and
is not written while the gate is shut.

## 6. Machine-verification gate

1. **I4 types first.** The shape is `src/scenes/predict-see/types.ts`.
   The shell (renderer, dispose, pause, one demo scene) waits for the
   owner to lift the build gate. This packet must not grow a second
   engine beside I4.
2. **Rules as checked data** (§3). Every shipped row has a source.
3. **State survives load failure** — tested, not described. Not built yet.
4. **Load budget** — no number is claimed. Any budget is PROPOSED until
   measured.
5. **P4/P7 split agreed** — see §7.

## 7. P4/P7 physics split (agreed definition statement)

> **P4 = algebra applied to physics quantities** (solve for x in a
> formula: speed, force, energy), `10-18` and `18+` only.
> **P7 = predict-what-happens forces and motion** (set the ramp or the
> friction, then see the consequence).

Quantitative solving (the speed, the force) is P4. "Which ramp finishes
first?" is P7. Neither packet builds the other's half. A change to the
split is a definition amendment agreed by both packets and the educator.

## 8. What the educator must sign (listed, not signed)

No educator exists. Nothing below is signed. A named human science
educator must sign IN WRITING before P7 can build:

1. The topic map (§2), including the withdrawal of every life-science row.
2. The rule rows (§3), especially the MEDIUM child-facing sentences.
3. The judging rule (§5).
4. The gate (§6), later demonstrated on one mode. Not demonstrated now.
5. The first-world choice (§4): ramps and friction, or the educator's
   non-biology alternative.

## 9. Readiness audit — four points, assessed honestly

| # | Point | Status |
|---|---|---|
| (i) | Named curriculum + topic map | NOT DEMONSTRATED — map researched from NGSS PS and one OpenStax exercise (§2–§3). No curriculum is named by the owner (Q1 OPEN). No educator has signed. |
| (ii) | Machine-verifiable judging | NOT DEMONSTRATED — rule specified in §5; four example rows in §3; no engine. |
| (iii) | Correctness without an LLM near the data | SPECIFIED, NOT DEMONSTRATED — rows are the mechanism. |
| (iv) | Core verb a child gets just by looking | NOT DEMONSTRATED — no mockup. One world must be mocked at 390px and 1280px before build. |

## 10. Open questions

- **Build gate** — decider: owner, told to this branch by the integrator.
  OPEN. Types may ship; the scene may not.
- **Q1** (educator + curriculum) — decider: owner. OPEN.
- **Q11** (science spike) — decider: owner. OPEN. I4 types do not depend
  on it. A measured load budget still does.
- **P4/P7 split** — recorded in §7. Build-time agreement still owed if
  either packet builds.
- **First world** — ramps and friction is the recommendation after the
  biology cut. Decider: signing educator.
- **`ramp.steeper.faster` child wording** — decider: educator. The
  OpenStax exercise is sourced; the sentence "steeper finishes first" is
  MEDIUM.

## 11. Content screen — cut log

| Cut | Why |
|---|---|
| Plant Lab, Food Web Weaver, Animal Homes, Body Quest, Cell Explorer, and the example rows `plant.no-water.wilts` and `foodweb.remove-producer.collapse` | Biology. Owner, 2026-11-10. |
| 5-LS1-1, 5-LS2-1, MS-LS1-5, MS-LS2-1/2/3, HS-LS2-* | Life-science codes. Standard §2. |
| 5-PS3-1 | PS code about energy in animals' food. Biology content. |
| 4-ESS2-1 vegetation and "living organisms" clauses | Must not enter through the environment link. |
| K-PS2 | Under 7. |
| Religion, sexuality and gender identity, current or contested politics | Standard §7a. Not present. |

Water Cycle Journey is not cut as false. It is out of this first world
and remains an environment link on the chemistry units (P6), with no
living things.

## 12. Scientist seat (disclosed)

The scientist seat is the Spatial Data Scientist persona. Imperfect fit:
spatial statistics, not forces and motion. It may check that a rule is a
row with a source. It does not certify the ramp effect, and it cannot
sign `docs/scaling/educator-gate-rubric.md`.

## 13. K-12 standard checklist (standard §9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] §4
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] builds on measurement; the ramp is the application; scene not built
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] hillside / loose rock; algebra pointer is P4, 10-18 and 18+ only
- Bands served: [x] 7-10, 10-18, 18+
- Objective per item, observable verb, "shown by": [x] §4
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] §2 and §3; friction formula is UNVERIFIED as an NGSS code
- Loop mapped: hook / predict / see / explain / retry: [x] §5
- Mastery "confident" bar for this subject: [x] correct prediction on the first try (standard §4)
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts.md I2)
- Post-clip retrieval check (journal + any video): [x] no clip; the prediction is the check
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] §5
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] §5
- Privacy: no PII, no identifiers, local-only records: [x] §5
- Content screen (§7a) passed; cut items logged with reason: [x] §11
- Free: no revenue features; asset licences recorded: [x] no new asset; three.js already in the repo
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] block below; NOT signed
```

## 14. Educator sign-off (empty)

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/p7-science-map-brief.md (this commit)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## 15. Sources

- 3-PS2-1, 3-PS2-2, MS-PS2-2 — https://www.nextgenscience.org/disciplinary-core-idea/ps2a-forces-and-motion — accessed 2026-11-10.
- 5-PS2-1 — https://www.nextgenscience.org/pe/5-ps2-1-motion-and-stability-forces-and-interactions and the search index https://www.nextgenscience.org/search-standards — accessed 2026-11-10. Statement: gravitational force exerted by Earth on objects is directed down. Assessment does not include a mathematical representation.
- 4-PS3-1, 4-PS3-3 — https://www.nextgenscience.org/sites/default/files/4th%20Topics%20Model%20Bundle%203_0.pdf — accessed 2026-11-10.
- MS-PS3-2 — https://www.nextgenscience.org/dci-arrangement/ms-ps3-energy — accessed 2026-11-10.
- HS-PS2-1 — https://www.nextgenscience.org/sites/ngss/files/HS-PS2-1_Evidence%20Statements%20Jan%202015.pdf — accessed 2026-11-10.
- 4-ESS2-1 — https://my.nsta.org/ngss/DisplayStandard.aspx?view=pe&id=83 — accessed 2026-11-10. Living-things clauses cut.
- OpenStax College Physics for AP Courses, chapter 5, problems 8 and 9 — https://openstax.org/books/college-physics-ap-courses/pages/5-problems-exercises — accessed 2026-11-10.
- NSTA, "Ten Years of NGSS" (2023) — https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now — accessed 2026-11-10.
- 5-PS3-1 (cut) — https://www.nextgenscience.org/search-standards?keys=5-PS3-1 — accessed 2026-11-10.
- Map: `docs/scaling/subject-progression-map.md` step Ph1. Standard: `docs/scaling/k12-learning-design-standard.md` §0, §1, §2, §5.2, §7, §7a, §9.
