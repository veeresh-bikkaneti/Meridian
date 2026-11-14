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
  private listeners = new Map<string, Array<() => void>>();
  readonly url: string;
  private readonly world: FakeAudio[];
  constructor(url: string, world: FakeAudio[]) {
    this.url = url;
    this.world = world;
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
    this.world.push(this);
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
  const started: FakeAudio[] = [];
  let maxSounding = 0;
  const voice = createSubjectPairVoice({
    loadManifest: async () => MANIFEST,
    gateOpen: () => true,
    createAudio: (url) => {
      const a = new FakeAudio(url, started);
      created.push(a);
      const play = a.play.bind(a);
      a.play = () => {
        const r = play();
        maxSounding = Math.max(maxSounding, created.filter((x) => x.playing).length);
        return r;
      };
      return a;
    },
  });
  return { voice, created, max: () => maxSounding };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => stopAllVoices());

test("one voice: the win line while the case-open line is still speaking stops the first one", async () => {
  const { voice, created, max } = rig();
  const speakers: Array<string | null> = [];
  const onSpeaking = (w: string | null) => speakers.push(w);

  const open = voice.say(lineForState("open")!, { userInitiated: false }, onSpeaking);
  await flush();
  assert.equal(created.length, 1);
  const watson = created[0]!;
  assert.ok(watson.url.endsWith("fixed/lets-find-clues.mp3"));
  assert.ok(watson.playing);
  assert.equal(currentVoiceOwner(), SUBJECT_PAIR_VOICE_OWNER);

  // The player's correct pick, while Watson is still mid-line.
  const win = voice.say(lineForState("correct")!, { userInitiated: true }, onSpeaking);
  await flush();
  assert.equal(created.length, 2);
  const holmes = created[1]!;
  assert.ok(holmes.url.endsWith("fixed/win-holmes.mp3"));
  assert.equal(watson.playing, false, "the channel stopped Watson's line");
  assert.equal(watson.pauses, 1);
  assert.ok(holmes.playing);
  await open; // the stopped line settled
  assert.equal(created.filter((a) => a.playing).length, 1);
  assert.equal(max(), 1, "never two voices at once");
  // Watson stopped before Holmes started; Holmes is the speaker now.
  assert.deepEqual(speakers, ["watson", null, "holmes"]);

  holmes.end();
  await win;
  assert.equal(currentVoiceOwner(), null, "channel released at the end");
  assert.deepEqual(speakers, ["watson", null, "holmes", null]);
});

test("one voice: the automatic case-open line waits its turn (silent while another voice speaks)", async () => {
  const { voice, created } = rig();
  let otherStopped = false;
  const other = claimVoice("storyteller", () => (otherStopped = true), { userInitiated: true });
  assert.ok(other);
  await voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  assert.equal(created.length, 0, "no audio created");
  assert.equal(otherStopped, false, "the storyteller was not cut off");
  assert.equal(currentVoiceOwner(), "storyteller");
  other!.release();
});

test("one voice: the win line takes the channel from another app voice", async () => {
  const { voice, created } = rig();
  let otherStopped = false;
  claimVoice("storyteller", () => (otherStopped = true), { userInitiated: true });
  const win = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  await flush();
  assert.equal(otherStopped, true);
  assert.equal(currentVoiceOwner(), SUBJECT_PAIR_VOICE_OWNER);
  created[0]!.end();
  await win;
});

test("one voice: another voice taking the channel stops the pair", async () => {
  const { voice, created } = rig();
  const open = voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  await flush();
  claimVoice("read-aloud", () => {}, { userInitiated: true });
  assert.equal(created[0]!.playing, false);
  await open;
  stopAllVoices();
});

test("sound off (stopAllVoices) stops the line; dispose stops it and blocks later lines", async () => {
  const { voice, created } = rig();
  const open = voice.say(lineForState("open")!, { userInitiated: false }, () => {});
  await flush();
  stopAllVoices();
  assert.equal(created[0]!.playing, false);
  await open;

  const win = voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  await flush();
  voice.dispose();
  assert.equal(created[1]!.playing, false);
  await win;
  assert.equal(currentVoiceOwner(), null);
  await voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.equal(created.length, 2, "nothing plays after dispose");
});

test("gate closed: silent, channel untouched", async () => {
  const created: unknown[] = [];
  const voice = createSubjectPairVoice({
    loadManifest: async () => MANIFEST,
    gateOpen: () => false,
    createAudio: (url) => {
      created.push(url);
      return new FakeAudio(url, []);
    },
  });
  await voice.say(lineForState("correct")!, { userInitiated: true }, () => {});
  assert.equal(created.length, 0);
  assert.equal(currentVoiceOwner(), null);
});
