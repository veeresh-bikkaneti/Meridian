# Feature flags

Zero-cost, dependency-free kill-switches for Meridian. Veeresh's rule:
**experimental tracks merge behind flags, disabled in production until proven** —
we never break production code while experimenting. No vendor, no SDK, no
new dependencies: a static `public/flags.json`, a tiny `src/lib/flags.ts`,
and one network-first rule in `public/sw.js`.

## The adopter pattern (4 steps)

Every new flag follows exactly this pattern:

1. **Register the flag** in `src/lib/flags.ts`:
   - Add the name to the `FlagName` string union.
   - Add the entry to `FLAG_DEFAULTS`. **The default MUST equal current
     production behavior, always** — the app runs correctly on defaults
     alone, including fully offline. Reviewers: reject any flag whose
     default changes prod behavior.
2. **Gate before initialization** — kill-switches **await the shared load**
   before checking the flag, so a remote kill decision wins the boot-time
   race deterministically (a synchronous read inside the effect would always
   see the baked-in default while the fetch is in flight). Gate inside an
   init/effect function, never at module scope — module scope always reads
   the baked-in defaults. Example (the PWA kill-switch in
   `src/routes/__root.tsx`):
   ```ts
   useEffect(() => {
     loadFlags().then(() => {
       if (!isEnabled("pwaUpdateToast")) {
         void unregisterServiceWorker(); // real kill: drop the live SW, no reload
         return; // safe fallback: plain web app
       }
       registerServiceWorker().then(/* ... */);
     });
   }, []);
   ```
   The `void loadFlags()` call at module scope in `__root.tsx` starts the
   memoized fetch in parallel with boot — your gated effect awaits the same
   shared promise; it never loads flags itself. Pure UI gates (a toggle that
   only hides a button) may keep the synchronous `isEnabled()` read without
   awaiting: they see the baked-in defaults until the load resolves, which
   is acceptable for non-critical UI. Kill-switches may not.
3. **Set the value** in `public/flags.json` (versioned in the repo, shipped
   with the static build; pushing the updated file is a normal static
   deploy, no client release is required):
   ```json
   { "version": 1, "flags": { "pwaUpdateToast": true, "yourFlag": false } }
   ```
   The `version` field is informational schema versioning — changing flag
   values does not require bumping it.
4. **Test both positions** — unit tests for on/off/unknown/bad payload, plus
   an E2E spec proving the gate flips the surface behavior (on, off, and
   unreachable flags.json). See `src/lib/flags.test.ts` and
   `tests/e2e/feature-flags.spec.ts`.

## Kill-switch semantics

Remote **off = safe fallback**. Turning a flag off remotely must degrade to
a working app, never a broken one: the PWA kill-switch (`pwaUpdateToast:
false`) yields a plain web app — no service worker, no update toast. Design
your flag's off-position as the "nothing can break" path.

Off means *unregister*, not just *skip registering*. `unregisterServiceWorker()`
in `src/lib/pwa.ts` drops any live registration: the current page keeps its
controller until the next navigation (the no-forced-reload policy is never
violated), but subsequent boots are SW-free — no toast, no waiting worker,
no background polling. Skipping `registerServiceWorker()` alone would leave
an already-active SW controlling the page, which is not a kill-switch.

One irony to keep in mind: the deploy that flips the PWA kill-switch itself
ships a new SW version, which then sits *waiting* — the normal activation
path is the update toast, the exact thing the kill-switch kills. No toast is
required anyway: clients don't need the new worker to learn the kill
decision. The active old worker passes `flags.json` through to the network
(the new network-first rule does the same once it activates), so the remote
off reaches them whenever they're online — the next boot finds the flag off,
unregisters the live SW, and stays quiet.

Fail-closed everywhere else, too: unknown flag names and non-boolean values
in the remote payload are ignored, and any fetch failure (timeout, network
error, offline, invalid JSON) silently keeps the baked-in defaults.

## Boot-time, not reactive

`loadFlags()` fetches network-first with a ~1.5s timeout, **never blocking
first paint and never rejecting**. The production promise is memoized, so the
boot-time kickoff and every gated effect share one request. `isEnabled()` is
a synchronous read: kill-switches await `loadFlags()` before reading (see the
adopter pattern above); pure UI gates may read synchronously and accept the
baked-in defaults until the load resolves. There is intentionally no
subscription or re-render mechanism — gated systems read their flag once,
before initialization, and treat the boot-time value as authoritative for
the session.

This also means the kill-switch takes effect on the *next* boot after the
remote file changes, not mid-session. That is by design: no mid-game
surprises.

## The service worker and flag freshness

`public/sw.js` serves `/Meridian/flags.json` **network-first**: on success
it populates a small versioned flag cache and returns the network response;
only when the network fails does it fall back to the cached flags. A kill
decision therefore propagates even to clients whose SW update is still
waiting — it never sits behind a stale cache.

**Old-client note:** service workers deployed *before* this rule have no
flags.json handler. Their fetch handler falls through to the network-default
branch, so a remote kill decision still reaches them whenever they are
online — they just lose the offline-cache fallback (and their app's own
`loadFlags` fails closed to defaults). No client can be stranded *on* a
killed feature by a stale flags.json.

## Current catalog

| Flag               | Default | Off behavior                                             |
| ------------------ | ------- | -------------------------------------------------------- |
| `pwaUpdateToast`   | `true`  | Unregisters any live SW; no registration, no update toast |
| `learningOutcomes` | `false` | No learning records, no growth UI — today's app exactly |
