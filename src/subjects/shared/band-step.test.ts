import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Age-band step (feat/why-learn-band-step, owner direction
 * 2026-11-15). The band now comes right after the "Why Do We Learn
 * This?" card: card tap → band step → picker → case, so the band is
 * picked in the flow instead of silently assumed (the case-nav
 * defect 4 follow-up: an unset profile played at 10-18 with no
 * in-flow way to pick).
 *
 * There is no DOM test infra in this repo, so — the
 * case-navigation.test.ts precedent — these tests pin the contract
 * in the component sources; the Playwright spec
 * (tests/e2e/why-learn-band-step.spec.ts) and the local
 * built-artifact harness prove the behaviour.
 *
 * The pins:
 * 1. The card tap lands on the band step, not the picker; the step
 *    state starts at "band" on every entry.
 * 2. A band tap writes through the age-profile store (the settings
 *    flow's own setBand / saveBand, called from inside the
 *    age-profile UI module) and advances in the same tap — no Save
 *    or confirm anywhere in the step, and no parallel band state.
 * 3. A stored profile band shows as the step's current selection.
 * 4. The picker's existing band behaviour is untouched: it still
 *    follows age-profile change events (re-deal + close case) and
 *    its footer still carries the grown-ups entry; the gated
 *    settings flow is unchanged.
 * 5. A back/forward-cache restore still lands on Home: the
 *    pageshow handler closes the subjects AND resets the step.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

const gameApp = read("../../components/game-app.tsx");
const bandStep = read("../../components/age-profile/BandStep.tsx");
const ageSettings = read("../../components/age-profile/AgeProfileSettings.tsx");
const subjectPicker = read("./SubjectPicker.tsx");

/** The subjects branch of GameApp's render (band step + picker mount). */
function subjectsBranch(source: string): string {
  const start = source.indexOf("if (subjectsOpen) {");
  assert.ok(start >= 0, "subjects branch exists");
  const end = source.indexOf("if (starting) {", start);
  assert.ok(end > start, "subjects branch is bounded");
  return source.slice(start, end);
}

describe("band step entry (pin 1)", () => {
  it("the why-learn card tap opens the subjects on the band step", () => {
    assert.ok(
      gameApp.includes('onWhyLearn={withCardTap("why-learn", () => {'),
      "the card tap handler is the two-step opener",
    );
    const tapAt = gameApp.indexOf('onWhyLearn={withCardTap("why-learn"');
    const tapSlice = gameApp.slice(tapAt, tapAt + 200);
    assert.ok(tapSlice.includes('setSubjectsStep("band");'), "the tap resets the step to band");
    assert.ok(tapSlice.includes("setSubjectsOpen(true);"), "the tap opens the subjects");
    assert.ok(
      gameApp.includes('const [subjectsStep, setSubjectsStep] = useState<"band" | "picker">("band");'),
      "the step state starts at band",
    );
  });

  it("the subjects branch renders the step before the picker", () => {
    const branch = subjectsBranch(gameApp);
    assert.ok(branch.includes('subjectsStep === "band" ? ('), "the branch switches on the step");
    const stepAt = branch.indexOf("<BandStep");
    const pickerAt = branch.indexOf("<SubjectPickerScreen");
    assert.ok(stepAt >= 0 && pickerAt > stepAt, "BandStep renders in the band arm, the picker after it");
    assert.ok(
      branch.includes('onPick={() => setSubjectsStep("picker")}'),
      "a pick advances the branch to the picker",
    );
    assert.ok(
      branch.includes("onExit={() => setSubjectsOpen(false)}"),
      "the step's Home exit closes the subjects",
    );
    assert.ok(
      branch.includes("group={getAgeGroup()}"),
      "the picker still mounts from the effective (just-written) band",
    );
  });
});

describe("band tap writes and advances (pin 2)", () => {
  it("the step writes through the store's own functions, from the age-profile UI module", () => {
    assert.ok(
      bandStep.includes('import { setBand, saveBand } from "@/game/age-profile/store.ts";'),
      "the step imports the mutations the settings flow imports",
    );
    assert.ok(
      bandStep.includes('if (profile.status === "unset") {\n      setBand(band);'),
      "first setup goes through setBand",
    );
    assert.ok(
      bandStep.includes("saveBand(band, { runInProgress });"),
      "a change goes through saveBand with the host's run state",
    );
    assert.ok(bandStep.includes("onPick(band);"), "the same tap advances");
    assert.ok(!bandStep.includes("localStorage"), "no parallel storage is touched");
  });

  it("the step carries no confirm and no gate of its own", () => {
    assert.ok(!bandStep.includes("Save change"), "no save button");
    assert.ok(!bandStep.includes("agep-save"), "no AgePicker save control");
    assert.ok(!bandStep.includes("onSave"), "no save callback");
    assert.ok(!bandStep.includes("GrownUpGate"), "the step does not re-implement the gate");
    assert.ok(
      bandStep.includes('data-testid={`band-step-card-${id}`}'),
      "each band card is its own tap target",
    );
  });
});

describe("current selection (pin 3)", () => {
  it("the stored band renders as the checked card", () => {
    assert.ok(
      bandStep.includes("useState<AgeProfile>(() => loadProfile())"),
      "the step reads the stored profile on arrival",
    );
    assert.ok(
      bandStep.includes("const current = profile.band === id;"),
      "the current band is derived from the profile",
    );
    assert.ok(
      bandStep.includes('current ? " agep-card-checked" : ""'),
      "the current card carries AgePicker's checked presentation",
    );
    assert.ok(
      bandStep.includes("AGE_BAND_IDS.map((id, i) => {"),
      "all three bands render from the band table",
    );
  });
});

describe("existing band behaviour untouched (pin 4)", () => {
  it("the picker still re-deals on age-profile change events", () => {
    assert.ok(
      subjectPicker.includes("onAgeProfileChanged(() => {"),
      "the picker still subscribes to the change event",
    );
    assert.ok(subjectPicker.includes("setBand(getAgeGroup());"), "the picker re-reads the band");
    assert.ok(subjectPicker.includes("setOpened(null);"), "an open case still closes on a change");
  });

  it("the grown-ups gate flow is unchanged and still reachable from the picker", () => {
    assert.ok(ageSettings.includes("GrownUpGate"), "the settings flow still opens with the gate");
    assert.ok(ageSettings.includes("setBand(selected);"), "the settings flow still writes via setBand");
    assert.ok(ageSettings.includes("saveBand(confirmTarget, { runInProgress });"), "the settings flow still writes via saveBand");
    assert.ok(
      subjectPicker.includes('data-testid="grownups-link"'),
      "the picker's grown-ups entry is still rendered",
    );
    assert.ok(
      subjectPicker.includes("onClick={onOpenAgeSettings}"),
      "the grown-ups entry still opens GameApp's hosted settings",
    );
  });
});

describe("cache restore (pin 5)", () => {
  it("a pageshow restore closes the subjects and resets the step", () => {
    const showAt = gameApp.indexOf("const onPageShow = (e: PageTransitionEvent) => {");
    assert.ok(showAt >= 0, "the pageshow handler exists");
    const handler = gameApp.slice(showAt, showAt + 400);
    assert.ok(handler.includes("if (!e.persisted) return;"), "only restores are handled");
    assert.ok(handler.includes("setSubjectsOpen(false);"), "the subjects close on restore");
    assert.ok(handler.includes('setSubjectsStep("band");'), "the step resets on restore");
  });
});
