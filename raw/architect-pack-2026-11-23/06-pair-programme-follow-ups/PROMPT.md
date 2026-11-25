# 06 — Pair programme follow-ups (studies, audio gap, face channel)

## Intent (one line)
Close the six known open threads on the live Holmes & Watson pair: evidence studies, a 30-kid read test, an audio coverage gap, and the pair's missing facial-expression channel.

## Why (origin)
The pair shipped live (PR #538, 2026-11-19) with a recorded list of follow-ups that were deliberately not blockers. They have sat open since; the owner wants them visible, not forgotten.

## Scope IN (the six follow-ups)
1. **Pre-registered findability study** — can kids find/use the pair's controls unaided?
2. **CELEBRATE overlap sampling** — check the celebration staging for overlaps across viewports.
3. **Kid observation on clues 3–5** — watch real kids on the mid-case clues.
4. **FLIP tracked issue** — the open staging/animation issue carried on the tracker.
5. **Mute-during-walk E2E pin** — a regression test pinning mute behaviour during the walk.
6. **Time-to-clue-1 measurement** — how long from case start to the first clue landing.

## Scope OUT
- Rebuilding the pair. Any change to live pair behaviour without the owner-config playthrough gate.

## Locked decisions
- **Kid read test (n≥30) gates the `detectiveFlank` flag flip** — the flank staging stays behind the flag until the test passes.
- **88 of 1,548 planned names had NO audio at flip** (measured) — the corpus is pre-render only; gaps are filled by rendering, never by runtime TTS.
- **Holmes face-floor**: the 3D rigs have no facial-expression channel (mouth flap only) — an open design floor, linked to item 01's acting bar.
- Ending speech never plays in tap mode (owner's read-aloud "sometimes" configuration) — recorded behaviour, not a bug to silently "fix".

## Acceptance criteria
- Each follow-up closes with its own evidence (study record, test in suite, measurement number) or is explicitly killed by the owner.

## Assets & related work (in this folder)
- `GOAL-pair-build.md` — the pair build record (units U1–U10, flags, corpus: 497 cases, 2,485 clue lines).

## Open questions for the architect
1. Which of the six follow-ups actually gates future pair work, and which are nice-to-have telemetry?
2. Is the n≥30 kid read test the right gate for `detectiveFlank`, and who runs it?
3. The face-floor: is a limited expression set (brow/eye shapes) worth a rig change, or is mouth-flap + body acting the honest ceiling for these GLBs?

## Status & evidence
- Pair live; all six follow-ups open, none started. Audio gap measured at the `detectivePair` flip (2026-11-06 record).

**Verified 2026-11-23 (pack v2):** `detectiveFlank` is still `false` in `public/flags.json` on main — the kid read test still gates the flip. The other follow-ups are untouched by the architecture programme.
