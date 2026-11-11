import assert from "node:assert/strict";
import test from "node:test";
import { missingNameRows, nameVariants } from "./probe-names.mjs";
import { NAME_SPOKEN_OVERRIDES, selectionNamePlan } from "./render-plan.mjs";

test("name variant ladder: planned text first, then shorter forms, no repeats", () => {
  const row = { id: "geonames:1172451", n: "lahore", r: "Pakistan", p: 13004135 };
  assert.deepEqual(nameVariants(row, "Lahore, Pakistan"), [
    "Lahore, Pakistan",
    "Lahore, Pakistan.",
    "Lahore",
    "Lahore.",
    "Lahore. Pakistan.",
  ]);
  const bare = { id: "geonames:1", n: "x", r: "", p: 1 };
  assert.deepEqual(nameVariants(bare, "X"), ["X", "X."]);
});

test("the probe's missing set is at most the 88 refused name reads (handbook FG-4)", () => {
  // Shrinks as overrides render; never grows past the known 88.
  const rows = missingNameRows();
  assert.ok(rows.length <= 88, `${rows.length} missing name reads`);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].p >= rows[i].p);
});

test("spoken overrides only change the TTS text of the ids they name", () => {
  const row = { id: "geonames:1172451", n: "lahore", r: "Pakistan", p: 13004135 };
  const planned = selectionNamePlan(row).text;
  assert.equal(planned, NAME_SPOKEN_OVERRIDES["1172451"] ?? "Lahore, Pakistan");
});
