import { useCallback, useState } from "react";
import { isPickerDifficulty, type PickerDifficulty } from "../game/tier-filter.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";
import { getStorageItem, setStorageItem } from "../platform/storage/browser-storage.ts";

/**
 * The picker's difficulty choice, persisted across page loads. Invalid or
 * missing values fall back to "medium" — the choice applies across
 * Globe → Country → State and survives edition switches.
 *
 * The port's difficulty def returns the stored string as-is (or the
 * "medium" fallback when the value is missing, unreadable or blocked),
 * so the isPickerDifficulty check below is the one validation, exactly
 * where it ran before the port.
 */
export function readDifficultyChoice(): PickerDifficulty {
  const raw = getStorageItem(STORAGE_KEYS.difficulty);
  return isPickerDifficulty(raw) ? raw : "medium";
}

export function writeDifficultyChoice(choice: PickerDifficulty) {
  // The port swallows a blocked write: the in-memory choice still
  // applies this session.
  setStorageItem(STORAGE_KEYS.difficulty, choice);
}

/**
 * Difficulty picker state: one choice applies across Globe → Country →
 * State and survives edition switches. Persisted so it survives reloads
 * too.
 */
export function useDifficultyChoice(): [
  PickerDifficulty,
  (choice: PickerDifficulty) => void,
] {
  const [difficultyChoice, setDifficultyChoiceState] = useState<PickerDifficulty>(readDifficultyChoice);
  const setDifficultyChoice = useCallback((choice: PickerDifficulty) => {
    setDifficultyChoiceState(choice);
    writeDifficultyChoice(choice);
  }, []);
  return [difficultyChoice, setDifficultyChoice];
}
