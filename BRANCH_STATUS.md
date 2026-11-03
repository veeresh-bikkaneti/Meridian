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

# Prior record preserved on merge: share first tap (PR #305, fix/289-share-first-tap)

# Branch status — fix/289-share-first-tap

- **Branch:** `fix/289-share-first-tap`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #289 (Meridian issue-clearing wave,
PR W2) — find the true root cause of the swallowed first tap on the
summary's "Share score" button, fix it at the convicted layer, and earn
the removal of the `clickShareScoreWithRetry` mitigation from
`tests/e2e/endgame-share.spec.ts` (suite green on a single click in
repeated runs).

Tier and rationale: Tier 1 — one bug, clear repro, diagnosis-led; the
fix touches the two components the diagnosis convicted (summary
narration slot + narration first paint) plus the spec helper.

Done condition / evidence: swallow rate measured on unmodified main
first (instrumented probe, N=15, sealed logs); mechanism named from a
captured mid-tap event trace; after the fix, the same probe and the
real spec stay green on a single click in repeated runs (same N);
neighbour specs green; unit + typecheck + lint-cards green;
BRANCH_STATUS + PR with the diagnosis story. NO MERGE — merging is the
owner's step.

DEVIATION (labelled on the panel's request, PR #305 round 1): the
after-fix probe ran at N=5, not the same N=15 — the VM egress outage
(ERR_TUNNEL_CONNECTION_FAILED on the spec's console check, reproduced
identically on unmodified main) plus timebox cut the local runs. The
6.7% baseline is an existence proof from the probe, not a population
estimate, and 0/5 does not statistically exclude it; the verdict rests
on the deterministic mechanism proof (captured mid-tap trace +
constant-Y trajectory), the independent Silo QA reproduction, and CI
e2e green on the tip — not on the 0/5 count.

Files in scope: `src/components/run-summary.tsx`,
`src/components/storyteller.tsx`, `tests/e2e/endgame-share.spec.ts`,
this file. Out of scope: the share path itself (`share-action.ts`,
`share-button.tsx` — proven sound), any other narration host's
behaviour beyond the first-paint seeding (which only restores its
documented "caption text appears instantly" intent).

## Diagnosis (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- Baseline on unmodified main `2a0527f`: instrumented single-click
  probe ×15 — **1 swallowed (6.7%)**, 14 effected
  (`probe-baseline-*.log`, `baseline-tally.txt`). The original spec
  cannot show this rate: its retry helper masks first-click losses.
- The swallowed run (04) is captured end-to-end: at click time the
  lazy Storyteller narration had not yet mounted (no caption in the
  dialog); `pointerdown` hit "Share score", then within ~5 ms the
  narration chunk mounted its caption ABOVE the buttons, pushing the
  button out from under the pointer; `pointerup`/`click` therefore
  landed on the summary card, so the button's handler never ran
  (`__shareCalls` stayed 0, label stayed "Share score" — the exact
  reported symptom). A click whose pointerdown/up targets differ
  fires on their common ancestor, not on the button.
- Second contributor, measured by a 4 s layout trajectory probe
  (`probe-traj-*.log`): even after the chunk mounts, the caption
  painted EMPTY (22px, text length 0 — its words lived in a ref set
  by the mount effect) and popped to full height (61px) at the first
  reveal tick ~260 ms later, moving the buttons a second time.
- Ruled out: the share path (sound — calls reach 1 whenever the
  handler runs), hydration (summary mounts long after boot), inert /
  settle choreography on the summary (none gates these buttons), an
  overlay intercepting (event trace shows the click target was the
  card itself after the shift, never an overlay), late CSS (computed
  styles at first caption paint were already the styled values).

## Fix

- `run-summary.tsx`: the narration's `Suspense` fallback now reserves
  the caption's box — the same summary line rendered invisibly
  (`aria-hidden`) with the caption's exact box metrics (max-width,
  padding, border, banner text size/line-height/balance wrap) — so
  the chunk's late mount swaps into identical space and nothing below
  it moves, at any viewport width.
- `storyteller.tsx`: `wordsRef` is seeded with the line's words at
  first render instead of starting empty (the mount effect still
  re-seeds the same split). The caption's first paint now carries the
  full line, eliminating the empty→full pop for every narration host.
- `endgame-share.spec.ts`: `clickShareScoreWithRetry` replaced by a
  single click (`clickShareScore`); every exact assertion (exactly 1
  call, exact payload, "Shared ✓", clipboard sentinel intact) is
  unchanged and still gates the outcome. No assertion weakened.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- [x] Diagnosis on unmodified main: probe ×15, 1 swallowed, with the
  mid-tap event trace (`probe-baseline-04.log`)
- [x] Trajectory probe: button Y constant for 4 s after the summary
  opens on the fixed build (`probe-traj-after3.log`)
- [x] After-fix probe ×5: **5/5 EFFECTED, 0 swallowed**
  (`probe-after-summary.txt`)
- [x] Endgame-share spec, single click: share assertions pass in every
  after-fix run; one run's clipboard test fully green incl. clean
  console (`spec-final-1.log`). Remaining runs fail ONLY at
  `expectCleanConsole` on `ERR_TUNNEL_CONNECTION_FAILED` (external
  telemetry/contact fetches via the VM egress proxy) — the control
  run on unmodified main fails identically (`spec-control-main.log`),
  so this is an environment outage, not the change. CI on the tip is
  the canonical full-suite check.
- [x] Neighbours: storyteller spec **6/6 green**; session-score 5/8 —
  its 3 failures are pre-existing/main-known (idle-kill strict-mode =
  #296 per the wave PLAN; share-text expects the Workers origin on a
  Pages build; HUD toggle blocked by a by-design celebration
  overlay). Its two end-game summary tests pass.
- [x] Unit suite (861 + 1879 tests, 0 fail), typecheck, lint-cards —
  all green (`unit-after.*`, `typecheck-after.*`, `lint-cards-after.*`);
  build:pages green (`build-after3.*`)
- [x] Redundancy audit: `redundancy-audit.log` — one share entry
  point (`ShareButton` → `shareScore`); the fix adds no second path
  (the placeholder is invisible, aria-hidden, non-interactive)

## Status

- [x] Diagnosis reproduced, mechanism convicted, sealed
- [x] Fix at the convicted layers (narration slot + first paint)
- [x] Retry helper replaced by a single click
- [x] Repeated runs sealed (probe 5/5; spec share assertions green in
  every run — see the environment caveat in Evidence)
- [x] PR opened against main: **#305** (For #289)
- [x] Silo QA (clean context, independent): PASS on `22a8d36`
  (evidence/289/qa-silo/)
- [x] Panel round 1 on `22a8d36`: 1 APPROVE / 11 AWN / 0 BLOCK, DevEx
  PASS-WITH-NITS — cure applied for the convergent metric-drift nit
  (Architect MEDIUM + 5 seats): a KEEP IN SYNC warning now sits in the
  fallback comment in `run-summary.tsx`, and the probe-N deviation is
  labelled above. Dismiss/failure-growth shifts tracked in #306.
- [ ] Silo QA re-verification on the cured tip (a new commit voids the
  `22a8d36` QA entry) — coordinator
- [ ] Panel re-vote on the cured tip — coordinator
- [ ] Merge — owner's explicit per-PR word only

## Observed, not fixed (tracked in #306)

- The caption's designed auto-dismiss (after audio ends / text-only
  hold) still collapses its height seconds later, which moves the
  buttons then. That window opens only after a first gesture has
  started the narration, so it cannot eat the FIRST tap; changing the
  dismiss visuals is a design call, not part of #289's fix. Filed as
  issue #306 at the panel's request, together with the audio-failure
  caption-growth facet the Level Architect seat found.

---

# Prior record preserved on merge: reserve caption slot (PR #310, fix/306-reserve-caption-slot)

PR #310 was stacked on #305's `db381cc`. Its own commits (`793579a`,
`20c5996`, `a08a2a5`) changed only `src/` and `tests/`; the branch's
BRANCH_STATUS.md record at `a08a2a5` was #305's record, unchanged and
byte-identical to the "share first tap (PR #305)" section above, so it
is not repeated here. Merged with `main` @ `534e963` (#305 squash-merged)
to bring #310 up to date without a force-push.

---

# Prior record preserved on merge: idle-kill locators (PR #307, fix/303-idle-kill-locators)

# Branch status — fix/303-idle-kill-locators

- **Branch:** `fix/303-idle-kill-locators`
- **Base:** `main` @ `2a0527f` (#295 merged; tip re-read from origin at build start, 2026-11-02)

## Task capsule

TASK / requested outcome: For issue #303 (Meridian issue-clearing wave,
Wave 2 pilot) — the two E2E specs that still use the bare
`page.getByText("Your game ended after 2 minutes of inactivity.")`
idle-kill lookup get the same scoped-locator cure PR #302 applied for
#296, IF they hit the same collision. Open the PR. Test-only fix;
product code does not change.

Interpretations considered and selected reading: issue #303's own
step 1 governs — reproduce first on unmodified main; if a spec
collides, scope it; if it passes, record why instead of changing it.
Both specs' idle-kill flows go through the in-page idle kill
(`killIdleSession` in `src/components/game-app.tsx`), which sets the
discarded notice (reason "inactivity") — the code path whose sr-only
announcer duplicates the visible card's text — so a collision is
expected in both; the sealed solo runs below are the proof, not this
reasoning.

Tier and rationale: Tier 1 — one known defect pattern, two spec files,
clear repro inherited from #296 / PR #302.

Done condition / evidence: before-runs of both specs' idle-kill tests
sealed on unmodified main; after the fix both full spec files pass
solo; all repo gates sealed (tsc · npm test · test:worker ·
lint-cards · build:pages); PR opened against main. NO MERGE, no QA
silo, no panel in this stage — those are separate coordinator stages.

Files in scope: `tests/e2e/scout-false-demotion.desktop.spec.ts` +
`tests/e2e/session-score.spec.ts` (one locator each) + this file.
Out of scope (FORBIDDEN): product code, PR #302's spec and branch
(frozen), any other PR, branch protection.

## What changed and why

- Both specs DID collide — reproduced solo on unmodified main, each
  with #296's exact strict-mode signature (bare lookup resolves to 2
  elements: the sr-only `discarded-notice-announcer` + the visible
  `discarded-notice` card's paragraph). Both flows use the in-page
  idle kill, which sets the discarded notice (reason "inactivity").
- Fix, identical in form to PR #302's cure: scope each lookup into
  the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`
  — plus the same in-spec comment recording why it is scoped.
  No `.first()` band-aid, no assertion weakened, no timeout changed
  (both specs keep their original default `toBeVisible()` wait).

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/303/`)

- [x] Diagnosis on unmodified main: `build-pages-before` exit 0;
  `e2e-before-scout-false-demotion` exit 1 and
  `e2e-before-session-score` exit 1 — each idle-kill test fails with
  the strict-mode signature above.
- [x] Gates on the fix tip: `tsc` 0 · `npm-test` 0 (scripts 850 pass
  / 11 skipped; src 1879/1879) · `test-worker` 0 (85/85) ·
  `lint-cards` 0 (GATE PASSED) · `build-pages` 0.
- [x] E2E after: scout-false-demotion full file **3 passed**, exit 0.
  session-score full file **6 passed / 2 failed**, exit 1 — the cured
  idle-timeout test passes; the 2 failures (`:77` HUD toggle —
  celebration overlay intercepts the click; `:509` share text — the
  spec's hardcoded Workers origin vs the Pages build's origin) are in
  tests this diff does not touch and BOTH reproduce on unmodified
  main with the same signatures (`e2e-control-main-session-score`,
  exit 1; `:509` solo on this branch fails with the identical origin
  mismatch, `e2e-after-session-score-share-solo`, exit 1) =
  pre-existing, not regressions.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` — the
  only other bare instance on main is #296's own spec (fixed on the
  frozen PR #302 branch; untouched here).

## Status

- [x] Branch off current main (`2a0527f`, re-read); coordination ledger heartbeat posted
- [x] Diagnosis reproduced solo on unmodified main (both specs)
- [x] Scoped locator fix, consistent with PR #302's cure
- [x] Gates sealed (tsc · unit · worker · lint-cards · build:pages)
- [x] E2E after-fix solo runs sealed (both full spec files + main control)
- [x] PR opened against main (For #303)
- [ ] QA silo + panel — separate coordinator stages (not run here)
- [ ] Merge — owner's explicit per-PR word only

---

# Prior record preserved on merge: security.txt expiry (PR #299, chore/224-security-txt-renewal)

# Branch status — chore/224-security-txt-renewal

- **Branch:** `chore/224-security-txt-renewal`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For #224 (Meridian issue-clearing wave,
PR W3) — renew `public/.well-known/security.txt` by setting a fresh
`Expires`, prove the backstop test passes, and open the PR.

Tier and rationale: Tier 0 — config / discovery file, one line, no
locked or owner-approved copy changed.

Done condition / evidence: `Expires` is `2027-11-01T00:00:00.000Z`;
both `Contact` lines byte-identical to main; `node --test
scripts/static-wellknown.test.mjs` green with sealed log + `.exit`
under `~/workspace/meridian-issue-wave/evidence/224/`; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `public/.well-known/security.txt` (one line) +
this file. Out of scope: everything else.

## What changed and why

- `Expires: 2027-10-01T00:00:00.000Z` →
  `Expires: 2027-11-01T00:00:00.000Z` — a fresh full year from this
  wave (2026-11-02), inside the backstop test's bound (in the future
  and at most one year / 366 days out) with margin.
- The file's own renewal comment names no date — it only says to
  renew `Expires` before it passes — so no comment change was needed.
  Verified: the old date `2027-10-01` occurred only on the Expires line.
- Both Contact lines are unchanged, byte-identical:
  `https://meridian.knowledgetest.workers.dev/contact` and
  `https://github.com/veeresh-bikkaneti/Meridian/security/advisories/new`.

## Contact-channel verification (2026-11-02)

- [x] `GET https://meridian.knowledgetest.workers.dev/contact` →
  HTTP 200 — re-run by this build crew on 2026-11-02.
- [x] GitHub private vulnerability reporting → enabled — API-verified
  by the coordinator on 2026-11-02 (cited, not re-derived here).

## Next renewal expectation

- **Renew before `2027-11-01T00:00:00.000Z`.** That is the new expiry
  set by this PR; the backstop test
  (`scripts/static-wellknown.test.mjs`) fails once it is in the past
  or more than a year out, so the next renewal should set a date
  within one year of that renewal run.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/224/`)

- [x] Gate: `static-wellknown.log` / `static-wellknown.exit` (=0) —
  `node --test scripts/static-wellknown.test.mjs` green.

## Redundancy audit

- One file, one line: `security.txt` is the single RFC 9116 discovery
  file; this renewal adds no duplicate path, control, or entry point.
  PASS.

## Status

- [x] Expires renewed to 2027-11-01T00:00:00.000Z
- [x] Contact lines verified unchanged; /contact re-checked (HTTP 200, 2026-11-02)
- [x] Backstop test green, sealed
- [x] PR opened against main (For #224, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only
- [ ] Next renewal — before 2027-11-01T00:00:00.000Z (see above)
