/**
 * Firing proof for the game→subjects layering guard
 * (eslint/game-boundary-rule.mjs): a file under src/game that
 * imports from src/subjects must fail lint, and the neighbouring
 * legal imports must not. Runs the real exported config block
 * through ESLint's Linter on virtual files, so the proof cannot
 * drift from the rule CI enforces.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import { gameBoundaryConfig } from "../eslint/game-boundary-rule.mjs";

const linter = new Linter();

const lint = (code, filename) =>
  linter.verify(
    code,
    [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { ecmaVersion: 2022, sourceType: "module" },
      },
      gameBoundaryConfig,
    ],
    { filename },
  );

describe("game-boundary rule (no game → subjects imports)", () => {
  it("fires on a src/game file importing from src/subjects", () => {
    const messages = lint(
      'import { clearAllSubjectProgress } from "../subjects/shared/subject-progress.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/game/reset-history.ts",
    );
    const hits = messages.filter((m) => m.ruleId === "no-restricted-imports");
    assert.equal(hits.length, 1, `expected exactly one boundary error, got: ${JSON.stringify(messages)}`);
    assert.match(hits[0].message, /subjects depend on game, never the reverse/);
  });

  it("fires on a nested src/game file reaching up two levels", () => {
    const messages = lint(
      'import { x } from "../../subjects/shared/subject-progress.ts";\nconsole.log(x);\n',
      "src/game/loop/store.ts",
    );
    assert.equal(
      messages.filter((m) => m.ruleId === "no-restricted-imports").length,
      1,
    );
  });

  it("stays silent on game importing game, and on subjects importing game", () => {
    const gameLocal = lint(
      'import { clearAllSubjectProgress } from "./subject-progress-store-key.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/game/reset-history.ts",
    );
    assert.deepEqual(gameLocal, []);
    const subjectsSide = lint(
      'import { clearAllSubjectProgress } from "../../game/subject-progress-store-key.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/subjects/shared/subject-progress.ts",
    );
    assert.deepEqual(subjectsSide, []);
  });
});
