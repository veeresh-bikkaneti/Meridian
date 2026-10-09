import assert from "node:assert/strict";
import test from "node:test";
import { directionalHint } from "./hint-logic.ts";
import {
  canUseHint,
  hintButtonState,
  mascotOffersHint,
} from "../game/age-profile/run-config.ts";

test("directionalHint points north for a northern place", () => {
  const bounds: [number, number, number, number] = [-125, 25, -66, 49];
  assert.ok(directionalHint(-100, 45, bounds).includes("northern"));
});

test("directionalHint points south for a southern place", () => {
  const bounds: [number, number, number, number] = [-125, 25, -66, 49];
  assert.ok(directionalHint(-100, 28, bounds).includes("southern"));
});

test("directionalHint picks the stronger axis for east/west", () => {
  const bounds: [number, number, number, number] = [-125, 25, -66, 49];
  assert.ok(directionalHint(-70, 37, bounds).includes("eastern"));
  assert.ok(directionalHint(-120, 37, bounds).includes("western"));
});

test("5-7 free: button always enabled", () => {
  assert.equal(hintButtonState("free", 0), "enabled");
  assert.equal(hintButtonState("free", 5), "enabled");
  assert.equal(canUseHint("free", 3), true);
});

test("8-10 one-per-round: disables after one use", () => {
  assert.equal(hintButtonState("one-per-round", 0), "enabled");
  assert.equal(hintButtonState("one-per-round", 1), "disabled-used");
  assert.equal(canUseHint("one-per-round", 1), false);
});

test("11-13 none: button hidden", () => {
  assert.equal(hintButtonState("none", 0), "hidden");
  assert.equal(canUseHint("none", 0), false);
});

test("mascot offers after 2 misses (5-7 only)", () => {
  assert.equal(mascotOffersHint("free", 2), true);
  assert.equal(mascotOffersHint("free", 1), false);
  assert.equal(mascotOffersHint("one-per-round", 5), false);
  assert.equal(mascotOffersHint("none", 5), false);
});
