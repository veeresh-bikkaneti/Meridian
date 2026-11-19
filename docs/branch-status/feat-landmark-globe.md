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
| Pause button stops the turn | PASS (0% differ, limit 0.5%) |
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
