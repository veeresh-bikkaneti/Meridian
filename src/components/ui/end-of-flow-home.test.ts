/**
 * EndOfFlowHome (TD-05.4) renders exactly what HomeButton rendered with
 * the same props — byte-identical HTML through react-dom/server, the
 * repo's node harness. Pinned, per call-site prop shape, to the four
 * LoopScreen/SubjectCase forms and the game-app PR 2 forms. The module
 * must not re-export HomeButton or BrandHomeButton.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeButton } from "./home-button.ts";
import { EndOfFlowHome } from "./end-of-flow-home.ts";

const CASES = [
  {
    name: "LoopScreen reveal CTA (home-button-end, ghost, 48px)",
    props: { onHome: () => {}, testId: "home-button-end", className: "min-h-[48px]" },
  },
  {
    name: "SubjectCase win/lose result card (home-button-end, secondary, full width)",
    props: { onHome: () => {}, testId: "home-button-end", variant: "secondary", className: "w-full rounded-xl" },
  },
  {
    name: "game-app menu (secondary, default testid)",
    props: { onHome: () => {}, variant: "secondary" },
  },
  {
    name: "game-app ReviewComplete (primary, default testid)",
    props: { onHome: () => {}, variant: "primary" },
  },
  {
    name: "game-app ChallengeComplete (primary, challenge-done)",
    props: { onHome: () => {}, variant: "primary", testId: "challenge-done" },
  },
  {
    name: "game-app PlayLoaded HUD (secondary, pointer-events-auto)",
    props: { onHome: () => {}, variant: "secondary", className: "pointer-events-auto" },
  },
] as const;

describe("EndOfFlowHome", () => {
  for (const { name, props } of CASES) {
    it(`${name}: HTML identical to HomeButton with the same props`, () => {
      assert.equal(
        renderToStaticMarkup(createElement(EndOfFlowHome, props)),
        renderToStaticMarkup(createElement(HomeButton, props)),
      );
    });
  }

  it("default testid is the HomeButton default (home-button)", () => {
    assert.match(renderToStaticMarkup(createElement(EndOfFlowHome, { onHome: () => {} })), /data-testid="home-button"/);
  });

  it("exports only EndOfFlowHome — no HomeButton / BrandHomeButton re-export", async () => {
    const mod = await import("./end-of-flow-home.ts");
    assert.deepEqual(Object.keys(mod), ["EndOfFlowHome"]);
    const src = readFileSync(new URL("./end-of-flow-home.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /export\s*\{[^}]*\b(?:HomeButton|BrandHomeButton)\b/);
    assert.doesNotMatch(src, /export\s+(?:const|function|type|class)\s+(?:HomeButton|BrandHomeButton)\b/);
  });
});
