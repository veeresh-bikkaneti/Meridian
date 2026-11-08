import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDetectiveHostProps,
  DETECTIVE_HOST_PROP_KEYS,
} from "./detective-host-props.ts";

/**
 * The props-shape gate (BUILD-SCOPE §2.3): the pair's props are built in
 * exactly one place, from a whitelist. If a future change smuggles the
 * puzzle, a target, or an evaluation into the host, this test fails.
 */

const BENIGN = {
  caseIndex: 387,
  cluesRevealed: 3,
  status: "playing" as const,
  sheetOpen: false,
  lastGuessPlaceId: null,
  freshDeal: false,
  answerPlaceId: null,
};

test("builder returns exactly the whitelisted keys, in order", () => {
  const props = buildDetectiveHostProps(BENIGN);
  assert.deepEqual(Object.keys(props), [...DETECTIVE_HOST_PROP_KEYS]);
  assert.deepEqual(props, BENIGN);
});

test("builder drops every non-whitelisted key a caller tries to add", () => {
  const smuggled = {
    ...BENIGN,
    target: { lon: 1, lat: 2 },
    puzzle: { guesses: [] },
    clue: { clues: ["a", "b", "c", "d", "e"] },
    guesses: [{ placeId: "geonames:1", distKm: 0 }],
    evaluation: { correct: true },
    placeId: "geonames:999",
  } as unknown as typeof BENIGN;
  const props = buildDetectiveHostProps(smuggled);
  assert.deepEqual(Object.keys(props), [...DETECTIVE_HOST_PROP_KEYS]);
  const json = JSON.stringify(props);
  for (const forbidden of ["target", "puzzle", "evaluation", "distKm", "guesses"]) {
    assert.ok(!json.includes(forbidden), `props carry no ${forbidden}`);
  }
});

test("values pass through untouched (status, pick id, sheet flag)", () => {
  const props = buildDetectiveHostProps({
    caseIndex: 42,
    cluesRevealed: 5,
    status: "won",
    sheetOpen: true,
    lastGuessPlaceId: "geonames:323786",
    freshDeal: true,
    answerPlaceId: "geonames:323786",
  });
  assert.equal(props.caseIndex, 42);
  assert.equal(props.cluesRevealed, 5);
  assert.equal(props.status, "won");
  assert.equal(props.sheetOpen, true);
  // The pick id is the player's OWN input, echoed for the selection read.
  assert.equal(props.lastGuessPlaceId, "geonames:323786");
  assert.equal(props.freshDeal, true);
});

test("U8 whitelist: answerPlaceId crosses ONLY on the post-solve reveal — null while playing or lost, whatever the caller passes", () => {
  // Playing: even a caller that (wrongly) supplies the answer's id
  // cannot smuggle it across — the builder derives from status.
  const playing = buildDetectiveHostProps({
    ...BENIGN,
    status: "playing",
    answerPlaceId: "geonames:5505411",
  });
  assert.equal(playing.answerPlaceId, null);
  // Lost: the debrief is solve-only, so the id stays home here too.
  const lost = buildDetectiveHostProps({
    ...BENIGN,
    status: "lost",
    answerPlaceId: "geonames:5505411",
  });
  assert.equal(lost.answerPlaceId, null);
  // Won: the game has revealed the answer on screen; the id may cross
  // for the debrief's name read, and only then.
  const won = buildDetectiveHostProps({
    ...BENIGN,
    status: "won",
    answerPlaceId: "geonames:5505411",
  });
  assert.equal(won.answerPlaceId, "geonames:5505411");
  // The whitelist grew by exactly the two U8 fields, nothing else.
  assert.deepEqual(Object.keys(won), [
    "caseIndex",
    "cluesRevealed",
    "status",
    "sheetOpen",
    "lastGuessPlaceId",
    "freshDeal",
    "answerPlaceId",
  ]);
});
