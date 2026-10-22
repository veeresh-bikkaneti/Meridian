/**
 * Drift guard: the worker path (src/start.ts → withSecurityHeaders) and the
 * static-assets path (public/_headers) must send the SAME security headers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { HTML_CACHE_CONTROL, SECURITY_HEADERS, withHtmlCacheControl, withSecurityHeaders } from "./security-headers.ts";

function globalBlock(): Map<string, string> {
  const text = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
  const out = new Map<string, string>();
  let inGlobal = false;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobal = line.trim() === "/*";
      continue;
    }
    if (!inGlobal) continue;
    const i = line.indexOf(":");
    out.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }
  return out;
}

test("public/_headers /* block matches SECURITY_HEADERS exactly", () => {
  assert.deepEqual(Object.fromEntries(globalBlock()), { ...SECURITY_HEADERS });
});

test("withSecurityHeaders adds every header to a worker response", () => {
  const res = withSecurityHeaders(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }));
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) assert.equal(res.headers.get(k), v, k);
  assert.equal(res.headers.get("content-type"), "text/html");
});

test("withSecurityHeaders keeps a header the route already set", () => {
  const res = withSecurityHeaders(new Response("x", { headers: { "x-frame-options": "SAMEORIGIN" } }));
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
});

test("HTML_CACHE_CONTROL is exactly the owner-ruled plain value", () => {
  assert.equal(HTML_CACHE_CONTROL, "public, max-age=0, must-revalidate");
});

test("withHtmlCacheControl adds the default to an HTML response without cache-control", () => {
  const res = withHtmlCacheControl(
    new Response("<!doctype html>", { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  assert.equal(res.headers.get("cache-control"), HTML_CACHE_CONTROL);
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

test("withHtmlCacheControl keeps a cache-control the route already set", () => {
  const res = withHtmlCacheControl(
    new Response("<!doctype html>", {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    }),
  );
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("withHtmlCacheControl leaves a non-HTML response untouched", () => {
  const res = withHtmlCacheControl(new Response("{}", { headers: { "content-type": "application/json" } }));
  assert.equal(res.headers.get("cache-control"), null);
});

test("withSecurityHeaders copies a response whose headers are immutable", async () => {
  const frozen = Response.redirect("https://meridian.test/", 302);
  const res = withSecurityHeaders(frozen);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://meridian.test/");
  assert.equal(res.headers.get("strict-transport-security"), SECURITY_HEADERS["Strict-Transport-Security"]);
});
