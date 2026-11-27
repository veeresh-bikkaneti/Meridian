/**
 * Picker difficulty — a leaf state owner extracted from game-app.tsx
 * (game-app-map step 3, TD-06.5). The choice is persisted through the
 * storage port under STORAGE_KEYS.difficulty; the hook holds the
 * in-memory state and writes every change through the port.
 */
import { useCallback, useState } from "react";
import {
  getModuleDifficulty,
  type ModuleId,
} from "../game/module-difficulty.ts";
import { isPickerDifficulty, type PickerDifficulty } from "../game/tier-filter.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";
import {
  getStorageItem,
  setStorageItem,
} from "../platform/storage/browser-storage.ts";

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

export function useDifficultyChoice(): [
  PickerDifficulty,
  (choice: PickerDifficulty) => void,
] {
  const [difficultyChoice, setDifficultyChoiceState] =
    useState<PickerDifficulty>(readDifficultyChoice);
  const setDifficultyChoice = useCallback((choice: PickerDifficulty) => {
    setDifficultyChoiceState(choice);
    writeDifficultyChoice(choice);
  }, []);
  return [difficultyChoice, setDifficultyChoice];
}

/**
 * Per-module difficulty (FW-11.1): one choice per module/edition,
 * stored as a JSON map under STORAGE_KEYS.difficultyByModule.
 * New writes go to the map only; the legacy `meridian.difficulty`
 * key is left in place and is only ever read, once, to seed the
 * migration below.
 */
function readModuleDifficultyMap(): Record<string, string> {
  return getStorageItem(STORAGE_KEYS.difficultyByModule);
}

function writeModuleDifficultyMap(map: Record<string, string>): void {
  setStorageItem(STORAGE_KEYS.difficultyByModule, map);
}

/**
 * The per-module map, seeded from the legacy global choice on first
 * use — read or write. When the map is missing/empty, globe, country
 * and state start from `meridian.difficulty` (or "medium" when it is
 * invalid). The legacy key is left in place; new writes go to the
 * map only. Both the read and the write path go through here so a
 * write before any read cannot lose the legacy seed.
 */
function seededModuleDifficultyMap(): Record<string, string> {
  const map = readModuleDifficultyMap();
  if (Object.keys(map).length === 0) {
    const legacy = readDifficultyChoice();
    const seeded = { globe: legacy, country: legacy, state: legacy };
    writeModuleDifficultyMap(seeded);
    return seeded;
  }
  return map;
}

/**
 * One module's stored choice. A stored value that is not a picker
 * choice falls back to that module's defaultChoice ("medium" for
 * every module today).
 */
export function readModuleDifficulty(moduleId: ModuleId): PickerDifficulty {
  const map = seededModuleDifficultyMap();
  const stored = map[moduleId];
  if (isPickerDifficulty(stored)) return stored;
  return getModuleDifficulty(moduleId).defaultChoice;
}

export function writeModuleDifficulty(
  moduleId: ModuleId,
  choice: PickerDifficulty,
): void {
  // Spread, never replace: a write for one module must not clobber
  // another module's stored choice. The seed runs first, so a write
  // before any read still carries the legacy choice into the other
  // MapTap modules.
  writeModuleDifficultyMap({ ...seededModuleDifficultyMap(), [moduleId]: choice });
}

export function useModuleDifficulty(moduleId: ModuleId): [
  PickerDifficulty,
  (choice: PickerDifficulty) => void,
] {
  const [choice, setChoiceState] = useState<PickerDifficulty>(() =>
    readModuleDifficulty(moduleId),
  );
  const setChoice = useCallback(
    (next: PickerDifficulty) => {
      setChoiceState(next);
      writeModuleDifficulty(moduleId, next);
    },
    [moduleId],
  );
  return [choice, setChoice];
}
