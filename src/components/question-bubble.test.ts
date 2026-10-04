import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Regression guard for the "West Cambridge/Harvard Square,..." bug:
// the question bubble must render the FULL question label — never an
// ellipsis. line-clamp-3 (commit 59f0de0) still ellipsized long qualified
// labels, so clamping is structurally wrong now that labels carry
// subdivision/country qualifiers. The bubble grows vertically to fit;
// a max-height + scroll safety valve covers pathological names.
// There is no DOM test infra in this repo, so this test asserts on the
// rendered class contract in the component source; the Playwright E2E
// (tests/e2e/question-wrap.spec.ts + question-card-header.spec.ts)
// proves it visually.
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

describe("question-bubble — full question label, never an ellipsis", () => {
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

  it("no place-name element clamps lines (line-clamp ellipsizes)", () => {
    for (const el of nameElements) {
      const tokens = el.className.split(/\s+/);
      assert.ok(
        !tokens.some((t) => t.startsWith("line-clamp")),
        `<${el.tag}> must not line-clamp: the full label must always be visible`,
      );
    }
  });

  it("both place-name elements carry the max-height + scroll safety valve", () => {
    for (const el of nameElements) {
      const tokens = el.className.split(/\s+/);
      assert.ok(
        tokens.some((t) => t.startsWith("max-h-")),
        `<${el.tag}> needs a max-height safety valve for pathological names`,
      );
      assert.ok(
        tokens.includes("overflow-y-auto"),
        `<${el.tag}> needs overflow-y-auto with the max-height`,
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

  it("takes an edition prop and renders the edition header", () => {
    assert.ok(
      /edition:\s*Edition/.test(source),
      "QuestionBubble must accept an edition prop",
    );
    assert.ok(
      source.includes("bubbleHeaderText(edition, regionName)"),
      "the header must render bubbleHeaderText(edition, regionName)",
    );
  });
});
