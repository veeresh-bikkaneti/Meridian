/**
 * The A1 probe's verdict logic against fake sites. It must never say
 * "start.ts is live" unless the worker-produced /api/contact AND the rendered
 * pages carry every header, must escalate when the worker response lacks them
 * while static has them, and must be INCONCLUSIVE (exit 1) for anything it
 * cannot read cleanly.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { exitCodeFor, judge, probeEntry, renderReport } from "./entry-fingerprint-probe.mjs";
import { SECURITY_HEADERS } from "../src/lib/security-headers.ts";

/**
 * Build a fake site. Options per response class: `api`, `pages`, `flags` are
 * { headers: bool, status, type } overrides; `fail` lists paths that throw.
 */
function site({ api = {}, pages = {}, flags = {}, fail = [], perPage = {} } = {}) {
  const defaults = { headers: true, status: 200, type: "text/html" };
  return async (url, init) => {
    const path = new URL(url).pathname;
    if (fail.includes(path)) throw new Error("net down");
    const base = path === "/api/contact" ? { ...defaults, type: "application/json", ...api } : path === "/flags.json" ? { ...defaults, type: "application/json", ...flags } : { ...defaults, ...pages, ...(perPage[path] ?? {}) };
    const headers = { "content-type": base.type, ...(base.headers ? SECURITY_HEADERS : {}) };
    return new Response("x", { status: base.status, headers });
  };
}
const probe = (opts) => probeEntry({ origin: "https://w.test", fetchFn: site(opts) });

test("API and pages all carry every header → start.ts live; exit 0", async () => {
  const r = await probe();
  assert.equal(r.renderedOk, true);
  assert.match(r.verdict, /IS live/);
  assert.equal(exitCodeFor(r), 0);
});

test("API JSON lacks the headers while the static control has them → ESCALATE; exit 1", async () => {
  const r = await probe({ api: { headers: false }, pages: { headers: false } });
  assert.equal(r.escalate, true);
  assert.match(r.verdict, /ESCALATE.*start\.ts is not in the serving path/);
  assert.equal(exitCodeFor(r), 1);
});

test("pages with headers do NOT prove it when the worker-produced API lacks them (assets/SPA-fallback pages get _headers)", async () => {
  const r = await probe({ api: { headers: false }, pages: { headers: true } });
  assert.equal(r.renderedOk, false);
  assert.equal(r.escalate, true);
});

test("API has the headers but one rendered page does not → ESCALATE (mixed pages are not a green)", async () => {
  const r = await probe({ perPage: { "/privacy": { headers: false } } });
  assert.equal(r.renderedOk, false);
  assert.equal(r.escalate, true);
  assert.match(r.verdict, /rendered HTML page does NOT/);
  assert.equal(exitCodeFor(r), 1);
});

test("/api/contact 404 or HTML (route not mounted / SPA fallback) → INCONCLUSIVE even if every other path has headers", async () => {
  for (const api of [{ status: 404 }, { status: 200, type: "text/html" }]) {
    const r = await probe({ api });
    assert.equal(r.renderedOk, false, JSON.stringify(api));
    assert.equal(r.escalate, false);
    assert.match(r.verdict, /INCONCLUSIVE/);
    assert.equal(r.apiMounted, false);
    assert.equal(exitCodeFor(r), 1);
  }
});

test("a 405 JSON answer (the pre-activation handler) counts as worker-produced", async () => {
  const r = await probe({ api: { status: 405 } });
  assert.equal(r.apiMounted, true);
  assert.equal(r.renderedOk, true);
});

test("a failed request, a 5xx or a 404 on any page, or an unhealthy control → INCONCLUSIVE, never ESCALATE or green", async () => {
  const cases = [
    { fail: ["/"] },
    { fail: ["/privacy"] },
    { fail: ["/api/contact"] },
    { fail: ["/flags.json"] },
    { perPage: { "/": { status: 503, headers: false } } },
    { perPage: { "/privacy": { status: 404 } } },
    { pages: { status: 404 } },
    { flags: { status: 500 } },
    { api: { status: 503 } },
  ];
  for (const c of cases) {
    const r = await probe(c);
    assert.match(r.verdict, /INCONCLUSIVE/, JSON.stringify(c));
    assert.equal(r.renderedOk, false, JSON.stringify(c));
    assert.equal(r.escalate, false, JSON.stringify(c));
    assert.equal(exitCodeFor(r), 1, JSON.stringify(c));
  }
});

test("no headers anywhere → INCONCLUSIVE (the control is broken)", async () => {
  const r = await probe({ api: { headers: false }, pages: { headers: false }, flags: { headers: false } });
  assert.match(r.verdict, /control is broken/);
  assert.equal(r.escalate, false);
});

test("one header with a wrong value counts as not carrying the policy", async () => {
  const fetchFn = async (url) => {
    const path = new URL(url).pathname;
    const h = { ...SECURITY_HEADERS, "content-type": path === "/api/contact" || path === "/flags.json" ? "application/json" : "text/html" };
    if (path === "/api/contact") h["Content-Security-Policy"] = "default-src *";
    return new Response("x", { status: 200, headers: h });
  };
  const r = await probeEntry({ origin: "https://w.test", fetchFn });
  assert.equal(r.renderedOk, false);
  assert.ok(r.rows.find((x) => x.path === "/api/contact").wrong.includes("Content-Security-Policy"));
});

test("requests are GETs that do not follow redirects", async () => {
  const seen = [];
  await probeEntry({ origin: "https://w.test", fetchFn: async (u, init) => { seen.push(init); return site()(u, init); } });
  assert.ok(seen.length === 4 && seen.every((i) => i.method === "GET" && i.redirect === "manual"));
});

test("judge() is pure over rows and the report notes unmounted API", async () => {
  const r = await probe({ api: { status: 404 } });
  assert.match(renderReport(r), /answered like the contact handler \(JSON, not 404\): NO/);
  assert.equal(judge([]).renderedOk, false);
});

test("the pasted report lists policy headers but never set-cookie or other response headers", async () => {
  const fetchFn = async () =>
    new Response("x", { status: 200, headers: { ...SECURITY_HEADERS, "content-type": "application/json", "set-cookie": "sid=SECRET; Path=/", "x-debug-token": "TOP-SECRET" } });
  const text = renderReport(await probeEntry({ origin: "https://w.test", fetchFn }));
  assert.ok(text.includes("content-security-policy:"));
  assert.ok(!/set-cookie|SECRET|x-debug-token/i.test(text), text);
});
