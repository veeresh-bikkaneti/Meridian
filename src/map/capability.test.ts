/**
 * Unit tests for src/map/capability.ts — Scout Map qualification (PBI-1).
 *
 * Written against the dev's API (landed 2026-10-08, uncommitted):
 *   MAP_MODE_STORAGE_KEY = "meridian:map-mode"
 *   MAP_MODE_DECAY_MS = 7 days · LOW_MEMORY_GB = 2
 *   qualifyMapMode({ manual?, priorMapCrash?, webglProbeOk?, deviceMemoryGB? })
 *     → { mode: "full"|"scout", source: "manual"|"prior-crash"|"probe"|"low-memory"|"default" }
 *   readStoredMapMode(storage?, now?) — decay applied here; manual and accepted offers never decay
 *   writeStoredMapMode / clearStoredMapMode
 *   probeWebGL() — real document; weak-renderer patterns incl. SwiftShader
 *   readDeviceMemoryGB() · resolveMapMode({ priorMapCrash? }) — SSR-safe
 *
 * Order (first hit wins): manual > prior-crash > probe > low-memory.
 * Fail-closed: unavailable signals never demote. No UA string read.
 *
 * OPEN SEMANTIC QUESTIONS for the coordinator (not asserted here):
 *  Q1. prior-crash → scout at this layer; the app originally had to show
 *      the offer modal rather than forcing scout ("offer, not force").
 *      SUPERSEDED by the owner's 2026-10-20 ruling — the app now applies a
 *      fresh scout decision silently and persists it as an auto record.
 *  Q2. A FRESH auto record (e.g. probe-assigned yesterday) passed as `manual`
 *      re-demotes today with no fresh signal — 7-day hysteresis vs the
 *      spec's "never demoted twice in a row without a fresh qualifying event".
 *  Q3. Decay only fires if the app does NOT rewrite the auto record every
 *      boot (sliding setAt would defeat it) — confirm the write policy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LOW_MEMORY_GB,
  MAP_CRASH_MARKER_KEY,
  MAP_MODE_DECAY_MS,
  MAP_MODE_STORAGE_KEY,
  SCOUT_UPGRADE_SOAK_MS,
  clearStoredMapMode,
  hasDurableMapCrashMarker,
  planBootMapMode,
  probeWebGL,
  qualifyMapMode,
  readDeviceMemoryGB,
  readStoredMapMode,
  resolveMapMode,
  shouldFireScoutUpgrade,
  writeDurableMapCrashMarker,
  writeStoredMapMode,
  type StoredMapMode,
} from "./capability.ts";

// ---------------------------------------------------------------------------
// SSR-safety: plain node, no window/document. Import must not throw and the
// wrappers must fail closed.
// ---------------------------------------------------------------------------

test("SSR: no DOM globals at import; wrappers fail closed", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
  assert.deepEqual(qualifyMapMode(), { mode: "full", source: "default" });
  assert.deepEqual(resolveMapMode(), { mode: "full", source: "default" });
  assert.equal(probeWebGL(), null);
  // Node's global navigator exists but has no deviceMemory → null.
  assert.equal(readDeviceMemoryGB(), null);
});

// ---------------------------------------------------------------------------
// Constants / storage contract
// ---------------------------------------------------------------------------

test("storage key is the single map-attributed key", () => {
  assert.equal(MAP_MODE_STORAGE_KEY, "meridian:map-mode");
});

test("decay is 7 days; low-memory threshold is 2 GB", () => {
  assert.equal(MAP_MODE_DECAY_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(LOW_MEMORY_GB, 2);
});

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string): string | null => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string): void => {
      m.set(k, v);
    },
    removeItem: (k: string): void => {
      m.delete(k);
    },
  };
}

const NOW = 1_700_000_000_000;

test("write → read round-trips; garbage → null (fail-closed)", () => {
  const s = fakeStorage();
  writeStoredMapMode("scout", "probe", s, NOW);
  assert.deepEqual(readStoredMapMode(s, NOW), {
    mode: "scout",
    source: "probe",
    setAt: NOW,
  });

  assert.equal(readStoredMapMode(fakeStorage(), NOW), null);
  assert.equal(
    readStoredMapMode(fakeStorage({ [MAP_MODE_STORAGE_KEY]: "not-json" }), NOW),
    null,
  );
  assert.equal(
    readStoredMapMode(
      fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify({ mode: "ultra", setAt: NOW }) }),
      NOW,
    ),
    null,
  );
  assert.equal(
    readStoredMapMode(
      fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify({ mode: "scout" }) }),
      NOW,
    ),
    null, // setAt required
  );
});

test("clearStoredMapMode removes the record", () => {
  const s = fakeStorage();
  writeStoredMapMode("scout", "manual", s, NOW);
  clearStoredMapMode(s);
  assert.equal(readStoredMapMode(s, NOW), null);
});

test("decay: stale auto record → null; fresh auto record → kept; manual never decays", () => {
  const stale: StoredMapMode = {
    mode: "scout",
    source: "probe",
    setAt: NOW - 8 * 24 * 60 * 60 * 1000,
  };
  assert.equal(
    readStoredMapMode(
      fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify(stale) }),
      NOW,
    ),
    null,
  );

  const fresh: StoredMapMode = {
    mode: "scout",
    source: "low-memory",
    setAt: NOW - 6 * 24 * 60 * 60 * 1000,
  };
  assert.deepEqual(
    readStoredMapMode(
      fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify(fresh) }),
      NOW,
    ),
    fresh,
  );

  const ancientManual: StoredMapMode = {
    mode: "scout",
    source: "manual",
    setAt: NOW - 90 * 24 * 60 * 60 * 1000,
  };
  assert.deepEqual(
    readStoredMapMode(
      fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify(ancientManual) }),
      NOW,
    ),
    ancientManual,
  );
});

// ---------------------------------------------------------------------------
// qualifyMapMode — order precedence
// ---------------------------------------------------------------------------

test("default: empty signals → full", () => {
  assert.deepEqual(qualifyMapMode({}), { mode: "full", source: "default" });
});

test("manual toggle wins over every other signal", () => {
  const r = qualifyMapMode({
    manual: { mode: "full", source: "manual", setAt: NOW },
    priorMapCrash: true,
    webglProbeOk: false,
    deviceMemoryGB: 1,
  });
  assert.deepEqual(r, { mode: "full", source: "manual" });

  const r2 = qualifyMapMode({
    manual: { mode: "scout", source: "manual", setAt: NOW },
    webglProbeOk: true,
    deviceMemoryGB: 8,
  });
  assert.deepEqual(r2, { mode: "scout", source: "manual" });
});

test("prior-crash flag → scout with source prior-crash (the app applies it silently — see Q1)", () => {
  const r = qualifyMapMode({ priorMapCrash: true });
  assert.deepEqual(r, { mode: "scout", source: "prior-crash" });
  // The source tag is what the app layer persists on the auto record.
  assert.equal(r.source, "prior-crash");
});

test("prior-crash beats probe and memory (order)", () => {
  const r = qualifyMapMode({
    priorMapCrash: true,
    webglProbeOk: false,
    deviceMemoryGB: 1,
  });
  assert.equal(r.source, "prior-crash");
});

test("failed/weak probe → scout; probe beats memory (order)", () => {
  assert.deepEqual(qualifyMapMode({ webglProbeOk: false }), {
    mode: "scout",
    source: "probe",
  });
  const r = qualifyMapMode({ webglProbeOk: false, deviceMemoryGB: 1 });
  assert.equal(r.source, "probe");
});

test("deviceMemory <= 2 → scout; > 2 → no demotion; null depends on pointer (issue #330)", () => {
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 2 }), {
    mode: "scout",
    source: "low-memory",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 0.5 }), {
    mode: "scout",
    source: "low-memory",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 4 }), {
    mode: "full",
    source: "default",
  });
  // UPDATED PIN (issue #330, deliberate): this test used to assert
  // null-memory → full with no pointer signal at all. The new semantics
  // split on the pointer: null + fine → full (unchanged desktop path),
  // null + coarse → scout with the new "unknown-memory" source.
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: null, coarsePointer: false }), {
    mode: "full",
    source: "default",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true }), {
    mode: "scout",
    source: "unknown-memory",
  });
  assert.deepEqual(qualifyMapMode({}), { mode: "full", source: "default" });
});

test("unavailable probe (null) → full (fail-closed)", () => {
  assert.deepEqual(qualifyMapMode({ webglProbeOk: null }), {
    mode: "full",
    source: "default",
  });
});

// ---------------------------------------------------------------------------
// probeWebGL — stubbed global document (the dev's probe reads the real DOM)
// ---------------------------------------------------------------------------

const UNMASKED_RENDERER = 0x9246;

function stubDocument(renderer: string | null, failWithCaveat = false): unknown {
  return {
    createElement: (_tag: string) => ({
      getContext: (kind: string, opts?: Record<string, unknown>) => {
        if (kind !== "webgl") return null;
        if (opts?.failIfMajorPerformanceCaveat === true && failWithCaveat) return null;
        if (renderer === null) return null;
        return {
          getExtension: (name: string) =>
            name === "WEBGL_debug_renderer_info"
              ? { UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER }
              : null,
          getParameter: (p: number) => (p === UNMASKED_RENDERER ? renderer : null),
        };
      },
    }),
  };
}

function withDocument(doc: unknown, fn: () => void): void {
  const g = globalThis as Record<string, unknown>;
  const had = "document" in g;
  const prev = g.document;
  g.document = doc;
  try {
    fn();
  } finally {
    if (had) g.document = prev;
    else delete g.document;
  }
}

const NVIDIA = "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)";
const SWIFT =
  "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)";

test("probeWebGL: capable GPU → true", () => {
  withDocument(stubDocument(NVIDIA), () => {
    assert.equal(probeWebGL(), true);
  });
});

test("probeWebGL: SwiftShader / llvmpipe / software → false", () => {
  withDocument(stubDocument(SWIFT), () => {
    assert.equal(probeWebGL(), false);
  });
  withDocument(stubDocument("Mesa/X.org llvmpipe (LLVM 15, 256 bits)"), () => {
    assert.equal(probeWebGL(), false);
  });
  withDocument(stubDocument("WebKit WebGL Software Renderer"), () => {
    assert.equal(probeWebGL(), false);
  });
});

test("probeWebGL: getContext null (no WebGL) → false", () => {
  withDocument(stubDocument(null), () => {
    assert.equal(probeWebGL(), false);
  });
});

test("probeWebGL: failIfMajorPerformanceCaveat rejects → false", () => {
  withDocument(stubDocument(NVIDIA, true), () => {
    assert.equal(probeWebGL(), false);
  });
});

// ---------------------------------------------------------------------------
// False-demotion goldens (P0): a capable device NEVER lands in scout
// ---------------------------------------------------------------------------

test("P0 golden: capable signals → full, source default", () => {
  const r = qualifyMapMode({
    manual: null,
    priorMapCrash: false,
    webglProbeOk: true,
    deviceMemoryGB: 8,
  });
  assert.deepEqual(r, { mode: "full", source: "default" });
});

test("P0 golden: manual full survives weak probe AND low memory AND crash flag", () => {
  const r = qualifyMapMode({
    manual: { mode: "full", source: "manual", setAt: NOW },
    priorMapCrash: true,
    webglProbeOk: false,
    deviceMemoryGB: 1,
  });
  assert.equal(r.mode, "full");
});

test("P0 golden: decayed auto record + capable signals → full", () => {
  const stale: StoredMapMode = {
    mode: "scout",
    source: "probe",
    setAt: NOW - 8 * 24 * 60 * 60 * 1000,
  };
  const stored = readStoredMapMode(
    fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify(stale) }),
    NOW,
  );
  const r = qualifyMapMode({
    manual: stored,
    webglProbeOk: true,
    deviceMemoryGB: 8,
  });
  assert.deepEqual(r, { mode: "full", source: "default" });
});

test("P0 golden: unavailable everything on a fine pointer → full (never demote on missing signals)", () => {
  // UPDATED PIN (issue #330, deliberate): the golden now names its
  // pointer. With a coarse pointer the same missing signals are the
  // unknown-memory trial (next test); with a fine pointer — the desktop
  // case this golden protects — nothing demotes.
  assert.deepEqual(
    qualifyMapMode({ manual: null, webglProbeOk: null, deviceMemoryGB: null, coarsePointer: false }),
    { mode: "full", source: "default" },
  );
});

test("issue #330: unavailable memory on a coarse pointer → scout trial, source unknown-memory", () => {
  assert.deepEqual(
    qualifyMapMode({ manual: null, webglProbeOk: null, deviceMemoryGB: null, coarsePointer: true }),
    { mode: "scout", source: "unknown-memory" },
  );
});

// ---------------------------------------------------------------------------
// Privacy: no user-agent read anywhere in the module
// ---------------------------------------------------------------------------

test("capability.ts never references the user agent string", () => {
  const src = readFileSync(new URL("./capability.ts", import.meta.url), "utf8");
  assert.ok(
    !/userAgent/i.test(src),
    "capability.ts must not read navigator.userAgent (coarse signals only)",
  );
});

// ---------------------------------------------------------------------------
// planBootMapMode — the silent boot auto-switch (owner ruling, 2026-10-20:
// "Auto-switch silently on weak devices (my decision stands)"). This
// replaced the boot choice dialog: a fresh scout decision now starts the
// session in Scout and persists an AUTO record (qualifying source, never
// manual, never accepted), so the 7-day decay re-qualifies the device.
// ---------------------------------------------------------------------------

test("planBootMapMode: probe scout decision → silent scout + persist the probe source", () => {
  const decision = qualifyMapMode({ webglProbeOk: false });
  assert.deepEqual(decision, { mode: "scout", source: "probe" });
  assert.deepEqual(planBootMapMode(decision), { mode: "scout", persistSource: "probe" });
});

test("planBootMapMode: low-memory scout decision → silent scout + persist the low-memory source", () => {
  const decision = qualifyMapMode({ webglProbeOk: true, deviceMemoryGB: 1 });
  assert.deepEqual(decision, { mode: "scout", source: "low-memory" });
  assert.deepEqual(planBootMapMode(decision), { mode: "scout", persistSource: "low-memory" });
});

test("planBootMapMode: prior-crash decision → silent scout + persist the prior-crash source", () => {
  const decision = qualifyMapMode({ priorMapCrash: true });
  assert.deepEqual(planBootMapMode(decision), { mode: "scout", persistSource: "prior-crash" });
});

// Suppression ("a live stored assignment stands over fresh signals") is
// not the planner's job. game-app's boot effect reads the stored record
// itself and only calls planBootMapMode from its no-stored branch (issue
// #154 item 3 — the planner's old `stored` parameter was dead in
// production, so it was dropped). The storage-contract tests below assert
// the facts that branch relies on: a stored record reads back, and an
// auto record decays while a manual (or legacy accepted) one never does.

test("planBootMapMode: clean boot → full, nothing persisted", () => {
  assert.deepEqual(
    planBootMapMode(qualifyMapMode({ webglProbeOk: true, deviceMemoryGB: 8 })),
    { mode: "full", persistSource: null },
  );
});

test("auto-switch record: qualifying source, NO accepted flag, decays after 7 days", () => {
  // This is the exact write game-app's boot effect performs when the
  // planner says persist (writeStoredMapMode with the persistSource).
  const s = fakeStorage();
  writeStoredMapMode("scout", "probe", s, NOW);
  // The stored JSON is a plain auto record — no `accepted` key at all.
  assert.deepEqual(JSON.parse(s.getItem(MAP_MODE_STORAGE_KEY)!), {
    mode: "scout",
    source: "probe",
    setAt: NOW,
  });
  assert.deepEqual(readStoredMapMode(s, NOW), { mode: "scout", source: "probe", setAt: NOW });
  // Nobody answered anything, so the record decays: after the window the
  // device is re-qualified on fresh signals (and a clean probe returns
  // it to full — pinned at the qualify layer by the P0 golden above).
  assert.equal(readStoredMapMode(s, NOW + MAP_MODE_DECAY_MS + 1), null);
});

test("game-app wiring: boot applies the plan's persistSource as an auto record", () => {
  // Pins that game-app's boot effect actually writes what the planner
  // returns — the successor of the issue #154 item 7 accept-wiring pin
  // (the accept handler it guarded is gone with the dialog). game-app.tsx
  // is a large component with no unit-render harness in this repo, so the
  // wiring is pinned by reading the source — the same pattern as the
  // userAgent check on capability.ts above.
  const src = readFileSync(
    new URL("../components/game-app.tsx", import.meta.url),
    "utf8",
  );
  const start = src.indexOf("planBootMapMode(");
  assert.ok(start >= 0, "boot effect must plan via planBootMapMode");
  const boot = src.slice(start, start + 1200);
  assert.match(
    boot,
    /writeStoredMapMode\("scout", plan\.persistSource\)/,
    "boot must persist the planned source as the auto record",
  );
  // And the dialog era is fully gone from the component.
  assert.ok(!src.includes("ScoutBootOffer"), "the boot offer dialog must not come back");
  // Issue #154 item 1: the E2E harness seam must NOT come back either.
  // Production once read window.__meridianSuppressScoutOffer to skip the
  // auto-switch — a test bypass shipped to every player, settable by any
  // page script. The harness now spoofs the device signals instead
  // (tests/e2e/helpers.ts), so the app needs no bypass; if the seam name
  // ever reappears in this component, this pin fails.
  assert.ok(
    !src.includes("__meridianSuppressScoutOffer"),
    "the production test seam must stay removed — the harness spoofs device signals instead (issue #154 item 1)",
  );
});

test("legacy accepted record (written by the pre-2026-10-20 dialog) never decays", () => {
  // Players' devices still hold records the removed dialog wrote on
  // accept: { mode: scout, source: <signal>, accepted: true }. The reader
  // must keep honoring them — an accepted choice is the person's own
  // answer. Seeded as raw JSON because current code can no longer write
  // this shape (exactly the production situation after the update).
  const s = fakeStorage({
    [MAP_MODE_STORAGE_KEY]: JSON.stringify({
      mode: "scout",
      source: "probe",
      setAt: NOW,
      accepted: true,
    }),
  });
  assert.deepEqual(readStoredMapMode(s, NOW), {
    mode: "scout",
    source: "probe",
    setAt: NOW,
    accepted: true,
  });
  for (const days of [1, 8, 30, 365]) {
    const later = NOW + days * 24 * 60 * 60 * 1000;
    const stored = readStoredMapMode(s, later);
    assert.ok(stored, `accepted record must survive ${days} days`);
    assert.equal(stored.mode, "scout");
  }
  // The qualifying source is preserved, so telemetry can still tell an
  // accepted probe record from an accepted low-memory one.
  const s2 = fakeStorage({
    [MAP_MODE_STORAGE_KEY]: JSON.stringify({
      mode: "scout",
      source: "low-memory",
      setAt: NOW,
      accepted: true,
    }),
  });
  assert.equal(readStoredMapMode(s2, NOW + 400 * 24 * 60 * 60 * 1000)?.source, "low-memory");
});

test("accepted flag on read: strict true only — corrupt values do not stop decay", () => {
  for (const bad of ["true", 1, "yes", false, null]) {
    const stale = {
      mode: "scout",
      source: "probe",
      setAt: NOW - 8 * 24 * 60 * 60 * 1000,
      accepted: bad,
    };
    assert.equal(
      readStoredMapMode(fakeStorage({ [MAP_MODE_STORAGE_KEY]: JSON.stringify(stale) }), NOW),
      null,
      `accepted=${JSON.stringify(bad)} must not stop decay`,
    );
  }
});

test("a legacy accepted choice is replaced by a later manual toggle", () => {
  const s = fakeStorage({
    [MAP_MODE_STORAGE_KEY]: JSON.stringify({
      mode: "scout",
      source: "probe",
      setAt: NOW,
      accepted: true,
    }),
  });
  writeStoredMapMode("full", "manual", s, NOW + 1000);
  assert.deepEqual(readStoredMapMode(s, NOW + 1000), {
    mode: "full",
    source: "manual",
    setAt: NOW + 1000,
  });
});

test("legacy decline record (manual full from the old dialog) stands on a weak device forever", () => {
  // The old dialog's decline wrote { mode: full, source: manual }. That
  // record is why a player who once said "Keep full map" is never
  // auto-switched today: the stored record stands, so game-app's boot
  // check never reaches fresh qualification.
  const s = fakeStorage({
    [MAP_MODE_STORAGE_KEY]: JSON.stringify({ mode: "full", source: "manual", setAt: NOW }),
  });
  const nextYear = NOW + 365 * 24 * 60 * 60 * 1000;
  const stored = readStoredMapMode(s, nextYear);
  assert.ok(stored);
  assert.equal(stored.mode, "full");
  // Even with every weak signal firing, qualification stands on it.
  assert.deepEqual(
    qualifyMapMode({
      manual: stored,
      priorMapCrash: true,
      webglProbeOk: false,
      deviceMemoryGB: 1,
    }),
    { mode: "full", source: "manual" },
  );
});

test("P1-7: a clean WebGL probe keeps a 2 GB device on the Full map; 1 GB still demotes", () => {
  assert.deepEqual(qualifyMapMode({ webglProbeOk: true, deviceMemoryGB: 2 }), {
    mode: "full",
    source: "default",
  });
  assert.deepEqual(qualifyMapMode({ webglProbeOk: true, deviceMemoryGB: 1 }), {
    mode: "scout",
    source: "low-memory",
  });
  // Probe unavailable: 2 GB still counts (tiebreaker), as before.
  assert.deepEqual(qualifyMapMode({ webglProbeOk: null, deviceMemoryGB: 2 }), {
    mode: "scout",
    source: "low-memory",
  });
});

// ---------------------------------------------------------------------------
// Issue #330 — unknown-memory Scout trial: full qualification matrix
// ---------------------------------------------------------------------------

test("#330 matrix: unknown memory + coarse → scout trial, whatever the probe says", () => {
  for (const webglProbeOk of [true, null, undefined]) {
    assert.deepEqual(
      qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true, webglProbeOk }),
      { mode: "scout", source: "unknown-memory" },
      `probe=${String(webglProbeOk)} must not change the trial`,
    );
  }
  // Absent and non-finite readings are also "unknown".
  assert.deepEqual(qualifyMapMode({ coarsePointer: true }), {
    mode: "scout",
    source: "unknown-memory",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: Number.NaN, coarsePointer: true }), {
    mode: "scout",
    source: "unknown-memory",
  });
});

test("#330 matrix: known memory + coarse behaves exactly as before the rule existed", () => {
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 8, coarsePointer: true, webglProbeOk: true }), {
    mode: "full",
    source: "default",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 4, coarsePointer: true, webglProbeOk: true }), {
    mode: "full",
    source: "default",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 2, coarsePointer: true, webglProbeOk: true }), {
    mode: "full",
    source: "default",
  });
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: 1, coarsePointer: true, webglProbeOk: true }), {
    mode: "scout",
    source: "low-memory",
  });
});

test("#330 matrix: real weak signals keep their own source on a coarse unknown-memory device", () => {
  // prior-crash, probe and low-memory all outrank the trial rule, so a
  // device demoted by any of them is never "demoted solely by the new
  // rule" — and never gets the upgrade (gate tests below).
  assert.deepEqual(
    qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true, priorMapCrash: true }),
    { mode: "scout", source: "prior-crash" },
  );
  assert.deepEqual(
    qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true, webglProbeOk: false }),
    { mode: "scout", source: "probe" },
  );
});

test("#330 matrix: a stored manual record beats the trial rule in both directions", () => {
  assert.deepEqual(
    qualifyMapMode({
      manual: { mode: "full", source: "manual", setAt: NOW },
      deviceMemoryGB: null,
      coarsePointer: true,
      webglProbeOk: true,
    }),
    { mode: "full", source: "manual" },
  );
  assert.deepEqual(
    qualifyMapMode({
      manual: { mode: "scout", source: "manual", setAt: NOW },
      deviceMemoryGB: null,
      coarsePointer: true,
      webglProbeOk: true,
    }),
    { mode: "scout", source: "manual" },
  );
});

test("#330: unknown-memory source survives a stored-record round-trip (reader robustness)", () => {
  // Production never writes this source (the trial persists nothing —
  // see the state-machine test), but the reader must not mangle it if a
  // future build ever does.
  const s = fakeStorage();
  writeStoredMapMode("scout", "unknown-memory", s, NOW);
  assert.deepEqual(readStoredMapMode(s, NOW), {
    mode: "scout",
    source: "unknown-memory",
    setAt: NOW,
  });
});

// ---------------------------------------------------------------------------
// Issue #330 — Scout → full upgrade gate + the crash state machine
// ---------------------------------------------------------------------------

test("#330 plan: unknown-memory decision → scout with NOTHING persisted", () => {
  const decision = qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true, webglProbeOk: true });
  assert.deepEqual(planBootMapMode(decision), { mode: "scout", persistSource: null });
});

test("#330 gate: fires only for the trial, only after the full soak", () => {
  const ready = NOW;
  const base = { initialSource: "unknown-memory" as const, scoutReadyAtMs: ready };
  assert.equal(SCOUT_UPGRADE_SOAK_MS, 3000);
  assert.equal(shouldFireScoutUpgrade({ ...base, nowMs: ready }), false);
  assert.equal(shouldFireScoutUpgrade({ ...base, nowMs: ready + SCOUT_UPGRADE_SOAK_MS - 1 }), false);
  assert.equal(shouldFireScoutUpgrade({ ...base, nowMs: ready + SCOUT_UPGRADE_SOAK_MS }), true);
  assert.equal(shouldFireScoutUpgrade({ ...base, nowMs: ready + 60_000 }), true);
  // Not ready yet → never.
  assert.equal(
    shouldFireScoutUpgrade({ initialSource: "unknown-memory", scoutReadyAtMs: null, nowMs: ready + 60_000 }),
    false,
  );
});

test("#330 gate flag: disarmed trial never fires, even with every soak condition met", () => {
  const ready = NOW;
  // The kill-switch position (scoutUpgradeTrial: false): the pure gate
  // must stay shut at and past the full soak, however stable Scout was.
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: "unknown-memory",
      trialArmed: false,
      scoutReadyAtMs: ready,
      nowMs: ready + SCOUT_UPGRADE_SOAK_MS,
    }),
    false,
  );
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: "unknown-memory",
      trialArmed: false,
      scoutReadyAtMs: ready,
      nowMs: ready + 60_000,
    }),
    false,
  );
});

test("#330 gate flag: armed trial fires exactly as before (explicit true and omitted)", () => {
  const ready = NOW;
  // Explicit armed = the flag's shipped position; omitted = the baked-in
  // default — both must reproduce the pre-flag behavior byte-for-byte:
  // shut before the soak, open at it.
  for (const trialArmed of [true, undefined] as const) {
    assert.equal(
      shouldFireScoutUpgrade({
        initialSource: "unknown-memory",
        trialArmed,
        scoutReadyAtMs: ready,
        nowMs: ready + SCOUT_UPGRADE_SOAK_MS - 1,
      }),
      false,
      `trialArmed=${trialArmed} must stay shut before the soak`,
    );
    assert.equal(
      shouldFireScoutUpgrade({
        initialSource: "unknown-memory",
        trialArmed,
        scoutReadyAtMs: ready,
        nowMs: ready + SCOUT_UPGRADE_SOAK_MS,
      }),
      true,
      `trialArmed=${trialArmed} must fire at the soak`,
    );
  }
});

test("#330 gate: weak-device sources, prior crash, and stored records never upgrade", () => {
  const ready = NOW;
  for (const initialSource of ["prior-crash", "probe", "low-memory", "manual", "contextlost", "default"] as const) {
    assert.equal(
      shouldFireScoutUpgrade({ initialSource, scoutReadyAtMs: ready, nowMs: ready + 60_000 }),
      false,
      `source=${initialSource} must not upgrade`,
    );
  }
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: "unknown-memory",
      priorMapCrash: true,
      scoutReadyAtMs: ready,
      nowMs: ready + 60_000,
    }),
    false,
  );
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: "unknown-memory",
      storedRecordPresent: true,
      scoutReadyAtMs: ready,
      nowMs: ready + 60_000,
    }),
    false,
  );
});

test("#330 state machine: trial → upgrade → upgrade crash → next boot stays scout, no upgrade", () => {
  const storage = fakeStorage();
  // Boot 1 (field device): unknown memory, coarse pointer, clean probe,
  // no stored record, no prior crash. Follows the plan exactly as
  // game-app does: write only when persistSource is non-null.
  const boot1 = planBootMapMode(
    qualifyMapMode({ deviceMemoryGB: null, coarsePointer: true, webglProbeOk: true }),
  );
  assert.equal(boot1.mode, "scout");
  if (boot1.persistSource !== null) writeStoredMapMode("scout", boot1.persistSource, storage, NOW);
  // The trial wrote no record — so no stored artifact exists that a
  // later boot could mistake for a standing assignment and skip the
  // prior-crash check for.
  assert.equal(storage.getItem(MAP_MODE_STORAGE_KEY), null);
  assert.equal(readStoredMapMode(storage, NOW), null);
  // Scout map reaches map_ready at NOW+1000; the upgrade fires at +3 s.
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: "unknown-memory",
      scoutReadyAtMs: NOW + 1000,
      nowMs: NOW + 1000 + SCOUT_UPGRADE_SOAK_MS,
    }),
    true,
  );
  // The upgraded full map is what kills the process. Boot 2 therefore
  // sees a prior map crash (session signal, or the durable marker —
  // both feed the same priorMapCrash input in game-app).
  const boot2Decision = qualifyMapMode({
    deviceMemoryGB: null,
    coarsePointer: true,
    webglProbeOk: true,
    priorMapCrash: true,
  });
  assert.deepEqual(boot2Decision, { mode: "scout", source: "prior-crash" });
  assert.deepEqual(planBootMapMode(boot2Decision), { mode: "scout", persistSource: "prior-crash" });
  // And the gate stays shut for boot 2 even after a long stable Scout:
  // its source is prior-crash, not the trial.
  assert.equal(
    shouldFireScoutUpgrade({
      initialSource: boot2Decision.source,
      priorMapCrash: true,
      scoutReadyAtMs: NOW,
      nowMs: NOW + 10 * SCOUT_UPGRADE_SOAK_MS,
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Issue #330 — durable map-crash marker (localStorage, 7-day decay)
// ---------------------------------------------------------------------------

test("#330 marker: write → read round-trips inside the decay window", () => {
  const s = fakeStorage();
  assert.equal(hasDurableMapCrashMarker(s, NOW), false);
  writeDurableMapCrashMarker(s, NOW);
  assert.deepEqual(JSON.parse(s.getItem(MAP_CRASH_MARKER_KEY)!), { at: NOW });
  assert.equal(hasDurableMapCrashMarker(s, NOW), true);
  assert.equal(hasDurableMapCrashMarker(s, NOW + MAP_MODE_DECAY_MS), true);
});

test("#330 marker: stale marker decays; garbage reads as absent", () => {
  const s = fakeStorage();
  writeDurableMapCrashMarker(s, NOW);
  assert.equal(hasDurableMapCrashMarker(s, NOW + MAP_MODE_DECAY_MS + 1), false);
  assert.equal(hasDurableMapCrashMarker(fakeStorage({ [MAP_CRASH_MARKER_KEY]: "not-json" }), NOW), false);
  assert.equal(
    hasDurableMapCrashMarker(fakeStorage({ [MAP_CRASH_MARKER_KEY]: JSON.stringify({ at: "soon" }) }), NOW),
    false,
  );
  assert.equal(hasDurableMapCrashMarker(fakeStorage(), NOW), false);
  assert.equal(hasDurableMapCrashMarker(null, NOW), false);
});

test("#330 marker: a manual record still outranks the durable crash signal", () => {
  // The marker only feeds the priorMapCrash input; a stored manual
  // record is evaluated before that input in qualifyMapMode.
  const s = fakeStorage();
  writeDurableMapCrashMarker(s, NOW);
  assert.equal(hasDurableMapCrashMarker(s, NOW), true);
  assert.deepEqual(
    qualifyMapMode({
      manual: { mode: "full", source: "manual", setAt: NOW },
      priorMapCrash: hasDurableMapCrashMarker(s, NOW),
      deviceMemoryGB: null,
      coarsePointer: true,
    }),
    { mode: "full", source: "manual" },
  );
});

// ---------------------------------------------------------------------------
// Issue #330 — probe context release
// ---------------------------------------------------------------------------

test("#330 probe: the probe context is released via WEBGL_lose_context on pass and on weak verdict", () => {
  for (const renderer of [NVIDIA, SWIFT]) {
    let lost = 0;
    const doc = {
      createElement: (_tag: string) => ({
        getContext: (kind: string) => {
          if (kind !== "webgl") return null;
          return {
            getExtension: (name: string) => {
              if (name === "WEBGL_debug_renderer_info") return { UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER };
              if (name === "WEBGL_lose_context") return { loseContext: () => { lost += 1; } };
              return null;
            },
            getParameter: (p: number) => (p === UNMASKED_RENDERER ? renderer : null),
          };
        },
      }),
    };
    withDocument(doc, () => {
      assert.equal(probeWebGL(), renderer === NVIDIA);
    });
    assert.equal(lost, 1, `context must be released exactly once for ${renderer.slice(0, 20)}…`);
  }
});
