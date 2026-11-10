# Journal — The Modern World

- **Topic:** The modern world — how England formed, how the world was connected, how machines changed everything
- **Status:** GATED (educator sign-off in writing — see § Educator gate)
- **Branch (proposed):** `feat/journal-modern-world-spec`
- **Proposed video count:** 3 — PROPOSED, pending owner approval. Never presented as decided.
- **Sources consulted:** `~/workspace/journal-106-coverage.md` (audit 2026-11-10, main `f37dea50`); `~/workspace/journal-p8-candidates.md`; `~/workspace/meridian-scaling-lens-breakdown.md` §7 P8 (lines 1249–1424); live web search 2026-11-10 for every key fact below.

## Topic scope

Three 10-second journal movies about how the modern world took shape: one country becoming one country (England), one age when ships connected far-apart peoples (exploration — with the people who were already living in the places reached), and one age when machines changed how everyone worked and lived (the Industrial Revolution). Factual, kid-level, no present-day politics.

## Why this is not in the 106

The coverage audit finds historical places and famous spots well covered, but nothing about how a nation forms, nothing about the Age of Exploration, and nothing about industrialisation as a story. Verified 2026-11-10 against the live manifest: none of England's formation, exploration, or the industrial revolution appears in the 106 manifest keys. These 3 are new ground — they are processes and eras, not places already pinned.

## Expert seats

In addition to the five lenses (architect, UI/UX designer, game developer, researcher, educator):

- **Historian seat: owns ALL THREE videos in this spec** (world history, world wars, social studies).
- **Educator seat: BLOCKED (no named educator exists).** See § Educator gate — the signer must approve, in writing, exactly the items listed there.

## Video list (3, PROPOSED)

### 1. How England became one country
- **Kid hook:** Once there were seven little kingdoms fighting each other — then one king put the pieces together like a puzzle.
- **Visible verb:** Seven small crowns on a map joining into one big crown.
- **Key facts:**
  - After the Romans left Britain in 410 AD, Anglo-Saxon settlers divided the land into seven kingdoms — the Heptarchy — that often fought each other. Source: https://twinkl.ca/homework-help/history-homework-help/anglo-saxons-facts-for-kids/who-were-the-anglo-saxon-kings — **MEDIUM** (education site; standard account, corroborated by History Extra below).
  - In 927, Æthelstan — grandson of Alfred the Great — took the last Viking-held kingdom, York, and became the first king of all England; he was crowned at Kingston in 925 and in 927 received the submission of the kings of Scotland, Strathclyde, and Wales at Eamont Bridge. Source: https://www.historyextra.com/period/anglo-saxon/athelstan-life-rule-guide-king-england/ — **HIGH** (BBC History Magazine).
- **Tone note:** Kid-level and factual. No present-day politics — the clip is about 927, not about any modern question.

### 2. The Age of Exploration — ships that connected the world
- **Kid hook:** Brave sailors crossed oceans nobody had mapped — and found that people were already living everywhere they landed.
- **Visible verb:** A small wooden ship on a huge ocean; a new coastline appearing; two groups of people meeting on a shore.
- **Key facts:**
  - The Age of Exploration ran from the 15th to the 17th centuries; in 1492 Christopher Columbus, sailing under the Spanish flag, reached the Caribbean, believing he had found a new route to Asia. Source: https://learninghaven.com/social-studies/world-history/explorers/ — **MEDIUM** (education site citing Britannica); the 1492 date itself is **HIGH** (universally documented).
  - Ferdinand Magellan's expedition left Spain in 1519 and its surviving ship returned in 1522 — the first voyage all the way around the world. Source: https://learninghaven.com/social-studies/world-history/explorers/ (citing Britannica) — **HIGH** on the dates.
  - The lands Europeans reached were already inhabited: before European arrival the Americas were home to diverse peoples — the Maya, Aztec, Inca, and many Indigenous nations of North America — with their own cities, languages, and cultures. Source: https://ww2.jacksonms.gov/fulldisplay/d61OUD/5OK091/HistoryOfTheNewWorld.pdf — **MEDIUM** (secondary summary; the underlying fact is **HIGH** and corroborated by the Britannica Maya article).
- **Tone note — who was already living there:** The narration must say, in the clip itself, that people already lived in the places reached — never present empty lands. "Discover" is not used without that correction. No present-day politics; the consequences for Indigenous peoples (disease, loss of land) are named in one honest kid-level line, not dwelt on and not hidden.

### 3. The Industrial Revolution — machines change everything
- **Kid hook:** One puffing engine changed the world: cloth, trains, cities — and kids working in factories, too.
- **Visible verb:** A steam engine chugging; a spinning machine whirring; a town growing around a mill.
- **Key facts:**
  - The Industrial Revolution was the change from farming and handcraft to industry and machine manufacturing; it began in Britain in the 18th century (Toynbee's classic dates: 1760–1840) and spread from there around the world. Source: https://www.britannica.com/event/Industrial-Revolution — **HIGH** (Britannica).
  - James Watt greatly improved the steam engine in the 1760s and was granted a patent in 1769; by 1800 Britain had over 2,500 steam engines, most in mines, cotton mills, and factories. Source: https://www.britannica.com/summary/Industrial-Revolution-Key-Facts and https://senschien.com/elohim/hosp/upload/files/10277221184.pdf — **HIGH** on Watt 1769 (Britannica); **MEDIUM** on the 2,500 figure (secondary PDF).
- **Tone note:** The clip shows both sides in one line — machines made more things faster, and many people (including children) worked long hours in the new factories. Factual, kid-level, no present-day politics.

## Agent prompt (copy-paste)

```
You are the HISTORIAN seat for the Meridian journal expansion
(world history, world wars, social studies). Work alongside the five
lenses: architect, UI/UX designer, game developer, researcher, and
educator (educator seat BLOCKED — no named educator; sign-off in
writing is required before batch production — see the spec's Educator
gate).

EXPERTISE REQUIRED: world history for children aged 5th grade and
up, with a historian's discipline about what is documented vs what is
retold. You write narration only from the spec's sourced facts; you
never invent a fact, a date, or a quote. For the Age of Exploration
clip you MUST name, in the narration, that people were already living
in the places reached — never present empty lands, never use
"discover" without that correction. No present-day politics anywhere.

DELIVERABLES (branch feat/journal-modern-world-spec):
- 3 videos, 10 seconds each, one per entry in the spec. PROPOSED count —
  pending owner approval.
- Tech = v4 recipe: AI video-gen + Avocado TTS + ffmpeg. Storyteller
  voice: Magnus (86–138 Hz). 1152x768, 24fps, h264 + AAC.
- Narration opens "Hey kids, have you heard about this place?" and is
  drawn ONLY from the entry's sourced facts + what is visible on screen.
  No invented facts. Bed at 30%. Limiter at −1 dB on any re-mix.
  10 s fits ~8 s of speech — cut, never rush.
- Tap-to-play, preload=none; movies stream on demand only, never
  precached. Lazy-load law: video data loads only (a) when the user
  taps play, or (b) in background prefetch while the user is playing.
- Captions/VTT + a transcript per clip. Journal rotation: 1 entry per
  30-minute clock window (JOURNAL_WINDOW_MS = 1_800_000, B8).
- Sensitivity review is part of the brief: a story with facts right
  and tone wrong is a failure. World view, not US-heavy: England's
  formation is one country's story among many; the exploration clip
  centres the peoples already living in the places reached; the
  Industrial Revolution clip names both the machines and the children
  who worked in the factories. NO POLITICS anywhere.

GATES (all must pass, in order): tsc → npm test → test:worker →
lint-cards GATE PASSED → build:pages → Playwright E2E sequential
--workers=1 → panel review → educator sign-off in writing.

VERIFICATION PROTOCOL (per clip, recorded numbers, not vibes):
live web search grounds every fact (named site source + access date +
confidence HIGH/MEDIUM/LOW; no source = UNVERIFIED, never asserted);
duration check; full decode; video MD5 vs approved cut; frame checks
(start, punchline beat, final frame); audio levels; bed-at-30%
measurement; human listen check. VIDEO-AUDIO LAW: ffprobe must show
an audio stream AND volumedetect must show non-silent audio in the
playing segments — a silent video never ships.
```

## Educator gate — what the signer must approve (in writing)

The educator seat is BLOCKED — no named educator exists. Before batch production, a named human educator / SME must sign IN WRITING:

1. The per-story production process (narration drawn only from sourced facts + what is visible).
2. Historical correctness of all 3 entries (dates, Æthelstan 927, Columbus 1492, Magellan 1519–1522, Watt 1769) — historian + educator.
3. The Age of Exploration treatment: peoples already living in the places reached are named in the clip; "discover" is not used uncorrected; consequences for Indigenous peoples are named honestly at kid level.
4. The Industrial Revolution treatment: both the machines and the child labour named, at kid level, with no present-day politics.
5. Age-fit for 5th grade and up (language, concepts, and visuals a 10-year-old can follow without an adult explaining).

## Open questions for the owner

1. Approve the PROPOSED count of 3 videos (or a different number)?
2. Name the educator / SME who signs the gate above.
3. Unresolved v3-vs-v4 gate question (from §7 P8): the owner's ear approved v4's Magnus narration on 2026-11-08, but the written gate names a listen-verdict on v3. Does the v4 approval satisfy the gate, or is a fresh listen-verdict required?
4. Batch size: 3 at once, or one pilot clip first?
5. Age of Exploration: is one honest kid-level line about disease and loss of land the right depth, or should the clip stay on the voyages and the meeting only?
6. England's formation: acceptable as a single-country story, or should the framing be "how countries form" with England as one example among others?

## Definition of done

- [ ] Owner approves the proposed count (3) and answers the exploration-depth and England-framing questions.
- [ ] Educator/SME named and sign-off in writing on all 5 items in the Educator gate.
- [ ] Listen-verdict question (v3 vs v4) answered by the owner.
- [ ] Per-story production process written (pipeline: script from sourced facts only; voice direction; "Hey kids" opening; bed at 30%; video-discipline — never re-render approved video to add audio).
- [ ] All 3 clips pass every gate above, with recorded verification numbers per clip.
- [ ] Exploration clip verified to name the peoples already living in the places reached; no empty-lands framing, no uncorrected "discover", no present-day politics.
