import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveBuildId } from "./build-id.mjs";

test("resolveBuildId prefers a 12-char GITHUB_SHA slice", () => {
  assert.equal(
    resolveBuildId({ GITHUB_SHA: "a381114c9d2e4f5a6b7c8d9e0f" }),
    "a381114c9d2e",
  );
});

test("resolveBuildId falls back to git or a timestamp", () => {
  const id = resolveBuildId({});
  assert.ok(typeof id === "string" && id.length > 0);
});

test("resolveBuildId's git fallback is the same 12 chars as the CI path", () => {
  // QA/UI-UX council, 2026-11-16: `git rev-parse --short` yielded a
  // 7-char stamp on the Workers build vs 12 chars on Pages. In a git
  // checkout the fallback must now be 12 chars; outside one (tarball)
  // the timestamp form is accepted as-is.
  const id = resolveBuildId({});
  if (!id.startsWith("local-")) assert.equal(id.length, 12);
});

test("resolveBuildId ignores a short GITHUB_SHA", () => {
  const id = resolveBuildId({ GITHUB_SHA: "abc" });
  assert.ok(id !== "abc" && id.length > 0);
});
