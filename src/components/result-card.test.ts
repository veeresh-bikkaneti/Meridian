import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitLede } from "./story-lede.ts";

describe("splitLede — miss-card subscript contract", () => {
  it("splits the first sentence as the lede", () => {
    const [lede, rest] = splitLede(
      "Paris is the capital of France. It is known for the Eiffel Tower. Millions visit yearly.",
    );
    assert.equal(lede, "Paris is the capital of France.");
    assert.equal(
      rest,
      "It is known for the Eiffel Tower. Millions visit yearly.",
    );
  });

  it("the lede never appears in the rest (no duplication on the card)", () => {
    const story =
      "The Great Wall stretches over 13,000 miles. Built across dynasties, it defended China's northern border.";
    const [lede, rest] = splitLede(story);
    assert.ok(!rest.includes(lede), "lede must not repeat in the body");
    assert.equal(lede + " " + rest, story);
  });

  it("handles ? and ! as sentence terminators", () => {
    const [lede, rest] = splitLede("Is this the lede? Yes, the rest follows.");
    assert.equal(lede, "Is this the lede?");
    assert.equal(rest, "Yes, the rest follows.");
    const [lede2, rest2] = splitLede("Wow! Amazing place. Come visit.");
    assert.equal(lede2, "Wow!");
    assert.equal(rest2, "Amazing place. Come visit.");
  });

  it("a single-sentence story yields an empty rest", () => {
    const [lede, rest] = splitLede("Only one sentence here.");
    assert.equal(lede, "Only one sentence here.");
    assert.equal(rest, "");
  });

  it("text with no sentence terminator returns the whole text as lede", () => {
    const [lede, rest] = splitLede("No terminator at all");
    assert.equal(lede, "No terminator at all");
    assert.equal(rest, "");
  });

  it("trims whitespace around the split", () => {
    const [lede, rest] = splitLede("First.   Second with  spaces. ");
    assert.equal(lede, "First.");
    assert.equal(rest, "Second with  spaces.");
  });

  it("empty story yields empty lede and rest", () => {
    const [lede, rest] = splitLede("");
    assert.equal(lede, "");
    assert.equal(rest, "");
  });

  it("does not split on abbreviations like St.", () => {
    const [lede, rest] = splitLede("St. Petersburg was founded in 1703. It is beautiful.");
    assert.equal(lede, "St. Petersburg was founded in 1703.");
    assert.equal(rest, "It is beautiful.");
  });

  it("does not split on decimals like 3.5", () => {
    const [lede, rest] = splitLede("It is 3.5 km away. Nice view.");
    assert.equal(lede, "It is 3.5 km away.");
    assert.equal(rest, "Nice view.");
  });

  it("does not split on single-capital initials", () => {
    const [lede, rest] = splitLede("Founded by J. Smith in 1900. It grew fast.");
    assert.equal(lede, "Founded by J. Smith in 1900.");
    assert.equal(rest, "It grew fast.");
  });
});
// ---------------------------------------------------------------------------
// Pin-compare line (feat/reveal-pin-compare, Worker B)
// ---------------------------------------------------------------------------
// The card is a .tsx React component and its imports use the `@/` alias —
// neither of which plain node:test resolves (this repo has no DOM/loader
// test infra; cf. question-bubble.test.ts). So this block registers two
// test-only module hooks via a data: URL (no extra files):
//   - resolve: maps `@/x` -> `<repo>/src/x`, probing .ts/.tsx extensions.
//   - load: transpiles `.tsx` with the repo's own typescript (jsx: react-jsx).
// `@/game/reverse-geocode` is mocked at the module level (node:test
// mock.module) so these card tests never depend on Worker A's data loading.
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Run } from "../game/run.ts";
import type { Starter } from "../game/starters.ts";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Module-level mock of `@/game/reverse-geocode` (node:test's mock.module()
// was removed in Node 23+, so the test-only resolve hook below redirects the
// specifier to this data: URL module). Per-test scenarios ride on
// `globalThis.__pinMockScenario`, so card tests never depend on Worker A's
// data loading. pinCompareLine is a contract-faithful reimplementation of
// Worker A's module (same copy, same fail-closed rules).
const MOCK_REVERSE_GEOCODE = [
  "export async function preloadAdmin1Boundaries() {}",
  "export function resolvePin(lat, lon) {",
  "  const s = globalThis.__pinMockScenario;",
  "  if (!s) return null;",
  "  if (lat === s.dropLat && lon === s.dropLon) return s.dropPin;",
  "  if (lat === s.placeLat && lon === s.placeLon) return s.placePin;",
  "  return null;",
  "}",
  "export function pinCompareLine(player, truth) {",
  "  if (!player || !truth) return null;",
  "  if (!player.country || !truth.country) return null;",
  "  if (player.admin1 && truth.admin1 && player.country === truth.country) {",
  "    if (player.admin1 === truth.admin1) return 'Right state, wrong town!';",
  "    return 'Your pin: ' + player.admin1 + ' \\u00b7 True spot: ' + truth.admin1;",
  "  }",
  "  if (player.country === truth.country) return 'Right country, wrong town!';",
  "  return 'Your pin: ' + (player.admin1 ?? player.country) + ' \\u00b7 True spot: ' + (truth.admin1 ?? truth.country);",
  "}",
].join("\n");
const MOCK_REVERSE_GEOCODE_URL =
  "data:text/javascript," + encodeURIComponent(MOCK_REVERSE_GEOCODE);

// Built with string concatenation (no nested template literals) so it can
// ride inside encodeURIComponent as a data: URL.
const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '.json'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier === '@/game/reverse-geocode') {",
  "    return { url: " + JSON.stringify(MOCK_REVERSE_GEOCODE_URL) + ", shortCircuit: true };",
  "  }",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "    for (const ext of PROBE_EXTS.slice(1)) {",
  "      const cand = resolvePath(base, 'index' + ext);",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-zA-Z0-9]+$/.test(specifier) && context.parentURL && context.parentURL.startsWith('file:')) {",
  "    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);",
  "    for (const ext of PROBE_EXTS.slice(1)) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

type ResolvedPin = { admin1: string | null; country: string | null };

// Distinct coords so the mock can tell the player pin from the true spot.
const DROP_LAT = 41.1;
const DROP_LON = -96.7;
const PLACE_LAT = 38.9;
const PLACE_LON = -77.03;

// Per-test scenario for the mocked resolvePin. `null` pins (or a null
// scenario) make resolvePin return null — the fail-closed path.
function setPinScenario(
  dropPin: ResolvedPin | null,
  placePin: ResolvedPin | null,
): void {
  (globalThis as Record<string, unknown>).__pinMockScenario =
    dropPin === null && placePin === null
      ? null
      : {
          dropLat: DROP_LAT,
          dropLon: DROP_LON,
          placeLat: PLACE_LAT,
          placeLon: PLACE_LON,
          dropPin,
          placePin,
        };
}

const { ResultCard } = await import("./result-card.tsx");

function makeRun(phase: "story" | "done"): Run {
  return {
    edition: "state",
    regionId: "nebraska",
    regionName: "Nebraska",
    difficultyChoice: "medium",
    dateKey: "2026-10-03",
    index: 0,
    hits: 0,
    phase,
    streak: 0,
    bestStreak: 0,
    results: [],
    seed: 7,
    poolIds: [],
    prevLastId: null,
  };
}

function makePlace(): Starter {
  return {
    id: "worker-b-test-place",
    edition: "state",
    regionId: "nebraska",
    name: "Testville",
    lon: PLACE_LON,
    lat: PLACE_LAT,
    story:
      "Testville is a made-up town for tests. It sits quietly on the test plain.",
    sourceLabel: "Test source",
    sourceHref: "https://example.com/testville",
    difficulty: 2,
    curated: true,
  };
}

function renderCard(phase: "story" | "done"): string {
  return renderToString(
    createElement(ResultCard, {
      run: makeRun(phase),
      place: makePlace(),
      placeLabel: "Testville, Nebraska, United States",
      drop: {
        lon: DROP_LON,
        lat: DROP_LAT,
        distanceKm: 1234.5,
        placeId: "worker-b-test-place",
        breakdown: null,
        streakBefore: 0,
      },
      story: null,
      empty: false,
      dismissed: false,
      onDismissedChange: () => {},
      onContinue: () => {},
      growthLine: null,
    }),
  );
}

describe("result-card — pin-compare line (reveal)", () => {
  it("miss names both locations: Nebraska vs District of Columbia", () => {
    setPinScenario(
      { admin1: "Nebraska", country: "United States" },
      { admin1: "District of Columbia", country: "United States" },
    );
    const html = renderCard("done");
    assert.ok(
      html.includes('data-testid="pin-compare-line"'),
      "the pin-compare line element must render",
    );
    assert.ok(
      html.includes("Your pin: Nebraska · True spot: District of Columbia"),
      "the line must name both locations",
    );
    // The line sits directly under the distance paragraph.
    const distanceIdx = html.indexOf("off</p>");
    const lineIdx = html.indexOf("pin-compare-line");
    assert.ok(
      distanceIdx !== -1 && lineIdx > distanceIdx,
      "the line renders after the distance paragraph",
    );
  });

  it("same-state miss renders 'Right state, wrong town!'", () => {
    const nebraska = { admin1: "Nebraska", country: "United States" };
    setPinScenario(nebraska, nebraska);
    const html = renderCard("done");
    assert.ok(html.includes('data-testid="pin-compare-line"'));
    assert.ok(html.includes("Right state, wrong town!"));
  });

  it("resolvePin returning null renders no line (card unchanged)", () => {
    setPinScenario(null, null);
    const html = renderCard("done");
    assert.ok(
      !html.includes("pin-compare-line"),
      "no pin-compare element may render when pins are unresolvable",
    );
  });

  it("hit (phase story) renders no line even when pins differ", () => {
    setPinScenario(
      { admin1: "Nebraska", country: "United States" },
      { admin1: "District of Columbia", country: "United States" },
    );
    const html = renderCard("story");
    assert.ok(
      !html.includes("pin-compare-line"),
      "the hit card must not show the pin-compare line",
    );
  });
});
