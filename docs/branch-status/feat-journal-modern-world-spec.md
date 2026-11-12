# BRANCH_STATUS — feat/journal-modern-world-spec

Stream 14. Journal spec for the modern world. Docs only. Clips gated.

**Status: SPEC SCREENED — AWAITING OWNER AND EDUCATOR. STAGE B SHUT.**

## Task

Screen the proposed 3 clips against standard §7a. For each kept clip, write contract I5 data: group, objective, C3 code (live or UNVERIFIED), the opening question (where / how far / how many years ago), one read-aloud retrieval, captions and transcript, a globe fly-to with a Flat 2D pin.

## Scope

May edit only:

- `docs/scaling/journal-modern-world-spec.md`
- `docs/scaling/journals/modern-world/**`
- `public/videos/journals/modern-world/**` (unused; Stage B)
- this file

## Done

- [x] Merged `origin/main` at session start (main was `8dee5bad`) and again on 2026-11-10 after owner trim notes (main was `424cff9b`).
- [x] §7a screen. Three political or contested tellings cut and logged. Three measurement stories kept, count still PROPOSED.
- [x] `docs/scaling/journals/modern-world/clips.json` — I5 fields plus the one `stretch` main added. Fact ids in `sources.md`. Year-gap answers stay `deviceYear - <year>`, computed at play time.
- [x] Draft VTT and transcript for each kept clip. The three tracks stay in sync. This journal has no separate narration `.txt`; the spoken line lives in the `.transcript.md` and the `.vtt`.
- [x] Narration trimmed to about 20 words for a 10-second clip, and every clip opens with "Hey kids, have you heard about this place?" Greenwich 23→20; Heart's Content 25→18 (kept 1866, the cable under the sea, and Heart's Content for the retrieval check; the "message could cross the ocean" clause stays in the host line after the film). Liverpool stayed at 17; opener punctuation only.
- [x] Globe: Full / Lite fly-to, Flat 2D pin, same question. Specified, not coded.
- [x] K-12 §9 block and unsigned educator block in the spec.
- [x] No mp4, no journal manifest, no `src/` edits.
- [x] No AGENTS.md code gates ran (docs only). No `check-clips.mjs` on this branch; word counts, the opener, and transcript/VTT sync were checked locally.

## Open

- Owner: confirm the 3 kept stories, name an educator, decide the "Hey kids" line for 18+, leave the railway mile length out or supply one primary source.
- Educator sign-off: not signed.
- Stage B films: blocked until the owner lifts the build gate.
- 18+ uses the same stretch as 10-18. I5 stores one extra question, not two. A harder third question was not invented to fill a slot.
- 9-12 C3 wording: UNVERIFIED (not fetched, not cited).
- CCSS math codes: not fetched; not cited.
- Heart's Content pin: MEDIUM (Wikipedia coordinates; the Canadian register has no lat/lon).
- Review-deck wiring and in-app fly-to need `src/` files this branch must not edit. Integrator, at Stage B only.
- No change needed in `docs/scaling/contracts.md`. The new `stretch` field is what this data uses.

## Readability (local, not a CI gate)

Run: local Flesch-Kincaid on the three narrations and the three 7-10 questions (2026-11-10, after the word-count trim). Grades: 1.9, 3.7, 2.3 (narration) and 0.5, 2.7, 2.3 (questions). All at or under grade 5. Not a CI gate.
