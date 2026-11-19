# fix/math-spec-usedinline — stale math-subject e2e expectation

Base: origin/main `8ba3a947`. Tier 1 (one stale spec, clear repro).
Owner ordered this as its own small fix on 2026-11-17 (PR 529 Batch B flag).

## What was wrong

`tests/e2e/math-subject.spec.ts` (`solveCase`, line 89) expected the
result's used-in line to contain the literal string
`"You just used this in…"` (with the ellipsis character). PR 524 changed
the product to compose that line with `usedInLine`
(`src/subjects/shared/used-in-line.ts`): the ellipsis placeholder is
never rendered — a catalogue phrase of the form `"<area>: <example>"`
renders as `"You just used this in real life: <example>."`. The product
copy is owner-approved; the spec was stale.

## Evidence

- Red on unmodified main (hermetic, project `math-subject`):
  `Expected substring: "You just used this in…"` /
  `Received string: "You just used this in real life: counting out change in coins by 5s and 10s."`
  at `math-subject.spec.ts:89`. Every test that solves a case (6 of the
  first 7) failed through this one assertion; the non-solving test passed.
- All 71 math catalogue rows carry the `"<area>: <example>"` shape, so
  every line this spec can render starts
  `"You just used this in real life:"` — the stable part now asserted.
  The exact per-shape composition stays pinned by the unit suite
  (`src/subjects/shared/stream-w-items.test.ts`).

## Change

One line: `tests/e2e/math-subject.spec.ts:89` now asserts
`"You just used this in real life:"`. No product files touched.

## Verification

- Hermetic e2e on this branch: **17 passed** (project `math-subject`,
  `--workers=1`, built artifact via `serveBuiltArtifact`).
- Gates: `npx tsc --noEmit` clean · lint:subjects GATE PASSED ·
  lint:content GATE PASSED (0 new) · check:provenance PASSED ·
  lint-cards GATE PASSED · build:pages green (built for the e2e run).
- Not run (spec-only change, per brief): the full unit suite and the
  worker suite — CI carries them.

## Status

Done. Draft PR open; merges on the owner's word.
