import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Item 26's behaviour, pinned the way this repo pins render behaviour
 * its unit harness cannot mount (the .tsx layer is not importable by
 * the strip-types runner — same pattern as the depthTest pin in
 * status-core.test.ts): a story group with zero entries renders NO
 * row at all. If empty-group rendering ever returns — the early
 * return removed, or an empty line rendered inside the section —
 * these assertions fail.
 */
const trailView = readFileSync(new URL("./trail-view.tsx", import.meta.url), "utf8");

describe("trail view story groups (item 26)", () => {
  it("an empty group is skipped before its section is created", () => {
    const mapAt = trailView.indexOf("GROUP_ORDER.map");
    const skipAt = trailView.indexOf("if (stories.length === 0) return null;");
    const sectionAt = trailView.indexOf('data-testid="v3-story-group"');
    assert.ok(mapAt >= 0, "the group map is gone — the pin cannot see the render");
    assert.ok(skipAt > mapAt, "the empty-group early return is missing from the group map");
    assert.ok(sectionAt > skipAt, "the group section is created before the empty check");
  });

  it("no empty-group line is rendered anywhere in the trail view", () => {
    assert.ok(!trailView.includes("v3-group-empty"), "an empty-group line is rendered");
    assert.ok(!trailView.includes("GROUP_EMPTY"), "the empty-group copy table is back");
    assert.ok(!trailView.includes("Nothing waiting right now"), "the Blocked empty line is back");
  });
});
