// Integrity checks for docs/knowledge/graph.json (AGENTS.md section 7).
// The graph is a token saver only if agents can trust it, so a broken link
// fails `npm test` instead of sending an agent to a file that is gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const graph = JSON.parse(readFileSync(join(root, "docs/knowledge/graph.json"), "utf8"));
const KINDS = new Set(["doc", "spec", "branch", "decision"]);
const EDGE_TYPES = new Set(["documents", "governs", "depends-on", "supersedes", "decided-by"]);

test("node ids are unique and kinds are known", () => {
  const seen = new Set();
  for (const n of graph.nodes) {
    assert.ok(!seen.has(n.id), `duplicate id ${n.id}`);
    seen.add(n.id);
    assert.ok(KINDS.has(n.kind), `${n.id}: unknown kind ${n.kind}`);
  }
});

test("every path points at a file in the repo", () => {
  for (const n of graph.nodes) {
    if (n.kind === "decision") continue;
    assert.ok(n.path, `${n.id}: missing path`);
    assert.ok(existsSync(join(root, n.path)), `${n.id}: ${n.path} does not exist`);
  }
});

test("every decision carries the owner's words and a source", () => {
  for (const n of graph.nodes.filter((x) => x.kind === "decision")) {
    assert.ok(n.quote?.trim(), `${n.id}: missing quote`);
    assert.match(n.source ?? "", /\d{4}-\d{2}-\d{2}/, `${n.id}: source needs a date`);
  }
});

test("every edge joins two known nodes with a known type", () => {
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    assert.ok(EDGE_TYPES.has(e.type), `unknown edge type ${e.type}`);
    assert.ok(ids.has(e.from), `edge from unknown node ${e.from}`);
    assert.ok(ids.has(e.to), `edge to unknown node ${e.to}`);
  }
});
