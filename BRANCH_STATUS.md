# BRANCH_STATUS.md — fix/scout-offer-followups-154

## What
Fix round for issue #154 items 2–7 — the follow-ups from the #147 ARCH
review of the Scout Map capability-offer flow. Small truth-telling fixes
(stale comments, a dead parameter, a missing ARIA link) plus two coverage
gaps closed (one E2E, one unit).

**Item 1 is NOT in this branch.** The production test seam
(`window.__meridianSuppressScoutOffer`) is an owner decision (keep vs
remove); this branch does not touch it.

Base: `origin/main` @ `84ac861` (PR #174). Note: this branch may need a
rebase if PR #175 lands first (it touches nearby UI) — rebase only if a
conflict actually appears.

## Items (all done)
- [x] **2. Stale decay comment** (game-app boot effect): said accept
  writes an auto scout that decays. Since #151 accept writes
  `accepted: true`, which never decays. Comment rewritten to tell the
  truth.
- [x] **3. Dead `stored` parameter** in `planBootMapMode`: production
  always passed `null` (game-app checks the stored record itself before
  calling), so the planner's `if (stored)` branch never ran outside
  tests. **Decision: drop the parameter** — see below.
- [x] **4. `aria-describedby`** on the scout boot-offer dialog, pointing
  at the body paragraph, so screen-reader users hear the reason, not
  just the title.
- [x] **5. Stale comment** in `tests/e2e/motionmaxxing.spec.ts`: said
  the VM "boots in scout map mode". Since #147 the failed probe raises
  the offer dialog and the session starts in full; the tests pin full
  mode. Comment rewritten.
- [x] **6. New E2E test**: declined capability offer (manual full
  stored) followed by a WS-4 tile failure — the retry still switches to
  Scout Map for the visit, and the switch stores nothing, so the
  player's declined record stands untouched. Lives in
  `scout-capability-offer.desktop.spec.ts` because the WS-4 spec's
  capable-device spoof makes the dialog unreachable in that file.
- [x] **7. New unit test**: pins that game-app's capability-accept
  handler writes `accepted: true` (previously only E2E covered it).

## Item 3 decision (drop the parameter, don't pass `stored` through)
game-app's boot effect already branches on the stored record before the
planner is consulted — it has to, because it needs `stored.mode` to set
the map mode directly. Passing `stored` through would force the boot
effect to also run a fresh qualification (WebGL probe + memory read) on
every boot just to hand the planner a value it can only answer "no
offer" to — new work for zero behavior change, and two places enforcing
one rule, free to drift apart. Dropping the parameter makes the type say
what production actually does: *the planner is only asked when no live
stored assignment stands*, which its doc comment already claimed. The
"stored assignment suppresses every offer" rule stays enforced in
exactly one place — game-app's `if (stored)` branch — and the planner's
unit tests now mirror the production call pattern (decision in, offer
out) instead of testing a branch production never takes. The
storage-contract tests keep asserting the fact that branch relies on:
a stored answer (accepted or manual) still reads back, undecayed, on
later boots.

## Gates (run on this branch, 2026-10-20)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts suite 799 tests (790 pass / 9 skip / 0 fail);
  src suite **1358 pass / 0 fail**. Identical totals to unmodified main
  (verified on a pristine `84ac861` worktree): item 3 removed one
  planner test and item 7 added one wiring test, net zero.
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (Ko-fi env baked in)
- [x] E2E `scout-capability-offer.desktop.spec.ts` (built artifact,
  `--workers=1`, Ko-fi env): **8/8 passed**, including the new item-6
  test.
- [x] E2E `motionmaxxing.spec.ts` (touched by item 5, comment-only):
  **6/6 failed — pre-existing on unmodified main, NOT this branch.**
  Reproduced identically on a pristine `84ac861` worktree: every test
  dies at boot on the error boundary with "Cannot read properties of
  undefined (reading 'connect')" — an audio-graph crash (`.connect`
  reads live in `src/game/audio/sfx.ts` / `grandpa-ask.ts`). The
  capability-offer spec passes against the same build, and no change
  in this branch touches audio. Flagged for the owner as a separate
  main-branch problem; out of scope here.
