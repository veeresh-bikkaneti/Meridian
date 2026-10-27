/**
 * #209 — withChunkTimeout contracts, executed (not source-pinned):
 * the race must pass settlements through untouched, reject with the
 * named timeout error at the bound, and swallow a late rejection so
 * it can never become an unhandled rejection after the card is up.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ChunkLoadTimeoutError,
  withChunkTimeout,
} from "./chunk-timeout.ts";

test("a load that settles before the bound resolves with its value", async () => {
  const value = await withChunkTimeout(Promise.resolve(42), "test chunk", 1_000);
  assert.equal(value, 42);
});

test("a failing load rejects with the ORIGINAL error, untouched", async () => {
  const original = new Error("Failed to fetch dynamically imported module");
  await assert.rejects(
    withChunkTimeout(Promise.reject(original), "test chunk", 1_000),
    (err: unknown) => err === original,
  );
});

test("a hung load rejects with ChunkLoadTimeoutError at the bound", async () => {
  const hung = new Promise<never>(() => {});
  const started = Date.now();
  await assert.rejects(
    withChunkTimeout(hung, "GeoDetective screen", 25),
    (err: unknown) => {
      assert.ok(err instanceof ChunkLoadTimeoutError);
      assert.equal(err.chunkLabel, "GeoDetective screen");
      assert.equal(err.timeoutMs, 25);
      return true;
    },
  );
  assert.ok(Date.now() - started < 2_000, "the rejection lands at the bound, not eventually");
});

test("a rejection that lands after the bound is swallowed by the race", async () => {
  let rejectLate!: (err: Error) => void;
  const late = new Promise<never>((_resolve, reject) => {
    rejectLate = reject;
  });
  await assert.rejects(withChunkTimeout(late, "late chunk", 10), ChunkLoadTimeoutError);
  // The load fails after the timeout already won. The race attached
  // handlers up front, so this rejection is handled — if it were not,
  // node --test would fail the file with an unhandled rejection.
  rejectLate(new Error("late failure"));
  await new Promise((resolve) => setTimeout(resolve, 30));
});
