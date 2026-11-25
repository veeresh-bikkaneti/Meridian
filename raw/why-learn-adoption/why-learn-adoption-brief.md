# Why Learn adoption brief — RE patterns P1–P17 → the live #why-learn page

Date: 2026-11-24 · Method: /brainstorming (3 clean-context lenses: Contrarian/YAGNI+debt, UX/kid ergonomics, Cost/delta-pricing) + /pstack:how grounding, under poteto-mode. Source pack: RE-PACK.md (same folder). Code ground truth: main @ db9b847b, read first-hand (SubjectPicker.tsx, SubjectCase.tsx, WhyLearnWorld.tsx, WhyLearnDrift.tsx, subject-progress.ts, answer.ts, registry.ts).

## Corrections established during grounding
- The live page is Variant E behaviour + the Living Atlas look (owner pick 2026-11-14), not a bare list: film-loop subject cards, stamp chip, one-liner, per-subject progress + Reset, drifting-formula texture, painted world band.
- Age bands are THREE, not five: AgeGroup = "7-10" | "10-18" | "18+" (registry.ts). All content bills are 6 subjects × 3 bands.
- Every Joule's in-book 3D timings were never measured (capture blocked, SwiftShader) — P14's feel is [inferred] only.

## Verdicts (synthesized; all three lenses agreed unless noted)
- ADOPT (derived, cheap): P15 stamps — state derived from the existing solve store, rendered on the existing chip + case result band. No new store, Reset un-stamps for free. P6 counter in derived form — chip reads "N of M solved" from subject-progress.ts. Zero new state.
- ADAPT (flagship): P12 Predict → Test → Prove — Math pilot only. Prediction AFTER the clue (never before information), optional/skippable, in-memory ONLY (the progress store's contract is "no scores, no attempts, no answers" — persisted predictions break it), result band names the hunch back in the supportive lose-reveal voice. Code M (opt-in phase in answer.ts + SubjectCase UI; shared phase machine = all-subject regression surface, full gates). The real bill is CONTENT: a prediction question with plausible wrong options, educator-reviewed, per item — pilot = Math items; rollout = up to 5 more per-subject content lanes. P17 rides with it: the kid's committed hunch gets a distinct treatment (label + colour; handwriting font optional, legibility risk at 7–10).
- ADAPT (small, optional): P13 subject colour token in registry.ts (S–M; concept glyph taxonomy deferred — no closed cross-subject concept list exists; Physics energy stores are the only candidate family). P2: already shipped (one-liners + case-count chip); a time promise ships only if measured per subject × band — never a borrowed "2 minutes". P1: only the hover-lift recipe (−5px / ~150ms) is a real delta; the door restyle is a settled-design re-open.
- OPTIONAL / design-led (mockup first, art bill): P3 static character presence at hero/footer only — never overlapping cards (fights the page's no-clipped-elements E2E at 390px). P4 narrow: case screens already themed; full re-skins rejected (per-page variants). P9 in-case unit-progress strip only (topics-page strip rejected — subjects are parallel, no linear order exists). P7 tap-to-locate only inside existing clue scenes, not the topics page. P10 rejected as its own pattern (duplicate path); returns only if P6 needs a surface.
- SKIP (closed): P1 restyle, P5 (already shipped twice: WhyLearnDrift + WhyLearnWorld), P8 flat-lay (art commission, no learning payload), P11 (miniature already exists: scene solved phase), P14 flaps (unmeasured, per-scene 3D treadmill, software-GL audience), P16 hunt (a new game mode, not a page pattern; separate GK proposal if ever).

## Recommended package
- Lane A (one lane, S): P6 counter + P15 stamp, both derived from the existing store; P1 hover recipe optional inside it.
- Lane B (the flagship): P12 Math pilot = 1 code lane + 1 Math content lane (educator-reviewed); P17 treatment rides along.
- Lane C (optional, mockup-first): P13 colour token + P3 static presence.
- Adopting everything the lenses marked ADOPT/ADAPT in full form was priced at ~9 lanes + 2–3 mockup rounds; the recommended package is 2 committed lanes + 1 optional.

## Status
Delivered to Veeresh in the meridian chat 2026-11-24. Awaiting his picks. No mockups, no code — mockup-before-code gate stands for every layout-touching item.

## ADDENDUM — owner clarification 2026-11-24 11:15 CST (supersedes the frame for the RoverKit cluster)
Veeresh, verbatim: "i gave rover kit as a sample so we could build science, math, physics, environment sceince., chesmistry etc., this is targeted for K12. and basics of computer science." RoverKit is the template for a NEW MODULE TYPE — guided K12 subject modules — not a topics-page UI reference. Consequences:
- The P6/P7/P9/P10/P11 verdicts above were judged as topics-page patterns and stand FOR THE PAGE. As a module chassis they re-judge: a module IS linear (step strip fits), HAS parts and a scene (tap-to-locate, details pane fit), and ENDS in doing (simulate-after-build is the payoff). P12 slots into module steps; P1 doors become the module shelf.
- This reopens the 2026-11-07 "scaling beyond geography is parked" item for planning/adoption discussion (MEMORY.md updated accordingly). Build/mockup decisions still gate in the meridian chat: chassis spec + sample module first, mockup-before-code, his approval.
- Open chassis questions: chassis-first shell (one component set: step strip, parts list, scene stage, details pane, predict/test/prove slots, sim slot) vs one-off module; first subject (physics / CS basics / math); content sourcing for environmental science + CS basics, which have zero content today.

## ADDENDUM 2 — owner correction 2026-11-24 11:18 CST (SUPERSEDES Addendum 1)
Veeresh parked RoverKit minutes after the clarification: robotic build-lab = future only; no literal copy-paste of any source's topics. Addendum 1's chassis frame is WITHDRAWN. Current scope: Lesson2Play + Every Joule patterns only, applied to Meridian's own simple topics, taught playfully. Working set: P1 doors + sticker-card feel, P2 one-sentence hooks, ambient motion (already shipped twice — covered), P12 Predict → Test → Prove, P14 lift-off flaps, P15 stamps, P13 one-concept-one-colour+glyph. RoverKit patterns (P6/P7/P9/P10/P11) are out of scope with RoverKit. Note: P1's restyle and P14 were lens-SKIPs (settled-design re-open; unmeasured evidence) — the owner naming them in the working set puts them back on the brainstorm table by his direction, with those flags still attached; mockup-before-code still gates P1, and P14's only sane-priced form remains a CSS hinge over the existing film/scene substrate.

## CORRECTED-SCOPE DECISION — run 2026-11-24 (owner run order 11:19 CST; supersedes the P6 element of the first decision)
Scope: Lesson2Play P1–P5 + Every Joule P12–P17 only. RoverKit P6–P11 excluded as parked. Method note: the three clean-context lenses had already judged P1–P5 and P12–P17 first-hand against the same pack + code in the earlier run; this run re-judges that evidence under the corrected scope + the owner's direction (doors/sticker and flaps explicitly wanted), rather than re-spawning identical lenses.
- SUPERSEDED: the P6-derived "N of M solved" counter is OUT (RoverKit-derived). Lane A is now P15 stamps alone.
- P1 doors + sticker feel: ADAPT (owner-directed) — sticker skin delta on the existing cards (chunkier borders, hard offset shadows, hover lift −5px/150ms), NOT the 300px marketing grid; decided by an all-layouts mockup against Living Atlas before code.
- P2: ADAPT — hooks already ship as placeholders; playful reword pass is owner content work; effort = case counts only, time promise only if measured.
- P3: ADAPT-narrow — character at hero/footer only, never over cards (no-clipping E2E); art-led, mockup-gated.
- P4: ADAPT-narrow — via the P13 subject colour token in existing scopes; full re-skins SKIP.
- P5: SKIP — already shipped twice (WhyLearnDrift + WhyLearnWorld).
- P12: ADOPT as Math pilot (adapted form: after clue, skippable, in-memory only, result band confronts by name; content bill = educator-reviewed prediction items).
- P13: ADAPT — subject colour token now; glyph system only for a recurring concept family (Physics energy first), colour+pattern together.
- P14: ADAPT to the cheap form only — CSS hinge/flip over the existing CardFilm / clue-scene, Math scene pilot; bespoke-3D form stays SKIP (unmeasured, per-scene treadmill, software-GL audience).
- P15: ADOPT (derived from the solve store; chip + result band).
- P16: SKIP for this scope (a game mode, not a page pattern; possible future GK case type as its own proposal).
- P17: ADAPT conditional — rides P12 only (label + colour for the kid's hunch; handwriting font optional, legibility-gated).
Package: Lane A = P15 stamps (S). Lane B = P12 Math pilot + P17 (code M + Math content lane). Lane C = mockup-first visual lane (P1 sticker skin + P3 hero presence + P13 token). Lane D = P14 cheap hinge, rides Lane B's scene. Awaiting the owner's pick.

## TARGETING NOTE — owner, 2026-11-24 15:34 CST
Target audience framed by US school levels: Elementary K–5 (~5–11), Middle 6–8 (~11–14), High 9–12 (~14–18). Current Meridian bands are 7–10 / 10–18 / 18+ (registry.ts) — two gaps against this frame: ages 5–7 uncovered; 10–18 spans Middle + High. Per-band motion videos and interactable scenes are authored against whichever band structure the owner rules. Decision put to him 2026-11-24: re-cut bands to school levels vs keep current bands and target within them.

## BAND RULING — owner, 2026-11-24 15:34 CST
KEEP CURRENT BANDS (7–10 / 10–18 / 18+) — target within them. No registry re-cut. School levels and grade-year names (Elementary/Middle/High; Freshman/Sophomore/Junior/Senior) serve as targeting labels inside the existing bands. Motion-video cuts are authored ×3 bands. The 5–7 gap and the shared Middle+High band stand as accepted, with the gap table on record.
