/**
 * Detective session record (PR 2b) — what "once per session" means
 * for the Holmes & Watson staging, kept in one small place.
 *
 * A session is ONE TAB VISIT: the record lives in sessionStorage,
 * which the browser scopes to the tab and drops when the tab
 * closes. A new tab (or a reopened one) is a new session and earns
 * the full opening again — bench scene, instruction duet, and the
 * "Let's find some clues" announcement. Inside a session those
 * play exactly once, at the first case; later cases open quietly
 * with a page-turn and a "Case N" stamp instead.
 *
 * The record holds only staging bookkeeping — never anything about
 * the player or the answers:
 * - introSeen:     the session's opening already played.
 * - casesSeen:     how many distinct cases this session has opened
 *                  (the stamp's N).
 * - lastCaseIndex: the case the count was last taken for, so a
 *                  re-render of the same case never counts twice.
 *
 * Fail-open by design: storage can throw (private mode, quotas,
 * blocked cookies). A record that cannot be read or written simply
 * behaves as a fresh session — the opening replays, nothing wedges.
 * That matches the fallback law everywhere in this feature: the
 * game must play identically if any of this machinery is missing.
 */

export interface DetectiveSessionRecord {
  introSeen: boolean;
  casesSeen: number;
  lastCaseIndex: number | null;
}

/** The slice of the Storage API this module needs (sessionStorage
 * in the app; a fake in tests). */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DETECTIVE_SESSION_KEY = "meridian.detective.session.v1";

const FRESH: DetectiveSessionRecord = {
  introSeen: false,
  casesSeen: 0,
  lastCaseIndex: null,
};

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Read the session record. Any problem — no storage, a throw, a
 * corrupt payload — reads as a fresh session. */
export function readDetectiveSession(
  storage: SessionStorageLike | null = defaultStorage(),
): DetectiveSessionRecord {
  if (!storage) return { ...FRESH };
  try {
    const raw = storage.getItem(DETECTIVE_SESSION_KEY);
    if (!raw) return { ...FRESH };
    const parsed = JSON.parse(raw) as Partial<DetectiveSessionRecord>;
    return {
      introSeen: parsed.introSeen === true,
      casesSeen:
        typeof parsed.casesSeen === "number" && parsed.casesSeen > 0
          ? Math.floor(parsed.casesSeen)
          : 0,
      lastCaseIndex:
        typeof parsed.lastCaseIndex === "number" ? parsed.lastCaseIndex : null,
    };
  } catch {
    return { ...FRESH };
  }
}

function writeDetectiveSession(
  record: DetectiveSessionRecord,
  storage: SessionStorageLike | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(DETECTIVE_SESSION_KEY, JSON.stringify(record));
  } catch {
    // Fail-open: an unwritable record just means the next read sees
    // a fresh session. Never throw into game flow.
  }
}

/** Mark the session's opening as played (the host calls this when
 * the first case's bench + duet + announcement run). */
export function markSessionIntroSeen(
  storage: SessionStorageLike | null = defaultStorage(),
): void {
  const record = readDetectiveSession(storage);
  if (record.introSeen) return;
  writeDetectiveSession({ ...record, introSeen: true }, storage);
}

/** Count a case opening and return its session ordinal (1-based —
 * the stamp's "Case N"). Re-opening the SAME case (a re-render, a
 * resume of the case already counted) returns the standing ordinal
 * without counting again. */
export function noteSessionCase(
  caseIndex: number,
  storage: SessionStorageLike | null = defaultStorage(),
): number {
  const record = readDetectiveSession(storage);
  if (record.lastCaseIndex === caseIndex) {
    return Math.max(1, record.casesSeen);
  }
  const next: DetectiveSessionRecord = {
    ...record,
    casesSeen: record.casesSeen + 1,
    lastCaseIndex: caseIndex,
  };
  writeDetectiveSession(next, storage);
  return next.casesSeen;
}
