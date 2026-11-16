/**
 * Chemistry clue scenes — one scene description per item, in
 * data, next to the answers in answers.ts (the math, physics
 * and general-knowledge scenes.ts pattern). The renderer
 * (src/subjects/shared/ClueScene.tsx) reads these; a later item
 * needs only a new description here, never new code.
 *
 * Answer-blindness is structural, as in physics: a description
 * carries only the givens from the item's own question. The
 * renderer receives a description and a phase ("setup" |
 * "solved") — never the answer, a choice, or a pick — so the
 * setup film can only set the scene. Where a kind's solved beat
 * needs the outcome (which spoon bends, which bits leap), the
 * description's kind data carries it as layout the renderer
 * spends only in the solved phase: the setup film shows both
 * spoons unpressed, the pile unsorted, the pop whole.
 *
 * Each description also carries its SUMMARY: the narrated
 * walk-through of the solving (act 3), played only after a
 * correct pick. The script lines are word-for-word the captions;
 * the clip timings were measured when the clips were rendered
 * (public/audio/subjects/manifest.json carries the same
 * numbers). The summary sits in the solved-phase data path only.
 *
 * Coverage (expansion wave 7): ten items — all five ages 7-10
 * items and the five ages 10-18 states, mixtures and materials
 * items (eight new kinds: melt-freeze, bend-test, magnet-sort,
 * rebuild-pieces, salt-melt, dissolve, particle-states,
 * water-cycle; melt-freeze is shared by the melt and freeze
 * items through its freeze data, and dissolve by the dissolve
 * and identify items through its three-blocks data). The three
 * reactions items and all three ages 18+ items carry NO
 * description in this wave — they belong to wave 8 and stay
 * text-only here.
 */
import type { ClueSceneDescription } from "../shared/clue-scene-types.ts";

export type { ClueSceneDescription };
export {
  countingTicks,
  dealOrder,
  summaryStepCount,
  summaryStepLine,
  summaryStepStart,
} from "../shared/clue-scene-types.ts";

export const CHEMISTRY_CLUE_SCENES: Record<string, ClueSceneDescription> = {
  "chemistry:states:solid-liquid": {
    kind: "melt-freeze",
    labelSetup: "An ice pop on a stick rests in a warm room.",
    labelSolved: "Warmth waves reach the pop, and drips run down.",
    summary: {
      clip: "solid-liquid.mp3",
      duration: 16.96,
      lines: [
        { text: "Here is the clever way to see what changed the ice pop.", at: 0 },
        { text: "In the cold, the ice pop stays hard and frozen on its stick.", at: 3.59 },
        { text: "Warmth from the room reaches the pop, and drips begin to run as it slumps.", at: 7.66 },
        { text: "Warmth melted it — the hard ice pop turned into a runny liquid!", at: 12.87 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:states:melt-freeze": {
    kind: "melt-freeze",
    freeze: true,
    labelSetup: "An open puddle rests under a darkening sky.",
    labelSolved: "The cold returns, and ice skins over the puddle.",
    summary: {
      clip: "puddle-freeze.mp3",
      duration: 20.9,
      lines: [
        { text: "Here is the clever way to see what the cold brings back.", at: 0 },
        { text: "The puddle was ice this morning, and by lunch it had melted into water.", at: 3.63 },
        { text: "Tonight the cold returns, and the open water begins to skin over.", at: 8.69 },
        { text: "Cold can freeze the water back into ice — this change can run backwards, so the puddle turns back into ice!", at: 13.56 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:materials:sort": {
    kind: "bend-test",
    labelSetup: "Two spoons rest side by side on a table.",
    labelSolved: "Tips are pressed, and one spoon flexes.",
    summary: {
      clip: "bend-test.mp3",
      duration: 17.03,
      lines: [
        { text: "Here is the clever way to tell the two spoons apart.", at: 0 },
        { text: "The two spoons look exactly the same, resting side by side.", at: 3.46 },
        { text: "Press the tip of each spoon: one flexes and bends, and the other stays stiff.", at: 8.08 },
        { text: "Whether it bends is the property that tells the two spoons apart!", at: 13.14 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:materials:magnet": {
    kind: "magnet-sort",
    labelSetup: "A pile of small bits rests, with a magnet held clear.",
    labelSolved: "The magnet passes, and some bits leap up to it.",
    summary: {
      clip: "magnet-sort.mp3",
      duration: 20.24,
      lines: [
        { text: "Here is the clever way to sort the look-alike bits.", at: 0 },
        { text: "The pile holds iron bits, wooden bits and plastic bits, all mixed together.", at: 3.44 },
        { text: "The magnet passes over the pile, and only the iron bits leap up to meet it.", at: 9.04 },
        { text: "A magnet pulls iron, but not wood or plastic — the iron bits are the ones that jump!", at: 14.19 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:pieces:rebuild": {
    kind: "rebuild-pieces",
    labelSetup: "A short bridge model stands on the table.",
    labelSolved: "The pieces come apart and rebuild into a longer bridge.",
    summary: {
      clip: "rebuild.mp3",
      duration: 17.5,
      lines: [
        { text: "Here is the clever way to make the bridge longer.", at: 0 },
        { text: "The bridge model stands too short, built from its pieces.", at: 3.33 },
        { text: "Take the pieces apart, and lay them out in a longer line, using every single piece.", at: 7.31 },
        { text: "Yes — you can rebuild it longer with the same pieces, adding nothing new!", at: 13.12 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:states:road-salt": {
    kind: "salt-melt",
    labelSetup: "Salt specks rest on an icy road under cold air.",
    labelSolved: "The ice melts around the specks while the air stays cold.",
    summary: {
      clip: "road-salt.mp3",
      duration: 20.05,
      lines: [
        { text: "Here is the clever way salt clears an icy road.", at: 0 },
        { text: "The road is frozen, and the air above it stays cold.", at: 3.17 },
        { text: "Salt specks rest on the ice, and the ice melts around each speck, though the air never warms.", at: 6.97 },
        { text: "Salt lowers the freezing point of the water in the ice, so the ice melts even while the road stays cold!", at: 13.55 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:mixtures:dissolve": {
    kind: "dissolve",
    labelSetup: "Crystals rest whole in a glass of water.",
    labelSolved: "The crystals break into tiny dots spread through the water.",
    summary: {
      clip: "dissolve.mp3",
      duration: 18.62,
      lines: [
        { text: "Here is the clever way to find the solid that vanished.", at: 0 },
        { text: "The crystals sit whole in the glass of water, easy to see.", at: 3.73 },
        { text: "Stirring breaks the crystals into smaller and smaller pieces, until the pieces spread through all the water.", at: 7.71 },
        { text: "It is still there, as pieces too small to see, spread through the water!", at: 14.5 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:states:particles": {
    kind: "particle-states",
    labelSetup: "Ice, water and vapour stand in three panels above a kettle.",
    labelSolved: "Warmth steps the panels from packed to loose to flying apart.",
    summary: {
      clip: "particles.mp3",
      duration: 17.5,
      lines: [
        { text: "Here is the clever way to follow the water's three states.", at: 0 },
        { text: "In the ice, the water's pieces sit packed tight together.", at: 3.77 },
        { text: "Warmth loosens them into liquid water, and more warmth sends them flying apart as vapour.", at: 7.5 },
        { text: "Warmth changed the water, from solid to liquid to gas!", at: 13.89 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:water:cycle": {
    kind: "water-cycle",
    labelSetup: "A puddle rests under an open sky.",
    labelSolved: "The puddle shrinks, wisps rise, and rain falls back.",
    summary: {
      clip: "water-cycle.mp3",
      duration: 17.19,
      lines: [
        { text: "Here is the clever way to follow the vanished puddle.", at: 0 },
        { text: "The puddle rests on the ground under an open sky.", at: 3.41 },
        { text: "Warmth lifts the water into the air as wisps, and the wisps gather into a cloud.", at: 6.69 },
        { text: "The water went into the air, a cloud gathered, and it comes back as rain or snow!", at: 12.07 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
  "chemistry:materials:identify": {
    kind: "dissolve",
    threeBlocks: true,
    labelSetup: "Three unmarked blocks rest beside three glasses of water.",
    labelSolved: "One block dissolves away, and the others stay whole.",
    summary: {
      clip: "identify.mp3",
      duration: 20.76,
      lines: [
        { text: "Here is the clever way to tell the three blocks apart.", at: 0 },
        { text: "Three unmarked blocks rest beside three glasses of water, and nothing marks which is which.", at: 3.52 },
        { text: "Drop one block into each glass: one block dissolves away, and the other two stay whole.", at: 9.81 },
        { text: "Whether each block dissolves in water is the test that tells the blocks apart!", at: 15.98 },
      ],
      beats: [0, 1, 1, 1],
    },
  },
};

export function clueSceneFor(itemId: string): ClueSceneDescription | null {
  return CHEMISTRY_CLUE_SCENES[itemId] ?? null;
}
