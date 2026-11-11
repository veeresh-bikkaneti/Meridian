# Status — feat/humanities-definitions

**Task:** add the §9 block; an objective and C3 family per topic; confirm religion and mythology stay removed; screen every topic against standard §7a and log cuts; publish the screened list. Then (2026-11-10) apply the owner's five decisions and log each one.

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

## Open
1. Named human educator to sign (spec stays GATED).
2. C3 indicator numbers other than the three civics codes still UNVERIFIED; the official PDF is now reachable, so they can be checked.
3. Integrator (outside my paths): apply the place rewording to `src/components/home-journal.data.ts`, `src/game/catalog.ts`, `scripts/journal-art-manifest.json`, `public/videos/journal-transcripts.json`; re-voice the four movies' narration (Stage B); a Potala image without pilgrims.
4. Integrator: `docs/scaling/k12-learning-design-standard.md` §7a still uses the label retired by owner decision 3 ("Historical people (leaders, … inventors)").
5. Owner: Potala's extra politics flag (keep reworded or drop); whether to reword the other religious-angle entries (Sagrada Família, Fushimi Inari, Christ the Redeemer, Alamo mission, Robber's Cave).
