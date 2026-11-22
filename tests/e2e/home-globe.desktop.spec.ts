import { test, expect, type Page } from "playwright/test";
import * as THREE from "three";
import { serveBuiltArtifact } from "./helpers";
import {
  GLOBE_CONTRACT as C,
  LANDMARKS,
} from "../../src/lib/home-globe/globe-contract.ts";

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

/**
 * Landmark globe presence gate (Stage 2 mount/paint cure, 2026-11-19).
 *
 * The Wave 1 panel blocked on prod captures that showed no globe: the
 * captures were shot while the opaque loading orb still covered the
 * mount (cold-load settle on a slow machine takes seconds; the orb only
 * lifts once the globe texture uploads). These tests pin the behaviour
 * the captures could not prove: on a fresh profile the live globe must
 * actually arrive — canvas mounted, orb gone, canvas painted — and when
 * the texture cannot load, the static disc fallback must land instead
 * of an endless spinner.
 */

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 320, height: 568 },
];

async function expectGlobePainted(page: Page) {
  const canvas = page.locator(".hv5-globe-mount canvas");
  await expect(canvas).toHaveCount(1, { timeout: 60_000 });
  // The loading orb is opaque and covers the mount until the texture
  // uploads; it unmounts after its fade. No orb + a painted canvas is
  // the settled state a capture must wait for.
  await expect(page.locator(".hv5-globe-orb")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(".hv5-globe-fallback")).toHaveCount(0);
  const shot = await canvas.screenshot();
  // Byte size alone cannot prove the texture painted (an untextured
  // black sphere with landmarks exceeds any size floor — Wave 1
  // re-vote, UX designer). Sample the disc interior's colours from
  // the composited screenshot instead: the parchment texture is
  // mid-luminance and many-coloured; a black or blank disc is not.
  const stats = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const x0 = Math.floor(c.width * 0.3);
    const x1 = Math.floor(c.width * 0.7);
    const y0 = Math.floor(c.height * 0.3);
    const y1 = Math.floor(c.height * 0.7);
    const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const w = x1 - x0;
    let sampled = 0;
    let painted = 0;
    let nearBlack = 0;
    const colours = new Set<string>();
    for (let y = 0; y < y1 - y0; y += 7) {
      for (let x = 0; x < w; x += 7) {
        const i = (y * w + x) * 4;
        sampled++;
        if (data[i + 3] < 128) continue;
        painted++;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum < 25) nearBlack++;
        colours.add(`${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`);
      }
    }
    return {
      paintedShare: painted / sampled,
      nearBlackShare: painted ? nearBlack / painted : 1,
      distinct: colours.size,
    };
  }, shot.toString("base64"));
  expect(stats.paintedShare).toBeGreaterThan(0.9);
  expect(stats.nearBlackShare).toBeLessThan(0.25);
  expect(stats.distinct).toBeGreaterThanOrEqual(8);
}

test.describe("landmark globe cold load", () => {
  test.setTimeout(300_000);

  for (const vp of VIEWPORTS) {
    test(`globe mounts and paints at ${vp.width}x${vp.height}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: vp });
      await serveBuiltArtifact(context);
      const page = await context.newPage();
      await page.goto(APP_URL);
      await expectGlobePainted(page);
      await context.close();
    });
  }

  test("texture failure lands on the static disc, never an endless spinner", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await serveBuiltArtifact(context);
    // Registered after serveBuiltArtifact, so this route wins dispatch.
    await context.route(/globe-texture[^/]*\.webp/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expect(page.locator(".hv5-globe-fallback")).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator(".hv5-globe-mount canvas")).toHaveCount(0);
    await expect(page.locator(".hv5-globe-orb")).toHaveCount(0);
    await context.close();
  });
});

/**
 * Tap -> dive, proven with REAL taps (landmark canon port, item a).
 *
 * The mock leg drove dives through a capture hook because its scripted
 * taps never fired: the hook's `behind` flag only caught points behind
 * the CAMERA, so a landmark on the globe's FAR side — whose projection
 * still lands inside the disc, mirrored — looked "in front", and taps
 * aimed there were correctly rejected by the shell's far-side guard;
 * the remaining true-front attempts chased stale coordinates against
 * the 0.12 rad/s slow turn. The production pointer -> NDC mapping was
 * never wrong (probe: synthetic taps at fresh true-front projections
 * dived 16/30 across a silhouette grid, including dead centre).
 *
 * These tests therefore pose the globe deterministically (reset key,
 * then fixed arrow steps — the controls step function is pure, so the
 * pose is exact), project with the shell's own math plus a TRUE front
 * test (a surface point is visible only when its world z clears the
 * tangent cone, z > R^2 / dist), and tap with the real mouse. Dive
 * state is read from the canvas aria-label, which names the landmark
 * while a dive holds (production a11y, not a test hook).
 */

const GLOBE_LABEL = "Globe. Drag or use arrow keys to spin.";
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/** The shell's start pose, then N ArrowRight steps premultiplied. */
function poseAfterArrowRights(n: number) {
  const qTilt = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(C.viewerPitch, 0, C.axialTiltDeg * DEG, "XYZ"),
  );
  const start = qTilt.multiply(
    new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2 - C.startLongitudeDeg * DEG),
  );
  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, C.keySpin * n);
  return yaw.multiply(start);
}

type Box = { x: number; y: number; width: number; height: number };

/** Project a landmark's base and silhouette top to client coordinates. */
function projectLandmark(
  q: THREE.Quaternion,
  lm: (typeof LANDMARKS)[number],
  box: Box,
) {
  const camera = new THREE.PerspectiveCamera(C.fov, box.width / box.height, 0.1, 100);
  camera.position.set(0, 0, C.zoom.start);
  camera.updateMatrixWorld();
  const dir = latLonToVec3(lm.drawnLat, lm.drawnLon, 1).normalize();
  const base = dir.clone().multiplyScalar(C.radius * 0.998).applyQuaternion(q);
  const top = base.clone().add(dir.clone().applyQuaternion(q).multiplyScalar(lm.scale));
  const toClient = (v: THREE.Vector3) => {
    const p = v.clone().project(camera);
    return {
      x: box.x + ((p.x + 1) / 2) * box.width,
      y: box.y + ((1 - p.y) / 2) * box.height,
      ndcX: p.x,
      ndcY: p.y,
    };
  };
  return { base: toClient(base), top: toClient(top), front: base.z > 1 / C.zoom.start };
}

/** Pose the globe with Liberty true-front and centred; returns the tap point. */
async function poseLibertyFront(page: Page) {
  const canvas = page.locator(".hv5-globe-mount canvas");
  const box = (await canvas.boundingBox()) as Box;
  expect(box).not.toBeNull();
  await canvas.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("0");
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(30);
  }
  const q = poseAfterArrowRights(9);
  const liberty = LANDMARKS.find((l) => l.id === "liberty")!;
  const proj = projectLandmark(q, liberty, box);
  // Self-validating pose: Liberty must be truly on the front face (the
  // far-side mirror projection sits at almost the same pixel — only
  // the tangent-cone test tells them apart) and near the disc centre.
  expect(proj.front).toBe(true);
  expect(Math.abs(proj.base.ndcX)).toBeLessThan(0.35);
  const aim = {
    x: (proj.base.x + proj.top.x) / 2,
    y: (proj.base.y + proj.top.y) / 2,
  };
  return { canvas, box, q, aim };
}

/** The emptiest ocean point on the visible disc at the given pose. */
function emptiestOceanPoint(q: THREE.Quaternion, box: Box) {
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const discR = (Math.tan(Math.asin(1 / C.zoom.start)) / Math.tan((C.fov * DEG) / 2)) * (box.height / 2);
  const segments = LANDMARKS.map((lm) => projectLandmark(q, lm, box)).filter((p) => p.front);
  const segDist = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  };
  let best = { x: 0, y: 0, clearance: -1 };
  for (let gx = centre.x - discR * 0.8; gx <= centre.x + discR * 0.8; gx += 16) {
    for (let gy = centre.y - discR * 0.8; gy <= centre.y + discR * 0.8; gy += 16) {
      if (Math.hypot(gx - centre.x, gy - centre.y) > discR * 0.8) continue;
      let clearance = Infinity;
      for (const s of segments) clearance = Math.min(clearance, segDist(gx, gy, s.base, s.top));
      if (clearance > best.clearance) best = { x: gx, y: gy, clearance };
    }
  }
  return best;
}

/** Per-frame WebGL draw counts, instrumented test-side (no app seam). */
const DRAW_STATS_INIT = `(() => {
  const frames = [];
  let calls = 0, tris = 0;
  const wrap = (proto, name, countIdx, instIdx) => {
    const orig = proto[name];
    if (typeof orig !== "function") return;
    proto[name] = function (mode) {
      calls++;
      const count = arguments[countIdx];
      const inst = instIdx >= 0 ? arguments[instIdx] : 1;
      if (mode === 4 && typeof count === "number") tris += (count / 3) * (typeof inst === "number" ? inst : 1);
      return orig.apply(this, arguments);
    };
  };
  for (const proto of [window.WebGLRenderingContext && WebGLRenderingContext.prototype, window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!proto) continue;
    wrap(proto, "drawElements", 1, -1);
    wrap(proto, "drawArrays", 2, -1);
    wrap(proto, "drawElementsInstanced", 1, 4);
    wrap(proto, "drawArraysInstanced", 2, 3);
  }
  const tick = () => {
    frames.push({ calls, tris });
    if (frames.length > 900) frames.shift();
    calls = 0; tris = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__drawFrames = frames;
})();`;

/** The settled frame's draw counts: a sampler window holding exactly
 *  one app render reads that frame's true counts, so the minimum-calls
 *  positive sample in the tail is one whole settled frame (calls and
 *  triangles paired from the same render). */
async function settledDrawCalls(page: Page, lastN = 45) {
  return page.evaluate((n) => {
    const frames = (window as unknown as { __drawFrames: { calls: number; tris: number }[] }).__drawFrames;
    const tail = frames.slice(-n).filter((f) => f.calls > 0);
    const min = tail.reduce((a, f) => (f.calls < a.calls ? f : a), { calls: Infinity, tris: -1 });
    return {
      samples: tail.length,
      minCalls: tail.length ? min.calls : -1,
      frameTris: tail.length ? min.tris : -1,
    };
  }, lastN);
}

test.describe("landmark globe — tap to dive (real taps)", () => {
  test.setTimeout(300_000);

  test("a real tap on a landmark dives to it and parks; a real drag lets go", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(DRAW_STATS_INIT);
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expectGlobePainted(page);
    const { canvas, aim } = await poseLibertyFront(page);

    await page.mouse.click(aim.x, aim.y);
    await expect
      .poll(() => canvas.getAttribute("aria-label"), { timeout: 10_000 })
      .toBe("Globe. Statue of Liberty, New York.");

    // The flight is 1.5 s; well past it the dive must still hold (parked:
    // the slow turn never resumes under a parked frame).
    await page.waitForTimeout(3_000);
    expect(await canvas.getAttribute("aria-label")).toBe("Globe. Statue of Liberty, New York.");
    const diveFrame = await settledDrawCalls(page);
    expect(diveFrame.samples).toBeGreaterThan(10);
    expect(diveFrame.minCalls).toBeGreaterThan(0);
    expect(diveFrame.minCalls).toBeLessThanOrEqual(60);

    // A real drag is the un-park: the label returns to the resting text.
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await page.mouse.move(aim.x + 50, aim.y, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(() => canvas.getAttribute("aria-label"), { timeout: 5_000 })
      .toBe(GLOBE_LABEL);
    await context.close();
  });

  test("a drag across a landmark does NOT dive, and a tap on empty ocean does NOT dive", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expectGlobePainted(page);
    const { canvas, box, q, aim } = await poseLibertyFront(page);

    // Drag: press on Liberty's silhouette and travel well past the 6 px
    // tap tolerance before releasing — a drag, never a tap.
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await page.mouse.move(aim.x + 40, aim.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    expect(await canvas.getAttribute("aria-label")).toBe(GLOBE_LABEL);

    // Re-pose (the drag disturbed it) and tap the emptiest ocean point.
    const again = await poseLibertyFront(page);
    const ocean = emptiestOceanPoint(again.q, again.box);
    expect(ocean.clearance).toBeGreaterThan(90);
    await page.mouse.click(ocean.x, ocean.y);
    await page.waitForTimeout(600);
    expect(await canvas.getAttribute("aria-label")).toBe(GLOBE_LABEL);
    await context.close();
  });

  test("globe view draws the skin tier only: frame budget holds with no B/C crowd", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(DRAW_STATS_INIT);
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expectGlobePainted(page);
    await page.waitForTimeout(1_500);
    const frame = await settledDrawCalls(page);
    expect(frame.samples).toBeGreaterThan(10);
    // With every landmark on the skin this frame drew ~99 calls in the
    // mock's first wave; the reveal keeps it at the Tier-A skin (~46).
    expect(frame.minCalls).toBeGreaterThan(0);
    expect(frame.minCalls).toBeLessThanOrEqual(60);
    expect(frame.frameTris).toBeLessThan(45_000);
    await context.close();
  });

  test("the expedition card over the canvas swallows the tap: no dive", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    await page.goto(APP_URL);
    const canvas = page.locator(".hv5-globe-mount canvas");
    await expect(canvas).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator(".hv5-globe-orb")).toHaveCount(0, { timeout: 60_000 });
    const card = page.getByTestId("tour-stop-editions");
    // The card overlaps the canvas's lower reaches, below the fold at
    // this viewport: scroll it into view first, then measure both
    // boxes in the same viewport coordinates the hit test uses.
    await card.scrollIntoViewIfNeeded();
    const cBox = (await canvas.boundingBox()) as Box;
    const eBox = (await card.boundingBox()) as Box;
    const ix = Math.max(cBox.x, eBox.x);
    const iy = Math.max(cBox.y, eBox.y);
    const ix2 = Math.min(cBox.x + cBox.width, eBox.x + eBox.width);
    const iy2 = Math.min(cBox.y + cBox.height, eBox.y + eBox.height);
    expect(ix2 - ix).toBeGreaterThan(40);
    expect(iy2 - iy).toBeGreaterThan(40);
    // Tap the overlap's top-centre: over the card's head, clear of its
    // expedition buttons, where the card — not the canvas — is on top.
    const tap = { x: (ix + ix2) / 2, y: iy + 12 };
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          isCanvas: el instanceof HTMLCanvasElement,
          inCard: !!el?.closest('[data-testid="tour-stop-editions"]'),
        };
      },
      tap,
    );
    expect(hit.isCanvas).toBe(false);
    expect(hit.inCard).toBe(true);
    await page.mouse.click(tap.x, tap.y);
    await page.waitForTimeout(600);
    expect(await canvas.getAttribute("aria-label")).toBe(GLOBE_LABEL);
    await context.close();
  });
});
