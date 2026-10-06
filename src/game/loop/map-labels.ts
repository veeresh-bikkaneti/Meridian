/**
 * Labeled reference overlay for the GeoDetective map (Option A:
 * "Detective's Atlas").
 *
 * The other three editions keep the strict NO-LABELS rule. GeoDetective is
 * the exception: the mystery is *which* place the clues describe, so labels
 * define the search space instead of spoiling the answer.
 *
 * Esri's World_Boundaries_and_Places reference layer renders boundaries +
 * place labels with white text and a dark halo over satellite imagery, and
 * gates label density by zoom natively — exactly the brainstorm's label
 * spec, with zero label-placement code on our side.
 */
export const LOOP_LABELS_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export const LOOP_LABELS_ATTRIBUTION = "© Esri";
