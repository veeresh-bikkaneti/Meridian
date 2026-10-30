# Round-loop accessibility design (Wave 1 P0 Item 3)

Design record for the round-loop reveal announcements. This document is
prose only — it gates nothing. The gate for Item 3 is the E2E
live-region observer suite in `tests/e2e/round-loop-a11y.spec.ts`
(3A, 3A-hit, 3B, 3C, 3D, 3E, 3F, visual).

## The one-announcer rule

During a reveal, exactly one live region changes to a non-empty reveal
text: the GameApp sr-only live paragraph ("Pin dropped. …" at
revealDone). A flat count of zoom-space announce intents is NOT a gate
for this — intents are not DOM live regions, and a flat region count
can stay unchanged while double announcement persists via text changes.

## Design (post-fix state)

- The designated reveal announcer is the GameApp sr-only live
  paragraph. It is the only live region that changes to a non-empty
  reveal text during a reveal.
- The result-card AI sentence is visible text only (no aria-live).
  It never owns a live region.
- The satellite-map adapter drops `announce` intents while a reveal
  card is up (gated on the live reveal state), so zoom-space "Hit." /
  "Showing your pin and the true spot." never reach the DOM live
  region during a reveal. Threshold and region announcements outside
  reveals are untouched, and the controller's intent vocabulary is
  unchanged (the zoom-space unit tests still pin the intents
  themselves).

## History note

This record replaces `src/components/round-loop-a11y.documentation.ts`
(deleted in the PR #287 review-findings fix round, L5). That file
carried the same design notes plus two `node:test` source-text checks,
but it never ran: the `npm test` script runs only
`scripts/**/*.test.mjs` and `src/**/*.test.ts`, and a
`.documentation.ts` file matches neither. The checks were deleted with
the file, not moved — moving them as `.ts` would still never run them,
and their root-relative source reads would break. The E2E observer
suite above is the gate; this document is the record.
