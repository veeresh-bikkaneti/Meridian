# Meridian Long-Name Design Spec — "The Cartographer's Plate"

**Status:** Design approved pending Finish-Gate · **Date:** 2026-10-06 · **Type:** DESIGN ONLY — no code in this spec
**Source:** 9-persona design sprint (UX Researcher → UX Architect + UI Designer + Frontend Developer → Brand Guardian + Visual Storyteller + Inclusive Visuals Specialist → Persona Walkthrough → UI Finish-Gate)
**Implements:** Veeresh's long-name issue — place names (up to 98 chars, real) overflow/truncate/break cards. Meridian's honesty rule: **full place names always; truncation is never an acceptable answer.**

---

## 1. Doctrine

**"Names are the payload; containers flex, names never do."** Every surface displays the full place name, always. The container — never the text — is what adapts: containers grow, reflow, step type down within bounds, or shed non-load-bearing chrome before a single glyph of a name is ever hidden. One token set, one yield order, one break utility governs every surface. No surface invents its own rule.

**Non-goals:** no ellipsis anywhere (the one existing `truncate` is deleted); no tooltip-as-recovery (touch has no hover); no marquee/auto-scroll (WCAG 2.2.2, ADHD hostile); no per-surface bespoke hacks; no `hyphens: auto` (no `lang` metadata — vetoed); no ResizeObserver font-fitting (cost/benefit fails vs. the tier bridge); no line-clamp on names/labels/guesses/headings/questions — zero exceptions, test-gated.

---

## 2. Mechanism: name tiers

React computes the tier from the **full qualified label length** (the string actually rendered) and sets `data-name-tier` on the name element. CSS styles per tier. Character count is not a CSS input — the tier attribute is the React→CSS bridge (SSR-safe, no measurement, no reflow loops, unit-testable).

| Tier | Length | Voice |
|------|--------|-------|
| `short` | ≤ 26 chars | Placard — Fraunces 600 |
| `medium` | 27–60 chars | Engraving — Fraunces 500 |
| `long` | ≥ 61 chars | Field entry — Fraunces 500, framed by brass hairlines above **and** below |

One family (Fraunces) across all tiers — the payload keeps its voice at every length (Inclusive + Storyteller overruled Brand's Karla-switch: a 60-char vs 61-char name must not look like different UI species). The "field entry" register is expressed through the **frame** (brass hairlines above and below the long-tier name), not a typeface swap. The registers are defined by the tier styles in §5; no separate register tokens (sizes vary per surface, so a single token cannot carry them).

```ts
// nameTier(name: string): "short" | "medium" | "long"
// thresholds on name.length; unit-tested at 26/27, 60/61 boundaries
```

---

## 3. Base utility: `.place-name`

```css
.place-name {
  overflow-wrap: break-word;  /* breaks 24-char unbreakables only at overflow edge */
  word-break: normal;         /* never break-all on Latin */
  text-wrap: balance;         /* evens wrapped heading lines; progressive enhancement */
  line-height: 1.28;
}
```

- `hyphens` stays `manual` (inert without `&shy;`). `hyphens: auto` vetoed: no per-name `lang` metadata; wrong-dictionary hyphenation reads as typos and harms dyslexic readers.
- Diacritics (ā, ł, ş, ū): `break-word` respects grapheme clusters — no special handling.
- Display-string refinement allowed: insert zero-width spaces after `/`, `–`, `-` in **display strings only** — never in data or ARIA names — applied at render time in the same React helper that computes `nameTier()` (PR 2).
- `text-wrap: pretty` skipped (Safari 26+ only); `balance` degrades silently elsewhere.

---

## 4. Tokens (additions/changes to `src/styles.css`)

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--atlas-brass-text` | `#e8b64c` | `#8a5f16` | Brass text >12px (eyebrows, chips) |
| `--atlas-brass-text-sm` | `#e8b64c` | `#6e4a0e` (7.08:1) | Brass text ≤12px — AAA-robust for kids/low vision |
| `--atlas-brass-rule` | `#e8b64c` | `#a5761f` | Hairlines, chip borders, frames — non-text only (3.6:1 is fine for 1.4.11) |
| `--game-chrome-bg` | `color-mix(in srgb, var(--atlas-bg-1) 80%, transparent)` | same formula | Floating game chrome — **derived** from `--atlas-bg-1`, never a new hue (no token sprawl) |
| `--game-chrome-line` | `var(--atlas-card-line)` | `var(--atlas-card-line)` | Chrome borders |
| `--game-chrome-solid` | `color-mix(in srgb, var(--atlas-bg-1) 94%, transparent)` | same formula | Pinned CTA/button bars — solid so scrolled text never ghosts behind buttons |

**Game chrome = the Chart Room in a working register:** same brass hairlines, same ink/paper, flatter and denser. Ceremony (graticule, topo atmosphere, staggered entrances) stays home — that's what keeps home special. **Guardrail (law):** brass never carries paragraph text over imagery — hairlines, labels, rules only.

Existing tokens reused: `--atlas-ink`, `--atlas-muted`, `--atlas-card`, `--atlas-card-line`, `--atlas-stamp`, `--atlas-rule`, `--font-atlas-display` (Fraunces), `--font-atlas-body` (Karla), `--font-atlas-mono` (Space Mono).

---

## 5. Type scale per surface

**Question card** (`question-bubble.tsx`)
- Meta band (pinned, `flex`/`space-between`/`baseline`): eyebrow Space Mono 11px uppercase `ls .14em` in `--atlas-brass-text-sm`; difficulty chip Space Mono 11px, `padding 3px 8px`, `1px solid var(--atlas-brass-rule)`, `radius 999px`, `color var(--atlas-brass-text-sm)`. **Chip never compacts, never leaves the band** — same size/position at every tier (Walkthrough fix: signals never flex either).
- Name (`margin-top 6px`): short — Fraunces 600 `clamp(22px, 5.6vw, 28px)` / 1.12; medium — Fraunces 500 `clamp(17px, 4.4vw, 22px)` / 1.28; long — Fraunces 500 16px/1.5 with brass hairlines above **and** below (`padding 8px 0`). At 16px the 98-char fixture sets in ~5 balanced lines.
- Hint: Karla 13.5px/1.45, `--atlas-muted`, `margin-top 8px`.
- Container: `left 10px; top max(4rem, env(safe-area-inset-top)); width min(352px, calc(100vw - 20px))` (≥640px: `min(400px, …)`); `padding 14px 14px 14px 16px; radius 20px`; chrome per §4. Grows downward. Backstop: `max-height min(38dvh, 20rem)`; the name+hint region is a single scroll region (`overflow-y auto`, `role="region"`, accessible name "Place name — scroll for more", `tabindex="0"` per §8.1) with fade mask + `⋯` + "more below" text cue at its bottom edge; the meta band is `position: sticky; top: 0` so it stays pinned while the name scrolls beneath it.
- Collapsed: meta band + toggle only — the toggle sits directly below the meta band, full-width, `min-height 44px`; name folded away entirely (honest; never clamped). Toggle accessible name: "Show place name" / "Hide place name" with `aria-expanded`; folded panel uses `hidden` (removed from AT).
- Keep `title={placeName}`; **drop `tabIndex={0}`** from static name elements (tab-stop fatigue; SR gets full text anyway).

**Reveal card** (`result-card.tsx`) — three zones, `max-width 440px; width 100%; margin-inline: auto; radius 18px; padding 16px 16px 0; max-height min(80dvh, 560px); display flex; flex-direction column` (below 480px: `width: calc(100% - 32px)` so 16px gutters hold)
- **Header zone (pinned, `flex-shrink: 0`):** meta band (same as question card) + **verdict block**: grade chip (see §7) + distance headline Fraunces 600 34px `tabular-nums` in ink — chip and headline in a `flex` row, `align-items: baseline`, `gap 10px`, wrapping to two lines on narrow widths with the headline never shrinking. The headline is an `h2` reading "Result: 2,073 km away" (visually-hidden "Result: " prefix) — the verdict, always visible, never buried.
- **Body zone (scrolls):** `flex 1; min-height 0; overflow-y auto` — **single** scroll region (delete the two nested `max-h-44` story scrollers). Order: pin-compare ledger → story → growth line → source. Brass fade at the body's bottom edge = the page-turn hint.
- **CTA zone (pinned):** `flex-shrink: 0`; `padding 12px 16px calc(16px + env(safe-area-inset-bottom))`; `border-top 1px solid var(--game-chrome-line)`; `background var(--game-chrome-solid)`. "Next place →" full-width, `min-height 48px`.
- Add the missing `title={placeLabel}` to the answer heading.

**Pin-compare ledger** (replaces the compounding text-sm line): a real `<dl>`, entries **stacked** (DT small-caps eyebrow *above* DD — never side-by-side), brass hairline separators.
- `YOUR PIN` — quiet ink; the name in Karla 14px/1.45 `.place-name`; honesty qualifier inline sentence-case quiet "near " (NOT small-caps label, NOT italic — reads as qualifier, dyslexia-safe).
- `TRUE SPOT` — gold-truth treatment: brass hairline above, `#f2c14e` answer-mark motif, name in **tiered Fraunces with `.place-name`** — short Fraunces 600 24px/1.15, medium Fraunces 500 20px/1.3, long Fraunces 500 17px/1.5 with brass hairlines above **and** below (the §2 long-tier frame). The name's hero moment on the reveal; full answer name lives **only here**, not doubled in the header.
- The two names never share a line — they can never compound again.

**GeoDetective guess list** (`LoopScreen.tsx` ~:632) — the ellipsis dies:
- Row: `display grid; grid-template-columns 1fr auto; gap 12px; align-items start; padding 12px 14px; radius 12px` (existing border/bg kept). Brass hairline separators between rows.
- Left: brass **dossier number** (Space Mono 600 13px in `var(--atlas-brass-text)` — >12px so the base brass token applies — numerals, hairline border, no gloss — "№ 3"), top-aligned; name Karla 600 15px/1.4 `.place-name`, **unlimited lines**.
- Right (`text-align right`, top-aligned): distance Karla 700 15px `tabular-nums`; below it the trend word — Space Mono 11px small-caps in `var(--atlas-brass-text-sm)` (`WARMER`/`COLDER`; row 1 gets a `FIRST GUESS` tag — Space Mono 11px uppercase `ls .08em` in `var(--atlas-brass-text-sm)`, `padding 3px 8px`, `1px solid var(--atlas-brass-rule)`, `radius 999px` — never a trend; a warmer/colder on the opening guess is a lie); below it the bearing arrow (14px brass, **bearing only**) + Space Mono 11px muted octant label. Trend + distance + bearing grouped so the eye can't read trend without distance.
- List region `max-h 40dvh; overflow-y auto` — the **list** scrolls; rows never do.
- Each row is a **single accessible list item**: `aria-label="Guess 1: [full name]. First guess. 1,204 km, northeast."` Bearing arrow has an accessible name or is `aria-hidden` with direction in text.

**GeoDetective bottom sheet** (`LoopScreen.tsx` ~:697): `display flex; flex-direction column; max-height min(85dvh, 36rem)`
- Grab zone: 36×5px rounded handle, `--atlas-faint` (decorative).
- **Header (pinned, `flex-shrink: 0`):** 48px dismiss button (never scrolled away) + "YOU TAPPED" mono 11px muted + tiered full name (short Fraunces 600 24px/1.15, medium Fraunces 500 20px/1.3, long Fraunces 500 17px/1.5 + hairlines). `aria-label="Guess <full name>?"`.
- Content zone (`flex 1; min-height 0; overflow-y auto; padding 0 24px`).
- **Button bar (pinned, outside the scroll zone, `flex-shrink: 0`):** `padding 16px 24px calc(20px + env(safe-area-inset-bottom)); border-top; background var(--game-chrome-solid)`. "Guess this place" primary + "Not this one" ghost, both `min-height 48px`, full width, 8px gap.
- The sheet has two detents: half-sheet (`max-height min(45dvh, 20rem)`) and full (`max-height min(85dvh, 36rem)`). Names >60 chars open at the full detent (skip half-sheet). `overscroll-behavior: contain`.

**GeoDetective reveal** (`LoopScreen.tsx` ~:800/811): same three-zone treatment as the reveal card; clue-history rows compact to summary rows first — a summary row shows only the clue-tier label and clue number; the full clue text stays in the DOM and expands on tap (`aria-expanded`); answer heading tiered Fraunces (short 30px/1.15, medium 26px/1.25, long 22px/1.4 floor + brass hairlines above and below); card grows to `max-h 80dvh`, then the card body scrolls.

**Misses-review deck:** inherits question card + reveal card automatically (same components) — no separate spec.

---

## 6. Yield order & hierarchy contract

Fixed order, every surface — eyebrow → name → chip must all survive a 98-char name:

1. **Chrome compacts** — container padding tightens one step (16px paddings → 12px; the bubble's 14px → 12px; row and sheet-content paddings hold), decorative rules near the name drop out — except the long-tier hairline frame, which is the tier's voice and never drops. (Type is NOT touched before the container flexes — doctrine.)
2. **Container grows** to its surface ceiling (§5).
3. **Type steps down** only within the tier sizes defined in §5 (backstop — the tier sizes ARE the floors: question bubble 16px, guess-list names 15px, reveal/sheet long-tier 17px, GeoDetective reveal answer heading 22px). Type never goes below a surface's smallest tier size.
4. **Chip never compacts** — same size, label, and position at every tier (Walkthrough: signals never flex). If the name needs room, the eyebrow's margin-bottom halves first; the chip yields space, never size — it **never leaves the meta band, never shrinks below 11px, never hides**.
5. **Sibling prose scrolls** behind fade + `⋯` + "more below". The name's box is the last thing constrained — it only ever gains lines.

The eyebrow never wraps past 1 line (`white-space: nowrap`), never moves, never disappears; if the name needs room, the eyebrow's margin-bottom halves.

---

## 7. Grade chip (new component)

The reveal verdict pairs the number with meaning — reused product language, not invented:
- **Main editions:** the existing share grade tiers (🎯 300+, 🏆 200+, 🌟 120+, 👏 60+, 🙂 1+, 💨 miss on the 0–415 range) as a chip next to the score/distance headline.
- **GeoDetective:** proximity bands — **proposed defaults, game designer to ratify:** 🎯 ≤25 km "Bullseye" · 🏆 ≤150 km · 🌟 ≤600 km · 👏 ≤1,500 km · 🙂 ≤3,000 km · 💨 beyond.
- Chip: Space Mono 11px in `var(--atlas-brass-text-sm)`, `padding 3px 8px`, `1px solid var(--atlas-brass-rule)`, `radius 999px`. Screen reader: the chip exposes `aria-label="Grade: <band text>"` announced with the verdict (e.g. "Result: 2,073 km away. Grade: Bullseye."). Band text: main editions reuse the existing share-tier labels; GeoDetective bands are ratified together with the km bands in §13.1.

---

## 8. Accessibility (normative)

1. **Scroll regions:** every `overflow` region gets `role="region"` + accessible name (e.g. "Place details — scroll for more") + `tabindex="0"` (keyboard users must reach nested scrollers). The brass `⋯` and fade mask are `aria-hidden`, `pointer-events: none`, purely decorative, **hidden when content fits**.
2. **Focus:** visible ≥2px focus ring (`--atlas-brass-text`, offset 2px, 3:1 against adjacent) on all CTAs and fold/dismiss controls. `:focus-visible` gets `scroll-margin` so focus never lands under the fade.
3. **Names:** full text in DOM, in visual order; no `tabIndex` on static names; keep `title`; **drop `aria-label` on static name elements** (with zero ellipsis, visible text == accessible name; avoids JAWS double-announce).
4. **Guess rows:** single accessible list items (composed `aria-label`, §5).
5. **Ledger:** native `<dl>` semantics; stacked entries.
6. **Collapse:** toggle names its consequence ("Show/Hide place name"), `aria-expanded`, folded panel `hidden`.
7. **200% zoom:** pinned regions capped — meta band ≤30% of sheet/card height; scroll region keeps a guaranteed minimum height of `max(120px, 20% of the sheet/card height)`. Char-count tiers are zoom-stable (tier doesn't shift; names just wrap taller).
8. **Reduced motion:** tier switches never animate; existing transitions unchanged **after verifying they are already reduced-motion-safe** (one-line codebase check at build time).
9. **Contrast (verified against each theme's text background):** dark `--atlas-brass-text` 8.74:1, dark ink 13.3:1, light `--atlas-brass-text-sm` 7.08:1, light ink 13.1:1, light `--atlas-brass-rule` hairline 3.60:1 (non-text, passes 1.4.11). Still required at build time: light `--atlas-brass-text` ratio (>12px text: bearing arrow, dossier number) and the `--atlas-brass-text` focus ring ≥3:1 against adjacent surfaces in both themes — figures to be recorded here. No italics anywhere. Eyebrow letter-spacing .14em retained.
10. **Motor:** 48px minimums on all CTAs/dismiss; drag handle decorative only — dismissal never drag-only.

---

## 9. Line-clamp & recovery policy

**Clamping is forbidden for place names, labels, guesses, headings, and question text on every surface — zero exceptions.** Test-gated: extend the existing `question-bubble.test.ts` no-clamp gate to guess list, reveal headings, bottom sheet.
**v1 has no clamping anywhere** — the reveal budget is solved by scroll-with-pinned-CTA, which hides nothing. The story/clue "expander" pattern (clamp + in-place expand + `aria-expanded` + full text to SR) is documented as a **deferred** option, not specified here.

---

## 10. Motion

Micro-moments only, per the Chart Room system: existing enter/rise transitions unchanged; tier switches are instant (no animation); the pinned CTA never animates in late (Veeresh's "enough moment" must be immediately reachable). `prefers-reduced-motion` fallbacks throughout.

---

## 11. Stress fixtures (all REAL dealt names — E2E must cover)

| Chars | Name | Notes |
|-------|------|-------|
| 98 | United Townships Of Dysart Dudley Harcourt Guilford Harburn Bruton Havelock Eyre And Clyde, Canada | GeoDetective rendered; the worst case |
| 97 | United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde | Canada country chunk (raw) |
| 92 | Pamayanang University Of Philippines Employment Housing Cooperative Subdivision, Philippines | GeoDetective rendered |
| 79 | Pamayanang University of Philippines Employment Housing Cooperative Subdivision | Globe chunk (raw) |
| 73 | Masakin Shirkat Abu Al Wafa Lil Muqawalat Wa Al Istithmar Al Aqari, Egypt | GeoDetective rendered |
| 73 | Va Boston Healthcare System Brockton Campus, Massachusetts, United States | GeoDetective rendered |
| 67 | Karachi University Employees Co Operative Housing Society, Pakistan | GeoDetective rendered |
| 67 | Masākin Shirkat Abū al Wafā lil Muqāwalāt wa al Istithmār al ‘Aqārī | Diacritics |
| 65 | Poselok Turisticheskogo pansionata "Klyazminskoe vodohranilische" | Embedded quotes |
| 58 | Valle Huejúcar (Fraccionamiento Popular) [Fraccionamiento] | Parens + brackets |
| 49 | Borgoricco-San Michele delle Badesse-Sant'Eufemia | Hyphens + apostrophe |
| 45 | Diamond Head / Kapahulu / Saint Louis Heights | Longest state-chunk name |
| 40 | Rivière-des-Prairies–Pointe-aux-Trembles | Hyphens + en-dash + diacritic |
| 39 | Universitäts- und Hansestadt Greifswald | German compounds |
| 34 | Rouffignac-Saint-Cernin-de-Reilhac | Hyphen chain |
| 28 | Kamiyūbetsu Tonden Shigaichi | Macron |
| 24 | Staronizhestebliyevskaya | Unbreakable — must not overflow horizontally |
| 23 | Kuruppanāyakkanpālaiyam | Unbreakable + diacritic |
| 21 | Offutt Air Force Base | Longest Nebraska name |
| 7 | Lincoln | Shortest — the card in Veeresh's screenshot; must stay glorious |

Plus: globe-qualified labels (~100+ chars via `, Subdivision, Country` suffix) on the question bubble and reveal heading.

---

## 12. Build order (3 PRs)

**PR 1 — Wrap foundation.** New `.place-name` utility in `src/styles.css`; apply to bubble name element, guess-list name span, sheet h2, reveal headings (incl. ledger TRUE SPOT name). Delete `truncate` at `LoopScreen.tsx:632` (`items-baseline` → `items-start`). Extend the no-clamp test gate to all four surfaces. Keep `title={placeName}`. *Exit: full names everywhere, no ellipsis, unbreakables never overflow.*

**PR 2 — Tiers + tokens + rows.** `nameTier()` helper (unit-tested at 26/27, 60/61) → `data-name-tier`; per-tier CSS; new tokens (§4); meta-band lock (chip fixed in the band, never compacts); dossier guess rows; ledger `<dl>`; grade chip (bands per §7); "brass dossier number" in Space Mono. *Exit: 98-char names compress gracefully; hierarchy survives at every tier.*

**PR 3 — Scroll architecture + a11y.** Bubble backstop (mask + ⋯ + "more below"); reveal three-zone + pinned CTA; sheet pinned header/button bar + 85dvh cap + `overscroll-behavior: contain`; fold nested scrollers into single regions; scroll-region roles/names/tabindex; focus rings; 200%-zoom caps; verdict accessible names; composed row labels. *Exit: no inner-scroll trap on any name surface; CTA never buried; Devon can play end-to-end.*

**E2E seams to keep:** `data-testid="difficulty-chip"`, `"pin-compare-line"`, `"miss-headline"`, `"growth-line"`, `"score-breakdown"` — none renamed. **New assertions:** `data-name-tier` values; zero `text-overflow: ellipsis` on name elements; 360px/768px/1280px × light/dark × reduced-motion matrix on the fixtures.

---

## 13. Open questions for Veeresh

1. **Grade km bands (§7):** proposed defaults — ratify or adjust?
2. **"FIELD ENTRY" tag:** optional Space Mono 11px tag (the 11px mono floor is normative — 10px is not on the table) above the long-tier hairline — yes or no? (Storyteller's optional garnish.)
3. **Geographic-anchor bolding (deferred recommendation):** bold the ", Canada" tail in long names to help kids chunk — name stays full, eyes get a handhold. Worth it or visual noise?

## 14. Deferred (explicitly not in this spec)

Story/clue text expanders · `hyphens: auto` (needs per-name `lang` metadata) · ResizeObserver font-fitting · question-card pin-drop confirmation feedback (drop-off risk noted for the gameplay crew) · pool replenishment cadence.

---

## 15. Persona verdict log

| Persona | Verdict | Key contribution |
|---------|---------|------------------|
| UX Researcher | Evidence delivered | 16-surface inventory; exactly ONE hard truncation (guess list); ~20 real fixtures; Chart Room tokens extracted |
| UX Architect | Strategy delivered | Doctrine "names are the payload"; yield order; `.place-name` utility; line-clamp ban; rejected tooltip/marquee/bespoke fixes |
| UI Designer | Design delivered | "Cartographer's Plate" concept; 3 tiers; dossier rows; ledger; Chart Room into game chrome |
| Frontend Developer | Feasibility gate passed | Vetoed pure-CSS char-count, `hyphens:auto`, `break-all`, ResizeObserver-default, tooltip-as-recovery; 3-PR build order |
| Brand Guardian | Approve-with-changes | "Brass dossier number" rename; token derivation rule; register package-deal; cleared tier mechanism as non-costume |
| Visual Storyteller | Approve-with-changes | Verdict-first reveal; TRUE SPOT gold treatment; FIRST GUESS tag; no trend arrows; pinned sheet header |
| Inclusive Visuals Specialist | Approve-with-changes | 11px mono floor + `#6e4a0e`; dropped aria-labels; 200%-zoom caps; focus rings; fade-mask inertness |
| Persona Walkthrough | 6 fixes, all adopted | Verdict accessible names; scroll-region roles; single-item rows; chip never compacts; named collapse toggles; graded verdicts |
| UI Finish-Gate | **SHIP WITH FIXES — all applied** | 6 contradictions + 18 underspecified values found; every fix applied to this spec verbatim. PR 1 (wrap foundation) cleared to start. |

**Conflicts resolved by coordinator:** (1) Font-family tier switch — killed 2-to-1 (Inclusive + Storyteller over Brand); Fraunces unified, register expressed via hairline frame. (2) `hyphens:auto` — vetoed per Frontend (no lang metadata). (3) Italic "near" — rejected per Inclusive (dyslexia); "near" as quiet sentence-case qualifier. (4) Chip compaction — killed per Walkthrough (signals never flex). (5) Story clamping — deferred per Frontend+Storyteller (scroll solves it). (6) Guess-row trend placement — paired with distance per Walkthrough (not under name per Storyteller's draft).
