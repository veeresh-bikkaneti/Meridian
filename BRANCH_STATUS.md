# BRANCH_STATUS — feat/journal-consolidation

**Mission (owner: Veeresh; directive + Phase 0 plan approved 2026-10-16):** ONE PR to main — Journal v2 (verified 106-note dataset, geography grouping, confidence votes, rotation with focus deferral) ported into main's journal, WITH PR #167's storybook art folded in. Priorities, in order: (1) no loss of work, (2) integrity of the live application, (3) the consolidation itself.

**Base:** `origin/main` @ `13347ae` (PR #165). Plan: Phase 0 port plan approved as submitted (Reality Checker blockers incorporated).

**Owner rulings (2026-10-16):**
- Q1 View: main's inline journal section is the host; v2 overlay not carried (its set header, confidence line, countdown footer port in).
- Q2 Timer tests: add the spec §8 fake-timer unit tests in the port (F2 closes in this PR; §8 not amended).
- Q3 Deferral: focus-only, spec-faithful; the scrolled-but-unfocused residual (R5) is accepted as disclosed.
- Q4 Citation labels: leave verbatim; org-label/Wikipedia mismatches are a separate catalog mission later.
- Q5 Art-manifest approved: `scripts/journal-art-manifest.json` as a generator input, hard-fail validation, losslessness test pinning the 6 art values (taj / opera-house / redeemer).
- Q6 Chimney Rock citation: OWNER DECISION PENDING — carry the note as-is; PR body carries the marker; no substitute source.
- Q7 Geography labels: adopt the ring labels; the build-phase where-diff proof must equal exactly the known 39-note set (14× "On the map" → "Lincoln Region, Nebraska"; 25× "World" → "The World"). Any diff beyond that set = stop and ask.
- Q8 Catalog hrefs: carry the 2-line diff into main's `catalog.ts` (haymarket → Haymarket District article; hyde → hydeobservatory.info); the §4.7 full-field diff proof then expects empty.

**Checkpoints:**
- (a) Backup: dataset branch `feat/homepage-premium-v5` @ `9cbbdd2` pushed to origin unchanged — DONE, ls-remote proven (2026-10-16).
- (b) Phase 1: this branch created off `origin/main` + PR #167 folded in intact — DONE and CONFIRMED by Chitti from origin (head `88fbca5`, merge `f6a74df`; see Phase 1 record below).
- (c) Phase 2: Journal v2 port — DONE and CONFIRMED (head `5c7677a`; all four proofs at contract values; Reality Checker READY; Stages A–C records below, including the wave-2 backlog of 103 ids in the Stage C record).
- (d) Phase 3: gates + PR — **gates complete, PR-ready** (see Phase 3 record below). The parent agent opens the PR; nobody merges without the owner's explicit word.

**Phase 3 record (2026-10-17; logs: `~/workspace/your_files/journal-consolidation/phase3-logs/`; screenshots: `~/workspace/your_files/journal-consolidation/phase3-screenshots/`):**
- Conflict check: `git merge-tree` vs current `origin/main` (`13347ae` — main has not advanced since the branch point) exits 0: zero conflicts.
- Gates on the branch tip: `npx tsc --noEmit` clean (`tsc.log`); `node scripts/lint-cards.mjs` GATE PASSED (`lint-cards.log`); `npm test` full green — scripts 790 pass / 0 fail / 9 skipped (799), src 1351 pass / 0 fail (`npm-test.log`); `npm run build:pages` green (`build.log`, `build2-kofi.log`).
- E2E against the built artifact: journal project 5/5 (`e2e-journal.log`; re-run on the KoFi build 5/5, `e2e-journal-kofi.log`); journal-art 1/1 (`e2e-journal-art.log`; re-run 1/1, `e2e-journal-art-kofi.log`); home-badges-readaloud 8/8 (`e2e-home-badges-branch.log`).
- Baseline discipline (`baseline-comparison.txt`): storyteller-tapstart desktop — branch 7 failed / 3 passed, pristine `origin/main` same-environment 7 failed / 3 passed, failing-test identity sets IDENTICAL (the 7 owner-classified pre-existing failures: T1, R1, T2, J2, matrix ×3). Mobile-home-overlap (KoFi builds both sides): branch 20 failed / 4 passed; pristine main merged outcome set IDENTICAL (20/4, same identities — the environment-broken walk/banner geometry family; the journal assertions are not among the failures). No new failure vs baseline anywhere. (Interim preview figure of 22/2 for overlap was a truncated-preview misread; the log tails govern: 20/4 both sides.) The first baseline overlap run lost its exec session at test 15; its partial log was kept and the 390px subset was re-run to complete the 24-test set.
- Build-input note: the first Phase 3 build omitted `VITE_KOFI_URL`; the KoFi-dependent specs refuse to load without it, so the artifact was rebuilt with `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy` baked in (the harness's documented requirement) and the journal specs re-run green on it. The tapstart pair ran without it on BOTH sides (equal inputs; comparison unaffected).
- Bundle delta (`bundle-delta.txt`): the routes chunk carrying the journal dataset — branch 2,341,948 B raw / 679,996 B gzip vs main 2,326,425 B raw / 677,969 B gzip = **+15,523 B raw / +2,027 B gzip**.
- Screenshots (inspected by eye): `journal-desktop.png` + `journal-mobile.png` — inline journal, Lincoln set (Entry 7 of 36), geography header, per-note confidence lines, countdown footer, all correct; `journal-desktop-art.png` — clock-pinned set 26 (Entry 27 of 36, "The World"): all three #167 drawings render atop their notes with Cited confidence lines. The mobile capture also shows the app's first-load tour "Skip tour" chip overlapping the section's top-right corner — tour chrome, not journal markup.
- Disclosed, unchanged: R5 scrolled-but-unfocused deferral residual (Q3, accepted); R11 countdown-while-deferred minor; §8 timer tests exercise the factored `createJournalRotation` controller (Q2 — §8 not amended down); Chimney Rock citation carried as-is — **OWNER DECISION PENDING** (Q6).

**Do-not-touch:** donation copy (locked verbatim), storyteller audio/voice track, homepage layout beyond what the journal port requires, branch protection/rulesets (never lifted). Nobody merges — the PR merges only on the owner's explicit word. PR #167 stays open until the owner says close it.

**Phase 1 record (2026-10-16, local — not yet pushed at time of writing; the parent pushes):**
- Merge: `origin/feat/journal-storybook-art` @ `74b15e8` merged into this branch — merge commit `f6a74df`. The only conflict was this file; resolved per plan step 2a by re-establishing this consolidation BRANCH_STATUS (the merge itself is recorded here).
- #167 intact proof (logs: `~/workspace/your_files/journal-consolidation/phase1-logs/`): `public/images/journal/{taj,opera-house,redeemer}.webp` present in the tree (134,566 / 125,076 / 163,992 B — 423,634 B total, matching the Phase 0 figure); `JournalNote` carries optional `image`/`imageAlt` and exactly the 3 art notes carry values; `journalImageUrl()` in `src/components/home-journal.ts` builds on the exported `assetBase()` from `src/components/storyteller-lines.ts`.
- Gates on the merged tree: `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED; `npm test` green (scripts 769 pass / 0 fail / 9 skipped; src 1324 pass / 0 fail — including #167's journal tests: dataset-is-catalog, art alt/paths/real-files, journalImageUrl deploy-base); `npm run build:pages` green; #167's `tests/e2e/journal-art.desktop.spec.ts` against the built artifact: 1/1 passed. No other E2E was run in this phase (the 7 tapstart desktop failures remain untouched main baseline).

**Phase 2 — Stage A record (2026-10-16, local; logs: `~/workspace/your_files/journal-consolidation/phase2-logs/`):**
- Item 1 — Art manifest (Q5): `scripts/journal-art-manifest.json` created in commit `26f3051`, seeded MECHANICALLY from this branch's `src/components/home-journal.data.ts` (script extraction, `item1-manifest-extract.log`); all 6 values (taj / opera-house / redeemer × image + imageAlt) verified byte-identical against the raw pre-port data file (6/6 raw-string checks).
- Item 2 — Catalog href fix (Q8): commit `76922d9` touches exactly 2 lines in `src/game/catalog.ts` (numstat 2/2, one file; diff in `item2-catalog-diff.log`): haymarket → `Haymarket_District_(Lincoln,_Nebraska)` article; hyde → `https://www.hydeobservatory.info/`. Labels unchanged. After the fix the catalog is byte-identical to v2's catalog.
- Item 3 — Generator adapted: commit `d1699b0` ports `scripts/build-journal-dataset.mjs` + `scripts/build-journal-dataset.test.mjs` from v2, retargeted to emit `JOURNAL_NOTES` + `JOURNAL_SETS` + `GEOGRAPHY_BY_RING` into `src/components/home-journal.data.ts` in the §2 merged schema (id/place/ring/where/story/sourceLabel/sourceHref/confidence, art appended after confidence; header import `../game/types.ts`; `RING_ORDER` generator-internal only, not in the shipped file). Manifest merge is deterministic (catalog order, lookup by id) with HARD-FAIL validation: missing/malformed manifest, duplicate id, unknown id, image-without-imageAlt all abort with named errors. Tests: 21 total (15 adapted from v2 + new losslessness test + 5 manifest hard-fail tests).
- Item 4 — Regenerated dataset + proofs (`proofs.mjs` / `proofs.log` — ALL PROOFS PASSED): generator report 106 catalog places parsed, 106 included, 0 excluded, tiers verified=49 / cited=57, 36 sets (35×3 + 1×1), art merged for taj/opera-house/redeemer. Proofs: (i) 106 notes; id SET and id ORDER identical to pre-port main data @ `13347ae`. (ii) where-diff vs main = exactly the known 39 ids (full list in `proofs.log`): 14× "On the map" → "Lincoln Region, Nebraska" + 25× "World" → "The World". (iii) vs v2 dataset modulo §2 renames + art merge: story/place/label/href/ring/where/confidence diffs all 0, and sets identical to v2's; vs main: story/place/label diffs 0, href diffs = exactly the 2 Q8 ids (haymarket, hyde). (iv) tiers 49 verified / 57 cited. (v) 36 sets = 35×3 + 1×1; set index 26 = {taj, opera-house, redeemer} and is the ONLY set whose notes carry image fields; sets partition the 106 ids exactly once. (vi) second generator run byte-stable (sha256 unchanged).
- Stage A gates: generator tests 21/21 pass (`gate-generator-tests.log`); `npx tsc --noEmit` clean (`gate-tsc.log`); `node scripts/lint-cards.mjs` GATE PASSED (`gate-lint-cards.log`); full `npm test` green (`gate-npm-test.log`): scripts 790 pass / 0 fail / 9 skipped (799 total), src 1324 pass / 0 fail. Expected Stage-B breakage in `src/components/home-journal.test.ts`: NONE observed — all 4 existing tests pass on the regenerated data (they assert count/ids/story/sourceHref/art/imageUrl/window behavior, none of which the schema + where changes disturb); the Stage B test rewrites (plan items 7/8/14) remain planned work, not failure-driven.

**Phase 2 — Stage B record (2026-10-16, local; logs: `~/workspace/your_files/journal-consolidation/phase2-logs/stageB-*`):**
- Item 5 — Engine port (commit `0e9320b`): `src/components/home-journal.ts` now carries the v2 set engine over the merged dataset — `journalSetAt` / `journalSetByIndex` / `journalSets` / `journalSetIndexAt`, `journalSetCount` / `journalNoteCount`, `nextWindowStart`, `nextEntryCountdown`, `confidenceText` / `confidenceForHref` — replacing the sliding-triple API (`journalWindow` / `notesForWindow` / `JOURNAL_PAGE` removed; its only consumers were `game-app.tsx` and the test file, both ported here). `JOURNAL_WINDOW_MS` stays exported at 7,200,000 (v2's `WINDOW_MS` alias dropped); `journalImageUrl()` + the `assetBase()` seam are kept verbatim. `shouldApplySetChange` takes the NEW inline-host signature `{ focusInsideCard, focusInsideSection }` (v2: `{ overlayOpen, focusInsideCard }`), same truth-table semantics; its test is updated to the new names.
- Item 5 — §8 fake-timer tests (Q2; closes v2 review F2 in this PR; §8 NOT amended). Reading implemented: §8 asks for "auto-switch timer behavior with fake timers" and "focus-deferral of swaps" as UNIT tests, but the wiring lives inside a React component and this repo's unit suite (node --test, no DOM renderer) cannot mount it — so the strongest reasonable reading is that the wiring mechanism itself must be unit-testable production code. The mechanism (boundary timeout at the next window start + 50 ms, 30 s safety interval, recompute with pending-index deferral) is factored into `createJournalRotation` in `home-journal.ts`, the home component drives exactly that controller (its `visibilitychange`/`focusin` listeners call `rotation.recompute()`), and 5 unit tests exercise it with an injected fake timer host + fake clock: boundary-timeout apply + rescheduling, safety-interval catch of a throttled/missed boundary, deferral under focus-in-section, deferral under focus-in-card, no-swap-inside-one-window + `stop()` clearing both timers.
- Item 5 — Test accounting: `src/components/home-journal.test.ts` went from 4 tests to 31 (log `stageB-item5-engine-test.log`: 31 pass / 0 fail). Contents: #167's 3 preserved art tests (dataset-is-catalog, art alt/paths/real-files, journalImageUrl deploy-base — the 4th pre-port test covered the removed sliding API and is superseded by the set-engine tests); v2 `journal.test.ts`'s 16 rewritten against merged field names; v2 `journal-data.test.ts`'s 7 rewritten as dataset-integrity tests (verbatim story/place/sourceLabel/sourceHref vs catalog `PLACES` via `../game/catalog.ts`, 106 count, id-set equality, notes in catalog order, tiers 49/57, stored confidence == recomputed `confidenceForHref`, sets partition ids exactly once, `note.where == GEOGRAPHY_BY_RING[note.ring]`); the 5 §8 tests above. `RING_ORDER` is restated locally in the test (generator-internal per plan §2, not shipped).
- Item 6 — Inline display port (commit `43b5773`): in `game-app.tsx`'s home component the `journalNow` sliding-window timeout block is replaced by the full v2 mechanism — current-set index state driven by `createJournalRotation` (boundary timeout, 30 s safety interval), recompute on `visibilitychange` and on `focusin`, pending-index deferral via `shouldApplySetChange({ focusInsideCard, focusInsideSection })`, plus the 60 s countdown tick (`journalNowMs` state + 60,000 ms interval) so the footer stays live. Section `#home-journal` gains the set-geography header (pure set → its geography label; mixed → "Field Notes"), a per-note confidence line (`confidenceText` verbatim forms) under each note, and the footer `Entry X of 36 · Next entry in h:mm`; the "New notes every 2 hours" label is subsumed by the footer and removed. The home Journal card gains the now-showing label in v2's exact forms (pure → `Now showing: {geography} · {n} field notes`; mixed → `Now showing: Field Notes`, no count); READ THE ENTRY keeps its shipped scroll-jump + focus behavior and nav JOURNAL is unchanged. #167's article-top art `<figure>` is byte-untouched. Markup-only `data-testid` hooks mirroring v2's journal-view: `journal-card`, `journal-now-showing`, `journal-open` (card); `journal-section`, `journal-geography`, `journal-note`, `journal-footer` (section). CSS: add-only scoped rules in `home-v5.css` under `.home-v5` (`.hv5-journal-now`, `.hv5-journal-geography`, `.hv5-journal-confidence`, `.hv5-journal-footer`).
- R5 disclosure (Q3, accepted): deferral is FOCUS-ONLY — a reader who is merely scrolled to the journal section without focus inside the card or the section can still have the set swap under them at a window boundary; this residual is accepted per the owner's Q3 ruling and is not coded against.
- Item 7 — E2E + Playwright project (commit `8294cba`): `tests/e2e/journal.spec.ts` adapted from v2's overlay spec to the inline surface (5 tests: current set renders with confidence lines + dataset-exact hrefs — `expectedNotes()` reads `src/components/home-journal.data.ts` and regexes `"id"`/`"sourceHref"`; READ THE ENTRY scrolls to + focuses the section; rotation advances at a window boundary under a controlled clock; focus-inside-section deferral blocks the swap until focus leaves; the 1-note remainder set renders as "Field Notes"). `playwright.config.ts` gains the `journal` project (plan item 4a; testMatch `/journal\.spec\.ts/`, 1440×900). #167's `tests/e2e/journal-art.desktop.spec.ts` received ONLY the disclosed clock pin (§1c): `page.clock` installed BEFORE `goto`, `runFor(1_000)` drain, pinned to set index 26, disclosed in a visible spec comment — no other change. Results against the built artifact, per-file, first run each: journal spec 5/5 passed (log `stageB-e2e-journal-run1.log`); journal-art spec 1/1 passed (log `stageB-e2e-journal-art-run1.log`). A throwaway probe (log `stageB-art-pin-probe.log`, not committed) confirmed the pin is non-vacuous: set 26 renders exactly the taj / opera-house / redeemer images, all decoded.
- Stage B gates on the final tree (logs `stageB-gate-*.log`): `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED; `npm test` FULL green — scripts 790 pass / 0 fail / 9 skipped (799 total), src 1351 pass / 0 fail (1324 at Stage A + 27 net from the test merge: 4 → 31 in home-journal.test.ts); `npm run build:pages` green. No stop conditions were hit; the do-not-touch list is untouched (donation copy, storyteller audio, homepage beyond the journal regions, rulesets).

**Phase 2 — Stage C record (2026-10-16, local; logs: `~/workspace/your_files/journal-consolidation/phase2-logs/stageC-*`):**
- Item 8a — Spec as adapted (commit `143a6be`): `docs/journal-spec.md` landed from the v2 branch (`origin/feat/homepage-premium-v5`), ADAPTED per plan item 1. An amendment note at the top states plainly that the original overlay description no longer matches what ships and that §§5/6/8 were rewritten for the inline host in the consolidation (owner-approved, plan Q1). §5 (view) now describes main's inline `<section id="home-journal">` in `game-app.tsx` — no dialog/overlay, no focus trap/Esc/focus-return machinery; §6 (blockers/deferral) now names the inline-host blockers (focus inside the card or inside the section; focus-only per Q3, R5 residual accepted); §8 (verification/E2E) is rewritten for the inline host — E2E surface = the section, not a view — while the unit fake-timer requirement is NOT weakened: it stays, and is now satisfied, the wiring mechanism being unit-tested via `createJournalRotation` in `src/components/home-journal.ts` with an injected fake timer host (Stage B; the §8 reading disclosure is in the Stage B record above). Everything else in the spec is the v2 text verbatim (dataset rules §§1–§4, set composition §3, confidence §4, §§7/9), except one path reference the port changed: §1's generator output is now `src/components/home-journal.data.ts` (was `src/game/journal-data.ts`). Diff vs the v2 spec: `stageC-spec-diff-vs-v2.log`.
- Item 8b — Handbook (commit `56cbdd6`): in `docs/handbook/06-design-and-ux-decisions.md` (§7), the stale bullet describing nav JOURNAL and the Journal card's READ THE ENTRY as unmapped (`aria-disabled`) is rewritten to describe what now ships: the inline journal section (live since #165), the v2 port behavior (geography sets rotating every 2 hours, focus-only deferral, per-note confidence line, set-geography header + "Entry X of 36" footer, READ THE ENTRY scroll-jump + focus, storybook art on 3 notes). Nothing else in the file was touched. Diff: `stageC-handbook-diff.log`.
- Item 9 — Wave-2 backlog: see the next section. The 103 note ids without drawings, derived mechanically from the generated dataset; this list is the wave-2 art worklist.
- Phase 2 record completeness: Stage A (items 1–4), Stage B (items 5–7, including the §8 reading disclosure and the R5 disclosure), and Stage C (items 8–9) records are all in this file — the Phase 2 record is complete. Chimney Rock remains carried as-is (Q6, OWNER DECISION PENDING for the PR body in Phase 3).

**Wave-2 backlog — notes without drawings (103, plan §6 step 6):**
Derived mechanically from the generated `src/components/home-journal.data.ts` (notes lacking an `image` field) by `stageC-backlog-derive.mjs`; output in `stageC-backlog-derivation.log` (assertions passed: 106 notes total, 103 without image, ids unique). The ONLY ids absent from this list are the 3 notes that already carry storybook art: `taj`, `opera-house`, `redeemer`. Wave-2 art generation starts from this list, keyed by id, in dataset order:

1. `capitol`
2. `memorial-stadium`
3. `haymarket`
4. `pinnacle`
5. `27th-and-o`
6. `centennial-mall`
7. `sunken-gardens`
8. `childrens-zoo`
9. `48th-and-o`
10. `holmes-lake`
11. `pioneers-park`
12. `wilderness-park`
13. `antelope-park`
14. `oak-lake`
15. `wyuka`
16. `lincoln-airport`
17. `union-plaza`
18. `gateway`
19. `southpointe`
20. `havelock`
21. `college-view`
22. `university-place`
23. `near-south`
24. `hyde`
25. `robbers-cave`
26. `star-city-shores`
27. `quilt-museum`
28. `woods-park`
29. `conestoga`
30. `branched-oak`
31. `mahoney`
32. `sac-museum`
33. `seward`
34. `homestead`
35. `pawnee-lake`
36. `platte-river-sp`
37. `ashland`
38. `wahoo`
39. `wagon-train`
40. `spring-creek`
41. `arbor-lodge`
42. `beatrice`
43. `stagecoach`
44. `grand-island`
45. `henry-doorly`
46. `old-market`
47. `chimney-rock`
48. `scotts-bluff`
49. `archway`
50. `durham`
51. `carhenge`
52. `kingsley`
53. `smith-falls`
54. `fort-robinson`
55. `valentine`
56. `joslyn`
57. `golden-spike`
58. `indian-cave`
59. `ashfall`
60. `toadstool`
61. `chadron`
62. `niobrara`
63. `white-house`
64. `golden-gate`
65. `grand-canyon`
66. `old-faithful`
67. `rushmore`
68. `gateway-arch`
69. `french-quarter`
70. `space-needle`
71. `niagara`
72. `alamo`
73. `willis`
74. `crater-lake`
75. `monument-valley`
76. `pike-place`
77. `cadillac`
78. `denali`
79. `everglades`
80. `death-valley`
81. `hoover`
82. `eiffel`
83. `colosseum`
84. `liberty`
85. `sagrada`
86. `giza`
87. `cn-tower`
88. `machu`
89. `fuji`
90. `chichen`
91. `stonehenge`
92. `neuschwanstein`
93. `angkor`
94. `petra`
95. `table-mountain`
96. `uluru`
97. `victoria-falls`
98. `fushimi`
99. `iguazu`
100. `tongariki`
101. `potala`
102. `timbuktu`
103. `galapagos`

**Content source of truth:** `origin/feat/homepage-premium-v5` @ `9cbbdd2` is READ-ONLY for this crew — flag content disputes to the owner, never silently edit the dataset. Note ids are load-bearing: never rename/remove an id; count stays 106.
