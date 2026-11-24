#!/usr/bin/env node
/**
 * ci-required.mjs: run the AGENTS.md section 9 gates (plus lint:nav,
 * lint:arch, lint:subjects, check:provenance, check:entry-size) in order,
 * keep going after a failure, and print one PASS / FAIL / NOT RUN table.
 *
 * - A gate whose npm script or command file does not exist in this tree is
 *   NOT RUN, with the reason in the table. Playwright e2e is always NOT RUN
 *   here: this runner has no browser.
 * - check:provenance needs the git range origin/main..HEAD, so in a
 *   non-git tree (or one without origin/main) it is NOT RUN.
 * - `lint` is report-only until Phase 5: its result prints in the table
 *   but never changes the exit code.
 *
 * Exit code: 1 when any non-report-only gate FAILs, else 0.
 * The table logic (renderTable / summarize) is pure and unit-tested in
 * scripts/ci-required.test.mjs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const GATES = [
  { name: "tsc", cmd: ["npx", "tsc", "--noEmit"] },
  { name: "npm test", script: "test" },
  { name: "test:worker", script: "test:worker" },
  { name: "lint-cards", cmd: ["node", "scripts/lint-cards.mjs"] },
  { name: "build:pages", script: "build:pages" },
  { name: "lint:nav", script: "lint:nav" },
  { name: "lint:arch", script: "lint:arch" },
  { name: "lint:subjects", script: "lint:subjects" },
  { name: "check:provenance", script: "check:provenance", needsGitRange: true },
  { name: "check:entry-size", script: "check:entry-size" },
  { name: "check:seam-bundle", script: "check:seam-bundle" },
  { name: "Playwright e2e", notRunReason: "no browser in this runner" },
  { name: "lint", script: "lint", reportOnly: true },
];

/** Exit code for a list of gate results: report-only FAILs never fail. */
export function summarize(results) {
  return results.some((r) => r.status === "FAIL" && !r.reportOnly) ? 1 : 0;
}

function reasonFor(r) {
  const parts = [];
  if (r.status === "NOT RUN") parts.push(r.reason ?? "not run");
  if (r.status === "FAIL" && r.exitCode != null) parts.push(`exit code ${r.exitCode}`);
  if (r.reportOnly) parts.push("report-only");
  return parts.join("; ");
}

/** Render results as one markdown table: gate | result | reason / note. */
export function renderTable(results) {
  const lines = ["| Gate | Result | Reason / note |", "| :--- | :--- | :--- |"];
  for (const r of results) lines.push(`| ${r.name} | ${r.status} | ${reasonFor(r)} |`);
  return lines.join("\n");
}

function hasGitRange() {
  if (!existsSync(".git")) return false;
  const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", "origin/main"], {
    stdio: "ignore",
  });
  return r.status === 0;
}

function runGate(gate, scripts) {
  const base = { name: gate.name, reportOnly: Boolean(gate.reportOnly) };
  if (gate.notRunReason) return { ...base, status: "NOT RUN", reason: gate.notRunReason };
  if (gate.script && !(gate.script in scripts))
    return { ...base, status: "NOT RUN", reason: `no "${gate.script}" script in package.json` };
  if (gate.cmd?.[0] === "node" && !existsSync(gate.cmd[1]))
    return { ...base, status: "NOT RUN", reason: `${gate.cmd[1]} does not exist in this tree` };
  if (gate.needsGitRange && !hasGitRange())
    return {
      ...base,
      status: "NOT RUN",
      reason: "no git range: not a git repository, or no origin/main (needs origin/main..HEAD)",
    };
  const [cmd, args] = gate.script
    ? ["npm", ["run", gate.script]]
    : [gate.cmd[0], gate.cmd.slice(1)];
  console.log(`\n=== ${gate.name}: ${cmd} ${args.join(" ")} ===`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.error) return { ...base, status: "FAIL", reason: `could not start: ${r.error.message}` };
  return { ...base, status: r.status === 0 ? "PASS" : "FAIL", exitCode: r.status };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const results = GATES.map((gate) => runGate(gate, pkg.scripts ?? {}));
  console.log(`\n${renderTable(results)}`);
  process.exit(summarize(results));
}
