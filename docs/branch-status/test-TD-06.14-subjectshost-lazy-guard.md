# test/TD-06.14-subjectshost-lazy-guard

## Branch

`test/TD-06.14-subjectshost-lazy-guard`

## Base

`origin/main` at `4128e16e` (PR #634 merged — TD-05.4 + TD-06.12–06.15a).

## PR

Draft. Title: `test(game-app): guard SubjectsHost lazy load and restore baseline format (TD-06.14)`.

## Goal

Follow-up to #634, closing its review findings 4 and 6. Commit A guards the SubjectsHost lazy load with a unit test (mutation-proven). Commit B restores `eslint/shell-ban-baseline.json` to its pre-#634 formatting, keeping today's 3 rows. Commits 7–10 are untouched — they get their own PRs later.

## Done

- Commit A: lazy-boundary test asserts SubjectsHost loads SubjectPicker only via dynamic `import()`, never a static import. Mutation proof: static import fails the test, restore passes (20/20).
- Commit B: `eslint/shell-ban-baseline.json` restored to its pre-#634 compact single-line format (no trailing newline), keeping today's 3 pageLocalMain rows. `git diff 4128e16e~1` now shows only the removed homeButtonImport row (+ its documenting comment sentence). No script writes this file (all readers) — the reformat was done by re-serializing the parsed JSON.

## Next step

Push both commits, open the draft PR, report.

## Open questions

- Owner rulings still open: `<main>` placement for commit 7 (pageLocalMain), and kanban cards for FW-11, FW-11.1 and TD-05.4.
