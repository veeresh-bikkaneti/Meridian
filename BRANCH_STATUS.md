# BRANCH_STATUS — fix/storyteller-rulings

**Branch:** `fix/storyteller-rulings` · **Base:** origin/main@722a51f (#118)
**Status:** all 3 rulings implemented, all gates green, ready for PR. NEVER merge — owner merges.

Implements the user's three rulings on the #117 vs #118 review (2026-10-09).

## Done
- [x] Ruling 1 (narration → #117): home no longer consumes the session
      auto-narration flag — removed `consumeSessionAutoNarration()` and
      `claimFirstRevealNarration()` from the greeting-audio handler
      (src/components/storyteller-home.tsx). Story cards keep their own
      one-shot via `claimFirstRevealNarration()`.
- [x] Ruling 2 (poke → keep #118): no change needed — already in main.
- [x] Ruling 3 (tour line → restore): re-attached #117's wiring —
      `meridian:tour-walk-end` arms the flag after a yield, overlay close
      re-resolves to the text-only "Welcome back, explorer!" line exactly
      once (copy G2). Audio yields (stops) when tour/celebration opens.
- [x] Stale-comment cleanup (review-required): storyteller-session.ts module
      comment + consume docstring corrected; result-card H1 handoff comment
      corrected; the unattributed "simplicity per the owner" header claim
      replaced with the actual owner directive.
- [x] Gates: tsc clean, 993/993 unit tests, lint-cards PASSED,
      build:pages green, Playwright storyteller 11/11
      (home desktop/mobile/reduced + storyteller).

## Pending
- [ ] PR opened — NOT merged (owner merges).
- [ ] #117 closed as superseded after this merges.
- [ ] Adjacent flag (not ruled): #118 also dropped leaf delight +
      scroll-tap — needs the owner's call separately.
