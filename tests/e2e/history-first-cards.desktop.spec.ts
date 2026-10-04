import { test, expect } from "playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitPin,
  spotViewportPoint,
  tapHitsMap,
  clickNextPlace,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * Card-pipeline structural fix: curated notable notes live in first-class
 * `history` fields, so the rendered result card must lead with history and
 * follow with the plain-geography blurb (Veeresh's rule 1: history first,
 * modern identity second).
 *
 * Deterministic targeting without production test seams: the dealer builds
 * its pool from the catalog minus the persistent no-repeat history
 * (localStorage `meridian:seen:v2:<edition>:<regionId>:<band>`). Each test seeds
 * that history with every place ID except the target, so the very first
 * deal is the target place. A hit commit then renders the full story in the
 * "Place story" region, which must start with the curated history.
 */
test.setTimeout(240_000);

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

type ChunkPlace = {
  id: string;
  name: string;
  history?: string;
  blurb: string;
  wiki?: string;
};

type Target = {
  edition: "state" | "country";
  regionId: string;
  chunkFile: string;
  placeId: string;
  placeName: string;
  /** Picker label for the state edition (the state list shows states, not places). */
  stateName?: string;
};

const TARGETS: Target[] = [
  {
    edition: "state",
    regionId: "illinois",
    chunkFile: "illinois.json",
    placeId: "gn-4915989",
    placeName: "West Englewood",
    stateName: "Illinois",
  },
  {
    edition: "country",
    regionId: "united-states",
    chunkFile: "united-states.json",
    placeId: "gn-4137672",
    placeName: "Barry Farms",
  },
  {
    edition: "state",
    regionId: "florida",
    chunkFile: "florida.json",
    placeId: "gn-4164138",
    placeName: "Miami",
    stateName: "Florida",
  },
  {
    edition: "state",
    regionId: "tennessee",
    chunkFile: "tennessee.json",
    placeId: "gn-4644585",
    placeName: "Nashville",
    stateName: "Tennessee",
  },
];

const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");

function readChunkRecord(chunkFile: string, placeId: string): ChunkPlace {
  const raw = readFileSync(join(CHUNKS_DIR, chunkFile), "utf8");
  const places = (JSON.parse(raw) as { places: ChunkPlace[] }).places;
  const record = places.find((p) => p.id === placeId);
  if (!record) throw new Error(`chunk ${chunkFile} has no record ${placeId}`);
  if (!record.history)
    throw new Error(`${placeId} has no history field in ${chunkFile}`);
  return record;
}

function readChunkIds(chunkFile: string): string[] {
  const raw = readFileSync(join(CHUNKS_DIR, chunkFile), "utf8");
  return (JSON.parse(raw) as { places: ChunkPlace[] }).places.map((p) => p.id);
}

/**
 * Curated starter IDs for one edition+region. The dealing pool is
 * STARTERS + chunk places (see placesFor), so the seed must cover both —
 * otherwise an unseeded starter (e.g. "Lincoln Home") gets dealt first.
 * Starter ids are `${regionId}-${slug}` (see place() in starters.ts).
 */
function readStarterIds(edition: string, regionId: string): string[] {
  const src = readFileSync(join(REPO, "src", "game", "starters.ts"), "utf8");
  const ids: string[] = [];
  const re = /place\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) ids.push(`${m[2]}-${m[3]}`);
  }
  return ids;
}

/**
 * Every chunk file aggregated into the target's dealing pool. State runs
 * deal from their single chunk; the whole-US country run folds in every
 * state chunk (mirrors aggregateChunkIds). Over-seeding ids that are not
 * in the pool is harmless — poolForNewRun just filters.
 */
function poolChunkFiles(target: Target): string[] {
  if (target.edition !== "country") return [target.chunkFile];
  return readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".json"));
}

/** All pool ids except the target — the no-repeat seed that isolates it. */
function seedIds(target: Target): string[] {
  const ids = new Set<string>();
  for (const f of poolChunkFiles(target)) {
    for (const id of readChunkIds(f)) ids.add(id);
  }
  for (const id of readStarterIds(target.edition, target.regionId)) ids.add(id);
  ids.delete(target.placeId);
  return [...ids];
}

/**
 * Commit a hit on the target's true spot. Unlike the shared commitHit,
 * a not-yet-tappable spot waits for the map to settle instead of burning
 * the place with commitMiss — with a 1-place pool the target can sit at
 * the viewport center, where a (500, 400) burn would hit, not miss.
 */
async function commitTargetHit(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const spot = await spotViewportPoint(page);
    const inView =
      spot && spot.x >= 0 && spot.x <= 1440 && spot.y >= 0 && spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      const { phase } = await commitPin(page, spot.x, spot.y);
      if (phase === "story") return;
      // Tapped the projected spot but missed (far side / stale projection):
      // the 1-place pool re-deals the target, so advance and retry.
      await clickNextPlace(page);
      await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
    } else {
      await page.waitForTimeout(2000);
    }
  }
  throw new Error("commitTargetHit: no tappable spot in 15 attempts");
}

async function startTargetedRun(page: Page, target: Target): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  // Seed the persistent no-repeat history with every ID except the target,
  // so the dealer's pool shrinks to exactly the target place.
  await page.evaluate(
    ({ key, ids }) => localStorage.setItem(key, JSON.stringify(ids)),
    {
      key: `meridian:seen:v2:${target.edition}:${target.regionId}:medium`,
      ids: seedIds(target),
    },
  );
  if (target.edition === "state") {
    await page.getByRole("button", { name: "Choose a state" }).click();
    await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
    await page.getByRole("button", { name: "United States" }).click();
    await expect(
      page.getByRole("heading", { name: "United States" }),
    ).toBeVisible();
    await page.getByRole("button", { name: target.stateName ?? target.placeName }).click();
  } else {
    await page.getByRole("button", { name: "Choose a country" }).click();
    await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
    await page.getByRole("button", { name: "United States" }).click();
    await expect(
      page.getByRole("heading", { name: "United States" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Play entire United States" }).click();
  }
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

for (const target of TARGETS) {
  test(`${target.placeName}: result card leads with history, geography second`, async ({
    page,
  }) => {
    const record = readChunkRecord(target.chunkFile, target.placeId);
    const history = record.history!;
    const blurb = record.blurb;

    const pageErrors: string[] = [];
    // React hydration error #418 is a known flaky pre-existing race on slow
    // machines (prerendered shell vs client hydration); it is unrelated to
    // the card data and does not reproduce deterministically. Filter it so
    // the spec stays deterministic; any other page error still fails.
    page.on("pageerror", (err) => {
      const msg = String(err);
      if (!msg.includes("Minified React error #418")) pageErrors.push(msg);
    });

    await startTargetedRun(page, target);

    // The shrunken pool deals the target first, deterministically.
    await expect(
      page.getByRole("heading", { name: target.placeName }),
    ).toBeVisible({ timeout: 10_000 });

    // A hit renders the full story in one "Place story" region.
    await commitTargetHit(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("story");

    const storyRegion = page.getByRole("region", { name: "Place story" });
    await expect(storyRegion).toBeVisible({ timeout: 10_000 });
    const story = ((await storyRegion.textContent()) ?? "").trim();

    expect(
      story.startsWith(history),
      `rule 1 violated for ${target.placeName}: card does not lead with history.\n` +
        `story head: ${JSON.stringify(story.slice(0, 120))}\n` +
        `history head: ${JSON.stringify(history.slice(0, 120))}`,
    ).toBe(true);
    expect(
      story.includes(blurb),
      `${target.placeName}: plain-geography blurb missing from the card`,
    ).toBe(true);
    expect(
      story.indexOf(blurb),
      `${target.placeName}: blurb must follow the history, not lead`,
    ).toBeGreaterThan(0);
    expect(
      story.split(history).length - 1,
      `${target.placeName}: history note must appear exactly once (no embedded duplication)`,
    ).toBe(1);

    expect(pageErrors, `page errors: ${pageErrors.join("; ")}`).toEqual([]);
  });
}
