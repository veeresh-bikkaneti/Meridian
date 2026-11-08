// Cold Trail — the GeoDetective-style smuggler-triangulation loop.
//
// One case: 3 timestamped sightings (witness city + vague radius), the player
// places 3 radius rings, triangulates, and taps one interception guess.
// Score = km from the true hideout. All case data is build-time generated
// (scripts/build-coldtrail.mjs) and bundled — no runtime fetches.

/** One witness report, as emitted by the build script. */
export interface ColdTrailSightingRegion {
  /** Kid-friendly continent per UN M49, e.g. "Asia". */
  continent: string;
  /** CLDR country name, e.g. "Türkiye". */
  country: string;
  /**
   * State/province, e.g. "Texas" — only for the large-country set
   * (US, CA, BR, IN, CN, RU, AU); null everywhere else.
   */
  subdivision: string | null;
}

export interface ColdTrailSighting {
  id: string;
  /** "Tue 08:14" — game-fiction timestamp, not a real date. */
  timestamp: string;
  cityId: string;
  cityName: string;
  cityLon: number;
  cityLat: number;
  /** Vague ring radius in km (rounded by hideout difficulty at build time). */
  radiusKm: number;
  /** Bearing from the witness city toward the hideout, 8 winds. */
  octant: string;
  /** Full clue sentence, e.g. "Last seen refueling 400 km east of Denver." */
  text: string;
  /** Continent/country context for the witness city (never the hideout). */
  region: ColdTrailSightingRegion;
  /**
   * Capitals & Flags: when this witness is a pack capital, the flag
   * identity of the land it is the capital OF (a country capital →
   * that country; a state capital → that state), stamped by the pack
   * generator. The card renders the flag beside the region line, where
   * that land's name is already printed. Absent = no flag.
   */
  flagKey?: string;
}

export interface ColdTrailHideout {
  placeId: string;
  name: string;
  lon: number;
  lat: number;
  difficulty: number;
  /**
   * Capitals & Flags (pack cases only): the hideout's country, stamped
   * by the pack generator so the reveal can print the country in text
   * beside its flag — the one flag rule forbids a flag whose land is
   * not named on screen. Absent on core cases (no reveal flag there).
   */
  countryName?: string;
  /** The hideout country's flag identity; absent = flagless country. */
  flagKey?: string;
}

/** One playable case from cases.generated.json. */
export interface ColdTrailCase {
  v: 1;
  caseNo: number;
  hideout: ColdTrailHideout;
  sightings: [ColdTrailSighting, ColdTrailSighting, ColdTrailSighting];
  /**
   * Pack this case belongs to (for example "capitals"), stamped by a
   * pack generation pass. Core deck cases omit it. Pack decks live in
   * their own generated files with their own store keys, and load
   * through cases-pack.ts, never through the core deck in cases.ts.
   */
  packId?: string;
}

/** A player-chosen ring center (lon/lat in WGS84, never pixels). */
export interface ColdTrailRingCenter {
  lon: number;
  lat: number;
}

/** Per-case progress, persisted so a reload resumes mid-case. */
export interface ColdTrailProgress {
  /** Per sighting index: has its ring been placed on the map? */
  ringsPlaced: [boolean, boolean, boolean];
  /** Per sighting index: did the informant tighten this ring (radius / 2)? */
  informantOn: [boolean, boolean, boolean];
  /**
   * Per sighting index: the PLAYER-chosen ring center; null until locked.
   * Committed atomically with ringsPlaced[i] (see TrailScreen.onLockRing).
   * The true anchor (sighting.cityLon/cityLat) is never stored here and
   * never rendered pre-reveal — see buildEvidenceOverlays.
   */
  ringCenters: [ColdTrailRingCenter | null, ColdTrailRingCenter | null, ColdTrailRingCenter | null];
  /** The interception tap; null until the player taps the map. */
  guess: { lon: number; lat: number } | null;
  revealed: boolean;
  /** Rounded km from guess to hideout; null until revealed. */
  scoreKm: number | null;
}

/** Whole Cold Trail blob, persisted as one JSON value. */
export interface ColdTrailStore {
  /** v2: ringCenters added (v1 saves are migrated once, then deleted). */
  v: 2;
  /** Index into the generated deck of the current case. */
  caseIndex: number;
  /** Informant currency: 1 star tightens one ring 50%. */
  stars: number;
  /** Lifetime solved count. */
  solved: number;
  /** The open case; null until the first case starts. */
  current: ColdTrailProgress | null;
}
