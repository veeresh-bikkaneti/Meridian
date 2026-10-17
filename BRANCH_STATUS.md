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
- (b) Phase 1: this branch created off `origin/main` + PR #167 folded in intact — DONE locally (see Phase 1 record below); reported to the owner, awaiting Chitti's confirmation from origin before Phase 2.
- (c) Phase 2: Journal v2 port — waits for Chitti's confirmation of (b) + owner go.
- (d) Phase 3: gates + PR — after (c).

**Do-not-touch:** donation copy (locked verbatim), storyteller audio/voice track, homepage layout beyond what the journal port requires, branch protection/rulesets (never lifted). Nobody merges — the PR merges only on the owner's explicit word. PR #167 stays open until the owner says close it.

**Phase 1 record (2026-10-16, local — not yet pushed at time of writing; the parent pushes):**
- Merge: `origin/feat/journal-storybook-art` @ `74b15e8` merged into this branch — merge commit `f6a74df`. The only conflict was this file; resolved per plan step 2a by re-establishing this consolidation BRANCH_STATUS (the merge itself is recorded here).
- #167 intact proof (logs: `~/workspace/your_files/journal-consolidation/phase1-logs/`): `public/images/journal/{taj,opera-house,redeemer}.webp` present in the tree (134,566 / 125,076 / 163,992 B — 423,634 B total, matching the Phase 0 figure); `JournalNote` carries optional `image`/`imageAlt` and exactly the 3 art notes carry values; `journalImageUrl()` in `src/components/home-journal.ts` builds on the exported `assetBase()` from `src/components/storyteller-lines.ts`.
- Gates on the merged tree: `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED; `npm test` green (scripts 769 pass / 0 fail / 9 skipped; src 1324 pass / 0 fail — including #167's journal tests: dataset-is-catalog, art alt/paths/real-files, journalImageUrl deploy-base); `npm run build:pages` green; #167's `tests/e2e/journal-art.desktop.spec.ts` against the built artifact: 1/1 passed. No other E2E was run in this phase (the 7 tapstart desktop failures remain untouched main baseline).

**Content source of truth:** `origin/feat/homepage-premium-v5` @ `9cbbdd2` is READ-ONLY for this crew — flag content disputes to the owner, never silently edit the dataset. Note ids are load-bearing: never rename/remove an id; count stays 106.
