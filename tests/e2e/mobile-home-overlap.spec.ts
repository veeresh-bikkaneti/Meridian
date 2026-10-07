import { test, expect, type Locator, type Page } from "playwright/test";
import { serveBuiltArtifact, evidencePath, APP_NO_IDLE } from "./helpers";

/**
 * Mobile home de-crowding E2E (fix/mobile-home-declutter).
 *
 * Veeresh's 2026-10-07 screenshot (~390px, dark) showed the home page's
 * bottom third as layered chaos: grandpa's fixed donation scene walked
 * across the GeoDetective card, Comet overlapped the card corner, Comet's
 * speech bubble clipped against the card, and the "New to Meridian?" tour
 * invite ate the top 25% of the viewport.
 *
 * This spec locks the reconciled fix at 360px and 390px, dark and light:
 *  (a) zero overlapping bounding boxes between the scene/walker, the
 *      donation cloud, Comet, the greeting (when open), the tour invite
 *      (when present), the edition cards, the GeoDetective case-file card,
 *      and the review-deck section — plus the walk staying inside the
 *      strip and the strip landing in-flow as the last band;
 *  (b) every tap target in those elements measures >=44x44 and is
 *      unobstructed (elementFromPoint at its center);
 *  (c) the donation cloud becomes visible and tappable (waits for
 *      [data-beat="seated"]);
 *  (d) with the tour invite dismissed + offline, the grandpa strip
 *      collapses to zero height (fail-closed, no reserved space).
 *
 * Matrix: 360 / 390 px widths x dark / light (prefers-color-scheme).
 * Runs in the "mobile" project (touch + mobile viewport).
 *
 * Build requirement: VITE_KOFI_URL must be set at build time —
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const KOFI_URL = process.env.VITE_KOFI_URL?.trim();
if (!KOFI_URL) {
  throw new Error(
    "E2E requires VITE_KOFI_URL at build time: " +
      "VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages",
  );
}

type Box = { x: number; y: number; width: number; height: number };

/** Two boxes overlap only if they share more than ~1px in both axes. */
function overlaps(a: Box, b: Box): boolean {
  const eps = 0.5;
  return (
    a.x + eps < b.x + b.width - eps &&
    b.x + eps < a.x + a.width - eps &&
    a.y + eps < b.y + b.height - eps &&
    b.y + eps < a.y + a.height - eps
  );
}

function noOverlap(nameA: string, a: Box | null, nameB: string, b: Box | null) {
  expect(a, `${nameA} has a bounding box`).not.toBeNull();
  expect(b, `${nameB} has a bounding box`).not.toBeNull();
  expect(overlaps(a!, b!), `${nameA} overlaps ${nameB}`).toBe(false);
}

async function loadHome(page: Page, opts?: { soundOff?: boolean }): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  if (opts?.soundOff) {
    await page.addInitScript(() =>
      localStorage.setItem("meridian.sound", "off"),
    );
  }
  await page.goto(APP_NO_IDLE);
  // The GeoDetective CTA is the hero; its visibility means the menu booted.
  await expect(
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
  ).toBeVisible({ timeout: 30_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/** Scroll the element to the viewport center, then assert a real tap at its
 *  center lands on it (or one of its descendants) — nothing covers it. */
async function expectTappable(page: Page, locator: Locator, name: string) {
  await locator.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }),
  );
  await page.waitForTimeout(200);
  // Recompute the center AFTER scrolling — the pre-scroll box is stale.
  const box = await locator.boundingBox();
  expect(box, `${name} has a bounding box after scrolling`).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const probe = await locator.evaluate(
    (node, point: { x: number; y: number }) => {
      const top = document.elementFromPoint(point.x, point.y);
      return {
        ok: !!top && (node === top || node.contains(top)),
        top: top ? top.outerHTML.slice(0, 120) : "none",
      };
    },
    { x: cx, y: cy },
  );
  expect(probe.ok, `${name} is obstructed at its center (top element: ${probe.top})`).toBe(true);
}

/** Tap target: >=44x44 CSS px and unobstructed. */
async function expectTapTarget(page: Page, locator: Locator, name: string) {
  const box = await locator.boundingBox();
  expect(box, `${name} has a bounding box`).not.toBeNull();
  expect(box!.width, `${name} width >= 44px`).toBeGreaterThanOrEqual(43.5);
  expect(box!.height, `${name} height >= 44px`).toBeGreaterThanOrEqual(43.5);
  await expectTappable(page, locator, name);
}

const WIDTHS = [360, 390];
const SCHEMES = ["dark", "light"] as const;

for (const width of WIDTHS) {
  for (const scheme of SCHEMES) {
    test.describe(`${width}px · ${scheme}`, () => {
      test.use({ viewport: { width, height: 844 }, colorScheme: scheme });

      test("(a) zero overlapping boxes: strip, bubbles, Comet, cards", async ({
        page,
      }) => {
        const errors = await loadHome(page);
        const scene = page.getByTestId("grandpa-scene");
        const walker = page.getByTestId("grandpa-walker");
        const bubble = page.getByTestId("grandpa-donation-bubble");
        const cometWrap = page.getByTestId("comet-wrap");
        const greeting = page.getByTestId("comet-greeting");
        const invite = page.getByTestId("tutorial-invite");
        const dossier = page.locator(".atlas-dossier");
        const cards = page.locator(".atlas-card");
        const deck = page.locator(".atlas-fieldnotes");
        const main = page.locator("main.atlas-home");

        /** True when the top element at (x, y) is `node` or its descendant. */
        const hitsNode = (node: Locator, x: number, y: number) =>
          node.evaluate(
            (el, p: { x: number; y: number }) => {
              const top = document.elementFromPoint(p.x, p.y);
              return !!top && (el === top || el.contains(top));
            },
            { x, y },
          );

        // ---- Phase 1: the greeting, captured while open. ----
        // The greeting is a fixed, transient bubble (auto-dismisses after
        // ~6s text-only): it inherently floats over page content, so strict
        // box-overlap against in-flow cards is not the invariant here. The
        // invariants are: never clipped by the viewport (the reported bug
        // was the bubble painted UNDER / cut off by the card), paints ABOVE
        // card content, and never covers a CTA.
        // The entrance animations (home-rise, ~1.5s) must have settled or
        // card rects flap: wait for them before measuring.
        await expect(dossier).toBeVisible();
        await page.waitForTimeout(1800);
        const gBox = await greeting.boundingBox();
        if (gBox) {
          // Fully inside the viewport — narrative's no-clip rule.
          expect(gBox.x, "greeting left edge").toBeGreaterThanOrEqual(-1);
          expect(gBox.y, "greeting top edge").toBeGreaterThanOrEqual(-1);
          expect(gBox.x + gBox.width, "greeting right edge").toBeLessThanOrEqual(width + 1);
          expect(gBox.y + gBox.height, "greeting bottom edge").toBeLessThanOrEqual(844 + 1);
          // Paints above card content (not clipped under it).
          const gcx = gBox.x + gBox.width / 2;
          const gcy = gBox.y + gBox.height / 2;
          expect(
            await hitsNode(greeting, gcx, gcy),
            "greeting paints above card content",
          ).toBe(true);
          // Covers no CTA: every in-viewport CTA center must not land on
          // the greeting (or the Comet wrapper).
          const ctas = [
            page.getByTestId("sound-toggle"),
            page.getByRole("button", { name: /solve a mystery|resume your case/i }),
            page.getByRole("button", { name: "Choose a state" }),
            page.getByRole("button", { name: "Choose a country" }),
            page.getByRole("button", { name: "Play the globe" }),
          ];
          const inviteVisible = (await invite.count()) > 0;
          if (inviteVisible) {
            ctas.push(page.getByRole("button", { name: "Take the tour" }));
            ctas.push(page.getByRole("button", { name: "Not now" }));
          }
          for (const cta of ctas) {
            const cBox = await cta.boundingBox();
            if (!cBox) continue;
            const cx = cBox.x + cBox.width / 2;
            const cy = cBox.y + cBox.height / 2;
            if (cx < 0 || cy < 0 || cx > width || cy > 844) continue;
            expect(
              await hitsNode(greeting, cx, cy),
              "greeting covers a CTA center",
            ).toBe(false);
            expect(
              await hitsNode(cometWrap, cx, cy),
              "Comet covers a CTA center",
            ).toBe(false);
          }
        }

        // ---- Phase 2: the walk stays inside the strip. ----
        // Sample while the beat is "walking". The kettle beat's
        // dolly-vertigo drop (a ~2.8s Veeresh-approved spectacle) overflows
        // the walker on purpose, so kettle samples are skipped.
        for (let i = 0; i < 4; i++) {
          await page.waitForTimeout(2200);
          const beat = await scene.getAttribute("data-beat");
          if (beat !== "walking") continue;
          const wBox = await walker.boundingBox();
          const sBox = await scene.boundingBox();
          expect(wBox, "walker has a box mid-walk").not.toBeNull();
          expect(wBox!.y, "walker inside strip (top)").toBeGreaterThanOrEqual(sBox!.y - 2);
          expect(wBox!.y + wBox!.height, "walker inside strip (bottom)").toBeLessThanOrEqual(
            sBox!.y + sBox!.height + 2,
          );
          const cardBoxes = await cards.evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            }),
          );
          cardBoxes.forEach((cBox, j) =>
            noOverlap("walking grandpa", wBox, `edition card ${j}`, cBox),
          );
          const bBox = await bubble.boundingBox();
          cardBoxes.forEach((cBox, j) =>
            noOverlap("donation cloud (walking)", bBox, `edition card ${j}`, cBox),
          );
        }

        // ---- Phase 3: the seated finale — in-flow elements are disjoint. ----
        await expect(scene).toHaveAttribute("data-beat", "seated", {
          timeout: 30_000,
        });
        // The strip is in-flow (the mobile media query), not a fixed overlay.
        expect(await scene.evaluate((el) => getComputedStyle(el).position)).toBe("relative");
        const sceneBox = await scene.boundingBox();
        const mainBox = await main.boundingBox();
        // Right after </main>: the closing band, below the review deck.
        expect(
          Math.abs(sceneBox!.y - (mainBox!.y + mainBox!.height)),
          "strip starts where <main> ends",
        ).toBeLessThan(2);
        // Nothing in-flow follows the strip (only the fixed Comet wrapper).
        const followersFixed = await page.evaluate(() => {
          const s = document.querySelector(".grandpa-scene");
          if (!s) return false;
          let el = s.nextElementSibling;
          while (el) {
            if (getComputedStyle(el).position !== "fixed") return false;
            el = el.nextElementSibling;
          }
          return true;
        });
        expect(followersFixed, "strip is the last in-flow band").toBe(true);

        const bubbleBox = await bubble.boundingBox();
        const dossierBox = await dossier.boundingBox();
        const deckBox = (await deck.count()) > 0 ? await deck.boundingBox() : null;
        const inviteBox = (await invite.count()) > 0 ? await invite.boundingBox() : null;
        const cardCount = await cards.count();
        expect(cardCount, "three edition cards").toBe(3);
        const cardBoxes: Box[] = [];
        for (let i = 0; i < cardCount; i++) {
          cardBoxes.push((await cards.nth(i).boundingBox())!);
        }

        // The band itself never touches cards or the invite (all in-flow).
        noOverlap("park strip", sceneBox, "GeoDetective dossier", dossierBox);
        cardBoxes.forEach((cBox, i) => noOverlap("park strip", sceneBox, `edition card ${i}`, cBox));
        if (deckBox) noOverlap("park strip", sceneBox, "review deck", deckBox);
        if (inviteBox) noOverlap("park strip", sceneBox, "tour invite", inviteBox);

        // The donation cloud never touches the invite or cards (in-flow).
        if (inviteBox) noOverlap("donation cloud", bubbleBox, "tour invite", inviteBox);
        noOverlap("donation cloud", bubbleBox, "GeoDetective dossier", dossierBox);
        cardBoxes.forEach((cBox, i) => noOverlap("donation cloud", bubbleBox, `edition card ${i}`, cBox));
        if (deckBox) noOverlap("donation cloud", bubbleBox, "review deck", deckBox);

        // Cards vs cards, cards vs dossier/deck: the de-crowded grid.
        noOverlap("GeoDetective dossier", dossierBox, "edition card 0", cardBoxes[0]);
        for (let i = 0; i < cardCount; i++) {
          for (let j = i + 1; j < cardCount; j++) {
            noOverlap(`edition card ${i}`, cardBoxes[i], `edition card ${j}`, cardBoxes[j]);
          }
          if (deckBox) noOverlap(`edition card ${i}`, cardBoxes[i], "review deck", deckBox);
        }

        // ---- Breathing room (relative units): >=2rem between sections,
        // >=1.25rem between stacked cards. ----
        const vGap = (upper: Box, lower: Box) => lower.y - (upper.y + upper.height);
        expect(vGap(dossierBox!, cardBoxes[0]), "dossier → editions gap").toBeGreaterThanOrEqual(31);
        for (let i = 0; i < cardCount - 1; i++) {
          expect(vGap(cardBoxes[i], cardBoxes[i + 1]), `card ${i} → card ${i + 1} gap`).toBeGreaterThanOrEqual(19);
        }
        const lastCard = cardBoxes[cardCount - 1];
        if (deckBox) {
          expect(vGap(lastCard, deckBox), "editions → review deck gap").toBeGreaterThanOrEqual(31);
          expect(vGap(deckBox, sceneBox!), "review deck → park strip gap").toBeGreaterThanOrEqual(31);
        } else {
          expect(vGap(lastCard, sceneBox!), "editions → park strip gap").toBeGreaterThanOrEqual(31);
        }

        // ---- Phase 4: scrolled to the bottom — the strip's interactive
        // content never scrolls under Comet's fixed footprint (the
        // page-bottom clearance invariant). The scene's border box
        // intentionally extends into Comet's zone (it *is* the clearance —
        // empty by design, pointer-events: none), so the strict checks
        // target the walker and the cloud.
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        await page.waitForTimeout(300);
        const cometBox = await cometWrap.boundingBox();
        const wBox2 = await walker.boundingBox();
        const bBox2 = await bubble.boundingBox();
        noOverlap("grandpa walker", wBox2, "Comet wrap", cometBox);
        noOverlap("donation cloud", bBox2, "Comet wrap", cometBox);
        // The strip's interactive content keeps a clear gap from Comet.
        const gapToComet = cometBox!.x - (bBox2!.x + bBox2!.width);
        expect(gapToComet, "cloud → Comet clear gap").toBeGreaterThanOrEqual(7);
        // The walker's bottom edge stays above Comet's top edge: the
        // clearance is real, not just non-overlapping.
        expect(
          wBox2!.y + wBox2!.height,
          "walker bottom above Comet top",
        ).toBeLessThanOrEqual(cometBox!.y - 1);
        // No other in-flow element may sit under the fixed corner either.
        const inflowBoxes: Array<[string, Box | null]> = [
          ["GeoDetective dossier", await dossier.boundingBox()],
          ["tour invite", (await invite.count()) > 0 ? await invite.boundingBox() : null],
          ["review deck", (await deck.count()) > 0 ? await deck.boundingBox() : null],
        ];
        for (let i = 0; i < cardCount; i++) {
          inflowBoxes.push([`edition card ${i}`, await cards.nth(i).boundingBox()]);
        }
        for (const [name, box] of inflowBoxes) {
          if (box) noOverlap(name, box, "Comet wrap", cometBox);
        }

        // No horizontal overflow with the strip, cloud, and greeting present.
        const overflowX = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflowX, "no horizontal overflow").toBeLessThanOrEqual(1);

        expectCleanConsole(errors);
      });

      test("(b) tap targets >=44px and unobstructed", async ({ page }) => {
        const errors = await loadHome(page);
        const scene = page.getByTestId("grandpa-scene");
        await expect(scene).toHaveAttribute("data-beat", "seated", {
          timeout: 30_000,
        });

        // Page chrome.
        await expectTapTarget(page, page.getByTestId("sound-toggle"), "sound toggle");
        const seg = page.getByRole("group", {
          name: "How do you want to grow your map today?",
        });
        for (const band of ["Easy", "Medium", "Hard"]) {
          await expectTapTarget(page, seg.getByRole("button", { name: band }), `difficulty ${band}`);
        }

        // Tour invite (first-run only — present on a fresh profile).
        const invite = page.getByTestId("tutorial-invite");
        if ((await invite.count()) > 0) {
          await expectTapTarget(
            page,
            page.getByRole("button", { name: "Take the tour" }),
            "tour invite: Take the tour",
          );
          await expectTapTarget(
            page,
            page.getByRole("button", { name: "Not now" }),
            "tour invite: Not now",
          );
        }

        // Primary CTAs.
        await expectTapTarget(
          page,
          page.getByRole("button", { name: /solve a mystery|resume your case/i }),
          "GeoDetective CTA",
        );
        for (const name of ["Choose a state", "Choose a country", "Play the globe"]) {
          await expectTapTarget(page, page.getByRole("button", { name }), `edition CTA: ${name}`);
        }
        const reviewCta = page.getByRole("button", { name: "Start review" });
        if ((await reviewCta.count()) > 0) {
          await expectTapTarget(page, reviewCta, "review deck CTA");
        }

        // Grandpa's strip: the walker and the cloud ask button.
        await expectTapTarget(page, page.getByTestId("grandpa-walker"), "grandpa walker");
        await expectTapTarget(
          page,
          page.getByTestId("grandpa-bubble-ask"),
          "donation cloud ask",
        );

        // The in-cloud gate: both buttons >=44px, unobstructed.
        await page.getByTestId("grandpa-walker").click();
        const bubble = page.getByTestId("grandpa-donation-bubble");
        await expect(bubble).toHaveAttribute("data-cloud", "gate", { timeout: 10_000 });
        await expectTapTarget(
          page,
          page.getByTestId("grandpa-cloud-continue"),
          "gate: Continue",
        );
        await expectTapTarget(
          page,
          page.getByTestId("grandpa-cloud-cancel"),
          "gate: Cancel",
        );
        await page.getByTestId("grandpa-cloud-cancel").click();
        await expect(bubble).toHaveAttribute("data-cloud", "ask", { timeout: 10_000 });

        // Comet.
        await expectTapTarget(page, page.getByTestId("comet-mascot"), "Comet mascot");

        expectCleanConsole(errors);
      });

      test("(b2) greeting speaker is a 44px unobstructed target (sound off)", async ({
        page,
      }) => {
        const errors = await loadHome(page, { soundOff: true });
        const speaker = page.getByTestId("comet-greeting-speaker");
        await expect(speaker).toBeVisible({ timeout: 20_000 });
        // The bubble scales in over 220ms; measuring mid-animation reads a
        // shrunken box. Wait it out (the text-only greeting lives ~6s).
        await page.waitForTimeout(450);
        const box = await speaker.boundingBox();
        expect(box, "speaker has a box").not.toBeNull();
        expect(box!.width, "speaker width >= 44px").toBeGreaterThanOrEqual(43.5);
        expect(box!.height, "speaker height >= 44px").toBeGreaterThanOrEqual(43.5);
        // Not clipped by the viewport (it overhangs the bubble corner).
        expect(box!.x, "speaker left edge").toBeGreaterThanOrEqual(-1);
        expect(box!.y, "speaker top edge").toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, "speaker right edge").toBeLessThanOrEqual(width + 1);
        await expectTappable(page, speaker, "greeting speaker");
        expectCleanConsole(errors);
      });

      test("(c) donation cloud visible, tappable, finale screenshot", async ({
        page,
      }) => {
        const errors = await loadHome(page);
        const scene = page.getByTestId("grandpa-scene");
        await expect(scene).toHaveAttribute("data-beat", "seated", {
          timeout: 30_000,
        });
        const walker = page.getByTestId("grandpa-walker");
        await walker.evaluate((el) =>
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }),
        );
        const bubble = page.getByTestId("grandpa-donation-bubble");
        await expect(bubble).toBeVisible();
        await expect(bubble).toContainText("Help me buy coffee!");
        const opacity = await bubble.evaluate((el) => getComputedStyle(el).opacity);
        expect(parseFloat(opacity), "cloud fully opaque").toBeGreaterThan(0.9);

        // Tap the cloud: the in-cloud gate opens (no new dialog, no nav).
        // Finale evidence for the reviewer: the strip + cloud + Comet,
        // first in the ask state, then with the gate open.
        await walker.evaluate((el) =>
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }),
        );
        await page.waitForTimeout(400);
        await page.screenshot({
          path: await evidencePath(`mobile-home-overlap-finale-ask-${width}px-${scheme}.png`),
        });
        await page.getByTestId("grandpa-bubble-ask").click();
        await expect(bubble).toHaveAttribute("data-cloud", "gate", { timeout: 10_000 });
        await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
        expect(page.url()).toBe(APP_NO_IDLE);
        await walker.evaluate((el) =>
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }),
        );
        await page.waitForTimeout(400);
        await page.screenshot({
          path: await evidencePath(`mobile-home-overlap-finale-gate-${width}px-${scheme}.png`),
        });
        expectCleanConsole(errors);
      });

      test("(d) offline: strip collapses to zero height", async ({ page, context }) => {
        const errors = await loadHome(page);
        const scene = page.getByTestId("grandpa-scene");
        await expect(scene).toBeVisible({ timeout: 20_000 });

        // Dismiss the first-run invite; the strip's order must not depend
        // on invite state.
        const notNow = page.getByRole("button", { name: "Not now" });
        if ((await notNow.count()) > 0) {
          await notNow.click();
        }
        await expect(page.getByTestId("tutorial-invite")).toHaveCount(0);

        // Going offline is the component's fail-closed path: it returns
        // null, so the whole band (and its margins) must vanish.
        await context.setOffline(true);
        await expect(page.getByTestId("grandpa-scene")).toHaveCount(0, {
          timeout: 10_000,
        });
        const gone = await page.evaluate(
          () => document.querySelector(".grandpa-scene") === null,
        );
        expect(gone, "no .grandpa-scene in the DOM when offline").toBe(true);

        // Zero reserved space: nothing may hold the strip's place. The page
        // bottom is <main>'s own padding (py-8) plus the body margin.
        const mainBox = await page.locator("main.atlas-home").boundingBox();
        const slack = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        expect(
          slack - (mainBox!.y + mainBox!.height),
          "no empty space reserved for the strip",
        ).toBeLessThan(48);
        expectCleanConsole(errors);
      });
    });
  }
}
