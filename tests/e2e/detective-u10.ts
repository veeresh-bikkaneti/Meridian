import { expect, type BrowserContext, type Page } from "playwright/test";
import { loopNameIndex } from "./helpers";

/**
 * Shared harness for the U10 detective gates pack (stations / companion /
 * swap / endings). Everything here follows the U5–U9 smoke patterns:
 *
 * - The `detectivePair` flag is flipped ON by route interception only
 *   (registered AFTER serveBuiltArtifact, so it wins) — the committed
 *   flags.json stays false.
 * - Speech is sped up by a play() patch that also records every clip
 *   src in play order (`__detectivePlays`). The patch is a harness
 *   speed-up only; the player's queue order is the product's own.
 * - WATCHDOG (disclosed, harness-side): this VM's headless media
 *   pipeline intermittently freezes a playing clip (currentTime stops,
 *   `ended` never fires — documented in the U8 smoke NOTE). The init
 *   script watches detective clips and, when one has been frozen for
 *   >2.4 s, seeks it to its end so the queue drains as designed. It
 *   counts every intervention in `__detectiveWatchdogSeeks` so specs
 *   and the gate report can disclose how often it fired. No product
 *   code is changed for this.
 * - Network log: `collectAudioRequests` records every detective mp3
 *   request in the order the browser issued it.
 */

export const BASE = "http://127.0.0.1:4123/Meridian/";

export async function fulfillFlagsOn(context: BrowserContext): Promise<void> {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: true,
        },
      }),
    });
  });
}

/** PR A staging twin of fulfillFlagsOn: detectivePair AND
 * hostsStaging on, served by interception. Specs that need staging
 * say so explicitly — the same honesty rule as fulfillFlagsOff. */
export async function fulfillFlagsStaging(context: BrowserContext): Promise<void> {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: true,
          hostsStaging: true,
        },
      }),
    });
  });
}

/** The OFF twin of fulfillFlagsOn: the same flag set with
 * detectivePair false, served by interception. A spec that needs
 * the flag OFF must say so explicitly — it must never rely on the
 * committed flags.json value, which the owner's flip (PR #356) set
 * to true; the summary spec's flag-off test silently broke on
 * exactly that assumption (fails on unmodified main 1b38cb3). */
export async function fulfillFlagsOff(context: BrowserContext): Promise<void> {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: {
          globeTierSplit: true,
          learningOutcomes: true,
          pwaUpdateToast: true,
          friendChallenges: true,
          scoutUpgradeTrial: true,
          detectivePair: false,
        },
      }),
    });
  });
}

/** Install the play() recorder + speed-up + freeze watchdog. Call
 * BEFORE navigation (it uses addInitScript). */
export async function installDetectiveRecorder(
  context: BrowserContext,
  playbackRate = 3,
): Promise<void> {
  await context.addInitScript((rate: number) => {
    const w = window as unknown as {
      __detectivePlays: string[];
      __detectiveWatchdogSeeks: number;
    };
    w.__detectivePlays = [];
    w.__detectiveWatchdogSeeks = 0;
    const orig = HTMLMediaElement.prototype.play;
    // The speech player plays DETACHED `new Audio()` elements — they
    // never appear in the document, so the watchdog tracks elements
    // through this patch (every played element registers itself).
    const audios: HTMLMediaElement[] = [];
    (w as unknown as { __detectiveAudios: HTMLMediaElement[] }).__detectiveAudios = audios;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__detectivePlays.push(this.currentSrc || this.src || "");
      if (!audios.includes(this)) audios.push(this);
      try {
        this.playbackRate = rate;
      } catch {
        /* rate is a speed-up only — a refusal must not break play */
      }
      return orig.call(this);
    };
    // Freeze watchdog (see header): a detective clip whose currentTime
    // has not advanced for >2.4 s while it claims to be playing is
    // seeked to its end. Non-detective media is never touched.
    const seen = new WeakMap<HTMLMediaElement, { ct: number; stallMs: number }>();
    setInterval(() => {
      audios.forEach((el) => {
        const src = el.currentSrc || el.src || "";
        if (!src.includes("/audio/detective/")) return;
        if (el.paused || el.ended) {
          seen.delete(el);
          return;
        }
        const prev = seen.get(el);
        if (!prev || prev.ct !== el.currentTime) {
          seen.set(el, { ct: el.currentTime, stallMs: 0 });
          return;
        }
        prev.stallMs += 400;
        if (prev.stallMs > 2400) {
          w.__detectiveWatchdogSeeks += 1;
          if (Number.isFinite(el.duration) && el.duration > 0) {
            try {
              el.currentTime = Math.max(0, el.duration - 0.02);
            } catch {
              /* fall through to the ended dispatch below */
            }
          }
          // If the load itself froze (metadata never arrived, so
          // duration is NaN and no seek is possible), dispatch the
          // `ended` the frozen pipeline will never deliver — the
          // player's own listener treats it exactly like a finished
          // clip, and the queue drains as designed.
          if (!Number.isFinite(el.duration) || el.duration <= 0) {
            try {
              el.dispatchEvent(new Event("ended"));
            } catch {
              /* nothing else the harness can honestly do */
            }
          }
          seen.delete(el);
        }
      });
    }, 400);
  }, playbackRate);
}

export async function detectivePlays(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __detectivePlays: string[] }).__detectivePlays,
  );
}

export async function watchdogSeeks(page: Page): Promise<number> {
  return page
    .evaluate(
      () =>
        (window as unknown as { __detectiveWatchdogSeeks: number })
          .__detectiveWatchdogSeeks,
    )
    .catch(() => 0);
}

/** Live-ordered log of detective mp3 REQUESTS (network layer). */
export function collectAudioRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/audio/detective/") && u.endsWith(".mp3")) urls.push(u);
  });
  return urls;
}

/** The pair's current phase, from whichever host root is mounted
 * (the station root carries clue phases, the map root carries the
 * guessing phases; both expose data-phase). Null when the pair is
 * fully absent (sheet / rings / speech-owned screen). */
export async function currentPhase(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el =
      document.querySelector('[data-testid="detective-host"]') ??
      document.querySelector('[data-testid="detective-station"]');
    return el?.getAttribute("data-phase") ?? null;
  });
}

export async function waitForPhase(
  page: Page,
  phase: string,
  timeout = 90_000,
): Promise<void> {
  await expect
    .poll(() => currentPhase(page), { timeout })
    .toBe(phase);
}

/** Holmes's placement from the mounted root that carries it. */
export async function currentPlacement(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el =
      document.querySelector('[data-testid="detective-host"]') ??
      document.querySelector('[data-testid="detective-station"]');
    return el?.getAttribute("data-holmes-placement") ?? null;
  });
}

export async function companionMode(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el =
      document.querySelector('[data-testid="detective-host"]') ??
      document.querySelector('[data-testid="detective-station"]');
    return el?.getAttribute("data-companion") ?? null;
  });
}

/**
 * Open a seam-pinned core case (`?loop-puzzle=<i>`, core deck only)
 * with the flag on, and supply the first user gesture the speech
 * player's unlock waits for (the U5/U9 pattern: a click on the
 * GeoDetective heading after the pair mounts).
 */
export async function openSeamCase(page: Page, index: number): Promise<void> {
  await page.goto(`${BASE}?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("heading", { name: "GeoDetective" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  // ORDER MATTERS (the U9 pattern, hardened): the station must be
  // MOUNTED before the gesture click, and even then one click is not
  // a guarantee — the player's first-gesture listener arms inside
  // playClip, which the queue reaches only after the audio manifest
  // fetch resolves. A click that lands before the listener arms is
  // missed, and the queue then waits forever for a gesture that
  // already happened (observed as intermittent CASE_OPEN stalls; the
  // timeout dump showed zero detective plays). So: tap, then VERIFY
  // the unlock by its effect (the first clip's play), and tap again
  // if it did not land — exactly what a kid would do, and every tap
  // is checked against the condition, never assumed.
  await expect(page.getByTestId("detective-station")).toBeVisible({
    timeout: 20_000,
  });
  const heading = page.getByRole("heading", { name: "GeoDetective" });
  // NB: the play() record contains EVERY media element on the page
  // (home-page card films included) — the unlock is proven only by a
  // DETECTIVE clip playing.
  const detectivePlayCount = async () =>
    (await detectivePlays(page)).filter((u) => u.includes("/audio/detective/"))
      .length;
  for (let attempt = 0; attempt < 8; attempt++) {
    await heading.click();
    try {
      await expect
        .poll(detectivePlayCount, { timeout: 4_000 })
        .toBeGreaterThan(0);
      return;
    } catch {
      // The tap landed before the listener armed — tap again.
    }
  }
  throw new Error("speech never unlocked after 8 verified gesture taps");
}

/** Wait until the guessing phase is live and Holmes sits at the dock. */
export async function waitForSearchIdle(
  page: Page,
  timeout = 120_000,
): Promise<void> {
  try {
    await expect
      .poll(
        async () => {
          const phase = await currentPhase(page);
          const placement = await currentPlacement(page);
          return phase === "SEARCH_IDLE" && placement === "dock"
            ? "ready"
            : `${phase}/${placement}`;
        },
        { timeout },
      )
      .toBe("ready");
  } catch (e) {
    // Self-diagnosing failure: dump the speech queue's state (what
    // played, what the tracked audio elements are doing) so a stall
    // names its own cause instead of dying as a bare timeout.
    const dump = await page
      .evaluate(() => {
        const w = window as unknown as {
          __detectivePlays?: string[];
          __detectiveWatchdogSeeks?: number;
          __detectiveAudios?: HTMLMediaElement[];
        };
        return {
          plays: (w.__detectivePlays ?? []).map((u) => u.split("/").slice(-2).join("/")),
          watchdogSeeks: w.__detectiveWatchdogSeeks ?? -1,
          audios: (w.__detectiveAudios ?? []).map((a) => ({
            src: (a.currentSrc || a.src || "").split("/").slice(-2).join("/"),
            readyState: a.readyState,
            networkState: a.networkState,
            currentTime: Number(a.currentTime.toFixed(2)),
            duration: Number.isFinite(a.duration) ? Number(a.duration.toFixed(2)) : null,
            paused: a.paused,
            ended: a.ended,
            error: a.error ? a.error.code : null,
          })),
        };
      })
      .catch(() => null);
    console.log(`[waitForSearchIdle] TIMEOUT dump: ${JSON.stringify(dump)}`);
    throw e;
  }
}

/**
 * Guess a place through the jump search, picking the exact option by
 * its guess-index entry id (the geodetective.spec.ts pattern — a
 * same-named bigger city can never steal the pick), then confirm on
 * the bottom sheet.
 */
export async function guessByEntryId(
  page: Page,
  entryId: string,
  query: string,
): Promise<void> {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill(query);
  const option = page.locator(
    `li[role="option"][data-entry-id="${entryId}"]`,
  );
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Resolve a guess-index entry by its normalized name. */
export function entryByName(name: string): { n: string; id: string } {
  const e = loopNameIndex().find((x) => x.n === name);
  if (!e) throw new Error(`no guess-index entry named ${name}`);
  return e;
}

/** First index of a needle in a haystack list, or -1. */
export function firstIndexOf(list: string[], needle: string): number {
  return list.findIndex((u) => u.includes(needle));
}

/** Assert every needle appears in `list`, in the given order. Returns
 * the matched indices so callers can report them. */
export function assertSubsequence(list: string[], needles: string[]): number[] {
  const idx: number[] = [];
  let from = 0;
  for (const needle of needles) {
    const found = list.slice(from).findIndex((u) => u.includes(needle));
    if (found === -1) {
      throw new Error(
        `subsequence broken: "${needle}" not found after index ${from} in [${list.join(", ")}]`,
      );
    }
    idx.push(from + found);
    from = from + found + 1;
  }
  return idx;
}
