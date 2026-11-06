# 10 — Holmes & Watson: the detective pair (decision record)

*Status as of 2026-11-06: built on `feat/detective-pair` (units U1–U9),
merged dark — the feature is OFF in production. This chapter records
what is decided, what is built, and what still gates the switch-on.
It does not record approval where none has been given: the review
panel has NOT reviewed this PR yet, and no merge or flip is approved
by anything written here.*

## The decision

- Veeresh, 2026-11-05, on the approved full-loop mockup: "I guess its
  ok let's build it" — then all six scope decisions answered "All
  recommended." The build therefore follows BUILD-SCOPE.md: two
  stations (Watson at the clue card, Holmes on the map), a
  pause-triggered waypoint companion that is answer-blind by
  construction, pre-rendered voices only, and a post-solve debrief as
  the one place Holmes draws a conclusion.
- The pair ships behind the `detectivePair` feature flag, **default
  false** — in `src/lib/flags.ts` (baked-in default) and, since U9,
  in `public/flags.json` as an explicit `false`, so the remote flip
  path is ready and testable.

## The flip gate (not yet passed)

Turning the flag on is a separate, later step, gated on ALL of:

1. The child-panel kill criteria **K1** (a scripted Holmes pause at a
   wrong place must not pull children's guesses toward it) and **K6**
   (children must still claim the guess as their own) — these need a
   real child panel and have not run.
2. The automatable gates in U10 (swap test, occlusion and absence
   audits, the performance protocol) passing on the shipping tip.
3. The full review pipeline's verdict on the final tip.
4. Veeresh's explicit word for the flip itself.

Until all four hold, the flag stays false. A flags.json redeploy is
the whole flip mechanism — and the whole kill-switch.

## Audio: pre-rendered, with honest coverage

- Runtime speech synthesis was rejected for this pair (BUILD-SCOPE
  §1.5): a device voice cannot hold the two pinned voices or their
  measured pitch gates. Every line is rendered ahead of time by the
  pipeline in `scripts/detective/` (see README, "Detective audio").
- Coverage claimed today: the Capitals & Flags pack's 110 cases (all
  clue reads), all 497 case-answer reads, and the population ≥ 500k
  selection-name tier **minus 88 names** the render backend refuses
  deterministically. Those 88 picks are not gaps in disguise: an
  uncovered name plays the suspicion line with the name silent —
  never an improvised or substituted voice.
- The core deck's 387 cases are Phase B (U11), after the Phase A
  gates pass.

## Degradation is part of the design (U9)

The pair adapts instead of breaking: reduced motion cuts walks (and
lengthens the berthing pause to 600 ms) without touching sound;
Save-Data, ≤ 4 GB memory, or battery saver docks Holmes and turns
speech into a tap-to-listen button that is never hidden; sound off
makes the pair fully visual. The matrix is one pure function —
`resolveDetectiveDegradation` in
`src/game/loop/detective/detective-degradation.ts` — with a unit test
for every row.
