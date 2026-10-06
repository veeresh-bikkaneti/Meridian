import type { BrowserContext, Page } from "playwright/test";

/**
 * Shared AudioContext stub for the SFX E2E specs (extracted from
 * game-sfx.spec.ts per the celebration spec §7.6).
 *
 * The stub records every created node into `window.__sfxCalls`:
 * - oscillators: `{ kind: "osc", type, freq, glideTo }` — freq from
 *   setValueAtTime / direct value sets, glideTo from exponential ramps;
 * - buffer sources: `{ kind: "src", loop, started, stopped }` — the globe
 *   spin's looping texture sets `loop = true`;
 * - biquad filters: `{ kind: "filter", type, freq }` — e.g. the spin's
 *   850 Hz bandpass;
 * - gains: `{ kind: "gain", sets, ramps }` — every setValueAtTime /
 *   linearRampToValueAtTime value, so the spin's 0 → 0.10 fade-in and its
 *   ramp-down to 0.0001 are observable;
 * and counts context constructions in `window.__sfxCtxCreated`.
 *
 * The game must stay fully playable silent: the stub is a stand-in for
 * "no audio hardware" as much as for "audio works" — every flow asserts
 * the game advances while sounds are observed on the side.
 */

export type SfxOscCall = {
  kind: "osc";
  type: string;
  freq: number;
  glideTo: number | null;
};

export type SfxSrcCall = {
  kind: "src";
  loop: boolean;
  started: boolean;
  stopped: boolean;
};

export type SfxFilterCall = {
  kind: "filter";
  type: string;
  freq: number;
};

export type SfxGainCall = {
  kind: "gain";
  sets: number[];
  ramps: number[];
};

export type SfxCall = SfxOscCall | SfxSrcCall | SfxFilterCall | SfxGainCall;

/**
 * Install the stub on a browser context. Must run before any page script
 * (the sfx module reads window.AudioContext lazily inside initAudio(), so
 * this fully substitutes the real implementation).
 */
export async function installSfxStub(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const calls: Array<Record<string, unknown>> = [];
    const w = window as unknown as Record<string, unknown>;
    w.__sfxCalls = calls;
    w.__sfxCtxCreated = 0;

    const makeParam = (hooks?: {
      onSet?: (v: number) => void;
      onRamp?: (v: number) => void;
      onExp?: (v: number) => void;
    }) => {
      let val = 0;
      // Raw write: bypasses the setter so scheduled ramps don't re-fire
      // onSet (the oscillator's freq must stay the setValueAtTime value,
      // not the glide target — same contract as the original stub).
      const setRaw = (v: number): void => {
        val = v;
      };
      return {
        get value(): number {
          return val;
        },
        set value(v: number) {
          setRaw(v);
          hooks?.onSet?.(v);
        },
        setValueAtTime(v: number) {
          // Routes through the setter so direct `.value = x` writes and
          // scheduled writes record identically.
          (this as { value: number }).value = v;
        },
        linearRampToValueAtTime(v: number) {
          setRaw(v);
          hooks?.onRamp?.(v);
        },
        exponentialRampToValueAtTime(v: number) {
          setRaw(v);
          hooks?.onExp?.(v);
        },
        setTargetAtTime() {},
        cancelScheduledValues() {},
        cancelAndHoldAtTime() {},
      };
    };

    class FakeAudioContext {
      currentTime = 0;
      state = "running";
      sampleRate = 44100;
      destination = {};
      constructor() {
        w.__sfxCtxCreated = (w.__sfxCtxCreated as number) + 1;
      }
      resume() {
        return Promise.resolve();
      }
      createGain() {
        const rec: Record<string, unknown> = { kind: "gain", sets: [], ramps: [] };
        calls.push(rec);
        return {
          gain: makeParam({
            onSet: (v) => (rec.sets as number[]).push(v),
            onRamp: (v) => (rec.ramps as number[]).push(v),
          }),
          connect() {},
          disconnect() {},
        };
      }
      createOscillator() {
        const rec: Record<string, unknown> = {
          kind: "osc",
          type: "sine",
          freq: 0,
          glideTo: null,
        };
        calls.push(rec);
        return {
          set type(v: string) {
            rec.type = v;
          },
          get type(): string {
            return rec.type as string;
          },
          frequency: makeParam({
            onSet: (v) => {
              rec.freq = v;
            },
            onExp: (v) => {
              rec.glideTo = v;
            },
          }),
          detune: makeParam(),
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
        };
      }
      createBiquadFilter() {
        const rec: Record<string, unknown> = { kind: "filter", type: "lowpass", freq: 0 };
        calls.push(rec);
        return {
          get type(): string {
            return rec.type as string;
          },
          set type(v: string) {
            rec.type = v;
          },
          frequency: makeParam({
            onSet: (v) => {
              rec.freq = v;
            },
          }),
          Q: makeParam(),
          connect() {},
          disconnect() {},
        };
      }
      createDynamicsCompressor() {
        return {
          threshold: makeParam(),
          knee: makeParam(),
          ratio: makeParam(),
          attack: makeParam(),
          release: makeParam(),
          connect() {},
          disconnect() {},
        };
      }
      createBuffer(_ch: number, len: number, _rate: number) {
        return { getChannelData: () => new Float32Array(len) };
      }
      createBufferSource() {
        const rec: Record<string, unknown> = {
          kind: "src",
          loop: false,
          started: false,
          stopped: false,
        };
        calls.push(rec);
        return {
          get loop(): boolean {
            return rec.loop as boolean;
          },
          set loop(v: boolean) {
            rec.loop = v;
          },
          buffer: null,
          connect() {},
          disconnect() {},
          start() {
            rec.started = true;
          },
          stop() {
            rec.stopped = true;
          },
        };
      }
    }
    w.AudioContext = FakeAudioContext;
  });
}

export async function sfxCalls(page: Page): Promise<SfxCall[]> {
  return page.evaluate(
    () => (window as unknown as { __sfxCalls: SfxCall[] }).__sfxCalls ?? [],
  );
}

export async function oscRecords(page: Page): Promise<SfxOscCall[]> {
  return (await sfxCalls(page)).filter((c): c is SfxOscCall => c.kind === "osc");
}

export async function srcRecords(page: Page): Promise<SfxSrcCall[]> {
  return (await sfxCalls(page)).filter((c): c is SfxSrcCall => c.kind === "src");
}

export async function filterRecords(page: Page): Promise<SfxFilterCall[]> {
  return (await sfxCalls(page)).filter(
    (c): c is SfxFilterCall => c.kind === "filter",
  );
}

export async function gainRecords(page: Page): Promise<SfxGainCall[]> {
  return (await sfxCalls(page)).filter((c): c is SfxGainCall => c.kind === "gain");
}

export async function ctxCreated(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __sfxCtxCreated: number }).__sfxCtxCreated ?? 0,
  );
}

export async function srcCount(page: Page): Promise<number> {
  return (await srcRecords(page)).length;
}

/** The spec's mapping, replicated to compute the expected ring pitch. */
export function expectedHz(distKm: number): number {
  const d = Math.min(20000, Math.max(1, distKm));
  return Math.round(1568 * Math.pow(d, -0.28));
}
