import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Case-navigation fixes (fix/case-navigation, owner reports 2026-11-14).
 *
 * There is no DOM test infra in this repo, so — the question-bubble
 * precedent — these tests pin the rendered contract in the component
 * sources; the Playwright spec (tests/e2e/subject-case-navigation
 * .spec.ts) proves the behaviour against the built artifact.
 *
 * Four reports, four pins:
 * 1. "The game loads with a clue open": the tap-in screens are
 *    session-only state, initialised closed, never read from storage;
 *    a back/forward-cache restore (pageshow, persisted) closes them
 *    again so the landing is Home.
 * 2. No End game on the case screen: the case shell's header carries
 *    the game's own End game button (GeoDetective's cluster), wired
 *    to GameApp's handleEndGame.
 * 3. No reset in the Why Learn flow: the game's own "Start over"
 *    control (ResetHistoryControl + handleResetHistory) renders on
 *    the picker; the control lives in its own module so the lazy
 *    subject chunk never imports the app shell. (Item 6 update,
 *    Stream W: the case no longer renders it — End game in the
 *    header is the case's one exit word.)
 * 4. No age picker in the Why Learn flow: the picker keeps the band
 *    in state, follows age-profile change events (re-deal + close
 *    any open case), and its footer carries Home's grown-ups entry
 *    into GameApp's hosted AgeProfileSettings.
 *
 * Amendment (owner decision, 2026-11-14): report 2 also asked for
 * the game's resume on the case screen. It shipped as a finding —
 * no such control existed — and the owner overruled: the case (and
 * the picker) now carry "Resume your case" while a GeoDetective
 * mystery is mid-play, wired to GameApp's own GeoDetective tap-in
 * (the loop screen resumes the saved mystery from the loop store).
 * Three more pins:
 * 5. GameApp shares one tap-in between Home's card and the resume
 *    control, and the subjects branch offers resume on Home's own
 *    condition: the loop store holds a mystery mid-play and the
 *    band does not lock GeoDetective.
 * 6. The case and the picker render the control only on that
 *    condition — absent (never disabled) when nothing is resumable.
 * 7. Every subject wrapper forwards the two new props.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const gameApp = read("../../components/game-app.tsx");
const resetControl = read("../../components/reset-history-control.tsx");
const subjectCase = read("./SubjectCase.tsx");
const subjectPicker = read("./SubjectPicker.tsx");

/** The subjects branch of GameApp's render (the picker mount). */
function subjectsBranch(source: string): string {
  const start = source.indexOf("if (subjectsOpen) {");
  assert.ok(start >= 0, "subjects branch exists");
  const end = source.indexOf("if (starting) {", start);
  assert.ok(end > start, "subjects branch is bounded");
  return source.slice(start, end);
}

describe("boot landing (defect 1)", () => {
  it("the picker open state is session-only, initialised closed", () => {
    assert.ok(
      gameApp.includes("const [subjectsOpen, setSubjectsOpen] = useState<boolean>(false);"),
      "subjectsOpen starts false",
    );
    assert.ok(
      gameApp.includes("Never persisted — a reload lands on Home"),
      "the never-persisted rule stays documented at the state",
    );
    assert.ok(
      subjectPicker.includes("useState<{ title: string; Case: CaseComponent } | null>(null)"),
      "the picker's opened case starts null",
    );
  });

  it("a back/forward-cache restore closes the tap-in screens", () => {
    assert.ok(gameApp.includes('window.addEventListener("pageshow"'), "pageshow listener registered");
    const start = gameApp.indexOf("const onPageShow = (e: PageTransitionEvent)");
    assert.ok(start >= 0, "the restore handler exists");
    const handler = gameApp.slice(start, gameApp.indexOf("}, []);", start));
    assert.ok(handler.includes("if (!e.persisted) return;"), "only cache restores act");
    assert.ok(handler.includes("setSubjectsOpen(false);"), "subjects close on restore");
    assert.ok(handler.includes("writeLoopOpen(false);"), "the loop's stored flag clears with it");
    assert.ok(handler.includes("setLoopOpen(false);"), "the loop closes on restore (B7)");
  });
});

describe("case screen game controls (defect 2)", () => {
  it("the legacy ScreenShell file is deleted (PR 3 Step 4): no screen can adopt it again", () => {
    assert.ok(
      !existsSync(join(here, "../../components/ui/screen-shell.tsx")),
      "screen-shell.tsx is gone; screens use PageShell/SiteHeader",
    );
    for (const [name, src] of [
      ["game-app", gameApp],
      ["SubjectCase", subjectCase],
      ["SubjectPicker", subjectPicker],
    ] as const) {
      assert.ok(!src.includes("<ScreenShell"), `${name}: no ScreenShell use`);
      assert.ok(!src.includes('from "@/components/ui/screen-shell"'), `${name}: no ScreenShell import`);
    }
  });

  it("the picker no longer passes a wordmark as the shell sound slot", () => {
    assert.ok(!subjectPicker.includes("why-learn-wordmark"), "the old wordmark span is gone");
    assert.ok(!subjectPicker.includes("sound={"), "the picker passes no sound/wordmark slot");
  });

  it("the case carries the game's End game button in both shells", () => {
    // PR 3 Step 3.4: both SubjectCase branches render the shared
    // SiteHeader — End game in its exit slot, the resume control in
    // its back slot — and the legacy ScreenShell is gone.
    assert.equal(
      subjectCase.split("endGame={endGameButton}").length - 1,
      2,
      "the case shell and the empty-band shell both take the exit slot",
    );
    assert.equal(
      subjectCase.split("back={resumeButton ?? undefined}").length - 1,
      2,
      "both shells carry the resume control in the back slot",
    );
    assert.ok(!subjectCase.includes("<ScreenShell"), "the legacy ScreenShell is gone from the case");
    assert.ok(
      !subjectCase.includes('from "@/components/ui/screen-shell"'),
      "no ScreenShell import",
    );
    assert.ok(subjectCase.includes('data-testid="end-game-button"'), "same testid as the game's");
    assert.ok(subjectCase.includes('variant="secondary"'), "same Button variant as GeoDetective's");
    assert.ok(subjectCase.includes("onClick={onEndGame}"), "wired to the passed handler");
    assert.ok(subjectCase.includes(">End game<") || subjectCase.includes("End game\n"), "the game's own label");
  });

  it("GameApp wires the subjects branch to its own handleEndGame", () => {
    const branch = subjectsBranch(gameApp);
    assert.ok(branch.includes("onEndGame={() => {"), "the picker receives an End game handler");
    assert.ok(branch.includes("handleEndGame();"), "it is GameApp's own session end");
    assert.ok(branch.includes("setSubjectsOpen(false);"), "and it leaves the subjects for Home");
  });
});

describe("reset in the Why Learn flow (defect 3)", () => {
  it("the game's reset control lives in its own module, copy byte-locked", () => {
    assert.ok(resetControl.includes('opener: "Start over"'), "locked opener");
    assert.ok(resetControl.includes('title: "Start over?"'), "locked title");
    assert.ok(resetControl.includes('confirm: "Yes, start over"'), "locked confirm");
    assert.ok(resetControl.includes('cancel: "Keep my history"'), "locked cancel");
    assert.ok(
      resetControl.includes("This clears your misses to practise again, every place you have seen or cleared"),
      "locked sub copy",
    );
    assert.ok(resetControl.includes('data-testid="reset-history-open"'), "opener testid");
    assert.ok(resetControl.includes('data-testid="reset-history-confirm"'), "dialog testid");
    assert.ok(resetControl.includes("export function ResetHistoryControl("), "the control is exported");
  });

  it("GameApp renders the shared control and no longer defines it in place", () => {
    assert.ok(
      gameApp.includes('import { ResetHistoryControl } from "./reset-history-control";'),
      "GameApp imports the shared control",
    );
    assert.ok(!gameApp.includes("function ResetHistoryControl("), "no second in-place definition");
    assert.ok(
      gameApp.split("<ResetHistoryControl onReset={onResetHistory} />").length - 1 >= 2,
      "the home surfaces keep rendering it",
    );
  });

  it("the picker renders the reset, wired to handleResetHistory; the case no longer does (item 6)", () => {
    assert.ok(subjectPicker.includes("<ResetHistoryControl onReset={onResetHistory} />"), "picker footer control");
    assert.ok(
      !subjectCase.includes("<ResetHistoryControl onReset={onResetHistory} />"),
      "case footer control removed — one exit word per screen (item 6)",
    );
    const branch = subjectsBranch(gameApp);
    assert.ok(branch.includes("const result = handleResetHistory();"), "GameApp's own reset flow");
    assert.ok(
      branch.includes("if (result.failed.length === 0) setSubjectsOpen(false);"),
      "a clean reset leaves the subjects so Home shows the success toast",
    );
  });

  it("every subject wrapper forwards the case controls", () => {
    const wrappers = [
      "../math/MathCase.tsx",
      "../physics/PhysicsCase.tsx",
      "../chemistry/ChemistryCase.tsx",
      "../general-knowledge/GeneralKnowledgeCase.tsx",
      "../social-studies/SocialStudiesCase.tsx",
      "../journals/JournalsCase.tsx",
    ];
    for (const rel of wrappers) {
      const src = read(rel);
      assert.ok(src.includes("onEndGame?: () => void;"), `${rel} forwards End game`);
      assert.ok(
        src.includes("onResetHistory?: () => ResetHistoryResult;"),
        `${rel} forwards the reset`,
      );
    }
  });
});

describe("age band picker in the Why Learn flow (defect 4)", () => {
  it("the picker keeps the band in state and follows change events", () => {
    assert.ok(
      subjectPicker.includes("useState<AgeGroup>(() => group ?? getAgeGroup())"),
      "band initialised from the session group / stored profile",
    );
    assert.ok(subjectPicker.includes("onAgeProfileChanged(() => {"), "subscribed to band changes");
    const start = subjectPicker.indexOf("onAgeProfileChanged(() => {");
    const cb = subjectPicker.slice(start, subjectPicker.indexOf("}),", start));
    assert.ok(cb.includes("setBand(getAgeGroup());"), "the band re-reads on change");
    assert.ok(cb.includes("setOpened(null);"), "an open case closes back to the re-dealt list");
  });

  it("the picker footer carries Home's grown-ups entry", () => {
    // PR 3 Step 3.3: the hand-built footer became the shared
    // SiteFooter; the grown-ups entry it renders is the same one
    // Home's footer carries (same testid, same accessible label —
    // pinned in shared-shell.test.ts against site-footer.tsx).
    assert.ok(
      subjectPicker.includes("<SiteFooter lead={<Pill>Ages {band}</Pill>} onGrownUps={onOpenAgeSettings}"),
      "the shared footer, wired to GameApp's hosted settings, with the picker's tailored Ages pill in the lead slot (footer standardization, 2026-11-18)",
    );
    assert.ok(!subjectPicker.includes('className="agep-footer"'), "no hand-built footer row");
  });

  it("the picker header is the shared SiteHeader (PR 3 Step 3.3)", () => {
    assert.ok(
      subjectPicker.includes("<SiteHeader onHome={onExit} status={null} mute={null} back={resumeControl} />"),
      "SiteHeader carries Home; the resume control rides the back slot",
    );
    assert.ok(!subjectPicker.includes("<ScreenShell"), "the legacy ScreenShell is gone from the picker");
    assert.ok(!subjectPicker.includes('from "@/components/ui/screen-shell"'), "no ScreenShell import");
  });

  it("GameApp hosts the age settings over the subjects branch too", () => {
    const branch = subjectsBranch(gameApp);
    assert.ok(branch.includes("onOpenAgeSettings={openAgeSettings}"), "the picker gets the opener");
    assert.ok(branch.includes("<AgeProfileSettings"), "the settings flow renders in this branch");
    assert.ok(branch.includes("onClose={closeAgeSettings}"), "with GameApp's own close (focus return)");
    assert.ok(branch.includes("onToast={setAgeToast}"), "with GameApp's own toast");
    assert.ok(
      branch.includes("inert={ageSettingsOpen || ageAsk !== null || undefined}"),
      "the picker goes inert behind it (and behind the ask-first picker)",
    );
  });
});

describe("resume control on the Why Learn screens (defect 2, amendment)", () => {
  it("one GeoDetective tap-in is shared by Home's card and the resume control", () => {
    assert.ok(
      gameApp.includes("const openGeoDetective = useCallback((): boolean => {"),
      "the shared tap-in exists",
    );
    const start = gameApp.indexOf("const openGeoDetective = useCallback(");
    const body = gameApp.slice(start, gameApp.indexOf("}, [ageBand]);", start));
    assert.ok(
      body.includes('if (isLoopLocked(ageBand, "geodetective")) return false;'),
      "the band lock guard is the card's own",
    );
    assert.ok(body.includes("writeLoopOpen(true);"), "it records the open flag, as the card's tap did");
    assert.ok(body.includes("setLoopOpen(true);"), "it opens the loop, as the card's tap did");
    assert.ok(
      gameApp.includes('onLoop={withCardTap("mystery", () => {'),
      "Home's card routes to the shared tap-in (no second implementation)",
    );
    const loopStart = gameApp.indexOf('onLoop={withCardTap("mystery"');
    const loopHandler = gameApp.slice(loopStart, gameApp.indexOf("})}", loopStart));
    assert.ok(loopHandler.includes("openGeoDetective();"), "the card's tap-in is the shared one");
    assert.ok(
      loopHandler.includes("peekLoopProgress().inProgress") &&
        loopHandler.includes("askAgeFirst(() => {"),
      "ask-first amendment: the card's resume offer asks first when no band is set",
    );
  });

  it("the subjects branch offers resume on Home's own condition", () => {
    const branch = subjectsBranch(gameApp);
    assert.ok(branch.includes("peekLoopProgress().inProgress"), "the loop store decides resumability");
    assert.ok(
      branch.includes('!isLoopLocked(ageBand, "geodetective")'),
      "a locked band never offers it (Home renders the locked card instead)",
    );
    assert.ok(
      branch.includes("if (openGeoDetective()) setSubjectsOpen(false);"),
      "resume runs the shared tap-in and closes the subjects behind it",
    );
  });

  it("the case renders Resume your case only while a mystery is mid-play", () => {
    assert.ok(subjectCase.includes('data-testid="resume-case-button"'), "the control's testid");
    assert.ok(subjectCase.includes("Resume your case"), "prod's own label from Home's card");
    assert.ok(
      subjectCase.includes('aria-label="GeoDetective: Resume your case"'),
      "the card's accessible name",
    );
    assert.ok(subjectCase.includes("onClick={onResumeCase}"), "wired to the passed handler");
    assert.ok(
      subjectCase.includes("onResumeCase && loopInProgress"),
      "gated on the resumable condition — absent, never disabled, otherwise",
    );
  });

  it("the picker offers the same control and forwards both props to the case", () => {
    assert.ok(subjectPicker.includes('data-testid="resume-case-button"'), "the picker's own header control");
    assert.ok(subjectPicker.includes("back={resumeControl}"), "in the shell header's back slot (PR 3 Step 3.3)");
    assert.ok(subjectPicker.includes("onResumeCase={onResumeCase}"), "forwarded to the opened case");
    assert.ok(subjectPicker.includes("loopInProgress={loopInProgress}"), "the condition forwarded with it");
  });

  it("every subject wrapper forwards the resume props", () => {
    const wrappers = [
      "../math/MathCase.tsx",
      "../physics/PhysicsCase.tsx",
      "../chemistry/ChemistryCase.tsx",
      "../general-knowledge/GeneralKnowledgeCase.tsx",
      "../social-studies/SocialStudiesCase.tsx",
      "../journals/JournalsCase.tsx",
    ];
    for (const rel of wrappers) {
      const src = read(rel);
      assert.ok(src.includes("onResumeCase?: () => void;"), `${rel} forwards the resume handler`);
      assert.ok(src.includes("loopInProgress?: boolean;"), `${rel} forwards the resumable flag`);
    }
  });
});
