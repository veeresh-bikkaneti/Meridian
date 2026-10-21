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
    const method = init?.method ?? "GET";
    if (fail.includes(path)) throw new Error("net down");
    if (path === "/api/contact") {
      // The handler: POST with a refused Origin -> 403 JSON; GET -> 405 JSON
      // (#207) . `api.status` overrides both; `api.type`/`api.body` model SPA
      // HTML or an edge error page.
      const status = api.status ?? (method === "POST" ? 403 : 405);
      const type = api.type ?? "application/json";
      const body = api.body ?? (type === "application/json" ? JSON.stringify({ error: method === "POST" ? "origin not allowed" : "method not allowed" }) : "<html>app</html>");
      const headers = { "content-type": type, ...(api.headers === false ? {} : SECURITY_HEADERS) };
      return new Response(body, { status, headers });
    }
    const base = path === "/flags.json" ? { ...defaults, type: "application/json", ...flags } : { ...defaults, ...pages, ...(perPage[path] ?? {}) };
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
  for (const api of [{ status: 404 }, { status: 404, type: "text/html" }, { status: 200, type: "text/html" }]) {
    const r = await probe({ api });
    assert.equal(r.renderedOk, false, JSON.stringify(api));
    assert.equal(r.escalate, false);
    assert.match(r.verdict, /INCONCLUSIVE/);
    assert.equal(r.apiMounted, false);
    assert.equal(exitCodeFor(r), 1);
  }
});

test("the refused POST must be the handler's own 403 JSON: a 405, a 200, an edge 403 page, or a 403 without the handler's error all mean 'route not live'", async () => {
  const cases = [
    { status: 405 },
    { status: 200 },
    { status: 403, type: "text/html", body: "<html>blocked</html>" },
    { status: 403, body: JSON.stringify({ error: "something else" }) },
    { status: 403, body: "not json at all" },
  ];
  for (const api of cases) {
    const r = await probe({ api });
    assert.equal(r.apiMounted, false, JSON.stringify(api));
    assert.equal(r.renderedOk, false, JSON.stringify(api));
    assert.match(r.verdict, /INCONCLUSIVE/, JSON.stringify(api));
  }
});

test("the refused POST sends a bad Origin, carries no honeypot, and GET /api/contact is informational only", async () => {
  const seen = [];
  await probeEntry({ origin: "https://w.test", fetchFn: async (u, init) => { seen.push({ u, init }); return site()(u, init); } });
  const post = seen.find((x) => x.init.method === "POST");
  assert.equal(post.init.headers.origin, "https://probe.invalid");
  assert.ok(!("website" in JSON.parse(post.init.body)), "a probe must never carry a honeypot or anything deliverable");
  // GET 404 (the pre-#207 baseline) does not by itself decide the verdict when the POST is live
  const r = await probe({ api: { status: 405 } });
  assert.equal(r.rows.find((x) => x.id === "api-get").status, 405);
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

test("one header with a wrong value on the worker response counts as not carrying the policy", async () => {
  const good = site();
  const fetchFn = async (url, init) => {
    const res = await good(url, init);
    if (new URL(url).pathname === "/api/contact" && init?.method === "POST") {
      const h = new Headers(res.headers);
      h.set("content-security-policy", "default-src *");
      return new Response(await res.text(), { status: res.status, headers: h });
    }
    return res;
  };
  const r = await probeEntry({ origin: "https://w.test", fetchFn });
  assert.equal(r.apiMounted, true, "the route is live, so the only reason to fail is the wrong value");
  assert.equal(r.renderedOk, false);
  assert.ok(r.rows.find((x) => x.id === "api-post").wrong.includes("Content-Security-Policy"));
});

test("requests do not follow redirects; exactly one is a POST (the refused-origin one)", async () => {
  const seen = [];
  await probeEntry({ origin: "https://w.test", fetchFn: async (u, init) => { seen.push(init); return site()(u, init); } });
  assert.ok(seen.length === 5 && seen.every((i) => (i.method === "GET" || i.method === "POST") && i.redirect === "manual"));
  assert.equal(seen.filter((i) => i.method === "POST").length, 1);
});

test("judge() is pure over rows and the report notes unmounted API", async () => {
  const r = await probe({ api: { status: 404 } });
  assert.match(renderReport(r), /route live\): NO/);
  assert.equal(judge([]).renderedOk, false);
});

test("the pasted report lists policy headers but never set-cookie or other response headers", async () => {
  const fetchFn = async () =>
    new Response("x", { status: 200, headers: { ...SECURITY_HEADERS, "content-type": "application/json", "set-cookie": "sid=SECRET; Path=/", "x-debug-token": "TOP-SECRET" } });
  const text = renderReport(await probeEntry({ origin: "https://w.test", fetchFn }));
  assert.ok(text.includes("content-security-policy:"));
  assert.ok(!/set-cookie|SECRET|x-debug-token/i.test(text), text);
});
