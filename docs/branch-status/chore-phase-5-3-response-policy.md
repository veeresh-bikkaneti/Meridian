# Branch status — chore/phase-5-3-response-policy

## Task / requested outcome

One headers module used by `src/server.ts` and `src/start.ts`, plus a test
that compares its output to `public/_headers` for the same paths, so the
three cannot drift. Header values must not change for players: the test
proves today's headers are kept. No migrations (Phase 5.2 owns them).

## Interpretations considered and selected reading

- The goal says one headers module. `src/lib/security-headers.ts` already
  holds `SECURITY_HEADERS`, `HTML_CACHE_CONTROL`, `withSecurityHeaders()`
  and `withHtmlCacheControl()`, and both `server.ts` and `start.ts`
  already import it. The gap is only per-path Cache-Control in `_headers`
  with no module counterpart — so extend that module (Option A), do not
  create a second one.
- `src/server.ts` gets no new call: its guard responses are 404/405
  errors, not cacheable assets. The new path function is wired only into
  the `src/start.ts` middleware, where Worker responses can carry asset
  Cache-Control.
- `public/_headers` is unchanged. The test simulates that file; the
  module must match it, not the other way round.

## Tier and rationale

Tier 2: security headers plus 5 files in scope. Process per the phase
brief: lead plans and verifies, builder builds, one clean-context panel
seat reviews the final tip.

## Done condition

- Failing test first (proven: the new tests failed with a missing-export
  error before the production code landed), then green.
- Gates PASS (see below).
- A clean-context panel seat signs the final tip.
- `docs/ops/deploy-contract.md` gets a headers section with the check
  that proves it.

## Files in scope

- `src/lib/security-headers.ts` — frozen `PATH_CACHE_CONTROL`,
  `ASSETS_CACHE_CONTROL`, `getPathCacheControl()`, `withPathCacheControl()`.
- `src/lib/security-headers.test.ts` — `_headers` parser, Cloudflare
  simulator, 14 probes, orphan check, middleware-composition check.
- `src/start.ts` — middleware now runs `withPathCacheControl` after the
  HTML default, keyed on the request pathname.
- `docs/ops/deploy-contract.md` — new headers section only (appended;
  no other lines touched).
- This status file.

Out of scope: `public/_headers` (unchanged), migrations (5.2),
Storybook (0.4), audio (Phase 1), math (Phase 3), `src/server.ts`
(verified: no new call needed).

## Dependencies / ordering

Base is `origin/main` `c733fe68` (PR 550 merged). Test first, then
module, then middleware wiring, then docs, then gates, then panel,
then draft PR. Before any merge ask: GitHub "Update branch" onto
latest main, rerun gates, report the synced head SHA (owed, not done
here).

## Ownership

Branch `chore/phase-5-3-response-policy`. Builder does the edits;
lead verifies. Pushes go to this branch only.

## Verification contract

Gates (each PASS / FAIL / NOT RUN): `npx tsc --noEmit`, `npm test`,
`npm run test:worker`, `node scripts/lint-cards.mjs`,
`npm run build:pages`, `npm run lint:nav`, `npm run lint:subjects`,
`npm run check:provenance`, `npm run check:entry-size`,
`npm run lint:arch`, `npm run ci:required` (every row, lint
report-only). Playwright: only specs the change can break; none
mention Cache-Control or response headers, so NOT RUN with that
reason. CI runs the rest.

## Assumptions, risks, unknowns

- The `_headers` simulator in the test implements Cloudflare's
  documented apply order (file order; detach before sets within a
  rule; first set replaces, later set appends). It is a model of the
  platform, not a live probe; a live probe is still the way to confirm
  production behaviour.
- Risk: the `/` and `/index.html` rows carry `s-maxage=60`, which must
  never reach rendered HTML. Guarded twice: `withPathCacheControl`
  skips HTML responses, and the middleware runs it after
  `withHtmlCacheControl`, which has already set the plain value. A
  test asserts the composed result on rendered `/`.
- Risk: a future `_headers` block with no table entry fails the
  orphan test on purpose — that is the tripwire, not a bug.

## Simpler or rejected approach, and why

Option B (a separate `src/lib/cache-policy.ts` with a
`resolveCacheControl` simulator) was not picked. It would create a
second headers module, against the goal's "one headers module", and
its simulator would be a second model of Cloudflare apply-order that
must itself stay correct. The simulator idea lives only inside the
test, not in production code.

## Statechart

request → guard-blocked (`server.ts`, error, security headers only) →
TanStack handler → middleware (`start.ts`: security headers, then HTML
Cache-Control for `text/html` without one, then path Cache-Control for
non-HTML without one) → response; plus static-asset path (`_headers`
applies, Worker never sees it); plus already-set header (kept, never
overridden).

## Architect

`src/lib/*` is layer 2 pure helpers; `src/server.ts` and `src/start.ts`
are server code outside the layer map until Phase 5. Imports point
down: server → lib; lib imports nothing app-level.

## Budget

Tier 2, cap 400k tokens, estimate 120k–180k (inferred). Running total
so far is arena only (~12k estimated, no meter). At 80% of the cap
(320k), stop and report instead of spawning. No meter exists; numbers
are estimates.

## Approvals needed

Panel approval of the final tip, then Veeresh's per-PR merge word.
Merges are Veeresh's, pinned to head SHA. This run stops at a draft PR.

## Gate results

Run on branch `chore/phase-5-3-response-policy` at base `c733fe68`
(before commit; commit SHA in the PR). Failing-test-first proof:
`node --experimental-strip-types --test
src/lib/security-headers.test.ts` failed before the production code
with `SyntaxError: ... does not provide an export named
'ASSETS_CACHE_CONTROL'` (0 pass, 1 fail), then 19/19 pass after.

| Gate | Result | Note |
| :--- | :--- | :--- |
| `npx tsc --noEmit` | PASS | |
| `npm test` | PASS | 3010 tests, 3010 pass, 0 fail |
| `npm run test:worker` | PASS | 235 tests, 235 pass, 0 fail |
| `node scripts/lint-cards.mjs` | PASS | GATE PASSED |
| `npm run build:pages` | PASS | (missing CONTACT_DISCORD_WEBHOOK_URL warning is pre-existing dev-only) |
| `npm run lint:nav` | PASS | |
| `npm run lint:subjects` | PASS | GATE PASSED |
| `npm run check:provenance` | PASS | re-run after commit (see PR) |
| `npm run check:entry-size` | PASS | entry JS gzip 317,740 B, limit 323,865 B |
| `npm run lint:arch` | PASS | |
| `npm run ci:required` | PASS | every row PASS except lint FAIL (report-only) and Playwright NOT RUN; see below |
| `lint` (inside ci:required) | FAIL (report-only) | 28 errors, 160 warnings, all pre-existing in `tests/e2e` and `workers/crash-report` tests; `npx eslint` on the three changed source files exits 0 |
| Playwright e2e | NOT RUN | the two header-touching specs (`journal-player.csp`, `grownups-privacy-contact`) were attempted; the browser cannot launch in this runner (`Hatch WebGL domain policy is required for browser startup`, exit 13) — launch fails before any page loads, so no request ever reaches the changed code. Same verdict as `ci:required` ("no browser in this runner"). CI runs the rest. |

`public/_headers` unchanged. `eslint/layer-baseline.json` untouched
(no new entries). Tokens used: see the final report (estimate, no
meter).

## Graph

Nodes/edges for the integrator (AGENTS.md §7): none added — no new
concepts, only a module extension and a doc section.
