# WS-0 — `globeTierSplit` kill switch for the Globe fame-tier split

Spec author: ARCHITECT. Executor: WORKER (haiku) then QA (haiku). Line numbers
are as of branch `claude/hopeful-darwin-dp7ket` @ `25f6ccc`; match by
identifier if they drifted. The orchestrator does all git. Nothing here needs
ESCALATE-ON-START: every changed block is given below as exact code.

## 0. Binding constraints (restated)

- **No LLM near place data.** This change touches loading and flags only. No
  place record, `history`, `fact`, blurb or tier file is read, written or
  regenerated. `node scripts/lint-cards.mjs` must still print `GATE PASSED`.
- **Invariants (README "Invariants a contributor must know").** Coordinates
  match claimed location (untouched: build gate). Dealing is fail-closed to the
  selected region (untouched: `buildRegionPool`, `loadGlobeTier` meta/tier
  checks stay). No repeats before pool exhaustion (pool ORDER is part of the
  dealing contract; the flag-off pool order is proven equal to the canonical
  `chunks/globe.json` order, see tests). Missing on-device AI never blocks
  anything (untouched). No deploy without E2E (section 4).
- **Scout Map charter.** Untouched. No map, `satellite-map.tsx`, map-mode or
  Scout code changes.
- **Both build bases (`/Meridian/` and `/`).** The only URL this change
  touches is `flags.json`, which `src/lib/flags.ts` already builds from
  `import.meta.env.BASE_URL` (`flagsUrl`). Add NO hard-coded `/Meridian/`
  path in production code. Tier assets are bundler-emitted dynamic imports
  and are unchanged. Only the `/Meridian/` build is exercised by E2E.
- **No new production debug hatches.** No new query parameter, no `window.*`
  global, no `localStorage` key, no exported "force" function. The tests reach
  the flag through (a) the existing `loadFlags(testEnv)` seam, (b) a factory
  with injected dependencies, and (c) Playwright `context.route` on
  `flags.json`. (The existing test-only exports `resetFlags`,
  `clearChunkCacheForTests` are the precedent; this change adds no new
  reset function.)

## 1. Goal and the measurable result

**Goal.** Add a remote kill switch `globeTierSplit` so that turning it off
(default) makes the Globe load all five tier files and deal from the same full
pool, in the same canonical order, that `main@d7a0fc8` produced from
`chunks/globe.json`, while `public/flags.json` ships it `true` (faster path
on), in its own revertable commit.

**Measured by:**
1. Unit: flag off, for each of easy/medium/hard, `placesFor('globe','globe',
   choice, false)` returns ids identical (and in identical order) to
   `placesFor('globe','globe')`, whose `gn-` ids equal the ids of
   `chunks/globe.json` in file order; `loadedGlobeTiersForTests()` is
   `[1,2,3,4,5]`.
2. Unit: flag on, Easy loads exactly `[1,2]`, Medium `[2,3,4]`, Hard `[4,5]`.
3. E2E (built artifact, network log): an Easy Globe run requests only the
   `globe-t1` and `globe-t2` tier assets with `flags.json` as shipped (true);
   with `flags.json` routed to `{"flags":{"globeTierSplit":false}}` it requests
   all five.
4. Reverting only the second commit (section 6) yields a green tree whose
   shipped behaviour is the full pool.
5. Stale-catalog regression (ARCH-REVIEWER BLOCK on `62895ea`, folded into this
   workstream): after a Globe learning-path change (Easy -> "Try Medium"), the
   no-repeat store `meridian:seen:v2:globe:globe:medium` holds exactly the ids
   the player was actually dealt, never a place dealt from the previous band's
   stale catalog. Proven by unit test (4.8) and E2E (4.7), which fails
   before step 8 and passes after it.

## 2. Files

### Change
| File | What |
|---|---|
| `src/lib/flags.ts` | Add `"globeTierSplit"` to `FlagName`; add `globeTierSplit: false` to `FLAG_DEFAULTS` with comment. Nothing else. |
| `src/game/generated-places.ts` | `placesFor` gets a 4th parameter `tierSplit: boolean = false`; Globe tier-limited loading happens only when it is `true`. Update the two doc comments that describe the split (module header lines ~22-28 and the `choice` param doc ~766-773). |
| `src/lib/globe-tier-split.ts` | **NEW.** Tiny per-page-load resolver (section 3, step 3). |
| `src/game/places-load-key.ts` | **NEW.** Two tiny pure helpers (`placesLoadKey`, `placesForKey`) so `Play` can never hand `PlayLoaded` a catalog loaded for a different band (step 7). Node-testable. |
| `src/components/game-app.tsx` | Imports; one top-level helper `globeTierSplitFor`; the two `placesFor` call sites (`openRun`, `Play` effect); **`Play` keyed load state** (steps 7-8) replacing `useState` `places`/`poolError`; fix the now-wrong comment above the effect's dependency array. |
| `src/lib/flags.test.ts` | New `describe("globeTierSplit flag")`. |
| `src/lib/globe-tier-split.test.ts` | **NEW** unit tests for the resolver. |
| `src/game/places-load-key.test.ts` | **NEW** unit tests (4.8): the stale-catalog regression at the pure level. |
| `src/game/generated-places.test.ts` | Adapt on-path tests, add off-path tests (section 4). |
| `src/game/pool.test.ts` | Adapt on-path tests, add off-path tests (section 4). |
| `tests/e2e/globe-tier-split.desktop.spec.ts` | **NEW** (QA). The `desktop` suffix routes it to the `desktop` Playwright project (1440x900). Network-log tests (4.6). |
| `tests/e2e/globe-band-switch.desktop.spec.ts` | **NEW** (QA). Regression E2E for the stale-catalog bug (4.7). |
| `scripts/migrate-notable-to-history.mjs` | Minimal fix (step 13): regenerate the Globe tier files when this migration rewrote `chunks/globe.json`. |
| `docs/feature-flags.md` | One new row in "Current catalog" plus a short "Globe tier split" note (offline caveat, step 9). |
| `BRANCH_STATUS.md` | Move the "Kill switch flag `globeTierSplit`" Pending bullet to Done (wording in step 12). Do NOT touch the first two lines (`SAFE TO MERGE`, `LOCK`). |
| `public/flags.json` | **Commit 2 only**: add `"globeTierSplit": true`. |
| `scripts/flags-content.test.mjs` | **Commit 2 only**: add the `=== true` assertion. |

### Must NOT change
`src/routes/__root.tsx`, `public/sw.js`, `vite.config.ts` (the stub that omits
`chunks/globe.json` from bundles STAYS; flag-off does NOT go back to importing
`chunks/globe.json`, it merges the five tier files, which is proven equal to it),
`src/game/tier-filter.ts`, `src/game/pool.ts`, `src/game/trail.ts`,
`src/game/run.ts`, `src/game/starters.ts`, everything under
`src/game/data/`, `scripts/*` except `scripts/migrate-notable-to-history.mjs`
(step 13) and the one test above, `package.json`,
`tests/e2e/helpers.ts` (reuse, do not edit), every other E2E spec, `.scratch/`.

## 3. Design (ONE design) and ordered steps

### Design in six sentences
1. `placesFor(edition, regionId, choice?, tierSplit = false)`: the tier-limited
   Globe load happens only when `choice !== undefined && tierSplit === true`.
   Anything else (flag off, no choice, parameter omitted) loads the full Globe.
   The default `false` is deliberately the safe, production-equal value.
2. `generated-places.ts` never imports the flags module, so it stays
   node-testable with no fetch and no `window`.
3. The flag value is produced by one resolver, `resolveGlobeTierSplit()`, that
   awaits `loadFlags()` (kill-switch rule from `docs/feature-flags.md`), reads
   `isEnabled("globeTierSplit")` **once**, and caches the boolean for the
   lifetime of the page.
4. Both call sites obtain the value from that same resolver, so for a given
   page load they can never see different values (section 3, "How agreement is
   guaranteed").
5. Only Globe runs (edition `"globe"`, region `"globe"`) consult the resolver;
   every other run passes `false` immediately and is byte-for-byte unaffected
   (no extra await beyond one resolved promise).
6. `Play` stores the loaded catalog together with the key it was loaded for
   (`{ key, places }`) and passes `places` to `PlayLoaded` only when that key
   equals the key of the CURRENT run (`edition:regionId:band`, band only for the
   Globe); otherwise it shows the existing "Loading places" screen. A stale
   catalog can therefore never be rendered against a new run, whatever the flag
   value.

### Steps

**Step 1 — `src/lib/flags.ts`.** Change line 34 to
```ts
export type FlagName = "pwaUpdateToast" | "learningOutcomes" | "globeTierSplit";
```
and add to `FLAG_DEFAULTS` after `learningOutcomes: false,`:
```ts
  // Globe fame-tier split (perf). false = today's production behavior: the
  // Globe loads ALL five tier files and deals from the full pool in canonical
  // order (the caller's filterByTier bands it). true = load only the tiers of
  // the run's learning path (Easy t1+t2, Medium t2-t4, Hard t4+t5).
  globeTierSplit: false,
```
Do not touch `applyPayload` (it already iterates `Object.keys(FLAG_DEFAULTS)`).

**Step 2 — `src/game/generated-places.ts`, `placesFor` (line ~763).** New signature
and the one changed expression:
```ts
export async function placesFor(
  edition: Edition,
  regionId: string,
  /** (keep the existing doc, then add:) Ignored unless `tierSplit` is true. */
  choice?: PickerDifficulty,
  /**
   * globeTierSplit flag value, resolved by the caller. true = the Globe loads
   * only `tiersFor(choice)`; false (default, today's production behavior) =
   * the Globe loads all five tiers merged into canonical order. Ignored for
   * every non-Globe region. Passed in (not read here) so this module stays
   * flag-free and unit-testable under node.
   */
  tierSplit: boolean = false,
): Promise<Starter[]> {
```
Replace the condition inside `chunkIds.map` with
```ts
      id === GLOBE_REGION_ID && choice !== undefined && tierSplit
        ? loadGlobeTiers(tiersFor(choice))
        : loadRegionChunk(id),
```
(`loadRegionChunk("globe")` already calls `loadGlobeTiers(GLOBE_TIERS)` and
merges by id; do not change it.) Update the header comment (lines 22-28): the
sentence "`placesFor` takes the run's learning path for that; without one ..."
becomes "`placesFor` takes the run's learning path AND the `globeTierSplit`
flag value for that; without both (flag off, tests, tooling) all five tiers
load and merge back into the canonical order." No other edits in this file.

**Step 3 — NEW `src/lib/globe-tier-split.ts`** (exact content):
```ts
/**
 * globeTierSplit resolver — ONE decision per page load.
 *
 * Why a cache: `loadFlags()` re-fetches on every call after it settles and
 * replaces the overrides wholesale, so `isEnabled()` can change mid-session
 * (e.g. the picker's useDeckStatus effect calls loadFlags again). The two
 * `placesFor` call sites (openRun, the Play effect) must agree on the value
 * for a run, so the first resolution is final for the page ("boot-time value
 * is authoritative for the session" - docs/feature-flags.md).
 *
 * Safe default: if flags.json is slow (>1.5s), missing, invalid or offline,
 * loadFlags() resolves without applying anything and isEnabled() returns the
 * baked-in default (false) -> the FULL Globe pool, today's behavior.
 * Never rejects. Must only be called from event handlers / effects, never at
 * module scope and never during render or SSR.
 */
import { isEnabled, loadFlags, type FlagName } from "./flags.ts";

export interface GlobeTierSplitDeps {
  load: () => Promise<void>;
  read: (flag: FlagName) => boolean;
}

/** Factory with injectable deps (tests pass fakes; production uses the singleton below). */
export function createGlobeTierSplitResolver(deps: GlobeTierSplitDeps): () => Promise<boolean> {
  let decided: boolean | null = null;
  return async function resolve(): Promise<boolean> {
    if (decided !== null) return decided;
    try {
      await deps.load();
    } catch {
      // loadFlags never rejects; paranoia only. Fall through to the read,
      // which yields the baked-in default.
    }
    // Re-check after the await: a concurrent caller may have decided first.
    // The first decision wins so every caller sees the same value.
    if (decided === null) {
      let value = false;
      try {
        value = deps.read("globeTierSplit") === true;
      } catch {
        value = false;
      }
      decided = value;
    }
    return decided;
  };
}

/** The production resolver: shared by every Globe `placesFor` call site. */
export const resolveGlobeTierSplit = createGlobeTierSplitResolver({
  load: loadFlags,
  read: isEnabled,
});
```
Node strip-types rules: no enums, no parameter properties, `import type`/inline
`type` only (as written).

**Step 4 — `src/components/game-app.tsx`, import.** After line 119
(`import { isEnabled, loadFlags, getObservabilityEndpoint } from "@/lib/flags";`) add
```ts
import { resolveGlobeTierSplit } from "@/lib/globe-tier-split";
```

**Step 5 — `src/components/game-app.tsx`, helper.** Add this non-exported
top-level function immediately above the doc comment that precedes
`function useDeckStatus` (line ~739); `Edition` is already imported (line 18):
```ts
/**
 * The globeTierSplit decision for a run's pool load. Only the Globe consults
 * the flag (and thereby waits for flags.json, at most ~1.5s, only on the first
 * Globe run of a page load); every other region gets false at once. Both
 * placesFor call sites use this one helper, and the resolver caches the first
 * answer, so a run's two loads can never disagree.
 */
function globeTierSplitFor(edition: Edition, regionId: string): Promise<boolean> {
  return edition === "globe" && regionId === "globe"
    ? resolveGlobeTierSplit()
    : Promise.resolve(false);
}
```

**Step 6 — `openRun` (lines ~1258-1263).** Inside the existing `try`, replace
```ts
        const places = await placesFor(edition, regionId, choice);
```
with
```ts
        const tierSplit = await globeTierSplitFor(edition, regionId);
        const places = await placesFor(edition, regionId, choice, tierSplit);
```
Keep the `recordMilestone("data_chunk_load_start", ...)` line before it and
update the comment above to: "The learning path and the globeTierSplit flag
ride along so the Globe fetches only the fame tiers it deals from (flag on) or
all five (flag off); filterByTier below still decides the pool." The
`useCallback` dependency list `[commit, ensureSession]` does not change (the
helper is module-level).

**Step 7 — `Play` effect call site (lines ~2475-2484).** Replace
```ts
    placesFor(run.edition, run.regionId, run.difficultyChoice).then(
      (loaded) => {
```
with
```ts
    globeTierSplitFor(run.edition, run.regionId)
      .then((tierSplit) =>
        placesFor(run.edition, run.regionId, run.difficultyChoice, tierSplit),
      )
      .then(
      (loaded) => {
```
and leave the two handlers and the cleanup exactly as they are (re-indent only
if tsc/prettier complains). This intermediate state is deliberately STILL the
buggy `62895ea` state-handling (see step 8); it exists so QA can show the
regression E2E failing before step 8 (section 5, "Red first").

**Step 8 — `Play`: never render a catalog loaded for another band (ARCH-REVIEWER
BLOCK on `62895ea`).**

The bug (verified by the orchestrator): `GameApp` renders `<Play>` whenever
`run` is set (`if (run)` branch, ~line 1578) BEFORE the `if (starting)` loading
branch (~line 1696). During `openRun(..., { fresh: true })` for a Globe
learning-path change (celebration "Try Medium", replay at another path),
`Play` stays mounted; `commit(next)` re-renders it with the NEW run while its
`places` state still holds the OLD band's tiers. `PlayLoaded` (no `key`) then
runs `resolveRunPool(oldPlaces, newPoolIds)` (partial pool, or the whole stale
catalog when the overlap is empty, `pool.ts:21`), builds a dealer with the new
seed and the NEW band's seen store, and its effect
`dealer.markDealtThrough(run.index)` (~line 2705) writes a place the player
never saw into the new band's no-repeat history BEFORE `Play`'s effect calls
`setPlaces(null)`. It also mounts and destroys a `SatelliteMap`. The comment
"The null reset above keeps it fail-closed" was wrong for that commit.

The fix (derive, do not reset): `places` is only ever the catalog loaded for
the CURRENT key, computed during render.

8a. NEW `src/game/places-load-key.ts` (exact content; node strip-types safe):
```ts
import type { Edition } from "./run.ts";
import type { PickerDifficulty } from "./tier-filter.ts";

/**
 * Identity of a Play catalog load: `edition:regionId:band`. The band is part
 * of the key ONLY for the Globe (the only region whose catalog depends on the
 * learning path - placesFor ignores `choice` everywhere else), so country and
 * state runs never reset or remount on a band change.
 */
export function placesLoadKey(
  edition: Edition,
  regionId: string,
  choice: PickerDifficulty,
): string {
  return `${edition}:${regionId}:${regionId === "globe" ? choice : ""}`;
}

export interface LoadedFor<T> {
  key: string;
  value: T;
}

/** The loaded value only if it was loaded for `key`; otherwise null (stale). */
export function loadedForKey<T>(loaded: LoadedFor<T> | null, key: string): T | null {
  return loaded !== null && loaded.key === key ? loaded.value : null;
}
```

8b. `src/components/game-app.tsx`: add
`import { loadedForKey, placesLoadKey, type LoadedFor } from "@/game/places-load-key";`
next to the other `@/game/*` imports. `Starter` is already imported in this
file (verify with grep; do not add a second import).

8c. In `Play`, replace the two state lines (~2432-2433)
```ts
  const [places, setPlaces] = useState<Starter[] | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
```
with
```ts
  // The catalog is stored WITH the key it was loaded for and only used while
  // that key is the current run's key. Play stays mounted across run changes
  // (GameApp renders it whenever `run` is set), so a plain `places` state would
  // hand PlayLoaded the previous band's catalog for one commit: wrong pool, a
  // dealer on the new band's seen store, and a stale place written into the
  // new band's no-repeat history. Deriving `places` makes that commit
  // impossible: a key mismatch renders "Loading places" instead.
  const loadKey = placesLoadKey(run.edition, run.regionId, run.difficultyChoice);
  const [loadedPlaces, setLoadedPlaces] = useState<LoadedFor<Starter[]> | null>(null);
  const [poolFailure, setPoolFailure] = useState<LoadedFor<string> | null>(null);
  const places = loadedForKey(loadedPlaces, loadKey);
  const poolError = loadedForKey(poolFailure, loadKey);
```
(`places` and `poolError` keep their names and types, `Starter[] | null` and
`string | null`, so the code below them, including the `game_loaded` milestone
effect, the error screen and the loading screen, is unchanged. The existing
`reviewEntries` state stays as is.)

8d. Replace the body of the load effect (from `let cancelled = false;` to the
cleanup and dependency array) so that it never resets `places`/`poolError`
to null (derivation does that) and writes keyed values. Final effect:
```ts
  useEffect(() => {
    let cancelled = false;
    setPoolFailure(null);
    setReviewEntries(null);
    if (review) {
      // Review deck: no chunk fetch - due cards carry their own snapshots.
      // (keep the existing comment and try/catch body, with only these two
      // setter changes:)
      //   setPlaces(entries.map(deckStarter))
      //     -> setLoadedPlaces({ key: loadKey, value: entries.map(deckStarter) })
      //   setPoolError("Could not load your review deck.")
      //     -> setPoolFailure({ key: loadKey, value: "Could not load your review deck." })
      // (keep `setReviewEntries(entries)` and both `if (!cancelled)` guards)
      return () => {
        cancelled = true;
      };
    }
    globeTierSplitFor(run.edition, run.regionId)
      .then((tierSplit) =>
        placesFor(run.edition, run.regionId, run.difficultyChoice, tierSplit),
      )
      .then(
        (list) => {
          if (!cancelled) setLoadedPlaces({ key: loadKey, value: list });
        },
        (err: unknown) => {
          if (!cancelled) {
            setPoolFailure({
              key: loadKey,
              value: err instanceof Error ? err.message : String(err),
            });
          }
        },
      );
    return () => {
      cancelled = true;
    };
    // Keyed on the load key, not on the individual run fields. For the Globe
    // the key contains the learning path, so a band change (celebration
    // promotion, replay at another path) loads the new band's catalog and, until
    // it arrives, renders "Loading places" - never the old band's catalog.
    // For every other region the key has no band part, so a band change does
    // not reload or remount. Flag on: the Globe loads only the tiers of the
    // new path. Flag off: the reload is unnecessary (the pool is the full
    // Globe pool for every band) but harmless: globeTierSplitFor returns its
    // cached value and placesFor hits the chunk cache, so the same full pool
    // comes back after one "Loading places" frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);
```
`loadKey` encodes `edition`, `regionId` and (Globe only) `difficultyChoice`,
which are the only run fields the effect reads, so the single dependency is
complete; the `eslint-disable` mirrors the existing one on the `dealer` memo.
Grep inside `Play` afterwards: no remaining `setPlaces(` or `setPoolError(`
(`grep -n "setPlaces(\|setPoolError(" src/components/game-app.tsx` must print
nothing).

Accepted, documented difference from `main@d7a0fc8` (which had no
`difficultyChoice` dependency): for the GLOBE with the flag OFF, a band change
now briefly shows "Loading places" and remounts `PlayLoaded` (cache hit, pool
contents identical). It was already the behaviour of this branch (`62895ea`).
It no longer applies to any non-Globe region.

**Step 9 — docs.** In `docs/feature-flags.md` "Current catalog" add the row
(keep column alignment loose, it is Markdown):
```
| `globeTierSplit`   | `false` | Globe loads all five fame-tier files and deals the full canonical pool (today's production); on = Easy t1+t2, Medium t2-t4, Hard t4+t5 only |
```
and, directly under the table, this paragraph (exact text):
```
**`globeTierSplit` and offline play.** With the flag on, the Globe fetches only
the fame-tier files of the learning path being played, and the service worker
caches `/assets/` files on first use. A player who has only played Easy and is
then offline can therefore not start Medium or Hard on the Globe: the run does
not start and the normal "Could not load places for Globe" message appears
(fail-closed; nothing partial is dealt). Going online and choosing again
works. With the flag off, one load covers every learning path (the previous
behaviour). No cache-warming is done on purpose.
```

**Step 10 — tests** per section 4 (WORKER writes the unit tests; QA writes the E2E).

**Step 11 — pre-flight greps (WORKER, before editing).**
`grep -n "placesFor(" src` must show exactly two non-test call sites
(`game-app.tsx` openRun and Play effect). If there is a third, STOP and report.
`grep -n "from \"\./.*\.ts\"" src/lib/flags.test.ts` confirms the `.ts`
relative-import style. `grep -n "setPlaces(\|setPoolError(" src/components/game-app.tsx`
must show only the lines inside `Play` that step 8 replaces (~2432-2492).

**Step 12 — BRANCH_STATUS.md.** In "## Pending" delete the bullet "Kill switch flag
`globeTierSplit` for the tier split (orchestrator step 0)." Under "## Done" add:
"- WS-0: kill switch `globeTierSplit` (default false = full Globe pool; code
commit). `public/flags.json` enabling it is a separate commit; revert that
commit alone to turn the faster path off." (Orchestrator may reword after the
second commit.)

**Step 13 — `scripts/migrate-notable-to-history.mjs` (NIT 5).** This one-off
migration rewrites every dirty chunk, including `chunks/globe.json`, without
regenerating the derived tier files, which would leave the runtime (which loads
only the tier files) stale. Minimal change, same pattern as
`scripts/enrich-wikipedia.mjs` (~line 1042):
- Add after the existing imports (line ~26):
  `import { writeGlobeTiers } from "./build-globe-tiers.mjs";`
- Replace the persist loop (lines ~107-112) with
```js
// Persist only chunks that actually changed (byte-identical otherwise).
let wrote = 0;
let globeChanged = false;
for (const { file, chunk, dirty } of chunks) {
  if (!dirty) continue;
  writeFileSync(join(CHUNKS_DIR, file), JSON.stringify(chunk) + "\n");
  wrote++;
  if (file === "globe.json") globeChanged = true;
}
// The runtime loads Globe from the derived per-tier files, not from
// chunks/globe.json - keep them in step (the prebuild gate fails if not).
if (globeChanged) writeGlobeTiers();
```
Leave everything else in the script untouched. DO NOT RUN this script (it
mutates place data; never edit place content). No unit test (the script runs
its migration on import). Verification is read-only:
`node scripts/build-globe-tiers.mjs --check` prints
`globe tiers in sync with chunks/globe.json`, and `node -e "import('./scripts/build-globe-tiers.mjs')"`
confirms the named export exists. Note: staleness was never silent: the
prebuild gate (`scripts/check-generated-places.mjs` -> `checkGlobeTiers`) and
`scripts/globe-tiers.test.mjs` already fail loudly when tier files differ from
`chunks/globe.json`; this change just removes the manual regeneration step.

### How agreement of the two `placesFor` calls is guaranteed

- Both calls go through `globeTierSplitFor` -> `resolveGlobeTierSplit`, which
  caches the first decision per page load in a closure variable. The second
  call (Play effect) can therefore never see a different value than the first
  (`openRun`), even if `flags.json` is refetched and `isEnabled()` flips in
  between (the picker's `useDeckStatus` effect calls `loadFlags()` again each
  time the player returns to the picker). A flag flip takes effect on the
  **next page load**, never mid-session (matches `docs/feature-flags.md`).
- Same-page band change (the BLOCK on `62895ea`): agreement of the flag value
  is not enough; the CATALOG must also match the run. `Play` therefore derives
  `places` from `{ key, value }` state and renders `PlayLoaded` only when the
  stored key equals `placesLoadKey(run.edition, run.regionId, run.difficultyChoice)`
  (step 8). For the Globe the key contains the band, so Easy -> Medium shows
  "Loading places" until the Medium catalog is loaded; the stale Easy catalog
  is never combined with the new run's `poolIds`, seed or seen store. Non-Globe
  keys have no band part, so country/state band changes do not reload or remount.
- Concurrent first callers: both await `deps.load()`, then re-check `decided`
  after the await; the first to resume writes it, the other returns the same
  value.
- Resume after reload (new page load, new decision, no `openRun`): the Play
  effect is the first caller and decides. This is safe in both directions
  because every run's `poolIds` are drawn from `filterByTier(places, choice)`,
  i.e. within `tiersFor(run.difficultyChoice)`, so a catalog loaded for
  `tiersFor(run.difficultyChoice)` (flag on) always contains them, and the full
  catalog (flag off) always does. Test (section 4, pool.test.ts) pins both.
  One pre-existing exception remains only with the flag ON: a legacy run saved
  before difficulty bands existed (poolIds not banded, `difficultyChoice`
  backfilled to medium) could resolve partially. The flag OFF removes it.
- Pre-`loadFlags()` window: a Globe run started before `flags.json` has
  resolved **waits** for it (the app already shows "Loading places"; wait is
  bounded by `FLAGS_FETCH_TIMEOUT_MS` = 1500 ms). If the fetch times out,
  fails, is offline, or returns junk, `isEnabled` returns the baked-in `false`
  and the run uses the FULL pool. The tier-limited path is only ever taken
  after `flags.json` positively said `true`. The decision (including a
  timeout-derived `false`) is cached for the page; the next page load retries.
  Cost: the first Globe run of a page load issues one extra tiny `flags.json`
  GET (loadFlags re-fetches once its boot-time promise has settled), served
  network-first by the SW; later runs use the cache.

## 4. Tests

Existing helpers/patterns to reuse: `readJson`, `legacyBandIds`, `CHOICES`,
`clearChunkCacheForTests`, `loadedGlobeTiersForTests`, `poolForNewRun`,
`createDealer`, `memorySeenStore`, `resolveRunPool` (all already in
`src/game/generated-places.test.ts` / `pool.test.ts`).

### 4.1 Unit — `src/game/generated-places.test.ts` (WORKER)

Adapt (add `, true` as 4th arg so they still prove the ON path; rename titles
to say "(tierSplit on)"):
- test at ~1081 (`placesFor(globe, choice)` banded pool): `placesFor("globe","globe",choice,true)`.
- test at ~1098 (Easy fetches only t1+t2; Medium/Hard add): every `placesFor("globe","globe","<choice>")` gets `, true`. The last case `placesFor("globe","globe")` (no choice) stays as is: all five.
- test at ~1116 (seeded dealing order): see "add" below.
- test at ~1135 (country ignores the learning path): inside the loop call `placesFor("country","united-states",choice,true)`; also assert tiers stay `[]`.

Add:
1. `globe tiers: flag off - every learning path gets the full canonical pool`:
   for each `choice` of `CHOICES`: `clearChunkCacheForTests()`;
   `off = await placesFor("globe","globe",choice,false)`;
   `full = await placesFor("globe","globe")`;
   assert `off.map(id)` deepEqual `full.map(id)` (same ids, same order);
   assert `loadedGlobeTiersForTests()` deepEqual `[1,2,3,4,5]`;
   assert `off.filter(s => s.id.startsWith("gn-")).map(id)` deepEqual the ids of
   `readJson("chunks/globe.json").places` in file order (the `main@d7a0fc8`
   source of truth);
   assert `filterByTier(off, choice).map(id)` deepEqual `legacyBandIds(choice)`
   plus the curated globe starters' ids in whichever position
   `buildRegionPool` puts them: write it as: ids of `filterByTier(off,choice)`
   filtered to `gn-` prefix deepEqual `legacyBandIds(choice)`.
2. `globe tiers: omitted tierSplit argument behaves as off`:
   `placesFor("globe","globe","easy")` (3 args) after `clearChunkCacheForTests()`
   loads `[1,2,3,4,5]`.
3. Replace/extend the seeded-dealing test: loop `for (const tierSplit of [false, true])`
   and `for (const choice of CHOICES)`, keep `SEED = 20261013` and the 300-deal
   comparison; additionally compute `baseline = dealFrom(fullPlaces)` once per
   choice and assert the off-mode deal equals the on-mode deal equals
   `baseline` (seeded dealing order identical in both modes), and
   `new Set(baseline).size === 300`.
4. `globe tiers: tierSplit never affects non-globe regions`:
   `placesFor("state","texas","easy",true)` ids deepEqual `placesFor("state","texas")` ids;
   `loadedGlobeTiersForTests()` is `[]`.

### 4.2 Unit — `src/game/pool.test.ts` (WORKER)

- Loop at ~105 (`globe ${choice}: tier-limited catalog resolves the same run pool`):
  call `placesFor("globe","globe",choice,true)`; title gets "(tierSplit on)". Keep
  every assertion (including `fromLean.length === start.poolIds.length`: poolIds
  are within the lean catalog).
- New loop: `globe ${choice} (tierSplit off): catalog is the full catalog and resolves the same run pool`:
  `off = placesFor("globe","globe",choice,false)`; assert `off.map(id)` deepEqual
  `full.map(id)`; `resolveRunPool(off, start.poolIds).length === start.poolIds.length`.
- Test at ~128 ("tier-limited catalog cannot satisfy a wider band's poolIds"):
  pass `true` to the Easy call. Add companion
  `globe: with tierSplit off even an Easy-started catalog satisfies a Medium pool`:
  `offEasy = placesFor("globe","globe","easy",false)`;
  `resolveRunPool(offEasy, mediumIds).length === mediumIds.length`. This pins the
  invariant that makes a call-site disagreement harmless in the safe direction.

### 4.3 Unit — `src/lib/globe-tier-split.test.ts` (NEW, WORKER)
Use `node:test` + `node:assert/strict`, import `./globe-tier-split.ts`,
`./flags.ts` (`loadFlags`, `isEnabled`, `resetFlags`). Cases:
1. fake deps `{load: async()=>{}, read: ()=>false}` -> `false`.
2. `read` returns true -> `true`.
3. cache: `load` call counter; three sequential + three concurrent
   (`Promise.all`) resolves -> counter is 1 for the sequential batch after the
   first, all six values equal. (Concurrent first callers: each may call
   `load`; assert only that all results are equal.)
4. **flag flips after first resolution**: `read` returns true on call 1, then
   false -> resolver keeps returning `true` (the two-call-site guarantee); and
   the mirror (false then true -> stays `false`).
5. `load` rejects -> resolves (never rejects) with the `read` value (use
   `read: ()=>false` -> `false`).
6. `read` throws -> `false`.
7. Integration with the real flags module via the test seam: `resetFlags()`;
   resolver `createGlobeTierSplitResolver({ load: () => loadFlags({ BASE_URL: "/Meridian/", fetch: fake }), read: isEnabled })`
   where fake returns `{ ok: true, json: async()=>({flags:{globeTierSplit:true}}) }`
   -> `true`; with `{flags:{}}` -> `false`; with `{flags:{globeTierSplit:"yes"}}` -> `false`;
   with a rejecting fetch -> `false`. Use a fresh resolver and `resetFlags()` per case.
8. The production singleton under node (no `window`, so `loadFlags()` resolves
   immediately) resolves `false`. Keep this the last test in the file (it
   caches).

### 4.4 Unit — `src/lib/flags.test.ts` (WORKER)
Append `describe("globeTierSplit flag", ...)` modelled on the `learningOutcomes`
block: (a) `FLAG_DEFAULTS.globeTierSplit === false` and `isEnabled("globeTierSplit") === false` before any load;
(b) a payload `{flags:{globeTierSplit:true}}` flips it on; (c) non-boolean
(`"true"`, 1, null) is ignored -> false; (d) a later payload that omits it
returns it to false (wholesale replace); (e) failed/non-OK fetch keeps false;
(f) `Object.keys(FLAG_DEFAULTS)` includes `"globeTierSplit"`.

### 4.5 Unit — `scripts/flags-content.test.mjs` (WORKER, **commit 2 only**)
Add:
```js
test("public/flags.json ships globeTierSplit on (the faster Globe path)", () => {
  const payload = JSON.parse(readFileSync(FLAGS_PATH, "utf8"));
  assert.equal(payload.flags.globeTierSplit, true);
});
```
This assertion lives in commit 2 so that reverting commit 2 removes the flag
line and its assertion together and leaves the suite green.

### 4.6 Black-box E2E — `tests/e2e/globe-tier-split.desktop.spec.ts` (QA)

Rules: drive the app as a player; assert only on the network log and what the
player sees; never import app modules; no production hooks; fresh context per
test; `reducedMotion` is not needed.

Shared setup (in the spec file):
- `test.setTimeout(240_000)`.
- `test.beforeEach(async ({ context, page }) => { await serveBuiltArtifact(context); await page.addInitScript(() => { try { (navigator.serviceWorker as unknown as Record<string, unknown>).register = () => Promise.reject(new Error("service worker disabled for test")); } catch {} }); })`
  (same technique as `installAudioProbe` in `helpers.ts`: keeps every request
  visible to the page; adds nothing to production).
- Register any `flags.json` route AFTER `serveBuiltArtifact` (Playwright uses
  the most recently registered matching route first):
  `await context.route("**/flags.json", r => r.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body }))`.
- Collector: `const tiers = new Set<string>(); page.on("request", req => { const m = /\/assets\/globe-t([1-5])-[A-Za-z0-9_-]+\.js$/.exec(new URL(req.url()).pathname); if (m) tiers.add(m[1]); });` and a second flag if any URL matches `/omitted-globe-chunk/` (must stay false). Register the listener BEFORE `page.goto`.
- Helper `startEasyGlobeRun(page)`: `await page.goto(APP_NO_IDLE)` (import `APP_NO_IDLE`, `pickBand`, `readPhase`, `serveBuiltArtifact` from `./helpers`); `await pickBand(page, "Easy")`; `await page.getByRole("button", { name: "Play the globe" }).click()`; `await expect(page.locator(".satellite-map")).toBeVisible()`; `await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim")`. (Same steps as `startGlobeRun`/`difficulty-picker.spec.ts`; if a tile-failure overlay appears call `dismissTileOverlayIfPresent`.)
- Assertion helper: `const sorted = [...tiers].sort();`.

Tests (T1-T4 are part of commit 1; T5 is part of commit 2):

| # | Setup | Action | Expected |
|---|---|---|---|
| T1 | route `flags.json` -> `{"version":1,"flags":{"globeTierSplit":false}}` | start Easy Globe run | `sorted` equals `["1","2","3","4","5"]`; no omitted-chunk request; question text visible (`readQuestion` from helpers, or `.satellite-map` + phase `aim`) |
| T2 | route `flags.json` -> `{"version":1,"flags":{"globeTierSplit":true}}` | start Easy Globe run | `sorted` equals `["1","2"]`; no omitted-chunk request |
| T3 | `context.route("**/flags.json", r => r.abort("failed"))` | start Easy Globe run | `sorted` equals all five (fail-safe: unreachable `flags.json` = full pool) |
| T4 | route `flags.json` -> `globeTierSplit:true` with an 800 ms delay before `fulfill` | start Easy Globe run | `sorted` equals `["1","2"]` AND the run reached `aim` (the run waited for the flag instead of racing to the full pool or deadlocking) |
| T5 (commit 2) | NO `flags.json` route (the real shipped file served from `dist/client`); precondition: `JSON.parse(readFileSync("dist/client/flags.json","utf8")).flags.globeTierSplit === true` | start Easy Globe run | `sorted` equals `["1","2"]` |

If any assertion is flaky, rerun 3 times and report the pass count (QA role).
Before commit 2 exists, T5 does not exist; do not add it to the file until the
orchestrator says commit 2 is being prepared. Also run the existing
`tests/e2e/feature-flags.spec.ts`, `difficulty-picker.spec.ts`,
`cleared-mode.spec.ts` unchanged as regression for flags and band promotion.

### 4.7 Black-box E2E — `tests/e2e/globe-band-switch.desktop.spec.ts` (QA, regression for the BLOCK)

Proves the player-visible consequence of the stale-catalog bug: after a Globe
learning-path promotion, the new band's no-repeat history contains exactly the
places the player was dealt. Drive it like `tests/e2e/cleared-mode.spec.ts`
(`driveBandClear` at :180, promotion at :233 "Easy celebration promotes to a
fresh Medium run" and :261 "Medium celebration promotes to a fresh Hard run"),
but on the Globe. Copy the small local helpers you need from that file
(`curatedDifficulties`, `pickDifficulty`, `readRunFull`, `readDropPlaceId`,
`expectAim`, `collectErrors`, `expectCleanConsole`, `celebration`) into the new
spec; do NOT edit `tests/e2e/helpers.ts` or `cleared-mode.spec.ts`. Use
`serveBuiltArtifact`, `commitMiss`, `clickNextPlace`, `readPhase`,
`dismissTileOverlayIfPresent` from `./helpers`. Same `beforeEach` as 4.6
(serve artifact + SW-registration block). `test.setTimeout(240_000)`.

Shared data (read from the shipped sources, as the other specs do):
- `tierPlaces(t)`: `JSON.parse(readFileSync("src/game/data/geonames/tiers/globe-t"+t+".json","utf8")).places` -> `{id, lon, lat, difficulty}`.
- `curated = curatedDifficulties("globe","globe")` (id + difficulty).
- `tierOf(id)`: map over `curated` + all five tier files; unknown difficulty reads as 3 (same guard as the app).
- `easyBandIds` = ids with tier 1-2 from `curated` + `tierPlaces(1)` + `tierPlaces(2)`.
- `keep` = the first (by id, ascending numeric) place of `tierPlaces(1)` ++ `tierPlaces(2)` with `100 <= lon <= 170` and `-40 <= lat <= 60` (far from the Atlantic tap that `commitMiss` uses at (500,400), so the answer is a guaranteed miss). Assert it is found.
- Keys: `EASY_KEY = "meridian:seen:v2:globe:globe:easy"`, `MEDIUM_KEY = "meridian:seen:v2:globe:globe:medium"`.

Run the same test body twice, `for (const split of [true, false])`, with
`flags.json` routed (after `serveBuiltArtifact`) to
`{"version":1,"flags":{"globeTierSplit":<split>}}`. Test titles:
`globe band switch (globeTierSplit=${split}): Medium seen store holds exactly what was dealt`.

Body:
1. `page.goto(APP_NO_IDLE)`; `localStorage.setItem(EASY_KEY, JSON.stringify(easyBandIds.filter(id => id !== keep)))`; assert `localStorage.getItem(MEDIUM_KEY) === null`.
2. `pickDifficulty(page, "Easy")`; click "Play the globe"; `expectAim(page)`.
3. `expect((await readRunFull(page)).poolIds).toEqual([keep])` (proves the seeded band computation matches the app).
4. `commitMiss(page)`; `expect(await readDropPlaceId(page)).toBe(keep)`; `clickNextPlace(page)`; `await expect(celebration(page)).toBeVisible({ timeout: 15_000 })`.
5. Before promoting, `localStorage.getItem(MEDIUM_KEY)` is still `null`.
6. Click "Try Medium" in the dialog; `expectAim(page)`; `run = readRunFull`: `difficultyChoice === "medium"`, `index === 0`, `regionId === "globe"`.
7. `commitMiss(page)`; `d1 = await readDropPlaceId(page)`; assert `tierOf(d1)` in `[2,3,4]`.
8. Read `seen1 = JSON.parse(localStorage.getItem(MEDIUM_KEY) ?? "[]")`. **Assert `seen1` equals `[d1]` exactly** (the player saw exactly one Medium place; no stale-catalog place was recorded). Also assert every id in `seen1` is in `run.poolIds` of the Medium run (`readRunFull(page).poolIds`).
9. `clickNextPlace`, `expectAim`, `commitMiss`, `d2 = readDropPlaceId`; assert `seen2` equals `[d1, d2]` exactly and `d2 !== d1`.
10. `expectCleanConsole(errors)`.
If `commitMiss` ever has to retry (rare hit on a place), additional legitimately
dealt ids appear; to stay exact, record every answered id by reading
`readDropPlaceId` after each `commitMiss` call you make, and compare `seen` to
that ordered list. Rerun 3 times if flaky and report the pass count.

Expected: both variants pass AFTER step 8. **Red first (QA role: show the
regression failing before the fix):** see section 5 "Red first".

### 4.8 Unit — `src/game/places-load-key.test.ts` (NEW, WORKER)
`node:test` + `node:assert/strict`; import `./places-load-key.ts`,
`./generated-places.ts` (`placesFor`), `./tier-filter.ts` (`filterByTier`),
`./trail.ts` (`poolForNewRun`, `memorySeenStore`), `./pool.ts` (`resolveRunPool`).
1. `placesLoadKey("globe","globe","easy") === "globe:globe:easy"`; the three Globe bands give three different keys.
2. Non-Globe keys ignore the band: `placesLoadKey("state","vermont","easy") === placesLoadKey("state","vermont","hard") === "state:vermont:"`; same for `("country","france", ...)` and `("globe","review-deck", ...)` (-> `"globe:review-deck:"`, so a review run never reloads on a band change).
3. Different edition or regionId give different keys.
4. `loadedForKey(null, k) === null`; `loadedForKey({key:k,value:v}, k) === v` (same reference); `loadedForKey({key:k1,value:v}, k2) === null`.
5. **Regression (stale catalog never reaches a new run):** `easy = await placesFor("globe","globe","easy",true)`; `stale = { key: placesLoadKey("globe","globe","easy"), value: easy }`; `mediumKey = placesLoadKey("globe","globe","medium")`; `full = await placesFor("globe","globe")`; `mediumIds = poolForNewRun(filterByTier(full,"medium"), memorySeenStore()).poolIds`.
   - Document the hazard: `resolveRunPool(easy, mediumIds).length` is `> 0` and `< mediumIds.length` (a partial pool).
   - Assert the guard: `loadedForKey(stale, mediumKey) === null`, so `Play` shows "Loading places" and that partial pool is never built. And `loadedForKey(stale, placesLoadKey("globe","globe","easy")) === easy`.

### 4.9 Visual
None. No UI or copy changes (the existing "Loading places" screen is reused); no baselines.

## 5. Acceptance commands (run in order; save output to the log path the orchestrator gives)

Commit 1 state (flag default `false`, `flags.json` unchanged):
1. `npx tsc --noEmit` -> no output, exit 0.
2. `npm test` -> exit 0; both runners report `fail 0`. New/changed files appear
   in the TAP output: `globe-tier-split.test.ts` (new), `places-load-key.test.ts` (new),
   `flags.test.ts`, `generated-places.test.ts`, `pool.test.ts`.
3. `node scripts/lint-cards.mjs` -> prints `GATE PASSED`.
3b. `node scripts/build-globe-tiers.mjs --check` -> prints `globe tiers in sync with chunks/globe.json`.
4. `npm run build:pages` -> exit 0 (prebuild runs `check-generated-places` and
   `lint-cards`; postbuild fingerprints the SW).
4b. **E2E build.** Then run
   `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages`
   -> exit 0. This LAST build is the `dist/client` that `serveBuiltArtifact`
   serves; the new E2E specs (step 5) MUST run against it (not against the
   plain build from step 4). Do not rebuild between 4b and 5/6.
5. `npx playwright test tests/e2e/globe-tier-split.desktop.spec.ts tests/e2e/globe-band-switch.desktop.spec.ts --project=desktop --workers=1` (background, poll the log) -> `6 passed` (4 network-log tests T1-T4 + 2 band-switch variants).
6. Full `npx playwright test --workers=1` (background) -> same failures as
   `main` only; label any failure that also fails on `main` PRE-EXISTING.

**Red first (QA, once).** Before applying step 8 (i.e. after steps 1-7, 9-13 and the
tests exist), run 4b then `npx playwright test tests/e2e/globe-band-switch.desktop.spec.ts --project=desktop --workers=1`.
Expected: the `globeTierSplit=true` variant FAILS at step 8 of the test body
(`seen1` has two ids, a stale-catalog place plus the real one, instead of
`[d1]`) and the `globeTierSplit=false` variant passes (identical catalogs, so
no divergence). Quote the failure output in the report. If the `true` variant
passes without step 8, STOP and report (the test does not reproduce the bug).
Then apply step 8, rebuild (4b) and rerun: both variants pass.

Commit 2 state (adds `globeTierSplit: true` to `public/flags.json`, the
`flags-content` assertion and T5): repeat steps 1-4b (rebuild is required: the
E2E serves `dist/client`, which copies `public/flags.json`), then step 5 ->
`7 passed` (adds T5), then step 6.

Revert check (orchestrator, optional but recommended): `git revert --no-edit <commit-2>`
in a scratch worktree, rerun 2-5; expect `6 passed`, with no test left asserting
the shipped `true`.

## 6. Flag and commit plan

This change is itself the flag. `FLAG_DEFAULTS.globeTierSplit = false` = today's
production behaviour (full Globe pool, canonical order, then `filterByTier`).
Following `docs/feature-flags.md`: gate is in a handler/effect after
`loadFlags()` (never module scope); both positions are unit- and E2E-tested.

The orchestrator makes exactly two commits (stage named files only, never
`git add -A`; WORKER/QA never run git):
- **Commit 1 "perf: globeTierSplit kill switch (default off)"**:
  `src/lib/flags.ts`, `src/lib/globe-tier-split.ts`, `src/lib/globe-tier-split.test.ts`,
  `src/lib/flags.test.ts`, `src/game/generated-places.ts`,
  `src/game/generated-places.test.ts`, `src/game/pool.test.ts`,
  `src/game/places-load-key.ts`, `src/game/places-load-key.test.ts`,
  `src/components/game-app.tsx`, `tests/e2e/globe-tier-split.desktop.spec.ts`
  (T1-T4), `tests/e2e/globe-band-switch.desktop.spec.ts`,
  `scripts/migrate-notable-to-history.mjs`, `docs/feature-flags.md`,
  `BRANCH_STATUS.md`. (The Play stale-catalog fix and the flag work are one
  code commit: the fix is required for the split path to be correct, and
  commit 2 must never be able to enable the split without it.)
- **Commit 2 "perf: enable globeTierSplit in flags.json"**, made AFTER commit 1,
  containing **only**: `public/flags.json`, `scripts/flags-content.test.mjs`
  (the 4.5 assertion), and the T5 block added to the E2E spec (plus the
  BRANCH_STATUS wording tweak if the orchestrator wants it). The shipped
  `flags.json` change is exactly this one-line edit (key order alphabetical):
  ```
  {"flags": {"globeTierSplit": true, "learningOutcomes": true, "pwaUpdateToast": true}, "version": 1, "observabilityEndpoint": "https://meridian-crash-report.knowledgetest.workers.dev/ingest"}
  ```
  `git diff` of that file must show one changed line and nothing else (keep the
  file's single-line form and its trailing-newline state). Reverting this single
  commit turns the faster path off and leaves every test green. Push after each
  commit.

## 7. Risks and what to do if a step fails

- **tsc: `placesFor` 4th param / `Edition` not in scope** -> `Edition` is already imported at game-app.tsx line 18; do not add a second import.
- **Existing test still passes `choice` without `true` and now loads five tiers** (e.g. `loadedGlobeTiersForTests()` assertion fails) -> that call was missed in the adapt list; add `, true`. Do not change production defaults to fix a test.
- **A run appears to hang at "Loading places"** -> the resolver awaits `loadFlags()` (<= 1.5 s). If longer, STOP and report; do not remove the await (kill switch must await).
- **Extra `flags.json` GET at first Globe run** -> expected (see section 3). T4 proves it does not break the run.
- **`resolveRunPool` partial pool with flag on after reload of a legacy run** -> pre-existing, flag-on only; out of scope; report if seen in E2E.
- **Globe band change with flag OFF shows "Loading places" and remounts `PlayLoaded`** -> accepted, documented difference from `main@d7a0fc8` (cache hit, identical full pool; already true of `62895ea`). It no longer applies to country/state/review runs (their key has no band part, step 8a). If an existing E2E (`cleared-mode`, `celebration`) newly fails ONLY with the flag off, STOP and report.
- **Stale catalog regression (BLOCK on `62895ea`)** -> step 8 is mandatory and must be in commit 1. If `tsc` complains about `loadedForKey(poolFailure, loadKey)` types, `poolFailure` is `LoadedFor<string>` so the result is `string | null`: do not cast. If any code outside `Play` used `setPlaces`/`setPoolError`, STOP and report.
- **Offline switch to a band whose tier files were never fetched (NIT 4, document only)** -> with the flag ON, `public/sw.js` caches `/assets/` files on first use, so a player who has only played Easy and is offline fails to start Medium/Hard on the Globe; the run fails closed with the normal "Could not load places for Globe" start error (previously one Globe file covered every band). Accepted; documented in `docs/feature-flags.md` (step 9). Do NOT add cache-warming code. The kill switch (flag off) removes the limitation.
- **`migrate-notable-to-history.mjs` change** -> never run the script (it mutates place data). The prebuild gate already fails loudly on stale tier files; step 13 only removes the manual regeneration step.
- **E2E T1/T3 see fewer than five tiers** -> the page may be SW-controlled (init-script missing) or `flags.json` route registered before `serveBuiltArtifact`. Check both before touching production code.
- **E2E asset-name regex matches nothing** -> run `ls dist/client/assets | grep globe-t` (names are `globe-t<N>-<hash>.js`) and fix the regex only.
- **`npm run build:pages` fails** -> it is a gate; report with the first error. Do not edit `vite.config.ts`.
- Any gate fails twice for an unclear reason, or a needed file is not in section 2 -> STOP and report (WORKER role).

## 8. Out of scope

Re-enabling the canonical `chunks/globe.json` bundle (stays stubbed); any perf
measurement or `docs/perf-baseline.md` update; changing tier bands or
`tiersFor`; making the effect dependency flag-conditional; mid-session flag
reactivity (no subscription, by design); flagging other regions;
`src/routes/__root.tsx` or SW changes; new telemetry; any place content,
pipeline or card change; visual baselines; WS-1 .. WS-6.

## 9. Not done (noted, to be handled separately)

- The `/` (root-base) build prints `_shell.html not found post-build` for the
  `nosw-hatch` / `crash-watchdog` specs' build path. Believed pre-existing; to be
  checked against `main` separately. This workstream does not touch it and
  does not run E2E on the `/` base.
- No cache-warming of the other bands' Globe tier files (NIT 4); see risks.
- No warm-up of the `PlayLoaded` remount for Globe band changes with the flag
  off (accepted difference above).
