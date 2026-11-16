# fix/header-logo-home — branch status

**Task:** Match the game screens' header to the homepage header (Radhae, 2026-11-16, with photos of the homepage): the compass + MERIDIAN wordmark sits on the LEFT and clicking the logo goes home; there is no "Home" button in the homepage header. The game screens broke both rules (Home pill top-left, wordmark top-right on the picker). Draft PR only — Veeresh merges. Built on main `0d47ad5fab` in a prepared local tree (no `.git`; nothing pushed, no PR opened by the builder).

**Scope:** The header pattern lives in one place — `ScreenShell` (`src/components/ui/screen-shell.tsx`) — so the fix is the shell plus its sanctioned home-control file, the picker's one wordmark usage, and the shell's CSS. Out of scope and untouched: every other `HomeButton` surface (end-of-flow primary buttons, map HUD, menu overlay, Cold Trail, GeoDetective, the board route, and SubjectCase's `home-button-end`), `HomeButton`'s own contract and its test, the `onBack` ("Back") drill-down variant, and all `onHome` callbacks/handlers in GameApp (so PR #485's picker-close behaviour, which lives in those handlers, is preserved by construction).

**What changed:**

- `src/components/ui/home-button.ts` — adds `BrandHomeButton` beside `HomeButton` (the sanctioned home-control home; plain `.ts` + `createElement`, svg built via `createElement`). Contract: `<button type="button">` invoking the same `onHome` callback; accessible name exactly "Meridian home" (`aria-label`, matching the homepage brand button; exported as `BRAND_HOME_LABEL`); visible content is the homepage's exact lockup — two-ring compass svg (outer r21.5 #8A6D2F w1.6, inner r16.5 #B8932F w.8 op.6, star path, centre r3.4 fill #F6F1E3) with `aria-hidden`, plus the MERIDIAN word; 44px floor (`min-h-11`); the same focus-visible outline classes as `HomeButton`'s BASE; `data-testid` defaults to "home-button" so existing selectors for the header home control keep their meaning (the shell header never co-renders with another `home-button` testid; `home-button-end` is distinct).
- `src/components/ui/screen-shell.tsx` — the `onHome` branch renders `BrandHomeButton` (same `-ml-3`) instead of `HomeButton`; `onBack` branch unchanged. Header doc comment and the `controls`/`sound` prop docs updated (`sound` is now documented as a SoundToggle only).
- `src/subjects/shared/SubjectPicker.tsx` — no longer passes the simplified one-ring wordmark span as `sound` (passes nothing). The homepage two-ring lockup in the shell header replaces it.
- `src/styles.css` — brand styles beside `.screen-home-bar` (`.brand-home-button` / `.brand-home-mark` / `.brand-home-word`) mirroring `.home-v5 .hv5-brand/.hv5-mark/.hv5-word` values from `home-v5.css` (40px mark; Fraunces word at 24px/600/0.24em; 19px/0.18em at ≤1080px, 19px at ≤680px), without importing or un-scoping `home-v5.css`. Removed: the now-unused `.why-learn-wordmark` rules (grep-verified no other user in src or tests/e2e), the frosted-backing rule for the old header pill (`.why-learn-screen [data-testid="home-button"]` — its only user was the removed pill), and fixed the hero-controls comment that referenced `.why-learn-wordmark`.
- `src/subjects/shared/SubjectCase.tsx`, `src/components/game-app.tsx` (RegionList) — no changes; both inherit the shell (verified by reading their renders: SubjectCase's two shells are both `onHome` with game controls and no `sound`; RegionList kind "home" → `{onHome}`, kind "back" → `{onBack}` unchanged).
- Tests: `case-navigation.test.ts` pin updated to the new pattern (brand control first in the bar, controls after it, no `<HomeButton` in the shell header, picker passes no wordmark/`sound`); new `src/components/ui/brand-home-button.test.ts` (5 tests: label constant, button contract, exact two-ring svg values, caller class/testid, not-HomeButton). `home-button.test.ts` untouched.
- E2E specs (reviewer Finding 1 fix): the shell header's accessible name changed from "Home" to "Meridian home", so the name-based Playwright locators on shell screens were updated to "Meridian home" in this same change, in 5 files: `tests/e2e/home-layout.desktop.spec.ts` (`expectHomeControl` parameterised by name — only its Why Learn picker and Country list call sites, and the clicks after them, use "Meridian home"; Cold Trail, GeoDetective and /credits still expect "Home"), `tests/e2e/edition-drilldown.spec.ts` (Country/State top lists, RegionList kind "home"), `tests/e2e/subject-case-navigation.spec.ts` (subject case only; its LoopScreen sites stay "Home"), `tests/e2e/subjects-picker.desktop.spec.ts` (math case), `tests/e2e/ask-age-first.spec.ts` (math case only; its LoopScreen `dealMystery` site stays "Home"). Every other `name: "Home"` locator in `tests/e2e` was re-checked site by site and deliberately left, because it drives a non-shell screen (LoopScreen/GeoDetective, Cold Trail, globe-run HUD, end-of-flow) where `HomeButton` is untouched. `data-testid="home-button"` references are unchanged (the brand control carries that testid).

**Status:** Built and verified locally on main `0d47ad5fab`. NOT published: no branch push, no PR (a separate publish step follows; the draft PR body is saved with the run notes).

**Checks (all run in the prepared tree):**

- `npm test` — PASS, exit 0: scripts suite 1200 tests (1189 pass, 11 skipped, 0 fail); src suite 2695 pass / 0 fail (223 suites), including the new brand suite and the updated case-navigation pins; `home-button.test.ts` green unchanged.
- Re-run after the reviewer Finding 1 e2e fix: `npm test` — PASS, exit 0 (src suite 2695 pass / 0 fail, 223 suites; scripts suite recount 1200 tests, 1191 pass, 9 skipped, 0 fail — total and fail count unchanged). `npx tsc --noEmit` — clean (its `include` is `src` + `server`, so it does not cover `tests/e2e`). `npm run lint:nav` — clean. The 5 edited e2e specs parse cleanly (Playwright `--list` loads 4 of them, 31 tests; `subject-case-navigation.spec.ts` matches no project in `playwright.config.ts` — pre-existing — and was syntax-checked directly, 0 errors).
- `npx tsc --noEmit` — clean.
- `npm run lint:nav` — clean (the "Meridian home" aria-label does not trip the home-label rule, as expected).
- `npm run lint:subjects` — GATE PASSED (0 new; known baselines only).
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run check:provenance` — cannot run meaningfully here (it scans a git range; this tree has no `.git`). Emulated with the script's own `findVendorName` over every line of every changed file: 0 vendor/model-name hits. Commit identity/message checks are for the publish step.
- Build: `npx vite build` — green (exit 0; the known sandbox fingerprint note applies to `build:pages`' postbuild, which was not run). For the behaviour proof only, a `GITHUB_PAGES=1 npx vite build` artifact (`dist/client`) was also built and served locally.
- Behaviour proof (headless Chrome over CDP, the repo's disclosed Playwright substitute; Playwright cannot run in this sandbox): 35/35 checks, 0 failures, 0 console errors, at desktop 1280×800 and phone 390×844 — picker: brand logo top-left first in the bar, no Home pill, no trailing wordmark, band pills intact; Math case: same pattern with End game present; clicking the logo on the picker lands on Home, clicking it in a case exits to Home; RegionList (Country list): same pattern, logo click returns. Screenshots + results JSON in the run notes (`header-proof/`, script `header-proof.mjs`). One harness note: an early draft of the proof scrolled before clicking and its ternary never reached the click where `scrollIntoViewIfNeeded` exists — a harness bug, fixed to plain clicks; the app was never at fault (verified by direct-click probes).

**Not tested:**

- Playwright e2e does not run in this environment; CI carries it. E2E coherence (corrected): `data-testid="home-button"` references are unchanged (the brand control carries that testid), the why-learn spec's tab-order expectation (header home control first, by testid) still holds, `home-button-end` specs are untouched, AND the name-based locators on shell screens were updated to "Meridian home" in this same change in the 5 spec files listed under "What changed" above.
- The drill-down "Back" shell variant (RegionList admin1) is unchanged by design and was not re-walked; the Country list (kind "home") was.
- Forced-colors rendering of the brand control: not live-checked (same standing debt as prior streams).
- Narration/audio: not involved in this change.

**Flags for the owner / publisher:**

- (a) Overlap with draft PR #500 (`feat/why-learn-landscape-layout`, on main base, head `372cc85c`), which defines picker controls including a Home pill: whichever of #500 / this PR lands second must carry this header pattern. This PR does not modify #500's branch.
- (b) Out-of-scope inventory: `HomeButton` remains for end-of-flow / HUD / menu / Cold Trail / GeoDetective / board-route uses and SubjectCase's `home-button-end` — all unchanged, and `home-button.test.ts` still pins it green.
- (c) Visual note: the picker's simplified one-ring wordmark svg is replaced by the homepage's two-ring lockup.
- (d) The removed frosted-backing rule: the old pill needed it so its label never sat on art; the brand lockup sits in the sticky bar (solid bar background) exactly as the homepage brand sits on its page, so no backing is carried over.
- (e) AGENTS.md rule superseded for shell headers: AGENTS.md's enforced-rules table still says 'One home control, named exactly "Home", on every screen — HomeButton + HOME_LABEL'. Radhae's 2026-11-16 header decision supersedes it for shell headers; reconciling AGENTS.md is the owner's/integrator's call — this change does NOT edit AGENTS.md.
- (f) Publish hygiene: only the changed files are staged; the working tree's `dist/`, `node_modules/` and `.wrangler/` are build outputs and are not part of the change.

## Graph

- Add node: `BrandHomeButton` (`src/components/ui/home-button.ts`) — the header form of the home control; the homepage brand lockup as a button.
- Add edge: `ScreenShell` `depends-on` `BrandHomeButton` for its `onHome` header (picker, subject case, RegionList home lists).
- Add node: decision (Radhae, 2026-11-16) — no Home button on game screens; clicking the logo goes home, logo/wordmark always on the left of the header, exactly as on the homepage.
- No existing nodes or edges changed.
