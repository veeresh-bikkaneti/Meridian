# feat/board-cleanup

**Task:** Clean up the live board pages (trail + molecular structure),
using the Sprintbound v2 zip as a polish/organization reference only:
(1) player-words, current-state data; (2) an animated life pill on each
feature card; (3) the opened feature groups its stories Completed /
In progress / Blocked / Not started; (4) molecular map cleanup (thin
theme bonds, collision-safe labels, fitted framing); (5) an organization
pass — Sprintbound's grouping/alignment/region-order discipline in
Meridian tokens.

**Owner calls used:**

- Liz, 2026-11-16 04:32 CT: the current production pages are liked and
  stay; they "need to be clean up using the manus v2 i shared".
- Liz, 2026-11-16 04:38 CT (tap): "Cleanup + add the life pill &
  grouped feature view".
- Liz, 2026-11-16 04:40 CT: the reference is used because "that is more
  organized" — organization is the standard for part 5.
- Standing laws: no tech tasks shown; % delivered = finished stories /
  all stories in the feature; Blocked = waiting on an unfinished story;
  live = current state of the application with an honest Updated stamp;
  tips reachable from the board; website theme (system load, switchable).

**Status:** In progress. Base: main cf7afb6f (verified 2026-11-16).

## Done

- Part 1 (data): the v4 player-words data layer (PLAYER_TITLES,
  LINE_OVERRIDES, exclusion list, publish guards incl. scanDevLanguage)
  brought over from feat/board-v4; regenerated curation + published
  files. Input corrections, each verified first-hand on main:
  record-states PR 430 → merged (merge commit 8e3fd95b is in main);
  carried status of math/holmes-and-watson-in-math → done (PR #476,
  8875488c, is in main) and math/math-sign-off-and-release-pr → done
  (src/subjects/math/index.ts carries released: true on main).
  Regenerated board: 37 stories, 20 done / 4 in progress / 13 not
  started, 8 bonds — story-for-story identical to the independently
  corrected cross-check (~/workspace/board-dashboard-sample/data.json).

## Next step

- Parts 2–5 (life pill, grouped feature view, map cleanup, organization
  pass), then the full gate mirror + visual E2E, then the PR.

## Graph

- decision node: board cleanup scope (Liz, 2026-11-16) — production
  pages stay, Sprintbound v2 is a polish reference only.
