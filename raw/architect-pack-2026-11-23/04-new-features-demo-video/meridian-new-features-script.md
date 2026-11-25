# Meridian — New Features Demo (meridian-new-features-script.md)

**Format:** vertical 9:16, 1080×1920 · **Target runtime:** 45–75 seconds
**Voice:** AI-generated TTS voice (spoken-audio skill route), single narrator, bright + exciting, kid-friendly. NOT a human recording.
**On-screen text:** minimal — tiny lower-thirds only; narration carries the story.
**Features:** (1) High-Contrast View (PR #275, merged 2026-10-28) · (2) Friend Challenges (PR #274, merged 2026-10-28).

> **Flag disclosure:** `friendChallenges` ships `false` in production `flags.json`. This demo was recorded against a LOCAL build (`main @ ab21c1c`) with the flag enabled ONLY in the local built artifact's `flags.json` copy. Nothing was committed or pushed; production is untouched.

> **Recording note:** captured from the real app running locally (built Pages artifact served from disk, the repo's own E2E serving pattern). Satellite imagery tiles are unreachable from this VM, so — exactly as in the repo's E2E harness — tile requests return a 1×1 stub; all gameplay, pins, rings, cards and results are the app's real behavior.

---

## Narration script (spoken form, in order)

1. **Hook:** "Ready to see the whole world pop? This is Meridian — and it just got two amazing new tricks! Grab your explorer hat!"
2. **High-Contrast View:** "First up: High-Contrast View! One tap, and the whole game bursts into bold new colors — a glowing orange ring, super easy to see. And watch this — switch it right in the middle of a game! No restarting, no waiting. The world just pops! How cool is that?" *(Line revised during production: the original "bright magenta pins" wording was dropped because the magenta pin renders on the app's canvas surface, not on the satellite surface this recording could reach — the narration now claims only what the footage shows: the orange ring + toggle state changes.)*
3. **Friend Challenges:** "Next: Friend Challenges! A friend sends you a secret link, and boom — you are racing through the exact same five places they played! It is a race around the whole planet! Drop your pins inside the ring to score. Five places, one champion… think you can beat their score?"
4. **End card:** "Now it is your turn — send a challenge and dare them back! Meridian: explore the world, one pin at a time!"

*(~135 words. Voice: "Rumi" (Cheeky Bubble — bubbly, bright) via the spoken-audio TTS route (`/opt/hatch/bin/tts`, voice id `avocado_v2:rumi`, no substitution); AI-generated voice, natural exciting delivery. Per-line durations: L1 8.95s · L2 19.97s · L3 20.69s · L4 8.71s.)*

## Beats (planned)

### 0. Hook (~0–5s) — lower-third: none
- App launch → home (edition picker). Boot/load sped 6–8×, home holds at 1×.
- VO line 1.

### 1. High-Contrast View — lower-third: "New: High-Contrast View"
- Tap the high-contrast toggle ON (home) → start a Globe run (load sped) → drop a pin → reveal.
- Mid-run: toggle OFF, then ON again (in-game toggle) — live swap, no reload.
- VO line 2.

### 2. Friend Challenges — lower-thirds: "New: Friend Challenges" · "Challenge your friends!" (at the summary)
- Open a valid `#c=mc1.…` challenge link (load sped) → deterministic 5-place Globe challenge (750 km ring).
- Play all 5 places: a mix of bullseyes, close hits and one near miss — fast, confident play; camera transitions sped, pin drops + reveals at 1×.
- Finish → challenge-complete summary with the share button/link.
- VO line 3.

### 3. End card (~last 4–5s) — lower-third: "Explore the world, one pin at a time"
- Hold on the summary / home.
- VO line 4.

---

## Production record (complete)

- [x] Local build (`npm run build:pages`, main @ ab21c1c, local only)
- [x] Flag enabled in built artifact only (`dist/client/flags.json`: `friendChallenges: false → true`; git tracked changes = 0; never committed/pushed)
- [x] Raw recordings + marker logs (two takes — see below)
- [x] TTS renders (4 lines, Rumi `avocado_v2:rumi`)
- [x] Post: loading spans sped 8–12×, gameplay 1.5–3×, lower-thirds, narration mix (loudnorm −16 LUFS)
- [x] Verified: ffprobe (59.6s, 1080×1920, H.264 + AAC) + frame grabs at 4/10/16/24/33/45/53/58s

**Takes.** Six recording attempts; the final cut uses **take 6** (beats 0–1) + **take 5** (beats 2–3), both recorded 540×960 full-frame and upscaled to 1080×1920 in post. Earlier takes: #1–2 failed on the beat-2 transition (a hash-only `goto` is a same-document navigation — the challenge never booted; fixed by recording the challenge in a fresh context, which is also the true friend-link scenario); #3 (challenge) + #2 (beats 0–1) succeeded but were discarded after frame analysis showed the `recordVideo` 1080×1920 + deviceScaleFactor 2 combo pads the lower half of every frame with flat gray; #4 hung 15 min when a first-discovery **celebration overlay** (z-50, pointer-blocking) intercepted the toggle click — fixed with explicit celebration dismissal + click timeouts.

### Markers — take 6, beats 0–1 (raw seconds)
boot 1.36→3.31 · home hold → toggle ON (home) 8.16→10.39 · Play-the-globe click 13.00 · run load 13.16→31.51 · P1 aim 32.26 → celebration dismissed 40.59 → result 41.20 (**14.2 km hit**, Bologoye, Russia) · toggle OFF 42.62→45.73 · P2 aim 51.78 → result 69.86 (**2,138 km miss**, Côte d'Ivoire) · toggle ON 72.49→75.65 · P3 aim 88.26 → result 103.58 (**29.5 km hit**, Zaxo, Iraq) · end hold → 110.84.

### Markers — take 5, beat 2 (raw seconds)
challenge link open 4.14 · load 6.94→36.50 · P1 Mogadishu result 86.25 (story/hit, 243 km) · P2 Marka 103.26 (hit, 48.4 km) · P3 Kismayo 118.88 (miss, 820 km) · P4 Hargeysa 135.82 (hit, 510 km) · P5 El Dibir 150.19 (hit, 147 km) · complete + share visible 151.59 · hold → 158.31. Final score **426, 4 of 5 inside the 750 km ring**.

### Final cut (59.6s)
- **0.0–6.8 Beat 0:** boot (8×) → home, HC toggle tapped ON.
- **6.8–28.9 Beat 1:** picker + Globe load (12×) → P1 hit + celebration → toggle OFF mid-run → P2 miss reveal → toggle ON → P3 hit. Lower-third "New: High-Contrast View" 7.6–12.0.
- **28.9–49.1 Beat 2:** challenge link load (10×, "Friend challenge" interstitial) → all 5 places (hits + the 820 km miss, ring visible) → complete screen. Lower-third "New: Friend Challenges" 29.8–34.5.
- **49.1–59.6 Beat 3:** complete screen hold — "Route complete! You scored 426 across 5 places", **"Share this route with a friend" button on screen**. Lower-thirds "Challenge your friends!" 50.0–54.5, slogan "Explore the world, one pin at a time" 55.0–59.7.
- Narration placement: L1 @0.0 · L2 @9.3 · L3 @29.7 · L4 @50.8.

### Honest limits
- Satellite tiles are stubbed (VM cannot reach the tile host) — the map shows the app's real boundary/starfield rendering, pins, rings, arcs and cards, but no photographic satellite imagery.
- On the satellite surface, the visible high-contrast deltas are the brass pressed toggle states and the orange reveal ring; the HC palette's magenta pin renders on the app's canvas surface, which this recording setup could not reach (palette values themselves are test-proven: pin `#b04a9e`, answer `#a86c00`, arc `#c45c12`).
- A "map pictures won't load" tile-error dialog that flashed during raw loads was cut in post (it never appears in the final cut).
