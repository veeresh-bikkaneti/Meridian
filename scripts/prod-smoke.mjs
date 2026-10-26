#!/usr/bin/env node
/**
 * Production smoke check for the deployed Meridian site (WI-7b,
 * 2026-10-21). The owner runs this after a deploy to prove the live
 * site is serving the hardened surface — no browser, no login, no
 * writes: GET requests only.
 *
 * Usage:
 *   node scripts/prod-smoke.mjs [baseUrl]
 * Default baseUrl: https://meridian.knowledgetest.workers.dev
 *
 * Checks:
 *   1. GET /                        → 200 and ALL of these headers:
 *      content-security-policy, x-frame-options, referrer-policy,
 *      permissions-policy, x-content-type-options,
 *      cross-origin-opener-policy, strict-transport-security
 *   2. GET /_serverFn/              → 404 (no server functions are in
 *      use; a bare or unknown id must never 500 — review S5, PR #222)
 *   3. GET /.well-known/security.txt → 200 (RFC 9116, review R7)
 *   4. GET /manifest.webmanifest    → 200, and its start_url resolved
 *      against the base → 200
 *   5. GET /build-meta.json         → 200 with a non-empty buildId
 *      (the build stamp, WI-7a)
 *
 * Exit 0 = all checks pass, non-zero = at least one failed.
 * Every failure prints what was expected and what came back.
 */
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://meridian.knowledgetest.workers.dev";

export const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "x-content-type-options",
  "cross-origin-opener-policy",
  "strict-transport-security",
];

/** fetch with a hard timeout so a hung endpoint can't hang the run. */
async function fetchT(fetchFn, url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetchFn(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBase(baseUrl) {
  return String(baseUrl).replace(/\/+$/, "");
}

/**
 * Run every check against `baseUrl` using `fetchFn` (injectable for
 * tests). Returns { ok, results: [{ name, ok, detail }] } and never
 * throws — a network error is a failed check, not a crash.
 */
export async function runProdSmoke(baseUrl = DEFAULT_BASE_URL, fetchFn = fetch) {
  const base = normalizeBase(baseUrl);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok, detail });

  // 1. Home page status + the full security-header set.
  try {
    const res = await fetchT(fetchFn, `${base}/`);
    const missing = REQUIRED_HEADERS.filter(
      (h) => !res.headers.get(h),
    );
    check(
      "GET / → 200 with all security headers",
      res.status === 200 && missing.length === 0,
      res.status !== 200
        ? `status ${res.status}`
        : missing.length > 0
          ? `missing headers: ${missing.join(", ")}`
          : "200, all 7 headers present",
    );
  } catch (err) {
    check("GET / → 200 with all security headers", false, `error: ${err.message}`);
  }

  // 2. Bare server-function path must be a clean 404.
  try {
    const res = await fetchT(fetchFn, `${base}/_serverFn/`);
    check(
      "GET /_serverFn/ → 404",
      res.status === 404,
      `status ${res.status}`,
    );
  } catch (err) {
    check("GET /_serverFn/ → 404", false, `error: ${err.message}`);
  }

  // 3. RFC 9116 security.txt must be served.
  try {
    const res = await fetchT(fetchFn, `${base}/.well-known/security.txt`);
    check(
      "GET /.well-known/security.txt → 200",
      res.status === 200,
      `status ${res.status}`,
    );
  } catch (err) {
    check("GET /.well-known/security.txt → 200", false, `error: ${err.message}`);
  }

  // 4. Manifest must load and its start_url must resolve to a 200.
  try {
    const res = await fetchT(fetchFn, `${base}/manifest.webmanifest`);
    if (res.status !== 200) {
      check("manifest start_url → 200", false, `manifest status ${res.status}`);
    } else {
      const manifest = await res.json();
      const startUrl =
        typeof manifest.start_url === "string" ? manifest.start_url : "";
      if (!startUrl) {
        check("manifest start_url → 200", false, "manifest has no start_url");
      } else {
        const resolved = new URL(startUrl, `${base}/`);
        const startRes = await fetchT(fetchFn, resolved.href);
        check(
          "manifest start_url → 200",
          startRes.status === 200,
          `${startUrl} → ${resolved.href} status ${startRes.status}`,
        );
      }
    }
  } catch (err) {
    check("manifest start_url → 200", false, `error: ${err.message}`);
  }

  // 5. Build stamp must be served with a buildId.
  try {
    const res = await fetchT(fetchFn, `${base}/build-meta.json`);
    if (res.status !== 200) {
      check(
        "GET /build-meta.json → 200 with buildId",
        false,
        `status ${res.status}`,
      );
    } else {
      const meta = await res.json();
      const hasId =
        typeof meta.buildId === "string" && meta.buildId.length > 0;
      check(
        "GET /build-meta.json → 200 with buildId",
        hasId,
        hasId ? `buildId ${meta.buildId}` : "no non-empty buildId",
      );
    }
  } catch (err) {
    check("GET /build-meta.json → 200 with buildId", false, `error: ${err.message}`);
  }

  return { ok: results.every((r) => r.ok), results };
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  const { ok, results } = await runProdSmoke(baseUrl);
  console.log(`prod-smoke against ${normalizeBase(baseUrl)}`);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);
  }
  console.log(ok ? "SMOKE OK" : "SMOKE FAILED");
  process.exit(ok ? 0 : 1);
}
