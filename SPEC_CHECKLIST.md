# Motionmaxxing integration — spec checklist

Branch: `feat/motionmaxxing-meridian` · cut from `origin/main` @ `51ed7f5` (2026-10-11).
Owner order 2026-10-11; implements the Phase-1 scrum plan exactly. Chained-timer law,
$0/offline/keyless, no new dependencies, mobile transform/opacity-only.

## Implemented (M0–M7)

- [x] **M0** — `src/styles/motion-tokens.css` created; `@import`ed in `styles.css`
  right after tailwind. All 9 measured curves as tokens (`--ease-soft-land`,
  `--ease-glide`, `--ease-snap-settle`, `--ease-accel-exit`, `--ease-gentle-in`,
  `--ease-pop-over`, `--ease-whip`, `--ease-soft-in-out`, `--ease-cruise`).
  Global `prefers-reduced-motion` collapse: transitions → 0.01ms, animations →
  none. (The plan text said "12 curves" but named 9 tokens — all 9 named ones
  shipped; nothing was invented to reach 12.)
- [x] **M1** — `src/components/storyteller-mascot.css`: `storyteller-in`
  220ms `ease-out` → `var(--ease-soft-land)`; `storyteller-out` 150ms
  `ease-in` → `var(--ease-accel-exit)` (forwards retained). Durations FROZEN
  (narration-dismiss contracts). Reduced-motion opacity-only path untouched.
- [x] **M2** — GeoDetective clue-reveal `Rise` in `src/game/loop/LoopScreen.tsx`
  and its duplicate in `src/components/result-card.tsx`: 500ms → 400ms, curve
  now named via `var(--ease-snap-settle)` (inline style, same value as before).
  LoopScreen's `Rise` accepts an optional `index`; `ClueCard` passes the clue
  index; stagger = `transition-delay` from `CLUE_RISE_DELAY_MS =
  [0, 60, 125, 185, 255]` — gaps 60/65/60/70ms, uneven, in the 50–70ms band.
  Delay is forced to 0 under reduced motion; reduced-motion 150ms
  opacity-only fade untouched. The two `Rise` copies were NOT unified (plan
  made it optional — they differ in reduced-motion class handling; merging
  them buys nothing and risks the contracts).
- [x] **M3** — `src/components/grandpa-coffee-run.css`, CURVES ONLY, all
  durations/keyframe positions frozen: `kettle-drop` → `--ease-soft-land`
  (both strip + tour beats, 2800ms frozen); `pour-steam-burst` →
  `--ease-glide` (both beats); `cane-tap`: shorthand → `--ease-glide` for the
  down/plant segment, per-keyframe `animation-timing-function:
  var(--ease-pop-over)` on the 50% keyframe for the release (0.8s frozen);
  `bubble-pane-in` → `--ease-soft-land` (0.22s frozen). Ambient loops
  untouched: `grandpa-bob`, `steam-rise`, `mug-invite` (idle-motion ruling
  pending). Cloud POSITION untouched — pane-swap curve only.
- [x] **M4** — `src/components/grandpa-mascot.tsx` SQUASH: WAAPI
  `element.animate()` mechanism kept; keyframe offsets + 420ms total frozen;
  easing labels retuned — press segment (keyframe 0, which drives segment
  0→1 in WAAPI) → `cubic-bezier(0.61,1,0.88,1)` (glide); the three release
  segments → `cubic-bezier(0.34,1.3,0.64,1)` (pop-over). Reduced-motion skip
  untouched.
- [x] **M5** — `src/components/celebration-overlay.css`: `celebrate-pop`
  0.55s `cubic-bezier(0.2,1.4,0.4,1)` → `var(--ease-pop-over)`, duration
  frozen, fill-mode `both` retained. Children cascade: `.celebration-child`
  shares the pop; `-1` label @55ms, `-2` headline @120ms, `-3` copy @195ms —
  gaps 55/65/75ms, uneven ≈65ms. Wired in `celebration-overlay.tsx` onto the
  existing label `<p>`, `<h2>`, and body `<p>` (no score ring exists in the
  component; no new DOM). Confetti canvas untouched. The celebration
  entrance remains the app's ONE full pop moment; `--ease-pop-over` is
  otherwise budgeted only to the springy release segments the plan assigns
  (M3 cane-tap, M4 squash, M6 card release). Reduced-motion
  full kill untouched.
- [x] **M6** — `src/styles.css`: `.atlas-card .atlas-btn` press feedback,
  fire-and-forget CSS only. Press: `scale(0.97)` + `brightness(1.12)` over
  80ms `--ease-glide`; release: back to 1.0 over 200ms `--ease-pop-over`.
  No ripple, no `transition-delay`. `withCardTap` in `game-app.tsx` calls
  `playCardTap(); open();` synchronously — navigation never waits on the
  animation. No press feedback under `prefers-reduced-motion`.
- [x] **M7** — `src/styles.css` + `game-app.tsx`: `atlas-rise` keyframes,
  0.8s duration, softLand curve FROZEN (literal curve swapped for the token —
  value-identical). Stagger retuned from uniform 110ms to uneven 60–100ms
  via `RISE_DELAY = {0:0, 2:60, 3:135, 4:205, 5:290, 6:375, 7:450}ms` (gaps
  60/75/70/85/85/75); `--d` retired in favor of `--rise-delay`; the stamp
  keeps its frozen +380ms offset on the same base. Positions of the
  grandpa-tour stops unchanged.

## Handed off — NOT implemented here (M8)

For the sibling `feat/auto-animate` branch (it owns enter/exit/move DOM
transitions in GeoDetective containers, guess list, suggestions via its
`use-auto-animate` hook — this branch never mounted/unmounted/moved those
elements and never edited its files):

| Element | Motion spec |
|---|---|
| GeoDetective container enter | `var(--ease-soft-land)` |
| GeoDetective container exit | `var(--ease-accel-exit)` |
| Guess rows glide-in | `var(--ease-soft-land)`, 400ms, 1–3f uneven stagger |
| Suggestions | translate-dominant entry; demote fade to a 4–6f helper |
| Global cap | every transition < 400ms |

Tokens live in `src/styles/motion-tokens.css`; the sibling branch may
reference them directly (document-global `:root`).

## Deliberately NOT touched — and why

- **Idle sway / theatrical 5–7s motion / spot-listen greet-01+greet-03** —
  the owner's motion rulings are pending; no ambient loops added, removed,
  or retuned (M3 left `grandpa-bob`, `steam-rise`, `mug-invite` alone).
- **Narration timing** — 220ms/150ms storyteller durations and all
  narration-dismiss contracts frozen (M1 curves only).
- **Map canvas (`LoopMap`)** — out of scope.
- **auto-animate's three containers** (GeoDetective containers, guess list,
  suggestions) — sibling branch owns; division of labor per plan. M8 is a
  spec table only.
- **Cloud POSITION** — the sibling cloud-positioning branch owns it; this
  branch touched only the `bubble-pane-in` curve (M3), single-line.
- **The two `Rise` duplicates** — left un-unified (optional in plan;
  differing reduced-motion handling, no benefit to merging).

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — full suite green (1119/1119), incl. new `src/motionmaxxing.test.ts`
  (29 tests: token values + reduce collapse; M1–M7 curve/duration/stagger/
  no-delay assertions). No jsdom in the repo harness, so the "computed
  transition-duration ≈ 0.01ms under forced reduced-motion" assertion runs
  live in the Playwright reduced-motion E2E pass instead.
- `node scripts/lint-cards.mjs` — GATE PASSED.
- `npm run build:pages` — green; E2E runs against rebuilt dist.
- Playwright `motionmaxxing` + `motionmaxxing-reduced` (9/9) —
  `tests/e2e/motionmaxxing.spec.ts` + `tests/e2e/motionmaxxing.reduced.spec.ts`:
  transitions complete, computed curve/duration/delay assertions, press
  feedback + immediate navigation, reduced-motion collapse (≈0.01ms) + full
  kill, mid-celebration reduced-motion flip, tap storms, console gate
  (React #418 filtered — pre-existing flaky hydration warning per the
  established celebration/cleared-mode/difficulty-picker specs).
- Visual baseline diffs @390px + @1280px (pre-change 51ed7f5 vs this
  branch, rest-state after settle, PIL pixel-diff): home top + editions
  tour stop pixel-identical at both widths (0.000% >8/255 delta);
  loop-clues identical; celebration card content identical (0.714% delta
  confined to confetti positions + float-bob phase — continuous ambient,
  not layout). No layout drift; tour stops pixel-stable.
- Regression: existing celebration, geodetective, grandpa-coffee-run
  (mobile/desktop/reduced), storyteller-home + storyteller-tapstart
  (mobile) specs re-run green on the final build.
- **Screen recordings** (constitutional rule 2026-10-11 — build → test →
  RECORD → owner watches → Chitti): `docs/motion-verify/` in this branch,
  real-time, one journey per clip:
  - `home-entrance-1280px.mp4` — atlas cascade with uneven stagger
  - `edition-press-1280px.mp4` — 80ms glide press + pop-over release, then
    immediate navigation
  - `clue-stagger-390px.mp4` — two wrong guesses, clues cascade at
    400ms + uneven index delays
  - `celebration-pop-390px.mp4` — the one overshoot + child cascade
  - `grandpa-tour-beats-390px.mp4` — tasting-tour beats on mobile
  - `reduced-motion-390px.mp4` — zero animation, fully usable
  Recorded with `scripts/record-motion-verify.mjs` (`--only <name>` to
  re-record one).

## Merge / rebase notes

- Rebased onto latest `origin/main` → zero conflicts. M3's
  `grandpa-coffee-run.css` overlaps the sibling cloud-positioning branch
  (it owns cloud POSITION); if that branch merged, the overlap resolved
  cleanly — curve-only lines, no positional edits.
- **Ready to merge? NO** — consequential PR; merge-ready requires the
  Chitti/owner's-panel independent review. Merging is the owner's call.
- **What is pending:**
  - Owner's pending motion rulings: idle sway vs "no idle motion",
    theatrical 5–7s vs calm toggle, spot-listen greet-01 + greet-03.
  - Chitti/owner's-panel independent review verdict (merge-ready gate).
  - The sibling `feat/auto-animate` branch picks up the M8 handoff table.
  - Owner's merge decision (per-PR authorization; default deny).
