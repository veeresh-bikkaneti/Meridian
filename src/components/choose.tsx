/**
 * Choose.tsx — the Home screen (game-app-map step 21, TD-06.16).
 *
 * The home menu: hero, expedition picker, case cards, review deck,
 * journal, grown-ups. Moved out of src/components/game-app.tsx under
 * Veeresh's ruling (2026-11-27): the shared page shell owns the only
 * <main>; this screen renders a fragment and the shell wraps the
 * <Choose> call site in a <main> carrying CHOOSE_MAIN_CLASSNAME
 * (B1: byte-equivalent to main's Home <main>). The picker block stays
 * as-is (PR C removes it). Passport and @/assets/** arrive as slots
 * from the composer (lockedLoop, mapModeControl) — never reclassified.
 * SiteFooter renders in the composer, after </main> (B2).
 */
import { preloadTerritory } from "@/game/territory";
import { type PickerDifficulty } from "@/game/tier-filter";
import { trailDate } from "@/game/shell-helpers";
import { CardFilm, type CardFilmMedia } from "./card-film";
import { GlobeChunkFallback } from "./home-globe";
import { Compass, Flag, Globe2, MapPin } from "lucide-react";
import { SoundToggle } from "./SoundToggle";
import { playDifficultySelect } from "@/game/audio/sfx";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import { HighContrastToggle } from "./high-contrast-toggle";
import { CometEmblem } from "./comet-emblem";
import {
  confidenceText,
  createJournalRotation,
  journalImageUrl,
  journalSetAt,
  journalSetByIndex,
  journalSetCount,
  journalSetIndexAt,
  loadJournalNotes,
  nextEntryCountdown,
} from "./home-journal";
import {
  StorytellerBannerBoundary,
  StorytellerBannerSkeleton,
} from "./storyteller-banner-shell";
import { JournalBoundary } from "./journal-boundary";
import { isLoopLocked, type AgeBandId } from "@/game/age-profile";
import { numberWord } from "@/lib/number-words";
import { geodetectiveConfig } from "@/game/age-profile/difficulty";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { peekLoopProgress } from "@/game/loop/store";
import { REVIEW_DECK_COPY } from "@/game/review-deck";
import { type ResetHistoryResult } from "@/game/reset-history";
import { ResetHistoryControl } from "./reset-history-control";
import { AtlasBackdrop, HeroTrailOverlay, HeroTrekkerOverlay } from "./hero-overlays";

const StorytellerHomeHost = lazy(() => import("./storyteller-home"));
// Journal movie player: React.lazy like the hosts above — the player and
// its movie/transcript code stay out of the entry bundle and load with the
// journal section, instead of taxing every first load (bundle budget).
const JournalPlayer = lazy(() =>
  import("./journal-player").then((m) => ({ default: m.JournalPlayer })),
);
// v5 hero globe: React.lazy like the storyteller host — the Three.js chunk
// never lands in the initial bundle; HomeGlobe itself dynamically imports
// three only when the hero nears the viewport.
// A failed globe-chunk fetch must never take the home page down with it:
// the lazy factory catches to a static-disc component (the same fallback
// HomeGlobe renders for reduced-motion / no-WebGL). The fallback lives in
// home-globe.tsx (which already imports the fallback URL); choose.tsx
// only imports the component — a components/root file may not import
// @/assets/** directly (layer rule; the composer passes media as slots).
const HomeGlobe = lazy(() =>
  withChunkTimeout(import("./home-globe"), "the home globe")
    .then((m) => ({ default: m.HomeGlobe }))
    .catch(() => ({ default: GlobeChunkFallback })),
);

/**
 * F2b intent prefetch for the edition + case cards: hovering, focusing,
 * or pressing a card starts the countries-50m load (scorePlace's region
 * bonus + the reveal pin-compare read it). Fire-and-forget —
 * preloadTerritory never rejects, and openRun awaits it before any run
 * commits, so a cold prefetch never changes the outcome, only the wait.
 *
 * Deliberately NO component-chunk prefetch for Loop/Trail (Core F-4):
 * the old helpers fired the screens' dynamic import() on this same
 * intent signal, but a FAILED import() is negatively cached by the
 * browser for the life of the document (see map-error-boundary.tsx) —
 * a transient hover-time failure therefore guaranteed the click itself
 * failed into the error card. The territory DATA prefetch is safe to
 * keep by contrast: its loader evicts a failed load and retries on the
 * next call, and a miss degrades fail-closed at the readers instead of
 * surfacing an error card.
 *
 * #211 item 1: FOCUS is the weakest of the three intent signals — a
 * keyboard or screen-reader user tabs PAST these cards on the way to
 * somewhere else, and focus alone starts a ~206 KB (brotli) download.
 * On a Save-Data connection that spend is exactly what the player
 * asked the browser to avoid, so the focus-triggered prefetch is
 * gated on the Save-Data signal (the home-globe precedent in
 * home-globe.tsx reads the same `navigator.connection.saveData`).
 * Pointer intent (hover / press) is deliberate and stays ungated;
 * and nothing about play changes — a tap still awaits the load in
 * openRun before the run commits.
 */
function prefetchTerritoryData(): void {
  void preloadTerritory();
}

/** True when the browser reports the player's Save-Data preference. */
function saveDataEnabled(): boolean {
  try {
    return Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
  } catch {
    return false;
  }
}

/** The focus-triggered variant: skipped entirely under Save-Data. */
function prefetchTerritoryDataOnFocus(): void {
  if (saveDataEnabled()) return;
  prefetchTerritoryData();
}

/** Item 30: the Home card spells the band's guess cap as a word,
 *  read from the same difficulty table the loop's counter uses
 *  (geodetectiveConfig) — never a hardcoded count. The word itself
 *  comes from the shared numberWord helper (Round 2, bug 10
 *  residue), the same source the loop's intro uses. */
const guessCapWord = numberWord;

/** Kid-friendly hints for each learning path, shown under the picker. */
const DIFFICULTY_HINTS: Record<PickerDifficulty, string> = {
  easy: "Famous places — the spots every explorer starts with.",
  medium: "A little of everything — grow your map one discovery at a time.",
  hard: "Hidden corners of the world — for explorers ready to discover more.",
};

/**
 * B1 (TD-06.16): the Home screen's `<main>` class. The composer
 * (game-app.tsx) spreads this onto its single `<main>`; Choose renders
 * a fragment, so the class lives here and the screen and the shell
 * never drift apart. Byte-equivalent to main's Home `<main>`.
 */
export const CHOOSE_MAIN_CLASSNAME =
  "atlas-home home-v5 relative mx-auto flex min-h-dvh w-full max-w-(--page-wide) flex-col px-5 pt-8 md:px-9";

export function Choose({
  onState,
  onCountry,
  onGlobe,
  onBegin,
  onLoop,
  onColdTrail,
  onReview,
  onResetHistory,
  challengeEnabled,
  whyLearnEnabled,
  onWhyLearn,
  onChallenge,
  deck,
  notice,
  homeToast,
  difficultyChoice,
  onDifficultyChoice,
  tutorialInvite,
  tutorialInviteVisible,
  suppressGreeting,
  ageBand,
  onGrownUpOpen,
  headingRef,
  mapModeControl,
  lockedLoop,
  heroMountainUrl,
  cardMedia,
  earnedBadgeRow,
}: {
  onState: (e: ReactMouseEvent) => void;
  onCountry: (e: ReactMouseEvent) => void;
  onGlobe: (e: ReactMouseEvent) => void;
  /** Hero "Begin exploring": start a Globe round at the picked difficulty. */
  onBegin: (e: ReactMouseEvent) => void;
  /** Open the GeoDetective edition (unlimited mysteries). */
  onLoop: (e: ReactMouseEvent) => void;
  /** Open the Cold Trail vertical slice (smuggler triangulation). */
  onColdTrail: (e: ReactMouseEvent) => void;
  /** Start a review session over the due deck cards. */
  onReview: () => void;
  /** Run the "Start over" history reset (GameApp owns the flow). */
  onResetHistory: () => ResetHistoryResult;
  /** Friend challenges on (flag): show the "Challenge a friend" entry. */
  challengeEnabled?: boolean;
  /** Open the challenge region picker. */
  onChallenge?: (e: ReactMouseEvent) => void;
  /** Show the "Why Do We Learn This?" card. Live for everyone since
   * the subjects launch (owner rule, Nov 13: release progressively). */
  whyLearnEnabled?: boolean;
  /** Open the subject picker. Without it the card's button renders
   * disabled ("Coming soon"). */
  onWhyLearn?: (e: ReactMouseEvent) => void;
  /** Deck entry status (flag-gated; see useDeckStatus). */
  deck: { enabled: boolean; due: number; total: number };
  notice?: ReactNode;
  homeToast?: ReactNode;
  difficultyChoice: PickerDifficulty;
  onDifficultyChoice: (choice: PickerDifficulty) => void;
  tutorialInvite?: ReactNode;
  /** True while the first-run tutorial invite is on screen — Comet's
      auto-greeting stays quiet until it's dismissed (no competing popups). */
  tutorialInviteVisible?: boolean;
  /** True while a blocking boot dialog is open or boot qualification hasn't
      settled — the storyteller greeting waits (UX review 2026-10-12). */
  suppressGreeting?: boolean;
  /** Effective age band (parent-set; "10-18" when unset). */
  ageBand: AgeBandId;
  /** Open the grown-up gate (footer link + locked-tile link). */
  onGrownUpOpen: () => void;
  /** Ref for the home h1 — GameApp moves focus to it when a manual
   * Scout Map switch lands the player home (Block A cure). */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** The map-mode toggle + current-mode indicator, hosted in the
   * hero's top row (Block C cure). GameApp owns the mode state and
   * the handlers; Choose only places the control. */
  mapModeControl?: ReactNode;
  /** The locked GeoDetective tile, built by the age-profile host —
   * Choose places it on the edition card but never imports it. */
  lockedLoop: ReactNode;
  /** The hero mountain art URL, from the composer — a components/root
   * file may not import @/assets/** directly (layer rule), so the
   * composer passes media as slots. */
  heroMountainUrl: string;
  /** The card-film media, from the composer (same layer rule as above):
   * the three fixed films plus the per-band media resolvers. */
  cardMedia: {
    geodetectiveFilm: CardFilmMedia;
    grownupsFilm: CardFilmMedia;
    journalFilm: CardFilmMedia;
    coldtrailMediaForBand: (band: string | null | undefined) => CardFilmMedia;
    reviewMediaForBand: (band: string | null | undefined) => CardFilmMedia;
    whyLearnMediaForBand: (band: string | null | undefined) => CardFilmMedia;
  };
  /** The earned-badges row, built by the composer — Choose places it
   * on the GeoDetective card but never imports the passport area. */
  earnedBadgeRow: ReactNode;
}) {
  // GeoDetective progress for the edition card: the resume variant and the
  // streak line. Read on mount (the menu remounts when the loop screen
  // closes, so this is always fresh on return).
  const [loopProgress] = useState(() => peekLoopProgress());
  // Journal ("What the land remembers", docs/journal-spec.md §3/§5/§6):
  // the displayed entry index is state, driven by the auto-switch rotation
  // (createJournalRotation in ./home-journal): a boundary timeout + a 30s
  // safety interval recompute it, as do visibilitychange and focusin. A new
  // index is DEFERRED while focus is inside the Journal card or section
  // (§6, focus-only per owner ruling Q3) — never swapped under a reader.
  const [journalIndex, setJournalIndex] = useState(() => journalSetIndexAt(Date.now()));
  const [journalNowMs, setJournalNowMs] = useState(() => Date.now());
  // Journal movie player: the single open note id, or null. One movie
  // plays at a time; opening another entry closes the first.
  const [playingJournalId, setPlayingJournalId] = useState<string | null>(null);
  const focusInsideJournalCard = useCallback(() => {
    const active = document.activeElement;
    const card = document.querySelector('[data-testid="journal-card"]');
    return !!active && !!card && card.contains(active);
  }, []);
  const focusInsideJournalSection = useCallback(() => {
    const active = document.activeElement;
    const section = document.getElementById("home-journal");
    return !!active && !!section && section.contains(active);
  }, []);
  // Item 42: rotation also pauses while the journal is simply ON SCREEN
  // (a child reading with no keyboard focus anywhere). Probed by the
  // IntersectionObserver effect below into this ref; the rotation reads
  // it fresh at every recompute, like the focus probes.
  const journalOnScreenRef = useRef(false);
  const [journalRotation] = useState(() =>
    createJournalRotation({
      initialIndex: journalIndex,
      blockers: () => ({
        focusInsideCard: focusInsideJournalCard(),
        focusInsideSection: focusInsideJournalSection(),
        journalOnScreen: journalOnScreenRef.current,
      }),
      onApply: (index) => setJournalIndex(index),
    }),
  );
  useEffect(() => {
    journalRotation.start();
    void loadJournalNotes().then((ok) => { if (ok) journalRotation.recompute(); }); // lazy dataset (TD-06.17): recompute once the notes land
    const tick = window.setInterval(() => setJournalNowMs(Date.now()), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") journalRotation.recompute();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onFocusIn = () => {
      // A deferred set lands once focus has left the card and the
      // section — never while the reader is still in either place.
      // Recompute from the clock rather than applying a stored pending
      // index, so there is no stale-pending path: the pure deferral
      // check inside the rotation decides for this focus position.
      journalRotation.recompute();
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      journalRotation.stop();
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [journalRotation]);
  // Item 42: watch the journal card + section; while either is on screen
  // the rotation holds, and the moment both leave, a deferred entry can
  // land — recompute right away instead of waiting for the 30s tick.
  useEffect(() => {
    const targets = [
      document.querySelector('[data-testid="journal-card"]'),
      document.getElementById("home-journal"),
    ].filter((el): el is Element => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const wasOnScreen = journalOnScreenRef.current;
        journalOnScreenRef.current = visible.size > 0;
        if (wasOnScreen && !journalOnScreenRef.current) journalRotation.recompute();
      },
      { threshold: 0.2 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [journalRotation]);
  // journalIndex stays -1 until the lazy dataset lands — no entry until then.
  const journalEntry = journalIndex >= 0 ? journalSetByIndex(journalIndex) ?? journalSetAt(Date.now()) : null;
  const journalNotes = journalEntry?.notes ?? [];
  // A movie stops when its window rotates away — the note is no longer shown.
  useEffect(() => {
    setPlayingJournalId(null);
  }, [journalIndex]);
  // Stagger order for the orchestrated entrance (110ms steps in CSS).
  // motionmaxxing M7: the atlas entrance cascade's stagger gaps, retuned
  // uneven (60–100ms) so the cards don't land on a metronome. Keyframes,
  // 0.8s duration, and softLand curve frozen in styles.css; the +380ms
  // stamp offset is frozen there too. --d is retired — this emits the
  // named --rise-delay custom property the CSS reads.
  const RISE_DELAY: Record<number, string> = {
    0: "0ms",
    2: "60ms",
    3: "135ms",
    4: "205ms",
    5: "290ms",
    6: "375ms",
    7: "450ms",
  };
  const rise = (d: number) => ({ "--rise-delay": RISE_DELAY[d] ?? "0ms" }) as CSSProperties;
  // v5 nav jumps: smooth-scroll to a home section (instant under
  // reduced-motion) AND move focus to it — a scroll-only jump strands
  // keyboard / screen-reader users at the top of the page (WCAG 2.4.3).
  // Targets carry tabIndex={-1}; preventScroll keeps our scroll as the
  // only movement. Missing targets are a no-op by construction.
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
    const next = `#${id}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  };
  const scrollTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  // The About card. It stands alone in the pages band at full
  // width: the Capitals & Flags doorway that rode beside it was
  // removed from Home entirely (owner's word, Veeresh, 2026-11-05:
  // "card is not clickable. if its not clickable then there is no
  // point of putting it on home page."). The pack's only entry is
  // the deck shelf inside each mode.
  const aboutSection = (
    <section id="home-about" tabIndex={-1} className="hv5-card hv5-page" aria-labelledby="about-title">
      <span className="hv5-label">About</span>
      <h2 id="about-title">How a round works</h2>
      <p>
        A place name, then one pin on an unlabeled map. Right or wrong, the round opens a short
        story about that place. Pick the globe, a country, or a state. Your score keeps adding
        up until you end the game, or after 2 minutes with nothing tapped.
      </p>
      <p>
        No account. The run stays in this browser. A coffee for Grandpa is optional and never
        locks a game.
      </p>
    </section>
  );
  return (
    <>
      {/* Skip link (WCAG 2.4.1): the first focusable element on the home
          page, visually hidden until focused; jumps to the journal
          section (scrollTo moves focus there as well as scrolling). */}
      <a
        href="#home-journal"
        className="hv5-skip-link"
        onClick={(event) => {
          event.preventDefault();
          scrollTo("home-journal");
        }}
      >
        Skip to journal
      </a>
      <AtlasBackdrop />
      <svg className="hv5-sprig" viewBox="0 0 120 150" fill="none" stroke="#8FA382" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M14 148 C20 100 34 60 62 22" strokeOpacity=".7" />
        <g fill="#A9BCA0" stroke="none" opacity=".8">
          <ellipse cx="30" cy="118" rx="13" ry="6" transform="rotate(-48 30 118)" /><ellipse cx="42" cy="92" rx="13" ry="6" transform="rotate(-52 42 92)" />
          <ellipse cx="54" cy="66" rx="12" ry="5.5" transform="rotate(-55 54 66)" /><ellipse cx="66" cy="44" rx="11" ry="5" transform="rotate(-58 66 44)" />
          <ellipse cx="24" cy="104" rx="11" ry="5" transform="rotate(-16 24 104)" /><ellipse cx="36" cy="78" rx="11" ry="5" transform="rotate(-20 36 78)" />
          <ellipse cx="48" cy="54" rx="10" ry="4.6" transform="rotate(-24 48 54)" />
        </g>
      </svg>
      {notice}
      {tutorialInvite}
      {/* The shared shell header (fix/ui-shared-shell, Round 2
          adoption): SiteHeader owns the home control (the brand
          lockup, "Meridian home", top-left) and the row; the five
          section buttons carry data-nav-section for the header's
          derived current-section highlight (N1); home's nav mixes scroll buttons with
          two router Links, so it rides the `nav` node slot with the
          shared link class. ABOUT and JOURNAL jump to the sections at
          the bottom of the home page. Home's sound toggle keeps its
          owner-ordered place in the hero (2026-10-07/08), so the mute
          slot is an explicit null here; the Join pill is the header's
          one exit control, in the endGame slot. */}
      <SiteHeader
        onHome={scrollTop}
        className="home-rise"
        style={rise(0)}
        exitInMenuOnSmallScreens
        nav={
          <>
            <button type="button" className="site-header-nav-link" data-nav-section="home-editions" onClick={() => scrollTo("home-editions")}>
              EXPEDITIONS
              <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </button>
            <button type="button" className="site-header-nav-link" data-nav-section="home-cases" onClick={() => scrollTo("home-cases")}>
              CASES
              <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </button>
            <button type="button" className="site-header-nav-link" data-nav-section="home-about" onClick={() => scrollTo("home-about")}>ABOUT</button>
            <Link to="/contact" className="site-header-nav-link" data-testid="nav-contact-link">CONTACT</Link>
            <Link to="/board" className="site-header-nav-link" data-testid="nav-board-link">WHAT&rsquo;S COMING</Link>
            <button type="button" className="site-header-nav-link" data-nav-section="home-journal" onClick={() => scrollTo("home-journal")}>JOURNAL</button>
            <button type="button" className="site-header-nav-link" data-nav-section="home-grownups" onClick={() => scrollTo("home-grownups")}>GET INVOLVED</button>
          </>
        }
        status={null}
        mute={null}
        endGame={
          <button
            type="button"
            className="hv5-btn hv5-btn-brown"
            onClick={() => scrollTo("home-cases")}
          >
            JOIN THE JOURNEY
            <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
          </button>
        }
      />
      {homeToast}

      <div className="hv5-bento">
        <section className="hv5-hero home-rise" style={rise(2)} aria-label="Welcome to Meridian">
          {/* Eyebrow cluster preserved from the atlas home: eyebrow →
              Comet emblem → sound toggle (owner order — Liz's eyebrow
              call, 2026-10-07/08), with the v5 welcome pill leading
              the row. */}
          <div className="hv5-hero-top">
            <span className="hv5-pill">
              <span className="hv5-dot">
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#8A6D2F" /></svg>
              </span>
              WELCOME TO MERIDIAN
            </span>
            <p className="hv5-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Compass className="size-4" aria-hidden="true" />
              Field atlas · {trailDate()} UTC
            </p>
            <CometEmblem />
            <SoundToggle testId="sound-toggle" className="atlas-sound-toggle" />
            <HighContrastToggle testId="high-contrast-toggle" className="atlas-sound-toggle" />
            {mapModeControl}
            {/* Storyteller banner host (owner directive 2026-10-09): the
                figure sits in the hero beside the branding — always visible,
                mobile and desktop. The greeting rides in a popover below. */}
            <span className="hv5-storyteller">
              <StorytellerBannerBoundary>
                <Suspense fallback={<StorytellerBannerSkeleton />}>
                  <StorytellerHomeHost
                    tutorialInviteVisible={tutorialInviteVisible}
                    suppressGreeting={suppressGreeting}
                  />
                </Suspense>
              </StorytellerBannerBoundary>
            </span>
          </div>
          {/* The home h1 is a focus landing (tabIndex={-1}): a manual
              Scout Map switch destroys the switch that had focus when
              it sends the player home, so GameApp moves focus here via
              headingRef (Block A cure). It was originally the landing
              for the boot offer dialog's close; that dialog is gone
              (docs/scout-offer-policy.md). */}
          <h1 ref={headingRef} id="home-heading" className="hv5-h1" data-testid="home-heading" tabIndex={-1}>
            <span className="sr-only">Meridian — </span>
            Explore. Understand.
            <br />
            Make sense of what matters.
          </h1>
          <p className="hv5-sub">
            Pick the globe, a country, or a state. A place name, then one pin. Your score keeps
            adding up across editions until you choose to end the game, or if you&rsquo;re idle for
            2 minutes.
          </p>
          <div className="home-rise" style={rise(4)} data-testid="tour-stop-difficulty">
            <p id="difficulty-label" className="hv5-diff-cap">
              How do you want to grow your map today?
            </p>
            <div role="group" aria-labelledby="difficulty-label" className="hv5-diff">
              {(
                [
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ] as const
              ).map((option) => {
                const selected = difficultyChoice === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      // SFX audio spec §2.6: the select chirps only on an
                      // actual change — re-tapping the active band stays silent.
                      if (option.value !== difficultyChoice) playDifficultySelect();
                      onDifficultyChoice(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="hv5-hint" aria-live="polite">
              {DIFFICULTY_HINTS[difficultyChoice]}
            </p>
          </div>
          <div className="hv5-cta-row">
            <button
              type="button"
              className="hv5-btn hv5-btn-brown"
              style={{ padding: "16px 28px" }}
              data-testid="begin-exploring"
              // Primary CTA STARTS PLAYING (review finding P1-5, 2026-10-21):
              // it used to only scroll to the Cases section, so a child who
              // pressed the biggest button on the page did not get a game.
              // It now opens a Globe expedition at the difficulty picked just
              // above it (Easy = famous places, see easy-curation.ts) — the
              // same path as the Globe edition card, sound and all. The nav's
              // EXPEDITIONS / CASES buttons still scroll for browsing.
              onClick={onBegin}
            >
              BEGIN EXPLORING
              <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
            </button>
          </div>
          {/* The composed hero (owner ship word, 2026-11-04): the
              painted mountain, the V1b trail overlay (marching dots,
              climbing pulse, summit flag, drifting clouds) and the
              trekking-kid overlay stacked on the same sliced box, so
              both overlays track the art exactly. */}
          <div className="hv5-mtn-wrap" aria-hidden="true">
            <img className="hv5-mtn-img" src={heroMountainUrl} alt="" />
            <HeroTrailOverlay />
            <HeroTrekkerOverlay />
          </div>
        </section>
        <div className="hv5-rail">
        <div className="hv5-globe-zone">
          <Suspense fallback={null}>
            <HomeGlobe />
          </Suspense>
        </div>
        {/* Choose Your Expedition — the design's dark anchor card hosts the
            three real edition actions (State / Country / Globe). */}
        <div
          className="hv5-card hv5-mapcard home-rise"
          style={rise(6)}
          data-testid="tour-stop-editions"
          id="home-editions"
          tabIndex={-1}
        >
          <div className="hv5-head">
            <span className="hv5-badge">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5 L13.2 13.2 L8.5 15.5 L10.8 10.8 Z" fill="currentColor" stroke="none" /></svg>
            </span>
            <span className="hv5-label">Choose your expedition</span>
          </div>
          <h2>Expeditions Map</h2>
          <p>Choose your expedition — a single US state, a whole country, or the entire globe.</p>
          <div className="hv5-editions">
            <button type="button" className="hv5-edition" onClick={onState} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 01</span>
              <MapPin className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">State</span>
              <span className="hv5-eaction">Choose a state</span>
            </button>
            <button type="button" className="hv5-edition" onClick={onCountry} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 02</span>
              <Flag className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">Country</span>
              <span className="hv5-eaction">Choose a country</span>
            </button>
            <button type="button" className="hv5-edition" onClick={onGlobe} onPointerEnter={prefetchTerritoryData} onPointerDown={prefetchTerritoryData} onFocus={prefetchTerritoryDataOnFocus}>
              <span className="hv5-idx">N° 03</span>
              <Globe2 className="size-5" aria-hidden="true" />
              <span className="hv5-etitle">Globe</span>
              <span className="hv5-eaction">Play the globe</span>
            </button>
          </div>
          {challengeEnabled ? (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={onChallenge}
              data-testid="challenge-a-friend"
            >
              Challenge a friend
            </Button>
          ) : null}
        </div>
        {/* The Capitals & Flags doorway no longer renders anywhere
            on Home: it began under this map card (issue #344), moved
            beside the About card below (2026-11-04), became a
            signpost (2026-11-05), and was then removed entirely on
            the owner's word (Veeresh, 2026-11-05: "card is not
            clickable. if its not clickable then there is no point
            of putting it on home page."). */}
        </div>

      <div className="hv5-grid2" id="home-cases" tabIndex={-1}>
        {/* GeoDetective leads: the flagship case file, unlimited mysteries.
            Age-profile: for bands where the loop is locked (no current group locks it), the SAME
            footprint renders the locked variant in place. */}
        {isLoopLocked(ageBand, "geodetective") ? (
          lockedLoop
        ) : (
        <article
          className="hv5-card hv5-split hv5-stack hv5-case home-rise"
          style={rise(5)}
          data-testid="tour-stop-geodetective"
          aria-labelledby="geodetective-title"
        >
          {/* Card-redesign Variant A: picture first in DOM order (not CSS
              order), so scanning, screen-reader, and tab order all start
              with the image. The card action is the stretched CTA below
              (Form S): the card itself cannot be the <button> because
              EarnedBadgeRow renders real badge <button>s inside it. */}
          {/* Card film (feat/home-card-films): the slot now plays the
              GeoDetective reshoot film once, governed by CardFilm
              (reduced-motion / Save-Data / low-memory / error all land
              on the owner's still image). Media: card-media.ts. */}
          <CardFilm className="hv5-pic" media={cardMedia.geodetectiveFilm} testId="card-film-geodetective" band={ageBand} />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3 19 L9.5 7.5 L13 13 L15.5 9.5 L21 19 Z" /><circle cx="17.5" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
              </span>
              <span className="hv5-label">Case file · Unlimited</span>
            </div>
            <h2 id="geodetective-title">
              GeoDetective<span className="hv5-chip">Unlocked</span>
            </h2>
            <p>
              {guessCapWord(geodetectiveConfig(ageBand)?.guessCap ?? 5)} guesses, one mystery place. Each guess unlocks a clue — solve as many cases as
              you can.
            </p>
            {loopProgress.streak > 0 ? (
              <p className="hv5-streak">🔥 Streak: {loopProgress.streak}</p>
            ) : null}
            {/* Owner 2026-10-09: earned badges show on the home page card —
                no separate Passport page. Clean Round is earned in this loop. */}
            {earnedBadgeRow}
            <button
              type="button"
              className="hv5-go hv5-stretch"
              onClick={onLoop}
              onPointerEnter={prefetchTerritoryData}
              onPointerDown={prefetchTerritoryData}
              onFocus={prefetchTerritoryDataOnFocus}
              aria-label={loopProgress.inProgress ? "GeoDetective: Resume your case" : "GeoDetective: Solve a mystery"}
            >
              {loopProgress.inProgress ? (
                <><span aria-hidden="true">▶️</span>{" "}Resume your case</>
              ) : (
                <><span aria-hidden="true">🔎</span>{" "}Solve a mystery</>
              )}
            </button>
          </div>
        </article>
        )}
        {/* "Why Do We Learn This?" (subjects launch): the door to every
            subject case (math, science, history). Live for everyone;
            the button opens the subject picker. Same card markup as
            GeoDetective, no new styles. Film per age band through
            whyLearnMediaForBand. Media: card-media.ts. */}
        {whyLearnEnabled ? (
        <article
          className="hv5-card hv5-split hv5-stack hv5-case home-rise"
          style={rise(5)}
          data-testid="home-card-why-learn"
          aria-labelledby="why-learn-title"
        >
          <CardFilm className="hv5-pic" media={cardMedia.whyLearnMediaForBand(ageBand)} testId="card-film-why-learn" band={ageBand} />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15 L20.5 20.5" /></svg>
              </span>
              <span className="hv5-label">Case file · Why it matters</span>
            </div>
            <h2 id="why-learn-title">
              Why Do We Learn{" "}
              {/* Keeps "New" with the last word so the tag never sits alone on a phone line. */}
              <span className="whitespace-nowrap">
                This?<span className="hv5-chip">New</span>
              </span>
            </h2>
            <p>
              See where math, science and history show up in everyday life, then use them to crack
              the case.
            </p>
            <button
              type="button"
              className="hv5-go hv5-stretch"
              onClick={onWhyLearn}
              disabled={!onWhyLearn}
              aria-disabled={!onWhyLearn ? "true" : undefined}
              aria-label={
                onWhyLearn
                  ? "Why Do We Learn This?: Start exploring"
                  : "Why Do We Learn This?: Coming soon"
              }
            >
              <span aria-hidden="true">🔍</span>{" "}
              {onWhyLearn ? "Start exploring" : "Coming soon"}
            </button>
          </div>
        </article>
        ) : null}
        {/* Cold Trail vertical slice: 3 sightings, 3 rings, one interception. */}
        <article
          className="hv5-card hv5-split hv5-stack hv5-dispatch home-rise"
          style={rise(5)}
          aria-labelledby="coldtrail-title"
        >
          {/* Variant A, same as GeoDetective: image first in DOM order;
              whole-card action via the stretched CTA (Form S, shared form
              so both game cards behave identically). */}
          {/* Card film, same shared component as GeoDetective: Jolly
              walks the footprint trail (character motion, not a camera
              move — the owner's 2026-11-02 correction). Media:
              card-media.ts. */}
          <CardFilm className="hv5-pic" media={cardMedia.coldtrailMediaForBand(ageBand)} testId="card-film-coldtrail" band={ageBand} />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5 L13.2 13.2 L8.5 15.5 L10.8 10.8 Z" fill="currentColor" stroke="none" /></svg>
              </span>
              <span className="hv5-label">Case file · Triangulation</span>
            </div>
            <h2 id="coldtrail-title">
              Cold Trail<span className="hv5-chip">New</span>
            </h2>
            <p>
              Jolly was spotted in the snow. Three sightings, three rings — tap where
              they cross to reach Jolly before the trail freezes.
            </p>
            <button
              type="button"
              className="hv5-go hv5-stretch"
              onClick={onColdTrail}
              onPointerEnter={prefetchTerritoryData}
              onPointerDown={prefetchTerritoryData}
              onFocus={prefetchTerritoryDataOnFocus}
              aria-label="Cold Trail: Start the trail"
            >
              <span aria-hidden="true">❄️</span>{" "}Start the trail
            </button>
          </div>
        </article>
      </div>
      </div>

      <div className="hv5-grid3">
        {deck.enabled ? (
          <section
            aria-labelledby="review-title"
            className={`hv5-card hv5-spot home-rise${deck.due > 0 ? " hv5-review-due" : " hv5-review-empty"}`}
            style={rise(7)}
            data-testid="tour-stop-review"
            id="home-review"
          >
            <CardFilm className="hv5-art" media={cardMedia.reviewMediaForBand(ageBand)} testId="card-film-review" band={ageBand} />
            <div className="hv5-txt">
              <div className="hv5-head">
                <span className="hv5-badge">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5 C7 4 10 4 12 6 C14 4 17 4 20 5.5 V19 C17 17.6 14 17.6 12 19.4 C10 17.6 7 17.6 4 19 Z" /><path d="M12 6 V19.4" /></svg>
                </span>
                <span className="hv5-label">Cases</span>
              </div>
              <h2 id="review-title">{REVIEW_DECK_COPY.pickerTitle}</h2>
              {deck.due > 0 ? (
                <>
                  <p>{REVIEW_DECK_COPY.pickerDueLine}</p>
                  <p style={{ fontWeight: 700, color: "var(--hv5-ink)" }} data-testid="deck-due-count">
                    {deck.due} {deck.due === 1 ? "card" : "cards"} due
                  </p>
                  {/* Action stack (action-model manifest 2026-10-29;
                      redundancy addendum 2026-10-29): the card is NOT
                      a whole-card button any more. Two explicit
                      controls in DOM = visual = tab order: the filled
                      primary, then Start over in the danger footer.
                      The card's former challenge pill was REMOVED by
                      the owner's redundancy ruling — it merely
                      re-opened the generic picker, whose own full
                      "Challenge a friend" button (above, in the
                      Expeditions section) is the canonical entry;
                      the contextual entries (summary route, mid-run,
                      reveal, review-complete, pass-along) stay. */}
                  <div className="hv5-review-stack">
                    <div className="hv5-review-actions">
                      <button type="button" className="hv5-btn hv5-btn-brown" onClick={onReview} aria-label="Review my misses: Start review">
                        {REVIEW_DECK_COPY.startReview}
                      </button>
                    </div>
                    {/* "Start over" reset entry (manifest 2026-10-28
                        D10): renders whenever the deck holds any card
                        (due OR caught-up). Last on the card, alone in
                        a hairline-separated danger footer — the
                        destructive action shares neither a row nor a
                        look with play/share. */}
                    <div className="hv5-review-danger">
                      <ResetHistoryControl onReset={onResetHistory} />
                    </div>
                  </div>
                </>
              ) : deck.total > 0 ? (
                <>
                  <p>{REVIEW_DECK_COPY.pickerCaughtUp}</p>
                  {/* Caught-up carries no play action; the stack is
                      the danger footer alone (Start over, D10). The
                      challenge pill that used to sit above it was
                      removed with the due state's by the owner's
                      redundancy ruling (addendum 2026-10-29). */}
                  <div className="hv5-review-stack">
                    <div className="hv5-review-danger">
                      <ResetHistoryControl onReset={onResetHistory} />
                    </div>
                  </div>
                </>
              ) : (
                <p>{REVIEW_DECK_COPY.pickerEmpty}</p>
              )}
            </div>
          </section>
        ) : null}
        {/* Journal — the card names the currently-rotating entry and
            jumps to the field note below; the entry rotates every
            30 minutes, deferred while focus is inside this card or the journal
            section (spec §6). */}
        <article className="hv5-card hv5-spot hv5-journal home-rise" style={rise(7)} data-testid="journal-card">
          <CardFilm className="hv5-art" media={cardMedia.journalFilm} testId="card-film-journal" band={ageBand} />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 19 C5 10 11 4.5 20 4.5 C20 14 14.5 19.5 6.5 19.5" /><path d="M5 19 C8 14 11.5 10.5 16 8" /></svg>
              </span>
              <span className="hv5-label">Latest Journal Entry</span>
            </div>
            {/* No second title here (item 42): the journal section below
                carries the one "What the land remembers" heading; this
                teaser card's label + "Now showing" line name it. */}
            <p>Short field stories from the places on the map — the tales only landscapes keep.</p>
            {journalEntry ? (
              <p className="hv5-journal-now" data-testid="journal-now-showing">
                {journalEntry.mixed
                  ? "Now showing: Field Notes"
                  : `Now showing: ${journalEntry.geography} · ${journalEntry.notes.length === 1 ? "1 field note" : `${journalEntry.notes.length} field notes`}`}
              </p>
            ) : null}
            <button type="button" className="hv5-go hv5-stretch" data-testid="journal-open" onClick={() => scrollTo("home-journal")}>
              READ THE ENTRY
            </button>
          </div>
        </article>
        <article id="home-grownups" tabIndex={-1} className="hv5-card hv5-spot hv5-involved home-rise" style={rise(7)} data-testid="grownups-card">
          <CardFilm className="hv5-art" media={cardMedia.grownupsFilm} testId="card-film-grownups" band={ageBand} />
          <div className="hv5-txt">
            <div className="hv5-head">
              <span className="hv5-badge">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8" r="3.2" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M3.5 19.5 C3.5 15.8 5.7 14 8.5 14 C11.3 14 13.5 15.8 13.5 19.5 M14.8 14.6 C17.3 14.9 19 16.4 19 19.5" /></svg>
              </span>
              <span className="hv5-label">Get Involved</span>
            </div>
            <h2>For grown-ups</h2>
            <p>
              How Meridian works, safety notes, and the read-aloud companion for younger explorers.
              Read our <Link to="/privacy">privacy notice</Link> or{" "}
              <Link to="/contact">contact us</Link>.
            </p>
            <button type="button" className="hv5-btn hv5-btn-brown hv5-stretch" data-testid="grownups-card-open" onClick={onGrownUpOpen}>
              JOIN US
              <svg width="14" height="10" viewBox="0 0 15 11" aria-hidden="true"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" stroke="currentColor" fill="none" strokeWidth="1.7" /></svg>
            </button>
            <p className="hv5-grownups-board-links">
              <Link to="/board" data-testid="grownups-board-link">See what we&rsquo;re making next →</Link>{" "}
              ·{" "}
              <Link to="/board" search={{ view: "tip" }} data-testid="grownups-tip-link">Ask for something new</Link>
            </p>
          </div>
        </article>
      </div>

      <div className="hv5-pages">
        {aboutSection}
        <section id="home-journal" tabIndex={-1} className="hv5-card hv5-page" aria-labelledby="journal-title" data-testid="journal-section">
          <span className="hv5-label">Journal</span>
          <h2 id="journal-title">What the land remembers</h2>
          {journalEntry ? (
            <p className="hv5-journal-geography" data-testid="journal-geography">{journalEntry.geography}</p>
          ) : null}
          {journalNotes.map((note) => (
            <article key={note.id} className="hv5-entry" data-testid="journal-note">
              {note.image && note.imageAlt && (
                <Suspense fallback={null}>
                  <JournalBoundary>
                  <JournalPlayer
                    noteId={note.id}
                    place={note.place}
                    imageSrc={journalImageUrl(note.image)}
                    imageAlt={note.imageAlt}
                    open={playingJournalId === note.id}
                    onOpen={setPlayingJournalId}
                    onClose={() => setPlayingJournalId(null)}
                  />
                  </JournalBoundary>
                </Suspense>
              )}
              <div className="hv5-entry-text">
                <h3>{note.place}</h3>
                <p className="hv5-label" style={{ marginTop: 4 }}>{note.where}</p>
                <p style={{ marginTop: 8 }}>{note.story}</p>
                <p style={{ marginTop: 8 }}>
                  <a href={note.sourceHref} target="_blank" rel="noopener noreferrer">
                    {note.sourceLabel}
                  </a>
                  <span className="hv5-journal-confidence">{confidenceText(note)}</span>
                </p>
              </div>
            </article>
          ))}
          {journalEntry ? (
            <p className="hv5-journal-footer" data-testid="journal-footer">
              Entry {journalEntry.index + 1} of {journalSetCount()} · Next entry in {nextEntryCountdown(journalNowMs)}
            </p>
          ) : null}
        </section>
      </div>
    {/* Kid-set read-aloud preference (age-profile B3) renders through
        the first-visit queue in GameApp (item 9): it is the queue's
        third prompt, so it never piles up with the Scout notice, the
        tour banner or the storyteller bubble. */}
    {/* Comet now hosts from the banner (in the header above) — the fixed
        bottom-right wrapper is retired. */}
    </>
  );
}
