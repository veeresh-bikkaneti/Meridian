import { test, expect, type Page } from "playwright/test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Pair-art kid test — the GO / NO-GO gate for flipping the painted
 * Holmes & Watson re-skin live in PR D (owner-approved 2026-11-07;
 * gates of record: STUDY-format-rebuild.md, "Gates" section).
 *
 * This spec does two different jobs, and keeps them separate:
 *
 * 1. AUTOMATED MEASURES (this file, real numbers): the pair-art pose
 *    plates are composited over the REAL GeoDetective page — the real
 *    map, the real page background, a real clue layout — at the
 *    maximum in-band figure size for each width, and the spec measures
 *    the rendered figure height (must sit inside the width's band),
 *    the rendered face height (must clear the width's face floor, when
 *    the plate manifest carries a face box), and clue-text coverage
 *    (bounding-box overlap of the figure against every leaf text
 *    element inside the clue articles — must be exactly 0 px²).
 *
 * 2. ASSEMBLY + PALM MEASUREMENT (panel round 1, Game developer
 *    F4 — BLOCK cure): §7 requires palm error ≤3 px "by automated
 *    measurement" and §3.5/§10 make the palm a gate, so this spec
 *    ships the measurer. It composes each character's painted parts
 *    on a canvas per the pair-art manifest contract (placements in
 *    `rectPx`, pivots, `pxPerViewBoxUnit`), rotating the front arm
 *    about its pivot to the high-five pose (see
 *    `measureAssemblies`), measures the skin-cluster centroid of
 *    the raised hand against HIGH_FIVE_CONTACT (99,25) / (15,21),
 *    and diffs the assembly against the delivered high-five pose
 *    plate. The error is reported in viewBox units, in natural
 *    image pixels, and in rendered rig pixels — three named unit
 *    bases, never a bare "px" (the pre-cure lock's 0.35 was a
 *    viewBox-unit distance mislabelled as px). If the parts or the
 *    manifest contract are not there to measure, the test FAILs
 *    with an explicit FAIL/NOT RUN reason — it never skips
 *    silently and never passes on an assertion it did not compute.
 *
 * 3. HUMAN TRIAL PREPARATION (no fake results): find / identity /
 *    expression trials need real kid panellists (see
 *    scripts/kidtest-protocol.md). This spec must NOT fake them. It
 *    prepares the trial screens — one figure per find screen at a
 *    randomised lawful gutter spot, the tracker / Jolly distractors
 *    for identity, and expression trials that render each required
 *    feeling's face ON the figure at the cell's in-band figure size
 *    (never a big isolated face plate) for BOTH characters — and
 *    exports the trial manifest to
 *    test-results/pair-art-kidtest/trial-manifest.json.
 *    Human scores are recorded by hand in docs/pair-art/KIDTEST_RESULTS.md.
 *
 * Panel re-vote cure (Game level architect BLOCK, tip a4593c0):
 * placement is now a negative gate, not an assumption. lawfulSpots
 * judges a spot against the map, clue text, AND occupied page
 * chrome (search input + label, buttons, attribution bar, header
 * text, bench slot); a width with no lawful spot FAILS its find
 * leg with a "no lawful spot" reason instead of minting a fallback
 * spot (the pre-cure captures placed Holmes inside the map at 768
 * and over the search input at 390). Measure 3 and the find-screen
 * captures assert, after layout settles and on the final DOM
 * geometry: figure ∩ map = 0, figure ∩ chrome = 0, figure ∩ clue
 * text = 0. A pure-logic sabotage self-check (below) proves
 * deliberately unlawful spots are rejected. The assembly compositor
 * also paints the halo FIRST (rank −1, an underlay), not over the
 * legs.
 *
 * Plates live in public/assets/detective/pair-art/ (built into
 * dist/client/assets/detective/pair-art/). The art lands in parallel
 * with this harness: if a plate is absent, the affected measure SKIPs
 * with a named reason for that exact plate — a missing plate is never
 * a spurious failure, and never a fabricated pass.
 *
 * Per-cell gate (width × background; backgrounds = the game's real
 * map + page backgrounds, incl. the static degradation block):
 *   Find-Holmes ≥27/30 in ≤2 s in EVERY cell (≤25/30 in any cell = kill)
 *   Identity    ≥27/30 (≤3/30 confusion with the tracker or Jolly)
 *   Expression  ≥26/30
 *   Zero clue-text coverage at maximum in-band size
 * The human thresholds are enforced from KIDTEST_RESULTS.md at PR D;
 * the automated measures below enforce size / face / coverage here.
 */

test.setTimeout(300_000);

/* ------------------------------------------------------------------ */
/* The gate, as data                                                    */
/* ------------------------------------------------------------------ */

const WIDTHS = [390, 768, 1280, 1920] as const;
type Width = (typeof WIDTHS)[number];

/** Figure-height band + face floor per width (study, Gates section). */
const BANDS: Record<Width, { min: number; max: number; faceFloor: number; height: number }> = {
  390: { min: 112, max: 128, faceFloor: 38, height: 844 },
  768: { min: 128, max: 144, faceFloor: 44, height: 1024 },
  1280: { min: 144, max: 160, faceFloor: 48, height: 900 },
  1920: { min: 160, max: 176, faceFloor: 52, height: 1080 },
};

/** Trial backgrounds: the real map, the real page, and the static
 * degradation block (the low-memory dock-only static composite). */
const BACKGROUNDS = ["map", "page", "static-degradation"] as const;
type Background = (typeof BACKGROUNDS)[number];

const GATE = {
  findMin: 27,
  findKillAtOrBelow: 25,
  findTimeLimitMs: 2_000,
  identityMin: 27,
  identityMaxConfusion: 3,
  expressionMin: 26,
  panellistsPerCell: 30,
  /** Expression leg (panel round 1, UX researcher B1 cure): the
   * feelings every cell family must cover, per character. The bar
   * applies per (cell × character × emotion) slice, n=30 each. */
  expressionEmotions: ["delighted", "surprised", "pout"],
  expressionCharacters: ["holmes", "watson"],
  /** Sample allocation (UX researcher B2 cure): independent
   * observations per cell — a child serves in exactly ONE cell, so
   * every observation is a first exposure and the find measure is
   * naïve by construction. See scripts/kidtest-protocol.md §1/§7. */
  allocation: "independent-per-cell",
  cells: 12,
  totalPanellists: 360,
  panellistsPerAgeBandPerCell: 10,
  ageBands: ["6-8", "9-10", "11-12"],
  /** Age-band floor (UX researcher B3 cure): the cell bar's
   * proportion applied per band — ≥9/10 in EVERY band, or the cell
   * FAILs regardless of the pooled count. Written before any run;
   * §10 forbids amending bars after the test runs. */
  perBandFloorOutOf10: 9,
  /** Palm gate (§7): ≤3 px at rendered rig scale. The rig scale is
   * DETECTIVE_RIG_HEIGHT_PX (104 px rendered height) — the unit
   * basis every palm number in the assembly report names. */
  palmMaxErrorRigPx: 3,
  rigHeightPx: 104,
  /** Assembly-vs-plate sanity gate: fraction of union pixels whose
   * max channel difference exceeds 16/255. Parts are crops of the
   * plate painting, so edges/halo legitimately differ; above 0.60
   * the assembly plainly is not the plate's figure. */
  assemblyMaxDiffFraction: 0.6,
} as const;

/* ------------------------------------------------------------------ */
/* Plate discovery (source dir is the contract; the page serves dist)   */
/* ------------------------------------------------------------------ */

const PLATE_DIR = path.resolve("public/assets/detective/pair-art");
const PLATE_URL_BASE = "assets/detective/pair-art";
const MANIFEST_OUT = path.resolve("test-results/pair-art-kidtest/trial-manifest.json");

interface FaceBox {
  /** Fractions of the plate's own width/height, each in [0, 1]. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Plate {
  /** Stable id, e.g. "holmes-standing", "holmes-face-happy". */
  id: string;
  file: string;
  url: string;
  faceBox?: FaceBox;
}

/** The plates the gate needs. Anything else in the dir is ignored.
 * The art builder's delivered scheme is pose plates
 * (`holmes-pose-*`, `watson-pose-*`); a dedicated `*-standing` plate,
 * if one ever lands, wins over the pose fallback. The figure each
 * measure actually used is recorded in the trial manifest. */
const FIGURE_PLATES = ["holmes-standing", "watson-standing"] as const;
const FIGURE_FALLBACKS: Record<string, string[]> = {
  "holmes-standing": ["holmes-pose-dock", "holmes-pose-berth-think"],
  "watson-standing": ["watson-pose-station-idle", "watson-pose-read"],
};
const DISTRACTOR_PLATES = ["tracker-standing", "jolly-standing"] as const;
const EXPRESSION_PREFIX = "holmes-face-";
/** Expression trials cover BOTH characters (panel round 1, Game
 * designer nit 3): Watson reads every clue aloud, so his faces are
 * gated by the same ≥26/30 bar as Holmes's. */
const EXPRESSION_PREFIXES = ["holmes-face-", "watson-face-"] as const;

function discoverPlates(): { plates: Plate[]; missing: { id: string; reason: string }[] } {
  const missing: { id: string; reason: string }[] = [];
  if (!existsSync(PLATE_DIR)) {
    for (const id of [...FIGURE_PLATES, ...DISTRACTOR_PLATES]) {
      missing.push({ id, reason: `plate directory ${PLATE_DIR} does not exist yet` });
    }
    missing.push({
      id: `${EXPRESSION_PREFIX}*`,
      reason: `plate directory ${PLATE_DIR} does not exist yet`,
    });
    return { plates: [], missing };
  }
  /* Sorted (Senior developer nit): readdir order is filesystem-
   * dependent; an unsorted list made seed 20261107's picks differ
   * across machines. Sorting makes the seeded manifest reproducible. */
  const files = readdirSync(PLATE_DIR)
    .filter((f) => /\.(png|webp|jpe?g)$/i.test(f))
    .sort();
  let faceBoxes: Record<string, FaceBox> = {};
  const manifestPath = path.join(PLATE_DIR, "manifest.json");
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        plates?: Record<string, { faceBox?: FaceBox }>;
      };
      for (const [file, entry] of Object.entries(parsed.plates ?? {})) {
        if (entry.faceBox) faceBoxes[file] = entry.faceBox;
      }
    } catch {
      /* A malformed manifest is reported by the face measure as
       * "no face box" — never silently treated as a pass. */
      faceBoxes = {};
    }
  }
  const byId = new Map<string, Plate>();
  for (const file of files) {
    const id = file.replace(/\.(png|webp|jpe?g)$/i, "");
    byId.set(id, {
      id,
      file,
      url: `${PLATE_URL_BASE}/${file}`,
      faceBox: faceBoxes[file],
    });
  }
  const plates: Plate[] = [];
  for (const id of [...FIGURE_PLATES, ...DISTRACTOR_PLATES]) {
    const plate =
      byId.get(id) ?? (FIGURE_FALLBACKS[id] ?? []).map((f) => byId.get(f)).find(Boolean);
    if (plate) plates.push(plate);
    else missing.push({ id, reason: `no ${id}.(png|webp|jpg) in ${PLATE_DIR}` });
  }
  const faces = [...byId.values()].filter((p) =>
    EXPRESSION_PREFIXES.some((prefix) => p.id.startsWith(prefix)),
  );
  plates.push(...faces);
  for (const prefix of EXPRESSION_PREFIXES) {
    if (!faces.some((p) => p.id.startsWith(prefix))) {
      missing.push({
        id: `${prefix}*`,
        reason: `no ${prefix}<feeling>.(png|webp|jpg) face plates in ${PLATE_DIR}`,
      });
    }
  }
  return { plates, missing };
}

const { plates, missing: MISSING_PLATES } = discoverPlates();
const plateById = (id: string) => plates.find((p) => p.id === id);
/** Resolve a canonical figure ("holmes-standing") to the plate the
 * art actually delivered (a `*-standing` plate, else its pose fallback). */
const figureFor = (canonical: string): Plate | undefined =>
  plateById(canonical) ??
  (FIGURE_FALLBACKS[canonical] ?? []).map((f) => plateById(f)).find(Boolean);
const missingReason = (id: string) =>
  MISSING_PLATES.find((m) => m.id === id)?.reason ?? `plate ${id} not discovered`;

/* ------------------------------------------------------------------ */
/* Seeded RNG — trial layouts are random per panellist but reproducible */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TRIAL_SEED = 20_261_107;

/** Fisher–Yates shuffle driven by the seeded RNG (Senior developer
 * nit: the identity choices previously used `sort(() => rng() - 0.5)`,
 * which is a biased shuffle whose result also depends on the
 * engine's sort implementation — neither reproducible nor uniform). */
function fisherYates<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page helpers                                                         */
/* ------------------------------------------------------------------ */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Open a real GeoDetective case: real map, real page, real clues. */
async function openRealCase(page: Page, index = 0) {
  await page.goto(`http://127.0.0.1:4123/Meridian/?loop-puzzle=${index}`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1:/ })).toBeVisible({
    timeout: 30_000,
  });
}

/** One piece of occupied page chrome the figure may never cover:
 * the search input + its label, any button, the map attribution bar,
 * header text, or the detective bench slot (panel re-vote cure,
 * Game level architect BLOCK: the pre-cure harness excluded only the
 * map rect, so find captures placed Holmes INSIDE the map at 768 and
 * over the search input at 390 while every assertion stayed green). */
interface ChromeRect {
  kind: "search" | "button" | "attribution" | "header" | "bench" | "text";
  label: string;
  rect: Rect;
}

interface PageLayout {
  clueText: Rect[];
  map: Rect | null;
  chrome: ChromeRect[];
  /** The placed kidtest plate's rect, when one is on the page. */
  figure: Rect | null;
}

/** Leaf text rects inside the clue articles, the map rect, every
 * occupied-chrome rect, and the placed plate's rect — all read in
 * ONE page evaluation, so a placement assertion and the screenshot
 * that follows it judge the same settled geometry. */
async function layoutRects(page: Page): Promise<PageLayout> {
  return page.evaluate(() => {
    const toRect = (r: DOMRect): Rect => ({ x: r.x, y: r.y, w: r.width, h: r.height });
    const visible = (el: Element): DOMRect | null => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const anyEl = el as Element & { checkVisibility?: () => boolean };
      if (typeof anyEl.checkVisibility === "function" && !anyEl.checkVisibility()) return null;
      return r;
    };
    const clueText: Rect[] = [];
    document
      .querySelectorAll('article[aria-label^="Clue"], [role="article"]')
      .forEach((article) => {
        article.querySelectorAll("*").forEach((el) => {
          if (el.children.length === 0 && (el.textContent ?? "").trim().length > 0) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) clueText.push(toRect(r));
          }
        });
      });
    const mapEl = document.querySelector('[data-testid="loop-map"]');
    const chrome: ChromeRect[] = [];
    const push = (kind: ChromeRect["kind"], el: Element) => {
      const r = visible(el);
      if (!r) return;
      const label =
        el.getAttribute("aria-label") ??
        el.getAttribute("data-testid") ??
        (el.textContent ?? "").trim().slice(0, 40) ??
        el.tagName;
      chrome.push({ kind, label: `${kind}:${label}`, rect: toRect(r) });
    };
    /* Search chrome: the guess-input container (label + input +
     * suggestion list live inside it), plus the input and its label
     * individually so a failure names the exact element. */
    document.querySelectorAll('[data-testid="loop-guess-input"]').forEach((el) => push("search", el));
    document.querySelectorAll('[data-testid="loop-guess-input"] input, [data-testid="loop-guess-input"] label').forEach((el) => push("search", el));
    /* Every visible button on the page (header controls, sound
     * toggles, guess controls, bench controls included). */
    document.querySelectorAll("button").forEach((el) => push("button", el));
    /* MapLibre attribution + control bars. */
    document
      .querySelectorAll(".maplibregl-ctrl-attrib, .maplibregl-ctrl-group, .maplibregl-ctrl")
      .forEach((el) => push("attribution", el));
    /* Header text: the header element's leaf text, plus headings
     * anywhere outside the clue articles. */
    document.querySelectorAll("header").forEach((header) => {
      header.querySelectorAll("*").forEach((el) => {
        if (el.children.length === 0 && (el.textContent ?? "").trim().length > 0) push("header", el);
      });
    });
    document.querySelectorAll("h1, h2").forEach((el) => {
      if (!el.closest('article[aria-label^="Clue"], [role="article"]')) push("header", el);
    });
    /* Occupied page flow, generally (root-cause wording of the
     * BLOCK: lawful spots must exclude "other occupied page flow",
     * not only the named widgets): EVERY visible leaf text element
     * outside the map and outside the clue articles is a blocker —
     * status lines ("This case is from All cases.", "Guess 1 of 5"),
     * instructions, the pair's speech text, footnotes. A figure
     * standing on any readable text is the defect class being
     * cured; the first cured run's find-768 capture proved the
     * named-widget list alone misses exactly these lines (Holmes
     * covered both status lines while every named-chrome overlap
     * measured 0). Clue-article text is already collected as
     * clueText, and map-internal text is covered by the map rect. */
    document.querySelectorAll("body *").forEach((el) => {
      if (el.children.length > 0) return;
      if ((el.textContent ?? "").trim().length === 0) return;
      if (el.closest('[data-testid="loop-map"]')) return;
      if (el.closest('article[aria-label^="Clue"], [role="article"]')) return;
      if (el.id === "kidtest-plate") return;
      const r = visible(el);
      if (r && r.width >= 4 && r.height >= 4) {
        chrome.push({
          kind: "text",
          label: `text:${(el.textContent ?? "").trim().slice(0, 40)}`,
          rect: toRect(r),
        });
      }
    });
    /* The detective bench slot — occupied page flow the pre-cure
     * lawfulSpots never knew about. */
    document
      .querySelectorAll('[data-testid="detective-bench"], [data-testid="detective-bench-board"]')
      .forEach((el) => push("bench", el));
    const plate = document.getElementById("kidtest-plate");
    return {
      clueText,
      map: mapEl ? toRect(mapEl.getBoundingClientRect()) : null,
      chrome,
      figure: plate ? toRect(plate.getBoundingClientRect()) : null,
    };
  });
}

/** Read layoutRects until the geometry stops moving. Opening a
 * case auto-scrolls the page (and the bench pair settles), so a
 * layout read taken the moment the first clue appears is NOT the
 * geometry a capture will show: in the first cured run, spots
 * minted against that early read failed at settle time with the
 * map / search chrome shifted under the fixed plate (measured:
 * figure ∩ map 12,251 px² @768 find screen). Minting and measuring
 * both start from a settled layout: poll until the map rect is
 * identical across three consecutive reads, ~200 ms apart. */
async function settledLayout(page: Page): Promise<PageLayout> {
  let last = await layoutRects(page);
  let prevKey = JSON.stringify(last.map);
  let stableReads = 0;
  for (let i = 0; i < 25 && stableReads < 2; i++) {
    await page.waitForTimeout(200);
    const cur = await layoutRects(page);
    const key = JSON.stringify(cur.map);
    stableReads = key === prevKey ? stableReads + 1 : 0;
    prevKey = key;
    last = cur;
  }
  return last;
}

interface Spot {
  id: string;
  x: number;
  y: number;
}

/** Everything a figure rect may not touch: the map, clue text, and
 * occupied page chrome (search, buttons, attribution, header, bench). */
interface SpotBlockers {
  map: Rect | null;
  clueText: Rect[];
  chrome: ChromeRect[];
}

/** Is a `figW × figH` figure at (x, y) lawful? Lawful means: fully
 * inside the viewport AND intersecting NONE of the blockers — not
 * the map, not clue text, not search chrome, not a button, not the
 * attribution bar, not header text, not the bench slot. (Panel
 * re-vote cure: the pre-cure definition excluded only the map rect
 * at minting time and then minted `page-top-left` as a fallback —
 * which is how Holmes came to stand inside the map at 768 and over
 * the search input at 390.) */
function isLawfulSpot(
  x: number,
  y: number,
  figW: number,
  figH: number,
  blockers: SpotBlockers,
  vw: number,
  vh: number,
): boolean {
  if (x < 0 || y < 0 || x + figW > vw || y + figH > vh) return false;
  const fig: Rect = { x, y, w: figW, h: figH };
  if (blockers.map && overlapArea(fig, blockers.map) > 0) return false;
  if (blockers.clueText.some((t) => overlapArea(fig, t) > 0)) return false;
  if (blockers.chrome.some((c) => overlapArea(fig, c.rect) > 0)) return false;
  return true;
}

/**
 * Lawful spots for a figure of `figW × figH`, judged against the
 * blockers the page actually presents. The named gutter spots are
 * tried first (beside / above / below the map — staging law: figures
 * live in page space); if none is lawful, a coarse viewport scan
 * looks for ANY lawful position. If none exists, this returns an
 * EMPTY list — it never mints an unlawful spot. Callers must treat
 * empty as a hard "no lawful spot" failure for that width.
 */
function lawfulSpots(
  figW: number,
  figH: number,
  blockers: SpotBlockers,
  vw: number,
  vh: number,
): Spot[] {
  const { map } = blockers;
  const candidates: Spot[] = [];
  if (map) {
    if (map.x - 16 >= figW) {
      candidates.push({ id: "gutter-left-top", x: 8, y: Math.max(8, map.y) });
      candidates.push({ id: "gutter-left-bottom", x: 8, y: map.y + map.h - figH });
    }
    if (vw - (map.x + map.w) - 16 >= figW) {
      candidates.push({ id: "gutter-right-top", x: vw - 8 - figW, y: Math.max(8, map.y) });
      candidates.push({ id: "gutter-right-bottom", x: vw - 8 - figW, y: map.y + map.h - figH });
    }
    if (map.y - 16 >= figH) candidates.push({ id: "page-above-map", x: 8, y: map.y - 8 - figH });
    if (vh - (map.y + map.h) - 16 >= figH)
      candidates.push({ id: "page-below-map", x: 8, y: map.y + map.h + 8 });
  }
  const lawful = candidates.filter((s) =>
    isLawfulSpot(s.x, s.y, figW, figH, blockers, vw, vh),
  );
  if (lawful.length > 0) return lawful;
  /* No named spot is lawful: scan the viewport on an 8 px grid for
   * the first position that clears every blocker. One scan spot is
   * enough to prove a lawful placement exists at this width. */
  for (let y = 0; y + figH <= vh; y += 8) {
    for (let x = 0; x + figW <= vw; x += 8) {
      if (isLawfulSpot(x, y, figW, figH, blockers, vw, vh)) {
        return [{ id: `scan-x${x}-y${y}`, x, y }];
      }
    }
  }
  return [];
}

/* Sabotage self-check (owner test-design law: negative gates carry
 * a sabotage control). Pure logic — no browser — so it runs in
 * every project invocation and cannot be lost to page flake. It
 * proves the cured lawfulSpots REJECTS deliberately unlawful spots
 * instead of minting them: the pre-cure harness, given the second
 * layout below, minted `page-top-left` (8,8) inside the search
 * chrome and called it lawful. */
test("lawfulSpots sabotage self-check — deliberately unlawful spots are rejected, never minted", () => {
  const figW = 80;
  const figH = 128;
  /* Case 1: every returned spot must clear map + clue text + chrome. */
  const blockers: SpotBlockers = {
    map: { x: 0, y: 300, w: 390, h: 300 },
    clueText: [{ x: 16, y: 640, w: 358, h: 20 }],
    chrome: [{ kind: "search", label: "search:Search the map", rect: { x: 0, y: 230, w: 390, h: 60 } }],
  };
  const spots = lawfulSpots(figW, figH, blockers, 390, 844);
  expect(spots.length, "sabotage case 1: the open band above the search chrome is lawful").toBeGreaterThan(0);
  for (const s of spots) {
    const fig: Rect = { x: s.x, y: s.y, w: figW, h: figH };
    expect(overlapArea(fig, blockers.map!), `spot ${s.id} must not touch the map`).toBe(0);
    expect(
      blockers.clueText.reduce((sum, t) => sum + overlapArea(fig, t), 0),
      `spot ${s.id} must not touch clue text`,
    ).toBe(0);
    expect(
      blockers.chrome.reduce((sum, c) => sum + overlapArea(fig, c.rect), 0),
      `spot ${s.id} must not touch chrome`,
    ).toBe(0);
  }
  /* Case 2: search chrome fills the whole band above the map and the
   * remaining gap is shorter than the figure — NO lawful spot exists,
   * and the function must say so (empty), never fall back to (8,8). */
  const squeezed: SpotBlockers = {
    map: { x: 0, y: 400, w: 390, h: 444 },
    clueText: [],
    chrome: [{ kind: "search", label: "search:Search the map", rect: { x: 0, y: 0, w: 390, h: 280 } }],
  };
  expect(
    lawfulSpots(figW, figH, squeezed, 390, 844),
    "sabotage case 2: a width with no lawful spot must return [], not a minted fallback",
  ).toEqual([]);
  /* Case 3: the map covers the whole viewport — trivially unlawful
   * everywhere; still []. */
  expect(
    lawfulSpots(figW, figH, { map: { x: 0, y: 0, w: 390, h: 844 }, clueText: [], chrome: [] }, 390, 844),
    "sabotage case 3: full-viewport map must return []",
  ).toEqual([]);
});

/** Composite one plate onto the live page at a spot; return its rect. */
async function placePlate(
  page: Page,
  plate: Plate,
  spot: Spot,
  heightPx: number,
): Promise<Rect> {
  return page.evaluate(
    ({ url, spotId, x, y, h }) => {
      document.getElementById("kidtest-plate")?.remove();
      const img = document.createElement("img");
      img.id = "kidtest-plate";
      img.dataset.spot = spotId;
      img.src = url;
      img.alt = "";
      Object.assign(img.style, {
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        height: `${h}px`,
        width: "auto",
        zIndex: "9999",
        pointerEvents: "none",
      });
      document.body.appendChild(img);
      return new Promise<Rect>((resolve, reject) => {
        const done = () => {
          const r = img.getBoundingClientRect();
          resolve({ x: r.x, y: r.y, w: r.width, h: r.height });
        };
        if (img.complete && img.naturalHeight > 0) done();
        else {
          img.onload = done;
          img.onerror = () => reject(new Error(`plate failed to load: ${url}`));
        }
      });
    },
    { url: plate.url, spotId: spot.id, x: spot.x, y: spot.y, h: heightPx },
  );
}

/* ------------------------------------------------------------------ */
/* 1. Automated measures — per width, over the real game page           */
/* ------------------------------------------------------------------ */

for (const width of WIDTHS) {
  const band = BANDS[width];
  test(`automated measures @${width} — size band, face floor, zero clue-text coverage`, async ({
    browser,
  }) => {
    const figures = FIGURE_PLATES.map((id) => figureFor(id)).filter(
      (p): p is Plate => p !== undefined,
    );
    test.skip(
      figures.length === 0,
      `NOT RUN: no figure plates yet — ${FIGURE_PLATES.map(missingReason).join("; ")}`,
    );

    const context = await browser.newContext({
      viewport: { width, height: band.height },
    });
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    try {
      await openRealCase(page);
      const layout = await settledLayout(page);
      const { clueText } = layout;
      expect(clueText.length, "real clue layout must expose clue text rects").toBeGreaterThan(0);

      for (const plate of figures) {
        /* Render at MAXIMUM in-band size — the coverage gate is
         * specified at the largest figure the band allows. */
        const probe = await placePlate(page, plate, { id: "probe", x: 8, y: 8 }, band.max);
        const figW = Math.round(probe.w);

        /* Measure 1 — figure height inside the band.
         * Honest scope note (Game developer nit 1): placePlate SETS
         * the height to band.max, so asserting the rendered height
         * is in-band on its own is near-tautological — it proves the
         * CSS was honoured, nothing about the plate. What CAN catch
         * a wrong plate is the plate's own geometry, asserted below:
         * (a) the rendered aspect ratio must equal the plate's
         * NATURAL aspect ratio (a distorted or wrong-crop plate
         * fails), and (b) the natural height must be at least the
         * band max, so the plate holds up at the largest in-band
         * render without being upscaled (§8.3 source-resolution
         * rule). The in-band assertions stay, labelled as the
         * CSS-honour check they are. */
        expect(
          probe.h,
          `${plate.id} rendered height ${probe.h}px must be in [${band.min}, ${band.max}] @${width}`,
        ).toBeGreaterThanOrEqual(band.min);
        expect(probe.h).toBeLessThanOrEqual(band.max + 1); // +1: sub-pixel rounding
        const natural = await page.evaluate(async (url: string) => {
          const img = new Image();
          img.src = url;
          await img.decode();
          return { w: img.naturalWidth, h: img.naturalHeight };
        }, plate.url);
        const naturalAspect = natural.w / natural.h;
        const renderedAspect = probe.w / probe.h;
        expect(
          Math.abs(renderedAspect - naturalAspect) / naturalAspect,
          `${plate.id} @${width}: rendered aspect ${renderedAspect.toFixed(3)} must match natural aspect ${naturalAspect.toFixed(3)} (${natural.w}×${natural.h}) within 2%`,
        ).toBeLessThanOrEqual(0.02);
        expect(
          natural.h,
          `${plate.id} natural height ${natural.h}px must be ≥ band max ${band.max}px @${width} (no upscaling at in-band sizes)`,
        ).toBeGreaterThanOrEqual(band.max);

        /* Measure 2 — face height clears the floor. Needs the plate
         * manifest's face box; without one this measure is NOT RUN
         * for that plate — recorded, never assumed.
         * SOFT assert (owner rule 15 cure, 2026-11-08): a hard expect
         * here fail-fasted the whole width test on Holmes's recorded
         * face-floor shortfall, so Watson's size/face legs and the
         * Measure 3 coverage loop NEVER EXECUTED — an unmeasured law
         * (zero clue-text coverage is product law) cannot go to the
         * panel as "not reached" when a harness property causes it.
         * expect.soft asserts the SAME floor with the SAME numbers
         * and still FAILS this test at the end; it only lets every
         * remaining leg of the test run first. Nothing is weakened. */
        if (plate.faceBox) {
          const facePx = Math.round(plate.faceBox.h * probe.h);
          expect
            .soft(
              facePx,
              `${plate.id} face ${facePx}px must clear the ${band.faceFloor}px floor @${width}`,
            )
            .toBeGreaterThanOrEqual(band.faceFloor);
        } else {
          test.info().annotations.push({
            type: "not-run",
            description: `face floor NOT RUN for ${plate.id} @${width}: no faceBox for ${plate.file} in pair-art manifest.json`,
          });
        }

        /* Measure 3 — zero coverage at max in-band size, at every
         * lawful spot this width offers. Coverage now means THREE
         * negative gates, all measured AFTER the layout settles,
         * against the final DOM geometry the screenshot would show
         * (panel re-vote cure — the pre-cure measure asserted only
         * clue-text overlap, against rects read at spot-minting
         * time, so a figure standing inside the map or over the
         * search input passed):
         *   figure ∩ map    = 0 px²
         *   figure ∩ chrome = 0 px² (search input + label, buttons,
         *                     attribution bar, header text, bench)
         *   figure ∩ clue text = 0 px² (the original product law)
         * And lawfulSpots itself now excludes all three classes: a
         * width with no lawful spot FAILS here with that reason —
         * no spot is ever minted into occupied flow. */
        const spots = lawfulSpots(figW, band.max, layout, width, band.height);
        expect(
          spots.length,
          `${plate.id} @${width}: no lawful spot — every figure placement at max in-band size intersects the map, clue text, or page chrome (search/buttons/attribution/header/bench); the find leg cannot be staged lawfully at this width`,
        ).toBeGreaterThan(0);
        for (const spot of spots) {
          await placePlate(page, plate, spot, band.max);
          /* Settle, then read figure + blockers in one snapshot —
           * the same geometry a capture taken now would show. */
          await page.waitForTimeout(250);
          const snap = await layoutRects(page);
          expect(snap.figure, `${plate.id} @${width} spot ${spot.id}: placed plate must be measurable`).not.toBeNull();
          const rect = snap.figure!;
          if (snap.map) {
            const mapOverlap = overlapArea(rect, snap.map);
            expect(
              mapOverlap,
              `${plate.id} @${width} spot ${spot.id}: figure ∩ map must be 0 px², measured ${mapOverlap} px²`,
            ).toBe(0);
          }
          for (const c of snap.chrome) {
            const chromeOverlap = overlapArea(rect, c.rect);
            expect(
              chromeOverlap,
              `${plate.id} @${width} spot ${spot.id}: figure ∩ chrome (${c.label}) must be 0 px², measured ${chromeOverlap} px²`,
            ).toBe(0);
          }
          const covered = snap.clueText.reduce((sum, t) => sum + overlapArea(rect, t), 0);
          expect(
            covered,
            `${plate.id} @${width} spot ${spot.id}: clue-text coverage must be 0 px², measured ${covered} px²`,
          ).toBe(0);
        }
      }
    } finally {
      await context.close();
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2. Assembly + palm measurement — the doll PR B will move, measured   */
/* ------------------------------------------------------------------ */

/** HIGH_FIVE_CONTACT (§3.5), in viewBox units. */
const HIGH_FIVE_CONTACT: Record<string, { x: number; y: number }> = {
  holmes: { x: 99, y: 25 },
  watson: { x: 15, y: 21 },
};
/** Each front arm's palm in the BASE pose (§3.3/§3.4: Holmes hand
 * circle at (87,83); Watson hand at (26,89)). The high-five pose in
 * HOLMES_POSE_SPECS / WATSON_POSE_SPECS carries frontArm 0 because
 * the flat rig draws that arm explicitly; for painted parts the
 * equivalent assembly is the pivot rotation that carries the base
 * palm onto the contact anchor — computed from these anchors, never
 * hard-coded as an angle. */
const BASE_PALM_VB: Record<string, { x: number; y: number }> = {
  holmes: { x: 87, y: 83 },
  watson: { x: 26, y: 89 },
};

interface ContractPart {
  part: string;
  file: string;
  rectPx: { x: number; y: number; width: number; height: number };
}
interface CharacterContract {
  viewBox: [number, number];
  naturalSizePx: [number, number];
  figureOfRecord?: string;
  pivots: Record<string, { viewBox: [number, number]; px: [number, number] }>;
  palmAnchor: { viewBox: [number, number]; px: [number, number] };
  parts: ContractPart[];
  faces: Record<
    string,
    { file: string; faceBox: { x: number; y: number; width: number; height: number } }
  >;
}
interface PairArtContract {
  pxPerViewBoxUnit: number;
  characters: Record<string, CharacterContract>;
}

const PAIR_MANIFEST_PATH = path.join(PLATE_DIR, "manifest.json");
function loadPairArtContract(): { contract: PairArtContract | null; reason: string } {
  if (!existsSync(PAIR_MANIFEST_PATH)) {
    return { contract: null, reason: `no pair-art manifest.json at ${PAIR_MANIFEST_PATH}` };
  }
  try {
    const parsed = JSON.parse(readFileSync(PAIR_MANIFEST_PATH, "utf8")) as PairArtContract;
    for (const id of ["holmes", "watson"]) {
      const c = parsed.characters?.[id];
      if (!c) return { contract: null, reason: `manifest contract has no characters.${id}` };
      if (!Array.isArray(c.parts) || c.parts.length === 0)
        return { contract: null, reason: `manifest contract characters.${id}.parts is empty` };
      if (!c.pivots?.frontArm)
        return { contract: null, reason: `manifest contract characters.${id}.pivots.frontArm missing` };
      for (const p of c.parts) {
        if (!existsSync(path.join(PLATE_DIR, p.file)))
          return { contract: null, reason: `manifest part file missing on disk: ${p.file}` };
      }
    }
    return { contract: parsed, reason: "" };
  } catch (e) {
    return { contract: null, reason: `pair-art manifest.json unreadable: ${String(e)}` };
  }
}

/** Filled by the assembly test, embedded in the trial manifest. */
let ASSEMBLY_REPORT: unknown = null;

interface AssemblyCharInput {
  id: string;
  natural: [number, number];
  viewBox: [number, number];
  pxPerUnit: number;
  parts: { part: string; url: string; rect: ContractPart["rectPx"]; raised: boolean }[];
  pivotPx: [number, number];
  rotationDeg: number;
  contactNatural: [number, number];
  face: { url: string; box: { x: number; y: number; width: number; height: number } } | null;
  plateUrl: string | null;
  plateFile: string | null;
}

/**
 * Compose + measure ONE character in the page (canvas decode is the
 * shipped PNG path — no second decoder to drift from the browser's).
 * Self-contained for page.evaluate: every input arrives in `input`.
 */
async function measureOneAssembly(input: AssemblyCharInput) {
  const load = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`image failed to load: ${url}`));
      img.src = url;
    });
  const isSkin = (r: number, g: number, b: number, a: number) =>
    a > 128 && r > 180 && g >= 120 && g < 225 && b >= 70 && b < 190 && r > g && g > b && r - b > 40;
  /* Halo-first underlay (panel re-vote cure, Frontend developer
   * nit): the halo is the figure's ground glow — it must paint
   * BEFORE (under) every body part. The pre-cure rank gave halo
   * and legs both rank 0, so manifest order painted the halo OVER
   * the legs. Halo is rank −1: strictly first. */
  const rank = (part: string) =>
    part === "halo"
      ? -1
      : part === "hat"
        ? 5
        : part === "head"
          ? 4
          : part.includes("arm-front") || part.includes("raised") || part.includes("high-five")
            ? 3
            : part === "torso"
              ? 2
              : part === "arm-back"
                ? 1
                : 0;
  const [W, H] = input.natural;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const ordered = input.parts
    .map((p, i) => ({ ...p, i, r: rank(p.part) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  let faceDrawn = false;
  const drawFace = async () => {
    if (!input.face || faceDrawn) return;
    const fimg = await load(input.face.url);
    ctx.drawImage(fimg, input.face.box.x, input.face.box.y, input.face.box.width, input.face.box.height);
    faceDrawn = true;
  };
  for (const p of ordered) {
    if (p.r >= 5) await drawFace(); // face sits on the head, under the hat
    const img = await load(p.url);
    if (p.raised || (input.rotationDeg !== 0 && rank(p.part) === 3)) {
      if (p.raised) {
        /* A dedicated raised-arm part is drawn explicitly at its
         * manifest placement — the painted equivalent of the rig's
         * explicitly drawn high-five arm. */
        ctx.drawImage(img, p.rect.x, p.rect.y, p.rect.width, p.rect.height);
      } else {
        ctx.save();
        ctx.translate(input.pivotPx[0], input.pivotPx[1]);
        ctx.rotate((input.rotationDeg * Math.PI) / 180);
        ctx.drawImage(img, p.rect.x - input.pivotPx[0], p.rect.y - input.pivotPx[1], p.rect.width, p.rect.height);
        ctx.restore();
      }
    } else {
      ctx.drawImage(img, p.rect.x, p.rect.y, p.rect.width, p.rect.height);
    }
  }
  await drawFace();

  /* Palm: connected skin clusters; the raised hand is the cluster
   * of ≥40 natural px whose centroid lies within 30 viewBox units
   * of the contact anchor. The head's skin cluster is excluded by
   * that window — its centroid sits far from the anchor. */
  const data = ctx.getImageData(0, 0, W, H).data;
  const skinAt = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return isSkin(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!);
  };
  const visited = new Uint8Array(W * H);
  const windowNatural = 30 * input.pxPerUnit;
  let palm: { centroidNatural: [number, number]; clusterPx: number } | null = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (visited[y * W + x] || !skinAt(x, y)) continue;
      const queue: [number, number][] = [[x, y]];
      visited[y * W + x] = 1;
      let n = 0;
      let sx = 0;
      let sy = 0;
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        n++;
        sx += cx;
        sy += cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || visited[ny * W + nx]) continue;
          visited[ny * W + nx] = 1;
          if (skinAt(nx, ny)) queue.push([nx, ny]);
        }
      }
      if (n >= 40) {
        const cx = sx / n;
        const cy = sy / n;
        const dist = Math.hypot(cx - input.contactNatural[0], cy - input.contactNatural[1]);
        if (dist <= windowNatural && (!palm || dist < Math.hypot(palm.centroidNatural[0] - input.contactNatural[0], palm.centroidNatural[1] - input.contactNatural[1]))) {
          palm = { centroidNatural: [cx, cy], clusterPx: n };
        }
      }
    }
  }

  /* Assembly-vs-plate pixel diff (the plate this assembly claims
   * to be). Summary only here; the gate lives in the test body. */
  let diff: { plate: string; differingFraction: number; meanAbsDiff: number; unionPx: number } | null = null;
  if (input.plateUrl) {
    const plate = await load(input.plateUrl);
    const pc = document.createElement("canvas");
    pc.width = W;
    pc.height = H;
    const pctx = pc.getContext("2d", { willReadFrequently: true })!;
    pctx.drawImage(plate, 0, 0, W, H);
    const pd = pctx.getImageData(0, 0, W, H).data;
    let union = 0;
    let differing = 0;
    let absSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 16 || pd[i + 3]! > 16) union++;
      const m = Math.max(
        Math.abs(data[i]! - pd[i]!),
        Math.abs(data[i + 1]! - pd[i + 1]!),
        Math.abs(data[i + 2]! - pd[i + 2]!),
        Math.abs(data[i + 3]! - pd[i + 3]!),
      );
      if (m > 16) differing++;
      absSum += (Math.abs(data[i]! - pd[i]!) + Math.abs(data[i + 1]! - pd[i + 1]!) + Math.abs(data[i + 2]! - pd[i + 2]!) + Math.abs(data[i + 3]! - pd[i + 3]!)) / 4;
    }
    diff = {
      plate: input.plateFile ?? input.plateUrl,
      differingFraction: union > 0 ? differing / union : 1,
      meanAbsDiff: absSum / (W * H),
      unionPx: union,
    };
  }
  return { palm, diff };
}

test("assembly + palm measurement — parts compose at the high-five pose; palm error ≤3 rig px", async ({
  browser,
}) => {
  const { contract, reason } = loadPairArtContract();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4123/Meridian/");
    if (!contract) {
      /* Record the explicit failure where the trial manifest will
       * carry it — "assembly": null would read as "not attempted".
       * Written to disk as well as memory: the prep test reads the
       * file, so the handoff does not depend on module state
       * surviving between tests in the runner. */
      ASSEMBLY_REPORT = {
        status: "FAIL/NOT RUN",
        recordedAt: new Date().toISOString(),
        reason,
        note: "No palm number exists until the manifest contract and its part files are present; see the assembly test failure in this run.",
      };
      mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
      writeFileSync(
        path.resolve("test-results/pair-art-kidtest/assembly-report.json"),
        JSON.stringify(ASSEMBLY_REPORT, null, 2),
      );
    }
    expect(
      contract,
      `FAIL/NOT RUN — assembly + palm measurement could not run: ${reason}. ` +
        "This is an explicit failure, never a silent skip: §7 requires the palm " +
        "measured by shipped code against the manifest contract.",
    ).not.toBeNull();
    const c = contract!;
    const report: Record<string, unknown> = {
      generatedBy: "tests/e2e/pair-art-kidtest.spec.ts (assembly + palm measurement)",
      recordedAt: new Date().toISOString(),
      unitBasis:
        "errorViewBoxUnits = centroid-to-anchor distance in viewBox units; " +
        "errorNaturalPx = errorViewBoxUnits × manifest pxPerViewBoxUnit (natural image pixels); " +
        `errorRigPx = errorViewBoxUnits × (rigHeightPx ${GATE.rigHeightPx} / viewBox height) — rendered pixels at the shipped rig height, the §7 gate basis. ` +
        "The pre-cure lock's '0.35 px' was a viewBox-unit distance (√(0.25²+0.25²)) mislabelled as px.",
      gateRigPx: GATE.palmMaxErrorRigPx,
      characters: {} as Record<string, unknown>,
    };
    const chars: Record<string, unknown> = {};
    for (const id of ["holmes", "watson"] as const) {
      const ch = c.characters[id]!;
      const contact = HIGH_FIVE_CONTACT[id]!;
      const base = BASE_PALM_VB[id]!;
      const pivotVb = ch.pivots.frontArm!.viewBox;
      const v1 = { x: base.x - pivotVb[0], y: base.y - pivotVb[1] };
      const v2 = { x: contact.x - pivotVb[0], y: contact.y - pivotVb[1] };
      const rotationDeg =
        (Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y) * 180) / Math.PI;
      const raisedPart = ch.parts.find((p) => /high-five|highfive|raised/.test(p.part));
      const url = (file: string) => `${PLATE_URL_BASE}/${file}`;
      const mkInput = (
        rotation: number,
        faceKind: string,
        plateFile: string | null,
      ): AssemblyCharInput => ({
        id,
        natural: ch.naturalSizePx,
        viewBox: ch.viewBox,
        pxPerUnit: c.pxPerViewBoxUnit,
        parts: ch.parts
          .filter((p) => !(raisedPart && p.part === "arm-front"))
          .map((p) => ({
            part: p.part,
            url: url(p.file),
            rect: p.rectPx,
            raised: p === raisedPart,
          })),
        pivotPx: ch.pivots.frontArm!.px,
        rotationDeg: raisedPart ? 0 : rotation,
        contactNatural: [contact.x * c.pxPerViewBoxUnit, contact.y * c.pxPerViewBoxUnit],
        face: ch.faces[faceKind]
          ? { url: url(ch.faces[faceKind]!.file), box: ch.faces[faceKind]!.faceBox }
          : null,
        plateUrl: plateFile && existsSync(path.join(PLATE_DIR, plateFile)) ? url(plateFile) : null,
        plateFile,
      });
      const hfPlate = `${id}-pose-high-five.png`;
      const hf = await page.evaluate(
        measureOneAssembly,
        mkInput(rotationDeg, "delighted", hfPlate),
      );
      const basePlate = ch.figureOfRecord ?? null;
      const baseAsm = await page.evaluate(measureOneAssembly, mkInput(0, "neutral", basePlate));
      const rigScale = GATE.rigHeightPx / ch.viewBox[1];
      const palm = hf.palm
        ? {
            status: "measured",
            clusterPx: hf.palm.clusterPx,
            centroidViewBox: [
              hf.palm.centroidNatural[0] / c.pxPerViewBoxUnit,
              hf.palm.centroidNatural[1] / c.pxPerViewBoxUnit,
            ],
            contactViewBox: [contact.x, contact.y],
            errorViewBoxUnits:
              Math.hypot(
                hf.palm.centroidNatural[0] - contact.x * c.pxPerViewBoxUnit,
                hf.palm.centroidNatural[1] - contact.y * c.pxPerViewBoxUnit,
              ) / c.pxPerViewBoxUnit,
            errorNaturalPx: Math.hypot(
              hf.palm.centroidNatural[0] - contact.x * c.pxPerViewBoxUnit,
              hf.palm.centroidNatural[1] - contact.y * c.pxPerViewBoxUnit,
            ),
            errorRigPx:
              (Math.hypot(
                hf.palm.centroidNatural[0] - contact.x * c.pxPerViewBoxUnit,
                hf.palm.centroidNatural[1] - contact.y * c.pxPerViewBoxUnit,
              ) /
                c.pxPerViewBoxUnit) *
              rigScale,
          }
        : {
            status: "FAIL/NOT RUN",
            reason:
              `no skin cluster of ≥40 natural px with centroid within 30 viewBox units of ` +
              `HIGH_FIVE_CONTACT (${contact.x},${contact.y}) in the assembled ${id} parts — ` +
              "the raised hand is missing from the parts or does not reach the anchor",
          };
      chars[id] = {
        rotationDeg: raisedPart ? null : Math.round(rotationDeg * 10) / 10,
        rotationSource: raisedPart
          ? `dedicated raised-arm part ${raisedPart.part} drawn explicitly at its manifest placement`
          : "pivot rotation carrying the base palm (§3.3/§3.4) onto HIGH_FIVE_CONTACT, computed from the manifest pivot",
        palm,
        highFivePlateDiff: hf.diff ?? "NOT RUN — high-five pose plate absent",
        baseAssemblyVsFigureOfRecord: {
          plate: basePlate,
          diff: baseAsm.diff ?? "NOT RUN — figure-of-record plate absent",
        },
      };
      const p = palm as { status: string; errorRigPx?: number };
      expect(
        p.status,
        `${id}: palm measurement ${p.status === "measured" ? "" : `FAIL/NOT RUN — ${(palm as { reason?: string }).reason ?? ""}`}`,
      ).toBe("measured");
      expect(
        p.errorRigPx!,
        `${id}: palm error ${p.errorRigPx?.toFixed(2)} rig px (rendered at ${GATE.rigHeightPx}px rig height) must be ≤${GATE.palmMaxErrorRigPx} rig px (§7)`,
      ).toBeLessThanOrEqual(GATE.palmMaxErrorRigPx);
      if (hf.diff) {
        expect(
          hf.diff.differingFraction,
          `${id}: assembly-vs-plate (${hfPlate}) differing fraction ${hf.diff.differingFraction.toFixed(3)} must be ≤${GATE.assemblyMaxDiffFraction}`,
        ).toBeLessThanOrEqual(GATE.assemblyMaxDiffFraction);
      } else {
        test.info().annotations.push({
          type: "not-run",
          description: `${id}: assembly-vs-plate diff NOT RUN — ${hfPlate} absent`,
        });
      }
    }
    report.characters = chars;
    ASSEMBLY_REPORT = report;
    mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
    writeFileSync(
      path.resolve("test-results/pair-art-kidtest/assembly-report.json"),
      JSON.stringify(report, null, 2),
    );
  } finally {
    await context.close();
  }
});

/* ------------------------------------------------------------------ */
/* 3. Human trial preparation — screens + manifest, NO fake results     */
/* ------------------------------------------------------------------ */

interface Trial {
  id: string;
  kind: "find" | "identity" | "expression";
  width: Width;
  background: Background;
  instruction: string;
  timeLimitMs: number | null;
  figurePlate: string | null;
  distractorPlates: string[];
  spotId: string | null;
  /** Where spotId came from: the seeded manifest pick, or the
   * lawful spot the real page actually offered at screenshot time
   * (Senior developer nit: manifest and screenshot must agree —
   * a silent fallback made them disagree). */
  spotSource?: "manifest" | "reconciled-to-lawful-spot-on-real-page";
  choices: string[];
  correctChoice: string | null;
  status: "ready" | "blocked-missing-plate" | "blocked-no-lawful-spot";
  blockedReason?: string;
  /** Find trials only: the settle-time placement proof for the
   * captured screen — figure rect plus its measured overlap with
   * the map, page chrome, and clue text (all must be 0 px²). */
  placement?: {
    figureRect: Rect;
    mapOverlapPx2: number;
    chromeOverlapPx2: number;
    clueCoveragePx2: number;
    blockersChecked: { clueText: number; chrome: number };
  };
  /** Expression trials only: whose face, which feeling. The feeling
   * is recorded per trial (B1 cure) — the pre-cure manifest's
   * correctChoice distribution was pout ×6, delighted ×0,
   * surprised ×0, which could never have passed §10 honestly. */
  character?: string;
  emotion?: string;
  facePlate?: string | null;
  /** Expression trials only: the figure height the face is rendered
   * at — the cell's in-band MINIMUM, so the face is read at the
   * cell's floor scale, on the figure, never as a big isolated
   * face plate (B1 cure). */
  figureHeightPx?: number;
  faceFloorPx?: number;
  renderMode?: "face-on-figure-at-in-band-size";
  /** Always null here. Humans fill KIDTEST_RESULTS.md — see protocol. */
  results: null;
}

test("trial preparation — build trial screens and export the trial manifest", async ({
  browser,
}) => {
  const rng = mulberry32(TRIAL_SEED);
  const trials: Trial[] = [];
  const holmes = figureFor("holmes-standing");
  const watson = figureFor("watson-standing");
  const identityChoices = [
    holmes?.id ?? "holmes-standing",
    watson?.id ?? "watson-standing",
    "tracker-standing",
    "jolly-standing",
  ];
  const spotIds = [
    "gutter-left-top",
    "gutter-left-bottom",
    "gutter-right-top",
    "gutter-right-bottom",
    "page-above-map",
    "page-below-map",
  ];
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];

  for (const width of WIDTHS) {
    for (const background of BACKGROUNDS) {
      const cell = `${width}-${background}`;
      trials.push({
        id: `find-${cell}`,
        kind: "find",
        width,
        background,
        instruction: "Where is Holmes?",
        timeLimitMs: GATE.findTimeLimitMs,
        figurePlate: holmes?.id ?? null,
        distractorPlates: [],
        spotId: pick(spotIds),
        spotSource: "manifest",
        choices: [],
        correctChoice: "tap lands on the Holmes figure within 2 s",
        status: holmes ? "ready" : "blocked-missing-plate",
        blockedReason: holmes ? undefined : missingReason("holmes-standing"),
        results: null,
      });
      const identityMissing = identityChoices.filter((id) => !plateById(id));
      trials.push({
        id: `identity-${cell}`,
        kind: "identity",
        width,
        background,
        instruction: "Which one is Holmes?",
        timeLimitMs: null,
        figurePlate: holmes?.id ?? null,
        distractorPlates: identityChoices.filter((id) => id !== holmes?.id),
        spotId: null,
        choices: fisherYates(identityChoices, rng),
        correctChoice: holmes?.id ?? "holmes-standing",
        status: identityMissing.length === 0 ? "ready" : "blocked-missing-plate",
        blockedReason:
          identityMissing.length === 0
            ? undefined
            : identityMissing.map(missingReason).join("; "),
        results: null,
      });
      /* Expression leg (B1 + Game designer nit 3 cure): EVERY cell
       * carries, for EACH character, one trial per required feeling
       * (delighted / surprised / pout). The face is rendered ON the
       * figure at the cell's in-band minimum figure height — the
       * floor scale — never as a big isolated face plate. Emotion
       * order across a child's session is counterbalanced by the
       * protocol's rotation (scripts/kidtest-protocol.md §4). */
      for (const character of GATE.expressionCharacters) {
        const figure = character === "holmes" ? holmes : watson;
        for (const emotion of GATE.expressionEmotions) {
          const facePlateId = `${character}-face-${emotion}`;
          const face = plateById(facePlateId);
          const blocked =
            !figure || !face
              ? [
                  ...(!figure ? [missingReason(`${character}-standing`)] : []),
                  ...(!face ? [`no ${facePlateId}.(png|webp|jpg) in ${PLATE_DIR}`] : []),
                ].join("; ")
              : undefined;
          trials.push({
            id: `expression-${cell}-${character}-${emotion}`,
            kind: "expression",
            width,
            background,
            instruction:
              character === "holmes" ? "How does Holmes feel?" : "How does Watson feel?",
            timeLimitMs: null,
            figurePlate: figure?.id ?? null,
            distractorPlates: [],
            spotId: null,
            choices: fisherYates(["delighted", "surprised", "pout", "neutral"], rng),
            correctChoice: emotion,
            status: blocked ? "blocked-missing-plate" : "ready",
            blockedReason: blocked,
            character,
            emotion,
            facePlate: face?.id ?? null,
            figureHeightPx: BANDS[width].min,
            faceFloorPx: BANDS[width].faceFloor,
            renderMode: "face-on-figure-at-in-band-size",
            results: null,
          });
        }
      }
    }
  }

  /* Prepare (and screenshot) one find-trial screen per width over the
   * real game page, when Holmes exists. Missing plate → annotated
   * NOT RUN, never a failure: the manifest below is the deliverable.
   * The manifest is written AFTER the screenshots so a spot the real
   * page could not lawfully offer is reconciled INTO the manifest
   * (spotId + spotSource) — manifest and screenshot always agree. */
  const findFailures: string[] = [];
  if (!holmes) {
    test.info().annotations.push({
      type: "not-run",
      description: `find-trial screens NOT RUN: ${missingReason("holmes-standing")}`,
    });
  } else {
    for (const width of WIDTHS) {
      const band = BANDS[width];
      const context = await browser.newContext({
        viewport: { width, height: band.height },
      });
      await serveBuiltArtifact(context);
      const page = await context.newPage();
      try {
        await openRealCase(page);
        const layout = await settledLayout(page);
        const probe = await placePlate(page, holmes, { id: "probe", x: 8, y: 8 }, band.max);
        const spots = lawfulSpots(Math.round(probe.w), band.max, layout, width, band.height);
        const trial = trials.find((t) => t.id === `find-${width}-map`);
        const capturePath = path.resolve(`test-results/pair-art-kidtest/find-${width}.png`);
        if (spots.length === 0) {
          /* No lawful spot at this width (panel re-vote cure): the
           * find leg FAILS for this width with this reason — the
           * harness never mints an unlawful spot, and any stale
           * capture from an earlier run is removed so it cannot be
           * mistaken for this run's evidence. The failure is
           * asserted after the manifest is written (below), so the
           * manifest records the outcome for every width. */
          const reason =
            `no lawful spot @${width}: every figure placement at max in-band size (${Math.round(probe.w)}×${band.max}) ` +
            "intersects the map, clue text, or page chrome (search/buttons/attribution/header/bench)";
          if (trial) {
            trial.status = "blocked-no-lawful-spot";
            trial.spotId = null;
            trial.spotSource = undefined;
            trial.blockedReason = reason;
          }
          findFailures.push(`find-${width}-map: ${reason}`);
          test.info().annotations.push({ type: "blocked-no-lawful-spot", description: reason });
          rmSync(capturePath, { force: true });
          continue;
        }
        const spot = spots.find((s) => s.id === trial?.spotId) ?? spots[0]!;
        if (trial && trial.spotId !== spot.id) {
          trial.spotId = spot.id;
          trial.spotSource = "reconciled-to-lawful-spot-on-real-page";
        }
        await placePlate(page, holmes, spot, band.max);
        /* Settle, then prove the placement against the final DOM
         * geometry BEFORE capturing it: figure ∩ map = 0, figure ∩
         * chrome = 0, figure ∩ clue text = 0 — the same negative
         * gates as Measure 3, on the same settled snapshot the
         * screenshot will show. A placement that fails is recorded
         * in the manifest + findFailures (asserted after the
         * manifest is written) and its screen is NOT captured — one
         * unlawful width must not block the other widths' evidence,
         * and an unlawful capture must never exist. */
        await page.waitForTimeout(250);
        const snap = await layoutRects(page);
        expect(snap.figure, `find-${width}: placed Holmes plate must be measurable`).not.toBeNull();
        const rect = snap.figure!;
        const mapOverlap = snap.map ? overlapArea(rect, snap.map) : 0;
        let chromeOverlapTotal = 0;
        let worstChrome = "";
        for (const c of snap.chrome) {
          const chromeOverlap = overlapArea(rect, c.rect);
          chromeOverlapTotal += chromeOverlap;
          if (chromeOverlap > 0 && !worstChrome) worstChrome = `${c.label} ${chromeOverlap} px²`;
        }
        const clueCovered = snap.clueText.reduce((sum, t) => sum + overlapArea(rect, t), 0);
        if (trial) {
          trial.placement = {
            figureRect: rect,
            mapOverlapPx2: mapOverlap,
            chromeOverlapPx2: chromeOverlapTotal,
            clueCoveragePx2: clueCovered,
            blockersChecked: { clueText: snap.clueText.length, chrome: snap.chrome.length },
          };
        }
        if (mapOverlap > 0 || chromeOverlapTotal > 0 || clueCovered > 0) {
          findFailures.push(
            `find-${width}-map spot ${spot.id}: placement UNLAWFUL at settle time — figure ∩ map ${mapOverlap} px², ` +
              `figure ∩ chrome ${chromeOverlapTotal} px²${worstChrome ? ` (first: ${worstChrome})` : ""}, ` +
              `figure ∩ clue text ${clueCovered} px²; screen NOT captured`,
          );
          rmSync(capturePath, { force: true });
          continue;
        }
        await page.screenshot({ path: capturePath });
      } finally {
        await context.close();
      }
    }
  }

  mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
  writeFileSync(
    MANIFEST_OUT,
    JSON.stringify(
      {
        generatedBy: "tests/e2e/pair-art-kidtest.spec.ts (trial preparation)",
        seed: TRIAL_SEED,
        gate: GATE,
        bands: BANDS,
        allocation: {
          rule: GATE.allocation,
          totalPanellists: GATE.totalPanellists,
          perCell: GATE.panellistsPerCell,
          perAgeBandPerCell: GATE.panellistsPerAgeBandPerCell,
          ageBands: GATE.ageBands,
          perBandFloorOutOf10: GATE.perBandFloorOutOf10,
          firstExposure:
            "every observation is the child's only cell, hence a first exposure by construction; any prior-exposure accident is flagged in KIDTEST_RESULTS.md and the observation replaced",
        },
        expressionDesign:
          "Per cell: 3 emotions (delighted, surprised, pout) × 2 characters (Holmes, Watson); face rendered on the figure at the cell's in-band minimum figure height (floor scale), never as an isolated face plate; emotion recorded per trial; bar ≥26/30 per (cell × character × emotion) slice.",
        assembly:
          ASSEMBLY_REPORT ??
          (() => {
            const p = path.resolve("test-results/pair-art-kidtest/assembly-report.json");
            return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
          })(),
        missingPlates: MISSING_PLATES,
        trials,
        results: null,
        note: "No human results live here. Panellist scores are recorded by hand in docs/pair-art/KIDTEST_RESULTS.md per scripts/kidtest-protocol.md.",
      },
      null,
      2,
    ),
  );

  /* The find leg's verdict — asserted only after the manifest is on
   * disk, so a width with no lawful spot is both RECORDED in the
   * manifest (status "blocked-no-lawful-spot") and FAILED here.
   * A find screen is never captured at an unlawful spot. */
  expect(
    findFailures,
    `find leg FAILED for ${findFailures.length} width(s): no lawful spot at max in-band size, or the minted spot proved unlawful at settle time — those find screens were NOT captured and stand NOT RUN with the recorded reason`,
  ).toEqual([]);
});
