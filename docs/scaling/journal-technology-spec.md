# Journal — Technology

- **Topic:** Technology — how we learned to talk across distance and think with machines
- **Status:** GATED (educator sign-off in writing — see § Educator gate)
- **Branch (proposed):** `feat/journal-technology-spec`
- **Proposed video count:** 3 — PROPOSED, pending owner approval. Never presented as decided.
- **Sources consulted:** `~/workspace/journal-106-coverage.md` (audit 2026-11-10, main `f37dea50`); `~/workspace/journal-p8-candidates.md`; `~/workspace/meridian-scaling-lens-breakdown.md` §7 P8 (lines 1249–1424); live web search 2026-11-10 for every key fact below.

## Topic scope

Three 10-second journal movies about communication and computing: the first phone call down a wire, the first phone call with no wire at all, and the first computers — machines so big they filled a room. Kid-level, world view, no US-heavy framing (the inventors happen to be in Scotland/America and the US; the story is what the machines did, not whose flag they carried).

## Why this is not in the 106

The coverage audit's categories have no technology entry at all — the 106 is places, nature, monuments, and stories. Verified 2026-11-10 against the live manifest: none of phone, computers (or telephone, mobile, ENIAC) appears in the 106 manifest keys. These 3 are wholly new ground.

## Expert seats

In addition to the five lenses (architect, UI/UX designer, game developer, researcher, educator):

- **Technology seat: HISTORIAN (historian.toml).** Phones and computers evolution is history — same seat as world history (owner call 2026-11-10). No technology content work proceeds until the educator sign-off is on file.
- **Educator seat: BLOCKED (no named educator exists).** See § Educator gate — the signer must approve, in writing, exactly the items listed there.

## Diagrams flag (rule 6)

All 3 videos still use the **v4 recipe** (AI video-gen + Avocado TTS + ffmpeg) — the tech does not change. Treatment differences, flagged here:

- **Early phone:** a simple on-screen diagram helps — a voice wave travelling down a wire from one room to another. Treatment: AI video-gen shows the wire and the wave as an animated line; no extra tooling. Flag for the historian seat to confirm the wave visual reads clearly at 1152x768.
- **Cell phone:** a simple on-screen diagram helps — a phone sending invisible waves up to a tower, then down to another phone. Treatment: AI video-gen shows the tower and the arcs; no extra tooling. Flag for the historian seat to confirm the tower-and-arcs visual reads clearly.
- **Computers:** a size-comparison visual helps — a room full of machine panels next to a small modern phone. Treatment: AI video-gen split-frame comparison; no extra tooling. Flag for the historian seat to confirm the comparison reads clearly and does not need a labelled diagram.

No video in this spec needs a different pipeline. If the technology seat finds a diagram does NOT read in AI video-gen, that is a treatment question for the owner — not a tech change.

## Video list (3, PROPOSED)

### 1. The first phone — "Mr. Watson, come here!"
- **Kid hook:** Two rooms, one wire — and a man's voice travels through it for the very first time.
- **Visible verb:** A voice wave rippling down a wire from one room to the next; a man picking up a receiver in surprise.
- **Key facts:**
  - Alexander Graham Bell was granted US Patent 174,465 for the telephone on 7 March 1876; three days later, on 10 March 1876, he made the first intelligible telephone call in his Boston laboratory: "Mr. Watson — come here — I want to see you." Source: https://scottishinventions.com/inventions/telephone — **HIGH**; corroborated by https://ethw.org/Telephone (IEEE Engineering and Technology History Wiki).
  - Bell's device turned sound waves into electrical waves that travelled down a wire and were turned back into sound at the other end. Source: https://ethw.org/Telephone — **HIGH** (IEEE).
- **Diagram note:** Voice-wave-down-a-wire diagram (see § Diagrams flag).

### 2. The cell phone — a phone with no wire
- **Kid hook:** A phone as heavy as a brick, costing as much as a car — and it was the first phone you could carry anywhere.
- **Visible verb:** A man on a New York street holding a big brick phone to his ear; invisible waves rising to a tower.
- **Key facts:**
  - On 3 April 1973, Motorola engineer Martin Cooper made the first public handheld mobile phone call from a DynaTAC prototype on a New York street, calling Joel Engel at rival AT&T. Source: https://www.britannica.com/biography/Martin-Cooper — **HIGH** (Britannica).
  - The first commercially available handheld cell phone, the Motorola DynaTAC 8000X, went on sale in 1983 for $3,995; it weighed 2.5 pounds (1.1 kg), was 9 inches tall, and gave about 30 minutes of talk per charge. Source: https://en.wikipedia.org/wiki/DynaTAC — **HIGH** (Wikipedia, corroborated by Britannica).
- **Diagram note:** Phone-to-tower waves diagram (see § Diagrams flag).

### 3. Computers — a machine that filled a room
- **Kid hook:** The first computers were bigger than your classroom — and a phone in your pocket today is millions of times more powerful.
- **Visible verb:** A huge wall of humming panels with glowing tubes; the same wall shrinking down into a pocket phone.
- **Key facts:**
  - ENIAC, built at the University of Pennsylvania during World War II by John Mauchly, J. Presper Eckert Jr., and colleagues, was the first programmable general-purpose electronic digital computer; completed by February 1946, it cost the government $400,000. Source: https://www.britannica.com/technology/ENIAC — **HIGH** (Britannica).
  - ENIAC filled a 50-by-30-foot basement, held about 18,000 vacuum tubes, and could do up to 5,000 additions per second — several orders of magnitude faster than any calculating machine before it. Source: https://www.britannica.com/technology/ENIAC — **HIGH** (Britannica).
- **Diagram note:** Room-vs-pocket size comparison (see § Diagrams flag). The "millions of times more powerful" line is a rhetorical comparison, not a measured figure — **UNVERIFIED as a precise number**; the narration must say "far more powerful" or give no multiplier. Do not state a multiplier.

## Agent prompt (copy-paste)

```
You are the HISTORIAN seat for the Meridian journal expansion
(technology: phones/computers evolution is history — historian.toml, owner
call 2026-11-10). Work alongside
the five lenses: architect, UI/UX designer, game developer, researcher,
and educator (educator seat BLOCKED — no named educator; sign-off in
writing is required before batch production — see the spec's Educator
gate).

EXPERTISE REQUIRED: history of technology for children aged 5th
grade and up. You explain HOW a machine works in one kid-level line
(a wave down a wire, waves to a tower, tubes that count) without
inventing a mechanism or a number. You write narration only from the
spec's sourced facts; you never invent a fact, a date, a quote, or a
statistic. The "millions of times more powerful" multiplier is
UNVERIFIED — never state a multiplier.

DELIVERABLES (branch feat/journal-technology-spec):
- 3 videos, 10 seconds each, one per entry in the spec. PROPOSED count —
  pending owner approval.
- Tech = v4 recipe: AI video-gen + Avocado TTS + ffmpeg. Storyteller
  voice: Magnus (86–138 Hz). 1152x768, 24fps, h264 + AAC.
  DIAGRAMS: each video may carry one simple on-screen diagram
  (voice wave down a wire / phone-to-tower arcs / room-vs-pocket
  size comparison), rendered as part of the AI video-gen clip — NO
  change of pipeline, no extra tooling. Confirm each diagram reads
  clearly at 1152x768 in the frame checks; if one does not read,
  flag it as a treatment question for the owner, do not change tech.
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
  and tone wrong is a failure. World view, not US-heavy: the story is
  what the machines did for everyone, not whose flag they carried.
  NO POLITICS anywhere.

GATES (all must pass, in order): tsc → npm test → test:worker →
lint-cards GATE PASSED → build:pages → Playwright E2E sequential
--workers=1 → panel review → educator sign-off in writing.

VERIFICATION PROTOCOL (per clip, recorded numbers, not vibes):
live web search grounds every fact (named site source + access date +
confidence HIGH/MEDIUM/LOW; no source = UNVERIFIED, never asserted);
duration check; full decode; video MD5 vs approved cut; frame checks
(start, punchline beat, final frame — INCLUDING whether the diagram
reads clearly); audio levels; bed-at-30% measurement; human listen
check. VIDEO-AUDIO LAW: ffprobe must show an audio stream AND
volumedetect must show non-silent audio in the playing segments — a
silent video never ships.
```

## Educator gate — what the signer must approve (in writing)

The educator seat is BLOCKED — no named educator exists. Before batch production, a named human educator / SME must sign IN WRITING:

1. The per-story production process (narration drawn only from sourced facts + what is visible).
2. Technical correctness of all 3 entries (dates, patent, prices, sizes, speeds) — historian seat + educator.
3. The on-screen diagrams: each one reads clearly to a 10-year-old at 1152x768 and teaches the mechanism correctly (wave down a wire; waves to a tower; room vs pocket).
4. The "far more powerful" comparison in the computers clip (no unverified multiplier).
5. Age-fit for 5th grade and up (language, concepts, and visuals a 10-year-old can follow without an adult explaining).

## Open questions for the owner

1. Approve the PROPOSED count of 3 videos (or a different number)?
2. Technology seat: RESOLVED by owner call 2026-11-10 — historian.toml (phones/computers evolution is history).
3. Name the educator / SME who signs the gate above.
4. Unresolved v3-vs-v4 gate question (from §7 P8): the owner's ear approved v4's Magnus narration on 2026-11-08, but the written gate names a listen-verdict on v3. Does the v4 approval satisfy the gate, or is a fresh listen-verdict required?
5. Batch size: 3 at once, or one pilot clip first (early phone) with a listen-verdict before the rest?
6. Diagrams: if a diagram does not read clearly in AI video-gen, is a simpler treatment acceptable, or does the owner want a different diagram approach?
7. Should the computers clip include a modern-phone comparison at all, or stay on ENIAC alone?

## Definition of done

- [ ] Owner approves the proposed count (3) and names the technology seat-holder.
- [ ] Educator/SME named and sign-off in writing on all 5 items in the Educator gate.
- [ ] Listen-verdict question (v3 vs v4) answered by the owner.
- [ ] Per-story production process written (pipeline: script from sourced facts only; voice direction; "Hey kids" opening; bed at 30%; video-discipline — never re-render approved video to add audio).
- [ ] All 3 clips pass every gate above, with recorded verification numbers per clip.
- [ ] All 3 diagrams verified to read clearly in the frame checks; v4 recipe unchanged — no tech change, no multiplier stated in the computers clip.
