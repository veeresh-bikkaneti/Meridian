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

// The element that renders the place name as its text content.
// Cartographer's Plate PR3: a SINGLE h2 (the collapsed view folds the
// name away entirely — honest, never clamped). Names render through
// <PlaceNameText> (ZWSP display refinement + strict-rule anchor tail)
// with data-name-tier set from the raw label length.
const nameElements = [
  ...source.matchAll(
    /<(h2|p)\b([^>]*?)className="([^"]*)"([^>]*?)>\s*<PlaceNameText name=\{placeName\} \/>/g,
  ),
].map((m) => ({ tag: m[1], className: m[3], attrs: `${m[2]}${m[4]}` }));

describe("question-bubble — full question label, never an ellipsis", () => {
  it("renders exactly one place-name element: the expanded h2", () => {
    // PR3: collapsed folds the name away entirely (hidden panel) — there
    // is no collapsed <p> anymore.
    assert.equal(nameElements.length, 1, "one name element only");
    assert.equal(nameElements[0]!.tag, "h2");
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

  it("the name element itself is not a scroll container (no scrollbar chrome)", () => {
    // PR #77 (Veeresh's will): scrollbar arrows overlap the name. The
    // SCROLL REGION wrapper scrolls; the h2 never does.
    for (const el of nameElements) {
      const tokens = el.className.split(/\s+/);
      assert.ok(
        !tokens.includes("overflow-y-auto") &&
          !tokens.includes("overflow-y-scroll"),
        `<${el.tag}> must not scroll — the region wrapper scrolls instead`,
      );
    }
  });

  it("keeps the full-name tooltip", () => {
    const tooltips = source.match(/title=\{placeName\}/g) ?? [];
    assert.equal(tooltips.length, 1, "the expanded h2 keeps title={placeName}");
  });

  it("sets data-name-tier from the raw label length (spec §2)", () => {
    for (const el of nameElements) {
      assert.ok(
        /data-name-tier=\{nameTier\(placeName\)\}/.test(el.attrs),
        `<${el.tag}> must set data-name-tier={nameTier(placeName)} — the React→CSS bridge`,
      );
    }
    // The shell carries the tier too: spec §6.1 chrome compaction
    // (14px → 12px) keys off the same bridge.
    assert.ok(
      /<div\b[^>]*className="[^"]*bubble-shell[^"]*"[^>]*data-name-tier=\{nameTier\(placeName\)\}/.test(
        source,
      ),
      "the bubble shell must carry data-name-tier for the §6.1 yield compaction",
    );
  });

  it("drops tabIndex and aria-label from the static name element (spec §5/§8.3)", () => {
    // Tab-stop fatigue: SRs get the full text anyway with zero ellipsis.
    // Keyboard reachability lives on the scroll REGION wrapper (§8.1).
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
      /<div className="name-meta bubble-meta">/.test(source),
      "the question card needs the pinned meta band (bubble-meta)",
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

describe("question-bubble PR3 — backstop scroll architecture (spec §5)", () => {
  it("name + hint form ONE scroll region: role, name, tabindex (spec §8.1)", () => {
    assert.ok(
      /<div\b[^>]*className="bubble-scroll"[^>]*>/.test(source),
      "the backstop needs the .bubble-scroll region",
    );
    const region = /<div\b[^>]*className="bubble-scroll"[^>]*>/.exec(source)![0];
    assert.ok(
      region.includes('role="region"'),
      "the scroll region needs role=\"region\"",
    );
    assert.ok(
      region.includes('aria-label="Place name — scroll for more"'),
      "the scroll region needs its accessible name",
    );
    assert.ok(
      region.includes("tabIndex={0}"),
      "the scroll region needs tabindex=\"0\" — keyboard users must reach it",
    );
  });

  it("the scroll cue is wired: useMoreBelow + ScrollCue (spec §5/§8.1)", () => {
    assert.ok(
      source.includes('} from "@/components/scroll-cue"'),
      "the bubble must use the shared scroll-cue module",
    );
    assert.ok(
      /const \{ ref: scrollRef, moreBelow \} = useMoreBelow<HTMLDivElement>\(\);/.test(
        source,
      ),
      "the bubble must track the more-below state",
    );
    assert.ok(
      source.includes("<ScrollCue visible={moreBelow} />"),
      "the fade + ⋯ + \"more below\" cue renders from the more-below state",
    );
    // The region carries the ref the hook measures.
    const region = /<div\b[^>]*className="bubble-scroll"[^>]*>/.exec(source)![0];
    assert.ok(
      region.includes("ref={scrollRef}"),
      "the scroll region must carry the measurement ref",
    );
  });

  it("the shell caps the backstop at min(38dvh, 20rem)", () => {
    assert.ok(
      source.includes("bubble-shell"),
      "the bubble needs the .bubble-shell backstop container",
    );
    assert.ok(
      stylesSource.includes("max-height: min(38dvh, 20rem)"),
      "styles.css must cap the shell at min(38dvh, 20rem) (spec §5)",
    );
  });

  it("the scroll region visually hides its scrollbar (PR #77 — Veeresh's will)", () => {
    assert.ok(
      stylesSource.includes(".bubble-scroll::-webkit-scrollbar"),
      "webkit scrollbar must be hidden on the bubble scroll region",
    );
    assert.ok(
      /\.bubble-scroll,\s*\n\.result-body,/.test(stylesSource) &&
        stylesSource.includes("scrollbar-width: none"),
      "scrollbar-width: none must cover the PR3 scroll regions",
    );
  });
});

describe("question-bubble PR3 — collapse toggle (spec §5/§8.6)", () => {
  it("the toggle names its consequence: Show/Hide place name", () => {
    assert.ok(
      source.includes('"Show place name"') || source.includes(">Show place name<") ||
        /\{expanded \? "Hide place name" : "Show place name"\}/.test(source),
      "the toggle must read “Show place name” / “Hide place name”",
    );
    assert.ok(
      !source.includes("Collapse question") && !source.includes("Expand question"),
      "the old Collapse/Expand question labels are gone",
    );
  });

  it("the toggle exposes aria-expanded and is full-width, 44px minimum", () => {
    assert.ok(
      /<button\b[^>]*className="bubble-toggle"[^>]*>/.test(source),
      "the toggle needs the .bubble-toggle class",
    );
    const toggle = /<button\b[^>]*className="bubble-toggle"[^>]*>/.exec(source)![0];
    assert.ok(
      toggle.includes("aria-expanded={expanded}"),
      "the toggle must expose aria-expanded",
    );
    assert.ok(
      stylesSource.includes(".bubble-toggle"),
      "styles.css must style the toggle",
    );
    const block = /\.bubble-toggle\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block && block.includes("min-height: 44px"), "toggle min-height 44px");
  });

  it("collapsed folds the name away entirely: the panel uses hidden", () => {
    // Honest, never clamped: the folded panel uses `hidden` (removed
    // from AT) — there is no collapsed name element anymore.
    assert.ok(
      /<div className="scroll-cue-wrap bubble-scroll-wrap" hidden=\{!expanded\}>/.test(
        source,
      ),
      "the name+hint panel must fold away with hidden when collapsed",
    );
    assert.ok(
      stylesSource.includes(".scroll-cue-wrap[hidden]"),
      "styles.css must keep [hidden] authoritative over the wrapper display",
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
      /<dd\b[^>]*>\s*<PlaceNameText\s+name=\{\s*run\.edition === "globe" && pinCompare\?\.kind === "named"\s*\?\s*pinCompare\.truth\s*:\s*placeLabel\s*\}\s*\/>/,
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

describe("cartographer's plate PR3 — GeoDetective scroll architecture (LoopScreen.tsx)", () => {
  it("the guess list scrolls as one named region; rows never scroll (spec §5)", () => {
    assert.ok(
      loopScreenSource.includes("function GuessListScroll"),
      "the guess list needs its scroll-region wrapper",
    );
    assert.ok(
      loopScreenSource.includes('aria-label="Guess list — scroll for more"'),
      "the guess-list region must be named per spec §8.1",
    );
    assert.ok(
      /className="loop-guess-scroll"[\s\S]{0,200}?role="region"/.test(loopScreenSource) ||
        /role="region"[\s\S]{0,200}?className="loop-guess-scroll"/.test(loopScreenSource),
      "the guess-list region needs role=\"region\"",
    );
    assert.ok(
      stylesSource.includes(".loop-guess-scroll"),
      "styles.css must style the guess-list region",
    );
    // The standalone .loop-guess-scroll rule (not the shared scrollbar
    // group): match the rule whose block carries max-height.
    const ruleMatch = /\.loop-guess-scroll\s*\{[^}]*max-height:[^}]*\}/.exec(
      stylesSource,
    );
    assert.ok(ruleMatch, ".loop-guess-scroll CSS rule must exist");
    assert.ok(
      ruleMatch[0].includes("max-height: 40dvh"),
      "the guess LIST scrolls at max-h 40dvh (spec §5)",
    );
    assert.ok(
      ruleMatch[0].includes("overflow-y: auto"),
      "the guess list scrolls",
    );
    // Rows never scroll: no overflow on the dossier rows themselves.
    assert.ok(
      !/\.dossier-row\s*\{[^}]*overflow/.test(stylesSource),
      "dossier rows must never scroll — only the list does",
    );
  });

  it("the bottom sheet pins its 48px dismiss header (spec §5)", () => {
    assert.ok(
      loopScreenSource.includes("sheet-header"),
      "the sheet header needs the .sheet-header class",
    );
    const block = /\.sheet-header\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block && block.includes("min-height: 48px"), "sheet header min-height 48px");
    // Detents + overscroll containment survive PR3.
    assert.ok(
      loopScreenSource.includes("min(85dvh, 36rem)") &&
        loopScreenSource.includes("min(45dvh, 20rem)"),
      "the sheet keeps its half/full detents",
    );
    assert.ok(
      loopScreenSource.includes('overscrollBehavior: "contain"'),
      "the sheet keeps overscroll-behavior: contain",
    );
    assert.ok(
      loopScreenSource.includes("size-12"),
      "the dismiss button stays 48px (size-12)",
    );
  });

  it("the loop reveal is a three-zone card: pinned header / body / CTA", () => {
    assert.ok(
      loopScreenSource.includes("loop-reveal-header"),
      "zone 1: pinned header",
    );
    assert.ok(
      loopScreenSource.includes("loop-reveal-cta"),
      "zone 3: pinned CTA",
    );
    assert.ok(
      loopScreenSource.includes('aria-label="Case file — scroll for more"'),
      "zone 2: the body region must be named per spec §8.1",
    );
    assert.ok(
      loopScreenSource.includes("🔎 Next mystery"),
      "the pinned CTA keeps the next-mystery retention hook",
    );
    const ctaBlock = /\.loop-reveal-cta\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(ctaBlock, ".loop-reveal-cta CSS must exist");
    assert.ok(
      ctaBlock.includes("flex-shrink: 0"),
      "the CTA zone is pinned (flex-shrink: 0)",
    );
    assert.ok(
      ctaBlock.includes("var(--game-chrome-solid)"),
      "the CTA zone uses the solid chrome bg (spec §5)",
    );
  });

  it("clue-history rows compact to summaries; full text stays in the DOM (spec §5)", () => {
    assert.ok(
      loopScreenSource.includes("clue-history-toggle"),
      "summary rows need the toggle",
    );
    const toggle = /<button\b[^>]*className="clue-history-toggle"[^>]*>/.exec(
      loopScreenSource,
    )?.[0];
    assert.ok(toggle, "the summary row toggle must exist");
    assert.ok(
      toggle.includes("aria-expanded={open}"),
      "the toggle must expose aria-expanded",
    );
    assert.ok(
      toggle.includes('data-testid={`clue-history-row-${index + 1}`}'),
      "summary rows keep a stable testid",
    );
    // The full clue text stays in the DOM, expanded on tap.
    assert.ok(
      loopScreenSource.includes("<p className=\"text-sm text-fg\">{clue.clues[index]}</p>"),
      "the full clue text stays in the DOM inside the expandable panel",
    );
    assert.ok(
      /<div hidden=\{!open\} className="clue-history-body">/.test(loopScreenSource),
      "the collapsed panel uses hidden (removed from AT until expanded)",
    );
    // The summary shows only the tier label + clue number.
    assert.ok(
      loopScreenSource.includes("Clue {index + 1} · {tier}"),
      "the summary row shows only the clue-tier label and clue number",
    );
    const toggleBlock = /\.clue-history-toggle\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(
      toggleBlock && toggleBlock.includes("min-height: 48px"),
      "summary-row toggles keep the 48px motor minimum (§8.10)",
    );
  });

  it("no italics on any PR3 surface (spec §8.9)", () => {
    for (const [label, src] of [
      ["question-bubble", source],
      ["result-card", resultCardSource],
      ["LoopScreen", loopScreenSource],
    ] as const) {
      assert.ok(
        !/font-style:\s*italic/.test(src) && !/italic['"]/.test(src),
        `${label} must not use italics`,
      );
    }
  });

  it("200%-zoom caps exist in CSS (spec §8.7)", () => {
    assert.ok(
      stylesSource.includes("max-height: 30%"),
      "the meta band is capped at 30% of the card height",
    );
    const mins = stylesSource.match(/min-height: max\(120px, 20%\)/g) ?? [];
    assert.ok(
      mins.length >= 3,
      `scroll regions keep ≥ max(120px, 20%) — found ${mins.length}, want ≥3 (bubble, result body, loop body)`,
    );
  });

  it("focus contract exists in CSS (spec §8.2)", () => {
    assert.ok(
      stylesSource.includes("outline: 2px solid var(--atlas-brass-text)"),
      "the ≥2px --atlas-brass-text focus ring must exist",
    );
    assert.ok(
      stylesSource.includes("outline-offset: 2px"),
      "the focus ring needs its 2px offset",
    );
    assert.ok(
      stylesSource.includes("scroll-margin:"),
      ":focus-visible needs scroll-margin so focus never lands under the fade",
    );
  });
});
