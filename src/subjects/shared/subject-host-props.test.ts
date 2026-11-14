/**
 * Subject pair tests (Stream E spec list):
 * - the prop-builder whitelist (mirrors detective-host-props.test);
 * - the state→clip mapping (open → lets-find-clues, correct →
 *   win-holmes, wrong → NO clip, finished → NO clip);
 * - manifest fixed-set membership (every requestable id exists in
 *   the REAL manifest's fixed table, read from disk);
 * - the ONE-VOICE test: the mapping driven through the REAL speech
 *   player (createDetectiveSpeech) and the REAL voice channel —
 *   arbitration against a storyteller claim both ways, never two
 *   clips at once, and wrong/finished requesting nothing.
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
import {
  createDetectiveSpeech,
  type DetectiveManifest,
  type DetectiveSpeaker,
  type DetectiveSpeechPlayer,
  type ResolvedClip,
} from "../../game/loop/detective/detective-audio.ts";
import {
  SUBJECT_HOST_PROP_KEYS,
  buildSubjectDetectiveHostProps,
  speakRefForSubjectSignal,
  subjectPairPoses,
  subjectSignalsFor,
  type SubjectCaseSignal,
  type SubjectDetectiveHostProps,
} from "./subject-host-props.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));
afterEach(() => stopAllVoices());

const REST: SubjectDetectiveHostProps = { solved: false, wrongPick: false, finished: false };

/* ------------------------------------------------------------------ */
/* Prop builder                                                        */
/* ------------------------------------------------------------------ */

test("prop builder: exactly the whitelisted keys, values pass through", () => {
  const built = buildSubjectDetectiveHostProps({ solved: true, wrongPick: false, finished: true });
  assert.deepEqual(Object.keys(built), [...SUBJECT_HOST_PROP_KEYS]);
  assert.deepEqual(built, { solved: true, wrongPick: false, finished: true });
  // The whitelist is booleans only — no item, answer, choice or band
  // field exists in the shape to smuggle evaluation data through.
  assert.deepEqual([...SUBJECT_HOST_PROP_KEYS], ["solved", "wrongPick", "finished"]);
  for (const value of Object.values(built)) assert.equal(typeof value, "boolean");
});

test("signals: edges only — correct, wrong, and correct+finished on a last-item solve", () => {
  assert.deepEqual(subjectSignalsFor(REST, REST), []);
  assert.deepEqual(subjectSignalsFor(REST, { ...REST, wrongPick: true }), ["wrong"]);
  assert.deepEqual(subjectSignalsFor({ ...REST, wrongPick: true }, REST), []);
  assert.deepEqual(subjectSignalsFor(REST, { ...REST, solved: true }), ["correct"]);
  // A last-item solve carries BOTH signals, correct first: finished
  // requests no clip of its own and never replaces correct's.
  assert.deepEqual(
    subjectSignalsFor(REST, { solved: true, wrongPick: false, finished: true }),
    ["correct", "finished"],
  );
  assert.deepEqual(
    subjectSignalsFor({ solved: true, wrongPick: false, finished: true }, REST),
    [],
  );
});

/* ------------------------------------------------------------------ */
/* State → clip mapping + manifest membership                          */
/* ------------------------------------------------------------------ */

const real = JSON.parse(
  readFileSync(
    new URL("../../../public/audio/detective/manifest.json", import.meta.url),
    "utf8",
  ),
) as DetectiveManifest;

test("state→clip mapping: open → lets-find-clues, correct → win-holmes, wrong → NO clip, finished → NO clip", () => {
  assert.deepEqual(speakRefForSubjectSignal("open"), { kind: "fixed", id: "lets-find-clues" });
  assert.deepEqual(speakRefForSubjectSignal("correct"), { kind: "fixed", id: "win-holmes" });
  assert.equal(speakRefForSubjectSignal("wrong"), null);
  assert.equal(speakRefForSubjectSignal("finished"), null);
});

test("manifest membership: every clip id the wiring can request exists in the real manifest.fixed", () => {
  const requestable = (["open", "correct", "wrong", "finished"] as SubjectCaseSignal[])
    .map((s) => speakRefForSubjectSignal(s))
    .filter((r) => r !== null)
    .map((r) => (r.kind === "fixed" ? r.id : "NOT-A-FIXED-REF"));
  assert.deepEqual(requestable, ["lets-find-clues", "win-holmes"]);
  for (const id of requestable) {
    assert.ok(real.fixed[id], `${id} missing from the real manifest fixed table`);
    assert.equal(real.fixed[id]!.file, `fixed/${id}.mp3`);
  }
  // The words behind the two clips (the coordinator's manifest read):
  assert.equal(real.fixed["lets-find-clues"]!.voice, real.voices.watson);
  assert.equal(
    (real.fixed["lets-find-clues"] as unknown as { text?: string }).text,
    "Let's find some clues.",
  );
  assert.equal(real.fixed["win-holmes"]!.voice, real.voices.holmes);
  assert.equal(
    (real.fixed["win-holmes"] as unknown as { text?: string }).text,
    "You found it!",
  );
  // The never-requested set stays unrequested: none of these ids can
  // come out of the mapping (they are GeoDetective-only / off-brief).
  for (const banned of [
    "win-watson",
    "ask-next",
    "suspicion",
    "score-celebration",
    "hook-announcement",
    "instructions-holmes",
    "instructions-watson",
    "debrief-frame",
    "debrief-close",
  ]) {
    assert.ok(!requestable.includes(banned), `${banned} must never be requested`);
  }
});

test("poses: resting, correct celebrate while Holmes sounds, finished both celebrate, wrong unchanged", () => {
  assert.deepEqual(subjectPairPoses({ finished: false, lastSignal: null, speaking: null }), { holmes: "search", watson: "read" });
  assert.deepEqual(subjectPairPoses({ finished: false, lastSignal: "open", speaking: "watson" }), { holmes: "search", watson: "read" });
  assert.deepEqual(subjectPairPoses({ finished: false, lastSignal: "wrong", speaking: null }), { holmes: "search", watson: "read" });
  assert.deepEqual(subjectPairPoses({ finished: false, lastSignal: "correct", speaking: "holmes" }), { holmes: "celebrate-jump", watson: "read" });
  assert.deepEqual(subjectPairPoses({ finished: true, lastSignal: "finished", speaking: null }), { holmes: "celebrate-jump", watson: "celebrate-jump" });
});

/* ------------------------------------------------------------------ */
/* The one-voice test                                                  */
/* ------------------------------------------------------------------ */

const FAKE_MANIFEST: DetectiveManifest = {
  v: 1,
  voices: real.voices,
  fixed: {
    "lets-find-clues": real.fixed["lets-find-clues"],
    "win-holmes": real.fixed["win-holmes"],
  },
  cases: {},
  names: {},
};

/** Drive the player exactly as SubjectDetectiveHost does: a signal's
 * ref is enqueued only when the mapping returns one. */
function hostDrive(player: DetectiveSpeechPlayer, signal: SubjectCaseSignal) {
  const ref = speakRefForSubjectSignal(signal);
  if (ref) player.enqueue(ref);
}

function instantPlayer(overrides: { isSoundOn?: () => boolean; canAutoPlay?: () => boolean } = {}) {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const player = createDetectiveSpeech({
    loadManifest: async () => FAKE_MANIFEST,
    playClip: async (clip: ResolvedClip) => {
      played.push(clip.url);
    },
    isSoundOn: overrides.isSoundOn ?? (() => true),
    canAutoPlay: overrides.canAutoPlay ?? (() => true),
    onSpeakingChange: (who) => speaking.push(who),
  });
  return { player, played, speaking };
}

function hangingPlayer(log: string[]) {
  const open = new Set<string>();
  const finishers = new Map<string, () => void>();
  let maxOpen = 0;
  const player = createDetectiveSpeech({
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
  return { player, open, maxOpen: () => maxOpen, finish: (n: string) => finishers.get(n)?.() };
}

test("one voice: open and correct play exactly their manifest clips; wrong and finished request nothing", async () => {
  const { player, played, speaking } = instantPlayer();
  hostDrive(player, "open");
  await tick();
  await tick();
  hostDrive(player, "wrong");
  hostDrive(player, "finished");
  await tick();
  await tick();
  // After a wrong pick and a finish, NOTHING further was requested.
  assert.deepEqual(played, ["/audio/detective/fixed/lets-find-clues.mp3"]);
  hostDrive(player, "correct");
  await tick();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/fixed/lets-find-clues.mp3",
    "/audio/detective/fixed/win-holmes.mp3",
  ]);
  assert.deepEqual(speaking, ["watson", null, "holmes", null]);
  player.dispose();
});

test("one voice: a case line starting stops the storyteller first and takes the channel", async () => {
  const log: string[] = [];
  const holder = claimVoice("storyteller", () => log.push("stop storyteller"), { userInitiated: true });
  assert.ok(holder);
  assert.equal(currentVoiceOwner(), "storyteller");
  const h = hangingPlayer(log);
  hostDrive(h.player, "open");
  await tick();
  await tick();
  assert.deepEqual(log, ["stop storyteller", "start lets-find-clues.mp3"]);
  assert.equal(currentVoiceOwner(), "detective");
  h.player.dispose();
});

test("one voice: a user-initiated storyteller claim stops the case line that is sounding", async () => {
  const log: string[] = [];
  const h = hangingPlayer(log);
  hostDrive(h.player, "open");
  await tick();
  await tick();
  assert.deepEqual([...h.open], ["lets-find-clues.mp3"]);
  assert.equal(currentVoiceOwner(), "detective");
  const claim = claimStorytellerVoice(null, () => {}, { userInitiated: true });
  assert.ok(claim);
  await tick();
  assert.deepEqual(log, ["start lets-find-clues.mp3", "stop lets-find-clues.mp3"]);
  assert.equal(h.open.size, 0);
  assert.equal(currentVoiceOwner(), "storyteller");
  claim.release();
  h.player.dispose();
});

test("one voice: two case lines never sound at once — the second starts only after the first ends", async () => {
  const log: string[] = [];
  const h = hangingPlayer(log);
  hostDrive(h.player, "open");
  await tick();
  await tick();
  hostDrive(h.player, "correct");
  await tick();
  await tick();
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
  h.player.dispose();
});

test("one voice: the sound gate and the read-aloud veto still silence the pair (auto mode)", async () => {
  const muted = instantPlayer({ isSoundOn: () => false });
  hostDrive(muted.player, "open");
  hostDrive(muted.player, "correct");
  await tick();
  await tick();
  assert.deepEqual(muted.played, []);
  muted.player.dispose();

  const vetoed = instantPlayer({ canAutoPlay: () => false });
  hostDrive(vetoed.player, "open");
  hostDrive(vetoed.player, "correct");
  await tick();
  await tick();
  assert.deepEqual(vetoed.played, []);
  vetoed.player.dispose();
});
