# Landmark Globe Mockup — Status (CHECKPOINT, run 2 — build stage)

**Stage:** mockup only, scratch worktree, branch `mockup/famous-landmarks`.
No PR, no push, no production claim.
**State at checkpoint:** code stage DONE and committed (`4af95efe`);
typecheck clean; hermetic build done; the existing home-globe e2e gate
run (3/4 first pass, the 768×1024 paint test failed once then passed on
rerun — cold-load paint timing flake, recorded below). Captures NOT yet
run — the capture spec is written and is the continuation's first step.

## Budget (build stage)

- Fresh cap 25,000 tokens (owner re-baseline, Nov 20 2026). Spent
  ≈ 15,000 (±30%, estimate, no meter) — the 60% checkpoint, so this run
  stops here per the brief. Remaining ≈ 10,000 for: capture run, capture
  reads, tris/draws record, final commits + this file's build record.

## What was built (vs the design of record — no deviations)

- **Contract** (`globe-contract.ts`): `LandmarkSpec.spinDeg?` added;
  zoom.min 3.4 → 2.15; zoom gains `diveDist: 2.35`, `diveSeconds: 1.5`;
  LANDMARKS 12 → 15 rows: tajmahal (spec 27.175/78.042, drawn 24.9/80.3,
  scale 0.27, card), christ (−22.952/−43.211, drawn = true, 0.24, stone),
  ramasetu (9.121/79.522, drawn = true, 0.34, sand, spinDeg −22.6).
- **Registry** (`landmark-models.ts`): BUILD gains `tajmahal` (plinth,
  arched block with ink arch insets on 4 faces, onion dome + brass
  finial, 4 chhatri domes, 4 minarets), `christ` (plinth, octagonal
  pedestal, tapered robe, head, two down-angled outstretched arms),
  `ramasetu` (9 flattened sand shoals on an S-curve along local X, two
  sage-tinted, sunk to the waterline — no structure). Same bag/merge
  discipline, behind the single `buildLandmark`.
- **Placement** (`home-globe.tsx`): the one shared loop consumes
  `spinDeg` generically (spin about the surface normal after the
  UP→normal orient) — Rama Setu is its only consumer, not a special
  case. Holders are indexed (`holderById`, `userData.lmId`) for the
  dive raycast.
- **Controls** (`globe-controls.ts`): state gains `parked`; input gains
  `{ type: "dive", targetDist }` (sets the zoom target, zeroes inertia,
  parks). Auto-spin is suppressed while parked however long the idle;
  dragStart / wheel / pinch / handled key un-park. Pure step function,
  as before.
- **Dive driver** (one block in the shell): tap = pointerup ending a
  press with <6 px travel, <400 ms, never pinched → raycast holders
  (far-side hits rejected against the globe skin) → `startDive` slerps
  ~1.5 s (smoothstep) to qTilt ∘ Rx(drawnLat°) ∘ Ry(−90° − drawnLon°)
  while the controls ease covers the distance to 2.35. Real drag /
  wheel / key cancels mid-flight; reduced motion snaps. No timer cuts
  any motion.
- **Capture hook** (mock scaffolding, flagged in code for removal in a
  production port): `mount.__globeMock` = { project(id) → canvas
  coords, dive(id), state(), renderInfo(), landmarkTris() }.
- **Capture spec** (`tests/e2e/landmark-mockup.desktop.spec.ts`):
  home full-page 1280 + 390; scripted-tap dives to liberty / tajmahal /
  christ with settled-state assertions (parked, targetDist 2.35);
  Rama Setu dive then two real "−" key zooms to ~3.25 for the regional
  frame; writes render-info.json on the Liberty dive.

## Gate evidence

- `npx tsc --noEmit` — PASS (exit 0).
- Hermetic build (`build:pages`, VITE_KOFI_URL in env) — PASS.
- `tests/e2e/home-globe.desktop.spec.ts` — 3 passed, 1 failed on the
  first run: "globe mounts and paints at 768x1024". Rerun of that one
  test: **passed** (10.9 s), and a second rerun also passed.
  Classification: intermittent cold-load paint timing (the spec's
  disc-colour sampling racing texture settle on this VM), not a branch
  defect — no code path in this mockup touches mount/paint timing.
- Known unit-test pins NOT updated (mockup scope, per run 1): the unit
  suite pins LANDMARKS.length 12 and zoom.min 3.4
  (`globe-contract.test.ts`) and would need its pins moved by the
  production port; unit tests were not run in this stage.

## Remaining (continuation, in order)

1. Run the capture spec hermetically:
   `flock ~/workspace/.e2e.lock npx playwright test tests/e2e/landmark-mockup.desktop.spec.ts --project=desktop --workers=1`
   (PLAYWRIGHT_CHROMIUM_EXECUTABLE + VITE_KOFI_URL set; build already
   done — rebuild only if code changes).
2. Read all 6 captures first-hand (home-full-1280, home-full-390,
   dive-liberty-1280, dive-tajmahal-1280, dive-christ-1280,
   dive-ramasetu-regional-1280); re-shoot any blank/unsettled frame.
3. Record tris/draw calls from docs/motion-verify/render-info.json
   (budgets 40k tris / 60 draws; pre-mockup baseline 7,602 / 51).
4. Append the build record + capture verdicts to this file; local
   commits (captures + spec + this file). No push, no PR.

---

# Landmark Globe Mockup — Status (CHECKPOINT, run 1)

**Stage:** mockup only, scratch worktree on branch `mockup/famous-landmarks`
(base origin/main `dfb15d5b`). No PR, no push, no production claim.
**State at checkpoint:** inventory + verified coordinates + component design
DONE. No code written yet. Continuation does steps 2–4 of the brief.

## Budget

- Cap 35,000 tokens (brief). Spent ≈ 25,000 (±30%, estimate, no meter) —
  mostly the three coordinate-verification searches and full first-hand
  reads of the four globe source files. Past the 60% checkpoint (~21k), so
  this run stops here per the brief. Remaining under the original cap
  ≈ 10,000 — the continuation (3 builders + controls + shell dive +
  build + 6 captures) will likely need a re-baseline from the owner.

## Step 1 — Inventory (measured, from globe-contract.ts LANDMARKS + landmark-models.ts BUILD)

The 12 existing landmarks: Eiffel Tower (Paris), Big Ben (London),
Colosseum (Rome), **Statue of Liberty (New York)**, CN Tower (Toronto),
Golden Gate Bridge (San Francisco), Machu Picchu (Peru), Pyramids of Giza
(Egypt), Burj Khalifa (Dubai), India Gate (New Delhi), Great Wall (China),
Sydney Opera House (Sydney).

Owner's four, against that list:

| Landmark | Status | Action |
| :--- | :--- | :--- |
| Statue of Liberty | ALREADY ON THE GLOBE (`liberty`, lat 40.689, lon −74.045, scale 0.22, sage) | none — do not duplicate |
| Taj Mahal | missing (India Gate is a different monument) | add |
| Christ the Redeemer | missing | add |
| Rama Setu (Adam's Bridge) | missing | add as shoal ridge, no structure |

## Verified coordinates (for the new specs)

- **Taj Mahal** — lat 27.175, lon 78.042. Sources: Wikipedia infobox
  27.175°N 78.0419°E; UNESCO periodic report centre point
  27°10′25″N 78°2′38″E. Matches the brief's 27.1751 / 78.0421.
  Drawn spot nudged (contract's Europe-overlap discipline): true spot is
  only ~1.65° from India Gate's drawn spot (~0.03 globe units — the two
  models would merge into one blob), so drawnLat 24.9, drawnLon 80.3;
  spec lat/lon stay true. Scale 0.27, color `card` (white marble).
- **Christ the Redeemer** — lat −22.952, lon −43.211. Sources: Wikipedia
  (Corcovado) −22.952417, −43.21167; statue listings −22.95194, −43.21056.
  Matches the brief's 22.9519 S / 43.2105 W. Drawn = true spot.
  Scale 0.24, color `stone`.
- **Rama Setu** — spec lat 9.121, lon 79.522 (Wikipedia's Adam's Bridge
  coordinate, mid-chain). Chain: Dhanushkodi tip, Pamban Island
  (9.152, 79.428) → Talaimannar, Mannar Island (9.09, 79.72); 48 km of
  limestone shoals (Britannica / Wikipedia). Drawn = true spot.
  Ridge bearing: spinDeg **−22.6** (computed with three.js from the repo's
  own latLonToVec3 + holder quaternion, numerically verified: spun local
  +X lands exactly on the Dhanushkodi→Talaimannar direction). Scale 0.34.

## Component map (owner's component law — the design the continuation builds)

```
Home page (existing shell, untouched)
└─ HomeGlobe shell — src/components/home-globe.tsx (the one globe component)
   ├─ DATA — globe-contract.ts: LANDMARKS: LandmarkSpec[]
   │    every landmark, old and new, is ONLY a row:
   │    { id, name, place, lat, lon, drawnLat, drawnLon, scale, color, spinDeg? }
   ├─ MODEL REGISTRY — landmark-models.ts: BUILD: Record<id, Builder>
   │    + buildLandmark(mat, spec); one builder per id, each returning a
   │    unit-height group in the same local frame (bag/merge discipline,
   │    one mesh per material). NEW entries: tajmahal, christ, ramasetu.
   ├─ SHARED LANDMARK PLACEMENT — the one Landmark path inside the shell:
   │    holder at latLonToVec3(drawnLat, drawnLon) → orient UP→normal →
   │    spin by spec.spinDeg → buildLandmark → scale by spec.scale →
   │    contact shadow → rise-in. Identical for all 15 landmarks;
   │    no per-landmark code anywhere in the shell.
   └─ CONTROLS — globe-controls.ts (pure step function; the one
        controls module for every input)
        existing: drag / wheel / pinch / key / tick
        NEW: input { type: "dive", targetDist } + state.parked —
        a dive sets the zoom target and parks auto-spin/inertia;
        any real drag/wheel/pinch/key un-parks. Zoom range widened in
        the contract for this mockup: zoom.min 3.4 → 2.15 (deep zoom);
        dive target 2.35.
   └─ DIVE DRIVER — one self-contained block in the shell (not smeared):
        tap = pointerup with <6 px travel and <400 ms → raycast the
        landmark holders → target orientation
        qTilt ∘ Rx(drawnLat°) ∘ Ry(−90° − drawnLon°) → slerp ~1.5 s in
        the frame loop while the controls ease covers the distance;
        a real drag/key/wheel cancels the dive mid-flight; reduced
        motion snaps. Motion never ends on a timer — it completes its
        loop or is stopped by real input (keep-moving rule).
```

Per-landmark props = the spec row and nothing else. Taj Mahal passes
spinDeg 0 (unused); Christ the Redeemer spinDeg 0; Rama Setu is the only
consumer of spinDeg (−22.6) — a generic data prop on the shared path,
not a special case.

## Builders to write (registry entries, existing style/scale discipline)

- `tajmahal` — plinth, main block with a dark arch inset (colosseum's
  arch-shape trick), central onion dome (sphere, y-scaled) + finial,
  4 corner minarets (slim cylinders, small dome caps), 4 chhatri domes.
- `christ` — octagonal pedestal, tapered robe body, head (sphere),
  two outstretched arms (long boxes, slight downward angle). Stylized
  like `liberty`; stone palette.
- `ramasetu` — ~9 flattened sand spheres (y-scale ~0.22, sunk −0.01)
  along local X (−0.5…0.5) on a gentle S-curve, two sage-tinted;
  honest shoals only, nothing built on top. Very low tri count.

## Remaining (continuation, in order)

1. `npm ci` in this worktree (started in background at checkpoint).
2. Contract: +3 spec rows, `spinDeg?` on LandmarkSpec, zoom.min 2.15.
   Note: globe-contract.test.ts / globe-controls.test.ts may pin the
   landmark count or zoom values — check before running unit tests;
   the mockup build/captures do not run them.
3. Registry: +3 builders. Shell: placement consumes spinDeg; dive
   driver block. Controls: dive input + parked.
4. Build hermetically (docs/e2e-hermetic.md; flock; --workers=1;
   VITE_KOFI_URL in build + runner envs) and capture into
   docs/motion-verify/: home full-page 1280 + 390; close stills —
   Liberty dive, Taj dive, Christ dive, Rama Setu regional view
   (dive part-way, ~dist 3.2, so the ridge reads between India and
   Sri Lanka). For captures, a small e2e hook or scripted tap at the
   landmark's screen position after rotating it front — the dive is
   tap-driven, so scripted taps exercise the real path.
5. Report tris/draw calls after additions (budget: was 7,602 / 51
   against 40k / 60 — the three builders add an estimated <600 tris
   and ≤6 draw calls; measure, don't trust this estimate).
6. Local commits on mockup/famous-landmarks (owner identity, plain
   subjects, no trailers). No push, no PR.

## Capture step — build record (2026-11-20, capture leg)

All six captures shot under the hermetic recipe (flock, --workers=1,
pinned Chromium, VITE_KOFI_URL in the runner env) and READ FIRST-HAND
by the capture leg. Files in docs/motion-verify/.

| Capture | Verdict |
| :--- | :--- |
| home-full-1280.png | PASS — full page populated; globe painted (Europe/Africa aspect), landmarks standing on the skin; no void, no blank disc. |
| home-full-390.png | PASS — full page populated; globe painted in its phone zone; all cards + footer present. |
| dive-liberty-1280.png | LANDED — dive centred on the Statue of Liberty at 2.35 (parked, assertions green). Framing is TOP-DOWN (see note): Liberty reads as its crown/star plan shape beside the CN Tower model; it does not read as a standing statue from nadir. |
| dive-tajmahal-1280.png | LANDED — Taj Mahal centred at 2.35: white plinth, central dome, 4 minarets read clearly in plan view; the India Gate model sits adjacent (the disclosed drawn-spot nudge). Top-down framing as above. |
| dive-christ-1280.png | LANDED — Christ the Redeemer centred at 2.35 over the Rio coast; the outstretched-arms T silhouette reads in plan view. Top-down framing as above. |
| dive-ramasetu-regional-1280.png | READS — at 3.25 the shoal ridge is visible as a dotted chain of pale discs in the sea at India's southern tip, arcing toward Sri Lanka. Subtle by design (flattened sand shoals, nothing built on top). South Asia framing also shows the Taj + India Gate models and the Great Wall. |

Framing note (for the owner's eye, not a capture defect): the dive
orients the tapped landmark to disc centre, so the camera looks along
its local normal — the close-ups are plan (top-down) views. Google
Earth's dive finishes at an oblique tilt, which is what makes a
statue read as a statue. If the owner wants that read, the dive's
final orientation needs a tilt — a design change for the production
port, not something the capture step altered.

Tap-path finding (DISCLOSED, carried forward): the captures were NOT
taken through scripted mouse taps. The spec's tap at the hook-projected
base point never started a dive across repeated front passes (0.6
canvas window, confirm-and-retry), and a tightened 0.4 window never
matched — the canvas is larger than the disc and offset within it, so
canvas-normalised windows misdescribe the disc. The tap -> raycast
step needs interactive debugging before any production port. The
captures instead enter the dive through the capture hook's own
dive(id): the dive flight, zoom ease, parked state, key-zoom pull-back
and render are the real shell path; only the tap entry is unproven.

Render budget (measured by the spec's hook at the Liberty dive):
renderer frame 15,896 triangles / 28 draw calls; landmark models
total 10,478 triangles across all 15. Budgets: 40k tris / 60 calls —
INSIDE on both. (Pre-addition baseline of record: 7,602 tris / 51
calls for the 12-landmark globe; the frame/call figures here are the
hook's per-frame counts, not the same instrument as the baseline's.)

Carried forward for the production port (unchanged from the build
checkpoint):
1. Unit pins NOT updated in the mock: tests that pin LANDMARKS.length
   (12) and zoom.min (3.4) will fail against the mock contract
   (15 / 2.15) — the port must update those pins deliberately.
2. The __globeMock capture hook in home-globe.tsx is mock-only
   scaffolding (project / dive / state / renderInfo / landmarkTris).
   It must NOT port to production silently — remove it, or gate it
   explicitly, in the port.
3. NEW: the tap -> raycast dive entry is unproven by scripted tap
   (see finding above); the port needs a tap test that actually
   starts a dive, or an interactive debugging pass on the raycast
   geometry (projected base point vs model silhouette).

---

# Wave 1 — oblique zoom + 11 landmarks (2026-11-20, this run)

**Stage:** mockup only, same scratch branch. No PR, no push.
**Budget:** cap 40,000. Spent ≈ 38,000 (±30%, estimate, no meter) —
the run crossed its 60% checkpoint inside the single indivisible
capture unit (one batched run + 15 first-hand capture reads + one
fix/probe run) and finished under the hard cap. Commits: code
`374b3b62`; captures + this record in the following commit.

## Part A — the zoom fix (settled values, numerically verified)

The dive target is now a PIVOT rotation: the face-on pose pitched by
`diveTiltDeg` about the screen-horizontal axis through the landmark's
base, with the group easing to the compensating offset p − R·p, so
the landmark keeps its face-on screen spot while the view finishes
oblique. Verified with the repo's own three math before coding
(Liberty + Taj, both landmarks, both distances):

- `diveTiltDeg: 53` → finish elevation **50.3°** at diveDist 2.05
  (51.0° at 1.95). Base NDC (0, −0.37); a unit-height model's top at
  NDC y +0.14 (Liberty) / +0.28 (Taj) — large in frame, inside it.
- `diveDist` 2.35 → **2.05**; `zoom.min` 2.15 → **1.95**. Nearest
  globe surface to camera at the settled finish: 0.94 (2.05) / 0.85
  (1.95) vs near plane 0.1 — **no terrain clipping at either value,
  no back-off needed**.
- Cancel (drag/wheel/key) eases the pivot offset back to zero over
  0.6 s; a fresh dive supersedes; reduced motion snaps both ways.
  Real input still cancels; no timer cuts any motion.

Before/after read: v1's Liberty was a crown in plan view; wave-1
Liberty stands in three-quarter profile (robe, raised torch arm,
crown spikes) with the horizon band of other landmarks behind it.
The Taj reads the same way (dome, minarets, arch insets in profile).

## Part B — the 11 landmarks (spec = Wikipedia infobox coordinates)

| id | spec lat/lon | drawn | nudge disclosure |
| :--- | :--- | :--- | :--- |
| stbasil | 55.753 / 37.623 (verified by search) | = spec | none |
| pisa | 43.723 / 10.397 | 44.5 / 9.0, scale 0.25 | moved NW + scaled up after the first capture buried it between Colosseum and Sagrada |
| acropolis | 37.972 / 23.727 | 36.5 / 25.5 | S, clear of Colosseum drawn spot |
| sagrada | 41.404 / 2.174 | 39.0 / 1.0 | S, clear of Eiffel drawn spot |
| brandenburg | 52.516 / 13.378 | = spec | none |
| angkor | 13.412 / 103.867 | = spec | none |
| forbidden | 39.916 / 116.397 | 34.5 / 110.0 | SW — the Great Wall model sits on Beijing's true spot |
| fuji | 35.361 / 138.727 | = spec | none (terrain icon: cone + slope-matched snowcap) |
| petronas | 3.158 / 101.712 (verified by search) | = spec | none |
| hagia | 41.009 / 28.980 | 44.5 / 30.0 | N, clear of Acropolis drawn spot and the Pyramids |
| petra | 30.322 / 35.452 (Al-Khazneh, verified by search) | 31.0 / 40.5 | E, clear of the Pyramids |

Builders follow the registry discipline (one entry each, bag/merge,
detail aimed at the dive close-up: St Basil's five coloured onion
domes, Pisa's six arcaded tiers on a ~4° lean, Parthenon colonnade,
Sagrada's nine spires, Brandenburg colonnade + Quadriga, Angkor's
quincunx of lotus towers over a moat square, Forbidden City's
double-eaved brass roofs, Fuji's snowcap, Petronas twins + skybridge
+ banding, Hagia's dome/half-domes/four minarets, Petra's facade
carried on both faces between cliff blocks).

## Captures (one batched run, 15/15 passed; every frame read)

| Capture | Verdict |
| :--- | :--- |
| home-full-1280 / home-full-390 | PASS — denser globe in flow, Europe cluster distinct, no merged blobs; page populated end to end |
| dive-liberty | PASS — profile read (see Part A) |
| dive-tajmahal | PASS — dome/minarets/arches in profile; India Gate adjacent (known nudge) |
| dive-stbasil | PASS — five coloured onion domes read; slightly slab-heavy from above |
| dive-pisa (re-shot after fix) | PASS — arcaded tower centred and identifiable; lean subtle at this angle |
| dive-acropolis | PASS — columned temple on its plateau; Hagia looms behind it |
| dive-sagrada | PASS — spire cluster centred; crowded frame (Colosseum right) |
| dive-brandenburg | WEAK — centred, but the gate reads as a roof slab; the colonnade (its face) does not present at the finish angle |
| dive-angkor | PASS — five lotus towers over the moat, distinctive |
| dive-forbidden | WEAK — centred; roofs read as layered slabs, red walls and gate lost; the Great Wall crosses the background |
| dive-fuji | PASS — snow-capped cone, crater disc, unmistakable |
| dive-petronas | PASS (measured) — the probe puts Petronas's holder at NDC (0.00, −0.37), exactly the pivot point; but the READ is upstaged: the 53° tilt lays Angkor (10° N) into the visual centre while Petronas's towers sit lower-frame |
| dive-hagia | PASS — dome, half-domes, four minarets read |
| dive-petra | WEAK — cliffs + facade mass centred, but the Treasury's column detail does not present (its detailed faces sit edge-on to the finish view) |

Pattern in the three WEAK reads: horizontal monuments (a gate, a
palace roofline, a facade) read weakly from a 50° finish; vertical
monuments read well. A production port should either deepen those
three models' vertical detail or accept the weaker read — flagged,
not fixed, in this mockup.

## Render budget (hook instrument, per-frame)

- Landmark models total: **17,938 tris** across 26 (was 10,478 / 15).
- Liberty dive frame: 25,582 tris / **79 calls**.
- Home framing (full disc): 30,058 tris / **99 calls**.
- Triangles INSIDE the 40k budget on both framings. **Draw calls
  OVER the 60 budget on both framings** — each landmark costs its
  shadow plus 1–6 material meshes, and the oblique dive shows far
  more of the globe than v1's plan dive did (v1's 28 was a culled
  subset). The port needs a call diet (cross-landmark merging or
  fewer per-landmark materials); flagged here, not hidden.

## Carried forward (unchanged + new)

1. Tap -> raycast dive entry still unproven (NOT re-chased, per the
   wave brief); captures enter via the hook's dive(id).
2. Unit pins (LANDMARKS.length, zoom.min) still not updated — the
   port moves them (now 26 / 1.95, plus diveDist 2.05, diveTiltDeg).
3. The __globeMock hook is still mock-only scaffolding.
4. NEW: draw calls over budget at 26 landmarks (above).
5. NEW: three weak reads (brandenburg, forbidden, petra) and the
   petronas/angkor centre-composition effect of the pivot finish.

---

# Wave 2 — progressive reveal + canon completion (2026-11-20, this run)

**Stage:** mockup only, same scratch branch. No PR, no push.
**Budget:** cap 35,000. Spent ≈ 33,000 (±30%, estimate, no meter) —
the run crossed its 60% checkpoint inside the capture tail (batched
run + interruption recovery + 14 first-hand reads) and finished the
wave under the hard cap rather than stranding shot captures unread.
Commits: code `2d5b4c61`; captures + this record in the following
commit.

## Part A — progressive reveal (owner steering, this wave)

Landmarks no longer all sit on the globe at once. One data prop and
one shared path; nothing per-landmark:

- **Prop** — `LandmarkSpec.revealAt`: the camera distance at or below
  which the landmark is on the skin. Verified against the contract's
  real zoom values (start 5.6, max 8.5, diveDist 2.05): Tier A = 8.5
  (always — equals zoom.max), Tier B = 2.6 (mid zoom), Tier C = 2.2
  (deep zoom; a dive finishes at 2.05, inside every tier).
- **Path** — the shell's frame loop replaced the one-shot load
  rise-in with a per-landmark reveal progress eased on the same curve
  (scale 0.9 → 1, settling outward along the normal over
  `riseSeconds`), driven by the controls' eased `dist` each frame.
  It runs in reverse as the user zooms back out past a threshold
  (settle-away reuses the same ease — no separate mechanism needed),
  snaps under reduced motion, and the active dive's target is
  force-revealed for the whole flight. At zero progress the holder
  is `visible = false`, so hidden tiers shed their draw calls whole.
- **Tiers** — A (12): eiffel, bigben, colosseum, liberty, pyramids,
  greatwall, opera, tajmahal, christ, burj, stbasil, fuji.
  B (17): cntower, goldengate, machupicchu, indiagate, pisa,
  acropolis, sagrada, brandenburg, angkor, forbidden, petronas,
  hagia, sphinx, rushmore, chichen, spaceneedle, gatewayarch.
  C (8): ramasetu, petra, tablemountain, victoriafalls, grandcanyon,
  niagara, moai, uluru.

## Part B — the 11 (canon complete: 37 landmarks)

Spec = Wikipedia infobox coordinates; five re-verified by search
this wave (sphinx, moai, victoriafalls, uluru, chichen). spinDeg is
the numerically solved presentation correction (repo three math:
the spin that turns local +Z to the dive finish's presenting
direction, front vector (0, −0.69, 0.72) at every spot, local +X
landing screen-horizontal).

| id | spec lat/lon | drawn | spin | tier |
| :--- | :--- | :--- | ---: | :--- |
| sphinx | 29.975 / 31.138 (search-verified) | 27.0 / 36.5 — its true spot sits inside the Pyramids model; 6.2° clear of it, 5.7° clear of Petra's drawn spot | 103 | B |
| tablemountain | −33.963 / 18.410 | = spec | 85 | C |
| victoriafalls | −17.924 / 25.857 (search-verified) | = spec | 92 | C |
| rushmore | 43.879 / −103.459 | = spec | −37 | B |
| chichen | 20.683 / −88.569 (search-verified, El Castillo) | = spec | −22 | B |
| moai | −27.126 / −109.277 (search-verified, Ahu Tongariki) | = spec | −43 | C |
| grandcanyon | 36.107 / −112.113 | = spec | −46 | C |
| niagara | 43.080 / −79.075 | 39.0 / −69.0 — its true spot sits inside the CN Tower model; 5.5° clear of Liberty (offshore, the falls' own element) | −2 | C |
| gatewayarch | 38.625 / −90.185 | = spec | −24 | B |
| spaceneedle | 47.620 / −122.349 | = spec | −56 | B |
| uluru | −25.345 / 131.036 (search-verified) | = spec | −162 | C |

Builders stay mesh-lean (≤3 materials each; the Arch is a single
tube mesh). Terrain features get real forms, no invented
structures: Table Mountain a sheer mesa with a green cap, Victoria
Falls a plateau/curtain/gorge-floor cross-section, Grand Canyon an
incised slot with strata ledges and a shadowed floor, Niagara a
horseshoe curtain with river and foam discs, Uluru one smooth red
monolith on a strata skirt.

## Captures (every frame read first-hand)

Run history, honestly: the first batched run was killed by a
runtime restart after the home pair (infrastructure, not a test
failure); a completion run then passed all 11 dives and failed the
regional on a fixed-wait timing assumption (this VM's clamped frame
clock sinks Tier C slower than real time); the regional retry with
a poll-based wait passed. 14/14 captures exist.

| Capture | Verdict |
| :--- | :--- |
| home-full-1280 / home-full-390 | PASS — Tier-A-only skin: the disc reads clean and uncrowded (Europe is a few distinct models, no blob cluster); pages populated end to end. Reveal assertions green in-spec (eiffel/tajmahal in, brandenburg/sphinx/petra/uluru out). |
| regional-europe-1280 | STATE PASS / VISUAL FAIL — in-spec assertions prove the mechanism at dist 2.41 (brandenburg + acropolis revealed, petra sunk away). But the frame itself drifted before the screenshot: the "−" key un-parks, and while the sink poll ran, auto-spin resumed and rotated the view to Arabia/Africa terrain with no landmark cluster discernible. The picture does not show what it was meant to prove; the assertion does. Port/spec note: shoot before the resume window or re-park after zooming. |
| dive-sphinx | PASS — the face presents (ink brow + nose read on the head block), headdress behind, paws forward; Pyramids adjacent (the disclosed nudge), crowded horizon. |
| dive-tablemountain | PASS — flat top, green cap, sheer front: the mesa reads. |
| dive-victoriafalls | WEAK — the cross-section reads as layered strata bands; the curtain does not read as falling water at this palette/scale. |
| dive-rushmore | WEAK — the spin works (four faces present, countable, noses proud), but they read as pale busts on a box, not faces carved into a cliff. |
| dive-chichen | WEAK — the stepped pyramid reads (tiers, summit temple, door) but is undersized in frame: the builder is 0.375 tall against the ~1-unit convention, and taller neighbours upstage it. |
| dive-moai | PASS — four moai on the ahu, two red pukao, elongated heads presenting. |
| dive-grandcanyon | WEAK — reads as a mesa slab: the front rim occludes the incised slot at the finish, so the gorge does not present. |
| dive-niagara | WEAK — reads as a pale drum: the horizontal river/foam discs dominate and the horseshoe curtain's gorge relationship does not present. |
| dive-gatewayarch | PASS — the catenary arc reads instantly, feet planted. |
| dive-spaceneedle | PASS — saucer on splayed legs reads; small and pale in frame. |
| dive-uluru | PASS — one smooth red monolith on its strata skirt; the honest form. |

Pattern across the five WEAK reads: features whose identity is a
*surface relationship* (carving-in, falling water, an incision, a
curtain into a gorge) flatten at the finish, while free-standing
forms read. A port should deepen those five models (carved relief
for Rushmore, a recessed slot geometry for the Canyon, translucent
or animated water for the falls) or accept the weaker reads —
flagged, not fixed, in this mockup. The US-west dive frames are
also crowded: Golden Gate's long model looms in the foreground of
both the Rushmore and Grand Canyon finishes.

## Render budget (hook instrument, per-frame)

- Landmark models total: **20,582 tris** across 37 (wave 1: 17,938 /
  26 — the 11 additions cost only 2,644 tris).
- Globe view (home framing, reveal active): 20,772 tris /
  **53 calls** — draw calls are back INSIDE the 60 budget (wave 1's
  home framing was 30,058 / 99). The reveal is the diet.
- Dive view (Sphinx dive): 20,310 tris / **67 calls** — still over
  60 at dive depth (all tiers up in the region), improved from
  wave 1's 79. The remaining call diet is a port item, now scoped
  to dive framings only.

## Carried forward (unchanged + new)

1. Tap -> raycast dive entry still unproven (NOT re-chased);
   captures enter via the hook's dive(id).
2. Unit pins still not updated — the port moves them (now
   LANDMARKS.length 37, zoom.min 1.95, diveDist 2.05, diveTiltDeg,
   and the new revealAt tiers).
3. The __globeMock hook is still mock-only scaffolding (it gained
   `revealed()` this wave).
4. Draw calls: fixed at globe view by the reveal (53/60); dive
   framings still over (67/60) — port item, dive-scoped.
5. NEW: five weak reads (victoriafalls, rushmore, chichen,
   grandcanyon, niagara) + the regional capture's auto-spin drift
   (spec-timing note above) + US-west dive-frame crowding.
6. The canon is complete at 37 landmarks; nothing remains of the
   owner's list.

---

# Reveal v2 — focus-gated reveal (2026-11-20, this run)

**Stage:** mockup only, same scratch branch. No PR, no push.
**Budget:** cap 20,000. Spent ≈ 17,000 (±30%, estimate, no meter) —
the 60% checkpoint fell inside the capture-and-record tail (one
batched run, passed first try; three first-hand reads; this record)
and the run finished the unit rather than stranding shot captures
unread. Commits: code `5b2ddbe8`; captures + this record follow.

## The owner's correction

On the wave-2 Grand Canyon dive frame: "this one has overlaps, and
thats why i said unless player zooms in we dont want to reveal
more." The v1 gate was distance-only, so at dive depth EVERYTHING
in the region stood at full size in the target's own frame —
Golden Gate, Rushmore, Space Needle, the Arch and CN Tower crowded
the Canyon. Zoom depth was the wrong gate on its own; v2 adds the
focus condition the sentence implies.

## The cure (one shared path, no per-landmark logic)

- **Contract** — `GLOBE_CONTRACT.revealFocus.bands`, [dist, deg]
  anchors interpolated over camera distance, next to the tier
  values: [8.5, 180], [5.6, 100], [2.6, 35], [2.2, 22], [2.05, 12].
  The radius shrinks as the camera closes in. The wide anchors keep
  globe view provably unchanged (the visible cap at start distance
  5.6 spans ~80°, inside the 100° band — Tier A's sparse skin is
  exactly v1's). The gate binds every tier as the camera closes in;
  that is what sinks the Tier A horizon band in a dive (below).
- **Path** — the reveal loop's `want` now also requires the
  landmark's drawn direction to sit within the radius of the focus:
  the dive target while a dive is in flight or parked (tracked as
  `diveTarget`, cleared by the next real input via cancelDive),
  else the surface point at frame centre (camera direction through
  the globe centre, in group space). The target always reveals.
  Rise/settle easing, reverse-on-zoom-out, reduced-motion snap and
  the visible=false call shed are unchanged from v1.
- **Bands settled numerically** on the drawn coordinates (great-
  circle angles): parked 12° (tightened from the brief's ~14 —
  Space Needle sits 13.8° off the Canyon and was a named offender).
  Canyon keeps Golden Gate 8.5° + Rushmore 10.2°; Liberty keeps CN
  Tower 4.9° + Niagara 4.2°, sinks the Arch 12.6° and the
  trans-Atlantic band (Eiffel 53.5°, Big Ben 48.6°).
- **Capture hook** gained `frameAt(id, dist)` (mock scaffolding):
  parks on a landmark at an exact distance, so the regional frame
  is set by orientation, not keys — the spin-resume quirk itself
  stays a port note, untouched here.

## Proof captures (one batched run, 4/4 passed; frames read)

| Capture | Verdict |
| :--- | :--- |
| dive-grandcanyon-1280 (RE-SHOT) | CURED — frame holds the Canyon + Golden Gate (left) + Rushmore (behind) only; Space Needle, Arch, CN Tower sunk (asserted in-spec and visible by their absence). Golden Gate still looms — a true neighbour at 8.5° whose long model spans the frame edge; geometry, not a reveal leak. The Canyon model itself still reads as terraced slabs (the wave-2 weak read — a model note, not a reveal note). |
| dive-liberty-1280 (RE-SHOT) | CURED — Liberty in profile + CN Tower adjacent; the trans-Atlantic horizon band (Eiffel, Big Ben) is gone versus the wave-1 frame. Niagara's pale disc sits right of Liberty (4.2°, revealed as designed; its drum read is the known wave-2 weak model). |
| regional-europe-1280 (RE-SHOT) | PASS, picture AND state — parked on Brandenburg at 2.41 (focus radius ~29°): B risen inside the focus (hagia in frame; pisa/sagrada/acropolis asserted), B sunk outside it though its distance gate passes (sphinx 30.8°, indiagate 52° — asserted), Tier C out (petra). No drift: the frame holds Europe, where the v1 attempt slid to bare Arabia/Africa. |
| home-full-1280 (re-run for numbers) | PASS — Tier-A-only skin, unchanged from v1 as designed. |

## Render budget (hook instrument, per-frame)

- Globe view: 18,712 tris / **46 calls** (v1: 20,772 / 53 — the
  focus gate also sheds far-side holders at globe view).
- Grand Canyon dive: 13,496 tris / **13 calls** (wave-2 dive
  framing: 20,310 / 67). The dive-scoped draw-call overage is
  GONE: a dive frame now draws only its focus neighbourhood.
  Landmark models unchanged: 20,582 tris across 37.

## Carried forward (port list, updated)

1. Tap -> raycast dive entry still unproven (NOT re-chased).
2. Unit pins still not updated (LANDMARKS.length 37, zoom values,
   now also revealFocus bands).
3. __globeMock is still mock-only scaffolding (gained frameAt).
4. Draw calls: SOLVED at globe view (46/60) and at dive depth
   (13/60) by reveal v2 — the port's call diet is no longer a
   blocker; keep the focus gate and the numbers hold.
5. Weak reads unchanged (victoriafalls, rushmore, chichen,
   grandcanyon model, niagara + wave-1's three) and the
   spin-resume-on-key-zoom quirk: port notes, as before.
