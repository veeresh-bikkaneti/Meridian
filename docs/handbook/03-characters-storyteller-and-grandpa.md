# Meridian Product & Decision Handbook — 03 · The characters: Storyteller & Grandpa

*Meridian Product & Decision Handbook*

> **How to use this chapter.** Meridian has two on-screen people a new contributor
> must get right before touching anything they say or do. This chapter gives you
> their personalities, their exact words (quoted verbatim — never paraphrased,
> never invented), the behaviors wired around them, and the voice setup behind
> the audio. If you only read one handbook chapter before writing player-facing
> copy, read this one.

---

## 1. The Storyteller

### Who he is

The Storyteller is the read-aloud companion — the warm elder-guide who sits with
the kid through every story. He greets on the home entry, reads story cards
aloud, and invites retries when audio fails. He has a beard (kids poke it), no
visible name, and a "historian feel."

**Important implementation detail that surprises newcomers:** the figure you see
on the home banner is rendered from the **Grandpa mascot sprite sheet** — the
code comment says it plainly:

```
Reuses StorytellerMascot (the Grandpa mascot: transparent webp sprite
```

The Storyteller and Grandpa are **two different characters in copy and voice**,
but they share Grandpa's figure art on the home banner. Don't split them apart
in the art, and don't merge them in the copy.

### Personality and tone

Warm elder-guide energy. He encourages; he never scolds, lectures, or shames.
The copy pack that owns his words states his voice rules verbatim:

> "first-person, short, warm, curious. Never lectures, never shames, never
> reveals answers. No visible name ('historian feel')."

(Source: `src/components/storyteller-home-copy.ts`)

His greetings are full of landscape poetry — maps that whisper, rivers that
tell secrets, mountains keeping stories warm. His catchphrase **"Shh… listen."**
is reserved for mystery beats (GeoDetective handoffs, hook moments) and is
deliberately *not* exported for home use — it never appears in greetings or
poke lines.

### His jobs

1. **Greets on home entry.** On every home mount, the mode is decided in a
   fixed check order (`decideHomeMode`):
   - If the kid just came back from Grandpa's tour → the tour-return line
     (exactly once).
   - Else if they haven't been greeted today → the daily greeting (one line,
     dismissible, never modal).
   - Otherwise → the figure sits silent. **No nagging.** Quiet is a feature.
2. **Reads story cards aloud.** The first story reveal of each session
   auto-narrates; later reveals are text plus a speaker button. (The claim
   helper `claimFirstRevealNarration` is session-scoped — a reload is a new
   session.)
3. **Invites retries when audio fails.** If a narration clip exists but playback
   never started (the "silent narration" symptom), the card shows a fallback
   caption plus the retry hint. The failure copy **never device-shames** —
   it names the real retry path for the surface (replay button on the card,
   the figure tap on the banner) and the hint appears only for `play()`
   rejections, never for network errors.

### His canonical copy

Every line below is quoted byte-for-byte from the source. Locked lines are
marked — devs never edit them, and `node scripts/lint-cards.mjs` enforces the
card-content rules around them.

**Story-card line (locked, decided by Veeresh 2026-10-11, PR #136):**

> "The words are right here — read along with me. Tap the replay button to try again."

(Home banner variant: **"Tap me to try again."** — the banner has no speaker
button, so the figure tap is the retry path.)

**Daily greetings** (line 1 locked; rotation is day-of-year mod 6, mp3s in
`public/audio/storyteller/greet-01…06.mp3`):

> "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?"
> "New day, new tales hiding in the hills. Shall we go find one?"
> "Psst… the rivers told me a secret this morning. Want to hear it?"
> "Somewhere out there, a mountain is keeping a story warm. Let's go find it."
> "The winds brought rumors from faraway cities today. Curious?"
> "Every dot on this map has a tale. Which one shall we wake up first?"

**Post-tour return line (locked, text-only, no mp3):**

> "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?"

**Loop send-offs** (one line each, curiosity never lecture, shown ≤2.5s while
the loop loads; navigation never waits for them):

| Loop | Send-off |
|---|---|
| terrain | "Boots on! Let's read the land like a detective. 🥾" |
| quiz | "Quick-fire questions, brave explorer — show me what you know!" |
| passport | "Your passport is hungry for new stamps! ✈️" |
| geodetective | "A mystery is afoot… lean in close. 🔍" |
| capital | "Capitals and clever guesses — off we go!" |
| expedition | "Pack a snack — this trail is a long one. 🎒" |
| duel | "A friendly duel! May the sharpest compass win. 🧭" |

**Narration lines** (reveal / hook / summary, `public/audio/storyteller/*.mp3`):

> "Gather round, explorer! Every place hides a story. And this one? This one is a legend."
> "Clue four! The Hook! This is the one that changes everything. Lean in… here it comes!"
> "And so the tale ends! What. An. Adventure!"

**Poke lines** (tap the figure → rotates through 5, then repeats; each has a
`poke-0N.mp3` — in the same voice as the greetings: since PR #174 that is the
one Santa voice used for every storyteller clip; the #137 ruling had assigned
the pokes to the greeting voice too — see the closure note below):

> "Heh! That tickles my beard."
> "Careful, explorer — I'm older than these mountains."
> "Poke all you like. I've survived worse… have I told you about Troy? 😌"
> "Hmm? Did the map just move, or was that you?"
> "Alright, alright — pick a place and I'll tell you its tale."

> **CLOSED (2026-10-21) — resolved by PR #174, not by the planned fix.**
> The open bug recorded here on 2026-10-16 said: the #137 ruling assigned
> the pokes to the TruthTeller greeting voice, but the shipped
> `poke-01…05.mp3` clips were 24 kHz mono local Kokoro renders, and the fix
> waited on the owner identifying the TruthTeller source. That source was
> never recorded anywhere (the pokes were in fact never TruthTeller renders
> at any point in history), and the planned fix never happened — because on
> 2026-10-19 PR #174 replaced **all 14 storyteller clips** (greetings,
> pokes, hook, reveal, summary) with one Grok-generated Santa voice that
> Veeresh produced in a Grok session. The pokes now ship in the same voice
> as everything else. On 2026-10-21 Veeresh accepted #174 as the
> resolution, in his words: *"1 — Accept #174, close bug + docs cure"*.
> The #137 voice split is superseded (see §5); the TruthTeller greeting
> renders survive in git history — the untouched original renders at
> commit `2441e4e`; `2f828bf` holds the remastered #137 restore of them.

**Smaller moments:**

> "A leaf for luck. 🍃" (falling-laurel-leaf caption; a static sprig under reduced motion)
> "tap tap… is this thing on? 👀" (kid taps the scroll twice)

### The entering-tap and poke behaviors (PR #152, merged 2026-10-14)

Two pieces of behavior a new agent must not break:

- **Entering-tap greeting.** If the kid taps the figure while the banner is
  still in its `entering` phase — or before the tutorial invite releases the
  `started` lock — the tap *starts the greeting* instead of landing dead
  (`decideEnteringFigureTap` in `storyteller-audio-guards.ts`). Those taps used
  to look broken and narration never armed. Decision record from the #152
  merge: **the invite stays seen on the mascot tap — Veeresh's call.**
  (Note for maintainers: the current tree's figure tap also dismisses the
  tutorial invite card via `TUTORIAL_INVITE_DISMISS_EVENT` and marks it seen —
  treat the #152 note as that day's record and the code + E2E as today's
  contract; don't "fix" one against the other without Veeresh's word.)
- **Double-tap debounce.** `isRapidFigureTap`: any two figure taps closer than
  **600 ms** apart are treated as one. The same window guards the greeting
  replay path and the poke rotation — a tap storm must never stack narration
  clips or fire one mp3 request per tap. The poke bubble is intentionally
  text-first: if the greeting was attempted but never *heard* (the silence
  trap), the figure tap replays the greeting instead of rotating a text-only
  poke line — a kid who explicitly dismissed the greeting is the one exception,
  because quiet means quiet.

### His voice

| Character | Voice | Where used | Status |
|---|---|---|---|
| Storyteller | **Santa voice** (Grok-generated) | All 14 clips: greetings (greet-01…06), pokes (poke-01…05), hook, reveal, summary | Live since PR #174 (merged 2026-10-19); generated by Veeresh in a Grok session, mastered to a −16 LUFS target (measured −16.5…−17.4 across the set). Accepted as the storyteller voice by Veeresh's ruling 2026-10-21 |
| Storyteller | **TruthTeller** | Home greetings (greet-01…06.mp3) | SUPERSEDED 2026-10-19 (PR #174) — the #137-era greeting voice (Veeresh's decision 2026-10-11, PR #137); the untouched original renders are at commit `2441e4e`; `2f828bf` holds the remastered #137 restore |
| Storyteller | **am_fenrir** (Kokoro-82M, en-us male) @ speed 1.05 | Story lines: reveal / hook / summary | SUPERSEDED 2026-10-19 (PR #174) — the #137-era render voice (the game designer's 2026-10-08 pick, "trailer energy"). The poke lines were assigned to TruthTeller per #137 but shipped as Kokoro renders (the 2026-10-16 open bug); #174 closed the gap by re-voicing all 14 clips in the Santa voice |
| Comet | **avocado_v2:casper** ("confident storyteller") | Comet's daily greetings (greet-01…12.mp3) | Live; original voice, never a celebrity impression |
| Grandpa | *(no spoken lines — see §2)* | — | — |

Two rules about audio are load-bearing for this project:

1. **No runtime synthesis, ever.** Every clip is a pre-rendered mp3 under
   `public/audio/storyteller/` and `public/audio/comet/`. Today's
   storyteller clips are the Grok-generated **Santa voice** (PR #174,
   2026-10-19): 24 kHz mono mp3s, measured −16.5…−17.4 LUFS integrated
   across all 14. History: before #174 the story lines were Hugging Face
   **Kokoro-82M** renders made fully locally and offline
   (`node scripts/render-storyteller-voice.mjs`; the script refuses to
   render unless its lines match the `text` fields character-for-character,
   so captions could never drift from audio), and the greetings were
   44.1 kHz stereo TruthTeller cloud renders restored by PR #137 at a −17
   LUFS target. **Do not re-run the old Kokoro render scripts to
   "regenerate" storyteller clips** — they would overwrite the Santa voice
   with am_fenrir renders; their headers carry the warning.
2. **If the lines change, the mp3s must be regenerated** — pairing is
   positional (index ↔ filename), same contract as Comet's greetings.
   Full synthesis details live in **Chapter 4 — Audio & TTS**.

### The read-aloud preference system

> "Do you like stories read aloud?" — **Always** / **Sometimes** / **Never**.

- **Always** — "Read every story to me" (auto-narrate when sound is on).
- **Sometimes** — "I'll tap the speaker myself" (no auto-read; the ghost
  speaker button waits for the kid's tap).
- **Never** — "I'll read them myself".

Three non-negotiables, all Veeresh's:

- The kid is asked **once** and never nagged — the prompt renders only while
  the preference is unset, then it's gone.
- The preference is **the kid's own tool, never parent-gated** — it is not
  behind the grown-ups settings.
- It stays **changeable after the first tap** (`ReadAloudPrefSettings` in the
  home footer).

### Banner and art history (read this before touching the figure)

- Veeresh **rejected every storyteller SVG sample**. The replacement path is
  the page-mascot approach (see `~/workspace/your_files/page-mascot-ux-recommendations.md`
  — the 2026-10-06 recommendation, which picked **Comet** as the chart-room
  host) — but **only Veeresh picks final art**. The mascots today are
  transparent webp sprite sheets: `grandpa-directions.webp` (3×3
  cursor-tracking sheet, ~377 kB — the heaviest single home asset, watch the
  weight budget), `grandpa-reactions.webp` (3×3), `grandpa-static.webp`
  (center cell, used by the light banner shell).
- Owner directive **2026-10-09**: the storyteller sits **in the banner beside
  the Meridian branding** — always visible, mobile and desktop. If the lazy
  chunk fails, the banner fails closed to a static, silent figure rather than
  breaking home (the `StorytellerBannerBoundary`).
- **Comet hosts from the banner too** — the fixed bottom-right mascot wrapper
  was retired; Comet's emblem sits in the header cluster (eyebrow → Comet →
  sound toggle, with the v5 welcome pill leading the row).

---

## 2. Grandpa

### Who he is

Grandpa is the tasting-tour guide and the coffee-run host — the unhurried
counterweight to the Storyteller's narrator energy. He walks the home page on
a dotted brass trail, sips his coffee at the sights, and settles onto his
bench at the end of the walk. A tiny **Comet plush** sits beside him on the
bench (Veeresh's touch, 2026-10-07).

He has no spoken lines. His personality is carried entirely by animation and
timing — which is why the timing numbers in §2.2 are copy-level decisions, not
implementation details. Change them and you change the character.

### Personality and tone

Unhurried, food-loving, gentle humor. He is never in a rush — the whole tour
is hard-capped at 10 seconds and he still finds time for coffee at every
stop. The humor is situational and visual: the gooseneck-kettle pour
(dolly-vertigo zoom, scale 0.25→2.6x, visible fill plus steam burst, ~2.8s,
wordless), the top-up hold of the mug, the settle onto the bench. He invites;
he never instructs.

### The Grandpa Tasting Tour

The tour is Grandpa's hello on the home page — a first-run experience that
teaches the page's layout by walking it.

**The route.** He walks a dotted S-trail (2px, 6/6 dash, round caps, brass)
down the page gutters. Stop order: **difficulty picker → edition
cards → GeoDetective card** (→ review). Since PR #165 the tour visits the
page in top-down document order. At each stop he stops, turns to look at
it, sips his coffee
(**~0.8 s**), then walks on. The trail weaves *around* cards — never behind,
never over — keeping ≥16px clearance from every interactive rect (a sampling
gate in `grandpa-tour.ts` enforces this at runtime; violations step down the
fallback ladder). **But:** the weave requires ≥32px gaps, and on the shipped
home the editions→GeoDetective gap is 22px — so the tour commonly runs the
straight trail with sip stops instead (PR #165, 2026-10-16).

**The timing.** Measured in-page: tour dwells run **≈780–810 ms** with ~0px
drift at stops, and the sip samples inside an **800 ms window**. These numbers
came out of the 2026-10-16 fix phase, when the E2E specs were hardened to
sample in-page instead of racing Playwright round-trips — so the cadence you
see on screen is the deliberate performance, not a measurement artifact.

**Waypoints after the walk.** At the pour waypoint just above the park strip
he holds up his mug for the kettle beat (wordless). Then he settles onto the
bench facing the viewer, the trail fades to ~18% over ~2 s, and the donation
cloud fades in.

**Return visits.** Same calendar day: faint trail, Grandpa already seated, no
replay (tracked via localStorage `meridian.grandpaTour.lastDate`, local
YYYY-MM-DD). Next day, the full walk replays.

**Fail-closed ladder** (automatic step-down, the page never breaks): full
weave → simplified straight trail → current bottom-strip walk → Grandpa
hidden (the env/offline gates). Trail geometry is measured at runtime after
`document.fonts.ready` and never redrawn mid-walk; a resize or orientation
change mid-walk settles the tour immediately and re-measures once settled.

**Tour-stop anchors** (these `data-testid` hooks are also the E2E contract —
`grandpa-tasting-tour.spec.ts` walks them; don't rename without updating it):

| Anchor | Stops at |
|---|---|
| `tour-stop-difficulty` | The difficulty picker |
| `tour-stop-geodetective` | The GeoDetective card |
| `tour-stop-editions` | The Expeditions Map card (edition actions) |
| `tour-stop-review` | The review-deck card |

**Layout coupling warning.** The tour measures the real page geometry, so any
home layout change (like the bento-grid work of 2026-10-16) moves his stops.
The specs were hardened to sample in-page for exactly this reason — but a
layout PR must still re-run the grandpa spec; it's the canary.

### The Grandpa Coffee Run (the donation scene)

This is the **only money-adjacent surface in the entire app**, and its copy is
the most protected text in the codebase. It replaced the static donation sign
on **2026-10-07** (Veeresh's call).

**The locked copy — byte-identical, forever:**

> "Grown-ups — buy me a coffee? ☕"
> "Your support keeps Meridian free for kids"

`node scripts/lint-cards.mjs` and the code review treat **any alteration as a
BLOCK**. This is also a standing review rule: the donation copy is why the
copy-diff gates exist.

**The scene.** The thought-bubble ask button carries the locked copy and an
accessible name: *"Grown-ups — buy me a coffee? Activate to learn how to
support Meridian."* Tapping Grandpa *or* the cloud opens the "ask a grown-up"
gate **inside the same cloud** — the kid is never dumped to a store:

> "You're leaving Meridian to visit Ko-fi. Ask a grown-up!"
> "Meridian is free forever — every game, every map, every mystery."

*Continue* opens Ko-fi in a new tab and the cloud reverts; *Cancel*/*Esc*
reverts too. The ask shows **once per session** (sessionStorage). The parked
figure is not tappable while the tour runs (moving tap targets are avoided,
and a tap must never open a hidden dialog) — outside the tour it's tappable
as before.

**Non-negotiable product rules around this scene** (Veeresh, various dates —
treat as law): **no paywalls**, COPPA-safe always, no real-money mechanics
anywhere else, and the standing PWA rule (every new build must prompt the
player to update) applies here too.

---

## 3. Comet (the emblem — read this so you don't misuse him)

Comet is the star-dragon pup from the Chart Room Crew (the original,
Meridian-owned celebration cast: Captain Nova the astronaut, Blip the alien
navigator, Rusty the robot historian, Comet the morale mascot — full crew spec
in `~/workspace/your_files/celebration-audio-animation-spec.md` §5).

On the home page he is the **emblem and mascot-host**: his mark sits in the
banner's eyebrow cluster, and his daily greetings rotate day-of-year mod 12
(`COMET_GREETING_LINES`, `public/audio/comet/greet-01…12.mp3`, voice
`avocado_v2:casper`, tone 2026-10-06: *suspense + excitement, movie-trailer
narrator energy — adventure-documentary buildup, kid-friendly but thrilling*).

His personality on the home page is deliberately different from his
celebration personality: here he's the **excitable co-pilot hyping the
mission** — tail wagging, nose twitching, countdown energy — not the calm
bedtime-story narrator. Catchphrase (celebration context): **"Zoom-zoom, way
to go!"** Don't import the catchphrase into home copy without a reason; the
two contexts stay distinct.

---

## 4. Tone rules for writing new lines for either character

These are the rules the scrum reviewers enforce on any new character copy.
Follow them in order:

1. **Reading age ≈ 10.** Short words, short sentences. The GeoDetective clue
   prompt (v1 FINAL) sets the bar; if a 10-year-old can't read it aloud
   smoothly, rewrite it.
2. **The blurb principles (Veeresh, approved 2026-10-01):** history first,
   modern identity second · plain-spoken geography a kid can picture, never
   elevation/coordinates · one memorable hook — if a kid can't retell it, the
   card failed · short and story-like, stats only if they teach
   (records, firsts, biggests).
3. **Encouragement over correction.** The Storyteller never lectures, never
   shames, never reveals answers. Grandpa never hurries anyone. A miss is a
   page turning, never a buzzer — the product's scoring philosophy ("the
   scoring system sucks" → difficulty tiers as learning scaffolding, not
   gamer difficulty) flows from the same root.
4. **Devs never invent kid copy.** Kid-facing lines come from the copy pack
   (the copy pack the code cites as `~/workspace/specs/storyteller-copy.md` — that file is not present in this workspace; the pack's Sections 0–3 live lifted-verbatim in `src/components/storyteller-home-copy.ts`) or the narrative designer.
   Locked lines are byte-identical — do not edit, do not "improve."
5. **No name-dropping the machinery.** Never reference TTS engines, model
   names, or voice providers in code comments or UI. (Comet's voice is an
   original — never claim otherwise.)
6. **One memorable hook.** History needs its person, quote, event, movie, or
   record. If the line doesn't have one, it doesn't ship.

---

## 5. Voice casting — summary

| Character | Voice | Where used | Status |
|---|---|---|---|
| Storyteller | **Santa voice** (Grok-generated) | All 14 clips (greetings, pokes, reveal/hook/summary) | Live — PR #174 (2026-10-19); accepted by Veeresh 2026-10-21 |
| Storyteller | **TruthTeller** | Home greetings (greet-01…06.mp3) | SUPERSEDED 2026-10-19 (PR #174) — the #137 greeting voice (Veeresh 2026-10-11); the untouched original renders are at commit `2441e4e`; `2f828bf` holds the remastered #137 restore |
| Storyteller | **am_fenrir** (Kokoro-82M, en-us male @ 1.05) | Story lines (reveal/hook/summary) | SUPERSEDED 2026-10-19 (PR #174) — the #137 render voice. Poke lines were assigned to TruthTeller under #137 but shipped as am_fenrir renders until #174 re-voiced all 14 clips |
| Comet | **avocado_v2:casper** ("confident storyteller") | Daily home greetings (greet-01…12.mp3) | Live; original voice |
| Grandpa | *(no spoken lines)* | Animation + timing only | By design — his "voice" is the walk |

Synthesis pipeline (render script, positional audio pairing, mastering
standards, regeneration contract): **Chapter 4 — Audio & TTS**.

---

## Sources

- `src/components/storyteller-lines.ts` — narration lines, retry hints, audio
  fallback, voice note (am_fenrir — the pre-#174 render voice; its mp3
  regeneration contract predates the Santa re-voice and is flagged for the
  same warning treatment as the render scripts)
- `src/components/storyteller-home-copy.ts` — greetings, tour-return line,
  send-offs, poke lines, leaf/scroll lines, voice rules, `decideHomeMode`
- `src/components/storyteller-audio-guards.ts` — entering-tap, debounce,
  replay, dismissal, fallback-line decisions
- `src/components/storyteller-home.tsx` — banner host, figure tap behavior,
  tutorial-invite gating (figure = Grandpa mascot sprite)
- `src/components/storyteller-banner-shell.tsx` — banner placement directive
  (owner 2026-10-09), skeleton/fail-closed boundary
- `src/components/storyteller-claim.ts` — session-once auto-narration claim
- `src/components/age-profile/ReadAloudButton.tsx` — `READ_ALONG_MESSAGE`
- `src/components/age-profile/ReadAloudPrefPrompt.tsx` — Always/Sometimes/
  Never, asked-once, never parent-gated
- `src/components/grandpa-coffee-run.tsx` — tour + donation scene spec header,
  locked donation copy, Ko-fi gate copy, Comet plush note
- `src/components/grandpa-tour.ts` — runtime geometry, fallback ladder,
  sampling gate
- `src/components/comet-greetings.ts` — Comet's 12 lines, tone note,
  avocado_v2:casper voice, positional pairing
- `~/workspace/your_files/page-mascot-ux-recommendations.md` — Comet-as-host
  recommendation (2026-10-06), behavior/placement/motion rules
- `~/workspace/your_files/celebration-audio-animation-spec.md` §5 — the
  Chart Room Crew (Nova/Blip/Rusty/Comet), personalities, catchphrases,
  celebration copy
- `~/workspace/specs/meridian-place-accessibility-overhaul.md` §3 — locked
  copy immutability, no paywalls, COPPA-safe (Design Principles)
- The copy pack cited by the code as `~/workspace/specs/storyteller-copy.md` — not present in this workspace; its Sections 0–3
  lifted verbatim into `storyteller-home-copy.ts`)
- Decisions: PR #136 (2026-10-11 — hint wordings approved), PR #137
  (2026-10-11 — TruthTeller greetings + am_fenrir story lines; SUPERSEDED
  by PR #174), PR #152 (2026-10-14 — entering-tap greeting, 600 ms
  debounce), PR #174 (2026-10-19 — Santa re-voice: all 14 storyteller
  clips in one Grok-generated voice), owner ruling 2026-10-21 ("1 — Accept
  #174, close bug + docs cure" — #174 accepted as the poke-bug resolution),
  owner directives 2026-10-07 (Comet plush, coffee-run replaces static sign),
  2026-10-09 (storyteller in banner; bard-hum idle engagement),
  Veeresh 2026-10-01 (kid-friendly blurb principles), 2026-10-06
  (Comet home tone)
