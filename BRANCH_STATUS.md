# BRANCH_STATUS — feat/place-accessibility-ws1

Owner: Frontend Developer (Waves C+D fix wave) · Branch: `feat/place-accessibility-ws1` · Base: origin/main @ f4f92ad
· Created: 2026-10-09. **PUSH OK, DO NOT MERGE** — Scrum Master opens the PR after the gate wave; Chitti is the only merge path.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical (verified by grep after every edit):
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`
Hard rules: $0/offline/keyless; COPPA-safe; no paywalls; do not invent place coordinates.

## Done (Wave D fix wave, 2026-10-09) — review-wave fixes, all gates re-run

Fixed every finding from the Wave D code review (2 MAJORs, 5 MINORs, 3 nits)
and all 4 Playwright failures from the test-automation gate (all test-side).

App fixes (`src/`):
- MAJOR 1 (WCAG 2.4.3): `onCancelPlacement` (TrailScreen) deferred its focus
  with `requestAnimationFrame` — the old code focused the "✖ Cancel placement"
  button synchronously before React committed, dropping focus to `<body>`.
  Escape path shares the function, so it gets the same fix. E2E now asserts
  `document.activeElement` is the card's Place button after Escape AND after
  the banner Cancel.
- MAJOR 2 (walkthrough F11): built the overlap lens — `tripleOverlap()` in
  `placement.ts` computes the triple-intersection of the 3 locked player
  rings (Sutherland–Hodgman on ringPolygon geometry, antimeridian-safe via a
  common longitude frame + circular-mean centroid); `LoopMap` paints it as a
  `loop-overlap` fill layer (centroid dot fallback when rings don't overlap)
  plus a ONE-TIME pulse marker at the centroid, suppressed under
  `prefers-reduced-motion` (static fill carries the meaning alone). Player
  centers only — I1 holds; the I1 unit test now also sweeps the lens coords.
- MINOR 1: `onMoveRing` shows the adjudication-3 set-aside hint
  ("Your ring draft was set aside — tap 📍 to place it again.") when another
  card's draft is discarded.
- MINOR 2: removed the dead `onMapTap` placing branch per C8.
- MINOR 3: nudge announcement wraps the lon delta into [-180, 180]
  (`wrapLonDelta`) — an east step across the antimeridian no longer says "west".
- MINOR 4: intercept taps now `normalizeLon`/`clampLat` like placement taps.
- MINOR 5: F5 fingertip offset — the 🎯 marker rides 24px above the draft
  center while dragging (`setOffset`), so the finger never occludes the point.
- NIT 1: Escape listener effect now deps `[placing]` (was every render).
- NIT 2: marker click routed through the shared 300ms double-tap guard.
- NIT 3: named lat bands in `geo.ts` (`MAP_LAT_LIMIT`/`STORE_LAT_LIMIT`); the
  ±90 store-load call site uses the constant.
- Duplicate `role="status"`: the map-section status line is now plain text;
  the hint banner is the single live region (no double announcements).

Test fixes (`tests/e2e/`):
- `sourceFeatures` moved to `helpers.ts`, awaits maplibre 6.x's async
  `getData()` and optionally waits for a minimum feature count so overlay
  assertions can't race React's passive-effect paint.
- switching-cards: expectation corrected to 2 Place buttons + 1 Cancel
  (approved state machine: the placing card shows Cancel).
- "All 3 rings are down" locators scoped to `data-testid="map-hint"`
  (the map section shows the same sentence as plain text).
- reduced-motion spec extended: all 3 locked → static lens paints, zero
  `.ct-overlap-pulse` elements.

New unit tests (`placement.test.ts`, 1004/1004 total): tripleOverlap
polygon/centroid/disjoint/antimeridian/<3-rings, overlap wiring
(present only when all 3 locked pre-reveal), wrapLonDelta.

## Done (Wave C implementation, 2026-10-09)

WS1 "Every Place Findable" — Cold Trail placement mode. The player now places
each sighting ring: Place → tap map (draft) → adjust (tap-to-move primary,
draggable 🎯 marker + arrow-key nudge as enhancement) → "Yes, keep it" locks
the PLAYER-chosen center. Pre-reveal, the map renders only player coordinates
(witness dots at locked player centers, never at true anchors).

Files changed:
- `src/game/geo.ts` — added `normalizeLon` / `clampLat` helpers.
- `src/game/coldtrail/types.ts` — `ColdTrailProgress.ringCenters` (player
  centers, null until locked); `ColdTrailStore.v: 2`.
- `src/game/coldtrail/store.ts` — v2: `meridian.coldtrail.v2` key,
  `ringCenters` validator (triple, finite, locked→center invariant),
  one-time v1→v2 migration (wallet kept, case reset to unplaced, legacy key
  deleted, `takeLegacyMigrationNotice()` one-shot flag).
- `src/game/coldtrail/placement.ts` (new) — pure `buildEvidenceOverlays`
  (I1 anti-leak derivation) + `nudgeDirection`.
- `src/game/coldtrail/TrailScreen.tsx` — ephemeral placing/draft state,
  onPlaceRing/onPlacementTap/onPlacementDrag/onPlacementNudge/onLockRing/
  onTryAgain/onCancelPlacement/onMoveRing, Escape handling, focus management,
  migration hint, armed-border + touch reticle overlays, hint banner with
  Cancel, updated status line / legend / mapLabel.
- `src/game/coldtrail/SightingCard.tsx` — per-state button rows
  (place / cancel / "Yes, keep it"+"Try again" / "✓ Ring placed"+"↩ Move"+
  informant); informant hidden during placement.
- `src/game/loop/LoopMap.tsx` — optional placement props (loop edition
  unaffected): tap routing after the 300ms guard, crosshair cursor,
  focusable container, arrow-key nudge (scale-aware, min 5 km), draggable
  draft marker + click-through fix, dashed `loop-ring-line-preview` layer,
  witness-layer comment.
- `src/components/ui/button.tsx` — additive optional `ref` prop (React 19
  ref-as-prop; needed for card focus management).
- `src/game/coldtrail/store.test.ts` — v2 validator + backward-compat tests.
- `src/game/coldtrail/placement.test.ts` (new) — I1 anti-leak test,
  draft/informant/Move behavior.
- `tests/e2e/coldtrail.spec.ts` — rewritten for the new flow.
- `tests/e2e/coldtrail.mobile.spec.ts` (new) — 390px touch pass.
- `tests/e2e/coldtrail.reduced.spec.ts` (new) — reduced-motion pass.
- `package.json` — registered placement.test.ts in `npm test`.

Gates: `npx tsc --noEmit` clean · `npm test` 996/996 green ·
`node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green.
Playwright E2E runs in the next wave (specs written, not yet executed).

## Adjudications applied (override docs where they conflict)

1. Move-after-lock ALLOWED (re-enters adjusting; re-confirm re-locks; clears pending).
2. Tap-to-move in adjusting is PRIMARY; 300ms tap guard documented (not ignored taps).
3. Card-switching mid-placement: implicit switch, draft discarded, hint "Your ring draft was set aside — tap 📍 to place it again."
4. Pre-reveal witness dots render at PLAYER centers (not hidden until reveal, not at true anchors).
5. Drag on the ring handle is progressive enhancement; marker click-through fixed regardless.
6. Keyboard nudge: scale-aware step (2% viewport width, min 5 km).
7. Store bumped to v2; legacy auto-placed rings reset to UNPLACED with one-time hint "Rings work differently now — place yours!".
8. Plan bugs fixed: ringCenters cloned in withProgress (+onInformant); onPlacementDrag in cbRef; T3/T8 reworked (onEmptyTap never fires in freeTap; off-map taps never reach LoopMap); dead onMapTap placement clause removed (routing lives in LoopMap.onClick); placementDraft wired into paintRef + repaint deps.
9. Copy lock (exact): hint "Tap where you think the ring goes"; confirm "Yes, keep it"; adjust "Try again".

## Deviations from the docs (deliberate, documented)

- T1 focus target: map container (tabIndex=-1), not the hint banner wrapper —
  puts keyboard users where arrow-key nudge works; the banner is role=status
  so SR users hear the instruction anyway (reality-checker O11 allowed this).
- No pre-tap ghost ring (UI designer explicitly rejected it); F2's mode-entry
  signal = static dashed border + hint + touch reticle.
- Post-reveal: NO true-anchor witness dots (adjudication 4: never at true
  anchors); reveal shows player rings + player-center dots + hideout star.
- "Enter confirms" dropped (reality-checker O7 recommendation); native Enter
  on the focused button works.
- (Fix wave: the dead onMapTap placing branch noted below was REMOVED per
  C8 — LoopMap routes placement taps before onMapTap, so it was unreachable
  and a double-handling trap.)
- Storage key bumped to `meridian.coldtrail.v2` (with explicit v1 migration)
  rather than keeping the v1 key, to avoid version/key confusion.
- Informant button hidden while its own card holds the live placement (the
  ring isn't confirmed yet); buying for OTHER confirmed rings mid-placement
  is allowed (no interaction with placement).

## Pending

- Playwright E2E execution (next wave): coldtrrail / coldtrrail.mobile /
  coldtrrail.reduced projects + a loop-edition sanity run (geodetective
  project) to prove the shared LoopMap changes didn't regress the loop.
- Chitti review + merge (only merge path).

## 2026-10-09 — Design BLOCK fix: keyboard-only ring planting (P0)
- **Problem:** keyboard-only players could never plant the first draft ring — arrow-key nudge requires an existing draft, and there was no keyboard path to create one.
- **Fix (LoopMap.tsx):** Enter/Space with placement armed but no draft plants the draft at the map's current center. Map container tabIndex -1→0 (keyboard users can tab back mid-placement) + visible focus ring when placement is active.
- **Fix (TrailScreen.tsx):** map aria-label mentions "press Enter to plant at the map center, then arrow keys"; plant hint is input-agnostic ("Ring planted — move it with arrow keys or by tapping"); useEffect focuses the map post-commit when placement starts (the synchronous focusMap() fired pre-render and was a no-op).
- **Test:** new "keyboard-only: Enter plants the first draft ring, arrows nudge it" E2E (coldtrail.spec.ts) — full keyboard flow: Enter on Place → Enter plants → arrows nudge → Enter locks.
- **Gates:** tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1082/1082 · coldtrail 7/7 + mobile 3/3 + reduced 1/1 Playwright green · locked copy intact.
