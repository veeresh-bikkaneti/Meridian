import assert from "node:assert/strict";
import { describe, it } from "node:test";
import branchesFixture from "./__fixtures__/github/branches.json" with { type: "json" };
import pullsFixture from "./__fixtures__/github/pulls-by-number.json" with { type: "json" };
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  applyOverlay,
  COLUMNS,
  columnRank,
  freeToClaim,
  laneCounts,
  loadSnapshot,
  storyRollup,
  type Column,
  type PullInfo,
  type Snapshot,
  type Subtask,
} from "./kanban-data.ts";
import { parseGithubBranches, parseGithubPull } from "./kanban-live.ts";

/* The recorded GitHub state (fixtures/github, recorded 2026-11-23)
 * parsed into the slices the overlay reads. */
function fixturePulls(): Map<number, PullInfo> {
  const out = new Map<number, PullInfo>();
  for (const raw of Object.values(pullsFixture.pulls)) {
    const parsed = parseGithubPull(raw);
    assert.ok(parsed, "every recorded pull parses");
    out.set(parsed.number, parsed.info);
  }
  return out;
}

function fixtureBranches(): Set<string> {
  return parseGithubBranches(branchesFixture.branches);
}

function snapshot(): Snapshot {
  return loadSnapshot(snapshotJson);
}

function subtaskByV1Id(snap: Snapshot, v1Id: string): Subtask {
  const found = snap.subtasks.find((s) => s.v1.id === v1Id);
  assert.ok(found, `a subtask with v1.id ${v1Id} exists`);
  return found;
}

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: "story.task",
    story: "story",
    lane: "architecture",
    title: "Task",
    col: "Backlog",
    phase: null,
    prompt: null,
    owner: "unassigned",
    owns: [],
    ownsStatus: "known",
    ownsNote: null,
    dependsOn: [],
    blockedBy: null,
    gate: null,
    prs: [],
    issues: [],
    branches: [],
    evidence: "",
    v1: { index: 0, id: "task", title: "Task", dep: "" },
    ...overrides,
  };
}

function pullsOf(...entries: [number, Partial<PullInfo>][]): Map<number, PullInfo> {
  return new Map(
    entries.map(([number, info]) => [
      number,
      { state: "open", draft: false, merged: false, ...info } as PullInfo,
    ]),
  );
}

describe("loadSnapshot (schema v2)", () => {
  it("loads the seeded kanban.json: 18 stories, 45 subtasks", () => {
    const snap = snapshot();
    assert.equal(snap.stories.length, 18);
    assert.equal(snap.subtasks.length, 45);
    assert.equal(new Set(snap.subtasks.map((s) => s.id)).size, 45);
    assert.deepEqual(
      {
        noRawIo: snap.gaugeInfo.noRawIo.now,
        noUpwardImport: snap.gaugeInfo.noUpwardImport.now,
        shellBan: snap.gaugeInfo.shellBan.now,
      },
      { noRawIo: 45, noUpwardImport: 129, shellBan: 14 },
    );
    assert.equal(snap.gaugeInfo.noRawIo.start, 178);
    assert.equal(snap.gaugeInfo.noUpwardImport.start, 154);
    assert.equal(snap.gaugeInfo.shellBan.start, 15);
  });

  it("throws on the wrong story or subtask count", () => {
    const fewerStories = structuredClone(snapshotJson);
    fewerStories.stories = fewerStories.stories.slice(1);
    assert.throws(() => loadSnapshot(fewerStories));
    const fewerTasks = structuredClone(snapshotJson);
    fewerTasks.subtasks = fewerTasks.subtasks.slice(1);
    assert.throws(() => loadSnapshot(fewerTasks));
  });

  it("throws on duplicate subtask ids", () => {
    const dup = structuredClone(snapshotJson);
    dup.subtasks[1].id = dup.subtasks[0].id;
    assert.throws(() => loadSnapshot(dup));
  });

  it("throws when a subtask sits in two stories, or in none", () => {
    const twice = structuredClone(snapshotJson);
    twice.stories[1].subtasks.push(twice.stories[0].subtasks[0]);
    assert.throws(() => loadSnapshot(twice));
    const orphan = structuredClone(snapshotJson);
    orphan.stories[0].subtasks = orphan.stories[0].subtasks.slice(1);
    assert.throws(() => loadSnapshot(orphan));
  });

  it("throws when a dependsOn id does not exist", () => {
    const bad = structuredClone(snapshotJson);
    bad.subtasks[0].dependsOn = ["no.such.task"];
    assert.throws(() => loadSnapshot(bad));
  });
});

describe("columnRank", () => {
  it("ranks Backlog = Blocked < In progress < In review < Done", () => {
    assert.equal(columnRank("Backlog"), 0);
    assert.equal(columnRank("Blocked"), 0);
    assert.equal(columnRank("In progress"), 1);
    assert.equal(columnRank("In review"), 2);
    assert.equal(columnRank("Done"), 3);
  });
});

describe("applyOverlay on the recorded fixtures", () => {
  it("reproduces the snapshot's lane x column counts exactly (Done is 11, not 18)", () => {
    const snap = snapshot();
    const out = applyOverlay(snap.subtasks, fixturePulls(), fixtureBranches());
    const counts: Record<string, Record<Column, number>> = {};
    for (const s of out) {
      counts[s.lane] ??= { Backlog: 0, Blocked: 0, "In progress": 0, "In review": 0, Done: 0 };
      counts[s.lane][s.col] += 1;
    }
    assert.deepEqual(counts["architecture"], {
      Backlog: 3, Blocked: 8, "In progress": 0, "In review": 1, Done: 11,
    });
    assert.deepEqual(counts["tech-debt"], {
      Backlog: 11, Blocked: 4, "In progress": 0, "In review": 0, Done: 0,
    });
    assert.deepEqual(counts["product"], {
      Backlog: 5, Blocked: 2, "In progress": 0, "In review": 0, Done: 0,
    });
    // No subtask moves at all on the recorded state.
    for (const s of out) {
      assert.equal(s.col, snap.subtasks.find((x) => x.id === s.id)?.col, s.id);
    }
  });

  it("keeps the 7 FINDINGS §1 subtasks in their snapshot columns (their PRs are ref, not closes)", () => {
    const snap = snapshot();
    const out = new Map(
      applyOverlay(snap.subtasks, fixturePulls(), fixtureBranches()).map((s) => [s.id, s]),
    );
    const cases: [string, Column][] = [
      ["573-follow-ups-move-pack-shelf-data-to-src-lib-delete-9-re-export-shims", "Blocked"],
      ["remove-unused-use-transport-ts", "Backlog"],
      ["add-storybook-react-devdependency", "Blocked"],
      ["storage-slice-prove-private-mode-on-a-real-device", "Backlog"],
      ["crash-worker-redeploy-then-run-smoke", "Blocked"],
      ["repo-weight-screenshots-in-docs-motion-verify", "Backlog"],
      ["landmark-globe-360-spin-zoom-touch-slow-loop", "Backlog"],
    ];
    for (const [v1Id, col] of cases) {
      const before = subtaskByV1Id(snap, v1Id);
      assert.equal(before.col, col, `${v1Id} snapshot column`);
      assert.equal(out.get(before.id)?.col, col, `${v1Id} keeps its column live`);
    }
  });

  it("forward only: PR 571 is an open draft, but its subtask stays In review", () => {
    const snap = snapshot();
    const task = snap.subtasks.find((s) => s.id === "arch-ports.game-app");
    assert.ok(task);
    assert.equal(task.col, "In review");
    const [out] = applyOverlay([task], fixturePulls(), fixtureBranches());
    assert.equal(out.col, "In review");
  });

  it("a closed-unmerged closes PR keeps the column and adds the note", () => {
    const task = makeSubtask({
      col: "In review",
      prs: [{ number: 571, role: "closes", href: "https://example.test/pull/571" }],
    });
    const [out] = applyOverlay(
      [task],
      pullsOf([571, { state: "closed", merged: false }]),
      new Set(),
    );
    assert.equal(out.col, "In review");
    assert.equal(out.note, "closed unmerged");
  });

  it("moves forward when the live column ranks higher", () => {
    const draft = makeSubtask({
      prs: [{ number: 10, role: "closes", href: "https://example.test/pull/10" }],
    });
    const [a] = applyOverlay([draft], pullsOf([10, { state: "open", draft: true }]), new Set());
    assert.equal(a.col, "In progress");
    const [b] = applyOverlay([draft], pullsOf([10, { state: "open", draft: false }]), new Set());
    assert.equal(b.col, "In review");
    const [c] = applyOverlay(
      [draft],
      pullsOf([10, { state: "closed", merged: true }]),
      new Set(),
    );
    assert.equal(c.col, "Done");
  });

  it("needs every closes PR merged for Done", () => {
    const task = makeSubtask({
      prs: [
        { number: 10, role: "closes", href: "https://example.test/pull/10" },
        { number: 11, role: "closes", href: "https://example.test/pull/11" },
      ],
    });
    const [out] = applyOverlay(
      [task],
      pullsOf([10, { state: "closed", merged: true }], [11, { state: "open", draft: true }]),
      new Set(),
    );
    assert.equal(out.col, "In progress");
  });

  it("never reads ref PRs or ref branches", () => {
    const task = makeSubtask({
      prs: [{ number: 10, role: "ref", href: "https://example.test/pull/10" }],
      branches: [
        { name: "mockup/parked", role: "ref", match: "exact", href: "https://example.test/x" },
      ],
    });
    const [out] = applyOverlay(
      [task],
      pullsOf([10, { state: "closed", merged: true }]),
      new Set(["mockup/parked"]),
    );
    assert.equal(out.col, "Backlog");
    assert.equal(out.note, undefined);
  });

  it("work branches: exact and prefix matches give In progress, never a step back", () => {
    const exact = makeSubtask({
      branches: [{ name: "feat/work", role: "work", match: "exact", href: null }],
    });
    const [a] = applyOverlay([exact], new Map(), new Set(["feat/work"]));
    assert.equal(a.col, "In progress");
    const prefix = makeSubtask({
      branches: [{ name: "phase2/", role: "work", match: "prefix", href: null }],
    });
    const [b] = applyOverlay([prefix], new Map(), new Set(["phase2/shell-sweep"]));
    assert.equal(b.col, "In progress");
    const reviewing = makeSubtask({
      col: "In review",
      branches: [{ name: "feat/work", role: "work", match: "exact", href: null }],
    });
    const [c] = applyOverlay([reviewing], new Map(), new Set(["feat/work"]));
    assert.equal(c.col, "In review");
  });

  it("does not mutate the input subtasks", () => {
    const task = makeSubtask({
      prs: [{ number: 10, role: "closes", href: "https://example.test/pull/10" }],
    });
    applyOverlay([task], pullsOf([10, { state: "closed", merged: true }]), new Set());
    assert.equal(task.col, "Backlog");
  });
});

describe("storyRollup", () => {
  it("matches the snapshot rollup for every story, and the lane counts", () => {
    const snap = snapshot();
    const byId = new Map(snap.subtasks.map((s) => [s.id, s]));
    const counts: Record<string, Record<Column, number>> = {};
    for (const story of snap.stories) {
      const roll = storyRollup(story, byId);
      assert.equal(roll.col, story.rollup.col, story.id);
      assert.equal(roll.done, story.rollup.done, story.id);
      assert.equal(roll.total, story.rollup.total, story.id);
      counts[story.lane] ??= { Backlog: 0, Blocked: 0, "In progress": 0, "In review": 0, Done: 0 };
      counts[story.lane][roll.col] += 1;
    }
    assert.deepEqual(counts["tech-debt"], {
      Backlog: 7, Blocked: 0, "In progress": 0, "In review": 0, Done: 0,
    });
    assert.deepEqual(counts["architecture"], {
      Backlog: 2, Blocked: 3, "In progress": 0, "In review": 1, Done: 2,
    });
    assert.deepEqual(counts["product"], {
      Backlog: 3, Blocked: 0, "In progress": 0, "In review": 0, Done: 0,
    });
  });

  it("applies the rule order on synthetic columns", () => {
    const story = { id: "s", subtasks: ["a", "b"] } as Parameters<typeof storyRollup>[0];
    const mk = (cols: Column[]) =>
      new Map(
        ["a", "b"].map((id, i) => [id, makeSubtask({ id, col: cols[i] })] as const),
      );
    assert.equal(storyRollup(story, mk(["Done", "Done"])).col, "Done");
    assert.equal(storyRollup(story, mk(["Done", "In review"])).col, "In review");
    assert.equal(storyRollup(story, mk(["Blocked", "In progress"])).col, "In progress");
    assert.equal(storyRollup(story, mk(["Blocked", "Backlog"])).col, "Backlog");
    assert.equal(storyRollup(story, mk(["Blocked", "Blocked"])).col, "Blocked");
  });
});

describe("freeToClaim", () => {
  it("returns exactly the 18 free subtasks on the snapshot", () => {
    const snap = snapshot();
    const free = freeToClaim(snap.subtasks, snap.hotFiles);
    assert.equal(free.length, 18);
    assert.deepEqual(
      free.map((s) => s.id).sort(),
      [
        "arch-pages.retire",
        "arch-ports.storyteller-home",
        "arch-shell.sweep",
        "prod-3d.globe",
        "prod-grow.adult-band",
        "prod-grow.pennant",
        "prod-live.open-issues",
        "prod-live.walk-fixes",
        "td-a11y.lose-reveal",
        "td-dead-code.cva",
        "td-dead-code.test-stubs",
        "td-dead-code.transport-hook",
        "td-forms.contact",
        "td-pipeline.repo-weight",
        "td-prod-checks.private-mode",
        "td-tests.detective-flake",
        "td-tests.known-failures",
        "td-tooling.validators-zod",
      ],
    );
    // The one Backlog subtask left out waits on unfinished dependencies.
    assert.ok(!free.some((s) => s.id === "td-pipeline.pages-failing"));
  });

  it("no two free subtasks overlap in owns once hotFiles are excluded", () => {
    const snap = snapshot();
    const free = freeToClaim(snap.subtasks, snap.hotFiles);
    const hot = new Set(snap.hotFiles);
    const overlap = (a: string, b: string) => {
      if (a === b) return true;
      const [x, y] = a.length < b.length ? [a, b] : [b, a];
      return y.startsWith(`${x.replace(/\/$/, "")}/`);
    };
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        for (const p of free[i].owns.filter((o) => !hot.has(o))) {
          for (const q of free[j].owns.filter((o) => !hot.has(o))) {
            assert.ok(!overlap(p, q), `${free[i].id} and ${free[j].id} overlap on ${p} / ${q}`);
          }
        }
      }
    }
  });

  it("excludes owns that overlap an In review subtask's owns, not just In progress", () => {
    const a = makeSubtask({ id: "s.a", owns: ["src/components/game-app.tsx"] });
    const reviewing = makeSubtask({
      id: "s.b",
      col: "In review",
      owns: ["src/components/"],
    });
    assert.deepEqual(freeToClaim([a, reviewing], []).map((s) => s.id), []);
  });

  it("ignores hotFiles on both sides of the overlap check", () => {
    const a = makeSubtask({ id: "s.a", owns: ["package.json", "src/lib/"] });
    const busy = makeSubtask({ id: "s.b", col: "In progress", owns: ["package.json"] });
    assert.deepEqual(
      freeToClaim([a, busy], ["package.json"]).map((s) => s.id),
      ["s.a"],
    );
  });

  it("does not treat a same-prefix sibling as overlap (slash boundary)", () => {
    const a = makeSubtask({ id: "s.a", owns: ["src/components2/x.ts"] });
    const busy = makeSubtask({ id: "s.b", col: "In progress", owns: ["src/components"] });
    assert.deepEqual(freeToClaim([a, busy], []).map((s) => s.id), ["s.a"]);
  });

  it("excludes a subtask whose dependency is not Done", () => {
    const dep = makeSubtask({ id: "s.dep", col: "Blocked" });
    const a = makeSubtask({ id: "s.a", dependsOn: ["s.dep"] });
    assert.deepEqual(freeToClaim([a, dep], []), []);
  });
});

describe("laneCounts", () => {
  it("totals subtasks per lane on the real seed", () => {
    assert.deepEqual(laneCounts(snapshot().subtasks), {
      "tech-debt": 15,
      architecture: 23,
      product: 7,
    });
  });
});

describe("COLUMNS", () => {
  it("is the five board columns in order", () => {
    assert.deepEqual(COLUMNS, ["Backlog", "Blocked", "In progress", "In review", "Done"]);
  });
});
