# BRANCH_STATUS — fix/grandpa-tour-duplicate-walker

Owner: Muse · Branch: `fix/grandpa-tour-duplicate-walker` · Base: origin/main @ ce88939
· Created: 2026-10-10. **DO NOT MERGE** — PR opened after gates; merge is the owner's decision.

Standing rules: named-file staging only, never `git add -A`. $0/offline/keyless.
Locked Ko-fi copy must stay byte-identical (verified by grep after every edit):
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done (2026-10-10)

Owner report: on a fresh mobile load, TWO grandpas visible — one walking the
tasting-tour trail toward the destination, the other parked waiting there.
Confirmed on the live prod site via Playwright probe (tourWalker: 1,
stripWalkerVisible: true, mode: "tour", stage: "walk").

Root cause: in `tour` mode the strip walker got `pointer-events: none` but was
never hidden — the file's own header comment said the intent was "(walker
hidden)", while a CSS comment claimed "stays parked — visibly". The parked
walking-pose figure at the bench read as a second grandpa.

Fix (`src/components/grandpa-coffee-run.css`): in `tour` mode, hide
`.grandpa-bob` (figure + kettle) and `.park-vignette`; the donation cloud is a
sibling span, so it stays visible as the Ko-fi entry from the first beat.
Stale CSS comment corrected to match.

Regression test (`tests/e2e/grandpa-tasting-tour.spec.ts`): "tour walk: only
one grandpa on screen — the parked strip figure hides" — asserts the tour
walker is visible, the strip figure + vignette are hidden, and the cloud ask
button stays visible.

## Pending

- Full gates (tsc, npm test, lint-cards, build:pages, Playwright grandpa specs)
- Open PR + scrum review (build → test → rebase → retest → verify)
- Ko-fi "link not loading": lab-verified the tap flow works end to end
  (ask → gate → Continue → window.open with the correct URL baked in the prod
  bundle); the destination ko-fi.com is unreachable from this lab's network.
  Awaiting owner's answer on what exactly happens on his device.
