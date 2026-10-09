# BRANCH_STATUS — feat/homer-storyteller

**Branch:** `feat/homer-storyteller` · **Base:** origin/main@044befc (#120)
**Status:** implementation sprint running (3 workers). NEVER merge — owner merges.

"Homer-style storyteller — dramatic voice + dramatic motion."

## Track A — narration voice fix (Game Audio Engineer)
- [x] Mismatch CONFIRMED: old greets were TruthTeller cloud renders
      (−33.1 LUFS unmastered; commit 722a51f says "add TruthTeller greet mp3s")
- [x] Re-rendered greet-01…06 from EXACT GREETINGS captions via new
      scripts/render-storyteller-greets.mjs: local Kokoro am_fenrir @ 1.05,
      −16 LUFS, true peak ≤ −1.5 dBTP, 24kHz mono, caption==audio char-for-char
      (all ≤38KB, staged in ~/workspace/meridian-homer-audio, not yet merged
      into this branch)
- [ ] Merge audio worktree changes into this branch + gates

## Track B — Homer-style dramatic motion (Technical Artist + UI Designer) DONE
- [x] Theatrical entrance (homer-arrive 650ms), speaking presence
      (homer-breath + shimmer ring on greeting_audio), poke startle,
      graceful 220ms yield recede, idle sway (4.5s, ±2px — barely-there)
- [x] CSS keyframes only, transform/opacity, scoped .storyteller-banner;
      reduced-motion default ≤150ms fade, full motion in no-preference only
- [x] tsc clean in worktree; storyteller unit tests 7/7 + 16/16
- Trade-offs for owner: (1) supersedes earlier "no idle motion" note in
  css — confirm he wants the sway; (2) yield delays null-unmount 220ms;
  (3) rare pop if audio starts <650ms into arrival; (4) sendoff exiting
  now bows out 260ms (strippable).

## Diagnosis — owner hears no narration on device (QA, read-only) DONE
- VERDICT: real bugs, not just device state.
- Bug 1: Grandpa's tour auto-runs on mobile → host yields → greeting mp3
  unreachable; after tour, text-only tour-return line (no mp3 by design).
  Zero e2e coverage (seedQuietHome suppresses the tour in every test).
- Bug 2: tutorial-invite dismiss tap is swallowed — first tap eats it,
  narration needs a SECOND tap. Fresh devices affected.
- Device-state suspect: persisted meridian.sound="off" (toggle is a tiny
  20px icon, no muted indication in bubble); muted first tap permanently
  consumes the one-shot.
- Minor: dismiss × has no tap-guard; manifest failure cached for session;
  play() never settling leaves phase stuck.
- Fixes need OWNER decisions: (a) intended post-tour behavior (copy G2
  mandates text-only return line); (b) invite-dismiss tap = first gesture;
  (c) don't consume one-shot when muted + muted indicator; (d) × tap-guard;
  (e) manifest retry. NOT fixed in this sprint — reported for his call.

## Gates (before PR)
- [ ] tsc clean · npm test green · lint-cards PASSED · build:pages green
- [ ] Playwright storyteller specs green
- [ ] Locked copy byte-identical · no paywalls · $0/offline/keyless
