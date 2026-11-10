import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  BASE,
  collectAudioRequests,
  detectivePlays,
  entryByName,
  fulfillFlagsFlank,
  fulfillFlagsOn,
  guessByEntryId,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * PR 2a panel BLOCK cure — the selection read, proven on the REAL path.
 *
 * The machine handler `selectionNamed` shipped in the speech piece
 * (PR #386) with unit tests, but no production code dispatched it:
 * LoopScreen passed the host only the CONFIRMED guess, so a player who
 * picked a place on the map heard silence until the guess was spent.
 * The cure wires the player's CURRENT pick through the props whitelist
 * (selectedPlaceId) into the host, which dispatches selectionNamed on
 * each new pick landing. This spec plays the whole chain —
 * LoopScreen → props → host → machine → audio — never the machine
 * alone:
 *
 * - (a) Picking a named place (search path, sheet open, NO confirm)
 *   speaks the place's name clip BEFORE any guess is spent. Then
 *   confirming that same place speaks `suspicion` ONLY — the name is
 *   not read twice (the dedup contract: the id the read names is the
 *   id the guess records under).
 * - (b) With the flank flag ON, a pick made while the clue-2 chain is
 *   live is stored in the machine's depth-1 pending slot and spoken
 *   only after the chain drains (the pending-slot law) — it is never
 *   injected into a live clue chain, and it still fires before its
 *   own guess is spent.
 *
 * Speech is observed on the harness's play() record and the network
 * layer (detective-u10.ts), never on DOM state alone. The sandbox
 * proves the play path executes; it cannot prove audible sound.
 */

test.setTimeout(600_000);

const CASE = 137; // Henderson, Nevada — the seam case.

async function detectiveOnly(page: Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) =>
    u.includes("/audio/detective/"),
  );
}

/** Flank-mode case entry, mirroring detective-flank.spec.ts's own
 * proven flow (openCaseOnBench + unlockSpeech + waitForSearchIdle).
 * openSeamCase cannot be used here: it waits for the
 * detective-station ROOT to be visible, but in flank mode that root
 * is display:none — the station's box still exists (the flank spec
 * measures Watson's station SVG inside it) while the visible pair
 * surface is the flank row / strip. The bench-stage opener waits
 * only for the clue article + bench, which are visible in every
 * mode; the unlock loop then taps the heading until a detective
 * clip actually plays. */
async function openFlankSeamCase(page: Page, index: number): Promise<void> {
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
  const heading = page.getByRole("heading", { name: "GeoDetective" });
  const detectivePlayCount = async () =>
    (await detectivePlays(page)).filter((u) => u.includes("/audio/detective/"))
      .length;
  for (let attempt = 0; attempt < 8; attempt++) {
    await heading.click();
    try {
      await expect
        .poll(detectivePlayCount, { timeout: 4_000 })
        .toBeGreaterThan(0);
      return;
    } catch {
      // The tap landed before the listener armed — tap again.
    }
  }
  throw new Error("speech never unlocked after 8 verified gesture taps");
}

/** Pick a place through the jump search and STOP at the sheet — the
 * exact moment the owner's promise attaches to (a selection made, no
 * guess spent yet). */
async function pickOnly(page: Page, entryId: string, query: string) {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill(query);
  const option = page.locator(
    `li[role="option"][data-entry-id="${entryId}"]`,
  );
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("(a) a pick is named aloud before the guess is spent; confirming it speaks suspicion only", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  await installDetectiveRecorder(context);
  const requests = collectAudioRequests(page);
  await openSeamCase(page, CASE);
  await waitForSearchIdle(page);

  const shanghai = entryByName("shanghai");
  const NAME_CLIP = "names/1796236.mp3"; // Shanghai, China — has a clip.

  // Baseline: the name has not been spoken in this case.
  expect(
    (await detectiveOnly(page)).filter((u) => u.includes(NAME_CLIP)),
  ).toHaveLength(0);

  // The pick: search → option → sheet opens. NO confirm.
  await pickOnly(page, shanghai.id, "Shanghai");

  // Holmes names the pick aloud BEFORE any guess is confirmed.
  await expect
    .poll(
      async () =>
        (await detectiveOnly(page)).filter((u) => u.includes(NAME_CLIP))
          .length,
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
  expect(requests.some((u) => u.includes(NAME_CLIP))).toBe(true);
  // The read preceded the spend: the case is still on guess 1.
  await expect(page.getByText(/Guess 1 of/).first()).toBeVisible();

  // Confirm the just-named place: suspicion ONLY, no second name read.
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect
    .poll(
      async () =>
        (await detectiveOnly(page)).some((u) =>
          u.includes("fixed/suspicion.mp3"),
        ),
      { timeout: 60_000 },
    )
    .toBe(true);
  const nameReads = (await detectiveOnly(page)).filter((u) =>
    u.includes(NAME_CLIP),
  );
  expect(nameReads).toHaveLength(1);
});

test("(b) flank on: a pick made mid-clue-chain waits for the chain to drain (pending slot)", async ({
  page,
  context,
}) => {
  await fulfillFlagsFlank(context);
  // Rate 1: the clue-2 chain must still be live when the pick lands,
  // so the pending slot — not the immediate path — is what fires.
  await installDetectiveRecorder(context, 1);
  await openFlankSeamCase(page, CASE);
  await waitForSearchIdle(page);

  // Spend guess 1 on Shanghai (a miss — the case stays open).
  const shanghai = entryByName("shanghai");
  await guessByEntryId(page, shanghai.id, "Shanghai");

  // The miss bridge deals clue 2 and its read chain starts.
  await expect
    .poll(
      async () =>
        (await detectiveOnly(page)).some((u) =>
          u.includes(`case-${CASE}/clue-2.mp3`),
        ),
      { timeout: 90_000 },
    )
    .toBe(true);

  // Pick Beijing while the chain is live. Sheet opens; no confirm.
  const beijing = entryByName("beijing");
  const BJ_CLIP = "names/1816670.mp3"; // Beijing, China — has a clip.
  await pickOnly(page, beijing.id, "Beijing");
  // Still guess 2 — the pick has spent nothing.
  await expect(page.getByText(/Guess 2 of/).first()).toBeVisible();

  // The name read fires from the pending slot once the chain drains.
  await expect
    .poll(
      async () =>
        (await detectiveOnly(page)).filter((u) => u.includes(BJ_CLIP))
          .length,
      { timeout: 180_000 },
    )
    .toBeGreaterThan(0);

  // Pending-slot law: Beijing's read started only after clue 2's read.
  const plays = await detectiveOnly(page);
  const clue2At = plays.findIndex((u) =>
    u.includes(`case-${CASE}/clue-2.mp3`),
  );
  const beijingAt = plays.findIndex((u) => u.includes(BJ_CLIP));
  expect(clue2At).toBeGreaterThan(-1);
  expect(beijingAt).toBeGreaterThan(clue2At);
});
