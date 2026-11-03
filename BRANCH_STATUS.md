# BRANCH_STATUS — fix/coldtrail-card-copy

- **Branch:** `fix/coldtrail-card-copy`
- **Base:** `main` @ `193b57c` (#321 home-card films, merged + live)

## Task capsule

TASK / requested outcome: Fix the Cold Trail home-card body copy
so it matches the now-live card film. The old copy ("A smuggler
moves between cities… make the interception") contradicts the
film, which shows Jolly (the cream plush mascot) being tracked by
a child before the trail freezes. Rewrite under the #321 panel
Narrative recommendation on record (panel VERDICT-RECORD flag 3):
keep the triangulation mechanic truth (three sightings, three
rings, tap where they cross), adopt the picture's cast inside it
(sightings of Jolly; reach Jolly where the rings cross before the
trail freezes) — do NOT rewrite to "follow Jolly" alone. Owner's
dispatch for this work — Veeresh, 2026-11-03: "work on the cards
that is not dependent on rock". Stop at PR-open; QA + panel are
separate silos. NO MERGE without the owner's per-PR word.

Tier and rationale: Tier 0/1 copy execution of a panel-recorded,
owner-open call — the wording rails were decided by the #321
panel's Narrative seat; this branch only crafts within them.
Scope is player-facing card copy + its test pin + a comment-only
fold-in in `card-media.ts`.

Done condition / evidence: new copy renders on the Cold Trail
card (verified in the built artifact); every pin of the old copy
updated or explicitly disclosed below; repo gates green; targeted
E2E green; PR opened with the full record.

Files and interfaces in scope: `src/components/game-app.tsx`
(the Cold Trail card `<p>` only), `src/components/card-film.test.ts`
(the one copy-lock pin), `src/assets/home-v5/card-media.ts`
(comments only), this file. Out of scope (NOT touched):
`src/game/coldtrail/*` (internal engine vocabulary incl.
"smuggler" names and themes.ts briefing strings), GeoDetective
card copy, the films/posters/stills and `card-film.tsx` logic,
LockedLoop, layout/CSS, and the locked strings "Case file ·
Unlimited" / "Case file · Triangulation" / "🔎 Solve a mystery" /
"❄️ Start the trail" (byte-exact — zero diff hits).

## What shipped

- **New Cold Trail card copy (123 chars, two short sentences;**
  **old copy was 110 chars rendered):**
  "Jolly was spotted in the snow. Three sightings, three rings —
  tap where they cross to reach Jolly before the trail freezes."
  The mechanic fragment "Three sightings, three rings — tap where
  they cross" is kept verbatim from the old copy; the cast is now
  Jolly (spotted → sightings of Jolly; goal = reach Jolly), and
  the freeze deadline from the film is the closing beat.
- **Pin updated:** `src/components/card-film.test.ts` copy lock —
  the old-copy fragment replaced with the new copy's fragment at
  the same lock strength (byte-exact `includes`, same position in
  the locked-strings list). No assertion weakened or loosened.
- **JSX comments checked:** the CardFilm comment block above the
  Cold Trail `<CardFilm>` (game-app.tsx ~4403) already truthfully
  describes the film (Jolly walks the footprint trail) — no change
  needed. The article header comment (~4394, "3 sightings, 3
  rings, one interception") describes the vertical slice's
  mechanic, which is unchanged — left as-is.
- **Fold-in, comment-only, `src/assets/home-v5/card-media.ts`:**
  (1) the two frame-0 extraction commands from the #321 cure
  record (`evidence/cure/CURE.md`) copied verbatim into the
  poster-derivation section; (2) ONE sentence stating the end
  axis per card (GeoDetective settles on the owner's image at the
  front angle; Cold Trail settles on the wide trail scene with
  Jolly mid-trail, still walking the footprint trail toward the
  lit cabin, which is still distant). No code lines
  changed; no asset bytes changed.

## Pin census (old copy + fragments, whole repo)

| Location | What was done |
| :--- | :--- |
| `src/components/game-app.tsx` ~4419 (the card `<p>`) | **Rewritten** — the source copy itself |
| `src/components/card-film.test.ts`:147 (copy lock) | **Updated** to the new copy, same lock strength |
| `docs/reviews/2026-10-21-wave2-mode-screens.md`:100 | **Left byte-intact on purpose** — a dated historical review record quoting the old copy as the open question (OD-1 / C-4) this PR resolves |
| `docs/handbook/02-game-design-decisions.md`:52 | **Left unchanged, disclosed** — it describes the Cold Trail edition's mechanic in the handbook's own words ("Three sightings, three rings, one interception… taps where the rings cross"), not the home-card text; it is not a pin of the card copy and the mechanic it describes is unchanged |
| `src/game/coldtrail/themes.ts` + `themes.test.ts` | **Out of scope, untouched** — different strings (in-game briefing texts for other themes); they share only the generic "Three sightings, three rings —" mechanic phrase, not this card's copy |
| README.md, e2e specs | **No pins found** — grep-verified; e2e references the card only via the untouched CTA "Cold Trail: Start the trail" |

## Redundancy audit (owner standing rule)

| Surface | Keep / remove | Reason |
| :--- | :--- | :--- |
| Card JSX `<p>` in `game-app.tsx` | **Keep — single source** | The one place the player reads this copy |
| `card-film.test.ts` copy lock | **Keep** | Deliberate byte-exact lock; it exists to fail the suite if the card copy drifts — a guard, not a second source |
| Historical review doc quote | **Keep (byte-intact)** | A dated snapshot; editing it would falsify the record of the open question |
| Handbook mechanic description | **Keep** | Describes the edition's mechanic from its own context; does not restate the card copy |

## Gates (code head 951246e; BRANCH_STATUS commit is docs-only on top)

- `npm run typecheck` — PASS (0 errors)
- `npm test` — PASS: scripts 850 pass / 11 skipped / 0 fail;
  src 1896/1896 pass
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — PASS; built artifact grep-verified:
  new copy present in `dist/client/assets/routes-*.js`, old copy
  absent
- E2E (flock `~/workspace/.e2e.lock`, --workers=1, Playwright-
  bundled Chromium 1243 — the VM's /opt/meta-chromium is not used,
  same as the #321 runs):
  - card-redesign.desktop — **11/11 PASS**
  - loading-orbs.desktop — **8/8 PASS** (builder-run result;
    incl. reduced-motion still + film-error → Cold Trail still)
  - home-visual-layout.desktop — **13/13 PASS** (copy is 13 chars
    longer rendered; the card chain has no fixed height or clamp,
    so a one-line text growth has no failure mode by construction
    — absorbed by grid stretch + auto-margin CTAs)
  - QA's combined E2E spot run had one infra flake
    (card-redesign:278 setup timeout under VM load; branch rerun
    1/1 PASS, unmodified-main control 11/11). The loading-orbs
    8/8 result above is a builder-run result that QA did not
    rerun.

## Flags for the owner / panel

- Panel approves the final tip; merge only on the owner's
  per-PR word. The Narrative seat judges the new wording.
- Eyebrows, CTAs, films, posters, stills, and LockedLoop are
  untouched — media asset bytes identical to main.

---

# Prior record preserved on rebase: capitals pack (PR #323, merged as 3bc7fd9)

# Branch status: feat/capitals-pack

Story packs (issue #319), integration branch. The Stacker integrated
the four swarm slices into one branch and runs the review pipeline to
READY. No merge. The owner's per-PR word gates merging.

Base: main `193b57c` (PR #321 merged). PR #322 (Track A, card copy)
is still open, now at cured head `cd6d47b`, so this branch stays based
on `193b57c`. If #322 merges first, this branch rebases onto the new
main before its own merge. The PR body records that debt.

## Task capsule

TASK / requested outcome: integrate swarm slices 1 to 4 (runtime core,
capitals content, Cold Trail adapter, pack shelf) into one branch,
resolve the six named seams, and run the full review pipeline to
READY. No merge.

Interpretations considered and selected reading: (a) one shared
selection blob for both editions — rejected, because each edition's
dealer reads only its own progress store, so a shared blob would be a
second source of truth one dealer never reads; (b) one selection
store per edition, each dealer reading the store its chips write —
selected (seam 1 below).

Tier and rationale: Tier 2. A new content system across many files,
with storage keys and a pack schema; the full review pipeline
(Silo QA, 12-role panel, DevEx, benchmark) applies.

Budget: Tier 2 default parent cap (400k tokens) covers this run and
all its delegates. No token meter exists for the run, so no count is
claimed here.

Approvals and checker: the owner approved the design and ordered the
build on 2026-11-03 ("Approve design — build the capitals pack",
"Pstack swarm"). Merge is NOT approved; it waits for the owner's
per-PR word on the final tip. Checkers are independent of the
builder: Silo QA (clean context) and the 12-role panel.

Slices and tips: swarm/runtime-core `093ec58`, swarm/capitals-content
`c5ba2b8`, swarm/coldtrail-adapter `762cb0d`, swarm/pack-shelf
`3f06576`. Integration commits: `6c7fce1`, `a103243`, `881a2fa`,
`0b58447`, `902e65c`, `f776fd1`, then `0e24e96` (dealing-proof E2E).

Seams and how they closed:
1. One selection store per edition. The GeoDetective loop store owns
   its selection (`activeDeckId`); Cold Trail selection lives in the
   shelf selection blob under its own key. One store per edition
   because the two editions keep separate progress stores today, and
   the dealer for each edition reads exactly the store its chips
   write.
2. Cold Trail pack progress key and shape match Slice 3's store.
3. Pack manifest carries coldtrailFile; the composer covers all 72
   cases, loopIndexes 387 to 458.
4. Schema and composer accept Slice 2's three record additions
   (schema field, directions array plus direction, target.aliases).
   Both validators pass over all 72 on the integrated tree.
5. Deck-correct dealing proven end to end in E2E for both editions
   (pack-shelf spec, 6 of 6 under the flock).
6. Screens pass the open case's real deck id as activeDeckId.

Out of scope, recorded in the PR body: the Direction B2 loss-reveal
credit (it depends on reverse-direction B1/B2 play being built
first; no B2 case can be lost until B2 cases deal), the home card
subtitle from DESIGN section 7 (Track A region), alias widening for
the five repair-2 cases.

Frozen: PRs #297, #299, #302, #305, #307, #308, #309, #311, #312,
#322. This branch does not edit, comment on, or rebase any of them.

## Round-1 cure (2026-11-03, on tip f74b708's verdicts)

Round 1 returned 7 panel BLOCKs, a DevEx FAIL, and 2 Silo QA
defects. The cure is built on this branch in 12 commits
(`414ddb6`..`aa0b7f4`); the full per-item record with evidence is
`~/workspace/meridian-capitals-evidence/cure/CURE.md`. In short:

- Code: edition-true Cold Trail pack total (60, not 72) end to end;
  TrailScreen mount resume (an unrevealed case in exactly one deck
  opens on that deck, ahead of the selection blob); deck-aware cycle
  celebration (Capitals copy denominated in 72, core copy
  byte-identical); 320px shelf second-row reserve; ride-alongs
  (role="status", reset clears the shelf blob, manifest-validator
  parity, missing-sidecar screen test).
- Content: duplicate targets cured by swap — Nairobi and Ankara
  (already core clues 74/218) replaced by Accra (Ghana) and Abu
  Dhabi (UAE) at tier 3, authored to the full standard; 459 unique
  targets restored, pack stays 72, Cold Trail deck stays 60 and now
  teaches 51 anchor capitals. Indianapolis hook carries no
  measurement string. Addis Ababa and Nashville giveaways rewritten
  as capital-only role facts (Addis hook rung untouched).
- Validators: all 72 records state Direction A only; the B2 subject
  rule is stated in the same words in schema.mjs and
  validate-pack.mjs, and validate-pack now calls schema's
  validatePackRecord for the shared checks (equivalence test pins
  both gates on a synthetic B2 record).
- Docs: design vendored at docs/story-packs.md with the v1 truth
  corrections; README passage; docs/geodetective.md updated (459
  clue files, pack-owned indexes 387-458); Handbook ch05 records
  the owner's 2026-11-02 packs-not-modes ruling; runbook at
  scripts/packs/README.md plus packs:* npm scripts; the Cold Trail
  generator's stale fallback header corrected.

Gates on the cured tip (all run unpiped, real exit codes):
validate-pack --all exit 0 (72/72); composer re-run drift limited
to generatedAt (restored); npm test exit 0 (scripts 953: 942 pass /
11 skipped / 0 fail; src 1964 pass / 0 fail); test:worker exit 0
(85/85); tsc --noEmit exit 0; lint-cards GATE PASSED; lint-content
exit 0 (6 baselined, 0 new); build:pages exit 0; perf:bundle entry
JS 982,696 raw / 306,177 gzip, CSS 130,790 raw / 26,137 gzip; E2E
under the flock: pack-shelf desktop + new 320px mobile spec, 8/8.

## Verdict (2026-11-03, on cured tip `9062a7f`)

Re-verification on the cured tip: Silo QA PASS (fresh clone, 10 of
10 cure items, 11 of 11 gates unpiped); panel re-vote 1 APPROVE /
11 APPROVE-WITH-NITS / 0 BLOCK; DevEx re-check PASS-WITH-NITS;
benchmark PASS (entry JS +0.36% raw / +0.30% gzip against main).
CI at verdict time on `9062a7f`: build (22.x) PASS, GitGuardian
PASS, e2e PASS; Workers Builds fails as on every tip and is not a
required check. The Boise and Addis Ababa hooks stand as ruled in
round 1; both texts are byte-identical on the cured tip.

This file's sync commit lands on top of the voted tip as a
records-only change; the panel vote, the QA ledger entry, and the
verdict all key to `9062a7f`. Remaining LOW nits from the re-vote
are follow-ups in the PR body and the verdict record, not cures.
The PR is at READY. Merge waits for the owner's per-PR word. If
PR #322 merges first, this branch rebases; the overlap is this
file only, and the panel re-votes only if that rebase touches code.

## Status

- [x] Integration clone created; branch cut at `193b57c`
- [x] Slice 1 merged (runtime core)
- [x] Slice 2 merged (capitals content)
- [x] Slice 3 merged (Cold Trail adapter)
- [x] Slice 4 merged (pack shelf)
- [x] Seams 1 to 6 resolved
- [x] Gates green on the integrated tree (validate-pack 72 of 72,
  composer deterministic apart from generatedAt, typecheck clean,
  worker tests 85 of 85, pack tests 85 of 85, lint-cards passed,
  build:pages exit 0, pack-shelf E2E 6 of 6 under the flock).
  Correction to this round-1 box: its "npm test exit 0" line was
  wrong — that reading came from a piped command whose exit code
  belonged to the pipe; the suite in fact failed on that tip (the
  two defects the cure then fixed). The corrected record is in the
  coordination ledger and the evidence folder.
- [x] Round-1 cure built (12 commits, gates above)
- [x] Silo QA pass on the final tip (`9062a7f`, re-check PASS)
- [x] Panel verdict on the final tip (re-vote: 0 BLOCK, READY)
- [x] DevEx recorded (re-check PASS-WITH-NITS)
- [x] Benchmark recorded (cured tip, PASS — see the verdict section)
- [x] PR open at READY (PR #323; merge waits for the owner's word)
