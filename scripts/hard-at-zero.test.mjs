/**
 * Hard at zero: one rule for every architecture gauge.
 *
 * A gauge whose baseline count is 0 reports an error, and that error
 * fails CI (eslint exits non-zero; warnings do not, because the lint
 * scripts do not pass --max-warnings). A gauge whose baseline is still
 * above zero only warns. The live baselines are noRawIo 0,
 * noUpwardImport 129, shell-ban 14 — this file must not raise them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GAUGE_RULES, hardAtZero } from "../eslint/hard-at-zero.mjs";
import { gaugeCounts, gaugeSeverity } from "../eslint.config.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");

/** CI fails only when eslint reports an error. A warning does not. */
function failsCi(status) {
  return status !== 0;
}

function lintStdin(configRel, filename, code) {
  const result = spawnSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/eslint/bin/eslint.js"),
      "--no-inline-config",
      "-c",
      join(repoRoot, configRel),
      "--stdin",
      "--stdin-filename",
      filename,
    ],
    { cwd: repoRoot, input: code, encoding: "utf8" },
  );
  return { status: result.status, out: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

describe("hard at zero", () => {
  it("returns error only at a zero baseline", () => {
    assert.equal(hardAtZero(0), "error");
    assert.equal(hardAtZero(1), "warn");
    assert.equal(hardAtZero(14), "warn");
    assert.equal(hardAtZero(129), "warn");
  });

  it("does not raise the live baselines", () => {
    assert.equal(gaugeCounts.noRawIo, 0);
    assert.ok(gaugeCounts.noUpwardImport <= 129, `noUpwardImport ${gaugeCounts.noUpwardImport} > 129`);
    assert.ok(gaugeCounts.shellBan <= 14, `shell-ban ${gaugeCounts.shellBan} > 14`);
  });

  it("sets every gauge from the one rule, not a hand-written severity", () => {
    for (const [gauge, ruleIds] of Object.entries(GAUGE_RULES)) {
      const expected = hardAtZero(gaugeCounts[gauge]);
      for (const ruleId of ruleIds) assert.equal(gaugeSeverity[ruleId], expected, ruleId);
    }
    assert.equal(gaugeSeverity["platform/no-raw-io"], "error");
    assert.equal(gaugeSeverity["layer/no-upward-import"], hardAtZero(gaugeCounts.noUpwardImport));
    assert.equal(gaugeSeverity["shell/no-max-w-none"], hardAtZero(gaugeCounts.shellBan));
    // A zero count flips that gauge, including one that is non-zero today.
    assert.equal(hardAtZero(0), "error");
  });

  it("keeps the rule in the editor config and the CI workflow, and does not fail CI on a warning", () => {
    const editor = read("eslint.config.mjs");
    const workflow = read(".github/workflows/node.js.yml");
    const pkg = JSON.parse(read("package.json"));
    assert.match(editor, /hardAtZero\(/);
    assert.match(workflow, /hard at zero/i);
    assert.match(workflow, /npm run lint:arch/);
    assert.match(workflow, /npm run lint:nav/);
    assert.doesNotMatch(pkg.scripts["lint:arch"], /max-warnings/);
    assert.doesNotMatch(pkg.scripts["lint:nav"], /max-warnings/);
    for (const line of workflow.split("\n").filter((line) => /^\s*- run:/.test(line) || /^\s*run:/.test(line))) {
      assert.doesNotMatch(line, /max-warnings/, line);
    }
    // The other configs consume the map; they do not hand-set a gauge.
    assert.match(read("eslint.arch.config.mjs"), /gaugeSeverity/);
    assert.match(read("eslint.nav.config.mjs"), /gaugeSeverity/);
    assert.doesNotMatch(read("eslint.arch.config.mjs"), /hardAtZero\(/);
    assert.doesNotMatch(read("eslint.nav.config.mjs"), /hardAtZero\(/);
  });

  it("fails CI on one raw I/O call now that noRawIo is 0", () => {
    assert.equal(gaugeCounts.noRawIo, 0);
    const result = lintStdin(
      "eslint.arch.config.mjs",
      "src/lib/zz-hard-at-zero-probe.ts",
      'export function probe() {\n  return fetch("/zz-hard-at-zero");\n}\n',
    );
    assert.match(result.out, /platform\/no-raw-io/);
    assert.match(result.out, /1 error, 0 warnings/);
    assert.equal(failsCi(result.status), true, result.out);
  });

  it("only warns for a gauge whose baseline is still above zero", () => {
    assert.ok(gaugeCounts.noUpwardImport > 0);
    const upward = lintStdin(
      "eslint.arch.config.mjs",
      "src/lib/zz-hard-at-zero-upward.ts",
      'import { board } from "../routes/board.tsx";\nexport const probe = board;\n',
    );
    assert.match(upward.out, /layer\/no-upward-import/);
    assert.match(upward.out, /0 errors, 1 warning/);
    assert.equal(failsCi(upward.status), false, upward.out);

    assert.ok(gaugeCounts.shellBan > 0);
    const shell = lintStdin(
      "eslint.nav.config.mjs",
      "src/components/zz-hard-at-zero-shell.tsx",
      "export function Probe() {\n  return <header>Probe</header>;\n}\n",
    );
    assert.match(shell.out, /shell\/no-page-local-header-footer/);
    assert.match(shell.out, /0 errors, 1 warning/);
    assert.equal(failsCi(shell.status), false, shell.out);
  });
});
