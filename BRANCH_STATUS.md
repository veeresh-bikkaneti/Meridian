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

## Pending

- Full Scrum review of the branch (build → test → rebase-check →
  retest → spec verification) with an independent Reality Checker;
  verdict + evidence appended to the scrum review report.
- Remaining from before (unchanged): live NVDA/VoiceOver pass on a real
  device stays Liz's/Veeresh's — disclosed, not claimed.
