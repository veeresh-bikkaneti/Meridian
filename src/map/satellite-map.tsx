import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import { Map, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DropPinButton } from "@/components/drop-pin-button.tsx";
import { ZoomControls } from "@/components/zoom-controls.tsx";
import { disk } from "@/game/geo";
import { IMAGERY_NOTICE, imageryView } from "./imagery.ts";
import { TOUCH_LIFT_PX, isTap, type PointerTapEndpoint } from "./pin-tap.ts";
import { createTapTracker } from "./tap-tracker.ts";
import { variationLine, type MapPoint } from "./variation.ts";

const IMAGERY_SOURCE = "imagery";
const LINE_SOURCE = "variation-line";
const RING_SOURCE = "variation-ring";

// Frosted chrome token shared by the floating aim/reveal chrome (mirrors
// question-bubble.tsx / result-card.tsx).
const CHROME =
  "backdrop-blur-[14px] bg-[rgba(10,12,16,0.72)] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

export type MapMark = { lon: number; lat: number; tone: "aim" | "pin" | "spot" };

export type MapVariation = {
  pin: MapPoint;
  spot: MapPoint;
  kilometers: number;
  radiusKm: number;
};

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * Reduced-motion gate (P0-02): scripted camera moves become instant jumps.
 * Guarded for SSR / no-window. MapLibre also honors this internally when
 * `essential` is omitted (camera.ts), but the gate is explicit per design.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Reveal camera: ONE single beat framing pin + spot (M8), 2-2.5s. */
const REVEAL_CAMERA_MS = 2200;

/**
 * Named bottom-padding constant (M8): the floating result card sits at the
 * bottom of the viewport, so the reveal framing reserves room for it and the
 * pin + spot are never hidden behind chrome.
 */
const REVEAL_CARD_PADDING_PX = 120;

/** Keeps the pre-existing padding-80 intent on the other three edges. */
const REVEAL_EDGE_PADDING_PX = 80;

/** Cubic ease-in-out for the reveal beat (M8). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  if (tone === "aim") {
    // P0-02: pin-drop animation + exactly one pulse ring. The drop animates
    // the CSS `translate` property (never `transform`): MapLibre rewrites the
    // marker element's inline transform on every position update
    // (maplibre-gl marker.ts `_update`), while `translate` composes
    // independently of it. Reduced motion kills both via the P0-02 section
    // of styles.css (plus the global base-layer reduce rule).
    el.classList.add("meridian-pin-drop");
    const ring = document.createElement("div");
    ring.className = "meridian-pulse-ring";
    ring.setAttribute("aria-hidden", "true");
    el.appendChild(ring);
  }
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
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const [zoom, setZoom] = useState(props.mode === "globe" ? 1.5 : 2);
  // Keyboard crosshair (M6): null = hidden. Shown on first arrow press at
  // viewport center; hidden again as soon as pointer/touch is used.
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  // Attribution pill: collapsed "© Esri · ⓘ" expands to a popover with the
  // full attribution + pin-privacy notice. Closed whenever the reveal chrome
  // takes over (variation != null hides the pill entirely — see below).
  const [attrOpen, setAttrOpen] = useState(false);
  useEffect(() => {
    if (props.variation) setAttrOpen(false);
  }, [props.variation]);
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
  // The Drop pin button commits the live aim mark; null until a pin is placed.
  const aimMark = (props.marks ?? []).find((mark) => mark.tone === "aim");
  const aim = aimMark ? { lon: aimMark.lon, lat: aimMark.lat } : null;

  const handleDrop = (lon: number, lat: number) => {
    // Guard in the commit path (M12): only a live aim mark can commit, so a
    // rapid double-press can never commit twice (the first commit clears the
    // aim; the game-app phase guard is the second line of defense).
    const live = (marksRef.current ?? []).find((mark) => mark.tone === "aim");
    if (!live) return;
    onConfirmRef.current?.(lon, lat);
  };

  // User-invoked zoom: essential: true so it animates even under
  // prefers-reduced-motion (UX 4.6). MapLibre's own dblclick/pinch/wheel zoom
  // keeps its default (also user-invoked) behavior.
  const handleZoomIn = () => mapRef.current?.zoomIn({ essential: true });
  const handleZoomOut = () => mapRef.current?.zoomOut({ essential: true });

  // --- Keyboard aiming (M6: UX 2.5 wins over arch 3.5) ---
  // Arrows move a crosshair (16px, Shift+arrows 64px), clamped to the
  // viewport. Enter/Space places at the crosshair; the crosshair alone never
  // enables the Drop button (only onAim placements create the aim mark).
  const crosshairCenter = () => {
    const el = wrapperRef.current;
    return { x: (el?.clientWidth ?? 0) / 2, y: (el?.clientHeight ?? 0) / 2 };
  };
  const clampCrosshair = (p: { x: number; y: number }) => {
    const el = wrapperRef.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    return { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
  };

  const onMapKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Buttons handle their own keys: Space/Enter on the Drop button must not
    // also place a pin via the bubbled keydown.
    if ((e.target as HTMLElement | null)?.closest?.("button")) return;
    const map = mapRef.current;
    const step = e.shiftKey ? 64 : 16;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        e.preventDefault();
        setCrosshair((prev) => {
          const c = prev ?? crosshairCenter();
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          return clampCrosshair({ x: c.x + dx, y: c.y + dy });
        });
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (!map) break;
        const c = clampCrosshair(crosshair ?? crosshairCenter());
        setCrosshair(c);
        const at = map.unproject([c.x, c.y]);
        if (typeof navigator.vibrate === "function") navigator.vibrate(10);
        onAimRef.current?.(at.lng, at.lat);
        break;
      }
      case "Escape": {
        // M5: pin placed -> clear it via onClearAim. No pin -> nothing here;
        // the AIM_EMPTY bubble toggle is P0-03 chrome and can observe this
        // same keydown as it bubbles past the map wrapper.
        if ((marksRef.current ?? []).some((mark) => mark.tone === "aim")) {
          e.preventDefault();
          onClearAimRef.current?.();
        }
        break;
      }
      case "+":
      case "=":
        e.preventDefault();
        map?.zoomIn({ essential: true });
        break;
      case "-":
      case "_":
        e.preventDefault();
        map?.zoomOut({ essential: true });
        break;
    }
  };
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
    // M6: MapLibre's built-in keyboard handler is disabled; arrows drive the
    // crosshair (never pan), implemented in onMapKeyDown below.
    map.keyboard.disable();

    // Per map instance: classifies a tap pair as one double-tap zoom gesture.
    const tracker = createTapTracker();

    // Tap detection lives on raw pointerup, NOT click (P0-02 Option B): touch
    // double-tap zoom suppresses the second tap's compatibility click, so a
    // click-based tracker never observes tap two on touch. pointerup is not a
    // compatibility event — it fires for both taps — and its pointerType is
    // reliable per-event (resolves the old R2 as well). No preventDefault
    // anywhere: MapLibre keeps its drag/pinch/dblclick-zoom.
    const canvasContainer = map.getCanvasContainer();
    const activePointers = new Set<number>();
    let gestureDown: PointerTapEndpoint | null = null;
    let gestureClean = true;

    const toEndpoint = (e: PointerEvent): PointerTapEndpoint => {
      const rect = canvasContainer.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: performance.now(),
        pointerId: e.pointerId,
        button: e.button,
        isPrimary: e.isPrimary,
        pointerType: e.pointerType,
      };
    };
    const onPointerDown = (e: PointerEvent) => {
      if (activePointers.size === 0) {
        gestureDown = toEndpoint(e);
        gestureClean = true;
      } else {
        // A second concurrent pointer (pinch) voids the tap gesture.
        gestureClean = false;
      }
      activePointers.add(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      const down = gestureDown;
      const clean = gestureClean;
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        gestureDown = null;
        gestureClean = true;
      }
      if (!down || !clean) return;
      const up = toEndpoint(e);
      if (!isTap(down, up)) return;
      const tap = { x: up.x, y: up.y, t: up.t };
      if (tracker.register(tap) === "double-tap") {
        // Second half of a zoom gesture: place nothing, revert the first tap.
        onDoubleTapRef.current?.();
        return;
      }
      // M3: the 42px lift applies to the PLACEMENT coordinate (port of
      // gesture.ts:3 TOUCH_LIFT via aimPoint), so the committed guess is the
      // point the player actually sees under their fingertip. Lift unless mouse.
      const lift = up.pointerType === "mouse" ? 0 : TOUCH_LIFT_PX;
      const at = map.unproject([tap.x, tap.y - lift]);
      if (typeof navigator.vibrate === "function") navigator.vibrate(10);
      setCrosshair(null); // pointer/touch takes over from the keyboard crosshair
      onAimRef.current?.(at.lng, at.lat);
    };
    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      gestureClean = false;
      if (activePointers.size === 0) {
        gestureDown = null;
        gestureClean = true;
      }
    };
    // pointerdown is scoped to the map canvas; pointerup/pointercancel ride on
    // window so a release outside the canvas (MapLibre sets no pointer
    // capture) still closes the gesture instead of poisoning the next one.
    canvasContainer.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    // No dblclick handler: MapLibre must receive it to zoom. Never preventDefault it.

    // Track zoom for the +/- controls' aria-live announcements (M10).
    map.on("zoomend", () => setZoom(Math.round(map.getZoom())));

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
      setZoom(Math.round(map.getZoom()));
      if (bounds)
        map.fitBounds(bounds, {
          padding: 28,
          duration: prefersReducedMotion() ? 0 : 700,
          animate: true,
        });
      paintVariation(map, variationRef.current ?? null, props.mode);
      setReady(true);
    });

    mapRef.current = map;
    markersRef.current = replaceMarks(map, marksRef.current, markersRef.current);

    return () => {
      canvasContainer.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
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
    // M8: ONE camera beat per arrival (not a choreographed sequence): a single
    // fitBounds framing pin + spot, 2.2s easeInOut, with card-aware bottom
    // padding. Reduced motion -> instant jump. `essential` is omitted:
    // scripted moves never claim it (only user-invoked zoom does).
    map.fitBounds(
      [
        [westEdge, southEdge],
        [eastEdge, northEdge],
      ],
      {
        padding: {
          top: REVEAL_EDGE_PADDING_PX,
          bottom: REVEAL_CARD_PADDING_PX,
          left: REVEAL_EDGE_PADDING_PX,
          right: REVEAL_EDGE_PADDING_PX,
        },
        duration: prefersReducedMotion() ? 0 : REVEAL_CAMERA_MS,
        easing: easeInOutCubic,
        maxZoom: mode === "globe" ? 4 : 8,
      },
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="satellite-map relative h-full min-h-64 w-full"
      tabIndex={0}
      role="application"
      data-zoom={zoom}
      aria-roledescription="map"
      aria-label="Satellite map. Arrow keys move the aim crosshair. Enter or Space places the pin. Escape clears the pin."
      onKeyDown={onMapKeyDown}
    >
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {/* M6: keyboard crosshair ring at viewport center; pointer/touch hides it. */}
      {crosshair && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
          style={{ left: crosshair.x, top: crosshair.y }}
        />
      )}
      {/* Attribution as a collapsed "© Esri · ⓘ" pill that expands into a
          popover with the full attribution + pin-privacy notice. The old
          full-text bottom-left chip underlapped the Drop pin overlay and the
          result card (z-20), truncating the notice mid-word — a tiny pill
          provably cannot collide with anything, and the popover text wraps
          normally so it is never cut. Hidden while the reveal chrome is up
          (variation != null covers the result card AND its dismissed
          "Result" restore pill, both bottom-anchored z-20). */}
      {!props.variation && (
        <div
          className="pointer-events-none absolute bottom-2 left-2 z-10"
          onKeyDown={(e) => {
            // Close only when open, and don't let the keypress bubble to the
            // map root handler (which would also clear a placed aim pin).
            if (e.key === "Escape" && attrOpen) {
              e.stopPropagation();
              setAttrOpen(false);
            }
          }}
        >
          <button
            type="button"
            aria-expanded={attrOpen}
            aria-controls="meridian-attribution-popover"
            aria-label="Map attribution and privacy notice"
            onClick={() => setAttrOpen((v) => !v)}
            className={`pointer-events-auto flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-white ${CHROME}`}
          >
            <span aria-hidden="true">© Esri</span>
            <Info aria-hidden="true" size={16} />
          </button>
          {attrOpen && (
            <div
              id="meridian-attribution-popover"
              role="region"
              aria-label="Map attribution and privacy notice"
              className={`pointer-events-auto absolute bottom-full left-0 mb-6 w-[300px] max-w-[calc(100vw-24px)] rounded-2xl p-4 text-xs leading-relaxed text-white sm:mb-2 ${CHROME}`}
            >
              <p className="m-0">{view.attribution}</p>
              <p className="m-0 mt-2 text-white/80">{IMAGERY_NOTICE}</p>
            </div>
          )}
        </div>
      )}
      <ZoomControls zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      {/* The Drop pin button is the ONLY commit path. Hidden once committed
          (variation != null); the result card takes its place. Overlay root is
          pointer-events-none so taps around the chrome still reach the map. */}
      {!props.variation && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}
          >
            <DropPinButton aim={aim} onDrop={handleDrop} />
          </div>
        </div>
      )}
    </div>
  );
}
