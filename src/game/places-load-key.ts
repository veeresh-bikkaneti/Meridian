import type { Edition } from "./run.ts";
import type { PickerDifficulty } from "./tier-filter.ts";

/**
 * Identity of a Play catalog load: `edition:regionId:band`. The band is part
 * of the key ONLY for the Globe (the only region whose catalog depends on the
 * learning path - placesFor ignores `choice` everywhere else), so country and
 * state runs never reset or remount on a band change.
 */
export function placesLoadKey(
  edition: Edition,
  regionId: string,
  choice: PickerDifficulty,
): string {
  return `${edition}:${regionId}:${regionId === "globe" ? choice : ""}`;
}

export interface LoadedFor<T> {
  key: string;
  value: T;
}

/** The loaded value only if it was loaded for `key`; otherwise null (stale). */
export function loadedForKey<T>(loaded: LoadedFor<T> | null, key: string): T | null {
  return loaded !== null && loaded.key === key ? loaded.value : null;
}
