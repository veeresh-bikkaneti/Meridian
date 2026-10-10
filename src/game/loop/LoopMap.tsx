import { useEffect, useRef, type JSX } from "react";
import { Map as MLMap, Marker as MLMarker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { clampLat, formatDistance, initialBearing, normalizeLon } from "@/game/geo";
import { playCelebrationSound } from "@/game/audio/play-guards";
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
/** F11 overlap lens source (triple-intersection fill + centroid dot). */
const OVERLAP_SOURCE = "loop-overlap";

/** Detective gold — matches the answer-mark gold across editions. */
const GOLD = "#f2c14e";

/** Tap tolerance in screen px (matches the 44px touch target). */
const TAP_PX = 44;
/** …capped so a world-zoom tap can't resolve an ocean to a continent. */
const MAX_TAP_KM = 150;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Arrow-key nudge vectors: [dLon sign, dLat sign]. */
const KEY_NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

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

/**
 * Cold-Trail F11 overlap lens: the region where all locked player rings
 * overlap — "tap where they cross" needs a visible crossing. `polygon` is
 * a closed lon/lat ring (null when the rings share no common area, in
 * which case the centroid marker is the fallback anchor); `centroid`
 * anchors the one-time pulse. Computed from PLAYER centers only (I1) in
 * placement.ts — the true anchors never reach this prop.
 */
export interface TrailEvidenceOverlap {
  polygon: Array<[number, number]> | null;
  centroid: { lon: number; lat: number };
}

interface LoopMapProps {
  guesses: LoopGuess[];
  target: { lon: number; lat: number };
  finished: boolean;
  /** Ref for the camera-jump search. */
  handleRef?: React.RefObject<LoopMapHandle | null>;
  onSelectPlace: (entry: LoopNameEntry) => void;
  /** Empty tap; `indexLoading` when the place index isn't ready yet. */
  onEmptyTap: (indexLoading: boolean) => void;
  /**
   * Cold-Trail mode: taps report raw coordinates via onMapTap instead of
   * resolving to a labeled place, and no guess index is fetched. The
   * select/empty callbacks are never invoked in this mode.
   */
  freeTap?: boolean;
  onMapTap?: (lon: number, lat: number) => void;
  /** Cold-Trail evidence overlays (witness rings + marks). */
  evidenceRings?: TrailEvidenceRing[];
  evidenceMarks?: TrailEvidenceMark[];
  /** Cold-Trail F11 overlap lens (all rings locked, pre-reveal). */
  evidenceOverlap?: TrailEvidenceOverlap | null;
  /** Override the map's aria-label (default describes the loop's tap model). */
  mapLabel?: string;
  /**
   * Cold-Trail placement mode (optional; the loop edition never sets these).
   * While placementActive, map taps route to onPlacementTap (tap-to-move is
   * the primary adjust verb), the cursor becomes a crosshair, arrow keys
   * nudge the draft by a scale-aware step, and a draggable 🎯 marker renders
   * at placementDraft as progressive enhancement.
   */
  placementActive?: boolean;
  /** Tap while placementActive: position (or re-position) the draft ring. */
  onPlacementTap?: (lon: number, lat: number) => void;
  /** Draft ring center (player-tapped, unconfirmed); null hides the marker. */
  placementDraft?: { lon: number; lat: number } | null;
  /** Drag of the draft marker ended: adopt the marker's position as draft. */
  onPlacementDrag?: (lon: number, lat: number) => void;
  /** Arrow-key nudge while placementActive: absolute new draft center. */
  onPlacementNudge?: (lon: number, lat: number) => void;
}

export function LoopMap({
  guesses,
  target,
  finished,
  handleRef,
  onSelectPlace,
  onEmptyTap,
  freeTap,
  onMapTap,
  evidenceRings,
  evidenceMarks,
  evidenceOverlap,
  mapLabel,
  placementActive,
  onPlacementTap,
  placementDraft,
  onPlacementDrag,
  onPlacementNudge,
}: LoopMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const draftMarkerRef = useRef<MLMarker | null>(null);
  const draftMarkerAddedRef = useRef(false);
  // F11 overlap lens: one-time pulse marker + fired flag (reset when the
  // overlap clears, i.e. on the next case).
  const overlapPulseMarkerRef = useRef<MLMarker | null>(null);
  const overlapPulseDoneRef = useRef(false);
  const gridRef = useRef<PlaceGrid | null>(null);
  const entriesRef = useRef<LoopNameEntry[] | null>(null);
  // Last tap timestamp (performance.now): the ≥300 ms double-tap guard for
  // the pin-drop SFX below.
  const lastTapAtRef = useRef(0);
  // Refs mirror the props the map event handlers need (the handlers are
  // registered once; refs keep them reading current values). Written in an
  // effect, not during render (concurrent-mode safety).
  const cbRef = useRef({
    onSelectPlace,
    onEmptyTap,
    finished,
    freeTap,
    onMapTap,
    placementActive,
    onPlacementTap,
    onPlacementDrag,
    onPlacementNudge,
    placementDraft,
  });
  const paintRef = useRef({ guesses, target, finished, evidenceRings, evidenceMarks, evidenceOverlap, placementDraft });
  useEffect(() => {
    cbRef.current = {
      onSelectPlace,
      onEmptyTap,
      finished,
      freeTap,
      onMapTap,
      placementActive,
      onPlacementTap,
      onPlacementDrag,
      onPlacementNudge,
      placementDraft,
    };
    // Paint inputs ride a ref too: the style-load handler fires at an
    // arbitrary time, long after the mount effect's closure went stale.
    paintRef.current = { guesses, target, finished, evidenceRings, evidenceMarks, evidenceOverlap, placementDraft };
  });

  // Preload the guess index on mount so the first tap resolves instantly.
  // fetchLoopIndex caches the promise; the jump search shares it.
  // Cold-Trail free-tap mode needs no place index — skip the fetch.
  useEffect(() => {
    if (freeTap) return;
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
  }, [freeTap]);

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
      const { onSelectPlace, onEmptyTap, finished, freeTap, onMapTap, placementActive, onPlacementTap } =
        cbRef.current;
      if (finished) return;
      // Pin-drop SFX (celebration spec §2.1–§2.2): a tap is accepted when it
      // lands with the camera idle and ≥300 ms since the last tap. A tap
      // while the camera animates, a double-tap misfire (<300 ms), or a tap
      // on a spot with no labeled place is rejected — the soft page-turn
      // tick (500 ms suppress in the guard), never a buzzer — and selects
      // nothing. The Drop-pin commit stays silent by design (spec §3): the
      // ring answers next.
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const sinceLastTap = now - lastTapAtRef.current;
      lastTapAtRef.current = now;
      if (map.isMoving() || sinceLastTap < 300) {
        playCelebrationSound("pinDropFail");
        return;
      }
      if (placementActive) {
        // Cold-Trail placement mode: the tap IS the ring position — it
        // plants the draft (placing) or re-positions it (adjusting;
        // tap-to-move is the primary adjust verb). Routed AFTER the
        // camera-idle / ≥300 ms double-tap guard above, so accidental
        // double-taps are swallowed before they can jitter the draft.
        // Placement and the intercept guess are mutually exclusive in
        // TrailScreen, so this returns before the freeTap branch.
        if (onPlacementTap) {
          playCelebrationSound("pinDropPass");
          onPlacementTap(normalizeLon(e.lngLat.lng), clampLat(e.lngLat.lat));
        }
        return;
      }
      if (freeTap) {
        // Cold Trail: the tap IS the interception guess — raw coordinates,
        // no place resolution. The parent gates (rings placed?) and opens
        // the confirm sheet. Normalized like placement taps so stored and
        // rendered coords agree (MINOR: was raw, e.g. 190 for -170).
        if (onMapTap) {
          playCelebrationSound("pinDropPass");
          onMapTap(normalizeLon(e.lngLat.lng), clampLat(e.lngLat.lat));
        }
        return;
      }
      const grid = gridRef.current;
      const entries = entriesRef.current;
      if (!grid || !entries) {
        // Index still loading: retry the load, hint the player (the hint
        // says "loading", not "no place here" — the place may just not
        // have loaded yet).
        fetchLoopIndex()
          .then((fresh) => {
            entriesRef.current = fresh;
            gridRef.current = buildPlaceGrid(fresh);
          })
          .catch(() => {});
        onEmptyTap(true);
        return;
      }
      // Pixel tolerance → km at the tap point, capped for world zoom.
      // Both axes: in Web Mercator vertical pixels cover more km than
      // horizontal at high latitudes, so take the max.
      const edgeX = map.unproject([e.point.x + TAP_PX, e.point.y]);
      const edgeY = map.unproject([e.point.x, e.point.y + TAP_PX]);
      const dxKm =
        Math.abs(edgeX.lng - e.lngLat.lng) * 111.32 * Math.cos((e.lngLat.lat * Math.PI) / 180);
      const dyKm = Math.abs(edgeY.lat - e.lngLat.lat) * 111.32;
      const maxDistKm = Math.min(Math.max(dxKm, dyKm, 8), MAX_TAP_KM);
      const hit = nearestPlace(grid, entries, e.lngLat.lng, e.lngLat.lat, maxDistKm);
      if (hit) {
        // Accepted: the bottom sheet opens for the confirm (which burns the
        // guess and plays its own sound — this stamp is only the placement).
        playCelebrationSound("pinDropPass");
        onSelectPlace(hit);
      } else {
        // Rejected: ocean/empty tap — the map shrugs with the gentle hint.
        playCelebrationSound("pinDropFail");
        onEmptyTap(false);
      }
    };
    map.on("click", onClick);

    // Cold-Trail draft marker (placement mode only): a draggable 🎯 pin at
    // the unconfirmed draft center. Tap-to-move (map click) is the primary
    // adjust verb; this marker is progressive enhancement for drag.
    const draftEl = document.createElement("div");
    draftEl.style.width = "44px";
    draftEl.style.height = "44px";
    draftEl.style.display = "flex";
    draftEl.style.alignItems = "center";
    draftEl.style.justifyContent = "center";
    draftEl.style.fontSize = "26px";
    draftEl.style.cursor = "grab";
    // The drag must never pan the map underneath (walkthrough F5).
    draftEl.style.touchAction = "none";
    draftEl.textContent = "🎯";
    draftEl.setAttribute("aria-hidden", "true");
    const draftMarker = new MLMarker({ element: draftEl, draggable: true });
    draftMarkerRef.current = draftMarker;
    // F5 fingertip offset: while dragging, the marker rides ~24px above the
    // draft center so the finger doesn't occlude the point being placed.
    // getLngLat() is unaffected by the offset — the draft keeps the true
    // anchor, only the visual lifts.
    draftMarker.on("dragstart", () => {
      draftMarker.setOffset([0, -24]);
    });
    draftMarker.on("dragend", () => {
      draftMarker.setOffset([0, 0]);
      const cb = cbRef.current;
      if (!cb.placementActive || !cb.onPlacementDrag) return;
      const ll = draftMarker.getLngLat();
      cb.onPlacementDrag(normalizeLon(ll.lng), clampLat(ll.lat));
    });
    // Click-through fix: the marker is a DOM element above the canvas, so
    // taps landing on it never fire the map's click handler — which would
    // silently break tap-to-move at exactly the marker's spot. Route them
    // explicitly: a tap on the marker re-plants the draft at the tap point.
    // (After a real drag, a trailing click lands ~at the dragend point, so
    // this is a harmless no-op there.)
    // Routed through the same ≥300 ms double-tap guard as the map click
    // path (NIT: previously bypassed it, so a double-tap on the 🎯
    // re-planted the draft twice).
    draftEl.addEventListener("click", (ev) => {
      const cb = cbRef.current;
      if (!cb.placementActive || !cb.onPlacementTap) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const sinceLastTap = now - lastTapAtRef.current;
      lastTapAtRef.current = now;
      if (map.isMoving() || sinceLastTap < 300) {
        playCelebrationSound("pinDropFail");
        return;
      }
      ev.stopPropagation();
      const rect = container.getBoundingClientRect();
      const mouse = ev as MouseEvent;
      const ll = map.unproject([mouse.clientX - rect.left, mouse.clientY - rect.top]);
      playCelebrationSound("pinDropPass");
      cb.onPlacementTap(normalizeLon(ll.lng), clampLat(ll.lat));
    });

    // Arrow-key nudge for the draft (keyboard / low-motor path — required,
    // not nice-to-have). Reads cbRef so the once-registered listener always
    // sees the current draft. MapLibre's own keyboard pan is disabled while
    // placement is active (see the effect below) so arrows never do both.
    const onKeyDown = (e: KeyboardEvent) => {
      const cb = cbRef.current;
      if (!cb.placementActive) return;
      // Keyboard-only planting (P0 fix): with placement armed but no draft
      // yet, Enter/Space plants the draft at the map's current center.
      // Keyboard users could never plant the first ring — the arrow-key
      // nudge below requires an existing draft.
      if (!cb.placementDraft && cb.onPlacementTap && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
        const center = map.getCenter();
        playCelebrationSound("pinDropPass");
        cb.onPlacementTap(normalizeLon(center.lng), clampLat(center.lat));
        return;
      }
      if (!cb.placementDraft || !cb.onPlacementNudge) return;
      const step = KEY_NUDGE[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      // Scale-aware step: 2% of the visible map width in km, min 5 km. A
      // fixed km step is sub-pixel on a world view (25 km ≈ 0.8 px at
      // zoom 1.6). Converted to degrees at the draft latitude, clamped so
      // the draft can't leave the map.
      const lat = cb.placementDraft.lat;
      const bounds = map.getBounds();
      const widthKm =
        Math.max(1, bounds.getEast() - bounds.getWest()) *
        111.32 *
        Math.cos((lat * Math.PI) / 180);
      const stepKm = Math.max(5, 0.02 * widthKm);
      const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      const lon = normalizeLon(cb.placementDraft.lon + (step[0] * stepKm) / (111.32 * cosLat));
      const newLat = clampLat(cb.placementDraft.lat + (step[1] * stepKm) / 111.32);
      cb.onPlacementNudge(lon, newLat);
    };
    container.addEventListener("keydown", onKeyDown);

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
      addSource(OVERLAP_SOURCE);
      if (!map.getLayer("loop-ring-line")) {
        map.addLayer({
          id: "loop-ring-line",
          type: "line",
          source: RING_SOURCE,
          // Draft (preview) rings are excluded here — they render through
          // loop-ring-line-preview below. Loop-edition rings carry no
          // `preview` property, so this filter is a no-op for them.
          filter: ["!=", ["get", "preview"], true],
          paint: { "line-color": GOLD, "line-width": 2.5, "line-opacity": 0.95 },
        });
      }
      // Cold-Trail draft ring: dashed gold, slightly transparent — dashed =
      // "not locked yet" (shape-based, colorblind-safe).
      if (!map.getLayer("loop-ring-line-preview")) {
        map.addLayer({
          id: "loop-ring-line-preview",
          type: "line",
          source: RING_SOURCE,
          filter: ["==", ["get", "preview"], true],
          paint: {
            "line-color": GOLD,
            "line-width": 2,
            "line-opacity": 0.75,
            "line-dasharray": [6, 4],
          },
        });
      }
      // Exact-km label at each ring's northmost point: the map is a
      // self-contained deduction surface, no scrolling to the list needed.
      if (!map.getLayer("loop-ring-label")) {
        map.addLayer({
          id: "loop-ring-label",
          type: "symbol",
          source: RING_SOURCE,
          filter: ["==", ["get", "kind"], "ring-label"],
          layout: {
            "text-field": ["get", "label"],
            "text-size": 13,
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": GOLD,
            "text-halo-color": "rgba(0,0,0,0.9)",
            "text-halo-width": 2,
          },
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
      // Cold-Trail witness marks: gold dots at the PLAYER's locked ring
      // centers (never the true anchor pre-reveal — see TrailScreen's
      // buildEvidenceOverlays). They help kids track their three rings.
      if (!map.getLayer("loop-witness")) {
        map.addLayer({
          id: "loop-witness",
          type: "circle",
          source: MARK_SOURCE,
          filter: ["==", ["get", "kind"], "witness"],
          paint: {
            "circle-radius": 7,
            "circle-color": GOLD,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
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
      // F11 overlap lens (Cold Trail, all rings locked, pre-reveal): the
      // triple-intersection fill shows "where they cross". Static fill —
      // the pulse is a separate DOM marker, gated on reduced-motion.
      if (!map.getLayer("loop-overlap-fill")) {
        map.addLayer({
          id: "loop-overlap-fill",
          type: "fill",
          source: OVERLAP_SOURCE,
          filter: ["==", ["get", "kind"], "overlap"],
          paint: {
            "fill-color": GOLD,
            "fill-opacity": 0.28,
          },
        });
      }
      // (The disjoint-rings centroid dot was removed: no marker is drawn
      // when the rings share no common area.)
      paintOverlays();
    });

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      map.off("click", onClick);
      draftMarker.remove();
      draftMarkerRef.current = null;
      draftMarkerAddedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** (Re)draw rings, arrows, marks from the current guesses. Reads the
   * paint ref so the style-load handler always paints current state. */
  function paintOverlays() {
    const map = mapRef.current;
    if (!map || !map.getSource(RING_SOURCE) || !map.getSource(OVERLAP_SOURCE)) return;
    const { guesses, target, finished, evidenceRings, evidenceMarks, evidenceOverlap } = paintRef.current;
    const ringFeatures: GeoJSON.Feature[] = [];
    const arrowFeatures: GeoJSON.Feature[] = [];
    const markFeatures: GeoJSON.Feature[] = [];
    const overlapFeatures: GeoJSON.Feature[] = [];
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
      // Km label at the ring's northmost point (bearing 0 from the guess).
      ringFeatures.push({
        type: "Feature",
        properties: { kind: "ring-label", label: formatDistance(g.distKm) },
        geometry: { type: "Point", coordinates: destination(g.lon, g.lat, 0, g.distKm) },
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
    // Cold-Trail evidence: witness rings (same ringPolygon geometry as the
    // loop's deduction surface) with km labels, plus witness/guess marks.
    // Draft rings carry `preview: true` so they render through the dashed
    // preview layer instead of the solid ring layer.
    for (const r of evidenceRings ?? []) {
      ringFeatures.push({
        type: "Feature",
        properties: r.preview ? { preview: true } : {},
        geometry: ringPolygon(r.lon, r.lat, r.radiusKm),
      });
      ringFeatures.push({
        type: "Feature",
        properties: { kind: "ring-label", label: r.label },
        geometry: { type: "Point", coordinates: destination(r.lon, r.lat, 0, r.radiusKm) },
      });
    }
    for (const m of evidenceMarks ?? []) {
      markFeatures.push({
        type: "Feature",
        properties: { kind: m.kind },
        geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      });
    }
    // F11 overlap lens: the triple-intersection fill when the three locked
    // rings share a common area. When they are disjoint there is NO
    // meaningful center — the centroid dot is suppressed (a marker there
    // would read as a fake "answer" point). The rings stay visible so the
    // player can see their placements and adjust.
    if (evidenceOverlap?.polygon && evidenceOverlap.polygon.length >= 4) {
      overlapFeatures.push({
        type: "Feature",
        properties: { kind: "overlap" },
        geometry: { type: "Polygon", coordinates: [evidenceOverlap.polygon] },
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
    (map.getSource(OVERLAP_SOURCE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: overlapFeatures,
    });
  }

  /** Sync the draggable draft marker with placementDraft. DOM markers don't
   * need the style to be loaded, so placement works even when tiles are
   * unreachable (offline) — unlike paintOverlays, which early-returns. */
  function syncDraftMarker() {
    const map = mapRef.current;
    const marker = draftMarkerRef.current;
    if (!map || !marker) return;
    const draft = paintRef.current.placementDraft;
    if (draft) {
      marker.setLngLat([draft.lon, draft.lat]);
      if (!draftMarkerAddedRef.current) {
        marker.addTo(map);
        draftMarkerAddedRef.current = true;
      }
    } else if (draftMarkerAddedRef.current) {
      marker.remove();
      draftMarkerAddedRef.current = false;
    }
  }

  /**
   * F11 one-time pulse: when the overlap lens first appears (all 3 rings
   * locked), a single expanding gold ring pings at the overlap centroid to
   * draw the eye to "where they cross". Fires once per case — the done flag
   * resets when the overlap clears (next case). Suppressed under
   * prefers-reduced-motion: the static fill lens carries the meaning alone.
   * The pulse is aria-hidden and pointer-events-none: pure visual signal.
   */
  function syncOverlapPulse() {
    const map = mapRef.current;
    if (!map) return;
    const overlap = paintRef.current.evidenceOverlap;
    // No pulse when the rings are disjoint: there is no crossing to
    // highlight, and pulsing the centroid would imply a fake answer point.
    if (!overlap?.polygon || overlap.polygon.length < 4) {
      overlapPulseDoneRef.current = false;
      if (overlapPulseMarkerRef.current) {
        overlapPulseMarkerRef.current.remove();
        overlapPulseMarkerRef.current = null;
      }
      return;
    }
    if (overlapPulseDoneRef.current || prefersReducedMotion()) return;
    overlapPulseDoneRef.current = true;
    const el = document.createElement("div");
    el.className = "ct-overlap-pulse";
    el.setAttribute("aria-hidden", "true");
    const marker = new MLMarker({ element: el });
    marker.setLngLat([overlap.centroid.lon, overlap.centroid.lat]).addTo(map);
    overlapPulseMarkerRef.current = marker;
    window.setTimeout(() => {
      marker.remove();
      if (overlapPulseMarkerRef.current === marker) overlapPulseMarkerRef.current = null;
    }, 2000);
  }

  // Repaint whenever the deduction surface changes.
  useEffect(() => {
    paintOverlays();
    syncDraftMarker();
    syncOverlapPulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses, target, finished, evidenceRings, evidenceMarks, evidenceOverlap, placementDraft]);

  // While placement is active, MapLibre's own keyboard pan is disabled so
  // arrow keys nudge the draft (handled above) instead of panning the map.
  // The crosshair cursor is set on MapLibre's canvas element itself:
  // MapLibre's stylesheet gives .maplibregl-canvas its own cursor (grab),
  // which defeats any cursor class on our container div.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (placementActive) {
      map.keyboard.disable();
      map.getCanvas().style.cursor = "crosshair";
    } else {
      map.keyboard.enable();
      map.getCanvas().style.cursor = "";
    }
  }, [placementActive]);

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
      // Focusable while placement is active: entering placement moves focus
      // here so Enter/Space plants the draft and arrow keys nudge it
      // (keyboard path, WCAG 2.4.3). tabIndex 0 (not -1) so keyboard users
      // who tab away mid-placement can tab back to the map.
      tabIndex={placementActive ? 0 : undefined}
      aria-label={
        mapLabel ??
        "Detective's map. Pan and zoom to explore labeled places. Double-tap a label area to pick a place."
      }
      className={
        "h-[52dvh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-line" +
        (placementActive
          ? " focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          : "")
      }
    />
  );
}

/** Screen-reader announcement for a freshly drawn ring.
 * The octant is the TARGET's direction from the guess (same convention as
 * the guess list's aria-labels) — phrase it that way, not inverted. */
export function ringAnnouncement(guess: LoopGuess): string {
  const arrow = guess.octant.replace("-", " ");
  return `${guess.name}: the target is ${Math.round(guess.distKm).toLocaleString("en-US")} km ${arrow} of your guess.`;
}
