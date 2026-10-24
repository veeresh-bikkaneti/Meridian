# BRANCH_STATUS — feat/wave2-content-quality

**Branch:** `feat/wave2-content-quality`
**Base:** `main` at `d327dd3` (includes the PR #240 merge)
**State: WORK COMPLETE — all gates green at head `881f8a5`, independently
re-verified by the QA/SDET pass; docs commit follows on top. The branch
is LOCAL ONLY — not pushed, no PR yet (see Push status).** Wave 2
content-quality work: WI-14 rich story card after every pin, WI-15
`/credits` page, WI-16 globe deck continent balance, WI-17
`lint:content` in CI. It supersedes the previous contents of this file
(the `fix/a11y-confirmed-findings` branch record, whose history lives
on its own PR #240).

## Scope (exactly this — no drive-by changes)

1. **WI-14 story card parity** — every curated place shows its reviewed
   story on hit and on miss; the 5–7 band gets a shorter kid version
   derived from that same reviewed text by sentence-prefix shortening
   only (`src/game/kid-story.ts`, no new text, no on-device AI). The
   miss card also gains the hit card's read-aloud row (B-UX-1: spoken
   parity for the 5–7 band). Plain fallback stays for uncurated
   GeoNames places only.
2. **WI-15 `/credits`** — a `/credits` route crediting GeoNames
   (CC BY 4.0), Wikipedia text (CC BY-SA), Esri imagery (the on-map
   attribution string, imported from the shared constant, never
   retyped), and the bundled open-source libraries (list checked by
   test against `package.json` dependencies). One footer link. No
   trackers, no form, no email, no certification claim.
3. **WI-16 deck balance** — the globe landmark deck grows 12 → 16 with
   exactly four additions (Statue of Liberty, Chichén Itzá, Eiffel
   Tower, Sydney Opera House), so every inhabited continent meets the
   Product Owner's proposed floor of `max(2, ⌈size ÷ 8⌉)`. No existing
   landmark deleted or moved. Starters total 327 → 331.
4. **WI-17 `lint:content`** — the runtime's banned-pattern rules run in
   CI over the clue files, starter stories, and catalog stories,
   importing the rule code from the runtime module (one source, no
   drift). The 5 violations measured in today's content are baselined
   individually and listed in the PR as owner-decision items; none was
   edited on this branch.

## Commits (5, on top of base `d327dd3`)

- `d5b128b` feat(lint): WI-17 lint:content — runtime clue-quality rules in CI
- `48c0e25` feat(credits): WI-15 /credits page — GeoNames, Wikipedia, Esri and bundled OSS credits
- `596d586` feat(deck): WI-16 four globe landmarks — every inhabited continent at the floor
- `586725d` feat(story): WI-14 rich story card after every pin — band-correct curated story on hit and miss
- `881f8a5` fix(branch): register /credits in sitemap and update globe count in question-label test

The last commit fixes two branch-introduced fallouts found by WI-14's
full-suite run and proven present on the pre-WI-14 head (not baseline,
not WI-14 regressions): the sitemap was missing the `/credits` entry
WI-15 added a route for, and a question-label test still asserted the
old 12-landmark globe count after WI-16 grew the deck.

## Gates (this branch; run at head `881f8a5`, logs in
`~/workspace/meridian-wave2-b4/logs/`; QA pass re-ran the full set
independently with identical totals)

- `npm run typecheck` — clean, exit 0.
- `npm test` — exit 0. Scripts suite: 837 tests, 828 pass / 0 fail /
  9 skipped. Src suite: 1502 tests, 1502 pass / 0 fail. (Baseline at
  `d327dd3`: scripts 834 tests / 825 pass; src 1489 / 1489.)
- `node scripts/lint-cards.mjs` — exit 0, prints `GATE PASSED`.
- `npm run lint:content` — exit 0, `GATE PASSED`; scanned clues=1935,
  starters=331, catalog=106; violations=5, all baselined (owner
  decision pending), 0 new, 0 stale.
- `npm run build:pages` — exit 0 (with `VITE_KOFI_URL` set, as the E2E
  specs require); `/credits` artefacts present in the build.
- Playwright E2E, targeted specs only: credits 2 passed; result-story-
  parity 2 passed; hit-story 1 passed; grownups-privacy-contact
  3 passed; result-card-overflow (mobile) 13 passed / 4 skipped /
  0 failed (the skips are the spec's own by-design cases). 24 QA
  screenshots captured and inspected.
- Environment note: gates ran on this VM under Node v24; CI uses
  Node 22.x — the CI run is still to confirm.

Full detail: `docs/reviews/2026-10-21-wave2-content-quality.md` and
the persona sections in the PR body.

## Push status — LOCAL ONLY

- The crew did not push and did not open a PR. The parent agent
  replays the branch onto origin through the GitHub API (the route
  used for PR #240) and opens the PR with the assembled description.
- **No merge, no deploy** — those wait for the owner's separate word.
  Only the owner merges.

## Pending

- Owner's review and merge decision on the PR (not yet opened; opened
  by the parent via API replay).
- Owner decisions carried in the PR: the 5 baselined `lint:content`
  violations (fix the text, keep the baseline, or retire the
  clue/place); ratification of the WI-16 continent floor as a standing
  rule; the Esri licensing/account items in
  `docs/reviews/esri-tiles-licensing.md` §6.
- Still owed (unchanged): a real screen-reader pass (NVDA/VoiceOver),
  device speech testing, and zoom / forced-colours checks for the new
  surfaces.
- Process disclosure (in the review doc and PR): `AGENTS.md` calls
  this Tier 2 council work; the crew's PO + Architect passes served as
  the council-equivalent, with the manifest assembled as PR sections
  rather than one signed document and the adversarial challenge run
  post-code by the Peer Reviewer seat.
