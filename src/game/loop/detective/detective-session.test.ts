import assert from "node:assert/strict";
import test from "node:test";

import {
  DETECTIVE_SESSION_KEY,
  markSessionIntroSeen,
  noteSessionCase,
  readDetectiveSession,
  type SessionStorageLike,
} from "./detective-session.ts";

/** In-memory Storage fake (the module takes it by injection). */
function fakeStorage(): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

test("session: a fresh record reads as intro-unseen, zero cases", () => {
  const s = fakeStorage();
  assert.deepEqual(readDetectiveSession(s), {
    introSeen: false,
    casesSeen: 0,
    lastCaseIndex: null,
  });
});

test("session: the intro mark persists inside the record", () => {
  const s = fakeStorage();
  markSessionIntroSeen(s);
  assert.equal(readDetectiveSession(s).introSeen, true);
  // Marking twice is idempotent — the stored JSON stays one record.
  markSessionIntroSeen(s);
  const raw = JSON.parse(s.map.get(DETECTIVE_SESSION_KEY)!);
  assert.equal(raw.introSeen, true);
});

test("session: case ordinals count DISTINCT cases, in order", () => {
  const s = fakeStorage();
  assert.equal(noteSessionCase(137, s), 1);
  assert.equal(noteSessionCase(137, s), 1); // same case again: no recount
  assert.equal(noteSessionCase(42, s), 2);
  assert.equal(noteSessionCase(42, s), 2);
  assert.equal(noteSessionCase(7, s), 3);
  const record = readDetectiveSession(s);
  assert.equal(record.casesSeen, 3);
  assert.equal(record.lastCaseIndex, 7);
});

test("session: counting a case does not clobber the intro mark", () => {
  const s = fakeStorage();
  markSessionIntroSeen(s);
  noteSessionCase(9, s);
  assert.equal(readDetectiveSession(s).introSeen, true);
});

test("session NEGATIVE: corrupt or throwing storage fails open to a fresh session", () => {
  const corrupt = fakeStorage();
  corrupt.map.set(DETECTIVE_SESSION_KEY, "{not json");
  assert.deepEqual(readDetectiveSession(corrupt), {
    introSeen: false,
    casesSeen: 0,
    lastCaseIndex: null,
  });
  const throwing: SessionStorageLike = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readDetectiveSession(throwing).introSeen, false);
  // Writes never throw into game flow either.
  markSessionIntroSeen(throwing);
  assert.equal(noteSessionCase(3, throwing), 1);
  // No storage at all (SSR / node): also a fresh session.
  assert.equal(readDetectiveSession(null).casesSeen, 0);
});
