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

## Items
- [ ] **2. Stale decay comment** (game-app boot effect): said accept
  writes an auto scout that decays. Since #151 accept writes
  `accepted: true`, which never decays. Comment rewritten to tell the
  truth.
- [ ] **3. Dead `stored` parameter** in `planBootMapMode`: production
  always passed `null` (game-app checks the stored record itself before
  calling), so the planner's `if (stored)` branch never ran outside
  tests. **Decision: drop the parameter** — see below.
- [ ] **4. `aria-describedby`** on the scout boot-offer dialog, pointing
  at the body paragraph, so screen-reader users hear the reason, not
  just the title.
- [ ] **5. Stale comment** in `tests/e2e/motionmaxxing.spec.ts`: said
  the VM "boots in scout map mode". Since #147 the failed probe raises
  the offer dialog and the session starts in full; the tests pin full
  mode. Comment rewritten.
- [ ] **6. New E2E test**: declined capability offer (manual full
  stored) followed by a WS-4 tile failure — the retry still switches to
  Scout Map for the visit, and the switch stores nothing, so the
  player's declined record stands untouched. Lives in
  `scout-capability-offer.desktop.spec.ts` because the WS-4 spec's
  capable-device spoof makes the dialog unreachable in that file.
- [ ] **7. New unit test**: pins that game-app's capability-accept
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

## Gates
- [ ] `npx tsc --noEmit`
- [ ] `npm test` (scripts + src suites)
- [ ] `node scripts/lint-cards.mjs` — GATE PASSED
- [ ] `npm run build:pages`
- [ ] E2E (built artifact, `--workers=1`): scout-capability-offer,
  motionmaxxing
