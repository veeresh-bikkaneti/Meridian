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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
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

  it("names the ARCHITECTURE.md layer numbers in an upward-import message", () => {
    const messages = lint(
      'import { InfoPage } from "../grownups/info-page.tsx";\nconsole.log(InfoPage);\n',
      "src/components/ui/fixture.tsx",
    );
    const found = hits(messages, "layer/no-upward-import");
    assert.equal(found.length, 1, JSON.stringify(messages));
    assert.equal(
      found[0].message,
      "Upward import: shared-ui (layer 4) must not import feature (layer 5). Imports point down only — move the shared code down a layer (see ARCHITECTURE.md).",
    );
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

  it("fires on src/game re-exporting from src/subjects, with the game message", () => {
    for (const code of [
      'export { thing } from "../subjects/shared/subject-progress.ts";\n',
      'export * from "../subjects/shared/subject-progress.ts";\n',
    ]) {
      const messages = lint(code, "src/game/fixture-reset.ts");
      const found = hits(messages, "layer/no-upward-import");
      assert.equal(found.length, 1, `${code} -> ${JSON.stringify(messages)}`);
      assert.match(found[0].message, /never the reverse/);
    }
  });

  it("fires on src/game dynamically importing src/subjects, with the game message", () => {
    const messages = lint(
      'const m = await import("../subjects/shared/subject-progress.ts");\nconsole.log(m);\n',
      "src/game/fixture-reset.ts",
    );
    const found = hits(messages, "layer/no-upward-import");
    assert.equal(found.length, 1, JSON.stringify(messages));
    assert.match(found[0].message, /never the reverse/);
  });

  it("fires on an upward re-export (feature screen re-exporting the shell router)", () => {
    const messages = lint('export { router } from "../router.tsx";\n', "src/components/fixture-screen.tsx");
    const found = hits(messages, "layer/no-upward-import");
    assert.equal(found.length, 1, JSON.stringify(messages));
    assert.match(found[0].message, /Upward import/);
  });

  it("stays quiet on a feature screen importing a shell part (layer 4 shared UI)", () => {
    const messages = lint(
      'import { SiteHeader } from "../ui/site-header.tsx";\nconsole.log(SiteHeader);\n',
      "src/components/grownups/fixture-screen.tsx",
    );
    assert.deepEqual(hits(messages, "layer/no-upward-import"), []);
  });

  it("stays quiet when two top-level src/components files import each other (one shared area, components/root)", () => {
    const messages = lint(
      'import { helper } from "./fixture-helper.ts";\nconsole.log(helper);\n',
      "src/components/fixture-screen.tsx",
    );
    assert.deepEqual(hits(messages, "layer/no-upward-import"), []);
  });

  it("fires on a feature screen importing another feature area (grownups -> board)", () => {
    const messages = lint(
      'import { Board } from "../board/fixture-board.tsx";\nconsole.log(Board);\n',
      "src/components/grownups/fixture-screen.tsx",
    );
    assert.equal(hits(messages, "layer/no-upward-import").length, 1, JSON.stringify(messages));
  });

  it("fires on a nested src/game file importing src/subjects, with the game message", () => {
    const messages = lint(
      'import { thing } from "../../subjects/math/fixture.ts";\nconsole.log(thing);\n',
      "src/game/loop/fixture-store.ts",
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

  it("fires on computed global access (bracket forms of fetch and storage)", () => {
    const file = "src/components/fixture-screen.tsx";
    for (const code of [
      'globalThis["fetch"]("/api/x");\n',
      'window["fetch"]("/api/x");\n',
      'window["localStorage"].getItem("k");\n',
      'globalThis["sessionStorage"].setItem("k", "v");\n',
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

  it("baseline is per-violation: one listed fetch() is suppressed, a second unlisted one fires", async () => {
    // The production baseline no longer holds a fetch() row (TD-02.7
    // cured the last one). This case injects its own baseline next
    // to a copy of the rule, so the proof does not depend on a
    // production row.
    const repoRoot = fileURLToPath(new URL("..", import.meta.url));
    const dir = mkdtempSync(join(repoRoot, ".layer-rule-fixture-"));
    const file = "src/fixture/per-violation.tsx";
    try {
      writeFileSync(join(dir, "layer-rule.mjs"), readFileSync(new URL("../eslint/layer-rule.mjs", import.meta.url)));
      writeFileSync(
        join(dir, "layer-baseline.json"),
        JSON.stringify({
          noUpwardImport: [],
          noRawIo: [`${file}|fetch()`],
        }),
      );
      const injected = await import(pathToFileURL(join(dir, "layer-rule.mjs")).href);
      const local = new Linter();
      const verify = (code) =>
        local.verify(
          code,
          [
            {
              files: ["**/*.{ts,tsx}"],
              languageOptions: { ecmaVersion: 2022, sourceType: "module" },
            },
            ...injected.layerArchConfigs,
          ],
          { filename: file },
        );
      const one = verify('fetch("/api/x");\n');
      assert.deepEqual(hits(one, "platform/no-raw-io"), [], JSON.stringify(one));
      const two = verify('fetch("/api/x");\nfetch("/api/y");\n');
      assert.equal(hits(two, "platform/no-raw-io").length, 1, JSON.stringify(two));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
