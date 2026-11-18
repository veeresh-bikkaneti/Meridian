# Branch status — refactor/footer-grandpa

## Task capsule
One standardized footer for the whole site (owner's word, 2026-11-18):
the shared SiteFooter owns Home's real coffee-run Grandpa (figure +
bubble + dotted trail) as a band under the footer links, rendered
identically on every page that carries the footer, with the tailored
per-page pills as staged (Why Learn "Ages {band}", subject case
"Stories:" read-aloud settings). Mock approval: footer mock set,
2026-11-18; Grandpa art ruling: the coffee-run Grandpa, not the
still-portrait placeholder.

## Plan
1. GrandpaCoffeeRun gains a `tour` prop (default on = Home behaviour);
   the footer composition passes it off so non-Home pages never run
   the Home tasting tour.
2. SiteFooter renders the links footer + the Grandpa band (one
   component, pages differ only by props: lead, grandpaTour,
   grandpaAnchor, width).
3. Home renders SiteFooter after </main> (where the band always
   lived), keeping #home-involved on the band; zero visual delta
   proven by before/after full-page captures.
4. Adoptions: Why Learn picker (unconditional + Ages pill, footer
   region only — the parallel Why Learn lane owns the rest of that
   file), subject case (both branches, Stories lead), Cold Trail
   (both branches), Review complete. LoopScreen, Board and the
   PageShell info pages already render SiteFooter and gain the band
   with no page edit.
5. Registry: picker footer exception closed (frozen list shrinks to
   empty); cold-trail, subject-case, review-complete move to
   footer "shell". New registry test: only site-footer.tsx may
   import the Grandpa scene.
6. Gates: targeted unit + named e2e + captures at five viewports,
   independent Silo QA, CI on the tip. Draft PR, stop at the
   owner's merge word.

## Graph (for the integrator)
- Add node: decision "Footer Grandpa everywhere" (owner, 2026-11-18).
- Edge: site-footer.tsx —documents→ the footer composition (links +
  Grandpa band); supersedes the picker's footer-exception entry.

## Done
- Worktree + branch off cbc119c3; five merged-lane worktrees pruned
  (EDQUOT on first checkout attempt).
- Baseline Home captures (KOFI-enabled build): 1280x800 docHeight
  3674, 390x844 docHeight 6193, band 168px, beat seated.

## Next step
Build units 1–3, run gates, capture the after set, Silo QA, open
the draft PR.

## Open questions
- None blocking. The Why Learn PR and this one both touch
  SubjectPicker.tsx (theirs: hero/container/band control; this one:
  footer region only) — merge-order resolution is Chitti's, per the
  owner's parallel-streams ruling.

## Ruled out
- Still-portrait Grandpa strip from the mocks (owner superseded it:
  "the granpa with coffee").
- Lazy-loading the Grandpa scene inside SiteFooter (would change
  Home's render timing; static import keeps Home identical and the
  module is already in the entry graph via game-app).
