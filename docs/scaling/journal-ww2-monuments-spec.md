# Journal P8 — World War Monuments

- **Topic:** World War monuments (2 videos)
- **Status:** GATED (educator sign-off in writing required) + PENDING OWNER PICK (5 vs 10 — this spec covers all 10 candidates across the 5 specs, so either pick works)
- **Branch:** `feat/journal-ww2-monuments-spec`
- **Proposed video count:** 2 — PROPOSED, pending owner approval. Never present as decided.
- **Date:** 2026-11-10
- **Sources consulted:**
  - `~/workspace/journal-p8-candidates.md` (2026-11-10, 10 candidates with sourced facts)
  - `~/workspace/journal-106-coverage.md` (audit vs main `f37dea50`, 2026-11-10)
  - `~/workspace/meridian-scaling-lens-breakdown.md` §7 P8, lines 1249–1424 (gate wording)
  - Live web verification: none needed beyond the candidates file — every fact below reuses a
    sourced fact from the candidates file. No new fact was introduced.

## Expert seats

- **Historian seat — OWNS this topic.** World history, world wars, and social studies sit with the
  Historian. This spec (WWII monuments) is owned by the HISTORIAN seat.
- **Educator seat — BLOCKED (no named educator exists).** One educator sign-off per topic, as
  usual. The signer must approve, in writing:
  1. The per-story production process (narration script drawn only from the entry's facts +
     what is visible; no invented facts; "Hey kids, have you heard about this place?" opening;
     bed at 30%; limiter at −1 dB on any re-mix).
  2. The WWII content in these two stories — sensitivity + correctness for a kids' audience
     (a wrong or careless telling of a war story is the failure this packet cannot absorb).
  3. The age-appropriateness of the tone flags in this spec (gentle remembering, no battle
     re-enactment, no graphic detail).
  Until a named educator signs, this spec stays GATED and no batch production starts.
- **Five lenses** (architect, UI/UX designer, game developer, researcher, educator) apply as
  usual per §7 P8.
- Biology exclusion: not applicable — no biology in P8 topics; nothing removed.

## Topic scope

Two journal entries about World War II monuments — places built to remember people who died
in the war, told as human stories for kids aged 5th grade and up. Scope is remembrance, not
war: no battle re-enactment, no weapons, no graphic detail, no political framing (see the
no-politics rule below).

## Why this is not in the 106

Per `~/workspace/journal-106-coverage.md` (audit §5, "World War monuments — MISSING"): **no
WWII monument is in the 106.** The only borderline entries are Memorial Stadium (named for
Nebraskans lost in war — but the entry is about the football stadium, not a monument) and the
SAC Museum (Cold War bombers/missiles, not WWII). Both verified "not in the 106" live against
the manifest on 2026-11-10: neither "Normandy American Cemetery" nor "USS Arizona Memorial"
appears as a manifest key. This category is wholly missing, so both videos are additive only —
no existing story is touched, per §7.

## Video list

### 1. Normandy American Cemetery — Omaha Beach, France

- **Kid hook:** rows of white crosses on a cliff above the beach where boats landed on D-Day.
- **Visible verb:** waves rolling onto Omaha Beach below the cliff; flags waving over the rows
  of white crosses.
- **Key facts:**
  1. The cemetery is in Colleville-sur-Mer, France, on a cliff above Omaha Beach.
     — Source: https://www.abmc.gov/cemeteries-memorials/about-normandy-american-cemetery/
     — Confidence: **HIGH** (ABMC, official; basis: the American Battle Monuments Commission
     is the cemetery's custodian).
  2. It holds the graves of almost 9,400 US dead, most from the D-Day landings and the
     operations that followed.
     — Source: https://www.abmc.gov/cemeteries-memorials/about-normandy-american-cemetery/
     — Confidence: **HIGH** (ABMC, official).
- **Tone flag:** remembrance, not battle. The story is about the quiet rows of crosses and
  the people remembered there — never a re-enactment of the landings.

### 2. USS Arizona Memorial — Pearl Harbor, Hawaii, USA

- **Kid hook:** a white bridge floating over a sunken battleship you can still see below.
- **Visible verb:** the sunken ship visible in the clear water beneath the white memorial
  bridge.
- **Key facts:**
  1. The memorial marks the resting place of 1,102 of the 1,177 sailors and Marines killed
     on USS Arizona on 7 December 1941.
     — Source: https://www.nps.gov/perl/learn/historyculture/uss-arizona.htm and
     https://en.wikipedia.org/wiki/USS_Arizona_Memorial
     — Confidence: **HIGH** (NPS official + Wikipedia; basis: NPS is the memorial's manager).
  2. The memorial was dedicated in 1962.
     — Source: https://en.wikipedia.org/wiki/USS_Arizona_Memorial
     — Confidence: **HIGH**.
- **Tone flag:** it is a tomb — the story must be gentle, about remembering, not about the
  explosion. No explosion imagery, no battle sound. Quiet water, white bridge, remembering.

## Agent prompt (copy-paste)

```
You are the build agent for Meridian journal P8 — World War Monuments
(branch feat/journal-ww2-monuments-spec). SPEC ONLY until the owner picks
and the educator signs — do NOT build video until gated approval is on file.

EXPERTISE REQUIRED: Historian seat owns this topic (world history, world
wars, social studies). All history in these two stories must pass the
Historian's check: cited, dated, and told as human stories, never political
framing. Educator seat is BLOCKED (no named educator) — the educator sign-off
in writing is still owed before batch production.

DELIVERABLES: 2 journal videos, 10 seconds each:
  1. Normandy American Cemetery, Omaha Beach, France
  2. USS Arizona Memorial, Pearl Harbor, Hawaii, USA
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

TONE: USS Arizona is a tomb — gentle remembering story, NOT the explosion.
Normandy is remembrance, not battle. No battle re-enactment, no weapons,
no graphic detail.

NO POLITICS ANYWHERE. World Wars = human stories, never political framing.
World view, not US-heavy.

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
- [ ] Educator sign-off in writing on file (production process + WWII content sensitivity
      and correctness + age-appropriateness of the tone flags).
- [ ] Owner pick on file: 5 vs 10.
- [ ] Owner's v3-vs-v4 listen-verdict question answered.
- [ ] Agent prompt handed to the build agent with the Historian seat named.
- [ ] Per-story production process written before any batch story is produced.
- [ ] Both videos pass all gates (tsc, npm test, test:worker, lint-cards GATE PASSED,
      build:pages, Playwright E2E sequential --workers=1, panel review) with audio verified
      on the output files, and the scrum + independent reviewer verdicts are on file.
- [ ] Additive only: no existing 106 story changed.
