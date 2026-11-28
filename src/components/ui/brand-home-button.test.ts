/**
 * BrandHomeButton (fix/header-logo-home): the shell header's home
 * control is the homepage's brand lockup as a button — named
 * "Meridian home", two-ring compass svg (aria-hidden) + MERIDIAN
 * word, 44px floor, HomeButton's focus-visible treatment, and the
 * shared "home-button" testid. Rendered with react-dom/server
 * (the repo's node harness has no DOM), modelled on
 * home-button.test.ts, which stays untouched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { BrandHomeButton, BRAND_HOME_LABEL } from "./home-button.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("BrandHomeButton", () => {
  it("BRAND_HOME_LABEL is exactly Meridian home", () => {
    assert.equal(BRAND_HOME_LABEL, "Meridian home");
  });

  it("renders a type=button named exactly Meridian home, with the lockup, 44px floor and focus ring", () => {
    const html = renderToStaticMarkup(createElement(BrandHomeButton, { onHome: () => {} }));
    assert.match(html, /^<button type="button"/);
    assert.match(html, /aria-label="Meridian home"/);
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /min-h-11/);
    assert.match(html, /focus-visible:outline-2/);
    assert.match(html, /focus-visible:outline-offset-2/);
    assert.match(html, /brand-home-button/);
    // Visible word, and it is not the accessible name by itself —
    // the aria-label above is the name, as on the homepage brand.
    assert.match(html, /<span class="brand-home-word">MERIDIAN<\/span>/);
  });

  it("the mark is the homepage's exact two-ring lockup, aria-hidden", () => {
    const html = renderToStaticMarkup(createElement(BrandHomeButton, { onHome: () => {} }));
    assert.match(html, /<svg class="brand-home-mark" viewBox="0 0 48 48" aria-hidden="true"/);
    // Outer ring.
    assert.match(html, /<circle cx="24" cy="24" r="21\.5" fill="none" stroke="#8A6D2F" stroke-width="1\.6">/);
    // Inner ring — the ring the picker's old one-ring wordmark lacked.
    assert.match(html, /<circle cx="24" cy="24" r="16\.5" fill="none" stroke="#B8932F" stroke-width="\.8" stroke-opacity="\.6">/);
    // Star path and centre.
    assert.match(
      html,
      /<path d="M24 6 L27\.2 20\.8 L42 24 L27\.2 27\.2 L24 42 L20\.8 27\.2 L6 24 L20\.8 20\.8 Z" fill="#8A6D2F">/,
    );
    assert.match(html, /<circle cx="24" cy="24" r="3\.4" fill="#F6F1E3" stroke="#8A6D2F" stroke-width="1\.2">/);
  });

  it("carries a caller className (the shell's -ml-3) and a custom test id when asked", () => {
    const html = renderToStaticMarkup(
      createElement(BrandHomeButton, { onHome: () => {}, className: "-ml-3", testId: "home-button-custom" }),
    );
    assert.match(html, /-ml-3/);
    assert.match(html, /data-testid="home-button-custom"/);
    assert.match(html, /aria-label="Meridian home"/);
  });

  it("link mode: an <a href=\"/\"> named exactly Meridian home inside a router (N1 union, no location.href fake)", async () => {
    const root = createRootRoute({ component: () => createElement(BrandHomeButton, { to: "/" }) });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/privacy"] }),
    });
    await router.load();
    const html = renderToStaticMarkup(createElement(RouterProvider, { router } as never));
    assert.match(html, /<a [^>]*href="\/"/);
    assert.doesNotMatch(html, /<button/);
    assert.match(html, /aria-label="Meridian home"/);
    assert.match(html, /data-testid="home-button"/);
    assert.match(html, /brand-home-word/);
  });

  it("is not HomeButton: no House icon, no visible Home label text", () => {
    const html = renderToStaticMarkup(createElement(BrandHomeButton, { onHome: () => {} }));
    assert.doesNotMatch(html, />Home</);
    assert.doesNotMatch(html, /lucide-house/);
  });

  it("compass loop (TD-06.16): rings and star are separate groups, rings carry cardinal ticks", () => {
    const html = renderToStaticMarkup(createElement(BrandHomeButton, { onHome: () => {} }));
    // Rings group: the two circles plus four cardinal ticks (the
    // rotation needs something to show — two circles alone are symmetric).
    assert.match(html, /<g class="brand-home-rings">/);
    assert.match(html, /<line x1="24" y1="2\.5" x2="24" y2="5" stroke="#8A6D2F" stroke-width="1\.6">/);
    assert.match(html, /<line x1="43" y1="24" x2="45\.5" y2="24" stroke="#8A6D2F" stroke-width="1\.6">/);
    assert.match(html, /<line x1="24" y1="43" x2="24" y2="45\.5" stroke="#8A6D2F" stroke-width="1\.6">/);
    assert.match(html, /<line x1="2\.5" y1="24" x2="5" y2="24" stroke="#8A6D2F" stroke-width="1\.6">/);
    // Star group: the star path and centre circle, still by design.
    assert.match(html, /<g class="brand-home-star">/);
  });

  it("compass loop (TD-06.16): rings spin 24s linear, star glows ~4s, reduced motion kills both", () => {
    const css = readFileSync(join(repoRoot, "src/styles.css"), "utf8");
    assert.match(css, /\.brand-home-rings \{\s[^}]*animation: brand-ring-spin 24s linear infinite;/);
    assert.match(css, /\.brand-home-rings \{\s[^}]*transform-origin: 50% 50%;[^}]*transform-box: fill-box;/);
    assert.match(css, /@keyframes brand-ring-spin \{\s+to \{\s+transform: rotate\(360deg\);/);
    assert.match(css, /\.brand-home-star \{\s[^}]*animation: brand-star-glow 4s ease-in-out infinite;/);
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\) \{\s+\.brand-home-rings,\s+\.brand-home-star \{\s+animation: none;/,
    );
  });
});
