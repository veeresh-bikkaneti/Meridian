import assert from "node:assert/strict";
import { describe, it } from "node:test";
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  applyOverlay,
  COLUMNS,
  freeToClaim,
  laneCounts,
  loadSnapshot,
  type Card,
  type PullInfo,
} from "./kanban-data.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-a",
    title: "Card A",
    lane: "architecture",
    owner: "Architecture",
    prompt: null,
    col: "Backlog",
    pr: null,
    branch: null,
    owns: [],
    dependsOn: [],
    blockedBy: null,
    depText: "",
    evidence: "",
    links: [],
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

describe("applyOverlay", () => {
  it("moves a merged PR's card to Done", () => {
    const [out] = applyOverlay(
      [makeCard({ pr: 10 })],
      pullsOf([10, { state: "closed", merged: true }]),
      new Set(),
    );
    assert.equal(out.col, "Done");
  });

  it("sends a closed unmerged PR's card back to Backlog with a note", () => {
    const [out] = applyOverlay(
      [makeCard({ pr: 10, col: "In review" })],
      pullsOf([10, { state: "closed", merged: false }]),
      new Set(),
    );
    assert.equal(out.col, "Backlog");
    assert.equal(out.note, "PR closed unmerged");
  });

  it("puts an open ready PR's card In review", () => {
    const [out] = applyOverlay(
      [makeCard({ pr: 10 })],
      pullsOf([10, { state: "open", draft: false }]),
      new Set(),
    );
    assert.equal(out.col, "In review");
  });

  it("puts an open draft PR's card In progress (the PR 571 shape)", () => {
    const [out] = applyOverlay(
      [makeCard({ pr: 571, branch: "phase1/ports-part-b", col: "In review" })],
      pullsOf([571, { state: "open", draft: true }]),
      new Set(["phase1/ports-part-b"]),
    );
    assert.equal(out.col, "In progress");
  });

  it("puts a PR-less card In progress when its branch exists", () => {
    const [out] = applyOverlay(
      [makeCard({ branch: "feat/example" })],
      new Map(),
      new Set(["feat/example"]),
    );
    assert.equal(out.col, "In progress");
  });

  it("leaves a card unchanged when neither PR nor branch resolves", () => {
    const card = makeCard({ branch: "feat/missing", col: "Blocked" });
    const [out] = applyOverlay([card], new Map(), new Set());
    assert.equal(out.col, "Blocked");
    assert.equal(out.note, undefined);
  });

  it("PR state takes precedence over branch existence (merged beats live branch)", () => {
    const [out] = applyOverlay(
      [makeCard({ pr: 10, branch: "feat/still-there" })],
      pullsOf([10, { state: "closed", merged: true }]),
      new Set(["feat/still-there"]),
    );
    assert.equal(out.col, "Done");
  });

  it("does not mutate the input cards", () => {
    const card = makeCard({ pr: 10 });
    applyOverlay([card], pullsOf([10, { state: "closed", merged: true }]), new Set());
    assert.equal(card.col, "Backlog");
  });
});

describe("freeToClaim", () => {
  it("returns Backlog cards with no deps and no owns overlap", () => {
    const free = makeCard({ id: "free", owns: ["src/lib"] });
    const busy = makeCard({ id: "busy", col: "In progress", owns: ["src/board"] });
    assert.deepEqual(freeToClaim([free, busy]).map((c) => c.id), ["free"]);
  });

  it("excludes a card whose owns equal an In progress card's owns", () => {
    const a = makeCard({ id: "a", owns: ["src/components"] });
    const busy = makeCard({ id: "busy", col: "In progress", owns: ["src/components"] });
    assert.deepEqual(freeToClaim([a, busy]), []);
  });

  it("excludes a card whose owns sit under an In progress card's directory", () => {
    const a = makeCard({ id: "a", owns: ["src/components/game-app.tsx"] });
    const busy = makeCard({ id: "busy", col: "In progress", owns: ["src/components"] });
    assert.deepEqual(freeToClaim([a, busy]), []);
  });

  it("excludes a card whose owns directory contains an In progress path", () => {
    const a = makeCard({ id: "a", owns: ["src/components"] });
    const busy = makeCard({
      id: "busy",
      col: "In progress",
      owns: ["src/components/game-app.tsx"],
    });
    assert.deepEqual(freeToClaim([a, busy]), []);
  });

  it("does not treat a same-prefix sibling as overlap (slash boundary)", () => {
    const a = makeCard({ id: "a", owns: ["src/components2/x.ts"] });
    const busy = makeCard({ id: "busy", col: "In progress", owns: ["src/components"] });
    assert.deepEqual(freeToClaim([a, busy]).map((c) => c.id), ["a"]);
  });

  it("excludes a card whose dependency is not Done", () => {
    const dep = makeCard({ id: "dep", col: "In progress" });
    const a = makeCard({ id: "a", dependsOn: ["dep"] });
    assert.deepEqual(freeToClaim([a, dep]), []);
  });

  it("includes a card whose dependencies are all Done", () => {
    const dep = makeCard({ id: "dep", col: "Done" });
    const a = makeCard({ id: "a", dependsOn: ["dep"] });
    assert.deepEqual(freeToClaim([a, dep]).map((c) => c.id), ["a"]);
  });

  it("excludes non-Backlog cards even when free", () => {
    const a = makeCard({ id: "a", col: "Blocked" });
    assert.deepEqual(freeToClaim([a]), []);
  });
});

describe("laneCounts", () => {
  it("totals cards per lane, with every lane present", () => {
    const counts = laneCounts([
      makeCard({ lane: "architecture" }),
      makeCard({ id: "b", lane: "architecture" }),
      makeCard({ id: "c", lane: "product" }),
    ]);
    assert.deepEqual(counts, { "tech-debt": 0, architecture: 2, product: 1 });
  });
});

describe("COLUMNS", () => {
  it("is the five board columns in order", () => {
    assert.deepEqual(COLUMNS, ["Backlog", "Blocked", "In progress", "In review", "Done"]);
  });
});

describe("loadSnapshot + the real seed", () => {
  it("loads the seeded kanban.json: 45 cards, unique ids", () => {
    const snapshot = loadSnapshot(snapshotJson);
    assert.equal(snapshot.cards.length, 45);
    assert.equal(new Set(snapshot.cards.map((c) => c.id)).size, 45);
    assert.deepEqual(snapshot.gauges, { noRawIo: 45, noUpwardImport: 129, shellBan: 15 });
  });

  it("the PR 571 card carries pr 571 and its branch", () => {
    const snapshot = loadSnapshot(snapshotJson);
    const card = snapshot.cards.find((c) => c.pr === 571);
    assert.ok(card, "a card with pr 571 exists");
    assert.equal(card.branch, "phase1/ports-part-b");
    assert.equal(card.prompt, "01");
  });

  it("throws on the wrong card count", () => {
    assert.throws(() => loadSnapshot({ ...snapshotJson, cards: snapshotJson.cards.slice(1) }));
  });

  it("throws on duplicate ids", () => {
    const cards = snapshotJson.cards.map((c, i) =>
      i === 1 ? { ...c, id: snapshotJson.cards[0].id } : c,
    );
    assert.throws(() => loadSnapshot({ ...snapshotJson, cards }));
  });
});
