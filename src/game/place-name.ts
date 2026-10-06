/**
 * Cartographer's Plate — name-tier mechanism (spec §2) + display-string
 * refinement (spec §3) + geographic-anchor bolding (Veeresh's ratified
 * decision 3, overriding spec §13.3).
 *
 * Doctrine: "names are the payload; containers flex, names never do."
 * React computes the tier from the FULL qualified label length and sets
 * `data-name-tier` on the name element; CSS styles per tier. Character
 * count is not a CSS input — the tier attribute is the React→CSS bridge
 * (SSR-safe, no measurement, no reflow loops, unit-testable).
 *
 * Pure module: no DOM, no React, no network. Unit-tested at the 26/27 and
 * 60/61 boundaries.
 */

export type NameTier = "short" | "medium" | "long";

/**
 * Tier from the full qualified label length (the string actually
 * rendered — pass the RAW name; display refinements like zero-width
 * spaces are not counted).
 *   short  ≤ 26 chars — Placard (Fraunces 600)
 *   medium 27–60      — Engraving (Fraunces 500)
 *   long   ≥ 61       — Field entry (Fraunces 500, brass hairline frame)
 */
export function nameTier(name: string): NameTier {
  const len = name.length;
  if (len <= 26) return "short";
  if (len <= 60) return "medium";
  return "long";
}

/**
 * Display-string refinement (spec §3): insert zero-width spaces after
 * `/`, `–`, `-` so long names gain break opportunities at the overflow
 * edge. DISPLAY STRINGS ONLY — never in data, never in ARIA names, never
 * in `title` tooltips. Applied at render time in the same React helper
 * that computes `nameTier()`.
 */
export function refineDisplayString(name: string): string {
  return name.replace(/([/–-])/g, "$1\u200B");
}

/**
 * Recognized country names, built once from the platform's CLDR region
 * table (the same fail-closed primitive as question-label's
 * countryNameForIso2): every ISO-3166-1 alpha-2 code that resolves to a
 * region name, lowercased. No hand-maintained list to drift — it covers
 * every country tail the datasets can produce ("Canada", "Côte d'Ivoire",
 * "United States", …).
 */
const COUNTRY_NAMES: Set<string> = (() => {
  const displayNames = new Intl.DisplayNames(["en"], {
    type: "region",
    fallback: "none",
  });
  const names = new Set<string>();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const region = displayNames.of(code);
      if (region !== undefined) names.add(region.toLowerCase());
    }
  }
  return names;
})();

/** Test seam: how many country names the CLDR table yielded. */
export function recognizedCountryCountForTests(): number {
  return COUNTRY_NAMES.size;
}

export type AnchorTail = {
  /** Everything before the country tail, e.g. "United Townships of …, Eyre and Clyde" */
  head: string;
  /** The country tail INCLUDING its ", " separator, e.g. ", Canada" */
  tail: string;
};

/**
 * Geographic-anchor bolding — the STRICT rule (Veeresh's ratified
 * decision 3): split off the trailing ", Country" tail ONLY when the name
 * ends with ", " + a recognized country name (case-insensitive).
 * Otherwise null (no bold). Weight-only downstream — no color change.
 *
 * The tail match is on the RAW name: display refinements (ZWSP) are
 * applied to head/tail separately at render time.
 */
export function anchorTail(name: string): AnchorTail | null {
  const idx = name.lastIndexOf(", ");
  if (idx <= 0) return null;
  const candidate = name.slice(idx + 2).trim();
  if (!candidate || !COUNTRY_NAMES.has(candidate.toLowerCase())) return null;
  return { head: name.slice(0, idx), tail: name.slice(idx) };
}
