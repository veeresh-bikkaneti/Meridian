# Branch status — phase1/ports-part-b

## Capsule

Outcome: every raw storage call in src/components/game-app.tsx
goes through the existing storage port (src/platform/storage),
its 32 noRawIo lines leave eslint/layer-baseline.json, and the
three Part A key hoists land (paused-run keys shared, not
duplicated; firstVisitSeenKeyDef's value gets an owner const;
the grandpa key consts move to a plain .ts module with real
imports replacing the source-text regex pins). No behaviour
change; storage keys byte-for-byte the same.
Done condition: layer-baseline.test.mjs reports noRawIo = 13
exactly (the other owners' entries, untouched); all §9 gates
pass on the final tip; entry size stays under 323,865 B gzip;
targeted e2e for resume, pause and first visit passes on
desktop and phone.

Base: origin/main 384689534353bbda4920edaa938d9a5a40d4ab51.
Tier 2, cap 400k tokens (shared lead + helpers).
Entry size measured on this base: 323,315 B — 550 B spare.

The plan doc (docs/architecture/phase-1-platform-ports.md) is
not in the repo (Part A's sweep doc records the same); this
part follows the brief, AGENTS.md, ARCHITECTURE.md and
Part A's branch-status notes.

## Facts (measured on this base)

- Baseline noRawIo = 45 total; game-app.tsx holds exactly 32
  (23 sessionStorage access, 4 localStorage access, 2 + 2
  references, 1 window.sessionStorage access); the other 13
  belong to board.tsx (6), storyteller-home.tsx (3),
  LoopScreen.tsx (2), error-component.tsx (1),
  SubjectCase.tsx (1). 45 → 13 is arithmetic, not hope.
- The port's scope is chosen by function family, not by a
  def field: getStorageItem/setStorageItem/removeStorageItem
  (local) and getSessionStorageItem/setSessionStorageItem/
  removeSessionStorageItem (session) take the same
  StorageKeyDef {key, schema, fallback, encoding?}.
- Already registered (reuse, never duplicate): pausedRun,
  pausedRunMc2, pausedRunMc3, pausedDrop, staleRefresh,
  pack-shelf.v1. Not registered: difficulty
  ("meridian.difficulty", local, static), story (dynamic
  `meridian.story.${placeId}`), challenge markers (dynamic
  `meridian.challenge.recorded.${seed}` + `.summary.`).
- Paused-run key strings are duplicated today: game-app's
  private consts (lines 574–603) vs src/game/reset-history.ts
  exports (RUN_KEY etc., whose clearPausedRun removes all
  four). Registry defs already pin byte-equal against
  reset-history's consts in storage-keys.test.ts.
- firstVisitSeenKeyDef (the factory) already lives in
  keys.ts:469; what lacks an owner is its VALUE
  "meridian.firstVisitQueue.v1", a call-site literal at
  game-app.tsx:4264, regex-pinned in
  first-visit-queue-wiring.test.ts:109.
- Grandpa consts TOUR_LAST_DATE_KEY / WALKED_SESSION_KEY
  live in src/components/grandpa-coffee-run.tsx:126,131;
  their registry defs exist and the .tsx already calls the
  port with them; only the test pins are source-text regexes
  (storage-keys.test.ts:260,264) because node:test cannot
  import a .tsx.
- game-app has NO pack storage touches (the shelf lives
  elsewhere) and no first-visit storage calls (only the
  seenKey prop). Its remaining surface: difficulty (local),
  story cache (local, dynamic), challenge markers (session,
  dynamic), stale-refresh (session), and the chunk guard at
  line 3103 passing window.sessionStorage to
  shouldReportChunkFailure.
- Part A harness lesson: an esbuild-bundled test that
  touches slot or transport state must register its fakes
  into both the bundle's slot copy and the direct import's.
  This part touches storage state — same discipline for the
  storage backend registration in bundled tests.

## Statechart (the storage paths game-app touches)

- Resume: app start → read pausedRun/pausedRunMc2/
  pausedRunMc3/pausedDrop (session) → value parses → run
  offered/resumed; missing or corrupt → fresh start. Pause:
  run active → pause or unload → write the run JSON to the
  same session keys; finishing or abandoning removes them
  (the remove sites stay removes, through the port).
- First visit: game-app passes the seen-key (owner const
  after B1) → the queue component reads/writes through the
  port as today: unseen → sheets queued → seen flag set.
- Difficulty: boot → read (local) → apply; player changes
  it → write. Absent → default, as today.
- Story cache: place opened → read `meridian.story.<id>`
  (local); miss → build and write; hit → serve the cache.
- Challenge markers: run ends → set
  `meridian.challenge.recorded.<seed>` (session); summary
  read via the `.summary.` key when the board asks.
- Stale refresh: the refresh path sets staleRefresh
  (session) exactly where it sets it today.
- Chunk guard: failure path hands a storage object to
  shouldReportChunkFailure — the one call that passes raw
  storage rather than a key. Arena below.

## Architect — layer per file, import direction

| File | Change | Layer / imports |
| --- | --- | --- |
| src/platform/storage/keys.ts | APPEND ONLY: difficulty def; story + challenge def factories (mirroring firstVisitSeenKeyDef's factory shape); the first-visit seen-key owner const; grandpa key consts beside their defs | platform (3); imports nothing new |
| src/components/grandpa-coffee-run.tsx | the 2 key consts become imports from keys.ts (hoist mechanics; no other change) | feature (5) → platform (3), already imports the defs |
| src/components/game-app.tsx | private key consts deleted; every raw call becomes a port call with a registry def (session family for run/stale/challenge, local for difficulty/story); first-visit literal becomes the owner const import | feature (5) → platform (3) |
| src/platform/storage/storage-keys.test.ts | pins for the new defs (byte-equal, never pasted literals where a source const exists); grandpa pins: regex → real imports | test (arch-exempt) |
| src/components/first-visit-queue-wiring.test.ts (or its actual home) | seen-key pin: regex → import of the owner const | test |
| eslint/layer-baseline.json | delete exactly game-app's 32 noRawIo lines | — |
| docs/branch-status/phase1-ports-part-b.md | this file | — |

Not touched: reset-history.ts (its consts stay the domain
definition the registry pins against), board.tsx,
LoopScreen.tsx, error-component.tsx, src/subjects/**,
storyteller-home.tsx, shell-ban-baseline.json (game-app's 2
shell-ban entries stay for Phase 4). game-app.tsx is not
split or restructured (Phase 4).

## Arena — the chunk guard (line 3103)

- Option 1 (adapter): the helper's seam is one method,
  getItem(key): string | null, over two chunk keys, each read
  in try/catch; absent means silent, a throw means report.
  An adapter over the port's fail-soft reads flattens
  "unreadable" into "absent" — the exact inversion the
  helper exists to prevent — unless it re-exposes a raw
  throw, which is Option 2 in a wig. By its advocate's own
  account the throw must be preserved.
- Option 2 (getter): hand the helper the real Storage; zero
  semantic drift. Its advocate surfaced the deciding fact:
  the getter already exists. resolveSession() in
  src/game/storage-slot.ts is what map-error-boundary.tsx
  already passes to this same helper
  (shouldReportChunkFailure(resolveSession() ?? null, …),
  line ~184) and what build-staleness.ts uses; game-app's
  window.sessionStorage is the outlier.

PICKED: Option 2 via the existing resolver — game-app calls
shouldReportChunkFailure(resolveSession() ?? null, …),
byte-for-byte the map-error-boundary precedent. No new port
surface, no adapter, no semantic drift. (In the browser the
root route registers the browser backends, so the resolver
returns the real session storage; where nothing is
registered it returns null and the helper fails loud, as
designed.)

## Status

- Fact-find done. B1 (registry + hoists + pin swaps) next,
  then B2 (session paths), B3 (local paths + baseline).
- Open questions: none for the owner at this point.

## Graph

For the integrator to fold in at merge (branches never edit
graph.json):

- Node: `branch:phase1/ports-part-b` (this branch).
- Edges: the branch `depends-on` Part A's tip
  (phase1-ports-sweep: the storage port, keys registry and
  the 45-line baseline it left) and `extends` the storage
  port's caller set to game-app.tsx.
