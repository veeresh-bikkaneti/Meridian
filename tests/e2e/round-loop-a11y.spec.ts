import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
  nextPlaceButton,
  clickNextPlace,
} from "./helpers";

/**
 * Wave 1 P0 Item 3 — round-loop accessibility (manifest §2 Item 3).
 *
 * Assertions use roles/labels, document.activeElement, and a live-region
 * MutationObserver only — never pixels. Sound is seeded off
 * (localStorage `meridian.sound` = "off") so narration cannot move focus
 * or add audio-driven announcements mid-test.
 *
 * The designated reveal announcer is the GameApp sr-only live paragraph
 * ("Pin dropped. …" at revealDone). The result-card AI sentence and the
 * satellite-map zoom-space announcements are NOT reveal announcers: the
 * former is visible text only, the latter is silenced while a reveal
 * card is up. Counting rule: a live-region text change counts only when
 * it lands a non-empty, distinct text (clearing a region announces
 * nothing to a screen reader).
 */

test.setTimeout(480_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Seed sound off before any navigation in the test.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("meridian.sound", "off");
    } catch {
      /* private mode — ignore */
    }
  });
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then((v) => Number(v));
const readMaxZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-max-zoom").then((v) => Number(v));

async function awaitGlobeDiveDone(page: Page): Promise<void> {
  await expect
    .poll(() => mapEl(page).getAttribute("data-zoom"), { timeout: 30_000 })
    .toBe("2");
}

/** Wait until data-zoom is stable across 800 ms (return beat settled). */
async function awaitZoomStable(page: Page): Promise<number> {
  let stable: number | null = null;
  await expect
    .poll(
      async () => {
        const a = await readZoom(page);
        await page.waitForTimeout(800);
        const b = await readZoom(page);
        if (a === b) {
          stable = b;
          return String(b);
        }
        return null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return stable!;
}

/** Install the live-region observer; returns helpers to slice its log.
 *
 * Counting rule (per live element, not per mutation sweep): an entry is
 * recorded only when one live element's own text changes to a new
 * non-empty value. Re-rendering the same text, and other elements'
 * changes, never re-count an element's current announcement. A freshly
 * mounted live element with non-empty text counts once (that is how a
 * result card's announcement arrives). Clearing a region announces
 * nothing and is not counted. */
async function installLiveObserver(page: Page): Promise<{
  slice: (from: number) => Promise<string[]>;
  length: () => Promise<number>;
}> {
  await page.evaluate(() => {
    const seen: string[] = [];
    const lastByEl = new Map<Element, string>();
    (window as unknown as { __liveSeen: string[] }).__liveSeen = seen;
    const record = () => {
      document
        .querySelectorAll('[aria-live], [role="status"], [role="alert"]')
        .forEach((el) => {
          const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
          const prev = lastByEl.get(el) ?? "";
          lastByEl.set(el, t);
          if (t && t !== prev) seen.push(t);
        });
    };
    const obs = new MutationObserver(record);
    if (document.body) {
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    (window as unknown as { __liveObs: MutationObserver }).__liveObs = obs;
  });
  return {
    slice: (from: number) =>
      page.evaluate(
        (f) => (window as unknown as { __liveSeen: string[] }).__liveSeen.slice(f),
        from,
      ),
    length: () =>
      page.evaluate(() => (window as unknown as { __liveSeen: string[] }).__liveSeen.length),
  };
}

/** The GameApp sr-only live paragraph (the designated announcer). */
async function gameLiveText(page: Page): Promise<string> {
  const texts = await page
    .locator('p.sr-only[aria-live="polite"]')
    .allTextContents();
  return (texts[0] ?? "").trim().replace(/\s+/g, " ");
}

async function activeElementInfo(page: Page): Promise<{
  tag: string;
  id: string;
  label: string;
  text: string;
  inDialog: boolean;
  inMap: boolean;
  visible: boolean;
}> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { tag: "", id: "", label: "", text: "", inDialog: false, inMap: false, visible: false };
    const dialog = document.querySelector('[role="dialog"]');
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      id: el.id,
      label: el.getAttribute("aria-label") ?? "",
      text: (el.textContent ?? "").trim().slice(0, 80),
      inDialog: !!dialog?.contains(el),
      inMap: !!el.closest?.(".satellite-map"),
      visible: r.width > 0 && r.height > 0,
    };
  });
}

/**
 * Commit a guaranteed miss, slicing live announcements around the Drop
 * click only (the map tap's own "Pin placed." announcement precedes it
 * and belongs to aiming, not the reveal). Retries on the ~1% hit.
 */
async function commitMissObserved(
  page: Page,
  obs: { slice: (from: number) => Promise<string[]>; length: () => Promise<number> },
): Promise<{ announcements: string[]; phase: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    await page.mouse.click(500, 400);
    await expect(dropButton(page)).toBeEnabled();
    const mark = await obs.length();
    await dropButton(page).click();
    let phase: string | null = null;
    await expect
      .poll(
        async () => {
          phase = await readPhase(page);
          return phase;
        },
        { timeout: 20_000 },
      )
      .toMatch(/^(story|done)$/);
    if (phase === "done") {
      await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
      return { announcements: await obs.slice(mark), phase };
    }
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMissObserved: (500, 400) hit three places in a row");
}

test("3A reveal announces exactly once to the screen reader", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const { announcements } = await commitMissObserved(page, obs);
  expect(
    announcements,
    `reveal must announce exactly once, got ${announcements.length}: ${JSON.stringify(announcements)}`,
  ).toHaveLength(1);
});

test("3B Next place moves focus to the new question, not body", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  await commitMissObserved(page, obs);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // Focus must land on the new question (heading or map), never body.
  await expect
    .poll(() => activeElementInfo(page), { timeout: 10_000 })
    .not.toMatchObject({ tag: "BODY" });
  const afterNext = await activeElementInfo(page);
  expect(
    afterNext.tag,
    `focus after Next place must be on the new question, got ${afterNext.tag} "${afterNext.text}"`,
  ).not.toBe("BODY");
  // One Tab after must land on a control of the new question.
  await page.keyboard.press("Tab");
  const afterTab = await activeElementInfo(page);
  expect(afterTab.tag, "one Tab after Next place must land on a control").toMatch(/^(BUTTON|A|INPUT|SELECT)$/);
  expect(afterTab.visible, "the Tab landing control must be visible").toBe(true);
  expect(
    afterTab.inMap || afterTab.tag === "BUTTON",
    `Tab landing must be a control of the new question, got ${afterTab.tag} "${afterTab.label || afterTab.text}"`,
  ).toBe(true);
  // The live region must announce the new question.
  await expect
    .poll(() => gameLiveText(page), { timeout: 10_000 })
    .toMatch(/^Find .+\.$/);
});

test("3C Game summary dialog traps focus, closes on Escape, returns focus", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await page.getByTestId("end-game-button").click();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // Sub-assertion 1: initial focus inside the dialog.
  const initial = await activeElementInfo(page);
  expect(initial.inDialog, `initial focus must be inside the dialog, got ${initial.tag}`).toBe(true);
  // Sub-assertion 2: bounded Tab walk (max 40) never leaves the dialog.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await activeElementInfo(page);
    expect(info.inDialog, `Tab ${i + 1} left the dialog to ${info.tag}`).toBe(true);
  }
  // Sub-assertion 3: Escape closes it and focus returns to a VISIBLE,
  // usable control (not body, not hidden). Closing the summary lands
  // home (the End-game opener unmounts with the game), so the landing
  // is the home heading / a home control — never body.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  const afterEscape = await activeElementInfo(page);
  expect(afterEscape.tag, "focus after Escape must not be body").not.toBe("BODY");
  expect(afterEscape.visible, "focus after Escape must be on a visible control").toBe(true);
});

test("3D Zoom in announces the new level after Next place, and the map zoom actually increases", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  // Start at least 2 levels below cap (data-max-zoom); Zoom out first
  // until data-zoom <= data-max-zoom - 2, then re-read.
  const maxZoom = await readMaxZoom(page);
  for (let i = 0; i < 10; i++) {
    if ((await readZoom(page)) <= maxZoom - 2) break;
    await page.getByRole("button", { name: "Zoom out" }).click();
    await awaitZoomStable(page);
  }
  const beforeRevealZoom = await readZoom(page);
  expect(beforeRevealZoom).toBeLessThanOrEqual(maxZoom - 2);
  await commitMissObserved(page, await installLiveObserver(page));
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // Manifest-literal sequence: press Zoom in as soon as the new question
  // is live — no settle wait. A fix that only works after the 1200 ms
  // return beat has finished does not satisfy this test.
  const zoomLiveText = async (): Promise<string[]> =>
    page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('[aria-live="polite"]').forEach((el) => {
        const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
        if (/^Zoom level \d+$/.test(t)) out.push(t);
      });
      return out;
    });

  const pressZoomIn = async (): Promise<number> => {
    const before = await readZoom(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    let after = before;
    await expect
      .poll(
        async () => {
          after = await readZoom(page);
          return after;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(before);
    await expect
      .poll(() => zoomLiveText(), { timeout: 10_000 })
      .toContain(`Zoom level ${after}`);
    return after;
  };

  const z1 = await pressZoomIn();
  const z2 = await pressZoomIn();
  expect(z2).toBeGreaterThan(z1);
});

test("3E new question never re-announces the previous reveal", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const first = await commitMissObserved(page, obs);
  expect(first.announcements.length).toBeGreaterThan(0);
  const oldReveal = first.announcements[first.announcements.length - 1]!;
  const mark = await obs.length();
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect.poll(() => gameLiveText(page), { timeout: 10_000 }).toMatch(/^Find .+\.$/);
  // Settle: let any post-continue announcements land, then check.
  await page.waitForTimeout(1500);
  const after = await obs.slice(mark);
  expect(
    after,
    `new question must never re-announce the previous reveal ${JSON.stringify(oldReveal)}; saw ${JSON.stringify(after)}`,
  ).not.toContain(oldReveal);
});

test("3F(1) two reveals back to back announce only the second, once", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const first = await commitMissObserved(page, obs);
  expect(first.announcements).toHaveLength(1);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const second = await commitMissObserved(page, obs);
  expect(
    second.announcements,
    `second reveal must announce exactly once, got ${JSON.stringify(second.announcements)}`,
  ).toHaveLength(1);
  expect(second.announcements[0]).not.toBe(first.announcements[0]);
});

test("visual: reveal + summary dialog at 360x740 and 390x844, floating controls do not overlap", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  await commitMissObserved(page, await installLiveObserver(page));
  for (const [w, h] of [
    [360, 740],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expect(nextPlaceButton(page)).toBeVisible();
    await page.screenshot({ path: `test-results/round-loop-a11y-reveal-${w}.png` });
    // Floating controls must not intersect each other: Zoom in vs Zoom
    // out are the floating pair on the reveal surface (stacked column).
    const overlaps = await page.evaluate(() => {
      const zi = document.querySelector('button[aria-label="Zoom in"]') as HTMLElement | null;
      const zo = document.querySelector('button[aria-label="Zoom out"]') as HTMLElement | null;
      if (!zi || !zo) return { controls: 0, overlaps: -1 };
      const a = zi.getBoundingClientRect();
      const b = zo.getBoundingClientRect();
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { controls: 2, overlaps: x > 0 && y > 0 ? 1 : 0 };
    });
    expect(overlaps.controls).toBe(2);
    expect(overlaps.overlaps, `floating zoom controls overlap at ${w}x${h}`).toBe(0);
  }
  // Summary dialog screenshot at both viewports.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByTestId("end-game-button").click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  for (const [w, h] of [
    [360, 740],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: `test-results/round-loop-a11y-summary-${w}.png` });
    const overlaps = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return { controls: 0, overlaps: -1 };
      const boxes: DOMRect[] = [];
      dlg.querySelectorAll("button").forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) boxes.push(r);
      });
      let count = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (x > 0 && y > 0) count++;
        }
      }
      return { controls: boxes.length, overlaps: count };
    });
    expect(overlaps.controls).toBeGreaterThan(0);
    expect(overlaps.overlaps, `dialog buttons overlap at ${w}x${h}`).toBe(0);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
});
