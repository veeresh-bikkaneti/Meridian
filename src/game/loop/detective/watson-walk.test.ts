/**
 * watson-walk.test.ts — pins for PR B's pure walk arithmetic:
 * the gutter derivation (unit 3), the station chip offsets
 * (carry-in c, including the Holmes-alone branch PR A left
 * unpinned), the walk duration band (council Q3), and the
 * announcement gate (case-open only, session cap 2, auto only).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ANNOUNCEMENT_SESSION_CAP,
  CASE_OPEN_WALK_MS,
  CHIP_CLEAR_PX,
  GUTTER_BELOW_FIGURE_PX,
  GUTTER_CARD_GAP_PX,
  GUTTER_CHIP_BELOW_LISTEN_PX,
  GUTTER_EDGE_CLEAR_PX,
  GUTTER_W_PX,
  HOLMES_FIGURE_W_PX,
  LISTEN_BUTTON_H_PX,
  STATION_FIGURE_H_PX,
  STATION_GAP_PX,
  WATSON_FIGURE_W_PX,
  WATSON_WALK_MAX_MS,
  WATSON_WALK_MIN_MS,
  shouldAnnounce,
  stationChipOffsetPx,
  stationHolmesOffsetPx,
  watsonWalkDurationMs,
} from "./watson-walk.ts";

describe("gutter derivation (PR B unit 3)", () => {
  test("the shipped 118 is 6 card gap + 100 figure + 12 edge clear", () => {
    assert.equal(GUTTER_CARD_GAP_PX, 6);
    assert.equal(WATSON_FIGURE_W_PX, 100);
    assert.equal(GUTTER_EDGE_CLEAR_PX, 12);
    assert.equal(GUTTER_W_PX, 118);
    assert.equal(
      GUTTER_W_PX,
      GUTTER_CARD_GAP_PX + WATSON_FIGURE_W_PX + GUTTER_EDGE_CLEAR_PX,
    );
  });

  test("the council's 112 would leave only 6 px of edge clear", () => {
    // The reconciliation, as arithmetic: at 112 the figure + card
    // gap consume 106, leaving half the standard 12 px edge clear.
    assert.equal(112 - GUTTER_CARD_GAP_PX - WATSON_FIGURE_W_PX, 6);
    assert.ok(6 < GUTTER_EDGE_CLEAR_PX);
  });

  test("below-figure row is the old +62, derived (52 + 10)", () => {
    assert.equal(STATION_FIGURE_H_PX, 104);
    assert.equal(GUTTER_BELOW_FIGURE_PX, 62);
    assert.equal(GUTTER_BELOW_FIGURE_PX, STATION_FIGURE_H_PX / 2 + 10);
  });

  test("chip-below-Listen row is the old +118, derived (62 + 48 + 8)", () => {
    assert.equal(LISTEN_BUTTON_H_PX, 48);
    assert.equal(GUTTER_CHIP_BELOW_LISTEN_PX, 118);
    assert.equal(
      GUTTER_CHIP_BELOW_LISTEN_PX,
      GUTTER_BELOW_FIGURE_PX + LISTEN_BUTTON_H_PX + CHIP_CLEAR_PX,
    );
  });
});

describe("station offsets (carry-in c)", () => {
  const base = {
    celebrating: false,
    celebrateClusterW: 147,
    watsonAtStation: false,
    holmesAtStation: false,
  };

  test("Watson + Holmes: chip clears both figures (100 + 4 + 70 + 8 = 182)", () => {
    assert.equal(
      stationChipOffsetPx({ ...base, watsonAtStation: true, holmesAtStation: true }),
      182,
    );
  });

  test("Watson alone: chip clears Watson (100 + 8 = 108)", () => {
    assert.equal(stationChipOffsetPx({ ...base, watsonAtStation: true }), 108);
  });

  test("Holmes alone: the latent branch is 70 + 8 = 78, pinned", () => {
    assert.equal(HOLMES_FIGURE_W_PX, 70);
    assert.equal(stationChipOffsetPx({ ...base, holmesAtStation: true }), 78);
    assert.equal(
      stationChipOffsetPx({ ...base, holmesAtStation: true }),
      HOLMES_FIGURE_W_PX + CHIP_CLEAR_PX,
    );
  });

  test("celebrating: chip clears the whole celebrate cluster", () => {
    assert.equal(
      stationChipOffsetPx({ ...base, celebrating: true, watsonAtStation: true, holmesAtStation: true }),
      147 + CHIP_CLEAR_PX,
    );
  });

  test("Holmes's station offset: beside Watson, else the origin", () => {
    assert.equal(STATION_GAP_PX, 4);
    assert.equal(
      stationHolmesOffsetPx({ celebrating: false, watsonAtStation: true }),
      WATSON_FIGURE_W_PX + STATION_GAP_PX,
    );
    assert.equal(stationHolmesOffsetPx({ celebrating: false, watsonAtStation: false }), 0);
    assert.equal(stationHolmesOffsetPx({ celebrating: true, watsonAtStation: true }), 0);
  });
});

describe("walk duration (council Q3: 0.6–1.0 s, distance-capped)", () => {
  test("short hops take the 600 ms floor", () => {
    assert.equal(watsonWalkDurationMs(0), WATSON_WALK_MIN_MS);
    assert.equal(watsonWalkDurationMs(120), WATSON_WALK_MIN_MS);
  });

  test("mid distances run at ~260 px/s", () => {
    assert.equal(watsonWalkDurationMs(195), 750);
  });

  test("long travels cap at 1000 ms, sign-free", () => {
    assert.equal(watsonWalkDurationMs(600), WATSON_WALK_MAX_MS);
    assert.equal(watsonWalkDurationMs(-600), WATSON_WALK_MAX_MS);
    assert.equal(watsonWalkDurationMs(-195), 750);
  });

  test("the case-open walk sits inside the band", () => {
    assert.ok(CASE_OPEN_WALK_MS >= WATSON_WALK_MIN_MS);
    assert.ok(CASE_OPEN_WALK_MS <= WATSON_WALK_MAX_MS);
  });
});

describe("announcement gate (council Q3)", () => {
  test("case-open walk, cap room, auto mode: announce", () => {
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: true, announcedThisSession: 0, speechMode: "auto" }),
      true,
    );
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: true, announcedThisSession: 1, speechMode: "auto" }),
      true,
    );
  });

  test("the session cap is 2 — the third case-open walk is silent", () => {
    assert.equal(ANNOUNCEMENT_SESSION_CAP, 2);
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: true, announcedThisSession: 2, speechMode: "auto" }),
      false,
    );
  });

  test("clue 2+ walks never announce", () => {
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: false, announcedThisSession: 0, speechMode: "auto" }),
      false,
    );
  });

  test("tap / off modes never announce (nothing would be heard)", () => {
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: true, announcedThisSession: 0, speechMode: "tap" }),
      false,
    );
    assert.equal(
      shouldAnnounce({ isCaseOpenWalk: true, announcedThisSession: 0, speechMode: "off" }),
      false,
    );
  });
});
