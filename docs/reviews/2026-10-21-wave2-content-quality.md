# Branch review — Wave 2 content quality (`feat/wave2-content-quality`)

**Branch:** `feat/wave2-content-quality`
**Base:** `main` at `d327dd3`
**Head reviewed:** code head `aa7c8c1` (final gates; the `881f8a5` checkpoint below was the head before the `67cc839` docs commit and the `aa7c8c1` F-1 fix; this paperwork docs commit follows on top)
**Work items:** WI-14 (rich story card after every pin), WI-15 (`/credits` page), WI-16 (globe deck continent balance), WI-17 (`lint:content` in CI)
**Commits:** `d5b128b` (WI-17) · `48c0e25` (WI-15) · `596d586` (WI-16) · `586725d` (WI-14) · `881f8a5` (branch-fallout fixes) · `67cc839` (docs) · `aa7c8c1` (F-1 fix) · docs(branch): paperwork corrections after peer re-review (P-1/P-2) — this commit

All numbers in this document come from the crew's log files on disk (`logs/baseline-gates.log`, `logs/wi17-dev.log`, `logs/wi15-dev.log`, `logs/wi16-dev.log`, `logs/wi14-dev.log`, `logs/branch-fixes.log`, `logs/qa-gates.log`, `logs/qa-shots.log`, `logs/wi17-fix.log`, `logs/qa-rerun.log`) and the persona passes in the PR body. No number is taken from a summary.

## What shipped, per work item

### WI-17 — `lint:content` in CI (`d5b128b`)

- `scripts/lint-content.mjs` applies the runtime's own banned-pattern rules to the clue files, the curated starter stories, and the Journal catalog stories. It imports `checkBanned`, `BANNED_PATTERNS`, and `MEASUREMENT_RE` from `src/game/story-ai.ts` — the runtime module is the single source of the rules, so the lint and the runtime cannot drift apart (ADR-17).
- `scripts/lint-content-baseline.json` holds exactly the 6 measured violations, one entry per violation occurrence, keyed to file/record/rule/matched text/occurrence. The lint fails on any unbaselined violation, on a stale baseline entry, and on an empty scan; baselined violations are printed as `KNOWN` lines on every run. The owner-decision list is: `101.json#c1` "119 km", `223.json#c1` "500 kilometres", `279.json#c5` "54 km", `279.json#c5` "69 km", `66.json#c5` "145 kilometres", and catalog `capitol` "400 feet".
- Acceptance evidence — original run (`logs/wi17-dev.log`, at commit `d5b128b`): `npm run lint:content` exits 0 with `scanned clues=1935 starters=327 catalog=106` (327 starters at that commit — WI-16 later raises this to 331), `violations=5 (baselined 5, new 0, stale 0)`, `GATE PASSED`. `scripts/lint-content.test.mjs`: 3 tests, 3 pass — real corpora pass, a seeded bad fixture fails and names the file, record, and rule, and a stale baseline entry fails. CI runs the lint as its own step in `.github/workflows/node.js.yml`; `package.json` gains exactly one scripts line and no dependency.
- Acceptance evidence — corrected final run (`logs/wi17-fix.log` and `logs/qa-rerun.log`, at code head `aa7c8c1`): `npm run lint:content` exits 0 with `scanned clues=1935 starters=331 catalog=106`, `violations=6 (baselined 6, new 0, stale 0)` — including `279.json#c5` "69 km" — `GATE PASSED`. `scripts/lint-content.test.mjs`: 7 tests, 7 pass — real corpora pass, a seeded bad fixture fails and names the file, record, and rule, a stale baseline entry fails, and regression tests cover two different measurements in one clue, a partially baselined pair, the same measurement twice (occurrence-aware keys), and a malformed-shape clue file. Full `npm test` at that head: scripts 841 tests / 832 pass / 0 fail / 9 skipped; src 1502 / 1502 pass.
- **Peer-review fix (F-1):** the Peer Reviewer's adversarial pass found the lint's first-match blindness — it recorded only the first match per rule per record, so `279.json#c5`'s second measurement ("69 km") shipped unbaselined and unlisted, and the true count was 6 occurrences across 5 records, not 5. A follow-up commit fixes it: the lint now enumerates every match per record with occurrence-aware baseline keys, the "69 km" entry is baselined above, and regression tests lock the behaviour in.
- **Peer-review sequence:** first pass REJECT (F-1 blocker) → fix `aa7c8c1` → loop-1 re-review APPROVE WITH FIXES (paperwork), F-1 closed → this paperwork docs commit closes P-1/P-2.

### WI-15 — `/credits` page (`48c0e25`)

- `src/routes/credits.tsx` renders the credits on the existing `InfoPage` shell: GeoNames (CC BY 4.0), Wikipedia text (CC BY-SA, with a factual statement of how it is used), Esri imagery, and the bundled open-source libraries. The Esri attribution is rendered from the imported `IMAGERY_ATTRIBUTION` constant (`@/map/imagery`), never retyped, so the page cannot drift from the on-map string (ADR-15). The library list is data in `src/lib/credits.ts`, checked by `src/lib/credits.test.ts` against the `dependencies` in `package.json`.
- Exactly one footer link is added in `src/components/game-app.tsx` (one `<Link to="/credits">` element, +3 lines); `src/routeTree.gen.ts` is the build-regenerated route registration.
- Acceptance evidence (`logs/wi15-dev.log`): credits unit test 4 pass / 0 fail; `npm run build:pages` exit 0 with the credits route artefact present; typecheck clean after the route-tree regeneration; e2e `credits.desktop.spec.ts` 2 passed; e2e `grownups-privacy-contact.desktop.spec.ts` 3 passed (no regression on the neighbouring footer links).
- **Deviation (e2e only):** the direct-navigation test in `credits.desktop.spec.ts` uses an in-spec SPA fallback, because the Playwright harness serves no deep links for any route — a cold `page.goto` of the credits URL does not reach the route in the harness, for this page or any other. The first run failed on exactly that (heading not found, `logs/wi15-dev.log`); with the in-spec fallback the spec passes 2/2. The route itself is proven by the build artefact, the footer-link test, and QA's artefact check (below). No app code was changed for the harness.

### WI-16 — Globe deck continent balance (`596d586`)

- Four landmarks are appended to the globe deck in `src/game/starters.ts` through the existing `place()` helper — Statue of Liberty (US), Chichén Itzá (MX), Eiffel Tower (FR), Sydney Opera House (AU) — with the four matching country-box entries in `src/game/validate-places.ts`. The globe deck grows 12 → 16; total starters 327 → 331. No existing landmark is deleted, renamed, or moved.
- `src/game/deck-balance.test.ts` reports the continent share of all three deck families on every run and enforces the Product Owner's proposed floor on the globe deck only: every inhabited continent at `max(2, ⌈deck size ÷ 8⌉)`.
- Acceptance evidence (`logs/wi16-dev.log`): RED on the unmodified deck — the test fails with "globe deck: North America has 0 of 12 landmarks, below the floor of 2". GREEN after the additions — deck-balance + validate-places + starters tests 13 pass / 0 fail; the reported globe deck is Africa 3 (18.8%), Asia 3 (18.8%), Europe 3 (18.8%), North America 2 (12.5%), Oceania 2 (12.5%), South America 3 (18.8%). All 331 starters pass coordinate validation.
- **Coordinate deviation:** for Chichén Itzá the Developer used the article's site point, lon/lat −88.5686, 20.6831 (as shipped in `src/game/starters.ts`), in place of the ADR-16 cross-check estimate (−88.5678, 20.6843). ADR-16 states the rule for exactly this case: the cited Wikipedia article is the source of record, its figures win over the architect's sanity-check estimates, and the discrepancy is noted — this is that note. The shipped point passes the Mexico country-box validation.

### WI-14 — Rich story card after every pin (`586725d`)

- New pure module `src/game/kid-story.ts` derives the 5–7 band's shorter version from a place's own reviewed story by sentence-prefix shortening only — it can omit whole reviewed sentences, never alter or invent a word. `storyForBand` in `src/game/generated-places.ts` gains a curated branch: band 5–7 returns the kid version, bands 8–10 / 11–13 return the full story unchanged. The miss path in `src/components/result-card.tsx` resolves a curated place through the same call instead of the raw pool-time story, so hit and miss show the same band-correct text by construction (ADR-14).
- The B-UX-1 amendment (Architect addendum, adopting the UX seat's blocker): the miss card also gains the same read-aloud row the hit card has — same `ReadAloudButton`, same props — because for the 5–7 band the story's primary channel is listening, and a silent miss card would have broken hit/miss parity in that band.
- `src/game/story-card-coverage.test.ts` is the proof test: it iterates every curated starter (no hardcoded count) and asserts the full card at bands 8–10 / 11–13 is byte-identical to the reviewed story, and the 5–7 version is a non-empty, strictly shorter sentence-prefix of it. The plain fallback remains only for uncurated GeoNames places.
- Acceptance evidence (`logs/wi14-dev.log`): RED runs recorded before implementation (module-not-found for both new test files; coverage test then failing on `alabama-vulcan` with the full story returned at band 5–7); GREEN — kid-story + coverage tests 8 pass / 0 fail. E2E final run: `hit-story.desktop.spec.ts` 1 passed + `result-story-parity.desktop.spec.ts` 2 passed (hit and miss on a curated place, miss asserting the authored story and the read-aloud control). The first parity run failed in the test's own seeding (it seeded the Medium seen-store, which reads as a completed Medium catalog); the fix changed the test seeding to the Easy store — no app code changed.

### Branch-fallout fixes (`881f8a5`)

Two failures surfaced in WI-14's full-suite `npm test` run. Both were checked against the pristine pre-WI-14 head `596d586` with WI-14 stashed, and the same two tests fail there — so neither is a WI-14 regression. Against the branch base `d327dd3` both are **branch-introduced fallout** from earlier commits on this same branch, and they were fixed on this branch rather than left for the owner:

1. **Sitemap `/credits` registration (fallout of WI-15).** `scripts/static-wellknown.test.mjs` — "sitemap.xml lists every page route" failed with "sitemap is missing /credits": WI-15 added the route but not its sitemap entry. Fix: one `<url>` line for `https://meridian.knowledgetest.workers.dev/credits` in `public/sitemap.xml`.
2. **Question-label globe count (fallout of WI-16).** `src/game/question-label.test.ts` — "curated globe starters all carry a resolvable iso2" asserted a globe count of 12; WI-16 grew the deck to 16. Fix: the assertion updated 12 → 16, plus per-id iso2 assertions for the four new landmarks (US / MX / FR / AU).

Evidence (`logs/branch-fixes.log`): targeted runs pass — static-wellknown 4/4, question-label 34/34 — and the full suite after the fix is green (gate table below).

## Gate table — baseline vs final

Baseline is pristine base `d327dd3` (`logs/baseline-gates.log`). Final is code head `aa7c8c1` (`logs/wi17-fix.log` for the full-suite run after the F-1 fix; `logs/qa-rerun.log` for QA's independent re-verification, which reproduced the same totals — PASS). Historical checkpoint at `881f8a5` (labelled as such, not the final head): `logs/branch-fixes.log` / `logs/qa-gates.log` recorded scripts 837 tests / 828 pass and src 1502 / 1502 at that checkpoint, before the F-1 fix added the 4 lint regression tests.

| Gate | Baseline (`d327dd3`) | Final (`aa7c8c1`) |
|---|---|---|
| `npm test` — scripts suite | 834 tests, 825 pass / 0 fail / 9 skipped | 841 tests, 832 pass / 0 fail / 9 skipped |
| `npm test` — src suite | 1489 tests, 1489 pass / 0 fail | 1502 tests, 1502 pass / 0 fail |
| `npm run typecheck` (`tsc --noEmit`) | clean | clean, exit 0 |
| `node scripts/lint-cards.mjs` | GATE PASSED | GATE PASSED (chunk audit: 124,690 records, 8,802 with hook, 0 curated-note violations) |
| `npm run lint:content` | — (did not exist) | GATE PASSED — scanned clues=1935, starters=331, catalog=106; violations=6 (baselined 6, new 0, stale 0) |
| `npm run build:pages` | exit 0 | exit 0; credits route artefacts present in `dist/client` and `dist/client/sitemap.xml` contains `credits` (QA artefact check, `logs/qa-gates.log`) |

Targeted Playwright E2E on the built artifact (`logs/qa-gates.log`, QA pass):

| Spec | Result |
|---|---|
| `tests/e2e/credits.desktop.spec.ts` | 2 passed / 0 failed |
| `tests/e2e/result-story-parity.desktop.spec.ts` | 2 passed / 0 failed |
| `tests/e2e/hit-story.desktop.spec.ts` | 1 passed / 0 failed |
| `tests/e2e/grownups-privacy-contact.desktop.spec.ts` | 3 passed / 0 failed |
| `tests/e2e/result-card-overflow.mobile.spec.ts` | 13 passed / 4 skipped / 0 failed (the 4 skips are the spec's own by-design `test.skip` cases below 320 px, a pre-existing flow limitation documented in the spec) |

QA also ran two independent lint fixture probes (temp directories only): a seeded new violation exits 1 and names the record; a stale baseline entry exits 1 and names the entry. 24 screenshots were captured and inspected (`logs/shots/`, inventory in the QA section of the PR body).

**Node version note:** every gate above ran on this VM under Node v24.22.1 (recorded in `logs/wi14-dev.log`). CI runs Node 22.x (`.github/workflows/node.js.yml`). Nothing in this branch knowingly uses a Node 24-only behaviour — the lint and its tests run under `node --experimental-strip-types`, the same mechanism the repo's existing scripts use on CI's Node 22 — but the crew's green results are VM results; the CI run on 22.x is the confirming evidence and had not run at the time of writing.

## Process disclosure — Tier 2 mapping

`AGENTS.md` classifies this work as **Tier 2** (new features/modules, 3+ files per item, work under `src/game/`): the council protocol calls for a signed Consensus Manifest before code — ATDD scenarios, TDD contracts, adversarial challenge, Chair sign-off — then RED, minimal GREEN, gates, unified diff.

This crew ran the charter's Scrum passes instead. The Architect's pass maps the two honestly, and the two deltas are stated plainly here rather than hidden:

1. **The manifest is assembled, not signed as one document.** The Consensus Manifest's content — agreed acceptance criteria and tightenings (Product Owner pass), ADRs with file plans and rejected alternatives (Architect pass), and the remaining persona sections — exists as the assembled sections of the PR body, plus the Engineering Lead's READY / NOT READY verdict, rather than as a single signed manifest document.
2. **The adversarial challenge runs after the code, not before it.** The council protocol challenges the design before implementation; this crew's adversarial seat (Peer Reviewer) re-reads the finished diff. The pre-code challenge slot was partially covered by the Scrum Master's conflict/owner-decision check and by each ADR's rejected-alternatives record.

Everything else maps directly: the Product Owner's criteria are written as testable assertions and each work item names the acceptance test that proves it; WI-14, WI-16, and WI-17 were built tests-first (RED runs are in the dev logs); the gates are the same list in the charter and in `AGENTS.md`.

## Child Safety advisory — Chichén Itzá

All four WI-16 landmark texts were approved by name by the Child Safety & Accessibility seat (verdicts and cited sources are in the PR body). One non-blocking advisory is recorded for Chichén Itzá: the phrase "on a dry plain" is the weakest-traced phrase of the four texts — the cited article establishes the flat northern Maya lowlands of Yucatán, and the phrase is true of the site and is picturable geography of the kind the card rules ask for, but it is geography colour rather than a phrase lifted from the article. The seat also notes Chichén Itzá's text sits at the ≈7-year-old reading-level ceiling ("echoes", "ruins", "plain" as a noun): any future edit that adds a harder word to that text should go back to the Child Safety seat. Any wording change to any of the four texts re-opens that landmark's approval.

## Untested / still owed

Carried from the Child Safety pass's explicit untested list — none of these were performed by any seat on this branch:

- **No real screen-reader pass** (VoiceOver / NVDA / JAWS / TalkBack) on the result cards or `/credits` — announcement order, the listen button's `aria-pressed` behaviour during speech, and live-region behaviour are unproven. Semantic structure was verified from code; that is not a screen-reader test.
- **No device speech testing** — `speechSynthesis` behaviour, voice intelligibility and pronunciation of the four new hooks (including "Chichén Itzá", "Yucatán", "Seine"), and the no-speech fallback were not exercised on a device.
- **Keyboard-only use not walked through** by the Child Safety seat; zoom (200% / 400%), Windows forced-colours, and `prefers-reduced-motion` behaviour for these surfaces were not re-verified; contrast was not re-measured by that seat (the figures are the UX pass's).
- Wikipedia verification depth varies by landmark (recorded in the Child Safety section of the PR body): the Chichén Itzá clap-echo claim rests on Wikipedia's Temple of Kukulcán material and corroborating acoustics sources rather than the Chichen_Itza article body, and the Sydney Opera House claims were confirmed via Simple Wikipedia and corroborating sources rather than a full first-hand read of the main article.
- The on-device AI story fallback and `mapStory` band re-mapping for **non-curated** places were out of scope and not audited.

## Count sweep (docs)

The Tech Writer swept `docs/` and `BRANCH_STATUS.md` for the pre-branch counts (327 curated starters, 12 globe landmarks). `BRANCH_STATUS.md` is rewritten for this branch by this commit and carries the current counts (331 starters, 16 globe). The new counts also appear correctly in code comments updated by WI-16. The following living documents still carry the old counts and were **not** edited by this branch (outside its two docs files) — listed as follow-ups for the owner:

- `docs/handbook/02-game-design-decisions.md` — "the 327 curated starters keep their hand-set tiers" and "433-place curated catalog (106 + 327)".
- `docs/scoring-difficulty-contract.md` — several references to "the 327 curated starters" as the hand-set tier reference.
- `docs/reveal-your-pin-design.md` — pool table lists "12 curated globe starters".

Dated historical records under `docs/superpowers/` (September 2026 plans and specs) also mention 327 / 12; those describe the state at their date and are left as history, not corrected.
