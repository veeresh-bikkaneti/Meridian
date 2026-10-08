# BRANCH_STATUS — feat/storyteller-mascot

Storyteller mascot v1 (reconciled design-doc scope): lazy `StorytellerMascot`
figure + `StorytellerNarration` (text-first captions, gesture-gated audio),
docked in ResultCard + run-summary modal + GeoDetective "The Hook" clue.
No home host (deferred to H1, gated on PR #103).

## Done

- `src/components/storyteller-lines.ts` — final copy (reveal-01 / hook-01 /
  summary-01, exact design-doc text), `storytellerAudioUrl` /
  `storytellerFigureUrl` (safe import.meta.env seam like pwa.ts),
  `wordMsFromDuration` caption-sync math, session-once
  `claimFirstRevealNarration()`.
- `src/components/storyteller.tsx` — `StorytellerMascot` figure
  (`aria-hidden` img, `decoding="async"`, circular mask, pointer-events gated
  like CometMascot; asset via URL so the F1 cutout drops in with zero code
  change) + `StorytellerNarration` implementing the UX narration contract:
  text-first `role="status"` caption, one-shot pointerdown/keydown first
  gesture (Comet pattern, 600ms tap-guard), 44px speaker button that never
  flips `meridian.sound`, 44px per-line replay (hidden when muted),
  tap-caption dismiss (focus returns to the card's Continue), figure tap =
  pause/resume, audio failure → silent text-only + the fallback line
  ("The words are right here — read along with me."). Reduced motion:
  ≤150ms opacity fade, full text instantly, no float. Hidden while the
  tasting-tour overlay walks (`meridian:tour-walk-start/end` + DOM check).
  Default export for `React.lazy` — separate chunk, verified absent from
  the initial bundle (`storyteller-CvZpQyr1.js` 6.5kB, 0 hits in index-*).
- `src/components/storyteller-mascot.css` — dock/modal/inline variants;
  72–96px @390px, 96–144px @1280px; 220ms fade+rise in, 150ms fade out.
- Hosts (all `React.lazy` + `Suspense`):
  - `result-card.tsx` — docked top-left of the card, peeking ~40% above the
    edge (`.result-card` now `position: relative`); first reveal/session
    auto-narrates, later reveals text + speaker; dismiss returns focus to
    the Next-place CTA.
  - `run-summary.tsx` — docked inside the modal above the title, ≤96px /
    ≤128px; one line, text-first + speaker (T4).
  - `src/game/loop/LoopScreen.tsx` — hook-only: caption + speaker button
    (no figure) under the tier-4 "The Hook" clue card, auto once per puzzle
    (module-level set keyed by cycle:index).
- `src/components/grandpa-coffee-run.tsx` — dispatches
  `meridian:tour-walk-end` at both walk-end points (handoff → seated, and
  the no-geo fallback → strip) so the Storyteller yield releases.
- `src/lib/observability.ts` — union extensions only: 6 storyteller event
  types + `storyteller_ready` milestone. Events are COPPA-clean
  (screen/trigger/booleans/duration only, `sanitizeError` for error_name).
- `public/sw.js` — install-precache for the 3 storyteller mp3s
  (versioned asset cache, best-effort). Runtime cache-first comes from
  main's `/Meridian/audio/` isStaticAsset prefix (PR #107) — the branch's
  narrower scoped prefix was dropped as redundant in the rebase.
- Audio: 3 mp3s generated at build time with the TTS CLI, voice
  `avocado_v2:TruthTeller` verified character-for-character in
  `voice_source.json`; ffprobe-valid (reveal 9.2s/73kB, hook 5.9s/47kB,
  summary 7.0s/56kB). Art: source JPEG resized to 512px at
  `public/images/storyteller/storyteller.jpg` (circular CSS mask, no
  chroma-key).
- `src/components/storyteller.test.ts` — 7 unit tests (copy contract,
  URL builders, sync math incl. fallbacks, session-once); wired into
  `npm test`.
- Gates: `npx tsc --noEmit` clean · `npm test` 889/889 pass ·
  `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` green (prerender + SW fingerprint ok).

## Fix pass — review gauntlet blockers (2026-10-08)

All three merge blockers fixed, gates re-verified:

1. **False fact in narration (game designer).** The summary line claimed
   "You found five hidden places today" — runs are endless, so it
   miscounted. Now count-neutral: "And so our tale comes to an end! What
   an adventure!" (`storyteller-lines.ts:29`). `summary-01.mp3`
   regenerated from the exact new text (tts `avocado_v2:TruthTeller`,
   ffprobe-valid 4.85s/38kB); text pins updated in `storyteller-lines.ts`
   and `storyteller.test.ts` so caption == audio.
2. **Initial bundle leak (architect).** `result-card.tsx`, `run-summary.tsx`,
   `LoopScreen.tsx` statically imported `./storyteller-lines`, pulling
   ~2.3KB of caption copy into the initial routes chunk. Hosts now pass
   `lineKey: "reveal" | "hook" | "summary"`; `STORYTELLER_LINES` resolves
   inside the lazy `storyteller.tsx`. The session-once
   `claimFirstRevealNarration()` moved to the copy-free
   `storyteller-claim.ts` (hosts import that, not the lines). Verified:
   post-fix routes chunk has **0 bytes** of caption copy (pre-fix build
   had all 3 lines + the stale summary text); the only "storyteller"
   references left are the lazy chunk's hashed filenames. Also removed
   unused `DISMISS_AFTER_SPEAKER_MS` and `wasPlaying` (developer nits).
3. **E2E coverage of interactive paths (developer).** New
   `tests/e2e/storyteller.spec.ts` + `storyteller` project in
   `playwright.config.ts` (1440×900). Five tests on the story host
   (sound-off speaker model): text-first render with the exact caption
   copy, speaker button starts the mp3 request (toggle untouched), replay
   re-requests the clip, tap-caption dismisses, aborted mp3 →
   `narration_failed` → text-only fallback renders. Zero console errors
   asserted per test. Result: **5/5 pass** (6.1m). Test hardening notes:
   the SW precaches mp3s cache-first, so audio tests neuter SW
   registration to keep requests observable; the fallback assertions use
   one atomic in-page snapshot (the text-only path auto-dismisses at 6s);
   a 0.2s silent fixture (`tests/e2e/fixtures/storyteller-tiny.mp3`)
   stands in for the real clips.
- Gates after fix: `npx tsc --noEmit` clean · `npm test` 856/856 ·
  `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green.

## Pending

- Owner: PR review + merge (NEVER merge from here — open PR only).
- Veeresh: SW precache deploys with the site automatically (no extra step).
- Follow-ups (not in v1): H1 home host (gated on #103), F1 transparent
  cutout, F2 pose variants, F3 line sign-off, F4 name sign-off.

## Notes

- 2026-10-08: team moved to dedicated worktree `~/workspace/meridian-storyteller`
  after a shared-tree collision with the age-profile studio (resolved, no data
  loss either side). This branch stages named storyteller files only.
- 2026-10-08: follow-up `9f5b8c8` — idle float 3s → 2s per design-doc (tester P2).
  tsc clean, build:pages green. No P0/P1 findings in Phase B validation.

---

## Merged base (main@f07dad3, PR #107)

# BRANCH_STATUS — feat/sprint-entry-gates

Close the invisible error classes the expert panel found after Emily's iOS
crash produced no Discord alert: tile failures, region-chunk start errors,
and route-boundary errors never emitted anything. Plus: device-blind
Discord alerts, fallback-UI a11y, and a post-deploy smoke script.

Rebased onto origin/main@4e09990 (PR #104 facts-ladder merged) — see "Merged base" below.

## Rebase 2026-10-08 (onto origin/main@4e09990 — PR #104 merged)
- 4 commits replayed. 1 conflict, BRANCH_STATUS.md docs-only (full-file):
  kept this branch's doc, added "Merged base — facts ladder" section.
  Zero code conflicts.
- Post-rebase gates (all on final head): tsc clean · lint-cards GATE PASSED
  (124,690 records) · npm test 744 scripts + 868 src pass, 0 fail ·
  build:pages green · crash-watchdog e2e 4/4.

## Merged base — facts ladder (PR #104, main@4e09990)

The rebase base now contains the merged facts-ladder pipeline (was
facts-ladder-train). 247 kid-safe facts (arkansas 20, australia 227) in
derived per-region indexes (`src/game/data/geonames/facts/<regionId>.json`),
overlaid at runtime onto chunk places; production chunk files are never
written by build scripts. None of that is this branch's work — it is
inherited from main.

## Rebase verification (2026-10-08, branch @ 4bf80c2 on f07dad3)

- `npx tsc --noEmit` clean
- `node scripts/lint-cards.mjs` GATE PASSED (124,690 records)
- `npm test` green — src suite 857/857 (854 baseline + 3 from #107's
  `use-online-status` tests), scripts suite green, exit 0
- `npm run build:pages` green; sw.js stamped buildId=4bf80c2
- Playwright `tests/e2e/crash-watchdog.spec.ts`: 4/4 passed
- Conflicts resolved (mechanical, both sides kept): BRANCH_STATUS.md
  (kept crash-pipeline entries + entry-gates entries), package.json
  (test list now includes BOTH `use-online-status.test.ts` and
  `error-component.test.ts`; `smoke:crash` script kept)

## Done

- `src/lib/observability.ts`
  - New `tile_failed` event type; `emitTileFailed()` (instance + module
    wrapper, mirroring `emitMapError`).
  - `emit()` now attaches the coarse `os`/`form` device bucket
    (`coarseDeviceFacts()`, COPPA-safe — never raw UA) to every event, so
    Discord alerts can say "ios/mobile".
- `src/map/satellite-map.tsx` — `useEffect` emits `tile_failed` when the
  tile status transitions to "failed" (one emit per failure episode; Retry
  resets to "loading").
- `src/components/game-app.tsx` — the region-chunk `startError` catch now
  also emits a `js_error` with the sanitized message.
- `src/lib/error-component.tsx` — `AppErrorComponent` (route error
  boundary) emits the caught error once per distinct error (`[error]` dep).
- `workers/crash-report/src/index.ts`
  - Accepts `tile_failed` (else the new app events 400).
  - Discord alert gains a `device: os/form` line (coarse bucket only);
    privacy comment updated.
- `scripts/crash-watchdog.mjs` (rendered 5109/5120 bytes)
  - a11y: safe-area insets on the veil (with `padding:16px` fallback for
    old browsers), 44px secondary link targets, `role="status"` on the
    confirmation.
  - Byte budget: removed the provably-dead second CAP-truncation block
    (error text capped at 300 chars at capture) and the dead button
    hover transition (+ its reduced-motion override).
- `scripts/crash-smoke.mjs` (new; `npm run smoke:crash`) — post-deploy
  gate: `GET /health`, invalid `POST /ingest` → 400 naming `tile_failed`
  (distinguishes the v2 forwarding worker from the v1 logging worker),
  `flags.json` endpoint validated with the app's exact gate, shell HTML
  watchdog markers. 15 s fetch timeouts; deploy-order + false-fail notes
  in the header.
- Review panel (2026-10-08): senior architect APPROVE-WITH-NITS (no P0;
  all P2s addressed or backlogged), DevOps APPROVE-WITH-NITS (2 P1s in
  the smoke script fixed), frontend APPROVE-WITH-NITS (1 P1 safe-area
  fallback + 1 P2 effect dep fixed).

## Merge-gauntlet fix (2026-10-08)

Gauntlet developer review BLOCKED: `src/lib/error-component.tsx` route-error
emit had zero test coverage. Fixed with `src/lib/error-component.test.ts`
(new, colocated with `observability.test.ts`): renders the real
`AppErrorComponent` via `react-dom/client` against a minimal DOM shim
(no jsdom in repo; `.tsx` loaded via the repo's own TypeScript
`transpileModule` + data-URL import sharing exact module instances).
4 tests: exactly one `js_error` per mount, no re-emit for the same error
object, re-emit for a distinct error, zero emissions without render.
Test added to the `npm test` file list in `package.json`.

Verification after fix: `tsc` clean · `npm test` green (src 854/854,
incl. 4 new) · `lint-cards` GATE PASSED · `build:pages` green ·
`crash-watchdog.spec.ts` 4/4. No other files touched.

## Merged base — sprint entry gates (PR #107, main@f07dad3)

The rebase base now contains the merged entry-gate fixes (were
feat/sprint-entry-gates). Entries preserved from main's BRANCH_STATUS.md:

### P1-3 — dead code-split removed
- `src/components/celebration-overlay.tsx`: removed BOTH ineffective
  dynamic imports (`play-guards`, `sfx`); static imports instead. Zero
  `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings; initial index chunk unchanged
  (435.80 kB vs 435.83 kB baseline).

### P2 — missing .catch
- `src/game/story-ai.ts` (`useAiStory`), `src/game/sports-ai.ts`
  (`useAiSportsTeams`): defensive `.catch` on the async IIFEs.

### P1-2 — chunks >500 kB: resolved by design (no code change)
- Entry chunk 435.83 kB (under the limit — no initial-load regression).
  The five >500 kB chunks are already lazy at the finest
  content-preserving granularity. Warning persists by design; senior
  architect signed off.

### P1-1 — SW offline gap + offline-uncached loop notice
- `public/sw.js`: `isStaticAsset()` cache-first covers `/Meridian/audio/`,
  `/Meridian/__grok/`, `/Meridian/loop/` (runtime only; only
  `loop/manifest.json` precached at install).
- `src/hooks/use-online-status.ts` (new, tested).
- `src/game/loop/LoopScreen.tsx`: offline-uncached notice in the
  error-card slot (`role="alert"`) — `This mystery can't open right now 🔍`
  / `Try again` (min-h-[48px]).
- `tests/e2e/offline-content.spec.ts` (new; 5/5 via `--project
  offline-content`).

## Pending
- Pre-existing on main, not fixed here (documented, non-blocking): nothing
  in src references the copied `maplibre-gl-worker.mjs`, so MapLibre's
  default worker URL fails even online ("Worker failed to load" console
  error). Confirmed pre-existing by building main in a worktree.
- Owner review of PR #107. Never merge — owner merges.
