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
 *   - a worker-rendered page (/privacy, /) that carries EVERY header in
 *     src/lib/security-headers.ts proves the start.ts middleware runs;
 *   - a static file (/flags.json) carries them from public/_headers either
 *     way, so it is the control: it shows `_headers` works while the
 *     rendered page shows whether the middleware does.
 *   - static has them but rendered pages do not → start.ts is not in the
 *     serving path. That is an ESCALATION, not a note: the CSP, HSTS and
 *     friends are not applying to the pages kids load. It goes to the owner
 *     as its own item before any contact wiring (docs/contact-activation.md).
 *
 * /api/contact while unconfigured is the second fingerprint: any handler
 * answer (200/405) means the route is mounted; a bare 404 means it is not
 * (the live build predates #207, or a different entry is serving).
 *
 * Exit 0 = rendered pages carry every header (start.ts live). Exit 1 = they
 * do not, or the probe could not tell — never a default green.
 */
import { pathToFileURL } from "node:url";
import { SECURITY_HEADERS } from "../src/lib/security-headers.ts";

/** Paths probed. Rendered = produced by Worker code; static = from the assets layer. */
export const PROBES = [
  { path: "/privacy", kind: "rendered" },
  { path: "/", kind: "rendered" },
  { path: "/api/contact", kind: "rendered", note: "GET: handler answer vs bare 404" },
  { path: "/flags.json", kind: "static", note: "control: headers from _headers" },
];

const norm = (v) => v.replace(/\s+/g, " ").trim().toLowerCase();

export async function probeEntry({ origin, fetchFn = fetch }) {
  const base = origin.replace(/\/+$/, "");
  const rows = [];
  for (const p of PROBES) {
    try {
      const res = await fetchFn(`${base}${p.path}`, { method: "GET", redirect: "manual", headers: { accept: p.path === "/flags.json" ? "application/json" : "text/html" } });
      const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
      const missing = [];
      const wrong = [];
      for (const [name, want] of Object.entries(SECURITY_HEADERS)) {
        const got = headers[name.toLowerCase()];
        if (got === undefined) missing.push(name);
        else if (norm(got) !== norm(want)) wrong.push(name);
      }
      rows.push({ ...p, status: res.status, headers, missing, wrong, error: null });
    } catch (err) {
      rows.push({ ...p, status: null, headers: {}, missing: [], wrong: [], error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { base, rows, ...judge(rows) };
}

const hasAll = (r) => r.error === null && r.status !== null && r.status < 500 && r.missing.length === 0 && r.wrong.length === 0;

/** Turn raw rows into the A1 answer. Pure, so it is unit-tested. */
export function judge(rows) {
  const rendered = rows.filter((r) => r.kind === "rendered" && r.path !== "/api/contact");
  const control = rows.find((r) => r.kind === "static");
  const api = rows.find((r) => r.path === "/api/contact");
  const unreachable = rows.some((r) => r.error !== null);
  const staticOk = control ? hasAll(control) : false;
  const renderedOk = rendered.length > 0 && rendered.every(hasAll);
  const apiMounted = api ? api.status !== null && api.status !== 404 : false;

  let verdict;
  let escalate = false;
  if (unreachable) {
    verdict = "INCONCLUSIVE — at least one request failed; fix connectivity and re-run";
    escalate = false;
  } else if (renderedOk) {
    verdict = "start.ts middleware IS live: worker-rendered pages carry every security header";
  } else if (staticOk) {
    verdict = "ESCALATE — static files carry the headers (from _headers) but worker-rendered pages do NOT: src/start.ts is not in the serving path (the Nitro entry is serving). The security headers are not applying to the HTML kids load.";
    escalate = true;
  } else {
    verdict = "INCONCLUSIVE — even the static control lacks the headers; the control is broken, so the rendered result proves nothing";
  }
  return { verdict, escalate, renderedOk, staticOk, apiMounted };
}

/** Raw evidence as a Markdown block, for the config record and BRANCH_STATUS.md. */
export function renderReport(result) {
  const out = [`Probe A1 against ${result.base} — ${new Date().toISOString()}`, "", `**Verdict:** ${result.verdict}`, ""];
  out.push(`- /api/contact mounted (any non-404 answer): ${result.apiMounted ? "yes" : "NO"}`, "");
  for (const r of result.rows) {
    out.push(`### GET ${r.path}  (${r.kind}${r.note ? `, ${r.note}` : ""})`);
    if (r.error) {
      out.push(`request failed: ${r.error}`, "");
      continue;
    }
    out.push(`status ${r.status}; missing: ${r.missing.join(", ") || "none"}; wrong value: ${r.wrong.join(", ") || "none"}`, "```");
    for (const [k, v] of Object.entries(r.headers).sort()) out.push(`${k}: ${v}`);
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
  process.exit(result.renderedOk ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
