/**
 * Screen hashes (item 8, invariants INV3/INV5).
 *
 * Each in-app screen in game-app.tsx gets its own hash, pushed with
 * `history.pushState` when the screen changes, so the browser Back
 * button returns to the previous screen instead of leaving the site
 * (game-app historically only called `replaceState`, so Back exited).
 * A shared link carrying one of these hashes opens the screen it
 * names. Hashes are fragments, never sent to a server, and the map
 * below is the whole contract — screens not listed (a quiz run in
 * progress, the admin-1 drill-down, which needs a country id the
 * hash does not carry) keep today's behaviour and push nothing.
 *
 * Keys are game-app's `inAppScreen` values. `#c=…` friend-challenge
 * fragments are handled at boot before this map is ever consulted,
 * and home section fragments (`#home-about`, …) are deliberately
 * unmapped: they are scroll targets on Home, not screens.
 */
const SCREEN_TO_HASH: Readonly<Record<string, string>> = {
  home: "#home",
  geodetective: "#geodetective",
  coldtrail: "#coldtrail",
  subjects: "#why-learn",
  "menu:countries": "#list/countries",
  "menu:states": "#list/states",
};

const HASH_TO_SCREEN: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SCREEN_TO_HASH).map(([screen, hash]) => [hash, screen]),
);

/** The hash for an in-app screen, or null when the screen has none. */
export function hashForScreen(screen: string): string | null {
  return SCREEN_TO_HASH[screen] ?? null;
}

/** The in-app screen a hash names, or null when it names none. */
export function screenForHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  return HASH_TO_SCREEN[hash] ?? null;
}
