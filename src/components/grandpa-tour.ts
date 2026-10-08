/**
 * Grandpa's Tasting Tour — pure trail-geometry module (no DOM, no React).
 *
 * Builds the dotted S-trail grandpa walks on mobile (≤1023.5px): from a
 * brass compass-rose origin top-left, down the page gutters, pausing at each
 * tasting stop (difficulty → GeoDetective → editions → review when present),
 * to a pour waypoint just above the park strip and finally the bench.
 *
 * Design rules enforced by the builder (fail-closed: any violation returns
 * null so the caller steps down the fallback ladder):
 * - the trail never runs on or behind a stop card (sampled, 1px inflate)
 * - every sampled trail point keeps ≥16px from every interactive rect
 * - gutter crossings happen in the vertical gaps between consecutive stops
 *   (gap ≥ 32px so the crossing sits 16px clear of each card edge)
 * - viewport ≥ 320px wide (gutters too narrow below that)
 *
 * The caller measures DOM rects (after `document.fonts.ready`) into
 * `TourMeasurements`; everything here is pure and unit-tested.
 */

export type DocRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type TourStopKey = "difficulty" | "geodetective" | "editions" | "review";

export type TourStop = { key: TourStopKey; rect: DocRect };

export type TourMeasurements = {
  viewportWidth: number;
  docHeight: number;
  /** In visit order: difficulty, geodetective, editions, review? */
  stops: TourStop[];
  /** Visible interactive rects inside the home <main>, doc coords. */
  interactives: DocRect[];
  /** Doc y of the compass-rose origin (header eyebrow/title midpoint). */
  originY: number;
  /** Doc y of the park strip's top edge. */
  stripTop: number;
  /** Strip walker's center, doc coords — the trail's destination. */
  bench: { x: number; y: number };
};

export type TourGeometry = {
  width: number;
  height: number;
  /** SVG path data, doc coords. The walker’s CENTER travels this path. */
  d: string;
  origin: { x: number; y: number };
  /** Path distance (px) of each stop waypoint, in visit order. */
  stopDistances: number[];
  /** Gutter side of each stop ("left" → grandpa faces right, and vice versa). */
  stopSides: Array<"left" | "right">;
  /** Path distance of the pour waypoint (just above the park strip). */
  pourDistance: number;
  totalLength: number;
  /** True for the level-1 fallback: straight trail, no stops. */
  simplified: boolean;
};

/** Trail centerline offset from each viewport edge (the gutters). */
export const TOUR_GUTTER_PX = 14;
/** Compass-rose origin x (by the Meridian banner, top-left). */
const ORIGIN_X = 26;
/** Required clearance from every interactive rect. */
const CLEARANCE_PX = 16;
/** Minimum vertical gap between consecutive stops for a gutter crossing. */
const MIN_GAP_PX = 32;
/** Stop-card inflate for the never-on/behind-cards rule. */
const CARD_INFLATE_PX = 1;
/** Pour waypoint sits this far above the park strip's top edge — "just
 *  above the park strip". 16px keeps it clear of the strip while fitting
 *  the tight gap when the review deck (the last stop) sits right above. */
const POUR_ABOVE_STRIP_PX = 16;
/** Corner rounding where the trail turns (vertical ↔ crossing). */
const CORNER_R = 10;

type Pt = { x: number; y: number };

type Seg =
  | { kind: "line"; to: Pt }
  | { kind: "quad"; c: Pt; to: Pt }
  | { kind: "cubic"; c1: Pt; c2: Pt; to: Pt };

function segPoint(from: Pt, seg: Seg, t: number): Pt {
  const u = 1 - t;
  if (seg.kind === "line") {
    return { x: from.x + (seg.to.x - from.x) * t, y: from.y + (seg.to.y - from.y) * t };
  }
  if (seg.kind === "quad") {
    return {
      x: u * u * from.x + 2 * u * t * seg.c.x + t * t * seg.to.x,
      y: u * u * from.y + 2 * u * t * seg.c.y + t * t * seg.to.y,
    };
  }
  return {
    x:
      u * u * u * from.x +
      3 * u * u * t * seg.c1.x +
      3 * u * t * t * seg.c2.x +
      t * t * t * seg.to.x,
    y:
      u * u * u * from.y +
      3 * u * u * t * seg.c1.y +
      3 * u * t * t * seg.c2.y +
      t * t * t * seg.to.y,
  };
}

function segLength(from: Pt, seg: Seg): number {
  const N = 24;
  let len = 0;
  let prev = from;
  for (let i = 1; i <= N; i++) {
    const p = segPoint(from, seg, i / N);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** Euclidean distance from a point to a rect (0 when inside). */
export function pointRectDistance(p: Pt, r: DocRect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - r.right);
  const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
  return Math.hypot(dx, dy);
}

function pointInInflatedRect(p: Pt, r: DocRect, inflate: number): boolean {
  return (
    p.x >= r.left - inflate &&
    p.x <= r.right + inflate &&
    p.y >= r.top - inflate &&
    p.y <= r.bottom + inflate
  );
}

/** Path builder: accumulates segments, the `d` string, and waypoint marks. */
class TrailBuilder {
  segs: Seg[] = [];
  d = "";
  private cursor: Pt;
  private dist = 0;
  /** waypoint name → path distance, recorded at segment ends */
  marks = new Map<string, number>();

  constructor(start: Pt) {
    this.cursor = start;
    this.d = `M ${r1(start.x)} ${r1(start.y)}`;
  }

  private push(seg: Seg, mark?: string) {
    this.dist += segLength(this.cursor, seg);
    if (seg.kind === "line") this.d += ` L ${r1(seg.to.x)} ${r1(seg.to.y)}`;
    else if (seg.kind === "quad")
      this.d += ` Q ${r1(seg.c.x)} ${r1(seg.c.y)} ${r1(seg.to.x)} ${r1(seg.to.y)}`;
    else
      this.d += ` C ${r1(seg.c1.x)} ${r1(seg.c1.y)} ${r1(seg.c2.x)} ${r1(seg.c2.y)} ${r1(seg.to.x)} ${r1(seg.to.y)}`;
    this.cursor = seg.to;
    this.segs.push(seg);
    if (mark) this.marks.set(mark, this.dist);
  }

  lineTo(to: Pt, mark?: string) {
    this.push({ kind: "line", to }, mark);
  }

  quadTo(c: Pt, to: Pt, mark?: string) {
    this.push({ kind: "quad", c, to }, mark);
  }

  cubicTo(c1: Pt, c2: Pt, to: Pt, mark?: string) {
    this.push({ kind: "cubic", c1, c2, to }, mark);
  }

  get length() {
    return this.dist;
  }
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function samplePath(segs: Seg[], start: Pt, step: number): Pt[] {
  const pts: Pt[] = [start];
  let cursor = start;
  for (const seg of segs) {
    const len = segLength(cursor, seg);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) pts.push(segPoint(cursor, seg, i / n));
    cursor = seg.to;
  }
  return pts;
}

/**
 * The clearance gate: every sampled point must keep ≥16px from every
 * interactive rect and stay off every stop card. Returns false on the first
 * violation — the caller steps down the fallback ladder.
 */
function pathIsClear(
  segs: Seg[],
  start: Pt,
  stops: TourStop[],
  interactives: DocRect[],
): boolean {
  for (const p of samplePath(segs, start, 6)) {
    for (const r of interactives) {
      if (pointRectDistance(p, r) < CLEARANCE_PX) return false;
    }
    for (const s of stops) {
      if (pointInInflatedRect(p, s.rect, CARD_INFLATE_PX)) return false;
    }
  }
  return true;
}

const REQUIRED_STOPS: TourStopKey[] = ["difficulty", "geodetective", "editions"];

function checkRequiredStops(stops: TourStop[]): boolean {
  const keys = new Set(stops.map((s) => s.key));
  if (!REQUIRED_STOPS.every((k) => keys.has(k))) return false;
  // Visit order must be difficulty → geodetective → editions → review?.
  const order = ["difficulty", "geodetective", "editions", "review"];
  const idx = stops.map((s) => order.indexOf(s.key));
  return idx.every((v, i) => i === 0 || v > idx[i - 1]);
}

/**
 * Full weave: alternating gutters (difficulty right, geodetective left,
 * editions right, review left), crossings in the inter-card gaps, pour
 * waypoint above the strip, trail ending at the bench. Returns null when any
 * design rule can't be met — the caller falls back to the straight trail.
 */
export function buildTourPath(m: TourMeasurements): TourGeometry | null {
  const W = m.viewportWidth;
  if (W < 320) return null;
  if (!checkRequiredStops(m.stops)) return null;
  const stops = m.stops;
  const gxLeft = TOUR_GUTTER_PX;
  const gxRight = W - TOUR_GUTTER_PX;

  const origin: Pt = { x: ORIGIN_X, y: m.originY };
  const firstTop = stops[0].rect.top;
  const crossY0 = firstTop - 48;
  // Room for the header run + crossing above the first stop.
  if (!(crossY0 > origin.y + 30)) return null;
  // Every inter-stop gap must fit a 16px-clear crossing.
  for (let i = 0; i + 1 < stops.length; i++) {
    if (stops[i + 1].rect.top - stops[i].rect.bottom < MIN_GAP_PX) return null;
  }
  const last = stops[stops.length - 1];
  const pourY = m.stripTop - POUR_ABOVE_STRIP_PX;
  // The pour waypoint must sit below the last card (never on it) and above
  // the strip; the sampler re-verifies clearance against interactives.
  if (!(pourY > last.rect.bottom + 8)) return null;
  if (!(m.bench.y > pourY)) return null;

  const b = new TrailBuilder(origin);
  const sideOf = (i: number): "left" | "right" => (i % 2 === 0 ? "right" : "left");
  const gxOf = (i: number): number => (sideOf(i) === "left" ? gxLeft : gxRight);

  // Origin → left gutter → header crossing → right gutter → first stop.
  b.lineTo({ x: gxLeft, y: origin.y });
  b.lineTo({ x: gxLeft, y: crossY0 - CORNER_R });
  b.quadTo({ x: gxLeft, y: crossY0 }, { x: gxLeft + CORNER_R, y: crossY0 });
  b.lineTo({ x: gxRight - CORNER_R, y: crossY0 });
  b.quadTo({ x: gxRight, y: crossY0 }, { x: gxRight, y: crossY0 + CORNER_R });

  const stopDistances: number[] = [];
  const stopSides: Array<"left" | "right"> = [];
  for (let i = 0; i < stops.length; i++) {
    const gx = gxOf(i);
    const cy = stops[i].rect.top + (stops[i].rect.bottom - stops[i].rect.top) / 2;
    b.lineTo({ x: gx, y: cy }, `stop-${i}`);
    stopDistances.push(b.marks.get(`stop-${i}`) ?? b.length);
    stopSides.push(sideOf(i));
    if (i + 1 < stops.length) {
      const nextGx = gxOf(i + 1);
      const gapY = (stops[i].rect.bottom + stops[i + 1].rect.top) / 2;
      const dir = nextGx > gx ? 1 : -1;
      b.lineTo({ x: gx, y: gapY - CORNER_R });
      b.quadTo({ x: gx, y: gapY }, { x: gx + CORNER_R * dir, y: gapY });
      b.lineTo({ x: nextGx - CORNER_R * dir, y: gapY });
      b.quadTo({ x: nextGx, y: gapY }, { x: nextGx, y: gapY + CORNER_R });
    }
  }

  // Final approach: down the last gutter to the pour waypoint, then swoop
  // to the bench.
  const lastGx = gxOf(stops.length - 1);
  b.lineTo({ x: lastGx, y: pourY }, "pour");
  const pourDistance = b.marks.get("pour") ?? b.length;
  const dx = Math.sign(m.bench.x - lastGx) || 1;
  b.cubicTo(
    { x: lastGx, y: m.bench.y - 24 },
    { x: m.bench.x - 36 * dx, y: m.bench.y },
    { x: m.bench.x, y: m.bench.y },
  );

  if (!pathIsClear(b.segs, origin, stops, m.interactives)) return null;

  return {
    width: W,
    height: Math.max(m.docHeight, m.bench.y + 80),
    d: b.d,
    origin,
    stopDistances,
    stopSides,
    pourDistance,
    totalLength: b.length,
    simplified: false,
  };
}

/**
 * Level-1 fallback: a simplified straight trail down the right gutter —
 * no stops, no weaving. It starts below the header (clear of the sound
 * toggle and any invite buttons) and runs to the pour waypoint. Same
 * clearance gate; null steps down to the current bottom-strip walk.
 */
export function buildStraightTrail(m: TourMeasurements): TourGeometry | null {
  const W = m.viewportWidth;
  if (W < 320) return null;
  const gx = W - TOUR_GUTTER_PX;
  const origin: Pt = { x: gx, y: 280 };
  const pourY = m.stripTop - POUR_ABOVE_STRIP_PX;
  if (!(pourY > 320)) return null;
  if (!(m.bench.y > pourY)) return null;

  const b = new TrailBuilder(origin);
  b.lineTo({ x: gx, y: pourY }, "pour");
  const pourDistance = b.marks.get("pour") ?? b.length;
  const dx = Math.sign(m.bench.x - gx) || 1;
  b.cubicTo(
    { x: gx, y: m.bench.y - 24 },
    { x: m.bench.x - 36 * dx, y: m.bench.y },
    { x: m.bench.x, y: m.bench.y },
  );

  if (!pathIsClear(b.segs, origin, m.stops, m.interactives)) return null;

  return {
    width: W,
    height: Math.max(m.docHeight, m.bench.y + 80),
    d: b.d,
    origin,
    stopDistances: [],
    stopSides: [],
    pourDistance,
    totalLength: b.length,
    simplified: true,
  };
}
