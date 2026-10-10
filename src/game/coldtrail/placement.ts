import { formatDistance, normalizeLon } from "../geo.ts";
import type { TrailEvidenceMark, TrailEvidenceRing } from "../loop/LoopMap.tsx";
import { ringPolygon } from "../loop/rings.ts";
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
  /** F11 overlap lens: present only when all rings are locked, pre-reveal. */
  overlap: OverlapRegion | null;
}

/** A locked player ring: center + radius, for the overlap computation. */
export interface LockedRing {
  lon: number;
  lat: number;
  radiusKm: number;
}

export interface OverlapRegion {
  /**
   * Closed lon/lat ring of the triple intersection (the F11 lens), or null
   * when the three locked rings share no common area — the centroid marker
   * is the fallback anchor then.
   */
  polygon: Array<[number, number]> | null;
  /** Mean of the three locked centers (pulse anchor, fallback marker). */
  centroid: { lon: number; lat: number };
}

type Pt = [number, number]; // [lon, lat]

function signedRingArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

/**
 * Intersect two convex polygons (Sutherland–Hodgman). Both rings are
 * closed (last point repeats the first); the result stays closed.
 */
function clipConvex(subject: Pt[], clip: Pt[]): Pt[] {
  // Normalize the clip ring to CCW so "inside" is left-of-edge.
  const clipRing = signedRingArea(clip) < 0 ? [...clip].reverse() : clip;
  let output = subject;
  for (let i = 0; i < clipRing.length - 1 && output.length > 0; i++) {
    const cp1 = clipRing[i];
    const cp2 = clipRing[i + 1];
    const inside = (p: Pt): boolean =>
      (cp2[0] - cp1[0]) * (p[1] - cp1[1]) - (cp2[1] - cp1[1]) * (p[0] - cp1[0]) >= 0;
    const intersect = (s: Pt, e: Pt): Pt => {
      const d1x = cp2[0] - cp1[0];
      const d1y = cp2[1] - cp1[1];
      const d2x = e[0] - s[0];
      const d2y = e[1] - s[1];
      const denom = d1x * d2y - d1y * d2x;
      if (denom === 0) return [s[0], s[1]];
      const t = ((s[0] - cp1[0]) * d2y - (s[1] - cp1[1]) * d2x) / denom;
      return [cp1[0] + t * d1x, cp1[1] + t * d1y];
    };
    const input = output;
    output = [];
    let s = input[input.length - 1];
    for (const e of input) {
      const eIn = inside(e);
      const sIn = inside(s);
      if (eIn) {
        if (!sIn) output.push(intersect(s, e));
        output.push(e);
      } else if (sIn) {
        output.push(intersect(s, e));
      }
      s = e;
    }
  }
  // Explicitly close the ring (GeoJSON Polygon rings repeat the first
  // point): SH on a closed input can leave the ends as two different
  // edge-intersection points.
  if (output.length > 0) {
    const first = output[0];
    const last = output[output.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) output.push([first[0], first[1]]);
  }
  return output;
}

/**
 * F11 overlap lens (walkthrough blocking beat): the region where all three
 * locked player rings overlap — "tap where they cross" needs a visible
 * crossing on a world-zoom view. Pure geometry on PLAYER centers only
 * (I1: the true anchors are read nowhere here).
 */
export function tripleOverlap(rings: LockedRing[]): OverlapRegion | null {
  if (rings.length < 3) return null;
  const polys: Pt[][] = rings.map((r) =>
    (ringPolygon(r.lon, r.lat, r.radiusKm).coordinates[0] as Pt[]).map(
      ([lo, la]) => [lo, la] as Pt,
    ),
  );
  // Common longitude frame: ringPolygon unwraps each ring continuously from
  // its own center, so shift whole rings by 360° multiples to sit near the
  // first ring's frame (antimeridian-safe).
  const baseLon = polys[0][0][0];
  for (let k = 1; k < polys.length; k++) {
    const shift = Math.round((baseLon - polys[k][0][0]) / 360) * 360;
    if (shift !== 0) for (const pt of polys[k]) pt[0] += shift;
  }
  // Centroid from the ORIGINAL centers via circular mean (antimeridian-safe:
  // plain averaging would put the mean of 179° and -179° at 0°). Latitudes
  // have no wraparound, so a plain mean is fine.
  const toRad = Math.PI / 180;
  let cx = 0;
  let cy = 0;
  let clat = 0;
  for (const r of rings) {
    cx += Math.cos(r.lon * toRad);
    cy += Math.sin(r.lon * toRad);
    clat += r.lat;
  }
  const centroid = {
    lon: normalizeLon((Math.atan2(cy, cx) / toRad + 540) % 360 - 180),
    lat: clat / rings.length,
  };
  let inter = clipConvex(polys[1], polys[0]);
  inter = clipConvex(inter, polys[2]);
  // A closed ring with ≥3 distinct vertices is a real area; anything
  // smaller (touching/empty) falls back to the centroid marker.
  const distinct = inter.length >= 4 ? inter.slice(0, -1) : inter;
  const polygon = distinct.length >= 3 ? inter : null;
  return { polygon, centroid };
}

export function buildEvidenceOverlays(
  caseData: ColdTrailCase,
  progress: ColdTrailProgress,
  draft: PlacementDraft | null,
): EvidenceOverlays {
  const rings: TrailEvidenceRing[] = [];
  const marks: TrailEvidenceMark[] = [];
  const locked: LockedRing[] = [];
  caseData.sightings.forEach((s, i) => {
    const center = progress.ringCenters[i];
    if (!center) return;
    const radius = effectiveRadius(s, progress.informantOn[i]!);
    locked.push({ lon: center.lon, lat: center.lat, radiusKm: radius });
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
  // F11 overlap lens: only when every ring is locked and the case is still
  // open. Derived from PLAYER centers only (I1 holds — see module doc).
  const overlap =
    !progress.revealed && locked.length === caseData.sightings.length
      ? tripleOverlap(locked)
      : null;
  return { rings, marks, overlap };
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

/**
 * Signed shortest-arc longitude delta in [-180, 180]. The nudge
 * announcement must say "east" for a +2° step even when it wraps 179 →
 * -179 across the antimeridian (the raw delta would read -358 → "west").
 */
export function wrapLonDelta(dLon: number): number {
  return ((dLon + 540) % 360) - 180;
}
