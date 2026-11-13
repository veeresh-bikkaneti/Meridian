import { useEffect, useRef } from "react";
import type { DonePathItem, LiveStory, SnapshotLane } from "./board-data";
import { buildDependencyEdges, storyMapLayouts } from "./board-data";
import { prefersReducedMotion, webglAvailable } from "./view-helpers";

/**
 * Feature map — the 8 lanes as rows in a three.js scene, with the
 * snapshot's explicit PR waits drawn as directed dependency lines.
 *
 * Follows the home globe's pattern (src/components/home-globe.tsx):
 * three is dynamically imported inside the effect, never statically, so
 * the game's bundle does not grow; under reduced motion the scene is a
 * single static frame (no controls, no transitions); any WebGL / import
 * failure calls onUnavailable and the parent shows the list view. The
 * canvas is decorative for assistive tech — the parent renders it
 * aria-hidden and screen readers get the list; the selection summary
 * under the canvas is plain DOM text.
 *
 * Interaction (owner, 2026-11-13): drag to orbit, pan, wheel or pinch to
 * zoom (OrbitControls, damped). Dragging a story block moves it (its
 * lines follow); a plain click on a block highlights its dependency
 * chain — the stories it waits on and the stories waiting on it — and
 * dims the rest. There is no auto-rotation or any other ambient camera
 * motion.
 */

function tokenColor(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function textSprite(
  THREE: typeof import("three"),
  text: string,
  color: string,
): InstanceType<typeof THREE.Sprite> {
  const measure = document.createElement("canvas").getContext("2d");
  if (measure) measure.font = "600 40px sans-serif";
  const textWidth = measure ? measure.measureText(text).width : text.length * 24;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(textWidth) + 16;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "600 40px sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    // Canvas fillText draws the string as pixels — it can never be
    // interpreted as markup.
    ctx.fillText(text, 8, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  // World height 0.82, width follows the measured text so long lane
  // names are never squeezed or cut.
  sprite.scale.set((canvas.width / canvas.height) * 0.82, 0.82, 1);
  // Anchor at the sprite's right edge: the caller positions the label by
  // where the text ENDS, so it can never spill past the scene's left
  // frame (review S7: lane labels clipped at the canvas edge).
  sprite.center.set(1, 0.5);
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
  const selectionRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: { dispose: () => void } | null = null;
    const listeners = new AbortController();

    const fail = () => {
      if (failedRef.current) return;
      failedRef.current = true;
      onUnavailable();
    };

    if (!webglAvailable()) {
      fail();
      return;
    }

    Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js")])
      .then(([THREE, { OrbitControls }]) => {
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
          const dom = renderer.domElement;

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 200);

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

          // Layout: lanes stay rows; inside a lane, stories are ordered
          // by dependency depth so chains read left to right.
          const edges = buildDependencyEdges(stories);
          const layouts = storyMapLayouts(stories, lanes);
          const laneZ = (laneIndex: number) => laneIndex * 1.7 - ((lanes.length - 1) * 1.7) / 2;
          const laneCounts = lanes.map((l) => stories.filter((s) => s.lane === l.name).length);
          const maxStories = Math.max(...laneCounts, 1);
          const boardHalf = ((maxStories - 1) * 1.24) / 2 + 0.46;

          const world = new THREE.Group();
          scene.add(world);

          // Lane labels first: their measured width decides how far the
          // whole scene shifts right, so every label sits inside frame.
          let labelWidth = 0;
          lanes.forEach((lane, laneIndex) => {
            const label = textSprite(THREE, lane.name, ink);
            labelWidth = Math.max(labelWidth, label.scale.x);
            label.position.set(-boardHalf - 0.35, 0.4, laneZ(laneIndex));
            world.add(label);
          });
          world.position.x = labelWidth / 2;
          const sceneHalfWidth = boardHalf + labelWidth / 2;
          camera.position.set(0, 10.5, Math.max(15, sceneHalfWidth * 1.55));
          camera.lookAt(0, 0, 0);

          // Story blocks.
          const nodePos: InstanceType<typeof THREE.Vector3>[] = [];
          const nodeMeshes: InstanceType<typeof THREE.Mesh>[] = [];
          stories.forEach((story, i) => {
            const laneIndex = lanes.findIndex((l) => l.name === story.lane);
            const count = laneCounts[laneIndex] ?? 1;
            const h = statusHeight[story.status];
            const geo = new THREE.BoxGeometry(0.92, h, 0.92);
            const color = new THREE.Color(statusColor[story.status]);
            const mat = new THREE.MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.18,
              transparent: true,
            });
            const box = new THREE.Mesh(geo, mat);
            const pos = new THREE.Vector3(
              (layouts[i].slot - (count - 1) / 2) * 1.24,
              h / 2,
              laneZ(laneIndex),
            );
            box.position.copy(pos);
            box.userData.storyIndex = i;
            world.add(box);
            nodePos.push(pos);
            nodeMeshes.push(box);
          });

          // Dependency lines: from the top of the prerequisite block,
          // up to a shared height, across, and down into the waiting
          // story, with a cone at the waiting end for direction.
          const edgeGroup = new THREE.Group();
          world.add(edgeGroup);
          const edgePath = (from: number, to: number) => {
            const a = nodePos[from].clone();
            const b = nodePos[to].clone();
            a.y = statusHeight[stories[from].status] + 0.05;
            b.y = statusHeight[stories[to].status] + 0.05;
            const top = Math.max(a.y, b.y) + 0.85;
            return [a, a.clone().setY(top), b.clone().setY(top), b];
          };
          const edgeLines: InstanceType<typeof THREE.Line>[] = [];
          const edgeCones: InstanceType<typeof THREE.Mesh>[] = [];
          edges.forEach((edge) => {
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(edgePath(edge.from, edge.to)),
              new THREE.LineBasicMaterial({
                color: new THREE.Color(brass),
                transparent: true,
                opacity: 0.5,
              }),
            );
            edgeGroup.add(line);
            edgeLines.push(line);
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(0.11, 0.3, 10),
              new THREE.MeshBasicMaterial({
                color: new THREE.Color(brass),
                transparent: true,
                opacity: 0.85,
              }),
            );
            edgeGroup.add(cone);
            edgeCones.push(cone);
          });
          const placeCone = (edgeIndex: number) => {
            const edge = edges[edgeIndex];
            const cone = edgeCones[edgeIndex];
            const path = edgePath(edge.from, edge.to);
            const tip = path[path.length - 1];
            const before = path[path.length - 2];
            const dir = tip.clone().sub(before).normalize();
            cone.position.copy(tip.clone().add(dir.clone().multiplyScalar(0.12)));
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          };
          const refreshEdge = (edgeIndex: number) => {
            const edge = edges[edgeIndex];
            edgeLines[edgeIndex].geometry.dispose();
            edgeLines[edgeIndex].geometry = new THREE.BufferGeometry().setFromPoints(
              edgePath(edge.from, edge.to),
            );
            placeCone(edgeIndex);
          };
          edges.forEach((_, i) => placeCone(i));
          dom.dataset.edgeCount = String(edges.length);

          // Projected screen position (fractions of the canvas) of each
          // block's back-top edge — where a click lands on that block.
          // Published on the canvas dataset so tests (and anyone
          // debugging the map) can aim at a named story without guessing
          // pixels; refreshed while the camera settles.
          const publishNodePoints = () => {
            const points = stories.map((story, i) => {
              const v = new THREE.Vector3(
                nodePos[i].x + world.position.x,
                statusHeight[story.status] + 0.02,
                nodePos[i].z - 0.3,
              ).project(camera);
              return { t: story.title, x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
            });
            dom.dataset.nodePoints = JSON.stringify(points);
          };

          // "Definition of all done" path: a line through the gates, in
          // order, sweeping across the lanes as the gates progress.
          const gates = donePath.filter((g) => g.type === "gate");
          if (gates.length > 1) {
            const points = gates.map((_, i) => {
              const t = i / (gates.length - 1);
              return new THREE.Vector3(
                t * (maxStories - 1) * 1.24 - ((maxStories - 1) * 1.24) / 2,
                2.6,
                laneZ(Math.round(t * (lanes.length - 1))),
              );
            });
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(points),
              new THREE.LineBasicMaterial({
                color: new THREE.Color(brass),
                transparent: true,
                opacity: 0.35,
              }),
            );
            world.add(line);
            const dotGeo = new THREE.SphereGeometry(0.14, 12, 12);
            const dotMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(brass) });
            for (const p of points) {
              const dot = new THREE.Mesh(dotGeo, dotMat);
              dot.position.copy(p);
              world.add(dot);
            }
          }

          // --- Selection + chain highlight --------------------------------
          let selected: number | null = null;
          const targetOpacity = nodeMeshes.map(() => 1);
          const targetEdgeOpacity = edgeLines.map(() => 0.5);
          const describeSelection = (i: number) => {
            const story = stories[i];
            const waits = edges.filter((e) => e.to === i).map((e) => stories[e.from].title);
            const unlocks = edges.filter((e) => e.from === i).map((e) => stories[e.to].title);
            const parts = [`Selected case: ${story.title}.`];
            parts.push(
              waits.length > 0
                ? `Needs a clue from (explicit PR waits): ${waits.join("; ")}.`
                : "Needs a clue from no case in the snapshot — its “waits on” names no PR.",
            );
            if (unlocks.length > 0) parts.push(`Waited on by: ${unlocks.join("; ")}.`);
            return parts.join(" ");
          };
          const applySelection = (animate: boolean) => {
            const chain = new Set<number>();
            const chainEdges = new Set<number>();
            if (selected !== null) {
              chain.add(selected);
              let grew = true;
              while (grew) {
                grew = false;
                edges.forEach((e, ei) => {
                  if (chain.has(e.to) && !chain.has(e.from)) {
                    chain.add(e.from);
                    chainEdges.add(ei);
                    grew = true;
                  } else if (chain.has(e.from) && !chain.has(e.to)) {
                    chain.add(e.to);
                    chainEdges.add(ei);
                    grew = true;
                  }
                });
              }
            }
            nodeMeshes.forEach((mesh, i) => {
              const mat = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>;
              const inChain = selected === null || chain.has(i);
              targetOpacity[i] = selected === null ? 1 : inChain ? 1 : 0.13;
              mat.emissiveIntensity = selected === null ? 0.18 : i === selected ? 0.75 : inChain ? 0.4 : 0.05;
              if (!animate) mat.opacity = targetOpacity[i];
            });
            edgeLines.forEach((line, ei) => {
              const mat = line.material as InstanceType<typeof THREE.LineBasicMaterial>;
              targetEdgeOpacity[ei] = selected === null ? 0.5 : chainEdges.has(ei) ? 1 : 0.05;
              if (!animate) mat.opacity = targetEdgeOpacity[ei];
            });
            edgeCones.forEach((cone, ei) => {
              const mat = cone.material as InstanceType<typeof THREE.MeshBasicMaterial>;
              mat.opacity = selected === null ? 0.85 : chainEdges.has(ei) ? 1 : 0.05;
            });
            dom.dataset.selectedStory = selected === null ? "" : stories[selected].title;
            if (selectionRef.current) {
              selectionRef.current.textContent =
                selected === null
                  ? "Drag to look around. Click a case block to highlight what it waits on."
                  : describeSelection(selected);
            }
          };

          // --- Controls (none under reduced motion) -----------------------
          let orbit: InstanceType<typeof OrbitControls> | null = null;
          if (!reduced) {
            orbit = new OrbitControls(camera, dom);
            orbit.enableDamping = true;
            orbit.dampingFactor = 0.08;
            controls = orbit;
          }

          // --- Pointer: click selects, drag on a block moves it -----------
          const raycaster = new THREE.Raycaster();
          const pointer = new THREE.Vector2();
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          let downAt: { x: number; y: number; node: number | null } | null = null;
          let dragNode: number | null = null;
          const dragOffset = new THREE.Vector3();
          const setPointer = (event: PointerEvent) => {
            const rect = dom.getBoundingClientRect();
            pointer.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );
            raycaster.setFromCamera(pointer, camera);
          };
          const pickNode = (event: PointerEvent): number | null => {
            setPointer(event);
            const hits = raycaster.intersectObjects(nodeMeshes, false);
            return hits.length > 0 ? (hits[0].object.userData.storyIndex as number) : null;
          };
          const planeHit = (node: number): InstanceType<typeof THREE.Vector3> | null => {
            groundPlane.constant = -nodePos[node].y;
            const hit = new THREE.Vector3();
            if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
            hit.x -= world.position.x;
            return hit;
          };
          dom.addEventListener(
            "pointerdown",
            (event) => {
              downAt = { x: event.clientX, y: event.clientY, node: pickNode(event) };
            },
            { signal: listeners.signal },
          );
          dom.addEventListener(
            "pointermove",
            (event) => {
              if (!downAt || downAt.node === null || reduced) return;
              const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
              if (dragNode === null && moved > 6) {
                dragNode = downAt.node;
                if (orbit) orbit.enabled = false;
                setPointer(event);
                const hit = planeHit(dragNode);
                if (hit) dragOffset.copy(nodePos[dragNode]).sub(hit);
              }
              if (dragNode !== null) {
                setPointer(event);
                const hit = planeHit(dragNode);
                if (hit) {
                  const next = hit.add(dragOffset);
                  next.x = Math.max(-boardHalf - 1, Math.min(boardHalf + 1, next.x));
                  next.z = Math.max(laneZ(0) - 0.85, Math.min(laneZ(lanes.length - 1) + 0.85, next.z));
                  nodePos[dragNode].set(next.x, nodePos[dragNode].y, next.z);
                  nodeMeshes[dragNode].position.copy(nodePos[dragNode]);
                  edges.forEach((e, ei) => {
                    if (e.from === dragNode || e.to === dragNode) refreshEdge(ei);
                  });
                }
              }
            },
            { signal: listeners.signal },
          );
          dom.addEventListener(
            "pointerup",
            (event) => {
              const wasDrag = dragNode !== null;
              if (orbit && !orbit.enabled) orbit.enabled = true;
              dragNode = null;
              publishNodePoints();
              if (!wasDrag && downAt) {
                const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
                if (moved <= 6) {
                  selected = pickNode(event);
                  applySelection(!reduced);
                  if (reduced) renderer?.render(scene, camera);
                }
              }
              downAt = null;
            },
            { signal: listeners.signal },
          );

          if (reduced) {
            // Static scene: one frame, no controls, no transitions.
            applySelection(false);
            renderer.render(scene, camera);
            publishNodePoints();
            return;
          }
          let frame = 0;
          const animate = () => {
            if (disposed || !renderer) return;
            orbit?.update();
            frame += 1;
            if (frame % 20 === 1) publishNodePoints();
            // Subtle ease toward the highlight targets — the only
            // non-user motion in the scene.
            nodeMeshes.forEach((mesh, i) => {
              const mat = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>;
              const delta = targetOpacity[i] - mat.opacity;
              if (Math.abs(delta) > 0.01) mat.opacity += delta * 0.2;
            });
            edgeLines.forEach((line, ei) => {
              const mat = line.material as InstanceType<typeof THREE.LineBasicMaterial>;
              const delta = targetEdgeOpacity[ei] - mat.opacity;
              if (Math.abs(delta) > 0.01) mat.opacity += delta * 0.2;
            });
            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
          };
          applySelection(false);
          animate();
        } catch {
          fail();
        }
      })
      .catch(() => fail());

    return () => {
      disposed = true;
      listeners.abort();
      cancelAnimationFrame(raf);
      try {
        controls?.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      } catch {
        // best-effort cleanup
      }
    };
    // Rebuilt when the live overlay lands (stories identity changes
    // once, when the GitHub fetch settles) — not on every render.
  }, [lanes, stories, donePath, onUnavailable]);

  return (
    <div>
      <div ref={mountRef} className="board-map-mount" aria-hidden="true" />
      <p ref={selectionRef} className="board-muted" data-testid="map-selection">
        Drag to look around. Click a case block to highlight what it waits on.
      </p>
    </div>
  );
}
