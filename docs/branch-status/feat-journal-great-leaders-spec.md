# Branch status — `feat/journal-great-leaders-spec`

## Task

Screen the 2 proposed Great Leaders journal clips against standard §7a. For
each kept clip, write contract I5 data: group, objective, C3 code, the real
opening question, one read-aloud retrieval check, captions and transcript, and
a globe fly-to with a Flat 2D pin. Stage B (produce the clips) runs only after
the owner lifts the build gate.

## Scope (exclusive paths)

- `docs/scaling/journal-great-leaders-spec.md`
- `docs/scaling/journals/great-leaders/**`
- `public/videos/journals/great-leaders/**` (untouched: Stage B)
- this file

## Done (2026-11-10, synced with origin/main `18d8ae24`)

- [x] §7a screen of both clips, strict reading (highest politics risk).
      **Lincoln Memorial: kept, reframed as a place** (building, 1914–1922,
      36 columns, seated marble statue). The earlier "I Have a Dream" hook and
      four other political or sensitive facts are screened out and logged.
      **MLK Memorial: cut** (sermon wall, civil-rights laws, public disputes
      over the memorial; a place-only version would mislead). Council 2–1;
      the dissent goes to the owner.
- [x] `clips.json`: 1 clip in the exact I5 shape, plus the optional I5
      `stretch` (#403) for 10-18: 19 + x = 44 from the NPS heights (L-14). The C3 code comes from the
      live C3 PDF; the CCSS math code from the live CCSSO PDF.
- [x] `sources.md`: every fact with source, date and confidence (NPS and
      encyclopedia, fetched live). Small NPS/encyclopedia number conflicts are
      logged and not narrated. Facts from the earlier draft that were not in
      the fetched sources are marked UNVERIFIED.
- [x] Draft captions (`captions/lincoln-memorial.vtt`; cue times PROPOSED)
      and `transcripts.md` (narration, picture note, producer screen notes,
      opening question, retrieval check with hint).
- [x] Full / Lite / Flat parity, council record, owner questions and §9
      checklist in the spec. The earlier draft's tool and voice names are
      removed.
- [x] `check-clips.mjs` (no dependencies): I5 shape, reading grade per
      group, the optional stretch (older group, fact id present in
      `sources.md`), and a §7a term tripwire on spoken and shown text. It
      passes on 1 clip. The retrieval question failed the grade check three times while
      being reworded and passes now; the tripwire was tested once with a
      planted "war", and the stretch rules with a bad fact id and a younger
      group; each failed as expected.

### Integrator fixes, round 2 (2026-11-10)

- [x] Removed the local working-file path from `sources.md`.
- [x] Narration trimmed from 22 to 20 words; it opens with the fixed line
      (owner call for all journals). `check-clips.mjs` now fails a caption
      track without the opener or over 22 words, and its §7a tripwire also
      catches "enemy", "blood" and the old stream label.
- [x] Spec section "Owner decisions (2026-11-10)": the PR 407 stream folded in;
      Robben Island taken over after 407 merges; Lakshmibai and Bose added
      with no clip rows yet.
- [x] Sourcing for the two new leaders in `sources.md` (S9–S20, fetched
      live). Lakshmibai: 10 sourced, 2 UNVERIFIED, 6 conflicts. Bose: 11
      sourced, 2 UNVERIFIED, 2 conflicts. Year check confirmed (1857 charge,
      1858 siege and ride). "Founded the INA" is flagged; the recommended line
      is "led the Indian National Army from 1943".

### Owner-approved wording, round 3 (t330u, 2026-11-10)

- [x] `great-leaders:jhansi-fort` row added, 10-18, owner narration verbatim.
      **UNVERIFIED:** "on her back" is disputed (back: S9, S21, S22, S23;
      waist: S10).
- [x] `great-leaders:netaji-bhawan` row added, 10-18, owner narration
      verbatim. **PROPOSED:** each fact has two or more agreeing sources.
- [x] New sources S21–S26 fetched live. Second sources were found for
      "Netaji" means "Respected Leader" (S26) and "made 'Jai Hind' famous"
      (S24). Who coined "Jai Hind" remains disputed and is not narrated.
- [x] Captions (`jhansi-fort.vtt`, `netaji-bhawan.vtt`) and transcripts.
      Cards answer the current year minus 1858 or 1943, worked out at play
      time.
- [x] `row-status.json` (status and reason per row). `check-clips.mjs`
      requires it, and checks that a years-ago card names the year it counts
      from.

## Gates

No code gates ran (docs only). `npm run lint:content` did not run: it needs
`node_modules`, which this worktree does not have, and it does not scan these
paths. `node docs/scaling/journals/great-leaders/check-clips.mjs` passes.
`clips.json` is valid JSON. `public/videos/journals/great-leaders/manifest.json`
is not created yet (Stage B).

## Open

- Stage B clip and manifest: blocked. The owner has not lifted the build
  gate; no record of a lift was found on main.
- Educator sign-off: blocked. No named educator yet.
- Owner questions O1, O2 and O4–O8 in the spec (O3 answered): count;
  overrule the MLK cut or not; educator name; no 18+ question; extra questions;
  listen check; "opened" vs "dedicated" wording.
- Narration timing (20 words for about 8 s) is TO CONFIRM when rendered.
- Robben Island row: open until PR 407 merges.
- Jhansi row UNVERIFIED until the owner settles back vs waist (R-C4).
- 18+ stretch questions for Jhansi and Netaji: TO CONFIRM (no clean sourced fact).

## Needs the integrator (outside this branch's paths)

- I-1 `public/videos/journal-manifest.json`: merge the great-leaders entry
  after Stage B (never edited here).
- I-2 The journal player or prefetch code: the globe fly-to / Flat pin from I5
  `place`, the opening question before play and the retrieval check after it.
- I-3 `src/game/review-deck.ts`: hooking journal retrieval misses into the deck
  (integrator-only per contracts.md).
