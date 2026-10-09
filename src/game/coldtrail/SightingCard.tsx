import type { JSX, Ref } from "react";
import { Button } from "@/components/ui/button";
import { effectiveRadius, INFORMANT_COST } from "./engine.ts";
import type { ColdTrailSighting } from "./types.ts";

/**
 * One witness report: timestamp, clue sentence, ring radius, and the
 * actions that put its evidence on the map (place ring / paid informant).
 *
 * Placement-mode states (WS1 "Every Place Findable"):
 * - idle:        "📍 Place ring on map" (other cards stay enabled during
 *                another card's placement — tapping one switches, T5/T11)
 * - placing(i):  "✖ Cancel placement" (crosshair armed, no draft yet)
 * - adjusting(i): "Yes, keep it" + "Try again" (draft ring on the map)
 * - confirmed(i): "✓ Ring placed" + "↩ Move" + informant button
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
  placingActive,
  draftSet,
  onLockRing,
  onTryAgain,
  onCancelPlacement,
  onMoveRing,
  actionRef,
}: {
  sighting: ColdTrailSighting;
  index: number;
  ringPlaced: boolean;
  informantOn: boolean;
  stars: number;
  revealed: boolean;
  onPlaceRing: () => void;
  onInformant: () => void;
  /** This card is the live placement target (placing(i) or adjusting(i)). */
  placingActive: boolean;
  /** A draft ring exists for this card (adjusting(i)). */
  draftSet: boolean;
  onLockRing: () => void;
  /** Back to placing(i): discard the draft, re-arm the crosshair. */
  onTryAgain: () => void;
  onCancelPlacement: () => void;
  /** Re-enter adjusting(i) with the draft planted at the locked center. */
  onMoveRing: () => void;
  /** Ref for the card's primary action button (focus management, WCAG 2.4.3). */
  actionRef?: Ref<HTMLButtonElement>;
}): JSX.Element {
  const radius = effectiveRadius(sighting, informantOn);
  const informantUsed = informantOn || revealed;
  const informantAffordable = stars >= INFORMANT_COST;
  // The informant is hidden while this card holds the live placement
  // (it only applies to confirmed rings).
  const showInformant = ringPlaced && !informantUsed && !placingActive;
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
        <span className="text-gold-ink">~{Math.round(radius).toLocaleString("en-US")} km</span>
        {informantOn ? " (informant tightened)" : ""}
        {ringPlaced
          ? ""
          : placingActive
            ? draftSet
              ? " — draft on the map"
              : " — tap the map to place it"
            : " — not on the map yet"}
      </p>
      {!revealed ? (
        <>
          {ringPlaced && !placingActive ? (
            <p className="mt-3 text-sm text-fg">✓ Ring placed</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {placingActive ? (
              draftSet ? (
                <>
                  <Button
                    type="button"
                    ref={actionRef}
                    data-testid="confirm-ring-btn"
                    onClick={onLockRing}
                    className="min-h-[44px] flex-1"
                  >
                    Yes, keep it
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="change-spot-btn"
                    onClick={onTryAgain}
                    className="min-h-[44px] flex-1"
                  >
                    Try again
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  ref={actionRef}
                  variant="secondary"
                  data-testid="cancel-placement-btn"
                  onClick={onCancelPlacement}
                  className="min-h-[44px]"
                >
                  ✖ Cancel placement
                </Button>
              )
            ) : !ringPlaced ? (
              <Button
                type="button"
                ref={actionRef}
                data-testid="place-ring-btn"
                onClick={onPlaceRing}
                className="min-h-[44px]"
              >
                📍 Place ring on map
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                data-testid="move-ring-btn"
                onClick={onMoveRing}
                className="min-h-[44px]"
              >
                ↩ Move
              </Button>
            )}
            {showInformant ? (
              <Button
                type="button"
                variant="secondary"
                data-testid="informant-btn"
                onClick={onInformant}
                disabled={!informantAffordable}
                title={
                  informantAffordable
                    ? "Spend 1 star to tighten this ring to half its radius"
                    : "Needs 1 star — close a case to earn one"
                }
                aria-label={
                  informantAffordable
                    ? `Informant: tighten ring to half radius, costs ${INFORMANT_COST} star`
                    : `Informant unavailable: needs ${INFORMANT_COST} star, you have ${stars}`
                }
                className="min-h-[44px]"
              >
                🎙️ Informant: tighten 50% (1⭐)
              </Button>
            ) : null}
          </div>
          {placingActive && draftSet ? (
            <p className="mt-2 text-sm text-muted">
              Tap the map to move the ring — it follows your taps until you lock it.
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
