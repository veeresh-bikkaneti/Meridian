# BRANCH_STATUS — feat/sprint-entry-gates

Sprint entry-gate fixes (Reality Checker audit): SW offline gap, >500 kB
chunks, dead audio code-split, missing .catch on AI hooks. Infra/hygiene
only — no game mechanics or content changes. Branch off main@ae524e3.

## Done

### P1-3 — dead code-split (commit ee0a76b + 3704c71)
- `src/components/celebration-overlay.tsx`: removed BOTH ineffective
  dynamic imports (`play-guards`, then `sfx` — the sfx one was flagged in
  the baseline build too, alongside play-guards). Static imports instead;
  the string lookup + optional call keeps the silent no-op on a missing
  recipe export. Audio behavior unchanged.
- Decision: did NOT make all sfx imports dynamic. sfx is 12.6 kB and its
  call sites are synchronous gesture-time handlers (autoplay-policy timing
  — a dynamic import's network round-trip risks pushing play() outside the
  transient activation window); initAudio's `{ once: true }` boot wiring is
  load-bearing on mount. ~13 kB savings wasn't worth the UX risk.
- Verify: zero `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings in build output;
  initial index chunk unchanged (435.80 kB vs 435.83 kB baseline).

### P2 — missing .catch (commit 0ef254e)
- `src/game/story-ai.ts` (`useAiStory`), `src/game/sports-ai.ts`
  (`useAiSportsTeams`): defensive `.catch` on the async IIFEs — enrichment
  is best-effort; an unhandled rejection must never surface as console
  noise or a crash-report false positive. The other two `(async` sites in
  those files are default `openSession` callbacks awaited inside try/catch
  ("Never throws") — no change needed.

### P1-2 — chunks >500 kB: STOPPED per scope (no code change)
- Baseline: initial entry chunk `index` = 435.83 kB (under the limit — no
  initial-load regression exists). All five >500 kB chunks are ALREADY lazy
  at the finest content-preserving granularity: per-region GeoNames place
  data (australia 869, UK 852, china 701, canada 614 kB — atomic game-content
  datasets) + `ne-50m-admin-1.json` (806 kB boundary data) + the verbatim
  vendor worker asset `maplibre-gl-shared.mjs` (516 kB, emitted copy, not a
  rollup chunk). The audit's "likely the satellite-map chunk" guess was
  wrong — satellite-map is 40 kB and lazy.
- Forcing zero warnings would require decomposing atomic game datasets
  (content/mechanics change — out of scope) or raising
  `chunkSizeWarningLimit` (suppression, not a code-split). Per the STOP
  clause: documented, not improvised. The warning persists by design.

### P1-1 — SW offline gap + offline-uncached loop notice (commit 1a28ee6)
- `public/sw.js`:
  - `isStaticAsset()` now cache-first covers `/Meridian/audio/` (comet TTS),
    `/Meridian/__grok/` (PWA assets), and `/Meridian/loop/` (edition data).
  - `/Meridian/loop/` (~13 MB) is RUNTIME cache-first only — the deck is
    deliberately NOT precached at install (too big for a background
    install on older devices). Only `loop/manifest.json` (60 bytes) is
    precached at install; clues + `loop/names.json` populate on first
    online use.
  - Precache decision (Designer 2c): precache manifest.json YES;
    names.json NO — it is 11.5 MB, not the "small file" the design assumed.
    Install-time cost on old devices ruled it out; runtime cache-first
    covers it after first guess use. Edge documented: a mystery opened
    online but never guessed at won't have names.json offline (guess input
    fails closed; the notice only covers mystery *opening*).
  - Designer 2e verified EMPIRICALLY (Playwright, throwaway spec, 2/2
    green): `fetchJson`'s `cache: "no-store"` does NOT bypass the SW —
    the fetch event fires, `caches.match()` hits, the network response is
    cached. A mystery opened online replays fully offline.
- `src/hooks/use-online-status.ts` (+ test, wired into `npm test`):
  shared `navigator.onLine` + online/offline listeners, SSR-safe fail-open.
  Designer 2a satisfied at the point of use (LoopScreen) with a ref mirror
  so the catch-time trigger reads connectivity at the moment the fetch
  failed, never a stale render-closure value.
- `src/game/loop/LoopScreen.tsx`:
  - `LoadState` error variant gains `offline: boolean`; `toErrorState(err,
    offline)` threads it through mount-deal, Next-mystery-deal, and both
    safety-net paths. Same copy for both deal paths; stale-build and
    generic error paths byte-identical.
  - Offline-uncached notice in the EXISTING error-card slot
    (`role="alert"`, `mt-10 rounded-xl border border-line bg-surface p-5`):
    UX-finalized copy, no host character —
    `This mystery can't open right now 🔍` /
    `The clues need the internet the first time. Once a mystery opens, you
    can play it offline too.` / `Try again` (min-h-[48px]).
  - Designer 2b: NO separate cache-presence probe — the SW cache-first
    fetch IS the probe. Cached content resolves and never reaches the error
    path, so the notice only appears when the mystery is truly unplayable.
  - Designer 2d: verified — edition datasets (manifest + clue + names.json
    via runtime cache) are genuinely playable offline before the copy
    promises it. Designer rec 3 ("play a cached prior case") NOT built —
    breaks the exactly-once deck.
- `tests/e2e/offline-content.spec.ts` (sibling-authored; I only aligned the
  button assertion `Retry` → `Try again` per UX copy authority): needs its
  project entry in `playwright.config.ts` (sibling flagged to sprint lead).

## E2E environment quirk (flagged to sprint lead)
- Chromium 152 resets `navigator.onLine` to `true` on any offline *document
  navigation* (verified: setOffline→false on same doc; true after goto/
  reload; the `offline` event never fires). The notice trigger is correct
  for real browsers; E2E must exercise it WITHOUT offline document
  navigation (go offline in the live document, then SPA-transition into
  the loop screen). The sibling's `offline-content.spec.ts` test 2
  currently does an offline `goto` — it needs the same adjustment or it
  can never see the notice in this environment.

## Verification (2026-10-08, this branch)
- `npx tsc --noEmit` clean
- `npm test` green (512 scripts tests: 505 pass / 0 fail; 852 src tests: 852 pass)
- `node scripts/lint-cards.mjs` GATE PASSED
- `npm run build:pages` green; `postbuild:pages` fingerprinted sw.js
- Zero `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings (was 2 in baseline)
- Initial bundle: index 435.80 kB (baseline 435.83 kB) — no regression
- Throwaway Playwright verification (deleted after): 2/2 green —
  cached mystery replays offline; uncached shows exact UX notice; zero
  app errors (map tiles/worker offline noise filtered as pre-existing)

## Pending
- Sprint lead: P1-2 STOP decision needs sign-off (warning persists by design).
- Sibling's `offline-content.spec.ts`: needs the offline-navigation fix
  above + its `playwright.config.ts` project entry before it can go green.
- Pre-existing (not mine, not fixed): nothing in src references the copied
  `maplibre-gl-worker.mjs`, so MapLibre's default worker URL fails even
  online ("Worker failed to load" console error).
- Push to origin (blocked on PAT handoff — this VM has no GitHub login).
- Owner review + PR as usual. Never merge — owner merges.
