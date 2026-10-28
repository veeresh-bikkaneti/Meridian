# COUNCIL ADDENDUM (D9) — High-contrast view cure round, PR #275

- **Date:** 2026-10-28
- **Parent manifest:** `.council/manifests/2026-10-27-high-contrast-view.md`
  (Tier 2, signed 2026-10-27, decisions D1–D8). This addendum adds
  decision **D9** only; D1–D8 are unchanged.
- **Trigger:** the PR #275 review panel (record:
  `~/workspace/meridian-pipeline-274-275/PIPELINE-275.md`) returned
  NOT READY with BLOCKs 1–4. BLOCKs 1–2 share one root cause in the
  original manifest's §3 scope decision. The owner ordered on
  2026-10-28: "Run both cure rounds + panel re-votes (#274 first,
  then #275)". This addendum is committed alone, before any cure
  implementation commit.
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`

## D9 — Scope correction (Chair)

The original manifest §3 left every `--map-*` var except the five
palette tokens at its theme value in both palettes ("the palette
defines five tokens and inventing more is scope creep"). The panel
measured what that decision does once the land token flips: the
guess pin falls to 1.02:1 and the answer mark to 1.51:1 against
high-contrast land, while border (12.34:1) and park (8.71:1) invert
the standing hierarchy (boundaries subtle, highlight dominant).

**Corrected principle:** the scope of a palette change is the
surface the player must read, not the definition site. Flipping
land from dark to cream invalidates every dark-land-tuned token
until it is re-measured against the new land (and the other
high-contrast anchors). A token may stay at its theme value only
after that re-measurement proves it — which is what the value
table below records, token by token (roads and river are kept on
exactly that basis; pin/answer/highlight/border/park/cross/lit
are not, because their measurements failed).

## Bounded footprint lift (Chair, this addendum only)

`src/game/palette.ts` — protected by the parent manifest — is
opened for **additive exports only**:

- a new type `MapMarkTokens` with exactly the keys
  `{pin, answer, highlight, border, park, cross, lit}`;
- two new constants, `STANDARD_MARKS` and `HIGH_CONTRAST_MARKS`,
  of that type.

Nothing existing in the file may change: `MapPalette`'s shape,
the five tokens of `STANDARD` / `HIGH_CONTRAST`, `contrastRatio`,
`selectPalette`, and `PALETTE_STORAGE_KEY` stay byte-identical.
(The one exception is comment wording: the stale line-1 comment
calling the storage key a "future" toggle key is corrected,
because the toggle has shipped — a DevEx nit from panel round 1,
in scope only because this lift opens the file.)

The rest of the cure footprint follows the same tokens through
the existing pipe: the `:root[data-palette="high-contrast"]`
block in `src/styles.css` gains the seven mark vars sourced from
`HIGH_CONTRAST_MARKS`; `palette.test.ts` and
`palette-preference.test.ts` pin the values and the floors;
the pin centre-dot seam (below) runs through a new
`--map-pin-dot` CSS var read by `src/map/colors.ts` and used by
`drawGuessPin` in `src/map/paint-scene.ts`; the toggle's visible
pressed state reuses the `.atlas-seg` brass pattern in
`src/styles.css` plus the `HighContrastToggle` component in
`src/components/game-app.tsx`; the E2E extension lives in
`tests/e2e/high-contrast.desktop.spec.ts`. Records corrections
are wording only (PR body + `BRANCH_STATUS.md`).

## Adjudicated value table (binding)

All ratios computed with the repo's own `contrastRatio`
(unrounded WCAG 2 relative luminance) against the high-contrast
anchors land `#f6f3ea`, water `#0b0d10`, lake `#1a1d22`, and
verified by the builder before this addendum was committed.

| Token | Value | Computed ratios / constraint |
| :--- | :--- | :--- |
| pin | `#b04a9e` | 4.38 vs land · 4.00 vs water · 3.48 vs lake — ≥3:1 vs all three |
| answer | `#a86c00` | 3.93 vs land · 4.46 vs water · 3.87 vs lake — ≥3:1 vs all three |
| highlight | `#a86c00` | identical to answer (binding identity: `answer === highlight`) |
| cross | `#757575` | 4.15 vs land · 4.22 vs water · 3.67 vs lake — ≥3:1 vs all three |
| lit | `#f0dca0` | pale wash: 1.23 vs HC land (ceiling ≤1.45). Binding pins are marks-vs-lit: pin 3.58 · answer 3.21 · arc `#c45c12` 3.16 vs lit — each ≥3:1, so the primary value is used and the fallback below is **not** triggered |
| lit fallback (not used) | `#d6ded2` | would have given pin 3.53 · answer 3.17 · arc 3.12 vs lit (Councilor C's computations) |
| border | `#beaf8d` | **1.9500138868475125 vs HC land** (unrounded) — inside the binding intersection [1.90, 2.00] (Chair ceiling 2.00 ∩ Councilor C floor 1.90) |
| park | `#cfdcb4` | 1.30 vs HC land — inside Chair [1.25, 2.00], C [1.15, 1.50], and Game Designer [1.15, 1.35] |
| river | KEEP both theme values | dark `#3c8496`: 3.84 vs HC land / 4.57 vs HC water · light `#5b90a6`: 3.16 vs HC land / 5.55 vs HC water — no HC override; tests pin both theme values against the HC anchors |
| roads / highway / road-case | NO HC override | see the roads disposition below; a negative source-pin asserts the HC block contains no `--map-road` / `--map-highway` / `--map-road-case` / `--map-river` entries |

`STANDARD_MARKS` must equal today's dark-theme values exactly, so
the standard path is provably unchanged:

```text
pin #f4f1ea · answer #f2c14e · highlight #f2c14e · border #24302c
park #1f4d36 · cross #d7ddd9 · lit #6e9084
```

Hierarchy pin (test-enforced): `max(border, park vs HC land)` =
1.95 is below `min(pin, answer, highlight, cross vs HC land)` =
3.93 — marks dominate, boundaries and parks stay subtle.

## Seat positions and dissents (verbatim in substance)

### Game Designer — APPROVE

His proposed values were: border `#d3c9ae`, park `#d8e0bd`,
lit `#f0dca0`, cross `#5f7168`, highlight `#9c6d0f`. His lit
value is adopted; his park band is satisfied by the adopted
`#cfdcb4`; the other values were superseded by the binding
floors in the adjudication (below). Two of his rulings are
recorded as his:

- **Ink-pin ruling:** the pin should stay in the ink family —
  his ink `#1c2420`. **Dissent recorded, not adopted:** the ink
  measures 14.31:1 vs HC land but only 1.23:1 vs HC water, so it
  fails the ≥3:1 floor. The floor beats family per Chair
  tie-break 1, and the owner's cure spec mandates ≥3:1 vs land
  AND water. The adopted pin is Councilor C's `#b04a9e`.
- **Roads — KEEP:** his casing argument for keeping the road /
  highway / road-case system unchanged in this cure. Adopted
  (see the roads disposition under Councilor C's condition (e)).

### Councilor C (Accessibility Auditor) — NO OBJECTION, conditional

Conditions, with dispositions:

- **(a) Lake anchor — ADOPTED.** Contrast floors are measured
  against lake `#1a1d22` as a third anchor, not only land and
  water. Every Class A mark passes ≥3:1 vs lake (table above).
- **(b) Border floor 1.90 — ADOPTED.** The border ratio must be
  ≥1.90 vs HC land; combined with the Chair's 2.00 ceiling, the
  binding intersection is [1.90, 2.00] and the adopted
  `#beaf8d` computes to 1.9500138868475125 inside it. (His own
  `#a79c86` at 2.44 was too strong per the Chair; the Game
  Designer's `#d3c9ae` at 1.49 was too weak per C.)
- **(c) Lit change + marks-vs-lit pins — ADOPTED.** The lit
  token changes for high contrast, and the binding test pins
  are marks-vs-lit (pin / answer / arc each ≥3:1 vs lit),
  with lit-vs-land held to a ≤1.45 ceiling as a pale wash.
- **(d) Cross change — ADOPTED.** Cross takes the HC-specific
  `#757575` (≥3:1 vs land, water, and lake).
- **(e) Roads system change — NOT adopted.** C's position was
  that the road/highway/road-case system must change in this
  cure. **C's CHALLENGE on this item is recorded.**
  Dispositioned by the Chair: roads are out of this cure (the
  Game Designer's KEEP ruling and the owner's cure scope both
  stand). **Residual, named as a follow-up:** the dark theme's
  `--map-road-case` `#241f1a` measures **14.72:1 vs HC land** —
  recorded in `BRANCH_STATUS.md` for a separate design pass,
  not silently dropped.
- **(f) Pin centre-dot cure — ADOPTED.** Computed: the dot's
  `rgba(0,0,0,0.38)` over the new pin body composites to
  1.95:1 vs the body — below the standard path's own 2.65:1.
  Cure: under high contrast only, the centre dot is drawn
  solid `#f6f3ea` (HC land; 4.38:1 vs the pin body); standard
  rendering is byte-identical. Seam (implementation note): a
  `--map-pin-dot` CSS var — theme blocks carry the current
  `rgba(0,0,0,0.38)`, the HC block carries `#f6f3ea` —
  `colors.ts` reads it as `pinDot` with the rgba as fallback,
  and `drawGuessPin` uses `colors.pinDot` for the dot fill.
  The behaviour is test-pinned, including that the standard
  dot value is unchanged.
- **(g) Both-themes substance — ADOPTED.** The cure's values
  and floors are proven against both themes' substance (the
  river keep is pinned for the dark AND light theme values
  against the HC anchors; `STANDARD_MARKS` pins the standard
  path unchanged).

### Chair — lit row superseded note

The Chair's draft lit row (sage `#6e9084`, the standard theme's
lit value carried over) is **superseded and refuted**: the arc
measures 1.22:1 on it and the answer mark fails on it too
(Game Designer + Councilor C computations reported the answer
at 1.44:1; the builder's verification with the repo's
`contrastRatio` puts the adopted answer `#a86c00` at 1.24:1 vs
the sage — either figure is far below the 3:1 floor, so the
refutation stands on both). The adopted lit is the Game
Designer's pale wash `#f0dca0` under Councilor C's
marks-vs-lit pinning (condition (c)).

### Satellite GOLD divergence — disclosure

Under high contrast the **vector** highlight darkens to the
adopted `#a86c00` (it must: gold `#f2c14e` is 1.51:1 on HC
land). The **satellite** region highlight
(`region-highlight.ts`, GOLD `#f2c14e`) is untouched per the
parent manifest's D5 non-touch guarantee. The coupling
"matches region-highlight gold" therefore holds **only outside
high contrast**; the comments that state it (in `styles.css`
and `src/map/colors.ts`) are reworded accordingly in this cure.
This divergence is disclosed here and in `BRANCH_STATUS.md`,
not hidden.

## Chair sign-off

- **Status: APPROVED — Chair, Council Addendum (D9), 2026-10-28**
- **Execution token:** `AUTH_RUN_TDD_IMPLEMENTATION`
- Game Designer: APPROVE (dissent on the pin floor recorded
  above). Councilor C: NO OBJECTION, conditional — conditions
  (a), (b), (c), (d), (f), (g) adopted; condition (e) not
  adopted, his CHALLENGE recorded and dispositioned by the
  Chair above.
