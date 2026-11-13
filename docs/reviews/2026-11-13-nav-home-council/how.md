# How: home navigation and the home card grid

Pinned to `main` @ `4ed32319` (2026-11-13). Read-only map for the
nav-home council. No code changed.

## Overview

Meridian has no router-level screens for its games. `src/components/game-app.tsx`
is one component that holds boolean/union state (`loopOpen`,
`coldTrailOpen`, `subjectsOpen`, `menu`, `run`) and early-returns a whole
screen for whichever is set. "Going home" therefore always means "the
callback the parent passed clears that state". Each screen receives that
callback under its own name (`onLeave`, `onExit`, `onBack`, `onEditions`)
and renders its own button with its own label, classes and position.
Only `/credits`, `/privacy`, `/contact` are real routes; they share
`InfoPage`, which renders a `<Link to="/">`.

The home page is one big render function in the same file: a `hv5-bento`
grid (hero + right rail with globe and the Expeditions map card), then a
`hv5-grid2` of game cards nested inside the bento, then a `hv5-grid3` of
spot cards, then `hv5-pages` (About + Journal). All grid columns are fixed
counts in `src/components/home-v5.css`, not derived from the number of
cards, so adding a card leaves an orphan.

## Key Concepts

- **Screen = early return.** Not routes. No shared shell component. Back
  navigation is a prop callback.
- **`.mode-screen` shell** (`src/styles.css:1994`, from #244 WI-12): the
  atlas gradient (`::before`, fixed) plus atlas fonts (Fraunces / Karla).
  Opt-in by class name. GeoDetective and Cold Trail use it; Why Learn,
  the region pickers and the info pages do not.
- **`Button`** (`src/components/ui/button.tsx`): shared variants
  (`primary`/`secondary`/`ghost`). Game screens use it; the subject
  screens hand-roll raw `<button>` classes instead.
- **Fixed-count grids:** `hv5-grid2` = 2 cols, `hv5-grid3` = 3 cols
  (2 at <=1080px), 1 col at <=680px.
- **CardFilm** (`src/components/card-film.tsx`) + `src/assets/home-v5/card-media.ts`:
  the only way home cards get pictures (film, poster, still per card and
  age band).

## How It Works

### Home/back navigation

1. `GameApp` decides the screen: `loopOpen` → `LoopScreen`,
   `coldTrailOpen` → `TrailScreen`, `subjectsOpen` → `SubjectPickerScreen`,
   `menu` → region pickers / challenge picker, `run` → the edition
   `RunScreen`, else home.
2. Each callback just clears its flag: `onLeave={() => { writeLoopOpen(false); setLoopOpen(false); }}`
   (game-app.tsx:3437), Cold Trail the same (3457), `onExit={() => setSubjectsOpen(false)}`
   (3478), `onBack={() => setMenu(null)}` (3784, 3818), `onEditions` clears
   `run` and `menu` (3341). Every one of them lands on the home page.
3. Labels are hard-coded strings at each call site, so they drifted:
   "Editions", "← All games", "← Back", "Back to Home", "Back to editions",
   "← Back to the game", "Back", "Exit review". Every "Editions" button now lands on the home page,
   not an editions list [measured in code]; the label likely dates from
   when the home page was the edition picker [inferred].
4. Placement drifted too: top-left ghost button (GeoDetective, Cold
   Trail, region lists), top-left secondary button over the map (edition
   run HUD), full-width outlined pill at the bottom (Why Learn picker and
   case), 16px-tall text link (info pages).
5. None has an `aria-label`; the accessible name is the visible text.
   The home brand button is `aria-label="Meridian home"` but only scrolls
   to top (game-app.tsx:4629).

### Home card grid

1. `hv5-bento` (home-v5.css:175): `2.24fr / 0.92fr`. Row 1: hero (col 1),
   rail (col 2: globe + Expeditions map card).
2. `hv5-grid2` (home-v5.css:213, `grid-column: 1 / -1`, 2 cols): GeoDetective
   (or `LockedLoop` for a locked band), Why Do We Learn This?
   (`whyLearnEnabled`, now always true — game-app.tsx:3889), Cold Trail.
   Three cards in two columns → Cold Trail orphaned on its own row with
   an empty half at every width > 680px.
3. `hv5-grid3` (home-v5.css:436, 3 cols; 2 cols at <=1080px, 1 at <=680px):
   Review (`deck.enabled`, else an empty `<div aria-hidden>` slot holder,
   game-app.tsx:5087), Journal, Grown-ups. At 768 and 1024 it is 2 cols →
   Grown-ups orphaned. That orphan was recorded in #242 and deferred.
4. Card variants differ by class: `hv5-split hv5-stack hv5-case` (game
   cards: 16:9 film on top), `hv5-spot` (spot cards: full-bleed square or
   400/269 art). So the two grids have different picture ratios and
   card heights (measured in the pack).
5. `<=680px` everything stacks to one column; no orphan on phones, but
   the cards are tall (400–640px each).

## Where Things Live

| What | File:line |
| :--- | :--- |
| Screen switch / callbacks | `src/components/game-app.tsx:3341, 3437, 3457, 3478, 3784, 3818, 3843` |
| GeoDetective "Editions" (top-left) | `src/game/loop/LoopScreen.tsx:943-945` |
| GeoDetective solved panel "Back to editions" | `src/game/loop/LoopScreen.tsx:2213-2215` |
| Cold Trail "← All games" | `src/game/coldtrail/TrailScreen.tsx:497-499` |
| Cold Trail load-fail "← Back" | `src/game/coldtrail/TrailScreen.tsx:199-201` |
| Why Learn picker "Back to Home" (bottom) | `src/subjects/shared/SubjectPicker.tsx:134-140` |
| Subject case "Back to Home" ×3 | `src/subjects/shared/SubjectCase.tsx:90-96, 169-175, 180-186` |
| Region list "Editions" | `src/components/game-app.tsx:6345-6347` (`RegionList`) |
| Run HUD "Editions" / "Exit review" | `src/components/game-app.tsx:8137-8139`, `src/game/review-deck.ts:134` |
| Run pool error "Back to editions" | `src/components/game-app.tsx:6619` |
| Challenge picker "Back" | `src/components/game-app.tsx:3736-3738` |
| Info pages "← Back to the game" | `src/components/grownups/info-page.tsx:14-17` |
| `.mode-screen` shell | `src/styles.css:1994-2013` |
| Home grids | `src/components/home-v5.css:175, 213, 436, 1059-1066, 1123-1126, 1183-1196` |
| Home card markup | `src/components/game-app.tsx:4860-5137` |
| Card pictures | `src/assets/home-v5/card-media.ts`, `src/components/card-film.tsx` |

## Gotchas

- 15 e2e specs select these buttons by their current text (list in the
  pack, §6). Any rename must update them in the same change.
- "Back" inside a sub-step (state list → country list at game-app.tsx:3843,
  preview sheets at 3702, 7926, 8046) is "one step back", not "home".
  Those should not get the home label.
- "Exit review" replaces "Editions" during a review session and is
  defined in `REVIEW_DECK_COPY` (review-deck.ts:134); it also ends the
  review. Whether it gets the home label is a seat question.
- `?scale=1` no longer changes the home page: Why Learn ignores the flag
  since the subjects launch (game-app.tsx:1335-1338). Measured identical.
- The deck-disabled placeholder `<div aria-hidden>` keeps a grid slot
  empty on purpose; removing it changes the grid.
- `.mode-screen::before` is `position: fixed`; full-page screenshots show
  the gradient only behind the first viewport. That is a capture
  artifact, not a page bug [inferred].
