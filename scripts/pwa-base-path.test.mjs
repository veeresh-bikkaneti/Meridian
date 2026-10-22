/**
 * PWA base-path contract (review finding P1-4, 2026-10-21).
 *
 * The same public/ files ship in two builds with different bases:
 * GitHub Pages (`/Meridian/`) and Cloudflare Workers (`/`). The manifest
 * and service worker must therefore never hardcode a base path:
 * - manifest.webmanifest uses "./" for scope/start_url (resolved against
 *   its own URL) and omits id (see manifestUrls below);
 * - sw.js derives BASE from its own location.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const swSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

/**
 * Web App Manifest id processing (W3C Manifest, "processing the id member"):
 * id is parsed with the ORIGIN of start_url as its base, NOT start_url's
 * path. So "id":"./" would resolve to "https://host/" on both builds and
 * collapse the Pages app's identity onto the github.io origin root. With no
 * id, the id defaults to the resolved start_url, which is base-correct.
 */
function manifestUrls(manifestHref) {
  const startUrl = new URL(manifest.start_url ?? ".", manifestHref);
  const id = manifest.id === undefined ? startUrl : new URL(manifest.id, startUrl.origin);
  id.hash = "";
  return { startUrl, id, scope: new URL(manifest.scope ?? ".", manifestHref) };
}

test("manifest scope/start_url are base-relative and id is omitted", () => {
  for (const key of ["scope", "start_url"]) assert.equal(manifest[key], "./", key);
  assert.equal(manifest.id, undefined, "id must be omitted: './' resolves against the origin, not the base path");
  for (const icon of manifest.icons) assert.ok(!icon.src.startsWith("/"), icon.src);
});

test("manifest start_url, scope and (spec-resolved) id land on each build's base", () => {
  for (const [href, base] of [
    ["https://veeresh-bikkaneti.github.io/Meridian/manifest.webmanifest", "/Meridian/"],
    ["https://meridian.example.workers.dev/manifest.webmanifest", "/"],
  ]) {
    const u = manifestUrls(href);
    assert.equal(u.startUrl.pathname, base, `start_url on ${href}`);
    assert.equal(u.scope.pathname, base, `scope on ${href}`);
    assert.equal(u.id.pathname, base, `id on ${href}`);
  }
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
