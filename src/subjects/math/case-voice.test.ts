/**
 * The ONE-VOICE test for the math case (owner-named deliverable).
 *
 * Proves, against the REAL voice channel (src/game/audio/
 * voice-channel.ts), the REAL detective speech player
 * (createDetectiveSpeech, via createMathCaseVoice) and the REAL
 * manifest's fixed pool (ids read from public/audio/detective/
 * manifest.json on disk — a fake manifest carrying only those real
 * entries is injected through the player's own seams):
 * (a) the event → clip mapping, and that it is answer-blind;
 * (b) channel arbitration both ways, and that two case lines never
 *     sound at once;
 * (c) the clip ids requested are exactly the real manifest ids.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import {
  claimVoice,
  currentVoiceOwner,
  stopAllVoices,
} from "../../game/audio/voice-channel.ts";
import { claimStorytellerVoice } from "../../components/storyteller-voice.ts";
import type {
  DetectiveManifest,
  DetectiveSpeaker,
  ResolvedClip,
} from "../../game/loop/detective/detective-audio.ts";
import {
  createMathCaseVoice,
  posesForMathCase,
  refsForMathCaseEvent,
  type MathCaseVoice,
} from "./case-voice.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

afterEach(() => stopAllVoices());

/* The real manifest, on disk: the source of every id used below. */
const real = JSON.parse(
  readFileSync(
    new URL("../../../public/audio/detective/manifest.json", import.meta.url),
    "utf8",
  ),
) as DetectiveManifest;

const ACK_IDS = Array.from({ length: 10 }, (_, i) => `ack-${i + 1}`);
const USED_IDS = ["lets-find-clues", "win-holmes", "win-watson", ...ACK_IDS];

/** A fake manifest whose fixed table is the REAL manifest's entries
 * for exactly the ids the math mapping can request — nothing invented. */
const FAKE_MANIFEST: DetectiveManifest = {
  v: 1,
  voices: real.voices,
  fixed: Object.fromEntries(USED_IDS.map((id) => [id, real.fixed[id]])),
  cases: {},
  names: {},
};

function instantVoice(
  overrides: { isSoundOn?: () => boolean; canAutoPlay?: () => boolean } = {},
  rng: () => number = Math.random,
) {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const voice = createMathCaseVoice(
    {
      loadManifest: async () => FAKE_MANIFEST,
      playClip: async (clip: ResolvedClip) => {
        played.push(clip.url);
      },
      isSoundOn: overrides.isSoundOn ?? (() => true),
      canAutoPlay: overrides.canAutoPlay ?? (() => true),
      onSpeakingChange: (who) => speaking.push(who),
    },
    rng,
  );
  return { voice, played, speaking };
}

/** A clip player whose clips stay sounding until finished by hand or
 * aborted; records start/stop order in a shared log. */
function hangingVoice(log: string[]) {
  const open = new Set<string>();
  const finishers = new Map<string, () => void>();
  let maxOpen = 0;
  const voice: MathCaseVoice = createMathCaseVoice({
    loadManifest: async () => FAKE_MANIFEST,
    isSoundOn: () => true,
    canAutoPlay: () => true,
    playClip: (clip: ResolvedClip, signal: AbortSignal) =>
      new Promise<void>((resolveClip) => {
        const name = clip.url.split("/").pop()!;
        open.add(name);
        maxOpen = Math.max(maxOpen, open.size);
        log.push(`start ${name}`);
        const end = (why: string) => {
          if (!open.delete(name)) return;
          log.push(`${why} ${name}`);
          resolveClip();
        };
        finishers.set(name, () => end("end"));
        signal.addEventListener("abort", () => end("stop"), { once: true });
      }),
  });
  return {
    voice,
    open,
    maxOpen: () => maxOpen,
    finish: (name: string) => finishers.get(name)?.(),
  };
}

test("one voice: every id the mapping can request exists in the real manifest pool", () => {
  for (const id of USED_IDS) {
    assert.ok(real.fixed[id], `real manifest fixed pool is missing ${id}`);
    assert.equal(real.fixed[id]!.file, `fixed/${id}.mp3`);
  }
  assert.equal(real.fixed["lets-find-clues"]!.voice, real.voices.watson);
  assert.equal(real.fixed["win-holmes"]!.voice, real.voices.holmes);
  assert.equal(real.fixed["win-watson"]!.voice, real.voices.watson);
  for (const id of ACK_IDS) {
    assert.equal(real.fixed[id]!.voice, real.voices.holmes, id);
  }
});

test("one voice: open → lets-find-clues, correct → win-holmes (exact manifest ids)", async () => {
  const openCase = instantVoice();
  openCase.voice.handleEvent("open");
  await tick();
  await tick();
  assert.deepEqual(openCase.played, ["/audio/detective/fixed/lets-find-clues.mp3"]);
  assert.deepEqual(openCase.speaking, ["watson", null]);
  openCase.voice.dispose();

  const correct = instantVoice();
  correct.voice.handleEvent("correct");
  await tick();
  await tick();
  assert.deepEqual(correct.played, ["/audio/detective/fixed/win-holmes.mp3"]);
  assert.deepEqual(correct.speaking, ["holmes", null]);
  correct.voice.dispose();
});

test("one voice: finished → win-watson, enqueued after the final correct's win-holmes", async () => {
  const { voice, played } = instantVoice();
  voice.handleEvent("correct");
  voice.handleEvent("finished");
  await tick();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/fixed/win-holmes.mp3",
    "/audio/detective/fixed/win-watson.mp3",
  ]);
  voice.dispose();
});

test("one voice: wrong → one ack-* from the real pool, drawn without repeats (GeoDetective's drawAckId)", async () => {
  // rng () => 0 always draws the first candidate: ack-1 first, then
  // ack-2 — the pool-minus-played rule means a case never repeats an
  // ack, exactly as detective-state.ts's takeAck behaves.
  const { voice, played } = instantVoice({}, () => 0);
  voice.handleEvent("wrong");
  await tick();
  await tick();
  voice.handleEvent("wrong");
  await tick();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/fixed/ack-1.mp3",
    "/audio/detective/fixed/ack-2.mp3",
  ]);
  for (const url of played) {
    const id = url.split("/").pop()!.replace(".mp3", "");
    assert.ok(ACK_IDS.includes(id), `${id} is not in the real ack pool`);
    assert.ok(real.fixed[id], `${id} is not in the real manifest`);
  }
  voice.dispose();
});

test("one voice: the mapping is answer-blind — its only input is the event name", () => {
  // refsForMathCaseEvent takes (event, playedAcks, rng) and nothing
  // else: no answer value, no item id, no measurement can reach it.
  assert.equal(refsForMathCaseEvent.length, 1); // defaulted params aside, one required input
  for (const event of ["open", "correct", "wrong", "finished"] as const) {
    const { refs } = refsForMathCaseEvent(event, [], () => 0);
    assert.equal(refs.length, 1);
    assert.deepEqual(Object.keys(refs[0]!).sort(), ["id", "kind"]);
    assert.equal(refs[0]!.kind, "fixed");
  }
  assert.deepEqual(refsForMathCaseEvent("open").refs, [{ kind: "fixed", id: "lets-find-clues" }]);
  assert.deepEqual(refsForMathCaseEvent("correct").refs, [{ kind: "fixed", id: "win-holmes" }]);
  assert.deepEqual(refsForMathCaseEvent("finished").refs, [{ kind: "fixed", id: "win-watson" }]);
  assert.deepEqual(refsForMathCaseEvent("wrong", [], () => 0).refs, [{ kind: "fixed", id: "ack-1" }]);
});

test("one voice: pose mapping — resting, correct celebrate, wrong ack, finished both celebrate", () => {
  assert.deepEqual(posesForMathCase(null, null), { holmes: "search", watson: "read" });
  assert.deepEqual(posesForMathCase("open", "watson"), { holmes: "search", watson: "read" });
  assert.deepEqual(posesForMathCase("correct", "holmes"), { holmes: "celebrate-jump", watson: "read" });
  assert.deepEqual(posesForMathCase("wrong", "holmes"), { holmes: "ack", watson: "read" });
  assert.deepEqual(posesForMathCase("finished", "watson"), { holmes: "celebrate-jump", watson: "celebrate-jump" });
  assert.deepEqual(posesForMathCase("correct", null), { holmes: "search", watson: "read" });
});

test("one voice: a case line starting stops the storyteller first and takes the channel", async () => {
  const log: string[] = [];
  const storyteller = claimVoice("storyteller", () => log.push("stop storyteller"), {
    userInitiated: true,
  });
  assert.ok(storyteller);
  assert.equal(currentVoiceOwner(), "storyteller");
  const h = hangingVoice(log);
  h.voice.handleEvent("open");
  await tick();
  await tick();
  // The storyteller's stop ran BEFORE the case clip started, and the
  // channel now belongs to the detective pair.
  assert.deepEqual(log, ["stop storyteller", "start lets-find-clues.mp3"]);
  assert.equal(currentVoiceOwner(), "detective");
  h.voice.dispose();
});

test("one voice: a user-initiated storyteller claim stops the case line that is sounding", async () => {
  const log: string[] = [];
  const h = hangingVoice(log);
  h.voice.handleEvent("open");
  await tick();
  await tick();
  assert.deepEqual([...h.open], ["lets-find-clues.mp3"]);
  assert.equal(currentVoiceOwner(), "detective");
  const claim = claimStorytellerVoice(null, () => {}, { userInitiated: true });
  assert.ok(claim);
  await tick();
  assert.deepEqual(log, ["start lets-find-clues.mp3", "stop lets-find-clues.mp3"]);
  assert.equal(h.open.size, 0, "the case line stopped sounding");
  assert.equal(currentVoiceOwner(), "storyteller");
  claim.release();
  h.voice.dispose();
});

test("one voice: two case lines never sound at once — the second starts only after the first ends", async () => {
  const log: string[] = [];
  const h = hangingVoice(log);
  h.voice.handleEvent("open");
  await tick();
  await tick();
  h.voice.handleEvent("correct");
  await tick();
  await tick();
  // win-holmes is queued, NOT sounding over lets-find-clues.
  assert.deepEqual(log, ["start lets-find-clues.mp3"]);
  h.finish("lets-find-clues.mp3");
  await tick();
  await tick();
  assert.deepEqual(log, [
    "start lets-find-clues.mp3",
    "end lets-find-clues.mp3",
    "start win-holmes.mp3",
  ]);
  assert.equal(h.maxOpen(), 1, "never two clips open at once");
  h.voice.dispose();
});

test("one voice: the sound gate and the read-aloud veto still silence the math lines (auto mode)", async () => {
  const muted = instantVoice({ isSoundOn: () => false });
  muted.voice.handleEvent("open");
  muted.voice.handleEvent("correct");
  await tick();
  await tick();
  assert.deepEqual(muted.played, []);
  muted.voice.dispose();

  const vetoed = instantVoice({ canAutoPlay: () => false });
  vetoed.voice.handleEvent("open");
  vetoed.voice.handleEvent("correct");
  await tick();
  await tick();
  assert.deepEqual(vetoed.played, []);
  vetoed.voice.dispose();
});
