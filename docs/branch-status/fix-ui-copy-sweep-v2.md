# Stream K — copy and small pages (REBUILD)

Branch `fix/ui-copy-sweep-v2`. Base: built on main `4c3d84c8`, updated
onto main `87159d2a` on 2026-11-17 (merge commit, no conflicts) so
#526 and #527 are in.
**Supersedes PR #522** (`fix/ui-copy-sweep`, tip `62131ab1`), which stays
open and untouched until the owner closes it.

## Why this branch exists

Old #522 was BLOCKED: its history carried the two pre-squash #521
commits (`cb38867b` shared shell, `ddadacc0` shell bans) under its own
work, so it could never merge cleanly onto the post-train main. This
branch replays **only 522's own commits** onto current main:

- `53535421` — item 38: the game is geography, math and science now
- `a1a5d8df` — item 39: Privacy stops claiming we never ask about age
- `eba185b9` — items 40–42: one copy vocabulary, styled grown-up check,
  calmer home journal
- `0533a705` — OG share description trimmed to the 155-char limit
- `dc4e6bf8` — grownups e2e: journal teaser click targets the intro line
  (conflict resolved by hand: main's read-aloud-sheet dismissal from
  #518 AND 522's stronger no-h2 assertion + intro-line click both kept)
- `020de63b` — journal one-heading unit pin

## Round 3 fixes on top

- **Font tokens** (`2d888490`) — `age-profile.css:30/40/81` named
  Karla/Fraunces literally; they now use the existing tokens
  `var(--font-atlas-body)` / `var(--font-atlas-display)`, the pattern
  sibling sheets already follow.
- **Three missing pins** (`0930f440`) — reverting (a) the journal
  on-screen wiring in `game-app.tsx`, (b) the Contact gate skeleton,
  or (c) the privacy age-band copy turned no test red. Source pins
  in the `home-journal-heading.test.ts` style watched all three
  (`home-journal-wiring.test.ts`, `contact-gate-skeleton.test.ts`,
  `privacy-copy.test.ts`). Each was verified red with its change
  reverted and green with it in place (recorded in the PR body).
  **Superseded by the Task 2 behaviour tests below.**

## The adoption-e2e "Home height 43.999996" report — not reproduced

The brief reported the shared-shell adoption e2e red on old 522
(Home height 43.999996 vs ≥44) and green on main. Under the hermetic
recipe (`docs/e2e-hermetic.md`, pinned Chromium) the spec passes
**3/3 on unmodified main `4c3d84c8` and 3/3 on this branch** — delta
zero. Nothing in 522's diff touches the Home control: its sizing is
`min-h-11` in `home-button.ts`, byte-identical between the old
pre-squash snapshot and current main, and 522's CSS changes are the
age-gate fonts/skeleton and the journal loading background.
43.999996 is 44 − 4×10⁻⁶ px — a sub-pixel bounding-box reading (the
header entrance animation's fractional transform at measure time),
not a code-level shrink. The ≥44 assertion was **not** loosened.

## Verification (hermetic, this branch)

- Unit (targeted): 86/86 — journal, heading pin, wiring pin, gate
  skeleton pin, privacy pin, age-profile suites.
- E2E: grownups-privacy-contact 5/5; shared-shell-adoption 3/3
  (main in the same env: 3/3).
- Gates: tsc clean · lint:nav clean · lint:subjects PASSED ·
  lint:content PASSED (0 new) · check:provenance PASSED ·
  build:pages green.

## Task 2 — unblock (2026-11-17)

- **Bundle back under budget, limit untouched.** On the updated
  branch the entry JS gzip measured **324,001 B — 136 B over** the
  323,865 B limit. Trim: the journal movie player is `React.lazy`
  in `game-app.tsx` (the pattern the storyteller/globe hosts already
  use), moving `journal-player` + its movie/transcript code into
  their own chunk (`bc5a5a65`). After: **321,975 B — 1,890 B to
  spare**, a 2,026 B saving. One main-owned site pin followed the
  new Suspense wrap (`home-loading-orbs.test.ts`, `2bfd40e4`).
- **Source pins → behaviour tests.** `privacy-copy.test.ts` renders
  the real Privacy page through a memory router and asserts on the
  rendered text; `contact-gate-skeleton.test.ts` renders the Contact
  page's loading screen (the Suspense fallback itself) and asserts
  on its markup (the skeleton's stylesheet rules stay a labelled
  stylesheet check — a markup render cannot prove a CSS rule);
  `home-journal-wiring.test.ts` drives `createJournalRotation`
  wired exactly as game-app wires it (blockers read a mutable
  on-screen ref fresh per recompute; the off-screen edge recompute
  lands the deferred entry). Revert checks, all red → green:
  privacy claim restored → 1 fail; date reverted → 1 fail; gate
  fallback → null → 2 fail; rotation ignoring `journalOnScreen` →
  3 fail. The observer effect itself is DOM code the node harness
  cannot mount; its path is covered by the grownups e2e.
- **Privacy date.** "Last updated" now reads November 17, 2026
  (`src/routes/privacy.tsx`, the `UPDATED` line only — the diff is
  that one line).
- **/board disclosure — PROPOSAL ONLY**, in the PR body: the board
  idea form collects an age group and the Privacy page does not
  mention it. Wording is drafted there for the owner's approval;
  nothing was added to the page.

## Verification (Task 2 round, this branch)

- Gates: tsc clean · worker tests green · worker typecheck clean ·
  lint:nav clean · lint:subjects PASSED · lint:content PASSED
  (0 new) · lint-cards GATE PASSED · check:provenance PASSED ·
  build green · build:pages green · entry size 321,975 B ≤ limit.
- Unit: full suites — scripts 1,213 (0 fail); src 2,855 with the
  single home-loading-orbs failure cured by `2bfd40e4` and its file
  re-run 16/16; targeted batch (journal ×3, orbs, privacy, gate,
  entry-size) 60/60.
- E2E (hermetic): grownups-privacy-contact 5/5. journal-player
  captions coverage: 1 pass, 1 fail that is environmental, not a
  regression — the spec's helper reads a fixture clip
  (`~/workspace/journal-player-play/real-clip/old-faithful.mp4`)
  that does not exist on this machine and fails before any app
  code runs; it fails the same way on main.

## Privacy sign-off — GRANTED 2026-11-17

Item 39's age-band sentence (`src/routes/privacy.tsx:51`), carried
**word for word** from #522:

> "We do ask for an age band (7-10, 10-18, or 18+). The band is saved
> only in this browser, and the game uses it to pick the difficulty
> and the cases the player sees. It is never sent to us."

**Privacy sentence approved by the owner 2026-11-17; ready to merge
when gates are green.** The sentence ships exactly as written. The
/board disclosure wording in the PR body is NOT covered by this
sign-off — it remains a proposal only.
