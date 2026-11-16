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
}
