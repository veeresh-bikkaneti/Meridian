# Learning outcomes — design (Phase 1)

**Status:** design doc; Phase 2 prototype implemented on `feat/learning-outcomes`
behind the `learningOutcomes` flag (default `false`) — see `src/game/learning.ts`,
the hook in `onConfirm()` (`src/components/game-app.tsx`), and the growth
surfaces (`ResultCard` growth line, `RunSummaryCard` "My growth" section).
Decisions marked `[DECISION — Veeresh to rule]` were built at this doc's
recommendations (coordinator directive, 2026-10-03); Veeresh's rulings may
revise them.
**Branch:** `feat/learning-outcomes` · **flag:** `learningOutcomes` (ships dark, default `false`).

> **Product philosophy (Veeresh, 2026-10-03):** "user experience, user engagement,
> and learning outcomes — not just the game. Our users are players who want to
> learn and grow."

A player "grows" when: they remember a place they previously missed
(retention), their pin error shrinks on re-encounter, their accuracy climbs
within a region, and they keep coming back (engagement as learning's vehicle).
The measurement must serve the player too: the visible "growth" surface is
itself a motivator — this is designed as a **feature**, not a dashboard.

---

## 1. The answer event (what exists today)

An "answer event" is a **pin commit**: the moment the player confirms a pin in
`src/components/game-app.tsx`, `onConfirm()` (~line 1403):

1. Computes `distance` (km, player pin → true location) and `hit`
   (`isHit(distance, radius)` in `src/game/radius.ts`).
2. Scores on a hit only (`scorePlace` in `src/game/scoring.ts`; miss → `null`).
3. Calls `dropPin(run, distance, radius, scored)` — pure; appends exactly one
   `PlaceResult` (`distanceKm`, `hit`, `score`, `scoringVersion`,
   `breakdown`, `streakBefore`) to `run.results`.
4. In the `if (nextRun.results.length > bankedBefore)` block, banks it into the
   session via `bankPlace(session, …)` (`src/game/session.ts`).

**Hook point for the learning record:** step 4's block. At that point
`place.id`, `place.name`, `run.edition` (`"globe" | "country" | "state"`),
`run.regionId`, `run.regionName`, `distance`, `hit`, `scored?.score`,
and the hit-test `radius` are all in scope. Phase 2 adds one independent,
fail-closed call here — e.g. `recordAnswer(learningStore, {placeId, regionId,
regionName, edition, distanceKm, radiusKm, hit, score, atMs, dateKey})` —
**alongside** `bankPlace`, never inside `dropPin`/`bankPlace`.

No backfill: stored `run.results` are session-scoped (sessionStorage) and
scoring-version-pinned; learning records begin the moment the flag turns on.
There is no honest way to reconstruct per-attempt radii from old runs.

---

## 2. Metrics

All metrics are pure functions over the per-place records (§4) plus the
`daysPlayed` list. Nothing touches dealing, scoring, sessions, or cards.

### M1 — Retention rate

- **Definition:** among places you missed at first sight and then saw again,
  the share where you did better on the re-encounter.
- **Formula:** `R = improved / reEncountered`, where
  - `reEncountered` = places with ≥2 attempts in the trailing 28-day window
    whose first recorded attempt was a miss;
  - `improved` = of those, places where the latest re-encounter attempt was a
    **hit**, or a miss with `distanceKm ≤ 0.75 ×` first-attempt distance.
- **Why it measures learning:** it is Veeresh's growth criterion verbatim —
  "they remember a place they previously missed". A rising R means misses are
  turning into knowledge, not repeating.
- **[DECISION — Veeresh to rule]:** 28-day window; 0.75 improvement threshold;
  improvement counts hit-after-miss *or* miss-with-shrinking-error. Recommend
  keeping miss→closer-miss in the numerator — learning is a slope, not a
  binary — but Veeresh may rule "hit only".

### M2 — Mastery (see §3)

### M3 — Error trend (per region, over time)

- **Definition:** whether the player's pins are landing closer to the true
  location in each region they play.
- **Formula:** per region, the **median** `distanceKm` over attempts in the
  trailing 7 days vs the trailing 28 days, expressed as a percentage change:
  `trend = (median28 − median7) / median28`. Positive = getting closer.
  Only reported for regions with ≥5 attempts in each window.
- **Why it measures learning:** median pin error is the most direct
  observable of spatial memory ("their pin error shrinks on re-encounter",
  "their accuracy climbs within a region"). Median, not mean — one wild
  globe-edition miss must not move the needle.
- **[DECISION — Veeresh to rule]:** 7/28-day windows, ≥5-attempt minimum,
  median over mean. Recommend as stated (robust, explainable).

### M4 — Engagement (learning's vehicle)

- **Definition:** the player keeps coming back.
- **Formulas:**
  - `daysPlayed7` / `daysPlayed28` = distinct calendar days with ≥1 answer
    event (from the `daysPlayed` list, `YYYY-MM-DD` keys — same format as
    the app's existing `dateKey`).
  - `dayStreak` = consecutive calendar days played ending today/yesterday
    (yesterday counts so a player who hasn't played *yet* today doesn't see
    a broken streak at breakfast).
  - `places7` = answer events in the trailing 7 days.
- **Why it measures learning:** retention-of-knowledge is impossible without
  return visits; the day streak is the behavioral proxy for "players who want
  to learn and grow". It is explicitly *not* the hit streak (that's a game
  mechanic); the UI calls it a **day streak** so the two are never confused.
- **[DECISION — Veeresh to rule]:** "consecutive days ending today/yesterday"
  rule for `dayStreak`; recommend as stated (forgiving, kid-friendly).

---

## 3. Mastery rule (precise, computable)

Three states, derived on read — never stored (attempts are the single source
of truth):

- **Explored:** the place has ≥1 recorded attempt.
- **Mastered:** the player's **two most recent attempts are both hits**, and
  the latest attempt is **confident**: `distanceKm ≤ 0.5 × radiusKm`
  (the hit radius that attempt was judged against — recorded at commit time,
  since the radius differs by edition).
- **Growing:** ≥2 attempts, not mastered, and the latest error is smaller
  than the first (`latest.distanceKm < first.distanceKm`). Otherwise:
  still exploring.

Why this shape: one hit can be luck; two hits in a row shows recall; the
confidence half-radius bar shows *precision*, not just a lucky edge-of-ring
graze. "Growing" makes partial progress visible — the slope matters more
than the binary for a kid.

- **[DECISION — Veeresh to rule]:** (a) 2-in-a-row + 50%-radius confidence —
  recommend as stated. Alternatives: 2-in-a-row regardless of distance
  (simpler, weaker); 3-in-a-row (slower to award, more grindy); a single
  confident hit (fastest, luck-prone).
- **[DECISION — Veeresh to rule]:** "Growing" as a named state at all —
  recommend yes; it is the encouragement state between first miss and mastery.

---

## 4. Per-place learning record data model

### 4.1 TypeScript shape (Phase 2 implements in `src/game/learning.ts`)

```ts
/** One pin commit, recorded at the answer-event hook (§1). */
export type LearningAttempt = {
  /** Epoch ms of the commit. */
  at: number;
  /** Pin inside the hit radius? */
  hit: boolean;
  /** Player pin → true location, km. */
  distanceKm: number;
  /** Hit radius the attempt was judged against (edition-dependent). */
  radiusKm: number;
  edition: "globe" | "country" | "state";
  regionId: string;
  /** Points earned (0 on a miss); stored for analysis only, never re-scored. */
  score: number;
};

export type LearningRecord = {
  /** Schema version of this record payload. */
  v: 1;
  placeId: string;
  /** Oldest-first, capped at MAX_ATTEMPTS_PER_PLACE. */
  attempts: LearningAttempt[];
};

/** Whole learning store: one JSON document, one localStorage key. */
export type LearningStore = {
  /** Schema version of the store document. */
  v: 1;
  /** Keyed by placeId. Capped at MAX_PLACE_RECORDS (LRU). */
  records: Record<string, LearningRecord>;
  /** Last-write-wins regionId → regionName for trend labels. */
  regionNames: Record<string, string>;
  /** YYYY-MM-DD keys, capped at the last 90 days. */
  daysPlayed: string[];
};
```

### 4.2 Storage keys

- `meridian:learning:v1` — the store document above (follows the existing
  `meridian:seen:v2:<edition>:<region>` prefix convention from
  `src/game/trail.ts`).
- Single document, not per-place keys: one read at boot, one write per
  answer event. Field names stay readable (codebase convention, e.g.
  `session.ts`) rather than minified.

### 4.3 Caps and eviction (storage budget)

There are **124,690 places** in the catalog; records must be capped.

- `MAX_PLACE_RECORDS = 1000` place records.
- `MAX_ATTEMPTS_PER_PLACE = 8` attempts per record (oldest dropped first).
- `daysPlayed` capped at the last 90 date keys.

**Budget:** worst case ≈ 1000 records × (8 attempts × ~130 B + overhead)
≈ **1.5 MB** — well inside localStorage's ~5 MB, with headroom for the
existing `meridian:seen:v2:*` no-repeat history and AI caches. Worst-case
write cost per answer event is one `JSON.stringify` of ≤1.5 MB (single-digit
ms); fail-closed `try/catch` on every write, exactly like `writeSession`.

**Eviction policy: LRU.** When recording a new place would exceed the cap,
drop the record whose last attempt is oldest. Pure LRU — no "protected"
records — so behavior is predictable and reviewable.

- **[DECISION — Veeresh to rule]:** 1000 places / 8 attempts / pure LRU.
  Recommend as stated. Raising the cap buys mostly noise (players re-see
  <1000 distinct places in any realistic window); LRU keeps the store
  proportional to *current* play.

### 4.4 Schema versioning / migration

- `v` at both store and record level. `readLearningStore()` is fail-closed:
  any malformed payload → `null` → fresh empty store; the app never breaks
  on bad learning data (same contract as `readSession` in `session.ts`).
- Future versions: `migrateLearningStore(raw)` runs once at read time,
  version-to-version (`v1 → v2` …), writes back only after a successful
  migration. Old keys are left in place until migration succeeds; a failed
  migration keeps the old store untouched.
- New keys on version bump (`meridian:learning:v2`), never in-place format
  changes under the same key.

---

## 5. Player-facing growth concept

**The growth surface is a feature, not a dashboard.** Phase 2 scope is
deliberately small: a one-line growth note on the reveal card + a "My growth"
section on the end-of-game summary. No leaderboards, no XP levels, no
loss-streak callouts — ever.

### 5.1 Where it lives

| Surface | Content | Gate |
|---|---|---|
| Result card reveal (`ResultCard`, story phase) | One kid-friendly growth line under the story (§5.2) | flag on |
| End-of-game summary ("My growth" section) | Places explored · places mastered · day streak · regional error-trend note | flag on |
| Home/menu | Nothing in Phase 2 (defer until signals are validated) | — |

Rules for the reveal line: it **never replaces** the kid-friendly blurb (that
shows on every reveal, right or wrong — Veeresh's standing rule); it sits
*below* it, small. It never names distances in a shaming way.

### 5.2 Copy bank (kid-friendly; encouragement + growth language)

Every word below is a **[DECISION — Veeresh to rule]** — tone is his call.
Recommendations follow his growth framing.

- First encounter, hit: **"Great first try!"**
- First encounter, miss: **"Good try — you'll get this one."**
- Re-encounter, improved (hit after miss, or closer): **"Closer than last
  time — you're learning!"**
- Re-encounter, hit after a past miss: **"You remembered it! Nice work."**
- Newly mastered: **"Mastered! You really know this place."**
- Re-encounter, not improved: **"Tricky one — let's try it again later."**
  (never shaming; the game moves on)
- Summary section header: **"My growth"**
- Summary rows: **"Places explored: 24"** · **"Places mastered: 5"** ·
  **"Day streak: 3 — come back tomorrow to keep growing!"** ·
  **"Your pins are landing closer in Texas!"** (only when M3 trend is
  positive for a region with enough data)

Banned tone (never ships): "crushed it", "destroyed", "noob", "pro/god-tier",
"dominated", any comparison to other players, any mockery of a miss.

---

## 6. Privacy — stated as a guarantee

1. **Client-side only.** Records live in `localStorage` on the player's
   device. No backend, no analytics vendor, no new dependency, no network
   call carries learning data — ever.
2. **No exfiltration.** The learning module performs zero `fetch`/XHR/
   beacon; share-text, export, and clipboard paths never include learning
   records. (Share output is the existing three-line share — unchanged.)
3. **Flag-off means zero trace.** With `learningOutcomes` off, the record
   hook is never called: no reads, no writes, no `meridian:learning:v1` key
   created.
4. **Player control = device control.** Clearing site data deletes everything;
   there is nothing server-side to request or delete.
5. Honest scope note: `localStorage` is same-origin storage — any script on
   the Meridian page origin could read it. Mitigation is architectural: zero
   new dependencies and no third-party scripts on the page (the flag doc's
   standing rule), so nothing new can observe the store.

---

## 7. Non-interference contract

The learning record is **observational**. Phase 2 must prove each of these
with tests; violation is a merge-blocker:

1. **Dealing:** the learning module never reads or writes the
   `meridian:seen:v2:*` no-repeat history; the dealer never consults learning
   records. Dealt order with the flag on is byte-identical to flag off.
2. **Scoring:** `dropPin` / `scorePlace` / `bankPlace` are untouched. Recorded
   `score` values are never re-fed into any scoring path.
3. **Session logic:** the record hook runs *beside* `bankPlace` in
   `onConfirm`, in its own `try/catch` — a storage failure can never throw
   into the pin-commit path or corrupt the session.
4. **Card content:** records carry no `story`/`history`/`fact` fields and
   never alter card rendering or the card lint gate.
5. **Read path:** the store is read once at boot (gated, §8); the game loop
   never waits on it. Flag off ⇒ no reads at all.

---

## 8. Flag plan (follows `docs/feature-flags.md` exactly)

1. **Register:** add `"learningOutcomes"` to the `FlagName` union in
   `src/lib/flags.ts` and to `FLAG_DEFAULTS` with **`false`** — the default
   MUST equal current production behavior (no records, no growth UI), per the
   reviewer rule. Off = safe fallback: today's app, byte-identical.
2. **Gate before initialization:** this is a kill-switch-style track, not a
   pure UI toggle (it writes persistent data). At app boot, one effect awaits
   the shared `loadFlags()` promise (the `__root.tsx` pattern), then caches
   `learningEnabled = isEnabled("learningOutcomes")` as the session's
   authoritative value — boot-time, not reactive; no mid-game surprises.
   Both the record hook (write path) and the growth surfaces (read path)
   consult that cached value only.
3. **Set the value:** `"learningOutcomes": false` in `public/flags.json`
   (ships dark; flipping it on later is a static deploy, no client release).
4. **Test both positions:** unit tests for the learning module
   (on/off/unknown/bad payload, fail-closed reads) following
   `src/lib/flags.test.ts`; an E2E spec following
   `tests/e2e/feature-flags.spec.ts` proving — flag off: no
   `meridian:learning:v1` key is created and no growth UI renders; flag on:
   records are written per answer event and the growth line/summary appear;
   unreachable `flags.json`: baked-in default (`false`) wins silently.

Remote-off semantics: turning the flag off stops new records and hides all
growth surfaces; existing records sit inert in `localStorage` (data, not
behavior — no deletion required to make the app safe).

---

## 9. Decisions for Veeresh (all marked in-line above; consolidated)

| # | Decision | Recommendation | Reasoning |
|---|---|---|---|
| 1 | Mastery rule | 2 most-recent hits + latest within 50% of its hit radius | One hit can be luck; two shows recall; half-radius shows precision, not a graze |
| 2 | "Growing" as a named state | Yes | The slope matters more than the binary for a kid; encouragement between first miss and mastery |
| 3 | Retention window / improvement bar | 28 days; hit-after-miss *or* miss with ≤0.75× first distance | Counts learning as a slope; 28 days is a real habit window |
| 4 | Error-trend windows / statistic | 7-day vs 28-day median, ≥5 attempts/region | Median is robust to one wild miss; minimums keep the note honest |
| 5 | Day-streak rule | Consecutive days ending today/yesterday | Forgiving; a kid checking at breakfast shouldn't see a broken streak |
| 6 | Storage caps + eviction | 1000 places / 8 attempts / pure LRU | ~1.5 MB worst case; LRU is predictable; players re-see <1000 distinct places |
| 7 | Single-doc key `meridian:learning:v1`, readable field names | As specified | One read/write per answer; readable names match codebase convention |
| 8 | No backfill from old runs | Yes — records start at flag-on | Old runs lack per-attempt radii; reconstruction would be fabrication |
| 9 | Phase 2 growth UI scope | Reveal-card line + summary section only | Smallest surface that proves the signals; home-screen chip deferred |
| 10 | Copy bank wording | As in §5.2 | Encouragement + growth language; zero gamer bravado |
| 11 | Day streak vs hit streak naming | "Day streak", explicitly distinct | The hit streak is a game mechanic; conflating them teaches the wrong thing |

---

## 10. Honest limits (known before we build)

- **Re-encounters are rare by design.** The no-repeat dealer deals each place
  once per cycle; retention signals accumulate *across cycles*. Small regions
  (e.g. a state pool) cycle fast and will show retention quickly; the
  124k-place globe pool will show it slowly. Phase 2 validates the plumbing
  and the signals — not fast statistics.
- **Records are device-local.** A player on two devices has two learning
  histories. Merging is out of scope (no backend, by guarantee).
- **The flag is the experiment.** Until Veeresh rules on the decisions above
  and flips `learningOutcomes`, nothing here touches production behavior.

---

## 11. Misses-review deck (game-review improvement #1, built 2026-10-05)

**Status:** implemented on `feat/misses-review-deck` behind the
`learningOutcomes` flag (the deck only populates while the flag is on).
Module: `src/game/review-deck.ts` (+ `review-deck.test.ts`); integration in
`src/components/game-app.tsx` (`Play`/`PlayLoaded`) and
`src/components/run-summary.tsx`.

**Concept.** The reveal's growth line ("Good try — you'll get this one")
opens a learning loop; the deck closes it by dealing missed places back as
a flashcard-style review round. Spaced repetition, Leitner-lite: a fresh
miss is due immediately; each successful review pushes the card out along
[0, 1, 3, 7, 14, 30] days; a miss resets the streak to due-now; a newly
mastered place (§3) leaves the deck.

**Data model.** The deck does NOT duplicate learning records — attempts and
mastery stay the single source of truth in `src/game/learning.ts`. It adds
only what records can't carry, in `meridian:review-deck:v1` (localStorage,
fail-closed like learning.ts):
- a per-card **question-context snapshot** taken at miss time (coords,
  story, original edition/region, hit radius, map mode, region bounds), so
  a review card replays the exact original question with no chunk fetch;
- **scheduling state** (`streak`, `nextDueAt`, `lastReviewedAt`, `reviews`).
Capped at 60 cards (least-urgent evicted); malformed entries dropped.
No backfill: misses from before this feature have learning records but no
snapshots, so the deck grows from new misses only — the empty state says
so honestly ("Miss a place and it'll land here for review.").

**Game-loop integration.** A review session is a synthetic `Run`
(`regionId "review-deck"`, typed edition `"globe"`) through the existing
`PlayLoaded` loop — no forked map/reveal code. The due queue (due order)
is the pool. Review answers record into learning records with the card's
**original** edition/region (metrics stay truthful) but never bank into
the session — review is practice, not scoring. The cleared-mode
celebration never fires in review; the no-repeat history of real regions
is never consulted. A reload mid-review fails closed to the picker (the
deck is the durable state; the queue rebuilds fresh each start).

**Entry points (invitations, never gates).** A "Review my misses" banner on
the edition picker (due count + Start review; "all caught up" / "miss a
place and it'll land here" empty states) and a "Review my misses (N)"
button in the end-game "My growth" section. The session ends on a
bounded, completable review-complete screen ("You remembered X of Y").

**Non-interference.** Every review branch is guarded by
`isReviewRun(run)`; normal play is byte-identical with the flag off, and
the deck adds no network, no backend, nothing leaving the device.
