import { useEffect, useRef, useState } from "react";
import globeTextureUrl from "@/assets/home-v5/globe-texture.webp";
import globeFallbackUrl from "@/assets/home-v5/globe-fallback.webp";

/**
 * Premium Three.js globe for the v5 home hero (design plan: the one bold
 * element). Ported from mock v5 with the same perf contract:
 * - three is dynamically imported ONLY when the hero nears the viewport
 *   (IntersectionObserver), so it never lands in the initial bundle path
 *   beyond this lazy component, and never blocks first paint.
 * - DPR capped at 1.5; modest geometry; MeshStandardMaterial; NO
 *   post-processing, no bloom.
 * - prefers-reduced-motion, Save-Data, WebGL failure, or import failure
 *   all land on the static texture disc — the design is the default,
 *   the live globe is only an enhancement.
 * - Rendering pauses while the hero is off-screen or the tab is hidden.
 * Decorative only: the mount is aria-hidden and carries no information.
 */
export function HomeGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);
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
      import("three")
        .then((THREE) => {
          if (disposed) return;
          try {
            cleanup = initGlobe(THREE, mount, () => {
              if (!disposed) setFallback(true);
            });
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
  return <div ref={mountRef} className="hv5-globe-mount" aria-hidden="true" />;
}

type ThreeModule = typeof import("three");

function initGlobe(THREE: ThreeModule, mount: HTMLDivElement, onFail: () => void): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) {
    renderer.dispose();
    onFail();
    return () => {};
  }
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(DPR);
  const W = mount.clientWidth || 600;
  const H = mount.clientHeight || 600;
  const small = W < 280;
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    onFail();
  });
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
  camera.position.set(0, 0, 4.6);

  scene.add(new THREE.AmbientLight(0xfff1da, 1.15));
  const sun = new THREE.DirectionalLight(0xffe9c4, 1.6);
  sun.position.set(-2.4, 1.6, 2.6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xdfe8d2, 0.45);
  rim.position.set(2.6, -0.8, -1.4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  const R = 1.62;
  const tex = new THREE.TextureLoader().load(
    globeTextureUrl,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    },
    undefined,
    () => onFail(),
  );
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, small ? 32 : 64, small ? 24 : 48),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 }),
  );
  globe.rotation.z = 0.18;
  group.add(globe);

  /* Orbit ring + satellite */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.22, 0.006, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0xb8932f, transparent: true, opacity: 0.5 }),
  );
  ring.rotation.x = Math.PI / 2.25;
  ring.rotation.y = 0.35;
  group.add(ring);
  const sat = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x8a6d2f }),
  );
  group.add(sat);

  /* Sequential pins */
  const pinCanvas = document.createElement("canvas");
  pinCanvas.width = pinCanvas.height = 128;
  const g = pinCanvas.getContext("2d");
  if (g) {
    g.beginPath();
    g.arc(64, 64, 15, 0, 7);
    g.fillStyle = "rgba(184,147,47,.28)";
    g.fill();
    g.beginPath();
    g.arc(64, 64, 8.5, 0, 7);
    g.fillStyle = "#8A6D2F";
    g.fill();
    g.beginPath();
    g.arc(64, 64, 3.6, 0, 7);
    g.fillStyle = "#FBF7EA";
    g.fill();
  }
  const pinTex = new THREE.CanvasTexture(pinCanvas);
  pinTex.colorSpace = THREE.SRGBColorSpace;
  const pins = [
    [0.62, 0.5],
    [-0.25, 0.95],
    [0.15, -0.75],
  ].map((ll, i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: pinTex, transparent: true, depthWrite: false }),
    );
    const phi = ((90 - ll[0] * 57.3) * Math.PI) / 180;
    const theta = (ll[1] * 57.3 * Math.PI) / 180;
    const r = R * 1.015;
    s.position.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.9 + 0.18,
      r * Math.sin(phi) * Math.sin(theta),
    );
    s.userData.i = i;
    group.add(s);
    return s;
  });
  group.rotation.x = 0.12;

  let yaw = 0.6;
  let pitch = 0.12;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Globe. Drag or use arrow keys to spin.");
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-0.55, Math.min(0.7, pitch + (e.clientY - lastY) * 0.005));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") yaw -= 0.2;
    else if (e.key === "ArrowRight") yaw += 0.2;
    else if (e.key === "ArrowUp") pitch = Math.max(-0.55, pitch - 0.08);
    else if (e.key === "ArrowDown") pitch = Math.min(0.7, pitch + 0.08);
    else return;
    e.preventDefault();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
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
  };
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  let raf = 0;
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
    if (!dragging) yaw += dt * 0.22;
    group.rotation.y = yaw;
    group.rotation.x = pitch;
    group.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.02;
    const a = clock.elapsedTime * 0.55;
    sat.position.set(Math.cos(a) * R * 1.22, Math.sin(a) * R * 0.42 + 0.28, Math.sin(a) * R * 1.05);
    pins.forEach((s) => {
      const ph = (clock.elapsedTime * 1.1 - (s.userData.i as number) * 0.9) % 2.2;
      const sc = 0.34 + Math.max(0, Math.sin((Math.min(ph, 1.4) / 1.4) * Math.PI)) * 0.13;
      s.scale.set(sc, sc, 1);
    });
    renderer.render(scene, camera);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    visIo.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", endDrag);
    canvas.removeEventListener("pointercancel", endDrag);
    canvas.removeEventListener("keydown", onKey);
    // Full GPU teardown: geometries + materials (textures included), then
    // the renderer and its context — repeated home mounts must not leak.
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) mat.dispose();
    });
    tex.dispose();
    pinTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
  };
}
