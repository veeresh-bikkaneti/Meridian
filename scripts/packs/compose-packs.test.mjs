import { strict as assert } from "node:assert";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
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

test("the pilot composes: clue file 387, pack manifest, sidecar", () => {
  const { packDir, publicDir, coreManifestPath } = fixture();
  const result = composePack({
    packDir,
    publicDir,
    coreManifestPath,
    generatedAt: new Date("2026-11-03T00:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.loopIndexes, [387], "the first pack case continues after the core pool");

  const clue = readJson(join(publicDir, "loop", "clues", "387.json"));
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
  assert.equal(manifest.size, 1);
  assert.deepEqual(manifest.loopIndexes, [387]);
  assert.deepEqual(manifest.loopTiers, [1]);
  assert.equal(manifest.coldtrailFile, null);

  const meta = readJson(join(publicDir, "packs", "capitals", "loop-meta.json"));
  assert.equal(isLoopPackMeta(meta), true, "the runtime validator accepts the sidecar");
  assert.equal(meta["387"].subject.name, "France");
  assert.equal(meta["387"].direction, "A");

  assert.equal(
    readFileSync(coreManifestPath, "utf8"),
    JSON.stringify({ v: 1, size: 387, generatedAt: "x" }),
    "the core manifest is never rewritten",
  );
});

test("a record that fails validation writes nothing", () => {
  const { packDir, publicDir, coreManifestPath } = fixture();
  const casePath = join(packDir, "cases", "paris.json");
  const record = readJson(casePath);
  record.clues[0].text = `${record.clues[0].text} The city is Paris.`;
  writeFileSync(casePath, JSON.stringify(record));
  const result = composePack({ packDir, publicDir, coreManifestPath });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.caseId === "paris"));
  assert.equal(existsSync(join(publicDir, "loop", "clues", "387.json")), false);
  assert.equal(existsSync(join(publicDir, "packs", "capitals", "manifest.json")), false);
});
