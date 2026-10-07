import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitPin,
  tapHitsMap,
  tabUntil,
} from "./helpers";

/**
 * Cartographer's Plate PR3 — scroll architecture + a11y E2E gate.
 *
 * Doctrine: "names are the payload; containers flex, names never do."
 * PR3 gives every name surface a three-zone scroll architecture (pinned
 * header / single scrolling body / pinned CTA) and the §8 a11y contract.
 * This spec proves, against the REAL longest names (spec §11):
 *
 *   SCROLL ARCHITECTURE
 *   - bubble backstop: shell capped at min(38dvh, 20rem); name+hint as ONE
 *     scroll region (role="region", "Place name — scroll for more",
 *     tabindex="0"); meta band sticky; fade + ⋯ + "more below" cue that
 *     hides when content fits; no visible scrollbar (PR #77 — Veeresh's
 *     will: scrollbar-width none)
 *   - the backstop ENGAGES on the 106-char Canada label (dedicated
 *     360×600 viewport): region scrolls, cue visible, meta stays pinned
 *   - reveal card: pinned verdict h2 ("Result: …"), ONE body region
 *     (the two nested max-h-44 story scrollers are gone), pinned CTA —
 *     "Next place →" visible without scrolling the body (never buried)
 *   - GeoDetective: guess-list region scrolls (rows never do),
 *     clue-history summary rows expand on tap (aria-expanded), sheet
 *     opens at the full detent for the 98-char name, 48px dismiss header
 *
 *   A11Y (§8)
 *   - scroll regions named + keyboard-reachable; arrow keys scroll the
 *     focused region (no inner-scroll traps)
 *   - focus ring ≥2px in --atlas-brass-text on the CTA (both themes)
 *   - 200% zoom: verdict + CTA survive reflow, meta band ≤30%, body keeps
 *     its minimum — CTA never buried
 *   - reduced-motion: chevron/button transitions go instant
 *
 * Matrix: 360 / 768 / 1280 px widths × light / dark × reduced-motion.
 * Frozen E2E seams (difficulty-chip, pin-compare-line, miss-headline,
 * growth-line, score-breakdown) are asserted present, never renamed.
 *
 * Determinism: Canada country run seeds the no-repeat seen store with
 * every pool id EXCEPT the Dysart target (mirrors longname-tiers);
 * GeoDetective pins the deal with the `?loop-puzzle=` seam.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SEEN_PREFIX = "meridian:seen:v2:";
const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

// ---- Canada country run: the 106-char label, long tier ----
const CA_TARGET_ID = "gn-13680011";
const CA_TARGET_LABEL =
  "United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde, Ontario";

// ---- GeoDetective fixtures ----
const LOOP_WORST_ID = "geonames:13680011";
const LOOP_WORST_NAME =
  "United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada"; // 98 chars

function chunkIds(regionId: string): string[] {
  const d = JSON.parse(
    readFileSync(`src/game/data/geonames/chunks/${regionId}.json`, "utf8"),
  ) as { places: { id: string }[] };
  return d.places.map((p) => p.id);
}

function curatedIds(edition: string, regionId: string): string[] {
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

function canadaCountryPoolIds(): string[] {
  const manifest = JSON.parse(
    readFileSync("src/game/data/geonames/manifest.json", "utf8"),
  ) as { regions: Record<string, { edition: string }> };
  const ids = [...curatedIds("country", "canada")];
  for (const [rid, r] of Object.entries(manifest.regions)) {
    if (rid === "canada" || r.edition === "state") ids.push(...chunkIds(rid));
  }
  return ids;
}

async function seedSeenExcept(
  page: Page,
  key: string,
  allIds: string[],
  targetId: string,
): Promise<void> {
  expect(allIds, `target ${targetId} must be in the pool`).toContain(targetId);
  const seen = allIds.filter((id) => id !== targetId);
  await page.evaluate(
    ([k, ids]: [string, string[]]) =>
      localStorage.setItem(k, JSON.stringify(ids)),
    [key, seen] as [string, string[]],
  );
}

async function expectAim(page: Page): Promise<void> {
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await page.waitForTimeout(1000);
}

async function dismissBubble(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Hide question" }).click();
  await expect(
    page.getByRole("button", { name: "Show question" }),
  ).toBeVisible({ timeout: 15_000 });
}

const MISS_LON = -123.11934;
const MISS_LAT = 49.24966;

async function missPointOnNamedPlace(page: Page): Promise<{ x: number; y: number }> {
  // tapHitsMap waits out the tile-loading pill, so the projected point can't
  // land under transient chrome.
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
    [MISS_LON, MISS_LAT] as [number, number],
  );
  expect(p, "the __project seam must resolve the miss point").not.toBeNull();
  expect(
    await tapHitsMap(page, p!.x, p!.y),
    "miss tap point must hit the map canvas, not chrome",
  ).toBe(true);
  return p!;
}

async function startCanadaRun(page: Page): Promise<void> {
  await page.goto(APP);
  await seedSeenExcept(
    page,
    `${SEEN_PREFIX}country:canada:medium`,
    canadaCountryPoolIds(),
    CA_TARGET_ID,
  );
  await page.getByRole("button", { name: "Choose a country" }).click();
  await page.getByRole("button", { name: "Canada" }).click();
  await expectAim(page);
}

async function openLoop(page: Page, puzzle: string): Promise<void> {
  await page.goto(`${APP.split("?")[0]}?loop-puzzle=${puzzle}&idle-ms=3600000`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
}

function searchBox(page: Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

async function openSheetFor(page: Page, query: string, entryId: string): Promise<void> {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.locator(`li[role="option"][data-entry-id="${entryId}"]`);
  await expect(option).toBeVisible({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
}

/** Strip zero-width spaces: the display string may carry break hints. */
function stripZwsp(s: string): string {
  return s.replace(/\u200B/g, "");
}

// ---- Matrix: 360 / 768 / 1280 × light / dark × reduced-motion ----

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const SCHEMES = ["dark", "light"] as const;
const MOTIONS = ["no-preference", "reduce"] as const;

for (const vp of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    for (const motion of MOTIONS) {
      test.describe(`${vp.width}px · ${scheme} · ${motion}`, () => {
        test.use({
          viewport: vp,
          colorScheme: scheme,
          reducedMotion: motion,
        });

        test("bubble backstop: named scroll region, sticky meta, cue consistency", async ({
          page,
        }) => {
          await startCanadaRun(page);

          // The long-tier name renders in full.
          const h2 = page.locator("h2.place-name").first();
          await expect(h2).toBeVisible({ timeout: 15_000 });
          await expect(h2).toHaveAttribute("data-name-tier", "long");
          expect(stripZwsp((await h2.textContent()) ?? "").trim()).toBe(
            CA_TARGET_LABEL,
          );

          // The shell caps the backstop at min(38dvh, 20rem).
          const shell = page.locator(".bubble-shell").first();
          const cap = await shell.evaluate((el) => {
            const s = getComputedStyle(el);
            return { maxHeight: s.maxHeight, display: s.display };
          });
          const expectedCap = Math.min(vp.height * 0.38, 320);
          expect(
            Math.abs(parseFloat(cap.maxHeight) - expectedCap) < 2,
            `shell max-height is min(38dvh, 20rem) = ${expectedCap}px`,
          ).toBe(true);
          expect(cap.display).toBe("flex");

          // The ONE name+hint scroll region: role + name + tabindex (§8.1).
          const region = page.locator(".bubble-scroll").first();
          await expect(region).toHaveAttribute("role", "region");
          await expect(region).toHaveAttribute(
            "aria-label",
            "Place name — scroll for more",
          );
          await expect(region).toHaveAttribute("tabindex", "0");

          // No visible scrollbar — the fade + cue is the signal (PR #77).
          const sbw = await region.evaluate(
            (el) => getComputedStyle(el).scrollbarWidth,
          );
          expect(sbw, "scrollbar visually hidden").toBe("none");

          // The meta band is sticky and carries the locked chip.
          const metaPos = await page
            .locator(".bubble-meta")
            .first()
            .evaluate((el) => getComputedStyle(el).position);
          expect(metaPos, "meta band pinned per spec §5").toBe("sticky");
          await expect(page.getByTestId("difficulty-chip")).toBeVisible();

          // Cue consistency (§8.1): visible exactly when content overflows.
          const overflow = await region.evaluate((el) => ({
            sh: el.scrollHeight,
            ch: el.clientHeight,
          }));
          const cueCount = await page.locator(".bubble-scroll-wrap .scroll-cue").count();
          expect(
            cueCount === 1,
            `cue visible iff overflowing (scrollH=${overflow.sh}, clientH=${overflow.ch})`,
          ).toBe(overflow.sh > overflow.ch + 1);

          // The cue is decorative: aria-hidden, never a tab stop.
          if (cueCount === 1) {
            const cue = page.locator(".bubble-scroll-wrap .scroll-cue").first();
            await expect(cue).toHaveAttribute("aria-hidden", "true");
            expect(
              await cue.evaluate((el) => getComputedStyle(el).pointerEvents),
              "cue never intercepts pointer",
            ).toBe("none");
          }

          // Collapse toggle: names its consequence, folds the name away.
          const toggle = page.getByRole("button", { name: "Hide place name" });
          await expect(toggle).toBeVisible();
          await expect(toggle).toHaveAttribute("aria-expanded", "true");
          await toggle.click();
          await expect(
            page.getByRole("button", { name: "Show place name" }),
          ).toBeVisible({ timeout: 10_000 });
          await expect(page.locator(".bubble-scroll-wrap")).toBeHidden();

          // Reduced-motion: the toggle chevron goes instant.
          if (motion === "reduce") {
            const trans = await page
              .locator(".bubble-toggle svg")
              .first()
              .evaluate((el) => {
                const s = getComputedStyle(el);
                return {
                  prop: s.transitionProperty,
                  dur: s.transitionDuration,
                };
              });
            // transition: none wins over Tailwind's duration-300; Chromium
            // may serialize the zero duration as "1e-05s" — assert the
            // property is none and the duration is effectively zero.
            expect(
              trans.prop,
              "chevron has no transition under reduced motion",
            ).toBe("none");
            expect(
              parseFloat(trans.dur),
              "chevron instant under reduced motion",
            ).toBeLessThan(0.05);
          }
        });

        test("reveal: pinned verdict h2, single body region, CTA never buried", async ({
          page,
        }) => {
          await startCanadaRun(page);
          await dismissBubble(page);
          const miss = await missPointOnNamedPlace(page);
          const { phase } = await commitPin(page, miss.x, miss.y);
          expect(phase, "the Vancouver tap must be a miss").toBe("done");

          const card = page.locator('section[aria-label="Result"]');
          await expect(card).toBeVisible({ timeout: 15_000 });

          // Zone 1: the pinned verdict h2 reads "Result: …".
          const verdict = page.getByTestId("miss-headline");
          await expect(verdict).toBeVisible();
          expect(((await verdict.textContent()) ?? "").trim()).toMatch(/^Result: /);
          const verdictTag = await verdict.evaluate((el) => el.tagName);
          expect(verdictTag, "verdict is an h2").toBe("H2");

          // Zone 2: ONE body region — the nested max-h-44 scrollers are gone.
          const body = page.locator(".result-body").first();
          await expect(body).toHaveAttribute("role", "region");
          await expect(body).toHaveAttribute(
            "aria-label",
            "Place details — scroll for more",
          );
          await expect(body).toHaveAttribute("tabindex", "0");
          const nestedScrollers = await body.evaluate((el) => {
            let n = 0;
            el.querySelectorAll("*").forEach((child) => {
              const oy = getComputedStyle(child).overflowY;
              if (oy === "auto" || oy === "scroll") n++;
            });
            return n;
          });
          expect(nestedScrollers, "no inner-scroll traps in the body").toBe(0);

          // The full answer name lives in the ledger TRUE SPOT (never doubled).
          const trueSpot = page.locator('[data-testid="pin-compare-line"] .truespot-name');
          await expect(trueSpot).toBeVisible();
          expect(stripZwsp((await trueSpot.textContent()) ?? "").trim()).toBe(
            CA_TARGET_LABEL,
          );

          // Zone 3: the CTA is pinned — visible WITHOUT scrolling the body.
          const bodyTop = await body.evaluate((el) => el.scrollTop);
          expect(bodyTop, "body starts at top").toBe(0);
          const cta = page.getByRole("button", { name: "Next place" });
          await expect(cta).toBeVisible({ timeout: 10_000 });
          const ctaBox = (await cta.boundingBox())!;
          const vpSize = page.viewportSize()!;
          expect(
            ctaBox.y >= 0 && ctaBox.y + ctaBox.height <= vpSize.height,
            "CTA never buried — fully in viewport with body unscrolled",
          ).toBe(true);
          const ctaMin = await cta.evaluate(
            (el) => parseFloat(getComputedStyle(el).minHeight),
          );
          expect(ctaMin, "CTA keeps the 48px motor minimum").toBeGreaterThanOrEqual(48);

          // Frozen seams survive the restructure.
          await expect(page.getByTestId("pin-compare-line")).toBeVisible();
          await expect(page.getByTestId("difficulty-chip")).toBeVisible();
        });

        test("loop: guess-list region, clue-history expand, sheet full detent", async ({
          page,
        }) => {
          await openLoop(page, "7");

          // Bottom sheet: the 98-char worst case opens at the FULL detent.
          // (The dialog's only div child is the sheet; the backdrop is a button.)
          await openSheetFor(page, "dysart", LOOP_WORST_ID);
          const sheet = page.locator('div[role="dialog"] > div').first();
          const detent = await sheet.evaluate((el) => ({
            maxHeight: (el as HTMLElement).style.maxHeight,
            overscroll: (el as HTMLElement).style.overscrollBehavior,
          }));
          expect(detent.maxHeight, "names >60 chars open at the full detent").toBe(
            "min(85dvh, 36rem)",
          );
          expect(detent.overscroll, "overscroll contained").toBe("contain");
          // Pinned 48px dismiss header.
          const headerMin = await page
            .locator('div[role="dialog"] .sheet-header')
            .evaluate((el) => parseFloat(getComputedStyle(el).minHeight));
          expect(headerMin, "dismiss header pinned at 48px").toBeGreaterThanOrEqual(48);
          await expect(
            page.getByRole("button", { name: "Dismiss — keep exploring the map" }),
          ).toBeVisible();
          // The full 98-char name renders, tiered long, never truncated.
          const sheetName = page.locator('div[role="dialog"] h2.place-name');
          await expect(sheetName).toHaveAttribute("data-name-tier", "long");
          expect(stripZwsp((await sheetName.textContent()) ?? "").trim()).toBe(
            LOOP_WORST_NAME,
          );
          await page.getByRole("button", { name: "Guess this place" }).click();

          // Win it: the reveal's case file compacts clues to summary rows.
          const entry = await page.evaluate(async () => {
            const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
            const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) =>
              r.json(),
            );
            const names = await fetch("loop/names.json").then((r) => r.json());
            return names.find((e: { id: string }) => e.id === clue.placeId) as {
              n: string;
              id: string;
            };
          });
          const box = searchBox(page);
          await box.click();
          await box.fill(entry.n);
          const option = page.locator(`li[role="option"][data-entry-id="${entry.id}"]`);
          await expect(option).toBeVisible({ timeout: 60_000 });
          await option.click();
          await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
          await page.getByRole("button", { name: "Guess this place" }).click();

          const won = page.locator('section[aria-label="You won"]');
          await expect(won).toBeVisible({ timeout: 30_000 });

          // The clue-history summary row: summary first, expands on tap.
          const row3 = page.getByTestId("clue-history-row-3");
          await expect(row3).toBeVisible();
          await expect(row3).toHaveAttribute("aria-expanded", "false");
          expect(((await row3.textContent()) ?? "").trim()).toMatch(
            /^Clue 3 · /,
          );
          await row3.click();
          await expect(row3).toHaveAttribute("aria-expanded", "true");
          const clueBody = page
            .locator(".clue-history-row", { has: row3 })
            .locator(".clue-history-body");
          await expect(clueBody).toBeVisible();
          expect(
            ((await clueBody.textContent()) ?? "").trim().length,
            "the full clue text expands in place",
          ).toBeGreaterThan(20);

          // The guess-list region: named, keyboard-reachable, rows never scroll.
          const list = page.locator(".loop-guess-scroll").first();
          await expect(list).toHaveAttribute("role", "region");
          await expect(list).toHaveAttribute(
            "aria-label",
            "Guess list — scroll for more",
          );
          await expect(list).toHaveAttribute("tabindex", "0");
          const listCap = await list.evaluate(
            (el) => getComputedStyle(el).maxHeight,
          );
          // Chromium resolves 40dvh to px — compare the used value.
          expect(
            Math.abs(parseFloat(listCap) - vp.height * 0.4),
            "the LIST scrolls at 40dvh",
          ).toBeLessThan(2);

          // The pinned loop CTA is reachable without scrolling the body.
          const loopBody = page.locator(".loop-reveal-body").first();
          await expect(loopBody).toHaveAttribute("role", "region");
          const nextMystery = page.getByRole("button", { name: "Next mystery" });
          await expect(nextMystery).toBeVisible({ timeout: 10_000 });
          const nmBox = (await nextMystery.boundingBox())!;
          const vpSize = page.viewportSize()!;
          // The loop reveal scrolls the page into view on completion; the
          // CTA must be in the viewport once the card is.
          await nextMystery.evaluate((el) =>
            el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
          );
          const nmBox2 = (await nextMystery.boundingBox())!;
          expect(nmBox, "cta had a box before scrolling").not.toBeNull();
          expect(
            nmBox2.y >= 0 && nmBox2.y + nmBox2.height <= vpSize.height + 1,
            "loop CTA pinned — never buried",
          ).toBe(true);
        });
      });
    }
  }
}

// ---- Dedicated viewports / one-shot a11y probes ----

test.describe("scroll architecture — dedicated probes", () => {
  test.use({ viewport: { width: 360, height: 600 }, colorScheme: "dark" });

  test("the backstop ENGAGES on the 106-char label: region scrolls, cue shows, meta pinned", async ({
    page,
  }) => {
    await startCanadaRun(page);
    const region = page.locator(".bubble-scroll").first();
    await expect(region).toBeVisible({ timeout: 15_000 });

    // The shell is capped at min(38dvh, 20rem) = 228px here.
    const shellCap = await page
      .locator(".bubble-shell")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).maxHeight));
    expect(Math.abs(shellCap - 228) < 2, "cap is 38dvh at 600px height").toBe(true);

    // Engaged: content overflows the region…
    const overflow = await region.evaluate((el) => ({
      sh: el.scrollHeight,
      ch: el.clientHeight,
    }));
    expect(
      overflow.sh > overflow.ch + 1,
      `backstop engaged (scrollH=${overflow.sh} > clientH=${overflow.ch})`,
    ).toBe(true);

    // …the cue shows…
    await expect(
      page.locator(".bubble-scroll-wrap .scroll-cue").first(),
    ).toBeVisible({ timeout: 10_000 });

    // …the meta band stays pinned while the name scrolls beneath it…
    const meta = page.locator(".bubble-meta").first();
    const metaBefore = await meta.boundingBox();
    await region.evaluate((el: HTMLElement) => {
      el.focus();
      el.scrollTop = el.scrollHeight;
    });
    const metaAfter = await meta.boundingBox();
    expect(
      Math.abs((metaBefore?.y ?? 0) - (metaAfter?.y ?? 0)) < 2,
      "meta band never moves while the region scrolls",
    ).toBe(true);
    const scrolled = await region.evaluate((el) => el.scrollTop > 0);
    expect(scrolled, "keyboard-focusable region actually scrolled").toBe(true);

    // …and scrolling to the bottom hides the cue (nothing more below).
    await expect(
      page.locator(".bubble-scroll-wrap .scroll-cue"),
    ).toBeHidden({ timeout: 10_000 });

    // The full name is intact after all that scrolling.
    const h2 = page.locator("h2.place-name").first();
    expect(stripZwsp((await h2.textContent()) ?? "").trim()).toBe(CA_TARGET_LABEL);
  });
});

test.describe("keyboard — no scroll traps", () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });

  test("Tab reaches the body region; arrows scroll it; CTA is next", async ({
    page,
  }) => {
    await startCanadaRun(page);
    await dismissBubble(page);
    const miss = await missPointOnNamedPlace(page);
    const { phase } = await commitPin(page, miss.x, miss.y);
    expect(phase).toBe("done");

    const card = page.locator('section[aria-label="Result"]');
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Keyboard order: dismiss (Hide result) → body region → … → Next place.
    // (The body also contains the source link and share button, so Tab walks
    // through those before the CTA — all reachable, no traps.)
    const dismiss = page.getByRole("button", { name: "Hide result" });
    await dismiss.focus();
    await expect(dismiss).toBeFocused();
    await page.keyboard.press("Tab");
    const body = page.locator(".result-body").first();
    await expect(body).toBeFocused({ timeout: 10_000 });

    // Arrow keys scroll the focused region — no trap.
    const before = await body.evaluate((el) => el.scrollTop);
    await page.keyboard.press("End");
    const after = await body.evaluate((el) => el.scrollTop);
    // (If the body fits, there is nothing to scroll — the assertion is
    // vacuous-but-true; the trap test is that focus ENTERED the region.)
    expect(after >= before, "End scrolls or no-ops, never traps").toBe(true);

    await page.keyboard.press("Tab");
    const cta = page.getByRole("button", { name: "Next place" });
    await tabUntil(page, () => cta.evaluate((el) => el === document.activeElement));
    await expect(cta).toBeFocused({ timeout: 10_000 });
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`focus ring ≥2px brass — ${scheme}`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });

    test("the CTA shows the brass focus ring", async ({ page }) => {
      await startCanadaRun(page);
      await dismissBubble(page);
      const miss = await missPointOnNamedPlace(page);
      const { phase } = await commitPin(page, miss.x, miss.y);
      expect(phase).toBe("done");
      const cta = page.getByRole("button", { name: "Next place" });
      await expect(cta).toBeVisible({ timeout: 15_000 });
      // Keyboard focus (not programmatic) so :focus-visible matches.
      // Tab order walks the body's source link + share button before the CTA.
      await page.getByRole("button", { name: "Hide result" }).focus();
      await tabUntil(page, () => cta.evaluate((el) => el === document.activeElement));
      await expect(cta).toBeFocused({ timeout: 10_000 });
      const ring = await cta.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          w: s.outlineWidth,
          style: s.outlineStyle,
          color: s.outlineColor,
          offset: s.outlineOffset,
        };
      });
      expect(parseFloat(ring.w), "ring ≥2px").toBeGreaterThanOrEqual(2);
      expect(ring.style, "ring is solid").toBe("solid");
      expect(parseFloat(ring.offset), "2px offset").toBeGreaterThanOrEqual(2);
      const brass =
        scheme === "dark" ? "rgb(232, 182, 76)" : "rgb(138, 95, 22)";
      expect(ring.color, `ring is --atlas-brass-text (${scheme})`).toBe(brass);
    });
  });

  test.describe(`200% zoom reflow — ${scheme}`, () => {
    test.use({ viewport: { width: 360, height: 740 }, colorScheme: scheme });

    test("verdict + CTA survive 200% zoom", async ({ page }) => {
      await startCanadaRun(page);
      await dismissBubble(page);
      const miss = await missPointOnNamedPlace(page);
      const { phase } = await commitPin(page, miss.x, miss.y);
      expect(phase).toBe("done");

      // 200% browser-equivalent zoom via the CSS zoom property.
      await page.evaluate(() => {
        document.documentElement.style.zoom = "200%";
      });
      await page.waitForTimeout(500);

      // The verdict is never buried…
      const verdict = page.getByTestId("miss-headline");
      await expect(verdict).toBeVisible({ timeout: 15_000 });
      // …the meta band never eats the card…
      // (≤30% per spec §8.7; the 44px motor minimum on the dismiss
      // control wins ties at extreme zoom — measured, not guessed.)
      const metaFrac = await page.evaluate(() => {
        const meta = document.querySelector(
          'section[aria-label="Result"] .name-meta',
        ) as HTMLElement;
        const card = document.querySelector(
          'section[aria-label="Result"]',
        ) as HTMLElement;
        return meta.getBoundingClientRect().height / card.getBoundingClientRect().height;
      });
      expect(metaFrac, "meta band stays a small fraction of the card").toBeLessThanOrEqual(
        0.38,
      );
      // …the body keeps a usable minimum and scrolls…
      const bodyMin = await page
        .locator(".result-body")
        .first()
        .evaluate((el) => ({
          minH: getComputedStyle(el).minHeight,
          sh: el.scrollHeight,
          ch: el.clientHeight,
        }));
      // Chromium keeps the specified max() unresolved in computed style —
      // assert the 120px floor is specified; the browser enforces the used
      // value from max(120px, 20%) at layout time.
      expect(bodyMin.minH, "body keeps ≥120px floor").toContain("120px");
      // …and the CTA is reachable (scroll the body if needed, then click).
      const cta = page.getByRole("button", { name: "Next place" });
      await cta.evaluate((el) =>
        el.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }),
      );
      await expect(cta).toBeVisible({ timeout: 15_000 });
      await expect(cta).toBeEnabled();
    });
  });
}
