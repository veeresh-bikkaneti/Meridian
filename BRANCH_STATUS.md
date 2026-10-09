# BRANCH_STATUS — feat/place-accessibility-ws1

Owner: Frontend Developer (Wave C) · Branch: `feat/place-accessibility-ws1` · Base: origin/main @ f4f92ad
· Created: 2026-10-09. **PUSH OK, DO NOT MERGE** — Scrum Master opens the PR after the gate wave; Chitti is the only merge path.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical (verified by grep after every edit):
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`
Hard rules: $0/offline/keyless; COPPA-safe; no paywalls; do not invent place coordinates.

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
- Intercept-blocked-while-adjusting copy ("Confirm ring {n} first…") kept as a
  defensive branch in onMapTap, but unreachable by construction — placement
  taps route before onMapTap, so a tap during adjusting re-positions the draft.
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
