# BRANCH_STATUS.md — feat/endgame-share

**Branch:** `feat/endgame-share` · **Base:** `origin/main` @ `1152076`
**Task:** End-game sharing — "Share score" on the summary screen using the
native share sheet where available, clipboard fallback elsewhere. Per-place
"Copy result" upgraded to the same helper. Veeresh ordered; ships independently.

## Done
- [x] Worktree created from origin/main @ 1152076; node_modules symlinked
- [x] Verified the gap: `shareText()` (`src/game/share.ts`) exists in Veeresh's
      approved 3-line format; `run-summary.tsx` has no share action;
      `result-card.tsx` ShareResult is clipboard-only
- [x] Design decision: session share uses `shareText()` with session totals,
      no emoji strip (the session banks totals only, never per-place scores;
      the strip is optional in the approved format — omitting it keeps this
      change out of session persistence/scoring)
- [x] Shared share helper (`src/game/share-action.ts`): `shareScore()` —
      native share sheet where available (AbortError → `cancelled`, silent;
      other errors → clipboard), clipboard fallback → `copied`, both failed
      → `failed`; plus `sessionShareText()` (session totals, no per-place
      data) and `SHARE_URL`. `src/components/share-button.tsx` wraps it:
      accessible label, "Shared ✓"/"Copied ✓" via aria-live, global
      `:focus-visible` styling, optional failure fallback
- [x] "Share score" button on the end-game summary (`run-summary.tsx`), above
      "Play again"; `dateKey` threaded from `run.dateKey` via `game-app.tsx`
- [x] Per-place "Copy result" upgraded to "Share result" (`result-card.tsx`)
      via the same helper; keeps the preview `<pre>` and emoji strip
- [x] Unit tests (`src/game/share-action.test.ts`, 11 tests): exact share
      payload / AbortError-cancelled / plain-Error-AbortError-cancelled (no
      DOMException gating, clipboard never touched) / navigator-undefined
      SSR guard → failed / non-abort-fallback / clipboard fallback /
      clipboard-failure → failed / session payload contract (URL present, no
      strip, no distances, no place names)
- [x] Review findings applied: name-only AbortError check, pending guard on
      double-click in ShareButton, direction-neutral failure message ("Copy
      the text from the preview." — correct whether the preview is above or
      below), BRANCH_STATUS a11y note and README share-delivery sentence
- [x] All quality gates green: `npx tsc --noEmit` clean, `npm test` 385/385
      (27 suites), `node scripts/lint-cards.mjs` GATE PASSED,
      `npm run build:pages` green

## Pending
- [ ] Technical-architect review + tone/docs/accessibility review
- [ ] Playwright E2E (clipboard assertion + mocked navigator.share, clean console)
- [ ] PR opened → merged → live build verified → worktree removed

## Notes / decisions
- Do NOT change the `shareText()` format itself — reuse it exactly.
- `navigator.share` needs a user gesture (button click) and HTTPS; guard with
  `typeof navigator.share === "function"`.
- A11y: accessible button label, focus-visible styling, "Shared ✓"/"Copied ✓"
  announced via live region.
