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
