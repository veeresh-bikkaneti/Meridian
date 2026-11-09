import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  entryByName,
  fulfillFlagsStaging,
  guessByEntryId,
  installDetectiveRecorder,
  detectivePlays,
  waitForPhase,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective CLOSED-STATE gate (staging close cure, 2026-11-07).
 *
 * This spec closes the recorded CELEBRATE-window sampling hole: the
 * shipped staging gate sampled bench / rise / entry / berth / mute,
 * but never the window between LoopScreen first rendering
 * "Case closed" and the machine reaching CELEBRATE / FAIL_READ —
 * the SELECTION_READ window, in which the production defect stood
 * the bench (board + both left-behind cups + standing Holmes) back
 * up over the closed case at every width, on both endings
 * (DIAGNOSIS-bench-at-close.md, defect 1).
 *
 * Method: an in-page sampler polls at 50 ms (the brief's ceiling is
 * 200 ms) from BEFORE the closing guess, recording — per sample —
 * whether "Case closed" is on screen, the machine phase, bench /
 * board / coffee counts, and the Holmes/Watson casting counts.
 * Assertions run on the recorded samples, not on a single settled
 * screenshot: EVERY closed sample must be bench-free, and samples
 * with the pair mounted must show exactly one Holmes + one Watson.
 * The window itself must provably have been sampled (closed +
 * SELECTION_READ samples exist), or the test fails rather than
 * passing on a missed window.
 *
 * Search-box play throughout (the endings-spec pattern): no map
 * pointer interaction, so Holmes can only enter via the case-end
 * forced entry — the exact production path the owner hit.
 */

test.setTimeout(420_000);

/** Open the seam case WITH staging on (the staging spec's pattern):
 * u10's openSeamCase waits for the station element, which the bench
 * stage suppresses whole (cure C1) — with staging on, the case opens
 * on the bench and speech unlocks from there. */
async function openStagingCase(page: Page, index: number): Promise<void> {
  await page.goto(`http://127.0.0.1:4123/Meridian/?loop-puzzle=${index}`);
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
  const count = async () =>
    (await detectivePlays(page)).filter((u) =>
      u.includes("/audio/detective/"),
    ).length;
  for (let attempt = 0; attempt < 8; attempt++) {
    await heading.click();
    try {
      await expect.poll(count, { timeout: 4_000 }).toBeGreaterThan(0);
      return;
    } catch {
      /* tap again — the tap may land before the listener arms */
    }
  }
  throw new Error("speech never unlocked after 8 verified gesture taps");
}

type ClosedSample = {
  closed: boolean;
  phase: string | null;
  bench: number;
  board: number;
  coffee: number;
  holmes: number;
  watson: number;
};

async function startClosedSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __closedSamples: ClosedSample[] };
    w.__closedSamples = [];
    const count = (sel: string) => document.querySelectorAll(sel).length;
    let lastPhase: string | null = null;
    const pushSample = () => {
      const root =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      lastPhase = root?.getAttribute("data-phase") ?? null;
      w.__closedSamples.push({
        closed: (document.body?.innerText ?? "").includes("Case closed"),
        phase: root?.getAttribute("data-phase") ?? null,
        bench: count('[data-testid="detective-bench"]'),
        board: count('[data-testid="detective-bench-board"]'),
        coffee:
          count('[data-testid="detective-coffee-holmes"]') +
          count('[data-testid="detective-coffee-watson"]') +
          count('[data-testid="detective-coffee-left-holmes"]') +
          count('[data-testid="detective-coffee-left-watson"]'),
        holmes: count('[data-detective="holmes"]'),
        watson: count('[data-detective="watson"]'),
      });
      if (w.__closedSamples.length > 6000) w.__closedSamples.shift();
    };
    const iv = setInterval(pushSample, 50);
    void iv;
    // Round 7: a 50 ms interval still misses a short phase window
    // whole when a long task blocks the main thread past it
    // (SELECTION_READ was lost that way: phases seen jumped
    // straight to FAIL_READ/POUT). Attribute changes queue
    // MutationObserver records even while blocked, so every phase
    // transition is captured on delivery, in order.
    const mo = new MutationObserver(() => {
      const root =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      const ph = root?.getAttribute("data-phase") ?? null;
      if (ph !== lastPhase) pushSample();
    });
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-phase"],
      subtree: true,
      childList: true,
    });
  });
}

async function closedSamples(page: Page): Promise<ClosedSample[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __closedSamples: ClosedSample[] })
        .__closedSamples ?? [],
  );
}

function assertClosedWindow(samples: ClosedSample[], label: string) {
  const closed = samples.filter((x) => x.closed);
  expect(
    closed.length,
    `${label}: the closed state must have been sampled (got ${closed.length} closed samples of ${samples.length})`,
  ).toBeGreaterThanOrEqual(5);
  const windowSamples = closed.filter((x) => x.phase === "SELECTION_READ");
  expect(
    windowSamples.length,
    `${label}: the SELECTION_READ closed window must have been sampled — that window is the hole this spec closes (phases seen: ${[...new Set(closed.map((x) => x.phase))].join("/")})`,
  ).toBeGreaterThanOrEqual(1);
  // The defect itself: no bench furniture in ANY closed sample.
  for (const [i, x] of closed.entries()) {
    expect(
      x.bench + x.board + x.coffee,
      `${label}: closed sample ${i} (phase=${x.phase}) must be bench-free (bench=${x.bench} board=${x.board} coffee=${x.coffee})`,
    ).toBe(0);
    // Exactly-one-casting wherever the pair is mounted at all.
    expect(
      x.holmes,
      `${label}: closed sample ${i} (phase=${x.phase}) Holmes casting`,
    ).toBeLessThanOrEqual(1);
    expect(
      x.watson,
      `${label}: closed sample ${i} (phase=${x.phase}) Watson casting`,
    ).toBeLessThanOrEqual(1);
    // Where the host is mounted (phase visible), the pair is present
    // in its designed positions — not vanished with the slot.
    if (x.phase !== null) {
      expect(
        x.holmes,
        `${label}: closed sample ${i} (phase=${x.phase}) must carry exactly one Holmes`,
      ).toBe(1);
      expect(
        x.watson,
        `${label}: closed sample ${i} (phase=${x.phase}) must carry exactly one Watson`,
      ).toBe(1);
    }
  }
  console.log(
    `[closed-state ${label}] samples=${samples.length} closed=${closed.length} selectionReadWindow=${windowSamples.length} benchFree=${closed.every((x) => x.bench + x.board + x.coffee === 0)}`,
  );
}

const WIDTHS = [
  { name: "phone 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "desktop 1280", width: 1280, height: 950 },
] as const;

for (const w of WIDTHS) {
  test(`closed state is bench-free: SOLVE (${w.name})`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 4);
      await fulfillFlagsStaging(context);
      const page = await context.newPage();
      await openStagingCase(page, 137);
      await waitForSearchIdle(page);

      // Bench during CASE_OPEN was the verified live behaviour and
      // the cure must preserve it: it stood earlier in this case.
      // (Sampled here as a regression anchor before play begins —
      // by SEARCH_IDLE the stage has risen to "standing", whose
      // bench element is the pre-close state, not the defect.)
      const lasVegas = entryByName("las vegas");
      await guessByEntryId(page, lasVegas.id, "las vegas");
      await waitForSearchIdle(page, 150_000);

      await startClosedSampler(page);
      await guessByEntryId(page, "geonames:5505411", "henderson");
      await waitForPhase(page, "CELEBRATE", 90_000);
      // Let the sampler prove the bench stays gone after settle too.
      await page.waitForTimeout(800);
      assertClosedWindow(await closedSamples(page), `SOLVE ${w.name}`);
      await expect(page.getByTestId("detective-bench")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test(`closed state is bench-free: FAIL (${w.name})`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 4);
      await fulfillFlagsStaging(context);
      const page = await context.newPage();
      await openStagingCase(page, 137);
      await waitForSearchIdle(page);

      const misses = ["las vegas", "paris", "tokyo", "sydney", "cairo"];
      const used = new Set<string>();
      for (let i = 0; i < misses.length; i++) {
        const entry = entryByName(misses[i]!);
        expect(used.has(entry.id)).toBe(false);
        used.add(entry.id);
        if (i === misses.length - 1) await startClosedSampler(page);
        await guessByEntryId(page, entry.id, misses[i]!);
        if (i < misses.length - 1) await waitForSearchIdle(page, 150_000);
      }
      await waitForPhase(page, "POUT", 90_000);
      await page.waitForTimeout(800);
      assertClosedWindow(await closedSamples(page), `FAIL ${w.name}`);
      await expect(page.getByTestId("detective-bench")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
