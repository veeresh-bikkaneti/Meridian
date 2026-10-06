# Meridian SFX Spec — 100% Web Audio, Zero Assets

**Scope:** All sound synthesized at runtime via the Web Audio API. No audio files, no downloads, no CDN, no middleware, no music bed.
**Owner:** Game Audio Designer. **Implementer contract:** `src/game/audio/sfx.ts` (single module).

---

## 1. Sonic identity

Three adjectives — every recipe below must satisfy all three:

1. **Cartographic** — precise, pen-on-paper. Fast clean attacks, sine/triangle cores, no noise wash, no harsh transients. Every sound lands like a cartographer's tap on a map.
2. **Inquisitive** — sound always answers "how close am I?" Confirms lean up, wins climb, losses fall, distance is literally pitch. The audio is a question-answering instrument.
3. **Brass-warm** — aged-chart warmth. Low-passed tones, gentle additive shimmer (never above −12 dB), slight detune pairs (±4 cents). No sawtooth edge, no FM clang, no sub-bass, no sparkly highs.

---

## 2. Synthesis recipes

Notation: `A/D` = attack/decay in ms (linear attack, exponential decay to −60 dB). `peak` = gain-node peak 0–1 (pre-master). All times scheduled on `ctx.currentTime`. All oscs `stop()` at `t0 + A + D + 50ms`.

Global chain (built once at init):
`voice gain → masterGain(0.8) → DynamicsCompressor(threshold −9 dB, knee 6, ratio 12, attack 3 ms, release 120 ms) → destination`
Peak output never exceeds −1 dBFS even under full polyphony.

### 2.1 `playConfirmGuess()` — GeoDetective guess confirm
Fired once when the player confirms a guess (after duplicate-check passes; duplicates get no sound — they already get a text notice).

- Osc 1: sine, 660 → 720 Hz exponential glide over 60 ms (inquisitive lift)
- Osc 2: sine, 990 Hz fixed (perfect fifth above 660)
- A 5 ms / D 90 ms, peak 0.22 each
- Shared lowpass 3200 Hz
- Total duration ~95 ms

### 2.2 `playRingReveal(distanceKm)` — distance ring reveal
Fired once when the distance ring draws. **Pitch = distance, mapped logarithmically** (pitch perception is log; the map below is a power law = linear in log–log space).

**Mapping function** (pure, exported for unit tests as `distanceToFrequencyKm`):
```
d = clamp(distanceKm, 1, 20000)
f = round(1568 * d^(-0.28))      // Hz
```
Endpoints: 1 km → 1568 Hz (G6); 20,000 km → 98 Hz (G2).
Worked examples: 42 km → 550 Hz · 1,500 km → 202 Hz · 9,000 km → 123 Hz.

**Three bands** (band edges at 500 km and 4000 km):

| Band | Distance | Timbre ("close = bright ping, far = dull thud") |
|---|---|---|
| Close | < 500 km | **Bright ping.** Sine @ f + shimmer sine @ 2f at −14 dB (peak 0.45 / 0.09). A 3 ms / D 420 ms. Lowpass 6000 Hz. |
| Mid | 500–4000 km | **Warm tick.** Triangle @ f with gentle down-glide f → 0.94f over 120 ms. A 4 ms / D 260 ms, peak 0.40. Lowpass 2500 Hz. |
| Far | > 4000 km | **Dull thud.** Sine @ f, A 6 ms / D 500 ms, peak 0.50, lowpass 700 Hz. Plus body: triangle @ f·0.5 gliding to f·0.45, peak 0.25. |

A correct guess (d = 0) clamps to 1 km → brightest ping. The ring sound must never fire more than once per reveal; a second call replaces the first (voice-steal, §3).

### 2.3 `playWin()` — mystery solved
Rising major arpeggio, unhurried but compact.

- Notes: C5 523.25 → E5 659.25 → G5 783.99 → C6 1046.50 Hz, staggered 110 ms
- Each: triangle, A 5 ms / D 380 ms, peak 0.30; ±4-cent detune pair on the final C6 only
- Final C6 adds sine octave shimmer @ 2093 Hz, peak 0.08, D 700 ms
- Shared lowpass 5000 Hz
- Total ~1.1 s

### 2.4 `playLose()` — out of guesses
Muted descending two-note sting. Deliberately dark, never harsh — losing should feel like a page turning, not a buzzer.

- Note 1: sine 440 Hz (A4), A 8 ms / D 420 ms, peak 0.38, at t0
- Note 2: sine 329.63 Hz (E4), A 8 ms / D 420 ms, peak 0.38, at t0 + 220 ms
- Shared lowpass 1400 Hz
- Total ~900 ms

### 2.5 `playDeal()` — next case dealt
A "case file snapped open" — paper snap + low tick. Noise is synthesized, not sampled (allowed: it's runtime synthesis).

- Snap: white-noise buffer (generated once, 0.5 s, cached) → bandpass 2400 Hz, Q 1.2 → A 2 ms / D 68 ms, peak 0.32
- Tick: triangle 196 Hz (G3) at t0 + 25 ms, A 3 ms / D 110 ms, peak 0.22
- Total ~160 ms

### 2.6 Home screen
- `playCardTap()` — edition card tap: triangle 587.33 Hz (D5), A 4 ms / D 110 ms, peak 0.20, lowpass 3000 Hz.
- `playDifficultySelect()` — difficulty select: sine 880 Hz gliding to 940 Hz over 80 ms + fifth shimmer 1318.5 Hz at −14 dB (peak 0.22 / 0.05), A 4 ms / D 140 ms. Deliberately a fifth above the card tap so the two never feel identical.

### 2.7 `playPinDropPass()` — pin lands, placement accepted
Pass/fail is about **placement**, never accuracy — at pin-drop time the outcome doesn't exist yet. Pass = tap accepted, a reveal will follow.

- Osc 1: triangle, 392 → 440 Hz exponential glide over 40 ms (inquisitive up-lift)
- Osc 2: paper tok — cached noise buffer → bandpass 1800 Hz, Q 1.0, A 2 ms / D 30 ms, peak 0.10
- Osc 1: A 3 ms / D 60 ms, peak 0.24; shared lowpass 3200 Hz
- Total ~95 ms · Priority: low (UI) · ±2% micro-variation · Peak ≤0.25
- Distinct from `playCardTap` (D5 587 fixed): lower, gliding, paper tok.

### 2.8 `playPinDropFail()` — tap rejected, soft "page turn"
Fail = placement rejected, no reveal follows: tap while camera animating, double-tap misfire (<300 ms), tap on non-interactive chrome. A legal-but-wrong guess is NOT a fail — it gets the normal ring reveal. No buzzer, no dissonance.

- Noise: cached buffer → bandpass sweeping 1200 → 450 Hz over 220 ms, A 25 ms (soft attack) / D 220 ms, peak 0.14
- Osc: sine 247 → 220 Hz gentle exponential fall over 200 ms, A 25 ms / D 240 ms, peak 0.12, lowpass 1000 Hz
- Total ~285 ms · Priority: low (UI) · Peak ≤0.25 · distinguishable from pass in <150 ms (bright up-lift vs airy descend)

### 2.9 `startGlobeSpin()` / `stopGlobeSpin()` — intro globe rotation texture
Looping voice (see §3 loop rules): the cached noise buffer with `loop = true` (zero new allocation) → bandpass 850 Hz, Q 0.7 → gain ramps 0 → 0.10 over 400 ms.

- `startGlobeSpin()`: idempotent — a restart cuts the previous loop immediately (no debounce) and re-arms the safety. Before `initAudio()` (or with sound off) it is a silent no-op.
- `stopGlobeSpin()`: gain fades to 0.0001 over 250 ms, source stops at fade end, nodes disconnect. No-op when not running.
- **30 s auto-stop safety** (one-shot `setTimeout`, never `setInterval`): backstop only — callers stop on screen transition.
- Counts as 1 of the 8 voices; ambient priority 1 (never steals, stealable by ring/win/lose/fanfare); a stolen spin does NOT auto-restart — the map layer re-arms on the next dragstart. `setSoundEnabled(false)` stops any active loop immediately.

### 2.10 `playNextPlace()` — regular-game "Next place" (map re-deal)
Distinct from GeoDetective's `playDeal` file-snap — this is a chart unrolling, not a case file.

- Snap: cached noise → bandpass 3000 Hz, Q 1.0, A 2 ms / D 50 ms, peak 0.24 (brighter paper than deal's 2400 Hz)
- Chirp: triangle 330 → 392 Hz over 60 ms at t0 + 20 ms, A 3 ms / D 90 ms, peak 0.18, lowpass 3200 Hz
- Total ~150 ms · Priority: low (UI) · ±2% micro-variation · Peak ≤0.25

### 2.11 `playSmallCheer()` — Spark/Cheer tier milestone
- 3 triangle voices C5 523.25 → E5 659.25 → G5 783.99, staggered 70 ms, A 5 ms / D 250 ms, peak 0.18 each, bandpass 900 Hz Q 2 (formant tint) + 6 Hz vibrato ±15 Hz
- Deterministic (celebrations carry meaning — no jitter) · Total ~450 ms · Priority: high (win-class) · Peak ≤0.40

### 2.12 `playMediumApplause()` — difficulty cleared
- Claps: 8 cached-noise bursts → bandpass 1500 Hz Q 1.5, A 1 ms / D 40 ms, peak 0.14 each, at t0 + 90/180/300/430/560/700/870/1050 ms
- Pad: triangle G-major triad 392/493.88/587.33 Hz, A 50 ms / D 1000 ms, peak 0.10 each, lowpass 2500 Hz, ±4-cent detune pairs
- Deterministic · Total ~1.15 s · Priority: high · Peak ≤0.40 · within the 1.2 s ceiling

### 2.13 `playGrandFanfare()` — 387 completion / hard-clear coronation
- G major (distinct from `playWin`'s C major): G4 392 → C5 523.25 → E5 659.25 → G5 783.99 (hold), staggered 140/140/280 ms; triangle, A 8 ms / D 420 ms, peak 0.28, ±4-cent detune pairs
- Shimmer: sine 1568 Hz on the final, peak 0.08 — D trimmed to 570 ms so the final lands at 560 + 8 + 570 = 1138 ms, holding the locked **1.15 s** total (Veeresh's decision; the audio recipe's D 700 would overshoot the 1.2 s ceiling)
- Crowd swell: noise → lowpass 800 Hz, A 300 ms / D 600 ms, peak 0.10
- Shared lowpass 4500 Hz · Deterministic · Priority: high · Peak ≤0.45

### 2.14 `playToastChime()` — milestone banner slides in (no confetti)
- Sine 880 → 990 Hz glide over 80 ms, A 4 ms / D 80 ms, peak 0.16, lowpass 3000 Hz · Total ~110 ms · Priority: low (UI) · ±2% micro-variation

### 2.15 `playConfettiPop()` — confetti burst (only when visual confetti fires)
- 2 noise pops → bandpass 2200 Hz Q 1.2, A 1 ms / D 35 ms, peak 0.14 each, at t0 and t0 + 120 ms
- Triangle 660 → 880 Hz chirp, A 3 ms / D 120 ms, peak 0.12, lowpass 3200 Hz · Total ~300 ms · Priority: low (UI) · ±2% micro-variation

---

## 3. Mix rules

- **Master ceiling:** `masterGain = 0.8` into the safety compressor (§2). No clipping, ever.
- **Per-sound peaks (pre-master):** UI blips ≤ 0.25 · ring ≤ 0.50 · win/lose ≤ 0.45 · deal ≤ 0.40.
- **Mobile-speaker-friendly:** no fundamental below 98 Hz; every voice low-passed ≤ 8000 Hz; all fundamentals live in 98–1600 Hz where phone speakers actually reproduce. No sub-bass, no harsh highs.
- **Max 8 concurrent voices.** Priority: ring / win / lose / cheer / applause / fanfare = high (never stolen by UI); UI blips = low; globe-spin loop = ambient (priority 1, never steals). Steal policy: steal oldest lowest-priority voice; same event re-fired within 80 ms replaces its previous instance (debounce).
- **Loop voices (`admitLoop`).** The globe-spin loop counts toward the 8-voice ceiling and participates in steal ordering (spin = priority 1, stolen by ring/win/lose/fanfare). Differences from one-shots: same-key restart stops the previous instance immediately (no 80 ms debounce); the `setTimeout` prune skips loops — `stop()` removes the voice entry manually; a stolen spin does NOT auto-restart (the map layer re-arms on the next dragstart); `setSoundEnabled(false)` stops any active loop via a module-level registry; the 30 s auto-stop is a one-shot `setTimeout` backstop, never `setInterval`.
- **Max duration:** no single sound exceeds 1.2 s (win arpeggio at ~1.1 s is the ceiling; grand fanfare is fit to 1.15 s).
- **Micro-variation:** ±2% random detune on UI blips only (confirm, card, difficulty, pinDrop, nextPlace, toast, confetti), so rapid taps don't machine-gun. Ring/win/lose/deal/cheer/applause/fanfare are deterministic — they carry information.

## 4. Architecture contract — `src/game/audio/sfx.ts`

**Public API** (all return `void`, all fire-and-forget — never awaited, never throwing):
```ts
initAudio(): void
isSoundEnabled(): boolean
setSoundEnabled(on: boolean): void   // false also stops any active loop
distanceToFrequencyKm(km: number): number   // pure — unit-testable, no AudioContext needed
playConfirmGuess(): void
playRingReveal(distanceKm: number): void
playWin(): void
playLose(): void
playDeal(): void
playCardTap(): void
playDifficultySelect(): void
// Celebration extension (spec §2.7–§2.15):
playPinDropPass(): void
playPinDropFail(): void
startGlobeSpin(): void              // idempotent; silent no-op before initAudio()
stopGlobeSpin(): void               // no-op when not running
playNextPlace(): void
playSmallCheer(): void
playMediumApplause(): void
playGrandFanfare(): void
playToastChime(): void
playConfettiPop(): void
```

**Rules:**
1. **Lazy AudioContext.** Created inside `initAudio()` only — called once on the first user gesture (`pointerdown`/`keydown`, `{ once: true }` listeners registered in the app root). Satisfies autoplay policy. `webkitAudioContext` fallback. If `ctx.state === "suspended"`, call `ctx.resume()` inside `initAudio()` and at the top of each play call (best-effort, no await).
2. **Never crashes.** Module top-level touches no `window`/`document`/`AudioContext`. Every play function guards: `try { if (!ctx || !enabled) return; ... } catch { /* silent */ }`. SSR and jsdom tests get silent no-ops.
3. **Toggle.** `localStorage` key `meridian.sound` = `"on"` | `"off"`. **Default: ON** (rationale §5). Toggle reachable from the home screen (Chart Room header, speaker icon). Turning ON plays `playCardTap()` as confirmation; turning OFF is silent.
4. **Fire-and-forget.** Sounds never block gameplay, never gate on load, never await decode (there is nothing to decode).
5. **Enhancement only.** Every moment already has a visual equivalent on screen (button press state, ring + distance label, win/lose card, card highlight, selection state). Sound is never the sole signal.
6. **Reduced motion:** `prefers-reduced-motion` does **not** mute audio — motion and sound are orthogonal, and auto-muting would surprise. The sound toggle is the "reduced sound" control; that is the documented call.

## 5. Default ON — rationale

Sounds are soft (peaks ≤ 0.5 pre-master), short (longest 1.1 s), non-looping, and never the sole signal — the downside of default-ON is minimal. The upside is immediate: distance-pitch mapping and win/lose contours teach the game's feedback language from the first mystery, which serves Meridian's learning-outcomes-first philosophy. The toggle is one tap away on the home screen and persisted. (If Veeresh prefers default OFF for first-run quiet, it's a one-line change: default the `meridian.sound` read to `"off"`.)

## 6. Wiring checklist (for the implementing developer)

- [ ] `initAudio()` on first gesture in app root (both pointerdown and keydown, once).
- [ ] LoopScreen: `playConfirmGuess()` after duplicate-check passes; `playRingReveal(guess.distanceKm)` exactly once when the ring draws; `playWin()` / `playLose()` on reveal; `playDeal()` when the next mystery deals (not on reload-restore of an unacknowledged reveal).
- [ ] Home: `playCardTap()` on edition card press; `playDifficultySelect()` on difficulty change.
- [ ] Speaker toggle in Chart Room header; persists `meridian.sound`.
- [ ] Unit tests: `distanceToFrequencyKm` mapping (endpoints + band edges); play functions are no-ops without AudioContext (no throw in jsdom).
- [ ] Pin drop: `playPinDropPass()` when a tap is accepted (phase aim, playable map, camera idle, ≥300 ms since last tap); `playPinDropFail()` when a tap is rejected (camera animating, double-tap <300 ms, non-interactive chrome).
- [ ] Regular editions: `playNextPlace()` on the result-card "Next place" press (only when a new question actually deals); `playToastChime()` when narrow-in tiles swap in after the globe spin.
- [ ] Globe intro: `startGlobeSpin()` when the spin intent executes → `stopGlobeSpin()` on screen transition (the 30 s auto-stop is a backstop, not the mechanism); skipped intro → no sound at all.
- [ ] Celebrations: `playSmallCheer()` on streak 10/25/50 (with the 5 s spacing rule); `playMediumApplause()` on Easy/Medium cleared dialog (first clear only); `playGrandFanfare()` on hard-clear dialog and on 387-cycle completion (exactly once per cycle); `playConfettiPop()` only when visual confetti fires.

## 7. Careful-about list

- **Autoplay policy:** creating the context before a gesture leaves it `suspended` and everything silently no-ops — the once-listeners in the app root are load-bearing, not optional.
- **iOS Safari:** needs `webkitAudioContext` and a resume inside the gesture handler; also cap total scheduled-ahead time (recipes schedule ≤ 1.2 s, fine).
- **Don't "improve" the mapping:** the −0.28 exponent and 1568/98 Hz endpoints are tuned so 42 km (a good guess) lands mid-bright and antipodal lands at G2. Changing endpoints re-tunes the whole instrument.
- **Noise buffer:** generate once and cache; don't regenerate per `playDeal()` (GC churn on rapid taps).
- **No `setInterval`-driven anything** in this module; all scheduling is `ctx.currentTime`-relative.
- **React StrictMode double-effects:** `initAudio()` must be idempotent — second call is a no-op.
