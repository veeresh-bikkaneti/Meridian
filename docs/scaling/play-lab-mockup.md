# Play Lab Mockup: Scale Features Preview (/play-lab)

## Overview & Mission

On 2026-11-10, the owner stated the driving vision for scaling Meridian across subjects:
> *"most children dont understand why they learn division and multiplication, trigonometry and algebra. we want to help them see the application from early age."*

Every screen and interaction in this mockup prioritizes **the real problem first** ("why do I need this?") and the skill second. The mockup lives on the hidden route **`/play-lab`** (unlinked from Home, with `<meta name="robots" content="noindex">`) to let the owner and reviewers interactively evaluate and decide between two candidate presentation paradigms.

---

## The Two Candidate Flows

### Flow A: "Case File" (Holmes & Watson)
- **Concept:** Reuses the Holmes & Watson detective pair rigs (`HolmesRig`, `WatsonRig`) as cross-disciplinary investigative mentors.
- **Problem Delivery:** Holmes opens the case docket with the item's `why` hook as the primary mystery ("Forty coins are spilled on the shop counter...").
- **Resolution & Transfer:** When the child solves the problem, Watson steps forward with the **Bridge Card** ("You just used this in..."), highlighting how the skill operates across other subjects (e.g., economics, physics, geography) with an animated brass thread connecting the domains.
- **Journals Integration:** Historical journals appear as "Case Evidence" dossiers (such as the Lincoln Memorial construction investigation).

### Flow B: "Atlas of Skills" (New Shell Preview)
- **Concept:** A celestial and cartographic visualization previewing the future scale shell.
- **Subject Shelf:** Horizontal atlas cards representing Mathematics, Physics, Chemistry, Social Studies, and General Knowledge.
- **3D Skill Constellation:** Built with Three.js (0.160 dynamic import). Each unit item is a star; dependencies (`buildsOn`) draw connection lines; stars matching the child's age band (`7-10`, `10-18`, `18+`) glow in bright brass (`#e8b64c`), while other age bands are dimmed.
- **Journal World Globe:** A Three.js interactive 3D globe plotting journal clips at their exact geographical coordinates (`place.lat`, `place.lon`) with brass pins. Tapping any pin or star opens its problem card.

---

## Real vs. Mocked Matrix

| Feature | Real (Functional) | Mocked / Stubbed | Details |
| :--- | :--- | :--- | :--- |
| **Route & Shell** | Real | — | Hidden route `/play-lab`, `<meta name="robots" content="noindex">`, tabbed switcher between Flow A and Flow B. |
| **Curriculum Data** | Real | — | All 135 unit items from `docs/scaling/**` loaded through single adapter `src/play-lab/data.ts`. |
| **Age Profiling** | Real | — | Uses `getAgeGroup()` from existing profile; includes working `AgePicker` modal to switch between 7-10, 10-18, and 18+. |
| **Interactive Items (6)** | Real | — | 6 complete, verifiable interactions with objective-derived answers and validation: Math (skip-count), Physics (carts 3D race), Chemistry (ice/water), Social Studies (bus clock), General Knowledge (dynamic clock math), Journal (Lincoln Memorial 2-step). |
| **Other Unit Items** | Partial | Mocked interaction | Displays true `why` hook, objective, and standard code; interaction shows "Coming soon" stamp. |
| **Bridge Connections** | Real | — | Parses `useElsewhere` across all items, draws animated brass thread across subjects. |
| **Three.js Scenes** | Real | — | Three.js dynamically loaded, full context disposal, DPR capped at 1.5, 3 tiers (Full 3D, Lite CSS, Flat). |
| **Journal Videos** | Staged | Video files (.mp4) | The `.mp4` renders do not exist yet; video slot shows poster, place, and real caption lines from `.vtt`. |
| **Audio** | Silent / Reused | No new audio | No new audio files added; Holmes/Watson voice safety invariant preserved. |

---

## The 6 Playable Interactions

1. **Mathematics (`math-number:groups:skip-count`)**:
   - *Why Hook:* "Forty coins are spilled on the shop counter. Counting them one by one takes ages and slips; counting in 5s is quick."
   - *Task:* Tap the next count by 5s (`35 + 5 = 40`).
   - *Transfer:* Economics (counting coins and making change).

2. **Physics (`physics:arrive:equal-steps`)**:
   - *Why Hook:* "Two carts leave for the same line. One moves 3 tiles each step. The other moves 1 tile each step. Which cart reaches the line first?"
   - *Predict-See Contract:* Child predicts Cart A; Three.js 3D track simulation plays the race in real time, Cart A arriving first.
   - *Transfer:* Geography (walkers taking longer equal steps along map paths).

3. **Chemistry (`chemistry:states:solid-liquid`)**:
   - *Why Hook:* "The ice pop is hard in the cold and drips when the room is warm. What changed it?"
   - *Task:* Distinguish between solid ice and liquid water under temperature shifts.
   - *Transfer:* Geography (glaciers and sea ice on the globe).

4. **Social Studies (`social-studies:route:trip-clock`)**:
   - *Why Hook:* "The bus drives 40 km every hour and the museum is 120 km away. Will you be back before the lunch bell?"
   - *Task:* Calculate whole hours for 120 km at 40 km/h (3 hours).
   - *Transfer:* Math (division sharing) and Physics (speed = distance / time).

5. **General Knowledge (`general-knowledge:mixed:opera-years-ago`)**:
   - *Why Hook:* "A postcard says the Sydney Opera House opened in 1973. How many years ago was that? Counting back one year at a time takes ages and slips; subtracting is quick."
   - *Task:* Dynamically computes `currentYear - 1973` at play time from device clock; never hard-coded.
   - *Transfer:* Geography and architecture timelines.

6. **Journal (`great-leaders:lincoln-memorial`)**:
   - *Why Hook:* "Work on the Lincoln Memorial began in 1914. It was dedicated in 1922. How many years did it take to build?"
   - *Two-Step Task:* Step 1 calculates 8 years (1922 - 1914); video slot presents captions ("Inside, Lincoln sits, carved in marble"); Step 2 checks retrieval ("He sits").
   - *Transfer:* History (monuments) and Math (calendar year differences).

---

## Animation, Motion Tiers, and Guidance Used

- **Motion Tiers:**
  - `Full`: WebGL Three.js 3D constellation, rotating 3D globe with lat/lon pin coordinates, and 3D physics carts track.
  - `Lite`: 2D interactive SVG constellation, 2D atlas globe disc, and CSS transform animations.
  - `Flat`: Static accessible layout with no animations. `prefers-reduced-motion: reduce` strictly collapses to Flat.
- **Theme & Curves:**
  - Consumes `--atlas-*` color tokens (`#10222a`, `#e8b64c`, `#f0e7d2`, etc.).
  - Follows `motion-tokens.css` curves (`--ease-soft-land`, `--ease-snap-settle`, `--ease-pop-over` only for celebrations).
- **A11y:** Tap targets >= 44x44 px, keyboard reachable, focus rings visible, AA contrast.

---

## Open Questions for the Owner

1. **Flow Preference:** Does the storytelling character-driven approach of **Flow A (Case File with Holmes & Watson)** feel more natural for younger learners, or does the spatial exploration of **Flow B (Atlas of Skills with 3D Constellation)** provide a better long-term navigation model?
2. **Subject Prioritization:** Which subject should be the primary pilot following Geography — Mathematics (number & applied) or Science (Physics & Chemistry)?
3. **Bridge Card Timing:** Should the Bridge Card appear immediately upon solving an item, or at the end of a round / case session?

