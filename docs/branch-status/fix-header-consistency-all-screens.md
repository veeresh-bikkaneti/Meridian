# fix/header-consistency-all-screens — branch status

**Task:** One header everywhere (Radhae, 2026-11-16, from photos of the live site: "From page to page you can see header Nav bar changes. I need all of them look similar to home page for consistency."). PR #510 (merged) put the homepage's brand lockup (`BrandHomeButton`, named "Meridian home") into the ScreenShell headers (Why Learn picker, subject cases, Country/State lists) and deliberately left the screens that render their own headers untouched. This branch carries the same lockup to those remaining headers. Draft PR only — Veeresh merges.

**Scope — converted headers (brand lockup first, existing handler, existing controls after it):**

- GeoDetective (`src/game/loop/LoopScreen.tsx`): brand first in the `.screen-home-bar`, then End game, then the sound toggle, Case # on the right — the #510 arrangement. Wired to the same `onLeave`.
- Cold Trail (`src/game/coldtrail/TrailScreen.tsx`): brand first in the header row, sound toggle beside it, stars readout on the right. Same `onLeave`.
- /board (`src/routes/board.tsx`): brand as the header's first element, in link mode (`BrandHomeButton to="/"`, a router `<Link>` — the route's existing home semantics). The board's own controls (views, theme, calm) stay in the view nav under the header, as before. `src/board/board.css`: the `.v3-back a` rule no longer recolours the link (it would have tinted the lockup's word brown); underline suppression kept.
- Challenge-a-friend region picker (`src/components/game-app.tsx` menu screen): the screen's sole top control was a Home pill; it is now the brand control, wired to the same `() => setMenu(null)` close. Flagged in the PR body as the one conversion beyond the brief's named minimum — it is a full screen whose only header-position control was that pill.

**Component change:** `BrandHomeButton` (`src/components/ui/home-button.ts`) gains a `to="/"` link mode beside its `onHome` mode, mirroring `HomeButton`'s existing union — same lockup, same name, same testid; no lockup redraw, no new component. `HomeButton` itself is untouched.

**Left untouched, with reasons (also listed in the PR body):**

- Globe-run map HUD (`game-app.tsx`, `HomeButton variant="secondary"` over the map canvas): an overlay cluster, not a page header; a ~200px lockup would crowd the score cluster off small screens. Needs its own owner decision if wanted.
- End-of-flow primary HomeButtons: Review complete (`onDone`), challenge verdict (`challenge-done`), run pool-error exit (`onEditions`), LoopReveal's pinned-CTA Home (`home-button-end`), SubjectCase's end-of-case Home (`home-button-end`).
- Cold Trail's fail-closed empty-deck exit: a standalone body control under an alert on an error screen, not a header.
- Homepage itself (the reference), ScreenShell screens (done in #510), the drill-down "Back" shell variant, and the grown-ups InfoPage doors nav (a destination-labelled site nav; it carries no Home-labelled control).

**Tests added/updated:**

- `src/components/ui/brand-home-button.test.ts`: new link-mode pin (router `<a href="/">` named "Meridian home", lockup + testid).
- `src/components/ui/header-consistency.test.ts` (new): source pins for the four converted headers (brand first, controls after, no `<HomeButton` in the header segment) and for the left-alone boundary (HUD, home-button-end, Cold Trail fail-closed exit).
- E2E name locators "Home" → "Meridian home" only where they drive a converted header: `home-layout.desktop.spec.ts` (Cold Trail + GeoDetective call sites and its header comment), `ask-age-first.spec.ts`, `band-switch-in-session.desktop.spec.ts`, `detective-owner-spec.spec.ts`, `game-sfx.spec.ts`, `geodetective.spec.ts` (locator + one comment), `offline-content.spec.ts`, `reset-history.desktop.spec.ts` (Cold Trail site only), `subject-case-navigation.spec.ts`. New board header test in `board.desktop.spec.ts` (brand link visible, ≥44px, no "Home" control, click lands Home). The remaining 15 `name: "Home"` sites in tests/e2e were re-checked one by one and stay "Home": they drive the globe-run HUD or end-of-flow screens. `data-testid="home-button"` is unchanged everywhere (the brand control carries it).

**Status:** Built and verified locally. Base: main `2ce6757ae1` — main moved while this was being built (board v4 #508, clue waves #509, #507, #483 landed on top of the brief-time base `b2ef88a7a1`); the three board files in this change were re-based onto the new main by hand (diff-verified to contain only this change's hunks) and every gate was re-run on the new base. See the PR body for gate numbers and the behaviour proof. NOT merged — draft PR only.

**Checks:** (filled in the PR body with the run's real numbers)

- Targeted unit tests for the touched components, full `npm test`, `npx tsc --noEmit`, `npm run lint:nav`, `npm run lint:subjects`, `node scripts/lint-cards.mjs`, `npm run lint:content`, provenance emulation over the diff, plain Vite build, and a headless-Chrome-over-CDP behaviour proof at desktop 1280×800 + phone 390×844 covering GeoDetective, Cold Trail, /board and the Challenge-a-friend menu screen.
- Playwright e2e cannot execute in the builder's sandbox (standing limit); CI carries it. TypeScript does not cover `tests/e2e` (its include is `src` + `server`); edited specs were parse-listed where the Playwright config loads them.

**Flags:**

- AGENTS.md's enforced-rules table still says 'One home control, named exactly "Home", on every screen'. As with #510, this change does NOT edit AGENTS.md and does not weaken `lint:nav` (which passes); reconciling the rule text for header screens is the owner's/integrator's call, disclosed in the PR body.
- The local tree was assembled without the GitHub API tree fetch completing (the shared API quota was exhausted mid-fetch by parallel work; the fetch died at 791 of 8,481 blobs). The tree is: the complete verified tree of `abc18331` (8,480 blobs, SHA-verified at its own fetch) overlaid with the 791 SHA-verified files fetched directly from `b2ef88a7a1`, plus every file changed by the commits that landed after it (#513's 9 files; the 35 files of `b2ef88a7a1..2ce6757ae1`) re-fetched individually and SHA-verified after the quota reset. The publisher's tree is built on main's real tree SHA regardless.
- One local full-suite run was poisoned by the sandbox's /tmp tmpfs filling up (512M, 100% — browser-profile temp dirs from parallel proof harnesses): write-temp tests failed with ENOSPC (scripts 205-fail cascade, src 3 fails). The temp dirs were cleaned and the suite re-run clean; the earlier and later runs agree. Nothing in the change was implicated.
- `scripts/ssr-build-shape.test.mjs` fails locally for a different disclosed reason: it reads a stale emitted SSR wrangler.json carried into this assembled tree from another worktree (the emitted file embeds that worktree's absolute path). Build output, not part of this change; the test skips when the artifact is absent.
- The salvage base tree also carried the lose-path branch's working copies of six subjects files (verified by in-memory diff against main `2ce6757ae1`: MathCase.tsx 1 hunk, SubjectCase.tsx 1 hunk, clue-scene.test.ts 1 hunk, fair-share-lose-path.test.ts 5 hunks, plus lose-path-all-items.test.ts which does not exist on main; scenes.ts was clean after the #509 delta). NONE of them is in this change and the publisher builds on main's real tree, so the PR is unaffected. Locally, the three test files (69 tests) were quarantined out of the assembled tree (kept in the builder's work dir) rather than run against the wrong content: the final local src run is therefore 2740/2740 over main's other tests, and CI runs the true files. MathCase/SubjectCase's branch copies remain only as local build inputs for the header proof (headers are unaffected by them). Every one of this change's 17 modified files was verified by in-memory diff against pristine main: the diffs contain exactly this change's hunks and nothing else.

## Graph

- No `docs/knowledge/graph.json` edits on this branch (integrator-only). Suggested node for the integrator: a decision node for Radhae's 2026-11-16 header-consistency direction (all screen headers carry the homepage brand lockup; "Meridian home"), extending the #510 header decision node, with `depends-on` edges to the LoopScreen, TrailScreen, board route and home-button modules.
