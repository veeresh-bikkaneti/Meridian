import type { Edition } from "./run.ts";
import type { Run } from "./run.ts";

/**
 * Session score: the score a player accumulates across edition switches.
 *
 * A "run" is one edition's question stream (Globe, Country, or State) and
 * used to own the score — switching editions started a fresh run and the
 * HUD reset to 0. A "session" wraps every run the player starts until they
 * explicitly end the game or the session idles out: each scored place is
 * banked into the session exactly once (at pin-commit time), so the score
 * keeps climbing across editions and the summary can break it down per
 * edition.
 */

export const SESSION_KEY = "meridian.session";

/** Two minutes of no interaction kills the session (player back to home). */
export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

/** Score accumulated for one edition within the session. */
export type EditionScore = {
  score: number;
  places: number;
  hits: number;
};

export type Session = {
  /** Random id, minted at session start. */
  id: string;
  dateKey: string;
  totalScore: number;
  placesPlayed: number;
  hits: number;
  /** Best consecutive-hits streak across every banked place. */
  bestStreak: number;
  totalDistanceKm: number;
  /** Shortest banked distance, null when nothing is banked yet. */
  bestDistanceKm: number | null;
  byEdition: Record<Edition, EditionScore>;
  /** Epoch ms of the last observed interaction; drives the idle timeout. */
  lastActivityAt: number;
  /** True after End game (or the idle kill); a new game starts a session. */
  ended: boolean;
};

/** Final tally for the end-of-game summary, session-wide. */
export type SessionSummary = {
  totalScore: number;
  placesPlayed: number;
  hits: number;
  /** Rounded average score per place, 0 when nothing was played. */
  averagePerPlace: number;
  bestStreak: number;
  averageDistanceKm: number;
  bestDistanceKm: number | null;
  /** Per-edition breakdown, in Globe → Country → State order. */
  byEdition: { edition: Edition; score: number; places: number; hits: number }[];
};

const EDITIONS: Edition[] = ["globe", "country", "state"];

function emptyEditionScore(): EditionScore {
  return { score: 0, places: 0, hits: 0 };
}

function mintSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startSession(dateKey: string, now: number): Session {
  return {
    id: mintSessionId(),
    dateKey,
    totalScore: 0,
    placesPlayed: 0,
    hits: 0,
    bestStreak: 0,
    totalDistanceKm: 0,
    bestDistanceKm: null,
    byEdition: {
      globe: emptyEditionScore(),
      country: emptyEditionScore(),
      state: emptyEditionScore(),
    },
    lastActivityAt: now,
    ended: false,
  };
}

/**
 * Bank one scored place into the session. Pure: returns the updated
 * session. Exactly-once is enforced by the single call site (pin commit in
 * the app): dropPin appends exactly one result per commit, and a page
 * reload restores both the run and the session, so neither re-banks.
 */
export function bankPlace(
  session: Session,
  input: {
    edition: Edition;
    /** Points earned for this place (0 on a miss). */
    score: number;
    hit: boolean;
    distanceKm: number;
    /** Consecutive hits including this place (0 after a miss). */
    streakAfter: number;
  },
): Session {
  const slot = session.byEdition[input.edition] ?? emptyEditionScore();
  return {
    ...session,
    totalScore: session.totalScore + input.score,
    placesPlayed: session.placesPlayed + 1,
    hits: session.hits + (input.hit ? 1 : 0),
    bestStreak: Math.max(session.bestStreak, input.streakAfter),
    totalDistanceKm: session.totalDistanceKm + input.distanceKm,
    bestDistanceKm:
      session.bestDistanceKm === null
        ? input.distanceKm
        : Math.min(session.bestDistanceKm, input.distanceKm),
    byEdition: {
      ...session.byEdition,
      [input.edition]: {
        score: slot.score + input.score,
        places: slot.places + 1,
        hits: slot.hits + (input.hit ? 1 : 0),
      },
    },
  };
}

/** Record observed interaction; the idle timeout counts from here. */
export function touchSession(session: Session, now: number): Session {
  return { ...session, lastActivityAt: now };
}

/** Player-chosen end (or the idle kill): no more banking into this session. */
export function endSession(session: Session): Session {
  return { ...session, ended: true };
}

/**
 * Whether the session still accepts banking: not ended and from today.
 * Idle expiry is checked separately (isIdleExpired) so the app can
 * distinguish "finished" from "timed out".
 */
export function isSessionLive(
  session: Session | null,
  dateKey: string,
): session is Session {
  return !!session && !session.ended && session.dateKey === dateKey;
}

/** True when the session has seen no interaction for longer than the timeout. */
export function isIdleExpired(
  session: Session,
  now: number,
  timeoutMs: number = IDLE_TIMEOUT_MS,
): boolean {
  return now - session.lastActivityAt > timeoutMs;
}

/** Tally the banked places into the end-of-game summary. */
export function summarizeSession(session: Session): SessionSummary {
  const placesPlayed = session.placesPlayed;
  return {
    totalScore: session.totalScore,
    placesPlayed,
    hits: session.hits,
    averagePerPlace:
      placesPlayed > 0 ? Math.round(session.totalScore / placesPlayed) : 0,
    bestStreak: session.bestStreak,
    averageDistanceKm:
      placesPlayed > 0 ? session.totalDistanceKm / placesPlayed : 0,
    bestDistanceKm: session.bestDistanceKm,
    byEdition: EDITIONS.map((edition) => ({
      edition,
      score: session.byEdition[edition]?.score ?? 0,
      places: session.byEdition[edition]?.places ?? 0,
      hits: session.byEdition[edition]?.hits ?? 0,
    })),
  };
}

/**
 * Backfill a fresh session from a run that was saved before sessions
 * existed (same tab, older code): its results were never banked, so banking
 * them now is exactly-once. Only call when starting a brand-new session —
 * a live session already holds every bank it was present for.
 */
export function seedSessionFromRun(session: Session, run: Run): Session {
  let next = session;
  for (const r of run.results) {
    // Pre-streak-engine saves lack streakBefore; bestStreak backfills to 0,
    // which keeps the max honest (never claims a streak it can't prove).
    next = bankPlace(next, {
      edition: run.edition,
      score: r.score,
      hit: r.hit,
      distanceKm: r.distanceKm,
      streakAfter: r.hit ? r.streakBefore + 1 : 0,
    });
  }
  return next;
}

/**
 * E2E seam: `?idle-ms=<n>` overrides the idle timeout (default 2 minutes).
 * Mirrors the `?loop-date=` deterministic-date precedent. Non-numeric,
 * missing, or non-positive values fall back to the default.
 */
export function idleTimeoutFromSearch(
  search: string,
  fallback: number = IDLE_TIMEOUT_MS,
): number {
  const match = /[?&]idle-ms=(\d+)/.exec(search);
  if (!match) return fallback;
  const ms = Number(match[1]);
  return Number.isFinite(ms) && ms > 0 ? ms : fallback;
}

/** Human labels for the per-edition score breakdown. */
export const EDITION_LABELS: Record<Edition, string> = {
  globe: "Globe",
  country: "Country",
  state: "State",
};

/** Warn threshold for a given timeout: 30 s before the kick, or halfway for short E2E timeouts. */
export function idleWarnMsFor(timeoutMs: number): number {
  return timeoutMs > 60_000 ? timeoutMs - 30_000 : Math.floor(timeoutMs / 2);
}

function isEdition(value: unknown): value is Edition {
  return value === "globe" || value === "country" || value === "state";
}

function isEditionScore(value: unknown): value is EditionScore {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.score === "number" &&
    Number.isFinite(r.score) &&
    r.score >= 0 &&
    typeof r.places === "number" &&
    Number.isInteger(r.places) &&
    r.places >= 0 &&
    typeof r.hits === "number" &&
    Number.isInteger(r.hits) &&
    r.hits >= 0
  );
}

/** Fail closed: any malformed stored session reads as null (fresh start). */
export function readSession(): Session | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const r = parsed as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      typeof r.dateKey !== "string" ||
      typeof r.totalScore !== "number" ||
      !Number.isFinite(r.totalScore) ||
      r.totalScore < 0 ||
      typeof r.placesPlayed !== "number" ||
      !Number.isInteger(r.placesPlayed) ||
      r.placesPlayed < 0 ||
      typeof r.hits !== "number" ||
      !Number.isInteger(r.hits) ||
      r.hits < 0 ||
      typeof r.bestStreak !== "number" ||
      !Number.isInteger(r.bestStreak) ||
      r.bestStreak < 0 ||
      typeof r.totalDistanceKm !== "number" ||
      !Number.isFinite(r.totalDistanceKm) ||
      r.totalDistanceKm < 0 ||
      (r.bestDistanceKm !== null &&
        (typeof r.bestDistanceKm !== "number" ||
          !Number.isFinite(r.bestDistanceKm) ||
          r.bestDistanceKm < 0)) ||
      typeof r.lastActivityAt !== "number" ||
      !Number.isFinite(r.lastActivityAt) ||
      typeof r.ended !== "boolean"
    ) {
      return null;
    }
    const byEdition = r.byEdition as Record<string, unknown> | undefined;
    if (!byEdition || !EDITIONS.every((e) => isEditionScore(byEdition[e]))) {
      return null;
    }
    return {
      id: r.id,
      dateKey: r.dateKey,
      totalScore: r.totalScore,
      placesPlayed: r.placesPlayed,
      hits: r.hits,
      bestStreak: r.bestStreak,
      totalDistanceKm: r.totalDistanceKm,
      bestDistanceKm: r.bestDistanceKm as number | null,
      byEdition: {
        globe: byEdition.globe as EditionScore,
        country: byEdition.country as EditionScore,
        state: byEdition.state as EditionScore,
      },
      lastActivityAt: r.lastActivityAt as number,
      ended: r.ended,
    };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // The session still lives in memory when storage is blocked.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Already gone or storage blocked; the in-memory copy is dropped too.
  }
}

export { isEdition };
