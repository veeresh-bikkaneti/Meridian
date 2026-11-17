# Branch status — fix/ui-e2e-hermetic

Review Round 2, rule 9 (hermeticity prerequisite, do-first stream):
no e2e spec may silently depend on the live GitHub feed, and the
environment recipe is written down so a failure can be classified as
environment vs branch delta (rule 8).

## Plan

1. Baseline first: run board + grownups-privacy-contact on
   unmodified main in the hermetic env (own `npm ci`, cached
   Playwright Chromium) and record counts.
2. Make `serveBuiltArtifact` (tests/e2e/helpers.ts) default every
   e2e context to the killed/fixture mode: flags.json served with
   `boardLiveFeed: false`; api.github.com fulfilled from committed
   seed fixtures. Production defaults untouched.
3. Board spec opts back in explicitly (it is the feed's own test)
   and keeps stubbing the API per test.
4. Env recipe doc: docs/e2e-hermetic.md.
5. Proof: re-run both specs on the branch in the same env; classify
   any failure as pre-existing-on-main vs delta.

## Done

- Baseline measured on main `2ce6757a` in the hermetic env
  (complete `npm ci`, 365 packages; `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
  = cached chromium-1243; `build:pages` green): **board 18/18,
  grownups-privacy-contact 5/5 — 23/23 passed.** This corrects the
  Round 2 expectation (18/18 and 5/5 failing on main): under a
  complete install with the working browser, both specs pass on
  main. The wholesale failures were environment failures (the
  `/opt/meta-chromium` binary the config falls back to refuses
  headless startup; borrowed node_modules miss files).
- helpers.ts: `serveBuiltArtifact` now registers, after its catch-all
  (so specs registering later still win dispatch):
  - `**/flags.json*` → the built flags.json with only
    `boardLiveFeed` flipped to false; falls back to the catch-all
    serve if the file is unreadable.
  - `https://api.github.com/**` → seed fixtures; other GitHub paths
    404. Previously the catch-all passed api.github.com through to
    the real network — the silent live dependency.
- Seed fixtures committed: `tests/e2e/fixtures/github/
  pulls-page1.json` (all 31 board-linked records at their captured
  states from src/board/record-states.json, padded to 100 with
  closed+merged fillers, mirroring the board spec's own payload
  builder) and `issues-page1.json` (`[]`).
- board.desktop.spec.ts: `beforeEach` re-serves the shipped
  flags.json verbatim (the opt-in) with a comment naming the
  hermetic default it overrides.
- docs/e2e-hermetic.md: the cold-start recipe (complete npm ci,
  chromium-1243 path, build, flock + workers=1 run commands),
  how the defaults work, fixture regeneration, and the
  delta-only baseline rule.

## Proof (branch, same env)

- Board + grownups on the branch: **23/23 passed** — identical to
  the main baseline, so no delta and no regression from the new
  defaults (the board spec's opt-in restores its flag; grownups is
  unaffected by the one flipped flag).
- feature-flags.spec.ts also run as the flags-mechanics regression
  check (it intercepts flags.json itself): **8/8 passed** — the
  shared flags default does not shadow spec-registered routes.
- Combined run: 31/31 passed (2.5m, workers=1, chromium-1243).
- `npx tsc --noEmit` clean.

## Open questions

- None. The board spec's per-test API stubbing is unchanged; the
  shared fixture route is a second belt for specs that opt the feed
  in without stubbing.

## Ruled out

- Changing `public/flags.json` or `FLAG_DEFAULTS`: production
  behaviour must not change; the kill is e2e-context interception
  only.
- A Playwright global-setup env var: the app is a static build and
  reads flags at runtime from flags.json, so request interception
  in the shared helper is the one place every spec inherits.

## Graph

- Add node: `docs/e2e-hermetic.md` (documents the e2e hermeticity
  contract; depends-on tests/e2e/helpers.ts serveBuiltArtifact).
- Add node: branch `fix/ui-e2e-hermetic`.
