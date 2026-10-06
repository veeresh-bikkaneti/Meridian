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
// Cartographer's Plate PR2: names render through <PlaceNameText>
// (ZWSP display refinement + strict-rule anchor tail) with data-name-tier
// set from the raw label length.
const nameElements = [
  ...source.matchAll(
    /<(h2|p)\b([^>]*?)className="([^"]*)"([^>]*?)>\s*<PlaceNameText name=\{placeName\} \/>/g,
  ),
].map((m) => ({ tag: m[1], className: m[3], attrs: `${m[2]}${m[4]}` }));

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

  it("sets data-name-tier from the raw label length on both views (spec §2)", () => {
    for (const el of nameElements) {
      assert.ok(
        /data-name-tier=\{nameTier\(placeName\)\}/.test(el.attrs),
        `<${el.tag}> must set data-name-tier={nameTier(placeName)} — the React→CSS bridge`,
      );
    }
  });

  it("drops tabIndex and aria-label from static name elements (spec §5/§8.3)", () => {
    // Tab-stop fatigue: SRs get the full text anyway with zero ellipsis.
    // (PR3 restores keyboard reachability on the scroll REGION wrapper.)
    for (const el of nameElements) {
      assert.ok(
        !/tabIndex/.test(el.attrs),
        `<${el.tag}> must not carry tabIndex — dropped per spec §5`,
      );
      assert.ok(
        !/aria-label/.test(el.attrs),
        `<${el.tag}> must not carry aria-label — visible text == accessible name (§8.3)`,
      );
    }
  });

  it("meta band locks the difficulty chip: never compacts, never leaves", () => {
    // The chip lives in the pinned meta band (spec §6.4) — same size,
    // label, and position at every tier; never shrinks below 11px.
    assert.ok(
      /<div className="name-meta">/.test(source),
      "the question card needs the pinned meta band",
    );
    const chip = /<span\b[^>]*data-testid="difficulty-chip"[^>]*>/.exec(source);
    assert.ok(chip, "the difficulty-chip E2E seam must survive, never renamed");
    assert.ok(
      chip[0].includes('className="difficulty-chip"'),
      "the chip uses the locked .difficulty-chip class (11px floor, nowrap, flex-shrink: 0)",
    );
    assert.ok(
      !/difficulty-chip"[^>]*style=/.test(source),
      "the chip must not take inline size overrides",
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
      /<h2\b[^>]*>\s*<PlaceNameText name=\{placeLabel\} \/>/,
      "result-card answer h2",
    );
    assertNameContract("result-card answer h2", className);
  });

  it("pin-compare ledger is a real <dl>: full names, never an ellipsis", () => {
    // Cartographer's Plate PR2: the compounding text line becomes a real
    // <dl> with stacked YOUR PIN / TRUE SPOT entries.
    const dlMatch = /<dl\b[^>]*data-testid="pin-compare-line"[^>]*>/.exec(resultCardSource);
    assert.ok(dlMatch, 'result-card must render <dl data-testid="pin-compare-line">');
    assert.ok(
      resultCardSource.includes("<dt>Your pin</dt>"),
      "YOUR PIN eyebrow stacks above its name",
    );
    assert.ok(
      resultCardSource.includes("True spot"),
      "TRUE SPOT eyebrow stacks above its name",
    );
    const truespotClass = classOfTag(
      resultCardSource,
      /<dd\b[^>]*>\s*<PlaceNameText name=\{placeLabel\} \/>/,
      "ledger TRUE SPOT dd",
    );
    assertNameContract("ledger TRUE SPOT dd", truespotClass);
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

describe("cartographer's plate PR2 — dossier guess rows (LoopScreen.tsx)", () => {
  it("guess rows are dossier rows: grid, brass number, unlimited-line name", () => {
    const className = classOfTag(
      loopScreenSource,
      /<span\b[^>]*>\s*<PlaceNameText name=\{g\.name\} \/>/,
      "dossier name span",
    );
    assertNameContract("dossier name span", className);
    assert.ok(
      !/\btruncate\b/.test(loopScreenSource),
      "LoopScreen.tsx must contain ZERO truncate — the one hard truncation is deleted",
    );
    // Row: grid 1fr auto, dossier number, name, right column.
    assert.ok(
      loopScreenSource.includes('className="dossier-row border border-line bg-surface"'),
      "guess rows use the dossier-row grid (1fr auto), keeping the existing border/bg",
    );
    assert.ok(
      loopScreenSource.includes("dossier-num"),
      "each row carries the brass dossier number",
    );
    assert.ok(
      loopScreenSource.includes("first-guess-tag"),
      "row 1 gets the FIRST GUESS tag — never a trend",
    );
    assert.ok(
      loopScreenSource.includes("dossier-trend"),
      "rows 2+ get the WARMER/COLDER trend word",
    );
    assert.ok(
      loopScreenSource.includes("dossier-bearing"),
      "each row carries the bearing arrow + octant label",
    );
    // Single accessible list item: the composed aria-label names the
    // guess, its trend, its distance, and its direction.
    assert.ok(
      /aria-label=\{`Guess \$\{n\}: /.test(loopScreenSource),
      "each row is a single accessible list item with a composed aria-label",
    );
    assert.ok(
      loopScreenSource.includes("title={g.name}"),
      "dossier name span keeps title={g.name}",
    );
  });

  it("bottom-sheet h2 renders the full tapped name, tiered", () => {
    const className = classOfTag(
      loopScreenSource,
      /<h2\b[^>]*>\s*<PlaceNameText name=\{tappedName\} \/>/,
      "bottom-sheet h2",
    );
    assertNameContract("bottom-sheet h2", className);
    assert.ok(
      loopScreenSource.includes("title={tappedName}"),
      "bottom-sheet h2 keeps the full-name title",
    );
  });

  it("loop reveal answer heading renders the full answer, tiered", () => {
    const className = classOfTag(
      loopScreenSource,
      /<h2\b[^>]*className="place-name lrname[^"]*"[^>]*>/,
      "loop reveal answer h2",
    );
    assertNameContract("loop reveal answer h2", className);
    assert.ok(
      loopScreenSource.includes("<PlaceNameText name={answer.name} />"),
      "the loop reveal answer renders through PlaceNameText (ZWSP + anchor tail)",
    );
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
