# Lane C — Visuals: P1 sticker skin + P13 colour token (+P4 via token) + P3 mascot narrow

Status: SPEC (2026-11-24). Mockup-first lane: NOTHING here builds until the
owner approves the composed mock screens (delivered with this spec set) in
all layouts. Source patterns: Lesson2Play P1 (destination doors — door recipe
[measured] from the RE pack: 5px solid ink border, radius 32px, hard offset
shadow `0 10px 0` no blur, hover lift −5px with shadow growing to 15px,
transition ~150ms, expo-like curve) and P4 (per-section theming); Every Joule
P13 (one concept = one colour + one glyph, everywhere [measured: EJ's 8-store
colour/pattern table]).

## Design decision that bounds the whole lane

The sticker recipe applies as a **skin on the existing cards** — the Living
Atlas card anatomy is settled (owner pick 2026-11-14) and its geometry does
not move. What changes is the card's *surface language*: border weight,
corner radius, shadow style, hover feel, and one colour token per subject.
If the mock shows the skin fighting the Atlas painting, the skin loses —
that is what the mock round is for.

## Tokens

### Subject colour token (P13, subject level)

ONE new field on the subject registry record, consumed everywhere the
subject's identity appears:

```ts
// src/subjects/registry.ts — SubjectModule gains:
color: string; // 700-shade hex; the subject's one colour, everywhere
```

Proposed colours (hue = identity; each is a 700-shade at ≥4.5:1 on white —
**build must re-verify against every atlas palette** the card sits on, and
may adjust lightness per palette while the HUE stays fixed, the same rule
`--atlas-brass-text-sm` already follows):

| Subject | Colour | Hex | Pairs with (existing Lucide glyph) |
|---|---|---|---|
| Math | blue | `#1d4ed8` | Calculator |
| Physics | violet | `#7c3aed` | Atom |
| Chemistry | emerald | `#047857` | FlaskConical |
| Social studies | amber | `#b45309` | Users |
| General knowledge | cyan | `#0e7490` | Globe2 |
| Journals | pink | `#be185d` | BookOpen |

- The glyph half of P13 already exists: `SUBJECT_ICONS` in SubjectPicker
  (Calculator/Atom/FlaskConical/Globe2/Users/BookOpen). Colour joins the
  existing icon — no new glyph system. **Concept-level glyphs (P13 full
  form) are DEFERRED**: they apply only where a concept family recurs across
  cases (Physics energy stores are the named candidate) and need their own
  content decision; nothing in this lane builds them.
- Consumption map (the token is set ONCE per surface, as `--subject-color`):
  picker card badge ground, stamp ring (Lane A), case-screen accent
  (`.subject-case-screen` scope reads the same var — this is P4's narrow
  form: the shared atlas wash stays, the subject's colour accents the clue/
  answer chrome), hunch accent (Lane B). Setting points: `SubjectPicker`
  card style, `SubjectCase` main element style (it already carries
  `data-testid="{subjectId}-case"`; the var rides the same element).

### Sticker skin tokens (P1 recipe, scaled to card size)

Doors are 300px marketing cards; Meridian's cards are smaller and denser.
The recipe scales, it does not transplant:

| Property | Door [measured] | Card today | Card sticker skin (proposed) |
|---|---|---|---|
| Border | 5px solid ink | 1px solid `--atlas-card-line` | **3px solid** ink (`--atlas-ink` on the active palette) |
| Radius | 32px | 18px | **24px** |
| Shadow | `0 10px 0`, no blur | soft layered blur shadows | **`0 6px 0` hard offset**, no blur, ink at 28% |
| Hover | −5px lift, shadow → 15px, ~150ms | −3px, 0.6s soft | **−5px lift, shadow → `0 10px 0`, 150ms ease-out** |
| Press | — | — | translateY(2px), shadow `0 2px 0` (tactile press) |
| Transition | 150ms declared | 0.6s | **150ms** on transform + shadow only |

## Application map (where each delta lands)

| Surface | File | Delta |
|---|---|---|
| Card skin | `src/styles.css` `.why-learn-card` block | Border/radius/shadow/hover/press per token table; spotlight pulse keyframes re-based on the hard shadow. |
| Card colour | `SubjectPicker.tsx` | Card style gains `--subject-color` from the registry record (rows already carry the module); badge span background = token. |
| Registry | `src/subjects/registry.ts` + 6 `index.ts` | `color` field + `isReleased` validation (hex shape). |
| Case accent (P4) | `SubjectCase.tsx` main style + `styles.css` `.subject-case-screen` scope | `--subject-color` set from `subjectId`'s record; scope rules swap brass accents (choice pressed state, letter badge) to the var where they are subject chrome — the shared wash/background does NOT change. |
| Stamp (Lane A) | shared | Ring reads `--subject-color` — no Lane A change. |
| GK card | `SubjectPicker.tsx` | GK keeps its globe still + overlay; skin applies identically (the art is never filtered/tinted — existing rule). |

## P3 — mascot narrow (the only character delta)

- **Who:** Grandpa — the site's existing storyteller, already in every
  footer (`SiteFooter` + Grandpa's band). No new character, no new art
  commission: his existing standing figure asset is reused.
- **Where:** ONE static presence on the picker, at the **hero's lower-left,
  beside (never on) the `WhyLearnHero` film card**, at phone width stacking
  BELOW the hero card — he introduces the page the way he introduces Home.
- **Never:** overlapping a subject card, a film, the band pills, or any tap
  zone; never animated beyond the still gates the page already applies
  (reduced-motion / Save-Data / low-memory → the still, like every other
  art layer); never inside a case screen (Holmes & Watson own the case
  surfaces, flag-gated, unchanged).
- Copy: none new in this lane — Grandpa's presence is visual; any speech
  line is an owner copy decision, out of scope here.

## MUST NOT CHANGE (settled — the mock is judged against this list)

1. Card geometry: grid (1 col <360px, 2 col 360–1080px, 4 col ≥1081px),
   card anatomy order (16:9 pic slot → kickrow → title+chip row → one-liner
   → go row), card padding, the Reset button's place (bottom-right sibling).
2. The Living Atlas world band (`WhyLearnWorld`: painting, trail, clouds,
   trekker, all clocks and gates) and the drift layer (`WhyLearnDrift`).
3. Band pills / `AgeBandControl` behaviour and placement (Variant E:
   collapse after pick, re-deal on change).
4. Card accessible names (start with the subject name; kicker stays
   aria-hidden decoration) and the no-clipped-elements guarantee at 320px
   (nothing overflows the card or the viewport — the sticker shadow is
   offset INSIDE the grid gap, cards keep `overflow: hidden` art rules).
5. The hero film card's slot, controls, and play window (2.8–8.6s).
6. Case-screen layout and flow — Lane C touches accent colour only.
7. Entry bundle: registry field + CSS ride existing chunks (picker/case are
   lazy); the 323,865 B entry gate must show 0 B delta.

## Accessibility

- Border/shadow are decorative; focus-visible outline (3px `--atlas-ink`,
  offset 3px) is preserved verbatim over the new skin.
- Subject colour is never the only identity signal: title text + icon +
  one-liner already name the subject; colour is reinforcement (EJ's rule:
  colour AND glyph together — here, colour + icon + name).
- Badge: white icon on the subject colour must hit ≥4.5:1 as a graphical
  object on its ground — verify per palette; where a hue fails, darken the
  badge ground one shade step (hue fixed).
- Hover lift has no meaning on touch: the press state (2px) is the touch
  feedback; nothing is hover-gated. Reduced motion: lift/press transitions
  are disabled with the page's existing reduced-motion rules; the spotlight
  pulse already gates.
- The hard shadow must not reduce the perceived contrast of the card's edge
  in high-contrast / forced-colors modes: under the page's existing
  high-contrast rules the skin falls back to the 1px line (spec'd — the
  art-off rules already restyle this page's layers).

## NEGATIVE list — must NEVER happen

1. Geometry drift: any change to card size, grid, anatomy order, or the
   film slot's 16:9 ratio (a refactor that moves the layout is a design
   change — this lane IS the design change, scoped to the skin only).
2. Per-subject card forks: one `.why-learn-card`, one skin, colour via the
   var — six restyled copies is the exact defect the component law names.
3. The token defined anywhere except the registry record (no second colour
   map in the picker — `SUBJECT_ICONS` stays icons-only; colour joins the
   record the picker already loads).
4. Grandpa (or any character) overlapping cards/films/pills, or appearing
   inside a case.
5. A subject colour used as body-text colour below 4.5:1 on its ground.
6. The GK art filtered, tinted, or transformed by the skin.
7. Doors' 300px marketing grid, L2P fonts (Fredoka/Nunito), or L2P palette
   hexes copied in — Meridian keeps Fraunces/Karla and the atlas palette;
   only the recipe (weights, offsets, timing) transfers.

## Acceptance criteria

- Mock approval first: composed picker captures at 1280×800, 1920×1080,
  768×1024, 390×844, 320×568 approved by the owner against Living Atlas.
- After build: before/after captures at the same five viewports show ONLY
  skin deltas (border/radius/shadow/hover/colour/Grandpa) — geometry diff
  is a fail.
- Contrast: badge + stamp + hunch accent verified ≥4.5:1 on every atlas
  palette the page ships.
- E2E: why-learn page/card/hero specs + subjects-picker spec green,
  including the no-clipped-elements checks at 320px and card-name rules.
- Entry size 0 B delta; `lint:arch`/`lint:nav` green.

## Effort estimate

- **Token + skin + case accent: ~6–8 hours** (registry field ×6 records,
  CSS block rework, two style props, contrast verification per palette).
- **P3 placement: ~2–4 hours** (existing asset; placement + responsive
  stacking + still-gate wiring).
- **Mockup round: ~half a day** (staging + 5-viewport captures + owner eye)
  — already produced with this spec set as staging mocks.
- No content, no new assets, no fonts.
