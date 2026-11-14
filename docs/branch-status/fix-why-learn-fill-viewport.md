# fix/why-learn-fill-viewport — branch status

**Task:** Why Learn picker fails UI/UX on tall screens (owner report, Nov 13, screenshot of live prod on a tall portrait window): the hero film, title and all six subject cards end at about half the screen height and the bottom half is empty backdrop; and the hero film is heavily cropped — "hard to see the video, most of it is heavily cropped." Rule: the design should scale up and down with the real estate available. Draft PR only — owner merges. Built on current main `4151f79f` (the one commit past the #463 merge is Board v2 #462; it touches no picker file, verified via the compare API).

**Diagnosis (the dead half):** ScreenShell's `<main>` is already a `min-h-dvh` flex column, but nothing in this screen could grow: the hero slot had a fixed aspect (16/7, 32/9 at ≥681px), the card grid's rows were content-height, and the `<ul>` had no flex growth. The column therefore rendered at natural height and the rest of the viewport sat empty inside the page. The broken regime is tall viewports (worst: tall portrait, 2-column width); short landscape already filled.

**Diagnosis (the crop):** the film is portrait 608×1280 (ratio 0.475). In the wide strip with `object-fit: cover`, the visible fraction of the frame is 0.475 / slot ratio — about 21% on phones (16/7) and 13% on wide screens (32/9): only a horizontal middle slice of every scene ever showed.

**Scope (why-learn screen only; ScreenShell untouched):**
- `src/styles.css`, Why Learn section:
  - The hero slot's aspect now lives on `.why-learn-hero-wrap` and steps up with viewport height: 16/7 base, 32/9 at ≥681px wide (both unchanged on short screens), then 1/1 and 4/5 on tall phones, 2/1 → 16/10 → 4/3 on wide screens as height allows (≥1100 / ≥1500 / ≥1900px). Nothing grows on short screens.
  - The film (and the reduced-motion poster still) renders in `.why-learn-hero-film`, a centred box of the film's own 608/1280 ratio at full slot height, `object-fit: contain` — the whole frame, never cropped, never distorted. Behind it, `.why-learn-hero-fill` shows the poster blurred (28px) and dimmed, so the space beside the portrait frame is atmosphere from the same scene, not bars. Controls moved inside the film box, so they still ride the film itself.
  - `.why-learn-screen > ul` gets `flex: 1 1 auto` + `grid-auto-rows: 1fr`: the grid takes the flex column's leftover height and rows share it equally; grid gap steps 1.25rem / 1.5rem at ≥1100px / ≥1800px viewport height.
- `src/subjects/shared/SubjectPicker.tsx`: card button `items-start` → `items-center`, so content centres vertically in a stretched card (identical at natural height). Nothing else changes — same cards, same order, same behaviour.
- `src/subjects/shared/WhyLearnHero.tsx`: both branches (film, and poster still under reduced-motion/failure) render wrap → fill → film box; film logic, controls, labels, testids unchanged.
- Untouched: subject data/logic, picker behaviour, the drift layer (backdrop texture), Journals semantics, accessibility order, every other screen.

**Geometry (derived from the CSS rules; assumptions: content width = min(viewport, 1152) − 40, home bar ≈ 60px, title band ≈ 115px, natural card ≈ 148px):**
- 1080×2160 (the screenshot's regime): before — hero 292px, content ended ≈ 1,011px ≈ 47% of the height; film visible ≈ 13% of the frame. After — hero 780px (4/3), grid rows ≈ 352px, content ends ≈ 2,128px ≈ 99%; film 100% visible, box 780×370 centred over the fill.
- 1440×900: before — content ended ≈ 96% (already near-full); film ≈ 13%. After — slot unchanged (height-gated growth starts at 1100px), grid absorbs the slack, ends ≈ 96–99%, no regression; film 100% visible, box 313×149 over the fill.
- 390×844 (phone): before — film ≈ 21% visible. After — slot 1/1, hero 350px, film 100% visible (box 350×166); the page scrolls exactly as it already did on phones.

**Status:** Built and verified locally on main `4151f79f`; targeted tests per the owner's lean strategy, CI carries the full suite.
- Unit: `src/subjects/shared/` targeted set 20/20 (15 existing + 5 new pins: grid flex/rows, card centring, slot aspect steps, contain + film box + fill, controls inside the film box). All pre-existing hero/drift/no-lyric pins pass unchanged.
- `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED; `npm run lint:content` GATE PASSED (6 baselined, 0 new); `npm run lint:nav` clean.
- Vite production build green (run directly); entry JS gzip 320,906 B vs 323,865 B limit. Built CSS verified to carry the new rules.
- `npm run build:pages` as one command: NOT RUN to green in this environment — its prebuild stops at the detective-audio gate because this workspace mirror lacks `public/audio/detective/manifest.json` (the mirror fetch was rate-limited in an earlier run; 1,224 of 4,519 audio files). Same disclosure as #463; CI's full checkout runs the whole chain.
- Playwright: NOT RUN locally — attempted; all 9 tests in the file (including the new tall-screen case) fail at browser launch ("Target page, context or browser has been closed", the environment's WebGL domain policy); pre-existing specs fail identically. No local screenshots are possible in this environment — the visual check is CI's run plus owner review, same as previous PRs. The spec gains a tall-viewport test (1080×2160): last card ends ≥90% of viewport height, cards grown past 200px, film `object-fit: contain` with the box at the frame's own ratio.

**Still open:**
- Owner decisions the PR surfaces: on short landscape screens the whole portrait frame now shows smaller (313×149 at 1440×900) over the blurred fill instead of a large cropped slice — the brief's chosen trade (whole frame over big slice). A landscape re-cut of the film remains the alternative if the owner prefers the strip filled edge-to-edge there.
- Next step: owner review; CI runs the full suite + this spec.

## Graph
- Adds node: Why Learn viewport-fill layout (styles.css Why Learn section + SubjectPicker card alignment + WhyLearnHero film box) — documents the owner's 2026-11-13 real-estate rule; depends-on the Why Learn montage hero node (PR #463); governs the picker at tall viewports.
- Amends node: Why Learn montage hero — presentation changed from cover-cropped strip to whole-frame contain over blurred fill; the #463 branch-status disclosure "portrait crop vs a landscape re-cut" is answered by this branch for the crop half.
