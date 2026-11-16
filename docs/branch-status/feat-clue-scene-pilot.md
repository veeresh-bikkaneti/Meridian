# feat/clue-scene-pilot — branch status

**Task:** Clue scene pilot (owner's brief, 2026-11-14): a short film drawn live in the browser behind each math clue — SVG ink line-art on paper — for 3 math items, ages 7-10 only. The scene sits above the text clue, which stays as the readable fallback and caption. Draft PR only — the owner reviews before any next items or styles. Built on current main `68152b4c` (the Living Atlas merge; this branch does not touch PR #481's work beyond building on it).

**Scope:**
- **Data** (`src/subjects/math/scenes.ts`, new): one scene description per pilot item, next to the answers — the givens from the item's own question (40 coins / groups of 5; 7 packs / 4 per pack; 12 snacks / 4 friends) plus one number-free label per phase. A later item needs only a new description.
- **Renderer** (`src/subjects/shared/ClueScene.tsx`, new): three scene kinds drawn as SVG. Answer-blind by construction (the `subject-host-props.ts` pattern): the component receives only `{ description, phase, reduced }` — SubjectCase derives the phase from its own flow state (`solved ? "solved" : "setup"`). Setup sets the scene only; the solved beat computes its grouping from the givens at solve time (coins slide into groups of 5 with a 5,10,…,40 counter; pencils come out in 4s with a 4,8,…,28 counter; snacks deal one by one round-robin). CSS keyframes only (transform / opacity / stroke draw-on), every element's resting state is the film's final frame; plays once, Replay button, pauses off screen / hidden tab, reduced motion renders the still frame of the current phase (no Replay control). Holmes & Watson untouched. (The act-3 amendment at the end of this file adds solved-phase narration to this component.)
- **Wiring**: `SubjectCase` gains an optional answer-blind `scene` hook (additive; every other subject passes none and is unchanged). `MathCase` passes it, gated to band 7-10 and to items with a description.
- **Line-art library**: evaluated the installed `line-art-animation` skill (MIT, pin c43d6989). Only `seeded` from `lib/motion.ts` is copied (`src/subjects/shared/clue-scene-easing.ts`, MIT notice in the file): its drawing builders create DOM imperatively, which fights this app's declarative React SVG, and its gait system animates walking figures the pilot does not have.
- **Styles**: one `.clue-scene` / `.cs-*` section in `src/styles.css`, atlas tokens (ink #33302a, brass #8a6d2f, gold #efe3bc); the scene joins the existing art-off lists (high-contrast palette, prefers-contrast, forced-colors).
- **Review fixes applied before publishing**: (1) the motion seat flagged a free bob (`.cs-bob`) on the fair-share friends in setup — unplanted motion of the kind the line-art rules ban, and it contradicted "plays once, then rests". Removed: the friends are still in setup and cheer only in the solved beat. The seat's other notes (pencil travel path, bowed pack sides, pile spread, ring draw-on) are recorded in its PR verdict as pilot polish, not applied. (2) The accessibility seat BLOCKED the first tip: under reduced motion the draw-on strokes vanished, because `.cs-draw` rests at `stroke-dashoffset: 1` and only its animation draws it — the still frame was missing the table, shelf and friend outlines. Fixed in the still rules (both `data-still` and the `prefers-reduced-motion` block now force `.cs-draw` to `stroke-dashoffset: 0`), pinned by a new assertion in `clue-scene.test.ts`, and re-verified in the browser: all three scenes' stills now show their full outlines in both phases. The seat's verdict in the PR is its verdict on the first tip; this fix is the response.

**Status:** Built and verified locally on main `68152b4c`; targeted tests per the owner's lean strategy, CI carries the full suite.
- Unit: new `scenes.test.ts` (4 tests: exact pilot coverage; no answer value/choice/digit in the setup surface; solved-beat arithmetic lands on each item's answer; solved beats exist — ticks [5…40], [4…28], deal order round-robin ending [3,3,3,3]) and `clue-scene.test.ts` (6 source pins: phase-only wiring, exact props, 7-10 gate, reduced-motion still, pause observers, labelling + replay) pass; math suite and the shared-subject suites around the edited SubjectCase (60 tests) pass.
- `npx tsc --noEmit` clean. `npm run lint:nav` clean. `npm run lint:content` GATE PASSED (6 baselined, 0 new). `node scripts/lint-cards.mjs` GATE PASSED. (There is no `lint:subjects` script at this base; the answer-blind rule it names is enforced by the new unit tests and the host-props pattern instead.)
- `npm run build:pages` green. Added JS measured against a byte-exact base build: **+2,686 B gzip total** (+2,673 B in the lazy MathCase chunk, ~25 B in the shared SubjectCase chunk) — under the pilot's 60 KB cap. No three.js needed; no new motion library.
- Browser verification: the repo's Playwright cannot launch in this environment (the known WebGL domain policy), so the equivalent was run in local headless Chrome against the built artifact, served from disk exactly as `serveBuiltArtifact` does (127.0.0.1:4123/Meridian/): all 13 cases of the 7-10 deal order played at 390 px and desktop; the 3 pilot items show setup → solved with correct phase labels; an item without a scene shows no scene and the plain clue card; reduced-motion emulation shows `data-still` stills in both phases with no Replay button. Screenshots in the run's proof pack. One console error ("An unknown error occurred when fetching the script") appears identically on the unmodified base build in this serving setup — environmental, not from this change. The three Playwright specs (desktop / mobile / reduced projects) are in the PR for CI to run for real.

**Review seats** (lean panel, verdicts in the PR body): game specialist / studio orchestrator, motion designer, accessibility reviewer, educator (ages 7-10).

**Still open:**
- Owner reviews the pilot before any next items or styles (the brief's stop point).
- Film length note: the setup draw-in settles in ~2–3.5 s and solved beats run ~5–6.5 s; the brief's 6–10 s window is met by the solved beats and the full setup-plus-idle read, but the setup draw-in alone is shorter — flagged for the owner's call.
- Nothing merged; the owner merges.

## Graph
- Add node: clue scenes for subject cases (`src/subjects/shared/ClueScene.tsx` + `src/subjects/math/scenes.ts`) — the math case screen `depends-on` them; descriptions are data beside `src/subjects/math/answers.ts`.
- Add decision node: "Clue scene pilot: live-drawn SVG film above the text clue, 3 math items, ages 7-10, answer-blind phases" — owner's brief, 2026-11-14.
- No existing nodes or edges changed.

## Act 3 amendment — the narrated solved summary (2026-11-14)

**Done.** Each pilot item's scene description now carries a `summary` —
the third act. It exists only in the solved phase: the renderer reads it
only when `phase === "solved"`, `startPerformance` refuses to run before
the solve, and nothing of it (script, captions, clip reference) renders
in setup — the pilot's answer-blind tests plus new act-3 pins hold this.

- **The performance** (in `ClueScene.tsx`): on a correct pick the solved
  beat replays re-paced to the narration — each script line owns a slice
  of the beat (`summaryStepStart`: the line's measured offset plus a
  per-kind stagger), captions step under the film in sync, and the full
  script stands as text ("The solving, step by step") in the result
  section via a new `resultExtra` hook on `SubjectCase` that renders
  only inside the solved result. The clip's own clock paces captions
  when audio plays; caption timers pace them when it cannot.
- **Voice**: playback goes only through `src/game/audio/voice-channel.ts`
  (`claimVoice("clue-summary", …)`), the one-voice rule. A tap on Hear /
  Replay takes the channel; the auto-start after a solve steps aside to
  captions if another voice holds it. Auto-start also stands down when
  sound is off, under reduced motion, or when the child's read-aloud
  preference is "sometimes" / "never" — those are tap-to-play. Hidden
  tab stops the performance; leaving the case frees the channel.
- **Clips** (`public/audio/subjects/`): rendered locally with the repo's
  own pattern — Kokoro-82M, voice `am_michael` (the journal narration
  voice), per-line renders joined with pauses, −18 LUFS / −1.5 dBTP,
  24 kHz mono MP3 64 kbps — with a `manifest.json` beside them in the
  journal-manifest shape. Line timings in the scene data are measured
  from the rendered files. skip-count 18.77 s / 150,957 B ·
  pencil-packs 17.22 s / 138,477 B · fair-share 18.74 s / 150,573 B —
  440,007 B total, fetched only when a solved summary plays.
- **Scripts** (in `scenes.ts`, beside the items): each walks the item's
  own method and closes by stating the answer and naming the method —
  counting in fives to 8 groups of 40 coins; the four times table to
  7 packs of 28 pencils; dealing one by one to 3 snacks per friend.

**Verification (finisher re-run, 2026-11-14).** Subjects unit tests
132/132 (nine new act-3 pins across `scenes.test.ts` and
`clue-scene.test.ts`: phase-gated summary read, pre-solve refusal,
voice-channel-only playback, read-aloud semantics, reduced-motion
no-autoplay, script/beat/timing integrity, closing line states the
answer). `tsc --noEmit` clean; `lint:nav` clean; `lint:content` GATE
PASSED (0 new); `lint-cards` GATE PASSED. Vite build + prerender green;
the `postbuild:pages` fingerprint step fails in this sandbox because an
in-build plugin already stamps the worker — reproduced identically on
the untouched pilot tip, so it is environmental, not this change (CI
runs the standard flow). Added JS over the pilot tip: +1,554 B gzip
like-for-like (MathCase chunk +1,539, SubjectCase chunk +15); branch
total ≈ +4.2 KB gzip over base against the 60 KB cap.
Behaviour (local headless Chrome, the pilot's substitute): a full pass
scored 82/82 (desktop + 390 px + reduced + muted); the finisher's
re-run scored 79/80 — the single miss was the mobile auto-start taking
the captions-only path when another voice held the channel at the solve
instant, which is the designed arbitration (all captions stepped, the
performance completed, no errors), and a focused probe then verified
the mobile voice path itself (auto-run created the clip; Replay tap:
clip loaded, clock advancing). Screenshots `act3-*` in
`~/workspace/meridian-work/clue-pilot-proof/` (outside the repo). Real
Playwright still cannot run in this environment; the three updated
specs in the commit are for CI. Sound is verified as loaded-and-playing
state plus an advancing clock — headless Chrome has no audible output
to listen to.

**Review seats (act 3).** Educator (7-10): PASS WITH NOTES — the
scripts teach each item's method, closings state the correct answers,
language fits the band, no pre-pick leak; two notes: skip-count's group
tally is visual-only (the voice counts coins; the closing line supplies
the 8), and one mid-performance screenshot shows the facts picture
running ahead of the spoken count. Accessibility seat: see the PR body
(verdict pasted there verbatim).

**Next step:** owner review of the amendment on PR #482; the pilot's
open calls (film length vs the 6-10 s band, choices below the fold at
390 px) still stand.

**Ruled out:** a second audio path beside the voice channel; summary
content anywhere in setup rendering (including DOM-hidden); autoplay
under reduced motion or a sometimes/never read-aloud preference;
regenerating the clips with any voice other than the journal voice.
