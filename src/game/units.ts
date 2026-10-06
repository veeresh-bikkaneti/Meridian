/**
 * Cartographer's Plate — length units (Veeresh's ratified decision 4).
 *
 * USA plays show miles; the rest of the world shows kilometers. The unit
 * is derived from EDITION/REGION CONTEXT — never device locale:
 *   - endless editions: state edition (always USA states) and the
 *     "united-states" country run → miles; every other edition/region → km.
 *   - GeoDetective: the mystery target's territory — USA ("840") → miles.
 *
 * Distances, grade bands, and share text all follow this rule. (Share
 * text carries no distances today — main editions share scores only and
 * GeoDetective shares spoiler-free marks — so the rule is a no-op there
 * until a distance-bearing share line exists.)
 *
 * Pure module: no DOM, no storage, no network. Unit-testable.
 */
import type { Edition } from "./run.ts";
import { formatDistance } from "./geo.ts";
import { territoryAt } from "./territory.ts";
import type { LonLat } from "./types.ts";

export type LengthUnit = "km" | "mi";

/** Kilometers per mile (exact). */
export const KM_PER_MI = 1.609344;

/** World-atlas numeric territory key for the United States of America. */
export const USA_TERRITORY_KEY = "840";

/** The country-run region id for the United States. */
export const USA_COUNTRY_REGION_ID = "united-states";

/**
 * Unit for an endless-edition play. State edition is USA-only; country
 * edition is miles only for the United States run.
 */
export function unitForEdition(edition: Edition, regionId: string): LengthUnit {
  if (edition === "state") return "mi";
  if (edition === "country" && regionId === USA_COUNTRY_REGION_ID) return "mi";
  return "km";
}

/**
 * Unit for a GeoDetective mystery, from the target's territory. Fail
 * closed: an unresolvable territory (ocean-adjacent targets) reads km —
 * the edition default.
 */
export function unitForLoopTarget(target: LonLat): LengthUnit {
  try {
    return territoryAt(target)?.key === USA_TERRITORY_KEY ? "mi" : "km";
  } catch {
    return "km";
  }
}

/**
 * Unit-aware distance formatting. Mirrors formatDistance's thresholds in
 * each native unit: sub-unit (<1 km → m; <1 mi → ft), one decimal below
 * 100, thousands-separated integers above.
 */
export function formatLength(km: number, unit: LengthUnit): string {
  if (!Number.isFinite(km)) return "—";
  if (unit === "km") return formatDistance(km);
  const mi = km / KM_PER_MI;
  if (mi < 1) return `${Math.max(0, Math.round(mi * 5280))} ft`;
  if (mi < 100) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi).toLocaleString("en-US")} mi`;
}

// ---------------------------------------------------------------------------
// Grade bands (Veeresh's ratified decision 1 — fixed ruler, native round
// units per unit context).
// ---------------------------------------------------------------------------

export type GradeBand = {
  emoji: string;
  /** Band name, e.g. "Bullseye" — visible in the chip AND in its aria-label. */
  name: string;
};

/**
 * GeoDetective proximity bands. Thresholds are NATIVE round numbers per
 * unit (never converted): km 25/150/600/1500/3000, mi 15/100/400/1000/2000.
 */
export function loopGradeBand(distKm: number, unit: LengthUnit): GradeBand {
  const thresholds =
    unit === "mi"
      ? [15, 100, 400, 1000, 2000]
      : [25, 150, 600, 1500, 3000];
  const bands: GradeBand[] = [
    { emoji: "🎯", name: "Bullseye" },
    { emoji: "🏆", name: "So Close" },
    { emoji: "🌟", name: "Nearly There" },
    { emoji: "👏", name: "On the Trail" },
    { emoji: "🙂", name: "Far Afield" },
    { emoji: "💨", name: "Way Off" },
  ];
  const value = unit === "mi" ? distKm / KM_PER_MI : distKm;
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]!) return bands[i]!;
  }
  return bands[bands.length - 1]!;
}

/**
 * Main-edition score bands — the existing share grade tiers on the 0–415
 * scoring-v3 range (🎯 300+, 🏆 200+, 🌟 120+, 👏 60+, 🙂 1+, 💨 miss).
 * Reused product language, not invented: the band name IS the tier label.
 */
export function scoreGradeBand(score: number): GradeBand {
  if (score >= 300) return { emoji: "🎯", name: "300+" };
  if (score >= 200) return { emoji: "🏆", name: "200+" };
  if (score >= 120) return { emoji: "🌟", name: "120+" };
  if (score >= 60) return { emoji: "👏", name: "60+" };
  if (score >= 1) return { emoji: "🙂", name: "1+" };
  return { emoji: "💨", name: "miss" };
}
