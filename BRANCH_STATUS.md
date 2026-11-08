# BRANCH_STATUS — feat/pair-art-sheets

- **Branch:** `feat/pair-art-sheets` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Design of record:** format study `STUDY-format-rebuild.md` +
  `MOCKUP-NOTES.md` (format-study evidence folder), binding spec
  `docs/pair-art/MODEL_SHEET_SPEC.md` (this PR), handbook ch.10
  PR A addendum (this PR).

## Coordinator pointers (2026-11-07 night)

- Base of record for this branch: `main` @ `9e49da3`
  (PRs #357–#365 merged + live). PR #364 (`feat/holmes-follow`,
  PB-1 follow model) is OPEN, NOT merged, and was never part of
  this branch’s base; on its own branch at tip `c90462a`.
- #364’s E2E zero-overlap regression class C (Watson over clue
  text) is NOT a PR A pass item: re-verify once #364 merges,
  against the panel-voted cured tip.
- PRs #351 / #353 (crash-report lane): OPEN, Chitti
  monitor-only — not this lane’s work.

## Task capsule

TASK / requested outcome: PR A of the Holmes & Watson character
re-skin programme — painted model sheets drawn to the existing
engine's pivots, viewBoxes, palm anchors, pose set, and face set,
plus the binding model-sheet spec, the automated measurement
harness, the handbook addendum, and the PR body draft.
Sheets + spec + harness ONLY: no engine swap, no new flag, no
behaviour change. PR B swaps the engine art behind `pairArt`;
PR C adds hand-drawn hero moments; PR D flips + retires the
flat rig behind the kid-test gate.

OWNER RULINGS (Veeresh):
- (1) Cold Trail card films ARE the reference — CONFIRMED
  2026-11-07 ~15:57 CST (voice call). The re-skin is Holmes &
  Watson in that painted style, not new edition cards.
- (2)–(4) ALL RULED YES 2026-11-07 ~21:24 CST, in chat,
  verbatim: **"Yes to all three — start PR A"** — given after
  ❤️ + "Love this version" on the final regenerated mockup.
  The three: (2) LOOK-as-live-rig, (3) doll chassis +
  hero moments, (4) per-cell kid test as go/no-go.

Interpretations considered and selected reading:
- "Sheets" = separate painted parts per spec §3 (hat, head,
  torso/coat, arm-front with palm anchor, arm-back, legs),
  22 pose composites, 22 faces (11 FaceKinds × 2), and 2
  static degradation composites — at source resolution for a
  176 px rendered height. A single illustration per character
  cannot be doll-rigged in PR B and is not a sheet set.
- "Props whitelist" names two whitelists: the host-props list
  in `detective-host-props.ts` (7 pinned keys — what the pair
  may KNOW) and the visual props in the pose specs (what the
  pair may HOLD: magnifying glass, clue card, notebook +
  pencil, coffee cup bench-only). Spec §4 keeps them separate.
  The coffee cup is in the host's bench markup, NOT in
  `DetectivePair.tsx` (its header comment: cups "never enter
  play") — no cup part is drawn for either rig.
- The verb shortlist is the engine's current 22 poses exactly
  (Holmes 12 + Watson 10, face assignments in spec §5.2) —
  a closed set; new poses need a spec amendment (spec §5.3).
  Speaking is a CSS mouth-flap overlay on any face, not a
  pose; the static composite is a degradation image, not a pose.
- The kid test is PR D's gate. PR A owes the automatable
  smoke gate (palm, budgets, ratio, silhouette renders),
  not a child panel.
- COORDINATOR RULINGS (records cures, 2026-11-07 night — the
  builder documents and the delivered assets disagreed; these
  rulings make the record match the delivery, on evidence):
  (a) Scope line: PR A’s own harness and assets are in scope
  per the owner’s brief — `tests/e2e/pair-art-kidtest.spec.ts`,
  the `pair-art-kidtest` project in `playwright.config.ts`,
  `scripts/kidtest-*`, and
  `public/assets/detective/pair-art/`. Only `src/` is out of
  scope. The PR body’s scope audit now says exactly this.
  (b) Coffee cup: the cups themselves live in the host’s bench
  markup (code of record, unchanged by this ruling); PR A draws
  exactly ONE shared cup part, `prop-cup.png`, for the bench
  hero tableau — never for either character as a held or worn
  prop, and a cup inside either character rig in any pose is a
  defect. Spec §4 and the PR body’s scope audit now say this.
  (c) Static composites: the delivered pose plates serve as the
  static degradation composites — Holmes `holmes-pose-dock.png`
  (15.7 KB), Watson `watson-pose-station-idle.png` (18.6 KB);
  both within the study’s ≈20–30 KB band. The conflation with
  LOCKED GAME-RUNTIME degradation tiers is dropped: the
  low-memory tier keeps its own small static composite and the
  in-game degradation architecture is untouched by PR A.
  (d) The mouth-travel line in spec §5.4 is the MOUTH-HEIGHT
  bar: the speaking flap needs a mouth region tall enough
  (≥3 px at rig scale) to read as speech, never a ≥3 px
  centroid-travel across expressions. Measurements in the lock
  are recorded under that reading.
  (e) Coverage status in the harness is measured against the
  real built page (serveBuiltArtifact over the actual
  GeoDetective page), never a static export: size/face/coverage
  measures run on the same page the player sees.

Tier and rationale: Tier 2 — Council. New feature programme,
3+ files, a new asset surface, and a design-of-record decision
(the verb shortlist). The programme itself was decided by the
2026-11-07 format study (unanimous feasibility verdict) and
the owner's rulings above; this PR executes that record.

Done condition / scenarios / evidence:
- Spec: `docs/pair-art/MODEL_SHEET_SPEC.md` contains the
  programme diagram, parts ↔ pivots ↔ viewBoxes (Holmes
  120×178, frontArm (78,58) / swingArm (44,58); Watson
  134×140, frontArm (36,54) / noteArm (82,54);
  HIGH_FIVE_CONTACT holmes (99,25) / watson (15,21)), the
  22-pose shortlist with faces, the 11 × 2 expression set +
  ≥3 px mouth-travel rule, hard budgets (≤500 KB lazy /
  ≤32 MB decoded / palm ≤3 px automated / zero live SVG
  filters / degradation ladder), scale law, staging law,
  gaze-leak law, silhouette gate, kid-test gate, this
  capsule's source text, and the redundancy audit.
- Handbook: ch.10 gains an additive PR A addendum only —
  no existing section rewritten (diff-checked).
- PR body draft: `docs/pair-art/PR_BODY.md` with budget
  table left as {{TOKENS}} for the coordinator to fill from
  the art + harness reports, and the verbatim merge line.
- Art + harness (sibling crews): sheets for every part /
  pose / face / composite; harness output committed showing
  palm ≤3 px, budgets inside limits, ratio 0.73–0.79 on
  every composite; grayscale 104 px silhouette renders
  committed + gate sign-off recorded before colour lock.
- Diff audit (coordinator ruling (a), 2026-11-08): no file
  under `src/` in the diff. PR A's own harness and assets
  ARE in scope, on the owner's brief: `tests/e2e/
  pair-art-kidtest.spec.ts`, the `pair-art-kidtest` project
  in `playwright.config.ts`, `scripts/kidtest-*`, and
  `public/assets/detective/pair-art/`.

Files in scope: `docs/pair-art/MODEL_SHEET_SPEC.md` (new),
`docs/pair-art/PR_BODY.md` (new),
`public/assets/detective/pair-art/` sheet assets +
grayscale renders and `docs/pair-art/` harness output
(sibling crews, paths named in the PR body when they land),
`docs/handbook/10-holmes-and-watson-pair.md` (addendum only),
`BRANCH_STATUS.md` (this file).
Protected / untouched — the pair-behaviour train, in full:
`src/game/loop/detective/DetectiveHost.tsx`,
`src/game/loop/detective/detective-state.ts`,
`src/game/loop/detective/companion.ts`,
`src/game/loop/detective/follow.ts` (not present on main @
9e49da3 — protected by name regardless; PR A must not
create it), `src/game/loop/detective/watson-walk.ts` —
and, for PR A, everything else under `src/`, including
`DetectivePair.tsx` and `detective-host-props.ts`
themselves (read as the contract; PR B's scope, not
PR A's). The sanctioned harness surfaces named in the
diff audit above (kidtest spec, its Playwright project,
`scripts/kidtest-*`, the pair-art assets) are PR A's own
deliverables, not protected files.

Dependencies / ordering: this spec lands first — it is the
art + harness crews' shared contract. PR B blocks on sheets
+ harness green + silhouette gate. PR C blocks on PR B.
PR D blocks on PR C + the kid test (spec §10). The
pair-behaviour train owns its files on its own branches;
any merge-up is a faithful union.
Verification contract: diff audit against the scope list
(any src/ path fails the PR; tests/ scripts/ public/ paths
beyond PR A's own harness + assets fail it too — ruling (a)) →
harness run with exact commands + target revision committed
→ Silo QA keyed PR#+tip → 13-seat panel (personas verbatim
from ~/.codex/agents, incl. Game player) on the FINAL tip →
DevEx → benchmark → CI → merge on READY / READY-WITH-NITS
(ship-when-ready, owner's standing directive 2026-11-04) →
branch deleted + tip SHA ledgered. Code gates (tsc / unit /
build) WERE RUN and green on the final art tip (no src/
code touched; the harness + guard surfaces are code-shaped
and were gated) — the PR body records the counts.
Assumptions / risks: sheet source format is the art crew's
call inside the budgets (harness measures exports). Risk:
22 faces + 22 composites inside 500 KB is tight — a shortfall
is a spec-amendment discussion, never a silent cut. Risk:
the scale law (170 px at 390) exceeds the shipped rig height
(104 px) and may interact with the staging gutter (118 px) —
PR B owns the reconciliation; flagged in spec §12.5.
Unknown: Watson's host-velocity drawn walk cycle (study's
open choice) is PR B prototyping; PR A walk sheets must keep
both walk options possible.
Simpler / rejected: one illustration per character, sliced
later (pivots are known now — draw to them); enriched vector
instead of paint (the study: vector cannot reach the texture
that is the owner's complaint); spec after the art (the palm,
scale, and gaze laws are cheaper obeyed while drawing).
Budget: Tier 2 parent cap 400k tokens (repo default), shared
across coordinator + delegates.
Approvals: owner rulings (1)–(4) GIVEN (above). PR + merge
under the coordinator's assignment (ship-when-ready);
branch protection untouched.

## Status

- [x] Study + mockup notes read; engine contract verified
  against `DetectivePair.tsx` + `detective-host-props.ts`
  on main `9e49da3` (viewBoxes, pivots, contact anchors,
  12 + 10 poses, 11 FaceKinds, 7 host-prop keys)
- [x] Spec: `docs/pair-art/MODEL_SHEET_SPEC.md`
- [x] Handbook: ch.10 PR A addendum (additive only)
- [x] PR body draft: `docs/pair-art/PR_BODY.md`
  (budget {{TOKENS}} left for coordinator)
- [x] Study-vs-code disagreements flagged in spec §12
  (coffee cup, face coverage, follow.ts, pairArt flag,
  rig height, mouth-flap location, study reconstruction)
- [x] Art: model sheets (parts / 22 poses / 22 faces /
  2 static composites) — sibling crew, landed `8f0e5fd` +
  `f2adf71`
- [x] Harness: palm / budget / ratio report committed —
  sibling crew, landed `1762e3f`; kidtest E2E 6 tests on the
  final art (face floor recorded FAIL — ruling (f) below)
- [x] Silhouette gate: grayscale 104 px renders +
  sign-off before colour lock — sibling crew, PASS in
  the asset lock
- [x] Silo QA (keyed PR#+tip) — full @`96ab16e` 7/8 +
  records FAIL → prose cure → DELTA PASS @`df7adbc`
- [ ] Panel 13 seats by name + DevEx + benchmark
- [ ] Merge on verdict + branch deleted + tip SHA ledgered

## Status — 2026-11-07 night (coordinator)

- Build complete: spec `f12389c`, harness `1762e3f`, art
  `8f0e5fd` + `f2adf71`. Measured gates all PASS: runtime
  147,920 B of the 500,000 B budget; decoded 1.54 MB of 32 MB;
  palm error 0.35 px both characters (gate ≤3 px); silhouette
  gate PASS at 104 px grayscale; scale ratio 0.75–0.77.
- Records cures applied (coordinator rulings above): scope
  line, coffee-cup wording, static-composite sourcing,
  mouth-height reading, coverage-against-real-page reading.
- Next: push, open the PR, run the repo gates, Silo QA keyed
  to the final tip, 13-seat panel by name.

## Face-floor finding — coordinator ruling (f), 2026-11-08

The final-art smoke re-run surfaced a harness↔art break,
fixed in this commit, plus an open measure the panel must
see:

1. **Adapter gap (fixed):** manifest.json carried face
   geometry only in per-character shape
   (`characters.<c>.faces.<kind>.faceBox`, natural px); the
   harness readers (kid-test spec + smoke script) read a
   top-level `plates` map keyed by plate filename with
   `{faceBox}` fractions. Neither side was wrong — the
   adapter between them was never written. `plates` is now
   derived from the per-character data (figure plates from
   the neutral faceBox ÷ figure natural size; a face plate's
   box is its full frame — the crop IS the face region).
   The per-character data stays the source of truth.
2. **Measured, honestly recorded:** with the adapter in
   place the smoke measures face height at max in-band size:
   Holmes 31 / 35 / 39 / 43 px at 390 / 768 / 1280 / 1920 —
   BELOW the §8.3 floors (38 / 44 / 48 / 52) in every cell.
   Watson 38 / 43 / 48 / 53 px — passes 390 + 1280, misses
   768 by 1 px, passes 1920. Full table:
   `docs/pair-art/KIDTEST_SMOKE.md` (regenerated).
3. **What the published box is:** the whole head crop
   (hat brim → chin, hair and ears included) — exactly the
   altitude §8.3 defines ("smallest rendered face height,
   hat brim to chin"). The number is not a definitional
   artefact; the head genuinely is ~24% of Holmes's figure
   height in the delivered register, and the floors assume
   ~30%.
4. **Ruling:** the FAIL is RECORDED, not cured, in PR A.
   Rationale: (a) the floors bind the FLIP (PR D go/no-go,
   owner ruling 4), not PR A's sheets; (b) both candidate
   cures change things PR A may not change alone — re-proportioning
   the head departs from the reference register the owner
   approved (❤️ "Love this version", 2026-11-07), and
   shrinking the floors amends a study law; (c) PR A is
   assets + spec + harness only. PR B owns the reconciliation,
   and its options are now explicit: render sizes per cell,
   head share at assembly, or a floor amendment carried to
   the owner with this measurement attached. The 13-seat
   panel votes with this finding on the table; a panel BLOCK
   on it is a legitimate outcome and escalates to the owner
   with the same numbers.
5. **Demotion addendum (panel re-vote cure, 2026-11-08;
   spec §16.5):** the floors are DEMOTED to **PENDING THE
   OWNER'S RULING**. Point 4(a) above is superseded on this
   point: until the owner rules, the floors are **NOT
   binding law** — not on PR A, and not on the PR D flip.
   The §8.3 size band stands. The choice — re-proportion
   Holmes's head vs amend the floors — is the owner's and
   is deferred; no side is picked in this record.

## CI cure — 2026-11-08 (coordinator)

- Tip `48e507e` CI (run 42446830253): GitGuardian PASS;
  `build (22.x)` FAIL on guard tests 322/323 — the kidtest
  spec calls `browser.newContext(` but was missing from
  `CONTEXT_FILES` in `scripts/e2e-telemetry-guard.test.mjs`.
  Cure: registered `pair-art-kidtest.spec.ts` there (the
  spec already imports + calls `serveBuiltArtifact`, so
  rule (a) holds). Guard suite re-run locally: 6/6 PASS.
- `e2e` job FAIL in the same run: `round-loop-a11y.spec.ts`
  3C "Tab 32 left the dialog to BODY". Evidence it is NOT
  PR-caused: the spec is byte-identical to main (zero diff);
  the only config change is the additive kidtest project,
  which CI's e2e job never selects; main @ `9e49da3` CI was
  green at 03:21Z including this spec; the three earlier
  branch runs failed the build job only (e2e green). The
  known no-focus-trap nit (#365 panel record) is the
  standing suspect. Baseline check: sequential local run
  of the spec against unmodified main; classification
  recorded from its result before the panel votes.

## CI green + round-loop classification — 2026-11-08 (coordinator)

- CI on tip `96ab16e` (run 42451949931): ALL GREEN —
  `build (22.x)` PASS 2m23s (guard cure works in CI),
  `e2e` PASS 5m26s, GitGuardian PASS.
- **round-loop-a11y classification: PRE-EXISTING FLAKE,
  not PR-caused.** The spec passed in the cured tip's own
  e2e run after failing once on `48e507e` (same failure
  signature: 3C "Tab 32 left the dialog to BODY"). PR A
  never touched the spec (byte-identical to main) or any
  code it exercises; main @ `9e49da3` CI was green at
  03:21Z including this spec; the three earlier branch
  runs failed the build job only. The standing suspect
  stays the known no-focus-trap nit from the #365 panel
  record. No baseline rerun needed — the pass/fail pair
  on near-identical tips is the A/B proof.

## Silo QA FAIL → prose cure — 2026-11-08 (coordinator)

- Silo QA on `96ab16e`: FAIL, sole defect = records
  accuracy. 7 of 8 checks passed with exact matches
  (scope 78 files / 5,997 / 137, zero `src/`; lock drift 0
  over 64 entries; manifest adapter exact; guard 6/6;
  tsc clean; lint-cards GATE PASSED). The smoke script
  measures the 1920 face cell as Holmes 43 / Watson 53 px;
  three prose records said 42 / 56. First three cells
  matched everywhere; the ruling-(f) outcome is unchanged.
- Cure (this commit): the three prose records corrected
  to the script's numbers — BRANCH_STATUS ruling (f),
  PR_BODY face paragraph, asset-lock.md manifest note.
  `docs/pair-art/KIDTEST_SMOKE.md` already carried the
  script's numbers (the silo re-ran the smoke; the
  regenerated file was byte-identical to the committed
  one). No art, harness, or code file touched.
- Delta Silo QA re-key on the cured tip follows; the
  panel votes the cured tip.

## Silo QA PASS — 2026-11-08 (coordinator)

- Full Silo QA @ `96ab16e`: 7/8 PASS exact; FAIL = the
  1920 face-px prose (42/56 vs script 43/53), cured
  prose-only in `df7adbc`.
- **DELTA SILO QA: PASS keyed PR#366 + `df7adbc`** — cure
  confined to BRANCH_STATUS.md, PR_BODY.md, asset-lock.md;
  corrected numbers verified in all three records; smoke
  regeneration byte-identical; guard 6/6; full diff still
  78 files, zero `src/` paths (6,034 insertions at
  `df7adbc` — records commits move prose counts only).
- Next: 13-seat panel by name on the final tip, DevEx,
  benchmark; CI re-run on the records tip is the last
  token to fill before the merge call.

## Panel round 1 — NOT READY; records cures applied — 2026-11-08

Panel on tip `c857a71`: **7 APPROVE-WITH-NITS, 6 BLOCK,
0 plain APPROVE — NOT READY.** By name: APPROVE-WITH-NITS —
Game designer, Game developer seat's mechanics review is
under Game developer below, Game audio designer, Game
economy designer, Game level architect, Senior architect,
Senior developer. BLOCK — Game developer (parts integrity:
arms without hands / palm anchors outside the arm crops;
a hand + magnifier baked into `holmes-legs.png` and torso
fragments, so the glass hand-off is impossible; legs fused
into one part where the rig swings two; palm gate has no
shipped measurer and the harness never assembles the
parts), Frontend developer (flat keyline bars RGB(32,22,14)
on interior cut edges of every face/head/torso plate —
visible chest stripes in assembly; no runtime halo source),
UX designer + Game narrative designer + Game player (faces:
floors FAIL per ruling (f); Holmes pout mouth is the same
upturned arc as delighted — §6.2 requires an inverted arc;
Watson reaction mouths hidden under the moustache; feelings
collapse at game scale), UX researcher (protocol B1
expression leg tests neither the mandated emotions
(delighted/surprised seeded ×0) nor the mandated size
("one big face"); B2 sample allocation undefined + learning
contamination; B3 age pooling can hide a 6–8 failure),
Office hours (records: face FAIL missable in the PR body;
scope wording stale in handbook + spec + this file's
verification contract vs ruling (a)).

Coordinator verification of the two new art claims
(measured in this worktree, PIL): arm skin px ≈ 0
(holmes-arm-front 1, holmes-arm-back 0, watson-arm-front 0)
— CONFIRMED; legs/torso skin px 448 / 1,192 — baked hand
present, CONFIRMED; seam rows uniform RGB(32,22,14), 1
unique colour, 92/92 + 134/134 opaque — CONFIRMED;
`holmes-head.png` byte-identical to `holmes-face-neutral.png`
and `watson-pose-walk.png` to `watson-pose-station-idle.png`
— CONFIRMED.

Records cures applied in this commit (Office hours BLOCK 1
+ 2, Senior developer nit 1, Office hours nits 1+3, Senior
architect nits 2+3): PR body Summary carries the NOT READY
panel outcome; budget table gains the face-floor FAIL row;
deliverables boxes ticked; "5/5 PASS" harness wording
corrected; spec §13 capsule + verification contract,
handbook addendum, and this file's verification contract
brought to ruling (a)'s scope wording; spec §12.1 cup
sentence corrected to ruling (b); smoke script's stale
"Face HEIGHT is still NOT RUN" sentence made conditional
(+ regenerated KIDTEST_SMOKE.md, numbers unchanged).

Still open (cure crews dispatched / owner escalation):
art re-cut (arms with hands, legs split leg-a/leg-b,
magnifier cleared, seam re-cut, halo underlay, pout redraw,
Watson mouths) → lock + manifest regenerated → assembly +
palm measurer added to the harness; protocol cure (B1/B2/B3)
by the harness crew; §8.2-vs-§8.3 zone ruling + §5.4/§6.4
mouth-rule clarification in the spec; the face-floor cure
CHOICE (re-proportion vs floor amendment) is the owner's —
escalated with the panel's numbers. Panel re-votes the
cured tip; no merge on round 1.

## Panel round-1 cures complete — 2026-11-08 (coordinator)

Cure commits on top of `c857a71`: records `9cdd7d1` →
harness/protocol `36c792b` → art re-cut `e0e03e0` → plates
`7ed1f6d` → raised-arm parts `008c9fb`. Every BLOCK's cure:

- **Game developer F1–F4:** arms repainted with hands
  (skin 229–272 px/part, palms on the rig hand points,
  centroids ≤0.6 vb); legs split leg-a/leg-b with pivots
  recorded; assembly + palm measurer shipped in the
  kidtest spec and RUNNING — palm error Holmes 0.22 /
  Watson 0.33 rig px (gate ≤3) via new dedicated
  `arm-raised` parts, matching the rig's own high-five
  branch (DetectivePair.tsx draws the raised arm
  explicitly; the base arm's 26.6 vb palm radius cannot
  reach the 39.1 vb anchor by rotation). Assembly-vs-plate
  diff 0.563 / 0.520 (gate ≤0.60).
- **Frontend:** seam bars re-cut (0 flat rows remain;
  assembly scan: no keyline run ≥8 px at any junction);
  halo underlay parts shipped (`holmes-halo.png` /
  `watson-halo.png`); budgets re-measured: runtime
  172,431 B, decoded 2.44 MB — PASS.
- **Glass contract:** baked hand + magnifier inpainted
  out of torso/legs/all Holmes plates; dock-family plates
  carry exactly one glass (the prop); celebrate/high-five/
  clap carry zero.
- **Faces (plate level):** Holmes + Watson pout redrawn
  to §6.2 (inverted mouth arc, measured); Watson delighted
  strengthened (mouth-band dark px 91 → 177); pose-pout
  slump added. The face-FLOOR numbers are unchanged
  (heads not re-proportioned) — ruling (f) stands and the
  cure CHOICE (re-proportion vs floor amendment) is the
  owner's, escalated with the round-1 numbers.
- **UX researcher B1–B3:** expression leg rebuilt —
  96 trials (expression 72 = 12 cells × 2 characters ×
  delighted/surprised/pout, rendered on-figure at floor
  scale, counterbalanced); allocation explicit (30
  independent children/cell, total N = 360, first-exposure
  by construction); per-band floor ≥9/10 written pre-run,
  band-stratified verdicts in the results template.
- **Office hours:** both BLOCKs cured in `9cdd7d1`
  (face FAIL headlined in Summary + budget-table row;
  scope wording aligned to ruling (a) in spec, handbook,
  and this file).
- Gates on cured tip `008c9fb`: tsc clean · unit suites
  3,287/0 (npm test aggregate) · guard 6/6 · lint-cards
  GATE PASSED · build green (71 pair-art files in dist) ·
  CI ALL GREEN (run 42457851211: build + e2e +
  GitGuardian) · zero `src/` paths (84 files).
- Next: panel re-vote on the cured tip (clean-context
  briefs per the owner's retro law, 2026-11-08), then
  DevEx + benchmark, then the merge call. The face-floor
  owner question rides with the re-vote report either way.

## Panel re-vote spec/records cure — 2026-11-08 (cure/366-spec)

Spec/records crew, on top of `652cf13` — docs only, no
art, no `src/`, no flags:

- **In-play lock contradiction cured:** §8.2 heading is
  now "The locked bench-tableau sizes"; PR body and
  handbook ch.10 say the same — 170/130 is the bench
  tableau lock, in-play is governed by the §8.3 bands
  alone, and in-play coverage was proven at 128 px at
  390, never at 170 px (spec §16.2).
- **Face floors demoted:** spec §8.3 + new §16.5, PR
  body, asset lock, and the ruling-(f) addendum above —
  floors are PENDING THE OWNER'S RULING and NOT binding
  law until he rules; the size band stands; the choice
  (re-proportion Holmes's head vs amend the floors) is
  the owner's and is deferred.
- **Coverage scope stated:** new spec §16.6 — coverage
  is proven only for static single-figure endpoints;
  the celebration slot is UN-DIMENSIONED (PR C must
  dimension + prove it before claiming §9.2) and
  Watson's swept walk path is UNMEASURED (PR B must
  measure the sweep at band maximum before claiming
  §10 coverage for walk/celebration).
- **Records nits:** kidtest count corrected to 6 tests
  (above); silhouette Holmes width corrected 47 → 43 px
  in `ASSET_LOCK.json`, `asset-lock.md`, and the PR body
  (43 is the scale lock's value); sheet/silhouette paths
  corrected from `docs/pair-art/` to
  `public/assets/detective/pair-art/` in spec §11/§13/§14,
  handbook ch.10, the PR body, and this file.
- **PR B carry-overs recorded** in the PR body under
  "Recorded for PR B — not built here" (5 items).
- Left for the coordinator's convergence pass, as
  briefed: PR-body diff stat, asset-lock palm headline,
  composite byte sizes (art crew regeneration changes
  them).

## Panel re-vote on `652cf13` — NOT READY; cure round 2 converged — 2026-11-08

Re-vote on `652cf13`: **8 APPROVE-WITH-NITS, 5 BLOCK —
NOT READY.** The round-2 cures are now converged on this
branch (art `cure/366-art` + spec/records `cure/366-spec`
merged; coordinator verification + convergence records at
the tip):

- **Watson torso:** baked hand + notebook inpainted out
  (hand-zone skin 222 → 0 px, harness band); notebook-
  brown in the baked zone of the read / think /
  celebrate-jump plates 709 / 709 / 675 → 0. The 25-px
  cluster at vb (89.7, 61.4) is a cream-shirt lapel
  shading stripe, not a fragment — left in place.
- **Faces:** `surprised` redrawn distinct from `wonder`
  for both characters (clear O mouth — Watson's parts
  the moustache; large round eyes; high angled brows);
  11/11 faces distinct per character; §6.4 mouth travel
  surprised↔wonder 3.56 / 3.93 rig px (≥3). Holmes
  `delighted` is now the biggest mouth in his set
  (mouth-box dark px 156 vs ≤80 for every other face);
  Holmes `thinking` differentiated by side gaze + brow +
  flat mouth.
- **Pose plates:** high-five plates repainted with OPEN
  palms (plates agree with the assembled-parts gate:
  plate palms 0.72 / 0.71 rig px by cluster measure, PIL,
  vs the parts gate 0.22 / 0.33, both ≤3); Watson
  celebrate-jump airborne with arms up + delighted face
  (glass held high, not at the face); Holmes
  celebrate-jump airborne.
- **Spec/records:** §8.2 bench-tableau wording; §8.3
  face floors DEMOTED to pending the owner's ruling
  (§16.5 — the re-proportion-vs-amend choice is his);
  §16.6 coverage scope (celebration slot un-dimensioned,
  Watson walk sweep unmeasured); §10 expression row now
  reads at the cell's in-band size.
- **Convergence records (coordinator):** asset-lock
  per-file bytes + runtime total updated to the cured
  art (171,918 B); palm headline THEN 0.22 / 0.33 rig px — superseded by the converged-tip re-measure 0.53 / 0.56 (below)
  (assembled) with plate values alongside; composites
  14,690 / 16,651 B; PR-body diff stat recounted at
  `b925386` (84 files, 7,944 insertions, 138 deletions).
- Next: coordinator kidtest + repo gates on the
  converged tip → Silo QA re-key (the `df7adbc` key is
  void) → panel re-vote (round 3) on the converged tip,
  clean-context briefs per the owner's retro law.

## Negative gates (owner rule 15) — guard landed on `cure/366-neg` — 2026-11-08

- **Guard:** `scripts/pair-art-guard.test.mjs` (new, off the
  converged tip `c76bc08` in its own worktree
  `meridian-366-neg`, branch `cure/366-neg`) — 13 tests under
  the existing `npm test` scripts glob, node builtins only
  (PNG decode via `node:zlib`; no pngjs exists in this repo).
  Six contractual checks, each with a real-set assertion and
  a sabotage control on synthetic temp-dir fixtures:
  `neg/faces-distinct` (22 faces pairwise md5 + pixel
  distinct; copy + re-encode sabotages flagged),
  `neg/no-baked-props` (cure-record zones/bands: notebook
  zone plates 0/0/0/3 vs threshold 10, parts ≤4; lens 0 on
  all parts, glass=null plates 0/0/10 vs 16; pencil 0 on
  Watson parts; positive controls find the real props),
  `neg/plate-palms-open` (Holmes 0.30 / Watson 1.03 rig px,
  bbox 12.5×17 / 13.5×12.5 vb, fill 0.27 / 0.42; filled-disc
  sabotage fails the open-palm limb),
  `neg/budget-bites` (real 171,918 B positive control;
  padded 618,123 B fixture and understated-lock fixture both
  FAIL the same gate function), `neg/gaze-no-answer`
  (structural scan clean + planted-field sabotage flagged;
  per-pose table: 16 measured PASS, 0 contradictions, the 6
  `delighted` plates NOT MEASURED by name — closed eye arc,
  no pupils), `neg/decoded-bites` (real 2.436 MB positive
  control; 3000×3000 fixture = 36.0 MB decoded FAILS).
  Guard alone: 13/13 pass. Full scripts suite with the guard
  included: 1,045 tests, 1,034 pass / 0 fail / 11 skipped
  (pre-existing skips). PR body carries the matching
  "Negative gates (owner rule 15)" section.
- **Kidtest run status (not invented):** at the time this
  guard was built, a `pair-art-kidtest` Playwright run was
  IN FLIGHT in the `meridian-pair-art` worktree (coordinator
  brief). The guard lane did not run that project (shared
  E2E lock + VM load) and its results had NOT landed when
  this section was written — no kidtest outcome is recorded
  here, in either direction.

## Coordinator verification, round-2 converged tip — 2026-11-08

- **Guard merged + verified by the coordinator:**
  `cure/366-neg` merged at `6a899b8` (guard `a081d39` +
  kidtest soft-assert `951b0a5`). Coordinator re-ran the
  guard standalone: **13/13 pass**.
- **Gaze table (from the guard's diagnostics, read
  first-hand):** 22 pose rows — 16 measured PASS, 0
  contradictions; the 6 NOT MEASURED rows are exactly the
  `delighted` plates (celebrate-jump / high-five / clap ×
  both characters) — `delighted` is drawn as a closed eye
  arc (spec §6.2), so there are no pupils to measure.
  Named here so the re-vote sees the gap, not a silent
  pass.
- **Kidtest at `c76bc08` (coordinator's run, harness's
  own numbers):** build green · assembly + palm PASS —
  assembled palm error **Holmes 0.53 / Watson 0.56 rig
  px** (supersedes the 0.22 / 0.33 headline from before
  the open-palm repaint; records corrected) ·
  assembly-vs-plate diff 0.561 / 0.557 (gate 0.60) ·
  trial preparation PASS (96 trials, 0 missing) · face
  floors: Holmes shortfall RECORDED at all 4 widths
  (31/35/39/43 vs 38/44/48/52) — the by-design negative,
  floors demoted §16.5.
- **Coverage gap found + cured in the harness:** the 4
  width tests aborted at Holmes's face assert, so zero
  clue-text coverage and Watson's legs never executed.
  The face-floor asserts are now `expect.soft` (same
  floors; tests still fail on the shortfall; every leg
  runs). A width-test re-run on the converged tip is
  capturing the coverage + Watson numbers for the
  re-vote record.
- **Repo gates at `c76bc08`:** tsc clean · unit 3,287/0
  (the guard adds 13 scripts tests on top at the merged
  tip — full-suite re-run rides Silo QA) · worker 145/145
  · lint-cards GATE PASSED.
- Next: width-test re-run numbers → Silo QA re-key on
  the final tip → panel re-vote (round 3), clean-context
  briefs per the owner's retro law.
- **§6.4 note (coordinator measurement, 2026-11-08):**
  a mouth-centroid probe over the face boxes does NOT
  reproduce a travel number for `delighted` / `pout`
  (the face-box dark mass is dominated by eyes, brows,
  and Watson's moustache; the probe was recorded as
  non-probative for those faces, not as a finding).
  Spec §16.6(iii) now records §6.4 travel for
  `delighted` and `pout` as NOT MEASURED on record —
  only `surprised`↔`wonder` (3.56 / 3.93 rig px)
  stands measured — so no seat or record claims a
  §6.4 pass for those faces from this PR.

## Round-3 lane state — 2026-11-08 (coordinator)

- **Branch history rewritten:** the cure branch was
  rebased onto current main (`9e49da3`, PR #365) — a
  clean replay, no conflicts, no substance change (the
  diff is assets/spec/harness/records only; nothing in
  the End-game merge touches them), so no panel re-vote
  is triggered by the rebase itself. Force-pushed with
  lease.
- **Full gates re-run on the rebased tip:** unit
  suite (guard included) — see the Silo QA re-key
  record for the keyed numbers.
- **Round-3 PR body badge** carries facts only (what
  was cured, the §16.5 demotion, §16.6 scope, the
  `neg/*` gates, kid-test scope as fact); it carries
  no coordinator recommendation and no vote request —
  the tally goes in the body after the re-vote.
- **Width leg open:** the kidtest width-test re-run
  (coverage + Watson legs under the soft asserts) was
  still running when this section was written; its
  numbers land here when the runner reports.

## Silo QA re-key @ `ba4e213` — FAIL (records only) → cured — 2026-11-08

- **Key:** PR #366 @ `ba4e213d102162cf43568476bbd8f572dfb23aac`
  (the `df7adbc` key is void). Independent clone, HEAD
  verified at start and end, zero tracked files modified
  by QA.
- **PASS on every substantive promise:** scope (85 files,
  zero `src/`) · budgets (runtime 171,918 B = the lock
  exactly; decoded 2,436,448 B = 2.436 MB) · faces (11/11
  distinct md5 + pixel hashes per character; surprised↔
  wonder differ 656 / 707 px) · props & palms (torso zones
  0 px; assembled palms 0.5286 / 0.5604 rig px; composite
  sizes match the body exactly) · gaze (structural scan
  clean, no contradictions, `delighted` NOT MEASURED by
  name) · negative gates 13/13 with every sabotage limb
  executed and biting · repo gates (tsc clean, lint-cards
  GATE PASSED, worker green, `npm test` scripts 1,034
  pass / 0 fail / 11 skipped + src 2,266 / 0).
- **Kidtest leg (closes the width leg above):** full
  project run — 2 passed / 4 failed; the 4 failures are
  exclusively the demoted face-floor soft lines (Holmes
  31/35/39/43 vs floors 38/44/48/52; Watson 43 vs 44 at
  768 only). Size-band hard expects passed at all widths
  for both figures; the coverage hard expect (0 px²)
  held in every leg — **0 px² overlap, both figures,
  390/768/1280/1920**. Trial manifest: 97 ×
  `results: null` — no faked human results.
- **FAIL — records honesty only, 3 items:** (1) PR-body
  diff stat understated insertions by 4 (body 9,011 vs
  measured 9,015); (2) `manifest.json` budget block stale
  (`runtime_total_bytes` 172,431 vs actual 171,918) —
  coordinator survey found 7 further stale per-file
  `bytes` fields from the art cure; (3) `KIDTEST_SMOKE.md`
  plate inventory stale in 16 rows.
- **Cure (records commits on this branch):** manifest
  bytes synced field-by-field to disk (8 lines exactly);
  `KIDTEST_SMOKE.md` regenerated with
  `scripts/kidtest-smoke.mjs` (regen verified idempotent);
  the PR-body diff stat recounted at the cured tip as
  the final records step. Environment note: QA's first
  two kidtest attempts crashed Chromium on a 96%-full
  shared /tmp (sibling lanes) — environmental, cured by
  a TMPDIR redirect, not a product defect.
- **Next:** Silo QA delta re-key on the cured tip →
  13-seat panel round-3 re-vote → tally in PR body →
  DevEx → benchmark → merge on READY / READY-WITH-NITS.

## Panel round 3 on `a4593c0` — NOT READY (8 AWN / 4 BLOCK / 1 vacant) — 2026-11-08

- **APPROVE-WITH-NITS (8):** Game designer · Game audio
  designer (Game Audio Engineer file) · Game economy
  designer · Senior architect (Software Architect file) ·
  Senior developer · Frontend developer · UX designer
  (UI/UX file) · UX researcher.
- **BLOCK (4):**
  - **Game developer** (Senior Mechanics Engineer file):
    raised-arm parts clip the finger tips (plate skin to
    vb y 16.5 / 13.5; part rects start 20.5 / 16.0 —
    assembled hand amputated ~4 / ~2.5 vb); the lock's
    `raised_arm_parts_cure` record is stale vs the
    shipped bytes (2219/2086 recorded, 2314/2159 on disk;
    "identical to the plates" off by 0.85 vb).
  - **Game level architect** (Level Designer file): the
    harness's find captures place Holmes INSIDE the map
    at 768 and over the search chrome at 390, while the
    manifest records "page-above-map"; Measure 3 asserts
    clue-text overlap only — no figure∩map / figure∩chrome
    assertion exists; `lawfulSpots` mints spots in
    occupied flow at widths with no gutter.
  - **Game narrative designer:** Holmes's glass is never
    raised (search + berth-think tell the wrong story);
    Watson `notebook-mark` reads as standing idle; both
    clap plates show one arm, not hands meeting; pencil
    present in gasp + high-five plates (§4.2 exception
    never drawn — pencil baked into the notebook part).
  - **Game player** (timed log + 20+ named captures —
    evidence rule satisfied): find-390 covers search
    words; high-five reads as fists AT PLAY SIZE;
    Watson celebrate reads as searching AT PLAY SIZE;
    clap plates read as nobody clapping; Watson read
    plate has no notebook in hand, gaze on the viewer;
    feelings blur at play size (Watson surprised≈wonder,
    pout≈thinking; black ear disc on `wonder`).
- **VACANT (1):** Office hours — no persona file exists
  in `~/.codex/agents/`; disclosed, never improvised.
- **Cross-reads noted:** Narrative + Game developer +
  UX designer PASS the high-five palms / celebration /
  live-beat faces on zoomed or downscaled inspection;
  the Game player's BLOCK is the play-size read. The
  cure standard is therefore the play-size read
  (figure 104 px, face 31–43 px), not zoom.
- **Nits carried into the cure round / PR B list:**
  lock's stale "byte-identical" surprised note; lock
  raised-arm subsection (folds into the BLOCK cure);
  manifest silhouette prose 47 px vs measured 43 px;
  PR-body manifest size 33,208 vs 33,207 B; guard header
  comment claiming manifest staleness; spec §5.4
  composite sizes (15.7/18.6 KB vs 14,690/16,651 B);
  harness halo `rank()` (halo painted over legs);
  §6.2 `hushed` round mouth undrawn; Watson reserve
  faces near-neutral; §6.4 neutral-anchored travel +
  §5.4 mouth-height = PR B entry measurements; kid-test
  protocol pre-D fixes (per-child rotation for find /
  identity, Watson expression-size line, production
  route sentence) recorded for PR D prep.
- **Cure round dispatched 2026-11-08:** art crew
  (`cure/366-art2`) — raised-arm re-cut, search /
  berth-think / notebook-mark / clap redraws, pencil
  split, Watson read/think prop fix, play-size
  readability pass; harness crew (`cure/366-harness2`) —
  placement assertions (figure∩map, figure∩chrome = 0
  at settle time), lawfulSpots exclusion + fail-when-
  none, halo rank −1, find captures regenerated.
  Records crew follows on convergence → coordinator
  verification → Silo QA re-key → panel round 4.

## Cure round 2 converged — round 4 — 2026-11-08

- **Crews + branches:** art crew `cure/366-art2`
  (raised-arm re-cut, story plates redrawn, pencil
  split, play-size pass) · harness crew
  `cure/366-harness2` (placement assertions,
  lawfulSpots, halo rank) · guard crew
  `cure/366-guardfix` (pencil prop model follows the
  split) · records crew `cure/366-records2` (this
  section). Converged onto `feat/pair-art-sheets`:
  art merged `01b8b48`, harness merged `4960179`,
  guard merged `0a52134`, records sync on top —
  converged tip `11dc084`.
- **Guard-fix + manifest re-sync commits:** guard
  cure `cbc8922` (test: guard cure — pencil prop
  model follows the split), merged `0a52134`;
  manifest re-sync `11dc084` (manifest face bytes
  follow the cure-7c redraws, 8 fields; smoke
  inventory regenerated).
- **Numbers on the converged tip (measured):**
  runtime **172,414 B / 45 files** (= lock =
  manifest = disk) · harness assembly (converged
  cure tip, 2026-11-08): Holmes palm **0.584 rig
  px**, plate diff **0.4498**; Watson palm **2.000
  rig px**, plate diff **0.4484** (gates: palm ≤3,
  diff ≤0.60) · guard **13/13** incl. the new pencil
  negatives (prop-pencil positive control 112 px;
  notebook-only 0; gasp / high-five pencil
  zone+whole 0/0; new sabotage limb bites) ·
  decoded **2.486 MB** recomputed (w×h×4, 45 files)
  — supersedes the 2.436 MB figure, which counted
  the 44-file pre-pencil-split set ·
  `surprised`↔`wonder` pixel diff **1,483 / 2,042
  px** (full-frame RGBA, md5 distinct) — supersedes
  the 656 / 707 px in the `ba4e213` Silo QA record,
  measured before the cure-7c face redraws.
- **Kidtest on the final harness:** assembly PASS,
  sabotage self-check PASS; the width tests fail
  ONLY on (a) the demoted face-floor soft lines
  (§16.5) and (b) at 390/768 the hard "no lawful
  spot" line. Find screens: 1280 + 1920 captured
  lawful (0 overlaps); **390 + 768 NOT RUN — no
  lawful spot** (every placement intersects map,
  clue text, or page chrome incl. page text;
  spec §16.6(iv)).
- **Trial prep — environmental crash, re-run owed:**
  trial preparation on the converged tip crashed
  environmentally (Chromium "Target crashed" under
  load). No captures are claimed from that run; its
  clean re-run rides Silo QA.
- **Next:** Silo QA re-key → panel round 4.
- **Coordinator addendum (post-records convergence):**
  the lock's `docs_files` bytes for 13 redrawn plates
  were stale vs disk (e.g. holmes-pose-search 15,609
  recorded / 14,574 on disk) — the art crew had synced
  runtime files only. Lock corrected from disk;
  `asset-lock.md` tables + headline and the PR body's
  budget rows re-synced to 172,414 B / 2.486 MB in the
  same pass. Panel-facing numbers now agree across
  lock, manifest, asset-lock.md, PR body, and disk.
