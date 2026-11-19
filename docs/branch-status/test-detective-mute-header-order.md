# test/detective-mute-header-order — status

## Done
- Reproduced the stale mute-position failure on unmodified main
  (ea1af3da): `detective-owner-spec` "the one mute" failed at the
  `mute right edge <= caseLabel.x` assertion (received 281.19, expected
  <= 183.63).
- Updated the one geometry assertion in
  `tests/e2e/detective-owner-spec.spec.ts` to the SiteHeader contract
  from #529: the actions group renders status ("Case #N"), then mute,
  then End game. The mute is now pinned to the same row as Home, right
  of Home, right of the "Case #N" label, and left of End game when End
  game is visible. Test renamed (no longer says "top-left"); the two
  "no speaker by the pair" checks are unchanged.
- Verified: the single test passes (detective-owner-spec project);
  `npm run lint:nav` clean; `npm run typecheck` clean.

## Next step
- Owner's merge word. After this merges, PR 538 gets
  `gh pr update-branch 538` so the Detective e2e workflow reruns
  against the fixed spec.

## Open questions
- None.

## Ruled out
- Any app-code change: #529's header order is the cross-screen
  contract, so the spec was stale, not the header.
