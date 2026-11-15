/**
 * Subject picker — the "Why Do We Learn This?" card's screen.
 *
 * Lists the released subjects from the registry (listReleasedSubjects)
 * merged with the plan (picker-rows): ready subjects open their case,
 * everything else shows as a disabled "Coming soon" row, so the kid
 * sees the map of what is coming. Rows are subject cards on the shared
 * ScreenShell page style. Subject code loads only when a row is tapped:
 * the registry never calls load() for the list, and the tap races the
 * load against withChunkTimeout like every other lazy screen (#209).
 *
 * Living Atlas (feat/why-learn-living-atlas, the owner's pick,
 * 2026-11-14): the screen's world is the home hero's mountain
 * painting (WhyLearnWorld) over the page's montage wash, and each
 * card carries the home card anatomy — a 16:9 picture slot on top,
 * then badge + kicker, title + stamp chip, one-liner, and the go
 * row pinned to the bottom. The picture slot is alive the home way:
 * a CardFilm loop for five subjects (media in
 * src/assets/why-learn/subject-card-media.ts), and for general
 * knowledge — which has no film, deliberately — the pristine globe
 * still with the GkGlobeOverlay's motion above it. Cards rise in on
 * the shared atlas-rise cascade, and a spotlight walks the ready
 * cards on a 4 s clock (one gold pulse per turn; general
 * knowledge's turn also draws its route and re-drops its pin). The
 * spotlight is decoration: it never moves focus, and it does not
 * run under prefers-reduced-motion.
 *
 * Game chrome (fix/case-navigation): the band is state, not a
 * one-time read — the footer carries Home's own age-profile entry
 * (the "For grown-ups" footer link opening GameApp's hosted
 * AgeProfileSettings: gate → AgePicker), and a band change event
 * re-deals the rows for the new band and closes any open case back
 * to this list (the settings flow's own no-rug-pull rule: a change
 * never swaps a case mid-play). The game's "Start over" reset
 * (ResetHistoryControl + GameApp's handleResetHistory) sits alone
 * in a separated block above the footer, mirroring Home's Review
 * card danger footer; an opened case receives the same reset plus
 * GameApp's End game through its props.
 *
 * Amendment (owner decision, 2026-11-14): the header bar and an
 * opened case also carry "Resume your case" while a GeoDetective
 * mystery is mid-play — the same offer Home's GeoDetective card
 * makes, on the same condition (GameApp reads the loop store and
 * the band lock), wired to GameApp's own GeoDetective tap-in. When
 * nothing is resumable the control is absent, never a dead button.
 */
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { AgeGroup, SubjectModule, SubjectProps } from "../registry";
import { listReleasedSubjects } from "../registry";
import { getAgeGroup, onAgeProfileChanged } from "@/game/age-profile";
import { ResetHistoryControl } from "@/components/reset-history-control";
import type { ResetHistoryResult } from "@/game/reset-history";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { CardFilm } from "@/components/card-film";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { SUBJECT_CARD_MEDIA, SUBJECT_CARD_STILLS } from "@/assets/why-learn/subject-card-media";
import { pickerRows } from "./picker-rows";
import { ScreenShell } from "@/components/ui/screen-shell";
import { Button } from "@/components/ui/button";
import { ArrowRight, Atom, BookOpen, Calculator, FlaskConical, Globe2, Users, type LucideIcon } from "lucide-react";
import { WhyLearnHero } from "./WhyLearnHero";
import { WhyLearnDrift } from "./WhyLearnDrift";
import { WhyLearnWorld } from "./WhyLearnWorld";
import { GkGlobeOverlay } from "./GkGlobeOverlay";

/** Entrance cascade for the cards (the approved mock's uneven
 *  stagger on the shared atlas-rise), by row index. */
const RISE_DELAYS_MS = [150, 340, 580, 860, 1180, 1540];

/** Decorative card icons by subject id (aria-hidden; the name is the text). */
const SUBJECT_ICONS: Record<string, LucideIcon> = {
  math: Calculator,
  physics: Atom,
  chemistry: FlaskConical,
  "general-knowledge": Globe2,
  "social-studies": Users,
  journals: BookOpen,
};

/** One line per subject card. EDITABLE PLACEHOLDERS (written for the A+B
 *  blend, 2026-11-13): short, neutral, factual; the owner may reword. */
const SUBJECT_ONE_LINERS: Record<string, string> = {
  math: "Why triangles hold up bridges",
  physics: "Why a ball always comes back down",
  chemistry: "Why bread rises and iron rusts",
  "general-knowledge": "Why places are where they are",
  "social-studies": "Why towns grew beside rivers",
  journals: "New journals are on the way.",
};

type CaseComponent = ComponentType<
  SubjectProps & {
    onCelebrate?: (spec: CelebrationSpec) => void;
    onEndGame?: () => void;
    onResetHistory?: () => ResetHistoryResult;
    onResumeCase?: () => void;
    loopInProgress?: boolean;
  }
>;

export default function SubjectPicker({
  group,
  onExit,
  onCelebrate,
  onEndGame,
  onResetHistory,
  onResumeCase,
  loopInProgress,
  onOpenAgeSettings,
}: SubjectProps & {
  /** GameApp's celebration trigger, passed through to the opened case. */
  onCelebrate?: (spec: CelebrationSpec) => void;
  /** GameApp's End game, passed through to the opened case's header. */
  onEndGame?: () => void;
  /** GameApp's "Start over" reset flow: the picker's footer control
   * and the opened case's footer both run it. */
  onResetHistory?: () => ResetHistoryResult;
  /** GameApp's GeoDetective tap-in, passed through to the opened
   * case's header and offered in this screen's own header bar. */
  onResumeCase?: () => void;
  /** Whether a GeoDetective mystery is mid-play and resumable (the
   * loop store, read by GameApp): the resume control renders only
   * while this holds, exactly as on Home's GeoDetective card. */
  loopInProgress?: boolean;
  /** Open GameApp's hosted age-profile settings (the grown-up gate →
   * AgePicker flow) — the picker's "For grown-ups" footer entry. */
  onOpenAgeSettings?: (e?: ReactMouseEvent<HTMLElement>) => void;
}) {
  // The band starts from the session's group (or the stored profile)
  // and then follows age-profile change events: a grown-up switching
  // the band in the settings re-deals this list in place.
  const [band, setBand] = useState<AgeGroup>(() => group ?? getAgeGroup());
  const [released, setReleased] = useState<SubjectModule[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [opened, setOpened] = useState<{ title: string; Case: CaseComponent } | null>(null);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let live = true;
    listReleasedSubjects()
      .then((mods) => {
        if (live) setReleased(mods);
      })
      .catch(() => {
        if (live) setListFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Band changes (the settings flow's change event): re-read the
  // effective band, re-deal the rows, and close any open case back
  // to the list — a case is dealt for one band and is never swapped
  // mid-play.
  useEffect(
    () =>
      onAgeProfileChanged(() => {
        setBand(getAgeGroup());
        setOpened(null);
      }),
    [],
  );

  // Arrival focus, the LoopScreen pattern: land focus on the heading so
  // it is never stranded on the Home card that opened the picker.
  useEffect(() => {
    if (opened) return;
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, [opened]);

  // The spotlight (Living Atlas): one ready card at a time on a 4 s
  // clock. Pure decoration — no focus, no state a kid can lose — and
  // off under reduced motion. General knowledge's turn is counted
  // so its overlay can draw the route and re-drop the pin.
  const reducedMotion = usePrefersReducedMotion();
  const [spotIndex, setSpotIndex] = useState(-1);
  const [gkSpotTurns, setGkSpotTurns] = useState(0);

  useEffect(() => {
    if (reducedMotion || !released || opened) return;
    const current = pickerRows(released, band);
    const readyIdx = current
      .map((row, i) => (row.state === "ready" ? i : -1))
      .filter((i) => i >= 0);
    if (readyIdx.length === 0) return;
    let tick = 0;
    const id = setInterval(() => {
      const idx = readyIdx[tick % readyIdx.length];
      tick += 1;
      setSpotIndex(idx);
      if (current[idx]?.id === "general-knowledge") setGkSpotTurns((turns) => turns + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [reducedMotion, released, band, opened]);

  // "Resume your case" for the header bar — Home's GeoDetective
  // card offer (same label, same Button, same accessible name),
  // present only while a mystery is mid-play; the opened case
  // renders its own beside End game from the same two props.
  const resumeControl =
    onResumeCase && loopInProgress ? (
      <Button
        variant="secondary"
        data-testid="resume-case-button"
        className="min-h-[44px]"
        onClick={onResumeCase}
        aria-label="GeoDetective: Resume your case"
      >
        <span aria-hidden="true">▶️</span>{" "}
        Resume your case
      </Button>
    ) : undefined;

  if (opened) {
    const Case = opened.Case;
    return (
      <Case
        group={band}
        tier="full"
        onExit={onExit}
        onCelebrate={onCelebrate}
        onEndGame={onEndGame}
        onResetHistory={onResetHistory}
        onResumeCase={onResumeCase}
        loopInProgress={loopInProgress}
      />
    );
  }

  const openSubject = (mod: SubjectModule) => {
    setOpenFailed(null);
    withChunkTimeout(mod.load(), `${mod.title} case screen`)
      .then((loaded) => {
        setOpened({ title: mod.title, Case: loaded.default as CaseComponent });
      })
      .catch(() => {
        setOpenFailed(mod.title);
      });
  };

  const rows = released ? pickerRows(released, band) : [];

  return (
    <ScreenShell
      onHome={onExit}
      controls={resumeControl}
      className="why-learn-screen lg:max-w-6xl"
      testId="subject-picker"
      hero={<WhyLearnHero />}
      sound={
        <span className="why-learn-wordmark">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21.5" fill="none" stroke="#8A6D2F" strokeWidth="1.6" /><path d="M24 6 L27.2 20.8 L42 24 L27.2 27.2 L24 42 L20.8 27.2 L6 24 L20.8 20.8 Z" fill="#8A6D2F" /><circle cx="24" cy="24" r="3.4" fill="#F6F1E3" stroke="#8A6D2F" strokeWidth="1.2" /></svg>
          MERIDIAN
        </span>
      }
      data={{ "data-band": band }}
      eyebrow="Case file · Why it matters"
      title="Why Do We Learn This?"
      titleRef={headingRef}
      sub={`Pick a subject · Ages ${band}`}
    >
      <WhyLearnWorld />
      <WhyLearnDrift />
      {released === null && !listFailed ? (
        <p className="mt-6 text-fg">Loading subjects…</p>
      ) : null}
      {listFailed ? (
        <p className="mt-6 text-fg">
          Subjects could not load just now. Head back to Home and try again in a moment.
        </p>
      ) : null}
      {/* Subject cards (Living Atlas anatomy, the home card's): one
          button per card; its text is its name (no heading inside the
          button). The picture slot, icon and arrow are aria-hidden
          decoration, never glyphs. Columns: 1 on phones, 2 at
          681–1080px, 3 from 1081px; with six subjects every row is
          full. */}
      <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 min-[681px]:grid-cols-2 min-[1081px]:grid-cols-3 min-[681px]:gap-4" data-testid="subject-cards">
        {rows.map((row, i) => {
          const Icon = SUBJECT_ICONS[row.id] ?? BookOpen;
          const ready = row.state === "ready" && row.module;
          const media = SUBJECT_CARD_MEDIA[row.id];
          const stillUrl = SUBJECT_CARD_STILLS[row.id];
          const riseDelay = `${RISE_DELAYS_MS[i] ?? 1500}ms`;
          return (
            <li key={row.id} className="flex">
              <button
                type="button"
                className={`why-learn-card home-rise flex w-full flex-col p-5 text-left text-fg${ready ? "" : " is-soon"}${spotIndex === i ? " is-spot" : ""}`}
                style={{ "--rise-delay": riseDelay } as CSSProperties}
                data-testid={`subject-row-${row.id}`}
                disabled={!ready}
                aria-disabled={ready ? undefined : "true"}
                onClick={ready ? () => openSubject(row.module!) : undefined}
              >
                <span className="wl-card-pic" aria-hidden="true">
                  {row.id === "general-knowledge" ? (
                    <>
                      <img className="wl-card-still" src={stillUrl} alt="" />
                      <GkGlobeOverlay spotTurns={gkSpotTurns} />
                    </>
                  ) : media ? (
                    <CardFilm className="wl-card-film" media={media} testId={`subject-film-${row.id}`} />
                  ) : stillUrl ? (
                    <img className="wl-card-still" src={stillUrl} alt="" />
                  ) : null}
                </span>
                <span className="wl-card-kickrow">
                  <span className="why-learn-badge" aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  {/* Decorative beside the badge (the eyebrow above
                      already says "Case file"): aria-hidden so each
                      card's accessible name still starts with the
                      subject's own name, as it did before. */}
                  <span className="wl-card-kicker" aria-hidden="true">
                    {row.id === "journals" ? "Latest journal entry" : `Case file · ${row.title}`}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
                  <span className="wl-card-titlerow">
                    <span className="mode-title leading-tight">{row.title}</span>
                    <span
                      className="why-learn-chip wl-chip-stamp"
                      style={{ "--rise-delay": riseDelay } as CSSProperties}
                    >
                      {ready ? `${row.caseCount} ${row.caseCount === 1 ? "case" : "cases"}` : "Coming soon"}
                    </span>
                  </span>
                  <span className="mt-1 text-sm text-muted">{SUBJECT_ONE_LINERS[row.id] ?? ""}</span>
                  <span className="why-learn-go mt-auto pt-2.5">
                    {ready ? (
                      <>
                        Open case
                        <ArrowRight className="size-3.5" aria-hidden="true" focusable="false" />
                      </>
                    ) : (
                      "Coming soon"
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {openFailed ? (
        <p className="mt-3 text-sm text-fg" role="status">
          {openFailed} could not load just now. Try again in a moment.
        </p>
      ) : null}
      {/* The game's "Start over" reset, alone in a separated block —
          Home's Review card danger-footer rule (the destructive
          action shares neither a row nor a look with play). */}
      {onResetHistory ? (
        <div className="mt-10 border-t border-line pt-4">
          <ResetHistoryControl onReset={onResetHistory} />
        </div>
      ) : null}
      {/* Age-profile footer entry — Home's own footer pattern (the
          agep-footer row and its grown-ups link, same classes, same
          label): the gate → AgePicker flow is hosted by GameApp, so
          the band can be changed without leaving the picker. The
          current band already reads in the sub line above ("Ages …"),
          which follows the band state. */}
      {onOpenAgeSettings ? (
        <footer className="agep-footer">
          <button
            type="button"
            className="agep-footer-link"
            onClick={onOpenAgeSettings}
            aria-label="For grown-ups: game settings"
            data-testid="grownups-link"
          >
            🔒 For grown-ups
          </button>
        </footer>
      ) : null}
    </ScreenShell>
  );
}
