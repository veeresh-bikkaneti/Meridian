# BRANCH_STATUS — fix/154-seam-test-only (issue #154 item 1)

**State: BUILD COMPLETE, all builder gates green (below). Ready = NO —
the full panel pipeline and the owner's merge word are still owed**
(standing rule: the panel approves the final tip itself).

Base: `origin/main 34ec705` (merged in 2026-10-26, after #248/#250; previously `1ca4c04`). Removes the production test seam
`window.__meridianSuppressScoutOffer` (issue #154 item 1 — the owner's
standing recommendation: remove it from production; the build was
authorized 2026-10-21).

## Census (verified at base, grep over src/ + tests/ + docs/)

- `src/components/game-app.tsx` — the ONLY production read: the boot
  effect computed `suppressAutoSwitch` from the window flag and skipped
  the silent Scout auto-switch when it was `true`. Comment block above
  it described the seam.
- `tests/e2e/helpers.ts` — the ONLY writer: `serveBuiltArtifact` set
  the flag via an init script by default; specs exercising the real
  auto-switch opted out with `{ suppressScoutOffer: false }`
  (scout-capability-offer, scout-offer, scout-throttled).
- `src/map/capability.test.ts` — a unit pin asserting the seam "stays
  wired" in game-app.tsx.
- `docs/scout-offer-policy.md` — the "Test seam" paragraph describing it.

Why the seam existed: the Playwright VM's Chromium uses SwiftShader,
which the boot WebGL probe (correctly) reads as a weak device — so
without suppression every fresh E2E boot silently auto-switched to
Scout and blocked unrelated specs.

## Design: stub the inputs, not the app

Rejected: gating the flag behind a build-time env switch. The E2E suite
serves the *production* artifact (`npm run build:pages` output), so a
seam that is compiled out of that artifact cannot be used by the suite
at all — and a seam compiled in behind an env name is still a shipped
window global any page script could set.

Chosen: the harness now fakes the *device*, not the decision.

- Production: the flag read is deleted. Boot qualification is exactly
  the stored-record check + `planBootMapMode(qualifyMapMode({ priorMapCrash,
  webglProbeOk, deviceMemoryGB }))` it always was, minus the bypass.
  Real players never had the flag set (only the harness init script set
  it), so player-visible behavior is unchanged.
- Harness: `serveBuiltArtifact` installs, by default, the capable-device
  spoof that already existed in `tests/e2e/scout-helpers.ts` (WebGL
  debug renderer reports a discrete NVIDIA GPU; `navigator.deviceMemory`
  reports 8 GB). The app's own probe then honestly qualifies the VM as
  capable and boots full — suppression happens *upstream* of the app,
  through its real qualification path. Specs exercising the auto-switch
  opt out with the renamed option `{ spoofCapableDevice: false }` and see
  the genuine weak-device boot.
- The spoof only neutralizes the probe + memory signals. A stored
  manual record still wins (it always did — boot checks it first), and
  a map-attributed prior crash still outranks the probe in
  `qualifyMapMode`'s order — exactly the signals the Scout specs pin.

## Discriminating pins

- Unit (`src/map/capability.test.ts`): the old pin is inverted — it now
  asserts game-app.tsx does NOT contain the seam name, and still plans
  the boot via `planBootMapMode` + persists the planned source. It fails
  if the seam creeps back into production source.
- E2E (`tests/e2e/scout-harness-suppression.desktop.spec.ts`, new): a
  default-served boot on this genuinely weak VM stays full, writes NO
  stored record, and shows no auto-switch note; the same boot with the
  spoof opted out DOES auto-switch to Scout with a probe auto record.
  If the spoof ever stops working, the first test goes red — the VM
  really is a weak device, so there is no way for it to pass vacuously.
- Gate (this PR's process, not a committed test): the production
  bundle from `npm run build:pages` is grepped for the seam name —
  zero hits required.

## Done

- [x] Census (above)
- [x] Design chosen + recorded (this file)
- [x] game-app.tsx: seam read + comment removed (`effcd43`)
- [x] helpers.ts: capable-device spoof is the serve default (single
      implementation, moved from scout-helpers.ts, which re-exports it);
      the three auto-switch specs use `{ spoofCapableDevice: false }`;
      new discriminating spec (`2aef86d`)
- [x] capability.test.ts pin inverted
- [x] docs/scout-offer-policy.md "Test seam" paragraph rewritten (`c2f1fbb`)
- [x] Synced with `origin/main` (`34ec705`); updated `commitPin` in `tests/e2e/helpers.ts` to also wait for `aria-hidden !== "true"` alongside `data-tile-status === "ready"` so early low-zoom spin tiles (warmed by boot `probeWebGL2()` now running un-bypassed) cannot trigger pin clicks while `.satellite-map` is still `inert` during the intro beat

## Gates (builder-run at the branch tip)

- `npx tsc --noEmit && npm run typecheck:worker` — clean
- `npm test && npm run test:worker` — scripts suite (841 tests: 832 pass / 9 skip / 0 fail) + src suite (1670 pass / 0 fail) + worker suite (85 pass / 0 fail) all green
- `node scripts/lint-cards.mjs` — `lint-cards: GATE PASSED`
- `npm run build:pages` (Ko-fi env set) — green
- **Bundle proof:** `rg __meridianSuppressScoutOffer dist/client/`
  → **0 hits**
- E2E against the built artifact (`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome`):
  - All 9 `tests/e2e/scout-*.spec.ts` files — **47/47 pass** (including `scout-harness-suppression.desktop.spec.ts` 2/2, `scout-capability-offer.desktop.spec.ts` 13/13, `scout-toggle.desktop.spec.ts` 11/11, `scout-switch-note.desktop.spec.ts` 6/6, `scout-offer.desktop.spec.ts` 4/4, `scout-narrow-repro.zoom-space.spec.ts` 4/4, `scout-context-lost.desktop.spec.ts` 3/3, `scout-false-demotion.desktop.spec.ts` 3/3, `scout-throttled.desktop.spec.ts` 1/1)
  - `tests/e2e/cleared-mode.spec.ts` — **11/11 pass**
  - `tests/e2e/chunk-recovery.desktop.spec.ts` — **19/19 pass**
  - `tests/e2e/ws4-tile-fallback.desktop.spec.ts` — **3/3 pass**
  - `tests/e2e/grownups-privacy-contact.desktop.spec.ts` — **3/3 pass**
  - `tests/e2e/hydration-boot.desktop.spec.ts` — **1/1 pass**
  - `tests/e2e/observability.spec.ts` — **3/3 pass**
  - `tests/e2e/geodetective.spec.ts` — **17/18 pass** (the 1 failure at line 238 is a pre-existing `main` strict-mode collision between `PlaceSheet` exit clone and `LoopReveal` heading during `@formkit/auto-animate` 250ms exit; unrelated to Scout Map)

## Design risk for the panel

- The serve-default spoof also sets `navigator.deviceMemory = 8` for
  EVERY spec (previously only Scout specs spoofed). Other readers of
  deviceMemory: confetti's low-end particle cap and home-globe's
  low-memory fallback (both treat 8 as capable — the same reading the
  real VM's Chromium already reports, capped at 8) and observability's
  device stamp. The full Scout + GeoDetective batch above ran under
  the new default; a full-suite E2E pass remains the panel's to run.
- Init-script ordering: the serve-default spoof is registered when
  `serveBuiltArtifact` is called; a spec that calls
  `spoofLowMemoryDevice` afterwards still wins for deviceMemory
  (configurable getter, later script redefines it) — pinned by the
  low-memory test in scout-capability-offer passing in the batch.

## Pending

- [ ] Panel pipeline (full) on the final tip
- [ ] Owner's merge word
