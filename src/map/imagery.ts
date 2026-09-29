export const IMAGERY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const IMAGERY_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export const IMAGERY_NOTICE =
  "The imagery host sees the area on screen. Your pin stays on this device.";

export function imageryView(mode: "flat" | "globe"): {
  tiles: string;
  attribution: string;
  projection: "mercator" | "globe";
} {
  return {
    tiles: IMAGERY_TILES,
    attribution: IMAGERY_ATTRIBUTION,
    projection: mode === "flat" ? "mercator" : "globe",
  };
}
