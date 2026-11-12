// Band 18+ ("real systems") of the Why Do We Learn This? film.
//
// Everything that is specific to this band lives here: the garden hose and
// bucket (arc beat), the bridge with nested gold triangles (shape beat),
// and the baker's counter where one big bowl of dough becomes three equal
// bowls (split beat). The Door beat is shared with the other bands and is
// NOT touched here.
//
// scene.js calls createBand18(ctx) once and then uses the returned object:
//   build(P)        add props (P = loaded GLBs by name)
//   buildLines()    gold lines, S.arc, shape/split focus
//   update(t)       per-frame props (hose, water, bucket, bowls)
//   reveal(t)       per-frame gold line draw-on and fades
//   arcTarget()     screen target of the lens on the arc beat
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A recipe card with no words: a bowl-and-spoon picture over four wavy
// "text-like" lines. Drawn on a canvas (no letters, digits or symbols).
export function recipeCard(w = 0.3, h = 0.4) {
  const cv = document.createElement("canvas");
  cv.width = 300; cv.height = 400;
  const g = cv.getContext("2d");
  g.fillStyle = "#f7ecd2"; g.fillRect(0, 0, 300, 400);
  g.strokeStyle = "#c98f52"; g.lineWidth = 14; g.strokeRect(7, 7, 286, 386);
  // bowl
  g.fillStyle = "#5fa6c8"; g.strokeStyle = "#2a1f17"; g.lineWidth = 9; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath(); g.moveTo(60, 98); g.lineTo(190, 98); g.quadraticCurveTo(188, 168, 125, 170); g.quadraticCurveTo(62, 168, 60, 98); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#fff1d0"; g.beginPath(); g.ellipse(125, 98, 65, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // spoon
  g.beginPath(); g.moveTo(215, 150); g.lineTo(250, 66); g.stroke();
  g.fillStyle = "#d9a531"; g.beginPath(); g.ellipse(255, 54, 13, 20, 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
  // wavy lines
  g.strokeStyle = "#7a5a3c"; g.lineWidth = 10;
  [[222, 232], [268, 212], [314, 232], [360, 150]].forEach(([y, len], i) => {
    g.beginPath();
    for (let x = 0; x <= len; x += 4) { const yy = y + Math.sin(x / 14 + i) * 5; if (x === 0) g.moveTo(40, yy); else g.lineTo(40 + x, yy); }
    g.stroke();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w, h };
}

export function createBand18(c) {
  const { scene, S, mesh, toon, toonify, goldLine, poly, reveal, ramp, smooth, clamp01, lerp, toScreen } = c;
  const B = { arcR: 215 };

  // ── Layout (metres) ────────────────────────────────────────────────────
  const TOP = 0.7;                       // counter top height
  const CTR = V(0.4, TOP, 1.6);          // middle bowl, on the counter
  const SCALE = 2.3;                     // bowls.glb is tiny: bowl radius 0.11 m
  const BIG = 2.2;                       // the one big bowl, before it divides
  const FIN = 1.55;                      // each of the three bowls once divided
  const GAP = 1.02;                      // centre-to-centre of the split bowls
  const BUCKET = V(-1.25, 0, 1.6);
  const WATSON_DX = 0.33, WATSON_STEP = 0.95;                // Watson stands clear of the counter's right end
  const BUCKET_H = 0.5, BUCKET_R = 0.27, WATER_Y = 0.4;
  const T0 = 1.3, T1 = 3.1;              // water leaves the nozzle / front lands

  // Hose aim: the nozzle points along the water's first tangent. Local -Z is
  // the spray direction of hose-nozzle.glb; the hand grips the barrel.
  const HOSE_SCALE = 1.6;
  const GRIP = V(0, -0.05, 0.17).multiplyScalar(HOSE_SCALE);
  const rest = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), V(-0.45, -0.7, 0.4).normalize());
  const restSplit = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), V(0.1, -1, 0.05).normalize()); // nozzle hangs straight down while Watson stands at the frame's right side
  let aim = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), V(-0.7, 0.6, 0.1).normalize());

  // Parabola through a and b with a given apex height, x and z linear in k.
  function arcAt(k) {
    const { a, b, apex } = S.arc;
    const A = a.y, Bh = b.y;
    const s1 = Math.sqrt(apex - A), s2 = Math.sqrt(apex - Bh), kv = s1 / (s1 + s2);
    const cc = (apex - A) / (kv * kv);
    return V(lerp(a.x, b.x, k), apex - cc * (k - kv) ** 2, lerp(a.z, b.z, k));
  }

  const tip = new THREE.Vector3(), hand = new THREE.Vector3();
  const circle = (r, y, n = 48) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
    return pts;
  };

  // ── Props ──────────────────────────────────────────────────────────────
  B.build = (P) => {
    S.ball.visible = false;
    S.H.root.position.x -= 0.3;            // room for the bucket beside Holmes
    S.pie.visible = false;
    if (S.table) S.table.visible = false;

    S.hose = toonify(P["hose-nozzle"]);
    S.hose.scale.setScalar(HOSE_SCALE);
    scene.add(S.hose);

    // Bucket: open steel pail with a brass rim and water inside.
    const bucket = new THREE.Group();
    bucket.position.copy(BUCKET);
    scene.add(bucket);
    mesh(new THREE.CylinderGeometry(BUCKET_R, BUCKET_R * 0.78, BUCKET_H, 24, 1, true), 0x5f8aa3, [0, BUCKET_H / 2, 0], { parent: bucket, mat: { side: THREE.DoubleSide } });
    mesh(new THREE.CylinderGeometry(BUCKET_R * 0.78, BUCKET_R * 0.78, 0.02, 24), 0x4a6f86, [0, 0.01, 0], { parent: bucket, ink: false });
    mesh(new THREE.TorusGeometry(BUCKET_R, 0.022, 8, 28), 0xd9a531, [0, BUCKET_H, 0], { parent: bucket, rot: [Math.PI / 2, 0, 0] });
    mesh(new THREE.TorusGeometry(BUCKET_R * 0.78, 0.016, 8, 24), 0xd9a531, [0, 0.2, 0], { parent: bucket, rot: [Math.PI / 2, 0, 0] });
    const waterMat = toon(0x7fd0f5, { emissive: new THREE.Color(0x2f7fb0), emissiveIntensity: 0.45 });
    S.b18water = mesh(new THREE.CylinderGeometry(BUCKET_R * 0.93, BUCKET_R * 0.93, 0.02, 24), 0, [0, WATER_Y - BUCKET.y, 0], { material: waterMat, parent: bucket, ink: false, cast: false });
    S.b18ripple = mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), 0xeaf8ff, [0, WATER_Y + 0.015, 0], { parent: bucket, rot: [Math.PI / 2, 0, 0], ink: false, cast: false });

    // Water: a dense stream of droplets along the arc, plus splash.
    S.drops = [];
    const dropMat = toon(0x8ad8ff, { emissive: new THREE.Color(0x2f86c0), emissiveIntensity: 0.55 });
    for (let i = 0; i < 90; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), dropMat);
      scene.add(d);
      S.drops.push(d);
    }
    S.splash = [];
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dropMat);
      scene.add(d);
      S.splash.push(d);
    }

    // Bridge, with the stone parapet and river it spans.
    S.bridge = toonify(P.bridge);
    S.bridge.position.set(0.25, 0.9, -2.2);
    scene.add(S.bridge);
    mesh(new THREE.BoxGeometry(5.2, 0.7, 0.35), 0xb9b2a5, [0.8, 0.35, -1.65]);
    mesh(new THREE.PlaneGeometry(14, 6), 0x6f9fb8, [2, 0.02, -5], { rot: [-Math.PI / 2, 0, 0], ink: false, cast: false });

    // Baker's counter with one big bowl of dough that will become three.
    const counter = new THREE.Group();
    counter.position.set(CTR.x, 0, CTR.z);
    scene.add(counter);
    mesh(new THREE.BoxGeometry(2.9, 0.07, 0.8), 0xa8794a, [0, TOP - 0.035, 0], { parent: counter });
    mesh(new THREE.BoxGeometry(2.8, 0.5, 0.06), 0xf0e2c4, [0, TOP - 0.32, 0.3], { parent: counter });
    for (const x of [-1.35, 1.35]) mesh(new THREE.BoxGeometry(0.08, TOP - 0.07, 0.7), 0x5a3b28, [x, (TOP - 0.07) / 2, 0], { parent: counter });
    mesh(new THREE.BoxGeometry(2.7, 0.04, 0.6), 0x8f6538, [0, 0.12, 0], { parent: counter, ink: false });

    S.bowls = toonify(P.bowls);
    S.bowls.position.copy(CTR);
    S.bowls.scale.setScalar(SCALE);
    scene.add(S.bowls);
    S.bowl = [0, 1, 2].map((i) => S.bowls.getObjectByName(`bowl-${i}`));

    // Recipe card standing on the counter, behind and beside the middle bowl.
    const rc = recipeCard(0.7, 1.16);
    const card = new THREE.Group();
    card.position.set(CTR.x - 0.9, TOP, CTR.z - 0.3);
    card.rotation.x = -0.12;
    scene.add(card);
    mesh(new THREE.BoxGeometry(rc.w + 0.03, rc.h + 0.03, 0.02), 0x2a1f17, [0, rc.h / 2, -0.012], { parent: card, ink: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(rc.w, rc.h), new THREE.MeshBasicMaterial({ map: rc.tex }));
    face.position.set(0, rc.h / 2, 0.002);
    card.add(face);
    S.recipeCard = card;
  };

  // ── Gold lines ─────────────────────────────────────────────────────────
  B.buildLines = () => {
    S.arc = { a: V(1.0, 1.15, 0.9), b: V(BUCKET.x, WATER_Y, BUCKET.z), apex: 2.0, t0: T0, t1: T1 };
    // The nozzle tip depends on how the nozzle is aimed, and the aim on the
    // tip: three passes settle it.
    for (let i = 0; i < 3; i++) {
      const d = arcAt(0.03).sub(arcAt(0)).normalize();
      aim = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), d);
      c.updateScene(1.5);
      S.arc.a = S.hose.position.clone().addScaledVector(d, 0.05);
    }
    const arcPts = [];
    for (let i = 0; i <= 48; i++) arcPts.push(arcAt(i / 48).toArray());
    S.L.arc = goldLine(arcPts, { segs: 96, radius: 0.02 });
    B.arcMid = arcAt(0.5).multiplyScalar(0.4).add(S.arc.b.clone().multiplyScalar(0.6));

    // Bridge: the tower and deck, then nested right triangles. Every cable
    // on both sides is the hypotenuse of its own triangle.
    S.bridge.updateMatrixWorld(true);
    const w = (x, y) => S.bridge.localToWorld(V(x, y, 0.33));
    const top = w(0, 1.4), base = w(0, 0.06);
    B.tower = goldLine(poly([base.toArray(), top.toArray()]), { segs: 24, radius: 0.026 });
    B.deck = goldLine(poly([w(-1.5, 0.06).toArray(), w(1.5, 0.06).toArray()]), { segs: 48, radius: 0.026 });
    B.hyp = [];
    for (const k of [1.5, 1.0, 0.5]) for (const s of [-1, 1]) {
      B.hyp.push(goldLine(poly([top.toArray(), w(s * k, 0.06).toArray()]), { segs: 40, radius: 0.024 }));
    }
    B.corner = [-1, 1].map((s) => {
      const q = 0.14;
      return goldLine(poly([w(s * q, 0.06 + 0.0).toArray(), w(s * q, 0.06 + q).toArray(), w(0, 0.06 + q).toArray()]), { segs: 20, radius: 0.016 });
    });
    S.shapeFocus = w(0, 0.74);
    S.shapeR = 2.0;

    // Split: three gold rim rings (one per bowl) and two dividers on the
    // big bowl that cut it into thirds.
    const rr = 0.116 * SCALE, ry = 0.11 * SCALE;
    B.rings = [0, 1, 2].map(() => goldLine(circle(rr, ry), { closed: true, segs: 64, radius: 0.017 }));
    B.thirds = [-1, 1].map((s) => goldLine(poly([[s * rr / 3, ry, rr * 0.9], [s * rr / 3, 0.03, rr * 0.75]]), { segs: 12, radius: 0.017 }));
    S.splitFocus = V(CTR.x, 1.2, CTR.z);
    S.splitR = 1.5;
  };

  // ── Per frame ──────────────────────────────────────────────────────────
  B.update = (t) => {
    const Wt = S.W;
    // Watson steps back to the right while the lens is on the three bowls, so the rim never half-hides him.
    Wt.root.position.x += WATSON_DX + WATSON_STEP * smooth(ramp(t, 5.0, 5.6)) * (1 - smooth(ramp(t, 6.95, 7.2)));
    Wt.root.updateMatrixWorld(true);
    // Hose: pointing down at rest, up along the water's tangent while it runs.
    if (S.hose && S.arc) {
      const k = ramp(t, 0.9, 1.3) * (1 - ramp(t, 3.2, 3.7));
      const q = rest.clone().slerp(restSplit, ramp(t, 5.0, 5.6) * (1 - ramp(t, 7.0, 7.4))).slerp(aim, k);
      S.hose.quaternion.copy(q);
      Wt.handR.getWorldPosition(hand);
      S.hose.position.copy(hand).sub(GRIP.clone().applyQuaternion(q));
    }
    if (!S.arc) return;
    // Water: the front travels to the bucket, the tail leaves the nozzle.
    const lead = clamp01((t - T0) / 0.8);
    const tail = ramp(t, T1 + 0.3, T1 + 0.9);
    const on = t > T0 && t < T1 + 1.0;
    S.drops.forEach((d, i) => {
      const k = ((i / S.drops.length) + t * 1.1) % 1;
      d.visible = on && k <= lead && k >= tail;
      d.position.copy(arcAt(k));
      d.scale.setScalar(0.85 + 0.25 * Math.sin(i * 2.1));
    });
    // Splash where it lands: small droplets hop above the water, ripple ring.
    const landed = ramp(t, T0 + 0.8, T0 + 0.95) * (1 - ramp(t, T1 + 0.5, T1 + 0.9));
    S.splash.forEach((d, i) => {
      const ph = (t * 2.2 + i / S.splash.length) % 1, a = i * 2.4;
      d.visible = landed > 0.05;
      d.position.set(BUCKET.x + Math.cos(a) * 0.1 * ph + 0.02, WATER_Y + 0.02 + Math.sin(ph * Math.PI) * 0.16, BUCKET.z + Math.sin(a) * 0.08 * ph);
      d.scale.setScalar(0.8 * landed);
    });
    const rp = (t * 1.6) % 1;
    S.b18ripple.visible = landed > 0.05;
    S.b18ripple.scale.setScalar(0.4 + rp * 1.6);
    S.b18ripple.material.opacity = 1; // toon material: ring simply grows

    // Bowls: one big bowl divides into three equal bowls that slide apart.
    const e = ramp(t, 5.7, 6.15) * (1 - ramp(t, 6.75, 7.25));
    const ks = smooth(clamp01(e * 2.2));
    S.bowl[0].scale.setScalar(lerp(BIG, FIN, e));
    S.bowl[0].position.x = 0;
    [1, 2].forEach((i, n) => {
      const b = S.bowl[i];
      b.visible = ks > 0.01;
      b.scale.setScalar(Math.max(0.001, ks * FIN));
      b.position.x = (n === 0 ? -1 : 1) * GAP * e / SCALE;
    });
    B.e = e;
  };

  B.reveal = (t) => {
    const fade = 1 - ramp(t, 6.7, 7.0);
    const arcFade = 1 - ramp(t, 3.15, 3.6), shapeFade = 1 - ramp(t, 5.05, 5.45);
    reveal(S.L.arc, (t - T0) / 0.8, arcFade);
    reveal(B.tower, (t - 3.3) / 0.25, shapeFade);
    reveal(B.deck, (t - 3.3) / 0.3, shapeFade);
    B.hyp.forEach((l, i) => reveal(l, (t - 3.55 - Math.floor(i / 2) * 0.17) / 0.2, shapeFade));
    B.corner.forEach((l) => reveal(l, (t - 4.0) / 0.2, shapeFade));
    // Split cues: thirds on the big bowl first, then a ring per bowl.
    const thirdsA = ramp(t, 5.4, 5.55) * (1 - ramp(t, 5.8, 5.95));
    B.thirds.forEach((l) => { reveal(l, (t - 5.4) / 0.2, thirdsA); l.position.set(CTR.x, TOP, CTR.z); l.scale.setScalar(S.bowl[0].scale.x); });
    const xs = [0, -1, 1];
    B.rings.forEach((l, i) => {
      reveal(l, (t - 5.95 - i * 0.05) / 0.3, fade * 0.95);
      const k = i === 0 ? S.bowl[0].scale.x : S.bowl[i].scale.x;
      l.position.set(CTR.x + xs[i] * GAP * B.e, TOP, CTR.z);
      l.scale.setScalar(Math.max(0.001, k));
    });
  };

  B.arcTarget = () => toScreen(B.arcMid);
  return B;
}
