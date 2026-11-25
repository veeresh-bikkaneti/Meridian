/**
 * Item 42 (PR #522, rebuilt as #528): the journal rotation must pause
 * while the journal is on screen — the wiring between the screen and
 * the rotation.
 *
 * BEHAVIOUR version (Task 2, 2026-11-17): this used to grep game-app.tsx
 * for the wiring's source lines. It now exercises the wiring's real
 * seam — createJournalRotation — wired exactly the way game-app wires
 * it: the blockers closure reads a mutable on-screen ref fresh at every
 * recompute (game-app's journalOnScreenRef, fed by its
 * IntersectionObserver over the teaser card and the journal section),
 * and the on-screen → off-screen edge calls recompute() so a deferred
 * entry lands at once instead of waiting for the 30 s tick. The tests
 * below play the observer's part by flipping the ref, and the
 * rotation's part is the real production code.
 *
 * What this cannot see: the observer effect itself lives in game-app's
 * DOM code, which the node harness cannot mount; its click/scroll path
 * is covered by the grownups e2e spec. If the rotation's seam contract
 * changes shape, this test goes red — that is the guard the grep pin
 * was standing in for.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_WINDOW_MS,
  createJournalRotation,
  loadJournalNotes,
  type JournalTimerHost,
} from "./home-journal.ts";

// The dataset is lazy in production (TD-06.17); load it once up front so
// the rotation below resolves real window indices.
await loadJournalNotes();

/** Minimal timer host: the wiring tests drive recompute() by hand. */
const silentTimers: JournalTimerHost = {
  setTimeout: () => null,
  clearTimeout: () => {},
  setInterval: () => null,
  clearInterval: () => {},
};

/**
 * A rotation wired the way game-app wires it: `onScreenRef` stands in
 * for journalOnScreenRef (the IntersectionObserver's output), and the
 * blockers closure reads it fresh on every recompute.
 */
function wiredRotation(startMs: number) {
  const clock = { now: startMs };
  const onScreenRef = { current: false };
  const applied: number[] = [];
  const rotation = createJournalRotation({
    now: () => clock.now,
    timers: silentTimers,
    blockers: () => ({
      focusInsideCard: false,
      focusInsideSection: false,
      journalOnScreen: onScreenRef.current,
    }),
    onApply: (index) => applied.push(index),
  });
  return { clock, onScreenRef, applied, rotation };
}

describe("journal on-screen wiring, exercised through the rotation seam (item 42)", () => {
  it("a window change is deferred while the journal is on screen", () => {
    // Start 1 s into window 10; the journal scrolls into view.
    const { clock, onScreenRef, applied, rotation } = wiredRotation(JOURNAL_WINDOW_MS * 10 + 1_000);
    assert.equal(rotation.getCurrentIndex(), 10);
    onScreenRef.current = true;

    // The window rolls over while the player is reading the journal.
    clock.now = JOURNAL_WINDOW_MS * 11;
    rotation.recompute();

    assert.deepEqual(applied, [], "no entry is applied over the one being read");
    assert.equal(rotation.getCurrentIndex(), 10, "the shown entry stays");
    assert.equal(rotation.getPendingIndex(), 11, "the next entry waits as pending");
  });

  it("the off-screen edge recompute lands the deferred entry immediately", () => {
    const { clock, onScreenRef, applied, rotation } = wiredRotation(JOURNAL_WINDOW_MS * 10 + 1_000);
    onScreenRef.current = true;
    clock.now = JOURNAL_WINDOW_MS * 11;
    rotation.recompute();
    assert.equal(rotation.getPendingIndex(), 11);

    // The journal leaves the screen: the observer flips the ref and the
    // wiring calls recompute() on that edge — no timer tick involved.
    onScreenRef.current = false;
    rotation.recompute();

    assert.deepEqual(applied, [11], "the deferred entry applies on the edge");
    assert.equal(rotation.getCurrentIndex(), 11);
    assert.equal(rotation.getPendingIndex(), null);
  });

  it("the blockers are probed fresh at every recompute, not captured once", () => {
    const { clock, onScreenRef, applied, rotation } = wiredRotation(JOURNAL_WINDOW_MS * 10 + 1_000);
    clock.now = JOURNAL_WINDOW_MS * 11;

    onScreenRef.current = false;
    rotation.recompute();
    assert.deepEqual(applied, [11], "off screen: the change applies");

    // Back on screen for the next window: the same closure must now
    // defer, proving the ref is re-read rather than remembered.
    onScreenRef.current = true;
    clock.now = JOURNAL_WINDOW_MS * 12;
    rotation.recompute();
    assert.deepEqual(applied, [11], "on screen again: the next change defers");
    assert.equal(rotation.getPendingIndex(), 12);
  });
});
