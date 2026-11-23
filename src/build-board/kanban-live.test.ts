import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGithubBranches, parseGithubPulls } from "./kanban-live.ts";

describe("parseGithubPulls", () => {
  it("maps the slice applyOverlay reads, keyed by PR number", () => {
    const pulls = parseGithubPulls([
      {
        number: 571,
        state: "open",
        draft: true,
        merged_at: null,
        head: { ref: "phase1/ports-part-b" },
      },
      {
        number: 565,
        state: "closed",
        draft: false,
        merged_at: "2026-11-21T17:42:00Z",
        head: { ref: "phase1/transport" },
      },
      {
        number: 573,
        state: "closed",
        draft: false,
        merged_at: null,
        head: { ref: "fix/closed-unmerged" },
      },
    ]);
    assert.deepEqual(pulls.get(571), { state: "open", draft: true, merged: false });
    assert.deepEqual(pulls.get(565), { state: "closed", draft: false, merged: true });
    assert.deepEqual(pulls.get(573), { state: "closed", draft: false, merged: false });
  });

  it("skips malformed entries and survives a non-array payload", () => {
    const pulls = parseGithubPulls([
      null,
      "nope",
      { state: "open" },
      { number: "571", state: "open" },
      { number: 12, state: "weird" },
      { number: 42, state: "open" },
    ]);
    assert.equal(pulls.size, 1);
    // A missing draft flag reads as not-a-draft, never as a crash.
    assert.deepEqual(pulls.get(42), { state: "open", draft: false, merged: false });
    assert.equal(parseGithubPulls({ message: "rate limited" }).size, 0);
    assert.equal(parseGithubPulls(undefined).size, 0);
  });
});

describe("parseGithubBranches", () => {
  it("collects branch names into a set", () => {
    const branches = parseGithubBranches([
      { name: "main" },
      { name: "phase1/ports-part-b" },
      { name: "main" },
    ]);
    assert.deepEqual([...branches].sort(), ["main", "phase1/ports-part-b"]);
  });

  it("skips malformed entries and survives a non-array payload", () => {
    const branches = parseGithubBranches([null, {}, { name: 7 }, { name: "" }, { name: "ok" }]);
    assert.deepEqual([...branches], ["ok"]);
    assert.equal(parseGithubBranches("nope").size, 0);
  });
});
