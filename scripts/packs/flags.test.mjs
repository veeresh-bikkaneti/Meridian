/**
 * Capitals & Flags build-time tests: flagKey derivation, the sidecar's
 * flagKey rule, SVG inspection, and the registry validator (Flagstaff).
 */
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { flagKeyForSubject, loopMetaEntry, US_STATE_POSTAL } from "./schema.mjs";
import {
  inspectSvg,
  renderFlagModule,
  sha256Hex,
  validateFlagRegistry,
} from "./build-flags.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const parisRecord = () => readJson(join(HERE, "capitals", "cases", "paris-france.json"));
const lincolnRecord = () =>
  readJson(join(HERE, "capitals", "cases", "lincoln-nebraska.json"));

test("flagKeyForSubject: a country subject is its lowercase iso2", () => {
  assert.equal(flagKeyForSubject({ kind: "country", iso2: "FR" }), "fr");
  assert.equal(flagKeyForSubject({ kind: "country", iso2: "US" }), "us");
});

test("flagKeyForSubject: a state subject is us- plus its postal code", () => {
  assert.equal(
    flagKeyForSubject({ kind: "state", iso2: "US", subdivision: "Nebraska" }),
    "us-ne",
  );
  assert.equal(
    flagKeyForSubject({ kind: "state", iso2: "US", subdivision: "New York" }),
    "us-ny",
  );
  assert.equal(Object.keys(US_STATE_POSTAL).length, 50);
});

test("flagKeyForSubject: an unmapped subdivision fails closed", () => {
  assert.throws(
    () => flagKeyForSubject({ kind: "state", iso2: "US", subdivision: "Atlantis" }),
    /no USPS postal code/,
  );
});

test("loopMetaEntry carries flagKey only when the land is licence-verified", () => {
  const verified = loopMetaEntry(parisRecord(), new Set(["fr"]));
  assert.equal(verified.flagKey, "fr");
  const unverified = loopMetaEntry(parisRecord(), new Set(["de"]));
  assert.equal("flagKey" in unverified, false);
  const noRegistry = loopMetaEntry(parisRecord());
  assert.equal("flagKey" in noRegistry, false);
  const state = loopMetaEntry(lincolnRecord(), new Set(["us-ne"]));
  assert.equal(state.flagKey, "us-ne");
});

const GOOD_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/></svg>';

test("inspectSvg: a clean SVG passes with its aspect", () => {
  const { problems, aspect } = inspectSvg(GOOD_SVG);
  assert.deepEqual(problems, []);
  assert.equal(aspect, 1.5);
});

test("inspectSvg: script and external references are rejected", () => {
  assert.ok(inspectSvg('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>').problems.length > 0);
  assert.ok(
    inspectSvg('<svg viewBox="0 0 1 1"><image href="https://example.com/x.png"/></svg>')
      .problems.length > 0,
  );
  assert.ok(inspectSvg("<svg><rect/></svg>").problems.some((p) => /viewBox/.test(p)));
});

function registryFixture(entryOverrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "flag-registry-"));
  const assetsDir = join(root, "assets");
  mkdirSync(assetsDir, { recursive: true });
  const bytes = Buffer.from(GOOD_SVG, "utf8");
  writeFileSync(join(assetsDir, "fr.svg"), bytes);
  const entry = {
    land: "France",
    file: "Flag of France.svg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Flag_of_France.svg",
    filePath: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_France.svg",
    license: "Public domain",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    attribution: "Original: Unknown; vector: SKopp",
    bytes: bytes.length,
    sha256: sha256Hex(bytes),
    aspect: 1.5,
    story: "Its three bands stand for liberty, equality and brotherhood.",
    storySource: "https://en.wikipedia.org/wiki/Flag_of_France",
    altText: "Vertical bands of blue, white and red",
    ...entryOverrides,
  };
  const registryPath = join(root, "registry.json");
  writeFileSync(registryPath, JSON.stringify({ v: 1, flags: { fr: entry }, flagless: {} }));
  return { registryPath, assetsDir };
}

test("validateFlagRegistry: a consistent registry passes", () => {
  const { registryPath, assetsDir } = registryFixture();
  const result = validateFlagRegistry({ registryPath, assetsDir });
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
});

test("validateFlagRegistry: sha drift and a bad licence fail closed", () => {
  const drift = registryFixture({ sha256: "0".repeat(64) });
  assert.equal(validateFlagRegistry(drift).ok, false);
  const licence = registryFixture({ license: "All rights reserved" });
  const result = validateFlagRegistry(licence);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => /licence/.test(p)));
});

test("renderFlagModule: deterministic, sorted, carries the story fields", () => {
  const registry = readJson(
    join(HERE, "capitals", "flags", "registry.json"),
  );
  const text = renderFlagModule(registry);
  assert.equal(text, renderFlagModule(registry));
  assert.ok(text.includes("FLAG_ENTRIES"));
  const keys = Object.keys(registry.flags);
  assert.ok(keys.length > 0, "the shipped registry has flags");
});
