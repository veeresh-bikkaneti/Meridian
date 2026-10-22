/**
 * ServerFnGuard (review S5): clean 404/405 for /_serverFn/ probes, and a
 * pin that keeps SERVER_FUNCTIONS_IN_USE honest.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_FUNCTIONS_IN_USE, ServerFnGuard } from "./server-fn-guard.ts";

const req = (path: string, method = "GET") =>
  new Request(`https://meridian.example${path}`, { method });

test("bare /_serverFn/ is a clean 404 (was TanStack's unhandled 500)", async () => {
  const res = new ServerFnGuard().check(req("/_serverFn/"));
  assert.ok(res);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "not found" });
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("unknown function ids are a 404 while no server functions ship", async () => {
  const guard = new ServerFnGuard({ functionsInUse: false });
  for (const m of ["GET", "POST"]) {
    const res = guard.check(req("/_serverFn/abc123", m));
    assert.equal(res?.status, 404, m);
    // No framework detail in the body.
    assert.doesNotMatch(await res!.text(), /Server function|TSR|HTTPError/);
  }
});

test("other methods are 405 with an Allow header", () => {
  for (const m of ["PUT", "DELETE", "PATCH", "OPTIONS"]) {
    const res = new ServerFnGuard().check(req("/_serverFn/abc", m));
    assert.equal(res?.status, 405, m);
    assert.equal(res?.headers.get("allow"), "GET, POST");
  }
});

test("with server functions in use, real ids pass through to TanStack (CSRF still runs there)", () => {
  const guard = new ServerFnGuard({ functionsInUse: true });
  assert.equal(guard.check(req("/_serverFn/abc123", "POST")), null);
  assert.equal(guard.check(req("/_serverFn/abc123", "GET")), null);
  // Malformed requests are still answered cleanly.
  assert.equal(guard.check(req("/_serverFn/", "POST"))?.status, 404);
  assert.equal(guard.check(req("/_serverFn/abc", "PUT"))?.status, 405);
});

test("non-server-function paths are never touched", () => {
  const guard = new ServerFnGuard();
  for (const p of ["/", "/privacy", "/api/contact", "/_serverFn", "/assets/_serverFn/x", "/x/_serverFn/"]) {
    assert.equal(guard.check(req(p, "POST")), null, p);
  }
});

test("a custom base is honored", () => {
  const guard = new ServerFnGuard({ base: "/rpc" });
  assert.equal(guard.check(req("/rpc/"))?.status, 404);
  assert.equal(guard.check(req("/_serverFn/")), null);
});

/**
 * SERVER_FUNCTIONS_IN_USE must be true as soon as app code can call a
 * server function. Today the only createServerFn is the platform
 * connector scaffold in src/lib/app-data, which no app code imports, so the
 * build's server-function manifest is empty.
 */
test("SERVER_FUNCTIONS_IN_USE matches the source tree", () => {
  const srcDir = fileURLToPath(new URL("../..", import.meta.url));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "routeTree.gen.ts") files.push(full);
    }
  };
  walk(srcDir);
  const rel = (f: string) => relative(srcDir, f).split("\\").join("/");
  const code = (f: string) =>
    readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const definers = files.filter((f) => /createServerFn\s*\(/.test(code(f))).map(rel);
  const appDataImporters = files
    .filter((f) => !rel(f).startsWith("lib/app-data/"))
    .filter((f) => /from\s+["'][^"']*lib\/app-data[^"']*["']/.test(code(f)))
    .map(rel);
  const inUse = definers.some((f) => !f.startsWith("lib/app-data/")) || appDataImporters.length > 0;
  assert.equal(
    SERVER_FUNCTIONS_IN_USE,
    inUse,
    `server functions reachable from app code: definers=${definers.join(",")} app-data importers=${appDataImporters.join(",")}. ` +
      "Update SERVER_FUNCTIONS_IN_USE in src/lib/server/server-fn-guard.ts.",
  );
});
