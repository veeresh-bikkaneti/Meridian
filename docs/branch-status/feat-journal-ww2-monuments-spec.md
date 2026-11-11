# BRANCH_STATUS — feat/journal-ww2-monuments-spec

Stream 12. Journal: World War monuments. Spec only. Clips gated.

**Status: SPEC SCREENED — GATED — STAGE B NOT STARTED**

## Task

Screen the proposed monument clips against standard §7a. For each clip kept,
write contract I5 data: group, objective, C3 code or UNVERIFIED, the opening
question (how far, how many years ago, where), one read-aloud retrieval check,
captions and a transcript, and a globe fly-to with a Flat 2D pin. Tone:
remembrance. No graphic detail. No battle re-enactment. Proposed count: 2.

## Done

- [x] Merged `origin/main` at session start.
- [x] Screened the previous two-clip draft. Kept both places. Cut crosses,
      chapel, shrine, landings, wreck, death counts, and the frozen "70 years."
      Log is in `docs/scaling/journal-ww2-monuments-spec.md`.
- [x] I5 rows in `docs/scaling/journals/ww2-monuments/clips.json` (2, PROPOSED), plus the optional 18+ `stretch` and `sources.md`.
- [x] Captions, transcripts, Full / Lite / Flat pin, §9 block, unsigned educator block.
- [x] `node --test docs/scaling/journals/ww2-monuments/clips.test.mjs` — run this session.
- [x] No code gates. No `src/` edits. No mp4. No `manifest.json`.
- [x] Owner fixes, 2026-11-10 (PR 410), after merging `origin/main`:
      1. Both clips, both `.vtt` files and `transcripts.md` open with "Hey kids,
         have you heard about this place?" Normandy 21 words, Arizona 23.
      2. Normandy says "dedicated in nineteen fifty-six". ABMC page re-fetched
         2026-11-10 reads "Dedicated 1956"; it agrees.
      3. "quiet" and "white" had no source on the ABMC or NPS pages fetched
         2026-11-10. Cut, and logged in `sources.md`.
      4. `labeledYear` renamed `currentYear` (play time). The question card
         reads "This year is {currentYear}." New checks in `clips.test.mjs`:
         opener and word count, no literal year in any answer, year shown on
         the card. A planted `2026 - 1956` answer failed the check; plant removed.
      `node --test docs/scaling/journals/ww2-monuments/clips.test.mjs`: 6/6 pass.

## Open

- [ ] Educator sign-off. Nobody named. No agent may sign.
- [ ] Owner lifts the build gate. Until then, no movies.
- [ ] Render-time check: the 21 and 23 word clips must fit about 9.5 s. Trim, do not speed up.
- [ ] Integrator, at Stage B: the journal player must fill `{currentYear}` in the retrieval question from the device clock.
- [ ] Owner: v3-versus-v4 listen verdict, carried forward, not answered here.
- [ ] Both places are US sites. A non-US monument would change the count of 2.
- [ ] C3 codes are a partial fit (the scored check is arithmetic). Math codes UNVERIFIED.
- [ ] ABMC degree-minute coordinates were not in the HTML fetched 2026-11-10. Pin uses OpenStreetMap. ABMC string stays UNVERIFIED.
- [ ] Integrator, when Stage B exists: merge `public/videos/journals/ww2-monuments/manifest.json` into `public/videos/journal-manifest.json`. Wire retrieval misses into `src/game/learning.ts` and `src/game/review-deck.ts`.

## Resume

```text
git fetch origin && git checkout feat/journal-ww2-monuments-spec && git merge --no-edit origin/main
node --test docs/scaling/journals/ww2-monuments/clips.test.mjs
```

Do not render clips until the gate and the educator signature are both on file.
