// Band 7-10 ("sharing") for the Why Do We Learn This? film.
//
// Children this age read division as SHARING, so the split beat is a whole
// pizza whose slices slide apart and land, two each, on four separate
// plates in front of Holmes, Watson and two waiting friends. No gold lines
// there: the gaps between the plates are the maths. The arc beat draws the
// ball's path as dotted footprints of light (no curve), and the shape
// beat's gold triangle is rebuilt every frame from the swing as it rocks.
//
// scene.js calls setup(ctx) once (after the set is built), then update(t)
// with the scene and lines(t) with the gold layer, every frame. Everything
// is a pure function of t.
export function setup(c) {
  const { THREE, scene, linesScene, S, mesh, SET, ramp, smooth, lerp, clamp01, arcAt, D, applyPose, mixPose, POSES, CATCH, HOLD } = c;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const B = {};

  // scene.js still calls reveal() on its gold lines; swap in inert stand-ins.
  const dead = () => ({ userData: { segs: 1 }, geometry: { setDrawRange() {} }, material: { opacity: 0 }, visible: false });
  for (const k of ["arc", "tri", "angle", "square", "ring"]) { linesScene.remove(S.L[k]); S.L[k] = dead(); }
  S.L.slices.forEach((l) => linesScene.remove(l));
  S.L.slices = [dead(), dead(), dead(), dead()];
  S.pie.visible = false; // pie.glb is replaced by the sliceable pizza below
  if (S.table) S.table.visible = false;

  // ── ARC: dotted footprints of light ───────────────────────────────────
  const printMat = new THREE.MeshBasicMaterial({ color: 0xffb52e, transparent: true, depthTest: false, depthWrite: false });
  const triMat = new THREE.MeshBasicMaterial({ color: 0xffb52e, transparent: true, depthTest: false, depthWrite: false });
  S.arc.apex = 2.6; // keep the throw inside the frame
  const NPRINT = 10;
  B.prints = [];
  const cum = [0];
  for (let i = 1; i <= 400; i++) cum.push(cum[i - 1] + arcAt(i / 400).distanceTo(arcAt((i - 1) / 400)));
  const kAtLen = (f) => { const L = f * cum[400]; let i = 1; while (i < 400 && cum[i] < L) i++; return (i - (cum[i] - L) / Math.max(1e-6, cum[i] - cum[i - 1])) / 400; };
  for (let i = 0; i < NPRINT; i++) {
    const k = kAtLen((i + 0.5) / NPRINT); // equal spacing along the path, not along time
    const p = arcAt(k), p2 = arcAt(Math.min(1, k + 0.01)), p1 = arcAt(Math.max(0, k - 0.01));
    const g = new THREE.Group();
    g.position.copy(p);
    g.rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    // Each print: an oval pad with a smaller round toe pad ahead of it.
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), printMat);
    pad.scale.set(1.35, 1, 0.3);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 8), printMat);
    toe.position.set(0.15, 0, 0);
    toe.scale.set(1, 1, 0.3);
    g.add(pad, toe);
    g.frustumCulled = false;
    g.userData.k = k;
    linesScene.add(g);
    B.prints.push(g);
  }

  // ── SHAPE: triangle chains that change as the swing rocks ─────────────
  const bar = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), triMat); m.frustumCulled = false; linesScene.add(m); return m; };
  B.tri = [bar(), bar(), bar()];
  B.corners = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), triMat); m.frustumCulled = false; linesScene.add(m); return m; });
  const place = (m, a, b) => {
    const d = b.clone().sub(a), len = Math.max(1e-4, d.length());
    m.position.copy(a).addScaledVector(d, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  };

  // ── SPLIT: serving board, plates, sliceable pizza, two friends ────────
  const TILT = 50 * D;
  const stage = new THREE.Group(); // board + plates + pizza in one frame tilted toward the camera
  stage.rotation.x = TILT;
  const HOME = V(0, 0.45, 1.22);
  scene.add(stage);
  B.stage = stage;
  // Teal serving board with cream trim: contrasts with the pavement.
  mesh(new THREE.BoxGeometry(5.0, 0.07, 1.05), 0x1f9a93, [0, -0.04, 0], { parent: stage });
  mesh(new THREE.BoxGeometry(5.08, 0.05, 0.07), 0xfff4dc, [0, -0.02, 0.5], { parent: stage });
  mesh(new THREE.BoxGeometry(5.08, 0.05, 0.07), 0xfff4dc, [0, -0.02, -0.5], { parent: stage });
  for (const x of [-2.4, 0, 2.4]) mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), 0x7a5234, [x, -0.5, -0.1], { parent: stage, rot: [-TILT, 0, 0] });

  const PLATE_X = [-1.8, -0.6, 0.6, 1.8];
  B.plates = PLATE_X.map(() => {
    const g = new THREE.Group();
    g.position.set(0, 0.02, 0);
    stage.add(g);
    mesh(new THREE.CylinderGeometry(0.47, 0.4, 0.05, 32), 0xffffff, [0, 0, 0], { parent: g });
    mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.054, 28), 0xfff1d6, [0, 0, 0], { parent: g, ink: false, cast: false });
    mesh(new THREE.TorusGeometry(0.41, 0.025, 8, 36), 0x2f6fd6, [0, 0.026, 0], { parent: g, rot: [Math.PI / 2, 0, 0], ink: false, cast: false });
    return g;
  });

  // One slice: cheese wedge (apex at the origin, pointing +z), crust band, pepperoni.
  const SL_R = 0.5, SL_H = 0.07;
  const mkSlice = () => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(SL_R, SL_R, SL_H, 8, 1, false, -Math.PI / 8, Math.PI / 4), 0xffcf4a, [0, 0, 0], { parent: g, inkThick: 0.7 });
    mesh(new THREE.CylinderGeometry(SL_R + 0.03, SL_R + 0.03, SL_H + 0.045, 8, 1, true, -Math.PI / 8, Math.PI / 4), 0xd98a3a, [0, 0, 0], { parent: g, ink: false, cast: false, mat: { side: THREE.DoubleSide } });
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 14), 0xd2462f, [0, SL_H / 2 + 0.01, SL_R * 0.64], { parent: g, ink: false, cast: false });
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), 0xd2462f, [0, SL_H / 2 + 0.011, SL_R * 0.3], { parent: g, ink: false, cast: false });
    return g;
  };
  // Slice j: apex at the pizza centre, heading j*45 deg. Lands on plate j>>1,
  // two side by side, tips pointing up-board (-z), one gap between them.
  const Y_WHOLE = 0.1, Y_LAND = 0.1, PI = Math.PI;
  const dAng = (a, b) => ((b - a + PI * 3) % (PI * 2)) - PI; // shortest turn a -> b
  B.slices = [];
  for (let j = 0; j < 8; j++) {
    const s = mkSlice();
    s.userData = { j, plate: j >> 1, side: j & 1 ? 1 : -1, phi: j * PI / 4 + PI / 8 };
    stage.add(s);
    B.slices.push(s);
  }
  const T_SLIDE = [5.15, 5.5], T_SLICE = 5.5, SLICE_DUR = 0.4, SLICE_STAGGER = 0.08;
  const T_UP = [4.5, 5.0], T_DOWN = [6.85, 7.15];
  const T_RUN = [3.85, 5.15], T_LEAVE = [6.8, 7.05];

  // ── Friends: two simple children (no text) ────────────────────────────
  const skin = [0xf4c6a0, 0xb97a4e], shirt = [0xf08a4b, 0x8f6fd6], hair = [0x5a3b28, 0x2b1d17], pants = [0x3b5b8c, 0x3b5b8c];
  B.kids = [-0.6, 0.6].map((x, n) => {
    const root = new THREE.Group();
    scene.add(root);
    mesh(new THREE.CapsuleGeometry(0.15, 0.4, 6, 14), shirt[n], [0, 0.8, 0], { parent: root });
    for (const sx of [-0.07, 0.07]) mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10), pants[n], [sx, 0.28, 0], { parent: root });
    const head = new THREE.Group(); head.position.set(0, 1.2, 0); root.add(head);
    mesh(new THREE.SphereGeometry(0.19, 20, 16), skin[n], [0, 0, 0], { parent: head });
    mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, PI * 2, 0, PI * 0.55), hair[n], [0, 0.02, -0.015], { parent: head });
    for (const sx of [-0.07, 0.07]) mesh(new THREE.SphereGeometry(0.028, 8, 6), 0x2a1f17, [sx, 0.0, 0.17], { parent: head, ink: false, cast: false });
    mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, PI), 0x8a3b2a, [0, -0.06, 0.175], { parent: head, rot: [0, 0, PI], ink: false, cast: false });
    if (n === 1) for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.07, 10, 8), hair[n], [sx * 0.2, -0.05, -0.02], { parent: head });
    const arms = [-1, 1].map((sd) => {
      const sh = new THREE.Group(); sh.position.set(sd * 0.18, 0.98, 0); root.add(sh);
      mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 10), shirt[n], [0, -0.17, 0], { parent: sh });
      mesh(new THREE.SphereGeometry(0.055, 10, 8), skin[n], [0, -0.38, 0], { parent: sh });
      return sh;
    });
    return { root, head, arms, x, n };
  });

  const tmp = V(0, 0, 0);

  B.update = (t) => {
    const Wt = S.W, H = S.H;
    const inSplit = t >= 4.6 && t <= 7.2;

    // The swing really rocks in the picture plane (about the pivot X axis once the set faces the camera).
    if (S.swingPivot) { S.swingPivot.rotation.z = 0; S.swingPivot.rotation.x = Math.cos(PI * (t - 4.2)) * 0.55; }

    // Board + plates rise out of the pavement, hold, sink back.
    const up = ramp(t, T_UP[0], T_UP[1]) * (1 - ramp(t, T_DOWN[0], T_DOWN[1]));
    stage.visible = up > 0.01;
    stage.position.set(HOME.x, HOME.y - (1 - up) * 1.1, HOME.z);

    // Plates start stacked under the pizza and slide out to their places.
    const sp = smooth(ramp(t, T_SLIDE[0], T_SLIDE[1]));
    B.plates.forEach((g, i) => { g.position.x = PLATE_X[i] * sp; });

    // Slices: whole pizza, then each pair slides apart onto its own plate.
    B.slices.forEach((s) => {
      const { plate, side, phi } = s.userData;
      const k = smooth(clamp01((t - (T_SLICE + plate * SLICE_STAGGER)) / SLICE_DUR));
      // Whole pizza: a hair of gap along each seam so the 8 slices can be counted.
      const seam = 0.016 * (1 - k);
      const x = lerp(Math.sin(phi) * seam, PLATE_X[plate] + side * 0.19, k);
      const z = lerp(Math.cos(phi) * seam, 0.2, k);
      const y = lerp(Y_WHOLE, Y_LAND, k) + Math.sin(PI * k) * 0.4;
      s.position.set(x, y, z);
      s.rotation.y = phi + dAng(phi, PI) * k;
      s.scale.setScalar(lerp(1.0, 0.8, k));
    });

    // Friends run in behind the pair, wait, cheer when the shares land, run out.
    B.kids.forEach((kd, i) => {
      const side = i === 0 ? -1 : 1, off = i * 0.12;
      const inK = smooth(ramp(t, T_RUN[0] + off, T_RUN[1] + off)), outK = smooth(ramp(t, T_LEAVE[0] + off * 0.5, T_LEAVE[1] + off * 0.5));
      const x = lerp(side * 5.2, kd.x, inK) + (outK > 0 ? lerp(0, side * 6 - kd.x, outK) : 0);
      const z = lerp(-0.7, 0.05, smooth(ramp(t, T_RUN[0] + 0.55, T_RUN[1] + 0.05))) * (1 - outK) + -0.7 * outK;
      const moving = (inK > 0.001 && inK < 0.999) || (outK > 0.001 && outK < 0.999);
      kd.root.visible = inK > 0.001 && outK < 0.999;
      kd.root.position.set(x, moving ? Math.abs(Math.cos(t * 13 + i)) * 0.05 : 0, z);
      const run = (inK > 0.001 && inK < 0.999) ? side * -1 : outK > 0 ? side : 0;
      const faceCam = smooth(ramp(t, T_RUN[1] - 0.15 + off, T_RUN[1] + 0.2 + off)) * (1 - smooth(ramp(t, T_LEAVE[0] - 0.05, T_LEAVE[0] + 0.2)));
      kd.root.rotation.y = lerp(run * PI / 2, 0, faceCam);
      const cheer = ramp(t, 6.2 + i * 0.07, 6.45 + i * 0.07) * (1 - ramp(t, 6.8, 6.95));
      const sw = moving ? Math.sin(t * 13 + i) * 0.7 : 0;
      kd.arms[0].rotation.set(sw * (1 - cheer) - cheer * 2.7, 0, 0.2 + cheer * 0.45);
      kd.arms[1].rotation.set(-sw * (1 - cheer) - cheer * 2.7, 0, -0.2 - cheer * 0.45);
      kd.head.rotation.x = 0.12 * (1 - cheer) - cheer * 0.2;
      kd.root.position.y += cheer * Math.max(0, Math.sin((t - 6.35) * 10)) * 0.05;
    });

    if (!inSplit) return;
    // Weight of the sharing set-up being on stage.
    const w = ramp(t, 4.7, 5.2) * (1 - ramp(t, 6.9, 7.15));

    // Watson: from the catch spot to the end of the board, shows the shares, returns.
    // (Replaces scene.js's lift-pie walk for this band: baseline is the catch spot.)
    Wt.root.position.copy(SET.watsonCatch).lerp(V(1.8, 0, 0.1), w);
    const moving = (t > 4.7 && t < 5.2) || (t > 6.9 && t < 7.15);
    const stride = moving ? Math.sin(t * 14) : 0;
    Wt.root.position.y = moving ? Math.abs(Math.cos(t * 14)) * 0.025 : 0;
    Wt.root.rotation.set(0, lerp(-22, -6, w) * D, 0);
    const present = ramp(t, 5.55, 5.9) * (1 - ramp(t, 6.9, 7.1));
    const open = { ...POSES.watson.toss, shoulderR: [-96, 0, 24], shoulderL: [-96, 0, -24], elbowR: -14, elbowL: -14, head: [8, 0, 0] };
    const pose = mixPose(mixPose(HOLD, CATCH, ramp(t, 4.75, 5.1) * (1 - ramp(t, 6.9, 7.12))), open, present);
    applyPose(Wt, pose, { headX: Math.sin(t * PI * 2 / 5 + 1) * 1.2, hipL: 22 * stride, hipR: -22 * stride });

    // Holmes turns more toward the camera to watch the plates.
    H.root.rotation.y = lerp(H.root.rotation.y, 12 * D, w);

    // Ball: Watson sets it down at his feet for the sharing, picks it up after.
    const down = ramp(t, 4.7, 5.15) * (1 - ramp(t, 6.95, 7.2));
    if (down > 0.001) {
      Wt.handR.getWorldPosition(tmp);
      const hand = tmp.clone().add(V(0, 0.06, 0.06));
      const pos = hand.lerp(V(2.55, 0.13, 0.55), smooth(down));
      pos.y += Math.sin(PI * down) * 0.22;
      S.ball.position.copy(pos);
    }
    S.ball.visible = true;
  };

  // Gold layer (seen only through the lens): footprints and the rocking triangle.
  B.lines = (t) => {
    const { t0, t1 } = S.arc;
    const prog = (t - t0) / (t1 - t0);
    printMat.opacity = 1 - ramp(t, 3.15, 3.6);
    B.prints.forEach((g) => { g.visible = prog >= g.userData.k && printMat.opacity > 0.01; });

    const kShape = ramp(t, 3.3, 3.5) * (1 - ramp(t, 5.0, 5.3));
    triMat.opacity = kShape;
    S.swing.updateMatrixWorld(true);
    const pivot = V(0, 0, 0); S.swingPivot.getWorldPosition(pivot);
    const seat = S.swingPivot.localToWorld(V(0, -1.6, 0)); // chain end (the seat mesh's node sits at the pivot)
    const plumb = pivot.clone().add(V(0, -pivot.distanceTo(seat), 0));
    const pts = [pivot, seat, plumb];
    [[pivot, seat], [seat, plumb], [plumb, pivot]].forEach(([a, b], i) => {
      const k = smooth(clamp01((t - (3.3 + i * 0.18)) / 0.3));
      place(B.tri[i], a, a.clone().lerp(b, k));
      B.tri[i].visible = kShape > 0.01 && k > 0.02;
    });
    B.corners.forEach((m, i) => { m.position.copy(pts[i]); m.visible = kShape > 0.01 && t > 3.9; });
  };
  return B;
}
