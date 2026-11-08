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

/** PR B walk twin of fulfillFlagsStaging: detectivePair AND
 * hostsStaging AND watsonWalk on, served by interception. */
export async function fulfillFlagsWalk(context: BrowserContext): Promise<void> {
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
          watsonWalk: true,
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

/* ------------------------------------------------------------------ */
/* Zero-overlap audit (the staging mockup v2 position-sampling        */
/* audit, ported in PR A's staging spec and shared here since PR B   */
/* so the walk spec inherits it instead of duplicating it): bounded  */
/* COLLECTION WINDOWS — at each checkpoint an in-page rAF collector  */
/* measures every figure's PAINTED box (layout rect clipped by any   */
/* overflow:hidden ancestor) against every leaf text element inside  */
/* the clue articles, once per animation frame for the window.       */
/* ------------------------------------------------------------------ */

export type AuditStats = { samples: number; maxOverlap: number; worst: string };

export async function collectAuditWindow(
  page: Page,
  ms: number,
): Promise<AuditStats> {
  return page.evaluate(
    (dwell) =>
      new Promise<AuditStats>((resolve) => {
        let samples = 0;
        let maxOverlap = 0;
        let worst = "";
        const t0 = performance.now();
        const frame = () => {
          try {
            const figs = Array.from(
              document.querySelectorAll(
                '[data-detective] svg, .detective-bench-figure svg',
              ),
            );
            const texts = Array.from(
              document.querySelectorAll('article[aria-label^="Clue"] *'),
            ).filter(
              (el) =>
                el.children.length === 0 &&
                (el.textContent ?? "").trim().length > 0,
            );
            const paintedRect = (el: Element) => {
              const r = el.getBoundingClientRect();
              let left = r.left;
              let top = r.top;
              let right = r.right;
              let bottom = r.bottom;
              let anc = el.parentElement;
              while (anc && anc !== document.body) {
                const cs = getComputedStyle(anc);
                if (
                  cs.overflowX === "hidden" ||
                  cs.overflowX === "clip" ||
                  cs.overflowY === "hidden" ||
                  cs.overflowY === "clip"
                ) {
                  const ar = anc.getBoundingClientRect();
                  left = Math.max(left, ar.left);
                  top = Math.max(top, ar.top);
                  right = Math.min(right, ar.right);
                  bottom = Math.min(bottom, ar.bottom);
                }
                anc = anc.parentElement;
              }
              return {
                left,
                top,
                right,
                bottom,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top),
              };
            };
            const frs = figs.map((el) => ({ el, r: paintedRect(el) }));
            const trs = texts.map((el) => ({
              el,
              r: el.getBoundingClientRect(),
            }));
            for (const f of frs) {
              if (f.r.width === 0 || f.r.height === 0) continue;
              const fl = Math.max(f.r.left, 0);
              const ft = Math.max(f.r.top, 0);
              const fr = Math.min(f.r.right, window.innerWidth);
              const fb = Math.min(f.r.bottom, window.innerHeight);
              for (const t of trs) {
                if (t.r.width === 0 || t.r.height === 0) continue;
                const tl = Math.max(t.r.left, 0);
                const tt = Math.max(t.r.top, 0);
                const trr = Math.min(t.r.right, window.innerWidth);
                const tb = Math.min(t.r.bottom, window.innerHeight);
                const ox = Math.min(fr, trr) - Math.max(fl, tl);
                const oy = Math.min(fb, tb) - Math.max(ft, tt);
                samples += 1;
                if (ox > 0 && oy > 0) {
                  const area = ox * oy;
                  if (area > maxOverlap) {
                    maxOverlap = area;
                    const inBench = f.el.closest(".detective-bench")
                      ? "bench"
                      : "map";
                    worst =
                      `${inBench}:${f.el.getAttribute("data-pose") ?? "?"} over ` +
                      `"${(t.el.textContent ?? "").slice(0, 24)}"`;
                  }
                }
              }
            }
          } catch {
            /* the audit never breaks the page */
          }
          if (performance.now() - t0 < dwell) {
            requestAnimationFrame(frame);
          } else {
            resolve({ samples, maxOverlap, worst });
          }
        };
        requestAnimationFrame(frame);
      }),
    ms,
  );
}

/** Accumulates audit windows across a test's checkpoints. */
export class AuditTrail {
  samples = 0;
  maxOverlap = 0;
  worst = "";
  absorb(s: AuditStats, label: string) {
    this.samples += s.samples;
    if (s.maxOverlap > this.maxOverlap) {
      this.maxOverlap = s.maxOverlap;
      this.worst = s.worst;
    }
    expect(
      s.samples,
      `${label}: audit window must have sampled figure/text pairs`,
    ).toBeGreaterThan(10);
    expect(
      this.maxOverlap,
      `${label}: figure-over-clue-text overlap must be 0 px\u00b2 (worst: ${this.worst}, ${this.samples} pair samples so far)`,
    ).toBe(0);
  }
  async collect(page: Page, label: string, ms = 900) {
    this.absorb(await collectAuditWindow(page, ms), label);
  }
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
