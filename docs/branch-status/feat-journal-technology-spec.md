# Branch status — feat/journal-technology-spec

Stream 11 of the scaling plan: the Technology journal. Spec; clips gated.

**Status: STAGE A DONE (docs only). Stage B NOT STARTED: build gate not lifted.**

## Task

Screen the 3 PROPOSED clips against standard §7a. For each kept clip, write
contract I5 data: group, objective, C3 code, the real opening question, one
read-aloud retrieval check, captions and transcript, and a globe fly-to with a
Flat 2D pin. Stage B (produce the clips) runs only after the owner lifts the
build gate.

## Scope (exclusive paths)

- `docs/scaling/journal-technology-spec.md`
- `docs/scaling/journals/technology/**`
- `public/videos/journals/technology/**` (untouched: Stage B)
- this file

## Done (2026-11-10, synced with origin/main `8dee5bad`)

- [x] §7a screen of all 3 clips. All 3 kept. ENIAC is kept on a 2–1 council
      call with its military purpose left out; the dissent goes to the owner.
- [x] `clips.json`: 3 clips in the exact I5 shape. C3 codes come from the live
      C3 PDF; the CCSS math codes from the live CCSSO PDF.
- [x] `sources.md`: every fact with source, date and confidence. Conflicts
      (DynaTAC numbers, ENIAC year and cost) are logged and kept out of the
      narration. Unsourced claims from the earlier draft are cut.
- [x] Draft captions (`captions/*.vtt`; cue times PROPOSED) and
      `transcripts.md` (narration, picture notes, opening question, retrieval
      check with hint).
- [x] Full / Lite / Flat parity, council record and §9 checklist in the spec.
      The earlier draft's tool and voice names are removed.
- [x] `check-clips.mjs` (no dependencies) checks the I5 shape and reading
      grade. It passes on 3 clips; it failed once on a too-hard ENIAC question,
      which was then fixed.

## Gates

No code gates ran (docs only). `npm run lint:content` did not run: it needs
`node_modules`, which this worktree does not have, and it does not scan these
paths. `node docs/scaling/journals/technology/check-clips.mjs` passes.
`clips.json` is valid JSON. `public/videos/journals/technology/manifest.json`
is not created yet (Stage B).

## Open

- Stage B clips and manifest: blocked. The owner has not lifted the build
  gate; no record of a lift was found on main.
- Educator sign-off: blocked. No named educator yet.
- Owner calls O1 (keep 3), O2 (keep ENIAC, purpose left out) and O3 (18+ stretch question on the ENIAC clip) are recorded in the spec. Still open: O4–O10.
- Narrations are 18 spoken words or fewer (opener included); timing for about 8 s is TO CONFIRM when rendered.

## Needs the integrator (outside this branch's paths)

- I-1 `public/videos/journal-manifest.json`: merge the technology entries after
  Stage B (never edited here).
- I-2 The journal player or prefetch code: the globe fly-to / Flat pin from I5
  `place`, the opening question before play, the retrieval check after it, and
  a "years ago" answer worked out from the device's year (O6).
- I-3 `src/game/review-deck.ts`: hooking journal retrieval misses into the deck
  (integrator-only per contracts.md).
