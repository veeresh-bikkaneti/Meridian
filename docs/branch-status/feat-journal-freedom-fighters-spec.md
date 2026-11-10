# Branch status — feat/journal-freedom-fighters-spec

Stream 16 of the scaling plan: the Freedom fighters journal. Spec; clips gated.

**Status: STAGE A DONE (docs only). Stage B NOT STARTED: build gate not lifted.**

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
      (3–0 council). Jhansi Fort CUT: battle, death, weapons, contested
      framing, religion (2–1 council; the fort-only reframe was rejected and
      goes to the owner).
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

## Gates

No code gates ran (docs only). `node docs/scaling/journals/freedom-fighters/check-clips.mjs`
passes; `clips.json` is valid JSON. `public/videos/journals/freedom-fighters/manifest.json`
is not created yet (Stage B).

## Open

- Stage B clip and manifest: blocked. The owner has not lifted the build
  gate; no record of a lift was found on main.
- Educator sign-off: blocked. No named educator yet.
- Owner calls O1–O7 in the spec: replace the cut clip or keep 1 (O1), Jhansi
  fort-only clip elsewhere (O2), 7-10 not served (O3), journal display name
  (O4), educator (O5), listen check (O6), 5 vs 10 entries (O7).
- Narration fits about 8 s: TO CONFIRM when rendered.

## Needs the integrator (outside this branch's paths)

- I-1 `public/videos/journal-manifest.json`: merge the freedom-fighters entry
  after Stage B (never edited here).
- I-2 The journal player code: the globe fly-to / Flat pin from I5 `place`,
  the opening question before play, the retrieval check and the `stretch`
  question after it.
- I-3 `src/game/review-deck.ts`: hooking journal retrieval misses into the deck
  (integrator-only per contracts.md).
