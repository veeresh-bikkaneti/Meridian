/**
 * Shared helpers for the Scout Map E2E specs (PBI-9 + Phase A UX contracts).
 *
 * DOM/STORAGE CONTRACTS the specs assert (dev must implement to these):
 *  - localStorage `meridian:map-mode` holds a single JSON record:
 *      { mode: "full"|"scout", source: "manual"|"prior-crash"|"probe"|
 *        "low-memory"|"contextlost", setAt: number, accepted?: true }
 *  - boot: there is NO boot dialog (owner ruling, 2026-10-20) — a weak
 *    device auto-switches to Scout silently and stores an auto record
 *  - settings toggle: data-testid="map-mode-button", in the Play top bar,
 *    NOT inside .satellite-map; flipping it sends the player home. The
 *    same control is ALSO hosted on Home (Block C) beside a visible
 *    indicator (data-testid="map-mode-indicator", data-mode attr);
 *    flipping it there just writes the manual record — no run exists
 *  - home notices: data-testid="map-switched-notice" (after a manual
 *    switch lands the player home, Block B) and
 *    data-testid="scout-auto-notice" (this boot auto-switched, Block C).
 *    Neither carries role="status" (re-vote BLOCK-3): GameApp's hoisted
 *    announcer (data-testid="map-mode-announcer") is the sole speaker
 *    for map-mode events.
 *  - runtime switches (webglcontextlost, WS-4 tile fallback) reconcile
 *    the home notices in GameApp (applyMapMode / applySessionMapMode —
 *    Play never receives the raw setter): a standing switched notice
 *    retires, because its text names a mode the switch just changed
 *    (re-vote round 3, BLOCK-B). They never speak on the announcer
 *    (device switches are silent) and the tile path stores nothing
 *  - a manual flip while a run start is still loading CANCELS the
 *    start (generation guard in openRun): the cancelled start never
 *    commits, never re-persists `meridian.run`, and never parks a
 *    start error on Home (re-vote round 3, BLOCK-A). The toggle popover is
 *    data-testid="map-mode-popover"; on Home the button's aria-label
 *    carries the current mode and the popover is fixed-positioned,
 *    clamped inside the viewport
 *  - switch note: role="status", classes "fixed inset-x-4 top-16",
 *    sibling of the ResultCard, visible only in story phase after reveal
 *  - map wrapper: data-map-mode="full"|"scout" (proposed), data-zoom,
 *    data-max-zoom (proposed)
 *
 * If the dev's contracts differ, these specs (QA-owned) adapt — the
 * BEHAVIORS they assert are the contract.
 */
import type { BrowserContext, Page } from "playwright/test";
import { spoofCapableDevice, spoofLowMemoryDevice } from "./helpers";

// The device-signal spoofs live in helpers.ts now (serveBuiltArtifact
// installs the capable one by default — issue #154 item 1). They are
// re-exported here so existing Scout specs keep importing them from
// this module.
export { spoofCapableDevice, spoofLowMemoryDevice };

export const APP_URL = "http://127.0.0.1:4123/Meridian/";
export const MAP_MODE_KEY = "meridian:map-mode";

/** Stored record shape per src/map/capability.ts (dev's API). */
export interface StoredMapMode {
  mode: "full" | "scout";
  source: "manual" | "prior-crash" | "probe" | "low-memory" | "default";
  setAt: number;
}

/**
 * Seed a map-attributed prior crash BEFORE the app boots: the previous
 * session died (cleanExit "0") with the map mounted (breadcrumb at the
 * map_init_start milestone). This is the crash pipeline's input to the
 * `priorMapCrash` signal (capability.ts) — the realistic trigger for a
 * prior-crash auto-switch, not a hand-written mode record.
 *
 * One-shot: the real app clears the breadcrumb at boot (exactly-once
 * rotation in observability.ts), so a reload must NOT re-seed — otherwise
 * every reload looks like a fresh crash and the offer can never retire.
 * The marker guard reproduces the real lifecycle.
 */
export async function seedCrashOffer(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (sessionStorage.getItem("qa-crash-seeded")) return;
    sessionStorage.setItem("qa-crash-seeded", "1");
    sessionStorage.setItem("meridian.cleanExit", "0");
    sessionStorage.setItem(
      "meridian.breadcrumb",
      JSON.stringify({ lastMilestone: "map_init_start", sessionId: "qa-crash-offer" }),
    );
  });
}

/**
 * Seed a manual override record BEFORE the app boots (dev's record shape).
 *
 * Write-once: the seed lands only when no record exists yet. An init
 * script re-runs on EVERY navigation, and an unguarded re-seed would
 * clobber a record the app itself wrote mid-test (e.g. a manual toggle
 * flip) with a fresh setAt — the same reload trap seedCrashOffer's
 * comment above describes. A real device record is never rewritten per
 * boot (write policy Q3), so the harness record isn't either.
 */
export async function seedManualMode(
  context: BrowserContext,
  mode: "full" | "scout",
): Promise<void> {
  await context.addInitScript((m: "full" | "scout") => {
    if (localStorage.getItem("meridian:map-mode")) return;
    localStorage.setItem(
      "meridian:map-mode",
      JSON.stringify({ mode: m, source: "manual", setAt: Date.now() }),
    );
  }, mode);
}

export async function readStoredMapMode(page: Page): Promise<StoredMapMode | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), MAP_MODE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMapMode;
  } catch {
    return null;
  }
}

/** The settings toggle locator per the Phase A contract. */
export const mapModeButton = (page: Page) =>
  page.getByTestId("map-mode-button");

/** The switch row inside the toggle popover (the button only opens it). */
export const mapModeSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Scout Map" });

/** Open the popover and flip the switch — the full toggle interaction. */
export async function flipMapModeToggle(page: Page): Promise<void> {
  await mapModeButton(page).click();
  await mapModeSwitch(page).click();
}

/** The mid-game switch note per the Phase A contract. */
export const switchNote = (page: Page) =>
  page.getByTestId("scout-switch-note");

/** The map wrapper; data-map-mode carries the active mode (proposed). */
export const mapWrapper = (page: Page) => page.locator(".satellite-map");

/**
 * The starfield layer — mounted behind the map ONLY by a full-mode
 * construction (scout never mounts it). This is the feature-level signal
 * the toggle specs assert on: unlike data-map-mode (a label that flips
 * with the prop), the starfield exists only if a full map was actually
 * built, and satellite tile requests likewise only happen in full mode.
 */
export const starfield = (page: Page) => page.locator(".meridian-starfield");

export async function readMapMode(page: Page): Promise<string | null> {
  return mapWrapper(page).getAttribute("data-map-mode");
}

/** True when (x2,y2) is fully outside rect (x1,y1,w1,h1). */
export function rectsDisjoint(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    b.x >= a.x + a.width ||
    b.x + b.width <= a.x ||
    b.y >= a.y + a.height ||
    b.y + b.height <= a.y
  );
}
