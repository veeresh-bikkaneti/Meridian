import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { PROFILE_STORAGE_KEY } from "../../game/age-profile/store.ts";
import { READ_ALOUD_PREF_KEY } from "../../game/age-profile/read-aloud-pref.ts";
import { SUBJECT_PROGRESS_KEY } from "../../game/subject-progress-store-key.ts";
import { STORAGE_KEYS } from "./keys.ts";

/**
 * The registry pins the same key strings the domain stores already
 * own, so the port and the stores can never drift onto different
 * keys for the same data.
 */

describe("storage key registry", () => {
  test("the subject progress entry pins the progress store's key", () => {
    assert.equal(STORAGE_KEYS.subjectProgress.key, SUBJECT_PROGRESS_KEY);
  });

  test("the read-aloud entry pins the preference store's key", () => {
    assert.equal(STORAGE_KEYS.readAloudPref.key, READ_ALOUD_PREF_KEY);
  });

  test("the age profile entry pins the profile store's key", () => {
    assert.equal(STORAGE_KEYS.ageProfile.key, PROFILE_STORAGE_KEY);
  });
});
