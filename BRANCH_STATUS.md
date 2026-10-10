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

## Owner's 4 rulings (2026-10-09) — implementation + review scrum
- [x] Ruling #1: greeting plays regardless of tour — after the text-only
      tour-return line, the normal greeting runs (mp3 on gesture).
      NOTE: first attempt (chained t1/t2 timers in one effect) STALLED at
      runtime — t1's setPhase ran effect cleanup, killing t2. Chitti caught
      it. Fixed via dedicated follow-up effect guarded on
      (yielded, mode, phase) — commit 503740f.
- [x] Ruling #2: tutorial-invite dismiss counts as the first gesture —
      beginGreetingAudio on dismiss (transient activation).
- [x] Ruling #3: idle engagement — music notes + unfurling scroll,
      CSS-only, idle_linger only, reduced-motion safe. OPEN OWNER QUESTION:
      idle sway ships against standing "no idle motion" directive —
      confirm or kill.
- [ ] Ruling #4: merge only when everything is ready — review scrum running.
- [x] Regression test added (mobile spec): tour closes → return line →
      greeting → tap starts narration. Verified FAILS pre-fix, PASSES post-fix.
- [ ] Open owner questions from Chitti: (a) idle sway confirm/kill;
      (b) theatrical motion for 5–7 band vs calm toggle;
      (c) spot-listen greet-01 + greet-03 before merge.

## Review scrum (2026-10-09) — 8-persona team, read-only + fixes
- Verdicts: PASS — Technical Artist, Game Audio Engineer. CONCERN (non-blocking)
  — Narrative Designer (copy hygiene), Accessibility Auditor (motion safety =
  open owner Q), Game Designer (4 interaction defects), Test Automation
  Engineer (rulings #2/#3 lacked runtime tests — now added).
- BLOCKs found and fixed on the branch:
  1. Code Reviewer: celebration during greeting_audio killed the 12s cap
     timer, phase stuck at greeting_audio forever → yield effect now parks
     in idle_linger when interrupting narration.
  2. Code Reviewer: first-gesture listener stayed live during yield (tap
     mid-tour started audio over the tour) → effect now bails when yielded.
  3. Game Designer: invite dismissed mid-tour narrated under the tour →
     invite effect returns early when yielded; post-tour flow greets.
  4. Reality Checker: dead export resetStorytellerHomeForTests → removed.
- Regression tests added (each verified FAIL pre-fix / PASS post-fix):
  tour-return→greeting, invite-dismissed-mid-tour, invite-dismiss-starts-
  narration, idle-engagement-gating, celebration-no-stall.
- Remaining CONCERNs (owner calls, not blockers): return-line dismiss voids
  the follow-up greeting; text-only fallback never reaches idle_linger;
  figure-first-tap poke/gesture race; POKE_3 Troy tease; idle sway vs the
  standing "no idle motion" directive (owner to confirm or kill).

## Panel round 2 (2026-10-10) — 5 BLOCKs fixed, each with regression test
Owner's independent panel verified the 3 earlier fixes as sound, found 5 new
BLOCKs. All fixed on the branch; each regression test verified FAIL pre-fix /
PASS post-fix via stash dance (source stashed, tests kept, rebuilt, re-ran).
- [x] BLOCK 1: invite-dismiss played the greeting mp3 under the text-only
      return line — tutorial-invite effect now returns early when
      mode === "tour-return". Test: "invite dismiss after tour: no greeting
      mp3 under the text-only return line" (FAIL pre / PASS post).
- [x] BLOCK 2: CSS specificity tie (0,3,0) let the later idle-sway rule beat
      poke startle + yield recede — both selectors raised to 0,4,0 via
      doubled figure class, with explanatory comments. Test: "poke startle
      + yield recede win over idle sway" (computed animation-name; FAIL
      pre / PASS post).
- [x] BLOCK 3: dismissing the return line was a dead end (silence forever) —
      returnLineDismissedRef flag; follow-up effect now also fires on
      idle_linger + flag (900ms), greeting still follows a dismiss. Test:
      "dismissing the return line still leads to the greeting" (FAIL pre /
      PASS post).
- [x] BLOCK 4: yielded guards had zero regression coverage — new test
      "gesture under tour: no audio starts, greeting resumes after"
      (guard-lock: passes unless the guard is removed).
- [x] BLOCK 5: muted first tap silently killed narration — now shows a
      one-line hint in the bard voice, then restores the greeting caption;
      routed through bubbleTimer so a dismiss cancels the restore. NEW copy
      ("Psst — your sound is off, young explorer. Tap the speaker above to
      hear my tale.") — OWNER/PANEL COPY APPROVAL REQUIRED before merge.
      Test: "muted first tap shows the sound-off hint" (FAIL pre / PASS post).
- Gates on this head: tsc clean · 993/993 unit · lint-cards GATE PASSED ·
  build:pages green · Playwright storyteller 22/22 (desktop 2, mobile 18,
  reduced 2). Rebase onto origin/main@044befc: no-op, zero conflicts.
- NOT merged — verdict belongs to the independent panel. 3 open owner
  questions unchanged: (a) idle sway confirm/kill; (b) theatrical for
  5–7s vs calm toggle; (c) spot-listen greet-01 + greet-03.

## Panel round 2 follow-up (2026-10-10) — BLOCK 5 half-done, fixed
- Panel: the muted-tap hint lied — "tap the speaker above to hear my tale"
  but the one-shot was consumed while muted, so unmuting + tapping played
  nothing.
- Fix: (1) the gesture handler checks sound BEFORE consuming the one-shot —
  a muted tap shows the hint and stays armed; (2) `setSoundEnabled` in
  `src/game/audio/sfx.ts` now dispatches `meridian:sound-change`; the
  storyteller listens and auto-starts the pending tale on unmute (only
  while the greeting is actively pending: greeting_text + greeting mode +
  not yielded + one-shot unspent). The speaker tap is a real user gesture,
  so playback is allowed — the hint copy is now literally true.
- Copy approval: "Psst — your sound is off, young explorer. Tap the
  speaker above to hear my tale." — submitted for owner/panel approval.
- Test: "muted tap keeps the one-shot: unmuting starts the tale" (would
  FAIL pre-fix: no listener existed, unmute could never start audio).
