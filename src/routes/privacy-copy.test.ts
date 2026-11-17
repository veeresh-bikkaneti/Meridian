/**
 * Item 39 (PR #522): the Privacy page must not claim we never ask
 * about age — the game does ask for an age band.
 *
 * The old short-version line listed "age" among the things never
 * asked, which was false: the age band picks the difficulty and the
 * cases a player sees. The corrected line says so, and says the band
 * stays in this browser and is never sent to us. Reverting the
 * privacy copy (restoring the old line or dropping the age-band
 * sentence) turns this test red; before it existed, that revert
 * turned nothing red.
 *
 * NOTE: the age-band sentence itself is awaiting the owner's
 * explicit sign-off (see docs/branch-status/fix-ui-copy-sweep-v2.md).
 * This test pins the copy as written on the branch; if the owner
 * edits the sentence, update the pin with the approved wording.
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
const privacy = readFileSync(join(here, "privacy.tsx"), "utf8");

describe("privacy copy — the age band is disclosed (item 39)", () => {
  it("the short version no longer claims age is never asked", () => {
    assert.ok(
      !privacy.includes("name, email, age, location"),
      "the old false claim (age among the never-asked) is gone",
    );
  });

  it("the age-band sentence is present, word for word", () => {
    assert.ok(
      privacy.includes(
        "We do ask for an age band (7-10, 10-18, or 18+). The band is saved only in this browser, and the game uses it to pick the difficulty and the cases the player sees. It is never sent to us.",
      ),
      "the age-band disclosure reads exactly as written for sign-off",
    );
  });
});
