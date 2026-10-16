# BRANCH_STATUS — feat/homepage-premium-v5 (Journal increment)

**Status: LOCAL ONLY — not pushed (the parent agent pushes; a
force-with-lease is expected, see base note). Not merged.**

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
  scripts 769 pass / 9 skipped / 0 fail, src 1335/1335 pass;
  `node scripts/lint-cards.mjs` — GATE PASSED;
  `npm run build:pages` — green.
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

## Pending

- Full Scrum review of the branch (build → test → rebase-check →
  retest → spec verification) with an independent Reality Checker;
  verdict + evidence appended to the scrum review report.
- Remaining from before (unchanged): live NVDA/VoiceOver pass on a real
  device stays Liz's/Veeresh's — disclosed, not claimed.
