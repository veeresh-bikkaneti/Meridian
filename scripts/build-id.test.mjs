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

test("resolveBuildId ignores a short GITHUB_SHA", () => {
  const id = resolveBuildId({ GITHUB_SHA: "abc" });
  assert.ok(id !== "abc" && id.length > 0);
});
