# Lane D — P14 lift-off, cheap form: a CSS hinge on the Math clue scene

Status: SPEC (2026-11-24). No production code. Source pattern: Every Joule
P14 (hinged flaps lift diagrams off the page — mechanism [inferred] from EJ
code: `<details data-flap>`, `flapOpen`, hinge geometry; the book's live 3D
NEVER rendered for capture, so no EJ timing/easing is claimed or copied).
Verdict of record: ADAPT to the cheap form only — a CSS hinge over the
existing film/scene substrate, Math scene pilot. The bespoke-3D form stays
SKIP (per-scene treadmill, software-GL audience).

## What the kid sees

In a Math case, the clue scene (`ClueScene`, rendered by MathCase's scene
hook above the ClueCard in `SubjectCase`) arrives **covered by a flap**: a
page-styled panel lying over the scene area, hinged at its top edge,
carrying one line — **“Lift the flap to see it move”** — and the scene's
setup label (the description's existing `labelSetup`, e.g. “A bill bar
waits, ready to be shared.”).

- **Trigger:** tap/click anywhere on the flap (the whole flap is one
  ≥44px button). On hover-capable pointers, hover raises the flap 8°
  as an affordance hint — hover never opens it, never reveals content.
- **The lift:** the flap rotates up around its top hinge —
  `transform: rotateX(-72deg)` with `transform-origin: top center`,
  **380ms ease-out**, fading to 0 opacity in the last third — revealing the
  live scene beneath, which starts its existing setup performance as it
  does today on mount. One-way per item: once lifted, the flap stays
  lifted (a small “flap” tab at the scene's top edge can re-cover it —
  optional, spec'd as a toggle for kids who want to replay the reveal;
  re-covering never resets the scene or the case).
- **Solved phase:** if the case solves (or the lose reveal fires) with the
  flap still down, the flap lifts itself as part of the solved beat — the
  act-3 performance is never hidden behind an unlifted flap. The lift uses
  the same 380ms hinge unless reduced motion applies.

## Behaviour rules

- **The text clue is never under the flap.** The flap covers ONLY the scene
  box. `ClueCard` (item.why) renders below, uncovered, always — a kid who
  never lifts the flap can read the clue, take the hunch (Lane B), and
  answer the case in full. The scene is enrichment, exactly as today
  (scene-less items are complete cases).
- **The answer is never gated.** AnswerCard renders and accepts picks
  regardless of flap state. The flap is not a step in the flow.
- **No sound.** The hinge is silent; it never autoplays, claims the voice
  channel, or touches the read-aloud prefs. (EJ's flap feel is unmeasured;
  no audio is invented for it.)
- **Reduced motion** (`usePrefersReducedMotion`, the hook SubjectCase
  already holds): NO rotation — the flap cross-fades instantly (opacity
  swap, ≤1 frame of transition) or is simply absent with the scene shown.
  The still gates that already apply to the scene (Save-Data /
  deviceMemory ≤2 → scene renders its still) apply unchanged beneath.
- **Per item:** flap state resets with `nextCase` (new item = new flap,
  down). Within an item, state survives phase changes (hunch/answer/solved).

## Components / files touched (delta-only)

| File | Delta |
|---|---|
| `src/subjects/shared/SceneFlap.tsx` (NEW) | The ONE flap component: props `label`, `children` (the scene), `reduced`, `forceOpen` (solved beat). Owns flap state + hinge markup. Generic — any subject's scene can adopt it later by wrapping, Math first. |
| `src/subjects/shared/SubjectCase.tsx` | Wraps the `scene(...)` render in `<SceneFlap>` ONLY when a staging/production flag for the subject is on (pilot gate: Math passes `flapScene` through its wrapper, the `loseReveal`-hook precedent — passing the prop is the opt-in; other subjects' render is byte-identical). Passes `forceOpen={scenePhase === "solved"}`. |
| `src/subjects/math/MathCase.tsx` | Passes the opt-in prop. One line + prop type. |
| `src/styles.css` | `.wl-flap` rules under `.subject-case-screen`: hinge transform, 380ms ease-out, perspective on the wrapper, reduced-motion swap, forced-colors fallback (flap = plain panel, border, no 3D). |
| Tests | SceneFlap unit (states, forceOpen, reduced), SubjectCase render (flap only for opted-in subject), targeted e2e: lift → scene visible; solve with flap down → flap lifts; reduced-motion context → no transform. |

**Ownership:** one `SceneFlap`, wrapping the scene hook's output — the scene
components (`ClueScene` and future scenes) are NOT modified and know nothing
about flaps. Reuse = another subject wraps its scene the same way.

## Accessibility

- The flap is a real `<button>` spanning the scene box: ≥44px (it is the
  whole box), labelled “Lift the flap to see the scene move”, `aria-expanded`
  tracks state, `aria-controls` names the scene region.
- The scene region is `aria-hidden` while covered ONLY if its content is
  decorative-duplicative of the clue text (true for Math scenes today: the
  clue text carries the content). If a future scene carries unique content,
  the flap may not cover it until an equivalent text path exists — spec'd
  as a hard precondition for reuse beyond Math.
- Keyboard: the button is in tab order where the scene sits; Enter/Space
  lifts. Focus is never moved or trapped by the lift.
- Reduced motion and forced-colors paths above are acceptance-tested, not
  aspirational.
- The flap's label text ≥4.5:1 on the flap ground (atlas card pairing).

## NEGATIVE list — must NEVER happen

1. The flap covering, delaying, or gating the text clue, the hunch step,
   the answer card, or the result band — in any state, at any viewport.
2. The solved/lose performance playing hidden behind a closed flap.
3. Rotation/3D motion under reduced motion; the flap existing at all in a
   form that blocks the scene's still under Save-Data/low-memory gates.
4. Sound on lift, a voice claim, or any autoplay.
5. A per-subject flap fork, flap logic inside `ClueScene`, or the flap
   wrapping anything except a scene render.
6. Hover opening the flap or revealing scene content on hover alone.
7. The flap changing the case's layout height between down/lifted states
   (the wrapper reserves the scene's box — no content jump for the clue
   or answer below it).
8. Any WebGL/3D dependency — the hinge is CSS transforms over the existing
   2D scene, full stop (that is what “cheap form” means).

## Acceptance criteria

- Renders: Math case with a scene shows the flap down on arrival; tap lifts
  in ~380ms; scene's setup performance visible after lift; solve with flap
  down auto-lifts into the solved performance.
- Non-regression: subjects without the opt-in render byte-identical case
  screens; Math items without scenes render no flap and no wrapper.
- Gates: reduced-motion context shows zero rotation (computed transform =
  none/instant swap); forced-colors shows a bordered panel; no-clipping at
  320×568 (the rotated flap stays inside the wrapper's box —
  `overflow: hidden` on the wrapper during the lift).
- Playthrough (with Lane B's gate): tap-mode Math case at 390px — flap
  lift by real tap, clue readable throughout, answer never blocked.

## Effort estimate

**~4 hours build + tests** (one small wrapper component, one opt-in prop,
one CSS block) + ~1 hour targeted gates. No content, no assets, no audio.
Rollout to another subject = wrap its scene + pass the prop (~30 min) once
its scenes meet the text-equivalence precondition.

## ADDENDUM — owner direction 2026-11-24 15:32 CST (the scene is played, not watched)
The hinge/flap now opens onto an INTERACTABLE scene: the player moves things to see, play, and solve (reference: Every Joule's manipulable diagrams). Math pilot prototype: the coin case — drag coins into groups of five; the grouping count builds as the player plays; solving by doing feeds the same answer path (answer-blindness and the phase machine unchanged — the scene reports only solved/not, per the existing scene-hook contract). The explanation in the result band is a motion video with per-band cuts (Lane B addendum). Scope guard: ONE case prototyped first in staging; per-item interactive authoring priced from that prototype before any rollout number is quoted.
