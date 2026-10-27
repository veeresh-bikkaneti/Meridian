import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Place-card collapse redesign (2026-10-11, owner order): the question card
// is COMPACT by default on mobile — it must never take the whole screen.
// The place name IS the question, so it stays visible in every card state;
// only the instructions fold behind the show/hide toggle. (The old design
// hid the name text but kept the card's footprint — the owner's exact
// complaint.)
//
// Regression guard for the "West Cambridge/Harvard Square,..." bug:
// the question bubble must render the FULL question label — never an
// ellipsis. line-clamp-3 (commit 59f0de0) still ellipsized long qualified
// labels, so clamping is structurally wrong now that labels carry
// subdivision/country qualifiers. Names wrap naturally with no scroll
// container (scrollbars render native arrow chrome that overlaps the
// name — see 2026-10-06).
// There is no DOM test infra in this repo, so this test asserts on the
// rendered class contract in the component source; the Playwright E2E
// (tests/e2e/question-wrap.spec.ts + question-card-header.spec.ts +
// tests/e2e/place-card-redesign.mobile.spec.ts) proves it visually.
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "question-bubble.tsx"),
  "utf8",
);
const stylesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles.css"),
  "utf8",
);
const gameAppSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "game-app.tsx"),
  "utf8",
);

// The element that renders the place name as its text content.
// Redesign 2026-10-11: a SINGLE h2, visible in every card state (compact
// and open) — the name is the question and never folds away. Names render
// through <PlaceNameText> (ZWSP display refinement + strict-rule anchor
// tail) with data-name-tier set from the raw label length.
const nameElements = [
  ...source.matchAll(
    /<(h2|p)\b([^>]*?)className="([^"]*)"([^>]*?)>\s*<PlaceNameText name=\{placeName\} \/>/g,
  ),
].map((m) => ({ tag: m[1], className: m[3], attrs: `${m[2]}${m[4]}` }));

describe("question-bubble — full question label, never an ellipsis", () => {
  it("renders exactly one place-name element: the always-visible h2", () => {
    // Redesign: the name stays visible in every card state — there is
    // exactly one name element, never a folded/cloned copy.
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
    assert.equal(tooltips.length, 1, "the h2 keeps title={placeName}");
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

describe("redesign 2026-10-11 — compact card: name stays, instructions fold", () => {
  it("collapsed keeps the name visible: the h2 is outside any hidden gate", () => {
    // The owner's complaint: "Hide place name" hid the text but kept the
    // footprint. The redesign inverts it — the name (the question) never
    // folds; only the instructions do.
    // (aria-hidden on decorative icons doesn't count — only a real
    // `hidden` attribute removes content from AT.)
    assert.ok(
      !/<[^>]*[\s{]hidden[=\s][^>]*>[\s\S]*?<h2\b[^>]*className="place-name qname"/.test(
        source,
      ),
      "no hidden gate may wrap the name h2",
    );
    assert.ok(
      /<h2\b[^>]*className="place-name qname"[^>]*>\s*<PlaceNameText name=\{placeName\} \/>\s*<\/h2>/.test(
        source,
      ),
      "the name h2 renders unconditionally in the card",
    );
  });

  it("the instructions fold: hint paragraph renders only when open", () => {
    // Folded = removed from AT (honest, never clamped). The hint <p>
    // mounts only in the open state, inside its own Enter reveal.
    assert.ok(
      /\{expanded \? \(\s*<Enter[\s\S]*?<p className="bubble-hint">/.test(source),
      "the hint paragraph must mount only when `expanded`",
    );
    assert.ok(
      !source.includes('"Show place name"') &&
        !source.includes('"Hide place name"'),
      "the old Show/Hide place name labels are gone — the name never hides",
    );
  });

  it("the compact region is capped: the card can never fill the screen", () => {
    // Collapsed swaps the region class to pcard-compact; the CSS caps it.
    assert.ok(
      source.includes('"bubble-scroll pcard-compact"'),
      "the collapsed region must take the pcard-compact class",
    );
    const block = /\.bubble-scroll\.pcard-compact\s*\{([\s\S]*?)\}/.exec(
      stylesSource,
    )?.[1];
    assert.ok(block, ".bubble-scroll.pcard-compact CSS must exist");
    assert.ok(
      block.includes("max-height: min(24dvh, 12rem)"),
      "the compact region caps at min(24dvh, 12rem)",
    );
    assert.ok(
      block.includes("min-height: 0"),
      "the compact region drops the open region's max(120px, 20%) floor",
    );
  });

  it("the open region keeps the min(38dvh, 20rem) backstop", () => {
    assert.ok(
      stylesSource.includes("max-height: min(38dvh, 20rem)"),
      "styles.css must cap the shell at min(38dvh, 20rem) (spec §5)",
    );
  });

  it("one scroll region, kept mounted: role, name, tabindex (spec §8.1)", () => {
    // The region stays mounted across expand/collapse so useMoreBelow's
    // ref never goes stale; only its class + content change.
    const region = /<div\b[^>]*ref=\{scrollRef\}[^>]*>/.exec(source)?.[0];
    assert.ok(region, "the scroll region must carry the measurement ref");
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

describe("redesign 2026-10-11 — instructions toggle (spec §5/§8.6)", () => {
  it("the toggle names its consequence: Show/Hide instructions", () => {
    assert.ok(
      /\{expanded \? "Hide instructions" : "Show instructions"\}/.test(source),
      "the toggle must read “Show instructions” / “Hide instructions”",
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
    const block = /\.bubble-toggle\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block, "styles.css must style the toggle");
    assert.ok(block.includes("min-height: 44px"), "toggle min-height 44px");
  });

  it("the toggle wires the runtime path: open ↔ collapsed via onViewChange", () => {
    // The show/hide runtime path: one call, no timers, no chains.
    assert.ok(
      /onClick=\{\(\) => onViewChange\(expanded \? "collapsed" : "open"\)\}/.test(
        source,
      ),
      "the toggle must call onViewChange(expanded ? 'collapsed' : 'open')",
    );
  });

  it("the dismiss X stays 44px (tap target contract)", () => {
    const block = /\.bubble-icon-button\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block, ".bubble-icon-button CSS must exist");
    assert.ok(block.includes("width: 44px"), "dismiss X width 44px");
    assert.ok(block.includes("height: 44px"), "dismiss X height 44px");
  });
});

describe("redesign 2026-10-11 — motion: vendored motionmaxxing curves", () => {
  it("vendors the two curves as .pcard-scoped custom properties (not :root)", () => {
    // motion-tokens.css is not on main (PR #133 open) — the card vendors
    // what it uses locally so the future global import can't collide.
    const block = /\.pcard\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(block, ".pcard scope must exist in styles.css");
    assert.ok(
      block.includes("--pcard-ease-reveal: cubic-bezier(0.16, 1, 0.3, 1)"),
      "--pcard-ease-reveal must equal motionmaxxing --ease-snap-settle",
    );
    assert.ok(
      block.includes("--pcard-ease-exit: cubic-bezier(0.55, 0, 0.85, 0.36)"),
      "--pcard-ease-exit must equal motionmaxxing --ease-accel-exit",
    );
  });

  it("the card wrapper provides the .pcard scope (both card states)", () => {
    const wrappers = source.match(/className="pcard pointer-events-none absolute/g) ?? [];
    assert.equal(
      wrappers.length,
      2,
      "both the card and the dismissed target-button wrappers need the .pcard scope",
    );
  });

  it("the card shell never remounts on toggle: the scroll cue stays live", () => {
    // useMoreBelow's effect observes the region div it mounted with. A
    // key={view} remount would detach that div and freeze the "more below"
    // cue (spec §8.1) — the toggle must swap classes/content in place.
    assert.ok(
      !/key=\{view\}/.test(source),
      "no key={view} remount: the shell (and its scroll region) stay mounted across expand/collapse",
    );
  });

  it("the hint gets its own snap-settle reveal on expand (transform/opacity only)", () => {
    assert.ok(
      /\{expanded \? \(\s*<Enter durationMs=\{250\} reduced=\{reduced\}>/.test(
        source,
      ),
      "the expanding hint must mount inside its own Enter reveal",
    );
    assert.ok(
      /ease-\[var\(--pcard-ease-reveal\)\]/.test(source),
      "Enter must use ease-[var(--pcard-ease-reveal)]",
    );
    // One effect per transition (chained-timer law): the Enter reveal is
    // a single requestAnimationFrame effect — no setTimeout chains.
    assert.ok(
      !/setTimeout/.test(source),
      "question-bubble must not chain timers — one rAF effect per transition",
    );
  });

  it("the chevron rides both curves: snap-settle open, accel-exit shut", () => {
    const openBlock = /\.bubble-toggle svg\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(
      openBlock?.includes("transition-timing-function: var(--pcard-ease-reveal)"),
      "chevron opens on the reveal curve",
    );
    const shutBlock = /\.bubble-toggle\[aria-expanded="false"\] svg\s*\{([\s\S]*?)\}/.exec(
      stylesSource,
    )?.[1];
    assert.ok(
      shutBlock?.includes("transition-timing-function: var(--pcard-ease-exit)"),
      "chevron shuts on the exit curve",
    );
  });

  it("prefers-reduced-motion zeroes the toggle motion (instant, zero animation)", () => {
    // Several reduced-motion blocks exist; at least one must zero the
    // chevron transition.
    const blocks = [
      ...stylesSource.matchAll(
        /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g,
      ),
    ].map((m) => m[1]);
    assert.ok(blocks.length > 0, "reduced-motion guards must exist");
    assert.ok(
      blocks.some(
        (b) => b.includes(".bubble-toggle svg") && b.includes("transition: none"),
      ),
      "the chevron transition must be zeroed under reduced motion",
    );
    // The component's reduced path: opacity-only fade, no transform.
    assert.ok(
      source.includes("usePrefersReducedMotion"),
      "the component must keep its reduced-motion hook",
    );
  });
});

describe("redesign 2026-10-11 — compact default + End-game dock (game-app.tsx)", () => {
  it("defaultBubbleView: collapsed on narrow viewports, open on desktop", () => {
    assert.ok(
      /function defaultBubbleView\(\): BubbleViewState/.test(gameAppSource),
      "game-app must define the defaultBubbleView helper",
    );
    const fn = /function defaultBubbleView\(\): BubbleViewState \{([\s\S]*?)\n\}/.exec(
      gameAppSource,
    )?.[1];
    assert.ok(fn, "the helper body must be readable");
    assert.ok(
      fn.includes("max-width: 40rem"),
      "the helper keys off the 40rem mobile breakpoint",
    );
    assert.ok(
      /return "collapsed"/.test(fn) && /return "open"/.test(fn),
      "narrow → collapsed, wide → open",
    );
  });

  it("the default feeds the initializer, the per-place reset, and replay", () => {
    assert.ok(
      gameAppSource.includes("useState<BubbleViewState>(defaultBubbleView)"),
      "the bubble state must initialize from defaultBubbleView",
    );
    const resets = gameAppSource.match(/setBubble\(defaultBubbleView\(\)\)/g) ?? [];
    assert.ok(
      resets.length >= 2,
      `per-place reset + replay must use defaultBubbleView (found ${resets.length})`,
    );
    assert.ok(
      !gameAppSource.includes('setBubble("open")'),
      'no hard-coded setBubble("open") may remain',
    );
  });

  it("the BubbleViewState contract is unchanged (open|collapsed|dismissed)", () => {
    assert.ok(
      source.includes('export type BubbleViewState = "open" | "collapsed" | "dismissed"'),
      "the contract type must be untouched",
    );
    assert.ok(
      /import \{ QuestionBubble, type BubbleViewState \}/.test(gameAppSource),
      "game-app must keep importing the contract",
    );
  });

  it("End game docks bottom-right during aim: clear of the card, 44px target", () => {
    const btn = /<button\b[^>]*onClick=\{onEndGame\}[^>]*>/.exec(gameAppSource)?.[0];
    assert.ok(btn, "an End game button must exist");
    const tags =
      gameAppSource.match(/<button\b[^>]*onClick=\{onEndGame\}[^>]*>/g) ?? [];
    assert.strictEqual(
      tags.length,
      2,
      `exactly two End game buttons: the aim dock + the story/done score-stack pill (found ${tags.length})`,
    );
    // 2026-10-19: the aim End-game now lives inside the bottom-right dock
    // div (with the hint cluster stacked above it) — the dock carries the
    // absolute positioning, the button keeps the 44px target.
    const dockDiv = /<div\b[^>]*data-testid="aim-dock"[^>]*>/.exec(gameAppSource)?.[0];
    assert.ok(dockDiv, "the aim dock div must exist");
    assert.ok(
      dockDiv.includes("absolute right-3"),
      "the dock must be bottom-right",
    );
    assert.ok(
      dockDiv.includes("bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]"),
      "the dock must clear the drop-pin lane + safe area",
    );
    const dockBtn = tags.find((t) => t.includes('data-testid="end-game-button"'));
    assert.ok(dockBtn, "the docked End game button must exist");
    assert.ok(
      dockBtn.includes("min-h-[44px]"),
      "the docked End game must be a 44px tap target",
    );
    const pill = tags.find((t) => !t.includes('data-testid="end-game-button"'));
    assert.ok(pill, "one End game button must be the score-stack pill");
    assert.ok(
      pill.includes("rounded-md") && pill.includes("px-3 py-1.5 text-xs"),
      "the score-stack pill keeps its pre-redesign slot classes",
    );
    assert.ok(
      /\{run\.phase === "aim" \? \(\s*<div\b[^>]*data-testid="aim-dock"/.test(
        gameAppSource,
      ),
      "the dock must render only during the aim phase",
    );
  });

  it("End game never floats over the result sheet: score-stack pill is story/done only, never summary", () => {
    // 2026-10-19: the aim End-game moved into the aim-dock div; match both
    // the dock div and the score-stack button gatings.
    const dockGate = /\{run\.phase === "aim" \? \(\s*<div\b[^>]*data-testid="aim-dock"/.test(
      gameAppSource,
    );
    const pillGates = [
      ...gameAppSource.matchAll(
        /\{([^}]*run\.phase[^}]*?) \? \(\s*<button\b[^>]*onClick=\{onEndGame\}[^>]*>/g,
      ),
    ].map((m) => m[1]);
    assert.ok(dockGate, "the aim dock must be aim-phase gated");
    assert.strictEqual(
      pillGates.length,
      1,
      `the score-stack pill must be phase-gated (found ${pillGates.length})`,
    );
    const conditions = ['run.phase === "aim"', ...pillGates];
    assert.ok(
      conditions.includes('run.phase === "story" || run.phase === "done"'),
      "the score-stack pill is story/done only",
    );
    assert.ok(
      conditions.every((c) => !c.includes("summary")),
      "no End game button may render in the summary phase",
    );
  });
});

// ---- Cartographer's Plate PR1: the wrap-foundation gate covers ALL FOUR
// name surfaces, not just the question bubble. Still no DOM test infra in
// this repo, so these tests assert the rendered class contract in component
// source plus the .place-name utility contract in styles.css; the Playwright
// E2E (tests/e2e/longname-wrap.spec.ts) proves it visually against the real
// longest-name fixtures from the spec §11.

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
    // Wrapping-spec adoption: the answer heading is a <BoundedText
    // as="h2" variant="place"> — the emitted <h2> carries the
    // place-name wrap utility (asserted on the call site).
    const className = classOfTag(
      resultCardSource,
      /<BoundedText\s+as="h2"\s+variant="place"[^>]*>\s*<PlaceNameText name=\{placeLabel\} \/>/,
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
    // Wrapping-spec adoption: the ledger names are <BoundedText as="dd"
    // variant="place"> — the emitted <dd> carries the place-name wrap
    // utility (asserted on the call site).
    const truespotClass = classOfTag(
      resultCardSource,
      /<BoundedText\s+as="dd"\s+variant="place"[^>]*className="place-name truespot-name"[^>]*>/,
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

describe("globe-overlap fix (2026-10-26) — auto-collapse after round 1, no false scroll cue, compact geometry", () => {
  it("auto-collapses instructions after the first placed pin or manual collapse, and resets on replay", () => {
    assert.ok(
      gameAppSource.includes("const userCollapsedBubbleRef = useRef(false);"),
      "PlayLoaded must track manual instruction collapse in userCollapsedBubbleRef",
    );
    assert.ok(
      /setBubble\(defaultBubbleView\(\)\);\s*if\s*\(\s*run\.results\.length > 0 \|\|\s*\(session\?\.placesPlayed \?\? 0\) > 0 \|\|\s*userCollapsedBubbleRef\.current\s*\)\s*\{\s*setBubble\("collapsed"\);\s*\}/.test(
        gameAppSource,
      ),
      "advancing to the next place must collapse instructions once 1+ pins are placed or after manual collapse",
    );
    assert.ok(
      /userCollapsedBubbleRef\.current = next !== "open";\s*setBubble\(next\);/.test(
        gameAppSource,
      ),
      "onViewChange must record manual collapse/expand in userCollapsedBubbleRef",
    );
    assert.ok(
      /userCollapsedBubbleRef\.current = false;\s*setBubble\(defaultBubbleView\(\)\);/.test(
        gameAppSource,
      ),
      "onReplay must reset userCollapsedBubbleRef before re-initializing bubble view",
    );
  });

  it("eliminates false 'more below' scroll cue on short/medium names by reserving deep bottom padding for long-tier names", () => {
    const scrollBlock = /\.bubble-scroll\s*\{([\s\S]*?)\}/.exec(stylesSource)?.[1];
    assert.ok(scrollBlock, ".bubble-scroll CSS block must exist");
    assert.ok(
      scrollBlock.includes("padding: 2px 2px 4px"),
      ".bubble-scroll must use tight padding (2px 2px 4px) so short/medium names do not overflow the 120px min-height",
    );
    assert.ok(
      !scrollBlock.includes("30px"),
      ".bubble-scroll must not apply 30px bottom padding to short/medium names",
    );
    const longScrollBlock =
      /\.bubble-shell\[data-name-tier="long"\] \.bubble-scroll:not\(\.pcard-compact\)\s*\{([\s\S]*?)\}/.exec(
        stylesSource,
      )?.[1];
    assert.ok(
      longScrollBlock && longScrollBlock.includes("padding-bottom: 28px"),
      "long-tier open scroll region keeps 28px bottom padding for the scroll-cue fade",
    );
  });

  it("uses compact top offset (3.5rem on <640px mobile, 3.625rem on >=640px), compact 236px/248px width cap, and single-row streak+placed HUD", () => {
    const responsiveTopMatches =
      source.match(
        /top-\[max\(3\.5rem,env\(safe-area-inset-top\)\)\] sm:top-\[max\(3\.625rem,env\(safe-area-inset-top\)\)\]/g,
      ) ?? [];
    assert.equal(
      responsiveTopMatches.length,
      2,
      "both QuestionBubble wrappers must sit at 3.5rem on <640px mobile and 3.625rem on >=640px viewports",
    );
    assert.ok(
      source.includes("w-[min(236px,calc(100vw-20px))] sm:w-[248px]"),
      "the open/collapsed card wrapper must cap width at 236px on mobile and 248px on >=640px",
    );
    assert.ok(
      !source.includes("352px"),
      "old 352px width must be gone",
    );
    assert.ok(
      /<div className="flex items-center gap-1\.5">[\s\S]*?data-testid="streak-flame"[\s\S]*?\{session\?\.hits \?\? run\.hits\} placed[\s\S]*?<\/div>/.test(
        gameAppSource,
      ),
      "streak-flame and placed pill must share a horizontal flex row so streak >= 2 never adds a 3rd vertical HUD row",
    );
  });
});
