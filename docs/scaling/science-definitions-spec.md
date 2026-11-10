# Science Definitions — Specification

**Branch:** `feat/science-definitions`
**Workstream:** WS3 of the Meridian scaling-plan push (P4 + P6 + P7)
**Status:** PREPARED — AWAITING EDUCATOR SIGN-OFF
**Date:** 2026-11-10
**Base:** `origin/main` merged at `17620fd3` (grade-range prompts + entry-size check)

> This file is the scope contract for the three science definition briefs on
> this branch, plus the shared predict-then-see type contract. The scene
> engine stays gated. Nothing here is approved.

## 1. What this branch is

Meridian is a free browser geography game
(repo https://github.com/veeresh-bikkaneti/Meridian). Scaling it into a K-12
platform is a **CONDITIONAL GO for definition work and Phase 0 only**
(council verdict 2026-11-07; restated on `main` 2026-11-10: only the math
definition work and the Phase 0 shell split are approved to build).
Subject feature branches are **NOT GO**. This branch prepares definitions
and ships the shared type contract so physics and chemistry can code
against it. It does not build a scene.

The three briefs on this branch:

| Brief | File | Packet |
|---|---|---|
| P4 — Algebra applied in physics | `docs/scaling/p4-algebra-physics-brief.md` | P4 |
| P6 — Chemistry, small honest scope | `docs/scaling/p6-chemistry-brief.md` | P6 |
| P7 — Science map (world that responds) | `docs/scaling/p7-science-map-brief.md` | P7 |

Sources for these briefs (read first, cited in each brief):

- `~/workspace/meridian-scaling-lens-breakdown.md` §3 (P4), §5 (P6), §6 (P7)
- `~/workspace/meridian-scaling-work-packets.md` P4, P6, P7 entries
- `~/workspace/meridian-scaling-spec-breakdown.md` §3 P4/P6/P7 entries

## 2. Scope — in

- Three definition briefs, each carrying: topic map by age group, judging
  rule, machine-verification gate, the standard §9 checklist, and what a
  named educator must sign (listed, not signed).
- Age groups only: `7-10`, `10-18`, `18+` (standard §1). Grade 5 may sit in
  either of the first two groups; each item is tagged with its standard's
  grade. No algebra or trigonometry in `7-10`. The game never asks for an
  exact age.
- NGSS **physical-science (PS)** codes only. Earth-science (ESS) codes only
  where an environment link uses them, and only the non-living clause.
  No life-science (LS) codes and no biology content, including inside a PS
  code whose text is about living things (standard §2; owner, 2026-11-10).
- The disclosed scientist seat (see §10). It is not an educator signature.
- The I4 type contract in `src/scenes/predict-see/types.ts`, copied from
  `docs/scaling/contracts.md` so physics and chemistry can import one shape.
  The file is types only: no scene, no `import("three")`, no demo.
- P6's FIRST deliverable, researched, not assumed: how much chemistry US
  schools teach per band, grounded in live sources (NGSS / state standards).
- The P4/P7 physics split, agreed in writing as a definition statement
  (P4 = algebra applied to physics quantities; P7 = predict-what-happens
  forces/motion). The split is a definition claim both packets record; it is
  not a build decision.
- Every research/factual claim carries a live web source (URL + date
  accessed) or an explicit confidence level (HIGH / MEDIUM / LOW with the
  evidence that earns it). A claim without one is not done.
- Open owner questions recorded as open, never settled.

## 3. Scope — out (hard stops)

1. **No merges, no force-push, no push except this branch.** A draft PR is
   opened when the task says so. Merging stays the integrator's act on the
   owner's word. This replaces the earlier "no PRs" line in this file.
2. **No scene or subject-game code until the owner lifts this branch's
   build gate.** Allowed now, and only this: `src/scenes/predict-see/types.ts`.
   No renderer, no demo scene, no test harness committed, no UI.
3. **No educator sign-off.** No educator exists; nothing in these briefs is
   "approved". Every brief is marked **PREPARED — AWAITING EDUCATOR
   SIGN-OFF**. Never write "approved". The Spatial Data Scientist persona
   cannot sign the rubric.
4. **No invented scope.** Where the source material has no answer (e.g. a
   band assignment with no curriculum citation), the brief records it as
   OPEN / UNVERIFIED and does not guess.
5. **No settling owner questions.** Open questions are recorded with their
   decider named; the briefs do not decide them.
6. **No biology, no religion or mythology, no sexuality or gender identity,
   no current or contested politics** (standard §7a). When in doubt, leave
   it out. Cut items are logged, not softened.

## 4. What counts as done

- [ ] This spec file committed and pushed to `feat/science-definitions`.
- [ ] Three briefs updated, one per packet (P4, P6, P7), each containing:
  - Topic map by group (`7-10`, `10-18`, `18+`), with a curriculum citation
    per item or an explicit UNVERIFIED flag.
  - The standard §9 checklist, filled honestly (checked only where the
    definition actually meets the line).
  - Judging rule stated precisely enough that a test could walk it.
  - Machine-verification gate.
  - Educator sign-off list, listed, not signed, plus the empty sign-off
    block from `educator-gate-rubric.md`.
  - Readiness-audit four points assessed honestly.
  - Open questions recorded with decider.
  - Scientist-seat disclosure (imperfect fit; cannot sign).
- [ ] NGSS citations are physical-science codes, plus ESS only as an
  environment link with living-things clauses cut. No LS codes remain.
- [ ] `src/scenes/predict-see/types.ts` matches contract I4 and is committed
  on its own, before any scene code.
- [ ] P4/P7 physics split still recorded in both briefs.
- [ ] Scene engine (three.js shell, tiers, dispose, pause, ramps demo) NOT
  built — build gate not lifted.
- [ ] Branch status file updated. Draft PR open. Branch not merged.

## 5. Verification block

Verification rule (Meridian standing rule, from the lens breakdown §0
forcing rule, applied to definition work): before any question in a brief
is answered, (1) a live web search grounds the answer — answering from
memory alone is forbidden; (2) every key fact carries a named site source
(URL + access date) or an explicit confidence level HIGH / MEDIUM / LOW;
(3) any fact with no source is recorded UNVERIFIED and never asserted;
(4) time-sensitive facts are re-checked against a current source.

**Sources used (accessed 2026-11-10):**

- NGSS performance expectations PS1 (Matter and Its Interactions), via
  California Dept. of Education content-standards listing
  (https://www2.cde.ca.gov/cacs/science) — 2-PS1-3 (grade 2), 5-PS1-1
  (grade 5), MS-PS1-1/2/5/6 (grades 6–8), HS-PS1-1/2/5 (grades 9–12).
  Accessed 2026-11-10.
- NGSS forces and motion, physical science only, accessed 2026-11-10:
  3-PS2-1 and 3-PS2-2 (https://www.nextgenscience.org/disciplinary-core-idea/ps2a-forces-and-motion);
  5-PS2-1 "Support an argument that the gravitational force exerted by
  Earth on objects is directed down" (https://www.nextgenscience.org/search-standards);
  4-PS3-1 and 4-PS3-3
  (https://www.nextgenscience.org/sites/default/files/4th%20Topics%20Model%20Bundle%203_0.pdf);
  MS-PS2-2 on the same PS2.A page; MS-PS2-1 is Newton's third law, not
  the second (https://my.nsta.org/ngss/DisplayStandard?view=pe&id=148);
  HS-PS2-1, ramp named in the clarification
  (https://www.nextgenscience.org/sites/ngss/files/HS-PS2-1_Evidence%20Statements%20Jan%202015.pdf);
  HS-PS3-1 and HS-PS3-2
  (https://my.nsta.org/ngss/DisplayStandard.aspx?view=topic&id=43).
- **Cut, not cited as content:** 5-PS3-1. The code is PS, but the
  expectation is energy in animals' food that was once energy from the
  sun, and the DCI brings in plants (https://www.nextgenscience.org/dci-arrangement/5-ps3-energy
  and https://www.nextgenscience.org/search-standards?keys=5-PS3-1).
  That is biology. It is logged in §11 and does not appear in a topic map.
- **Cut:** every LS code previously listed here (5-LS1-1, 5-LS2-1,
  MS-LS2-1/2/3). Life science is out (owner, 2026-11-10; standard §2).
- Earth-science environment link only: 4-ESS2-1, and only water, ice,
  wind, gravity, and slope angle. The vegetation and living-organism
  clauses are cut (https://my.nsta.org/ngss/DisplayStandard.aspx?view=pe&id=83).
  MS-ESS2-4 (water cycle driven by the sun and gravity) stays as a
  chemistry environment link, with no living things.
- NGSS adoption: ~20 states adopted outright, ~24 more use Framework-based
  standards; 44 states have implemented standards influenced by the
  Framework and/or NGSS (NSTA, "Ten Years of NGSS", 2023;
  https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now).
- US science curriculum by band (TIMSS 2015 Encyclopedia, US chapter;
  http://timss2015.org/encyclopedia/countries/united-states/the-science-curriculum-in-primary-and-lower-secondary-grades/):
  upper-elementary physical science = states of matter and their
  properties, classifying materials; middle school = changes of state,
  solutions, simple chemical reactions; National Science Education
  Standards progression from macroscopic observation (elementary) to
  atoms/molecules/formulas (high school).
- Common Core mathematics, Expressions & Equations domain
  (http://www.thecorestandards.org/Math/Content/EE/): 6.EE (one-variable
  equations x + p = q, px = q), 7.EE (equivalent expressions, multi-step
  equations px + q = r, p(x + q) = r), 8.EE (linear equations, systems),
  8.F (functions defined, evaluated, compared, used to model).
  Constant speed as a unit rate: 6.RP.A.3b
  (https://www.thecorestandards.org/Math/Content/RP/) — accessed 2026-11-10.
- Earth-science environment link, non-living clause only: MS-ESS2-4, the
  cycling of water driven by energy from the sun and gravity (already in
  the P6 brief's sources). 4-ESS2-1 is cited in P7 only for water, ice,
  wind, gravity, and slope angle; vegetation and living organisms are cut.
- Ramp relation (textbook exercise, not an NGSS sentence): acceleration
  down a frictionless incline is a = g sin θ; with simple friction,
  a = g (sin θ − μk cos θ). OpenStax College Physics for AP Courses,
  chapter 5 problems 8 and 9 —
  https://openstax.org/books/college-physics-ap-courses/pages/5-problems-exercises
  — accessed 2026-11-10. HIGH for those two exercise statements. The
  child-facing words "steeper finishes first" are a reading of them
  (MEDIUM) and the educator must confirm they are not misleading.
- Physics formulas used as algebra targets (MEDIUM — formula aggregator,
  not a primary textbook): v = d/t, F = m·a, KE = ½mv², W = F·d,
  PE = m·g·h
  (https://www.toolscoops.com/2025/10/physics-formula-calculator-free-online.html,
  accessed 2026-11-10). Where an NGSS PE does not print the symbols, the
  brief says so and does not pretend the PE is the formula.

**Confidence note:** NGSS is the reference curriculum for these briefs
because it is the national framework most states use or adapt — but it is
NOT universal: Texas and a few other states use their own frameworks, and
adoption depth varies. Every NGSS citation below is therefore a HIGH
confidence claim about *the NGSS*, and a MEDIUM claim about *what a given
child's school teaches*. The educator who signs must confirm the
jurisdiction. A web search grounds facts; it does not certify a
curriculum — that is the educator's signature, and it does not exist yet.

## 6. Gates each brief must clear before any build (recorded, not cleared)

Per the packets, each of P4/P6/P7 is GATED. Build needs, in each case:

- P2 landed (P7 additionally needs P2's simulation spike to exist and the
  shell contract to hold against it).
- P4 additionally needs P3 landed.
- This branch's definition signed by a named educator (in writing).
- The readiness audit's four points demonstrated (curriculum + topic map;
  machine-verifiable judging; correctness without an LLM near the data;
  core verb a child gets just by looking).

**None of these gates is cleared by this branch.** Shipping
`src/scenes/predict-see/types.ts` is the I4 shape only. It is not a scene,
not a subject module, and not a lifted build gate. The ramps-and-friction
engine waits until the integrator says the owner has lifted the gate.

## 7. Open owner questions (recorded — not settled here)

| # | Question | Decider | Status |
|---|---|---|---|
| Q1 | Educator + curriculum: who is the named educator/SME, and which curriculum is the reference? | Owner | OPEN — no educator exists; no curriculum is named by the owner. NGSS is used in these briefs as the research reference only, not as a decided curriculum. |
| Q3 | Equivalent-form judging: is `2x + 6` the same as `2(x + 3)`? | P1 definition + educator | OPEN |
| Q11 | Science spike authorization (P2 simulation spike that P7 depends on) | Owner only | OPEN |
| Q14 | Lazy-load guardrail | Owner | OPEN — no written answer from the owner |
| Q15 | Passport (per the task brief) | Owner | OPEN — no written answer from the owner |
| P8 gate | P8's gate names v3 but the keeper is v4 — does the owner's listen-approval of v4 satisfy the gate? | Owner | OPEN — recorded here because it affects the scaling plan's gate language; not this workstream's to resolve |
| Constitution-first | Constitution-first ordering is conditional — if a single-jurisdiction constitution clears audit before math, build order changes | Owner / council | OPEN (conditional, not a commitment) |
| P4/P7 split | Is the split "P4 = algebra applied to physics quantities; P7 = predict-what-happens forces/motion" agreed? | Definition (both packets) | RECORDED as the agreed definition statement in both briefs; a build-time agreement is still owed when/if either packet builds |

## 8. Branch hygiene

- Named files only when staging — never `git add -A`.
- Commit early, push often. Push only `feat/science-definitions`.
- The branch stays open until dev work is complete. A merged PR does not
  close it.

## 9. K-12 standard checklist (standard §9)

Filled for this scope contract. Each brief carries its own copy. A box is
checked only where the definition states the thing. "Not built" means the
line is specified and the build gate is still shut.

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] stated in P4, P6, and P7; not yet a playable screen
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] bridges named against subject-progression-map.md; the playable scene is gated
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] named in each brief; not yet dealt from the review deck
- Bands served: [x] 7-10, 10-18, 18+ — P4 has no algebra item in 7-10 (standard §1)
- Objective per item, observable verb, "shown by": [x] in the briefs for the items this update defines
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] PS, CCSS, or UNVERIFIED; no LS
- Loop mapped: hook / predict / see / explain / retry: [x] P6 and P7; P4 uses the same loop on an equation, not a quiz
- Mastery "confident" bar for this subject: [x] science = correct prediction on first try; algebra = exact answer without a hint (standard §4)
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts.md I2). Misses stay in module state until then
- Post-clip retrieval check (journal + any video): [x] no journal clip in these three packets; a video with no check would be out of scope
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] P7; same learning, beauty may change (standard §5.2)
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] specified for the predict-then-see scene (tap choices, no drag, no timer in 7-10)
- Privacy: no PII, no identifiers, local-only records: [x] standard §7; no accounts in this scope
- Content screen (§7a) passed; cut items logged with reason: [x] §11
- Free: no revenue features; asset licences recorded: [x] no new asset in this change; three.js is already in the repo
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] block below; NOT signed
```

## 10. Scientist seat (disclosed)

The council's scientist seat is the **Spatial Data Scientist** persona.
It is an imperfect fit on purpose: the persona's field is spatial
statistics, not physics or chemistry (owner decision recorded in
`docs/scaling/agent-instructions.md` and in the status line of
`k12-learning-design-standard.md`).

What that seat may do here: look at whether a cause → effect rule is a
row with a source, and whether a number was invented.

What it must not do: certify a physics or chemistry fact, choose a
curriculum, or sign `educator-gate-rubric.md`. No persona signs that
rubric. A named human educator does, in writing, on a named commit.

## 11. Content screen — cut log

| Cut | Why |
|---|---|
| Plant Lab, food webs, animals, body systems, cells, and every LS code that used to sit in the P7 map | Biology. Owner, 2026-11-10. Standard §2. |
| 5-PS3-1 (energy in animals' food; DCI also names plants) | Biology content inside a PS code. Cut anyway. |
| 4-ESS2-1 clauses on vegetation and living organisms | Living things must not enter through an environment link (`subject-progression-map.md`). Water, ice, wind, gravity, and slope angle may stay. |
| Kindergarten pushes and pulls (K-PS2) | Under 7. Standard §1. Nothing is made for under-7s. |
| Religion, sexuality and gender identity, current or contested politics | Standard §7a. None of these packets had such an item; none is added. |

## 12. Age groups (standard §1)

| Group | Approx. grades | What these packets give them |
|---|---|---|
| 7-10 | 2–5 | Concrete predict-then-see (ramps, states of matter). No algebra, no trigonometry, no formulas on screen. |
| 10-18 | 5–12 | Grade 5 may repeat as a bridge. Middle-school qualitative force and matter, then high-school formulas and the periodic table. |
| 18+ | beyond grade 12 | Same high-school standards, harder cases, copy that is smart rather than childish. No new curriculum is invented for adults. |

## 13. Educator sign-off (empty — not signed)

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/science-definitions-spec.md + the P4, P6, and P7 briefs (this commit)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

No one has signed this. The builder of the work cannot sign it.

