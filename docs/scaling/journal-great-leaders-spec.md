# Journal P8 — Great Leaders

- **Topic:** Great leaders, told through the places that honour them
- **Status:** GATED. Stage A (screen, spec and data) done 2026-11-10; Stage B (clips) waits for the owner to lift the build gate, and for a named human educator to sign `educator-gate-rubric.md`.
- **Branch:** `feat/journal-great-leaders-spec`
- **Proposed clip count:** 2 proposed; after the §7a screen, **1 kept, 1 cut**. Both counts stay PROPOSED, pending owner approval; never presented as decided.
- **Clip data (contract I5):** `docs/scaling/journals/great-leaders/clips.json`
- **Fact ledger:** `docs/scaling/journals/great-leaders/sources.md` (every fact with source, access date and confidence; conflicts, cuts and screened facts logged)
- **Draft captions and transcript:** `docs/scaling/journals/great-leaders/captions/lincoln-memorial.vtt`, `docs/scaling/journals/great-leaders/transcripts.md`
- **Check:** `node docs/scaling/journals/great-leaders/check-clips.mjs` (I5 keys, groups, ids, standard shape, coordinates, captions present, reading grade per group, and a §7a term tripwire on every spoken or shown line)

## Topic scope

Journal movies of 10 seconds about memorials to leaders. The story is the
place: what was built, where, when, and what you can see there. The standard
allows historical people "when the story is their documented achievement or
the place tied to it, not their politics" (§7a). This topic carries the
highest politics risk of the journals, so this spec applies the strict
reading: a clip is kept only if it can be told as a place with no political
act in it, and cut if it cannot be told truthfully that way.

## Why this is not in the 106

Checked against `public/videos/journal-manifest.json` on `origin/main`
`8dee5bad` (106 movies; main has since moved to `a265f5f6`, which changes
only `contracts.md`): no key for the Lincoln Memorial or the Martin Luther
King Jr. Memorial. The nearest keys are `rushmore` (the carving),
`arbor-lodge` and `lincoln-airport` (a place named Lincoln, not the memorial).
The kept clip is additive; no existing story is touched.

## Stage A results (2026-11-10)

### Content screen (standard §7a)

| Clip | Religion / mythology | Sexuality or gender identity | Current or contested politics | Biology | Verdict |
|---|---|---|---|---|---|
| `great-leaders:lincoln-memorial` | none in what is told or shown. The inscribed speeches were not screened, so they stay off screen (L-X3). | none | The earlier draft's hook was the "I Have a Dream" speech on the steps, a political rally (L-X1). **Cut from the clip.** The memorial's role as a civil-rights rallying point (L-X2), Lincoln's death (L-X4) and the design dispute (L-X5) are also left out. What remains is a building, a year, a column count and a seated marble statue. | none | **KEEP, reframed as a place** |
| `great-leaders:mlk-memorial` | The memorial's wall quotes his sermons, some drawing on the Bible (M-4). | none | His documented achievement is leading a civil-rights movement and its campaign for laws; the memorial's own address points to a law (M-5). The memorial itself drew public disputes (sculptor, stone, pose, a removed paraphrased quote). | none | **CUT** |

Why the cut is not softened into a place-only clip: §7a says a figure "whose
story cannot be told without a contested political view is left out" and that
a failing item "is dropped, not softened". A "30-foot stone figure" with no
reason given would also fail rubric item A1 (nothing misleading). The
proposed reframe that was considered and rejected is logged in the council
record so the owner can overrule it.

### Corrections to the earlier draft

- The earlier hook ("the steps where MLK gave 'I Have a Dream'") is removed
  from the Lincoln clip under §7a (L-X1).
- "Giant" and Lincoln's presidency dates (1861–1865) were not in the sources
  fetched in this pass: dropped or kept out of narration (L-U1, L-U2).
- The "1964" address source now redirects; re-sourced (M-5). The earlier
  draft's local candidates file is not in the repo or on this machine, so every
  fact was re-fetched live.
- The earlier draft named production tools and a voice. This spec points to the
  house recipe in `docs/journal-movies.md` instead and names no vendor.
- NPS and the encyclopedia differ on small building numbers (drums per column,
  statue weight, column width, footprint). None of them is narrated (L-C1 to
  L-C4).

### Clip data (contract I5; full row in `clips.json`)

| Field | `great-leaders:lincoln-memorial` |
|---|---|
| Group | 7-10 |
| Objective (verb, shown by) | compute the years it took to build (1914 to 1922 = 8) and identify that the statue sits, shown by a correct answer and a correct tap |
| C3 code (live, S7) | D2.His.1.3-5 |
| Math used (live, S8) | 4.NBT.B.4 |
| Opening real question | How many years did it take to build? 1922 − 1914 (does not depend on the current year) |
| Retrieval check (read aloud, tap) | In the big statue, does Lincoln sit or stand? He sits |
| Stretch (optional I5 field, 10-18) | Columns 44 ft, statue 19 ft: solve 19 + x = 44 (x = 25). Fact L-14; 6.EE.B.7 |
| Globe fly-to / Flat 2D pin | Lincoln Memorial, National Mall, Washington, D.C. 38.88927778, −77.05013889 (S6) |
| Facts: sourced (used) / UNVERIFIED / conflicts / screened out | 14 (10) / 2 / 4 / 5 |

The group follows the grade of the math the clip uses (owner rule: tag by the
standard's grade). 10-18 is served only by the optional stretch question that
`contracts.md` I5 added on main in #403 (asked after the retrieval check, no
new video). No 18+ question yet (open item O5). The 7-10 questions use no
algebra or trigonometry, and `check-clips.mjs` fails if a 7-10 clip does.

**Use it elsewhere (map, cross-application web):** elapsed years on a
timeline (history: how long a building took); the same subtraction used for
any "how long did it take" question in the map's history and geography rows.

### Motion tiers: same learning in Full, Lite and Flat

The movie, narration, captions, transcript, opening question, retrieval check
and scoring are identical in every tier. Only the place reveal changes:

| Tier | Place reveal |
|---|---|
| Full | The existing three.js globe (dynamic `import("three")`, as in `home-globe.tsx`) flies to the pin on the existing motion-token curves. |
| Lite | The same globe, low-poly and capped, with a short cut to the pin instead of a camera swoop. |
| Flat | A 2D map pin at the same coordinates with the same place name. With reduced motion, the movie shows its poster still until the player taps play, and the transcript is one tap away. Nothing flashes. |

Wiring the fly-to into the journal player is code outside this branch's paths
(integrator item I-2 in the branch status file).

### Council record (design calls, 2026-11-10)

Three seat perspectives were applied by the spec agent: an educator, a
child-safety and content reviewer, and a historian (the seat that owns world
history in the earlier draft). There are no persona files, so this is a
recorded design review, not a certification. Only a named human educator can
sign the gate.

| Call | Educator | Child-safety / content | Historian | Outcome |
|---|---|---|---|---|
| Keep the Lincoln Memorial? | Keep: a real build span to work out, and a statue a child can recognise. | Keep only as a place: no speech, no rally, no inscriptions, no death. | Keep: the building, year, columns and statue are uncontested and sourced. | **Keep, 3–0, reframed as a place.** |
| Keep the "I Have a Dream" steps in the Lincoln clip? | It is the best-known moment there. | Cut: a political rally. | Cut: it turns the clip into the march's story, which is politics. | **Cut, 2–1.** Logged as L-X1. |
| Keep the MLK Memorial? | Keep, reframed as a place: "a 30-foot stone figure, opened in 2011". | Cut: sermon wall (religion), civil-rights laws (politics), and public disputes over the memorial itself. | Cut: a truthful telling needs the movement and his ministry; without them the clip misleads (rubric A1). | **Cut, 2–1.** The educator's reframe is recorded here for the owner (O2); it is not adopted. |
| Group | Subtracting years is grade 4 (4.NBT.B.4), so 7-10. A 10-18 stretch on sourced heights fits 6.EE.B.7. | Fine: heights only. | Use the two-source heights (L-14), not the one-source 28 ft (L-9). | 7-10, plus a 10-18 stretch. 18+ open (O5). |
| Replacement leader? | Wants a second clip. | Only an achievement-or-place story with no politics. | The earlier draft says no further US-only leaders without the owner. | **None added.** Owner's call (O3). |
| Narration length | 22 words may not fit 8 s. | — | — | Keep. Measure in Stage B and cut, never rush. |

### K-12 standard checklist (§9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): the clip opens with a real number question before play: [x]
- Headline goal (§0): bridge + real-life application: [x] as a journal (no unit chain); elapsed-years bridge noted
- Use-it-elsewhere round in another subject: [x] proposed (history timeline); not built
- Bands served: [x] 7-10 (1 clip); 10-18 by the optional I5 stretch; 18+ none yet (O5)
- Objective per item, observable verb, "shown by": [x] clips.json
- Standards cited per item (C3, plus CCSS for the math): [x] live sources S7, S8
- Loop mapped: hook (opening question) / predict (answer before play) / see (movie, pin) / explain (narration) / retry (one hint, then review deck): [x]
- Mastery "confident" bar: journal = correct retrieval answer after the clip (standard §4): [x]
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts I2 note)
- Post-clip retrieval check: [x] one, read aloud
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions + transcript drafts, tap answers, no timers, SR announcement of the pin: [x] drafted, not built
- Privacy: no PII, no identifiers, local-only records: [x] nothing collected
- Content screen (§7a) passed; cuts logged with reason: [x] sources.md (1 clip cut, 5 Lincoln facts screened out)
- Free: no revenue features; asset licences recorded: [x] free; licences TO CONFIRM in Stage B
- Educator rubric attached: [ ] not signed; no named educator yet
```

## Stage B (not started: build gate not lifted)

Stage B starts only after the owner lifts the build gate for this branch. As
of `origin/main` `a265f5f6` there is no record of a lift in the plan, in
`branch-prompts.md` or in `integrator-runbook.md`. When it is lifted, the
work is:

1. Produce the kept clip with the house recipe (`docs/journal-movies.md`:
   10 s, 1152×768, 24 fps, h264 + AAC, no on-screen text, storyteller
   narration from this spec's sourced lines only) into
   `public/videos/journals/great-leaders/lincoln-memorial.mp4`, following the
   producer screen notes in `transcripts.md`.
2. Copy and re-time the VTT draft into `public/videos/journals/great-leaders/`.
3. Write `public/videos/journals/great-leaders/manifest.json` from
   `clips.json`. Never edit `public/videos/journal-manifest.json`; the
   integrator merges the entry.
4. Verify the output file: an audio stream is present and not silent,
   duration, full decode, and a human listen check, each with a recorded
   number.

## Open questions for the owner

1. **O1 Count:** 2 were proposed; 1 is kept. Is one Great Leaders clip
   enough, or should the topic be refilled (see O3)? The earlier "5 vs 10"
   pick across the P8 specs is also still open.
2. **O2 MLK Memorial:** cut 2–1 under §7a. The educator's place-only reframe
   is on record. Only you can overrule the cut.
3. **O3 Replacement:** any new leader must pass the same screen (an
   achievement or a place, no politics). The earlier draft asks that no further
   US-only leaders be added without your call.
4. **O4 Educator:** who is the named educator who signs this topic in writing?
5. **O5 Groups:** no 18+ question, and 10-18 has only the stretch. No sourced
   distance or angle was found for an 18+ question (for example a sight-line
   angle to the roof), so none is invented.
6. **O6 Extra questions:** the step counts (58 and 87, L-11) could be a second
   question. Not added without your word.
7. **O7 Listen check:** the earlier draft records an unresolved question
   about which recipe version's listen verdict satisfies the gate. Still yours
   to answer.
8. **O8 "Opened" vs "dedicated":** the clip says the memorial "opened" in 1922
   for the dedication ceremony (L-3). Educator to confirm the wording.

## Definition of done

- [x] Stage A: both proposed clips screened; the kept clip has I5 data,
      sourced facts with confidence, draft captions and transcript; the cut is
      logged with reasons.
- [ ] Educator sign-off in writing on file.
- [ ] Owner decisions O1–O8.
- [ ] Stage B: clip, captions and manifest produced and verified (gate not lifted).
- [ ] Additive only: no existing story changed (holds for Stage A).
