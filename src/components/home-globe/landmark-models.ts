/**
 * Landmark globe — the twelve landmark models, the orbit-ring plane, the
 * brass halo and the contact-shadow texture.
 *
 * Ported from the approved mock (docs/mockups/landmark-globe.html): each
 * landmark is built per material, every transform is baked into the
 * geometry, and the parts merge into one mesh per material, so the whole
 * set stays near the mock's measured 7,602 triangles and 51 draw calls.
 * No downloaded models; every shape is a three.js primitive composition.
 *
 * This module value-imports three, so the shell loads it dynamically,
 * together with three itself, only when the hero nears the viewport.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  COLOSSEUM_ARCH_COLOR,
  GLOBE_CONTRACT as C,
  PALETTE,
  type LandmarkSpec,
  type PaletteKey,
} from "./globe-contract.ts";

export type MaterialFactory = (
  key: PaletteKey,
  extra?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

/** Per-scene material factory: contract palette, smooth shading throughout. */
export function createMaterialFactory(): MaterialFactory {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return (key, extra = {}) => {
    const cacheKey = key + JSON.stringify(extra);
    let material = cache.get(cacheKey);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: PALETTE[key],
        roughness: 0.78,
        metalness: key.startsWith("brass") ? 0.25 : 0,
        flatShading: false,
        ...extra,
      });
      cache.set(cacheKey, material);
    }
    return material;
  };
}

export function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ----- merged-geometry bag: bake transforms, merge one mesh per material ----- */

const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, s = 10, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const cone = (r: number, h: number, s = 10) => new THREE.ConeGeometry(r, h, s);
const sph = (r: number, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);

function crisp(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

interface Bag {
  add: (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
    rx?: number,
    ry?: number,
    rz?: number,
    sx?: number,
    sy?: number | null,
    sz?: number | null,
  ) => void;
  build: () => THREE.Group;
}

function bag(): Bag {
  const map = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  return {
    add(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = null, sz = null) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        q,
        new THREE.Vector3(sx, sy ?? sx, sz ?? sx),
      );
      geo.applyMatrix4(m);
      if (!map.has(material.uuid)) map.set(material.uuid, { material, geos: [] });
      map.get(material.uuid)!.geos.push(geo);
    },
    build() {
      const grp = new THREE.Group();
      let tris = 0;
      for (const { material, geos } of map.values()) {
        const merged = mergeGeometries(geos, false);
        if (!merged) continue;
        tris += (merged.index ? merged.index.count : merged.attributes.position.count) / 3;
        grp.add(new THREE.Mesh(merged, material));
      }
      grp.userData.tris = tris;
      return grp;
    },
  };
}

function tube(
  points: THREE.Vector3[],
  radius: number,
  target: Bag,
  material: THREE.Material,
  seg = 36,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  target.add(new THREE.TubeGeometry(curve, seg, radius, 5), material);
}

/* ----- the twelve builders (unit height ~1, base at y=0) ----- */

type Builder = (mat: MaterialFactory, key: PaletteKey) => THREE.Group;

const BUILD: Record<string, Builder> = {
  eiffel(mat, key) {
    const b = bag();
    const m = mat(key);
    const brass = mat("brass");
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        b.add(bx(0.075, 0.22, 0.075), m, sx * 0.155, 0.1, sz * 0.155, -sz * 0.16, 0, sx * 0.16);
        b.add(bx(0.06, 0.2, 0.06), m, sx * 0.112, 0.29, sz * 0.112, -sz * 0.12, 0, sx * 0.12);
        b.add(bx(0.048, 0.18, 0.048), m, sx * 0.078, 0.46, sz * 0.078, -sz * 0.08, 0, sx * 0.08);
      }
    for (const [ty, off] of [
      [0.2, 0.148],
      [0.38, 0.104],
    ] as const) {
      for (const s of [-1, 1]) {
        b.add(bx(off * 2, 0.016, 0.016), m, 0, ty, s * off, 0, 0, 0.62);
        b.add(bx(off * 2, 0.016, 0.016), m, 0, ty, s * off, 0, 0, -0.62);
        b.add(bx(0.016, 0.016, off * 2), m, s * off, ty, 0, 0.62, 0, 0);
        b.add(bx(0.016, 0.016, off * 2), m, s * off, ty, 0, -0.62, 0, 0);
      }
    }
    b.add(bx(0.34, 0.035, 0.34), m, 0, 0.545);
    b.add(cyl(0.055, 0.115, 0.26, 4), m, 0, 0.69, 0, 0, Math.PI / 4, 0);
    b.add(bx(0.19, 0.03, 0.19), m, 0, 0.835);
    b.add(cyl(0.018, 0.055, 0.3, 4), m, 0, 0.99, 0, 0, Math.PI / 4, 0);
    b.add(cyl(0.003, 0.011, 0.17, 6), brass, 0, 1.22);
    b.add(sph(0.014, 8, 6), brass, 0, 1.31);
    return b.build();
  },

  bigben(mat, key) {
    const b = bag();
    const m = mat(key);
    const brass = mat("brass");
    const lit = mat("card", { emissive: 0xd9b25a, emissiveIntensity: 0.4 });
    const ink = mat("ink");
    const forest = mat("forest");
    b.add(bx(0.21, 0.06, 0.21), m, 0, 0.03);
    b.add(bx(0.15, 0.88, 0.15), m, 0, 0.5);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      b.add(bx(0.022, 0.78, 0.006), brass, Math.sin(a) * 0.077, 0.5, Math.cos(a) * 0.077, 0, a, 0);
    }
    b.add(bx(0.23, 0.25, 0.23), m, 0, 1.06);
    const face = new THREE.CircleGeometry(0.076, 18);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const sx = Math.sin(a);
      const cz = Math.cos(a);
      b.add(face.clone(), lit, sx * 0.117, 1.06, cz * 0.117, 0, a, 0);
      b.add(bx(0.009, 0.052, 0.004), ink, sx * 0.12, 1.075, cz * 0.12, 0, a, 0.7);
      b.add(bx(0.007, 0.036, 0.004), ink, sx * 0.121, 1.05, cz * 0.121, 0, a, -1.9);
    }
    b.add(bx(0.2, 0.03, 0.2), brass, 0, 1.2);
    b.add(bx(0.155, 0.13, 0.155), m, 0, 1.28);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.add(cyl(0.011, 0.011, 0.13, 6), brass, sx * 0.062, 1.28, sz * 0.062);
    b.add(bx(0.19, 0.025, 0.19), brass, 0, 1.36);
    b.add(cone(0.125, 0.32, 4), forest, 0, 1.53, 0, 0, Math.PI / 4, 0);
    b.add(cyl(0.003, 0.009, 0.1, 6), brass, 0, 1.74);
    return b.build();
  },

  colosseum(mat, key) {
    const b = bag();
    // Restyled Nov 19 2026 (contract 3.4): warm sandstone, a taller drum,
    // dark arch insets as real geometry, a stepped broken upper tier.
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#dfc298";
      ctx.fillRect(0, 0, 1024, 256);
      ctx.fillStyle = "#b08954";
      ctx.fillRect(0, 0, 1024, 14);
      ctx.fillStyle = "rgba(122, 90, 52, 0.35)";
      for (let y = 62; y < 256; y += 64) ctx.fillRect(0, y, 1024, 5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const dark = new THREE.MeshStandardMaterial({ color: COLOSSEUM_ARCH_COLOR, roughness: 0.95 });
    const drum = (rt: number, rb: number, h: number, start: number, len: number) =>
      new THREE.CylinderGeometry(rt, rb, h, 36, 1, true, start, len);
    b.add(drum(0.5, 0.53, 0.46, 0, Math.PI * 2), wallMat, 0, 0.23, 0, 0, 0, 0, 1, 1, 0.8);
    b.add(drum(0.5, 0.5, 0.22, 0, 1.5), wallMat, 0, 0.57, 0, 0, 0, 0, 1, 1, 0.8);
    b.add(drum(0.5, 0.5, 0.14, 1.5, 1.05), wallMat, 0, 0.53, 0, 0, 0, 0, 1, 1, 0.8);
    b.add(drum(0.5, 0.5, 0.07, 2.55, 0.8), wallMat, 0, 0.495, 0, 0, 0, 0, 1, 1, 0.8);
    b.add(new THREE.TorusGeometry(0.5, 0.016, 4, 36), mat(key), 0, 0.46, 0, Math.PI / 2, 0, 0, 1, 0.8, 1);
    const aw = 0.062;
    const ah = 0.115;
    const ar = aw / 2;
    const archShape = new THREE.Shape();
    archShape.moveTo(-ar, -ah / 2);
    archShape.lineTo(-ar, ah / 2 - ar);
    archShape.absarc(0, ah / 2 - ar, ar, Math.PI, 0, true);
    archShape.lineTo(ar, -ah / 2);
    archShape.closePath();
    const archGeo = new THREE.ShapeGeometry(archShape, 6);
    for (const ay of [0.145, 0.325])
      for (let i = 0; i < 16; i++) {
        const t = ((i + 0.5) / 16) * Math.PI * 2;
        b.add(archGeo.clone(), dark, 0.509 * Math.sin(t), ay, 0.8 * 0.509 * Math.cos(t), 0, t, 0);
      }
    b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 28, 1, true), mat(key), 0, 0.15, 0, 0, 0, 0, 1, 1, 0.8);
    b.add(cyl(0.46, 0.46, 0.03, 28), mat("sand"), 0, 0.015, 0, 0, 0, 0, 1, 1, 0.8);
    return b.build();
  },

  liberty(mat, key) {
    const b = bag();
    const m = mat(key);
    const stone = mat("stone");
    const flame = mat("brass", { emissive: 0xcc7722, emissiveIntensity: 0.7 });
    b.add(bx(0.36, 0.1, 0.36), stone, 0, 0.05);
    b.add(bx(0.36, 0.1, 0.36), stone, 0, 0.05, 0, 0, Math.PI / 4, 0);
    b.add(cyl(0.12, 0.17, 0.24, 8), stone, 0, 0.22);
    const profile = [
      [0.135, 0],
      [0.12, 0.08],
      [0.095, 0.22],
      [0.075, 0.36],
      [0.066, 0.46],
      [0.07, 0.5],
    ].map(([px, py]) => new THREE.Vector2(px, py));
    b.add(new THREE.LatheGeometry(profile, 14), m, 0, 0.34);
    b.add(sph(0.052, 10, 8), m, 0, 0.9);
    b.add(cyl(0.056, 0.058, 0.022, 10), m, 0, 0.945);
    for (let i = 0; i < 7; i++) {
      const a = -0.95 + i * (1.9 / 6);
      b.add(cone(0.009, 0.065, 4), m, Math.sin(a) * 0.052, 0.985, -Math.cos(a) * 0.02 + 0.028, Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55);
    }
    b.add(cyl(0.015, 0.019, 0.27, 6), m, 0.085, 1.0, 0, 0, 0, -0.42);
    b.add(cyl(0.011, 0.013, 0.08, 6), flame, 0.148, 1.13);
    b.add(sph(0.02, 8, 6), flame, 0.148, 1.2, 0, 0, 0, 0, 1, 1.7, 1);
    b.add(cyl(0.014, 0.017, 0.2, 6), m, -0.075, 0.82, 0.02, 0.5, 0, 0.9);
    b.add(bx(0.075, 0.095, 0.016), m, -0.125, 0.76, 0.045, 0.2, 0.3, 0.15);
    return b.build();
  },

  cntower(mat, key) {
    const b = bag();
    const m = mat(key);
    const brass = mat("brass");
    b.add(cyl(0.032, 0.078, 0.95, 12), m, 0, 0.475);
    b.add(sph(0.115, 12, 8), m, 0, 0.79, 0, 0, 0, 0, 1, 0.55, 1);
    b.add(cyl(0.117, 0.117, 0.028, 12), brass, 0, 0.79);
    b.add(cyl(0.048, 0.058, 0.07, 10), m, 0, 0.93);
    b.add(cyl(0.004, 0.017, 0.52, 6), m, 0, 1.22);
    return b.build();
  },

  goldengate(mat, key) {
    const b = bag();
    const m = mat(key);
    const steel = mat("steel");
    const span = 0.62;
    for (const sx of [-span / 2, span / 2]) {
      for (const sz of [-0.055, 0.055]) b.add(bx(0.04, 0.78, 0.04), m, sx, 0.39, sz);
      for (const by of [0.2, 0.42, 0.62, 0.76]) b.add(bx(0.042, 0.035, 0.15), m, sx, by, 0);
      b.add(bx(0.05, 0.03, 0.16), m, sx, 0.795, 0);
    }
    b.add(bx(1.3, 0.04, 0.15), steel, 0, 0.27);
    b.add(bx(1.3, 0.012, 0.1), m, 0, 0.295);
    const cableY = (xx: number) =>
      Math.abs(xx) <= span / 2
        ? 0.32 + 0.46 * Math.pow(xx / (span / 2), 2)
        : 0.78 - 0.44 * ((Math.abs(xx) - span / 2) / (0.65 - span / 2));
    for (const z of [-0.055, 0.055]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const xx = -0.65 + (i / 24) * 1.3;
        pts.push(new THREE.Vector3(xx, cableY(xx), z));
      }
      tube(pts, 0.0075, b, m, 40);
      for (let i = 0; i <= 10; i++) {
        const xx = -0.55 + i * 0.11;
        const top = cableY(xx);
        const len = Math.max(top - 0.3, 0.02);
        b.add(cyl(0.0035, 0.0035, len, 4, true), m, xx, 0.3 + len / 2, z);
      }
    }
    return b.build();
  },

  machupicchu(mat) {
    const b = bag();
    const steps: Array<[number, PaletteKey]> = [
      [0.92, "sage"],
      [0.76, "forest"],
      [0.6, "sage"],
      [0.44, "forest"],
    ];
    steps.forEach(([w, c], i) => {
      b.add(bx(w, 0.07, 0.44 - i * 0.06), mat(c), -0.05 * i, 0.035 + i * 0.07, 0.03 * i);
      b.add(bx(w, 0.05, 0.02), mat("stone"), -0.05 * i, 0.025 + i * 0.07, 0.03 * i + (0.44 - i * 0.06) / 2);
    });
    for (let i = 0; i < 3; i++) {
      const hx = -0.22 + i * 0.13;
      const hy = 0.31;
      b.add(bx(0.075, 0.055, 0.07), mat("stone"), hx, hy, 0.05);
      b.add(bx(0.1, 0.014, 0.05), mat("clay"), hx - 0.024, hy + 0.045, 0.05, 0, 0, 0.62);
      b.add(bx(0.1, 0.014, 0.05), mat("clay"), hx + 0.024, hy + 0.045, 0.05, 0, 0, -0.62);
    }
    b.add(cone(0.24, 0.82, 7), mat("forest"), 0.32, 0.41, -0.18);
    b.add(cone(0.15, 0.45, 7), mat("sage"), -0.4, 0.225, -0.14);
    return b.build();
  },

  pyramids(mat) {
    const b = bag();
    const tints = [0, 0.16, 0.3].map(
      (t) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.sand).lerp(new THREE.Color(PALETTE.stone), t),
          roughness: 0.88,
          metalness: 0,
        }),
    );
    b.add(crisp(cone(0.34, 0.5, 4)), tints[0], 0, 0.25, 0, 0, Math.PI / 4, 0);
    b.add(crisp(cone(0.3, 0.44, 4)), tints[1], 0.46, 0.22, -0.18, 0, Math.PI / 4, 0);
    b.add(crisp(cone(0.16, 0.23, 4)), tints[2], -0.36, 0.115, 0.22, 0, Math.PI / 4, 0);
    b.add(crisp(bx(1.05, 0.02, 0.6)), tints[2], 0.05, 0.01, 0);
    return b.build();
  },

  burj(mat, key) {
    const b = bag();
    const m = mat(key);
    const tiers = [0.135, 0.115, 0.096, 0.078, 0.06, 0.044];
    tiers.forEach((r, i) => {
      const y = 0.11 + i * 0.22;
      b.add(cyl(r * 0.8, r * 0.92, 0.22, 6), m, 0, y);
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3 + i * 0.22;
        b.add(bx(r * 1.7, 0.22, r * 0.6), m, Math.cos(a) * r * 0.62, y, Math.sin(a) * r * 0.62, 0, -a, 0);
      }
    });
    b.add(cyl(0.004, 0.026, 0.42, 6), m, 0, 1.53);
    b.add(cyl(0.0015, 0.004, 0.14, 5), m, 0, 1.8);
    return b.build();
  },

  indiagate(mat, key) {
    const b = bag();
    const m = mat(key);
    const brassDeep = mat("brassDeep");
    b.add(bx(0.74, 0.05, 0.28), m, 0, 0.025);
    b.add(bx(0.17, 0.62, 0.21), m, -0.25, 0.36);
    b.add(bx(0.17, 0.62, 0.21), m, 0.25, 0.36);
    b.add(bx(0.69, 0.05, 0.235), brassDeep, 0, 0.6);
    b.add(bx(0.7, 0.15, 0.23), m, 0, 0.745);
    b.add(bx(0.76, 0.04, 0.27), m, 0, 0.84);
    b.add(bx(0.42, 0.09, 0.19), m, 0, 0.905);
    b.add(sph(0.095, 12, 8), m, 0, 0.95, 0, 0, 0, 0, 1, 0.68, 1);
    b.add(cyl(0.004, 0.01, 0.07, 6), brassDeep, 0, 1.05);
    return b.build();
  },

  greatwall(mat, key) {
    const b = bag();
    const m = mat(key);
    const sandstone = mat("sandstone");
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      pts.push(
        new THREE.Vector3(
          -0.58 + t * 1.16,
          0.05 + Math.sin(t * Math.PI * 1.4) * 0.045,
          Math.sin(t * Math.PI * 1.6) * 0.17,
        ),
      );
    }
    for (let i = 0; i < 9; i++) {
      const a = pts[i];
      const p = pts[i + 1];
      const len = a.distanceTo(p);
      const mx = (a.x + p.x) / 2;
      const my = (a.y + p.y) / 2;
      const mz = (a.z + p.z) / 2;
      const ry = -Math.atan2(p.z - a.z, p.x - a.x);
      const rz = Math.atan2(p.y - a.y, Math.hypot(p.x - a.x, p.z - a.z));
      b.add(bx(len, 0.075, 0.06), m, mx, my, mz, 0, ry, rz);
      for (const f of [-0.32, 0, 0.32]) {
        b.add(bx(0.028, 0.035, 0.062), m, mx + Math.cos(ry) * len * f, my + 0.055 - Math.sin(rz) * len * f, mz - Math.sin(ry) * len * f, 0, ry, rz);
      }
    }
    for (const i of [0, 3, 6, 9]) {
      b.add(bx(0.11, 0.19, 0.11), sandstone, pts[i].x, pts[i].y + 0.06, pts[i].z);
      b.add(cone(0.095, 0.07, 4), sandstone, pts[i].x, pts[i].y + 0.19, pts[i].z, 0, Math.PI / 4, 0);
    }
    return b.build();
  },

  opera(mat, key) {
    const b = bag();
    b.add(bx(1.0, 0.03, 0.48), mat("sandstone"), 0, 0.015);
    b.add(bx(0.94, 0.06, 0.42), mat("sandstone"), 0, 0.06);
    const sm = mat(key, { side: THREE.DoubleSide });
    const shellGeo = () => new THREE.SphereGeometry(0.3, 14, 9, 0, Math.PI, 0, Math.PI / 2);
    const shells: Array<[number, number]> = [
      [-0.3, 1],
      [-0.08, 0.86],
      [0.12, 0.72],
      [0.3, 0.55],
    ];
    shells.forEach(([sx, s], i) => {
      const px = sx;
      const py = 0.09;
      const pz = i % 2 ? 0.07 : -0.05;
      b.add(shellGeo(), sm, px, py, pz, 0, Math.PI / 2, -0.35, 0.55 * s, 1.15 * s, 0.9 * s);
      for (const f of [0.82, 1.0]) {
        b.add(new THREE.TorusGeometry(0.3, 0.006, 4, 14, Math.PI), sm, px, py, pz, 0, Math.PI / 2, -0.35 + (f - 1) * 0.3, 0.55 * s * f, 1.15 * s * f, 0.9 * s);
      }
    });
    return b.build();
  },
};

/** Build one landmark model at unit height; triangle count lands on userData.tris. */
export function buildLandmark(mat: MaterialFactory, spec: LandmarkSpec): THREE.Group {
  const builder = BUILD[spec.id];
  if (!builder) throw new Error(`unknown landmark: ${spec.id}`);
  return builder(mat, spec.color);
}

/** Soft radial contact shadow shared by every landmark. */
export function createShadowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gr = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(51,48,42,0.45)");
    gr.addColorStop(1, "rgba(51,48,42,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Brass fresnel halo: a back-face sphere slightly larger than the globe. */
export function buildHalo(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(C.radius * C.halo.radius, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(C.halo.color) },
        uPow: { value: C.halo.power },
        uStr: { value: C.halo.strength },
      },
      vertexShader:
        "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "uniform vec3 uColor; uniform float uPow; uniform float uStr; varying vec3 vN; void main(){ float i = pow(clamp(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0), uPow) * uStr; gl_FragColor = vec4(uColor, i); }",
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
}

/** The little parchment plane that rides the orbit ring. */
export function buildPlane(mat: MaterialFactory): THREE.Group {
  const g = new THREE.Group();
  const card = mat("card");
  const addPart = (geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  addPart(bx(0.16, 0.025, 0.03), card);
  addPart(bx(0.035, 0.008, 0.2), card, 0.01, 0, 0);
  addPart(bx(0.025, 0.05, 0.006), mat("brass"), -0.07, 0.025, 0);
  addPart(bx(0.025, 0.006, 0.08), card, -0.07, 0, 0);
  return g;
}
