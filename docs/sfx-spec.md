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

---

## 3. Mix rules

- **Master ceiling:** `masterGain = 0.8` into the safety compressor (§2). No clipping, ever.
- **Per-sound peaks (pre-master):** UI blips ≤ 0.25 · ring ≤ 0.50 · win/lose ≤ 0.45 · deal ≤ 0.40.
- **Mobile-speaker-friendly:** no fundamental below 98 Hz; every voice low-passed ≤ 8000 Hz; all fundamentals live in 98–1600 Hz where phone speakers actually reproduce. No sub-bass, no harsh highs.
- **Max 8 concurrent voices.** Priority: ring / win / lose = high (never stolen by UI); UI blips = low. Steal policy: steal oldest lowest-priority voice; same event re-fired within 80 ms replaces its previous instance (debounce).
- **Max duration:** no single sound exceeds 1.2 s (win arpeggio at ~1.1 s is the ceiling).
- **Micro-variation:** ±2% random detune on UI blips only, so rapid taps don't machine-gun. Ring/win/lose/deal are deterministic — they carry information.

## 4. Architecture contract — `src/game/audio/sfx.ts`

**Public API** (all return `void`, all fire-and-forget — never awaited, never throwing):
```ts
initAudio(): void
isSoundEnabled(): boolean
setSoundEnabled(on: boolean): void
distanceToFrequencyKm(km: number): number   // pure — unit-testable, no AudioContext needed
playConfirmGuess(): void
playRingReveal(distanceKm: number): void
playWin(): void
playLose(): void
playDeal(): void
playCardTap(): void
playDifficultySelect(): void
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

## 7. Careful-about list

- **Autoplay policy:** creating the context before a gesture leaves it `suspended` and everything silently no-ops — the once-listeners in the app root are load-bearing, not optional.
- **iOS Safari:** needs `webkitAudioContext` and a resume inside the gesture handler; also cap total scheduled-ahead time (recipes schedule ≤ 1.2 s, fine).
- **Don't "improve" the mapping:** the −0.28 exponent and 1568/98 Hz endpoints are tuned so 42 km (a good guess) lands mid-bright and antipodal lands at G2. Changing endpoints re-tunes the whole instrument.
- **Noise buffer:** generate once and cache; don't regenerate per `playDeal()` (GC churn on rapid taps).
- **No `setInterval`-driven anything** in this module; all scheduling is `ctx.currentTime`-relative.
- **React StrictMode double-effects:** `initAudio()` must be idempotent — second call is a no-op.
