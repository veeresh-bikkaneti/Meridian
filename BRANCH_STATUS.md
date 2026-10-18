# BRANCH_STATUS — fix/scout-zoom-into-edition → PR #172

**Owner report (2026-10-17, live site):** in Scout Map (the lighter map for
low-end devices), starting a State or Country edition never zoomed into the
region, and the + zoom button did nothing. Root cause: the intro settle zoom
(~5 for Nebraska) exceeded Scout's old flat maxZoom cap of 3, so the camera
clamped mid-flight, the zoom readout desynced from the real camera, and +
sat dead at the cap. Full mode was never affected.

**Base:** `origin/main` @ `23f1025` (PR #171, telemetry Phase 1).

## The product fix (sound, mutation-proven per panel)

- Scout flat cap 3 → 8 (full-mode parity). Scout stays lightweight through
  what the cap never touched: DPR 1, zero raster tiles, no starfield, no
  motion.
- New pure `settleZoomCap(edition, mapMode)` (src/map/map-options.ts) clamps
  the intro target to the mode cap, so the camera always targets a zoom it
  can reach. Full mode is byte-identical.
- New pure `bandForMode(zoom, mapMode)` (src/map/boundary-bands.ts) gates
  the admin-1 boundary band out of Scout at both paint sites
  (src/map/satellite-map.tsx:1492 and :1531).
- Peer-review catch: `revealZoomCap` clamps the scout-globe reveal framing
  to the globe cap of 2 (same mid-jump clamp family as the intro bug).

**Level Architect finding (standing design note):** Scout deliberately never
paints the admin-1 band at any zoom — a documented exception to the
progressive boundary-reveal rule, traded for ~1.6 MB of lazy geometry kept
off weak devices.

## Commits (this branch, after the rebase onto 23f1025)

- `134c5b1` — fix: Scout Map zooms into the edition (cap 8, admin-1 gated
  out, settle clamped to mode cap)
- `131d7ba` — fix: clamp scout-globe reveal framing to the mode cap
  (revealZoomCap)
- `31ac00d` — test: harden scout-globe reveal tap point (probe candidates
  via tapHitsMap)
- `62e2d85` — docs: branch status for PR #172 peer-review outcome

(Pre-rebase hashes 6517cfd / 3cd25af no longer exist — they are the same
work as 131d7ba / 31ac00d before the rebase.)

## Gates (fix-round run, 2026-10-18, on the branch tip)

- `npx tsc --noEmit` — clean
- `npm test` (both suites: scripts + src) — **1358 pass / 0 fail**
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (built with VITE_KOFI_URL baked in, the
  harness's documented requirement)
- Playwright E2E, `zoom-space` project, `--workers=1`, against the built
  artifact: state spec 3/3 passed; scout spec 4/4 passed **on this run**
  (see the caveat below)

## The panel BLOCK (test-side, not product) — RESOLVED in this round

The 12-role panel's Senior Dev BLOCK: the admin-1 assertion in
`tests/e2e/scout-narrow-repro.zoom-space.spec.ts` watches the network
buffer (`performance.getEntriesByType("resource")` for ne-50m-admin-1) and
is built on a false claim — that chunk is NOT band-exclusive. It is shared:
the boundary band lazy-loads it for the map layer, and the game's
reverse-geocoder (src/game/reverse-geocode.ts getNeAdmin1()) warms it on a
10-second timer after every run start, in every map mode, by design
(see game-app.tsx). So the chunk can load in Scout without any band ever
painting.

Result: the assertion is machine-speed dependent. It passed 7/7 on a fast
machine and failed 4/4 on this VM (Senior Developer ×2, Chitti ×2 — every
zoom assertion green, only this marker failing). This fix round's E2E
passed 4/4 too — the play finished under 10 s from run start, the warm
tick never fired, and the assertion got lucky. That luck is exactly why it
must not ship as-is.

The real invariant is "Scout never paints the admin-1 band", already
enforced in product by bandForMode at both paint sites and pinned by the
boundary-bands unit tests. The E2E must observe map state (the
`boundary-admin1` source/layer absent), not the network buffer.

**Done (architect fix list, 2026-10-18):** the senior architect reviewed
clean-slate and approved the seam as the right remedy (no viable seam-free
alternative; inert; reads ground truth via getStyle().layers). Added the
`__boundaryBand` seam in src/map/satellite-map.tsx beside the existing
`__spotScreen`/`__project` hooks (read-only, returns live layer ids, null
when no map). Swapped the assertion to the poll-with-positive-control
form: wait until `boundary-countries` is painted at cap 8 (proving the
paint path ran), then assert `boundary-admin1` is absent — timing-immune
by construction, since the warm preload never paints. Every other
assertion in the file is byte-for-byte.

One real bug caught in the swap: `expect.poll(...).not.toBeNull()`
returns undefined in this repo's Playwright (1.63) — it does NOT hand back
the polled value (proven empirically). The architect's proposed shape
assumed otherwise, so the first swap failed with "received must not be
null nor undefined"; fixed by capturing layers in an outer variable inside
the poll callback. The spec comment documents this.

**Owner disposition (2026-10-18):** the seam deviated from the fix
prompt's "no new production seams" line, so it was flagged for the owner.
The owner directed Chitti to take over the fix round and finish it ("Can
you take over and fix", 2026-10-18). The seam stays as the accepted
remedy: read-only, inert in production, mirrors the existing
`__spotScreen`/`__project` seams, and verified end-to-end by Chitti's
independent E2E run from origin.

## Gates (final head, 2026-10-18 fix round 2)

- `npx tsc --noEmit` — clean
- `npm test` (both suites: scripts + src) — **1358 pass / 0 fail**
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (VITE_KOFI_URL baked in)
- Playwright E2E, `zoom-space` project, `--workers=1`, against the built
  artifact: **7/7 passed** (state 3/3, scout 4/4). The scout run's painted
  layers: scout-borders, scout-coast, **boundary-countries**,
  variation-ring/line, region-fill/casing/outline — positive control
  present, `boundary-admin1` absent. The invariant holds on real map state.

**Push:** done — remote tip `b94903a`. **Chitti re-verified from origin
(2026-10-18):** tsc clean, lint-cards GATE PASSED, npm test 1358 pass /
0 fail, build green, E2E zoom-space 7/7 on his own independent run.
Owner merges only.

## Docs swept (2026-10-18 fix round)

- README, docs/, handbook: no stale Scout cap-3 or band-behavior
  descriptions found (the one admin-1 hit, docs/admin1-gap-ticket.md,
  describes full-mode bandForZoom — still accurate).
- Optional nits folded in: state spec header reworded (behavior pin, not a
  regression proof); map-options.ts SCOUT_MAX_ZOOM_FLAT comment scrubbed of
  stale pre-rename "lite" terminology and the Rhode Island overclaim
  softened (the + button stops at the cap of 8).

## Pending

1. Owner's merge word. Everything else is done: the assertion swap
   landed, the E2E re-run is green (builder's run and Chitti's
   independent run from origin both 7/7), and Chitti's re-verification
   is posted on PR #172.
2. Nobody merges — the PR merges only on the owner's explicit word.

**Do-not-touch:** donation copy (locked verbatim), storyteller audio/voice
track, homepage layout, branch protection/rulesets (never lifted).
