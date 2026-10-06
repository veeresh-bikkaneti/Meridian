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
  // revealPinLine is the production card's entry point. The mock replays the
  // real module's funnel contract: state edition → classic byte-identical;
  // country/globe → the scenario's explicit line when set (stands in for an
  // honest nearestPoolPlace detail), else the classic fallback.
  "export function revealPinLine(input) {",
  "  const classic = pinCompareLine(",
  "    resolvePin(input.playerLat, input.playerLon),",
  "    resolvePin(input.truth.lat, input.truth.lon));",
  "  if (!input || input.edition === 'state') return classic;",
  "  const s = globalThis.__pinMockScenario;",
  "  if (s && typeof s.revealPinLine === 'string') return s.revealPinLine;",
  "  return classic;",
  "}",
  // revealPinCompare is what the Cartographer's Plate ledger renders. The
  // mock derives the structured sides from the same scenario string the
  // string mock above produces — contract-faithful to the real
  // splitClassic: verdict copy stays a verdict, "near " is detected, never
  // duplicated.
  "export function revealPinCompare(input) {",
  "  const line = revealPinLine(input);",
  "  if (line === null || line === undefined) return null;",
  "  const sep = ' · ';",
  "  const i = line.indexOf(sep);",
  "  if (i === -1) return { kind: 'verdict', text: line };",
  "  const pinPart = line.slice('Your pin: '.length, i);",
  "  const truthPart = line.slice(i + sep.length);",
  "  const truth = truthPart.indexOf('True spot: ') === 0",
  "    ? truthPart.slice('True spot: '.length)",
  "    : truthPart;",
  "  const near = pinPart.indexOf('near ') === 0;",
  "  return { kind: 'named', pin: near ? pinPart.slice(5) : pinPart, truth: truth, near: near };",
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

// Per-test scenario for the mocked resolvePin/revealPinLine. `null` pins (or
// a null scenario) make resolvePin return null — the fail-closed path. An
// explicit `revealLine` stands in for an honest nearestPoolPlace detail on
// country/globe editions; when omitted the mock falls back to the classic
// line, exactly like the production gate failure.
function setPinScenario(
  dropPin: ResolvedPin | null,
  placePin: ResolvedPin | null,
  revealLine?: string,
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
          revealPinLine: revealLine ?? null,
        };
}

const { ResultCard } = await import("./result-card.tsx");

function makeRun(
  phase: "story" | "done",
  edition: "state" | "country" | "globe" = "state",
): Run {
  return {
    edition,
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

function renderCard(
  phase: "story" | "done",
  edition: "state" | "country" | "globe" = "state",
  drop: Parameters<typeof ResultCard>[0]["drop"] = {
    lon: DROP_LON,
    lat: DROP_LAT,
    distanceKm: 1234.5,
    placeId: "worker-b-test-place",
    breakdown: null,
    streakBefore: 0,
  },
): string {
  return renderToString(
    createElement(ResultCard, {
      run: makeRun(phase, edition),
      place: makePlace(),
      placeLabel: "Testville, Nebraska, United States",
      drop,
      story: null,
      empty: false,
      dismissed: false,
      onDismissedChange: () => {},
      onContinue: () => {},
      growthLine: null,
      // The prop exists so the card can scan the dealing pool; the mock
      // revealPinLine ignores its contents (scenarios ride on the global).
      poolPlaces: [],
    }),
  );
}

describe("result-card — pin-compare ledger (reveal)", () => {
  // The Cartographer's Plate ledger is a real <dl>: stacked YOUR PIN /
  // TRUE SPOT entries (DT small-caps eyebrow ABOVE DD — never
  // side-by-side). The E2E seam data-testid="pin-compare-line" survives
  // on the <dl>, never renamed.
  function ledgerHtml(html: string): string {
    const start = html.indexOf('data-testid="pin-compare-line"');
    assert.ok(start !== -1, "the pin-compare ledger must render");
    const dlStart = html.lastIndexOf("<dl", start);
    const dlEnd = html.indexOf("</dl>", start);
    assert.ok(dlStart !== -1 && dlEnd !== -1, "the ledger must be a real <dl>");
    return html.slice(dlStart, dlEnd);
  }

  it("miss renders a real <dl> ledger naming both sides, stacked", () => {
    setPinScenario(
      { admin1: "Nebraska", country: "United States" },
      { admin1: "District of Columbia", country: "United States" },
    );
    const html = renderCard("done");
    const ledger = ledgerHtml(html);
    assert.ok(ledger.includes("<dt>Your pin</dt>"), "YOUR PIN eyebrow stacks above its name");
    assert.ok(ledger.includes("Nebraska"), "the pin side names the location");
    assert.ok(ledger.includes("True spot"), "TRUE SPOT eyebrow stacks above its name");
    assert.ok(
      ledger.includes("Testville, Nebraska, United States"),
      "TRUE SPOT carries the full answer name — the name's hero moment",
    );
    // The ledger sits directly under the distance paragraph.
    const distanceIdx = html.indexOf("east of your pin</p>");
    const lineIdx = html.indexOf("pin-compare-line");
    assert.ok(
      distanceIdx !== -1 && lineIdx > distanceIdx,
      "the ledger renders after the distance paragraph",
    );
  });

  it("same-state miss renders 'Right state, wrong town!' as the pin verdict", () => {
    const nebraska = { admin1: "Nebraska", country: "United States" };
    setPinScenario(nebraska, nebraska);
    const html = renderCard("done");
    const ledger = ledgerHtml(html);
    assert.ok(ledger.includes("Right state, wrong town!"));
    assert.ok(
      ledger.includes("Testville, Nebraska, United States"),
      "TRUE SPOT still names the full answer even for verdict copy",
    );
  });

  it("resolvePin returning null renders no ledger (card unchanged)", () => {
    setPinScenario(null, null);
    const html = renderCard("done");
    assert.ok(
      !html.includes("pin-compare-line"),
      "no pin-compare element may render when pins are unresolvable",
    );
  });

  it("hit (phase story) renders no ledger even when pins differ", () => {
    setPinScenario(
      { admin1: "Nebraska", country: "United States" },
      { admin1: "District of Columbia", country: "United States" },
    );
    const html = renderCard("story");
    assert.ok(
      !html.includes("pin-compare-line"),
      "the hit card must not show the pin-compare ledger",
    );
  });

  it("country edition renders the detail ledger with the honest 'near' qualifier", () => {
    setPinScenario(
      { admin1: null, country: "Italy" },
      { admin1: null, country: "Italy" },
      "Your pin: near Cagliari, Sardinia · True spot: Reggio di Calabria, Calabria",
    );
    const html = renderCard("done", "country");
    const ledger = ledgerHtml(html);
    assert.ok(
      ledger.includes("Cagliari, Sardinia"),
      "the pin side names the nearest place",
    );
    assert.ok(
      ledger.includes("near "),
      "the honest 'near' qualifier survives as sentence-case quiet text (NOT italic)",
    );
    assert.ok(
      !ledger.includes("<i>near"),
      "the qualifier is never italic (dyslexia-safe)",
    );
  });

  it("globe edition renders the symmetric country-level ledger", () => {
    setPinScenario(
      { admin1: null, country: "Italy" },
      { admin1: null, country: "Italy" },
      "Your pin: Italy · True spot: Italy",
    );
    const html = renderCard("done", "globe");
    const ledger = ledgerHtml(html);
    assert.ok(
      ledger.includes("Italy"),
      "globe ledger names the country on the pin side, never admin-1 or 'near <city>'",
    );
    assert.ok(!ledger.includes("near "), "globe never uses the 'near' qualifier");
  });

  it("country edition with no honest detail falls back to the classic verdict", () => {
    setPinScenario(
      { admin1: null, country: "Italy" },
      { admin1: null, country: "Italy" },
    );
    const html = renderCard("done", "country");
    const ledger = ledgerHtml(html);
    assert.ok(
      ledger.includes("Right country, wrong town!"),
      "gate failure must render the classic verdict — never silently drop",
    );
  });

  it("grade chip renders next to the verdict with score bands", () => {
    setPinScenario(null, null);
    const html = renderCard("done");
    // Miss scores 0 → the 💨 miss tier, with the band name in aria.
    assert.ok(
      html.includes('aria-label="Grade: miss"'),
      "the miss verdict carries the grade chip (Grade: miss)",
    );
  });

  it("hit verdict carries the score grade chip", () => {
    setPinScenario(null, null);
    const html = renderCard("story", "state", {
      lon: -96.7,
      lat: 41.1,
      distanceKm: 12.3,
      placeId: "worker-b-test-place",
      breakdown: {
        base: 97,
        difficulty: 2,
        diffMult: 1.25,
        streak: 1,
        combo: 1.05,
        regionBonus: 15,
        regionBonusLabel: "state",
        score: 350,
      },
      streakBefore: 0,
    });
    assert.ok(
      html.includes('aria-label="Grade: 300+"'),
      "a 350-point hit carries the 🎯 300+ grade chip",
    );
  });
});

// ---------------------------------------------------------------------------
// Miss bearing headline (P0-2, gis-review-gaps)
// ---------------------------------------------------------------------------
// The fixture miss vector runs from the drop (-96.7, 41.1) to the truth
// (-77.03, 38.9): initial bearing 91.9° → "east". The drop is in Nebraska
// (a USA play), so the headline reads miles per the unit rule (Veeresh's
// ratified decision 4): 1234.5 km ≈ 767 mi — magnitude + direction, the
// reference shape UX approved.
describe("result-card — miss bearing headline", () => {
  it("miss headline names direction: '767 mi east of your pin' (USA play → miles)", () => {
    setPinScenario(null, null);
    const html = renderCard("done");
    assert.ok(html.includes('data-testid="miss-headline"'));
    assert.ok(
      html.includes("767 mi east of your pin"),
      "the miss headline must teach direction as well as distance, in miles for a USA play",
    );
    assert.ok(
      !html.includes("767 mi off"),
      "the legacy '{distance} off' line is replaced when a bearing exists",
    );
  });

  it("hit (phase story) shows no bearing — miss-only", () => {
    setPinScenario(null, null);
    const html = renderCard("story");
    assert.ok(
      !html.includes("of your pin"),
      "the hit card must never show a bearing",
    );
    assert.ok(!html.includes('data-testid="miss-headline"'));
  });

  it("miss with no drop renders the bare 'Miss' headline", () => {
    setPinScenario(null, null);
    const html = renderCard("done", "state", null);
    assert.ok(html.includes('data-testid="miss-headline"'));
    assert.ok(
      html.includes(">Miss</p>"),
      "no drop → no distance, no bearing, just 'Miss'",
    );
  });
});
