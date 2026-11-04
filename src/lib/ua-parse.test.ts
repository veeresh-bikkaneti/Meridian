import assert from "node:assert/strict";
import test from "node:test";
import corpus from "./ua-corpus.json" with { type: "json" };
import { DEVICE_FIELD_KEYS, TELEMETRY_MANIFEST } from "./telemetry-manifest.ts";
import { parseRuntimeUA, type ParsedUA } from "./ua-parse.ts";

interface CorpusRow {
  id: string;
  ua: string;
  maxTouchPoints?: number;
  hasClientHints?: boolean;
  watchdog: boolean;
  expect: ParsedUA;
}

const rows = corpus as CorpusRow[];

test("corpus: at least 28 rows, ids unique, every row complete", () => {
  assert.ok(rows.length >= 28, `corpus has ${rows.length} rows, need >= 28 (§3.5)`);
  const ids = new Set(rows.map((r) => r.id));
  assert.equal(ids.size, rows.length, "row ids unique");
  for (const row of rows) {
    for (const k of ["browser", "browserVersion", "engine", "os", "osVersion", "deviceClass"] as const) {
      assert.equal(typeof row.expect[k], "string", `${row.id}: expect.${k} present`);
      assert.notEqual(row.expect[k], undefined, `${row.id}: no undefined in ParsedUA`);
    }
  }
  assert.ok(rows.some((r) => r.id === "incident-iphone11-ios1641"), "incident row present");
  assert.ok(rows.some((r) => r.watchdog), "watchdog rows present");
  assert.ok(rows.some((r) => r.hasClientHints), "Client-Hints tripwire row present");
});

for (const row of rows) {
  test(`corpus: ${row.id}`, () => {
    const got = parseRuntimeUA(row.ua, {
      maxTouchPoints: row.maxTouchPoints,
      hasClientHints: row.hasClientHints,
    });
    assert.deepEqual(got, row.expect);
  });
}

test("parser: total on empty and non-string-shaped input", () => {
  const empty = parseRuntimeUA("");
  assert.deepEqual(empty, {
    browser: "unknown",
    browserVersion: "unknown",
    engine: "unknown",
    os: "other",
    osVersion: "unknown",
    deviceClass: "unknown",
  });
});

test("parser: rule order — adding SamsungBrowser/ flips a Chrome UA from B6 to B1", () => {
  const chromeUa =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";
  assert.equal(parseRuntimeUA(chromeUa).browser, "chrome");
  const samsungUa = chromeUa.replace("Chrome/112.0.0.0", "SamsungBrowser/23.0 Chrome/112.0.0.0");
  const got = parseRuntimeUA(samsungUa);
  assert.equal(got.browser, "samsung");
  assert.equal(got.browserVersion, "23.0");
  assert.equal(got.engine, "blink");
});

test("parser: Safari version comes from Version/, never the Safari/ build number", () => {
  const got = parseRuntimeUA(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  );
  assert.equal(got.browserVersion, "16.4");
});

test("manifest: DEVICE_FIELD_KEYS equals the manifest's device rows, sorted", () => {
  const fromManifest = TELEMETRY_MANIFEST.filter((f) => f.wire === "device")
    .map((f) => f.key)
    .sort();
  assert.deepEqual([...DEVICE_FIELD_KEYS].sort(), fromManifest);
  assert.deepEqual([...DEVICE_FIELD_KEYS], [...DEVICE_FIELD_KEYS].sort(), "list is stored sorted");
  assert.equal(new Set(DEVICE_FIELD_KEYS).size, DEVICE_FIELD_KEYS.length, "no duplicates");
});

test("manifest: every §1.2 field has a row; only memory/cores carry the amendment", () => {
  const amended = TELEMETRY_MANIFEST.filter((f) => f.amendment !== null).map((f) => f.key).sort();
  assert.deepEqual(amended, ["deviceMemory", "hardwareConcurrency"]);
  for (const key of ["mapMode", "lastMilestone", "msSinceBootStart", "unfinishedBoots", "deviceSource"]) {
    assert.ok(
      TELEMETRY_MANIFEST.some((f) => f.key === key && f.wire === "top-level"),
      `top-level row for ${key}`,
    );
  }
});
