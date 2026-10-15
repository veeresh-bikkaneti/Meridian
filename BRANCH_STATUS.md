# BRANCH_STATUS — feat/scout-capability-choice-dialog (PR #147; #151 folded in; main merged)

**Status: ready for owner review. Owner merges.** Not merged by Claude.

## Done on this branch (2026-10-15)
- Fast-forwarded to include the #151 fix (`60abd46`: an accepted capability offer is stored `accepted: true` and never decays). #151 was merged into this branch by the owner at 16:55 UTC.
- Merged `origin/main` (f94444b, #148 squash incl. WS-4 Phase 1). Conflicts: `docs/scout-offer-policy.md` (took main, which has this branch's table plus the WS-4 charter note); `BRANCH_STATUS.md` (kept this file). `game-app.tsx` auto-merged; checked by typecheck, unit tests, and E2E.
- Commit `2a3c788` (merge) pushed. No force push.

## Gates on the merged tree
- `npm ci`, `npm run build`, `npm test` (1,308 pass, 0 fail), `npm run test:worker` (18 pass), `npm run typecheck:worker` clean. `npx tsc --noEmit` clean.
- Scout E2E, `--workers=1`, against `npm run build:pages` (dist/client): scout-capability-offer, scout-offer, scout-toggle, scout-context-lost, scout-throttled: **22 passed, 0 failed**.
- Pitfall found: E2E reads `dist/client`, which only `npm run build:pages` writes. A first E2E run used a stale `dist/client` (old silent-switch boot code) and failed 12 of 22. Rebuilding with `build:pages` fixed it. Always rebuild with `build:pages` before the E2E run.

## Review
- Opus ARCH-REVIEWER, full diff vs main (verdict APPROVE-WITH-NITS, no BLOCKs). Nits, for the owner to decide:
  1. `src/components/game-app.tsx` ~1127-1128: comment says accept writes an auto scout that decays. Stale since #151 (accept writes `accepted: true`, never decays).
  2. `src/components/game-app.tsx` ~1146 with `src/map/capability.ts` ~284: production always passes `stored = null` to `planBootMapMode`, so its `if (stored)` branch never runs. The 'live stored assignment suppresses every offer' rule is enforced by game-app's own check instead. Unit tests cover the planner branch, not the production path.
  3. `window.__meridianSuppressScoutOffer` (game-app ~1145) is a test seam that ships in the production bundle. It is not reachable from a URL, but it is still a production hatch. Owner to decide if allowed.
  4. `src/components/scout-boot-offer.tsx` ~114-121: no `aria-describedby`, so screen-reader users hear only the title, not the reason in the body.
  5. `tests/e2e/motionmaxxing.spec.ts` ~180-181: comment says the VM 'boots in scout map mode'. No longer true; tests pin full mode, so nothing breaks.
  6. Coverage gap: no test of a declined capability offer followed by a WS-4 tile failure (spec spoofs a capable device, so no dialog). Code reviewed as fine; unverified at runtime.
  7. Coverage gap: no unit test that accept passes `accepted=true` from game-app; only E2E covers it.
- Playwright tests added by #151 are included in the 22 above.

## Screen recordings
- #147's PR body lists 2 recordings (capability-dialog-accept.webm, capability-dialog-decline.webm), not 4. The user-visible dialog did not change in this merge (the 22 E2E assertions are the same), so no re-recording was done. Confirm before merge if you want fresh ones.

## Not verified
- Real devices. The VM's WebGL is SwiftShader, so the probe-weak path is exercised by the VM only.
- Branch protection: the required check name on `main` is still `build`, which no longer matches the job `build (22.x)`. Claude cannot edit rulesets from this session. Until the owner fixes it, merges to `main` need the check temporarily lifted.

## Earlier notes (kept)

**PUSH OK, DO NOT MERGE** — owner merges. Based on `feat/scout-capability-choice-dialog` (PR #147);
retarget to `main` after #147 merges.

## This branch (delta on #147)
- **Fix**: an accept from the capability choice dialog is now stored with `accepted: true`
  and never decays, so it is never re-offered after 7 days (non-nag rule 1). `source` is kept
  for telemetry. Unanswered auto records (e.g. `contextlost`) still decay. `qualifyMapMode()` order untouched.
- Unify duplicate `ScoutOfferVariant` (single definition in `src/map/capability.ts`).
- Remove the `?scout-offer=suppress` URL parameter from the production bundle; the e2e seam is only
  `window.__meridianSuppressScoutOffer`.
- Docs: `docs/scout-offer-policy.md` (charter text not in repo).
- Tests: unit "accept → scout, never decays / never re-offered", flag strictness, manual overwrite;
  e2e accept assertions + "accepted scout, 400 days old → never re-offered".

## Pending
- Charter section 4 wording: file not in repo — mirror `docs/scout-offer-policy.md` there.

---
(PR #147's own status follows.)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

A capability-detected weak device now gets a CHOICE dialog instead of being
silently routed to Scout Map. The owner directive: "Let the user choose to
struggle with the full site or go to lite mode."

- **Probe / low-memory boot decisions** (fresh WebGL-probe failure, weak
  renderer, or deviceMemory ≤ 2 GB) now show the Scout Map choice dialog
  with copy fitted to the cause — the session stays in full mode until the
  user decides. Previously these applied scout silently.
- **Accept** → Scout Map, stored with the qualifying source ("probe" /
  "low-memory") so the assignment still decays after 7 days.
- **Decline** ("Keep full map") → stored as a MANUAL "full" assignment:
  never decays, never re-prompts. Same semantics as the settings toggle.
- **Prior-crash offer** is unchanged in UX and copy; its decline now also
  records manual "full" (dev's call per the QA contract — otherwise the
  next boot's fresh probe would re-fire the dialog on a weak device,
  breaking the no-nag rule).
- **Unchanged:** webglcontextlost mid-game auto-switch (a crash in
  progress, not a choice moment), manual toggle (still overrides
  everything), full mode default, 7-day decay for auto assignments.
- **E2E seam:** `?scout-offer=suppress` query param, plus
  `window.__meridianSuppressScoutOffer` set by `serveBuiltArtifact`
  (opt out with `{ suppressScoutOffer: false }`). The harness VM reads as
  a weak device (SwiftShader), so unsuppressed every fresh boot would show
  the dialog and block unrelated specs.

## Spec checklist
- [x] Choice dialog fires on fresh probe / low-memory scout decisions
- [x] Cause-fitted copy (probe vs low-memory vs prior-crash)
- [x] Accept → scout stored with source, 7-day decay preserved
- [x] Decline → manual full, never decays, never re-prompts
- [x] Dialog shows once per boot
- [x] Prior-crash UX/copy/accept-path unchanged
- [x] webglcontextlost auto-switch unchanged
- [x] Manual toggle still overrides everything
- [x] Unit tests walk the runtime paths (accept→scout+decay;
      decline→manual full→next boot no re-prompt; decayed record→re-prompt)
- [x] E2E: 5 new capability-offer tests green; all scout suites green;
      geodetective 18/18 (seam check)
- [x] Screen recordings: capability-dialog-accept.webm,
      capability-dialog-decline.webm (~/workspace/your_files/meridian-scout-choice-dialog/)

## Gates
- [x] `npx tsc --noEmit` clean
- [x] `npm test` 1227/1227 (8 new)
- [x] `node scripts/lint-cards.mjs` GATE PASSED
- [x] `npm run build:pages` green
- [x] Playwright: scout-capability-offer 5/5, scout-offer 7/7,
      scout-throttled 1/1, scout-toggle 7/7, scout-false-demotion 3/3,
      scout-context-lost + switch-note 9/9, geodetective 18/18

## Pending
- Rebase to zero conflicts + full suite re-run post-rebase
- PR (never merge — owner's decision)

## Scrum panel review (2026-10-12): APPROVE-WITH-NITS, 0 BLOCKs
- Panel agrees with the deliberate decision (prior-crash decline → stored
  manual full): minimal mechanism satisfying the no-nag contract; noted
  trade-off that a subsequent map-attributed crash is also suppressed.
- Nits applied: stale Escape comment fixed; "runtime path" unit tests
  renamed to "storage contract" (they prove decay math, handlers are
  black-box covered by E2E); storage assertions added to Esc / scrim /
  decline-retires E2E tests (black-box proof of the decline decision).
- Nit deferred (copy): "Keep full map" sub-caption noting the choice is
  changeable in Map settings — panel noted the label is honest as-is;
  left for the owner's eye rather than adding UI copy unasked.

## Master Orchestrator review (2026-10-12): 2 UX BLOCKs found and fixed

Independent panel (Game Designer: YES / Frontend: YES / UI-UX: NO→fixed /
Tester role absorbed by orchestrator after worker error):

**BLOCK 1 (HIGH, fixed): scrim tap recorded a permanent decline.** A stray
tap outside the dialog wrote manual `full` (never re-prompt) — an accidental
dismissal recorded as an explicit permanent choice. Fix: scrim tap and Escape
now merely DISMISS without persisting (`dismissScoutOffer`); only the
explicit decline button writes manual full. The dialog may re-fire next boot
if the device still qualifies. Regression E2E: "scrim dismiss writes
nothing: dialog re-fires next boot" + updated Esc/scrim specs in
scout-offer.desktop.spec.ts.

**BLOCK 2 (MEDIUM, fixed): storyteller greeting fired behind the modal.**
On a qualifying boot the greeting narration/bubble started under the open
dialog. Fix: `StorytellerHomeHost` takes `suppressGreeting`; game-app passes
`scoutOffer !== null || !bootQualified` (boot qualification settles in the
boot effect; greeting starts once the offer resolves). Regression E2E:
"greeting waits while the choice dialog is open".

**Copy fixes (Game Designer, non-blocking):** prior-crash decline "Not now"
→ "Keep full map" (the choice is permanent; label must not imply "later");
low-memory body "may stutter" → "might freeze or lag" (kid comprehension).

**Pre-existing failures (NOT this PR, NOT the fixes):** 2 mobile poke
animation tests fail identically on the pristine branch (verified via stash
+ rebuild + re-run): "poke: tap the figure → rotating idle lines" and
"poke startle + yield recede win over idle sway" ("homer-startle" class
never applies). Unrelated to the scout dialog; recommend a follow-up.

## Gates (post-fix re-run)
- [x] `npx tsc --noEmit` clean
- [x] `node --test` 2027 pass / 0 fail (7 skipped)
- [x] `node scripts/lint-cards.mjs` GATE PASSED
- [x] `npm run build:pages` green
- [x] Playwright: scout-capability-offer 6/6 (2 new BLOCK regressions),
      scout-offer 7/7, scout-throttled 1/1, scout-toggle 7/7,
      scout-false-demotion 3/3, scout-context-lost + switch-note 9/9
- [x] storyteller-home desktop + reduced: all pass; mobile 24/26
      (2 pre-existing poke-animation failures, proven unrelated via stash)

## PR: https://github.com/veeresh-bikkaneti/Meridian/pull/147 (OPEN, never merged)

## Ready to merge? NO
## What is pending?
Owner's video green-light → Chitti/panel independent review → owner's merge decision.
