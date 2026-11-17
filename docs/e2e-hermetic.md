# Hermetic e2e: the exact recipe

Every e2e spec must produce the same result on any machine, with no
network luck involved. Two failure classes kept breaking that promise:
borrowed `node_modules` (copied or symlinked between checkouts — files
go missing and builds fail in confusing ways) and the board's live
GitHub feed (a spec that forgets to stub `api.github.com` silently
depends on the real API, its rate budget, and data that changes under
the test). This page is the recipe that removes both.

## The recipe (cold start)

1. **Install complete, never borrowed.**

   ```sh
   npm ci
   ```

   Always from the lockfile, in the checkout you are about to test.
   Never copy, symlink, or share `node_modules` from another
   worktree — a borrowed install is how the maplibre worker file went
   missing while every other symptom pointed at the app.

2. **Pin the browser.** On this VM, use the cached Playwright
   Chromium — it is the binary proven to run headless here:

   ```sh
   export PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
   ```

   Do not rely on the config's `/opt/meta-chromium/chrome` fallback
   on this VM: that binary refuses headless startup, which presents
   as mass spec failure. `playwright.config.ts` honours
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE` before any fallback. In CI the
   workflow installs Playwright's bundled Chromium and neither path
   is needed.

3. **Build the artifact.** Specs serve `dist/client` from disk
   (`serveBuiltArtifact` in `tests/e2e/helpers.ts`); there is no dev
   server and no `?e2e=1` mode — never use one.

   ```sh
   npm run build:pages
   ```

4. **Run serialized, one suite at a time** (VM-wide lock, one
   worker — concurrent suites exhaust this machine's memory):

   ```sh
   flock ~/workspace/.e2e.lock npx playwright test \
     tests/e2e/board.desktop.spec.ts \
     tests/e2e/grownups-privacy-contact.desktop.spec.ts \
     --project=desktop --workers=1
   ```

## How the feed stays hermetic

`serveBuiltArtifact` (the shared setup every spec inherits) registers
two defaults in every e2e context:

- **Kill switch on.** `flags.json` is served with
  `boardLiveFeed: false`; the rest of the shipped payload is
  preserved verbatim. The board's live GitHub check therefore never
  runs by default. Production is untouched — `public/flags.json`
  still ships `boardLiveFeed: true`; the flip exists only inside an
  e2e context's request interception.
- **GitHub from fixtures.** `api.github.com` is fulfilled from
  committed seed fixtures in `tests/e2e/fixtures/github/`, never the
  live API: pulls page 1 carries every board-linked record at its
  captured state, the issues page is empty, later pages are empty,
  and any other GitHub path 404s. Even a spec that opts the feed back
  in without stubbing the API itself runs deterministically.

Specs that register their own routes after `serveBuiltArtifact` win
dispatch (Playwright's later-registration rule), which is how the
exceptions work:

- `board.desktop.spec.ts` is the feed's own test. Its `beforeEach`
  opts back in — it re-serves the shipped `flags.json` verbatim —
  and keeps the API stubbed per test (aborted by default, fulfilled
  payloads in the live-feed tests). No test in that file reaches the
  real GitHub either.
- `collectTelemetry` re-serves `flags.json` with its own payload for
  telemetry specs, as before.

### Regenerating the seed fixtures

The fixtures mirror the same inputs the board spec builds from —
`src/board/curation.json` (the linked record numbers) and
`src/board/record-states.json` (their captured states). To refresh
`tests/e2e/fixtures/github/pulls-page1.json`: emit one item per
linked record as `{number, state: "open" | "closed",
merged_at: "2026-11-01T00:00:00Z" | null}` (`state`/`merged_at` from
the captured `{open, merged}`), sorted by number, then pad to 100
items with closed+merged fillers numbered from 9000.
`issues-page1.json` stays `[]` — every linked record is a pull
request today; if a linked issue ever appears, give it an entry
`{number, state}` here instead.

## Baselines: only a delta counts

Before citing any e2e failure as a branch bug, run the same spec on
unmodified `main` in the same environment (Review Round 2, rule 8).
Measured baseline on `main` `2ce6757a` under this recipe
(2026-11-16): **board 18/18 and grownups-privacy-contact 5/5 pass
(23/23)**. Earlier reports of both specs failing wholesale on main
were environment failures — the wrong browser binary and borrowed
installs — not spec or app bugs. A failure that also happens on main
under this recipe is an environment failure; a failure that happens
only on your branch is yours.
