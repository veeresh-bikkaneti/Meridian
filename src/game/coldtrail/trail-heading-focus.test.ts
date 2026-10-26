/**
 * #211 item 2 — Trail fail-closed heading focus parity (source pin).
 *
 * LoopScreen's heading always carries its ref + tabIndex, so the
 * arrival-focus effect lands focus on every path. TrailScreen's
 * healthy case heading does too — but its FAIL-CLOSED heading (the
 * corrupt/empty-deck early return) was a plain <h1>: the arrival
 * effect's ref pointed at nothing and focus was stranded on <body>
 * for exactly the players already having a bad day. This pin keeps
 * the two headings wired identically; the effect itself needs a
 * browser to observe, so the behavioral half rides the existing
 * Cold Trail E2E suite.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const trailSource = readFileSync(join(here, "TrailScreen.tsx"), "utf8");

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

describe("#211 item 2 — Trail headings carry the arrival-focus wiring on both paths", () => {
  it("the fail-closed heading has the case-heading ref and tabIndex", () => {
    const failClosed = segment(trailSource, "if (!caseData) {", "const ringsPlacedCount");
    assert.ok(
      failClosed.includes('<h1 ref={caseHeadingRef} tabIndex={-1}'),
      "the fail-closed <h1> must carry ref={caseHeadingRef} tabIndex={-1} (#211 item 2)",
    );
  });

  it("control: the healthy case heading keeps the same wiring, and the arrival effect targets it", () => {
    assert.ok(
      trailSource.includes('<h1 ref={caseHeadingRef} tabIndex={-1} className="mode-title mt-1 text-3xl text-fg">'),
      "the healthy case heading must keep ref + tabIndex (parity control)",
    );
    const arrival = segment(trailSource, "// Arrival focus (PR #203 panel)", "// One-time notice");
    assert.ok(
      arrival.includes("el.focus()"),
      "the arrival-focus effect must focus the case heading on mount",
    );
  });
});
