# Home Cards, Unified Map-Mode Pill, and Mobile Contact UX Design

**Date:** 2026-10-27
**Status:** Proposed for User Review

## 1. Problem Statement & UX Diagnosis

On the Meridian Home screen (`src/components/game-app.tsx`, `src/components/map-mode-toggle.tsx`, `src/components/home-v5.css`), four usability friction points affect discoverability and touch ergonomics—especially on small mobile viewports (`320×568` iPhone SE, `375×667` iPhone 8, `390×844` iPhone 14):

1. **Split Map-Mode Control in Hero (`Scout Map` vs. `Full map`):**
   - Currently rendered as a `44×44` circular `<Layers />` icon `<button data-testid="map-mode-button">` next to a separate, non-interactive `<span className="hv5-pill" data-testid="map-mode-indicator">Scout Map</span>`.
   - Users tapping the `"Scout Map"` / `"Full map"` text pill get no response because only the circular icon opens the popover.
2. **Partial Click Area on `"What the land remembers"` (`hv5-journal` card):**
   - Unlike the redesigned *GeoDetective*, *Cold Trail*, and *Review my misses* cards (which use Form S `.hv5-stretch` so the entire card is a single click target), `<button data-testid="journal-open">READ THE ENTRY</button>` only responds to taps on the bottom text link.
3. **Partial Click Area & Invisible Inline Links on `"For grown-ups"` (`hv5-involved` card):**
   - The card's primary CTA (`JOIN US →`, which opens the grown-up settings modal) only responds to taps on the brown button rather than the whole card.
   - Worse, Tailwind Preflight (`a { color: inherit; text-decoration: inherit; }`) strips all link styling from `<Link to="/privacy">privacy notice</Link>` and `<Link to="/contact">contact us</Link>` inside `.hv5-involved p`, rendering them as plain muted gray text (`#5e584b`, `~19px` tall) with zero visual affordance.
4. **Hard-to-Find `"Contact us"` on Small Mobile Viewports (`≤680px`):**
   - On `320px–390px` screens, `<header className="hv5-nav">` places the nav links in a horizontal scroll strip where the rightmost item (`GET INVOLVED`) is clipped by a right-edge fade mask, while `ABOUT` sits in the immediately visible center of the strip.
   - Adding a direct `CONTACT` link next to `ABOUT` in the top navbar (and routing `GET INVOLVED` to the `"For grown-ups"` card) makes reaching `/contact` and grown-up controls effortless on small phones without scrolling to the page footer.

---

## 2. Design Specification

### Unit 1: Single Unified `Scout Map` / `Full map` Pill Button (`src/components/map-mode-toggle.tsx`, `src/components/game-app.tsx`, `src/components/home-v5.css`)
- **Behavior:** On Home (`context="home"`), `MapModeToggle` renders a **single clickable pill `<button data-testid="map-mode-button">`** that combines the `<Layers size={16} aria-hidden="true" />` icon and the mode label `<span data-testid="map-mode-indicator" data-mode={mapMode}>{scout ? "Scout Map" : "Full map"}</span>`.
- **Visual & Touch Target:**
  - Styled as an interactive `.hv5-pill` button (`min-height: 44px`, `padding: 6px 14px`, `gap: 8px`, `border-radius: 999px`, `border: 1px solid var(--hv5-line-warm)`, brass hover border `var(--atlas-brass)`, cursor pointer).
  - Removes the duplicate sibling `<span className="hv5-pill">` in `src/components/game-app.tsx`.
  - Preserves `data-testid="map-mode-button"` on the `<button>` and `data-testid="map-mode-indicator"` (`data-mode={mapMode}`) on the inner label span so all existing accessibility announcements and E2E selectors pass without regression.
  - Play context (`context="play"`) keeps its existing `44×44` circular HUD icon button.

### Unit 2: Whole-Card Click on `"What the land remembers"` (`src/components/game-app.tsx`, `src/components/home-v5.css`)
- **Behavior:** Add `hv5-stretch` to `<button type="button" className="hv5-go hv5-stretch" data-testid="journal-open" onClick={() => scrollTo("home-journal")}>READ THE ENTRY →</button>`.
- **CSS Layering:** Apply the same `.hv5-spot` Form S rules used by `.hv5-review-due`:
  - `.home-v5 .hv5-journal .hv5-txt { position: static; }` so `.hv5-stretch::after` (`position: absolute; inset: 0; border-radius: 24px; z-index: 2`) stretches across the entire `.hv5-journal` card perimeter (including the tree illustration corner), with the two-tone inset `:focus-visible` ring around the whole card.
  - Add subtle card hover cursor (`cursor: pointer`) via the stretched button overlay.

### Unit 3: Whole-Card Click + High-Visibility Grown-Up Action Pills on `"For grown-ups"` (`src/components/game-app.tsx`, `src/components/home-v5.css`)
- **Whole-Card Primary Action:**
  - Add `id="home-grownups"` (`tabIndex={-1}`) to `<article className="hv5-card hv5-spot hv5-involved ...">`.
  - Add `hv5-stretch` to the `JOIN US` button (`<button type="button" className="hv5-btn hv5-btn-brown hv5-stretch" onClick={onGrownUpOpen}>`) and set `.home-v5 .hv5-involved .hv5-txt { position: static; }` + `.home-v5 .hv5-involved .hv5-stretch::after { z-index: 2; }` so tapping anywhere on the card body/heading/illustration opens the Grown-Ups modal (`onGrownUpOpen`).
- **High-Visibility `Privacy notice` & `Contact us` Links on Small Devices:**
  - Style inline/card links inside `.hv5-involved` (and `.hv5-card p a`) with unmistakable link affordance (`color: var(--hv5-brown-deep); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; position: relative; z-index: 3;`) AND render a dedicated row of two tactile, `>=44px`-tall secondary pill links (`Privacy Notice` -> `/privacy`, `Contact Us` -> `/contact`, `z-index: 3`) alongside `JOIN US →` so mobile users can both see and tap `Contact Us` or `Privacy Notice` cleanly without colliding with the card's `JOIN US` stretch layer.

### Unit 4: Top Navbar `CONTACT` Near `ABOUT` + Responsive Mobile Fit (`src/components/game-app.tsx`, `src/components/home-v5.css`)
- **Top Navbar Items:**
  - Add `<Link to="/contact" data-testid="nav-contact-link">CONTACT</Link>` right next to `ABOUT` in `<nav aria-label="Primary">` (`EXPEDITIONS ▾ · CASES ▾ · ABOUT · CONTACT · JOURNAL · GET INVOLVED`).
  - Update `.home-v5 .hv5-nav nav a` in `src/components/home-v5.css` to share the exact typography, `min-height: 44px` tap target, and hover styling of `.home-v5 .hv5-nav nav button`.
  - Update `GET INVOLVED` in the top nav to scroll to `#home-grownups` (the `"For grown-ups"` card, which lies directly above `#home-involved` Grandpa's Coffee strip) so tapping `GET INVOLVED` brings both the `"For grown-ups"` card and Grandpa's strip into view.
  - Tighten mobile nav spacing (`@media (max-width: 680px)` `gap: 12px`, `font-size: 10.5px`) so `EXPEDITIONS`, `CASES`, `ABOUT`, and `CONTACT` are all immediately visible without horizontal scrolling even on `320px–390px` phones.

---

## 3. Verification & Quality Gates

1. All 5 `AGENTS.md` gates (`tsc`, unit/worker tests, `lint-cards.mjs`, `build`/`build:pages`, and Playwright E2E including `scout-toggle.desktop.spec.ts`, `journal.spec.ts`, `mobile-home-overlap.spec.ts`, and `chunk-recovery.desktop.spec.ts`).
2. Multi-device live visual & blackbox browser verification across all 6 viewports (`320×568`, `375×667`, `390×844`, `768×1024`, `1024×768`, `1280×800`) proving:
   - Single unified `Scout Map` / `Full map` pill button (`>=44px` tall, clicking text label opens popover).
   - Clicking anywhere on `"What the land remembers"` (heading, body, or illustration) scrolls to `#home-journal`.
   - Clicking the `"For grown-ups"` card body/heading opens the grown-up gate, while clicking `Contact Us` or `Privacy Notice` navigates to `/contact` or `/privacy`.
   - `CONTACT` in the top navbar is visible next to `ABOUT` and navigates to `/contact` with `>=44px` tap target height and zero overlap across all 6 viewports.
