import { useCallback, useEffect, useState } from "react";
import {
  buildCreationSources,
  CHALLENGE_REGION_ID,
  challengeRunFields,
  createChallengeRoute,
  type ChallengeCreation,
  type ChallengeRoute,
} from "@/game/challenge";
import { placesFor } from "@/game/generated-places";
import { REVIEW_DECK_REGION_ID } from "@/game/review-deck";
import {
  isResumable,
  resumeRun,
  startRun,
  type Edition,
  type Run,
} from "@/game/run";
import { trailDate } from "@/game/shell-helpers";
import { SCORING_VERSION } from "@/game/scoring";
import { type PickerDifficulty } from "@/game/tier-filter";
import { mintSeed, seenStoreFor } from "@/game/trail";
import { isEnabled, loadFlags } from "@/lib/flags";
import type { MapMode } from "@/lib/map-mode";
import { removeSessionStorageItem } from "../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";

/**
 * Everything the challenge surface needs from the composer. Setters
 * that are only ever set to null, or only ever open the picker, are
 * typed narrowly, the run-controller pattern.
 */
export type ChallengeSurfaceDeps = {
  commit: (next: Run) => void;
  ensureSession: (run: Run | null) => void;
  difficultyChoice: PickerDifficulty;
  welcomeMapPick: MapMode | null;
  setWelcomeMapPick: (mode: MapMode | null) => void;
  mapMode: MapMode;
  handleWelcomeMapMode: (mode: MapMode) => void;
  setMenu: (value: { kind: "challengeRegions" } | null) => void;
  setRun: (run: Run | null) => void;
  setStartError: (value: null) => void;
  readRun: () => Run | null;
  clearMc2Run: () => void;
  clearMc3Run: () => void;
  clearDrop: () => void;
};

/**
 * Step 9 — challenge receive and preview (game-app-map step 9).
 * Owns the received-challenge state (the boot effect writes into it
 * through the router hook), the preview-sheet state, the picker
 * callbacks, and the two commit-on-action callbacks (Start and
 * Done). The composer keeps the render sites; the router hook keeps
 * the boot decode.
 */
export function useChallengeSurface(deps: ChallengeSurfaceDeps) {
  const {
    commit,
    ensureSession,
    difficultyChoice,
    welcomeMapPick,
    setWelcomeMapPick,
    mapMode,
    handleWelcomeMapMode,
    setMenu,
    setRun,
    setStartError,
    readRun,
    clearMc2Run,
    clearMc3Run,
    clearDrop,
  } = deps;

  /**
   * Friend-challenge boot notice (cure round for PR #274): set by the
   * boot effect when a `#c=` link was tapped with the friendChallenges
   * flag ON but the challenge could not be loaded (broken link, unknown
   * place, or the Globe catalog failed to load). Home then shows the
   * child-friendly CHALLENGE_CHILD_COPY in a role="status" region for
   * the rest of that boot — a tapped link must never fail silently for
   * a kid, and there is no auto-dismiss, so a slow screen reader (or a
   * grown-up helping) still sees it. Flag OFF never sets it: with the
   * feature off there is nothing to explain.
   *
   * The notice is a TITLE plus an optional DETAIL line, because the
   * failure classes have different titles (governing manifest
   * §Q1-A6): a broken or unknown link titles itself with
   * CHALLENGE_CHILD_COPY and details the remedy, while the version
   * class — a well-formed link from a newer Meridian, or an mc3
   * region this build's registry predates — titles itself with
   * CHALLENGE_VERSION_COPY and carries no resend remedy (a resend
   * from the same newer build would fail identically). Screen-reader
   * users identify failures by their heading, so the classes must
   * not share one.
   */
  const [challengeBootNotice, setChallengeBootNotice] = useState<{
    title: string;
    detail: string | null;
  } | null>(null);

  /**
   * A validated mc2 challenge waiting on its welcome card (Package A):
   * the boot decoded and membership-checked the route, but NOTHING is
   * displaced yet — the player's saved run stays exactly where it was
   * until they tap Start on the card (manifest C6). hasSavedRun drives
   * the card's "your game is saved" line.
   */
  const [pendingChallenge, setPendingChallenge] = useState<{
    route: ChallengeRoute;
    hasSavedRun: boolean;
  } | null>(null);

  /** Home's friend-challenge entry points, flag-gated like every other
   * challenge surface (PlayLoaded reads the same flag for its own). */
  const [friendChallengesOn, setFriendChallengesOn] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFlags().then(() => {
      if (active) setFriendChallengesOn(isEnabled("friendChallenges"));
    });
    return () => {
      active = false;
    };
  }, []);

  /** A minted challenge waiting on its preview sheet (picker flow). */
  const [challengePreview, setChallengePreview] = useState<{
    creation: ChallengeCreation;
    edition: Edition;
    regionId: string;
  } | null>(null);
  const [challengePickError, setChallengePickError] = useState<string | null>(null);

  /**
   * The welcome card's Start tap — the moment a received mc2 challenge
   * commits (manifest C6). The run is built from the validated route
   * and persisted through commit/writeRun, which routes it to the mc2
   * key; the player's saved normal run (STORAGE_KEYS.pausedRun) is never touched,
   * so it survives underneath and is offered back when the challenge
   * ends. The challenge never banks into the session (ensureSession is
   * deliberately not called — the same isolation as mc1).
   */
  const startPendingChallenge = useCallback((routeOverride?: ChallengeRoute) => {
    // The welcome card's Start passes nothing (the pending route);
    // the verdict screen's Retry passes the completed route to play
    // it again at once — same commit path, no second welcome.
    const route = routeOverride ?? pendingChallenge?.route;
    if (!route) return;
    // Commit the welcome card's staged map pick NOW, on Start — the
    // moment the card's bargain binds. A flip followed by "Not now"
    // never reaches this line, so declining still commits nothing.
    if (welcomeMapPick && welcomeMapPick !== mapMode) {
      handleWelcomeMapMode(welcomeMapPick);
    }
    setWelcomeMapPick(null);
    const fields = challengeRunFields(route);
    clearDrop();
    // One challenge at a time across formats too: a saved challenge
    // in the OTHER format's slot would shadow this run at the next
    // boot (the read order is mc3 → mc2 → mc1), so starting here
    // retires it — displacement, as ever, commits on Start.
    if (fields.challengeOrigin === "mc3") clearMc2Run();
    if (fields.challengeOrigin === "mc2") clearMc3Run();
    // Cross-format displacement (manifest §3 persistence): if the
    // normal slot holds a saved CHALLENGE (an mc1 run), starting this
    // mc2 challenge displaces it — one challenge at a time, and the
    // displacement commits here, on Start, never on arrival. A saved
    // NORMAL run is not a challenge and is never touched: it survives
    // underneath and is offered back on Done.
    const savedNormal = readRun();
    if (savedNormal && savedNormal.regionId === CHALLENGE_REGION_ID) {
      removeSessionStorageItem(STORAGE_KEYS.pausedRun);
    }
    const run: Run = {
      ...startRun(
        {
          edition: fields.edition,
          regionId: fields.regionId,
          regionName: fields.regionName,
          dateKey: trailDate(),
          difficultyChoice,
        },
        route.ids,
        null,
      ),
      challengeRegionId: fields.challengeRegionId,
      challengeRadiusKm: fields.challengeRadiusKm,
      challengeOrigin: fields.challengeOrigin,
      // The winner block rides the run verbatim (mc3 only; null on
      // every other route): Package B's welcome goal and verdict read
      // it, and a completion re-share carries it losslessly.
      ...(route.winner ? { challengeWinner: route.winner } : {}),
    };
    commit(run);
    setPendingChallenge(null);
    setMenu(null);
  }, [pendingChallenge, difficultyChoice, commit, welcomeMapPick, mapMode, handleWelcomeMapMode]);

  /**
   * A challenge's Done tap (mc2/mc3; manifest §2, contract 6): the
   * challenge slots are cleared, and the normal run the challenge
   * displaced is offered back — resumed in place when it is still
   * resumable today. Nothing here touches the player's history: the
   * challenge never wrote any.
   */
  const handleChallengeDone = useCallback(() => {
    setStartError(null);
    clearDrop();
    clearMc2Run();
    clearMc3Run();
    setRun(null);
    setMenu(null);
    const saved = readRun();
    if (
      saved &&
      saved.regionId !== CHALLENGE_REGION_ID &&
      saved.regionId !== REVIEW_DECK_REGION_ID
    ) {
      const today = {
        edition: saved.edition,
        regionId: saved.regionId,
        regionName: saved.regionName,
        dateKey: trailDate(),
        difficultyChoice: saved.difficultyChoice,
      };
      if (isResumable(saved, today)) {
        const restored = resumeRun(saved, today);
        commit(restored);
        ensureSession(restored);
      }
    }
  }, [commit, ensureSession]);

  /** Picker flow, step 1: open the challenge region list. */
  const openChallengePicker = useCallback(() => {
    setChallengePickError(null);
    setMenu({ kind: "challengeRegions" });
  }, []);

  /**
   * Picker flow, step 2: deal a fresh 5 for the tapped region and show
   * the preview sheet. The catalog is the region's OWN places
   * (fail-closed dealing), widened inside the region only when the
   * band/seen steps run thin (buildCreationSources).
   */
  const pickChallengeRegion = useCallback(
    async (edition: Edition, regionId: string) => {
      setChallengePickError(null);
      try {
        const catalog = await placesFor(edition, regionId, undefined, false);
        const seenIds = new Set(seenStoreFor(edition, regionId, difficultyChoice).read());
        const sources = buildCreationSources({ catalog, choice: difficultyChoice, seenIds });
        const creation = createChallengeRoute({
          edition,
          regionId,
          scoringVersion: SCORING_VERSION,
          mode: "fresh",
          sources,
          dealSeed: mintSeed(),
        });
        if (!creation) {
          setChallengePickError("Not enough places there yet — pick another region.");
          return;
        }
        setChallengePreview({ creation, edition, regionId });
      } catch {
        setChallengePickError("That region could not load — check your connection and try again.");
      }
    },
    [difficultyChoice],
  );

  /**
   * "Challenge a friend — pick a map" from the review-complete screen
   * (manifest §1(e)). The review is finished, so the tap first runs
   * the same exit as the screen's Editions button (clear the drop,
   * end the run — the SESSION is untouched, no summary is fabricated:
   * review answers never banked into one), then opens the shipped
   * challenge-region mini-picker instead of the plain menu. The
   * friendChallenges flag is re-read at tap time (click-atomic, the
   * Package B precedent): if it flipped off after the screen booted,
   * the tap degrades to the plain exit — never a trap, never a
   * half-open picker. One state batch: Play unmounts and the menu
   * branch mounts in the same commit, so there is no home flash.
   */
  const handleReviewChallenge = useCallback(() => {
    setStartError(null);
    clearDrop();
    setRun(null);
    setMenu(isEnabled("friendChallenges") ? { kind: "challengeRegions" } : null);
  }, []);

  return {
    challengeBootNotice,
    setChallengeBootNotice,
    pendingChallenge,
    setPendingChallenge,
    friendChallengesOn,
    challengePreview,
    setChallengePreview,
    challengePickError,
    setChallengePickError,
    startPendingChallenge,
    handleChallengeDone,
    openChallengePicker,
    pickChallengeRegion,
    handleReviewChallenge,
  };
}
