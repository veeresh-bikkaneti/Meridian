// "It's all connected": the closing door beat shared by all three bands.
//
// The lens settles on a small stage in front of the street and one thing
// pops in after another, joined by a thin gold thread: the band's maths
// object (pizza slice / pie / bowl), a thrown ball (physics), a bridge
// (engineering), a bubbling flask (chemistry) and an old map with a compass
// rose (social studies). The thread then curls back into the lens.
//
// No words, numbers or letters anywhere. The stage is a camera-facing
// frame at a fixed screen spot; every prop is a pure function of t.
// scene.js calls createMontage(ctx) once, then update(t) every frame.
import * as THREE from "three";
import { recipeCard } from "./band-18plus.js";

export const LENS_R = 170;  // lens radius in px while it sits on the stage
export const MAG = 1.4;     // lens magnification at the door beat (1.16 + 0.24, see renderFrame)
const SCREEN = [560, 288];  // stage centre on the 1094x616 frame (inside the safe zone)
let START; // set per band in createMontage: // pop start per link: origin, ball, flask, map (11-12 frames each; the map holds to the curl)
const GONE = 0.05;          // the previous link is gone the frame the next one starts, so nothing ever covers a link
const POP = 0.26;           // each pop lasts about a quarter second: fast out, then settle
const CURL = [9.0, 9.14];   // thread curls into the lens, stage empties before the lens leaves (Home beat timing as before the montage)

const INKC = 0x2a1f17;

export async function createMontage(c) {
  const { scene, camera, W, H, mesh, toon, toonify, goldLine, reveal, ramp, smooth, clamp01, lerp, pxRadius, load, band } = c;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  camera.updateMatrixWorld(true);
  START = (band === "10-18" ? [169, 180, 192, 204] : [171, 182, 193, 204]).map((f) => f / 24);

  // ── The stage frame: faces the camera, sits in front of the cast ──
  const stage = new THREE.Group();
  const ray = new THREE.Vector3((SCREEN[0] / W) * 2 - 1, -(SCREEN[1] / H) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  stage.position.copy(camera.position).addScaledVector(ray, 4.6);
  stage.quaternion.copy(camera.quaternion);
  const ppu = pxRadius(stage.position, 1);          // px per metre at the stage
  stage.scale.setScalar(LENS_R / MAG / ppu);         // 1 stage unit = the lens radius
  scene.add(stage);
  stage.updateMatrixWorld(true);
  const worldPt = (x, y) => stage.localToWorld(V(x, y, 0.3)).toArray();
  const thick = 2.9 / ppu;                           // gold thread radius: ~3 px on the base frame, ~8 px in the lens

  const INK = 1.5;
  const m = (geo, color, pos, parent, o = {}) => mesh(geo, color, pos, { parent, inkThick: INK, ...o, cast: false });
  const grp = () => { const g = new THREE.Group(); stage.add(g); return g; };
  const tube = (pts, r, color = INKC, parent) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, "catmullrom", 0.5);
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 6, false), new THREE.MeshBasicMaterial({ color }));
    parent.add(t);
    return t;
  };
  // Centre a loaded model on the stage origin and size it to `w` across.
  const fit = (obj, w, h) => {
    const b = new THREE.Box3().setFromObject(obj);
    const s = Math.min(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y));
    const cn = b.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    obj.scale.multiplyScalar(s);
    obj.position.sub(cn.multiplyScalar(s));
    holder.add(obj);
    return holder;
  };

  // ── Backing disc (hidden under the lens, so nothing shows round it) ──
  const disc = m(new THREE.CylinderGeometry(0.985, 0.985, 0.05, 48), 0x2c6a80, [0, 0, -0.35], stage, { rot: [Math.PI / 2, 0, 0], ink: false });
  const objs = [grp(), grp(), grp(), grp()];
  objs.forEach((o, k) => { o.position.z = 0.14 * k; }); // later links pop in front of the one leaving
  const T = {}; // per-link animated bits

  // ── 0: the band's maths object ──
  const o0 = objs[0];
  if (band === "7-10") {
    // Plate with one pizza slice, crust up.
    const plate = new THREE.Group(); plate.rotation.x = Math.PI / 2; o0.add(plate);
    m(new THREE.CylinderGeometry(0.76, 0.66, 0.07, 40), 0xffffff, [0, 0, 0], plate);
    m(new THREE.CylinderGeometry(0.56, 0.56, 0.075, 36), 0xfff1d6, [0, 0, 0], plate, { ink: false });
    m(new THREE.TorusGeometry(0.68, 0.04, 8, 44), 0x2f6fd6, [0, 0.04, 0], plate, { rot: [Math.PI / 2, 0, 0], ink: false });
    const sl = new THREE.Group(); sl.position.set(0, -0.3, 0.1); sl.rotation.z = Math.PI; o0.add(sl);
    const a = new THREE.Group(); a.rotation.x = Math.PI / 2; sl.add(a);
    const R = 0.74, th = Math.PI / 3;
    m(new THREE.CylinderGeometry(R, R, 0.08, 10, 1, false, -th / 2, th), 0xffcf4a, [0, 0, 0], a, { inkThick: 1 });
    m(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.13, 10, 1, true, -th / 2, th), 0xd98a3a, [0, 0, 0], a, { ink: false, mat: { side: THREE.DoubleSide } });
    for (const [r, ang, s] of [[0.5, 0.0, 0.11], [0.3, -0.17, 0.08], [0.32, 0.2, 0.085]]) {
      m(new THREE.CylinderGeometry(s, s, 0.03, 16), 0xd2462f, [Math.sin(ang) * r, 0.055, Math.cos(ang) * r], a, { ink: false });
    }
  } else if (band === "10-18") {
    // The pie Watson holds, face-on, one slice drawn out.
    const pie = await load("why-learn/pie.glb");
    toonify(pie, { shadows: false });
    pie.rotation.x = Math.PI / 2 - 0.35;
    const h = fit(pie, 1.6, 1.6);
    o0.add(h);
    const s0 = pie.getObjectByName("slice-0");
    if (s0) s0.position.set(Math.cos(Math.PI / 8) * 0.14, 0.09, -Math.sin(Math.PI / 8) * 0.14);
    T.pie = pie;
  } else {
    // 18+: the single bowl, a touch tipped toward the camera.
    const bowls = await load("why-learn/bowls.glb");
    toonify(bowls, { shadows: false });
    for (const i of [1, 2]) { const b = bowls.getObjectByName(`bowl-${i}`); if (b) b.visible = false; }
    const b0 = bowls.getObjectByName("bowl-0");
    const h = new THREE.Group();
    bowls.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(b0 ?? bowls);
    const cn = bb.getCenter(new THREE.Vector3());
    const s = 1.55 / (bb.max.x - bb.min.x);
    bowls.scale.setScalar(s);
    bowls.position.set(-cn.x * s, -cn.y * s, -cn.z * s);
    h.add(bowls); h.rotation.x = 0.5; h.scale.setScalar(0.64); h.position.x = -0.42; o0.add(h);
    // the recipe card stands beside the bowl, so the bowl reads as a recipe
    const rc = recipeCard(0.6, 0.8);
    const card = new THREE.Group(); card.position.set(0.52, -0.42, 0.05); card.rotation.z = -0.06; o0.add(card);
    m(new THREE.BoxGeometry(rc.w + 0.05, rc.h + 0.05, 0.04), 0x2a1f17, [0, rc.h / 2, -0.02], card, { ink: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(rc.w, rc.h), new THREE.MeshBasicMaterial({ map: rc.tex }));
    face.position.set(0, rc.h / 2, 0.01); card.add(face);
  }

  // ── 1: a thrown ball on its arc (physics) ──
  {
    const o = objs[1];
    const big = band === "10-18"; // a larger ball link for this band
    if (big) o.userData.big = 1.12;
    const arcAt = big ? (u) => [lerp(-0.52, 0.52, u), -0.48 + 0.98 * (1 - (2 * u - 1) ** 2)] : (u) => [lerp(-0.74, 0.74, u), -0.34 + 0.98 * (1 - (2 * u - 1) ** 2) - 0.0];
    T.arc = arcAt; T.big = big;
    T.dots = [];
    for (let i = 0; i <= 11; i++) {
      const [x, y] = arcAt(i / 11);
      T.dots.push(m(new THREE.SphereGeometry(0.07, 12, 8), 0xfff0c0, [x, y, -0.05], o, { inkThick: 1.2 }));
    }
    const ball = await load("why-learn/ball.glb");
    toonify(ball, { shadows: false });
    T.ball = fit(ball, big ? 0.74 : 0.66, big ? 0.74 : 0.66);
    o.add(T.ball);
    // ground line under the arc ends
    m(new THREE.BoxGeometry(1.7, 0.07, 0.06), 0x9a6b3d, [0, -0.55, -0.1], o);
  }

  // ── 2: a bubbling flask (chemistry) ──
  {
    const o = objs[2];
    o.position.y = -0.08;
    const prof = [[0.0, -0.6], [0.5, -0.6], [0.56, -0.54], [0.14, 0.06], [0.14, 0.46], [0.2, 0.46], [0.2, 0.54]];
    const glass = new THREE.MeshToonMaterial({ color: 0xd8f3fb, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    const gm = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), glass);
    o.add(gm);
    const liqProf = [[0, -0.57], [0.5, -0.57], [0.53, -0.52], [0.3, -0.18], [0, -0.18]];
    const liq = m(new THREE.LatheGeometry(liqProf.map(([r, y]) => new THREE.Vector2(r, y)), 32), 0x3ed8b4, [0, 0, 0], o, { inkThick: 1, mat: { emissive: new THREE.Color(0x14b894), emissiveIntensity: 0.55 } });
    void liq;
    // silhouette ink on the glass (a transparent body cannot carry the usual hull)
    const L = prof.slice(1).map(([r, y]) => [-r, y, 0.0]);
    const Rr = prof.slice(1).map(([r, y]) => [r, y, 0.0]);
    tube(L, 0.03, INKC, o); tube(Rr, 0.03, INKC, o);
    tube([[-0.5, -0.6, 0.0], [0.5, -0.6, 0.0]], 0.03, INKC, o);
    tube([[-0.2, 0.54, 0.0], [0.2, 0.54, 0.0]], 0.03, INKC, o);
    T.bub = [];
    for (let k = 0; k < 9; k++) {
      const r = [0.09, 0.07, 0.11, 0.08, 0.1, 0.075, 0.12, 0.09, 0.13][k];
      const b = m(new THREE.SphereGeometry(r, 14, 10), 0xfff6e0, [0, 0, 0.1], o, { inkThick: 1.2, mat: { emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.35 } });
      b.userData = { x: [-0.2, 0.1, 0.22, -0.08, 0.02, -0.26, 0.17, -0.02, 0.06][k], ph: k / 9, sp: 1.5 + (k % 3) * 0.25 };
      T.bub.push(b);
    }
  }

  // ── 3: an old map with a compass rose (social studies) ──
  {
    const o = objs[3];
    const map = new THREE.Group(); map.rotation.z = 0.06; o.add(map);
    m(new THREE.BoxGeometry(1.5, 1.1, 0.05), 0xf3dca0, [0, 0, 0], map);
    for (const x of [-0.76, 0.76]) m(new THREE.CylinderGeometry(0.075, 0.075, 1.16, 14), 0xc99a58, [x, 0, 0.0], map);
    const flat = (pts, color, z = 0.04) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      return m(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), color, [0, 0, z], map, { ink: false });
    };
    flat([[-0.62, 0.38], [-0.3, 0.46], [-0.05, 0.3], [0.02, 0.08], [-0.2, -0.05], [-0.42, 0.02], [-0.6, 0.14]], 0x83bf5c);
    flat([[-0.55, -0.2], [-0.32, -0.28], [-0.18, -0.4], [-0.4, -0.45], [-0.58, -0.38]], 0x83bf5c);
    flat([[-0.35, 0.28], [-0.25, 0.4], [-0.15, 0.28]], 0xa5733f, 0.07);
    // a sea strip along the bottom edge and a winding blue river
    flat([[-0.68, -0.5], [0.68, -0.5], [0.68, -0.38], [0.4, -0.34], [0.1, -0.42], [-0.3, -0.36], [-0.68, -0.4]], 0x78c0e0);
    // compass rose: eight points, a ring, no letters
    const rose = new THREE.Group(); rose.position.set(0.36, 0.06, 0.08); map.add(rose);
    const pts = [];
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8 + Math.PI / 2;
      const r = k % 2 ? 0.1 : (k % 4 === 0 ? 0.4 : 0.24);
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    m(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.04, bevelEnabled: false }), 0xc4452f, [0, 0, 0], rose, { inkThick: 1.2 });
    m(new THREE.TorusGeometry(0.31, 0.022, 8, 40), 0x7a4a2a, [0, 0, 0.02], rose, { ink: false });
    m(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), 0xfff0c0, [0, 0, 0.06], rose, { rot: [Math.PI / 2, 0, 0], ink: false });
  }

  // Props never cast or take shadows (they float in front of the cast).
  stage.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ── The gold thread: in from the left, round the prop, out to the right ──
  const wave = (x0, y0, x1, y1, n = 16) => {
    const p = [];
    for (let i = 0; i <= n; i++) { const k = i / n; p.push(worldPt(lerp(x0, x1, k), lerp(y0, y1, k) + 0.07 * Math.sin(k * 6.3 + x0 * 3))); }
    return p;
  };
  const AX = 0, AY = -0.9; // anchor under each prop, below every link so the thread never crosses one
  const ins = [], outs = [];
  for (let k = 0; k < 4; k++) {
    if (k > 0) { const l = goldLine(wave(-0.8, -0.66, AX, AY), { segs: 24, radius: thick }); ins.push(l); } else ins.push(null);
    if (k < 3) { const l = goldLine(wave(AX, AY, 0.8, -0.66), { segs: 24, radius: thick }); outs.push(l); } else outs.push(null);
  }
  // curl: from the anchor spiralling into the lens centre
  const spiral = [];
  for (let i = 0; i <= 40; i++) {
    const k = i / 40, a = -Math.PI / 2 + k * Math.PI * 3.2, r = lerp(0.8, 0.04, k);
    spiral.push(worldPt(Math.cos(a) * r, Math.sin(a) * r));
  }
  const curl = goldLine(spiral, { segs: 64, radius: thick });

  // squash and stretch: fast out (quartic), stretch first, squash late, no overshoot past ~1.1.
  const pop = (t, s0) => {
    const u = clamp01((t - s0) / POP), base = 1 - (1 - u) ** 4;
    const dev = 0.14 * Math.sin(2 * Math.PI * u) * (1 - u);
    return [base * (1 - dev), base * (1 + dev)];
  };

  let over = 1; // set by the dolly: the backing disc grows with the lens so it always fills the glass
  function update(t) {
    const on = t > START[0] - 0.02 && t < CURL[1] + 0.2;
    stage.visible = on;
    for (const l of [...ins, ...outs, curl]) if (l) l.visible = false;
    if (!on) return;
    disc.scale.setScalar(Math.max(1e-3, ramp(t, START[0] - 0.01, START[0] + 0.1) * (1 - ramp(t, CURL[1] - 0.08, CURL[1] + 0.18)) * over));
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = pop(t, START[k]);
      const out = k < 3 ? ramp(t, START[k + 1] - GONE, START[k + 1] - 0.001) : ramp(t, CURL[0], CURL[0] + 0.12);
      const s = 1 - out;
      const bg = objs[k].userData.big ?? 1;
      objs[k].visible = sx * s > 0.01;
      objs[k].scale.set(Math.max(1e-3, sx * s * bg), Math.max(1e-3, sy * s * bg), Math.max(1e-3, ((sx + sy) / 2) * s * bg));
      // thread: in during the first half of the pop, out in the second; both ease away with the prop
      const lo = k < 3 ? START[k + 1] - GONE : CURL[0];
      const fade = 1 - ramp(t, lo, lo + (k < 3 ? GONE : 0.1));
      if (ins[k]) reveal(ins[k], (t - START[k] + 0.12) / 0.16, fade);
      if (outs[k]) reveal(outs[k], (t - START[k] - 0.1) / 0.18, fade);
    }
    // curl into the lens
    reveal(curl, (t - CURL[0]) / 0.1, 1 - ramp(t, CURL[1] - 0.06, CURL[1]));
    // ball flies along its arc
    { const u = (T.big ? lerp(0.12, 0.7, smooth((t - START[1]) / 0.42)) : lerp(0.04, 0.66, smooth((t - START[1]) / 0.42))); const [x, y] = T.arc(u);
      T.ball.position.set(x, y, 0.1); T.ball.rotation.z = -u * 5;
      T.dots.forEach((d, i) => { d.visible = i / 11 < u - 0.05; }); }
    // bubbles rise and pop out of the neck
    T.bub.forEach((b) => {
      const k = (t * b.userData.sp + b.userData.ph) % 1;
      b.position.set(b.userData.x * (1 - k * 0.9) + Math.sin(k * 10 + b.userData.ph * 6) * 0.03, -0.45 + k * 1.35, 0.1);
      b.scale.setScalar(k > 0.8 ? 1 - (k - 0.8) * 2.5 : 1);
    });
  }

  return { update, setOver: (o) => { over = o; }, screen: new THREE.Vector2(SCREEN[0], H - SCREEN[1]), stage };
}
