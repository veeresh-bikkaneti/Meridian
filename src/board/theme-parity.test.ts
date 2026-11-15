import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Theme parity (owner correction, 2026-11-15): the board must speak
 * the homepage's design language. The homepage tokens live scoped
 * under .home-v5 in src/components/home-v5.css; the board re-declares
 * them under .board-v3 in src/board/board.css. This test parses BOTH
 * files and fails if any shared token's value drifts — parity is a
 * check, not a hope. If the homepage language changes, this test is
 * the alarm.
 */
const SHARED_TOKENS = [
  "--hv5-parchment",
  "--hv5-card",
  "--hv5-ink",
  "--hv5-ink-soft",
  "--hv5-brown",
  "--hv5-brown-deep",
  "--hv5-forest",
  "--hv5-forest-deep",
  "--hv5-sage",
  "--hv5-line",
  "--hv5-line-warm",
  "--hv5-ease",
  "--hv5-shadow-card",
  "--hv5-shadow-lift",
  "--hv5-display",
  "--hv5-body",
];

function tokensUnder(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} block not found`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const block = css.slice(open, close);
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

describe("theme parity — board v3 vs the homepage (home-v5)", () => {
  const home = tokensUnder(
    readFileSync(new URL("../components/home-v5.css", import.meta.url), "utf8"),
    ".home-v5 {",
  );
  const board = tokensUnder(readFileSync(new URL("./board.css", import.meta.url), "utf8"), ".board-v3 {");

  it("every shared token exists on the homepage", () => {
    for (const t of SHARED_TOKENS) assert.ok(home.has(t), `homepage is missing ${t}`);
  });
  it("every shared token on the board matches the homepage value exactly", () => {
    for (const t of SHARED_TOKENS) {
      assert.ok(board.has(t), `board is missing ${t}`);
      assert.equal(board.get(t), home.get(t), `${t} drifted from the homepage`);
    }
  });
  it("board v3 surfaces consume the tokens, not hardcoded hexes", () => {
    const css = readFileSync(new URL("./board.css", import.meta.url), "utf8");
    const v3 = css.slice(css.indexOf("BOARD V3"));
    assert.ok(v3.includes("var(--hv5-card)"), "cards must use the homepage card token");
    assert.ok(v3.includes("var(--hv5-parchment)"), "ground must use the homepage parchment token");
    assert.ok(v3.includes("var(--font-atlas-display)") || v3.includes("var(--hv5-display)"), "display type must come from a token");
  });
});
