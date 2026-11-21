/**
 * The storage key registry — every saved value's key string,
 * schema and fallback, written once, here.
 *
 * Stores import their key's entry from this registry instead of
 * repeating the string, so two stores can never drift onto
 * different keys for the same data. The strings match the ones
 * the domain stores already own (storage-keys.test.ts pins them
 * equal), because the saved data on players' devices sits under
 * those strings today.
 */

import { z } from "zod";

import type { ReadAloudPrefOrUnset } from "../../game/age-profile/read-aloud-pref.ts";
import type { StorageKeyDef } from "./storage.ts";

/** Per-subject progress: which cases each subject has finished. */
const subjectProgress: StorageKeyDef<Record<string, string[]>> = {
  key: "meridian.subject-progress.v1",
  schema: z.record(z.string(), z.array(z.string())),
  fallback: {},
};

/**
 * The kid's read-aloud answer. The schema is the answer itself —
 * exactly the values the preference store accepts — and the
 * fallback is that store's own default: "unset", the answer not
 * yet given.
 */
const readAloudPref: StorageKeyDef<ReadAloudPrefOrUnset> = {
  key: "meridian.readAloudPref.v1",
  schema: z.enum(["always", "sometimes", "never"]),
  fallback: "unset",
};

/**
 * The age profile blob. This entry pins the key string for future
 * consumers only: the blob's real validation and legacy migration
 * stay with validateProfile in the domain store, so the schema
 * here checks nothing and the fallback is null.
 */
const ageProfile: StorageKeyDef<unknown> = {
  key: "meridian.ageProfile.v1",
  schema: z.unknown(),
  fallback: null,
};

/** Every registered storage key, by the name stores know it by. */
export const STORAGE_KEYS = {
  subjectProgress,
  readAloudPref,
  ageProfile,
};
