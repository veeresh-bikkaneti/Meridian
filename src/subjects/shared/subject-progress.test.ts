/**
 * Per-subject progress — the store behind the Why Learn picker's
 * per-subject Reset (owner, 2026-11-17: "reset should be allowed
 * per subject").
 *
 * Store-behaviour tests run against an in-memory Storage stand-in
 * (the reset-history.test.ts pattern); the wiring into
 * SubjectCase (record on a main-phase solve) and SubjectPicker
 * (one Reset control per card, a sibling of the card's open
 * button) is pinned in source, this repo's style for these
 * screens — the Playwright specs prove the behaviour against the
 * built artifact.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUBJECT_PROGRESS_KEY,
  clearAllSubjectProgress,
} from "../../game/subject-progress-store-key.ts";
import {
  clearSubjectProgress,
  hasSubjectProgress,
  onSubjectProgressChanged,
  readSubjectProgress,
  recordUnitComplete,
} from "./subject-progress.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

class FakeStorage {
  data = new Map<string, string>();
  getItem = (k: string): string | null => (this.data.has(k) ? this.data.get(k)! : null);
  setItem = (k: string, v: string): void => {
    this.data.set(k, String(v));
  };
  removeItem = (k: string): void => {
    this.data.delete(k);
  };
}

describe("subject-progress store", () => {
  it("round-trips: a recorded unit reads back under its subject", () => {
    const s = new FakeStorage();
    recordUnitComplete("math", "fair-share", s);
    assert.deepEqual(readSubjectProgress(s), { math: ["fair-share"] });
    assert.equal(hasSubjectProgress("math", s), true);
    assert.equal(hasSubjectProgress("physics", s), false);
    assert.ok(s.getItem(SUBJECT_PROGRESS_KEY) !== null, "stored under the module's own key");
  });

  it("record is idempotent: the same unit twice is one entry, one change event", () => {
    const s = new FakeStorage();
    let events = 0;
    const off = onSubjectProgressChanged(() => {
      events += 1;
    });
    recordUnitComplete("math", "fair-share", s);
    recordUnitComplete("math", "fair-share", s);
    off();
    assert.deepEqual(readSubjectProgress(s), { math: ["fair-share"] });
    assert.equal(events, 1, "the repeat record emits nothing");
  });

  it("clearing one subject leaves every other subject intact (the negative pin)", () => {
    const s = new FakeStorage();
    recordUnitComplete("math", "fair-share", s);
    recordUnitComplete("physics", "pendulum", s);
    assert.equal(clearSubjectProgress("math", s), true);
    assert.deepEqual(readSubjectProgress(s), { physics: ["pendulum"] });
    assert.equal(hasSubjectProgress("math", s), false);
    assert.equal(hasSubjectProgress("physics", s), true);
  });

  it("clear-all empties the whole store and verifies by re-read", () => {
    const s = new FakeStorage();
    recordUnitComplete("math", "fair-share", s);
    recordUnitComplete("physics", "pendulum", s);
    assert.equal(clearAllSubjectProgress(s), true);
    assert.deepEqual(readSubjectProgress(s), {});
    assert.equal(s.getItem(SUBJECT_PROGRESS_KEY), null, "the empty store leaves no blob behind");
  });

  it("corrupt storage reads as empty and never throws", () => {
    const s = new FakeStorage();
    s.setItem(SUBJECT_PROGRESS_KEY, "{not json");
    assert.deepEqual(readSubjectProgress(s), {});
    s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify({ math: "not-an-array", physics: [1, 2] }));
    assert.deepEqual(readSubjectProgress(s), {}, "a wrong-shaped document fails closed to empty, never trusted in part");
    s.setItem(SUBJECT_PROGRESS_KEY, JSON.stringify(["math"]));
    assert.deepEqual(readSubjectProgress(s), {}, "a top-level array is not a progress document");
  });

  it("blocked storage never throws on any operation", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("blocked");
      },
      removeItem: (): void => {
        throw new Error("blocked");
      },
    };
    assert.deepEqual(readSubjectProgress(blocked), {});
    recordUnitComplete("math", "fair-share", blocked);
    assert.equal(hasSubjectProgress("math", blocked), false);
  });
});

describe("subject-progress wiring (source pins)", () => {
  const subjectCase = read("./SubjectCase.tsx");
  const picker = read("./SubjectPicker.tsx");

  it("SubjectCase records the unit on a correct pick in the main phase only", () => {
    assert.ok(
      subjectCase.includes('import { recordUnitComplete } from "./subject-progress";'),
      "the case records through the store's own API",
    );
    assert.ok(
      subjectCase.includes('if (phase === "main") recordUnitComplete(subjectId, item.id);'),
      "the record sits on the main-phase correct-pick beat, keyed by the subject prefix and the item id",
    );
  });

  it("a correct main-phase pick records under subjectId, the registry id each subject passes", () => {
    // The save key is the required subjectId config field, never a
    // test id: renaming a data-testid must not be able to orphan a
    // player's saved progress (Unit B, PR 533).
    assert.ok(subjectCase.includes("subjectId: string;"), "subjectId is a required SubjectCase config field");
    assert.ok(
      subjectCase.includes('if (phase === "main") recordUnitComplete(subjectId, item.id);'),
      "the main-phase record is keyed by subjectId",
    );
    assert.ok(!subjectCase.includes("testIdPrefix"), "no test-id prop survives in SubjectCase");
    assert.ok(
      subjectCase.includes("data-testid={`${subjectId}-case`}"),
      "the rendered test ids derive from subjectId, so they stay byte-identical",
    );
    // Every subject wrapper binds subjectId to its registry id —
    // the same strings the store already holds for players.
    const callers: Array<[string, string]> = [
      ["../chemistry/ChemistryCase.tsx", "chemistry"],
      ["../general-knowledge/GeneralKnowledgeCase.tsx", "general-knowledge"],
      ["../journals/JournalsCase.tsx", "journals"],
      ["../math/MathCase.tsx", "math"],
      ["../physics/PhysicsCase.tsx", "physics"],
      ["../social-studies/SocialStudiesCase.tsx", "social-studies"],
    ];
    for (const [rel, id] of callers) {
      const src = read(rel);
      assert.ok(src.includes(`subjectId="${id}"`), `${rel} passes subjectId="${id}"`);
      assert.ok(!src.includes("testIdPrefix"), `${rel} no longer passes a test-id prefix`);
    }
  });

  it("the picker renders one Reset per card, a sibling of the open button, disabled with no progress", () => {
    assert.ok(picker.includes("data-testid={`subject-reset-${row.id}`}"), "one Reset testid per card row");
    assert.ok(picker.includes("aria-label={`Reset ${row.title}`}"), "the Reset names its subject");
    assert.ok(picker.includes("disabled={!hasProgress}"), "disabled while the subject has nothing recorded");
    assert.ok(
      picker.includes('className="absolute right-3 bottom-3 z-10"'),
      "the approved card-corner placement",
    );
    assert.ok(
      picker.includes('size="pill"'),
      "the Reset renders through the shared Button's pill size (its look lives in button.tsx)",
    );
    assert.ok(picker.includes("clearSubjectProgress(row.id)"), "a tap clears only that subject");
    assert.ok(picker.includes("setResetNotice(`${row.title} reset`)"), "the outcome is announced");
    assert.equal(
      picker.split("<AgeBandControl runInProgress={bandChangeRunInProgress} />").length - 1,
      1,
      "exactly one band control render stays on the page",
    );
  });
});
