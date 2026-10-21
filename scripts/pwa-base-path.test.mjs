/**
 * PWA base-path contract (review finding P1-4, 2026-10-21).
 *
 * The same public/ files ship in two builds with different bases:
 * GitHub Pages (`/Meridian/`) and Cloudflare Workers (`/`). The manifest
 * and service worker must therefore never hardcode a base path:
 * - manifest.webmanifest uses "./" (resolved against its own URL);
 * - sw.js derives BASE from its own location.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const swSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

test("manifest scope/start_url/id are base-relative", () => {
  for (const key of ["id", "scope", "start_url"]) assert.equal(manifest[key], "./", key);
  for (const icon of manifest.icons) assert.ok(!icon.src.startsWith("/"), icon.src);
  // Resolution check for both hosts.
  assert.equal(new URL(manifest.start_url, "https://a.test/Meridian/manifest.webmanifest").pathname, "/Meridian/");
  assert.equal(new URL(manifest.start_url, "https://b.test/manifest.webmanifest").pathname, "/");
});

test("sw.js has no hardcoded /Meridian/ path in code", () => {
  const code = swSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/["'`]\/Meridian\//.test(code), "string literal with /Meridian/ found in sw.js code");
});

function loadSw(href) {
  const listeners = {};
  const self = { location: new URL(href), addEventListener: (t, fn) => (listeners[t] = fn) };
  const ctx = vm.createContext({ self, URL, caches: {}, fetch: () => {}, Promise, console });
  vm.runInContext(`${swSource}\n;globalThis.__probe = { BASE, START_URL, FLAGS_URL, SHELL_URLS, isStaticAsset };`, ctx);
  return ctx.__probe;
}

test("sw.js derives BASE for the GitHub Pages build", () => {
  const p = loadSw("https://x.github.io/Meridian/sw.js");
  assert.equal(p.BASE, "/Meridian/");
  assert.equal(p.FLAGS_URL, "/Meridian/flags.json");
  assert.ok(p.isStaticAsset("/Meridian/assets/index-abc.js"));
  assert.ok(!p.isStaticAsset("/assets/index-abc.js"));
});

test("sw.js derives BASE for the Cloudflare (root) build", () => {
  const p = loadSw("https://meridian.example.workers.dev/sw.js");
  assert.equal(p.BASE, "/");
  assert.equal(p.START_URL, "/");
  assert.deepEqual([...p.SHELL_URLS], ["/", "/offline.html", "/manifest.webmanifest"]);
  assert.ok(p.isStaticAsset("/assets/index-abc.js"));
  assert.ok(p.isStaticAsset("/loop/manifest.json"));
  assert.ok(!p.isStaticAsset("/build-meta.json"));
});
