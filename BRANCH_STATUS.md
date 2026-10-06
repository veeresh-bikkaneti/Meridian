# BRANCH_STATUS.md — feat/longname-pr2

**Branch:** `feat/longname-pr2` (off `origin/feat/longname-pr1` @ `821ea10` — PR #76 open, unmerged)
**Task:** "The Cartographer's Plate" — PR2 Tiers + tokens + rows per `~/workspace/your_files/long-name-design-spec.md` §12.
Doctrine: **names are the payload; containers flex, names never do.**
**Status:** 🟡 IN PROGRESS

## Scope (nothing more, nothing less)
1. `nameTier()` helper (`src/game/place-name.ts`): short ≤26, medium 27–60, long ≥61; unit-tested at 26/27, 60/61. Sets `data-name-tier` on name elements.
2. Per-tier CSS per spec §5: question card, reveal card, ledger TRUE SPOT, dossier guess rows, bottom sheet, GeoDetective reveal answer heading.
3. New `--atlas-*` tokens per spec §4 (brass text/rule, game-chrome derived tokens).
4. Meta-band lock: difficulty chip fixed in the band — never compacts, never leaves, never shrinks below 11px.
5. Dossier guess rows per spec §5 (grid 1fr auto, brass dossier number "№ 3" Space Mono, name Karla 600 unlimited lines, right column: distance + trend word + bearing arrow; FIRST GUESS tag on row 1, never a trend).
6. Pin-compare ledger: real `<dl>`, stacked entries, YOUR PIN quiet with sentence-case "near " qualifier (NOT italic), TRUE SPOT gold treatment with tiered Fraunces.
7. Grade chip component per §7 with Veeresh's ratified bands; Space Mono 11px, brass styling, `aria-label="Grade: <band text>"`.
8. Anchor bolding per the strict rule (trailing ", Country" only when it ends with ", " + a recognized country name, case-insensitive; weight-only).
9. Display-string refinement (spec §3): ZWSP after `/`, `–`, `-` in DISPLAY strings only — same helper as `nameTier()`.

## Veeresh's ratified decisions baked in
- **Grade bands (fixed ruler, native round units):** GeoDetective 🎯 Bullseye ≤25 km/≤15 mi · 🏆 So Close ≤150/≤100 · 🌟 Nearly There ≤600/≤400 · 👏 On the Trail ≤1,500/≤1,000 · 🙂 Far Afield ≤3,000/≤2,000 · 💨 Way Off beyond. Main editions keep score tiers (🎯 300+ etc.).
- **FIELD ENTRY tag:** skipped entirely.
- **Anchor bolding:** yes, strict rule; SR single-announce verified in E2E.
- **Units:** USA country/state plays → miles; everything else → km. Derived from edition/region context (never device locale). New `src/game/units.ts`: `unitForEdition`, `unitForLoopTarget` (territory key "840"), `formatLength`, grade-band helpers. Applied to PR2's surfaces (reveal verdicts, dossier rows, loop reveal, grade bands).

## What's done
- [x] Worktree `~/workspace/meridian-worktrees/longname-pr2`, branch `feat/longname-pr2` off `origin/feat/longname-pr1`
- [x] `src/game/place-name.ts`: `nameTier`, `refineDisplayString` (ZWSP), `anchorTail` (strict rule, Intl.DisplayNames region set)
- [x] `src/game/units.ts`: unit derivation, `formatLength`, `loopGradeBand`, `scoreGradeBand`
- [x] `src/components/place-name.tsx`: `<PlaceNameText>` (ZWSP display + nested `<strong>` anchor tail)
- [x] `src/components/grade-chip.tsx`: `<GradeChip>` per §7
- [x] styles.css: §4 tokens + §5 tier CSS (qname, rname, truespot, sheet, loop-reveal, dossier, ledger, grade-chip, meta band)
- [x] question-bubble.tsx: meta band (eyebrow + locked chip), tiered name, atlas game chrome, tabIndex/aria-label dropped per spec §5/§8.3
- [x] result-card.tsx: `<dl data-testid="pin-compare-line">` ledger, tiered answer heading, grade chips on verdicts, unit-aware distances
- [x] reverse-geocode.ts: `revealPinCompare()` structured sides; `revealPinLine` kept byte-identical
- [x] LoopScreen.tsx: dossier guess rows, PlaceSheet (grab handle, dismiss, detents, pinned button bar), LoopReveal tiered answer + grade chip, unit-aware distances
- [x] Unit tests: place-name (tier boundaries, ZWSP, anchor rule), units (derivation, formatLength, bands); updated question-bubble + result-card contract tests
- [x] Gates: tsc clean, npm test green (752/752), build:pages green, eslint 0 errors
- [x] Committed (759457b) + pushed to origin/feat/longname-pr2
- [x] E2E fixes: full-width meta band (eyebrow no longer ellipsizes at 360px); miss-tap hardening (dismiss bubble first, on-screen Nebraska point, pin-side "near X" assertion); CDP AX-tree single-announce check (Playwright 1.63 lacks page.accessibility.snapshot); eslint useEffect dep restored
- [x] **Product bug fixed (cfd69e1):** the full-width PR2 bubble put the Hide-question button under the chrome bar's End-game button at 360px (a real tap would hit End game; Playwright retried the intercepted click forever). Bubble top 4rem → 6rem moves the buttons clear.
- [x] E2E camera-settle: 1s wait after phase "aim" before __project taps (Vancouver tap raced the fly-to at 1280px)
- [ ] E2E green via VM lock (full 84-test suite running)
- [ ] Regression E2E on touched surfaces (question-wrap, question-card-header, reveal-pin-compare, geodetective, longname-wrap PR1)
- [ ] PR opened (base main) — NOT merged

## Spec deviations (deliberate, rationale recorded)
1. **Collapse toggle keeps "Collapse question"/"Expand question" labels** (spec §5 wants "Show/Hide place name"): existing E2E (`question-card-header`, `question-wrap`) + unit tests depend on current labels; rename belongs to PR3's collapse-a11y work.
2. **Collapsed bubble keeps showing the name** (spec §5 wants name folded away): changing it breaks `question-wrap.spec.ts` collapsed assertions; the fold-away restructure belongs to PR3.
3. **Verdict stays `<p>` (spec §5 wants h2 "Result: …")**: the h2 + three-zone restructure is PR3's architecture; PR2 adds the grade chip adjacent to existing verdicts.
4. **Ledger inside the dark-frosted reveal card pins dark Atlas token values** via a scoped override (theme-aware brass tokens are unreadable on the dark-always chrome); removed when PR3 re-chromes the card.
5. **Clue-history summary rows** (spec §5 GeoDetective reveal) deferred — spec §9/§14 document expanders as deferred; not in PR2 scope.
6. **Share text unchanged**: no distances in share text today (main = scores only, loop = spoiler-free), so the unit rule has nothing to change there.

## Rebase plan (after PR #76 merges to main)
`git fetch origin && git rebase --onto origin/main feat/longname-pr1 feat/longname-pr2` (conflict-free expected).

## Rebase onto main (2026-10-06)
Rebased onto origin/main post-#76/#77/#78 merges. Conflicts resolved:
- question-bubble.tsx: applied PR2 tier structure onto #77's no-scroll fix (dropped re-introduced `max-h-48 overflow-y-auto`)
- package.json: unioned test lists (kept SFX audio tests + added place-name/units tests)
- BRANCH_STATUS.md: kept longname branch status
