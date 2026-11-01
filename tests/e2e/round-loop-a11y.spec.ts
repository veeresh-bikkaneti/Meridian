import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  dismissTileOverlayIfPresent,
  readPhase,
  dropButton,
  nextPlaceButton,
  clickNextPlace,
  spotViewportPoint,
  tapHitsMap,
} from "./helpers";

/**
 * Wave 1 P0 Item 3 — round-loop accessibility (manifest §2 Item 3).
 *
 * Assertions use roles/labels, document.activeElement, and a live-region
 * MutationObserver only — never pixels. Sound is seeded off
 * (localStorage `meridian.sound` = "off") so narration cannot move focus
 * or add audio-driven announcements mid-test.
 *
 * The designated reveal announcer is the GameApp sr-only live paragraph
 * ("Pin dropped. …" at revealDone). The result-card AI sentence and the
 * satellite-map zoom-space announcements are NOT reveal announcers: the
 * former is visible text only, the latter is silenced while a reveal
 * card is up. Counting rule: a live-region text change counts only when
 * it lands a non-empty, distinct text (clearing a region announces
 * nothing to a screen reader).
 */

test.setTimeout(480_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Seed sound off before any navigation in the test.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("meridian.sound", "off");
    } catch {
      /* private mode — ignore */
    }
  });
});

const mapEl = (page: Page) => page.locator(".satellite-map");
const readZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-zoom").then((v) => Number(v));
const readMaxZoom = (page: Page): Promise<number> =>
  mapEl(page).getAttribute("data-max-zoom").then((v) => Number(v));

async function awaitGlobeDiveDone(page: Page): Promise<void> {
  await expect
    .poll(() => mapEl(page).getAttribute("data-zoom"), { timeout: 30_000 })
    .toBe("2");
}

/** Wait until data-zoom is stable across 800 ms (return beat settled). */
async function awaitZoomStable(page: Page): Promise<number> {
  let stable: number | null = null;
  await expect
    .poll(
      async () => {
        const a = await readZoom(page);
        await page.waitForTimeout(800);
        const b = await readZoom(page);
        if (a === b) {
          stable = b;
          return String(b);
        }
        return null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return stable!;
}

/** Install the live-region observer; returns helpers to slice its log.
 *
 * Counting rule (per live element, not per mutation sweep): an entry is
 * recorded only when one live element's own text changes to a new
 * non-empty value. Re-rendering the same text, and other elements'
 * changes, never re-count an element's current announcement. A freshly
 * mounted live element with non-empty text counts once (that is how a
 * result card's announcement arrives). Clearing a region announces
 * nothing and is not counted. */
async function installLiveObserver(page: Page): Promise<{
  slice: (from: number) => Promise<string[]>;
  length: () => Promise<number>;
}> {
  await page.evaluate(() => {
    const seen: string[] = [];
    const lastByEl = new Map<Element, string>();
    (window as unknown as { __liveSeen: string[] }).__liveSeen = seen;
    const record = () => {
      document
        .querySelectorAll('[aria-live], [role="status"], [role="alert"]')
        .forEach((el) => {
          const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
          const prev = lastByEl.get(el) ?? "";
          lastByEl.set(el, t);
          if (t && t !== prev) seen.push(t);
        });
    };
    const obs = new MutationObserver(record);
    if (document.body) {
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    (window as unknown as { __liveObs: MutationObserver }).__liveObs = obs;
  });
  return {
    slice: (from: number) =>
      page.evaluate(
        (f) => (window as unknown as { __liveSeen: string[] }).__liveSeen.slice(f),
        from,
      ),
    length: () =>
      page.evaluate(() => (window as unknown as { __liveSeen: string[] }).__liveSeen.length),
  };
}

/** The GameApp sr-only live paragraph (the designated announcer). */
async function gameLiveText(page: Page): Promise<string> {
  const texts = await page
    .locator('p.sr-only[aria-live="polite"]')
    .allTextContents();
  return (texts[0] ?? "").trim().replace(/\s+/g, " ");
}

async function activeElementInfo(page: Page): Promise<{
  tag: string;
  id: string;
  label: string;
  text: string;
  inDialog: boolean;
  inMap: boolean;
  visible: boolean;
}> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { tag: "", id: "", label: "", text: "", inDialog: false, inMap: false, visible: false };
    const dialog = document.querySelector('[role="dialog"]');
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      id: el.id,
      label: el.getAttribute("aria-label") ?? "",
      text: (el.textContent ?? "").trim().slice(0, 80),
      inDialog: !!dialog?.contains(el),
      inMap: !!el.closest?.(".satellite-map"),
      visible: r.width > 0 && r.height > 0,
    };
  });
}

/**
 * Commit a guaranteed miss, slicing live announcements around the Drop
 * click only (the map tap's own "Pin placed." announcement precedes it
 * and belongs to aiming, not the reveal). Retries on the ~1% hit.
 */
async function commitMissObserved(
  page: Page,
  obs: { slice: (from: number) => Promise<string[]>; length: () => Promise<number> },
): Promise<{ announcements: string[]; phase: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    await page.mouse.click(500, 400);
    await expect(dropButton(page)).toBeEnabled();
    const mark = await obs.length();
    await dropButton(page).click();
    let phase: string | null = null;
    await expect
      .poll(
        async () => {
          phase = await readPhase(page);
          return phase;
        },
        { timeout: 20_000 },
      )
      .toMatch(/^(story|done)$/);
    if (phase === "done") {
      await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
      return { announcements: await obs.slice(mark), phase };
    }
    // Rare hit: move on and try the next place.
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitMissObserved: (500, 400) hit three places in a row");
}

test("3A reveal announces exactly once to the screen reader", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const { announcements } = await commitMissObserved(page, obs);
  expect(
    announcements,
    `reveal must announce exactly once, got ${announcements.length}: ${JSON.stringify(announcements)}`,
  ).toHaveLength(1);
});

/**
 * Commit a guaranteed hit, slicing live announcements around the Drop
 * click only — mirroring commitMissObserved, including its mark-after-tap
 * placement (the map tap's own "Pin placed." announcement precedes the
 * mark). A projected spot on the globe's far side commits as a miss:
 * burn that place and retry, like the shared commitHit helper.
 */
async function commitHitObserved(
  page: Page,
  obs: { slice: (from: number) => Promise<string[]>; length: () => Promise<number> },
): Promise<{ announcements: string[]; phase: string | null }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await dismissTileOverlayIfPresent(page);
    const spot = await spotViewportPoint(page);
    const inView =
      spot && spot.x >= 0 && spot.x <= 1440 && spot.y >= 0 && spot.y <= 900;
    if (inView && (await tapHitsMap(page, spot.x, spot.y))) {
      await page.mouse.click(spot.x, spot.y);
      await expect(dropButton(page)).toBeEnabled();
      const mark = await obs.length();
      await dropButton(page).click();
      let phase: string | null = null;
      await expect
        .poll(
          async () => {
            phase = await readPhase(page);
            return phase;
          },
          { timeout: 20_000 },
        )
        .toMatch(/^(story|done)$/);
      if (phase === "story") {
        await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
        return { announcements: await obs.slice(mark), phase };
      }
      // Far-side miss: burn this place and try the next.
    } else {
      // Spot not tappable: burn this place with a miss, move on.
      await commitMissObserved(page, obs);
    }
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  throw new Error("commitHitObserved: no tappable spot in 10 attempts");
}

test("3A-hit hit reveal announces exactly once to the screen reader", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  // Test-only non-first profile: a first-ever win ALSO fires the
  // first-win celebration overlay (game-app.tsx:2838, gated on
  // localStorage "meridian.firstWinCelebrated"), a separate intentional
  // announcement — not a reveal announcement. Seeding its flag makes
  // this test about the reveal announcer only. The celebration itself
  // is NOT weakened or changed: it still fires for genuine first wins.
  await page.evaluate(() => {
    try {
      localStorage.setItem("meridian.firstWinCelebrated", "1");
    } catch {
      /* private mode — ignore */
    }
  });
  const obs = await installLiveObserver(page);
  const { announcements } = await commitHitObserved(page, obs);
  expect(
    announcements,
    `hit reveal must announce exactly once, got ${announcements.length}: ${JSON.stringify(announcements)}`,
  ).toHaveLength(1);
});

test("3B Next place moves focus to the new question, not body", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  await commitMissObserved(page, obs);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // Focus must land on the new question (heading or map), never body.
  await expect
    .poll(() => activeElementInfo(page), { timeout: 10_000 })
    .not.toMatchObject({ tag: "BODY" });
  const afterNext = await activeElementInfo(page);
  expect(
    afterNext.tag,
    `focus after Next place must be on the new question, got ${afterNext.tag} "${afterNext.text}"`,
  ).not.toBe("BODY");
  // Fix round L4: "not BODY" alone is weak — the focus must land
  // INSIDE the map (probe-verified: a DIV inside .satellite-map).
  // This is a GUARD, not RED evidence: it passes on the current
  // build. The question proof stays the Tab-control + live
  // announcement assertions below.
  expect(
    afterNext.inMap,
    `focus after Next place must be inside .satellite-map, got ${afterNext.tag} "${afterNext.text}"`,
  ).toBe(true);
  // One Tab after must land on a control of the new question.
  await page.keyboard.press("Tab");
  const afterTab = await activeElementInfo(page);
  expect(afterTab.tag, "one Tab after Next place must land on a control").toMatch(/^(BUTTON|A|INPUT|SELECT)$/);
  expect(afterTab.visible, "the Tab landing control must be visible").toBe(true);
  expect(
    afterTab.inMap || afterTab.tag === "BUTTON",
    `Tab landing must be a control of the new question, got ${afterTab.tag} "${afterTab.label || afterTab.text}"`,
  ).toBe(true);
  // The live region must announce the new question.
  await expect
    .poll(() => gameLiveText(page), { timeout: 10_000 })
    .toMatch(/^Find .+\.$/);
});

test("3C Game summary dialog traps focus, closes on Escape, returns focus", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await page.getByTestId("end-game-button").click();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // Sub-assertion 1: initial focus inside the dialog.
  const initial = await activeElementInfo(page);
  expect(initial.inDialog, `initial focus must be inside the dialog, got ${initial.tag}`).toBe(true);
  // Sub-assertion 2: bounded Tab walk (max 40) never leaves the dialog.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await activeElementInfo(page);
    expect(info.inDialog, `Tab ${i + 1} left the dialog to ${info.tag}`).toBe(true);
  }
  // Sub-assertion 3: Escape closes it and focus returns to a VISIBLE,
  // usable control (not body, not hidden). Closing the summary lands
  // home (the End-game opener unmounts with the game), so the landing
  // is the home heading / a home control — never body.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  const afterEscape = await activeElementInfo(page);
  expect(afterEscape.tag, "focus after Escape must not be body").not.toBe("BODY");
  expect(afterEscape.visible, "focus after Escape must be on a visible control").toBe(true);
});

/**
 * Shared 3D setup (fix round 3): globe dive done, zoom at least 2 below
 * the cap, a committed miss, and the reveal's own camera settled. Then
 * the settled reveal zoom is nudged with the real Zoom in/out buttons
 * (outside any beat) into [3, max - 1]: the return beat flies out to the
 * region framing, which settles at data-zoom 2, so a pre-return level of
 * 3+ is what makes "zoomed from the settled level" distinguishable from
 * "zoomed from the return target" — and +1 must stay under the cap.
 * Returns the settled pre-return zoom.
 */
async function settleRevealZoomForReturn(
  page: Page,
): Promise<{ preReturn: number; maxZoom: number }> {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  // Test-only non-first profile (as in 3A-hit): commitMissObserved's
  // rare-hit retry would otherwise raise the first-win celebration
  // overlay, which intercepts the Next place click until the test times
  // out (observed once in round 3). The celebration is not changed.
  await page.evaluate(() => {
    try {
      localStorage.setItem("meridian.firstWinCelebrated", "1");
    } catch {
      /* private mode — ignore */
    }
  });
  const maxZoom = await readMaxZoom(page);
  for (let i = 0; i < 10; i++) {
    if ((await readZoom(page)) <= maxZoom - 2) break;
    await page.getByRole("button", { name: "Zoom out" }).click();
    await awaitZoomStable(page);
  }
  expect(await readZoom(page)).toBeLessThanOrEqual(maxZoom - 2);
  await commitMissObserved(page, await installLiveObserver(page));
  let preReturn = await awaitZoomStable(page);
  for (let i = 0; i < 6 && (preReturn < 3 || preReturn > maxZoom - 1); i++) {
    await page
      .getByRole("button", { name: preReturn < 3 ? "Zoom in" : "Zoom out" })
      .click();
    preReturn = await awaitZoomStable(page);
  }
  expect(preReturn, "pre-return zoom must sit in [3, max - 1]").toBeGreaterThanOrEqual(3);
  expect(preReturn, "pre-return zoom must sit in [3, max - 1]").toBeLessThanOrEqual(maxZoom - 1);
  return { preReturn, maxZoom };
}

/** Text of every polite live region currently reading "Zoom level N". */
const zoomLiveText = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('[aria-live="polite"]').forEach((el) => {
      const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
      if (/^Zoom level \d+$/.test(t)) out.push(t);
    });
    return out;
  });

/** RETURN_DURATION_MS in src/map/zoom-space.ts (pinned by its unit test). */
const RETURN_BEAT_MS = 1200;
/** Fix round 4: the press fires only once the LIVE camera zoom has left
 *  the settled pre-return level by at least this much (measured, not
 *  assumed from a timer). 0.6, not 0.5: at exactly 0.5 below, the
 *  pre-fix path (zoomIn from the live zoom) rounds back to pre + 1. */
const IN_FLIGHT_MIN_DELTA = 0.6;

/**
 * One in-page attempt at the 3D(a) press: clicks Next place, then presses
 * the real Zoom in button on the first animation frame that is provably
 * mid-flight in the return beat (see the 3D(a) comment). Moved out of the
 * test body unchanged so the test can retry it on a fresh round.
 */
function pressZoomInMidReturn(page: Page, preReturn: number) {
  return page.evaluate(
    ({ minDelta, pre, beatMs }) => {
      type Log = {
        zoom: { t: number; z: string | null }[];
        announce: { t: number; text: string }[];
        zoomend: { t: number; z: number; inPress: boolean }[];
        pressT: number | null;
      };
      const w = window as unknown as { __z3d: Log; __z3dCleanup?: () => void };
      // Detach a previous attempt's observers and zoomend listener.
      w.__z3dCleanup?.();
      const wrapper = document.querySelector(".satellite-map")!;
      const log: Log = { zoom: [], announce: [], zoomend: [], pressT: null };
      w.__z3d = log;
      // React fiber walk (test-only read): find the SatelliteMap refs.
      type LiveMap = {
        getZoom(): number;
        stop(): unknown;
        on(e: string, f: () => void): unknown;
        off(e: string, f: () => void): unknown;
      };
      type Ctrl = { beatKind: string | null; skipChoreography(): unknown };
      const fiberKey = Object.keys(wrapper).find((k) => k.startsWith("__reactFiber$"));
      let liveMap: LiveMap | null = null;
      let ctrl: Ctrl | null = null;
      type Hook = { memoizedState: unknown; next: Hook | null };
      type Fiber = { type: unknown; memoizedState: unknown; return: Fiber | null };
      let f = fiberKey
        ? ((wrapper as unknown as Record<string, unknown>)[fiberKey] as Fiber)
        : null;
      while (f && !(liveMap && ctrl)) {
        if (typeof f.type === "function") {
          let h = f.memoizedState as Hook | null;
          while (h && typeof h === "object" && "next" in h) {
            const s = h.memoizedState as { current?: unknown } | null;
            const c = s && typeof s === "object" && "current" in s ? s.current : null;
            if (c && typeof c === "object") {
              const o = c as Record<string, unknown>;
              if (!liveMap && typeof o.getZoom === "function" && typeof o.stop === "function" && typeof o.on === "function")
                liveMap = c as LiveMap;
              if (!ctrl && typeof o.skipChoreography === "function") ctrl = c as Ctrl;
            }
            h = h.next;
          }
        }
        f = f.return;
      }
      if (!liveMap || !ctrl) {
        throw new Error(`3D(a): fiber walk found liveMap=${!!liveMap} ctrl=${!!ctrl}`);
      }
      const m = liveMap;
      const cc = ctrl;
      let t0 = 0;
      const now = () => Math.round(performance.now() - t0);
      let inPress = false;
      const onZoomEnd = () => log.zoomend.push({ t: now(), z: m.getZoom(), inPress });
      m.on("zoomend", onZoomEnd);
      const zoomObs = new MutationObserver(() =>
        log.zoom.push({ t: now(), z: wrapper.getAttribute("data-zoom") }),
      );
      zoomObs.observe(wrapper, { attributes: true, attributeFilter: ["data-zoom"] });
      // Seed each live region with the text it already holds, so a region
      // still showing an earlier announcement (e.g. the setup's own Zoom
      // in/out press) is not logged as new when the next mutation scans it.
      // A region inserted later, or a text change, is still logged.
      const liveText = (el: Element) => (el.textContent ?? "").trim().replace(/\s+/g, " ");
      const lastByEl = new Map<Element, string>();
      document.querySelectorAll('[aria-live="polite"]').forEach((el) => lastByEl.set(el, liveText(el)));
      const announceObs = new MutationObserver(() => {
        document.querySelectorAll('[aria-live="polite"]').forEach((el) => {
          const s = liveText(el);
          if (/^Zoom level \d+$/.test(s) && s !== lastByEl.get(el)) {
            log.announce.push({ t: now(), text: s });
          }
          lastByEl.set(el, s);
        });
      });
      announceObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      w.__z3dCleanup = () => {
        zoomObs.disconnect();
        announceObs.disconnect();
        m.off("zoomend", onZoomEnd);
        w.__z3dCleanup = undefined;
      };
      // The result card's button reads "Next place" (pinned bar) or
      // "Next place →" (full card); take the rendered one.
      const findButton = (name: string) =>
        [...document.querySelectorAll("button")].find((b) => {
          const label = (b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
          const r = b.getBoundingClientRect();
          return label.startsWith(name) && r.width > 0 && r.height > 0;
        }) as HTMLButtonElement | undefined;
      const next = findButton("Next place");
      if (!next) throw new Error("3D(a): no Next place button");
      const zoomAtNext = wrapper.getAttribute("data-zoom");
      const liveAtNext = m.getZoom();
      const frames: { t: number; z: number; bk: string | null }[] = [];
      t0 = performance.now();
      next.click();
      return new Promise<{
        pressed: boolean;
        reason: string;
        offsetMs: number;
        zoomAtNext: string | null;
        liveAtNext: number;
        liveAtPress: number | null;
        beatAtPress: string | null;
        zoomAtPress: string | null;
        zoomChangesBeforePress: number;
        pressZoomends: { t: number; z: number }[];
        frames: { t: number; z: number; bk: string | null }[];
      }>((resolve) => {
        let sawReturn = false;
        const done = (pressed: boolean, reason: string, extra: Partial<{ offsetMs: number; liveAtPress: number; beatAtPress: string | null; zoomAtPress: string | null; zoomChangesBeforePress: number; pressZoomends: { t: number; z: number }[] }> = {}) =>
          resolve({
            pressed,
            reason,
            offsetMs: extra.offsetMs ?? now(),
            zoomAtNext,
            liveAtNext,
            liveAtPress: extra.liveAtPress ?? null,
            beatAtPress: extra.beatAtPress ?? null,
            zoomAtPress: extra.zoomAtPress ?? null,
            zoomChangesBeforePress: extra.zoomChangesBeforePress ?? log.zoom.length,
            pressZoomends: extra.pressZoomends ?? [],
            frames,
          });
        const frame = () => {
          const z = m.getZoom();
          const bk = cc.beatKind;
          frames.push({ t: now(), z: Math.round(z * 1000) / 1000, bk });
          if (bk === "return") sawReturn = true;
          if (bk === "return" && pre - z >= minDelta && liveAtNext - z >= minDelta) {
            // Retry support: a frame at or past the beat is a timing miss.
            // Do not press, so the missed attempt leaves no Zoom in press
            // (zoom step, pending announcement) to leak into the next one.
            // tPress is read immediately before the click and is used
            // for both this guard and offsetMs, so a press at ~1199 ms is
            // never misclassed by time spent inside the click.
            const zoomAtPress = wrapper.getAttribute("data-zoom");
            const zoomChangesBeforePress = log.zoom.length;
            const zoomIn = findButton("Zoom in");
            if (!zoomIn) return done(false, "no Zoom in button");
            const n0 = log.zoomend.length;
            const tPress = now();
            if (tPress >= beatMs) return done(false, `first in-flight frame at ${tPress} ms, past the ${beatMs} ms beat; not pressed`, { offsetMs: tPress });
            log.pressT = tPress;
            inPress = true;
            zoomIn.click();
            inPress = false;
            return done(true, "in-flight", {
              offsetMs: tPress,
              liveAtPress: z,
              beatAtPress: bk,
              zoomAtPress,
              zoomChangesBeforePress,
              pressZoomends: log.zoomend.slice(n0).filter((e) => e.inPress).map(({ t, z }) => ({ t, z })),
            });
          }
          if (sawReturn && bk !== "return") return done(false, "return beat ended before the live zoom left the settled level");
          if (now() > beatMs + 1000) return done(false, `no in-flight frame within ${beatMs + 1000} ms (sawReturn=${sawReturn})`);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    },
    { minDelta: IN_FLIGHT_MIN_DELTA, pre: preReturn, beatMs: RETURN_BEAT_MS },
  );
}

/**
 * Why an attempt did not land inside the return beat, or null when it
 * did. Only TIMING misses qualify (no in-flight frame seen, press at or
 * after the 1200 ms beat, beat not "return", live zoom not yet
 * IN_FLIGHT_MIN_DELTA below the settled level): on a slow runner the rAF
 * loop gets a frame only every ~300-450 ms, so the first frame far enough
 * into the beat can fall past 1200 ms. A missing Zoom in button is not a
 * timing miss and fails at once. An in-beat attempt is never retried: it
 * is judged by every assertion in the test.
 */
function returnBeatMiss(
  press: Awaited<ReturnType<typeof pressZoomInMidReturn>>,
  preReturn: number,
): string | null {
  if (!press.pressed) return press.reason === "no Zoom in button" ? null : `not pressed: ${press.reason}`;
  if (press.offsetMs >= RETURN_BEAT_MS) return `press at ${press.offsetMs} ms, not < ${RETURN_BEAT_MS} ms`;
  if (press.beatAtPress !== "return") return `beat at press was ${press.beatAtPress}`;
  const live = press.liveAtPress ?? preReturn;
  if (preReturn - live < IN_FLIGHT_MIN_DELTA || press.liveAtNext - live < IN_FLIGHT_MIN_DELTA)
    return `live zoom ${live} not >= ${IN_FLIGHT_MIN_DELTA} below settled ${preReturn} / Next ${press.liveAtNext}`;
  return null;
}

/** After the press's announcement appears, how long 3D(a) keeps
 *  listening before asserting it was the only one. */
const ANNOUNCE_QUIET_MS = 1500;

/** Attempts per 3D(a) run before a return-beat miss fails the test. */
const MID_BEAT_MAX_ATTEMPTS = 8;

/**
 * After a missed 3D(a) attempt: wait for the new place's question, commit
 * a fresh miss, and park the reveal camera in [3, max - 1] again — the
 * same steps settleRevealZoomForReturn takes after its globe dive.
 */
async function nextRevealForReturn(page: Page, maxZoom: number): Promise<number> {
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect
    .poll(() => mapEl(page).getAttribute("aria-hidden"), { timeout: 30_000 })
    .not.toBe("true");
  await awaitZoomStable(page);
  for (let i = 0; i < 10; i++) {
    if ((await readZoom(page)) <= maxZoom - 2) break;
    await page.getByRole("button", { name: "Zoom out" }).click();
    await awaitZoomStable(page);
  }
  expect(await readZoom(page)).toBeLessThanOrEqual(maxZoom - 2);
  await commitMissObserved(page, await installLiveObserver(page));
  let preReturn = await awaitZoomStable(page);
  for (let i = 0; i < 6 && (preReturn < 3 || preReturn > maxZoom - 1); i++) {
    await page
      .getByRole("button", { name: preReturn < 3 ? "Zoom in" : "Zoom out" })
      .click();
    preReturn = await awaitZoomStable(page);
  }
  expect(preReturn, "pre-return zoom must sit in [3, max - 1]").toBeGreaterThanOrEqual(3);
  expect(preReturn, "pre-return zoom must sit in [3, max - 1]").toBeLessThanOrEqual(maxZoom - 1);
  return preReturn;
}

test("3D(a) Zoom in pressed mid return beat zooms from the settled pre-return level and announces it", async ({
  page,
}) => {
  const settled = await settleRevealZoomForReturn(page);
  const { maxZoom } = settled;
  let preReturn = settled.preReturn;
  let expected = preReturn + 1;
  // Node <-> browser round trips on this VM and on CI runners (click
  // 1.7–4.5 s, evaluate up to ~7 s) are longer than the 1200 ms beat, so
  // the Next place click and the Zoom in press both run in the page.
  //
  // Fix round 4: the in-beat condition is MEASURED. The test reads the
  // live MapLibre camera and the beat controller through React's own
  // fiber links on the .satellite-map element (test-side read only; no
  // src hook): the SatelliteMap component's refs hold the Map
  // (getZoom/stop/on) and the ZoomSpaceController (beatKind). A rAF loop
  // started at the Next place click presses the REAL Zoom in button in
  // the first frame where beatKind === "return" AND the live zoom is at
  // least IN_FLIGHT_MIN_DELTA below both the settled pre-return level
  // and the live zoom read at the Next click — truly mid-flight. A test-side zoomend listener (registered after the
  // app's) records every zoomend with its live zoom, flagged when it
  // fires synchronously inside the press: that is the beat's stop().
  // If the condition is never met before the beat ends, the test fails
  // loudly; it never presses on an assumed timer.
  // Retry (slow runners): an attempt whose press missed the return
  // beat (returnBeatMiss) proves nothing either way, so the test plays a
  // fresh round and tries again, up to MID_BEAT_MAX_ATTEMPTS, and fails
  // loudly if every attempt misses. The first in-beat attempt is then
  // held to every assertion below, unchanged.
  const attempts: string[] = [];
  let press!: Awaited<ReturnType<typeof pressZoomInMidReturn>>;
  for (let attempt = 1; ; attempt++) {
    press = await pressZoomInMidReturn(page, preReturn);
    const miss = returnBeatMiss(press, preReturn);
    const firstReturn = press.frames.find((fr) => fr.bk === "return");
    const line = `attempt ${attempt}/${MID_BEAT_MAX_ATTEMPTS}: offsetMs=${press.offsetMs} preReturn=${preReturn} frames=${press.frames.length} firstReturnFrameMs=${firstReturn?.t ?? "none"} ${miss ? `MISS (${miss})` : "in-beat"}`;
    attempts.push(line);
    console.log(`3D(a) ${line}`);
    if (!miss) break;
    if (attempt >= MID_BEAT_MAX_ATTEMPTS) {
      throw new Error(
        `3D(a): all ${MID_BEAT_MAX_ATTEMPTS} attempts missed the ${RETURN_BEAT_MS} ms return beat:\n${attempts.join("\n")}\nlast frames=${JSON.stringify(press.frames)}`,
      );
    }
    // End of a missed attempt: detach its observers and zoomend listener.
    await page.evaluate(() => (window as unknown as { __z3dCleanup?: () => void }).__z3dCleanup?.());
    preReturn = await nextRevealForReturn(page, maxZoom);
    expected = preReturn + 1;
  }
  test.info().annotations.push({ type: "3D(a) attempts", description: attempts.join(" | ") });
  const { frames, ...pressCore } = press;
  const diag = `press=${JSON.stringify(pressCore)} preReturn=${preReturn}`;
  test.info().annotations.push({ type: "3D(a) mid-beat press", description: diag });
  console.log(`3D(a) ${diag}`);
  // 1. The press provably landed MID-FLIGHT inside the return beat —
  //    measured on the live camera, never assumed — or the test fails.
  expect(press.pressed, `no in-flight press: ${press.reason}; ${diag} frames=${JSON.stringify(frames)}`).toBe(true);
  expect(press.zoomAtNext, diag).toBe(String(preReturn));
  // The settled reveal camera may sit at a fractional zoom (data-zoom
  // is its rounding), so "left the settled level" is checked against
  // both the integer level and the live zoom measured at Next.
  expect(Math.abs(press.liveAtNext - preReturn), `the live camera at Next rounds to the pre-return level; ${diag}`).toBeLessThan(0.5);
  expect(press.beatAtPress, diag).toBe("return");
  expect(
    preReturn - (press.liveAtPress ?? preReturn),
    `live zoom at the press must be >= ${IN_FLIGHT_MIN_DELTA} below the settled ${preReturn}; ${diag}`,
  ).toBeGreaterThanOrEqual(IN_FLIGHT_MIN_DELTA);
  expect(
    press.liveAtNext - (press.liveAtPress ?? press.liveAtNext),
    `live zoom at the press must be >= ${IN_FLIGHT_MIN_DELTA} below the live zoom at Next; ${diag}`,
  ).toBeGreaterThanOrEqual(IN_FLIGHT_MIN_DELTA);
  expect(press.offsetMs, `press must fall inside the ${RETURN_BEAT_MS} ms return beat; ${diag}`).toBeLessThan(RETURN_BEAT_MS);
  expect(
    press.zoomChangesBeforePress,
    `data-zoom changed before the press — the return beat had already settled; ${diag}`,
  ).toBe(0);
  expect(press.zoomAtPress, `data-zoom at the press must still be the settled pre-return level; ${diag}`).toBe(
    String(preReturn),
  );
  // The beat's stop() fired a zoomend synchronously inside the press,
  // carrying the intermediate (mid-flight) zoom.
  expect(press.pressZoomends.length, `the press must stop the beat (synchronous zoomend); ${diag}`).toBeGreaterThanOrEqual(1);
  expect(
    Math.abs(press.pressZoomends[0]!.z - (press.liveAtPress ?? NaN)),
    `the stop() zoomend carries the mid-flight zoom; ${diag}`,
  ).toBeLessThan(0.1);
  // 2. The final zoom is the settled pre-return level + 1 (not the
  //    animated mid-return level + 1, not the return target + 1).
  const finalZoom = await awaitZoomStable(page);
  const log = await page.evaluate(
    () => (window as unknown as { __z3d: unknown }).__z3d,
  );
  expect(
    finalZoom,
    `mid-beat Zoom in must land on pre-return ${preReturn} + 1; ${diag} log=${JSON.stringify(log)}`,
  ).toBe(expected);
  // data-zoom goes straight from the settled level to the new one: the
  // stop()'s intermediate zoomend never reaches the zoom state.
  const zoomTrail = (log as { zoom: { z: string | null }[] }).zoom.map((e) => e.z);
  expect(
    zoomTrail,
    `data-zoom must step ${preReturn} -> ${expected} with no intermediate level; log=${JSON.stringify(log)}`,
  ).toEqual([String(expected)]);
  // 3. The live region announces the new level, and only that level
  //    (the stopped return's intermediate zoomend is never announced).
  await expect
    .poll(() => zoomLiveText(page), { timeout: 10_000 })
    .toContain(`Zoom level ${expected}`);
  // "Exactly once" needs an observation window: a duplicate written a few
  // hundred ms after the first one would otherwise land after the read.
  await page.waitForTimeout(ANNOUNCE_QUIET_MS);
  // Only announcements made at or after the press are the press's own.
  // Any "Zoom level N" announcement logged between Next and the press is
  // not this test's subject, but it is surfaced (annotation + console),
  // never dropped silently.
  const { announced, beforePress } = await page.evaluate(() => {
    const l = (window as unknown as { __z3d: { announce: { t: number; text: string }[]; pressT: number | null } }).__z3d;
    const p = l.pressT ?? Infinity;
    return {
      announced: l.announce.filter((a) => a.t >= p).map((a) => a.text),
      beforePress: l.announce.filter((a) => a.t < p),
    };
  });
  if (beforePress.length > 0) {
    const note = `"Zoom level N" announced between Next and the press: ${JSON.stringify(beforePress)}`;
    test.info().annotations.push({ type: "3D(a) pre-press announcement", description: note });
    console.log(`3D(a) WARNING ${note}`);
  }
  expect(
    announced,
    `the mid-beat press announces exactly once, the new level; log=${JSON.stringify(log)}`,
  ).toEqual([`Zoom level ${expected}`]);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
});

test("3D(b) Zoom in after the return beat settles steps +1 per press and announces each level", async ({
  page,
}) => {
  const { maxZoom } = await settleRevealZoomForReturn(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  // Post-settle path: read `before` only once the return beat has
  // finished moving data-zoom (stable across 800 ms).
  const settled = await awaitZoomStable(page);
  expect(settled, "two presses must fit under data-max-zoom").toBeLessThanOrEqual(maxZoom - 2);

  const pressZoomIn = async (): Promise<number> => {
    const before = await awaitZoomStable(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => readZoom(page), { timeout: 15_000 }).toBe(before + 1);
    const after = await awaitZoomStable(page);
    expect(after, `Zoom in from settled ${before} must land on ${before + 1}`).toBe(before + 1);
    await expect
      .poll(() => zoomLiveText(page), { timeout: 10_000 })
      .toContain(`Zoom level ${after}`);
    return after;
  };

  const z1 = await pressZoomIn();
  expect(z1).toBe(settled + 1);
  const z2 = await pressZoomIn();
  expect(z2).toBe(settled + 2);
});

test("3E new question never re-announces the previous reveal", async ({ page }) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const first = await commitMissObserved(page, obs);
  expect(first.announcements.length).toBeGreaterThan(0);
  const oldReveal = first.announcements[first.announcements.length - 1]!;
  const mark = await obs.length();
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect.poll(() => gameLiveText(page), { timeout: 10_000 }).toMatch(/^Find .+\.$/);
  // Settle: let any post-continue announcements land, then check.
  await page.waitForTimeout(1500);
  const after = await obs.slice(mark);
  expect(
    after,
    `new question must never re-announce the previous reveal ${JSON.stringify(oldReveal)}; saw ${JSON.stringify(after)}`,
  ).not.toContain(oldReveal);
});

test("3F(1) two reveals back to back announce only the second, once", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  const obs = await installLiveObserver(page);
  const first = await commitMissObserved(page, obs);
  expect(first.announcements).toHaveLength(1);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  const second = await commitMissObserved(page, obs);
  expect(
    second.announcements,
    `second reveal must announce exactly once, got ${JSON.stringify(second.announcements)}`,
  ).toHaveLength(1);
  expect(second.announcements[0]).not.toBe(first.announcements[0]);
});

test("visual: reveal + summary dialog at 360x740 and 390x844, floating controls do not overlap", async ({
  page,
}) => {
  await startGlobeRun(page);
  await awaitGlobeDiveDone(page);
  await commitMissObserved(page, await installLiveObserver(page));
  for (const [w, h] of [
    [360, 740],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expect(nextPlaceButton(page)).toBeVisible();
    await page.screenshot({ path: `test-results/round-loop-a11y-reveal-${w}.png` });
    // Floating controls must not intersect each other: Zoom in vs Zoom
    // out are the floating pair on the reveal surface (stacked column).
    const overlaps = await page.evaluate(() => {
      const zi = document.querySelector('button[aria-label="Zoom in"]') as HTMLElement | null;
      const zo = document.querySelector('button[aria-label="Zoom out"]') as HTMLElement | null;
      if (!zi || !zo) return { controls: 0, overlaps: -1 };
      const a = zi.getBoundingClientRect();
      const b = zo.getBoundingClientRect();
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { controls: 2, overlaps: x > 0 && y > 0 ? 1 : 0 };
    });
    expect(overlaps.controls).toBe(2);
    expect(overlaps.overlaps, `floating zoom controls overlap at ${w}x${h}`).toBe(0);
  }
  // Summary dialog screenshot at both viewports.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByTestId("end-game-button").click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  for (const [w, h] of [
    [360, 740],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: `test-results/round-loop-a11y-summary-${w}.png` });
    const overlaps = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return { controls: 0, overlaps: -1 };
      const boxes: DOMRect[] = [];
      dlg.querySelectorAll("button").forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) boxes.push(r);
      });
      let count = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (x > 0 && y > 0) count++;
        }
      }
      return { controls: boxes.length, overlaps: count };
    });
    expect(overlaps.controls).toBeGreaterThan(0);
    expect(overlaps.overlaps, `dialog buttons overlap at ${w}x${h}`).toBe(0);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
});
