# BRANCH_STATUS — feat/subject-holmes-watson

**Branch:** `feat/subject-holmes-watson` · **Base:** `origin/main` 8ff81671 (rebased from 8e3fd95b; #467 touched styles/picker docs only)
**Task:** Holmes & Watson in the subject cases — Stream E v2 spec (supersedes the math-only brief). Builder only: local commits, no push / PR / merge — the coordinator gates and pushes; the PR title will be "Holmes and Watson in the subject cases".

## Done (final tree)

- ONE mount in the shared case: `src/subjects/shared/SubjectCase.tsx` gains imports + a header-comment update + one host element (display:contents slot, mirroring LoopScreen's detective host mount). Every subject (math, physics, chemistry, general knowledge, social studies) gets the pair from this mount.
- `src/subjects/shared/subject-host-props.ts` (new): the answer-blind prop whitelist mirroring `detective-host-props.ts` — exactly `solved` / `wrongPick` / `finished` booleans from SubjectCase's flow state — plus edge-signal derivation, the state→clip mapping, and the pose mapping.
- `src/subjects/shared/SubjectDetectiveHost.tsx` (new): self-gates on `detectivePair` via the async flags-load pattern; creates `createDetectiveSpeech` in "auto" mode (tap mode would skip lets-find-clues — not an ending/gesture/clue-held ref — on a surface with no replay control; auto keeps the sound toggle + read-aloud veto authoritative); shipped rigs at host height, halo from `hostsStaging`; player stopped + disposed on unmount; finished guarded first-time-per-mount in the host.
- Clip rules (tightened): open → lets-find-clues (Watson, "Let's find some clues."), correct → win-holmes (Holmes, "You found it!"), wrong → SILENCE (all ten ack-* texts are Holmes-to-Watson receipt acknowledgments; none fits a wrong pick; ack-3/7/8 ear-check-flagged besides), finished → SILENCE (win-watson is GeoDetective-only). Never requested: instructions-*, win-watson, decode-*, hook-announcement, debrief-*, ask-next, suspicion, score-celebration.
- Zero changes under `src/game/loop/detective/` (no export additions needed), zero flag changes (`src/lib/flags.ts`, `public/flags.json` byte-identical).

## Reuse vs discard (old-scope commits, kept in history, reworked on top)

- REUSED: the speech-player wiring pattern + speech-mode investigation; the one-voice test core (real channel + real player + fake manifest from the real pool); the e2e flags-interception pattern; the ack investigation (which became the silence determination).
- DISCARDED: the MathCase mount + MathPair strip; the SubjectCase `onCaseEvent` prop; finished → win-watson; wrong → ack (old scope had wired a drawAckId ack on wrong).

## Gates (targeted, per spec)

- Unit: subject-host-props.test (builder/mapping/membership/one-voice/poses) + detective-host-props.test + voice-channel.test + detective-audio.test + math.test — 75 pass, 0 fail.
- `npx tsc --noEmit`: clean. `node scripts/lint-cards.mjs`: GATE PASSED. `npm run lint:content`: GATE PASSED.
- `npm run build:pages` (VITE_KOFI_URL set): green.
- Playwright `math-subject` project, `--workers=1`, built artifact: 13 pass, 0 fail (pair in math + chemistry; bands 7-10/10-18/18+ to result; never two audio elements at once; flag-off parity — no rigs, no pair audio requests; reduced motion still).
- Neighbour subject specs (temp config, no project exists for them): chemistry/physics/general-knowledge/social-studies 8 pass; subjects-picker desktop 4 pass.
- Screenshots (outside the repo): `~/workspace/math-holmes-watson/screenshots/` — subject-pair-desktop.png, subject-pair-390.png, subject-pair-win-desktop.png, subject-pair-chemistry-desktop.png.

## Open

- Push / PR / merge: coordinator's and owner's steps, not the builder's.
- Full `npm test` and CI: not run locally (targeted-only rule); CI carries the bulk.
- Tools note for the PR body: /pstack is NOT installed on this machine and gstack is NOT installed (barred by the owner's earlier vetting); agent-agency personas ARE installed as skills and the independent Reality Checker gate is the review seat.

## Graph

- No knowledge-graph nodes added (integrator-only file).
