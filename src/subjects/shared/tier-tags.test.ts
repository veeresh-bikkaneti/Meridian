import { it } from "node:test";
import assert from "node:assert/strict";
import { ITEM_GRADE_TAGS, ITEM_TIER_TAGS } from "./tier-tags.ts";
import { mathUnits } from "../math/items.ts";
import { physicsUnits } from "../physics/items.ts";
import { chemistryUnits } from "../chemistry/items.ts";
import { generalKnowledgeUnits } from "../general-knowledge/items.ts";
import { socialStudiesUnits } from "../social-studies/items.ts";
import { journalUnits } from "../journals/items.ts";
import { biologyUnits } from "../biology/items.ts";

it("every 10-18 item across all 7 subjects has a T2 or T3 tier tag", () => {
  const all1018 = [
    ...mathUnits(),
    ...physicsUnits(),
    ...chemistryUnits(),
    ...generalKnowledgeUnits(),
    ...socialStudiesUnits(),
    ...journalUnits(),
    ...biologyUnits(),
  ].filter((u) => u.group === "10-18");

  assert.equal(all1018.length, 69); // 60 existing + 9 biology
  for (const unit of all1018) {
    const tag = ITEM_TIER_TAGS[unit.id];
    assert.ok(tag === "T2" || tag === "T3", `missing T2/T3 tag for ${unit.id}`);
  }
});

it("math-number:fractions:compare-unlike is tagged to Grade 5", () => {
  assert.equal(ITEM_GRADE_TAGS["math-number:fractions:compare-unlike"], "5");
});
