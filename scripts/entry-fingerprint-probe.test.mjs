/**
 * The A1 probe's verdict logic, against fake responses: the probe must never
 * say "start.ts is live" unless worker-rendered pages carry every header, and
 * must escalate when only the static control does.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { probeEntry, renderReport } from "./entry-fingerprint-probe.mjs";
import { SECURITY_HEADERS } from "../src/lib/security-headers.ts";

function site({ rendered, staticHeaders = true, api = 405 }) {
  return async (url) => {
    const path = new URL(url).pathname;
    const isStatic = path === "/flags.json";
    const carries = isStatic ? staticHeaders : rendered;
    const headers = carries ? { ...SECURITY_HEADERS } : { "content-type": "text/html" };
    const status = path === "/api/contact" ? api : 200;
    return new Response("x", { status, headers });
  };
}

test("rendered pages carry every header → start.ts live, exit-0 verdict", async () => {
  const r = await probeEntry({ origin: "https://w.test", fetchFn: site({ rendered: true }) });
  assert.equal(r.renderedOk, true);
  assert.equal(r.escalate, false);
  assert.match(r.verdict, /IS live/);
});

test("static has the headers but rendered pages do not → ESCALATE (Nitro entry serving)", async () => {
  const r = await probeEntry({ origin: "https://w.test", fetchFn: site({ rendered: false }) });
  assert.equal(r.renderedOk, false);
  assert.equal(r.escalate, true);
  assert.match(r.verdict, /ESCALATE/);
});

test("no headers anywhere → inconclusive, never a green", async () => {
  const r = await probeEntry({ origin: "https://w.test", fetchFn: site({ rendered: false, staticHeaders: false }) });
  assert.equal(r.renderedOk, false);
  assert.equal(r.escalate, false);
  assert.match(r.verdict, /INCONCLUSIVE/);
});

test("one header with a wrong value counts as not carrying the policy", async () => {
  const fetchFn = async (url) => {
    const path = new URL(url).pathname;
    const h = { ...SECURITY_HEADERS };
    if (path !== "/flags.json") h["Content-Security-Policy"] = "default-src *";
    return new Response("x", { status: 200, headers: h });
  };
  const r = await probeEntry({ origin: "https://w.test", fetchFn });
  assert.equal(r.renderedOk, false);
  assert.ok(r.rows.find((x) => x.path === "/privacy").wrong.includes("Content-Security-Policy"));
});

test("a failed request is inconclusive; a bare 404 on /api/contact is reported as not mounted", async () => {
  const boom = await probeEntry({ origin: "https://w.test", fetchFn: async () => { throw new Error("net down"); } });
  assert.match(boom.verdict, /INCONCLUSIVE/);
  const r = await probeEntry({ origin: "https://w.test", fetchFn: site({ rendered: true, api: 404 }) });
  assert.equal(r.apiMounted, false);
  assert.match(renderReport(r), /mounted \(any non-404 answer\): NO/);
});

test("the pasted report lists policy headers but never set-cookie or other response headers", async () => {
  const fetchFn = async () =>
    new Response("x", { status: 200, headers: { ...SECURITY_HEADERS, "set-cookie": "sid=SECRET; Path=/", "x-debug-token": "TOP-SECRET" } });
  const text = renderReport(await probeEntry({ origin: "https://w.test", fetchFn }));
  assert.ok(text.includes("content-security-policy:"));
  assert.ok(!/set-cookie|SECRET|x-debug-token/i.test(text), text);
});
