/**
 * Provenance (honest, 2026-10-16): the 5 grandpa clips (`ask-01.mp3`,
 * `trail-01.mp3`..`trail-04.mp3` under `public/audio/grandpa/`) were
 * recorded and committed as-is in PR #165. No render script pins their
 * voice or settings — a reproducible render pipeline (like the
 * storyteller's `scripts/render-storyteller-voice.mjs`) is still owed.
 * Do not invent a voice name or settings here; when a real pipeline
 * exists, name it in this block.
 */

/**
 * Grandpa's narration. A different voice from the storyteller, and a
 * recorded file, never the device's speechSynthesis.
 *
 * The cough is a noise. It is not a word in the line.
 * Trail lines play while he walks. The coffee ask plays when the cloud
 * or the figure is hovered or clicked. The speaker toggle is the only mute.
 */

export const TRAIL_QUIPS = [
  "These hills did not ask my knees for permission.",
  "I can smell the coffee from the next ridge.",
  "A good map and a warm mug. That's the whole trick.",
  "Stay on the trail, explorer. The shortcuts are liars.",
] as const;

const TRAIL_FILES = ["trail-01.mp3", "trail-02.mp3", "trail-03.mp3", "trail-04.mp3"];
const ASK_FILE = "ask-01.mp3";

let current: HTMLAudioElement | null = null;
let coughTimer = 0;

function soundOn(): boolean {
  try {
    const v = localStorage.getItem("meridian.sound");
    return v == null || v === "on";
  } catch {
    return true;
  }
}

function clipUrl(file: string): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}audio/grandpa/${file}`;
}

function stopNarration(): void {
  window.clearTimeout(coughTimer);
  current?.pause();
  current = null;
}

/** One lazily-created AudioContext shared by all coughs. Kept alive
 * across coughs (never closed per-cough) so a fresh context is not
 * constructed every few seconds while grandpa walks. */
let sharedCtx: AudioContext | null = null;

/** Returns the shared AudioContext, creating it on first use. */
function getSharedCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      sharedCtx = new Ctx();
    } catch {
      // Audio unavailable — every play call is a silent no-op. The same
      // fail-soft rule sfx.ts lives by: sound never takes the game down.
      return null;
    }
  }
  return sharedCtx;
}

/** Two short rough bursts. Never a spoken word. Fail-soft like every
 * sfx.ts play function: if anything in the graph throws, the cough is
 * a silent no-op — sound is an enhancement, never a crash. */
export function playCough(): void {
  if (!soundOn() || typeof window === "undefined") return;
  try {
    const ctx = getSharedCtx();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const hit = t < 0.07 || (t > 0.14 && t < 0.22);
      data[i] = hit ? (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.9 : 0;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 480;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.45;
    // Never chain connect(): modern browsers return the destination
    // node, but old Safari returns undefined (WebKit bug 188834), and
    // a chain throws on it. Three plain statements wire the same graph.
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    // The shared context stays open; a suspended one resumes here (no-op
    // if already running).
    void ctx.resume();
    src.start();
  } catch {
    // Audio unavailable — the cough is a silent no-op from here.
  }
}

function playFile(file: string): void {
  if (!soundOn()) return;
  stopNarration();
  playCough();
  const audio = new Audio(clipUrl(file));
  current = audio;
  coughTimer = window.setTimeout(() => {
    if (current !== audio || !soundOn()) return;
    void audio.play().catch(() => {
      if (current === audio) current = null;
    });
  }, 420);
}

/** The trail line that matches the caption on screen. */
export function playTrail(index: number): void {
  playFile(TRAIL_FILES[index % TRAIL_FILES.length]!);
}

/** The locked coffee ask, spoken. */
export function playAsk(): void {
  playFile(ASK_FILE);
}

if (typeof window !== "undefined") {
  window.addEventListener("meridian:sound-change", (event) => {
    if (!(event as CustomEvent<boolean>).detail) stopNarration();
  });
}
