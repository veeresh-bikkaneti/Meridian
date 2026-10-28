import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HIGH_CONTRAST,
  HIGH_CONTRAST_MARKS,
  PALETTE_STORAGE_KEY,
  STANDARD,
  STANDARD_MARKS,
  contrastRatio,
  selectPalette,
} from "./palette.ts";

const HEX = /^#[0-9a-f]{6}$/;

/** Independent WCAG 2 relative-luminance contrast. The export must match this, unrounded. */
function wcagContrast(a: string, b: string): number {
  const channel = (hex: string, start: number): number => {
    const s = parseInt(hex.slice(start, start + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string): number =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const lighter = Math.max(lum(a), lum(b));
  const darker = Math.min(lum(a), lum(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function rgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

test("PALETTE_STORAGE_KEY is the palette toggle key and this module does not touch storage", () => {
  assert.equal(PALETTE_STORAGE_KEY, "meridian.palette");
  const src = readFileSync(new URL("./palette.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /document|localStorage|fetch|window/);
});

test("STANDARD matches the live dark-theme map tokens", () => {
  assert.deepEqual(STANDARD, {
    water: "#10262e",
    land: "#3c4a3c",
    arc: "#f4f1ea",
    lake: "#1c5160",
    coast: "#0c1816",
  });
  for (const value of Object.values(STANDARD)) {
    assert.match(value, HEX);
  }
});

test("HIGH_CONTRAST exposes lowercase #rrggbb swatches", () => {
  for (const key of ["water", "land", "arc", "lake", "coast"] as const) {
    assert.match(HIGH_CONTRAST[key], HEX, key);
  }
});

test("contrastRatio is the unrounded WCAG relative-luminance ratio", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  for (const [a, b] of [
    ["#10262e", "#f4f1ea"],
    ["#0b0d10", "#f6f3ea"],
    ["#c45c12", "#0b0d10"],
    ["#c45c12", "#f6f3ea"],
  ] as const) {
    assert.equal(contrastRatio(a, b), wcagContrast(a, b));
    assert.equal(contrastRatio(b, a), contrastRatio(a, b));
  }
});

test("HIGH_CONTRAST separates water from land and keeps the arc readable on both", () => {
  const waterLand = contrastRatio(HIGH_CONTRAST.water, HIGH_CONTRAST.land);
  const arcWater = contrastRatio(HIGH_CONTRAST.arc, HIGH_CONTRAST.water);
  const arcLand = contrastRatio(HIGH_CONTRAST.arc, HIGH_CONTRAST.land);
  assert.ok(waterLand >= 9, `water/land ${waterLand}`);
  assert.ok(arcWater >= 3, `arc/water ${arcWater}`);
  assert.ok(arcLand >= 3, `arc/land ${arcLand}`);
});

test("STANDARD keeps the arc readable on both water and land", () => {
  // The 1cb6a41 commit message claims the arc "stays at least 3:1 on
  // both water and land" — the HIGH_CONTRAST case above proves it for
  // that palette; this proves the same claim for STANDARD (Council
  // manifest 2026-10-27, Councilor C challenge 5: measure, don't assume).
  const arcWater = contrastRatio(STANDARD.arc, STANDARD.water);
  const arcLand = contrastRatio(STANDARD.arc, STANDARD.land);
  assert.ok(arcWater >= 3, `arc/water ${arcWater}`);
  assert.ok(arcLand >= 3, `arc/land ${arcLand}`);
});

test("HIGH_CONTRAST does not separate water and land by blue-vs-green hue", () => {
  const water = rgb(HIGH_CONTRAST.water);
  const land = rgb(HIGH_CONTRAST.land);
  const arc = rgb(HIGH_CONTRAST.arc);
  const spread = (c: { r: number; g: number; b: number }) =>
    Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

  assert.ok(water.r <= 40 && water.g <= 40 && water.b <= 40, "water is dark");
  assert.ok(spread(water) <= 24, "water is a neutral, not a saturated blue");
  assert.ok(water.b - Math.max(water.r, water.g) <= 12, "water is not blue-dominant");

  assert.ok(land.r >= 220 && land.g >= 220 && land.b >= 200, "land is light");
  assert.ok(spread(land) <= 40, "land is a neutral");
  assert.ok(land.g - land.r <= 8, "land is not a green");
  assert.ok(!(land.g > land.r && land.g > land.b), "land is not green-dominant");

  const yellowOrange =
    arc.r >= 160 &&
    arc.g >= 40 &&
    arc.g <= 180 &&
    arc.b <= 90 &&
    arc.r - arc.g >= 40 &&
    arc.g > arc.b;
  const magenta =
    arc.r >= 140 && arc.b >= 140 && arc.g <= Math.min(arc.r, arc.b) - 40;
  assert.ok(yellowOrange || magenta, "arc is magenta or yellow-orange");
  assert.doesNotMatch(HIGH_CONTRAST.arc, /^#00/);
  assert.ok(!(arc.b > arc.r && arc.b > arc.g && arc.r < 80), "arc is not a pure blue");
});

test("selectPalette fails closed except for the exact high-contrast token", () => {
  assert.equal(selectPalette(undefined), STANDARD);
  assert.equal(selectPalette(null), STANDARD);
  assert.equal(selectPalette(""), STANDARD);
  assert.equal(selectPalette("standard"), STANDARD);
  assert.equal(selectPalette("high-contrast"), HIGH_CONTRAST);
  for (const raw of ["HIGH-CONTRAST", "High-Contrast", "high contrast", "high_contrast", "nope", 1, 0, false, true, {}, [], " standard"]) {
    assert.equal(selectPalette(raw), STANDARD, JSON.stringify(raw));
  }
});

test("HIGH_CONTRAST_MARKS exposes the exact mark key set as lowercase #rrggbb", () => {
  // Council addendum 2026-10-28 (D9): the mark tokens are the surface the
  // player must read — pin, answer, highlight, border, park, cross, lit.
  assert.deepEqual(Object.keys(HIGH_CONTRAST_MARKS).sort(), [
    "answer",
    "border",
    "cross",
    "highlight",
    "lit",
    "park",
    "pin",
  ]);
  for (const [key, value] of Object.entries(HIGH_CONTRAST_MARKS)) {
    assert.match(value, HEX, key);
  }
  assert.deepEqual(Object.keys(STANDARD_MARKS).sort(), Object.keys(HIGH_CONTRAST_MARKS).sort());
  for (const value of Object.values(STANDARD_MARKS)) {
    assert.match(value, HEX);
  }
});

test("STANDARD_MARKS equals today's dark-theme values exactly (standard path unchanged)", () => {
  assert.deepEqual(STANDARD_MARKS, {
    pin: "#f4f1ea",
    answer: "#f2c14e",
    highlight: "#f2c14e",
    border: "#24302c",
    park: "#1f4d36",
    cross: "#d7ddd9",
    lit: "#6e9084",
  });
});

test("STANDARD marks keep pin and answer readable on STANDARD land and water", () => {
  for (const mark of [STANDARD_MARKS.pin, STANDARD_MARKS.answer]) {
    assert.ok(contrastRatio(mark, STANDARD.land) >= 3, `${mark} vs STANDARD land`);
    assert.ok(contrastRatio(mark, STANDARD.water) >= 3, `${mark} vs STANDARD water`);
  }
});

test("high-contrast Class A marks clear 3:1 on HC land, water, and lake", () => {
  // Councilor C condition (a): lake is a third binding anchor, not just land/water.
  const anchors = [HIGH_CONTRAST.land, HIGH_CONTRAST.water, HIGH_CONTRAST.lake];
  for (const key of ["pin", "answer", "highlight", "cross"] as const) {
    for (const anchor of anchors) {
      const ratio = contrastRatio(HIGH_CONTRAST_MARKS[key], anchor);
      assert.ok(ratio >= 3, `${key} ${HIGH_CONTRAST_MARKS[key]} vs ${anchor}: ${ratio}`);
    }
  }
});

test("high-contrast answer and highlight are the same mark (binding identity)", () => {
  assert.equal(HIGH_CONTRAST_MARKS.answer, HIGH_CONTRAST_MARKS.highlight);
});

test("high-contrast pin, answer, arc, and cross are pairwise distinct", () => {
  const marks = [
    HIGH_CONTRAST_MARKS.pin,
    HIGH_CONTRAST_MARKS.answer,
    HIGH_CONTRAST.arc,
    HIGH_CONTRAST_MARKS.cross,
  ];
  assert.equal(new Set(marks).size, marks.length, marks.join(", "));
});

test("high-contrast marks stay readable on the lit wash, and the wash stays pale on land", () => {
  // Councilor C condition (c): the binding pins are marks-vs-lit; lit-vs-land
  // is a CEILING (a pale wash), not a floor.
  for (const mark of [HIGH_CONTRAST_MARKS.pin, HIGH_CONTRAST_MARKS.answer, HIGH_CONTRAST.arc]) {
    const ratio = contrastRatio(mark, HIGH_CONTRAST_MARKS.lit);
    assert.ok(ratio >= 3, `${mark} vs lit ${HIGH_CONTRAST_MARKS.lit}: ${ratio}`);
  }
  const wash = contrastRatio(HIGH_CONTRAST_MARKS.lit, HIGH_CONTRAST.land);
  assert.ok(wash <= 1.45, `lit vs HC land ceiling: ${wash}`);
  assert.ok(wash >= 1.0, `lit vs HC land: ${wash}`);
});

test("high-contrast border sits in the adjudicated [1.90, 2.00] band on HC land", () => {
  // Chair ceiling 2.00 ∩ Councilor C floor 1.90, both bounds, unrounded.
  const ratio = contrastRatio(HIGH_CONTRAST_MARKS.border, HIGH_CONTRAST.land);
  assert.ok(ratio >= 1.9, `border vs HC land floor: ${ratio}`);
  assert.ok(ratio <= 2.0, `border vs HC land ceiling: ${ratio}`);
});

test("high-contrast park stays a subtle wash on HC land", () => {
  const ratio = contrastRatio(HIGH_CONTRAST_MARKS.park, HIGH_CONTRAST.land);
  assert.ok(ratio >= 1.25, `park vs HC land floor: ${ratio}`);
  assert.ok(ratio <= 1.5, `park vs HC land ceiling: ${ratio}`);
});

test("high-contrast hierarchy: borders and parks stay below every Class A mark on land", () => {
  const subtle = Math.max(
    contrastRatio(HIGH_CONTRAST_MARKS.border, HIGH_CONTRAST.land),
    contrastRatio(HIGH_CONTRAST_MARKS.park, HIGH_CONTRAST.land),
  );
  const marks = Math.min(
    contrastRatio(HIGH_CONTRAST_MARKS.pin, HIGH_CONTRAST.land),
    contrastRatio(HIGH_CONTRAST_MARKS.answer, HIGH_CONTRAST.land),
    contrastRatio(HIGH_CONTRAST_MARKS.highlight, HIGH_CONTRAST.land),
    contrastRatio(HIGH_CONTRAST_MARKS.cross, HIGH_CONTRAST.land),
  );
  assert.ok(subtle < marks, `subtle ${subtle} < marks ${marks}`);
});

test("both theme river values clear 3:1 on the HC anchors (river keeps its theme values)", () => {
  // --map-river in src/styles.css: dark theme #3c8496, light/paper #5b90a6.
  // Councilor C condition (g) / adjudication: no HC override — both theme
  // values are re-measured against the HC anchors and pass, so they stay.
  for (const river of ["#3c8496", "#5b90a6"]) {
    assert.ok(contrastRatio(river, HIGH_CONTRAST.land) >= 3, `${river} vs HC land`);
    assert.ok(contrastRatio(river, HIGH_CONTRAST.water) >= 3, `${river} vs HC water`);
  }
});

test("selectPalette does not mutate STANDARD or HIGH_CONTRAST", () => {
  const standard = JSON.stringify(STANDARD);
  const high = JSON.stringify(HIGH_CONTRAST);
  selectPalette("high-contrast");
  selectPalette("standard");
  selectPalette(null);
  selectPalette({ water: "#ffffff" });
  assert.equal(JSON.stringify(STANDARD), standard);
  assert.equal(JSON.stringify(HIGH_CONTRAST), high);
});
