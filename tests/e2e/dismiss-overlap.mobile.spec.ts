import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Dismiss-vs-sound-toggle overlap measurement (follow-up to #114).
 * Asserts the 44px dismiss and the eyebrow sound toggle have 0px²
 * bounding-box intersection at 360px and 390px widths.
 */
const APP = "http://127.0.0.1:4123/Meridian/";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Suppress Grandpa's tour (it yields the host) and the tutorial invite. */
async function seedQuietHome(page: Page) {
  await page.context().addInitScript(
    (seeds: Record<string, string>) => {
      try {
        for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
      } catch {
        /* private mode — ignore */
      }
    },
    {
      "meridian.grandpaTour.lastDate": todayKey(),
      "meridian.tutorialSeen": "1",
    }
  );
}

async function overlapArea(page: Page, w: number): Promise<number> {
  await seedQuietHome(page);
  await page.setViewportSize({ width: w, height: 844 });
  await page.goto(APP, { waitUntil: "networkidle" });
  const dismiss = page.locator(".storyteller-home-dismiss");
  await dismiss.waitFor({ state: "visible", timeout: 30_000 });
  const d = await dismiss.boundingBox();
  const toggle = page.locator(".atlas-sound-toggle");
  const t = await toggle.boundingBox();
  if (!d || !t) throw new Error(`missing box @${w}px`);
  const ix = Math.max(0, Math.min(d.x + d.width, t.x + t.width) - Math.max(d.x, t.x));
  const iy = Math.max(0, Math.min(d.y + d.height, t.y + t.height) - Math.max(d.y, t.y));
  console.log(
    `@${w}px dismiss=(${d.x.toFixed(1)},${d.y.toFixed(1)},${d.width.toFixed(1)}x${d.height.toFixed(1)}) ` +
      `toggle=(${t.x.toFixed(1)},${t.y.toFixed(1)},${t.width.toFixed(1)}x${t.height.toFixed(1)}) ` +
      `overlap=${(ix * iy).toFixed(1)}px²`
  );
  return ix * iy;
}

test("dismiss × sound toggle: 0px² overlap @390px", async ({ page, context }) => {
  await serveBuiltArtifact(context);
  expect(await overlapArea(page, 390)).toBe(0);
});

test("dismiss × sound toggle: 0px² overlap @360px", async ({ page, context }) => {
  await serveBuiltArtifact(context);
  expect(await overlapArea(page, 360)).toBe(0);
});
