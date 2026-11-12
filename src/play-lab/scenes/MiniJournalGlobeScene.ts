import type { JournalClip } from "../types.ts";

export interface MiniGlobeHandle {
  dispose: () => void;
}

export async function mountMiniJournalGlobe(
  container: HTMLElement,
  clips: JournalClip[],
  onClipSelect: (clip: JournalClip) => void,
): Promise<MiniGlobeHandle> {
  const THREE = await import("three");

  let disposed = false;
  let animFrameId: number | null = null;

  const width = container.clientWidth || 320;
  const height = container.clientHeight || 320;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 8, 115);

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
  } catch {
    return { dispose: () => {} };
  }

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Globe body: dark ocean sphere with subtle wireframe and glow
  const sphereGeo = new THREE.SphereGeometry(35, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x10222a,
    transparent: true,
    opacity: 0.92,
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(sphereMesh);

  // Latitude / longitude grid wireframe
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xe8b64c,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });
  const wireMesh = new THREE.Mesh(sphereGeo, wireMat);
  globeGroup.add(wireMesh);

  // Equator orbital brass ring
  const ringGeo = new THREE.RingGeometry(35.2, 35.8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xe8b64c,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.3,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  globeGroup.add(ringMesh);

  // Atmospheric glow rim
  const atmoGeo = new THREE.RingGeometry(36.0, 38.5, 64);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x5db7e8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.18,
  });
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  globeGroup.add(atmoMesh);

  // Pins for journals
  const pinMeshes: THREE.Mesh[] = [];
  const radius = 35.8;

  clips.forEach((clip) => {
    const lat = clip.place.lat;
    const lon = clip.place.lon;

    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    const pinGeo = new THREE.SphereGeometry(1.9, 12, 12);
    const isSpecial = clip.id === "great-leaders:lincoln-memorial";
    const pinMat = new THREE.MeshBasicMaterial({
      color: isSpecial ? 0xffffff : 0xe8b64c,
    });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.set(x, y, z);
    pinMesh.userData = { clip, isSpecial, basePos: new THREE.Vector3(x, y, z) };

    globeGroup.add(pinMesh);
    pinMeshes.push(pinMesh);
  });

  // Inertial drag-to-spin and tap raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let isDragging = false;
  let dragDistance = 0;
  let previousPointer = { x: 0, y: 0 };
  let spinVelocity = { x: 0, y: 0.003 };

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

    globeGroup.rotation.y += deltaX * 0.006;
    globeGroup.rotation.x += deltaY * 0.006;

    spinVelocity = {
      x: deltaY * 0.001,
      y: deltaX * 0.001,
    };

    previousPointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!renderer) return;
    isDragging = false;

    // Only select pin on true tap (threshold <= 5px)
    if (dragDistance <= 5) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(pinMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const clickedClip = hit.userData.clip as JournalClip;
        if (clickedClip) {
          onClipSelect(clickedClip);
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
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 320;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", handleResize);

  let clock = 0;
  function animate() {
    if (disposed || !renderer) return;
    animFrameId = requestAnimationFrame(animate);
    clock += 0.02;

    if (!isDragging) {
      globeGroup.rotation.y += spinVelocity.y;
      globeGroup.rotation.x += spinVelocity.x;

      // Inertia damping towards nominal slow spin
      spinVelocity.y = spinVelocity.y * 0.95 + 0.0028 * 0.05;
      spinVelocity.x = spinVelocity.x * 0.95;
    }

    // Keep atmosphere facing camera
    atmoMesh.quaternion.copy(camera.quaternion);

    // Pulse playable/highlighted pins
    pinMeshes.forEach((mesh, idx) => {
      if (mesh.userData.isSpecial) {
        const pulse = 1.2 + 0.25 * Math.sin(clock * 3.5);
        mesh.scale.set(pulse, pulse, pulse);
      } else {
        const pulse = 1.0 + 0.08 * Math.sin(clock * 2 + idx);
        mesh.scale.set(pulse, pulse, pulse);
      }
    });

    renderer.render(scene, camera);
  }

  animate();

  return {
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

      sphereGeo.dispose();
      sphereMat.dispose();
      wireMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();

      pinMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    },
  };
}
