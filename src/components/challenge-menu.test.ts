/**
 * Step 19 (TD-06.9) — challenge menu source pin.
 *
 * The region picker and the "challenge ready" preview sheet live in
 * challenge-menu.tsx, not in game-app.tsx. The composer keeps the
 * `<main>` shell and the HomeButton (the frozen shell-ban baseline
 * forbids a page-local `<main>` in a new file) and wraps the pick
 * with the card-tap sound. The sheet itself is covered by the
 * friend-challenge E2E pass.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const menuSource = readFileSync(join(here, "challenge-menu.tsx"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 19: challenge menu lives in challenge-menu.tsx", () => {
  it("exports ChallengeMenu with the region picker", () => {
    assert.ok(menuSource.includes("export function ChallengeMenu("));
    assert.ok(menuSource.includes("Challenge a friend"));
    assert.ok(menuSource.includes("CHALLENGE_MIN_PLACES"));
    assert.ok(menuSource.includes('regionRow("globe"'));
    assert.ok(menuSource.includes('regionRow("country"'));
    assert.ok(menuSource.includes('regionRow("state"'));
  });

  it("owns the preview sheet and the heading focus", () => {
    assert.ok(menuSource.includes('data-testid="challenge-preview"'));
    assert.ok(menuSource.includes('data-testid="challenge-share-container"'));
    assert.ok(menuSource.includes("CHALLENGE_FAIRNESS_COPY"));
    assert.ok(menuSource.includes("headingRef.current?.focus({ preventScroll: true })"));
  });

  it("renders no page-local main and imports no HomeButton", () => {
    assert.doesNotMatch(menuSource, /<main[\s>]/);
    assert.doesNotMatch(menuSource, /from "@\/components\/ui\/home-button"/);
  });

  it("the composer keeps the shell, the HomeButton, and the tap sound", () => {
    assert.ok(gameAppSource.includes("<ChallengeMenu"));
    assert.ok(gameAppSource.includes("notice={challengeBootNoticeEl}"));
    assert.ok(gameAppSource.includes("onDismissPreview={() => setChallengePreview(null)}"));
    assert.ok(gameAppSource.includes("playCardTap();"));
    assert.ok(gameAppSource.includes("void pickChallengeRegion(edition, regionId);"));
    assert.doesNotMatch(gameAppSource, /challengeMenuHeadingRef/);
    assert.doesNotMatch(gameAppSource, /challengePreviewEl/);
  });
});
