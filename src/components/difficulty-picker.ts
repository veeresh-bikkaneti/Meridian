/**
 * DifficultyPicker (FW-11.1) — the shared Easy/Medium/Hard picker,
 * extracted from the home hero (game-app.tsx Choose). Bound to one
 * module: it reads and writes that module's choice through
 * useModuleDifficulty, so each MapTap edition keeps its own path.
 *
 * Renders the labelled group, aria-pressed pills, and the live hint.
 * The select chirps only on an actual change — re-tapping the active
 * band stays silent (SFX audio spec §2.6). The 44px targets come
 * from the shared `hv5-diff` styling.
 *
 * Written with createElement (not JSX) so the node unit harness can
 * render it, like home-button.ts.
 */
import { createElement } from "react";
import { playDifficultySelect } from "../game/audio/sfx.ts";
import {
  getModuleDifficulty,
  PICKER_DIFFICULTIES,
  type ModuleId,
} from "../game/module-difficulty.ts";
import type { PickerDifficulty } from "../game/tier-filter.ts";
import { useModuleDifficulty } from "./use-difficulty-choice.ts";

const PICKER_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

interface DifficultyPickerProps {
  /** The module this picker binds to (globe / country / state). */
  moduleId: ModuleId;
  className?: string;
  /** Test id for the picker wrapper (e.g. "tour-stop-difficulty"). */
  testId?: string;
  /** Accessible label id; defaults to a per-module id. */
  labelId?: string;
}

/**
 * The picker's selection step, extracted so the chirp guard is
 * unit-testable: chirp only when the band actually changes, then
 * apply the choice. `chirp` defaults to playDifficultySelect; tests
 * pass a stub to observe the guard. (SFX audio spec §2.6:
 * re-tapping the active band stays silent.)
 */
export function selectDifficulty(
  next: PickerDifficulty,
  current: PickerDifficulty,
  setChoice: (choice: PickerDifficulty) => void,
  chirp: () => void = playDifficultySelect,
): void {
  if (next !== current) chirp();
  setChoice(next);
}

export function DifficultyPicker({
  moduleId,
  className,
  testId,
  labelId,
}: DifficultyPickerProps) {
  const [choice, setChoice] = useModuleDifficulty(moduleId);
  const entry = getModuleDifficulty(moduleId);
  // A module that does not show the picker renders nothing. The hook
  // stays above this return (Rules of Hooks): it only reads the
  // module's stored choice, which a stub never changes.
  if (!entry.showsPicker || entry.supported.length === 0) return null;
  const id = labelId ?? `difficulty-label-${moduleId}`;
  return createElement(
    "div",
    { className, "data-testid": testId },
    createElement("p", { id, className: "hv5-diff-cap" }, "How do you want to grow your map today?"),
    createElement(
      "div",
      { role: "group", "aria-labelledby": id, className: "hv5-diff" },
      PICKER_DIFFICULTIES.map((value) => {
        const selected = choice === value;
        return createElement(
          "button",
          {
            key: value,
            type: "button",
            "aria-pressed": selected,
            onClick: () => selectDifficulty(value, choice, setChoice),
          },
          PICKER_LABELS[value],
        );
      }),
    ),
    createElement(
      "p",
      { className: "hv5-hint", "aria-live": "polite" },
      entry.hints[choice],
    ),
  );
}
