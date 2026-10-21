import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CF_BEACON_SRC, cfBeaconScript } from "./web-analytics.ts";

test("no token → no analytics tag (fail-closed)", () => {
  assert.equal(cfBeaconScript(undefined), null);
  assert.equal(cfBeaconScript(""), null);
  assert.equal(cfBeaconScript("   "), null);
});

test("a malformed token can never inject markup or another URL", () => {
  assert.equal(cfBeaconScript('abc"><script>'), null);
  assert.equal(cfBeaconScript("https://evil.example/x.js"), null);
  assert.equal(cfBeaconScript("short"), null);
});

test("a valid token yields the Cloudflare beacon with a JSON data-cf-beacon payload", () => {
  const tag = cfBeaconScript(" 0123456789abcdef0123456789abcdef ");
  assert.deepEqual(tag, {
    src: CF_BEACON_SRC,
    "data-cf-beacon": '{"token":"0123456789abcdef0123456789abcdef"}',
    defer: true,
  });
  assert.equal(CF_BEACON_SRC, "https://static.cloudflareinsights.com/beacon.min.js");
});

test("COPPA: the app shell carries no Google Analytics or Clarity code", () => {
  const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
  for (const banned of ["googletagmanager", "gtag(", "clarity.ms", "VITE_GA4_MEASUREMENT_ID", "VITE_CLARITY_PROJECT_ID"]) {
    assert.ok(!root.includes(banned), `__root.tsx must not contain ${banned}`);
  }
});
