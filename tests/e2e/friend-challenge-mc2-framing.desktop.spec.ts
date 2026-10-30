import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
import { readFile } from "node:fs/promises";
import {
  serveBuiltArtifact,
  readPhase,
  MC2_RUN_KEY,
  RUN_KEY,
} from "./helpers";
import {
  readMapMode,
  readStoredMapMode,
  seedManualMode,
} from "./scout-helpers";
import { encodeChallenge2 } from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * Challenge framing + map-mode E2E (owner reports, 2026-10-29).
 *
 * Defect 1 — a received challenge did not frame or outline its region:
 * the challenge run's regionName is the DISPLAY string "<Region>
 * challenge", and the map resolves its highlight geometry BY NAME, so
 * the lookup missed and the painter drew an empty polygon. Play shows
 * the gold region outline and announces "<Region> view"; a challenge
 * showed neither. These tests pin Play parity for State and Country
 * challenges on the full map AND in Scout (Scout shares the map
 * component and the highlight painter; its missing admin-1 BAND is a
 * separate, owner-accepted trade and is not asserted here).
 *
 * Defect 2 — the in-run map-mode toggle forced home and killed the
 * challenge (and deleted the player's preserved normal run). The map
 * is now picked AT CHALLENGE OPEN: the welcome card shows the resolved
 * mode (stored manual record wins; otherwise the boot capability
 * qualification — no new probe) and lets the player flip it before
 * Start. Inside a challenge run the toggle explains itself and offers
 * no switch; the force-home path cannot fire.
 *
 * Measurement surfaces are production-observable (the highlight
 * spec's): `.satellite-map[data-zoom]`, `[data-map-mode]`, the
 * aria-live "<Region> view" announcement, and bright-gold pixel
 * sampling of the settled map.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const GOLD_MIN = 1000;

const NEBRASKA_IDS = [
  "gn-5072006", // Lincoln
  "gn-5074472", // Omaha
  "gn-5063805", // Bellevue
  "gn-5068725", // Fremont
  "gn-5069297", // Grand Island
] as const;
const NEBRASKA_HASH = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

const UK_IDS = [
  "gn-2633352", // York
  "gn-2633521", // Worthing
  "gn-2633563", // Worcester
  "gn-2633691", // Wolverhampton
  "gn-2633709", // Woking
] as const;
const UK_HASH = encodeChallenge2(
  { edition: "country", regionId: "united-kingdom", radiusKm: 147, ids: UK_IDS },
  SCORING_VERSION,
);

const GLOBE_IDS = [
  "gn-53654", // Mogadishu
  "gn-54225", // Marka
  "gn-55671", // Kismayo
  "gn-57289", // Hargeysa
  "gn-60149", // El Dibir
] as const;
const GLOBE_HASH = encodeChallenge2(
  { edition: "globe", regionId: "globe", radiusKm: 750, ids: GLOBE_IDS },
  SCORING_VERSION,
);

async function routeFlags(
  context: BrowserContext,
  flags: Record<string, boolean>,
): Promise<void> {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, ...flags },
      }),
    });
  });
}

const mapEl = (page: Page) => page.locator(".satellite-map");
const liveRegion = (page: Page) =>
  page.locator('.satellite-map > [aria-live="polite"]');
const readZoom = async (page: Page): Promise<number> =>
  Number(await mapEl(page).getAttribute("data-zoom"));
const readAnnouncement = async (page: Page): Promise<string> =>
  (await liveRegion(page).textContent())?.trim() ?? "";
const introActive = async (page: Page): Promise<boolean> =>
  (await mapEl(page).getAttribute("aria-hidden")) === "true";

/** Wait for the intro narrow to finish and the camera to stabilize. */
async function waitSettled(page: Page): Promise<void> {
  await expect(mapEl(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => introActive(page), { timeout: 60_000 }).toBe(false);
  await expect
    .poll(
      async () => {
        const a = await readZoom(page);
        await page.waitForTimeout(600);
        return a === (await readZoom(page)) ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

/** Bright-gold pixel count in a screenshot of the settled map (the
 *  highlight spec's gate: admits the 4.5 px gold outline #f2c14e,
 *  rejects the dim fill, casing, starfield, and Scout land). */
async function countGoldPixels(page: Page, pngPath: string): Promise<number> {
  const buf = await readFile(pngPath);
  return page.evaluate(async (b64) => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = b64;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let gold = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= 180 && g >= 120 && b <= 150 && r - b >= 60) gold++;
    }
    return gold;
  }, `data:image/png;base64,${buf.toString("base64")}`);
}

async function measureMap(
  page: Page,
  shotPath: string,
): Promise<{ announcement: string; zoom: number; gold: number }> {
  // The camera settling (data-zoom stable) does not mean the style has
  // rendered: on this VM the Scout GeoJSON landmass + outline can land
  // seconds after the zoom stops. Poll the actual pixels until the
  // outline is on screen (or the budget runs out — a map that never
  // paints its outline fails here with gold at its true value).
  let gold = 0;
  const deadline = Date.now() + 30_000;
  for (;;) {
    await page.screenshot({ path: shotPath });
    gold = await countGoldPixels(page, shotPath);
    if (gold > GOLD_MIN || Date.now() > deadline) break;
    await page.waitForTimeout(1000);
  }
  const m = {
    announcement: await readAnnouncement(page),
    zoom: await readZoom(page),
    gold,
  };
  console.log(`MEASURE ${JSON.stringify(m)}`);
  return m;
}

/** Normal Play path: picker drill-down into a US state run. */
async function startPlayState(page: Page, region: string): Promise<void> {
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await expect(
    page.getByRole("button", { name: "Choose a state" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Choose a state" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(
    page.getByRole("heading", { name: "United States" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: region }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await waitSettled(page);
}

/** Challenge path: open the link, land on the welcome card. */
async function openChallenge(page: Page, hash: string): Promise<void> {
  await page.goto(`${APP_URL}?idle-ms=3600000${hash}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({
    timeout: 30_000,
  });
}

async function startChallenge(page: Page): Promise<void> {
  await page.getByTestId("challenge-start").click();
  await expect
    .poll(() => readPhase(page, MC2_RUN_KEY), { timeout: 30_000 })
    .toBe("aim");
  await waitSettled(page);
}

test.beforeEach(async ({ context }) => {
  await routeFlags(context, { friendChallenges: true });
});

// ---------------------------------------------------------------------
// Defect 1 — framing + outline parity with Play
// ---------------------------------------------------------------------

test("control: Play Nebraska (full map) frames and outlines the state", async ({
  context,
}, testInfo) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await startPlayState(page, "Nebraska");
  const m = await measureMap(page, testInfo.outputPath("play-nebraska.png"));
  expect(m.announcement).toBe("Nebraska view");
  expect(m.gold).toBeGreaterThan(GOLD_MIN);
  expect(m.zoom).toBeGreaterThanOrEqual(4);
  await page.close();
});

test("challenge Nebraska (full map): same framing and outline as Play", async ({
  context,
}, testInfo) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await startChallenge(page);
  expect(await readMapMode(page)).toBe("full");
  const m = await measureMap(
    page,
    testInfo.outputPath("challenge-nebraska-full.png"),
  );
  expect(m.announcement).toBe("Nebraska view");
  expect(m.gold).toBeGreaterThan(GOLD_MIN);
  expect(m.zoom).toBeGreaterThanOrEqual(4);
  await page.close();
});

test("control: Play Nebraska (Scout) outlines the state", async ({
  context,
}, testInfo) => {
  await serveBuiltArtifact(context);
  await seedManualMode(context, "scout");
  const page = await context.newPage();
  await startPlayState(page, "Nebraska");
  expect(await readMapMode(page)).toBe("scout");
  const m = await measureMap(page, testInfo.outputPath("play-nebraska-scout.png"));
  expect(m.announcement).toBe("Nebraska view");
  expect(m.gold).toBeGreaterThan(GOLD_MIN);
  await page.close();
});

test("challenge Nebraska (Scout): framed and outlined in Scout too", async ({
  context,
}, testInfo) => {
  await serveBuiltArtifact(context);
  await seedManualMode(context, "scout");
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await startChallenge(page);
  expect(await readMapMode(page)).toBe("scout");
  const m = await measureMap(
    page,
    testInfo.outputPath("challenge-nebraska-scout.png"),
  );
  expect(m.announcement).toBe("Nebraska view");
  expect(m.gold).toBeGreaterThan(GOLD_MIN);
  expect(m.zoom).toBeGreaterThanOrEqual(3);
  await page.close();
});

test("challenge United Kingdom (country, full map): frames and outlines", async ({
  context,
}, testInfo) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await openChallenge(page, UK_HASH);
  await startChallenge(page);
  const m = await measureMap(page, testInfo.outputPath("challenge-uk.png"));
  expect(m.announcement).toBe("United Kingdom view");
  expect(m.gold).toBeGreaterThan(GOLD_MIN);
  expect(m.zoom).toBeGreaterThanOrEqual(3);
  await page.close();
});

test("challenge Globe (mc2): starts clean (regression guard)", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await openChallenge(page, GLOBE_HASH);
  await startChallenge(page);
  // The globe has no single region to outline — the guard is that the
  // run starts and aims exactly as before the fix.
  expect(await readPhase(page, MC2_RUN_KEY)).toBe("aim");
  await page.close();
});

// ---------------------------------------------------------------------
// Defect 2 — map selection at challenge open; no force-home in a run
// ---------------------------------------------------------------------

const welcomeSwitch = (page: Page) =>
  page.getByTestId("challenge-welcome-map-switch");
const welcomeMode = (page: Page) =>
  page.getByTestId("challenge-welcome-map-mode");

test("welcome card: weak device auto-selects Scout; flipping before Start builds the full map", async ({
  context,
}) => {
  // No capability spoof: the VM's genuine signals (SwiftShader probe)
  // qualify as a weak device — the same boot qualification as always.
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "scout");
  await expect(welcomeSwitch(page)).toHaveAttribute("aria-checked", "true");
  // The boot auto-select persisted an AUTO record (decays, not manual).
  expect(await readStoredMapMode(page)).toMatchObject({ mode: "scout" });
  expect((await readStoredMapMode(page))?.source).not.toBe("manual");

  await welcomeSwitch(page).click();
  await expect(welcomeSwitch(page)).toHaveAttribute("aria-checked", "false");
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "full");
  // The flip only STAGES the pick: the stored record is still the
  // boot's auto record — declining now would commit nothing.
  const staged = await readStoredMapMode(page);
  expect(staged).toMatchObject({ mode: "scout" });
  expect(staged?.source).not.toBe("manual");

  await startChallenge(page);
  // Start commits the staged pick as a manual record (the Home
  // toggle's semantics), and the run builds on the full map.
  await expect
    .poll(() => readStoredMapMode(page), { timeout: 10_000 })
    .toMatchObject({ mode: "full", source: "manual" });
  expect(await readMapMode(page)).toBe("full");
  await page.close();
});

test("welcome card: flipping then declining commits nothing", async ({
  context,
}) => {
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "scout");
  await welcomeSwitch(page).click();
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "full");
  await page.getByTestId("challenge-not-now").click();
  await expect(page.getByTestId("challenge-welcome")).toHaveCount(0);
  // The staged pick died with the card: the boot's own record stands,
  // no manual record was ever written.
  const afterDecline = await readStoredMapMode(page);
  expect(afterDecline).toMatchObject({ mode: "scout" });
  expect(afterDecline?.source).not.toBe("manual");
  await page.close();
});

test("welcome card: capable device defaults to the full map", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "full");
  await expect(welcomeSwitch(page)).toHaveAttribute("aria-checked", "false");
  await startChallenge(page);
  expect(await readMapMode(page)).toBe("full");
  await page.close();
});

test("welcome card: a stored manual Scout record wins on a capable device", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  await seedManualMode(context, "scout");
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "scout");
  await expect(welcomeSwitch(page)).toHaveAttribute("aria-checked", "true");
  await page.close();
});

test("welcome card: a stored manual Full record wins on a weak device", async ({
  context,
}) => {
  await serveBuiltArtifact(context, { spoofCapableDevice: false });
  await seedManualMode(context, "full");
  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(welcomeMode(page)).toHaveAttribute("data-mode", "full");
  await expect(welcomeSwitch(page)).toHaveAttribute("aria-checked", "false");
  await page.close();
});

test("in-challenge map toggle: explains, offers no switch, never forces home", async ({
  context,
}) => {
  await serveBuiltArtifact(context);
  // A normal run in progress first — it is the record the challenge
  // promises to preserve underneath (manifest C6). Captured from a
  // real Play run and seeded pre-boot, the shipped boot spec's
  // pattern (friend-challenge-mc2-boot.desktop.spec.ts).
  const scratch = await context.newPage();
  await startPlayState(scratch, "Nebraska");
  // Control, same component: in a NORMAL run the map popover DOES
  // offer a switch — so its absence inside the challenge (asserted
  // below) is the challenge context at work, not an inert popover.
  await scratch.getByTestId("map-mode-button").click();
  await expect(scratch.getByTestId("map-mode-popover")).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    scratch.getByTestId("map-mode-popover").getByRole("switch"),
  ).toHaveCount(1);
  await scratch.getByTestId("map-mode-button").click();
  const normalRunBefore = await scratch.evaluate(
    (k) => sessionStorage.getItem(k),
    RUN_KEY,
  );
  expect(normalRunBefore).not.toBeNull();
  await scratch.close();
  await context.addInitScript((json: string) => {
    sessionStorage.setItem("meridian.run", json);
    sessionStorage.setItem("meridian.cleanExit", "1");
  }, normalRunBefore as string);

  const page = await context.newPage();
  await openChallenge(page, NEBRASKA_HASH);
  await expect(page.getByTestId("challenge-welcome")).toContainText(
    "Your game in progress is saved",
  );
  await startChallenge(page);

  // Open the map-mode popover mid-challenge.
  await page.getByTestId("map-mode-button").click();
  await expect(page.getByTestId("map-mode-popover")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("map-mode-challenge-note")).toBeVisible();
  // No switch is offered — there is nothing in the popover that can
  // end the challenge.
  await expect(
    page.getByTestId("map-mode-popover").getByRole("switch"),
  ).toHaveCount(0);

  // The challenge is still live and the preserved run is untouched —
  // byte for byte (the old toggle deleted this record outright).
  expect(await readPhase(page, MC2_RUN_KEY)).toBe("aim");
  const normalRunAfter = await page.evaluate(
    (k) => sessionStorage.getItem(k),
    RUN_KEY,
  );
  expect(normalRunAfter).toBe(normalRunBefore);
  await expect(
    page.getByRole("button", { name: "Play the globe" }),
  ).toHaveCount(0);
  await page.close();
});
