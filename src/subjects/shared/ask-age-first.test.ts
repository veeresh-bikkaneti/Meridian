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
 * 1. The Why Learn card: GameApp's askAgeFirst holds the picker
 *    open behind AgeAskGate; the pick continues to the picker.
 * 2. Subject cards: the picker's case load runs through the same
 *    gate (GameApp passes it down as onAskAgeFirst).
 * 3. Resume your case: the subjects branch's resume and Home's
 *    GeoDetective card in its resume mode both ask first; the
 *    resume itself still runs the shared tap-in verbatim.
 * 4. The gate is prod's own picker: AgeAskGate hosts AgePicker
 *    and writes through the store's unset path (setBand) before
 *    continuing; backing out writes nothing.
 * 5. A band set means no change: askAgeFirst runs the
 *    continuation immediately when the profile is not unset, and
 *    the grown-ups settings flow (gate → picker) is untouched.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const gameApp = read("../../components/game-app.tsx");
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

describe("the gate holder (GameApp)", () => {
  it("holds the continuation in session-only state, dropped on a cache restore", () => {
    assert.ok(
      gameApp.includes("const [ageAsk, setAgeAsk] = useState<{ proceed: () => void } | null>(null);"),
      "the held continuation starts empty and is never persisted",
    );
    const handler = region(
      gameApp,
      "const onPageShow = (e: PageTransitionEvent)",
      "}, []);",
    );
    assert.ok(handler.includes("setAgeAsk(null);"), "a cache restore drops the held continuation");
  });

  it("runs the continuation at once when a band is set, and holds it when none is", () => {
    const helper = region(gameApp, "const askAgeFirst = useCallback(", "  );\n");
    assert.ok(
      helper.includes('if (ageProfile.status !== "unset") {'),
      "the trigger is the profile's unset status — not the resolved band",
    );
    const setAt = helper.indexOf("proceed();");
    const holdAt = helper.indexOf("setAgeAsk({ proceed });");
    assert.ok(setAt >= 0 && holdAt > setAt, "band set → run now; unset → hold for the pick");
  });

  it("the pick clears the hold before the continuation runs; backing out only clears it", () => {
    const overlay = region(gameApp, "const ageAskOverlay = ageAsk ? (", ") : null;");
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
      gameApp.split("inert={ageSettingsOpen || ageAsk !== null || undefined}").length - 1,
      2,
      "both surfaces go inert behind the ask-first picker, like the settings overlay",
    );
  });
});

describe("the Why Learn path", () => {
  it("the card tap asks first and opens the picker off the pick", () => {
    const handler = region(gameApp, 'onWhyLearn={withCardTap("why-learn", () => {', "})}"); 
    assert.ok(handler.includes("askAgeFirst(() => setSubjectsOpen(true));"), "the open is the held continuation");
  });

  it("a subject card's case load runs through the gate and lands on the same subject", () => {
    assert.ok(
      subjectPicker.includes("onAskAgeFirst?: (proceed: () => void) => void;"),
      "the picker takes GameApp's gate as a prop",
    );
    const open = region(subjectPicker, "const openSubject = (mod: SubjectModule) => {", "\n  };\n");
    assert.ok(open.includes("if (onAskAgeFirst) onAskAgeFirst(proceed);"), "the load is gated when the host provides the gate");
    assert.ok(open.includes("else proceed();"), "and runs directly when it does not");
    assert.ok(
      open.includes("withChunkTimeout(mod.load(), `${mod.title} case screen`)"),
      "the continuation is the tapped subject's own load — the target survives the ask",
    );
    const branch = subjectsBranch(gameApp);
    assert.ok(
      branch.includes("onAskAgeFirst={(proceed) => askAgeFirst(proceed)}"),
      "GameApp passes its own gate down to the picker",
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
