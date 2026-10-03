# Feature flags

Zero-cost, dependency-free kill-switches for Meridian. Veeresh's rule:
**experimental tracks merge behind flags, dark in production until proven** —
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
2. **Gate before initialization** — call `isEnabled("yourFlag")` *before*
   the gated system initializes (not in a render loop, not after setup).
   Example (the PWA kill-switch in `src/routes/__root.tsx`):
   ```ts
   useEffect(() => {
     if (!isEnabled("pwaUpdateToast")) return; // safe fallback: plain web app
     registerServiceWorker().then(/* ... */);
   }, []);
   ```
   The `void loadFlags()` call at module scope in `__root.tsx` starts the
   remote fetch fire-and-forget, in parallel with boot — your gated system
   just reads the flag; it never loads it.
3. **Set the value** in `public/flags.json` (versioned in the repo, shipped
   with the static build):
   ```json
   { "version": 1, "flags": { "pwaUpdateToast": true, "yourFlag": false } }
   ```
4. **Test both positions** — unit tests for on/off/unknown/bad payload, plus
   an E2E spec proving the gate flips the surface behavior (on, off, and
   unreachable flags.json). See `src/lib/flags.test.ts` and
   `tests/e2e/feature-flags.spec.ts`.

## Kill-switch semantics

Remote **off = safe fallback**. Turning a flag off remotely must degrade to
a working app, never a broken one: the PWA kill-switch (`pwaUpdateToast:
false`) yields a plain web app — no service worker, no update toast. Design
your flag's off-position as the "nothing can break" path.

Fail-closed everywhere else, too: unknown flag names and non-boolean values
in the remote payload are ignored, and any fetch failure (timeout, network
error, offline, invalid JSON) silently keeps the baked-in defaults.

## Boot-time, not reactive

`loadFlags()` fetches network-first with a ~1.5s timeout, fire-and-forget,
**never blocking first paint and never rejecting**. `isEnabled()` is a
synchronous read: calls made before the load resolves see the baked-in
defaults. There is intentionally no subscription or re-render mechanism —
gated systems read their flag once, before initialization, and treat the
boot-time value as authoritative for the session.

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

| Flag             | Default | Off behavior                              |
| ---------------- | ------- | ----------------------------------------- |
| `pwaUpdateToast` | `true`  | No SW registration; no update toast       |
