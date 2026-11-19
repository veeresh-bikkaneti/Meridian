# Branch status — feat/landmark-globe

## Done (Stage 1, mockup only)

- Saved the shared landmark globe mockup at `docs/mockups/landmark-globe.html` as its own commit, then upgraded it in place.
- All 12 landmarks rebuilt with recognisable detail: geometries grouped by material, transforms baked in, merged to one mesh per material per landmark.
- Smooth shading on (flat shading off), PAL palette only, gilded accents on the Big Ben belfry and the Liberty flame, four lit clock faces.
- Halo softened. Rise-in added: landmarks ease into place over 0.8 s on first load, skipped under reduced motion.
- Live readout added in a fixed corner outside the hero: renderer triangles and draw calls for the desktop globe, landmark triangle total and largest landmark, refreshed twice a second.
- Contract written at `docs/mockups/landmark-globe-contract.md` from the final constants.
- No production code changed. Stage 2 is not started.

## Gate results (Playwright, Chromium, SwiftShader)

Verification ran against a copy of the page staged in /tmp with the two three.js module URLs rewritten to locally downloaded copies, because this machine's Chromium cannot reach cdn.jsdelivr.net (proxy tunnel fails). The repo file keeps the CDN URLs. The Google Fonts stylesheet was also stripped from the staged copy only, for the same reason.

| Gate | Result |
| --- | --- |
| Page loads with zero console errors | PASS (an early run caught a /favicon.ico 404; fixed in the mockup with a data-URI icon in the head) |
| Drag changes canvas pixels | PASS (24.3% of canvas pixels changed) |
| Wheel over the globe zooms | PASS (73.2% changed) |
| Pinch (CDP two touch points moving apart) zooms | PASS (99.8% changed) |
| Slow turn resumed after drag + 4.6 s idle | PASS (53.2% differ between shots 500 ms apart) |
| Pause button stops the turn | PASS at the time (0% differ, limit 0.5%) — superseded by Addendum 2: the button is removed |
| Landmark triangles within budget | PASS: 7,010 total (limit 40,000) |
| Largest single landmark | PASS: Sydney Opera House 1,872 (limit 5,000) |
| Scene draw calls | PASS: 50 (limit 60) |
| Whole-scene triangles (desktop globe, per frame) | 18,850 |

Captures: `docs/motion-verify/landmark-globe-mockup-1280px.png` (1280 x 900, full page) and `docs/motion-verify/landmark-globe-mockup-390px.png` (390 x 844, full page), taken after load plus rise-in, with a scroll pass first so both globes had rendered. No interaction clip: skipped to stay inside the Stage 1 token budget.

## Changed values (Stage 1 vs the mockup as shared)

- Halo strength 0.85 → 0.5.
- Landmark materials: flatShading on → off (smooth shading). This is a deliberate Stage 1 change from Appendix A.
- Big Ben clock faces: plain card discs → lit faces (emissive #d9b25a at 0.4) with hands on all four sides.
- Liberty flame: brass emissive #5a3d0a → brass with emissive #cc7722 at 0.7, flame shape.
- Colosseum arch texture: 512 x 128 canvas, 24 arches per row → 1024 x 256, 36 arches per row.
- Added: importmap for three and three/addons, merged-geometry landmark builders, rise-in animation, live stats readout, data-URI favicon.
- One line removed from the shared mockup: the `viewport-fit-sides` viewer meta tag, because the repo provenance check rejects AI tool names in added lines. The page keeps its standard viewport meta.
- Every motion and input value, the landmark list and coordinates, both page sections and the contract section are unchanged. The on-page contract table's light and halo rows now read the real constant values.

## Addendum 2 — pause button removed (owner ruling, Nov 19 2026)

- Owner ruling on the 390 px in-prod capture: "playbutton shouldnt be displayed on any card", "since its autolooping". The pause/play button is removed from the design. This overrides the original brief's pause-button row (3.5), the `.hv5-globe-pause` layout rules (3.6), the paused state in the statechart (section 4), the Stage 2 e2e pause test (section 7) and the pause checklist item (section 9).
- Mockup: button element, its creation and wiring in `createGlobe`, the `paused` flag's UI effects and the `.hv5-globe-pause` CSS are all removed. The slow turn, inertia, resume after 3 s, upright drift, plane and reduced-motion behaviour are unchanged; the loop still stops under reduced motion, and the production static-disc fallback is untouched. The on-page contract table no longer has a Pause row.
- Contract: pause entries removed; the removal and the superseded brief items are recorded in section 3.5.
- Gates re-run (Playwright, Chromium): zero console errors PASS; zero `.hv5-globe-pause` elements on the page PASS; drag PASS; wheel zoom PASS; pinch (CDP) PASS; slow turn resumed after drag + 4.6 s idle PASS. The pause gate is gone with the button.
- All four captures re-taken with no button: `landmark-globe-mockup-1280px.png`, `landmark-globe-mockup-390px.png`, `landmark-globe-in-prod-1280px.png`, `landmark-globe-in-prod-390px.png`. In-prod fit re-measured on the same staged build (main `cef9af3c`): mount boxes identical before and after the swap, horizontal overflow 0, map-card overlap unchanged (92 px desktop, none on phone), no injection errors. The 390 px in-prod capture was read by eye: no button beside the globe.

## Addendum 3 — the grey ring is the Colosseum; full-page prod captures (Nov 19 2026)

- Owner, on the in-prod captures: "i see a play/pause button on globe. if you can remove that" and "can you show full screen". Owner hold: remove nothing until he has seen the proof and the full pages.
- Ring identity, proven on the staged prod page (main `cef9af3c`, mockup globe injected, pose frozen in the staging copy only): a raycast through the ring's centre hits the Colosseum holder's own geometry first (its merged model, then its contact disc), with the globe sphere behind; the element at that pixel is the canvas, not a DOM control; after a 140 px drag the ring moved with the surface (holder projection 1031,240 → 983,255) and re-foreshortened like a surface object. The ring is the Colosseum model — its open elliptical wall reads as a thick grey ring at globe size. Nothing was removed or changed; whether it is removed or restyled is the owner's call.
- Full-page captures of the staged prod page with the new globe, first-visit overlays dismissed (tour card via its seen flag, read-aloud sheet via its stored "never" pref, Scout toast): `landmark-globe-in-prod-full-1280px.png` (1280 x 3474), `landmark-globe-in-prod-full-768px.png` (768 x 3674), `landmark-globe-in-prod-full-390px.png` (390 x 5992). No injection errors.
- Observation from the 390 px full page: the phone hero card does not show the mountain illustration that the desktop hero carries; the globe, Expeditions Map card and the sections below all render. Pre-existing prod behaviour, not changed here.

## Addendum 4 — worldmap removed from the map card in the mocks (owner ruling, Nov 19 2026)

- Owner ruling on his annotated desktop screenshot: with the full landmark globe coming, the dotted world-map SVG (`hv5-worldmap`) inside the Expeditions Map card is "just redundant and bloat". Removed from the mocks only; the Colosseum and every other element are untouched (the owner's hold stands for them).
- Source check: the SVG renders in exactly one place — `src/components/game-app.tsx` (line 5201 on main `cef9af3c`), inside the `.hv5-mapcard` card between the copy and the edition rows, styled by `.home-v5 .hv5-worldmap` in `src/components/home-v5.css`. It renders nowhere else.
- Staged mock: the staging checkout (main `cef9af3c`) was rebuilt with the SVG and its CSS rule removed and `.hv5-editions` margin-top set to 16 px, then the landmark globe was staged into the hero as before. Measured on the staged page at 1280 / 768 / 390: zero `.hv5-worldmap` elements, copy-to-first-row gap 16 px, badge, label, heading, copy and all three rows intact, horizontal overflow 0, zero injection errors. Card crops read by eye at all three widths: rows sit directly under the copy, no dead gap.
- Captures re-taken: `landmark-globe-in-prod-full-1280px.png` (1280 x 3642), `landmark-globe-in-prod-full-768px.png` (768 x 3520), `landmark-globe-in-prod-full-390px.png` (390 x 5941), plus the hero-framed `landmark-globe-in-prod-1280px.png` and `landmark-globe-in-prod-390px.png`.
- Contract: section 3.6 now carries the Stage 2 carry-over — production removes the `hv5-worldmap` SVG from the Expeditions Map card and tightens the card layout to match this approved mock. No production code changed in this addendum.

## Next step

- Owner reviews the mockup and the captures. Stage 2 (production code in the Home hero) starts only on the owner's approval.

## Open questions

- None for Stage 1.

## Ruled out

- Post-processing and a bigger geometry budget were not needed: the scene sits at 50 draw calls and 7,010 landmark triangles against limits of 60 and 40,000.

## Graph

- Add node: `docs/mockups/landmark-globe.html` (mockup, landmark globe) — documents the Home hero globe design.
- Add node: `docs/mockups/landmark-globe-contract.md` (contract) — depends-on the mockup.
- Edge: contract `documents` the Stage 2 production build (future).
