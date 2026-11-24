/**
 * Test-only names for module resets and counters.
 *
 * The functions live next to the state they touch, under plain names.
 * Tests import the old names from here so production source does not
 * carry a test-only export name.
 */

export { clearReadAloudPrefMemory as __resetReadAloudPrefMemory } from "../../src/game/age-profile/read-aloud-pref.ts";
export { clearAgeProfileMemoryFallback as __resetMemoryFallback } from "../../src/game/age-profile/store.ts";
export { clearDetectiveManifestCache as __resetDetectiveManifestCache } from "../../src/game/loop/detective/detective-audio.ts";
export { clearPassportBadgeMemory as __resetPassportBadgeMemory } from "../../src/game/passport/badges.ts";
export { clearPlayGuardTimes as resetPlayGuards } from "../../src/game/audio/play-guards.ts";
export {
  clearChunkCache as clearChunkCacheForTests,
  loadedGlobeTiers as loadedGlobeTiersForTests,
} from "../../src/game/generated-places.ts";
export { recognizedCountryCount as recognizedCountryCountForTests } from "../../src/game/place-name.ts";
export {
  territoryLoadRuns as territoryLoadRunsForTests,
  setTerritoryImporter as territoryImporterForTests,
  territoryConversionRuns as territoryConversionRunsForTests,
} from "../../src/game/territory.ts";
export {
  admin1LoadRuns as admin1LoadRunsForTests,
  admin1ChunkLoadCounts as admin1ChunkLoadRunsForTests,
  clearAdmin1ChunkCache as clearAdmin1ChunkCacheForTests,
} from "../../src/game/reverse-geocode.ts";
export { clearLoopNameIndex as clearLoopIndexCache } from "../../src/game/loop/evaluate.ts";
export { clearFirstRevealNarration as resetFirstRevealNarrationForTests } from "../../src/components/storyteller-claim.ts";
export { clearStorytellerSession as resetStorytellerSessionForTests } from "../../src/components/storyteller-session.ts";
export { clearObservabilitySingleton as resetObservabilityForTests } from "../../src/lib/observability.ts";
export { currentVoiceOwner } from "../../src/game/audio/voice-channel.ts";
export {
  sharedMemoryLimiter as sharedInMemoryLimiterForTests,
  clearRateLimitBindingLookup as resetRateLimitBindingLookupForTests,
} from "../../src/lib/contact/rate-limiter.server.ts";
export { clearContactHandlerState as resetContactStateForTests } from "../../src/lib/contact/contact-handler.server.ts";
export { clearFeatureRequestState as resetFeatureRequestStateForTests } from "../../src/lib/feature-request/feature-request-handler.server.ts";
