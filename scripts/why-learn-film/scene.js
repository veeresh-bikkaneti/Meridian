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

const W = 1094, H = 616, DURATION = 8.0, FPS = 24;
const q = new URLSearchParams(location.search);
const BAND = ["7-10", "10-18", "18+"].includes(q.get("band")) ? q.get("band") : "10-18";
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

const rtBase = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtLines = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });

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
  mesh(new THREE.BoxGeometry(6.3, 0.18, 0.5), 0xf7ead2, [-3.6, 3.15, -3.1], { parent: wall });
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
  mesh(new THREE.BoxGeometry(3.9, 0.04, 0.95), 0xffffff, [-3.75, 2.62, -2.62], { rot: [0.5, 0, 0], mat: { map: stripes }, parent: wall });
  mesh(new THREE.BoxGeometry(3.9, 0.2, 0.03), 0xffffff, [-3.75, 2.32, -2.2], { mat: { map: stripes }, parent: wall });
  // Upper windows with flower-free sills and shutters.
  for (const x of [-5.6, -4.2, -2.8, -1.4]) {
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
    dockC: { value: new THREE.Vector2() }, dockR: { value: 0 }, beam: { value: 0 },
    mag: { value: 1.16 }, grade: { value: new THREE.Vector3(...LOOK.grade) }, sat: { value: LOOK.sat },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D base, lines; uniform vec2 res, lensC, dockC; uniform float lensR, lensOn, dockR, beam, mag, sat;
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
  post: new THREE.Vector3(0.55, 0, -1.5),
  table: new THREE.Vector3(0.72, 0, 1.6),
};

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
  table.position.copy(SET.table);
  scene.add(table);
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
    S.hose = toonify(P["hose-nozzle"]);
    S.hose.scale.setScalar(1.3);
    scene.add(S.hose);
    S.ball.visible = false;
    // A bucket the water lands in.
    S.bucket = mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.32, 16, 1, true), 0x7b8a96, [-0.25, 0.16, 0.75], { mat: { side: THREE.DoubleSide } });
    S.bridge = toonify(P.bridge);
    S.bridge.position.set(0.25, 0.9, -2.2);
    scene.add(S.bridge);
    // Stone parapet the bridge rises behind (it spans the river beyond).
    mesh(new THREE.BoxGeometry(5.2, 0.7, 0.35), 0xb9b2a5, [0.8, 0.35, -1.65]);
    mesh(new THREE.PlaneGeometry(14, 6), 0x6f9fb8, [2, 0.02, -5], { rot: [-Math.PI / 2, 0, 0], ink: false, cast: false });
    S.pie.visible = false;
    S.bowls = toonify(P.bowls);
    S.bowls.position.set(SET.table.x, 0.77, SET.table.z);
    S.bowls.scale.setScalar(1.25);
    scene.add(S.bowls);
    S.bowl = [0, 1, 2].map((i) => S.bowls.getObjectByName(`bowl-${i}`));
    S.bowlHome = S.bowl.map((b) => b.position.clone());
    // Water droplets along the arc.
    S.drops = [];
    const dropMat = toon(0x8fd3f4, { transparent: true, opacity: 0.9, emissive: new THREE.Color(0x2f6f9a), emissiveIntensity: 0.3 });
    for (let i = 0; i < 46; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dropMat);
      scene.add(d);
      S.drops.push(d);
    }
  }

  buildLines();
}

// ── Paths and gold line geometry per band ──────────────────────────────
function buildLines() {
  S.L = {};
  updateScene(0); // put hands where they start, to read release points
  scene.updateMatrixWorld(true);

  if (BAND !== "18+") {
    // Ball flight: released over Watson's head at 1.3 s, caught at 3.7 s
    // after he scoots left under it. A true parabola (constant x speed).
    const a = new THREE.Vector3(SET.watsonStart.x - 0.15, 2.0, SET.watsonStart.z + 0.1);
    const b = new THREE.Vector3(SET.watsonCatch.x - 0.05, 1.0, SET.watsonCatch.z + 0.32);
    S.arc = { a, b, apex: 3.0, t0: 1.3, t1: 3.7 };
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
  if (BAND !== "18+") {
    S.pie.updateMatrixWorld(true);
    const c = new THREE.Vector3(); S.pie.getWorldPosition(c); c.y += 0.075;
    S.L.slices = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4 + 0.2, rr = 0.235;
      S.L.slices.push(goldLine([[c.x - Math.cos(a) * rr, c.y, c.z + Math.sin(a) * rr], [c.x + Math.cos(a) * rr, c.y, c.z - Math.sin(a) * rr]], { segs: 24, radius: 0.008 }));
    }
    const ring = [];
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; ring.push([c.x + Math.cos(a) * 0.235, c.y, c.z + Math.sin(a) * 0.235]); }
    S.L.ring = goldLine(ring, { segs: 80, radius: 0.008 });
    S.splitFocus = c.clone().add(new THREE.Vector3(0, 0.02, 0));
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
  const breathe = Math.sin(t * Math.PI * 2 / 4) * 1.2; // 4 s period, loops at 8 s
  const glance = ramp(t, 6.6, 7.0) * (1 - ramp(t, 7.35, 7.75));
  applyPose(H, {
    ...sweep,
    shoulderR: [sweep.shoulderR[0] + look.armX, sweep.shoulderR[1] + look.armY, sweep.shoulderR[2]],
  }, { headX: look.headX + breathe, headY: look.headY + glance * 22 });

  // Watson.
  const walkTo = ramp(t, 1.6, 3.4), walkBack = ramp(t, 6.5, 7.6);
  const pos = BAND === "18+" ? SET.watsonCatch.clone() : SET.watsonStart.clone().lerp(SET.watsonCatch, walkTo * (1 - walkBack));
  Wt.root.position.copy(pos);
  const walking = BAND !== "18+" && ((t > 1.6 && t < 3.4) || (t > 6.5 && t < 7.6));
  const stride = walking ? Math.sin(t * 14) : 0;
  let p, headX = 0, lean = 0;
  if (BAND !== "18+") {
    p = mixPose(HOLD, POSES.watson.toss, ramp(t, 1.0, 1.3));
    p = mixPose(p, mixPose(POSES.watson.walk, { ...POSES.watson.walk, head: [-22, 0, 0] }, 1), ramp(t, 1.7, 2.2));
    p = mixPose(p, CATCH, ramp(t, 3.3, 3.65));
    p = mixPose(p, HOLD, ramp(t, 3.72, 3.98)); // ball down to the chest, face clear
    p = mixPose(p, POSES.watson["lean-in"], ramp(t, 5.1, 5.6));
    p = mixPose(p, HOLD, ramp(t, 6.5, 7.2));
  } else {
    p = mixPose(HOLD, AIM, ramp(t, 0.9, 1.3));
    p = mixPose(p, POSES.watson["lean-in"], ramp(t, 5.1, 5.6));
    p = mixPose(p, HOLD, ramp(t, 6.5, 7.2));
  }
  lean = ramp(t, 5.1, 5.6) * (1 - ramp(t, 6.4, 6.9));
  const nod = ramp(t, 7.0, 7.15) * (1 - ramp(t, 7.25, 7.5));
  headX = nod * 12 + Math.sin(t * Math.PI * 2 / 4 + 1) * 1.2;
  // Watson turns toward the table to lean in, then back to Holmes.
  Wt.root.rotation.set(lean * 14 * D, (-28 - lean * 22 + walkTo * (1 - walkBack) * 6) * D, 0);
  Wt.root.position.y = walking ? Math.abs(Math.cos(t * 14)) * 0.025 : 0;
  // A small delighted bounce while leaning in.
  Wt.root.position.y += lean * Math.max(0, Math.sin((t - 5.6) * 9)) * 0.03 * ramp(t, 5.6, 5.8);
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
    S.ball.rotation.set(t * 4, t * 2.5, 0);
  }
  if (BAND === "18+" && S.hose && S.arc) {
    Wt.handR.getWorldPosition(tmp);
    S.hose.position.copy(tmp);
    S.hose.rotation.set(-0.35 - ramp(t, 0.9, 1.3) * 0.25 * (1 - ramp(t, 3.2, 3.6)), (-62 - lean * 22) * D, 0);
    // Water: droplets stream along the arc from 1.3 s to 3.1 s.
    const { t0, t1 } = S.arc;
    const on = ramp(t, t0, t0 + 0.05) * (1 - ramp(t, t1 + 0.6, t1 + 0.9));
    S.drops.forEach((d, i) => {
      const lead = clamp01((t - t0) / (t1 - t0 - 0.6));
      const k = ((i / S.drops.length) + t * 1.4) % 1;
      d.visible = on > 0.01 && k <= lead && t < t1 + 0.9;
      d.position.copy(arcAt(k));
      d.scale.setScalar(0.7 + 0.3 * Math.sin(i * 2.1));
    });
  }
  // Swing: a 2 s pendulum, four full swings per loop.
  if (S.swingPivot) S.swingPivot.rotation.z = Math.sin(t * Math.PI) * (S.swingAmp ?? 0.6) * 0.95;
  if (S.bowl) {
    const k = ramp(t, 5.55, 6.05) * (1 - ramp(t, 6.6, 7.2));
    S.bowl[1].visible = S.bowl[2].visible = k > 0.01;
    S.bowl[1].scale.setScalar(Math.max(0.001, k));
    S.bowl[2].scale.setScalar(Math.max(0.001, k));
    S.bowl[1].position.copy(S.bowlHome[1]);
    S.bowl[2].position.copy(S.bowlHome[2]);
  }
  if (S.clouds) S.clouds.children.forEach((c) => { c.userData.x0 ??= c.position.x; c.position.x = c.userData.x0 + Math.sin(t * Math.PI / 8) * c.userData.speed * 4; });
}

// Where the lens view sits and how Holmes aims it, per moment.
function lensPlan(t) {
  // Turn/arm offsets (degrees) toward each beat's target.
  const kArc = ramp(t, 1.0, 1.5) * (1 - ramp(t, 3.0, 3.4));
  const kShape = ramp(t, 3.0, 3.4) * (1 - ramp(t, 5.0, 5.35));
  const kSplit = ramp(t, 5.0, 5.35) * (1 - ramp(t, 6.5, 7.1));
  return {
    turn: kArc * 14 + kShape * 6 + kSplit * 14,
    armX: -kArc * 22 - kShape * 14 + kSplit * 18,
    armY: kArc * 10 + kShape * 4 + kSplit * 8,
    headX: -kArc * 16 - kShape * 10 + kSplit * 10,
    headY: kArc * 10 + kShape * 4 + kSplit * 8,
    lensTilt: kArc * -0.2 + kSplit * 0.2,
    kArc, kShape, kSplit,
  };
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
  const arcTarget = toScreen(ballPos.clone().add(new THREE.Vector3(0.12, -0.08, 0)));
  const arcR = 108;
  const shapeTarget = toScreen(S.shapeFocus), shapeR = pxRadius(S.shapeFocus, S.shapeR);
  const splitTarget = toScreen(S.splitFocus), splitR = pxRadius(S.splitFocus, S.splitR);
  const lift = ramp(t, 1.0, 1.45);
  tgt = dockC.clone().lerp(arcTarget, lift); R = lerp(dockR, arcR, lift);
  const toShape = ramp(t, 3.0, 3.45);
  tgt.lerp(shapeTarget, toShape); R = lerp(R, shapeR, toShape);
  const toSplit = ramp(t, 5.0, 5.4);
  tgt.lerp(splitTarget, toSplit); R = lerp(R, splitR, toSplit);
  const home = ramp(t, 6.55, 7.2);
  tgt.lerp(dockC, home); R = lerp(R, dockR, home);
  const on = ramp(t, 1.0, 1.25) * (1 - ramp(t, 7.0, 7.25));
  // One lens: the travelling view grows out of the glass in Holmes's
  // hand, so the prop is hidden while the view is out (only the hand
  // and the beam link them) and comes back as the view docks.
  S.lens.visible = on < 0.15;

  // Lines: draw on in time with the action, fade together at the end.
  const fade = 1 - ramp(t, 6.5, 7.0);
  const ln = S.L;
  // Each beat's lines ease out as the lens leaves it, so a later beat
  // never shows an earlier beat's lines through the glass.
  const arcFade = 1 - ramp(t, 3.15, 3.6), shapeFade = 1 - ramp(t, 5.05, 5.45);
  if (BAND !== "18+") reveal(ln.arc, (t - 1.3) / (S.arc.t1 - 1.3), arcFade);
  else reveal(ln.arc, (t - 1.3) / (S.arc.t1 - 1.3 - 0.35), arcFade);
  // All three sides are down by 3.9 s and the angle arc by 4.05 s, so
  // the still (t=4) shows the whole triangle.
  reveal(ln.tri, (t - 3.3) / 0.6, shapeFade);
  reveal(ln.angle, (t - 3.75) / 0.3, shapeFade);
  reveal(ln.square, (t - 3.8) / 0.25, shapeFade);
  ln.slices.forEach((s, i) => reveal(s, (t - 5.35 - i * 0.16) / 0.3, fade));
  reveal(ln.ring, (t - 5.3) / 0.5, fade * 0.8);

  const u = comp.uniforms;
  u.lensC.value.copy(tgt); u.lensR.value = R; u.lensOn.value = on;
  u.dockC.value.copy(dockC); u.dockR.value = dockR * 1.1;
  u.beam.value = on * Math.min(1, tgt.distanceTo(dockC) / 60) * (look.kArc + look.kShape + look.kSplit > 0 ? 1 : 0.6);

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
