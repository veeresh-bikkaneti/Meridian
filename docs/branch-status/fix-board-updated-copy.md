# fix/board-updated-copy — branch status

**Task:** On the What's Coming board (`/board`), remove the platform/coverage wording from the header's updated line (Radhae, reviewing the live page 2026-11-16: the wording "is not professional"). Draft PR only — Veeresh merges.

**Base:** current main `2ce6757ae1`. The branch was first built on `b2ef88a7a1`; while it was in flight, main landed #507, #508 (board v4 trail), #509 and #483, two of which touched `src/routes/board.tsx` and `tests/e2e/board.desktop.spec.ts` elsewhere in the file. The change was rebased onto the new main and every gate below was re-run on the rebased tree; the board v4 work did not touch the updated-line composition, the counts line, or the live-feed test this branch edits.

**Choice made:** Keep a freshness line — the header now reads only `Updated <date>`, using the same date source and format the code already computed (`formatUpdated(board.updatedAt)`). Nothing is hard-coded. Removing the line entirely was the alternative; keeping the stamp alone reads cleaner and loses no information a reader needs.

**What changed (4 files):**

- `src/routes/board.tsx` — the updated line no longer prefixes the live-check platform/coverage wording when a check completes; it renders the snapshot's Updated stamp alone in every state. The header doc comment is updated to match. Nothing else in the file changes: the live feed still runs, still recomputes statuses on full coverage, still shows its plain note when a check cannot complete, and the counts line, story data and snapshot fallback are untouched.
- `src/board/board-data.test.ts` — the one source-scan pin that required the old wording is flipped: the route must NOT carry the platform/coverage wording, and must keep the Updated stamp. The guard's other halves (snapshot layer and route never fetch; the feed module owns the check) are unchanged.
- `tests/e2e/board.desktop.spec.ts` — the one completed-check spec that expected the old wording now expects the updated line to start with "Updated " and to contain neither the platform wording nor "linked record"; its counts assertions (the board still upgrades on a completed check) are unchanged.
- This status file.

**Untouched on purpose:** the coverage data itself (the feed still counts covered/wanted records internally and in its result type), the banned-token scan in `status-core.ts` (it scans published content for exactly this kind of wording — it is a guard, not page copy), every other string and behaviour on the page.

**Checks (all run in the prepared tree on main `2ce6757ae1` + this change):**

- Board targeted tests: `node --experimental-strip-types --test "src/board/**/*.test.ts"` — 58 pass / 0 fail.
- Full src suite: `node --experimental-strip-types --test "src/**/*.test.ts"` — 2786 pass / 0 fail (246 suites).
- `npx tsc --noEmit` — clean.
- `npm run lint:nav` — clean. `npm run lint:subjects` — GATE PASSED. `node scripts/lint-cards.mjs` — GATE PASSED. `npm run lint:content` — GATE PASSED (6 baselined, 0 new).
- E2E spec parse: `playwright test --list tests/e2e/board.desktop.spec.ts` — 18 tests listed, including the renamed completed-check test.
- `npm run check:provenance` — cannot run meaningfully here (it scans a git range; this tree has no `.git`). Emulated with the script's own `findVendorName` over every added line of the diff, the commit message and the PR body: 0 vendor/model-name hits. The publishing commit is authored as the repo owner, per the enforced rule.
- Build: `GITHUB_PAGES=1 npx vite build` — green (exit 0), before and after variants. This is the direct vite build used for the behaviour proof, not the full `build:pages` pipeline; CI runs the full pipeline.

**Behaviour proof** (headless Chrome over CDP, the repo's disclosed Playwright substitute; Playwright cannot run in this sandbox): local builds of the before (new main, unmodified) and after trees at 1280×800, with the board's live check fulfilled the way the e2e spec fulfils it (payload built from the repo's own curation + captured record states, full coverage of all 31 linked records — completion verified via the feed's session cache in both runs, not assumed):

- Before: updated line = the old platform/coverage line ending "· Updated Nov 16, 2026, 12:26 PM" (the proof browser renders the stamp in UTC; on the live page in Radhae's timezone the same stamp reads 6:26 AM); counts "20 of 37 stories finished · 4 being built · 13 not started yet".
- After: updated line = "Updated Nov 16, 2026, 12:26 PM"; counts identical; no live note.
- One intermittent uncaught exception was logged by the headless browser in both the before and after runs (it also appeared in one of the two runs on the previous base, and not in the other) — present in the unmodified build, not introduced by this change; its text was not captured beyond "Uncaught".
- Screenshots + result JSONs: `fix3-proof/` in the run notes (not in the repo).

**Not tested:**

- Playwright e2e does not run in this environment; the updated spec is carried by CI.
- The live site was not re-checked after this change (it is a draft PR; nothing is deployed).

**Next step:** Veeresh reviews and merges. No dependencies; this branch does not touch any other in-flight branch.
