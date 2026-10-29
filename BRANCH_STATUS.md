# BRANCH_STATUS — feat/challenge-mc2-package-c

- **Branch:** `feat/challenge-mc2-package-c`
- **Base:** `origin/main` at `6abe3e6` (Package B, PR #283, merged + live). If the external End-game PR lands first, this branch rebases and this file resolves keeping both records accurate.
- **State:** **BUILT — in verification.** Package C of all-editions friend challenges: the (e) review-surface creation entry. Owner order 2026-10-29: "Build C".
- **Governing manifest:** `.council/manifests/2026-10-28-challenge-all-editions.md` (unchanged; the Package C note lives in `docs/feature-flags.md`, per the Package A/B convention).
- **Prior record:** this file previously carried Package B's branch record; Package B merged as PR #283 at `6abe3e6`, and its full record lives in that PR and in git history. Package A merged as PR #282 at `063de0c`.
- **Task capsule:**
  - TASK / outcome: manifest §1(e) — a deck-level "Challenge a friend — pick a map" entry on the review surfaces, opening the shipped challenge-region mini-picker, dealing a fresh five from the picked region; NEVER the deck's cards (owner ruling OQ4 = NO "Beat my misses").
  - Tier: 2 (new surface under a signed manifest; privacy-sensitive). Process: manifest already signed; TDD → gates → panel on the final tip → PR. No merge without the owner's per-PR word.
  - Interpretations recorded (narrow/safe, per the AGENTS.md ambiguity rule):
    1. "Review deck / review-complete" surfaces = the home Review card + the ReviewComplete screen — the same pair the 2026-10-28 reset manifest (D10/D16) treated as the deck's two surfaces, and the pair the BRAINSTORM §1(e) sketch names ("list row under the due-count + secondary button at review-complete"). Never per-card: nothing is added to the review run's aim/reveal phases (Package B's entries stay suppressed on review runs).
    2. Home-card visibility mirrors the reset control's D10 rule (deck total > 0 — due or caught-up states), in-flow in the text column under the due line, above the card's stretch CTA layer. ReviewComplete visibility is flag-only (the entry is not a deck operation; the deck may be empty there).
    3. Both entries reuse what already shipped: the home card reuses Choose's existing `onChallenge` handler (the mini-picker menu, card-tap sound included); ReviewComplete threads a new GameApp handler that exits the finished review exactly like Editions and opens the same menu, re-checking the flag at tap (Package B's click-atomic precedent) and degrading to the plain exit if the flag flipped off.
  - Files in scope: `src/components/game-app.tsx` (Choose card entry, ReviewComplete entry, Play/PlayLoaded prop threading, GameApp handler), `src/components/home-v5.css` (one opener class beside `.reset-history-open`), `src/game/challenge.ts` (the label constant), `src/game/challenge.test.ts` (label + privacy contract), `tests/e2e/friend-challenge-mc2-review.desktop.spec.ts` (new), `docs/feature-flags.md`, `README.md`, this file.
  - Protected (untouched): `src/game/data/**`, `package-lock.json`, the mc1 decoder path + mc1 test blocks, `tests/e2e/friend-challenge.desktop.spec.ts` (frozen), GeoDetective (`src/game/loop/**`) and Cold Trail (`src/game/coldtrail/**`).
  - Done condition: entry visible on both review surfaces with the flag on and absent with it off (E2E); mini-picker deals fresh in-region five whose ids are a subset of the picked region's catalog and disjoint from a seeded deck's ids (E2E + unit tripwire); preview + share path completes; all 5 gates green; panel approves the final tip.
  - E2E environment (Package B's recorded note): Playwright's bundled chromium-1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — /opt/meta-chromium refuses headless launch on this VM.
- **Stage log:**
  - [x] Stage 0 — clone @ `6abe3e6`, branch created, npm ci, manifest + AGENTS.md read, surfaces mapped.
  - [x] Stage 1 — TDD: label test RED with the predicted signature (`does not provide an export named 'CHALLENGE_REVIEW_LABEL'`); privacy tripwire written as an armed construction pin; E2E RED on the unmodified build (both entry tests fail on the missing entry; the flag-off guard passes; the seeded-Texas-deck review flow itself completes, proving the harness).
  - [x] Stage 2 — Build: `CHALLENGE_REVIEW_LABEL` in challenge.ts; home-card entry in both deck branches (`.review-challenge-open`, mirroring the reset opener's geometry); ReviewComplete secondary-button entry; `handleReviewChallenge` in GameApp (Editions exit + mini-picker in one state batch, flag re-read at tap) threaded GameApp → Play → PlayLoaded → ReviewComplete, gated on PlayLoaded's boot-authoritative flag read. tsc clean; challenge unit suite 37/37.
  - [x] Docs: `docs/feature-flags.md` Package C paragraph + README challenge row extended (manifest file itself untouched, per the A/B convention).
  - [ ] Stage 3 — Gates (all 5, verbatim) + full E2E.
  - [ ] Stage 4 — Panel (12 seats + DevEx) on the final tip; cures re-voted.
  - [ ] Stage 5 — PR opened. NO MERGE.
