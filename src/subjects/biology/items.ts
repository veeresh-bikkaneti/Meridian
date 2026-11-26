/**
 * Biology records — the single validated content source for biology.
 *
 * Biology is the 7th subject card, promoted from the Living World
 * strand inside General Knowledge (owner decision 2026-11-26,
 * superseding the interim strand decision of 2026-11-25). Content
 * anchors come from NGSS Life Science performance expectations
 * (Lane 6) with USABO as the High School competition ceiling.
 *
 * Each record is one SubjectItem: the UnitItem fields (contract I2)
 * plus its answer, provenance, media rules and lead policy. Screens
 * read projections of these records (biologyUnits, answerFor); they
 * never join files by hand. Lead policy is answer-not-in-lead for
 * every record.
 *
 * Wave 1 (T1, ages 7-10): 4 starter prompts covering observable
 * life-science phenomena. Wave 2-3 (T2/T3, ages 10-18): cellular
 * biology, body systems, ecosystems, heredity, evolution. Wave 4
 * (T4, ages 18+): 1 safety-reviewed biological literacy prompt.
 *
 * No clue scenes exist yet — biology items use the shared case flow
 * only. Media is empty for all records.
 */
import type { AgeGroup, UnitItem } from "../registry.ts";
import type { SubjectItem, SubjectAnswer } from "../math/items.ts";

export { SubjectItemSchema } from "../math/items.ts";
export type { SubjectItem, SubjectAnswer };

/** The live slice: every multiple-choice-ready row, in deal order. */
export const BIOLOGY_ITEM_IDS: readonly string[] = [
  // Wave 1 — T1 (7-10): observable life-science phenomena
  "biology:life-matter:seed-diary",
  "biology:life-cycles:whose-baby",
  "biology:life-structure:built-for-job",
  "biology:life-ecosystems:dry-summer",
  // Wave 2 — T2 (10-18, Middle School): cells, body systems, ecosystems, heredity, natural selection
  "biology:life-structure:one-cell-many-jobs",
  "biology:life-health:team-inside-you",
  "biology:life-ecosystems:grass-runs-short",
  "biology:life-heredity:family-resemblance",
  "biology:life-evolution:peppered-moth",
  // Wave 3 — T3 (10-18, High School): carrying capacity, carbon cycle, heredity/evolution depth, USABO ceiling
  "biology:life-ecosystems:valley-wolves",
  "biology:life-matter:follow-carbon",
  "biology:life-heredity:molecular-inheritance",
  "biology:life-evolution:speciation-islands",
  // Wave 4 — T4 (18+): biological literacy (safety-reviewed, no medical advice)
  "biology:life-health:read-the-label",
];

export const BIOLOGY_RECORDS: SubjectItem[] = [
  // ── Wave 1 — T1 (7-10): observable phenomena ──────────────────────
  {
    "id": "biology:life-matter:seed-diary",
    "group": "7-10",
    "objective": "After this, a child can argue from evidence that plants get growth materials chiefly from air and water, not from soil, shown by choosing 'air and water' as the main source.",
    "standard": {
      "code": "5-LS1-1",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "A seed grew in a dark cupboard with only water — no sunlight and no soil nutrients added. Where did the new stem and leaves come from? Watching is not enough; you need evidence.",
    "buildsOn": [],
    "useElsewhere": [
      "chemistry: understanding where the mass in a growing plant really comes from"
    ],
    "answer": {
      "prompt": "A bean seed in a dark cupboard grew a stem and leaves using only water. Where did the plant get most of its growth material?",
      "choices": [
        "From the soil",
        "From air and water",
        "From sunlight energy alone"
      ],
      "correct": "From air and water",
      "derivation": "NGSS 5-LS1-1: plants get the materials they need for growth chiefly from air and water."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-cycles:whose-baby",
    "group": "7-10",
    "objective": "After this, a child can compare life cycles of two organisms, noting that all share birth, growth, reproduction, and death while cycles differ, shown by matching young to adult.",
    "standard": {
      "code": "3-LS1-1",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "A fluffy chick looks nothing like a feathered hen. How do we know it is hers? Comparing young and adult animals shows how organisms change as they grow up.",
    "buildsOn": [],
    "useElsewhere": [
      "journals: recording observations of animals at different life stages"
    ],
    "answer": {
      "prompt": "A chick looks nothing like an adult hen. What do all animal life cycles share, even when the young look different?",
      "choices": [
        "They all share birth, growth, reproduction, and death",
        "They all look like their parents from birth",
        "They all grow at the same speed"
      ],
      "correct": "They all share birth, growth, reproduction, and death",
      "derivation": "NGSS 3-LS1-1: all organisms have a life cycle of birth, growth, reproduction, and death; cycles differ by organism."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-structure:built-for-job",
    "group": "7-10",
    "objective": "After this, a child can argue from evidence that internal and external structures support survival, growth, behaviour, and reproduction, shown by matching a structure to its survival function.",
    "standard": {
      "code": "4-LS1-1",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "A woodpecker hammers trees all day without hurting its head. Why not? Looking closely at its skull reveals how body structures match what an animal needs to do.",
    "buildsOn": [],
    "useElsewhere": [
      "physics: how structures absorb and distribute force"
    ],
    "answer": {
      "prompt": "A woodpecker hammers trees all day. What helps protect its brain from injury?",
      "choices": [
        "It has a very small brain",
        "Its skull has spongy bone that absorbs shock",
        "It pecks very gently"
      ],
      "correct": "Its skull has spongy bone that absorbs shock",
      "derivation": "NGSS 4-LS1-1: internal and external structures support survival; the woodpecker's spongy skull bone is a structure matched to its behaviour."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-ecosystems:dry-summer",
    "group": "7-10",
    "objective": "After this, a child can argue from evidence that in a habitat some organisms survive well, some less well, and some not at all, shown by identifying which plant survives a dry spell and why.",
    "standard": {
      "code": "3-LS4-3",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "The pond shrank in a dry summer. One desert-adapted plant thrived while a thin-leafed plant wilted and died. Why did one survive and the other not?",
    "buildsOn": [],
    "useElsewhere": [
      "social-studies: how drought affects farming communities"
    ],
    "answer": {
      "prompt": "During a dry summer, a plant with thick waxy leaves thrived while a thin-leafed plant wilted. Why did the waxy-leafed plant survive?",
      "choices": [
        "It could make its own water",
        "Its thick waxy leaves reduced water loss",
        "It had deeper roots that reached a river"
      ],
      "correct": "Its thick waxy leaves reduced water loss",
      "derivation": "NGSS 3-LS4-3: in a habitat, organisms with traits suited to the environment survive better; thick waxy leaves reduce water loss."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },

  // ── Wave 2 — T2 (10-18, Middle School): integrated, relational ────
  {
    "id": "biology:life-structure:one-cell-many-jobs",
    "group": "10-18",
    "objective": "After this, a learner can explain that living things are made of cells and that cell parts contribute to the function of the cell as a whole, shown by identifying what organelle provides energy.",
    "standard": {
      "code": "MS-LS1-2",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "Your body has trillions of cells, yet no single cell is you-shaped. Each cell type has specialised parts. Which tiny structure inside a cell provides the energy the cell needs to work?",
    "buildsOn": [
      "biology:life-structure:built-for-job"
    ],
    "useElsewhere": [
      "chemistry: cellular respiration as a chemical reaction"
    ],
    "answer": {
      "prompt": "Which organelle inside a cell provides most of the energy the cell needs?",
      "choices": [
        "The nucleus",
        "The mitochondrion",
        "The cell membrane"
      ],
      "correct": "The mitochondrion",
      "derivation": "MS-LS1-2: cell parts contribute to the function of the cell; mitochondria carry out cellular respiration to supply energy."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-health:team-inside-you",
    "group": "10-18",
    "objective": "After this, a learner can argue from evidence that the body is a system of interacting subsystems made of groups of cells, shown by explaining why a stomach problem makes the whole body feel weak.",
    "standard": {
      "code": "MS-LS1-3",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "Why does a stomach problem make your whole body feel weak? No organ works alone — your body is built from parts that depend on one another.",
    "buildsOn": [
      "biology:life-structure:one-cell-many-jobs"
    ],
    "useElsewhere": [
      "general-knowledge: understanding how body systems keep you healthy"
    ],
    "answer": {
      "prompt": "A student has a stomach bug and feels weak all over. Why does a problem in one body system affect the whole body?",
      "choices": [
        "Because the stomach controls the brain",
        "Because body subsystems interact — the digestive system supplies nutrients to all other systems via the blood",
        "Because the stomach is the largest organ"
      ],
      "correct": "Because body subsystems interact — the digestive system supplies nutrients to all other systems via the blood",
      "derivation": "MS-LS1-3: the body is a system of interacting subsystems made of groups of cells; the digestive and circulatory systems work together."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-ecosystems:grass-runs-short",
    "group": "10-18",
    "objective": "After this, a learner can analyse data showing how resource availability affects organisms and populations in an ecosystem, shown by explaining why a rabbit population declined after a growth spike.",
    "standard": {
      "code": "MS-LS2-1",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "The rabbits multiplied fast one spring, then the meadow's grass thinned out and the population dropped. What happened? Resources ran short.",
    "buildsOn": [
      "biology:life-ecosystems:dry-summer"
    ],
    "useElsewhere": [
      "math: interpreting population data graphs"
    ],
    "answer": {
      "prompt": "Rabbits in a meadow multiplied rapidly, but then the population dropped sharply. What most likely caused the decline?",
      "choices": [
        "The rabbits migrated to a new habitat",
        "Food (grass) became scarce as the population exceeded what the meadow could support",
        "A new predator arrived at the same time"
      ],
      "correct": "Food (grass) became scarce as the population exceeded what the meadow could support",
      "derivation": "MS-LS2-1: resource availability (food) directly affects organisms and populations; exceeding capacity causes decline."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-heredity:family-resemblance",
    "group": "10-18",
    "objective": "After this, a learner can explain that genes are located on chromosomes and that each gene carries instructions for specific proteins, which determine traits, shown by identifying how traits are inherited.",
    "standard": {
      "code": "MS-LS3-1",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "Two siblings have the same parents but one has curly hair and the other straight. How can the same parents produce children with different traits? Genes, located on chromosomes, carry different instructions.",
    "buildsOn": [],
    "useElsewhere": [
      "social-studies: understanding human biological diversity"
    ],
    "answer": {
      "prompt": "Two siblings have different hair types even though they share the same parents. What explains why they have different traits?",
      "choices": [
        "They ate different foods growing up",
        "Each inherited a different combination of gene variants (alleles) from their parents",
        "One sibling exercised more"
      ],
      "correct": "Each inherited a different combination of gene variants (alleles) from their parents",
      "derivation": "MS-LS3-1: genes on chromosomes carry instructions for proteins that determine traits; each child inherits a unique combination."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-evolution:peppered-moth",
    "group": "10-18",
    "objective": "After this, a learner can explain that natural selection leads to changes in a population over time, shown by identifying how pollution changed the peppered moth population.",
    "standard": {
      "code": "MS-LS4-6",
      "source": "https://www.nextgenscience.org/search-standards"
    },
    "why": "Before industrial pollution, most peppered moths in England were light-coloured and hard to see on pale tree bark. After soot darkened the bark, the dark moths became more common. Why?",
    "buildsOn": [
      "biology:life-ecosystems:dry-summer"
    ],
    "useElsewhere": [
      "social-studies: how human activity shapes ecosystems"
    ],
    "answer": {
      "prompt": "After soot darkened tree bark during the Industrial Revolution, dark peppered moths became more common. What process caused this shift?",
      "choices": [
        "The moths chose to change colour",
        "Natural selection — dark moths were better camouflaged on dark bark and survived to reproduce more",
        "The soot directly dyed the moths' wings"
      ],
      "correct": "Natural selection — dark moths were better camouflaged on dark bark and survived to reproduce more",
      "derivation": "MS-LS4-6: natural selection leads to predominance of certain traits in a population based on environmental conditions."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },

  // ── Wave 3 — T3 (10-18, High School): formal biology, USABO ceiling ──
  {
    "id": "biology:life-ecosystems:valley-wolves",
    "group": "10-18",
    "objective": "After this, a learner can use a mathematical representation to explain factors affecting carrying capacity in an ecosystem, shown by computing approximate carrying capacity from data.",
    "standard": {
      "code": "HS-LS2-1",
      "source": "https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics"
    },
    "why": "A valley's wolf pack grew rapidly for several years, then prey crashed and many wolves starved. How do scientists describe the steady population size an ecosystem can support?",
    "buildsOn": [
      "biology:life-ecosystems:grass-runs-short"
    ],
    "useElsewhere": [
      "math: interpreting logistic growth models"
    ],
    "answer": {
      "prompt": "A valley's prey supported about 30 wolves. The pack grew to 45, then prey crashed and 18 wolves died. What was the valley's approximate carrying capacity for wolves?",
      "choices": [
        "About 18 wolves",
        "About 30 wolves",
        "About 45 wolves"
      ],
      "correct": "About 30 wolves",
      "derivation": "HS-LS2-1: carrying capacity is the population an ecosystem can sustain; the stable level before overshoot was ~30."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-matter:follow-carbon",
    "group": "10-18",
    "objective": "After this, a learner can construct an explanation for the cycling of matter and flow of energy in ecosystems, including photosynthesis and cellular respiration in the carbon cycle, shown by tracing one carbon atom.",
    "standard": {
      "code": "HS-LS2-3",
      "source": "https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics"
    },
    "why": "The carbon atom in your breath was once inside a leaf. How can the same atom move from a plant, into your body, and back into the air?",
    "buildsOn": [
      "biology:life-matter:seed-diary"
    ],
    "useElsewhere": [
      "chemistry: conservation of matter in chemical reactions"
    ],
    "answer": {
      "prompt": "A carbon atom in your exhaled CO₂ was once part of a leaf's glucose molecule. What two processes moved it through this cycle?",
      "choices": [
        "Evaporation and condensation",
        "Photosynthesis (CO₂ → glucose in the leaf) and cellular respiration (glucose → CO₂ in your cells)",
        "Erosion and deposition"
      ],
      "correct": "Photosynthesis (CO₂ → glucose in the leaf) and cellular respiration (glucose → CO₂ in your cells)",
      "derivation": "HS-LS2-3/4/5: matter cycles through ecosystems via photosynthesis and cellular respiration; energy flows in one direction."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-heredity:molecular-inheritance",
    "group": "10-18",
    "objective": "After this, a learner can explain how DNA's structure (the double helix with complementary base pairs) encodes genetic information and how that information is passed to offspring through replication, shown by identifying complementary base pairing.",
    "standard": {
      "code": "HS-LS3-1",
      "source": "https://www.nextgenscience.org/dci-arrangement/hs-ls3-heredity-inheritance-and-variation-of-traits"
    },
    "why": "DNA is a twisted ladder with four kinds of rungs. Each rung is a pair of bases: A always pairs with T, and C always pairs with G. If one side reads A-T-C-G, what does the other side read?",
    "buildsOn": [
      "biology:life-heredity:family-resemblance"
    ],
    "useElsewhere": [
      "chemistry: hydrogen bonding between nucleotide bases"
    ],
    "answer": {
      "prompt": "In DNA, adenine (A) pairs with thymine (T), and cytosine (C) pairs with guanine (G). If one strand reads A-T-C-G, what does the complementary strand read?",
      "choices": [
        "A-T-C-G",
        "T-A-G-C",
        "G-C-A-T"
      ],
      "correct": "T-A-G-C",
      "derivation": "HS-LS3-1: DNA's structure uses complementary base pairing (A↔T, C↔G); the complementary strand of A-T-C-G is T-A-G-C."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
  {
    "id": "biology:life-evolution:speciation-islands",
    "group": "10-18",
    "objective": "After this, a learner can apply the concept of natural selection and evolution to explain how isolated populations diverge into new species, shown by explaining Darwin's finches.",
    "standard": {
      "code": "HS-LS4-5",
      "source": "https://www.nextgenscience.org/dci-arrangement/hs-ls4-biological-evolution-unity-and-diversity"
    },
    "why": "On the Galápagos Islands, finches on different islands have differently shaped beaks — some for cracking seeds, some for catching insects. They all descended from one ancestor. How did this happen?",
    "buildsOn": [
      "biology:life-evolution:peppered-moth"
    ],
    "useElsewhere": [
      "social-studies: understanding biodiversity and conservation"
    ],
    "answer": {
      "prompt": "Galápagos finches on different islands developed differently shaped beaks despite sharing a common ancestor. What process explains this?",
      "choices": [
        "The finches intentionally adapted their beaks",
        "Natural selection acted on variation within isolated populations, favouring beak shapes suited to each island's food sources",
        "Predators on each island trimmed the wrong beaks"
      ],
      "correct": "Natural selection acted on variation within isolated populations, favouring beak shapes suited to each island's food sources",
      "derivation": "HS-LS4-5: natural selection acts on variation; geographic isolation allows populations to diverge into new species (adaptive radiation)."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },

  // ── Wave 4 — T4 (18+): biological literacy, safety-reviewed ───────
  {
    "id": "biology:life-health:read-the-label",
    "group": "18+",
    "objective": "After this, an adult can evaluate a health claim by distinguishing relative risk from absolute risk and identifying what 'doubles the risk' means for an individual, shown by choosing the correct interpretation.",
    "standard": "UNVERIFIED",
    "why": "A headline says a food 'doubles your risk.' That sounds alarming — but what does 'doubles' actually tell you if you don't know the starting rate? Reading like a scientist means checking the baseline.",
    "buildsOn": [
      "biology:life-health:team-inside-you"
    ],
    "useElsewhere": [
      "math: understanding probability and relative vs absolute risk"
    ],
    "answer": {
      "prompt": "A headline says a food 'doubles the risk' of a disease. The baseline risk is 1 in 10,000. What is the new absolute risk per person?",
      "choices": [
        "1 in 5,000 (still very small)",
        "1 in 2 (50% chance)",
        "It depends on how much you eat"
      ],
      "correct": "1 in 5,000 (still very small)",
      "derivation": "Doubling a 1-in-10,000 baseline gives 2 in 10,000 = 1 in 5,000. Relative risk (×2) is scary; absolute risk (0.01% → 0.02%) is small. No medical advice given."
    },
    "provenance": "UNVERIFIED",
    "media": [],
    "leadPolicy": "answer-not-in-lead"
  },
];

/** Projection of a record to its UnitItem (contract I2) shape. */
function toUnitItem(record: SubjectItem): UnitItem {
  return {
    id: record.id,
    group: record.group,
    objective: record.objective,
    standard:
      record.standard === "UNVERIFIED"
        ? "UNVERIFIED"
        : { code: record.standard.code, source: record.standard.source },
    why: record.why,
    buildsOn: [...record.buildsOn],
    useElsewhere: [...record.useElsewhere],
  };
}

/** Projection of a record's answer to the shared answer shape. */
export function toAnswerEntry(record: SubjectItem): SubjectAnswer {
  return projectAnswer(record.answer);
}

function projectAnswer(answer: SubjectAnswer): SubjectAnswer {
  const out: SubjectAnswer = {
    prompt: answer.prompt,
    choices: [...answer.choices],
    correct: answer.correct,
    derivation: answer.derivation,
  };
  if (answer.value !== undefined) out.value = answer.value;
  if (answer.kind !== undefined) out.kind = answer.kind;
  if (answer.followUp !== undefined) out.followUp = projectAnswer(answer.followUp);
  return out;
}

/** The live units for the subject module (contract I1 `units`). */
export function biologyUnits(): UnitItem[] {
  return BIOLOGY_RECORDS.map(toUnitItem);
}

/** Live items for one age band, in deal order. */
export function itemsForGroup(group: AgeGroup): UnitItem[] {
  return biologyUnits().filter((item) => item.group === group);
}

/** Answer lookup by item id. */
export function answerFor(id: string): SubjectAnswer | null {
  const record = BIOLOGY_RECORDS.find((r) => r.id === id);
  return record ? toAnswerEntry(record) : null;
}
