# Landmark globe — design and motion contract

Values are the final constants in `docs/mockups/landmark-globe.html` after the Stage 1 premium upgrade. Rows that differ from the original mockup (Appendix A) are marked "changed in Stage 1".

## 3.1 Scene

| Setting | Value |
| --- | --- |
| Globe texture | `src/assets/home-v5/globe-texture.webp` (1600 x 800, equirectangular), unchanged |
| Globe radius | 1 |
| Sphere segments | full 64 x 48; small 32 x 24 |
| Small globe below | 280 px mount width |
| DPR cap | 1.5 |
| Camera | fov 34, start distance 5.6 |
| Axial tilt | 23.44 degrees |
| Viewer pitch | 0.12 rad |
| Start longitude | 20 degrees |
| Three.js | 0.160.0 from cdn.jsdelivr.net, ES modules with an importmap (changed in Stage 1: importmap added so `three/addons/` resolves) |

## 3.2 Lights and effects

| Setting | Value |
| --- | --- |
| Ambient light | #fff1da, 1.15 |
| Sun (key) | #ffe9c4, 1.6, from [-2.4, 1.6, 2.6] |
| Rim light | #dfe8d2, 0.45, from [2.6, -0.8, -1.4] |
| Brass rim | #d9b25a, 0.9, from [-2.0, 1.2, -3.0] |
| Halo | back-face fresnel sphere x1.09, #c9a14a, power 2.6, strength 0.5 (changed in Stage 1: was 0.85, softened) |
| Orbit ring | brass torus x1.42, tube 0.005, opacity 0.45, tilt X pi/2.25, tilt Y 0.35 |
| Plane | parchment plane on the ring at 0.35 rad/s |
| Landmark materials | MeshStandardMaterial, smooth shading, flatShading off (changed in Stage 1: was flat shading on), roughness 0.78, brass keys metalness 0.25 |
| Lit clock faces | card colour with emissive #d9b25a at 0.4 (changed in Stage 1: faces are now lit on all four sides, with hands) |
| Liberty flame | brass with emissive #cc7722 at 0.7 (changed in Stage 1: brighter gilded flame) |
| Contact pads | radial-gradient occlusion pad under each landmark, soft, unchanged |
| Rise-in | each landmark eases into place over 0.8 s on first load (scale from 0.9, settle along its surface normal, easeOutCubic, render-clock driven; skipped under reduced motion) (changed in Stage 1: new) |
| Geometry | each landmark is built per material, transforms baked in, merged to one mesh per material (changed in Stage 1: new build method) |

## 3.3 Landmark palette

| Key | Colour |
| --- | --- |
| stone | #efe4c8 |
| sandstone | #d9b68c |
| sand | #cfae6a |
| brass | #8a6d2f |
| brassDeep | #77591f |
| forest | #33503f |
| sage | #8fa382 |
| steel | #b7c2b0 |
| ink | #33302a |
| card | #fdfbf3 |
| clay | #a2603a |

Pyramids use tints derived from the sand key only (sand lerped toward stone at 0, 0.16, 0.3).

## 3.4 Landmarks

| Landmark | Place | Real lat, lon | Drawn at | Scale | Colour |
| --- | --- | --- | --- | --- | --- |
| Eiffel Tower | Paris | 48.858, 2.294 | 47.0, 2.8 | 0.22 | brassDeep |
| Big Ben | London | 51.501, -0.125 | 53.0, -2.0 | 0.19 | stone |
| Colosseum | Rome | 41.890, 12.492 | 41.9, 13.5 | 0.16 | stone |
| Statue of Liberty | New York | 40.689, -74.045 | same | 0.22 | sage |
| CN Tower | Toronto | 43.643, -79.387 | same | 0.19 | stone |
| Golden Gate Bridge | San Francisco | 37.820, -122.478 | same | 0.28 | clay |
| Machu Picchu | Peru | -13.163, -72.545 | same | 0.3 | forest |
| Pyramids of Giza | Egypt | 29.979, 31.134 | same | 0.25 | sand |
| Burj Khalifa | Dubai | 25.197, 55.274 | same | 0.2 | steel |
| India Gate | New Delhi | 28.613, 77.230 | same | 0.25 | sandstone |
| Great Wall | China | 40.432, 116.570 | same | 0.3 | stone |
| Sydney Opera House | Sydney | -33.857, 151.215 | same | 0.3 | card |

Build detail per landmark (Stage 1): Eiffel — four splayed tapered legs, crossed lattice struts on two tiers, two platforms, spire. Liberty — star pedestal (two rotated squares), lathe-turned draped robe, seven-ray crown, raised torch arm with gilded flame, tablet in the other arm. Opera House — four ribbed shells (segmented sphere shells plus rib arcs) on a two-step podium. Golden Gate — two stepped-portal towers, deck, catenary main cables with vertical suspenders. Big Ben — panel-lined shaft, four lit clock faces with hands, gilded belfry, spire. Colosseum — elliptical arcaded tiers (canvas texture, 36 arches per row, 3 tiers, 1024 x 256) with the broken upper ring. Pyramids — three crisp-edged pyramids in size order with sand tints. Burj Khalifa — six Y-plan setback tiers (three lobes each) rising to the spire. India Gate — arch legs, frieze band, cornice, attic and shallow dome. Great Wall — wall following a terrain curve with merlons on every segment and watchtowers at intervals. Machu Picchu — four terraces with stone retaining faces, three stone houses with pitched clay roofs, green peak behind. CN Tower — tapered shaft, pod with brass ring band, antenna.

Measured on the built mockup (Chromium, renderer readout): landmarks 7,010 triangles in total, largest single landmark Sydney Opera House at 1,872 triangles, desktop scene 50 draw calls and 18,850 triangles per frame.

## 3.5 Motion and input

| Setting | Value |
| --- | --- |
| Drag | free trackball, 0.005 rad per px at start zoom, scaled by zoom distance |
| Inertia | damping 0.92 per 60 fps frame, stops below 0.02 rad/s, capped at 6 rad/s |
| Slow turn | 0.12 rad/s about the globe's own pole |
| Resume | slow turn returns 3.0 s after the last input, ramps in over 1.5 s |
| Upright drift | pole eases back to its tilt at 0.8/s while turning |
| Zoom | min 3.4, start 5.6, max 8.5; key step x0.85; wheel exp(deltaY x 0.0015); ease 8/s |
| Wheel rule | zooms only when the pointer is over the sphere and the zoom is not at its limit; otherwise the page scrolls |
| Pinch rule | two touch pointers: distance ratio sets zoom, midpoint move tilts; browser pinch-zoom never fires on the canvas |
| Touch scroll rule | canvas keeps touch-action: pan-y; a vertical one-finger swipe scrolls the page |
| Keys | arrows spin 0.18 rad, + and - zoom, 0 resets pose and zoom |
| Reduced motion | no slow turn, no inertia, no plane movement, no rise-in; zoom snaps |

Pause button removed — owner ruling Nov 19 2026: the globe auto-loops; no play/pause button on any card. (Owner change, not a Stage 1 tuning change.) The brief's statechart has no paused state any more, and the Stage 2 e2e pause test and the section 9 pause checklist item from the original brief are superseded by this ruling.

## 3.6 Layout

| Setting | Value |
| --- | --- |
| Page | header, desktop hero section, phone section, contract section |
| Desktop hero | copy card left, globe right, map card tucked under the globe |
| Phone frame | 390 px wide, globe zone 260 px |
| Readout | small fixed corner readout outside the hero, live renderer triangles and draw calls plus landmark totals, refreshed twice a second (changed in Stage 1: new, mockup only) |

Stage 2 production changes (owner rulings Nov 19 2026; layout decided by a three-seat design pass — UI designer, UX researcher, frontend developer personas — and staged in the approved mock):

1. Expeditions Map card (src/components/game-app.tsx + src/components/home-v5.css): delete the hv5-worldmap SVG (game-app.tsx, inside .hv5-mapcard) and its .home-v5 .hv5-worldmap rule. The card sizes to its content at every width (owner ruling, Nov 19 2026: "Make the desktop card size to its content, like mobile" — supersedes the addendum-5 auto-margin centring, which existed only to fill the desktop stretch): .home-v5 .hv5-mapcard flex changes from 1 to 0 0 auto, so the rail still stretches to the hero's height but the card no longer grows to fill it (the rail's only other child is the globe zone; nothing depends on the stretch). Inside the card: .hv5-editions takes the standard step under the copy — margin-top: 16px; gap: 16px, and gap: 12px at <=680px; no auto margins. .hv5-edition min-height rises 48px to 64px. Badge, label, heading, copy, card padding (26px 28px) and the Challenge button (mt-3, directly under the editions) are unchanged. Measured in the approved mock: card height 492px at 1280 (was ~939px stretched), 470px at 768, 484px at 390; copy-to-first-row gap 16px and space below the Challenge button equal to the 26px card padding at all three widths.
2. Mountain climbing scene on tablet and phone (src/components/home-v5.css) — BUG FIX (owner ruling, Nov 19 2026: the hide rule is the defect; responsive design scales the asset, it does not hide it): remove the @media (max-width: 1080px) rule that sets .hv5-mtn-wrap to display: none, and add to the <=680px block: .hv5-mtn-wrap { flex: 0 0 auto; margin: 20px -22px -32px; } (the bleed matches the <=680px hero padding; flex: 0 0 auto lets the art's aspect ratio govern the wrap height so the sliced trail and trekker overlays stay aligned). At 681–1080px the base wrap rule applies unchanged. In the approved mock the scene renders and animates at 768px and 390px (two captured frames differ at both widths), with no horizontal overflow.
