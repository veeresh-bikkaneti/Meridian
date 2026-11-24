import { resetStorytellerSessionForTests, currentVoiceOwner } from "../../tests/harness/module-seams.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GREETINGS,
  GREET_01,
  LEAF_LINE,
  POKE_LINES,
  SCROLL_TAP_LINE,
  SENDOFFS,
  TOUR_RETURN_LINE,
  dayOfYear,
  decideHomeMode,
  greetingIndexForDate,
  localDayKey,
} from "./storyteller-home-copy.ts";
import {
  armTourReturnLine,
  consumeSessionAutoNarration,
  isSessionAutoNarrationConsumed,
  readHomeGreetDay,
  takeTourReturnLine,
  writeHomeGreetDay,
} from "./storyteller-session.ts";

describe("storyteller home copy — locked lines are byte-identical (copy pack §0)", () => {
  it("greet-01 is the locked line", () => {
    assert.equal(
      GREET_01,
      "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?",
    );
    assert.equal(GREETINGS[0], GREET_01);
  });

  it("ships exactly 6 greetings, greet-02…06 verbatim", () => {
    assert.equal(GREETINGS.length, 6);
    assert.deepEqual(GREETINGS.slice(1), [
      "New day, new tales hiding in the hills. Shall we go find one?",
      "Psst… the rivers told me a secret this morning. Want to hear it?",
      "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
      "The winds brought rumors from faraway cities today. Curious?",
      "Every dot on this map has a tale. Which one shall we wake up first?",
    ]);
  });

  it("post-tour return line is the locked line", () => {
    assert.equal(
      TOUR_RETURN_LINE,
      "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?",
    );
  });

  it("all 7 send-offs are the locked lines", () => {
    assert.deepEqual(SENDOFFS, {
      terrain: "Boots on! Let's read the land like a detective. 🥾",
      quiz: "Quick-fire questions, brave explorer — show me what you know!",
      passport: "Your passport is hungry for new stamps! ✈️",
      geodetective: "A mystery is afoot… lean in close. 🔍",
      capital: "Capitals and clever guesses — off we go!",
      expedition: "Pack a snack — this trail is a long one. 🎒",
      duel: "A friendly duel! May the sharpest compass win. 🧭",
    });
  });

  it("poke lines: 5 max, then repeat — verbatim", () => {
    assert.equal(POKE_LINES.length, 5);
    assert.deepEqual([...POKE_LINES], [
      "Heh! That tickles my beard.",
      "Careful, explorer — I'm older than these mountains.",
      "Poke all you like. I've survived worse… have I told you about Troy? 😌",
      "Hmm? Did the map just move, or was that you?",
      "Alright, alright — pick a place and I'll tell you its tale.",
    ]);
  });

  it("micro-delight captions verbatim", () => {
    assert.equal(LEAF_LINE, "A leaf for luck. 🍃");
    assert.equal(SCROLL_TAP_LINE, "tap tap… is this thing on? 👀");
  });

  it("no greeting or poke line uses the reserved catchphrase", () => {
    for (const line of [...GREETINGS, ...POKE_LINES, LEAF_LINE, SCROLL_TAP_LINE]) {
      assert.ok(!line.includes("Shh"), `catchphrase leaked: ${line}`);
    }
  });

  it("max 1 emoji per line", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const line of [...GREETINGS, ...POKE_LINES, LEAF_LINE, SCROLL_TAP_LINE]) {
      const count = [...line.matchAll(new RegExp(emoji, "gu"))].length;
      assert.ok(count <= 1, `too many emoji: ${line}`);
    }
  });
});

describe("greeting rotation — day-of-year mod 6", () => {
  it("indexes 0…5 across consecutive days", () => {
    // 2026-01-01 is day 1 → index 1; 2026-01-06 is day 6 → index 0.
    assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 1)), 1);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 6)), 0);
    assert.equal(greetingIndexForDate(new Date(2026, 0, 7)), 1);
  });

  it("localDayKey is YYYY-MM-DD in local time", () => {
    assert.equal(localDayKey(new Date(2026, 9, 9, 12)), "2026-10-09");
  });
});

describe("decideHomeMode — G2 check order", () => {
  it("tour return wins, exactly once", () => {
    assert.equal(
      decideHomeMode({ tourReturnDue: true, greetedToday: true }),
      "tour-return",
    );
    assert.equal(
      decideHomeMode({ tourReturnDue: true, greetedToday: false }),
      "tour-return",
    );
  });

  it("first visit of day greets; same-day return is silent", () => {
    assert.equal(
      decideHomeMode({ tourReturnDue: false, greetedToday: false }),
      "greeting",
    );
    assert.equal(
      decideHomeMode({ tourReturnDue: false, greetedToday: true }),
      "silent",
    );
  });
});

describe("storyteller-session — storage flags", () => {
  it("session auto-narration: first consume wins, then consumed", () => {
    resetStorytellerSessionForTests();
    assert.equal(isSessionAutoNarrationConsumed(), false);
    assert.equal(consumeSessionAutoNarration(), true);
    assert.equal(isSessionAutoNarrationConsumed(), true);
    assert.equal(consumeSessionAutoNarration(), false);
  });

  it("tour-return flag: armed → taken exactly once → gone", () => {
    resetStorytellerSessionForTests();
    armTourReturnLine("2026-10-09");
    assert.equal(takeTourReturnLine("2026-10-09"), true);
    assert.equal(takeTourReturnLine("2026-10-09"), false);
  });

  it("tour-return flag: a stale day never fires", () => {
    resetStorytellerSessionForTests();
    armTourReturnLine("2026-10-08");
    assert.equal(takeTourReturnLine("2026-10-09"), false);
  });

  it("greet-day key round-trips", () => {
    resetStorytellerSessionForTests();
    assert.equal(readHomeGreetDay(), null);
    writeHomeGreetDay("2026-10-09");
    assert.equal(readHomeGreetDay(), "2026-10-09");
  });
});

// ---------------------------------------------------------------------------
// TD-02.6 — the home screen's download and sounds ride the platform ports.
// The component is a .tsx the unit harness cannot import directly, so the
// module hooks below (the age-band-control.test.ts pattern) resolve "@/"
// specifiers, transpile .tsx, and stub the two imports the helpers under
// test never reach: the stylesheet and the mascot module. Everything else
// the component imports loads for real. The port factories are injected
// fakes: no network, no audio element.
// ---------------------------------------------------------------------------
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  claimVoice,
  stopAllVoices,
} from "../game/audio/voice-channel.ts";
import type { RawResponse } from "../platform/transport/transport.ts";
import type {
  CreateVoiceOptions,
  VoiceHandle,
  VoiceState,
} from "../platform/audio/voice.ts";

const REPO_ROOT = resolvePath(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const STORYTELLER_STUB_SOURCE = [
  "export function StorytellerMascot() { return null; }",
  "export function isPlayAbort(err) {",
  "  return typeof err === \"object\" && err !== null && err.name === \"AbortError\";",
  "}",
  "export function useCelebrationActive() { return false; }",
  "export function useTourActive() { return false; }",
].join("\n");
const STORYTELLER_STUB_URL =
  "data:text/javascript," + encodeURIComponent(STORYTELLER_STUB_SOURCE);
const EMPTY_URL =
  "data:text/javascript," + encodeURIComponent("export {};\n");

const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const STUB_URL = " + JSON.stringify(STORYTELLER_STUB_URL) + ";",
  "const EMPTY_URL = " + JSON.stringify(EMPTY_URL) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.endsWith('.css')) {",
  "    return { url: EMPTY_URL, shortCircuit: true };",
  "  }",
  "  if (specifier === './storyteller' && context.parentURL && context.parentURL.endsWith('storyteller-home.tsx')) {",
  "    return { url: STUB_URL, shortCircuit: true };",
  "  }",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && context.parentURL.startsWith('file:')) {",
  "    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const homeModule = (await import("./storyteller-home.tsx")) as unknown as {
  readAssetManifest: (
    fetchRaw: (url: string) => Promise<RawResponse>,
    url: string,
  ) => Promise<unknown>;
  playClaimedLine: (
    makeVoice: (
      src: string,
      opts: CreateVoiceOptions,
    ) => VoiceHandle | null,
    src: string,
    opts: CreateVoiceOptions,
  ) => VoiceHandle | null;
};

describe("TD-02.6 — manifest load rides the transport port", () => {
  it("reads the manifest through the injected raw getter, never the global", async () => {
    const manifest = {
      version: 1,
      poses: { idle: "idle.webp", pointing: null },
      audio: { "greet-01": "greet-01.mp3" },
    };
    const seenUrls: string[] = [];
    let globalCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      globalCalls += 1;
      throw new Error("global fetch must not be used");
    }) as typeof fetch;
    try {
      const out = await homeModule.readAssetManifest(async (url: string) => {
        seenUrls.push(url);
        return { ok: true, status: 200, json: Promise.resolve(manifest) };
      }, "/assets/storyteller/storyteller-assets.json");
      assert.deepEqual(out, manifest);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(seenUrls, ["/assets/storyteller/storyteller-assets.json"]);
    assert.equal(globalCalls, 0);
  });

  it("fails closed to null on a non-ok status", async () => {
    const out = await homeModule.readAssetManifest(
      async () => ({ ok: false, status: 404, json: Promise.resolve(null) }),
      "/assets/storyteller/storyteller-assets.json",
    );
    assert.equal(out, null);
  });

  it("fails closed to null when the getter throws", async () => {
    const out = await homeModule.readAssetManifest(async () => {
      throw new Error("network down");
    }, "/assets/storyteller/storyteller-assets.json");
    assert.equal(out, null);
  });

  it("fails closed to null when the body does not parse", async () => {
    const out = await homeModule.readAssetManifest(
      async () => ({
        ok: true,
        status: 200,
        json: Promise.reject(new Error("not json")),
      }),
      "/assets/storyteller/storyteller-assets.json",
    );
    assert.equal(out, null);
  });
});

describe("TD-02.6 — greeting / poke playback rides the voice port", () => {
  it("adopts the caller's channel claim and plays in the same call", () => {
    stopAllVoices();
    const claim = claimVoice("storyteller-home", () => {}, {
      userInitiated: true,
    });
    assert.ok(claim);
    assert.equal(currentVoiceOwner(), "storyteller-home");

    let seenSrc: string | null = null;
    const seen: { opts: CreateVoiceOptions | null } = { opts: null };
    let playCalls = 0;
    const state: VoiceState = "idle";
    const fakeHandle: VoiceHandle = {
      get state() {
        return state;
      },
      play() {
        playCalls += 1;
      },
      pause() {},
      stop() {},
      currentTime: () => 0,
      duration: () => 0,
    };
    const onEnded = () => {};
    const voice = homeModule.playClaimedLine(
      (src: string, opts: CreateVoiceOptions) => {
        seenSrc = src;
        seen.opts = opts;
        return fakeHandle;
      },
      "greet-01.mp3",
      { owner: "storyteller-home", userInitiated: true, claim, onEnded },
    );
    // No await has run yet: play() already fired, in the same call,
    // before anything could await — the tapped-line rule.
    assert.equal(voice, fakeHandle);
    assert.equal(playCalls, 1);
    assert.equal(seenSrc, "greet-01.mp3");
    const seenOpts = seen.opts;
    assert.ok(seenOpts);
    assert.equal(seenOpts.claim, claim);
    assert.equal(seenOpts.owner, "storyteller-home");
    assert.equal(seenOpts.onEnded, onEnded);
    claim.release();
    assert.equal(currentVoiceOwner(), null);
  });

  it("returns null and plays nothing when the port declines the line", () => {
    stopAllVoices();
    const claim = claimVoice("storyteller-home", () => {}, {
      userInitiated: false,
    });
    assert.ok(claim);
    const voice = homeModule.playClaimedLine(() => null, "poke-01.mp3", {
      owner: "storyteller-home",
      userInitiated: true,
      claim,
    });
    assert.equal(voice, null);
    claim.release();
  });
});

describe("TD-02.6 — the component source carries no raw download or element", () => {
  const source = readFileSync(
    new URL("./storyteller-home.tsx", import.meta.url),
    "utf8",
  );

  it("routes the manifest through the transport port's raw getter", () => {
    assert.ok(source.includes("getRaw"));
    assert.ok(source.includes("browser-transport"));
  });

  it("routes playback through the voice port", () => {
    assert.ok(source.includes("createVoice"));
    assert.ok(source.includes("browser-voice"));
    assert.ok(source.includes("claimVoice"));
  });

  it("has no raw call left", () => {
    assert.ok(!source.includes("new Audio("));
    assert.ok(!source.includes("fetch("));
  });
});
