#!/usr/bin/env node
/**
 * entry-fingerprint-probe.mjs — probe A1: which server entry does Cloudflare
 * actually serve on the deployed `meridian` worker?
 *
 *   node --experimental-strip-types scripts/entry-fingerprint-probe.mjs \
 *     --url https://meridian.knowledgetest.workers.dev
 *
 * READ-ONLY: only GET requests, nothing is sent that a browser would not.
 * Run it only after PR #207 has deployed from main (WI-0 gate), because the
 * answer is about the code that is live.
 *
 * Why this question matters. The repo builds with Nitro (preset "vercel"),
 * and the deployed worker's own wrangler config is not in the repo. Two
 * server entries could be serving: Nitro's output, or the TanStack Start
 * entry in dist/server. `src/start.ts` adds the shared security headers to
 * worker-rendered responses, so:
 *
 *   - A POST to /api/contact with a bad Origin is the primary evidence (the
 *     owner's probe, 2026-10-21). It is refused before it can reach any sink,
 *     so it delivers nothing even on a wired worker. 403 with the handler's
 *     JSON body = the route is live and answered by Worker code; 404, SPA
 *     HTML or 405 = it is not. If that response
 *     carries EVERY header in src/lib/security-headers.ts, the start.ts
 *     middleware runs. A page like /privacy could be answered by the assets
 *     layer or an SPA fallback (which get headers from public/_headers), so
 *     pages alone never prove it; they are checked too, because those are
 *     what kids load. GET /api/contact is recorded for information only
 *     (404 on the pre-#207 build, 405 on #207, {sink} once activation lands).
 *   - a static file (/flags.json) is the control: it carries the headers
 *     from public/_headers either way.
 *   - static has them but /api/contact does not → start.ts is not in the
 *     serving path. That is an ESCALATION, not a note: the CSP, HSTS and
 *     friends are not applying to worker responses. It goes to the owner
 *     as its own item before any contact wiring (docs/contact-activation.md).
 *   - a bare 404 or HTML on /api/contact → INCONCLUSIVE (the route is not
 *     mounted, e.g. the live build predates #207).
 *
 * Exit 0 = rendered pages carry every header (start.ts live). Exit 1 = they
 * do not, or the probe could not tell — never a default green.
 */
import { pathToFileURL } from "node:url";
import { SECURITY_HEADERS } from "../src/lib/security-headers.ts";

/** Paths probed. Rendered = produced by Worker code; static = from the assets layer. */
export const PROBES = [
  { id: "page-privacy", path: "/privacy", kind: "rendered" },
  { id: "page-root", path: "/", kind: "rendered" },
  {
    id: "api-post",
    path: "/api/contact",
    kind: "rendered",
    method: "POST",
    note: "POST with a bad Origin, refused before any sink: 403 JSON = route live",
    // A refused-origin POST with no honeypot never reaches a sink, even when wired.
    headers: { origin: "https://probe.invalid", "content-type": "application/json" },
    body: JSON.stringify({ topic: "bug", message: "entry probe (refused before delivery)" }),
  },
  { id: "api-get", path: "/api/contact", kind: "rendered", note: "GET: information only" },
  { id: "static-flags", path: "/flags.json", kind: "static", note: "control: headers from _headers" },
];

/** Headers worth recording as evidence: the policy headers plus how the response was served. */
const REPORTED_HEADERS = new Set([
  ...Object.keys(SECURITY_HEADERS).map((h) => h.toLowerCase()),
  "content-type",
  "cache-control",
  "server",
  "vary",
  "x-powered-by",
]);

const norm = (v) => v.replace(/\s+/g, " ").trim().toLowerCase();

export async function probeEntry({ origin, fetchFn = fetch }) {
  const base = origin.replace(/\/+$/, "");
  const rows = [];
  for (const p of PROBES) {
    try {
      const res = await fetchFn(`${base}${p.path}`, {
        method: p.method ?? "GET",
        redirect: "manual",
        headers: p.headers ?? { accept: p.path === "/flags.json" ? "application/json" : "text/html" },
        ...(p.body === undefined ? {} : { body: p.body }),
      });
      const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
      const missing = [];
      const wrong = [];
      for (const [name, want] of Object.entries(SECURITY_HEADERS)) {
        const got = headers[name.toLowerCase()];
        if (got === undefined) missing.push(name);
        else if (norm(got) !== norm(want)) wrong.push(name);
      }
      // Only the handler's own error string is kept from a body, never page content.
      let bodyError = null;
      if (p.id === "api-post" && /^application\/json/i.test(headers["content-type"] ?? "")) {
        try {
          const j = await res.json();
          bodyError = typeof j?.error === "string" ? j.error : null;
        } catch {
          bodyError = null;
        }
      }
      rows.push({ ...p, status: res.status, headers, missing, wrong, bodyError, error: null });
    } catch (err) {
      rows.push({ ...p, status: null, headers: {}, missing: [], wrong: [], bodyError: null, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { base, rows, ...judge(rows) };
}

const healthy = (r) => r.error === null && r.status !== null && r.status < 400;
const hasAll = (r) => healthy(r) && r.missing.length === 0 && r.wrong.length === 0;

/**
 * The refused-origin POST is the one response only Worker code can produce:
 * the handler answers 403 with a JSON body {"error":"origin not allowed"}. A
 * bare 404, a 405, an HTML page or a Cloudflare error page there means the
 * route is not live or a static/SPA fallback answered, so it proves nothing
 * about the server entry.
 */
const isWorkerProduced = (r) =>
  r.error === null && r.status === 403 && /^application\/json/i.test(r.headers["content-type"] ?? "") && r.bodyError === "origin not allowed";

/**
 * Turn raw rows into the A1 answer. Pure, so it is unit-tested.
 *
 * Verdicts (escalate = the owner must hear about it as its own item):
 *   - any request failed or answered 4xx/5xx on a page, or the control is
 *     unhealthy                          → INCONCLUSIVE
 *   - the refused POST is not the handler's 403 JSON → INCONCLUSIVE (route not
 *                                         live; cannot tell the entry)
 *   - api + both pages carry every header → LIVE
 *   - api carries them, a page does not → ESCALATE (middleware runs for the
 *                                         API but not for the HTML kids load)
 *   - api lacks them, control has them  → ESCALATE (start.ts is not in the
 *                                         serving path)
 *   - nothing carries them              → INCONCLUSIVE (the control is broken)
 */
export function judge(rows) {
  const pages = rows.filter((r) => r.kind === "rendered" && r.path !== "/api/contact");
  const control = rows.find((r) => r.kind === "static");
  const api = rows.find((r) => r.id === "api-post");
  const apiMounted = Boolean(api) && isWorkerProduced(api);
  const staticOk = Boolean(control) && hasAll(control);
  const apiOk = apiMounted && api.missing.length === 0 && api.wrong.length === 0;
  const pagesOk = pages.length > 0 && pages.every(hasAll);
  const unhealthy = rows.some((r) => r.error !== null) || pages.some((r) => !healthy(r)) || !control || !healthy(control) || !api || api.error !== null;
  // LIVE only on a clean read: a failed control or page means the run proves nothing.
  const renderedOk = !unhealthy && apiOk && pagesOk;
  let verdict;
  let escalate = false;
  if (unhealthy) {
    verdict = "INCONCLUSIVE — a request failed or a page/control answered an error; fix that and re-run";
  } else if (!apiMounted) {
    verdict = "INCONCLUSIVE — a POST to /api/contact with a bad Origin did not get the handler's 403 JSON (404, 405, HTML or another error), so no response is known to come from Worker code; the route is not live (the live build may predate #207)";
  } else if (renderedOk) {
    verdict = "start.ts middleware IS live: the worker-produced /api/contact and the rendered pages all carry every security header";
  } else if (apiOk) {
    verdict = "ESCALATE — the worker-produced /api/contact carries the security headers but a rendered HTML page does NOT: the pages kids load are not passing through src/start.ts.";
    escalate = true;
  } else if (staticOk) {
    verdict = "ESCALATE — static files carry the headers (from _headers) but the worker-produced /api/contact does NOT: src/start.ts is not in the serving path (the Nitro entry is serving). The security headers are not applying to worker responses.";
    escalate = true;
  } else {
    verdict = "INCONCLUSIVE — even the static control lacks the headers; the control is broken, so the result proves nothing";
  }
  return { verdict, escalate, renderedOk, staticOk, apiMounted };
}

/** CLI exit code: 0 only for the LIVE verdict. Anything else, including inconclusive, is 1. */
export function exitCodeFor(result) {
  return result.renderedOk ? 0 : 1;
}

/** Raw evidence as a Markdown block, for the config record and BRANCH_STATUS.md. */
export function renderReport(result) {
  const out = [`Probe A1 against ${result.base} — ${new Date().toISOString()}`, "", `**Verdict:** ${result.verdict}`, ""];
  out.push(`- POST /api/contact (bad Origin) got the handler's 403 JSON (route live): ${result.apiMounted ? "yes" : "NO"}`, "");
  for (const r of result.rows) {
    out.push(`### ${r.method ?? "GET"} ${r.path}  (${r.kind}${r.note ? `, ${r.note}` : ""})`);
    if (r.error) {
      out.push(`request failed: ${r.error}`, "");
      continue;
    }
    out.push(`status ${r.status}${r.bodyError ? ` (error: ${r.bodyError})` : ""}; missing: ${r.missing.join(", ") || "none"}; wrong value: ${r.wrong.join(", ") || "none"}`, "```");
    // Allowlist, not a dump: the report is pasted into committed files, so a
    // set-cookie or debug header from the live worker must never land in git.
    for (const [k, v] of Object.entries(r.headers).sort()) if (REPORTED_HEADERS.has(k)) out.push(`${k}: ${v}`);
    out.push("```", "");
  }
  return out.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const urlAt = args.indexOf("--url");
  const url = urlAt === -1 ? "" : (args[urlAt + 1] ?? "");
  if (!/^(https:\/\/[^/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)\/?$/.test(url)) {
    console.error("usage: entry-fingerprint-probe.mjs --url https://<origin>");
    process.exit(2);
  }
  const result = await probeEntry({ origin: url });
  console.log(renderReport(result));
  process.exit(exitCodeFor(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
