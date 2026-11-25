/**
 * use-shell-router.ts — Step 10 (TD-06.7): the in-app game shell's router
 * and boot. Owns `ready` / `setReady`, the derived `inAppScreen`, the
 * hash / history writer and listeners, and the boot effect that restores
 * a saved run (or a friend-challenge link) and signals ready on every
 * exit. The file stays in `src/components/`; the hash writer stays
 * singular here. `pageshow` must not close Cold Trail; `runStartGenRef`
 * still cancels in-flight `openRun` on force-home (that lives in the
 * run controller); every boot exit still calls `setReady(true)`.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { isUncleanShutdown, clearRunAfterUncleanShutdown } from "@/game/clean-exit";
import { initObservability } from "@/lib/observability";
import { loadFlags, isEnabled } from "@/lib/flags";
import {
  decodeChallenge,
  decodeChallengeLink,
  resolveChallengeRoute,
  playOrder,
  CHALLENGE_REGION_ID,
  CHALLENGE_REGION_NAME,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_VERSION_COPY,
  CHALLENGE_UNKNOWN_REGION_COPY,
  CHALLENGE_UNKNOWN_CONTENT_COPY,
  CHALLENGE_BROKEN_LINK_COPY,
  CHALLENGE_LOAD_FAILURE_COPY,
  CHALLENGE_MC3_PREFIX,
  type ChallengeRoute,
} from "@/game/challenge";
import { placesFor } from "@/game/generated-places";
import { preloadTerritory } from "@/game/territory";
import {
  startRun,
  resumeRun,
  isResumable,
  type Run,
  type Edition,
} from "@/game/run";
import {
  runResultsTotals,
  trailDate,
  type DiscardedNotice,
} from "@/game/shell-helpers";
import {
  summarizeSession,
  readSession,
  isSessionLive,
  isIdleExpired,
  readDiscardedShadow,
  clearDiscardedShadow,
} from "@/game/session";
import { isTutorialRunPool } from "@/game/tutorial";
import { removeSessionStorageItem } from "../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";
import { SCORING_VERSION } from "@/game/scoring";
import { REVIEW_DECK_REGION_ID } from "@/game/review-deck";
import { writeLoopOpen } from "@/game/loop/store";
import { writeColdTrailOpen } from "@/game/coldtrail/store";
import { hashForScreen, screenForHash } from "@/lib/screen-hash";
import type { PickerDifficulty } from "@/game/tier-filter";

type Menu =
  | { kind: "countries" }
  | { kind: "states" }
  | { kind: "challengeRegions" }
  | { kind: "admin1"; countryId: string; countryName: string; from: "countries" | "states" };

/**
 * Everything the router + boot need from the composer. Setters are the
 * component's own dispatchers; the run-storage readers are the
 * module-level helpers defined in game-app.tsx.
 */
export type ShellRouterDeps = {
  commit: (next: Run) => void;
  ensureSession: (nextRun: Run | null) => void;
  killIdleSession: (skipNotice?: boolean) => void;
  idleTimeoutMs: number;
  difficultyChoice: PickerDifficulty;
  replaceSession: (value: null) => void;
  setDiscardedNotice: (notice: DiscardedNotice | null) => void;
  setChallengeBootNotice: (notice: { title: string; detail: string | null } | null) => void;
  setMenu: (value: Menu | null) => void;
  setPendingChallenge: (value: { route: ChallengeRoute; hasSavedRun: boolean } | null) => void;
  clearDrop: () => void;
  bootRetryRef: RefObject<string | null | undefined>;
  readRun: () => Run | null;
  readMc2Run: () => Run | null;
  readMc3Run: () => Run | null;
  clearMc2Run: () => void;
  clearMc3Run: () => void;
  run: Run | null;
  loopOpen: boolean;
  coldTrailOpen: boolean;
  subjectsOpen: boolean;
  starting: {
    edition: Edition;
    regionId: string;
    regionName: string;
    choice: PickerDifficulty;
  } | null;
  menu: Menu | null;
  setLoopOpen: (value: boolean) => void;
  setColdTrailOpen: (value: boolean) => void;
  setSubjectsOpen: (value: boolean) => void;
};

export function useShellRouter(deps: ShellRouterDeps) {
  const {
    commit,
    ensureSession,
    killIdleSession,
    idleTimeoutMs,
    difficultyChoice,
    replaceSession,
    setDiscardedNotice,
    setChallengeBootNotice,
    setMenu,
    setPendingChallenge,
    clearDrop,
    bootRetryRef,
    readRun,
    readMc2Run,
    readMc3Run,
    clearMc2Run,
    clearMc3Run,
    run,
    loopOpen,
    coldTrailOpen,
    subjectsOpen,
    starting,
    menu,
    setLoopOpen,
    setColdTrailOpen,
    setSubjectsOpen,
  } = deps;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Observability boot — MUST run first, before the crash-loop breaker
    // below consumes the clean-exit state: initObservability() reads the
    // previous breadcrumb and, when isUncleanShutdown() is true, queues
    // exactly one suspected_crash event carrying that trail (see
    // src/lib/observability.ts — a jetsam kill cannot beacon during the
    // kill; detection is by asymmetry at next boot). Events queue in
    // memory until flags resolve and provide the endpoint (possibly
    // null = transport disabled), then flush. Never throws.
    initObservability();
    // Crash-loop breaker: the previous page wrote a run but never unloaded
    // — the process was killed mid-game. Clear the stale run and land on
    // the menu instead of replaying the identical heavy path. A missing
    // flag (runs saved before this fix) counts as clean and resumes as
    // before.
    if (isUncleanShutdown()) {
      clearRunAfterUncleanShutdown(STORAGE_KEYS.pausedRun.key);
      clearRunAfterUncleanShutdown(STORAGE_KEYS.pausedRunMc2.key);
      clearRunAfterUncleanShutdown(STORAGE_KEYS.pausedRunMc3.key);
      setReady(true);
      return;
    }
    // Friend-challenge links arrive as a `#c=…` URL fragment. The
    // fragment is stripped from the address bar FIRST, synchronously,
    // before anything async happens — a challenge link should never
    // sit in the URL where a screenshot or a share could leak it, and
    // stripping must not wait on the flag fetch below. What happens
    // next depends on the friendChallenges flag, but every failure exit
    // FALLS THROUGH to bootSavedRun() — the ordinary saved-run boot
    // defined below — instead of ending the boot itself: a player who
    // taps a friend's link (broken or not, feature on or off) must
    // never lose the run they already had in progress. With the flag
    // off this makes the `#c=` boot exactly the boot main would have
    // run if the link had never been tapped.
    const rawHash = window.location.hash;
    if (rawHash.startsWith("#c=") || rawHash === "#c") {
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch {
        // History API blocked; proceed fail-closed.
      }
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          // Flag off: the feature does not exist for this player, so
          // the boot must be indistinguishable from main's — fall
          // through to the saved-run boot (which also clears a saved
          // CHALLENGE run, exactly as it does without a hash).
          bootSavedRun();
          return;
        }
        const mcVersionPrefix = /^#c=mc(\d+)\./.exec(rawHash);
        if (mcVersionPrefix && Number(mcVersionPrefix[1]) !== 1) {
          // mc2 and mc3 links take their own receive path (welcome
          // card, no displacement until Start). So does a link from a
          // NEWER format this build does not know (delta §3.6): the
          // receive path's dispatcher answers it with the version
          // signal, and the failure mapping below turns that into the
          // newest-Meridian remedy instead of a resend line. The mc1
          // prefix itself stays on the frozen path below, untouched.
          void receiveMc2Challenge(rawHash);
          return;
        }
        const decoded = decodeChallenge(rawHash, SCORING_VERSION);
        if (!decoded.ok) {
          // Flag on, but the link is broken (corrupt, or made by a
          // different scoring version): tell the player on Home via
          // the boot notice, then fall through — a saved run, if one
          // exists, still resumes underneath the notice.
          setChallengeBootNotice({ title: CHALLENGE_CHILD_COPY, detail: null });
          bootSavedRun();
          return;
        }
        try {
          const [globePlaces] = await Promise.all([
            placesFor("globe", "globe", undefined, false),
            preloadTerritory(),
          ]);
          const validIds = new Set(globePlaces.map((p) => p.id));
          if (!decoded.ids.every((id) => validIds.has(id))) {
            // The link names a place this build's Globe catalog does
            // not have (an old link, or a hand-edited one). Same
            // child-facing failure as a corrupt link: notice + fall
            // through to the saved-run boot.
            setChallengeBootNotice({ title: CHALLENGE_CHILD_COPY, detail: null });
            bootSavedRun();
            return;
          }
          const orderedIds = playOrder(decoded);
          clearDrop();
          const challengeRun = startRun(
            {
              edition: "globe",
              regionId: CHALLENGE_REGION_ID,
              regionName: CHALLENGE_REGION_NAME,
              dateKey: trailDate(),
              difficultyChoice,
            },
            orderedIds,
            null,
          );
          commit(challengeRun);
          // The mc1 boot is its commit point: a saved mc2/mc3
          // challenge is displaced now (a saved challenge is
          // displaceable only on a new challenge's start — manifest
          // §3 persistence; one challenge at a time, so the newer
          // slots must not shadow this run at the next boot). The
          // normal slot now holds THIS challenge; nothing else is
          // touched.
          clearMc2Run();
          clearMc3Run();
          setMenu(null);
        } catch {
          // The Globe catalog could not load, so the challenge cannot
          // start. From the player's side this is the same failure as
          // a broken link — show the same notice and fall through to
          // the saved-run boot instead of stranding them on Home.
          setChallengeBootNotice({ title: CHALLENGE_CHILD_COPY, detail: null });
          bootSavedRun();
          return;
        }
        setReady(true);
      });
      return;
    }
    // The ordinary saved-run boot: everything a hash-less boot does —
    // challenge-run resume/clear, review and tutorial retirement,
    // idle-expiry, and the resumable-run restore. It is a named
    // function (declared here, hoisted within this effect) because the
    // `#c=` branch above falls through to it on every failure exit;
    // the hash-less path simply calls it directly. The body below is
    // the pre-challenge boot, unchanged — if you are changing resume
    // behaviour, change it here so BOTH entry points get it.
    function bootSavedRun() {
    // Challenge saves take precedence over the normal slot, newest
    // format first (governing manifest §Q1-A4 read order: mc3 → mc2
    // → mc1): a player who left a challenge mid-route comes back to
    // the challenge. With the flag off the challenge save is cleared
    // and the ordinary boot continues underneath — a saved normal run
    // is never collateral (manifest C7's guard table). A newer
    // format's save also shadows the older slots (and a stale mc1
    // save in the normal slot) until it completes or is cleared.
    const mc3Saved = readMc3Run();
    if (mc3Saved) {
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          clearMc3Run();
          bootMc2OrBody();
          return;
        }
        const today = {
          edition: mc3Saved.edition,
          regionId: mc3Saved.regionId,
          regionName: mc3Saved.regionName,
          dateKey: trailDate(),
          difficultyChoice: mc3Saved.difficultyChoice,
        };
        if (isResumable(mc3Saved, today)) {
          const restored = resumeRun(mc3Saved, today);
          await preloadTerritory();
          commit(restored);
          setReady(true);
          return;
        }
        clearMc3Run();
        bootMc2OrBody();
      });
      return;
    }
    bootMc2OrBody();
    }

    function bootMc2OrBody() {
    const mc2Saved = readMc2Run();
    if (mc2Saved) {
      void loadFlags().then(async () => {
        // Fix round M1: a dropped mc2 run notices instead of landing on
        // silent home. The notice is set BEFORE the clear, and the body
        // boot runs preserving it (see bootSavedRunBody's preserveNotice
        // guard). A finished (summary-phase) challenge is not a lost
        // game: it clears silently, matching the body's own summary
        // exclusion. Challenge runs never bank into the session, so the
        // summary is the mc2 run's own results — never another game's
        // session totals.
        const noticeMc2Discard = () => {
          if (mc2Saved.phase !== "summary") {
            setDiscardedNotice({ reason: "challenges", ...runResultsTotals(mc2Saved) });
          }
        };
        if (!isEnabled("friendChallenges")) {
          noticeMc2Discard();
          clearMc2Run();
          bootSavedRunBody(true);
          return;
        }
        const today = {
          edition: mc2Saved.edition,
          regionId: mc2Saved.regionId,
          regionName: mc2Saved.regionName,
          dateKey: trailDate(),
          difficultyChoice: mc2Saved.difficultyChoice,
        };
        if (isResumable(mc2Saved, today)) {
          const restored = resumeRun(mc2Saved, today);
          await preloadTerritory();
          commit(restored);
          setReady(true);
          return;
        }
        noticeMc2Discard();
        clearMc2Run();
        bootSavedRunBody(true);
      });
      return;
    }
    bootSavedRunBody();
    }

    /**
     * The mc2/mc3 receive path (Package A; mc3 added by the 2026-10-31
     * delta): decode and bind the link, load the named region's
     * catalog, check membership — fail-closed at every step with the
     * manifest's three failure classes — and only then show the
     * welcome card. The saved run is NOT touched here: displacement
     * commits on the card's Start tap, never on arrival.
     */
    async function receiveMc2Challenge(hash: string) {
      const link = decodeChallengeLink(hash, SCORING_VERSION);
      if (!link.ok) {
        // The failure classes (governing manifest §Q1-A6), told apart
        // by their TITLE line (see challengeBootNotice):
        // - VERSION class: the link is well-formed but from a newer
        //   Meridian than this build — either its prefix names an
        //   unknown version (the dispatcher only raises "version" for
        //   that shape, canonical body included), or it is an mc3
        //   link whose REGION failure means registry skew: the seal
        //   already passed, so the link is intact and simply names a
        //   region this build's registry predates. Title is the
        //   newest-Meridian line; no resend remedy, because a resend
        //   from the same newer build fails identically.
        // - REGION class: an mc1/mc2 link naming a region this build
        //   does not have.
        // - CORRUPT class: everything else, malformed mc3 included.
        //   A "version" raised from INSIDE a known format (an mc2
        //   payload with v ≠ 2, an mc3 with reserved bits set) lands
        //   here and keeps the ordinary resend line.
        const prefixVersion = /^#c=mc(\d+)\./.exec(hash);
        const unknownVersionPrefix =
          prefixVersion !== null && ![1, 2, 3].includes(Number(prefixVersion[1]));
        const versionClass =
          (link.reason === "version" && unknownVersionPrefix) ||
          (hash.startsWith(CHALLENGE_MC3_PREFIX) && link.reason === "region");
        setChallengeBootNotice(
          versionClass
            ? { title: CHALLENGE_VERSION_COPY, detail: null }
            : link.reason === "region"
              ? { title: CHALLENGE_CHILD_COPY, detail: CHALLENGE_UNKNOWN_REGION_COPY }
              : { title: CHALLENGE_CHILD_COPY, detail: CHALLENGE_BROKEN_LINK_COPY },
        );
        bootSavedRun();
        return;
      }
      try {
        const [places] = await Promise.all([
          placesFor(link.route.edition, link.route.regionId, undefined, false),
          preloadTerritory(),
        ]);
        const resolved = resolveChallengeRoute(hash, SCORING_VERSION, places.map((p) => p.id));
        if (!resolved.ok) {
          // Class 2 (place arm): a named place is not in this build's
          // catalog for the named region.
          setChallengeBootNotice({
            title: CHALLENGE_CHILD_COPY,
            detail: CHALLENGE_UNKNOWN_CONTENT_COPY,
          });
          bootSavedRun();
          return;
        }
        const saved = readRun();
        setPendingChallenge({
          route: resolved.route,
          hasSavedRun:
            !!saved &&
            saved.regionId !== CHALLENGE_REGION_ID &&
            saved.regionId !== REVIEW_DECK_REGION_ID,
        });
        setMenu(null);
        setReady(true);
      } catch {
        // Class 3: the link may be perfect, but the region chunk did
        // not load, so membership could not be checked.
        setChallengeBootNotice({
          title: CHALLENGE_CHILD_COPY,
          detail: CHALLENGE_LOAD_FAILURE_COPY,
        });
        bootSavedRun();
      }
    }

    // preserveNotice: when an mc2 discard notice already stands, the
    // body boot must not overwrite it with its own discard notice.
    // Every notice site below is guarded; the shadow block is skipped
    // whole, so a preserved shadow survives for a later boot instead of
    // being silently consumed. A resumed run still retires the notice
    // via commit() — that is the retire rule, not an overwrite.
    function bootSavedRunBody(preserveNotice = false) {
    const saved = readRun();
    if (saved && saved.regionId === CHALLENGE_REGION_ID) {
      void loadFlags().then(async () => {
        if (!isEnabled("friendChallenges")) {
          // Wave 1 P0 Item 1E: the flag-off deletion notices instead of
          // landing on silent home. Challenge runs never bank into the
          // session, so the summary is the challenge run's own results
          // — never another game's session totals.
          clearDrop();
          const challengeTotals = runResultsTotals(saved);
          if (!preserveNotice) {
            setDiscardedNotice({ reason: "challenges", ...challengeTotals });
          }
          try {
            removeSessionStorageItem(STORAGE_KEYS.pausedRun);
          } catch {
            // Storage blocked.
          }
          setReady(true);
          return;
        }
        const today = {
          edition: saved.edition,
          regionId: saved.regionId,
          regionName: saved.regionName,
          dateKey: trailDate(),
          difficultyChoice: saved.difficultyChoice,
        };
        if (isResumable(saved, today)) {
          const restored = resumeRun(saved, today);
          await preloadTerritory();
          commit(restored);
        }
        setReady(true);
      });
      return;
    }
    // Review sessions never resume across reloads: the deck (local storage)
    // is the durable state; the session queue is rebuilt fresh on every
    // start. Fail closed to the edition picker.
    if (saved && saved.regionId === REVIEW_DECK_REGION_ID) {
      clearDrop();
      try {
        removeSessionStorageItem(STORAGE_KEYS.pausedRun);
      } catch {
        // Storage blocked; the in-memory run is dropped regardless.
      }
      setReady(true);
      return;
    }
    // A persisted tutorial practice round never resumes: the tour is a
    // single-place practice round, so resuming it would recycle the same
    // place forever with no tutorial UI (beat state is in-memory only).
    // Drop it and land on the menu — the invitation is already marked
    // seen, so the player simply starts a real game.
    let resumable = saved;
    if (resumable && isTutorialRunPool(resumable.poolIds)) {
      try {
        removeSessionStorageItem(STORAGE_KEYS.pausedRun);
      } catch {
        // Storage blocked; treating it as absent is enough.
      }
      resumable = null;
    }
    const now = Date.now();
    const dateKey = trailDate();
    const savedSession = readSession();
    // A session that idled out while the tab was closed counts as expired:
    // kill it (and the run it banked) instead of silently resuming.
    // The kill's own inactivity notice is skipped when an mc2 notice is
    // preserved (skipNotice gates only that set, never the kill itself).
    if (savedSession && isSessionLive(savedSession, dateKey) && isIdleExpired(savedSession, now, idleTimeoutMs)) {
      killIdleSession(preserveNotice);
      setReady(true);
      return;
    }
    if (resumable) {
      const today = {
        edition: resumable.edition,
        regionId: resumable.regionId,
        regionName: resumable.regionName,
        dateKey,
        // A changed difficulty choice never resumes: switching bands starts
        // a fresh run instead.
        difficultyChoice,
      };
      // resumeRun mints a fresh run when the saved one is not resumable — a
      // page load must not auto-start a run, so only resumable sessions are
      // restored. (The old `restored === saved` check could never pass:
      // resumeRun always returns a new object, so reloads silently dropped
      // to the menu instead of resuming.)
      // The literal `if (isResumable(...))` shape is pinned by
      // territory-lazy-boundary.test.ts (Core F-2); the discard block
      // below keys off didRestore instead of an else branch (the
      // predicate would narrow an else branch to never).
      let didRestore = false;
      if (isResumable(resumable, today)) {
        didRestore = true;
        // Wave 1 P0 Item 1B: a successful resume consumes any pending
        // discarded record, so it cannot fire later. (The resumed
        // session's own persists below write a fresh live shadow.)
        clearDiscardedShadow();
        const restored = resumeRun(resumable, today);
        if (restored.phase === "aim") {
          // Core F-2: an aim-phase restore resumes straight into
          // gameplay without crossing openRun's awaited territory
          // preload — so the commit waits for the preload here: the
          // first post-restore pin drop must score against the real
          // data, not the fail-closed default. preloadTerritory never
          // rejects (a failed load fails closed at the readers), so
          // deferring the commit on it cannot strand the boot; the
          // splash stays up until it lands, then ready is set.
          // (#209: the preload is timeout-bounded in territory.ts,
          // so this deferral always settles — a hung import can no
          // longer hold the splash up forever.)
          void preloadTerritory().then(() => {
            commit(restored);
            ensureSession(restored);
            setReady(true);
          });
          return;
        }
        // Non-aim restore (reveal phases): the pin already scored
        // before the reload, so no await is needed — the F2b
        // fire-and-forget start below stands, and the ResultCard's own
        // mount preload + re-render is the guarantee layer for its
        // pin-compare.
        void preloadTerritory();
        commit(restored);
        ensureSession(restored);
      }
      if (!didRestore && resumable.phase !== "summary") {
        // Wave 1 P0 Item 1: a live, non-ended run that cannot resume
        // notices instead of landing on silent home. Only the two
        // classifiable causes notice here — a new UTC day, or a retired
        // scoring version (stored scores are never recomputed). The
        // summary-phase run is deliberately excluded: End game already
        // ended that session, and its reload must show plain home.
        // Anything else unclassified (e.g. a band change) keeps today's
        // silent fall-through.
        const staleScoring =
          resumable.results.length > 0 &&
          resumable.results.some((r) => r.scoringVersion !== SCORING_VERSION);
        const reason: DiscardedNotice["reason"] | null =
          savedSession && savedSession.dateKey !== dateKey
            ? "new-day"
            : staleScoring
              ? "scoring"
              : null;
        if (reason) {
          const sessionSummary = savedSession ? summarizeSession(savedSession) : null;
          const totals = sessionSummary
            ? { totalScore: sessionSummary.totalScore, placesPlayed: sessionSummary.placesPlayed }
            : runResultsTotals(resumable);
          if (!preserveNotice) {
            setDiscardedNotice({ reason, ...totals });
          }
          clearDrop();
          try {
            removeSessionStorageItem(STORAGE_KEYS.pausedRun);
          } catch {
            // Storage blocked; the in-memory run is dropped regardless.
          }
          replaceSession(null);
          clearDiscardedShadow();
          setReady(true);
          return;
        }
      }
    }
    if (!saved) {
      // Wave 1 P0 Item 1B: no session storage run survived (a closed tab
      // kills session storage), but the local-storage shadow may have.
      // A shadow from a previous UTC day is a new-day discard; an
      // expired shadow is an inactivity discard. A fresh shadow is
      // left alone — the game may still be open in another tab, and
      // a later expired boot still notices. Showing consumes the
      // record at first show: dismiss and reload alike show nothing.
      const shadow = readDiscardedShadow();
      // Fix round M1: when an mc2 notice is preserved, the shadow block
      // is skipped whole — neither shown nor consumed — so the shadow
      // survives for a later boot (defer, not silent loss).
      if (shadow && !preserveNotice) {
        if (shadow.dateKey !== dateKey) {
          setDiscardedNotice({
            reason: "new-day",
            totalScore: shadow.totalScore,
            placesPlayed: shadow.placesPlayed,
          });
          clearDiscardedShadow();
        } else if (now - shadow.lastActivityAt > idleTimeoutMs) {
          setDiscardedNotice({
            reason: "inactivity",
            totalScore: shadow.totalScore,
            placesPlayed: shadow.placesPlayed,
          });
          clearDiscardedShadow();
        }
      }
    }
      setReady(true);
    }
    bootSavedRun();
  }, [commit, ensureSession, killIdleSession, idleTimeoutMs, difficultyChoice]);

  const inAppScreen = !ready
    ? "boot"
    : run
      ? "globe"
      : loopOpen
        ? "geodetective"
        : coldTrailOpen
          ? "coldtrail"
          : subjectsOpen
            ? "subjects"
            : starting
              ? "starting"
              : menu
                ? `menu:${menu.kind}`
                : "home";
  useLayoutEffect(() => {
    if (inAppScreen === "boot") return;
    window.scrollTo(0, 0);
  }, [inAppScreen]);

  // Item 8 (INV3/INV5): each screen carries its own hash (see
  // src/lib/screen-hash.ts). A screen change pushes it, so Back
  // returns to the previous screen instead of leaving the site;
  // a popstate (Back / Forward) drives the screen state to match.
  // Round 2 (bug 12): the FIRST screen's hash seeds the current
  // history entry with replaceState instead of pushing a second
  // one — pushing #home over a fresh visit to / left a phantom
  // entry, so a first Back landed on the hash-less / and did
  // nothing (the player was trapped; a second Back left). Seeding
  // only happens on a hash-less URL: a visit that arrives with a
  // fragment (deep link, home section) keeps today's push, so its
  // entry stays in the stack under the screen it opened.
  const hashSeededRef = useRef(false);
  useEffect(() => {
    const hash = hashForScreen(inAppScreen);
    if (hash === null || window.location.hash === hash) return;
    if (!hashSeededRef.current && window.location.hash === "") {
      window.history.replaceState(null, "", hash);
    } else {
      window.history.pushState(null, "", hash);
    }
    hashSeededRef.current = true;
  }, [inAppScreen]);

  // Open exactly one tap-in screen (or none, for Home), closing the
  // others — the hash counterpart of the card taps, with the same
  // persisted-flag writes the tap handlers make.
  const applyHashScreen = useCallback((screen: string) => {
    writeLoopOpen(screen === "geodetective");
    setLoopOpen(screen === "geodetective");
    writeColdTrailOpen(screen === "coldtrail");
    setColdTrailOpen(screen === "coldtrail");
    setSubjectsOpen(screen === "subjects");
    setMenu(
      screen === "menu:countries"
        ? { kind: "countries" }
        : screen === "menu:states"
          ? { kind: "states" }
          : null,
    );
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (run !== null) return; // a run in progress owns the screen
      const target = screenForHash(window.location.hash);
      if (target !== null) applyHashScreen(target);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [run, applyHashScreen]);

  // Deep link (INV5): a first visit carrying a screen hash opens
  // the screen it names — unless the 368 retry restore already
  // picked the first screen, or a saved run was restored over it.
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (!ready || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;
    if (bootRetryRef.current !== null) return;
    if (run !== null) return;
    const target = screenForHash(window.location.hash);
    if (target !== null && target !== "home") applyHashScreen(target);
  }, [ready, run, applyHashScreen]);

  return { ready, inAppScreen };
}
