/**
 * Unit tests for src/map/capability.ts — Scout Map qualification (PBI-1).
 *
 * Written against the dev's API (landed 2026-10-08, uncommitted):
 *   MAP_MODE_STORAGE_KEY = "meridian:map-mode"
 *   MAP_MODE_DECAY_MS = 7 days · LOW_MEMORY_GB = 2
 *   qualifyMapMode({ manual?, priorMapCrash?, webglProbeOk?, deviceMemoryGB? })
 *     → { mode: "full"|"scout", source: "manual"|"prior-crash"|"probe"|"low-memory"|"default" }
 *   readStoredMapMode(storage?, now?) — decay applied here; manual never decays
 *   writeStoredMapMode / clearStoredMapMode
 *   probeWebGL() — real document; weak-renderer patterns incl. SwiftShader
 *   readDeviceMemoryGB() · resolveMapMode({ priorMapCrash? }) — SSR-safe
 *
 * Order (first hit wins): manual > prior-crash > probe > low-memory.
 * Fail-closed: unavailable signals never demote. No UA string read.
 *
 * OPEN SEMANTIC QUESTIONS for the coordinator (not asserted here):
 *  Q1. prior-crash → scout at this layer; the APP must show the offer modal
 *      (data-testid="scout-boot-offer") when source === "prior-crash" rather
 *      than forcing scout — spec says offer, not force.
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

test("prior-crash flag → scout with source prior-crash (app must OFFER, not force — see Q1)", () => {
  const r = qualifyMapMode({ priorMapCrash: true });
  assert.deepEqual(r, { mode: "scout", source: "prior-crash" });
  // The source tag is what lets the app layer show the offer modal.
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
