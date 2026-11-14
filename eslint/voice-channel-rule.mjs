/**
 * One voice at a time (owner, PR #430; `AGENTS.md` rule table).
 *
 * Mistake class: each character voice (storyteller, Comet, Grandpa,
 * Holmes and Watson, read-aloud, celebration lines) built its own
 * `new Audio()` and played it, so two voices talked over each other. PR
 * #430 gave the app one owner for "who is speaking", `claimVoice()` in
 * src/game/audio/voice-channel.ts, and retrofitted six files. This rule
 * keeps the next voice from skipping it: a module that creates an audio
 * element must import the voice channel.
 *
 * Sound effects that are not voices live in src/game/audio/sfx.ts, which
 * already imports the channel (to stay quiet under a voice).
 */
const FIX =
  "route the clip through claimVoice() from src/game/audio/voice-channel.ts (claim before play, release on end/error/unmount)";

const isVoiceChannelImport = (source) => /(^|\/)voice-channel(\.ts)?$/.test(String(source));

const voiceThroughChannel = {
  meta: {
    type: "problem",
    docs: { description: "Audio elements must go through the one voice channel." },
    schema: [],
    messages: {
      noChannel: `This file creates an audio element but never imports the voice channel, so it can talk over another voice. Fix: ${FIX}.`,
    },
  },
  create(context) {
    let hasChannel = false;
    const creations = [];
    const noteImport = (source) => {
      if (isVoiceChannelImport(source)) hasChannel = true;
    };
    return {
      ImportDeclaration(node) {
        noteImport(node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) noteImport(node.source.value);
      },
      ExportAllDeclaration(node) {
        noteImport(node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") noteImport(node.source.value);
      },
      NewExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "Audio") creations.push(node);
      },
      CallExpression(node) {
        const c = node.callee;
        const arg = node.arguments[0];
        if (
          c.type === "MemberExpression" &&
          c.property.type === "Identifier" &&
          c.property.name === "createElement" &&
          arg?.type === "Literal" &&
          String(arg.value).toLowerCase() === "audio"
        ) {
          creations.push(node);
        }
      },
      "Program:exit"() {
        if (hasChannel) return;
        for (const node of creations) context.report({ node, messageId: "noChannel" });
      },
    };
  },
};

/**
 * Second half of the same class (PR #469, PR #470): a tapped line awaited
 * the clip manifest, then called play(). iOS Safari only lets play() start
 * sound inside the tap's own call stack, so after an await the tap is lost
 * and the line is silent on iPhone and iPad. Load what a clip needs before
 * the tap (preload, or a cached manifest) and call play() before any await
 * in the function that plays it. A line claimed with
 * `{ userInitiated: false }` is automatic (no tap to lose) and is exempt.
 */
const PLAY_FIX =
  "resolve the clip before the tap (preload the manifest or keep it cached) and call play() before any await in this function; iOS drops the tap after an await";


const noPlayAfterAwait = {
  meta: {
    type: "problem",
    docs: { description: "play() must run before any await in its function (iOS gesture rule)." },
    schema: [],
    messages: { afterAwait: `play() after an await in the same function. Fix: ${PLAY_FIX}.` },
  },
  create(context) {
    // Per function: the end offset of the first await seen so far. A
    // `new Promise(executor)` executor runs synchronously, so it inherits
    // its parent's awaits; any other nested function starts clean.
    const stack = [];
    const isPromiseExecutor = (fn) =>
      fn.parent?.type === "NewExpression" &&
      fn.parent.callee.type === "Identifier" &&
      fn.parent.callee.name === "Promise" &&
      fn.parent.arguments[0] === fn;
    const enter = (fn) => {
      const parent = stack[stack.length - 1];
      const inherit = isPromiseExecutor(fn) && parent;
      stack.push({
        firstAwaitEnd: inherit ? parent.firstAwaitEnd : Infinity,
        automatic: inherit ? parent.automatic : false,
      });
    };
    // `claimVoice(owner, stop, { userInitiated: false })`: an automatic
    // line has no tap to lose, so it may load first and play later.
    const isAutomaticClaim = (node) =>
      node.callee.type === "Identifier" &&
      node.callee.name === "claimVoice" &&
      node.arguments[2]?.type === "ObjectExpression" &&
      node.arguments[2].properties.some(
        (p) =>
          p.type === "Property" &&
          p.key.type === "Identifier" &&
          p.key.name === "userInitiated" &&
          p.value.type === "Literal" &&
          p.value.value === false,
      );
    const exit = () => stack.pop();
    return {
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      "FunctionDeclaration:exit": exit,
      "FunctionExpression:exit": exit,
      "ArrowFunctionExpression:exit": exit,
      AwaitExpression(node) {
        const top = stack[stack.length - 1];
        if (top) top.firstAwaitEnd = Math.min(top.firstAwaitEnd, node.range[1]);
      },
      CallExpression(node) {
        const top = stack[stack.length - 1];
        if (top && isAutomaticClaim(node)) top.automatic = true;
        const c = node.callee;
        if (c.type !== "MemberExpression" || c.property.type !== "Identifier" || c.property.name !== "play") return;
        if (node.arguments.length !== 0) return;
        if (top && !top.automatic && node.range[0] > top.firstAwaitEnd) {
          context.report({ node, messageId: "afterAwait" });
        }
      },
    };
  },
};

export const voicePlugin = {
  rules: { "voice-through-channel": voiceThroughChannel, "no-play-after-await": noPlayAfterAwait },
};

/** Flat-config block: app source; unit tests build fake audio freely. */
export const voiceChannelConfig = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/**/*.test.ts", "src/play-lab/**"],
  plugins: { meridian: voicePlugin },
  rules: {
    "meridian/voice-through-channel": "error",
    "meridian/no-play-after-await": "error",
  },
};
