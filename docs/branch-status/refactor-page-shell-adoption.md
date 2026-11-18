# refactor/page-shell-adoption — PR 3 (shell adoption), Steps 1–5

**Stacking note, corrected 2026-11-17:** PR #526 has MERGED to main
(merge commit 72ced0bd), along with #527, #528 and #530. This branch
merged `origin/main` at 8ba3a947 in merge commit 60e9bbaf (union
resolution: main's header/sheet token split and board fail-closed
flags win; this branch's shell work wins for shell files). The
branch is now plain main + the commits below; no stack remains.

## Done — Step 1: tokens (commit d5f8d8f4)

- `:root` gains `--bp-md` 768, `--bp-menu` 1024, `--bp-lg` 1280,
  `--page-narrow` 48rem, `--page-wide` 80rem, `--hero-film-offset`
  276px. 526's z-scale verified against the brief: `--z-base` 0,
  `--z-header` 30, `--z-overlay` 40, `--z-menu` 50, `--z-modal` 60 ✓.
- styles.css width queries that map to a token cite it in a comment
  (media queries cannot read custom properties — the convention 526
  set). Values unchanged everywhere.
- **Left literal, with reasons** (component-local thresholds, not
  page breakpoints; changing them would silently move a layout):
  479px (brand wordmark shrink), 560px (error actions stack),
  680/681px family (why-learn hero + trail sizing bands), 1080px
  (brand wordmark + home squeeze), 375px lower bound (one range
  query whose upper bound cites `--bp-md`).
- Hero cap: `[data-testid="subject-picker"]` selector →
  `.subject-picker-screen` class (SubjectPicker root carries it);
  magic 276px → `var(--hero-film-offset)`. Variant B holds:
  why-learn-hero-cap spec green at 1280×800 and 1920×1080 (16/9,
  first card row peeks in the 35–65px band).
- `--hv5-*` re-declarations: the brief cites site-header.tsx:24-26;
  in this tree those lines are the header's doc comment and the file
  declares no `--hv5-*` values. The shell's only hv5 coupling is two
  `.home-v5 .site-header-nav-link` colour overrides in styles.css.
  Left untouched: removing them recolours Home's nav links — a
  visible change that needs the owner's eye (brief rule 10). Flagged
  for Step 3.

## Done — Step 2: one shell (commits 81990e09, eb02a2b2, d60b3495, 3e94d33b)

- **PageShell** (new, `ui/page-shell.tsx`): SiteHeader → PageColumn
  (optional **PageIntro** eyebrow/title/sub) → SiteFooter. No
  className on the shell; variants are props.
- **SiteHeader**: `stars` slot renamed to **`status`** (GeoDetective's
  "Case #N" moved with it; Home/ErrorScreen pass `status={null}`);
  new **`back`** slot between Home and nav; **`variant="cream"|"map"`**
  (map = game-chrome surface, home control defaults to secondary);
  nav items gain **icon** (decorative, before label) and a **link
  form** (`to` → router Link) beside the onClick button form.
  526's `exitInMenuOnSmallScreens` already generalises to any
  screen's endGame slot, so it stays as the phone-collapse mechanism.
- **Chevron/baseline cure** (`.site-header-nav-link` →
  inline-flex, measured with the real build at 1024/1280/1920):
  before — chevron sat below its label (svg 82.8–88.8 vs text
  66–80 @1280); the two router links' text sat 7px above the
  buttons' (62.4 vs 69.4). After — chevron centred on the text line
  (73.4–79.4 within 69–83); every item's text top identical (69).
- **SiteFooter + grown-ups doors** share ONE link list:
  `ui/site-links.ts` defines each route once with both surfaces'
  labels; `FOOTER_ROUTE_LINKS` and `GROWNUP_DOORS` compose from it.
  SiteFooter and InfoPage render from it (same routes/labels/order
  as shipped).
- **ErrorScreen**: `message` → **`body`**, **`actions`** labels
  (retry/home), **`surface`** prop ("card" default | "plain").
  Pinned default copy and the two exits unchanged.
- **PageColumn**: width "read" → **"narrow"**; widths read the
  `--page-narrow` / `--page-wide` tokens. Same sizes as shipped.
- **Badge: DELETED** — zero production users (grep: only its own
  test); `.site-badge` CSS removed; its contrast pin survives under
  Pill's name (same token pair).
- **Pill: KEPT, with the reason recorded** — it has a real user
  (SubjectCase, "Case i of N"); deleting it would fork that markup
  inline in a screen, the opposite of this PR's point. The picker's
  count chip is a designed stamp surface, not a Pill adoption; that
  call belongs to the Step 3 picker migration (Step 3.3 below).

## Tests / gates (this step)

- `shared-shell.test.ts` 28/28 (new-API tests fail on main by
  construction — PageShell/status/back/variant do not exist there;
  the inline-flex assertion fails on main's styles.css: the revert
  check for the chevron/baseline cure).
- Targeted unit: pack-shelf + why-learn-hero + living-atlas 41/41.
- E2E (hermetic, built artifact): layout-overflow (526) ✓,
  shared-shell-adoption (Home + GeoDetective, 1280/1920/2560) ✓,
  why-learn-hero-cap (1280×800, 1920×1080) ✓.
- tsc clean · lint:nav ✓ · lint:subjects GATE PASSED · lint-cards
  GATE PASSED · check:provenance PASSED · build:pages green.

## Done — Step 3, Batch A (one commit per screen)

- **3.1 Grown-ups pages** (`d640bb1a`): InfoPage (Privacy / Credits /
  Contact) now frames its card with PageShell — SiteHeader carries
  the one "Home" control, SiteFooter closes the page; these pages
  had no header, footer or Home before. The `.grown-page` parchment
  wrapper and the doors cross-nav stay as page content; every word
  inside is unchanged (privacy text and the age-band sentence
  untouched; no donation copy lives on these pages — the locked
  lines are in grandpa-coffee-run.tsx, not migrated here). New
  shared-shell test pins the adoption; revert check: 1 red with
  main's InfoPage. E2E: grownups-privacy-contact + credits green.
- **3.2 Board** (`8cc37cd6`): SiteHeader `variant="map"` carries
  Home; SiteFooter takes the board's ask as its lead, word for
  word; the title block is content, not a second `<header>`. Board
  leaves both shell-ban baseline lists. **"Live from GitHub" was
  player-visible at board.tsx:340 — it is gone**: the coverage line
  now reads "Checked just now — every linked record checked
  (N of N)"; status-core's banned-token guard entry stays. The
  board-data guard test + board e2e state the new line (revert
  check: guard test red on main's route). Spacing: the block above
  the map tightens ~56px in board.css because the shell header
  carries its own row padding — measured: without it the molecule
  map's probe atom lands below a 900px viewport (click at y=928)
  and board.desktop.spec.ts:212 fails; with it the board spec
  passes. **Known flake, not from this batch:** the kill-switch
  test (board.desktop.spec.ts:562) failed 1 of 3 lone reruns on
  this branch and passed in the full run — the service-worker
  flags race PR #527 root-caused (fail-open flags); the feed logic
  is untouched here and the fix lives in #527.
- **3.3 Why Learn picker** (`133d4e89`): off ScreenShell —
  SiteHeader carries Home, the resume control rides the `back`
  slot, SiteFooter carries the grown-ups entry; the hero card is
  the screen's own block with the same `.screen-hero` classes.
  **Variant B holds, identical numbers**: film 931.5×524 @1280×800,
  first-row peek 50.0px, hero-cap spec green @1280 + @1920. The
  shell header is ~24px taller than the old home bar; the page's
  top padding gives the 24px back (32→8px) — `--hero-film-offset`
  untouched. Picker leaves pageLocalHeaderFooter (keeps maxWNone:
  the wide desktop column IS the approved Variant B layout).
  case-navigation + why-learn-hero specs updated in the same
  commit (3 tests red on main's picker).
- Screenshots (before/after, 390 + 1280, real build):
  `~/workspace/verify-evidence-shell-step3/` — before-{privacy,
  credits,board,picker}-*.png, after-{info,board,picker}-*.png.
- Gates on the batch tip: tsc clean · npm test 1202 + 2852 pass,
  0 fail · lint:nav ✓ · lint:subjects GATE PASSED · lint-cards
  GATE PASSED · check:provenance PASSED · build:pages green.

## Done — Step 3, Batch B (one commit per screen)

- **3.4 Subject case** (`52beb93f`): off ScreenShell — SiteHeader
  carries Home, the resume control rides the `back` slot, End game
  the exit slot (same Buttons/labels/testids/handlers); titles are
  the screen's own block in ScreenShell's classes; the Pill
  ("Case i of N") stays. Top padding 32→8px returns the ~24px the
  shell header row adds. End-of-flow HomeButtons in the result
  sections stay (sanctioned end surface). Specs in-commit:
  case-navigation (both shells pin the SiteHeader slots) +
  living-atlas (scope count).
- **3.5 Cold Trail** (`f67a1381`): SiteHeader carries Home, stars
  in `status`, the one mute in `mute`; the fail-closed branch gets
  the same header. **The `px-2` call: REMOVED** — it sat on the
  HomeButton itself, narrowing the one Home control's padding so
  this screen's Home differed from every other screen's; the
  shell's standard HomeButton padding/hit box applies, the page
  gutter (px-5) is unchanged, so neither the PageColumn width
  prop nor a token exception was needed. TrailScreen leaves both
  shell-ban baseline lists. New shared-shell pin.
- **3.6 Country/State lists + drill-down** (`62fd803d`):
  RegionList off ScreenShell — SiteHeader Home + own title block;
  chrome only, no nav/history changes (PR 4's territory). One
  deliberate delta: the drill-down list showed only Back under
  ScreenShell; it now carries Home (top menu, new `onHome` prop)
  with Back in the `back` slot, old classes + testid — the Step
  3.3 pattern, per the one-Home-on-every-screen rule. New
  shared-shell pin.
- **3.7 Review / Challenge complete** (`3fc6f6c2`): both had no
  header at all; SiteHeader now carries Home at the top, content
  keeps its vertical centring below it (flex-1 wrapper, content
  classes unchanged); the in-flow primary HomeButtons stay (the
  end-of-flow exits). ErrorScreen check: neither screen has a
  failure branch (ReviewComplete's total === 0 is an empty deck;
  ChallengeComplete always renders) — nothing to route. New
  shared-shell pin.
- **Revert check (the batch's pins vs Batch A tip `cfc70c27`
  sources):** case-navigation 1 fail (the updated shells pin);
  the 3 new shared-shell pins 3 fail / 0 pass. On the branch all
  green (shared-shell 32/32, case-navigation 19/19).
- Screenshots (before/after, 390 + 1280, real build):
  `~/workspace/verify-evidence-shell-step3/` —
  {before,after}-{subjectcase,coldtrail,regionlist}-*.png.
  Review / Challenge complete: no screenshots — both screens sit
  behind full play flows (review deck / challenge route); their
  targeted e2e below exercises them on the real build instead.
- **Spec name updates** (`00061618`): retiring the BrandHomeButton
  lockup renamed the header control "Meridian home" → "Home" on
  the picker (Step 3.3, stale since Batch A), the subject case
  and the region lists; edition-drilldown, ask-age-first and
  home-layout now drive "Home" (journeys/assertions unchanged).
- **Targeted e2e (hermetic, built artifact):** capture flows for
  the case / Cold Trail / Country list 6/6 (the after-screenshot
  run); drilldown + ask-age-first + home-layout home-control
  sweep green after the name updates; review-deck green
  (ReviewComplete exercised end to end); coldtrail green.
- One more spec cured in passing (`46bb82a3`): pack-shelf's
  TrailScreen pin keyed on the old hand-built header's closing
  tag; it now uses the SiteHeader pattern LoopScreen's pin
  already carried.
- **Gates on the batch tip:** tsc clean · npm test 1202 + 2855
  pass, 0 fail · test:worker 235/235 · lint:nav ✓ ·
  lint:subjects GATE PASSED · lint-cards GATE PASSED ·
  check:provenance PASSED · build:pages green.
- **Pre-existing failure, NOT this batch:** the math-subject
  project's result-line tests expect "You just used this in…"
  but `usedInLine` (landed in #524, on main) composes "You just
  used this in real life: …" for colon-shaped catalogue phrases.
  Zero diff to used-in-line or math data anywhere in this PR;
  the spec's expectation is stale against merged #524. Left for
  its own fix, flagged here so the delta is on record.

## Done — Step 3, Batch C (one commit per item) — Step 3 closed

- **3.8 Region pool error** (`e31c37ec`): the hand-built
  pool-failure `<main>` (own eyebrow/title/alert + a lone
  HomeButton) now renders the shared ErrorScreen — the failure copy
  rides its title/body props verbatim (loader message + the
  standing partial-pool explanation), and both exits converge on
  onEditions, the surface's one recovery door, exactly as before.
  The region loading state and the pinned stale-build/offline
  notices keep their specialised surfaces. New shared-shell pin.
- **3.11 GeoDetective override removal** (`1e421220`): LoopScreen
  was the last screen passing a className override to SiteHeader
  (`screen-home-bar -mx-5 px-5`). SiteHeader gained a `sticky`
  prop (data-sticky; bar treatment on the shell's own styles.css
  rule, layer from --z-header — the retired bar sat at z-20, the
  shell header's token layer is 30, still below the Q1 overlay at
  40 and the menu at 50); LoopScreen passes `sticky`. The Home
  control's slot/size/offsets are unchanged — the adoption e2e
  (Home ≡ GeoDetective at 1280/1920/2560) is green, and the Q1
  overlay + staging are untouched. New shared-shell pin.
- **Revert check:** both new pins fail on the pre-batch sources
  (stash the four source files → 2 fail / 32 pass) and pass on the
  branch (shared-shell + boundary + lazy-boundary suites 52/52).
- **Gates on the batch tip:** tsc clean · lint:nav ✓ ·
  lint-cards GATE PASSED · check:provenance PASSED ·
  build:pages green · adoption e2e 3/3 (hermetic, built artifact).
- Screenshots (before/after, 390 + 1280, real build):
  `~/workspace/verify-evidence-shell-step3/` —
  {before,after}-geodetective-{390,1280}.png. Pool error: no
  screenshot — triggering the pool failure hermetically needs a
  run-start flow with the places JSON aborted; the surface now
  renders ErrorScreen, whose appearance the shared-shell suite
  already pins.
- **3.9 Map error boundary — DONE** (`86065ca6`, `1d0c1d53`;
  owner-approved 2026-11-17). ErrorScreen gained an **embedded
  mode**: panel only (no PageColumn/SiteHeader), and its Home
  exit is opt-in — it renders only when the caller passes
  `onHome`. Existing ErrorScreen callers are unchanged. The
  boundary's card now renders through ErrorScreen embedded:
  both cards' wording rides the title/body props **word for
  word** (the stale wording stays the owner-approved text;
  rendered-markup proof in the new behaviour test), and the
  Home exit is passed only for persisted screens (INV2) — the
  bare-map usage sits inside a run in progress, its reload
  restores the run, and a Home button there would lie. Retry /
  goHome behaviour unchanged. The boundary leaves the shell-ban
  baseline (homeButtonImport). **New behaviour test**
  (`map-error-boundary.behavior.test.ts`, renders the real
  boundary class): mid-run → Home hidden + Try again reloads;
  GeoDetective → Home shown + the retry marker boot consumes
  restores the screen; stale copy verbatim + Refresh.
  **Revert check:** 2 of 3 red on the pre-migration boundary
  (the mid-run pin passes on both — it guards pre-existing
  correct behaviour), 3/3 green here. Step 3 is now 11/11.
- **3.10 Globe overlay (in-run HUD) — OWNER DECISION
  2026-11-17: sanctioned by-design exception, no migration.**
  The in-run globe HUD is a game overlay, not a page, and its
  Home button was already approved in Round 2. **The HUD is
  the sole named by-design exception to the shell rule, to be
  enforced by the Step 5 registry test: a test must fail if
  any other screen tries to skip the shell.** The chrome over
  the satellite map (game-app's pointer-events-none top bar)
  does not fit SiteHeader's slots without visible change: in
  review mode its left control is the pinned "Exit review"
  Button INSTEAD of Home (SiteHeader always renders Home); its
  contrast / map-mode / run-menu controls have no on-line slot
  (the nav slot menu-traps below 1024px, against SiteHeader's
  own never-menu-trap rule). No HUD code changes in this PR.
  Tap-through was therefore not re-proved — the bar is
  untouched, so its pointer-events behaviour is byte-identical
  to the Batch B tip.

## Remaining — in the brief's order

- **Step 3 held items — RESOLVED 2026-11-17:** (9) Map error
  boundary migrated onto ErrorScreen embedded (see Batch C
  addendum above); (10) Globe overlay HUD sanctioned as the
  sole named by-design shell exception, enforced by Step 5's
  registry test. Step 3 is closed at 11/11.
- **Step 4 — DONE 2026-11-17 (re-scoped brief; commits 249e551f,
  d2c93a6f, 7da7384a):** ScreenShell DELETED (no production
  consumers remained; game-app / SubjectCase / SubjectPicker only
  mentioned it in comments) with its `.screen-home-bar` CSS and its
  shell-ban entries (pageLocalHeaderFooter baseline now empty).
  All unused `.hv5-nav` and orphaned `.hv5-brand` rules DELETED
  from home-v5.css (122 lines). BrandHomeButton KEPT in
  home-button.ts with its `.brand-home-*` CSS, per the re-scoped
  brief. Screen roots' literal max-w-3xl/7xl now read the
  `--page-narrow` / `--page-wide` tokens (same sizes, no movement);
  the RegionList 36rem column and component-local caps stay
  literal, with reasons in the pin. Revert checks: each new pin
  fails with its change reverted (1 fail each) and passes here.
  **Cure round (59e7e2c4):** TrailScreen's two roots still used
  literal max-w-3xl (QA catch) — both now read
  `max-w-(--page-narrow)`. Its healthy path's `lg:max-w-6xl`
  (72rem) stays literal, with the reason in the pin and here: no
  token in the narrow/wide family holds 72rem, and converting to
  `--page-wide` (80rem) would move the layout.
  **OPEN, needs a ruling:** the re-scoped brief also says
  BrandHomeButton "becomes the ONE home control" and Home's header
  lockup must render from it. That conflicts with the repo's
  enforced rule (AGENTS.md: one home control named exactly "Home",
  HomeButton + HOME_LABEL, checked by lint:nav and the
  shared-shell pins) and with the zero-visual-delta law — Home has
  no page-local lockup markup left to replace (it renders
  SiteHeader). The component is kept; SiteHeader was NOT switched.
  Do not wire it without the owner's word.
- **Step 5 — DONE 2026-11-17 (commits 031100cf, bb247e48):**
  registry-driven test (`ui/shell-registry.ts` +
  `shell-registry.test.ts`, 7/7): every route/screen renders
  PageShell/SiteHeader/ErrorScreen or is registered; header
  exceptions frozen at [in-run-hud], footer exceptions at
  [why-learn-picker] (shrink-only), header baseline frozen at six
  not-yet-adopted screens. Negative controls recorded: in-test
  mutated registries fail; a real fake shell-less screen file
  turned the suite red on the completeness check, green again
  after removal. **Cure round (0059d56f):** the shell-ban
  baselines are now frozen exactly in shared-shell.test.ts —
  before, an entry added to cover a genuinely-violating new file
  passed both lint and the staleness check; the negative control
  (scratch <main> file + a covering pageLocalMain entry) passed
  lint:nav but failed the suite on the frozen record, and
  removing both restored green. Lint: shell-ban gains no-page-local-nav and
  no-page-local-main, shrink-only baselines (pageLocalNav 2 files,
  pageLocalMain 9 files); a scratch <main><nav> file failed
  lint:nav with both new errors. E2E (built artifact, hermetic):
  layout-overflow all green. home-layout, stated exactly (cure
  round correction): the failure set is **not stable across
  runs**. The two "Home stays in the viewport" failures
  (1280 + 390) pre-exist on the post-merge pre-Part-1 tip
  60e9bbaf — they failed there with the same assertions. The
  grid assertions are flaky across runs: 0 grid failures on the
  branch run, 3 on the baseline run — the branch had FEWER
  failures than the baseline, so there is no Part 1 regression;
  the grid flake itself is pre-existing and still open. Bundle:
  entry gzip measured 321,990 B by QA (twice) on the Part 1 tip
  and 321,982 B (twice) on the cure-round build, vs the
  323,865 B limit — the figure drifts by a few bytes between
  builds (asset hashes feed the gzip); ~1.9 KB spare either way.
  Post-merge baseline was 321,960 B; the CSS deletions do not
  move the JS number.
- **Captures (before/after, 1280×800 + 390×844, real build):**
  `~/workspace/verify-evidence-shell-step4/` — Home and Credits
  pixel-identical (0 px differ); the picker differs only in the
  hero film's frame at capture time (geometry identical);
  GeoDetective differs in map tiles and the dealt case (geometry
  identical). **Cure round:** the v1 GeoDetective 1280 pair was
  not page-comparable (the before frame caught the header
  ~620px down under a blank area — a capture-timing artifact).
  It is superseded by `before-geodetective-1280-v2.png` (built
  on 60e9bbaf) and `after-geodetective-1280-v2.png` (built on
  the cure-round tip), taken with paint waits (map canvas
  mounted, clue staged, header box polled stable): header box
  identical in both (x=276, y=32, 728×84) and the two frames
  are byte-identical.

## Build-failure cure — 2026-11-18 (post-Part-1)

- CI on the Part 1 tip `4e080362` (run 44224335774): build (22.x)
  FAILED in `npm test` — 2 files (`src/routes/privacy-copy.test.ts`,
  `src/routes/contact-gate-skeleton.test.ts`) died with
  `ERR_MODULE_NOT_FOUND` for `src/components/ui/site-links` imported
  from `info-page.tsx`; e2e and GitGuardian passed. Root cause: the
  node test loader resolves `@/` aliases and extensioned relative
  imports but not extensionless relative ones; Steps 2/3.1 introduced
  the extensionless chain (on main, `info-page.tsx` imports only
  react/router/css, so the tests pass there).
- Cure: explicit extensions on the 9 relative specifiers in
  `info-page.tsx`, `page-shell.tsx`, `site-footer.tsx`,
  `error-screen.tsx` (`.ts` for site-links, `.tsx` for components —
  the `./home-button.ts` precedent). Specifier-only; no test, copy
  or behaviour change. Revert check: restoring the extensionless
  site-links specifier in `info-page.tsx` reproduces the failure;
  the fix restores green.
- Independent silo QA verified the cure before it was committed:
  targeted files 6/6, full `npm test` green, tsc clean; the frozen
  shell-ban baseline negative control bites (a scratch `<main>`
  file plus a covering baseline entry failed the shared-shell
  suite on the frozen record; removal restored 39/39); bundle
  entry JS gzip 321,987 B vs the 323,865 B limit (1,878 B spare).
- **Home-layout claim, corrected:** the "pre-existing flake, no
  regression" statement above rests on this file's earlier baseline
  record only — the CI e2e job's spec list does not include
  home-layout, so the claim is UNVERIFIED by CI and stays open
  until a run that includes home-layout speaks.

## Part 2 (N1 SiteNav) — owner mock approval landed; build started 2026-11-18

Design contract: the approved Phase A mocks in
`~/workspace/frozen-header-mockups/` (see its README for the three
mechanisms). Zero visual delta beyond them.

### Step 0 — Part 1 cure verification (2026-11-18)

- **(a) TrailScreen tokens — VERIFIED.** Both roots read
  `max-w-(--page-narrow)` (TrailScreen.tsx:195, :496); the healthy
  path's `lg:max-w-6xl` (72rem) stays literal and the pin in
  shared-shell.test.ts records why (no narrow/wide token holds
  72rem; `--page-wide` at 80rem would move the layout).
- **(b) Frozen shell-ban baselines — VERIFIED by re-running the
  negative control.** A scratch file with a page-local `<main>`
  plus a covering `pageLocalMain` baseline entry made the
  shared-shell suite fail on the frozen record ("pageLocalMain
  baseline changed…", 38 pass / 1 fail); removing both restored
  39/39 green.
- **(c) GeoDetective 1280 v2 pair — VERIFIED.** Both files in
  `~/workspace/verify-evidence-shell-step4/` are 1280×800 and
  byte-identical (same SHA-256,
  4cf018c07e21e02fda0b44f544e1590db48660ce7d71ec624b36730aeb2a6b96),
  so the header box claim (x=276, y=32, 728×84, identical in both)
  holds trivially.
- **(d) home-layout claim — SETTLED 2026-11-18: pre-existing, no
  Part 1 regression.** Hermetic runs (built artifact, pinned
  Chromium, flock, --workers=1): on this branch's Part 1 tip
  48198f12 — 11 passed / 3 failed: the grid test at 1280×800 and
  both "Home stays in the viewport" tests (1280 and 390). On the
  pre-Part-1 baseline 60e9bbaf (separate sparse worktree, audio
  tree excluded; its package.json/package-lock.json are identical
  to this branch's, and its node_modules was hardlink-copied from
  this worktree's after a fresh `npm ci` died on a VM-wide disk
  quota — same files, not a fresh install, noted for honesty) —
  run 1: the same two viewport failures (1280 and 390), plus grid
  failures at 768×1024, 1024×768 and 1280×800 (3 grid failures vs
  the branch's 1). Run 2 on the baseline is INVALID and proves
  nothing about the app: all 14 tests failed on disk-quota
  (EDQUOT) errors while Playwright wrote its artifacts, with the
  assertions themselves passing up to `context.close()`. Exact
  verdict: the two viewport failures pre-exist on the baseline
  with the same assertions; the grid assertions are flaky on
  BOTH sides (branch 1 of 6 grid tests, baseline 3 of 6 in the
  valid run); the branch had FEWER failures than the baseline.
  The earlier "UNVERIFIED by CI" flag is now closed by these
  local hermetic runs — CI's e2e list still does not include
  home-layout.

### Done — Part 2 Unit 1: lockup home control + derived highlight + menu close

- **BrandHomeButton union**: props are now `{onHome} | {to: "/"}`;
  the link form renders a real router Link to "/" (no
  location.href fake, the staging shortcut done properly). New
  link-mode test renders it inside a memory router.
- **SiteHeader** renders BrandHomeButton in BOTH branches — the
  "Home" pill is gone from every header. `homeVariant` is removed
  (the lockup has one form on cream and map alike). Accessible
  name stays "Meridian home"; testid stays "home-button".
- **Derived highlight**: SiteHeader mirrors `location.hash` onto
  nav items carrying `data-nav-section` (mount + hashchange +
  click, because GameApp's scrollTo writes the hash with
  replaceState, which fires no event). The matching item gets
  `aria-current="location"` + `data-current`; GameApp's five Home
  section buttons carry `data-nav-section` (as staged). Nav items
  can also declare `sectionId`.
- **Menu panel closes after a section pick**: a click on a nav
  link inside the open panel closes it.
- **Shell CSS (styles.css)**: `.site-header` is sticky with the
  staged opaque bar treatment on every screen; the atlas lift's
  forced `position: relative` is reclaimed at its own weight
  (`.atlas-home > header.site-header { position: sticky }`,
  mechanism 1); `body:has(> header.site-header)` grows the body
  box for body-child headers (mechanism 2 — PageShell's column
  already grows with content for the normal route shape; the rule
  stays in the shell CSS with its reason, for the shape that has
  no wrapper); `html { scroll-padding-top:
  calc(var(--header-height) + 12px) }` (the scroll-offset
  contract); one current-section style (filled tile + underline,
  never colour alone); below 560px the SiteHeader lockup collapses
  to the compass mark alone (mechanism 3). Why Learn: the picker
  already renders SiteHeader as a direct child of its full-height
  `<main>` (Step 3.3 removed the old hero `<header>` wrapper with
  ScreenShell), so mechanism 2's structural cure is the current
  shell structure itself — no move was needed.
- Gates: shared-shell + brand-home-button + home-button +
  shell-registry unit suites 57/57; tsc clean. **Revert check
  (recorded 2026-11-18):** with the four Unit 1 source files
  (home-button.ts, site-header.tsx, styles.css, game-app.tsx)
  checked out from the Part 1 tip 48198f12, the new pins fail —
  41 pass / 5 fail: the BrandHomeButton link-mode test, the
  lockup home-control pin, the frozen-bar/N1 CSS contract pin,
  the section-id + panel-close pin, and the map/cream lockup pin.
  Restoring the branch sources returns 46/46 green across the
  two suites.

### Done — Part 2 Unit 2: the home-control rule amended (lint + AGENTS.md, one commit)

- The old rule ("One home control, named exactly Home",
  HomeButton + HOME_LABEL enforcer) is superseded by the owner's
  2026-11-17 ruling, in the same commit: the AGENTS.md rule-table
  row now reads one home control per screen, and it is the brand
  lockup whose accessible name is exactly "Meridian home"
  (BrandHomeButton + BRAND_HOME_LABEL, rendered by SiteHeader);
  the home-label lint's fix guidance and the shell-ban rule's
  header note say the same. HomeButton ("Home") remains only for
  end-of-flow and HUD surfaces, which are not headers. The banned
  old labels themselves are unchanged. lint:nav green.
- Spec name updates (journeys/assertions unchanged, only the
  header control's name): shared-shell-adoption (name pin),
  home-layout (default name, the two explicit pins, test title),
  and every e2e journey that clicks the header control mid-flow —
  32 `getByRole("button", { name: "Home" })` sites across 16 spec
  files, each checked in context: all are header journeys (loop,
  picker, lists, Cold Trail, subject case), none is an
  end-of-flow button.

### Done — Part 2 Unit 3: gates, captures, playthrough (tip 29cadcac + this doc)

- **Cures found by the gates, in order:** (1) the highlight
  effect now no-ops on a location-less window stub (the
  loop-screen animate harness) — 607fa228. (2) The compact band
  rises to the header row's fit point, 1364.5px: with the lockup,
  the full-spacing Home row needs 1365px (scrollWidth 1365 at
  1280, Join pill clipped — the Phase A mock at 1280×800 shows
  the same clip); layout-overflow + shared-shell-adoption failed
  at 1280×800 on the pre-cure tip and pass after — 208c919d.
  (3) The Why Learn drift lift (`.why-learn-screen > header`)
  forced `position: relative` on the header like the atlas lift
  does on Home — the picker and subject-case bars scrolled away
  (headerY −592 measured). Sticky reclaimed at the lift's own
  weight in the shell CSS; probe-verified sticky + headerY 0 —
  29cadcac. The shared-shell CSS pin covers both reclaims; the
  pre-cure tip fails it on the why-learn line.
- **Gates on the tip:** npm test 1204 + 2887, 0 fail ·
  test:worker 235/235 · tsc clean · lint:nav ✓ · lint:subjects
  GATE PASSED · lint-cards GATE PASSED · check:provenance PASSED
  · build:pages green. Named e2e (hermetic): layout-overflow +
  shared-shell-adoption + why-learn-hero-cap 10/10.
  home-layout on the tip: 12 passed / 2 failed — both failures
  are the pre-existing grid flake (1024×768 + 1280×800 this run);
  both "Home stays in the viewport" tests now PASS (they failed
  on the Part 1 tip and the baseline — the frozen bar cures
  them; see Step 0(d)).
- **Bundle:** entry JS gzip 322,589 B vs the 323,865 B limit
  (1,276 B spare), `scripts/check-entry-size.mjs` on the tip
  build. Part 1's cure tip measured 321,987 B; Part 2 adds
  ~600 B (the highlight effect + the lockup's link branch).
- **Captures:** `~/workspace/verify-evidence-shell-part2/` —
  Home, Privacy, Why Learn, in-game × 5 viewports × top/scrolled
  (40 PNGs + measurements.json), in-game shots taken after both
  rig3d canvases painted (paint probe true at every viewport).
  Mock parity: scrolled headerY = 0 on every surface at every
  viewport; Home top headerY 31 and header height 88 (desktop) /
  85 (phone) match the mock measurements exactly; CASES carries
  aria-current="location" in every scrolled Home shot (the
  mobile shots pick it from the menu panel, which now closes on
  select by itself); Privacy header height 85 matches the mock;
  End game fully in frame in-game at 390 (right edge 370) and
  320 (right edge 300). Two top-state deltas against the staging
  captures, both inherited from Part 1's approved structure, not
  introduced here: Privacy's header starts 26px down (the
  grown-page shell pad) and sticks from there; the Why Learn
  header starts 8px down (Step 3.3's top-padding give-back) with
  height 85 (the shell header; the staging's 60px bar was the
  retired ScreenShell bar).
- **Playthrough (owner-config smoke set, AGENTS §4):**
  detective-owner-spec + detective-selection-read +
  detective-tapmode-selection + detective-watson-walk,
  --workers=1: 19 passed / 2 failed. One failure is a disk-quota
  artifact error at context.close() (watson-walk mid-walk test;
  its assertions passed). The other is pre-existing and NOT a
  Part 2 regression: detective-owner-spec's "one mute is
  top-left" test expects the mute left of the "Case #" label,
  but the shell's fixed slot order (status → mute → end game,
  unchanged since Step 2) puts Case # first; Part 2 changed only
  the left control's width, which cannot move the right-anchored
  actions at 390px (the failure screenshot shows the mock's row
  exactly: mark-only lockup, Case #1, mute, End game, all in
  frame). The tap-mode selection tests (Listen first tap, pick
  named before the spend, staging, celebrations) all pass.
- **Modularity (owner addendum 2026-11-18):** BrandHomeButton is
  rendered in exactly one place — SiteHeader
  (site-header.tsx:221, both branches). SiteHeader has 13 call
  sites; every difference between them is props (onHome/to,
  variant, sticky, nav/navItems, back, status, mute, endGame,
  exitInMenuOnSmallScreens, navMode) — no per-page variant, no
  restyled copy. HomeButton's remaining production uses are the
  non-header surfaces it was kept for (end-of-flow primary,
  challenge menu, the HUD exception), all the same component
  with variant props. Pre-existing items in the touched
  surfaces, flagged not silently changed: the `.home-v5`
  colour twins for nav links (home-scoped tokens; Part 1 flagged
  the same pattern — the N1 highlight follows it with identical
  values); the current-tile colours are the staged mock's own
  hex values, as are the lockup svg's; Home's nav rides the
  shell's documented `nav` node slot (mixed buttons + router
  Links) with the one shared link class, not navItems.
- **Emil skills:** no Emil guidance was applied. The mocks show
  no new motion, and the brief's restraint rule + the component
  law outrank the pack; the lockup and nav links keep the
  transitions they already carried (the shared Button/brand
  transition in home-button.ts). No conflicts needed a ruling
  beyond that restraint call.

### Cure round — QA's three evidence items (2026-11-18, on tip e3c8d378 + this doc)

Independent silo QA passed the build itself but returned NOT
READY on three evidence items. All three are cured here;
nothing else changed (no features, no design changes).

- **Cure 1 — CI on the tip.** Why the pushes after e60fe7a3
  produced no runs [measured]: `node.js.yml` triggers on
  `pull_request` to main (no `types`, no `paths`, no
  `concurrency`) and on `push` to main only; it declares NO
  `workflow_dispatch`, so `gh workflow run` cannot fire it.
  None of the six commits after e60fe7a3 (0166be82…e3c8d378)
  carries `[skip ci]` / `[ci skip]` / `[no ci]` in subject or
  body, none touches `.github/`, the PR was DRAFT throughout
  (the same draft PR triggered a run for every earlier push,
  including run 44293530116 on e60fe7a3 at 11:18:46Z), the
  workflow is `active`, and Actions permissions are
  enabled/all. The Actions API holds ZERO runs for every head
  SHA after e60fe7a3, and no run exists repo-wide after
  2026-11-18T11:18:57Z — the pushes registered on the PR
  (timeline `committed` events are present) but GitHub never
  enqueued a workflow run for them: an ingestion-side drop in
  that window, not a property of the commits. Cure: this
  status-doc commit is itself the retrigger push; if it also
  produces no run, one empty commit (message stating it exists
  to retrigger CI) follows. The completed run's id, head SHA
  and per-job conclusions are reported with this cure round
  and appended below once finished.
  - **Cure 1 outcome [measured]:** the retrigger push
    (b922e632), an empty commit (c7b331cc) AND a close/reopen
    of the PR each produced zero runs — the `pull_request`
    event path stayed dropped for this PR (GitGuardian's app
    checks landed on every head within seconds throughout, so
    event delivery itself was alive; scheduled watchdog runs
    also fired). Cure landed: `workflow_dispatch:` added to
    `node.js.yml` (39c5327c, one trigger line + comment — the
    brief's preferred path, made to exist), then
    `gh workflow run "Node.js CI" --ref
    refactor/page-shell-adoption`. **Run 44315401754, head
    39c5327c, completed SUCCESS: build (22.x) success, e2e
    success** — both jobs that failed on e60fe7a3 (npm test;
    layout-overflow 1280 scrollWidth) pass on the cured tip.
    This addendum commit is docs-only on top of 39c5327c; its
    own dispatched run is reported with the cure round (a
    docs commit cannot cite its own run id).
- **Cure 2 — capture evidence completed.**
  `~/workspace/verify-evidence-shell-part2/measurements.json`
  now holds ALL 40 records (Home, Privacy, Why Learn, in-game
  × 5 viewports × top/scrolled), re-measured live on the tip
  build with the Phase A recipe (band 10-18 seeded profile,
  hermetic harness, pinned Chromium, flock, --workers=1);
  in-game shots waited for BOTH rig3d canvases to paint (paint
  probe: element-clip bytes 7,230–10,662 per canvas, true at
  every viewport). The Home scrolled PNGs were RE-SHOT with
  the sheet answered "Sometimes" first (the mock redraw's
  definition of the scrolled state; a real tap, queue gone
  before the 600px drop + Cases navigation; visually verified
  at 390×844 — frozen bar + CASES cards, no sheet). Parity vs
  the mock set (`~/workspace/frozen-header-mockups`):

  | Surface / state | Mock | Verify | Reading |
  | --- | --- | --- | --- |
  | Home top | headerY 31, H 88 (desk) / 85 (phone) | identical | exact |
  | Home scrolled | headerY 0, CASES current, all viewports | identical | exact (scrollY 1243/1263 identical on desktop; 1641/1674/1773 vs 1484/1661/1898 at 768/390/320 — page height differs, landing is the same) |
  | Privacy top | headerY 0, H 85, current A:Privacy | headerY 26, H 85, A:Privacy | the documented Part 1 grown-page pad delta |
  | Privacy scrolled | headerY 0 @ scrollY 600 | identical | exact |
  | Why Learn top | headerY 0, H 60 | headerY 8, H 85 | documented deltas: Step 3.3 top-padding give-back; 85 is the shell header, 60 was the retired ScreenShell bar |
  | Why Learn scrolled | headerY 0 @ 600 | identical (H 85) | frozen exact |
  | In-game top | scrollY 624/489/516/760/1022, headerY 0, H 85 | identical, all five | exact |
  | In-game scrolled | headerY 0; scrollY 1124/1013/600/1200/1200 | headerY 0; scrollY 1124/600/600/1200/1200 | frozen at both depths (1920 scroll clamped at 600 in the verify run; 1280 proves 1124) |
  | In-game End game right edge | fully in frame at 390/320 (staging note) | 370 @390, 300 @320, both states | in frame, matches Unit 3's record |

- **Cure 3 — playthrough/e2e re-run on the tip** (hermetic
  recipe, serial, flock, --workers=1; QA's attempts had died
  on Chromium renderer crashes under host memory pressure —
  the VM had since rebooted and NO renderer crash occurred in
  any cure run):
  - layout-overflow + shared-shell-adoption +
    why-learn-hero-cap: **10/10 passed** (builder's figure
    independently reproduced).
  - home-layout: **12 passed / 2 failed** on the tip — the
    grid assertions at 768×1024 + 1280×800, signature
    "review on spot cards: row 1 has an empty cell (1 cards
    in 3 columns)", reproduced on a lone re-run. Baseline
    comparison (brief-prescribed): the same spec on
    60e9bbaf in a scratch worktree scores **5 passed /
    9 failed**, including grid failures at 1024×768 +
    1280×800 with the 1280×800 signature byte-identical to
    the tip's. **Classification: pre-existing, NOT a Part 2
    regression** (the failing viewport pair shifts run to
    run — the known grid flake; the assertion and signature
    do not). The baseline also fails the five old-"Home"-pill
    control tests and both "Home stays in the viewport"
    tests, which PASS on the tip — Part 2 cures, recorded so
    the comparison is not read backwards. Baseline-run
    disclosure: `npm ci` in the scratch worktree was blocked
    by the VM's EDQUOT (below), so its `node_modules` was
    copied from this worktree after verifying `package.json`
    + `package-lock.json` are byte-identical between
    60e9bbaf and the tip (empty diff; copied tree verified
    at 21,430 files = source count; baseline build green).
  - Owner-config set (detective-owner-spec,
    detective-selection-read, detective-tapmode-selection,
    detective-watson-walk): 21 tests. First pass 13 passed /
    8 failed, classified one by one:
    - **Pre-existing (1):** owner-spec's "one mute is
      top-left" — real assertion (mute right edge 281.19 >
      Case # x 183.625). The shell's fixed slot order
      (status → mute → end game, unchanged since Step 2)
      puts Case # first; Part 2 changed only the left
      control's width, which cannot move the right-anchored
      actions. Same failure the builder recorded.
    - **Environment (7):** five watson-walk tests,
      selection-read (b) and the tapmode watchdog test
      failed with ZERO assertion errors — every error is
      EDQUOT (-122) on Playwright artifact/trace writes
      under `~/workspace` (at `context.close()`, in one case
      the spec's own `finally`). Proof: re-run with
      `--output=/tmp/…` (artifacts off the workspace tree),
      all 7 pass cleanly (watson-walk 5/5, selection-read
      (b) 1/1, tapmode watchdog 1/1). Net owner-set verdict:
      **20/21 pass; the one failure is the pre-existing
      mute-order expectation above.**
    - EDQUOT note: the quota bites bulk parallel writes
      under `~/workspace` (git checkout bursts, npm tar
      extraction, Playwright trace zips) while single-stream
      writes and /tmp writes succeed — measured repeatedly
      this round (worktree add failed 3× at the same audio
      file while `cp -r` of the same 257 MB tree succeeded).
      It is the same recurring VM condition the Unit 3 record
      flags, not a product defect.

## Remaining

- Nothing in the Part 2 brief, and the cure round above
  closes QA's three evidence items (the Cure 1 CI run id is
  appended to that section when the run lands). The PR stays
  DRAFT — no merge, no ready marking (owner's word only).
- Pre-existing, flagged for their own lanes: the home-layout
  grid flake (both sides of Part 1), the detective-owner-spec
  mute-order expectation vs the shell slot order, the stale
  `.hv5-nav` e2e selectors noted in Part 1, and this VM's
  recurring disk-quota (EDQUOT) failures on fresh installs and
  Playwright artifact writes.
- The BrandHomeButton-as-home-control ruling above.
- Pre-existing stale e2e selectors: journal-player fixes and
  chunk-recovery specs still query `.hv5-nav`, which no screen has
  rendered since Step 2 — they were stale before Step 4 deleted
  the (already unused) CSS and need their own cure.

## Graph

- New nodes: `ui/page-shell.tsx` (PageShell, PageIntro),
  `ui/site-links.ts` (one link list), `ui/shell-registry.ts`
  (registry + frozen exception/baseline lists). Edges: PageShell
  composes SiteHeader/PageColumn/SiteFooter; SiteFooter and
  InfoPage consume site-links; shell-registry.test.ts validates
  every screen against the shell family. Badge node:
  superseded-by nothing — deleted as unused. ScreenShell node:
  deleted in Step 4.
