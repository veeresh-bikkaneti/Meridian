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
