# BRANCH_STATUS — feat/storyteller-banner

Owner-corrected storyteller banner rework (2026-10-09). Branch off origin/main@df3f46c.
NEVER merge — owner merges.

## What the owner ordered (overrides the #114 spec)

1. Storyteller figure lives IN THE BANNER beside the Meridian branding — always visible, mobile + desktop. Separate hero strip (`StorytellerHomeHost` + `.storyteller-home-strip`) deleted.
2. Narration plays on EVERY home visit; the only silence is the user's mute toggle. Once-per-day logic (`GREET_DAY_KEY`, `readHomeGreetDay`, `writeHomeGreetDay`) and the `decideHomeMode` "silent" path deleted entirely.
3. No visible name (unchanged).

## Done

- [x] Worktree `~/workspace/meridian-banner` on `feat/storyteller-banner` off origin/main@df3f46c
- [x] New `StorytellerBannerFigure` (direct import, decorative, aria-hidden, no tap target) in `.atlas-banner-row`
- [x] Rewritten `StorytellerBannerHost` (lazy): greeting bubble + dismiss anchored under the banner, every-visit narration policy
- [x] `storyteller-home-copy.ts`: `decideHomeMode`/`HomeGreetingMode` deleted; locked copy untouched
- [x] `storyteller-session.ts`: greet-day storage deleted; session + tour-return flags kept for story cards
- [x] `storyteller-home.css`: hero-strip CSS deleted; banner figure + popover styles
- [x] `scripts/render-storyteller-voice.mjs`: `--greetings` mode for the 6 GREETINGS lines (contract gate 6/6 OK)
- [x] Manifest `audio` map → `audio/storyteller/greet-0N.mp3`
- [x] Unit tests rewritten (every-visit policy)
- [x] E2E specs rewritten (banner placement, every-visit greeting, 360/390 no-overlap)
- [x] Gates: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 992/992 · Playwright 13/13
- [x] Ko-fi strings (3) + storyteller copy verified byte-identical vs origin/main

## Gate results (2026-10-09)

- `tsc --noEmit`: clean
- `node scripts/lint-cards.mjs`: GATE PASSED
- `npm run build:pages`: green (exit 0; postbuild fingerprinted)
- `npm test`: 992/992 pass
- Playwright (mobile + desktop + reduced + dismiss-overlap, --workers=1): 13/13 pass
  - figure × h1: 0px² overlap @360px and @390px (AGENTS.md rule #1)
  - dismiss × sound toggle: 0px² @360/@390 (existing spec, still green)
  - every visit greets (first load + reload), tour yield keeps figure visible, send-off ≤2.5s

## Design decisions

- Figure size: 44px mobile / 48px @≥1024px, circular, in the banner row (flex-end aligned with the h1).
- No tap target on the figure (owner: decorative banner chrome) → poke + scroll-tap interactions removed; POKE_LINES/SCROLL_TAP_LINE stay exported and locked for future use.
- Tour-return bow dropped: it animated the figure, which is now a separate always-visible component; the locked return line carries the beat.
- Bubble is an absolute popover under the banner row (no layout shift, no hero strip); 44px mid-right dismiss keeps the #116 QA fix.
- `tutorialInviteVisible` kept on the host: the bubble stays quiet while the tutorial invite shows (competing popups — unrelated to the strip).
- Figure stays visible during tours (banner chrome); the host's bubble/audio still yields.
- Narration: attempt `play()` on mount when sound is on; on autoplay rejection attach one-shot pointerdown/keydown → re-check `isSoundEnabled()` → play. Muted at mount → no attempt. No retro-play on later unmute. No session-flag consumption (story cards keep their own flag).

## BLOCKER — greeting mp3s cannot be rendered here

`public/assets/storyteller/storyteller-assets.json` ships all six `greet-0N` mp3s as `null`, so `greetAudio` is always null and narration can never play. The Kokoro toolchain (`scripts/render-storyteller-voice.mjs`) fails loudly in this VM: `~/workspace/aidemo-pilot/engine` (kokoro-js) does not exist and there is no local HuggingFace model cache. ffmpeg/ffprobe ARE present. Per the standing rule: no speechSynthesis substitution, and the text-only degrade is not shipped silently — the fail-closed path (text + "The words are right here — read along with me.") is the honest behavior until the mp3s land. The script's new `--greetings` mode is ready to run wherever Kokoro exists; the manifest already points at `audio/storyteller/greet-0N.mp3`.
