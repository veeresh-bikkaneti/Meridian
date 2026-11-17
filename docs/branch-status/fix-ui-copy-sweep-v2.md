# Stream K — copy and small pages (REBUILD)

Branch `fix/ui-copy-sweep-v2`. Base: current main `4c3d84c8`.
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
  or (c) the privacy age-band copy turned no test red. New source pins
  in the `home-journal-heading.test.ts` style watch all three
  (`home-journal-wiring.test.ts`, `contact-gate-skeleton.test.ts`,
  `privacy-copy.test.ts`). Each was verified red with its change
  reverted and green with it in place (recorded in the PR body).

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

## ⛔ Merge block — owner's word required

Item 39's age-band sentence (`src/routes/privacy.tsx:51`) is carried
**word for word** from #522 and is still awaiting the owner's
explicit sign-off:

> "We do ask for an age band (7-10, 10-18, or 18+). The band is saved
> only in this browser, and the game uses it to pick the difficulty
> and the cases the player sees. It is never sent to us."

Do not merge until the owner signs off that sentence (or says merge
anyway). The train approval never substituted for this sign-off.
