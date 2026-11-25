import assert from "node:assert/strict";
import { describe, it } from "node:test";
import branchesFixture from "./__fixtures__/github/branches.json" with { type: "json" };
import pullsFixture from "./__fixtures__/github/pulls-by-number.json" with { type: "json" };
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  applyOverlay,
  boardCensus,
  COLUMNS,
  columnForPull,
  columnRank,
  deriveBoardItems,
  extractItemKey,
  extractStoryNums,
  extractSubtaskNums,
  freeToClaim,
  isBlockedLabel,
  laneCounts,
  laneForItem,
  loadSnapshot,
  storyNumOf,
  storyRollup,
  storySeatTags,
  type Column,
  type PullInfo,
  type Snapshot,
  type Subtask,
} from "./kanban-data.ts";
import { PR_NUMBER_MAP, mappedIdsFor } from "./pr-number-map.ts";
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
    num: "SYN-0",
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

  it("throws when a story or subtask num is missing or empty", () => {
    const missingStory = structuredClone(snapshotJson);
    (missingStory.stories[0] as { num?: string }).num = undefined;
    assert.throws(() => loadSnapshot(missingStory), /num/);
    const emptySub = structuredClone(snapshotJson);
    emptySub.subtasks[0].num = "";
    assert.throws(() => loadSnapshot(emptySub), /num/);
  });

  it("throws on a duplicate num, including a story sharing a subtask's num", () => {
    const dup = structuredClone(snapshotJson);
    dup.subtasks[1].num = dup.subtasks[0].num;
    assert.throws(() => loadSnapshot(dup), /duplicate num/);
    const shared = structuredClone(snapshotJson);
    shared.stories[0].num = shared.subtasks[0].num;
    assert.throws(() => loadSnapshot(shared), /duplicate num/);
  });

  it("gives every story and subtask the assigned planning number", () => {
    const snap = snapshot();
    assert.deepEqual(
      Object.fromEntries(snap.stories.map((s) => [s.id, s.num])),
      {
        "arch-rules": "TD-01",
        "arch-ports": "TD-02",
        "arch-content": "TD-03",
        "arch-imports": "TD-04",
        "arch-shell": "TD-05",
        "arch-split": "TD-06",
        "arch-gates": "TD-07",
        "arch-pages": "TD-09",
        "td-dead-code": "TD-10",
        "td-forms": "TD-11",
        "td-tooling": "TD-12",
        "td-pipeline": "TD-13",
        "td-tests": "TD-14",
        "td-a11y": "TD-15",
        "td-prod-checks": "TD-16",
        "prod-3d": "FW-08",
        "prod-live": "FW-09",
        "prod-grow": "FW-10",
      },
    );
    assert.deepEqual(
      Object.fromEntries(snap.subtasks.map((s) => [s.id, s.num])),
      {
        "arch-rules.amend": "TD-01.1",
        "arch-rules.guardrails": "TD-01.2",
        "arch-ports.audio": "TD-02.1",
        "arch-ports.storage": "TD-02.2",
        "arch-ports.transport": "TD-02.3",
        "arch-ports.sweep-a": "TD-02.4",
        "arch-ports.game-app": "TD-02.5",
        "arch-ports.storyteller-home": "TD-02.6",
        "arch-ports.last-ten": "TD-02.7",
        "arch-content.records": "TD-03.1",
        "arch-imports.batch-a": "TD-04.1",
        "arch-imports.rulings": "TD-04.2",
        "arch-imports.subject-contracts": "TD-04.3",
        "arch-shell.nav-tests": "TD-05.1",
        "arch-shell.sweep": "TD-05.2",
        "arch-split.map": "TD-06.1",
        "arch-split.size-budget": "TD-06.2",
        "arch-split.modules": "TD-06.3",
        "arch-split.router": "TD-06.4",
        "arch-gates.contracts": "TD-07.1",
        "arch-gates.flip": "TD-07.2",
        "arch-pages.retire": "TD-09.1",
        "arch-pages.links": "TD-09.2",
        "td-dead-code.pack-shelf-move": "TD-10.1",
        "td-dead-code.cva": "TD-10.2",
        "td-dead-code.transport-hook": "TD-10.3",
        "td-dead-code.test-stubs": "TD-10.4",
        "td-forms.contact": "TD-11.1",
        "td-forms.board": "TD-11.2",
        "td-tooling.storybook-types": "TD-12.1",
        "td-tooling.validators-zod": "TD-12.2",
        "td-pipeline.repo-weight": "TD-13.1",
        "td-pipeline.pages-failing": "TD-13.2",
        "td-tests.detective-flake": "TD-14.1",
        "td-tests.known-failures": "TD-14.2",
        "td-a11y.lose-reveal": "TD-15.1",
        "td-prod-checks.private-mode": "TD-16.1",
        "td-prod-checks.crash-redeploy": "TD-16.2",
        "prod-3d.globe": "FW-08.1",
        "prod-3d.clue-films": "FW-08.2",
        "prod-live.walk-fixes": "FW-09.1",
        "prod-live.open-issues": "FW-09.2",
        "prod-grow.pennant": "FW-10.1",
        "prod-grow.science-review": "FW-10.2",
        "prod-grow.adult-band": "FW-10.3",
      },
    );
    const nums = [...snap.stories, ...snap.subtasks].map((item) => item.num);
    assert.equal(new Set(nums).size, nums.length);
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

describe("extractSubtaskNums", () => {
  it("keeps TD-01.1 distinct from TD-01.10 and ignores a story-only id", () => {
    assert.deepEqual(extractSubtaskNums("TD-01.1"), ["TD-01.1"]);
    assert.deepEqual(extractSubtaskNums("TD-01.10"), ["TD-01.10"]);
    assert.deepEqual(extractSubtaskNums("see TD-01.1 next to TD-01.10"), ["TD-01.1", "TD-01.10"]);
    assert.deepEqual(extractSubtaskNums("TD-08"), []);
    assert.deepEqual(extractSubtaskNums("story TD-08 then TD-08.1"), ["TD-08.1"]);
    assert.deepEqual(extractSubtaskNums("xTD-01.1"), []);
    assert.deepEqual(extractSubtaskNums("td-09.1 and TD-09.1 again"), ["TD-09.1"]);
    assert.deepEqual(extractSubtaskNums("fw-08.1"), ["FW-08.1"]);
  });
});

describe("applyOverlay numbered pulls and branches", () => {
  it("matches a branch or pull title case-insensitively, and not a ref", () => {
    const task = makeSubtask({ num: "TD-09.1", col: "Backlog" });
    const [byBranch] = applyOverlay([task], new Map(), new Set(["Chore/td-09.1-Retire-pages"]));
    assert.equal(byBranch.col, "In progress");

    const [byTitle] = applyOverlay(
      [task],
      pullsOf([577, { title: "chore(td-09.1): retire pages", headRef: "chore/other" }]),
      new Set(),
    );
    assert.equal(byTitle.col, "In review");

    const refd = makeSubtask({
      num: "TD-09.1",
      prs: [{ number: 577, role: "ref", href: "https://example.test/pull/577" }],
      branches: [
        { name: "chore/td-09.1-retire-pages", role: "ref", match: "exact", href: null },
      ],
    });
    const [kept] = applyOverlay(
      [refd],
      pullsOf([
        577,
        { state: "closed", merged: true, title: "TD-09.1", headRef: "chore/td-09.1-retire-pages" },
      ]),
      new Set(["chore/td-09.1-retire-pages"]),
    );
    assert.equal(kept.col, "Backlog");
    assert.equal(kept.note, undefined);
    assert.equal(kept.prs.length, 1);
    assert.equal(kept.seatTags, undefined);
  });

  it("does not treat TD-01.10 as TD-01.1, or a story id as a subtask", () => {
    const narrow = makeSubtask({ num: "TD-01.1" });
    const [out] = applyOverlay(
      [narrow],
      pullsOf([4, { title: "fix TD-01.10 only", headRef: "chore/td-01.10-more" }]),
      new Set(["chore/td-01.10-more", "feat/td-08-story"]),
    );
    assert.equal(out.col, "Backlog");
    const [hit] = applyOverlay([narrow], new Map(), new Set(["chore/td-01.1-exact"]));
    assert.equal(hit.col, "In progress");
  });

  it("maps an auto pull: draft, ready, merged, and closed unmerged", () => {
    const task = makeSubtask({ num: "TD-10.2" });
    const draft = pullsOf([
      1,
      { state: "open", draft: true, title: "wip", headRef: "chore/td-10.2-remove-cva" },
    ]);
    assert.equal(applyOverlay([task], draft, new Set())[0].col, "In progress");
    const ready = pullsOf([
      1,
      { state: "open", draft: false, title: "TD-10.2 remove cva" },
    ]);
    assert.equal(applyOverlay([task], ready, new Set())[0].col, "In review");
    const merged = pullsOf([
      1,
      { state: "closed", merged: true, headRef: "chore/td-10.2-remove-cva" },
    ]);
    assert.equal(applyOverlay([task], merged, new Set())[0].col, "Done");
    const closed = pullsOf([
      1,
      { state: "closed", merged: false, title: "abandoned TD-10.2" },
    ]);
    const [noted] = applyOverlay([task], closed, new Set());
    assert.equal(noted.col, "Backlog");
    assert.equal(noted.note, "closed unmerged");
  });

  it("stays forward-only when the auto signal ranks lower", () => {
    const reviewing = makeSubtask({
      num: "FW-08.1",
      col: "In review",
    });
    const [out] = applyOverlay(
      [reviewing],
      pullsOf([3, { state: "open", draft: true, headRef: "feat/fw-08.1-globe" }]),
      new Set(["feat/fw-08.1-globe"]),
    );
    assert.equal(out.col, "In review");
    assert.equal(out.note, undefined);
  });

  it("appends the auto pull link without mutating the input", () => {
    const task = makeSubtask({
      num: "TD-09.1",
      prs: [{ number: 10, role: "closes", href: "https://example.test/pull/10" }],
    });
    const [out] = applyOverlay(
      [task],
      pullsOf(
        [10, { state: "open", draft: true, labels: ["C:Firefox"] }],
        [577, { state: "open", draft: false, title: "TD-09.1 retire", labels: ["C:Opera", "docs"] }],
      ),
      new Set(),
    );
    assert.equal(task.col, "Backlog");
    assert.equal(task.prs.length, 1);
    assert.equal(task.seatTags, undefined);
    assert.equal(out.col, "In review");
    assert.equal(out.prs.length, 2);
    assert.deepEqual(out.prs[1], {
      number: 577,
      role: "closes",
      href: "https://github.com/veeresh-bikkaneti/Meridian/pull/577",
    });
    assert.deepEqual(out.seatTags, ["C:Firefox", "C:Opera"]);
  });

  it("dedupes C: seat tags and ignores labels that are not a seat", () => {
    const task = makeSubtask({ num: "TD-10.3" });
    const [out] = applyOverlay(
      [task],
      pullsOf(
        [
          2,
          {
            state: "open",
            draft: true,
            headRef: "chore/td-10.3-drop-use-get-json",
            labels: ["C:Opera", "C:Edge", "area"],
          },
        ],
        [
          3,
          {
            state: "open",
            draft: false,
            title: "also TD-10.3",
            labels: ["C:Opera", "C:Bot"],
          },
        ],
      ),
      new Set(),
    );
    assert.deepEqual(out.seatTags, ["C:Opera", "C:Edge", "C:Bot"]);
    assert.equal(out.col, "In review");
  });

  it("does not match a num that appears only outside the title and head ref", () => {
    const task = makeSubtask({ num: "TD-09.1" });
    const [out] = applyOverlay(
      [task],
      pullsOf([
        8,
        { title: "unrelated cleanup", headRef: "chore/pages", labels: ["TD-09.1", "C:DuckDuck"] },
      ]),
      new Set(),
    );
    assert.equal(out.col, "Backlog");
    assert.equal(out.seatTags, undefined);
    assert.equal(out.prs.length, 0);
  });
});

describe("storySeatTags", () => {
  it("rolls distinct C: tags up in first-seen order", () => {
    assert.deepEqual(
      storySeatTags([
        { seatTags: ["C:Opera", "C:Edge"] },
        { seatTags: ["C:Opera", "C:Bot"] },
        {},
        { seatTags: ["notes", "C:DuckDuck"] },
      ]),
      ["C:Opera", "C:Edge", "C:Bot", "C:DuckDuck"],
    );
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

describe("deriveBoardItems", () => {
  const pull = (info: Partial<PullInfo>): PullInfo => ({
    state: "open",
    draft: false,
    merged: false,
    ...info,
  });

  it("reads an item key from the title, else head.ref, else the branch", () => {
    assert.equal(extractItemKey("ship TD-08.4 tonight"), "TD-08.4");
    assert.equal(extractItemKey("story TD-08 only"), "TD-08");
    assert.deepEqual(extractStoryNums("TD-08.4 only"), []);
    assert.equal(extractItemKey("feat/fw-11.1-lighthouse"), "FW-11.1");
    assert.equal(extractItemKey("no number here"), null);
  });

  it("places each pull by the first matching column rule", () => {
    assert.equal(isBlockedLabel("C:blocked"), true);
    assert.equal(isBlockedLabel("blocked"), true);
    assert.equal(isBlockedLabel("C:Opera"), false);
    assert.deepEqual(columnForPull(pull({ labels: ["C:blocked"], merged: true })), {
      col: "Blocked",
    });
    assert.deepEqual(columnForPull(pull({ state: "closed", merged: true })), { col: "Done" });
    assert.deepEqual(columnForPull(pull({ state: "open", draft: false })), { col: "In review" });
    assert.deepEqual(columnForPull(pull({ state: "open", draft: true })), { col: "In progress" });
    assert.deepEqual(columnForPull(pull({ state: "closed", merged: false })), {
      col: "Backlog",
      note: "closed unmerged",
    });
  });

  it("keeps the most advanced column when several pulls share one item", () => {
    const pulls = new Map<number, PullInfo>([
      [40, pull({ title: "draft TD-11.1", draft: true, state: "open" })],
      [41, pull({ title: "review TD-11.1", draft: false, state: "open", labels: ["C:Atlas"] })],
      [42, pull({ title: "closed TD-12.2", state: "closed", merged: false })],
      [43, pull({ title: "blocked TD-12.2", state: "closed", labels: ["C:blocked"] })],
      [44, pull({ title: "merged TD-09.1", state: "closed", merged: true })],
      [45, pull({ title: "still open TD-09.1", state: "open", draft: false })],
    ]);
    const cards = deriveBoardItems(pulls, new Set());
    const byNum = new Map(cards.map((card) => [card.num, card]));
    assert.equal(byNum.get("TD-11.1")?.col, "In review");
    assert.deepEqual(byNum.get("TD-11.1")?.prs.map((pr) => pr.number), [40, 41]);
    assert.equal(byNum.get("TD-11.1")?.title, "draft TD-11.1");
    assert.deepEqual(byNum.get("TD-11.1")?.seatTags, ["C:Atlas"]);
    assert.equal(byNum.get("TD-12.2")?.col, "Blocked");
    assert.equal(byNum.get("TD-09.1")?.col, "Done");
    assert.deepEqual(byNum.get("TD-09.1")?.prs.map((pr) => pr.number), [44, 45]);
  });

  it("keeps unnumbered pulls and branches in the Unnumbered group", () => {
    const pulls = new Map<number, PullInfo>([
      [7, pull({ title: "scratch cleanup", headRef: "wip/scratch" })],
    ]);
    const cards = deriveBoardItems(pulls, new Set(["wip/scratch", "notes/loose"]));
    const unnumbered = cards.filter((card) => card.unnumbered);
    assert.equal(unnumbered.length, 2);
    assert.ok(unnumbered.some((card) => card.title === "scratch cleanup" && card.prs[0]?.number === 7));
    assert.ok(unnumbered.some((card) => card.title === "notes/loose" && card.col === "In progress"));
    assert.equal(cards.some((card) => card.title === "wip/scratch" && card.prs.length === 0), false);
  });

  it("counts a numbered branch with no pull as In progress", () => {
    const cards = deriveBoardItems(new Map(), new Set(["chore/td-08.4-kanban-github-derived"]));
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.num, "TD-08.4");
    assert.equal(cards[0]?.col, "In progress");
    assert.equal(cards[0]?.lane, "tech-debt");
    assert.equal(cards[0]?.title, "chore/td-08.4-kanban-github-derived");
  });

  it("lanes TD as tech-debt, arch and phase as architecture, and the rest as product", () => {
    assert.equal(laneForItem("TD-04.2", ["phase1/rules"]), "tech-debt");
    assert.equal(laneForItem("FW-11.1", ["feat/fw-11.1-lighthouse"]), "product");
    assert.equal(laneForItem(null, ["arch-pages"]), "architecture");
    assert.equal(laneForItem(null, ["phase2/shell-sweep"]), "architecture");
    const cards = deriveBoardItems(
      new Map([
        [1, pull({ title: "Phase 2 shell", headRef: "phase2/shell-sweep" })],
        [2, pull({ title: "FW-99.9 not in the ledger" })],
      ]),
      new Set(),
    );
    assert.equal(cards.find((card) => card.unnumbered)?.lane, "architecture");
    assert.equal(cards.find((card) => card.num === "FW-99.9")?.lane, "product");
    assert.equal(cards.find((card) => card.num === "FW-99.9")?.col, "In review");
  });

  it("marks a closed unmerged pull and does not invent ledger rows", () => {
    const cards = deriveBoardItems(
      new Map([[9, pull({ title: "drop TD-16.1", state: "closed", merged: false })]]),
      new Set(),
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.col, "Backlog");
    assert.equal(cards[0]?.note, "closed unmerged");
    assert.equal(cards.some((card) => card.num === "TD-01.1"), false);
  });
});

describe("pr-number-map (TD-08.5 backfill)", () => {
  it("agrees with every closes link recorded in the ledger", () => {
    for (const sub of snapshot().subtasks) {
      for (const pr of sub.prs) {
        if (pr.role !== "closes") continue;
        assert.ok(
          mappedIdsFor(pr.number)?.includes(sub.num),
          `#${pr.number} closes ${sub.num} in the ledger, so the map must carry it`,
        );
      }
    }
  });

  it("never steals an id the ledger lists the PR only as ref for", () => {
    assert.deepEqual(mappedIdsFor(552), ["TD-01.2"]);
    assert.deepEqual(mappedIdsFor(563), ["TD-02.2"]);
    assert.deepEqual(mappedIdsFor(565), ["TD-02.3"]);
    assert.deepEqual(mappedIdsFor(560), ["TD-07.1"]);
    assert.equal(mappedIdsFor(545), undefined);
    assert.equal(mappedIdsFor(546), undefined);
    assert.equal(mappedIdsFor(553), undefined);
    assert.equal(mappedIdsFor(556), undefined);
    for (const row of PR_NUMBER_MAP) {
      for (const id of row.ids) {
        assert.ok(extractSubtaskNums(id).length > 0 || extractStoryNums(id).length > 0);
      }
    }
  });

  it("pins #614 to TD-10.5 even when head.ref says td-10.1", () => {
    const cards = deriveBoardItems(
      pullsOf([
        614,
        {
          title: "chore: drop the baselined shims",
          headRef: "chore/td-10.1-drop-baselined-shims",
          state: "open",
          draft: true,
        },
      ]),
      new Set(),
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.num, "TD-10.5");
    assert.equal(cards[0]?.unnumbered, false);
    assert.equal(cards.some((card) => card.num === "TD-10.1"), false);
  });

  it("keeps #612 off the TD-06.3 card #610 owns, and off TD-06.5", () => {
    const cards = deriveBoardItems(
      pullsOf(
        [610, { title: "TD-06.3 game-app size ratchet", state: "closed", merged: true }],
        [612, { title: "TD-06.3 game-app size ratchet", state: "open", draft: true }],
      ),
      new Set(),
    );
    const td063 = cards.find((card) => card.num === "TD-06.3");
    assert.deepEqual(td063?.prs.map((pr) => pr.number), [610]);
    assert.equal(cards.some((card) => card.num === "TD-06.5"), false);
    const clash = cards.find((card) => card.prs.some((pr) => pr.number === 612));
    assert.equal(clash?.unnumbered, true);
    assert.equal(clash?.num, null);
  });

  it("backfills #571 as TD-02.5 in tech-debt, not Unnumbered", () => {
    const cards = deriveBoardItems(
      pullsOf([
        571,
        {
          title: "Phase 1 Part B: game-app onto the storage port",
          headRef: "phase1/ports-part-b",
          state: "closed",
          merged: true,
        },
      ]),
      new Set(),
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.num, "TD-02.5");
    assert.equal(cards[0]?.lane, "tech-debt");
    assert.equal(cards[0]?.unnumbered, false);
    assert.equal(cards[0]?.col, "Done");
  });

  it("chips the multi-id #605 onto both TD-11.1 and TD-11.2", () => {
    const cards = deriveBoardItems(
      pullsOf([
        605,
        {
          title: "refactor(forms): post contact and board forms through the transport port",
          headRef: "feat/slice-a-forms-network-port",
          state: "closed",
          merged: true,
        },
      ]),
      new Set(),
    );
    assert.deepEqual(
      cards.map((card) => card.num).sort(),
      ["TD-11.1", "TD-11.2"],
    );
    for (const card of cards) {
      assert.deepEqual(card.prs.map((pr) => pr.number), [605]);
      assert.equal(card.col, "Done");
    }
  });

  it("keeps a genuinely unnumbered pull in the Unnumbered group", () => {
    const cards = deriveBoardItems(
      pullsOf([
        616,
        {
          title: "test(e2e): settle the boot splash before the credits-link click",
          headRef: "vibe/credits-link-dup-700c6b",
          state: "closed",
          merged: true,
        },
      ]),
      new Set(),
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.unnumbered, true);
    assert.equal(cards[0]?.num, null);
  });

  it("does not let #614 auto-attach to TD-10.1 in the snapshot overlay", () => {
    const snap = snapshot();
    const out = applyOverlay(
      snap.subtasks,
      pullsOf([
        614,
        { headRef: "chore/td-10.1-drop-baselined-shims", state: "open", draft: true },
      ]),
      new Set(),
    );
    const td101 = out.find((sub) => sub.num === "TD-10.1");
    assert.equal(td101?.prs.some((pr) => pr.number === 614), false);
  });

  it("enriches both TD-11.1 and TD-11.2 with #605 in the snapshot overlay", () => {
    const snap = snapshot();
    const out = applyOverlay(
      snap.subtasks,
      pullsOf([605, { state: "closed", merged: true }]),
      new Set(),
    );
    for (const num of ["TD-11.1", "TD-11.2"]) {
      assert.ok(out.find((sub) => sub.num === num)?.prs.some((pr) => pr.number === 605));
    }
  });
});

describe("boardCensus (TD-08.5 live counts)", () => {
  it("splits a subtask id into its story id", () => {
    assert.equal(storyNumOf("TD-01.1"), "TD-01");
    assert.equal(storyNumOf("FW-10.3"), "FW-10");
    assert.equal(storyNumOf("TD-08"), null);
  });

  it("counts the ledger plus the map, with no live window at all", () => {
    const census = boardCensus(snapshot(), []);
    // Ledger: 18 stories, 45 tasks. The map adds TD-08.1 and
    // TD-10.5 as tasks and TD-08 as a story — ids the stale
    // ledger does not hold.
    assert.deepEqual(census.all, { stories: 19, tasks: 47, unnumbered: 0 });
    assert.equal(census["tech-debt"].stories, 8);
    assert.equal(census["tech-debt"].tasks, 17);
    assert.equal(census.architecture.tasks, 23);
    assert.equal(census.product.stories, 3);
    assert.notEqual(census.all.stories, census.all.tasks);
  });

  it("is not the window length: a 3-pull window still yields the full census", () => {
    const items = deriveBoardItems(
      pullsOf(
        [571, { state: "closed", merged: true, headRef: "phase1/ports-part-b" }],
        [616, { title: "credits-link fix", headRef: "vibe/credits-link-dup-700c6b" }],
        [9001, { title: "feat: FW-99.9 not in the ledger" }],
      ),
      new Set(),
    );
    const census = boardCensus(snapshot(), items);
    assert.ok(census.all.stories > items.length);
    assert.ok(census.all.tasks > items.length);
    // TD-01.1 is counted even though #543 is absent from the window.
    assert.equal(census.all.tasks, 48);
    assert.equal(census.all.stories, 20);
    assert.equal(census.all.unnumbered, 1);
  });

  it("counts a live id the ledger lacks, such as TD-06.5", () => {
    const items = deriveBoardItems(
      pullsOf([9002, { title: "TD-06.5 entry chunk guard", state: "open", draft: true }]),
      new Set(),
    );
    const census = boardCensus(snapshot(), items);
    assert.equal(census.all.tasks, 48);
    assert.equal(census.all.stories, 19);
  });
});
