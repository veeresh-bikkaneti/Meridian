# fix/why-learn-picker-wide-layout — branch status

## Done
- Diagnosed the wide-monitor stretch from the real CSS on main
  (2ce6757a; file contents identical at b2ef88a7, where this was diagnosed and proofed): SubjectPicker was the only screen lifting ScreenShell's
  width cap entirely (`lg:max-w-none`); case screens keep the shell's
  `max-w-3xl` and Home caps at `max-w-7xl`. The hero film is
  height-driven (card height `clamp(232px, 33dvh, 300px)`, slot
  16:9), so at 2560px the card sprawled to 2,520px around a measured
  473×266 film slot, the 1fr grid tracks stretched each card to
  618px (298px at 1280px), and the second row's two cards left two
  empty tracks (~1,268px) at the right.
- Capped the picker at the home page's own width: `lg:max-w-7xl`.
  At 1280px the layout is byte-for-byte the shipped one; wider
  monitors only gain page margin.
- Moved the age-band control into the hero card: ScreenShell gained
  an optional `heroExtra` slot rendered inside `.screen-hero-band`
  under the titles (screens that pass nothing render as before);
  SubjectPicker hosts `AgeBandControl` there and the separate band
  row under the header is removed. `bandBarRef` moved with the
  control, so an unset subject tap still scrolls to the pills and
  focuses the first one. AgeBandControl itself is untouched — same
  pills, same "Change band", same store writes.
- Pins updated (why-learn-hero.test.ts, ask-age-first.test.ts) and a
  2560px e2e added to why-learn-page.desktop.spec.ts (picker width,
  slot aspect, band-inside-hero, even first row).

## Proof (builder-run, headless CDP over the plain Vite build;
## poster fills the slot — this Chrome cannot decode the film)
- Before/after screenshots + measurements at 2560×1440, 1280×800,
  390×844 in the PR body; raw files kept with the builder's proof
  pack (fix2-proof/).

## Next step
- Independent panel review, then the owner's merge word. Draft only.

## Open questions
- None for the owner beyond the standing "Change band" ungated note
  carried since #498 (unchanged by this PR — the control moved, its
  behaviour did not).

## Ruled out
- Capping at max-w-6xl (the Cold Trail cap): it would shrink the
  picker at 1280px too, changing the shipped reading width.
- Passing the band control through the `hero` prop as a sibling of
  the film: at desktop widths the hero card is a flex row, so the
  control would have become a third column and squeezed the titles
  band; the titles-band slot keeps the phone stack intact too.

## Graph
- No graph nodes added; presentation-only change to existing nodes
  (picker screen, screen shell).
