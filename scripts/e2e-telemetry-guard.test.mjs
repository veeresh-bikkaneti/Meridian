/**
 * E2E telemetry guard — a source scan proving no spec can serve the app
 * around the shared crash-report stub (tests/e2e/helpers.ts).
 *
 * All rules scan COMMENT-STRIPPED source (string/template/regex literals
 * are respected, so a commented-out import or call counts for nothing —
 * γ-F3). Rules:
 * (a) [specs] every spec imports serveBuiltArtifact or handleTelemetry
 *     from "./helpers" AND calls one of those local names (aliases
 *     resolved) — an import that is never called proves nothing (γ-F4);
 * (b) [all tests/e2e/*.ts] any file containing "route.continue()" passes
 *     iff a "handleTelemetry(" call precedes the first "route.continue()"
 *     (γ-F5), OR it contains a "serveBuiltArtifact(" call (it delegates
 *     serving to helpers). Scanning every .ts file, not just specs,
 *     closes the serving-shim hole (γ-F6);
 * (c) [specs] a spec containing "browser.newContext(" must be listed in
 *     CONTEXT_FILES (a hand-made context gets no stub unless it goes
 *     through the shared entry points) and must satisfy rule (a)'s call
 *     requirement; a pin test asserts CONTEXT_FILES is exactly the set
 *     of such specs in the tree today;
 * (d) [all tests/e2e/*.ts] the literal prod telemetry hostname may
 *     appear only in COLLECTOR_FILES — the inspecting specs that pin
 *     the endpoint on purpose; a pin test asserts COLLECTOR_FILES is
 *     exactly the set of files naming the host (γ-F7: collector status
 *     is no longer a self-grant that goes unnoticed).
 *
 * Failure messages name the file and the one-line fix.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "e2e");

// EXEMPT — specs excused from rule (a). Every entry REQUIRES a written
// reason (reviewer: reject an entry without one). The list is EMPTY
// since the cure round migrated tap-verify.spec.ts onto the shared
// helpers policy (α-F1); the mechanism stays for future cases.
const EXEMPT = [];

// COLLECTOR_FILES — the inspecting specs allowed to name the prod
// telemetry host literally because pinning that exact endpoint is their
// subject. Pinned by test (d2) below: exactly the files that name it.
const COLLECTOR_FILES = Object.freeze([
  "observability.spec.ts",
  "crash-watchdog.spec.ts",
  "crash-classification.mobile.spec.ts",
  "chunk-recovery.desktop.spec.ts",
]);

// CONTEXT_FILES — the specs that legitimately create their own browser
// contexts today (derived by grepping the tree for browser.newContext().
// Pinned by test (c2) below: exactly that derived set, no more, no less.
const CONTEXT_FILES = Object.freeze([
  "card-redesign.desktop.spec.ts",
  "detective-companion.spec.ts",
  "detective-berth.spec.ts",
  "detective-closed-state.spec.ts",
  "detective-staging.spec.ts",
  "detective-swap.spec.ts",
  "detective-visibility.spec.ts",
  "discarded-notice.spec.ts",
  "endgame-share.spec.ts",
  "friend-challenge-mc3-verdict.desktop.spec.ts",
  "home-greeting-keyboard.desktop.spec.ts",
  "home-hero-trekker.desktop.spec.ts",
  "home-visual-layout.desktop.spec.ts",
  "loading-orbs.desktop.spec.ts",
  "reset-history.desktop.spec.ts",
  "review-card-actions.desktop.spec.ts",
  "scout-switch-note.desktop.spec.ts",
  "search-hidden.spec.ts",
  "session-score.spec.ts",
]);

const TELEMETRY_HOST = "meridian-crash-report.knowledgetest.workers.dev";

/**
 * Strip // and /* *\/ comments while respecting '...', "...", `...`
 * (including ${ } expressions) and regex literals, so comment text can
 * neither satisfy nor break a rule, and comment markers inside literals
 * are not mistaken for comments. Comment characters become spaces
 * (newlines kept), preserving index order for rule (b).
 */
function stripComments(src) {
  const out = src.split("");
  const blank = (a, b) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  const REGEX_KEYWORDS = new Set([
    "return", "typeof", "case", "in", "of", "new", "delete", "void",
    "instanceof", "yield", "await", "else", "do",
  ]);
  let i = 0;
  const n = src.length;
  let mode = "code";
  const tplStack = []; // frames: { expr: boolean, depth: number }
  let lastSig = "";
  let word = "";
  const canRegex = () => {
    if (word) return REGEX_KEYWORDS.has(word);
    return lastSig === "" || "(,=:[!&|?;{}+-*%~^<>".includes(lastSig);
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1] ?? "";
    if (mode === "code") {
      if (c === "/" && d === "/") {
        const s = i;
        i += 2;
        while (i < n && src[i] !== "\n") i++;
        blank(s, i);
        continue;
      }
      if (c === "/" && d === "*") {
        const s = i;
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
        i = Math.min(n, i + 2);
        blank(s, i);
        continue;
      }
      if (c === "'") { mode = "sq"; word = ""; lastSig = "x"; i++; continue; }
      if (c === '"') { mode = "dq"; word = ""; lastSig = "x"; i++; continue; }
      if (c === "`") { tplStack.push({ expr: false, depth: 0 }); mode = "tpl"; word = ""; lastSig = "x"; i++; continue; }
      if (c === "/" && canRegex()) { mode = "regex"; i++; continue; }
      if (c === "{") {
        const top = tplStack[tplStack.length - 1];
        if (top?.expr) top.depth++;
        lastSig = c; word = ""; i++; continue;
      }
      if (c === "}") {
        const top = tplStack[tplStack.length - 1];
        if (top?.expr) {
          top.depth--;
          if (top.depth === 0) { tplStack.pop(); mode = "tpl"; i++; continue; }
        }
        lastSig = c; word = ""; i++; continue;
      }
      if (/[A-Za-z_$]/.test(c)) { word += c; i++; continue; }
      if (/[0-9]/.test(c)) { word = ""; lastSig = "x"; i++; continue; }
      if (!/\s/.test(c)) { lastSig = c; word = ""; }
      i++;
      continue;
    }
    if (mode === "sq" || mode === "dq") {
      const q = mode === "sq" ? "'" : '"';
      if (c === "\\") { i += 2; continue; }
      if (c === q) mode = "code";
      i++;
      continue;
    }
    if (mode === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { tplStack.pop(); mode = "code"; i++; continue; }
      if (c === "$" && d === "{") {
        tplStack.push({ expr: true, depth: 1 });
        mode = "code"; word = ""; lastSig = "";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (mode === "regex") {
      if (c === "\\") { i += 2; continue; }
      if (c === "[") { mode = "regexClass"; i++; continue; }
      if (c === "/") { mode = "code"; word = ""; lastSig = "x"; i++; continue; }
      if (c === "\n") { mode = "code"; i++; continue; }
      i++;
      continue;
    }
    // regexClass
    if (c === "\\") { i += 2; continue; }
    if (c === "]") mode = "regex";
    i++;
  }
  return out.join("");
}

const allFiles = readdirSync(E2E_DIR)
  .filter((f) => f.endsWith(".ts"))
  .sort();
const specFiles = allFiles.filter((f) => f.endsWith(".spec.ts"));

const strippedByFile = new Map(
  allFiles.map((f) => [f, stripComments(readFileSync(path.join(E2E_DIR, f), "utf8"))]),
);
const stripped = (file) => strippedByFile.get(file);

/** Local names a file imports serveBuiltArtifact/handleTelemetry under. */
function helpersEntryLocals(file) {
  const locals = new Map();
  const re = /import\s*\{([^}]*)\}\s*from\s*["']\.\/helpers["']/gs;
  let m;
  const src = stripped(file);
  while ((m = re.exec(src)) !== null) {
    for (const part of m[1].split(",")) {
      const mm = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!mm) continue;
      if (mm[1] === "serveBuiltArtifact" || mm[1] === "handleTelemetry") {
        locals.set(mm[1], mm[2] ?? mm[1]);
      }
    }
  }
  return locals;
}

function satisfiesImportCallRule(file) {
  if (EXEMPT.some((e) => e.file === file)) return true;
  const locals = helpersEntryLocals(file);
  if (locals.size === 0) return false;
  const src = stripped(file);
  return [...locals.values()].some((local) => src.includes(`${local}(`));
}

test("(a) every spec imports serveBuiltArtifact or handleTelemetry from ./helpers AND calls one", () => {
  const bad = specFiles.filter((f) => !satisfiesImportCallRule(f));
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: does not import AND call serveBuiltArtifact or handleTelemetry from "./helpers" (comment-stripped scan; an unused or comment-only import does not count) — fix: add \`import { serveBuiltArtifact } from "./helpers"\` and call it on the context (or handleTelemetry in a hand-rolled handler), or add an EXEMPT entry with a written reason in scripts/e2e-telemetry-guard.test.mjs`,
      )
      .join("\n"),
  );
});

test("(b) any tests/e2e/*.ts with route.continue() runs handleTelemetry before it, or delegates to serveBuiltArtifact", () => {
  const bad = allFiles.filter((f) => {
    const src = stripped(f);
    const cont = src.indexOf("route.continue()");
    if (cont === -1) return false;
    const policy = src.indexOf("handleTelemetry(");
    if (policy !== -1 && policy < cont) return false;
    if (src.includes("serveBuiltArtifact(")) return false;
    return true;
  });
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: calls route.continue() without a preceding handleTelemetry( call and without delegating to serveBuiltArtifact( — fix: call \`await handleTelemetry(route, ledger)\` before any continue(), or serve via serveBuiltArtifact`,
      )
      .join("\n"),
  );
});

test("(c) any spec calling browser.newContext( is listed in CONTEXT_FILES and satisfies rule (a)", () => {
  const bad = specFiles.filter(
    (f) =>
      stripped(f).includes("browser.newContext(") &&
      (!CONTEXT_FILES.includes(f) || !satisfiesImportCallRule(f)),
  );
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: creates a context with browser.newContext( but is not in CONTEXT_FILES or does not import AND call serveBuiltArtifact/handleTelemetry from "./helpers" — fix: serve that context with serveBuiltArtifact (or route its handler through handleTelemetry) and list it in CONTEXT_FILES in scripts/e2e-telemetry-guard.test.mjs`,
      )
      .join("\n"),
  );
});

test("(c2) pin: CONTEXT_FILES equals exactly the specs calling browser.newContext(", () => {
  const derived = specFiles.filter((f) => stripped(f).includes("browser.newContext("));
  assert.deepEqual(
    [...CONTEXT_FILES].sort(),
    derived,
    `CONTEXT_FILES must equal the derived browser.newContext( set — derived: ${derived.join(", ")}; listed: ${[...CONTEXT_FILES].sort().join(", ")}`,
  );
});

test("(d) the prod telemetry hostname appears only in COLLECTOR_FILES (all tests/e2e/*.ts)", () => {
  const bad = allFiles.filter(
    (f) => stripped(f).includes(TELEMETRY_HOST) && !COLLECTOR_FILES.includes(f),
  );
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: names the prod telemetry host literally — fix: import TELEMETRY_ENDPOINT (or collectTelemetry) from "./helpers" instead; only the COLLECTOR_FILES inspecting specs may pin the host`,
      )
      .join("\n"),
  );
});

test("(d2) pin: COLLECTOR_FILES equals exactly the files naming the prod telemetry host", () => {
  const derived = allFiles.filter((f) => stripped(f).includes(TELEMETRY_HOST));
  assert.deepEqual(
    [...COLLECTOR_FILES].sort(),
    derived,
    `COLLECTOR_FILES must equal the derived set of files naming the prod host — derived: ${derived.join(", ")}; listed: ${[...COLLECTOR_FILES].sort().join(", ")}`,
  );
});
