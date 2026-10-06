/**
 * Meridian SFX — 100% Web Audio synthesized, zero assets.
 *
 * Implements the audio designer's spec at docs/sfx-spec.md (§1–§7).
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
  const startOne = (detuneCents: number): OscillatorNode => {
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
    return osc;
  };
  return o.detunePairCents
    ? [startOne(-o.detunePairCents), startOne(o.detunePairCents)]
    : [startOne(0)];
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

/** ±2% random detune — UI blips only, so rapid taps don't machine-gun (spec §3). */
function uiJitter(freq: number): number {
  return freq * (1 + (Math.random() * 0.04 - 0.02));
}

// ---------------------------------------------------------------------------
// The 8 sounds (spec §2)
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
export function playWin(): void {
  try {
    const commit = admit("win", 3, 1200);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 5000);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const nodes: AudioScheduledSourceNode[] = [];
    notes.forEach((freq, i) => {
      const last = i === notes.length - 1;
      nodes.push(
        ...scheduleTone(c, lp, t0, {
          type: "triangle",
          freq,
          atMs: i * 110,
          attackMs: 5,
          decayMs: 380,
          peak: 0.3,
          // ±4-cent detune pair on the final C6 only (spec §2.3).
          detunePairCents: last ? 4 : undefined,
        }),
      );
    });
    // Final C6 sine octave shimmer @ 2093 Hz (−14 dB-ish, never above −12).
    nodes.push(
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: 2093,
        atMs: 3 * 110,
        attackMs: 5,
        decayMs: 700,
        peak: 0.08,
      }),
    );
    commit(() => stopAll(nodes, out));
  } catch {
    // Silent — sound is enhancement only.
  }
}

/** Out of guesses — muted descending two-note sting (page turning, not a buzzer). */
export function playLose(): void {
  try {
    const commit = admit("lose", 3, 900);
    if (!commit || !ctx || !master) return;
    const c = ctx;
    const t0 = c.currentTime;
    const lp = lowpass(c, 1400);
    const out = c.createGain();
    lp.connect(out);
    out.connect(master);
    const nodes = [
      ...scheduleTone(c, lp, t0, { type: "sine", freq: 440, attackMs: 8, decayMs: 420, peak: 0.38 }),
      ...scheduleTone(c, lp, t0, {
        type: "sine",
        freq: 329.63,
        atMs: 220,
        attackMs: 8,
        decayMs: 420,
        peak: 0.38,
      }),
    ];
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
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
