/**
 * Step 9 (TD-06.9) — challenge surface source pin.
 *
 * The receive/preview state and the commit-on-action callbacks live
 * in use-challenge-surface.ts, not in game-app.tsx. GameApp calls
 * the hook, and the router hook keeps receiving the two setters
 * from it. This file pins that wiring in the repo's source-pin
 * style (the hook's import graph is the game domain, which bare
 * node:test cannot resolve; the flows themselves are covered by
 * the friend-challenge E2E pass).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hookSource = readFileSync(join(here, "use-challenge-surface.ts"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 9: challenge surface lives in use-challenge-surface", () => {
  it("exports useChallengeSurface owning the receive/preview state", () => {
    assert.ok(hookSource.includes("export function useChallengeSurface("));
    assert.ok(hookSource.includes("const [challengeBootNotice, setChallengeBootNotice]"));
    assert.ok(hookSource.includes("const [pendingChallenge, setPendingChallenge]"));
    assert.ok(hookSource.includes("const [friendChallengesOn, setFriendChallengesOn]"));
    assert.ok(hookSource.includes("const [challengePreview, setChallengePreview]"));
    assert.ok(hookSource.includes("const [challengePickError, setChallengePickError]"));
  });

  it("owns the commit-on-action and picker callbacks", () => {
    assert.ok(hookSource.includes("const startPendingChallenge = useCallback("));
    assert.ok(hookSource.includes("const handleChallengeDone = useCallback("));
    assert.ok(hookSource.includes("const openChallengePicker = useCallback("));
    assert.ok(hookSource.includes("const pickChallengeRegion = useCallback("));
    assert.ok(hookSource.includes("const handleReviewChallenge = useCallback("));
  });

  it("Start still commits the route and retires the other format's slot", () => {
    assert.ok(hookSource.includes("challengeRunFields(route)"));
    assert.ok(hookSource.includes('if (fields.challengeOrigin === "mc3") clearMc2Run();'));
    assert.ok(hookSource.includes('if (fields.challengeOrigin === "mc2") clearMc3Run();'));
    assert.ok(hookSource.includes("commit(run);"));
    assert.ok(hookSource.includes("setPendingChallenge(null);"));
  });

  it("the picker still deals a fresh 5 from the region's own catalog", () => {
    assert.ok(hookSource.includes("placesFor(edition, regionId, undefined, false)"));
    assert.ok(hookSource.includes("buildCreationSources({ catalog, choice: difficultyChoice, seenIds })"));
    assert.ok(hookSource.includes("dealSeed: mintSeed()"));
    assert.ok(hookSource.includes("setChallengePreview({ creation, edition, regionId })"));
  });

  it("the review-challenge tap still re-reads the flag click-atomically", () => {
    assert.ok(hookSource.includes('isEnabled("friendChallenges") ? { kind: "challengeRegions" } : null'));
  });

  it("GameApp calls the hook and passes its setters to the router", () => {
    assert.ok(gameAppSource.includes("useChallengeSurface({"));
    assert.ok(gameAppSource.includes("setChallengeBootNotice,"));
    assert.ok(gameAppSource.includes("setPendingChallenge,"));
  });

  it("GameApp no longer defines the challenge state or callbacks itself", () => {
    assert.doesNotMatch(gameAppSource, /const \[challengeBootNotice, setChallengeBootNotice\]/);
    assert.doesNotMatch(gameAppSource, /const \[pendingChallenge, setPendingChallenge\]/);
    assert.doesNotMatch(gameAppSource, /const startPendingChallenge = useCallback/);
    assert.doesNotMatch(gameAppSource, /const handleChallengeDone = useCallback/);
    assert.doesNotMatch(gameAppSource, /const pickChallengeRegion = useCallback/);
    assert.doesNotMatch(gameAppSource, /const handleReviewChallenge = useCallback/);
  });
});
