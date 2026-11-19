# Branch status — fix/footer-links-visible

## Done
- Root cause [measured]: PR #534 moved Home's SiteFooter out of
  `<main class="atlas-home">`, so the footer lost the
  `.atlas-home > :not(.atlas-bg)` lift (position: relative; z-index: 1).
  As a static element (computed position: static, z-index: auto) it
  paints UNDER Home's fixed, opaque `.atlas-bg` backdrop
  (position: fixed, z-index: 0). Links kept boxes, colours
  (rgb(92,103,98)), opacity 1 and working hit tests — the backdrop's
  gradient simply painted over the text. Control: the same static
  footer on /privacy (no `.atlas-bg` there) paints its links fine.
  Pixel proof on the unfixed build: 0 px of the grown-ups link's own
  text colour inside its box.
- Fix (one place, shared): `.agep-footer` in age-profile.css now
  carries its own lift — `position: relative; z-index: 1;` — the
  stylesheet SiteFooter already imports, so every page's footer is
  fixed at once. Layout-neutral: no box, label, order or copy change;
  z-index 1 stays below the header (30), overlays (40+) and toast (90).
- Regression pin: `tests/e2e/footer-links-visible.desktop.spec.ts`
  asserts RENDERED visibility (screenshot of each link's box decoded
  in-page; ≥40 px of the link's computed text colour) + toBeVisible +
  the footer's own lift, at 1280×800 and 390×844. Sabotage control:
  final spec FAILS on unfixed code at both viewports (0 matching px)
  and PASSES on the fix (2/2).
- Grandpa loop report [measured]: on Home he walks once and parks —
  1280×800: walking → kettle ~4s → walking → seated ~12s; 390×844:
  seated ~16s; still seated at t=61s after scrolling the footer out
  of view and back. No re-walk. What loops is only the seated ambient
  motion (bob, steam, 6s mug invite) — the approved finale. No change.
- Gates on the fixed build: npm test scripts 1,209 + src 2,956 pass,
  0 fail · test:worker 235/0 · tsc --noEmit clean · lint:nav clean ·
  lint-cards GATE PASSED · build:pages green · check:entry-size
  319,746 B (limit 323,865) · new pin 2/2 · grownups-privacy-contact
  4 passed / 1 failed in-suite ("Begin exploring": map not loaded in
  15s under VM contention; A/B — passes alone on BOTH unfixed and
  fixed builds, so an environment flake, not this change) ·
  home-layout.desktop 9/14 locally under multi-crew e2e-lock
  contention (5 failures all "element not found"/timeout boot
  starvation; CI carries the full suite).
- Captures (before/after, Home page bottom, Grandpa parked):
  ~/workspace/footer-fix-evidence/{before,after}/ — 1920×1080,
  1280×800, 768×1024, 390×844, 320×568. Local builds set
  VITE_KOFI_URL (the project's public Ko-fi page, as in prior e2e
  runs) so the Grandpa scene mounts as it does live.

## Next step
- Owner's merge word on the draft PR. Nothing else is queued on this
  branch.

## Open questions
- None for the owner. CI on the PR is the arbiter for the full e2e
  suite (local runs were contended by parallel crews on this VM).

## Ruled out
- Colour/opacity/visibility causes: all computed values were normal
  on the unfixed build; the text was painted, then covered.
- Moving the footer back inside `<main>`: would split SiteFooter's
  fragment (links + Grandpa band) and undo #534's composition; the
  shared class carrying its own lift fixes every host at once.
- Grandpa "looping" as a defect: measured walk-once-and-park at both
  widths; the endless motion is the designed seated ambience only.

## Graph
- No graph nodes added: this branch changes no structure, only
  restores the paint order the shell contract already documents.
