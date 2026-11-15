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

  it("the grown-ups shell (.grown-page) carries the same homepage values", () => {
    const grown = tokensUnder(
      readFileSync(new URL("../components/grownups/info-page.css", import.meta.url), "utf8"),
      ".grown-page {",
    );
    for (const t of SHARED_TOKENS) {
      assert.ok(grown.has(t), `grown-ups shell is missing ${t}`);
      assert.equal(grown.get(t), home.get(t), `grown-ups ${t} drifted from the homepage`);
    }
  });
});

/**
 * The atlas family (uplift Fix 2, 2026-11-15): the molecular map
 * stage sits in the play screens' dark chart room, so board.css
 * consumes the --atlas-* tokens from src/styles.css. They are
 * consumed by var() reference, never copied into board.css — a
 * single source of truth — and this block pins that arrangement:
 * every token the map uses must exist in styles.css :root with
 * the chart-room value, and the Three.js constants in
 * molecule-map.tsx must carry the same hexes as the tokens.
 */
const ATLAS_TOKENS: Record<string, string> = {
  "--atlas-bg-1": "#10222a",
  "--atlas-bg-2": "#070e12",
  "--atlas-glow": "rgba(232, 182, 76, 0.1)",
  "--atlas-grid": "rgba(232, 182, 76, 0.07)",
  "--atlas-card-line": "rgba(232, 182, 76, 0.22)",
  "--atlas-stamp": "#e86a5c",
  "--atlas-brass": "#e8b64c",
};

describe("theme parity — the map stage's atlas family (src/styles.css)", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const root = tokensUnder(styles, ":root {");
  const boardCss = readFileSync(new URL("./board.css", import.meta.url), "utf8");

  it("every atlas token the board consumes is defined in styles.css :root with the chart-room value", () => {
    for (const [t, v] of Object.entries(ATLAS_TOKENS)) {
      assert.ok(root.has(t), `styles.css :root is missing ${t}`);
      assert.equal(root.get(t), v, `${t} drifted in styles.css`);
    }
  });
  it("board.css consumes the atlas tokens via var(), never copies", () => {
    for (const t of Object.keys(ATLAS_TOKENS)) {
      assert.ok(boardCss.includes(`var(${t})`), `board.css must consume var(${t})`);
    }
  });
  it("the map's Three.js constants carry the token hexes (bonds = --atlas-stamp, halo = --atlas-brass)", () => {
    const map = readFileSync(new URL("./molecule-map.tsx", import.meta.url), "utf8");
    assert.ok(map.includes("0xe86a5c"), "bond colour must be --atlas-stamp (#e86a5c)");
    assert.ok(map.includes("0xe8b64c"), "halo colour must be --atlas-brass (#e8b64c)");
    assert.ok(!map.includes("0xb3543f"), "the pre-uplift bond colour must not return");
    assert.ok(!map.includes("0x8a6d2f"), "the pre-uplift halo colour must not return");
  });
});
