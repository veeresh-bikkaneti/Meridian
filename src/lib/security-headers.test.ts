/**
 * Drift guard: the worker path (src/start.ts → withSecurityHeaders) and the
 * static-assets path (public/_headers) must send the SAME security headers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ASSETS_CACHE_CONTROL,
  HTML_CACHE_CONTROL,
  CONTENT_SECURITY_POLICY,
  PATH_CACHE_CONTROL,
  SECURITY_HEADERS,
  getPathCacheControl,
  withHtmlCacheControl,
  withPathCacheControl,
  withSecurityHeaders,
} from "./security-headers.ts";

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
 * Per-path Cache-Control drift guard (Phase 5.3).
 *
 * `public/_headers` also carries per-path Cache-Control rules, and the
 * Worker middleware in `src/start.ts` must send the same values for the
 * paths it can serve, so the three copies (module, middleware, file)
 * cannot drift. The tests below simulate Cloudflare's documented apply
 * order (see the "How the rules combine" note in `public/_headers`):
 * matched rules apply in file order; within one rule detachments run
 * before sets; the first set replaces, a later set appends with ", ".
 */
type HeaderBlock = { pattern: string; detach: boolean; sets: string[] };

function headerBlocks(): HeaderBlock[] {
  const text = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
  const blocks: HeaderBlock[] = [];
  let current: HeaderBlock | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), detach: false, sets: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("!") && trimmed.slice(1).trim().toLowerCase().startsWith("cache-control")) {
      current.detach = true;
      continue;
    }
    const i = line.indexOf(":");
    if (line.slice(0, i).trim().toLowerCase() === "cache-control") {
      current.sets.push(line.slice(i + 1).trim());
    }
  }
  return blocks;
}

function headerPatternMatches(pattern: string, pathname: string): boolean {
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) return pathname.startsWith(pattern.slice(0, -1));
  return pathname === pattern;
}

/** What Cloudflare would serve for `pathname` from `public/_headers`. */
function simulatedCacheControl(pathname: string): string | undefined {
  let value: string | undefined;
  for (const block of headerBlocks()) {
    if (!headerPatternMatches(block.pattern, pathname)) continue;
    if (block.detach) value = undefined;
    for (const set of block.sets) {
      value = value === undefined ? set : `${value}, ${set}`;
    }
  }
  return value;
}

/** One probe per _headers Cache-Control rule, plus a path with no rule. */
const PATH_PROBES: Array<[string, string | undefined]> = [
  ["/assets/index-abc123.js", "public, max-age=31536000, immutable"],
  ["/assets/maplibre-gl-worker.mjs", "public, max-age=0, must-revalidate"],
  ["/assets/maplibre-gl-shared.mjs", "public, max-age=0, must-revalidate"],
  ["/assets/storyteller/storyteller-assets.json", "public, max-age=0, must-revalidate"],
  ["/sw.js", "no-cache"],
  ["/flags.json", "no-cache"],
  ["/build-meta.json", "no-cache"],
  ["/manifest.webmanifest", "no-cache"],
  ["/", "public, max-age=0, s-maxage=60, must-revalidate"],
  ["/index.html", "public, max-age=0, s-maxage=60, must-revalidate"],
  ["/offline", "public, max-age=0, must-revalidate"],
  ["/offline.html", "public, max-age=0, must-revalidate"],
  ["/_shell.html", "public, max-age=0, must-revalidate"],
  ["/audio/x.mp3", undefined],
];

test("getPathCacheControl matches the _headers simulation for every probe", () => {
  for (const [path, expected] of PATH_PROBES) {
    assert.equal(getPathCacheControl(path), expected, path);
    assert.equal(simulatedCacheControl(path), expected, `${path} (simulated)`);
  }
});

test("the path table covers every _headers Cache-Control block, with no orphan", () => {
  const blocks = headerBlocks().filter((b) => b.sets.length > 0 || b.detach);
  // 13 blocks carry Cache-Control: /assets/*, 3 carved files, the
  // no-cache group of 4, / + /index.html, /offline + /offline.html +
  // /_shell.html. A new block must add a probe above, not slip past.
  assert.equal(blocks.length, 13);
  for (const block of blocks) {
    if (block.pattern === "/assets/*") {
      assert.equal(getPathCacheControl("/assets/probe-xyz.js"), ASSETS_CACHE_CONTROL);
      continue;
    }
    assert.ok(block.pattern in PATH_CACHE_CONTROL, `${block.pattern} has no table entry`);
    assert.equal(getPathCacheControl(block.pattern), simulatedCacheControl(block.pattern), block.pattern);
  }
  for (const path of Object.keys(PATH_CACHE_CONTROL)) {
    assert.ok(
      blocks.some((b) => b.pattern === path),
      `${path} has no _headers block`,
    );
  }
});

test("withPathCacheControl sets Cache-Control for a non-HTML response without one", () => {
  const res = withPathCacheControl(
    new Response("{}", { headers: { "content-type": "application/json" } }),
    "/sw.js",
  );
  assert.equal(res.headers.get("cache-control"), "no-cache");
});

test("withPathCacheControl leaves an HTML response to the HTML default", () => {
  const res = withPathCacheControl(
    new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
    "/",
  );
  assert.equal(res.headers.get("cache-control"), null);
});

test("withPathCacheControl keeps a cache-control the route already set", () => {
  const res = withPathCacheControl(
    new Response("{}", { headers: { "content-type": "application/json", "cache-control": "no-store" } }),
    "/sw.js",
  );
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("withPathCacheControl leaves a path with no rule untouched", () => {
  const res = withPathCacheControl(
    new Response("audio", { headers: { "content-type": "audio/mpeg" } }),
    "/audio/x.mp3",
  );
  assert.equal(res.headers.get("cache-control"), null);
});

test("rendered / keeps HTML_CACHE_CONTROL, never the asset s-maxage value", () => {
  // Mirror the start.ts middleware composition exactly: security headers,
  // then the HTML default, then the path rule. The path rule must not
  // overwrite the HTML default, so a rendered page never carries
  // s-maxage=60 (owner rule, WI-18: rendered pages can carry
  // per-request state and need explicit say-so before edge caching).
  const res = withPathCacheControl(
    withHtmlCacheControl(
      withSecurityHeaders(new Response("<!doctype html>", { headers: { "content-type": "text/html" } })),
    ),
    "/",
  );
  assert.equal(res.headers.get("cache-control"), HTML_CACHE_CONTROL);
  assert.ok(!String(res.headers.get("cache-control")).includes("s-maxage"));
});

test("withPathCacheControl copies a response whose headers are immutable", () => {
  const frozen = new Response("{}", { headers: { "content-type": "application/json" } });
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
    const res = withPathCacheControl(frozen, "/sw.js");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-cache");
  } finally {
    Headers.prototype.set = originalSet;
  }
});
