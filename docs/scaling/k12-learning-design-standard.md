# K-12 Learning Design Standard — the bar every scaling spec meets

**Status:** PROPOSED (review branch `claude/k12-plan-review`). Owner approval is
the per-PR merge word. Nothing here reverses an owner decision already made:
religion, pilgrimage and mythology stay out; biology is back except topics on
sexuality and gender identity (owner, 2026-11-10); the scientist
seat stays with the disclosed Spatial Data Scientist persona; every spec stays
GATED on educator sign-off; only the math definition work and the Phase 0 split
are approved to build.

**Why this file exists.** The spec branches are strong on fact verification,
lazy loading and release gates. They are thin on the learning side: no spec
names what a child can *do* after a clip or round, the journal and subject specs
cite no standards, none ties play to the spaced review that `main` already has,
none states an accessibility floor, and none says how three.js and motion scale
down on old devices. This standard is one shared section every spec cites
instead of re-inventing it 13 times. Each spec adds only its own deltas
(see the gap table in `k12-plan-review.md`).

**Ground rules from the owner that this standard carries everywhere**
- Free for everyone. No charging, ads, paywalls, in-app purchases, loot boxes,
  or revenue features of any kind. Prefer zero-cost hosting, open-licensed
  libraries and assets, and low running cost.
- Agent-neutral. Any capable coding agent may build from these specs. Specs name
  roles and budgets, never a vendor or model.
- Rich in three.js and motion, with lighter fallbacks for older devices.

---

## 0. The headline goal: how subjects connect, and how they are applied

Owner, 2026-11-10: "we want to teach them how they connect and applied."

This is the first objective of every unit, above its subject objective:

> **The child can show how this idea connects to the subject before it, and use
> it in one real-life situation.**

- Every unit has a **bridge** (what it builds on from the earlier subject) and an
  **application** (where it is used in real life and in the environment), per
  `subject-progression-map.md`.
- The application is **playable, not told**: ideally a three.js scene where the
  child uses the skill in a real setting (a ramp on a hillside, a mixture in a
  kitchen, a measurement on a river), with the Flat tier as a 2D equivalent.
- The game sees it: the bridge and application rounds are scored like any other
  round and feed the same mastery record.

## 1. Audience and bands (owner ruling D1, 2026-11-10)

Owner, 2026-11-10: **"age 10 and above; adults can play too."** All new work
targets ages 10 and up, roughly grade 5 through high school, and must also be
fun for adults. Nothing new is made for under-10s.

**Reuse the band system `main` already has.** `src/game/age-profile/bands.ts`
defines bands as data (`5-7`, `8-10`, `11-13` today), with read-aloud mode,
tap-target size, timers, quiz length and map labels per band. New subjects add
rows to that table; they do not invent a second band system. Band labels and
parent-facing strings are agreed copy: new labels are the owner's to name.

| Band for new work | Grades (approx.) | What a new subject must respect |
|---|---|---|
| `11-13` (existing; also serves 10-year-olds) | 5–8 | Grade-level text; read-aloud available; predict-then-test and multi-step tasks; timers optional. |
| *proposed* `14-18` | 9–12 | Escape-room cases, labs, real challenge, humour that is not childish (the specs' existing 14–18 register). |
| *proposed* adult / open | — | Same content at the hardest tiers; host narration optional and skippable; no "kids" framing in the play itself; scoring and leaderboards stay local (no accounts). |

Rules from the ruling:
- New subject specs target `11-13` and up. The existing "5th grade and up"
  scope in the math, science and journal specs already fits; keep it.
- Adults are a real audience, not an afterthought: every mode needs a top
  difficulty tier that challenges an adult, and copy that reads as smart, not
  childish. The card voice stays warm.
- The live game's existing `5-7` and `8-10` bands are not removed by any spec.
  Whether to retire or keep them in the shipped game is a separate code change
  and an open owner question.
- Adding `14-18` and an adult row to `bands.ts` is a code change (Tier 2 under
  AGENTS.md: `src/game/` data); specs describe them, the Phase 0 / math build
  adds them.
- Reading level is checked, not asserted: host lines and on-screen text are run
  through a readability formula (for example Flesch-Kincaid grade) and must sit
  at or below the band's top grade. The check is a script in CI, not a review
  opinion.

## 2. Learning objectives — required on every clip, round and mode

Every item that a child plays or watches carries one objective in this form:

> **After this, a child in band [B] can [observable verb] [content], shown by [what the game sees].**
> Standard: [code or UNVERIFIED]

- Observable verbs only: *identify, locate, sort, predict, explain, compare,
  compute, estimate*. Never *know, understand, appreciate* — the game cannot see
  those.
- "Shown by" names the in-game evidence (a correct pin, a correct prediction, a
  correct sort). If nothing in the game can observe it, the objective is
  rewritten or the item is a story only, labelled as such.
- Standards to cite (verify the code with a live source per the existing
  verification protocol; no source = UNVERIFIED, never asserted):
  - Math: Common Core State Standards for Mathematics (already proposed in the
    math definition spec).
  - Physics, chemistry and biology: NGSS performance expectations (physical and
    life science). Codes on reproduction, heredity and sexual development are
    excluded (owner ruling, §7a).
  - Geography, history, social studies, journal stories: the C3 Framework
    (Geography and History dimensions) and, for geography, the National
    Geography Standards.
  - The topic map must also say which curriculum it follows when the
    world-view rule needs a non-US equivalent.

## 3. The core game loop (learning lives inside the loop)

Every mode follows one loop. A spec that cannot map its play onto it is not
ready:

1. **Hook** — a 3–5 second question or mystery ("Which ramp wins?").
2. **Predict / attempt** — the child commits an answer *before* seeing it
   (retrieval and prediction are where the learning happens).
3. **See** — the world responds: the ball rolls, the pin lands, the number
   checks. Motion shows the cause, not just a tick.
4. **Explain** — the host wrap-up retells why (the owner's host rule). One or
   two sentences at the band's reading level.
5. **Try again or move on** — a miss offers one immediate retry with a hint,
   then goes to the review deck.

**Motivation rules (kids, not casinos).**
- Reward mastery and effort, never time-on-app. Badges come from the existing
  mastery states (Explored / Growing / Mastered in `docs/learning-outcomes.md`),
  not from streak pressure.
- No variable-ratio rewards, no loot boxes, countdowns only as an opt-in, no
  daily-login punishment, no "you'll lose your streak" nags. A streak may exist
  but never shames or resets in a way that feels like loss (the existing
  "a load failure must never reset a streak" rule stays).
- Feedback is specific and kind: say what was right, what to look at, and that
  effort grows skill. Never "Wrong!" alone. Reuse the existing growth copy bank.
- Difficulty adapts gently: two misses in a row on one skill drops support one
  rung (more scaffold, fewer choices); two confident hits raises it. Any change
  to tiers, bands, weights or hint defaults is an owner decision under AGENTS.md.

## 4. Mastery and spaced practice — reuse what `main` already has

`main` already ships a computable mastery rule and a Leitner-lite review deck
(`src/game/learning.ts`, `src/game/review-deck.ts`; design in
`docs/learning-outcomes.md` §3 and §11). New subjects **extend these, they do
not build parallel systems**:

- Each new subject maps its item to the same Explored / Growing / Mastered states,
  with a subject-specific "confident" bar (math: exact answer without a hint;
  science: correct prediction on first try; journal: correct answer to the
  post-clip check).
- Misses enter the same deck on the same `[0, 1, 3, 7, 14, 30]`-day ladder. Math's
  error-type replay (from the math spec) becomes a deck *filter*, not a second
  deck.
- Interleave: a review round mixes 2–3 skills, not one skill drilled.
- Every journal clip ends with **one retrieval check** (a tap answer, read aloud,
  about something the clip showed). Without it, a clip is entertainment, not
  learning, and is labelled "story only".

## 5. Three.js, motion, and the device tiers

### 5.1 House stack and theme — reuse, do not add

Inspected on `main` `2688d8b8`. Every new subject builds with what is already
here. Adding a new animation, 3D, video, audio or UI library is a stop-and-ask
item for the owner.

| Need | Already in the repo — use this |
|---|---|
| 3D | `three@^0.160`, always **dynamically imported** (`import("three")` in `src/components/home-globe.tsx`; a test enforces no static import). Copy that pattern. |
| Maps | `maplibre-gl`, `d3-geo`, `topojson-client`, `world-atlas` / `us-atlas` (the quiz *is* the map). |
| UI motion | CSS transitions/keyframes on the named curves in `src/styles/motion-tokens.css` (`--ease-soft-land`, `--ease-snap-settle`, `--ease-glide`, `--ease-accel-exit`, `--ease-pop-over` for the one celebration overshoot only, etc.), guarded by `src/motionmaxxing.test.ts`. List and layout motion: `@formkit/auto-animate`. |
| Reduced motion | `usePrefersReducedMotion` hook (`src/hooks/`) plus the global collapse in `motion-tokens.css`; reduced motion shows a static globe disc. |
| Particles and celebrations | `ConfettiCanvas` (`confetti.tsx`) with `resolveParticleCap` (`particle-caps.ts`) for weak devices; `celebration-overlay.tsx`. |
| Characters | `characters.tsx`, the Storyteller, Grandpa and Comet (Comet is an emblem; read Handbook 03 before using any character). Characters host; new mascots need the owner. |
| Short films on cards | `CardFilm` (`card-film.tsx`): film / poster / still per card, band-aware, reduced-motion aware. |
| Journal video | `journal-player.tsx` + `journal-prefetch.ts`, manifest `public/videos/journal-manifest.json` validated in prebuild. Recipe in `docs/journal-movies.md`: 10 s, 1152×768, 24 fps, h264 + AAC, tap-to-play, no on-screen text, watercolor storybook style from the entry's still, storyteller narration, loudnorm −18 LUFS, limiter −1 dB, captions/VTT + transcript (`journal-transcripts.ts`). |
| Voice | Storyteller TTS pipeline (`scripts/render-storyteller-*.mjs`, Handbook 04); read-aloud preference in `age-profile/read-aloud-pref.ts`. |
| Sound effects | `src/game/audio/sfx.ts` — 100% Web Audio, zero audio files; "cartographic, inquisitive, brass-warm"; every sound has a visual equivalent; never chain `connect()`. |
| Type and look | Self-hosted Fraunces (display), Karla (body), Space Mono; v5 premium atlas home; Tailwind 4; `lucide-react` icons. |
| Motion proof | `scripts/record-motion-verify.mjs` screen recordings on the built app — no recording means the testing did not happen. |

Theme rules that carry into every subject: the card is the product and the game
is the vehicle; aged-atlas, cartographic, storybook warmth; one memorable hook a
kid can retell; motion settles softly and never overshoots except the one
celebration moment.

### 5.2 Motion as teaching, in three device tiers

Motion is a learning tool here: it should show cause and effect (a ramp, a
lever, a fraction cut, a pin flying to a place), not decorate. New 3D scenes
use the same dynamic-import, particle-cap and reduced-motion patterns as the
home globe and confetti, and the same easing curves for any 2D motion.

**Three tiers, chosen automatically at start and changeable by the player:**

| Tier | When | What renders |
|---|---|---|
| **Full** | WebGL2 available, ≥ 4 GB device memory hint, first frames hold ≥ 50 fps | three.js scenes with lighting, particles, and physics-driven motion. |
| **Lite** | WebGL available but weak device, or Full drops below 30 fps for 3 s | Same scenes, low-poly, no shadows or post-processing, capped at 30 fps, smaller textures. |
| **Flat** | No WebGL, `prefers-reduced-motion: reduce`, Save-Data, or player choice | 2D SVG/CSS with short, gentle transitions; every learning event still shows (the ball still reaches the bottom — as a stepped diagram). |

Rules:
- Learning parity across tiers: a child on Flat gets the same question, the same
  cause-and-effect information and the same scoring. A tier may change beauty,
  never content.
- `prefers-reduced-motion` is honoured: no parallax, no camera swoops, no
  flashing. Nothing flashes more than 3 times a second (WCAG 2.3.1).
- three.js is lazy-loaded per subject (the existing lazy-load law); nothing 3D
  loads on the home screen beyond the existing globe.
- Dispose geometries, materials and textures on scene exit; one renderer reused
  across scenes; pause rendering when the tab is hidden.
- Budgets are proposals until the Phase 0 baseline measures them, then they are
  CI gates: per-subject 3D chunk and asset weight, and a frame-time check on a
  throttled run in the existing weak-device CI branch (`ci/weak-device-test-in-ci`).
- Prefer real-time animation over pre-rendered video where the scene is a
  simulation: it is smaller to ship, works offline, is cheaper to produce and
  scales across tiers. Pre-rendered clips stay for journal stories (real places,
  real footage). Whether the per-question host wrap-up becomes a real-time
  animation instead of a video clip is an **owner decision** (D3), because the
  host rule is the owner's.
- Assets: open-licensed only (CC0 / CC-BY with credit, or made in-house), with
  licence recorded next to the asset. No paid asset stores.

## 6. Accessibility (WCAG 2.2 AA floor)

The existing floors stay and apply to every new mode: tap targets ≥ 44px,
text contrast ≥ 4.5:1, focus ring ≥ 3:1 on dark surfaces. Plus:

- Every clip has captions (VTT) and a transcript; every spoken prompt has a text
  equivalent; every text prompt can be read aloud.
- Every drag has a tap or keyboard alternative (WCAG 2.5.7). Every 3D control
  has a button equivalent; nothing requires precise pointer paths.
- Colour is never the only signal (correct/incorrect also uses shape and sound).
- Timers are optional and can be turned off in every band (WCAG 2.2.1); the
  existing no-timer rule for the live game's `5-7` and `8-10` bands stays.
- Screen-reader labels on every interactive element; the 3D canvas has a live
  region that announces what happened ("The ball rolled down the steep ramp
  first").
- Checked by automated scan (axe in the Playwright suite) plus the manual QA
  stage of the 7-stage pipeline.

## 7. Child privacy (COPPA-safe by design)

Restates the existing guarantee (`docs/learning-outcomes.md` §6) as a rule for
every new subject:

- No accounts, no names, no emails, no photos, no voice recording, no free-text
  fields that could take personal information, no persistent identifiers, no
  third-party scripts, no ad or analytics vendors.
- Learning records stay in `localStorage` on the device. No network call carries
  learning data.
- Funnel and crash events are aggregate and carry no identifier, no free text and
  no learning record.
- Anything that would collect or send a child's data is out of scope until the
  owner rules and a COPPA review is done — this is a stop-and-ask item.

## 7a. Content screen — no controversial topics (owner ruling D2, 2026-11-10)

Owner, 2026-11-10: "we dont want any contraversial topics like religion, lgbtq,
and other nonsense happinging in world politics."

As a rule for every item, clip, card, host line and quiz answer:

- **Out:** religion and religious practice; sexuality, sexual orientation and
  gender identity topics; current or contested political issues, parties,
  elections, ideologies, and living politicians' views; any topic the public
  is actively divided over.
- **In:** factual, age-appropriate events, places, people and achievements,
  told neutrally: what happened, where, when, what was built or discovered,
  sourced, without taking sides, praising or blaming a nation, group or
  ideology. War and history are told as remembrance (existing tone rules:
  no graphic detail, no battle re-enactment).
- **Historical people** (leaders, freedom fighters, inventors) are allowed when
  the story is their documented achievement or the place tied to it, not
  their politics. A figure whose story cannot be told without a contested
  political view is left out.
- **When in doubt, leave it out.** An item that fails the screen is dropped,
  not softened.
- The screen is checked twice: by the agent before writing (listed in the
  spec's UNVERIFIED/CUT log with the reason) and by the educator rubric
  (item 17a).

## 8. Agent-neutral build and token economy

These specs may be built by any capable coding agent. To keep cost low:

- **Roles, not models.** An orchestrator (the strongest model the builder can
  afford) plans, reviews and decides. Execution work — running tests, applying an
  agreed patch, mechanical edits, visual and playtest checks — goes to
  **cheaper models orchestrated as subagents**. Specs never hard-code a vendor
  or model name.
- **Council of experts** for design calls: a small panel of reviewer roles
  (architect, designer, game developer, educator rubric, adversarial skeptic)
  reviews the spec, not the full code dump. Councilors read summaries and diffs;
  only the seat whose call it is reads the raw file.
- **Token budget per task** follows AGENTS.md tiers; a spec states its tier.
- **Read once, summarise once.** Shared facts go in one notes file; agents read
  conclusions, not bulk output.
- **Generate content by data, not by prompt.** Problem banks, item metadata and
  objectives live in versioned data files with validators, so content scales by
  adding rows that a cheap check verifies, not by re-prompting.

## 9. Spec checklist — add this block to every spec

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Headline goal (§0): bridge to the previous subject + playable real-life application: [ ]
- Bands served: [ ] and why
- Objective per item, observable verb, "shown by": [ ]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [ ]
- Loop mapped: hook / predict / see / explain / retry: [ ]
- Mastery "confident" bar for this subject: [ ]
- Review-deck hookup (same deck, same ladder): [ ]
- Post-clip retrieval check (journal + any video): [ ]
- Motion tiers: Full / Lite / Flat described, learning parity stated: [ ]
- Accessibility: captions, tap alternative, no-timer default, SR live region: [ ]
- Privacy: no PII, no identifiers, local-only records: [ ]
- Content screen (§7a) passed; cut items logged with reason: [ ]
- Free: no revenue features; asset licences recorded: [ ]
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [ ]
```
