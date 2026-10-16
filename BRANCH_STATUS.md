# BRANCH_STATUS — feat/homepage-premium-v5

**Status: LOCAL ONLY — not pushed, no PR (per Liz's hard limits for this run; supersedes the push-early convention here).** One job: port homepage mock v5 (premium cream/explorer redesign) into the repo's real homepage, wiring every control to the existing game handlers.

Base: `origin/main` @ `efe2fb3` ("docs: cite owner confirmation for #155 decisions (#157)"). NOTE: local `main` ref is stale (597 behind); this branch was cut from `origin/main` after a successful `git fetch origin`.

## What changed

- `src/components/game-app.tsx` — the `Choose` home screen re-skinned to mock v5: top nav (brand, EXPEDITIONS / CASES / ABOUT / JOURNAL / GET INVOLVED + JOIN THE JOURNEY), hero editorial card (real tagline copy + design headline), Three.js globe breaking the page edge, difficulty as v5 pills (real handler, hint, chirp, aria-pressed), GeoDetective + Cold Trail cards (real handlers, chips, streak, badges, locked state), dark Expeditions Map card hosting the three real edition actions, Review deck card (all deck states), Journal + For grown-ups cards, Grandpa Coffee Run + footer preserved. All `data-testid` hooks preserved.
- `src/components/home-globe.tsx` (new) — lazy Three.js globe: dynamic import on hero approach, DPR ≤ 1.5, no post-processing; reduced-motion / Save-Data / no-WebGL → static texture disc; pauses off-screen; full disposal on unmount.
- `src/components/home-v5.css` (new) — mock v5 styles scoped under `.home-v5`; display/body type roles use the repo's self-hosted Fraunces + Karla (not the mock's Google Fonts) to preserve the offline/PWA brand system.
- `src/assets/home-v5/` (new) — 7 WebP assets copied from the mock (globe texture, hero mountain, 2 card photos, 3 spot illustrations; ~3.9 MB total, unoptimized — flagged for a future optimization pass).
- `package.json` / `package-lock.json` — `three@0.160.0` + `@types/three@0.160.0`.
- `src/components/grandpa-coffee-run.tsx` — tour measurement selectors updated to the v5 structure (`main.atlas-home`→`main.home-v5` ×2, `.atlas-eyebrow`→`.hv5-pill`, `.atlas-title`→`[data-testid="home-heading"]`); without this the Coffee Run tour's `measureTour()` would have returned null on the new home.
- E2E spec hook updates (class-rename tracking only, no assertion changes): `tests/e2e/mobile-home-overlap.spec.ts` (`.atlas-dossier`→`tour-stop-geodetective` testid, `.atlas-card`→`.hv5-edition`, `.atlas-fieldnotes`→`tour-stop-review` testid, `main.atlas-home`→`main.home-v5` ×2), `tests/e2e/grandpa-tasting-tour.spec.ts` (`main.atlas-home`→`main.home-v5` ×6), `tests/e2e/kofi-persistent-cloud.mobile.spec.ts` (×1), `tests/e2e/storyteller-home.desktop.spec.ts` (`.atlas-eyebrow`→`.hv5-pill` ×1).

## UNMAPPED (design elements with no backend — rendered disabled, no invented behavior)

- Nav ABOUT and JOURNAL links; nav search button; Journal card "READ THE ENTRY" button.

## Gates

- `npx tsc --noEmit` — clean.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green; Three.js isolated in a lazy chunk (658,603 B raw) loaded only when the hero approaches; the home-globe chunk itself is 4,055 B.
- `npm test` — 778 scripts tests (769 pass / 0 fail) + 1315 src tests (1315 pass / 0 fail); identical counts on pristine base (zero unit regressions).
- Playwright (this VM): home batch (6 files) branch 110 pass / 17 fail vs the same specs failing on pristine main too — `mobile-home-overlap` fails 20/24 standalone on unmodified main in this environment, and a targeted baseline (storyteller/badges/motionmaxxing) went 22 pass / 1 fail (full attribution in the Scrum review report). Post-fix targeted run — storyteller-home.desktop + grandpa-tasting-tour + kofi-persistent-cloud.mobile: **36 pass / 0 fail**.
- Blackbox (custom script, report folder): 18/18 — v5 hero, live globe canvas, nav wiring + UNMAPPED disabled states, difficulty persistence, GeoDetective / Cold Trail / Country entries, grown-ups gate, WebGL-off + reduced-motion fallbacks, 390px no-overflow. Screenshots at 1440px + 390px visually inspected; three render defects found and fixed (case-card title/eyebrow clipping, journal + grown-ups illustration/text overlap).
