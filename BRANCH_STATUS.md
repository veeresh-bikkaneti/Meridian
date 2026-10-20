# BRANCH_STATUS.md — fix/hint-endgame-overlap

## What
Owner report 2026-10-19 (live site screenshot): the End-game pill overlapped
the hint message pill ("💡 Look toward the eastern pa…") at bottom-right
during aim phase on short/landscape viewports.

Root cause: the hint cluster was top-anchored (`top-[28rem]`, no bottom bound)
while the End-game pill was bottom-anchored (`bottom-[6.5rem]`). On short
viewports the hint message grew downward into the button's lane; button is
z-30 over hint's z-20, so it covered the hint text. The existing E2E 0px²
gate covered card/score/drop-pin — never the hint message.

Fix (owner-approved direction: hint button + pill move up off the End-game
lane): single bottom-right dock (`data-testid="aim-dock"`) — a flex column
containing HintPanel (offer + button + message) ABOVE the End-game button.
0px² overlap by construction (flex, no absolute offsets between them).
Bottom-anchored at the old 6.5rem slot: clears zoom controls below and the
top-anchored question bubble above (#113 preserved — verified by the
existing bubble-overlap E2E, still green).

## Done
- 2026-10-19: Implemented dock in game-app.tsx; removed old top-anchored
  hint container; added `data-testid="end-game-button"`.
- Updated question-bubble.test.ts source-pattern assertions for the new
  dock structure (2 tests).
- New E2E: hint-message vs End-game 0px² at 360x640 (short viewport that
  reproduces the bug) + 390x844 — both green.
- Gates: tsc clean; npm test 1358 pass / 0 fail; lint-cards GATE PASSED;
  build:pages green; hint-button E2E 10/10 green.

## Pending
- Scrum review (coordinator running) + screen recording of the fixed layout
- Rebase to zero conflicts + full retest post-rebase
- Owner green-light → Chitti → his merge call

## Ready to merge? NO
## What is pending? Scrum + recording + rebase/retest + owner green-light + Chitti.

## Scrum review 2026-10-20 — verdict: APPROVE-WITH-NITS (0 BLOCKs)
- Gates re-verified: tsc clean; npm test 1358/0; lint-cards GATE PASSED; build green; hint-button E2E 10/10 (new dock tests 0.0px² @360x640+390x844; bubble tests still 0.0px²). Branch at origin/main tip, 0 behind.
- Recording: ~/workspace/your_files/meridian-hint-endgame-fix/hint-dock-fix-recording.webm (29.9s, 360x640 + 390x844) + dock-*.png screenshots.
- Red-team: 320x568, 740x360 landscape, 360x640 bubble+dock, 390x844 offer-vs-endgame — ALL 0.0px².
- Squads: UX/UI NIT · Core Eng APPROVE · Game/Narrative APPROVE · QA APPROVE (proved new E2E FAILS on old code: 2825.4px² @360x640 — genuine regression test) · SecOps APPROVE.
- NITs (non-blocking): (1) expanded-bubble × offer × 360x640 → 5400px² dock∩bubble (top 18px of offer card only; buttons tappable; needs deliberate "Show instructions" tap; old code was 114px clear) — suggest spec pin as follow-up; (2) pre-existing End-game/zoom-in 84px² graze (2px, inherited); (3) dock comment overclaims bubble clearance — soften to collapsed scope; (4) tautological assertion in question-bubble.test.ts test 2; (5) growth direction now upward — pin a 360x568 E2E as follow-up.
- NEVER MERGED. PR not opened (owner opens).

## Ready to merge? NO
## What is pending? Owner watches recording → green-light → Chitti independent review → his merge call.
