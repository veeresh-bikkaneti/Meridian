/**
 * Firing proof for the game→subjects layering guard, folded into
 * the architecture layer rule in Phase 0 PR 0.2
 * (eslint/layer-rule.mjs, rule layer/no-upward-import; the old
 * eslint/game-boundary-rule.mjs copy is deleted): a file under
 * src/game that imports from src/subjects must fail lint, and the
 * neighbouring legal imports must not. Runs the real exported
 * config blocks through ESLint's Linter on virtual files, so the
 * proof cannot drift from the rule CI enforces. The guarded case
 * is src/game/subject-progress-store-key.ts: the shared store the
 * reset composition uses, which lives under src/game precisely so
 * this import direction stays legal.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import { layerArchConfigs } from "../eslint/layer-rule.mjs";

const linter = new Linter();

const lint = (code, filename) =>
  linter.verify(
    code,
    [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { ecmaVersion: 2022, sourceType: "module" },
      },
      ...layerArchConfigs,
    ],
    { filename },
  );

describe("game-boundary rule (no game → subjects imports)", () => {
  it("fires on a src/game file importing from src/subjects", () => {
    const messages = lint(
      'import { clearAllSubjectProgress } from "../subjects/shared/subject-progress.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/game/reset-history.ts",
    );
    const hits = messages.filter((m) => m.ruleId === "layer/no-upward-import");
    assert.equal(hits.length, 1, `expected exactly one boundary error, got: ${JSON.stringify(messages)}`);
    assert.match(hits[0].message, /subjects depend on game, never the reverse/);
  });

  it("fires on a nested src/game file reaching up two levels", () => {
    const messages = lint(
      'import { x } from "../../subjects/shared/subject-progress.ts";\nconsole.log(x);\n',
      "src/game/loop/store.ts",
    );
    assert.equal(
      messages.filter((m) => m.ruleId === "layer/no-upward-import").length,
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
