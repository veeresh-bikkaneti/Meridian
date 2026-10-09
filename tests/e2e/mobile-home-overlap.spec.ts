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
 *      donation cloud, the banner-zone Comet emblem, the greeting (when
 *      open), the tour invite (when present), the edition cards, the
 *      GeoDetective case-file card, and the review-deck section — plus the
 *      walk staying inside the strip and the strip landing in-flow as the
 *      last band;
 *  (a2) the banner zone itself: the in-flow Comet emblem (64px) and its
 *      downward-opening greeting never overlap the tour invite, the sound
 *      toggle, the h1, or the tagline;
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
        // The greeting is an in-flow bubble below the banner emblem (opens
        // downward, tail up; auto-dismisses after ~6s text-only). Being
        // in-flow, strict box-overlap against in-flow cards is not the
        // invariant here. The invariants are: never clipped by the
        // viewport (the reported bug was the old fixed bubble painted
        // UNDER / cut off by the card), paints ABOVE card content, and
        // never covers a CTA.
        // The entrance animations (home-rise, ~1.5s) must have settled or
        // card rects flap: wait for them before measuring.
        // NOTE: on a fresh profile the tutorial invite suppresses the
        // auto-greeting (suppressAuto), and the tour walk dismisses it —
        // so the bubble is usually absent here; measure it only if present.
        await expect(dossier).toBeVisible();
        await page.waitForTimeout(1800);
        // The greeting may have been dismissed by Grandpa's tour walk
        // (it dismisses the transient greeting when the walk starts) — only
        // measure it if it's still in the DOM.
        const gBox =
          (await greeting.count()) > 0 ? await greeting.boundingBox() : null;
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
        // Nothing in-flow follows the strip: Comet's old fixed wrapper is
        // retired (it hosts from the header now), so the strip is simply
        // the last element on the page.
        const followers = await page.evaluate(() => {
          const s = document.querySelector(".grandpa-scene");
          if (!s) return ["no scene"];
          const out: string[] = [];
          let el = s.nextElementSibling;
          while (el) {
            out.push(`${el.tagName.toLowerCase()}.${String(el.className)}`);
            el = el.nextElementSibling;
          }
          return out;
        });
        expect(followers, "strip is the last in-flow band").toEqual([]);

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

        // ---- Phase 4: the banner zone is the new overlap territory.
        // Comet retired its fixed bottom-right footprint — it hosts from
        // the header now (in-flow, right of the h1), so the old page-bottom
        // clearance checks are gone. The invariants: the emblem and the
        // (in-flow, downward-opening) greeting never touch the sound
        // toggle, the h1, the tagline, or the tour invite.
        await cometWrap.evaluate((el) =>
          el.scrollIntoView({ block: "start", inline: "center", behavior: "instant" as ScrollBehavior }),
        );
        await page.waitForTimeout(300);
        const cWrapBox = await page.locator(".comet-emblem").boundingBox();
        const soundBox = await page.getByTestId("sound-toggle").boundingBox();
        const h1Box = await page.locator("h1.atlas-title").boundingBox();
        const taglineBox = await page.locator(".atlas-tagline").boundingBox();
        noOverlap("Comet emblem", cWrapBox, "sound toggle", soundBox);
        noOverlap("Comet emblem", cWrapBox, "h1", h1Box);
        noOverlap("Comet emblem", cWrapBox, "tagline", taglineBox);
        const inviteBox2 = (await invite.count()) > 0 ? await invite.boundingBox() : null;
        if (inviteBox2) noOverlap("Comet emblem", cWrapBox, "tour invite", inviteBox2);
        // The greeting only opens once the invite is dismissed (suppressAuto)
        // and the tour walk dismisses it — measure it only when present.
        const gBox2 = (await greeting.count()) > 0 ? await greeting.boundingBox() : null;
        if (gBox2) {
          noOverlap("greeting", gBox2, "sound toggle", soundBox);
          noOverlap("greeting", gBox2, "h1", h1Box);
          noOverlap("greeting", gBox2, "tagline", taglineBox);
          if (inviteBox2) noOverlap("greeting", gBox2, "tour invite", inviteBox2);
        }

        // No horizontal overflow with the strip, cloud, and greeting present.
        const overflowX = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflowX, "no horizontal overflow").toBeLessThanOrEqual(1);

        expectCleanConsole(errors);
      });

      test("(a2) banner zone: Comet emblem + bubble never overlap banner chrome", async ({
        page,
      }) => {
        // Veeresh 2026-10-07: Comet hosts from the banner — in-flow, right
        // of the h1. The banner zone is the new overlap territory: the
        // emblem (64px) and the downward-opening greeting must not touch
        // the tour invite, the sound toggle, the h1, or the tagline.
        const errors = await loadHome(page);
        const wrap = page.getByTestId("comet-wrap");
        // The layout box is the emblem lockup: the mascot SVG overflows it
        // by design (overflow: visible tail/sparkle), and the wrap contains
        // the bubble — neither is the right "emblem" box.
        const emblem = page.locator(".comet-emblem");
        const sound = page.getByTestId("sound-toggle");
        const h1 = page.locator("h1.atlas-title");
        const tagline = page.locator(".atlas-tagline");
        const invite = page.getByTestId("tutorial-invite");
        const greeting = page.getByTestId("comet-greeting");
        await expect(wrap).toBeVisible();
        // The entrance animations (home-rise, ~1.5s) must have settled.
        await page.waitForTimeout(1800);

        // Emblem vs invite first — the invite suppresses the greeting
        // (suppressAuto), so it is up on a fresh profile.
        const eBox = await emblem.boundingBox();
        const soundBox = await sound.boundingBox();
        const h1Box = await h1.boundingBox();
        const taglineBox = await tagline.boundingBox();
        if ((await invite.count()) > 0) {
          noOverlap("Comet emblem", eBox, "tour invite", await invite.boundingBox());
        }
        noOverlap("Comet emblem", eBox, "sound toggle", soundBox);
        noOverlap("Comet emblem", eBox, "h1", h1Box);
        noOverlap("Comet emblem", eBox, "tagline", taglineBox);

        // Dismiss the invite → the greeting starts once, opening below the
        // emblem. It must stay clear of the banner chrome too.
        const notNow = page.getByRole("button", { name: "Not now" });
        if ((await notNow.count()) > 0) {
          await notNow.click();
        }
        await expect(greeting).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(450);
        // Re-measure: the invite is in-flow, so the banner shifts up when
        // it unmounts.
        const eBox2 = await emblem.boundingBox();
        const gBox = await greeting.boundingBox();
        expect(gBox!.y, "bubble opens below the emblem").toBeGreaterThanOrEqual(
          eBox2!.y + eBox2!.height - 2,
        );
        const soundBox2 = await sound.boundingBox();
        const h1Box2 = await h1.boundingBox();
        const taglineBox2 = await tagline.boundingBox();
        noOverlap("greeting", gBox, "sound toggle", soundBox2);
        noOverlap("greeting", gBox, "h1", h1Box2);
        noOverlap("greeting", gBox, "tagline", taglineBox2);

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
        // No tour walk: it auto-scrolls (skewing elementFromPoint probes)
        // and dismisses the transient greeting when the walk starts.
        await page.addInitScript(() => {
          try {
            const d = new Date();
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
              d.getDate(),
            ).padStart(2, "0")}`;
            localStorage.setItem("meridian.grandpaTour.lastDate", k);
          } catch {
            /* private mode — ignore */
          }
        });
        const errors = await loadHome(page, { soundOff: true });
        // The tutorial invite suppresses the auto-greeting (suppressAuto):
        // dismiss it so the greeting can start.
        const notNow = page.getByRole("button", { name: "Not now" });
        if ((await notNow.count()) > 0) {
          await notNow.click();
        }
        await expect(page.getByTestId("tutorial-invite")).toHaveCount(0);
        const speaker = page.getByTestId("comet-greeting-speaker");
        await expect(speaker).toBeVisible({ timeout: 20_000 });
        // The bubble scales in over 220ms; measuring mid-animation reads a
        // shrunken box. Wait it out (the text-only greeting lives ~6s).
        await page.waitForTimeout(450);
        await speaker.evaluate((el) =>
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }),
        );
        // Atomic probe: box + elementFromPoint in one evaluate, so no
        // scroll can interleave between the two reads.
        const probe = await speaker.evaluate((node) => {
          const r = (node as HTMLElement).getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const top = document.elementFromPoint(cx, cy);
          return {
            ok: !!top && (node === top || node.contains(top)),
            top: top ? top.outerHTML.slice(0, 120) : "none",
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
          };
        });
        expect(probe.w, "speaker width >= 44px").toBeGreaterThanOrEqual(43.5);
        expect(probe.h, "speaker height >= 44px").toBeGreaterThanOrEqual(43.5);
        // Not clipped by the viewport (it overhangs the bubble corner).
        expect(probe.x, "speaker left edge").toBeGreaterThanOrEqual(-1);
        expect(probe.y, "speaker top edge").toBeGreaterThanOrEqual(-1);
        expect(probe.x + probe.w, "speaker right edge").toBeLessThanOrEqual(width + 1);
        expect(probe.ok, `greeting speaker is obstructed (top: ${probe.top})`).toBe(true);
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
        await expect(bubble).toContainText("Grown-ups, buy me a coffee? ☕");
        // The cloud fades in — poll for full opacity.
        await expect
          .poll(
            async () =>
              parseFloat(
                await bubble.evaluate((el) => getComputedStyle(el).opacity),
              ),
            { timeout: 5_000 },
          )
          .toBeGreaterThan(0.9);

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
