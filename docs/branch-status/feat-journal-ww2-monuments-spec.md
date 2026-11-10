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
- [x] I5 rows in `docs/scaling/journals/ww2-monuments/clips.json` (2, PROPOSED).
- [x] Captions, transcripts, Full / Lite / Flat pin, §9 block, unsigned educator block.
- [x] `node --test docs/scaling/journals/ww2-monuments/clips.test.mjs` — run this session.
- [x] No code gates. No `src/` edits. No mp4. No `manifest.json`.

## Open

- [ ] Educator sign-off. Nobody named. No agent may sign.
- [ ] Owner lifts the build gate. Until then, no movies.
- [ ] Owner: "Hey kids…" opener versus the why-first question in a 10-second clip.
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
