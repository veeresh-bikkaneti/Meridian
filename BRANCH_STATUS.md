# BRANCH_STATUS — feat/wave2-mode-screens

**Branch:** `feat/wave2-mode-screens`
**Base:** `main` at `fa9f36b` (includes the PR #241 merge)
**State: WORK COMPLETE at code head `76d2b21` — all local gates green
(QA pass, logs in `~/workspace/meridian-wave2-b3/logs/qa-*.log`); the
evidence + paperwork commits follow on top, then the Peer Reviewer
(pass 10) verdict APPROVE WITH FIXES with its fixes landed (test pin
+ paperwork; re-run gates in `logs/peer-*.log`, src suite 1510/1510).
The branch is LOCAL ONLY — not pushed, no PR yet (see Push status).** Wave 2 mode-screens work:
WI-12 State, Country, GeoDetective and Cold Trail screens onto the
existing shared (Atlas) design tokens, WI-13 Cold Trail sticky map +
kid-safe band themes. It supersedes the previous contents of this file
(the `feat/wave2-content-quality` branch record, whose history lives
on its own PR #241).

## Scope (exactly this — no drive-by changes)

1. **WI-12 Atlas parity** — four new classes appended to
   `src/styles.css` as pure additions (`.mode-screen`, `.mode-title`,
   `.mode-card`, `.mode-surface`; no token definition edited) and
   className-only restyles of the Cold Trail screen, the GeoDetective
   screen, and the quiz play view (loading/error mains + `PlayLoaded`
   HUD incl. the two switch-note banners). Design decision C-1, stated
   plainly: parity is with home's Atlas chart-room layer, not its hv5
   parchment skin — hv5 tokens are scoped under `.home-v5` and cannot
   reach game screens without a Branch-2 token promotion (OD-3).
   Not touched: `QuestionBubble`, `ResultCard`, `LoopMap`, token
   definitions, `Choose`, `RegionList`, `map-mode-toggle.tsx`.
2. **WI-13 Cold Trail layout + themes** — sticky map (DOM order
   unchanged; `.ct-layout`/`.ct-map`, legend moved out onto
   `.mode-surface`, measured scroll margins: `.ct-map` 341px at
   320×568 leaving a 227px reading strip; ≥1024px two-column grid) and
   one approved theme per band in the new pure module
   `src/game/coldtrail/themes.ts` (5–7 T57-A "Pip the Lost Puppy",
   8–10 T810-A "The Missing Treasure Map", 11–13 T1113-A
   "GeoDetective Casebook"). Sighting sentences are composed at render
   from structured fields; the generator and `cases.generated.json`
   are byte-untouched. `engine.ts` gains `scoreBand()` (thresholds
   verbatim) and loses `verdictFor`; scoring constants untouched.
   Child Safety gate: 66 string IDs ruled (51 approved, 3
   approved-with-edit, 12 rejected with required rewrites, all applied
   verbatim); confirmation pass at `76d2b21` closed F-B/F-C, ruled the
   legend contrast a PASS, and confirmed conditions 1–6 all PASS.

## Done vs pending, per WI

### WI-12 — done

- [x] Styles block + per-screen restyles (4 commits, one per surface,
  each independently revertible).
- [x] Before/after screenshots: 32 (4 screens × 4 widths ×
  before/after) in `docs/reviews/mode-screens-shots/before|after/`,
  plus 3 paper-theme spot shots at 375px in `after/` (paper caveat:
  `data-theme` set post-load and asserted at capture; map colours may
  predate it). Trail after shots are pre-WI-13 by design.
- [x] No new fonts/hosts/requests (Security diff audit: zero new URLs,
  request APIs, fonts or dependencies in added lines).
- [x] Existing e2e for these modes: no regression (see Gates).

### WI-13 — done

- [x] Sticky layout at all four widths; layout test 12/12; reading
  strip 227px ≥ 200px floor at 320×568 worst hint state; 0 tap
  targets < 44px; 200%-zoom-equivalent reflow clean.
- [x] Band themes wired (`resolveBand()` snapshot at mount + Next
  Case; unset profile → existing 11–13 default; no new data).
- [x] Band-isolation test incl. mutation check: planted `smuggler`
  fails (exit 1), reverted run 7/7 pass.
- [x] Evidence: E2 layout shots 8, E3 per-band shots 15 + 1 extra,
  E4 transcripts 6, E5 tab-order logs 2, E6 feel-gate log 1 — in
  `docs/reviews/mode-screens-shots/wi13-layout|wi13-bands/` and
  `~/workspace/meridian-wave2-b3/logs/`.
- [x] Feel gate: all 3 rings placed + finishing tap at 320×568 with
  no page zoom; reveal heading unoccluded at 375px.

### Pending (not this branch's to finish)

- [x] Peer Reviewer pass (pass 10): APPROVE WITH FIXES — F-2 exact
  theme-string pin test landed (`136627b`); F-1 shared-strings gate
  gap recorded for a Child Safety ruling by ID (see review doc).
  RESOLVED 2026-10-24 — Child Safety supplementary ruling approved all 31 shared-string IDs (T-SHARED-*), zero edits; AC-13.9 fully closed (102 IDs total).
  G-1 runtime host capture identical per mode on branch vs base;
  G-2 End-game pill pin verified present in `question-bubble.test.ts`.
- [ ] Engineering Lead verdict.
- [ ] CI on Node 22.x — has not run; the PR is not opened yet. Local
  gates ran on Node v24.22.1.
- [ ] Owner's merge decision. **Not merged — only the owner merges.**
- [ ] Post-merge production verification (owner, after merge): open
  each of the four modes at phone width on production + screenshots;
  play a Cold Trail round in the 5–7 band and confirm the kid-safe
  theme. Caveat C-4: the home picker card still shows the old
  smuggler copy until OD-1 is fixed elsewhere.
- [ ] Owner decisions in the PR: OD-1 (`Choose` card copy —
  owner/Branch 2), OD-2 (smuggler replacement authorised; override
  window), OD-3/C-1 (Atlas parity interpretation; hv5 = Branch-2
  token promotion), RegionList/picker restyle gap (owner/Branch 2).

## Commits (7 code commits on top of base `fa9f36b`, + evidence/docs)

- `109a9a9` feat(wi-12): add mode-screen Atlas classes to styles.css
- `15a24f3` feat(wi-12): Cold Trail screens onto Atlas mode tokens
- `043ed38` feat(wi-12): GeoDetective screen onto Atlas mode tokens
- `a393b82` feat(wi-12): quiz play view onto Atlas mode tokens
- `386310e` feat(wi-13): add Cold Trail band themes module (unused)
- `79e6caa` feat(wi-13): engine scoreBand split + band-theme wiring for Cold Trail
- `76d2b21` feat(wi-13): Cold Trail sticky map layout (.ct-layout/.ct-map, legend out, measured scroll-margins)
- test(e2e): WI-12/WI-13 evidence specs and screenshots — this paperwork series
- docs(branch): wave2 mode screens review doc and branch status — this commit
- `136627b` test(coldtrail): pin every rendered theme string to the gate-approved text (peer review F-2)
- docs(branch): peer reviewer pass-10 record — review doc + branch status corrections (this commit)
- docs(wave2): record F-1 resolution — Child Safety supplementary ruling closes AC-13.9 (this commit)

Deviations recorded in the review doc: the End-game pill keeps
`text-xs` (pinned by `question-bubble.test.ts`) against UX A5's ≥14px
HUD rule; the map-shrink rule carries a `max-height: 800px` condition
the ADR's literal selector did not; the score-breakdown popover and
the map-mode-toggle pill were left unrestyled (the latter's file is
not owned by this branch).

## Gates (this branch; run at code head `76d2b21`, logs in
`~/workspace/meridian-wave2-b3/logs/`; baseline at `fa9f36b` in
`logs/baseline-summary.md`)

- `npx tsc --noEmit` — clean, exit 0 (baseline: clean).
- `npm test` — exit 0. Scripts suite: 832 pass / 0 fail / 9 skipped
  (baseline: same). Src suite: 1510 pass / 0 fail (baseline: 1502;
  +8 = the new `themes.test.ts`, incl. the Peer Reviewer's pin test;
  re-run after the peer fixes in `logs/peer-test.log`).
- `node scripts/lint-cards.mjs` — GATE PASSED, exit 0.
- `npm run build:pages` — exit 0, green.
- Security-headers tests — 14 pass / 0 fail; `src/lib/security-headers.ts`
  and `public/_headers` untouched and still matched.
- Playwright E2E, enumerated mode set only (11 files / 59 tests):
  branch 54 passed / 5 failed, and all 5 failures fail identically on
  unmodified base `fa9f36b` — no regression. The reveal/admin1 family
  is not green on base either; it is not claimed as passing. Cold
  Trail 14/14, GeoDetective 26/26 on the branch.
- Environment note: gates ran on this VM under Node v24.22.1; CI uses
  Node 22.x — the CI run is still to confirm. The known
  "Workers Builds: meridian" CI failure is a preview-config issue and
  is not chased.

Full detail: `docs/reviews/2026-10-21-wave2-mode-screens.md` and the
persona sections in the PR body.

## Push status — LOCAL ONLY

- The crew did not push and did not open a PR. The parent agent
  replays the branch onto origin through the GitHub API and opens the
  PR with the assembled description.
- **No merge, no deploy** — those wait for the owner's separate word.
  Only the owner merges.
