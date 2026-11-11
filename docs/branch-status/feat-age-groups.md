# feat/age-groups

**Task:** Move `src/game/age-profile` from `5-7` / `8-10` / `11-13` to
`7-10` / `10-18` / `18+`, migrate stored profiles, and export contract I3
`getAgeGroup()`.

**Scope:** `src/game/age-profile/**` and this file. The integrator owns
every other file that still names the old ids.

**Status:** Owner go received 2026-11-10. Age-profile code is on the
branch. Draft PR 393. Not merged.

**Owner calls used:**

- Labels: "Ages 7-10", "Ages 10-18", "Ages 18+".
- Parent description and what-changes lines stay `TODO(owner)`.
- 7-10 loops are the previous 8-10 list. GeoDetective, Capital Quest, and
  Expedition Trails are on. Duel is off. Rung ceiling is wikitext. Hints
  are free.
- 10-18 keeps the previous 11-13 difficulty row (tolerance 1.0, 1 starting
  clue, guess cap 5, 12 quiz questions, 8 terrain images, 12 capital
  questions, 12 pins, 60s duel). Hints are one-per-round.
- 18+ uses that same row. Source comment: not yet tuned for adults. Hints
  are none. `ageMax` is null. Migration never writes 18+.

**Assumption:** the owner named the 7-10 loop list and the wikitext
ceiling, and did not name a new numeric row. 7-10 therefore keeps the
previous 8-10 numbers, button audio, standard map labels, and rounded
distance. No band uses autoplay.

**Done:**

- `validateProfile` maps schema 1 before any version reject: `5-7` and
  `8-10` to `7-10`, `11-13` to `10-18`. `changeCount` and `updatedAt` are
  copied. The load writes schema 2. It does not call `setBand` or
  `saveBand`, and it does not emit a change event.
- `FULL_ACCESS_BAND` is `10-18`. Unset stays unset. `getAgeGroup()` takes
  no argument.
- `isBandRunConfig` still accepts snapshot bands `5-7`, `8-10`, and
  `11-13`, so `meridian.loop.v2` streaks are not fail-closed.
- No exact age and no birth date.

**Checks:**

- `node --experimental-strip-types --test src/game/age-profile/` — 69
  pass, 0 fail.
- `npx tsc --noEmit` — FAIL. No error inside `src/game/age-profile/`.
  Outside files, left for the integrator:
  - `src/components/age-profile/age-profile-settings-toast.test.ts`
  - `src/components/game-app.tsx`
  - `src/game/coldtrail/edge.test.ts`
  - `src/game/coldtrail/themes.test.ts`
  - `src/game/coldtrail/themes.ts`
  - `src/game/generated-places.ts`
  - `src/game/loop/LoopScreen.tsx`
  - `src/game/loop/store.test.ts`
  - `src/game/passport/badges.test.ts`
  - `src/game/passport/badges.ts`
  - `src/game/run-config-snapshot.test.ts`
  - `src/game/story-card-coverage.test.ts`
- `AgePicker.tsx` and `AgeProfileSettings.tsx` did not fail typecheck.
  `18+` has no ceiling, so their `Ages {ageMin}–{ageMax}` line can still
  print an empty top until the integrator edits them.
- lint-cards, production build, and Playwright were not run.

**Open:**

- Owner words for the three descriptions and what-changes lines.
- Integrator edits for the typecheck list above, plus the two picker files.
- Panel review of the final tip, then the owner's merge word. This branch
  stays open.
