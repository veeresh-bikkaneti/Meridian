import { useEffect, useRef, useState } from "react";
import globeTextureUrl from "@/assets/home-v5/globe-texture.webp";
import globeFallbackUrl from "@/assets/home-v5/globe-fallback.webp";
import { DEG, GLOBE_CONTRACT as C, LANDMARKS } from "./home-globe/globe-contract.ts";
import {
  createGlobeControlsState,
  stepGlobeControls,
  type GlobeControlsEffects,
  type GlobeControlsState,
} from "./home-globe/globe-controls.ts";

/**
 * Landmark globe for the v5 home hero: the textured sphere from the
 * original globe, now carrying the fifteen contract landmarks
 * (docs/mockups/landmark-globe-contract.md), ported from the approved
 * mock. Perf contract:
 * - three is dynamically imported ONLY when the hero nears the viewport
 *   (IntersectionObserver), so it never lands in the initial bundle path
 *   beyond this lazy component, and never blocks first paint.
 * - DPR capped at 1.5; merged-geometry landmarks; MeshStandardMaterial;
 *   NO post-processing, no bloom.
 * - prefers-reduced-motion, Save-Data, WebGL failure, or import failure
 *   all land on the static texture disc — the design is the default,
 *   the live globe is only an enhancement.
 * - Rendering pauses while the hero is off-screen or the tab is hidden.
 * - Motion and input run through the pure step function in
 *   home-globe/globe-controls.ts, driven only by the render clock.
 * Interactive (not decorative): the canvas is labelled and keyboard-focusable
   (role="img", tabIndex, arrow keys spin it), so the mount must NOT be
   aria-hidden. The static fallback image stays aria-hidden since it is
   purely decorative (alt="").
 */
export function HomeGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Loading-orb state: false until the globe texture uploads. The orb
  // overlay renders inside the mount while the texture is pending, then
  // fades out (opacity transition, unmounted on transition end); it is
  // NOT a Suspense fallback — the fallback cannot cover this post-mount
  // waterfall. Reduced-motion / Save-Data / low-memory / WebGL-failure /
  // import-failure / texture-error paths all land on the static disc
  // below, where no orb ever appears.
  const [textured, setTextured] = useState(false);
  const [orbGone, setOrbGone] = useState(false);
  const [fallback, setFallback] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    return reduced || saveData;
  });

  // If the OS reduced-motion setting flips on after load, swap to the
  // static disc — the mount-time check alone would miss it.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (mq.matches) setFallback(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (fallback) return;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof mem === "number" && mem > 0 && mem <= 2) {
      setFallback(true);
      return;
    }
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const start = () => {
      Promise.all([import("three"), import("./home-globe/landmark-models")])
        .then(([THREE, models]) => {
          if (disposed) return;
          try {
            cleanup = initGlobe(
              THREE,
              mount,
              () => {
                if (!disposed) setFallback(true);
              },
              () => {
                if (!disposed) setTextured(true);
              },
              models,
            );
          } catch {
            if (!disposed) setFallback(true);
          }
        })
        .catch(() => {
          if (!disposed) setFallback(true);
        });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(mount);
    return () => {
      disposed = true;
      io.disconnect();
      cleanup?.();
    };
  }, [fallback]);

  if (fallback) {
    return (
      <img
        className="hv5-globe-fallback"
        src={globeFallbackUrl}
        alt=""
        aria-hidden="true"
        style={{ objectPosition: "72% 50%" }}
      />
    );
  }
  return (
    <div ref={mountRef} className="hv5-globe-mount">
      {orbGone ? null : (
        <span
          aria-hidden="true"
          className={textured ? "hv5-globe-orb hv5-globe-orb-fading" : "hv5-globe-orb"}
          onTransitionEnd={(e) => {
            if (e.propertyName === "opacity") setOrbGone(true);
          }}
        >
          <span aria-hidden="true" className="meridian-spinner hv5-orb-spinner" />
        </span>
      )}
    </div>
  );
}

type ThreeModule = typeof import("three");
type LandmarkModels = typeof import("./home-globe/landmark-models");

function initGlobe(
  THREE: ThreeModule,
  mount: HTMLDivElement,
  onFail: () => void,
  onTextured: () => void,
  models: LandmarkModels,
): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) {
    renderer.dispose();
    onFail();
    return () => {};
  }
  const DPR = Math.min(window.devicePixelRatio || 1, C.dprCap);
  renderer.setPixelRatio(DPR);
  const W = mount.clientWidth || 600;
  const H = mount.clientHeight || 600;
  const small = W < C.smallBelowPx;
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    onFail();
  });
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(C.fov, W / H, 0.1, 100);
  camera.position.set(0, 0, C.zoom.start);

  scene.add(new THREE.AmbientLight(C.lights.ambient.color, C.lights.ambient.intensity));
  for (const spec of [C.lights.sun, C.lights.rim, C.lights.brassRim]) {
    const light = new THREE.DirectionalLight(spec.color, spec.intensity);
    light.position.set(spec.position[0], spec.position[1], spec.position[2]);
    scene.add(light);
  }

  const group = new THREE.Group();
  scene.add(group);
  const R = C.radius;
  const tex = new THREE.TextureLoader().load(
    globeTextureUrl,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      // Paint one frame now: the loop parks while the hero is
      // off-screen, and without this the canvas keeps the black
      // pre-texture frame until the loop next runs (a full-page
      // capture at 768px caught exactly that stale frame).
      renderer.render(scene, camera);
      onTextured();
    },
    undefined,
    () => onFail(),
  );
  const seg = small ? C.segments.small : C.segments.full;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, seg[0], seg[1]),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 }),
  );
  group.add(globe);
  scene.add(models.buildHalo());

  /* Landmarks on their drawn-at spots, each with a soft contact shadow */
  const mat = models.createMaterialFactory();
  const shadowTex = models.createShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const UP = new THREE.Vector3(0, 1, 0);
  const rise: Array<{
    holder: InstanceType<ThreeModule["Group"]>;
    model: InstanceType<ThreeModule["Group"]>;
    n: InstanceType<ThreeModule["Vector3"]>;
    base: number;
    lm: LandmarkSpecT;
    /** 0..1 reveal progress, eased by the shared reveal path below. */
    revealP: number;
  }> = [];
  type LandmarkSpecT = (typeof LANDMARKS)[number];
  const holders: Array<InstanceType<ThreeModule["Group"]>> = [];
  const holderById = new Map<string, { holder: InstanceType<ThreeModule["Group"]>; lm: LandmarkSpecT }>();
  for (const lm of LANDMARKS) {
    const n = models.latLonToVec3(lm.drawnLat, lm.drawnLon, 1).normalize();
    const holder = new THREE.Group();
    holder.position.copy(n).multiplyScalar(R * 0.998);
    holder.quaternion.setFromUnitVectors(UP, n);
    // Generic data prop, not a per-landmark path: an elongated model
    // (Rama Setu's ridge) spins about the surface normal to its bearing.
    if (lm.spinDeg) {
      holder.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(UP, lm.spinDeg * DEG),
      );
    }
    holder.userData.lmId = lm.id;
    holders.push(holder);
    holderById.set(lm.id, { holder, lm });
    const model = models.buildLandmark(mat, lm);
    model.scale.setScalar(lm.scale);
    holder.add(model);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(lm.scale * 0.75, 20), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    holder.add(shadow);
    rise.push({ holder, model, n: n.clone(), base: lm.scale, lm, revealP: 0 });
    group.add(holder);
  }

  /* Orbit ring and the plane that rides it */
  const ringPivot = new THREE.Group();
  ringPivot.rotation.set(C.ring.tiltX, C.ring.tiltY, 0);
  group.add(ringPivot);
  ringPivot.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(R * C.ring.radius, C.ring.tube, 8, 160),
      new THREE.MeshBasicMaterial({
        color: 0x8a6d2f,
        transparent: true,
        opacity: C.ring.opacity,
      }),
    ),
  );
  const plane = models.buildPlane(mat);
  ringPivot.add(plane);
  let planeAngle = 0.6;

  /* Rest pose: axial tilt, viewer pitch, start longitude */
  const qTilt = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(C.viewerPitch, 0, C.axialTiltDeg * DEG, "XYZ"),
  );
  const startPose = () =>
    qTilt
      .clone()
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2 - C.startLongitudeDeg * DEG),
      );
  group.quaternion.copy(startPose());
  const poleTarget = UP.clone().applyQuaternion(qTilt);

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let controls: GlobeControlsState = createGlobeControlsState();
  const step = (input: Parameters<typeof stepGlobeControls>[1]): GlobeControlsEffects => {
    const result = stepGlobeControls(controls, input);
    controls = result.state;
    return result.effects;
  };

  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const focusTmp = new THREE.Vector3();
  const focusQ = new THREE.Quaternion();
  const applyRotation = (effects: GlobeControlsEffects) => {
    if (!effects.rotateAngle) return;
    tmpV.set(effects.rotateAxisX, effects.rotateAxisY, 0);
    tmpQ.setFromAxisAngle(tmpV, effects.rotateAngle);
    group.quaternion.premultiply(tmpQ);
  };

  /* Dive driver (one block): a tap on a landmark slerps the globe to
   * face it while the controls ease covers the dive distance; the dive
   * input parks auto-spin until the next real input. A real drag, wheel
   * or key cancels the flight mid-way; reduced motion snaps. The flight
   * always completes its arc or is stopped by real input — no timer
   * cuts any motion off.
   *
   * Wave-1: the flight ends OBLIQUE, not plan. The target is the
   * face-on pose pitched by diveTiltDeg about the screen-horizontal
   * axis through the landmark's base point — a pivot rotation, so the
   * group also eases to the compensating offset p − R·p and the
   * landmark keeps its face-on screen spot while the view finishes
   * ~50° above its horizon (Google-Earth style: the model stands in
   * profile, large in frame). Verified numerically with the repo's
   * own three math before it was coded (MOCKUP-STATUS.md, wave 1):
   * at 53° and diveDist 2.05 the finish elevation is 50.3°, a
   * unit-height model's top lands at NDC y ≈ +0.14…+0.28, and the
   * nearest globe surface stays 0.94 from the camera (near = 0.1).
   * Cancelling a dive eases the offset back to zero so plain browsing
   * re-centres; starting a dive supersedes the return. */
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const ZERO_V = new THREE.Vector3();
  let diveAnim: {
    from: InstanceType<ThreeModule["Quaternion"]>;
    to: InstanceType<ThreeModule["Quaternion"]>;
    fromPos: InstanceType<ThreeModule["Vector3"]>;
    toPos: InstanceType<ThreeModule["Vector3"]>;
    t: number;
    /** The dive's target: the reveal path force-reveals it in flight. */
    id: string;
  } | null = null;
  let posReturn: {
    from: InstanceType<ThreeModule["Vector3"]>;
    t: number;
  } | null = null;
  /** The dive's target, in flight and while parked: the reveal path
   *  treats it as the player's focus and always reveals it (reveal
   *  v2). Cleared by cancelDive, i.e. by the next real input. */
  let diveTarget: {
    id: string;
    n: InstanceType<ThreeModule["Vector3"]>;
  } | null = null;
  const startDive = (lm: LandmarkSpecT) => {
    const face = qTilt
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, lm.drawnLat * DEG))
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2 - lm.drawnLon * DEG),
      );
    const tilt = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -C.zoom.diveTiltDeg * DEG);
    const to = tilt.clone().multiply(face);
    // The landmark's base in world space under the face-on pose; the
    // pivot offset keeps that point fixed under the tilted pose.
    const n = models.latLonToVec3(lm.drawnLat, lm.drawnLon, 1).normalize();
    const base = n.clone().multiplyScalar(R * 0.998).applyQuaternion(face);
    const toPos = base.clone().sub(base.clone().applyQuaternion(tilt));
    diveTarget = { id: lm.id, n };
    step({ type: "dive", targetDist: C.zoom.diveDist });
    posReturn = null;
    if (reducedMotion()) {
      group.quaternion.copy(to);
      group.position.copy(toPos);
      diveAnim = null;
    } else {
      diveAnim = {
        from: group.quaternion.clone(),
        to,
        fromPos: group.position.clone(),
        toPos,
        t: 0,
        id: lm.id,
      };
    }
  };
  const cancelDive = () => {
    diveAnim = null;
    diveTarget = null;
    if (group.position.lengthSq() < 1e-10) {
      posReturn = null;
    } else if (reducedMotion()) {
      group.position.copy(ZERO_V);
      posReturn = null;
    } else {
      posReturn = { from: group.position.clone(), t: 0 };
    }
  };

  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Globe. Drag or use arrow keys to spin.");
  canvas.style.cursor = "grab";

  const pointers = new Map<number, { x: number; y: number }>();
  /** Press that may become a tap: origin, start time, whether it pinched. */
  let downInfo: { x: number; y: number; t: number; pinch: boolean } | null = null;
  let pinchStartDist = 0;
  let pinchStartTarget: number = C.zoom.start;
  let lastMid: { x: number; y: number } | null = null;
  let lastMoveT = 0;

  const onDown = (e: PointerEvent) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelDive();
    step({ type: "dragStart" });
    lastMoveT = performance.now();
    if (pointers.size === 1) {
      downInfo = { x: e.clientX, y: e.clientY, t: lastMoveT, pinch: false };
    } else if (downInfo) {
      downInfo.pinch = true;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchStartTarget = controls.targetDist;
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const t = performance.now();
    const dt = Math.max((t - lastMoveT) / 1000, 1 / 240);
    lastMoveT = t;
    if (pointers.size === 1) {
      applyRotation(step({ type: "dragMove", dx, dy, dt }));
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const effects = step({
        type: "pinch",
        pinchStartTarget,
        distanceRatio: pinchStartDist / d,
        midDx: lastMid ? mid.x - lastMid.x : 0,
        midDy: lastMid ? mid.y - lastMid.y : 0,
      });
      lastMid = mid;
      applyRotation(effects);
    }
  };
  const handleTap = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(holders, true);
    if (!hits.length) return;
    // A far-side landmark must not win through the globe: the model has
    // to be the first thing the ray meets (it stands proud of the skin).
    const globeHit = ray.intersectObject(globe, false)[0];
    if (globeHit && hits[0].distance > globeHit.distance + 0.05) return;
    let obj: InstanceType<ThreeModule["Object3D"]> | null = hits[0].object;
    while (obj && typeof obj.userData.lmId !== "string") obj = obj.parent;
    const entry = obj ? holderById.get(obj.userData.lmId as string) : undefined;
    if (entry) startDive(entry.lm);
  };

  const endDrag = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0 && downInfo) {
      // A tap is a press that stayed put and let go quickly (<6 px,
      // <400 ms, never a pinch): it asks for the dive, not a drag end.
      const travel = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
      if (!downInfo.pinch && travel < 6 && performance.now() - downInfo.t < 400) {
        handleTap(e.clientX, e.clientY);
      }
      downInfo = null;
    }
    if (pointers.size === 1) {
      // Pinch 2 -> 1: the remaining finger is still dragging, so do not
      // end the drag (that would clear dragging, reset idleTime and let
      // inertia / auto-spin run under the held finger). Clear the pinch
      // state and re-baseline: the remaining pointer's entry in
      // `pointers` already holds its current position, and the next
      // dragMove derives its delta from that entry, so keeping it is
      // the re-baseline (no jump from the old pinch midpoint). Only the
      // move clock is refreshed, so the next dt is not measured across
      // the pinch.
      lastMid = null;
      pinchStartDist = 0;
      lastMoveT = performance.now();
    } else if (pointers.size === 0) {
      step({
        type: "dragEnd",
        stale: performance.now() - lastMoveT > 80,
        reducedMotion: reducedMotion(),
      });
      canvas.style.cursor = "grab";
    } else {
      lastMid = null;
    }
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onWheel = (e: WheelEvent) => {
    cancelDive();
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const overSphere = ray.intersectObject(globe, false).length > 0;
    const effects = step({ type: "wheel", deltaY: e.deltaY, overSphere });
    if (effects.consumed) e.preventDefault();
  };

  const HANDLED_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "0"];
  const onKey = (e: KeyboardEvent) => {
    if (!HANDLED_KEYS.includes(e.key)) return;
    cancelDive();
    const effects = step({ type: "key", key: e.key });
    if (effects.resetPose) group.quaternion.copy(startPose());
    applyRotation(effects);
    e.preventDefault();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKey);

  let visible = true;
  const visIo = new IntersectionObserver((es) => {
    visible = es[0]?.isIntersecting ?? false;
    if (visible) kick();
  });
  visIo.observe(mount);
  const onVisibility = () => {
    if (!document.hidden) kick();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onResize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // setSize clears the drawing buffer; repaint one frame so a
    // resize while the loop is parked cannot leave a blank canvas.
    renderer.render(scene, camera);
  };
  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  if (resizeObserver) resizeObserver.observe(mount);
  else window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  let raf = 0;
  let elapsed = 0;
  const qa = new THREE.Quaternion();
  const qi = new THREE.Quaternion();
  const poleNow = new THREE.Vector3();
  // The loop fully stops off-screen / hidden (no idle rAF churn) and is
  // re-kicked by the IntersectionObserver / visibilitychange handlers.
  // Rotation is clock-derived, so a restart resumes at the current phase.
  function kick() {
    if (raf === 0) loop();
  }
  const loop = () => {
    if (!visible || document.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const rm = reducedMotion();

    const effects = step({ type: "tick", dt, reducedMotion: rm });
    applyRotation(effects);

    // Progressive reveal (owner direction, wave 2) — the ONE shared
    // reveal path for every landmark: a landmark is on the skin only
    // while the camera sits at or inside its revealAt distance (Tier A
    // from globe view, deeper tiers as the user dives), and the dive's
    // target is revealed for the whole flight. The reveal rides the
    // old rise-in's curve (scale 0.9 -> 1 while settling outward along
    // the normal) and runs in reverse as the user zooms back out past
    // a threshold, so landmarks settle away again. A landmark at zero
    // progress is invisible — globe view sheds its draw calls whole.
    // Snaps under reduced motion, like every other ease here.
    //
    // Reveal v2 (owner correction, Nov 20 2026): distance alone
    // revealed a whole REGION at dive depth — the Grand Canyon's own
    // frame filled with five neighbours at full size. A landmark must
    // now ALSO sit within the focus radius (contract revealFocus,
    // interpolated over distance, shrinking as the camera closes in)
    // of where the player is looking: the dive target while a dive is
    // in flight or parked, else the surface point at frame centre.
    // Both directions live in group space, so the angles are the
    // sphere's own. The target itself always reveals.
    const bands = C.revealFocus.bands;
    let focusDeg = bands[bands.length - 1][1];
    if (controls.dist >= bands[0][0]) {
      focusDeg = bands[0][1];
    } else {
      for (let i = 0; i < bands.length - 1; i++) {
        const [d1, r1] = bands[i];
        const [d2, r2] = bands[i + 1];
        if (controls.dist <= d1 && controls.dist >= d2) {
          focusDeg = r1 + ((r2 - r1) * (d1 - controls.dist)) / (d1 - d2);
          break;
        }
      }
    }
    const focusN = diveTarget
      ? diveTarget.n
      : focusTmp
          .copy(camera.position)
          .sub(group.position)
          .normalize()
          .applyQuaternion(focusQ.copy(group.quaternion).invert());
    const focusRad = focusDeg * DEG;
    for (const item of rise) {
      const want =
        (controls.dist <= item.lm.revealAt && focusN.angleTo(item.n) <= focusRad) ||
        (diveTarget !== null && diveTarget.id === item.lm.id)
          ? 1
          : 0;
      if (rm) item.revealP = want;
      else if (item.revealP < want)
        item.revealP = Math.min(want, item.revealP + dt / C.riseSeconds);
      else if (item.revealP > want)
        item.revealP = Math.max(want, item.revealP - dt / C.riseSeconds);
      item.holder.visible = item.revealP > 0;
      if (item.holder.visible) {
        const e = 1 - Math.pow(1 - item.revealP, 3);
        item.model.scale.setScalar(item.base * (0.9 + 0.1 * e));
        item.holder.position.copy(item.n).multiplyScalar(R * 0.998 - (1 - e) * 0.04);
      }
    }
    // Dive flight: slerp the saved arc over diveSeconds with a
    // smoothstep ease; the controls' zoom ease covers the distance in
    // the same window. Completing the arc ends the flight — nothing
    // here stops any other motion early.
    if (diveAnim) {
      diveAnim.t += dt / C.zoom.diveSeconds;
      const u = Math.min(diveAnim.t, 1);
      const k = u * u * (3 - 2 * u);
      group.quaternion.slerpQuaternions(diveAnim.from, diveAnim.to, k);
      group.position.lerpVectors(diveAnim.fromPos, diveAnim.toPos, k);
      if (diveAnim.t >= 1) diveAnim = null;
    } else if (posReturn) {
      // A cancelled dive's offset eases home over 0.6 s on the same
      // smoothstep; a fresh dive supersedes it (startDive clears it).
      posReturn.t += dt / 0.6;
      const u = Math.min(posReturn.t, 1);
      const k = u * u * (3 - 2 * u);
      group.position.lerpVectors(posReturn.from, ZERO_V, k);
      if (posReturn.t >= 1) posReturn = null;
    }
    if (effects.autoSpinAngle) {
      group.quaternion.multiply(tmpQ.setFromAxisAngle(UP, effects.autoSpinAngle));
      // Upright drift: the pole eases back to its tilt while turning.
      poleNow.copy(UP).applyQuaternion(group.quaternion);
      qa.setFromUnitVectors(poleNow, poleTarget);
      qi.identity().slerp(qa, (1 - Math.exp(-C.uprightEase * dt)) * effects.autoSpinRamp);
      group.quaternion.premultiply(qi);
    }
    camera.position.z = controls.dist;

    if (!rm) planeAngle += C.plane.speed * dt;
    const pr = R * C.ring.radius;
    plane.position.set(Math.cos(planeAngle) * pr, Math.sin(planeAngle) * pr, 0);
    plane.rotation.set(0, 0, planeAngle + Math.PI / 2);

    renderer.render(scene, camera);
  };

  /* Mockup capture hook (famous-landmarks mock): lets the capture spec
   * project a landmark to canvas coordinates so a scripted tap exercises
   * the real tap -> raycast -> dive path, and poll the flight state.
   * Scaffolding for the mock only — a production port removes it. */
  const mockMount = mount as HTMLDivElement & { __globeMock?: unknown };
  mockMount.__globeMock = {
    project: (id: string) => {
      const entry = holderById.get(id);
      if (!entry) return null;
      const wp = new THREE.Vector3();
      entry.holder.getWorldPosition(wp);
      const v = wp.project(camera);
      const r = canvas.getBoundingClientRect();
      return {
        x: r.left + ((v.x + 1) / 2) * r.width,
        y: r.top + ((1 - v.y) / 2) * r.height,
        behind: v.z > 1,
      };
    },
    dive: (id: string) => {
      const entry = holderById.get(id);
      if (!entry) return false;
      startDive(entry.lm);
      return true;
    },
    /** Park the globe on a landmark at an exact distance (regional
     *  framings): the real dive orientation and parked state, with the
     *  zoom target overridden. Keys would un-park and let auto-spin
     *  drift the frame before a screenshot lands (wave-2 regional
     *  finding: state passed, picture failed). */
    frameAt: (id: string, dist: number) => {
      const entry = holderById.get(id);
      if (!entry) return false;
      startDive(entry.lm);
      controls = { ...controls, targetDist: dist };
      return true;
    },
    state: () => ({
      dist: controls.dist,
      targetDist: controls.targetDist,
      parked: controls.parked,
      diving: diveAnim !== null,
    }),
    /** Ids whose holder is currently visible (reveal progress > 0). */
    revealed: () => {
      const ids: string[] = [];
      for (const { holder, lm } of holderById.values()) if (holder.visible) ids.push(lm.id);
      return ids;
    },
    renderInfo: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
    }),
    landmarkTris: () => {
      let total = 0;
      for (const { holder } of holderById.values()) {
        holder.traverse((o) => {
          const ud = o.userData as { tris?: number };
          if (typeof ud.tris === "number") total += ud.tris;
        });
      }
      return total;
    },
  };
  loop();

  return () => {
    delete mockMount.__globeMock;
    cancelAnimationFrame(raf);
    visIo.disconnect();
    resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", endDrag);
    canvas.removeEventListener("pointercancel", endDrag);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKey);
    // Full GPU teardown: geometries + materials (textures included), then
    // the renderer and its context — repeated home mounts must not leak.
    scene.traverse((obj) => {
      const mesh = obj as InstanceType<ThreeModule["Mesh"]>;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((mm) => mm.dispose());
      else if (material) material.dispose();
    });
    tex.dispose();
    shadowTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
  };
}
