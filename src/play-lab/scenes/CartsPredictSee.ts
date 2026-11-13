import type { MotionTier, PredictSeeScene } from "@/scenes/predict-see/types.ts";

export const cartsPredictSeeScene: PredictSeeScene = {
  id: "physics:arrive:equal-steps",
  prompt:
    "Two carts leave for the same line. Cart A moves 3 tiles each step. Cart B moves 1 tile each step. Which cart reaches the line first?",
  choices: ["Cart A (3 tiles each step)", "Cart B (1 tile each step)"],
  rule: {
    cause: "Cart A moves 3 tiles each step while Cart B moves 1 tile each step",
    effect: "Cart A reaches the line 3 times faster because each step covers more distance",
    source: "3-PS2-2",
  },
  mount: async (el: HTMLElement, tier: MotionTier) => {
    if (tier === "flat") {
      el.innerHTML = `
        <div style="padding: 16px; background: rgba(16, 34, 42, 0.8); border: 1px solid rgba(232, 182, 76, 0.3); border-radius: 8px; color: #f0e7d2; font-family: Karla, sans-serif;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold;">
            <span style="color: #e8b64c;">Cart A: 3 tiles / step ➔ 🏁 Finish Line</span>
            <span>Arrives in 3 steps</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #9db3ad;">
            <span style="color: #5db7e8;">Cart B: 1 tile / step ➔ Still at tile 3</span>
            <span>Needs 9 steps</span>
          </div>
        </div>
      `;
      return {
        play: async () => {},
        dispose: () => {
          el.innerHTML = "";
        },
      };
    }

    if (tier === "lite") {
      el.innerHTML = `
        <div style="padding: 16px; background: rgba(16, 34, 42, 0.8); border: 1px solid rgba(232, 182, 76, 0.3); border-radius: 8px; color: #f0e7d2; font-family: Karla, sans-serif;">
          <div style="position: relative; height: 80px; background: #0c181f; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
            <div id="lite-cart-a" style="position: absolute; top: 12px; left: 10px; width: 44px; height: 24px; background: #e8b64c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; color: #10222a; transition: left 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);">
              Cart A
            </div>
            <div id="lite-cart-b" style="position: absolute; top: 44px; left: 10px; width: 44px; height: 24px; background: #5db7e8; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; color: #10222a; transition: left 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);">
              Cart B
            </div>
            <div style="position: absolute; right: 15px; top: 0; bottom: 0; width: 4px; background: repeating-linear-gradient(to bottom, #e8b64c, #e8b64c 8px, #10222a 8px, #10222a 16px);"></div>
          </div>
        </div>
      `;
      return {
        play: async () => {
          const a = el.querySelector("#lite-cart-a") as HTMLElement | null;
          const b = el.querySelector("#lite-cart-b") as HTMLElement | null;
          if (a) a.style.left = "calc(100% - 65px)";
          if (b) b.style.left = "calc(33% - 15px)";
        },
        dispose: () => {
          el.innerHTML = "";
        },
      };
    }

    // Full 3D Three.js simulation with spinning wheels and particle celebration
    const THREE = await import("three");

    let disposed = false;
    let animFrameId: number | null = null;
    let playAnimId: number | null = null;

    const width = el.clientWidth || 400;
    const height = 180;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c181f);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 22, 42);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      el.appendChild(renderer.domElement);
    } catch {
      return { play: async () => {}, dispose: () => {} };
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfff1da, 0.9);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffe9c4, 1.4);
    dirLight.position.set(10, 25, 20);
    scene.add(dirLight);

    // Track surface
    const trackWidth = 70;
    const trackGeo = new THREE.PlaneGeometry(trackWidth, 22);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x142b35,
      roughness: 0.8,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = -0.5;
    scene.add(trackMesh);

    // Track rails (brass lines)
    const railMat = new THREE.MeshBasicMaterial({ color: 0xe8b64c });
    [-6, 6].forEach((z) => {
      const railGeo = new THREE.BoxGeometry(trackWidth, 0.4, 0.6);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.position.set(0, 0.2, z);
      scene.add(railMesh);
    });

    // Finish line structure with glowing banner
    const finishLineX = trackWidth / 2 - 5;
    const finishGeo = new THREE.BoxGeometry(0.8, 0.2, 22);
    const finishMat = new THREE.MeshStandardMaterial({
      color: 0xe8b64c,
      emissive: 0xe8b64c,
      emissiveIntensity: 0.5,
    });
    const finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set(finishLineX, 0.1, 0);
    scene.add(finishMesh);

    const finishPostGeo = new THREE.CylinderGeometry(0.5, 0.5, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe8b64c, metalness: 0.6 });
    [-10, 10].forEach((z) => {
      const post = new THREE.Mesh(finishPostGeo, postMat);
      post.position.set(finishLineX, 5, z);
      scene.add(post);
    });

    const bannerGeo = new THREE.BoxGeometry(0.6, 2, 21);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xe8b64c,
      emissive: 0xb8932f,
      emissiveIntensity: 0.4,
    });
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(finishLineX, 9, 0);
    scene.add(bannerMesh);

    // Helper to create cart with rotating wheels
    const wheelGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.6, 16);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x243b44, metalness: 0.8 });

    function createCart(bodyColor: number) {
      const group = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(6, 3, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.6;
      group.add(body);

      const wheels: THREE.Mesh[] = [];
      const wheelOffsets = [
        [-2.0, 0.6, -2.2],
        [2.0, 0.6, -2.2],
        [-2.0, 0.6, 2.2],
        [2.0, 0.6, 2.2],
      ];

      wheelOffsets.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
        wheels.push(wheel);
      });

      return { group, body, wheels, bodyGeo, bodyMat };
    }

    const startX = -trackWidth / 2 + 6;

    // Cart A (Lane 1, z = -6) - 3 tiles/step (Gold)
    const cartAData = createCart(0xe8b64c);
    const cartA = cartAData.group;
    cartA.position.set(startX, 0.8, -6);
    scene.add(cartA);

    // Cart B (Lane 2, z = 6) - 1 tile/step (Blue)
    const cartBData = createCart(0x5db7e8);
    const cartB = cartBData.group;
    cartB.position.set(startX, 0.8, 6);
    scene.add(cartB);

    // Celebration burst particles at finish line
    const particleCount = 45;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = finishLineX;
      particlePositions[i * 3 + 1] = 6;
      particlePositions[i * 3 + 2] = -6;
      particleVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 8 + 3,
          (Math.random() - 0.5) * 8,
        ),
      );
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffe9c4,
      size: 1.6,
      transparent: true,
      opacity: 0,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    let celebrating = false;

    function animate() {
      if (disposed || !renderer) return;
      animFrameId = requestAnimationFrame(animate);

      if (celebrating) {
        particleMat.opacity = Math.max(0, particleMat.opacity - 0.015);
        const positions = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += particleVelocities[i].x * 0.03;
          positions[i * 3 + 1] += particleVelocities[i].y * 0.03;
          positions[i * 3 + 2] += particleVelocities[i].z * 0.03;
          particleVelocities[i].y -= 0.12; // gravity
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    }
    animate();

    return {
      play: async () => {
        const targetA = finishLineX - 4;
        const targetB = startX + (targetA - startX) / 3;

        const duration = 1600;
        const startTime = performance.now();
        let lastAx = startX;
        let lastBx = startX;

        await new Promise<void>((resolve) => {
          function step(now: number) {
            if (disposed) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease soft-land curve
            const ease = 1 - Math.pow(1 - progress, 3);

            const newAx = startX + (targetA - startX) * ease;
            const newBx = startX + (targetB - startX) * ease;

            // Spin wheels proportionally to movement distance
            const deltaA = newAx - lastAx;
            const deltaB = newBx - lastBx;
            cartAData.wheels.forEach((w) => (w.rotation.x -= deltaA / 1.2));
            cartBData.wheels.forEach((w) => (w.rotation.x -= deltaB / 1.2));

            cartA.position.x = newAx;
            cartB.position.x = newBx;

            lastAx = newAx;
            lastBx = newBx;

            if (progress < 1) {
              playAnimId = requestAnimationFrame(step);
            } else {
              // Trigger finish celebration starburst
              celebrating = true;
              particleMat.opacity = 1.0;
              resolve();
            }
          }
          playAnimId = requestAnimationFrame(step);
        });
      },
      dispose: () => {
        disposed = true;
        if (animFrameId !== null) cancelAnimationFrame(animFrameId);
        if (playAnimId !== null) cancelAnimationFrame(playAnimId);

        if (renderer) {
          if (renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
          }
          renderer.dispose();
          renderer.forceContextLoss();
        }

        trackGeo.dispose();
        trackMat.dispose();
        railMat.dispose();
        finishGeo.dispose();
        finishMat.dispose();
        finishPostGeo.dispose();
        postMat.dispose();
        bannerGeo.dispose();
        bannerMat.dispose();

        cartAData.bodyGeo.dispose();
        cartAData.bodyMat.dispose();
        cartBData.bodyGeo.dispose();
        cartBData.bodyMat.dispose();
        wheelGeo.dispose();
        wheelMat.dispose();

        particleGeo.dispose();
        particleMat.dispose();
      },
    };
  },
};
