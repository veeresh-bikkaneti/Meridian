import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import site from "./site.json" with { type: "json" };
import {
  PAGES_ORIGIN,
  SHARE_DESCRIPTION,
  SHARE_DESCRIPTION_MAX,
  SHARE_IMAGE_ALT,
  SHARE_TITLE,
  SHARE_TITLE_MAX,
  WORKERS_ORIGIN,
  shareMetaTags,
  shareOrigin,
} from "./share-meta.ts";

const EXPECTED_KEYS = [
  "og:title",
  "og:description",
  "og:type",
  "og:url",
  "og:image",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
];

const ORIGINS = [
  { label: "pages", origin: PAGES_ORIGIN, other: "meridian.knowledgetest.workers.dev" },
  { label: "workers", origin: WORKERS_ORIGIN, other: "veeresh-bikkaneti.github.io" },
];

function keyOf(tag: { property?: string; name?: string }): string {
  return "property" in tag ? (tag as { property: string }).property : (tag as { name: string }).name;
}

/** Minimal JPEG reader: walks markers to the first SOF and returns its size. */
function jpegSize(buf: Buffer): { width: number; height: number } {
  assert.equal(buf[0], 0xff, "missing SOI marker");
  assert.equal(buf[1], 0xd8, "missing SOI marker");
  let i = 2;
  while (i < buf.length) {
    assert.equal(buf[i], 0xff, `expected marker at offset ${i}`);
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // standalone markers carry no length
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("no SOF marker found");
}

test("shareOrigin: /Meridian/ maps to Pages, every other base to workers.dev", () => {
  assert.equal(shareOrigin("/Meridian/"), PAGES_ORIGIN);
  assert.equal(shareOrigin("/"), WORKERS_ORIGIN);
  assert.equal(shareOrigin("/other/"), WORKERS_ORIGIN);
  assert.equal(WORKERS_ORIGIN, "https://meridian.knowledgetest.workers.dev/");
});

for (const { label, origin, other } of ORIGINS) {
  test(`shareMetaTags (${label}): exactly 12 tags, keys in order, correct attributes`, () => {
    const tags = shareMetaTags({ title: SHARE_TITLE, description: SHARE_DESCRIPTION, origin });
    assert.equal(tags.length, 12);
    assert.deepEqual(tags.map(keyOf), EXPECTED_KEYS);

    for (const tag of tags) {
      const key = keyOf(tag);
      if (key.startsWith("og:")) {
        assert.ok("property" in tag, `${key} must use property`);
      } else {
        assert.ok("name" in tag, `${key} must use name`);
      }
    }

    const byKey = new Map(tags.map((t) => [keyOf(t), t.content]));
    assert.equal(byKey.get("og:type"), "website");
    assert.equal(byKey.get("og:url"), origin);
    assert.equal(byKey.get("og:image"), `${origin}og.jpg`);
    assert.doesNotMatch(byKey.get("og:image")!, /\/\/og\.jpg/);
    assert.equal(byKey.get("og:image:width"), "1200");
    assert.equal(byKey.get("og:image:height"), "630");
    assert.equal(byKey.get("og:image:alt"), SHARE_IMAGE_ALT);
    assert.equal(byKey.get("twitter:card"), "summary_large_image");
    assert.equal(byKey.get("twitter:image"), byKey.get("og:image"));
    assert.equal(byKey.get("twitter:title"), byKey.get("og:title"));
    assert.equal(byKey.get("twitter:description"), byKey.get("og:description"));
    assert.equal(byKey.get("og:title"), SHARE_TITLE);
    assert.equal(byKey.get("og:description"), SHARE_DESCRIPTION);

    for (const tag of tags) {
      const isUrl = tag.content.startsWith("http");
      if (!isUrl) continue;
      assert.ok(tag.content.startsWith(origin), `${keyOf(tag)} must start with ${origin}`);
      assert.ok(!tag.content.includes(other), `${keyOf(tag)} must not reference ${other}`);
    }
  });
}

test("copy length limits: title and description are non-empty and within max", () => {
  assert.ok(SHARE_TITLE.length > 0);
  assert.ok(SHARE_TITLE.length <= SHARE_TITLE_MAX, `title is ${SHARE_TITLE.length} chars`);
  assert.ok(SHARE_DESCRIPTION.length > 0);
  assert.ok(
    SHARE_DESCRIPTION.length <= SHARE_DESCRIPTION_MAX,
    `description is ${SHARE_DESCRIPTION.length} chars`,
  );
});

test("SHARE_DESCRIPTION is the description in site.json", () => {
  assert.equal(SHARE_DESCRIPTION, site.description);
  assert.equal(site.title, "Meridian");
  assert.equal(site.type, "x:game");
});

test("wording: no 'lite', no 'ArcGIS', no '!' in title, no tracking/private claims", () => {
  const copy = [SHARE_TITLE, SHARE_DESCRIPTION, SHARE_IMAGE_ALT];
  for (const text of copy) {
    assert.doesNotMatch(text, /\blite\b/i, `"${text}" must not say lite`);
    assert.ok(!text.includes("ArcGIS"), `"${text}" must not mention ArcGIS`);
  }
  assert.ok(!SHARE_TITLE.includes("!"), "title must not contain !");
  assert.ok(!SHARE_DESCRIPTION.includes("tracking"), "description must not mention tracking");
  assert.ok(!SHARE_DESCRIPTION.includes("private"), "description must not mention private");
});

test("public/og.jpg exists and is 1200x630 JPEG", () => {
  const buf = readFileSync(new URL("../../../public/og.jpg", import.meta.url));
  assert.deepEqual(jpegSize(buf), { width: 1200, height: 630 });
});
