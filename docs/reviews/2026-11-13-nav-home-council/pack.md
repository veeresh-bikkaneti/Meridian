# Evidence pack: nav-home council (Wave 0)

Loop: `docs/ops/council-panel-loop.md`. Seats cite sections of this pack
and do not re-measure. A pack fact found wrong is a finding.

## 0. Run inputs

- **SUBJECT:** `main` @ `4ed32319f9e7bb7a4da6327ce702d5cc29efbc05`
  (merge of #457).
  Phase 1 is design only: no code is under review yet. Branch
  `fix/nav-label-and-home-cards` carries only this pack, `how.md` and
  the persona files.
- **PROMISES (owner, verbatim):**
  1. "button to navigate home is called different accross each page."
  2. "home page card layouts have to be fixed."
  3. "also makesure the UI layout is consistent; this page is very pale.
     and empty, I would put a bigbang theory them montage in the
     background." (the page is Why Do We Learn This?)
- **LAWS:** `AGENTS.md` §2: touch targets >= 44×44 px, text contrast
  >= 4.5:1, no lowering of an accessibility floor, locked donation copy
  untouched, merge only on the owner's per-PR word. Owner: no `?e2e=1`
  for playtests; playtest at 390×844 and 1280×800 with the real globe
  before merge. Promise 3 constraint set by the coordinator: no Big Bang
  Theory (TV show) images, logos, characters or footage (copyrighted);
  an original science montage only (§7).
- **SEATS:** UI Designer (`docs/ops/personas/ui-designer.md`), UX
  Architect (`docs/ops/personas/ux-architect.md`), Accessibility
  (`docs/ops/personas/accessibility.md`). All three are verbatim MIT
  personas from `msitarzewski/agency-agents` @ `8ae61646` (source and
  license at the top of each file). The accessibility seat uses that
  repo's "Accessibility Auditor" (from its `testing/` folder; there is
  no accessibility persona in its `design/` folder).
- **EXPERIENTIAL SEAT:** VACANT in this phase (no tip to play yet). For
  the build phase: the owner's playtest at 390×844 and 1280×800.
- **EVIDENCE HOME:** this folder. Screenshots: `/workspace/nav-home-shots/`
  on the build box (not committed: ~20 MB). Raw measurements and the
  scripts that made them: `evidence/`.

## 1. How it is built

See `how.md` (same folder): screens are early returns in
`game-app.tsx`; every screen renders its own home button; home grids
are fixed column counts.

## 2. Inventory: every back/home/exit control

All measured on the dev server at `4ed32319`, real globe path (no
`?e2e=1`), headless browser. Size = rendered box at 390×844. "aria" =
`aria-label` attribute; none has one, so the accessible name is the
text.

| # | Screen | Label | Goes to | Component / element | File:line | Position | Size @390 | aria |
| :-- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | GeoDetective | `Editions` | home | `Button variant="ghost"` | `src/game/loop/LoopScreen.tsx:943` | top-left, beside End game + mute | 86×44 | none |
| 2 | GeoDetective, case solved | `Back to editions` | home | `Button variant="ghost"` | `src/game/loop/LoopScreen.tsx:2213` | under "Next mystery" | not measured | none |
| 3 | Cold Trail | `← All games` | home | `Button variant="ghost"` | `src/game/coldtrail/TrailScreen.tsx:497` | top-left, beside mute | 97×44 | none |
| 4 | Cold Trail, cases failed to load | `← Back` | home | `Button variant="secondary"` | `src/game/coldtrail/TrailScreen.tsx:199` | under the alert | not measured | none |
| 5 | Why Learn picker | `Back to Home` | home | raw `<button>`, outlined pill | `src/subjects/shared/SubjectPicker.tsx:134` | bottom, full width | 350×44 (728×44 @1280) | none |
| 6 | Subject case (3 states) | `Back to Home` | home | raw `<button>` | `src/subjects/shared/SubjectCase.tsx:90, 169, 180` | bottom | not measured | none |
| 7 | Country / State list | `Editions` | home | `Button variant="ghost"` | `src/components/game-app.tsx:6345` (`RegionList`) | top-left | 84×44 | none |
| 8 | Admin-1 list (states of a country) | `Editions` | previous list (`menu.from`) | same `RegionList` | `src/components/game-app.tsx:3843` → `6345` | top-left | not measured | none |
| 9 | Edition run (map HUD) | `Editions` | home (session kept) | `Button variant="secondary"` | `src/components/game-app.tsx:8137` | top-left over map | not measured | none |
| 10 | Edition run, review mode | `Exit review` | home, ends review | same button, `REVIEW_DECK_COPY.exitReview` | `src/components/game-app.tsx:8138`, `src/game/review-deck.ts:134` | top-left over map | not measured | none |
| 11 | Edition run, pool error | `Back to editions` | home | `Button` | `src/components/game-app.tsx:6619` | under the alert | not measured | none |
| 12 | Challenge picker | `Back` | home | `Button variant="secondary"` | `src/components/game-app.tsx:3736` | top-left | not measured | none |
| 13 | Challenge / summary preview sheets (×3) | `Back` | closes the sheet | `Button variant="secondary"` | `src/components/game-app.tsx:3702, 7926, 8046` | bottom of sheet | not measured | none |
| 14 | /credits, /privacy, /contact | `← Back to the game` | `/` (route) | `<Link>` text link | `src/components/grownups/info-page.tsx:14` | top-left | **127×16** | none (`data-testid="info-back-home"`) |
| 15 | Home | `MERIDIAN` brand | scrolls to top | `<button>` | `src/components/game-app.tsx:4626` | top-left | 183×44 | `Meridian home` |
| 16 | Journal player (modal) | `✕ Close` | closes modal | `<button>` | `src/components/journal-player.tsx:343, 373` | in player | not measured | `Close movie` |

Count: **8 different labels** for "go home" (rows 1–7, 9–12, 14:
`Editions`, `Back to editions`, `← All games`, `← Back`, `Back to Home`,
`Back`, `← Back to the game`, `Exit review`). Row 8 uses `Editions` for
a one-step back. Rows 13 and 16 are dismissals, not navigation.

Row 14 is **127×16 px**, under the 44×44 floor (`AGENTS.md` §2)
[measured]. Owner screenshots match rows 1, 3 and 5.

## 3. Layout consistency across screens (promise 3)

Measured at 390×844 and 1280×800 (`evidence/screens.json`).

| Screen | Shell class | Max width | Background | Header pattern | Title font | Body font | Home button style |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Home | `atlas-home home-v5` | 1280 | home-v5 art, cards on cream | brand nav + hero | Fraunces 36/46 | Karla | brand button |
| GeoDetective | `mode-screen` | 768 | atlas gradient (`.mode-screen::before`) | buttons row → h1 → blurb → deck chips | Fraunces 36/48 | Karla | ghost, top-left |
| Cold Trail | `mode-screen` | 768 / 1152 (lg) | atlas gradient | buttons row → eyebrow "🕵️ Cold Trail · Case file" → h1 → blurb → deck chips | Fraunces 30 | Karla | ghost, top-left |
| **Why Learn** | **none** | 768 | **flat `#f4f1ea` body colour** | eyebrow "Case file · Why it matters" → h1 → "Pick a subject · Ages 10-18" → pill list → button | **Iowan Old Style 30** | **Avenir Next** | **outlined pill, bottom, full width** |
| Subject case | none | 768 | flat | (code) | Iowan Old Style (code) | Avenir Next | outlined, bottom |
| Country / State list | none | **576** | flat | button → h1 → subtitle | Iowan Old Style 36 | Avenir Next | ghost, top-left |
| Info pages | none | 672 | flat | link → h1 | Avenir Next 30 semibold | Avenir Next | 16px text link |

Where Why Learn diverges from GeoDetective / Cold Trail [measured]:

1. No `.mode-screen` class, so no atlas gradient and no atlas fonts.
   That is the "very pale" look: the page is the bare body colour.
2. Home button at the bottom, full width, outlined; the game screens put
   a ghost button top-left beside the mute toggle.
3. No mute toggle (both game screens have `SoundToggle` top-left).
4. Raw `<button>` elements with hand-written classes instead of the
   shared `Button` (`src/components/ui/button.tsx`).
5. Subject rows are 44px outlined pills with no icon, picture or count
   badge; content ends at y≈513 (bottom of the Back to Home button) on an
   844px-tall viewport at 390 and an 800px one at 1280, so ~40% of the
   first screen is empty [measured].
6. Header copy pattern matches Cold Trail (eyebrow → h1 → sub), which is
   the closest precedent to copy.

`.mode-screen` was added in #244 (WI-12) for "the four game screens".
Screens built after it (#434, #437 subject screens) did not opt in.

## 4. Home grid: structure and measured sizes

Structure (`how.md`): `hv5-grid2` = GeoDetective, Why Learn, Cold Trail
(fixed 2 cols, 1 col <=680px). `hv5-grid3` = Review, Journal,
Grown-ups (3 cols; 2 cols <=1080px; 1 col <=680px). Visible card count
is 3 + 3 for every age band today; a locked band swaps GeoDetective for
`LockedLoop` (same slot); `deck.enabled = false` swaps Review for an
empty `<div aria-hidden>` that still takes a slot.

`?scale=1` changes nothing: every number below is identical with and
without it (Why Learn no longer reads the flag, game-app.tsx:1335).

Card sizes, w×h px (`evidence/home-measure.json`):

| Viewport | grid2 cols | GeoDetective | Why Learn | Cold Trail | Empty cell in grid2 | grid3 cols | Review | Journal | Grown-ups | Empty cell in grid3 |
| :--- | :-: | :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| 320×568 | 1 | 280×401 | 280×428 | 280×430 | none | 1 | 280×405 | 280×611 | 280×572 | none |
| 375×667 | 1 | 335×432 | 335×459 | 335×438 | none | 1 | 335×386 | 335×624 | 335×629 | none |
| 390×844 | 1 | 350×441 | 350×468 | 350×447 | none | 1 | 350×396 | 350×639 | 350×620 | none |
| 768×1024 | 2 | 337×460 | 337×460 | 337×440 | **337×440** | 2 | 337×626 | 337×626 | 337×631 | **337×631** |
| 1024×768 | 2 | 465×483 | 465×483 | 465×489 | **465×489** | 2 | 465×721 | 465×721 | 465×737 | **465×737** |
| 1280×800 | 2 | 593×555 | 593×555 | 593×561 | **593×561** | 3 | 388×677 | 388×677 | 388×677 | none |

Picture boxes, w×h, at 1280: game cards 591×332 (16:9, all three);
Review 386×260 (400/269); Journal 386×386 and Grown-ups 386×386
(square). So inside one grid3 row the pictures have two different
ratios and the text blocks start at different heights. At phones the
spot cards are 572–639px tall because the square art is full width.

Findings [measured]:

1. Every width > 680px has at least one orphan card; 768 and 1024 have
   two (one per grid).
2. The game-card row and the spot-card row use different column counts
   at 1280 (2 vs 3), so the two rows do not share a column rhythm.
3. Cards in different rows differ in height by up to 122px at 1280
   (555 vs 677).

Globe: at 768, 1024 and 1280 a globe `<canvas>` was present. At 320,
375 and 390 no globe canvas was in the DOM at capture time. On this
software-GL box the app auto-picked the Scout map ("You're on Scout
Map"), which is the device's own choice, not a test override. The grid
numbers do not depend on the globe.

## 5. Mistake classes (correct skill)

| # | Class | Evidence | Proposed level | Why not higher |
| :-- | :--- | :--- | :--- | :--- |
| M1 | Each new screen hand-rolls its own home button, label and position | `1bee70e9` (#106) "← All games"; `36bad5e5` (#207) "← Back to the game"; `9e49da3e` (#365) GeoDetective header keeps "Editions"; `8eb34cb4` (#434) and `1b4e02dc` (#437) "Back to Home" at the bottom; 8 labels today (§2) | **Architecture:** one `HomeButton` component plus one `HOME_LABEL` constant; screens take `onHome` and render `HomeButton`. **Lint:** an ESLint `no-restricted-syntax` rule that fails on JSX text `Editions`, `All games`, `Back to Home`, `Back to editions`, `Back to the game` (and `← Back`) outside the component, with the message "use <HomeButton> from src/components/ui/home-button.tsx". Prove it on `1b4e02dc`. | Types can't force a component to render a given child. The lint catches the copy-the-nearest-example path. |
| M2 | New full-screen surfaces skip the shared `.mode-screen` shell (pale, wrong fonts, different max width) | #244 made `.mode-screen` for the game screens; #434/#437 subject screens, `RegionList`, `InfoPage` don't use it (§3) | **Architecture:** one `ScreenShell` component (`<main className="mode-screen …">` + top-left `HomeButton` + `SoundToggle` + eyebrow/title/subtitle slots); every early-return screen renders it. This fixes M1 too. **Lint:** fail a new `<main className=…>` outside `ScreenShell`, with a baseline for the existing ones. | Same: a class name can't be type-checked. |
| M3 | Cards added to fixed-column home grids without re-balancing | #242 recorded the 768 orphan in `hv5-grid3` and deferred it ("768 orphan NOT built"); `fc88781d` (#433) added a third card to the 2-col `hv5-grid2` ("Same hv5-case card markup … no new styles"); the `deck.enabled` empty `<div aria-hidden>` holds a slot open; earlier home-grid cures #165 ("even the bento cards"), #206 (About card void) | **Architecture:** the home cards become one data list; the grid shape comes from the count (a CSS rule keyed on count, or one grid with spans), not from hand-picked column numbers. **Test:** a Playwright layout check at the 6 viewports that fails when a grid row has an empty cell or row heights differ by > N px. Prove it on `fc88781d`. | A lint can't see rendered geometry; only a browser test can. |
| M4 | Touch target under 44px | info-page link 127×16 (§2 row 14) | One instance only, so not yet a class. Folds into M1 (the shared `HomeButton` has a 44px floor). | n/a |

Docs come last: one rule row in `AGENTS.md` pointing at `HomeButton`,
`ScreenShell` and the layout test, once they exist.

## 6. Tests that pin today's labels

These e2e specs select the current home-button text and must change
with any rename (`rg` at `4ed32319`):
`badge-journey`, `band-switch-in-session.desktop`, `detective-owner-spec`,
`difficulty-picker`, `discarded-notice`, `edition-drilldown`,
`game-sfx`, `geodetective`, `mobile-distance-units`, `offline-content`,
`question-card-header`, `reset-history.desktop`, `scout-toggle.desktop`,
`session-score`, `subjects-picker.desktop` (all under `tests/e2e/`).

## 7. Asset pipeline (for a Why Learn background)

- Home card pictures live in `src/assets/home-v5/` as `.webp` stills and
  posters plus `.mp4` films, imported only by
  `src/assets/home-v5/card-media.ts`, rendered only by `CardFilm`
  (`src/components/card-film.tsx`). Per-band variants exist
  (`-trail-scout`, `-adult`, `-little-explorer`).
- Each asset's provenance (how it was made, size in bytes, encode
  settings, owner rulings) is written as a doc comment in
  `card-media.ts`. Unit tests pin the slot count and band variants
  (`src/assets/home-v5/card-media-band-variants.test.ts`,
  `src/components/card-film.test.ts`, `src/components/home-smooth-cards.test.ts`).
- Shipped webp stills are 50–90 KB at quality 82 (from the comments).
- A new background would be: one `.webp` (plus per-band variants if the
  seats want them) added beside the others or in a new
  `src/assets/subjects/` folder, imported once by the screen shell, with
  a provenance block in the importing module and a size budget. The
  `.mode-screen::before` layer is where a page background already lives,
  so the image would go behind content there, not as a card.

## 8. Open questions for the seats

Q1. **One label.** Which exact text and form: `Home`, `← Home`, `⌂ Home`,
    or an icon plus visible text? One accessible name for all of them?
Q2. **Placement.** Top-left on every screen, beside the mute toggle,
    as GeoDetective and Cold Trail do now?
Q3. **Why Learn's bottom button.** Remove it, or keep a second home
    control at the end of the list (and the subject case) for kids who
    scroll to the bottom? If kept, same label?
Q4. **Which controls are not "home".** Do the run HUD `Exit review`
    (ends the review), the admin-1 list one-step back (§2 row 8) and the
    preview-sheet `Back` buttons keep their own labels?
Q5. **Home grid shape.** With 3 game cards + 3 spot cards at every width:
    (a) 3+3 at >= 1081px and 1 column at <= 680px — what at 681–1080px
    (2+1 with a full-width third card, a 3-up row of compact cards, or a
    horizontal list)? (b) Should both rows share one column rhythm?
    (c) What happens when Review is disabled or a loop is locked
    (2 cards in a row)?
Q6. **Picture treatment.** Should all six cards use one picture ratio
    (e.g. 16:9 on top), or keep the spot cards' square art? Fixed card
    heights per row?
Q7. **Shell for Why Learn.** Adopt `.mode-screen` (gradient + Fraunces/
    Karla) and the Cold Trail header pattern for the picker and the
    subject case? Should the subject rows become cards (icon, colour,
    case count) instead of plain pills?
Q8. **Background montage for Why Learn (promise 3).** The owner asked
    for a "big bang theory" style montage. Proposal: an ORIGINAL science
    montage (chalkboard equations, atoms, planets, a rocket, lab
    glassware) in Meridian's existing illustration style, subtle, behind
    the content. No Big Bang Theory (TV show) images, logos, characters
    or footage. Seats decide: yes/no; opacity or blur so every text and
    control over it keeps >= 4.5:1 contrast (measure on the busiest
    patch); whether it is one image for all bands or per band (7-10 vs
    10-18); no religion or politics in the montage; still image only, or
    motion under `prefers-reduced-motion` rules; size budget.
Q9. **Info pages.** Bring `/credits`, `/privacy`, `/contact` onto the
    same home control (the current link is 127×16, under the floor)?
