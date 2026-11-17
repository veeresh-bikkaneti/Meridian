/**
 * Item 41 (PR #522): the Contact page shows the gate's skeleton while
 * the lazy grown-up-check chunk loads — never a blank page.
 *
 * Pins GateSkeleton in contact.tsx (its shape, its aria-busy state,
 * and its wiring as the Suspense fallback for the lazy GrownUpGate)
 * plus the .agep-skeleton styles it renders with. Reverting the
 * skeleton (deleting GateSkeleton, pointing the fallback elsewhere,
 * or dropping the styles) turns this test red; before it existed,
 * that revert turned nothing red.
 *
 * Same source-pinning style as home-journal-heading.test.ts (this
 * repo has no React-render harness).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contact = readFileSync(join(here, "contact.tsx"), "utf8");
const ageProfileCss = readFileSync(
  join(here, "..", "components", "age-profile", "age-profile.css"),
  "utf8",
);

describe("contact gate skeleton (item 41)", () => {
  it("GateSkeleton renders the gate's shape with an aria-busy loading state", () => {
    assert.ok(contact.includes("function GateSkeleton()"), "GateSkeleton exists");
    assert.ok(
      contact.includes('aria-busy="true" aria-label="Loading the grown-up check"'),
      "the skeleton announces the wait",
    );
    for (const bar of ["agep-skeleton-title", "agep-skeleton-box"]) {
      assert.ok(contact.includes(`agep-skeleton ${bar}`), `skeleton bar ${bar} rendered`);
    }
    const lines = contact.match(/agep-skeleton agep-skeleton-line/g) ?? [];
    assert.equal(lines.length, 2, "two skeleton text lines");
  });

  it("the skeleton is the Suspense fallback for the lazy grown-up gate", () => {
    assert.ok(
      contact.includes("<Suspense fallback={<GateSkeleton />}>"),
      "the lazy gate's fallback is the skeleton, not a blank or a splash",
    );
  });

  it("the skeleton bars have styles in the shared age-profile sheet", () => {
    assert.ok(ageProfileCss.includes(".agep-skeleton {"), "skeleton base style defined");
    assert.ok(ageProfileCss.includes(".agep-skeleton-box {"), "skeleton box style defined");
  });
});
