# Journal P8 — Freedom Fighters

- **Topic:** Freedom fighters (2 videos)
- **Status:** GATED (educator sign-off in writing required) + PENDING OWNER PICK (5 vs 10 — this spec covers all 10 candidates across the 5 specs, so either pick works)
- **Branch:** `feat/journal-freedom-fighters-spec`
- **Proposed video count:** 2 — PROPOSED, pending owner approval. Never present as decided.
- **Date:** 2026-11-10
- **Sources consulted:**
  - `~/workspace/journal-p8-candidates.md` (2026-11-10, 10 candidates with sourced facts)
  - `~/workspace/journal-106-coverage.md` (audit vs main `f37dea50`, 2026-11-10)
  - `~/workspace/meridian-scaling-lens-breakdown.md` §7 P8, lines 1249–1424 (gate wording)
  - Live web verification: none needed beyond the candidates file — every fact below reuses a
    sourced fact from the candidates file. No new fact was introduced.

## Expert seats

- **Historian seat — OWNS this topic.** World history and social studies sit with the
  Historian. This spec (freedom fighters) is owned by the HISTORIAN seat.
- **Educator seat — BLOCKED (no named educator exists).** One educator sign-off per topic, as
  usual. The signer must approve, in writing:
  1. The per-story production process (narration script drawn only from the entry's facts +
     what is visible; no invented facts; "Hey kids, have you heard about this place?" opening;
     bed at 30%; limiter at −1 dB on any re-mix).
  2. The freedom-fighter content in these two stories — sensitivity + correctness for a kids'
     audience (a wrong or careless telling of a struggle story is the failure this packet
     cannot absorb).
  3. The age-appropriateness of the tone, especially for Jhansi (battle story for kids —
     keep to the verified outline only, no colourful detail, no gore).
  Until a named educator signs, this spec stays GATED and no batch production starts.
- **Five lenses** (architect, UI/UX designer, game developer, researcher, educator) apply as
  usual per §7 P8.
- Biology exclusion: not applicable — no biology in P8 topics; nothing removed.

## Topic scope

Two journal entries about freedom fighters — people who fought for their people's freedom,
told through the places that remember them. One story is about endurance (a prison cell held
for 18 years); the other is about a battle (a queen who held a fort). Both are human stories,
not political framing.

## Why this is not in the 106

Per `~/workspace/journal-106-coverage.md` (audit §7, "Freedom fighters — MISSING"):
**nothing** in the 106 is a freedom-fighter story. Closest: Fort Robinson notes Crazy
Horse's death in 1877 in one line; the Alamo is a siege story, not a freedom-fighter story.
Both verified "not in the 106" live against the manifest on 2026-11-10: neither "Robben
Island" nor "Jhansi Fort" appears as a manifest key. This category is wholly missing, so
both videos are additive only — no existing story is touched, per §7.

**No double-counting:** Robben Island also fits "great leaders" — it is assigned HERE only.
Do not count it under great leaders too.

## Video list

### 1. Robben Island — Cape Town, South Africa

- **Kid hook:** a tiny island prison cell where Mandela slept on the floor for 18 years.
- **Visible verb:** the small prison cell with its thin mat on the floor; the ferry crossing
  to the island.
- **Key facts:**
  1. Nelson Mandela was imprisoned on Robben Island for 18 of his 27 years in prison
     (1964–1982).
     — Source: https://www.nelsonmandela.org/trials-and-prison-chronology and
     http://www.guinnessworldrecords.com/world-records/77725-longest-period-of-incarceration-for-a-future-head-of-state
     — Confidence: **HIGH** (basis: the Nelson Mandela Foundation's own chronology;
     the 27-year total is uncontested).
  2. Robben Island became a UNESCO World Heritage Site in 1999.
     — Source: https://www.nelsonmandela.org/trials-and-prison-chronology
     — Confidence: **HIGH**.

### 2. Jhansi Fort — Jhansi, India

- **Kid hook:** a queen who rode into battle with her son on her back and a sword in each hand.
- **Visible verb:** the fort walls on the hill above Jhansi; flags over the ramparts.
- **Key facts:**
  1. Rani Lakshmibai, queen of Jhansi, led troops in the Indian Rebellion of 1857.
     — Source: https://www.nationalgeographic.com/history/history-magazine/article/india-warrior-queen-lakshmi-bai-fought-british-rule?userab=ng_pw_copy-287%2Avariant_b-1127
     — Confidence: **HIGH on the outline** (basis: National Geographic history feature).
  2. She held the fort against siege in March–April 1858, then died in battle in June 1858.
     — Source: https://www.nationalgeographic.com/history/history-magazine/article/india-warrior-queen-lakshmi-bai-fought-british-rule?userab=ng_pw_copy-287%2Avariant_b-1127
     — Confidence: **HIGH on the outline; MEDIUM on colourful details** — National Geographic
     notes "history and myth are inseparable in her story". **Keep the clip to the verified
     outline only.** No colourful detail, no invented dialogue, no gore.
- **Tone flag:** battle story for kids — keep it to the verified outline only (see above).
  The "son on her back, sword in each hand" image is the kid hook, not a verified fact to
  narrate as history; the narration states only the sourced outline.

## Agent prompt (copy-paste)

```
You are the build agent for Meridian journal P8 — Freedom Fighters
(branch feat/journal-freedom-fighters-spec). SPEC ONLY until the owner picks
and the educator signs — do NOT build video until gated approval is on file.

EXPERTISE REQUIRED: Historian seat owns this topic (world history, social
studies). All history in these two stories must pass the Historian's check:
cited, dated, and told as human stories, never political framing. Educator
seat is BLOCKED (no named educator) — the educator sign-off in writing is
still owed before batch production.

DELIVERABLES: 2 journal videos, 10 seconds each:
  1. Robben Island, Cape Town, South Africa
  2. Jhansi Fort, Jhansi, India
Each video: narration script drawn ONLY from the entry's sourced facts +
what is visible (no invented facts); opening line "Hey kids, have you heard
about this place?"; per-story captions/VTT + transcript.

TECH (v4 recipe — the keeper is v4, NOT v3):
  - AI video-gen + Avocado TTS + ffmpeg
  - Storyteller voice: Magnus, 86–138 Hz (the owner's ear-approved v4 voice)
  - 1152x768, 24fps, h264 + AAC
  - Narration bed at 30%; limiter at −1 dB on any re-mix
  - 10 s fits ~8 s of speech — keep the script short
  - Tap-to-play, preload=none. LAZY-LOAD LAW: video data loads ONLY when the
    user taps play, or in the background while the user is playing the game.
    Nothing else loads video. Journal rotation: 1 entry per 30-minute clock
    window; 106 entries over 53 hours; movies stream on demand only, never
    precached.

TONE: Robben Island is endurance — a small cell, a long wait, freedom won by
standing firm. Jhansi is a battle story for kids — KEEP TO THE VERIFIED
OUTLINE ONLY. National Geographic notes history and myth blur in her story;
no colourful detail, no invented dialogue, no gore.

NO POLITICS ANYWHERE. Freedom fighters = human stories, never political
framing. World view, not US-heavy.

ASSIGNMENT RULE: Robben Island is counted HERE only — it also fits "great
leaders" but must NOT be double-counted.

GATES (all must pass, in order): tsc, npm test, test:worker, lint-cards
GATE PASSED, build:pages, Playwright E2E sequential --workers=1, panel
review, educator sign-off IN WRITING. MERGE-READY requires the orchestrated
scrum verdict + an independent reviewer outside the build chain — never
self-declare merge-ready. Never merge; merging stays the owner's decision.

VERIFICATION PROTOCOL (forcing rule — a story without these is incomplete):
  (1) live web search grounds every key fact — answering from memory is
      forbidden; (2) every key fact carries a named site source (URL +
      access date) and a confidence level HIGH / MEDIUM / LOW; (3) any fact
      with no source is marked UNVERIFIED and never asserted as fact;
  (4) re-check anything time-sensitive against a current source — a stale
      fact is wrong.
  VIDEO-AUDIO LAW: every delivered video file must be verified BEFORE
  delivery — ffprobe shows an audio stream AND volumedetect mean volume is
  above silence in the playing segments. A video with no audio stream, or
  silent audio, never goes out. Playwright recordings have no audio by
  design: muxing is mandatory and must be verified on the OUTPUT file,
  never assumed.
  Per-story checks are measurements with recorded numbers (duration, full
  decode, MD5 vs approved cut, frame checks, audio levels, bed-at-30%
  measurement, human listen check). A check with no number is UNVERIFIED.
```

## Open questions for the owner

1. **5 vs 10:** does P8 add 5 entries (one per gap) or 10 (two per gap)? This spec covers
   both videos so either pick works — but no build starts until he picks.
2. **v3-vs-v4 listen-verdict (UNRESOLVED CONTRADICTION, do not resolve silently):** the P8
   gate names "the owner's listen-verdict on v3". The current keeper is v4, and the owner's
   ear approved v4's Magnus narration on 2026-11-08. It is not recorded whether that approval
   satisfies the gate as written, or whether a fresh listen-verdict is required. His call.
3. **Q14/Q15 written confirmation and constitution-first ordering:** the owner's 3 open calls
   from the 12:52 UTC split table (recorded in the candidates file) — his decisions, not in
   this spec.
4. **Educator naming:** who is the named educator/SME who signs this topic in writing?
   The seat is blocked until he names one.

## Definition of done

- [ ] This spec file complete: both videos listed with sourced facts + confidence.
- [ ] Educator sign-off in writing on file (production process + freedom-fighter content
      sensitivity and correctness + age-appropriateness of the Jhansi tone).
- [ ] Owner pick on file: 5 vs 10.
- [ ] Owner's v3-vs-v4 listen-verdict question answered.
- [ ] Agent prompt handed to the build agent with the Historian seat named.
- [ ] Per-story production process written before any batch story is produced.
- [ ] Both videos pass all gates (tsc, npm test, test:worker, lint-cards GATE PASSED,
      build:pages, Playwright E2E sequential --workers=1, panel review) with audio verified
      on the output files, and the scrum + independent reviewer verdicts are on file.
- [ ] Additive only: no existing 106 story changed; Robben Island counted here only,
      not double-counted under great leaders.
