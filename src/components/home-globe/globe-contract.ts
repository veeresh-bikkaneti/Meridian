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
  // Wave-1 mock values: deeper zoom (min 1.95, diveDist 2.05) and the
  // dive's oblique finish (diveTiltDeg 53, numerically verified to land
  // a ~50° view elevation at the dive distance — see MOCKUP-STATUS.md).
  zoom: { start: 5.6, min: 1.95, max: 8.5, keyStep: 0.85, wheelK: 0.0015, ease: 8, diveDist: 2.05, diveSeconds: 1.5, diveTiltDeg: 53 },
  // Reveal v2 focus bands (owner correction, Nov 20 2026: the Canyon
  // dive frame crowded five neighbours at full size — "unless player
  // zooms in we dont want to reveal more"). A landmark must ALSO sit
  // within this angular radius of the player's focus (frame centre, or
  // the dive target while a dive is parked) to reveal; the radius is
  // interpolated over camera distance from these [dist, deg] anchors
  // and SHRINKS as the camera closes in. Wide anchors keep globe view
  // untouched (the visible cap at start distance 5.6 spans ~80°, well
  // inside the 100° band, so Tier A's sparse skin is unchanged); the
  // parked-dive band settled at 12° on the drawn coordinates: Grand
  // Canyon keeps Golden Gate (8.5°) + Rushmore (10.2°) and sinks
  // Space Needle (13.8°); Liberty keeps CN Tower (4.9°) and sinks the
  // trans-Atlantic band (Eiffel 53.5°, Big Ben 48.6°).
  revealFocus: { bands: [[8.5, 180], [5.6, 100], [2.6, 35], [2.2, 22], [2.05, 12]] as const },
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
  /** Extra spin about the surface normal (deg): aligns an elongated
   *  model to a bearing (Rama Setu's ridge) and, since wave 2, turns a
   *  model's readable face toward the dive's finishing azimuth (the
   *  holder frame rolls with position, so the presenting side is
   *  solved numerically per landmark). Defaults to 0. */
  spinDeg?: number;
  /** Progressive reveal (owner direction, wave 2): the camera distance
   *  at or below which the landmark rises onto the skin. Tier A = 8.5
   *  (always — equals zoom.max), Tier B = 2.6 (mid zoom), Tier C = 2.2
   *  (deep zoom; the dive finishes at 2.05, inside every tier).
   *  Reveal v2 adds the focus gate on top: see GLOBE_CONTRACT's
   *  revealFocus — distance alone no longer reveals a whole region. */
  revealAt: number;
}

/** Contract section 3.4: real lat/lon, drawn-at spot, scale, palette key.
 *  Wave 2: every row also carries revealAt — Tier A 8.5 (always on the
 *  skin), Tier B 2.6, Tier C 2.2; see LandmarkSpec.revealAt. */
export const LANDMARKS: readonly LandmarkSpec[] = [
  { id: "eiffel", name: "Eiffel Tower", place: "Paris", lat: 48.858, lon: 2.294, drawnLat: 47.0, drawnLon: 2.8, scale: 0.22, color: "brassDeep", revealAt: 8.5 },
  { id: "bigben", name: "Big Ben", place: "London", lat: 51.501, lon: -0.125, drawnLat: 53.0, drawnLon: -2.0, scale: 0.19, color: "stone", revealAt: 8.5 },
  { id: "colosseum", name: "Colosseum", place: "Rome", lat: 41.89, lon: 12.492, drawnLat: 40.5, drawnLon: 15.0, scale: 0.25, color: "sandstone", revealAt: 8.5 },
  { id: "liberty", name: "Statue of Liberty", place: "New York", lat: 40.689, lon: -74.045, drawnLat: 40.689, drawnLon: -74.045, scale: 0.22, color: "sage", revealAt: 8.5 },
  { id: "cntower", name: "CN Tower", place: "Toronto", lat: 43.643, lon: -79.387, drawnLat: 43.643, drawnLon: -79.387, scale: 0.19, color: "stone", revealAt: 2.6 },
  { id: "goldengate", name: "Golden Gate Bridge", place: "San Francisco", lat: 37.82, lon: -122.478, drawnLat: 37.82, drawnLon: -122.478, scale: 0.28, color: "clay", revealAt: 2.6 },
  { id: "machupicchu", name: "Machu Picchu", place: "Peru", lat: -13.163, lon: -72.545, drawnLat: -13.163, drawnLon: -72.545, scale: 0.3, color: "forest", revealAt: 2.6 },
  { id: "pyramids", name: "Pyramids of Giza", place: "Egypt", lat: 29.979, lon: 31.134, drawnLat: 29.979, drawnLon: 31.134, scale: 0.25, color: "sand", revealAt: 8.5 },
  { id: "burj", name: "Burj Khalifa", place: "Dubai", lat: 25.197, lon: 55.274, drawnLat: 25.197, drawnLon: 55.274, scale: 0.2, color: "steel", revealAt: 8.5 },
  { id: "indiagate", name: "India Gate", place: "New Delhi", lat: 28.613, lon: 77.23, drawnLat: 28.613, drawnLon: 77.23, scale: 0.25, color: "sandstone", revealAt: 2.6 },
  { id: "greatwall", name: "Great Wall", place: "China", lat: 40.432, lon: 116.57, drawnLat: 40.432, drawnLon: 116.57, scale: 0.3, color: "stone", revealAt: 8.5 },
  { id: "opera", name: "Sydney Opera House", place: "Sydney", lat: -33.857, lon: 151.215, drawnLat: -33.857, drawnLon: 151.215, scale: 0.3, color: "card", revealAt: 8.5 },
  // Mockup additions (famous-landmarks mock, Nov 20 2026): spec lat/lon stay
  // true; the Taj's drawn spot follows the same overlap discipline as Europe
  // (its true spot sits ~0.03 globe units from India Gate and the two models
  // would merge into one blob).
  { id: "tajmahal", name: "Taj Mahal", place: "Agra", lat: 27.175, lon: 78.042, drawnLat: 24.9, drawnLon: 80.3, scale: 0.27, color: "card", revealAt: 8.5 },
  { id: "christ", name: "Christ the Redeemer", place: "Rio de Janeiro", lat: -22.952, lon: -43.211, drawnLat: -22.952, drawnLon: -43.211, scale: 0.24, color: "stone", revealAt: 8.5 },
  { id: "ramasetu", name: "Rama Setu", place: "Adam's Bridge", lat: 9.121, lon: 79.522, drawnLat: 9.121, drawnLon: 79.522, scale: 0.34, color: "sand", spinDeg: -22.6, revealAt: 2.2 },
  // Wave-1 additions (owner's full major-landmark canon, Nov 20 2026):
  // spec lat/lon verified against Wikipedia infobox coordinates; drawn
  // spots nudged only where models would merge in the dense Europe /
  // East-Asia clusters — every nudge is disclosed in MOCKUP-STATUS.md.
  { id: "stbasil", name: "St Basil's Cathedral", place: "Moscow", lat: 55.753, lon: 37.623, drawnLat: 55.753, drawnLon: 37.623, scale: 0.23, color: "clay", revealAt: 8.5 },
  { id: "pisa", name: "Leaning Tower of Pisa", place: "Pisa", lat: 43.723, lon: 10.397, drawnLat: 44.5, drawnLon: 9.0, scale: 0.25, color: "stone", revealAt: 2.6 },
  { id: "acropolis", name: "Acropolis", place: "Athens", lat: 37.972, lon: 23.727, drawnLat: 36.5, drawnLon: 25.5, scale: 0.24, color: "stone", revealAt: 2.6 },
  { id: "sagrada", name: "Sagrada Familia", place: "Barcelona", lat: 41.404, lon: 2.174, drawnLat: 39.0, drawnLon: 1.0, scale: 0.24, color: "sandstone", revealAt: 2.6 },
  { id: "brandenburg", name: "Brandenburg Gate", place: "Berlin", lat: 52.516, lon: 13.378, drawnLat: 52.516, drawnLon: 13.378, scale: 0.24, color: "sandstone", revealAt: 2.6 },
  { id: "angkor", name: "Angkor Wat", place: "Cambodia", lat: 13.412, lon: 103.867, drawnLat: 13.412, drawnLon: 103.867, scale: 0.26, color: "stone", revealAt: 2.6 },
  { id: "forbidden", name: "Forbidden City", place: "Beijing", lat: 39.916, lon: 116.397, drawnLat: 34.5, drawnLon: 110.0, scale: 0.26, color: "clay", revealAt: 2.6 },
  { id: "fuji", name: "Mount Fuji", place: "Japan", lat: 35.361, lon: 138.727, drawnLat: 35.361, drawnLon: 138.727, scale: 0.3, color: "stone", revealAt: 8.5 },
  { id: "petronas", name: "Petronas Towers", place: "Kuala Lumpur", lat: 3.158, lon: 101.712, drawnLat: 3.158, drawnLon: 101.712, scale: 0.21, color: "steel", revealAt: 2.6 },
  { id: "hagia", name: "Hagia Sophia", place: "Istanbul", lat: 41.009, lon: 28.98, drawnLat: 44.5, drawnLon: 30.0, scale: 0.24, color: "sandstone", revealAt: 2.6 },
  { id: "petra", name: "Petra", place: "Jordan", lat: 30.322, lon: 35.452, drawnLat: 31.0, drawnLon: 40.5, scale: 0.22, color: "clay", revealAt: 2.2 },
  // Wave-2 additions (canon completion): spec lat/lon are Wikipedia
  // infobox values (five of them re-verified by search this wave —
  // see MOCKUP-STATUS.md). Drawn spots nudged only for the Sphinx
  // (its true spot sits inside the Pyramids model) and Niagara (its
  // true spot sits inside the CN Tower model). spinDeg is the solved
  // presentation correction: it turns each model's readable face (or
  // long axis) toward the dive's finishing azimuth.
  { id: "sphinx", name: "Great Sphinx", place: "Giza", lat: 29.975, lon: 31.138, drawnLat: 27.0, drawnLon: 36.5, scale: 0.24, color: "sand", spinDeg: 103, revealAt: 2.6 },
  { id: "tablemountain", name: "Table Mountain", place: "Cape Town", lat: -33.963, lon: 18.41, drawnLat: -33.963, drawnLon: 18.41, scale: 0.3, color: "sandstone", spinDeg: 85, revealAt: 2.2 },
  { id: "victoriafalls", name: "Victoria Falls", place: "Zambezi River", lat: -17.924, lon: 25.857, drawnLat: -17.924, drawnLon: 25.857, scale: 0.32, color: "sandstone", spinDeg: 92, revealAt: 2.2 },
  { id: "rushmore", name: "Mount Rushmore", place: "South Dakota", lat: 43.879, lon: -103.459, drawnLat: 43.879, drawnLon: -103.459, scale: 0.26, color: "stone", spinDeg: -37, revealAt: 2.6 },
  { id: "chichen", name: "Chichen Itza", place: "Yucatan", lat: 20.683, lon: -88.569, drawnLat: 20.683, drawnLon: -88.569, scale: 0.26, color: "stone", spinDeg: -22, revealAt: 2.6 },
  { id: "moai", name: "Moai", place: "Easter Island", lat: -27.126, lon: -109.277, drawnLat: -27.126, drawnLon: -109.277, scale: 0.26, color: "stone", spinDeg: -43, revealAt: 2.2 },
  { id: "grandcanyon", name: "Grand Canyon", place: "Arizona", lat: 36.107, lon: -112.113, drawnLat: 36.107, drawnLon: -112.113, scale: 0.34, color: "sandstone", spinDeg: -46, revealAt: 2.2 },
  { id: "niagara", name: "Niagara Falls", place: "Ontario", lat: 43.08, lon: -79.075, drawnLat: 39.0, drawnLon: -69.0, scale: 0.3, color: "steel", spinDeg: -2, revealAt: 2.2 },
  { id: "gatewayarch", name: "Gateway Arch", place: "St Louis", lat: 38.625, lon: -90.185, drawnLat: 38.625, drawnLon: -90.185, scale: 0.3, color: "steel", spinDeg: -24, revealAt: 2.6 },
  { id: "spaceneedle", name: "Space Needle", place: "Seattle", lat: 47.62, lon: -122.349, drawnLat: 47.62, drawnLon: -122.349, scale: 0.24, color: "steel", spinDeg: -56, revealAt: 2.6 },
  { id: "uluru", name: "Uluru", place: "Australia", lat: -25.345, lon: 131.036, drawnLat: -25.345, drawnLon: 131.036, scale: 0.32, color: "clay", spinDeg: -162, revealAt: 2.2 },
];

/** Colosseum restyle (contract 3.4/3.6 item 5): dark arch inset colour. */
export const COLOSSEUM_ARCH_COLOR = 0x4a3421;
