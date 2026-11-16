# feat/board-controls — status

## Task capsule

- **Objective:** Fix 2 — responsive board controls on `/board`. Small screens:
  one slim visible bar with a hamburger (☰ + "Menu") hiding ALL controls
  (views + theme switch + Calm toggle) in a single-column panel. Big screens:
  the same controls laid out in a horizontal nav bar in the header, no
  hamburger. Buttons prominent in both modes (the page is busy; they are easy
  to miss), layout consistent with the homepage and game pages.
- **Owner rulings (2026-11-16):** hamburger on small screens; horizontal nav
  bar on big screens; controls easy to see and attention-grabbing; layout
  consistent with the homepage and other game pages.
- **Base:** stacked on `feat/board-cleanup` (PR #506) at remote tip
  `3f7a6366` — the live-feed wave had landed there before this branch's
  code was written, so Fix 2 is built directly on the feed version of
  the header (feed status line untouched; only the control block below
  it is restructured). No PR for this branch; the coordinator
  integrates it after both waves report. Never merge from this branch.
- **Scope:** `src/routes/board.tsx` (nav JSX + menu state), `src/board/board.css`
  (nav block), `tests/e2e/board.desktop.spec.ts` (menu coverage). No behaviour,
  persistence, testid, or accessible-name changes to any control.

## Plan

1. Study homepage header/nav + primary buttons (home-v5), a play page's
   controls, and the board header after Fix 1. ✅ done — see notes in the
   final report (`~/workspace/board-cleanup/REPORT-FIX2.md`).
2. Restructure the board nav: menu bar (small) / horizontal bar (big),
   prominence pass from the site's own action styles. ✅ built
3. Extend board e2e: 390px menu open/Esc/theme/view-pick flow; existing
   desktop specs keep passing against the big-screen bar. ✅ built
4. Gates: `build:pages`, board e2e on the built artifact, `lint:nav`, tsc,
   `check:provenance`. Captures: 390 closed / 390 open light+dark / desktop.
5. Push via the GitHub API helper with tree equality. No PR.

## Log

- 2026-11-16 — branch first cut at the pre-feed tip (`85c28530` twin);
  the first worktree was destroyed mid-build when an earlier
  backgrounded GitHub clone failed and git's failure cleanup removed
  the shared target path. Worktree re-cloned locally; on re-check the
  feed wave had landed on the remote (`3f7a6366`), so the branch was
  reset onto that tip and the Fix 2 changes applied to the feed
  version of the files.
- 2026-11-16 — Fix 2 built: `src/routes/board.tsx` (Menu bar + panel,
  focus/Esc/outside-tap contract, view picks close the panel),
  `src/board/board.css` (responsive nav block, prominence anatomy),
  `tests/e2e/board.desktop.spec.ts` (+1 test: the 390px menu flow).

## Graph

- No nodes or edges added: no new files, specs, or decisions — one
  branch-local restructure of the board header controls.

## Handoff (2026-11-16)

- **Done:** Fix 2 built and gated on local head `1fe5ec34` (this file's
  own update rides a follow-up commit). Gates, all on the built
  artifact / this tree: `npx tsc --noEmit` clean · `npm run lint:nav`
  clean · board unit suites 58/58 (`node --test src/board/**`) ·
  `npm run build:pages` green · board Playwright e2e 17/17
  (`tests/e2e/board.desktop.spec.ts`, `--workers=1`, flock protocol;
  includes the new 390px menu-flow test and all live-feed tests) ·
  `npm run check:provenance` PASSED for origin/main..HEAD.
- **Captures:** `~/workspace/board-cleanup/screenshots/menu/`
  (menu-390-closed, menu-390-open-light, menu-390-open-dark,
  menu-desktop-nav), read first-hand; write-up in
  `~/workspace/board-cleanup/REPORT-FIX2.md`.
- **Next step:** the coordinator integrates this branch into
  `feat/board-cleanup` (PR #506) after both waves report; the merge
  itself is the owner's word on the final integrated head.
- **Open questions:** none for this branch.
- **Ruled out:** a bespoke new control style (the consistency ruling —
  the bar/panel reuse the site's own pill anatomy and hv5 tokens);
  hiding the desktop controls behind the hamburger (owner: big
  screens get the horizontal bar); closing the panel on theme/Calm
  picks (settings are not navigation; the panel stays open).
