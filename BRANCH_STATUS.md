# BRANCH_STATUS — docs/stale-cleanup-oct21 (docs cleanup)

**State: panel round 2 returned NOT READY (BLOCK ×2 — Frontend,
Office Hours — DevEx FAIL); cure round 2 below addresses every
item. NOT ready to merge — a rule-13 re-vote (round 3) on the cured
tip and the owner's merge word are still owed** (standing rule:
the panel approves the final tip itself).

Base: `origin/main cc23d30`. Docs/markdown only — 10 files. No code,
no tests.

## Panel verdict (round 1, on tip `4a90a39`)

**NOT READY** — tally: APPROVE ×1 / APPROVE-WITH-NITS ×9 / BLOCK ×2,
DevEx PASS-WITH-NITS.

- **BLOCK-1** — `scripts/clues/generation-prompt.md:3` still read, in
  author voice above the banner: "This is the production prompt for
  the 365-set generation run."
- **BLOCK-2** — the new ch05 fact-ladder subsection documented the
  ladder's TYPE, not the shipped DATA SHAPE (it implied up to four
  stored facts per place; the build stores one).
- Convergent nits across the touched files + one late-arriving scope
  item (the deploy-docs correction, below).

## Cure round (this tip)

**BLOCK-1 — cured.** Line 3 now annotates the 365-set figure as the
daily plan of the time and points at the model-update note below it —
the same treatment line 21 already gave the identical figure:
"…for the 365-set generation run (the daily plan of the time — the
shipped game is fully unlimited; see the model update below)."

**BLOCK-2 — cured.** The ch05 subsection is rewritten as a SELECTION
ladder with honest coverage, every fact re-verified against the tree
before writing:

- The build stores ONE fact per place: `factForPlace()` in
  `scripts/facts-ladder.mjs` is first-hit-wins with build precedence
  wikidata > wikitext > eb1911 > hook; `factLadder()` in
  `src/game/generated-places.ts` adapts the stored fact to a
  one-entry ladder, overlaid at load by `applyFactIndex` (same file).
- Coverage, re-counted from the shipped files (not copied): the
  overlay is exactly 2 region files — Arkansas 20 places + Australia
  227 = 247. Kind mix: wikidata 2 (Arkansas only), wikitext 72,
  hook 173, **eb1911 zero**. eb1911's shipped scope is stated: its
  mined sentences cover UK/IE places only, `needsReview` rows
  excluded (facts-ladder.mjs header + `indexEb1911`), and no UK/IE
  fact file ships yet. Most regions have no facts yet.
- The ceiling consequence is stated plainly: a place whose sole fact
  sits above a younger player's band ceiling gives that player NO
  ladder fact (history/blurb fallback). The old sentences "Younger
  kids get the friendliest fact" and "when a place has a ladder fact,
  that fact leads the card" are gone / made ceiling-aware. The
  panel-confirmed-true rules content is kept: rung order,
  `CEILING_INDEX` ceilings, `mapStory` walk-down, fact > history
  precedence.

**Absorbed nits (all in already-touched files):**

- generation-prompt §1: "The player guesses via a constrained
  typeahead picker" was wrong — the shipped surface is tap-a-labeled-
  place → bottom-sheet confirm (`src/game/loop/LoopScreen.tsx`); the
  typeahead survives only as an internal index. Sentence fixed.
  (This round-1 cure itself overcorrected — panel round-2 BLOCK-A;
  superseded by cure round 2 below.) The
  two LOW author-voice daily remnants are reworded model-true:
  "even on days they lose" → "even when they lose the mystery"
  (~:77); "what week-balancing needs" → "what pool balancing needs"
  (~:162). Quoted [SYNTHESIS] text untouched.
- Ch05 §4: "never ship a 4-clue day" → "set"; "game-over for that
  day" → "set" (same daily-model construction fix #3 made elsewhere).
- Ch05 precision cluster: the "curated hook sentence" misnomer is
  gone — the hook rung is the chunk's history sentence verbatim
  (`hookRung` in facts-ladder.mjs); the blurb is now described as
  APPENDED to the winning sentence on every card, standing alone only
  as the last resort (`mapStory`); "chunk" is glossed on first use;
  the overlay functions are named; the self-referential "(§3 above)"
  is removed.
- Ch02 Sources: geodetective.md no longer described as covering
  "day-index math" (stale); the #182 line now records the fix MERGED
  as PR #184 (2026-10-20, squash `11a95a7`) instead of "ships on
  branch".
- Ch02 §13 badge sentence: the win-only condition added (Economy
  LOW — the code is stricter than the doc was: `awardCleanRoundBadge`
  is called with `won: progressed.status === "won"`, LoopScreen).
- Ch06 §4: the ~215-word bullet is split in two before "while the
  toggle deletes" (facts unchanged — readability only).
- Ch07 Sources: "#418 2026-10-16" no longer grouped under
  "pre-existing issues" — it now reads as found 2026-10-16, FIXED
  2026-10-20 (PR #179), reconciling with ch07 §7.
- Item 5 below: the game-app citation corrected `:1887` →
  `:1887-1888` (the comment spans both lines).

**Deploy-docs correction (scope added by the panel coordinator;
ground truth API-verified by the observability crew, 2026-10-21).**
The crash-report worker has ONLY ever been deployed by direct API
script upload — all deployments in the Cloudflare API history are
`source: api`, `triggered_by: upload` (the cf.py / version_upload
path); `wrangler deploy` was never the mechanism. The "Flagged, NOT
fixed" question is therefore settled **for the three docs this
branch rewrites** — `workers/crash-report/README.md`, handbook
ch07, and `docs/observability.md` now describe the real flow
(cf.py helper: `cf.py deploy <script.js>`, secrets via
`cf.py secret <NAME>` — the API secret endpoint), including the
known constraint that a fresh upload does NOT inherit the
`DISCORD_WEBHOOK_URL` secret (it must be re-set on the new
version — the current Phase 1 deploy blocker). Cure round 2
extended the same correction to `worker/observability/README.md`;
the two `wrangler.toml` header comments that still prescribe the
old flow are listed under "Flagged, NOT fixed" below — they are
the only known remnants:

- `workers/crash-report/README.md` — Deploy + owner-step + Secrets
  rewritten to the cf.py flow; the "Go-live — DONE (2026-10-17)"
  claim corrected: the live pre-Phase-1 code was last uploaded
  2026-10-09 and the pipeline was verified live 2026-10-10;
  2026-10-17 was the Phase 1 code merge (PR #171), not a worker
  deployment.
- Handbook ch07 §4 — the deploy bullet rewritten the same way; the
  "conflict needs the owner's one-line confirmation" framing is
  gone, replaced by the verified mechanism + the secret constraint.
- `docs/observability.md` — the "Open owner item" blockquote
  replaced with the resolved deploy method.
- Ground-truth sources read before writing: the ops branch record
  (`ops/telemetry-phase1-deploy` BRANCH_STATUS — API audit, upload
  dates, error 10021 on value-less secrets) and the cf.py helper
  itself (`~/workspace/skills/cloudflare/bin/cf.py` — `deploy` PUTs
  the script to the Workers scripts endpoint; `secret` PUTs to the
  script's secrets endpoint).

**Follow-up filed:** the stale header in `scripts/card-compose.mjs`
(it still describes the facts ladder as living "on the facts-ladder
branch") was filed as **issue #193** — a code-comment fix, outside
this branch's docs-only scope.

## Panel verdict (round 2, on tip `e0fb108`) — NOT READY

Tally: APPROVE ×2 / APPROVE-WITH-NITS ×8 / BLOCK ×2 (Frontend,
Office Hours), DevEx **FAIL**. Round-1 BLOCK-1 + BLOCK-2 were
verified CURED by the panel and are undisturbed. The new findings:

- **BLOCK-A (Frontend)** — cure round 1's §1 sentence for
  generation-prompt.md overcorrected: "the typeahead survives only
  as an internal index — it is not the guessing surface" is
  half-false (a player-visible "Search the map" combobox ships on
  every unfinished mystery). Companions: "tapping a labeled place"
  omitted region-named guesses from unlabeled taps; ch05's "At card
  time, mapStory" misplaced the composition; §8's framing verb
  "assembles" was present-tense outside the [SYNTHESIS] quotes.
- **BLOCK-B (Office Hours, rule 11)** — this record declared the
  deploy conflict "RESOLVED" while two prescribing leftovers were
  nowhere listed: `worker/observability/README.md`'s
  `wrangler deploy` block and `workers/crash-report/wrangler.toml`'s
  header comments.
- **DevEx FAIL** — the rewritten Deploy page
  (`workers/crash-report/README.md`) was not executable and not
  internally consistent: no bundle command at all, the KV step
  still implied "paste the id into wrangler.toml", the cron "needs
  no extra setup", error 10021 absent, the test count said 32
  (the suite is 33), a wrong-way "as above" (Secrets is BELOW
  Deploy), and an unreconciled staging aside.
- **Nit cluster** — ch05's "deepest-first" gloss and its
  "(fact before history; principle 1: history first)" collision;
  ch06's split bullet missing its bold lead-in + "Only the score
  survives both exits"; an uncited owner paraphrase in this file's
  flags.ts item (rule 11).

## Cure round 2 (this tip)

- **BLOCK-A — cured.** generation-prompt §1 now reads: a tap on a
  labeled place names that place, "and a tap anywhere else still
  counts — it names the region it lands in (open ocean names the
  water). (The old typeahead picker no longer submits guesses — it
  survives as a "Search the map" camera-jump box over the same
  ~119k index: picking a result flies there and selects the place,
  and the bottom sheet still confirms.)" Verified against
  `src/game/loop/guess-input.tsx` (label "Search the map",
  `role="combobox"`, placeholder "Type a place to fly there…"; its
  header: picking "never submits a guess… The bottom sheet confirms
  the guess"; `propose()`: "the pick only selects; the bottom
  sheet commits the guess"), its mount at `LoopScreen.tsx` (~:948),
  and the region-named unlabeled-tap path (LoopScreen comments;
  owner directive 2026-10-12). §8: "assembles" → "assembled" (one
  word, historical framing; the quoted words are untouched). Ch05:
  composition runs at chunk load via `toStarter`, re-mapped via
  `storyForBand` — now stated as such.
- **BLOCK-B — cured.** (1) `worker/observability/README.md`'s
  Deploy block now states the v1 worker is not deployed and that
  this project's workers ship by direct API script upload, never
  `wrangler deploy`. (2) The `wrangler.toml` header comments are
  listed under "Flagged, NOT fixed" below, with their owner and
  the reason. (3) The RESOLVED claims (Deploy-docs section above,
  Flagged section below) are reworded to the exact scope — the
  three named docs describe the real flow; the `wrangler.toml`
  remnants remain open. No unqualified "RESOLVED" survives.
- **DevEx FAIL — cured.** Ground truth established first-hand
  before writing: `cf.py` read end-to-end (deploy PUTs one JS file
  with metadata {main_module, compatibility_date, workers_dev} —
  no bindings, no triggers, never reads `wrangler.toml`; `secret`
  PUTs to the script's secrets endpoint, value as argument or read
  from stdin); the ops branch record (`ops/telemetry-phase1-deploy`
  — namespace created + cron set via the schedules endpoint,
  2026-10-21); the worker's own build setup (no bundler, no build
  script — one self-contained TS module). The Deploy/Secrets
  passages now give: the literal bundle command
  (`npx tsc workers/crash-report/src/index.ts --outDir dist-worker
  --module esnext --target es2022 --moduleResolution bundler
  --skipLibCheck`) — **TESTED on this VM**: exactly one file out
  (`index.js`, 26,376 B), and the emitted module answers /health
  with 200 `{"ok":true}` when loaded under node; how the KV
  binding actually travels (version-upload metadata — a bare
  `cf.py deploy` carries none, so counting stays fail-open off);
  wrangler.toml's true role (the human config record; on main its
  KV block is still commented with `PASTE_NAMESPACE_ID_HERE`); the
  three KV states kept separate (namespace **CREATED** 2026-10-21,
  id `34884ed9…`; binding **RECORDED** on
  `ops/telemetry-phase1-deploy`, awaiting the owner's merge word;
  Phase 1 **LIVE** pending the webhook re-supply); the cron's real
  mechanism (schedules endpoint, set 2026-10-21, persists across
  uploads — replacing "needs no extra setup"); cf.py named as a
  VM-local helper OUTSIDE the repo (off this VM: dashboard/API
  with your own token); error **10021** in the secret warning;
  both `cf.py secret` forms (argument / stdin) documented as
  implemented; test count 32 → **33** (suite run first-hand:
  33 pass); the wrong-way "as above" removed in the rewrite;
  staging marked **not set up today** (`cf.py` is hardcoded to
  the production script name).
- **Nit cluster — absorbed.** Ch05: the precedence is no longer
  glossed "deepest-first" — wikitext is tried before the deeper
  eb1911, and the hook rung does no re-validation, both now stated
  as `scripts/facts-ladder.mjs` has them (its header: composed
  kinds MUST pass the validator; `hookRung`: "No re-validation
  needed"); the "(fact before history; principle 1…)"
  parenthetical is rewritten so the composer's field precedence
  and the card principle's story sense no longer collide. Ch06:
  the split bullet gained the bold lead-in its siblings have
  ("**The toggle ends the run outright.**") and "Only the score
  survives both exits" → "Only the session survives both exits
  (the whole session state carries over; it is the run that
  ends)". This file: the flags.ts item's uncited owner paraphrase
  is cut (rule 11).

## Fixes (original round, each verified against the code / truth)

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
4. **Handbook ch05 — the fact ladder is documented (§3).**
   Ch05 never mentioned it. New subsection (rewritten in the cure
   round — see BLOCK-2 above): the four rungs, the per-region build
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
   :1887-1888 session/score stays alive).
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

- **`src/lib/flags.ts` comments (~lines 43–51 + file header).** They
  describe the baked-in defaults / the `learningOutcomes` false state as
  "today's behavior", but production has run `learningOutcomes` ON since
  2026-10-04 (PR #45, remote `flags.json` flip) — the baked default is
  the fail-closed fallback, not today's behavior. Not edited: the
  wording decision is deferred (recorded as an open follow-up since
  the 2026-10-17 docs refresh), and the file is code — outside this
  branch's docs-only scope.
- **`workers/crash-report/wrangler.toml` header comments (lines 3
  and 9).** They still prescribe the old flow — line 3: "secrets are
  set via `wrangler secret put`"; line 9: "`npx wrangler kv namespace
  create TELEMETRY_COUNTS`" — while the verified mechanism is the API
  upload path (cf.py / version upload; secrets via the API secret
  endpoint; the namespace was created via the API, 2026-10-21). NOT
  fixed here: that file is owned by branch
  `ops/telemetry-phase1-deploy` (it carries the KV binding commit),
  and this docs branch does not edit non-markdown files. The header
  correction rides that branch or a follow-up.

## Gates

- `node scripts/lint-cards.mjs` — **GATE PASSED** (run at the cured
  tip).
- `git diff --stat origin/main` — 10 files, docs/markdown only
  (this file included; cure round 2 adds
  `worker/observability/README.md`); zero code files, so the
  benchmark step is a no-op (no build inputs changed).
- `npm run test:worker` — 33 pass (run first-hand in cure round 2
  to verify the README's corrected test count; the branch changes
  no worker code).
