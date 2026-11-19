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

## Plan (as executed)
1. GrandpaCoffeeRun gains a `tastingTour` prop (default on = Home
   behaviour); the footer composition passes it off so non-Home
   pages never run the Home-anchored tasting tour.
2. SiteFooter renders the links footer + the Grandpa band (one
   component, pages differ only by props: lead, grandpa, grandpaTour,
   grandpaAnchor, width). The scene is lazy-loaded inside SiteFooter
   (see Ruled out / reversed below).
3. Home renders SiteFooter after </main> (where the band always
   lived), keeping #home-involved on the band; zero visual delta
   proven by before/after full-page captures.
4. Adoptions: Why Learn picker (unconditional + Ages pill, footer
   region only — the parallel Why Learn lane owns the rest of that
   file), subject case (both branches, Stories lead), Cold Trail
   (both branches), Review complete. LoopScreen, Board and the
   PageShell info pages already render SiteFooter and gain the band
   with no page edit.
5. Registry: the footer-exception list is now EMPTY; cold-trail,
   subject-case, review-complete and why-learn-picker are footer
   "shell". Registry tests: only site-footer.tsx may import the
   Grandpa scene (static or dynamic), plus a negative control that
   reviving a footer exception fails validation.
6. Scene hardening for non-Home hosts (the scene now mounts inside
   other screens' unit renders): defensive import.meta.env read,
   explicit file extensions on its relative imports, audio
   construction and the quip interval degrade to silent no-ops
   where the host environment lacks them (browser behaviour
   unchanged).

## Graph (for the integrator)
- Add node: decision "Footer Grandpa everywhere" (owner, 2026-11-18).
- Edge: site-footer.tsx —documents→ the footer composition (links +
  Grandpa band); supersedes the picker's footer-exception entry.

## Done (gates, all on the branch tip)
- npm test: scripts suite 0 fail; src suite 2941/2941 pass.
- npm run test:worker: 235/235. npx tsc --noEmit: clean.
- lint:nav clean; lint:subjects GATE PASSED; lint-cards GATE PASSED;
  check:provenance PASSED.
- build:pages green; entry JS gzip 319,805 B vs the 323,865 B limit
  (4,060 B spare) via npm run check:entry-size.
- Named e2e (hermetic, --workers=1): shared-shell-adoption 3/3,
  layout-overflow 5/5. The Grandpa/Ko-fi family (coffee-run
  desktop/mobile/reduced, tasting-tour 23 pass, kofi cloud specs)
  shows local failures (#home URL push, tour-phase timing, bubble
  geometry) that reproduce IDENTICALLY on a pristine cbc119c3
  baseline build in this environment — A/B-verified, not
  regressions; CI is the arbiter for that family.
- External negative control: a hand-rolled GrandpaCoffeeRun import
  added to LoopScreen turned the registry test red; restored, green.
- Captures: after set = 8 pages x 5 viewports in
  footer-build-evidence (workspace). Every shot: footer present,
  Grandpa scene seated, band 168px, overflowX 0. Home before/after
  pair at 1280x800 + 390x844 matches (only the journal's timed
  rotation and animation phase differ). Board, review-end and
  why-learn@320 are viewport-at-foot shots: the local renderer's
  full-page stitching crashes on those pages in this VM (disclosed,
  environment limit).
- Owner-config spot check (390px): Why Learn + GeoDetective —
  footer below all content, nothing over the play surface.

## Next step
Independent Silo QA, then open the DRAFT PR and confirm CI on the
tip. STOP at the owner's merge word.

## Open questions
- None blocking. The Why Learn PR (#533) and this one both touch
  SubjectPicker.tsx (theirs: hero/container/band control; this one:
  footer region only) — merge-order resolution is Chitti's, per the
  owner's parallel-streams ruling.

## Ruled out / reversed
- Still-portrait Grandpa strip from the mocks (owner superseded it:
  "the granpa with coffee").
- Static import of the scene into SiteFooter was tried first and
  REVERSED: it pulled the scene's module graph into the entry
  bundle (entry JS gzip 329,403 B, 5,538 B over the limit), because
  on main the scene rode in game-app's lazy route chunk. SiteFooter
  now lazy-loads the scene; the band collapses via its :empty rule
  until the chunk lands, then the scene fades in at the page foot.
  End-state visuals are identical everywhere (captures prove it);
  the one delta is load timing of the band on first paint.
- Housekeeping done on the way: pruned 5 already-merged lanes'
  worktrees; removed node_modules/dist build artifacts under the
  stale bench-wt worktrees (sources untouched) after EDQUOT.
