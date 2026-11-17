/**
 * Stream W item pins (UI/UX consistency fix, Phase 2):
 * - Item 15: the result band's "used in" line reads as a real
 *   sentence for every useElsewhere shape, fallback included.
 * - Item 17: the band counts themselves. Measured root cause: the
 *   count and the band filter are both correct — Math deals 22 /
 *   28 / 3 cases across the three bands, and pickerRows reports
 *   exactly those numbers. The live symptom ("28 in every band")
 *   came from the picker's band state going stale: GameApp passes
 *   bandChangeRunInProgress={run !== null || loopOpen}, so with a
 *   GeoDetective case left open, saveBand defers the change event
 *   to a round boundary and the picker never re-deals. That cure
 *   lives in the picker's host wiring (frozen / Stream N files)
 *   and is specified in docs/branch-status/fix-ui-why-learn-layout.md;
 *   these tests pin the half that lives here — the numbers a
 *   correctly-synced picker must show.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { usedInLine } from "./used-in-line.ts";
import { pickerRows } from "./picker-rows.ts";
import mathModule from "../math/index.ts";
import { itemsForGroup } from "../math/items.ts";

describe("item 15 — usedInLine", () => {
  it("frames an '<area>: <example>' value as real life", () => {
    assert.equal(
      usedInLine(["economics: counting out change in coins by 5s and 10s"]),
      "You just used this in real life: counting out change in coins by 5s and 10s.",
    );
  });

  it("lets a full-sentence value stand as its own sentence", () => {
    assert.equal(
      usedInLine(["Everyday reasoning about places and time."]),
      "You just used this. Everyday reasoning about places and time.",
    );
  });

  it("completes the line for a bare phrase", () => {
    assert.equal(usedInLine(["the kitchen"]), "You just used this in the kitchen.");
  });

  it("reads as a sentence when nothing is authored", () => {
    const line = usedInLine([]);
    assert.ok(line.startsWith("You just used this in everyday life"));
    assert.ok(line.endsWith("."));
    assert.ok(!line.includes("…"), "no placeholder ellipsis");
  });

  it("never doubles the full stop", () => {
    for (const value of [["geography: reading a map."], ["sports."], ["chess"]]) {
      assert.ok(!usedInLine(value).endsWith(".."), JSON.stringify(value));
    }
  });
});

describe("item 17 — band counts are per-band, in the data and in the picker rows", () => {
  const expected = { "7-10": 22, "10-18": 28, "18+": 3 } as const;

  it("itemsForGroup deals a different count per band", () => {
    for (const band of ["7-10", "10-18", "18+"] as const) {
      assert.equal(itemsForGroup(band).length, expected[band], `math ${band}`);
    }
  });

  it("pickerRows reports the same per-band counts", () => {
    for (const band of ["7-10", "10-18", "18+"] as const) {
      const row = pickerRows([mathModule], band).find((r) => r.id === "math");
      assert.equal(row?.caseCount, expected[band], `picker math ${band}`);
    }
  });
});
