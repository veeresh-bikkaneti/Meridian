# Branch status — TD-10.4 test seams

## Capsule (after removal)

Outcome: the 35 test-only seams named below no longer ship in
production `src/`. Browser shortcuts (URL params, DOM handles,
dataset probes) are installed only by `tests/harness/seams.ts`,
which the e2e server passes to Playwright as an init script.
Production reads `globalThis.mh` at the call site and does nothing
when the slot is absent, so the pages entry does not import a
shared seam module. `src/lib/harness-bus.ts` is the same read,
kept for its unit test and not imported by the app. Module resets and counters
stay next to the state they touch, under plain names, and tests
import the old names from `tests/harness/module-seams.ts`.
`window.__meridianGpu` and the unused detective intro reset were
deleted. `scripts/check-test-seams.mjs` baseline is empty (0).
`scripts/check-seam-bundle.mjs` fails if a seam marker survives
in the pages entry chunk.

Original inventory (measured before this removal, kept so a
regression can be named). Base of that measurement: origin/main
796aee9f. The removal branch is `refactor/slice-k-test-seams`.

## Facts (measured on the inventory base)

- **Measured count before removal: 35 distinct test-only seams**
  in production `src/` (test files excluded). One seam = one
  distinct hook (a param, a global, an export, a prop), however
  many sites read it. **Count after removal: 0** (baseline empty;
  the scanner reports no unlisted seam-shaped hook).
- The "534 test-stub guards" figure in HANDOVER and the kanban
  card does not reproduce on this tip under any net tried:
  `data-testid` attributes in production `src/` = 376 grep lines;
  in all of `src/` including test files = 506; a broad seam regex
  (testid | ForTests | __reset | E2E seam | Test-only | Test seam
  | Test hook | Exported for tests) over production `src/` = 443
  lines. 506 is closest; the 534 was likely counted on an older
  tree or a wider net. It should not be quoted again.
- Before removal, every seam below was compiled into a shipped
  bundle (client or server): none sat behind an
  `import.meta.env.DEV` guard. The URL-param and DOM hooks were
  runtime-reachable by any visitor. After removal, those strings
  live in `tests/harness/seams.ts` and are installed only in the
  test page.
- Precedent that removal works: production once read
  `window.__meridianSuppressScoutOffer`; it was removed, and
  `src/map/capability.test.ts:481` now pins its absence.

## Inventory (original, now closed)

Ships = compiled into the production bundle (no DEV guard).
Cure key: **seam module** = register/read the hook from one
test-seam module compiled in only for test builds (a build
define), so production bundles drop it; **test-side** = move the
hook into code only tests import; **delete** = drop it and let
tests drive the real path.

### URL params (runtime-reachable)

| Seam | Sites | Ships | Tests that depend on it | Cure |
| --- | --- | --- | --- | --- |
| `?loop-puzzle=<index>` pins the dealt GeoDetective puzzle | `src/game/loop/day.ts:12,18`; `src/game/loop/LoopScreen.tsx:290` | yes | `src/game/loop/day.test.ts`; ~29 `tests/e2e` detective/geodetective specs | seam module |
| `?idle-ms=<n>` overrides the 2-minute idle timeout | `src/game/session.ts:342-352`; `src/components/game-app.tsx:1829` | yes | `src/game/session.test.ts`; `tests/e2e/helpers.ts` (suite-wide) + ~100 specs | seam module |
| `?celebration=<variant>` forces the celebration overlay | `src/components/celebration-copy.ts:192,208`; `src/components/game-app.tsx:1699` | yes | `tests/e2e/celebration.spec.ts`, `motionmaxxing(.reduced).spec.ts` | seam module |

### DOM / window contracts (runtime-reachable)

| Seam | Sites | Ships | Tests that depend on it | Cure |
| --- | --- | --- | --- | --- |
| `__spotScreen()` on the map wrapper (project current spot) | `src/map/satellite-map.tsx:1050-1052` | yes | `gap-view-reveal.desktop/.reduced`, `reveal-bearing.desktop`, `scoring-v3`, `scout-narrow-repro.zoom-space`, `tests/e2e/helpers.ts` | seam module |
| `__project(lon, lat)` on the map wrapper | `src/map/satellite-map.tsx:1073` | yes | `friend-challenge.desktop`, `friend-challenge-mc2-receive.desktop` | seam module |
| `__boundaryBand()` on the map wrapper (live layer ids) | `src/map/satellite-map.tsx:1095` | yes | `scout-narrow-repro.zoom-space.spec.ts` | seam module |
| `__loopMap` on the Loop map container (the live map object) | `src/game/loop/LoopMap.tsx:283` | yes | `tests/e2e/detective-swap.spec.ts` | seam module |
| Molecule-map dataset probes (`data-bond-count`, `data-draw-calls`, `data-triangles`, `data-probe-x/y/slug`, written at frame 45) | `src/board/molecule-map.tsx:222,423-435` | yes | `tests/e2e/board.desktop.spec.ts` | seam module (gate the writes) |
| `window.__meridianGpu` (shader-compile error text; no reader anywhere in the repo) | `src/map/present/webgpu-presenter.ts:329` | yes | none found | delete (report via the existing error path) |

### Test-only exports, client modules

Each is imported only by test files. Cure for all: **test-side**
(relocate the reset/counter into a test-only helper, or expose it
through the seam module) in the follow-up PR.

| Seam | Site | Tests that depend on it |
| --- | --- | --- |
| `__resetReadAloudPrefMemory` | `src/game/age-profile/read-aloud-pref.ts:147` | `read-aloud-pref.test.ts`, `read-aloud-settings.test.ts`, `src/platform/storage/register.test.ts` |
| `__resetMemoryFallback` | `src/game/age-profile/store.ts:359` | `store.test.ts`, `register.test.ts` |
| `__resetDetectiveSessionIntro` | `src/game/loop/detective/DetectiveHost.tsx:180` | **none found — dead export** |
| `__resetDetectiveManifestCache` | `src/game/loop/detective/detective-audio.ts:205` | `detective-audio.test.ts` |
| `__resetPassportBadgeMemory` | `src/game/passport/badges.ts:156` | `badges.test.ts`, `EarnedBadgeRow.test.ts` |
| `resetPlayGuards` | `src/game/audio/play-guards.ts:53` | `play-guards.test.ts` |
| `clearChunkCacheForTests` | `src/game/generated-places.ts:731` | `generated-places.test.ts` |
| `loadedGlobeTiersForTests` | `src/game/generated-places.ts:737` | `generated-places.test.ts` |
| `recognizedCountryCountForTests` | `src/game/place-name.ts:69` | `place-name.test.ts` |
| `territoryLoadRunsForTests` | `src/game/territory.ts:153` | `territory.test.ts`, `territory-failure/timeout/lazy-boundary` tests, `reverse-geocode.test.ts` |
| `territoryImporterForTests` | `src/game/territory.ts:161` | `territory-failure.test.ts`, `territory-timeout.test.ts` |
| `territoryConversionRunsForTests` | `src/game/territory.ts:171` | `territory.test.ts`, `territory-timeout.test.ts` |
| `admin1LoadRunsForTests` | `src/game/reverse-geocode.ts:72` | `reverse-geocode.test.ts` |
| `admin1ChunkLoadRunsForTests` | `src/game/reverse-geocode.ts:173` | `reverse-geocode.test.ts` |
| `clearAdmin1ChunkCacheForTests` | `src/game/reverse-geocode.ts:178` | `reverse-geocode.test.ts` |
| `clearLoopIndexCache` | `src/game/loop/evaluate.ts:190` | `evaluate.test.ts`, `guess-input.test.ts`, `guess-input-animate.test.ts` |
| `resetFirstRevealNarrationForTests` | `src/components/storyteller-claim.ts:25` | `storyteller.test.ts` |
| `resetStorytellerSessionForTests` | `src/components/storyteller-session.ts:84` | `storyteller-home.test.ts` |
| `resetObservabilityForTests` | `src/lib/observability.ts:1991` | `error-component.test.ts` |
| `currentVoiceOwner` (introspection getter; no production caller) | `src/game/audio/voice-channel.ts:142` | `voice-channel.test.ts`, `voice.contract.test.ts`, `use-voice.test.ts`, `grandpa-ask.test.ts`, `storyteller-voice.test.ts`, `subject-host-props.test.ts` |

### Test-only props

| Seam | Site | Ships | Tests that depend on it | Cure |
| --- | --- | --- | --- | --- |
| `movieUrlOverride` + `transcriptOverride` (deterministic playback paths) | `src/components/journal-player.tsx:61-76` | yes | `src/components/journal-player.test.ts` (only caller) | test-side (stub at the test boundary) |
| `probeStaleBuild` (substitute staleness probe) | `src/components/map-error-boundary.tsx:104` | yes | `src/components/map-error-boundary.behavior.test.ts` | test-side |

### Test-only exports, server modules (server bundle)

| Seam | Site | Tests that depend on it | Cure |
| --- | --- | --- | --- |
| `sharedInMemoryLimiterForTests` | `src/lib/contact/rate-limiter.server.ts:248` | `rate-limiter.server.test.ts`; called by the two reset wrappers below | test-side (fresh limiter per test) |
| `resetRateLimitBindingLookupForTests` | `src/lib/contact/rate-limiter.server.ts:288` | `rate-limiter.server.test.ts`; called by the two reset wrappers | test-side |
| `resetContactStateForTests` | `src/lib/contact/contact-handler.server.ts:215` | `contact-handler.server.test.ts`, `tests/e2e/grownups-privacy-contact.desktop.spec.ts` | test-side |
| `resetFeatureRequestStateForTests` | `src/lib/feature-request/feature-request-handler.server.ts:140` | `feature-request-handler.server.test.ts` | test-side |

## Examined and excluded (not seams)

- **`?scale=1` (`src/lib/flags.ts:174-188`, applied at `:395`) —
  product, not a test seam.** Evidence: it is the flags system's
  documented URL turn-on for the `scalePlay` product flag ("A
  tester turns it on for one page load"; the remote flags.json is
  the other turn-on, gated on educator review). The feature has
  since launched for everyone (`src/subjects/math/index.ts:9`:
  "is live for everyone, no ?scale=1 needed"), and the e2e specs
  that mention it assert the card works *without* it. It changes
  what a player sees by design; it is not test-only.
- **`window.__meridian_ready` (`src/components/game-app.tsx:420,
  2349,2355`) — production contract.** The inline crash watchdog
  injected into the served shell (`scripts/crash-watchdog.mjs`)
  reads it; absence after ~28 s is the boot-failure signal.
  `tests/e2e/crash-watchdog.spec.ts` tests that production
  watchdog, not a shortcut.
- **Board URL state `?feature` / `?story` / `?view`**
  (`src/board/board-data.ts:134-146`) — the grown-ups board's own
  shareable selection, read and written by the page itself.
- **`data-testid` attributes (376 in production `src/`)** — the
  standard selector convention, counted in the "534" analysis
  above but not behaviour-changing shortcuts; out of this story's
  scope.
- **DEV-only tripwire** in `src/components/ui/bounded-text.tsx:96-100`
  (`data-overflow` marker) — behind `import.meta.env.DEV`; never
  ships to production.
- **Preview host bridge** (`src/lib/preview-host-bridge.ts`,
  `src/components/preview-host-bridge.tsx`) — an embedding host
  contract (drives navigation when the app is embedded in preview
  chrome), inert otherwise; not test infrastructure.
- **Server infra that looks dunder-shaped**: `globalThis.__env__`
  (Nitro runtime), the `src/lib/db.ts` `__pg*` / `__pglite*`
  singletons, the `__MERIDIAN_*` Vite define constants — runtime
  plumbing, no test role. All are allowlisted in the ratchet with
  their reasons.
- **`curateEasy` (`src/game/easy-curation.ts:52`)** — product
  logic exported so tests can reach it; not a hook. Noted: no
  production importer was found, so if it is truly unused that is
  a dead-code question for the TD-10.1 lane, not a seam.
- **`?loop-date=`** — retired; mentioned in `day.ts` comments but
  not parsed anywhere. Already gone; no action.

## The ratchet

`scripts/check-test-seams.mjs` encodes the 35 seams as a baseline
(one entry per seam, with its sites) plus an allowlist of the
examined-and-excluded hooks above. It scans production `src/`
with five detectors (test-only names, dunder tokens, URL params,
dataset writes, seam comments) and fails when a detected hook is
covered by neither list, or when a baseline site stops matching.
Run it with `node scripts/check-test-seams.mjs`; its unit tests
(`node --test scripts/check-test-seams.test.mjs`) prove both
failure directions on fixtures and pin the real tree to the real
baseline. It is deliberately not wired into `package.json` in
this PR (the regression-suite lane owns that file); wiring it
into CI is part of the follow-up ask.

Known limit, stated plainly: a brand-new test-only *prop* cannot
be detected mechanically — the two inventoried prop seams are
pinned by their baseline sites (removing one fails the vanish
check), and review is the net for new ones.

## Plan — ask Veeresh before any removal

Per prompt 09 item 4, nothing is removed in this PR. The ask:
approve a follow-up removal PR, and confirm the first batch.

Suggested first batch (highest risk first — all are reachable by
any visitor today, and the `__meridianSuppressScoutOffer`
removal is the worked precedent):

1. The three URL params (`?loop-puzzle=`, `?idle-ms=`,
   `?celebration=`) behind one test-seam module that a build
   define strips from production bundles. `?idle-ms=` is the
   delicate one: the e2e harness (`tests/e2e/helpers.ts`) builds
   on it suite-wide, so its replacement lands first and the suite
   migrates spec-family by spec-family.
2. The map element hooks (`__spotScreen`, `__project`,
   `__boundaryBand`, `__loopMap`) and the molecule-map dataset
   probes, registered by the same seam module.
3. `window.__meridianGpu` — delete outright (no reader exists).

Later batches: the test-only exports (test-side relocation, one
module family per PR), the two prop seams, and the server reset
exports. Each removal PR shrinks the ratchet baseline in the
same change — that is what makes the ratchet shrink-only rather
than a snapshot.

## Status

- Inventory, ratchet and tests written on
  `chore/td-10.4-test-seams-inventory`; gates in the PR body.
- Blocked on: Veeresh's OK for the follow-up removal PR (above).

## Graph

For the integrator to fold in at merge (branches never edit
graph.json):

- Node: `branch:chore/td-10.4-test-seams-inventory` (this branch).
- Edges: the branch `relates-to` the kanban TD-10 story
  (tech-debt lane, dead code and test stubs) and `depends-on`
  nothing on main beyond the base above.
