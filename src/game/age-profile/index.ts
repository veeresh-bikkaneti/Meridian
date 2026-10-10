/**
 * age-profile/index.ts — the module's public facade.
 *
 * Game screens import from `@/game/age-profile` (this file) ONLY.
 * The store is deliberately NOT re-exported whole: screens get the
 * read-side (`resolveBand`, `loadProfile`, param getters) and the event
 * subscription, but mutations (setBand / saveBand / resetProfile)
 * stay inside the grown-up-gated UI. This keeps parent-control writes
 * behind the gate by construction.
 */

export type {
  AgeBandId,
  AgeBand,
  AgeProfile,
  LadderRung,
  LoopId,
  MappedStory,
  PlaceFacts,
  ProfileStatus,
  StoryRung,
  AudioMode,
  AgeProfileChangedEvent,
} from "./types.ts";

export { AGE_BANDS, AGE_BAND_IDS, ALL_LOOPS, FULL_ACCESS_BAND, getBand, bandHasLoop } from "./bands.ts";

export { mapStory, rungCeiling, rungIndex, RUNG_ORDER, HOOK_MIN_CHARS } from "./rungs.ts";

export {
  toleranceMultiplier,
  pinToleranceKm,
  geodetectiveConfig,
  maxGuessCap,
  roundLengths,
  audioMode,
  mapLabelDensity,
  distanceDisplayStyle,
  loopsForBand,
  isLoopLocked,
  bandScoreMultiplier,
  type GeoDetectiveConfig,
  type RoundLengths,
  type PinEdition,
} from "./difficulty.ts";

export {
  getBandConfig,
  isBandRunConfig,
  hintButtonState,
  canUseHint,
  mascotOffersHint,
  type BandRunConfig,
  type HintPolicy,
  type HintButtonState,
} from "./run-config.ts";

export {
  AGE_PROFILE_CHANGED,
  onAgeProfileChanged,
  type AgeProfileEventListener,
} from "./events.ts";

// Read-side store access. Parent-control mutations (setBand, saveBand,
// resetProfile) are NOT re-exported: only the gate-walled settings UI
// may call them.
export {
  PROFILE_STORAGE_KEY,
  PROFILE_SCHEMA_VERSION,
  loadProfile,
  resolveBand,
  validateProfile,
} from "./store.ts";
// Boundary-only event path. Game screens call this at card/round
// boundaries to fire a DEFERRED mid-run save's change event (the save
// itself wrote immediately). It is a no-op unless a save is deferred.
export { applyPendingAtBoundary } from "./store.ts";
