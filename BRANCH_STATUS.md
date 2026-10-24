# BRANCH_STATUS — fix/storyteller-pending-tap

**Branch:** `fix/storyteller-pending-tap`
**Base:** origin/main @ `ddb6d28c` (PR #242 merged; includes #241 merged as
`fa9f36b`, #244 as `a59ee4c9`, #245 as `28c5fea0` — all untouched by
this branch)
**State: PORT COMPLETE — branch pushed, PR #243 open; this head rebased
onto `ddb6d28c`, local only, pending owner-route landing.** It
supersedes the previous contents of this file. PRs #241, #244, #245
and #242 are merged, and untouched by this branch.

## Scope (exactly this — no drive-by changes)

One mechanism, ported from the certified (but superseded) branch
`fix/storyteller-narration-lifecycle` @ `08fef62`: the pending-tap
intent (`tapStartPendingRef`). A figure tap that lands while the
greeting is pending in `greeting_text` and the asset manifest is still
in flight is remembered, and the greeting starts when `greetAudio`
resolves. The 2026-10-16 settled check
(`SETTLED-CHECK-2026-10-16.md`) proved this is the one piece of that
fix still missing from main; everything else was superseded by #152
(entering watchdog — main's `ENTER_HANG_MS`) and #153 (dismissed-
greeting protection, rapid-tap guard, "Hear again"), and none of it is
reintroduced here. `shouldForceEnterAdvance` is NOT ported.

## Commits

1. `ba666bd` — test: repro spec ported verbatim from the certified
   branch (`tests/e2e/storyteller-narration-tap-pending.desktop.spec.ts`).
2. `bdc093d` — fix: the mechanism, `src/components/storyteller-home.tsx`
   only (+94/−1): intent registration in `handleFigureTap`, the
   tap-start effect, intent cleared on dismiss / yield / phase exit /
   unmount.
3. This docs commit.

All commits authored `veeresh bikkaneti
<57240576+veeresh-bikkaneti@users.noreply.github.com>`.

## Evidence

- **Absence re-check (on d327dd3, first-hand):** `tapStartPending` /
  pending-tap grep over `src/` + `tests/` empty; a `greeting_text` tap
  with `greetAudio === null` falls through `decideEnteringFigureTap`
  ("pass"), the replay guard (not attempted), to a poke — and the
  first-gesture window listener only attaches once `greetAudio` is
  non-null, so the tap is forgotten.
- **RED (pre-fix):** Test R failed with the certified signature —
  `greetRequests` stayed 0 through the 15 s poll; Test W passed
  (main's #152 watchdog). **GREEN (post-fix):** R + W pass.
- **#153 composition:** intent is registered only after the one-shot is
  consumed, so the consumed one-shot is this path's rapid-tap guard;
  `dismissBubble` and the phase-exit effect clear the intent, so a
  dismissed greeting stays dismissed and "Hear again" is unaffected;
  the effect re-verifies phase/mode/yield/sound at start time, and a
  mute in the interim releases the one-shot unconsumed.

## Gates

- `npx tsc --noEmit` — clean.
- `npm test` — scripts 825 pass / 0 fail; src 1489 pass / 0 fail.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green (incl. the canonical
  `VITE_KOFI_URL=…` build the e2e specs require).
- Playwright (targeted): the repro spec passes (above). The 17
  storyteller spec files: 47 passed / 14 failed on this branch; the
  same failing files on a pristine `d327dd3` checkout in the same
  environment: 13 of those 14 fail identically (desktop audio specs
  timing out at 37–60 s under load — the VM rebooted mid-run), and the
  one remaining failure (tapstart R2) passed on a branch re-run, whose
  failure set then matched the baseline's test-for-test. No new E2E
  failure is attributable to this change.

## Pending

- Owner-route landing of the rebased head (force-push onto the existing branch or a new branch/PR, owner's call). Merge: owner only.
- Post-merge live check of the pending-tap path on
  meridian.knowledgetest.workers.dev is the owner's step.
