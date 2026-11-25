# RE Pack — 3 sites: design, animation & interactive-lesson patterns
Date: 2026-11-24 · Method: reanimate skill (frame capture + inspect.json) + first-hand source inspection (HTML/CSS/JS fetched and read).
Labels: **[measured]** = number came out of a capture, a track fit, or the site's own shipped CSS/JS. **[inferred]** = read from code/structure but not timed in a capture.
Fidelity note: motion-faithful evidence only; no site was cloned, no mockups built.

Capture environment caveat (applies to all captures): this VM reaches the web through an authenticated MITM egress proxy that headless Chromium cannot use directly, so captures ran through a proxy-patched *copy* of the skill's capture.ts (local CONNECT forwarder on 127.0.0.1:8899 + ignoreHTTPSErrors). The installed skill is untouched; the patched copy is in `tooling/` next to this file. One transient navigation failure on the first L2P hover attempt; re-run succeeded.

---

## 1. Lesson2Play — https://lesson2play.com/
"Learning, gamified" — destination-card home for kids/teens learning games.

### Design
- **Layout pattern [measured]**: centred column, max-width 1160px (`--maxw`). Home = centred hero (logo mark ~150px, H1, one-line sub) → **2×2 grid of "door" cards** (gap 20px, single column on mobile) → footer strip. Whole home is one screen of choices; no scrolling sales copy.
- **Palette [measured, from `:root` in site.css]**:
  - Ink/edge navy `#26335e`, soft ink `#56608a`, paper `#ffffff`
  - Accents: pink `#ff8fab`, mint `#3ccf8e`, lemon `#ffd43b`, lilac `#b197fc`, sky `#74c0fc`, orange `#ffa94d`; hot pink for H1 accent word `#ff6b9a`
  - Door fills: Play = sky `#74c0fc`, Build = lemon `#ffd43b`, Commission = `#d9d4ff` (pale lilac), DIY = deep navy `#1f3a66` with white text + a faint blueprint grid background (26px grid lines, white 8% alpha)
  - Page background: vertical gradient sky `#9ad8ff → #c9e6ff → #f4dff0 → #ffe…` (home variant is paler: `#f7f9ff → #eef3ff`); each section page gets its own background gradient (per-page theming via `body[data-page=…]`)
- **Type [measured]**: display **Fredoka** 500/600/700 (headings, buttons, kickers), body **Nunito** 600/700/800 — rounded, chunky, kid-legible. H1 `clamp(34px, 6.5vw, 62px)`, line-height 1.02.
- **Component inventory [measured]**:
  - **Door card**: 5px solid ink border, radius 32px, hard offset shadow `0 10px 0 var(--edge)` (no blur — "sticker/book" shadow), min-height 300px, internal grid rows auto/1fr/auto, right 46% reserved for art. Contains: pill **kicker** (13px uppercase Fredoka, white pill, 3px border, radius 999), H2 `clamp(24px,3vw,34px)`, one-sentence pitch (Nunito 700, 85% ink), pill **CTA** ("Play free ▶", "Build free ✨", "See services →", "Open the workshop 🛠️") with its own 4px border + `0 5px 0` hard shadow.
  - **Art treatment**: screenshot/photo art sits bottom-right, rotated −6°, 4px border, radius 20px, drop-shadow `0 8px 0 rgba(38,51,94,.18)`, deliberately overflowing the card edge (−6px/−26px offsets); a mascot "pup" robot character overlaps the art on Build/DIY cards.
  - **Pack cards** (games pages): white card, 4px border, radius 24px, `0 8px 0 rgba(38,51,94,.14)` shadow; toggle switches are chunky pills (50×30, 3px border, knob slides `left .15s`).
  - **Floating action button** (contact): 58px circle, ink bg, white 3px border, hard shadow.

### Animation
| # | Animation | Trigger | What moves | Duration / easing | Loop? | Evidence |
|---|---|---|---|---|---|---|
| 1 | Background shape drift (`drift1`) | Page load, always | Fixed full-page layer of pastel shapes (circles, rounded squares, rings, triangle, plus) at 55% opacity: translate up to (26,−34)px + scale 0.95–1.06 through 4 keyframe stops | 16s ease-in-out, infinite **[measured: keyframes + CSS in inspect.json]** | Loop | inspect.json keyframes `drift1` exact stops; site.css `.bgs i` |
| 2 | Shape drift variant (`drift2`) | Always | Same layer, other shapes: translate (−36,28)→(30,44)px | 13–19s ease-in-out, infinite, some with negative delays (−3s…−8s) so the field is mid-motion on load **[measured]** | Loop | keyframes `drift2`; per-shape durations in site.css |
| 3 | Shape spin (`spin1`/`spin2`) | Always | Squares/triangle/plus rotate ±360° while translating in an arc | 14–22s, infinite **[measured]** | Loop | keyframes `spin1`, `spin2` |
| 4 | Door hover lift | Hover on a door card | Card translateY 0 → −5px; hard shadow grows 10px → 15px offset | Declared transition 150ms **[measured: CSS]**; track fit on captured hover: visible motion ≈213ms, expo-like curve cubic-bezier(0.19,1,0.22,1) **[measured: easing.ts on track.json]** | Once per hover | captures/l2p-hover |
| 5 | Button/card micro-press | Hover/click on packs, pills, FAB | Small translate/shadow shifts | Transitions 120–150ms **[measured: CSS]** | Once | site.css `.pack`, `.cls`, `.cfab-b` |
| 6 | FAB menu pop (`cfabIn`/`cfabOut`) | Click floating button | Menu scales 0.4→1 + rises 20px with slight overshoot easing `cubic-bezier(.2,.9,.3,1.2)`; exit 160ms ease-in | In 220ms, out 160ms **[measured: keyframes in inspect.json]** | Once | inspect.json keyframes |
| 7 | Reduced-motion path | `prefers-reduced-motion` | All animations/transitions disabled site-wide (`animation:none!important`) **[measured: CSS]**; back-button navigation also suppresses entrance motion (`.back-nav` class from site.js) | — | — | site.css, site.js |

No entrance/stagger animation on the doors themselves: the home is static on load except the ambient background field. Motion budget is spent on ambience + hover feedback, not on choreography.

### Lesson / interactive patterns (named, reusable)
- **P1 — Destination doors**: the home page *is* the menu — 4 giant colour-coded doors, each = audience + promise + one CTA ("Tap your destination."). No feature lists; choosing a door is the only job of the page.
- **P2 — One-sentence pitch per door**: each card carries exactly one benefit sentence + a time/effort promise ("2 minutes, no tech skills", "Sign in once, play them all").
- **P3 — Mascot overlap**: a recurring character (pup robot) physically overlaps card art, tying different sections into one world.
- **P4 — Per-section world theming**: each destination re-skins the whole page background (games = sky gradient, DIY = dark blueprint navy), so entering a door feels like entering a place.
- **P5 — Ambient shape field**: a slow, low-opacity drifting geometric background keeps a static page feeling alive without distracting from the choice.

---

## 2. RoverKit — https://roverkit.vercel.app/#parts
"Build & simulate a robot car" — a 10-step guided build; #parts is Step 1, "Gather the parts".

### Design
- **Layout pattern [measured]**: app shell, 1440×900 capture: top bar (logo, board switcher Arduino UNO/ESP32, language, settings) → two-pane body: **left = workbench** (3D mat, three.js WebGL2 canvas 920×693 **[measured: inspect.json canvases]**) with zoom/layer controls; **right = lesson pane** (~430px) with step kicker "GET READY · STEP 1 OF 10", big condensed title, one-paragraph brief, then the bill of materials. Bottom = **step strip**: horizontal step cards (01 Parts, 02 Motors, 03 Decks, 04 Driver, …) with thumbnail, number, name, per-step progress bar; Back / Next buttons (Next = yellow primary).
- **Palette [measured, from `:root`]**:
  - Paper `#f6f3e8`, card `#faf7ee`, tile `#f9f6ec`, borders `#e7e2d4`/`#e9e4d8` — warm cream "workbench paper"
  - Ink navy `#0e1932`, soft `#2b3346`, muted `#5d6272`
  - Accent system as 3-step gradients: yellow `#ffdd84 → #fdd062 → #f6c047` (primary actions, wheel), navy `#284a70 → #1e3a5c → #13203a` (buttons, terminal), green `#2fb38f → #1f9a78` (ticks, success, live dots)
  - Mat green (in 3D scene): cutting-mat green with white grid + labels **[observed in capture]**
- **Type [measured]**: display **Oswald** (condensed, uppercase, letterspaced — "technical manual" voice), UI **Roboto Condensed**, mono **JetBrains Mono** for code/values. Self-hosted woff2.
- **Component inventory [measured]**:
  - **BOM row** (`.row--check`): 26px checkbox (2px border `#d6cfbb`, radius 8px), navy quantity chip ("1×", "4×", "2×"), part name + spec text; hover reveals an **eye icon** (`.row__eye`, opacity transition 150ms).
  - **Step card** (`.stepcard`): 194×78 tile with sprite-sheet thumbnail, number + name, green **tick badge** (top-right, scale/opacity in) and a **progress bar** whose fill width is `calc(var(--p) * 100%)`, transition width 300ms.
  - **Part detail view** (`.partview`): slide-in pane, `.22s ease-out pane-in` **[measured: CSS]**.
  - **HUD/pills/flow**: status pills with pulsing live dot (1.2s ease-in-out pulse), a flowchart overlay ("flow") whose nodes light up live as the simulated program runs, minimap (2D canvas 187×187).
  - **Loader**: the logo wheel (SVG) rotating — `loader-turn` 1.8s linear infinite **[measured: inspect.json animations + CSS]** — over a cream veil that fades out (opacity .4s).

### Animation
| # | Animation | Trigger | What moves | Duration / easing | Loop? | Evidence |
|---|---|---|---|---|---|---|
| 1 | Loader wheel | App load | Logo wheel SVG rotates 360° around its hub (transform-origin at hub centre) | 1.8s linear infinite **[measured]** | Loop until loaded | inspect.json animations; CSS `.loader__wheel` |
| 2 | UI entrance (`ui-in`) | Pane/step load | HUD items, tool groups, pills fade/slide in | 320ms cubic-bezier(.16,.84,.3,1) **[measured: CSS + inspect.json (320, 1 iteration)]** | Once | rover CSS |
| 3 | **Hover-to-locate** | Hover a BOM row | In the 3D mat, the hovered part renders in full colour (wheels glow yellow) while **every other part fades to a translucent wireframe ghost**; eye icon fades in on the row | Row/eye transitions 150ms **[measured: CSS]**; 3D fade is shader/material-driven, exact ms not measurable from DOM track — **[observed in captured frames: rover-hover/final.png]** | While hovering | captures/rover-hover |
| 4 | **Tick-off** | Click a row's checkbox | Checkbox fills green gradient + white tick draws in; row text mutes; header counter increments **0/11 → 1/11**; step card's progress bar fills to match; on the mat the ticked part stays solid while others ghost (hover state) | Checkbox/tick transitions 150–200ms; progress bar width 300ms **[measured: CSS]**; end state **[measured: rover-tick/final.png]** | Once per part (toggle) | captures/rover-tick |
| 5 | Part detail pane (`pane-in`) | Click a part (row or on mat) | Detail pane slides/fades in | 220ms ease-out **[measured: CSS]** | Once | rover CSS `.partview.is-entering` |
| 6 | Deny shake (`deny`) | Invalid drive/action input | D-pad shakes | 300ms **[measured: CSS keyframes `deny`]** | Once | rover CSS |
| 7 | Live pulses | Simulator running | Status dot pulses (1.2s), flow-chart live dot (1.5s), live nodes highlight as code executes | 1.2s / 1.5s ease-in-out infinite **[measured: CSS]** | Loop | rover CSS |
| 8 | Micro-interactions | Everywhere | Buttons/menus/lang picker: 80ms press transforms, 140–280ms cubic-bezier(.16,.84,.3,1) opens; tick in language menu pops with overshoot cubic-bezier(.3,1.6,.5,1) | 80–300ms **[measured: CSS]** | Once | rover CSS |

### Lesson / interactive patterns (named, reusable)
- **P6 — Checklist-with-counter (BOM tick-off)**: a parts/materials list where every row is tickable and a header counter (0/11) + per-step progress bar make completion visible at all times. Ticking is the lesson's first act of agency.
- **P7 — Hover-to-locate (list ↔ scene binding)**: hovering a list row highlights exactly that object in the 3D scene and ghosts everything else — the list and the picture are two views of the same state.
- **P8 — Flat-lay mat**: all parts laid out labelled on a cutting mat, like a real workbench photo — the "scene" is the real-world arrangement, not an abstraction.
- **P9 — Step strip journey**: the whole 10-step build is always visible as a bottom strip of thumbnail cards, each carrying its own progress; Next-step button is the single primary action ("Next: Motors →").
- **P10 — Click-for-details**: any part (list or scene) opens a detail pane — depth on demand, list stays scannable.
- **P11 — Simulate-after-build**: later steps drive the same rover in a simulator (drive pad, live flowchart of the program, sensor HUD) — the checklist's parts become the simulation's parts.

---

---

## 3. Every Joule — https://iamtechartist.com/every-joule/
"Every Joule: a 3D physics book about energy" — 10 interactive lessons; the book app lives in an iframe at `iamtechartist.com/Apps/every-joule/` (WordPress wrapper page around it).

### ⚠️ Capture status — what was measured and what was blocked
- **Measured**: the app's splash/loader screen (frame + 5 animations with exact keyframes, below), its fullscreen canvas, fonts, and — from the app's own shipped JS chunks — its full energy-type colour/pattern system and its interaction mechanics (predict / flap / quiz / stamp / ink are all named state in the code).
- **Blocked, exactly**: the book's live 3D pages never rendered in headless Chromium on this VM. (1) The skill's `--gl --clock virtual --assets` capture timed out at 280s, producing only the app's script assets. (2) A real-time capture reached only the splash screen after a 6s wait. (3) A 45s-wait capture errored with no output. Root cause: the app requires GPU-accelerated WebGL (its own banner on the wrapper page says so: "It draws live 3D in your browser, which needs graphics acceleration"); this VM has only SwiftShader software GL on 1.5 shared CPUs, and the three.js scene never finished loading. **Consequence: in-book animation timings (page turns, diagram lift-off duration/easing, 3D object motion) are NOT in this pack — nothing below invents them.** Rows based on code are labelled [inferred].

### Design
- **Layout pattern [measured/inferred]**: a book, not a page — fullscreen canvas (`canvas#c`, 1440×900 in capture) presenting two-page spreads; text lessons with embedded 3D diagrams that "lift off the page". Splash first: centred brand mark + thin progress line on near-black.
- **Palette**:
  - Splash/ink background `#0d0b12` **[measured: pixel sampled from captured frame]**; pattern-stroke ink `#1c2433` **[measured: colors chunk]**.
  - **Energy-type system — the book's core visual language [measured: `colors-*.js` chunk, verbatim]**: each of the 8 energy stores has ONE colour + ONE pattern glyph, used everywhere that store appears (diagrams, jars, bars):
    | Store | Colour | Pattern |
    |---|---|---|
    | Kinetic | `#2f7bff` | chevrons |
    | Gravitational | `#8a4dff` | bars |
    | Elastic | `#ff3fb4` | zigzag |
    | Thermal | `#ff7a1c` | waves |
    | Chemical | `#26c75a` | hexagons |
    | Magnetic | `#e8233a` | arcs |
    | Electrostatic | `#18c4dc` | plus signs |
    | Nuclear | `#ffcf1a` | rings |
  - Store examples the book asks about **[measured: stores chunk]**: a cyclist, a book on a high shelf, a stretched spring, a hot drink, an AA cell, a pair of magnets, a rubbed balloon, the Sun.
- **Type [measured]**: **Source Serif 4 Variable** (200–900) for book text — a real book serif; **Caveat Variable** (handwriting) for the student's own ink — predictions/annotations are rendered as handwriting, visually separating *the book's voice* from *the student's voice*.
- **Component inventory [inferred from shipped code]**:
  - **Flaps**: hinged panels over diagrams (`<details data-flap>`, `flapOpen` state, hinge geometry in code) — the "diagram lifts off the page" device.
  - **Predict widget**: per-page prediction state (`setPredict(question)`, pick an answer, `clearPredict`) rendered in ink/handwriting.
  - **Quiz flaps**: `data-qflap` elements with a live quiz score (`quizScoreText`).
  - **Stamps**: completing/proving earns a stamp (`stamp: null → earned`, "(stamp earned)" string in code).
  - **Margin ink**: margin-note layer (`margin: []`, `inkDirty` redraw flag) — the page accumulates the student's marks.
  - **Jars**: energy stores shown as jars to fill/light — chapter activity string in code: *"Light every jar: find all eight stores."*
  - **Scene modules** (one JS chunk per lesson scene) **[measured: asset list]**: spring, bounce, ramp, spill, stream, lathe, cutaway, cards, numbers, stores, things — i.e. each lesson is a bespoke 3D scene, not a template. Chapter titles found in code: "Energy stores", "Up and down". Wrapper copy: "ten energy lessons, from springs to power stations".

### Animation
| # | Animation | Trigger | What moves | Duration / easing | Loop? | Evidence |
|---|---|---|---|---|---|---|
| 1 | Splash logo in (`ta-inL` / `ta-inR`) | App load | Two halves of the pendulum-triangle logo slide in from (−10px,−8px) and (+10px,−8px), fading in | 900ms **[measured: inspect.json animations + exact keyframes]** | Once | captures/joule-inspect |
| 2 | Splash fade (`ta-fade`) | App load | Wordmark/subtitle fade to opacity 1 | 800ms **[measured]** | Once | inspect.json |
| 3 | Glint (`ta-glint`) | App load | A light sweep travels −140px → 460px across the logo, completing by 55% then holding | 2400ms **[measured: keyframes]** | Once (per load) | inspect.json keyframes |
| 4 | Progress run (`ta-run`) | While loading | Loading bar fill sweeps translateX(−100%) → 560% | 1300ms, infinite **[measured: inspect.json (iterations ∞) + keyframes]** | Loop | inspect.json |
| 5 | Diagram lift-off (flaps) | Student opens a flap / reaches a diagram | A hinged panel lifts off the printed page, revealing/animating the 3D diagram beneath | **Not measured — capture blocked (see above).** Mechanism (hinged flap, open state) is [inferred] from code only | Once per flap | main chunk: `flap`, `hinge:`, `flapOpen` |
| 6 | 3D scene motion (spring/bounce/ramp/spill/stream/lathe scenes) | Lesson interaction | Live three.js physics scenes the student manipulates | **Not measured — capture blocked.** Existence and per-lesson bespoke scenes are [measured] from the asset/chunk list; no timings claimed | Interactive | assets list in captures/joule-gl/assets |

### Lesson / interactive patterns (named, reusable)
- **P12 — Predict → Test → Prove**: every lesson page asks for a prediction *first* (committed, in the student's own "ink"), then lets them run the 3D test, then the proof — the prediction is state the page remembers and confronts.
- **P13 — One concept, one colour + one glyph, everywhere**: the 8 energy stores keep the same colour AND pattern in every diagram, jar and bar — a student can track "where the energy went" by colour/pattern alone, across all 10 lessons.
- **P14 — Lift-off diagrams (flaps)**: print-style page, but any diagram can hinge up off the page into a manipulable 3D scene — the book metaphor carries the interactivity instead of a dashboard UI.
- **P15 — Stamps for proof**: completing the prove step earns a stamp on the page — progress is a mark *in the book*, not a score in a header.
- **P16 — Find-all-eight (collection activity)**: "Light every jar: find all eight stores" — a spot-them-all hunt across example objects (cyclist, AA cell, rubbed balloon…) teaches classification by searching, not by being told.
- **P17 — Two voices, two typefaces**: book = serif; student = handwriting font. Whose words are whose is never ambiguous.

---

## Adaptation raw material — pattern → what it would give Meridian's Why Learn topics page
Facts only. No design decisions, no mockups — those belong to the meridian chat.

| Pattern (source) | What it would give a Why Learn topics page |
|---|---|
| P1 Destination doors (Lesson2Play) | The topics page becomes a small set of giant colour-coded topic doors (one per subject/topic) instead of a list — choosing a topic is the page's only job |
| P2 One-sentence pitch + effort promise (Lesson2Play) | Each topic card carries exactly one benefit sentence + a time promise ("2 minutes") — a parent/kid can judge a topic in one glance |
| P3 Mascot overlap (Lesson2Play) | Holmes/Watson art overlapping topic cards would tie Why Learn to the detective world the rest of the game uses |
| P4 Per-section world theming (Lesson2Play) | Each topic could re-skin the page background on entry, so a topic feels like a place, not a filter |
| P5 Ambient shape field (Lesson2Play) | A slow drifting shape background (13–22s loops, 55% opacity) keeps a static topics page feeling alive at near-zero attention cost |
| Door hover lift −5px / 150ms + hard-shadow sticker style (Lesson2Play) | A concrete, measured hover recipe: 5px solid borders, radius 32px, blur-free offset shadows — tactile "card you can pick up" feel |
| P6 Checklist-with-counter (RoverKit) | A "what you'll need / what you'll learn" list per topic with tick-off rows and an n/N counter — completion is always visible |
| P7 Hover-to-locate (RoverKit) | Hovering a list row highlights the matching object in an illustration/map beside it (and ghosts the rest) — list and picture as two views of one state |
| P8 Flat-lay mat (RoverKit) | Topic content laid out as labelled objects on a surface (like parts on a mat) instead of paragraphs |
| P9 Step strip journey (RoverKit) | A topics page could show the whole learning path as a bottom strip of thumbnail step cards, each with its own progress bar and one yellow "Next" action |
| P10 Click-for-details pane, 220ms ease-out (RoverKit) | Depth on demand: topic rows stay scannable; details slide in as a pane instead of a page change |
| P12 Predict → Test → Prove (Every Joule) | A Why Learn topic could open by asking the kid to predict an answer, then show the experiment/fact, then the proof — prediction is remembered and confronted, not a throwaway quiz |
| P13 One concept = one colour + one glyph (Every Joule) | If topics/concepts recur across pages (e.g. energy types, map skills), a fixed colour+pattern per concept lets kids track it visually across the whole product |
| P14 Lift-off diagrams / flaps (Every Joule) | A static topic illustration could hinge open into an interactive scene — interactivity arrives inside the reading surface, not via a separate "game" screen |
| P15 Stamps for proof (Every Joule) | Finishing a topic's prove step could stamp the page — progress as a mark in the material, collectible across topics |
| P16 Find-all-eight hunt (Every Joule) | A topic could teach classification by hiding N examples in a scene to find ("find all 8…"), instead of listing them |
| P17 Two voices, two typefaces (Every Joule) | The game's voice vs the kid's own answers could be visually separated by typeface (book serif vs handwriting) |

## Artefacts in this folder
- `captures/l2p-home/` — Lesson2Play doors capture (frames, video, inspect.json, track.json, filmstrip sheets)
- `captures/l2p-hover/` — door hover capture + track (easing fit in this pack)
- `captures/rover-inspect/` — RoverKit #parts inspect (three.js canvas, animations, final frame)
- `captures/rover-hover/` — hover-to-locate capture (frames + final frame showing ghosting)
- `captures/rover-tick/` — tick-off capture (counter 0/11 → 1/11 in final frame)
- `captures/joule-inspect/` — Every Joule splash capture (animations, keyframes, final frame)
- `captures/joule-gl/` — the timed-out GL capture attempt; only the app's script assets were saved (kept as the blocker evidence)
- `tooling/` — proxy-patched copy of the reanimate capture scripts used on this VM (installed skill untouched)
