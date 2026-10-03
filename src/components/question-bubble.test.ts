import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Regression guard for the "Fairchild Air Forc..." bug: the question
// bubble must wrap long place names instead of single-line-truncating
// them. A player who can't read the full question can't play fairly.
// There is no DOM test infra in this repo, so this test asserts on the
// rendered class contract in the component source; the Playwright E2E
// (tests/e2e/question-wrap.spec.ts) proves it visually.
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "question-bubble.tsx"),
  "utf8",
);

// The elements that render the place name as their text content.
const nameElements = [
  ...source.matchAll(
    /<(h2|p)\b([^>]*?)className="([^"]*)"([^>]*?)>\s*\{placeName\}/g,
  ),
].map((m) => ({ tag: m[1], className: m[3] }));

describe("question-bubble — long place names wrap, never truncate", () => {
  it("finds both place-name elements (expanded h2 + collapsed p)", () => {
    const tags = nameElements.map((e) => e.tag).sort();
    assert.deepEqual(tags, ["h2", "p"]);
  });

  it("no place-name element uses single-line truncation", () => {
    for (const el of nameElements) {
      const tokens = el.className.split(/\s+/);
      assert.ok(
        !tokens.includes("truncate"),
        `<${el.tag}> must not single-line-truncate the place name`,
      );
      assert.ok(
        !tokens.includes("whitespace-nowrap"),
        `<${el.tag}> must allow wrapping`,
      );
    }
  });

  it("both place-name elements cap at multiple wrapped lines", () => {
    for (const el of nameElements) {
      assert.ok(
        el.className.split(/\s+/).includes("line-clamp-3"),
        `<${el.tag}> should wrap up to 3 lines instead of ellipsizing`,
      );
    }
  });

  it("keeps the full-name tooltip on both views", () => {
    const tooltips = source.match(/title=\{placeName\}/g) ?? [];
    assert.equal(
      tooltips.length,
      2,
      "both expanded and collapsed views keep title={placeName}",
    );
  });
});
