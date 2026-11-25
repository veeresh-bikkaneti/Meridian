# Branch status — mock/why-learn-adoption

## Done
- Staging-only mock of the Why Learn adoption package (owner's
  mockup-before-code rule; never a production PR): sticker-card
  picker skin + subject colour tokens, derived "Proved" stamps,
  Grandpa hero presence, the Predict (hunch) step on the Math coin
  case, the lift-the-flap scene wrapper, and the interactable coin
  prototype (drag/tap coins into groups of five; result band leads
  with a motion explanation).
- Captures + sample videos under `captures/` (15 stills at 5
  layouts, element proofs, walkthrough videos at 390x844 and
  1280x800, the interactable played-case video). Staging record:
  `STATUS.md` at the repo root of this branch.
- Pushed to remote on the owner's instruction (2026-11-24:
  "Everything has to live in remote Gits") so the staging work is
  durable; the local staging worktree was removed after the push.

## Next step
- Owner decisions on the adoption package (stamp rule + wording,
  pilot scope in scene kinds, handwriting font, Grandpa's line).
  Any production build starts fresh from main under the review
  pipeline — this branch is a mock record, not a merge candidate.

## Open questions
- None for this branch itself.

## Ruled out
- Merging this branch: staging code was written to be seen, not to
  ship.

## Graph
- Add node: branch `mock/why-learn-adoption` (staging mock) —
  documents the Why Learn adoption mockups; decided-by the owner's
  specs-and-mocks instruction of 2026-11-24.
