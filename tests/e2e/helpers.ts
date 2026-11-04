import { expect, type BrowserContext, type Page, type Route } from "playwright/test";
import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { OBSERVABILITY_INGEST_HOSTS } from "../../src/lib/flags.ts";

/**
 * Shared E2E helpers for the P0-02/P0-03 suite.
 *
 * Serving model: the built Pages artifact (dist/client) is fulfilled from
 * disk for every app URL while the page keeps the production base URL
 * http://127.0.0.1:4123/Meridian/. See playwright.config.ts for why the
 * loopback preview server cannot be reached directly from Chromium 152 in
 * this VM. The served bytes are the identical files `npm run build:pages`
 * produced.
 *
 * Imagery tiles: server.arcgisonline.com is unreachable from this VM (TCP
 * connects time out 100% — measured 2026-09-30; other hosts work), so tile
 * requests are fulfilled with a 1x1 PNG stub. This restores the nominal
 * "network works" condition: it does not change any app behavior, it only
 * lets MapLibre's style "load" event fire so the intro camera beats run.
 * Every zoom-space assertion measures camera/projection/announcement/pin
 * state — tile pixels are irrelevant to all of them — and the tile
 * loading/failure UX itself is covered by the 41 unit tests in
 * src/map/tile-status.test.ts, not by these specs. If real tile egress
 * returns, delete the stub and the pass-through below suffices.
 */

// NOTE (F2 worktree): the parent clone hardcodes its own dist path here; this
// worktree resolves relative to the repo root it runs from so E2E tests the
// worktree's own build, never a sibling's stale artifact.
// Overridable for the fail-closed no-URL build: run a spec with
// KOFI_E2E_DIST=/tmp/dist-nokofi to serve a build produced WITHOUT
// VITE_KOFI_URL (the cloud must render nothing there).
const DIST = path.resolve(process.env.KOFI_E2E_DIST ?? "dist/client");
const BASE = "/Meridian/";
/**
 * The GeoDetective guess index as `{n, id}` rows, decoded from the same
 * packed file the app fetches (public/loop/names.v2.json — format in
 * src/game/loop/names-codec.ts). Read from the built artifact in Node, so
 * specs filter 119k rows here instead of shipping them through page.evaluate.
 */
export function loopNameIndex(): { n: string; id: string; r: string }[] {
  const packed = JSON.parse(readFileSync(path.join(DIST, "loop", "names.v2.json"), "utf8")) as {
    regions: string[];
    n: string[];
    id: number[];
    r: number[];
  };
  return packed.n.map((n, i) => ({ n, id: `geonames:${packed.id[i]}`, r: packed.regions[packed.r[i]] }));
}

/** The open mystery's place id, from the page's persisted loop store + clue file. */
export async function openMysteryPlaceId(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) => r.json());
    return clue.placeId as string;
  });
}

export const EVIDENCE = "/home/hatch/workspace/meridian-review/evidence";
export const RUN_KEY = "meridian.run";
/** mc2 challenge runs persist under their own key (manifest C8); the
 * phase-reading helpers below accept it via their optional key param. */
export const MC2_RUN_KEY = "meridian.run.mc2";
export const MC3_RUN_KEY = "meridian.run.mc3";

// 1x1 fully-transparent PNG (base64) — tile stub, see the header comment.
// (The previous bytes decoded to semi-transparent GREEN, not transparent;
// regenerated 2026-09-30 so the stub matches its documented intent.)
const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/**
 * Device-signal spoof (the Scout boot suppression, harness-side).
 *
 * The harness boots on a SwiftShader VM that the app's capability probe
 * reads — correctly — as a weak device, so without help every fresh
 * boot would silently auto-switch to Scout (owner ruling, 2026-10-20)
 * and block unrelated specs. The old fix was a window flag the app
 * itself honored (window.__meridianSuppressScoutOffer), which shipped
 * in production where any page script could set it. It was removed
 * (issue #154 item 1): the harness now spoofs the SIGNALS the probe
 * reads — the WebGL debug renderer reports a discrete NVIDIA GPU and
 * navigator.deviceMemory reports the given size — so the app's own
 * qualification honestly reaches "capable" and boots full. The app
 * contains no test bypass at all; production and tests run the same
 * boot path. Must be installed via context.addInitScript BEFORE
 * navigation (addInitScript here does exactly that).
 */
async function spoofDevice(context: BrowserContext, deviceMemoryGB: number): Promise<void> {
  await context.addInitScript((gb: number) => {
    const NVIDIA =
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)";
    const R = 0x9246;
    const V = 0x9245;
    const proto = HTMLCanvasElement.prototype;
    const origGetContext = proto.getContext;
    (proto as unknown as Record<string, unknown>).getContext = function (
      this: HTMLCanvasElement,
      type: string,
      opts?: unknown,
    ) {
      const ctx = (origGetContext as Function).call(this, type, opts) as
        | (WebGLRenderingContext & Record<string, unknown>)
        | null;
      if (
        ctx &&
        (type === "webgl" || type === "webgl2" || type === "experimental-webgl")
      ) {
        const origGetExtension = ctx.getExtension.bind(ctx);
        const origGetParameter = ctx.getParameter.bind(ctx);
        ctx.getExtension = ((name: string) => {
          if (name === "WEBGL_debug_renderer_info") {
            return { UNMASKED_RENDERER_WEBGL: R, UNMASKED_VENDOR_WEBGL: V };
          }
          return origGetExtension(name);
        }) as typeof ctx.getExtension;
        ctx.getParameter = ((p: number) => {
          if (p === R) return NVIDIA;
          if (p === V) return "Google Inc. (NVIDIA)";
          return origGetParameter(p);
        }) as typeof ctx.getParameter;
      }
      return ctx;
    };
    Object.defineProperty(Navigator.prototype, "deviceMemory", {
      get: () => gb,
      configurable: true,
    });
  }, deviceMemoryGB);
}

/**
 * Spoof a CAPABLE device (false-demotion golden): discrete-GPU renderer
 * string, 8 GB deviceMemory. The VM's real Chromium reports a SwiftShader
 * renderer, so without this the harness itself reads as a weak device.
 */
export async function spoofCapableDevice(context: BrowserContext): Promise<void> {
  await spoofDevice(context, 8);
}

/**
 * Spoof a LOW-MEMORY device in isolation: capable GPU (the probe passes)
 * but 1 GB deviceMemory, so the qualification source is "low-memory" and
 * not "probe".
 */
export async function spoofLowMemoryDevice(context: BrowserContext): Promise<void> {
  await spoofDevice(context, 1);
}

/**
 * Serves the built Pages artifact for E2E (see header comment).
 *
 * Scout Map boot: by default (spoofCapableDevice !== false) the
 * capable-device spoof above is installed, so boots on this weak VM
 * stay in the full map unless a spec is exercising Scout itself. Specs
 * that exercise the auto-switch pass { spoofCapableDevice: false } and
 * see the genuine weak-device boot.
 *
 * Precedence note (owner ruling Q2): the spoof fakes the WebGL probe and
 * navigator.deviceMemory only; a stored map-mode record wins first, then
 * a seeded prior-map crash (priorMapCrash). Crash-seeding specs should
 * serve with { spoofCapableDevice: false } unless the crash itself is
 * the subject under test.
 */
/**
 * The production crash-report worker. flags.json's `observabilityEndpoint`
 * can only name a host on OBSERVABILITY_INGEST_HOSTS (src/lib/flags.ts), so
 * stubbing that list covers whatever endpoint the served build configures.
 * Without the stub, e2e runs post real telemetry to prod, and the worker
 * answers the loopback test origin with 403 {"error":"origin not allowed"}
 * (workers/crash-report/src/index.ts), a console error that fails
 * clean-console checks.
 */
export function isTelemetryHost(hostname: string): boolean {
  return OBSERVABILITY_INGEST_HOSTS.includes(hostname);
}

export function fulfillTelemetryStub(route: Route): Promise<void> {
  return route.fulfill({ status: 204, body: "" });
}

/** The prod ingest endpoint, derived from the allowlist — never a second literal. */
export const TELEMETRY_ENDPOINT = `https://${OBSERVABILITY_INGEST_HOSTS[0]}/ingest`;

/** One recorded telemetry post, in the order the ledger saw it. */
export interface TelemetryEvent {
  seq: number;
  /** `payload.type`, or null when the body carried no string type. */
  type: string | null;
  payload: Record<string, unknown>;
  /** True when the body was not a JSON object; the event is kept, never dropped. */
  parseError?: boolean;
  /** Raw body text on parse failure (truncated at 2048 chars), so the
   *  evidence of what was posted survives even when it has no type. */
  raw?: string;
  url: string;
  method: string;
  via: "stub" | "collector";
}

/** A telemetry request that reached (or tried to reach) the real network. */
export interface TelemetryEscape {
  url: string;
  status: number | null;
  kind: "response" | "requestfailed";
}

/**
 * The per-context telemetry record. `serveBuiltArtifact` creates one per
 * context and returns it; `collectTelemetry` resolves the same one, so
 * stub- and collector-claimed events form one ordered stream.
 */
export interface TelemetryLedger {
  all(): readonly TelemetryEvent[];
  /** A COPY of the payload array (F2) — callers cannot mutate the record. */
  payloads(): Array<Record<string, unknown>>;
  ofType(type: string): TelemetryEvent[];
  first(type: string): TelemetryEvent | undefined;
  count(type?: string): number;
  escapes(): readonly TelemetryEscape[];
  /** Throws, listing every recorded event, when the ledger is not empty. */
  assertSilent(): void;
  /** Throws, listing every escape, when any telemetry left the stub. */
  assertNoEscape(): void;
}

interface LedgerState {
  events: TelemetryEvent[];
  escapes: TelemetryEscape[];
  seq: number;
}

const ledgerStates = new WeakMap<TelemetryLedger, LedgerState>();

export function createTelemetryLedger(): TelemetryLedger {
  const state: LedgerState = { events: [], escapes: [], seq: 0 };
  // Read APIs deep-copy (β-F4): mutating a returned event/payload must
  // never rewrite the record that count()/ofType() read back.
  const cloneEvent = (e: TelemetryEvent): TelemetryEvent => structuredClone(e);
  const ledger: TelemetryLedger = {
    all: () => state.events.map(cloneEvent),
    payloads: () => state.events.map((e) => structuredClone(e.payload)),
    ofType: (type) => state.events.filter((e) => e.type === type).map(cloneEvent),
    first: (type) => {
      const found = state.events.find((e) => e.type === type);
      return found ? cloneEvent(found) : undefined;
    },
    count: (type) =>
      type === undefined
        ? state.events.length
        : state.events.filter((e) => e.type === type).length,
    escapes: () => state.escapes.map((e) => ({ ...e })),
    assertSilent: () => {
      if (state.events.length > 0) {
        throw new Error(
          `expected no telemetry, recorded ${state.events.length} event(s): ${state.events
            .map((e) => `#${e.seq} ${e.type ?? "<unparseable>"} via ${e.via} ${e.method} ${e.url}`)
            .join("; ")}`,
        );
      }
    },
    assertNoEscape: () => {
      if (state.escapes.length > 0) {
        throw new Error(
          `telemetry escaped the stub (${state.escapes.length}): ${state.escapes
            .map((e) => `${e.kind} status=${e.status ?? "failed"} ${e.url}`)
            .join("; ")}`,
        );
      }
    },
  };
  ledgerStates.set(ledger, state);
  return ledger;
}

function ledgerState(ledger: TelemetryLedger): LedgerState {
  const state = ledgerStates.get(ledger);
  if (!state) throw new Error("telemetry ledger was not created by createTelemetryLedger()");
  return state;
}

interface TelemetryRequestLike {
  url(): string;
  method(): string;
  postDataJSON(): unknown;
  postData(): string | null;
}

/** Parse the request body and append the event — recording happens before
 *  any fulfill, so a wrongful post is preserved as data even though the
 *  network answer stays a benign 204. */
function recordTelemetryRequest(
  ledger: TelemetryLedger,
  request: TelemetryRequestLike,
  via: "stub" | "collector",
): void {
  const state = ledgerState(ledger);
  let payload: Record<string, unknown> = {};
  let parseError = false;
  let rawText: string | null = null;
  const captureRaw = (): void => {
    // postData() may return null for binary bodies — store what exists.
    try {
      rawText = request.postData();
    } catch {
      rawText = null;
    }
  };
  try {
    const parsed: unknown = request.postDataJSON();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    } else {
      parseError = true;
      captureRaw();
    }
  } catch {
    // Non-JSON body (e.g. the watchdog's XHR): try the raw text once
    // before keeping the event as an explicit parse error.
    parseError = true;
    captureRaw();
    if (rawText) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          payload = parsed as Record<string, unknown>;
          parseError = false;
        }
      } catch {
        /* stays a parseError event */
      }
    }
  }
  const type = typeof payload.type === "string" ? payload.type : null;
  state.events.push({
    seq: ++state.seq,
    type,
    payload,
    ...(parseError
      ? { parseError: true, ...(rawText ? { raw: rawText.slice(0, 2048) } : {}) }
      : {}),
    url: request.url(),
    method: request.method(),
    via,
  });
}

/**
 * Run-level backstop: one JSON line per escape to the spill file the
 * global teardown fails on (see telemetry-spill-setup/-teardown.ts).
 * A failed append is never silent (β-F2): it is logged, then retried
 * against the fallback path the setup exported; the teardown reads
 * both files. Still never throws into a test.
 */
function appendSpill(escape: TelemetryEscape): void {
  const line = `${JSON.stringify(escape)}\n`;
  const spill = process.env.MERIDIAN_E2E_TELEMETRY_SPILL;
  if (!spill) return;
  try {
    appendFileSync(spill, line);
    return;
  } catch (err) {
    console.error(`telemetry spill append failed for ${spill}: ${String(err)}`);
  }
  const fallback = process.env.MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK;
  if (!fallback) return;
  try {
    appendFileSync(fallback, line);
  } catch (err) {
    console.error(`telemetry spill fallback append failed for ${fallback}: ${String(err)}`);
  }
}

function recordTelemetryEscape(ledger: TelemetryLedger, escape: TelemetryEscape): void {
  ledgerState(ledger).escapes.push(escape);
  appendSpill(escape);
}

/**
 * The one telemetry policy entry point: returns false for non-telemetry
 * hosts (the caller continues its own handling); for telemetry hosts it
 * records the post into `ledger` and fulfills the shared 204 stub.
 * Hand-rolled handlers call this before any `route.continue()`.
 */
export async function handleTelemetry(route: Route, ledger: TelemetryLedger): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(route.request().url()).hostname;
  } catch {
    return false;
  }
  if (!isTelemetryHost(hostname)) return false;
  recordTelemetryRequest(ledger, route.request(), "stub");
  await fulfillTelemetryStub(route);
  return true;
}

const watchedPairs = new WeakMap<BrowserContext, WeakSet<TelemetryLedger>>();

/**
 * Escape detection for one context+ledger pair: any telemetry-host
 * response that is not the stub's 204 — or a telemetry request that
 * fails outright — reached (or tried to reach) the real worker.
 * Listeners never throw into a test; escapes land on the ledger and in
 * the spill file. Idempotent per context+ledger pair: registering the
 * same pair twice adds no second listener set. `serveBuiltArtifact`
 * calls this for its ledger; hand-rolled handlers (pinch-zoom,
 * tap-verify) call it on their own contexts.
 */
export function watchTelemetryEscapes(context: BrowserContext, ledger: TelemetryLedger): void {
  let ledgers = watchedPairs.get(context);
  if (!ledgers) {
    ledgers = new WeakSet();
    watchedPairs.set(context, ledgers);
  }
  if (ledgers.has(ledger)) return;
  ledgers.add(ledger);

  // Per-context request correlation (β-F1): a correctly stubbed fetch
  // post gets its 204 response and THEN a spurious requestfailed
  // (net::ERR_ABORTED) for the same Request object. A request that
  // received a response is answered, not escaped; a request records
  // at most one escape either way.
  const answered = new WeakSet<object>();
  const escapeByRequest = new Map<object, TelemetryEscape>();
  const spillTimers = new Map<TelemetryEscape, ReturnType<typeof setTimeout>>();

  const retract = (escape: TelemetryEscape): void => {
    const state = ledgerState(ledger);
    const idx = state.escapes.indexOf(escape);
    if (idx >= 0) state.escapes.splice(idx, 1);
    const timer = spillTimers.get(escape);
    if (timer) {
      clearTimeout(timer);
      spillTimers.delete(escape);
    }
  };

  context.on("response", (res) => {
    try {
      if (!isTelemetryHost(new URL(res.url()).hostname)) return;
      const req = res.request();
      answered.add(req);
      if (res.status() === 204) {
        // Reverse-order phantom: the requestfailed landed first, then
        // the stub's 204 — retract the escape before assertions run.
        const prior = escapeByRequest.get(req);
        if (prior && prior.kind === "requestfailed" && prior.status === null) {
          retract(prior);
          escapeByRequest.delete(req);
        }
        return;
      }
      if (escapeByRequest.has(req)) return;
      const escape: TelemetryEscape = { url: res.url(), status: res.status(), kind: "response" };
      escapeByRequest.set(req, escape);
      recordTelemetryEscape(ledger, escape);
    } catch {
      /* never throw into a test */
    }
  });
  context.on("requestfailed", (req) => {
    try {
      if (!isTelemetryHost(new URL(req.url()).hostname)) return;
      if (answered.has(req)) return;
      if (escapeByRequest.has(req)) return;
      const escape: TelemetryEscape = { url: req.url(), status: null, kind: "requestfailed" };
      escapeByRequest.set(req, escape);
      ledgerState(ledger).escapes.push(escape);
      // Defer the spill write one macrotask (β-F1): a 204 response
      // landing just after this event retracts the phantom above, and
      // the retraction cancels this write before it reaches the file.
      const timer = setTimeout(() => {
        spillTimers.delete(escape);
        if (ledgerState(ledger).escapes.includes(escape)) appendSpill(escape);
      }, 0);
      spillTimers.set(escape, timer);
    } catch {
      /* never throw into a test */
    }
  });
}

const ledgersByContext = new WeakMap<BrowserContext, TelemetryLedger>();
/** Effective `spoofCapableDevice` each context was served with (β-F5). */
const serveOptsByContext = new WeakMap<BrowserContext, boolean>();
/** Endpoint each context's collector pinned, if any (β-F6). */
const collectEndpointByContext = new WeakMap<BrowserContext, string>();

/**
 * Telemetry contract — stated once, here:
 * - Serve first: call serveBuiltArtifact before anything else registers
 *   routes on the context. It stubs every telemetry host with a recorded
 *   204 and returns the context's TelemetryLedger.
 * - Collectors register after and win dispatch: a spec that inspects
 *   telemetry calls collectTelemetry next; Playwright's
 *   later-registration-wins dispatch lets its exact-endpoint route claim
 *   the posts the shared handler would otherwise stub.
 * - Hand-rolled handlers call handleTelemetry(route, ledger) before any
 *   route.continue() — that is the only telemetry policy entry point.
 * - A stubbed surface may show "sent" copy (the stub answers 204, a
 *   successful send as far as the app can tell): assert on the ledger,
 *   not on the absence of that copy.
 */
export async function serveBuiltArtifact(
  context: BrowserContext,
  opts: { spoofCapableDevice?: boolean } = {},
): Promise<TelemetryLedger> {
  // Idempotent per context (G3) for the SAME effective opts: a second
  // call returns the existing ledger and registers nothing twice. A
  // second call with a DIFFERENT effective spoofCapableDevice throws
  // (β-F5) — silently ignoring it would test the opposite device.
  const effectiveSpoof = opts.spoofCapableDevice !== false;
  const existing = ledgersByContext.get(context);
  if (existing) {
    const servedSpoof = serveOptsByContext.get(context);
    if (servedSpoof !== effectiveSpoof) {
      throw new Error(
        `serveBuiltArtifact: context already served with spoofCapableDevice=${servedSpoof} — cannot re-serve with spoofCapableDevice=${effectiveSpoof}; the second call's device spoof would be silently ignored`,
      );
    }
    return existing;
  }
  const ledger = createTelemetryLedger();
  ledgersByContext.set(context, ledger);
  serveOptsByContext.set(context, effectiveSpoof);
  if (effectiveSpoof) {
    await spoofCapableDevice(context);
  }
  // Escape detection, once per context (see watchTelemetryEscapes).
  watchTelemetryEscapes(context, ledger);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "server.arcgisonline.com") {
      // Tile stub — VM-egress compensation, see the header comment.
      return route.fulfill({
        status: 200,
        body: TILE_STUB,
        contentType: "image/png",
      });
    }
    if (await handleTelemetry(route, ledger)) return;
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return route.continue();
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
    else if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (p.endsWith("/")) p += "_shell.html";
    // Clamp to the dist dir: a crafted pathname like /../../etc/passwd must
    // 403, not serve files outside the built artifact.
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST + path.sep) && file !== DIST) {
      return route.fulfill({ status: 403, body: "forbidden" });
    }
    try {
      const body = await readFile(file);
      const ext = path.extname(file).toLowerCase();
      return route.fulfill({
        status: 200,
        body,
        contentType: MIME[ext] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
  return ledger;
}

/**
 * Inspecting-spec collector: pins flags.json's `observabilityEndpoint`
 * (default TELEMETRY_ENDPOINT) and records posts to that exact endpoint
 * into the context's ledger via "collector", fulfilling 204. Register it
 * AFTER serveBuiltArtifact — Playwright's later-registration-wins
 * dispatch is what lets the collector claim the endpoint; this throws
 * when the context was not served first.
 */
export async function collectTelemetry(
  context: BrowserContext,
  opts: { flags?: Record<string, unknown>; endpoint?: string } = {},
): Promise<TelemetryLedger> {
  const ledger = ledgersByContext.get(context);
  if (!ledger) {
    throw new Error(
      "collectTelemetry: call serveBuiltArtifact(context) first — collectors must register after the shared handler to win dispatch",
    );
  }
  const endpoint = opts.endpoint ?? TELEMETRY_ENDPOINT;
  // Idempotent per context per endpoint (β-F6): a same-endpoint second
  // call is a no-op; a different endpoint throws instead of layering a
  // second live collector under the first one's label.
  const collected = collectEndpointByContext.get(context);
  if (collected !== undefined) {
    if (collected === endpoint) return ledger;
    throw new Error(
      `collectTelemetry: context already collects ${collected} — cannot also collect ${endpoint}; the first collector would keep recording under the second's configuration`,
    );
  }
  collectEndpointByContext.set(context, endpoint);
  await context.route("**/flags.json*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        flags: opts.flags ?? { learningOutcomes: true, pwaUpdateToast: true },
        observabilityEndpoint: endpoint,
      }),
    });
  });
  await context.route(endpoint, async (route) => {
    recordTelemetryRequest(ledger, route.request(), "collector");
    return fulfillTelemetryStub(route);
  });
  return ledger;
}

/**
 * Declarative guard (G2) for `test.afterEach`: asserts no telemetry
 * escaped the stub and — with `{ silent: true }`, for surfaces that must
 * never post — that the ledger stayed empty.
 *
 *   let tel: TelemetryLedger;
 *   test.beforeEach(async ({ context }) => { tel = await serveBuiltArtifact(context); });
 *   test.afterEach(telemetryGuard(() => tel));
 *
 * Advanced/unbound: the getter is not tied to any context, so a wrong
 * ledger passes vacuously (β-F7). Prefer `telemetryGuardFor(context)`,
 * which resolves the context's own ledger.
 */
export function telemetryGuard(
  getLedger: () => TelemetryLedger,
  opts: { silent?: boolean } = {},
): () => void {
  return () => {
    const ledger = getLedger();
    ledger.assertNoEscape();
    if (opts.silent) ledger.assertSilent();
  };
}

/**
 * Context-bound guard (β-F7): resolves the context's own ledger from
 * the serve registry and returns the `test.afterEach` callback for it.
 * Throws when the context was never served — there is no ledger to
 * assert on, and a silent pass would be a false proof.
 *
 *   test.afterEach(async ({ context }) => telemetryGuardFor(context)());
 */
export function telemetryGuardFor(
  context: BrowserContext,
  opts: { silent?: boolean } = {},
): () => void {
  const ledger = ledgersByContext.get(context);
  if (!ledger) {
    throw new Error(
      "telemetryGuardFor: context was never served — call serveBuiltArtifact(context) first",
    );
  }
  return telemetryGuard(() => ledger, opts);
}

/** Effectively disables the idle watchdog for tests that cover other behavior. */
export const NO_IDLE = 3_600_000;

/** Load the built app, start a globe run, wait for the aim phase + map.
 *  `idleMs` forwards `?idle-ms=` (see session.ts). It defaults to an hour:
 *  on the slow harness the map/chunk startup alone can outlast the real
 *  2-minute timeout, so only the idle-timeout specs opt into short values. */
export async function startGlobeRun(page: Page, idleMs: number = NO_IDLE): Promise<void> {
  const url =
    idleMs && idleMs > 0
      ? `http://127.0.0.1:4123/Meridian/?idle-ms=${idleMs}`
      : "http://127.0.0.1:4123/Meridian/";
  await page.goto(url);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // The map's zoomend handler writes Math.round(getZoom()) into data-zoom,
  // so the initial 1.5 settles to "2" once the first zoomend fires. Wait for
  // the value to stabilize rather than asserting an exact racy value. The
  // generous timeout/gap tolerate very slow software rendering where the
  // intro dive can take many seconds.
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

/**
 * The map's 15 s tile-load watchdog can fire on very slow machines (first
 * idle arrives after the budget), raising the full-screen "Couldn't load
 * satellite imagery" overlay. That overlay swallows map clicks, so before
 * any map interaction, dismiss it via its Retry button — exactly what a
 * user on a flaky connection would do. No-op when the overlay is absent.
 */
export async function dismissTileOverlayIfPresent(page: Page): Promise<void> {
  // WS-4 Phase 1 copy: the failure card offers one "Try again"; after that
  // retry the map switches to Scout Map and the card is gone for good.
  const overlay = page.getByText("The map pictures won't load right now");
  if (await overlay.isVisible()) {
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(overlay).toBeHidden({ timeout: 10_000 });
  }
}

export async function readPhase(page: Page, key: string = RUN_KEY): Promise<string | null> {
  return page.evaluate((k) => {
    const raw = sessionStorage.getItem(k);
    return raw ? (JSON.parse(raw) as { phase: string }).phase : null;
  }, key);
}

export async function readRun(page: Page): Promise<{
  phase: string; hits: number; index: number; placeId: string | null;
}> {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), RUN_KEY);
}

/** Number of MapLibre pin markers currently on the map. */
export const pinCount = (page: Page): Promise<number> =>
  page.locator(".maplibregl-marker").count();

/**
 * Cold Trail overlay seam: read the live GeoJSON features of a LoopMap
 * source via the `__loopMap` DOM seam.
 *
 * maplibre-gl 6.x made GeoJSONSource.getData() async — this awaits it
 * (calling it synchronously reads `.features` off the Promise, i.e.
 * undefined). `minFeatures` waits until the source holds at least that many
 * features, so assertions on freshly-painted overlays don't race React's
 * passive-effect paint: the repaint runs in useEffect, after the DOM commit
 * the test just observed.
 */
export async function sourceFeatures(
  page: Page,
  sourceId: string,
  minFeatures = 0,
): Promise<
  Array<{ properties: Record<string, unknown>; geometry: { coordinates: unknown } }>
> {
  type SeamSource = {
    getData: () => Promise<{
      features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: unknown } }>;
    }>;
  };
  type LoopMapEl = {
    __loopMap?: { getSource: (id: string) => SeamSource | undefined };
  };
  const sel = '[data-testid="loop-map"]';
  await page.waitForFunction(
    (args: { sel: string; id: string }) => {
      const el = document.querySelector(args.sel) as unknown as LoopMapEl;
      return !!el?.__loopMap?.getSource(args.id);
    },
    { sel, id: sourceId },
    { timeout: 30_000 },
  );
  if (minFeatures > 0) {
    await page.waitForFunction(
      async (args: { sel: string; id: string; min: number }) => {
        const el = document.querySelector(args.sel) as unknown as LoopMapEl;
        const src = el?.__loopMap?.getSource(args.id);
        if (!src) return false;
        const data = await src.getData();
        return data.features.length >= args.min;
      },
      { sel, id: sourceId, min: minFeatures },
      { timeout: 30_000 },
    );
  }
  return page.evaluate(
    async (args: { sel: string; id: string }) => {
      const el = document.querySelector(args.sel) as unknown as Required<LoopMapEl>;
      const src = el.__loopMap.getSource(args.id);
      const data = await src!.getData();
      return data.features;
    },
    { sel, id: sourceId },
  );
}

export const dropButton = (page: Page) =>
  page.getByRole("button", { name: "Drop pin and lock in your guess" });

export async function aimMarkerCenter(page: Page): Promise<{ x: number; y: number } | null> {
  const box = await page.getByLabel("Your pin").boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

export async function spotMarkerCenter(page: Page): Promise<{ x: number; y: number } | null> {
  const box = await page.getByLabel("The spot").boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

/**
 * Screen point of Oia (deterministic first globe target: lon 25.376, lat
 * 36.461) at the initial camera (center [0,0], zoom 1.5). Computed with the
 * app's own MapLibre GlobeTransform projection (maplibre-gl, same version
 * as the bundle): project2.mjs in the QA work dir. Sanity-checked: the
 * viewport center projects to (0,0) exactly, and projecting back is the
 * transform's own inverse.
 */
export const OIA_DESKTOP = { x: 795.9, y: 319.1 }; // 1440x900
export const OIA_MOBILE = { x: 270.7, y: 291.5 }; // 390x844

/** The tap point IS the answer: no lift, no pre-compensation. */

export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
  });
}

export async function focusedRole(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("role"));
}

/** Press Tab until `done()` is true (or maxPresses hit); returns focused name. */
export async function tabUntil(
  page: Page,
  done: () => Promise<boolean>,
  maxPresses = 8,
): Promise<string> {
  for (let i = 0; i < maxPresses; i++) {
    if (await done()) break;
    await page.keyboard.press("Tab");
  }
  return focusedName(page);
}

/**
 * Pin the puzzle calendar to 2026-09-29 (UTC) for Oia-dependent scenarios.
 *
 * The globe place order is date-shuffled (orderPlaces in trail.ts), so the
 * first globe place rotates daily — the OIA_* tap points only land a hit
 * when Oia is the day's first place (true on 2026-09-29). This installs an
 * init script that freezes the page's Date (no-arg construction and
 * Date.now()) to that day. Timers, requestAnimationFrame, and
 * performance.now() are untouched, so animations and timeouts behave
 * normally. Production date logic is unit-tested (daily/trail tests); the
 * freeze only makes the E2E puzzle deterministic.
 *
 * MUST be called before startGlobeRun — addInitScript only affects
 * navigations that happen after it is installed.
 */
export async function freezeOiaPuzzle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const FIXED = Date.UTC(2026, 8, 29, 12, 0, 0);
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args: never[]) {
        if (args.length === 0) {
          super(FIXED);
        } else {
          super(...(args as unknown as ConstructorParameters<DateConstructor>));
        }
      }
      static now(): number {
        return FIXED;
      }
    }
    window.Date = FrozenDate as unknown as DateConstructor;
  });
}

export async function evidencePath(name: string): Promise<string> {  await mkdir(EVIDENCE, { recursive: true });
  return `${EVIDENCE}/${name}`;
}

/**
 * Perceptual diff of two PNG screenshots, computed in-page (no new npm
 * packages). Returns the fraction of pixels whose summed RGB delta exceeds
 * the threshold.
 */
export async function screenshotDiffRatio(
  page: Page,
  aPath: string,
  bPath: string,
): Promise<{ ratio: number; width: number; height: number }> {
  const [a, b] = await Promise.all([readFile(aPath), readFile(bPath)]);
  return page.evaluate(
    async ({ a64, b64 }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a64), load(b64)]);
      const w = Math.min(ia.naturalWidth, ib.naturalWidth);
      const h = Math.min(ia.naturalHeight, ib.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(ia, 0, 0, w, h);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.drawImage(ib, 0, 0, w, h);
      const db = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d =
          Math.abs(da[i] - db[i]) +
          Math.abs(da[i + 1] - db[i + 1]) +
          Math.abs(da[i + 2] - db[i + 2]);
        if (d > 48) diff++;
      }
      return { ratio: diff / (w * h), width: w, height: h };
    },
    {
      a64: `data:image/png;base64,${a.toString("base64")}`,
      b64: `data:image/png;base64,${b.toString("base64")}`,
    },
  );
}

/**
 * Shared commit helpers for the reveal specs (moved here from
 * gap-view-reveal.desktop.spec.ts so the hit-path specs share one
 * implementation instead of drifting copies).
 */

/** Commit a pin at (x, y); resolves with the landed phase and commit time. */
export async function commitPin(
  page: Page,
  x: number,
  y: number,
  key: string = RUN_KEY,
): Promise<{ phase: string | null; committedAt: number }> {
  // The tile watchdog can fire on slow/flaky networks, and the reveal only
  // plays over healthy tiles (tile failure shows the card at once). The
  // overlay + Retry button is the designed UX for this, so retry the load
  // the way a user on a flaky connection would: up to 3 attempts before
  // treating it as a real failure. This tolerates the VM's flaky tile
  // network without masking a production regression — a genuinely broken
  // tile pipeline still fails the test after the retries are exhausted.
  const map = page.locator(".satellite-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    try {
      // Also wait for the intro spin+narrow beat to finish (aria-hidden lifts
      // with inert + tap-handlers attachment): low-zoom spin tiles can mark
      // data-tile-status="ready" before rearm-tiles resets it for narrow-in.
      await expect
        .poll(
          async () =>
            (await map.getAttribute("data-tile-status")) === "ready" &&
            (await map.getAttribute("aria-hidden")) !== "true",
          { timeout: 30_000 },
        )
        .toBe(true);
      break;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  await page.mouse.click(x, y);
  await expect(dropButton(page)).toBeEnabled();
  await dropButton(page).click();
  const committedAt = Date.now();
  // Capture the phase inside the poll: a separate readPhase after the poll
  // can race the transition it just observed.
  let phase: string | null = null;
  await expect
    .poll(
      async () => {
        phase = await readPhase(page, key);
        return phase;
      },
      { timeout: 20_000 },
    )
    .toMatch(/^(story|done)$/);
  return { phase, committedAt };
}

/** Viewport coords of the current place's true spot, or null when the spot
 *  is unknown. Uses the app's own live projection (no luck involved).
 *  Rounded to integers: Playwright's synthetic mouse with fractional
 *  coordinates does not reliably trip the app's pointer tap classifier
 *  (observed in this harness; physical-device verification remains open). */
export async function spotViewportPoint(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  return page.locator(".satellite-map").evaluate((el) => {
    const hook = (
      el as unknown as {
        __spotScreen?: () => { x: number; y: number } | null;
      }
    ).__spotScreen;
    const s = hook?.();
    if (!s) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
  });
}

/** True when a tap at (x, y) would hit the map canvas (not chrome like the
 *  question bubble floating over it). Waits out the transient tile-loading
 *  pill first — a tap point projected under it flaps otherwise. */
export async function tapHitsMap(
  page: Page,
  x: number,
  y: number,
): Promise<boolean> {
  await page
    .getByText("Loading satellite imagery")
    .waitFor({ state: "hidden", timeout: 30_000 });
  return page.evaluate(
    ({ px, py }) => {
      const el = document.elementFromPoint(px, py);
      return !!el?.closest?.(".satellite-map");
    },
    { px: x, py: y },
  );
}

export const nextPlaceButton = (page: Page) =>
  page.getByRole("button", { name: "Next place" });

/** The result card is a scrollable sheet (max-h-45dvh); pre-scroll the
 *  button with instant behavior because Chromium's scrollIntoViewIfNeeded
 *  (which Playwright's click uses) is pathologically slow inside this
 *  MapLibre layout. Real users scroll the sheet by touch/wheel, so this
 *  masks no production behavior. */
export async function clickNextPlace(page: Page): Promise<void> {
  const btn = nextPlaceButton(page);
  await expect(btn).toBeVisible({ timeout: 10_000 });
  // A genuine first win (e.g. commitMiss's rare lucky hit) raises the
  // first-win celebration overlay, which intercepts the Next place
  // click until the player closes it (no auto-timer by design). Close
  // it the way a player would; the celebration itself is unchanged.
  const celebration = page.getByTestId("celebration-overlay");
  if (await celebration.count()) {
    await celebration.getByRole("button", { name: "Close celebration" }).click();
    await expect(celebration).toHaveCount(0, { timeout: 10_000 });
  }
  await btn.evaluate((el) =>
    el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
  );
  await btn.click();
}

export const resultCard = (page: Page) =>
  page.getByRole("region", { name: "Result" });

/**
 * Commit a guaranteed miss: tap (500, 400); on the ~1% chance it lands
 * inside the 750 km hit radius, advance and retry.
 */
export async function commitMiss(
  page: Page,
  key: string = RUN_KEY,
): Promise<{ committedAt: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { phase, committedAt } = await commitPin(page, 500, 400, key);
    if (phase === "done") return { committedAt };
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page, key), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMiss: (500, 400) hit three places in a row");
}

/** How long the projected spot must hold still to count as settled. */
const SPOT_SETTLE_MS = 600;

/**
 * Viewport coords of the current place's true spot, read only once the
 * camera has come to rest: the intro beat is done (aria-hidden lifted)
 * and the spot's live projection is unchanged on every animation frame
 * for SPOT_SETTLE_MS. Fix round 4 (discarded-notice 1H(1) flake): reading
 * the spot right after the phase flips to "aim" sampled a camera still in
 * the previous place's return beat (data-zoom 8 → 7 at Nebraska), so the
 * tap landed hundreds of px from the true spot, missed, and ten burned
 * places exhausted commitHit. Null when the hook reports no spot.
 */
export async function settledSpotViewportPoint(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("aria-hidden"), {
      timeout: 30_000,
    })
    .not.toBe("true");
  const settled = await page.locator(".satellite-map").evaluate(
    (el, settleMs) =>
      new Promise<{ x: number; y: number } | null>((resolve, reject) => {
        const hook = (
          el as unknown as { __spotScreen?: () => { x: number; y: number } | null }
        ).__spotScreen;
        if (typeof hook !== "function") {
          resolve(null);
          return;
        }
        const t0 = performance.now();
        let last: { x: number; y: number } | null = null;
        let stillSince = t0;
        const tick = () => {
          const now = performance.now();
          const s = hook();
          const same =
            !!s && !!last && Math.abs(s.x - last.x) < 0.5 && Math.abs(s.y - last.y) < 0.5;
          if (!same) stillSince = now;
          last = s;
          if (s && now - stillSince >= settleMs) {
            const r = el.getBoundingClientRect();
            resolve({ x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) });
            return;
          }
          if (now - t0 > 20_000) {
            reject(new Error(`spot never settled for ${settleMs} ms in 20 s; last=${JSON.stringify(s)}`));
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    SPOT_SETTLE_MS,
  );
  return settled;
}

/**
 * Commit a guaranteed hit: tap the true spot's exact screen point, read
 * once the camera has settled. When the spot is on the far side of the
 * globe (or under chrome), burn the place with a miss and advance.
 */
export async function commitHit(
  page: Page,
): Promise<{ committedAt: number }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const spot = await settledSpotViewportPoint(page);
    const inView =
      spot &&
      spot.x >= 0 &&
      spot.x <= 1440 &&
      spot.y >= 0 &&
      spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      const { phase, committedAt } = await commitPin(page, spot.x, spot.y);
      if (phase === "story") return { committedAt };
      // Tapped the projected spot but missed: the spot is on the globe's
      // far side (project() returns a viewport point even for occluded
      // locations). Burn this place and try the next.
    } else {
      // Spot not tappable: burn this place with a miss, move on.
      await commitMiss(page);
    }
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitHit: no tappable spot in 10 attempts");
}

// ---------------------------------------------------------------------------
// Deal-forcing + admin-1 chunk helpers (moved from
// reveal-your-pin-country-globe.desktop.spec.ts so the admin1-narrow specs
// can share them).
// ---------------------------------------------------------------------------

/** Seen-store key prefix for forcing deals (…:<edition>:<regionId>:<band>). */
export const SEEN_PREFIX = "meridian:seen:v2:";

/** App URL with the idle watchdog effectively disabled (long E2E runs). */
export const APP_NO_IDLE = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

/** All place ids in the built chunk for a region. */
export function chunkIds(regionId: string): string[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string }[] };
  return d.places.map((p) => p.id);
}

/** Curated starter ids for one edition+region (id = `${regionId}-${slug}`). */
export function curatedIds(edition: string, regionId: string): string[] {
  const src = readFileSync("src/game/starters.ts", "utf8");
  const out: string[] = [];
  const re =
    /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) out.push(`${m[2]}-${m[3]}`);
  }
  return out;
}

/** Full dealing-pool ids (curated + chunk) for forcing a deal. */
export function poolIds(edition: string, regionId: string): string[] {
  return [...curatedIds(edition, regionId), ...chunkIds(regionId)];
}

/** Mark every pool place seen except the target, so it is dealt first. */
export async function seedSeenExcept(
  page: Page,
  edition: string,
  regionId: string,
  keepId: string,
  allIds: string[],
  band: "easy" | "medium" | "hard" = "medium",
): Promise<void> {
  const key = `${SEEN_PREFIX}${edition}:${regionId}:${band}`;
  const seen = allIds.filter((id) => id !== keepId);
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  expect(allIds, `target ${keepId} must be in the pool`).toContain(keepId);
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

/** Fresh boot that cannot restore a previous run from sessionStorage. */
export async function freshBoot(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear()).catch(() => {});
  await page.goto(APP_NO_IDLE);
}

/** Pick a difficulty band in the picker ("How do you want to grow your map today?"). */
export async function pickBand(page: Page, band: "Easy" | "Medium" | "Hard"): Promise<void> {
  await page
    .getByRole("group", { name: "How do you want to grow your map today?" })
    .getByRole("button", { name: band })
    .click();
}

/** Start a country-edition run and wait for the aim phase. */
export async function startCountryRun(page: Page, country: string): Promise<void> {
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await page.getByRole("button", { name: country }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** Current question from the aim live region ("Find X."). */
export async function readQuestion(page: Page): Promise<string> {
  const live = page.locator('p.sr-only[aria-live="polite"]');
  await expect(live).toContainText(/^Find .+\.$/, { timeout: 15_000 });
  return ((await live.textContent()) ?? "").trim();
}

/**
 * Wait until the truth's screen point stops moving between reads: the
 * camera (including the globe intro dive) has settled. Returns the settled
 * point.
 */
export async function waitForSpotSettle(page: Page): Promise<{ x: number; y: number }> {
  let settled: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        const a = await spotViewportPoint(page);
        if (!a) return null;
        await page.waitForTimeout(800);
        const b = await spotViewportPoint(page);
        if (!b) return null;
        if (a.x === b.x && a.y === b.y) {
          settled = b;
          return `${b.x},${b.y}`;
        }
        return null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return settled!;
}

/**
 * Wait until the admin-1 chunk for `iso2` has been fetched — i.e. the 10 s
 * warm tick fired `preloadAdmin1ForCountry`. Condition-based (resource
 * timing), never a fixed sleep: chunks are emitted as
 * /Meridian/assets/<iso2>-<hash>.js.
 */
export async function waitForAdmin1Chunk(page: Page, iso2: string): Promise<void> {
  await expect
    .poll(
      async () => {
        return await page.evaluate((code: string) => {
          const entries = performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[];
          const re = new RegExp(`/assets/${code}-[A-Za-z0-9_-]+\\.js$`);
          return entries.some((e) => re.test(e.name));
        }, iso2);
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

/**
 * Audio probe for the storyteller tap-to-start verification (fix PR
 * "Storyteller tap-to-start + visible mute state + gesture-flag reset",
 * 2026-10-10).
 *
 * The storyteller hosts construct `new Audio(url)` internally and keep the
 * element in a ref — there is no DOM <audio> to query. This installs (before
 * any page script) a window.Audio wrapper that records every constructed
 * element in `window.__audioProbe`, and disables service-worker
 * registration so mp3 requests stay visible to route interception (the SW
 * precaches mp3s and serves them cache-first, hiding the request).
 *
 * `readAudioProbe(page)` returns the most recently constructed element's
 * live media state — `paused === false` plus an advancing `currentTime` is
 * the black-box proof that narration is REALLY playing, not just React
 * state claiming it is.
 */
export interface AudioProbeState {
  /** Number of Audio elements constructed so far. */
  count: number;
  /** `src` passed to the most recent constructor. */
  src: string;
  /** Live `paused` of the most recent element (false = playing). */
  paused: boolean;
  /** Live `currentTime` of the most recent element. */
  currentTime: number;
  /** Live `readyState` of the most recent element (≥2 = has data). */
  readyState: number;
}

export async function installAudioProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      if ("serviceWorker" in navigator) {
        const container = navigator.serviceWorker as unknown as Record<
          string,
          unknown
        >;
        container.register = () =>
          Promise.reject(new Error("service worker disabled for test"));
      }
    } catch {
      /* private mode — ignore */
    }
    const w = window as unknown as {
      __audioProbe: HTMLAudioElement[];
      Audio: typeof Audio;
    };
    const seen: HTMLAudioElement[] = [];
    w.__audioProbe = seen;
    const NativeAudio = window.Audio;
    // `new Audio(src)`: returning an object from the constructor makes `new`
    // yield that object, so the app keeps working with a real element.
    function ProbedAudio(this: unknown, src?: string): HTMLAudioElement {
      const el = new NativeAudio(src);
      (el as unknown as { __probeSrc: string }).__probeSrc = src ?? "";
      seen.push(el);
      return el;
    }
    ProbedAudio.prototype = NativeAudio.prototype;
    w.Audio = ProbedAudio as unknown as typeof Audio;
  });
}

export async function readAudioProbe(page: Page): Promise<AudioProbeState | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __audioProbe?: Array<HTMLAudioElement & { __probeSrc?: string }>;
    };
    const seen = w.__audioProbe;
    if (!seen || seen.length === 0) return null;
    const el = seen[seen.length - 1]!;
    return {
      count: seen.length,
      src: el.__probeSrc ?? "",
      paused: el.paused,
      currentTime: el.currentTime,
      readyState: el.readyState,
    };
  });
}

/**
 * Pass the arithmetic GrownUpGate (src/components/age-profile/GrownUpGate.tsx)
 * the way a grown-up would: read "What is A × B?", type the product, and
 * press Check answer. It is used wherever the gate guards an exit, such as
 * the Ko-fi donation link (review P6) and /contact.
 */
export async function passGrownUpGate(page: Page): Promise<void> {
  const gate = page.getByTestId("grownup-gate");
  await expect(gate).toBeVisible();
  const question = await gate.locator(".agep-question").textContent();
  const m = question?.match(/What is (\d+) × (\d+)\?/);
  expect(m, `unexpected gate question: ${question}`).not.toBeNull();
  const answer = String(Number(m![1]) * Number(m![2]));
  for (const d of answer) await gate.getByRole("button", { name: `Digit ${d}`, exact: true }).click();
  await gate.getByTestId("gate-check").click();
  await expect(gate).toBeHidden();
}
