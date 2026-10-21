# BRANCH_STATUS — docs/stale-cleanup-oct21 (docs cleanup)

**State: cleanup built + gated. NOT ready to merge — the full review
pipeline and the owner's merge word are still owed** (standing rule: the
panel approves the final tip itself).

Base: `origin/main cc23d30`. Docs/markdown only — 7 files (6 edited + this
one). No code, no tests, no deploy docs touched.

## Fixes (each verified against the code / current truth before editing)

1. **Handbook ch08 §5, item 4 — the React #418 story is closed now.**
   Before: #418 was cited as a live pre-existing failure "proven on
   unmodified main (2026-10-16)", in the same breath as the still-open
   tapstart family. After: the passage records that PR #179 (merged
   2026-10-20) fixed it for good — the index route is `ssr: false` with a
   shared `BootSplash` `pendingComponent`, so a hydration error today is
   a real regression, not background noise. Evidence: `src/routes/index.tsx`
   (`ssr: false`, `pendingComponent: BootSplash`, header comment naming
   the #418 fix); `src/components/boot-splash.tsx`.
2. **Handbook ch02 §13 — period moved outside a code literal.**
   `hint policy "one-per-round."` → `"one-per-round".` The policy string
   is `one-per-round` (no period in the value); the period belongs to the
   sentence. (Panel LOW nit, PR #184 round 3.)
3. **`scripts/clues/generation-prompt.md` — the daily model is gone.**
   Added a dated model-update note at the top (owner ruling 2026-10-06:
   *"1 mystery per day will kill the game"* — fully unlimited, shuffled
   deck across the 387 shipped clue files, no daily case / day key /
   weekly assembly) and fixed the author-voice fragments that still
   described the daily game: §1's "daily guessing edition… one mystery
   place per day", the "365 days" production math (annotated with the
   shipped 387 sets), "a 4-clue day" → "a 4-clue set", "the daily
   audience" → "the audience", "the published per-day file" → "the
   published clue file", "day scheme" → "dealing scheme". The
   clue-writing rules are untouched; daily-era wording inside quoted
   synthesis text is left as the historical record it is. Evidence:
   `src/game/loop/store.ts` (Fisher–Yates `shuffleIndexDeck`, deck
   reshuffles on exhaustion), `src/game/loop/LoopScreen.tsx` header
   ("unlimited era… daily-era archive"), 387 files counted in
   `public/loop/clues/`.
4. **Handbook ch05 — the fact ladder is now documented (§3).**
   Ch05 never mentioned it. New subsection: the four rungs (hook →
   wikitext → eb1911 → wikidata), the per-region build
   (`scripts/facts-ladder.mjs` → `src/game/data/geonames/facts/`,
   overlaid at load), fact-outranks-history precedence, and the per-band
   ceilings (5-7 hook, 8-10 wikitext, 11-13 wikidata). Evidence:
   `src/game/age-profile/types.ts` (`LadderRung`),
   `src/game/age-profile/rungs.ts` (`RUNG_ORDER`, `CEILING_INDEX`,
   `mapStory`), `scripts/card-compose.mjs` (fact → history → missing
   precedence).
5. **Handbook ch06 §4 — the Scout toggle exit is NOT "exactly like the
   Editions exit".** Rewrote the conflated parenthetical: both exits keep
   the *session score*, but the Editions exit only pauses the run (saved
   record kept → resumable) while the toggle **deletes** the run's saved
   record (`meridian.run`) — the game it ends is over for good.
   Evidence: `src/components/game-app.tsx` `handleManualMapMode`
   (`sessionStorage.removeItem(RUN_KEY)`, :1302) vs the Editions-exit
   comments (:1261 "the Editions exit deliberately keeps its record",
   :1887 session/score stays alive).
6. **Sweep find — handbook ch07 Sources descriptor.**
   "`docs/scout-offer-policy.md` — Scout offer rules" described a model
   that no longer exists. Updated to name what the file is now (Scout
   Map switching rules; offer-era name kept for link stability; the
   offer record is preserved inside, marked superseded). The policy doc
   itself is current (rewritten by PR #186) and was not touched.

## Sweep results (no further fixes)

- Period-inside-quotes on code literals, all of `docs/`: the §13 instance
  was the only one. Quoted player-facing copy keeps its periods — they
  are part of that copy, not sentence punctuation.
- Superseded models elsewhere: ch02 §13 already describes hints-on-by-
  default (post-#184); `docs/geodetective.md` already states "no daily
  puzzle"; `docs/scout-offer-policy.md` is current with its offer record
  labeled Superseded; dated ops run reports are point-in-time records
  and were left alone.

## Flagged, NOT fixed (owner-owed)

- **Crash-receiver deploy method conflict.** Repo docs prescribe
  `wrangler deploy` (`workers/crash-report/README.md`, handbook ch07
  record at :63, `docs/observability.md` :127-128) while a 2026-10
  record describes manual `version_upload`. Ground truth is being
  established by a parallel crew — the deploy docs are deliberately
  untouched here; the conflict stays open for the owner's one-line
  confirmation once that truth lands.
- **`src/lib/flags.ts` comments (~lines 43–51 + file header).** They
  describe the baked-in defaults / the `learningOutcomes` false state as
  "today's behavior", but production has run `learningOutcomes` ON since
  2026-10-04 (PR #45, remote `flags.json` flip) — the baked default is
  the fail-closed fallback, not today's behavior. The owner reserved
  this wording as his own call in the 2026-10-17 docs-refresh
  follow-ups; not edited (also outside this branch's docs-only scope).

## Gates

- `node scripts/lint-cards.mjs` — **GATE PASSED** (run at this tip).
- `git diff --stat origin/main` — 7 files, docs/markdown only (this
  file included); zero code files.
