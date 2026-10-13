# BRANCH_STATUS — feat/scout-capability-choice-dialog (2026-10-12)

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

## PR: https://github.com/veeresh-bikkaneti/Meridian/pull/147 (OPEN, never merged)

## Ready to merge? NO
## What is pending?
Owner's video green-light → Chitti/panel independent review → owner's merge decision.
