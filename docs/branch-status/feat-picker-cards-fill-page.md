# feat/picker-cards-fill-page — branch status

**Task:** One layout fix on the "Why Do We Learn This?" subject picker, inside the design that shipped in #463 — no new look, no new components, no behaviour change. Two problems from the owner's prod review (2026-11-13): (1) on tall screens the picker content ended at about half the viewport height and the rest of the page sat empty; (2) the portrait montage film (608×1280) is centre-cropped by the hero slot's wide strip, so only a middle slice of each frame shows. Draft PR only — owner merges. Built on current main `4151f79f` (Board v2 #462 landed after the montage; it touched board files only, not this screen).

**Scope:** `src/styles.css` only — two rule blocks in the Why Learn section.
- The subject card grid (`.why-learn-screen > ul`) now takes the ScreenShell column's leftover height (`flex: 1 1 auto`) and its rows share that height equally (`grid-auto-rows: 1fr`). Each card already stretches to its row (the `li` is a grid item, the button fills it), so on tall screens the six cards grow until the grid reaches the bottom of the page. On short screens there is no leftover height and the layout is exactly as before.
- The hero box (`.why-learn-hero`, `object-fit: cover` unchanged) steps taller as the viewport gives height: phones 1:1 from 700px viewport height and 4:5 from 1000px; wide screens 2:1 from 1100px and 16:10 from 1500px. Short screens and ordinary desktops keep today's strip (16:7 / 32:9). The taller box is what reduces the crop: about a fifth of each film frame is visible in today's phone strip; about half shows at 1:1 and three-fifths at 4:5. Cover fit stays — no letterbox, no backdrop treatment.

**Status:** Built and verified locally on main `4151f79f`; targeted tests per the owner's lean strategy, CI carries the full suite.
- Unit: 25/25 across the touched area (`why-learn-hero.test.ts`, `picker-rows.test.ts`, `registry.test.ts`) — no test pinned the old layout, none needed changes.
- `npm run lint:content` GATE PASSED (6 baselined, 0 new); `node scripts/lint-cards.mjs` GATE PASSED.
- `npx tsc --noEmit` clean.
- Vite production build green (run directly, as in the #463 run); the built CSS carries both rule blocks; entry JS gzip 320,930 B vs the 323,865 B limit (CSS-only change; the JS is untouched).
- `npm run build:pages` as a single command: NOT RUN to green in this environment — its prebuild chain includes the detective-audio gate and this workspace mirror holds 1,224 of 4,519 `public/audio` files (the same mirror limit disclosed in #463). The full repo in CI has every file. Not a code failure.
- E2E spec `tests/e2e/why-learn-page.desktop.spec.ts` reviewed and left unchanged: it asserts testids, classes and film behaviour, nothing about card heights or the hero ratio, so this change breaks none of its assertions. NOT run here: this environment's browser refuses to launch ("Hatch WebGL domain policy is required for browser startup"); pre-existing specs fail identically — environment limit, not a regression. CI runs it.

**Still open:**
- Owner merges. No owner decision is needed: this is the shipped design, sized to the screen.

## Graph
- No nodes or edges added or changed: a sizing behaviour on the existing Why Learn picker screen; nothing new exists for an agent to look up.
