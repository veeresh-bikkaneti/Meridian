import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitMiss,
  clickNextPlace,
} from "./helpers";
import type { Page } from "playwright/test";

/**
 * Difficulty picker (feat/difficulty-tiers):
 * - the edition picker shows an Easy / Medium / Hard segmented control
 *   ("How do you want to grow your map today?"), defaulting to Medium;
 * - the choice persists in localStorage (`meridian.difficulty`) across
 *   edition switches and page reloads, and is carried onto every run
 *   (`run.difficultyChoice`);
 * - the dealer filters the catalog BEFORE dealing: an Easy run only ever
 *   deals tier 1–2 places, a Hard run tier 4–5;
 * - switching bands mid-flow starts a FRESH run (never a resume);
 * - reload-resume keeps the run's chosen tier and its dealt question.
 *
 * Determinism: the no-repeat seen store (localStorage
 * `meridian:seen:v2:<edition>:<regionId>:<band>`) is pre-seeded with every pool id
 * EXCEPT a small kept set of known-tier chunk places, so the kept places
 * are dealt first. Kept ids and their tiers come from the same source files
 * the app ships, so the seeding can never silently diverge from the app's
 * data. The answered place's id is read from the persisted pin-drop record
 * (`sessionStorage["meridian.drop"]`, written on every pin commit).
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const DIFFICULTY_KEY = "meridian.difficulty";
const RUN_KEY = "meridian.run";
const DROP_KEY = "meridian.drop";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

function chunkPlaces(regionId: string): { id: string; difficulty: unknown }[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string; difficulty?: unknown }[] };
  return d.places.map((p) => ({ id: p.id, difficulty: p.difficulty }));
}

/** Curated starter ids for one edition+region (id = `${regionId}-${slug}`). */
function curatedIds(edition: string, regionId: string): string[] {
  const src = readFileSync("src/game/starters.ts", "utf8");
  const out: string[] = [];
  const re = /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) out.push(`${m[2]}-${m[3]}`);
  }
  return out;
}

function globePoolIds(): string[] {
  return [...curatedIds("globe", "globe"), ...chunkPlaces("globe").map((p) => p.id)];
}

/** Mark every pool place seen except the kept ids, so those are dealt first. */
async function seedSeenExcept(
  page: Page,
  edition: string,
  regionId: string,
  keepIds: string[],
  allIds: string[],
  choice: "easy" | "medium" | "hard" = "medium",
): Promise<void> {
  const key = `${SEEN_PREFIX}${edition}:${regionId}:${choice}`;
  const seen = allIds.filter((id) => !keepIds.includes(id));
  expect(seen.length, "seeded seen-store must not be empty").toBeGreaterThan(0);
  for (const k of keepIds) {
    expect(allIds, `kept id ${k} must be in the pool`).toContain(k);
  }
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

function difficultyGroup(page: Page) {
  return page.getByRole("group", { name: "How do you want to grow your map today?" });
}

async function pickDifficulty(page: Page, name: "Easy" | "Medium" | "Hard"): Promise<void> {
  await difficultyGroup(page).getByRole("button", { name }).click();
  await expect(
    difficultyGroup(page).getByRole("button", { name }),
  ).toHaveAttribute("aria-pressed", "true");
}

async function readDifficultyChoice(page: Page): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), DIFFICULTY_KEY);
}

/** The run record (sessionStorage): progress + the picker's band choice. */
async function readRunChoice(page: Page): Promise<{ index: number; difficultyChoice: string }> {
  return page.evaluate((k) => {
    const run = JSON.parse(sessionStorage.getItem(k) ?? "null");
    return { index: run.index, difficultyChoice: run.difficultyChoice };
  }, RUN_KEY);
}

/** The id of the place the last committed pin answered. */
async function readDropPlaceId(page: Page): Promise<string | null> {
  const placeId = await page.evaluate((k) => {
    const raw = sessionStorage.getItem(k);
    const drop = raw ? JSON.parse(raw) : null;
    return typeof drop?.placeId === "string" ? (drop.placeId as string) : null;
  }, DROP_KEY);
  return placeId;
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** Current question from the aim live region ("Find X."). */
async function readLiveQuestion(page: Page): Promise<string> {
  const live = page.locator('p.sr-only[aria-live="polite"]');
  await expect(live).toContainText(/^Find .+\.$/, { timeout: 15_000 });
  return ((await live.textContent()) ?? "").trim();
}

/** Advance one question via a miss (a miss never hits, so no luck involved). */
async function advanceOneQuestion(page: Page): Promise<void> {
  await commitMiss(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the PWA spec).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("picker renders three options; the choice persists across reload and edition switches", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(APP);

  // Three one-tap options under the picker's difficulty header.
  const group = difficultyGroup(page);
  await expect(group.getByRole("button", { name: "Easy" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Medium" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Hard" })).toBeVisible();

  // Medium is the default band.
  await expect(group.getByRole("button", { name: "Medium" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Picking Hard writes the persisted choice immediately.
  await pickDifficulty(page, "Hard");
  expect(await readDifficultyChoice(page)).toBe("hard");

  // The choice survives a full page reload.
  await page.reload();
  await expect(difficultyGroup(page).getByRole("button", { name: "Hard" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await readDifficultyChoice(page)).toBe("hard");

  // The choice is carried onto the run.
  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);
  expect((await readRunChoice(page)).difficultyChoice).toBe("easy");

  // Leaving the run for the picker (an edition switch) keeps the choice.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await expect(difficultyGroup(page).getByRole("button", { name: "Easy" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await readDifficultyChoice(page)).toBe("easy");

  // ...and the same choice carries onto a different edition's run.
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Play entire United States" }).click();
  await expectAim(page);
  expect((await readRunChoice(page)).difficultyChoice).toBe("easy");

  expectCleanConsole(errors);
});

test("an Easy run deals only tier 1–2 places", async ({ page }) => {
  const errors = collectErrors(page);
  const chunks = chunkPlaces("globe");
  const tierOf = new Map(chunks.map((p) => [p.id, p.difficulty]));
  const allIds = globePoolIds();
  const keep = chunks
    .filter((p) => p.difficulty === 1 || p.difficulty === 2)
    .slice(0, 5)
    .map((p) => p.id);
  expect(keep, "need five known tier 1–2 globe places").toHaveLength(5);

  await page.goto(APP);
  await seedSeenExcept(page, "globe", "globe", keep, allIds, "easy");
  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  // Several questions in: every dealt place is from the kept easy set and
  // reads tier 1–2 in the shipped data.
  for (let i = 0; i < 3; i++) {
    await commitMiss(page);
    const placeId = await readDropPlaceId(page);
    expect(keep, `question ${i + 1}: dealt from the kept easy pool`).toContain(placeId);
    expect([1, 2], `question ${i + 1} (${placeId}): tier 1–2`).toContain(tierOf.get(placeId));
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }

  expectCleanConsole(errors);
});

test("a Hard run deals tier 4–5 places", async ({ page }) => {
  const errors = collectErrors(page);
  const chunks = chunkPlaces("globe");
  const tierOf = new Map(chunks.map((p) => [p.id, p.difficulty]));
  const allIds = globePoolIds();
  const keep = chunks
    .filter((p) => p.difficulty === 4 || p.difficulty === 5)
    .slice(0, 5)
    .map((p) => p.id);
  expect(keep, "need five known tier 4–5 globe places").toHaveLength(5);

  await page.goto(APP);
  await seedSeenExcept(page, "globe", "globe", keep, allIds, "hard");
  await pickDifficulty(page, "Hard");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  for (let i = 0; i < 2; i++) {
    await commitMiss(page);
    const placeId = await readDropPlaceId(page);
    expect(keep, `question ${i + 1}: dealt from the kept hard pool`).toContain(placeId);
    expect([4, 5], `question ${i + 1} (${placeId}): tier 4–5`).toContain(tierOf.get(placeId));
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }

  expectCleanConsole(errors);
});

test("switching difficulty mid-flow starts a fresh run, not a resume", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(APP);
  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  // Make progress in the Easy run so a resume would be observable.
  await advanceOneQuestion(page);
  const easyRun = await readRunChoice(page);
  expect(easyRun.difficultyChoice).toBe("easy");
  expect(easyRun.index, "one answered question advanced the run").toBeGreaterThan(0);

  // Switch bands mid-flow: back to the picker, pick Medium, play the globe.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await pickDifficulty(page, "Medium");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  // Fresh run: the new band's choice is stored and the index restarts at 0.
  // A resume would have kept index > 0 and choice "easy".
  const mediumRun = await readRunChoice(page);
  expect(mediumRun.difficultyChoice).toBe("medium");
  expect(mediumRun.index).toBe(0);

  expectCleanConsole(errors);
});

test("resume after reload keeps the chosen tier and its dealt question", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(APP);
  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expectAim(page);

  // Answer one question so the saved run has progress to restore.
  await advanceOneQuestion(page);
  const before = await readRunChoice(page);
  expect(before.difficultyChoice).toBe("easy");
  const beforeQuestion = await readLiveQuestion(page);

  // Reload: the run resumes with the same tier, progress, and dealt question.
  await page.reload();
  await expectAim(page);
  const after = await readRunChoice(page);
  expect(after.difficultyChoice).toBe("easy");
  expect(after.index).toBe(before.index);
  expect(await readLiveQuestion(page)).toBe(beforeQuestion);

  expectCleanConsole(errors);
});

test("a Medium grind does not shrink the Easy pool (band-isolation check)", async ({
  page,
}) => {
  // NOTE on what this test proves: it seeds the medium BAND key, which only
  // exists post-fix, so it verifies the fixed isolation invariant rather
  // than failing on the old shared-history code. The unit test
  // "one band's dealt history never shrinks another band's pool" in
  // trail.test.ts is the true regression guard (it exercises poolForNewRun
  // against a shared store the way pre-fix production behaved).
  const errors = collectErrors(page);
  // Arkansas chunk, Easy band = tiers 1–2.
  const chunks = chunkPlaces("arkansas");
  const easyChunkIds = chunks
    .filter((p) => p.difficulty === 1 || p.difficulty === 2)
    .map((p) => p.id);
  const allChunkIds = chunks.map((p) => p.id);
  expect(easyChunkIds.length, "Arkansas needs a real Easy band").toBeGreaterThan(10);

  await page.goto(APP);
  // Simulate a heavy Medium grind: every chunk place marked seen on the
  // MEDIUM band's history (the bands overlap on tier 2, like real play).
  await page.evaluate(
    ([k, ids]: [string, string[]]) => localStorage.setItem(k, JSON.stringify(ids)),
    [`${SEEN_PREFIX}state:arkansas:medium`, allChunkIds] as [string, string[]],
  );

  await pickDifficulty(page, "Easy");
  await page.getByRole("button", { name: "Choose a state" }).click();
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Arkansas" }).click();
  await expectAim(page);

  // The run's pool is the FULL Easy band — the medium history must not
  // shrink it. (Before the fix the pool collapsed to the one surviving
  // place and the dealer cycled it: repeat mode.)
  const poolIds = (await page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k) ?? "null").poolIds as string[],
    RUN_KEY,
  )) as string[];
  for (const id of easyChunkIds) {
    expect(poolIds, `Easy pool keeps chunk place ${id}`).toContain(id);
  }
  expect(poolIds.length).toBeGreaterThanOrEqual(easyChunkIds.length);

  // Behaviorally: six questions, six unique places — no repeats.
  const dealt: string[] = [];
  for (let i = 0; i < 6; i++) {
    await commitMiss(page);
    dealt.push((await readDropPlaceId(page)) as string);
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  expect(new Set(dealt).size, `no repeats in 6 questions, got ${dealt}`).toBe(6);

  // Easy play never touched the medium band's history.
  const mediumSeen = (await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? "[]") as string[],
    `${SEEN_PREFIX}state:arkansas:medium`,
  )) as string[];
  expect(mediumSeen.length).toBe(allChunkIds.length);

  expectCleanConsole(errors);
});
