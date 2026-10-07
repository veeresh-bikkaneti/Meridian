/**
 * Meridian SFX — 100% Web Audio synthesized, zero assets.
 *
 * Implements the audio designer's spec at docs/sfx-spec.md (§1–§7),
 * extended by the celebration spec (§2.7–§2.14: 9 celebration sounds +
 * globe-spin loop via admitLoop). The 7 shipped play functions are
 * untouched by the extension.
 * Sonic identity: cartographic (clean attacks, sine/triangle cores),
 * inquisitive (sound answers "how close am I?"), brass-warm (low-passed,
 * gentle shimmer, ±4-cent detune pairs — never above −12 dB).
 *
 * Contract:
 * - All play functions return void, are fire-and-forget, and never throw.
 * - Module top-level touches no window/document/AudioContext (SSR/jsdom safe).
 * - The AudioContext is created lazily inside initAudio() only — called on
 *   the first user gesture via `{ once: true }` listeners in the app root
 *   (autoplay policy; see §7 of the spec — those listeners are load-bearing).
 * - Sound is enhancement only: every moment has a visual equivalent on
 *   screen. prefers-reduced-motion does NOT mute (the toggle is the
 *   "reduced sound" control).
 */

// ---------------------------------------------------------------------------
// Pure distance → frequency mapping (no AudioContext needed — unit-testable).
// ---------------------------------------------------------------------------

/**
 * Pitch = distance, mapped logarithmically (power law = linear in log–log
 * space). d clamps to [1, 20000] km.
 *
 * Spec §2.2 — the −0.28 exponent and 1568/98 Hz endpoints are TUNED so a
 * good guess (42 km) lands mid-bright and antipodal lands at G2. Do NOT
 * re-tune: changing endpoints re-tunes the whole instrument.
 */
export function distanceToFrequencyKm(km: number): number {
  const d = Math.min(20000, Math.max(1, km));
  return Math.round(1568 * Math.pow(d, -0.28));
}

// ---------------------------------------------------------------------------
// Toggle (localStorage, default ON)
// ---------------------------------------------------------------------------

const SOUND_KEY = "meridian.sound";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  try {
    const v = storage()?.getItem(SOUND_KEY);
    // Default ON (spec §5 rationale); one-line change to default OFF.
    // Absent storage (SSR/private mode) reads as ON — never crash.
    return v == null ? true : v === "on";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    storage()?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable (private mode etc.) — silent, game plays on.
  }
  if (!on) {
    // Toggling sound OFF stops any active loop (globe spin) immediately —
    // spec §7.1. The registry lives in the voice-management section below;
    // referenced here at call time, so declaration order is irrelevant.
    const stops = [...activeLoops.values()];
    activeLoops.clear();
    for (const stop of stops) {
      try {
        stop();
      } catch {
        // Silent — sound is enhancement only.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Context lifecycle
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** White-noise buffer for playDeal's snap — generated ONCE and cached (spec §7). */
let noiseBuf: AudioBuffer | null = null;

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Create (or wake) the AudioContext. Idempotent — safe under React
 * StrictMode double-effects: the second call just resumes the suspended
 * context and returns. Must be called from a user gesture (autoplay policy).
 */
export function initAudio(): void {
  try {
    if (typeof window === "undefined") return;
    if (ctx) {
      if (ctx.state === "suspended") void resumeQuietly(ctx);
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    // Global chain (spec §2): voice gain → masterGain(0.8) →
    // DynamicsCompressor(−9 dB, knee 6, ratio 12, 3 ms / 120 ms) → destination.
    const g = c.createGain();
    g.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -9;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    g.connect(comp);
    comp.connect(c.destination);
    ctx = c;
    master = g;
    if (ctx.state === "suspended") void resumeQuietly(ctx);
  } catch {
    // Audio unavailable — every play call is a silent no-op from here on.
  }
}

function resumeQuietly(c: AudioContext): Promise<void> | void {
  try {
    const r = c.resume();
    if (r && typeof (r as Promise<void>).catch === "function") {
      (r as Promise<void>).catch(() => {});
    }
    return r;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Voice management (spec §3)
// ---------------------------------------------------------------------------

type VoicePriority = 1 | 2 | 3; // 1 = UI blips (stealable), 2 = deal, 3 = ring/win/lose (never stolen by UI)
const MAX_VOICES = 8;
const DEBOUNCE_MS = 80; // same event re-fired within 80 ms replaces its instance

interface Voice {
  key: string;
  priority: VoicePriority;
  t: number;
  stop: () => void;
}

let voices: Voice[] = [];

/**
 * Admit a new voice. Returns a commit(stop) callback, or null when the
 * sound must be dropped (voice ceiling hit by higher-priority voices).
 * Debounce: re-firing the same key within 80 ms steals the previous
 * instance (ring re-trigger replaces the first — spec §2.2).
 */
function admit(
  key: string,
  priority: VoicePriority,
  durationMs: number,
): ((stop: () => void) => void) | null {
  try {
    if (!ctx || !master) return null;
    if (!isSoundEnabled()) return null;
    // Best-effort resume at the top of every play call (spec §4).
    if (ctx.state === "suspended") void resumeQuietly(ctx);

    const now = nowMs();
    const dup = voices.find((v) => v.key === key);
    if (dup && now - dup.t < DEBOUNCE_MS) {
      dup.stop();
      voices = voices.filter((v) => v !== dup);
    }
    if (voices.length >= MAX_VOICES) {
      // Steal the oldest lowest-priority voice. A higher-priority ceiling
      // refuses the newcomer instead (UI blips never steal ring/win/lose).
      const victim = [...voices].sort(
        (a, b) => a.priority - b.priority || a.t - b.t,
      )[0];
      if (!victim || victim.priority > priority) return null;
      victim.stop();
      voices = voices.filter((v) => v !== victim);
    }
    const voice: Voice = { key, priority, t: now, stop: () => {} };
    voices.push(voice);
    // One-shot bookkeeping prune (NOT setInterval — spec §7). A stolen or
    // finished voice is filtered out again harmlessly.
    if (typeof setTimeout !== "undefined") {
      setTimeout(() => {
        voices = voices.filter((v) => v !== voice);
      }, durationMs + 150);
    }
    return (stop: () => void) => {
      voice.stop = stop;
    };
  } catch {
    return null;
  }
}

/**
 * Module-level registry of active loop stops, keyed by voice key.
 * `setSoundEnabled(false)` stops every entry; a stolen/finished loop
 * removes itself via its wrapped stop. Loops have no setTimeout prune —
 * stop() removes the voice entry manually (spec §7.1).
 */
const activeLoops = new Map<string, () => void>();

/**
 * Admit a looping voice (the globe-spin texture). Same voice-ceiling and
 * steal ordering as admit(): a loop counts toward MAX_VOICES=8, and a
 * lower-priority loop (spin = priority 1) is stolen first by
 * ring/win/lose/fanfare. A stolen loop does NOT auto-restart — the map
 * layer re-arms on the next dragstart.
 *
 * Differences from admit():
 * - Same-key restart stops the previous instance IMMEDIATELY (no 80 ms
 *   debounce) — a new spin drag must cut the old texture at once.
 * - No setTimeout prune: the caller owns the lifetime and must call the
 *   stop (startGlobeSpin's 30 s auto-stop is a one-shot backstop, and
 *   stopGlobeSpin()/steal/setSoundEnabled(false) end it).
 * - The stop removes the voice entry manually via the wrapped callback.
 *
 * Returns true when admitted (voice registered, stop registered in
 * activeLoops), false when dropped (no context, sound off, or the ceiling
 * is held by higher-priority voices). Never throws.
 */
function admitLoop(key: string, priority: VoicePriority, onStop: () => void): boolean {
  try {
    if (!ctx || !master) return false;
    if (!isSoundEnabled()) return false;
    // Best-effort resume, same as admit() (spec §4).
    if (ctx.state === "suspended") void resumeQuietly(ctx);

    const now = nowMs();
    // Same-key restart: stop the previous loop immediately — no debounce.
    const dup = voices.find((v) => v.key === key);
    if (dup) {
      dup.stop();
      voices = voices.filter((v) => v !== dup);
    }
    if (voices.length >= MAX_VOICES) {
      // Steal the oldest lowest-priority voice. A higher-priority ceiling
      // refuses the newcomer instead (UI blips never steal ring/win/lose).
      const victim = [...voices].sort(
        (a, b) => a.priority - b.priority || a.t - b.t,
      )[0];
      if (!victim || victim.priority > priority) return false;
      victim.stop();
      voices = voices.filter((v) => v !== victim);
    }
    const voice: Voice = { key, priority, t: now, stop: () => {} };
    // Wrapped stop: runs the caller's teardown, removes the voice entry
    // manually, and unregisters from the loop registry.
    const wrappedStop = (): void => {
      try {
        onStop();
      } catch {
        // Silent — sound is enhancement only.
      }
      voices = voices.filter((v) => v !== voice);
      activeLoops.delete(key);
    };
    voice.stop = wrappedStop;
    voices.push(voice);
    activeLoops.set(key, wrappedStop);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Synthesis helpers
// ---------------------------------------------------------------------------

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  /** Exponential glide target (Hz) — set with glideTimeMs. */
  glideTo?: number;
  glideTimeMs?: number;
  /** Offset from the sound's t0, in ms. */
  atMs?: number;
  attackMs: number;
  decayMs: number;
  /** Gain peak 0–1 (pre-master). */
  peak: number;
  /** ±cent detune pair: two oscillators at −c/+c (spec: shimmer pairs). */
  detunePairCents?: number;
  /** Vibrato: LFO rate (Hz) and ±Hz depth applied to osc.frequency. */
  vibratoRateHz?: number;
  vibratoDepthHz?: number;
}

/**
 * Schedule one tone: linear attack, exponential decay to −60 dB (0.001),
 * osc stops at t0 + A + D + 50 ms (spec §2). Returns the source nodes so
 * voice-steal can stop them early.
 */
function scheduleTone(
  c: AudioContext,
  dest: AudioNode,
  t0: number,
  o: ToneOpts,
): AudioScheduledSourceNode[] {
  const t = t0 + (o.atMs ?? 0) / 1000;
  const a = o.attackMs / 1000;
  const d = o.decayMs / 1000;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.peak, t + a);
  env.gain.exponentialRampToValueAtTime(0.001, t + a + d);
  env.connect(dest);
  const startOne = (detuneCents: number): AudioScheduledSourceNode[] => {
    const osc = c.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.glideTo !== undefined && o.glideTimeMs) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t + o.glideTimeMs / 1000);
    }
    if (detuneCents) osc.detune.value = detuneCents;
    osc.connect(env);
    osc.start(t);
    osc.stop(t + a + d + 0.05);
    const out: AudioScheduledSourceNode[] = [osc];
    if (o.vibratoRateHz && o.vibratoDepthHz) {
      // LFO → depth gain → osc.frequency, for the small-cheer wobble.
      const lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = o.vibratoRateHz;
      const depth = c.createGain();
      depth.gain.value = o.vibratoDepthHz;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + a + d + 0.05);
      out.push(lfo);
    }
    return out;
  };
  return o.detunePairCents
    ? [...startOne(-o.detunePairCents), ...startOne(o.detunePairCents)]
    : startOne(0);
}

function lowpass(c: AudioContext, hz: number): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = hz;
  return f;
}

function stopAll(nodes: AudioScheduledSourceNode[], out: GainNode): void {
  for (const n of nodes) {
    try {
      n.stop();
    } catch {
      // Already stopped — harmless.
    }
  }
  try {
    out.disconnect();
  } catch {
    // Already disconnected — harmless.
  }
}

/**
 * The cached white-noise buffer (shared with playDeal's inline copy —
 * generation is identical: 0.5 s of white noise via the module-local PRNG).
 * Generated once; the globe-spin loop reuses it with loop=true, zero new
 * allocation (spec §7.1).
 */
function getNoiseBuf(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const len = Math.max(1, Math.floor(c.sampleRate * 0.5));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = sfxRandom() * 2 - 1;
    noiseBuf = buf;
  }
  return noiseBuf;
}

interface NoiseOpts {
  /** Filter type over the noise — default "bandpass". */
  filterType?: BiquadFilterType;
  /** Bandpass center / lowpass cutoff, Hz. */
  freq: number;
  /** Bandpass Q (ignored for lowpass). */
  q?: number;
  /** Optional exponential sweep of the filter frequency. */
  glideTo?: number;
  glideTimeMs?: number;
  /** Offset from the sound's t0, in ms. */
  atMs?: number;
  attackMs: number;
  decayMs: number;
  /** Gain peak 0–1 (pre-master). */
  peak: number;
}

/**
 * Schedule one filtered noise burst: linear attack, exponential decay to
 * −60 dB (0.001), source stops at t0 + A + D + 50 ms — the noise analogue
 * of scheduleTone. Returns the source node so voice-steal can stop it.
 */
function scheduleNoise(
  c: AudioContext,
  dest: AudioNode,
  t0: number,
  o: NoiseOpts,
): AudioScheduledSourceNode[] {
  const t = t0 + (o.atMs ?? 0) / 1000;
  const a = o.attackMs / 1000;
  const d = o.decayMs / 1000;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  const f = c.createBiquadFilter();
  f.type = o.filterType ?? "bandpass";
  f.frequency.setValueAtTime(o.freq, t);
  if (o.glideTo !== undefined && o.glideTimeMs) {
    f.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t + o.glideTimeMs / 1000);
  }
  if (o.q !== undefined) f.Q.value = o.q;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.peak, t + a);
  env.gain.exponentialRampToValueAtTime(0.001, t + a + d);
  src.connect(f);
  f.connect(env);
  env.connect(dest);
  src.start(t);
  src.stop(t + a + d + 0.05);
  return [src];
}

/**
 * Module-local PRNG (mulberry32) for UI-blip jitter and the noise buffer.
 *
 * Deliberately NOT Math.random()/crypto.getRandomValues(): deterministic
 * E2E tests mock those globals with a single stateful sequence to fix the
 * deal, and any draw we took would shift every downstream value (observed:
 * one jitter draw moved a seeded deal's true spot from Hungary to Iran).
 * Seeded from performance.now() at first use — tap-to-tap variation is all
 * the spec's ±2% anti-machine-gun jitter needs.
 */
let prngState = 0;
function sfxRandom(): number {
  if (prngState === 0) {
    const t =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? Math.floor(performance.now() * 1000)
        : 0;
    prngState = ((0x9e3779b9 ^ t) >>> 0) || 1;
  }
  prngState |= 0;
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** ±2% random detune — UI blips only, so rapid taps don't machine-gun (spec §3). */
function uiJitter(freq: number): number {
  return freq * (1 + (sfxRandom() * 0.04 - 0.02));
}

// ---------------------------------------------------------------------------
// The 8 shipped sounds (spec §2.1–§2.6) — DO NOT alter their recipes.
// ---------------------------------------------------------------------------

/** GeoDetective guess confirm — fired once, after the duplicate check passes. */
export function playConfirmGuess(): void {
  try {
    const commit = admit("confirm", 1, 200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3200);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes = [
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: uiJitter(660),
        glideTo: uiJitter(720),
        glideTimeMs: 60,
        attackMs: 5,
        decayMs: 90,
        peak: 0.22,
      }),
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: uiJitter(990), // perfect fifth above 660
        attackMs: 5,
        decayMs: 90,
        peak: 0.22,
      }),
    ];
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Distance ring reveal — pitch IS the distance. Three bands:
 * close (<500 km) bright ping · mid (500–4000 km) warm tick ·
 * far (>4000 km) dull thud. Deterministic (carries information — no jitter).
 * Never fires more than once per reveal: a re-fire within 80 ms steals the
 * previous instance (§2.2 voice-steal).
 */
export function playRingReveal(distanceKm: number): void {
  try {
    const commit = admit("ring", 3, 800);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const d = Math.min(20000, Math.max(1, distanceKm));
    const f = distanceToFrequencyKm(d);
    const out = c.createGain();
    out.connect(master);
    let nodes: AudioScheduledSourceNode[];
    if (d < 500) {
      // Close: bright ping — sine @ f + shimmer sine @ 2f at −14 dB.
      const lp = lowpass(c, 6000);
      lp.connect(out);
      nodes = [
        ...scheduleTone(c, lp, t0, { type: "sine", freq: f, attackMs: 3, decayMs: 420, peak: 0.45 }),
        ...scheduleTone(c, lp, t0, { type: "sine", freq: 2 * f, attackMs: 3, decayMs: 420, peak: 0.09 }),
      ];
    } else if (d <= 4000) {
      // Mid: warm tick — triangle @ f with gentle down-glide f → 0.94f.
      const lp = lowpass(c, 2500);
      lp.connect(out);
      nodes = [
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq: f,
          glideTo: 0.94 * f,
          glideTimeMs: 120,
          attackMs: 4,
          decayMs: 260,
          peak: 0.4,
        }),
      ];
    } else {
      // Far: dull thud — sine @ f + body triangle @ f/2 gliding down.
      const lp = lowpass(c, 700);
      lp.connect(out);
      nodes = [
        ...scheduleTone(c, lp, t0, { type: "sine", freq: f, attackMs: 6, decayMs: 500, peak: 0.5 }),
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq: 0.5 * f,
          glideTo: 0.45 * f,
          glideTimeMs: 500,
          attackMs: 6,
          decayMs: 500,
          peak: 0.25,
        }),
      ];
    }
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** Mystery solved — rising major arpeggio C5→E5→G5→C6, staggered 110 ms. */
/**
 * Correct pin — BOLD arcade win fanfare (Mario-style excitement, original
 * melody). Bouncy ascending run with square-wave punch, ending in a
 * triumphant held chord. Unmistakable: you NAILED it.
 */
export function playWin(): void {
  try {
    const commit = admit("win", 3, 1600);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 6000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Ascending bouncy run: C5 E5 G5 C6 E6 — square wave for arcade punch.
    // Original melody (not Nintendo's) — the STYLE is celebratory arcade.
    const run = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    run.forEach((freq, i) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "square",
          freq,
          atMs: i * 90,
          attackMs: 5,
          decayMs: 180,
          peak: 0.22,
        }),
      );
    });
    // Triumphant final chord: C6 + E6 + G6 held (triangle for warmth under
    // the square punch).
    const chordAt = run.length * 90;
    [1046.5, 1318.5, 1568.0].forEach((freq) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq,
          atMs: chordAt,
          attackMs: 10,
          decayMs: 700,
          peak: 0.28,
          detunePairCents: 4,
        }),
      );
    });
    // Sparkle octave on top.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: 2093.0,
        atMs: chordAt,
        attackMs: 5,
        decayMs: 800,
        peak: 0.1,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Wrong pin — distinctive descending "game over" tune (Mario-style death,
 * original melody). Clear chromatic descent with sawtooth edge: unmistakable
 * "aww, you missed." Bouncy, not harsh — kids are the audience.
 */
export function playLose(): void {
  try {
    const commit = admit("lose", 3, 1400);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Descending "death" run: E5 Eb5 D5 Db5 C5 — chromatic slide down.
    // Original melody (not Nintendo's) — the STYLE is classic arcade fail.
    const descent = [659.25, 622.25, 587.33, 554.37, 523.25];
    descent.forEach((freq, i) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "sawtooth",
          freq,
          atMs: i * 130,
          attackMs: 8,
          decayMs: 220,
          peak: 0.18,
        }),
      );
    });
    // Final "womp": low B3 held with a downward glide — the sad trombone.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "sawtooth",
        freq: 246.94,
        glideTo: 185.0,
        glideTimeMs: 400,
        atMs: descent.length * 130,
        attackMs: 10,
        decayMs: 500,
        peak: 0.2,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Edition entrance — EPIC gladiator/Colosseum brass horn fanfare. Bold,
 * triumphant horn calls announcing the player's arrival into an edition
 * (globe/country/state). Sawtooth brass at low-mid register, original
 * composition — think arena horns, not any specific movie theme.
 */
export function playEditionEntrance(): void {
  try {
    const commit = admit("edition-entrance", 3, 2000);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 2500);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Horn call 1: G3 – C4 – E4 – G4 (rising fifths, the "announcement").
    const call1 = [196.0, 261.63, 329.63, 392.0];
    call1.forEach((freq, i) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "sawtooth",
          freq,
          atMs: i * 160,
          attackMs: 20,
          decayMs: 280,
          peak: 0.25,
        }),
      );
    });
    // Horn call 2 (answer): A3 – D4 – F#4 – A4 — a fourth higher, bolder.
    const call2 = [220.0, 293.66, 369.99, 440.0];
    const call2At = call1.length * 160 + 80;
    call2.forEach((freq, i) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "sawtooth",
          freq,
          atMs: call2At + i * 160,
          attackMs: 20,
          decayMs: 280,
          peak: 0.25,
        }),
      );
    });
    // Triumphant finale: D4 + G4 + B4 held together (G major chord).
    const finaleAt = call2At + call2.length * 160 + 60;
    [293.66, 392.0, 493.88].forEach((freq) => {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "sawtooth",
          freq,
          atMs: finaleAt,
          attackMs: 30,
          decayMs: 900,
          peak: 0.22,
          detunePairCents: 5,
        }),
      );
    });
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** Next case dealt — "case file snapped open": paper snap + low tick. */
export function playDeal(): void {
  try {
    const commit = admit("deal", 2, 300);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 5000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Snap: cached white-noise buffer → bandpass 2400 Hz, Q 1.2.
    if (!noiseBuf) {
      const len = Math.max(1, Math.floor(c.sampleRate * 0.5));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = sfxRandom() * 2 - 1;
      noiseBuf = buf;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 1.2;
    const snapEnv = c.createGain();
    snapEnv.gain.setValueAtTime(0.0001, t0);
    snapEnv.gain.linearRampToValueAtTime(0.32, t0 + 0.002);
    snapEnv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.002 + 0.068);
    src.connect(bp);
    bp.connect(snapEnv);
    snapEnv.connect(lp);
    src.start(t0);
    src.stop(t0 + 0.002 + 0.068 + 0.05);
    nodes.push(src);
    // Tick: triangle 196 Hz (G3) at t0 + 25 ms.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "triangle",
        freq: 196,
        atMs: 25,
        attackMs: 3,
        decayMs: 110,
        peak: 0.22,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** Home: edition card tap — triangle D5. */
export function playCardTap(): void {
  try {
    const commit = admit("card", 1, 200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes = scheduleTone(c, lp, t0, {
      type: "triangle",
      freq: uiJitter(587.33),
      attackMs: 4,
      decayMs: 110,
      peak: 0.2,
    });
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** Home: difficulty select — a fifth above the card tap so the two never feel identical. */
export function playDifficultySelect(): void {
  try {
    const commit = admit("difficulty", 1, 300);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3200);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes = [
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: uiJitter(880),
        glideTo: uiJitter(940),
        glideTimeMs: 80,
        attackMs: 4,
        decayMs: 140,
        peak: 0.22,
      }),
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: uiJitter(1318.5), // fifth shimmer at −14 dB
        attackMs: 4,
        decayMs: 140,
        peak: 0.05,
      }),
    ];
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

// ---------------------------------------------------------------------------
// Celebration sounds (celebration spec §2.7–§2.14). Same contract as the
// shipped sounds: void, fire-and-forget, try/catch-guarded, behind the
// meridian.sound toggle, master chain untouched. UI blips (pinDrop,
// nextPlace, toast, confetti) get ±2% uiJitter; celebrations are
// deterministic. Peaks: UI tier ≤ 0.25 · cheer/applause ≤ 0.40 ·
// fanfare ≤ 0.45. Fundamentals live in 98–1600 Hz.
// ---------------------------------------------------------------------------

/**
 * Pin placed, placement accepted — a "chart-stamp": bright up-glide +
 * paper tok. Distinct from playCardTap (D5 587 fixed): lower, gliding,
 * with the paper tok. Pass/fail is about placement, never accuracy.
 */
export function playPinDropPass(): void {
  try {
    const commit = admit("pindrop", 1, 150);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3200);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Osc 1: triangle 392 → 440 Hz exp glide over 40 ms (inquisitive up-lift).
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "triangle",
        freq: uiJitter(392),
        glideTo: uiJitter(440),
        glideTimeMs: 40,
        attackMs: 3,
        decayMs: 60,
        peak: 0.24,
      }),
    );
    // Osc 2: paper tok — cached noise → bandpass 1800 Hz, Q 1.0.
    nodes.push(
      ...scheduleNoise(c, lp, t0, {
        freq: 1800,
        q: 1.0,
        attackMs: 2,
        decayMs: 30,
        peak: 0.1,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Tap rejected — soft "page turn": airy descend. Fail = placement
 * rejected, no reveal follows (camera animating, double-tap misfire, tap
 * on non-interactive chrome). Deliberately no buzzer, no dissonance;
 * distinguishable from the pass in <150 ms (bright up-lift vs descend).
 */
export function playPinDropFail(): void {
  try {
    const commit = admit("pindrop", 1, 300);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 1000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Noise: bandpass sweeping 1200 → 450 Hz over 220 ms, soft attack.
    nodes.push(
      ...scheduleNoise(c, lp, t0, {
        freq: 1200,
        glideTo: 450,
        glideTimeMs: 220,
        attackMs: 25,
        decayMs: 220,
        peak: 0.14,
      }),
    );
    // Osc: sine 247 → 220 Hz gentle exp fall over 200 ms.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: uiJitter(247),
        glideTo: uiJitter(220),
        glideTimeMs: 200,
        attackMs: 25,
        decayMs: 240,
        peak: 0.12,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** One-shot backstop for the globe-spin loop: fires stopGlobeSpin() at 30 s. */
let spinAutoStop: ReturnType<typeof setTimeout> | undefined;

/**
 * Start the intro globe-rotation texture (spec §7.1): the cached noise
 * buffer looping (zero new allocation) → bandpass 850 Hz Q0.7 → gain
 * ramps 0 → 0.10 over 400 ms. Idempotent — restarting cuts the previous
 * loop immediately (no debounce) and re-arms the 30 s safety. Before
 * initAudio() (or with sound off) this is a silent no-op that never throws.
 */
export function startGlobeSpin(): void {
  try {
    if (!ctx || !master) return;
    // Cut any running spin first: idempotent restart AND clears the old
    // 30 s backstop so a fresh one is armed below.
    stopGlobeSpin();
    const c = ctx;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = getNoiseBuf(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 850;
    bp.Q.value = 0.7;
    const spinGain = c.createGain();
    spinGain.gain.setValueAtTime(0, t0);
    spinGain.gain.linearRampToValueAtTime(0.1, t0 + 0.4);
    src.connect(bp);
    bp.connect(spinGain);
    spinGain.connect(master);
    src.start(t0);
    let stopped = false;
    const doStop = (): void => {
      if (stopped) return;
      stopped = true;
      try {
        const t = c.currentTime;
        spinGain.gain.cancelScheduledValues(t);
        spinGain.gain.setValueAtTime(spinGain.gain.value, t);
        spinGain.gain.linearRampToValueAtTime(0.0001, t + 0.25);
        src.stop(t + 0.3);
        if (typeof setTimeout !== "undefined") {
          setTimeout(() => {
            try {
              spinGain.disconnect();
            } catch {
              // Already disconnected — harmless.
            }
          }, 400);
        }
      } catch {
        // Silent — sound is enhancement only.
      }
    };
    if (!admitLoop("spin", 1, doStop)) {
      // Dropped (voice ceiling held by higher-priority voices) — tear down.
      try {
        src.stop();
      } catch {
        // Already stopped — harmless.
      }
      try {
        spinGain.disconnect();
      } catch {
        // Already disconnected — harmless.
      }
      return;
    }
    // 30 s auto-stop safety: a single one-shot setTimeout (NOT setInterval —
    // spec §7). Backstop only; callers stop on screen transition.
    if (typeof setTimeout !== "undefined") {
      spinAutoStop = setTimeout(() => {
        spinAutoStop = undefined;
        stopGlobeSpin();
      }, 30_000);
    }
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Stop the globe-spin texture: gain fades to 0.0001 over 250 ms, the
 * source stops at fade end, nodes disconnect. No-op when not running —
 * never throws.
 */
export function stopGlobeSpin(): void {
  try {
    if (typeof clearTimeout !== "undefined" && spinAutoStop !== undefined) {
      clearTimeout(spinAutoStop);
      spinAutoStop = undefined;
    }
    const stop = activeLoops.get("spin");
    if (stop) stop(); // wrapped: fades out, removes the voice entry, unregisters
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Regular-game "Next place" — chart unrolling, not a case file:
 * bright paper snap + rising chirp. Distinct from playDeal's 2400 Hz snap.
 */
export function playNextPlace(): void {
  try {
    const commit = admit("nextplace", 1, 200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3200);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Snap: brighter paper than playDeal's snap (3000 Hz vs 2400 Hz).
    nodes.push(
      ...scheduleNoise(c, lp, t0, {
        freq: 3000,
        q: 1.0,
        attackMs: 2,
        decayMs: 50,
        peak: 0.24,
      }),
    );
    // Chirp: triangle 330 → 392 Hz over 60 ms at t0 + 20 ms.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "triangle",
        freq: uiJitter(330),
        glideTo: uiJitter(392),
        glideTimeMs: 60,
        atMs: 20,
        attackMs: 3,
        decayMs: 90,
        peak: 0.18,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Spark/Cheer-tier milestone — three triangle voices (C5→E5→G5),
 * staggered 70 ms, formant-tinted (bandpass 900 Hz Q2) with a 6 Hz
 * vibrato ±15 Hz. Deterministic (celebrations carry meaning — no jitter).
 */
export function playSmallCheer(): void {
  try {
    const commit = admit("cheer", 3, 500);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 2;
    const out = c.createGain();
    bp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const [i, freq] of [523.25, 659.25, 783.99].entries()) {
      nodes.push(
        ...scheduleTone(c, bp, t0, {
          type: "triangle",
          freq,
          atMs: i * 70,
          attackMs: 5,
          decayMs: 250,
          peak: 0.18,
          vibratoRateHz: 6,
          vibratoDepthHz: 15,
        }),
      );
    }
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Difficulty cleared — 8 hand-claps over a G-major pad. 8 cached-noise
 * bursts (bandpass 1500 Hz Q1.5) + triangle triad 392/493.88/587.33 with
 * ±4-cent detune pairs. Deterministic. Total ~1.15 s (≤ 1.2 s ceiling).
 */
export function playMediumApplause(): void {
  try {
    const commit = admit("applause", 3, 1200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 2500);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // Claps at t0 + 90/180/300/430/560/700/870/1050 ms.
    for (const atMs of [90, 180, 300, 430, 560, 700, 870, 1050]) {
      nodes.push(
        ...scheduleNoise(c, lp, t0, {
          freq: 1500,
          q: 1.5,
          atMs,
          attackMs: 1,
          decayMs: 40,
          peak: 0.14,
        }),
      );
    }
    // Pad: G-major triad, ±4-cent detune pairs (brass-warm shimmer).
    for (const freq of [392, 493.88, 587.33]) {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq,
          attackMs: 50,
          decayMs: 1000,
          peak: 0.1,
          detunePairCents: 4,
        }),
      );
    }
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * 387-cycle completion / hard-clear coronation — G-major fanfare
 * (distinct from playWin's C major): G4 392 → C5 523.25 → E5 659.25 →
 * G5 783.99 (hold), staggered 140/140/280 ms, ±4-cent detune pairs; sine
 * shimmer 1568 Hz on the final; noise crowd swell → lowpass 800 Hz.
 * Deterministic. Total ~1.15 s — Veeresh's locked fit (spec §2.7): the
 * recipe's shimmer D 700 is trimmed to D 570 so the final lands at
 * 560 + 8 + 570 = 1138 ms, inside the 1.2 s ceiling.
 */
export function playGrandFanfare(): void {
  try {
    const commit = admit("fanfare", 3, 1200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 4500);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    const notes: Array<[number, number]> = [
      [392, 0],
      [523.25, 140],
      [659.25, 280],
      [783.99, 560],
    ];
    for (const [freq, atMs] of notes) {
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq,
          atMs,
          attackMs: 8,
          decayMs: 420,
          peak: 0.28,
          detunePairCents: 4,
        }),
      );
    }
    // Shimmer on the final note.
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: 1568,
        atMs: 560,
        attackMs: 8,
        decayMs: 570,
        peak: 0.08,
      }),
    );
    // Crowd swell: noise → lowpass 800 Hz, A 300 ms / D 600 ms.
    nodes.push(
      ...scheduleNoise(c, lp, t0, {
        filterType: "lowpass",
        freq: 800,
        attackMs: 300,
        decayMs: 600,
        peak: 0.1,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Milestone banner slides in (no confetti) — soft glassy chime:
 * sine 880 → 990 Hz glide over 80 ms. UI tier (jittered).
 */
export function playToastChime(): void {
  try {
    const commit = admit("toast", 1, 150);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes = scheduleTone(c, lp, t0, {
      type: "sine",
      freq: uiJitter(880),
      glideTo: uiJitter(990),
      glideTimeMs: 80,
      attackMs: 4,
      decayMs: 80,
      peak: 0.16,
    });
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/**
 * Confetti burst — fires ONLY when visual confetti fires: two noise pops
 * (bandpass 2200 Hz Q1.2) at t0 and t0 + 120 ms + a triangle 660 → 880 Hz
 * chirp. UI tier (jittered).
 */
export function playConfettiPop(): void {
  try {
    const commit = admit("confetti", 1, 350);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 3200);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    for (const atMs of [0, 120]) {
      nodes.push(
        ...scheduleNoise(c, lp, t0, {
          freq: 2200,
          q: 1.2,
          atMs,
          attackMs: 1,
          decayMs: 35,
          peak: 0.14,
        }),
      );
    }
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "triangle",
        freq: uiJitter(660),
        glideTo: uiJitter(880),
        glideTimeMs: 120,
        attackMs: 3,
        decayMs: 120,
        peak: 0.12,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}
