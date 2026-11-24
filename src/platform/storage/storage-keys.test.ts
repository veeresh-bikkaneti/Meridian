import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { PROFILE_STORAGE_KEY } from "../../game/age-profile/store.ts";
import { READ_ALOUD_PREF_KEY } from "../../game/age-profile/read-aloud-pref.ts";
import {
  GROWNUP_COOLDOWN_KEY,
  GROWNUP_STRIKES_KEY,
} from "../../components/ui/cooldown.ts";
import { SUBJECT_PROGRESS_KEY } from "../../game/subject-progress-store-key.ts";
import {
  COLDTRAIL_OPEN_KEY,
  COLDTRAIL_PACK_STORAGE_KEY,
  COLDTRAIL_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  PACK_SHELF_SELECTION_KEY,
} from "../../game/coldtrail/store.ts";
import {
  DISCARDED_NOTICE_KEY,
  SESSION_KEY,
} from "../../game/session.ts";
import {
  LOOP_OPEN_KEY,
  LOOP_STORAGE_KEY_V2,
} from "../../game/loop/types.ts";
import { PASSPORT_BADGES_KEY } from "../../game/passport/badges.ts";
import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_NOTICE_KEY,
  CHUNK_RELOAD_SURFACE_KEY,
  CHUNK_RECOVERY_KEY,
} from "../../lib/chunk-recovery.ts";
import { RETRY_SCREEN_KEY } from "../../lib/persisted-screen.ts";
import { LEARNING_STORE_KEY } from "../../game/learning.ts";
import { CHALLENGE_ATTEMPTS_KEY } from "../../game/challenge-attempts.ts";
import { REVIEW_DECK_STORE_KEY } from "../../game/review-deck.ts";
import { TUTORIAL_SEEN_KEY } from "../../game/tutorial.ts";
import { CLEAN_EXIT_KEY } from "../../game/clean-exit.ts";
import {
  DROP_KEY,
  RUN_KEY,
  RUN_MC2_KEY,
  RUN_MC3_KEY,
} from "../../game/reset-history.ts";
import { SOUND_KEY } from "../../game/audio/sfx.ts";
import { STALE_REFRESH_KEY } from "../../game/build-staleness.ts";
import { FIRST_WIN_KEY } from "../../components/celebration-copy.ts";
import {
  AUTO_NARRATION_KEY,
  GREET_DAY_KEY,
  TOUR_RETURN_KEY,
} from "../../components/storyteller-session.ts";
import {
  MAP_CRASH_MARKER_KEY,
  MAP_MODE_STORAGE_KEY,
} from "../../map/capability.ts";
import { PALETTE_STORAGE_KEY } from "../../game/palette.ts";
import { PACK_SHELF_SELECTION_KEY as SHELF_PACK_SHELF_SELECTION_KEY } from "../../components/ui/pack-shelf-data.ts";
import { decodeStoredText } from "./storage.ts";
import {
  clearedMarkKey,
  seenKey,
  unscopedSeenKey,
} from "../../game/trail.ts";
import { sportsAiCacheKey } from "../../game/sports-ai.ts";
import { storyCacheKey } from "../../game/story-ai.ts";
import {
  FIRST_VISIT_QUEUE_KEY,
  STORAGE_KEYS,
  TOUR_LAST_DATE_KEY,
  WALKED_SESSION_KEY,
  challengeRecordedKeyDef,
  challengeRecordedSummaryKeyDef,
  firstVisitSeenKeyDef,
  sportsAiCacheKeyDef,
  storyCacheKeyDef,
  storyKeyDef,
  trailClearedMarkKeyDef,
  trailSeenKeyDef,
  trailUnscopedSeenKeyDef,
} from "./keys.ts";

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

describe("storage key registry (domain storage ports)", () => {
  test("the grown-up cooldown entry pins the cooldown key, numeric with a 0 fallback", () => {
    assert.equal(STORAGE_KEYS.grownupCooldown.key, GROWNUP_COOLDOWN_KEY);
    assert.equal(STORAGE_KEYS.grownupCooldown.fallback, 0);
  });

  test("the grown-up strikes entry pins the strikes key", () => {
    assert.equal(STORAGE_KEYS.grownupStrikes.key, GROWNUP_STRIKES_KEY);
  });

  test("the Cold Trail entries pin the store's keys", () => {
    assert.equal(STORAGE_KEYS.coldtrailStore.key, COLDTRAIL_STORAGE_KEY);
    assert.equal(STORAGE_KEYS.coldtrailPack.key, COLDTRAIL_PACK_STORAGE_KEY);
    assert.equal(STORAGE_KEYS.packShelfSelection.key, PACK_SHELF_SELECTION_KEY);
    assert.equal(STORAGE_KEYS.coldtrailLegacy.key, LEGACY_STORAGE_KEY);
    assert.equal(STORAGE_KEYS.coldtrailOpen.key, COLDTRAIL_OPEN_KEY);
    assert.equal(STORAGE_KEYS.coldtrailOpen.encoding, "raw");
    assert.equal(STORAGE_KEYS.coldtrailOpen.fallback, "");
  });

  test("the session entries pin the session store's keys", () => {
    assert.equal(STORAGE_KEYS.session.key, SESSION_KEY);
    assert.equal(STORAGE_KEYS.discardedNotice.key, DISCARDED_NOTICE_KEY);
  });

  test("the loop entries pin the loop store's keys", () => {
    assert.equal(STORAGE_KEYS.loopStore.key, LOOP_STORAGE_KEY_V2);
    assert.equal(STORAGE_KEYS.loopOpen.key, LOOP_OPEN_KEY);
    assert.equal(STORAGE_KEYS.loopOpen.encoding, "raw");
    assert.equal(STORAGE_KEYS.loopOpen.fallback, "");
  });

  test("the passport badges entry pins the badges key", () => {
    assert.equal(STORAGE_KEYS.passportBadges.key, PASSPORT_BADGES_KEY);
  });

  test("the chunk-recovery entries pin the guard's keys", () => {
    assert.equal(STORAGE_KEYS.chunkReloadAt.key, CHUNK_RELOAD_KEY);
    assert.equal(STORAGE_KEYS.chunkReloadAt.fallback, 0);
    assert.equal(STORAGE_KEYS.chunkRecovery.key, CHUNK_RECOVERY_KEY);
    assert.equal(STORAGE_KEYS.chunkReloadSurface.key, CHUNK_RELOAD_SURFACE_KEY);
    assert.equal(STORAGE_KEYS.chunkReloadSurface.encoding, "raw");
    assert.equal(STORAGE_KEYS.chunkReloadSurface.fallback, "unknown");
    assert.equal(STORAGE_KEYS.chunkReloadNotice.key, CHUNK_RELOAD_NOTICE_KEY);
    assert.equal(STORAGE_KEYS.chunkReloadNotice.fallback, 0);
  });

  test("the retry-screen entry pins the persisted-screen key", () => {
    assert.equal(STORAGE_KEYS.retryScreen.key, RETRY_SCREEN_KEY);
    assert.equal(STORAGE_KEYS.retryScreen.encoding, "raw");
    assert.equal(STORAGE_KEYS.retryScreen.fallback, "");
  });

  test("the learning entry pins the learning store's key", () => {
    assert.equal(STORAGE_KEYS.learningStore.key, LEARNING_STORE_KEY);
  });

  test("the challenge-attempts entry pins the attempts key", () => {
    assert.equal(STORAGE_KEYS.challengeAttempts.key, CHALLENGE_ATTEMPTS_KEY);
  });

  test("the review-deck entry pins the deck store's key", () => {
    assert.equal(STORAGE_KEYS.reviewDeck.key, REVIEW_DECK_STORE_KEY);
  });

  test("the tutorial entry pins the tutorial seen key", () => {
    assert.equal(STORAGE_KEYS.tutorialSeen.key, TUTORIAL_SEEN_KEY);
    assert.equal(STORAGE_KEYS.tutorialSeen.encoding, "raw");
    assert.equal(STORAGE_KEYS.tutorialSeen.fallback, "");
  });

  test("the clean-exit entry pins the clean-exit key", () => {
    assert.equal(STORAGE_KEYS.cleanExit.key, CLEAN_EXIT_KEY);
    assert.equal(STORAGE_KEYS.cleanExit.encoding, "raw");
    assert.equal(STORAGE_KEYS.cleanExit.fallback, "1");
  });

  test("the paused-run entries pin the reset-history keys", () => {
    assert.equal(STORAGE_KEYS.pausedRun.key, RUN_KEY);
    assert.equal(STORAGE_KEYS.pausedRunMc2.key, RUN_MC2_KEY);
    assert.equal(STORAGE_KEYS.pausedRunMc3.key, RUN_MC3_KEY);
    assert.equal(STORAGE_KEYS.pausedDrop.key, DROP_KEY);
  });

  test("the sound entry pins the sfx key", () => {
    assert.equal(STORAGE_KEYS.sound.key, SOUND_KEY);
    assert.equal(STORAGE_KEYS.sound.encoding, "raw");
    assert.equal(STORAGE_KEYS.sound.fallback, "on");
  });

  test("the stale-refresh entry pins the build-staleness key, numeric with a 0 fallback", () => {
    assert.equal(STORAGE_KEYS.staleRefresh.key, STALE_REFRESH_KEY);
    assert.equal(STORAGE_KEYS.staleRefresh.fallback, 0);
  });

  test("the trail seen factory pins the domain builders for fixture ids", () => {
    const def = trailSeenKeyDef("globe", "globe", "medium");
    assert.equal(def.key, seenKey("globe", "globe", "medium"));
    assert.deepEqual(def.fallback, []);
    const unscoped = trailUnscopedSeenKeyDef("globe", "globe");
    assert.equal(unscoped.key, unscopedSeenKey("globe", "globe"));
    assert.deepEqual(unscoped.fallback, []);
  });

  test("the trail cleared-mark factory pins the domain builder for a fixture id", () => {
    const def = trailClearedMarkKeyDef("globe", "globe", "medium");
    assert.equal(def.key, clearedMarkKey("globe", "globe", "medium"));
    assert.equal(def.encoding, "raw");
    assert.equal(def.fallback, "");
  });

  test("the sports-AI cache factory pins the domain builder for a fixture id", () => {
    const def = sportsAiCacheKeyDef("5254962");
    assert.equal(def.key, sportsAiCacheKey("5254962"));
  });

  test("the story-AI cache factory pins the domain builder for a fixture id", () => {
    const def = storyCacheKeyDef("5254962");
    assert.equal(def.key, storyCacheKey("5254962"));
  });
});

describe("storage key registry (feature storage ports, slice A2)", () => {
  test("the first-win entry pins the celebration flag key, raw with an empty fallback", () => {
    assert.equal(STORAGE_KEYS.firstWinCelebrated.key, FIRST_WIN_KEY);
    assert.equal(STORAGE_KEYS.firstWinCelebrated.encoding, "raw");
    assert.equal(STORAGE_KEYS.firstWinCelebrated.fallback, "");
    assert.equal(decodeStoredText(STORAGE_KEYS.firstWinCelebrated, "1", () => ""), "1");
    assert.equal(decodeStoredText(STORAGE_KEYS.firstWinCelebrated, '"1"', () => ""), "1");
    assert.equal(decodeStoredText(STORAGE_KEYS.firstWinCelebrated, null, () => ""), "");
  });

  test("the storyteller entries pin the session keys, raw with null fallbacks", () => {
    assert.equal(STORAGE_KEYS.storytellerSessionAutoNarration.key, AUTO_NARRATION_KEY);
    assert.equal(STORAGE_KEYS.storytellerTourReturn.key, TOUR_RETURN_KEY);
    assert.equal(STORAGE_KEYS.storytellerGreetDay.key, GREET_DAY_KEY);
    for (const def of [
      STORAGE_KEYS.storytellerSessionAutoNarration,
      STORAGE_KEYS.storytellerTourReturn,
      STORAGE_KEYS.storytellerGreetDay,
    ]) {
      assert.equal(def.encoding, "raw");
      assert.equal(def.fallback, null);
    }
    assert.equal(
      decodeStoredText(STORAGE_KEYS.storytellerTourReturn, "2026-10-09", () => null),
      "2026-10-09",
    );
    assert.equal(decodeStoredText(STORAGE_KEYS.storytellerGreetDay, null, () => null), null);
  });

  test("the grandpa entries pin the tour keys owned in the registry", () => {
    assert.equal(STORAGE_KEYS.grandpaTourLastDate.key, TOUR_LAST_DATE_KEY);
    assert.equal(STORAGE_KEYS.grandpaWalkedSession.key, WALKED_SESSION_KEY);
    assert.equal(STORAGE_KEYS.grandpaTourLastDate.encoding, "raw");
    assert.equal(STORAGE_KEYS.grandpaTourLastDate.fallback, "");
    assert.equal(STORAGE_KEYS.grandpaWalkedSession.encoding, undefined);
    assert.equal(STORAGE_KEYS.grandpaWalkedSession.fallback, 0);
    assert.equal(decodeStoredText(STORAGE_KEYS.grandpaWalkedSession, "1", () => 0), 1);
    assert.equal(decodeStoredText(STORAGE_KEYS.grandpaWalkedSession, null, () => 0), 0);
    assert.equal(
      decodeStoredText(STORAGE_KEYS.grandpaTourLastDate, "2026-11-21", () => ""),
      "2026-11-21",
    );
  });

  test("the map-mode entries pin the capability keys", () => {
    assert.equal(STORAGE_KEYS.mapMode.key, MAP_MODE_STORAGE_KEY);
    assert.equal(STORAGE_KEYS.mapMode.fallback, null);
    assert.equal(STORAGE_KEYS.mapCrashMarker.key, MAP_CRASH_MARKER_KEY);
    assert.equal(STORAGE_KEYS.mapCrashMarker.fallback, null);
  });

  test("the palette entry pins the preference key, raw with the standard fallback", () => {
    assert.equal(STORAGE_KEYS.palettePreference.key, PALETTE_STORAGE_KEY);
    assert.equal(STORAGE_KEYS.palettePreference.encoding, "raw");
    assert.equal(STORAGE_KEYS.palettePreference.fallback, "standard");
    assert.equal(
      decodeStoredText(STORAGE_KEYS.palettePreference, "high-contrast", () => "standard"),
      "high-contrast",
    );
    assert.equal(
      decodeStoredText(STORAGE_KEYS.palettePreference, '"high-contrast"', () => "standard"),
      "high-contrast",
    );
    assert.equal(
      decodeStoredText(STORAGE_KEYS.palettePreference, null, () => "standard"),
      "standard",
    );
  });

  test("the first-visit seen factory echoes its key and drops non-string ids", () => {
    const def = firstVisitSeenKeyDef("fixture-seen-key");
    assert.equal(def.key, "fixture-seen-key");
    assert.deepEqual(def.fallback, []);
    assert.deepEqual(decodeStoredText(def, '["a",1,"b"]', () => []), ["a", "b"]);
    assert.deepEqual(decodeStoredText(def, "not-json", () => []), []);
    assert.deepEqual(decodeStoredText(def, null, () => []), []);
  });

  test("the pack-shelf entry is the selection key pack-shelf-data reads", () => {
    assert.equal(STORAGE_KEYS.packShelfSelection.key, SHELF_PACK_SHELF_SELECTION_KEY);
  });
});

describe("storage key registry (game-app ports, Part B B1)", () => {
  test("the difficulty entry pins the key game-app writes, raw with the medium fallback", () => {
    // The entry is the source now (game-app reads and writes
    // through it, Part B B3): its bytes are stated here once so
    // an accidental edit to the registry value fails this pin.
    assert.equal(STORAGE_KEYS.difficulty.key, "meridian.difficulty");
    assert.equal(STORAGE_KEYS.difficulty.encoding, "raw");
    assert.equal(STORAGE_KEYS.difficulty.fallback, "medium");
    assert.equal(decodeStoredText(STORAGE_KEYS.difficulty, "hard", () => "medium"), "hard");
    assert.equal(decodeStoredText(STORAGE_KEYS.difficulty, null, () => "medium"), "medium");
  });

  test("the story factory pins game-app's story key builder for a fixture id", () => {
    // The factory is the source now (game-app calls it, Part B
    // B3): its bytes are stated here once so an accidental edit
    // to the factory's key fails this pin.
    const def = storyKeyDef("fixture-place");
    assert.equal(def.key, "meridian.story.fixture-place");
    assert.equal(def.encoding, "raw");
    assert.equal(def.fallback, null);
    assert.equal(decodeStoredText(def, "A story.", () => null), "A story.");
    assert.equal(decodeStoredText(def, null, () => null), null);
  });

  test("the challenge marker factories pin game-app's marker keys for a fixture seed", () => {
    // The factories are the source now (game-app calls them, Part B
    // B2): their bytes are stated here once so an accidental edit to
    // a factory's key fails this pin.
    const recorded = challengeRecordedKeyDef(12345);
    assert.equal(recorded.key, "meridian.challenge.recorded.12345");
    assert.equal(recorded.encoding, "raw");
    assert.equal(recorded.fallback, "");
    const summary = challengeRecordedSummaryKeyDef(12345);
    assert.equal(summary.key, "meridian.challenge.recorded.summary.12345");
    assert.equal(summary.encoding, "raw");
    assert.equal(summary.fallback, "");
  });

  test("the first-visit queue key const is the seen def's key", () => {
    // The const is the source: its bytes are stated here once so
    // an accidental edit to the registry value fails this pin.
    assert.equal(FIRST_VISIT_QUEUE_KEY, "meridian.firstVisitQueue.v1");
    assert.equal(firstVisitSeenKeyDef(FIRST_VISIT_QUEUE_KEY).key, FIRST_VISIT_QUEUE_KEY);
  });

  test("the board page entries pin the v3 preference keys, raw", () => {
    assert.equal(STORAGE_KEYS.boardCalm.key, "meridian-board-v3-calm");
    assert.equal(STORAGE_KEYS.boardCalm.encoding, "raw");
    assert.equal(STORAGE_KEYS.boardCalm.fallback, "");
    assert.equal(decodeStoredText(STORAGE_KEYS.boardCalm, "1", () => ""), "1");
    assert.equal(decodeStoredText(STORAGE_KEYS.boardCalm, '"1"', () => ""), "1");
    assert.equal(STORAGE_KEYS.boardTheme.key, "meridian-board-v3-theme");
    assert.equal(STORAGE_KEYS.boardTheme.encoding, "raw");
    assert.equal(decodeStoredText(STORAGE_KEYS.boardTheme, "dark", () => ""), "dark");
    assert.equal(STORAGE_KEYS.boardSeenClosed.key, "meridian-board-v3-seen-closed");
    assert.equal(STORAGE_KEYS.boardSeenClosed.encoding, "raw");
    assert.equal(STORAGE_KEYS.boardSeenClosed.fallback, null);
    assert.equal(decodeStoredText(STORAGE_KEYS.boardSeenClosed, '["f1"]', () => null), '["f1"]');
    assert.equal(
      decodeStoredText(STORAGE_KEYS.boardSeenClosed, JSON.stringify('["f1"]'), () => null),
      '["f1"]',
    );
    assert.equal(decodeStoredText(STORAGE_KEYS.boardSeenClosed, null, () => null), null);
  });
});
