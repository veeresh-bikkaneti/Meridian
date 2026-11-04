# BRANCH_STATUS — feat/band-motion-variants

- **Branch:** `feat/band-motion-variants`
- **Base:** `main` @ `5b6dcac` (#324 smooth cards + #328 locked tile, merged)

## Task capsule

TASK / requested outcome: Band-motion port, Units 2–3. Wire two
band-selected film variants through the existing card-media.ts swap
point: Little Explorer ("5-7") Cold Trail gets the softer prep film;
Trail Scout ("8-10") Review gets the regenerated prep take,
re-encoded at slot size. Every other band keeps the shipped films.
Builder silo: build, open the PR, stop. NO MERGE without the
owner's per-PR word; Silo QA and the panel follow as separate silos.

Tier and rationale: Tier 2 shape (new media + selector logic + wiring
in three surfaces), run as a builder silo under the coordinator's
brief; independent Silo QA and the 12-role panel follow separately.

Done condition / evidence: selectors pure and exact-match, fail
closed (full unit matrix); per-band lazy loading proven by E2E
network watch (variant fetched for its band only, the film it
replaces never fetched); gates green (tsc, npm test, lint-cards,
build:pages); captures of both variants playing in the built app;
geometry of the two affected cards unchanged vs main, the other
three cards and the locked tile byte-stable in the diff.

Files in scope: `src/assets/home-v5/card-media.ts` (two variant
records + two selectors + module doc),
`src/assets/home-v5/coldtrail-{film,poster,still}-little-explorer.*`
(new, byte-identical copies of the prep production files),
`src/assets/home-v5/review-{film,poster}-trail-scout.*` (new; film
encoded here from the prep take, poster = frame 0 of that encode),
`src/components/game-app.tsx` (the import line + exactly the two
CardFilm render sites, Cold Trail and Review, pass through the
selectors), `src/assets/home-v5/card-media-band-variants.test.ts`
(new), `tests/e2e/band-media-variants.desktop.spec.ts` (new),
README home-cards paragraph, this file.
Synchronized test pins: `src/components/card-film.test.ts` and
`src/components/home-smooth-cards.test.ts` asserted the two render
sites' literal media props; both pins now assert the selector form
(same strength — the exact rendered expression is still pinned).
Protected / untouched: `card-film.tsx`, `home-v5.css`,
LockedLoop / LockedTileFilm, all copy strings, the shipped standard
films (byte-identical), the banned mock take
(`meridian-band-motion/videos/trail-scout-review.mp4`) never enters
the repo.

Approvals: the owner approved the band mockups for production in
his own words — "use them" (2026-11-03 10:25 CST) — and Units 2–3
were dispatched once PR #324 merged (main `5b6dcac`). Merge: owner
only, on his explicit per-PR word for the final tip.

## Status

- [x] Fresh clone at `~/workspace/meridian-band-port-23`, branch cut
      at `5b6dcac`
- [x] LE Cold Trail media copied from media-prep (sha256-verified
      byte-identical): film 349,224 B (1094×616, 12 fps, 12.0 s),
      poster/still 50,100 B each
- [x] TS Review encode sweep (800×538, 24 fps, veryslow, faststart):
      CRF 24 → 431,622 (over cap), 26 → 322,998, **28 → 241,829
      (shipped; SSIM 0.978 vs a CRF-10 reference)**, 32 → 142,643,
      34 → 112,678, 36 → 92,347, 38 → 75,093, 40 → 62,426.
      Poster from frame 0 of the shipped encode, WebP q82, 31,792 B
- [x] card-media.ts: COLDTRAIL_FILM_LITTLE_EXPLORER +
      REVIEW_FILM_TRAIL_SCOUT records, coldtrailMediaForBand /
      reviewMediaForBand selectors, module-doc paragraphs
      (provenance, seam/identity numbers, encode recipe). The TS
      record's stillUrl reuses the existing archive-tools.webp
      import — no still file duplicated
- [x] game-app.tsx: Cold Trail + Review sites pass
      `coldtrailMediaForBand(ageBand)` / `reviewMediaForBand(ageBand)`;
      diff is the import line + those two lines, nothing else
- [x] Unit tests: new selector suite 14/14 (full matrix for both
      selectors, executed against the shipped functions; byte caps;
      wiring pins); card-film + home-smooth-cards + locked-tile
      suites 55/55 after the synchronized pin updates
- [x] Gates (true exit codes): `npx tsc --noEmit` 0 ·
      `npm test` 0 (scripts 943 pass + 11 skip / 954; src 2016/2016) ·
      `npm run test:worker` 0 (85/85) ·
      `node scripts/lint-cards.mjs` 0 (GATE PASSED) ·
      `npm run build:pages` 0
- [x] E2E per-band network proof: new spec 4/4 (5-7 fetches the LE
      Cold Trail film and never the standard; 8-10 fetches the TS
      Review film and never the standard; 11-13 and unset fetch
      neither variant). Neighbour specs (card-redesign,
      loading-orbs, home-visual-layout, age-profile-gate) 33/33.
      All runs `--workers=1` under `flock ~/workspace/.e2e.lock`
      against the built artifact
- [x] Captures in
      `~/workspace/meridian-band-port-evidence/units23-captures/`:
      both variant films recorded playing in the built app
      (paused=false, readyState 4, correct variant src), card
      screenshots, and slot geometry for 5-7 / 8-10 / 11-13 —
      Cold Trail slot 591 × 332.44 px and Review slot
      386 × 259.58 px in every band, Δ 0.00 px
- [x] Protected surfaces verified untouched vs main: card-film.tsx,
      home-v5.css, all five shipped films, locked-tile media +
      components. Diff is exactly 13 files
- [x] PR open — PR #329, opened at tip `e972da9`
- [x] Clean Silo QA on PR #329 + `e972da9`: PASS, no issues (gates
      re-run unpiped: tsc 0; npm test scripts 943p/11s, src
      2016/2016; worker 85/85; lint-cards GATE PASSED; build 0;
      E2E 37/37 incl. the new band spec 4/4; protected surfaces
      byte-identical; LE media sha256-identical to prep; TS film
      800×538 / 24 fps / no audio / faststart / 241,829 B, poster
      MAD 1.77 vs frame 0, frames clean of invented text; banned
      take absent)
- [x] 12-role panel on `e972da9`: 8 APPROVE / 4 APPROVE-WITH-NITS /
      0 BLOCK. Named rulings, both unanimous: (a) TS Review stays
      an 8–10-only VARIANT (12–0 over single-film); (b) the 5–7
      Review slot staying on the standard film is ACCEPTABLE
      (12–0). Five LOW nits, none blocking (see follow-ups)
- [x] DevEx PASS-WITH-NITS (doc-reproducibility nits, follow-ups
      below); Benchmark PASS (entry JS +0 B raw, entry CSS +0;
      home chunk +481 B raw / +127 B gzip; per-band cost verified
      from the built artifact: 5–7 pays −40,096 B vs the standard
      film, 8–10 pays +62,008 B, 11–13/unset pays 0 variant bytes)
- [x] CI on `e972da9`: build (22.x) PASS · e2e PASS · GitGuardian
      PASS (Workers Builds fail — not required, as on every tip)
- [x] **READY — verdict keyed to tip `e972da9`.** This status
      commit is records-only (BRANCH_STATUS.md) on top of the
      voted tip. NO MERGE — the owner's per-PR word is not given.

## Follow-ups of record (none blocking)

- card-media.ts variant-doc completion: LE ping-pong filter graph
  + fps step, TS raw take filename (`trail-scout-review-take.mp4`
  in the media-prep evidence), the exact MAD command for a
  replacement take's identity check (DevEx nits).
- CardFilm: the sticky `failed` state is never reset when the
  media prop changes (`card-film.tsx:100,105`) — a film error
  followed by a band switch holds the still until reload; fails
  closed, safe direction. Add a mid-session band-switch test with
  any fix (panel Seat 8).
- Mobile geometry capture for the two variant slots (panel
  Seat 9 — desktop captures only in this run; CSS untouched).
- Selector-only path rests on source pins, not module privacy —
  the variant records are exported from card-media.ts (Seat 2).
- The LE Review mock port is a possible later unit on the owner's
  call (panel ruling (b) records the asymmetry as acceptable).

---

# Prior records preserved from main @ 5b6dcac (2026-11-03)
- 2026-11-03: merge-up onto main `c6853be` (#297) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's app diff is unchanged from the READY tip `16774b9` / keyed tip `e972da9`. Checks re-read on the new tip before merging.

---

# Branch status — fix/267-reload-reveal-units

- **Branch:** `fix/267-reload-reveal-units`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #267 (Meridian issue-clearing wave,
PR W1) — make `tests/e2e/reload-reveal.desktop.spec.ts` pass on current
main by fixing its stale distance-unit expectation, prove it with a green
solo E2E run, and open the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the predicted failure signature exactly).

Done condition / evidence: diagnosis reproduced on unmodified main
(1 failed / 2 passed, the failure being the headline regex); after the
fix the same spec solo = 3/3 pass; mutation proof sealed; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/reload-reveal.desktop.spec.ts` (one line) +
this file. Out of scope: product code, `.github/workflows/` (CI e2e list
surface is owned by open PR #265; whether this spec joins the CI list is
the owner's separate call, per the wave brief for #267).

## What changed and why

- The miss-headline regex at spec:87 accepted only metric units:
  `(km|m)`. The product renders miles for en-US players (per issue #267,
  since PR #138), so the diagnosis run's headline —
  `"Result: 110 mi northwest of your pin"` — could never match.
- Fix: `(km|m)` → `(km|mi|m)`. "mi" is ordered before "m" so miles match
  before metres. Every other assertion in the file is untouched. The
  test's intent is to prove the result card re-renders after a mid-reveal
  reload, not to prove the unit.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/267/`)

- [x] Diagnosis on unmodified main: `build-pages-diagnosis.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 2 passed**; the single failure is the headline regex
  (`Expected pattern: /(km|m)/`, received `"Result: 110 mi northwest of your pin"`).
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) — **3 passed**.
- [x] Mutation proof: `mutation-unit.log` / `mutation-unit.exit` (=0) —
  unit-level regex check against the actual received headline string from
  the sealed diagnosis log: the old `(km|m)` regex fails it, the new
  regex passes it (and still passes km and m headlines).
- [x] Redundancy audit: `redundancy-grep.log` — grep for `miss-headline`
  and `of your pin` across `tests/e2e/`. This test's rehydration
  expectation lives at one site (this spec, line 87); the fix adds no
  duplicate. Similar pre-existing headline patterns in other specs are
  separate surfaces, untouched by this PR and outside #267's scope.

## Status

- [x] Diagnosis reproduced and sealed
- [x] One-line regex fix
- [x] Solo E2E green (3/3), sealed
- [x] Mutation proof sealed
- [x] PR opened against main (linked to #267, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only

## Cure — 2026-11-03

- Owner order: "Cure 297 and merge. Obviously we dont want messy code going into main" (Veeresh, 2026-11-03 16:10 CST).
- Spec cure (two changes in `tests/e2e/reload-reveal.desktop.spec.ts`):
  - Why-comment added above the headline assertion: the unit follows the player's region (US players see miles, since PR #138), so the pattern accepts every unit the headline can print; this spec proves the headline re-renders after a reload — not the unit.
  - Canonical pattern: the regex alternation is now `(km|mi|m|ft)`, the canonical form from `reveal-bearing.desktop.spec.ts`. `ft` is consistency only — it is unreachable for a miss headline (ft prints only under 1 mi; a miss is beyond the hit radius) — adopting it is not a behaviour fix.
- Records fix: the diagnosis evidence bullet above now quotes the full headline with its "Result: " prefix — received `"Result: 110 mi northwest of your pin"`.
- The cured tip goes back for a panel re-vote before merging (standing rule).

---
