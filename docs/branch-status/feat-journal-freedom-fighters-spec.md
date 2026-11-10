# Branch status — feat/journal-freedom-fighters-spec

Stream 16 of the scaling plan, folded into Great leaders. The label
"freedom fighter" is not used. Spec; clips gated. The branch name is
unchanged.

**Status: STAGE A DONE (docs only). Owner decisions recorded 2026-11-10:
Lakshmibai kept as a leader, Bose added, stream folded into Great leaders.
Clip rows for those two leaders are not written. Stage B NOT STARTED:
build gate not lifted.**

## Task

Screen the 2 PROPOSED clips against standard §7a (strictly: no contested
national dispute, no violence, death or weapons, remembrance tone). For each
kept clip, write contract I5 data: group, objective, C3 code, the real
opening question, one read-aloud retrieval check, captions and transcript,
and a globe fly-to with a Flat 2D pin. Stage B (produce the clips) runs only
after the owner lifts the build gate.

## Scope (exclusive paths)

- `docs/scaling/journal-freedom-fighters-spec.md`
- `docs/scaling/journals/freedom-fighters/**`
- `public/videos/journals/freedom-fighters/**` (untouched: Stage B)
- this file

## Done (2026-11-10)

- [x] §7a screen. Robben Island KEPT, reframed as a place of remembrance
      (3–0 council). Jhansi Fort was CUT by the council: battle, death,
      weapons, contested framing, religion (2–1; the fort-only reframe was
      rejected). Superseded 2026-11-10: the owner keeps Rani Lakshmibai as a
      leader, not place-only. See the later checkbox and the spec.
- [x] `clips.json`: 1 clip in the I5 shape, group 10-18, C3 D2.His.2.6-8 and
      CCSS 6.EE.B.7 from the live PDFs, plus an 18+ `stretch` (contract I5
      optional field, merged to main in #403).
- [x] `sources.md`: 11 sourced facts for the kept clip, 9 UNVERIFIED,
      screened or cut, each with a reason; Jhansi screening evidence logged.
- [x] Draft captions (`captions/robben-island.vtt`; cue times PROPOSED) and
      `transcripts.md` (narration, picture brief, question, retrieval,
      stretch, adult note).
- [x] Full / Lite / Flat parity, council record, §9 checklist, educator gate
      list, owner questions O1–O7. The earlier draft's tool and voice names
      are removed.
- [x] `check-clips.mjs` (no dependencies) passes on 1 clip. A mutation run
      (group 7-10, "prison" in the captions) failed with both errors, as it should.
- [x] Owner decisions recorded in the spec (2026-11-10). The stream is folded
      into Great leaders, and the label "freedom fighter" is not used. Rani
      Lakshmibai at Jhansi Fort is KEPT as a leader: mother, queen and leader;
      she ruled Jhansi, trained and led her own forces, rallied them and stood
      her ground in 1857; the picture is her riding out with her young son
      Damodar tied to her back; no graphic battle detail, no deaths or blood,
      no "enemy" or us-versus-them wording. Subhas Chandra Bose is ADDED: known
      as "Netaji"; founded the Indian National Army (Azad Hind Fauj) in 1943,
      which had a women's regiment; popularised "Jai Hind". The Indian National
      Army is not today's Indian Army. Never call him the founder of today's
      Indian Army. Place: Netaji Bhawan, Kolkata (his family home, now a
      museum). Leave out his wartime alliances and the mystery of his death.
      `clips.json` and `sources.md` were not changed.

## Gates

No code gates ran (docs only). `node docs/scaling/journals/freedom-fighters/check-clips.mjs`
passes; `clips.json` is valid JSON. `public/videos/journals/freedom-fighters/manifest.json`
is not created yet (Stage B).

## Open

- Stage B clip and manifest: blocked. The owner has not lifted the build
  gate; no record of a lift was found on main.
- Educator sign-off: blocked. No named educator yet.
- Owner calls: O1 to O4 are answered 2026-11-10 (see the spec); O3 keeps
  this journal to 10-18 and 18+. Still open, as later gates: O5 (named
  educator), O6 (listen check), O7 (5 vs 10 entries).
- Source the owner-directed Lakshmibai and Bose facts into `sources.md`, then
  add their clip rows. Not done in this pass. Do not narrate them until they
  are sourced. Never call Bose the founder of today's Indian Army.
  Check two dates when sourcing: the Jhansi siege and her ride out were in
  1858 (she took charge of Jhansi in 1857), and the first Indian National
  Army formed in 1942, with Bose taking command and rebuilding it in 1943.
- Narration fits about 8 s: TO CONFIRM when rendered.

## Needs the integrator (outside this branch's paths)

- I-1 `public/videos/journal-manifest.json`: after Stage B, merge the kept
  clips under Great leaders. Do not add a separate freedom-fighters journal
  or use that label. Never edited here.
- I-2 The journal player code: the globe fly-to / Flat pin from I5 `place`,
  the opening question before play, the retrieval check and the `stretch`
  question after it.
- I-3 `src/game/review-deck.ts`: hooking journal retrieval misses into the deck
  (integrator-only per contracts.md).
- I-4 The Great leaders journal is where this stream now belongs. This branch
  does not edit `docs/scaling/journal-great-leaders-spec.md` or
  `docs/scaling/journals/great-leaders/**`. The integrator copies the two
  leader decisions across when that branch should hold them.
