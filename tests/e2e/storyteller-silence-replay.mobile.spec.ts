import { test, expect } from "playwright/test";
import { serveBuiltArtifact, installAudioProbe } from "./helpers";

/**
 * TEST cell — fix PR "narration silent in production" (branch
 * fix/narration-silent-prod).
 *
 * Fix D — black-box journey on a phone viewport (390×844, touch): fresh
 * visit (sound on, the default; tutorial seen; tour skipped for the day)
 * → the greeting mp3 request is aborted, so the greeting attempt fails →
 * the text-only fallback renders (plain — a network failure earns no
 * retry hint) → the user taps Grandpa → the greeting REPLAYS (a new mp3
 * request goes out) instead of rotating a text-only poke line that would
 * trap the silence forever.
 *
 * Asserts what the user experiences — a new audible attempt starts —
 * via the network request the replay must make, never DOM internals alone.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
const APP = "http://127.0.0.1:4123/Meridian/";
const FALLBACK_TEXT = "The words are right here — read along with me.";
// BLOCK 1 (scrum 2026-10-11): the banner hint names the figure tap — the
// banner has no speaker button. A network failure earns no hint at all.
const RETRY_HINT = "Tap me to try again.";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED") &&
      // The spec deliberately aborts every mp3 request — those resource
      // errors are the test's own doing, not app bugs (same precedent as
      // the net::ERR_FAILED ignore in storyteller.spec.ts).
      !e.includes("Failed to load resource"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("figure tap replays a greeting that was attempted but never heard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await installAudioProbe(page.context());
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      // Sound on (the default) — the greeting attempt is real; it fails
      // on the network, not on the mute.
      // The SW precaches mp3s cache-first, which would hide the request
      // from the abort route below — disable it like storyteller.spec.ts.
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
  }, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);

  // The greeting clip can never load: every attempt fails on the network.
  let mp3Requests = 0;
  await page.route(MP3_PATTERN, (route) => {
    mp3Requests += 1;
    return route.abort("failed");
  });

  await page.goto(APP);
  const host = page.getByTestId("storyteller-home");
  const figure = page.getByTestId("storyteller-figure");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });

  // First tap: the window one-shot starts the greeting; the aborted clip
  // fails → the plain fallback renders (network failure → no retry hint).
  await figure.click({ force: true });
  const fallback = page.getByTestId("storyteller-home-fallback");
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText(FALLBACK_TEXT);
  await expect(fallback).not.toContainText(RETRY_HINT);
  const attemptsAfterFirstTap = mp3Requests;
  expect(attemptsAfterFirstTap, "the first tap must attempt the greeting").toBeGreaterThanOrEqual(1);

  // Second tap on the figure: the greeting was attempted but never heard,
  // so it REPLAYS — a new mp3 request goes out — instead of a poke line.
  await figure.click({ force: true });
  await expect
    .poll(() => mp3Requests, { timeout: 15_000 })
    .toBeGreaterThan(attemptsAfterFirstTap);
  // The re-attempt fails the same way; the fallback stands, still honest.
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText(FALLBACK_TEXT);

  expectCleanConsole(errors);
});
