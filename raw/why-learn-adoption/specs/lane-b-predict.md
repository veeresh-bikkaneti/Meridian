# Lane B — P12 Predict → Test → Prove, Math pilot (flagship) + P17 two voices

Status: SPEC (2026-11-24). No production code. Source patterns: Every Joule
P12 (predict → test → prove; prediction committed in the student's own ink —
mechanics [inferred] from EJ code: `setPredict`, `clearPredict`) and P17 (two
voices, two typefaces — book serif vs student handwriting [measured: EJ ships
Source Serif + Caveat]). Verdict of record: ADOPT as Math pilot, adapted form.

## The flow (what the kid sees, step by step)

In a Math case (`src/subjects/math/MathCase.tsx` → shared
`src/subjects/shared/SubjectCase.tsx`), for an item whose answer entry opts in:

1. **Clue (unchanged).** Scene film (where the item has one) + ClueCard with
   `item.why`, exactly as today. The prediction NEVER comes before the clue —
   a hunch with zero information teaches guessing, not thinking.
2. **Hunch step (NEW, optional).** Below the clue, a card in the AnswerCard's
   place: heading **“What's your hunch?”**, the SAME choices as the answer
   entry, plus a full-width secondary button **“Skip — go straight to the
   question”** (≥44px). Picking a choice commits the hunch (it cannot be
   edited after — that is the point of a prediction) and the answer card
   appears. Skipping renders today's flow byte-identical.
3. **Answer (unchanged).** The existing AnswerCard: same prompt, same choices,
   same wrong-pick feedback, same lose-reveal counting. The hunch does NOT
   pre-pick, highlight, or lock any choice — the kid answers fresh.
4. **Prove (result band, extended).** On a main-phase solve, the result
   section gains one line above the derivation, in the hunch treatment
   (P17, below):
   - Hunch right: **“Your hunch: 8 — exactly right. Here's why.”**
   - Hunch wrong: **“Your hunch: 6. The answer is 8 — here's why.”**
     (then the existing derivation line follows, unchanged.)
   Tone rule: the wrong-hunch line uses the lose-reveal's supportive register
   (compare `LOSE_SUPPORT_LINE` in SubjectCase) — a wrong hunch is a
   prediction that did its job, never a failure. No “wrong”, no ✗, no red.
   Skipped hunch → result band is byte-identical to today.
5. **Lose reveal with a hunch:** the reveal section names the hunch the same
   supportive way (“Your hunch was 6 — this one was tricky. The answer is
   8 — here's how.”) after the supportive line. The hunch never counts
   toward the two-distinct-wrong reveal counter — it is not an answer.

## State: in-memory ONLY

- The hunch lives in `SubjectCase` component state (`useState`), reset by
  `nextCase` alongside `picked`/`phase`. It is NEVER written to
  `subject-progress.ts` or any store. The progress store's stated contract —
  “no scores, no attempts, no answers” — is a hard constraint: a persisted
  prediction is a persisted answer attempt.
- Leaving the case (Home, End game, band change) discards the hunch with the
  component. A resumed case starts hunch-less.
- The scene hook stays answer-blind: the hunch is NOT passed to
  `scene(item, phase, reduced, band)`, to the detective host props builder,
  or anywhere outside SubjectCase's render.

## The opt-in gate (blast radius control)

`CasePhase` (`"main" | "followUp" | "done"` in `src/subjects/shared/answer.ts`)
and `SubjectCase` are shared by all six subjects. The pilot must not change
any other subject's flow by one pixel:

- Gate on the DATA, following the `followUp` precedent in `answer.ts`:
  `AnswerEntry` gains ONE optional field — `predict?: { prompt: string }`
  (the hunch question's wording; choices/correct/derivation are reused from
  the entry itself). An entry without `predict` behaves exactly as before —
  the same guarantee `followUp` and `kind` already give.
- Math's records (`src/subjects/math/items.ts`, `MATH_RECORDS` →
  `toAnswerEntry`) project `predict` only where a record carries one.
  Pilot scope = the records the content lane (below) has written; every
  other Math item and all five other subjects are untouched by construction.
- The hunch step is a phase-LOCAL state in SubjectCase (`"hunch"` is NOT a
  new `CasePhase` — `advanceCasePhase` and its tests stay untouched). The
  step renders only when `phase === "main" && entry.predict && !hunchDone`.

## P17 — two voices (riding along)

- The kid's hunch (step 2's committed pick and step 4/5's named-back line)
  renders with a distinct treatment: a small **“Your hunch”** label + the
  Lane C subject colour as text accent on the cream ground (≥4.5:1 — subject
  colours are 700-shade, verified per palette at build).
- OPTIONAL, flagged: a handwriting webfont (Caveat-class, subset ~30–60KB,
  loaded inside the lazy case chunk — entry gate untouched) for the hunch
  text only. **Legibility risk at band 7–10 and for dyslexic readers** —
  ships only if the owner's eye approves it on the mock; the label+colour
  treatment is the default and stands alone.
- The game's voice (clue, prompt, derivation) keeps today's typefaces
  (Fraunces/Karla). Whose words are whose is never ambiguous.

## Read-aloud behaviour (Always / Sometimes / Never)

- The hunch step is a question the kid answers by tapping: under
  **Sometimes** (tap mode) it behaves like the answer card — a Listen affordance
  reads the hunch prompt + choices; under **Always** the prompt is read on
  arrival like the clue; under **Never** nothing is read and nothing blocks.
- The named-back line in the result band is part of the result section's
  existing read-aloud surface — no new voice claim, no new clip. Text only:
  the pilot ships NO new TTS audio (prediction wording is per-item text;
  voicing it is a later, separately priced decision).
- The supportive voice line on the lose path is unchanged; the hunch line
  renders after it, text-only.

## Failure / skip paths

- **Skip tapped:** hunch step unmounts, answer card renders, zero trace —
  result band identical to today. Skip is always available, never shamed
  (no “are you sure”, no counter).
- **Hunch = correct answer:** allowed and celebrated as “exactly right” —
  it is a prediction, not a spent answer; the kid still answers the question.
- **Number-kind entries** (`kind: "number"`, typed answers): the pilot does
  NOT offer a hunch step (typing a prediction duplicates the answer UI);
  `predict` on a number entry is a validation error in the subject's
  `validate.ts` — spec'd so content can't opt one in by accident.
- **Follow-up entries:** hunch applies to the entry question only, never to
  a follow-up (Math has no follow-ups today; the rule is for the shared
  component's other subjects later).
- **Scene-less items:** hunch step works identically — it needs only the
  clue text + choices.

## The content bill — priced honestly (measured on main @ 9314c6de)

Counted from `src/subjects/math/items.ts` (`MATH_RECORDS`), 2026-11-24:

| | Items |
|---|---|
| Math total | **53** |
| — band 7–10 | 22 |
| — band 10–18 | 28 |
| — band 18+ | 3 |
| — of which carry a clue scene | 37 (22 @ 7–10, 13 @ 10–18, 2 @ 18+) |

Per item, educator-reviewed prediction content means: **one hunch prompt**
(“Before you work it out — how many groups of 5 do you think 40 coins make?”)
whose wording must not leak the derivation, **plus a check that the entry's
existing choices serve as hunch choices** (they are the same options; where a
choice set is ordered numerically the hunch reuses it as-is), **plus an
educator review pass** of the same standing as the existing derivation review
(“listed in the PR for educator review”, `answer.ts`) — age-band reading
level, no trick wording, wrong options plausible-but-wrong for a reason a
teacher can name.

- **Pilot (this lane):** all 53 Math items is the honest full pilot;
  a scene-first subset (37 items) is the defensible smaller pilot — the
  decision is the owner's (see decisions list). Writing+review estimate:
  ~20–30 min per item → **53 items ≈ 18–26 hours of content work**;
  37 items ≈ 12–18 hours. This is the lane's real cost; the code is not.
- **Rollout (NOT this lane, priced so it is not a surprise):** five more
  subjects, each its own content lane of the same shape (item counts vary;
  chemistry/physics/GK/social/journals records counted when their lane is
  specced).

## Components / files touched (delta-only)

| File | Delta |
|---|---|
| `src/subjects/shared/answer.ts` | `predict?: { prompt: string }` on `AnswerEntry` + doc comment. `advanceCasePhase` untouched. |
| `src/subjects/shared/SubjectCase.tsx` | Hunch state + hunch card render (reuses AnswerCard's choice buttons via a shared `ChoiceList` extraction OR a `mode` prop on AnswerCard — ONE component per job: AnswerCard gains `purpose: "hunch" \| "answer"` prop, same buttons, same ≥44px rows); named-back line in result + lose sections. |
| `src/subjects/math/items.ts` + `validate.ts` | Record field + projection in `toAnswerEntry`; validation: `predict` forbidden on number-kind, prompt non-empty, prompt must not contain the correct answer string. |
| `src/subjects/math/answers.ts` | No change (projection already flows through). |
| `src/styles.css` | `.wl-hunch` treatment (label + subject-colour accent) under `.subject-case-screen` scope; optional font-face if approved. |
| Tests | answer/phase tests (gate: no `predict` → identical flow), SubjectCase hunch flow tests, math records validation tests, targeted e2e (hunch right / wrong / skipped / lose-with-hunch) + owner-config playthrough gate (tap mode) before READY. |

**Ownership:** the hunch step is the AnswerCard component with a prop — never
a copied HunchCard. The named-back line is part of the existing result
section, not a new band component.

## Accessibility

- Hunch choices are the AnswerCard's buttons: ≥44px, letter badges, same
  focus behaviour; the step's heading takes focus on arrival like the
  follow-up does (`moveFocus` pattern).
- Skip button ≥44px, secondary styling, reachable by keyboard in order.
- The named-back line is plain text in the result section (announced with
  it); the hunch is never conveyed by colour alone — the “Your hunch” label
  is words.
- Reduced motion: the hunch step has no animation of its own; the scene's
  existing gates are untouched.
- Contrast: hunch accent text uses the subject colour at 700-shade on the
  case card ground, verified ≥4.5:1 per palette at build (Lane C rule).

## NEGATIVE list — must NEVER happen

1. A hunch asked before the clue, or on an item whose entry lacks `predict`.
2. A hunch persisted anywhere (store, URL, session) — or counted as an
   answer, a wrong answer, or toward the lose-reveal counter.
3. The hunch pre-selecting, highlighting, disabling, or ordering the answer
   choices; the hunch being editable after commit.
4. A wrong hunch framed as failure (no “wrong”, ✗, red, score loss, or a
   spoken correction that shames) — supportive register only.
5. Any flow change for the five non-Math subjects, for Math items without
   `predict`, for number-kind entries, or when the hunch is skipped
   (byte-identical to today in all four cases).
6. The hunch (or its correctness) reaching the scene hook, the detective
   host, or any answer-blind surface.
7. New TTS clips or a new voice claim in the pilot; the hunch step blocking
   on audio in any read-aloud mode.
8. A third question level: hunch + entry + follow-up is the maximum, and
   only where each already exists independently.

## Acceptance criteria

- Unit: entries without `predict` produce byte-identical phase behaviour;
  validation rejects `predict` on number-kind and answer-leaking prompts.
- Flow tests: hunch right / wrong / skipped / lose-with-hunch each render
  the specced result text; skip leaves no trace in the DOM result.
- Regression: full SubjectCase suites for all six subjects green; Math
  records tests green with the new field on piloted records.
- Playthrough (owner-config gate): a full Math case played in tap mode
  (read-aloud “sometimes”, band 7–10, sound on, 390px + 1280 leg): hunch
  offered after the clue, Listen works on the hunch step first tap, skip
  path clean, result names the hunch back.
- Content: every piloted record's hunch prompt listed in the PR for educator
  review (the derivation precedent).

## Effort estimate

- **Code: ~8 hours** (one optional field, AnswerCard prop, two result-line
  sites, validation, tests) + **~4 hours** gates/playthrough.
- **Content: 18–26 hours** for all 53 Math items (12–18 h for the 37-item
  scene-first subset) — educator-reviewed writing, the lane's dominant cost.
- Rollout beyond Math: explicitly NOT in this lane; ~5 further content lanes.

## ADDENDUM — owner direction 2026-11-24 15:32 CST (supersedes the static-text explanation)
1. The explanation on the answer ("here's why" / derivation) is delivered as a MOTION VIDEO in the result band, not static text. The text derivation remains as the accessible fallback (read-aloud, reduced-motion, Save-Data gates).
2. The motion video CHANGES BY AGE BAND (owner, 15:33 CST): per-band cuts (7–10 / 10–18 / 18+) differing in pacing/depth — the house already ships band-variant films (home-v5 why-learn film / trail-scout / adult), so this extends an existing media pattern, priced per band.
3. The QUESTION is interactable: the player moves things to see, play, and solve (manipulable scene). For the Math pilot this upgrades the clue scene from a watched film to a played scene on the items prototyped; per-item interactive authoring is the real cost driver — pilot narrows to a handful of scene items first (see Lane D addendum).
