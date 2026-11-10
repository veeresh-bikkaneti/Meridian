# Journal — Technology

- **Topic:** Technology: how people learned to talk across distance and compute with machines
- **Status:** GATED. Stage A (spec and data) done 2026-11-10; Stage B (clips) waits for the owner to lift the build gate, and for a named human educator to sign `educator-gate-rubric.md`.
- **Branch:** `feat/journal-technology-spec`
- **Proposed clip count:** 3. PROPOSED, pending owner approval; never presented as decided.
- **Clip data (contract I5):** `docs/scaling/journals/technology/clips.json`
- **Fact ledger:** `docs/scaling/journals/technology/sources.md` (every fact with source, access date and confidence; conflicts and cuts logged)
- **Draft captions and transcripts:** `docs/scaling/journals/technology/captions/*.vtt`, `docs/scaling/journals/technology/transcripts.md`
- **Check:** `node docs/scaling/journals/technology/check-clips.mjs` (I5 keys, groups, ids, standard shape, coordinates, captions present, reading grade per group)

## Topic scope

Three 10-second journal movies: the first telephone message down a wire
(Boston, 1876), the first public call from a phone you could carry (New York
City, 1973), and ENIAC, an early computer that took up a basement room
(Philadelphia, 1946). The story is what the machines did, told as dated
achievements in real places; no nation, company or person is praised or
blamed.

## Why this is not in the 106

The 106-clip journal covers places, nature, monuments and stories, with no
technology entry. An earlier check against the live manifest (2026-11-10)
found none of phone, telephone, mobile, computer or ENIAC among its keys.

## Stage A results (2026-11-10)

### Content screen (standard §7a)

| Clip | Religion / mythology | Sexuality or gender identity | Current or contested politics | Biology | Verdict |
|---|---|---|---|---|---|
| `technology:first-phone` | none | none | none. Credit for the telephone was argued in courts and by historians (S1). That is a historical credit question, not politics, but the clip avoids it by telling only what happened on 10 March 1876 and never says "invented". | none | **KEEP** |
| `technology:mobile-phone` | none | none | none. The company rivalry (S2) is left out to keep the story on the machine. | none | **KEEP** |
| `technology:eniac` | none | none | The machine is not contested. Its purpose was military: artillery range tables, and a first task of hydrogen-bomb calculations (S4). Weapons are a contested topic, so the purpose is never told or shown. The clip covers only size, place and year. One council seat would cut the clip (see Council); the owner may. | none | **KEEP, with the condition above** |

Nothing was cut whole. Claims cut from the earlier draft (unsourced,
conflicting or screened) are listed under "UNVERIFIED or cut" in
`sources.md`. They are: sole credit for the telephone; "costing as much as a
car"; "on a New York street"; a tower in the 1973 call; "bigger than your
classroom"; "millions of times more powerful"; "glowing tubes"; ENIAC's
cost (two sources conflict); and ENIAC's purpose.

### Corrections to the earlier draft

- The DynaTAC numbers had mixed two phones. 9 in and 35 minutes describe the
  1973 phone (S2), while 10 in and 30 minutes describe the 8000X (S3). The
  8000X sale year is 1983 in S2 and 1984 in S3 (TO CONFIRM). None of these
  numbers is narrated.
- Bell's first message was sent from an attic in Boston (S1), not a
  "laboratory". The two notebook versions of the sentence differ, so the clip
  quotes only the shared opening, "Mr. Watson, come here".
- ENIAC's completion year is 1945 in S5 and "by February 1946" in S4. Its
  cost is $400,000 in S4 and $487,000 in S5. The clip says only "1946", the
  year it was formally dedicated (S5) and that both sources agree on, and it
  drops the cost.
- The earlier draft named specific production tools and voices. This spec
  points to the house recipe in `docs/journal-movies.md` instead and names no
  vendor.

### Clip data (contract I5; full rows in `clips.json`)

| Field | `technology:first-phone` | `technology:mobile-phone` | `technology:eniac` |
|---|---|---|---|
| Group | 7-10 | 10-18 | 7-10 |
| Objective (verb, shown by) | compute years ago (1876) and identify "down a wire", shown by correct taps | solve 1876 + x = 1973 and identify "no wire", shown by a correct x and tap | compute the room's floor area (50 × 30 = 1,500 sq ft) and compare computer size with a room, shown by a correct area and tap |
| C3 code (live, S8) | D2.His.1.3-5 | D2.His.2.6-8 | D2.His.2.3-5 |
| Math used (live, S9) | 4.NBT.B.4 | 6.EE.B.7 (algebra, so 10-18 only) | 4.MD.A.3, 4.NBT.B.5 |
| Opening real question | How many years ago? (1876) | How many years apart? 1876 + x = 1973 | How much floor? 50 ft × 30 ft |
| Retrieval check (read aloud, tap) | How did the voice travel? Down a wire | What did the 1973 phone not need? A wire | How big was ENIAC? It took up a big room |
| Globe fly-to / Flat 2D pin | Boston 42.3603, −71.0578 (city level) | New York City 40.7128, −74.0061 (city level) | Univ. of Pennsylvania, Philadelphia 39.9523, −75.1906 |
| Facts used: sourced / UNVERIFIED or cut | 7 / 3 | 7 / 5 | 8 / 5 (+ purpose screened out) |

Groups follow the grade of the math each clip uses (owner rule: tag by the
standard's grade). The ENIAC clip carries an 18+ stretch question (O3, decided). No 7-10 clip uses
algebra or trigonometry, and `check-clips.mjs` fails if one does.

**Use it elsewhere (map, cross-application web):** subtraction on a
timeline (history); a missing-number equation for a time span (algebra used
in history, as in the map's "travel time" row); rectangle area for a real room
(geometry used in building and home projects).

### Motion tiers: same learning in Full, Lite and Flat

The movie and its narration, captions, transcript, opening question,
retrieval check and scoring are identical in every tier. Only the place
reveal changes:

| Tier | Place reveal |
|---|---|
| Full | The existing three.js globe (dynamic `import("three")`, as in `home-globe.tsx`) flies to the pin on the existing motion-token curves. |
| Lite | The same globe, low-poly and capped, with a short cut to the pin instead of a camera swoop. |
| Flat | A 2D map pin at the same coordinates with the same place name. With reduced motion, the movie shows its poster still until the player taps play, and the transcript is one tap away. Nothing flashes. |

Wiring the fly-to into the journal player is code outside this branch's paths
(integrator item I-2 in the branch status file).

### Council record (design calls, 2026-11-10)

Three seat perspectives were applied by the spec agent: an educator, a
child-safety and content reviewer, and a historian of technology. There are no
persona files, so this is a recorded design review, not a certification. Only
a named human educator can sign the gate.

| Call | Educator | Child-safety / content | Historian | Outcome |
|---|---|---|---|---|
| Keep all 3 clips? | Keep: each has a real number to work with. | Keep phone and mobile. ENIAC: cut, because its first task was weapons work, and "when in doubt, leave it out". | Keep: ENIAC is a milestone, and the purpose can be left out without misleading. | **Keep 3, 2–1 on ENIAC.** The purpose is never told or shown. The dissent goes to the owner (O2). |
| Groups | Area and subtraction are grade 4, so 7-10. x + p = q is grade 6, so 10-18. | Fine. | Fine. | As in the table. 18+ is the ENIAC stretch question (O3). |
| "First" claims | Children remember "first". | Avoid credit disputes. | Say only what the source says: "first telephone message", "first public cell phone call", "an early computer". | Adopted. |
| Modern-phone comparison | It helps the "why". | No issue. | No sourced figure, so no multiplier. | **Cut** for now (O5). |
| Narration length | 21–23 words may not fit 8 s. | — | — | **Cut to 18 spoken words or fewer, opener included** (owner call); `check-clips.mjs` enforces it. Still measure in Stage B. |

### K-12 standard checklist (§9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): each clip opens with a real number question before play: [x]
- Headline goal (§0): bridge + real-life application: [x] as a journal (no unit chain); bridge noted per clip
- Use-it-elsewhere round in another subject: [x] proposed (history timeline, history time span, building area); not built
- Bands served: [x] 7-10 (2 clips), 10-18 (1 clip); 18+ via the ENIAC stretch question (O3)
- Objective per item, observable verb, "shown by": [x] clips.json
- Standards cited per item (C3, plus CCSS for the math): [x] live sources S8, S9
- Loop mapped: hook (opening question) / predict (answer before play) / see (movie, pin) / explain (narration) / retry (one hint, then review deck): [x]
- Mastery "confident" bar: journal = correct retrieval answer after the clip (standard §4): [x]
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts I2 note)
- Post-clip retrieval check: [x] one per clip, read aloud
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions + transcript drafts, tap answers, no timers, SR announcement of the pin: [x] drafted, not built
- Privacy: no PII, no identifiers, local-only records: [x] nothing collected
- Content screen (§7a) passed; cuts logged with reason: [x] sources.md
- Free: no revenue features; asset licences recorded: [x] free; licences TO CONFIRM in Stage B
- Educator rubric attached: [ ] not signed; no named educator yet
```

## Stage B (not started: build gate not lifted)

Stage B starts only after the owner lifts the build gate for this branch. As
of `origin/main` `8dee5bad` there is no record of a lift in the plan, in
`branch-prompts.md` or in `integrator-runbook.md`. When it is lifted, the
work is:

1. Produce each kept clip with the house recipe (`docs/journal-movies.md`:
   10 s, 1152×768, 24 fps, h264 + AAC, no on-screen text, storyteller
   narration from this spec's sourced lines only) into
   `public/videos/journals/technology/<clip>.mp4`.
2. Copy and re-time the VTT drafts into `public/videos/journals/technology/`.
3. Write `public/videos/journals/technology/manifest.json` from `clips.json`.
   Never edit `public/videos/journal-manifest.json`.
4. Run the recipe's verification on each clip (ffprobe, full decode, frames at
   2, 6 and 9.5 s, audio levels, non-silent audio). Say plainly that no agent
   can verify by ear; the owner's listen is the final check.

## Educator gate: what the signer must approve (in writing)

No named educator exists yet, so the seat is BLOCKED. A real, named human
educator signs `docs/scaling/educator-gate-rubric.md` for this spec, covering
the following:

1. Every fact in `sources.md`, including the MEDIUM items (T3-3, T3-7) and
   the 1946 wording (T3-U1).
2. The group tags and the opening questions, including the year-dependent
   answer (O6).
3. The pictures read clearly and teach the right thing: a wave down a wire,
   waves leaving a phone with no tower, and rows of panels in a basement room.
4. The ENIAC content call (rubric 4 and 17a): purpose left out, nothing
   graphic.
5. Readability: `check-clips.mjs` FK grades are at or under the group limit
   (heuristic, ±1).

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-technology-spec.md @ [commit]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## Owner calls (recorded)

Owner calls on this branch, taken for PR 401 (recorded from the owner's
instruction in the PR 401 task, not from a signed approval; merge still needs
the owner's explicit per-PR word):

- **O1 decided:** keep 3 clips.
- **O2 decided:** keep ENIAC, with its purpose left out (the council's 2–1
  call stands; the dissent is on record).
- **O3 decided:** no new clip. The ENIAC clip gets an 18+ stretch question,
  stored as an extra `stretch` entry on that clip in `clips.json` (group
  `18+`, fact T3-5): "ENIAC could do 5,000 additions a second. How many in
  one minute?" Answer 300,000 (5,000 × 60). `check-clips.mjs` validates the
  keys, the fact id, the group, the answer and the reading grade. `stretch` is
  not a contract I5 key; the integrator decides whether I5 grows an optional
  field (new open item O10).
- **Narration trim (owner call):** each narration is 18 spoken words or fewer,
  fixed opener included. Dropped to fit: the "Mr. Watson, come here!" quote
  (T1-4), the city name in the mobile-phone line, and "basement" in the ENIAC
  line. Each retrieval answer still rests on a sourced fact kept in the
  narration or picture. Captions match.

## Open questions for the owner

- **O4** Use the other sourced extra number (35 minutes of talk, T2-4) as a
  follow-up question, or keep one question per clip? (T3-5 is now the ENIAC
  stretch.)
- **O5** Show any modern-phone comparison in the ENIAC clip? Only if a
  sourced figure is found; none is stated now.
- **O6** "How many years ago" depends on the current year (150 in 2026). The
  player should work out the answer from the device's year, or the question
  should give the year. This is a code decision for the integrator.
- **O7** Name the educator who signs the gate.
- **O8** Narration voice and listen check: is a fresh owner listen required
  for these clips? (An earlier question asked whether a past approval carries
  over.)
- **O9** Pilot one clip first (first-phone), or make all 3 at once?
- **O10** (integrator) Contract I5 has no `stretch` field. Allow it as an
  optional key, or move the 18+ question into its own item?

## Definition of done

- [x] Stage A: content screen, I5 data, sources, captions and transcript
      drafts, council record, §9 checklist (this pass).
- [x] Owner calls O1, O2, O3 recorded (see Owner calls).
- [ ] A named educator signs the rubric for this spec's commit.
- [ ] Owner lifts the build gate; Stage B clips, manifest and verification
      numbers per clip.
