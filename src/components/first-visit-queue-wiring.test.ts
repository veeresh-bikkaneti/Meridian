/**
 * Item 9 (INV4) wiring pins: GameApp's first-visit prompts — Scout Map
 * notice → tour banner → read-aloud sheet — share Stream S's
 * FirstVisitQueue, so two pending prompts never render at once. The
 * storyteller greeting bubble (fourth) is held by the widened
 * tutorialInviteVisible until the queue drains.
 *
 * The queue is fed a dynamic list: only the prompts that currently
 * want to show, in queue order, each keeping its own seen-store. The
 * behavioural tests below render that exact shape; the source pins
 * hold GameApp to it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
import type { createElement, ReactNode } from "react";
import type { renderToStaticMarkup } from "react-dom/server";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

type QueueModule = {
  FirstVisitQueue: (props: never) => ReactNode;
  createElement: typeof createElement;
  renderToStaticMarkup: typeof renderToStaticMarkup;
};

let queuePromise: Promise<QueueModule> | undefined;
function loadQueue(): Promise<QueueModule> {
  queuePromise ??= (async () => {
    const dir = mkdtempSync(join(tmpdir(), "fvq-wiring-test-"));
    const entry = join(dir, "entry.tsx");
    writeFileSync(
      entry,
      [
        `export * from ${JSON.stringify(join(here, "ui", "first-visit-queue.tsx"))};`,
        'export { createElement } from "react";',
        'export { renderToStaticMarkup } from "react-dom/server";',
      ].join("\n"),
    );
    const outfile = join(dir, "bundle.mjs");
    buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      alias: {
        react: dirname(req.resolve("react/package.json")),
        "react-dom": dirname(req.resolve("react-dom/package.json")),
      },
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    return (await import(pathToFileURL(outfile).href)) as QueueModule;
  })();
  return queuePromise;
}

const renderQueue = async (prompts: { id: string; text: string }[]) => {
  const mod = await loadQueue();
  const C = mod.FirstVisitQueue as unknown as (p: Record<string, unknown>) => ReactNode;
  return mod.renderToStaticMarkup(
    mod.createElement(C, {
      seenKey: "wiring-test",
      prompts: prompts.map(({ id, text }) => ({ id, node: mod.createElement("p", null, text) })),
    }),
  );
};

describe("FirstVisitQueue wiring (item 9)", () => {
  it("two pending prompts never render at once", async () => {
    const html = await renderQueue([
      { id: "scout-notice", text: "SCOUT-NOTICE" },
      { id: "tour-invite", text: "TOUR-INVITE" },
      { id: "read-aloud-sheet", text: "READ-ALOUD-SHEET" },
    ]);
    assert.match(html, /SCOUT-NOTICE/);
    assert.doesNotMatch(html, /TOUR-INVITE|READ-ALOUD-SHEET/);
    assert.match(html, /data-prompt-id="scout-notice"/);
  });

  it("the queue advances as each prompt's own store clears it", async () => {
    const tour = await renderQueue([
      { id: "tour-invite", text: "TOUR-INVITE" },
      { id: "read-aloud-sheet", text: "READ-ALOUD-SHEET" },
    ]);
    assert.match(tour, /TOUR-INVITE/);
    assert.doesNotMatch(tour, /READ-ALOUD-SHEET/);
    const sheet = await renderQueue([{ id: "read-aloud-sheet", text: "READ-ALOUD-SHEET" }]);
    assert.match(sheet, /READ-ALOUD-SHEET/);
  });

  it("GameApp feeds the queue in INV4 order and holds the bubble", () => {
    const app = read("src/components/game-app.tsx");
    const scout = app.indexOf('id: "scout-notice"');
    const tour = app.indexOf('id: "tour-invite"');
    const sheet = app.indexOf('id: "read-aloud-sheet"');
    assert.ok(scout >= 0 && tour > scout && sheet > tour, "queue order: scout → tour → read-aloud");
    assert.match(app, /<FirstVisitQueue prompts=\{firstVisitPrompts\} seenKey="meridian\.firstVisitQueue\.v1" \/>/);
    // The bubble (fourth prompt) waits for the whole queue, not just the invite.
    assert.match(app, /tutorialInviteVisible=\{firstVisitPrompts\.length > 0\}/);
    // The Scout notice no longer renders outside the queue.
    assert.doesNotMatch(app, /\{autoScoutNotice\}/);
  });

  it("the send-off overlay ends when the case screen mounts (item 34)", () => {
    const host = read("src/components/storyteller-home.tsx");
    assert.match(host, /data-testid="loop-screen"/);
    assert.match(host, /caseMounted/);
  });
});
