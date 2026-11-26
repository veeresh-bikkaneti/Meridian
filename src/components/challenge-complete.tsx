import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CHALLENGE_MAX_PLACES,
  CHALLENGE_MIN_PLACES,
  CHALLENGE_REGION_NAME,
  CHALLENGE_RESHARE_LABEL,
  CHALLENGE_SHARE_LABEL,
  createChallengeRoute,
  buildCreationSources,
  buildFreshChallengeShareText,
  challengeFreshRouteLabel,
  challengeRadiusOf,
  encodeChallenge,
  routeCeiling,
  type ChallengeWinner,
} from "@/game/challenge";
import { challengeRouteTuple, readRouteAttempts, recordRouteCompletion } from "@/game/challenge-attempts";
import {
  classifyVerdict,
  hitMaskFromResults,
  mintWinnerBlock,
  passAlongReceipt,
  routeTierCeiling,
  VERDICT_HEADLINES,
  VERDICT_ICONS,
  verdictAriaSentence,
  verdictAttemptsFacts,
  verdictDuelLine,
  verdictMarginSentence,
  verdictSubLine,
  type VerdictClass,
} from "@/game/challenge-verdict";
import { SCORING_VERSION, type Difficulty } from "@/game/scoring";
import type { Starter } from "@/game/starters";
import type { Run } from "@/game/run";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import { ShareButton } from "./share-button";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";
import {
  getSessionStorageItem,
  setSessionStorageItem,
} from "../platform/storage/browser-storage.ts";
import { challengeRecordedKeyDef, STORAGE_KEYS } from "../platform/storage/keys.ts";

/**
 * Step 12 (TD-06.9) — the challenge completion surface, moved verbatim
 * out of game-app.tsx: the completion screen, the verdict block, and
 * the exactly-once completion recorder. The ChallengeCompleteShell
 * below owns the `<main>` shell and the verdict settle flags; the
 * composer passes the Grandpa poster/video URLs and the end-of-flow
 * HomeButton in as slots (the grandpa-media import and the HomeButton
 * import stay on the composer until TD-06.4).
 */

/**
 * Package B (§Q2-B3): record a challenge completion exactly once per
 * run, however often the completion screen remounts or the tab
 * reloads at it. The marker lives in session storage — the same
 * lifetime as the run slots themselves — keyed by the run's seed, so
 * one play-through can never count twice and a retried route (a new
 * run, a new seed) always counts again. Returns the player's
 * completion count for the route INCLUDING this completion, and the
 * winner block minted from their play (ratchet + farming guard live
 * in challenge-verdict.ts). mc1 runs return null: that surface is
 * frozen and carries no winner block.
 */
function recordChallengeCompletion(run: Run): {
  attempts: number;
  minted: ReturnType<typeof mintWinnerBlock>;
} | null {
  if (run.challengeOrigin !== "mc2" && run.challengeOrigin !== "mc3") return null;
  const tuple = challengeRouteTuple({
    scoringVersion: SCORING_VERSION,
    edition: run.edition,
    regionId: run.challengeRegionId ?? "globe",
    ids: run.poolIds,
  });
  const marker = challengeRecordedKeyDef(run.seed);
  let attempts: number;
  // The port reads a blocked or missing marker as absent and never
  // throws, so the old catch's outcome (the stored count + 1, which
  // is exactly what recordRouteCompletion returns when its own
  // store is unreadable) is the else branch's outcome too.
  if (getSessionStorageItem(marker)) {
    attempts = readRouteAttempts(tuple);
  } else {
    attempts = recordRouteCompletion(tuple);
    setSessionStorageItem(marker, tuple);
  }
  const minted = mintWinnerBlock({
    myScore: run.results.reduce((s, r) => s + r.score, 0),
    myMask: hitMaskFromResults(run.results),
    myAttempts: attempts,
    incomingBest: run.challengeWinner?.bestScore ?? null,
  });
  return { attempts, minted };
}

/**
 * The verdict (governing manifest §Q4, Package B) — shown when the
 * completed route carried a winner block. Presentation only: the
 * taxonomy, copy, and mint were decided by challenge-verdict.ts and
 * ChallengeComplete; this component renders them under the veto-
 * rewritten motion spec (final scores at frame 0, no count-up ever;
 * the bar sweeps by transform; the verdict word fades at ~650 ms;
 * reduced motion = every final state, static; a tap, any keydown,
 * or the settle timer settles — late interactive elements are inert
 * until then, so nothing is focusable while invisible (A-291-3);
 * focus goes to the heading on mount and never moves again).
 */
export function ChallengeVerdict({
  run,
  winner,
  completion,
  regionCatalog,
  posterUrl,
  videoUrl,
  settled,
  settledByGesture,
}: {
  run: Run;
  winner: ChallengeWinner;
  completion: { attempts: number; minted: ReturnType<typeof mintWinnerBlock> };
  regionCatalog?: readonly Starter[] | null;
  /** Grandpa clip URLs, passed in as slots from the composer: the
   * grandpa-media import stays on the composer until TD-06.4. */
  posterUrl: string;
  videoUrl: string;
  /** Choreography settled (tap, any key, or the settle timer) —
   * until then the late-arriving interactive elements are inert,
   * so nothing is focusable while invisible (A-291-3). */
  settled: boolean;
  /** Settled by a player gesture (tap or keydown) rather than the
   * auto-settle timer. The Grandpa clip's pause subscribes to THIS
   * flag only (PR #295 cure round 2 — the timer carries no intent
   * to stop motion); nothing else consumes it. */
  settledByGesture: boolean;
}) {
  const mine = run.results.reduce((s, r) => s + r.score, 0);
  const n = run.poolIds.length;
  // The quoted ceiling is the route's REAL max (owner D2 amendment,
  // 2026-11-01): each stop at its own tier, summed in play order —
  // the tier-blind codec bound (routeCeiling) would quote a
  // "possible" no perfect run could reach on an easy route. When a
  // place's tier can't be resolved from the catalog, the codec bound
  // stands for the whole route (never a fabricated per-stop number).
  const routeDifficulties = run.poolIds.map(
    (id) => regionCatalog?.find((p) => p.id === id)?.difficulty ?? null,
  );
  const ceiling = routeDifficulties.every((d) => d !== null)
    ? routeTierCeiling(routeDifficulties as Difficulty[])
    : routeCeiling(n);
  const cls = classifyVerdict(mine, winner.bestScore);
  const myHits = run.results.filter((r) => r.hit).length;
  const theirHits = run.poolIds.reduce(
    (count, _id, i) => count + (((winner.senderMask >> (15 - i)) & 1) === 1 ? 1 : 0),
    0,
  );
  // Place names for the strip: every dot carries its place's name
  // (aria always; visible on tap/focus). If any name can't be
  // resolved, the strip ships as header counts only — the manifest's
  // own fallback — rather than naming some stops and not others.
  const names = run.poolIds.map(
    (id) => regionCatalog?.find((p) => p.id === id)?.name ?? null,
  );
  const stripNames = names.every((name) => name !== null) ? (names as string[]) : null;
  const bothMissed = stripNames
    ? run.poolIds
        .map((_id, i) => ({ i, name: stripNames[i]! }))
        .filter(
          ({ i }) =>
            !run.results[i]?.hit && ((winner.senderMask >> (15 - i)) & 1) === 0,
        )
        .map(({ name }) => name)
    : [];
  const duelLine = verdictDuelLine(mine, winner);
  const facts = verdictAttemptsFacts({
    winner,
    ownCompletions: completion.attempts,
    farmingGuardBound: completion.minted.farmingGuardBound,
  });
  const [announce, setAnnounce] = useState("");
  // The Grandpa clip at the top of the screen is decoration, so it
  // follows the same reduced-motion rule as the rest of the verdict
  // choreography: reduced motion gets the still keyframe, never a
  // moving picture (see the render below).
  const reducedMotion = usePrefersReducedMotion();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // WCAG 2.2.2 cure (panel BLOCK 2 on PR #295): the looping clip
  // needs a stop mechanism beside the text kids read. Two of them,
  // complementary: (1) when the player settles the choreography
  // with a gesture — a tap or a keydown — the clip pauses and holds
  // its frame; (2) the overlay toggle rendered with the video
  // pauses/plays it at any moment, and is on its own the
  // always-available stop 2.2.2 asks for. The auto-settle timer
  // does NOT pause the clip (cure round 2, panel re-vote on
  // PR #295): the timer is not a gesture and carries no intent to
  // stop motion, so the clip keeps playing through the default
  // reading dwell — this effect subscribes to ChallengeComplete's
  // gesture latch, never to the undifferentiated settled flag.
  // clipPaused is driven by the element's own play/pause events,
  // so the toggle's label always matches what the clip is doing.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clipPaused, setClipPaused] = useState(false);
  useEffect(() => {
    if (settledByGesture) videoRef.current?.pause();
  }, [settledByGesture]);
  const toggleClip = () => {
    const clip = videoRef.current;
    if (!clip) return;
    if (clip.paused) {
      // A rejected play() (autoplay policy, interrupted load) must
      // not surface as an unhandled rejection — the clip simply
      // stays paused, and the toggle's label already says so.
      clip.play().catch(() => {});
    } else {
      clip.pause();
    }
  };
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    // The one aria-live sentence fires AT the verdict-word point
    // (~650 ms in full motion; immediately under reduced motion).
    const sentence = verdictAriaSentence({
      cls, mine, best: winner.bestScore, myHits, placeCount: n, ceiling,
    });
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setAnnounce(sentence);
      return;
    }
    const t = setTimeout(() => setAnnounce(sentence), 650);
    return () => clearTimeout(t);
    // Mount-only: the verdict is computed once, from the finished run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fillPct = Math.min(100, (mine / ceiling) * 100);
  const tickPct = Math.min(100, (winner.bestScore / ceiling) * 100);
  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {/* "Grandpa Was Already There" (owner's dispatch, 2026-11-01):
          the animated keyframe sits at the top of every verdict —
          win, hold, near-miss, and loss alike. The clip itself is
          decorative (aria-hidden, never focusable), so it cannot
          disturb the aria-live announcement above or the focus
          order. Two stop mechanisms keep the loop honest beside the
          verdict text (WCAG 2.2.2, panel cure on PR #295): a tap or
          keydown that settles the choreography pauses it (see the
          effect above — the auto-settle timer deliberately does
          not), and the corner toggle pauses/plays it at any time —
          that toggle is a media control for this clip, not a
          feature entry. Both
          branches reserve the 3:2 box (aspect-[3/2]) so the headline
          and score bar never shift when the media loads (CLS, panel
          cure on PR #295). The poster shows until the clip can play,
          and under reduced motion the still keyframe renders instead
          of the video. The clip URLs arrive as props from the composer, which owns
          the grandpa-media import. */}
      {reducedMotion ? (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          data-testid="challenge-verdict-grandpa"
          className="mb-4 aspect-[3/2] w-full max-w-md rounded-2xl"
        />
      ) : (
        <div className="relative mb-4 w-full max-w-md">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            data-testid="challenge-verdict-grandpa"
            className="block aspect-[3/2] w-full rounded-2xl"
            onPlay={() => setClipPaused(false)}
            onPause={() => setClipPaused(true)}
          />
          <button
            type="button"
            onClick={toggleClip}
            onKeyDown={(e) => {
              // The activation key belongs to this control: without
              // this, the screen's any-keydown settle would pause the
              // clip in the same gesture, and the click that follows
              // would read "paused" and play it again — the opposite
              // of the press. Other keys still settle as designed.
              if (e.key === " " || e.key === "Enter") e.stopPropagation();
            }}
            aria-pressed={clipPaused}
            aria-label={clipPaused ? "Play the cartoon" : "Pause the cartoon"}
            data-testid="challenge-verdict-grandpa-toggle"
            className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {clipPaused ? (
              <span
                aria-hidden="true"
                className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white"
              />
            ) : (
              <span aria-hidden="true" className="flex gap-1">
                <span className="h-4 w-1 rounded-sm bg-current" />
                <span className="h-4 w-1 rounded-sm bg-current" />
              </span>
            )}
          </button>
        </div>
      )}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="verdict-word mt-2 font-display text-4xl text-fg outline-none"
        data-testid="challenge-complete"
      >
        <span aria-hidden="true" className="mr-2 inline-block min-w-6 text-center">
          {VERDICT_ICONS[cls]}
        </span>
        {VERDICT_HEADLINES[cls]}
      </h1>
      <p className="mt-3 text-lg text-fg">{verdictSubLine(mine, ceiling)}</p>
      <div className="relative mt-6 max-w-md pb-6">
        <div
          className="relative h-3 overflow-visible rounded-full bg-black/10"
          role="img"
          aria-label={`Your score ${mine} of ${ceiling} possible. The target was ${winner.bestScore}.`}
        >
          <div
            className="verdict-bar-fill absolute inset-y-0 left-0 rounded-full bg-fg"
            style={{ width: `${fillPct}%` }}
          />
          <div
            className="absolute -inset-y-0.5 w-1 rounded"
            style={{
              left: `calc(${tickPct}% - 2px)`,
              // F-291-2 cure: raw gold measured 1.19:1 on the light
              // track and 1.52:1 on the dark theme's near-white fill.
              // The theme-aware gold (--gold-ink) carries ≥3:1 against
              // track and page where it is defined — the light media
              // block and the paper theme. It is NOT defined in the
              // default :root (dark) — the #f2c14e value lives only
              // in the dormant [data-theme="night"] block and no code
              // sets data-theme — so the fallback IS the default-dark
              // colour (and the night colour, if that theme ever
              // ships): #f2c14e, 11.2:1 on the dark page. A 1px ring
              // in the page colour separates the tick from the fg
              // fill (≥13:1) where the fill reaches it. (The fallback
              // was added in the panel cure-2 round: without it the
              // tick was transparent — invisible — in default dark.)
              background: "var(--gold-ink, #f2c14e)",
              boxShadow: "0 0 0 1px var(--bg)",
            }}
            aria-hidden="true"
          />
          <span
            className="absolute -top-6 text-xs font-semibold whitespace-nowrap text-muted"
            style={{
              left: `calc(${tickPct}% - 2px)`,
              // Near the right edge the label would run past the bar
              // (and the phone): flip it to end at the tick instead.
              transform: tickPct > 80 ? "translateX(-100%)" : undefined,
            }}
          >
            TARGET {winner.bestScore.toLocaleString("en-US")}
          </span>
          {cls === "win" ? (
            <span
              className="verdict-pulse absolute top-4 rounded bg-[#f2c14e] px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-black"
              style={{
                left: `calc(${tickPct}% - 2px)`,
                transform: tickPct > 80 ? "translateX(-100%)" : undefined,
              }}
            >
              ✓ PASSED
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-xl font-semibold text-fg">
        {verdictMarginSentence(cls, mine, winner.bestScore)}
      </p>
      {duelLine ? (
        <p className="verdict-late mt-2 text-base text-muted">{duelLine}</p>
      ) : null}
      {/* A-291-3: the strip's dots fade in from ~850 ms — until the
          choreography settles they are inert, so a keyboard user can
          never tab onto an invisible dot. Visuals are untouched. */}
      <div className="mt-5" data-testid="challenge-verdict-strip" inert={!settled}>
        <p className="text-base font-semibold text-fg">
          Stop by stop — you landed {myHits}, they landed {theirHits}.
        </p>
        {stripNames ? (
          <>
            <div className="mt-2 flex items-center gap-1.5" aria-label="Your stops">
              {stripNames.map((name, i) => {
                const hit = run.results[i]?.hit ?? false;
                return (
                  <span
                    key={`mine-${i}`}
                    tabIndex={0}
                    role="img"
                    aria-label={`Stop ${i + 1}: ${name} — ${hit ? "you landed it" : "you missed"}`}
                    className={`verdict-strip-dot group relative flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      // F-291-1 cure: text-bg, not text-white — the fg
                      // disc is near-white in the default/dark themes,
                      // so a white ✓ measured 1.10:1 (invisible).
                      hit ? "bg-fg text-bg" : "border-2 border-current"
                    }`}
                    style={{ "--verdict-i": i } as CSSProperties}
                  >
                    {hit ? "✓" : "✕"}
                    <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white opacity-0 group-focus:opacity-100 group-hover:opacity-100">
                      {name}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5" aria-label="Your friend's stops">
              {stripNames.map((name, i) => {
                const hit = ((winner.senderMask >> (15 - i)) & 1) === 1;
                return (
                  <span
                    key={`theirs-${i}`}
                    tabIndex={0}
                    role="img"
                    aria-label={`Stop ${i + 1}: ${name} — ${hit ? "your friend landed it (their word)" : "your friend missed (their word)"}`}
                    className="verdict-strip-dot group relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-dotted text-[11px] opacity-60"
                    style={{ "--verdict-i": i } as CSSProperties}
                  >
                    {hit ? "✓" : ""}
                    <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white opacity-0 group-focus:opacity-100 group-hover:opacity-100">
                      {name}
                    </span>
                  </span>
                );
              })}
            </div>
            <p className="mt-1.5 text-sm text-muted">Your friend's stops — their word.</p>
          </>
        ) : null}
        {bothMissed.length > 0 ? (
          <p className="mt-2 text-base text-fg">
            Both missed: {bothMissed.join(", ")} — the hard stops.
          </p>
        ) : null}
      </div>
      {/* The disclosure repeats here (§Q2 hardening): the attested
          row must never wear measured-looking glyphs undisclosed. */}
      <p className="verdict-late mt-4 text-sm text-muted" data-testid="challenge-verdict-disclosure">
        One honest note: this score is your friend's word — Meridian can't check scores
        sent in links.
      </p>
      {facts.length > 0 ? (
        <div className="verdict-late mt-3" data-testid="challenge-verdict-facts">
          {facts.map((fact) => (
            <p key={fact} className="text-sm text-muted">
              {fact}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChallengeComplete({
  run,
  total,
  onDone,
  onRetry,
  shareEnabled,
  regionCatalog,
  posterUrl,
  videoUrl,
  homeButton,
  settled,
  settledByGesture,
  onSettle,
  onSettleByGesture,
}: {
  run: Run;
  total: number;
  onDone: () => void;
  /** Verdict-screen Retry (Package B): replay the received route at
   * once. Only offered when the route carried a winner block. */
  onRetry?: () => void;
  /** The completion re-share renders only while the flag is on: a flag
   * flipped off mid-challenge drops the share, never the run (§4). */
  shareEnabled: boolean;
  /** The completed route's OWN region catalog (Package B, §1(f)): the
   * fresh secondary deals from the region, never from the route itself.
   * Null while the catalog has not loaded (or for mc1 runs, whose
   * completion surface is frozen and never shows the secondary). */
  regionCatalog?: readonly Starter[] | null;
  /** Grandpa clip URLs + the end-of-flow HomeButton, passed in as
   * slots from the composer (see the module header). */
  posterUrl: string;
  videoUrl: string;
  homeButton: ReactNode;
  /** Verdict settle flags, owned by the ChallengeCompleteShell below:
   * the shell mounts only with the completion screen, so a second
   * completed challenge starts unsettled. */
  settled: boolean;
  settledByGesture: boolean;
  onSettle: () => void;
  onSettleByGesture: () => void;
}) {
  // Origin rule (manifest §2, contract 3, as amended by the mc3 delta
  // §3.3): a route re-shares without ever losing information — an mc1
  // route stays mc1 byte for byte; an mc2 route forward-upgrades to
  // mc3 with its own region named; an mc3 route stays mc3. Never a
  // downgrade.
  //
  // Package B (§Q2-B2/B4): reaching this screen IS a completion. It is
  // recorded exactly once per run (recordChallengeCompletion), and
  // the pass-along mints a NEW winner block from THIS player's play —
  // their score, their mask, their attempts — with best′ ratcheted
  // against the received chain best under the farming guard. Package
  // A carried the received block losslessly because nothing minted
  // yet; re-issuing it now would attest the PREVIOUS player's mark
  // under a new sender, so the mint replaces it. When the mint
  // produces no block (an all-miss chain start), the re-share is an
  // open route again — a zero target is never a chain state.
  const [completion] = useState(() => recordChallengeCompletion(run));
  // Verdict tap-to-settle (§Q4): the settled flags live on the
  // ChallengeCompleteShell (see below) and arrive as props, so the
  // CSS snap reaches every animated element — the
  // verdict block AND the pass-along share container (a sibling
  // subtree, which a flag inside ChallengeVerdict could never
  // cover). Cure round 2 on PR #295: the gesture latch records
  // whether the settle came from a player gesture, so the Grandpa
  // clip's pause consumes the gesture flag, never the timer's.
  const incomingWinner = run.challengeWinner ?? null;
  // A-291-3: settling is not pointer-only. Any keydown settles (the
  // keydown fires before the focus move, so the first Tab lands on
  // already-visible elements — see onKeyDown on the root below), and
  // a timer settles when the choreography completes (~1,600 ms;
  // immediately under reduced motion, where every element is
  // already at its final state).
  useEffect(() => {
    if (!incomingWinner) return;
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => onSettle(), reduced ? 0 : 1600);
    return () => clearTimeout(t);
  }, [incomingWinner, onSettle]);
  const myScoreRaw = run.results.reduce((s, r) => s + r.score, 0);
  const mintedWinner = completion?.minted.winner ?? null;
  const isMc2 = run.challengeOrigin === "mc2" || run.challengeOrigin === "mc3";
  const mc2Creation = isMc2
    ? createChallengeRoute({
        edition: run.edition,
        regionId: run.challengeRegionId ?? "globe",
        scoringVersion: SCORING_VERSION,
        mode: "exact",
        exactIds: run.poolIds,
        // The radius freeze in full (manifest §2.3 + §6): the route
        // re-encodes at the radius it was JUDGED at — an in-tolerance
        // pinned circle (rad 90 vs the computed 87) survives the
        // re-share, never re-pins.
        originFormat: "mc3",
        radiusKmOverride: run.challengeRadiusKm,
        // The block minted from this completion (above) — absent
        // when the mint produced none.
        winner: mintedWinner ?? undefined,
      })
    : null;
  // "Share just the route" (§Q4): the same route with NO winner block
  // — sharing never requires disclosing a result. Offered on every
  // mc2-family completion, verdict or not.
  const routeOnlyCreation = isMc2
    ? createChallengeRoute({
        edition: run.edition,
        regionId: run.challengeRegionId ?? "globe",
        scoringVersion: SCORING_VERSION,
        mode: "exact",
        exactIds: run.poolIds,
        originFormat: "mc3",
        radiusKmOverride: run.challengeRadiusKm,
      })
    : null;
  const routeOnlyUrl =
    routeOnlyCreation && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${routeOnlyCreation.fragment}`
      : "";
  const routeOnlyText = routeOnlyCreation
    ? buildFreshChallengeShareText({
        placeCount: routeOnlyCreation.placeCount,
        regionName: routeOnlyCreation.regionName,
        radiusKm: routeOnlyCreation.radiusKm,
        url: routeOnlyUrl,
      })
    : "";
  const challengeHash = isMc2
    ? (mc2Creation?.fragment ?? null)
    : run.poolIds.length >= CHALLENGE_MIN_PLACES && run.poolIds.length <= CHALLENGE_MAX_PLACES
      ? encodeChallenge(run.poolIds, SCORING_VERSION)
      : null;
  const challengeUrl =
    challengeHash && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${challengeHash}`
      : "";
  // The re-share text, built once so the button and its failure fallback
  // below can never drift apart. It is a RECEIPT (governing manifest
  // §Q3): one of the five byte-exact forms — by verdict class when the
  // route carried a target, the chain-start form when it didn't. No
  // version line (receipts never carry one), no tries clause, and no
  // margin number in a loss.
  const score = myScoreRaw.toLocaleString("en-US");
  const verdictClass: VerdictClass | null = incomingWinner
    ? classifyVerdict(myScoreRaw, incomingWinner.bestScore)
    : null;
  const challengeText = isMc2
    ? `${passAlongReceipt({
        cls: verdictClass ?? "chain-start",
        mine: myScoreRaw,
        newBest: mintedWinner?.bestScore ?? incomingWinner?.bestScore ?? myScoreRaw,
        regionName: mc2Creation?.regionName ?? run.regionName,
      })}\n${challengeUrl}`
    : `Play the same ${total} places on the Globe! I scored ${score}.\n${challengeUrl}`;
  // The fresh secondary (manifest §1(f), Package B): a NEW route in the
  // completed route's region, dealt from the region catalog — the
  // sources are built with no runPoolIds on purpose, so the route just
  // played can never become its own deal source. mc2 completions only:
  // the mc1 completion surface is frozen (§2). Like the re-share, it is
  // creation, so it renders only while the flag is on (§4). The deal
  // seed is the run's own seed — deterministic for a given completion.
  const freshCreation =
    isMc2 && shareEnabled && regionCatalog
      ? createChallengeRoute({
          edition: run.edition,
          regionId: run.challengeRegionId ?? "globe",
          scoringVersion: SCORING_VERSION,
          mode: "fresh",
          sources: buildCreationSources({
            catalog: regionCatalog,
            choice: run.difficultyChoice,
          }),
          dealSeed: run.seed,
        })
      : null;
  const freshUrl =
    freshCreation && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${freshCreation.fragment}`
      : "";
  const freshText = freshCreation
    ? buildFreshChallengeShareText({
        placeCount: freshCreation.placeCount,
        regionName: freshCreation.regionName,
        radiusKm: freshCreation.radiusKm,
        url: freshUrl,
      })
    : "";
  return (
    <>
      {/* The shared shell (PR 3 Step 3.7): SiteHeader carries the
          one Home control at the top — this screen had no header
          at all. The verdict block keeps its vertical centring in
          the space below the header; a tap on the header settles
          the choreography like any other tap on this screen (the
          root's own settle rule). The primary HomeButton in the
          actions (challenge-done) stays: the end-of-flow exit
          beside the shares. No failure branch exists on this
          screen, so there is nothing to route to ErrorScreen. */}
      <SiteHeader onHome={onDone} status={null} mute={null} />
      <div className="flex flex-1 flex-col justify-center">
      <p className="text-sm tracking-wide text-muted uppercase">
        {isMc2 ? run.regionName : CHALLENGE_REGION_NAME}
      </p>
      {incomingWinner && completion ? (
        // The verdict (§Q4) replaces the plain completion headline
        // when the route carried a target: verdict word → score pair
        // + target bar → margin → duel → strip. The "landed inside"
        // sentence is cut here — the strip header carries the counts.
        <ChallengeVerdict
          run={run}
          winner={incomingWinner}
          completion={completion}
          regionCatalog={regionCatalog}
          posterUrl={posterUrl}
          videoUrl={videoUrl}
          settled={settled}
          settledByGesture={settledByGesture}
        />
      ) : (
        <>
          <h1 className="mt-2 font-display text-4xl text-fg" data-testid="challenge-complete">
            Route complete! You scored {score} across {total} places.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            You landed inside the {challengeRadiusOf(run)} km circle on {run.hits} of {total} stops.
          </p>
        </>
      )}
      <div className="mt-6 flex max-w-xs flex-col gap-3">
        {verdictClass === "near-miss" && onRetry ? (
          // NEAR-MISS: retry is the primary action (§Q4) — the route
          // is right there and the target nearly fell.
          <Button onClick={onRetry} data-testid="challenge-retry">
            Try this route again
          </Button>
        ) : null}
        {challengeUrl && shareEnabled ? (
          <div
            data-testid="challenge-share-container"
            data-challenge-url={challengeUrl}
            className={incomingWinner ? "verdict-last" : undefined}
            // A-291-3: the pass-along fades in last (~1,400 ms) — it
            // stays inert until settled so it is never focusable
            // while invisible. Non-verdict completions never gate.
            inert={incomingWinner ? !settled : undefined}
          >
            <ShareButton
              title="Meridian friend challenge"
              text={challengeText}
              url={challengeUrl}
              label={isMc2 ? CHALLENGE_RESHARE_LABEL : CHALLENGE_SHARE_LABEL}
              variant={verdictClass === "win" ? "primary" : "secondary"}
              className="w-full"
              failureFallback={
                // If the share sheet and the clipboard both fail, the
                // button says "Copy manually" — the link has to be
                // somewhere visible to copy, or that state is a dead
                // end. Same selectable-text block the GeoDetective
                // share uses on themed surfaces.
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                  {challengeText}
                </pre>
              }
            />
          </div>
        ) : null}
        {freshCreation && freshUrl ? (
          <div data-testid="challenge-fresh-share-container" data-challenge-url={freshUrl}>
            <ShareButton
              title="Meridian friend challenge"
              text={freshText}
              url={freshUrl}
              label={challengeFreshRouteLabel(freshCreation.regionName)}
              className="w-full"
              failureFallback={
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                  {freshText}
                </pre>
              }
            />
          </div>
        ) : null}
        {routeOnlyCreation && routeOnlyUrl && shareEnabled ? (
          // "Share just the route" (§Q4): always offered on an
          // mc2-family completion — the same route, no winner block,
          // no result disclosed.
          <div data-testid="challenge-route-only-container" data-challenge-url={routeOnlyUrl}>
            <ShareButton
              title="Meridian friend challenge"
              text={routeOnlyText}
              url={routeOnlyUrl}
              label="Share just the route"
              variant="secondary"
              className="w-full"
              failureFallback={
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                  {routeOnlyText}
                </pre>
              }
            />
          </div>
        ) : null}
        {(verdictClass === "hold" || verdictClass === "loss") && onRetry ? (
          // HOLD/LOSS: retry rides quieter, under the shares (§Q4).
          <Button variant="secondary" onClick={onRetry} data-testid="challenge-retry">
            Try this route again
          </Button>
        ) : null}
        {homeButton}
      </div>
      </div>
    </>
  );
}

/**
 * Step 12 cure (TD-06.9): the completion screen's `<main>` shell and
 * its verdict settle flags. The flags live HERE — local useState in a
 * component that mounts only when the completion screen shows — as
 * they did on main: a second completed challenge starts unsettled
 * because the shell remounts, and no settle state or reset effect
 * lives on the long-lived PlayLoaded branch during play. The Grandpa
 * poster/video URLs and the end-of-flow HomeButton still arrive as
 * slots from the composer.
 */
export function ChallengeCompleteShell({
  run,
  total,
  onDone,
  onRetry,
  shareEnabled,
  regionCatalog,
  posterUrl,
  videoUrl,
  homeButton,
}: {
  run: Run;
  total: number;
  onDone: () => void;
  /** Verdict-screen Retry (Package B): replay the received route at
   * once. Only offered when the route carried a winner block. */
  onRetry?: () => void;
  /** The completion re-share renders only while the flag is on: a flag
   * flipped off mid-challenge drops the share, never the run (§4). */
  shareEnabled: boolean;
  /** The completed route's OWN region catalog (Package B, §1(f)).
   * Null while the catalog has not loaded. */
  regionCatalog?: readonly Starter[] | null;
  /** Grandpa clip URLs + the end-of-flow HomeButton, passed in as
   * slots from the composer (see the module header). */
  posterUrl: string;
  videoUrl: string;
  homeButton: ReactNode;
}) {
  const [verdictSettled, setVerdictSettled] = useState(false);
  const [verdictSettledByGesture, setVerdictSettledByGesture] = useState(false);
  const settleVerdict = useCallback(() => setVerdictSettled(true), []);
  const settleVerdictByGesture = useCallback(() => {
    setVerdictSettled(true);
    setVerdictSettledByGesture(true);
  }, []);
  const incomingWinner = run.challengeWinner ?? null;
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8"
      data-verdict-settled={incomingWinner ? verdictSettled : undefined}
      onClick={incomingWinner ? settleVerdictByGesture : undefined}
      onKeyDown={incomingWinner ? settleVerdictByGesture : undefined}
    >
      <ChallengeComplete
        run={run}
        total={total}
        onDone={onDone}
        onRetry={onRetry}
        shareEnabled={shareEnabled}
        regionCatalog={regionCatalog}
        posterUrl={posterUrl}
        videoUrl={videoUrl}
        homeButton={homeButton}
        settled={verdictSettled}
        settledByGesture={verdictSettledByGesture}
        onSettle={settleVerdict}
        onSettleByGesture={settleVerdictByGesture}
      />
    </main>
  );
}
