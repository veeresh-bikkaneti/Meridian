# BRANCH_STATUS — fix/154-seam-test-only (issue #154 item 1)

**State: IN PROGRESS. Ready = NO — the full panel pipeline and the
owner's merge word are still owed** (standing rule: the panel approves
the final tip itself).

Base: `origin/main 33a28fe`. Removes the production test seam
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

## Pending

- [ ] game-app.tsx: seam read + comment removed
- [ ] helpers.ts: capable-device spoof becomes the serve default;
      scout-helpers.ts imports it from helpers (single implementation)
- [ ] The three auto-switch specs: option renamed to
      `{ spoofCapableDevice: false }`
- [ ] capability.test.ts pin inverted; new E2E suppression spec
- [ ] docs/scout-offer-policy.md "Test seam" paragraph rewritten
- [ ] Gates: tsc clean · npm test green · lint-cards GATE PASSED ·
      build:pages green · dist grep for the seam name = 0 hits ·
      Scout E2E family + GeoDetective specs green (--workers=1)
- [ ] PR opened; panel pipeline; owner merges on his word
