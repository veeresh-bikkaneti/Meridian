# BRANCH_STATUS.md — fix/scout-switch-honesty

## What

Scout Map switching, made honest — both changes are the owner's
rulings of **2026-10-20** (issue #183), after a Scrum investigation
(code + live E2E, on main `8432f75`) answered his two questions:

1. **Q1 — does capability detection auto-switch?** It did not: it
   produced a boot *offer*; the session started in full mode until the
   player accepted, while the code carried a recorded directive ("a
   capability-detected weak device gets a CHOICE, never a silent
   routing") contradicting his decision. His ruling: **"Auto-switch
   silently on weak devices (my decision stands)"** — "check the
   device capability and auto switch; also allow user to manually
   switch."
2. **Q2 — does a manual switch take effect at the next place?** It did
   not: `mapMode` is a constructor input (the map is built once per
   run), so at the next place only the stored record, two DOM
   attributes, and confetti changed — tiles, starfield, DPR cap, zoom
   caps, admin-1 band, and camera motion never changed mid-run. The
   popover's "Applies from the next place — never mid-round" was false
   for every map feature, and the shipped toggle E2E asserted only the
   attribute that does flip. His ruling: **"Force home on manual
   switch (my remedy)"** — "when you manually switch you need to
   reload the entire app to get all features enabled. if that's the
   case we should force the user back to home page."

## The fix

**Change 1 — silent auto-switch at boot** (`src/map/capability.ts`,
boot effect in `src/components/game-app.tsx`):

- No stored record + fresh qualification = scout (prior-crash /
  probe / low-memory) → the session starts in Scout, silently. No
  dialog, no blocking notice; the layers toggle shows the state.
- The decision is persisted as an **auto record** — qualifying source
  kept, NOT manual, NOT accepted — so the existing 7-day decay in
  `readStoredMapMode` re-qualifies the device later, and a device
  that later probes clean returns to full. This matches the
  contextlost record's persistence semantics (the recorded design
  choice; no type change was needed: `planBootMapMode` now returns
  `{ mode, persistSource }` instead of an offer variant).
- A stored manual record still wins over everything and never
  decays; a stored *accepted* record (written by the old dialog)
  likewise. Boot never rewrites a standing record.
- The boot offer is gone: `scout-boot-offer.tsx` deleted, the four
  offer handlers deleted, the offer copy deleted,
  `ScoutOfferVariant` deleted. `writeStoredMapMode` no longer takes
  the `accepted` argument (nothing can write it anymore); the reader
  still honors `accepted: true` on records already on players'
  devices.
- The recorded directive in `capability.ts` is marked **SUPERSEDED**
  with the ruling quoted and dated — history kept, not deleted.
- The `window.__meridianSuppressScoutOffer` seam now suppresses the
  **auto-switch** instead of the dialog (without it, every harness
  boot on the SwiftShader VM would silently start in Scout). It stays
  wired exactly so the suite keeps working — see the flag below.

**Change 2 — manual switch forces home** (`game-app.tsx`,
`map-mode-toggle.tsx`, `scout-copy.ts`):

- A dedicated `handleManualMapMode` in GameApp: writes the manual
  record, stamps the report mode, applies the mode **immediately**
  (no queue), and exits the run — the session (score, banked places)
  survives; the in-progress run is **discarded**. Discarding follows
  the codebase's own pattern (`endTutorial` / `killIdleSession`):
  the persisted run record is removed too, so a later reload cannot
  resurrect a game the popover just said "ends here". (The Editions
  exit deliberately keeps its record — switching editions pauses the
  run; switching the map ends it. First E2E run caught the
  resurrection; the toggle spec now pins reload-stays-home.)
- The queue machinery (`queuedMapMode`, `queuedMapModeRef`,
  `queueAppliedAtIndex`, the render-phase application block, the
  `toggleMapMode` prop) is **removed**: after both changes no path
  produces or consumes a queued mode — manual applies + exits,
  contextlost applies immediately, boot applies pre-mount. The
  queue's index-0 corner (a first-place toggle landing one place
  late in the next run) dies with it.
- `applyMapMode` remains for its one live caller, the
  webglcontextlost tripwire (immediate, with remount).
- Copy: popover footnote now reads "Switching sends you back home —
  this game ends here. Your next game uses the new map." (the warning
  shows *before* the tap); live-region announcements say "Scout Map
  on/off — back home; your next game uses …". Donation copy untouched.

## Fate of the offer-era artifacts

| Artifact | Fate |
| --- | --- |
| `scout-boot-offer.tsx` (dialog) | **deleted** |
| `acceptScoutOffer` / `acceptCapabilityOffer` / `declineScoutOffer` / `dismissScoutOffer` | **deleted** |
| `SCOUT_COPY.bootOffer` / `capabilityOffer` | **deleted** |
| `ScoutOfferVariant`, offer-shaped `planBootMapMode` | **replaced** by `{ mode, persistSource }` |
| `writeStoredMapMode(…, accepted)` parameter | **removed** (read-side `accepted` honored for legacy records) |
| `window.__meridianSuppressScoutOffer` seam | **kept, re-roled** — now suppresses the auto-switch; flagged below |
| Manual-toggle queue | **removed** (no remaining producer/consumer) |
| `scoutOffer` / `scoutOfferShownRef` state | **deleted** (`bootQualified` kept; greeting now waits only for qualification) |

## ⚠ Flag for the owner — issue #154 item 1 is still owed

The `window.__meridianSuppressScoutOffer` seam **now guards the
silent auto-switch**: when the harness sets it, a weak-device boot
stays in full mode and writes nothing. It no longer guards a dialog
(there is none), but it still ships in the production bundle and
still decides boot behavior. Keep-vs-test-only remains the owner's
open call — this branch deliberately does not settle it.

## Tests

- **Unit** (`src/map/capability.test.ts`, rewritten sections):
  `planBootMapMode` pins the silent-apply shape for all three
  qualifying sources + the clean-boot null; the auto-switch record is
  pinned as source-kept, **no `accepted` key**, decaying after 7
  days; a source-reading pin replaces the old #154-item-7 accept
  wiring pin (boot persists `plan.persistSource`; the dialog cannot
  come back; the seam stays wired); legacy accepted/decline records
  are pinned as raw-JSON seeds — the exact shape older builds left on
  real devices.
- **E2E, converted not deleted:**
  - `scout-toggle` — the "next place mount" test is replaced by:
    toggle during a run's **first place** → home → record written →
    the new run's **first place** carries the new mode at **feature
    level** (starfield absent, zero satellite tile requests — never
    the `data-map-mode` label alone); the reverse direction restores
    starfield + tiles; a session test pins that banked places and
    score survive the trip home.
  - `scout-offer` — prior-crash: silent scout + auto record, the
    crash flag stays one-shot, the standing record is never
    rewritten, clean boot writes nothing, manual beats the flag.
  - `scout-capability-offer` — probe + low-memory silent switches,
    manual-full-beats-probe, legacy accepted record stands at 400
    days, decayed record re-qualifies on a weak device and returns
    to full on a now-capable one, greeting arrives with no dialog,
    and the WS-4 tile-failure interplay now runs off a settled
    manual record.
  - `scout-throttled` — SwiftShader + 6× CPU: silent switch, game
    completes in scout.
  - `scout-false-demotion` — goldens unchanged in behavior; the
    vacuous "modal hidden" checks became a real pin (no record
    written at boot on a capable device).

## Docs

- `docs/scout-offer-policy.md` — rewritten: silent-switch rules +
  decay table, the force-home rule, the seam's new role; the old
  offer/non-nag record kept under "Superseded" (filename kept for
  link stability).
- Handbook ch06 §4 — rewritten with both rulings quoted and dated;
  the offer record marked superseded; the /jury fix #2 item (Scout
  dialog gating the first visit) recorded as resolved by the ruling.
  Ch09's Scout Map glossary entry updated to match.
- `capability.ts` — the superseded directive is quoted and marked in
  `planBootMapMode`'s docstring; `StoredMapMode.accepted` and
  `writeStoredMapMode` docs explain the legacy flag.

## Gates

Run at the branch tip, `VITE_KOFI_URL` set at build and test time,
E2E `--workers=1`:

- `npx tsc --noEmit` — **clean**
- `npm test` — scripts **799 (790 pass / 9 skip / 0 fail)** + src
  **1363 pass / 0 fail**
- `node scripts/lint-cards.mjs` — **GATE PASSED**
- `npm run build:pages` — **green**
- E2E vs the built artifact (`--workers=1`): scout-toggle **5/5**,
  scout-offer **4/4**, scout-capability-offer **8/8**, scout-throttled
  + scout-false-demotion + scout-context-lost + scout-switch-note +
  ws4-tile-fallback **23/23** (one batch), scout-narrow-repro
  (zoom-space) **4/4** — **44 passed, 0 failed** across every touched
  or neighboring suite. Two first-run failures were test bugs, not
  app bugs, and both are now pinned properly: the run-resurrection
  (fixed in the app — see Change 2) and a seed helper that re-seeded
  on every navigation (fixed in the harness — `seedManualMode` is
  write-once, matching write policy Q3).

## Ready to merge?

**NO — owner's review pipeline + merge word.** The full review
pipeline runs next; nobody merges without the owner's word. (Expect
a merge-time rebase: this branch is based on `89e474c` and a parallel
hint-default build may land first — the surfaces are disjoint.)

