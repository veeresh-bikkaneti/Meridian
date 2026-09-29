# State, Country, and Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace city play and the five-round card with State, Country, and Globe trails that continue until a pin falls outside the radius.

**Architecture:** Pure rules decide the radius, the shared trail order, the hit, and the share line. A server place pool stores places only, and the model appends one place only when that pool cannot serve the next index. MapLibre draws live Esri imagery, locked to the region, with a globe for the globe edition.

**Tech Stack:** TypeScript, node:test (`node --experimental-strip-types --test`), TanStack Start server functions, existing `getSql()` and `migrations/0002_places.sql`, MapLibre GL, Esri World Imagery.

**Spec:** `docs/superpowers/specs/2026-09-28-state-editions-design.md`

## Global Constraints

- State radius is 12% of the region's greater side, clamped to 25–160 km.
- Country radius is 12% of the region's greater side, clamped to 40–450 km.
- Globe radius is 750 km.
- A distance equal to the radius is a hit. A greater distance ends the run.
- Landing outside the border does not end the run by itself.
- There is no round cap.
- The published result is the hit count. Distance is shown on a hit and does not end the run inside the radius.
- Share text is `meridian September 28` / `Nebraska · 14`, with no place names, no emoji row, and no score out of 1,000. A zero-hit run shares `Nebraska · 0`. The date is the UTC trail date in English, current year omitted.
- Trail date is the UTC date. Order is a seeded permutation of places that existed at 00:00 UTC, then places added later that day in insertion order.
- Seed input is `${dateKey}|${edition}|${regionId}` through the existing `hashString` and `mulberry32`.
- A new session starts at index 0. The same session resumes its index. No account.
- Launch countries: United States, Canada, Mexico, Brazil, United Kingdom, France, Germany, Italy, Egypt, India, China, Japan, Australia. All 50 states. No District of Columbia. No city packs.
- Imagery URL is `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
- Attribution is `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`.
- Tiles are not bundled or saved for offline use.
- The UI says the imagery host sees the area on screen and the pin stays on the device.
- The model runs only on the server, never on page load, one place at a time, and only when the next index is past the pool. One retry. Then the run stops with the count already earned and does not repeat a place.
- A generated state or country point must fall inside the region. A globe point must fall on land. Failures are not shown.
- Unique key is edition + region + normalized place name. The pool has no user id and stores no pins.
- Starters: at least 5 places per state, 5 per launch country, 12 for the globe.
- Accounts stay off.

## Review Focus

- A pin exactly on the radius continues, and a pin just past it ends the run. Pin this in Task 1 with `isHit(25, 25)` and `isHit(25.1, 25)`.
- A place added during the UTC day stays at the end of that day's trail and enters the normal shuffle the next day. Pin this in Task 3 with `orderPlaces` across `2026-09-28` and `2026-09-29`.
- The model function is not called when the pool already has the requested index. Pin this in Task 5 with a mock `extend` that fails the test if called.
- A generated point outside the region is not returned and is not stored. Pin this in Task 6 with a square ring and an outside point.
- A saved session resumes its index, and a missing session starts at 0. Pin this in Task 4 with `resumeRun`.

---

### Task 1: Radius

**Files:**
- Create: `src/game/radius.ts`
- Test: `src/game/radius.test.ts`
- Modify: `package.json` (add the test file to the `test` script)

**Interfaces:**
- Consumes: nothing
- Produces: `radiusKm(edition: "state" | "country" | "globe", greaterSideKm: number): number` and `isHit(distanceKm: number, radiusKm: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
assert.equal(radiusKm("state", 1000), 120);
assert.equal(radiusKm("state", 100), 25);
assert.equal(radiusKm("state", 2000), 160);
assert.equal(radiusKm("country", 200), 40);
assert.equal(radiusKm("country", 5000), 450);
assert.equal(radiusKm("globe", 1000), 750);
assert.equal(isHit(25, 25), true);
assert.equal(isHit(25.1, 25), false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/radius.test.ts`
Expected: FAIL with `radiusKm` not defined

- [ ] **Step 3: Implement `radiusKm` and `isHit` in `src/game/radius.ts`**

State and country use 12% of `greaterSideKm`, then the clamps in Global Constraints. Globe ignores the side and returns 750. `isHit` is `distanceKm <= radiusKm`. Add the test path to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/radius.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/radius.ts src/game/radius.test.ts package.json
git commit -m "Add the radius that ends a run."
```

### Task 2: Share line

**Files:**
- Modify: `src/game/share.ts`
- Modify: `src/game/rules.test.ts` (replace the emoji share assertion)
- Test: `src/game/share.test.ts`

**Interfaces:**
- Consumes: `BRAND.shareHost` from `src/game/brand.ts`
- Produces: `shareText(input: { regionName: string; dateKey: string; hits: number; now?: Date }): string`

- [ ] **Step 1: Write the failing test**

```ts
const now = new Date(Date.UTC(2026, 8, 28));
assert.equal(
  shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 14, now }),
  "meridian September 28\nNebraska · 14",
);
assert.equal(
  shareText({ regionName: "Japan", dateKey: "2026-09-28", hits: 9, now }),
  "meridian September 28\nJapan · 9",
);
assert.equal(
  shareText({ regionName: "Globe", dateKey: "2026-09-28", hits: 6, now }),
  "meridian September 28\nGlobe · 6",
);
assert.equal(
  shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 0, now }),
  "meridian September 28\nNebraska · 0",
);
assert.equal(shareText({ regionName: "Nebraska", dateKey: "2026-09-28", hits: 14, now }).includes("Capitol"), false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/share.test.ts`
Expected: FAIL because `shareText` still requires guesses and returns the emoji row

- [ ] **Step 3: Replace `shareText` in `src/game/share.ts`**

Use the signature above. Format the UTC `dateKey` in English with the current year omitted. Delete the emoji-row path and update `rules.test.ts` so it no longer expects that row. Add `share.test.ts` to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/share.test.ts src/game/rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/share.ts src/game/share.test.ts src/game/rules.test.ts package.json
git commit -m "Share how far the run got, not a five-round score."
```

### Task 3: Trail order

**Files:**
- Create: `src/game/trail.ts`
- Modify: `src/game/daily.ts` (export `hashString` and `mulberry32`)
- Test: `src/game/trail.test.ts`

**Interfaces:**
- Consumes: `hashString(value: string): number` and `mulberry32(seed: number): () => number`
- Produces: `orderPlaces(places: { id: string; createdAt: string }[], dateKey: string, edition: "state" | "country" | "globe", regionId: string): { id: string; createdAt: string }[]`

- [ ] **Step 1: Write the failing test**

```ts
const early = [
  { id: "a", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "b", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "c", createdAt: "2026-09-01T00:00:00.000Z" },
];
const late = { id: "d", createdAt: "2026-09-28T12:00:00.000Z" };
const day = orderPlaces([...early, late], "2026-09-28", "state", "nebraska");
assert.deepEqual(day, orderPlaces([...early, late], "2026-09-28", "state", "nebraska"));
assert.equal(day.at(-1)?.id, "d");
assert.deepEqual(day.slice(0, -1), orderPlaces(early, "2026-09-28", "state", "nebraska"));
const next = orderPlaces([...early, late], "2026-09-29", "state", "nebraska");
const shuffled = orderPlaces(
  [...early, { ...late, createdAt: "2026-09-01T00:00:00.000Z" }],
  "2026-09-29",
  "state",
  "nebraska",
);
assert.deepEqual(next, shuffled);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/trail.test.ts`
Expected: FAIL with `orderPlaces` not defined

- [ ] **Step 3: Implement `orderPlaces` in `src/game/trail.ts`**

Export the existing hash and mulberry helpers from `daily.ts`. Split places into those with `createdAt` before `${dateKey}T00:00:00.000Z` and those on or after it. Fisher-Yates the earlier set from `mulberry32(hashString(`${dateKey}|${edition}|${regionId}`))`, starting from ids sorted alphabetically. Append the later set sorted by `createdAt` then `id`. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/trail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/trail.ts src/game/trail.test.ts src/game/daily.ts package.json
git commit -m "Order a region's places the same way for one UTC day."
```

### Task 4: Run session

**Files:**
- Create: `src/game/run.ts`
- Test: `src/game/run.test.ts`

**Interfaces:**
- Consumes: `isHit(distanceKm: number, radiusKm: number): boolean`
- Produces:
  - `startRun(input: { edition: "state" | "country" | "globe"; regionId: string; regionName: string; dateKey: string }): Run`
  - `dropPin(run: Run, distanceKm: number, radiusKm: number): Run`
  - `continueRun(run: Run): Run`
  - `resumeRun(saved: Run | null, today: { edition: "state" | "country" | "globe"; regionId: string; regionName: string; dateKey: string }): Run`
  - `Run` is `{ edition, regionId, regionName, dateKey, index, hits, phase: "aim" | "story" | "done" }`

- [ ] **Step 1: Write the failing test**

```ts
const today = { edition: "state" as const, regionId: "nebraska", regionName: "Nebraska", dateKey: "2026-09-28" };
let run = startRun(today);
assert.equal(run.index, 0);
assert.equal(run.hits, 0);
run = dropPin(run, 25, 25);
assert.equal(run.phase, "story");
assert.equal(run.hits, 1);
assert.equal(run.index, 0);
run = continueRun(run);
assert.equal(run.phase, "aim");
assert.equal(run.index, 1);
run = dropPin(run, 25.1, 25);
assert.equal(run.phase, "done");
assert.equal(run.hits, 1);
assert.equal(continueRun(run).phase, "done");
assert.equal(resumeRun(null, today).index, 0);
assert.equal(resumeRun({ ...startRun(today), index: 4, hits: 4, phase: "aim" }, today).index, 4);
assert.equal(resumeRun({ ...startRun(today), index: 4, hits: 4, phase: "aim" }, { ...today, dateKey: "2026-09-29" }).index, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/run.test.ts`
Expected: FAIL with `startRun` not defined

- [ ] **Step 3: Implement the run functions in `src/game/run.ts`**

`dropPin` during `aim` moves to `story` and increments `hits` on a hit, or to `done` on a miss. `continueRun` advances `index` only from `story`. `resumeRun` returns the saved run only when edition, region, and date match and the phase is not `done`; otherwise it starts a new run. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/run.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/run.ts src/game/run.test.ts package.json
git commit -m "Continue a run until the pin misses."
```

### Task 5: Place pool

**Files:**
- Create: `migrations/0002_places.sql`
- Create: `src/game/pool.ts`
- Test: `src/game/pool.test.ts`

**Interfaces:**
- Consumes: `orderPlaces` from `src/game/trail.ts`
- Produces:
  - `nameKey(name: string): string`
  - `resolveNext(input: { index: number; places: { id: string; createdAt: string }[]; dateKey: string; edition: "state" | "country" | "globe"; regionId: string; extend: () => Promise<{ id: string; createdAt: string } | null> }): Promise<{ place: { id: string; createdAt: string } } | { place: null; reason: "unavailable" }>`
  - table `places` with columns `id`, `edition`, `region_id`, `name`, `name_key`, `lon`, `lat`, `story`, `source_label`, `source_href`, `created_at`, unique `(edition, region_id, name_key)`, and no user or pin columns

- [ ] **Step 1: Write the failing test**

```ts
let calls = 0;
const places = [
  { id: "a", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "b", createdAt: "2026-09-01T00:00:00.000Z" },
];
const extend = async () => {
  calls += 1;
  return null;
};
const hit = await resolveNext({ index: 0, places, dateKey: "2026-09-28", edition: "state", regionId: "nebraska", extend });
assert.equal(calls, 0);
assert.equal(hit.place?.id, orderPlaces(places, "2026-09-28", "state", "nebraska")[0]?.id);
const miss = await resolveNext({ index: 2, places, dateKey: "2026-09-28", edition: "state", regionId: "nebraska", extend });
assert.equal(calls, 1);
assert.deepEqual(miss, { place: null, reason: "unavailable" });
assert.equal(nameKey("  North Platte "), "north platte");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/pool.test.ts`
Expected: FAIL with `resolveNext` not defined

- [ ] **Step 3: Add the migration and `resolveNext`**

`nameKey` trims and lowercases. `resolveNext` orders with `orderPlaces` and returns that index when it exists, without calling `extend`. Past the end, it calls `extend` once and returns the place or `{ place: null, reason: "unavailable" }`. The SQL file creates only the `places` table described above. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/pool.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add migrations/0002_places.sql src/game/pool.ts src/game/pool.test.ts package.json
git commit -m "Store places in a shared pool with no pins."
```

### Task 6: Model extension

**Files:**
- Create: `src/game/extend-pool.ts`
- Test: `src/game/extend-pool.test.ts`

**Interfaces:**
- Consumes: `nameKey(name: string): string` and `pointInRing` from `src/game/geo.ts`
- Produces: `acceptGenerated(place: { name: string; lon: number; lat: number; story: string }, taken: string[], covers: (lon: number, lat: number) => boolean): boolean` and `extendOnce(input: { ask: () => Promise<{ name: string; lon: number; lat: number; story: string } | null>; taken: string[]; covers: (lon: number, lat: number) => boolean; insert: (place: { name: string; lon: number; lat: number; story: string }) => Promise<void> }): Promise<{ ok: true } | { ok: false }>`

- [ ] **Step 1: Write the failing test**

```ts
const square: [number, number][] = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const covers = (lon: number, lat: number) => pointInRing([lon, lat], square);
assert.equal(acceptGenerated({ name: "Omaha", lon: 0, lat: 0, story: "A city on the river." }, [], covers), true);
assert.equal(acceptGenerated({ name: "Omaha", lon: 0, lat: 0, story: "A city on the river." }, ["omaha"], covers), false);
assert.equal(acceptGenerated({ name: "Denver", lon: 40, lat: 0, story: "Outside the square." }, [], covers), false);
let asks = 0;
let inserts = 0;
const denied = await extendOnce({
  ask: async () => {
    asks += 1;
    return { name: "Denver", lon: 40, lat: 0, story: "Outside." };
  },
  taken: [],
  covers,
  insert: async () => { inserts += 1; },
});
assert.equal(asks, 2);
assert.deepEqual(denied, { ok: false });
assert.equal(inserts, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/extend-pool.test.ts`
Expected: FAIL with `acceptGenerated` not defined

- [ ] **Step 3: Implement `acceptGenerated` and `extendOnce`**

Accept only a non-empty name, finite coordinates, a non-empty story, a free `nameKey`, and a point `covers` accepts. `extendOnce` asks once, and if that candidate is rejected, asks one more time. Insert only an accepted candidate. Two rejects, or a null ask, returns `{ ok: false }` and inserts nothing. The server wrapper that calls `grok-4.5` belongs in this file but is not invoked by the test. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/extend-pool.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/extend-pool.ts src/game/extend-pool.test.ts package.json
git commit -m "Add a place only when it lands inside the region."
```

### Task 7: Satellite map

**Files:**
- Create: `src/map/imagery.ts`
- Create: `src/map/satellite-map.tsx`
- Test: `src/map/imagery.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `IMAGERY_TILES`, `IMAGERY_ATTRIBUTION`, `IMAGERY_NOTICE`, and `imageryView(mode: "flat" | "globe"): { tiles: string; attribution: string; projection: "mercator" | "globe" }`. `SatelliteMap` renders that view and, in flat mode, sets `maxBounds` to the region's bounding box.

- [ ] **Step 1: Write the failing test**

```ts
assert.equal(IMAGERY_TILES, "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
assert.equal(IMAGERY_ATTRIBUTION, "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community");
assert.match(IMAGERY_NOTICE, /imagery host sees the area on screen/i);
assert.equal(imageryView("flat").projection, "mercator");
assert.equal(imageryView("globe").projection, "globe");
assert.equal(imageryView("globe").tiles, IMAGERY_TILES);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/map/imagery.test.ts`
Expected: FAIL with `IMAGERY_TILES` not defined

- [ ] **Step 3: Add the imagery constants and the MapLibre view**

Install `maplibre-gl` with `npm install maplibre-gl`. Flat mode uses the mercator projection and locks the camera to the region bounds passed in. Globe mode uses the globe projection and the same tiles. Do not bundle tile images. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/map/imagery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/map/imagery.ts src/map/imagery.test.ts src/map/satellite-map.tsx package.json package-lock.json
git commit -m "Show live satellite imagery for a region and the globe."
```

### Task 8: Play shell

**Files:**
- Modify: `src/components/game-app.tsx`
- Create: `src/game/regions.ts`
- Test: `src/game/regions.test.ts`

**Interfaces:**
- Consumes: `startRun`, `dropPin`, `continueRun`, `resumeRun`, `shareText`, `radiusKm`, `SatelliteMap`, `IMAGERY_NOTICE`, `resolveNext`
- Produces: `STATES` (50 names and ids, no District of Columbia), `COUNTRIES` (the launch list, in that order), and `greaterSideKm(bounds: [number, number, number, number]): number`. The shell offers State, Country, and Globe, shows the place name before the pin, shows the story only after a hit, and shares the hit count.

- [ ] **Step 1: Write the failing test**

```ts
assert.equal(STATES.length, 50);
assert.equal(STATES.some((state) => state.id === "district-of-columbia"), false);
assert.equal(STATES.find((state) => state.name === "Nebraska")?.id, "nebraska");
assert.equal(COUNTRIES[0]?.id, "united-states");
assert.deepEqual(COUNTRIES.map((country) => country.name), [
  "United States", "Canada", "Mexico", "Brazil", "United Kingdom", "France",
  "Germany", "Italy", "Egypt", "India", "China", "Japan", "Australia",
]);
const latKm = 3 * 110.574;
const lonKm = 8.7 * 111.32 * Math.cos((41.5 * Math.PI) / 180);
assert.equal(greaterSideKm([-104, 40, -95.3, 43]), Math.max(latKm, lonKm));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/regions.test.ts`
Expected: FAIL with `STATES` not defined

- [ ] **Step 3: Add the region lists and point the shell at a run**

Ids are the lowercased name with spaces replaced by hyphens. `greaterSideKm` takes `[west, south, east, north]` in degrees. Latitude uses 110.574 km per degree. Longitude uses 111.32 km per degree times the cosine of the center latitude. The greater of those two sides is the result. Remove the Lincoln, Home Turf, and five-round score UI from `game-app.tsx`. Persist `Run` in session storage and restore it with `resumeRun`. The player picks a region, sees a name, pins on `SatelliteMap`, and on a hit sees the distance and the story. The notice from Task 7 is visible. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/regions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/regions.ts src/game/regions.test.ts src/components/game-app.tsx package.json
git commit -m "Play a state, a country, or the globe until a miss."
```

### Task 9: Starter catalogs

**Files:**
- Create: `src/game/starters.ts`
- Test: `src/game/starters.test.ts`

**Interfaces:**
- Consumes: `STATES` and `COUNTRIES` from `src/game/regions.ts`
- Produces: `STARTERS: { edition: "state" | "country" | "globe"; regionId: string; name: string; lon: number; lat: number; story: string; sourceLabel: string; sourceHref: string }[]`

- [ ] **Step 1: Write the failing test**

```ts
for (const state of STATES) {
  assert.ok(STARTERS.filter((place) => place.edition === "state" && place.regionId === state.id).length >= 5);
}
for (const country of COUNTRIES) {
  assert.ok(STARTERS.filter((place) => place.edition === "country" && place.regionId === country.id).length >= 5);
}
assert.ok(STARTERS.filter((place) => place.edition === "globe").length >= 12);
const stateNames = new Set(STATES.map((state) => state.name));
for (const place of STARTERS.filter((place) => place.edition === "country" && place.regionId === "united-states")) {
  assert.equal(stateNames.has(place.name), false);
}
for (const place of STARTERS) {
  assert.ok(place.story.length > 0);
  assert.ok(place.sourceHref.startsWith("https://"));
  assert.ok(Number.isFinite(place.lon) && Number.isFinite(place.lat));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/game/starters.test.ts`
Expected: FAIL with `STARTERS` not defined

- [ ] **Step 3: Author the starter places in `src/game/starters.ts`**

Meet the counts in the test. United States country places are country-scale features, not copies of the state names. Stories are two or three original sentences. Add the test to the `test` script.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/game/starters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/starters.ts src/game/starters.test.ts package.json
git commit -m "Seed every state, launch country, and the globe."
```
