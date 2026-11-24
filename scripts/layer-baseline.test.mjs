/**
 * Staleness guard for eslint/layer-baseline.json (Phase 0, PR 0.2):
 * the layer baseline can only shrink. The baseline is per violation
 * — noUpwardImport entries are "file|specifier", noRawIo entries
 * are "file|what", duplicates kept — and for every baselined file
 * the baselined key multiset must equal the file's live key
 * multiset, recomputed with the rule module's own detectors
 * (importViolationKeys / rawIoKeys in eslint/layer-rule.mjs), so
 * this test and the lint can never disagree. A baselined key that
 * no longer fires is stale and must be removed in the same PR that
 * cures it; a live key with no entry is an unbaselined violation
 * (lint:arch fails on it too).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { importViolationKeys, layerArchConfigs, rawIoKeys } from "../eslint/layer-rule.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
const baseline = JSON.parse(read("eslint/layer-baseline.json"));

const byFile = (entries) => {
  const map = new Map();
  for (const entry of entries) {
    const file = entry.slice(0, entry.indexOf("|"));
    if (!map.has(file)) map.set(file, []);
    map.get(file).push(entry);
  }
  return map;
};

const counts = (keys) => {
  const map = new Map();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return map;
};

/** Multiset equality with a named entry in the failure message. */
function assertSameKeys(file, baselined, live) {
  const b = counts(baselined);
  const l = counts(live);
  for (const [key, n] of b) {
    const liveN = l.get(key) ?? 0;
    assert.ok(
      liveN >= n,
      `${key}: baselined ${n}x but the file now has ${liveN} — stale entry, remove it from eslint/layer-baseline.json`,
    );
  }
  for (const [key, n] of l) {
    const baseN = b.get(key) ?? 0;
    assert.ok(
      baseN >= n,
      `${key}: ${n} live in ${file} but only ${baseN} baselined — unbaselined violation, fix the code (the baseline can only shrink)`,
    );
  }
}

const liveKeys = (file, detector) => (existsSync(join(repoRoot, file)) ? detector(file, read(file)) : []);

describe("layer baseline (KNOWN/STALE)", () => {
  it("carries exactly the two rule lists", () => {
    const kinds = Object.keys(baseline).filter((k) => k !== "comment").sort();
    assert.deepEqual(kinds, ["noRawIo", "noUpwardImport"]);
  });

  it("every noUpwardImport entry matches the file's live import violations", () => {
    for (const [file, entries] of byFile(baseline.noUpwardImport)) {
      assertSameKeys(file, entries, liveKeys(file, importViolationKeys));
    }
  });

  it("every noRawIo entry matches the file's live raw-I/O touches", () => {
    for (const [file, entries] of byFile(baseline.noRawIo)) {
      assertSameKeys(file, entries, liveKeys(file, rawIoKeys));
    }
  });

  it("a NEW upward import in an already-baselined file still fails the rule", () => {
    // src/components/home-globe.tsx is baselined for
    // "@/assets/home-v5/globe-fallback.webp" (cross-area). The baselined
    // import is suppressed; a second, unlisted cross-area import
    // in the same file is not covered and must be reported.
    const linter = new Linter();
    const lint = (code, filename) =>
      linter.verify(
        code,
        [
          {
            files: ["**/*.{ts,tsx}"],
            languageOptions: { ecmaVersion: 2022, sourceType: "module" },
          },
          ...layerArchConfigs,
        ],
        { filename },
      );
    const file = "src/components/home-globe.tsx";
    const hits = (messages) => messages.filter((m) => m.ruleId === "layer/no-upward-import");
    const baselinedOnly = lint('import "@/assets/home-v5/globe-fallback.webp";\n', file);
    assert.deepEqual(hits(baselinedOnly), [], JSON.stringify(baselinedOnly));
    const withNew = lint(
      'import "@/assets/home-v5/globe-fallback.webp";\nimport "@/components/age-profile/GrownUpGate.tsx";\n',
      file,
    );
    assert.equal(hits(withNew).length, 1, JSON.stringify(withNew));
  });

  it("the atlas-map module lives in src/map and imports no other feature area", () => {
    // TD-06.3 cured the nine baselined cross-area rows by moving the
    // component into src/map/. The detector must find nothing there.
    const file = "src/map/atlas-map.tsx";
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.deepEqual(importViolationKeys(file, source), []);
  });

  it("detector keys equal rule firings on computed-access shapes", () => {
    // x[localStorage] uses the name as a bracket key — not a storage
    // touch, and neither side may emit a key for it. A real member
    // touch and a computed globalThis["fetch"]() must appear on both
    // sides with the same descriptor.
    const file = "src/lib/fixture-agreement.ts";
    const code = [
      "const store = { key: 1 };",
      "console.log(store[localStorage]);",
      'localStorage.getItem("k");',
      'globalThis["fetch"]("/x");',
      "",
    ].join("\n");
    const linter = new Linter();
    const messages = linter.verify(
      code,
      [
        {
          files: ["**/*.{ts,tsx}"],
          languageOptions: { ecmaVersion: 2022, sourceType: "module" },
        },
        ...layerArchConfigs,
      ],
      { filename: file },
    );
    const ruleWhats = messages
      .filter((m) => m.ruleId === "platform/no-raw-io")
      .map((m) => /^Raw (.+?) outside src\/platform/.exec(m.message)?.[1])
      .sort();
    const detectorWhats = rawIoKeys(file, code)
      .map((k) => k.slice(k.indexOf("|") + 1))
      .sort();
    assert.deepEqual(ruleWhats, ["globalThis.fetch()", "localStorage access"], JSON.stringify(messages));
    assert.deepEqual(detectorWhats, ruleWhats);
  });
});
