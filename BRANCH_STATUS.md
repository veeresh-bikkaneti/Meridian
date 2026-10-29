# BRANCH_STATUS — feat/challenge-mc2-package-b

- **Branch:** `feat/challenge-mc2-package-b`
- **Base:** `origin/main` at `063de0c` (Package A, PR #282, merged + live). If the external End-game PR lands first, this branch rebases and this file resolves keeping both records accurate.
- **State:** **BUILT — in verification.** Package B of all-editions friend challenges: (b) mid-run run-menu creation entry, (c) reveal-card creation link, (f) challenge-complete pass-along + fresh-route secondary. Owner order 2026-10-29: "Build B".
- **Governing manifest:** `.council/manifests/2026-10-28-challenge-all-editions.md` (unchanged; the Package B note lives in `docs/feature-flags.md`, per the Package A convention).
- **Prior record:** this file previously carried Package A's branch record; Package A merged as PR #282 at `063de0c`, and its full record lives in that PR and in git history.
- **Interpretations recorded (narrow/safe, per the AGENTS.md ambiguity rule):**
  1. The shipped app has no run menu; the design record's ruling (one item in the ⋯ overflow, physically separated from End game, never on the aim surface) is realized as a ⋯ popover button in the run header's chrome cluster (beside Editions / sound / contrast / map-mode), following the MapModeToggle popover pattern.
  2. The (f) fresh secondary is added for **mc2 completions only** — the mc1 completion surface is frozen (manifest §2), following Package A's panel-approved precedent for mc1 byte-stability.
  3. E2E on this VM runs Playwright's bundled chromium-1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` (a config-supported override): /opt/meta-chromium currently refuses headless launch ("Hatch WebGL domain policy is required for browser startup").
- **What shipped on this branch:**
  - Labels as code in `src/game/challenge.ts` (Package A's pattern): `challengeMidRunLabel`, `challengeRevealLabel`, `challengeFreshRouteLabel`, `CHALLENGE_UNLOCK_HINT` — unit-tested byte-exact against the manifest's words, plus widening-chain shape tests ((b) chain is seen-included; (f) the route is never its own deal source).
  - (b) Run-menu button + single item in the PlayLoaded header cluster; opens a local preview sheet carrying the picker sheet's copy. The button is not rendered when the flag is off, the run is a challenge or review run, or no source can deal five; the flag is re-read at tap time (click-atomic). Creation is a pure read — the live run, dealer, and question never move.
  - (c) ResultCard gains an optional `challengeOffer` footer: text link below Next place + the non-interactive unlock hint, rendered through BoundedText with the registered `result-note` class (card-gate clean).
  - (f) ChallengeComplete: mc2 completions gain the fresh-route secondary, dealt from the completed route's region catalog (Play's challenge load branch now keeps the full catalog and passes it down as `challengeCatalog`); sources built with no runPoolIds, so the route itself is never the deal source. The Package A pass-along (origin format + pinned radius) is untouched, and so is the mc1 completion surface.
  - Docs: `docs/feature-flags.md` Package B paragraph; README friend-challenge row.
- **Gates so far:** tsc clean · unit 1814/1814 · worker 85/85 · lint-cards GATE PASSED · build:pages green.
- **Pending:** E2E (new Package B spec + challenge regression specs, under flock) · full pipeline panel (12 seats + DevEx) on the final tip, cures re-voted · PR opened. **No merge without the owner's word.**
