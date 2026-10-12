# SPEC_CHECKLIST — Cold Trail region context (feat/cold-trail-region-context)

Owner order 2026-10-11: Cold Trail sightings name obscure reference places
("575 km southwest of Umraniye") with no hint which continent/country to zoom
into. Ruling: cold cases need continent + country/state context so a kid can
at least zoom into the right area.

Plain-language summary of what was built: every Cold Trail witness report
now carries a "🌍 Region:" line naming the continent and country (plus the
state/province for very large countries) of the reference city — e.g.
"🌍 Region: Asia · Türkiye". Nothing else about the case changes: the same
3 sightings, the same rings, the same triangulation.

---

## Phase 1 — Design decisions (Game Designer + UX Researcher + UX Architect +
UI Designer panel)

1. **Placement — separate "🌍 Region:" line, NOT baked into the clue.**
   The owner's example shape baked it in ("...southwest of Umraniye,
   Türkiye — Asia."), but the panel chose a separate line under the clue
   sentence. Reasons: (a) three sightings' regions scan at a glance as a
   vertical list — baked-in, the eye must hunt each sentence; (b) the clue
   is written as witness fiction ("Last seen eating at a drive-through…"),
   and appending atlas metadata breaks that voice; (c) it leaves the locked
   clue `text` byte-identical, so no regeneration risk. The owner's spirit
   — continent + country visible at a glance — is preserved exactly.

2. **Granularity — continent + country ALWAYS; subdivision only for large
   countries.** Large-country set: **US, CA, BR, IN, CN, RU, AU**. Cutoff
   justification: every one of them is ≥ ~3.5M km² of land — naming only
   "United States" or "Russia" still leaves a kid searching a
   continent-sized space, so the state/province earns its keep. The next
   largest country (Kazakhstan, ~2.7M km²) falls below the line; its
   subdivisions are rarely kid-recognizable, and country + continent
   suffices there.

3. **Difficulty — the triangulation challenge survives.** The region line
   adds no fact about the hideout and no fact the named city didn't already
   imply — "southwest of Umraniye" already tells you the city; the region
   only tells you where Umraniye is on the map. What the player still must
   do: locate the city, center a ring on it, and intersect three
   octant+distance rings. If Easy ever reads trivial in playtests, the
   reversible mitigation (proposed, NOT shipped) is to drop the subdivision
   on Easy — region stays continent + country.

4. **Wording — kid-friendly, plain-spoken (repo rule).**
   Format: `🌍 Region: <Continent> · <Country>[ · <Subdivision>]`,
   e.g. "🌍 Region: Asia · Türkiye" or
   "🌍 Region: North America · United States · Texas".
   The region is witness-side only: it is derived from the witness city's
   gazetteer record and can never name the hideout (enforced by the
   anti-leak test).

---

## Fun-vs-impossible brainstorm (owner expansion 2026-10-11)

> "Goal is to make the game fun not impossible. Brainstorm with scrum team
> specially game developers group."

**Method note (honest):** this cell runs at max agent depth and cannot spawn
subagents, so the six personas below were convened as a structured,
lens-by-lens deliberation by this cell — not six independent agents. Each
lens is grounded in its persona's mandate from the installed roster
(~/.codex/agents). The owner's decision is the only green light for any
lever beyond region context: **nothing below is implemented.**

### Grounding — where Cold Trail actually sits today

- Deck reality check (current deck, seed 20261008): **Case #001 deals
  "575 km southwest of Umraniye" as its FIRST sighting** — the owner's
  exact complaint, on the first screen a new player sees. The other two:
  Rasht (Iran), Ibadan (Nigeria). A 7-year-old's first 30 seconds are
  three cities she has never heard of and a whole-planet map.
- 172 distinct witness cities across 60 cases, all difficulty 1–2,
  pop ≥300k. "Difficulty 1–2" means recognizable to adults; to kids,
  Rasht and Ibadan might as well be on the moon.
- Cases are dealt in one deterministic shuffle — no onboarding ramp. Case
  #001 is no easier than case #60.

### Q1 — Where on the fun/impossible spectrum? What makes it feel impossible?

**Game Designer (systems lens):** Cold Trail sits at ~70% impossible for a
kid on first contact, ~30% for a geography-literate adult. The core loop —
place 3 rings, read the overlap, tap the interception — is genuinely fun;
the "aha" when three rings cross is the fun hypothesis and it works. The
impossible part is all *front-loaded*: the first decision ("where do I
even start?") has no affordance. Once the first ring is down, the loop
carries the player. So the fix is not "make triangulation easier" — it's
"make the first 30 seconds winnable."

**Level Designer (pacing lens):** There is no level 1. Every case is dealt
at the same obscurity. Good level design teaches with famous places first
(capital cities, landmarks) and spends obscurity as a reward later. Cold
Trail currently starts new players on the equivalent of level 20.

**UX Researcher (kid lens):** A 7-year-old fails silently here: she taps
around a planet-sized map, can't find "Umraniye", places a ring somewhere
random, and her score (thousands of km off) teaches her nothing. No
failure in the first beat should feel like *her* fault — right now all of
it does. She needs one visible win in the first 30 seconds.

**Narrative Designer (fiction lens):** The smuggler-fiction is strong and
age-appropriate ("filling jerrycans", "buying a burner phone"). The fiction
breaks only where atlas metadata would be baked into the witness's mouth —
which is why region belongs on its own line, as the *game* talking to the
player, not the witness talking.

**Technical Artist (feedback lens):** The map gives no "you're getting
warmer" signal until the final score. The ring-lock moment is the only
dopamine hit before reveal. First-beat feedback is thin.

**Godot Gameplay Scripter (systems-integrity lens):** The mechanics are
sound — vague radii are player-fair (ceiled, never understating), the
octant spread guarantees triangulatable geometry, the informant is a clean
risk/reward sink. Nothing in the *mechanism* needs changing; the problem
is purely *presentation and ordering*.

**Consensus:** Cold Trail is impossible-feeling at the front door, fun in
the living room. The triangulation challenge is fine. The obscurity ramp
is missing.

### Q2 — Levers beyond region context (proposed, NOT implemented)

- **L1. Region context** — CONFIRMED, implementing now.
- **L2. Famous-first case ordering (onboarding ramp).** Guarantee the
  first N cases use difficulty-1 (famous) witness cities — capitals and
  landmarks kids may know — before the deck spends obscure witnesses.
  Generator-side sort; zero UI change; highest leverage per the Level
  Designer.
- **L3. Within-case fame ordering.** Order each case's 3 sightings so the
  most famous anchor is sighting #1. The first ring becomes the easy win
  ("I found Paris!") that funds the confidence to hunt the obscure ones.
- **L4. "Zoom me to the region" affordance.** A button per sighting that
  flies the map to the region's bounding box. Adds no new information
  (the region is already named) — it just removes the "where do I even
  start zooming" friction. Pure affordance, kid-sized.
- **L5. Progressive hinting (region now, tighter later).** Considered and
  parked: it complicates the card and the fiction without adding a
  decision. The group prefers L4's single explicit affordance over a
  hint ladder.
- **L6. Ring-radius generosity on early cases.** Rejected by the
  Scripter/Game Designer: radii are already player-fair (ceiled) and the
  ring size is not what blocks kids — finding the city is. Changing
  radii would dull the triangulation without fixing the front door.

### Q3 — Is region context ENOUGH? The group's verdict

**No — necessary but not sufficient.** Region context answers "which part
of the planet" but Case #001 still opens on Umraniye/Rasht/Ibadan, and a
kid who zooms to Türkiye still can't find Umraniye. The group recommends
**1–2 more levers**, in priority order:

1. **L2 — famous-first case ordering** (the onboarding ramp). Without it,
   region context lands on un-winnable first cases.
2. **L3 — within-case fame ordering** (the first-30-seconds win), or
   **L4 — zoom-to-region affordance** if the owner prefers a UI affordance
   over deck surgery. The group's preference is L3 (cheaper, no new UI,
   works offline identically).

### Q4 — Kid lens: 7-year-old, Case #001, first 30 seconds

She needs: (a) sighting #1 to name a city she might know — Paris, Cairo,
Tokyo — with "🌍 Region: Europe · France" underneath telling her where to
look; (b) one successful ring placement — tap, ring appears, "Ring 1
locked" — before she meets any city she can't find; (c) the score to
teach, not punish (it already does: km miss is honest feedback). The "I
can do this" moment is **ring 1 locked on a city she found herself**.
Region context (L1) + famous-first ordering (L2) + fame-ordered sightings
(L3) together manufacture exactly that moment.

### Explicitly NOT changing (to protect the triangulation challenge)

- The 3-ring triangulation core: player-placed centers, octant + vague
  radius, intersect-to-find. This is the fun hypothesis — untouched.
- Scoring = km from the true hideout. Honest, teachable, untouched.
- Vague-radius rounding (ceiled, player-fair) and the 250–4000 km witness
  band. The geometry that makes rings triangulatable stays.
- The informant economy (1 star → tighten 50%). Clean risk/reward.
- The smuggler-fiction voice of the clue sentences (locked text).
- No baking atlas metadata into the witness's mouth (Phase 1, decision 1).

### Proposal for the owner (his call — none of this is built)

Ship region context now (this branch). Then, as a follow-up, implement
**L2 + L3** (famous-first case ordering, fame-ordered sightings) — both
generator-side, no UI, no new deps — and consider **L4** (zoom-to-region
button) only if playtests still show "where do I start" friction after
L2/L3. L5 parked, L6 rejected.

---

## Verification checklist (plain language)

- [x] Every one of the 180 sightings shows a Region line naming a real
      continent and country (checked by a content-audit test, not by eye).
- [x] No region line ever names the hideout city (anti-leak test, unit + e2e).
- [x] Obscure places (e.g. Umraniye) resolve: "🌍 Region: Asia · Türkiye".
- [x] Long region strings wrap inside the card on a 390px phone screen
      (break-words; verified in the recording frames).
- [x] Clue sentences are byte-identical to before (region is a new field,
      not edited text — diffed against the pre-regen snapshot).
- [x] Full gates green: tsc, npm test (1094/1094), lint-cards, build:pages,
      Playwright Cold Trail specs 14/14 on the rebuilt app.
- [x] Screen recording of a real play session (sightings → rings →
      triangulation → score) delivered as a file.
- [x] Rebased onto latest origin/main (f834aa6) with zero conflicts;
      gates re-run after the rebase (tsc, npm test, lint-cards,
      build:pages, Playwright 14/14 — all green).
- [ ] PR opened, never merged, closing with "Ready to merge? YES/NO" and
      "What is pending:".

---

# Previous: Narration silence self-recovery (`fix/narration-silent-prod`, merged as PR #136 — kept for reference)

# SPEC CHECKLIST — Narration silence self-recovery (`fix/narration-silent-prod`)

Plain-language list of what this branch implements. Each item is a user-visible behavior.

## The problem (in plain words)
On the owner's phone, the storyteller's captions/subtitles appeared but no sound played. Tapping didn't fix it — every tap just showed another silent line. Three separate "silent traps" in the code could cause this, and none of them had a way back to sound.

## What was built
- [x] **1. If audio never starts, the app stops waiting.** When narration tries to play and the phone gives no answer within 4 seconds, the app now shows the text version with a "Tap the replay button to try again" hint — instead of waiting forever in silence. The hint names the replay button because it's the only control still on screen in the failed state (the speaker button hides on failure). The banner's version says "Tap me to try again" — the banner has no speaker button, so its hint names the figure tap that replays the greeting. (Copy is the panel's pick; final wording needs the owner's sign-off before merge.)
- [x] **2. If audio starts but then stalls, the app recovers.** If sound begins but makes no progress for 3 seconds, the app treats it as failed and offers the retry path — instead of sitting in a fake "playing" state.
- [x] **3. Tapping while muted no longer wastes the one chance to play.** If the first tap happens while sound is off, the app stays ready — the next tap (after unmuting) still starts the narration. Before, that first tap silently burned the only attempt. Qualifier: this is true on the card when sound was ON at mount (the armed one-shot is what retries). If sound was OFF at mount, the card never arms the one-shot — it's in manual mode, and the speaker button (then replay) is the path, not the one-shot.
- [x] **4. Tapping grandpa replays a greeting you never heard.** If the home greeting failed or was missed, tapping grandpa now replays the greeting instead of a joke poke line. Once you've heard it, taps go back to the playful poke lines.
- [x] **5. Tapping during the tasting tour no longer burns the greeting.** A tap while the tour is walking no longer consumes the greeting's one attempt.
- [x] **6. Interrupting audio while it's starting no longer strands the player.** Tapping pause while sound is still buffering now lands in a proper "paused" state you can resume from — not a stuck "playing" state on a dead player.
- [x] **7. Resuming paused narration is watched too.** If a paused line's resume never gets going within 4 seconds, the app fails loud into the text version with the same "try again" hint — instead of sitting in a fake "playing" state with no way back.
- [x] **8. Tapping grandpa rapidly can't spam the greeting.** The greeting-replay tap has the same short debounce as the poke lines, so a tap storm fires one attempt, not one per tap.

## What was NOT changed
- The Ko-fi cloud (separate issue, untouched).
- The mute toggle itself — "sound off until I say so" still means silence; the speaker button still plays once without flipping the toggle.
- Caption timing, voices, and all existing passing behavior.

## How it was verified
- 23 unit tests in the guards file covering each decision above (fail-before / pass-after).
- 7 new end-to-end tests on the built app: hanging audio → fallback with retry hint (+ the replay button actually rendered); stalled audio (starts then hangs) → fallback with retry hint; aborted audio → figure tap replays; muted first tap → one-shot survives, unmute + tap starts real playback; pause mid-buffer → recoverable paused state, replay resumes; banner play() rejection → figure-tap hint, figure tap replays; healthy audio → element actually plays (not just captions).
- Full suite: typecheck, unit (1113), lint, build, Playwright storyteller specs.
- Screen recording of the test session attached to the PR (per owner's rule: no recording = testing didn't happen).

---

# Spec checklist — storyteller greeting home-only (owner ruling 2026-10-11)

Plain-language list of what was implemented. Each box is verified by a test.

- [x] The "Gather round, explorer!" greeting banner no longer appears on the pin-drop result card.
- [x] Nothing overlaps the result card's header anymore (the banner used to cover "STATE · NEBRASKA" and the difficulty pill).
- [x] The home page is unchanged — the storyteller and its greeting work exactly as before.
- [x] The game-over summary still gets its closing narration ("And so the tale ends!").
- [x] The GeoDetective hook clue still gets its narration.
- [x] The result card otherwise works exactly as before (verdict, story, share, Next place).
- [x] No dead code left behind (the old narration trigger and its session claim were removed).

## What is NOT in this change

- The home page greeting was not touched.
- No narration audio files changed.
- No animation or motion changes.
- The "Gather round" line still exists in the narration data file (unused by any screen now, kept for the mp3 pairing).
