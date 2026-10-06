import { useEffect, useRef, type JSX } from "react";
import { Map as MLMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { initialBearing } from "@/game/geo";
import { IMAGERY_TILES } from "@/map/imagery";
import { LOOP_LABELS_ATTRIBUTION, LOOP_LABELS_TILES } from "./map-labels";
import { buildPlaceGrid, nearestPlace, type PlaceGrid } from "./place-resolve";
import { destination, guessArrow, ringPolygon } from "./rings";
import { displayLoopName, fetchLoopIndex } from "./evaluate";
import type { LoopGuess, LoopNameEntry } from "./types";

/**
 * The Detective's Atlas: full-screen satellite + Esri reference labels,
 * the primary guess surface of the GeoDetective edition (Option A).
 *
 * - Tap a labeled place → the parent opens the confirm bottom sheet.
 *   Taps resolve against the guess index (place-resolve.ts); ocean/empty
 *   taps select nothing and raise the gentle hint instead.
 * - After each miss the map draws the deduction surface: an exact-km
 *   distance ring around the guessed place, a direction arrow toward the
 *   target, an ✕ marker, and a "searched" shading.
 * - On a finished day the target gets a gold star — the case-closed board.
 *
 * Deliberately NOT the endless-run satellite-map: that component is
 * coupled to the run state machine (zoom-space, reveal choreography).
 * The Loop owns a simpler map with its own gesture model.
 */

const SAT_SOURCE = "loop-satellite";
const LABEL_SOURCE = "loop-labels";
const RING_SOURCE = "loop-rings";
const ARROW_SOURCE = "loop-arrows";
const MARK_SOURCE = "loop-marks";

/** Detective gold — matches the answer-mark gold across editions. */
const GOLD = "#f2c14e";

/** Tap tolerance in screen px (matches the 44px touch target). */
const TAP_PX = 44;
/** …capped so a world-zoom tap can't resolve an ocean to a continent. */
const MAX_TAP_KM = 150;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface LoopMapHandle {
  /** Camera-jump: fly (or jump, under reduced motion) to a place. */
  flyToEntry(entry: LoopNameEntry): void;
}

interface LoopMapProps {
  guesses: LoopGuess[];
  target: { lon: number; lat: number };
  finished: boolean;
  /** Ref for the camera-jump search. */
  handleRef?: React.RefObject<LoopMapHandle | null>;
  onSelectPlace: (entry: LoopNameEntry) => void;
  onEmptyTap: () => void;
}

export function LoopMap({
  guesses,
  target,
  finished,
  handleRef,
  onSelectPlace,
  onEmptyTap,
}: LoopMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const gridRef = useRef<PlaceGrid | null>(null);
  const entriesRef = useRef<LoopNameEntry[] | null>(null);
  // Refs mirror the props the map event handlers need (the handlers are
  // registered once; refs keep them reading current values).
  const cbRef = useRef({ onSelectPlace, onEmptyTap, finished });
  cbRef.current = { onSelectPlace, onEmptyTap, finished };
  // Paint inputs ride a ref too: the style-load handler fires at an
  // arbitrary time, long after the mount effect's closure went stale.
  const paintRef = useRef({ guesses, target, finished });
  paintRef.current = { guesses, target, finished };

  // Preload the guess index on mount so the first tap resolves instantly.
  // fetchLoopIndex caches the promise; the jump search shares it.
  useEffect(() => {
    let cancelled = false;
    fetchLoopIndex()
      .then((entries) => {
        if (cancelled) return;
        entriesRef.current = entries;
        gridRef.current = buildPlaceGrid(entries);
      })
      .catch(() => {
        // Tap falls back to the hint until the index loads (retry on tap).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MLMap({
      container,
      style: {
        version: 8,
        sources: {
          [SAT_SOURCE]: {
            type: "raster",
            tiles: [IMAGERY_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
          },
          [LABEL_SOURCE]: {
            type: "raster",
            tiles: [LOOP_LABELS_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution: LOOP_LABELS_ATTRIBUTION,
          },
        },
        layers: [
          { id: SAT_SOURCE, type: "raster", source: SAT_SOURCE },
          { id: LABEL_SOURCE, type: "raster", source: LABEL_SOURCE },
        ],
      },
      center: [8, 28],
      zoom: 1.6,
      attributionControl: { compact: true },
      // Detective's gestures: pan + zoom only. No rotation (keeps the
      // evidence board north-up), no box zoom, double-click zoom stays.
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      boxZoom: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    // E2E seam (DOM contract, mirrors satellite-map's __spotScreen):
    // specs drive the camera deterministically through the live map.
    (container as unknown as { __loopMap?: MLMap }).__loopMap = map;

    const onClick = (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
      const { onSelectPlace, onEmptyTap, finished } = cbRef.current;
      if (finished) return;
      const grid = gridRef.current;
      const entries = entriesRef.current;
      if (!grid || !entries) {
        // Index still loading: retry the load, hint the player.
        fetchLoopIndex()
          .then((fresh) => {
            entriesRef.current = fresh;
            gridRef.current = buildPlaceGrid(fresh);
          })
          .catch(() => {});
        onEmptyTap();
        return;
      }
      // Pixel tolerance → km at the tap point, capped for world zoom.
      const edge = map.unproject([e.point.x + TAP_PX, e.point.y]);
      const dxKm = Math.abs(edge.lng - e.lngLat.lng) * 111.32 * Math.cos((e.lngLat.lat * Math.PI) / 180);
      const maxDistKm = Math.min(Math.max(dxKm, 8), MAX_TAP_KM);
      const hit = nearestPlace(grid, entries, e.lngLat.lng, e.lngLat.lat, maxDistKm);
      if (hit) onSelectPlace(hit);
      else onEmptyTap();
    };
    map.on("click", onClick);

    // Overlay sources + layers, added once the style loads. If the style
    // never loads (offline), the map stays interactive and taps still
    // resolve — the deduction surface just has nothing to draw on yet.
    map.on("load", () => {
      const addSource = (id: string) => {
        if (!map.getSource(id)) {
          map.addSource(id, { type: "geojson", data: EMPTY_FC });
        }
      };
      addSource(RING_SOURCE);
      addSource(ARROW_SOURCE);
      addSource(MARK_SOURCE);
      if (!map.getLayer("loop-ring-line")) {
        map.addLayer({
          id: "loop-ring-line",
          type: "line",
          source: RING_SOURCE,
          paint: { "line-color": GOLD, "line-width": 2.5, "line-opacity": 0.95 },
        });
      }
      if (!map.getLayer("loop-arrow-line")) {
        map.addLayer({
          id: "loop-arrow-line",
          type: "line",
          source: ARROW_SOURCE,
          layout: { "line-cap": "round" },
          paint: {
            "line-color": GOLD,
            "line-width": 3,
            "line-opacity": 0.95,
          },
        });
      }
      if (!map.getLayer("loop-searched")) {
        map.addLayer({
          id: "loop-searched",
          type: "circle",
          source: MARK_SOURCE,
          filter: ["==", ["get", "kind"], "searched"],
          paint: {
            "circle-radius": 16,
            "circle-color": "#ffffff",
            "circle-opacity": 0.14,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.5,
          },
        });
      }
      if (!map.getLayer("loop-xmark")) {
        map.addLayer({
          id: "loop-xmark",
          type: "symbol",
          source: MARK_SOURCE,
          filter: ["==", ["get", "kind"], "x"],
          layout: {
            "text-field": "✕",
            "text-size": 22,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 2,
          },
        });
      }
      if (!map.getLayer("loop-target-star")) {
        map.addLayer({
          id: "loop-target-star",
          type: "symbol",
          source: MARK_SOURCE,
          filter: ["==", ["get", "kind"], "target"],
          layout: {
            "text-field": "★",
            "text-size": 30,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": GOLD,
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 2,
          },
        });
      }
      paintOverlays();
    });

    return () => {
      map.off("click", onClick);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** (Re)draw rings, arrows, marks from the current guesses. Reads the
   * paint ref so the style-load handler always paints current state. */
  function paintOverlays() {
    const map = mapRef.current;
    if (!map || !map.getSource(RING_SOURCE)) return;
    const { guesses, target, finished } = paintRef.current;
    const ringFeatures: GeoJSON.Feature[] = [];
    const arrowFeatures: GeoJSON.Feature[] = [];
    const markFeatures: GeoJSON.Feature[] = [];
    for (const g of guesses) {
      if (g.lon === undefined || g.lat === undefined) continue;
      // Searched shading + ✕ for every guessed place.
      markFeatures.push({
        type: "Feature",
        properties: { kind: "searched" },
        geometry: { type: "Point", coordinates: [g.lon, g.lat] },
      });
      markFeatures.push({
        type: "Feature",
        properties: { kind: "x" },
        geometry: { type: "Point", coordinates: [g.lon, g.lat] },
      });
      if (g.distKm <= 0) continue; // win: no ring needed
      ringFeatures.push({
        type: "Feature",
        properties: { placeId: g.placeId },
        geometry: ringPolygon(g.lon, g.lat, g.distKm),
      });
      const bearing = initialBearing([g.lon, g.lat], [target.lon, target.lat]);
      if (bearing !== null) {
        const arrow = guessArrow(g.lon, g.lat, bearing, g.distKm);
        arrowFeatures.push(
          { type: "Feature", properties: {}, geometry: arrow.shaft },
          { type: "Feature", properties: {}, geometry: arrow.head },
        );
      }
    }
    if (finished) {
      markFeatures.push({
        type: "Feature",
        properties: { kind: "target" },
        geometry: { type: "Point", coordinates: [target.lon, target.lat] },
      });
    }
    (map.getSource(RING_SOURCE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ringFeatures,
    });
    (map.getSource(ARROW_SOURCE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: arrowFeatures,
    });
    (map.getSource(MARK_SOURCE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: markFeatures,
    });
  }

  // Repaint whenever the deduction surface changes.
  useEffect(() => {
    paintOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses, target, finished]);

  // Camera-jump handle for the search box.
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      flyToEntry(entry: LoopNameEntry) {
        const map = mapRef.current;
        if (!map) return;
        const center: [number, number] = [entry.lon, entry.lat];
        if (prefersReducedMotion()) {
          map.jumpTo({ center, zoom: Math.max(map.getZoom(), 5) });
        } else {
          map.flyTo({ center, zoom: Math.max(map.getZoom(), 5), duration: 1200 });
        }
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <div
      ref={containerRef}
      data-testid="loop-map"
      role="application"
      aria-label="Detective's map. Pan and zoom to explore labeled places. Double-tap a label area to pick a place."
      className="h-[52dvh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-line"
    />
  );
}

/** Screen-reader announcement for a freshly drawn ring. */
export function ringAnnouncement(guess: LoopGuess): string {
  const arrow = guess.octant.replace("-", " ");
  return `${guess.name}: ${Math.round(guess.distKm).toLocaleString("en-US")} km ${arrow} of the target.`;
}
