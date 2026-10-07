# BRANCH_STATUS — feat/grandpa-park-workflow

Veeresh's park-workflow rework of Grandpa's Coffee Run (2026-10-07).
UX-expert + UI-frontend-developer lens: the whole donation flow lives in the
cloud so the UI never gets crowded.

## Done
- [x] Beat 1: slow stroll (~9.5s), dotted trail — NO thought cloud during walk
- [x] Beat 2: kettle drops in a dolly-vertigo move (descends while scaling
      0.25→2.6x toward the viewer, spout-tip transform-origin), tilts, pours
      (visible stream), fills the mug (clipped fill rises + steam burst),
      rises/fades away (~2.8s spectacle)
- [x] Beat 3: park finale — SVG tree + wooden bench fade in behind grandpa;
      chair removed from his SVG; he sits ON the bench facing the viewer
- [x] Head fixed, NO pointer tracking (Comet keeps its own); periodic
      mug-lift invite + steam puff every ~6s is the attention-grabber
- [x] Beat 4: cloud workflow — tapping grandpa OR the cloud swaps the cloud
      content (animated) to the "ask a grown-up" gate INSIDE THE SAME CLOUD:
      "You're leaving Meridian to visit Ko-fi. Ask a grown-up!" /
      "Meridian is free forever — every game, every map, every mystery." /
      [Continue] [Cancel]; Continue → Ko-fi new tab + cloud reverts;
      Cancel/Esc reverts; Continue focused on open
- [x] Walker is now div role=button (was <button>) so the cloud can hold real
      buttons; keyboard: Enter/Space opens, Esc cancels
- [x] Deleted support-gate-dialog.tsx + .css (grandpa was the only importer)
- [x] Hard rules: inline SVG only, zero sfx/analytics, env-gated, hidden
      offline, no gameplay gating, reduced-motion → static park scene
- [x] tsc clean
- [x] Unit suite green (837/837)
- [x] lint-cards.mjs GATE PASSED
- [x] build:pages green WITH Ko-fi URL; green WITHOUT (fail-closed: 0 ko-fi
      URL hits in no-env bundle)
- [x] Playwright E2E 13/13: 8 desktop (walk no cloud, kettle drop+pour+fill,
      park tree+bench, tap grandpa→gate, tap cloud→gate, Continue→Ko-fi+revert,
      Cancel/Esc revert, keyboard, offline, CTA coverage) + 3 mobile + 2 reduced

## Pending
- [ ] Push branch, open PR (Veeresh merges)
