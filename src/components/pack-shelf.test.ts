/**
 * Pack shelf: source pins (this repo has no React render harness; the
 * behavioral half rides pack-shelf-data.test.ts and the E2E spec).
 *
 * Pins:
 * - Chips are real buttons with pressed state and a target area above
 *   the 44px floor.
 * - The pick is stored before the next case starts, so the deal path
 *   reads the new deck (slice 1 integration contract).
 * - Both edition screens mount the shelf and hand it their own
 *   next-case handler.
 * - Locked and home surfaces gain no pack shelf: LockedLoop stays
 *   pack-free and game-app.tsx (Track A's card region) is untouched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const shelf = read("pack-shelf.tsx");
const loopScreen = read("../game/loop/LoopScreen.tsx");
const trailScreen = read("../game/coldtrail/TrailScreen.tsx");
const lockedLoop = read("age-profile/LockedLoop.tsx");
const gameApp = read("game-app.tsx");

describe("PackShelf chips are real, labelled buttons", () => {
  it("renders buttons with type, pressed state, and test ids", () => {
    assert.ok(shelf.includes("<button"), "chips are <button> elements");
    assert.ok(shelf.includes('type="button"'), "explicit button type");
    assert.ok(shelf.includes("aria-pressed={isSelected}"), "pressed state is exposed");
    assert.ok(shelf.includes("pack-chip-"), "per-deck test ids");
    assert.ok(shelf.includes('data-testid="pack-shelf"'), "shelf test id");
    assert.ok(shelf.includes('aria-label="Case decks"'), "the shelf is a labelled section");
  });

  it("keeps chip targets above the 44px floor", () => {
    assert.ok(shelf.includes("min-h-[58px]"), "chip height 58px");
    assert.ok(shelf.includes("min-w-[44px]"), "chip min width 44px");
  });

  it("reserves its height so a late pack chip shifts nothing", () => {
    assert.ok(shelf.includes("min-h-[58px] flex-wrap"), "chip row reserves one row of height");
    assert.ok(shelf.includes("max-[340px]:min-h-[124px]"), "chip row reserves the wrapped second row at narrow widths");
    assert.ok(shelf.includes("min-h-[20px]"), "status line reserves one line of height");
  });

  it("announces the pick consequence to screen readers", () => {
    assert.ok(shelf.includes('role="status"'), "status line is a live region");
  });
});

describe("PackShelf tap contract", () => {
  it("stores the pick before starting the next case", () => {
    const storeAt = shelf.indexOf("onPickDeck(deckId)");
    const startAt = shelf.indexOf("if (caseFinished) onStartNext()");
    assert.ok(storeAt >= 0 && startAt >= 0, "both halves of the tap handler exist");
    assert.ok(storeAt < startAt, "selection is stored before the deal reads it");
  });

  it("explains a mid-play pick instead of changing the open case", () => {
    assert.ok(
      shelf.includes("Your next case comes from"),
      "status line names the deck the next case comes from",
    );
    assert.ok(
      shelf.includes("Tap a deck chip to start your next case."),
      "finished case: chips are the start control",
    );
  });
});

describe("screen mounts", () => {
  it("LoopScreen mounts the shelf for GeoDetective with its next-case handler", () => {
    assert.ok(loopScreen.includes("<PackShelf"), "shelf mounted");
    assert.ok(loopScreen.includes('edition="geodetective"'), "edition wired");
    assert.ok(loopScreen.includes("onStartNext={onNextMystery}"), "deals through onNextMystery");
    const headerEnd = loopScreen.indexOf("</header>");
    const shelfAt = loopScreen.indexOf("<PackShelf");
    assert.ok(headerEnd >= 0 && shelfAt > headerEnd, "shelf sits under the screen header");
  });

  it("TrailScreen mounts the shelf for Cold Trail with its next-case handler", () => {
    assert.ok(trailScreen.includes("<PackShelf"), "shelf mounted");
    assert.ok(trailScreen.includes('edition="coldtrail"'), "edition wired");
    assert.ok(trailScreen.includes("onStartNext={onNextCase}"), "deals through onNextCase");
    const headerEnd = trailScreen.indexOf("</header>");
    const shelfAt = trailScreen.indexOf("<PackShelf");
    assert.ok(headerEnd >= 0 && shelfAt > headerEnd, "shelf sits under the screen header");
  });
});

describe("one deck signal on the GeoDetective case screen (#336 owner cure)", () => {
  it("LoopScreen speaks in one plain sentence, not a Deck: header", () => {
    assert.ok(
      loopScreen.includes("This case is from your"),
      "healthy pack case: the sentence names the player's pack deck",
    );
    assert.ok(
      loopScreen.includes('"This case is from All cases."'),
      "healthy core case: the sentence names All cases",
    );
    assert.ok(
      loopScreen.includes("couldn’t load just now — this case is from All cases instead."),
      "fallback case: the same spot carries the fallback notice instead",
    );
    assert.ok(!loopScreen.includes("Deck: {"), "the old Deck: header label is gone");
    assert.ok(
      loopScreen.includes('data-testid="case-source-line"'),
      "the sentence has one stable home on the screen",
    );
  });

  it("the shelf line stays quiet while the fallback notice speaks", () => {
    assert.ok(shelf.includes("statusLineSuppressed"), "shelf accepts the suppression prop");
    assert.ok(
      loopScreen.includes("statusLineSuppressed={deckFallbackNotice !== null}"),
      "LoopScreen suppresses the shelf line exactly while a fallback notice is up",
    );
  });
});

describe("surfaces that must stay pack-free", () => {
  it("LockedLoop gains no pack surface", () => {
    assert.ok(!lockedLoop.includes("PackShelf"), "locked tile has no shelf");
    assert.ok(!lockedLoop.includes("pack-shelf"), "locked tile has no shelf import");
  });

  it("game-app.tsx renders no shelf (the doorway is not a shelf)", () => {
    // The original slice kept every pack surface out of game-app.
    // Issue #344 ratified ONE home surface — the Capitals & Flags
    // doorway strip, a signpost only since the owner's pick
    // (Veeresh, 2026-11-05: "Option C — signpost only, no buttons"):
    // game-app renders the strip and no longer imports any
    // pack-shelf-data helper (the strip owns its own manifest read
    // for its display-only count). What this guard still protects:
    // the PackShelf component itself never renders on Home; deck
    // switching stays inside the two mode screens.
    assert.ok(!gameApp.includes("<PackShelf"), "no shelf component on the home cards");
    assert.ok(
      !gameApp.includes('from "./pack-shelf"'),
      "no shelf component import in game-app",
    );
  });
});
