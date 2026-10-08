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
 *
 * Usage:
 *   node scripts/crash-smoke.mjs <workerBase> <gameBase>
 * Example:
 *   node scripts/crash-smoke.mjs \
 *     https://meridian.knowledgetest.workers.dev \
 *     https://veeresh-bikkaneti.github.io/Meridian
 *
 * Deploy order this gates (do not skip):
 *   1. Deploy the crash-report worker (workers/crash-report).
 *   2. Run this smoke test — it must PASS before going further.
 *   3. Only then set observabilityEndpoint in public/flags.json and deploy
 *      the game. (Deploying the app first 400s the new tile_failed events
 *      on the old worker — silent telemetry loss, no crash.)
 *
 * Known false-fail windows:
 *   - GitHub Pages caches HTML (~max-age=600): check 4 can FAIL on a stale
 *     shell right after a game deploy. Wait ~10 min and re-run.
 *   - The worker rate-limits BEFORE validating: check 2 spends 1 request
 *     of your IP's 10/min budget. A hot IP gets a 429 FAIL here — wait a
 *     minute and re-run; the script prints the status.
 *
 * Exit 0 = all checks pass, non-zero = at least one failed.
 */

const [workerBase, gameBase] = process.argv.slice(2);

/** fetch with a hard timeout so a hung endpoint can't hang the script. */
async function fetchT(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Endpoint validation mirroring isValidObservabilityEndpoint in
 * src/lib/flags.ts EXACTLY (trim, 2048 chars, no whitespace/control chars,
 * root-relative single-slash path or https: URL). A looser check here
 * would green-light an endpoint the app itself rejects (fail-closed).
 */
function isValidEndpoint(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > 2048 || /[\s\u0000-\u001f]/.test(v)) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

let failures = 0;

function check(name, ok, detail = "") {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  if (!workerBase || !gameBase) {
    console.error("usage: node scripts/crash-smoke.mjs <workerBase> <gameBase>");
    process.exit(2);
  }
  const worker = workerBase.replace(/\/$/, "");
  const game = gameBase.replace(/\/$/, "");

  // 1. Worker health.
  try {
    const res = await fetchT(`${worker}/health`);
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
    const res = await fetchT(`${worker}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    const res = await fetchT(`${game}/flags.json`);
    const flags = await res.json().catch(() => null);
    const ep = flags?.observabilityEndpoint;
    check("flags.json has valid observabilityEndpoint", res.status === 200 && isValidEndpoint(ep), `HTTP ${res.status}, endpoint=${JSON.stringify(ep)?.slice(0, 60)}`);
  } catch (e) {
    check("flags.json has valid observabilityEndpoint", false, String(e));
  }

  // 4. Shell HTML contains the watchdog markers.
  try {
    const res = await fetchT(`${game}/`);
    const html = await res.text();
    const hasWatchdog = html.includes("meridian-crash-watchdog") || html.includes("__meridian_ready");
    check("shell HTML contains crash-watchdog markers", res.status === 200 && hasWatchdog, `HTTP ${res.status}`);
  } catch (e) {
    check("shell HTML contains crash-watchdog markers", false, String(e));
  }

  console.log(failures === 0 ? "\nSMOKE PASSED" : `\nSMOKE FAILED (${failures} check${failures === 1 ? "" : "s"})`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
