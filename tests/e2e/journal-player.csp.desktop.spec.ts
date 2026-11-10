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
 * github.io).
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

  // Same pin as the Old Faithful spec: set index 20 (Old Faithful,
  // Rushmore, Gateway Arch).
  const time = new Date(Date.UTC(2026, 9, 17, 16, 0, 0));
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids).toEqual(["old-faithful", "rushmore", "gateway-arch"]);

  const video = await openEntry(page, "old-faithful");
  await expectPlaying(video);
  const t = await video.evaluate((v) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  expect(servedCsp, "document served the production CSP").toBe(csp);
  console.log(`csp: movie currentTime advanced to ${t.toFixed(2)}s under production CSP`);
});
