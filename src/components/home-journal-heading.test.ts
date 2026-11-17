/**
 * Item 42 (PR #522): the journal title lives in exactly one place.
 *
 * The home page used to print "What the land remembers" twice — once as
 * the teaser card's own <h2> and once as the journal section's heading.
 * Item 42 removed the teaser card's copy: the card is named by its
 * "Latest Journal Entry" label and "Now showing" line, and the section
 * below carries the one heading. The grownups-privacy-contact e2e spec
 * clicks through this structure (its step 2 clicks the teaser card's
 * intro line, not a heading), so pin the structure here where a copy
 * edit breaks a fast unit test instead of an e2e wait.
 *
 * Same source-pinning style as card-film.test.ts (this repo has no
 * React-render harness). Red on main: main's teaser card still carries
 * the second <h2>What the land remembers</h2>.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameApp = readFileSync(join(here, "game-app.tsx"), "utf8");

// Anchor on the JSX tags themselves — the bare testids also appear in
// effect code earlier in the file (the item-42 IntersectionObserver).
const cardStart = gameApp.indexOf('<article className="hv5-card hv5-spot hv5-journal');
const cardEnd = gameApp.indexOf('<article id="home-grownups"');
const teaserCard = gameApp.slice(cardStart, cardEnd);
const sectionStart = gameApp.indexOf('<section id="home-journal"');

describe("journal heading — one title, carried by the section (item 42)", () => {
  it("the whole page renders exactly one \"What the land remembers\" heading", () => {
    const matches = gameApp.match(/<h2[^>]*>What the land remembers<\/h2>/g) ?? [];
    assert.equal(matches.length, 1, `expected 1 journal heading, found ${matches.length}`);
  });

  it("the one heading is the journal section's, wired to its aria-labelledby", () => {
    assert.ok(sectionStart > -1, "journal section exists");
    const section = gameApp.slice(sectionStart, sectionStart + 400);
    assert.ok(section.includes('aria-labelledby="journal-title"'), "section names its heading");
    assert.ok(
      section.includes('<h2 id="journal-title">What the land remembers</h2>'),
      "the section carries the heading",
    );
  });

  it("the teaser card has no heading of its own — label and intro line name it", () => {
    assert.ok(cardStart > -1 && cardEnd > cardStart, "teaser card exists");
    assert.ok(!teaserCard.includes("<h2"), "teaser card renders no <h2>");
    assert.ok(teaserCard.includes("Latest Journal Entry"), "card label present");
    // The e2e spec's click target: the card's intro line.
    assert.ok(
      teaserCard.includes("Short field stories from the places on the map"),
      "card intro line present (e2e click target)",
    );
  });
});
