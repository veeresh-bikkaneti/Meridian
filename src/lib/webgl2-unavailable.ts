/**
 * WebGL2 fix: true when a map failure is the permanent "this browser has
 * no WebGL2" gap (the map library's GPUInitializationError). A reload can
 * never fix a missing WebGL2, so sending this one to a crash reporter or
 * an error boundary only stranded the player on a retry card and filed a
 * crash report for a device limit, not a bug. Every other error keeps
 * its normal reporting / boundary behaviour.
 *
 * Leaf module on purpose: importers include the GeoDetective/Cold Trail
 * map boundary, which must not pull in the satellite-map stack just to
 * classify an error. No imports — anything may depend on this.
 */
export function isWebgl2Unavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "GPUInitializationError" ||
    err.message.includes("WebGL2 is required")
  );
}
