import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { claimVoice, currentVoiceOwner, stopAllVoices } from "../../game/audio/voice-channel.ts";
import type { DetectiveManifest } from "../../game/loop/detective/detective-audio.ts";
import { lineForState } from "./subject-pair.ts";
import { createSubjectPairVoice, SUBJECT_PAIR_VOICE_OWNER } from "./subject-pair-voice.ts";

/**
 * One voice at a time (owner: "if one speak the other needs to shut
 * up"): the pair's lines go through the shared voice channel. Fake
 * audio elements record who is sounding at every moment.
 *
 * The tap path (userInitiated) must call play() before any await, so
 * a pick still plays on iOS after the case-open preload.
 */

const MANIFEST: DetectiveManifest = {
  v: 1,
  voices: { holmes: "h", watson: "w" },
  fixed: {
    "lets-find-clues": { file: "fixed/lets-find-clues.mp3", voice: "w" },
    "win-holmes": { file: "fixed/win-holmes.mp3", voice: "h" },
  },
  cases: {},
  names: {},
};

class FakeAudio {
  playing = false;
  pauses = 0;
  src: string;
  private listeners = new Map<string, Array<() => void>>();
  constructor(url: string) {
    this.src = url;
  }
  get url(): string {
    return this.src;
  }
  addEventListener(type: string, fn: () => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  private emit(type: string) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.delete(type);
    for (const fn of list) fn();
  }
  play() {
    this.playing = true;
    return Promise.resolve();
  }
  pause() {
    this.pauses += 1;
    if (!this.playing) return;
    this.playing = false;
    this.emit("pause");
  }
  end() {
    this.playing = false;
    this.emit("ended");
  }
}

function rig() {
  const created: FakeAudio[] = [];
  const playLog: string[] = [];
  let sounding = 0;
  let maxSounding = 0;
  const voice = createSubjectPairVoice({
    loadManifest: async () => MANIFEST,
    gateOpen: () => true,
    createAudio: (url) => {
      const a = new FakeAudio(url);
      created.push(a);
      const play = a.play.bind(a);
      a.play = () => {
        const r = play();
        playLog.push(a.src || a.url || "");
        if (a.playing) {
          sounding = 1;
          maxSounding = Math.max(maxSounding, sounding);
        }
        return r;
      };
      const pause = a.pause.bind(a);
      a.pause = () => {
        pause();
        if (!a.playing) sounding = 0;
      };
      return a;
    },
  });
  return { voice, created, playLog, max: () => maxSounding };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => stopAllVoices());

test("one voice: the win line while the case-open line is still speaking stops the first one", async () => {
  const { voice, created, playLog, max } = rig();
  await voice.preload();
  assert.equal(created.length, 1, "the audio element is primed when the case opens");
  const primed = created[0]!;
  const speakers: Array<string | null> = [];
  const onSpeaking = (w: string | null) => speakers.push(w);

  const open = voice.say(lineForState("open")!, { userInitiated: false }, onSpeaking);
  assert.equal(created.length, 2, "the automatic line gets a fresh element");
  const watson = created[1]!;
  assert.ok(watson.url.endsWith("fixed/lets-find-clues.mp3"));
  assert.ok(watson.playing);
  assert.equal(currentVoiceOwner(), SUBJECT_PAIR_VOICE_OWNER);

  // The player's correct pick, while Watson is still mid-line.
  const win = voice.say(lineForState("correct")!, { userInitiated: true }, onSpeaking);
  assert.equal(created.length, 2, "the tap reuses the primed element");
  assert.ok(primed.url.endsWith("fixed/win-holmes.mp3"));
  assert.equal(watson.playing, false, "the channel stopped Watson's line");
  assert.ok(watson.pauses >= 1);
  assert.ok(primed.playing);
  await open; // the stopped line settled
  assert.equal(max(), 1, "never two voices at once");
  assert.ok(speakers[0] === "watson");
  assert.equal(speakers.at(-1), "holmes");

  primed.end();
  await win;
  assert.equal(currentVoiceOwner(), null, "channel released at the end");
  assert.equal(speakers.at(-1), null);
  assert.ok(playLog.some((u) => u.endsWith("lets-find-clues.mp3")));
  assert.ok(playLog.some((u) => u.endsWith("win-holmes.mp3")));
});

test("one voice: the automatic case-open line waits its turn (silent while another voice speaks)", async () => {
  const { voice, created, playLog } = rig();
  await voice.preload();
  let otherStopped = false;
  const other = claimVoice("storyteller", () => (otherStopped = true), { userInitiated: true });
  assert.ok(other);
  await voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  assert.equal(
    playLog.filter((u) => u.endsWith("lets-find-clues.mp3")).length,
    0,
    "no line played",
  );
  assert.equal(otherStopped, false, "the storyteller was not cut off");
  assert.equal(currentVoiceOwner(), "storyteller");
  other!.release();
  assert.equal(created.length, 1);
});

test("one voice: the win line takes the channel from another app voice", async () => {
  const { voice, created } = rig();
  await voice.preload();
  let otherStopped = false;
  claimVoice("storyteller", () => (otherStopped = true), { userInitiated: true });
  const win = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.equal(otherStopped, true);
  assert.equal(currentVoiceOwner(), SUBJECT_PAIR_VOICE_OWNER);
  created[0]!.end();
  await win;
});

test("one voice: another voice taking the channel stops the pair", async () => {
  const { voice, created } = rig();
  await voice.preload();
  const open = voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  const watson = created[1]!;
  assert.ok(watson.playing);
  claimVoice("read-aloud", () => {}, { userInitiated: true });
  assert.equal(watson.playing, false);
  await open;
  stopAllVoices();
});

test("sound off (stopAllVoices) stops the line; dispose stops it and blocks later lines", async () => {
  const { voice, created, playLog } = rig();
  await voice.preload();
  const open = voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  const watson = created[1]!;
  assert.ok(watson.playing);
  stopAllVoices();
  assert.equal(watson.playing, false);
  await open;

  const playsBefore = playLog.length;
  const win = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  const primed = created[0]!;
  assert.ok(primed.playing);
  voice.dispose();
  assert.equal(primed.playing, false);
  await win;
  assert.equal(currentVoiceOwner(), null);
  await voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.equal(playLog.length, playsBefore + 1, "nothing plays after dispose");
});

test("gate closed: silent, channel untouched", async () => {
  const playLog: string[] = [];
  const voice = createSubjectPairVoice({
    loadManifest: async () => MANIFEST,
    gateOpen: () => false,
    createAudio: (url) => {
      const a = new FakeAudio(url);
      const play = a.play.bind(a);
      a.play = () => {
        playLog.push(a.src || url);
        return play();
      };
      return a;
    },
  });
  await voice.preload();
  await voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.equal(playLog.length, 0);
  assert.equal(currentVoiceOwner(), null);
});

test("tap path: after preload, play() runs before any await", async () => {
  const events: string[] = [];
  let loadCalls = 0;
  const created: FakeAudio[] = [];
  const voice = createSubjectPairVoice({
    loadManifest: async () => {
      loadCalls += 1;
      events.push("load-await");
      await new Promise((r) => setTimeout(r, 20));
      events.push("load-done");
      return MANIFEST;
    },
    gateOpen: () => true,
    createAudio: (url) => {
      const a = new FakeAudio(url);
      created.push(a);
      const orig = a.play.bind(a);
      a.play = () => {
        events.push(`play:${a.src || a.url || "(empty)"}`);
        return orig();
      };
      return a;
    },
  });
  await voice.preload();
  assert.equal(loadCalls, 1);
  events.length = 0;
  const done = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  const playAt = events.findIndex((e) => e.startsWith("play:"));
  assert.ok(playAt >= 0, "play() ran");
  assert.equal(playAt, 0, "play() ran synchronously, before any await");
  assert.ok(events[0]!.endsWith("win-holmes.mp3"), events[0]);
  assert.ok(!events.includes("load-await"), "tap path does not fetch the manifest again");
  created[0]!.end();
  await done;
});

test("tap path: play() still runs before a late manifest resolves", async () => {
  const events: string[] = [];
  let resolveM!: (m: DetectiveManifest | null) => void;
  const pending = new Promise<DetectiveManifest | null>((r) => {
    resolveM = r;
  });
  const created: FakeAudio[] = [];
  const voice = createSubjectPairVoice({
    loadManifest: () => {
      events.push("load-started");
      return pending.then((m) => {
        events.push("load-done");
        return m;
      });
    },
    gateOpen: () => true,
    createAudio: (url) => {
      const a = new FakeAudio(url);
      created.push(a);
      const orig = a.play.bind(a);
      a.play = () => {
        events.push(`play:${a.src || a.url || "(empty)"}`);
        return orig();
      };
      return a;
    },
  });
  void voice.preload();
  const done = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.ok(
    events.some((e) => e.startsWith("play:")),
    `play() ran before the manifest fetch resolved: ${events.join(",")}`,
  );
  assert.ok(!events.includes("load-done"), "play() was not after the await");
  resolveM(MANIFEST);
  await flush();
  assert.ok(
    events.some((e) => e.endsWith("win-holmes.mp3")),
    `real clip played after the manifest arrived: ${events.join(",")}`,
  );
  created[0]!.end();
  await done;
});
