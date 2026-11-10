# Journal P8 — Great Leaders

- **Topic:** Great leaders (2 videos)
- **Status:** GATED (educator sign-off in writing required) + PENDING OWNER PICK (5 vs 10 — this spec covers all 10 candidates across the 5 specs, so either pick works)
- **Branch:** `feat/journal-great-leaders-spec`
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
  Historian. This spec (great leaders) is owned by the HISTORIAN seat.
- **Educator seat — BLOCKED (no named educator exists).** One educator sign-off per topic, as
  usual. The signer must approve, in writing:
  1. The per-story production process (narration script drawn only from the entry's facts +
     what is visible; no invented facts; "Hey kids, have you heard about this place?" opening;
     bed at 30%; limiter at −1 dB on any re-mix).
  2. The leader content in these two stories — sensitivity + correctness for a kids' audience
     (a wrong or careless telling of a leader's story is the failure this packet cannot absorb).
  3. The age-appropriateness of how each leader's story is framed for kids (what the person
     stood for, told simply and truthfully).
  Until a named educator signs, this spec stays GATED and no batch production starts.
- **Five lenses** (architect, UI/UX designer, game developer, researcher, educator) apply as
  usual per §7 P8.
- Biology exclusion: not applicable — no biology in P8 topics; nothing removed.

## Topic scope

Two journal entries about great leaders — memorials to people, told through what the place
shows and what the person stood for. No entry in the 106 is about a person, so this category
is new ground for the journal. Scope is the person and the memorial; keep it to the verified
facts, told simply.

## Why this is not in the 106

Per `~/workspace/journal-106-coverage.md` (audit §6, "Great leaders — MISSING"): **no entry
is about a leader.** Closest: Mount Rushmore shows four presidential faces (the entry is
about the carving, not the men); Arbor Lodge names J. Sterling Morton (Arbor Day founder).
Both verified "not in the 106" live against the manifest on 2026-11-10: neither "Lincoln
Memorial" nor "Martin Luther King Jr. Memorial" appears as a manifest key. This category is
wholly missing as entries about a person, so both videos are additive only — no existing
story is touched, per §7.

## Video list

### 1. Lincoln Memorial — Washington DC, USA

- **Kid hook:** a giant seated Abraham Lincoln; the steps where MLK gave "I Have a Dream".
- **Visible verb:** the giant seated statue of Lincoln inside the marble hall; the long steps
  leading up to it.
- **Key facts:**
  1. The memorial honours Abraham Lincoln, 16th president of the United States (1861–1865).
     — Source: https://en.wikipedia.org/wiki/Lincoln_Memorial
     — Confidence: **HIGH** (basis: Wikipedia, stable long-standing article; the
     presidency dates are uncontested).
  2. Dedicated 30 May 1922.
     — Source: https://en.wikipedia.org/wiki/Lincoln_Memorial
     — Confidence: **HIGH**.
  3. The steps are where Martin Luther King Jr. gave his "I Have a Dream" speech.
     — Source: https://en.wikipedia.org/wiki/Lincoln_Memorial
     — Confidence: **HIGH** (basis: widely documented; the speech's location is
     uncontested).

### 2. Martin Luther King Jr. Memorial — Washington DC, USA

- **Kid hook:** a 30-foot King carved out of a stone mountain — the "Stone of Hope".
- **Visible verb:** the tall stone figure of King emerging from the mountain of stone.
- **Key facts:**
  1. Opened to the public 22 August 2011.
     — Source: https://gwtoday.gwu.edu/memorial-civil-rights-leader-opens-national-mall
     — Confidence: **HIGH** (basis: George Washington University news, contemporary report).
  2. First memorial on the National Mall honouring an African American.
     — Source: https://gwtoday.gwu.edu/memorial-civil-rights-leader-opens-national-mall
     — Confidence: **HIGH**.
  3. Address: 1964 Independence Avenue — 1964, the year of the Civil Rights Act.
     — Source: https://en.wikipedia.org/wiki/Memorials_to_Martin_Luther_King_Jr.
     — Confidence: **HIGH**.

## Agent prompt (copy-paste)

```
You are the build agent for Meridian journal P8 — Great Leaders
(branch feat/journal-great-leaders-spec). SPEC ONLY until the owner picks
and the educator signs — do NOT build video until gated approval is on file.

EXPERTISE REQUIRED: Historian seat owns this topic (world history, social
studies). All leader history in these two stories must pass the Historian's
check: cited, dated, and told as human stories, never political framing.
Educator seat is BLOCKED (no named educator) — the educator sign-off in
writing is still owed before batch production.

DELIVERABLES: 2 journal videos, 10 seconds each:
  1. Lincoln Memorial, Washington DC, USA
  2. Martin Luther King Jr. Memorial, Washington DC, USA
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

TONE: tell what each person stood for, simply and truthfully, through what
the memorial shows. No political framing, no present-day commentary.

NO POLITICS ANYWHERE. Leaders = human stories, never political framing.
World view, not US-heavy. NOTE: both leaders in this pair are American
because the memorials are; the P8 set as a whole stays world-view (India,
South Africa, Spain, Greece, France, Hawaii) — do not add further US-only
leaders to this topic without the owner's call.

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
5. **World-view balance:** both leaders in this pair are American. If he wants a non-US
   leader added to this topic (e.g. Gandhi, Mandela is already in freedom fighters), that is
   his call — do not add one unilaterally.

## Definition of done

- [ ] This spec file complete: both videos listed with sourced facts + confidence.
- [ ] Educator sign-off in writing on file (production process + leader content sensitivity
      and correctness + age-appropriateness of the framing).
- [ ] Owner pick on file: 5 vs 10.
- [ ] Owner's v3-vs-v4 listen-verdict question answered.
- [ ] Agent prompt handed to the build agent with the Historian seat named.
- [ ] Per-story production process written before any batch story is produced.
- [ ] Both videos pass all gates (tsc, npm test, test:worker, lint-cards GATE PASSED,
      build:pages, Playwright E2E sequential --workers=1, panel review) with audio verified
      on the output files, and the scrum + independent reviewer verdicts are on file.
- [ ] Additive only: no existing 106 story changed.
