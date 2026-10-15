// Checks the BUILT share-card output. Opt-in: set SHARE_CARD_BUILT to
// "pages", "workers" or "both" after the matching build, so `npm test` stays
// green with no build present.
//
//   SHARE_CARD_BUILT=pages   -> checks dist/client/_shell.html (Pages build)
//   SHARE_CARD_BUILT=workers -> checks the Nitro server output (workers build)
//   SHARE_CARD_BUILT=both    -> runs both
//
// The server middleware (server/middleware/grok-pwa.ts) strips and re-injects
// share tags on this host, so we assert what it emits; the full head() set is
// asserted on the Pages shell.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MODE = process.env.SHARE_CARD_BUILT;
const VALID_MODES = ["pages", "workers", "both"];
if (MODE !== undefined && MODE !== "" && !VALID_MODES.includes(MODE)) {
  throw new Error(`SHARE_CARD_BUILT must be one of ${VALID_MODES.join("|")}, got "${MODE}"`);
}
const SKIP_REASON = "set SHARE_CARD_BUILT=pages|workers|both after the matching build";
const runPages = MODE === "pages" || MODE === "both";
const runWorkers = MODE === "workers" || MODE === "both";

const PAGES_ORIGIN = "https://veeresh-bikkaneti.github.io/Meridian/";
const WORKERS_ORIGIN = "https://meridian.knowledgetest.workers.dev/";
const SHARE_TITLE = "Meridian: guess the place, then read its story";
const SHARE_IMAGE_ALT = "The word Meridian over a dark green world map with a location pin.";
const OLD_DESCRIPTION = "Pin the place. The run lasts until the pin misses.";
const PAGES_HOST = "veeresh-bikkaneti.github.io";
const WORKERS_HOST = "meridian.knowledgetest.workers.dev";

const site = JSON.parse(
  readFileSync(new URL("../src/lib/og/site.json", import.meta.url), "utf8"),
);
const SITE_DESCRIPTION = site.description;

const ENTITIES = { "&amp;": "&", "&quot;": '"', "&#39;": "'" };

function unescapeHtml(text) {
  return text.replace(/&(amp|quot|#39);/g, (match) => ENTITIES[match]);
}

/** Parses every <meta> tag into { raw, property, name, content }. */
function parseMetaTags(html) {
  const tags = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const raw = match[0];
    const attr = (attrName) => {
      const m = raw.match(new RegExp(`(?<![\\w-])${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
      if (!m) return undefined;
      return unescapeHtml(m[1] ?? m[2] ?? "");
    };
    tags.push({
      raw,
      property: attr("property"),
      name: attr("name"),
      content: attr("content"),
    });
  }
  return tags;
}

/** All tags whose property (or name, for twitter:*) equals the key. */
function tagsFor(tags, key) {
  const attr = key.startsWith("og:") ? "property" : "name";
  return tags.filter((t) => t[attr] === key);
}

function assertExactlyOne(tags, key, expected) {
  const found = tagsFor(tags, key);
  assert.equal(found.length, 1, `${key} should appear exactly once, found ${found.length}`);
  if (expected !== undefined) {
    assert.equal(found[0].content, expected, `${key} content mismatch`);
  }
}

test("pages: shell carries all 12 share tags exactly once with Pages-origin values", { skip: runPages ? false : SKIP_REASON }, () => {
  const html = readFileSync(new URL("../dist/client/_shell.html", import.meta.url)).toString("utf8");
  const tags = parseMetaTags(html);

  assert.ok(!html.includes(OLD_DESCRIPTION), "old description text must be absent");

  assertExactlyOne(tags, "og:title", SHARE_TITLE);
  assertExactlyOne(tags, "og:description", SITE_DESCRIPTION);
  assertExactlyOne(tags, "og:type", "website");
  assertExactlyOne(tags, "og:url", PAGES_ORIGIN);
  assertExactlyOne(tags, "og:image", `${PAGES_ORIGIN}og.jpg`);
  assertExactlyOne(tags, "og:image:width", "1200");
  assertExactlyOne(tags, "og:image:height", "630");
  assertExactlyOne(tags, "og:image:alt", SHARE_IMAGE_ALT);
  assertExactlyOne(tags, "twitter:card", "summary_large_image");
  assertExactlyOne(tags, "twitter:title", SHARE_TITLE);
  assertExactlyOne(tags, "twitter:description", SITE_DESCRIPTION);
  assertExactlyOne(tags, "twitter:image", `${PAGES_ORIGIN}og.jpg`);

  const descriptionTags = tags.filter((t) => t.name === "description");
  assert.equal(descriptionTags.length, 1, '<meta name="description"> should appear exactly once');
  assert.equal(descriptionTags[0].content, SITE_DESCRIPTION);

  for (const tag of tags) {
    assert.ok(
      !(tag.content ?? "").includes(WORKERS_HOST),
      `Pages shell must not reference ${WORKERS_HOST} in ${tag.raw}`,
    );
  }
});

test("workers: server output carries share tags for the workers.dev host only", { skip: runWorkers ? false : SKIP_REASON }, async () => {
  const modUrl = new URL("../.vercel/output/functions/__server.func/index.mjs", import.meta.url);
  const mod = await import(modUrl.href);
  const response = await mod.default.fetch(
    new Request(WORKERS_ORIGIN, {
      headers: { accept: "text/html", "x-forwarded-host": WORKERS_HOST },
    }),
  );
  const html = await response.text();
  const tags = parseMetaTags(html);

  assert.ok(tagsFor(tags, "og:title").length >= 1, "og:title must be present");
  assertExactlyOne(tags, "og:description", SITE_DESCRIPTION);
  assertExactlyOne(tags, "og:image", `${WORKERS_ORIGIN}og.jpg`);
  assert.ok(tagsFor(tags, "og:image:width").length >= 1, "og:image:width must be present");
  assert.ok(tagsFor(tags, "og:image:height").length >= 1, "og:image:height must be present");
  assert.ok(tagsFor(tags, "twitter:card").length >= 1, "twitter:card must be present");

  const descriptionTags = tags.filter((t) => t.name === "description");
  assert.equal(descriptionTags.length, 1, '<meta name="description"> should appear exactly once');
  assert.equal(descriptionTags[0].content, SITE_DESCRIPTION);

  assert.ok(!html.includes(OLD_DESCRIPTION), "old description text must be absent");

  for (const tag of tags) {
    assert.ok(
      !tag.raw.includes(PAGES_HOST) && !(tag.content ?? "").includes(PAGES_HOST),
      `${PAGES_HOST} must not appear in ${tag.raw}`,
    );
  }
});
