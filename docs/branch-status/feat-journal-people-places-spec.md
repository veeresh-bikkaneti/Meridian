# BRANCH_STATUS — feat/journal-people-places-spec

Stream: People & places journal. Spec only. Clips gated.

**Status: SCREENED — AWAITING OWNER AND EDUCATOR. STAGE B CLOSED.**

## This pass (2026-11-10)

```text
TASK: Screen the five proposed clips against standard §7a. For each kept
  clip, I5 data: group, objective, C3 code or UNVERIFIED, opening question,
  one read-aloud retrieval check, captions and transcript, globe fly-to
  with a Flat 2D pin.
Tier: docs and a contract check. No src/ change. No video files.
Done: five drafts cut; five replacement rows PROPOSED; tests and
  readability green. Stage B not started.
```

Done:

- [x] Merged `origin/main` at session start (main was at `8dee5bad`).
- [x] §7a screen. Cut: Maya ceremonial draft, Shaolin, Bodhidharma, Vivekananda, Zeus. Log in the spec and in `clips.json`.
- [x] Five PROPOSED replacements with I5 fields, sources, conflicts left untaught, captions, transcripts.
- [x] Groups: 7-10 ×2 (multiplication only), 10-18 ×2 (proportion, rate), 18+ ×1 (trigonometry). Adult C3 code UNVERIFIED.
- [x] `node --test docs/scaling/journals/people-places/clips.test.mjs` — 6 pass.
- [x] `node docs/scaling/journals/people-places/readability.mjs` — all lines at or under the band limit.

Open:

- [ ] Owner accepts the replacement set (Andean roads is the closest §7a call).
- [ ] Named human educator signs the rubric block in the spec. None has.
- [ ] Stage B videos and `public/videos/journals/people-places/manifest.json`: blocked. Build gate is not lifted for this stream.
- [ ] Integrator, only at Stage B: `public/videos/journal-manifest.json`, and maybe `src/game/learning.ts` if a deck subject id is required. Not asked yet.

No code gates ran (docs and a node contract check only). No screen recording: nothing playable was built.

Resume: `git fetch origin && git checkout feat/journal-people-places-spec && git merge --no-edit origin/main`, then the two node commands above.
