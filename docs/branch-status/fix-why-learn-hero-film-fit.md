# fix/why-learn-hero-film-fit — branch status

**Task:** Fix the live Why Learn hero film framing. Radhae's photo of the live picker (2026-11-14): "The montage video looks like overly cropped and over zoomed in… that video needs to play in full size of what we recorded." The portrait film (608×1280) was centre-cropped by the hero slot's `object-fit: cover` into the wide strip — at desktop sizes only ~13% of each frame was on screen. Draft PR only — the owner (Veeresh) merges. Built on current main `bddef249`.

**Scope (hero only):**
- `src/styles.css`: `.why-learn-hero` fit `cover` → `contain`, so the whole recorded frame maps inside the hero box at every step of the existing aspect ladder. New `.why-learn-hero-backdrop` rule: a copy of the poster stretched over the box behind the film, blurred (24 px) and dimmed, filling the bands `contain` leaves — the standard treatment for a portrait film in a wide slot. The aspect ladder itself is unchanged, so the #467 fill behaviour and the world band's height sync are untouched; the ladder's tall-viewport steps (2/1, 16/10) grow the contained frame where the viewport gives height.
- `src/subjects/shared/WhyLearnHero.tsx`: both branches (film, and the poster still under reduced motion / load failure) render the backdrop image (aria-hidden, decorative) behind the frame inside `.why-learn-hero-wrap`. Nothing else changes: the 2.8–8.6 s play window, poster, controls (pause/play, replay, sound), aria treatment and testids are as shipped.
- `src/assets/why-learn/why-learn-art.ts`: the provenance note that prescribed the cover centre-crop is corrected to record the contain fit and the owner's words.
- `src/subjects/shared/why-learn-hero.test.ts`: one new source pin — the hero rule must be `contain` and never `cover`, the fill rule exists (cover + blur), and both component branches render the fill.
- The art-off palettes (high-contrast / prefers-contrast / forced-colors) already hide `.why-learn-hero-wrap` wholesale, so the fill disappears with the rest of the hero art — no palette change needed.

**Status:** Built and verified locally on main `bddef249` (all four touched source files verified byte-identical between the working tree and that HEAD before editing).
- Unit: `why-learn-hero.test.ts` 13/13 (incl. the new fit pin), `living-atlas.test.ts` 13/13.
- `npx tsc --noEmit` clean. `npm run lint:nav` clean. `npm run lint:content` GATE PASSED (6 baselined, 0 new).
- Vite production build green (run directly, as in the #463/#467/#481 runs).
- Framing proof (no live playback claimed — this environment's headless Chrome cannot decode H.264): a real film frame (ffmpeg, t = 6.8 s) placed in an element carrying the hero's exact box and CSS inside the shell's real geometry, measured in-page. Before (cover): 47.5% of the frame visible at 390 px, 13.4% at 1280 px. After (contain): 100% at both — content rect 166.3×350 centred in the 350×350 box at 390 px; 148.6×312.8 centred in the 1112×312.8 box at 1280 px, growing to 264×556 at ≥1100 px viewport height on the ladder's existing steps. Proof sheet and measurements: `~/workspace/meridian-work/hero-fit-proof/` (outside the repo).
- Playwright E2E: NOT RUN here (this environment's browser cannot launch — WebGL domain policy); the Why Learn specs' hero selectors (`video.why-learn-hero`, `img.why-learn-hero`, the three control testids) are unaffected — the fill carries its own class and the still keeps its class. CI carries the suite.

**Still open:**
- Owner merges. A landscape re-cut of the film would retire the fill entirely; until then nothing of the frame is cropped.
- Nothing else is owed.

## Graph
- No new nodes. The decision "the hero film plays in full size of what we recorded — whole frame visible, no crop" (Radhae, 2026-11-14) attaches to the existing Why Learn hero node; the integrator may add it at merge.
