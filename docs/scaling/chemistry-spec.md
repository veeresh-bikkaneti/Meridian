# Chemistry Spec — P6 Chemistry (small, honest scope)

**Current assignment (2026-11-10).** Stage A is this spec. Stage B (one melting-and-freezing unit in code) stays closed until the owner lifts the build gate. Agent instructions, owner decision 5: only the math definition work and the Phase 0 shell split are approved to build. The older "never commit" line in the agent prompt below is history. This branch's plan is the assignment: push `feat/chemistry-spec` and open a draft PR. Do not merge it.

The age line later in this file ("5th grade and up", "no 5–7") is superseded by owner ruling D1, standard §1. Groups are `7-10` (grades 2–5), `10-18` (grades 5–12), and `18+` (beyond grade 12). Grade 5 may sit in either of the first two groups. This spec places grade 5 particle and graph items in `10-18` because they are models of things you cannot see. An educator may move them. The game never asks for an exact age or a birth date.

## Stage A — K-12 block and items

### K-12 standard block (standard §9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [yes — each item's why is that problem, before the teaching line]
- Headline goal (§0): bridge to the previous subject + playable real-life application: [yes — buildsOn plus the on-screen scene]
- Use-it-elsewhere round in at least one other subject (cross-application web): [yes — one useElsewhere setting per item, from subject-progression-map.md]
- Bands served: [7-10, 10-18, 18+] and why: [standard §1; tag follows the standard's grade, with the grade-5 and adult-rung notes in this file]
- Objective per item, observable verb, "shown by": [yes — the data block below]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [NGSS physical science, plus 2-ESS2-3 and MS-ESS2-4 for water as earth science. No life-science codes. Road-salt mechanism is UNVERIFIED as a code.]
- Loop mapped: hook / predict / see / explain / retry: [yes — standard §3. Hook is why. Predict is a tap before the scene plays. See is the on-screen outcome. Explain is one or two host sentences. A miss gets one hint, then the review deck.]
- Mastery "confident" bar for this subject: [correct prediction on the first try — standard §4 science bar. Same Explored / Growing / Mastered states. A skill is fully Mastered only after a correct use in two settings — standard §0.]
- Review-deck hookup (same deck, same ladder): [same deck and same ladder as standard §4. Wiring into src/game/review-deck.ts is integrator-only (contract I2). Until then, misses stay in the subject module. No module exists yet: Stage B is gated.]
- Post-clip retrieval check (journal + any video): [no journal clip in this spec. Each round ends with one tap check about what the scene showed — standard §4.]
- Motion tiers: Full / Lite / Flat described, learning parity stated: [yes — standard §5.2. Full: three.js by dynamic import("three"), as in home-globe.tsx. Lite: the same scene with less motion. Flat: the same before-and-after pictures in 2D. Same prompt, same choices, same rule. prefers-reduced-motion uses the Flat path. Nothing flashes more than 3 times a second.]
- Accessibility: captions, tap alternative, no-timer default, SR live region: [standard §6 and the repo floors: tap targets at least 44×44 px, text contrast at least 4.5:1, focus ring at least 3:1 on dark surfaces. Read-aloud on for 7-10. No timer by default. No drag required. A correct answer is never color alone: a second cue (shape or words) and a screen-reader live region carry the same fact. Host lines have captions. Reduced motion shows the outcome as a still.]
- Privacy: no PII, no identifiers, local-only records: [standard §7. No account, no exact age, no birth date. Records stay on the device.]
- Content screen (§7a) passed; cut items logged with reason: [yes — cut log in this file. No biology, religion, mythology, sexuality, gender identity, or current or contested politics.]
- Free: no revenue features; asset licences recorded: [no ads, payments, or paywalls. No new library. Scene art is drawn by the game; licence list is empty until a real asset is added. PROPOSED.]
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [sign-off block below is attached and unsigned. Spec stays GATED.]
```

### How a round plays

Combine-and-watch happens only on the screen. The host never says to try a mix at home, never lists steps a child could follow in a kitchen, and never gives an amount to mix. Two pictures are enough: the prediction, then the outcome. Choices are taps.

Full, Lite, and Flat teach the same rule. Full loads `three` with a dynamic import inside the scene and disposes it on exit (contract I4, when Stage B is allowed). The house stack is standard §5.1. No new library.

The v1 unit, when the gate lifts, is melting and freezing: `chemistry:states:melt-freeze`, `chemistry:states:road-salt`, and `chemistry:water:cycle` (why roads are salted, and the water cycle on the globe). It is not built in this change.

### Scope, in one page

Curriculum cited: Next Generation Science Standards, physical science, plus two earth-science water expectations used as the environment link. Pages were opened 2026-11-10. A standards page is evidence for a human educator. It is not the signature.

World view: ice, water, a road, a bike, a shop counter on the screen, and the globe. Not a US-only tour. Places that do not salt roads still have the ice-pop round.

Chain steps from `subject-progression-map.md` (structure, not new facts): C1 states and melting, C2 where the water goes, C3 dissolving, C4 rust and reactions. Cross-subject `buildsOn` values (`map:M1`, `map:M2`, `map:Ph1`, `map:Ph3`) are PROPOSED pointers to that map. Sibling specs have not published stable unit ids. No `7-10` item builds on `map:M4` (algebra).

Counts: **PROPOSED 10 topics** (science-spec items 15–24, read on `origin/feat/science-spec`). **PROPOSED 18** unit rows below, so each topic has a group and all three groups appear. Topics 19 and 24 share one row. **Video count: TO CONFIRM.** None of these numbers is a decision.

### On-screen items (contract I2)

`group` is `"7-10" | "10-18" | "18+"`. `standard` is `{ code, source }` or `"UNVERIFIED"`. `buildsOn` holds unit ids. `useElsewhere` holds one setting from the map's web.

High-school codes are published for grades 9–12, which sit in `10-18`. The three `18+` rows reuse a high-school code as the adult rung, because no beyond-grade-12 code was found. The educator confirms that placement. Those rows are not a claim that the code was written for adults.

```ts
export type AgeGroup = "7-10" | "10-18" | "18+";
export type UnitItem = {
  id: string;
  group: AgeGroup;
  objective: string;
  standard: { code: string; source: string } | "UNVERIFIED";
  why: string;
  buildsOn: string[];
  useElsewhere: string[];
};

export const chemistryUnits: UnitItem[] = [
  {
    id: "chemistry:states:solid-liquid",
    group: "7-10",
    objective: "After this, a child can sort water as solid ice or liquid water when it is warmed or cooled, shown by a first-try tap on the matching picture.",
    standard: { code: "2-PS1-4", source: "https://www.nextgenscience.org/pe/2-ps1-4-matter-and-its-interactions" },
    why: "The ice pop is hard in the cold and drips when the room is warm. What changed it?",
    buildsOn: ["map:Ph3"],
    useElsewhere: ["geography: glaciers and sea ice on the globe"],
  },
  {
    id: "chemistry:states:melt-freeze",
    group: "7-10",
    objective: "After this, a child can predict that warming ice makes liquid water and cooling that water makes ice again, shown by a first-try tap before the picture plays.",
    standard: { code: "2-PS1-4", source: "https://www.nextgenscience.org/pe/2-ps1-4-matter-and-its-interactions" },
    why: "The puddle was ice this morning and water at lunch. Can it turn back into ice?",
    buildsOn: ["chemistry:states:solid-liquid"],
    useElsewhere: ["everyday: freezing a drink on screen so it stays cold"],
  },
  {
    id: "chemistry:water:where",
    group: "7-10",
    objective: "After this, a child can point to oceans, rivers, lakes, and ponds as liquid water, and to ice as solid water, shown by taps on the globe.",
    standard: { code: "2-ESS2-3", source: "https://www.nextgenscience.org/pe/2-ess2-3-earths-systems" },
    why: "The puddle is gone, but the lake is still there. Where is the water, and is it ice or liquid?",
    buildsOn: ["chemistry:states:solid-liquid"],
    useElsewhere: ["geography: oceans, rivers, lakes, and ice on the globe"],
  },
  {
    id: "chemistry:materials:sort",
    group: "7-10",
    objective: "After this, a child can sort materials by color, texture, hardness, or flexibility, shown by a first-try sort of on-screen samples.",
    standard: { code: "2-PS1-1", source: "https://www.nextgenscience.org/pe/2-ps1-1-matter-and-its-interactions" },
    why: "Two spoons look the same until you notice one bends and one does not. Which property did you use?",
    buildsOn: ["chemistry:states:solid-liquid"],
    useElsewhere: ["everyday: picking a material you can see for a job on screen"],
  },
  {
    id: "chemistry:materials:magnet",
    group: "7-10",
    objective: "After this, a child can predict whether a magnet pulls a material without touching it, shown by a first-try tap before the magnet moves.",
    standard: { code: "3-PS2-3", source: "https://www.nextgenscience.org/pe/3-ps2-3-motion-and-stability-forces-and-interactions" },
    why: "A pile of bits looks the same. Which ones will jump to the magnet?",
    buildsOn: ["chemistry:materials:sort", "map:Ph1"],
    useElsewhere: ["physics: a magnet sorting metals on screen"],
  },
  {
    id: "chemistry:pieces:rebuild",
    group: "7-10",
    objective: "After this, a child can take an on-screen model apart and build a new shape from the same pieces, shown by using every piece and adding none.",
    standard: { code: "2-PS1-3", source: "https://www.nextgenscience.org/pe/2-ps1-3-matter-and-its-interactions" },
    why: "The bridge model is too short. Can the same pieces make a longer one?",
    buildsOn: ["map:M1"],
    useElsewhere: ["math: counting the same pieces in a new build"],
  },
  {
    id: "chemistry:states:particles",
    group: "10-18",
    objective: "After this, a learner can predict whether adding or removing warmth turns water among solid, liquid, and gas, shown by a first-try choice of the particle picture.",
    standard: { code: "MS-PS1-4", source: "https://www.nextgenscience.org/pe/ms-ps1-4-matter-and-its-interactions" },
    why: "The kettle picture goes from ice, to water, to a cloud above the water. What did the warmth change?",
    buildsOn: ["chemistry:states:melt-freeze", "map:Ph3"],
    useElsewhere: ["physics: particles moving faster when something is warmed"],
  },
  {
    id: "chemistry:states:road-salt",
    group: "10-18",
    objective: "After this, a learner can predict that salt on ice changes whether the ice stays solid and stuck, shown by a first-try tap before the road scene plays.",
    standard: "UNVERIFIED",
    why: "The road is icy. Crews spread salt. Why does the ice change?",
    buildsOn: ["chemistry:states:melt-freeze", "chemistry:mixtures:dissolve"],
    useElsewhere: ["economics: the cost of keeping a road usable, as a plain money fact"],
  },
  {
    id: "chemistry:water:cycle",
    group: "10-18",
    objective: "After this, a learner can order an on-screen path of water as ice or liquid, into the air, into a cloud, and back as rain or snow, shown by a correct picture order.",
    standard: { code: "MS-ESS2-4", source: "https://www.nextgenscience.org/pe/ms-ess2-4-earths-systems" },
    why: "The puddle disappeared and the sky has a cloud. Where did the water go, and how does it come back?",
    buildsOn: ["chemistry:water:where", "chemistry:states:particles"],
    useElsewhere: ["geography: clouds, rain, and ice on the globe"],
  },
  {
    id: "chemistry:mixtures:dissolve",
    group: "10-18",
    objective: "After this, a learner can pick the model that says a dissolved solid is still there as pieces too small to see, shown by a first-try choice. The scene does not ask anyone to taste it.",
    standard: { code: "5-PS1-1", source: "https://www.nextgenscience.org/pe/5-ps1-1-matter-and-its-interactions" },
    why: "The solid in the glass picture is gone from sight. Is it gone, or still there?",
    buildsOn: ["chemistry:states:solid-liquid", "map:M2"],
    useElsewhere: ["geography: salt seas and lakes on the globe"],
  },
  {
    id: "chemistry:reactions:new-look",
    group: "10-18",
    objective: "After this, a learner can predict whether an on-screen mix keeps the old look or shows a new one, shown by a first-try tap before the scene plays.",
    standard: { code: "5-PS1-4", source: "https://www.nextgenscience.org/pe/5-ps1-4-matter-and-its-interactions" },
    why: "A shop counter on the screen stirs two plain substances. The picture may bubble. Is that still the same stuff?",
    buildsOn: ["chemistry:mixtures:dissolve"],
    useElsewhere: ["economics: a shop measures a drink mix on screen"],
  },
  {
    id: "chemistry:reactions:rust",
    group: "10-18",
    objective: "After this, a learner can compare a metal's look before and after rain and say the properties changed, shown by a first-try choice that a reaction may have happened.",
    standard: { code: "MS-PS1-2", source: "https://www.nextgenscience.org/pe/ms-ps1-2-matter-and-its-interactions" },
    why: "A metal bike sat out in the rain. It looks different. Did the material change?",
    buildsOn: ["chemistry:reactions:new-look"],
    useElsewhere: ["economics: repair and replacement costs, as a plain money fact"],
  },
  {
    id: "chemistry:materials:identify",
    group: "10-18",
    objective: "After this, a learner can identify a material by properties they observe, including whether it dissolves, shown by a first-try name from the on-screen tests. Floating is not scored.",
    standard: { code: "5-PS1-3", source: "https://www.nextgenscience.org/pe/5-ps1-3-matter-and-its-interactions" },
    why: "Three unmarked blocks could be three different materials. Which test tells them apart?",
    buildsOn: ["chemistry:materials:sort"],
    useElsewhere: ["everyday: whether a solid disappears into water, on screen"],
  },
  {
    id: "chemistry:elements:detective",
    group: "10-18",
    objective: "After this, a learner can use a column of the periodic table to predict which of two materials is more likely to react, shown by a first-try tap. No electron-counting is required on this row.",
    standard: { code: "HS-PS1-1", source: "https://www.nextgenscience.org/pe/hs-ps1-1-matter-and-its-interactions" },
    why: "Two materials look alike. The table's pattern is the clue for which one reacts with oxygen.",
    buildsOn: ["chemistry:pieces:rebuild", "chemistry:reactions:new-look"],
    useElsewhere: ["geography: weathering of landmarks and rocks, as a visible change"],
  },
  {
    id: "chemistry:reactions:weight",
    group: "10-18",
    objective: "After this, a learner can predict that the total weight stays the same when the on-screen substances are heated, cooled, or mixed, shown by reading the before-and-after scale.",
    standard: { code: "5-PS1-2", source: "https://www.nextgenscience.org/pe/5-ps1-2-matter-and-its-interactions" },
    why: "The mix looks different. Did any of it disappear, or does the scale still match?",
    buildsOn: ["chemistry:mixtures:dissolve", "map:M1"],
    useElsewhere: ["economics: a shop batch weighs the same before and after, on screen"],
  },
  {
    id: "chemistry:reactions:explain",
    group: "18+",
    objective: "After this, an adult learner can revise a prediction for a simple main-group reaction drawn as a tally, using the periodic pattern, shown by a first-try revision. Iron rust is not the example: the page limits assessment to main-group elements and combustion.",
    standard: { code: "HS-PS1-2", source: "https://www.nextgenscience.org/pe/hs-ps1-2-matter-and-its-interactions" },
    why: "The tally on the screen does not match the first guess. Which column pattern explains it?",
    buildsOn: ["chemistry:elements:detective"],
    useElsewhere: ["physics: energy in or out of a reaction, on screen, with no flame demo"],
  },
  {
    id: "chemistry:reactions:mass",
    group: "18+",
    objective: "After this, an adult learner can show that the count of atoms, and so the mass, matches on both sides of a simple on-screen reaction, shown by a balanced tally.",
    standard: { code: "HS-PS1-7", source: "https://www.nextgenscience.org/pe/hs-ps1-7-matter-and-its-interactions" },
    why: "A simple reaction on the screen changes the look. Count the pieces on each side. Did any piece vanish?",
    buildsOn: ["chemistry:reactions:weight", "chemistry:states:particles"],
    useElsewhere: ["math: the same tally as a proportion, on a simple reaction only"],
  },
  {
    id: "chemistry:reactions:rate",
    group: "18+",
    objective: "After this, an adult learner can predict that a warmer mix, or a more crowded one, changes how fast the on-screen reaction finishes, shown by a first-try choice of which scene finishes first.",
    standard: { code: "HS-PS1-5", source: "https://www.nextgenscience.org/pe/hs-ps1-5-matter-and-its-interactions" },
    why: "The same reaction is on two screens. One is warmer. Which one finishes first, and why?",
    buildsOn: ["chemistry:reactions:new-look", "chemistry:states:particles"],
    useElsewhere: ["everyday: a warmer on-screen mix finishes sooner"],
  },
];
```

PROPOSED row count: 18. PROPOSED topic count: 10. Video count: TO CONFIRM.

| Science-spec topic | Rows |
|---|---|
| 15 Solid, liquid, gas | `chemistry:states:solid-liquid` (solid and liquid only), `chemistry:states:particles` (gas included) |
| 16 Melting and freezing | `chemistry:states:melt-freeze`, `chemistry:states:road-salt` |
| 17 Where does the water go? | `chemistry:water:where`, `chemistry:water:cycle` |
| 18 What dissolves? | `chemistry:mixtures:dissolve` |
| 19 What makes it fizz? and 24 Kitchen chemistry | `chemistry:reactions:new-look` (one on-screen sort), `chemistry:reactions:rate` (adult rung only) |
| 20 Rust | `chemistry:reactions:rust` |
| 21 Sorting materials | `chemistry:materials:sort`, `chemistry:materials:magnet`, `chemistry:materials:identify` |
| 22 Meet the elements | `chemistry:elements:detective`, `chemistry:reactions:explain` |
| 23 Tiny building blocks | `chemistry:pieces:rebuild` (pieces you can hold), `chemistry:reactions:weight`, `chemistry:reactions:mass` |
| 24 Kitchen chemistry | same row as topic 19. No second sort, no recipe, no amounts. |

Gas is not in the grade 2 row. The grade 2 disciplinary idea on the 2-PS1 page is solid or liquid. Gas is the middle-school row, where MS-PS1-4 names solids, liquids, and gases.

`chemistry:pieces:rebuild` is pieces a child can see (blocks). It is not an atom lesson. Atoms wait for `chemistry:reactions:mass`. The grade 5 particle row does not define the unseen pieces. The 5-PS1-1 assessment boundary says not to.

### Fact log (accessed 2026-11-10)

No number in a child-facing line is invented here. Temperatures, recipes, and "how much salt" are left out.

| Claim used | Source | Confidence |
|---|---|---|
| Some heating or cooling changes can be reversed. The published examples include ice becoming water and water becoming ice again. | NGSS 2-PS1-4 evidence PDF, https://www.nextgenscience.org/sites/ngss/files/2-PS1-4%20June%202015.pdf | HIGH |
| Water is found in the ocean, rivers, lakes, and ponds, as solid ice and as liquid. The performance sentence is "Obtain information to identify where water is found on Earth and that it can be solid or liquid." The official HTML view omitted that sentence in the scrape; the California Department of Education posts the same NGSS sentence: https://www2.cde.ca.gov/cacs/id/web/28997 | Official page https://www.nextgenscience.org/pe/2-ess2-3-earths-systems plus the CA DOE page | HIGH |
| Deicers lower water's freezing point. They are applied to roads. This spec does not say they make ice melt faster, and it copies no temperature. | USGS, https://www.usgs.gov/centers/new-england-water-science-center/news/deicing-new-englands-roads-parking-areas-and-walkways — "Deicers lower water’s freezing point by dissolving into the water and adding charged particles, called ions." FHWA, https://ops.fhwa.dot.gov/weather/resources/publications/tech_briefs/antiicin.htm — chemicals on pavement "lower the freezing point of water" so the road stays wet or slushy rather than icy. The ion clause is not a 7-10 line. | HIGH for those sentences. |
| Adding or removing thermal energy changes particle motion until a pure substance, including water, changes state. | https://www.nextgenscience.org/pe/ms-ps1-4-matter-and-its-interactions | HIGH |
| A grade 5 model may use dissolving sugar or evaporating salt water as evidence that matter is particles too small to see. The assessment does not define those particles, and it does not include the atomic-scale mechanism of evaporation. | https://www.nextgenscience.org/pe/5-ps1-1-matter-and-its-interactions | HIGH |
| Mixing substances may form a new substance with different properties. The total weight does not change when substances are heated, cooled, or mixed. | 5-PS1-4 and 5-PS1-2 on nextgenscience.org (search listing and PE pages, 2026-11-10) | HIGH |
| Water can be liquid, solid, or gas. The sun's energy evaporates liquid water. Rain, snow, and hail fall from clouds. Ice is stored in ice sheets and glaciers. The on-screen path uses those sentences and does not use living things. The NGSS expectation is the code; its plant path is cut. | USGS Water Science School, https://www.usgs.gov/water-science-school/water-cycle — "It can be a liquid, a solid, or a gas." NGSS PDF https://www.nextgenscience.org/sites/ngss/files/MS-ESS2-4%20June%202015.pdf | HIGH for those sentences. |
| The periodic table's repeating pattern is used to predict properties, including how metals react and reactions with oxygen. | https://www.nextgenscience.org/pe/hs-ps1-1-matter-and-its-interactions | HIGH |
| Temperature or concentration changes how fast a simple reaction goes (HS-PS1-5). Atoms, and so mass, are conserved in a simple reaction (HS-PS1-7). | https://www.nextgenscience.org/pe/hs-ps1-5-matter-and-its-interactions and https://www.nextgenscience.org/pe/hs-ps1-7-matter-and-its-interactions — both pages loaded 2026-11-10 (see `docs/scaling/chemistry/standards-notes.md`) | HIGH for the codes and the page loads. The mole is the page's tool for HS-PS1-7. This spec uses a simple tally and does not invent a worked example. |

### UNVERIFIED, and left out of the teaching line

- No NGSS code found whose statement is "salt lowers the freezing point." `chemistry:states:road-salt` stays `"UNVERIFIED"`. The FHWA sentence may be the host line after the prediction. It is not a fake code.
- The chemical formula of rust is UNVERIFIED here. A NASA sentence may be the host line, with no formula and no "try this": "The mineral is a form of iron oxide, or rust, produced when iron is exposed to oxygen and water." (https://www.nasa.gov/solar-system/moon/the-moon-is-rusting-and-researchers-want-to-know-why/, page updated 5 February 2024, opened 2026-11-10). It says oxygen and water, not air. MS-PS1-2 is the property-change code. Its published examples are not a bike in the rain, and the host does not say the page names a bike. Iron is outside the HS-PS1-2 assessment boundary, so the adult reaction row does not use rust.
- No reservoir percentages. 5-ESS2-2 exists and graphs amounts of water. This spec does not use it, so no ocean-versus-ice number appears.
- Specific glacier names, coordinates, and video counts: TO CONFIRM. The Hyderabad rule still applies when a place is pinned.
- Worked numerical examples for HS-PS1-7 (moles, masses) are not in this spec. The code's page loaded. A worked example stays UNVERIFIED until a sourced problem is chosen.

### Council dissent (kept on purpose)

A short council asked for 11 rows and no salt row. This spec keeps the salt row because the branch task names "why roads are salted," and it keeps the standard `"UNVERIFIED"` rather than borrowing MS-PS1-4 (pure substance plus heat). Grade-2 water stays on 2-ESS2-3. Magnets stay on 3-PS2-3, the magnet expectation, not on 5-PS1-3. The periodic-table row stays in `10-18` because HS-PS1-1 is grades 9–12. The council's merge of the fizz sort and the kitchen sort is adopted: one row. Floating is not scored. Notes: `docs/scaling/chemistry/council-notes.md`.

### Cut log (standard §7a, and no biology)

Left out on purpose:

- Plants, animals, the body, food, eggs, and leaves. The 2-PS1-4 clarification names a cooked egg and a frozen leaf as irreversible changes. Those examples are not used. Water is the example.
- Transpiration and any plant path in the water cycle. MS-ESS2-4 names transpiration in the disciplinary idea. The on-screen model uses evaporation from water, clouds, rain or snow, ice, and downhill flow only.
- The life-science connection printed on HS-PS1-1 (HS.LS1.C). Not taught.
- 5-ESS2-1, because its model includes the biosphere.
- Flame tests, explosions, and any mix a child could copy at home. Bubbles are an unnamed on-screen cue.
- Road-salt policy, climate arguments, and "should we salt roads." The item is the freezing-point fact only.
- Algebra, rates, concentration, and trigonometry on every `7-10` row.

### Educator sign-off

Not signed. No agent signs this.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/chemistry-spec.md (Stage A, commit recorded when this branch is pushed)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

### Stage B

Open. The owner has not lifted the build gate. No `src/subjects/chemistry/` module, no tests, no screen recording, and no `AGENTS.md` code gates in this change. When the gate lifts: one subject module, contract I1, `released: false`, the melting-and-freezing unit against contracts I2–I4, tests first, Full / Lite / Flat with the same learning. Until Phase 0 merges, prove it with tests and a local harness that is not committed.

## Header

| Field | Value |
|---|---|
| Topic | P6 Chemistry — a small, honest chemistry game scoped to what schools actually teach, built around a real verb (combine-and-watch), not a quiz |
| Status | **GATED** — Stage A spec is in this file. Do not build until a named human educator signs the rubric and the owner lifts the build gate. |
| Branch | `feat/chemistry-spec` (per this spec brief; the work packets call the P6 branch `feat/chemistry-basics` — confirm the branch name before the build agent starts) |
| Video count | **TO CONFIRM** — do not invent a number. The count is set by the signed definition once the scope question is answered, not by this spec. |
| Repo | veeresh-bikkaneti/Meridian — free browser geography game for kids, live at https://veeresh-bikkaneti.github.io/Meridian/ (project record, MEMORY.md; confidence HIGH as a project-internal fact — the live web search on 2026-11-10 returned other products named "Meridian" and did not independently verify the repo URL, so no web citation is claimed for it) |
| Sources consulted | `meridian-scaling-lens-breakdown.md` §0 (lines 15–151), §5 P6 (lines 971–1108), §12 staleness flags (lines 1899–1926), §13 open questions (lines 1927–1961); `meridian-scaling-work-packets.md` shared gates + dependency chart (lines 7–102), P6 (lines 394–444) |
| Spec date | 2026-11-10 |

## Expert seats

- **Scientist seat — HELD by Spatial Data Scientist (`spatial-data-scientist.toml`).** Owner decision 2026-11-10: use the available science persona since the content is public knowledge. Imperfect fit, disclosed: spatial statistics, not physics/chemistry — no physicist/chemist TOML exists in the packs (only data-scientist TOMLs). The seat's REQUIREMENTS stay: physics and chemistry only; the scientist writes and speaks in **children's language: simple words a 5th-grader follows**. Every script, clue, label, and host line must pass that test; a sentence a 5th-grader cannot follow is rewritten, not shipped.
- **Educator seat — BLOCKED.** No named educator exists. The named human educator / SME (a science educator) must sign IN WRITING, before build: (1) the US-school scope answer (what chemistry is taught per band), (2) the chemistry topic map per band, (3) the judging rule for this subject, (4) the machine-verification gate, demonstrated on one complete mode. Until that signature is on file, this packet stays GATED. The scope question **cannot be answered by an agent's web search alone** — search grounds facts; it does not certify a curriculum. A web search that finds a standards document is evidence for the educator to sign — it is not the signature.
- Five lenses also apply as usual: software architect, UI/UX designer, game developer, researcher, educator (blocked).

## Topic scope

- **Age band:** superseded. Owner ruling D1 (standard §1) is the rule: `7-10`, `10-18`, and `18+`, as in Stage A above. The old "5th grade and up / no 5–7" line is not the assignment.
- **Purpose:** school revision, not new teaching. What the game covers follows from the scope answer — nothing more.
- **The defining question FIRST (this packet's first deliverable):** what chemistry do US schools teach per band? The study and description contain **no chemistry scope at all** — the only source is the owner's remark (2026-11-07) that he does not know how much chemistry US schools teach. Do not invent scope. Research it against official US curriculum/standards documents (HIGH) or published state standards (MEDIUM), with document, version, date. If the answer is "almost none", that is the finding — the honest answer may then be a very small game or a shelf, not a subject launch. The packet must report that rather than invent scope.
- **In scope (per lens §5 + packets P6):** one chemistry mode with a real verb — combine-and-watch / classify / build-and-test — per the signed definition. Core verb: combine-and-watch (predict what happens when things combine, then see it). Element Detective (solve cases using clues from the periodic table) is the candidate format, only if the definition supports it. Every fact cited; every combination outcome machine-verified (the simulation's rules are data, checked, not improvised). Predict-then-see presentation: the mockup shows the prediction step and the visible outcome as two distinct moments.
- **P6/P7 sharing:** depends on the same simulation thinking as P7 — the two packets should share the "predict-then-see" engine shape where honest, but neither may wait for the other; if a shared engine is needed, it is defined in P2's spike, not invented here.
- **Out of scope:** any chemistry beyond the signed scope (no "general chemistry" drift); any quiz-format chemistry (dismissed by the council — do not mock one); any tiny-model use (P9, parked); any behaviour change to other games. World view, not US-heavy: the scope question is about US schools because that is the owner's question, but examples and settings must not default to the US only, and the topic map must say which curriculum it follows.

## Topic structure — no count invented

Structure only; the video count is **TO CONFIRM** once the scope question is answered and the definition is signed. The build agent turns this structure into videos once the count is set. Do not invent curriculum facts — each sub-topic below must cite the scope research before content is written; a topic with no scope citation is out of scope.

1. **Scope answer (deliverable zero)** — what chemistry US schools teach per band, written with sources, signed by the science educator. Everything below hangs off this answer.
2. **Combine-and-watch (core verb)** — predict what happens when things combine, then see it. The verb is stated with a fail state; a verb with no fail state is not a game.
3. **Classify** — sorting and grouping materials by their properties, per the signed scope.
4. **Build-and-test** — building something from parts and testing whether it works, per the signed scope.
5. **Element Detective (candidate format)** — solve cases using clues from the periodic table — only if the definition supports it.
6. **Predict-then-see judging** — prediction judged against the verified outcome rules; a test walks right prediction, wrong prediction, near-miss.
7. **Outcome rules as checked data** — every combination outcome is a checked data row with a source; a rule with no source is UNVERIFIED and must not ship.
8. **Small-scope consequence** — if the scope is small, the mockup reflects the scoped size; a big game mocked on a small scope is a scope lie. The mode may honestly be very small, or a shelf.

**Play surface:** one mode with a real verb, mocked first at 390px and 1280px. A quiz-format surface is dismissed by the council — do not mock one.

## Hard rules (owner's — in every file)

1. **Verify EVERY key fact with live web search:** source URL + confidence (HIGH/MEDIUM/LOW per lens §0.2) on every claim. No source = mark UNVERIFIED, never state it as fact. No stale facts.
2. **NO POLITICS anywhere.**
3. **Status GATED (educator sign-off in writing).** Educator seat BLOCKED — no named educator exists. Signer must approve in writing: curriculum + topic map + judging rule + verification gate (plus the US-school scope answer for this packet).
4. **Counts:** TO CONFIRM for this spec. Never present a proposed count as decided, never invent one.
5. **7-stage release pipeline applies** — no feature ships unless all seven ran: (1) code review, (2) architectural review, (3) design review, (4) feasibility analysis (works in a browser), (5) manual QA by real play-testing, (6) visual testers (effects in sync/consistent), (7) age-group playtest with feedback to the game player and game researcher. A review-only pass is not testing.
6. **Lazy-load law:** nothing loads until a kid picks it. No subject loads before selection; inside a chosen subject, prefetch of the next 1–2 items is allowed. Load budget numbers (initial JS ≤ 250 KB gzip; per-game chunk ≤ 500 KB gzip) are PROPOSALS, not measurements — baseline on P2's first build; breach = branch blocked.
7. **Host wrap-up (owner's rule, every question, every feature):** win or lose, correct or wrong, every question ends with the host retelling the story behind the answer as a very small, short animated cartoonish video clip — not lengthy.
8. **Mockup first:** the verb mockup is shown to the owner before building. A child must get it just by looking. Free, no paywalls, COPPA-safe (no accounts, no PII, no identifiers).
9. **Readiness audit (all four, demonstrated not promised):** (i) named curriculum + topic map, (ii) machine-verifiable judging rule, (iii) correctness checkable without an LLM near the data, (iv) core verb a child gets just by looking. Point (i) cannot pass until the scope question is answered.

## Verification protocol (lens §0 — forcing rule)

Before any question in this spec is answered, the build agent MUST: (1) run a live web search to ground the answer in current information — answering from its own knowledge is forbidden; (2) give every key fact a named site source (with URL where possible, plus access date) or an explicit confidence level (HIGH/MEDIUM/LOW per §0.2); (3) record any fact with no source as UNVERIFIED and never assert it; (4) re-check anything time-sensitive against a current source — a stale fact is wrong. A section completed without these four steps is incomplete. Full protocol: lens §0.

## Agent prompt (copy-paste block)

Historical packet prompt. Where it says "5th grade and up" or "never commit, push, or open PRs," Stage A and the branch plan win: three groups, push this branch, draft PR, no merge.

```
You are the build agent for Meridian P6 Chemistry (feat/chemistry-spec).
Repo: veeresh-bikkaneti/Meridian. SPEC ONLY in this file — do NOT generate
videos here; the build agent implements from this spec on branch
feat/chemistry-spec. Never commit, push, open PRs, or merge on your own;
the coordinator does all git work and merging stays the owner's decision,
per PR, per head.

EXPERTISE REQUIRED: Software Architect, UI/UX Designer, Game Developer,
Researcher, plus the SCIENTIST seat (Spatial Data Scientist — requirements stand:
physics and chemistry only) and the EDUCATOR seat (BLOCKED — no named
educator exists; see gate below). The SCIENTIST must write and speak in
CHILDREN'S LANGUAGE: simple words a 5th-grader follows, in every script,
clue, label, and host line.

TOPIC: A small, honest chemistry game for 5th grade and up — scoped to
what US schools actually teach at this level. VIDEO COUNT: TO CONFIRM —
set by the signed definition once the scope question is answered, never
invented here. Your FIRST deliverable is the scope question, answered in
writing with sources: what chemistry do US schools teach per band? If
the answer is "almost none", report that — the honest answer may be a
very small game or a shelf, not a subject launch. A web search that finds
a standards document is evidence for the educator to sign; it is NOT the
signature. Do not invent scope. No quiz-format chemistry — the real verb
is combine-and-watch (predict what happens when things combine, then see
it); classify / build-and-test are the alternates per the definition.

DELIVERABLES: scope answer (written, sourced); topic map following from
the scope; verb mockup (owner-shown before building, at 390px and
1280px); outcome-rules data with a source per rule; judging test plan.
Video clips: 10 seconds each.

TECH: v4 recipe — AI video-gen + Avocado TTS + ffmpeg. Storyteller
voice: Magnus, 86-138 Hz (project record). 1152x768, 24fps, h264+AAC.
Tap-to-play, preload=none. Captions/VTT + transcript per clip.
Lazy-load law: nothing loads until a kid picks it; prefetch of the next
1-2 items inside a chosen subject is allowed. Host story clip after
every question (win or lose, correct or wrong) — very small, short
animated cartoonish video, not lengthy.

GATES (all must pass): tsc, npm test, test:worker, lint-cards GATE
PASSED, build:pages, Playwright E2E sequential --workers=1, panel
review, educator sign-off IN WRITING for curriculum + topic map +
judging rule + verification gate (+ the US-school scope answer for this
packet), screen recording of the built app (the mode played end to end
with a real verb and a visible outcome — no recording = the testing did
not happen). 7-stage release pipeline in full (code review, architectural
review, design review, feasibility, manual QA by real play-testing,
visual testers, age-group playtest). No self-certification.

VERIFICATION PROTOCOL: verify EVERY key fact with live web search;
source URL + confidence (HIGH/MEDIUM/LOW) on every claim; no source =
UNVERIFIED, never asserted as fact; no stale facts. Chemistry facts that
are wrong are silent failures — a wrong reaction taught fluently is the
failure this packet cannot absorb.

NO POLITICS anywhere. World view, not US-heavy. If the educator is
still unstaffed when you are assigned, your first job is to report that
the packet is blocked — not to build around it.
```

## Open questions for the owner

1. **Q1 (educator + curriculum):** who is the named science educator/SME, and which curriculum/standards does the scope answer use? Blocks every subject GO.
2. **Scope question:** what chemistry do US schools teach per band? — the packet's first deliverable, not an owner question, but it needs the educator to sign it. (No source exists in any input doc.)
3. **Video count:** TO CONFIRM — what count does the signed definition set once the scope is known?
4. **Small-or-shelf:** if US schools teach almost no chemistry at this level, do you want a very small game or a shelf?
5. **P6/P7 sharing:** one shared predict-then-see engine shape (defined in the P2 spike) or two separate surfaces?
6. **Q5 (load budget):** accept the proposed 250 KB / 500 KB starting numbers once baselined, and what tap → first-playable-paint time on what device is "fast enough"?
7. **Alert policy (study §10 Q7):** which funnel types, if any, may page a human? Unassigned — needs your decision before funnel types are defined.

## Definition of done

Done when: (a) the US-school scope question is answered in writing, with sources, and the game's scope follows from it; (b) one chemistry mode plays end to end with a real verb and a visible outcome (predict → see); (c) every fact is cited and every outcome is machine-verified; (d) load budget met on P2-measured numbers and lazy-load behaviour verified; (e) the readiness audit's four points are demonstrated; (f) the science educator's signature is on file; (g) every question ends with the host story clip; (h) the 7-stage release pipeline ran in full; (i) panel review passed with a screen recording.

## UNVERIFIED log (this spec)

- Repo/live-site identity: per project record (MEMORY.md), confidence HIGH as a project-internal fact; live web search 2026-11-10 did not independently verify the repo URL — no web citation claimed.
- Video count: TO CONFIRM — no number is stated anywhere in this spec.
- **The chemistry scope itself is UNVERIFIED** in the older packet below. Stage A above cites NGSS pages opened 2026-11-10. Those citations are evidence for the educator, not a signature, and they do not retire this log line for anything Stage A marks UNVERIFIED.
- Load-budget numbers (250 KB / 500 KB gzip): PROPOSAL, not measured (lens §12 flag 11).
- No other factual claims are made in this spec.
