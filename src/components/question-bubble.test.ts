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
// names wrap naturally with no scroll container (scrollbars render
// native arrow chrome that overlaps the name — see 2026-10-06).
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
        tokens.includes("place-name"),
        `<${el.tag}> must use the .place-name wrap utility (Cartographer's Plate PR1)`,
      );
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

  it("place-name elements are not scroll containers (no scrollbar chrome)", () => {
    for (const el of nameElements) {
      const tokens = el.className.split(/\s+/);
      assert.ok(
        !tokens.includes("overflow-y-auto") &&
          !tokens.includes("overflow-y-scroll"),
        `<${el.tag}> must not scroll — scrollbar arrows overlap the name`,
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

  it("scroll safety valve is keyboard-reachable", () => {
    // max-h + overflow-y-auto creates a scroll region; without tabIndex a
    // keyboard user can't reach a pathological name's tail.
    const tabbed = source.match(/tabIndex=\{0\}/g) ?? [];
    assert.ok(
      tabbed.length >= 2,
      "both place-name scroll regions need tabIndex={0}",
    );
    assert.ok(
      /aria-label=\{`Question: \$\{placeName\}`\}/.test(source),
      "scroll regions need an aria-label naming the question",
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

// ---- Cartographer's Plate PR1: the wrap-foundation gate covers ALL FOUR
// name surfaces, not just the question bubble. Still no DOM test infra in
// this repo, so these tests assert the rendered class contract in component
// source plus the .place-name utility contract in styles.css; the Playwright
// E2E (tests/e2e/longname-wrap.spec.ts) proves it visually against the real
// longest-name fixtures from the spec §11.

const stylesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles.css"),
  "utf8",
);
const resultCardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "result-card.tsx"),
  "utf8",
);
const loopScreenSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../game/loop/LoopScreen.tsx"),
  "utf8",
);

/** className of the first element whose full open tag matches tagRe. */
function classOfTag(source: string, tagRe: RegExp, label: string): string {
  const m = tagRe.exec(source);
  assert.ok(m, `expected to find ${label}`);
  const c = /className="([^"]*)"/.exec(m[0]);
  assert.ok(c, `${label} must have a className`);
  return c[1]!;
}

/**
 * Zero-ellipsis contract: every name element renders the FULL name via the
 * .place-name wrap utility — no single-line truncation, no nowrap, no
 * line-clamp, no ellipsis.
 */
function assertNameContract(label: string, className: string): void {
  const tokens = className.split(/\s+/);
  assert.ok(
    tokens.includes("place-name"),
    `${label} must use the .place-name wrap utility`,
  );
  assert.ok(
    !tokens.includes("truncate"),
    `${label} must not single-line-truncate the place name`,
  );
  assert.ok(
    !tokens.includes("whitespace-nowrap"),
    `${label} must allow wrapping`,
  );
  assert.ok(
    !tokens.some((t) => t.startsWith("line-clamp")),
    `${label} must not line-clamp: the full name must always be visible`,
  );
  assert.ok(
    !tokens.includes("text-ellipsis"),
    `${label} must never ellipsize`,
  );
}

describe("cartographer's plate PR1 — .place-name utility contract", () => {
  it("defines .place-name exactly per spec §3 (no hyphens:auto, no break-all)", () => {
    const block = /\.place-name\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block, ".place-name must exist in src/styles.css");
    for (const decl of [
      "overflow-wrap: break-word",
      "word-break: normal",
      "text-wrap: balance",
      "line-height: 1.28",
    ]) {
      assert.ok(
        block.includes(decl),
        `.place-name must declare \`${decl}\` (spec §3)`,
      );
    }
    assert.ok(
      !/hyphens\s*:\s*auto/.test(block),
      ".place-name must NOT use hyphens: auto (vetoed — no per-name lang metadata)",
    );
    assert.ok(
      !/word-break\s*:\s*break-all/.test(block),
      ".place-name must NOT use word-break: break-all on Latin text (vetoed)",
    );
  });
});

describe("cartographer's plate PR1 — reveal headings (result-card.tsx)", () => {
  it("answer heading renders the full name, never an ellipsis", () => {
    const className = classOfTag(
      resultCardSource,
      /<h2\b[^>]*>\s*\{placeLabel\}/,
      "result-card answer h2",
    );
    assertNameContract("result-card answer h2", className);
  });

  it("pin-compare-line keeps full names, never an ellipsis", () => {
    const className = classOfTag(
      resultCardSource,
      /<p\b[^>]*data-testid="pin-compare-line"[^>]*>/,
      'result-card [data-testid="pin-compare-line"]',
    );
    assertNameContract('result-card [data-testid="pin-compare-line"]', className);
    // E2E seam: the testid must survive the redesign untouched.
    assert.ok(
      resultCardSource.includes('data-testid="pin-compare-line"'),
      "the pin-compare-line E2E seam must not be renamed",
    );
  });

  it("answer heading keeps the full-name tooltip", () => {
    assert.ok(
      resultCardSource.includes("title={placeLabel}"),
      "result-card answer h2 must keep title={placeLabel}",
    );
  });
});

describe("cartographer's plate PR1 — geodetective surfaces (LoopScreen.tsx)", () => {
  it("guess-list name span: the one truncate is gone, full names wrap", () => {
    const className = classOfTag(
      loopScreenSource,
      /<span\b[^>]*>\s*\{g\.name\}\s*<\/span>/,
      "guess-list name span",
    );
    assertNameContract("guess-list name span", className);
    assert.ok(
      !/\btruncate\b/.test(loopScreenSource),
      "LoopScreen.tsx must contain ZERO truncate — the one hard truncation is deleted",
    );
    assert.ok(
      loopScreenSource.includes(
        "flex items-start justify-between gap-3 rounded-xl border border-line bg-surface",
      ),
      "guess row switches items-baseline → items-start so multi-line names top-align with the distance",
    );
    assert.ok(
      loopScreenSource.includes("title={g.name}"),
      "guess-list name span keeps title={g.name}",
    );
  });

  it("bottom-sheet h2 renders the full tapped name", () => {
    const className = classOfTag(
      loopScreenSource,
      /<h2\b[^>]*>\s*\{displayLoopName\(entry\)\}/,
      "bottom-sheet h2",
    );
    assertNameContract("bottom-sheet h2", className);
    assert.ok(
      loopScreenSource.includes("title={displayLoopName(entry)}"),
      "bottom-sheet h2 keeps the full-name title",
    );
  });

  it("loop reveal answer heading renders the full answer", () => {
    const className = classOfTag(
      loopScreenSource,
      /<h2\b[^>]*>\s*\{answer\.name/,
      "loop reveal answer h2",
    );
    assertNameContract("loop reveal answer h2", className);
  });

  it("closest-guess line keeps the full guess name", () => {
    const className = classOfTag(
      loopScreenSource,
      /<p\b[^>]*>\s*Your closest guess was/,
      "closest-guess line",
    );
    assertNameContract("closest-guess line", className);
  });
});
