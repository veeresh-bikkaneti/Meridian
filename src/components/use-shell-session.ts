import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearDiscardedShadow,
  clearSession,
  IDLE_TIMEOUT_MS,
  idleTimeoutFromSearch,
  idleWarnMsFor,
  isIdleExpired,
  isSessionLive,
  readSession,
  seedSessionFromRun,
  startSession,
  summarizeSession,
  touchSession,
  writeSession,
  type Session,
} from "@/game/session";
import {
  discardedNoticeText,
  runResultsTotals,
  trailDate,
  type DiscardedNotice,
} from "@/game/shell-helpers";
import { CHALLENGE_REGION_ID } from "@/game/challenge";
import { type Run } from "@/game/run";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";
import { removeSessionStorageItem } from "../platform/storage/browser-storage.ts";

/**
 * Session state: the score accumulator that survives edition switches.
 * The HUD and the summary read from here, never from the run.
 */
export function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
  const ref = useRef<Session | null>(null);
  const persist = useCallback((next: Session | null) => {
    ref.current = next;
    if (next) writeSession(next);
    else clearSession();
    setSession(next);
  }, []);
  const update = useCallback(
    (fn: (prev: Session | null) => Session | null) => {
      persist(fn(ref.current));
    },
    [persist],
  );
  const get = useCallback(() => ref.current, []);
  return { session, update, replace: persist, get };
}

/**
 * The shell-owned setters and run-storage helpers the idle kill needs.
 * Each setter is only ever called with null here, so they are typed
 * narrowly; the composer's real dispatchers satisfy them.
 */
export type ShellSessionDeps = {
  setRun: (value: null) => void;
  setMenu: (value: null) => void;
  setTutorial: (value: null) => void;
  setStartError: (value: null) => void;
  setMapSwitchedNote: (value: null) => void;
  clearDrop: () => void;
  readRun: () => Run | null;
  readMc2Run: () => Run | null;
  clearMc2Run: () => void;
  clearMc3Run: () => void;
};

/**
 * Step 5 — session hook, idle watchdog, discarded notice.
 * Owns the session store, the idle warning / idle-ended flags, the
 * one shared discarded-run notice and its announcement, the idle
 * window, and the ensure / kill functions. The composer passes the
 * run/menu/tutorial/error/map-note setters and the run-storage
 * helpers the kill needs; everything else lives here.
 */
export function useShellSession(deps: ShellSessionDeps) {
  const {
    setRun,
    setMenu,
    setTutorial,
    setStartError,
    setMapSwitchedNote,
    clearDrop,
    readRun,
    readMc2Run,
    clearMc2Run,
    clearMc3Run,
  } = deps;
  // Session score: survives edition switches until End game or the idle
  // timeout. The HUD and the summary read from here, never from the run.
  const { session, update: updateSession, replace: replaceSession, get: getSession } = useSessionState();
  // Idle UX: a non-blocking "still there?" warning, and a one-shot notice
  // on the home screen after the idle kill.
  const [idleWarn, setIdleWarn] = useState(false);
  const [idleEndedNote, setIdleEndedNote] = useState(false);
  // Wave 1 P0 Item 1: the one shared discarded-run notice. Keyed to
  // "live, non-ended run/session discarded at boot" — deliberate End
  // game already ends the session and isResumable excludes phase
  // "summary", so ended games never produce one (no clean-exit flag
  // keying: a finished game killed without pagehide must not show a
  // lost-game notice). One card for all four causes; the reason
  // keyword + the played score/places travel together, and each
  // cause's copy avoids the other causes' keywords.
  const [discardedNotice, setDiscardedNotice] = useState<DiscardedNotice | null>(null);
  // Fix round L2: the visible notice must not carry role="status" — it
  // mounts with its text already present, so screen readers may never
  // announce it. Instead this always-present (on home) sr-only region
  // starts empty and is FILLED by the effect below after mount, so the
  // text change is what announces. Cleared when the notice goes null,
  // so a later identical notice announces again instead of landing on
  // an unchanged region.
  const [discardedNoticeAnnouncement, setDiscardedNoticeAnnouncement] =
    useState("");
  useEffect(() => {
    setDiscardedNoticeAnnouncement(
      discardedNotice ? discardedNoticeText(discardedNotice) : "",
    );
  }, [discardedNotice]);
  // Idle window: the default, unless a harness names a different one.
  const idleTimeoutMs = useMemo(
    () => (typeof window === "undefined" ? IDLE_TIMEOUT_MS : idleTimeoutFromSearch(window.location.search)),
    [],
  );
  const idleWarnMs = useMemo(() => idleWarnMsFor(idleTimeoutMs), [idleTimeoutMs]);

  const ensureSession = useCallback(
    (nextRun: Run | null) => {
      const now = Date.now();
      const dateKey = trailDate();
      updateSession((prev) => {
        if (isSessionLive(prev, dateKey) && !isIdleExpired(prev, now, idleTimeoutMs)) {
          return touchSession(prev, now);
        }
        let fresh = startSession(dateKey, now);
        if (nextRun && nextRun.results.length > 0) {
          fresh = seedSessionFromRun(fresh, nextRun);
        }
        return fresh;
      });
    },
    [updateSession, idleTimeoutMs],
  );

  const killIdleSession = useCallback((skipNotice = false) => {
    setStartError(null);
    clearDrop();
    // Wave 1 P0 Item 1: capture what was played BEFORE dropping the
    // session. Challenge runs never bank into the session (their score
    // belongs to the shared route), so a challenge kill summarises the
    // run itself; every other kill summarises the whole session, and
    // only falls back to the run when no session survives.
    const killedRun = readRun() ?? readMc2Run();
    const killedIsChallenge =
      !!killedRun &&
      (killedRun.regionId === CHALLENGE_REGION_ID || killedRun.challengeOrigin === "mc2");
    // Boot fallback: at boot the session ref is still null (useSessionState
    // starts null with no hydration) while the persisted session survives
    // in session storage, so a reload-after-expiry kill must total the whole
    // persisted session, not just the killed run. Challenge kills stay
    // run-only (challenges never bank). Live play is unchanged: the ref
    // is non-null during play, so the fallback never runs there.
    const live = getSession() ?? (killedIsChallenge ? null : readSession());
    const liveSummary = live && !killedIsChallenge ? summarizeSession(live) : null;
    const totals = liveSummary
      ? { totalScore: liveSummary.totalScore, placesPlayed: liveSummary.placesPlayed }
      : runResultsTotals(killedRun);
    if (!skipNotice) {
      setDiscardedNotice({ reason: "inactivity", ...totals });
    }
    // The kill is the show: no durable record may re-fire it on a
    // later boot (at most one notice per discarded game).
    clearDiscardedShadow();
    try {
      removeSessionStorageItem(STORAGE_KEYS.pausedRun);
      clearMc2Run();
      clearMc3Run();
    } catch {
      // Storage blocked; the in-memory run is dropped below regardless.
    }
    setRun(null);
    setMenu(null);
    setTutorial(null);
    replaceSession(null);
    setIdleWarn(false);
    setIdleEndedNote(true);
    // #188: session end retires the switched notice too — the same
    // lifecycle logic Block B applied to mode flips. Left standing, a
    // "You switched to … Your score is kept." notice would sit beside
    // the idle-ended notice above and read stale (the score it says
    // was kept has just been dropped with the session).
    setMapSwitchedNote(null);
  }, [replaceSession, getSession, setStartError, clearDrop, readRun, readMc2Run, clearMc2Run, clearMc3Run, setRun, setMenu, setTutorial, setMapSwitchedNote]);

  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      const dateKey = trailDate();
      updateSession((prev) => {
        if (!isSessionLive(prev, dateKey)) return prev;
        // Throttle storage writes: interaction bursts don't need per-event persistence.
        if (now - prev.lastActivityAt < 2000) return prev;
        return touchSession(prev, now);
      });
      setIdleWarn(false);
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    return () => {
      for (const name of events) {
        window.removeEventListener(name, onActivity);
      }
    };
  }, [updateSession]);

  // Idle watchdog: warn shortly before the timeout, then kill the session
  // and return the player to the home screen. Wall-clock based — a tab left
  // open but untouched still expires.
  useEffect(() => {
    const check = () => {
      const s = getSession();
      const dateKey = trailDate();
      if (!isSessionLive(s, dateKey)) {
        setIdleWarn(false);
        return;
      }
      const now = Date.now();
      const idleMs = now - s.lastActivityAt;
      if (idleMs > idleTimeoutMs) {
        killIdleSession();
      } else if (idleMs > idleWarnMs) {
        setIdleWarn(true);
      }
    };
    const id = window.setInterval(check, 5000);
    // Check immediately when the tab becomes visible again: timers throttle
    // in background tabs, so the kill would otherwise lag the return.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getSession, killIdleSession, idleTimeoutMs, idleWarnMs]);

  return {
    session,
    updateSession,
    replaceSession,
    getSession,
    ensureSession,
    killIdleSession,
    idleWarn,
    idleEndedNote,
    discardedNotice,
    discardedNoticeAnnouncement,
    idleTimeoutMs,
    idleWarnMs,
    setDiscardedNotice,
    setIdleWarn,
    setIdleEndedNote,
  };
}
