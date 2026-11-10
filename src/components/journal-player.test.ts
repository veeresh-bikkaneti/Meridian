import assert from "node:assert/strict";
import test from "node:test";

// Module resolution for `.tsx` transpile, mirroring
// age-profile/read-aloud-button.test.ts. The component is imported
// dynamically AFTER register() so the hook is in place when its
// specifiers resolve.
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  if (specifier.startsWith('./') || specifier.startsWith('../')) {",
  "    const parent = fileURLToPath(context.parentURL);",
  "    const base = resolvePath(dirname(parent), specifier);",
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

const { JournalPlayer } = (await import("./journal-player.tsx")) as typeof import(
  "./journal-player.tsx"
);

const MOVIE_URL = "https://veeresh-bikkaneti.github.io/meridian-media/journal/old-faithful.mp4";
const STILL = "/images/journal/old-faithful.webp";

function renderPlayer(overrides: Record<string, unknown> = {}) {
  return renderToString(
    createElement(JournalPlayer, {
      noteId: "old-faithful",
      place: "Old Faithful",
      imageSrc: STILL,
      imageAlt: "Storybook drawing of Old Faithful geyser",
      open: false,
      onOpen: () => {},
      onClose: () => {},
      ...overrides,
    }),
  );
}

// --- Closed: the picture IS the button, no video bytes -------------------

test("closed: the still picture is a button, no <video> is rendered", () => {
  const html = renderPlayer();
  assert.ok(html.includes('data-testid="journal-play-old-faithful"'), "play button present");
  assert.ok(
    html.includes('aria-label="Watch the Old Faithful movie, 10 seconds with sound"'),
    "accessible name warns of sound",
  );
  assert.ok(html.includes(`src="${STILL}"`), "still picture present");
  assert.ok(html.includes("Watch the movie · 10 sec"), "visible play badge names the length");
  assert.ok(!html.includes("<video"), "no video element before the tap");
  assert.ok(!html.includes(".mp4"), "no movie URL anywhere before the tap");
});

test("closed: reduced motion keeps the same tap-to-play picture", () => {
  const html = renderPlayer({ reducedMotion: true });
  assert.ok(html.includes('data-testid="journal-play-old-faithful"'), "still tappable");
  assert.ok(!html.includes("<video"), "still no video before the tap");
});

// --- Open with a resolved movie: the video + controls --------------------

test("open with a movie URL: video has preload=none, poster, loop, controls", () => {
  const html = renderPlayer({ open: true, movieUrlOverride: MOVIE_URL });
  assert.ok(html.includes("<video"), "video element present");
  assert.ok(html.includes(`src="${MOVIE_URL}"`), "movie URL on the video");
  assert.ok(html.includes('preload="none"'), "preload=none");
  assert.ok(html.includes(`poster="${STILL}"`), "still as poster");
  assert.ok(html.includes(" loop"), "loops by default");
  assert.ok(html.includes('data-testid="journal-player-toggle-old-faithful"'), "play/pause toggle");
  assert.ok(html.includes('data-testid="journal-player-mute-old-faithful"'), "mute toggle");
  assert.ok(html.includes('aria-label="Mute movie"'), "mute toggle names the action");
  assert.ok(html.includes('aria-pressed="false"'), "sound starts unmuted");
  assert.ok(html.includes('data-testid="journal-player-close-old-faithful"'), "close button");
  assert.ok(html.includes('role="progressbar"'), "progress bar");
  assert.ok(html.includes("0:00 / 0:10"), "initial time text");
  assert.ok(!html.includes("journal-player-pause-flash-"), "no pause flash before any tap");
});

test("open with reduced motion: the video does not loop", () => {
  const html = renderPlayer({ open: true, movieUrlOverride: MOVIE_URL, reducedMotion: true });
  assert.ok(html.includes("<video"), "video element present");
  assert.ok(!html.includes(" loop"), "no loop under reduced motion");
  assert.ok(html.includes('data-testid="journal-player-toggle-old-faithful"'), "still controllable");
});

// --- Open without a movie: graceful degradation, still stays -------------

test("open with no movie: error message + still picture, no video, close works", () => {
  const html = renderPlayer({ open: true, movieUrlOverride: null });
  assert.ok(html.includes("movie isn"), "graceful message");
  assert.ok(html.includes(`src="${STILL}"`), "still picture stays");
  assert.ok(!html.includes("<video"), "no video without a movie");
  assert.ok(html.includes('data-testid="journal-player-close-old-faithful"'), "close button");
  assert.ok(html.includes('data-testid="journal-player-retry-old-faithful"'), "retry button");
  assert.ok(html.includes('role="alert"'), "message is announced");
});

// --- Captions + transcript (real Old Faithful transcript from the
// captions worker's file, c5cc7ecf — no provisional timings) -----------

const TRANSCRIPT_FIXTURE = JSON.parse(
  readFileSync("public/videos/journal-transcripts.json", "utf8"),
).transcripts["old-faithful"];

test("open with a transcript: video is cross-origin with a captions track, CC + Story text buttons, off by default", () => {
  const html = renderPlayer({
    open: true,
    movieUrlOverride: MOVIE_URL,
    transcriptOverride: TRANSCRIPT_FIXTURE,
  });
  assert.ok(html.includes("<video"), "video element present");
  assert.ok(html.includes('crossorigin="anonymous"'), "crossOrigin=anonymous for the cross-origin clip");
  assert.ok(html.includes("<track"), "captions track present");
  assert.ok(html.includes('kind="captions"'), "track kind is captions");
  assert.ok(html.includes('label="English captions"'), "track label names the language");
  assert.ok(html.includes('srcLang="en"'), "track srcLang is en");
  assert.ok(
    html.includes('src="/videos/captions/old-faithful.vtt"'),
    "track points at the per-entry WebVTT file",
  );
  assert.ok(html.includes('data-testid="journal-player-cc-old-faithful"'), "CC button present");
  assert.ok(html.includes('aria-label="Show captions"'), "CC names its action");
  assert.ok(
    html.includes('data-testid="journal-player-transcript-old-faithful"'),
    "Story text button present",
  );
  assert.ok(html.includes('aria-label="Show story text"'), "Story text names its action");
  assert.ok(html.includes('aria-expanded="false"'), "transcript panel starts closed");
  assert.ok(
    !html.includes('data-testid="journal-player-transcript-panel-old-faithful"'),
    "transcript panel is hidden until opened",
  );
});

test("open without a transcript: neither CC nor Story text is offered, no track", () => {
  const html = renderPlayer({
    open: true,
    movieUrlOverride: MOVIE_URL,
    transcriptOverride: null,
  });
  assert.ok(html.includes("<video"), "movie still plays");
  assert.ok(!html.includes("<track"), "no captions track without a transcript");
  assert.ok(!html.includes('data-testid="journal-player-cc-old-faithful"'), "no CC button");
  assert.ok(
    !html.includes('data-testid="journal-player-transcript-old-faithful"'),
    "no Story text button",
  );
});

test("open with no transcript override: buttons stay hidden until the fetch resolves", () => {
  // Server-side render never runs the open effect, so the transcripts
  // fetch has not resolved: no fake affordance is rendered meanwhile.
  const html = renderPlayer({ open: true, movieUrlOverride: MOVIE_URL });
  assert.ok(html.includes("<video"), "movie still plays");
  assert.ok(!html.includes("<track"), "no track before the transcripts load");
  assert.ok(!html.includes('data-testid="journal-player-cc-old-faithful"'), "no CC button yet");
  assert.ok(
    !html.includes('data-testid="journal-player-transcript-old-faithful"'),
    "no Story text button yet",
  );
});
