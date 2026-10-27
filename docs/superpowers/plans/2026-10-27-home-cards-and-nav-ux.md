# Home Cards & Top Navbar UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish four Home screen UX affordances in Meridian so that (1) the Home map-mode indicator and icon are unified into a single clickable `Scout Map` / `Full map` pill button (`>=44x44`), (2) the `"What the land remembers"` journal teaser card is clickable across the entire card surface, (3) the `"For grown-ups"` card is clickable across the entire card surface while elevating `privacy notice` and `contact us` as high-visibility independent links on small and large devices, and (4) the top navigation bar includes a `CONTACT` link right after `ABOUT` and scrolls `GET INVOLVED` to the `"For grown-ups"` spotlight card.

**Architecture:** All changes are confined to the existing Home V5 UI components (`src/components/map-mode-toggle.tsx`, `src/components/game-app.tsx`, and `src/components/home-v5.css`) plus Playwright E2E regression tests (`tests/e2e/grownups-privacy-contact.desktop.spec.ts`). Card-wide clickability uses the existing `.hv5-stretch::after` overlay pattern already proven on edition rows, while nested `<Link>` elements in `.hv5-involved` sit above the overlay at `z-index: 3` with high-contrast styling.

**Tech Stack:** React 19, TypeScript, React Router (`<Link>`), Lucide React (`Layers`), CSS (`home-v5.css`), Playwright E2E.

**Global Constraints:**
- Maintain `>=44x44` CSS px tap targets on interactive buttons and nav items (`header.hv5-nav button, header.hv5-nav a` and `data-testid="map-mode-button"`).
- Preserve `data-testid="map-mode-button"`, `data-testid="map-mode-indicator"` (`data-mode={mapMode}`), `data-testid="map-mode-popover"`, `data-testid="map-mode-switch"`, and `aria-label="Map mode settings — currently Scout Map"` / `"Map mode settings — currently Full map"` on Home (`"Map mode settings"` in Play).
- Zero overlapping bounding boxes across all 6 device viewports (`320x568`, `375x667`, `390x844`, `768x1024`, `1024x768`, `1280x800`).

---

### Task 1: Unify Home `Scout Map` / `Full map` into a Single Interactive Pill Button

**Files:**
- Modify: `src/components/map-mode-toggle.tsx`
- Modify: `src/components/game-app.tsx`
- Modify: `src/components/home-v5.css`

- [ ] **Step 1: Update `MapModeToggle` (`src/components/map-mode-toggle.tsx`) to render a unified pill button when `context="home"`**
  - When `atHome` is true, apply `className="hv5-pill hv5-map-mode-pill"` to `<button data-testid="map-mode-button">` and render both `<Layers aria-hidden="true" size={16} />` and `<span data-testid="map-mode-indicator" data-mode={props.mapMode}>{scout ? "Scout Map" : "Full map"}</span>` inside the button.
  - Keep `aria-label={atHome ? `Map mode settings — currently ${scout ? "Scout Map" : "Full map"}` : "Map mode settings"}` unchanged.
  - When `context="play"`, preserve the `h-11 w-11` circular icon button unchanged.

- [ ] **Step 2: Remove duplicate sibling `<span className="hv5-pill" data-testid="map-mode-indicator">` in `src/components/game-app.tsx`**
  - In `mapModeControl` (`src/components/game-app.tsx`), render `<MapModeToggle context="home" mapMode={mapMode} onSelect={handleHomeMapMode} />` directly without the static sibling `<span>`.

- [ ] **Step 3: Add `.home-v5 .hv5-pill.hv5-map-mode-pill` styling in `src/components/home-v5.css`**
  - Ensure `min-height: 44px; min-width: 44px; cursor: pointer;` with brass hover/focus-visible feedback.

---

### Task 2: Make `"What the land remembers"` Journal Teaser Card Whole-Card Clickable

**Files:**
- Modify: `src/components/game-app.tsx`
- Modify: `src/components/home-v5.css`

- [ ] **Step 1: Add `hv5-stretch` to `data-testid="journal-open"` in `src/components/game-app.tsx`**
  - Change `className="hv5-go"` to `className="hv5-go hv5-stretch"` on the `READ THE ENTRY` button inside `[data-testid="journal-card"]`.

- [ ] **Step 2: Enable card-wide `.hv5-stretch::after` overlay in `src/components/home-v5.css`**
  - Set `.home-v5 .hv5-journal .hv5-txt { position: static; }` and `.home-v5 .hv5-journal .hv5-stretch::after { z-index: 2; cursor: pointer; }` so `.hv5-stretch::after` covers the entire `.hv5-journal` card (including heading, body copy, `"Now showing"`, and the tree illustration).

---

### Task 3: Make `"For grown-ups"` Card Whole-Card Clickable + Elevate `privacy notice` & `contact us` Links

**Files:**
- Modify: `src/components/game-app.tsx`
- Modify: `src/components/home-v5.css`

- [ ] **Step 1: Add card attributes and `hv5-stretch` to `"For grown-ups"` in `src/components/game-app.tsx`**
  - Add `id="home-grownups" tabIndex={-1} data-testid="grownups-card"` to `<article className="hv5-card hv5-spot hv5-involved home-rise" ...>`.
  - Add `hv5-stretch` and `data-testid="grownups-card-open"` to the `JOIN US` button (`className="hv5-btn hv5-btn-brown hv5-stretch"`).

- [ ] **Step 2: Style `.hv5-involved` overlay and high-visibility inline links in `src/components/home-v5.css`**
  - Set `.home-v5 .hv5-involved .hv5-txt { position: static; }` and `.home-v5 .hv5-involved .hv5-stretch::after { z-index: 2; cursor: pointer; }`.
  - Style `.home-v5 .hv5-involved p a` with `position: relative; z-index: 3; display: inline-block; color: var(--hv5-brown-deep); font-weight: 700; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; padding: 2px 6px; margin: 0 -2px; border-radius: 6px; background: rgba(139, 90, 43, 0.12);` and hover/focus states so `privacy notice` and `contact us` stand out unmistakably on mobile and desktop and navigate directly to `/privacy` and `/contact` without triggering `onGrownUpOpen`.

---

### Task 4: Add Top Navbar `CONTACT` Link After `ABOUT` & Point `GET INVOLVED` at `#home-grownups`

**Files:**
- Modify: `src/components/game-app.tsx`
- Modify: `src/components/home-v5.css`
- Modify: `tests/e2e/grownups-privacy-contact.desktop.spec.ts`

- [ ] **Step 1: Add `<Link to="/contact" data-testid="nav-contact-link">CONTACT</Link>` in `src/components/game-app.tsx`**
  - Place `<Link to="/contact" data-testid="nav-contact-link">CONTACT</Link>` immediately after the `ABOUT` button in `<header className="hv5-nav"><nav aria-label="Primary">`.
  - Update the `GET INVOLVED` nav button `onClick` to `scrollTo("home-grownups")`.

- [ ] **Step 2: Extend `.home-v5 .hv5-nav nav button` CSS rules to `.home-v5 .hv5-nav nav a` in `src/components/home-v5.css`**
  - Include `.home-v5 .hv5-nav nav a` in the base, `:hover`, `@media (max-width: 1080px)`, and `@media (max-width: 680px)` rules with `display: inline-flex; align-items: center; justify-content: center; text-decoration: none; min-height: 44px;`.

- [ ] **Step 3: Add E2E assertions and run all quality gates + 6-device verification**
  - Run `npx tsc --noEmit && npm run typecheck:worker`
  - Run `npm test && npm run test:worker`
  - Run `node scripts/lint-cards.mjs`
  - Run `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build && VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages`
  - Run Playwright E2E specs (`scout-toggle.desktop.spec.ts`, `scout-capability-offer.desktop.spec.ts`, `scout-harness-suppression.desktop.spec.ts`, `journal.spec.ts`, `mobile-home-overlap.spec.ts`, `chunk-recovery.desktop.spec.ts`, `home-visual-layout.desktop.spec.ts`, `grownups-privacy-contact.desktop.spec.ts`) and 6-device visual/blackbox verification (`320x568`, `375x667`, `390x844`, `768x1024`, `1024x768`, `1280x800`).
