# BRANCH_STATUS.md — feat/home-redesign

**Branch:** `feat/home-redesign` (rebased onto `origin/main` @ `26acb2b` — PR #71 merged 2026-10-06 ~09:03 CDT; rebase was conflict-free, source files byte-identical pre/post rebase)
**Task:** Redesign Meridian's home/edition picker with a distinctive "chart-room" identity. Home screen ONLY — gameplay screens untouched.
**Status:** 🟡 IN PROGRESS

## Design: "The Chart Room"
- **Type:** Fraunces (display, engraved-atlas serif) + Karla (body) + Space Mono (dossier labels). Google Fonts with display=swap + system fallbacks; offline build unaffected.
- **Theme:** deep sea-chart ink + brass (dark) / expedition journal paper (light). Brass is the single sharp accent; signal red reserved for the GeoDetective "OPEN" stamp.
- **Background:** full-viewport fixed layer — brass graticule, topographic contour SVG, vignette. No flat colors.
- **Motion:** one orchestrated staggered entrance (110ms steps); card hover lift; stamp slam-in; `prefers-reduced-motion` fallbacks.
- **Layout:** GeoDetective leads as a featured case-file dossier (keeps PR #71 unlimited copy: "🔎 Solve a mystery"/"▶️ Resume your case" + streak line); State/Country/Globe become numbered expeditions (01/02/03) with line icons; review deck becomes a dashed field-notes strip.
- **Frozen:** all button accessible names, headings, difficulty group semantics, routing — E2E-safe.

## What's done
- [x] Atlas tokens in `src/styles.css` (dark + light + paper + night) + home component CSS
- [x] `Choose`/`EditionCard` rewrite in `src/components/game-app.tsx` (native buttons, min 44–48px targets)
- [x] Font links in `src/routes/__root.tsx`
- [x] `npx tsc --noEmit` clean

## What's pending
1. `npm test` full unit suite — DONE (716/716, re-verified after font change)
2. `npm run build:pages` production build — DONE (green, fonts bundled to dist)
3. Playwright E2E via VM lock — DONE: drilldown/pwa/tutorial/geodetective/difficulty-picker all green.
   - Caught 2 real issues: (a) Google Fonts CDN failed through the VM proxy (ERR_TUNNEL_CONNECTION_FAILED) → fonts now SELF-HOSTED (7 latin woff2 in src/assets/fonts, @font-face in styles.css, zero runtime CDN dependency); (b) dossier was a `<section>`, spec filters `article` → dossier is now `<article>`. One flake (Easy-tier pin timing) passed on rerun.
4. Screenshots: desktop 1280px + mobile 360px — PENDING
5. Open PR (base: main) — do NOT merge — PENDING
6. AFTER PR #71 merges to main: rebase — DONE 2026-10-06 ~09:05 CDT (conflict-free; PR #71 merged as 26acb2b)
