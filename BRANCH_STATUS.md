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

## Pending

- Dataset generator (`scripts/build-journal-dataset.mjs`) +
  `src/game/journal-data.ts`; rotation engine; journal overlay view;
  home card + nav JOURNAL go live (UNMAPPED record updated when they
  do); unit + E2E tests.
- Full Scrum review of the branch (build → test → rebase-check →
  retest → spec verification) with an independent Reality Checker;
  verdict + evidence appended to the scrum review report.
- Remaining from before (unchanged): live NVDA/VoiceOver pass on a real
  device stays Liz's/Veeresh's — disclosed, not claimed.
