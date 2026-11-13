import type { AgeGroup, UnitItem } from "../types.ts";

export interface ConstellationHandle {
  updateAgeGroup: (ageGroup: AgeGroup) => void;
  selectItem: (itemId: string | null) => void;
  dispose: () => void;
}

export async function mountSkillConstellation(
  container: HTMLElement,
  items: UnitItem[],
  initialAgeGroup: AgeGroup,
  onItemSelect: (item: UnitItem) => void,
): Promise<ConstellationHandle> {
  const THREE = await import("three");

  let disposed = false;
  let animFrameId: number | null = null;
  let activeAgeGroup = initialAgeGroup;
  let selectedItemId: string | null = null;

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 450;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070e12, 0.0035);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 0, 160);

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
  } catch {
    return {
      updateAgeGroup: () => { },
      selectItem: () => { },
      dispose: () => { },
    };
  }

  // Deep ambient starfield
  const starCount = 350;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 420;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 420;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 300 - 40;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x9db3ad,
    size: 1.2,
    transparent: true,
    opacity: 0.5,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);

  // Node layout: arrange items in an aesthetically spaced 3D celestial cluster
  const nodesGroup = new THREE.Group();
  scene.add(nodesGroup);

  const nodeMeshes: THREE.Mesh[] = [];
  const nodeMap = new Map<string, { mesh: THREE.Mesh; item: UnitItem; pos: THREE.Vector3 }>();

  // Deterministic positions based on item index and buildsOn hierarchy
  const count = items.length;
  items.forEach((item, index) => {
    // Spherical spiral arrangement with organic depth
    const phi = Math.acos(-1 + (2 * index) / Math.max(1, count - 1));
    const theta = Math.sqrt(count * Math.PI) * phi;
    const radius = 60 + (index % 3) * 12;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi) * 0.5;

    const pos = new THREE.Vector3(x, y, z);

    const isMatch = item.group === activeAgeGroup || activeAgeGroup === "18+";
    const geometry = new THREE.SphereGeometry(isMatch ? 3.2 : 2.2, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: isMatch ? 0xe8b64c : 0x4a6b74,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    mesh.userData = { itemId: item.id, item };

    nodesGroup.add(mesh);
    nodeMeshes.push(mesh);
    nodeMap.set(item.id, { mesh, item, pos });
  });

  // Connection lines based on buildsOn
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xe8b64c,
    transparent: true,
    opacity: 0.35,
  });

  const linePositions: number[] = [];
  items.forEach((item) => {
    const from = nodeMap.get(item.id);
    if (!from) return;

    item.buildsOn.forEach((depId) => {
      const to = nodeMap.get(depId);
      if (to) {
        linePositions.push(
          from.pos.x,
          from.pos.y,
          from.pos.z,
          to.pos.x,
          to.pos.y,
          to.pos.z,
        );
      }
    });
  });

  let lineSegments: THREE.LineSegments | null = null;
  if (linePositions.length > 0) {
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3),
    );
    lineSegments = new THREE.LineSegments(lineGeo, lineMaterial);
    nodesGroup.add(lineSegments);
  }

  // Interactive rotation with smooth inertia & drag threshold
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let isDragging = false;
  let previousPointer = { x: 0, y: 0 };
  let dragDistance = 0;
  let rotationVelocity = { x: 0.0006, y: 0.0015 };

  function onPointerDown(event: PointerEvent) {
    if (!renderer) return;
    isDragging = true;
    dragDistance = 0;
    previousPointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging) return;
    const deltaX = event.clientX - previousPointer.x;
    const deltaY = event.clientY - previousPointer.y;
    dragDistance += Math.hypot(deltaX, deltaY);

    nodesGroup.rotation.y += deltaX * 0.004;
    nodesGroup.rotation.x += deltaY * 0.004;

    rotationVelocity = {
      x: deltaY * 0.0008,
      y: deltaX * 0.0008,
    };

    previousPointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!renderer) return;
    isDragging = false;

    // Only select on tap/click if drag threshold <= 5px
    if (dragDistance <= 5) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const clickedItem = hit.userData.item as UnitItem;
        if (clickedItem) {
          onItemSelect(clickedItem);
        }
      }
    }
  }

  renderer.domElement.style.touchAction = "none";
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // Resize handler
  function handleResize() {
    if (!renderer || disposed) return;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 450;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", handleResize);

  // Animation loop with celestial drift and harmonic pulses
  let clock = 0;
  function animate() {
    if (disposed || !renderer) return;
    animFrameId = requestAnimationFrame(animate);
    clock += 0.02;

    if (!isDragging) {
      nodesGroup.rotation.y += rotationVelocity.y;
      nodesGroup.rotation.x += rotationVelocity.x;
      // Damping towards nominal drift
      rotationVelocity.y = rotationVelocity.y * 0.95 + 0.0015 * 0.05;
      rotationVelocity.x = rotationVelocity.x * 0.95 + 0.0006 * 0.05;
    }

    // Slow ambient starfield drift
    starPoints.rotation.y -= 0.00025;

    // Harmonic pulse on active age-band stars
    nodeMeshes.forEach((mesh, idx) => {
      const item = mesh.userData.item as UnitItem;
      const isMatch = item.group === activeAgeGroup || activeAgeGroup === "18+";
      const isSelected = item.id === selectedItemId;

      if (isSelected) {
        const scale = 1.5 + 0.12 * Math.sin(clock * 3.5);
        mesh.scale.set(scale, scale, scale);
      } else if (isMatch) {
        const pulse = 1.1 + 0.06 * Math.sin(clock * 2 + idx * 0.35);
        mesh.scale.set(pulse, pulse, pulse);
      }
    });

    renderer.render(scene, camera);
  }

  animate();

  function updateVisuals() {
    items.forEach((item) => {
      const entry = nodeMap.get(item.id);
      if (!entry) return;

      const isMatch = item.group === activeAgeGroup || activeAgeGroup === "18+";
      const isSelected = item.id === selectedItemId;

      const mat = entry.mesh.material as THREE.MeshBasicMaterial;
      if (isSelected) {
        mat.color.setHex(0xffffff);
        entry.mesh.scale.set(1.5, 1.5, 1.5);
      } else if (isMatch) {
        mat.color.setHex(0xe8b64c);
        entry.mesh.scale.set(1.1, 1.1, 1.1);
      } else {
        mat.color.setHex(0x3a535c);
        entry.mesh.scale.set(0.8, 0.8, 0.8);
      }
    });
  }

  return {
    updateAgeGroup: (newAgeGroup: AgeGroup) => {
      activeAgeGroup = newAgeGroup;
      updateVisuals();
    },
    selectItem: (itemId: string | null) => {
      selectedItemId = itemId;
      updateVisuals();
    },
    dispose: () => {
      disposed = true;
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (renderer) {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        if (renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        renderer.dispose();
        renderer.forceContextLoss();
      }

      starGeo.dispose();
      starMat.dispose();

      nodeMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });

      if (lineSegments) {
        lineSegments.geometry.dispose();
        (lineSegments.material as THREE.Material).dispose();
      }
    },
  };
}
