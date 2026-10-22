# Branch Status — fix/observability-chunk-race

**Branch:** `fix/observability-chunk-race`
**Base:** `1ca4c04` (main, after PR #222 merged)
**Purpose:** Fix one flaky end-to-end test. The D1 test in
`tests/e2e/observability.spec.ts` sometimes failed on slow machines even
though the app itself was working correctly. This branch makes that one
assertion wait for the thing it checks, instead of assuming it already
happened.

## Why this branch is allowed to exist (rule-2 waiver)

The repo constitution's rule 2 normally says: do not create new branches.
The owner made one exception for this fix. The review panel recommended
(Q3) that this fix land as its own tiny PR, and the owner adopted that
recommendation ("Adopt all", 2026-10-21). The waiver covers this one named
branch only and expires when this branch merges. The panel also ruled (Q4)
that a red `main` is a blocking CI-integrity incident, so this PR sits at
the head of the merge queue.

## The problem, in plain words

The D1 test watches the app start a Globe game. The app writes a breadcrumb
milestone ("chunk load started") and *then* loads the Globe code chunk.
The old test checked "the chunk request was made" immediately after seeing
the milestone — with no waiting. On a slow machine, the milestone can be
visible a moment before the request actually goes out, so the check failed
by timing alone. In CI, `main` itself, the docs-only PR #219, and PRs #212
and #217 each failed at exactly this one assertion (line 238) and nothing
else.

## Reproduction evidence

**UNREPRODUCED locally.** Before changing anything, the test was run 10
times on this machine (46 executions of the D1 test in total), including
runs repeated 3–10 times back-to-back and runs with the CPUs deliberately
kept busy to slow the machine down. The line-238 failure never appeared
locally. The race is proven by the CI failures listed above and by reading
the code: `src/components/game-app.tsx` records the milestone before the
awaits that issue the chunk import, so the window the test fell into is
real. The fix was made anyway because the mechanism is proven, not because
a local failure was captured.

## The fix

One change in `tests/e2e/observability.spec.ts` (the D1 test only): the
bare assertion is replaced with a Playwright poll that waits up to 15
seconds for the Globe chunk request count to reach 1, with a comment above
it explaining why. No app code (`src/`) was touched. No other test file was
touched.

## Verification (after the fix)

- Observability spec on its own: 5 full runs, all green (3 passed each),
  including one run under deliberate CPU load.
- Full CI spec list in one run (grownups privacy/contact + hydration boot
  + observability): 7 passed, 0 failed.

## Gates (verbatim results)

- `npx tsc --noEmit` — clean (exit 0)
- `npm test` — scripts: 808 pass / 9 skipped / 0 fail; src: 1473 pass / 0 fail
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (run before the fix; the fix changes only a
  test file, so no rebuild was needed)

## Status

Done and pushed. Awaiting Chitti's panel review; only the owner merges.
