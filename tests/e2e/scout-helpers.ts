/**
 * Shared helpers for the Scout Map E2E specs (PBI-9 + Phase A UX contracts).
 *
 * DOM/STORAGE CONTRACTS the specs assert (dev must implement to these):
 *  - localStorage `meridian:map-mode` holds a single JSON record:
 *      { mode: "full"|"scout", manual: boolean, offer?: boolean,
 *        assignedBy?: "crash-flag"|"probe"|"memory", assignedAt?: number }
 *  - boot offer modal: data-testid="scout-boot-offer"
 *  - settings toggle: data-testid="map-mode-button", in the Play top bar,
 *    NOT inside .satellite-map
 *  - switch note: role="status", classes "fixed inset-x-4 top-16",
 *    sibling of the ResultCard, visible only in story phase after reveal
 *  - map wrapper: data-map-mode="full"|"scout" (proposed), data-zoom,
 *    data-max-zoom (proposed)
 *
 * If the dev's contracts differ, these specs (QA-owned) adapt — the
 * BEHAVIORS they assert are the contract.
 */
import type { BrowserContext, Page } from "playwright/test";

export const APP_URL = "http://127.0.0.1:4123/Meridian/";
export const MAP_MODE_KEY = "meridian:map-mode";

export interface StoredMapMode {
  mode: "full" | "scout";
  manual: boolean;
  offer?: boolean;
  assignedBy?: "crash-flag" | "probe" | "memory";
  assignedAt?: number;
}

/** Seed a map-attributed prior-crash offer record BEFORE the app boots. */
export async function seedCrashOffer(
  context: BrowserContext,
  assignedAt: number = Date.now(),
): Promise<void> {
  const rec: StoredMapMode = {
    mode: "scout",
    manual: false,
    offer: true,
    assignedBy: "crash-flag",
    assignedAt,
  };
  await context.addInitScript((record: StoredMapMode) => {
    localStorage.setItem("meridian:map-mode", JSON.stringify(record));
  }, rec);
}

/** Seed a manual override record BEFORE the app boots. */
export async function seedManualMode(
  context: BrowserContext,
  mode: "full" | "scout",
): Promise<void> {
  await context.addInitScript((m: "full" | "scout") => {
    localStorage.setItem(
      "meridian:map-mode",
      JSON.stringify({ mode: m, manual: true }),
    );
  }, mode);
}

export async function readStoredMapMode(page: Page): Promise<StoredMapMode | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), MAP_MODE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMapMode;
  } catch {
    return null;
  }
}

/**
 * Spoof a CAPABLE device (false-demotion golden): discrete-GPU renderer
 * string, 8 GB deviceMemory. The VM's real Chromium reports a SwiftShader
 * renderer, so without this the harness itself reads as a weak device.
 * Must be installed via context.addInitScript BEFORE navigation.
 */
export async function spoofCapableDevice(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
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
      get: () => 8,
      configurable: true,
    });
  });
}

/** The offer modal locator per the Phase A contract. */
export const offerModal = (page: Page) =>
  page.getByTestId("scout-boot-offer");

/** The settings toggle locator per the Phase A contract. */
export const mapModeButton = (page: Page) =>
  page.getByTestId("map-mode-button");

/** The mid-game switch note per the Phase A contract. */
export const switchNote = (page: Page) => page.getByRole("status");

/** The map wrapper; data-map-mode carries the active mode (proposed). */
export const mapWrapper = (page: Page) => page.locator(".satellite-map");

export async function readMapMode(page: Page): Promise<string | null> {
  return mapWrapper(page).getAttribute("data-map-mode");
}

/** True when (x2,y2) is fully outside rect (x1,y1,w1,h1). */
export function rectsDisjoint(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    b.x >= a.x + a.width ||
    b.x + b.width <= a.x ||
    b.y >= a.y + a.height ||
    b.y + b.height <= a.y
  );
}
