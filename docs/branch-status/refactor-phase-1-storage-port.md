# Branch status — refactor/phase-1-storage-port

## Capsule

Phase 1 slice 2: a storage port in `src/platform/storage/` in the audio
port's shape (contract, browser implementation, fake, contract tests,
hook), with the age-band and subject-progress keys moved onto it. One
event system: the port's subscribe absorbs subject-progress's change
bus and cross-tab bridge. No player-visible change. Draft PR only.

Base: `origin/main` 64071587fc09cfb9d0f3ff248fb04767896e231b (#552).
Tier 2, cap 400k tokens (shared lead + helpers).

## Facts (re-run on this base)

- Keys: `meridian.ageProfile.v1` (src/game/age-profile/store.ts),
  `meridian.readAloudPref.v1` (src/game/age-profile/read-aloud-pref.ts),
  `meridian.subject-progress.v1` (key + resolver in
  src/game/subject-progress-store-key.ts; store in
  src/subjects/shared/subject-progress.ts). [tested: grep on base]
- Baseline entries for the migrated files: 12, all noRawIo —
  store.ts ×8, read-aloud-pref.ts ×4. subject-progress.ts has none;
  subject-progress-store-key.ts has 1 (its resolver), which stays —
  that file is the reset composition's first-load clear and is not
  migrated. [tested: eslint/layer-baseline.json key count on base]
- Layer law: domain (src/game/**, layer 2) may not import platform
  (layer 3); the baseline can only shrink (its own header comment).
  So the age-profile stores cannot import the port — see Architect.
- store.ts / read-aloud-pref.ts hard-wire the global localStorage;
  the only seam is clearAgeProfileForReset's storage parameter.
  Both keep a memory fallback that engages when a write fails.
  Their tests stub globalThis.localStorage with a Map-backed object.
  No persistence call runs at module import time. [fact-find, this
  branch's evidence pack]
- zod ^4.6.7 is already a dependency. [tested: package.json]

## Statechart (storage port)

- Backend slot (age-profile): unregistered → registered. Registered
  by the shell at startup; unregistered resolves to nothing, and the
  stores' existing memory fallback carries the session — the same
  end state as today's blocked-storage path.
- Subscription: detached → attached (first subscriber attaches the
  browser impl's one window `storage` listener) → detached (last
  unsubscribe removes it). Same-tab writes through the port, the
  game-side clear (via notifyChanged), and cross-tab storage events
  all emit on the same path.
- Value: absent → present; a present blob that fails its schema
  reads as the key's default (fail closed), never a throw.

## Architect — layer per file, one import direction

| File | Layer | Imports |
| --- | --- | --- |
| src/platform/storage/storage.ts (contract) | platform 3 | zod types only (type-only) |
| src/platform/storage/keys.ts (registry: key strings, schemas, defaults) | platform 3 | zod |
| src/platform/storage/browser-storage.ts | platform 3 | storage.ts, game/age-profile/storage-backend.ts (registration) |
| src/platform/storage/fake-storage.ts | platform 3 | storage.ts |
| src/platform/storage/use-storage.ts (hook) | platform 3 | react, storage.ts |
| src/game/age-profile/storage-backend.ts (backend slot, NEW) | domain 2 | nothing above domain |
| src/game/age-profile/store.ts, read-aloud-pref.ts (migrated) | domain 2 | ./storage-backend.ts only |
| src/subjects/shared/subject-progress.ts (migrated) | feature 5 | platform/storage, game/subject-progress-store-key.ts (as today) |

Registry key strings are pinned equal to the existing domain
constants (PROFILE_STORAGE_KEY, the read-aloud-pref key,
SUBJECT_PROGRESS_KEY) by a test — tests are layer-exempt, so the
registry stays import-free and the entry bundle stays free of zod:
only lazy consumers pull the registry in.

Registration: the browser backend is registered into the age-profile
slot from the root route (shell), following the repo's cleared-hook
precedent in subject-progress-store-key.ts (a domain slot wired from
above). browser-storage.ts must not import keys.ts or zod.

## Arena — subscribe/event design

- Option A (void signal, re-read): subscribe(key, cb) delivers
  nothing; subscribers re-read via getItem. The event is an
  invalidation; parse/migrate/default policy stays in getItem, the
  one place that already owns it. Matches both existing buses and
  every current consumer; the game-side clear has no value to carry
  and announces through notifyChanged.
- Option B (parsed value delivered): subscribe(key, schema, cb)
  parses once per change and delivers the value. Its own weakest
  point, by its advocate's account: unless the registry pins one
  schema per key, two subscribers can parse the same key
  differently; and the event path must adjudicate legacy/corrupt
  blobs before consumers see them.

PICKED: A. Existing consumers already re-read after a void signal,
writes are rare and blobs are tiny (B's parse-once saving does not
bind), and A keeps legacy-blob migration in exactly one place.
Recorded cost of A: re-reads are not atomic snapshots — acceptable
for invalidation semantics.

## Status

- Arena done, A picked. Port built (contract, browser impl, fake,
  contract tests, hook) and green.
- Migration done:
  - `src/game/age-profile/storage-backend.ts` (new): the domain
    backend slot — `setAgeProfileStorageBackend` /
    `resolveAgeProfileStorage` (explicit wins, else the slot,
    else undefined and the stores' memory fallback carries the
    session).
  - `src/platform/storage/register.ts` (new):
    `registerBrowserStorage()` fills the slot from
    `createLocalStorageBackend()` (new export in
    browser-storage.ts; the default port is built on it too).
    Called once at module top level in `src/routes/__root.tsx`.
  - store.ts and read-aloud-pref.ts read/write/remove only
    through `resolveAgeProfileStorage()`; no storage identifier
    references remain outside comments. Blob shapes, validation
    and the memory fallbacks are unchanged.
  - subject-progress.ts runs on the port: reads/writes via
    `STORAGE_KEYS.subjectProgress` (per-call port over a
    caller-passed storage, the shared port otherwise);
    `onSubjectProgressChanged` is the port's subscribe and
    writers announce via `notifyStorageChanged` at the old bus's
    exact emit points; the local bus and cross-tab bridge are
    deleted — the port's one event system replaces both. The
    game-side clear announces through the cleared hook as
    before. Writers copy the read document before mutating it:
    a read of an empty store hands back the registry's shared
    fallback object, which must never be mutated.
  - Baseline: the 12 age-profile noRawIo entries removed (store
    ×8, read-aloud-pref ×4). subject-progress-store-key.ts keeps
    its 1.
- Verified locally: the port contract + registry tests, the
  migrated stores' tests and subject-progress.test.ts (unchanged)
  all pass; layer-baseline test and lint:arch pass; tsc clean.
- Gates pending: the full §9 set (npm test, build:pages,
  Playwright for age band + subject progress, provenance,
  entry-size) runs at integration.
- Open questions: none for the owner at this point.
