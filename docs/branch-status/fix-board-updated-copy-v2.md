# Branch status — fix/board-updated-copy-v2

Rebuild of PR #516 (`fix/board-updated-copy`, head `0cf46af8`), which is
19 commits behind and clashes with current main; its intent is not on
main. Base: origin/main `60feec3c`. Tier 0 (copy that is not locked).

**Owner ruling 2026-11-16:** the /board "What's coming" header keeps only
its Updated stamp — no platform or coverage wording in the header, in any
state.

## What this branch does

- `src/routes/board.tsx`: the `board-updated-line` paragraph no longer
  prefixes "Checked just now — every linked record checked (N of N) · "
  when the live check completes; it renders only `Updated
  {formatUpdated(board.updatedAt)}` plus the existing "showing the copy
  that came with the site" suffix logic. The live feed, the
  `board-live-note` unavailable note, and the stale note are unchanged;
  `liveLine` stays (the unavailable note uses it). The file header
  comment now records the 2026-11-16 ruling.
- `src/board/board-data.test.ts`: the failure-mode guard now asserts the
  route source does NOT contain "every linked record checked" and DOES
  contain `Updated {formatUpdated(board.updatedAt)}`; the two
  api.github.com asserts are kept.
- `tests/e2e/board.desktop.spec.ts`: the live-feed test "a completed
  check upgrades the board; the header keeps the Updated stamp" asserts
  the updated line matches `/^Updated /` and contains neither
  "linked record" nor "Checked just now"; the counts asserts are kept.
- Mockup evidence (standing rule, before any code change):
  `docs/branch-status/fix-board-updated-copy-v2/before.png` (live state:
  "Checked just now — every linked record checked (31 of 31) · Updated
  …") and `after.png` (same full-coverage check: "Updated …" only),
  captured at 1280x800 against the built artifact with api.github.com
  fulfilled to full coverage.

## Gates run

| Gate | Result |
| :--- | :--- |
| `npm run typecheck` | PASS |
| `node --experimental-strip-types --test src/board/board-data.test.ts` | PASS (11 pass / 0 fail) |
| `npm run lint:nav` | PASS |
| `npx playwright test tests/e2e/board.desktop.spec.ts --workers=1 --project=desktop` | PASS with one pre-existing failure: 18/19 pass, incl. the edited live-feed test; the molecular-map mirror test fails identically on a lone re-run and on pristine origin/main `60feec3c` (verified in a scratch worktree), so it is not a regression from this branch |

## Links

- Rebuilds PR #516 (branch `fix/board-updated-copy`, head
  `0cf46af8ff87aed59a99ef8b59594c75a45804e6`, title "Board copy: the
  What's Coming header keeps only its Updated stamp"). #516 stays open;
  the main session closes it after review.

## Graph

No `docs/knowledge/graph.json` writes (integrator-only). Node/edge the
integrator may fold in on merge: branch `fix/board-updated-copy-v2`
supersedes branch `fix/board-updated-copy` (PR #516); decision node for
the owner ruling of 2026-11-16 ("/board header keeps only the Updated
stamp") gains a `decided-by` edge from this branch's status file.
