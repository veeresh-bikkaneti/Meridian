# BRANCH_STATUS — feat/verdict-grandpa-video

- **Branch:** `feat/verdict-grandpa-video`
- **Base:** `main` @ `242a7ef` (#291 winner declaration + #294 merged;
  branched after the #291 merge, so no rebase was needed).

## Task capsule

TASK / requested outcome: Wire the animated "Grandpa Was Already
There" clip into the challenge verdict screen (shipped in PR #291) so
it plays at the top of the screen, above the headline, on ALL verdict
classes (win / hold / near-miss / loss). Owner's dispatch, 2026-11-01:
"Ship it — wire the clip into the verdict screen (both win and lose)",
running in parallel with the finger-gun regeneration track; the
regenerated take (v2) landed during the build and is the ship asset.

Interpretations considered and selected reading: "both win and lose"
= every verdict class, since all four render through the one
ChallengeVerdict screen; the clip is placed inside that component.

Tier and rationale: Tier 1 execution of an owner-decided design (the
concept, screen, and placement were all decided before the build:
council Concept #2, owner pick 2026-10-29; verdict screen design
#291). No new design decisions are taken on this branch.

Done condition / evidence: verdict screen shows the clip (video under
full motion, still keyframe under prefers-reduced-motion, poster
before play); aria-live ~650 ms announcement, focus order, and
tap-to-settle choreography untouched; repo gates green (tsc, npm
test, test:worker, lint-cards, build:pages); verdict/challenge E2E
under the flock with sealed logs; production bundle references the
emitted asset; PR opened. NO MERGE — the review pipeline is a
separate stage.

Files and interfaces in scope: `src/components/game-app.tsx`
(ChallengeVerdict render + imports only), new `src/assets/verdict/`
(grandpa-media.ts swap point + compressed .mp4 + poster .webp),
README + docs for the verdict surface, this file. Out of scope
(FORBIDDEN): the mc3 codec, duel dots, verdict copy/classes,
branch protection, any backend/network call.

Asset: source `grandpa-verdict-v2.mp4` (1,712,053 bytes, 1152×768,
finger-gun take v2 — AI-animated from the owner-approved keyframe)
compressed to 960×640, audio stripped, CRF 28 → 329,051 bytes.
Poster/reduced-motion still: the approved keyframe webp resized to
960 wide → 65,336 bytes. Swap point: `src/assets/verdict/grandpa-media.ts`
exports both URLs; game-app.tsx is the only import site — a future
re-cut replaces the .mp4 file only.

Redundancy audit (owner standing rule): the clip adds no control,
button, link, or entry point — it is a decorative picture on a screen
that already exists. No duplicate path to any job. PASS.

## Status

- [x] Branch off current main; coordination ledger heartbeat posted
- [x] Asset compressed (v2, 329,051 bytes) + poster still (65,336 bytes)
- [x] Swap-point module + verdict-screen wiring (video / still / poster)
- [ ] Gates: tsc · npm test · test:worker · lint-cards · build:pages
- [ ] E2E: verdict/challenge specs under flock, sealed logs
- [ ] Docs: README + verdict doc note
- [ ] PR opened (no merge)
