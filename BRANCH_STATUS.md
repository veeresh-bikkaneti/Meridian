# BRANCH_STATUS — fix/live-site-issues

**Branch:** `fix/live-site-issues` · **Base:** origin/main@df3f46c · **Head:** ffecf25
**Status:** all 3 fixes landed, all gates green, ready for PR. NEVER merge — owner merges.
Live-site issues sprint branch (off origin/main).

## Landed (2441e4e)
- Issue 1: desktop seated Ko-fi cloud right-anchored in-viewport
  (src/components/grandpa-coffee-run.css). Locked Ko-fi strings untouched.
- Issue 2: TruthTeller greet mp3s (greet-01…06) + manifest wiring
  (public/audio/storyteller/greet-*.mp3, public/assets/storyteller/storyteller-assets.json).

## In progress — Issue 3: storyteller banner redesign (owner directive 2026-10-09)
The storyteller sits IN THE BANNER beside the Meridian branding — always
visible, mobile and desktop, no hero strip. Narration plays on EVERY home
visit; the ONLY silence is the user's own mute toggle. No once-per-day, no
same-day-silent-return, no visible name.

### What changed
- `src/components/storyteller-home.tsx` — rewritten as the banner host:
  56px figure in the banner row; greeting rides in an absolute popover below
  the row (no layout reflow). Deleted once-per-day gating
  (`readHomeGreetDay`/`writeHomeGreetDay`/`takeTourReturnLine`/`decideHomeMode`
  usage gone) and the tour-return line; every home mount greets text-first,
  audio on first gesture when sound is on. Kept: 12s audio cap, text-first
  fallback, audio-fail fallback line, poke lines (tap figure → rotating
  lines), mid-greeting tap pause/resume, loop send-off overlay (copy G3),
  session auto-narration consume on audio start, tour/celebration yield,
  reduced-motion (opacity fade only), keyboard-dismiss focus. Dropped:
  tour-return, leaf delight, scroll-tap double-tap. Locked copy byte-identical.
- `src/components/storyteller-banner-shell.tsx` — NEW: light module with the
  56px chunk-load skeleton + an error boundary that fails closed to a static
  figure (banner never breaks home).
- `src/components/storyteller-home.css` — rewritten for the banner: 56px
  figure, popover, 44px dismiss mid-right INSIDE the popover (below the
  banner row — can never reach the eyebrow sound toggle, #116 lesson kept).
- `src/components/game-app.tsx` — host moved into `.atlas-banner-row` beside
  the h1; skeleton + boundary wired; old hero-strip mount removed. Comet
  emblem untouched in the eyebrow row.
- `tests/e2e/storyteller-home.{mobile,desktop,reduced}.spec.ts` — rewritten
  for banner behavior (56px figure, every-visit greeting, legacy greetDay
  seed must NOT silence, mute = only silence, poke rotation, send-off,
  overlap @360/390, focus return).
- `tests/e2e/dismiss-overlap.mobile.spec.ts` — updated to the banner popover
  dismiss selector (0px² overlap regression kept alive).

### Gates (final head)
- [x] `tsc --noEmit` clean
- [x] `node scripts/lint-cards.mjs` GATE PASSED
- [x] `npm run build:pages` green (exit 0; nosw-hatch marker present in _shell.html)
- [x] `npm test` green (993/993)
- [x] Playwright storyteller specs passing: 14/14 (mobile 390×844: 10 incl.
      dismiss-overlap @360/390 0px²; desktop 1440×900: 2; reduced: 2)
- [x] Browser QA: figure visible in banner @390 + desktop, greeting plays on
      first gesture, mute toggle = only silence, zero console errors

### Locked-copy verification (final head)
- [x] 3 Ko-fi strings byte-identical (grandpa-coffee-run.tsx unmodified vs HEAD)
- [x] storyteller locked lines byte-identical (copy/session modules unmodified;
      unit contract pins them, 993/993 green)

### Environment notes (for the coordinator)
- This worktree had no node_modules: copied from ~/workspace/meridian
  (read-only source, never modified). The shared tree is untouched.
- Found a landmine: `~/workspace/meridian/node_modules/node_modules` is a
  SYMLINK to `~/workspace/meridian-storyhome/node_modules` — it made the
  build resolve @tanstack/react/react-dom from the WRONG tree (dual-React
  prerender crash, "Prerendered 0 pages"). Deleted only the copy inside this
  worktree; the shared tree still has the symlink (flagging, not touching).
- /tmp is 100% full on this VM (other agents' scratch); Chromium cannot
  launch. E2E was run with `TMPDIR=/home/hatch/workspace/.tmp-e2e`.
- Branch gained 832c5bf (Ko-fi test assertions) mid-task; work rebased onto it
  via stash (no conflicts).
