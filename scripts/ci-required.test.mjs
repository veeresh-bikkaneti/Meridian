import assert from "node:assert/strict";
import test from "node:test";
import { renderTable, summarize } from "./ci-required.mjs";

const pass = (name) => ({ name, status: "PASS" });

test("all gates pass -> exit 0 and every row renders PASS", () => {
  const results = [pass("tsc"), pass("npm test")];
  assert.equal(summarize(results), 0);
  const table = renderTable(results);
  assert.match(table, /\| tsc \| PASS \|/);
  assert.match(table, /\| npm test \| PASS \|/);
});

test("one failing gate -> exit 1 and a FAIL row", () => {
  const results = [pass("tsc"), { name: "lint:nav", status: "FAIL", exitCode: 2 }];
  assert.equal(summarize(results), 1);
  assert.match(renderTable(results), /\| lint:nav \| FAIL \| exit code 2 \|/);
});

test("a NOT RUN row renders its reason and does not fail the run", () => {
  const results = [
    pass("tsc"),
    { name: "check:provenance", status: "NOT RUN", reason: "not a git repository" },
  ];
  assert.equal(summarize(results), 0);
  assert.match(
    renderTable(results),
    /\| check:provenance \| NOT RUN \| not a git repository \|/,
  );
});

test("a report-only FAIL renders as FAIL but the exit code stays 0", () => {
  const results = [
    pass("tsc"),
    { name: "lint", status: "FAIL", exitCode: 1, reportOnly: true },
  ];
  assert.equal(summarize(results), 0);
  const table = renderTable(results);
  assert.match(table, /\| lint \| FAIL \|/);
  assert.match(table, /report-only/);
});
