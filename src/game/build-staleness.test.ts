import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CURRENT_BUILD_ID, isNewBuildDeployed } from "./build-staleness.ts";

function fakeFetch(buildId: unknown, ok = true) {
  return (async () => ({
    ok,
    json: async () => ({ buildId }),
  })) as unknown as typeof fetch;
}

test("CURRENT_BUILD_ID falls back to dev outside a Vite build", () => {
  assert.equal(CURRENT_BUILD_ID, "dev");
});

test("isNewBuildDeployed: true when the server names a different build", async () => {
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch("abc123") }), true);
});

test("isNewBuildDeployed: false when the server names this build", async () => {
  assert.equal(
    await isNewBuildDeployed({ fetchFn: fakeFetch(CURRENT_BUILD_ID) }),
    false,
  );
});

test("isNewBuildDeployed: false when the meta fetch fails", async () => {
  const failing = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assert.equal(await isNewBuildDeployed({ fetchFn: failing }), false);
});

test("isNewBuildDeployed: false on non-OK response or missing buildId", async () => {
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch("abc123", false) }), false);
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch(undefined) }), false);
  assert.equal(await isNewBuildDeployed({ fetchFn: fakeFetch(42) }), false);
});
