# refactor/page-shell-adoption — PR 3 (shell adoption), Steps 1–3

**Stacked on PR #526** (`fix/mobile-header-overflow`, tip `dbfcfdb7`,
OPEN unmerged): this branch contains 526's three commits until it
merges; after that it is plain main + the commits below. Base for the
PR is `main` so the stack is visible; do not merge before 526.

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
- **Step 4 — delete legacy:** ScreenShell, BrandHomeButton, the 18
  unused `.hv5-nav` rules and `.brand-home-*`; hand-rolled
  max-w-3xl/7xl/6xl/2xl/xl → PageColumn. Removing the second Home
  buttons changes what players see: before/after screenshots for
  owner approval BEFORE it lands.
- **Step 5 — guards:** registry-driven unit test (every route/screen
  renders PageShell or SiteHeader, ErrorScreen on every failure
  branch; the in-run globe HUD is the registry's ONE named
  by-design exception — owner, 2026-11-17 — and the test must
  fail if any other screen skips the shell; prove by removal — red); lint bans on hand-built
  header/footer/nav/main outside the shell + className overrides on
  shell components (shrink-only baseline); Home-position e2e (same
  label, same x/y on every screen at 390/1280/1920); overflow +
  overlay e2e at all 5 viewports.

## Graph

- New nodes: `ui/page-shell.tsx` (PageShell, PageIntro),
  `ui/site-links.ts` (one link list). Edges: PageShell composes
  SiteHeader/PageColumn/SiteFooter; SiteFooter and InfoPage consume
  site-links. Badge node: superseded-by nothing — deleted as unused.
