# Branch status — `feat/science-definitions`

**Task:** Update the science-definitions spec and the P4, P6, and P7 briefs
(standard §9 block, NGSS physical-science codes only, disclosed Spatial
Data Scientist seat). Ship contract I4 as `src/scenes/predict-see/types.ts`.
Do not build the scene until the owner lifts the gate.

**Scope:** the six paths in `docs/scaling/plans/feat-science-definitions.md`.
Nothing else was edited.

**Status:** definitions updated and the type contract committed. Scene
engine not started.

## Done

- Merged `origin/main` at session start, and again before the PR
  (`8dee5bad`, phase0 registry and math definition). No conflicts.
- `src/scenes/predict-see/types.ts` matches `contracts.md` I4 (first commit
  on this change). No scene, no three.js import.
- Spec and P4 / P6 / P7: §9 checklist filled honestly, age groups `7-10` /
  `10-18` / `18+`, no algebra in `7-10`.
- Life-science codes and Plant Lab removed from P7. First world is ramps
  and friction (map step Ph1). 5-PS3-1 cut (biology content inside a PS
  code). P4 no longer cites MS-PS2-1 as Newton's second law.
- Scientist seat disclosed as the Spatial Data Scientist persona. It does
  not sign the educator rubric. Sign-off blocks are empty.

## Open

- **Build gate.** Ramps-and-friction engine (three.js shell, Full / Lite /
  Flat, dispose on exit, pause when hidden, one demo) waits until the
  integrator says the owner lifted the gate. Not started. No screen
  recording, because there is no scene to record.
- Educator sign-off. No named human educator. Nothing is approved.
- Review-deck wiring is integrator-only (`contracts.md` I2).
- `W = F·d` has no NGSS code that this pass could verify. Left UNVERIFIED.
- Child sentence "steeper finishes first" is MEDIUM (OpenStax exercise
  a = g sin θ). Educator must accept or strike the row.

## Council (roles, once)

- Architect: types stay a copy of I4; no second engine in the chemistry brief.
- Game designer: one ramp scene later; prediction is a tap before motion.
- Accessibility: taps, no drag, no timer in `7-10`, Flat teaches the same rule.
- Skeptic: do not attribute the steepness effect to 3-PS2-2's sentence.
  That objection is written into P7 §3.

## Gates

Run on this branch after the type file was added. Commands and results:

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run typecheck:worker` | PASS |
| `node scripts/lint-cards.mjs` | PASS (GATE PASSED) |
| `npm run lint:content` | PASS (0 new violations; 6 baselined) |
| `npm test` | PASS — scripts 1164 pass / 11 skipped / 0 fail; src 2354 pass / 0 fail |
| `npm run test:worker` | PASS — 145 pass / 0 fail |
| `npm run build:pages` | PASS |
| `npm run check:entry-size` | PASS — entry JS gzip 318,488 B, limit 323,865 B |
| Playwright E2E (CI smoke list, 22 tests, `--workers=1`) | 21 passed, 1 failed. Failure is `grownups-privacy-contact.desktop.spec.ts` contact-form webhook: `SyntaxError: Unexpected end of JSON input` while parsing a Discord sink body. `build:pages` warned `CONTACT_DISCORD_WEBHOOK_URL` is unset. This branch does not touch contact, telemetry, or that spec. Full `tests/e2e/` folder was not run (202 specs). |
| Screen recording | NOT RUN — the ramps scene is behind the build gate. A type declaration has no frames. |

The builder is not the independent checker (AGENTS.md). These are the commands this branch ran, not a panel sign-off.

