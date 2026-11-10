# BRANCH_STATUS — feat/journal-world-wars-spec

Stream 13. Journal: World Wars. Spec only. Clips gated.

**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF. STAGE B CLOSED.**

## Stage A pass, 2026-11-10

Task capsule:

```text
TASK: Screen the two proposed World Wars clips against standard §7a.
  For each kept clip, contract I5 data: group, objective, C3 code or
  UNVERIFIED, a real opening question (how many years ago), one
  read-aloud retrieval check, captions and transcript, a globe fly-to
  with a Flat 2D pin. Tone: remembrance. No graphic detail. No battle
  re-enactment. Stage B (mp4) only after the owner lifts the build gate.
Tier: Tier 0 (docs and data). No src/ edits.
Done: spec + clips.json + captions + tests. Draft PR. No video files.
Files: docs/scaling/journal-world-wars-spec.md,
  docs/scaling/journals/world-wars/**,
  docs/branch-status/feat-journal-world-wars-spec.md.
Verification: node --test docs/scaling/journals/world-wars/clips.test.mjs
  (5/5); node docs/scaling/journals/world-wars/readability.mjs (all under
  band). No AGENTS.md code gates ran.
```

Done:

- [x] Merged `origin/main` at session start.
- [x] Cut the Christmas Truce (§7a religion) and the unsourced "letters home" draft. Logged in `clips.json`.
- [x] Kept 2 PROPOSED clips: `school-morning` (7-10, 2026−1939=87, school at 5am, no train at the pin) and `quiet-hour` (10-18, 1939−1918=21).
- [x] I5 rows, captions, transcripts, globe pins, Flat 2D pin described.
- [x] 18+ question on `quiet-hour` only (teach no people-count). Not a third film.
- [x] K-12 §9 block and unsigned educator block in the spec.

Open:

- [ ] Stage B videos and `public/videos/journals/world-wars/manifest.json`: build gate is closed. Nothing under `public/videos/`.
- [ ] Human educator sign-off: none. Hardest look: the 7-10 train morning.
- [ ] Owner: accept the quiet-hour clip as the second story, and the Christmas cut.
- [ ] Integrator, later, not now: merge a manifest into `public/videos/journal-manifest.json`, and add a fly-to in `src/components/journal-player.tsx`. This branch cannot edit those.

Resume: `git fetch origin && git checkout feat/journal-world-wars-spec && git merge --no-edit origin/main`, then the two node commands above.
