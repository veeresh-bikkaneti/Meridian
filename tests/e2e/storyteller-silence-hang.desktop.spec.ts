import { test, expect } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, commitMiss } from "./helpers";

/**
 * TEST cell — fix PR "narration silent in production" (branch
 * fix/narration-silent-prod).
 *
 * Fix B — black-box journey on desktop: fresh visit (sound on, the default)
 * → globe run → story reveal → first gesture starts narration → the mp3
 * request NEVER answers, so play() stays pending forever (the iOS stall
 * shape). The 4s hang watchdog must fail loud: the text-only fallback
 * renders WITH the one-time retry hint. Without the fix, audioState stays
 * "playing" forever — no fallback ever appears and the captions advance in
 * silence (the owner's exact symptom).
 *
 * Asserts what the user experiences — the visible caption — never DOM
 * internals alone.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
const FALLBACK_TEXT = "The words are right here — read along with me.";
// BLOCK 1 (scrum 2026-10-11): the hint names the replay button — the only
// control rendered in the failed state (the speaker button is hidden).
const RETRY_HINT = "Tap the replay button to try again.";

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("hang watchdog: a play() that never settles fails loud with the retry hint", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.addInitScript(() => {
    try {
      // Sound on (the default) — the T1 auto path arms the one-shot.
      // The SW precaches mp3s cache-first, which would hide the request
      // from the hanging route below — disable it like storyteller.spec.ts.
      if ("serviceWorker" in navigator) {
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
  });
  // The mp3 request never answers: play() stays pending forever. The 4s
  // hang watchdog must fire onFail instead of stranding "playing".
  await page.route(MP3_PATTERN, () => new Promise<never>(() => {}));

  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });

  // First gesture — a real tap on the caption (the tap that starts audio
  // must not instantly dismiss it: the 600 ms tap guard covers that).
  await page.getByTestId("storyteller-caption-text").click();

  // The watchdog fires at 4s: the fallback renders WITH the retry hint
  // (play-side stall, not a network error — retrying may help).
  const fallback = page.getByTestId("storyteller-fallback");
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText(FALLBACK_TEXT);
  await expect(fallback).toContainText(RETRY_HINT);

  // BLOCK 1a: the hint names the replay button, and the replay button is
  // actually rendered in the failed state — the named control exists.
  await expect(page.getByTestId("storyteller-replay")).toBeVisible({
    timeout: 10_000,
  });

  expectCleanConsole(errors);
});
