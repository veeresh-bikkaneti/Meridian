# Chemistry Spec — P6 Chemistry (small, honest scope)

**Current assignment (2026-11-10).** Stage A is this spec. Stage B (one melting-and-freezing unit in code) stays closed until the owner lifts the build gate. Agent instructions, owner decision 5: only the math definition work and the Phase 0 shell split are approved to build. This branch's plan is the assignment: push `feat/chemistry-spec` and open a draft PR. Do not merge it.

An earlier draft of this spec (header, expert seats, agent prompt) was removed; git history keeps it. Groups follow owner ruling D1, standard §1: `7-10` (grades 2–5), `10-18` (grades 5–12), and `18+` (beyond grade 12). Grade 5 may sit in either of the first two groups. This spec places grade 5 particle and graph items in `10-18` because they are models of things you cannot see. An educator may move them. The game never asks for an exact age or a birth date.

## Stage A — K-12 block and items

### K-12 standard block (standard §9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [yes — each item's why is that problem, before the teaching line]
- Headline goal (§0): bridge to the previous subject + playable real-life application: [yes — buildsOn plus the on-screen scene]
- Use-it-elsewhere round in at least one other subject (cross-application web): [yes — one useElsewhere setting per item, from subject-progression-map.md]
- Bands served: [7-10, 10-18, 18+] and why: [standard §1; tag follows the standard's grade, with the grade-5 and adult-rung notes in this file]
- Objective per item, observable verb, "shown by": [yes — chemistry/items.json]
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

Chain steps from `subject-progression-map.md` (structure, not new facts): C1 states and melting, C2 where the water goes, C3 dissolving, C4 rust and reactions. Cross-subject `buildsOn` values are real ids from `math/number/items.json` (on `main`), `math/applied/items.json` (on `feat/math-spec`) and `physics/items.json` (on `feat/physics-spec`). Only three are used: `physics:magnet:flip`, `math-number:fractions:fair-parts` and `math-number:place:compare`. No `7-10` item builds on algebra.

Counts: **PROPOSED 10 topics** (science-spec items 15–24, read on `origin/feat/science-spec`). **PROPOSED 18** unit rows below, so each topic has a group and all three groups appear. Topics 19 and 24 share one row. **Video count: TO CONFIRM.** None of these numbers is a decision.

### On-screen items (contract I2)

`group` is `"7-10" | "10-18" | "18+"`. `standard` is `{ code, source }` or `"UNVERIFIED"`. `buildsOn` holds item ids. `useElsewhere` holds one setting from the map's web.

High-school codes are published for grades 9–12, which sit in `10-18`. No beyond-grade-12 code was found, so the three `18+` rows are `UNVERIFIED`, as in the number spec's 18+ items. Each says in its `why` which high-school code it extends: `chemistry:reactions:explain` extends HS-PS1-2, `chemistry:reactions:mass` extends HS-PS1-7, and `chemistry:reactions:rate` extends HS-PS1-5. The educator confirms that placement.

The 18 rows are data, in [`chemistry/items.json`](chemistry/items.json), in the exact shape of contract I2 (`id`, `group`, `objective`, `standard`, `why`, `buildsOn`, `useElsewhere`). Item ids are `chemistry:<unit>:<item>`. `docs/scaling/chemistry/items.test.mjs` checks the file.

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

### Open items for the owner or integrator

1. **Educator:** no named science educator has signed; every item is unsigned. Blocks any GO.
2. **Video count:** TO CONFIRM. Not decided here.
3. **Heat as energy:** `chemistry:states:solid-liquid` and `chemistry:states:particles` need "heat is energy moving" first. No physics item for it exists yet (`physics:energy:transfer` is about moving energy, not temperature). The `buildsOn` was removed; add the id when physics publishes one.
4. **Counting pieces:** `chemistry:pieces:rebuild` had a placeholder math pointer. No real math id is truly needed first, so it was removed.
5. **Build gate:** Stage B waits for the owner (see Stage B).

### Stage B

Open. The owner has not lifted the build gate. No `src/subjects/chemistry/` module, no tests, no screen recording, and no `AGENTS.md` code gates in this change. When the gate lifts: one subject module, contract I1, `released: false`, the melting-and-freezing unit against contracts I2–I4, tests first, Full / Lite / Flat with the same learning. Until Phase 0 merges, prove it with tests and a local harness that is not committed.
