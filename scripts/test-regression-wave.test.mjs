/**
 * Unit tests for scripts/test-regression-wave.mjs.
 *
 * The runner's process-spawning is injected, so these tests stub every
 * child process: no tsc, no eslint, no Playwright run happens here.
 * They pin the profile's contract — argument parsing, the ratchet
 * verdicts (arch counts, shell-ban count, entry size), the printed
 * table, the Playwright lone re-run rule, and the exit code.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  archVerdict,
  collectPlaywrightFailures,
  computeExitCode,
  detectChromium,
  entrySizeVerdict,
  formatTable,
  layerCounts,
  navVerdict,
  parseArgs,
  parseEntrySizeBytes,
  parseNodeTestFailure,
  runProfile,
  shellBanTotal,
} from "./test-regression-wave.mjs";

const entries = (n) => Array.from({ length: n }, (_, i) => `file${i}|x`);

test("parseArgs: defaults, --help, --list, unknown flag rejected", () => {
  assert.deepEqual(parseArgs([]), { help: false, list: false });
  assert.deepEqual(parseArgs(["--help"]), { help: true, list: false });
  assert.deepEqual(parseArgs(["--list"]), { help: false, list: true });
  assert.throws(() => parseArgs(["--bogus"]), /unknown argument/);
});

test("archVerdict: at the ratchet passes, one over fails", () => {
  const at = layerCounts({ noRawIo: entries(13), noUpwardImport: entries(129) });
  assert.deepEqual(at, { noRawIo: 13, noUpwardImport: 129 });
  assert.equal(archVerdict(at).ok, true);
  const overRaw = archVerdict({ noRawIo: 14, noUpwardImport: 129 });
  assert.equal(overRaw.ok, false);
  assert.match(overRaw.note, /noRawIo 14 > 13/);
  const overUp = archVerdict({ noRawIo: 13, noUpwardImport: 130 });
  assert.equal(overUp.ok, false);
  assert.match(overUp.note, /noUpwardImport 130 > 129/);
});

test("shellBanTotal sums every ban list and ignores the comment", () => {
  const baseline = {
    comment: "not a list",
    homeButtonImport: entries(3),
    maxWNone: [],
    pageLocalNav: entries(2),
    pageLocalMain: entries(9),
  };
  assert.equal(shellBanTotal(baseline), 14);
  assert.equal(navVerdict(14).ok, true);
  assert.equal(navVerdict(15).ok, false);
  assert.match(navVerdict(15).note, /shell-ban 15 > 14/);
});

test("entry size: exact bytes parse out of the checker output and the limit is enforced", () => {
  const out = "check-entry-size: entry JS gzip 323,865 B, limit 323,865 B (0 B to spare)";
  assert.equal(parseEntrySizeBytes(out), 323865);
  assert.equal(parseEntrySizeBytes("no size here"), null);
  assert.equal(entrySizeVerdict(323865).ok, true);
  assert.equal(entrySizeVerdict(323866).ok, false);
  assert.match(entrySizeVerdict(323866).note, /323,866 B > 323,865 B limit/);
});

test("formatTable prints the four columns and every row", () => {
  const table = formatTable([
    { suite: "Typecheck", command: "npx tsc --noEmit", result: "PASS", notes: "clean" },
    { suite: "Playwright smoke", command: "npx playwright test ...", result: "NOT RUN", notes: "no Chromium" },
  ]);
  assert.match(table, /Suite or Gate/);
  assert.match(table, /Command/);
  assert.match(table, /Result/);
  assert.match(table, /Notes/);
  assert.match(table, /Typecheck/);
  assert.match(table, /NOT RUN/);
  assert.match(table, /no Chromium/);
});

test("computeExitCode: only a Playwright NOT RUN is allowed in a green run", () => {
  const row = (suite, result) => ({ suite, command: "x", result, notes: "" });
  assert.equal(computeExitCode([row("Typecheck", "PASS"), row("Playwright smoke", "NOT RUN")]), 0);
  assert.equal(computeExitCode([row("Typecheck", "PASS"), row("Playwright smoke", "PASS")]), 0);
  assert.equal(computeExitCode([row("Typecheck", "FAIL"), row("Playwright smoke", "PASS")]), 1);
  assert.equal(computeExitCode([row("Typecheck", "NOT RUN"), row("Playwright smoke", "PASS")]), 1);
});

test("collectPlaywrightFailures walks nested suites and keeps file:line, title, project", () => {
  const report = {
    suites: [
      {
        title: "kanban.spec.ts",
        file: "kanban.spec.ts",
        specs: [
          { title: "board renders", line: 12, ok: true, tests: [{ projectName: "kanban", results: [{ status: "passed" }] }] },
          { title: "board filters", line: 40, ok: false, tests: [{ projectName: "kanban", results: [{ status: "failed" }] }] },
        ],
        suites: [
          {
            title: "nested",
            specs: [
              { title: "deep failure", line: 7, ok: false, tests: [{ projectName: "kanban", results: [{ status: "timedOut" }] }] },
            ],
          },
        ],
      },
    ],
  };
  const failures = collectPlaywrightFailures(report);
  assert.equal(failures.length, 2);
  assert.deepEqual(failures[0], { file: "kanban.spec.ts", line: 40, title: "board filters", project: "kanban" });
  assert.equal(failures[1].title, "deep failure");
});

test("parseNodeTestFailure names the first failing test", () => {
  const out = [
    "✔ fine test (1ms)",
    "✖ credits list is complete (2ms)",
    "  AssertionError [ERR_ASSERTION]: missing entry",
    "      at TestContext.<anonymous> (file:///repo/src/lib/credits.test.ts:21:11)",
  ].join("\n");
  const note = parseNodeTestFailure(out);
  assert.match(note, /credits list is complete/);
  assert.match(note, /credits\.test\.ts:21/);
  assert.equal(parseNodeTestFailure("✔ all good"), null);
});

test("detectChromium: env var, VM chrome, bundled cache, or nothing", () => {
  const none = () => false;
  assert.equal(detectChromium({ env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/x/chrome" }, exists: (p) => p === "/x/chrome" }).found, true);
  assert.equal(detectChromium({ env: {}, exists: (p) => p === "/opt/meta-chromium/chrome" }).found, true);
  const bundled = detectChromium({
    env: {},
    exists: none,
    listDir: (p) => (p.endsWith("ms-playwright") ? ["chromium-1243"] : []),
    home: "/home/tester",
  });
  assert.equal(bundled.found, true);
  assert.equal(detectChromium({ env: {}, exists: none, listDir: () => [], home: "/home/tester" }), null);
});

/** A stub exec that answers from a script keyed on the joined command line. */
function stubExec(handlers) {
  const calls = [];
  const exec = (cmd, args) => {
    const line = [cmd, ...args].join(" ");
    calls.push(line);
    for (const [match, result] of handlers) {
      if (line.includes(match)) return typeof result === "function" ? result(line) : result;
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  exec.calls = calls;
  return exec;
}

const ok = { code: 0, stdout: "", stderr: "" };

function baseDeps(overrides = {}) {
  return {
    exec: stubExec([
      ["check:entry-size", { code: 0, stdout: "check-entry-size: entry JS gzip 320,000 B, limit 323,865 B (3,865 B to spare)", stderr: "" }],
      ["playwright test", { code: 0, stdout: "", stderr: "" }],
    ]),
    readJson: (path) => {
      if (path.includes("layer-baseline")) return { noRawIo: entries(13), noUpwardImport: entries(129) };
      if (path.includes("shell-ban-baseline")) return { pageLocalMain: entries(14) };
      return { suites: [] }; // Playwright report: no failures
    },
    detectChromium: () => ({ found: true, how: "stub" }),
    log: () => {},
    ...overrides,
  };
}

test("runProfile: a fully green stub run passes all 14 rows and exits 0", async () => {
  const { rows, exitCode } = await runProfile(baseDeps());
  assert.equal(rows.length, 14);
  assert.equal(exitCode, 0);
  assert.ok(rows.every((r) => r.result === "PASS"), JSON.stringify(rows, null, 1));
  const entry = rows.find((r) => r.suite === "Entry size");
  assert.match(entry.notes, /320,000 B/);
});

test("runProfile: a failing gate fails its row and the run", async () => {
  const deps = baseDeps({
    exec: stubExec([
      ["tsc --noEmit", { code: 2, stdout: "src/x.ts(1,1): error TS1: boom", stderr: "" }],
      ["check:entry-size", { code: 0, stdout: "check-entry-size: entry JS gzip 320,000 B, limit 323,865 B", stderr: "" }],
      ["playwright test", ok],
    ]),
  });
  const { rows, exitCode } = await runProfile(deps);
  assert.equal(exitCode, 1);
  assert.equal(rows.find((r) => r.suite === "Typecheck").result, "FAIL");
});

test("runProfile: no Chromium means Playwright NOT RUN with a reason, exit stays 0", async () => {
  const { rows, exitCode } = await runProfile(baseDeps({ detectChromium: () => null }));
  const pw = rows.find((r) => r.suite === "Playwright smoke");
  assert.equal(pw.result, "NOT RUN");
  assert.match(pw.notes, /Chromium not installed/);
  assert.equal(exitCode, 0);
});

test("runProfile: a Playwright failure that passes its lone re-run is a flake, not a regression", async () => {
  let pwRuns = 0;
  const deps = baseDeps({
    exec: stubExec([
      [
        "playwright test",
        () => {
          pwRuns += 1;
          return pwRuns === 1 ? { code: 1, stdout: "", stderr: "" } : { code: 0, stdout: "", stderr: "" };
        },
      ],
      ["check:entry-size", { code: 0, stdout: "check-entry-size: entry JS gzip 320,000 B, limit 323,865 B", stderr: "" }],
    ]),
    readJson: (path) => {
      if (path.includes("layer-baseline")) return { noRawIo: entries(13), noUpwardImport: entries(129) };
      if (path.includes("shell-ban-baseline")) return { pageLocalMain: entries(14) };
      // First report has one failure; the lone re-run's report is clean.
      return pwRuns <= 1
        ? {
            suites: [
              {
                title: "kanban.spec.ts",
                file: "kanban.spec.ts",
                specs: [{ title: "board filters", line: 40, ok: false, tests: [{ projectName: "kanban", results: [{ status: "failed" }] }] }],
              },
            ],
          }
        : { suites: [] };
    },
  });
  const { rows, exitCode } = await runProfile(deps);
  const pw = rows.find((r) => r.suite === "Playwright smoke");
  assert.equal(pw.result, "PASS");
  assert.match(pw.notes, /flake/);
  assert.match(pw.notes, /kanban\.spec\.ts/);
  assert.equal(exitCode, 0);
  assert.equal(pwRuns, 2);
});

test("runProfile: a Playwright failure that fails its lone re-run is a regression", async () => {
  const deps = baseDeps({
    exec: stubExec([
      ["playwright test", { code: 1, stdout: "", stderr: "" }],
      ["check:entry-size", { code: 0, stdout: "check-entry-size: entry JS gzip 320,000 B, limit 323,865 B", stderr: "" }],
    ]),
    readJson: (path) => {
      if (path.includes("layer-baseline")) return { noRawIo: entries(13), noUpwardImport: entries(129) };
      if (path.includes("shell-ban-baseline")) return { pageLocalMain: entries(14) };
      return {
        suites: [
          {
            title: "kanban.spec.ts",
            file: "kanban.spec.ts",
            specs: [{ title: "board filters", line: 40, ok: false, tests: [{ projectName: "kanban", results: [{ status: "failed" }] }] }],
          },
        ],
      };
    },
  });
  const { rows, exitCode } = await runProfile(deps);
  const pw = rows.find((r) => r.suite === "Playwright smoke");
  assert.equal(pw.result, "FAIL");
  assert.match(pw.notes, /kanban\.spec\.ts:40/);
  assert.match(pw.notes, /board filters/);
  assert.equal(exitCode, 1);
});
