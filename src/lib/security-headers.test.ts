/**
 * Drift guard: the worker path (src/start.ts → withSecurityHeaders) and the
 * static-assets path (public/_headers) must send the SAME security headers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { HTML_CACHE_CONTROL, CONTENT_SECURITY_POLICY, SECURITY_HEADERS, STATIC_HEADER_RULES, headersForStaticPath, withHtmlCacheControl, withSecurityHeaders } from "./security-headers.ts";

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

test("CSP allows the journal media host in media-src and connect-src", () => {
  // The journal clips live on meridian-media Pages; the <video> element
  // needs media-src and prefetch fetch() needs connect-src. Without both,
  // CSP blocks journal movies in production. The drift test above pins
  // public/_headers to SECURITY_HEADERS, so asserting on the constant
  // covers both files.
  const directives = new Map(
    CONTENT_SECURITY_POLICY.split(";").map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name, sources] as const;
    }),
  );
  for (const name of ["media-src", "connect-src"]) {
    assert.ok(
      directives.get(name)?.includes("https://veeresh-bikkaneti.github.io"),
      `${name} must allow the journal media host`,
    );
  }
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

test("withHtmlCacheControl matches the content type case-insensitively", () => {
  // Content-Type values are case-insensitive (RFC 9110), and Node's
  // Headers preserve the sender's casing, so "Text/HTML" must match.
  const res = withHtmlCacheControl(
    new Response("<!doctype html>", { headers: { "content-type": "Text/HTML; charset=utf-8" } }),
  );
  assert.equal(res.headers.get("cache-control"), HTML_CACHE_CONTROL);
});

test("withHtmlCacheControl copies a response whose headers are immutable", async () => {
  // Undici offers no way to build an HTML response with immutable
  // headers (Response.redirect is the only immutable source, and it
  // carries no content type), so simulate the immutable guard the way
  // it behaves in production: the first set() on the original headers
  // throws a TypeError, later sets (on the helper's copy) succeed.
  const frozen = new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
  const originalSet = Headers.prototype.set;
  let thrown = false;
  Headers.prototype.set = function (...args: [string, string]) {
    if (!thrown) {
      thrown = true;
      throw new TypeError("immutable headers");
    }
    return originalSet.apply(this, args);
  };
  try {
    const res = withHtmlCacheControl(frozen);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html");
    assert.equal(res.headers.get("cache-control"), HTML_CACHE_CONTROL);
    assert.equal(await res.text(), "<!doctype html>");
  } finally {
    Headers.prototype.set = originalSet;
  }
});

test("withSecurityHeaders copies a response whose headers are immutable", async () => {
  const frozen = Response.redirect("https://meridian.test/", 302);
  const res = withSecurityHeaders(frozen);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://meridian.test/");
  assert.equal(res.headers.get("strict-transport-security"), SECURITY_HEADERS["Strict-Transport-Security"]);
});

/**
 * Path drift guard. public/_headers is parsed here, not by the module, so
 * a change to either side fails. Pattern forms in that file are only "/*",
 * a trailing "/*", or an exact path — the same three the module applies.
 */
type HeaderOp =
  | { kind: "detach"; name: string }
  | { kind: "set"; name: string; value: string };

function parseHeaderFile(text: string): { pattern: string; ops: HeaderOp[] }[] {
  const out: { pattern: string; ops: HeaderOp[] }[] = [];
  let current: { pattern: string; ops: HeaderOp[] } | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), ops: [] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("!")) {
      current.ops.push({ kind: "detach", name: trimmed.slice(1).trim() });
      continue;
    }
    const colon = trimmed.indexOf(":");
    current.ops.push({
      kind: "set",
      name: trimmed.slice(0, colon).trim(),
      value: trimmed.slice(colon + 1).trim(),
    });
  }
  return out;
}

function patternMatches(pattern: string, pathname: string): boolean {
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) return pathname.startsWith(pattern.slice(0, -1));
  return pattern === pathname;
}

/** File-order apply: detaches in a rule run before sets; a later set appends. */
function effectiveFromFile(rules: { pattern: string; ops: HeaderOp[] }[], pathname: string): Record<string, string> {
  const order: string[] = [];
  const values = new Map<string, { name: string; value: string }>();
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, pathname)) continue;
    for (const op of rule.ops) {
      if (op.kind !== "detach") continue;
      const key = op.name.toLowerCase();
      values.delete(key);
      const at = order.indexOf(key);
      if (at >= 0) order.splice(at, 1);
    }
    for (const op of rule.ops) {
      if (op.kind !== "set") continue;
      const key = op.name.toLowerCase();
      const prev = values.get(key);
      if (!prev) {
        values.set(key, { name: op.name, value: op.value });
        order.push(key);
      } else {
        prev.value = `${prev.value}, ${op.value}`;
      }
    }
  }
  const headers: Record<string, string> = {};
  for (const key of order) {
    const row = values.get(key);
    if (row) headers[row.name] = row.value;
  }
  return headers;
}

const HEADER_FILE = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

const STATIC_PATHS = [
  "/assets/index-a1b2c3d4.js",
  "/assets/maplibre-gl-worker.mjs",
  "/assets/maplibre-gl-shared.mjs",
  "/assets/storyteller/storyteller-assets.json",
  "/sw.js",
  "/flags.json",
  "/build-meta.json",
  "/manifest.webmanifest",
  "/",
  "/index.html",
  "/offline",
  "/offline.html",
  "/_shell.html",
  "/audio/narration/sample.mp3",
  "/icons/icon-192.png",
  "/favicon.svg",
  "/og.jpg",
  "/privacy",
];

test("STATIC_HEADER_RULES match public/_headers rule for rule", () => {
  const fromFile = parseHeaderFile(HEADER_FILE);
  assert.deepEqual(
    STATIC_HEADER_RULES.map((rule) => ({ pattern: rule.pattern, ops: rule.ops })),
    fromFile,
  );
});

test("headersForStaticPath matches public/_headers for the same paths", () => {
  const fromFile = parseHeaderFile(HEADER_FILE);
  for (const pathname of STATIC_PATHS) {
    assert.deepEqual(headersForStaticPath(pathname), effectiveFromFile(fromFile, pathname), pathname);
  }
});

test("worker HTML cache stays the plain value, not the asset / rule", () => {
  const rendered = withHtmlCacheControl(
    withSecurityHeaders(new Response("<!doctype html>", { headers: { "content-type": "text/html" } })),
  );
  assert.equal(rendered.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(headersForStaticPath("/")["Cache-Control"], "public, max-age=0, s-maxage=60, must-revalidate");
  assert.notEqual(rendered.headers.get("cache-control"), headersForStaticPath("/")["Cache-Control"]);
});

test("server.ts and start.ts apply response headers only through the shared module", () => {
  const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  const start = readFileSync(new URL("../start.ts", import.meta.url), "utf8");
  assert.match(server, /from "@\/lib\/security-headers"/);
  assert.match(start, /from "@\/lib\/security-headers"/);
  assert.match(server, /withSecurityHeaders\(/);
  assert.match(start, /withSecurityHeaders\(/);
  assert.match(start, /withHtmlCacheControl\(/);
  assert.equal(server.includes("headersForStaticPath"), false);
  assert.equal(start.includes("headersForStaticPath"), false);
  assert.equal(server.includes("withHtmlCacheControl"), false);
  assert.equal(server.includes("Content-Security-Policy:"), false);
  assert.equal(start.includes("Content-Security-Policy:"), false);
});
