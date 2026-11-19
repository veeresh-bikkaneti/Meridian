/**
 * Generic subject case flow, shared by every subject (extracted from
 * the math case, scale-play wave 1, with no visual change).
 *
 * Flow, per the plan's table (§3): the problem is read through the
 * existing ClueCard (the item's why, numbers kept to the question),
 * the shared AnswerCard asks one question, and the result mirrors
 * LoopReveal's visual language with the item's useElsewhere
 * composed into a real sentence (used-in-line.ts, item 15).
 * LoopReveal itself takes a geographic
 * LoopPuzzleState + LoopClueFile, so it is not reused as a component —
 * fabricating a puzzle for it would invent scores, which its own
 * comment forbids.
 *
 * DetectiveHost and the detective machine are unchanged and not mounted
 * here. The pair itself mounts here exactly once, through
 * SubjectDetectiveHost (below the header): the host self-gates on
 * detectivePair, so flag-off this case is text only, exactly as
 * before; flag-on, the pair speaks its fixed manifest clips for the
 * case's own flow signals. The host receives ONLY the answer-blind
 * prop whitelist (subject-host-props.ts) — solved / wrongPick /
 * finished booleans from this flow's state, never an item, an answer
 * or a pick's value. The win fires GameApp's existing celebration
 * through onCelebrate, on the same first-win guard LoopScreen uses.
 *
 * Each subject's own case component is a thin wrapper that passes its
 * title, its test-id prefix, its band items and its answer lookup.
 *
 * Living Atlas (feat/why-learn-living-atlas): the case screens carry
 * the picker's world — both shells take the why-learn-screen scope
 * (the montage wash and the light atlas tokens) plus
 * subject-case-screen, whose rules in styles.css restyle the clue
 * card, the answer card and the result band into the atlas card
 * anatomy. Presentation only: items, answers, phases and flow are
 * exactly as before.
 *
 * Game chrome (fix/case-navigation): the shell's header bar carries
 * the game's own End game button beside Home — the GeoDetective
 * header cluster (LoopScreen) — wired to GameApp's handleEndGame.
 * It arrives as an optional prop from the picker; it does not
 * change the case's own flow. (The "Start over" reset this file
 * used to render in a separated footer is gone — item 6, one exit
 * word per screen; see the note at the foot of SubjectCase.)
 *
 * Amendment (owner decision, 2026-11-14): the header bar also
 * carries "Resume your case" while a GeoDetective mystery is
 * mid-play — Home's GeoDetective card offer, on the same condition
 * (GameApp reads the loop store), wired to GameApp's own tap-in,
 * which leaves the case the way the Home button does (the case
 * keeps no state anywhere else; an unsubmitted pick is simply
 * left behind, as on any exit). Absent when nothing is resumable.
 *
 * Clue scenes (feat/clue-scene-pilot): a subject may pass a `scene`
 * hook that renders a short live-drawn film above the clue card.
 * The hook is answer-blind — it receives the item, the phase from
 * this flow's state, the reduced-motion flag and the band, never
 * the answer — and the text clue stays below the film as the
 * readable fallback. Math is the pilot; other subjects pass none.
 *
 * Act 3 (the narrated summary): a subject may also pass a
 * `resultExtra` hook, rendered ONLY inside the solved result
 * section — the one place post-solve content may live. Math uses
 * it for the summary's full script as standing text. Because the
 * section itself renders only when the case is done, nothing the
 * hook returns can be reached before the pick.
 *
 * L1 lose path (feat/fair-share-lose-path, generalised by
 * feat/lose-path-all-items, widened by the owner's decision of
 * 2026-11-19): a subject may also pass a `loseReveal` hook —
 * passing the hook at all is the subject's opt-in, and on the
 * entry question EVERY item then counts distinct wrong answers
 * and reveals at the SECOND one: a supportive line, an
 * answer-first line, then the same act-3 performance the win
 * path plays (the scene in its solved phase, the summary's
 * standing text via `resultExtra`) where the item has a
 * summary — the hook's return value names which items those
 * are, and the summary rendering and narration already
 * self-gate on the description carrying one, so an item with
 * no summary reveals with the supportive and answer lines
 * alone. The pacing is the owner's decision of 2026-11-19: the
 * first wrong answer keeps today's "Not quite" feedback and
 * live picks, so the player gets another go before the answer
 * is given away; the counting rule lives in lose-reveal.ts.
 * The supportive line is voiced first, through the shared
 * voice channel, and the scene's solved performance waits
 * until that clip ends (or is skipped) — see playSupportLine.
 * The reveal is not a solve: the phase never reaches "done", no
 * celebration fires, and the detective host still sees a wrong
 * pick. It fires only after a pick, so answer-blindness before
 * the choice is unchanged.
 */
import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import type { AgeGroup, SubjectProps, UnitItem } from "../registry";
import { getAgeGroup } from "@/game/age-profile";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ClueCard } from "@/game/loop/LoopScreen";
import {
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
  type CelebrationSpec,
} from "@/components/celebration-copy";
import { AnswerCard } from "./AnswerCard";
import { usedInLine } from "./used-in-line";
import { buildSubjectDetectiveHostProps } from "./subject-host-props";
import { HomeButton } from "@/components/ui/home-button";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { ReadAloudPrefSettings } from "@/components/age-profile/ReadAloudPrefSettings";
import type { ResetHistoryResult } from "@/game/reset-history";
import { advanceCasePhase, type AnswerFor, type CasePhase } from "./answer";
import { recordDistinctWrong, typedWrongKey } from "./lose-reveal";
import { recordUnitComplete } from "./subject-progress";
import { claimVoice, type VoiceClaim } from "@/game/audio/voice-channel";
import { isSoundEnabled } from "@/game/audio/sfx";
import { soundAudible } from "@/game/audio/play-guards";

/** The supportive line shown — and voiced — ahead of the answer
 * on every lose reveal (owner decision, 2026-11-19; the wording
 * is new copy awaiting the owner's approval). One fixed line for
 * every subject and item, so a child who did not solve the case
 * hears the same kind words before the explanation. */
export const LOSE_SUPPORT_LINE = "Good trying — this one was tricky. Let's look at how it works.";

/** The supportive line's clip URL (public/audio/subjects/, where
 * the subject summary clips live — the summaryClipUrl pattern in
 * ClueScene.tsx). */
function loseSupportClipUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${withSlash}audio/subjects/lose-support.mp3`;
}

// Holmes & Watson in the subject case: lazy, like the other pair
// hosts, so the pair's chunk is fetched only when a subject case
// actually mounts. The host self-gates on detectivePair.
const SubjectDetectiveHost = lazy(() => import("./SubjectDetectiveHost"));

export type SubjectCaseConfig = {
  /** Subject title as kids see it ("Math", "Physics", …). */
  title: string;
  /** The registry subject id: the key progress is recorded under,
   * and the prefix for data-testids ("math" keeps math-case,
   * math-result, …). */
  subjectId: string;
  /** The subject's playable items for one age band, in deal order. */
  itemsForGroup: (group: AgeGroup) => UnitItem[];
  /** The subject's answer lookup, keyed by item id. */
  answerFor: AnswerFor;
  /** Optional card shown above the question (Journals: the clip's
   * caption text). Absent for every other subject: no change. */
  lead?: (item: UnitItem, reduced: boolean) => ReactNode;
  /** Optional live scene above the clue card (Math pilot,
   * feat/clue-scene-pilot: a short drawn film for the item's clue).
   * Answer-blind by construction, like the detective host: the
   * hook receives the item, a phase derived from this flow's own
   * state ("solved" once the case is done — or, on a `loseReveal`
   * item, once a wrong pick has revealed the summary — "setup"
   * before either), the reduced-motion flag and the band — never
   * the answer, a choice, or a pick. Absent for every other
   * subject: no change. */
  scene?: (item: UnitItem, phase: "setup" | "solved", reduced: boolean, band: AgeGroup) => ReactNode;
  /** Optional extra block inside the SOLVED result section
   * (act 3: the summary's full script as standing text). The
   * section renders only once the case is done, so this hook is
   * the post-solve counterpart of `lead` — it receives the item,
   * the reduced-motion flag and the band. Absent for subjects
   * without post-solve extras: no change. */
  resultExtra?: (item: UnitItem, reduced: boolean, band: AgeGroup) => ReactNode;
  /** Optional L1 lose path: passing this hook at all opts the
   * subject in — on the entry question, EVERY item's second
   * distinct wrong answer reveals (the supportive line, the
   * answer-first line, and the item's act-3 summary where one
   * exists), while the first wrong answer (and any repeat of
   * it) leaves the player at the answer card's "try again".
   * The hook's return value no longer gates the counting: it
   * names which items' summaries play as the explanation (the
   * summary rendering and narration self-gate on that).
   * Absent, every wrong answer behaves exactly as before. */
  loseReveal?: (item: UnitItem, band: AgeGroup) => boolean;
};

export function SubjectCase({
  title,
  subjectId,
  itemsForGroup,
  answerFor,
  lead,
  scene,
  resultExtra,
  loseReveal,
  group,
  onExit,
  onCelebrate,
  onEndGame,
  onResetHistory,
  onResumeCase,
  loopInProgress,
}: SubjectCaseConfig &
  SubjectProps & {
    /** GameApp's celebration trigger (the same one LoopScreen receives). */
    onCelebrate?: (spec: CelebrationSpec) => void;
    /** GameApp's End game (handleEndGame + leave the subjects): the
     * header's End game button, the GeoDetective cluster pattern. */
    onEndGame?: () => void;
    /** GameApp's "Start over" reset flow (handleResetHistory).
     * Accepted for the shared wrapper contract; the case renders
     * no control from it since item 6 (one exit word per screen —
     * the header's End game is the case's exit). */
    onResetHistory?: () => ResetHistoryResult;
    /** GameApp's GeoDetective tap-in (leaves the subjects and opens
     * the loop, whose screen resumes the saved mystery). */
    onResumeCase?: () => void;
    /** Whether a GeoDetective mystery is mid-play and resumable
     * (the loop store, read by GameApp): the header's resume button
     * renders only while this holds. */
    loopInProgress?: boolean;
  }) {
  const reduced = usePrefersReducedMotion();
  // The registry passes the session's group; fall back to the stored
  // profile read so a direct mount still deals the right band.
  const band = group ?? getAgeGroup();
  const items = itemsForGroup(band);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // L1 lose path: true once the second distinct wrong answer on
  // the entry question has revealed the answer for the current
  // case — on every item, with the item's solved summary as the
  // explanation where one exists. Reset with the case
  // (nextCase); a correct pick never sets it.
  const [loseRevealed, setLoseRevealed] = useState(false);
  // The supportive line's beat: false while its clip is playing
  // (or waiting to start), true once it has ended or been
  // skipped (sound off, claim denied, clip error, or the ~4s
  // cap). Only the scene's phase waits on this — the reveal
  // section itself renders the moment loseRevealed is set.
  const [supportHeard, setSupportHeard] = useState(false);
  const supportAudioRef = useRef<HTMLAudioElement | null>(null);
  const supportClaimRef = useRef<VoiceClaim | null>(null);
  const supportTimerRef = useRef<number | null>(null);
  const supportGenRef = useRef(0);
  // The distinct wrong answers given on the current case's entry
  // question, keyed as lose-reveal.ts defines (a pick by its
  // choice string, a typed answer by its parsed value, every
  // unparseable typed answer under one shared key). The reveal
  // fires when this set reaches LOSE_REVEAL_AFTER_WRONG.
  const wrongKeysRef = useRef<Set<string>>(new Set());
  // "main" asks the entry; "followUp" asks its follow-up; "done"
  // shows the result with both answers.
  const [phase, setPhase] = useState<CasePhase>("main");
  const solved = phase === "done";
  // The scene's phase: the lose reveal performs the same solved
  // beat as a win — the case itself is not done, so nothing else
  // in this flow keys off this; it feeds the scene hook only.
  const scenePhase: "setup" | "solved" =
    solved || (loseRevealed && supportHeard) ? "solved" : "setup";
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // ── The supportive line's voice ─────────────────────────────
  // The reveal fires: the supportive clip plays FIRST, through
  // the shared voice channel (the ClueScene contract — one
  // voice at a time, an automatic claim that is denied proceeds
  // silently), and only when it ends does supportHeard flip and
  // the scene start its act-3 solved performance. Sound off, a
  // denied claim, a clip error, or the ~4s cap all flip it at
  // once, so the scene never waits on a voice that is not coming.
  const clearSupportPlayback = () => {
    if (supportTimerRef.current !== null) {
      window.clearTimeout(supportTimerRef.current);
      supportTimerRef.current = null;
    }
    if (supportAudioRef.current) {
      supportAudioRef.current.pause();
      supportAudioRef.current.removeAttribute("src");
      supportAudioRef.current = null;
    }
    supportClaimRef.current?.release();
    supportClaimRef.current = null;
  };

  const stopSupportPlayback = () => {
    supportGenRef.current += 1;
    clearSupportPlayback();
  };

  const playSupportLine = () => {
    stopSupportPlayback();
    const gen = supportGenRef.current;
    if (!isSoundEnabled() || !soundAudible()) {
      setSupportHeard(true);
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished || supportGenRef.current !== gen) return;
      finished = true;
      clearSupportPlayback();
      setSupportHeard(true);
    };
    const claim = claimVoice("lose-support", finish, { userInitiated: false });
    if (!claim) {
      setSupportHeard(true);
      return;
    }
    supportClaimRef.current = claim;
    const audio = new Audio(loseSupportClipUrl());
    supportAudioRef.current = audio;
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    supportTimerRef.current = window.setTimeout(finish, 4000);
    void audio.play().catch(finish);
  };

  // Leaving the case silences the supportive line and frees the
  // channel (the ClueScene unmount rule).
  useEffect(
    () => () => {
      supportGenRef.current += 1;
      clearSupportPlayback();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Arrival focus, the LoopScreen pattern: land focus on the heading so
  // it is never stranded on the Home card that opened the case.
  useEffect(() => {
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, []);

  const item = items[index] ?? null;
  const answer = item ? answerFor(item.id) : null;

  // The game's header controls for the shell's bar — the same
  // Buttons, labels and testids as the game's own surfaces
  // (LoopScreen's End game; Home's GeoDetective card resume); the
  // handlers are GameApp's own, passed down through the picker.
  // The resume button renders only while a mystery is mid-play —
  // Home's card condition — never as a dead control.
  const resumeButton =
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
    ) : null;
  // The shared shell's slots (PR 3 Step 3.4): the resume control
  // rides SiteHeader's back slot beside Home (the picker pattern),
  // and End game is the header's one exit slot. Same Buttons, labels,
  // testids and handlers as the legacy ScreenShell controls row.
  const endGameButton = onEndGame ? (
    <Button
      variant="secondary"
      data-testid="end-game-button"
      className="min-h-[44px]"
      onClick={onEndGame}
    >
      End game
    </Button>
  ) : undefined;

  if (!item || !answer) {
    return (
      <main className="mode-screen mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8 why-learn-screen subject-case-screen">
        <SiteHeader
          onHome={onExit}
          status={null}
          mute={null}
          back={resumeButton ?? undefined}
          endGame={endGameButton}
        />
        <h1 ref={headingRef} tabIndex={-1} className="mode-title mt-4 text-3xl text-fg">
          {`${title} case`}
        </h1>
        <p className="mt-4 text-fg">
          No {title.toLowerCase()} case is ready for this age band yet.
        </p>
        {/* The shared footer (footer standardization, 2026-11-18),
            here in its Stories-lead form, as on the case screen. */}
        <SiteFooter lead={<ReadAloudPrefSettings />} />
      </main>
    );
  }

  // The entry currently being asked: the follow-up once the main
  // answer is correct, otherwise the entry itself.
  const active = phase === "followUp" && answer.followUp ? answer.followUp : answer;

  // Shared correct-answer path for picks and typed numbers: advance
  // the phase, and celebrate once, on the first correct answer.
  const onCorrect = () => {
    setPhase((p) => advanceCasePhase(answer, p, true));
    setPicked(null);
    // Per-subject progress (subject-progress.ts): a correct pick
    // in the main phase solves the unit, so record it under this
    // case's registry subject id — never a test id, so renaming a
    // test id can't orphan a player's saved progress.
    // The store's set semantics make a repeat record a no-op.
    if (phase === "main") recordUnitComplete(subjectId, item.id);
    if (phase === "main" && onCelebrate && !hasCelebratedFirstWin()) {
      markFirstWinCelebrated();
      onCelebrate(celebrationSpec("mystery-solved", "first-win"));
    }
  };

  // Shared wrong-answer path for picks and typed numbers: the
  // pick stands as feedback, and on the entry question of a
  // subject that passes a `loseReveal` hook the SECOND distinct
  // wrong answer also reveals — on EVERY item, whether or not
  // the item has a summary (the summary explains where one
  // exists; the L1 lose path, paced per the owner's 2026-11-19
  // decisions — see lose-reveal.ts). The hook's return value no
  // longer gates the counting; passing the hook at all is the
  // opt-in. `key` names the answer for distinctness: a pick keys
  // by its choice string, a typed answer by its parsed value (or
  // the shared unparseable key). The reveal is gated on the
  // entry question only — a follow-up's wrong answer never
  // counts and never reveals. When the reveal fires, the
  // supportive line is voiced first (playSupportLine) and the
  // scene's solved performance waits for it.
  const onWrong = (value: string, key: string) => {
    setPicked(value);
    if (phase === "main" && loseReveal) {
      if (recordDistinctWrong(wrongKeysRef.current, key)) {
        setLoseRevealed(true);
        playSupportLine();
      }
    }
  };

  const pick = (choice: string) => {
    if (solved || loseRevealed) return;
    if (choice === active.correct) {
      onCorrect();
    } else {
      onWrong(choice, choice);
    }
  };

  const checkNumber = (value: number | null, raw: string) => {
    if (solved || loseRevealed) return;
    // A number entry carries its value; an unparseable typed answer
    // is wrong the same way a wrong pick is.
    if (value === null || active.value === undefined || value !== active.value) {
      onWrong(raw, typedWrongKey(value));
    } else {
      onCorrect();
    }
  };

  const nextCase = () => {
    stopSupportPlayback();
    setIndex((i) => (i + 1) % items.length);
    setPicked(null);
    setLoseRevealed(false);
    setSupportHeard(false);
    wrongKeysRef.current.clear();
    setPhase("main");
  };

  return (
    <main
      className="mode-screen mx-auto flex min-h-dvh w-full max-w-(--page-narrow) flex-col px-5 pt-2 pb-8 why-learn-screen subject-case-screen"
      data-testid={`${subjectId}-case`}
      data-band={band}
      data-item={item.id}
    >
      {/* The shared shell (PR 3 Step 3.4): SiteHeader carries the
          one Home control — the legacy ScreenShell's BrandHomeButton
          lockup goes — with the resume control in its back slot and
          End game in its exit slot. The titles are this screen's own
          content block, in the same classes ScreenShell rendered.
          The page's top padding is 8px, not the old frame's 32px:
          the shell header's row carries its own vertical padding
          and is ~24px taller than the old home bar — the page gives
          that height back here so the case content keeps its
          measured place (the picker migration, Step 3.3, set this
          pattern). The end-of-flow HomeButtons in the result
          sections below stay: they are the sanctioned end surface,
          not header/footer chrome. */}
      <SiteHeader
        onHome={onExit}
        status={null}
        mute={null}
        back={resumeButton ?? undefined}
        endGame={endGameButton}
      />
      <p className="name-eyebrow mt-4">Case file · Why it matters</p>
      <h1 ref={headingRef} tabIndex={-1} className="mode-title mt-1 text-3xl text-fg">
        {`Why Do We Learn This? — ${title}`}
      </h1>
      <p className="mt-2 text-fg">
        {/* Item 14 (Stream W): the case count rides the shared
            Pill — the one AA count readout — not plain small
            text. The band beside it is the shell's own line. */}
        <Pill>{`Case ${index + 1} of ${items.length}`}</Pill>
        {` · Ages ${band}`}
      </p>

      <div className="mt-6 grid gap-4">
        {/* Holmes & Watson (flag-gated inside the host, default off =
            not rendered at all). Props come from the answer-blind
            whitelist builder ONLY (subject-host-props.ts): the pair
            never receives the item, the answer, or a pick's value.
            display:contents keeps this layout identical, mirroring
            LoopScreen's detective host slot. */}
        <div style={{ display: "contents" }} data-testid="subject-detective-host-slot">
          <Suspense fallback={null}>
            <SubjectDetectiveHost
              {...buildSubjectDetectiveHostProps({
                solved,
                wrongPick: picked !== null && !solved,
                finished: solved && index === items.length - 1,
              })}
            />
          </Suspense>
        </div>
        {lead ? lead(item, reduced) : null}
        {scene ? scene(item, scenePhase, reduced, band) : null}
        <ClueCard tier={title} index={0} text={item.why} revealed reduced={reduced} />
        {solved ? (
          <section
            aria-label="You solved it"
            className="loop-reveal mode-surface rounded-2xl border p-4"
            data-testid={`${subjectId}-result`}
          >
            <p className="verdict-headline loop-verdict-headline">🎯 You got it!</p>
            <p className="mt-2 text-fg">
              The answer is <strong>{answer.correct}</strong>. {answer.derivation}
            </p>
            {answer.followUp ? (
              <p className="mt-2 text-fg">
                Follow-up: <strong>{answer.followUp.correct}</strong>.{" "}
                {answer.followUp.derivation}
              </p>
            ) : null}
            {resultExtra ? resultExtra(item, reduced, band) : null}
            <p className="mt-3 text-fg" data-testid={`${subjectId}-used-in`}>
              {usedInLine(item.useElsewhere)}
            </p>
            <div className="mt-4 grid gap-2">
              {items.length > 1 ? (
                <button
                  type="button"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-fg"
                  onClick={nextCase}
                >
                  🔎 Next case
                </button>
              ) : null}
              <HomeButton onHome={onExit} testId="home-button-end" variant="secondary" className="w-full rounded-xl" />
            </div>
          </section>
        ) : loseRevealed ? (
          <section
            aria-label="The answer, and how it solves"
            className="loop-reveal mode-surface rounded-2xl border p-4"
            data-testid={`${subjectId}-lose-reveal`}
          >
            <p className="mt-2 text-fg" data-testid={`${subjectId}-lose-support`}>
              {LOSE_SUPPORT_LINE}
            </p>
            <p className="mt-2 text-fg" data-testid={`${subjectId}-lose-answer`}>
              The answer is <strong>{answer.correct}</strong> — here's how.
            </p>
            {resultExtra ? resultExtra(item, reduced, band) : null}
            <p className="mt-3 text-fg" data-testid={`${subjectId}-used-in`}>
              {usedInLine(item.useElsewhere)}
            </p>
            <div className="mt-4 grid gap-2">
              {items.length > 1 ? (
                <button
                  type="button"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-fg"
                  onClick={nextCase}
                >
                  🔎 Next case
                </button>
              ) : null}
              <HomeButton onHome={onExit} testId="home-button-end" variant="secondary" className="w-full rounded-xl" />
            </div>
          </section>
        ) : (
          <AnswerCard
            key={`${item.id}:${phase}`}
            prompt={active.prompt}
            choices={active.choices}
            picked={picked}
            onPick={pick}
            testId={`${subjectId}-answer-card`}
            kind={active.kind ?? "choice"}
            onNumber={checkNumber}
            moveFocus={phase === "followUp"}
          />
        )}
      </div>
      {/* Item 6 slice (Stream W): one exit word per screen. The
          case used to carry a second exit at the bottom — the
          game's "Start over" reset under a separated footer —
          beside the header's End game. The bottom duplicate is
          removed; End game in the header is the case's one exit
          word, and the picker keeps its own Start over (its only
          one). The onResetHistory prop stays in the contract —
          GameApp and the wrappers still pass it — but the case no
          longer renders a control from it. */}
      {/* The shared footer (footer standardization, 2026-11-18):
          SiteFooter + Grandpa's band under the case, its tailored
          lead the read-aloud "Stories:" settings — the same lead
          Home carries. End game in the header stays the one exit. */}
      <SiteFooter lead={<ReadAloudPrefSettings />} />
    </main>
  );
}
