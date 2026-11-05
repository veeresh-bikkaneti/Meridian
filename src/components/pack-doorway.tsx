/**
 * PackDoorway — the Capitals & Flags strip on Home (issue #344).
 *
 * The ratified design gives the pack edition-level prominence WITHOUT
 * a new edition: one door into each mode that deals the pack.
 * GeoDetective's door sets the loop store's active deck to the pack
 * before opening (GameApp owns that write); Cold Trail's door writes
 * the shared shelf selection the trail reads at deal time. Both doors
 * land the player in the mode with the pack already dealt — nobody is
 * asked to find the shelf chip first.
 *
 * The land count in the sub-line comes from the shipped pack manifest,
 * so it can never promise cases that do not exist; until the manifest
 * answers (or if it never does), the line runs without a count.
 *
 * DESIGN VARIANT (branch design/home-rework-variants, owner findings
 * 2026-11-04: "doesnt follow the theme" + placement reimagined beside
 * the About card): the insides are rebuilt in the home-v5 card
 * language — hv5-head badge + eyebrow label, display-type title, the
 * theme's pill CTAs — so the strip reads as a sibling of the
 * GeoDetective / Cold Trail cards instead of a generic banner. Copy is
 * unchanged word-for-word. `density="compact"` is the anti-crowding
 * cut for the beside-About placement: same words, same doors, tighter
 * footprint.
 */
import { useEffect, useState } from "react";

import { FlagImg } from "@/components/flag-img";
import { FIRST_PACK_ID, fetchPackManifest } from "@/components/pack-shelf-data";

/**
 * The design sketch's three swatches: a country flag, a US state flag,
 * a second country flag — the registry's most famous three. Each sits
 * beside the strip's own title text naming the pack's lands in words,
 * and a flagless registry entry would simply render no swatch.
 */
const DOORWAY_SWATCH_KEYS = ["us", "us-tx", "gb"];

export function PackDoorway({
  onGeoDetective,
  onColdTrail,
  density = "full",
}: {
  onGeoDetective: () => void;
  onColdTrail: () => void;
  density?: "full" | "compact";
}) {
  const [landCount, setLandCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetchPackManifest(FIRST_PACK_ID)
      .then((manifest) => {
        if (live && manifest) setLandCount(manifest.size);
      })
      .catch(() => {
        // No count, no problem: the doors still work.
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section
      aria-label="Capitals and Flags"
      data-testid="pack-doorway"
      className={`hv5-card hv5-doorway home-rise${density === "compact" ? " hv5-doorway-compact" : ""}`}
    >
      <div className="hv5-head">
        <span className="hv5-badge" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5 21 V4" strokeLinecap="round" /><path d="M5 5 C8 3.5 10.5 6 13.5 4.5 L19 6.5 L19 12 C16 10.5 13.5 13 10.5 11.5 L5 12.5 Z" /></svg>
        </span>
        <span className="hv5-label">Story pack · Capitals</span>
      </div>
      <div className="hv5-doorway-flags" aria-hidden="true">
        {DOORWAY_SWATCH_KEYS.map((flagKey) => (
          <FlagImg key={flagKey} flagKey={flagKey} className="hv5-doorway-flag" />
        ))}
      </div>
      <h2>Capitals &amp; Flags</h2>
      <p>
        {landCount !== null ? `${landCount} lands · ` : ""}Find the capital,
        learn its flag
      </p>
      <div className="hv5-doorway-doors">
        <button
          type="button"
          data-testid="pack-doorway-geodetective"
          onClick={onGeoDetective}
          className="hv5-btn hv5-btn-brown"
        >
          🔎 Play in GeoDetective
        </button>
        <button
          type="button"
          data-testid="pack-doorway-coldtrail"
          onClick={onColdTrail}
          className="hv5-btn hv5-btn-ghost"
        >
          ❄️ Play in Cold Trail
        </button>
      </div>
    </section>
  );
}
