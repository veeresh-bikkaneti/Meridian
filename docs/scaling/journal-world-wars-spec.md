# Journal — World Wars (Human Stories)

- **Topic:** The World Wars as human stories — what ordinary people lived through
- **Status:** GATED (educator sign-off in writing — see § Educator gate)
- **Branch (proposed):** `feat/journal-world-wars-spec`
- **Proposed video count:** 2 — PROPOSED, pending owner approval. Never presented as decided.
- **Sources consulted:** `~/workspace/journal-106-coverage.md` (audit 2026-11-10, main `f37dea50`); `~/workspace/journal-p8-candidates.md`; `~/workspace/meridian-scaling-lens-breakdown.md` §7 P8 (lines 1249–1424); live web search 2026-11-10 for every key fact below.

## Topic scope

Two 10-second journal movies about the World Wars told as **human stories, not battles**: a Christmas when soldiers stopped fighting to sing, and a child writing letters home from far away. No strategy, no generals, no blame narratives, no politics. The wars are named and dated; the story is about people.

## Why this is not in the 106

The coverage audit (§5, "World War monuments — MISSING") finds no WWII monument in the 106 and nothing about either war as a subject — the only borderline entry, Memorial Stadium, is about a football stadium named for Nebraskans lost in war, not about the war. Verified 2026-11-10 against the live manifest: neither WWI nor WWII appears in the 106 manifest keys. These 2 videos are wholly new ground.

## Expert seats

In addition to the five lenses (architect, UI/UX designer, game developer, researcher, educator):

- **Historian seat: owns BOTH videos in this spec** (world history, world wars, social studies).
- **Educator seat: BLOCKED (no named educator exists).** See § Educator gate — the signer must approve, in writing, exactly the items listed there.

## Video list (2, PROPOSED)

### 1. WWI — The Christmas the guns stopped
- **Kid hook:** On Christmas Eve, soldiers in muddy trenches heard singing from the other side — and sang back.
- **Visible verb:** Little Christmas trees on a trench edge; two hands meeting across no-man's-land; a football kicked gently between strangers.
- **Key facts:**
  - The Christmas Truce was an unofficial, impromptu cease-fire along the Western Front on 24–25 December 1914, about six months into World War I (1914–1918); it was not sanctioned by commanders on either side. Source: https://www.britannica.com/event/The-Christmas-Truce — **HIGH** (Britannica).
  - German soldiers placed small Christmas trees outside their trenches and sang "Stille Nacht" ("Silent Night"); British soldiers answered with carols of their own, and on Christmas Day men met in no-man's-land, exchanged gifts, and played football. Source: https://www.britannica.com/event/The-Christmas-Truce — **HIGH** (Britannica); corroborated by https://www.worldhistory.org/The_Christmas_Truce/.
- **Tone note:** The scale ("over 100,000 soldiers", "two-thirds of the front") varies between sources — the clip says "in many places along the front", not a number. The story is the singing, not the war. No blame, no side named as villain.

### 2. WWII — Letters home
- **Kid hook:** A child far from home writes a letter — "I miss you" — and a whole country of children writes back the same way.
- **Visible verb:** A child's hand writing a letter; a train carrying children to the countryside; a letter arriving home.
- **Key facts:**
  - World War II began 1 September 1939 with Germany's invasion of Poland; in Britain, Operation Pied Piper evacuated about 1.5 million civilians — the overwhelming majority children — from cities to rural areas in three days, the largest internal migration in British history. Source: https://www.britannica.com/event/the-Blitz — **HIGH** (Britannica).
  - Soldiers and children wrote letters home throughout the war; the National WWII Museum's archive holds letters from fathers to children asking about school and grades, and children writing home from evacuation — for example Alan Miles, evacuated at 9, writing home to his mother. Source: https://www.nationalww2museum.org/war/articles/world-war-ii-letters-to-children — **HIGH** (museum archive); Alan Miles detail from https://www.perlego.com/book/1528558/a-childs-war-growing-up-on-the-home-front-pdf — **MEDIUM** (book summary).
- **Tone note:** One child's story, not a country's story. No battle footage, no blame narrative. The clip ends on the letter arriving — connection, not conflict. Do not name a "side" as the enemy in the narration; the war is the backdrop, the letter is the story.

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
retold. You tell the World Wars as HUMAN STORIES ONLY — letters home,
a nurse, a child, a village, a Christmas truce. Never political
framing, never blame narratives, never strategy or generals. You write
narration only from the spec's sourced facts; you never invent a fact,
a date, a quote, or a person's words. If a moving detail has no source,
mark it UNVERIFIED and leave it out.

DELIVERABLES (branch feat/journal-world-wars-spec):
- 2 videos, 10 seconds each, one per entry in the spec. PROPOSED count —
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
  and tone wrong is a failure. World view, not US-heavy: the WWI clip
  is British and German soldiers together; the WWII clip is a British
  evacuee child — the next tier should add a non-European human story.
  NO POLITICS anywhere.

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
2. Age-fit of war content for 5th grade and up — specifically that the Christmas Truce clip (soldiers, trenches) and the Letters Home clip (a child separated from parents) are gentle enough for a 10-year-old, with no frightening imagery.
3. The human-story framing: no blame narratives, no political framing, no battle detail, no "enemy" language in narration.
4. Historical correctness of both entries (dates, the truce's unofficial status, the evacuation numbers) — historian + educator.
5. The choice of which human story represents each war, and the plan for a non-European human story in the next tier (world view, not US- or Europe-only).

## Open questions for the owner

1. Approve the PROPOSED count of 2 videos (or a different number)?
2. Name the educator / SME who signs the gate above.
3. Unresolved v3-vs-v4 gate question (from §7 P8): the owner's ear approved v4's Magnus narration on 2026-11-08, but the written gate names a listen-verdict on v3. Does the v4 approval satisfy the gate, or is a fresh listen-verdict required?
4. Batch size: 2 at once, or one pilot clip first (Christmas Truce) with a listen-verdict before the second?
5. Is the British-evacuee framing for WWII acceptable as the first WWII human story, or should the first be a non-European story (e.g. a child elsewhere in the world)?
6. The Christmas Truce scale: keep it vague ("in many places") or name a sourced number?

## Definition of done

- [ ] Owner approves the proposed count (2) and answers the WWII framing question.
- [ ] Educator/SME named and sign-off in writing on all 5 items in the Educator gate.
- [ ] Listen-verdict question (v3 vs v4) answered by the owner.
- [ ] Per-story production process written (pipeline: script from sourced facts only; voice direction; "Hey kids" opening; bed at 30%; video-discipline — never re-render approved video to add audio).
- [ ] Both clips pass every gate above, with recorded verification numbers per clip.
- [ ] Human-story framing verified: no politics, no blame, no battle detail, no "enemy" language anywhere.
