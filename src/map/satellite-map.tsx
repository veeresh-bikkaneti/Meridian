import { useEffect, useReducer, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import { Map, Marker, type GeoJSONSource, type LngLat } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DropPinButton } from "@/components/drop-pin-button.tsx";
import { ZoomControls } from "@/components/zoom-controls.tsx";
import { disk } from "@/game/geo";
import { isHit } from "@/game/radius";
import { startGlobeSpin, stopGlobeSpin } from "@/game/audio/sfx";
import { playCelebrationSound, safePlay, soundAudible } from "@/game/audio/play-guards";
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
import { buildScoutStyle } from "./scout-style.ts";
import { ScoutFallbackMap } from "./scout-fallback.tsx";
import { isCoarsePointer, mapOptionsForDevice, SCOUT_MAX_ZOOM_FLAT, SCOUT_MAX_ZOOM_GLOBE } from "./map-options.ts";
import type { MapMode } from "./capability.ts";
import { emitTileFailed, emitWebglContextLost, recordMilestone, recordTileErrors } from "@/lib/observability";
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

/**
 * PBI-5: a captured map viewport for state-preserving remounts (the
 * webglcontextlost → Scout Map switch). Re-opens mid-SPACE — center, zoom
 * AND projection — instead of replaying the intro.
 */
export interface ScoutRestoreView {
  center: [number, number];
  zoom: number;
  projection: "globe" | "mercator";
}

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
  // Antimeridian-aware longitude span: a pin/spot pair straddling ±180°
  // (Fiji, Tonga, the Aleutians) must frame the short way around, not the
  // ~358° the naive min/max would produce.
  let westEdge = Math.min(variation.pin.lon, variation.spot.lon);
  let eastEdge = Math.max(variation.pin.lon, variation.spot.lon);
  if (eastEdge - westEdge > 180) {
    westEdge = Math.max(variation.pin.lon, variation.spot.lon);
    eastEdge = Math.min(variation.pin.lon, variation.spot.lon) + 360;
  }
  const southEdge = Math.min(variation.pin.lat, variation.spot.lat);
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
    // Hit vs miss drives the controller's light-confirmation vs gap-view branch.
    hit: isHit(variation.kilometers, variation.radiusKm),
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
  el.setAttribute("aria-label", spot ? "The spot" : tone === "aim" ? "Preview pin" : "Your pin");
  if (tone === "aim") {
    // F5: the preview pin is hollow/ghosted so it reads as a draft, visually
    // distinct from the solid committed pin. The drop animation + pulse ring
    // are transient affordances only (reduced motion kills both).
    el.style.background = "transparent";
    el.style.border = "2px dashed #f4f1ea";
    // The drop animates the CSS `translate` property (never `transform`):
    // MapLibre rewrites the marker element's inline transform on every
    // position update (maplibre-gl marker.ts `_update`), while `translate`
    // composes independently of it. Reduced motion kills both via the P0-02
    // section of styles.css (plus the global base-layer reduce rule).
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
  /**
   * Game map mode ("full" | "scout"). Defaults to "full" — the full-mode
   * construction path is byte-identical in behavior; every scout branch is
   * flag-guarded (PBI-2+). Owned by GameApp and threaded down as a prop;
   * the toggle never lives in here because this component unmounts on the
   * webglcontextlost teardown (PBI-5).
   */
  mapMode?: MapMode;
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
  /**
   * E2E hook (DOM contract, follows the data-zoom/data-tile-status pattern):
   * the current place's true-spot coordinates. The adapter exposes
   * `__spotScreen()` on the wrapper element, projecting the spot to
   * wrapper-relative CSS pixels through the live camera so specs can tap
   * exact spots deterministically (e.g. a guaranteed hit). Null when there
   * is no active place.
   */
  spot?: { lon: number; lat: number } | null;
  /**
   * Gap-view reveal: the controller emits `reveal-done` when the reveal
   * reaches its end state (played or skipped) — the app shows the result
   * card over the pin+spot framing (a hit leaves the camera where the pin
   * landed). Never fires before the reveal; the card must not appear
   * mid-choreography.
   */
  onRevealComplete?: () => void;
  /**
   * PBI-5: fired when the live map canvas loses its WebGL context, after
   * the observability emit. The owner (GameApp) switches to Scout Map and
   * remounts with `initialView` — no page reload, no game-state loss.
   * Only fires for full-mode mounts (an already-scout mount never
   * re-switches — the repeat-storm guard).
   */
  onWebglContextLost?: (view: ScoutRestoreView) => void;
  /**
   * PBI-5: re-open the map on this viewport instead of the intro
   * (the webglcontextlost switch's state preservation). Same shape and
   * semantics as the tile-Retry restore.
   */
  initialView?: ScoutRestoreView | null;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const labelRef = useRef<Marker | null>(null);
  const onAimRef = useRef(props.onAim);
  const onConfirmRef = useRef(props.onConfirm);
  const onClearAimRef = useRef(props.onClearAim);
  const onRevealCompleteRef = useRef(props.onRevealComplete);
  onRevealCompleteRef.current = props.onRevealComplete;
  // PBI-5: the contextlost callback is owner-wired (GameApp performs the
  // scout switch); read via ref so the canvas listener never goes stale.
  const onWebglContextLostPropRef = useRef(props.onWebglContextLost);
  onWebglContextLostPropRef.current = props.onWebglContextLost;
  const spotRef = useRef<{ lon: number; lat: number } | null>(null);
  spotRef.current = props.spot ?? null;
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
  // PBI-2: the game map mode for this mount ("full" | "scout"), set in the
  // construction effect. Read by PBI-5's webglcontextlost guard so an
  // already-scout mount never triggers a second switch.
  const mapModeRef = useRef<MapMode>("full");
  const dtoRef = useRef<RegionGeometryDTO | null>(null);
  const reducedMotionRef = useRef(false);
  const editionRef = useRef<"state" | "country" | "globe">(props.edition);
  const tapHandlersRef = useRef<{ attach(): void; detach(): void } | null>(null);
  const executeIntentsRef = useRef<(intents: ZoomSpaceIntent[]) => void>(() => {});
  // Reveal skip: the construction effect owns the canvas listeners;
  // the reveal routing effect arms/disarms them via this ref.
  const skipControlRef = useRef<{
    arm: () => void;
    disarm: () => void;
    trySkip: () => boolean;
  }>({
    arm: () => {},
    disarm: () => {},
    trySkip: () => false,
  });
  const prevVariationRef = useRef<MapVariation | null>(null);
  const [ready, setReady] = useState(false);
  // The intro opens at zoom 1.0 (Earth from space); zoomend keeps this fresh.
  const [zoom, setZoom] = useState(1);
  // Map center mirror for the DOM contract (data-center-lng/lat). Written on
  // moveend — cheap, stable between gestures, and precise enough (4 decimals
  // ≈ 11 m) for E2E drag assertions. data-zoom stays rounded for the existing
  // zoom-control consumers.
  const [center, setCenter] = useState({ lng: 0, lat: 0 });
  // moveend fires after every gesture — including pure zooms that leave the
  // center untouched. A fresh object on each firing would re-render on every
  // moveend; keep the previous state when the rounded DOM-contract values are
  // unchanged, matching the zoom mirror's bail-out behavior above.
  const setCenterIfMoved = (lng: number, lat: number) =>
    setCenter((prev) =>
      prev.lng.toFixed(4) === lng.toFixed(4) && prev.lat.toFixed(4) === lat.toFixed(4)
        ? prev
        : { lng, lat },
    );
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
  // PBI-3: scout mounts no tile sources, so the tile lifecycle is vacuous —
  // start at "ready" and skip all tile dispatches (flag-guarded below).
  // Full mode keeps the existing lifecycle exactly.
  const [tileStatus, dispatchTile] = useReducer(
    tileStatusReducer,
    props.mapMode === "scout" ? ({ kind: "ready" } as TileStatus) : INITIAL_TILE_STATUS,
  );
  const [mapAttempt, setMapAttempt] = useState(0);
  // Telemetry: one tile_failed event per failure episode so map outages
  // are visible in crash reporting (the failure card below is the trigger).
  useEffect(() => {
    if (tileStatus.kind === "failed") emitTileFailed();
  }, [tileStatus.kind]);

  /**
   * PBI-4: true when the scout outline render failed and the static SVG
   * fallback owns the map surface. The game (aim / commit / scoring)
   * proceeds unchanged on the fallback.
   */
  const [scoutFallback, setScoutFallback] = useState(false);

  // PBI-4: the static fallback has no map or camera — a committed pin
  // completes the reveal immediately (same honesty gate as the tileFailed
  // path), so scoring and rounds proceed unchanged.
  useEffect(() => {
    if (scoutFallback && props.variation) onRevealCompleteRef.current?.();
  }, [scoutFallback, props.variation]);

  // PBI-8: tile_failed counts ride the crash-report breadcrumb (suggestive
  // only — the settled constraint forbids switching on them).
  useEffect(() => {
    recordTileErrors(
      tileStatus.kind === "loading" || tileStatus.kind === "failed" ? tileStatus.tileErrors : 0,
    );
  }, [tileStatus]);
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
        // Reveal skip: if the gap-view reveal is playing (skip armed), Escape
        // jumps to the end state — the keyboard equivalent of tap-to-skip.
        if (skipControlRef.current.trySkip()) {
          e.preventDefault();
          break;
        }
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
    // PBI-5: the webglcontextlost switch passes the doomed map's viewport
    // in as `initialView`; it re-opens mid-SPACE exactly like the
    // tile-Retry restore (design §8).
    const restoreView: ScoutRestoreView | null = props.initialView ?? retryView;
    const isRestore = restoreView != null;

    // Resolve the atlas entry once per map instance. The polygon feeds the
    // highlight; camera math (settle framing, max bounds, big-miss) uses the
    // game's regions.ts box — the established game truth — because the
    // atlas DTO's naive bounds span the dateline for Alaska, and its naive
    // center lands in the Atlantic for France (overseas departments). The
    // center MUST be recomputed from the game box whenever it is provided.
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
    if (dto && props.bounds) {
      const [west, south, east, north] = props.bounds;
      dto = {
        ...dto,
        bounds: props.bounds,
        center: [(west + east) / 2, (south + north) / 2],
      };
    }
    dtoRef.current = dto;

    // Design §8: the restore path re-opens mid-SPACE. Projection and
    // maxBounds are constructor inputs (the style declares the projection —
    // setProjection throws before load, so it cannot run here) — the camera
    // is below. maxBounds re-lands from the game's regions.ts box when the
    // restored projection is flat; the intro path starts unbounded and the
    // narrow beat lands maxBounds at completion.
    const initialProjection = isRestore ? restoreView.projection : "globe";
    const initialMaxBounds =
      isRestore && restoreView.projection === "mercator" ? (dto?.bounds ?? undefined) : undefined;

    recordMilestone("map_init_start");
    // PBI-2: the game map mode is fail-closed to "full" — a missing or
    // unexpected value never changes the full-mode construction path.
    const mapMode: MapMode = props.mapMode === "scout" ? "scout" : "full";
    mapModeRef.current = mapMode;
    // Secondary jetsam mitigation: cap the WebGL canvas pixel ratio at
    // 1.5 on coarse-pointer (touch) devices and bound the tile cache —
    // see src/map/map-options.ts (unit-tested policy). Scout Map caps the
    // pixel ratio at 1 instead (PBI-2).
    const deviceMapOptions = mapOptionsForDevice({
      coarsePointer: isCoarsePointer(),
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : undefined,
      mapMode,
    });
    // PBI-4: construction can throw on a dead GL context — in scout mode
    // that drops to the static SVG fallback (the game stays playable);
    // full mode keeps the existing behavior (the error boundary owns it).
    let map: Map;
    try {
      map = new Map({
      container,
      ...(deviceMapOptions.pixelRatio !== undefined ? { pixelRatio: deviceMapOptions.pixelRatio } : {}),
      maxTileCacheSize: deviceMapOptions.maxTileCacheSize,
      style:
        // PBI-3: Scout Map mounts the label-free, tile-free outline style
        // (src/map/scout-style.ts) — no satellite raster sources at all.
        // Full mode keeps the existing imagery style exactly.
        mapMode === "scout"
          ? buildScoutStyle(initialProjection)
          : {
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
      center: isRestore ? restoreView.center : [0, 0],
      zoom: isRestore ? restoreView.zoom : 1,
      // PBI-2: Scout Map bounds zoom-space per projection (3 flat / 2 globe);
      // full mode keeps the existing behavior exactly.
      maxZoom:
        mapMode === "scout"
          ? edition === "globe"
            ? SCOUT_MAX_ZOOM_GLOBE
            : SCOUT_MAX_ZOOM_FLAT
          : edition === "globe"
            ? 5
            : undefined,
      maxBounds: initialMaxBounds,
      attributionControl: false,
      // Design §7: no gesture owns the map until the controller arms it.
      interactive: false,
      renderWorldCopies: props.mode === "flat",
      });
    } catch (err) {
      if (mapMode !== "scout") throw err;
      setScoutFallback(true);
      return;
    }
    projectionRef.current = initialProjection;
    maxBoundsRef.current = initialMaxBounds ?? null;
    mapRef.current = map;

    if (mapMode === "scout") {
      // PBI-4: the outline style has no external resources — any map error
      // is a real render failure, so drop to the static SVG fallback and
      // keep the game playable instead of stranding it on a dead canvas.
      map.on("error", () => setScoutFallback(true));
    }

    // Observability: a lost WebGL context is a field signal for GPU /
    // memory pressure — emit on the shared (endpoint-gated) path.
    // PBI-5: then hand the current viewport to the owner for the
    // state-preserving Scout Map switch. Only full-mode mounts switch —
    // an already-scout mount just reports (repeat-storm guard). The camera
    // getters are JS-side state, so they survive the dead canvas; guarded
    // so a failing read can never break the observability emit above.
    const onWebglContextLost = () => {
      emitWebglContextLost();
      try {
        if (mapModeRef.current !== "full") return;
        const owner = onWebglContextLostPropRef.current;
        if (!owner) return;
        const liveMap = mapRef.current;
        if (!liveMap) return;
        owner({
          center: liveMap.getCenter().toArray() as [number, number],
          zoom: liveMap.getZoom(),
          projection: projectionRef.current,
        });
      } catch {
        // best-effort: the context-lost signal itself was already emitted.
      }
    };
    try {
      map.getCanvas().addEventListener("webglcontextlost", onWebglContextLost);
    } catch {
      // Canvas unavailable — the map error boundary covers construction.
    }

    // E2E hook (DOM contract): project the current spot to wrapper-relative
    // CSS pixels through the live camera. Specs use it to tap exact spots
    // deterministically (e.g. a guaranteed hit). Returns null when there is
    // no active place. The closure reads spotRef/mapRef so it always sees
    // the current place and camera.
    const wrapperEl = wrapperRef.current!;
    (
      wrapperEl as unknown as {
        __spotScreen?: () => { x: number; y: number } | null;
      }
    ).__spotScreen = () => {
      const spot = spotRef.current;
      const liveMap = mapRef.current;
      if (!spot || !liveMap) return null;
      const p = liveMap.project([spot.lon, spot.lat]);
      const containerRect = liveMap.getCanvasContainer().getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      return {
        x: p.x + (containerRect.left - wrapperRect.left),
        y: p.y + (containerRect.top - wrapperRect.top),
      };
    };

    // E2E seam (mirrors __spotScreen): project an arbitrary lon/lat to
    // wrapper-relative screen coordinates so specs can tap deterministic
    // geographic points (e.g. a miss pin on a named place for the
    // pin-compare-line assertions). Inert in production.
    (
      wrapperEl as unknown as {
        __project?: (lon: number, lat: number) => { x: number; y: number } | null;
      }
    ).__project = (lon: number, lat: number) => {
      const liveMap = mapRef.current;
      if (!liveMap) return null;
      const p = liveMap.project([lon, lat]);
      const containerRect = liveMap.getCanvasContainer().getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      return {
        x: p.x + (containerRect.left - wrapperRect.left),
        y: p.y + (containerRect.top - wrapperRect.top),
      };
    };

    // Design §2: the starfield mounts behind the map container (first child
    // of the wrapper, own absolute positioning + dark fallback, canvases
    // pointer-events-none). The MapLibre canvas is alpha:true with no
    // background layer, so the stars show through wherever no tile paints.
    // PBI-3: no starfield in scout mode (GPU + compositor cost) — the
    // outline style's background layer is the backdrop instead.
    const destroyStarfield = mapMode === "scout" ? null : mountStarfield(wrapperRef.current!);

    // PBI-3: scout disables motion — scripted camera beats become instant
    // jumps (same treatment as prefers-reduced-motion).
    const controller = new ZoomSpaceController({
      edition,
      prefersReducedMotion: mapMode === "scout" ? true : reducedMotion,
    });
    controllerRef.current = controller;

    let alive = true;
    // Gap-view reveal skip: tap-to-skip is armed while the post-commit
    // reveal beat can run, disarmed on `reveal-done`.
    // The controller's skipChoreography() is a no-op outside that beat, so
    // a stray tap can never wedge the state machine.
    let skipArmed = false;
    let skipDown: { x: number; y: number } | null = null;

    /**
     * The closed intent vocabulary (design §1) — the only thing the
     * controller may ask the map to do. The switch is exhaustive: a new
     * intent the adapter does not know is a type error, never a silent
     * no-op.
     */
    const executeIntentsInner = (intents: ZoomSpaceIntent[]) => {
      if (!alive) return;
      // Shared by `paint-highlight` (narrow completion): the painter is
      // idempotent, so re-painting replays the gold flash. Same style-load
      const paintHighlight = (feature: RegionGeometryDTO) => {
        const instant = reducedMotionRef.current;
        const paint = () => {
          if (alive) paintRegionHighlight(map, feature, { instant });
        };
        try {
          paint();
        } catch (e) {
          if (!alive) return;
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("Style is not done loading")) {
            map.once("load", paint);
          } else {
            throw e;
          }
        }
      };
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
            // (expected for our inline style on the first tick — MapLibre
            // 6.11.2 defers _load() through browser.frameAsync — but safe
            // for any future remote style too).
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
              // The controller owns the reduced-motion policy (it emits jump-to
              // when the OS prefers reduced motion). MapLibre would otherwise
              // zero the duration behind the controller's back if the setting
              // changes mid-run, desyncing the beat lifecycle.
              essential: true,
            });
            break;
          }
          case "ease-to": {
            // No style-load gate: same rationale as fly-to above —
            // Camera#easeTo is transform-only. The tile-dependent gate
            // wedged reveal/relock beats when tiles hang.
            if (!alive) return;
            map.easeTo({
              center: intent.center,
              ...(intent.zoom !== undefined ? { zoom: intent.zoom } : {}),
              ...(intent.bearing !== undefined ? { bearing: intent.bearing } : {}),
              duration: intent.durationMs,
              easing: easeInOutCubic,
              // The controller owns the reduced-motion policy (it emits jump-to
              // when the OS prefers reduced motion). MapLibre would otherwise
              // zero the duration behind the controller's back if the setting
              // changes mid-run, desyncing the beat lifecycle.
              essential: true,
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
            // Sync the zoom state directly: jumpTo doesn't reliably fire
            // zoomend, and an interrupted fly-to (e.g. skipping mid-dive)
            // can fire a stale zoomend with the mid-animation zoom.
            setZoom(Math.round(intent.zoom));
            break;
          }
          case "paint-highlight": {
            paintHighlight(intent.feature);
            // Celebration audio (spec §3): the narrow-in landed — the
            // region's chart has arrived. This intent is emitted only at
            // narrow completion (zoom-space emits it nowhere else), so the
            // chime fires on the actual swap, never on a timer and never on
            // restore paths (which paint directly and bypass the executor).
            playCelebrationSound("toastChime");
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
            // PBI-3: scout has no tile phase — never leave the "ready" state.
            if (mapModeRef.current !== "scout") {
              dispatchTile({ type: "retry" });
              window.clearTimeout(watchdog);
              watchdog = window.setTimeout(() => {
                dispatchTile({ type: "load-timeout" });
              }, TILE_LOAD_TIMEOUT_MS);
            }
            break;
          }
          case "a11y-intro": {
            setIntroActive(intent.active);
            break;
          }
          case "announce": {
            // Clear-then-set: consecutive identical messages (e.g. two
            // misses in a row) would not re-announce if the text node
            // never changes.
            setAnnouncement("");
            requestAnimationFrame(() => {
              if (!alive) return;
              setAnnouncement(intent.message);
            });
            break;
          }
          case "spin": {
            if (intent.active) {
              startSpin(intent.speedDps ?? SPIN_SPEED_DPS);
              // Globe-spin audio DISABLED per Veeresh (2026-10-06): no swish
              // on spin. startGlobeSpin stays in sfx.ts (API preserved).
            } else {
              stopSpin();
              // stopGlobeSpin is a no-op safeguard (never started now).
              safePlay(stopGlobeSpin);
            }
            break;
          }
          case "reveal-done": {
            // The reveal reached its end state (played or skipped): the app
            // shows the result card over the pin+spot framing (a hit leaves
            // the camera where the pin landed). Disarm skip — the
            // choreography is over.
            disarmSkip();
            onRevealCompleteRef.current?.();
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

    // Tap-to-skip: a tap (not a drag) on the map canvas during the
    // post-commit reveal beat jumps to the reveal's end state. Taps on
    // interactive chrome (zoom buttons, etc.) are real controls, never skip.
    // The canvas container holds only the canvas + markers, so the guard is
    // belt-and-braces.
    const onSkipPointerDown = (e: PointerEvent) => {
      skipDown = { x: e.clientX, y: e.clientY };
    };
    const onSkipPointerUp = (e: PointerEvent) => {
      const down = skipDown;
      skipDown = null;
      if (!skipArmed || !alive || down === null) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 100) return; // 10 px — a drag is not a tap
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.("button, a, [role='button'], input, select, textarea")
      )
        return;
      const c = controllerRef.current;
      if (c) executeIntents(c.skipChoreography());
    };
    const armSkip = () => {
      if (skipArmed) return;
      skipArmed = true;
      const container = map.getCanvasContainer();
      container.addEventListener("pointerdown", onSkipPointerDown);
      container.addEventListener("pointerup", onSkipPointerUp);
    };
    const disarmSkip = () => {
      if (!skipArmed) return;
      skipArmed = false;
      skipDown = null;
      const container = map.getCanvasContainer();
      container.removeEventListener("pointerdown", onSkipPointerDown);
      container.removeEventListener("pointerup", onSkipPointerUp);
    };
    // Keyboard skip: Escape (or any key the wrapper routes here) during the
    // armed window jumps to the reveal's end state. Returns true if a skip ran.
    const trySkip = (): boolean => {
      if (!skipArmed || !alive) return false;
      const c = controllerRef.current;
      if (!c) return false;
      const intents = c.skipChoreography();
      if (intents.length === 0) return false;
      executeIntents(intents);
      return true;
    };
    skipControlRef.current = { arm: armSkip, disarm: disarmSkip, trySkip };

    // Celebration audio (spec §2.3): the player's first touch on the map
    // during the intro spin ends the ambient texture — the spin sound
    // belongs to the unattended intro, not to an interacting player.
    // stopGlobeSpin is a no-op when no loop is running, so the listener is
    // unconditional and never throws (safePlay belt-and-braces).
    const spinContainer = map.getCanvasContainer();
    const onIntroPointerUp = () => {
      safePlay(stopGlobeSpin);
    };
    spinContainer.addEventListener("pointerup", onIntroPointerUp);

    // Must-fix #2: tile load lifecycle (see tile-status.ts wiring contract).
    // Only TILE failures feed it: the "error" event also fires for
    // sprites/glyphs/sources, and a flaky glyph URL must never flip a
    // healthy map to failed. (ErrorEvent carries the failing tile at
    // runtime; it is not in the public type, hence the narrow cast.)
    // "load" fires when the style parses but tiles are still in flight
    // (NOT success); the first idle after the most recent retry is the
    // verdict on that tile set. The watchdog covers a style that never
    // loads at all (dead DNS / blocked host).
    // PBI-3: scout mounts no tile sources — the whole tile lifecycle
    // (verdict, watchdog, retry re-arm) is skipped. The style's "load"
    // event below still fires for the milestone + layer setup.
    let watchdog: number | undefined;
    if (mapMode !== "scout") {
      map.on("error", (e) => {
        if ((e as { tile?: unknown }).tile) dispatchTile({ type: "tile-error" });
      });
      // `let`: re-armed once the style parses (see the load handler below) so
      // the tile phase gets its own full budget.
      watchdog = window.setTimeout(() => {
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
    }

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
      } catch (e) {
        // Style not ready yet — the band paints on the next zoomend.
        // Persistent failures (corrupt data, API misuse) are logged in dev.
        if (import.meta.env.DEV) {
          console.warn("[boundary-bands] paint failed on zoomend:", e);
        }
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
      const c = map.getCenter();
      setCenterIfMoved(c.lng, c.lat);
      if (dispatchingIntentsRef.current) return;
      const ctl = controllerRef.current;
      if (!ctl) return;
      executeIntents(ctl.onMoveEnd(snapshot()));
      // A flushed queued reveal beat starts here (not via the React effect),
      // so arm tap-to-skip for it as well.
      if (ctl.beatKind === "reveal") skipControlRef.current.arm();
    });

    map.on("load", () => {
      recordMilestone("map_ready");
      // Must-fix #2: style parsed, tiles in flight — not a verdict either
      // way (the reducer treats map-load as a no-op; the first idle
      // decides). Recorded for contract fidelity with tile-status.ts.
      // PBI-3: scout has no tile phase — skip both dispatches.
      if (mapMode !== "scout") dispatchTile({ type: "map-load" });
      // Progressive boundary reveal (F2): paint the initial band for the
      // opening zoom. The style is parsed now, so addSource/addLayer are safe.
      try {
        paintBoundaryBand(map, bandForZoom(map.getZoom()));
      } catch (e) {
        // Non-fatal — the band paints on the next zoomend. Log in dev.
        if (import.meta.env.DEV) {
          console.warn("[boundary-bands] initial paint failed:", e);
        }
      }
      // The style parsed; the tile phase gets its own full watchdog budget
      // from here — a slow connection that trickles tiles must not trip
      // the style watchdog and declare failure over a healthy map.
      // PBI-3: no watchdog in scout mode (no tiles to wait for).
      if (mapMode !== "scout") {
        window.clearTimeout(watchdog);
        watchdog = window.setTimeout(() => {
          dispatchTile({ type: "load-timeout" });
        }, TILE_LOAD_TIMEOUT_MS);
      }
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
      const initialCenter = map.getCenter();
      setCenterIfMoved(initialCenter.lng, initialCenter.lat);
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
      skipControlRef.current = { arm: () => {}, disarm: () => {}, trySkip: () => false };
      controllerRef.current = null;
      tapHandlersRef.current = null;
      window.clearTimeout(watchdog);
      disarmSkip();
      stopSpin();
      // An unmount mid-intro must not leave the ambient loop playing.
      safePlay(stopGlobeSpin);
      spinContainer.removeEventListener("pointerup", onIntroPointerUp);
      // PBI-3: null in scout mode (starfield never mounted).
      destroyStarfield?.destroy();
      detachTapHandlers();
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      labelRef.current?.remove();
      labelRef.current = null;
      mapRef.current = null;
      setReady(false);
      try {
        map.getCanvas().removeEventListener("webglcontextlost", onWebglContextLost);
      } catch {
        // Canvas already gone with the map.
      }
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
  // controller's reveal beat — a hit completes synchronously (light
  // confirmation, no camera move); a miss eases to the pin+spot fit framing
  // (the gap view) and `reveal-done` tells the app to show the result card.
  // The camera beat is the controller's, not a local fitBounds. A tap on the
  // canvas during the miss beat skips it.
  // A non-null → null transition is the continue-to-next-place (or
  // run-done/menu) handoff: the documented ungated clear path
  // (clearReveal), the controller's per-place reset (resetForNextPlace),
  // then the return beat (beginReturn) easing the camera back out to the
  // region framing so the next question doesn't start at the gap-view
  // framing.
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
        // Continue → next place: the return beat eases the camera back out
        // to the region framing (reduced motion: jump cut) and re-arms the
        // tap pipeline for the aim phase on completion.
        executeIntentsRef.current(controller.beginReturn());
      }
      return;
    }
    // Reveal dispatch. Wrapped so a controller/dispatch exception can never
    // strand the game in "Showing the answer.": on any error the reveal is
    // completed immediately so the result card (and Next place) stays
    // reachable. The game-app reveal watchdog is the second net for the case
    // where dispatch succeeds but the beat itself never completes.
    try {
      const request = buildRevealRequest(
        map,
        props.variation,
        props.mode,
        tileStatusRef.current,
        projectionRef.current,
      );
      executeIntentsRef.current(controller.requestReveal(request));
      if (request.tileFailed) {
        // Honesty gate: no choreography over the error overlay — the reveal is
        // vacuous, so complete it immediately and show the result card.
        onRevealCompleteRef.current?.();
      } else if (controller.beatKind === "reveal") {
        // A reveal beat is running (animated miss): arm tap-to-skip. The hit
        // and reduced-motion paths complete synchronously — reveal-done already
        // fired in the same batch, so there is no beat left to skip and the
        // skip listener must not stay armed into the next aim phase. Note:
        // synchronous moveends fired during intent execution are swallowed by
        // the controller's event guard, so beatKind cannot clear before this
        // check — the hit/reduced-motion paths are the only ones that complete
        // synchronously, and they do so by emitting reveal-done directly.
        skipControlRef.current.arm();
      }
    } catch (error) {
      console.error(
        "[meridian] reveal dispatch failed; completing the reveal so the " +
          "game cannot deadlock in \"Showing the answer.\"",
        error,
      );
      onRevealCompleteRef.current?.();
    }
    // Effect deps: variationKey embeds the pin AND the true spot, so a new
    // place always produces a new key and triggers a reveal attempt — the
    // key cannot stay stale across places.
  }, [variationKey, props.mode, props.bounds]);

  return (
    <div
      ref={wrapperRef}
      className="satellite-map relative h-full min-h-64 w-full bg-[#0a1c26]"
      tabIndex={0}
      role="application"
      data-zoom={zoom}
      data-center-lng={center.lng.toFixed(4)}
      data-center-lat={center.lat.toFixed(4)}
      data-tile-status={tileStatus.kind}
      aria-roledescription="map"
      aria-label={
        scoutFallback
          ? "World outline map. Tap to place your pin, then use the Drop pin button. Arrow keys move the aim crosshair; Enter places the pin."
          : "Satellite map. Arrow keys move the aim crosshair. Enter or Space places the pin. Escape clears the pin, or skips the reveal while it plays."
      }
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
      {/*
        PBI-4: when the scout outline render fails, the static SVG fallback
        owns the map surface — same aim/commit/scoring flow, no camera.
      */}
      {scoutFallback ? (
        <ScoutFallbackMap
          marks={props.marks}
          spot={props.spot}
          revealed={props.variation != null}
          onAim={(lon, lat) => onAimRef.current?.(lon, lat)}
        />
      ) : (
        <div
          ref={containerRef}
          className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
          style={{ position: "absolute" }}
        />
      )}
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
              <p className="m-0 mt-2 text-white/80">
                Place data: GeoNames{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  CC-BY 4.0
                </a>
                {" · place history: Wikipedia "}
                <a
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  CC BY-SA
                </a>
              </p>
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

/**
 * Default export for React.lazy (see game-app.tsx). The lazy map chunk
 * keeps maplibre-gl and the atlas payloads out of the boot bundle (P0
 * Safari launch fix); the named export stays for existing importers.
 */
export default SatelliteMap;
