import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ask first (fix/ask-age-first, owner decision 2026-11-14:
 * "Ask first"). A player with no age band set must be asked to
 * pick one before any case starts — the case-start paths never
 * silently default to the full-access band.
 *
 * There is no DOM test infra in this repo, so — the
 * case-navigation precedent — these tests pin the contract in the
 * component sources; the Playwright spec
 * (tests/e2e/ask-age-first.spec.ts) proves the behaviour against
 * the built artifact.
 *
 * The gated paths, and what each pin holds:
 * 1. Resume your case: the subjects branch's resume and Home's
 *    GeoDetective card in its resume mode both ask first; the
 *    resume itself still runs the shared tap-in verbatim.
 * 2. The gate is prod's own picker: AgeAskGate hosts AgePicker
 *    and writes through the store's unset path (setBand) before
 *    continuing; backing out writes nothing.
 * 3. A band set means no change: askAgeFirst runs the
 *    continuation immediately when the profile is not unset, and
 *    the grown-ups settings flow (gate → picker) is untouched.
 *
 * Amendment (Radhae's reconciliation design, voice call
 * 2026-11-15): the Why Learn entry and the subject cards no
 * longer route through the modal gate — the picker page carries
 * the ask itself (AgeBandControl: the band pills while unset,
 * the selected-band pill once set), and a subject tap with no band set
 * goes to the pills instead of opening a case. The amendment
 * pins are in their own describe below; the gate pins here now
 * cover only the paths that bypass the page.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const gameApp = read("../../components/game-app.tsx");
const ageHost = read("../../components/age-profile/use-age-profile-host.tsx");
const subjectPicker = read("./SubjectPicker.tsx");
const ageAskGate = read("../../components/age-profile/AgeAskGate.tsx");
const ageProfileSettings = read("../../components/age-profile/AgeProfileSettings.tsx");
const bands = read("../../game/age-profile/bands.ts");

/** The subjects branch of GameApp's render (the picker mount). */
function subjectsBranch(source: string): string {
  const start = source.indexOf("if (subjectsOpen) {");
  assert.ok(start >= 0, "subjects branch exists");
  const end = source.indexOf("if (starting) {", start);
  assert.ok(end > start, "subjects branch is bounded");
  return source.slice(start, end);
}

/** A named region of a source file, from a marker to the next marker. */
function region(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `region start exists: ${from}`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `region end exists: ${to}`);
  return source.slice(start, end);
}

describe("the gate holder (the age-profile host, mounted by GameApp)", () => {
  it("holds the continuation in session-only state, dropped on a cache restore", () => {
    assert.ok(
      ageHost.includes("const [ageAsk, setAgeAsk] = useState<{ proceed: () => void } | null>(null);"),
      "the held continuation starts empty and is never persisted",
    );
    const handler = region(
      gameApp,
      "const onPageShow = (e: PageTransitionEvent)",
      "}, []);",
    );
    assert.ok(handler.includes("clearAgeAsk();"), "a cache restore drops the held continuation");
    const clear = region(ageHost, "const clearAgeAsk = useCallback(", ");");
    assert.ok(clear.includes("setAgeAsk(null)"), "the host's clear drops the hold");
  });

  it("runs the continuation at once when a band is set, and holds it when none is", () => {
    const helper = region(ageHost, "const askAgeFirst = useCallback(", "  );\n");
    assert.ok(
      helper.includes('if (ageProfile.status !== "unset") {'),
      "the trigger is the profile's unset status — not the resolved band",
    );
    const setAt = helper.indexOf("proceed();");
    const holdAt = helper.indexOf("setAgeAsk({ proceed });");
    assert.ok(setAt >= 0 && holdAt > setAt, "band set → run now; unset → hold for the pick");
  });

  it("the pick clears the hold before the continuation runs; backing out only clears it", () => {
    const overlay = region(ageHost, "const ageAskGate = ageAsk ? (", ") : null;");
    const picked = region(overlay, "onPicked={() => {", "}}");
    assert.ok(picked.includes("setAgeAsk(null);"), "the hold clears on the pick");
    assert.ok(picked.includes("proceed();"), "and the held continuation runs");
    assert.ok(
      overlay.includes("onCancel={() => setAgeAsk(null)}"),
      "backing out clears the hold and runs nothing",
    );
  });

  it("renders the gate over Home and over the subjects branch, each inert behind it", () => {
    assert.equal(
      gameApp.split("{ageAskOverlay}").length - 1,
      2,
      "the overlay renders in the subjects branch and on Home",
    );
    assert.equal(
      // The shared prefix: Home's expression carries one extra term
      // (firstVisitModalOpen, the read-aloud arrival modal) after it.
      gameApp.split("inert={ageSettingsOpen || ageAsk !== null ||").length - 1,
      2,
      "both surfaces go inert behind the ask-first picker, like the settings overlay",
    );
  });
});

describe("the Why Learn path (amendment: the page asks itself)", () => {
  it("the card tap opens the picker directly — no modal ask on this path", () => {
    const handler = region(gameApp, 'onWhyLearn={withCardTap("why-learn", () => {', "})}");
    assert.ok(handler.includes("setSubjectsOpen(true);"), "the tap opens the picker");
    assert.ok(!handler.includes("askAgeFirst"), "the modal gate no longer holds this path — the page's pills ask");
  });

  it("GameApp passes the picker no gate — only the change write's run input", () => {
    const branch = subjectsBranch(gameApp);
    assert.ok(!branch.includes("onAskAgeFirst"), "the picker takes no gate prop");
    assert.ok(
      branch.includes("bandChangeRunInProgress={run !== null}"),
      "a live subject round is the picker's only deferral input (item 17)",
    );
    assert.ok(
      !branch.includes("bandChangeRunInProgress={run !== null || loopOpen}"),
      "a background GeoDetective case no longer defers the picker's band change (item 17)",
    );
    assert.ok(!subjectPicker.includes("onAskAgeFirst"), "the prop is gone from the picker too");
  });

  it("item 17: the settings mounts keep loopOpen as a run in progress", () => {
    // The split is deliberate: the settings confirm flow treats
    // leaving an open case as a run in progress; the picker does not,
    // because its band event has no round boundary of its own to land
    // on while a case sits open — deferring it starved the re-deal.
    const settingsMounts = gameApp.split("ageSettings(run !== null || loopOpen)").length - 1;
    assert.equal(settingsMounts, 2, "both settings mounts keep the loopOpen expression");
    assert.ok(
      ageHost.includes("runInProgress={runInProgress}"),
      "the host passes the composer's value through to AgeProfileSettings",
    );
  });

  it("a subject card's tap with no band set goes to the pills, never to a case", () => {
    const open = region(subjectPicker, "const openSubject = (mod: SubjectModule) => {", "\n  };\n");
    assert.ok(
      open.includes('loadProfile().status === "unset"'),
      "the guard reads the profile's own status at tap time",
    );
    assert.ok(open.includes("bandBarRef"), "the tap takes the player to the band bar");
    assert.ok(open.includes('data-testid^="band-pill-"'), "and lands focus on the first pill");
    const guardAt = open.indexOf('loadProfile().status === "unset"');
    const loadAt = open.indexOf("withChunkTimeout(mod.load()");
    assert.ok(guardAt >= 0 && loadAt > guardAt, "the guard stands before the case load");
    assert.ok(open.includes("return;"), "an unset tap starts nothing");
    assert.ok(
      open.includes("withChunkTimeout(mod.load(), `${mod.title} case screen`)"),
      "with a band set the tap still loads the tapped subject's own case",
    );
  });
});

describe("the picker page's band control (amendment)", () => {
  const bandControl = read("../../components/age-profile/AgeBandControl.tsx");

  it("lives in the age-profile UI module and writes only through the store's own paths", () => {
    assert.ok(
      bandControl.includes('import { setBand, saveBand } from "@/game/age-profile/store.ts";'),
      "the settings flow's own write calls, imported its way",
    );
    assert.ok(bandControl.includes("setBand(id);"), "a first pick uses the unset path");
    assert.ok(
      bandControl.includes("saveBand(id, { runInProgress })"),
      "a change uses the change path with the host's run input",
    );
    assert.ok(!bandControl.includes("GrownUpGate"), "no grown-up gate on the page's own band choice");
    assert.ok(!bandControl.includes("localStorage"), "no storage access of its own — the store owns the key");
  });

  it("shows the pills while unset and the selected-band pill once set", () => {
    assert.ok(bandControl.includes('profile.status === "unset"'), "the unset state keys on the profile's own status");
    assert.ok(bandControl.includes('data-testid="band-pills"'), "the pill row");
    assert.ok(bandControl.includes("data-testid={`band-pill-${id}`}"), "one pill per band");
    assert.ok(bandControl.includes('data-testid="band-selected-pill"'), "the collapsed set state is the selected-band pill");
    assert.ok(!bandControl.includes('data-testid="change-band-button"'), "the retired Change band testid is gone");
    assert.ok(bandControl.includes("Tap to change band."), "the pill's label says what tapping it does");
    assert.ok(bandControl.includes("{selectedLabel}"), "the pill's text is the selected band's own label");
    assert.ok(bandControl.includes("AGE_BAND_IDS.map"), "the pills are the band table's bands, in its order");
    assert.ok(bandControl.includes("AGE_BANDS[id].label"), "with the band table's own labels");
  });

  it("the selected-band pill re-opens the pills, and the control follows changes made anywhere", () => {
    assert.ok(bandControl.includes("onClick={() => setExpanded(true)}"), "the tap re-opens the pill row");
    assert.ok(bandControl.includes("onAgeProfileChanged("), "the control subscribes to the change event");
    assert.ok(bandControl.includes("setExpanded(false)"), "a pick — or any external change — collapses it again");
    assert.ok(
      bandControl.includes("const current = loadProfile();") &&
        bandControl.includes("id !== current.band"),
      "the pick reads the profile fresh, and re-picking the current band writes nothing (the change path is for a different band)",
    );
  });

  it("the picker hosts the control in its title block and names no band it does not have", () => {
    assert.ok(
      subjectPicker.includes('import AgeBandControl from "@/components/age-profile/AgeBandControl";'),
      "hosted by the picker",
    );
    assert.ok(
      subjectPicker.includes("<AgeBandControl runInProgress={bandChangeRunInProgress} />"),
      "with the run input passed through",
    );
    assert.ok(
      subjectPicker.includes('profileStatus === "unset" ? "Pick a subject" : `Pick a subject · Ages ${band}`'),
      "the sub line claims a band only when one is set",
    );
    assert.ok(
      subjectPicker.includes('<div ref={bandBarRef} className="mt-3">'),
      "the band bar sits in the title block under the sub line (D1 adjustment)",
    );
    assert.ok(
      !subjectPicker.includes('<div ref={bandBarRef} className="mt-5">'),
      "the retired below-hero band bar is gone — one control, one place",
    );
  });
});

describe("Resume your case", () => {
  it("the subjects branch asks first, then runs the shared resume verbatim", () => {
    const branch = subjectsBranch(gameApp);
    const resume = region(branch, "onResumeCase={() => {", "}}");
    assert.ok(resume.includes("askAgeFirst(() => {"), "the resume is held behind the ask");
    assert.ok(
      resume.includes("if (openGeoDetective()) setSubjectsOpen(false);"),
      "and the resume itself is unchanged — the shared tap-in, subjects closing behind it",
    );
  });

  it("Home's card asks first only in its resume mode; a fresh deal is not gated", () => {
    const handler = region(gameApp, 'onLoop={withCardTap("mystery", () => {', "})}");
    assert.ok(
      handler.includes("if (peekLoopProgress().inProgress) {"),
      "the gate keys on a mystery actually being mid-play",
    );
    const gatedAt = handler.indexOf("askAgeFirst(() => {");
    const directAt = handler.indexOf("openGeoDetective();", gatedAt);
    const elseAt = handler.indexOf("} else {");
    assert.ok(gatedAt >= 0 && directAt > gatedAt, "resume mode: ask, then tap in");
    assert.ok(elseAt > directAt && handler.indexOf("openGeoDetective();", elseAt) > elseAt, "fresh deal: the tap-in runs directly");
  });
});

describe("the gate itself (AgeAskGate)", () => {
  it("hosts prod's AgePicker — no new surface, no grown-up gate", () => {
    assert.ok(ageAskGate.includes('import { AgePicker } from "./AgePicker.tsx";'), "the picker's own component");
    assert.ok(ageAskGate.includes("<AgePicker"), "rendered verbatim");
    assert.ok(!ageAskGate.includes("GrownUpGate"), "the first ask is not behind the grown-up gate");
    assert.ok(!ageAskGate.includes("saveBand"), "an unset profile has nothing to change — the change path is not used");
    assert.ok(!ageAskGate.includes("localStorage"), "no storage access of its own — the store owns the key");
  });

  it("writes through the store's unset path before continuing", () => {
    assert.ok(
      ageAskGate.includes('import { setBand } from "@/game/age-profile/store.ts";'),
      "the store's own first-set call, imported the settings flow's way",
    );
    const save = region(ageAskGate, "const save = () => {", "  };");
    const writeAt = save.indexOf("setBand(selected);");
    const continueAt = save.indexOf("onPicked(selected);");
    assert.ok(writeAt >= 0 && continueAt > writeAt, "the band is written, then the continuation runs");
    assert.ok(save.includes("if (selected === null) return;"), "no selection, no write");
  });

  it("reads the profile through the facade's read side", () => {
    assert.ok(ageAskGate.includes("loadProfile()"), "the unset snapshot drives the picker's first-set copy");
  });
});

describe("bands and the untouched flows", () => {
  it("the bands stay exactly 7-10, 10-18, 18+ — nothing under 7", () => {
    assert.ok(
      bands.includes('export const AGE_BAND_IDS: AgeBandId[] = ["7-10", "10-18", "18+"];'),
      "the band table is the single source and is unchanged",
    );
  });

  it("the grown-ups settings flow still starts at its gate and keeps its own save paths", () => {
    assert.ok(
      ageProfileSettings.includes('useState<Step>("gate")'),
      "the settings flow still opens on the grown-up gate",
    );
    assert.ok(ageProfileSettings.includes("setBand(selected);"), "its first set still uses the unset path");
    assert.ok(ageProfileSettings.includes("saveBand(confirmTarget, { runInProgress })"), "its changes still use the change path");
    assert.ok(!ageProfileSettings.includes("AgeAskGate"), "the settings flow does not route through the ask gate");
    assert.ok(!gameApp.includes("onAskAgeFirst={openAgeSettings}"), "the two flows are never crossed");
  });
});
