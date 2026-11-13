# fix/nav-label-and-home-cards

**Task:** One Home button everywhere, an even home card grid, and the
owner's A+B Why Learn page (checklist t352u).

**Status:** Draft PR open. Not merged. The owner merges after CI is green.

**Done:**

- `HomeButton` (label `Home`, 44 px, focus ring) replaces every home
  control. `ScreenShell` is the shared page style.
- The home grid is count-driven, with no empty cells at six viewports.
- `lint:nav` bans hand-written home labels and runs in CI.
- `home-layout.desktop.spec.ts` checks the grid and Home (fails 12/12 on
  main, passes 12/12 here).
- Why Learn A+B: a faint montage, a hero with a title band and subject
  cards. No biology in the art.
  `why-learn-page.desktop.spec.ts` passes 8/8.

**Open:**

- Owner call on checklist item 14: one selector line changed in
  `tests/e2e/detective-owner-spec.spec.ts` (`Editions` → `Home`).
- Card one-liners are editable placeholders.

## Graph

```text
main 4ed32319
  └─ a4677f4d docs (council pack)
       └─ da19296b … 917afa2a (this branch)
```
