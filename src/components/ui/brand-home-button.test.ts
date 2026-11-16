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
import { BrandHomeButton, BRAND_HOME_LABEL } from "./home-button.ts";

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

  it("is not HomeButton: no House icon, no visible Home label text", () => {
    const html = renderToStaticMarkup(createElement(BrandHomeButton, { onHome: () => {} }));
    assert.doesNotMatch(html, />Home</);
    assert.doesNotMatch(html, /lucide-house/);
  });
});
