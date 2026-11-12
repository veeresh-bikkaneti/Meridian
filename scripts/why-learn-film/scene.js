// "Why Do We Learn This?" card film: a standalone three.js scene.
//
// A sunny street corner shot like the other Home card films: one locked
// wide camera, warm daylight, toon-shaded figures with ink outlines,
// soft shadows, layered background in atmospheric haze. Holmes sweeps
// his magnifying lens; inside the lens only, everyday things show their
// hidden math as thin glowing gold lines.
//
// URL switches:
//   ?band=7-10 | 10-18 | 18+   object set (section 4 of the film prompt)
//   ?t=seconds                 freeze one frame (poster t=0, still t=4)
//   ?capture=1                 no autoplay; drive with window.film.render(t)
//
// window.film = { ready: Promise, duration, fps, band, render(t) }.
// Everything is a pure function of t, so frames render the same every
// time (deterministic capture).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as B710 from "./band-7-10.js";
import { createBand18 } from "./band-18plus.js";

const W = 1094, H = 616, DURATION = 10.0, FPS = 24, SS = 2; // SS: render-target supersampling, so the lens magnifies crisply
const q = new URLSearchParams(location.search);
const BAND = ["7-10", "10-18", "18+"].includes(q.get("band")) ? q.get("band") : "10-18";
const B1018 = BAND === "10-18";
const FREEZE = q.has("t") ? Math.min(DURATION, Math.max(0, parseFloat(q.get("t")) || 0)) : null;
const CAPTURE = q.has("capture");
if (CAPTURE) document.body.classList.add("capture");

const D = Math.PI / 180;
const MODELS = "../../public/models/";

// ── Poses ──────────────────────────────────────────────────────────────
// Copied from src/game/loop/detective/pair3d-poses.ts (degrees, three
// axes). check-poses-sync.mjs fails if these drift from the game table.
export const POSES = {
  holmes: {
    dock: { shoulderL: [0, 0, -6], shoulderR: [0, 0, 6], elbowL: -8, elbowR: -8, head: [0, 0, 0] },
    "lens-sweep": { shoulderL: [14, 0, -4], shoulderR: [-62, 0, 10], elbowL: -70, elbowR: -62, head: [8, 0, 0] },
  },
  watson: {
    walk: { shoulderL: [0, 0, -6], shoulderR: [0, 0, 6], elbowL: -8, elbowR: -8, head: [0, 0, 0] },
    read: { shoulderL: [-55, 0, 10], shoulderR: [0, 0, 6], elbowL: -60, elbowR: -8, head: [12, 0, 0] },
    toss: { shoulderL: [-28, 0, -14], shoulderR: [-158, 0, 16], elbowL: -24, elbowR: -10, head: [-20, 0, 0] },
    "lean-in": { shoulderL: [-34, 0, -12], shoulderR: [-34, 0, 12], elbowL: -34, elbowR: -34, head: [22, 0, 4] },
    "lift-pie": { shoulderL: [-92, 0, -6], shoulderR: [-92, 0, 6], elbowL: -52, elbowR: -52, head: [-8, 0, 0] },
    "hold-pie-wide": { shoulderL: [-8, 0, -30], shoulderR: [-8, 0, 30], elbowL: -30, elbowR: -30, head: [-2, 0, 0] },
  },
};
// Film-only in-between holds (not game poses): Watson holding the ball
// at the chest, and both hands up to catch.
const HOLD = { shoulderL: [-8, 0, -8], shoulderR: [-48, 0, 4], elbowL: -14, elbowR: -78, head: [2, 0, 0] };
const CATCH = { shoulderL: [-70, 0, 12], shoulderR: [-70, 0, -12], elbowL: -40, elbowR: -40, head: [-6, 0, 0] };
const AIM = { shoulderL: [-10, 0, -8], shoulderR: [-82, 0, 6], elbowL: -14, elbowR: -16, head: [-4, 0, 0] };

// ── Band looks ─────────────────────────────────────────────────────────
// 7-10 brighter and softer, 10-18 the base warm daylight, 18+ a touch
// cooler and more realistic. Same staging, same beats, same timings.
const LOOK = {
  "7-10": { skyTop: 0x7cc4f2, skyLow: 0xfff0cf, sun: 0xfff1d6, sunI: 2.4, hemi: 1.45, ground: 0x9a8b70, fog: 0xf8e9cf, grade: [1.04, 1.0, 0.95], sat: 1.12, shadow: 0.42 },
  "10-18": { skyTop: 0x6aa9df, skyLow: 0xfbe3bd, sun: 0xffe2b0, sunI: 2.6, hemi: 1.2, ground: 0x8d7a5d, fog: 0xf3dcb8, grade: [1.05, 1.0, 0.92], sat: 1.04, shadow: 0.5 },
  "18+": { skyTop: 0x7ea7cf, skyLow: 0xe7e9e4, sun: 0xfff6ea, sunI: 2.5, hemi: 1.05, ground: 0x7d7a72, fog: 0xdfe3e2, grade: [0.99, 1.0, 1.02], sat: 0.94, shadow: 0.56 },
}[BAND];

// ── Small helpers ──────────────────────────────────────────────────────
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mixPose = (a, b, k) => ({
  shoulderL: lerp3(a.shoulderL, b.shoulderL, k), shoulderR: lerp3(a.shoulderR, b.shoulderR, k),
  elbowL: lerp(a.elbowL, b.elbowL, k), elbowR: lerp(a.elbowR, b.elbowR, k), head: lerp3(a.head, b.head, k),
});
// Seeded random so dressing is the same on every load.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ── Renderer, camera, scenes ───────────────────────────────────────────
const canvas = document.getElementById("film");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

// Locked wide shot: no moves, no zoom (owner rule from Cold Trail).
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
camera.position.set(0, 1.62, 8.9);
camera.lookAt(0, 1.42, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(LOOK.fog, 14, 46);
const linesScene = new THREE.Scene();

const rtBase = new THREE.WebGLRenderTarget(W * SS, H * SS, { samples: 4, type: THREE.HalfFloatType });
const rtLines = new THREE.WebGLRenderTarget(W * SS, H * SS, { samples: 4, type: THREE.HalfFloatType });

// ── Toon materials + ink outlines ──────────────────────────────────────
const gradient = (() => {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const INK = new THREE.Color(0x2a1f17);
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });

const inkMat = new THREE.ShaderMaterial({
  uniforms: { thick: { value: 0.012 }, ink: { value: INK }, fogColor: { value: new THREE.Color(LOOK.fog) }, fogNear: { value: 14 }, fogFar: { value: 46 } },
  vertexShader: `uniform float thick; varying float vDepth;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * thick * (1.0 + 0.04 * -mv.z);
      vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 ink; uniform vec3 fogColor; uniform float fogNear, fogFar; varying float vDepth;
    void main(){ float f = smoothstep(fogNear, fogFar, vDepth); gl_FragColor = vec4(mix(ink, fogColor, f), 1.0); }`,
  side: THREE.BackSide,
});

function outline(mesh, thick = 1) {
  if (!mesh.isMesh || mesh.userData.noInk) return;
  let g = mesh.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  const m = thick === 1 ? inkMat : inkMat.clone();
  if (thick !== 1) m.uniforms.thick.value = 0.012 * thick;
  const hull = new THREE.Mesh(g, m);
  hull.userData.noInk = true;
  hull.raycast = () => {};
  mesh.add(hull);
}

function toonify(root, { ink = true, shadows = true } = {}) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const src = o.material;
    if (!src.isMeshToonMaterial && !src.isShaderMaterial) {
      const glassy = src.transparent || src.opacity < 1 || /glass/.test(o.name);
      o.material = toon(src.color ?? 0xffffff, {
        map: src.map ?? null,
        emissive: src.emissive ?? new THREE.Color(0),
        emissiveIntensity: src.emissiveIntensity ?? 1,
        transparent: glassy, opacity: glassy ? 0.38 : 1, depthWrite: !glassy,
      });
      if (glassy) o.userData.noInk = true;
    }
    o.castShadow = shadows && !o.userData.noInk;
    o.receiveShadow = shadows;
    if (ink) outline(o);
  }
  return root;
}

// ── Build helpers for set dressing ─────────────────────────────────────
function mesh(geo, color, pos = [0, 0, 0], opts = {}) {
  const m = new THREE.Mesh(geo, opts.material ?? toon(color, opts.mat ?? {}));
  m.position.set(...pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = true;
  if (opts.ink !== false) outline(m, opts.inkThick ?? 1);
  (opts.parent ?? scene).add(m);
  return m;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// ── Sky, light, ground ─────────────────────────────────────────────────
function buildWorld() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(LOOK.skyTop) }, low: { value: new THREE.Color(LOOK.skyLow) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, low; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 2.4 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(low, top, pow(h, 0.8)), 1.0); }`,
    }),
  );
  scene.add(sky);

  // Sun low on the right, so shadows fall back-left across the paving.
  const sun = new THREE.DirectionalLight(LOOK.sun, LOOK.sunI);
  sun.position.set(6, 9, 6);
  sun.target.position.set(0, 0, -0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -4, near: 1, far: 30 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(LOOK.skyTop, LOOK.ground, LOOK.hemi));
  const bounce = new THREE.DirectionalLight(0xffe6c2, 0.35);
  bounce.position.set(-4, 2, 6);
  scene.add(bounce);

  // Paving: warm stone squares with soft grout, receding into haze.
  const paving = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = BAND === "18+" ? "#cfc8bb" : "#e3cfa8";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const v = 8 * (rnd() - 0.5);
      g.fillStyle = `rgba(${120 + v},${90 + v},${60 + v},0.07)`;
      g.fillRect(x * 128 + 4, y * 128 + 4, 120, 120);
    }
    g.strokeStyle = "rgba(110,80,50,0.28)";
    g.lineWidth = 4;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  }, [14, 10]);
  mesh(new THREE.PlaneGeometry(28, 20), 0xffffff, [0, 0, -7.7], { rot: [-Math.PI / 2, 0, 0], mat: { map: paving }, ink: false, cast: false });
  // Curb and road along the front edge.
  mesh(new THREE.BoxGeometry(28, 0.14, 0.3), BAND === "18+" ? 0xb9b4aa : 0xd8c4a0, [0, 0.07, 2.45], { ink: false });
  mesh(new THREE.PlaneGeometry(28, 4), BAND === "18+" ? 0x5d5f62 : 0x6b6560, [0, 0.005, 4.6], { rot: [-Math.PI / 2, 0, 0], ink: false, cast: false });
}

// ── Background layers: café facade, trees, far town, clouds ────────────
function buildBackdrop() {
  const wallCol = BAND === "7-10" ? 0xf2b88a : BAND === "18+" ? 0xc9a58a : 0xe6a77a;
  const wall = new THREE.Group();
  scene.add(wall);
  // Main facade, left half, set back behind the pair.
  mesh(new THREE.BoxGeometry(6.2, 5.6, 0.4), wallCol, [-3.6, 2.8, -3.2], { parent: wall });
  mesh(new THREE.BoxGeometry(6.4, 0.25, 0.6), 0xf7ead2, [-3.6, 5.65, -3.15], { parent: wall });
  // Annex wall continuing the facade to the right: the four cafe windows of the door beat sit across both.
  mesh(new THREE.BoxGeometry(5.4, 5.6, 0.4), wallCol, [2.2, 2.8, -3.2], { parent: wall });
  mesh(new THREE.BoxGeometry(5.6, 0.25, 0.6), 0xf7ead2, [2.2, 5.65, -3.15], { parent: wall });
  // Shopfront: big window, door, striped awning (no lettering anywhere).
  const glass = toon(0x8fc3d6, { emissive: new THREE.Color(0x3f6f80), emissiveIntensity: 0.35 });
  mesh(new THREE.BoxGeometry(2.4, 1.7, 0.08), 0, [-4.6, 1.35, -2.98], { material: glass, parent: wall });
  mesh(new THREE.BoxGeometry(2.6, 0.12, 0.2), 0x5a3b28, [-4.6, 0.45, -2.93], { parent: wall });
  mesh(new THREE.BoxGeometry(1.0, 2.1, 0.1), 0x5a7d6b, [-2.6, 1.05, -2.97], { parent: wall });
  mesh(new THREE.SphereGeometry(0.04, 8, 6), 0xd9a531, [-2.25, 1.05, -2.9], { parent: wall, ink: false });
  const stripes = canvasTex(256, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#fbf3df" : BAND === "18+" ? "#4f7f8c" : "#3e9c8c"; g.fillRect(i * 32, 0, 32, h); }
  });
  // Sloped striped awning over the shopfront, with a short valance.
  mesh(new THREE.BoxGeometry(3.1, 0.04, 0.95), 0xffffff, [-4.15, 2.62, -2.62], { rot: [0.5, 0, 0], mat: { map: stripes }, parent: wall });
  mesh(new THREE.BoxGeometry(3.1, 0.2, 0.03), 0xffffff, [-4.15, 2.32, -2.2], { mat: { map: stripes }, parent: wall });
  // Upper windows with flower-free sills and shutters.
  for (const x of [-5.6, -4.2]) {
    mesh(new THREE.BoxGeometry(0.75, 1.0, 0.06), 0, [x, 4.35, -2.98], { material: glass, parent: wall });
    mesh(new THREE.BoxGeometry(0.95, 0.1, 0.22), 0xf7ead2, [x, 3.8, -2.92], { parent: wall });
    mesh(new THREE.BoxGeometry(0.2, 1.05, 0.06), 0x4f8a7a, [x - 0.5, 4.35, -2.95], { parent: wall });
    mesh(new THREE.BoxGeometry(0.2, 1.05, 0.06), 0x4f8a7a, [x + 0.5, 4.35, -2.95], { parent: wall });
  }
  // A lower neighbour building stepping back to the right.
  mesh(new THREE.BoxGeometry(3.4, 3.6, 0.4), BAND === "18+" ? 0xb8b2a6 : 0xf4dcb0, [2.6, 1.8, -6.2]);
  mesh(new THREE.BoxGeometry(3.6, 0.3, 0.6), 0xa65d45, [2.6, 3.7, -6.15]);
  for (const x of [1.7, 2.6, 3.5]) mesh(new THREE.BoxGeometry(0.55, 0.8, 0.05), 0, [x, 2.3, -5.98], { material: glass });
  mesh(new THREE.BoxGeometry(6, 4.6, 0.4), BAND === "18+" ? 0xa9a39a : 0xe9c79a, [7.2, 2.3, -7.2]);

  // Rounded toon trees in two rows: crisp mid-ground, hazy far rows.
  const treeCol = BAND === "7-10" ? [0x6cc070, 0x58ad5f] : BAND === "18+" ? [0x6f9a6b, 0x5c875b] : [0x7bb661, 0x5f9f52];
  const tree = (x, z, s) => {
    mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 1.4 * s, 7), 0x7a5234, [x, 0.7 * s, z]);
    mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), treeCol[0], [x, 1.85 * s, z], { mat: { flatShading: true } });
    mesh(new THREE.IcosahedronGeometry(0.5 * s, 1), treeCol[1], [x + 0.35 * s, 1.55 * s, z + 0.25 * s], { mat: { flatShading: true } });
  };
  tree(1.0, -4.6, 1.15); tree(4.6, -4.4, 1.3); tree(-0.1, -9, 1.6); tree(5.2, -10.5, 1.7); tree(9, -9, 1.9);
  // Far town: simple blocks that melt into the haze.
  for (let i = 0; i < 14; i++) {
    const w = 1.5 + rnd() * 2.5, h = 3 + rnd() * 7;
    mesh(new THREE.BoxGeometry(w, h, 2), [0xe8c9a0, 0xd9b48c, 0xf0d9b5, 0xc9b7a3][i % 4], [-14 + i * 2.6 + rnd(), h / 2, -24 - rnd() * 6], { ink: false, cast: false });
  }
  // Soft cartoon clouds high in the sky (drift is applied per frame).
  const clouds = new THREE.Group();
  const cloudMat = toon(0xffffff, { fog: false, emissive: new THREE.Color(0xfff5e6), emissiveIntensity: 0.35 });
  for (let c = 0; c < 5; c++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloudMat);
      s.scale.set(1.6 + rnd(), 0.9 + rnd() * 0.5, 1);
      s.position.set(k * 1.5 - 3, rnd() * 0.6, rnd());
      g.add(s);
    }
    g.position.set(-22 + c * 11 + rnd() * 3, 13 + rnd() * 4, -45);
    g.userData.speed = 0.08 + rnd() * 0.08;
    clouds.add(g);
  }
  scene.add(clouds);
  return { clouds };
}

// ── Load GLBs ──────────────────────────────────────────────────────────
const loader = new GLTFLoader();
const load = (p) => new Promise((res, rej) => loader.load(MODELS + p, (g) => res(g.scene), undefined, rej));

function rig(model, tag) {
  const f = (n) => model.getObjectByName(`${tag}-${n}`);
  const j = { root: model, shoulderL: f("shoulder-l"), shoulderR: f("shoulder-r"), elbowL: f("elbow-l"), elbowR: f("elbow-r"),
    head: f("head"), hipL: f("hip-l"), hipR: f("hip-r") };
  // A hand marker at the end of each forearm, so props can follow it.
  const handY = tag === "H" ? -0.25 : -0.17;
  j.handR = new THREE.Object3D(); j.handR.position.set(0.01, handY, 0.03); j.elbowR.add(j.handR);
  j.handL = new THREE.Object3D(); j.handL.position.set(-0.01, handY, 0.03); j.elbowL.add(j.handL);
  return j;
}

function applyPose(j, p, extra = {}) {
  const set = (o, x, y, z) => o && o.rotation.set(x * D, y * D, z * D);
  set(j.shoulderL, p.shoulderL[0], p.shoulderL[1], p.shoulderL[2]);
  set(j.shoulderR, p.shoulderR[0], p.shoulderR[1], p.shoulderR[2]);
  set(j.elbowL, p.elbowL, 0, 0);
  set(j.elbowR, p.elbowR, 0, 0);
  set(j.head, p.head[0] + (extra.headX ?? 0), p.head[1] + (extra.headY ?? 0), p.head[2]);
  set(j.hipL, extra.hipL ?? 0, 0, 0);
  set(j.hipR, extra.hipR ?? 0, 0, 0);
}

// ── Gold lines (drawn only inside the lens by the composite pass) ──────
const GOLD = new THREE.Color(0xffb52e);
function goldLine(points, { closed = false, radius = 0.015, segs = 64 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, "catmullrom", 0);
  const geo = new THREE.TubeGeometry(curve, segs, radius, 6, closed);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthTest: false, depthWrite: false }));
  m.userData.segs = segs;
  m.frustumCulled = false;
  linesScene.add(m);
  return m;
}
// A straight polyline drawn as one tube with sharp corners.
const poly = (pts) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
    for (let k = 0; k < 16; k++) out.push(a.clone().lerp(b, k / 16).toArray());
  }
  out.push(pts[pts.length - 1]);
  return out;
};
function reveal(line, k, opacity) {
  const n = Math.floor(clamp01(k) * line.userData.segs);
  line.geometry.setDrawRange(0, n * 6 * 6);
  line.visible = n > 0 && opacity > 0.001;
  line.material.opacity = opacity;
}

// ── Composite pass: grade, vignette, lens with magnified view ──────────
const comp = new THREE.ShaderMaterial({
  uniforms: {
    base: { value: rtBase.texture }, lines: { value: rtLines.texture },
    res: { value: new THREE.Vector2(W, H) },
    lensC: { value: new THREE.Vector2() }, lensR: { value: 0 }, lensOn: { value: 0 },
    dockC: { value: new THREE.Vector2() }, dockR: { value: 0 }, beam: { value: 0 }, handC: { value: new THREE.Vector2() }, handle: { value: 0 },
    mag: { value: 1.16 }, grade: { value: new THREE.Vector3(...LOOK.grade) }, sat: { value: LOOK.sat },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D base, lines; uniform vec2 res, lensC, dockC, handC; uniform float lensR, lensOn, dockR, beam, mag, sat, handle;
    uniform vec3 grade; varying vec2 vUv;
    vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    vec3 glowAt(vec2 uv){
      vec3 g = vec3(0.0); float tot = 0.0;
      for (int i = 0; i < 12; i++){ float a = float(i) * 0.5236; for (int r = 1; r <= 2; r++){
        vec2 o = vec2(cos(a), sin(a)) * float(r) * 3.0 / res; float w = 1.0 / float(r);
        g += texture2D(lines, uv + o).rgb * w; tot += w; } }
      return g / tot;
    }
    void main(){
      vec2 px = vUv * res;
      vec3 col = texture2D(base, vUv).rgb;
      // Light beam from Holmes's lens to the travelling lens view.
      if (beam > 0.001){
        vec2 ab = lensC - dockC; float L = max(length(ab), 1.0); vec2 dir = ab / L;
        float t = clamp(dot(px - dockC, dir) / L, 0.0, 1.0);
        float w = mix(dockR, lensR * 0.92, t);
        float d = length(px - (dockC + dir * t * L));
        float inBeam = (1.0 - smoothstep(w * 0.55, w, d)) * smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.92, 1.0, t));
        col += vec3(1.0, 0.86, 0.5) * 0.16 * inBeam * beam;
      }
      float r = length(px - lensC);
      if (lensOn > 0.001){
        // Drop shadow of the rim on the world behind.
        float sh = (1.0 - smoothstep(lensR + 6.0, lensR + 22.0, length(px - lensC - vec2(5.0, -8.0)))) * step(lensR + 9.0, r);
        col *= 1.0 - 0.28 * sh * lensOn;
      }
      if (lensOn > 0.001 && r < lensR){
        vec2 uv = (lensC + (px - lensC) / mag) / res;
        vec3 inside = texture2D(base, uv).rgb * 1.06 + vec3(0.012, 0.01, 0.0);
        vec4 ln = texture2D(lines, uv);
        vec3 halo = glowAt(uv);
        inside = inside * (1.0 - 0.8 * ln.a) + vec3(1.0, 0.86, 0.42) * ln.a * 1.05 + halo * 1.1;
        // Glass highlight crescent, top-left.
        vec2 q = (px - lensC) / lensR;
        float hl = smoothstep(0.82, 0.7, length(q - vec2(-0.18, 0.2))) * smoothstep(0.55, 0.75, length(q - vec2(-0.05, 0.05)));
        inside += vec3(1.0) * 0.18 * hl;
        col = mix(col, inside, lensOn);
      }
      if (handle > 0.001){
        // Brass handle from the lens rim to Holmes's hand (the lens stays in his grip).
        vec2 ab = handC - lensC; float L = length(ab); vec2 dir = ab / max(L, 1.0);
        vec2 A = lensC + dir * (lensR + 4.0); vec2 ba = handC - A;
        float h = clamp(dot(px - A, ba) / max(dot(ba, ba), 1.0), 0.0, 1.0);
        float d = length(px - A - ba * h);
        float body = 1.0 - smoothstep(6.0, 7.0, d), edge = 1.0 - smoothstep(9.0, 10.0, d);
        vec3 hc = mix(vec3(0.16, 0.12, 0.09), mix(vec3(0.62, 0.38, 0.1), vec3(1.0, 0.8, 0.35), 0.5 + 0.5 * clamp((px.y - handC.y) * 0.05, -1.0, 1.0)), body);
        col = mix(col, hc, edge * handle * step(lensR + 6.0, L));
      }
      if (lensOn > 0.001){
        // Brass rim with ink lines, cartoon style.
        float rim = smoothstep(lensR - 1.0, lensR, r) * (1.0 - smoothstep(lensR + 11.0, lensR + 12.0, r));
        float shade = clamp((dot(normalize(px - lensC + 0.001), vec2(-0.6, 0.8)) + 1.0) * 0.5, 0.0, 1.0);
        vec3 brass = mix(vec3(0.62, 0.38, 0.1), vec3(1.0, 0.8, 0.35), shade);
        float ink = (1.0 - smoothstep(1.2, 2.6, abs(r - lensR))) + (1.0 - smoothstep(1.2, 2.6, abs(r - lensR - 12.0)));
        brass = mix(brass, vec3(0.16, 0.12, 0.09), clamp(ink, 0.0, 1.0));
        col = mix(col, brass, max(rim, clamp(ink, 0.0, 1.0) * step(lensR - 3.0, r) * step(r, lensR + 15.0)) * lensOn);
      }
      // Grade: warm balance, gentle saturation, soft vignette.
      col *= grade;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, sat);
      vec2 v = vUv - 0.5; v.x *= res.x / res.y;
      col *= 1.0 - 0.32 * smoothstep(0.45, 1.15, length(v));
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const quadScene = new THREE.Scene();
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp));
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const toScreen = (v) => {
  const p = v.clone().project(camera);
  return new THREE.Vector2((p.x * 0.5 + 0.5) * W, (p.y * 0.5 + 0.5) * H);
};
// Pixel radius of a world-space radius at a world point.
const pxRadius = (v, r) => {
  const a = toScreen(v);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  return toScreen(v.clone().addScaledVector(right, r)).distanceTo(a);
};

// ── The set ────────────────────────────────────────────────────────────
// Positions (metres): Holmes left, Watson right, lamp post centre-back
// with the shape beat, café table front-right. Key action stays inside
// the centre 60% of the frame (phones crop to full width × 180 px).
const SET = {
  holmes: new THREE.Vector3(-1.95, 0, 0.35),
  watsonStart: new THREE.Vector3(2.5, 0, 0.0),
  watsonCatch: new THREE.Vector3(1.72, 0, 0.5),
  watsonHold: new THREE.Vector3(1.7, 0, 1.9),
  post: new THREE.Vector3(0.55, 0, -1.5),
  table: BAND === "10-18" ? new THREE.Vector3(3.0, 0, 1.2) : new THREE.Vector3(0.72, 0, 1.6),
};
// 10-18 staging: Watson fetches the pie from the side table, then holds it
// face-on near x 1.0; the table stays out of the picture's middle.
const WP = {
  start: SET.watsonStart, catch: SET.watsonCatch,
  pick: new THREE.Vector3(2.2, 0, 1.15), hold: new THREE.Vector3(1.0, 0, 2.15),
};
function watsonPos1018(t) {
  const p = WP.start.clone().lerp(WP.catch, ramp(t, 1.6, 3.4));
  p.lerp(WP.pick, ramp(t, 4.0, 4.5));
  p.lerp(WP.hold, ramp(t, 4.9, 5.5));
  p.lerp(WP.pick, ramp(t, 6.9, 7.4));
  p.lerp(WP.start, ramp(t, 9.0, 9.8));
  return p;
}
// Holmes follows the lens along the facade during the door beat. S.hs holds
// the calibrated stop x per window (see calibrateDoor); S.hOverride forces x.
function holmesX1018(t) {
  if (S.hOverride !== undefined) return S.hOverride;
  let x = SET.holmes.x;
  if (!S.hs) return x;
  x = lerp(x, S.hs[0], ramp(t, 6.9, 7.4));
  for (let i = 0; i < 3; i++) x = lerp(x, S.hs[i + 1], ramp(t, DOOR_T[i] + 0.12, DOOR_T[i + 1] - 0.12));
  return lerp(x, SET.holmes.x, ramp(t, 9.0, 9.7));
}

const S = {};

async function build() {
  buildWorld();
  const back = buildBackdrop();
  S.clouds = back.clouds;

  const names = ["lens", "ball", "ladder", "lamp-post", "cafe-table", "pie", "swing-set", "hose-nozzle", "bridge", "bowls"];
  const [holmes, watson, ...props] = await Promise.all([
    load("detective/holmes.glb"), load("detective/watson.glb"),
    ...names.map((n) => load(`why-learn/${n}.glb`)),
  ]);
  const P = Object.fromEntries(names.map((n, i) => [n, props[i]]));

  // The game's Watson carries a notebook and his own small lens; in this
  // film Holmes holds the lens and Watson plays, so hide those (scene
  // only, the GLB is untouched).
  watson.traverse((o) => { if (o.isMesh && /^(brass|lens|notebook)/.test(o.material?.name ?? "")) o.visible = false; });
  toonify(holmes); toonify(watson);
  holmes.position.copy(SET.holmes);
  watson.position.copy(SET.watsonStart);
  scene.add(holmes, watson);
  S.H = rig(holmes, "H");
  S.W = rig(watson, "W");

  // Holmes's lens, a touch oversized (cartoon scale) so it reads.
  S.lens = toonify(P.lens);
  S.lens.scale.setScalar(1.7);
  scene.add(S.lens);
  S.lensGlass = S.lens.getObjectByName("lens-glass");

  // Lamp post always stands at the corner; the street's anchor.
  const post = toonify(P["lamp-post"]);
  post.position.copy(SET.post);
  if (BAND === "18+") post.position.set(-0.4, 0, -2.4);
  if (BAND === "7-10") post.position.set(3.2, 0, -2.0);
  scene.add(post);

  const table = toonify(P["cafe-table"]);
  S.table = table;
  table.position.copy(SET.table);
  scene.add(table);
  S.table = table;
  // A café chair outside the shopfront, for the street-life feel.
  const chair = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), 0x3e9c8c, [0, 0.46, 0], { parent: chair });
  mesh(new THREE.BoxGeometry(0.36, 0.42, 0.03), 0x3e9c8c, [0, 0.7, -0.18], { parent: chair, rot: [-0.12, 0, 0] });
  for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 6), 0x2f3b45, [x, 0.23, z], { parent: chair });
  chair.position.set(-3.7, 0, -2.25);
  chair.rotation.y = 0.5;
  scene.add(chair);
  // Planters with round shrubs flanking the shopfront.
  for (const [x, z] of [[-5.4, -2.4], [-1.25, -2.5]]) {
    mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), 0xb5643f, [x, 0.225, z]);
    mesh(new THREE.IcosahedronGeometry(0.38, 1), 0x6aa85a, [x, 0.72, z], { mat: { flatShading: true } });
  }

  // ── Band objects ──
  S.ball = toonify(P.ball);
  S.ball.scale.setScalar(1.15);
  scene.add(S.ball);
  S.pie = toonify(P.pie);
  S.pie.scale.setScalar(1.1);
  S.pie.position.set(SET.table.x, 0.77, SET.table.z);
  S.pie.rotation.y = 0.2;
  scene.add(S.pie);

  if (BAND === "7-10") {
    // Pizza: the same 8-slice mesh in cheese and crust, with toppings.
    S.pie.traverse((o) => {
      if (!o.isMesh || o.userData.noInk) return;
      if (/crust/.test(o.name)) o.material = toon(0xe0a250);
      else if (/^slice-\d$/.test(o.name)) o.material = toon(0xffd05a);
    });
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * Math.PI / 4;
      mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 10), 0xd2462f, [Math.cos(a) * 0.11, 0.068, -Math.sin(a) * 0.11], { parent: S.pie, ink: false, cast: false });
    }
    S.swing = toonify(P["swing-set"]);
    S.swing.position.set(SET.post.x - 0.35, 0, SET.post.z - 0.2);
    scene.add(S.swing);
    S.swingPivot = S.swing.getObjectByName("swing-pivot");
  } else if (BAND === "10-18") {
    S.ladder = toonify(P.ladder);
    scene.add(S.ladder);
  } else {
    // 18+: hose, bucket, bridge and bowls live in band-18plus.js
    S.b18 = createBand18({ scene, S, mesh, toon, toonify, goldLine, poly, reveal, ramp, smooth, clamp01, lerp, toScreen, updateScene });
    S.b18.build(P);
  }

  buildDoorRow();
  buildLines();
  if (BAND === "7-10") S.b = B710.setup({ THREE, scene, linesScene, S, mesh, SET, ramp, smooth, lerp, clamp01, arcAt, D, applyPose, mixPose, POSES, CATCH, HOLD });
  if (B1018) calibrateDoor();
}

// Door beat (10-18): find where Holmes must stand so the lens, held at the
// end of a short brass handle, sits on each window. Hand lands about 60 px
// left of the window centre; the view hangs up-right of the hand.
const DOOR_HAND_DX = -60;
function calibrateDoor() {
  S.hs = null;
  const stops = [];
  for (let i = 0; i < 4; i++) {
    let x = SET.holmes.x;
    for (let it = 0; it < 4; it++) {
      S.hOverride = x;
      updateScene(DOOR_T[i]);
      const hand = new THREE.Vector3(); S.H.handR.getWorldPosition(hand);
      const win = toScreen(S.win[i].center);
      const err = toScreen(hand).x - (win.x + DOOR_HAND_DX);
      x -= err / 134;
    }
    stops.push(x);
  }
  S.hOverride = undefined;
  S.hs = stops;
}

// ── Paths and gold line geometry per band ──────────────────────────────
function buildLines() {
  S.L = {};
  updateScene(0); // put hands where they start, to read release points
  scene.updateMatrixWorld(true);
  if (S.b18) { S.b18.buildLines(); return; }

  if (BAND !== "18+") {
    // Ball flight: released over Watson's head at 1.3 s, caught at 3.7 s
    // after he scoots left under it. A true parabola (constant x speed).
    const a = new THREE.Vector3(SET.watsonStart.x - 0.15, 2.0, SET.watsonStart.z + 0.1);
    const b = new THREE.Vector3(SET.watsonCatch.x - 0.05, 1.0, SET.watsonCatch.z + 0.32);
    S.arc = { a, b, apex: BAND === "10-18" ? 2.6 : 3.0, t0: 1.3, t1: 3.7 };
  } else {
    // Hose water: from the nozzle in Watson's hand into the bucket.
    const a = new THREE.Vector3(SET.watsonCatch.x - 0.45, 1.05, SET.watsonCatch.z + 0.3);
    const b = new THREE.Vector3(-0.25, 0.3, 0.75);
    S.arc = { a, b, apex: 2.45, t0: 1.3, t1: 3.1 };
  }
  const arcPts = [];
  for (let i = 0; i <= 48; i++) arcPts.push(arcAt(i / 48).toArray());
  S.L.arc = goldLine(arcPts, { segs: 96 });

  if (BAND === "10-18") {
    // Ladder, post and ground as a right triangle; arc at the foot.
    const foot = new THREE.Vector3(SET.post.x - 1.05, 0.02, SET.post.z + 0.12);
    const top = new THREE.Vector3(SET.post.x - 0.08, Math.sqrt(2.6 ** 2 - 0.97 ** 2), SET.post.z + 0.12);
    const corner = new THREE.Vector3(SET.post.x - 0.08, 0.02, SET.post.z + 0.12);
    S.ladder.position.copy(foot).setY(0);
    S.ladder.rotation.set(0, 0, -Math.atan2(top.x - foot.x, top.y - foot.y));
    S.tri = { foot, top, corner };
    S.L.tri = goldLine(poly([foot.toArray(), top.toArray(), corner.toArray(), foot.toArray()]), { segs: 144, radius: 0.022 });
    const ang = Math.atan2(top.y - foot.y, top.x - foot.x), arc = [];
    for (let i = 0; i <= 20; i++) { const k = (i / 20) * ang; arc.push([foot.x + Math.cos(k) * 0.42, foot.y + Math.sin(k) * 0.42, foot.z]); }
    S.L.angle = goldLine(arc, { segs: 40, radius: 0.02 });
    const sq = 0.16;
    S.L.square = goldLine(poly([[corner.x - sq, 0.02, corner.z], [corner.x - sq, sq, corner.z], [corner.x, sq, corner.z]]), { segs: 32, radius: 0.014 });
    S.shapeFocus = foot.clone().add(top).add(corner).multiplyScalar(1 / 3);
    S.shapeR = 1.45;
  } else if (BAND === "7-10") {
    // Swing: chains from the bar to the seat at full swing, the plumb
    // line down to the seat at rest, and the seat's arc.
    S.swing.updateMatrixWorld(true);
    const pivot = new THREE.Vector3(); S.swingPivot.getWorldPosition(pivot);
    const len = 1.66, amp = 0.62;
    const rest = pivot.clone().add(new THREE.Vector3(0, -len, 0));
    const out = pivot.clone().add(new THREE.Vector3(0, -Math.cos(amp) * len, Math.sin(amp) * len));
    // The swing hangs in the YZ plane, which faces the camera edge-on;
    // turn the set so its swing plane faces the camera.
    S.swing.rotation.y = Math.PI / 2;
    S.swing.updateMatrixWorld(true);
    S.swingPivot.getWorldPosition(pivot);
    const swingPt = (k) => pivot.clone().add(new THREE.Vector3(-Math.sin(k) * len, -Math.cos(k) * len, 0));
    const r0 = swingPt(0), r1 = swingPt(amp);
    S.L.tri = goldLine(poly([pivot.toArray(), r1.toArray(), r0.toArray(), pivot.toArray()]), { segs: 144, radius: 0.022 });
    const arc = [];
    for (let i = 0; i <= 24; i++) arc.push(swingPt(-amp + (2 * amp * i) / 24).toArray());
    S.L.angle = goldLine(arc, { segs: 48, radius: 0.02 });
    const a2 = [];
    for (let i = 0; i <= 12; i++) { const k = (i / 12) * amp; a2.push(pivot.clone().add(new THREE.Vector3(-Math.sin(k) * 0.4, -Math.cos(k) * 0.4, 0)).toArray()); }
    S.L.square = goldLine(a2, { segs: 24, radius: 0.014 });
    S.swingAmp = amp;
    S.shapeFocus = pivot.clone().lerp(r0, 0.55);
    S.shapeR = 1.25;
    void rest; void out;
  } else {
    // Bridge: tower, deck and the outer cable on each side as triangles.
    S.bridge.updateMatrixWorld(true);
    const w = (x, y) => S.bridge.localToWorld(new THREE.Vector3(x, y, 0.33));
    const top = w(0, 1.4), base = w(0, 0.06), l = w(-1.5, 0.06), r = w(1.5, 0.06);
    S.L.tri = goldLine(poly([l.toArray(), top.toArray(), r.toArray(), l.toArray()]), { segs: 144, radius: 0.022 });
    S.L.square = goldLine(poly([top.toArray(), base.toArray()]), { segs: 24, radius: 0.016 });
    const ang = Math.atan2(top.y - l.y, top.x - l.x), arc = [];
    for (let i = 0; i <= 20; i++) { const k = (i / 20) * ang; arc.push([l.x + Math.cos(k) * 0.42, l.y + Math.sin(k) * 0.42, l.z]); }
    S.L.angle = goldLine(arc, { segs: 40, radius: 0.02 });
    S.shapeFocus = top.clone().add(l).add(r).multiplyScalar(1 / 3).add(new THREE.Vector3(0, 0.08, 0));
    S.shapeR = 1.55;
  }

  // Split beat: equal slices on the pie or pizza; or one bowl to three.
  // Pie lines are built in the pie's own frame and follow it every frame.
  if (BAND !== "18+") {
    S.pieLines = [];
    S.slices = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => S.pie.getObjectByName("slice-" + i));
    const y = 0.072, RR = 0.205;
    S.L.slices = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      S.L.slices.push(goldLine([[-Math.cos(a) * RR, y, Math.sin(a) * RR], [Math.cos(a) * RR, y, -Math.sin(a) * RR]], { segs: 24, radius: 0.0075 }));
    }
    const ring = [];
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; ring.push([Math.cos(a) * RR, y, Math.sin(a) * RR]); }
    S.L.ring = goldLine(ring, { segs: 80, radius: 0.0075 });
    S.pieLines.push(...S.L.slices, S.L.ring);
    S.splitFocus = new THREE.Vector3();
    S.splitR = 0.5;
  } else {
    S.bowls.updateMatrixWorld(true);
    const c = new THREE.Vector3(); S.bowl[0].getWorldPosition(c);
    const top = c.clone().add(new THREE.Vector3(0, 0.22, 0));
    const left = c.clone().add(new THREE.Vector3(-0.375, 0.22, 0)), right = c.clone().add(new THREE.Vector3(0.375, 0.22, 0));
    S.L.slices = [
      goldLine(poly([top.toArray(), left.toArray(), left.clone().add(new THREE.Vector3(0, -0.06, 0)).toArray()]), { segs: 32, radius: 0.009 }),
      goldLine(poly([top.toArray(), right.toArray(), right.clone().add(new THREE.Vector3(0, -0.06, 0)).toArray()]), { segs: 32, radius: 0.009 }),
      goldLine(poly([top.toArray(), top.clone().add(new THREE.Vector3(0, -0.06, 0)).toArray()]), { segs: 8, radius: 0.009 }),
    ];
    S.L.ring = goldLine(poly([left.toArray(), right.toArray()]), { segs: 32, radius: 0.007 });
    S.splitFocus = c.clone().add(new THREE.Vector3(0, 0.1, 0));
    S.splitR = 0.62;
  }
}

function arcAt(k) {
  // Parabola through a and b with the given apex height, x linear in k.
  const { a, b, apex } = S.arc;
  const x = lerp(a.x, b.x, k), z = lerp(a.z, b.z, k);
  // y(k) = quadratic through (0,a.y), (1,b.y) with max = apex.
  const A = a.y, B = b.y, Hh = apex;
  // Solve for vertex position kv so the max equals Hh.
  const s1 = Math.sqrt(Hh - A), s2 = Math.sqrt(Hh - B), kv = s1 / (s1 + s2);
  const c = (Hh - A) / (kv * kv);
  return new THREE.Vector3(x, Hh - c * (k - kv) ** 2, z);
}

// ── Timeline: everything as a pure function of t ───────────────────────
// 0.0-1.0 poster pose. 1.0-3.0 the arc. 3.0-5.0 the shape. 5.0-6.5 the
// split. 6.5-8.0 lens back, glance, nod, lines fade; t=8 equals t=0.
const tmp = new THREE.Vector3();

function updateScene(t) {
  const H = S.H, Wt = S.W;
  // Holmes: lens-sweep throughout, body and head follow the lens target.
  const sweep = POSES.holmes["lens-sweep"];
  const look = lensPlan(t);
  const hTurn = 28 + look.turn;
  H.root.rotation.y = hTurn * D;
  let hStride = 0;
  if (B1018) {
    const hx = holmesX1018(t), hx2 = holmesX1018(t + 0.03);
    H.root.position.x = hx;
    const moving = Math.abs(hx2 - hx) / 0.03 > 0.25;
    hStride = moving ? Math.sin(t * 14) : 0;
    H.root.position.y = moving ? Math.abs(Math.cos(t * 14)) * 0.02 : 0;
  }
  const breathe = Math.sin(t * Math.PI * 2 / 5) * 1.2; // 5 s period, loops at 10 s
  const glance = ramp(t, 9.05, 9.4) * (1 - ramp(t, 9.55, 9.85));
  applyPose(H, {
    ...sweep,
    shoulderR: [sweep.shoulderR[0] + look.armX, sweep.shoulderR[1] + look.armY, sweep.shoulderR[2]],
  }, { headX: look.headX + breathe, headY: look.headY + glance * 22, hipL: 20 * hStride, hipR: -20 * hStride });

  // Watson.
  const walkTo = ramp(t, 1.6, 3.4), walkBack = ramp(t, 9.0, 9.8);
  // Split beat: Watson steps forward to hold the pie face-on to the camera.
  const kLift = ramp(t, 5.0, 5.6) * (1 - ramp(t, 6.9, 7.4));
  const pos = BAND === "18+" ? SET.watsonCatch.clone() : SET.watsonStart.clone().lerp(SET.watsonCatch, walkTo * (1 - walkBack));
  if (BAND !== "18+" && !B1018) pos.lerp(SET.watsonHold, kLift);
  if (B1018) pos.copy(watsonPos1018(t));
  Wt.root.position.copy(pos);
  const kHold = B1018 ? ramp(t, 4.9, 5.5) * (1 - ramp(t, 6.9, 7.4)) : kLift;
  const walking = B1018 ? watsonPos1018(t + 0.03).distanceTo(pos) / 0.03 > 0.25
    : BAND !== "18+" && ((t > 1.6 && t < 3.4) || (t > 5.0 && t < 5.6) || (t > 6.9 && t < 7.4) || (t > 9.0 && t < 9.8));
  const stride = walking ? Math.sin(t * 14) : 0;
  let p, headX = 0, lean = 0;
  if (BAND !== "18+") {
    p = mixPose(HOLD, POSES.watson.toss, ramp(t, 1.0, 1.3));
    p = mixPose(p, mixPose(POSES.watson.walk, { ...POSES.watson.walk, head: [-22, 0, 0] }, 1), ramp(t, 1.7, 2.2));
    p = mixPose(p, CATCH, ramp(t, 3.3, 3.65));
    p = mixPose(p, HOLD, ramp(t, 3.72, 3.98)); // ball down to the chest, face clear
    if (B1018) {
      p = mixPose(p, POSES.watson["hold-pie-wide"], ramp(t, 4.75, 5.4));
      p = mixPose(p, HOLD, ramp(t, 6.95, 7.5));
    } else {
      p = mixPose(p, POSES.watson["lift-pie"], ramp(t, 5.0, 5.6));
      p = mixPose(p, HOLD, ramp(t, 6.9, 7.4));
    }
  } else {
    p = mixPose(HOLD, AIM, ramp(t, 0.9, 1.3));
    p = mixPose(p, POSES.watson["lean-in"], ramp(t, 5.1, 5.6));
    p = mixPose(p, HOLD, ramp(t, 6.9, 7.4));
  }
  lean = kHold;
  const nod = ramp(t, 9.45, 9.6) * (1 - ramp(t, 9.65, 9.85));
  headX = nod * 12 + Math.sin(t * Math.PI * 2 / 5 + 1) * 1.2;
  // Watson turns toward the table to lean in, then back to Holmes.
  Wt.root.rotation.set(lean * (BAND === "18+" ? 14 : 3) * D, (-28 + (BAND === "18+" ? -lean * 22 : B1018 ? lean * 28 : -lean * 12) + walkTo * (1 - walkBack) * 6 * (B1018 ? 0 : 1)) * D, 0);
  Wt.root.position.y = walking ? Math.abs(Math.cos(t * 14)) * 0.025 : 0;
  // A small delighted bounce while leaning in.
  if (BAND === "18+") Wt.root.position.y += lean * Math.max(0, Math.sin((t - 5.6) * 9)) * 0.03 * ramp(t, 5.6, 5.8);
  applyPose(Wt, p, { headX, hipL: 22 * stride, hipR: -22 * stride });

  scene.updateMatrixWorld(true);

  // Lens prop rides Holmes's right hand, glass up, tilted to his gaze.
  H.handR.getWorldPosition(tmp);
  S.lens.position.copy(tmp);
  S.lens.rotation.set(-0.15, (hTurn - 10) * D, -0.25 + look.lensTilt);

  // Ball: in Watson's right hand, in flight, caught, then held.
  if (S.arc && BAND !== "18+") {
    const { t0, t1 } = S.arc;
    if (t < t0 || t >= 3.98) { Wt.handR.getWorldPosition(tmp); S.ball.position.copy(tmp).add(new THREE.Vector3(0, 0.06, 0.06)); }
    else if (t < t1) S.ball.position.copy(arcAt((t - t0) / (t1 - t0)));
    else {
      const l = new THREE.Vector3(), r = new THREE.Vector3();
      Wt.handL.getWorldPosition(l); Wt.handR.getWorldPosition(r);
      const held = l.add(r).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.05, 0.08));
      // Settle in from the catch point over 0.15 s.
      S.ball.position.copy(arcAt(1)).lerp(held, ramp(t, t1, t1 + 0.15));
      // Then into the right hand as the arms come down to the chest.
      Wt.handR.getWorldPosition(tmp);
      S.ball.position.lerp(tmp.add(new THREE.Vector3(0, 0.06, 0.06)), ramp(t, 3.72, 3.98));
    }
    if (B1018) {
      // Tucked under Watson's arm while he works with the pie: no pop.
      const rest = Wt.root.localToWorld(new THREE.Vector3(-0.3, 0.86, 0.14));
      Wt.handR.getWorldPosition(tmp); tmp.add(new THREE.Vector3(0, 0.06, 0.06));
      const away = ramp(t, 4.05, 4.6) * (1 - ramp(t, 8.9, 9.4));
      if (t >= 3.98) S.ball.position.copy(tmp).lerp(rest, away);
      if (t >= 3.98) S.ball.position.y += Math.sin(Math.PI * clamp01(ramp(t, 4.05, 4.6))) * 0.1 + Math.sin(Math.PI * clamp01(ramp(t, 8.9, 9.4))) * 0.1;
      S.ball.visible = true;
    } else S.ball.visible = t < 5.0 || t > 7.2; // tucked away while Watson holds the pie
    S.ball.rotation.set(t * 4, t * 2.5, 0);
  }
  if (S.b18) S.b18.update(t);
  // Swing: a 2 s pendulum, four full swings per loop.
  if (S.swingPivot) S.swingPivot.rotation.z = Math.sin(t * Math.PI) * (S.swingAmp ?? 0.6) * 0.95;
  if (BAND !== "18+") updatePie(t, B1018 ? smooth(ramp(t, 4.75, 5.4)) * (1 - smooth(ramp(t, 6.95, 7.5))) : kLift);
  if (S.b) S.b.update(t);
  if (S.win) updateDoor(t);
  if (S.clouds) S.clouds.children.forEach((c) => { c.userData.x0 ??= c.position.x; c.position.x = c.userData.x0 + Math.sin(t * Math.PI / 5) * c.userData.speed * 4; });
}

// ── Split beat (pie / pizza bands): the pie is lifted and held face-on ──
// Slice k spans angles k*45..(k+1)*45 deg in the pie's own frame (see
// build_props.py); turned up 90 deg about X, local (cos a, y, -sin a)
// lands at screen (cos a, sin a), so the angles read anticlockwise.
const PIE_SCALE_TABLE = 1.1, PIE_SCALE_HELD = 2.0, PIE_SCALE_HELD_1018 = 1.8, LIFTED = B1018 ? 0 : 1;
function updatePie(t, kLift) {
  if (!S.slices) return; // first call happens while lines are still being built
  const tablePos = new THREE.Vector3(SET.table.x, 0.77, SET.table.z);
  const Wt = S.W;
  const hl = new THREE.Vector3(), hr = new THREE.Vector3();
  Wt.handL.getWorldPosition(hl); Wt.handR.getWorldPosition(hr);
  const held = B1018 ? hl.clone().add(hr).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.05, 0.1))
    : hl.add(hr).multiplyScalar(0.5).add(new THREE.Vector3(-0.62, 0.45, 0.3));
  const e = smooth(kLift);
  S.pie.position.copy(tablePos).lerp(held, e);
  S.pie.position.y += Math.sin(Math.PI * clamp01(e)) * 0.12; // little arc as it rises
  // Held pie tips a touch back toward the camera so the face-on disc is a full ellipse.
  S.pie.rotation.set(e * (Math.PI / 2 - (B1018 ? 0.5 : 0)), 0.2 * (1 - e), 0);
  S.pie.scale.setScalar(lerp(PIE_SCALE_TABLE, B1018 ? PIE_SCALE_HELD_1018 : PIE_SCALE_HELD, e));
  // Cuts open a hair, then one slice lifts out and holds.
  const spread = ramp(t, 5.75, 5.95) * (1 - ramp(t, 6.8, 7.0));
  const out = ramp(t, 5.95, 6.2) * (1 - ramp(t, 6.75, 7.0));
  S.slices.forEach((sl, i) => {
    const a = (i + 0.5) * Math.PI / 4, d = 0.012 * spread + (i === LIFTED ? 0.11 * out : 0);
    sl.position.set(Math.cos(a) * d, i === LIFTED ? 0.07 * out : 0, -Math.sin(a) * d);
  });
  S.pie.updateMatrixWorld(true);
  for (const l of S.pieLines) { l.matrixAutoUpdate = false; l.matrix.copy(S.pie.matrixWorld); l.matrixWorldNeedsUpdate = true; }
}

// ── Door beat: four cafe windows, each lights ~0.4 s with one glimpse ──
const DOOR_T = [7.6, 8.0, 8.4, 8.8]; // glimpse centres (s)
const GOLDMAT = () => toon(0xffc23a, { emissive: new THREE.Color(0xffa000), emissiveIntensity: 0.6 });
function buildDoorRow() {
  S.win = [];
  const dark = 0x5a3b28, w = 1.25, h = 1.35, th = 0.13;
  (B1018 ? [-1.93, -0.73, 0.47, 1.67] : [-2.25, -0.75, 0.75, 2.25]).forEach((off, i) => {
    const g = new THREE.Group();
    g.position.set(SET.post.x + off, 2.8, -2.97);
    if (B1018) g.scale.setScalar(0.92);
    scene.add(g);
    mesh(new THREE.BoxGeometry(w, th, 0.14), dark, [0, h / 2 - th / 2, 0.02], { parent: g });
    mesh(new THREE.BoxGeometry(w, th, 0.14), dark, [0, -h / 2 + th / 2, 0.02], { parent: g });
    mesh(new THREE.BoxGeometry(th, h, 0.14), dark, [-w / 2 + th / 2, 0, 0.02], { parent: g });
    mesh(new THREE.BoxGeometry(th, h, 0.14), dark, [w / 2 - th / 2, 0, 0.02], { parent: g });
    mesh(new THREE.BoxGeometry(w + 0.2, 0.1, 0.24), 0xf7ead2, [0, -h / 2 - 0.04, 0.07], { parent: g });
    const paneMat = toon(0x35505f, { emissive: new THREE.Color(0x0a1218), emissiveIntensity: 1 });
    mesh(new THREE.BoxGeometry(w - 2 * th, h - 2 * th, 0.04), 0, [0, 0, -0.03], { material: paneMat, parent: g, ink: false, cast: false });
    const prop = new THREE.Group();
    prop.position.set(0, 0, 0.1);
    g.add(prop);
    S.win.push({ g, paneMat, prop, i, center: g.position.clone() });
  });
  // 0 pendulum (physics)
  { const pr = S.win[0].prop;
    mesh(new THREE.BoxGeometry(0.56, 0.06, 0.08), 0xd9a531, [0, 0.5, 0], { parent: pr });
    const L = 0.8, amp = 0.55;
    const sw = new THREE.Group(); sw.position.set(0, 0.5, 0.02); pr.add(sw);
    mesh(new THREE.CylinderGeometry(0.014, 0.014, L, 6), 0xfff0c0, [0, -L / 2, 0], { parent: sw, ink: false, cast: false });
    mesh(new THREE.SphereGeometry(0.13, 18, 14), 0, [0, -L, 0], { material: GOLDMAT(), parent: sw });
    S.win[0].sw = sw; S.win[0].amp = amp;
    for (let k = -3; k <= 3; k++) { // dotted path of the swing
      const a = (k / 3) * amp;
      mesh(new THREE.SphereGeometry(0.03, 8, 6), 0xffe9a0, [Math.sin(a) * L, 0.5 - Math.cos(a) * L, -0.01], { parent: pr, ink: false, cast: false, mat: { emissive: new THREE.Color(0xffc060), emissiveIntensity: 0.7 } });
    } }
  // 1 bubbles in a glass (chemistry)
  { const pr = S.win[1].prop, c = S.win[1];
    const glassMat = toon(0xdff6ff, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color(0x9fd8ee), emissiveIntensity: 0.4 });
    mesh(new THREE.CylinderGeometry(0.31, 0.25, 0.86, 20, 1, true), 0, [0, 0, 0], { material: glassMat, parent: pr, cast: false });
    mesh(new THREE.CylinderGeometry(0.28, 0.245, 0.6, 20), 0x8fe0ee, [0, -0.12, 0], { parent: pr, ink: false, mat: { emissive: new THREE.Color(0x3a9cae), emissiveIntensity: 0.7 } });
    mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.04, 20), 0xdff6ff, [0, -0.44, 0], { parent: pr });
    c.bub = [];
    for (let k = 0; k < 7; k++) {
      const r = 0.06 + (k % 3) * 0.03;
      const b = mesh(new THREE.SphereGeometry(r, 14, 10), 0, [0, 0, 0.27], { material: toon(0xfff6cc, { emissive: new THREE.Color(0xffc040), emissiveIntensity: 0.55 }), parent: pr });
      b.userData = { x: [-0.17, 0.05, 0.18, -0.06, 0.13, -0.19, 0.0][k], ph: k / 7, sp: 0.6 + (k % 3) * 0.12 };
      c.bub.push(b);
    } }
  // 2 route on a folded map (social studies): generic terrain, dotted route, no marks
  { const pr = S.win[2].prop, c = S.win[2];
    const map = new THREE.Group(); map.rotation.x = -0.1; pr.add(map);
    const panels = [];
    for (let k = 0; k < 3; k++) {
      const pn = new THREE.Group();
      pn.position.set((k - 1) * 0.33, 0, 0); pn.rotation.y = k === 1 ? -0.3 : 0.3; map.add(pn);
      mesh(new THREE.BoxGeometry(0.34, 0.8, 0.02), k === 1 ? 0xe8d4a0 : 0xf6e7c0, [0, 0, 0], { parent: pn });
      panels.push(pn);
    }
    const flat = (pn, col, w2, h2, x, y) => mesh(new THREE.BoxGeometry(w2, h2, 0.012), col, [x, y, 0.014], { parent: pn, ink: false, cast: false });
    flat(panels[0], 0x8cc063, 0.24, 0.22, 0, 0.22); flat(panels[0], 0x6fb7e0, 0.07, 0.5, 0.08, -0.12);
    flat(panels[1], 0x6fb7e0, 0.07, 0.42, -0.02, 0.1); flat(panels[1], 0x8cc063, 0.22, 0.2, 0.0, -0.24);
    flat(panels[2], 0xb98a55, 0.2, 0.18, 0, 0.18); flat(panels[2], 0x8cc063, 0.22, 0.24, 0.0, -0.2);
    for (const [pn, x, y] of [[panels[2], -0.03, 0.2], [panels[2], 0.07, 0.16]]) mesh(new THREE.ConeGeometry(0.06, 0.1, 5), 0x8a6238, [x, y, 0.03], { parent: pn });
    // dotted route winding across all three panels
    c.dots = [];
    const N = 15;
    for (let k = 0; k < N; k++) {
      const s = k / (N - 1), x = -0.5 + s * 1.0, y = -0.26 + 0.5 * s + 0.12 * Math.sin(s * 9);
      const pn = panels[Math.min(2, Math.floor((x + 0.5) / 0.333))];
      const d = mesh(new THREE.SphereGeometry(0.048, 10, 8), 0, [x - pn.position.x, y, 0.04], { material: GOLDMAT(), parent: pn, ink: false, cast: false });
      c.dots.push(d);
    }
    // destination: a gold pin (sphere on a cone), not a cross or letter
    const pin = new THREE.Group(); pin.position.set(0.17, 0.4, 0.05); panels[2].add(pin);
    mesh(new THREE.SphereGeometry(0.085, 12, 10), 0, [0, 0.09, 0], { material: GOLDMAT(), parent: pin });
    mesh(new THREE.ConeGeometry(0.055, 0.13, 8), 0, [0, 0, 0], { material: GOLDMAT(), parent: pin, rot: [Math.PI, 0, 0] });
    c.pin = pin; }
  // 3 old clock tower (history): face unmarked
  { const pr = S.win[3].prop;
    const tw = new THREE.Group(); tw.scale.setScalar(0.62); tw.position.set(0, -0.12, 0); pr.add(tw);
    mesh(new THREE.BoxGeometry(0.62, 1.3, 0.55), 0xcdb48d, [0, 0, 0], { parent: tw });
    mesh(new THREE.BoxGeometry(0.72, 0.1, 0.65), 0xa68d68, [0, 0.7, 0], { parent: tw });
    mesh(new THREE.ConeGeometry(0.5, 0.55, 4), 0xa6493a, [0, 1.02, 0], { parent: tw, rot: [0, Math.PI / 4, 0] });
    mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 28), 0xfff5dc, [0, 0.33, 0.29], { parent: tw, rot: [Math.PI / 2, 0, 0], mat: { emissive: new THREE.Color(0xffd070), emissiveIntensity: 0.55 } });
    mesh(new THREE.TorusGeometry(0.235, 0.03, 8, 28), 0x5a3b28, [0, 0.33, 0.3], { parent: tw });
    mesh(new THREE.BoxGeometry(0.035, 0.17, 0.02), 0x3a2a20, [0, 0.4, 0.33], { parent: tw, ink: false });
    mesh(new THREE.BoxGeometry(0.03, 0.13, 0.02), 0x3a2a20, [0.06, 0.31, 0.335], { parent: tw, ink: false, rot: [0, 0, 1.1] });
    mesh(new THREE.BoxGeometry(0.16, 0.34, 0.03), 0x4a3a30, [0, -0.3, 0.28], { parent: tw });
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), 0x4a3a30, [0, -0.13, 0.28], { parent: tw, rot: [Math.PI / 2, 0, 0] });
  }
}

function winLit(i, t) {
  const c = DOOR_T[i];
  return ramp(t, c - 0.22, c - 0.1) * (1 - ramp(t, c + 0.1, c + 0.22));
}
function updateDoor(t) {
  for (const w of S.win) {
    const lit = winLit(w.i, t), c = DOOR_T[w.i];
    w.paneMat.emissive.setRGB(lerp(0.04, 0.2, lit), lerp(0.07, 0.42, lit), lerp(0.09, 0.62, lit));
    w.prop.visible = lit > 0.02;
    w.prop.scale.setScalar(0.88 + 0.12 * lit);
    if (w.sw) w.sw.rotation.z = w.amp * Math.cos((t - c) * Math.PI * 2 / 0.8 + 0.7);
    if (w.bub) w.bub.forEach((b) => {
      const k = (t * b.userData.sp + b.userData.ph) % 1;
      b.position.set(b.userData.x + Math.sin(k * 12 + b.userData.ph * 6) * 0.03, -0.4 + k * 0.62, 0.27);
    });
    if (w.dots) {
      const n = clamp01((t - (c - 0.18)) / 0.28) * w.dots.length;
      w.dots.forEach((d, k) => { d.visible = k < n; });
      w.pin.visible = n >= w.dots.length - 0.5;
    }
  }
}

// Where the lens view sits and how Holmes aims it, per moment.
function lensPlan(t) {
  // Turn/arm offsets (degrees) toward each beat's target.
  const kArc = ramp(t, 1.0, 1.5) * (1 - ramp(t, 3.0, 3.4));
  const kShape = ramp(t, 3.0, 3.4) * (1 - ramp(t, 5.0, 5.35));
  const kSplit = ramp(t, 5.0, 5.35) * (1 - ramp(t, 6.9, 7.2));
  const kDoor = ramp(t, 6.9, 7.3) * (1 - ramp(t, 9.0, 9.5));
  return {
    turn: kArc * 14 + kShape * 6 + kSplit * 14 + kDoor * 12,
    armX: -kArc * 22 - kShape * 14 + kSplit * 18 - kDoor * 20,
    armY: kArc * 10 + kShape * 4 + kSplit * 8 + kDoor * 8,
    headX: -kArc * 16 - kShape * 10 + kSplit * 10 - kDoor * 14,
    headY: kArc * 10 + kShape * 4 + kSplit * 8 + kDoor * 6,
    lensTilt: kArc * -0.2 + kSplit * 0.2 - kDoor * 0.1,
    kArc, kShape, kSplit, kDoor,
  };
}

// Weight of the lens being on the split or door beat (sets magnification).
function lensKind(t, k) {
  return k === "split" ? ramp(t, 5.0, 5.6) * (1 - ramp(t, 6.95, 7.4)) : ramp(t, 6.95, 7.4) * (1 - ramp(t, 9.0, 9.55));
}

function renderFrame(t) {
  updateScene(t);
  const look = lensPlan(t);

  // Lens docked = the glass in Holmes's hand.
  const g = new THREE.Vector3(); S.lensGlass.getWorldPosition(g);
  const dockC = toScreen(g), dockR = pxRadius(g, 0.1 * 1.7);
  // Targets of the travelling lens view.
  let tgt = dockC.clone(), R = dockR;
  const ballPos = BAND === "18+" ? arcAt(clamp01((t - S.arc.t0) / (S.arc.t1 - S.arc.t0 - 0.35))) : S.ball.position.clone();
  let arcTarget = S.b18 ? S.b18.arcTarget() : toScreen(ballPos.clone().add(new THREE.Vector3(0.12, -0.08, 0)));
  let arcR = S.b18 ? S.b18.arcR : 108;
  if (B1018) {
    // Centre the view a little behind the ball so the gold parabola shows on both sides of it.
    const kk = clamp01((t - S.arc.t0) / (S.arc.t1 - S.arc.t0));
    const back = arcAt(clamp01(kk - 0.1)).add(ballPos).multiplyScalar(0.5);
    arcTarget = toScreen(back);
    arcR = 128;
  }
  const shapeTarget = toScreen(S.shapeFocus), shapeR = pxRadius(S.shapeFocus, S.shapeR);
  const pieC = new THREE.Vector3(); S.pie.getWorldPosition(pieC);
  const splitTarget = BAND === "18+" ? toScreen(S.splitFocus) : S.b ? dockC.clone() : toScreen(pieC.clone().add(B1018 ? new THREE.Vector3(0.06, 0.1, 0) : new THREE.Vector3(0.1, 0.18, 0)));
  const splitR = BAND === "18+" ? pxRadius(S.splitFocus, S.splitR) : S.b ? dockR : pxRadius(pieC, B1018 ? 0.78 : 0.84);
  const lift = ramp(t, 1.0, 1.45);
  tgt = dockC.clone().lerp(arcTarget, lift); R = lerp(dockR, arcR, lift);
  const toShape = ramp(t, 3.0, 3.45);
  tgt.lerp(shapeTarget, toShape); R = lerp(R, shapeR, toShape);
  const toSplit = ramp(t, 5.0, 5.6);
  tgt.lerp(splitTarget, toSplit); R = lerp(R, splitR, toSplit);
  // Door beat: the lens hops window to window and holds on each glimpse.
  const wc = S.win.map((w) => toScreen(w.center));
  const handW = new THREE.Vector3(); S.H.handR.getWorldPosition(handW);
  const doorR = pxRadius(S.win[0].center, 0.98);
  const doorPos = wc[0].clone();
  for (let i = 0; i < 3; i++) doorPos.lerp(wc[i + 1], ramp(t, DOOR_T[i] + 0.1, DOOR_T[i + 1] - 0.1));
  const toDoor = ramp(t, 6.95, 7.4);
  tgt.lerp(doorPos, toDoor); R = lerp(R, doorR, toDoor);
  const home = ramp(t, 9.0, 9.55);
  tgt.lerp(dockC, home); R = lerp(R, dockR, home);
  // 7-10: the lens rests in Holmes's hand while the shares are laid out.
  const on = ramp(t, 1.0, 1.25) * (1 - ramp(t, 9.4, 9.65)) * (S.b ? 1 - ramp(t, 4.85, 5.1) * (1 - ramp(t, 6.6, 6.95)) : 1);
  const ms = 1.16 + (B1018 ? -0.08 : S.b18 ? -0.11 : 0.14) * lensKind(t, "split") + 0.24 * lensKind(t, "door");
  // One lens: the travelling view grows out of the glass in Holmes's
  // hand, so the prop is hidden while the view is out (only the hand
  // and the beam link them) and comes back as the view docks.
  S.lens.visible = on < 0.15;

  // Lines: draw on in time with the action, fade together at the end.
  const fade = 1 - ramp(t, 6.7, 7.0);
  const ln = S.L;
  // Each beat's lines ease out as the lens leaves it, so a later beat
  // never shows an earlier beat's lines through the glass.
  const arcFade = 1 - ramp(t, 3.15, 3.6), shapeFade = 1 - ramp(t, 5.05, 5.45);
  if (S.b18) S.b18.reveal(t);
  else {
  reveal(ln.arc, (t - 1.3) / (S.arc.t1 - 1.3), arcFade);
  // All three sides are down by 3.9 s and the angle arc by 4.05 s, so
  // the still (t=4) shows the whole triangle.
  reveal(ln.tri, (t - 3.3) / 0.6, shapeFade);
  reveal(ln.angle, (t - 3.75) / 0.3, shapeFade);
  reveal(ln.square, (t - 3.8) / 0.25, shapeFade);
  ln.slices.forEach((s, i) => reveal(s, (t - 5.5 - i * 0.1) / 0.2, fade));
  reveal(ln.ring, (t - 5.45) / 0.35, fade * 0.8);
  }

  const handleK = B1018 ? ramp(t, 7.3, 7.45) * (1 - home) : 0;
  if (S.b) S.b.lines(t);
  const u = comp.uniforms;
  u.handC.value.copy(toScreen(handW)); u.handle.value = handleK;
  u.lensC.value.copy(tgt); u.lensR.value = R; u.lensOn.value = on; u.mag.value = ms;
  u.dockC.value.copy(dockC); u.dockR.value = dockR * 1.1;
  u.beam.value = on * Math.min(1, tgt.distanceTo(dockC) / 60) * (look.kArc + look.kShape + look.kSplit > 0 ? 1 : 0.6) * (1 - handleK);

  renderer.setRenderTarget(rtBase);
  renderer.render(scene, camera);
  renderer.setRenderTarget(rtLines);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(linesScene, camera);
  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCam);
}

// ── Boot ───────────────────────────────────────────────────────────────
const ready = build().then(() => {
  if (FREEZE !== null) { renderFrame(FREEZE); return; }
  if (CAPTURE) { renderFrame(0); return; }
  const t0 = performance.now();
  const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
});
ready.catch((e) => { console.error(e); document.body.dataset.error = String(e); });

window.film = { ready, duration: DURATION, fps: FPS, band: BAND, render: (t) => renderFrame(t) };
