import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact, commitHit, clickNextPlace, readPhase } from "./helpers";

/**
 * Review card action model (Tier-2 manifest 2026-10-29,
 * .council/manifests/2026-10-29-review-card-action-model.md §6).
 *
 * The home Review card leaves Form S: three explicit controls in
 * DOM = visual = tab order — [Start review (filled primary),
 * Challenge a friend — pick a map (outline pill), Start over (danger
 * footer)] — and the decorative REVIEW → cue is removed.
 *
 * Contracts locked here:
 * - Hit-testing, not geometry (Councilor C F4): elementFromPoint at
 *   each control's centre returns that control; at the heading, the
 *   due-count paragraph, and the card corners it returns the card's
 *   own elements — never the primary. The CTA carries no ::after
 *   layer any more. RED on the pre-fix build: heading/corner points
 *   return the stretched primary button.
 * - Focus order over the card's controls = the stack order in every
 *   state/flag combination (RED pre-fix: [reset, challenge, primary]).
 * - Danger presentation (C F5): the home opener's computed colour is
 *   exactly rgb(179, 55, 42) (#b3372a) in BOTH colour schemes — the
 *   --atlas-stamp token is theme-variant and its night value fails
 *   the 4.5:1 floor on the parchment card (C F2) — with underline
 *   retained and a matching 3px focus outline. ReviewComplete's
 *   opener (same component, plain surface) stays rgb(119, 89, 31):
 *   the override is Review-card-scoped (leakage check).
 * - State matrix as ORDERED IDENTITIES (bare counts can false-GREEN):
 *   due×on [primary, challenge, reset] · due×off [primary, reset] ·
 *   caught-up×on [challenge, reset] · caught-up×off [reset] ·
 *   empty []. The danger footer (with its divider) is present iff
 *   Start over is present, exactly once (C F7).
 *
 * Harness mirrors friend-challenge-mc2-review.desktop.spec.ts:
 * flags routed per test, deck seeded seed-once, built artifact.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";

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
        flags: { pwaUpdateToast: true, learningOutcomes: true, ...flags },
      }),
    });
  });
}

function deckSeed(nextDueAt: number) {
  return {
    v: 1,
    entries: {
      "e2e-deck-lincoln": {
        v: 1,
        place: {
          id: "e2e-deck-lincoln",
          name: "Lincoln",
          lon: -96.7,
          lat: 40.83,
          story: "Nebraska's capital, named for Abraham Lincoln.",
          difficulty: 2,
          edition: "state",
          regionId: "nebraska",
          regionName: "Nebraska",
          subdivision: "Nebraska",
          sourceLabel: "E2E",
          sourceHref: "https://example.com",
          mapMode: "flat",
          regionBounds: [-104.05, 39.99, -95.31, 43.0],
          radiusKm: 75,
        },
        streak: 0,
        nextDueAt,
        lastReviewedAt: 0,
        reviews: 0,
      },
    },
  };
}

async function seedDeckOn(page: Page, seed: unknown) {
  await page.addInitScript(
    ({ key, s }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
    },
    { key: DECK_KEY, s: seed },
  );
}

const CAUGHT_UP = Date.now() + 30 * 24 * 3600 * 1000;

/** Home with the Review card settled (home-rise waited out). */
async function gotoCard(page: Page) {
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  const section = page.getByTestId("tour-stop-review");
  await expect(section).toBeVisible({ timeout: 30_000 });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_700); // home-rise (~1.5s) fully settled
  return section;
}

type ControlKey = "primary" | "challenge" | "reset";

/** The card's controls in DOM order, as ordered identities. */
async function controlIdentities(page: Page): Promise<ControlKey[]> {
  return page.evaluate(() => {
    const section = document.querySelector('[data-testid="tour-stop-review"]');
    if (!section) return [];
    const keys: string[] = [];
    for (const el of section.querySelectorAll("button")) {
      if (el.getAttribute("aria-label") === "Review my misses: Start review") keys.push("primary");
      else if (el.getAttribute("data-testid") === "review-challenge-a-friend") keys.push("challenge");
      else if (el.getAttribute("data-testid") === "reset-history-open") keys.push("reset");
      else keys.push(`unknown:${el.textContent?.trim() ?? ""}`);
    }
    return keys;
  }) as Promise<ControlKey[]>;
}

test("hit-test: controls own their centres; heading/paragraph/corners hit no button", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true });
  await seedDeckOn(page, deckSeed(0));
  const section = await gotoCard(page);

  const probe = await page.evaluate(() => {
    const sec = document.querySelector('[data-testid="tour-stop-review"]')!;
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const keyOf = (el: Element | null): string => {
      if (!el) return "none";
      const btn = el.closest("button");
      if (!btn) return `non-button:${el.tagName.toLowerCase()}`;
      if (btn.getAttribute("aria-label") === "Review my misses: Start review") return "primary";
      if (btn.getAttribute("data-testid") === "review-challenge-a-friend") return "challenge";
      if (btn.getAttribute("data-testid") === "reset-history-open") return "reset";
      return "other-button";
    };
    const primary = sec.querySelector('button[aria-label="Review my misses: Start review"]')!;
    const challenge = sec.querySelector('[data-testid="review-challenge-a-friend"]')!;
    const reset = sec.querySelector('[data-testid="reset-history-open"]')!;
    const heading = sec.querySelector("h2")!;
    const dueLine = sec.querySelector('[data-testid="deck-due-count"]')!;
    const cardRect = sec.getBoundingClientRect();
    const at = (p: { x: number; y: number }) => keyOf(document.elementFromPoint(p.x, p.y));
    return {
      primaryCentre: at(centre(primary)),
      challengeCentre: at(centre(challenge)),
      resetCentre: at(centre(reset)),
      headingCentre: at(centre(heading)),
      dueLineCentre: at(centre(dueLine)),
      cornerTL: at({ x: cardRect.x + 8, y: cardRect.y + 8 }),
      cornerBR: at({ x: cardRect.x + cardRect.width - 8, y: cardRect.y + cardRect.height - 8 }),
      ctaAfterContent: getComputedStyle(primary, "::after").content,
    };
  });

  expect(probe.primaryCentre, "primary centre hits the primary").toBe("primary");
  expect(probe.challengeCentre, "challenge centre hits the challenge control").toBe("challenge");
  expect(probe.resetCentre, "reset centre hits the reset opener").toBe("reset");
  for (const [name, hit] of [
    ["heading", probe.headingCentre],
    ["due-count paragraph", probe.dueLineCentre],
    ["top-left corner", probe.cornerTL],
    ["bottom-right corner", probe.cornerBR],
  ] as const) {
    expect(hit.startsWith("non-button"), `${name} must not hit any button (hit: ${hit})`).toBe(true);
  }
  expect(probe.ctaAfterContent, "the CTA carries no ::after layer").toBe("none");
  await expect(section.locator(".hv5-review-cue")).toHaveCount(0);
});

test("stack + tab order: focus walks primary → challenge → reset (due, flag on)", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true });
  await seedDeckOn(page, deckSeed(0));
  await gotoCard(page);

  expect(await controlIdentities(page)).toEqual(["primary", "challenge", "reset"]);

  // Visual order = DOM order: each control sits below the previous.
  const ys = await page.evaluate(() => {
    const sec = document.querySelector('[data-testid="tour-stop-review"]')!;
    const y = (sel: string) => sec.querySelector(sel)!.getBoundingClientRect().y;
    return {
      primary: y('button[aria-label="Review my misses: Start review"]'),
      challenge: y('[data-testid="review-challenge-a-friend"]'),
      reset: y('[data-testid="reset-history-open"]'),
    };
  });
  expect(ys.primary).toBeLessThan(ys.challenge);
  expect(ys.challenge).toBeLessThan(ys.reset);

  // Bottom anchoring (panel round-1 B1, disproven by probe — locked
  // here so it can never silently regress): the stack's margin-top:
  // auto must engage, i.e. the danger footer's bottom edge sits on
  // the text column's bottom edge (the column is height:100% of the
  // card; the only space below the footer is the card's own padding).
  const anchor = await page.evaluate(() => {
    const sec = document.querySelector('[data-testid="tour-stop-review"]')!;
    const txt = sec.querySelector(".hv5-txt")!.getBoundingClientRect();
    const danger = sec.querySelector(".hv5-review-danger")!.getBoundingClientRect();
    return { txtBottom: txt.bottom, dangerBottom: danger.bottom };
  });
  expect(Math.abs(anchor.dangerBottom - anchor.txtBottom)).toBeLessThanOrEqual(1.5);

  // Tab walk: record each DISTINCT focus stop until the card's last
  // control is seen. After every Tab, poll until the focus actually
  // changes before reading it — under VM load the renderer's focus
  // update can lag the key event by seconds, and a stale read would
  // record the same stop twice (the dedupe then starves the walk).
  // The poll is deliberately long and NOT swallowed: a focus that
  // never moves is a real failure, not a flake to paper over.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  const signature = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "none";
      return `${el.tagName}|${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? ""}`;
    });
  const keyOf = (sig: string): string | null => {
    if (sig.includes("Review my misses: Start review")) return "primary";
    if (sig.includes("review-challenge-a-friend")) return "challenge";
    if (sig.includes("reset-history-open")) return "reset";
    return null;
  };
  const walked: string[] = [];
  let prev = await signature();
  for (let i = 0; i < 48 && !walked.includes("reset"); i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(async () => (await signature()) !== prev, { timeout: 15_000 })
      .toBe(true);
    const sig = await signature();
    prev = sig;
    const key = keyOf(sig);
    if (key && walked[walked.length - 1] !== key) walked.push(key);
  }
  expect(walked).toEqual(["primary", "challenge", "reset"]);
});

test("primary semantics: no stretch class, name unchanged, cue absent in both deck states", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true });
  await seedDeckOn(page, deckSeed(0));
  const section = await gotoCard(page);
  const primary = page.getByRole("button", { name: "Review my misses: Start review" });
  await expect(primary).toBeVisible();
  await expect(primary).toHaveText("Start review");
  const cls = await primary.evaluate((el) => el.className);
  expect(cls.split(/\s+/), "CTA must not carry hv5-stretch").not.toContain("hv5-stretch");
  await expect(section.locator(".hv5-review-cue")).toHaveCount(0);

  const { context: ctx2, page: page2 } = await (async () => {
    const browser = page.context().browser()!;
    const context2 = await browser.newContext();
    await serveBuiltArtifact(context2);
    await routeFlags(context2, { friendChallenges: true });
    return { context: context2, page: await context2.newPage() };
  })();
  try {
    await seedDeckOn(page2, deckSeed(CAUGHT_UP));
    const section2 = await gotoCard(page2);
    await expect(section2).toContainText("All caught up!");
    await expect(section2.locator(".hv5-review-cue")).toHaveCount(0);
    await expect(page2.getByRole("button", { name: "Review my misses: Start review" })).toHaveCount(0);
  } finally {
    await ctx2.close();
  }
  void context;
});

test("danger presentation: fixed red in both schemes; ReviewComplete opener stays brown", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true });
  await seedDeckOn(page, deckSeed(0));
  await gotoCard(page);

  const opener = page.getByTestId("reset-history-open");
  await expect(opener).toBeVisible();
  const dark = await opener.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, decoration: cs.textDecorationLine };
  });
  expect(dark.color, "home opener colour (dark scheme)").toBe("rgb(179, 55, 42)");
  expect(dark.decoration).toContain("underline");

  await opener.focus();
  const ring = await opener.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.outlineColor, width: cs.outlineWidth };
  });
  expect(ring.color, "home opener focus outline colour").toBe("rgb(179, 55, 42)");
  expect(ring.width, "home opener focus outline width").toBe("3px");

  // Light scheme: the SAME fixed value (a var(--atlas-stamp) value
  // would flip with the theme; the fixed hex must not).
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  const light = await opener.evaluate((el) => getComputedStyle(el).color);
  expect(light, "home opener colour (light scheme)").toBe("rgb(179, 55, 42)");
  await page.emulateMedia({ colorScheme: null });

  // Leakage check: play the one-card review through; ReviewComplete's
  // opener is the same component on a plain surface and must stay
  // brown — the danger override is Review-card-scoped only.
  const start = page.getByRole("button", { name: "Review my misses: Start review" });
  await start.click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await commitHit(page);
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("story");
  await clickNextPlace(page);
  await expect(page.getByTestId("review-complete")).toBeVisible({ timeout: 30_000 });
  const completeOpener = page.getByTestId("reset-history-open");
  await expect(completeOpener).toBeVisible();
  const completeColor = await completeOpener.evaluate((el) => getComputedStyle(el).color);
  expect(completeColor, "ReviewComplete opener stays brown (no scoped-override leakage)").toBe(
    "rgb(119, 89, 31)",
  );
});

test("state matrix: ordered identities + danger-footer ownership per state", async ({
  page,
  context,
}) => {
  void page;
  const cases: {
    name: string;
    seed: unknown;
    flag: boolean;
    want: ControlKey[];
    footer: number;
  }[] = [
    { name: "due × on", seed: deckSeed(0), flag: true, want: ["primary", "challenge", "reset"], footer: 1 },
    { name: "due × off", seed: deckSeed(0), flag: false, want: ["primary", "reset"], footer: 1 },
    { name: "caught-up × on", seed: deckSeed(CAUGHT_UP), flag: true, want: ["challenge", "reset"], footer: 1 },
    { name: "caught-up × off", seed: deckSeed(CAUGHT_UP), flag: false, want: ["reset"], footer: 1 },
    { name: "empty", seed: { v: 1, entries: {} }, flag: true, want: [], footer: 0 },
  ];
  const browser = context.browser()!;
  for (const c of cases) {
    const ctx = await browser.newContext();
    try {
      await serveBuiltArtifact(ctx);
      await routeFlags(ctx, { friendChallenges: c.flag });
      const p = await ctx.newPage();
      if (c.seed) await seedDeckOn(p, c.seed);
      await gotoCard(p);
      expect(await controlIdentities(p), `${c.name}: ordered identities`).toEqual(c.want);
      const footers = await p.evaluate(
        () =>
          document.querySelectorAll('[data-testid="tour-stop-review"] .hv5-review-danger').length,
      );
      expect(footers, `${c.name}: danger footer count`).toBe(c.footer);
      if (c.footer === 1) {
        const resetInside = await p.evaluate(
          () =>
            document.querySelector(
              '[data-testid="tour-stop-review"] .hv5-review-danger [data-testid="reset-history-open"]',
            ) !== null,
        );
        expect(resetInside, `${c.name}: reset opener lives inside the danger footer`).toBe(true);
      }
    } finally {
      await ctx.close();
    }
  }
});
