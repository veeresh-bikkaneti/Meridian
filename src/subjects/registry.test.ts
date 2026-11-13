/**
 * I1 subject registry — released modules only, discovered by folder.
 *
 * selectReleased is the pure filter. listReleasedSubjects is the Vite
 * discovery seam (import.meta.glob inside a function, flag-registry
 * pattern). This file never calls listReleasedSubjects: plain Node has
 * no import.meta.glob, and calling it would throw.
 */
import { readFileSync } from "node:fs";
import { it } from "node:test";
import assert from "node:assert/strict";
import { selectReleased } from "./registry.ts";

type Loader = () => Promise<{ default?: unknown }>;

function subject(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const load = () => Promise.resolve({ default: () => null });
  return {
    id,
    title: "Number",
    groups: ["7-10", "10-18", "18+"],
    released: true,
    units: [],
    load,
    ...overrides,
  };
}

function loaders(entries: Record<string, unknown>): Record<string, Loader> {
  const out: Record<string, Loader> = {};
  for (const [path, value] of Object.entries(entries)) {
    out[path] = () => Promise.resolve({ default: value });
  }
  return out;
}

const SIBLING = "./fair-shares/index.ts";

it("keeps a released subject", async () => {
  const load = () => Promise.resolve({ default: () => null });
  const card = subject("math-number", {
    title: " ",
    groups: ["18+", "7-10"],
    units: [],
    load,
  });
  const empty = await selectReleased({});
  assert.deepEqual(empty, []);
  const listed = await selectReleased(loaders({ "./math-number/index.ts": card }));
  assert.equal(listed.length, 1);
  assert.equal(listed[0], card);
  assert.deepEqual(listed[0]?.groups, ["18+", "7-10"]);
});

it("drops an unreleased subject", async () => {
  const kept = subject("fair-shares");
  const cases: unknown[] = [
    subject("math-number", { released: false }),
    subject("math-number", { released: undefined }),
    subject("math-number", { released: "true" }),
    subject("math-number", { released: 1 }),
  ];
  for (const dropped of cases) {
    const listed = await selectReleased(
      loaders({
        "./math-number/index.ts": dropped,
        [SIBLING]: kept,
      }),
    );
    assert.deepEqual(
      listed.map((s) => s.id),
      ["fair-shares"],
    );
  }
});

it("skips a loader that throws and still resolves", async () => {
  const kept = subject("fair-shares");
  const listed = await selectReleased({
    "./broken-lab/index.ts": () => {
      throw new Error("boom");
    },
    "./also-broken/index.ts": () => Promise.reject(new Error("nope")),
    [SIBLING]: () => Promise.resolve({ default: kept }),
  });
  assert.deepEqual(
    listed.map((s) => s.id),
    ["fair-shares"],
  );
});

it("skips a malformed default and still resolves", async () => {
  const kept = subject("fair-shares");
  const bad: unknown[] = [undefined, null, "card", 3, ["math-number"]];
  for (const value of bad) {
    const listed = await selectReleased(
      loaders({
        "./not-a-card/index.ts": value,
        [SIBLING]: kept,
      }),
    );
    assert.deepEqual(
      listed.map((s) => s.id),
      ["fair-shares"],
    );
  }
});

it("drops a subject whose id does not match its folder", async () => {
  const kept = subject("fair-shares");
  const badKeys: Record<string, unknown> = {
    "./math-number/index.ts": subject("math"),
    "./math-number/index.ts#id-type": subject("math-number", { id: 1 }),
    "./math-number/nested/index.ts": subject("math-number"),
    "math-number/index.ts": subject("math-number"),
    "./math-number/index.tsx": subject("math-number"),
    "./math-number/Index.ts": subject("Index"),
    "./Math-number/index.ts": subject("math-number"),
  };
  // The id-type case shares a path with the mismatch case; run it alone.
  const idType = subject("math-number", { id: 1 });
  const listedType = await selectReleased(
    loaders({
      "./math-number/index.ts": idType,
      [SIBLING]: kept,
    }),
  );
  assert.deepEqual(
    listedType.map((s) => s.id),
    ["fair-shares"],
  );
  for (const [path, value] of Object.entries(badKeys)) {
    if (path.includes("#")) continue;
    const listed = await selectReleased(loaders({ [path]: value, [SIBLING]: kept }));
    assert.deepEqual(
      listed.map((s) => s.id),
      ["fair-shares"],
      path,
    );
  }
});

it("drops a subject with invalid groups, title, or units", async () => {
  const kept = subject("fair-shares");
  const bad: unknown[] = [
    subject("math-number", { groups: [] }),
    subject("math-number", { groups: "7-10" }),
    subject("math-number", { groups: ["7-10", "5-7"] }),
    subject("math-number", { title: "" }),
    subject("math-number", { title: 4 }),
    subject("math-number", { units: undefined }),
    subject("math-number", { units: null }),
    subject("math-number", { units: "none" }),
    subject("math-number", { load: undefined }),
    subject("math-number", { load: "open" }),
  ];
  for (const value of bad) {
    const listed = await selectReleased(
      loaders({
        "./math-number/index.ts": value,
        [SIBLING]: kept,
      }),
    );
    assert.deepEqual(
      listed.map((s) => s.id),
      ["fair-shares"],
    );
  }
  // Duplicate allowed age tokens are not a failure.
  const dup = subject("math-number", { groups: ["7-10", "7-10"] });
  const keptDup = await selectReleased(loaders({ "./math-number/index.ts": dup }));
  assert.deepEqual(
    keptDup.map((s) => s.id),
    ["math-number"],
  );
});

it("does not call load()", async () => {
  let loads = 0;
  let unreleasedLoads = 0;
  let loadersRun = 0;
  const open = () => {
    loads += 1;
    return Promise.resolve({ default: () => null });
  };
  const hidden = () => {
    unreleasedLoads += 1;
    return Promise.resolve({ default: () => null });
  };
  const card = subject("math-number", { load: open });
  const draft = subject("draft-math", { released: false, load: hidden });
  const listed = await selectReleased({
    "./math-number/index.ts": () => {
      loadersRun += 1;
      return Promise.resolve({ default: card });
    },
    "./draft-math/index.ts": () => {
      loadersRun += 1;
      return Promise.resolve({ default: draft });
    },
  });
  assert.equal(loadersRun, 2);
  assert.equal(loads, 0);
  assert.equal(unreleasedLoads, 0);
  assert.equal(listed[0]?.load, open);
  assert.equal(listed.length, 1);
});

it("sorts released subjects by id with localeCompare en", async () => {
  const listed = await selectReleased(
    loaders({
      "./zeta/index.ts": subject("zeta", { title: "Z" }),
      "./ä/index.ts": subject("ä", { title: "A" }),
    }),
  );
  assert.deepEqual(
    listed.map((s) => s.id),
    ["ä", "zeta"],
  );
});

it('pins import.meta.glob("./*/index.ts") and has no eager', () => {
  assert.equal(typeof (import.meta as { glob?: unknown }).glob, "undefined");
  const raw = readFileSync(new URL("./registry.ts", import.meta.url), "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const needle = 'import.meta.glob("./*/index.ts")';
  const at = stripped.indexOf(needle);
  assert.ok(at >= 0, "glob pattern missing");
  let depth = 0;
  for (let i = 0; i < at; i++) {
    const ch = stripped[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  assert.ok(depth >= 1, "glob must sit inside a function, not at top level");
  assert.match(stripped, /export\s+function\s+listReleasedSubjects\b/);
  assert.equal(/\beager\s*:/.test(stripped), false);
  assert.equal(/from\s+["']three["']/.test(stripped), false);
  assert.equal(/import\s*\(\s*["']three["']\s*\)/.test(stripped), false);
  assert.equal(stripped.includes("game-app"), false);
  assert.equal(/import\s+(?!type\b)[\s\S]*?from\s+["']react["']/.test(stripped), false);
  assert.equal(/from\s+["']maplibre-gl["']/.test(stripped), false);
  const gameApp = readFileSync(new URL("../components/game-app.tsx", import.meta.url), "utf8");
  assert.equal(gameApp.includes("subjects/registry"), false);
});

it("the picker's released list includes the real math module", async () => {
  // The picker lists what selectReleased returns for the discovered
  // modules. Math is released (owner rule, Nov 13: a playable slice
  // exists for every band), so it must appear with its wave-1 units.
  const listed = await selectReleased({
    "./math/index.ts": () => import("./math/index.ts"),
  });
  assert.deepEqual(
    listed.map((s) => s.id),
    ["math"],
  );
  assert.equal(listed[0]?.title, "Math");
  assert.equal(listed[0]?.units.length, 9);
  for (const group of ["7-10", "10-18", "18+"] as const) {
    assert.ok(
      listed[0]?.units.some((unit) => unit.group === group),
      `math has a playable item for ${group}`,
    );
  }
});
