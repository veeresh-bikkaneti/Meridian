# COUNCIL CONSENSUS MANIFEST — age groups

**Branch:** `feat/age-groups` · **Base:** `b8ab5bfe` (`origin/main` at session start)
**Status:** manifest only. Code is stopped until the owner says go.
**Execution token:** withheld. Do not start TDD until that word.

This is the Tier 2 manifest for moving the live age bands onto owner ruling D1
(standard §1). It is not a subject spec. No unit, fact, or difficulty number
is added here. Educator sign-off is not claimed; subject content stays GATED
(`docs/scaling/educator-gate-rubric.md`).

## 1. ATDD acceptance scenarios

Observable behaviour only. Tests are not written in this change.

- **Happy path.** Given a device whose stored profile is schemaVersion 1,
  status active, band `8-10`, changeCount 4. When the profile loads after
  the migration. Then the profile is active, band `7-10`, changeCount still
  4, and `getAgeGroup()` returns `7-10`. The same load maps `5-7` to `7-10`
  and `11-13` to `10-18`.
- **Unset stays a choice not yet made.** Given no profile, or status unset
  with band null. When the game asks the group. Then `getAgeGroup()` returns
  `10-18` (today's full game, via `FULL_ACCESS_BAND`). Nothing writes `18+`.
- **Reject corrupt.** Given a blob that is not JSON, or a band id that is
  neither a legacy id nor a new group id. When it loads. Then the profile
  is unset, and stored review-deck, learning, and badge records are not
  deleted.
- **No exact age.** Given the grown-up band picker. When a parent looks at
  it. Then it offers three group cards and no field for a birth date or a
  single age. A child who is 10 can be placed on either neighboring card
  (standard §1). The game never asks which.
- **Legacy mystery snapshot.** Given `meridian.loop.v2` whose current deal
  snapshot still says band `11-13`. When that blob is read. Then the streak
  and the deal remain. The snapshot is not fail-closed to a fresh store.

## 2. TDD test specification

Not started. Predicted RED, after the owner says go, in
`src/game/age-profile/store.test.ts`:

- A v1 active blob `{ band: "5-7", changeCount: 2 }` loads as band `7-10`
  with changeCount 2. Before the migration, the same assertion fails
  because the loaded band is still `5-7`.
- A v1 active blob `{ band: "11-13" }` loads as `10-18`, not unset.
  Today's `validateProfile` returns null when `schemaVersion` is not 1
  (`store.ts`), and `loadProfile` turns null into unset. A version bump
  that does not rewrite the band inside `validateProfile` fails this test
  by returning the full-access group instead of `10-18` for a `5-7` child,
  or by dropping the stored choice.
- `getAgeGroup()` is exported from `src/game/age-profile/index.ts`, takes
  no argument, and returns `AgeGroup`.

Target functions, when code is allowed: `validateProfile`, `resolveBand`,
`isBandRunConfig`, `AGE_BAND_IDS`, `FULL_ACCESS_BAND`, and a new
`getAgeGroup` on the facade. No production skeleton in this commit.

## 3. Scope boundary

**This manifest permits, only after the owner's go:**

- `src/game/age-profile/**`

**Protected. This branch does not edit them.** Files below import the band
ids or branch on `5-7` / `8-10` / `11-13`. The integrator changes them.
Count of those files: 23 under `src/` and `tests/`, plus two picker files
that will mis-draw `18+` even though they do not pin the old ids.

Source that branches on the old ids:

- `src/assets/home-v5/card-media.ts` — film choice is `=== "5-7"` or
  `=== "8-10"`. A new id still typechecks and silently gets the standard film.
- `src/game/coldtrail/themes.ts` — `THEMES` is `Record<AgeBandId, …>` keyed
  by the old ids.
- `src/game/generated-places.ts` — `storyForBand` shortens the story only
  when `band === "5-7"`.
- `src/game/loop/LoopScreen.tsx` — `geodetectiveConfig("8-10")` and a
  hint-policy fallback of `"11-13"`.
- `src/game/passport/badges.ts` — Clean Round is awarded only for `"11-13"`.
  Stored badge rows have no band, so earned badges stay. Future awards for
  a mapped `10-18` player stop until this file moves with the id.

Unit tests that pin the old ids:

- `src/assets/home-v5/card-media-band-variants.test.ts`
- `src/components/age-profile/age-profile-settings-toast.test.ts`
- `src/game/coldtrail/edge.test.ts`
- `src/game/coldtrail/themes.test.ts`
- `src/game/loop/store.test.ts`
- `src/game/passport/badges.test.ts`
- `src/game/run-config-snapshot.test.ts`
- `src/game/story-card-coverage.test.ts`

E2E that seeds or asserts the old ids or the old toast copy:

- `tests/e2e/age-profile-gate.desktop.spec.ts`
- `tests/e2e/band-film-error-path.desktop.spec.ts`
- `tests/e2e/band-media-variants.desktop.spec.ts`
- `tests/e2e/band-switch-in-session.desktop.spec.ts`
- `tests/e2e/clean-round-badge.spec.ts`
- `tests/e2e/friend-challenge.desktop.spec.ts`
- `tests/e2e/geodetective-hint.spec.ts`
- `tests/e2e/hint-button.spec.ts`
- `tests/e2e/qa-evidence.spec.ts`
- `tests/e2e/read-aloud-always.spec.ts`

Picker display, not in the 23, still needs the integrator before `18+`
can be shown. `AgeBand.ageMax` is a number today. `18+` has no ceiling,
and this branch will not invent one.

- `src/components/age-profile/AgePicker.tsx` — cards, not a number field.
  The line is `Ages {ageMin}–{ageMax}`.
- `src/components/age-profile/AgeProfileSettings.tsx` — same range in the
  confirm name.

`src/game/loop/store.ts` reads `isBandRunConfig` but does not need an edit
if that guard, which this branch owns, keeps accepting a snapshot whose
band is `5-7`, `8-10`, or `11-13`. Rejecting those ids fail-closes
`meridian.loop.v2` and wipes the streak. Deal numbers on the snapshot stay
as stored.

Also protected: `src/game/data/**`, `package-lock.json`, `.scratch/`,
other branches' worktrees, `docs/scaling/contracts.md` (I3 already states
the shape; a change to it is the integrator's), root `BRANCH_STATUS.md`.

## 4. What the code will do, once the owner says go

Contract I3 (`docs/scaling/contracts.md`):

```ts
export type AgeGroup = "7-10" | "10-18" | "18+";
export function getAgeGroup(): AgeGroup;  // from src/game/age-profile/
```

`AgeBandId` becomes those three strings. `AgeGroup` is that type, exported
from `src/game/age-profile/index.ts`. `getAgeGroup()` reads `resolveBand()`
and returns it. It takes no age, no birth date, and no argument.

**Stored profile** (`meridian.ageProfile.v1`, owned by `store.ts`):

| Stored band | After load |
|---|---|
| `5-7` | `7-10` |
| `8-10` | `7-10` |
| `11-13` | `10-18` |
| unset, band null | unset. `getAgeGroup()` returns `10-18` |
| anything else, or corrupt JSON | unset, as today |

`validateProfile` accepts schemaVersion 1, maps the band, and the write
that follows stores schemaVersion 2. `changeCount` and `updatedAt` are
copied, not incremented. A legacy `pending-change` still becomes active,
then maps. The map does not call `setBand` or `saveBand`. Migration never
writes `18+`. `18+` exists only after a parent picks that card.

`FULL_ACCESS_BAND` moves from `11-13` to `10-18`. That is today's full
game (never restrict by default). It is not adult copy the household did
not choose.

Review deck (`meridian:review-deck:v1`) and learning scores
(`meridian:learning:v1`) do not store a band. Badge rows store id and time
only. Those records are not rewritten.

**Copy.** `label`, `description`, and `whatChanges` are owner copy,
approved 2026-11-10. Change them only with the owner's yes.

- **Ages 7-10:** "Stories to read or hear, mysteries to solve, capitals to find." / "📖 Read or listen · mysteries · free hints"
- **Ages 10-18:** "The full game: every story, every mystery, head-to-head duels." / "🗺️ The whole game · one hint per round"
- **Ages 18+:** "The full game with no hints." / "🗺️ The whole game · no hints"

The old names (Little Explorer, Trail Scout, GeoDetective) belonged to the
old bands. They are not reused as the new labels.

**Left for the owner to confirm before any code.** Choosing one side
changes what a child sees. This manifest does not pick.

- `7-10` loop list. `5-7` locks GeoDetective, Capital Quest, Expedition
  Trails, and Duel. `8-10` unlocks the first three and still locks Duel.
  Keeping the `5-7` locks takes three loops away from an `8-10` player.
  Keeping the `8-10` list gives those three loops to a `5-7` player. Duel
  stays off `7-10` either way: both source bands lock it, and standard §1
  and §6 forbid timers in `7-10`.
- Rung ceiling. `5-7` stops at hook. `8-10` may reach wikitext. Standard
  §1's "first rungs" points at hook. Using hook takes wikitext away from
  a former `8-10` player.
- Hint policy. `5-7` is `free`, `8-10` is `one-per-round`, `11-13` is
  `none`. Copying either merged side is an owner decision.
- Numeric difficulty (tolerance, clue counts, question counts). Not
  invented. Marked TO CONFIRM. `10-18` may keep the current `11-13` row
  only if the owner says the row is unchanged.
- `18+` difficulty row. TO CONFIRM. Do not copy the `11-13` row and call
  it the adult tier.
- `18+` display ceiling. No number is invented. The picker files above
  need an integrator edit so the card does not print a fake top age.

**Already fixed by the ruling, not re-opened here.** Groups are `7-10`,
`10-18`, `18+`. Nothing is built for under-7s. No algebra or trigonometry
in `7-10` (standard §0, subject-progression map). That constraint is for
the subject streams that call `getAgeGroup()`. This branch does not add
those units. Free for everyone: no ads, payments, or revenue features.
Full, Lite, and Flat motion tiers are unchanged by this manifest and, when
a later unit ships, teach the same thing (standard §5.2).

## 5. Epistemic baseline

- Owner ruling D1, quoted in standard §1 (2026-11-10): the three groups,
  and "this will accommodate all people."
- Standard §1 also states the merge: `5-7` and `8-10` into `7-10`, `11-13`
  widened to `10-18`, add `18+`, migrate stored profiles, owner names the
  labels. A 10-year-old picks either neighboring group. Never an exact age.
- Contract I3 gives the `AgeGroup` union and the same legacy map.
- `store.ts` on `b8ab5bfe`: wrong `schemaVersion` returns null; null loads
  as unset; unset resolves through `FULL_ACCESS_BAND`.
- No new external fact. No count is asserted. Difficulty figures stay
  TO CONFIRM.
- Confidence: High on the id map and on `getAgeGroup()`'s shape. Low on
  loop list, rung ceiling, hint policy, and the `18+` difficulty row,
  because those are the open owner calls above.

## 6. Arbiter

- **Chair:** the manifest is the plan. Code is not approved.
- **Architect:** map inside `validateProfile` before any version reject;
  `FULL_ACCESS_BAND` is `10-18`; `isBandRunConfig` must still accept the
  three legacy snapshot ids. Adopted.
- **Skeptic, carried verbatim:** "The loop merge is a gain, and standard
  §1 does not force it." Also: a schema bump without an in-function
  rewrite drops a `5-7` player onto full access; rung ceiling and hint
  policy are unstated choices; files outside `src/game/age-profile/`
  do not survive an id swap untouched. Adopted as the open items and the
  integrator list. The schema hole is a binding constraint on the future
  patch, not a licence to write it now.
- **Census:** 23 files under `src/` and `tests/` pin the old ids. Adopted
  as the list in §3.
- **Educator seat:** vacant. No persona signs the rubric. Not required for
  this id-migration plan. Required before any new learning item ships.
- **Unresolved, owner:** the confirmations in §4, plus the words for the
  three labels and the parent-facing lines. One go can approve the plan
  and those words together. Until then, no code.

## 7. K-12 checklist (standard §9)

This plan has no unit, so the learning rows are open on purpose.

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): N/A on this manifest. No unit is opened.
- Headline goal (§0): N/A. No bridge or application is added.
- Use-it-elsewhere round: N/A. Subject streams own it. 7-10 stays free of algebra and trigonometry (map + §0).
- Bands served: 7-10, 10-18, 18+ (standard §1). Why: owner ruling D1.
- Objective per item: N/A. No item.
- Standards cited: N/A. No fact taught.
- Loop mapped: N/A.
- Mastery bar: N/A. Stored mastery is not rewritten.
- Review-deck hookup: records stay. They are not keyed by band.
- Post-clip retrieval: N/A.
- Motion tiers: unchanged. Full / Lite / Flat still teach the same thing when a unit exists (§5.2).
- Accessibility: no new control. Picker stays three cards, targets already on the card. No timer is added to 7-10 (§6).
- Privacy: no exact age, no birth date, no new field. Profile stays on the device (§7).
- Content screen (§7a): no new topic.
- Free: no revenue feature.
- Educator rubric: not signed. Content remains GATED.
```
