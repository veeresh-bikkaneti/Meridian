import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loopDateKey, loopDayIndex, loopNowFromSearch } from "./day.ts";

test("loopDayIndex matches Math.floor(ms/86400000) % poolSize", () => {
  const now = new Date("2026-10-02T12:34:56Z");
  assert.equal(loopDayIndex(now, 365), Math.floor(now.getTime() / 86400000) % 365);
  assert.equal(loopDayIndex(now, 1), 0);
});

test("loopDayIndex advances exactly one slot per UTC day", () => {
  const a = loopDayIndex(new Date("2026-10-02T23:59:59Z"), 1000);
  const b = loopDayIndex(new Date("2026-10-03T00:00:00Z"), 1000);
  assert.equal(b, (a + 1) % 1000);
});

test("loopDayIndex throws on a non-positive pool size", () => {
  assert.throws(() => loopDayIndex(new Date(), 0), /poolSize/);
  assert.throws(() => loopDayIndex(new Date(), -3), /poolSize/);
});

test("loopDateKey is the UTC calendar date", () => {
  // 02:30 in +05:30 is still Oct 1 in UTC.
  assert.equal(loopDateKey(new Date("2026-10-01T21:00:00Z")), "2026-10-01");
  assert.equal(loopDateKey(new Date("2026-10-02T00:30:00+05:30")), "2026-10-01");
  assert.equal(loopDateKey(new Date("2026-10-02T12:00:00Z")), "2026-10-02");
});

test("loopNowFromSearch: valid YYYY-MM-DD forces that UTC day", () => {
  const at = loopNowFromSearch("?loop-date=2026-10-02");
  assert.ok(at instanceof Date);
  assert.equal(loopDateKey(at), "2026-10-02");
  assert.equal(loopDayIndex(at!, 500), Math.floor(at!.getTime() / 86400000) % 500);
});

test("loopNowFromSearch: inert without the param or with garbage", () => {
  assert.equal(loopNowFromSearch(""), null);
  assert.equal(loopNowFromSearch("?foo=bar"), null);
  assert.equal(loopNowFromSearch("?loop-date="), null);
  assert.equal(loopNowFromSearch("?loop-date=today"), null);
  assert.equal(loopNowFromSearch("?loop-date=10-02-2026"), null);
  // Rollover dates Date would silently normalize are rejected.
  assert.equal(loopNowFromSearch("?loop-date=2026-02-30"), null);
  assert.equal(loopNowFromSearch("?loop-date=2026-13-01"), null);
});
