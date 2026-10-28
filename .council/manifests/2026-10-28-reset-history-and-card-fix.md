# COUNCIL CONSENSUS MANIFEST — Reset history ("Start over") + Review-card overlay fix

- **Tier:** 2 (Council), per `AGENTS.md` (new feature, 3+ files, new
  cross-store behaviour, destructive action). Protocol:
  `docs/ops/agent-council-protocol.md`.
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Scope:** branch `feat/reset-history-and-card-fix`. Two parts.
  Part 1: an in-app "Start over" reset that deletes the player's game
  history, entered from the misses-deck surfaces, behind a two-step
  confirm. Part 2: fix the home Review card so its REVIEW cue never
  overlaps the card illustration. No merge; the owner merges on his
  per-PR word after the panel approves the final tip.
- **Owner's words (2026-10-28):** "reset means now game remembers how
  many i missed, soon it will become huge, I want game allowing user to
  reset the past misses, so i can reset and start over deleting his
  game history. also fix the button overlay."
- **Base:** origin/main `ab21c1c` (verified at run start).
- **Council:** four seats as distinct persona passes; Councilor C ran
  as a separate agent, adversarially, over A/B's output, in two rounds;
  the Chair is a separate agent from the builders.
  - **Chair / Arbiter** — persona file loaded verbatim:
    `~/.codex/agents/agents-orchestrator.toml` ("Agents Orchestrator").
  - **Councilor A (ATDD / customer advocate)** — persona file loaded
    verbatim: `~/.codex/agents/persona-walkthrough-specialist.toml`.
  - **Councilor B (TDD / contracts lead)** — persona file loaded
    verbatim: `~/.codex/agents/test-automation-engineer.toml`.
  - **Councilor C (adversarial skeptic)** — persona file loaded
    verbatim: `~/.codex/agents/code-reviewer.toml`.

## 1. Problem and root causes (research, verified at `ab21c1c`)

- The review deck (`meridian:review-deck:v1`) only grows: every missed
  place is recorded (`game-app.tsx` `onConfirm`) and the home card's
  due count grows with it. No delete path exists for the deck or for
  any other history store — there is not even a `clearReviewDeck`;
  `clearLearningStore` (`src/game/learning.ts:412`) is the only clear
  idiom in the codebase.
- Part 2 root cause (by construction): the Review card's decorative
  REVIEW cue `.hv5-review-cue` (`home-v5.css:1105-1119`, absolute,
  right:14/bottom:14) sits entirely inside the illustration box
  `.hv5-spot.hv5-art` (`:762-776`, absolute, right:6/bottom:2, 172px
  wide) — the cue overlaps the art at every width. The real "Start
  review" CTA is in-flow and does not overlap anything.
- The home due count re-reads the deck only on picker entry
  (`useDeckStatus`, `game-app.tsx:1002-1024`): a reset performed on
  the picker would leave a stale count on screen without an explicit
  refresh. The notify precedent is the `meridian:palette-change`
  CustomEvent pattern.

## 2. Store inventory — the spine of Part 1

Every local persistence store, ruled CLEARED or KEPT with its reason.
"History/progress" = records of play; "preference" = how the player
likes the game set up. The owner's ask deletes history, not setup.

| Store (key) | Owner module | Ruling | Reason |
|---|---|---|---|
| Review deck `meridian:review-deck:v1` | `src/game/review-deck.ts` | **CLEARED** | The misses themselves — the owner's named problem. |
| Learning records `meridian:learning:v1` | `src/game/learning.ts` (`clearLearningStore` exists) | **CLEARED** | Per-place attempts/mastery and growth totals are play history. |
| Seen places `meridian:seen:v2:*` (incl. legacy unscoped v2) | `src/game/trail.ts` | **CLEARED** | No-repeat memory; clearing it IS "start over" — seen places can be dealt again. |
| Seen legacy day keys `meridian:seen:v1:*` | `src/game/trail.ts` (folded into v2 on read) | **CLEARED** | A surviving v1 key would resurrect seen-state on the next read. |
| Cleared-place marks `meridian:cleared:v1:*` | `src/game/trail.ts` | **CLEARED** | Progress memory paired with the seen store. |
| GeoDetective store `meridian.loop.v2` | `src/loop/store.ts` | **CLEARED** | Mysteries played, streaks, solved set — play history. |
| GeoDetective open flag `meridian.loop.open` | `src/loop/store.ts` / game-app boot | **CLEARED** | A pointer into the wiped store; a kept flag auto-opens a fresh mystery on next boot instead of landing home. |
| Cold Trail store `meridian.coldtrail.v2` | `src/coldtrail/store.ts` | **CLEARED** | Cases, stars, streaks — play history. |
| Cold Trail legacy `meridian.coldtrail.v1` | `src/game/coldtrail/store.ts:181-189` (migrates into v2 on load) | **CLEARED, removed BEFORE v2** | A surviving v1 key resurrects the whole store on next load. |
| Cold Trail open flag `meridian.coldtrail.open` | game-app boot | **CLEARED** | Same pointer rule as the loop flag. |
| Session score `meridian.session` (sessionStorage) | `src/game/session.ts` (`clearSession()` exists) | **CLEARED** | Score/places/streak banked this session are game history; a reset that leaves the 500 points banked is a false "start over". Storage clear + in-memory reset via `replaceSession(null)` (D15). |
| Saved run `meridian.run` (sessionStorage) | `src/game/session.ts` / boot | **CLEARED** (D13) | A paused run is in-progress play history: its stored results re-seed the session via `seedSessionFromRun` when the edition is reopened, resurrecting the "cleared" score. "Start over" discards it; no Resume is offered after a reset. |
| Current-place drop `meridian.drop` (sessionStorage) | game-app | **CLEARED** (D13) | The paused run's current-place pin — one lifecycle with `meridian.run`; every existing run-discard site already pairs them. |
| Passport badges `meridian.passport.badges.v1` | `src/game/badges.ts` ("COSMETIC ONLY… earned recognition") | KEPT | Unclassifiable with confidence → kept by the standing default; deletion is irreversible, keeping is not. Open question OQ1 for the owner. |
| First-win flag `meridian.firstWinCelebrated` | `src/components/celebration-copy.ts` | KEPT | Deleting it manufactures a false "first-ever win" celebration later. Open question OQ1. |
| GeoDetective archive `meridian.loop.v1` | — (never read or written) | KEPT — DO NOT TOUCH | Deliberately inert archive; sweeping it is out of scope and unrequested. |
| Palette `meridian.palette` | `src/game/palette-preference.ts` | KEPT | Preference, not history. |
| Sound `meridian.sound` | game-app | KEPT | Preference. |
| Age profile `meridian.ageProfile.v1` | `src/age-profile/store.ts` | KEPT | A grown-up setup choice (has its own reset flow). |
| Map mode `meridian:map-mode` | game-app | KEPT | Preference. |
| Difficulty `meridian.difficulty` | game-app | KEPT | Preference. |
| Read-aloud `meridian.readAloudPref.v1` | game-app | KEPT | Preference. |
| Tutorial seen `meridian.tutorialSeen` | game-app | KEPT | Setup state, not play history. |
| Breadcrumb / chunk-recovery keys / `meridian.staleRefresh` / `meridian.cleanExit` | game-app / crash paths | KEPT | App plumbing (reload-loop guards), not player history. |
| Story caches, daily gates, grown-up gate state | various | KEPT | Content caches and safety gates, not play history. |
| `grok-auth.bearer-token` | auth | KEPT — OUT OF SCOPE | A credential; never touched by game code. |
| Near-miss foreign keys (`meridian:seen:v3:*`, `meridian.loop.v3`, `meridian:review-deck:v2`, `other-app:*`) | — | KEPT (sentinels) | Prefix discipline: the sweep matches exact keys/patterns only; unknown keys are never ours to delete. |

## 3. Chair decisions (binding)

- **D1 — Inventory.** §2 is the contract. The reset clears exactly
  the CLEARED set and nothing else; the sentinel unit test proves the
  KEPT set byte-identical after a reset.
- **D2 — Badges + first-win KEPT (C1 adopted).** No owner ruling
  exists for either; the brief's default (unclassifiable → KEPT +
  open question) governs. `clearPassportBadges` /
  `clearFirstWinCelebrated` are struck from the build; `badges.ts`
  and `celebration-copy.ts` are protected files on this branch.
- **D3 — All-history from the deck surfaces (C2 overruled, dissent
  carried in §7).** The owner's words ("deleting his game history",
  "start over") and the assignment posture choose full history.
  Mitigations: the opener is labelled "Start over" (never "Clear
  misses"), the confirm enumerates every loss in kid words (§4), and
  C's dissent travels to the PR body for the owner's merge word.
- **D4 — Partial-failure honesty (C3 adopted).** `resetHistory()`
  returns `{ cleared: string[], failed: { store: string }[] }`.
  Per-store clears live in their owner modules and follow
  `resetProfile()`'s precedent (remove; on failure overwrite with the
  empty/unset value; null any in-memory fallback). Keys are collected
  into a snapshot before removal (no remove-while-iterating). Legacy
  keys are removed before their current-version keys. After clearing,
  every cleared store is re-read; anything still present moves to
  `failed`. The success toast fires only when `failed` is empty. The
  card's post-reset state is derived from a re-read, never set
  optimistically. A partial failure keeps the dialog open with the
  locked partial line and a retry.
- **D5 — Session in scope (C4 adopted; seam and sentinel amended
  by D13/D15).** `meridian.session` is cleared AND GameApp's
  in-memory session is reset — via `replaceSession(null)` (D15),
  not `handleEndGame`. Proof E2E: bank a score → reset → play one
  place → end game → the summary shows only the post-reset play,
  plus the Editions-paused variant (D13). The old "sessionStorage
  untouched" sentinel is struck entirely: session, run and drop
  are all in the cleared set.
- **D6 — UI refresh (C5 adopted; mechanism pinned by D14/D16).**
  On a failed-empty reset GameApp dispatches
  `meridian:history-reset`, re-reads deck status, and bumps a
  `historyResetEpoch` that remounts the home history surfaces.
  E2E asserts the deck card and the GeoDetective home display
  reflect the wipe without a reload (the Cold Trail assertion
  lives at TrailScreen entry — D14c).
- **D7 — Open flags cleared (C6 adopted).** `meridian.loop.open` and
  `meridian.coldtrail.open` are in the cleared set; the unit contract
  asserts their removal (no skipped test).
- **D8 — RED evidence (C7 adopted).** Layer-1 RED (module missing)
  proves nothing and is not evidence. The builder records a Layer-2
  RED run — stub/no-op exports → named behavioural failures — in
  `BRANCH_STATUS.md` before GREEN. Every reset test pairs a positive
  assertion (a target key is gone) with its negative assertions
  (kept/foreign keys intact) in the same test. The master sentinel
  test carries the interleaved multi-key fixture, not only the
  trail tests.
- **D9 — Part 2 contract (C8 adopted as amended).** Bounding-box
  disjointness between cue and art is adopted knowingly as the
  deliberate, deterministic contract (the owner's complaint is the
  visible pill on the art). The fix is scoped to the review card
  (cue-only move or `.hv5-review-due`-scoped rule); the shared
  `.hv5-spot .hv5-art` rule is not restyled. Test widths: 360, 390,
  1024 (the untested 769–1279 regime), 1280. The existing
  card-redesign "tap anywhere" test is cured by name: with deck
  total > 0 the card's focusable count becomes 2 (CTA + reset
  opener); the opener sits in-flow in the text column, clear of the
  cue's centre click point; a cue-centre click still starts review;
  an opener click opens the dialog and does not start review
  (z-index handled per the `.hv5-involved p a` precedent).
- **D10 — Surfaces + visibility (C9 partially overruled, dissent
  carried in §7).** Both entry surfaces ship: the home Review card
  and `ReviewComplete`. The reset control renders iff deck total > 0
  (due OR caught-up) on the card, and iff deck total > 0 at
  `ReviewComplete`; it never renders when the deck is empty. When
  the deck feature is flag-off the card — and with it this reset —
  is not rendered; that is an accepted v1 limitation (the deck is
  gated by `learningOutcomes`), recorded as OQ3.
- **D11 — Dialog.** One `role="alertdialog"` step mirroring
  `AgeProfileSettings`: title, plain sub, danger primary, ghost
  secondary, focus moves into the dialog on open, Esc = no change,
  focus returns to the opener on close. Copy is locked in §4.
- **D12 — Constitution.** No lift granted; none is needed (targeted
  additive functions in owner modules; the session seam already
  exists; the Part 2 fix is an additive scoped rule).
  **Contingent stop:** if the builder finds the session seam cannot
  be reused without refactoring shared logic, work stops and
  returns to the Chair/owner — no lift is pre-granted.
- **D13 — Paused run cleared (Chair addendum, adopting C round 2).**
  Supersedes the D1–D12 KEPT ruling for `meridian.run` /
  `meridian.drop` and strikes the premise "reset surfaces exist
  only when no run is in flight" — false for paused runs
  (`onEditions` keeps `meridian.run`; reopening the edition resumes
  it and `seedSessionFromRun` re-banks every pre-reset result into
  the cleared session). Both keys move to CLEARED (§2). Sentinel
  amended: after reset, `meridian.session` AND `meridian.run` AND
  `meridian.drop` are all absent and the in-memory session is null.
  New mandatory E2E variant (§6): the Editions-paused path, whose
  discriminating assertion is the post-reopen session re-read.
- **D14 — Refresh mechanism pins (addendum).** (a) `key=
  {historyResetEpoch}` on the `<Choose>` element at its render
  site — GeoDetective progress is a mount-only `useState` inside
  `Choose` itself, so remounting sub-surfaces does not satisfy D6.
  (b) `useDeckStatus` takes `historyResetEpoch` as an explicit
  parameter; effect deps `[onPicker, historyResetEpoch]`.
  (c) The "Cold Trail home display" assertion is struck as vacuous
  (no such display exists) and replaced with a TrailScreen-entry
  assertion: after reset, opening Cold Trail shows a fresh case
  and zero stars.
- **D15 — Session seam pinned by name (addendum).** The reset's
  session clear reuses `replaceSession(null)` from
  `useSessionState` — by that name. `handleEndGame` is NOT the
  seam (it ends and persists the session). The D12 contingent stop
  does not trigger: the correct seam exists, no refactor needed.
- **D16 — ReviewComplete mechanism pinned (addendum).** The
  control's visibility and post-reset hiding at `ReviewComplete`
  derive from a fresh `readReviewDeck()` / `deckCounts()` read in
  `PlayLoaded` at that render (the `reviewDueCount` pattern) and
  the local re-read per D4 — NOT from the home epoch and NOT by
  threading `deckStatus` into `Play`/`PlayLoaded`.
  `total={pool.length}` is unchanged (it is the review-queue total
  for the "remembered X of Y" line).
- **D17 — Undo clause in the rendered dialog (addendum).** "This
  cannot be undone." lands as its own sentence in the rendered
  dialog UI copy — manifest-only presence does not satisfy it —
  with a unit/E2E assertion on the rendered dialog text matching
  that exact string. Cleared-place marks are named in the sub-line
  ("every place you have seen or cleared"), not left to inference.

## 4. Locked player-facing copy (do not paraphrase in code or tests)

- Opener (both surfaces): **"Start over"**
- Dialog title: **"Start over?"**
- Dialog sub: **"This clears your misses to practise again, every
  place you have seen or cleared, your learning growth, your
  GeoDetective streaks and solved cases, your Cold Trail case and
  stars, any game you left in the middle, and your score for today.
  Your badges stay. Your grown-up choices stay. This cannot be
  undone."**
  (Coordinator synthesis, flagged for the panel: the Chair's round-1
  line enumerated every loss but lacked the paused-game phrase and
  the undo clause; the Chair addendum's replacement line — "This
  clears your missed places, every place you have seen or cleared,
  your Cold Trail case and stars, any game you left in the middle,
  and your score for today. This cannot be undone." — added both
  but dropped learning growth and GeoDetective, which §5-S6
  requires naming. The locked line above is the merge of the two:
  every Chair-locked phrase is preserved and no enumerated loss is
  dropped. D17's assertion targets the exact sentence "This cannot
  be undone." in the rendered dialog.)
- Danger button: **"Yes, start over"** (testid
  `reset-history-confirm-clear`)
- Ghost button: **"Keep my history"** (testid
  `reset-history-cancel`)
- Success toast: **"All cleared. You are starting fresh."**
- Partial failure (in-dialog): **"Some things could not be cleared.
  Try again."**
- Selectors: opener testid `reset-history-open`; dialog testid
  `reset-history-confirm`. No locked copy anywhere else in the app
  is touched.

## 5. ATDD scenarios (Councilor A, as amended by the Chair)

- **S1** Reset control on the home card (deck total > 0) → confirm →
  success toast → the card flips to its empty state in place, no
  reload, due count gone.
- **S2** Same control on `ReviewComplete` (deck total > 0) → same
  confirm → deck empty when the player returns home.
- **S3** Nothing is deleted before the confirm; the dialog carries
  title/sub/danger/ghost and takes focus.
- **S4** "Keep my history" and Esc change nothing — deck, growth,
  session, every store byte-identical.
- **S5** No reset control anywhere when the deck is empty.
- **S6** The confirm copy names every loss (§4) and never implies a
  kept store (badges, settings) is deleted. After a reset, no
  Resume is offered on Home for a discarded paused game (D13).
- **S7** After a reset, previously-seen places can be dealt again
  (seen/cleared stores empty).
- **S8** Growth displays are gone after reset; palette, sound, age
  profile and the other preferences are untouched.
- **S9** Part 2: cue and illustration are both fully visible and
  never overlap at 360/390/1024/1280; the real review button still
  starts review; the reset opener opens only the dialog.

## 6. TDD contracts (Councilor B, as amended by the Chair)

New module `src/game/reset-history.ts` exporting
`resetHistory(storage?, sessionStorage?)` composing per-store clears
that live in their owner modules: `clearReviewDeck`
(`review-deck.ts`, new), `clearLearningStore` (exists),
`clearTrailHistory` (`trail.ts`, new — collects keys via the owner's
enumeration, then removes seen v2/scoped+unscoped, seen v1, cleared
marks), `clearLoopStore` (`loop/store.ts`, new — store + open flag),
`clearColdtrailStore` (`coldtrail/store.ts`, new — v1 before v2,
plus open flag), `clearSession` (exists). Each clear accepts the
established injectable-storage parameter where its module's readers
do; where a module's clear cannot reach a key, that is a contract
failure, not a fallback to raw key removal from `reset-history.ts`.

Unit tests — create `src/game/reset-history.test.ts`; extend
`review-deck.test.ts`, `trail.test.ts`, `loop/store` tests,
`coldtrail/store.test.ts`:

- **U-R1 master sentinel:** seed every CLEARED key (with ≥3 seen
  keys interleaved among near-miss foreign keys), every KEPT key,
  and foreign keys; run once; assert every cleared key absent and
  every kept/foreign value byte-identical; assert
  `meridian.session`, `meridian.run` and `meridian.drop` all
  absent (D13).
- **U-R2** second run is a no-op (idempotent).
- **U-R3/U-R4** throwing `removeItem` / throwing enumeration never
  throw out of `resetHistory()`; the overwrite fallback applies and
  failures land in `failed`.
- **U-R5** one failing store does not abort the others; the result
  partitions them correctly.
- **U-R6** injected storage is honoured everywhere — no global
  `localStorage`/`sessionStorage` access during a reset.
- **U-R7 (asserting, not skipped)** `meridian.loop.open` and
  `meridian.coldtrail.open` are removed by the reset.
- **U-R8** Cold Trail v1-only seed: after reset, `loadColdtrail()`
  returns the fresh store — no resurrection. Same shape for trail
  v1 seen keys.

E2E — create `tests/e2e/reset-history.desktop.spec.ts`; extend
`tests/e2e/card-redesign.desktop.spec.ts` and
`tests/e2e/mobile-home-overlap.spec.ts` (Part 2):

- Seed a due deck (the card-redesign seed idiom) → home card shows
  the due count → open the dialog → "Keep my history" changes
  nothing → reopen → "Yes, start over" → toast → card shows the
  empty state in place (no reload) → storage read-back: cleared
  keys absent, kept keys byte-identical.
- Session proof: bank a score in a short game → return home →
  reset → play one place → end game → summary reflects only the
  post-reset play.
- **Editions-paused variant (D13, mandatory):** bank a place →
  Editions (paused, NOT End game) → home → reset → assert
  `meridian.session`/`meridian.run`/`meridian.drop` all absent →
  assert no Resume is offered on Home → reopen the same
  edition/region/difficulty → fresh run with zero pre-reset
  results → re-read the session after reopen: no pre-reset banks
  (the discriminating assertion) → End game → summary shows only
  post-reset play.
- TrailScreen entry (D14c): after a reset, opening Cold Trail
  shows a fresh case and zero stars.
- Dialog text: the rendered dialog contains the exact sentence
  "This cannot be undone." (D17).
- Reload proof: reset → reload → home lands on the picker (no
  wiped edition auto-opens) and the deck is still empty.
- Part 2: single-evaluate bounding-box snapshot; assert cue ∩ art
  is empty (0.5px epsilon) at 360/390/1024/1280; cue-centre click
  starts review; opener click opens the dialog only; capture the
  phone-width screenshot of the fixed card for the PR.
- **GREEN bar:** the new reset E2E passes `--repeat-each=10`; the
  extended overlap suites stay green (sibling cards are the
  regression surface).
- **RED signatures (expected before implementation):** Layer 1 —
  import failure for `reset-history.ts` (recorded, not evidence).
  Layer 2 — with stub exports: "card still shows the due count
  after confirm" and "REVIEW cue overlaps review illustration —
  Expected: false, Received: true". The Layer-2 run is recorded in
  `BRANCH_STATUS.md` before GREEN (D8).

## 7. Carried dissents (Councilor C, recorded per protocol §4)

- **C2 (overruled by D3):** "Placing an all-history wipe on the
  Review-my-misses card is a consent trap for a child even with
  enumerating copy — the owner must explicitly choose
  misses-only-here vs all-history-here (settings/grown-ups
  precedent) before sign-off." The Chair ruled on the owner's own
  words; this dissent is reproduced in the PR body so the owner's
  merge word is also his ruling on it.
- **C9-cut (overruled by D10):** "Cut the ReviewComplete entry
  surface for v1" on scope grounds. The assignment names the Review
  screen as the entry point; both surfaces ship, with the
  visibility rule specified.

## 8. Sign-off

- Councilor A: scenarios delivered (Phase 1).
- Councilor B: contracts delivered (Phase 2), as amended by D2/D5/
  D7/D8.
- Councilor C: CHALLENGE round 1 (9 points) → Chair dispositions
  D1–D12 → round 2 CHALLENGE (paused-run resurrection + 3
  mechanism pins) → Chair addendum adopted round 2 in full as
  D13–D17; no item overruled in the addendum.
- Chair (Agents Orchestrator persona): **Status: APPROVED — as
  amended by D13–D17.** Build binds the manifest as amended
  (D1–D17); no implementation against the unamended D1–D12 text
  is authorized. Dissents carried: §7 (C2; C9-cut).
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`

## 9. Open questions for the owner (non-blocking; defaults applied)

- **OQ1** Badges + first-win flag: kept in v1 (D2). One line from
  the owner flips them into the cleared set in a follow-up.
- **OQ2** `meridian.loop.v1` inert archive: left untouched (D1).
  A separate owner-directed cleanup could remove it.
- **OQ3** Flag-off players have no reset door in v1 (D10). A
  Settings/grown-ups entry is a possible follow-up if wanted.
- **OQ4** C2 dissent: the owner's merge word on this PR is also his
  ruling on all-history-from-the-misses-card.
