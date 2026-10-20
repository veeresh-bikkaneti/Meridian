import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * React #418 (hydration mismatch) regression guard — fix/hydration-418.
 *
 * The bug: the GitHub Pages build prerenders an SPA shell that renders
 * only the root route, so the index route's outlet was an empty
 * Suspense boundary in the served HTML. On the client, if the index
 * route's code-split chunk finished loading before the hydration pass
 * rendered, the client painted GameApp's boot splash into that
 * boundary, React threw error #418 ("server rendered HTML didn't
 * match the client"), and the whole prerendered tree was discarded
 * and re-rendered from scratch. Whether it fired was a timing race —
 * it showed up on fast pipes and under CPU throttling alike.
 *
 * The fix (src/routes/index.tsx): the index route is `ssr: false`
 * with the boot splash as its `pendingComponent`, so the router
 * paints the splash as the match's fallback in the served HTML and
 * hydration renders that same fallback — chunk timing can no longer
 * cause a mismatch.
 *
 * This spec pins both halves of the fix against the built artifact:
 * (a) the served shell HTML itself carries the splash headline, so
 *     the first paint comes from the prerender, not from JS;
 * (b) a full boot to the ready signal produces no #418 and no other
 *     hydration error on the console or as a pageerror.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("boot hydrates clean: splash paints from the served HTML, no React #418", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Capture the document the browser was actually served.
  let servedHtml = "";
  page.on("response", async (res) => {
    if (res.request().isNavigationRequest()) {
      try {
        servedHtml = await res.text();
      } catch {
        // A superseded navigation can fail to yield a body; the final
        // document's response is the one that matters and it lands
        // before goto() resolves.
      }
    }
  });

  await page.goto(APP_NO_IDLE);

  // (a) The headline paints from the served HTML — the splash is in
  // the prerender, not rendered later by JS. ("Daily geography" is
  // the discriminating string: it exists only in the splash markup,
  // while "Meridian" also appears in the old shell's title/OG tags.)
  expect(servedHtml).toContain("Daily geography");

  // The app boots all the way to its ready signal (the same flag the
  // crash watchdog watches).
  await page.waitForFunction(
    () =>
      (window as unknown as { __meridian_ready?: boolean })
        .__meridian_ready === true,
    undefined,
    { timeout: 120_000 },
  );

  // (b) No hydration mismatch fired on the way there.
  const allErrors = [...consoleErrors, ...pageErrors];
  const hydrationErrors = allErrors.filter((e) => /42[0-9]|hydrat/i.test(e));
  expect(hydrationErrors).toEqual([]);
});
