import test from "node:test";
import assert from "node:assert/strict";
import {
  createGlobeTierSplitResolver,
  resolveGlobeTierSplit,
} from "./globe-tier-split.ts";
import { isEnabled, loadFlags, resetFlags, type FlagName } from "./flags.ts";

const noopLoad = async () => {};

test("fake deps: read returns false -> resolves false", async () => {
  const resolve = createGlobeTierSplitResolver({ load: noopLoad, read: () => false });
  assert.equal(await resolve(), false);
});

test("fake deps: read returns true -> resolves true", async () => {
  const resolve = createGlobeTierSplitResolver({ load: noopLoad, read: () => true });
  assert.equal(await resolve(), true);
});

test("cache: sequential calls load once; concurrent first callers agree", async () => {
  let loadsA = 0;
  const a = createGlobeTierSplitResolver({
    load: async () => {
      loadsA++;
    },
    read: () => true,
  });
  const sequential: boolean[] = [];
  for (let i = 0; i < 3; i++) sequential.push(await a());
  assert.equal(loadsA, 1);
  const concurrentAfter = await Promise.all([a(), a(), a()]);
  assert.equal(loadsA, 1);
  assert.deepEqual([...sequential, ...concurrentAfter], [true, true, true, true, true, true]);

  let loadsB = 0;
  const b = createGlobeTierSplitResolver({
    load: async () => {
      loadsB++;
    },
    read: () => true,
  });
  const concurrent = await Promise.all([b(), b(), b()]);
  assert.deepEqual(concurrent, [true, true, true]);
  assert.ok(loadsB >= 1 && loadsB <= 3, `load count ${loadsB} out of range`);
});

test("flag flips after first resolution: the first decision is kept (true then false -> true)", async () => {
  let reads = 0;
  const values = [true, false];
  const resolve = createGlobeTierSplitResolver({
    load: noopLoad,
    read: () => values[reads++] ?? false,
  });
  assert.equal(await resolve(), true);
  assert.equal(await resolve(), true, "second call must not see the flip");
  assert.equal(reads, 1, "the flag is read exactly once");
});

test("flag flips after first resolution: the mirror (false then true -> false)", async () => {
  let reads = 0;
  const values = [false, true];
  const resolve = createGlobeTierSplitResolver({
    load: noopLoad,
    read: () => values[reads++] ?? true,
  });
  assert.equal(await resolve(), false);
  assert.equal(await resolve(), false, "second call must not see the flip");
  assert.equal(reads, 1);
});

test("load rejects -> still resolves (never rejects) with the read value", async () => {
  const resolve = createGlobeTierSplitResolver({
    load: async () => {
      throw new Error("boom");
    },
    read: () => false,
  });
  assert.equal(await resolve(), false);
});

test("read throws -> resolves false", async () => {
  const resolve = createGlobeTierSplitResolver({
    load: noopLoad,
    read: (_flag: FlagName) => {
      throw new Error("corrupt");
    },
  });
  assert.equal(await resolve(), false);
});

function okFlags(payload: unknown) {
  return async () => ({ ok: true, json: async () => payload }) as unknown as Response;
}

for (const [label, payload, expected] of [
  ["payload sets globeTierSplit true -> true", { flags: { globeTierSplit: true } }, true],
  ["payload without the flag -> false", { flags: {} }, false],
  ["non-boolean \"yes\" -> false", { flags: { globeTierSplit: "yes" } }, false],
] as const) {
  test(`integration with the real flags module: ${label}`, async () => {
    resetFlags();
    const fake = okFlags(payload);
    const resolve = createGlobeTierSplitResolver({
      load: () => loadFlags({ BASE_URL: "/Meridian/", fetch: fake }),
      read: isEnabled,
    });
    assert.equal(await resolve(), expected);
  });
}

test("integration with the real flags module: rejecting fetch -> false", async () => {
  resetFlags();
  const resolve = createGlobeTierSplitResolver({
    load: () =>
      loadFlags({
        BASE_URL: "/Meridian/",
        fetch: async () => {
          throw new Error("offline");
        },
      }),
    read: isEnabled,
  });
  assert.equal(await resolve(), false);
});

// Keep this LAST: the production singleton caches its decision for the file.
test("production singleton under node (no window): resolves false", async () => {
  resetFlags();
  assert.equal(await resolveGlobeTierSplit(), false);
});
