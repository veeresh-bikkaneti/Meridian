import { calendarDate } from "../daily.ts";

/**
 * The pool index for a given moment: the UTC day count modulo the pool
 * size. This formula must match Worker 1's build script exactly — the
 * script assigns clue file {index}.json with the same computation, so any
 * drift here would serve the wrong day's puzzle.
 */
export function loopDayIndex(now = new Date(), poolSize: number): number {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new Error("loopDayIndex: poolSize must be a positive integer");
  }
  return Math.floor(now.getTime() / 86400000) % poolSize;
}

/** The Loop's storage/day key: UTC "YYYY-MM-DD". */
export function loopDateKey(now = new Date()): string {
  return calendarDate("UTC", now);
}

const LOOP_DATE_PARAM = "loop-date";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * E2E seam: `?loop-date=YYYY-MM-DD` forces the day the Loop screen uses,
 * so tests can pin a deterministic puzzle without waiting for midnight UTC.
 * Returns null when the param is absent or malformed — the seam is inert
 * otherwise and production play always uses the real clock.
 */
export function loopNowFromSearch(search: string): Date | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get(LOOP_DATE_PARAM);
  } catch {
    return null;
  }
  if (!raw || !DATE_RE.test(raw)) return null;
  const at = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return null;
  // Reject rollover dates like 2026-02-30 that Date silently normalizes.
  if (loopDateKey(at) !== raw) return null;
  return at;
}
