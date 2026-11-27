# Implementation Plan: Interactive 3D Lesson Models for Meridian

**Status:** PROPOSED (2026-11-26). Any dependency/skill installation (`npx skills add`, `pip install`, `playwright install`) must pass the `AGENTS.md` §12 install audit gate (purpose, source, known vulnerabilities, owner approval) before execution.

## 1. Objective

Enhance Meridian's Science, Math, and Earth Science lessons with interactive, browser-native 3D models using **Inkworks** (`Moh4696/inkworks-skill`).

- **Zero Runtime Cost:** Inkworks generates standalone, zero-build-step Three.js pages with Three.js vendored locally. No external APIs, tokens, or paid MCP endpoints are used at build time or runtime.
- **Hosting Compatibility:** Generated modules output static HTML/JS/CSS assets that deploy directly with Meridian on Cloudflare Workers (`public/interactives/<lesson-slug>/`) and embed cleanly inside lesson pages via responsive `<iframe>` containers.

---

## 2. Agent Setup & Installation Instructions

When starting work on interactive lessons, verify whether the Inkworks skill and template kit are installed in the workspace. If missing (and after owner approval under `AGENTS.md` §12), run:

### A. Install the Agent Skill

```bash
npx skills add Moh4696/inkworks-skill
```

*(Fallback if Node 22.20+ is unavailable)*:

```bash
curl -fsSL https://raw.githubusercontent.com/Moh4696/inkworks-skill/main/install.sh | bash
```

### B. Optional Automated QA Dependencies

To run headless browser checks (`smoke.py`) across mobile, tablet, and desktop viewports:

```bash
pip install -r ~/.inkworks-skill/requirements.txt
python3 -m playwright install webkit
```

---

## 3. Content Routing: When to Use Inkworks

Inkworks models **systems driven by a single continuous cycle or driver angle** (`0` to `2π` or repeating phases). Before building a 3D model for a lesson, classify the topic:

| Subject Area | Use Inkworks (`Moh4696/inkworks-skill`) | Do Not Use Inkworks (Use Static/Exploded 3D or 2D SVG) |
| --- | --- | --- |
| **Science & Biology** | Beating heart (cardiac cycle), lung/diaphragm breathing, water cycle evaporation-condensation loop, levers, pulleys, gears, pumps, turbines | Static cell anatomy, rock types, static solar system snapshot |
| **Earth Science & Geography** | Day/night Earth rotation, axial tilt & seasons orbit, moon phases, tectonic subduction/convection cycles, tidal bulges | Static country/continent maps, elevation relief maps, flags, static landforms |
| **Math** | Unit circle (`sin`/`cos` wave generator), rotating angle/protractor explorer, gear ratios & fractions, periodic pendulum motion | Static geometric solids, bar charts, arithmetic drills |

---

## 4. Meridian UX & Kid-Friendly Adaptation Rules

Every generated Inkworks model must be tailored for school-age learners rather than industrial engineers:

1. **Default to `figure` Layout:** Embed URLs with `?m=<lesson-slug>&layout=figure`. This hides the dense engineering title block, pressure-volume plots, and zone borders, displaying only the clean 3D model card, clear side labels, dashed leader tags, and simple play/pause/step controls.
2. **Optional Deep-Dive Toggle:** For older students or curious learners, provide a secondary link/toggle to open `?m=<lesson-slug>&layout=sheet` to expose live readouts, speed sliders, and the scrubbable cycle chart.
3. **Age-Appropriate Copy:**
   - Keep part labels short (1–3 words, e.g., `"Left Ventricle"`, `"Piston"`, `"Moon"`).
   - Write phase descriptions in active, concrete sentences explaining *what is happening right now* in that phase.
4. **Performance & Sizing:**
   - Keep primitive geometry lightweight so models render smoothly at 60 fps on school Chromebooks and mobile devices.
   - Ensure iframe containers use `aspect-ratio: 16 / 10` (or `min-height: 420px`) with `loading="lazy"`.

---

## 5. Step-by-Step Workflow for Adding a Lesson Model

Whenever creating or upgrading a lesson that matches Section 3:

1. **Scaffold the Project:**

```bash
python3 ~/.inkworks-skill/skills/inkworks/scripts/new_project.py \
  public/interactives/<lesson-slug> \
  --name <lesson-slug> \
  --from starter \
  --layout figure
```

2. **Build the Mechanism File:**
   - Edit `public/interactives/<lesson-slug>/<lesson-slug>.js` (modeled after `starter.js`, `engine.js`, and `pump.js` in `skills/inkworks/`).
   - Define all 3D parts using built-in `kit.js` primitives (toon materials with crisp ink outlines, hidden-line ghosts for internal chambers, particle streams for airflow/water/blood, gears, and springs).
   - Express every moving part as a closed-form function of the single cycle driver angle so scrubbing, slow-motion, and phase-stepping stay exact.

3. **Preview & Verify:**
   - Serve locally with `python3 public/interactives/<lesson-slug>/serve.py 9081` and inspect `http://localhost:9081/?m=<lesson-slug>&layout=figure`.
   - Run `smoke.py` to verify zero console errors and proper control layout across desktop, tablet, and mobile viewports.

4. **Embed in Meridian Lesson:**
   - Add the iframe embed to the target lesson component/page:

```html
<div class="lesson-interactive-card">
  <iframe
    src="/interactives/<lesson-slug>/?m=<lesson-slug>&layout=figure"
    title="Interactive 3D: <Lesson Title>"
    loading="lazy"
    style="width: 100%; height: 460px; border: 0; border-radius: 12px;"
  ></iframe>
</div>
```

---

## 6. Initial Target Lessons Backlog

Prioritize building these four models first to establish reusable patterns across Meridian's core subjects:

1. **`seasons-and-orbit` (Earth Science / Geography):** Earth orbiting the Sun with a fixed `23.5°` axial tilt; phases highlight Solstices and Equinoxes while showing sunlight angle changes.
2. **`unit-circle-waves` (Math):** A rotating radius arm on a 3D unit circle projecting live sine and cosine waves as the angle scrubs from `0°` to `360°`.
3. **`how-lungs-breathe` (Science / Biology):** Ribcage expansion and diaphragm contraction driving particle airflow in and out of translucent lung lobes (`Inhale` / `Exhale` phases).
4. **`simple-gear-train` (Science / Physics):** Driver gear meshing with a driven gear with a slider to change tooth count ratios, demonstrating mechanical advantage and rotation speed.
