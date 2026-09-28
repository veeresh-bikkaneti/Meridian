import { geoAlbersUsa, geoArea, geoContains, geoGraticule10, geoInterpolate, geoMercator, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import { feature, mesh } from "topojson-client";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { useEffect, useRef } from "react";
import world from "world-atlas/countries-50m.json";
import states from "us-atlas/states-10m.json";
import { Button } from "@/components/ui/button";
import type { LonLat, MapStyle, RingId } from "@/game/types";
import { terrainFor, type TerrainFeature } from "@/game/terrain";

type Feat = { id?: string; type: "Feature"; geometry: unknown };
type Collection = { type: "FeatureCollection"; features: Feat[] };

const countries = feature(world, world.objects.countries) as Collection;
const coast = mesh(world, world.objects.countries, (a, b) => a === b);
const countryBorders = mesh(world, world.objects.countries, (a, b) => a !== b);
const stateCollection = feature(states, states.objects.states) as Collection;
const nebraska = stateCollection.features.find((item) => item.id === "31") ?? null;
const graticule = geoGraticule10();

const LINCOLN: LonLat = [-96.69972, 40.81367];

type Mode = "globe" | "albers" | "mercator";

type View = {
  mode: Mode;
  width: number;
  height: number;
  scale: number;
  baseScale: number;
  center: LonLat;
  minScale: number;
  maxScale: number;
};

type Colors = {
  water: string;
  lake: string;
  land: string;
  park: string;
  road: string;
  highway: string;
  roadCase: string;
  river: string;
  border: string;
  coast: string;
  lit: string;
  pin: string;
  answer: string;
  arc: string;
  cross: string;
};

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    water: pick("--map-water", "#10262e"),
    lake: pick("--map-lake", "#1c5160"),
    land: pick("--map-land", "#3c4a3c"),
    park: pick("--map-park", "#2c5a40"),
    road: pick("--map-road", "#ddd6c8"),
    highway: pick("--map-highway", "#f3efe4"),
    roadCase: pick("--map-road-case", "#241f1a"),
    river: pick("--map-river", "#3c8496"),
    border: pick("--map-border", "#24302c"),
    coast: pick("--map-coast", "#0c1816"),
    lit: pick("--map-lit", "#6e9084"),
    pin: pick("--map-pin", "#f4f1ea"),
    answer: pick("--map-answer", "#8fb8c6"),
    arc: pick("--map-arc", "#f4f1ea"),
    cross: pick("--map-cross", "#d7ddd9"),
  };
}

function planarBounds(geometry: unknown): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      west = Math.min(west, node[0]);
      east = Math.max(east, node[0]);
      south = Math.min(south, node[1]);
      north = Math.max(north, node[1]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry);
  return [west, south, east, north];
}

function mercatorView(
  west: number,
  south: number,
  east: number,
  north: number,
  width: number,
  height: number,
): View {
  const center: LonLat = [(west + east) / 2, (south + north) / 2];
  const probe = geoMercator().scale(1).translate([0, 0]);
  const a = probe([west, south]);
  const b = probe([east, north]);
  const dx = Math.abs((b?.[0] ?? 1) - (a?.[0] ?? 0)) || 1;
  const dy = Math.abs((b?.[1] ?? 1) - (a?.[1] ?? 0)) || 1;
  const scale = Math.min((width - 48) / dx, (height - 48) / dy);
  return {
    mode: "mercator",
    width,
    height,
    scale,
    baseScale: scale,
    center,
    minScale: scale * 0.75,
    maxScale: scale * (east - west < 1 ? 18 : 10),
  };
}

function projectionFor(view: View): GeoProjection {
  if (view.mode === "globe") {
    return geoOrthographic()
      .translate([view.width / 2, view.height / 2])
      .scale(view.scale)
      .rotate([-view.center[0], -view.center[1], 0])
      .clipAngle(90)
      .precision(0.8);
  }
  if (view.mode === "albers") {
    const projection = geoAlbersUsa().translate([0, 0]).scale(view.scale);
    const xy = projection(view.center);
    if (!xy) return geoAlbersUsa().scale(view.scale).translate([view.width / 2, view.height / 2]);
    projection.translate([view.width / 2 - xy[0], view.height / 2 - xy[1]]);
    return projection;
  }
  const projection = geoMercator().translate([0, 0]).scale(view.scale).precision(0.2);
  const xy = projection(view.center);
  if (!xy) return projection.translate([view.width / 2, view.height / 2]);
  projection.translate([view.width / 2 - xy[0], view.height / 2 - xy[1]]);
  return projection;
}

function fitView(scope: RingId, width: number, height: number): View {
  if (scope === "world") {
    const scale = Math.min(width, height) * 0.46;
    return {
      mode: "globe",
      width,
      height,
      scale,
      baseScale: scale,
      center: [12, 18],
      minScale: scale * 0.92,
      maxScale: scale * 8,
    };
  }
  if (scope === "usa") {
    const fitted = geoAlbersUsa().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      stateCollection,
    );
    const scale = fitted.scale();
    const center = (fitted.invert?.([width / 2, height / 2]) as LonLat | null) ?? ([-97, 38] as LonLat);
    return { mode: "albers", width, height, scale, baseScale: scale, center, minScale: scale * 0.85, maxScale: scale * 8 };
  }
  const subject =
    scope === "nebraska" && nebraska
      ? planarBounds((nebraska as { geometry?: unknown }).geometry)
      : (() => {
          const radiusKm = scope === "lincoln" ? 15 : 80;
          const dLat = radiusKm / 110.574;
          const dLon = radiusKm / (111.32 * Math.cos((LINCOLN[1] * Math.PI) / 180));
          return [LINCOLN[0] - dLon, LINCOLN[1] - dLat, LINCOLN[0] + dLon, LINCOLN[1] + dLat] as [
            number,
            number,
            number,
            number,
          ];
        })();
  return mercatorView(subject[0], subject[1], subject[2], subject[3], width, height);
}

const wound = new WeakSet<TerrainFeature>();

function lineString(coordinates: LonLat[]) {
  return { type: "LineString" as const, coordinates };
}

function polygonOf(item: TerrainFeature) {
  const ring = item.coordinates;
  if (!wound.has(item)) {
    const geometry = { type: "Polygon" as const, coordinates: [ring] };
    if (geoArea(geometry) > Math.PI) ring.reverse();
    wound.add(item);
  }
  return { type: "Polygon" as const, coordinates: [ring] };
}

function fillPolys(
  context: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  items: TerrainFeature[],
  fill: string,
  shore: string | null,
) {
  if (!items.length) return;
  context.beginPath();
  for (const item of items) path(polygonOf(item));
  context.fillStyle = fill;
  context.fill();
  if (shore) {
    context.strokeStyle = shore;
    context.lineWidth = 0.7;
    context.stroke();
  }
}

function strokeLines(
  context: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  items: TerrainFeature[],
  stroke: string,
  width: number,
) {
  if (!items.length) return;
  context.beginPath();
  for (const item of items) path(lineString(item.coordinates));
  context.strokeStyle = stroke;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

function drawTerrain(
  context: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  features: TerrainFeature[],
  colors: Colors,
  roads: boolean,
) {
  fillPolys(
    context,
    path,
    features.filter((item) => item.kind === "park"),
    colors.park,
    null,
  );
  fillPolys(
    context,
    path,
    features.filter((item) => item.kind === "water"),
    colors.lake,
    colors.coast,
  );
  const rivers = features.filter((item) => item.kind === "river");
  strokeLines(context, path, rivers.filter((item) => item.rank < 2), colors.river, 1.1);
  strokeLines(context, path, rivers.filter((item) => item.rank >= 2), colors.river, 2.1);
  if (!roads) return;
  for (const kind of ["road", "highway"] as const) {
    for (const rank of [0, 1, 2, 3]) {
      const items = features.filter((item) => item.kind === kind && item.rank === rank);
      if (!items.length) continue;
      const inner = rank >= 3 ? 3.3 : rank === 2 ? 2.35 : rank === 1 ? 1.65 : 1.05;
      const casing = inner + (rank >= 2 ? 2.1 : 1.15);
      strokeLines(context, path, items, colors.roadCase, casing);
      strokeLines(context, path, items, kind === "highway" ? colors.highway : colors.road, inner);
    }
  }
}

function parseRgb(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  const match = hex.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function mix(a: string, b: string, t: number) {
  const pa = parseRgb(a);
  const pb = parseRgb(b);
  if (!pa || !pb) return t > 0.5 ? b : a;
  const u = Math.max(0, Math.min(1, t));
  return rgb(pa.map((channel, index) => channel + (pb[index] - channel) * u) as [number, number, number]);
}

function tone(id: string, base: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const shift = (hash % 9) - 4;
  const channels = parseRgb(base);
  if (!channels) return base;
  return rgb(channels.map((channel, index) => Math.max(0, Math.min(255, channel + (index === 2 ? -shift : shift)))) as [
    number,
    number,
    number,
  ]);
}

function smoothstep(t: number) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function spring01(seconds: number) {
  if (seconds <= 0) return 0;
  const stiffness = 180;
  const damping = 16;
  const omega = Math.sqrt(stiffness);
  const zeta = damping / (2 * omega);
  const decay = Math.exp(-zeta * omega * seconds);
  const wd = omega * Math.sqrt(Math.max(0.0001, 1 - zeta * zeta));
  return 1 - decay * (Math.cos(wd * seconds) + ((zeta * omega) / wd) * Math.sin(wd * seconds));
}

function drawGuessPin(context: CanvasRenderingContext2D, x: number, y: number, fill: string, drop: number) {
  const lift = 34 * (1 - Math.max(0, Math.min(1.08, drop)));
  context.save();
  context.translate(x, y - lift);
  context.globalAlpha = Math.min(1, Math.max(0, drop) * 1.6);
  context.shadowColor = "rgba(0,0,0,0.4)";
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  context.beginPath();
  context.moveTo(0, 2);
  context.bezierCurveTo(-11, -8, -8, -22, 0, -24);
  context.bezierCurveTo(8, -22, 11, -8, 0, 2);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.shadowColor = "transparent";
  context.beginPath();
  context.arc(0, -15, 3.2, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,0.38)";
  context.fill();
  context.restore();
}

function drawAnswerMark(context: CanvasRenderingContext2D, x: number, y: number, fill: string, drop: number) {
  const lift = 22 * (1 - Math.max(0, Math.min(1, drop)));
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, drop) * 1.5);
  context.translate(x, y - lift);
  context.beginPath();
  context.moveTo(0, -11);
  context.lineTo(9, 0);
  context.lineTo(0, 11);
  context.lineTo(-9, 0);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(0,0,0,0.35)";
  context.stroke();
  const pulse = Math.max(0, 1 - Math.max(0, drop - 0.65) / 0.55);
  if (pulse > 0.02 && drop > 0.4) {
    context.beginPath();
    context.arc(0, 0, 10 + (1 - pulse) * 16, 0, Math.PI * 2);
    context.strokeStyle = fill;
    context.globalAlpha = 0.45 * pulse;
    context.lineWidth = 1.5;
    context.stroke();
  }
  context.restore();
}

let countyCache: Collection | null = null;
let countyLoad: Promise<Collection> | null = null;

function counties(): Promise<Collection> {
  countyLoad ??= import("us-atlas/counties-10m.json").then((mod) => {
    const all = feature(mod.default, mod.default.objects.counties) as Collection;
    countyCache = {
      type: "FeatureCollection",
      features: all.features.filter((item) => String(item.id).startsWith("31")),
    };
    return countyCache;
  });
  return countyLoad;
}

export function AtlasMap({
  roundId,
  scope,
  mapStyle,
  pending,
  lockedGuess,
  answer,
  revealed,
  reducedMotion,
  interactive,
  onPick,
  onConfirm,
  theme,
}: {
  roundId: string;
  scope: RingId;
  mapStyle: MapStyle;
  pending: LonLat | null;
  lockedGuess: LonLat | null;
  answer: LonLat | null;
  revealed: boolean;
  reducedMotion: boolean;
  interactive: boolean;
  theme: string;
  onPick: (at: LonLat) => void;
  onConfirm: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  const fitKey = useRef("");
  const arcRef = useRef(revealed ? 1 : 0);
  const litRef = useRef<string | null>(null);
  const pinStamp = useRef(0);
  const pinKey = useRef("");
  const answerStamp = useRef(0);
  const keyboardRef = useRef(false);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (scope !== "nebraska" && scope !== "region") return;
    let alive = true;
    counties().then(() => {
      if (alive) drawRef.current();
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (width < 2 || height < 2) return;
      const key = `${roundId}:${scope}:${width}x${height}`;
      if (!viewRef.current || fitKey.current !== key) {
        viewRef.current = fitView(scope, width, height);
        fitKey.current = key;
        arcRef.current = revealed ? 1 : 0;
      }
      const view = viewRef.current;
      view.width = width;
      view.height = height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const colors = readColors();
      const projection = projectionFor(view);
      const path = geoPath(projection, context);
      context.clearRect(0, 0, width, height);
      if (scope === "world") {
        const voidShade = context.createRadialGradient(
          width / 2,
          height / 2,
          Math.min(width, height) * 0.2,
          width / 2,
          height / 2,
          Math.max(width, height) * 0.72,
        );
        voidShade.addColorStop(0, "#121816");
        voidShade.addColorStop(1, "#070908");
        context.fillStyle = voidShade;
        context.fillRect(0, 0, width, height);
        context.beginPath();
        path({ type: "Sphere" });
        context.fillStyle = colors.water;
        context.fill();
        const lit = smoothstep((arcRef.current - 0.42) / 0.45);
        for (const feat of countries.features) {
          context.beginPath();
          path(feat as never);
          const id = String(feat.id ?? "");
          const base = tone(id || "land", colors.land);
          context.fillStyle = litRef.current && id === litRef.current ? mix(base, colors.lit, lit) : base;
          context.fill();
        }
        drawTerrain(context, path, terrainFor("world"), colors, false);
        context.beginPath();
        path(coast as never);
        context.strokeStyle = colors.coast;
        context.lineWidth = 0.8;
        context.stroke();
        if (mapStyle === "roads") {
          context.beginPath();
          path(countryBorders as never);
          context.strokeStyle = colors.border;
          context.globalAlpha = 0.85;
          context.lineWidth = 0.55;
          context.stroke();
          context.globalAlpha = 1;
        }
        context.beginPath();
        path(graticule);
        context.strokeStyle = colors.border;
        context.globalAlpha = 0.28;
        context.lineWidth = 0.45;
        context.stroke();
        context.globalAlpha = 1;
        const radius = view.scale;
        context.save();
        context.beginPath();
        path({ type: "Sphere" });
        context.clip();
        const light = context.createRadialGradient(
          width / 2 - radius * 0.34,
          height / 2 - radius * 0.4,
          radius * 0.12,
          width / 2,
          height / 2,
          radius,
        );
        light.addColorStop(0, "rgba(255,255,255,0.12)");
        light.addColorStop(0.55, "rgba(255,255,255,0)");
        light.addColorStop(1, "rgba(0,0,0,0.26)");
        context.fillStyle = light;
        context.fillRect(0, 0, width, height);
        context.restore();
        context.beginPath();
        context.arc(width / 2, height / 2, radius + 2, 0, Math.PI * 2);
        context.strokeStyle = "rgba(156, 196, 204, 0.38)";
        context.lineWidth = 7;
        context.stroke();
        context.beginPath();
        path({ type: "Sphere" });
        context.strokeStyle = colors.coast;
        context.lineWidth = 1.2;
        context.stroke();
      } else if (scope === "usa" || scope === "nebraska") {
        context.fillStyle = colors.water;
        context.fillRect(0, 0, width, height);
        const lit = smoothstep((arcRef.current - 0.42) / 0.45);
        for (const feat of stateCollection.features) {
          context.beginPath();
          path(feat as never);
          const id = String(feat.id ?? "");
          const base = tone(id || "land", colors.land);
          const on = scope === "usa" && litRef.current === id;
          context.fillStyle = on ? mix(base, colors.lit, lit) : base;
          context.fill();
        }
        if (mapStyle === "roads") {
          context.beginPath();
          path(stateCollection as never);
          context.strokeStyle = colors.border;
          context.lineWidth = 0.75;
          context.stroke();
        }
        if (scope === "nebraska" && countyCache) {
          if (mapStyle === "roads") {
            context.beginPath();
            path(countyCache as never);
            context.strokeStyle = colors.border;
            context.lineWidth = 0.55;
            context.stroke();
          }
          if (litRef.current) {
            const county = countyCache.features.find((feat) => String(feat.id ?? "") === litRef.current);
            if (county) {
              context.beginPath();
              path(county as never);
              context.fillStyle = mix(colors.land, colors.lit, Math.max(lit, 0.15));
              context.fill();
            }
          }
          if (nebraska) {
            context.beginPath();
            path(nebraska as never);
            context.strokeStyle = colors.coast;
            context.lineWidth = 1.4;
            context.stroke();
          }
        }
        drawTerrain(context, path, terrainFor(scope), colors, mapStyle === "roads");
      } else {
        const wash = context.createLinearGradient(0, 0, 0, height);
        wash.addColorStop(0, mix(colors.land, "#f7f4ee", 0.16));
        wash.addColorStop(1, colors.land);
        context.fillStyle = wash;
        context.fillRect(0, 0, width, height);
        if (countyCache && mapStyle === "roads" && scope === "region") {
          context.beginPath();
          path(countyCache as never);
          context.strokeStyle = colors.border;
          context.lineWidth = 0.8;
          context.stroke();
        }
        drawTerrain(context, path, terrainFor(scope), colors, mapStyle === "roads");
      }

      const guess = lockedGuess ?? pending;
      if (pending) {
        const key = `${pending[0]},${pending[1]}`;
        if (pinKey.current !== key) {
          pinKey.current = key;
          pinStamp.current = reducedMotion ? performance.now() - 2000 : performance.now();
        }
      }
      if (guess && answer && arcRef.current > 0) {
        const interpolate = geoInterpolate(guess, answer);
        const steps = 72;
        const count = Math.max(1, Math.round(steps * arcRef.current));
        context.beginPath();
        context.lineCap = "round";
        context.lineJoin = "round";
        let started = false;
        let last: [number, number] | null = null;
        for (let i = 0; i <= count; i++) {
          const point = projection(interpolate(i / steps));
          if (!point) {
            started = false;
            continue;
          }
          if (!started) context.moveTo(point[0], point[1]);
          else context.lineTo(point[0], point[1]);
          started = true;
          last = [point[0], point[1]];
        }
        context.strokeStyle = colors.arc;
        context.globalAlpha = 0.28;
        context.lineWidth = 7;
        context.stroke();
        context.globalAlpha = 1;
        context.lineWidth = 2.4;
        context.stroke();
        if (last) {
          context.beginPath();
          context.arc(last[0], last[1], 4.2, 0, Math.PI * 2);
          context.fillStyle = colors.arc;
          context.fill();
        }
      }

      const projectPin = (at: LonLat) => projection(at);
      if (guess) {
        const xy = projectPin(guess);
        if (xy) {
          const drop = reducedMotion ? 1 : spring01((performance.now() - pinStamp.current) / 1000);
          drawGuessPin(context, xy[0], xy[1], colors.pin, pinStamp.current ? drop : 1);
        }
      }
      if (revealed && answer && answerStamp.current) {
        const xy = projectPin(answer);
        if (xy) {
          const drop = reducedMotion ? 1 : spring01((performance.now() - answerStamp.current) / 1000);
          drawAnswerMark(context, xy[0], xy[1], colors.answer, drop);
        }
      }
      if (keyboardRef.current && interactive) {
        context.beginPath();
        context.arc(width / 2, height / 2, 10, 0, Math.PI * 2);
        context.strokeStyle = colors.cross;
        context.lineWidth = 1.25;
        context.stroke();
      }
    };

    drawRef.current = draw;
    const observer = new ResizeObserver(() => draw());
    observer.observe(stage);
    draw();
    return () => observer.disconnect();
  }, [answer, interactive, lockedGuess, mapStyle, pending, reducedMotion, revealed, roundId, scope, theme]);

  useEffect(() => {
    if (!pending) return;
    pinStamp.current = reducedMotion ? performance.now() - 2000 : performance.now();
    if (reducedMotion) {
      drawRef.current();
      return;
    }
    let frame = 0;
    const start = pinStamp.current;
    const tick = (now: number) => {
      drawRef.current();
      if (now - start < 700) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pending, reducedMotion]);

  useEffect(() => {
    if (!revealed || !answer) {
      arcRef.current = 0;
      answerStamp.current = 0;
      litRef.current = null;
      drawRef.current();
      return;
    }
    const markAnswer = () => {
      if (scope === "world") {
        const hit = countries.features.find((feat) => geoContains(feat, answer));
        litRef.current = hit?.id != null ? String(hit.id) : null;
      } else if (scope === "usa") {
        const hit = stateCollection.features.find((feat) => geoContains(feat, answer));
        litRef.current = hit?.id != null ? String(hit.id) : null;
      } else if (scope === "nebraska") {
        counties().then((pack) => {
          const hit = pack.features.find((feat) => geoContains(feat, answer));
          litRef.current = hit?.id != null ? String(hit.id) : null;
          drawRef.current();
        });
      }
    };
    markAnswer();
    const view = viewRef.current;
    if (!view) return;
    const fromCenter = view.center;
    const fromScale = view.scale;
    const boost = scope === "world" ? 4 : scope === "usa" ? 3 : scope === "nebraska" ? 2.5 : scope === "region" ? 2.2 : 2.05;
    const toScale = Math.min(view.maxScale, Math.max(fromScale, view.baseScale * boost));
    const interpolate = geoInterpolate(fromCenter, answer);
    if (reducedMotion) {
      view.center = answer;
      view.scale = toScale;
      arcRef.current = 1;
      answerStamp.current = performance.now() - 2000;
      drawRef.current();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 1650;
    answerStamp.current = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const current = viewRef.current;
      if (!current) return;
      const pull = 0.2;
      let along = 0;
      let scale = fromScale;
      if (t < pull) {
        const u = smoothstep(t / pull);
        along = 0.05 * u;
        scale = fromScale * (1 - 0.08 * u);
      } else {
        const u = smoothstep((t - pull) / (1 - pull));
        along = 0.05 + 0.95 * u;
        const dipped = fromScale * 0.92;
        scale = dipped + (toScale - dipped) * u;
      }
      current.center = interpolate(along) as LonLat;
      current.scale = scale;
      arcRef.current = smoothstep((t - 0.06) / 0.8);
      if (t > 0.52 && answerStamp.current === 0) answerStamp.current = now;
      drawRef.current();
      const answering = answerStamp.current > 0 && now - answerStamp.current < 700;
      if (t < 1 || answering) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [answer, reducedMotion, revealed, roundId, scope]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = false;
    let pinch: number | null = null;
    let origin: { x: number; y: number } | null = null;

    const pointOf = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onDown = (event: PointerEvent) => {
      if (!interactive) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      const here = pointOf(event);
      pointers.set(event.pointerId, here);
      origin = here;
      moved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const pan = (dx: number, dy: number) => {
      const view = viewRef.current;
      if (!view) return;
      const projection = projectionFor(view);
      const next = projection.invert?.([view.width / 2 - dx, view.height / 2 - dy]);
      if (next && Number.isFinite(next[0]) && Number.isFinite(next[1])) {
        view.center = [next[0], Math.max(-80, Math.min(80, next[1]))];
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !interactive) return;
      const previous = pointers.get(event.pointerId)!;
      const next = pointOf(event);
      pointers.set(event.pointerId, next);
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        zoomBy(distance / pinch);
        pinch = distance;
        moved = true;
        return;
      }
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      if (!origin || Math.hypot(next.x - origin.x, next.y - origin.y) <= 8) return;
      moved = true;
      pan(dx, dy);
      drawRef.current();
    };

    const onUp = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      pinch = null;
      if (!interactive || !start || moved) {
        if (pointers.size === 0) {
          moved = false;
          origin = null;
        }
        return;
      }
      const here = pointOf(event);
      if (Math.hypot(here.x - start.x, here.y - start.y) > 8) return;
      const view = viewRef.current;
      if (!view) return;
      const projection = projectionFor(view);
      const at = projection.invert?.([here.x, here.y]);
      if (!at || !Number.isFinite(at[0]) || !Number.isFinite(at[1])) return;
      if (pending) {
        const pin = projection(pending);
        if (pin && Math.hypot(pin[0] - here.x, pin[1] - (here.y + 12)) < 26) {
          onConfirm();
          return;
        }
      }
      onPick([at[0], at[1]]);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    const onWheel = (event: WheelEvent) => {
      if (!interactive) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.0011));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [interactive, onConfirm, onPick, pending]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!interactive) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const view = viewRef.current;
      if (!view) return;
      const step = event.shiftKey ? 48 : 28;
      if (event.key === "ArrowLeft") panKeys(step, 0);
      else if (event.key === "ArrowRight") panKeys(-step, 0);
      else if (event.key === "ArrowUp") panKeys(0, -step);
      else if (event.key === "ArrowDown") panKeys(0, step);
      else if (event.key === "+" || event.key === "=") zoomBy(1.2);
      else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.2);
      else if (event.key === "Enter") {
        keyboardRef.current = true;
        if (pending) onConfirm();
        else onPick(view.center);
      } else return;
      keyboardRef.current = true;
      event.preventDefault();
    };
    const panKeys = (dx: number, dy: number) => {
      const view = viewRef.current;
      if (!view) return;
      const projection = projectionFor(view);
      const next = projection.invert?.([view.width / 2 - dx, view.height / 2 - dy]);
      if (next) view.center = [next[0], Math.max(-80, Math.min(80, next[1]))];
      drawRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, onConfirm, onPick, pending]);

  function zoomBy(factor: number) {
    const view = viewRef.current;
    if (!view || !interactive) return;
    view.scale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * factor));
    drawRef.current();
  }

  function reset() {
    const view = viewRef.current;
    if (!view || !interactive) return;
    const fitted = fitView(scope, view.width, view.height);
    view.center = fitted.center;
    view.scale = fitted.scale;
    drawRef.current();
  }

  return (
    <div ref={stageRef} className="relative h-full min-h-0 w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        role="application"
        aria-label="Label-free map. Tap to drop a pin. Arrow keys move the view, Enter drops a pin at the center, and Enter again confirms."
      />
      <p className="pointer-events-none absolute bottom-3 left-3 max-w-[14rem] text-[10px] leading-snug text-muted">
        Natural Earth · © OpenStreetMap
      </p>
      <div className="absolute right-3 bottom-3 flex flex-col gap-2">
        <Button variant="secondary" className="size-11 px-0" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" className="size-11 px-0" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" className="size-11 px-0" aria-label="Reset the map view" onClick={reset}>
          <LocateFixed className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
