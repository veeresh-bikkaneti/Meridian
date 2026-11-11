# Status — feat/humanities-definitions

**Task:** add the §9 block; an objective and C3 family per topic; confirm religion and mythology stay removed; screen every topic against standard §7a and log cuts; publish the screened list. Then (2026-11-10) apply the owner's five decisions and log each one; then the owner's second message the same day (balance rule, decisions 6-11).

**Scope (owned paths):** `docs/scaling/humanities-definitions-spec.md`, `docs/scaling/humanities/**`, this file. Docs only; no code gates ran.

**Sync:** merged `origin/main` on 2026-11-10 (76 commits behind; clean merge, no conflicts).

## Done
- `docs/scaling/humanities/screened-topics.md`: 21 topics on the list (KEEP 4, KEEP-LIMITS 13, REVIEW 0, CUT 4); H09, H10, H22 removed by owner decision and logged; H17 now reads "Covered by Great leaders (feat/journal-great-leaders-spec)". Religion and mythology removal confirmed.
- Spec: new "Owner decisions (2026-11-10)" section logging all five decisions; banner and §9 block updated.
  1. Current affairs (P11): CLOSED. §4 is now a closure record; Q16's P11 part closed; §8 flag 12 closed.
  2. Constitution picker: CUT. §1 rewritten without it; Q9 and P5-1 closed.
  3. The third P8 people category folded into Great leaders (PR 408); its old label is used nowhere on this branch.
  4. School-rules civics for 7-10 (class rules, taking turns, a class vote on a pet or a game; no government, parties or elections). H12 now KEEP-LIMITS with three C3 codes, HIGH from the official C3 Framework PDF pp. 32-33.
  5. New `docs/scaling/humanities/journal-places-reword.md`: place-only wording for Angkor, Potala, Timbuktu and Uluru, math questions per group, a source per number (two UNVERIFIED and unused).

- Second owner message (2026-11-10), logged in the spec as the owner rule (verbatim, [sic]) plus decisions 6-11:
  - Potala KEEP, architecture only: about 13 storeys, sourced; politics flag closed.
  - Alamo KEEP, architecture only: 1718 is the mission's founding. Owner fix: the building's start year is removed; the only hook is currentYear − 1718 from the device clock.
  - Sagrada Família, Fushimi Inari, Christ the Redeemer, Robber's Cave reworded as architecture, geography and math only.
  - PROPOSED for balance: Kailasa (Ellora), Konark, Brihadeeswarar (Thanjavur), Ram Setu, also called Adam's Bridge; each with a math hook and an age group.
  - Home-folder note paths removed from the spec.
- Owner fix (2026-11-10, evening): decision 12, Ram Setu, also called Adam's Bridge narrated only as a 48 km chain of shoals between India and Sri Lanka (no rock type, no origin); decision 13, proper names kept, story text architecture only.
- Owner fix (2026-11-10, story measurements): every measurement taken out of the `story` field in `journal-places-reword.md` (Potala, Uluru, Sagrada Família, Fushimi Inari, Christ the Redeemer, Kailasa, Brihadeeswarar, Ram Setu, also called Adam's Bridge); measurements kept in math hooks only (Christ the Redeemer's 28 m arm span moved to a new 7-10 hook); Konark's held shadow hook reworded with no spoke count.
- Owner fix (2026-11-10, t334u, decisions 14-18): Redeemer 30 m / 28 m hook kept, cited from fetched Britannica and Landowski official pages; Konark 8-equal-parts model removed and the wheel hook rewritten with no part count; Uluru story cut to its first sentence (the "resort to the north" sentence deleted); Potala "Thirteen storeys tall!" kept, cited from fetched UNESCO Japanese brief and China.org.cn; Alamo already correct (no 1758 in docs or the diff from main; hook is currentYear − 1718, founded).

## Open
1. Named human educator to sign (spec stays GATED).
2. C3 indicator numbers other than the three civics codes still UNVERIFIED; the official PDF is now reachable, so they can be checked.
3. Integrator (outside my paths): apply the place rewording to `src/components/home-journal.data.ts`, `src/game/catalog.ts`, `scripts/journal-art-manifest.json`, `public/videos/journal-transcripts.json`; re-voice the narration of Angkor, Potala, Timbuktu, Uluru and Fushimi (Stage B); a Potala image without pilgrims.
4. Integrator: `docs/scaling/k12-learning-design-standard.md` §7a still uses the label retired by owner decision 3 ("Historical people (leaders, … inventors)").
5. Closed: proper names kept unchanged (owner decision 13) (Christ the Redeemer, Sagrada Família, Fushimi Inari, Kailasa / Konark / Brihadeeswarar "Temple", Ram Setu, also called Adam's Bridge, Alamo "mission").
6. Closed: Ram Setu, also called Adam's Bridge kept as geography only (owner decision 12).
7. Owner: pick a source (or leave out) for each UNVERIFIED figure: Konark sundial claim; 200,000 tonnes (sources: 150,000-200,000); 66 m tower (59.82 / 61 / 63.4 / 65.83 / 66 m); Potala height in metres.
8. The four balance places need a journal branch to own them (not in the live 106).
