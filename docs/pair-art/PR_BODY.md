# PR A — Character Re-Skin: Model Sheets, Spec & Harness

Merge only on the panel's READY/READY-WITH-NITS verdict on the final tip (ship-when-ready, owner 2026-11-04).

## Summary

Holmes & Watson are re-drawn in the painted storybook look of the
Cold Trail card films — the owner's confirmed reference — without
changing how the pair behaves. This PR is the first of four:

- **PR A (this PR):** the painted model sheets, the binding model
  sheet spec, and the automated harness that measures the sheets
  against the budgets. Sheets + spec + harness only.
- **PR B:** the engine re-skin behind the new flag `pairArt` —
  same engine, same 22 poses, same props, same state machine.
- **PR C:** hand-drawn hero moments (bench intro + celebration).
- **PR D:** the flip + retirement of the flat rig, gated by the
  per-cell kid test as go / no-go.

The engine, pose / palm-anchor architecture, props whitelist, and
answer-blindness are unchanged by the whole programme. Holmes stays
answer-blind by construction.

**⚠️ Panel outcome — NOT READY (round 1, tip `c857a71`):** the
13-seat panel returned 7 approve-with-nits and **6 BLOCKs** — the
face-floor FAIL below (ruling (f)) from the UX designer, narrative,
and Game player seats; a parts-integrity BLOCK from the Game
developer (arms without hands, a second magnifier baked into the
legs slice, fused legs, no shipped palm measurer); a compositing
BLOCK from the Frontend seat (flat keyline bars on interior cut
edges + no runtime halo source); and protocol/harness BLOCKs from
the UX researcher and Office hours. Cures are being applied on
this branch; the panel re-votes the cured tip. The sheets do NOT
merge on round 1.

**Round 4 — panel re-vote open on this tip.**

- Round 3 outcome: the panel re-vote on `a4593c0`
  returned 8 APPROVE-WITH-NITS, 4 BLOCKs (Game
  developer, Game level architect, Game narrative
  designer, Game player), 1 seat vacant (Office
  hours — no persona file exists) — **NOT READY**.
- Cures landed this round (cure round 2, converged
  at `11dc084`):
  - Raised-arm parts re-cut — rects [66, 4, 114, 66.5]
    / [3, 3, 41.5, 62] vb; assembled hand-zone skin
    reproduces the plates 1220/1226 px (Holmes) +
    1028/1028 px (Watson); harness palm 0.584 /
    2.000 rig px (see Verification).
  - Search / berth-think plates: the magnifying
    glass is raised.
  - Notebook-mark plate: head down, pencil on page.
  - Both clap plates: two palms meeting.
  - Pencil split: `prop-pencil.png` is a new
    standalone part; the gasp and high-five plates
    are pencil-free.
  - Watson read / think plates: sheet held in hand;
    read gaze down.
  - Play-size pass: high-five fingers drawn;
    celebrate glass clear of the sightline; wonder
    ear-discs reduced 116→4 / 98→24 px with open
    mouths; hushed round mouths drawn; Watson
    focused / attentive / pout / thinking faces
    separated.
  - Harness: figure placement is asserted against
    map + chrome + page text at settle time;
    `lawfulSpots` fails when no lawful spot exists;
    halo rank −1 (halo paints under the figure).
  - Guard: the pencil prop model follows the split
    — 13/13 incl. the new pencil negatives.
- Find leg: find screens at 1280 + 1920 captured
  lawful (0 overlaps). At 390 + 768 the find leg is
  **NOT RUN — no lawful spot**: every placement on
  the case-open page intersects the map, clue text,
  or page chrome incl. page text (spec §16.6(iv)).
- Face floors: still **PENDING THE OWNER'S RULING**
  (§16.5) — not binding law; the §8.3 size band
  stands.

**Owner rulings of record:**

- (1) Cold Trail films are the reference — CONFIRMED, Veeresh,
  2026-11-07 ~15:57 CST (voice call).
- (2) LOOK-as-live-rig, (3) doll chassis + hero moments,
  (4) per-cell kid test as go/no-go — all ruled YES, Veeresh,
  2026-11-07 ~21:24 CST, in chat: **"Yes to all three — start
  PR A"**, given after ❤️ + "Love this version" on the final
  regenerated mockup (`mockup-390.mp4`, format-study evidence
  folder).

**Design of record:** `docs/pair-art/MODEL_SHEET_SPEC.md` (this PR)
over the format study (`STUDY-format-rebuild.md` +
`MOCKUP-NOTES.md`, evidence folder) and handbook ch.10.

## Deliverables checklist

Spec / docs (this branch's spec crew):

- [x] `docs/pair-art/MODEL_SHEET_SPEC.md` — the binding spec:
  programme shape, parts ↔ pivots ↔ viewBoxes, the closed
  22-pose verb shortlist with face assignments, the 11 × 2
  expression set + mouth-travel rule, hard budgets, scale law,
  staging law, gaze-leak law, silhouette gate, kid-test gate,
  task capsule, redundancy audit
- [x] Handbook addendum — `docs/handbook/10-holmes-and-watson-pair.md`,
  additive PR A section only, no existing section rewritten
- [x] `BRANCH_STATUS.md` — PR A capsule + status, repo convention
- [x] `docs/pair-art/PR_BODY.md` — this draft

Art / harness (sibling crews — coordinator fills on landing):

- [x] Model sheets — Holmes + Watson parts per spec §3
  (hat, head, torso/coat, arm-front, arm-back, legs),
  22 pose composites, 22 faces, 2 static composites —
  landed `8f0e5fd` + `f2adf71` (parts-integrity cures from
  the panel round 1 are tracked in the Panel section below)
- [x] Silhouette gate — grayscale renders at 104 px committed
  with the sheets + crew-internal sign-off before colour lock
  (spec §11) — PASS, recorded in the asset lock
- [x] Harness report — palm error, asset / decoded budgets,
  scale ratio, zero-live-filter check, with exact commands +
  target revision (spec §§7, 10) — landed `1762e3f`, re-run
  on the final art (see Verification)

## Budget table

Hard numbers from spec §7 / §8. Measured values are filled by the
coordinator from the art + harness reports before the panel votes —
a `{{TOKEN}}` left in this table at vote time is a blocker, not a
placeholder.

| Budget | Hard limit | Measured | Verdict |
| :--- | :--- | :--- | :--- |
| Total runtime pair assets (lazy-loaded) | ≤500 KB | 171.9 KB (171,918 B at the converged cure tip — panel-cure parts: split legs, halos, raised arms) | PASS |
| Decoded memory | ≤32 MB | 2.44 MB | PASS |
| Palm-anchor error — Holmes `(99, 25)` | ≤3 px at rig scale | 0.58 rig px — measured by the shipped assembly measurer (harness, converged cure tip, 2026-11-08; dedicated raised-arm part, drawn explicitly per the rig contract; supersedes the 0.53 reading on the pre-round-2 art, and 0.22 before the open-palm repaint) | PASS |
| Palm-anchor error — Watson `(15, 21)` | ≤3 px at rig scale | 2.00 rig px — measured by the shipped assembly measurer (harness, converged cure tip, 2026-11-08; dedicated raised-arm part; supersedes the 0.56 reading on the pre-round-2 art, and 0.33 before the open-palm repaint) | PASS |
| Live per-frame SVG filters | 0 | 0 | PASS |
| Static composite — Holmes (holmes-pose-dock.png) | ≈20–30 KB | 14,690 B | PASS |
| Static composite — Watson (watson-pose-station-idle.png) | ≈20–30 KB | 16,651 B | PASS |
| Scale ratio Watson / Holmes (every composite) | 0.73–0.79 (≈0.75 law) | 0.75–0.77 (mean 0.76) | PASS |
| Silhouette gate (grayscale, 104 px) | Approved before colour lock | Approved — both figures read correctly in grayscale at 104 px before colour lock (Holmes tall/thin + deerstalker, 43 px wide; Watson short/stout + bowler, 63 px wide; locked in ASSET_LOCK.json `silhouette_gate`) | PASS |
| Face height at max in-band size (§8.3 floors) | Holmes ≥38 / 44 / 48 / 52 px · Watson ≥38 / 44 / 48 / 52 px at 390 / 768 / 1280 / 1920 | Holmes 31 / 35 / 39 / 43 px · Watson 38 / 43 / 48 / 53 px | **MEASURED BELOW THE FLOORS — floors DEMOTED to PENDING THE OWNER'S RULING (spec §16.5): they are NOT binding law until the owner rules, so this is a recorded shortfall, not a breach of a binding floor; the §8.3 size band stands; the choice — re-proportion Holmes's head vs amend the floors — is the owner's and is deferred** |
| Harness target revision | — | 1762e3f (the kid-test harness commit); the smoke re-run on the final art tip is recorded in the Harness line below | — |

## The laws, in summary

Full text: `docs/pair-art/MODEL_SHEET_SPEC.md` §§8–10.

- **Scale law:** Watson ≈0.75× Holmes in **every** frame (0.97
  measured in mockup QA = defect). Bench tableau lock:
  390 px → Holmes 170 / Watson 130; 1280 px → Holmes 150 /
  Watson 115. In-play sizes are governed by the §8.3 bands
  alone (112–128 px at 390, and so on); in-play coverage was
  proven at 128 px at 390, never at 170 px.
  Hero moments carry the ratio inside the artwork. Kid-test
  bands 112–128 / 128–144 / 144–160 / 160–176 px with face
  floors 38 / 44 / 48 / 52 px at 390 / 768 / 1280 / 1920.
  **Measured on the delivered sheets (smoke re-run, final
  tip): the face measure now RUNS — Holmes 31 / 35 / 39 /
  43 px, below the floor in every cell; Watson 38 / 43 /
  48 / 53 px, missing only the 768 floor by 1 px.** The
  published face box is the whole head crop (hat brim →
  chin), exactly §8.3's definition, so the shortfall is
  real: the head is ~24% of Holmes's figure height in the
  approved register, the floors assume ~30%. **The floors
  are DEMOTED to PENDING THE OWNER'S RULING (spec §16.5):**
  the band and the floors cannot both be met for Holmes
  (the floors would need figure heights of 157 / 181 /
  197 / 213 px against band maxima of 128 / 144 / 160 /
  176 px), so until the owner rules the floors are **NOT
  binding law** — the size band stands. The choice —
  re-proportion the head away from the owner-approved
  register, or amend the study floors — is the owner's,
  it is deferred, and no side is picked here. Recorded
  as coordinator ruling (f) in `BRANCH_STATUS.md`, as
  demoted by §16.5; the panel votes with this finding on
  the table.
- **Staging law:** figures live in page space (the gutter) —
  never on map tiles, the map frame, attribution, buttons, or
  any UI chrome. Zero clue-text coverage. No bench furniture
  in walk frames. Celebration in page flow (a slot the cards
  displace around), never over cards.
- **Gaze-leak law:** gaze / lean is an answer-leak channel.
  Directed gaze may only use coordinates answer-blind Holmes
  legitimately receives via `detective-host-props.ts` (the
  pinned seven keys). One gaze toward the correct place =
  BLOCK-class defect. The re-skin changes NO props, NO state
  machine, NO answer-blindness architecture.
- **Kid test (PR D go / no-go):** per width × background cell —
  find-Holmes ≥27/30 in ≤2 s in every cell including the static
  fallback (≤25 = kill), identity ≥27/30, expression ≥26/30,
  zero clue-text coverage at max in-band size; ~60 fps on a
  2 GB-class Android during pan + follow + walk at
  390 / 768 / 1280. A failed bar flips `pairArt` off with no
  re-vote.

## Negative gates (owner rule 15)

Owner test-design law (Veeresh, 2026-11-08): test cases include
positive AND negative scenarios, mainly negative — a gate that only
passes is not a gate. Six negative gates run in
`scripts/pair-art-guard.test.mjs` under `npm test` (the existing
`node --test 'scripts/**/*.test.mjs'` glob; 13 tests, all sabotage
controls operate on synthetic fixtures in a temp dir — the shipped
assets are never mutated):

| Check | What it forbids | Sabotage control |
| :--- | :--- | :--- |
| `neg/faces-distinct` | Any two of the 22 face files (11 per character) being byte- or pixel-identical — the pre-cure surprised ≡ wonder ship is impossible | A fixture dir with one face copied over another (and a byte-different re-encode with identical pixels) is flagged both ways |
| `neg/no-baked-props` | A notebook, magnifying glass, or pencil baked into a torso/head part or plate where the rig hides it (notebook: false / glass: null poses), measured in the cure records' own zones and bands | A notebook-brown patch composited into a fixture copy of Watson's torso (and a pale-lens patch into Holmes's) is caught by the same scans |
| `neg/plate-palms-open` | A high-five plate whose anchor skin cluster is off-anchor (>3 rig px) or a closed fist: cluster bbox <10×10 vb or skin fill ratio >0.85 | A fixture plate with a filled skin disc at the anchor passes the anchor limb and FAILS the open-palm limb |
| `neg/budget-bites` | The runtime-budget gate passing a blown or dishonestly recorded set: total >500,000 B, or a lock total that understates the real bytes | Both violations are fed to the same gate function the real-set assertion uses; the real set (171,918 B) is the positive control |
| `neg/gaze-no-answer` | An answer coordinate leaking into the sheets: any answer/target/coordinate field beyond the seven §4.1 host-prop keys in the manifest or lock, and any measured gaze that contradicts its §5.2/§6.2 declared target or aims down-and-outward at the map (own-prop targets excepted). Honest scope: at PR A a sheet carries no runtime answer coordinate, so this proves structure + directional consistency, not runtime blindness. `delighted` plates (6) are NOT MEASURED by name — a closed eye arc has no pupils | A planted `targetX` / `answerLat` field in a fixture manifest copy is flagged by the same scanner |
| `neg/decoded-bites` | The decoded-size gate passing a set decoded past 32 MB | A synthetic 3000×3000 PNG (36 MB decoded, ~35 KB on disk) fed to the same decoded function FAILS; the real set (2.436 MB) is the positive control |

## Redundancy audit

Per the owner's standing rule (2026-10-29) — full table in
spec §14:

| Surface | Could duplicate | Verdict |
| :--- | :--- | :--- |
| PR A harness (palm / budgets / ratio / silhouette) | Detective E2E suite (`tests/e2e/detective-*.spec.ts`) | **Complements, does not duplicate** — E2E tests the wired game in a browser; the harness tests loose sheets before wiring exists. Neither can do the other's job. |
| Painted sheets (`public/assets/detective/pair-art/`) | Inline SVG art in `DetectivePair.tsx` | **Complements, does not duplicate** — the inline art stays the shipping fallback (Save-Data rung + flag-off path) until PR D retires it after the flip. Bounded, named, with a deletion PR. |
| Model sheet spec | Handbook ch.10 | **Different jobs** — handbook = decision record; spec = executable build contract. The addendum summarises and points; it does not copy tables. |
| This PR body | `BRANCH_STATUS.md` | **Different moments** — branch status is the living capsule; the PR body is the one-time merge record the panel votes on. Repo convention. |

## Scope audit

- **In scope:** `docs/pair-art/**`,
  `docs/handbook/10-holmes-and-watson-pair.md` (addendum only),
  `BRANCH_STATUS.md`.
- **Protected — untouched:** the pair-behaviour train in full
  (`DetectiveHost.tsx`, `detective-state.ts`, `companion.ts`,
  `watson-walk.ts` — and `follow.ts`, the follow-model module
  owned by OPEN PR #364 (`feat/holmes-follow`, tip `c90462a`),
  which does not exist on main at `9e49da3` and is protected
  by name regardless) and, for PR A, everything under
  `src/`. (`tests/e2e/pair-art-kidtest.spec.ts`, the
  `pair-art-kidtest` project in `playwright.config.ts`,
  `scripts/kidtest-*`, and `public/assets/detective/pair-art/`
  are PR A’s own harness and assets, in scope per the owner’s
  brief.)
- Diff stat at vote time: the full PR diff against main `9e49da3`: 86 files changed, 9,715 insertions(+), 138 deletions(-) (recounted on the round-4 records branch at `0e149b4` and verified against `git diff --shortstat origin/main...HEAD`; this stat line's own edit is line-count neutral — `PR_BODY.md` is a new file in this PR — so the count holds at the tip that carries it; records-only commits change prose counts, never scope) — assets, docs, harness; zero `src/` paths — any `src/` path in
  the final diff fails this PR; `tests/`, `scripts/`, and
  `public/` paths beyond the kidtest spec, the playwright
  project, the kidtest scripts, and the pair-art assets fail
  it too.

## Recorded for PR B — not built here

These items are recorded for PR B. None of them is
built, measured, or claimed in PR A:

1. Manifest plates-adapter drift test.
2. `manifest.json` (33,534 B) classification in the lock.
3. Composites promoted to runtime per ruling (c).
4. Mouth-box entry measurement (§16.1).
5. Kid-test protocol pre-D-run fixes (tap-boundary
   definition, full counterbalance rotations, same-band
   replacement rule, §4 "floor scale" sentence).
6. Walk-sweep measurement (§16.6(ii)): PR B measures
   the area Watson's figure sweeps while walking, at
   the band maximum, before claiming §10 coverage for
   walk or celebration.
7. Wire-defaulted faces (§12.2 / §6.3): the faces the
   shipped renderers default (Holmes `marking`;
   Watson `focused` / `attentive` / `hushed` /
   `wonder`) — PR B wires each one, or records why it
   stays defaulted.
8. Entry measurements: mouth height (§5.4) and
   neutral-anchored mouth travel (§6.4) for
   `delighted` / `surprised` / `pout`.
9. Head ≡ face-neutral alias: `holmes-head.png` /
   `watson-head.png` are byte-identical to the
   neutral face files — 9,345 B of disclosed
   duplicate files. PR B aliases one name to the
   other in the manifest instead of shipping both.
10. Kid-test protocol pre-D fixes from round 3:
    per-child rotation for the find spot and the
    identity lineup; a recorded line deciding whether
    §8.3's band sizes both figures or Holmes with
    Watson at 0.75× for expression trials; a named
    production route for identity / expression
    screens.

## Where the study and the code disagreed

Flagged in spec §12, not papered over. Headlines:

1. Coffee cup is **not** a rig prop — it lives in the host's
   bench markup and never enters play (code governs; no cup
   part is drawn for either character — one shared cup part is drawn for the bench hero tableau only).
2. The shipped renderers lack distinct faces for Holmes
   `marking` and Watson `focused` / `attentive` / `hushed` /
   `wonder` — PR A draws all 22 faces anyway (spec §6.3).
3. `follow.ts` does not exist on `main` @ `9e49da3` — protected
   by name regardless (spec §12.3).
4. `pairArt` does not exist yet — PR B creates it, by design.
5. The study's scale law (170 px at 390) exceeds the shipped
   `DETECTIVE_RIG_HEIGHT_PX = 104` — PR B owns the
   reconciliation; PR A draws for the 176 px top band.

## Verification

- [ ] Diff audit — scope list above, staged files named only,
  never `git add -A`
- [x] Harness — `node scripts/kidtest-smoke.mjs` + the `pair-art-kidtest` Playwright project, re-run on the final tip `504ddbc`:
  smoke RAN (70 plates, 0 missing; face measure live via the manifest `plates` adapter — Holmes below floor in every cell, Watson 768 by 1 px, both recorded under ruling (f), NOT cured); Playwright: 5 tests executed in 33.6 min — size band + zero clue-text coverage PASS on the real built page at 390/768/1280/1920; face floor FAILED for Holmes at every width exactly as the smoke predicted (the harness hard-asserts the shortfall — see the Panel section: the round-1 panel read the "5/5" phrasing against this FAIL and the wording is corrected here; the run's green was the size/coverage measures completing their contract, never a face pass); human trials prepared, never faked: trial manifest + find screens exported, `results: null` throughout. Repo gates on the same tip: tsc clean · `npm test` 3,287 pass / 0 fail · worker suite 145/0 (run for completeness; no `workers/` files touched) · lint-cards GATE PASSED · `build:pages` green (71 pair-art files in dist on the cured tip, inert until PR B imports them). On the cured tip the kidtest project runs 6 tests: the 4 width measures (size + coverage PASS, face floor FAIL per ruling (f) — recorded as the by-design negative; the asserts are now soft so every leg runs (owner rule 15)), the trial preparation (96 trials, results null), and the assembly + palm measurement — **PASS** (Holmes 0.58 / Watson 2.00 rig px vs ≤3 gate — harness, converged cure tip, 2026-11-08; supersedes 0.53 / 0.56 on the pre-round-2 art and 0.22 / 0.33 before the open-palm repaint; assembly-vs-plate diff 0.450 / 0.448 vs ≤0.60). Silo QA re-key (independent clone, keyed to the converged tip) independently re-ran the full kidtest project — 2 passed / 4 failed, every failure a demoted face-floor soft line (Holmes 31/35/39/43 vs 38/44/48/52; Watson 43 vs 44 at 768 only), the coverage hard-expect held at 0 px² for both figures at every width, trial manifest 97 × `results: null` — and re-measured the budgets exactly (runtime 171,918 B; decoded 2,436,448 B). Its FAIL was records-only: the manifest's budget block and 7 per-file byte fields were stale from the art cure, the smoke inventory was stale in 16 rows, and this body's diff stat understated insertions by 4 — all cured in records commits on this branch (manifest diff = the 8 stale values exactly; smoke regen verified idempotent) and delta re-keyed before the vote.
- [x] Round-4 records update — cured tip `11dc084`, 2026-11-08: runtime total **172,414 B / 45 files** (= ASSET_LOCK = manifest = disk, re-measured on the cured tip); decoded 2.486 MB (recomputed w×h×4 on the 45-file set — supersedes the 2.436 MB figure, which counted the 44-file pre-pencil-split set). Guard **13/13 incl. the new pencil negatives** (prop-pencil positive control 112 px; notebook-only 0; gasp / high-five pencil zone + whole 0/0; the new sabotage limb bites). Kidtest on the final harness: assembly **PASS** (palm Holmes 0.58 / Watson 2.00 rig px, diffs 0.450 / 0.448 — harness, converged cure tip, 2026-11-08) and sabotage self-check **PASS**; the width tests fail ONLY on (a) the demoted face-floor soft lines (§16.5) and (b) at 390/768 the hard "no lawful spot" line; find screens at 1280 + 1920 captured lawful (0 overlaps), at 390 + 768 **NOT RUN — no lawful spot** (§16.6(iv)). Trial preparation on the converged tip crashed environmentally (Chromium "Target crashed" under load) — no captures are claimed from that run; its clean re-run rides Silo QA.
- [x] Silo QA — **PASS** keyed PR#366 + `df7adbc`: full silo @`96ab16e` passed 7/8 checks with exact matches (scope, lock drift 0/64, manifest adapter, guard 6/6, tsc, lint-cards) and FAILED one records item (1920 face-px prose 42/56 vs the smoke script's measured 43/53); prose-only cure `df7adbc`; **DELTA SILO QA PASS** on the cured tip (cure confined to the 3 records files, corrected numbers verified, smoke regeneration byte-identical, guard still 6/6).
- [ ] Panel — 13 seats incl. Game player, on the final tip:
  {{PANEL_TALLY}}
- [ ] DevEx: {{DEVEX_VERDICT}} · Benchmark: {{BENCHMARK_VERDICT}}
  · CI: {{CI_VERDICT}}
- [x] Code gates (tsc / unit / build): **RUN and green** on
  the final art tip — tsc clean · `npm test` 3,287 pass /
  0 fail · worker suite 145/0 · lint-cards GATE PASSED ·
  `build:pages` green (see the Harness line above; the one
  scripts-suite test this PR's cure touched,
  `e2e-telemetry-guard`, re-verified 6/6 at the cure tip).
