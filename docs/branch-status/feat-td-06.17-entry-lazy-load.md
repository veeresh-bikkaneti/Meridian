# TD-06.17 — entry lazy-load: journal dataset out of the first-load JS

Branch: `feat/td-06.17-entry-lazy-load`
Base: origin/main `f5448d85`
Story: TD-06.17 (issue #621) — restore the entry gzip cap that PR #620
raised for one PR (323,865 → 324,995 B) by moving non-boot-critical
data out of the first-load JS.

## What changed

- `src/components/home-journal.ts` no longer statically imports
  `home-journal.data.ts`. It holds the dataset behind a memoized
  dynamic-import loader, `loadJournalNotes()` — the fail-closed
  contract copied from `preloadTerritory`: never rejects, resolves
  false on failure, and evicts the cached promise so the next call
  retries. The sync rotation functions read the loaded cache and
  degrade to the spec §7 empty-dataset results until it lands
  (count 0, index -1, null set). The dataset types arrive through a
  type-only import, erased at build.
- `src/components/game-app.tsx` (7,695 lines, unchanged count,
  ceiling unchanged): the Choose rotation effect kicks
  `loadJournalNotes()` and recomputes when it lands, so the current
  window's entry applies and renders exactly as before (note for a
  timestamp, §6 focus/on-screen deferral, footer countdown). The
  entry render is gated on the applied index, so nothing renders
  until the data is in. The in-round prefetch derives its note ids
  from the same sync readers: before the data lands it no-ops (the
  documented cold-tap failure mode), and once the data is ready it
  is unchanged. Boot order, the `pageshow` handler, and
  `pagehide`/`handlePageHide` are untouched.
- New pin: `src/components/home-journal-lazy-boundary.test.ts` —
  a static `home-journal.data` import on the entry path, or a
  value import in `home-journal.ts`, now fails a unit test.
- Cap restored to 323,865 B: `ENTRY_JS_GZIP_LIMIT` in
  `scripts/check-entry-size.mjs` (+ its test) and
  `LIMITS.entryBytes` in `scripts/test-regression-wave.mjs`
  (+ comment and verdict pins in its test). No cap was raised.

## Measured

- Entry JS gzip: **310,133 B** (limit 323,865; 13,732 B to spare) —
  the journal notes (~14 KB gzip) left the entry closure; the three
  pin strings (`images/journal/capitol.webp`, the capitol story's
  first sentence, `capitol.nebraska.gov`) are absent from the entry
  closure per `bundle-report.mjs --json` and now live in the lazy
  `home-journal.data-*.js` chunk. Catalog coordinates stay out.
- Gauges unchanged: `noRawIo` 0, `noUpwardImport` 110, shell-ban 6.
- Stayed eager, deliberately: the territory loader (already a thin
  loader; its data was already lazy) and `src/game/session.ts`
  (boot-critical — boot, restore, pageshow, and idle all read it
  synchronously, so a dynamic import could not stay
  behavior-identical). The journal win alone clears the cap with
  headroom for the later lanes (~300 B per extraction).

## Gates

- `npx tsc --noEmit` PASS; `lint:arch` / `lint:nav`
  (`--max-warnings 0`) PASS; `lint-cards` GATE PASSED;
  `check-game-app-size` PASS (7,695 = ceiling);
  `check-e2e-registration` PASS.
- Narrow tests PASS: home-journal, home-journal-wiring,
  home-journal-lazy-boundary, home-journal-heading, journal-prefetch,
  home-loading-orbs, game-app-lazy-boundary, home-smooth-cards,
  shared-shell, shell-registry, map-switched-notice-lifecycle,
  scout-upgrade-lifecycle; script tests for check-entry-size,
  test-regression-wave, check-game-app-size.
- `npm run build:pages`: FAIL locally at the postbuild
  `fingerprint-sw` step only — the pristine base tarball fails
  identically on this VM (proven this run), so it is environmental;
  the vite build + prerender completed and CI is decisive.
- Playwright (only the two named boot-order specs):
  `tests/e2e/observability.spec.ts:26` and `:160` PASS against the
  built artifact.

## Graph

- Adds: branch node `feat/td-06.17-entry-lazy-load`; decision node
  "entry cap restored to 323,865 B (TD-06.17 / #621)" decided-by the
  owner's post-#620 ruling. (Integrator folds these in on merge.)

## Next

- Reviewer pass on the draft PR; merge is the owner's word only.
- Open questions: none. Ruled out: dynamic-importing the territory
  loader and the session module (not needed for the cap; session is
  boot-critical).
