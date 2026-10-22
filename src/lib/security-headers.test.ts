/**
 * Drift guard: the worker path (src/start.ts → withSecurityHeaders) and the
 * static-assets path (public/_headers) must send the SAME security headers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SECURITY_HEADERS, withSecurityHeaders } from "./security-headers.ts";

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

test("withSecurityHeaders copies a response whose headers are immutable", async () => {
  const frozen = Response.redirect("https://meridian.test/", 302);
  const res = withSecurityHeaders(frozen);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://meridian.test/");
  assert.equal(res.headers.get("strict-transport-security"), SECURITY_HEADERS["Strict-Transport-Security"]);
});
