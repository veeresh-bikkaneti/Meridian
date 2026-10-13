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

## 2. Files

### Change
| File | What |
|---|---|
| `src/lib/flags.ts` | Add `"globeTierSplit"` to `FlagName`; add `globeTierSplit: false` to `FLAG_DEFAULTS` with comment. Nothing else. |
| `src/game/generated-places.ts` | `placesFor` gets a 4th parameter `tierSplit: boolean = false`; Globe tier-limited loading happens only when it is `true`. Update the two doc comments that describe the split (module header lines ~22-28 and the `choice` param doc ~766-773). |
| `src/lib/globe-tier-split.ts` | **NEW.** Tiny per-page-load resolver (section 3, step 3). |
| `src/components/game-app.tsx` | One import; one top-level helper `globeTierSplitFor`; the two `placesFor` call sites (`openRun`, `Play` effect); update the comment above the effect's dependency array. |
| `src/lib/flags.test.ts` | New `describe("globeTierSplit flag")`. |
| `src/lib/globe-tier-split.test.ts` | **NEW** unit tests for the resolver. |
| `src/game/generated-places.test.ts` | Adapt on-path tests, add off-path tests (section 4). |
| `src/game/pool.test.ts` | Adapt on-path tests, add off-path tests (section 4). |
| `tests/e2e/globe-tier-split.desktop.spec.ts` | **NEW** (QA). The `desktop` suffix routes it to the `desktop` Playwright project (1440x900). |
| `docs/feature-flags.md` | One new row in "Current catalog". |
| `BRANCH_STATUS.md` | Move the "Kill switch flag `globeTierSplit`" Pending bullet to Done (wording in step 12). Do NOT touch the first two lines (`SAFE TO MERGE`, `LOCK`). |
| `public/flags.json` | **Commit 2 only**: add `"globeTierSplit": true`. |
| `scripts/flags-content.test.mjs` | **Commit 2 only**: add the `=== true` assertion. |

### Must NOT change
`src/routes/__root.tsx`, `public/sw.js`, `vite.config.ts` (the stub that omits
`chunks/globe.json` from bundles STAYS; flag-off does NOT go back to importing
`chunks/globe.json`, it merges the five tier files, which is proven equal to it),
`src/game/tier-filter.ts`, `src/game/pool.ts`, `src/game/trail.ts`,
`src/game/run.ts`, `src/game/starters.ts`, everything under
`src/game/data/`, `scripts/*` except the one test above, `package.json`,
`tests/e2e/helpers.ts` (reuse, do not edit), every other E2E spec, `.scratch/`.

## 3. Design (ONE design) and ordered steps

### Design in five sentences
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

**Step 7 — `Play` effect (lines ~2475-2484).** Replace
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
if tsc/prettier complains; `cancelled` guards stay on both handlers).

**Step 8 — dependency array.** KEEP `[run.edition, run.regionId, run.difficultyChoice]`
in BOTH modes. Replace the 4-line comment above it with:
```ts
    // difficultyChoice stays a dependency in both modes. Flag on: the Globe
    // loads only the tiers of the run's learning path, so a band change
    // (celebration promotion, replay at another path) must reload `places`.
    // Flag off: the reload is unnecessary (the pool is the full Globe pool
    // for every band) but harmless: the resolver returns its cached value and
    // placesFor hits the chunk cache, so the same full pool comes back. The
    // flag is async-resolved, so the dependency list cannot depend on it
    // without extra state; one code path for both modes is worth the extra
    // cache-hit load. The null reset above keeps it fail-closed.
```
Known, accepted difference from `main@d7a0fc8` (which had no
`difficultyChoice` dependency): with the flag off a band change briefly shows
"Loading places" and remounts `PlayLoaded`. This was already true of this
branch before the flag (commit `62895ea`). Pool contents are identical.

**Step 9 — docs.** In `docs/feature-flags.md` "Current catalog" add the row
(keep column alignment loose, it is Markdown):
```
| `globeTierSplit`   | `false` | Globe loads all five fame-tier files and deals the full canonical pool (today's production); on = Easy t1+t2, Medium t2-t4, Hard t4+t5 only |
```

**Step 10 — tests** per section 4 (WORKER writes the unit tests; QA writes the E2E).

**Step 11 — pre-flight greps (WORKER, before editing).**
`grep -n "placesFor(" src` must show exactly two non-test call sites
(`game-app.tsx` openRun and Play effect). If there is a third, STOP and report.
`grep -n "from \"\./.*\.ts\"" src/lib/flags.test.ts` confirms the `.ts`
relative-import style.

**Step 12 — BRANCH_STATUS.md.** In "## Pending" delete the bullet "Kill switch flag
`globeTierSplit` for the tier split (orchestrator step 0)." Under "## Done" add:
"- WS-0: kill switch `globeTierSplit` (default false = full Globe pool; code
commit). `public/flags.json` enabling it is a separate commit; revert that
commit alone to turn the faster path off." (Orchestrator may reword after the
second commit.)

### How agreement of the two `placesFor` calls is guaranteed

- Both calls go through `globeTierSplitFor` -> `resolveGlobeTierSplit`, which
  caches the first decision per page load in a closure variable. The second
  call (Play effect) can therefore never see a different value than the first
  (`openRun`), even if `flags.json` is refetched and `isEnabled()` flips in
  between (the picker's `useDeckStatus` effect calls `loadFlags()` again each
  time the player returns to the picker). A flag flip takes effect on the
  **next page load**, never mid-session (matches `docs/feature-flags.md`).
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

### 4.7 Visual
None. No UI or copy changes; no baselines.

## 5. Acceptance commands (run in order; save output to the log path the orchestrator gives)

Commit 1 state (flag default `false`, `flags.json` unchanged):
1. `npx tsc --noEmit` -> no output, exit 0.
2. `npm test` -> exit 0; both runners report `fail 0`. New/changed files appear
   in the TAP output: `globe-tier-split.test.ts` (new), `flags.test.ts`,
   `generated-places.test.ts`, `pool.test.ts`.
3. `node scripts/lint-cards.mjs` -> prints `GATE PASSED`.
4. `npm run build:pages` -> exit 0 (prebuild runs `check-generated-places` and
   `lint-cards`; postbuild fingerprints the SW).
5. `npx playwright test tests/e2e/globe-tier-split.desktop.spec.ts --project=desktop --workers=1` (run in background, poll the log) -> `4 passed` (T1-T4).
6. Full `npx playwright test --workers=1` (background) -> same failures as
   `main` only; label any failure that also fails on `main` PRE-EXISTING.

Commit 2 state (adds `globeTierSplit: true` to `public/flags.json`, the
`flags-content` assertion and T5): repeat steps 1-4 (rebuild is required: the
E2E serves `dist/client`, which copies `public/flags.json`), then step 5 ->
`5 passed`, then step 6.

Revert check (orchestrator, optional but recommended): `git revert --no-edit <commit-2>`
in a scratch worktree, rerun 2-5; expect `4 passed`, with no test left asserting
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
  `src/components/game-app.tsx`, `tests/e2e/globe-tier-split.desktop.spec.ts`
  (T1-T4), `docs/feature-flags.md`, `BRANCH_STATUS.md`.
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
- **Band change with flag off remounts `PlayLoaded`** -> accepted (step 8). If an existing E2E (`cleared-mode`, `celebration`) newly fails ONLY with the flag off, STOP and report; the fix would need a design decision.
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
