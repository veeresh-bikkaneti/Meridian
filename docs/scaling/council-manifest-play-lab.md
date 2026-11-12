# COUNCIL CONSENSUS MANIFEST — SCALE PLAY MOCKUP (/play-lab)

**Branch:** `mockup/scale-play`  
**Date:** 2026-11-12  
**Protocol:** `docs/ops/agent-council-protocol.md` (Tier 2 deliberation)  

## 1. ATDD Acceptance Scenarios (Councilor A)

- **Scenario 1 (Skill Constellation Interaction):**
  - *Given* a player on a capable device with `MotionTier="full"`,
  - *When* they navigate to Flow B ("Atlas of Skills"),
  - *Then* an interactive 3D celestial constellation displays with subtle starfield drift and glowing stars matching their age band, and dragging spins the constellation with smooth inertia.
  - *And* tapping a star smoothly lerps the camera toward it and brightens its connecting dependency lines.

- **Scenario 2 (Historical Journal 3D Globe):**
  - *Given* a player on Flow B inspecting the Journal World Globe,
  - *When* they interact by dragging or tapping a pin,
  - *Then* the globe spins with atmospheric glow, and tapping a pin smoothly centers the globe on that pin's coordinates and opens the corresponding case evidence dossier.

- **Scenario 3 (Physics 3D Predict-See Simulation):**
  - *Given* a child inspecting `physics:arrive:equal-steps` and predicting Cart A,
  - *When* the race commences,
  - *Then* the carts traverse the 3D track with wheels visibly turning and dust particle trails, crossing the glowing finish line where a celebratory starburst announces Cart A's arrival.

- **Scenario 4 (Reduced Motion / Flat Tier Strict Fallback):**
  - *Given* a device or user with `prefers-reduced-motion: reduce` or `MotionTier="flat"`,
  - *When* navigating `/play-lab`,
  - *Then* zero Three.js WebGL contexts are created, no requestAnimationFrame loops execute, and clean accessible 2D views are presented without motion.

- **Scenario 5 (WebGL Lifecycle & Disposal Invariant):**
  - *Given* repeated navigation between Flow A, Flow B, and problem cards,
  - *When* any 3D scene unmounts,
  - *Then* all geometries, materials, textures, requestAnimationFrame loops, and DOM/window event listeners are fully disposed, preventing WebGL context exhaustion.

- **Scenario 6 (Docker Local Serving):**
  - *Given* the built Pages artifact in `dist/client/`,
  - *When* served locally via Docker container,
  - *Then* requests to `http://localhost:8080/play-lab` and `http://localhost:8080/Meridian/play-lab` return HTTP 200 with proper SPA fallback to `_shell.html`.

## 2. TDD Test Specification (Councilor B)

- **Target Unit Test File:** `src/play-lab/play-lab.test.ts`
  - Tests covering age-group filtering, 6 answer derivations, current-year math, bridge links, and motion-tier selection.
- **Target Browser Spec:** `tests/e2e/play-lab.spec.ts`
  - Test 1: AgePicker modal prompt when unset and dismissal on save.
  - Test 2: Tabbed candidate flows (Flow A vs. Flow B) and robots noindex.
  - Test 3: All 6 real interactions solve correctly and render Bridge Cards.
  - Test 4: Reduced motion renders flat tier with zero WebGL overhead.
- **Docker Verification:**
  - Verify container builds cleanly, binds port 8080, and serves `/play-lab` with HTTP 200 OK.

## 3. Scope Boundary & Invariants

- **Protected Files (Strictly Untouched):**
  - `src/game/data/**` (place data — Card Rule 5 invariant)
  - `package.json`, `package-lock.json`
  - `vite.config.ts`, `playwright.config.ts`
  - Root `BRANCH_STATUS.md`, `docs/knowledge/graph.json` (Integrator-only)
- **Permitted Footprint:**
  - `src/play-lab/**` (scenes, components, data adapter, styles, unit tests)
  - `tests/e2e/play-lab.spec.ts`
  - `docs/scaling/play-lab-mockup.md`, `docs/scaling/council-manifest-play-lab.md`
  - `docs/branch-status/mockup-scale-play.md`
  - `Dockerfile`, `docker-compose.yml`, `nginx.conf` for local Docker serving

## 4. Epistemic Baseline & Adversarial Findings (Councilor C)

- **Dependencies:** Strictly zero new npm packages; uses bundled `three` 0.160.0. No `three-stdlib`, `@react-three/fiber`, or `@react-three/drei`. `[measured]`
- **DPR Cap:** Capped at 1.5 across all WebGL renderers (`Math.min(window.devicePixelRatio || 1, 1.5)`). `[measured]`
- **Disposal Audit:** Identified that `ProblemCard.tsx` must track and dispose `cartsPredictSeeScene` handle on unmount and choice change. `[measured]`
- **Drag Threshold:** Drag interaction on 3D scenes must use a movement threshold (> 5px) to prevent accidental pin/star clicks during spins. `[inferred]`
- **Card Content Invariant:** No fabrication; `src/play-lab/data.ts` strictly normalizes rows from `docs/scaling/**`. `[measured]`

## 5. Arbiter Approval (Chair)

- **Status:** APPROVED
- **Execution Token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- **Unresolved Objections Carried:** None (all Councilor C conditions integrated into design).

