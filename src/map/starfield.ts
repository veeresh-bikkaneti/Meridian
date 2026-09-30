/**
 * Deep-space backdrop for the satellite map: a static 2D canvas mounted
 * BEHIND the MapLibre canvas, drawn once (plus on resize). Zero JS per frame.
 *
 * Why behind-canvas DOM instead of a MapLibre layer: a circle layer of star
 * points would rotate *with the earth* in globe projection (wrong — stars are
 * inertial) and tile bizarrely in flat mode; the `sky` style property is a
 * horizon gradient with no star support. The MapLibre canvas is created with
 * `alpha: true` and no background layer, so wherever no tile/earth paints,
 * this starfield shows through.
 *
 * Content: near-black vertical gradient (#05070c → #020306) + ~600 stars
 * (white/blue-warm dots, radius 0.4–1.4 px, alpha 0.25–1.0) from a seeded
 * PRNG, so the field is stable across mounts (no shimmer on remount).
 * Optional twinkle layer: a second canvas with ~40 brighter stars, CSS
 * `@keyframes` opacity 0.35↔1 over 4–7 s — compositor-only, zero JS/frame —
 * skipped entirely under `prefers-reduced-motion`.
 *
 * The wrapper div is `pointer-events: none` (it must never intercept input)
 * and `aria-hidden="true"`. `mountStarfield` inserts the wrapper as the
 * FIRST child of its `container` (the `.satellite-map` wrapper) so the map
 * container paints above it. The wrapper keeps a dark background so a
 * canvas-2D failure still shows deep space, never white.
 */

export interface Star {
  /** Unit-space position [0, 1) — resolution-independent, rescales on resize. */
  x: number;
  y: number;
  /** CSS px at dpr 1. */
  r: number;
  alpha: number;
  color: string;
}

export interface StarfieldHandle {
  destroy: () => void;
}

/** Fixed seed → the field is identical on every mount. */
export const STARFIELD_SEED = 20260929;
export const STAR_COUNT = 600;
export const TWINKLE_STAR_COUNT = 40;
export const TWINKLE_KEYFRAMES_ID = "meridian-starfield-keyframes";

const STAR_COLORS = ["#ffffff", "#cfe0ff", "#ffe9c9"] as const;

/** Mulberry32 — small deterministic PRNG for the stable star field. */
export function createStarPRNG(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStars(
  count: number,
  rand: () => number,
  bright: boolean,
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(),
      y: rand(),
      r: bright ? 0.8 + rand() * 0.8 : 0.4 + rand() * 1.0,
      alpha: bright ? 0.7 + rand() * 0.3 : 0.25 + rand() * 0.75,
      color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)] ?? "#ffffff",
    });
  }
  return stars;
}

function devicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  const dpr =
    typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
  return Math.min(2, Math.max(1, dpr));
}

function prefersReducedMotion(): boolean {
  // Conservative default: when we cannot detect the preference (SSR, tests),
  // skip the twinkle layer.
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Inject the twinkle keyframes once per document; no-op when already present. */
function ensureTwinkleKeyframes(doc: Document): void {
  if (doc.getElementById(TWINKLE_KEYFRAMES_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = TWINKLE_KEYFRAMES_ID;
  style.textContent =
    "@keyframes meridian-star-twinkle { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }";
  doc.head.appendChild(style);
}

function sizeCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  dpr: number,
): void {
  canvas.width = Math.max(1, Math.floor(container.clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(container.clientHeight * dpr));
}

function paintBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#05070c");
  gradient.addColorStop(1, "#020306");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Star layer — TRANSPARENT otherwise: the twinkle canvas sits above the main
 * field and must never paint an opaque background over it (a shared routine
 * once did exactly that, hiding the 600-star field behind ~40 twinkles).
 * No clearRect here: repaint() always runs sizeCanvas() first, and assigning
 * a canvas's width/height resets its bitmap — the surface is already clean.
 * (The main canvas needs no clear either: paintBackground fills it opaquely.)
 */
function paintStarLayer(
  canvas: HTMLCanvasElement,
  stars: Star[],
  dpr: number,
): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(
      star.x * canvas.width,
      star.y * canvas.height,
      star.r * dpr,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Mount the starfield as the first child of `container` (the
 * `.satellite-map` wrapper). Returns a handle whose `destroy()` disconnects
 * the resize observation and removes the layer.
 *
 * Requires a DOM document (throws otherwise) — call only client-side.
 */
export function mountStarfield(container: HTMLElement): StarfieldHandle {
  const doc = typeof document !== "undefined" ? document : undefined;
  if (doc === undefined) {
    throw new Error("mountStarfield requires a DOM document");
  }
  const dpr = devicePixelRatio();
  const rand = createStarPRNG(STARFIELD_SEED);

  const wrapper = doc.createElement("div");
  wrapper.className = "meridian-starfield";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.position = "absolute";
  wrapper.style.inset = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.overflow = "hidden";
  // Fallback backdrop: a canvas-2D failure still shows deep space, never white.
  wrapper.style.background = "#05070c";

  const main = doc.createElement("canvas");
  main.style.position = "absolute";
  main.style.inset = "0";
  main.style.width = "100%";
  main.style.height = "100%";
  wrapper.appendChild(main);

  const stars = generateStars(STAR_COUNT, rand, false);

  let twinkle: HTMLCanvasElement | null = null;
  let twinkleStars: Star[] = [];
  if (!prefersReducedMotion()) {
    ensureTwinkleKeyframes(doc);
    twinkle = doc.createElement("canvas");
    twinkle.style.position = "absolute";
    twinkle.style.inset = "0";
    twinkle.style.width = "100%";
    twinkle.style.height = "100%";
    // Compositor-only twinkle: one animation for the whole layer.
    const duration = 4 + rand() * 3; // 4–7 s
    const delay = rand() * 7;
    twinkle.style.animation = `meridian-star-twinkle ${duration.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite`;
    wrapper.appendChild(twinkle);
    twinkleStars = generateStars(TWINKLE_STAR_COUNT, rand, true);
  }

  // Insert the starfield first so the map container paints above.
  container.insertBefore(wrapper, container.firstChild);

  const repaint = () => {
    sizeCanvas(main, container, dpr);
    paintBackground(main);
    paintStarLayer(main, stars, dpr);
    if (twinkle !== null) {
      sizeCanvas(twinkle, container, dpr);
      // Transparent star layer only — the main field shows through.
      paintStarLayer(twinkle, twinkleStars, dpr);
    }
  };
  repaint();

  let stopObserving: (() => void) | null = null;
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => repaint());
    observer.observe(container);
    stopObserving = () => observer.disconnect();
  } else if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    const onResize = () => repaint();
    window.addEventListener("resize", onResize);
    stopObserving = () => window.removeEventListener("resize", onResize);
  }

  return {
    destroy() {
      if (stopObserving !== null) stopObserving();
      wrapper.remove();
    },
  };
}
