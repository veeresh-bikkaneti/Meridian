import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  commitMiss,
  commitPin,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  readPhase,
  readQuestion,
  resultCard,
  tapHitsMap,
  waitForSpotSettle,
  RUN_KEY,
} from "./helpers";
import {
  encodeChallenge,
  CHALLENGE_CHILD_COPY,
  CHALLENGE_GLOBE_RADIUS_KM,
} from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * Friend challenges E2E (P0-1, `feat/challenge-v1`).
 *
 * Pins both flag states (`friendChallenges: false` and `friendChallenges: true`):
 * - Flag OFF (default): `#c=<valid>` and `#c=mc1.corrupt` fail closed silently,
 *   strip `location.hash`, throw zero page errors, render Home, and hide the
 *   challenge share action in the run summary. Flag OFF also never pre-empts
 *   a saved run: a resumable saved run in sessionStorage resumes exactly as
 *   it would without the hash (the flag-off boot is main's boot).
 * - Flag ON: a corrupt or unknown-ID `#c=` link falls through to the saved
 *   run when one exists; with no saved run it lands on Home WITH the
 *   child-friendly boot notice ("Could not load this challenge.",
 *   role="status") — a tapped link must never fail silently for a kid.
 * - Flag ON: `#c=<valid>` with 5 real Globe places boots directly into the
 *   deterministic 5-place Globe challenge in `playOrder` order, enforces the
 *   750 km pin radius freeze (proven behaviourally: a ~600 km pin is a hit,
 *   and a ~800 km pin is a miss even for a seeded 5-7 profile whose band
 *   tolerance would be 1125 km — the seeded miss is what proves the freeze,
 *   since an unset profile's x1.0 band misses at 800 km either way), never
 *   writes to session banking / learning
 *   records / review deck / no-repeat history, and renders the challenge
 *   completion screen with a `< 2000`-char `#c=mc1...` share URL.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const CHALLENGE_IDS = [
  "gn-53654", // Mogadishu
  "gn-54225", // Marka
  "gn-55671", // Kismayo
  "gn-57289", // Hargeysa
  "gn-60149", // El Dibir
] as const;
const VALID_HASH = encodeChallenge(CHALLENGE_IDS, SCORING_VERSION);

function relevantErrors(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await page.addInitScript(() => {
    try {
      (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
        Promise.reject(new Error("service worker disabled for test"));
    } catch {
      /* ignore */
    }
  });
});

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

async function waitForChallengeAim(page: Page): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
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
 * Capture a real, resumable saved-run payload from a live globe run (the
 * crash-loop-breaker spec's pattern): start a run on a throwaway page, read
 * the exact bytes the app persisted, and close the page. Seeding those bytes
 * back is the honest way to get a "resumable saved run" — the payload is
 * whatever production itself wrote, never a hand-built lookalike.
 */
async function captureSavedRun(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForChallengeAim(page);
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY);
  await page.close();
  expect(raw, "captured run must be persisted to sessionStorage").not.toBeNull();
  return raw as string;
}

/**
 * Seed a captured saved run into every later page in this context, with the
 * clean-exit flag at "1" (a normal unload — the run is safe to auto-resume;
 * "0" would be the crash-loop breaker's kill case, a different boot path).
 */
async function seedSavedRun(context: BrowserContext, runJson: string): Promise<void> {
  await context.addInitScript(
    (json: string) => {
      sessionStorage.setItem("meridian.run", json);
      sessionStorage.setItem("meridian.cleanExit", "1");
    },
    runJson,
  );
}

/**
 * Seed an active 5-7 age profile (the youngest band) into the page before
 * the app boots, written in the exact shape src/game/age-profile/store.ts
 * validates (key `meridian.ageProfile.v1`, schemaVersion 1). A normal
 * Globe run for this band judges pins at 750 x 1.5 = 1125 km
 * (pinToleranceKm), so any test that seeds it and still sees a ~800 km
 * pin judged a MISS is seeing the challenge freeze, not band scaling.
 */
async function seedYoungBandProfile(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "meridian.ageProfile.v1",
        JSON.stringify({
          status: "active",
          band: "5-7",
          updatedAt: new Date().toISOString(),
          changeCount: 1,
          schemaVersion: 1,
        }),
      );
    } catch {
      // Storage blocked; the profile stays unset (x1.0 band) and a test
      // that needed the seed fails its judgement assertion instead of
      // passing vacuously.
    }
  });
}

/**
 * The seen-store scan, as ONE page-side function shared by the isolation
 * assertion and its live control: the real no-repeat prefix is
 * `meridian:seen:v2:` (src/game/trail.ts). Running the identical function
 * against a seeded sentinel key first proves the scan can actually see a
 * seen key — an assertion whose scan uses the wrong prefix can never fail,
 * which is exactly the vacuous-assertion bug this guards against.
 */
function scanSeenKeysInPage(): string[] {
  const seenKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("meridian:seen:v2:")) seenKeys.push(k);
  }
  return seenKeys;
}

/** True lon/lat of a challenge place, from the same built chunk data the app deals from. */
function placeCoords(id: string): { lon: number; lat: number } {
  const chunk = JSON.parse(
    readFileSync("src/game/data/geonames/chunks/globe.json", "utf8"),
  ) as { places: { id: string; lon: number; lat: number }[] };
  const place = chunk.places.find((p) => p.id === id);
  expect(place, `challenge place ${id} must exist in the globe chunk`).toBeTruthy();
  return { lon: place!.lon, lat: place!.lat };
}

/**
 * The point `distKm` from (lon, lat) along `bearingDeg`, on the same sphere
 * (R = 6371.0088 km) the game's own distanceKm (src/game/geo.ts) measures
 * on — so the pin the test drops really is ~distKm from the true place in
 * the game's own judgement, not just on the test's ruler.
 */
function destinationPoint(
  lon: number,
  lat: number,
  distKm: number,
  bearingDeg: number,
): { lon: number; lat: number } {
  const R = 6371.0088;
  const d = distKm / R;
  const br = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lam1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(br),
  );
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    );
  return { lon: (lam2 * 180) / Math.PI, lat: (phi2 * 180) / Math.PI };
}

/** Project a lon/lat to viewport pixels through the map's __project E2E seam. */
async function projectToViewport(
  page: Page,
  lon: number,
  lat: number,
): Promise<{ x: number; y: number }> {
  const p = await page.locator(".satellite-map").evaluate(
    (el, [plon, plat]: [number, number]) => {
      const hook = (
        el as unknown as {
          __project?: (lo: number, la: number) => { x: number; y: number } | null;
        }
      ).__project;
      const s = hook?.(plon, plat) ?? null;
      if (!s) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + s.x), y: Math.round(r.top + s.y) };
    },
    [lon, lat] as [number, number],
  );
  expect(p, "the __project seam must resolve the pin point").not.toBeNull();
  return p!;
}

/**
 * Drop a pin ~`distKm` west of the current place and return the game's own
 * judgement: the phase it landed in (story = hit, done = miss) and the
 * result the run persisted (its measured distanceKm and hit flag). West
 * keeps the pin on the same visible hemisphere as the Somali challenge
 * places, towards the middle of the globe view.
 */
async function commitPinAtDistanceKm(
  page: Page,
  placeId: string,
  distKm: number,
): Promise<{ phase: string | null; judgedKm: number; hit: boolean }> {
  const truth = placeCoords(placeId);
  const target = destinationPoint(truth.lon, truth.lat, distKm, 270);
  await waitForSpotSettle(page);
  await dismissTileOverlayIfPresent(page);
  // The question bubble can float over the map; hide it so the tap lands
  // on the canvas, exactly as the longname specs do.
  const hide = page.getByRole("button", { name: "Hide question" });
  if (await hide.isVisible().catch(() => false)) {
    await hide.click();
  }
  const point = await projectToViewport(page, target.lon, target.lat);
  expect(
    await tapHitsMap(page, point.x, point.y),
    `pin point for ~${distKm} km must hit the map canvas, not chrome`,
  ).toBe(true);
  const { phase } = await commitPin(page, point.x, point.y);
  const run = await page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k)!),
    RUN_KEY,
  );
  const result = run.results[run.results.length - 1];
  expect(result, "the committed pin must persist a result").toBeTruthy();
  // Evidence for the report: the distance the game itself judged.
  console.log(
    `pin-pair: target ~${distKm} km from ${placeId} -> judged ${result.distanceKm} km, hit=${result.hit}`,
  );
  return { phase, judgedKm: result.distanceKm as number, hit: result.hit as boolean };
}

test("flag OFF: valid and corrupt #c= hashes fail closed silently, clean URL hash, and hide challenge share UI", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Valid #c=mc1... hash with flag OFF -> fails closed to Home, strips hash
  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
  // Flag OFF stays silent: the feature does not exist, so no boot notice.
  await expect(page.getByTestId("challenge-boot-notice")).toHaveCount(0);

  // 2. Corrupt #c=mc1.corrupt hash with flag OFF -> fails closed to Home, strips hash
  await page.goto(`${APP_URL}?idle-ms=3600001#c=mc1.corrupt_payload!!!`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  await expect(page.getByTestId("challenge-boot-notice")).toHaveCount(0);

  // 3. Normal Globe run summary hides challenge share button when flag OFF
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForChallengeAim(page);
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("challenge-share-container")).toHaveCount(0);

  expect(relevantErrors(errors)).toEqual([]);
});

test("flag ON: corrupt or unknown-ID #c= hashes land on Home WITH the boot notice and a clean URL hash", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const unknownHash = encodeChallenge(
    ["gn-999999991", "gn-999999992", "gn-999999993", "gn-999999994", "gn-999999995"],
    SCORING_VERSION,
  );
  // Unknown-ID link: Home, and the failure is NOT silent — the kid who
  // tapped a friend's link gets the child-friendly notice, announced via
  // its role="status" live region.
  await page.goto(`${APP_URL}?idle-ms=3600000${unknownHash}`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  const notice = page.getByTestId("challenge-boot-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(CHALLENGE_CHILD_COPY);
  await expect(notice).toHaveAttribute("role", "status");
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();

  // Corrupt link: same notice, same clean landing.
  await page.goto(`${APP_URL}?idle-ms=3600001#c=mc1.corrupt_payload!!!`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("challenge-boot-notice")).toBeVisible();
  await expect(page.getByTestId("challenge-boot-notice")).toContainText(
    CHALLENGE_CHILD_COPY,
  );
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

test("flag OFF: a #c= hash does not pre-empt a saved run — the saved run resumes", async ({
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });
  const runJson = await captureSavedRun(context);
  await seedSavedRun(context, runJson);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Boot with a valid challenge hash while a normal run is saved. With the
  // flag off the boot must be byte-for-byte main's boot: the saved run
  // resumes, it does not land on Home.
  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(page.getByRole("button", { name: "Play the globe" })).toHaveCount(0);
  const resumed = await page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k)!),
    RUN_KEY,
  );
  expect(resumed.regionId).toBe("globe");
  // Flag OFF stays silent even on this fall-through path.
  await expect(page.getByTestId("challenge-boot-notice")).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
  await page.close();
});

test("flag ON: a corrupt #c= hash falls through to a saved run — the saved run resumes", async ({
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  const runJson = await captureSavedRun(context);
  await seedSavedRun(context, runJson);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // A broken friend's link must not cost the player their in-progress run:
  // decode fails, boot falls through, the saved run resumes.
  await page.goto(`${APP_URL}?idle-ms=3600000#c=mc1.corrupt_payload!!!`);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(page.getByRole("button", { name: "Play the globe" })).toHaveCount(0);
  const resumed = await page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k)!),
    RUN_KEY,
  );
  expect(resumed.regionId).toBe("globe");
  expect(relevantErrors(errors)).toEqual([]);
  await page.close();
});

test("flag ON: valid #c= link runs deterministic 5-place Globe challenge at 750 km, isolates stores, and emits <2000-char share link", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await waitForChallengeAim(page);

  // Hash is cleaned immediately on boot
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  // Verify run state and pin the 750 km constant itself. (The behavioural
  // proof that the freeze overrides age-band scaling is the seeded pin
  // pair below — this test runs with an unset profile, whose x1.0 band
  // would judge at 750 km with or without the freeze.)
  const runState = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), RUN_KEY);
  expect(runState.regionId).toBe("challenge");
  expect(runState.edition).toBe("globe");
  expect(runState.poolIds).toEqual([...CHALLENGE_IDS]);
  expect(CHALLENGE_GLOBE_RADIUS_KM).toBe(750);

  // Progress badge and deterministic first place (Mogadishu)
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 1 of 5");
  expect(await readQuestion(page)).toContain("Mogadishu");

  // Play all 5 places to completion
  for (let i = 0; i < CHALLENGE_IDS.length; i++) {
    await commitMiss(page);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    // Challenge runs must never show learning growth lines even when learningOutcomes is true
    await expect(resultCard(page).getByTestId("growth-line")).toBeHidden();
    await clickNextPlace(page);
  }

  // Challenge complete dialog appears after the 5th place
  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  await expect(complete).toContainText("Route complete! You scored 0 across 5 places.");

  const shareContainer = page.getByTestId("challenge-share-container");
  await expect(shareContainer).toBeVisible();
  const challengeUrl = await shareContainer.getAttribute("data-challenge-url");
  expect(challengeUrl).toBeTruthy();
  expect(challengeUrl!.length).toBeLessThan(2000);
  expect(challengeUrl!).toContain(VALID_HASH);

  // Isolation invariant: session banking, learning records, review deck, and seen history are untouched
  const isolation = await page.evaluate(() => {
    return {
      session: sessionStorage.getItem("meridian.session"),
      learning: localStorage.getItem("meridian:learning:v1"),
      deck: localStorage.getItem("meridian:review-deck:v1"),
    };
  });
  expect(isolation).toEqual({
    session: null,
    learning: null,
    deck: null,
  });

  // Seen-history isolation, with a LIVE control: the scan (the real
  // `meridian:seen:v2:` prefix — an earlier version of this test scanned
  // `meridian.seen.`, a prefix nothing writes, so it could never fail)
  // must first prove it can see a seen key at all.
  expect(await page.evaluate(scanSeenKeysInPage)).toEqual([]);
  const SENTINEL = "meridian:seen:v2:e2e-control:control:medium";
  await page.evaluate(
    (k) => localStorage.setItem(k, JSON.stringify(["sentinel-place"])),
    SENTINEL,
  );
  expect(
    await page.evaluate(scanSeenKeysInPage),
    "control: the seen scan must detect a seeded sentinel key",
  ).toContain(SENTINEL);
  await page.evaluate((k) => localStorage.removeItem(k), SENTINEL);
  expect(
    await page.evaluate(scanSeenKeysInPage),
    "the challenge run wrote no seen keys (sentinel removed, scan empty again)",
  ).toEqual([]);

  expect(relevantErrors(errors)).toEqual([]);
});

test("flag ON: a pin ~600 km from the true place is a HIT under the frozen 750 km radius", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await waitForChallengeAim(page);
  expect(await readQuestion(page)).toContain("Mogadishu");

  // 600 km is inside EVERY age-band Globe tolerance (1125 / 937.5 / 750 km
  // for bands 5-7 / 8-10 / 11-13), so this hit alone cannot prove the
  // freeze — a band-scaled radius would call it a hit too. It pins the
  // inside of the circle; the seeded 800 km miss below is the half of the
  // pair that discriminates the freeze from band scaling.
  const judged = await commitPinAtDistanceKm(page, CHALLENGE_IDS[0], 600);
  expect(judged.judgedKm).toBeGreaterThan(500);
  expect(judged.judgedKm).toBeLessThan(CHALLENGE_GLOBE_RADIUS_KM);
  expect(judged.hit).toBe(true);
  expect(judged.phase).toBe("story");
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  expect(relevantErrors(errors)).toEqual([]);
});

test("flag ON: a pin ~800 km from the true place is a MISS under the frozen 750 km radius", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  // Seed the youngest band BEFORE the app boots: this band's scaled Globe
  // tolerance is 1125 km, so without the challenge freeze the ~800 km pin
  // below would be judged a HIT. (An unset profile defaults to the x1.0
  // band and misses at 800 km either way — that is why the unseeded
  // version of this test could not prove the freeze.)
  await seedYoungBandProfile(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await waitForChallengeAim(page);
  expect(await readQuestion(page)).toContain("Mogadishu");

  // 800 km is just outside the frozen circle but INSIDE the seeded band's
  // 1125 km tolerance: the pair with the 600 km hit brackets 750 km
  // behaviourally, and deleting either freeze call site (or changing the
  // constant) turns one of the pair red.
  const judged = await commitPinAtDistanceKm(page, CHALLENGE_IDS[0], 800);
  expect(judged.judgedKm).toBeGreaterThan(CHALLENGE_GLOBE_RADIUS_KM);
  expect(judged.judgedKm).toBeLessThan(900);
  expect(judged.hit).toBe(false);
  expect(judged.phase).toBe("done");
  await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
  expect(relevantErrors(errors)).toEqual([]);
});
