# Stream S — shared shell: component contract (Phase 0, integrator)

Branch `fix/ui-shared-shell`. Items 1–6. Phase 1 builds exactly this contract;
Streams N/W/B/G/K cherry-pick it and build no header, footer, column, pill or
badge of their own (`lint:nav` fails a PR that does).

## Arena synthesis (Phase 0, two candidates, read in full by the integrator)

- **Base: Candidate B.** Measured fit at 1280 (row ≈1,110px vs 1,208px inner),
  banded type (compact 1024–1279, full ≥1280), slots never enter the menu
  panel, board switch coloured from board.css's own vars.
- **Graft from A:** `navMode="menu"` for narrow-column screens (a `max-w-3xl`
  shell can never inline the full nav — brand + slots stay on the line, nav
  goes behind Menu at every width); Calm switch carries visible "Calm mode"
  text plus On/Off.
- **Converged (both, unprompted):** `SiteHeader` in
  `src/components/ui/site-header.tsx`; `BrandHomeButton` gains the existing
  `onHome | to:"/"` union so router routes can use it; hero fix is
  styles.css-only (drop the height clamp, film `flex: 1 1 auto` at 16/9,
  titles band a 230px rail) and composes with PR 515's frozen files; board
  split reuses the existing `.v3-nav-cluster` / `.v3-nav-settings` markup.
- **Rejected:** global font shrink, scrollable nav, new libraries, text over
  film, film cropping, settings popovers, real ARIA tabs for board views.
- Cross-judge: skipped — the spawn route offers no second model family;
  the integrator scored both against the rubric (existing tokens only,
  one line ≥1024, no trapped actions, composes with 515/516, AA floors).
- One inferred claim to verify in Phase 3 screenshots: the tightened nav row
  fits at 1024px (≈940px estimate, both candidates).

## Components

### `SiteHeader` — `src/components/ui/site-header.tsx` — closes 1, 2, 4, 5
- Built from the home header: `BrandHomeButton` left (extended with the
  `onHome | to:"/"` union from `home-button.ts`), the `.hv5-nav` link row,
  `.hv5-btn-brown` Join. Its CSS lives unscoped in `styles.css` beside
  `.brand-home-button` (A/B converged); no new values — the home-v5 ≤1080px
  squeeze values (10.5px nowrap links, 14px gaps, 19px wordmark, Join
  min-height 46px) become the 1024–1279 compact band; full values ≥1280;
  `nowrap` on nav items ≥1024.
- Props: `onHome | to:"/"`; `navMode?: "inline" | "menu"` (default inline;
  menu = board's shipped Menu disclosure, `aria-expanded`/`data-open`);
  slots in fixed order: `nav` (default: the home nav), `stars?`, `mute?`,
  `endGame?` — hosts pass their existing `SoundToggle` (mute, item 5: shows
  on every screen that plays audio), star readout, and
  `Button variant="secondary"` End game. **Slots never enter the menu panel**
  (an End game must never be menu-trapped). Home passes its Join pill as
  `endGame`.
- One background everywhere: the GeoDetective-only grey header panel and the
  Why Learn / case header panels are removed (item 2).
- Used on: home, Why Learn picker, every subject case, GeoDetective, Cold
  Trail, board, Credits, Privacy, Contact, every error screen.
- `ScreenShell` adopts it after PR 515 merges (shell file is frozen till
  then); S builds `SiteHeader` standalone in Phase 1 so streams can start.

### `SiteFooter` — `src/components/ui/site-footer.tsx` — closes 3
- The home footer's links as one component: Help, About, What's coming,
  Privacy, Terms, Contact us. Props: `onNavigate` handlers or route targets,
  matching how the home footer wires them today (Stream S reads game-app's
  footer and mirrors it; game-app adoption goes through Stream N as owner).
- Rendered on every page, including games and the board.

### `PageColumn` — `src/components/ui/page-column.tsx` — closes 11, 20
- One centred column: `width: "wide" | "read"` — wide = `max-w-7xl` (home,
  picker, board), read = `max-w-3xl` (cases, text pages); same gutters as
  prod (`px-5`). No screen sets its own max-width or lifts the cap
  (`lg:max-w-none` is banned by the lint rule below).

### `Pill` + `Badge` — `src/components/ui/pill.tsx`, `badge.tsx` — closes 14, 32, 40
- One count format everywhere: `"{n} cases"` (deck pills, case-count badges —
  the same string shape in GeoDetective and Cold Trail; a subset count can
  never exceed its total because both read one source, Stream G wires it).
- One badge vocabulary: `New` for unplayed, `Done` for finished; `Open` is
  retired (item 40). Variants carry AA contrast (≥4.5:1) and body-text
  minimum size — no tiny low-contrast mono (item 14).

### `ErrorScreen` — `src/components/ui/error-screen.tsx` — closes 7, 10
- `SiteHeader` on top, a plain message, two buttons: Home and Try again.
  Props: `onHome`, `onRetry`, `message`. This is the only error surface;
  page-local error blocks are banned by lint.

### `FirstVisitQueue` — `src/components/ui/first-visit-queue.tsx` — closes 9
- Props: ordered `prompts: { id, node }[]` + a seen-store key. Renders at
  most one prompt at a time, most important first (Stream N sets the order:
  Scout Map notice → tour banner → read-aloud sheet → support bubble);
  dismissing or completing one advances the queue. Stream S builds it,
  Stream N wires it on Home.

## Lint (`lint:nav`, extend — no new lint)

Stream S extends `eslint.nav.config.mjs` to fail on: any import of the old
`HomeButton` pill (deleted once nothing imports it), any page-local
`<header>`/`<footer>` outside the shared components, and `max-w-none` on a
screen root. Note: repo AGENTS.md's enforced-rules table names `HomeButton`
as the one home control — the owner's prompt for this job outranks it
(AGENTS.md §1: owner's task instruction is precedence 2, the file is 3), so
Stream S updates that table row in the same PR and says so in the PR body.

## Star rule (item 5, second half)

Star count shows wherever stars are earned (GeoDetective, Cold Trail,
subject cases) via the `stars` slot, and nowhere else. One rule, applied by
each stream on its own screens.

## File owners (from the Phase 0 doc — binding)

game-app.tsx → N (S/G patch through the integrator) · home-button.ts → S ·
screen-shell.tsx → frozen (515), then S · SubjectPicker.tsx → frozen (515),
then W · board.tsx → frozen (516), then B · status-core.ts → B ·
LoopScreen/TrailScreen → G · boot-splash/privacy/contact/credits → K ·
graph.json + BRANCH_STATUS.md → integrator only.

## Phase 1 seats (cheaper models, parallel inside this stream)

- UI designer (agent-agency): spec each component from the Living Atlas look,
  states default/hover/focus/Calm/high-contrast at 2560/1280/390.
- UX researcher (agent-agency): check each component against the three
  reports + the 7-10 band (tap ≥44px, reading level, one prompt at a time).
- Frontend developer (agent-agency): build to this contract + unit tests +
  the lint rules above.
- Game-studio lead + game specialist: game screens keep their feel inside
  the shared header (CSS motion, home-rise, three.js only).

## Phase 1 build (2026-11-16, frontend seat) — amendments applied

The designer spec and UX check amended the contract; where they
conflict with the text above, this section wins:

1. **Dialect:** components speak the styles.css shell dialect (theme +
   atlas tokens). The `.hv5-*` tokens exist only under `.home-v5` /
   `.board-v3` and are light-only, so SiteHeader's CSS re-declares the
   hv5 recipes at identical values under `.home-v5` and uses shell
   brass/`--fg` elsewhere — same values, two scopes.
2. **SiteFooter mirrors the shipped footer**, not the contract's list
   (which names Help/About/Terms links the home footer does not
   carry): lead slot, For grown-ups, Take the tour, Privacy, Contact
   us (grown-ups), Credits, What's coming (grown-ups), kids-privacy
   note — `.agep-footer` classes verbatim, CSS imported by the
   component so the classes travel with it.
3. **No app-wide Calm mode exists** (board-only `.v3-calm`): the shell
   components promise reduced-motion behaviour only; the global
   reduced-motion kill covers their one motion (the shared Button's).
4. **Pill/Badge:** 14px on `--atlas-brass-text-sm` (never the
   `.why-learn-chip` pattern); Badge AA is proven by a ratio test
   computed from the token values, not promised.
5. **UX pins:** `stars`/`mute` are required-but-nullable props; every
   header/footer control keeps a ≥44px hit box, pinned in tests; the
   compact band floors nav links at **12px** (UX seat) instead of the
   squeeze's 10.5px verbatim (designer spec) — the 7–10 reading floor
   won; Phase 3 screenshots re-check the 1024px fit either way.
   Item 6's line lands in SiteHeader's contract: a screen renders
   exactly one exit control, the header slot (the "Start over"
   duplicate is Stream W's file and its adoption removes it).
6. **Brand `to` variant:** main's BrandHomeButton is `onHome`-only and
   home-button.ts is frozen (PR 517), so SiteHeader renders the same
   lockup as a router Link with the brand classes inside
   site-header.tsx. When 517's `to:"/"` union lands, dedupe onto it.
7. **Lint shape:** the three bans are rules of one local plugin
   (eslint/shell-ban-rule.mjs), not no-restricted-syntax blocks —
   same-named rule blocks shadow each other in flat config (measured:
   only one of three bans fired). Today's violations are baselined in
   eslint/shell-ban-baseline.json (5 HomeButton importers, 6
   header/footer files, 1 max-w-none); the lists can only shrink and
   shared-shell.test.ts fails on a stale entry. HomeButton is NOT
   deleted and home-button.ts is untouched — the pill still serves
   end-of-flow/HUD surfaces until their streams adopt the shell.

## pstack:correct pass (before PR)

Re-checked every component against the contract + both seat notes:
slot order and menu-trap rule (test-pinned) · required-but-nullable
slots · 44px pins incl. compact band · Badge ratio test from token
values · ErrorScreen blameless default copy + focus-to-heading ·
PageColumn `w-full`, never `100vw` · queue one-at-a-time + seen-store
· footer = shipped set. Fixed during the pass: the lint shadowing
above; the baseline's screen-shell entry (it imports only
BrandHomeButton — substring grep artefact). Negative control: a probe
file importing the pill + a page-local header + max-w-none drew all
three bans; the tree itself passes lint:nav clean.

## Graph

Nodes/edges the integrator folds in at merge (branch lists, never edits):
- node: branch `fix/ui-shared-shell` (this build).
- node: components SiteHeader, SiteFooter, PageColumn, Pill, Badge,
  ErrorScreen, FirstVisitQueue (src/components/ui/).
- edge: this branch `depends-on` main 2ce6757a; `documents` the
  Phase 0 contract (this file).
- edge: SiteHeader `depends-on` BrandHomeButton (home-button.ts);
  dedupe onto PR 517's `to:"/"` union when it merges.

## Handoff

- Done: Phase 1 build — all seven components + shell CSS in
  styles.css + unit tests (16/16) + lint:nav shell bans with baseline;
  tsc clean; neighbouring home-button suites 9/9. No screen adoption,
  no edits to existing screens or frozen files.
- Next: streams adopt per file-owner table (ScreenShell adoption waits
  for PR 515; game screens for 517; board for 516/517).
- Open: 1024px compact-band fit (≈940px estimate) and the hero film
  size (~934–958px at ≥1280) — Phase 3 screenshots verify both.
  Read-aloud sheet's queue position (UX flag: first when read-aloud
  is off/unset) is Stream N's wiring call.
- Ruled out: deleting HomeButton now (baselined ban instead);
  a global Calm state (no mechanism exists — owner/integrator call);
  adding Help/About/Terms footer links (new content, not reuse).
