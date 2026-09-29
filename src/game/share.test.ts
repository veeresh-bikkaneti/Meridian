import assert from "node:assert/strict";
import test from "node:test";
import { shareText } from "./share.ts";

const now = new Date(Date.UTC(2026, 8, 28));

test("share text is the region and the hit count", () => {
  assert.equal(
    shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 14, now }),
    "meridian September 28\nNebraska · 14",
  );
  assert.equal(
    shareText({ regionName: "Japan", dateKey: "2026-09-28", hits: 9, now }),
    "meridian September 28\nJapan · 9",
  );
  assert.equal(
    shareText({ regionName: "Globe", dateKey: "2026-09-28", hits: 6, now }),
    "meridian September 28\nGlobe · 6",
  );
  assert.equal(
    shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 0, now }),
    "meridian September 28\nNebraska · 0",
  );
  assert.equal(
    shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 14, now }).includes("Capitol"),
    false,
  );
});
