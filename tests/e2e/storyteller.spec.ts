import { test, expect, type Page, type Route } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun } from "./helpers";

/**
 * Storyteller mascot E2E — the lazy narration host contract.
 *
 * Host screen: the game summary modal (run-summary.tsx). Sound is forced off
 * so the trigger is the deterministic "speaker" model (text-first + speaker
 * button), mirroring the comet-mascot sound-off coverage.
 *
 * Owner ruling 2026-10-11: the greeting banner ("Gather round, explorer!")
 * lives ONLY on the home page with the storyteller figure — it never renders
 * on the result card. These component-contract tests moved from the result
 * card's dock host to the summary modal host, which still renders
 * StorytellerNarration (screen="summary", variant="modal").
 *
 * Covers: text-first render with the exact caption copy, speaker button
 * starts audio, replay re-requests the clip, tap-dismiss works, and the
 * failure fallback (aborted mp3 → narration_failed → text-only fallback
 * renders). Zero console errors throughout.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const SUMMARY_TEXT = "And so the tale ends! What. An. Adventure!";
const FALLBACK_TEXT = "The words are right here — read along with me.";
const MP3_PATTERN = "**/audio/storyteller/*.mp3";
// App base URL for banner (home) tests — the figure lives in the banner
// per owner ruling 2026-10-10.
const APP = "http://127.0.0.1:4123/Meridian/";
// 0.2 s silent mp3 — deterministic clip end, so replay/dismiss timing is
// not tied to the real narration length. Lives in-repo (not /tmp — the
// VM's tmpfs is small and gets cleaned).
const TINY_MP3 = "tests/e2e/fixtures/storyteller-tiny.mp3";

/** Boot a globe run, end it, and wait for the summary modal's narration host. */
async function reachSummaryScreen(
  page: Page,
  opts: { disableServiceWorker?: boolean } = {},
): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.addInitScript((disableSw: boolean) => {
    try {
      // Sound off → the T2 speaker model: text-first, no auto audio.
      if (!localStorage.getItem("meridian.sound"))
        localStorage.setItem("meridian.sound", "off");
      if (disableSw && "serviceWorker" in navigator) {
        // The SW precaches the mp3s and serves them cache-first, which
        // would hide the mp3 request from route interception below.
        // Registration failure is a tolerated best-effort path (pwa.ts).
        const container = navigator.serviceWorker as unknown as Record<
          string,
          unknown
        >;
        container.register = () =>
          Promise.reject(new Error("service worker disabled for test"));
      }
    } catch {
      /* private mode — ignore */
    }
  }, opts.disableServiceWorker ?? false);
  await startGlobeRun(page);
  // End the run → summary modal mounts the storyteller narration.
  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });
  return errors;
}

function expectCleanConsole(errors: string[], ignore: string[] = []): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the comet-mascot and cleared-mode specs).
  // The crash-report beacon (observability transport's fetch fallback) posts
  // to an external worker that this VM's egress cannot reach right now —
  // a forced environmental failure, not an app bug (same precedent as the
  // net::ERR_FAILED ignore in the fallback test below). The console message
  // carries only the error code, not the URL, so the filter keys on the code.
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED") &&
      !ignore.some((s) => e.includes(s)),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

async function fulfillTinyMp3(route: Route): Promise<void> {
  await route.fulfill({ path: TINY_MP3, contentType: "audio/mpeg" });
}

test("text-first render on the summary host with the exact caption copy", async ({
  page,
}) => {
  const errors = await reachSummaryScreen(page);
  const narration = page.getByTestId("storyteller-narration");
  await expect(narration).toBeVisible();
  // Text-first: the full caption is on screen before any gesture, and it
  // matches the narration audio's spoken line exactly.
  const caption = page.getByTestId("storyteller-caption-text");
  await expect(caption).toHaveAttribute("aria-label", SUMMARY_TEXT);
  await expect(caption).toContainText(SUMMARY_TEXT);
  // Sound off → the speaker opt-in is present, audio not yet started.
  await expect(page.getByTestId("storyteller-speaker")).toBeVisible();
  expectCleanConsole(errors);
});

test("speaker button starts the narration audio", async ({ page }) => {
  // SW disabled: it precaches the mp3s and serves them cache-first, which
  // would hide the audio request from observation below.
  const errors = await reachSummaryScreen(page, { disableServiceWorker: true });
  await page.route(MP3_PATTERN, fulfillTinyMp3);
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/audio/storyteller/summary-01.mp3")) requested.push(r.url());
  });
  await page.getByTestId("storyteller-speaker").click();
  await expect
    .poll(() => requested.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  expect(requested[0]).toContain("/audio/storyteller/summary-01.mp3");
  // The global sound toggle is untouched by the opt-in.
  const sound = await page.evaluate(() => localStorage.getItem("meridian.sound"));
  expect(sound).toBe("off");
  expectCleanConsole(errors);
});

test("replay replays the line", async ({ page }) => {
  // SW disabled (same cache-first race as the speaker test).
  const errors = await reachSummaryScreen(page, { disableServiceWorker: true });
  await page.route(MP3_PATTERN, fulfillTinyMp3);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/audio/storyteller/summary-01.mp3"))
      requests.push(r.url());
  });
  await page.getByTestId("storyteller-speaker").click();
  await expect
    .poll(() => requests.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  // The 0.2 s clip has ended by now (well inside the 3 s post-audio hold).
  await page.waitForTimeout(1500);
  const replay = page.getByTestId("storyteller-replay");
  await expect(replay).toBeVisible();
  await replay.click();
  await expect
    .poll(() => requests.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  expectCleanConsole(errors);
});

test("tap on the caption dismisses the narration", async ({ page }) => {
  const errors = await reachSummaryScreen(page);
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  const slot = page.getByTestId("storyteller-slot");
  const slotBefore = await slot.boundingBox();
  await page.getByTestId("storyteller-caption").click();
  // 150 ms leave animation, then the narration host and its caption
  // (the role="status" live region) unmount — nothing stale is left to
  // announce.
  await expect(page.getByTestId("storyteller-narration")).toHaveCount(0, {
    timeout: 5000,
  });
  await expect(page.getByTestId("storyteller-caption")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveCount(0);
  // #306: the slot keeps its box; what fills it is an empty, aria-hidden,
  // inert, untappable filler.
  const empty = page.getByTestId("storyteller-slot-empty");
  await expect(empty).toHaveCount(1);
  await expect(empty).toBeEmpty();
  await expect(empty).toHaveAttribute("aria-hidden", "true");
  await expect(empty).toHaveAttribute("inert", "");
  await expect(empty).toHaveCSS("pointer-events", "none");
  expect(await slot.boundingBox()).toEqual(slotBefore);
  // WCAG 2.4.3: the tap-dismiss still returns focus to Play again.
  await expect(page.getByTestId("play-again")).toBeFocused();
  expectCleanConsole(errors);
});

test("blocked audio degrades to the text-only fallback", async ({ page }) => {
  // The service worker precaches the mp3s and serves them cache-first —
  // disable it so the abort below actually kills the network request.
  const errors = await reachSummaryScreen(page, { disableServiceWorker: true });
  // Abort the mp3 request → the audio element errors → narration_failed →
  // silent text-only fallback, never device-shaming.
  let aborted = 0;
  await page.route(MP3_PATTERN, (route) => {
    aborted++;
    return route.abort("failed");
  });
  await page.getByTestId("storyteller-speaker").click();
  // Atomic in-page snapshot the moment the fallback renders — the
  // text-only path auto-dismisses 6 s after the failure, so sequential
  // locator assertions would race the unmount.
  const snapshot = await page.waitForFunction(
    () => {
      const fb = document.querySelector('[data-testid="storyteller-fallback"]');
      if (!fb || (fb.textContent ?? "").trim().length === 0) return null;
      const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
      const qa = (id: string) =>
        document.querySelectorAll(`[data-testid="${id}"]`).length;
      return {
        fallbackText: fb.textContent ?? "",
        // Words are joined with non-breaking spaces (presentational, keeps
        // words from breaking) — normalize before comparing copy.
        captionText: (q("storyteller-caption-text")?.textContent ?? "").replace(
          /\u00a0/g,
          " ",
        ),
        speakerCount: qa("storyteller-speaker"),
        replayCount: qa("storyteller-replay"),
      };
    },
    { timeout: 15_000 },
  );
  const s = (await snapshot.jsonValue()) as {
    fallbackText: string;
    captionText: string;
    speakerCount: number;
    replayCount: number;
  };
  expect(aborted, "the mp3 request must hit the abort route").toBeGreaterThanOrEqual(1);
  expect(s.fallbackText).toBe(FALLBACK_TEXT);
  // The full caption stays readable, and the dead controls are gone.
  expect(s.captionText).toContain(SUMMARY_TEXT);
  expect(s.speakerCount).toBe(0);
  expect(s.replayCount).toBe(0);
  // The aborted request logs net::ERR_FAILED — that IS the forced failure,
  // not an app bug.
  expectCleanConsole(errors, ["net::ERR_FAILED"]);
});

/**
 * #306: the summary buttons are pinned on screen and never move. Every
 * frame from the dialog's first paint is sampled in-page (rAF), recording
 * Share score's viewport y, whether EVERY action button is fully inside
 * the viewport, and which caption state is on screen. The run walks every
 * state — open (lazy fallback, no caption), caption in, audio-failure
 * line appended, auto-dismissed — and Share's y must stay within 1px of
 * the first frame's while all buttons stay fully on screen, unscrolled.
 * While the caption shows, its box must not overlap Share, any other
 * action button or the footer, and must sit fully inside the visible
 * scroll region (not clipped). The landscape phone sizes are the
 * regression for the stacked card at short heights: at 568x320 the
 * ~240px footer left the scroll region ~45px, so the caption was clipped
 * and its box ran under Share (Engineering Lead review on PR #310).
 */
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
]) {
  test.describe(`summary caption slot @${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("action buttons are on screen, the caption never overlaps them, and Share keeps its y at open, caption-in, audio-fail and dismissed", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        type Sample = {
          y: number;
          buttons: number;
          allInView: boolean;
          caption: boolean;
          fallback: boolean;
          empty: boolean;
          overlap: boolean;
          clipped: boolean;
        };
        const w = window as unknown as { __slotSamples: Sample[] };
        w.__slotSamples = [];
        const tick = () => {
          const dlg = document.querySelector<HTMLElement>(
            '[role="dialog"][aria-label="Game summary"]',
          );
          const share = dlg
            ? [...dlg.querySelectorAll("button")].find((b) =>
                (b.textContent ?? "").includes("Share score"),
              )
            : undefined;
          if (dlg && share) {
            const footer = dlg.querySelector('[data-testid="summary-actions"]');
            const actions = [...(footer ?? dlg).querySelectorAll("button")];
            const cap = document.querySelector('[data-testid="storyteller-caption"]');
            const content = dlg.querySelector('[data-testid="summary-content"]');
            const c = cap?.getBoundingClientRect();
            // Strict box intersection (shared edges do not count).
            const hits = (r: DOMRect) =>
              !!c &&
              Math.min(c.right, r.right) - Math.max(c.left, r.left) > 0.5 &&
              Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top) > 0.5;
            const v = content?.getBoundingClientRect();
            w.__slotSamples.push({
              y: share.getBoundingClientRect().top,
              buttons: actions.length,
              allInView: actions.every((b) => {
                const r = b.getBoundingClientRect();
                return (
                  r.height >= 44 &&
                  r.top >= 0 &&
                  r.left >= 0 &&
                  r.bottom <= window.innerHeight &&
                  r.right <= window.innerWidth
                );
              }),
              caption: !!document.querySelector('[data-testid="storyteller-caption"]'),
              fallback: !!document.querySelector('[data-testid="storyteller-fallback"]'),
              empty: !!document.querySelector('[data-testid="storyteller-slot-empty"]'),
              overlap:
                !!c &&
                (actions.some((b) => hits(b.getBoundingClientRect())) ||
                  (!!footer && hits(footer.getBoundingClientRect()))),
              clipped:
                !!c &&
                (!v ||
                  c.top < v.top - 0.5 ||
                  c.bottom > v.bottom + 0.5 ||
                  c.left < v.left - 0.5 ||
                  c.right > v.right + 0.5),
            });
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const errors = await reachSummaryScreen(page, { disableServiceWorker: true });
      await page.route(MP3_PATTERN, (route) => route.abort("failed"));
      // Audio fails → the fallback line is appended inside the caption.
      await page.getByTestId("storyteller-speaker").click();
      await expect(page.getByTestId("storyteller-fallback")).toHaveText(FALLBACK_TEXT);
      // The tallest caption state (line + fallback) fits inside the slot.
      const captionBox = await page.getByTestId("storyteller-caption").boundingBox();
      const slotBox = await page.getByTestId("storyteller-slot").boundingBox();
      expect(captionBox && slotBox).toBeTruthy();
      expect(captionBox!.height).toBeLessThanOrEqual(slotBox!.height);
      // Text-only hold (6 s after the failure), then the caption dismisses.
      await expect(page.getByTestId("storyteller-caption")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(page.getByTestId("storyteller-slot-empty")).toHaveCount(1);
      await page.waitForTimeout(500);
      const samples = await page.evaluate(
        () =>
          (window as unknown as {
            __slotSamples: {
              y: number;
              buttons: number;
              allInView: boolean;
              caption: boolean;
              fallback: boolean;
              empty: boolean;
              overlap: boolean;
              clipped: boolean;
            }[];
          }).__slotSamples,
      );
      const open = samples[0];
      expect(open, "a frame was sampled at dialog open").toBeDefined();
      expect(open.caption, "first frame is before the caption mounts").toBe(false);
      // Share score, Share route, Play again, Done (Challenge when present).
      expect(open.buttons, "the pinned footer holds the actions").toBeGreaterThanOrEqual(4);
      expect(open.allInView, "every action button fully on screen at open, no scroll").toBe(
        true,
      );
      const phases = {
        open: [open],
        captionIn: samples.filter((s) => s.caption && !s.fallback),
        audioFail: samples.filter((s) => s.caption && s.fallback),
        dismissed: samples.filter(
          (s, i) => !s.caption && s.empty && samples.slice(0, i).some((p) => p.caption),
        ),
      };
      for (const [phase, rows] of Object.entries(phases)) {
        expect(rows.length, `phase ${phase} was observed`).toBeGreaterThan(0);
        for (const r of rows) {
          expect(
            Math.abs(r.y - open.y),
            `Share score moved during ${phase}: ${r.y} vs ${open.y}`,
          ).toBeLessThanOrEqual(1);
          expect(r.allInView, `an action button left the viewport during ${phase}`).toBe(true);
          expect(r.overlap, `the caption overlaps Share / the actions during ${phase}`).toBe(
            false,
          );
          expect(r.clipped, `the caption is clipped by the scroll region during ${phase}`).toBe(
            false,
          );
        }
      }
      expectCleanConsole(errors, ["net::ERR_FAILED"]);
    });
  });
}

test.describe("summary pinned actions @320x568", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("Done is visible without scrolling at 320x568; the content still scrolls by keyboard", async ({
    page,
  }) => {
    const errors = await reachSummaryScreen(page);
    const dialog = page.getByRole("dialog", { name: "Game summary" });
    const content = page.getByTestId("summary-content");
    for (const name of ["Share score", "Play again", "Done"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({
        ratio: 1,
      });
    }
    // Nothing was scrolled to get there.
    expect(await content.evaluate((el) => el.scrollTop)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // The stats overflow the content area, which stays keyboard-reachable
    // and scrolls while the buttons stay put.
    const shareY = (await dialog.getByRole("button", { name: "Share score", exact: true }).boundingBox())!.y;
    await content.focus();
    await expect(content).toBeFocused();
    await page.keyboard.press("End");
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(
      (await dialog.getByRole("button", { name: "Share score", exact: true }).boundingBox())!.y,
    ).toBe(shareY);
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expectCleanConsole(errors);
  });
});

test("figure tap pauses and resumes the narration", async ({ page }) => {
  // Figure is banner-only per owner ruling 2026-10-10 — this test moved
  // from the story screen to the home banner where the figure lives.
  // SW disabled: it precaches the mp3s and serves them cache-first, which
  // would hide the audio request from the route below.
  await page.context().addInitScript(() => {
    try {
      localStorage.setItem("meridian.grandpaTour.lastDate", new Date().toISOString().slice(0, 10));
      localStorage.setItem("meridian.tutorialSeen", "1");
    } catch {
      /* private mode — ignore */
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await serveBuiltArtifact(page.context());
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
  // Stall the greeting mp3: the audio element stays in "playing" so the
  // pause/resume window is deterministic — no race with a clip ending.
  await page.route("**/audio/storyteller/*.mp3", () => {
    /* never fulfill */
  });
  // First gesture starts the greeting narration.
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  const figure = page.getByTestId("storyteller-figure");
  // audioState "playing" → the figure's label is the pause control.
  await expect(figure).toHaveAttribute("aria-label", "Pause the greeting", {
    timeout: 15_000,
  });
  // Clear the 600ms starter-tap guard: the body click that started audio
  // sets audioStartTimeRef, and a fast figure tap would be swallowed.
  await page.waitForTimeout(700);
  // Tap the figure: pause/resume is the tap's job (owner ruling 2026-10-10).
  // force: the figure's idle-float animation runs infinitely, so the
  // actionability stability check would never settle — the tap itself is
  // a real user gesture on an enabled, visible button.
  await figure.click({ force: true });
  await expect(figure).toHaveAttribute("aria-label", "Resume the greeting", {
    timeout: 10_000,
  });
  await figure.click({ force: true });
  await expect(figure).toHaveAttribute("aria-label", "Pause the greeting", {
    timeout: 10_000,
  });
  expectCleanConsole(errors);
});
