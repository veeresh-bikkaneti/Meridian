import { useEffect, useReducer, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import { Map, Marker, type GeoJSONSource, type LngLat } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DropPinButton } from "@/components/drop-pin-button.tsx";
import { ZoomControls } from "@/components/zoom-controls.tsx";
import { disk } from "@/game/geo";
import { IMAGERY_NOTICE, imageryView } from "./imagery.ts";
import { isTap, type PointerTapEndpoint } from "./pin-tap.ts";
import { clearRegionHighlight, paintRegionHighlight } from "./region-highlight.ts";
import { bandForZoom, clearBoundaryBands, paintBoundaryBand } from "./boundary-bands.ts";
import {
  buildRegionIndex,
  lookupRegion,
  type RegionGeometryDTO,
} from "./region-index.ts";
import { mountStarfield } from "./starfield.ts";
import { createTapTracker } from "./tap-tracker.ts";
import { INITIAL_TILE_STATUS, tileStatusReducer, type TileStatus } from "./tile-status.ts";
import { variationLine, type MapPoint } from "./variation.ts";
import {
  GLOBE_HOME,
  SPIN_DURATION_MS,
  SPIN_SPEED_DPS,
  ZoomSpaceController,
  type RevealRequest,
  type ZoomSnapshot,
  type ZoomSpaceIntent,
} from "./zoom-space.ts";

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

/**
 * Named bottom-padding constant (M8): the floating result card sits at the
 * bottom of the viewport, so the reveal framing reserves room for it and the
 * pin + spot are never hidden behind chrome.
 */
const REVEAL_CARD_PADDING_PX = 120;

/** Keeps the pre-existing padding-80 intent on the other three edges. */
const REVEAL_EDGE_PADDING_PX = 80;

/** Cubic ease-in-out for scripted camera beats (M8). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Must-fix #2: how long the style may take to load before the tile lifecycle
 * is declared failed. Covers a style that never loads at all (dead DNS /
 * blocked host) — without it the spinner would spin forever.
 */
const TILE_LOAD_TIMEOUT_MS = 15000;

/**
 * Region atlas index, built once per page load (design §3). The geometry
 * resolution (TopoJSON → RegionGeometryDTO) is the sibling crew's
 * region-index.ts; this cache just avoids rebuilding it per map mount.
 */
let regionIndexCache: globalThis.Map<string, RegionGeometryDTO> | null = null;
function getRegionIndex(): globalThis.Map<string, RegionGeometryDTO> {
  if (!regionIndexCache) regionIndexCache = buildRegionIndex();
  return regionIndexCache;
}

/**
 * Physical gesture model (design §7). The map constructs with
 * `interactive: false` so every handler starts disabled; the controller's
 * `gestures` intents re-arm exactly this set. `doubleClickZoom` stays
 * disabled (double-tap / double-click commits the pin) and MapLibre's
 * keyboard stays disabled (M6 crosshair owns the keys); `boxZoom` is
 * intentionally left out — it was never part of the game gesture model.
 * `pitchWithRotate` is absent from the public MapLibre 6.11.2 declarations,
 * so globe rotate/pitch is `dragRotate` + `touchPitch` (same effective
 * gestures the old `interactive: true` construction enabled).
 */
function setGameGestures(map: Map, edition: "state" | "country" | "globe", enabled: boolean): void {
  const handlers: { enable(): void; disable(): void }[] = [
    map.dragPan,
    map.scrollZoom,
    map.touchZoomRotate,
  ];
  if (edition === "globe") handlers.push(map.dragRotate, map.touchPitch);
  for (const handler of handlers) {
    if (enabled) handler.enable();
    else handler.disable();
  }
  if (enabled && edition !== "globe") map.touchZoomRotate.disableRotation();
}

/**
 * Backside dimming hook (design §5): while the projection is globe, markers
 * on the far side of the planet get the `is-backside` class. MapLibre v6
 * moved the transform off the public Map surface onto the internal camera
 * (Map#zoomIn delegates to `map._camera`), while `isLocationOccluded` itself
 * is public on the transform — hence the narrow structural cast. Re-verify
 * on upgrades. This must never throw: it runs inside map event handlers,
 * and a throw orphans the in-flight camera ease (observed: the first zoom-in
 * after the mercator→globe swap became a no-op because the ease's render
 * callback died on the first `move` event). The dimming rule for
 * `.is-backside` lives in the app CSS; the class toggle alone is the
 * adapter's contract.
 */
function updateMarkerOcclusion(
  map: Map,
  markers: readonly Marker[],
  projection: "globe" | "mercator",
): void {
  const globe = projection === "globe";
  // v6: the transform lives on the internal camera, not on Map itself.
  const transform = (
    map as unknown as {
      _camera?: { transform?: { isLocationOccluded(lngLat: LngLat): boolean } };
    }
  )._camera?.transform;
  for (const marker of markers) {
    const occluded =
      globe && transform
        ? transform.isLocationOccluded(marker.getLngLat())
        : false;
    marker.getElement().classList.toggle("is-backside", occluded);
  }
}

/**
 * Intro settle framing (design §4): fit the region bounds with 15% viewport
 * padding, capped per edition — never floored at 3.2, so large countries
 * settle below Z_GLOBE_OUT without bouncing. Camera math uses the game's
 * regions.ts box (the established game truth, passed in), not the atlas
 * DTO's naive dateline-spanning scan (Alaska's would fit a ~359° box).
 */
function computeSettleZoom(
  map: Map,
  bounds: [number, number, number, number],
  edition: "state" | "country",
): number {
  const cap = edition === "state" ? 6.5 : 5.0;
  map.resize();
  const el = map.getContainer();
  const pad = Math.max(0, Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.15));
  const camera = map.cameraForBounds(bounds, { padding: pad, maxZoom: cap });
  return Math.min(camera?.zoom ?? cap, cap);
}

/**
 * Reveal choreography inputs (design §6). The controller — never the caller
 * — classifies "big miss" from pin/spot geometry, so this only computes the
 * adapter-owned final framing: the existing M8 framing (card-aware padding,
 * maxZoom caps) translated to the center+zoom the controller consumes. The
 * variation payload is opaque to the controller; the adapter casts it back
 * to its own Variation type when executing paint-variation (design §1).
 */
function buildRevealRequest(
  map: Map,
  variation: MapVariation,
  mode: "flat" | "globe",
  tileStatus: TileStatus,
  projection: "globe" | "mercator",
): RevealRequest {
  const westEdge = Math.min(variation.pin.lon, variation.spot.lon);
  const southEdge = Math.min(variation.pin.lat, variation.spot.lat);
  const eastEdge = Math.max(variation.pin.lon, variation.spot.lon);
  const northEdge = Math.max(variation.pin.lat, variation.spot.lat);
  const camera = map.cameraForBounds(
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
      maxZoom: mode === "globe" ? 4 : 8,
    },
  );
  const fallbackCenter: [number, number] = [(westEdge + eastEdge) / 2, (southEdge + northEdge) / 2];
  // cameraForBounds types center as LngLatLike (possibly undefined);
  // normalize to a plain tuple for the controller.
  const rawCenter = camera?.center;
  const settleCenter: [number, number] = !rawCenter
    ? fallbackCenter
    : Array.isArray(rawCenter)
      ? [rawCenter[0], rawCenter[1]]
      : "lng" in rawCenter
        ? [rawCenter.lng, rawCenter.lat]
        : [rawCenter.lon, rawCenter.lat];
  return {
    variation,
    pin: [variation.pin.lon, variation.pin.lat],
    spot: [variation.spot.lon, variation.spot.lat],
    settleCenter,
    settleZoom: camera?.zoom ?? map.getZoom(),
    // Honesty gate: no choreography over the error overlay.
    tileFailed: tileStatus.kind === "failed",
    // Camera truth at request time (resyncs the controller's tracked
    // projection).
    projection,
  };
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
 * Variation painting only (design §6): the gold line, the dashed radius ring
 * and the distance label. The M8 camera beat used to live here; it now goes
 * through the controller's reveal beat (`requestReveal`), so this function
 * never touches the camera.
 */
function paintVariationLayers(
  map: Map,
  variation: MapVariation | null,
  labelRef: { current: Marker | null },
): void {
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
}

/**
 * Live Esri imagery. A tap places (or moves) a pin — propose only, never
 * commit. Double-tap / double-click drops the pin: the second tap's point
 * becomes the pin location, then it commits exactly like the Drop pin
 * button. The Drop pin button stays as the explicit, accessible commit path.
 * After the drop, a line shows how far the pin is from the spot.
 *
 * Z3/Z4 zoom-space (design §1/§4/§6): the map is a thin adapter over the
 * sibling crew's `ZoomSpaceController` (`src/map/zoom-space.ts`). The
 * controller owns the intro / narrow-in / threshold / reveal choreography and
 * emits a closed intent vocabulary; the adapter executes it (camera moves,
 * gesture arming, highlight painting, announcements) and feeds back one
 * `move` listener (+ `zoomend` / `moveend`). The adapter never makes camera
 * decisions of its own.
 */
export function SatelliteMap(props: {
  mode: "flat" | "globe";
  /** Game edition — drives the controller's thresholds and gesture model. */
  edition: "state" | "country" | "globe";
  /** Region display name, resolved against the vendored atlas index. */
  regionName: string;
  bounds?: [number, number, number, number]; // west, south, east, north
  onAim?: (lon: number, lat: number) => void;
  onConfirm?: (lon: number, lat: number) => void;
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
  const onClearAimRef = useRef(props.onClearAim);
  const marksRef = useRef(props.marks);
  const variationRef = useRef(props.variation);
  // Zoom-space adapter refs. The controller instance lives here (not in the
  // construction effect's closure) so the shared map listeners keep talking
  // to the current one across the continue-reset, which resets this same
  // instance via `resetForNextPlace()` for the next aim phase.
  const controllerRef = useRef<ZoomSpaceController | null>(null);
  const projectionRef = useRef<"globe" | "mercator">("globe");
  // Re-entrancy guard: while an intent batch is executing, MapLibre may
  // synchronously emit nested map events (projection migration perturbs the
  // camera transform). Those carry a half-applied camera state and must not
  // reach the controller — the batch's own snapshots reconverge tracking
  // when it completes. Set only via withoutControllerEvents (nesting-safe
  // save/restore + try/finally); the four map listeners check it directly.
  const dispatchingIntentsRef = useRef(false);
  const maxBoundsRef = useRef<[number, number, number, number] | null>(null);
  const dtoRef = useRef<RegionGeometryDTO | null>(null);
  const reducedMotionRef = useRef(false);
  const editionRef = useRef<"state" | "country" | "globe">(props.edition);
  const tapHandlersRef = useRef<{ attach(): void; detach(): void } | null>(null);
  const executeIntentsRef = useRef<(intents: ZoomSpaceIntent[]) => void>(() => {});
  const prevVariationRef = useRef<MapVariation | null>(null);
  const [ready, setReady] = useState(false);
  // The intro opens at zoom 1.0 (Earth from space); zoomend keeps this fresh.
  const [zoom, setZoom] = useState(1);
  // Design §7: the wrapper is aria-hidden + inert for the whole intro beat,
  // released at narrow completion.
  const [introActive, setIntroActive] = useState(true);
  // Zoom-space announcements (design §1): the controller's `announce`
  // intents post here, reusing the M10 sr-only live-region pattern.
  const [announcement, setAnnouncement] = useState("");
  // Must-fix #2: tile loading/failure UX. The reducer (tile-status.ts) is the
  // single source of truth for whether the initial tile set is loading,
  // ready, or failed; MapLibre events in the effect below map onto TileEvents
  // per that module's wiring contract. `mapAttempt` remounts the map for
  // Retry (the effect teardown removes the old instance).
  const [tileStatus, dispatchTile] = useReducer(tileStatusReducer, INITIAL_TILE_STATUS);
  const [mapAttempt, setMapAttempt] = useState(0);
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
  onClearAimRef.current = props.onClearAim;
  marksRef.current = props.marks;
  variationRef.current = props.variation;
  const tileStatusRef = useRef(tileStatus);
  tileStatusRef.current = tileStatus;
  const view = imageryView(props.mode);
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
  // prefers-reduced-motion (UX 4.6). MapLibre's own pinch/wheel zoom keeps
  // its default (also user-invoked) behavior; dblclick zoom is disabled —
  // double-tap / double-click commits the pin instead.
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ essential: true });
  };
  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ essential: true });
  };

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

    // Must-fix #2: every (re)mount starts a fresh tile lifecycle — a new map
    // instance means a new tile set, so reset even when the previous state
    // was ready/failed (mode switches, tile URL changes, Retry bumps).
    // On first mount this is a no-op (already the initial state).
    dispatchTile({ type: "retry" });

    const edition = props.edition;
    const reducedMotion = prefersReducedMotion();
    reducedMotionRef.current = reducedMotion;
    editionRef.current = edition;

    // Consume a stashed retry viewport once (set by handleRetryTiles): a
    // tile-Retry re-opens the SAME zoom-space state (design §8) — projection
    // and camera are restored, never replayed from the intro.
    const retryView = retryViewRef.current;
    retryViewRef.current = null;
    const isRestore = retryView != null;

    // Resolve the atlas entry once per map instance. The polygon feeds the
    // highlight; camera math (settle framing, max bounds, big-miss) uses the
    // game's regions.ts box — the established game truth — because the
    // atlas DTO's naive bounds span the dateline for Alaska.
    let dto: RegionGeometryDTO | null = lookupRegion(getRegionIndex(), props.regionName);
    if (!dto && props.bounds) {
      const [west, south, east, north] = props.bounds;
      dto = {
        id: props.regionName,
        name: props.regionName,
        bounds: props.bounds,
        center: [(west + east) / 2, (south + north) / 2],
        polygonCoords: { type: "MultiPolygon", coordinates: [] as number[][][][] },
      };
    }
    if (dto && props.bounds) dto = { ...dto, bounds: props.bounds };
    dtoRef.current = dto;

    // Design §8: the restore path re-opens mid-SPACE. Projection and
    // maxBounds are constructor inputs (the style declares the projection —
    // setProjection throws before load, so it cannot run here) — the camera
    // is below. maxBounds re-lands from the game's regions.ts box when the
    // restored projection is flat; the intro path starts unbounded and the
    // narrow beat lands maxBounds at completion.
    const initialProjection = isRestore ? retryView.projection : "globe";
    const initialMaxBounds =
      isRestore && retryView.projection === "mercator" ? (dto?.bounds ?? undefined) : undefined;

    const map = new Map({
      container,
      style: {
        version: 8,
        // Design §4: every edition opens from space — globe projection,
        // zoom 1.0. The flat editions swap to mercator mid-narrow-in.
        projection: { type: initialProjection },
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
      center: isRestore ? retryView.center : [0, 0],
      zoom: isRestore ? retryView.zoom : 1,
      maxZoom: edition === "globe" ? 5 : undefined,
      maxBounds: initialMaxBounds,
      attributionControl: false,
      // Design §7: no gesture owns the map until the controller arms it.
      interactive: false,
      renderWorldCopies: props.mode === "flat",
    });
    projectionRef.current = initialProjection;
    maxBoundsRef.current = initialMaxBounds ?? null;
    mapRef.current = map;

    // Design §2: the starfield mounts behind the map container (first child
    // of the wrapper, own absolute positioning + dark fallback, canvases
    // pointer-events-none). The MapLibre canvas is alpha:true with no
    // background layer, so the stars show through wherever no tile paints.
    const destroyStarfield = mountStarfield(wrapperRef.current!);

    const controller = new ZoomSpaceController({ edition, prefersReducedMotion: reducedMotion });
    controllerRef.current = controller;

    let alive = true;
    let holdTimer = 0;

    /**
     * The closed intent vocabulary (design §1) — the only thing the
     * controller may ask the map to do. The switch is exhaustive: a new
     * intent the adapter does not know is a type error, never a silent
     * no-op.
     */
    const executeIntentsInner = (intents: ZoomSpaceIntent[]) => {
      if (!alive) return;
      for (const intent of intents) {
        switch (intent.type) {
          case "set-projection": {
            // REQUIRED COMMENT (design §7): setProjection throws before
            // the style is PARSED (Style#_checkLoaded checks _loaded only),
            // not before tiles finish. isStyleLoaded() is tile-dependent:
            // when tile requests hang (dead DNS / captive portal), the
            // map's load event never fires and a deferred once("load")
            // handler never runs, wedging the intro mid-beat. Try the swap
            // immediately; defer only if the style truly isn't parsed yet
            // (impossible for our inline style — parsed synchronously in
            // `new Map()` — but safe for any future remote style).
            // The mid-beat swap below relies on MapLibre 6.11.2's
            // undocumented flyTo-transform closure behaviour — the in-flight
            // animation's transform closure reads the new projection, so the
            // camera continues to the same destination instead of snapping.
            // MUST be re-verified on every upgrade.
            const apply = () => {
              if (!alive) return;
              // Preserve the user's gesture position across the swap:
              // capture the pre-swap zoom and reassert it if migration
              // perturbed it. (Verified bit-identical on the clean path,
              // so this is a no-op there.) Guarded, so any nested map
              // events from the swap or the restore never reach the
              // controller — this also covers the deferred once("load")
              // path, which runs outside executeIntents' own guard.
              const preSwapZoom = map.getZoom();
              withoutControllerEvents(() => {
                map.setProjection({ type: intent.projection });
                if (map.getZoom() !== preSwapZoom) map.setZoom(preSwapZoom);
              });
              projectionRef.current = intent.projection;
            };
            try {
              apply();
            } catch {
              map.once("load", apply);
            }
            break;
          }
          case "set-max-bounds": {
            // Lands only at beat completion, never mid-beat: a mid-beat
            // setMaxBounds snaps via constrainInternal() (design §4).
            map.setMaxBounds(intent.bounds);
            maxBoundsRef.current = intent.bounds;
            break;
          }
          case "gestures": {
            setGameGestures(map, editionRef.current, intent.enabled);
            break;
          }
          case "tap-handlers": {
            if (intent.enabled) tapHandlersRef.current?.attach();
            else tapHandlersRef.current?.detach();
            break;
          }
          case "fly-to": {
            // No style-load gate: Camera#flyTo is transform-only (verified
            // against the vendored maplibre-gl 6.11.2 — it touches the
            // camera transform and fires movement events, never the style).
            // Gating it on the tile-dependent isStyleLoaded() caused a
            // never-fires stall: when tile requests hang, the map's load
            // event never fires, the deferred once("load") handler never
            // runs, and the narrow beat never starts — the intro wedges at
            // zoom 1 with the screen owned forever. The controller is already
            // in the narrow beat; no move/moveend can fire before the camera
            // moves, so the beat cannot complete early.
            if (!alive) return;
            map.flyTo({
              center: intent.center,
              zoom: intent.zoom,
              bearing: intent.bearing,
              duration: intent.durationMs,
              easing: easeInOutCubic,
            });
            break;
          }
          case "ease-to": {
            // No style-load gate: same rationale as fly-to above —
            // Camera#easeTo is transform-only. The tile-dependent gate
            // wedged pull-back/settle/relock beats when tiles hang.
            if (!alive) return;
            map.easeTo({
              center: intent.center,
              ...(intent.zoom !== undefined ? { zoom: intent.zoom } : {}),
              ...(intent.bearing !== undefined ? { bearing: intent.bearing } : {}),
              duration: intent.durationMs,
              easing: easeInOutCubic,
            });
            break;
          }
          case "jump-to": {
            // No style-load gate: Camera#jumpTo is transform-only (verified
            // against the vendored maplibre-gl 6.11.2 — it touches the
            // transform and fires movement events, never the style). Gating
            // it on isStyleLoaded() caused a never-fires race: the
            // reduced-motion intro emits jump-to synchronously after
            // `new Map()`, the deferred `once("load")` handler never ran, and
            // the map stayed at zoom 1 while the live region announced the
            // region view. Only set-projection / addSource / addLayer need
            // the gate (they throw pre-load).
            if (!alive) return;
            map.jumpTo({ center: intent.center, zoom: intent.zoom });
            break;
          }
          case "paint-highlight": {
            const feature = intent.feature;
            const instant = reducedMotionRef.current;
            const paint = () => {
              if (alive) paintRegionHighlight(map, feature, { instant });
            };
            // If the style isn't parsed yet (reduced-motion path paints in
            // the same tick as `new Map()`), addSource throws "Style is not
            // done loading". In that case the map is definitely not idle,
            // so `once("idle", paint)` will fire. If the style IS parsed
            // (animated path), paint immediately — we do NOT gate on the
            // tile-dependent isStyleLoaded(), which lost paints when `load`
            // had already fired (diagnosed 2026-09-30). The painter is
            // idempotent.
            try {
              paint();
            } catch {
              if (alive) map.once("idle", paint);
            }
            break;
          }
          case "clear-highlight": {
            clearRegionHighlight(map);
            break;
          }
          case "paint-variation": {
            // The payload is opaque to the controller; the adapter cast it
            // back to its own Variation type (design §1).
            paintVariationLayers(map, intent.variation as MapVariation | null, labelRef);
            break;
          }
          case "clear-variation": {
            paintVariationLayers(map, null, labelRef);
            break;
          }
          case "rearm-tiles": {
            // Design §8: the spin loads low-zoom world tiles; the narrow-in
            // must not inherit their verdict. The region's tile set gets its
            // own verdict + full 15 s watchdog budget — same producers as
            // the Retry button (see tile-status.ts).
            dispatchTile({ type: "retry" });
            window.clearTimeout(watchdog);
            watchdog = window.setTimeout(() => {
              dispatchTile({ type: "load-timeout" });
            }, TILE_LOAD_TIMEOUT_MS);
            break;
          }
          case "a11y-intro": {
            setIntroActive(intent.active);
            break;
          }
          case "announce": {
            setAnnouncement(intent.message);
            break;
          }
          case "spin": {
            if (intent.active) startSpin(intent.speedDps ?? SPIN_SPEED_DPS);
            else stopSpin();
            break;
          }
          case "reveal-hold": {
            // Design §6: the pull-back's moveend arms this one-shot hold; on
            // expiry the settle beat starts. beatActive stays set through
            // the hold, so a stray input cannot wedge the choreography.
            window.clearTimeout(holdTimer);
            holdTimer = window.setTimeout(() => {
              if (!alive) return;
              const c = controllerRef.current;
              if (c) executeIntents(c.onRevealHoldTimer());
            }, intent.durationMs);
            break;
          }
          default: {
            const _exhaustive: never = intent;
            throw new Error(`Unknown zoom-space intent: ${(_exhaustive as { type: string }).type}`);
          }
        }
      }
    };
    /**
     * Run `fn` with controller event forwarding suspended (nesting-safe:
     * save/restore, so an inner use never clears an outer guard early;
     * try/finally, so an exception can never leave it stuck). While the
     * flag is set, the four map listeners skip controller forwarding —
     * MapLibre may synchronously emit nested events with a half-applied
     * camera state (projection migration perturbs the transform), and those
     * must never re-enter the controller.
     */
    const withoutControllerEvents = (fn: () => void) => {
      const prev = dispatchingIntentsRef.current;
      dispatchingIntentsRef.current = true;
      try {
        fn();
      } finally {
        dispatchingIntentsRef.current = prev;
      }
    };
    /**
     * Guarded entry point: while an intent batch executes, the four map
     * listeners below skip controller forwarding (see
     * withoutControllerEvents), so a half-applied camera state can never
     * re-enter the controller. The batch's own snapshots reconverge
     * tracking when it completes.
     */
    const executeIntents = (intents: ZoomSpaceIntent[]) => {
      withoutControllerEvents(() => executeIntentsInner(intents));
    };
    executeIntentsRef.current = executeIntents;

    // --- Intro spin: the adapter owns the rAF loop + the 1200 ms timer ---
    // (design §4). Each setBearing fires a synchronous moveend (jumpTo
    // path); those arrive while beatKind is "spin" and the controller
    // ignores them.
    let spinRaf = 0;
    let spinTimer = 0;
    const stopSpin = () => {
      if (spinRaf) cancelAnimationFrame(spinRaf);
      if (spinTimer) window.clearTimeout(spinTimer);
      spinRaf = 0;
      spinTimer = 0;
    };
    const startSpin = (speedDps: number) => {
      stopSpin();
      let lastT = performance.now();
      const frame = (t: number) => {
        if (!alive) return;
        const dt = Math.max(0, (t - lastT) / 1000);
        lastT = t;
        map.setBearing(map.getBearing() + dt * speedDps);
        spinRaf = requestAnimationFrame(frame);
      };
      spinRaf = requestAnimationFrame(frame);
      spinTimer = window.setTimeout(() => {
        if (!alive) return;
        // Sibling contract: the 1200 ms timer always calls onSpinTimer();
        // the camera intents it returns (fly-to / set-projection) self-gate
        // on style load in the executor, and the rAF loop is already stopped
        // (the spin {active:false} intent executes immediately).
        executeIntents(controller.onSpinTimer());
      }, SPIN_DURATION_MS);
    };

    // Double-click / double-tap COMMITS the pin now (user-directed reversal
    // of the P0-02 "never commits" rule), so MapLibre's double-click zoom —
    // which also handles touch double-tap via synthesized dblclick — stays
    // disabled. Pinch/wheel zoom are unaffected.
    map.doubleClickZoom.disable();
    // M6: MapLibre's built-in keyboard handler is disabled; arrows drive the
    // crosshair (never pan), implemented in onMapKeyDown below.
    map.keyboard.disable();

    // Must-fix #2: tile load lifecycle (see tile-status.ts wiring contract).
    // Only TILE failures feed it: the "error" event also fires for
    // sprites/glyphs/sources, and a flaky glyph URL must never flip a
    // healthy map to failed. (ErrorEvent carries the failing tile at
    // runtime; it is not in the public type, hence the narrow cast.)
    // "load" fires when the style parses but tiles are still in flight
    // (NOT success); the first idle after the most recent retry is the
    // verdict on that tile set. The watchdog covers a style that never
    // loads at all (dead DNS / blocked host).
    map.on("error", (e) => {
      if ((e as { tile?: unknown }).tile) dispatchTile({ type: "tile-error" });
    });
    // `let`: re-armed once the style parses (see the load handler below) so
    // the tile phase gets its own full budget.
    let watchdog = window.setTimeout(() => {
      dispatchTile({ type: "load-timeout" });
    }, TILE_LOAD_TIMEOUT_MS);
    map.on("idle", () => {
      // First idle after the most recent retry is the verdict; later idles
      // (every camera move) are no-ops in the reducer — it returns the
      // identical state, so React bails out of re-rendering. Clearing the
      // watchdog here is hygiene.
      window.clearTimeout(watchdog);
      dispatchTile({ type: "map-idle" });
    });

    // Per map instance: classifies a tap pair as one double-tap COMMIT gesture.
    const tracker = createTapTracker();

    // Tap detection lives on raw pointerup, NOT click: pointerup is not a
    // compatibility event — it fires for both taps of a double-tap — and its
    // pointerType is reliable per-event. No preventDefault anywhere:
    // MapLibre keeps its drag/pinch/wheel zoom.
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
      // The tap point IS the answer: no touch lift. The old 42px lift
      // (pin visible under the fingertip) did not survive scrutiny — at
      // pointerup the finger is leaving the screen, so the pin was never
      // hidden, and every touch answer landed 42px above the fingertip.
      const at = map.unproject([tap.x, tap.y]);
      if (typeof navigator.vibrate === "function") navigator.vibrate(10);
      setCrosshair(null); // pointer/touch takes over from the keyboard crosshair
      if (tracker.register(tap) === "double-tap") {
        // Double-tap / double-click COMMITS (user-directed reversal of the
        // P0-02 "never commits" rule): the second tap's point becomes the pin
        // location, then it commits exactly like the Drop pin button — one
        // commit, no double-place. handleDrop's M12 guard still applies: with
        // no live aim mark there is no commit.
        onAimRef.current?.(at.lng, at.lat);
        handleDrop(at.lng, at.lat);
        return;
      }
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
    // The DOM pointer listeners attach only while the controller's
    // `tap-handlers` intent enables them (design §1/N1): never during the
    // intro beats, never after a terminal reveal. No dblclick handler of our
    // own: the commit comes from the pointerup pair classifier above, and
    // MapLibre's doubleClickZoom is disabled, so a dblclick neither zooms
    // nor double-commits. Never preventDefault it.
    const attachTapHandlers = () => {
      canvasContainer.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    };
    const detachTapHandlers = () => {
      canvasContainer.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
    tapHandlersRef.current = { attach: attachTapHandlers, detach: detachTapHandlers };

    // The ONE move listener (design §1): it carries the controller's T_OUT
    // direction latch, the narrow-in crossing swap, and the globe backside
    // occlusion. Thresholds are never evaluated
    // mid-gesture; the controller decides on zoomend/moveend.
    //
    // The zoomstart listener beside it is the T_OUT reachability fix: it fires
    // for wheel, pinch, +/- buttons, and keyboard zoom BEFORE any zoom delta
    // is applied, so the controller's maxBounds release lands before
    // MapLibre's defaultConstrain can pin the zoom at the bounds' fit floor.
    // Pure pans never fire zoomstart, so the region framing guardrail
    // survives them.
    const snapshot = (): ZoomSnapshot => ({
      zoom: map.getZoom(),
      projection: projectionRef.current,
      // The sibling's LngLat is a plain tuple; the map's is a class.
      center: map.getCenter().toArray(),
    });
    map.on("zoomstart", () => {
      // Re-entrancy guard: a nested zoomstart fired while an intent batch
      // is executing carries a half-applied camera state — never forward it.
      if (dispatchingIntentsRef.current) return;
      const c = controllerRef.current;
      if (c) executeIntents(c.onZoomStart());
    });
    map.on("move", () => {
      // Same guard for the controller half; marker occlusion is a pure
      // visual sync and still runs.
      if (!dispatchingIntentsRef.current) {
        const c = controllerRef.current;
        if (c) executeIntents(c.onMove(snapshot()));
      }
      updateMarkerOcclusion(map, markersRef.current, projectionRef.current);
    });
    map.on("zoomend", () => {
      // Track zoom for the +/- controls' aria-live announcements (M10).
      setZoom(Math.round(map.getZoom()));
      // Progressive boundary reveal (F2): update the admin-boundary band
      // for the new zoom. Static — no transitions (reduced-motion safe).
      try {
        paintBoundaryBand(map, bandForZoom(map.getZoom()));
      } catch {
        // Style not ready yet — the band paints on the next zoomend.
      }
      // Re-entrancy guard: a nested zoomend fired while an intent batch is
      // executing (e.g. from the projection-swap zoom restore) must not
      // re-enter the controller with a transitional camera state.
      if (dispatchingIntentsRef.current) return;
      const c = controllerRef.current;
      if (c) executeIntents(c.onZoomEnd(snapshot()));
    });
    map.on("moveend", () => {
      // Re-entrancy guard (see zoomend).
      if (dispatchingIntentsRef.current) return;
      const c = controllerRef.current;
      if (!c) return;
      executeIntents(c.onMoveEnd(snapshot()));
      // The reveal hold is armed by the `reveal-hold` intent the pull-back's
      // moveend returns (executor case above) — not here.
    });

    map.on("load", () => {
      // Must-fix #2: style parsed, tiles in flight — not a verdict either
      // way (the reducer treats map-load as a no-op; the first idle
      // decides). Recorded for contract fidelity with tile-status.ts.
      dispatchTile({ type: "map-load" });
      // Progressive boundary reveal (F2): paint the initial band for the
      // opening zoom. The style is parsed now, so addSource/addLayer are safe.
      try {
        paintBoundaryBand(map, bandForZoom(map.getZoom()));
      } catch {
        // Non-fatal — the band paints on the next zoomend.
      }
      // The style parsed; the tile phase gets its own full watchdog budget
      // from here — a slow connection that trickles tiles must not trip
      // the style watchdog and declare failure over a healthy map.
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        dispatchTile({ type: "load-timeout" });
      }, TILE_LOAD_TIMEOUT_MS);
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
      paintVariationLayers(map, variationRef.current ?? null, labelRef);
      if (isRestore && dtoRef.current) {
        // Tile-Retry re-opens mid-SPACE (design §8): the highlight repaints
        // instantly — there is no narrow beat to paint it.
        paintRegionHighlight(map, dtoRef.current, { instant: true });
      }
      setReady(true);
    });

    if (isRestore) {
      // Design §8: restore the exact zoom-space state — the camera,
      // projection, and maxBounds are already constructor inputs above, so
      // only the gesture model and tap handlers re-arm here. Never replays
      // the intro.
      setGameGestures(map, edition, true);
      // Post-commit the aim phase is over (design N1): a tile-Retry that
      // remounts mid-reveal (variation != null) must not re-arm the taps.
      if (!variationRef.current) attachTapHandlers();
      setIntroActive(false);
    } else if (edition === "globe") {
      // Degenerate narrow-in: spin, then ease home. No region, no swap, no
      // highlight — the controller owns the whole beat.
      executeIntents(controller.requestNarrow(null, GLOBE_HOME.zoom));
    } else if (dto) {
      const settleZoom = computeSettleZoom(map, dto.bounds, edition);
      executeIntents(controller.requestNarrow(dto, settleZoom));
      // Paint-highlight is emitted by the controller at narrow completion
      // (not at 70% of the beat — one fewer timer input per the sibling
      // contract); the 700 ms paint transition still lands the highlight as
      // the camera settles ("narrow → highlight → stop").
    }
    // else: flat edition with no resolvable region — degenerate; the map
    // sits non-interactive at globe zoom 1.0. Unreachable in practice
    // (game-app always supplies bounds for flat editions).

    return () => {
      alive = false;
      executeIntentsRef.current = () => {};
      controllerRef.current = null;
      tapHandlersRef.current = null;
      window.clearTimeout(watchdog);
      window.clearTimeout(holdTimer);
      stopSpin();
      destroyStarfield.destroy();
      detachTapHandlers();
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      labelRef.current?.remove();
      labelRef.current = null;
      mapRef.current = null;
      setReady(false);
      try {
        clearBoundaryBands(map);
      } catch {
        // Map already torn down — nothing to clear.
      }
      map.remove();
    };
  }, [props.edition, props.regionName, props.mode, props.bounds, mapAttempt]);

  // Must-fix #2: Retry resets the tile lifecycle and remounts the map (the
  // effect teardown above removes the old instance; `mapAttempt` retriggers
  // it). The overlay's own dispatch flips the UI back to the spinner
  // immediately; the effect-top reset is the belt-and-braces path.
  // Mash guard: recreating a WebGL map per click is expensive, so clicks
  // faster than human retry rhythm are ignored (security review).
  const retryAtRef = useRef(0);
  // Stashed zoom-space state for the remounted map (design §8): a tile-Retry
  // re-opens mid-SPACE — center, zoom AND projection — instead of replaying
  // the intro. maxBounds re-derives from the projection + region bounds.
  const retryViewRef = useRef<{
    center: [number, number];
    zoom: number;
    projection: "globe" | "mercator";
  } | null>(null);
  const handleRetryTiles = () => {
    const now = Date.now();
    if (now - retryAtRef.current < 800) return;
    retryAtRef.current = now;
    // Remember where the player was looking so the remounted map re-opens
    // on the same viewport and projection.
    const map = mapRef.current;
    if (map) {
      retryViewRef.current = {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        projection: projectionRef.current,
      };
    }
    dispatchTile({ type: "retry" });
    setMapAttempt((n) => n + 1);
    // The error card unmounts under the focused Retry button; move focus to
    // the map wrapper so keyboard/screen-reader users stay oriented while
    // the loading status announces.
    wrapperRef.current?.focus();
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current = replaceMarks(map, marksRef.current, markersRef.current);
    updateMarkerOcclusion(map, markersRef.current, projectionRef.current);
  }, [markKey]);

  // Reveal routing (design §6): variation arrival goes through the
  // controller's reveal beat — the controller classifies big-miss from
  // pin/spot geometry and emits pull-back + hold + settle (or a direct
  // settle); the camera beat is the controller's, not a local fitBounds.
  // A non-null → null transition is the continue-to-next-place (or
  // run-done/menu) handoff: the documented ungated clear path
  // (clearReveal), plus re-arming the aim gesture model for the next place.
  // The controller's per-place transient state is also reset here
  // (resetForNextPlace): the terminal revealDone latch must not leak into
  // the next place's aim phase, or the T_OUT / T_IN auto-thresholds would
  // stay inert after the first reveal. Run-scoped state — region, painted
  // highlight, projection tracking, camera continuity — is preserved.
  useEffect(() => {
    const map = mapRef.current;
    const controller = controllerRef.current;
    const prev = prevVariationRef.current;
    prevVariationRef.current = props.variation ?? null;
    if (!map || !controller) return;
    if (!props.variation) {
      executeIntentsRef.current(controller.clearReveal());
      if (prev) {
        // Continue → next place: reset the controller's per-place transient
        // state so the T_OUT / T_IN auto-thresholds evaluate again for the
        // new place's aim phase. Camera, region, highlight, and projection
        // tracking are preserved by the reset.
        executeIntentsRef.current(controller.resetForNextPlace());
        // Continue → next place: re-arm the tap pipeline for the aim phase.
        // (Tap attach/detach is adapter-owned DOM wiring; gestures were
        // re-enabled at settle completion.)
        executeIntentsRef.current([{ type: "tap-handlers", enabled: true }]);
      }
      return;
    }
    const request = buildRevealRequest(
      map,
      props.variation,
      props.mode,
      tileStatusRef.current,
      projectionRef.current,
    );
    executeIntentsRef.current(controller.requestReveal(request));
  }, [variationKey, props.mode, props.bounds]);

  return (
    <div
      ref={wrapperRef}
      className="satellite-map relative h-full min-h-64 w-full bg-[#0a1c26]"
      tabIndex={0}
      role="application"
      data-zoom={zoom}
      aria-roledescription="map"
      aria-label="Satellite map. Arrow keys move the aim crosshair. Enter or Space places the pin. Escape clears the pin."
      // Design §7: the intro beat owns the screen — the wrapper is hidden
      // from assistive tech and uninteractable until narrow completion
      // releases it (the `announce` intent then fires through the live
      // region below).
      aria-hidden={introActive || undefined}
      inert={introActive}
      onKeyDown={onMapKeyDown}
    >
      {/*
        The inline position below is load-bearing — it is NOT redundant with
        the `absolute` Tailwind class. MapLibre adds its own `maplibregl-map`
        class to this div, and maplibre-gl.css declares
        `.maplibregl-map { position: relative; overflow: hidden }` outside any
        cascade layer; unlayered author CSS beats Tailwind v4's layered
        `.absolute`, so the computed position becomes `relative`, this div's
        height collapses to 0 (all children are absolutely positioned), and the
        canvas is clipped invisible. Worse, MapLibre's native gesture handlers
        (wheel zoom, drag pan, pinch zoom) attach to the canvas container: real
        input hits the outer wrapper instead, so every native gesture dies
        while the app-level controls (+/- buttons, keyboard) keep working. An
        inline style outranks every stylesheet, layered or not — keep the
        inline style; do not merge it into the className.
      */}
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ position: "absolute" }}
      />
      {/* Must-fix #2: tile loading / failure UX. A dead imagery connection
          must never look like a working game. Both overlays sit at z-10:
          above the map canvas, below the Drop overlay (z-20), the crosshair
          (z-20), and the attribution pill (z-10 but later in the DOM) — so
          the game stays usable while the notice is shown. The roots are
          pointer-events-none (only the error card takes events) so taps
          around the chrome still reach the map. */}
      {tileStatus.kind === "loading" && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <div
            className={`flex items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-5 text-sm font-medium text-white ${CHROME}`}
          >
            <span
              aria-hidden="true"
              className="meridian-spinner block h-4 w-4 rounded-full border-2 border-white/25 border-t-white"
            />
            Loading satellite imagery…
          </div>
        </div>
      )}
      {tileStatus.kind === "failed" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[rgba(4,10,14,0.55)] p-4">
          <div
            role="alert"
            className={`pointer-events-auto w-full max-w-sm rounded-2xl p-5 text-center text-white ${CHROME}`}
          >
            <p className="m-0 text-sm font-semibold">Couldn't load satellite imagery.</p>
            <p className="m-0 mt-1 text-sm text-white/80">Check your connection and try again.</p>
            <button
              type="button"
              onClick={handleRetryTiles}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#0a1c26] transition-transform active:scale-95"
            >
              Retry
            </button>
          </div>
        </div>
      )}
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
      {/* Zoom-space announcements (design §1): the controller's `announce`
          intents post here — "Space view" / "<Region> view" at the threshold
          crossings — reusing the M10 sr-only live-region pattern. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {/* The Drop pin button is the explicit, accessible commit path
          (double-tap / double-click also commits). Hidden once committed
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
