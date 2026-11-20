/**
 * Firing proof for the architecture guardrails (eslint/layer-rule.mjs):
 * an upward import, a feature-screen cross import, the folded-in
 * game -> subjects ban, and each raw-I/O shape must fail lint, and
 * the neighbouring legal code must not. Runs the real exported
 * config blocks through ESLint's Linter on virtual files, so the
 * proof cannot drift from the rules CI enforces (the
 * game-boundary-rule.test.mjs pattern).
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

const hits = (messages, ruleId) => messages.filter((m) => m.ruleId === ruleId);

describe("layer/no-upward-import", () => {
  it("fires on an upward import (domain file importing a feature screen)", () => {
    const messages = lint(
      'import { LoopScreen } from "./loop/LoopScreen.tsx";\nconsole.log(LoopScreen);\n',
      "src/game/fixture-store.ts",
    );
    assert.equal(hits(messages, "layer/no-upward-import").length, 1, JSON.stringify(messages));
  });

  it("fires on a feature screen importing another feature area", () => {
    const messages = lint(
      'import { InfoPage } from "../grownups/info-page.tsx";\nconsole.log(InfoPage);\n',
      "src/components/fixture-screen.tsx",
    );
    assert.equal(hits(messages, "layer/no-upward-import").length, 1, JSON.stringify(messages));
  });

  it("fires on src/game importing src/subjects (the folded-in PR 533 ban)", () => {
    const messages = lint(
      'import { clearAllSubjectProgress } from "../subjects/shared/subject-progress.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/game/fixture-reset.ts",
    );
    const found = hits(messages, "layer/no-upward-import");
    assert.equal(found.length, 1, JSON.stringify(messages));
    assert.match(found[0].message, /never the reverse/);
  });

  it("stays quiet on a downward import and on subjects importing game", () => {
    const down = lint(
      'import { clearAllSubjectProgress } from "./subject-progress-store-key.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/game/fixture-reset.ts",
    );
    assert.deepEqual(hits(down, "layer/no-upward-import"), []);
    const subjectsSide = lint(
      'import { clearAllSubjectProgress } from "../../game/subject-progress-store-key.ts";\nconsole.log(clearAllSubjectProgress);\n',
      "src/subjects/shared/fixture-progress.ts",
    );
    assert.deepEqual(hits(subjectsSide, "layer/no-upward-import"), []);
  });
});

describe("platform/no-raw-io", () => {
  it("fires on fetch(, new Audio( and localStorage outside src/platform", () => {
    const file = "src/components/fixture-screen.tsx";
    for (const code of [
      'fetch("/api/x");\n',
      'window.fetch("/api/x");\n',
      "const a = new Audio(\"/x.mp3\");\nconsole.log(a);\n",
      'localStorage.getItem("k");\n',
      'sessionStorage.setItem("k", "v");\n',
    ]) {
      const messages = lint(code, file);
      assert.equal(hits(messages, "platform/no-raw-io").length, 1, `${code} -> ${JSON.stringify(messages)}`);
    }
  });

  it("stays quiet inside src/platform and in test files", () => {
    const port = lint('fetch("/api/x");\nlocalStorage.getItem("k");\n', "src/platform/http.ts");
    assert.deepEqual(hits(port, "platform/no-raw-io"), []);
    const test = lint('fetch("/api/x");\n', "src/components/fixture-screen.test.ts");
    assert.deepEqual(hits(test, "platform/no-raw-io"), []);
  });
});
