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

## Addendum 5 — card layout adjusted in the component system + mountain scene restored at <=1080px (owner corrections, Nov 19 2026)

- Owner correction 1: the addendum-4 margin nudge (12 -> 16 px in a staged copy) is not a layout adjustment. The cards are components in a shell and the layout must be adjusted in that context. Owner correction 2 (escalation): in mobile and tablet layout the mountain climbing animation asset is completely removed — it must be present on tablet + mobile.
- Component/shell findings [measured from main `cef9af3c` code]: the Expeditions Map card is NOT its own component — it is inline JSX in `src/components/game-app.tsx` (the `.hv5-card.hv5-mapcard` div, ~line 5189), living in `.hv5-rail`, the right column of the `.hv5-bento` grid (hero card 2.24fr + rail 0.92fr, gap 22px). The rail stacks the globe zone (aspect-ratio 1, margin-bottom -92px) over the card; the card carries `flex: 1`, so on desktop it stretches to the hero's height (measured 939 px at 1280) while its content is ~480 px — the removed world-map band (~150 px) plus the stretch is the space to rebalance. All Home cards share one system in `src/components/home-v5.css`: `.hv5-card` padding 26px 28px, radius 24px, flex column; stretched sibling cards pin their CTA to the foot (`.hv5-go { margin-top: auto }`). `.hv5-editions` is used by this card only. At <=1080px the bento stacks to one column and the card takes natural height.
- Mountain finding [measured]: the climbing scene is the hero's `.hv5-mtn-wrap` (painted art + trail overlay + trekker overlay, sliced to one box, 800/533). A shipped rule `@media (max-width: 1080px) { .hv5-mtn-wrap { display: none } }` in home-v5.css kills the whole scene at tablet and phone widths in prod today; this staging did not cause it.
- Design pass: three seats staffed from the owner's persona packs, files loaded verbatim — UI designer (`ui-designer.toml`), UX researcher (`ux-researcher.toml`), frontend developer (`frontend-developer.toml`); no seat vacant. Converged layout (2 seats for using the card's auto-margin idiom; the UX seat's centring won over foot-pinning, its dissent against pinning recorded): `.hv5-editions` centres in the freed height — `margin-top: auto; margin-bottom: auto; padding-top: 16px` (floor gap at natural height); gap 16px (12px at <=680px); `.hv5-edition` min-height 48 -> 64 px. The UI seat's grow-the-rows alternative and the frontend seat's foot-pin were both considered; centring splits the freed space so no single void pools, and the Challenge button stays foot-anchored like sibling CTAs.
- Staged mock (staging checkout only; production untouched): the converged card rules + the mountain restore — the <=1080px display:none rule removed, and at <=680px `.hv5-mtn-wrap { flex: 0 0 auto; margin: 20px -22px -32px; }` (bleed matched to the small-width hero padding; the frontend seat's correction, so the art's aspect ratio governs and the sliced overlays stay aligned).
- Measured on the staged page [tested]: card — 1280: height 939 px, copy-to-first-row gap 239 px (the centred block), 3 rows at 64 px, overflow 0; 768: height 470 px, gap 16 px; 390: gap 16 px, rows and Challenge button tight under the copy; card crops read by eye at 1280 and 390 — heading group at top, row block grouped mid-card, Challenge at the foot, no dead gap, no crowding. Mountain — display block at 768 (694 x 462) and 390, image loaded, overflow 0 at both; animation verified running at both widths (two frames of the wrap captured 1.8 s apart differ at 768 and at 390); the 390 frame read by eye shows the full scene — summit flag, dotted trail, trekker mid-climb — aligned on the art.
- Captures re-taken: `landmark-globe-in-prod-full-1280px.png`, `landmark-globe-in-prod-full-768px.png`, `landmark-globe-in-prod-full-390px.png`, `landmark-globe-in-prod-1280px.png`, `landmark-globe-in-prod-390px.png`.
- Contract: section 3.6 Stage 2 carry-over expanded to name both production changes exactly (card rebalance in game-app.tsx/home-v5.css classes; mountain restore recorded as a bug fix (owner ruling Nov 19 2026: the <=1080px hide rule is the defect; responsive design scales the asset)).

## Addendum 6 — desktop map card sizes to its content, like mobile (owner decision, Nov 19 2026)

- Owner decision (picked from presented options): "Make the desktop card size to its content, like mobile" + "Need a mock in full screen". Context [measured by Chitti first-hand]: the stretched desktop card (936 px) holding ~480 px of content left two ~230 px voids around addendum 5's centred rows; the natural-height tablet/phone card (~464–484 px) reads right and the owner approved that read. The owner also questioned whether the extra padding passes UI/UX/component design — the centring is now removed, not defended.
- Rail check [tested]: `.hv5-rail` holds exactly two children — `.hv5-globe-zone` and the map card. Nothing else lives in the rail and nothing depends on the card's stretch.
- Staged change (staging checkout only; production untouched): `.hv5-mapcard` flex 1 -> 0 0 auto (the card no longer grows to fill the rail; the rail still stretches to the hero's height). `.hv5-editions` auto-margin centring removed — standard step restored: margin-top 16px, gap 16px (12px at <=680px); `.hv5-edition` min-height 64px kept. Internal rhythm now matches the mobile card exactly, scaled.
- Measured on the staged page [tested]: 1280 — card height 492 px (was ~936–939 px stretched), copy-to-first-row gap 16 px, rows 64 px, space below the Challenge button 27 px (the 26 px card padding), 447 px of page background under the card in the rail column, hero keeps its own height, overflow 0; 768 — card 470 px, gap 16 px, void 27 px, overflow 0; 390 — card 484 px, gap 16 px, void 27 px, overflow 0. Zero injection errors at all widths; zero .hv5-worldmap elements. Desktop full page read by eye: globe overlaps the card top as designed, card ends at content height, rail space below shows plain page background, nothing stranded or overlapping.
- Captures re-taken (full screen, per the owner's words): `landmark-globe-in-prod-full-1280px.png`, `landmark-globe-in-prod-full-768px.png`, `landmark-globe-in-prod-full-390px.png`, plus the hero frame `landmark-globe-in-prod-1280px.png`. The 390 hero frame was NOT overwritten: its composition is unchanged (identical card metrics; the pixel diff against a fresh frame is the running globe/mountain animation only).
- Contract: section 3.6 Stage 2 item 1 rewritten — the card sizes to content at every width (`.hv5-mapcard` flex 0 0 auto), `.hv5-editions` standard 16 px step with no auto-margin centring (marked superseded by this ruling), `.hv5-edition` min-height 64 px, gap 16 px (12 px at <=680px).

## Addendum 7 — desktop top section composes as one shell (owner: "You need to fix desktop view", Nov 19 2026)

- Defect [measured]: at desktop the hero runs 1192 px tall (copy + restored mountain scene) while the rail's content (globe zone 345 + card 492 − 92 overlap = 745 px) ended mid-column, leaving 447 px of empty page background under the card beside the mountain. Tablet and phone compose fine. The addendum-6 "nothing stranded" eyeball call was wrong.
- Design pass (UI designer, UX researcher, frontend developer personas loaded verbatim; no seat vacant): the UI designer's recommendation carried — the rail's two components travel as one group anchored to the hero's foot, so the card's bottom edge shares the hero's baseline and the card sits beside the mountain painting. Dissent on record: the UX researcher held that only widening the rail (2.02fr / minmax(300px, 1.08fr)) shrinks the void rather than moving it — rejected because it shrinks the approved mountain scene, reflows the headline, and still leaves a residual void. The frontend developer's scoping (desktop-only, base rules untouched) was adopted as the implementation guard.
- Staged change (staging checkout only; production untouched): `@media (min-width: 1081px) { .home-v5 .hv5-rail { justify-content: flex-end; } }`. Nothing else.
- Measured on the staged page [tested]: 1280 — hero 1192, card top in rail 253 -> 700, space under the card in the rail 447 -> 0, card 492, copy-to-row gap 16, space below the Challenge button 27, mountain 559, overflow 0, zero injection errors. 1878 (owner's window) — hero 1212, card top 720, space under the card 0. Both full pages read by eye: card foot flush with the hero foot, globe overlaps the card top as before, the freed space sits above the globe beside the hero's copy block, the section reads as one composed unit.
- 768/390 untouched [tested]: card 470/484, card top in rail 228/208, gap 16, space below button 27, mountain 462/256 visible, overflow 0 — identical to the addendum-6 measurements; their full-page captures were NOT overwritten. Staging note: the hero's total height at 768/390 measures +12/+68 px against the addendum-6 captures' build in a fresh build of the staged source, WITH OR WITHOUT this addendum's rule (A/B verified by rebuilding both ways) — a stale-build artefact of the staging checkout, not an effect of the desktop change; every card/rail/mountain metric is unchanged.
- Captures overwritten: `landmark-globe-in-prod-full-1280px.png`, `landmark-globe-in-prod-1280px.png`. A 1878 px full-page capture was taken for the eyeball check (staging only, not committed).
- Contract: section 3.6 Stage 2 gains item 3 — the desktop composition rule stated as classes/values.

## Addendum 8 — desktop globe grows to fill the rail (owner: "make the globe bigger and fill the void", Nov 19 2026)

- Staged (staging checkout only; production untouched): inside the >=1081px block, .hv5-globe-zone { width: 792px; flex: 0 0 auto; align-self: flex-end; } — zone 345px → 792px, sized so zone + card 492px − the unchanged −92px overlap = the hero's 1192px at 1280px. The zone right-aligns to the rail's edge (centred, the disc would cross the page's right edge at 1280px). Addendum 7's foot anchor is kept as the guard for any remainder.
- Measured [tested]: at 1280px — zone 792×792px, disc ~205px → ~470px, ring ~290px → ~667px (render fractions of the square canvas), void above the zone 447px → 0px, space under the card 0px, card top in the rail 700px, overflow 0, zero injection errors. At 1878px — zone 792px, the anchor collects the remaining 20px above the zone, space under the card 0px, overflow 0. At 768/390px every metric identical to addendum 6/7 (zone 220/200px, card 470/484px, mountain 462/256px visible) — the stacked layouts did not move.
- Colosseum evidence: docs/motion-verify/landmark-globe-europe-cluster-1280px.png (zoomed crop of the cluster at the new size, rest pose). Read by eye: Big Ben, the Eiffel Tower, the Pyramids and the Burj read as themselves; the Colosseum still reads as a grey ring, not a building — its arch texture is not discernible at this size and angle. Nothing removed or restyled; the owner's call comes after he sees the crop.
- Captures overwritten: landmark-globe-in-prod-full-1280px.png, landmark-globe-in-prod-1280px.png; new: landmark-globe-europe-cluster-1280px.png. Contract section 3.6 Stage 2 item 4 carries the 792px zone into the production spec.

## Addendum 9 — Colosseum restyle + recognition test (council spec, owner-adopted Nov 19 2026)

- Model (docs/mockups/landmark-globe.html only; production untouched): scale 0.16 -> 0.25, colour stone -> sandstone, drawn-at (41.9, 13.5) -> (40.5, 15.0). Drum 0.34 -> 0.46 units tall in warm sandstone (strata-banded texture; the drawn texture arches are gone). Dark recessed arch insets as geometry: two rows of 16 arch shapes (#4a3421) around the drum. Stepped broken upper tier: arcs of 0.22 / 0.14 / 0.07. Inner wall 0.2 -> 0.3.
- Measured [tested]: landmarks 7,602 tris total (+592, all of it the Colosseum), largest single Sydney Opera House 1,872, 51 draw calls, 19,442 scene tris/frame — inside every budget (5k per landmark, 40k total, 60 calls). Zero page/console errors on the staged prod page and the mockup page (the mockup page logs one expected fonts-proxy tunnel failure, same as Stage 1; the globe renders regardless).
- Recognition test [tested]: test input = landmark-globe-in-prod-full-1280px.png (full page, natural size — owner rule Nov 19 2026: mocks are always full page; the cluster crop is supporting evidence only, labelled a zoom). Three clean-context readers who did not build the model, no hints beyond "name the landmarks you can see". All three named the Colosseum — A: "large round, open-topped amphitheatre with small arches around its wall"; B: "large round, open-topped cylindrical amphitheatre with small arched openings around its wall, centre-top of the globe"; C: "large open-topped circular amphitheatre drum with small arched openings around its wall". Controls: Eiffel Tower and Pyramids of Giza named by all three (Big Ben by all three, Burj Khalifa by two). PASS against the council bar (at least 2 of 3 for the in-lane proxy of "a 7-year-old names it at rest page size"); the owner's eye remains final.
- Process note: the first reader dispatch lost its brief (spawn items silently took precedence over the message text, so the readers got the image with no question and returned layout audits). That round was voided; the test was re-run with the brief embedded next to the image. Only the re-run results are recorded above.
- Captures overwritten: landmark-globe-europe-cluster-1280px.png (zoom on the restyled cluster, same framing slot), landmark-globe-in-prod-full-1280px.png, landmark-globe-in-prod-1280px.png, landmark-globe-mockup-1280px.png (1280x2984), landmark-globe-mockup-390px.png (622x3941 — dimensions match the previous capture).
- Contract: 3.4 (table row, build detail, measured line, recognition-test note) and 3.6 Stage 2 item 5 carry the restyle into the production spec.

## Next step

- Owner reviews the mockup and the captures. Stage 2 (production code in the Home hero) starts only on the owner's approval.

## Open questions

- None for Stage 1.

## Ruled out

- Post-processing and a bigger geometry budget were not needed: after the addendum-9 Colosseum restyle the scene sits at 51 draw calls and 7,602 landmark triangles against limits of 60 and 40,000.

## Addendum 10 — globe moved off Grandpa (owner ruling, Nov 19 2026)

- Done: staged in the mock only (production untouched). Owner's words: "move the globe since it is covering the mascot grandpa story teller." The desktop globe zone drops 180px: in the staging copy's home-v5.css, inside the @media (min-width: 1081px) block, the zone's bottom margin goes from the base -92px to -272px; the foot-anchored map card does not move, so the zone-to-card overlap grows by the same 180px. Globe size unchanged (792px zone, ~470px disc, ~667px ring).
- Measured [tested]: Grandpa's boxes at 1280 — avatar x780-836, y218-274; bubble x612-836, y282-436. Before: disc circle overlapped the bubble box by 149px (1878: 129px). After: at 1280 the disc clears the bubble by +30px and the avatar by +192px; the orbit ring's true projected curve clears the bubble by +119px (conservative bounding-circle test reads -68px; the ring is an ellipse and that circle overstates it); the halo clears the bubble by +13px. At 1878: disc +50px vs the bubble, ring curve +138px. Zone top 125 -> 305px (1878: 145 -> 325px).
- Rail fill after: content 1012px of hero 1192px at 1280; the freed 180px sits above the zone beside the hero copy as margin; space under the card 0px, card 492px content-height, foot flush with the hero's foot; overflow 0 at 1280 and 1878.
- 768/390 unaffected: the change is scoped to min-width: 1081px; re-measured at 390 (zone 200px, card 484px, overflow 0, bubble box 740px above the zone).
- Staging note: the injection harness logs one app-side page error (null innerHTML) when the production mount's children are cleared for the mockup swap; the globe mounts and renders correctly in every run. Artefact of the staging swap only — Stage 2 replaces the component properly.
- Captures: landmark-globe-in-prod-full-1280px.png + landmark-globe-in-prod-1280px.png overwritten (full page only). Contract §3.6 item 6 carries the position + the mascot clearance rule into Stage 2.
- Next step: owner's Stage 1 approval (including addenda 4-10) is the gate for Stage 2.
- Ruled out: shrinking the globe back toward the 345px zone (the owner asked for a move, not a shrink); re-stretching the map card to fill the freed space (addendum 6 stands); a rightward shift (the disc already ends at the page's right edge at 1280).

## Graph

- Add node: `docs/mockups/landmark-globe.html` (mockup, landmark globe) — documents the Home hero globe design.
- Add node: `docs/mockups/landmark-globe-contract.md` (contract) — depends-on the mockup.
- Edge: contract `documents` the Stage 2 production build (future).

## Panel cure — PR #542 Senior developer BLOCK (pinch 2 -> 1)

- Done: `home-globe.tsx` endDrag now dispatches `dragEnd` only when `pointers.size === 0`; on the 2 -> 1 transition it clears `lastMid`/`pinchStartDist`, refreshes `lastMoveT` (remaining pointer's stored position is the re-baseline, no jump) and keeps the drag alive. `setPointerCapture` in onDown wrapped in the same try/catch as `releasePointerCapture`. `globe-controls.ts` untouched.
- Regression test: `src/components/home-globe-pinch-release.test.ts` (source-pinning, the shell's existing level — no canvas harness in repo; see home-loading-orbs precedent). Fails on pre-cure source (no size guard/branch/try-catch), passes on cure.
- Gates: tsc clean; globe + home unit suites 33/33 pass; build:pages pass; e2e home-layout.desktop 13 passed / 1 failed in full run (768 grid row), lone re-runs inconsistent (fail, then baseline pass, then cure fresh-build pass in 11.8s) — timing flake, no delta from this change.
- Next: panel re-vote on the new tip. Open questions: none from this cure.

## Stage 2 — production build, panel, final leg (Nov 19 2026)

- Done: production build landed — bf376e17 (layout contract: worldmap SVG out, card content-height, mountain bug fix, globe token set, desktop 792px zone in the addendum-10 position, phone zone 260px), 903a27a7 (landmark globe component: home-globe.tsx + globe-contract / landmark-models / globe-controls modules; 7,602 landmark tris, 51 draw calls, identical to the approved mock), 803dc854 (first prod captures).
- Panel Wave 1 on 803dc854: 3 APPROVE / 7 APPROVE-WITH-NITS / 4 BLOCK on two defects. Pinch 2->1 cured at 6f462e72 (see the section above). Mount/paint BLOCK: the QA captures were shot before cold-load settle (opaque loading orb still covering the mount) — diagnosed by fresh-profile probe [measured: canvas mounted 6.0–10.8s, settled 7.5–15.1s at 1280/768/320, zero console errors].
- Final leg (owner-authorized +60k, Nov 19 18:18 CST): 8d18de9d added the permanent cold-load gate (tests/e2e/home-globe.desktop.spec.ts) + settle-waited captures. Re-vote #1: Senior developer, Frontend, UX researcher cleared; UX designer BLOCKED on a real defect the captures exposed — at 768 the disc was solid black (the render loop parks off-screen and the texture load never painted a frame, so a below-the-fold mount kept the black pre-texture frame). Cured at 58cbe5d5: one frame painted when the texture lands + one after any resize; the gate now samples disc-interior colours (byte size could not tell a textured disc from a black one). Re-vote #2: Frontend / UX designer / UX researcher all APPROVE on 58cbe5d5. Game Player (last, black-box, timed log + 15 screenshots in the panel evidence folder): APPROVE-WITH-NITS, all 8 play steps PASS (drag, wheel-zoom without page scroll, keyboard spin, Grandpa clear of the disc, touch-drag at 390, mountain animating at 390, map-card Country tap navigates).
- Panel verdict on final tip 58cbe5d5: READY-WITH-NITS. Gates on the tip: tsc PASS; unit 33/33; lint-cards GATE PASSED; lint:nav PASS; check:provenance PASSED; build:pages PASS; home-globe e2e 4/4 PASS (incl. texture-failure negative control); sabotage run (three chunk aborted) failed the positive test as required.
- Flake disclosures: home-layout.desktop 768 spot-cards row failed inconsistently across identical-code builds in the pinch leg (fail / baseline pass / fresh pass) — timing flake per AGENTS §9, no delta from these diffs. tests/e2e/home-layout.spec.ts does not exist in this worktree (only the desktop spec) — flagged in Wave 1, not run.
- Next step: merge on CI green (pinned --match-head-commit), delete the branch, live-verify the deployed build.
- Open questions (follow-ups, none blocking): Senior developer nit — the 3->2 pinch branch clears lastMid but does not re-baseline pinchStartDist/pinchStartTarget; UX researcher suggestion — track real-device globe settle time post-ship (timed disc fallback if p75 > ~3s on low-end Android); Game Player nits — the fresh-profile read-aloud sheet covers the globe centre until answered (the sheet's modality is the owner's open ruling, pre-existing), and the zoomed globe's focus box can clip hero copy mid-sentence.
- Ruled out: shrinking the settle window by preloading three in the initial bundle (breaks the perf contract: three stays out of the first-paint path by design); a timed fallback to the disc (no evidence of a real-device problem yet — measure first, per the UX researcher's suggestion).
- Graph: edge — landmark-globe-contract.md `documents` the Stage 2 production build (shipped, PR #542); add node for tests/e2e/home-globe.desktop.spec.ts as the cold-load gate if the integrator wants test nodes.
