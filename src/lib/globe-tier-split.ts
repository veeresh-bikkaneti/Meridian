/**
 * globeTierSplit resolver — ONE decision per page load.
 *
 * Why a cache: `loadFlags()` re-fetches on every call after it settles and
 * replaces the overrides wholesale, so `isEnabled()` can change mid-session
 * (e.g. the picker's useDeckStatus effect calls loadFlags again). The two
 * `placesFor` call sites (openRun, the Play effect) must agree on the value
 * for a run, so the first resolution is final for the page ("boot-time value
 * is authoritative for the session" - docs/feature-flags.md).
 *
 * Safe default: if flags.json is slow (>1.5s), missing, invalid or offline,
 * loadFlags() resolves without applying anything and isEnabled() returns the
 * baked-in default (false) -> the FULL Globe pool, today's behavior.
 * Never rejects. Must only be called from event handlers / effects, never at
 * module scope and never during render or SSR.
 */
import { isEnabled, loadFlags, type FlagName } from "./flags.ts";

export interface GlobeTierSplitDeps {
  load: () => Promise<void>;
  read: (flag: FlagName) => boolean;
}

/** Factory with injectable deps (tests pass fakes; production uses the singleton below). */
export function createGlobeTierSplitResolver(deps: GlobeTierSplitDeps): () => Promise<boolean> {
  let decided: boolean | null = null;
  return async function resolve(): Promise<boolean> {
    if (decided !== null) return decided;
    try {
      await deps.load();
    } catch {
      // loadFlags never rejects; paranoia only. Fall through to the read,
      // which yields the baked-in default.
    }
    // Re-check after the await: a concurrent caller may have decided first.
    // The first decision wins so every caller sees the same value.
    if (decided === null) {
      let value = false;
      try {
        value = deps.read("globeTierSplit") === true;
      } catch {
        value = false;
      }
      decided = value;
    }
    return decided;
  };
}

/** The production resolver: shared by every Globe `placesFor` call site. */
export const resolveGlobeTierSplit = createGlobeTierSplitResolver({
  load: loadFlags,
  read: isEnabled,
});
