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

/** Two short rough bursts. Never a spoken word. */
export function playCough(): void {
  if (!soundOn() || typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
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
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.onended = () => void ctx.close();
  src.start();
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
