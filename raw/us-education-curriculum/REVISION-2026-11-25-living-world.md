# Revision 2026-11-25 — Living World strand + confidence standard

This revision resolves two open issues in the U.S. education curriculum
research pack at commit `8fdb0550`.

1. The pack had no explicit Biology/Life Science home.
2. The pack's confidence definitions were internally inconsistent. The
   header defined High as 3+ agreeing primary sources, while labels
   such as [High 2/3] were used in the tables.

Scope. Research and design only. No application code, subject
registries, item data, or runtime behaviour changes.

Method note. Files already in `raw/` are immutable. Corrections to
existing pack claims are therefore stated in this document as
file, section, old wording, new wording, and reason. They are not
edited in place. The wiki layer carries the corrected wording forward.

Sources for this revision. The owner's decision documents of
2026-11-25 (the research-agent prompt with its draft resolution, and
the Living World implementation guide), the inventory and confidence
audits run against the pack and the inventory on `origin/main`, and
Lane 6 (`evidence/lane6-life-science.md`).

## 1. Decision status — adopted

Living World decision status: **adopted** (owner documents, 2026-11-25).

> **Living World decision [Inferred]:** Meridian will retain six top-level categories for the current product cycle. Biology/Life Science will be represented as a protected, first-class `Living World` strand within General Knowledge, with explicit internal metadata and cross-tags where appropriate. T1 and T2 General Knowledge planning will target at least one-third primary Living World content until the inventory is large enough to evaluate a seventh category. Meridian will not claim full NGSS science coverage until Life Science coverage is verified across the intended tiers and domains.

Operating form of the decision.

- Top-level UI categories stay six. Math, Physics, Chemistry, General
  Knowledge, Social Studies, Journals.
- Living World primary home is General Knowledge.
- Internal strand identifier is `life-science`. Display label is
  `Living World` or `Living World / Life Science`. Future content
  metadata carries `strand: "life-science"`.
- Cross-tags are permitted on Journals, Chemistry, Social Studies, or
  Physics items when the item genuinely uses those disciplines.
  Cross-tags never replace the primary home.
- The one-third rule is a product-balancing target for T1 and T2
  General Knowledge allocation. It is not a claim about district
  instructional time.
- An item counts toward the one-third target only when it teaches a
  defined Life Science objective. A nature, health, or animal mention
  alone does not count.

Rejected alternatives.

- Option A, a seventh top-level category `Biology / Life Science`.
  Rejected for this cycle. It changes the picker before Meridian has
  enough Life Science content to support a balanced category. The
  inventory audit in §3 shows the strand starts at zero items.
- Option C, distributing Life Science across General Knowledge,
  Chemistry, Physics, and Journals with no protected strand. Rejected.
  It makes Biology practically invisible and breaks category
  coherence. Biology does not belong in Chemistry merely because both
  concern matter, or in Journals merely because it uses observation.

Seventh-category triggers. All three must hold before the owner
reconsiders a top-level category.

1. Life Science has a stable body of content across T1, T2, and T3.
2. Living World content competes with Earth and Space or geography
   inside General Knowledge for discovery and maintenance.
3. User testing shows learners and parents cannot find Biology
   reliably through the General Knowledge label.

## 2. Confidence standard — replaced

> **Confidence standard:** High means that at least two independent, directly relevant primary or official sources agree without material conflict, except that a single authoritative primary source may be High for a narrow fact it directly establishes. Moderate means one authoritative primary source or partially independent corroboration. Low means secondary, indirect, outdated, mirrored, or conflicting evidence. Unverified claims are omitted or marked `Data not available`. Notation such as `[High 2/2]` records supporting sources checked and must not be used when the evidence quality does not support the High label.

Notation. `[High 2/2]`, `[Moderate 1/1]`, `[Low 1/2]`. The numerator is
the number of sources that directly support the claim. The denominator
is the number of relevant sources checked. Republished copies of one
underlying document count as one origin for independence.

Growth language rule. A proficiency trend or an accountability-model
component is not a direct student-growth result. Growth proxies are
labelled `proficiency-change proxy`.

## 3. Inventory audit [Tested]

Method. Every item in General Knowledge, Journals, Chemistry, Physics,
and Social Studies was classified against the guide's counting rules.
Primary Living World means the learner's success depends on a
biological concept. Cross-tagged means Biology is a meaningful
supporting context while another discipline owns the objective. Not
Life Science means a living thing is decorative or situational only.
Counts were read from the subject data on `origin/main`.

Result. 78 items classified.

| Classification | Count |
|---|---|
| Primary Living World | 0 |
| Cross-tagged | 0 |
| Not Life Science | 78 |

Closest settings, all excluded by the counting rules because their
objectives are measurement, Earth-system, or geography objectives.
Waterfall flow, the water cycle, road salt, and population density.

General Knowledge share against the one-third target.

| Tier | Living World items | GK items | Share | One-third target needs |
|---|---|---|---|---|
| T1 | 0 | 5 | 0% | at least 2 of 5 |
| T2 | 0 | 3 | 0% | at least 1 of 3 |
| T3 | 0 | 0 | no GK items exist | n/a |
| T4 | 0 | 2 | 0% | target applies to T1–T2 |

Domains represented. 0 of 8. `life-structure-function`,
`life-growth-cycles`, `life-ecosystems`, `life-heredity`,
`life-evolution`, `life-matter-energy`, `life-health-systems`, and
`life-environment` all start empty.

Consequence [Inferred]. There are no reclassification wins. Every
Living World item must be authored new.

Data quirk, noted without effect on the classification. Four Journals
`:stretch` records carry objectives naming band 7-10 in `origin/main`
while they are counted at 10-18.

## 4. Gap table

| Gap | Tier | Domain | Evidence |
|---|---|---|---|
| No Living World items at all | T1–T4 | all 8 | §3 audit [Tested] |
| No T1 observable-phenomena foundation | T1 | structure-function, growth-cycles, ecosystems | Lane 6 LS-001 to LS-006 |
| No T2 cellular or body-systems anchor in inventory | T2 | structure-function, health-systems | Lane 6 LS-007, LS-008 |
| LS3 heredity anchored only at T1 | T2, T3 | life-heredity | Lane 6 limits |
| LS4 evolution anchored only at T1 | T2, T3 | life-evolution | Lane 6 limits |
| No T3 formal Biology depth | T3 | all | Lane 6 LS-010 to LS-012 anchors exist, inventory is empty |
| No national T4 standard exists | T4 | health-systems | Lane 6 LS-013, Data not available |

## 5. Revised matrix — Life Science strand treatment

The six-category matrix in CURRICULUM-DESIGN.md §B stands. This table
adds the strand treatment inside General Knowledge for each tier.

| Tier | Living World treatment inside General Knowledge | Anchors |
|---|---|---|
| T1, Grades 2–5 | Observable phenomena only. Structures and functions, plant and animal needs, life cycles, habitats, observable trait variation, simple ecosystems. Grade 2 follows the K–2 endpoint. Grades 3–5 use the 3–5 endpoint. No unseen cellular or molecular mechanism as the core explanation. | LS-001 to LS-006 |
| T2, Grades 6–8 | Integrated-science, relational. Cells and cell functions, body systems as interacting subsystems, ecosystems and resource limits, heredity and variation, adaptation. Compatible with integrated middle-school science. | LS-007 to LS-009 |
| T3, Grades 9–12 | Formal Biology. Carrying capacity and biodiversity quantified, matter and energy cycling, photosynthesis and cellular respiration in the carbon cycle, ecosystem stability, human-impact solutions. AP or advanced content is labelled as an extension, not a universal requirement. | LS-010 to LS-012 |
| T4, 18+ | Application-oriented biological literacy only. Reading health and environmental information, risk and evidence. No diagnosis, treatment, or medical advice. Labelled [Inferred] product design, not a national standard. | LS-013 |

## 6. Case-file prompts for foundational gaps

Each prompt names its anchor from Lane 6. Prompts are authoring
proposals [Inferred]. The concept taught is biological. The learner
action is not arithmetic in a biological setting.

T1 prompts.

1. **The seed diary.** Hook: a seed changed in the dark cupboard, so
   what did it use to grow? Situation: learners track a bean plant
   over two weeks. Concept: plants get growth materials chiefly from
   air and water. Domain: `life-matter-energy`. Action: observe,
   order the growth stages, argue from the diary. Anchor: LS-004
   (5-LS1-1). New concept.
2. **Whose baby is this?** Hook: the chick looks nothing like the
   hen at hatching, so how do we know it is hers? Situation: matching
   young animals to adults across a farm visit. Concept: life cycles
   share birth, growth, reproduction, and death, and differ by
   organism. Domain: `life-growth-cycles`. Action: build the cycle
   model for two animals and compare. Anchor: LS-002 (3-LS1-1). New
   concept.
3. **Built for the job.** Hook: why does the woodpecker not hurt its
   head? Situation: matching animal structures to the jobs they do.
   Concept: internal and external structures support survival,
   growth, behaviour, and reproduction. Domain:
   `life-structure-function`. Action: argue from structure evidence
   for three animals. Anchor: LS-003 (4-LS1-1). New concept.
4. **Who survives the dry summer?** Hook: the pond shrank, and some
   plants thrived while others died. Situation: two plant types in
   one habitat during a dry spell. Concept: in a habitat, some
   organisms survive well, some less well, and some not at all.
   Domain: `life-ecosystems`. Action: argue from observations which
   plant survives and why. Anchor: LS-006 (3-LS4-3). New concept.

T2 prompts.

1. **One cell, many jobs.** Hook: your body has trillions of cells,
   so why is no single cell you-shaped? Situation: microscope images
   of three cell types. Concept: living things are made of cells,
   and cell parts contribute to the cell's function. Domain:
   `life-structure-function`. Action: investigate the images and
   model one cell's parts. Anchor: LS-007 (MS-LS1-1, MS-LS1-2). New
   concept.
2. **The team inside you.** Hook: why does a stomach problem make
   your whole body feel weak? Situation: tracing food through body
   subsystems. Concept: the body is a system of interacting
   subsystems made of groups of cells. Domain: `life-health-systems`.
   Action: argue from evidence how two subsystems interact. Anchor:
   LS-008 (MS-LS1-3). New concept.
3. **When the grass runs short.** Hook: the rabbits multiplied, then
   the meadow changed. Situation: population data across three
   seasons with falling grass cover. Concept: resource availability
   affects organisms and populations. Domain: `life-ecosystems`.
   Action: analyse the data and explain the population turn. Anchor:
   LS-009 (MS-LS2-1). New concept.

T3 prompts.

1. **How many wolves can the valley hold?** Hook: the deer herd
   doubled, then crashed. Situation: population and resource data at
   two scales. Concept: carrying capacity and the factors that set
   it. Domain: `life-ecosystems`. Action: use a mathematical
   representation to support the explanation. Anchor: LS-010
   (HS-LS2-1). New concept.
2. **Follow one carbon atom.** Hook: the carbon in your breath was
   once in a leaf. Situation: tracing carbon through photosynthesis
   and cellular respiration across four spheres. Concept: matter
   cycles and energy flows, and both are conserved. Domain:
   `life-matter-energy`. Action: build the model and revise it
   against evidence. Anchor: LS-011 (HS-LS2-3 to HS-LS2-5). New
   concept.

T4 prompts.

1. **Read the label like a scientist.** Hook: the headline says a
   food doubles a risk, so what does that mean for one person?
   Situation: a news claim about a health study. Concept: risk,
   rates, and uncertainty in biological claims. Domain:
   `life-health-systems`. Action: evaluate the claim, its evidence,
   and its limits. Anchor: LS-013. [Inferred] product design. No
   medical advice.

## 7. Confidence audit

Census [Tested]. 475 confidence tags across the pack. [Moderate 1/1]
×207, [Low 1/1] ×108, [Moderate 1/2] ×63, [High 2/2] ×31,
[Moderate 2/2] ×21, [High 3/3] ×15, [Moderate 2/3] ×14, [Low 1/2] ×7,
[Low 2/2] ×4, [High 2/3] ×4, [High 3/4] ×1.

Corrections. 5 label corrections, 3 wording or definition
corrections, 2 notation corrections. Because `raw/` files are
immutable, each correction below is the ruling that governs the claim
from this revision onward. The wiki layer carries the new wording.

Label corrections.

| # | Location | Old | New | Reason |
|---|---|---|---|---|
| 1 | CURRICULUM-DESIGN.md §0, Eanes ISD row, scaled score 94 / A | [High 2/3] | [Moderate 2/3] | Both supporting sources share one origin, the Texas Education Agency. They fail the revised independence test. |
| 2 | CURRICULUM-DESIGN.md §0, Eanes ISD row, Academic Growth 82 | [High 2/3] | [Moderate 2/3] | Same single origin as #1. |
| 3 | evidence/lane5-cohort2-essa.md, Eanes summary, scaled scores | [High 2/3] | [Moderate 2/3] | Same claim as #1, stated in the lane file. |
| 4 | evidence/lane5-cohort2-essa.md, Eanes section, Academic Growth | [High 2/3] | [Moderate 2/3] | Same claim as #2, stated in the lane file. |
| 5 | evidence/lane2-state-standards.md, California adoption dates | [High 3/4] | [Moderate 3/4] | Three agreeing pages are one origin, the California Department of Education. Only 3 of 4 checked sources support the claim. |

Wording and definition corrections.

| # | Location | Old | New | Reason |
|---|---|---|---|---|
| 6 | CURRICULUM-DESIGN.md, Method line and §0 Cohort 2 introduction | "six ESSA-verified high-performance/high-growth districts" and equivalent phrasing | "six districts selected from official state accountability portals for high performance plus documented growth, change, or growth-related evidence. The evidence type is classified separately for each district; a proficiency trend or accountability-model component is not treated as equivalent to a directly reported student-growth result." | The old wording treated growth proxies as direct growth results. Verbatim owner correction, 2026-11-25. |
| 7 | CURRICULUM-DESIGN.md §D.2 and §D.3, science-coverage framing | Broad statements that the six categories cover science | "Meridian currently covers selected Physical Science and Earth & Space content, with Life Science assigned to a protected General Knowledge strand. Full NGSS science coverage is not yet established." | The old framing implied Life Science coverage that the §3 audit disproves. Verbatim owner correction, 2026-11-25. |
| 8 | CURRICULUM-DESIGN.md "How to read" header, and evidence/lane5-cohort2-essa.md header | "[High x/y] = 3+ agreeing primary sources" definition | The confidence standard in §2 of this revision | The old definition contradicts labels the pack itself uses, such as [High 2/2] for narrow facts. The revised standard supersedes it everywhere in the pack. |

Notation corrections.

| # | Location | Old | New | Reason |
|---|---|---|---|---|
| 9 | evidence/council-t3-highschool.md, sequencing claim | [Moderate–High] | [Moderate 2/3] | Range labels are not in the notation. The claim rests on partially independent corroboration. |
| 10 | evidence/council-t1-elementary.md and evidence/lane5-cohort2-essa.md | bare [Moderate] with no x/y | [Moderate 1/1] at each occurrence | The notation requires supporting sources over sources checked. |

Reviewed and retained. [Low 2/2] ×4 stays Low, because conflicting or
indirect evidence caps the label under the revised standard.
[High 2/2] and [High 3/3] stay High where the claim is a narrow fact
that the cited authorities themselves establish and the origins are
independent. Miami-Dade mirror sources are already Low-tagged and
labelled as mirrors, so no correction is needed there.

## 8. Implementation queue [Inferred]

Ordered. Research and taxonomy steps come before authoring. No step
in this queue changes application code under this revision.

1. Add `strand: "life-science"` metadata support to the content
   pipeline design. No existing item qualifies for the tag today
   (§3), so this is schema work only.
2. Run Lane 6 pass 2. Add the T2 and T3 records for LS3 heredity and
   LS4 evolution, and add state-standard corroboration for the
   placements Lane 6 currently anchors on NGSS alone.
3. Author the T1 foundation set first. The four T1 prompts in §6, in
   the order listed.
4. Author the T2 set. The three T2 prompts in §6.
5. Author the T3 set. The two T3 prompts in §6, with AP extensions
   labelled as extensions.
6. Author the single T4 literacy prompt in §6 after a safety review
   against the no-medical-advice rule.
7. Recount the General Knowledge shares after each authoring wave.
   Report T1 and T2 shares against the one-third target with the
   arithmetic shown.
8. Review the seventh-category triggers (§1) only after steps 3 to 5
   land and a discoverability test exists.

## 9. NGSS coverage statement

Meridian currently covers selected Physical Science and Earth & Space
content, with Life Science assigned to a protected General Knowledge
strand. Full NGSS science coverage is not yet established.

What is verified today. NGSS anchors for part of LS1 and LS2 across
T1 to T3, recorded in Lane 6. What is not verified. LS3 and LS4
beyond T1, state and district corroboration of Life Science
placements, and any Living World inventory, which stands at zero.

## 10. Seventh-category trigger review

Not triggered. Trigger 1 fails, because the strand has no stable
content body yet. Trigger 2 fails, because Living World holds zero
General Knowledge inventory and competes for nothing. Trigger 3 is
untested, because no discoverability test exists. The protected
strand stands.

## 11. Data not available register (this revision)

- District-level Life Science course sequences for the sampled
  districts. Not collected in this pass.
- A national T4 Life Science standard. None exists (Lane 6, LS-013).
- State-standard corroboration for Lane 6 placements. Outstanding,
  queued as step 2 in §8.
- Discoverability evidence for Biology under the General Knowledge
  label. No user test exists.
