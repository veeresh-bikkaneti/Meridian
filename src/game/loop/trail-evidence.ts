/** Cold-Trail evidence shapes shared by the loop map and placement. */
/**
 * Cold-Trail evidence overlay: a witness sighting's radius ring.
 * Painted through the same ring source/layers as the loop's deduction
 * surface (ringPolygon), with a km label at the northmost point.
 */
export interface TrailEvidenceRing {
  lon: number;
  lat: number;
  radiusKm: number;
  label: string;
  /**
   * Draft (unconfirmed) ring: drawn dashed + lower opacity through the
   * `loop-ring-line-preview` layer, excluded from the solid `loop-ring-line`
   * layer by its filter. Dashed = "not locked yet" (shape-based, not
   * color-only — safe for colorblind players).
   */
  preview?: boolean;
}

/** Cold-Trail evidence mark: "witness" = gold dot at the witness city,
 * "x" = the player's interception guess (reuses the loop's ✕ layer). */
export interface TrailEvidenceMark {
  lon: number;
  lat: number;
  kind: "witness" | "x";
}
