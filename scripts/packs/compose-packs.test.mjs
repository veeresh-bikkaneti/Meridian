import { strict as assert } from "node:assert";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isLoopPackManifest, isLoopPackMeta } from "../../src/game/loop/packs.ts";
import { composePack } from "./compose-packs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** A scratch tree: the real capitals pack as fixture, a fake core of 387. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pack-compose-"));
  const packDir = join(root, "capitals");
  cpSync(join(HERE, "capitals"), packDir, { recursive: true });
  const publicDir = join(root, "public");
  const coreManifestPath = join(root, "core-manifest.json");
  writeFileSync(coreManifestPath, JSON.stringify({ v: 1, size: 387, generatedAt: "x" }));
  return { root, packDir, publicDir, coreManifestPath };
}

/** Case ids in the composer's order (caseId sort), read from the fixture source. */
function caseIdsInOrder() {
  return readdirSync(join(HERE, "capitals", "cases"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

test("the full pack composes: 110 clue files after the core pool, manifest, sidecar", () => {
  const { packDir, publicDir, coreManifestPath } = fixture();
  const result = composePack({
    packDir,
    publicDir,
    coreManifestPath,
    generatedAt: new Date("2026-11-03T00:00:00.000Z"),
  });
  assert.equal(result.ok, true, JSON.stringify(result.reasons ?? []));
  const caseIds = caseIdsInOrder();
  assert.equal(caseIds.length, 110);
  const expectedIndexes = caseIds.map((_, i) => 387 + i);
  assert.deepEqual(result.loopIndexes, expectedIndexes, "pack indexes continue after the core pool in caseId order");
  assert.equal(result.size, 110);

  // Paris sits at its caseId-order position; its clue file is an
  // ordinary clue file that never names the target.
  const parisIndex = 387 + caseIds.indexOf("paris-france");
  const clue = readJson(join(publicDir, "loop", "clues", `${parisIndex}.json`));
  assert.equal(clue.v, 1);
  assert.equal(clue.placeId, "geonames:2988507");
  assert.deepEqual(clue.target, { lon: 2.3488, lat: 48.85341 });
  assert.equal(clue.clues.length, 5);
  assert.ok(
    clue.clues.every((text) => !/paris/i.test(text)),
    "the published clue file never names the target",
  );
  assert.deepEqual(clue.source, { label: "Wikipedia", href: "https://en.wikipedia.org/wiki/Paris" });

  const manifest = readJson(join(publicDir, "packs", "capitals", "manifest.json"));
  assert.equal(isLoopPackManifest(manifest), true, "the runtime validator accepts the manifest");
  assert.equal(manifest.size, 110);
  assert.deepEqual(manifest.loopIndexes, expectedIndexes);
  assert.equal(manifest.loopTiers.length, 110);
  assert.equal(manifest.coldtrailFile, "cases.capitals.generated.json");

  const meta = readJson(join(publicDir, "packs", "capitals", "loop-meta.json"));
  assert.equal(isLoopPackMeta(meta), true, "the runtime validator accepts the sidecar");
  assert.equal(Object.keys(meta).length, 110);
  assert.equal(meta[String(parisIndex)].subject.name, "France");
  assert.equal(meta[String(parisIndex)].direction, "A");

  assert.equal(
    readFileSync(coreManifestPath, "utf8"),
    JSON.stringify({ v: 1, size: 387, generatedAt: "x" }),
    "the core manifest is never rewritten",
  );
});

test("a record that fails validation writes nothing", () => {
  const { packDir, publicDir, coreManifestPath } = fixture();
  const casePath = join(packDir, "cases", "paris-france.json");
  const record = readJson(casePath);
  record.clues[0].text = `${record.clues[0].text} The city is Paris.`;
  writeFileSync(casePath, JSON.stringify(record));
  const result = composePack({ packDir, publicDir, coreManifestPath });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.caseId === "paris-france"));
  assert.equal(existsSync(join(publicDir, "loop", "clues", "387.json")), false);
  assert.equal(existsSync(join(publicDir, "packs", "capitals", "manifest.json")), false);
});

test("append-only: removing a published case fails closed (Capitals & Flags §8)", () => {
  const { packDir, publicDir, coreManifestPath } = fixture();
  const first = composePack({
    packDir,
    publicDir,
    coreManifestPath,
    generatedAt: new Date("2026-11-04T00:00:00.000Z"),
  });
  assert.equal(first.ok, true, JSON.stringify(first.reasons ?? []));
  // Delete one record + its input, then recompose against the
  // published tree: the composer must refuse rather than renumber.
  rmSync(join(packDir, "cases", "paris-france.json"));
  rmSync(join(packDir, "inputs", "paris-france.json"));
  const second = composePack({
    packDir,
    publicDir,
    coreManifestPath,
    generatedAt: new Date("2026-11-04T01:00:00.000Z"),
  });
  assert.equal(second.ok, false);
  assert.ok(
    second.reasons.some((r) => r.code === "PACK_APPEND_ONLY"),
    JSON.stringify(second.reasons),
  );
});
