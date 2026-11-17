/**
 * Persisted screens and load failure (item 7, invariant INV1).
 *
 * Two screens persist an "open" flag in localStorage so a reload
 * mid-case restores the screen itself: GeoDetective
 * (`meridian.loop.open`) and Cold Trail (`meridian.coldtrail.open`).
 * Boot reads the flag at first render, so the flag IS the restore
 * decision for the next visit.
 *
 * That is a trap when the screen fails to load: the tap that opened
 * the screen wrote the flag, the chunk load then failed into
 * MapErrorBoundary's card, and every later visit — `/`, `/#home`,
 * the board's Home link — booted straight back into the broken
 * screen. The card's Try again reloads, which restored the same
 * failure. The only escape was clearing site data.
 *
 * The cure, owned by the boundary through this module: when a
 * persisted screen's load fails, its open flag is cleared at catch
 * time, so the next visit lands on Home. Try again re-arms the flag
 * before its reload, so the retry — and only the retry — restores
 * the screen for one more attempt. The screens' case stores are
 * never touched: an in-flight case survives and is offered again
 * when the player re-enters the screen from Home.
 *
 * Keyed by the boundary's `surface` prop, whose values are already
 * load-bearing (they render in the card's heading). Surfaces with
 * no persisted flag (the map, Subjects) are a no-op. The store
 * writers are fail-open (storage errors are swallowed there), so
 * these helpers never throw.
 */
import { writeColdTrailOpen } from "../game/coldtrail/store.ts";
import { writeLoopOpen } from "../game/loop/store.ts";

const OPEN_WRITERS: Record<string, (open: boolean) => void> = {
  "Cold Trail": writeColdTrailOpen,
  GeoDetective: writeLoopOpen,
};

/**
 * The 368 rule (owner condition, Stream N Phase 2, amending the
 * restore behaviour above): a bare visit to `/` ALWAYS lands on
 * Home, even if a case was left open. Boot therefore never reads
 * the localStorage open flags to pick its first screen — the flags
 * stay written on tap-in / leave as a record, nothing more. The one
 * exception is the error screen's own Try again: it marks a
 * one-shot retry in sessionStorage before reloading, and boot
 * restores exactly that screen, exactly once. sessionStorage is
 * the right store for it: it survives the retry reload but not a
 * new visit, which is precisely the bare-visit line.
 */
const RETRY_SCREEN_KEY = "meridian.retry-screen";

function readRetryMarker(): string | null {
  try {
    return sessionStorage.getItem(RETRY_SCREEN_KEY);
  } catch {
    return null;
  }
}

function writeRetryMarker(surface: string): void {
  try {
    sessionStorage.setItem(RETRY_SCREEN_KEY, surface);
  } catch {
    // Storage blocked: the retry reload lands on Home, where the
    // case is offered again — fail-open, never a trap.
  }
}

function clearRetryMarker(): void {
  try {
    sessionStorage.removeItem(RETRY_SCREEN_KEY);
  } catch {
    // Fail-open, as above.
  }
}

/**
 * Boot's restore decision (the 368 rule): the surface named by a
 * pending Try-again retry, or null — null means land on Home,
 * whatever the persisted open flags say. One-shot: the marker is
 * consumed, so a later bare visit cannot restore the screen again.
 */
export function consumeRetryScreen(): string | null {
  const surface = readRetryMarker();
  if (surface === null) return null;
  clearRetryMarker();
  return isPersistedScreen(surface) ? surface : null;
}

/** True when `surface` names a screen whose open state persists
 *  across visits (GeoDetective, Cold Trail). */
export function isPersistedScreen(surface?: string): boolean {
  return surface !== undefined && surface in OPEN_WRITERS;
}

/**
 * A persisted screen failed to load: clear its open flag so the
 * next visit lands on Home instead of restoring the broken screen.
 */
export function clearPersistedScreenOpen(surface?: string): void {
  if (surface === undefined) return;
  OPEN_WRITERS[surface]?.(false);
}

/**
 * The player tapped Try again on a failed persisted screen: re-arm
 * its open flag so the recovery reload restores that screen for
 * one more attempt.
 */
export function rearmPersistedScreenOpen(surface?: string): void {
  if (surface === undefined) return;
  OPEN_WRITERS[surface]?.(true);
  // The 368 rule: the retry reload restores the screen through the
  // one-shot session marker, not the persisted flag (a bare visit
  // must land on Home even with the flag set).
  if (isPersistedScreen(surface)) writeRetryMarker(surface);
}
