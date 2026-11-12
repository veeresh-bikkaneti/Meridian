# "Why Do We Learn This?" card film: 3D assets and preview scene

Source for the Home card film described in the film prompt (screenplay, band variants). This folder is tooling only: nothing here is imported by the app or ends up in the bundle. The props in `public/models/why-learn/` are static files.

## Assets

Props (`public/models/why-learn/`, built by `build_props.py` with Blender's Python module `bpy` 5.3):

| File | Bytes | What it is |
|---|---|---|
| `lens.glb` | 13,072 | Holmes's magnifying lens. Meshes `lens-glass` (own mesh, semi-transparent), `lens-rim`, `lens-ferrule`, `lens-handle`. Origin at the grip. |
| `ball.glb` | 8,960 | Red ball with a cream stripe, radius 0.11 m. |
| `ladder.glb` | 10,668 | 2.6 m wooden ladder, 8 rungs, origin between the feet (tilt it about Z to lean). |
| `lamp-post.glb` | 13,228 | 4.2 m street lamp; `lamp-glass` is slightly emissive. |
| `cafe-table.glb` | 9,996 | Round café table, top at 0.75 m. |
| `pie.glb` | 24,304 | Plate plus 8 slice meshes `slice-0`…`slice-7`, each with its own crust lip, so a slice can lift out. |
| `swing-set.glb` | 9,616 | A-frame swing. Rotate the empty `swing-pivot` to swing the chains and seat. |
| `hose-nozzle.glb` | 8,200 | Garden hose nozzle with a short hose; origin at the tip. |
| `bridge.glb` | 16,996 | Cable-stayed bridge segment: deck, tower, pier, 12 cables `cable-0`…`cable-11`. |
| `bowls.glb` | 26,212 | Three equal bowls `bowl-0` (centre), `bowl-1`, `bowl-2`, each with dough. |

Total 141,252 bytes. Units are metres, glTF Y-up. Flat colours (no textures), low poly, no text, numbers or symbols on any prop.

Characters are the game's own `public/models/detective/holmes.glb` and `watson.glb` (not remodelled). The scene hides Watson's notebook and his own small lens (meshes with materials `notebook`, `brass`, `lens`) because Holmes holds the lens in this film; the GLB itself is unchanged.

New poses in `src/game/loop/detective/pair3d-poses.ts` (all `anim: "idle"`, no new anim value):

- Holmes `lens-sweep`: lens raised at chest height, right arm forward, left hand behind the back, eyes down.
- Watson `toss`: throwing arm high in follow-through, eyes up.
- Watson `lean-in`: head down and forward, arms loose near the knees.

## Preview scene

`scene.html` + `scene.js`: the street corner with the timeline from section 3 of the film prompt (8.0 s, 24 fps, 1094×616, locked camera).

Open it (it must be served, not opened as a file, because it loads modules and GLBs):

```
npm install                      # once; the scene uses the repo's three ^0.160
python3 -m http.server 8123      # from the repo root
# then open http://localhost:8123/scripts/why-learn-film/scene.html
```

URL switches:

- `?band=7-10`, `?band=10-18` (default), `?band=18+`: swaps the objects as section 4 says (ball / swing / pizza; ball / ladder / pie; hose water / bridge / one bowl to three) and the light (brighter and softer, base warm, cooler).
- `?t=4`: freezes one frame. `t=0` is the poster, `t=4` the still (lens on the shape beat with the triangle visible).
- `?capture=1`: no autoplay; drive it from script with `await window.film.ready; window.film.render(t)`.

Every frame is a pure function of `t`, so a capture gives the same pixels every run. Frame 0 and the last frame (t = 7.958) differ only by breathing (PSNR 40.9 dB), so the take loops; the build agent can still add the 0.4 s crossfade from the prompt.

Timeline (base band): 0 to 1 s poster hold. 1.0 to 3.7 s Watson tosses the ball, scoots left and catches it; the lens lifts off Holmes's glass and follows the ball while the gold parabola draws behind it. 3.0 to 5.0 s the lens slides onto the ladder; the right triangle (ladder, post, ground), the angle arc at the foot and a right-angle mark draw on. 5.0 to 6.5 s the lens dips to the pie; four gold diameters cut it into 8 equal slices while Watson leans in with a small bounce. 6.5 to 8.0 s lines fade, the lens returns to Holmes's hand, Holmes glances at Watson, Watson nods and walks back to his frame-0 spot.

The lens effect: the scene renders to one target and the gold lines (tube meshes) to a second. A composite pass shows the lines only inside the lens circle, magnifies the view 1.16× inside the glass, adds a soft glow around the lines, draws the brass rim and its shadow, and a faint light beam from Holmes's lens to the travelling lens view (the same device as the torch beam in the Cold Trail film). Outside the lens the street is ordinary.

## Recording

```
python3 -m http.server 8123 &                                   # repo root
node scripts/why-learn-film/capture.mjs 10-18 frames-base        # 192 PNGs, about 75 s with SwiftShader
node scripts/why-learn-film/capture.mjs 10-18 stills --stills    # poster.png (t=0), still.png (t=4)
ffmpeg -framerate 24 -i frames-base/f%04d.png -vf scale=1094:616 -c:v libx264 -crf 36 -preset veryslow -an -movflags +faststart -pix_fmt yuv420p why-learn-film.mp4
```

`capture.mjs` uses the repo's `playwright`. If its browser isn't installed, point `CHROME_PATH` at any local Chrome or Chromium. A test encode of the base band at CRF 36 came to 121,487 bytes, well under the 400 KB cap. A Chrome agent can equally record the live page (it loops in real time) and encode the take with the prompt's ffmpeg line.

## Look: how it matches the shipped Home films

The shipped films (GeoDetective, Cold Trail and the Review, Journal and Grown-ups spots in `src/assets/home-v5/`) are illustrated cartoon cinema: one composed wide shot, warm light, characters acting with clear poses, layered backgrounds that soften with distance. The scene matches that rather than reading as a 3D test render:

- Toon shading: every surface uses a 3-step toon ramp, and every object gets an ink outline (inverted hull), so figures and props read as drawn, like the illustrated films.
- Composition: locked wide shot with the pair framed left and right, the shape beat centre-back and the table front-right, key action inside the centre 60% of the width.
- Depth: foreground paving and curb, mid-ground café facade with awning, shutters and planters, a stepped-back neighbour building, two rows of rounded trees, a far town and drifting clouds that melt into warm atmospheric haze (fog plus fog-tinted outlines).
- Light: a low warm sun from the right with soft shadow maps, a sky/ground hemisphere fill and a small warm bounce; a gentle warm grade and a soft vignette in the composite.
- Acting: Holmes moves least (lens and head track each beat), Watson moves most (toss, scoot, catch, delighted lean-in, nod), both breathing on a loop-safe 4 s cycle.
- Bands: 7-10 brighter, warmer and more saturated; 18+ cooler and more neutral; same beats and timings.

What it is not: the shipped films are painted 2D frames with hand-drawn texture. This is real-time 3D with a cartoon treatment, so it is cleaner and flatter than those paintings. If the owner wants a closer match, the cheapest next step is a paper-grain and line-wobble pass in the composite shader, not new models.

## Rebuild

```
pip install bpy                                                  # Blender 5.x as a Python module
cd scripts/why-learn-film && python build_props.py ../../public/models/why-learn
node --experimental-strip-types scripts/why-learn-film/check-poses-sync.mjs   # from the repo root
```

`scene.js` keeps a copy of the six poses it uses (plain JS can't import the `.ts` table in the browser); `check-poses-sync.mjs` fails if that copy drifts from `pair3d-poses.ts`. To render the new poses from the GLBs, use `scripts/detective3d/check_poses.py` as its README says.
