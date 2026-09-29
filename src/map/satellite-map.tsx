import { useEffect, useRef, useState, type JSX } from "react";
import { Map, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { disk } from "@/game/geo";
import { imageryView } from "./imagery.ts";
import { TOUCH_LIFT_PX } from "./pin-tap.ts";
import { createTapTracker } from "./tap-tracker.ts";
import { variationLine, type MapPoint } from "./variation.ts";

const IMAGERY_SOURCE = "imagery";
const LINE_SOURCE = "variation-line";
const RING_SOURCE = "variation-ring";

export type MapMark = { lon: number; lat: number; tone: "aim" | "pin" | "spot" };

export type MapVariation = {
  pin: MapPoint;
  spot: MapPoint;
  kilometers: number;
  radiusKm: number;
};

const EMPTY = { type: "FeatureCollection" as const, features: [] };

function markerElement(tone: MapMark["tone"]): HTMLDivElement {
  const spot = tone === "spot";
  const el = document.createElement("div");
  el.style.width = spot ? "16px" : "18px";
  el.style.height = spot ? "16px" : "18px";
  el.style.borderRadius = spot ? "999px" : "999px 999px 999px 0";
  el.style.background = spot ? "#f2c14e" : "#f4f1ea";
  el.style.border = "2px solid #101211";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.45)";
  el.style.pointerEvents = "none";
  if (!spot) el.style.transform = "rotate(-45deg)";
  el.setAttribute("aria-label", spot ? "The spot" : "Your pin");
  return el;
}

function replaceMarks(map: Map, marks: readonly MapMark[] | undefined, current: Marker[]): Marker[] {
  for (const marker of current) marker.remove();
  return (marks ?? []).map(
    (mark) =>
      new Marker({
        element: markerElement(mark.tone),
        anchor: mark.tone === "spot" ? "center" : "bottom",
      })
        .setLngLat([mark.lon, mark.lat])
        .addTo(map),
  );
}

function setFeature(map: Map, id: string, coordinates: number[][] | null) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(
    coordinates
      ? {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        }
      : EMPTY,
  );
}

/**
 * Live Esri imagery. A tap places (or moves) a pin — taps never commit.
 * The Drop pin button is the only commit path. Double-tap / double-click
 * zooms only; the second tap of the pair reverts the first tap's placement
 * via onDoubleTap so a double-tap leaves zero pins behind.
 * After the drop, a line shows how far the pin is from the spot.
 */
export function SatelliteMap(props: {
  mode: "flat" | "globe";
  bounds?: [number, number, number, number]; // west, south, east, north
  onAim?: (lon: number, lat: number) => void;
  onConfirm?: (lon: number, lat: number) => void;
  /** Double-tap/double-click zoom detected: parent reverts the last tap's placement (M1). */
  onDoubleTap?: () => void;
  /** Keyboard Escape with a pin placed: parent clears the aim (M5). */
  onClearAim?: () => void;
  marks?: readonly MapMark[];
  variation?: MapVariation | null;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const labelRef = useRef<Marker | null>(null);
  const onAimRef = useRef(props.onAim);
  const onConfirmRef = useRef(props.onConfirm);
  const onDoubleTapRef = useRef(props.onDoubleTap);
  const onClearAimRef = useRef(props.onClearAim);
  const marksRef = useRef(props.marks);
  const variationRef = useRef(props.variation);
  const [ready, setReady] = useState(false);
  onAimRef.current = props.onAim;
  onConfirmRef.current = props.onConfirm;
  onDoubleTapRef.current = props.onDoubleTap;
  onClearAimRef.current = props.onClearAim;
  marksRef.current = props.marks;
  variationRef.current = props.variation;
  const view = imageryView(props.mode);
  const west = props.bounds?.[0];
  const south = props.bounds?.[1];
  const east = props.bounds?.[2];
  const north = props.bounds?.[3];
  const markKey = (props.marks ?? [])
    .map((mark) => `${mark.tone}:${mark.lon}:${mark.lat}`)
    .join("|");
  const variationKey = props.variation
    ? `${props.variation.pin.lon}:${props.variation.pin.lat}:${props.variation.spot.lon}:${props.variation.spot.lat}:${props.variation.kilometers}`
    : "";

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
        layers: [{ id: IMAGERY_SOURCE, type: "raster", source: IMAGERY_SOURCE }],
      },
      center,
      zoom: props.mode === "globe" ? 1.5 : 2,
      maxZoom: props.mode === "globe" ? 5 : undefined,
      maxBounds: bounds,
      attributionControl: false,
      dragRotate: props.mode === "globe",
      pitchWithRotate: props.mode === "globe",
      touchPitch: props.mode === "globe",
      renderWorldCopies: props.mode === "flat",
    });

    if (props.mode === "flat") map.touchZoomRotate.disableRotation();
    // doubleClickZoom stays enabled: double-click / double-tap zooms, never commits.

    // Per map instance: classifies a tap pair as one double-tap zoom gesture.
    const tracker = createTapTracker();

    map.on("click", (event) => {
      const tap = { x: event.point.x, y: event.point.y, t: performance.now() };
      if (tracker.register(tap) === "double-tap") {
        // Second half of a zoom gesture: place nothing, revert the first tap.
        onDoubleTapRef.current?.();
        return;
      }
      // R2: pointerType on the click's originalEvent is the reliable touch
      // signal — verified in Playwright touch emulation (compat click arrives
      // as a PointerEvent with pointerType "touch"; no touchstart-flag fallback).
      const touch =
        (event.originalEvent as PointerEvent | undefined)?.pointerType === "touch";
      // M3: the 42px lift applies to the PLACEMENT coordinate (port of
      // gesture.ts:3 TOUCH_LIFT via aimPoint), so the committed guess is the
      // point the player actually sees under their fingertip.
      const at = map.unproject([tap.x, touch ? tap.y - TOUCH_LIFT_PX : tap.y]);
      if (typeof navigator.vibrate === "function") navigator.vibrate(10);
      onAimRef.current?.(at.lng, at.lat);
    });
    // No dblclick handler: MapLibre must receive it to zoom. Never preventDefault it.

    map.on("load", () => {
      map.addSource(LINE_SOURCE, { type: "geojson", data: EMPTY });
      map.addSource(RING_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: RING_SOURCE,
        type: "line",
        source: RING_SOURCE,
        paint: {
          "line-color": "#f4f1ea",
          "line-width": 1.5,
          "line-opacity": 0.85,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: LINE_SOURCE,
        type: "line",
        source: LINE_SOURCE,
        paint: { "line-color": "#f2c14e", "line-width": 3 },
      });
      map.resize();
      if (bounds) map.fitBounds(bounds, { padding: 28, duration: 700, animate: true });
      paintVariation(map, variationRef.current ?? null, props.mode);
      setReady(true);
    });

    mapRef.current = map;
    markersRef.current = replaceMarks(map, marksRef.current, markersRef.current);

    return () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      labelRef.current?.remove();
      labelRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, [east, north, props.mode, south, view.attribution, view.projection, view.tiles, west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current = replaceMarks(map, marksRef.current, markersRef.current);
  }, [markKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    paintVariation(map, props.variation ?? null, props.mode);
  }, [props.mode, variationKey, props.variation]);

  function paintVariation(map: Map, variation: MapVariation | null, mode: "flat" | "globe") {
    labelRef.current?.remove();
    labelRef.current = null;
    if (!variation) {
      setFeature(map, LINE_SOURCE, null);
      setFeature(map, RING_SOURCE, null);
      return;
    }
    const line = variationLine(variation.pin, variation.spot, variation.kilometers);
    setFeature(map, LINE_SOURCE, line.coordinates);
    setFeature(map, RING_SOURCE, disk(variation.spot.lon, variation.spot.lat, variation.radiusKm));
    const label = document.createElement("div");
    label.textContent = line.label;
    label.style.background = "#101211";
    label.style.color = "#f4f1ea";
    label.style.border = "1px solid #f2c14e";
    label.style.borderRadius = "999px";
    label.style.padding = "2px 8px";
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.pointerEvents = "none";
    labelRef.current = new Marker({ element: label, anchor: "center" })
      .setLngLat(line.midpoint)
      .addTo(map);
    const westEdge = Math.min(variation.pin.lon, variation.spot.lon);
    const eastEdge = Math.max(variation.pin.lon, variation.spot.lon);
    const southEdge = Math.min(variation.pin.lat, variation.spot.lat);
    const northEdge = Math.max(variation.pin.lat, variation.spot.lat);
    map.fitBounds(
      [
        [westEdge, southEdge],
        [eastEdge, northEdge],
      ],
      { padding: 80, duration: 800, maxZoom: mode === "globe" ? 4 : 8 },
    );
  }

  return (
    <div className="satellite-map relative h-full min-h-64 w-full">
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 m-0 bg-black/60 px-2 py-1 text-left text-[11px] leading-snug text-white">
        {view.attribution}
      </p>
    </div>
  );
}
