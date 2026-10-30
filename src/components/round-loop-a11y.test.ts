/**
 * NON-GATING DOCUMENTATION ONLY (manifest §2 Item 3, demoted source-pin).
 *
 * This file gates nothing. The gate for Item 3 is the E2E live-region
 * observer suite in tests/e2e/round-loop-a11y.spec.ts. The zoom-space
 * announce-INTENT count is dropped entirely: intents are not DOM live
 * regions, and a flat region count can stay unchanged while double
 * announcement persists via text changes.
 *
 * Design documented here (post-fix state):
 * - The designated reveal announcer is the GameApp sr-only live paragraph
 *   ("Pin dropped. …" at revealDone). It is the ONLY live region that
 *   changes to a non-empty reveal text during a reveal.
 * - The result-card AI sentence is visible text only (no aria-live).
 * - The satellite-map adapter drops `announce` intents while a reveal
 *   card is up (variation != null), so zoom-space "Hit." / "Showing
 *   your pin and the true spot." never reach the DOM live region during
 *   a reveal. Threshold/region announcements outside reveals are
 *   untouched, and the controller's intent vocabulary is unchanged
 *   (zoom-space.test.ts still pins the intents themselves).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("documentation: result-card AI sentence carries no aria-live", () => {
  const src = read("src/components/result-card.tsx");
  assert.equal(
    /aria-live/.test(src),
    false,
    "result-card must not own a live region; the GameApp paragraph is the designated reveal announcer",
  );
});

test("documentation: satellite-map adapter silences announces during a reveal", () => {
  const src = read("src/map/satellite-map.tsx");
  assert.match(
    src,
    /case "announce"/,
    "adapter still handles announce intents outside reveals",
  );
  assert.match(
    src,
    /variationRef\.current/,
    "adapter gates announce intents on the live reveal state",
  );
});
