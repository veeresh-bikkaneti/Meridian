import assert from "node:assert/strict";
import test from "node:test";

import {
  createDetectiveSpeech,
  resolveDetectiveClip,
  type DetectiveManifest,
  type DetectiveSpeaker,
} from "./detective-audio.ts";
import type { SpeakRef } from "./detective-state.ts";

const MANIFEST: DetectiveManifest = {
  v: 1,
  voices: { holmes: "avocado_v2:atlas", watson: "avocado_v2:pb1_music_02" },
  fixed: {
    "ack-1": { file: "fixed/ack-1.mp3", voice: "avocado_v2:atlas" },
    suspicion: { file: "fixed/suspicion.mp3", voice: "avocado_v2:atlas" },
    "debrief-frame": { file: "fixed/debrief-frame.mp3", voice: "avocado_v2:atlas" },
    "debrief-close": { file: "fixed/debrief-close.mp3", voice: "avocado_v2:atlas" },
  },
  cases: {
    "387": {
      clues: [
        { file: "case-387/clue-1.mp3", voice: "avocado_v2:pb1_music_02" },
        { file: "case-387/clue-2.mp3", voice: "avocado_v2:pb1_music_02" },
        null,
        null,
        null,
      ],
      answer: { file: "case-387/answer.mp3", voice: "avocado_v2:atlas" },
    },
  },
  names: {
    "323786": { file: "names/323786.mp3", voice: "avocado_v2:atlas" },
  },
};

const BASE = "/";
function resolve(ref: SpeakRef, caseIndex = 387) {
  return resolveDetectiveClip(MANIFEST, ref, caseIndex, BASE);
}

test("resolve: clue refs are 1-based Watson reads under audio/detective", () => {
  assert.deepEqual(resolve({ kind: "clue", clueIndex: 1 }), {
    url: "/audio/detective/case-387/clue-1.mp3",
    who: "watson",
  });
  assert.deepEqual(resolve({ kind: "clue", clueIndex: 2 }), {
    url: "/audio/detective/case-387/clue-2.mp3",
    who: "watson",
  });
});

test("resolve: fixed, answer, name (geonames: prefix stripped), debrief", () => {
  assert.deepEqual(resolve({ kind: "fixed", id: "ack-1" }), {
    url: "/audio/detective/fixed/ack-1.mp3",
    who: "holmes",
  });
  assert.deepEqual(resolve({ kind: "answer" }), {
    url: "/audio/detective/case-387/answer.mp3",
    who: "holmes",
  });
  assert.deepEqual(resolve({ kind: "name", placeId: "geonames:323786" }), {
    url: "/audio/detective/names/323786.mp3",
    who: "holmes",
  });
  assert.deepEqual(resolve({ kind: "name", placeId: "323786" }), {
    url: "/audio/detective/names/323786.mp3",
    who: "holmes",
  });
  assert.deepEqual(resolve({ kind: "debrief" }), {
    url: "/audio/detective/fixed/debrief-frame.mp3",
    who: "holmes",
  });
});

test("resolve: entry presence is coverage — missing entries resolve null", () => {
  assert.equal(resolve({ kind: "clue", clueIndex: 3 }), null); // null slot
  assert.equal(resolve({ kind: "clue", clueIndex: 1 }, 0), null); // unknown case
  assert.equal(resolve({ kind: "fixed", id: "ask-next" }), null); // not rendered
  assert.equal(resolve({ kind: "name", placeId: "geonames:1" }), null);
  assert.equal(resolveDetectiveClip(null, { kind: "fixed", id: "ack-1" }, 387, BASE), null);
});

/* ------------------------------------------------------------------ */
/* Queue behaviour, via the injected play function                     */
/* ------------------------------------------------------------------ */

const tick = () => new Promise((r) => setTimeout(r, 5));

function harness(overrides: {
  playClip?: (clip: { url: string; who: DetectiveSpeaker }) => Promise<void>;
  isSoundOn?: () => boolean;
  canAutoPlay?: () => boolean;
} = {}) {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const player = createDetectiveSpeech({
    caseIndex: 387,
    loadManifest: async () => MANIFEST,
    playClip:
      overrides.playClip ??
      (async (clip) => {
        played.push(clip.url);
      }),
    isSoundOn: overrides.isSoundOn ?? (() => true),
    canAutoPlay: overrides.canAutoPlay ?? (() => true),
    onSpeakingChange: (who) => speaking.push(who),
  });
  return { player, played, speaking };
}

test("queue: refs play strictly in enqueue order; speaking tracks each voice, then drains null", async () => {
  const { player, played, speaking } = harness();
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  player.enqueue({ kind: "name", placeId: "geonames:323786" });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
    "/audio/detective/names/323786.mp3",
    "/audio/detective/fixed/suspicion.mp3",
  ]);
  assert.deepEqual(speaking, ["watson", "holmes", "holmes", "holmes", null]);
  player.dispose();
});

test("queue: a rejecting clip is skipped — the queue never stalls", async () => {
  const played: string[] = [];
  const { player, speaking } = harness({
    playClip: async (clip) => {
      if (clip.url.includes("ack-1")) throw new Error("codec boom");
      played.push(clip.url);
    },
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/suspicion.mp3",
  ]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});

test("queue: uncovered refs skip silently and the drain still fires", async () => {
  const { player, played, speaking } = harness();
  player.enqueue({ kind: "fixed", id: "ask-next" }); // not in manifest
  player.enqueue({ kind: "clue", clueIndex: 2 });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-2.mp3"]);
  assert.deepEqual(speaking, ["watson", null]);
  player.dispose();
});

test("queue: sound off at play time drops items (no plays) but still drains", async () => {
  const { player, played, speaking } = harness({ isSoundOn: () => false });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, []);
  assert.deepEqual(speaking, [null]); // drain only — ladder advances muted
  player.dispose();
});

test("queue: read-aloud veto (canAutoPlay false) drops items and drains", async () => {
  const { player, played, speaking } = harness({ canAutoPlay: () => false });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, []);
  assert.deepEqual(speaking, [null]);
  player.dispose();
});

test("queue: manifest load failure degrades to silent coverage", async () => {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const player = createDetectiveSpeech({
    caseIndex: 387,
    loadManifest: async () => null,
    playClip: async (clip) => {
      played.push(clip.url);
    },
    isSoundOn: () => true,
    canAutoPlay: () => true,
    onSpeakingChange: (who) => speaking.push(who),
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, []);
  assert.deepEqual(speaking, [null]);
  player.dispose();
});

test("stopAll: clears the pending queue; later items never play", async () => {
  const played: string[] = [];
  let releaseFirst: (() => void) | null = null;
  const { player, speaking } = harness({
    playClip: (clip) => {
      played.push(clip.url);
      if (played.length === 1) {
        return new Promise<void>((r) => {
          releaseFirst = r;
        });
      }
      return Promise.resolve();
    },
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  player.stopAll();
  releaseFirst!();
  await tick();
  // The two queued items were dropped by stopAll, not played late.
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});

test("setCaseIndex rebinds clue/answer resolution", async () => {
  const { player, played } = harness();
  player.setCaseIndex(0); // case 0 has no manifest entry
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, []);
  player.setCaseIndex(387);
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  player.dispose();
});

/* ------------------------------------------------------------------ */
/* U7 — uncovered pick at player level + the real manifest's shape     */
/* ------------------------------------------------------------------ */

test("U7 queue: an uncovered name plays suspicion only — no stall, no error, one drain", async () => {
  const { player, played, speaking } = harness();
  // geonames:424242 has NO entry in the manifest — the name goes silent
  // and the queue moves straight to the suspicion line.
  player.enqueue({ kind: "name", placeId: "geonames:424242" });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  await tick();
  assert.deepEqual(played, ["/audio/detective/fixed/suspicion.mp3"]);
  assert.equal(speaking[speaking.length - 1], null); // drained exactly once at the end
  player.dispose();
});

test("U7 manifest (real, on disk): exactly ONE suspicion asset; names present 1,460 of 1,548 planned", async () => {
  const { readFileSync } = await import("node:fs");
  const url = new URL(
    "../../../../public/audio/detective/manifest.json",
    import.meta.url,
  );
  const real = JSON.parse(readFileSync(url, "utf8")) as DetectiveManifest;
  // One suspicion line in the whole fixed table — a second entry would
  // be a second voice for the same beat, and a leak surface.
  const suspicionKeys = Object.keys(real.fixed).filter((k) =>
    k.includes("suspicion"),
  );
  assert.deepEqual(suspicionKeys, ["suspicion"]);
  assert.equal(real.fixed["suspicion"]!.file, "fixed/suspicion.mp3");
  // Coverage reality (BRANCH_STATUS, U7): 1,460 name reads rendered of
  // the 1,548 planned (88 backend-refused) — the missing 88 fall back to
  // suspicion-only by design (entry presence is the rule).
  assert.equal(Object.keys(real.names).length, 1460);
  // A covered pick resolves; an uncovered one resolves null (silent).
  assert.deepEqual(
    resolveDetectiveClip(real, { kind: "name", placeId: "geonames:5506956" }, 137, BASE),
    { url: "/audio/detective/names/5506956.mp3", who: "holmes" },
  );
  assert.equal(
    resolveDetectiveClip(real, { kind: "name", placeId: "geonames:424242" }, 137, BASE),
    null,
  );
  assert.deepEqual(
    resolveDetectiveClip(real, { kind: "fixed", id: "suspicion" }, 137, BASE),
    { url: "/audio/detective/fixed/suspicion.mp3", who: "holmes" },
  );
});

test("U8 debrief at player level: a missing answer-name entry (the Tallinn case) leaves frame → close, coherent", async () => {
  const { player, played, speaking } = harness();
  // The machine's DEBRIEF sequence for an answer whose placeId has NO
  // names entry in the manifest: the name ref resolves null and is
  // skipped silently — frame and close still play, in order, and the
  // queue drains (the ladder never stalls on a debrief).
  player.enqueue({ kind: "fixed", id: "debrief-frame" });
  player.enqueue({ kind: "name", placeId: "geonames:588409" }); // absent from this manifest
  player.enqueue({ kind: "fixed", id: "debrief-close" });
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/fixed/debrief-frame.mp3",
    "/audio/detective/fixed/debrief-close.mp3",
  ]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});

/* ------------------------------------------------------------------ */
/* U9 — speech modes: tap-mode hold + replay, off mode                 */
/* ------------------------------------------------------------------ */

function modeHarness(
  mode: "auto" | "tap" | "off",
  overrides: {
    isSoundOn?: () => boolean;
    canAutoPlay?: () => boolean;
  } = {},
) {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const player = createDetectiveSpeech({
    caseIndex: 387,
    speechMode: mode,
    loadManifest: async () => MANIFEST,
    playClip: async (clip) => {
      played.push(clip.url);
    },
    isSoundOn: overrides.isSoundOn ?? (() => true),
    canAutoPlay: overrides.canAutoPlay ?? (() => true),
    onSpeakingChange: (who) => speaking.push(who),
  });
  return { player, played, speaking };
}

test("U9 tap mode: clue chain resolves skipped (drains) but is held — read + ack, in order", async () => {
  const { player, played, speaking } = modeHarness("tap");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, []); // nothing auto-plays
  assert.deepEqual(speaking, [null]); // drain still fires — ladder advances silently
  assert.deepEqual(player.heldRefs(), [
    { kind: "clue", clueIndex: 1 },
    { kind: "fixed", id: "ack-1" },
  ]);
  player.dispose();
});

test("U9 tap mode: selection / ask-next / instruction refs are NOT held", async () => {
  const { player } = modeHarness("tap");
  player.enqueue({ kind: "clue", clueIndex: 2 });
  player.enqueue({ kind: "name", placeId: "geonames:323786" });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  player.enqueue({ kind: "fixed", id: "ask-next" });
  player.enqueue({ kind: "fixed", id: "instructions-holmes" });
  await tick();
  assert.deepEqual(player.heldRefs(), [{ kind: "clue", clueIndex: 2 }]);
  player.dispose();
});

test("U9 tap mode: a new clue replaces the held chain", async () => {
  const { player } = modeHarness("tap");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  player.enqueue({ kind: "clue", clueIndex: 2 });
  await tick();
  assert.deepEqual(player.heldRefs(), [{ kind: "clue", clueIndex: 2 }]);
  player.dispose();
});

test("U9 playHeldSequence: plays the held chain for real, in order, then drains", async () => {
  const { player, played, speaking } = modeHarness("tap");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, []);
  await player.playHeldSequence();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});

test("U9 playHeldSequence: the autoplay veto does NOT block a tap, the sound gate DOES", async () => {
  // canAutoPlay false (pref "never") — a tap still plays.
  const vetoed = modeHarness("tap", { canAutoPlay: () => false });
  vetoed.player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  await vetoed.player.playHeldSequence();
  assert.deepEqual(vetoed.played, ["/audio/detective/case-387/clue-1.mp3"]);
  vetoed.player.dispose();
  // Sound off at play time — silence.
  let sound = true;
  const muted = modeHarness("tap", { isSoundOn: () => sound });
  muted.player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  sound = false;
  await muted.player.playHeldSequence();
  assert.deepEqual(muted.played, []);
  muted.player.dispose();
});

test("U9 off mode: items resolve skipped, nothing is held, replay is a no-op", async () => {
  const { player, played, speaking } = modeHarness("off");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, []);
  assert.deepEqual(speaking, [null]); // drain — the ladder never stalls
  assert.deepEqual(player.heldRefs(), []);
  await player.playHeldSequence();
  assert.deepEqual(played, []);
  player.dispose();
});

test("U9 setSpeechMode: leaving tap for off drops the hold (Unit A: auto retains — see below)", async () => {
  const { player, played } = modeHarness("tap");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.equal(player.heldRefs().length, 1);
  player.setSpeechMode("off");
  assert.deepEqual(player.heldRefs(), []);
  assert.equal(player.getSpeechMode(), "off");
  player.setSpeechMode("auto");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]); // auto behaviour restored
  // Unit A supersedes this test's title claim: auto mode DOES retain
  // the chain now (the assertion below was [] before Unit A) — the
  // mode-switch behaviour this test was written for (off drops the
  // hold, auto plays again) is unchanged.
  assert.deepEqual(player.heldRefs(), [{ kind: "clue", clueIndex: 1 }]);
  player.dispose();
});

/* ------------------------------------------------------------------ */
/* Unit A — tap-Watson replay: retention + replay in auto mode         */
/* ------------------------------------------------------------------ */

test("Unit A auto mode: the clue chain is retained while it plays", async () => {
  const { player, played } = modeHarness("auto");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  assert.deepEqual(player.heldRefs(), [
    { kind: "clue", clueIndex: 1 },
    { kind: "fixed", id: "ack-1" },
  ]);
  player.dispose();
});

test("Unit A auto mode: replay after the chain drained plays it again, in order", async () => {
  const { player, played, speaking } = modeHarness("auto");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  await player.playHeldSequence();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});

test("Unit A auto mode: an autoplay-vetoed chain is still retained, and a tap replays it", async () => {
  const { player, played } = modeHarness("auto", { canAutoPlay: () => false });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, []); // the veto still drops auto playback
  assert.deepEqual(player.heldRefs(), [
    { kind: "clue", clueIndex: 1 },
    { kind: "fixed", id: "ack-1" },
  ]);
  await player.playHeldSequence(); // a tap is explicit — the veto does not govern it
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  player.dispose();
});

test("Unit A auto mode: replay mid-play restarts the held sequence from item 1", async () => {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  let calls = 0;
  let releaseFirst: (() => void) | null = null;
  const player = createDetectiveSpeech({
    caseIndex: 387,
    speechMode: "auto",
    loadManifest: async () => MANIFEST,
    playClip: (clip) => {
      calls += 1;
      played.push(clip.url);
      if (calls === 1) {
        return new Promise<void>((r) => {
          releaseFirst = r;
        });
      }
      return Promise.resolve();
    },
    isSoundOn: () => true,
    canAutoPlay: () => true,
    onSpeakingChange: (who) => speaking.push(who),
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  // The first clip is in flight; the FULL chain is already held
  // (retention is at enqueue time, not play time).
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  assert.deepEqual(player.heldRefs(), [
    { kind: "clue", clueIndex: 1 },
    { kind: "fixed", id: "ack-1" },
  ]);
  const replay = player.playHeldSequence();
  await tick();
  // Restarted from item 1: clue again, then the ack — the interrupted
  // queue's pending ack never plays a second time.
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  releaseFirst!();
  await replay;
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  // Exactly one drain, from the replay — the interrupted queue's drain
  // is suppressed, so the ladder advances once, not twice.
  assert.deepEqual(speaking, ["watson", "watson", "holmes", null]);
  player.dispose();
});

test("Unit A: a second replay tap during a replay restarts it from item 1", async () => {
  const played: string[] = [];
  let calls = 0;
  let releaseFirst: (() => void) | null = null;
  const player = createDetectiveSpeech({
    caseIndex: 387,
    speechMode: "tap",
    loadManifest: async () => MANIFEST,
    playClip: (clip) => {
      calls += 1;
      played.push(clip.url);
      if (calls === 1) {
        return new Promise<void>((r) => {
          releaseFirst = r;
        });
      }
      return Promise.resolve();
    },
    isSoundOn: () => true,
    canAutoPlay: () => true,
    onSpeakingChange: () => {},
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  const first = player.playHeldSequence();
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]); // first replay in flight
  const second = player.playHeldSequence();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  releaseFirst!();
  await Promise.all([first, second]);
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/fixed/ack-1.mp3",
  ]);
  player.dispose();
});

test("Unit A setSpeechMode: auto ↔ tap keeps the hold; entering off drops it", async () => {
  const { player } = modeHarness("auto");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.equal(player.heldRefs().length, 1);
  player.setSpeechMode("tap");
  assert.equal(player.heldRefs().length, 1);
  player.setSpeechMode("auto");
  assert.equal(player.heldRefs().length, 1);
  player.setSpeechMode("off");
  assert.deepEqual(player.heldRefs(), []);
  player.dispose();
});

test("Unit A auto mode: sound off at replay time still drops the replay", async () => {
  let sound = true;
  const { player, played } = modeHarness("auto", { isSoundOn: () => sound });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  sound = false;
  await player.playHeldSequence();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]); // unchanged — silence
  player.dispose();
});

/* ------------------------------------------------------------------ */
/* Gesture-wait resurrection (cure, panel round 1): the DEFAULT clip  */
/* player parks in waitForGesture() before its Audio element exists. */
/* The cure registers the stop handle BEFORE the wait, so a stopAll  */
/* in that window (a mute, a case change) settles the parked clip    */
/* exactly like a playing one, and the sound gate is re-checked at   */
/* wake. These tests drive the real default player with a stubbed    */
/* window/Audio.                                                      */
/* ------------------------------------------------------------------ */

function stubBrowserAudio(playedUrls: string[]): () => void {
  const listeners = new Map<string, () => void>();
  class FakeAudio {
    private handlers = new Map<string, () => void>();
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    addEventListener(type: string, fn: () => void) {
      this.handlers.set(type, fn);
    }
    play() {
      playedUrls.push(this.url);
      // Finish on the next microtask, like a very short clip.
      queueMicrotask(() => this.handlers.get("ended")?.());
      return Promise.resolve();
    }
    pause() {}
  }
  const g = globalThis as Record<string, unknown>;
  g.window = {
    addEventListener: (type: string, fn: () => void) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type: string) => {
      listeners.delete(type);
    },
  };
  g.Audio = FakeAudio;
  return () => {
    // Fire the parked first-gesture listener, if one is armed.
    listeners.get("pointerdown")?.();
  };
}

function unplugBrowserAudio(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.Audio;
}

test("gesture wait: a stopAll during the wait keeps the parked clip silent when the gesture lands", async () => {
  const playedUrls: string[] = [];
  const fireGesture = stubBrowserAudio(playedUrls);
  try {
    const player = createDetectiveSpeech({
      caseIndex: 387,
      loadManifest: async () => MANIFEST,
      isSoundOn: () => true,
      canAutoPlay: () => true,
    });
    player.enqueue({ kind: "clue", clueIndex: 1 });
    await tick();
    await tick();
    // The clip is parked in waitForGesture (no Audio exists yet).
    assert.deepEqual(playedUrls, []);
    // The mute path: stopAll lands while the clip is parked — then
    // the gesture lands with sound reading on again (the keyboard
    // mute/unmute cycle from the panel). The parked clip must stay
    // silent: stopAll settled it through the pre-registered stopper.
    player.stopAll();
    fireGesture();
    await tick();
    await tick();
    assert.deepEqual(playedUrls, []);
    player.dispose();
  } finally {
    unplugBrowserAudio();
  }
});

test("gesture wait: with no stop, the parked clip plays when the gesture lands", async () => {
  const playedUrls: string[] = [];
  const fireGesture = stubBrowserAudio(playedUrls);
  try {
    const player = createDetectiveSpeech({
      caseIndex: 387,
      loadManifest: async () => MANIFEST,
      isSoundOn: () => true,
      canAutoPlay: () => true,
    });
    player.enqueue({ kind: "clue", clueIndex: 1 });
    await tick();
    await tick();
    assert.deepEqual(playedUrls, []);
    fireGesture();
    await tick();
    await tick();
    assert.deepEqual(playedUrls, ["/audio/detective/case-387/clue-1.mp3"]);
    player.dispose();
  } finally {
    unplugBrowserAudio();
  }
});

test("gesture wait: a sound gate closed at wake (no stopAll) keeps the parked clip silent", async () => {
  const playedUrls: string[] = [];
  const fireGesture = stubBrowserAudio(playedUrls);
  let soundOn = true;
  try {
    const player = createDetectiveSpeech({
      caseIndex: 387,
      loadManifest: async () => MANIFEST,
      isSoundOn: () => soundOn,
      canAutoPlay: () => true,
    });
    player.enqueue({ kind: "clue", clueIndex: 1 });
    await tick();
    await tick();
    assert.deepEqual(playedUrls, []);
    // The gate closes while parked, without a stopAll reaching the
    // player — the wake-time gate re-check must still hold the clip.
    soundOn = false;
    fireGesture();
    await tick();
    await tick();
    assert.deepEqual(playedUrls, []);
    player.dispose();
  } finally {
    unplugBrowserAudio();
  }
});
