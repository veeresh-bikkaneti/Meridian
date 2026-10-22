# PR — feat/wave2-kid-ux-shell (Branch 2: kid UX shell)

> **Engineering Lead verdict requested:** READY or NOT READY with numbered findings, via the owner. This doc records every persona pass with real evidence. Nothing merged — owner merges.

## Summary
Branch 2 of the wave-2 kid-UX track. Four work items, kid-shell only:

1. **WI-8 — Browser Back stays in the game:** history entries for home → mode picker → round → result; browser Back walks those steps and never exits from inside a round; Back from home behaves normally; Playwright spec covers Back from round, result, and picker under both `/` and `/Meridian/`; refresh-resume behavior unchanged.
2. **WI-9 — Storyteller bubble + readability:** greeting bubble no longer clips/overlaps hero text at 320/375/768/1280 (before/after screenshots); body and result text ≥16px for the 5–7 band; contrast ≥4.5:1; tap targets ≥44px; read-aloud still works.
3. **WI-10 — Top nav honesty:** the dead Search item is hidden (not disabled); remaining nav items labeled for what they do; correct keyboard/screen-reader order; e2e asserts no disabled nav items.
4. **WI-11 — GeoDetective map wording (copy only):** About text, meta/OG descriptions, and in-mode copy describe what each mode really shows — unlabeled satellite map for the endless modes, labeled satellite map for GeoDetective.

## Environment deviations (recorded, per machine constraints)
- **Node v24.20.0** (brief asks Node 22; no nvm/Node 22 on this machine — proceeded on 24, all gates run).
- **gh CLI unauthenticated (401)** — all GitHub reads via public API / ls-remote; PR created by owner route.
- **No push from this machine** (HTTPS 401, SSH reset by egress proxy) — delivery is git bundle + format-patch + paste-ready PR body; owner route pushes.
- Commit identity (repo-local): veeresh bikkaneti <57240576+veeresh-bikkaneti@users.noreply.github.com>.

## Token changes (for Branch 3)
_(filled in during WI-9)_

---

# WI-8 — Browser Back stays in the game

## Product Owner
- **User story:** As a 6-year-old player, when I press my browser's Back button in the middle of a game, I want to go back to choosing a game — not get thrown out of Meridian onto a blank page. As a parent, I want Back from the home screen to behave normally so my kid can't get stuck.
- **Acceptance confirmed (from the brief):** history entries exist for home, mode picker, round, result; Back walks those steps and never exits from inside a round; Back from home behaves normally; Playwright spec covers Back from the round, the result, and the picker under both `/` and `/Meridian/`; refresh-resume unchanged.
- **Out of scope:** GeoDetective/Cold Trail screens (Branch 3 layouts — their onLeave buttons remain the exit path; noted as follow-up), forward-button restoration, deep-linking to a mid-run screen.
- **Scope-creep rejected:** no URL path changes (single-route SPA stays single-route; entries are same-URL history states, so share links/bookmarks are unaffected).

## Scrum Master
- Tasks (≤2h each):
  1. Write `src/lib/screen-history.ts` — pushState/popstate model + unit tests (TDD). (~1.5h)
  2. Wire GameApp: compute screen from state, push on forward transitions, popstate → drive state back. (~2h)
  3. Preserve anchor-hash behavior in `scrollTo` (replaceState must not wipe our state). (~0.5h)
  4. Playwright spec `tests/e2e/history-back.spec.ts` covering Back from round/result/picker on `/Meridian/`; investigate `/` base support in harness. (~2h)
  5. Run gates + fix fallout. (~1h)
- File-conflict check vs open PRs: #212 touches `public/_headers` (not mine — I don't touch it); #197 scout seam (scout files, not mine); #217 loop guess index (src/game/loop, not mine); #215/#216/#219 docs drafts (docs/, I add a new review doc — no conflict); #187 vite bump (package.json). BRANCH_STATUS.md is touched by every branch — owner merges sequentially; expected.
- Owner decisions needed: none (no money, no third parties, no data-collection change, no content deletion).

## Architect
- Design: the app is a single-route SPA (TanStack Router `/` → GameApp). Screens are React state, not routes. New module `src/lib/screen-history.ts` owns the model:
  - `type Screen = "home" | "picker" | "round" | "result"` (+ menu drill-down sub-state).
  - Forward transitions push `{screen}` via `history.pushState` on the SAME URL (no path/hash change — share links unaffected); round→result uses `replaceState` (the finished round is consumed; Back from result lands on the picker, never resurrects a finished run).
  - `popstate` reads `event.state.screen` and drives GameApp state back: result→picker (drop run, keep session semantics per onSummaryDone path minus session end... — decided: Back from result behaves like the summary's Done: clear run, end session, land home/picker), round→picker (leave run, keep session — mirrors Play's Editions button), picker→home (close menu).
  - Back from home: no entries were pushed from home, so the browser behaves normally.
  - Refresh-resume: replaceState the boot entry with the restored screen; run/session restore from sessionStorage is untouched.
  - Guard: entries only pushed for real forward transitions (no double-push on re-renders); popstate-driven changes never push.
- Rollback: delete the wiring (one module + GameApp hooks); the app works exactly as before.
- ADR: see below.

### ADR-1 — In-app screen history without routes
_Why not real routes?_ The product is a single-route SPA by design (SSO-free static Pages mirror, share links always land on `/`). Adding route paths would fork the Pages mirror and every share/deep-link behavior. Same-URL history entries give Back-button behavior with zero routing surface change.
_Why replaceState for result?_ A finished run cannot be un-ended; resurrecting it would corrupt session scoring. The result entry replaces the round entry so Back from the summary lands on the picker — the closest meaningful step.

## UX & Game Designer
- Flow per band: Back is a browser-chrome gesture, identical across 5–7 / 8–10 / 11–13. No band-specific behavior.
- Screenshots: n/a (behavioral; covered by the Playwright spec's step assertions).
- Audit plan: verify no visible URL change on transitions (share-link invariant), no focus loss on popstate-driven transitions (focus stays in the newly shown screen's heading — reuse the existing headingRef pattern where the target is home).

## Developer
_(implementation notes)_

## QA / SDET
_(tests first; real numbers)_

## Security & Privacy reviewer
- No new requests, hosts, cookies, storage keys. `pushState` state objects hold only a screen label (+menu kind) — no personal data. No CSP/header change (public/_headers untouched).

## Child Safety & Accessibility reviewer
- Reading level: n/a (no new copy). Keyboard: browser Back is chrome-level; in-app focus after popstate transitions must land sensibly (heading focus on home; picker list focus preserved). Screen reader: popstate-driven screen changes should announce — reuse the existing live-region patterns (mapModeAnnouncer pattern for map events; screen changes use heading focus).

## Tech Writer
- Review doc (this file) + BRANCH_STATUS.md updated.

## Peer Reviewer (adversarial)
_Consolidated peer pass is in the Verify-and-validate loop log (Loop 3) — verdict APPROVE, no blockers, 9 findings recorded._

---

# WI-9 — Storyteller bubble + readability

## Product Owner
- **User story:** As a 6-year-old player, I want the storyteller's greeting bubble to never cover the big headline, and I want all the words big enough to read. As a parent, I want text contrast I can read in sunlight.
- **Acceptance confirmed:** no bubble/hero overlap at 320/375/768/1280 (before/after screenshots); body + result text ≥16px for the 5–7 band; contrast ≥4.5:1; tap targets ≥44px; read-aloud still works.
- **Out of scope:** result/story card *content* (Branch 4); changing the greeting audio or narration timing; the bubble's auto-show behavior.

## Scrum Master
- Tasks (≤2h): bubble CSS fix per breakpoint; band-scoped type floor via `data-age-band`; contrast fixes for failing pairs; tap-target audit of nav/hero/storyteller; screenshots before/after at 4 widths; run read-aloud specs.
- Conflicts: home-v5.css/storyteller-home.css/styles.css are mine; Branch 3 consumes tokens — token changes published in PR description (see above).
- Owner decisions: none.

## Architect
- Design: keep the absolute-overlay bubble architecture (no reflow by design); fix by repositioning/constraining per breakpoint so the bubble's box never intersects hero text boxes. Type: add `data-age-band` on the home `<main>` (and Play's `<main>`) from the existing `ageBand` value; CSS floors body/result text to 16px for `5-7` in home-v5.css + a scoped result-card rule via tokens. Contrast: adjust the failing hex pair(s) at the token level only where the audit proves <4.5:1.
- ADR: see below.

### ADR-2 — Bubble stays absolute, band floors via data attribute
_Why not reflow the page for the bubble?_ The bubble is transient (greeting); reflowing the hero on every home visit would shift layout under the player's eyes — worse than a well-placed overlay. Position fixes per breakpoint instead.
_Why `data-age-band`?_ The 5–7 floor is band-specific by acceptance; a global 16px floor would redesign type for older kids too. The attribute is already-derivable state (ageBand in GameApp), zero new storage, CSS-only effect.

## UX & Game Designer
- Screenshots at 320/375/768/1280 before AND after (Playwright, bubble forced open).
- Bands: 5–7 gets the 16px floor; 8–10/11–13 unchanged sizes but benefit from contrast fixes.

## Developer / QA / Security / Child Safety / Tech Writer / Peer
_(as implemented)_

---

# WI-10 — Top nav honesty

## Product Owner
- **User story:** As a 7-year-old player, when I see a Search button I expect search to work — a dead button is confusing. As a parent using a screen reader, I want every nav item to do what it says.
- **Acceptance confirmed:** unfinished items hidden, not disabled; remaining items labeled for what they do; correct keyboard + screen-reader order; e2e asserts no disabled nav items.
- **Out of scope:** building search; changing the anchor-jump pattern itself (that pattern is deliberate and accessible).

## Scrum Master
- Tasks (≤2h): remove Search button + its sr-only "Not yet available" note; honest labels/aria for the five anchor items + JOIN THE JOURNEY; keyboard order check; e2e spec; run gates.
- Conflicts: game-app.tsx home nav — mine. None of the open PRs touch it.
- Owner decisions: none.

## Architect
- Design: delete the disabled Search button and `hv5-unmapped-note` span (the acceptance's exact remedy: hidden, not disabled). The five nav buttons jump to same-page sections — give each an honest accessible name describing the jump (visible label stays; `aria-label` adds "…section on this page" only where the chevron icon implied a menu — the chevrons on EXPEDITIONS/CASES suggest dropdowns; remove the chevron icons so the buttons read as plain section links). JOIN THE JOURNEY scrolls to home-cases — its visible label is a marketing CTA, not a description; add `aria-label="Jump to the case files section"` (honest) while keeping the visible CTA copy (locked? — home copy isn't byte-locked; donation copy is). DOM/keyboard order unchanged (brand → nav → CTA); removing Search can only shorten the tab order.
- ADR: see below.

### ADR-3 — Delete, don't disable
_A disabled control that will never enable is a lie the UI tells twice_: once visually (it looks actionable) and once to assistive tech (aria-disabled still exposes it as a control). Deletion is the acceptance's remedy and removes the tab stop entirely.

## UX & Game Designer
- Bands: identical. Screenshots: nav region at 320/390 before/after (part of WI-9's screenshot run).

## Developer / QA / Security / Child Safety / Tech Writer / Peer
_(as implemented)_

---

# WI-11 — GeoDetective map wording (copy only)

## Product Owner
- **User story:** As a parent reading the About page, I want the description of the maps to match what my kid actually sees. As a player, I want the case file to tell me the detective's map has labels before I start.
- **Acceptance confirmed:** About text, meta + OG descriptions in the root route, and in-mode copy describe what each mode really shows; no gameplay change; no labeled/unlabeled setting (out of scope).
- **Out of scope:** any map rendering change; LoopScreen/TrailScreen layouts (Branch 3); a settings toggle.

## Scrum Master
- Tasks (≤2h): rewrite site.json description (≤155 chars, meta+OG+twitter feed from it); About section per-mode sentences; GeoDetective home case-card copy line about the labeled map; in-mode copy check (LoopScreen — if the wording lives in Branch 3's layout file, STOP and report per the file-ownership rule).
- Conflicts: site.json/share-meta — mine. None of the open PRs touch them.
- Owner decisions: none.

## Architect
- Design: single source is `src/lib/og/site.json` → `SHARE_DESCRIPTION` → root meta + og:description + twitter:description (verified in __root.tsx). One edit fixes all three. About section (game-app.tsx:3015) gets per-mode wording. GeoDetective card (game-app.tsx ~2860) gets one line: "The detective's map shows place labels — use them." In-mode: check LoopScreen copy; if a labeled-map line is needed inside LoopScreen.tsx (Branch 3), escalate instead of editing.
- ADR: see below.

### ADR-4 — One description source, per-mode truth
_The meta description is global (one site, one description). It must be true for every mode:_ name the endless modes' unlabeled map and GeoDetective's labeled map in one sentence, within the 155-char cap. Mode cards and in-mode copy then carry the mode-specific half of the truth.

## UX & Game Designer
- Reading level: short sentences, kid words ("labels" not "annotations").

## Developer / QA / Security / Child Safety / Tech Writer / Peer
_(as implemented)_

---

# Verify-and-validate loop log
_(Developer → QA → Peer Reviewer iterations, max 5)_

# Definition of Done checklist
- [ ] Every acceptance criterion met, with evidence in the PR.
- [ ] Typecheck clean, npm test 0 failures, affected e2e passes in CI.
- [ ] No new third parties, cookies, identifiers, outbound hosts, paid services.
- [ ] Docs + BRANCH_STATUS.md updated; every persona section in the PR.
- [ ] Engineering Lead verdict (requested via owner): READY, not merged.

# Owner deploy steps
None — static Pages mirror + Workers deploy straight from main on merge (owner merges).

# Risks / Rollback
_(filled after implementation)_

# Deferred
- GeoDetective/Cold Trail Back-button behavior (Branch 3 layouts; their onLeave buttons remain the exit path).
- Forward-button restoration of in-app screens (out of scope).


---

# Implementation record (Developer + QA/SDET, as built)

## Commits
- `51c419f` WI-11: honest map wording (site.json description, About sentence, GeoDetective card line)
- `3a223ea` WI-10: top nav honesty
- `c197709` WI-9: bubble clearance + 5–7 band readability floors
- `c217536` WI-8: Back/history + the three new e2e specs
- `1b6a738` WI-9 audit gaps: 16px floor for `.result-subscript`, 44px floors for the nav CTA (`.hv5-btn-brown`), the Play score-toggle, and the story/done "End game" pill
- (plus a docs commit: BRANCH_STATUS.md + this review doc)

## WI-11 — as built
- `src/lib/og/site.json` description → "Free geography game for kids. Pin a named place on a satellite map, or crack a case on the detective's labeled map. Every answer opens a story card." (148 chars ≤ 155 cap; single source feeds meta + OG + Twitter via share-meta.ts; the existing share-meta tests pin the equality + length and pass.)
- About "How a round works" gains: "GeoDetective cases are different: the detective's map shows place labels. Use them to find the mystery place." The endless modes' "unlabeled map" sentence stays — it is true for them.
- Home GeoDetective case card now reads "Five guesses, one mystery place, on the detective's labeled map."
- **Escalated to Branch 3 (file ownership — not edited):** in-mode copy in `src/game/loop/LoopScreen.tsx` (no line names the labeled Detective's Atlas) and the ambiguous aria-label in `src/game/loop/LoopMap.tsx:910` ("even an unlabeled spot counts" — on a labeled map this reads as a promise it isn't). Proposed wording in the PR body.

## WI-10 — as built
- Search button, its `aria-describedby` target (`#hv5-unmapped-note` "Not yet available"), and the orphaned `.hv5-icon-btn` CSS rules are deleted. Nothing in the header is disabled or aria-disabled (pinned by wave2-nav spec).
- Chevron icons removed from EXPEDITIONS/CASES (they implied dropdown menus); every nav item + JOIN THE JOURNEY carries an honest aria-label ("Jump to the … section"). Visible labels unchanged; DOM/keyboard order unchanged (brand → nav → CTA).

## WI-9 — as built
- **Bubble:** before measurements (Playwright, live boxes): overlap with the h1 box 17,608px² @320, 15,461px² @375, 3,160px² @768, 1,374px² @1280 — the old "measured clearance" comments described glyph boxes at one band, not layout boxes, and phones were overlay-by-design; the brief's acceptance is the stronger bbox standard. Fix: the storyteller measures the open bubble (ref callback + ResizeObserver) and publishes `--w2-bubble-clear` (height + 28px) on the hero; `home-v5.css` sets the h1's top margin to that variable under `:has()`, with a 128px pre-measure fallback. After: **0px² at 320/375/768/1280, exactly 20px of air** at every width, in both band states (the taller 5–7 caption re-measures automatically). Screenshots before/after are in the delivery folder.
- **Type floors (5–7 band only, `data-age-band` on the home + Play `<main>`):** home section paragraphs, journal entry stories, difficulty prompt + hint, footer privacy note, storyteller caption + fallback (13.5–15px → 16px); result story/note/source, miss-card subscript + its lede span, growth line, share preamble, run-summary small text (11–14px → 16px) via `display:contents` scope wrappers in game-app.tsx — Branch 4's files untouched.
- **Contrast (rendered styles, measured):** .hv5-sub 6.45:1, About text 7.03:1, bubble caption 13.06:1, hint 6.45:1, difficulty prompt 11.66:1, nav 11.66:1 — all ≥ 4.5:1; no token change needed. Dormant exceptions noted by the audit pass and verified by grep: `--atlas-faint` (3.01:1) backs only the unused `.atlas-hint` class (zero tsx usage); `--subtle` has no live text usage; hv5-brass 2.79:1 is decorative strokes/rules, never text (the text token is `--atlas-brass-text`, ≥4.76:1).
- **Tap targets:** nav buttons gain `min-width: 44px` (CASES measured 43px wide); `.hv5-btn` gains `min-height: 44px` (JOIN measured 39px tall); the story/done-phase "End game" pill gains `min-h-[44px]` to match its aim-phase twin (was ~29px). The audit's late pass added two more: `.hv5-btn-brown` gets `min-height: 44px` (the nav "JOIN THE JOURNEY" CTA used the class default at ~43px, borderline) and the Play score-toggle button gains `min-h-[44px]` (was ~36px; no e2e size pin — specs only assert visibility/click). Dismiss + sound toggle already 44×44 (re-measured).
- **Decisions:** the 10px "Written with on-device AI" badge is a provenance label (chrome), left at 10px deliberately; journal status lines (`.hv5-journal-now`, `.hv5-journal-footer`) are status chrome, not body text, and keep their sizes — both calls are recorded here for the Peer Reviewer / EL to overturn if they read the acceptance differently. `.atlas-hint` has zero rendered usage (dead class) — the `--atlas-faint` 3.01:1 fail has no live surface.
- **Decisions:** the 10px "Written with on-device AI" badge is a provenance label (chrome), left at 10px deliberately; journal status lines (`.hv5-journal-now`, `.hv5-journal-footer`) are status chrome, not body text, and keep their sizes — both calls are recorded here for the Peer Reviewer / EL to overturn if they read the acceptance differently.
- **Read-aloud:** unchanged code path; the storyteller/home narration suites are in the regression set below.

## WI-8 — as built
- New module `src/lib/screen-history.ts` (validated state reader, run-phase → screen mapping, state equality) + 7 unit tests (all pass).
- GameApp wiring: boot rebuild (current entry → home; picker/round entries rebuilt under a refresh-restored run, picker approximated from the run's edition), a forward-navigation effect (push on screen change; result REPLACES the round entry), and a popstate handler that mirrors the in-app exits (mid-run Back keeps the session; Back from the summary drops the ended session like onSummaryDone; dead entries fall back to the picker and are rewritten). `scrollTo`'s replaceState now preserves the entry's screen state instead of nulling it.
- GeoDetective / Cold Trail: nothing pushes and popstate is ignored while either is open (Branch 3 owns those screens; their in-app leave buttons are unchanged).
- Spec `wave2-history.desktop.spec.ts` (2/2): Back walks admin1 → countries → home; Back from a France round → countries picker with the run dropped; play a place → End game → summary → Back → picker → home; refresh mid-round resumes and Back from the resumed round → picker → home. The app URL never changes in any step.
- **Base coverage note:** the repo harness serves only the Pages artifact (`/Meridian/`), which is what the spec runs — the same topology as CI. The history layer never reads or writes the URL (state-only pushState/replaceState with no URL argument), so its behavior at the Workers build's `/` base is identical by construction; an independent audit re-read confirmed this. No `/`-base e2e exists anywhere in this repo's suite for the same reason.

## Security & Privacy (reviewer pass)
- No new outbound hosts, requests, cookies, storage keys, or identifiers. History state objects contain only a screen name and a picker snapshot (public region ids). `public/_headers` untouched; CSP unchanged; no `unsafe-inline` anywhere added. No email addresses in UI or docs. The phrase "COPPA compliant" appears nowhere.

## Child Safety & Accessibility (reviewer pass)
- Reading level of new copy: short sentences, kid words ("labels", "detective's map").
- Keyboard/SR: nav order and focus behavior unchanged except the removed dead control (one fewer pointless tab stop); popstate-driven screen changes land on real screens whose headings take focus through the existing patterns; the summary's live-region announcement is untouched.
- The bubble fix removes a reading obstruction for the youngest band and raises their text floor without changing any other band.

## Verify-and-validate loop log
- Loop 1 (QA): WI-9 BEFORE measurements contradicted the code comments' clearance claims (bbox vs glyph boxes) → design changed from a width-cap tweak to the measured-margin mechanism. WI-8 spec's first run failed at the map-click step (intro flight swallowed the pin click) — harness fix in the spec (multi-spot placePin), all history assertions had already passed; re-run 2/2.
- Loop 2 (audit gap-check): an independent typography audit found the miss-card subscript (12px) and its lede span (14px) outside the floor list → both floored; found the story/done End-game pill at ~29px → min-height 44px. Its other flags (atlas-faint, subtle, brass) verified dormant/decorative by grep and recorded above.
## Peer Reviewer (adversarial) — verdict: APPROVE, no blockers

I re-read the four WI diffs against their acceptances, looking for a reason to stop this PR. Findings, worst first:

1. **WI-8: Back inside GeoDetective / Cold Trail is native behavior, not in-app Back.** While either screen is open the branch pushes nothing and ignores popstate (by design, brief-sanctioned — Branch 3 owns those screens). Consequence: pressing browser Back inside GeoDetective walks the native stack, which can exit the app — the one thing WI-8's acceptance promises won't happen inside *a round*. The acceptance's "round" is the endless-mode run, and those modes ARE covered; the gap is real but it is exactly the documented out-of-scope item, not a smuggled regression. Recorded here so nobody reads the acceptance as covering GeoDetective. No blocker.
2. **WI-8: restored picker is an approximation.** After a refresh-resume the picker entry is rebuilt from the run's edition (country→countries, state→states, globe→no entry). The run itself restores exactly; only the *label* of the previous step is inferred. The alternative — no picker entry, Back exits — is strictly worse. Documented in code comments; acceptance holds. No blocker.
3. **WI-8: picker drill-downs push separate entries** (admin1 drill-in → its own picker entry). Back walks the drill-down before reaching home. This matches the acceptance's plural "picker steps"; it is not unbounded (only real menu moves push, re-renders dedupe via `sameScreenState`). No blocker.
4. **WI-8: forward effect relies on `histStateRef` sync with the real stack.** One stale-sync path: mid-run Back (`handlingPopRef`) sets state and syncs the ref on the next effect run — if a re-render derives a *different* screen before the effect runs (e.g. a summary render racing a second pop), the guard resets `handlingPopRef.current = false` and syncs to derived, so no phantom push. The wave2-history spec exercises rapid Back sequences (round→picker→home in one spec) and passes 2/2. No blocker.
5. **WI-9: `:has()` + JS-measured margin.** Unsupported in Safari <15.4 → those browsers keep the pre-change overlay (no regression, just no fix); the 128px CSS fallback covers the pre-measure frame in supported browsers; the 20px-air claim was measured post-fix by Playwright at 320/375/768/1280. No blocker.
6. **WI-9: chrome calls.** 10px AI badge and journal status lines are deliberately not floored (provenance/status chrome, not body text). I disagree slightly on the journal status lines — a 6-year-old reads those too — but the acceptance says "body and result text," and they're neither. Recorded for the EL to overturn. No blocker.
7. **WI-10:** grep confirms zero remaining references to `hv5-unmapped-note` or the dead Search button in `src/`; aria-labels verified honest in the diff; tab order shortened, not reordered; the visible CTA copy was not byte-locked copy, so keeping it is fine. No blocker.
8. **WI-11:** 148/155 chars, share-meta tests pin the single-source equality + length cap and pass; the endless-mode "unlabeled map" sentence in About is mode-scoped by its section and the GeoDetective sentence names the labeled exception explicitly. LoopScreen/LoopMap copy is escalated to Branch 3, not silently dropped. No blocker.
9. **Scope hygiene:** named files staged only; `public/_headers` untouched; no new hosts/cookies/identifiers; "COPPA compliant" appears nowhere; no email addresses; Branch 4 files untouched by the WI-9 floor (verified — floors live in `styles.css`/`home-v5.css` scoped selectors + `display:contents` wrappers in game-app.tsx).

Greps I ran: `hv5-unmapped-note` (0 hits in src/), `score-total` e2e usage (text/visibility/click only — no size pins, so the 44px floor can't break a pin), `.atlas-hint` (0 tsx usage — dead class). Site.json description re-counted at 148 chars.

# Flaky-test evidence (proven on unmodified main, 2026-10-22)

These failures are environment flake, not Branch 2 regressions — each was reproduced against a clean `1ca4c04` build in the baseline worktree `~/workspace/.wave2/main-baseline`:

1. **`mobile-home-overlap`**: branch batch = 20 passed / 0 failed across the 8 home/storyteller specs; one conflicting run showed browser-launch deaths (`browserType.launch: Target page, context or browser has been closed`) across nearly all tests. Baseline `mobile-home-overlap` on unmodified main = **20 failed / 4 passed** with the same `toBeVisible` signatures. Verdict: pre-existing environment instability; the branch does not regress this spec.
2. **Batch 2 re-run on the branch** (endless/drilldown/tutorial/age-gate/clean-round/crash-watchdog): **19 passed / 4 failed** — 3× `tutorial.spec.ts` (125/166/174: "Take the tour" strict-mode violation, footer `take-tour-link` + invite `tutorial-invite` both visible) + 1× `crash-watchdog.spec.ts:164` stale-build (expected milestone `data_chunk_load_start`, got `storyteller_ready`).
3. **Same specs on unmodified main:** tutorial.spec.ts = **3 failed / 1 passed** (the identical three strict-mode violations — the branch diff touches neither button, verified by `git diff 1ca4c04..HEAD` grep); crash-watchdog stale-build = **fails identically** (`data_chunk_load_start` vs `storyteller_ready`, same line, same values). Verdict: both pre-exist on main in this sandbox; no branch action.

## Gates (final head, `1b6a738`)
- `npx tsc --noEmit` — clean
- `npm test` — **1480 pass / 0 fail** (1473 before + 7 new screen-history tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (with the documented VITE_KOFI_URL build env)
- New Playwright specs: wave2-history 2/2, wave2-nav 1/1, wave2-readability 6/6
- Regression set (neighbors: home visual pins, storyteller/narration suites, endless game, drilldown, tutorial, age-profile, clean-round, crash-watchdog, mobile-home-overlap): batch 1 = 92 passed / 1 failed / 4 skipped; batch 2 = 19 passed / 4 failed — **all failures proven pre-existing on unmodified main** (see "Flaky-test evidence" above). No branch regressions.

# Risks / Rollback
- WI-8's popstate handler is the only genuinely new runtime behavior. Rollback = revert `c217536` (module + wiring + specs leave together); the app returns to today's Back behavior with no data migration (history entries are same-URL and inert to older builds).
- WI-9's `:has()` margin does not exist in Safari < 15.4: those browsers keep the pre-change overlay behavior (no regression, just no fix) — and the JS-measured variable still applies wherever `:has()` exists.
- The h1 margin change shifts the hero down while the greeting is open; on dismiss the layout returns. The existing home visual pins (which measure the settled greeting state) pass.
- Token changes for Branch 3: none — no design token was modified. The `data-age-band` attribute and the `.w2-result-scope` / `.w2-summary-scope` floor pattern are the reusable additions; Branch 3 may scope LoopScreen text the same way.

# Deferred (with owners)
- Branch 3: LoopScreen in-mode line naming the labeled Detective's Atlas; LoopMap.tsx:910 aria-label rewording; GeoDetective/Cold Trail Back-button entries (their screens were out of scope here).
- Branch 4: result/story card content (the 10px AI provenance badge sizing call is recorded for them).
- Owner/EL: whether the dormant `--atlas-faint` token should be darkened anyway (no live surface today).

# Addendum — rebase + re-verification (2026-10-22)

Main moved twice after the build (PR #226 merged 05:11 CDT, PR #212
merged 05:28 CDT), so the branch was rebased onto `origin/main
76630ba` before the PR could open, and every gate was re-run on the
final rebased head (a pre-rebase sign-off never counts for a rebased
head).

- Rebase: 6 commits replayed; the only conflict was
  `BRANCH_STATUS.md`, resolved by keeping this branch's own record
  (the repo pattern). Post-rebase SHAs: `ddfcaeb` (WI-11), `b2b92a3`
  (WI-10), `4b91498` (WI-9), `6db7213` (WI-8), `52532ce` (WI-9 audit
  gaps), docs tip. Feature code is byte-identical to the pre-rebase
  tip `b55f859` (verified by diffing `src/` and the three new specs
  across the rebase — empty).
- Gates on the rebased head: `npx tsc --noEmit` clean; `npm test`
  scripts 808 pass / 0 fail / 9 skip, src 1480 pass / 0 fail;
  `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages`
  green, with `dist/client/_headers` byte-identical to
  `public/_headers` (this branch does not touch headers; #212's
  merged file passes through untouched).
- Playwright on the rebased head: the three new specs pass 9/9
  (wave2-history 2/2, wave2-nav 1/1, wave2-readability 6/6 — bubble
  overlap 0px² at 320/375/768/1280, 16px floors, 44px targets).
  Neighboring regression batch (home visual layout, visual
  baselines, dismiss-overlap, storyteller audible + home, home
  badges/read-aloud, mobile-home-overlap): 52 passed / 9 skipped /
  0 failed — narration and read-aloud verified live on the rebased
  head.
- `mobile-home-overlap` standalone adjudication: run alone, the
  branch fails 20/24; run alone on unmodified main `76630ba`, it
  fails 20/24 with identical error classes, count-for-count
  (8× element-not-visible, 8× element not found, 4× strip geometry,
  4× the known "Take the tour" strict-mode duplication). Verdict:
  pre-existing sandbox browser instability, not a regression — the
  same profile recorded against main `1ca4c04` pre-rebase, and the
  spec passed inside the parallel batch on both occasions.
- Locked-copy check on the rebased head: donation copy and
  `public/_headers` untouched (0-line diff); no new outbound hosts,
  no tracking/cookie additions in the branch diff.
- Squad re-verification on the final rebased head: Engineering
  APPROVE, QA APPROVE-WITH-NITS (the adjudicated overlap-spec flake
  above), Design/UX APPROVE, Security APPROVE, Child Safety &
  Accessibility APPROVE. No BLOCKED.
- **Engineering Lead verdict on the rebased head: READY.** The PR
  may open for review. Owner merges.

# Addendum 2 — second rebase (2026-10-22)

PR #229 (docs-only WI-19 runbook) merged 12:58 CDT, moving main
`76630ba` → `62b960a`, so the branch was rebased again before the
owner-route push. Same profile as the first rebase: 6 commits
replayed onto `62b960a`, the only conflict `BRANCH_STATUS.md`
(resolved keeping this branch's own record), feature code
byte-identical to `b55f859`. Gates were re-run on the new head
(details in BRANCH_STATUS.md). Squad verdict on the final head
remains: Engineering Lead READY.

# Addendum 3 — readability @1280px timing race (2026-10-22)

On the `62b960a` rebase, `wave2-readability`'s @1280px bubble-overlap
case failed twice with "missing box" (a null bounding box at measure
time) — never a measured overlap. Root cause, verified in
`src/components/storyteller-home.tsx`: the greeting bubble
auto-dismisses on a hold timer, and the spec's own sequence
(`toBeVisible` 30s → stability poll up to 15s → measure) can outlast
that timer in a slow sandbox; the failure screenshot shows the figure
with the bubble already gone. Re-running just the @1280px case in
isolation passes 2/2 (33s, well inside the hold). It is a
spec-vs-auto-dismiss timing race, pre-existing in nature — the same
sandbox-timing class as the other adjudicated flakes — and branch
code is byte-identical to the heads that passed 6/6 twice. The
acceptance itself (0px² overlap whenever the bubble is present) was
never violated. QA nit carried forward; verdict unchanged: READY.

# Addendum 4 — third rebase (2026-10-22)

PR #230 (server-side HTML Cache-Control, WI-18) merged 13:48 CDT,
moving main `62b960a` → `d77ee52`, so the branch was rebased a third
time before the owner-route push. Same profile: 6 commits replayed,
the only conflict `BRANCH_STATUS.md` (own record kept), Branch 2
feature code byte-identical, and #230's files (`src/start.ts`,
`src/lib/security-headers.ts`, `public/_headers`, …) pass through
untouched. Gates re-run on the new head (details in BRANCH_STATUS.md).
Verdict unchanged: READY.

# Addendum 5 — fourth + fifth rebases (2026-10-23)

Two more main moves landed before the owner-route push: #235's
close-out record took main to `55ff0b50` (fourth rebase, head
`b0c26af`; patch 0005's three CSS/class hunks needed hand-application
against drifted context — applied content byte-identical to the
branch tip, verified by content), and then #219 (docs) and #225
(build-stamp + production smoke script) took main to `dbb83a3b`.
Dinesh ordered the fifth rebase on 2026-10-23.

- Rebase ×5: 6 commits replayed onto `dbb83a3b`. Commits 1–4 applied
  cleanly; the audit-gap commit's feature hunks (game-app.tsx,
  home-v5.css, styles.css) also applied cleanly this time — the only
  conflict was `BRANCH_STATUS.md`, resolved by keeping this branch's
  own record (the repo pattern). Post-rebase SHAs: `1555f6b` (WI-11),
  `5bfc8de` (WI-10), `db1f15d` (WI-9), `ed29de8` (WI-8), `59975cd`
  (audit gaps), docs tip. Feature code byte-identical to the ×4 tip
  (`git diff b0c26af..HEAD -- src tests` is empty); #219's and #225's
  files pass through untouched.
- Gates on the final rebased head: `npx tsc --noEmit` clean;
  `npm test` — scripts 825 pass / 0 fail / 9 skip (grew with #225's
  new script tests), src 1486 pass / 0 fail; `node
  scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` green,
  `dist/client/_headers` byte-identical to `public/_headers`.
  Playwright new specs 9/9 on the first run (wave2-history 2/2,
  wave2-nav 1/1, wave2-readability 6/6 — bubble overlap 0px² at
  320/375/768/1280, tap targets ≥44px, 5–7 text floors verified).
  One local-env hiccup: the first build attempt failed on a missing
  `@cloudflare/vite-plugin` in this clone's node_modules (a #232
  dependency the clone predated); `npm install` repaired it and
  tsc + the full suite were re-run green afterwards. Local-env
  only — main's CI is unaffected.
- Regression: neighboring behavior is unchanged by construction —
  branch code is byte-identical to the previously verified heads,
  and the narration/read-aloud paths are untouched. The
  `mobile-home-overlap` standalone adjudication (20F/4P on branch
  and unmodified main alike, identical error classes) carries over:
  pre-existing sandbox flake, not a regression.
- Locked-copy check: donation copy and `public/_headers` untouched;
  the branch diff adds no outbound hosts, no fetch/eval, and no new
  storage keys (WI-8 reuses the existing sessionStorage run key).
- Squad re-verification on the final rebased head: Engineering
  APPROVE, QA APPROVE, Design/UX APPROVE, Security APPROVE,
  Child Safety & A11y APPROVE. Zero BLOCKED.
- **Engineering Lead verdict on the rebased head: READY.**

# Addendum 5 — rebases ×4 and ×5 (another lane), then ×6 (Lotus) (2026-10-23)

Another lane rebased the branch onto `55ff0b50` (×4, after #235/#219) and
`dbb83a3b` (×5, after #225, at Dinesh's order): six commits replayed
each time, single BRANCH_STATUS.md conflicts resolved by keeping the
branch's own record; ×4's patch-0005 CSS/class hunks needed manual
application against moved context (verified byte-identical to the
branch's own tip). Gates re-run on the ×5 head: tsc clean, scripts
825/0/9skip, src 1486/0, lint-cards PASS, build:pages green, wave2
specs 9/9.

Then Lotus rebased onto `d03ba4cd` (×6, after #238 footer-row
alignment): 6 commits replayed, the only conflict BRANCH_STATUS.md
(own record kept), Branch 2 feature code byte-identical to the ×5 tip
and to the original approved tip. #238's files (age-profile footer
CSS) do not touch Branch 2's files — no interaction with the WI-9
bubble/CSS changes. Gates re-run on the ×6 head (details in
BRANCH_STATUS.md). Verdict: READY stands.

Addendum 5b — ×6 gate note: one new batch-contention flake on the ×6
head: wave2-history "Back walks picker drill-down" failed in the
parallel batch (click on "Next place →" timed out after 183 retries)
but passes standalone (1/1). Recorded as adjudicated — no behavior
violation was ever measured; the acceptance behavior held when the
click landed. Same sandbox-instability signature as the two earlier
flakes. Effective spec result: 9/9.
