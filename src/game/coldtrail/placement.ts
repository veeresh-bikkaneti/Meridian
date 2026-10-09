import { formatDistance } from "../geo.ts";
import type { TrailEvidenceMark, TrailEvidenceRing } from "../loop/LoopMap.tsx";
import { effectiveRadius } from "./engine.ts";
import type { ColdTrailCase, ColdTrailProgress } from "./types.ts";

/**
 * Cold-Trail placement-mode overlay derivation (WS1 "Every Place Findable").
 *
 * Pure function: (case, progress, draft) -> { rings, marks }. TrailScreen
 * calls it; the anti-leak unit test (placement.test.ts) asserts the
 * invariant below on its output.
 *
 * INVARIANT I1 (no oracle rendering): pre-reveal, NO returned coordinate
 * may equal any true anchor/hideout coordinate. Rings and witness marks
 * render PLAYER-chosen centers only:
 * - locked rings -> progress.ringCenters[i] (committed by onLockRing)
 * - draft ring   -> the ephemeral tap/drag position (never persisted)
 * - witness dots -> the locked player centers (NOT the anchor cities)
 * The true anchor (sighting.cityLon/cityLat) is read NOWHERE in this
 * module. The case JSON bundle still ships anchor coords client-side
 * (accepted, documented: the mystery is UI-level, not cryptographic).
 *
 * Radius is public clue data (printed on the sighting card), so
 * effectiveRadius() reading sighting.radiusKm is not a leak. The informant
 * halves the radius around the PLAYER's center and never re-centers toward
 * the true anchor.
 */

/** An unconfirmed ring center: ephemeral React state, never persisted. */
export interface PlacementDraft {
  /** Which sighting this draft belongs to (== the placing index). */
  index: number;
  lon: number;
  lat: number;
}

export interface EvidenceOverlays {
  rings: TrailEvidenceRing[];
  marks: TrailEvidenceMark[];
}

export function buildEvidenceOverlays(
  caseData: ColdTrailCase,
  progress: ColdTrailProgress,
  draft: PlacementDraft | null,
): EvidenceOverlays {
  const rings: TrailEvidenceRing[] = [];
  const marks: TrailEvidenceMark[] = [];
  caseData.sightings.forEach((s, i) => {
    const center = progress.ringCenters[i];
    if (!center) return;
    const radius = effectiveRadius(s, progress.informantOn[i]!);
    rings.push({
      lon: center.lon,
      lat: center.lat,
      radiusKm: radius,
      label: formatDistance(radius),
    });
    // Witness dot at the PLAYER's locked center — never the anchor city.
    marks.push({ lon: center.lon, lat: center.lat, kind: "witness" });
  });
  if (draft) {
    const s = caseData.sightings[draft.index];
    if (s) {
      // Preview shows the informant-tightened radius when Move follows an
      // informant buy — the preview must not lie about the locked ring size.
      const radius = effectiveRadius(s, progress.informantOn[draft.index]!);
      rings.push({
        lon: draft.lon,
        lat: draft.lat,
        radiusKm: radius,
        label: `${formatDistance(radius)} · draft`,
        preview: true,
      });
    }
  }
  // progress.guess is only ever set together with revealed=true
  // (onConfirmIntercept), so the "x" mark is effectively reveal-time.
  if (progress.guess) {
    marks.push({ lon: progress.guess.lon, lat: progress.guess.lat, kind: "x" });
  }
  return { rings, marks };
}

/**
 * Compass words for a nudge delta, for the role="status" announcement
 * ("Ring moved northeast."). dLon/dLat are signed degree deltas.
 */
export function nudgeDirection(dLon: number, dLat: number): string {
  const ns = dLat > 0 ? "north" : dLat < 0 ? "south" : "";
  const ew = dLon > 0 ? "east" : dLon < 0 ? "west" : "";
  return `${ns}${ew}` || "in place";
}
