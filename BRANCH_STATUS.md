# BRANCH_STATUS — feat/storyteller-home

Storyteller home handoff (H1, frontend dev) on top of origin/main@f4f92ad.
Spec: `~/workspace/specs/storyteller-home-handoff.md` · copy pack:
`~/workspace/specs/storyteller-copy.md` (kid copy lift-verbatim, never
invented). Local branch; commit, do NOT push (tester reviews first). Never
merge — owner merges.

Owner decisions implemented exactly: figure 96px @390 / 144px @1280 · hero
strip ≤112px @390 / ≤160px @1280 · auto-narrate on first gesture when sound
on (consumes the session's one auto-narration) · no idle motion · 2 poses
(idle + pointing) · Comet emblem ~30px static aria-hidden inline in the
eyebrow row · NO visible name · catchphrase "Shh… listen." reserved (never
in greetings/poke) · narration voice unchanged (TruthTeller mp3s land later).

## Done (prior squad, ce193c8 — "shorten mobile tasting tour so the donation cloud appears sooner")

### New files
- `src/components/storyteller-home.tsx` (default export, React.lazy) —
  `StorytellerHomeHost` implementing the spec §3 state machine:
  `absent→entering→greeting_text→(first gesture+sound on)→greeting_audio→
  (end|dismiss|12s)→idle_linger→(navigate|tour|dismiss|timeout)→exiting→
  absent`; tour/celebration → `yielded` (fully unmounted, no background
  audio) → close → re-resolve (copy G2: tour-return line wins exactly once,
  text-only + bow, then the flag clears).
- `src/components/storyteller-home-copy.ts` — locked copy byte-identical:
  greet-01…06, post-tour return, 7 send-offs, 5 poke lines, leaf + scroll-tap
  captions; `decideHomeMode` (G2), day-of-year mod 6 rotation, day keys.
- `src/components/storyteller-session.ts` — sessionStorage flags: session
  auto-narration claim (copy §5), tour-return arm/take (exactly-once),
  greeting day key. Fail-closed without storage.
- `src/components/storyteller-home.css` — hero strip, 44px dismiss
  overhanging the bubble corner, bow, falling leaf, send-off overlay
  (z-30, ≤2.5s); reduced motion ≤150ms opacity fade only.
- `src/components/comet-emblem.tsx` — static ~30px Comet SVG, aria-hidden,
  decorative, never speaks (+ CSS block in `comet-mascot.css`).
- `public/assets/storyteller/storyteller-assets.json` — F1/F2 manifest
  (idle → placeholder JPEG, pointing → null, greet-01…06 → null); the host
  resolves pose/audio URLs from it, zero code change on swap.
- `src/components/storyteller-home.test.ts` — 16 unit tests (copy contract,
  rotation, G2, session flags); registered in package.json `test`.
- `tests/e2e/storyteller-home.{mobile,desktop,reduced}.spec.ts` — picked up
  by the existing mobile/desktop/reduced projects; replaces the retired
  comet-mascot specs (deleted).

### Modified
- `src/components/game-app.tsx` — eyebrow row: eyebrow → CometEmblem →
  sound toggle; NEW hero strip (`<Suspense><StorytellerHomeHost/>`) between
  the eyebrow row and the h1 banner row; `CometMascot` removed from home;
  dead `comet:edition-select` dispatch removed; GeoDetective pick dispatches
  `meridian:storyteller-sendoff` (copy G3 — navigation never waits);
  stagger `rise()` renumbered 2…7 below the strip (visual order kept).
- `src/components/storyteller.tsx` — `StorytellerMascot` takes an optional
  `src` prop (asset URL; defaults to the placeholder figure).
- `src/components/result-card.tsx` — story auto-narration now also gated on
  the session flag: home greeting consumes it → later story cards are text
  + speaker button only (no double-audio).
- `public/sw.js` — H1 precache: idle pose + greet-01 mp3 only (per-asset
  fail-soft, so a missing mp3 never blocks the pose); `/Meridian/images/`
  added to runtime cache-first. Per eng: runtime-cache preferred for oldest
  devices; v1 storyteller mp3s (reveal/hook/summary) now runtime-cached
  instead of install-precached.
- `src/components/comet-mascot.css` — static emblem styles.
- `package.json` — registered `storyteller-home.test.ts`.

### Eng must-fix — all done
- Session auto-narration flag (sessionStorage): home greeting consumes it
  only when greeting audio actually starts (`play()` resolves); story cards
  degrade. Day-1 (no mp3s): text-only greeting, flag untouched, story cards
  keep their existing first-reveal auto-narration — no behavior regression.
- G1 12s timer: starts on audio begin; cancels on end/dismiss/navigation/
  tour open/sound-off/tab-hidden; at expiry audio stops, bubble stays
  text-visible → `idle_linger`.
- Hero budget: Playwright visual assertion (difficulty picker bottom ≤844
  @390×844) in `storyteller-home.mobile.spec.ts`.
- Micro-delights: all 4 ship — scroll-tap hello (double-tap), pointer-stick
  send-off (pointing pose when the manifest provides it, else skipped
  silently), tour-return bow, falling laurel leaf (static sprig + caption
  under reduced motion).

### Deliberate deviations / notes
- No speaker button on the home greeting: the auto path plays on first
  gesture; the text-only path (muted / day-1 no-mp3) has nothing to play.
  (Spec §2's "speaker/replay 44px" describes the card pattern; the home
  bubble carries the 44px dismiss instead.)
- The greeting bubble has no auto-dismiss on the future mp3 path until the
  first gesture — any tap is a gesture, so it resolves immediately in
  practice.
- `withCardTap` keeps its `(edition, open)` signature (call sites
  unchanged); the edition arg is now unused.
- SW: v1 mp3s moved from install-precache to runtime cache-first per the
  eng note (oldest-device install budget).

## Gates
- `npx tsc --noEmit` — clean
- `node scripts/lint-cards.mjs` — GATE PASSED
- `src/components/storyteller-home.test.ts` — 16/16 green
- `npm test` (full suite) — 993/993 green
- `npm run build:pages` — green (storyteller-home lazy chunk in dist,
  locked copy only in that chunk, manifest copied to dist)
- Playwright `storyteller-home.mobile` — 8/8 green (incl. the 112px hero
  budget + difficulty-picker-in-first-fold visual assertion)
- Playwright `storyteller-home.desktop` — 2/2 green
- Playwright `storyteller-home.reduced` — 2/2 green
- `storyteller.spec.ts` (story cards) — environmental flake on this VM:
  the 13.7MB globe chunk takes ~10s cold through the SW cache vs the
  15s `startGlobeRun` timeout; 2/3 reruns pass on this branch, and it
  passes on base too. Unrelated to this change (story-card logic
  untouched; session flag is a no-op when unset).

## QA re-verification (2026-10-09, final head 38ca3b6) — all green ✅
- `npx tsc --noEmit` clean · `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` green · `npm test` 993/993 (0 fail) ·
  Playwright 12/12: storyteller-home.mobile 8/8 (96px figure, ≤112px strip,
  picker in first fold @390×844, once/day greeting text-first role=status,
  same-day silent, poke rotation + scroll-tap, send-off ≤2.5s nav-never-waits,
  tour yield + return line once text-only, keyboard dismiss focus, Comet ≤32px
  aria-hidden, zero console errors), desktop 2/2 (144px figure, ≤160px strip,
  emblem 28–32px in eyebrow row, no comet-mascot host), reduced 2/2
  (fade-only ≤150ms, instant captions, static leaf sprig).
- Locked copy re-audited byte-identical vs `~/workspace/specs/storyteller-copy.md`:
  greet-01, tour-return, 7 send-offs, audio-fail fallback, scroll-tap + leaf
  captions; Ko-fi + age-band copy zero diff vs origin/main. "five hidden
  places" absent everywhere; "so many hidden places" reserved, not shipped
  (same as main).
- `storyteller.spec.ts` known VM flake: "replay replays the line" failed once
  on the branch (180s timeout at replay.click), passed on immediate retry on
  the branch, and passed on origin/main build (41s) — environmental, unrelated,
  not chased. Story-card logic untouched by this branch.

## Locked copy — verified byte-identical (script vs specs)
greet-01…06, post-tour return, 7 send-offs, 5 poke lines, leaf + scroll-tap
captions, audio-fail fallback (reused export). Ko-fi strings + age-band copy
untouched (files not in this diff; `git status` confirms).
