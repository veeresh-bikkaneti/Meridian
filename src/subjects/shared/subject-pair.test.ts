/**
 * Holmes and Watson in the subject cases (Stream E) — props, clip map,
 * manifest membership, and one voice at a time. Plain Node test runner;
 * imports only the pure module and the voice channel.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAIR_OWNER,
  SUBJECT_PAIR_CLIPS,
  SUBJECT_PAIR_PROP_KEYS,
  buildSubjectPairProps,
  pairClipRequest,
  startPairClip,
  type PairAudio,
  type PairSpeaker,
} from "./subject-pair.ts";
import { claimVoice, currentVoiceOwner, stopAllVoices } from "../../game/audio/voice-channel.ts";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/audio/detective/manifest.json", import.meta.url), "utf8"),
) as { fixed: Record<string, { text: string; file: string }> };

it("props: exactly state and nonce; item, answer and evaluation are dropped", () => {
  assert.deepEqual([...SUBJECT_PAIR_PROP_KEYS], ["state", "nonce"]);
  const leaky = {
    state: "correct",
    nonce: 3,
    item: { id: "technology:eniac" },
    answer: { correct: "1,500" },
    evaluation: "right",
  } as unknown as { state: "correct"; nonce: number };
  const props = buildSubjectPairProps(leaky);
  assert.deepEqual(Object.keys(props).sort(), ["nonce", "state"]);
});

it("each state maps to its clip and speaker", () => {
  assert.deepEqual(pairClipRequest({ state: "open", nonce: 1 }), {
    fixedId: "lets-find-clues",
    speaker: "watson",
    userInitiated: false,
  });
  assert.deepEqual(pairClipRequest({ state: "correct", nonce: 2 }), {
    fixedId: "win-holmes",
    speaker: "holmes",
    userInitiated: true,
  });
  assert.deepEqual(pairClipRequest({ state: "wrong", nonce: 3 }), {
    fixedId: "ack-3",
    speaker: "holmes",
    userInitiated: true,
  });
});

it("every clip id used exists in the manifest's fixed set, and none names the map or places", () => {
  for (const clip of Object.values(SUBJECT_PAIR_CLIPS)) {
    const entry = manifest.fixed[clip.fixedId];
    assert.ok(entry, `${clip.fixedId} is not in manifest.fixed`);
    assert.doesNotMatch(entry.text, /map|guess|distance|direction|place|star|kilomet|mile/i);
  }
});

it("one voice: a pick while the case-open line plays stops that line first", () => {
  stopAllVoices();
  const audios: { url: string; playing: boolean; paused: number }[] = [];
  const speaking: (PairSpeaker | null)[] = [];
  const makeAudio = (url: string): PairAudio => {
    const rec = { url, playing: false, paused: 0 };
    audios.push(rec);
    let done: (() => void) | undefined;
    return {
      play: async () => {
        rec.playing = true;
      },
      pause: () => {
        rec.playing = false;
        rec.paused += 1;
      },
      onFinished: (fn) => {
        done = fn;
        void done;
      },
    };
  };
  const deps = (url: string) => ({
    url,
    makeAudio,
    claim: claimVoice,
    onSpeaking: (who: PairSpeaker | null) => speaking.push(who),
  });

  const stopOpen = startPairClip(pairClipRequest({ state: "open", nonce: 1 }), deps("open.mp3"));
  assert.equal(currentVoiceOwner(), PAIR_OWNER);
  const playingNow = () => audios.filter((a) => a.playing).length;
  assert.equal(playingNow(), 1);

  // A pick is the kid's own tap: it takes the channel from the open line.
  const stopWin = startPairClip(pairClipRequest({ state: "correct", nonce: 2 }), deps("win.mp3"));
  assert.equal(audios[0].paused >= 1, true, "the open line was stopped");
  assert.equal(audios[0].playing, false);
  assert.equal(audios[1].playing, true);
  assert.equal(playingNow(), 1, "never two voices at once");
  assert.deepEqual(speaking, ["watson", null, "holmes"]);

  stopOpen();
  stopWin();
  assert.equal(currentVoiceOwner(), null);
});

it("autoplay waits its turn: a case-open line while another voice speaks is dropped", () => {
  stopAllVoices();
  const other = claimVoice("storyteller", () => {}, { userInitiated: false });
  assert.ok(other);
  let made = 0;
  const stop = startPairClip(pairClipRequest({ state: "open", nonce: 1 }), {
    url: "open.mp3",
    makeAudio: () => {
      made += 1;
      return {
        play: async () => {},
        pause: () => {},
        onFinished: () => {},
      };
    },
    claim: claimVoice,
    onSpeaking: () => {},
  });
  assert.equal(currentVoiceOwner(), "storyteller", "the storyteller keeps the channel");
  assert.equal(typeof stop, "function");
  other?.release();
  stopAllVoices();
  assert.equal(made, 1, "the audio element is created, but no claim was won");
});
