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
  camera.position.set(0, 10, 110);

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
    opacity: 0.9,
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(sphereMesh);

  // Latitude / longitude grid wireframe
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xe8b64c,
    wireframe: true,
    transparent: true,
    opacity: 0.14,
  });
  const wireMesh = new THREE.Mesh(sphereGeo, wireMat);
  globeGroup.add(wireMesh);

  // Equator ring
  const ringGeo = new THREE.RingGeometry(35.2, 35.6, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xe8b64c,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.28,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  globeGroup.add(ringMesh);

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

    const pinGeo = new THREE.SphereGeometry(1.8, 12, 12);
    const isSpecial = clip.id === "great-leaders:lincoln-memorial";
    const pinMat = new THREE.MeshBasicMaterial({
      color: isSpecial ? 0xffffff : 0xe8b64c,
    });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.set(x, y, z);
    pinMesh.userData = { clip };

    globeGroup.add(pinMesh);
    pinMeshes.push(pinMesh);
  });

  // Raycaster for pin clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(event: MouseEvent | TouchEvent) {
    if (!renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
    const clientY = "touches" in event ? event.touches[0].clientY : event.clientY;

    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

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

  renderer.domElement.addEventListener("click", onPointerDown);

  function animate() {
    if (disposed || !renderer) return;
    animFrameId = requestAnimationFrame(animate);

    globeGroup.rotation.y += 0.0035;

    renderer.render(scene, camera);
  }

  animate();

  return {
    dispose: () => {
      disposed = true;
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);

      if (renderer) {
        renderer.domElement.removeEventListener("click", onPointerDown);
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

      pinMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    },
  };
}

