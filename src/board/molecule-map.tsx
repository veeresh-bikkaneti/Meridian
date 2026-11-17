/**
 * Board v3 — the molecular map (Phase 3, spec §3).
 *
 * One Three.js scene of the SAME published data as the trail:
 * story = atom, feature = molecule (atoms inside one translucent
 * bubble — belonging is a bubble, never a line), epic = cluster.
 * A bond is drawn ONLY for a recorded wait: the published file
 * carries exactly the recorded bonds (8 today) and this component
 * draws exactly those — if more lines than bonds were countable,
 * the build would be wrong (the Game seat's test, asserted in e2e
 * via the renderer's own counters).
 *
 * Layout is precomputed in the data layer (status-core.computeLayout)
 * — no runtime physics. Rendering is instanced (atoms, bonds) with
 * one shared label approach (a canvas sprite per feature). A small
 * custom orbit control implements the §3 gesture map; no examples/jsm
 * modules, so the lazy chunk stays inside the +180 KB gz budget.
 *
 * 3D is the navigation, DOM is the reading: the mirror list beside
 * the scene carries every title, status and line as real text, and
 * is the full fallback when WebGL is unavailable.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  findStory,
  type PublishedBoard,
} from "./board-data.ts";
import {
  ATOM_RADIUS,
  LABEL_HALF_HEIGHT,
  LABEL_LIFT,
  type BoardLayout,
} from "./status-core.ts";
import { StatusPill, StoryCardPanel } from "./trail-view.tsx";

/**
 * Stage height (uplift Fix 2): on desktop viewports the chart room
 * runs the full 560px — matching the .v3-map-stage min-height at
 * the same >900px breakpoint in board.css. Smaller viewports keep
 * the shipped proportion, floored at 420px.
 */
function stageHeight(width: number): number {
  return window.innerWidth > 900 ? 560 : Math.max(420, Math.min(560, width * 0.62));
}

const STATUS_COLOR: Record<string, number> = {
  done: 0xc39a3a,
  "in-progress": 0x33503f,
  "not-started": 0xbdb198,
};

interface FlatStory {
  slug: string;
  featureId: string;
}

export default function MoleculeMap({
  board,
  layout,
  selectedSlug,
  onSelect,
  onOpenInTrail,
  scheme,
}: {
  board: PublishedBoard;
  layout: BoardLayout;
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  onOpenInTrail: (slug: string) => void;
  /** The board's effective colour scheme (the visitor's switch
   * choice, or the system scheme under "System") — bonds + halo
   * follow it live; see the scheme effect below. */
  scheme: "light" | "dark";
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [tier, setTier] = useState("All of Meridian");
  const apiRef = useRef<{ reset: () => void; zoomBy: (f: number) => void } | null>(null);
  const selectedRef = useRef<string | null>(selectedSlug);
  selectedRef.current = selectedSlug;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const bondsRef = useRef<(() => void) | null>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const flat: FlatStory[] = board.epics.flatMap((e) =>
    e.features.flatMap((f) => f.stories.map((s) => ({ slug: s.slug, featureId: f.id }))),
  );
  const flatRef = useRef(flat);
  flatRef.current = flat;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    const width = stage.clientWidth || 800;
    const height = stageHeight(width);
    renderer.setSize(width, height);
    renderer.domElement.dataset.testid = "v3-map-canvas";
    renderer.domElement.style.touchAction = "none";
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
    scene.add(new THREE.AmbientLight(0xfff6e0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 50, 40);
    scene.add(sun);

    /* atoms — one instanced mesh */
    const atomGeo = new THREE.SphereGeometry(ATOM_RADIUS, 14, 10);
    const atomMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 });
    const atoms = new THREE.InstancedMesh(atomGeo, atomMat, flat.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    flat.forEach((fs, i) => {
      const found = findStory(board, fs.slug)!;
      const p = layout.positions[fs.slug];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      atoms.setMatrixAt(i, dummy.matrix);
      atoms.setColorAt(i, color.setHex(STATUS_COLOR[found.story.status]));
    });
    if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
    scene.add(atoms);

    /* selection halo — one extra mesh, moved to the selected atom */
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xe8b64c,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.08, 14, 10), haloMat);
    halo.visible = false;
    scene.add(halo);
    haloMatRef.current = haloMat;

    /* molecule bubbles — belonging, never a line */
    for (const epic of board.epics) {
      for (const feature of epic.features) {
        const c = layout.featureCenters[feature.id];
        const bubble = new THREE.Mesh(
          new THREE.SphereGeometry(layout.featureRadii[feature.id], 14, 10),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(epic.color),
            transparent: true,
            opacity: 0.07,
            depthWrite: false,
          }),
        );
        bubble.position.set(c[0], c[1], c[2]);
        scene.add(bubble);
        /* feature label sprite (canvas texture) */
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(246,241,227,0.92)";
        let fontSize = 52;
        ctx.font = `600 ${fontSize}px Georgia, serif`;
        while (ctx.measureText(feature.name).width > 460 && fontSize > 26) {
          fontSize -= 4;
          ctx.font = `600 ${fontSize}px Georgia, serif`;
        }
        const tw = Math.min(480, ctx.measureText(feature.name).width + 48);
        ctx.beginPath();
        ctx.roundRect((512 - tw) / 2, 22, tw, 84, 42);
        ctx.fill();
        ctx.fillStyle = "#33302a";
        ctx.fillText(feature.name, 256, 82);
        const tex = new THREE.CanvasTexture(canvas);
        /* depthTest off + a late renderOrder: a label is never clipped
         * by an atom in front of it, and LABEL_LIFT (status-core) keeps
         * the chip clear of its own bubble's atoms. */
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
        );
        sprite.renderOrder = 10;
        sprite.scale.set(9, LABEL_HALF_HEIGHT * 2, 1);
        sprite.position.set(c[0], c[1] + layout.featureRadii[feature.id] + LABEL_LIFT, c[2]);
        scene.add(sprite);
      }
    }

    /* bonds — exactly the recorded waits, instanced cylinders.
     * Cleanup: a slim 0.05 radius (the shipped 0.14 read as thick red
     * ropes across the whole scene) and per-instance colours — brass
     * normally, the atlas stamp only for a bond a story is actively
     * waiting on, the map's one accent (the trail's Blocked group is
     * the same fact in words). */
    const bondGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true);
    const bondMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bonds = new THREE.InstancedMesh(bondGeo, bondMat, board.bonds.length);
    const up = new THREE.Vector3(0, 1, 0);
    board.bonds.forEach((bond, i) => {
      const a = new THREE.Vector3(...layout.positions[bond.fromSlug]);
      const b = new THREE.Vector3(...layout.positions[bond.toSlug]);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      dummy.position.copy(mid);
      dummy.scale.set(1, dir.length(), 1);
      dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      dummy.updateMatrix();
      bonds.setMatrixAt(i, dummy.matrix);
    });
    dummy.scale.set(1, 1, 1);
    dummy.quaternion.identity();
    scene.add(bonds);
    stage.dataset.bondCount = String(board.bonds.length);

    /* Bond colours are per-instance and read the atlas tokens from
     * the stage's computed style — the CSS is the single source of
     * truth, so the board theme switch (data-board-theme on the
     * root, re-declaring the tokens) and the system scheme both
     * reach the scene through the same vars the stage ground
     * consumes. The hex fallbacks are the light tokens, used only
     * if a var ever comes back empty. */
    const paintBonds = () => {
      const cs = window.getComputedStyle(stage);
      const brass = cs.getPropertyValue("--atlas-brass").trim() || "#a5761f";
      const stamp = cs.getPropertyValue("--atlas-stamp").trim() || "#b3372a";
      board.bonds.forEach((bond, i) => {
        const target = findStory(board, bond.toSlug);
        const waiting = target !== null && target.story.status !== "done";
        bonds.setColorAt(i, color.set(waiting ? stamp : brass));
      });
      if (bonds.instanceColor) bonds.instanceColor.needsUpdate = true;
    };
    paintBonds();
    bondsRef.current = paintBonds;

    /* The halo's scheme-carrying colour reads the same tokens.
     * Everything else in the scene is scheme-invariant by design:
     * status colours (mirrored by the legend's constant swatches),
     * the parchment label chips, the lights. */
    const applySchemeColors = () => {
      const cs = window.getComputedStyle(stage);
      const brass = cs.getPropertyValue("--atlas-brass").trim();
      if (brass) haloMat.color.set(brass);
      paintBonds();
    };
    applySchemeColors();

    /* camera + the §3 gesture map (custom orbit, clamped).
     * Cleanup: the opening distance is FITTED to the layout's own
     * bounds and the stage's aspect, so the whole molecule starts
     * in frame at phone width too (the shipped fixed 62 left
     * clusters off-canvas and bonds running out of the picture). */
    const boundsR =
      Math.max(
        ...flat.map((fs) => {
          const p = layout.positions[fs.slug];
          return Math.hypot(p[0], p[1], p[2]);
        }),
        10,
      ) + 3.0;
    const fitRadius = () => {
      const w = stage.clientWidth || width;
      const h = stageHeight(w);
      const vHalf = THREE.MathUtils.degToRad(55) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * (w / h));
      // The layout is a shallow disc, not a sphere: its farthest atom
      // must land inside the frame at the target plane (tan form).
      return THREE.MathUtils.clamp(boundsR / Math.tan(Math.min(vHalf, hHalf)), 30, 118);
    };
    let theta = 0.6;
    let phi = 1.15;
    let radius = fitRadius();
    let goalTheta = theta;
    let goalPhi = phi;
    let goalRadius = radius;
    const homeTarget = new THREE.Vector3(0, 0, 0);
    let target = homeTarget.clone();
    let goalTarget = homeTarget.clone();
    let interacted = false;

    const applyCamera = () => {
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
      setTier(
        radius > 70
          ? "All of Meridian"
          : (() => {
              const sel = selectedRef.current ? findStory(board, selectedRef.current) : null;
              return sel ? sel.featureName : "All of Meridian";
            })(),
      );
    };

    apiRef.current = {
      reset: () => {
        goalTheta = 0.6;
        goalPhi = 1.15;
        goalRadius = fitRadius();
        goalTarget.copy(homeTarget);
        if (reduced) {
          theta = goalTheta;
          phi = goalPhi;
          radius = goalRadius;
          target.copy(goalTarget);
        }
      },
      zoomBy: (f: number) => {
        goalRadius = THREE.MathUtils.clamp(goalRadius * f, 18, 118);
        if (reduced) radius = goalRadius;
      },
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let lastPinch = 0;
    let downAt = { x: 0, y: 0 };
    let dragged = 0;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      interacted = true;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downAt = { x: e.clientX, y: e.clientY };
      dragged = 0;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (lastPinch > 0) {
          goalRadius = THREE.MathUtils.clamp(goalRadius * (lastPinch / d), 18, 118);
          if (reduced) radius = goalRadius;
        }
        lastPinch = d;
        dragged = 99;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragged += Math.abs(dx) + Math.abs(dy);
      goalTheta -= dx * 0.005;
      goalPhi = THREE.MathUtils.clamp(goalPhi - dy * 0.005, 0.25, 2.2);
      if (reduced) {
        theta = goalTheta;
        phi = goalPhi;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinch = 0;
      if (dragged < 6 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
        const rect = el.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, camera);
        const hit = ray.intersectObject(atoms)[0];
        if (hit && hit.instanceId !== undefined) {
          selectRef.current(flatRef.current[hit.instanceId].slug);
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      interacted = true;
      goalRadius = THREE.MathUtils.clamp(goalRadius * (e.deltaY > 0 ? 1.12 : 0.9), 18, 118);
      if (reduced) radius = goalRadius;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    let frames = 0;
    let lastSel: string | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!interacted && !reduced && !selectedRef.current) goalTheta += 0.0007;
      const k = reduced ? 1 : 0.12;
      theta += (goalTheta - theta) * k;
      phi += (goalPhi - phi) * k;
      radius += (goalRadius - radius) * k;
      target.lerp(goalTarget, k);
      const sel = selectedRef.current;
      if (sel !== lastSel) {
        lastSel = sel;
        if (sel && layout.positions[sel]) {
          const p = layout.positions[sel];
          goalTarget.set(p[0], p[1], p[2]);
          goalRadius = 30;
          if (reduced) radius = goalRadius;
        }
      }
      if (sel && layout.positions[sel]) {
        const p = layout.positions[sel];
        halo.visible = true;
        halo.position.set(p[0], p[1], p[2]);
      } else {
        halo.visible = false;
      }
      applyCamera();
      renderer.render(scene, camera);
      frames += 1;
      if (frames === 45) {
        stage.dataset.drawCalls = String(renderer.info.render.calls);
        stage.dataset.triangles = String(renderer.info.render.triangles);
        /* E2E probe (same family as the counters above): the frontier
         * atom's projected position as canvas fractions, so the spec
         * can click a real atom through the real raycast path. */
        const frontier = board.epics
          .flatMap((e) => e.features.flatMap((f) => f.stories))
          .find((s) => s.status === "in-progress");
        if (frontier && layout.positions[frontier.slug]) {
          const v = new THREE.Vector3(...layout.positions[frontier.slug]).project(camera);
          stage.dataset.probeX = String(v.x * 0.5 + 0.5);
          stage.dataset.probeY = String(-v.y * 0.5 + 0.5);
          stage.dataset.probeSlug = frontier.slug;
        }
      }
    };
    tick();

    const onResize = () => {
      const w = stage.clientWidth || width;
      const h = stageHeight(w);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.remove();
      bondsRef.current = null;
      haloMatRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, layout]);

  /* Follow the board theme live: when the effective scheme
   * changes — the visitor flips the switch, or the system scheme
   * flips under the System choice — re-read the atlas tokens from
   * the stage's computed style and recolour bonds + halo. The
   * stage ground is CSS and follows on its own. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !haloMatRef.current) return;
    const cs = window.getComputedStyle(stage);
    const brass = cs.getPropertyValue("--atlas-brass").trim();
    if (brass) haloMatRef.current.color.set(brass);
    bondsRef.current?.();
  }, [scheme]);

  const selected = selectedSlug ? findStory(board, selectedSlug) : null;
  const here = selected
    ? `${selected.epicName} › ${selected.featureName} › ${selected.story.title}`
    : "All of Meridian";

  const onKeyDown = (e: React.KeyboardEvent) => {
    const order = flat.map((f) => f.slug);
    const idx = selectedSlug ? order.indexOf(selectedSlug) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next =
        e.key === "ArrowDown"
          ? order[Math.min(order.length - 1, idx + 1)]
          : order[Math.max(0, idx - 1)];
      if (next) onSelect(next);
    } else if (e.key === "+" || e.key === "=") apiRef.current?.zoomBy(0.85);
    else if (e.key === "-") apiRef.current?.zoomBy(1.18);
    else if (e.key === "Enter" && selectedSlug) onOpenInTrail(selectedSlug);
    else if (e.key === "Escape") apiRef.current?.reset();
  };

  return (
    <div className="v3-map">
      <p className="v3-you-are-here" data-testid="v3-you-are-here">
        You are here: <strong>{here}</strong>
      </p>
      <div className="v3-map-grid">
        <div
          className="v3-map-stage"
          ref={stageRef}
          data-testid="v3-map-stage"
          tabIndex={0}
          role="application"
          aria-label="Molecular map. Use the story list beside the map, or arrow keys here, to explore."
          onKeyDown={onKeyDown}
        >
          <span className="v3-zoom-tier">{tier}</span>
          <button type="button" className="v3-btn v3-reset" onClick={() => apiRef.current?.reset()}>
            Reset view
          </button>
          {webglFailed ? (
            <p className="v3-webgl-fallback" data-testid="v3-webgl-fallback">
              3D needs WebGL — showing list view.
            </p>
          ) : null}
        </div>
        <aside className="v3-map-side">
          {selected ? (
            <StoryCardPanel
              board={board}
              slug={selectedSlug!}
              onSelect={(s) => onSelect(s)}
              onClose={() => onSelect(null)}
            />
          ) : (
            <div className="v3-map-legend">
              <h3>How to read the structure</h3>
              <p>
                <span className="v3-sw" style={{ background: "#c39a3a" }} /> Done ·{" "}
                <span className="v3-sw" style={{ background: "#33503f" }} /> Working on it now ·{" "}
                <span className="v3-sw" style={{ background: "#bdb198" }} /> Not started yet
              </p>
              <p>
                Stories in the same bubble belong to the same feature.{" "}
                <span className="v3-bond-sample" aria-hidden="true" /> A bond means one story truly
                has to wait for another — only {board.bonds.length} bonds exist. While a story is
                still waiting, its bond turns red; the rest stay brass.
              </p>
              <p>Drag to spin · scroll or pinch to zoom · tap an atom to open its story.</p>
              <button type="button" className="v3-btn" onClick={() => selectedSlug && onOpenInTrail(selectedSlug)} disabled={!selectedSlug}>
                Open on the trail
              </button>
            </div>
          )}
        </aside>
      </div>
      <div className="v3-mirror">
        <h3 className="v3-mirror-title">Every story, as a list</h3>
        {board.epics.map((epic) => (
          <div key={epic.id} className="v3-mirror-epic">
            <h4>{epic.name}</h4>
            {epic.features.map((feature) => (
              <div key={feature.id} className="v3-mirror-feature">
                <h5>
                  {feature.name} — {feature.done} of {feature.total} stories done
                </h5>
                <ul>
                  {feature.stories.map((story) => (
                    <li key={story.slug}>
                      <button
                        type="button"
                        className={`v3-mirror-btn${selectedSlug === story.slug ? " v3-selected" : ""}`}
                        data-testid="v3-mirror-story"
                        data-slug={story.slug}
                        onClick={() => onSelect(story.slug)}
                      >
                        <span className="v3-s-title">{story.title}</span>
                        <StatusPill status={story.status} />
                        <span className="v3-s-line">{story.line}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
