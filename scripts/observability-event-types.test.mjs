/**
 * Observability event-type drift guard (#194 wave 2).
 *
 * The client (src/lib/observability.ts) posts every event type it can
 * emit to the crash-report worker, and the worker
 * (workers/crash-report/src/index.ts) only accepts the types in its
 * EVENT_TYPES list. When the two lists disagree, the extra types are
 * answered 400 and silently dropped — that is exactly how the six
 * storyteller/narration types were lost: the app emitted them from
 * #108 on, the worker never accepted them, and a docs pass (#251)
 * papered over the gap by calling them "client-side only" instead of
 * noticing they were being sent and rejected.
 *
 * This test reads both lists from source and fails if they ever drift
 * apart again. If you add (or remove) an event type, change BOTH
 * lists — and the docs (docs/observability.md, handbook ch07,
 * workers/crash-report/README.md) — in the same change.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The string literals inside one `... = [ ... ]` / union block. */
function stringLiteralsIn(block) {
  return [...block.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);
}

function clientEventTypes() {
  const src = readFileSync(join(ROOT, "src/lib/observability.ts"), "utf8");
  const m = /export type ObservabilityEventType =([\s\S]*?);/.exec(src);
  assert.ok(m, "ObservabilityEventType union not found in src/lib/observability.ts");
  return stringLiteralsIn(m[1]);
}

function workerEventTypes() {
  const src = readFileSync(join(ROOT, "workers/crash-report/src/index.ts"), "utf8");
  const m = /export const EVENT_TYPES = \[([\s\S]*?)\] as const;/.exec(src);
  assert.ok(m, "EVENT_TYPES not found in workers/crash-report/src/index.ts");
  return stringLiteralsIn(m[1]);
}

test("client event types and worker EVENT_TYPES are the same set", () => {
  const client = clientEventTypes();
  const worker = workerEventTypes();
  assert.ok(client.length > 0, "client list parsed empty — the extractor is stale");
  assert.ok(worker.length > 0, "worker list parsed empty — the extractor is stale");
  assert.equal(new Set(client).size, client.length, "client union has a duplicate type");
  assert.equal(new Set(worker).size, worker.length, "worker EVENT_TYPES has a duplicate type");
  assert.deepEqual(
    [...client].sort(),
    [...worker].sort(),
    "event-type drift: every type the client can emit must be accepted by the worker (and vice versa)",
  );
});

test("the funnel types are in both lists (the #194 regression)", () => {
  const funnel = [
    "storyteller_shown",
    "narration_started",
    "narration_completed",
    "narration_replayed",
    "narration_failed",
    "narration_dismissed",
  ];
  for (const type of funnel) {
    assert.ok(clientEventTypes().includes(type), `client union is missing ${type}`);
    assert.ok(workerEventTypes().includes(type), `worker EVENT_TYPES is missing ${type}`);
  }
});
