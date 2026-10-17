# BRANCH_STATUS — feat/homepage-premium-v5 (Journal increment)

**Status: LOCAL ONLY — not pushed (the parent agent pushes; a
force-with-lease is expected, see base note). Not merged.**

**Review status (2026-10-16, finisher run): NEEDS WORK — do not merge.**
The full Scrum review is complete (7 specialists + fix loop +
independent Reality Checker; verdict and evidence in the JOURNAL
ADDENDUM of the scrum review report). Two blockers are owner
decisions, not code defects: (1) `origin/main` has advanced to
`13347ae` and now ships its OWN Journal (PR #165:
`src/components/home-journal.ts` / `home-journal.data.ts` — inline
section, flat sequential windows, no confidence vote); this branch no
longer merges cleanly (merge-tree conflicts in
`src/components/game-app.tsx` and this file), and which Journal
survives is Liz's/Veeresh's call; (2) the chimney-rock citation
replacement is still pending that same decision (below). Everything
else in the review is fixed or disclosed in the Pending section.

**Base note (2026-10-16):** PR #158 (the v5 homepage) was MERGED into
`main` upstream (squash `e9bf739`, marked merged by #161; the two review
cure commits verified present on main: `#efe3bc` focus outline,
owner-order citation, `docs/homepage-v5-scrum-review.md`). This branch
was therefore **reset from its old tip `31331a4` to current
`origin/main` @ `6cd3bc3`** — nothing the old branch carried is missing
from main (verified file-by-file); the branch now carries only the
Journal increment below. Main has also since gained #162 (globe inside
the bento grid), #163 (handbook), #164 (TanStack bump).

**Mandate:** Liz, 2026-10-16 — the Journal becomes real: "Journal
rotates through 106 real catalog notes, three at a time, every 2 hours.
The page switches to the next set on its own." Plus: "These specs should
provide citation and confidence vote on facts describing." Spec:
`docs/journal-spec.md`.

## Done

- Spec written: `docs/journal-spec.md` — dataset verified first-hand:
  `PLACES` in `src/game/catalog.ts` = **exactly 106 places, all 106 with
  curated `story` + recorded `source`** (Liz's 106 confirmed). Set rule:
  ring-grouped triples (33 pure sets) + remainder sets (3, 3, 1) = 36
  sets, 72-hour cycle, epoch-derived window index; confidence vote
  computed mechanically from the citation host (.gov/.edu → Verified,
  49; other recorded source → Cited, 57; none → excluded, 0 today).
- Dataset generator + generated dataset (2026-10-16):
  `scripts/build-journal-dataset.mjs` (dependency-free, byte-stable on
  re-run) → `src/game/journal-data.ts`. Generator report: 106 catalog
  places parsed, **106 notes included, 0 excluded**; confidence tiers
  **verified 49 / cited 57**; **36 sets** (33 pure + remainder 3, 3, 1),
  every place exactly once. Stories + citations verbatim from the
  catalog (card rule #5).
- Rotation engine: `src/game/journal.ts` — pure functions only
  (`WINDOW_MS` 7,200,000; `journalSetIndexAt`, `journalSetAt`,
  `journalSetByIndex`, `nextWindowStart`, `nextEntryCountdown`,
  `confidenceForHref`, `shouldApplySetChange` for the §6 deferral rule).
- Journal overlay + wiring: `src/components/journal-view.tsx` +
  `journal-view.css` (grown-ups overlay pattern: role="dialog",
  aria-modal, Esc closes, visible close button, focus in on open /
  returned to the invoker by the host). `src/components/game-app.tsx`:
  READ THE ENTRY and nav JOURNAL are real buttons opening the view
  (the UNMAPPED note now covers only ABOUT + search, which stay
  aria-disabled); the home card names the current set ("Now showing:
  {geography} · {n} field notes", `.hv5-journal-now` in
  `home-v5.css`). Auto-rotation: boundary timer + 30 s safety interval
  + visibilitychange recompute, DEFERRED while the view is open or
  focus is inside the journal card; no aria-live; countdown is plain
  text ticked once a minute; no transition on set change.
- Tests: unit — `src/game/journal.test.ts` + `journal-data.test.ts`
  (20 tests: window boundaries, set formation + remainder composition,
  49/57 rubric + spot checks, dataset-vs-catalog field-for-field,
  deferral truth table). E2E — `tests/e2e/journal.spec.ts` (new
  `journal` project in `playwright.config.ts`): opens from card + nav,
  pure set shares one geography eyebrow, mocked clock +2h advances the
  set without reload, Esc returns focus to the invoker — **3/3 passed**
  against the built artifact.
- Gates (2026-10-16, logs in `meridian-v5-scrum-review/journal-logs/`
  beside the scrum review): `npx tsc --noEmit` clean; `npm test` —
  scripts 769 pass / 9 skipped / 0 fail, src 1338/1338 pass (1335 in
  the pre-fix-loop count, +3 journal pins from the fix loop; the
  finisher's retest logs `final-*.log` / `final2-*.log` are
  authoritative); `node scripts/lint-cards.mjs` — GATE PASSED;
  `npm run build:pages` — green (final tip buildId stamped).
- Scrum-review fix loop (2026-10-16, all 7 specialists; logs prefixed
  `fix-` in the same journal-logs folder):
  - Catalog source corrections (review URL sweep: 78 of 81 unique
    citation hrefs live, 3 dead 404s — fixed at the source, the journal
    inherits verbatim): `haymarket` → the Haymarket District Wikipedia
    article (old Haymarket article URL 404s; curl 200); `hyde` → the
    observatory's own site hydeobservatory.info (old Holmes Lake link
    404s; curl 200). **`chimney-rock` NOT changed:** the proposed
    history.nebraska.gov/chimney-rock target returns 200 only by
    redirecting to the Chimney Rock *gift shop* page — not the landmark
    page, and it does not support the story — so per the fix brief's
    own stop rule nothing was substituted; the entry keeps its retired
    NPS /chro/ source pending a replacement decision.
  - Generator hardening (`scripts/build-journal-dataset.mjs`): the
    parser now segments entries into blocks, so a genuinely MISSING
    story/source field excludes the place and prints the reason in the
    report (spec §1) instead of throwing — proven on a synthetic
    catalog (missing story, missing source, and empty citation label
    each excluded with reason, exit 0); structural mismatch still
    throws; every included href must be http:/https: or generation
    refuses (proven on a synthetic `javascript:` href). Regenerated
    dataset diff vs the previous file is exactly the 2 applied href
    fixes; tiers unchanged (49/57); byte-stable on re-run.
  - UI fixes: mixed (Field Notes) sets now render exactly
    `Now showing: Field Notes` on the home card (spec §5); the focusin
    handler calls `recomputeJournal()` (no hand-rolled stale-pending
    apply); the inert-wrapper comment names the journal view too;
    journal citation links are underlined (identifiable by more than
    color alone); the close button's ✕ glyph is aria-hidden.
  - Tests: unit pins for negative-time index wrap, set-by-index wrap,
    and both `confidenceText` lines verbatim; E2E gains the two
    deferral NEGATIVE tests (window rolls while the view is open /
    while focus is inside the card — content unchanged until close /
    focus-leave) and stronger assertions (first-note citation href
    equals the dataset's catalog href for the window, every note has a
    non-empty story + link + full confidence line, eyebrow count ==
    note count). Handbook §7's unmapped-surfaces line corrected
    (JOURNAL + READ THE ENTRY are live; ABOUT + search remain
    unmapped).

- Finisher run (2026-10-16): every recorded specialist defect was
  re-checked against the fix-loop diffs, the full gate set was re-run
  at the branch tip (logs `final-*.log` at `2b85f32`, `final2-*.log`
  at the final tip: tsc clean, lint-cards GATE PASSED, build green,
  journal E2E 5/5, unit green), and an independent Reality Checker
  re-verified the Journal against `docs/journal-spec.md` (dataset
  truth, rotation, citation sample, dispositions — all confirmed,
  none refuted). One residual the review left open was then closed:
  `7e739df` adds the committed generator test file the Code Reviewer
  asked for (`scripts/build-journal-dataset.test.mjs`, 15 tests)
  and a second Reality Checker confirmed the closure first-hand.
  Verdict: NEEDS WORK (below). Full record: JOURNAL ADDENDUM in the
  scrum review report.

## Pending

- OWNER DECISION — which Journal ships: this branch's spec'd overlay
  (geography sets, citations + confidence vote, focus deferral) vs
  the Journal main already ships from PR #165 (inline section, flat
  windows, no confidence). Until that is decided the branch cannot
  be rebased/merged: merge-tree vs `origin/main` @ `13347ae` exits 1
  (conflicts: `src/components/game-app.tsx`, `BRANCH_STATUS.md`).
- OWNER DECISION — chimney-rock citation: the recorded NPS
  `https://www.nps.gov/chro/` href 404s while the note displays
  "Verified"; the `history.nebraska.gov/chimney-rock` candidate
  redirects to a gift-shop page and was refused by the fix loop.
  A replacement source needs Liz's/Veeresh's pick, then a one-line
  catalog fix + regeneration.
- Spec §8 vs tests (Code F2, partial): §8 asks for unit fake-timer
  tests of the auto-switch wiring; the behaviour is pinned instead by
  the pure deferral truth table plus two E2E deferral negatives.
  Either add the unit tests or amend §8 — an owner/spec call.
- Open minors, disclosed: Historian F4 (22 citation labels name an
  organisation while linking Wikipedia — catalog-label decision);
  Code F9 (footer countdown keeps counting while a swap is
  deferred); Performance advisory (dataset ships eager in the routes
  chunk, ~+12.8 KB gzip vs pristine main); Historian F5/F6
  (spec-accepted rubric limitations: `.gov.in`/`.gov.au` score
  "cited", some Verified citations are generic homepages).
- Remaining from before (unchanged): live NVDA/VoiceOver pass on a real
  device stays Liz's/Veeresh's — disclosed, not claimed.
