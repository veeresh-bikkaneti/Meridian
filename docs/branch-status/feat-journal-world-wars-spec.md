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
  (7/7); node docs/scaling/journals/world-wars/readability.mjs (all under
  band). No AGENTS.md code gates ran.
```

Done:

- [x] Merged `origin/main` at session start.
- [x] Cut the Christmas Truce (§7a religion) and the unsourced "letters home" draft. Logged in `clips.json`.
- [x] Kept 2 PROPOSED clips: `school-morning` (7-10, currentYear − 1939 at play time, school at 5am, no train at the pin) and `quiet-hour` (10-18, 1939−1918=21).
- [x] I5 rows, captions, transcripts, globe pins, Flat 2D pin described.
- [x] 18+ stretch on `quiet-hour` only. Not a third film. Contract I5 `stretch`.
- [x] K-12 §9 block and unsigned educator block in the spec.

## Owner fix pass, 2026-11-10 (PR 412)

- [x] Fix 1: school-morning drops "the counting year is 2026" and the stored 87. Answer is `currentYear - 1939`, computed at play time and shown on the card. The use-it-elsewhere bridge row is `currentYear - 2000`, not 26. `countingYear` removed from `clips.json`.
- [x] Fix 2: 18+ stretch is now "signed at 5:45, took effect at 11:00, how many minutes?" → 315, from fact `quiet-hour-1918` (Britannica). The "What count do you teach? / none" question is gone.
- [x] Fix 3: both C3 codes cite the live C3 Framework PDF (socialstudies.org, PDF page 46), text matched word for word. School-board PDF removed. New fact id `c3-history-indicators`.
- [x] Fix 4: both narrations trimmed from 22 to 20 words, "Hey kids" opener kept; `.txt`, `.vtt` and `clips.json` match.
- [x] Clip check: added a literal-year test (no stored 2020s year, no "counting year", years-ago answers must be `currentYear - YYYY`), a stretch-answer-from-fact test, and a narration-length test. 7/7 pass; mutations (stored 26, a `countingYear` key) fail as expected. Readability: all lines under band. No AGENTS.md code gates ran (docs and data only).

Open:

- [ ] Stage B videos and `public/videos/journals/world-wars/manifest.json`: build gate is closed. Nothing under `public/videos/`.
- [ ] Human educator sign-off: none. Hardest look: the 7-10 school morning.
- [ ] Owner: accept the quiet-hour clip as the second story, and the Christmas cut.
- [ ] Integrator, later, not now: merge a manifest into `public/videos/journal-manifest.json`, and add a fly-to in `src/components/journal-player.tsx`. This branch cannot edit those.

Resume: `git fetch origin && git checkout feat/journal-world-wars-spec && git merge --no-edit origin/main`, then the two node commands above.
