#!/usr/bin/env node
/**
 * test-regression-wave.mjs — the post-wave targeted regression profile.
 *
 * One command after a wave merges:
 *
 *   npm run test:regression:wave
 *
 * Runs the core gates, the platform contract suites, the Wave-1 unit
 * suites, and the Playwright smoke set (the /kanban project plus the
 * Holmes/Watson smoke projects named in AGENTS.md, "Testing on a
 * budget") in one process, then prints one table: Suite or Gate,
 * Command, Result (PASS / FAIL / NOT RUN), and notes — for a failure,
 * the exact failing test name with its file:line.
 *
 * Rules baked in:
 * - The arch and nav ratchets are checked against the baseline counts,
 *   not just the eslint exit code: noRawIo is at its hard floor — the
 *   baseline is empty and must stay that way (a re-baselined row fails
 *   the profile) — noUpwardImport <= 129, shell-ban <= 14. Baselines can
 *   only shrink; a count above the cap fails even if eslint passed.
 * - Entry size must stay <= 323,865 B gzip; the exact byte count is
 *   printed either way.
 * - A failed Playwright spec is re-run once, alone (AGENTS.md section
 *   9): it is a regression only if the lone re-run fails too. A spec
 *   that passes its re-run is reported as a flake in the notes.
 * - Playwright is NOT RUN, with the reason printed, when no Chromium
 *   is installed. That is the only NOT RUN a green run may contain.
 * - Exit code is 0 only when every other row is PASS.
 *
 * The full Playwright suite is deliberately not part of this profile,
 * and no spec is ever opened through a query-param shortcut.
 *
 * Process execution is injected (deps.exec) so the unit test can stub
 * every child process; this file itself uses only node builtins.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const LIMITS = {
  noRawIo: 0,
  noUpwardImport: 129,
  shellBan: 14,
  entryBytes: 323_865,
};

export const PLAYWRIGHT_PROJECTS = [
  "kanban",
  "detective-owner-spec",
  "detective-selection-read",
  "detective-tapmode-selection",
  "detective-watson-walk",
];

const projectArgs = () => PLAYWRIGHT_PROJECTS.flatMap((p) => [`--project=${p}`]);

const NODE_TEST = ["--experimental-strip-types", "--test"];

/** The profile, in run order. Display strings are what the table prints. */
export const MANIFEST = [
  { suite: "Typecheck", command: "npx tsc --noEmit" },
  { suite: "Architecture lint", command: "npm run lint:arch" },
  { suite: "Navigation lint", command: "npm run lint:nav" },
  { suite: "Provenance", command: "npm run check:provenance" },
  { suite: "Card lint", command: "node scripts/lint-cards.mjs" },
  { suite: "Build (Pages)", command: "npm run build:pages" },
  { suite: "Entry size", command: "npm run check:entry-size" },
  { suite: "Transport contract", command: `node ${NODE_TEST.join(" ")} src/platform/transport/transport.contract.test.ts` },
  { suite: "Storage contract", command: `node ${NODE_TEST.join(" ")} src/platform/storage/storage.contract.test.ts` },
  { suite: "Voice contract", command: `node ${NODE_TEST.join(" ")} src/platform/audio/voice.contract.test.ts` },
  { suite: "Globe contract", command: `node ${NODE_TEST.join(" ")} src/lib/home-globe/globe-contract.test.ts` },
  { suite: "Credits", command: `node ${NODE_TEST.join(" ")} src/lib/credits.test.ts` },
  { suite: "Kanban board units", command: `node ${NODE_TEST.join(" ")} src/build-board/kanban-data.test.ts src/build-board/kanban-live.test.ts` },
  {
    suite: "Playwright smoke",
    command: `npx playwright test --workers=1 ${PLAYWRIGHT_PROJECTS.map((p) => `--project=${p}`).join(" ")}`,
  },
];

export function parseArgs(argv) {
  const parsed = { help: false, list: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--list") parsed.list = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

/** Counts from eslint/layer-baseline.json. */
export function layerCounts(baseline) {
  return {
    noRawIo: Array.isArray(baseline?.noRawIo) ? baseline.noRawIo.length : 0,
    noUpwardImport: Array.isArray(baseline?.noUpwardImport) ? baseline.noUpwardImport.length : 0,
  };
}

export function archVerdict({ noRawIo, noUpwardImport }) {
  if (noRawIo > LIMITS.noRawIo) return { ok: false, note: `noRawIo ${noRawIo} > ${LIMITS.noRawIo}` };
  if (noUpwardImport > LIMITS.noUpwardImport) {
    return { ok: false, note: `noUpwardImport ${noUpwardImport} > ${LIMITS.noUpwardImport}` };
  }
  return { ok: true, note: `noRawIo ${noRawIo} <= ${LIMITS.noRawIo}, noUpwardImport ${noUpwardImport} <= ${LIMITS.noUpwardImport}` };
}

/** Total shell-ban entries across every ban list in the baseline. */
export function shellBanTotal(baseline) {
  if (!baseline || typeof baseline !== "object") return 0;
  return Object.entries(baseline).reduce(
    (sum, [key, value]) => (key === "comment" || !Array.isArray(value) ? sum : sum + value.length),
    0,
  );
}

export function navVerdict(total) {
  if (total > LIMITS.shellBan) return { ok: false, note: `shell-ban ${total} > ${LIMITS.shellBan}` };
  return { ok: true, note: `shell-ban ${total} <= ${LIMITS.shellBan}` };
}

export function parseEntrySizeBytes(output) {
  const match = /entry JS gzip ([\d,]+) B/.exec(output ?? "");
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

const fmtBytes = (n) => n.toLocaleString("en-US");

export function entrySizeVerdict(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return { ok: false, note: "entry size not reported by the checker" };
  if (bytes > LIMITS.entryBytes) {
    return { ok: false, note: `entry JS gzip ${fmtBytes(bytes)} B > ${fmtBytes(LIMITS.entryBytes)} B limit` };
  }
  return { ok: true, note: `entry JS gzip ${fmtBytes(bytes)} B (limit ${fmtBytes(LIMITS.entryBytes)} B)` };
}

/** First failing test in node --test spec output, as "title (file:line)". */
export function parseNodeTestFailure(output) {
  if (!output) return null;
  const lines = output.split("\n");
  const failAt = lines.findIndex((line) => line.includes("✖"));
  if (failAt === -1) return null;
  const title = lines[failAt].replace(/^[^✖]*✖\s*/, "").replace(/\s*\([\d.]+m?s\)\s*$/, "").trim();
  for (let i = failAt + 1; i < Math.min(lines.length, failAt + 12); i += 1) {
    const loc = /\((?:file:\/\/)?([^()\s]+):(\d+):\d+\)/.exec(lines[i]);
    if (loc) return `${title} (${loc[1]}:${loc[2]})`;
  }
  return title || null;
}

/** Flatten a Playwright JSON report into its failing specs. */
export function collectPlaywrightFailures(report) {
  const failures = [];
  const walk = (suite, inheritedFile) => {
    if (!suite || typeof suite !== "object") return;
    const file = suite.file ?? inheritedFile ?? "";
    for (const spec of suite.specs ?? []) {
      if (spec.ok) continue;
      const project = spec.tests?.[0]?.projectName ?? "";
      failures.push({ file, line: spec.line ?? 0, title: spec.title ?? "", project });
    }
    for (const child of suite.suites ?? []) walk(child, file);
  };
  for (const suite of report?.suites ?? []) walk(suite, "");
  return failures;
}

export function formatTable(rows) {
  const header = { suite: "Suite or Gate", command: "Command", result: "Result", notes: "Notes or exact failure name" };
  const all = [header, ...rows];
  const width = (key) => Math.max(...all.map((r) => String(r[key] ?? "").length));
  const wSuite = width("suite");
  const wCommand = width("command");
  const wResult = width("result");
  const line = (r) =>
    `${String(r.suite).padEnd(wSuite)} | ${String(r.command).padEnd(wCommand)} | ${String(r.result).padEnd(wResult)} | ${r.notes ?? ""}`;
  const divider = `${"-".repeat(wSuite)}-+-${"-".repeat(wCommand)}-+-${"-".repeat(wResult)}-+-${"-".repeat(24)}`;
  return [line(header), divider, ...rows.map(line)].join("\n");
}

export function computeExitCode(rows) {
  const bad = rows.some((row) => {
    if (row.result === "PASS") return false;
    if (row.result === "NOT RUN" && row.suite === "Playwright smoke") return false;
    return true;
  });
  return bad ? 1 : 0;
}

/**
 * Mirror of the browser resolution in playwright.config.ts: an explicit
 * env path, then the VM Chrome, then Playwright's bundled Chromium.
 */
export function detectChromium({ env = process.env, exists = existsSync, listDir = null, home = homedir() } = {}) {
  const fromEnv = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
  if (fromEnv && exists(fromEnv)) return { found: true, how: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=${fromEnv}` };
  if (exists("/opt/meta-chromium/chrome")) return { found: true, how: "/opt/meta-chromium/chrome" };
  const browsersPath = env.PLAYWRIGHT_BROWSERS_PATH?.trim() || join(home, ".cache", "ms-playwright");
  const read = listDir ?? ((p) => readdirSync(p));
  let entries = [];
  try {
    entries = read(browsersPath);
  } catch {
    entries = [];
  }
  const bundled = entries.find((entry) => entry.startsWith("chromium"));
  if (bundled) return { found: true, how: `bundled ${bundled} in ${browsersPath}` };
  return null;
}

function defaultExec(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    env: opts.env ?? process.env,
    timeout: opts.timeoutMs ?? 15 * 60 * 1000,
  });
  if (result.error) {
    return { code: 127, stdout: result.stdout ?? "", stderr: String(result.error.message ?? result.error) };
  }
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function defaultReadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const tailLine = (text) => {
  const lines = (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, 200) : "";
};

const firstMatch = (text, pattern) => {
  for (const line of (text ?? "").split("\n")) {
    if (pattern.test(line)) return line.trim().slice(0, 200);
  }
  return null;
};

export async function runProfile(deps = {}) {
  const exec = deps.exec ?? defaultExec;
  const readJson = deps.readJson ?? defaultReadJson;
  const detect = deps.detectChromium ?? (() => detectChromium());
  const rows = [];
  const bySuite = Object.fromEntries(MANIFEST.map((m) => [m.suite, m]));
  const push = (suite, result, notes) =>
    rows.push({ suite, command: bySuite[suite].command, result, notes });

  const runSimple = (suite, cmd, args, { failureNote } = {}) => {
    const { code, stdout, stderr } = exec(cmd, args);
    const combined = `${stdout}\n${stderr}`;
    if (code === 0) {
      push(suite, "PASS", "exit 0");
      return { code, combined };
    }
    push(suite, "FAIL", failureNote?.(combined) ?? tailLine(combined) ?? `exit ${code}`);
    return { code, combined };
  };

  // Core gates.
  runSimple("Typecheck", "npx", ["tsc", "--noEmit"], {
    failureNote: (out) => firstMatch(out, /error TS\d+/) ?? tailLine(out),
  });

  {
    const { code, combined } = await (() => {
      const r = exec("npm", ["run", "lint:arch"]);
      return { code: r.code, combined: `${r.stdout}\n${r.stderr}` };
    })();
    let counts = null;
    try {
      counts = layerCounts(readJson(join("eslint", "layer-baseline.json")));
    } catch {
      counts = null;
    }
    if (counts == null) {
      push("Architecture lint", "FAIL", "eslint/layer-baseline.json unreadable");
    } else {
      const verdict = archVerdict(counts);
      if (code !== 0) push("Architecture lint", "FAIL", tailLine(combined) || `eslint exit ${code}`);
      else push("Architecture lint", verdict.ok ? "PASS" : "FAIL", verdict.note);
    }
  }

  {
    const { code, combined } = exec("npm", ["run", "lint:nav"]);
    let total = null;
    try {
      total = shellBanTotal(readJson(join("eslint", "shell-ban-baseline.json")));
    } catch {
      total = null;
    }
    if (total == null) {
      push("Navigation lint", "FAIL", "eslint/shell-ban-baseline.json unreadable");
    } else {
      const verdict = navVerdict(total);
      if (code !== 0) push("Navigation lint", "FAIL", tailLine(combined) || `eslint exit ${code}`);
      else push("Navigation lint", verdict.ok ? "PASS" : "FAIL", verdict.note);
    }
  }

  runSimple("Provenance", "npm", ["run", "check:provenance"]);
  runSimple("Card lint", "node", ["scripts/lint-cards.mjs"], {
    failureNote: (out) => firstMatch(out, /GATE FAILED|✖|Error/) ?? tailLine(out),
  });
  runSimple("Build (Pages)", "npm", ["run", "build:pages"], {
    failureNote: (out) => firstMatch(out, /error|Error|failed/i) ?? tailLine(out),
  });

  {
    const { code, stdout, stderr } = exec("npm", ["run", "check:entry-size"]);
    const bytes = parseEntrySizeBytes(`${stdout}\n${stderr}`);
    const verdict = entrySizeVerdict(bytes);
    if (code !== 0 && verdict.ok) push("Entry size", "FAIL", tailLine(`${stdout}\n${stderr}`) || `exit ${code}`);
    else push("Entry size", verdict.ok ? "PASS" : "FAIL", verdict.note);
  }

  // Contract and unit suites (node --test).
  const nodeSuite = (suite, files) =>
    runSimple(suite, "node", [...NODE_TEST, ...files], {
      failureNote: (out) => parseNodeTestFailure(out) ?? tailLine(out),
    });

  nodeSuite("Transport contract", ["src/platform/transport/transport.contract.test.ts"]);
  nodeSuite("Storage contract", ["src/platform/storage/storage.contract.test.ts"]);
  nodeSuite("Voice contract", ["src/platform/audio/voice.contract.test.ts"]);
  nodeSuite("Globe contract", ["src/lib/home-globe/globe-contract.test.ts"]);
  nodeSuite("Credits", ["src/lib/credits.test.ts"]);
  nodeSuite("Kanban board units", ["src/build-board/kanban-data.test.ts", "src/build-board/kanban-live.test.ts"]);

  // Playwright smoke.
  {
    const browser = detect();
    if (!browser) {
      push("Playwright smoke", "NOT RUN", "Chromium not installed (no env path, no /opt/meta-chromium, no bundled Chromium)");
    } else {
      const reportPath = (tag) => join(tmpdir(), `regression-wave-${tag}-${process.pid}.json`);
      const runPw = (extraArgs, tag) => {
        const out = reportPath(tag);
        const result = exec("npx", ["playwright", "test", "--workers=1", ...projectArgs(), ...extraArgs, "--reporter=json"], {
          env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out },
        });
        let report = null;
        try {
          report = readJson(out);
        } catch {
          report = null;
        }
        return { ...result, report };
      };

      const first = runPw([], "pw");
      if (first.code === 0) {
        push("Playwright smoke", "PASS", `projects green (${browser.how})`);
      } else {
        const failures = first.report ? collectPlaywrightFailures(first.report) : [];
        if (failures.length === 0) {
          push("Playwright smoke", "FAIL", tailLine(`${first.stdout}\n${first.stderr}`) || `Playwright exit ${first.code}, no spec failures parsed`);
        } else {
          // Section 9: a failure is a regression only if its lone re-run fails too.
          const files = [...new Set(failures.map((f) => f.file))];
          const stillFailing = [];
          const flakes = [];
          for (const file of files) {
            const rerun = runPw([file], `pw-rerun-${files.indexOf(file)}`);
            const rerunFailures = rerun.report ? collectPlaywrightFailures(rerun.report) : [];
            if (rerun.code === 0) flakes.push(file);
            else stillFailing.push(...(rerunFailures.length ? rerunFailures : failures.filter((f) => f.file === file)));
          }
          if (stillFailing.length === 0) {
            push("Playwright smoke", "PASS", `flake: ${flakes.join(", ")} passed on lone re-run`);
          } else {
            const head = stillFailing[0];
            const extra = stillFailing.length > 1 ? ` (+${stillFailing.length - 1} more)` : "";
            push("Playwright smoke", "FAIL", `${head.file}:${head.line} ${head.title}${extra} — failed its lone re-run`);
          }
        }
      }
    }
  }

  return { rows, exitCode: computeExitCode(rows) };
}

const USAGE = [
  "Usage: node scripts/test-regression-wave.mjs [--list] [--help]",
  "",
  "Runs the post-wave targeted regression profile and prints a",
  "suite-by-suite table. Exit 0 only when every required gate and",
  "suite passes (Playwright may be NOT RUN when no Chromium exists).",
].join("\n");

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.list) {
    for (const item of MANIFEST) console.log(`${item.suite}: ${item.command}`);
    return 0;
  }
  const { rows, exitCode } = await runProfile();
  console.log(formatTable(rows));
  const passed = rows.filter((r) => r.result === "PASS").length;
  console.log(`\n${passed}/${rows.length} PASS — exit ${exitCode}`);
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
