# Meridian scaling plan — K-12 review and priority order

**Date:** 2026-11-10 · **Branch:** `claude/k12-plan-review` (from `main` `2688d8b8`)
**Status:** PROPOSED for owner review. Docs only; no feature code. Nothing here
reverses an owner decision (religion, pilgrimage and mythology removed; no
biology; scientist seat = disclosed Spatial Data Scientist; educator gate on
every spec; only math definition work and the Phase 0 split approved to build).

Companion files:
- `k12-learning-design-standard.md` — the shared learning bar every spec cites.
- `educator-gate-rubric.md` — how a real human educator signs the gate in under
  an hour, without an educator persona.
- `agent-instructions.md` — shared, agent-neutral rules every builder reads once.
- `branch-prompts.md` — one copy-paste prompt per branch, in this priority order.

---

## 1. Branch check (remote, 2026-11-10)

All 17 tracked branches exist on the remote and their heads match the tracker,
with one typo: the tracker lists `feat/phase0-shell-split` at `acafacc44`; the
remote head is **`acafac44`**. The three deleted journal branches (pilgrimage,
religions & epics, mythology) are gone, as ordered. The math spec names its
build branch `feat/math-spec` but the work packets call it `feat/math-tricks`;
the spec already flags this, and it still needs a decision before build.

## 2. What is strong already

- Fact discipline: every claim sourced with confidence, UNVERIFIED logged.
- Lazy-load law, load budgets as proposals until measured, and the 7-stage
  release pipeline with real play-testing and a screen recording.
- Math definition: Common Core codes, a machine-verified answer gate, an error
  taxonomy, exact-answer judging that a test walks.
- Science: predict-then-see as the core verb, and the council's call that "a
  quiz with science words is not a science game".
- `main` already ships a computable mastery rule, a Leitner-lite review deck and
  a local-only privacy guarantee. That is the right foundation for K–12.

## 3. Top findings (in order of impact)

1. **No spec says what a child can do afterwards.** None of the 13 subject or
   journal specs carries a learning objective per item, and the journal and
   subject specs cite no standards (only the definition specs do). Without that,
   the educator has nothing to sign against and the game cannot show learning.
   → Fixed by the objective template in the standard (§2).
2. **The journal is video-only: kids watch, the game never checks.** No journal
   spec has a question after the clip. Watching is not learning.
   → One read-aloud retrieval check after every clip, feeding the review deck (§4).
3. **New subjects risk building a second learning system.** Math specifies its
   own error-type review deck while `main` already has one.
   → New subjects extend `learning.ts` and `review-deck.ts`; error types become a
   deck filter (§4).
4. **Science is specced as "24 videos" but its own core verb is a simulation.**
   Predict-then-see is exactly what three.js does well and video cannot: the
   child changes the ramp and watches the result.
   → Science and physics items become interactive three.js scenes; video only
   where a real place or real footage is the point (§5).
5. **No accessibility floor in any scaling spec.** Captions appear once each, but
   there is no read-aloud rule for pre-readers, no tap alternative for drags, no
   reduced-motion behaviour, no timer rule.
   → WCAG 2.2 AA block in the standard (§6), checked by axe in Playwright.
6. **three.js and motion have no device plan.** The owner wants a rich 3D,
   motion-heavy game and also wants old devices to work (the Meridian lighter-mode
   work). Nothing defines how scenes degrade.
   → Full / Lite / Flat tiers with learning parity and CI frame-time checks (§5).
7. **The educator gate has no way to be passed.** The seat is vacant and no
   persona exists, so everything is blocked indefinitely.
   → A written rubric any real teacher can complete with an agent-prepared
   evidence pack. The gate stays human; it just becomes passable.
8. **"K–12" vs "5th grade and up".** The owner's goal is K–12, but every new
   subject spec is 5th grade and up, and K–2 / 3–5 content is waiting on owner
   question Q2. This is the biggest scope decision open (D1).
9. **"No politics" collides with great leaders, freedom fighters, world wars and
   modern world.** These topics are political by nature. The rule needs a working
   definition so agents do not each guess (D2).
10. **Model names are hard-coded in `AGENTS.md` and
    `docs/ops/agent-council-protocol.md`.** The owner wants the plan agent-neutral
    (any capable agent may build it). Changing `AGENTS.md` is never Tier 0, so it
    is listed as its own work item (P0-4) with proposed wording, not edited here.
11. **Specs drift from the house stack and theme.** `main` already has age bands
    (`5-7`, `8-10`, `11-13` in `src/game/age-profile/bands.ts`), named motion
    curves (`motion-tokens.css`), a dynamically imported three.js globe,
    particle caps, `CardFilm`, a journal player and a fixed movie recipe. The
    scaling specs never point at them, so each builder would reinvent them.
    → Standard §5.1 lists the stack every agent must reuse; new libraries need
    the owner's word.
12. **Per-question host video clips are the costliest part of the plan.** Each
    question needs a produced clip; at K–12 scale that is thousands of clips,
    heavy downloads on old devices, and high production cost for a free project.
    A real-time animated host scene costs far less (D3).

## 4. Owner decisions needed (smallest unblock first)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Bands for new subjects | (a) keep 5th+ for all new subjects; (b) add `5-7` and `8-10` tracks per subject now; (c) geography + journal serve the existing `5-7` / `8-10` / `11-13` bands now, new subjects start 5th+ and add younger bands later; plus, in every option, whether to add a `14-18` band to `bands.ts` | **(c)**, and add `14-18` when the first high-school content is signed — K–12 reach today through what already works. |
| **D2** | What "no politics" means | (a) no historical political figures at all; (b) historical figures allowed with neutral, sourced facts only, no present-day parties, elections or living politicians' views | **(b)** — otherwise four journal specs cannot exist. |
| **D3** | Host wrap-up format | (a) produced video clip every question (current rule); (b) real-time animated host scene by default, produced clips for journal stories only | **(b)** — same "short cartoon" feel, a fraction of the cost and size, works offline and on Flat tier. |
| **D4** | Educator route | Find one volunteer teacher per subject group (math; science; humanities) to use the rubric | Start with math, since it is already approved to build. |
| **D5** | Math build branch name | `feat/math-spec` or `feat/math-tricks` | Either; just pick before build. |
| **D6** | P8 journal pick | 3 or 6 entries | Hold until D2 is ruled. |

## 5. Priority order

Ranked by what unblocks the most learning per unit of cost. Items marked
**approved** are already approved by the owner; the rest stay GATED.

### P0 — now (unblocks everything else)

1. **Finish the Phase 0 shell split** (approved, `feat/phase0-shell-split`).
   Per-subject chunks are the prerequisite for lazy-loading three.js and for
   every load budget. Measure the baseline the budgets need.
2. **Finish the math definition** (approved, `feat/math-definition`), adding the
   standard's block: objective per mode, the "confident" bar, review-deck hookup
   (error types as a filter), motion tiers for the play surface.
3. **Educator gate: recruit one real teacher and run the rubric on math** (owner
   action, D4). Agents prepare the evidence pack.
4. **Make agent instructions model-neutral** — own PR under AGENTS.md eval
   discipline. Proposed swap: "the orchestrator uses the strongest model the
   builder can afford; worker roles use the cheapest capable model as
   subagents; design calls go to a council of experts reviewing summaries, not
   bulk output." No vendor names.
5. **Motion and device-tier spec** (spec only): Full / Lite / Flat detection,
   reduced-motion behaviour, scene disposal, frame-time CI on the existing
   weak-device branch. Every 3D subject depends on it, so it comes before any
   subject build.

### P1 — next (after the math sign-off)

6. **Math v1 build** — Times Table Races on the quiz loop, with the verification
   gate, motion tiers and review-deck hookup. First new game; proves the
   pattern for every later subject.
7. **Journal retrieval checks** — add one read-aloud check per existing journal
   clip, feeding the review deck. Cheap (data rows, no new video) and turns 106
   existing stories into learning.
8. **Science P7: one three.js predict-then-see system** (ramps and friction is a
   good first pick: clear cause and effect, NGSS physical science, renders well
   on all three tiers). After the science educator signs.

### P2 — later (each after its own sign-off)

9. Social studies (C3-aligned, map-based — reuses the geography engine).
10. Journal specs, after D2: people & places, technology, modern world, world
    wars, WWII monuments, great leaders, freedom fighters — each with objectives
    and retrieval checks.
11. Chemistry P6 (shares the predict-then-see engine with P7 — build second).
12. P4 algebra-physics (inherits math's judging and engine).
13. General knowledge (lowest learning density; mostly recall).

### Parked

- Tiny-model use (P9), 5–7 content in new subjects until D1, earth science and
  astronomy until the owner scopes it. Religion, mythology, pilgrimage and
  biology stay out.

## 6. Spec gap table — what each spec must add

Legend: **O** objectives · **S** standard codes · **R** retrieval check ·
**D** review-deck hookup · **A** accessibility block · **M** motion tiers ·
**P** privacy line · ✓ already present · ✗ missing.

| Spec (branch) | O | S | R | D | A | M | P | Spec-specific note |
|---|---|---|---|---|---|---|---|---|
| Math (`feat/math-spec`) | ✗ | via definition | n/a | own deck → reuse | ✗ | ✗ | ✓ | Fold error-type replay into the existing deck. |
| Math definition (`feat/math-definition`) | ✗ | ✓ CCSS | n/a | ✗ | ✗ | ✗ | ✗ | Approved; add the standard block here first. |
| Science (`feat/science-spec`) | ✗ | via definition | n/a | ✗ | ✗ | ✗ | ✓ | Recast the 24 "videos" as interactive three.js scenes. |
| Physics (`feat/physics-spec`) | ✗ | ✗ | n/a | ✗ | ✗ | ✗ | ✓ | NGSS PS codes; set count. |
| Chemistry (`feat/chemistry-spec`) | ✗ | ✗ | n/a | ✗ | ✗ | ✗ | ✓ | NGSS PS codes; safety framing for "combine-and-watch" (never at-home instructions). |
| Science definitions (`feat/science-definitions`) | partial | ✓ | n/a | ✗ | ✗ | ✗ | ✗ | Add tiers and parity rule to the P7 brief. |
| Social studies (`feat/social-studies-spec`) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | C3 Geography + History codes. |
| General knowledge (`feat/general-knowledge-spec`) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | Mixed review of other subjects may serve better than new trivia. |
| Humanities definitions (`feat/humanities-definitions`) | partial | partial | ✗ | ✗ | ✗ | ✗ | ✓ | Needs D2 definition of politics. |
| Journal: WWII monuments | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Tone rules good; add C3 History code + check. |
| Journal: great leaders | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Blocked on D2. |
| Journal: freedom fighters | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Blocked on D2. |
| Journal: people & places | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Best journal fit for geography; do first. |
| Journal: world wars | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Needs D2. |
| Journal: modern world | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Needs D2. |
| Journal: technology | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Low risk; good second journal. |
| Phase 0 split (`feat/phase0-shell-split`) | n/a | n/a | n/a | n/a | n/a | sets chunks | ✓ | Approved; add the 3D chunk budget once measured. |

Every spec's captions line counts as a start on **A**, not the full block.
Each spec branch adds the standard's §9 checklist block when it next moves;
this branch does not edit the 17 spec branches directly.

## 7. How to build this cheaply (agent-neutral)

- One orchestrator plans and reviews; **cheaper models run as subagents** for
  tests, mechanical edits, data-row generation, readability checks and visual
  checks.
- A **council of experts** (architect, game designer, a11y, adversarial skeptic,
  plus the human educator rubric) reviews each spec once, from a summary and the
  diff, not the whole repo.
- Content scales as data: problem banks, objectives, standard codes and journal
  checks are versioned rows with validators, so adding a topic is mostly a cheap
  validation job, not a long generation prompt.
- Free to run: static hosting, open-licensed three.js assets, no servers for
  learning data, no paid services.
