import { test, expect, type Page, type Route } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, commitMiss } from "./helpers";

/**
 * Storyteller mascot E2E — the lazy narration host contract.
 *
 * Host screen: the story reveal (ResultCard). Sound is forced off so the
 * trigger is the deterministic "speaker" model (text-first + speaker
 * button), mirroring the comet-mascot sound-off coverage.
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

const REVEAL_TEXT =
  "Gather round, explorer! Every place hides a story. And this one? This one is a legend.";
const FALLBACK_TEXT = "The words are right here — read along with me.";
const MP3_PATTERN = "**/audio/storyteller/*.mp3";
// 0.2 s silent mp3 — deterministic clip end, so replay/dismiss timing is
// not tied to the real narration length. Lives in-repo (not /tmp — the
// VM's tmpfs is small and gets cleaned).
const TINY_MP3 = "tests/e2e/fixtures/storyteller-tiny.mp3";

/** Boot a globe run with sound off, commit a pin, wait for the story host. */
async function reachStoryScreen(
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
  // Miss or hit — the ResultCard mounts the storyteller on both.
  await commitMiss(page);
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

test("text-first render on the story host with the exact caption copy", async ({
  page,
}) => {
  const errors = await reachStoryScreen(page);
  const narration = page.getByTestId("storyteller-narration");
  await expect(narration).toBeVisible();
  // Text-first: the full caption is on screen before any gesture, and it
  // matches the narration audio's spoken line exactly.
  const caption = page.getByTestId("storyteller-caption-text");
  await expect(caption).toHaveAttribute("aria-label", REVEAL_TEXT);
  await expect(caption).toContainText(REVEAL_TEXT);
  // Sound off → the speaker opt-in is present, audio not yet started.
  await expect(page.getByTestId("storyteller-speaker")).toBeVisible();
  expectCleanConsole(errors);
});

test("speaker button starts the narration audio", async ({ page }) => {
  // SW disabled: it precaches the mp3s and serves them cache-first, which
  // would hide the audio request from observation below.
  const errors = await reachStoryScreen(page, { disableServiceWorker: true });
  await page.route(MP3_PATTERN, fulfillTinyMp3);
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/audio/storyteller/reveal-01.mp3")) requested.push(r.url());
  });
  await page.getByTestId("storyteller-speaker").click();
  await expect
    .poll(() => requested.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  expect(requested[0]).toContain("/audio/storyteller/reveal-01.mp3");
  // The global sound toggle is untouched by the opt-in.
  const sound = await page.evaluate(() => localStorage.getItem("meridian.sound"));
  expect(sound).toBe("off");
  expectCleanConsole(errors);
});

test("replay replays the line", async ({ page }) => {
  // SW disabled (same cache-first race as the speaker test).
  const errors = await reachStoryScreen(page, { disableServiceWorker: true });
  await page.route(MP3_PATTERN, fulfillTinyMp3);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/audio/storyteller/reveal-01.mp3"))
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
  const errors = await reachStoryScreen(page);
  await page.getByTestId("storyteller-caption").click();
  // 150 ms leave animation, then unmounted.
  await expect(page.getByTestId("storyteller-narration")).toHaveCount(0, {
    timeout: 5000,
  });
  expectCleanConsole(errors);
});

test("blocked audio degrades to the text-only fallback", async ({ page }) => {
  // The service worker precaches the mp3s and serves them cache-first —
  // disable it so the abort below actually kills the network request.
  const errors = await reachStoryScreen(page, { disableServiceWorker: true });
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
  expect(s.captionText).toContain(REVEAL_TEXT);
  expect(s.speakerCount).toBe(0);
  expect(s.replayCount).toBe(0);
  // The aborted request logs net::ERR_FAILED — that IS the forced failure,
  // not an app bug.
  expectCleanConsole(errors, ["net::ERR_FAILED"]);
});

test("figure tap pauses and resumes the narration", async ({ page }) => {
  // SW disabled: it precaches the mp3s and serves them cache-first, which
  // would hide the audio request from the route below.
  const errors = await reachStoryScreen(page, { disableServiceWorker: true });
  // Stall the mp3 request: the audio element stays in "playing" so the
  // pause/resume window is deterministic — no race with a clip ending.
  await page.route(MP3_PATTERN, () => {
    /* never fulfill */
  });
  await page.getByTestId("storyteller-speaker").click();
  const figure = page.getByTestId("storyteller-figure");
  // audioState "playing" → the figure's label is the pause control.
  await expect(figure).toHaveAttribute("aria-label", "Pause the story", {
    timeout: 10_000,
  });
  // Tap the figure: pause/resume is the tap's job (owner ruling 2026-10-10).
  // force: the figure's idle-float animation runs infinitely, so the
  // actionability stability check would never settle — the tap itself is
  // a real user gesture on an enabled, visible button.
  await figure.click({ force: true });
  await expect(figure).toHaveAttribute("aria-label", "Resume the story", {
    timeout: 10_000,
  });
  await figure.click({ force: true });
  await expect(figure).toHaveAttribute("aria-label", "Pause the story", {
    timeout: 10_000,
  });
  expectCleanConsole(errors);
});
