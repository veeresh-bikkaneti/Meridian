# Lane A — P15 Stamps for proof (derived, zero new state)

Status: SPEC (2026-11-24). No production code. Source pattern: Every Joule P15
(stamps earned for proof — [inferred] from EJ code: `stamp: null → earned`).
Verdict of record: ADOPT, derived form (adoption brief, corrected-scope decision).

## What the player sees

1. **In the case (the prove moment).** When a case's main phase is solved, the
   result band (`<section data-testid="{subjectId}-result">` in
   `src/subjects/shared/SubjectCase.tsx`) gains a stamp mark: a small rotated
   circular badge in the subject's colour (Lane C token) reading **“Proved it!”**
   with a star. It stamps in with the existing `atlas-stamp-in` keyframes the
   picker chip already uses (0.45s, `cubic-bezier(0.2, 1.4, 0.4, 1)`), or appears
   statically under reduced motion.
2. **In the picker (the keepsake).** On `SubjectPicker.tsx`, a subject whose
   stamp is earned shows the same mark beside the existing case-count chip
   (`.why-learn-chip.wl-chip-stamp`, title row). Same component, same mark,
   smaller size via prop. Unearned subjects show **nothing** — no greyed
   placeholder, no empty ring.

## User flow

Solve a case (main phase correct) → stamp stamps into the result band →
return to picker → the subject's card carries the stamp → per-subject Reset
(or Start over) → stamp gone on next picker render, because it is derived,
not stored.

## State: derived, ZERO new state

- Source of truth stays `src/subjects/shared/subject-progress.ts`:
  `readSubjectProgress()` → `{ [subjectId]: string[] }` of solved unit ids
  (localStorage key `meridian.subject-progress.v1`, storage port). The store's
  contract — “no scores, no attempts, no answers” — is untouched.
- **Result-band stamp:** derived from the case's own solved state
  (`phase === "done"` reached via a main-phase solve — the same condition
  under which `SubjectCase.onCorrect` already calls
  `recordUnitComplete(subjectId, item.id)`). No read needed; the component
  already knows.
- **Picker stamp (PRIMARY derivation, spec'd):** earned when **every unit of
  the player's current band** for that subject is solved:
  `itemsForGroup(band).every(u => solvedIds.includes(u.id))`, where
  `solvedIds = subjectProgress[subjectId] ?? []` (the picker already holds
  `subjectProgress` state and re-reads on `onSubjectProgressChanged`).
  - **OWNER ONE-LINER NEEDED:** primary (band-complete) vs alternative
    (stamp at first solve, text “N proved”). This spec builds the primary;
    the alternative is a one-line derivation change. Mock screens show the
    primary.
- Follow-up completion does **not** affect either stamp: progress records
  main-phase solves only, so both derivations inherit that. (If the owner
  one-liner above chooses otherwise, the result-band stamp is the only
  change — the picker derivation cannot see follow-ups at all.)

## Components / files touched (delta-only)

| File | Delta |
|---|---|
| `src/subjects/shared/StampMark.tsx` (NEW) | The ONE stamp component: props `subjectId`, `size: "case" \| "chip"`, renders mark + accessible label. |
| `src/subjects/shared/SubjectCase.tsx` | Render `<StampMark>` in the solved result section only (beside the verdict headline). No state, no store calls added. |
| `src/subjects/shared/SubjectPicker.tsx` | Compute `stampEarned(row.id, band, subjectProgress[row.id])`; render `<StampMark size="chip">` in the title row when true. |
| `src/subjects/shared/subject-progress.ts` | ONE pure helper: `isBandComplete(progress, subjectId, unitIds)` (unit-testable without DOM). No store shape change. |
| `src/styles.css` | `.wl-stamp` rules under the existing why-learn block: ring in `var(--subject-color, brass fallback)`, rotation −6°, stamp-in reuse. |
| Tests | `subject-progress.test.ts` (helper), picker + case render tests next to existing suites. |

**Ownership / reuse law:** one `StampMark` component, two call sites, size via
prop — never a picker stamp and a separate case stamp. The colour arrives via
the Lane C `--subject-color` custom property set by the caller; `StampMark`
itself contains no per-subject branching.

## Stamp visual language

- One mark for all subjects: double-ring circle, star centre, word “Proved”
  (case size adds “it!”). Identity between subjects comes ONLY from the ring
  colour (Lane C token) — one mark, six colours, mirroring EJ's “one concept =
  one colour” at subject level.
- Rotation −6° (chip is −2° today; the stamp is a hand-placed mark, slightly
  more tilt reads as placed-by-hand). Never animated beyond the one stamp-in;
  no loops, no pulses (the spotlight already owns card motion).
- Text inside the mark is real text (not an image), ≥ the 14px floor at case
  size; chip size carries the star + ring with an sr-only label (see a11y).

## Edge cases

- **No solves yet:** no stamp anywhere; picker card is byte-identical to today.
- **Per-subject Reset** (`clearSubjectProgress`): stamp disappears — derivation
  re-reads on the existing change announcement. Nothing to un-write.
- **Start over** (`clearAllSubjectProgress`): all stamps disappear, same path.
- **Band switch:** derivation is per current band — a subject stamped at 7–10
  shows no stamp at 10–18 until that band is complete. This is honest (the
  stamp means “this band, proved”) and the stamp's sr label names the band.
- **Corrupt/empty store:** reads fail closed to empty (existing behaviour) →
  no stamps, never a crash, never a false stamp.
- **Lose reveal:** NOT a solve, phase never reaches "done", no stamp — the
  reveal's supportive tone is not diluted by a reward mark.
- **Repeat solve of the same unit:** set semantics — nothing changes.

## Accessibility

- The stamp is decoration + status: case-size stamp is a `<span role="img"
  aria-label="Stamp earned: you proved this case">`; chip-size is
  `aria-hidden` beside the chip, and the card's accessible name gains nothing
  (the E2E rule that card names start with the subject name is preserved).
  Solve status is already announced by the result section itself.
- Ring colour is never the only signal: the word “Proved” + star shape carry
  the meaning for colour-blind players.
- Stamp text/ink on its cream ground ≥4.5:1 (same brass-on-cream pairing the
  chip was re-measured to: 7.08:1). Ring colour is decorative (non-text).
- Reduced motion: `atlas-stamp-in` already lands statically under the page's
  reduced-motion rules; verify the stamp does too — no new keyframes.
- Target size: the stamp is not interactive; nothing to hit. It must never
  overlap the Reset button (bottom-right) or the card's tap area semantics —
  it sits in the title row flow, layout-participating, not absolute.

## NEGATIVE list — must NEVER happen

1. A stamp stored anywhere (no new localStorage key, no new field, no schema
   change to `meridian.subject-progress.v1`).
2. A stamp on an unearned subject, an empty/greyed placeholder stamp, or a
   stamp surviving a Reset / Start over.
3. A stamp on the lose-reveal path, or for a follow-up answer alone.
4. A second stamp component, a per-subject stamp fork, or stamp artwork as an
   image file (it is text + CSS ring, themeable and translatable).
5. The stamp changing card geometry (title row wraps differently earned vs
   unearned) — the row reserves no space when unearned; the mark is small
   enough to sit in the chip's row without reflowing the one-liner.
6. Stamp animation looping, pulsing, or playing under reduced motion.

## Acceptance criteria

- Unit: `isBandComplete` true/false/empty/band-mixed cases pass; derivation
  matches a hand-computed fixture of the real store shape.
- Render: solved case shows the stamp in the result band; unsolved/lose paths
  show none (test both). Picker shows the stamp exactly for band-complete
  subjects; Reset removes it without reload.
- E2E (targeted): solve a full band of one subject in the hermetic harness →
  picker stamp visible; Reset → gone. Card accessible names unchanged.
- Visual: stamp legible at 320×568; no overlap with Reset at any viewport;
  stamp-in plays once, static under reduced motion.
- Provenance/lints green; entry size unchanged (picker/case are lazy chunks).

## Effort estimate

**~4–6 hours build + tests** (one small component, one pure helper, two render
sites, CSS block, unit + targeted e2e). No content, no art, no mockup round
needed beyond the composed mock screens delivered with this spec set.
