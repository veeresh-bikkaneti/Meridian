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
          <div style="margin-bottom: 12px; position: relative; height: 36px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
            <div id="cart-a-lite" style="position: absolute; left: 0; top: 4px; width: 48px; height: 28px; background: #e8b64c; color: #070e12; font-weight: bold; font-size: 11px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);">A</div>
            <div style="position: absolute; right: 8px; top: 6px; color: #e8b64c; font-size: 14px;">🏁</div>
          </div>
          <div style="position: relative; height: 36px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
            <div id="cart-b-lite" style="position: absolute; left: 0; top: 4px; width: 48px; height: 28px; background: #5db7e8; color: #070e12; font-weight: bold; font-size: 11px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);">B</div>
            <div style="position: absolute; right: 8px; top: 6px; color: #5db7e8; font-size: 14px;">🏁</div>
          </div>
        </div>
      `;
      return {
        play: async () => {
          const cartA = el.querySelector("#cart-a-lite") as HTMLElement | null;
          const cartB = el.querySelector("#cart-b-lite") as HTMLElement | null;
          if (cartA && cartB) {
            cartA.style.transform = "translateX(280px)";
            cartB.style.transform = "translateX(93px)";
          }
          await new Promise((r) => setTimeout(r, 1300));
        },
        dispose: () => {
          el.innerHTML = "";
        },
      };
    }

    // Full 3D WebGL tier with dynamic Three.js
    const THREE = await import("three");
    let disposed = false;
    let animFrameId: number | null = null;

    const width = el.clientWidth || 480;
    const height = 220;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    camera.position.set(0, 32, 64);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);
    } catch {
      return { play: async () => {}, dispose: () => {} };
    }

    // Ambient + directional light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe8b64c, 1.2);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // Track platform
    const trackWidth = 72;
    const trackGeo = new THREE.BoxGeometry(trackWidth, 1, 24);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x10222a });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
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

    // Finish line (checkered / bright brass post)
    const finishGeo = new THREE.BoxGeometry(0.8, 6, 24);
    const finishMat = new THREE.MeshBasicMaterial({ color: 0xe8b64c });
    const finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set(trackWidth / 2 - 4, 3, 0);
    scene.add(finishMesh);

    // Cart A (Lane 1, z = -6) - moves 3 tiles / step
    const cartAGeo = new THREE.BoxGeometry(6, 4, 4);
    const cartAMat = new THREE.MeshStandardMaterial({ color: 0xe8b64c, roughness: 0.3 });
    const cartA = new THREE.Mesh(cartAGeo, cartAMat);
    const startX = -trackWidth / 2 + 6;
    cartA.position.set(startX, 2.5, -6);
    scene.add(cartA);

    // Cart B (Lane 2, z = 6) - moves 1 tile / step
    const cartBGeo = new THREE.BoxGeometry(6, 4, 4);
    const cartBMat = new THREE.MeshStandardMaterial({ color: 0x5db7e8, roughness: 0.3 });
    const cartB = new THREE.Mesh(cartBGeo, cartBMat);
    cartB.position.set(startX, 2.5, 6);
    scene.add(cartB);

    function animate() {
      if (disposed || !renderer) return;
      animFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    return {
      play: async () => {
        const targetA = trackWidth / 2 - 8;
        const targetB = startX + (targetA - startX) / 3;

        const duration = 1600;
        const startTime = performance.now();

        await new Promise<void>((resolve) => {
          function step(now: number) {
            if (disposed) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease soft-land
            const ease = 1 - Math.pow(1 - progress, 3);

            cartA.position.x = startX + (targetA - startX) * ease;
            cartB.position.x = startX + (targetB - startX) * ease;

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              resolve();
            }
          }
          requestAnimationFrame(step);
        });
      },
      dispose: () => {
        disposed = true;
        if (animFrameId !== null) cancelAnimationFrame(animFrameId);
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
        cartAGeo.dispose();
        cartAMat.dispose();
        cartBGeo.dispose();
        cartBMat.dispose();
      },
    };
  },
};
