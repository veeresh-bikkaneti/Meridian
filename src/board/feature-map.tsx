import { useEffect, useRef } from "react";
import type { DonePathItem, LiveStory, SnapshotLane } from "./board-data";
import { prefersReducedMotion, webglAvailable } from "./view-helpers";

/**
 * Feature map — the 8 lanes as rows in a three.js scene.
 *
 * Follows the home globe's pattern (src/components/home-globe.tsx):
 * three is dynamically imported inside the effect, never statically, so
 * the game's bundle does not grow; the scene renders a single static
 * frame when the visitor prefers reduced motion (no camera motion);
 * any WebGL / import failure calls onUnavailable and the parent shows
 * the list view instead. The canvas is decorative for assistive tech —
 * the parent renders it aria-hidden and screen readers get the list.
 */

function tokenColor(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function textSprite(THREE: typeof import("three"), text: string, color: string): InstanceType<typeof THREE.Sprite> {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "600 40px sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    // Canvas fillText draws the string as pixels — it can never be
    // interpreted as markup.
    ctx.fillText(text, 8, 48, 496);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.4, 0.82, 1);
  return sprite;
}

export default function FeatureMap({
  lanes,
  stories,
  donePath,
  onUnavailable,
}: {
  lanes: readonly SnapshotLane[];
  stories: readonly LiveStory[];
  donePath: readonly DonePathItem[];
  onUnavailable: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;

    const fail = () => {
      if (failedRef.current) return;
      failedRef.current = true;
      onUnavailable();
    };

    if (!webglAvailable()) {
      fail();
      return;
    }

    import("three")
      .then((THREE) => {
        if (disposed || !mountRef.current) return;
        try {
          const reduced = prefersReducedMotion();
          const width = mount.clientWidth || 640;
          const height = Math.max(300, Math.round(width * 0.52));
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(width, height);
          renderer.domElement.setAttribute("aria-hidden", "true");
          renderer.domElement.setAttribute("data-testid", "feature-map-canvas");
          mount.appendChild(renderer.domElement);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 200);
          camera.position.set(0, 9.5, 13.5);
          camera.lookAt(0, 0, 0);

          scene.add(new THREE.AmbientLight(0xffffff, 0.85));
          const key = new THREE.DirectionalLight(0xffffff, 1.1);
          key.position.set(6, 12, 8);
          scene.add(key);

          const ink = tokenColor("--atlas-ink", "#f0e7d2");
          const brass = tokenColor("--atlas-brass", "#e8b64c");
          const muted = tokenColor("--atlas-muted", "#9db3ad");
          const statusColor: Record<LiveStory["status"], string> = {
            done: brass,
            "in-progress": tokenColor("--atlas-stamp", "#e86a5c"),
            "not-started": muted,
          };
          const statusHeight: Record<LiveStory["status"], number> = {
            done: 1.5,
            "in-progress": 0.95,
            "not-started": 0.45,
          };

          const laneZ = (laneIndex: number) => laneIndex * 1.7 - ((lanes.length - 1) * 1.7) / 2;
          const maxStories = Math.max(...lanes.map((l) => stories.filter((s) => s.lane === l.name).length), 1);

          lanes.forEach((lane, laneIndex) => {
            const z = laneZ(laneIndex);
            const label = textSprite(THREE, lane.name, ink);
            label.position.set(-maxStories * 0.62 - 2.6, 0.4, z);
            scene.add(label);
            const inLane = stories.filter((s) => s.lane === lane.name);
            inLane.forEach((story, i) => {
              const h = statusHeight[story.status];
              const geo = new THREE.BoxGeometry(0.92, h, 0.92);
              const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(statusColor[story.status]) });
              const box = new THREE.Mesh(geo, mat);
              box.position.set(i * 1.24 - ((maxStories - 1) * 1.24) / 2, h / 2, z);
              scene.add(box);
            });
          });

          // "Definition of all done" path: a line through the gates, in
          // order, sweeping across the lanes as the gates progress.
          const gates = donePath.filter((g) => g.type === "gate");
          if (gates.length > 1) {
            const points = gates.map((_, i) => {
              const t = i / (gates.length - 1);
              return new THREE.Vector3(
                t * (maxStories - 1) * 1.24 - ((maxStories - 1) * 1.24) / 2,
                2.1,
                laneZ(Math.round(t * (lanes.length - 1))),
              );
            });
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(
              lineGeo,
              new THREE.LineBasicMaterial({ color: new THREE.Color(brass) }),
            );
            scene.add(line);
            const dotGeo = new THREE.SphereGeometry(0.14, 12, 12);
            const dotMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(brass) });
            for (const p of points) {
              const dot = new THREE.Mesh(dotGeo, dotMat);
              dot.position.copy(p);
              scene.add(dot);
            }
          }

          if (reduced) {
            // Static scene: one frame, no camera motion, no loop.
            renderer.render(scene, camera);
            return;
          }
          const animate = () => {
            if (disposed || !renderer) return;
            // Gentle turntable only — the board's one ambient motion,
            // and it never runs under reduced motion (handled above).
            scene.rotation.y = Math.sin(performance.now() / 9000) * 0.08;
            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
          };
          animate();
        } catch {
          fail();
        }
      })
      .catch(() => fail());

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      try {
        renderer?.dispose();
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      } catch {
        // best-effort cleanup
      }
    };
    // Rebuilt when the live overlay lands (stories identity changes
    // once, when the GitHub fetch settles) — not on every render.
  }, [lanes, stories, donePath, onUnavailable]);

  return <div ref={mountRef} className="board-map-mount" aria-hidden="true" />;
}
