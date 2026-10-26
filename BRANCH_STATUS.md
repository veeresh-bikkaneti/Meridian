# Branch status — fix/199-storyteller-guard

Issue: #199 — storyteller audio follow-ups (per-family CI guard test + stale `storyteller-lines.ts` header).

## Done
- [x] Read issue #199 in full. Measured all 14 shipped clips first-hand (ffmpeg 8.1.2, 2026-10-26): every clip is MP3, 24,000 Hz, mono; integrated loudness −16.5…−17.4 LUFS — exactly the accepted profile in the issue.
- [x] New CI guard: `scripts/storyteller-audio-guard.test.mjs` (runs under `npm test`, so it is in the Node CI job). Per family (greetings greet-01…06, pokes poke-01…05, narration reveal/hook/summary):
  - Tier 1 (always, plain Node, no tools): exact 14-file set present; every clip's first MP3 frame header parses as 24 kHz / mono / Layer III.
  - Tier 2 (ffmpeg on PATH): ebur128 integrated loudness must sit in −17.9…−16.0 LUFS (measured band ± 0.5 dB measurement slack). Without ffmpeg this tier is an explicit skip, never a silent pass; Tier 1 still runs.
  - Honest limit, stated in the test header: a file probe cannot prove which voice is speaking; format + loudness are the measurable fingerprint of the accepted renders.
  - Negative control: a Comet clip (44.1 kHz stereo, −26.4 LUFS) and a Grandpa clip (−22.4 LUFS) both fall outside the guard, so it discriminates.
  - Guard result on this branch: 6/6 pass, loudness tier executed (not skipped) on this machine.
- [x] Header cure: `src/components/storyteller-lines.ts` now states the post-#174 truth — Grok-generated Santa voice accepted 2026-10-21, all 14 clips, DO NOT regenerate via the Kokoro scripts (superseded `am_fenrir`), with a pointer to the guard test. A test in the guard file pins this wording so the header cannot quietly go stale again.

## Pending
- [ ] Full gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`
- [ ] PR opened (no merge — owner merges)

## Notes
- Coordinator D (QA & Performance + Narrative squad); #193 = PR #256, #200 = PR #257, #191/#214 on a sibling branch.
