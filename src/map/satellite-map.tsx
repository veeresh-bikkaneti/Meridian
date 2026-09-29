import { useEffect, useRef, type JSX } from "react";
import { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { imageryView } from "./imagery.ts";

const IMAGERY_SOURCE = "imagery";

/**
 * Live Esri imagery. Flat maps stay inside the region. The globe is the same
 * tiles on a satellite sphere. Tiles are requested by the browser, never bundled.
 */
export function SatelliteMap(props: {
  mode: "flat" | "globe";
  bounds?: [number, number, number, number]; // west, south, east, north
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const view = imageryView(props.mode);
  const west = props.bounds?.[0];
  const south = props.bounds?.[1];
  const east = props.bounds?.[2];
  const north = props.bounds?.[3];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const locked =
      props.mode === "flat" &&
      west !== undefined &&
      south !== undefined &&
      east !== undefined &&
      north !== undefined;
    const bounds = locked
      ? ([west, south, east, north] as [number, number, number, number])
      : undefined;
    const center: [number, number] = bounds
      ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
      : [0, 0];

    const map = new Map({
      container,
      style: {
        version: 8,
        projection: { type: view.projection },
        sources: {
          [IMAGERY_SOURCE]: {
            type: "raster",
            tiles: [view.tiles],
            tileSize: 256,
            maxzoom: 23,
            attribution: view.attribution,
          },
        },
        layers: [
          {
            id: IMAGERY_SOURCE,
            type: "raster",
            source: IMAGERY_SOURCE,
          },
        ],
      },
      center,
      zoom: props.mode === "globe" ? 1.5 : 2,
      maxBounds: bounds,
      attributionControl: false,
      dragRotate: props.mode === "globe",
      pitchWithRotate: props.mode === "globe",
      touchPitch: props.mode === "globe",
      renderWorldCopies: props.mode === "flat",
    });

    if (props.mode === "flat") map.touchZoomRotate.disableRotation();
    if (bounds) map.fitBounds(bounds, { padding: 0, animate: false });

    return () => {
      map.remove();
    };
  }, [east, north, props.mode, south, view.attribution, view.projection, view.tiles, west]);

  return (
    <div className="satellite-map relative h-full min-h-64 w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 m-0 bg-black/60 px-2 py-1 text-left text-[11px] leading-snug text-white">
        {view.attribution}
      </p>
    </div>
  );
}
