import { geoArea, geoInterpolate, geoPath } from "d3-geo";
import type { LonLat, MapStyle, RingId } from "../game/types.ts";
import { terrainFor, type TerrainFeature } from "../game/terrain.ts";
import { coast, countries, countryBorders, countyPack, graticule, nebraska, stateCollection } from "./atlas-data.ts";
import { mix, readColors, tone, type Colors } from "./colors.ts";
import { smoothstep } from "./motion.ts";
import { projectionFor, type View } from "./view.ts";

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
  fillPolys(context, path, features.filter((item) => item.kind === "park"), colors.park, null);
  fillPolys(context, path, features.filter((item) => item.kind === "water"), colors.lake, colors.coast);
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

/**
 * Region boundary emphasis (Track 2): a dark casing under a bold gold
 * stroke around the lit region, matching the satellite-map highlight
 * language (region-highlight.ts). `alpha` follows the lit ramp so the
 * boundary fades in with the fill instead of popping.
 */
function strokeLitRegion(
  context: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  feature: unknown,
  alpha: number,
  colors: Colors,
) {
  if (alpha <= 0) return;
  context.save();
  context.globalAlpha = Math.min(1, alpha);
  context.lineJoin = "round";
  context.beginPath();
  path(feature as never);
  context.strokeStyle = colors.coast;
  context.lineWidth = 5;
  context.stroke();
  context.beginPath();
  path(feature as never);
  context.strokeStyle = colors.highlight;
  context.lineWidth = 2.5;
  context.stroke();
  context.restore();
}

/** Static geography. Pins and the route are painted separately so a pan can slide this layer. */
export function paintBasemap(
  context: CanvasRenderingContext2D,
  view: View,
  scope: RingId,
  mapStyle: MapStyle,
  litId: string | null,
  litAmount: number,
) {
  const { width, height } = view;
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
    const lit = smoothstep((litAmount - 0.42) / 0.45);
    for (const feat of countries.features) {
      context.beginPath();
      path(feat as never);
      const id = String(feat.id ?? "");
      const base = tone(id || "land", colors.land);
      const isLit = litId != null && id === litId;
      context.fillStyle = isLit ? mix(base, colors.lit, lit) : base;
      context.fill();
      if (isLit) strokeLitRegion(context, path, feat, lit, colors);
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
    return;
  }
  if (scope === "usa" || scope === "nebraska") {
    context.fillStyle = colors.water;
    context.fillRect(0, 0, width, height);
    const lit = smoothstep((litAmount - 0.42) / 0.45);
    for (const feat of stateCollection.features) {
      context.beginPath();
      path(feat as never);
      const id = String(feat.id ?? "");
      const base = tone(id || "land", colors.land);
      const on = scope === "usa" && litId === id;
      context.fillStyle = on ? mix(base, colors.lit, lit) : base;
      context.fill();
      if (on) strokeLitRegion(context, path, feat, lit, colors);
    }
    if (mapStyle === "roads") {
      context.beginPath();
      path(stateCollection as never);
      context.strokeStyle = colors.border;
      context.lineWidth = 0.75;
      context.stroke();
    }
    const counties = countyPack();
    if (scope === "nebraska" && counties) {
      if (mapStyle === "roads") {
        context.beginPath();
        path(counties as never);
        context.strokeStyle = colors.border;
        context.lineWidth = 0.55;
        context.stroke();
      }
      if (litId) {
        const county = counties.features.find((feat) => String(feat.id ?? "") === litId);
        if (county) {
          context.beginPath();
          path(county as never);
          const countyLit = Math.max(lit, 0.15);
          context.fillStyle = mix(colors.land, colors.lit, countyLit);
          context.fill();
          strokeLitRegion(context, path, county, countyLit, colors);
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
    return;
  }
  const wash = context.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, mix(colors.land, "#f7f4ee", 0.16));
  wash.addColorStop(1, colors.land);
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  const counties = countyPack();
  if (counties && mapStyle === "roads" && scope === "region") {
    context.beginPath();
    path(counties as never);
    context.strokeStyle = colors.border;
    context.lineWidth = 0.8;
    context.stroke();
  }
  drawTerrain(context, path, terrainFor(scope), colors, mapStyle === "roads");
}

export function drawGuessPin(context: CanvasRenderingContext2D, x: number, y: number, fill: string, drop: number) {
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

export type Overlay = {
  view: View;
  guess: LonLat | null;
  answer: LonLat | null;
  revealed: boolean;
  arc: number;
  pinDrop: number;
  answerDrop: number;
  showCrosshair: boolean;
  ghost: { x: number; y: number } | null;
  hover: { x: number; y: number } | null;
};

/** Pins, the great-circle route, and the aim mark. Always in the current view, never baked into a pan. */
export function paintOverlay(context: CanvasRenderingContext2D, overlay: Overlay) {
  const colors = readColors();
  const projection = projectionFor(overlay.view);
  const { guess, answer } = overlay;
  if (guess && answer && overlay.arc > 0 && overlay.revealed) {
    const interpolate = geoInterpolate(guess, answer);
    const steps = 72;
    const count = Math.max(1, Math.round(steps * overlay.arc));
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
  if (guess) {
    const xy = projection(guess);
    if (xy) drawGuessPin(context, xy[0], xy[1], colors.pin, overlay.pinDrop);
  }
  if (overlay.revealed && answer && overlay.answerDrop > 0) {
    const xy = projection(answer);
    if (xy) drawAnswerMark(context, xy[0], xy[1], colors.answer, overlay.answerDrop);
  }
  if (overlay.ghost) {
    drawGuessPin(context, overlay.ghost.x, overlay.ghost.y, colors.pin, 0.72);
  } else if (overlay.hover && !guess) {
    context.beginPath();
    context.arc(overlay.hover.x, overlay.hover.y, 7, 0, Math.PI * 2);
    context.strokeStyle = colors.cross;
    context.globalAlpha = 0.85;
    context.lineWidth = 1.25;
    context.stroke();
    context.globalAlpha = 1;
  }
  if (overlay.showCrosshair) {
    context.beginPath();
    context.arc(overlay.view.width / 2, overlay.view.height / 2, 10, 0, Math.PI * 2);
    context.strokeStyle = colors.cross;
    context.lineWidth = 1.25;
    context.stroke();
  }
}
