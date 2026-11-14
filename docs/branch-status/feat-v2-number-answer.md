# Branch status — feat/v2-number-answer

## Goal

Stream B (v2): add two small, optional things to the shared subject
case flow — a typed-number answer and a follow-up question — so
subject agents can use them. Existing entries keep working unchanged.
No shipped item changes here.

## Done

- `src/subjects/shared/answer.ts`: `AnswerEntry` gains optional
  `kind?: "choice" | "number"` (default `"choice"`) and optional
  `followUp?: AnswerEntry` (one level only). New pure helpers:
  `parseTypedNumber` (commas/spaces ignored, strict thousands
  separators, `null` for non-numbers) and `advanceCasePhase`
  (wrong stays, correct main with follow-up → follow-up, correct
  follow-up → done, nested follow-ups never asked).
- `src/subjects/shared/AnswerCard.tsx`: number mode renders one
  labelled `<input inputmode="decimal">` + Check button (44px,
  Enter submits via a form), same wrong-answer line as choice mode.
  Choice rendering unchanged.
- `src/subjects/shared/SubjectCase.tsx`: phase state (`main` →
  `followUp` → `done`); after a correct answer with a follow-up, a
  second AnswerCard shows before the result; the result shows both
  answers. Celebration fires once, on the first correct answer.
- `src/subjects/shared/answer-card.test.ts` (new, 9 tests): number
  parsing ("1,081", " 56 ", "13.5", rejects "1,2,3" etc.), wrong
  then right, follow-up order, one-level rule, number-card render
  (input + Check, 44px, no choices), wrong line, choice entry with
  neither new field renders exactly as before, follow-up card render.
- No change to `tests/e2e/math-subject.spec.ts`: the existing spec
  already plays today's math flow at one band per test plus reduced
  motion, and it passes unchanged (6/6) against the built artifact.
- Screenshots: `docs/branch-status/feat-v2-number-answer-shots/`
  (`number-card-390.png`, `number-card-desktop.png`) — the fixture
  rendered through the real component + built app CSS. Temp page and
  temp render script deleted before commit.

## Tests (final tree, targeted only)

- `npx tsc --noEmit`: clean.
- Unit: 65/65 subject tests pass (new answer-card 9, math 8,
  registry, picker-rows, why-learn-hero, all other subjects).
- `npm run lint:content`: GATE PASSED (6 baselined, 0 new).
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run build:pages`: green (prerendered 1 page; the wave-1
  pre-existing prerender failure did NOT reproduce here).
- E2E `--workers=1 --project=math-subject`: 6/6 pass, no console/page
  errors (bundled Chromium 1248; /opt/meta-chromium will not launch
  in this VM, as in wave 1).

## Reviewer verdict (separate seat, on 08bb95a)

VERDICT: APPROVE-WITH-NITS — see the PR body for the full text,
pasted verbatim. Educator seat: type shape, parser strictness,
follow-up order, and unchanged choice entries all verified; no
content risk. Accessibility seat: 44px, labelled input, Enter
submits, same role="status" wrong line, no new motion.
Nits, dispositioned: (1) stale typed input across phases — FIXED
(AnswerCard keyed by item + phase, clears on transition/next case).
(3) parser doc over-promised on spaces — FIXED (all whitespace now
stripped, "1 081" = 1081; "1,2,3" still rejected). (2) `value` is
comment-required, not type-enforced, for kind "number" — DEFERRED:
a discriminated union would ripple into every subject's answers
module and its tests (`entry.choices` access); runtime fails closed
(missing value is always wrong) and no shipped number entry exists
yet. (4) no focus move/announcement when the follow-up appears —
DEFERRED to the follow-up's adopting subject (needs a focus target
in the card; autoFocus would fight the arrival-focus pattern).

## Not checked

- No live-device listen (text only, no audio in this stream;
  `src/game/audio/voice-channel.ts` is not on main — text only
  shipped, as the brief requires).
- No shipped item uses `kind: "number"` or `followUp` yet, so the
  number card + follow-up have no in-app e2e path until a subject
  agent adopts them; the e2e spec proves the unchanged choice flow.
- CI on the PR (full suite + e2e) is the remaining gate.
- Educator review runs alongside, after release (progressive
  release, owner rule Nov 13) — not a gate.

## Not done / later

- Adopting `kind: "number"` / `followUp` in a subject's answers
  (math, journals) — subject streams' work, not this stream.
- `/pstack`, `gstack`, `agent-agency` are NOT installed in this
  environment — plain sub-agents were used, as the brief allows.

## Next step

Push BLOCKED 2026-11-14 ~02:45 UTC: `git push` fails "Invalid
username or token" and the GitHub API helper 401s — the stored
credential is invalid (same class as the Nov 11 triage). Do NOT
paste a token in chat; do NOT retry blindly. Recovery left in
place: verified thin bundle
`~/workspace/meridian-v2-number-answer-thin.bundle` (38 KB, ref
7811901, prerequisite 8a12ff6) + worktree
`~/workspace/meridian-v2-number-answer`. Owner re-auths (fresh
token on the secure page, as on 2026-11-09), then pushes the branch
and opens the draft PR ("Shared case: typed-number answers and a
follow-up question (v2)") with the reviewer verdict pasted verbatim.
Never merge; owner merges after CI is green.

## Graph

- Node: `feat/v2-number-answer` (branch), documents
  `src/subjects/shared/answer.ts`, `AnswerCard.tsx`,
  `SubjectCase.tsx`. No graph.json edit (integrator-only).
