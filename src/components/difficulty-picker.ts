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

export function DifficultyPicker({
  moduleId,
  className,
  testId,
  labelId,
}: DifficultyPickerProps) {
  const [choice, setChoice] = useModuleDifficulty(moduleId);
  const entry = getModuleDifficulty(moduleId);
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
            onClick: () => {
              // SFX audio spec §2.6: the select chirps only on an
              // actual change — re-tapping the active band stays silent.
              if (value !== choice) playDifficultySelect();
              setChoice(value);
            },
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
