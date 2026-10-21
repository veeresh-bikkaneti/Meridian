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
  MAP_MODE_DECAY_MS,
  MAP_MODE_STORAGE_KEY,
  clearStoredMapMode,
  planBootMapMode,
  probeWebGL,
  qualifyMapMode,
  readDeviceMemoryGB,
  readStoredMapMode,
  resolveMapMode,
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

test("deviceMemory <= 2 → scout; > 2 / absent / null → no demotion", () => {
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
  assert.deepEqual(qualifyMapMode({ deviceMemoryGB: null }), {
    mode: "full",
    source: "default",
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

test("P0 golden: unavailable everything → full (never demote on missing signals)", () => {
  assert.deepEqual(
    qualifyMapMode({ manual: null, webglProbeOk: null, deviceMemoryGB: null }),
    { mode: "full", source: "default" },
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
  assert.ok(
    src.includes("__meridianSuppressScoutOffer"),
    "the harness seam stays wired — it now suppresses the auto-switch (issue #154 item 1)",
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
