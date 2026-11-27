/**
 * Per-module Easy/Medium/Hard learning path (FW-11.1).
 *
 * The home hero used to hold one global picker ("How do you want to
 * grow your map today?") whose choice was stored once and applied to
 * every MapTap edition. Each module/edition now owns its own choice,
 * so a module can tailor its own path. This registry is the single
 * place that says which modules show the picker, which levels they
 * support, and what hint copy each level gets.
 *
 * The picker itself is scaffolding, not gamer difficulty: Easy /
 * Medium / Hard are fame-tier bands (easy 1–2, medium 2–4, hard 4–5
 * — see tier-filter.ts). They are NOT the age-band difficulty system
 * (pin radius, GeoDetective clue counts, guess caps in
 * age-profile/difficulty.ts), which this module does not touch.
 *
 * Modules that do not show the picker (GeoDetective, Cold Trail,
 * Subjects, Review, Friend challenge) are stubs: `showsPicker` is
 * false and `supported` is empty, and their run behaviour must not
 * change. A later FW-11.x may give them a picker with an owner
 * design; this item does not invent one.
 */
import {
  isPickerDifficulty,
  PICKER_DIFFICULTIES,
  type PickerDifficulty,
} from "./tier-filter.ts";

/**
 * Kid-friendly hints for each learning path, shown under the picker.
 * The same copy the home hero showed (game-app.tsx DIFFICULTY_HINTS),
 * moved here so every module picker shares one source.
 */
export const DIFFICULTY_HINTS: Record<PickerDifficulty, string> = {
  easy: "Famous places — the spots every explorer starts with.",
  medium: "A little of everything — grow your map one discovery at a time.",
  hard: "Hidden corners of the world — for explorers ready to discover more.",
};

/** The modules that can own a learning-path choice. */
export type ModuleId =
  | "globe"
  | "country"
  | "state"
  | "geodetective"
  | "coldtrail"
  | "subjects"
  | "review"
  | "challenge";

export function isModuleId(value: unknown): value is ModuleId {
  return (
    value === "globe" ||
    value === "country" ||
    value === "state" ||
    value === "geodetective" ||
    value === "coldtrail" ||
    value === "subjects" ||
    value === "review" ||
    value === "challenge"
  );
}

export interface ModuleDifficultyEntry {
  /** The picker levels this module supports (empty when it shows no picker). */
  supported: readonly PickerDifficulty[];
  /** The choice a module starts with when nothing is stored. */
  defaultChoice: PickerDifficulty;
  /** Whether the module renders the picker. */
  showsPicker: boolean;
  /** Short display label for the module. */
  label: string;
  /** Per-level hint copy, shown under the picker. */
  hints: Record<PickerDifficulty, string>;
}

export const MODULE_DIFFICULTY: Record<ModuleId, ModuleDifficultyEntry> = {
  globe: {
    supported: PICKER_DIFFICULTIES,
    defaultChoice: "medium",
    showsPicker: true,
    label: "Globe",
    hints: DIFFICULTY_HINTS,
  },
  country: {
    supported: PICKER_DIFFICULTIES,
    defaultChoice: "medium",
    showsPicker: true,
    label: "Country",
    hints: DIFFICULTY_HINTS,
  },
  state: {
    supported: PICKER_DIFFICULTIES,
    defaultChoice: "medium",
    showsPicker: true,
    label: "State",
    hints: DIFFICULTY_HINTS,
  },
  geodetective: {
    supported: [],
    defaultChoice: "medium",
    showsPicker: false,
    label: "GeoDetective",
    hints: DIFFICULTY_HINTS,
  },
  coldtrail: {
    supported: [],
    defaultChoice: "medium",
    showsPicker: false,
    label: "Cold Trail",
    hints: DIFFICULTY_HINTS,
  },
  subjects: {
    supported: [],
    defaultChoice: "medium",
    showsPicker: false,
    label: "Subjects",
    hints: DIFFICULTY_HINTS,
  },
  review: {
    supported: [],
    defaultChoice: "medium",
    showsPicker: false,
    label: "Review",
    hints: DIFFICULTY_HINTS,
  },
  challenge: {
    supported: [],
    defaultChoice: "medium",
    showsPicker: false,
    label: "Friend challenge",
    hints: DIFFICULTY_HINTS,
  },
};

export function getModuleDifficulty(moduleId: ModuleId): ModuleDifficultyEntry {
  return MODULE_DIFFICULTY[moduleId];
}

/** Re-export the validator and the level list for callers that read the stored map. */
export { isPickerDifficulty, PICKER_DIFFICULTIES };
