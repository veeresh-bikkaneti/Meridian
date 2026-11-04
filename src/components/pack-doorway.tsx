/**
 * PackDoorway — the Capitals & Flags strip on Home (issue #344).
 *
 * The ratified design gives the pack edition-level prominence WITHOUT
 * a new edition: a wide, shallow banner directly under the
 * Expeditions Map card, with one door into each mode that deals the
 * pack. GeoDetective's door sets the loop store's active deck to the
 * pack before opening (GameApp owns that write); Cold Trail's door
 * writes the shared shelf selection the trail reads at deal time.
 * Both doors land the player in the mode with the pack already dealt —
 * nobody is asked to find the shelf chip first.
 *
 * The land count in the sub-line comes from the shipped pack manifest,
 * so it can never promise cases that do not exist; until the manifest
 * answers (or if it never does), the line runs without a count.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
}: {
  onGeoDetective: () => void;
  onColdTrail: () => void;
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
      className="hv5-card home-rise mt-4 p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            {DOORWAY_SWATCH_KEYS.map((flagKey) => (
              <FlagImg key={flagKey} flagKey={flagKey} className="h-6" />
            ))}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg">Capitals &amp; Flags</h2>
            <p className="text-sm text-muted">
              {landCount !== null ? `${landCount} lands · ` : ""}Find the capital,
              learn its flag
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            data-testid="pack-doorway-geodetective"
            onClick={onGeoDetective}
            className="min-h-[44px]"
          >
            🔎 Play in GeoDetective
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-testid="pack-doorway-coldtrail"
            onClick={onColdTrail}
            className="min-h-[44px]"
          >
            ❄️ Play in Cold Trail
          </Button>
        </div>
      </div>
    </section>
  );
}
