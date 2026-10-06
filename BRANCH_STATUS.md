# BRANCH_STATUS.md — feat/home-redesign

**Branch:** `feat/home-redesign` (off `feat/geodetective-unlimited` @ `d6177ad`, which carries PR #71's unlimited GeoDetective)
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
1. `npm test` full unit suite
2. `npm run build:pages` production build
3. Playwright E2E via VM lock (existing home/picker specs: edition-drilldown, difficulty-picker, geodetective, tutorial, pwa)
4. Screenshots: desktop 1280px + mobile 360px, honest visual QA notes
5. Open PR (base: main) — do NOT merge
6. AFTER PR #71 merges to main: `git rebase --onto origin/main feat/geodetective-unlimited feat/home-redesign`
