import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readScreenState,
  screenStateFor,
  screenForRunPhase,
  sameScreenState,
  type ScreenState,
} from "./screen-history.ts";

test("readScreenState: accepts the menu-less screens", () => {
  for (const screen of ["home", "round", "result"] as const) {
    assert.deepEqual(readScreenState({ meridianScreen: screen }), { screen });
  }
});

test("readScreenState: round-trips a picker menu snapshot", () => {
  const state = screenStateFor("picker", {
    kind: "admin1",
    countryId: "US",
    countryName: "United States",
    from: "states",
  });
  assert.deepEqual(readScreenState(state), {
    screen: "picker",
    menu: { kind: "admin1", countryId: "US", countryName: "United States", from: "states" },
  });
});

test("readScreenState: list menus need no extra fields", () => {
  assert.deepEqual(readScreenState(screenStateFor("picker", { kind: "countries" })), {
    screen: "picker",
    menu: { kind: "countries" },
  });
  assert.deepEqual(readScreenState(screenStateFor("picker", { kind: "states" })), {
    screen: "picker",
    menu: { kind: "states" },
  });
});

test("readScreenState: rejects garbage and foreign states", () => {
  assert.equal(readScreenState(null), null);
  assert.equal(readScreenState(undefined), null);
  assert.equal(readScreenState("picker"), null);
  assert.equal(readScreenState({}), null);
  assert.equal(readScreenState({ meridianScreen: "nope" }), null);
  assert.equal(readScreenState({ meridianScreen: "picker" }), null); // picker without a menu
  assert.equal(
    readScreenState({ meridianScreen: "picker", menu: { kind: "admin1" } }),
    null,
  ); // admin1 without its country fields
  assert.equal(
    readScreenState({ meridianScreen: "picker", menu: { kind: "admin1", countryId: "US", countryName: "United States", from: "mars" } }),
    null,
  );
});

test("readScreenState: non-picker screens ignore a stray menu", () => {
  assert.deepEqual(
    readScreenState({ meridianScreen: "home", menu: { kind: "countries" } }),
    { screen: "home" },
  );
});

test("screenForRunPhase: only the summary is the result screen", () => {
  assert.equal(screenForRunPhase("summary"), "result");
  assert.equal(screenForRunPhase("aim"), "round");
  assert.equal(screenForRunPhase("story"), "round");
  assert.equal(screenForRunPhase("done"), "round");
});

test("sameScreenState: screen and menu both count", () => {
  const a: ScreenState = { screen: "picker", menu: { kind: "countries" } };
  assert.equal(sameScreenState(a, { screen: "picker", menu: { kind: "countries" } }), true);
  assert.equal(sameScreenState(a, { screen: "picker", menu: { kind: "states" } }), false);
  assert.equal(sameScreenState(a, { screen: "home" }), false);
  assert.equal(sameScreenState({ screen: "home" }, { screen: "home" }), true);
  assert.equal(
    sameScreenState(
      { screen: "picker", menu: { kind: "admin1", countryId: "US", countryName: "United States", from: "states" } },
      { screen: "picker", menu: { kind: "admin1", countryId: "US", countryName: "United States", from: "countries" } },
    ),
    false,
  );
});
