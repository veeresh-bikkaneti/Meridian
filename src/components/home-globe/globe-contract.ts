/**
 * Landmark globe — design and motion contract constants.
 *
 * Single source of truth, copied from docs/mockups/landmark-globe-contract.md
 * (sections 3.1-3.5), which records the approved mock's final values. Nobody
 * tunes these without a new mockup. Pure data: no three.js import, so the
 * React shell can read it without pulling the globe payload into the
 * initial bundle.
 */

export const DEG = Math.PI / 180;

export const GLOBE_CONTRACT = {
  radius: 1,
  segments: { full: [64, 48] as const, small: [32, 24] as const },
  smallBelowPx: 280,
  dprCap: 1.5,
  fov: 34,
  zoom: { start: 5.6, min: 3.4, max: 8.5, keyStep: 0.85, wheelK: 0.0015, ease: 8 },
  axialTiltDeg: 23.44,
  viewerPitch: 0.12,
  startLongitudeDeg: 20,
  autoSpin: 0.12,
  resumeAfter: 3.0,
  resumeRamp: 1.5,
  uprightEase: 0.8,
  dragSens: 0.005,
  keySpin: 0.18,
  inertiaDamp: 0.92,
  inertiaStop: 0.02,
  inertiaCap: 6,
  riseSeconds: 0.8,
  ring: { radius: 1.42, tube: 0.005, opacity: 0.45, tiltX: Math.PI / 2.25, tiltY: 0.35 },
  plane: { speed: 0.35 },
  halo: { radius: 1.09, color: 0xc9a14a, power: 2.6, strength: 0.5 },
  lights: {
    ambient: { color: 0xfff1da, intensity: 1.15 },
    sun: { color: 0xffe9c4, intensity: 1.6, position: [-2.4, 1.6, 2.6] as const },
    rim: { color: 0xdfe8d2, intensity: 0.45, position: [2.6, -0.8, -1.4] as const },
    brassRim: { color: 0xd9b25a, intensity: 0.9, position: [-2.0, 1.2, -3.0] as const },
  },
} as const;

export const PALETTE = {
  stone: 0xefe4c8,
  sandstone: 0xd9b68c,
  sand: 0xcfae6a,
  brass: 0x8a6d2f,
  brassDeep: 0x77591f,
  forest: 0x33503f,
  sage: 0x8fa382,
  steel: 0xb7c2b0,
  ink: 0x33302a,
  card: 0xfdfbf3,
  clay: 0xa2603a,
} as const;

export type PaletteKey = keyof typeof PALETTE;

export interface LandmarkSpec {
  id: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  /** Drawn-at spot, nudged only where Europe would overlap. Defaults to lat/lon. */
  drawnLat: number;
  drawnLon: number;
  scale: number;
  color: PaletteKey;
}

/** Contract section 3.4: real lat/lon, drawn-at spot, scale, palette key. */
export const LANDMARKS: readonly LandmarkSpec[] = [
  { id: "eiffel", name: "Eiffel Tower", place: "Paris", lat: 48.858, lon: 2.294, drawnLat: 47.0, drawnLon: 2.8, scale: 0.22, color: "brassDeep" },
  { id: "bigben", name: "Big Ben", place: "London", lat: 51.501, lon: -0.125, drawnLat: 53.0, drawnLon: -2.0, scale: 0.19, color: "stone" },
  { id: "colosseum", name: "Colosseum", place: "Rome", lat: 41.89, lon: 12.492, drawnLat: 40.5, drawnLon: 15.0, scale: 0.25, color: "sandstone" },
  { id: "liberty", name: "Statue of Liberty", place: "New York", lat: 40.689, lon: -74.045, drawnLat: 40.689, drawnLon: -74.045, scale: 0.22, color: "sage" },
  { id: "cntower", name: "CN Tower", place: "Toronto", lat: 43.643, lon: -79.387, drawnLat: 43.643, drawnLon: -79.387, scale: 0.19, color: "stone" },
  { id: "goldengate", name: "Golden Gate Bridge", place: "San Francisco", lat: 37.82, lon: -122.478, drawnLat: 37.82, drawnLon: -122.478, scale: 0.28, color: "clay" },
  { id: "machupicchu", name: "Machu Picchu", place: "Peru", lat: -13.163, lon: -72.545, drawnLat: -13.163, drawnLon: -72.545, scale: 0.3, color: "forest" },
  { id: "pyramids", name: "Pyramids of Giza", place: "Egypt", lat: 29.979, lon: 31.134, drawnLat: 29.979, drawnLon: 31.134, scale: 0.25, color: "sand" },
  { id: "burj", name: "Burj Khalifa", place: "Dubai", lat: 25.197, lon: 55.274, drawnLat: 25.197, drawnLon: 55.274, scale: 0.2, color: "steel" },
  { id: "indiagate", name: "India Gate", place: "New Delhi", lat: 28.613, lon: 77.23, drawnLat: 28.613, drawnLon: 77.23, scale: 0.25, color: "sandstone" },
  { id: "greatwall", name: "Great Wall", place: "China", lat: 40.432, lon: 116.57, drawnLat: 40.432, drawnLon: 116.57, scale: 0.3, color: "stone" },
  { id: "opera", name: "Sydney Opera House", place: "Sydney", lat: -33.857, lon: 151.215, drawnLat: -33.857, drawnLon: 151.215, scale: 0.3, color: "card" },
];

/** Colosseum restyle (contract 3.4/3.6 item 5): dark arch inset colour. */
export const COLOSSEUM_ARCH_COLOR = 0x4a3421;
