/**
 * 3D Holmes & Watson (owner request, 2026-11-10: "build better
 * characters ... proper 3d characters"; look approved from the Blender
 * renders the same day).
 *
 * The models are modelled by script in Blender (scripts/detective3d/)
 * and exported as two small GLBs in public/models/detective/. Each has
 * pivots for the head, both shoulders and elbows, and both hips, and a
 * separate mouth for the speaking flap; pair3d-poses.ts maps every rig
 * pose to joint angles.
 *
 * Contract with the SVG rigs (DetectivePair.tsx):
 * - The 3D layer is an ENHANCEMENT painted over the SVG rig, which
 *   stays in the DOM (transparent) so layout, anchors, hit boxes and
 *   every data-* hook are unchanged. Any failure (flag off, no WebGL,
 *   weak device, Save-Data, model load error) leaves the SVG rig as is.
 * - Answer-blind like the rigs: it receives pose / facing / speaking
 *   only. No game state reaches this module.
 * - One WebGL context for every figure on the page: each figure owns a
 *   plain 2D canvas, and a shared renderer draws each figure's scene and
 *   copies it across, capped at 30 fps and paused while the tab is
 *   hidden. Under reduced motion the poses hold still (no idle, walk or
 *   jump motion) and change without easing.
 * - three is imported dynamically, only once the flag is on and a rig
 *   mounts, so it never touches the initial bundle or node unit tests.
 */
import { isEnabled } from "../../../lib/flags.ts";
import { assetBase } from "../../../components/storyteller-lines.ts";
import {
  FACING_TURN_DEG,
  FRAME_3D,
  HOLMES_POSES_3D,
  WATSON_POSES_3D,
  type Pose3D,
} from "./pair3d-poses.ts";

export type Who3D = "holmes" | "watson";

export interface Pair3DEnv {
  flagOn: boolean;
  webgl: boolean;
  saveData: boolean;
  deviceMemory: number | undefined;
  cores: number | undefined;
}

/** Pure gate (unit-tested): may this device draw the 3D pair? */
export function pair3dAllowed(env: Pair3DEnv): boolean {
  if (!env.flagOn || !env.webgl || env.saveData) return false;
  if (typeof env.deviceMemory === "number" && env.deviceMemory > 0 && env.deviceMemory <= 2) return false;
  if (typeof env.cores === "number" && env.cores > 0 && env.cores <= 2) return false;
  return true;
}

/** The pose a figure should hold, falling back to the character's rest. */
export function pose3dFor(who: Who3D, pose: string): Pose3D {
  const table = who === "holmes" ? HOLMES_POSES_3D : WATSON_POSES_3D;
  return table[pose] ?? (who === "holmes" ? HOLMES_POSES_3D.dock! : WATSON_POSES_3D["station-idle"]!);
}

/* ------------------------------------------------------------------ */
/* Readiness store                                                    */
/* ------------------------------------------------------------------ */

type Status = "idle" | "loading" | "ready" | "failed";
let status: Status = "idle";
const listeners = new Set<() => void>();

export function pair3dStatus(): Status {
  return status;
}

export function subscribePair3d(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(s: Status) {
  status = s;
  for (const fn of listeners) fn();
}

function readEnv(): Pair3DEnv {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  const flagOn = isEnabled("pair3d");
  let webgl = false;
  if (flagOn) try {
    const c = document.createElement("canvas");
    webgl = Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return {
    flagOn,
    webgl,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}

type ThreeModule = typeof import("three");
type Object3D = import("three").Object3D;

interface Engine {
  THREE: ThreeModule;
  renderer: import("three").WebGLRenderer;
  models: Record<Who3D, Object3D>;
}

let engine: Engine | null = null;

/** Start loading once (idempotent). Safe to call from any rig mount. */
export function ensurePair3d(): void {
  if (status !== "idle" || typeof window === "undefined") return;
  const env = readEnv();
  // Flag off: stay idle so a later mount re-checks (flags.json may
  // still be loading on a deep link). A device that fails the gate is
  // final for the session.
  if (!env.flagOn) return;
  if (!pair3dAllowed(env)) {
    setStatus("failed");
    return;
  }
  setStatus("loading");
  void (async () => {
    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const base = `${assetBase()}models/detective/`;
      const [h, w] = await Promise.all([
        loader.loadAsync(`${base}holmes.glb`),
        loader.loadAsync(`${base}watson.glb`),
      ]);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(1);
      renderer.setSize(RENDER_SIZE, RENDER_SIZE, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.addEventListener("webglcontextlost", () => {
        stopLoop();
        setStatus("failed");
      });
      engine = { THREE, renderer, models: { holmes: h.scene, watson: w.scene } };
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  })();
}

/* ------------------------------------------------------------------ */
/* Figures                                                            */
/* ------------------------------------------------------------------ */

const RENDER_SIZE = 512;
const FRAME_MS = 1000 / 30;

interface Joints {
  shoulderL: Object3D | undefined;
  shoulderR: Object3D | undefined;
  elbowL: Object3D | undefined;
  elbowR: Object3D | undefined;
  head: Object3D | undefined;
  hipL: Object3D | undefined;
  hipR: Object3D | undefined;
  mouth: Object3D | undefined;
  root: Object3D;
}

/** Current joint angles in degrees (eased toward the target pose). */
interface Angles {
  sL: [number, number, number];
  sR: [number, number, number];
  eL: number;
  eR: number;
  head: [number, number, number];
  turn: number;
}

export interface FigureHandle {
  update(next: { pose: string; facing: "left" | "right"; speaking: boolean; halo: boolean }): void;
  dispose(): void;
}

interface Figure {
  who: Who3D;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene: import("three").Scene;
  camera: import("three").OrthographicCamera;
  joints: Joints;
  pose: Pose3D;
  facing: "left" | "right";
  speaking: boolean;
  halo: boolean;
  angles: Angles;
  born: number;
}

const figures = new Set<Figure>();

function anglesOf(p: Pose3D, facing: "left" | "right"): Angles {
  return {
    sL: [...p.shoulderL],
    sR: [...p.shoulderR],
    eL: p.elbowL,
    eR: p.elbowR,
    head: [...p.head],
    turn: facing === "right" ? FACING_TURN_DEG : -FACING_TURN_DEG,
  };
}

/** Mount a 3D figure onto a canvas. Returns null until the engine is ready. */
export function mountFigure(
  who: Who3D,
  canvas: HTMLCanvasElement,
  init: { pose: string; facing: "left" | "right"; speaking: boolean; halo: boolean },
): FigureHandle | null {
  if (!engine) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { THREE, models } = engine;
  const model = models[who].clone(true);
  const tag = who === "holmes" ? "H" : "W";
  const find = (n: string) => model.getObjectByName(n);
  const joints: Joints = {
    shoulderL: find(`${tag}-shoulder-l`),
    shoulderR: find(`${tag}-shoulder-r`),
    elbowL: find(`${tag}-elbow-l`),
    elbowR: find(`${tag}-elbow-r`),
    head: find(`${tag}-head`),
    hipL: find(`${tag}-hip-l`),
    hipR: find(`${tag}-hip-r`),
    mouth: find(`${tag}-mouth`),
    root: model,
  };
  const scene = new THREE.Scene();
  scene.add(model);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x8a7a66, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const f = FRAME_3D[who];
  const halfW = (f.height * f.aspect) / 2;
  const camera = new THREE.OrthographicCamera(-halfW, halfW, f.bottom + f.height, f.bottom, 0.1, 50);
  camera.position.set(0, 0, 10);
  const pose = pose3dFor(who, init.pose);
  const fig: Figure = {
    who,
    canvas,
    ctx,
    scene,
    camera,
    joints,
    pose,
    facing: init.facing,
    speaking: init.speaking,
    halo: init.halo,
    angles: anglesOf(pose, init.facing),
    born: performance.now(),
  };
  figures.add(fig);
  startLoop();
  return {
    update(next) {
      fig.pose = pose3dFor(who, next.pose);
      fig.facing = next.facing;
      fig.speaking = next.speaking;
      fig.halo = next.halo;
      if (reducedMotion()) fig.angles = anglesOf(fig.pose, fig.facing);
    },
    dispose() {
      figures.delete(fig);
      if (figures.size === 0) stopLoop();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Loop                                                               */
/* ------------------------------------------------------------------ */

let raf = 0;
let last = 0;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function startLoop() {
  if (raf || typeof window === "undefined") return;
  const tick = (now: number) => {
    raf = window.requestAnimationFrame(tick);
    if (document.hidden || now - last < FRAME_MS) return;
    last = now;
    drawAll(now);
  };
  raf = window.requestAnimationFrame(tick);
}

function stopLoop() {
  if (raf) window.cancelAnimationFrame(raf);
  raf = 0;
}

const ease = (a: number, b: number, k: number) => a + (b - a) * k;
const D = Math.PI / 180;

function drawAll(now: number) {
  if (!engine) return;
  const still = reducedMotion();
  for (const fig of figures) {
    if (!fig.canvas.isConnected) continue;
    const rect = fig.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) continue;
    pose(fig, now, still);
    paint(fig, rect);
  }
}

function pose(fig: Figure, now: number, still: boolean) {
  const target = anglesOf(fig.pose, fig.facing);
  const a = fig.angles;
  const k = still ? 1 : 0.22;
  for (let i = 0; i < 3; i++) {
    a.sL[i] = ease(a.sL[i]!, target.sL[i]!, k);
    a.sR[i] = ease(a.sR[i]!, target.sR[i]!, k);
    a.head[i] = ease(a.head[i]!, target.head[i]!, k);
  }
  a.eL = ease(a.eL, target.eL, k);
  a.eR = ease(a.eR, target.eR, k);
  a.turn = ease(a.turn, target.turn, k);

  const t = (now - fig.born) / 1000;
  const j = fig.joints;
  let sLx = 0, sRx = 0, sLz = 0, sRz = 0, headX = 0, hipL = 0, hipR = 0, lift = 0, breathe = 0;
  if (!still) {
    switch (fig.pose.anim) {
      case "walk": {
        const s = Math.sin(t * 7);
        hipL = 24 * s;
        hipR = -24 * s;
        sLx = -18 * s;
        sRx = 18 * s;
        lift = Math.abs(Math.cos(t * 7)) * 0.03;
        break;
      }
      case "jump":
        lift = Math.abs(Math.sin(t * 5)) * 0.16;
        sLz = -8 * Math.sin(t * 10);
        sRz = 8 * Math.sin(t * 10);
        break;
      case "clap": {
        const c = Math.max(0, Math.sin(t * 9));
        sLz = 14 * c;
        sRz = -14 * c;
        break;
      }
      case "nod":
        headX = 9 * Math.max(0, Math.sin(t * 6));
        break;
      default:
        breathe = Math.sin(t * 2.2);
    }
  }
  const set = (o: Object3D | undefined, x: number, y: number, z: number) => {
    if (o) o.rotation.set(x * D, y * D, z * D);
  };
  set(j.shoulderL, a.sL[0] + sLx, a.sL[1], a.sL[2] + sLz);
  set(j.shoulderR, a.sR[0] + sRx, a.sR[1], a.sR[2] + sRz);
  set(j.elbowL, a.eL, 0, 0);
  set(j.elbowR, a.eR, 0, 0);
  set(j.head, a.head[0] + headX + breathe * 1.5, a.head[1], a.head[2]);
  set(j.hipL, hipL, 0, 0);
  set(j.hipR, hipR, 0, 0);
  j.root.rotation.y = a.turn * D;
  j.root.position.y = lift;
  j.root.scale.set(1, 1 + breathe * 0.008, 1);
  if (j.mouth) {
    // Generic flap while speaking (not lip-sync), like the SVG rigs.
    const open = fig.speaking && !still ? 1 + 1.6 * Math.abs(Math.sin(t * 14)) : fig.speaking ? 1.8 : 1;
    j.mouth.scale.set(1, open, 1);
  }
}

function paint(fig: Figure, rect: DOMRect) {
  const { renderer } = engine!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.min(RENDER_SIZE, Math.round(rect.width * dpr));
  const h = Math.min(RENDER_SIZE, Math.round(rect.height * dpr));
  if (fig.canvas.width !== w || fig.canvas.height !== h) {
    fig.canvas.width = w;
    fig.canvas.height = h;
  }
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(true);
  renderer.clear();
  renderer.render(fig.scene, fig.camera);
  const ctx = fig.ctx;
  ctx.clearRect(0, 0, w, h);
  if (fig.halo) {
    // The SVG halo's ground ellipse: a soft cream shadow under the feet.
    ctx.fillStyle = "rgba(255, 246, 221, 0.9)";
    ctx.strokeStyle = "rgba(23, 19, 16, 0.85)";
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.975, w * 0.3, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (fig.halo) {
    // Separation over the map, like the SVG halo: a cream glow traced
    // round the figure's own silhouette (canvas shadows work everywhere,
    // unlike ctx.filter).
    ctx.save();
    ctx.shadowColor = "rgba(255, 246, 221, 0.95)";
    ctx.shadowBlur = 3 * dpr;
    ctx.drawImage(renderer.domElement, 0, RENDER_SIZE - h, w, h, 0, 0, w, h);
    ctx.restore();
  }
  ctx.drawImage(renderer.domElement, 0, RENDER_SIZE - h, w, h, 0, 0, w, h);
}
