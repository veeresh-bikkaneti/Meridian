# Journal — Freedom fighters

- **Topic:** Freedom fighters, told through the places that remember them
- **Status:** GATED. Stage A (spec and data) done 2026-11-10; Stage B (clips) waits for the owner to lift the build gate, and for a named human educator to sign `educator-gate-rubric.md`.
- **Branch:** `feat/journal-freedom-fighters-spec`
- **Proposed clip count:** 2 PROPOSED; after the content screen, 1 kept (reframed) and 1 cut. The count stays PROPOSED / TO CONFIRM; whether to replace the cut clip is an owner call (O1).
- **Clip data (contract I5):** `docs/scaling/journals/freedom-fighters/clips.json`
- **Fact ledger:** `docs/scaling/journals/freedom-fighters/sources.md` (every fact with source, access date and confidence; screened facts and cuts logged)
- **Draft captions and transcripts:** `docs/scaling/journals/freedom-fighters/captions/*.vtt`, `docs/scaling/journals/freedom-fighters/transcripts.md`
- **Check:** `node docs/scaling/journals/freedom-fighters/check-clips.mjs` (I5 keys and optional `stretch`, groups, ids, standard shape, coordinates, captions, no algebra in 7-10, screened words in narration, 18-word narration cap, reading grade per group)

## Topic scope

This is the highest-risk journal for the content screen: freedom struggles
are about politics, and most are about violence. Standard §7a lets a
historical person in only through a documented achievement or the place tied
to them, never their politics, and tells war as remembrance (no graphic
detail, no battle re-enactment). This spec is stricter still: no ongoing or
contested national dispute, and no violence, death or weapons described or
shown. When in doubt, the clip is cut, not softened (§7a).

## Why this is not in the 106

The earlier draft recorded that no freedom-fighter story is among the 106
journal entries, and that neither "Robben Island" nor "Jhansi Fort" is a key
in the live manifest (checked 2026-11-10). This journal is additive only. The
earlier rule stands: Robben Island is counted here only, never also under
great leaders.

## Stage A results (2026-11-10)

### Content screen (standard §7a, plus this journal's stricter rule)

| Clip (earlier draft) | Religion / mythology | Sexuality or gender identity | Current or contested politics | Violence, death, weapons | Biology | Verdict |
|---|---|---|---|---|---|---|
| Robben Island, "a cell where Mandela slept on the floor for 18 years" | none | none | The reason for his imprisonment is a political conviction tied to an armed wing (F1-U3). UNESCO's own wording judges a government (F1-U4). Both are left out. | Prison is not violence, but the reason would be. Left out. | The island's leper-hospital past (F1-U6) is left out. | **KEEP, REFRAMED** as a place of remembrance: where he was held, and what it is today. |
| Jhansi Fort, "a queen who rode into battle with her son on her back and a sword in each hand" | The revolt grew partly from religious grievances (F2-5). | none | The event has two names, one a national claim (F2-1); she is "a hero to the Indians and was a villain to the British" (F2-4). | A siege, a bombardment, a massacre and her death in battle (F2-2 to F2-4). The hook itself is weapons (F2-U1). | none | **CUT.** It cannot be told without battle, death and weapons, and its framing is contested. |

**Reframe log**

- **Robben Island (adopted).** Old hook: the cell and the floor mat (no
  source, F1-U1). New frame: a ferry crosses to an island; a man who was held
  here for many years is named; the prison is a museum today. The opening
  question is dates on a timeline. The clip never says why anyone was held,
  and never uses the words prison, apartheid or fighter in the narration
  (`check-clips.mjs` fails on them). The word "held" is the only hint, and the
  transcript note for adults gives the UNESCO facts (F1-5, F1-7).
- **Jhansi Fort, reframe considered and rejected.** (a) A fort-only clip
  (walls, hill, view) has no fetched fort facts (F2-U2), and the fort is famous
  here only for the siege, so it would still point at the battle. It belongs
  to a places or monuments journal if anywhere (owner call O2). (b) The
  queen's refusal to give up Jhansi (S7) leads straight into the annexation
  dispute and the war. Both fail; per §7a the clip is dropped, not softened.

### Clip data (contract I5; full row in `clips.json`)

| Field | `freedom-fighters:robben-island` |
|---|---|
| Group | 10-18 (algebra, grade 6); 18+ stretch question |
| Objective (verb, shown by) | solve 1964 + x = 1982 and identify that the old prison is a museum today, shown by a correct x and a correct tap |
| C3 code (live, S8) | D2.His.2.6-8 (classify developments as change or continuity: prison then, museum now) |
| Math used (live, S9) | 6.EE.B.7 (x + p = q), so never 7-10 |
| Opening real question | How many years apart? 1964 + x = 1982 (x = 18; F1-3 notes the real stay was a little under 18 years, so "18 years" is never narrated) |
| Retrieval check (read aloud, tap) | What is the old prison on Robben Island today? A museum |
| 18+ stretch (I5 optional field) | About 3.3 km by 1.9 km, treated as an ellipse: about 4.9 sq km (π × 1.65 × 0.95); listed area 5.08 sq km (F1-8) |
| Globe fly-to / Flat 2D pin | Robben Island −33.805, 18.37 (island centre, S6); label "Robben Island, Table Bay, near Cape Town, South Africa" |
| Narration | 18 spoken words, opener included: "Hey kids, have you heard about this place? Nelson Mandela was held here. Today it is a museum." |
| Facts: sourced / UNVERIFIED, screened or cut | 11 sourced (F1-1 to F1-11) / 9 (F1-U1 to F1-U9) |

`freedom-fighters:jhansi-fort` is cut: 7 facts sourced for screening only
(F2-1 to F2-7), 2 UNVERIFIED or cut (F2-U1, F2-U2), none used.

**Groups served:** 10-18 by the clip, 18+ by the stretch question. **7-10 is
not served** (owner call O3): the only kept story needs algebra for its
question, and the child-safety seat would not move a prison story into 7-10
without an educator's say.

**Use it elsewhere (map, cross-application web):** "Algebra: rates and
formulas → geography and social studies" — a missing-number equation for a
time span between two dated events. The 18+ stretch uses "Geometry and
measurement → geography": the area of a real place from its length and width.

### Motion tiers: same learning in Full, Lite and Flat

The movie and its narration, captions, transcript, opening question,
retrieval check, stretch question and scoring are identical in every tier.
Only the place reveal changes:

| Tier | Place reveal |
|---|---|
| Full | The existing three.js globe (dynamic `import("three")`, as in `home-globe.tsx`) flies to the island pin in Table Bay on the existing motion-token curves. |
| Lite | The same globe, low-poly and capped, with a short cut to the pin instead of a camera swoop. |
| Flat | A 2D map pin at the same coordinates with the same place name. With reduced motion the movie shows its poster still until the player taps play, and the transcript is one tap away. Nothing flashes. |

The screen-reader live region announces "Pin: Robben Island, near Cape Town,
South Africa." Wiring the fly-to into the journal player is code outside this
branch's paths (integrator item I-2 in the branch status file).

### Council record (design calls, 2026-11-10)

Three seat perspectives were applied by the spec agent: an educator, a
child-safety and content reviewer, and a historian. There are no persona
files, so this is a recorded design review, not a certification. Only a named
human educator can sign the gate.

| Call | Educator | Child-safety / content | Historian | Outcome |
|---|---|---|---|---|
| Jhansi Fort | Reframe as a fort place clip; it is a strong "where" question. | Cut: battle, death, weapons, and the hook is swords. | Cut: the fort is known for the siege, the naming of 1857 is contested, and the source says myth and history blur. | **CUT, 2–1.** The fort-only idea goes to the owner as a candidate for another journal (O2). |
| Robben Island | Keep: a real timeline question. | Keep only if the reason for imprisonment is never told or shown, no cell interior, and not in 7-10. | Keep: the place and dates are firm (S1, S2). Leaving out the reason must not make the child think he was a criminal, so add a neutral adult note. | **KEEP, reframed, 3–0,** with all three conditions. |
| Group | Algebra (6.EE.B.7) puts it in 10-18. | 10-18 only. | Fine. | 10-18; 18+ via the stretch. 7-10 is an owner call (O3). |
| "18 years" | Children like a round number. | — | The dates give 17 years and about 9 months. Ask "how many years apart are the dates", not "how long". | Adopted; the narration states no length. |
| UNESCO's "triumph of freedom over racism" | It gives the why. | It judges a government (§7a: no praising or blaming). | True and sourced, but a judgement. | **Not narrated.** Adult note gives only the facts (1999, 1991, 1996). |
| Narration length | 18 words is enough with a pin. | — | — | 18 spoken words, opener included, as for the technology journal; `check-clips.mjs` enforces it. Measure in Stage B. |

### K-12 standard checklist (§9)

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): the clip opens with a real number question before play: [x]
- Headline goal (§0): bridge + real-life application: [x] as a journal (no unit chain); algebra used on a history timeline
- Use-it-elsewhere round in another subject: [x] proposed (time span on a timeline; area of a real place); not built
- Bands served: [x] 10-18 (clip), 18+ (stretch); 7-10 not served (O3)
- Objective per item, observable verb, "shown by": [x] clips.json
- Standards cited per item (C3, plus CCSS for the math): [x] live sources S8, S9
- Loop mapped: hook (opening question) / predict (answer before play) / see (movie, pin) / explain (narration) / retry (one hint, then review deck): [x]
- Mastery "confident" bar: journal = correct retrieval answer after the clip (standard §4): [x]
- Review-deck hookup (same deck, same ladder): [ ] integrator-only (contracts I2 note)
- Post-clip retrieval check: [x] one, read aloud, plus the 18+ stretch
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions + transcript drafts, tap answers, no timers, SR announcement of the pin: [x] drafted, not built
- Privacy: no PII, no identifiers, local-only records: [x] nothing collected
- Content screen (§7a) passed; cuts logged with reason: [x] this spec + sources.md
- Free: no revenue features; asset licences recorded: [x] free; licences TO CONFIRM in Stage B
- Educator rubric attached: [ ] not signed; no named educator yet
```

## Stage B (not started: build gate not lifted)

Stage B starts only after the owner lifts the build gate for this branch. As
of `origin/main` at this branch's last sync there is no record of a lift in
the plan, in `branch-prompts.md` or in `integrator-runbook.md`. When it is
lifted, the work is:

1. Produce the kept clip with the house recipe (`docs/journal-movies.md`: 10 s,
   1152×768, 24 fps, h264 + AAC, no on-screen text, the storyteller
   narration, the fixed opener). Picture brief: `transcripts.md`. No cell
   interior, guards, weapons or distress; nothing flashes.
2. Write `public/videos/journals/freedom-fighters/robben-island.mp4`, its
   `robben-island.vtt` (re-timed from the draft) and
   `public/videos/journals/freedom-fighters/manifest.json` (the I5 row).
   Never edit `public/videos/journal-manifest.json`.
3. Verify the output file with recorded numbers, as the recipe requires:
   ffprobe shape, full decode, an audio stream that is not silent, the bed
   level, frame checks. Say plainly that no agent can verify by ear; the
   owner's listen is the final check.

## Educator gate: what the signer must approve (in writing)

No named educator exists yet, so the seat is BLOCKED. A real, named human
educator signs `docs/scaling/educator-gate-rubric.md` for this spec, covering:

1. Every fact in `sources.md`, including the MEDIUM items (F1-7, F1-8).
2. The Jhansi cut and the Robben Island reframe (rubric 17 and 17a): is
   "was held here" with no reason right for 10-18, and is the adult note
   neutral?
3. The group tag (10-18), the opening question, and the 18+ stretch.
4. The picture brief reads as remembrance: calm, nothing graphic.
5. Readability: `check-clips.mjs` FK grades are at or under the group limit
   (heuristic, ±1).

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-freedom-fighters-spec.md @ [commit]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## Open questions for the owner

- **O1** The journal now has 1 clip, not 2. Replace Jhansi Fort with another
  story, or keep 1? A replacement must pass the same screen; none is proposed
  here, because none was sourced in this pass.
- **O2** Offer a fort-only Jhansi Fort clip to a places or monuments journal?
  The council split 2–1 against it here.
- **O3** 7-10 is not served. Allow a 7-10 version of Robben Island (for
  example "the dates are 1964 and 1982: subtract", 4.NBT.B.4), or leave this
  journal to 10-18 and 18+? The child-safety seat wants the educator's say first.
- **O4** The journal's display name. "Freedom fighters" names fighting; the
  kept clip is about a place of remembrance. Group labels and copy are the
  owner's to name.
- **O5** Name the educator who signs the gate.
- **O6** Narration voice and listen check: is a fresh owner listen required
  for this clip? The earlier draft recorded an open question about whether a
  past listen approval carries over.
- **O7** The earlier draft asked for a pick between 5 and 10 new journal
  entries across the journal specs. Still open; this spec does not depend on it.

## Definition of done

- [x] Stage A: content screen, reframe log, I5 data, sources, captions and
      transcript drafts, council record, §9 checklist (this pass).
- [ ] Owner answers O1 to O7.
- [ ] A named educator signs the rubric for this spec's commit.
- [ ] Owner lifts the build gate; Stage B clip, manifest and verification
      numbers.
