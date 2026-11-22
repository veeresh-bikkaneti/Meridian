# Branch status — phase1/ports-sweep

Branch: `phase1/ports-sweep`, off `origin/main` 7c04e3a7992b33ac8c98b86a85d4b25861048c47.
Worktree: `~/workspace/meridian-phase1-ports` (separate from meridian-main, which holds uncommitted Phase 2.1 work).
Lane: Phase 1 platform ports sweep. Tier 2, cap 400k per PR. Estimates: Part A ~300k, Part B ~250k (inferred). Running total (estimates, no meter): lead ~27k + arena ~53k + slice 0 ~18k + A1 ~60k + A2 ~35k + A3 ~45k = ~238k of the 400k Part A cap (60%). Baseline noRawIo: 164 → 55 after A3 (17 removed: 12 fetch + 5 storage, verified by recount; 0 remaining in A3 files). A3 verified green by lead: 237 tests across the touched areas (incl. behavior test + app-data + status-core), tsc + lint:arch clean, scope clean (9 files + their tests + 2 new test files only). OPEN FOLLOW-UP (A3, panel-visible): the contact/feature-request forms keep fetch-shaped seams with bare-reference defaults because the port cannot express credentials:"omit"/referrerPolicy:"no-referrer" — port-instance wiring at the constructing screens (src/routes/contact.tsx; src/routes/board.tsx is EXCLUDED, needs its owner) is still owed.
Plan doc `docs/architecture/phase-1-platform-ports.md`: NOT present in repo (grep, 2026-11-21). Proceeding from AGENTS.md + ARCHITECTURE.md + the existing ports.

## Capsule

- Outcome: every raw storage, fetch and `new Audio()` call outside `src/platform` goes through the existing ports (`src/platform/storage`, `src/platform/transport`, `src/platform/audio`), and its line is deleted from `eslint/layer-baseline.json` (noRawIo entries). No behavior change.
- Done condition: `lint:arch` + `scripts/layer-baseline.test.mjs` pass with the noRawIo entries for every in-scope file removed; all §9 gates PASS; two draft PRs (Part A = all files except game-app.tsx; Part B = game-app.tsx); no merge.
- Files: ~40 in-scope source files + `eslint/layer-baseline.json` + `src/platform/storage/keys.ts` (+ port extensions only if the arena decides them, with tests).

## Facts [tested]

- Baseline `eslint/layer-baseline.json` noRawIo: 164 entries, 68 unique strings — a MULTISET (`file|what`, duplicates count; `eslint/layer-rule.mjs:30-35`, `rawIoKeys` detector). Curing N call sites of kind K in file F = remove N occurrences of `F|K`.
- In scope (mine): 151 entries. Excluded (13): `src/routes/board.tsx` 6, `src/game/loop/LoopScreen.tsx` 2, `src/lib/error-component.tsx` 1, `src/subjects/shared/SubjectCase.tsx` 1, `src/components/storyteller-home.tsx` 3. No other `src/subjects/` file has entries.
- My kinds: storage 133 (localStorage access 31, localStorage reference 50, sessionStorage access 28, sessionStorage reference 16, window.sessionStorage access 8), fetch 12, new Audio 6.
- game-app.tsx: 32 entries (sessionStorage access 23, localStorage access 4, localStorage reference 2, sessionStorage reference 2, window.sessionStorage access 1). Part B. Its 2 shell-ban entries stay (Phase 4).
- Fetch in scope (12): `src/board/live-feed.ts` 1, `src/game/loop/detective/detective-audio.ts` 1, `src/lib/app-data/client.server.ts` 1, `src/lib/contact/contact-form.ts` 1, `src/lib/contact/contact-handler.server.ts` 1, `src/lib/feature-request/feature-request-form.ts` 1, `src/lib/feature-request/feature-request-handler.server.ts` 1, `src/lib/feature-request/turnstile.server.ts` 1, `src/lib/multiplayer/p2p.ts` 3, `src/lib/observability.ts` 1. Server-side (.server.ts): 4 files.
- Audio in scope (6): `src/components/comet-greeting.tsx` 2, `src/components/grandpa-ask.ts` 1, `src/components/storyteller.tsx` 1, `src/components/summary-celebration-line.ts` 1, `src/game/loop/detective/detective-audio.ts` 1.
- Ports today: storage port has ONLY a localStorage backend (`createLocalStorageBackend` fail-soft + `createSlotLocalStorageBackend` throwing, `browser-storage.ts`); no sessionStorage backend. Registry `keys.ts` has 3 keys only. Transport port has ONLY getJson/postJson, schema-checked, caller-owned retries/timeout, no defaults (`transport.ts`). Voice port: `createVoice(src, {owner, userInitiated, callbacks})`, one-voice channel claim (`voice.ts`).
- Detector shapes (`layer-rule.mjs` rawIoKeys): bare `fetch()` / `window.fetch` / `globalThis.fetch`; `new Audio()`; storage property access (bare/dotted/bracket, via global object or not); bare storage *references* (handing the object around, incl. `typeof` guards) — each counts separately. Tests and `src/platform/**` exempt.
- Layers (ARCHITECTURE.md): 1 Content, 2 Domain/stores, 3 Platform ports (only layer touching the browser), 4 Shared UI, 5 Feature screens, 6 Shell/routes. Imports point down only. Server files: "not in this layer map yet. Phase 5 covers it. Do not move server files."
- Conflicts: `eslint/layer-baseline.json` + `src/platform/storage/keys.ts` shared with parallel agents — take main's copy, re-delete own baseline lines / re-append own keys. Never edit another agent's lines. Before final push: `gh pr update-branch` (no merge/rebase/force-push; cherry-pick if needed).

## Statechart (states touched)

- Voice: idle → loading → ready → playing → ended/error/interrupted/aborted; stop() → aborted, idempotent (`voice.ts`).
- Transport: idle/loading/ready/error/aborted per request (`transport.ts` TransportStatus); retries only for network/timeout/http-5xx; abort is AbortError, never TransportError.
- Storage: read → fallback on missing/corrupt/off-schema; write/remove announce even on silent failure; subscribe attaches cross-tab listener on first subscriber, detaches on last (`storage.ts`, `browser-storage.ts`).

## Architect map (folders → layers, per ARCHITECTURE.md + layer-rule classify)

- Layer 3: `src/platform/**` (ports; only browser touch allowed).
- Layer 2: `src/game/**` (.ts domain/stores; .tsx are layer-5 feature screens living in the folder), `src/lib/**` (pure helpers), `src/board/**` (verify via classify), `src/map/**` (verify).
- Layer 4: shared UI under `src/components/ui/**` + shared components.
- Layer 5: feature screens (`src/components/*.tsx` screens, `src/game/**/*.tsx`).
- Layer 6: `src/routes/**` (shell/routes).
- Unmapped: `*.server.ts` files (Phase 5). Arena decides their transport.
- Import direction: every ported call site imports DOWN to layer 3 only. No new upward edges; no feature-to-feature imports.

## Arena (open questions — 2 workers propose, lead picks + records why)

1. Session storage: shape of the session backend/port (new backend + session port functions? file/function names? subscribe/cross-tab for session?).
2. Legacy on-disk encodings: keys whose stored bytes are NOT JSON (raw strings/flags) — port without losing stored values (mechanism + inventory rule).
3. Server-side fetch (4 .server.ts files): extend transport vs keep raw + document (prefer extending transport; respect the Phase 5 note).
4. Non-JSON browser fetch: which transport extensions (getText/postForm/raw?) per call site, with caller policy numbers.
5. Audio: per-site createVoice semantics (owner, userInitiated, callbacks) + play-before-await + voice-channel rule interplay.
6. Key registry: append-only discipline + storage-keys.test.ts pinning for new keys.
7. Slice plan: Part A / Part B file lists, no overlaps; shared-file discipline for keys.ts + baseline.

## Decisions (lead picks, arena 2026-11-21 — both workers proposed; pick + why recorded)

1. Session: WORKER A. `createSessionStorageBackend()` (fail-soft mirror) + session port via existing seams + `get/set/remove/subscribe/notifySessionStorage*` module fns. Event source INERT (sessionStorage has no cross-tab events; the shared window listener would re-emit session keys on another tab's localStorage clear). Domain slot `src/game/storage-slot.ts` mirroring `age-profile/storage-backend.ts`, filled by extended `registerBrowserStorage()` from `__root.tsx`. Why A over B: B's shared window event source is wrong on clear-all; A names the slot concretely.
2. Legacy encodings: WORKER A + B's refinement. `encoding?: "json" | "raw"` on `StorageKeyDef`; raw read tries JSON+schema, else returns raw text when the schema is `z.string()`; raw writes canonical JSON (reads accept both forever). Inventory per key from READER code: JSON-native bytes (incl. decimal numbers — already valid JSON) need no raw flag; non-JSON bytes get `encoding:"raw"`. Every raw key gets a fixture test seeding literal legacy bytes. No bulk migration, no lossy fallback. Why: one mechanism, no per-key decode functions; covers both workers' risk cases.
3. Server fetch: WORKER A. Do NOT extend transport for servers. `.server.ts` files keep injectable `fetchFn` seams; raw-fetch defaults replaced by fetch supplied as a value from server wiring (bare reference, never a `fetch()` call → no baseline entry). No file moves, no `classify()` change. Why: domain→platform import is an upward `lint:arch` violation and the ARCHITECTURE.md Phase 5 note reserves server code; B's server transport would be unimportable dead code. The task's "prefer extending transport" is overridden by the layer rule.
4. Browser fetch: BLEND (B surface, A seams). Extend the transport loop once: `postText` (status+text, no parse), `postForm` (urlencoded), `getRaw` (no throw on !ok), `TransportOptions.keepalive`. Domain files use local structural seams (e.g. `JsonPoster`); constructing screens pass port instances. Identity `SchemaLike` only where today's unchecked cast is load-bearing (p2p poll). Starting policy numbers from B (turnstile retries 0/timeoutMs 5000; live-feed retries 1 network-only; Discord retries 0/timeoutMs 5000; manifest retries 0) — swarm verifies each against current call-site code. Why B's surface: preserves status mappings exactly where getJson+remap would be lossy.
5. Audio: BLEND. Per-site `createVoice` at today's claim/play positions (B's line refs); port gains `pause()/resume()`, `startAtSeconds`, optional `onError` cause (A). `voice-channel-rule.mjs` `isAutomaticClaim` matching: verify by running `lint:nav` after the first audio slice; change the rule ONLY if it fires. `summary-celebration-line` hoists `done` to module scope (stop() fires no callbacks). Why: both workers independently found pause/resume load-bearing; restart-from-0 would change behavior.
6. Registry: BLEND. Append-only, never reorder/edit the 3 existing entries, byte-identical strings, per-key pin test in `storage-keys.test.ts` asserting `STORAGE_KEYS.<name>.key === <OWNER_CONST>`. Screen-owned consts hoisted into a small domain `.ts` module (A) — never pin a pasted literal. Dynamic keys → factory defs in `keys.ts` + fixture-id pin tests (B). Parallel agents: take main's `keys.ts`, re-append only own block.
7. Slices: WORKER A. Slice 0 (port extensions + contract tests) FIRST, then A1 domain storage+slot, A2 feature storage, A3 fetch, A4 audio, then Part B (`game-app.tsx` + key-hoist) stacked on Part A's tip. No file in two slices. Shared files: sequential from branch tip; each slice deletes exactly its cured multiset occurrences, appends only its keys; baseline test verifies after each slice. Two PRs (Part A ~300k + Part B ~250k > 400k cap), not one.

## Risk register (both workers named the same family)

- R1: JSON-only read of legacy bytes → fallback → silent data/behavior loss. Worst case: chunk guard stamp (bare epoch) reads as fallback → reload guard believes no stamp → unbounded reload loop. Mitigate: raw codec + seeded-legacy test per raw key + chunk-recovery e2e.
- R2: reset-proof re-reads (`getItem !== null`) + removal ordering (legacy-first-then-v2). Mitigate: fallback-equality proofs, identical removal order, regression tests pinning exact remove→verify sequences.
- R3: unregistered slot silently loses writes. Mitigate: registration wired at the existing `registerBrowserStorage` call site + startup test asserting it.

## How

0. Slice 0 — port extensions + contract tests (one builder, TDD, narrow): session backend + session fns; `encoding` codec; transport `postText`/`postForm`/`getRaw` + `keepalive`; voice `pause/resume`, `startAtSeconds`, `onError` cause. Verify: `npx tsc --noEmit`, contract tests for the 3 ports, `npm run lint:arch` (baseline untouched). No call-site files.
1. A1 — domain storage + slot + register: files per status Facts minus game-app/feature/server/audio (list in slice brief). Each cured `file|what` occurrence deleted from the baseline multiset; keys appended. Verify per slice: tsc, `npm test` (touched area), `lint:arch`, `check:provenance` before push.
2. A2 — feature storage via port functions (first-visit-queue, celebration-copy, storyteller-session, pack-shelf-data, grandpa-coffee-run, map-error-boundary). Same verify.
3. A3 — fetch (live-feed, p2p, both forms, observability, manifest, 4 server files via seams). Same verify + targeted Playwright specs the change can break, `--workers=1`.
4. A4 — audio (5 sites). Same verify + `lint:nav` (rule check) + targeted specs.
5. Panel review (clean-context Council Panel seat, one evidence pack, scoped re-votes, max 2 rounds) → `gh pr update-branch` → Part A draft PR.
6. Part B — game-app.tsx + key-hoist module, same gates + panel → draft PR. Never merge.

## Done / pending

- Done: slice 0 verified green by lead (tsc, lint:arch, 131 platform tests on node --test; bare vitest startup failure is environmental, also fails on clean main — never use bare vitest). A1 verified green by lead (baseline 164→90, 0 left in A1 files, scope clean, tsc + lint:arch clean). A2 verified green by lead (see total line). A3 verified green by lead (see total line). A4 dispatched. HARNESS LESSON (lead fix, 2026-11-22): map-error-boundary.behavior.test.ts failed 1/3 after A1+A2 — slot state is module-local, and that test esbuild-bundles the boundary, so the bundle's slot copy never saw the fake globals. Fix was test-only: the bundle entry now exports the slot setters and stubBrowser registers the same fakes into BOTH the bundle's and the direct import's slot copies, unregistered on restore. Any future esbuild-bundled test touching slot/transport state must do the same; installing fake globals alone no longer reaches code under test. Flags carried forward: pack-shelf.v1 REUSED by A2 (no duplicate def); paused-run keys also written by game-app.tsx → Part B key-hoist; factory-def format strings pinned by fixture-id tests; reset-history thunks order-preserved; grandpa key pins are source-text regex (consts live in a .tsx node:test cannot import — hoist is a follow-up, panel-visible); firstVisitSeenKeyDef has no owner const (production string is a call-site literal in game-app.tsx — Part B's hoist); A3 form-seam wiring follow-up (see total line).
- Done: A4 verified green by lead on touched areas (126/126 incl. voice contract + behavior test; tsc + lint:arch + lint:nav clean). Lead closed the unclaimed palette-preference.ts gap (2 entries): slot port + registry def + pin test + harness registration; 62/62, baseline 45 = game-app 32 + excluded 13 ONLY. FULL npm test found 2 failures (lead diagnosis, cure dispatched): (a) scripts/layer-rule.test.mjs pinned the cured contact-form baseline entry — lead repointed it to storyteller-home.tsx (excluded, entry permanent); (b) subject-host-props "one voice" ×2 — A4 moved the channel claim from runClip into the port, breaking the seam-independent claim contract for custom playClip paths; cure = claim in runClip + port adopts the claim. A4 flags for the panel: voice port gained duration()/onPlaying/bypassSoundGate (all USED by comet/storyteller) + pause-swallow; startAtSeconds is DECLARED but UNUSED anywhere in Part A; voice-channel-rule isAutomaticClaim extended (lint:nav fired, then clean); factory holder setVoiceFactory/resolveVoiceFactory in voice-channel.ts filled by register.ts (touches outside the A4 file list, same pattern as the storage slot); detective claim-after-gesture deviation disclosed (parked clip holds no claim until the gesture lands — a competing voice is preempted rather than yielding); grandpa regex pins + firstVisitSeenKeyDef follow-ups stand; A3 form-seam wiring follow-up stands.
- Pending: cure → full gates re-run (npm test + build:pages + entry-size + targeted Playwright) → Council Panel review (max 2 rounds) → Part A draft PR → Part B draft PR. CAP NOTE: running total ~301k + cure ≈ 335k will cross the 320k 80% line; the cure is gate-required (AGENTS.md: the cap never skips a gate) — final report must state the overage plainly.
- Ruled out: editing excluded files; moving game-app.tsx shell-ban entries; merging (Veeresh's call); touching `src/subjects/`.

## Graph

No graph changes (test/ports sweep adds no nodes an agent would search for; revisit if a new port module lands).
