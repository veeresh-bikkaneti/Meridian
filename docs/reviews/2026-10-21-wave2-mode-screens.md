# Branch review — Wave 2 mode screens (`feat/wave2-mode-screens`)

**Branch:** `feat/wave2-mode-screens`
**Base:** `main` at `fa9f36b` (PR #241 squash merge)
**Head reviewed:** code head `76d2b21` (final gates; the evidence and paperwork commits follow on top)
**Work items:** WI-12 (State, Country, GeoDetective and Cold Trail screens onto the existing shared design tokens), WI-13 (Cold Trail: map stays visible while reading clues; kid-safe case themes per age band)
**Commits:** `109a9a9` (WI-12 styles block) · `15a24f3` (WI-12 Cold Trail) · `043ed38` (WI-12 GeoDetective) · `a393b82` (WI-12 quiz play view) · `386310e` (WI-13 themes module) · `79e6caa` (WI-13 engine split + theme wiring) · `76d2b21` (WI-13 sticky layout) · evidence + docs commits (this paperwork)

All numbers in this document come from the crew's log files on disk (`logs/baseline-summary.md`, `logs/baseline-npm-test.log`, `logs/qa-tsc.log`, `logs/qa-test.log`, `logs/qa-lint.log`, `logs/qa-build.log`, `logs/qa-e2e-branch.log`, `logs/qa-e2e-base.log`, `logs/qa-e2e-base-coldtrail-rerun.log`, `logs/qa-layout.log`, `logs/wi13-feel-gate.log`, `logs/mutation-planted.log`, `logs/mutation-reverted.log`, `logs/security-*.log`) and the persona records in `~/workspace/meridian-wave2-b3/personas/`, each of which cites its log. No number is taken from a summary alone. Screenshots are committed under `docs/reviews/mode-screens-shots/`.

## What shipped, per work item

### WI-12 — Mode screens onto the shared tokens

Four new classes are appended to `src/styles.css` as pure additions — no token definition is edited (AC-12.9): `.mode-screen` (full-viewport Atlas ground via a `::before` fixed layer carrying the `.atlas-bg` stack; the `<main>` itself stays transparent), `.mode-title` (Fraunces display family), `.mode-card` (`background: var(--atlas-card)`, `border: var(--atlas-card-line)`, radius 18px, no `backdrop-filter`, no padding — each card keeps its own `p-4`/`p-5`), and `.mode-surface` (background + border-colour only, for sheets and surfaces whose shape must not change). Per screen:

- **Cold Trail (`15a24f3`):** `TrailScreen` shell/header/reveal onto `.mode-screen`/`.mode-title`/`.mode-card`; `SightingCard` surface + `.name-eyebrow`; `InterceptConfirm` sheet onto `.mode-surface`; the placement Cancel banner button becomes the shared `Button`.
- **GeoDetective (`043ed38`):** `LoopScreen` shell/header (h1 at `text-4xl sm:text-5xl`), `ClueCard` + loading/error/offline cards onto `.mode-card`, `PlaceSheet` container and `LoopReveal` section onto `.mode-surface`.
- **Quiz play view (`a393b82`):** `Play` loading/error mains onto the mode treatment; `PlayLoaded` HUD block onto `.game-chrome` surfaces with `--atlas-ink` text; the two switch-note banners (tile + scout) restyled className-only — no handler, testid or logic change; the `SoundToggle` `hover:text-white` (invisible on hover in light/paper) removed. `PlayLoaded`'s `<main>` itself gains no ground class — the satellite map covers the viewport, so the HUD is the whole change there.
- **Not touched:** `QuestionBubble`, `ResultCard`, `LoopMap`, map tiles/styles, token definitions, the `Choose` home picker, `RegionList`, and `map-mode-toggle.tsx`.

**Design decision C-1 — Atlas parity, stated plainly.** "Existing shared tokens" is interpreted as the `:root` base tokens plus the Atlas system in `src/styles.css` (Fraunces/Karla/Space Mono, brass, `--atlas-card` surfaces). The hv5 parchment skin is scoped under `.home-v5` in `home-v5.css` and cannot reach game screens without a Branch-2 token promotion, so WI-12 delivers parity with home's Atlas chart-room layer, **not** its hv5 parchment cover. If the owner meant hv5 parity, that is an owner/Branch-2 decision (OD-3 in the PR). In light/paper the two layers are visually adjacent; in the default dark scheme the home→mode transition still changes register, and the after screenshots show exactly that.

**Contrast law applied (Child Safety gate).** Normal-size muted text never sits directly on the `.mode-screen` gradient in light/paper — measured 4.37–4.44:1 there, below WCAG AA — it sits only on `.mode-card`/`.mode-surface`/`.game-chrome` (5.33–5.64:1) or in `--fg`/`--atlas-ink`. `--atlas-faint` is not used for mode-screen text. HUD text is `--atlas-ink`; no 11px eyebrows were added inside the PlayLoaded HUD (see Deviations for the one pre-existing exception).

**Evidence.** 32 before/after viewport screenshots (4 screens × 320/375/768/1280 px × before/after) via the repo Playwright harness (`serveBuiltArtifact`, `127.0.0.1:4123/Meridian/`), the before set captured on an unmodified `fa9f36b` worktree: `docs/reviews/mode-screens-shots/before/` (16) and `after/` (16 of its 19). Plus the required paper-theme spot set at 375px (Loop, Trail, PlayLoaded HUD — the 3 `*-375-paper.png` files in `after/`). Paper caveat: the app has no in-app switch that sets the paper theme before load, so the paper captures set `data-theme="paper"` on `<html>` via an init script and re-set it post-load (the app strips the attribute during boot); the spec asserts the attribute reads `"paper"` at capture time. The captures therefore show the `:root[data-theme="paper"]` token block applied post-load, not a user-reachable theme toggle; map colours may predate the attribute being set. Trail's WI-12 after shots are labelled pre-WI-13: they were taken before WI-13 rewrote that screen's strings and layout, and the WI-13 evidence set below is Trail's final visual record.

### WI-13 — Cold Trail sticky map + band themes

**Layout (ADR-13, as amended).** Sticky, one pattern at every width, DOM order unchanged (header → sighting cards → map section). A new `.ct-layout` flex wrapper renders `.ct-map` above the cards via `order: -1`; `.ct-map` is `position: sticky; top: 0; z-index: 10` on `background: var(--game-chrome-solid)` with `padding: 8px 0` and a `--game-chrome-line` bottom border. The legend moved **out** of `.ct-map` to immediately after `.ct-layout`, on a `.mode-surface` wrapper; the sticky children are only the status line, the map, and the hint row. At ≥1024px the success `<main>` widens to `lg:max-w-6xl` and the wrapper becomes a grid (`minmax(320px, 380px) 1fr`, gap 1.5rem, map in column 2, still sticky). No transition, animation or `scroll-behavior: smooth` was added to any `.ct-*`/`.mode-*` rule (Child Safety condition 5, verified by grep of the shipped CSS).

**Measured heights, not estimates.** Scroll margins were set from measurements on the branch build with a hint visible, worst state = all-rings-down status + hint (`logs/qa-layout.log`, and the comment in `src/styles.css`): `.ct-map` is 341px at 320×568 (reading strip 568 − 341 = **227px**, above the 200px floor), 361.1px at 375×667, 613.5px at 768×1024. Card `scroll-margin-top` = measured + 8px, rounded up, per breakpoint: 349px (base), 370px (375–767px), 622px (768–1023px), 8px (≥1024px grid). On mobile the map itself shrinks to `36dvh` with `min-height: 220px` — see Deviations for the exact selector shipped.

**Themes.** One new pure module, `src/game/coldtrail/themes.ts` (+ `themes.test.ts`), holds exactly one theme per band — 5–7 T57-A "Pip the Lost Puppy", 8–10 T810-A "The Missing Treasure Map", 11–13 T1113-A "GeoDetective Casebook" — with every child-facing string in slots S1–S9. `TrailScreen` is the only component that resolves a band, via `resolveBand()` from the `@/game/age-profile` facade, snapshotted at mount and refreshed on Next Case; `SightingCard`/`InterceptConfirm` receive `theme` as a prop and stay presentational. An unset profile keeps the existing `FULL_ACCESS_BAND = "11-13"` default; no new storage key, cookie or request is introduced. Sighting sentences are composed at render from the structured fields (`radiusKm`/`octant`/`cityName`); the generator script and `cases.generated.json` are byte-untouched and `sighting.text` is never rendered. `fmtRadius` reproduces the generator's format exactly (`Math.round(km).toLocaleString("en-US") + " km"`, unhyphenated octant words) — see the C-5 note under Deferred. In `engine.ts`, `scoreBand()` was added with the thresholds verbatim (≤100 / ≤300 / ≤800) and `verdictFor` deleted; `verdictForTheme(theme, km)` returns the theme's strings with `caught = scoreBand ≤ 1`, exactly as before. `INFORMANT_COST`/`SOLVE_REWARD`/`STARTING_STARS`/`scoreIntercept`/`effectiveRadius` are untouched.

**Theme approval.** The Child Safety gate ruled on 66 string IDs: 51 approved, 3 approved-with-edit, 12 rejected with required rewrites — the shipped strings use the gate's verbatim replacement text for every edited/rewritten ID. Its confirmation pass at head `76d2b21` additionally approved the helper-unavailable arias (F-B, 3 strings) and the retained helper-button `title` tooltip (F-C, both variants), ruled the legend's contrast on `.mode-surface` a PASS with no fallback required (worst case 4.94:1, light gold spans), confirmed all six E4 transcripts contain only approved strings, and confirmed binding conditions 1–6 all PASS (1, 2, 3, 6 on QA's measured evidence; 4 and 5 verified first-hand by that seat). The unpicked candidates (T57-B, T57-C, T810-B, T810-C, `SP-57-ACTIVITY`) are **not implemented and not approved**.

**Evidence.** E2 layout shots: 8 (`docs/reviews/mode-screens-shots/wi13-layout/`, 4 widths × top / scrolled-to-card-3). E3 per-band walkthrough shots at 375px: 15 (`wi13-bands/`, 3 bands × header+cards, helper-used, confirm sheet, reveal-win, reveal-far-miss) plus 1 extra 5–7 far-miss reveal shot (16 files in that folder). E4 transcripts: 6 (`logs/wi13-transcript-*.txt`, 3 bands × win/far-miss, S1–S9 stages). E5 tab-order logs: 2 (`logs/wi13-taborder-375.txt`, `logs/wi13-taborder-1280.txt`) — recorded order is DOM order (cards → map actions) and no real control is occluded by the sticky map at either width. E6 feel-gate log: 1 (`logs/wi13-feel-gate.log`) — at 320×568 all 3 rings placed and the finishing tap completed with page zoom unchanged (scale 1 → 1); at 375px the reveal heading does not overlap the sticky map. The layout test itself passes 12/12 (3 cards × 4 widths: map intersects viewport, primary button in viewport, unoccluded, `elementFromPoint` returns the button — `logs/qa-layout.log`). Cold Trail has **no in-screen read-aloud control**, so no read-aloud audio evidence is claimed for it anywhere in this record.

## Per-AC evidence map

| AC | Verdict | Evidence |
|---|---|---|
| AC-12.1 type scale | PASS | Diff audit per screen (Architect gap analysis + Developer commits `109a9a9`–`a393b82`); after screenshots |
| AC-12.2 colour from tokens | PASS | Security diff audit: zero new colour literals except the two pre-existing `#C9A227` reticle literals, listed as an exception and unchanged (`logs/security-grep-added.log`) |
| AC-12.3 spacing & buttons | PASS | Shared `Button` throughout; tap targets measured ≥44px, 0 below (`logs/qa-layout.log`) |
| AC-12.4 screenshots 32 | PASS | `mode-screens-shots/before/` 16 + `after/` 16, harness-captured, byte-verified copies |
| AC-12.5 no new fonts | PASS | Security audit: no `@font-face`, font file or font link in added lines |
| AC-12.6 no new hosts/requests | PASS (diff proof + runtime capture) | Security audit of the code diff: no `fetch`/XHR/WebSocket/beacon, no new outbound URL in any added code line (the only `http://` URLs in the final full diff are the loopback harness address `127.0.0.1:4123` in the two evidence specs). Runtime proof added by the Peer Reviewer (G-1, below): per-mode request-host sets identical on branch and base builds |
| AC-12.7 existing e2e passes | PASS | §Gate table: 54/59 on branch, all 5 failures identical on unmodified base; Cold Trail 14/14, GeoDetective 26/26 |
| AC-12.8 repo gates | PASS | §Gate table (`logs/qa-*.log`) |
| AC-12.9 tokens consumed, never edited | PASS | `styles.css` diff is pure additions (new `.mode-*`/`.ct-*` blocks); Security confirms no token-definition file in the diff |
| AC-13.1 map visible, mobile | PASS | Layout test 320/375 portions, 6/6 card checks; E2 shots |
| AC-13.2 map visible, desktop + focus order | PASS | Layout test 768/1280 portions; E5 tab-order logs |
| AC-13.3 gameplay unchanged | PASS | Cold Trail e2e 14/14; engine thresholds/`caught` pinned by unit tests; scoring constants untouched in diff |
| AC-13.4 band routing, no new data | PASS | `themes.test.ts` registry/default assertions; Security §2 audit (no new storage/cookie/request) |
| AC-13.5 young bands kid-safe only | PASS | Gate approval record + E4 transcripts (eyebrow-verified per band, lexicon grep clean) |
| AC-13.6 11–13 detective tone, no crime words | PASS | Lexicon check in `themes.test.ts` over rendered strings, all bands |
| AC-13.7 adult theme reaches no band | PASS | String inventory vs gate record; all 12 sighting verbs asserted absent in `themes.test.ts` |
| AC-13.8 isolation test + mutation | PASS | Planted-`smuggler` run fails (exit 1, 2 tests) — `logs/mutation-planted.log`; reverted run 7/7 pass — `logs/mutation-reverted.log` |
| AC-13.9 Child Safety approves every string | PASS | Gate record: 66 IDs ruled; confirmation pass closed F-B/F-C. RESOLVED 2026-10-24 — Child Safety supplementary ruling approved all 31 shared-string IDs (T-SHARED-*), zero edits; AC-13.9 fully closed (102 IDs total). |
| AC-13.10 reading level & tone | PASS | Gate §3 rulings per band, incl. the two 5–7 spoken-wording edits |
| AC-13.11 existing checks pass | PASS | §Gate table |
| AC-13.12 no new requests/hosts/data | PASS (diff proof + runtime capture) + post-merge check pending | Security §1–§2; Peer Reviewer G-1 runtime host capture (below); the production 5–7 round is an owner post-merge step, not claimable pre-merge |

## Gate table — baseline vs final

Baseline is pristine base `fa9f36b` (`logs/baseline-summary.md`, `logs/baseline-npm-test.log`). Final is code head `76d2b21` (QA pass, `logs/qa-*.log`), plus the Peer Reviewer's test-only fix commit on top (src suite 1510; re-run gates in `logs/peer-*.log`).

| Gate | Baseline (`fa9f36b`) | Final (`76d2b21`) |
|---|---|---|
| `npx tsc --noEmit` | clean, exit 0 | clean, exit 0 |
| `npm test` — scripts suite | 841 tests, 832 pass / 0 fail / 9 skipped | 832 pass / 0 fail / 9 skipped |
| `npm test` — src suite | 1502 tests, 1502 pass / 0 fail | 1510 tests, 1510 pass / 0 fail (+8 = new `themes.test.ts`, incl. the Peer Reviewer's exact-string pin test) |
| `node scripts/lint-cards.mjs` | GATE PASSED | GATE PASSED, exit 0 |
| `npm run build:pages` | exit 0 | exit 0, green |
| Security-headers tests | — | 14 pass / 0 fail; headers pair still matched |

Targeted Playwright E2E on the built artifact (QA pass; enumerated set = the four modes' specs on main, 11 files / 59 tests, `logs/qa-e2e-branch.log`):

| Set | Result |
|---|---|
| Branch, enumerated set | 54 passed / 5 failed |
| The same 5 tests on unmodified base `fa9f36b` | All 5 fail identically (`logs/qa-e2e-base.log`); base additionally failed 2 more tests in the same family that pass on the branch — the reveal/admin1 family is not green on base either, and this record does not claim it passes |
| Cold Trail (`coldtrail.spec.ts` 10 + `.mobile` 3 + `.reduced` 1) | 14/14 on branch; 14/14 on base (isolated rerun, `logs/qa-e2e-base-coldtrail-rerun.log`) |
| GeoDetective (4 spec files, 26 tests) | 26/26 on branch |
| QA layout/evidence spec (`tests/e2e/qa-evidence.spec.ts`) | Layout 12/12 card checks; conditions 2 and 6 PASS; feel gate PASS |

**Node version note:** every gate above ran on this VM under Node v24.22.1. CI runs Node 22.x. The branch has not run CI yet — the PR is not opened at the time of writing — so the local green results are VM results and the CI run on 22.x is still to confirm.

## Deviations

1. **End-game pill keeps `text-xs`.** UX amendment A5 set HUD text at ≥14px, but the End-game pill in `PlayLoaded` retains its pre-existing `text-xs` class: that size is pinned by an existing assertion in `question-bubble.test.ts`, and changing it would break a test outside this branch's owned surfaces. The pill did gain the `.game-chrome` surface and `--atlas-ink` text; only the size step was not applied. Recorded here rather than silently excepted.
2. **Map-shrink selector carries a `max-height: 800px` condition.** ADR-13 specified the `<768px` map shrink (`36dvh`, min 220px) by width alone. As shipped, the rule is `@media (max-width: 767px) and (max-height: 800px)`: on tall phones (e.g. 390×844) the full-height map fits and shrinking it would move the map's bottom attribution bar into the area players tap to plant rings (the reason is recorded in the CSS comment at the rule). The layout e2e evidence (12/12, feel gate at 320×568) was captured under the shipped selector.
3. **Score-breakdown popover left unrestyled.** The session score-breakdown popover in `PlayLoaded` (`data-testid="session-score-breakdown"`) keeps its base-token styling (`border-line bg-surface text-xs`). It is a transient popover off the score button, not one of the four screens' chrome surfaces in the ADR-12 edit list, and it was left alone rather than expanded into scope.
4. **Map-mode-toggle pill left unrestyled.** The play-context pill in `src/components/map-mode-toggle.tsx` carries the same dark-literal family as the restyled HUD, but that file is not in this branch's owned list (UX A3). Over satellite imagery the dark pill is legible in both themes, so the leftover is cosmetic. Deferred, below.

## Deferred items

- **OD-1 / C-4 — home picker card copy.** The `Choose` home-picker Cold Trail card still reads "A smuggler moves between cities… make the interception." It is home surface (Branch 2 / PR #242's hunks) and this branch never edited `Choose`. A 5–7 player meets the adult theme there before reaching the themed screen, and the post-merge production check will still show it. Owner/Branch-2 decision: who rewrites that copy, in which PR.
- **OD-3 / C-1 — hv5 parity.** If the owner wants the hv5 parchment skin on game screens, Branch 2 must promote the hv5 tokens out of `.home-v5` scope. This branch consumed Atlas tokens only.
- **RegionList / picker restyle gap.** The State journey's drill-down lists (`RegionList` and the menu returns in `game-app.tsx`) stay in base tokens — they are picker surfaces, excluded by the charter and adjacent to PR #242. The PO's "cannot point to where the nice game stopped" success line is therefore not fully achievable for State on this branch. Owner/Branch 2's call.
- **Map-mode-toggle pill** (Deviation 4) — restyle when that file is next owned.
- **C-5 — km/miles note.** A USA-target case can show "1,275 km northeast of Denver." in the sighting sentence and "Ring radius: ~792 mi" on the same card. The sentence format is generator-mandated, matches main today, and is pinned by the AC-13.8 format tests; the radius line localises, the sentence does not. Preserved deliberately; the owner may commission a format change separately.
- **Unshipped theme candidates.** T57-B, T57-C, T810-B, T810-C and `SP-57-ACTIVITY` were not approved and are not implemented. Promoting any of them is a new Child Safety approval cycle, not a fallback.

## Process disclosure — Tier 2 mapping

`AGENTS.md` classifies this work as **Tier 2** (new feature, 3+ files): the council protocol calls for a signed Consensus Manifest before code — ATDD scenarios, TDD contracts, adversarial challenge, Chair sign-off.

This crew ran the charter's Scrum passes with the Product Owner + Architect passes as the council-equivalent, and — unlike Branch 4 — the manifest exists as one signed document (`~/workspace/meridian-wave2-b3/CONSENSUS-MANIFEST.md`, assembled by the coordinator as Chair-equivalent, incorporating the coordinator rulings C-1–C-6, the UX amendments A1–A10 / B1–B9, and the Child Safety gate). No implementation code was written before it. The adversarial challenge still runs after the code, as the Peer Reviewer pass (pass 10) — that delta from the council protocol is stated openly, as Branch 4 stated it. This disclosure also appears in the PR description.

## Untested / still owed

- **Runtime network capture — now done (Peer Reviewer G-1).** AC-12.6 / AC-13.12 were originally evidenced by the Security seat's diff audit only. The Peer Reviewer ran the pictured capture: each of the four modes played briefly on the branch build and on the unmodified base worktree build under `serveBuiltArtifact`, logging every initiated request host (`logs/host-capture-branch.log`, `logs/host-capture-base.log`, raw TSVs alongside, diff in `logs/host-capture-diff.log`). Host sets are **identical per mode** — `{127.0.0.1, server.arcgisonline.com}` on both builds, empty diff in both directions. The capture observes requests at initiation, before route stubbing (the Esri tile host appears in it), so it is a real runtime proof, and the Security diff audit now stands corroborated rather than alone.
- **No real screen-reader pass** (VoiceOver / NVDA / JAWS / TalkBack) on the restyled screens. Focus/SR order is evidenced by the E5 tab-order logs and code inspection; that is not a screen-reader test. Zoom is evidenced at the 200%-equivalent layout check only; forced-colours and device passes were not performed.
- **No device speech testing**, and Cold Trail has no in-screen read-aloud control to test (see WI-13 evidence note).
- **CI has not run** (Node 22.x) — see the Node version note above.
- **Post-merge production verification** (charter) is pending the owner's merge: open each of the four modes at phone width on production with screenshots, then play a Cold Trail round in the 5–7 band and confirm the kid-safe theme — with the C-4 caveat that the home picker card will still show the old smuggler copy until OD-1 is fixed elsewhere.

## Peer Reviewer (pass 10, adversarial) — APPROVE WITH FIXES

Full record: `~/workspace/meridian-wave2-b3/personas/peer-review.md`. The whole diff was re-read as a stranger; every factual claim in the PR description was checked against code and logs. Fixes landed as commits on this branch (test-only + this paperwork); gates re-run green after the fixes (`logs/peer-tsc.log`, `logs/peer-test.log`, `logs/peer-lint.log`, `logs/peer-build.log`: tsc clean; scripts 832/0/9; src 1510/1510; lint-cards GATE PASSED; build exit 0).

- **F-1 (Medium, paperwork — owner/Child Safety follow-up, not a code defect).** A family of pre-existing, band-neutral shared strings on the Cold Trail screen was never ruled by ID in the Child Safety gate: the placement/flow hints in `TrailScreen` (e.g. "Ring planted — move it with arrow keys…", "Placement canceled — no ring placed."), the `SightingCard` action labels and status suffixes ("📍 Place ring on map", "✓ Ring placed", "Yes, keep it", "Ring radius:", " — not on the map yet"), and `InterceptConfirm`'s "Not yet". They are unchanged from base, contain no banned lexicon, and are not theme strings — but the gate's "every string by name" claim does not cover them. They need a shared-strings ruling by ID (same treatment the gate gave `SHARED-mapLabel-placing` / `SHARED-confirmCancel-aria`) before AC-13.9 is claimed without qualification. **RESOLVED 2026-10-24 — Child Safety supplementary ruling approved all 31 shared-string IDs (T-SHARED-*), zero edits; AC-13.9 fully closed (102 IDs total).**
- **F-2 (Low — FIXED).** `themes.test.ts` checked the rendered strings against the banned lexicon but pinned none of them exactly, so an approved wording could drift without a test failing (the ADR's "per-theme title assertions move to themes.test.ts" had not actually happened). Fixed by an exact character-for-character pin of all 48 rendered strings per band, each verified first-hand against the gate record (all 3 edited + all 12 rewritten IDs included).
- **F-3 (Low, evidence quality).** The paper-theme captures for Cold Trail and GeoDetective (`after/*-375-paper.png`) are byte-identical to the non-paper 375px captures (md5-verified). That is consistent with the gate's own finding that the light-media and paper Atlas token values are identical, and the spec asserts `data-theme="paper"` at capture — but as evidence the two files are duplicates, not independent captures. The PlayHUD paper shot has no non-paper twin.
- **F-4 (Low, paperwork — fixed in this commit).** The Security seat's counts (13 files, +894/−160) describe the code diff before the two evidence specs were committed; the final text diff is 17 files, +1744/−271. The AC-12.6 row's "no http(s):// URL in any added line" was overbroad for the final diff (loopback harness URLs in the evidence specs) and is corrected above.
- **G-2 (deviation verified TRUE).** The End-game pill's `text-xs` pin exists: `src/components/question-bubble.test.ts` asserts the score-stack pill's classes include `rounded-md` and `px-3 py-1.5 text-xs`. Changing the pill to `text-sm` would break that test. The deviation's stated reason is correct and the deviation stands.
- **G-1 (runtime host proof).** See the Untested section above: per-mode host sets identical on branch and base builds; AC-12.6/AC-13.12 now rest on runtime evidence as well as the diff audit.
