#!/usr/bin/env node
/**
 * Post-deploy smoke test for the Meridian crash-report pipeline.
 *
 * Verifies, without sending any real alert to Discord:
 *   1. GET <worker>/health            → 200 { ok: true }
 *   2. POST <worker>/ingest (invalid) → 400 with a JSON error shape
 *      (proves the ingest route is deployed and validating; an invalid
 *      event never forwards, so the Discord channel stays quiet)
 *   3. GET <game>/flags.json          → has a valid observabilityEndpoint
 *   4. GET <game>/ (shell HTML)       → contains the crash-watchdog markers
 *   5. GET <worker>/deploy-check      → names only. Fails when a binding
 *      or trigger declared in workers/crash-report/wrangler.toml is
 *      omitted. /health 200 is not enough.
 *
 * Usage:
 *   node scripts/crash-smoke.mjs <workerBase> <gameBase>
 * Example:
 *   node scripts/crash-smoke.mjs \
 *     https://meridian-crash-report.knowledgetest.workers.dev \
 *     https://meridian.knowledgetest.workers.dev
 *
 * Deploy order this gates (do not skip):
 *   1. Deploy the crash-report worker (workers/crash-report).
 *   2. Run this smoke test — it must PASS before going further.
 *   3. Only then set observabilityEndpoint in public/flags.json and deploy
 *      the game. (Deploying the app first 400s the new tile_failed events
 *      on the old worker — silent telemetry loss, no crash.)
 *
 * Known false-fail windows:
 *   - A stale cached game shell can make check 4 FAIL right after a deploy.
 *     Wait and re-run.
 *   - The worker rate-limits BEFORE validating: check 2 spends 1 request
 *     of your IP's 10/min budget. A hot IP gets a 429 FAIL here — wait a
 *     minute and re-run; the script prints the status.
 *
 * Exit 0 = all checks pass, non-zero = at least one failed.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OBSERVABILITY_INGEST_HOSTS } from "./crash-watchdog.mjs";

const WRANGLER_TOML = join(
  dirname(fileURLToPath(import.meta.url)),
  "../workers/crash-report/wrangler.toml",
);

/**
 * Binding and trigger names from the crash-report config record.
 * Section-aware: top-level `name` is the script name, not a binding.
 * kv `binding` and ratelimit `name` are bindings; `[triggers]` crons
 * are triggers. Names only — values are never returned.
 */
function parseCrashWrangler(text) {
  const bindings = [];
  const triggers = [];
  let section = "";
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const arrayHeader = line.match(/^\[\[([^\]]+)\]\]$/);
    const tableHeader = line.match(/^\[([^\]]+)\]$/);
    if (arrayHeader || tableHeader) {
      section = (arrayHeader || tableHeader)[1];
      continue;
    }
    if (section === "kv_namespaces") {
      const found = line.match(/^binding\s*=\s*"([^"]+)"\s*$/);
      if (found) bindings.push(found[1]);
    } else if (section === "ratelimits") {
      const found = line.match(/^name\s*=\s*"([^"]+)"\s*$/);
      if (found) bindings.push(found[1]);
    } else if (section === "triggers") {
      const found = line.match(/^crons\s*=\s*\[(.*)\]\s*$/);
      if (found) {
        for (const part of found[1].matchAll(/"([^"]*)"/g)) triggers.push(part[1]);
      }
    }
  }
  return { bindings, triggers };
}

function loadDeclared() {
  try {
    return parseCrashWrangler(readFileSync(WRANGLER_TOML, "utf8"));
  } catch {
    return { bindings: [], triggers: [] };
  }
}

/** fetch with a hard timeout so a hung endpoint can't hang the script. */
async function fetchT(fetchImpl, url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Endpoint validation mirroring isValidObservabilityEndpoint in
 * src/lib/flags.ts EXACTLY (trim, 2048 chars, no whitespace/control chars,
 * root-relative single-slash path, or an https: URL on the pinned ingest
 * host list from review S3). A looser check here would green-light an
 * endpoint the app itself rejects (fail-closed).
 */
function isValidEndpoint(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > 2048 || /[\s\u0000-\u001f]/.test(v)) return false;
  // Reject any backslash before the slash/protocol branches below: WHATWG
  // URL parsing treats "\" as "/" in special schemes, so "/\host" is a
  // protocol-relative URL in disguise (it resolves to host "host"), and a
  // "\" inside an absolute URL can likewise rewrite its path. Endpoints
  // never legitimately contain a backslash.
  if (v.includes("\\")) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    return url.protocol === "https:" && OBSERVABILITY_INGEST_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Run every smoke check. Returns 0 when all pass, 1 when any fail, and
 * 2 when a base URL is missing. Does not exit the process.
 */
export async function runSmoke(workerBase, gameBase, fetchImpl = globalThis.fetch) {
  if (!workerBase || !gameBase) {
    console.error("usage: node scripts/crash-smoke.mjs <workerBase> <gameBase>");
    return 2;
  }
  const worker = String(workerBase).replace(/\/$/, "");
  const game = String(gameBase).replace(/\/$/, "");
  let failures = 0;

  function check(name, ok, detail = "") {
    if (ok) {
      console.log(`PASS  ${name}`);
    } else {
      failures += 1;
      console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    }
  }

  // 1. Worker health.
  try {
    const res = await fetchT(fetchImpl, `${worker}/health`);
    const body = await res.json().catch(() => null);
    check("GET /health → 200 { ok: true }", res.status === 200 && body?.ok === true, `HTTP ${res.status}`);
  } catch (e) {
    check("GET /health → 200 { ok: true }", false, String(e));
  }

  // 2. Ingest route live + validating (invalid event → 400, never forwarded).
  // The problems list must name "tile_failed": the v1 logging worker serves
  // the same routes/shapes, and only the v2 forwarding worker knows the
  // tile_failed type — this is what distinguishes a correct deploy.
  try {
    // The worker refuses POSTs without an allow-listed Origin (review S4),
    // so send the game's own origin, as a browser would.
    const res = await fetchT(fetchImpl, `${worker}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: new URL(game).origin },
      body: JSON.stringify({ nope: true }),
    });
    const body = await res.json().catch(() => null);
    const problems = Array.isArray(body?.problems) ? body.problems.join(" ") : "";
    check(
      "POST /ingest (invalid) → 400 naming tile_failed (v2 worker)",
      res.status === 400 && problems.includes("tile_failed"),
      `HTTP ${res.status}`,
    );
  } catch (e) {
    check("POST /ingest (invalid) → 400 naming tile_failed (v2 worker)", false, String(e));
  }

  // 3. flags.json carries the endpoint the game reports to (same gate as the app).
  try {
    const res = await fetchT(fetchImpl, `${game}/flags.json`);
    const flags = await res.json().catch(() => null);
    const ep = flags?.observabilityEndpoint;
    check("flags.json has valid observabilityEndpoint", res.status === 200 && isValidEndpoint(ep), `HTTP ${res.status}, endpoint=${JSON.stringify(ep)?.slice(0, 60)}`);
  } catch (e) {
    check("flags.json has valid observabilityEndpoint", false, String(e));
  }

  // 4. Shell HTML contains the watchdog markers.
  try {
    const res = await fetchT(fetchImpl, `${game}/`);
    const html = await res.text();
    const hasWatchdog = html.includes("meridian-crash-watchdog") || html.includes("__meridian_ready");
    check("shell HTML contains crash-watchdog markers", res.status === 200 && hasWatchdog, `HTTP ${res.status}`);
  } catch (e) {
    check("shell HTML contains crash-watchdog markers", false, String(e));
  }

  // 5. Names only. /health 200 does not prove bindings or triggers.
  const declared = loadDeclared();
  if (declared.bindings.length === 0 || declared.triggers.length === 0) {
    check("GET /deploy-check", false, "deploy-check unreachable");
  } else {
    try {
      const res = await fetchT(fetchImpl, `${worker}/deploy-check`);
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const shapeOk =
        res.status === 200 &&
        body !== null &&
        typeof body === "object" &&
        !Array.isArray(body) &&
        Array.isArray(body.bindings) &&
        Array.isArray(body.triggers);
      if (!shapeOk) {
        check("GET /deploy-check", false, "deploy-check unreachable");
      } else {
        for (const name of declared.bindings) {
          const present = body.bindings.includes(name);
          check(
            `GET /deploy-check binding ${name}`,
            present,
            present ? "" : `binding missing: ${name}`,
          );
        }
        for (const cron of declared.triggers) {
          const present = body.triggers.includes(cron);
          check(
            `GET /deploy-check trigger ${cron}`,
            present,
            present ? "" : `trigger missing: ${cron}`,
          );
        }
      }
    } catch (e) {
      check("GET /deploy-check", false, `deploy-check unreachable (${String(e)})`);
    }
  }

  console.log(failures === 0 ? "\nSMOKE PASSED" : `\nSMOKE FAILED (${failures} check${failures === 1 ? "" : "s"})`);
  return failures === 0 ? 0 : 1;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const [workerBase, gameBase] = process.argv.slice(2);
  const code = await runSmoke(workerBase, gameBase);
  process.exit(code);
}
