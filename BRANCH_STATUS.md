# Branch status — feat/capitals-flags-phase1 (Capitals & Flags, Phase 1)

- **Branch:** `feat/capitals-flags-phase1`
- **Base:** `main` @ `7a35cbf`
- **Authority:** issue #344 + owner decisions comment (2026-11-04, Veeresh: "All as recommended by the council chair")
- **Design of record:** `~/workspace/meridian-capitals-flags/DESIGN.md` (arena C2 pack-grown, 16/18) + SYNTHESIS.md + SOURCES.md

## Task capsule

- TASK: grow the shipped Capitals pack in place — Wave 1: licence-verified flag layer on the existing 72 cases (relabel "Capitals & Flags", doorway strip on Home, flags only where the land's name is already on screen in text); Wave 2: +38 cases append-only at loop indexes 459–496 (22 state capitals → 50, 16 country capitals → 60), deck top-up migration, celebration target 72 → 110.
- Tier: 2 (new feature, data + schema). The signed design package (#344 swarm → arena → owner ratification) is the Consensus Manifest for this task.
- Ratified lines NOT to cross: no standalone edition; no flag as a hunt target; no manufactured flags or facts (per-file licence gate, unsourceable = flagless); challenges + shared session score stay OUT of v1; Cold Trail generation follows DESIGN.md §7 default (append-only; no silent reset).
- Adjacency: PR #341 touches LoopScreen/pack-shelf on its own branch — this branch builds on current main and does not wait for it; a merge-up will reconcile.
- Verification: packs:validate (Hyderabad gate), check-flags gate (Flagstaff), full unit suites, targeted + neighbour E2E (flock, workers=1), tsc, lint-cards, build:pages, bundle check on flag assets.

## Wave record

- [x] Wave 1 — licence research pass (72 lands): **72/72 licence-verified** on Commons (all Public domain per-file), identity cross-checked vs Wikidata P41 (historical-value traps caught for FR/GR/US). **55 ship** (68,366 bytes total); **17 are flagless on the design's ≤10 KB/file hard cap** — detailed seal/arms path data (100–644 KB) with no faithful simplified rendition published (Egypt + Portugal rescued via design-named flag-icons renditions, MIT). Flagless lands are recorded with reasons in the registry + `docs/flags-curation.md`; they ship the day an SVG optimisation step is approved (owner decision queued in the PR body).
- [x] Wave 1 — schema/composer flagKey derivation (build-time, unmapped subdivision throws), sidecar flagKey for verified lands only, registry + resolver (`src/lib/flag-registry.ts`, lazy glob, 0 bytes precached — verified in dist), surfaces: GeoDetective briefing + Giveaway rung + reveal identity card (flag + sourced story), Cold Trail sighting stamps (163/180; composition byte-stable vs HEAD after stripping stamps) + reveal country line, doorway strip under the Expeditions Map card (with the design's three swatches), relabel "Capitals & Flags" (shelf chips; deck id unchanged).
- [x] Wave 1 — deck top-up in `ensurePackDeck` (built-from size = undealt + completed + open mystery; new cases tier-banded into the remainder) + tests; existing "never rebuilds" pin intact.
- [x] Wave 2 — +38 authored cases (22 state capitals → 50, 16 country capitals → 60), append-only at indexes 459–496; `packs:validate` 110/110 (Hyderabad 100%); published 387–458 clue files + sidecar entries byte-identical to Wave 1 (append-only composer guard enforced; a removal test pins it). **Curation correction:** five picked capitals were dropped for duplicating core-deck targets by GeoNames placeId — Islamabad, Amman, Montevideo and Riga from the authored batch, plus Kuala Lumpur, picked in the first swap round and dropped in a second round for the same reason — and the four replacements that shipped are Dhaka, Algiers, Quito and Tunis, Tunis taking Kuala Lumpur's slot, so all 16 country cases are accounted for (+22 states unchanged); all 38 new targets verified distinct across core + pack (497 distinct targets, build-loop gate). The 16 original country cases needed a validator cure round (59 clues rewritten as plain-words paraphrases inside their verbatim quotes; zero quotes changed, zero facts invented; 5 over-quoted facts dropped).
- [x] Wave 2 — flags for the 38 new lands through the same Flagstaff gate: **69 shipped pack-wide (80,552 bytes)**, 41 flagless recorded (40 size-cap — seal/arms path data, incl. Ecuador at 279,145 B; Mississippi licence-only: "Copyrighted free use" ∉ allowlist; Spain/Mexico + 15 Wave-1 states unchanged). Celebration copy 72 → 110. Cold Trail deck 60 → 85 cases (first-60 composition byte-stable vs Wave 1 after stripping stamps; 61 of 110 pack capitals taught as witness anchors).
- [x] Gates + screenshots + PR to READY (panel runs after; no merge) — scripts 1003/1003, src 2109/2109, worker 109/109, tsc clean, lint-cards PASSED, build:pages green; bundle: 69/69 flags verified in dist as lazy chunks, 0 in the SW precache; E2E (flock, workers=1): capitals-flags 3/3 + pack-shelf mobile/desktop 11/11 combined incl. the two deck-count expectations updated 60 → 85. Eye gate passed on the 20 Wave-2 shipped flags (contact sheets, checker ≠ builders). Shots: `~/workspace/meridian-capitals-flags/build-shots/w2-1-abuja-briefing-flag.png`, `w2-2-tunis-briefing-flag.png` (+ the 6 Wave-1 shots).

## Flagstaff gate

`npm run check:flags` (wired into prebuild) pins registry ⇔ files
(SHA-256, bytes, licence class, SVG sanity, aspect), registry ⇔ pack
subjects both ways, the composed sidecar, and the Cold Trail stamps.
Contact-sheet eye gate (checker ≠ builder) passed on the 55 shipped
flags, 2026-11-04, and on the 20 Wave-2 additions (15 + bd/dz/my/tn
minus the swapped-out lands), 2026-11-04. Final registry: 69 shipped
(80,552 bytes), 41 flagless with recorded reasons, 110 lands.


## Merge-up — 2026-11-04 (main `06dddb1` merged in)

- Sole conflict: this file. Resolved both-records: this branch's record above, main's #341 record appended below it; the accumulated records from main follow verbatim after it.
- Code files auto-merged with no conflicts; the merged tree carries both #341's case-source sentence behaviour and this branch's flag layer (delta audit in the PR body merge-up note).

## Composition cure — 2026-11-04 (owner word: "cure it")

The merge-up's delta audit caught a semantic composition conflict —
auto-merge was textually clean, but #341's fallback spec went red on
the merged tree for two linked reasons. The merge-up stopped unpushed
and the owner approved this cure:

- **Ratified relabel vs #341's pins.** #341's case-source sentences
  derive the deck name dynamically (`deckLabelForId`), so the
  ratified "Capitals & Flags" relabel correctly flows into them;
  #341's pinned expectations still said "Capitals". Cured by updating
  the pins only (unit literal in `pack-shelf-data.test.ts`, the two
  sentence constants in `pack-deal-fallback.desktop.spec.ts`, and the
  §0 quotes in `docs/story-packs.md`). Production strings stay
  dynamic; nothing was hardcoded.
- **Two UI consumers, one manifest URL.** The Home doorway (#346)
  and the pack shelf (#341's surface) each fetched the pack manifest
  with no sharing, so under a first-request-succeeds/rest-fail
  network the doorway consumed the good response and the shelf's
  chip never rendered in the fallback state. Cured in
  `fetchPackManifest` (`pack-shelf-data.ts`): UI callers on the
  default path share one session-level load per pack (in-flight +
  settled success cached); a load that settles to null is evicted so
  the next mount retries. A caller passing its own fetcher always
  gets a fresh uncached load, and the deal path is untouched — it
  resolves the manifest with its own fetch in LoopScreen
  (`resolveActivePack`), fresh at each deal, so a deal-time failure
  still falls back to core with #341's notice.
- **Proof:** the fallback spec passes 3/3 under its ORIGINAL
  choreography (first manifest request fulfilled, every later one
  aborted) — only its two string constants changed. Four new unit
  tests pin the dedupe: shared in-flight load, settled-success reuse,
  failure eviction + retry, injected-fetcher bypass both ways.

## Panel round-1 cure — 2026-11-04 (verdict on `d7ae3b7`: BLOCKED)

The 12-role panel + DevEx voted on the composition-cured tip:
11/12 seats APPROVE / APPROVE-WITH-NITS, Senior Developer BLOCK
(code), DevEx FAIL (docs only), benchmark PASS. Both blocks cured
here; the cured tip returns for a panel re-vote before any merge
word.

- **Block 1 (code) — top-up double-counted a finished mystery.**
  `completePuzzle` counts a finished case in `cycleCompleted` and
  keeps it in `store.current`; `ensurePackDeck`'s
  `openFromThisDeck` counted that same case again as open, so the
  top-up slice skipped exactly one appended case (index 459, the
  first Wave-2 case) for a player who exited on a pack reveal
  screen when the pack grew. Cured: `openFromThisDeck` counts
  `current` only when its status is "playing" (`store.ts`); no
  other accounting changed. Regression test added in
  `store-topup.test.ts` (finished won AND lost currents preserve
  every appended case incl. 459); the panel's repro pair now
  agrees — finished-current and playing-current top-ups both yield
  `[389, 388, 460, 461, 459]` (finished-current yielded
  `[389, 388, 460, 461]` before the cure, reproduced first-hand).
- **Block 2 (docs) — story-packs stated pre-Wave-2 truth.**
  `docs/story-packs.md`: intro now 110 cases (60 country + 50
  state), pack named Capitals & Flags; flowchart + §1 pack range
  387–496 (§8's "387–458 stay frozen" untouched — that is the
  original range the growth appends after); §6 quotes the shipped
  celebration string verbatim (`celebration-copy.ts:166`); §7
  gains one sentence on the session-cached UI manifest (QA note 1
  disposition). `scripts/packs/README.md`: generated clue range
  now ends at 496.
- **QA note 3 (MAJOR) — the swap sentence, corrected.** The old
  "5 swapped out / 4 replacements in" phrasing could not be
  reconciled (16−5+4=15≠16). Derived from the curation data (the
  panel's slate count: 39 candidates → 38 shipped; the
  one-candidate gap is Kuala Lumpur, which sits on both sides of
  the old sentence): five picked capitals were dropped for
  duplicating core-deck targets by GeoNames placeId (Islamabad,
  Amman, Montevideo and Riga from the authored batch, plus Kuala
  Lumpur, picked in the first swap round and dropped in a second
  round for the same reason — all five placeIds verified present
  in the core clue files, none in the shipped pack), and the four
  replacements that shipped are Dhaka, Algiers, Quito and Tunis,
  Tunis taking Kuala Lumpur's slot, so all 16 country cases are
  accounted for. The corrected
  sentence now reads the same in `docs/flags-curation.md`, this
  record, and a correction note appended to the PR body. Also
  fixed in this record: the flagless split is 40 size-cap + 1
  licence = 41 (registry count), not "39 size-cap".

## Panel re-vote — 2026-11-04 (on cured tip `b3fc61c`): READY-WITH-NITS, 0 BLOCKs

The 12-role panel + DevEx re-voted the cured tip: 10
APPROVE-WITH-NITS / 2 APPROVE, 0 BLOCKs; DevEx PASS-WITH-NITS
(the round-1 docs BLOCK is cured); benchmark PASS vs main
`3bc57e8` (client total +0.32%, JS +0.34%, entry chunk
unchanged, 0 flags precached — gate ≤5%). Both round-1 BLOCKs
verified cured first-hand: Senior Developer APPROVE — its
reproduction re-run on both tips (finished won/lost currents
dropped case 459 on `d7ae3b7`; on `b3fc61c` they yield
`[389, 388, 460, 461, 459]` with `cycleCompleted` intact, and
the new regression test fails pre-cure, passes cured); DevEx
re-checked every docs item against sources (§6 quote byte-equal
to `src/components/celebration-copy.ts:166`; the 40 size + 1
licence flagless split proven against the registry). QA notes
(a) curation-sentence copies and (b) probe G hand-crafted state
both ACCEPTED unanimously (12/12 + DevEx). Verdict comment:
https://github.com/veeresh-bikkaneti/Meridian/pull/346#issuecomment-6637312564
This entry is applied in the merge-up commit over main
`3bc57e8`: it was deliberately not committed on the voted tip,
since committing would have moved it. Remaining nits are
recorded follow-ups (FlagImg transient flash on reused Cold
Trail sighting slots, the "100–644 KB" range in the curation
docs, the doorway tagline — owner's call); none block. Merge
follows on the owner's per-PR word.

---

# BRANCH_STATUS — fix/336-deck-identity

- **Branch:** `fix/336-deck-identity`
- **Base:** `main` @ `775d8b4` (#329 band-variant card films, merged)

## Task capsule

TASK / requested outcome: Fix issue #336 (GeoDetective deck leak).
When the player's pick is a pack (activeDeckId "capitals") and the
pack manifest fetch fails at deal time, `resolveActivePack` swallows
the failure and `dealActiveDeck` silently deals a CORE case while the
chip/pick still say Capitals. The fallback itself is design-of-record
(docs/story-packs.md §0: "pack code may never block play") — the
defect is the SILENCE. Locked fix shape (panel reviews it; the
fail-closed alternative is on the record in issue #336 for the
panel, not built here):
1. DECK IDENTITY — the case screen names the OPEN case's deck, in
   shelf vocabulary ("All cases" / "Capitals"), visible while
   playing AND on the reveal. Derived from the open case
   (`deckIdOfPuzzle(current)`), never from the pick. Label helper
   `deckLabelForId` in src/components/pack-shelf-data.ts reuses the
   existing category-label logic, with unit pins.
   PRESENTATION CURED (owner, 2026-11-04 — see the cure record
   below): the first version's `Deck: X` header line
   (`data-testid="case-deck-label"`) is REMOVED. In its place, one
   plain sentence in one place (`data-testid="case-source-line"`,
   under the shelf) names where the open case came from:
   "This case is from your Capitals deck." / "This case is from
   All cases."
2. FALLBACK NOTICE — when a deal actually falls back (a pack was
   picked AND the deal came from the core deck; detected at both
   deal sites: mount effect and onNextMystery), the case-source
   sentence spot carries the fallback notice instead: "Capitals
   couldn’t load just now — this case is from All cases instead.
   Your next case will try Capitals again." While it is up, the
   shelf's own status line stays empty (PackShelf's
   `statusLineSuppressed`), so only one message speaks. Cleared on
   the next deal and on a deck pick. No notice for resumed/revealed
   cases, healthy pack deals, or core picks.
3. REGRESSION SPEC — tests/e2e/pack-deal-fallback.desktop.spec.ts,
   ported from the investigation repro and converted to the locked
   expectation: (a) control — healthy manifest deals 431,
   deckId "capitals", label reads Capitals; (b) fallback — core 186
   IS dealt (§0) BUT the label reads "All cases" and the notice is
   visible; the screen never presents the case as Capitals;
   (c) the pick remains "capitals" after a fallback deal.

Interpretations considered and selected reading: fallback detection
keys on the dealt result (picked deck is a pack AND dealt deckId is
core), which is exactly "resolution returned no pack" at both deal
sites and also covers any other silent-fallback path. The label
renders when a case is open (playing and reveal share the header
block); before the first deal there is no open case to name.

Tier and rationale: Tier 1 shape (one bug, proven repro) run as a
builder silo under the coordinator's brief; independent Silo QA and
the 12-role panel follow separately. Builder stops at PR open —
NO MERGE without the owner's per-PR word.

Files and interfaces in scope: `src/game/loop/LoopScreen.tsx`
(header block near "Case #N", deal sites, onPickDeck, one new state
+ one copy helper), `src/components/pack-shelf-data.ts`
(`deckLabelForId`), `src/components/pack-shelf-data.test.ts` (unit
pins), `tests/e2e/pack-deal-fallback.desktop.spec.ts` (new),
`docs/story-packs.md` (ONE clarifying sentence in §0/§7; the §0
principle itself untouched), this file.
Protected / out of scope: `dealActiveDeck`'s fallback itself
(stays), the store dealer (sound), TrailScreen / Cold Trail
(untouched), the Guess-counter line ~1134 and its immediate block
(claimed by the #337 branch), locked copy elsewhere.

Verification contract (gates on the tip, real exit codes):
`npx tsc --noEmit` · `npm test` · `node scripts/lint-cards.mjs`
(GATE PASSED) · `npm run build:pages` · targeted E2E under
`flock ~/workspace/.e2e.lock`, PLAYWRIGHT_CHROMIUM_EXECUTABLE=
~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome,
--workers=1: the new spec + pack-shelf.desktop.spec.ts +
geodetective.spec.ts.

Assumptions, risks, unknowns: notice/label copy is minimal and
factual per the brief's draft; the panel finalizes copy. The shelf's
next-case status line and the new case-deck label are different
subjects (pick for the NEXT case vs deck of the OPEN case) — both
stay; redundancy audit in the PR body.

## Status

- [x] Fresh clone at `~/workspace/meridian-deck-fix`, branch cut at `775d8b4`
- [x] `deckLabelForId` helper + unit pins in pack-shelf-data
- [x] LoopScreen: case-deck label in the header block
- [x] LoopScreen: fallback detection at both deal sites + notice
- [x] Regression spec ported + converted to the locked expectation
- [x] docs/story-packs.md clarifying sentence
- [x] Gates: tsc / npm test / lint-cards / build:pages / targeted E2E
- [x] PR opened against main: #341 https://github.com/veeresh-bikkaneti/Meridian/pull/341 (NO MERGE — Silo QA + panel follow)
- [x] Owner wording cure (2026-11-04): one-sentence deck signal,
  `Deck:` header removed, shelf line suppressed during fallback;
  tests + docs updated; cured screenshots in
  ~/workspace/meridian-341-visuals/cured/ (independent Silo QA +
  panel re-vote on the cured tip follow)

## Verification record (builder, on the tip)

- `npx tsc --noEmit` — exit 0 (run before and after the spec landed).
- `npm test` — exit 0; src suite 2019 pass / 0 fail (includes the 3
  new `deckLabelForId` pins; pack-shelf-data file alone: 29/29).
- `node scripts/lint-cards.mjs` — exit 0, GATE PASSED.
- `npm run build:pages` — exit 0.
- Targeted E2E under `flock ~/workspace/.e2e.lock`,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/
  chromium-1243/chrome-linux64/chrome, --workers=1, against the
  build:pages artifact: pack-deal-fallback (3) + pack-shelf (7) +
  geodetective (18) = 28 tests, 27 passed / 1 failed. The one
  failure — geodetective win-path share assertion expecting the
  Workers origin while the Pages artifact's share line carries the
  Pages origin — reproduces IDENTICALLY on unmodified main
  `775d8b4` (verified by a worktree build + single-test run, same
  expected/received strings): a pre-existing spec/artifact
  mismatch, not a regression from this change. All 3 new tests and
  all 7 pack-shelf tests pass.

## Cure record — owner wording fix (2026-11-04, on top of `e94c0f0`)

The owner reviewed real screenshots of `e94c0f0` and called the
fallback screen confusing: the Capitals chip, the "Deck: All
cases" header, the shelf's "Your next case comes from Capitals."
line, and the fallback notice all spoke at once. He approved one
simpler shape, and this cure implements exactly that:

- The `Case # · Deck:` header is gone; the header is just
  "Case #N" again.
- One plain sentence, in one place under the shelf, names where
  the open case came from: "This case is from your Capitals
  deck." (the pack's own name, so other packs read the same way)
  or "This case is from All cases."
- A fallback case gets the notice in that same spot instead:
  "Capitals couldn’t load just now — this case is from All cases
  instead. Your next case will try Capitals again." While it is
  up, the shelf's status line stays empty, so only the notice
  speaks. The picked chip stays pressed — it is the player's pick.
- Nothing about dealing changed: same fallback detection at both
  deal sites, same §0 fallback, same pick/retry behaviour.

Files in the cure: `src/game/loop/LoopScreen.tsx`,
`src/components/pack-shelf.tsx` (one new optional prop),
`src/components/pack-shelf.test.ts` (new one-signal pins),
`tests/e2e/pack-deal-fallback.desktop.spec.ts` (same three
scenarios, new strings + shelf-silence and no-header pins),
`docs/story-packs.md` (§0 note rewritten to match), this file.

Verification (cure builder, on the cured tree):
- `npx tsc --noEmit` — exit 0.
- `npm test` — exit 0; src suite 2021 pass / 0 fail (2019 + the 2
  new one-signal pins).
- `node scripts/lint-cards.mjs` — exit 0, GATE PASSED.
- `npm run build:pages` — exit 0.
- Targeted E2E under `flock ~/workspace/.e2e.lock`, bundled
  chromium-1243, --workers=1, sealed full-log run:
  pack-deal-fallback (3) + pack-shelf (7) = 10 passed / 0 failed,
  exit 0. (One earlier reporter-only re-run flashed failures with
  no captured log; the sealed run is the record.)
- Neighbour E2E: geodetective.spec.ts 17 passed / 1 failed — the
  failure is the same pre-existing share-origin mismatch recorded
  above (expects the Workers origin, the Pages artifact carries
  the Pages origin; identical on unmodified main).
- Screenshots: ~/workspace/meridian-341-visuals/cured/ — all three
  states from the cured build at 390px, driven through the real
  deal path, eyeballed by the cure builder (header clean, chip
  pressed, shelf line blank, one sentence only).

---

## Panel verdict — 2026-11-04 (on cured tip `b184a23`): READY, 0 BLOCKs

The 12-role panel + DevEx reviewed the delta at
`b184a2362926aca2c3a647aceb1bfd08e2ef7b2b` (personas loaded verbatim
from `~/.codex/agents/`; Game Developer = mechanics_developer.toml,
UX Designer = ux-architect.toml, Office Hours = reality-checker.toml
— disclosed nearest matches). Verdict comment:
https://github.com/veeresh-bikkaneti/Meridian/pull/341#issuecomment-6630725540

- **Tally: 2 APPROVE / 10 APPROVE-WITH-NITS / 0 BLOCK; DevEx
  PASS-WITH-NITS. Verdict: READY on this delta.**
- Independent Silo QA preceded the vote: PASS-WITH-NOTES keyed to
  `b184a23` (diff = exactly the 8 files; approved strings byte-exact;
  QA's own fallback re-render byte-identical to the builder's cured
  screenshot).
- Owner citation (verbatim): the owner called the pre-cure fallback
  screen "Its confusing" (2026-11-04) and approved the cure by
  tapping "Apply the simpler wording"; the three sentences in code
  are the ones he approved.
- Annotation (panel nit, applied at this merge-up): the pre-cure
  lines in the task capsule and checklist above (the `Deck: X`
  header label, `data-testid="case-deck-label"`) describe the first
  presentation and are superseded by the cure record above and this
  verdict wherever they conflict. They are kept as history, not
  rewritten.
- Caveats recorded with the verdict: no `build (22.x)` or `e2e`
  check runs existed on `b184a23` (GitHub produced none for that
  SHA); the merge-up + substantive push is what runs CI on the
  merged tip, with a fresh check read before any merge. Merge only
  on the owner's explicit per-PR word.

## Merge-up — 2026-11-04 (main `7a35cbf` merged in)

- Sole conflict: this file. Resolved both-records: this branch's
  record above, main's accumulated records appended below the
  separator; the panel-verdict entry above was added here (it was
  deliberately left uncommitted so the voted tip would not move).
- Delta audit on the merged tree: branch-vs-main diff is exactly
  the voted 8 files; every code/test file byte-identical to the
  voted tip `b184a23`. (Figures recorded in the PR body merge-up
  note.)


---

# Accumulated records from main (kept verbatim at the 2026-11-04 merge-up)

# Branch status — feat/crash-telemetry-stamps (combined crash-telemetry PR)

- **Branch:** `feat/crash-telemetry-stamps`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f80` (PR #331 merges first; this PR merges immediately after, with a merge-up and fresh CI)
- **PR:** #339 — https://github.com/veeresh-bikkaneti/Meridian/pull/339
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (arena Candidate B + 10 grafts)

## Cure round 2 (DevEx FAIL F1 + factual nits, 2026-11-03)

Docs/comments only — no behaviour changes anywhere. Each item is its
own atomic commit, pushed as it landed:

- [x] F1 (the FAIL) — worker README hourly digest, `0e870ee`: the
  worked example now renders the **v2 digest**, taken verbatim from
  the `renderDigest` full-string golden in
  `workers/crash-report/src/index.test.ts` (checked
  character-for-character against the golden, and against the same
  example in `docs/observability.md`): `(receipt hour)` header,
  `priority:` line, per-type blocks. The prose now names what a type
  block carries — regions, groups, verdicts, modes, steps, errors,
  first/last receipt times, and labelled caps (`(+N more)`).
- [x] Worker README factual nits, `f9a67c8`: (a) the
  `recovery_outcome` tier rule is now stated in the intro and in the
  Severity tiers table — crash-class **only** for `repeat_failure`,
  counted-only otherwise (matching `tierOf` in
  `workers/crash-report/src/index.ts`); (b) the dry-run example
  response now carries `counted`, the real ingest shape:
  `{"ok":true,"forwarded":false,"counted":true}`.
- [x] `docs/observability.md`, `d845077`: (a) the "add a field"
  recipe now lists the fourth edit site — the literal
  `DEVICE_FIELD_KEYS` array in `src/lib/telemetry-manifest.ts`;
  (b) the manifest table rows for `screen` and `touchPoints` now
  include the `"unknown"` form the code stamps.
- [x] Comment corrections (comments only, no code tokens changed),
  `d2eba98`: (a) `workers/crash-report/src/index.ts` parity-guard
  comment now names the shipped
  `scripts/observability-field-parity.test.mjs`; (b) that guard's
  header now states the present truth — it runs on the combined
  branch and must pass — with its history (written on the client
  unit, where the worker side did not exist yet); (c) the
  `src/lib/telemetry-manifest.ts` header recipe gains the same
  fourth edit site (`DEVICE_FIELD_KEYS`).
- [x] This file, in the final cure-round-2 commit: this section,
  plus the finisher record's gate figures below labelled as
  PRE-CURE round-1 numbers with the current totals beside them.
- [x] Gates after all items (unpiped):
  - `npx tsc --noEmit` — clean (exit 0)
  - `npm run test:worker` — 109/109 pass; `typecheck:worker` —
    clean (the worker `tsc -p` run is clean; the comment-only change
    in that file kept the suite at 109/109)
  - Parity guard (`scripts/observability-field-parity.test.mjs`) — 1/1
  - `npm test` — scripts: 949 pass, 0 fail, 11 skipped;
    src: 2,078 tests, 2,078 pass, 0 fail
  - Watchdog suite (`scripts/crash-watchdog.test.mjs`) — 47/47

## Cure round (panel verdict on PR #339, 2026-11-03)

Panel tally that caused this round: **11 APPROVE-WITH-NITS + 1 BLOCK**
(the BLOCK from the Office Hours seat, over an AGENTS.md tension).
Each item is its own atomic commit, pushed as it landed:

- [x] Item 1 — BLOCK cure, `4aabcb0`: `AGENTS.md` Player-facing locks
  harmonised — the preceding raw-UA sentence now states the code-true
  posture (the telemetry code does not store the raw UA; it is read
  in page memory only to derive the parsed fields, and never leaves
  the device). Diff vs `c890f80` verified: exactly that paragraph's
  two sentences, nothing else.
- [x] Item 2 — watchdog-recovery shortfall, `628ebec`: the worker now
  fills a dropped `engine` for `boot_failure` only, via the E-rule
  table over the event's parsed fields (never overwriting a present
  engine, never for other types); `deviceClass` is NOT recovered and
  stays "unknown" on watchdog events. Watchdog comments corrected to
  that truth (comments only; rendered size unchanged at 6,104 bytes,
  suite 47/47). Worker suite grew to 109.
- [x] Item 3 — UA-parser traps, `e2cefa3`: `EdgA/` added to B2;
  a `Chromium/` rule (chrome/blink) added before the Safari rules;
  the Android frozen-token denylist now treats "10" and "10.0" as
  the frozen shape when a witness is present. One corpus row per
  fix. ua-parse suite 39/39, observability suite 92/92.
- [x] Item 4 — worker README stale cluster, `f02ff0b`: schema
  sentence now states the 17-key manifest allowlist; crash-class
  alerts described in the v2 format; test count re-measured
  (42 → 109); privacy line now states sessionId and the raw UA are
  never forwarded/logged/stored, while the parsed coarse device
  facts ARE forwarded in the alert by design.
- [x] Item 6 — docs label, `b6927a3`: `docs/observability.md`
  walkthrough now labels the worked example's `cores 6` as a worker
  test-fixture value, not a handset measurement.
- [x] Item 5 — this file: the client unit's STOP section below is
  rewritten as the resolved record (see "Resolved — watchdog byte
  budget" under the client unit record).

## Finisher record (integrator, 2026-11-03)

- [x] Merged `unit/crash-telemetry-client` (tip `0361e02`, U1–U3) — clean merge.
- [x] Merged `unit/crash-telemetry-worker` (tip `fd83292`, U4) — the only
  conflict was this file; resolved by keeping BOTH unit records (below).
- [x] Gated decision taken as its own commit (`4098735`): watchdog byte
  budget 5120 → 6144 per DESIGN-FINAL §7.5 — the ladder was exhausted
  (subset parser → browserVersion major-only → engine dropped →
  deviceClass dropped) and the rendered watchdog measures 6,104 bytes
  worst case, ≤ 6,144. Cost: +1 KB inline per page load. The owner
  rules on it with this PR's merge word; it is a decision item in the
  PR body. Watchdog suite after the raise: 47/47.
- [x] Parity guard green on the combined tree (1/1). Integrator edit:
  the guard's extractor did not match the worker's
  `Object.freeze([...])` allowlist declaration ("list declaration not
  found"); the extractor now allows the freeze wrapper. The field
  lists themselves matched exactly — 17 keys each, `webgl1`/`webgl2`
  included on both sides — so no field exception was encoded.
- [x] U5 docs: `docs/observability.md` (honest counts — client emits
  14 types, the worker on main accepts 8, the 6 engagement types land
  with PR #311; manifest field table; formats as built; the v1
  log-tail section marked superseded; "How to read a crash alert"
  walkthrough; privacy statement updated), `workers/crash-report/README.md`
  (bucket v2 shape, reachable fire-time threshold example),
  `AGENTS.md` (the §6.3 safeguard sentence only).
- [x] Follow-up filed: issue #338 — crash-report KV buckets have no
  retention (no `expirationTtl`); deliberately not bundled into this PR.
- [x] Combined gates on the combined tree — **PRE-CURE round-1
  numbers** (recorded before cure rounds 1–2; current totals after
  Cure Round 2 are beside them, and in the Cure Round 2 section at
  the top of this file):
  - `npx tsc --noEmit` — clean (exit 0)
  - `npm test` — scripts: 960 tests, 949 pass, 0 fail, 11 skipped
    (unchanged in Cure Round 2: 949 pass, 0 fail, 11 skipped);
    src: 2,075 tests, 2,075 pass, 0 fail — PRE-CURE round-1;
    current total: **src 2,078 tests, 2,078 pass, 0 fail**
  - `npm run test:worker` — 106/106 pass — PRE-CURE round-1;
    current total: **worker 109/109 pass**
  - `npm run typecheck:worker` — clean (exit 0)
  - Watchdog suite — 47/47; parity guard — 1/1
- [ ] Merge — owner's word only, after the panel approves the final
  tip. Post-merge owner step: manual crash-worker version upload.

The two unit records follow, kept whole.

---

# Branch status — unit/crash-telemetry-client

- **Branch:** `unit/crash-telemetry-client`
- **Base:** `origin/fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (Candidate B + grafts)
- **Scope:** Builder A (client) — Units U1 + U2 + U3 only. No PR, no merge.
TASK: enriched crash telemetry client — parsed RuntimeFacts snapshot persisted in the breadcrumb, persisted classifier state stamps, #335 mapMode fix, durable unfinished-boot counter, watchdog parity.
Tier: 2 shape, single builder under the parent orchestrator; QA + panel are separate agents after this branch.
Done condition: unit suites for the claimed files green, `tsc --noEmit` clean, watchdog rendered size ≤ 5120 bytes (ladder per §7.5), worst-case enriched suspected_crash measured against the 4096 cap.

## Claims (exclusive)

- U1 (new): `src/lib/ua-parse.ts`, `src/lib/ua-corpus.json`, `src/lib/ua-parse.test.ts`, `src/lib/telemetry-manifest.ts`
- U2: `src/lib/observability.ts`, `src/lib/observability.test.ts`
- U3: `scripts/crash-watchdog.mjs`, `scripts/crash-watchdog.test.mjs`
- Guard (from U5's guard half): `scripts/observability-field-parity.test.mjs` (new)
- This file.
- NOT claimed: `src/components/game-app.tsx`, `src/map/capability.ts` (read-only), anything under `workers/`.

## Status

- [x] U1 — parser (§3 B/E/O/P rules + §2.3 denylist), corpus (30 rows incl. incident, denylist, tripwire), manifest (§8.1). Suite: 36/36 pass.
- [x] U2 — observability session truth (§§2.1–2.2, 4.1–4.3 as grafted, §7.4 trim). Suite: 92/92 pass. [measured] worst-case enriched suspected_crash = 2,164 bytes raw vs the 4,096 cap — fits untrimmed, all 15 device keys + mapMode + msSinceBootStart survive.
- [x] U3 — watchdog parity (§4.4: lcV "2", storageOk, mapMode, msSinceBootStart, subset parser, other new keys literal "unknown", unfinishedBoots absent) + second-canvas WebGL1 fix. Suite at the time: 46/47 pass — the single failure was the byte-budget test, the STOP item below (since resolved; see the resolved record below).
- [x] Parity guard — written and run; at the time it FAILED as expected on this branch (worker allowlist not found — see below). Since resolved on the combined branch (see the resolved record below).
- [ ] Gates — tsc + claimed suites run at the tip; recorded in the builder report.

## Resolved — watchdog byte budget (§7.5 gated decision, taken)

Historical record, in past tense: at the client-unit stage this was
a STOP item. [measured] Rendered watchdog size, worst-case 14-char
build id, as measured then:
- Base (before U3): 5,104 bytes (16 bytes of headroom under 5,120).
- With §4.4 parity + subset parser, before the ladder: 6,210 bytes.
- After the FULL §7.5 ladder (step 1 browserVersion major-only, step 2 engine dropped, step 3 deviceClass dropped): **6,104 bytes** — still 984 bytes over the then-held 5,120 budget.

The ladder was exhausted and the builder did not raise the budget:
the raise to 6,144 was an explicit owner-visible decision
(DESIGN-FINAL §7.5), not the builder's to take, and the byte-budget
test was left at 5,120 and failing on purpose as the stop signal.

Resolution: the gated decision was taken on the combined branch as
its own commit (`4098735`): the budget was raised 5120 → 6144, the
byte-budget test was updated to 6,144, and the watchdog suite went
green (47/47; rendered size 6,104 ≤ 6,144). The owner rules on the
raise with this PR's merge word; it is a decision item in the PR
body.

## Parity guard — resolved

`scripts/observability-field-parity.test.mjs` extracts the client manifest's device keys vs the worker's `DEVICE_FIELD_ALLOWLIST` from `workers/crash-report/src/index.ts`. On the client unit branch the worker side was still main's code, which had no `DEVICE_FIELD_ALLOWLIST` export, so the guard failed by design until the worker unit (U4) landed; it was not weakened to pass. Resolution: on the combined branch the guard went green after commit `a13b035` (the guard's extractor now reads the worker's frozen allowlist declaration; the field lists themselves matched exactly — 17 keys each).

---

# Branch status — unit/crash-telemetry-worker (crash-telemetry U4, worker)

- **Branch:** `unit/crash-telemetry-worker`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` §5 (worker unit U4)
- **Files claimed (exclusive):** `workers/crash-report/src/index.ts`, `workers/crash-report/src/index.test.ts`, `BRANCH_STATUS.md`

## Status checklist

- [x] Commit A — intake + counting: `normaliseEvent` before `validateEvent`
  (§5.1 strip-and-continue, `DEVICE_FIELD_ALLOWLIST` export, caps
  unchanged), counting v2 (§5.2: groups with 32-key hard cap, verdicts
  from the hoisted shared re-derivation, milestones, modes, errorNames,
  receipt firstAt/lastAt, late counter, old-bucket read tolerance).
  Gates: test:worker 95/95, typecheck:worker clean.
- [x] Commit B — surfaces (§5.3): priorityRead (P1 requires
  buildReplaced === false + gameplay last step), enriched alert
  (priority line 3, why-code, time, collective (UA-parsed) device line,
  runtime/mode/boots lines; email gains the same lines incl. device:),
  evidence line for missing_fields from missingStampNames (§5.4,
  presentation-only), digest v2 (per-type blocks, labelled caps with
  (+N more), count-desc/key-asc, receipt first/last, late-arrival
  label, "receipt hour" header), threshold fire-time caveat.
  Full-string goldens for buildAlert (Discord + email),
  buildThresholdAlert, renderDigest; alert/email parity test;
  missingStampNames iff-property test; classifier fixture tables
  re-asserted (classifier region byte-identical to base, verified by
  diff). Gates: test:worker 106/106, typecheck:worker clean.
- [x] Final gates re-run + branch pushed. No PR, no merge (owner's word).
- 2026-11-04: merge-up onto main `ddc0709` (#331) at the owner's merge word for #339 ("339 by rebasing as needed"). Conflicts: six #331-side files (game-app.tsx, capability.ts/.test.ts, satellite-map.tsx, scout-upgrade-lifecycle.test.ts, scout-offer-policy.md) resolved to main's final #331 blobs, verified byte-equal; observability.ts/.test.ts resolved to the panel-voted telemetry blobs (main's post-`c890f80` delta to both files is zero, blob-proven); BRANCH_STATUS.md keeps both records. Delta audit: branch-vs-main = exactly the 15 voted telemetry files, patch line-sets identical to the voted delta `c890f80..ac45e6b` — no code beyond the voted delta, no delta re-vote triggered. Checks re-read on the new tip before merging.
- 2026-11-04: second merge-up onto main `5fe34d6` (#320 landed during the #339 gate run). Sole conflict BRANCH_STATUS.md, resolved keeping both records; the telemetry delta is unchanged (re-audited: branch-vs-main = the same 15 voted files, blobs identical to `ac45e6b`). Checks re-read on the new tip before merging.

---

# BRANCH_STATUS — test/stub-crash-report-in-e2e (PR #320)

- **Branch:** `test/stub-crash-report-in-e2e` · **PR:** #320
- **Refreshed 2026-11-03** onto main `490fab0` (merge commit `541555a`, clean merge, no conflicts). The PR's three-file change (tests/e2e/helpers.ts, pinch-zoom.spec.ts, storyteller.spec.ts, +38/−2) is byte-identical to the original tip `c0a3ffc`'s change: hunk-for-hunk diff comparison identical except blob index lines.
- **Owner order (2026-11-03 22:38 CST):** "Refresh and pstack swarm and architecture and arena interrogate." This run: Phase 0 refresh (done) → swarm (posting inventory / refresh integrity / dependent surfaces) → architect + arena over the stub design → interrogate the final diff → stop at READY. No merge without the owner's per-PR word.
- **Supersession [observed]:** not superseded — current main stubs nothing for the crash-report host in serveBuiltArtifact or pinch-zoom; the observability specs pin the prod endpoint and intercept only for their own inspection, and storyteller's clean-console check still filters the beacon's network error instead of preventing the post.
- **Status:** refresh pushed; swarm / arena / interrogate in progress under the coordinator. Prior record for this branch (below the divider) is main's carried record and is kept intact.

## 2026-11-04 — Arena synthesis implemented (builder run)

Implemented `~/workspace/meridian-pr320-arena/SYNTHESIS.md` (candidate-1 base + grafts G1–G3 + fixes F1–F4) on this branch:

- `tests/e2e/helpers.ts`: `TelemetryEvent`/`TelemetryEscape`/`TelemetryLedger` + `createTelemetryLedger()` (F2: `payloads()` returns a copy); `TELEMETRY_ENDPOINT` derived from `OBSERVABILITY_INGEST_HOSTS[0]`; `handleTelemetry(route, ledger)` as the one policy entry point; `serveBuiltArtifact` returns the per-context ledger (WeakMap, G3 idempotent), registers once-per-context escape listeners (`response` status ≠ 204 + `requestfailed`) that also append JSON lines to the spill file at `MERIDIAN_E2E_TELEMETRY_SPILL`; `collectTelemetry(context, {flags?, endpoint?})` throws on an unserved context; `telemetryGuard(getLedger, {silent?})` for `test.afterEach` (G2). Header comment on `serveBuiltArtifact` states the contract once (serve first → collectors win dispatch → hand-rolled handlers call `handleTelemetry` before `continue()` → stubbed surfaces may show "sent" copy, assert on the ledger).
- `tests/e2e/pinch-zoom.spec.ts` (F3): call-site swap to `handleTelemetry` with a module-scope ledger; its own handler/spoof behaviour unchanged.
- `tests/e2e/storyteller.spec.ts`: bespoke `unstubbedTelemetry` listener + afterEach deleted; `tel = await serveBuiltArtifact(context)` + `test.afterEach(telemetryGuard(() => tel))`.
- Spill hooks (F4): `playwright.config.ts` gains `globalSetup`/`globalTeardown` → new `tests/e2e/telemetry-spill-setup.ts` / `telemetry-spill-teardown.ts`.
- `scripts/e2e-telemetry-guard.test.mjs`: source-scan rules (a)–(d) in the `npm test` scripts suite; `COLLECTOR_FILES` = the 4 inspecting specs.
- `tests/e2e/telemetry-harness.desktop.spec.ts` (G1): forced-`js_error` recorded via stub (A) and via collector (C); plain boot has no escapes (B). 3/3 pass [measured].

**Deviations recorded, not absorbed:**
- Guard EXEMPT does **not** start empty (contra F1): `tap-verify.spec.ts` [measured] imports nothing from `./helpers` — it inlines its own `serveBuiltArtifact` (written when helpers was untracked) and does not stub telemetry. It is the EXEMPT list's single entry, with the reason in the guard test; migrating it is a follow-up outside this scope. The arena inventory missed it.
- F4 demo spec was named `telemetry-spill-demo.desktop.spec.ts` (deleted after the run): the plain `.spec.ts` name matches no project `testMatch` in `playwright.config.ts`, so it would never have run.

**F4 demonstration [measured]:** the temporary demo spec (later 500 route on `TELEMETRY_ENDPOINT` + forced `js_error`) — the test itself passed, the run exited 1 at `globalTeardown` with the escape listed (`{"url":"https://meridian-crash-report.knowledgetest.workers.dev/ingest","status":500,"kind":"response"}`). A teardown throw **does** fail the run at this Playwright version; the `process.exitCode` fallback was not needed. Demo spec deleted.

**Guard negative proof [measured]:** a temporary spec importing nothing from `./helpers` failed rule (a) naming the file + fix; deleted, guard back to 4/4 green.

**Gates [measured]:** `npx tsc --noEmit` clean · `npm test` green (scripts 947 pass / 0 fail incl. the new guard; src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (exit 0; two earlier attempts OOM-killed at prerender under VM contention, third completed) · Targeted E2E (flock, --workers=1, chromium-1243): telemetry-harness 3/3 · storyteller `-g "text-first render"` 1/1 · observability first test 1/1 · pinch-zoom full file 9 passed / 3 failed — the 3 globe zoom-step failures reproduce identically on the unmodified tip `1b88892` in a detached worktree (same dist, same Chromium), so they are pre-existing in this environment, not a regression of this change [measured]. Full E2E suite not run locally (CI's job, per brief).

**Environment note:** this worktree had no `node_modules`; `npm ci` aborted under VM contention, so `node_modules` was copied from a sibling worktree whose `package-lock.json` is byte-identical (md5 `bf080315…`). `dist/` and `node_modules/` are gitignored; nothing of either is committed.

## 2026-11-04 — Interrogation cure round (α/β/γ findings on tip `fbdcada`)

Cured, per the three adversary reports + coordinator synthesis:

- **α-F1** — `tap-verify.spec.ts` now routes telemetry through the shared helpers policy (`createTelemetryLedger` + `handleTelemetry` before its non-loopback `route.continue()`, `watchTelemetryEscapes` on its context); its stale "helpers untracked" header premise is corrected. The guard's EXEMPT list is now EMPTY.
- **α-F3 / cure for pinch-zoom escapes** — escape-listener registration extracted from `serveBuiltArtifact` into exported `watchTelemetryEscapes(context, ledger)` (idempotent per context+ledger pair); `serveBuiltArtifact` calls it; `pinch-zoom.spec.ts` and `tap-verify.spec.ts` call it on their contexts.
- **γ-F2** — pinch-zoom's ledger is per-test: created in `beforeEach` before route registration (no module-scope accumulation), watcher registered there.
- **β-F1** — escape correlation in the watcher: a telemetry request that received a response records no `requestfailed` escape, and one request records at most one escape (per-context answered-Request tracking; a 204 landing after a `requestfailed` retracts it; `requestfailed` spill writes are deferred one macrotask and skipped when retracted).
- **β-F2 + β-F3** — spill path is run-unique (`-<pid>-<Date.now()>`) with a `MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK` path exported by setup; a failed append is `console.error`-logged (never silent) and retried to the fallback; teardown reads BOTH files and throws listing all lines from either.
- **β-F4** — ledger read APIs deep-copy: `all()`/`ofType()`/`first()`/`payloads()` return `structuredClone`d events/payloads (escapes copied too); mutating a returned object cannot change `count()`/`ofType()`.
- **β-F5** — `serveBuiltArtifact` tracks effective `spoofCapableDevice` per context: same-value re-serve returns the ledger; a different value throws naming both values. Double-serve call sites found in the tree are all same-value (storyteller's in-test re-serve of its fixture context; qa-evidence's beforeEach + per-test serves) — no design adjustment needed.
- **β-F6** — `collectTelemetry` is idempotent per context per endpoint: same-endpoint second call is a no-op returning the ledger; a different endpoint throws naming both.
- **β-F7** — new `telemetryGuardFor(context, opts?)` resolves the context's own ledger (throws if never served); `storyteller.spec.ts` migrated to it; `telemetryGuard` stays, doc-commented as advanced/unbound.
- **β-F8** — telemetry-harness Test A now also asserts the recorded `js_error` payload's `error.message === "telemetry-harness-probe"`.
- **β-F9** — `TelemetryEvent.raw?: string`: on parse failure the raw body text is stored (what `postData()` returns; truncated at 2048 chars); `type` stays null, `parseError` stays true.
- **γ-F3/F4/F5/F6/F7** — guard hardening: comment-stripped scanning (state machine respecting string/template/regex literals) for all rules; rules (b)/(d) scan ALL `tests/e2e/*.ts`, rules (a)/(c) specs only; (a) requires an import (aliases resolved) AND a call; (b) requires `handleTelemetry(` before the first `route.continue()` or a `serveBuiltArtifact(` delegation; (c) requires `CONTEXT_FILES` listing + rule (a), with a pin test asserting CONTEXT_FILES equals exactly the derived `browser.newContext(` set (12 files); (d) keeps the literal ban + `COLLECTOR_FILES`, with a pin test asserting it equals exactly the 4 inspecting specs.

**Residuals (recorded, not cured):**
- **γ-F1** — mis-ordered hand-rolled collectors: a hand-rolled collector registered BEFORE `serveBuiltArtifact` is silently starved (the later serve catch-all wins dispatch) and its posts are re-labelled `via="stub"`. No enumerable-routes cure exists in Playwright — there is no API to list a context's registered routes and check their order. The sanctioned path (`collectTelemetry`) throws when called before serve; a mis-ordered hand-rolled spec fails its own capture assertions loudly rather than passing vacuously, and the 4 inspecting specs keep their verified serve-first order.
- **γ-F7 (split-string half)** — a hostname assembled by string concatenation (`"meridian-crash-report." + "knowledgetest…"`) evades the textual literal ban. Textual only: while serving goes through the shared helpers, the runtime stub keys off the real hostname (`OBSERVABILITY_INGEST_HOSTS`), so the split string alone leaks nothing; the runtime escape/spill backstop, not the text scan, is the layer that catches an actual post.

**tap-verify EXEMPT removal:** the guard's EXEMPT mechanism stays, its list is now empty — tap-verify satisfies rule (a) by importing and calling `handleTelemetry` from `./helpers` (see α-F1 above).
- 2026-11-04: merge-up onto main `ddc0709` (#331) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's harness code is unchanged from the interrogated tip `11a7764`. Checks re-read on the new tip before merging.

---

# Prior record preserved on merge: crash-report README audit (PR #308, docs/221-crash-readme-audit)

# BRANCH_STATUS — docs/221-crash-readme-audit (Wave 2, #221)

- **Branch:** `docs/221-crash-readme-audit` · **Base:** `main` @ `2a0527f`
- **Task:** #221 REOPENED as PARTLY fixed — audit `workers/crash-report/README.md` line-by-line against the worker's current code, fix every documentation gap, open a small docs PR. STOP at PR-open (no Silo QA, no panel, no merge — separate dispatches).
- **Tier:** 0 (docs-only). Worker code is FROZEN on this branch: a code-wrong finding is reported, never fixed here.
- **Audit:** sealed at `~/workspace/meridian-issue-wave/evidence/221/AUDIT.md` — 24 gap rows fixed (incl. owner's `counted` at the dry-run example), 1 already-correct group, 2 out-of-scope, 1 code-wrong finding (C1: client emits `storyteller_*`/`narration_*` types the worker 400s — that is the #194 crew's event-acceptance surface).
- **Biggest gaps fixed:** `recovery_outcome` (8th event type, conditional tier) undocumented everywhere; the entire verdict classifier undocumented; `results` response field missing; all error shapes missing; test count stale (42 → 85).
- **Files changed:** `workers/crash-report/README.md`, this file. Nothing else.
- **Done:** [x] audit sealed · [x] README fixed · [x] gates sealed at `~/workspace/meridian-issue-wave/evidence/221/` (test:worker 0 · typecheck:worker 0 · tsc 0 · lint-cards 0 · build:pages 0 · npm test: src suite 1879/1879 pass; scripts suite 851 pass / 1 fail / 9 skip — the 1 fail is `ssr-build-shape` configPath pointing at the sibling `repo/` clone because this worktree's `node_modules` is a symlink to `repo/node_modules`; the same test passes 2/2 on unmodified main in the `repo/` clone, sealed as `ssr-shape-main-control.log`, so it is a worktree-environment artifact, not this docs change) · [ ] PR opened (filled in by the PR-open commit's successor record in the PR body)

---

# Prior record preserved on merge: crash-report worker accepts all 14 event types (PR #311, fix/194-event-type-mismatch)

# BRANCH_STATUS — fix/194-event-type-mismatch (Wave 2, #194 REOPENED)

- **Branch:** `fix/194-event-type-mismatch`
- **Base:** `main` @ `2a0527f` (#295 merged tip at branch start).

## Task capsule

TASK / requested outcome: Fix the three-way observability event-type
mismatch behind reopened issue #194. Owner's facts (verified from
source, 2026-11-02): the app sends 14 event types, the crash-report
worker accepts 8, the docs say 7 — the 6 storyteller/narration types
the app emits are rejected (400) by the worker in production and
silently dropped. Wave 1's docs-only closure in #251 was wrong: it
claimed those 6 "stay client-side and are not sent", and its counts
(13 client / 7 worker) were already stale the day it landed (Slice 2,
#250, had added `recovery_outcome` the day before).

Interpretations considered and selected reading: each app-only type is
either LEGITIMATE (live emission, worker must accept) or DEAD (app
must stop sending). Evidence verdict: **all 6 are legitimate** — built
as COPPA-clean telemetry in #108, emitted on live Storyteller paths,
sent through the same `emit()` transport to the live endpoint in
`public/flags.json`, with no client-side consumer anywhere. Full
per-type evidence: `~/workspace/meridian-issue-wave/evidence/194/DIAGNOSIS.md`.

Tier and rationale: Tier 1 — one clear contract bug, diagnosed from
source first; fix at the worker layer + a drift guard + docs sync.

Done condition / evidence: worker accepts all 14 types; the 6 funnel
types are counted-only (never forwarded individually, like
hiccup-class); per-type acceptance tests + unknown-type rejection
pinned; a drift test in `npm test` keeps the client union and the
worker list equal; every doc list reads 14; gates sealed under
`~/workspace/meridian-issue-wave/evidence/194/` (tsc · npm test ·
test:worker · typecheck:worker · lint-cards · build:pages); PR open.
STOP at PR-open — no Silo QA, no panel, no merge by this run.

Files in scope: `workers/crash-report/src/index.ts` +
`src/index.test.ts`, new `scripts/observability-event-types.test.mjs`,
`docs/observability.md`, `docs/handbook/07-engineering-and-ops.md`,
`workers/crash-report/README.md`, `worker/observability/README.md`
(cross-reference count only), this file. App source: NO change (no
dead types). Frozen PRs #297/#299/#302/#305 and #231/#265/#270/#292/#293
untouched. Claim recorded in the coordination ledger 2026-11-02: Wave 2
claims the crash-report worker surface for #194/#221 per the owner's
express assignment (historically Rock's surface — noted for his round).

## Status

- [x] Diagnosis sealed (evidence/194/DIAGNOSIS.md) — counts 14/8/7 confirmed; all 6 app-only types LEGITIMATE
- [x] Worker fix + tests (worker suite 85 → 90; commit 9f8635c)
- [x] Drift-guard script test (mutation-proven; commit 9f8635c)
- [x] Docs sync (4 files: docs/observability.md, handbook ch07, workers/crash-report/README.md, worker/observability/README.md cross-ref)
- [x] Gates sealed (evidence/194/gates/, on tip 3fb41de): tsc 0 · npm test 0 (scripts 852 pass / 11 skipped; src 1879/1879) · test:worker 0 (90/90) · typecheck:worker 0 · lint-cards GATE PASSED · build:pages 0. E2E not run — no client emission changed (app source untouched). Note: the resume run re-sealed npm test + build:pages after the first sealing attempts lost their exit files when their shell sessions were killed mid-run; the re-run logs are the sealed ones (identical pass counts).
- [x] PR open — PR #311 (2026-11-02, resume run after the prior crew died in a daemon restart; reconciliation found this branch/worktree + sealed DIAGNOSIS.md sound and resumed from them, no restart). STOP at PR-open — no Silo QA, no panel, no merge by this run.

