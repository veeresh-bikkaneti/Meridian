import { BRAND } from "./brand.ts";
import { create } from "zustand";
import { PLACES_BY_ID } from "./catalog.ts";
import { buildPuzzle, dateKeyFor } from "./daily.ts";
import { distanceToPlaceKm } from "./geo.ts";
import { SCORING_VERSION, gradeRound } from "./score.ts";
import { bonusFor } from "./territory.ts";
import type { Edition, Guess, HomeChoice, LonLat, MapStyle, Run, ThemeChoice } from "./types.ts";

const STORAGE_KEY = BRAND.storageKey;
const LEGACY_KEYS = [...BRAND.legacyStorageKeys, STORAGE_KEY];

export type Screen = "welcome" | "today" | "play" | "results";

type Persisted = {
  playerName: string;
  home: HomeChoice;
  mapStyle: MapStyle;
  theme: ThemeChoice;
  games: Partial<Record<Edition, Run>>;
  screen: Screen;
  active: Edition | null;
};

type State = Persisted & {
  booted: boolean;
  boot: () => void;
  setName: (name: string) => void;
  setHome: (home: HomeChoice) => void;
  setMapStyle: (style: MapStyle) => void;
  setTheme: (theme: ThemeChoice) => void;
  startGame: (edition: Edition) => void;
  placePin: (at: LonLat) => void;
  confirmGuess: () => void;
  setKnew: (knew: boolean) => void;
  next: () => void;
  showToday: () => void;
  showResults: (edition: Edition) => void;
  forget: () => void;
};

function emptyPersisted(): Persisted {
  return {
    playerName: "",
    home: "lincoln",
    mapStyle: "roads",
    theme: "system",
    games: {},
    screen: "welcome",
    active: null,
  };
}

function cookiePresent(): boolean {
  return document.cookie.split("; ").some((part) => part.startsWith(`${BRAND.cookie}=`));
}

function mintCookie() {
  document.cookie = `${BRAND.cookie}=1; Path=/; SameSite=Lax`;
}

function wipeDeviceSession() {
  try {
    for (const key of LEGACY_KEYS) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }
  document.cookie = `${BRAND.cookie}=; Path=/; Max-Age=0; SameSite=Lax`;
  for (const name of BRAND.legacyCookies) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

function validRun(run: Run | undefined): run is Run {
  if (!run || !Array.isArray(run.placeIds) || run.placeIds.length !== 5) return false;
  if (!run.placeIds.every((id) => PLACES_BY_ID[id])) return false;
  if (!Array.isArray(run.guesses) || run.guesses.length !== 5) return false;
  if (!run.guesses.every((guess) => guess === null || guess.scoringVersion === SCORING_VERSION)) return false;
  return run.phase === "aim" || run.phase === "reveal";
}

function readPersisted(): Persisted | null {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const reloaded = !nav || nav.type === "reload";
  if (reloaded || !cookiePresent()) {
    wipeDeviceSession();
    mintCookie();
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    const games: Persisted["games"] = {};
    if (validRun(data.games?.world)) games.world = data.games.world;
    if (validRun(data.games?.home)) games.home = data.games.home;
    const name = typeof data.playerName === "string" ? data.playerName.slice(0, 24) : "";
    if (!name) return null;
    return {
      playerName: name,
      home: data.home === "visitor" ? "visitor" : "lincoln",
      mapStyle: data.mapStyle === "bare" ? "bare" : "roads",
      theme: data.theme === "night" || data.theme === "paper" ? data.theme : "system",
      games,
      screen: data.screen === "play" || data.screen === "results" || data.screen === "today" ? data.screen : "today",
      active: data.active === "world" || data.active === "home" ? data.active : null,
    };
  } catch {
    return null;
  }
}

export function writeSession(state: State) {
  if (!state.booted || typeof sessionStorage === "undefined") return;
  const payload: Persisted = {
    playerName: state.playerName,
    home: state.home,
    mapStyle: state.mapStyle,
    theme: state.theme,
    games: state.games,
    screen: state.screen,
    active: state.active,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

function currentRun(state: Persisted): Run | null {
  if (!state.active) return null;
  return state.games[state.active] ?? null;
}

export const useSession = create<State>((set, get) => ({
  ...emptyPersisted(),
  booted: false,
  boot: () => {
    if (get().booted) return;
    const restored = readPersisted();
    if (get().playerName) {
      set({ booted: true });
      return;
    }
    if (!restored) {
      mintCookie();
      set({ booted: true });
      return;
    }
    set({ ...restored, booted: true });
  },
  setName: (name) => {
    const clean = name.replace(/[\u0000-\u001F]/g, "").trim().slice(0, 24);
    set({ playerName: clean, screen: clean ? "today" : "welcome" });
  },
  setHome: (home) => {
    const games = { ...get().games };
    if (games.home && games.home.home !== home) delete games.home;
    set({ home, games, screen: get().screen === "play" && get().active === "home" ? "today" : get().screen });
  },
  setMapStyle: (mapStyle) => set({ mapStyle }),
  setTheme: (theme) => set({ theme }),
  startGame: (edition) => {
    const state = get();
    const dateKey = dateKeyFor(edition);
    const existing = state.games[edition];
    if (existing && existing.dateKey === dateKey && existing.home === state.home && validRun(existing)) {
      set({
        active: edition,
        screen: existing.done ? "results" : "play",
      });
      return;
    }
    const places = buildPuzzle(edition, dateKey, state.home);
    const run: Run = {
      edition,
      dateKey,
      home: state.home,
      placeIds: places.map((place) => place.id),
      pending: null,
      guesses: [null, null, null, null, null],
      index: 0,
      phase: "aim",
      done: false,
    };
    set({
      games: { ...state.games, [edition]: run },
      active: edition,
      screen: "play",
    });
  },
  placePin: (at) => {
    const state = get();
    const run = currentRun(state);
    if (!run || run.done || run.phase !== "aim") return;
    const next: Run = { ...run, pending: at };
    set({ games: { ...state.games, [run.edition]: next } });
  },
  confirmGuess: () => {
    const state = get();
    const run = currentRun(state);
    if (!run || run.phase !== "aim" || !run.pending) return;
    const place = PLACES_BY_ID[run.placeIds[run.index]];
    if (!place) return;
    const [lon, lat] = run.pending;
    const distanceKm = distanceToPlaceKm([lon, lat], place);
    const bonus =
      place.ring === "world" || place.ring === "usa" ? bonusFor([lon, lat], place.reveal) : "none";
    const graded = gradeRound(distanceKm, place.ring, bonus, run.index);
    const guess: Guess = {
      lon,
      lat,
      distanceKm,
      distanceScore: graded.distanceScore,
      score: graded.score,
      weight: graded.weight,
      bonus: graded.bonus,
      knew: null,
      scoringVersion: SCORING_VERSION,
    };
    const guesses = run.guesses.slice();
    guesses[run.index] = guess;
    const next: Run = { ...run, guesses, pending: null, phase: "reveal" };
    set({ games: { ...state.games, [run.edition]: next } });
  },
  setKnew: (knew) => {
    const state = get();
    const run = currentRun(state);
    if (!run) return;
    const guess = run.guesses[run.index];
    if (!guess) return;
    const guesses = run.guesses.slice();
    guesses[run.index] = { ...guess, knew };
    set({ games: { ...state.games, [run.edition]: { ...run, guesses } } });
  },
  next: () => {
    const state = get();
    const run = currentRun(state);
    if (!run || run.phase !== "reveal") return;
    if (run.index >= 4) {
      const done: Run = { ...run, done: true };
      set({ games: { ...state.games, [run.edition]: done }, screen: "results" });
      return;
    }
    const next: Run = { ...run, index: run.index + 1, phase: "aim", pending: null };
    set({ games: { ...state.games, [run.edition]: next } });
  },
  showToday: () => set({ screen: "today" }),
  showResults: (edition) => set({ active: edition, screen: "results" }),
  forget: () => {
    wipeDeviceSession();
    mintCookie();
    set({ ...emptyPersisted(), booted: true });
  },
}));

export function activeRun(state: State): Run | null {
  if (!state.active) return null;
  return state.games[state.active] ?? null;
}
