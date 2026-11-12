import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPlaying,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

const MEDIA_HOST = "https://veeresh-bikkaneti.github.io";

/**
 * Journal player E2E — the movie plays under the REAL production CSP.
 *
 * The clips live on meridian-media Pages, so the <video> element needs
 * media-src to allow veeresh-bikkaneti.github.io (and prefetch fetch()
 * needs connect-src). The production CSP is the Content-Security-Policy
 * of the /* block in public/_headers — this spec reads that file, serves
 * the app shell with exactly that header, and asserts the movie's
 * currentTime advances. With the host missing from media-src the load is
 * CSP-blocked and currentTime never moves, so this spec fails without the
 * fix and passes with it. The video src stays the REAL meridian-media
 * URL; only the bytes are local (Chromium in this VM cannot reach
 * github.io). Rotation-agnostic by design: it plays whichever entry the
 * pinned instant shows — the 3-per-set player rotation and the
 * 1-per-30-minute prefetch rotation show different entries at the same
 * instant, and the CSP question is identical for either.
 */
function productionCsp(): string {
  const text = readFileSync("public/_headers", "utf8");
  const lines = text.split("\n");
  let inGlobal = false;
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobal = line.trim() === "/*";
      continue;
    }
    if (!inGlobal) continue;
    const i = line.indexOf(":");
    if (line.slice(0, i).trim() === "Content-Security-Policy") {
      return line.slice(i + 1).trim();
    }
  }
  throw new Error("production CSP not found in public/_headers");
}

test.setTimeout(180_000);
test.use({ viewport: { width: 1280, height: 800 } });

test("journal movie plays under the real production CSP", async ({
  context,
  page,
}) => {
  const csp = productionCsp();
  expect(csp).toContain(`media-src 'self' data: blob: ${MEDIA_HOST}`);
  expect(csp).toContain(`${MEDIA_HOST}`);

  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);

  // Serve the app shell with the real production CSP headers. This route
  // is registered after serveBuiltArtifact, so it wins dispatch for the
  // document URLs; the video and manifest subresources are governed by
  // the document's CSP.
  const shell = readFileSync(path.resolve("dist/client/_shell.html"));
  let servedCsp: string | null = null;
  page.on("response", (res) => {
    if (res.url().endsWith("/Meridian/") || res.url().endsWith("/Meridian")) {
      servedCsp = res.headers()["content-security-policy"] ?? null;
    }
  });
  await context.route(
    (url) => url.pathname === "/Meridian" || url.pathname === "/Meridian/",
    async (route) => {
      await route.fulfill({
        status: 200,
        body: shell,
        contentType: "text/html",
        headers: { "content-security-policy": csp },
      });
    },
  );

  // Pin the clock to a fixed instant and play whichever entry it shows.
  // (Player: a 3-entry set headed by Old Faithful. Prefetch B8: the one
  // entry in that 30-minute window. Either way the <video> src is a
  // meridian-media URL, which is what CSP governs.)
  const time = new Date(Date.UTC(2026, 9, 17, 16, 0, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBeGreaterThan(0);
  const id = ids[0];

  const video = await openEntry(page, id);
  await expectPlaying(video);
  const t = await video.evaluate((v) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  expect(servedCsp, "document served the production CSP").toBe(csp);
  console.log(`csp: movie currentTime advanced to ${t.toFixed(2)}s under production CSP (entry ${id})`);
});
