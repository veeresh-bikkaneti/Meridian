import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { effectiveRadius, INFORMANT_COST } from "./engine.ts";
import type { ColdTrailSighting } from "./types.ts";

/**
 * One witness report: timestamp, clue sentence, ring radius, and the
 * actions that put its evidence on the map (place ring / paid informant).
 */
export function SightingCard({
  sighting,
  index,
  ringPlaced,
  informantOn,
  stars,
  revealed,
  onPlaceRing,
  onInformant,
}: {
  sighting: ColdTrailSighting;
  index: number;
  ringPlaced: boolean;
  informantOn: boolean;
  stars: number;
  revealed: boolean;
  onPlaceRing: () => void;
  onInformant: () => void;
}): JSX.Element {
  const radius = effectiveRadius(sighting, informantOn);
  const canInform = ringPlaced && !informantOn && !revealed && stars >= INFORMANT_COST;
  return (
    <article
      aria-label={`Sighting ${index + 1}: ${sighting.cityName}`}
      data-testid="sighting-card"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <p className="text-[11px] tracking-wider text-muted uppercase">
        🕵️ Sighting {index + 1} · {sighting.timestamp}
      </p>
      <p className="mt-1 text-fg">{sighting.text}</p>
      <p className="mt-2 text-sm text-muted">
        Ring radius:{" "}
        <span className="text-[#f2c14e]">~{Math.round(radius).toLocaleString("en-US")} km</span>
        {informantOn ? " (informant tightened)" : ""}
        {ringPlaced ? "" : " — not on the map yet"}
      </p>
      {!revealed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!ringPlaced ? (
            <Button
              type="button"
              data-testid="place-ring-btn"
              onClick={onPlaceRing}
              className="min-h-[44px]"
            >
              📍 Place ring on map
            </Button>
          ) : null}
          {canInform ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="informant-btn"
              onClick={onInformant}
              className="min-h-[44px]"
            >
              🎙️ Informant: tighten 50% (1⭐)
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
