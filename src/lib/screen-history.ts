/**
 * WI-8 (Branch 2): the in-app screen model for browser history.
 *
 * Meridian is a single-route SPA — screens are React state, not routes.
 * So Back-button support is a thin layer over history state: every
 * forward move between the four history-managed screens pushes a
 * same-URL entry carrying one of these states, and `popstate` reads
 * the entry back and drives the app to it. Same-URL entries mean
 * share links, bookmarks, and the Pages mirror's `/Meridian/` base
 * are untouched, and no path ever changes.
 *
 * Managed screens: home → picker → round → result. The result
 * REPLACES the round's entry (a finished run cannot be un-ended, so
 * Back from the summary lands on the picker, never a dead round).
 * GeoDetective and Cold Trail manage their own screens (Branch 3)
 * and push nothing here.
 *
 * The state object is deliberately tiny — a screen name plus, for the
 * picker, which list is showing — and holds no personal data.
 */

export type AppScreen = "home" | "picker" | "round" | "result";

/** Serializable snapshot of the edition picker's position. Mirrors the
 *  Menu shape in game-app.tsx (structural, not imported, so this
 *  module stays free of component dependencies). */
export interface MenuSnapshot {
  kind: "countries" | "states" | "admin1";
  countryId?: string;
  countryName?: string;
  from?: "countries" | "states";
}

export interface ScreenState {
  screen: AppScreen;
  menu?: MenuSnapshot;
}

const SCREENS: readonly string[] = ["home", "picker", "round", "result"];

/** Build the history state for a screen (picker states carry the menu). */
export function screenStateFor(screen: AppScreen, menu?: MenuSnapshot): Record<string, unknown> {
  return screen === "picker" && menu
    ? { meridianScreen: screen, menu }
    : { meridianScreen: screen };
}

function readMenuSnapshot(value: unknown): MenuSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  if (m.kind === "countries" || m.kind === "states") return { kind: m.kind };
  if (
    m.kind === "admin1" &&
    typeof m.countryId === "string" &&
    typeof m.countryName === "string" &&
    (m.from === "countries" || m.from === "states")
  ) {
    return { kind: "admin1", countryId: m.countryId, countryName: m.countryName, from: m.from };
  }
  return null;
}

/**
 * Validate an unknown history state. Returns null for anything that is
 * not one of ours (foreign entries, older builds, user meddling) — the
 * caller treats null as "home", the app's ground state.
 */
export function readScreenState(state: unknown): ScreenState | null {
  if (typeof state !== "object" || state === null) return null;
  const s = state as Record<string, unknown>;
  if (typeof s.meridianScreen !== "string" || !SCREENS.includes(s.meridianScreen)) return null;
  const screen = s.meridianScreen as AppScreen;
  if (screen !== "picker") return { screen };
  const menu = readMenuSnapshot(s.menu);
  return menu ? { screen, menu } : null;
}

/** A run is the round screen until its summary phase — the result. */
export function screenForRunPhase(phase: string): AppScreen {
  return phase === "summary" ? "result" : "round";
}

/** Structural equality for screen states (menu snapshot included). */
export function sameScreenState(a: ScreenState, b: ScreenState): boolean {
  if (a.screen !== b.screen) return false;
  if (a.screen !== "picker") return true;
  const ma = a.menu;
  const mb = b.menu;
  if (!ma || !mb) return ma === mb;
  return (
    ma.kind === mb.kind &&
    ma.countryId === mb.countryId &&
    ma.countryName === mb.countryName &&
    ma.from === mb.from
  );
}
