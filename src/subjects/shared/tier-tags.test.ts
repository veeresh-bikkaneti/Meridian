import { it } from "node:test";
import assert from "node:assert/strict";
import {
  ITEM_GRADE_TAGS,
  ITEM_TIER_TAGS,
  sequenceByCurriculumTier,
} from "./tier-tags.ts";
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

  assert.equal(all1018.length, 92); // 69 existing + 23 from W1/W2/W3
  for (const unit of all1018) {
    const tag = ITEM_TIER_TAGS[unit.id];
    assert.ok(tag === "T2" || tag === "T3", `missing T2/T3 tag for ${unit.id}`);
  }
});

it("math-number:fractions:compare-unlike is tagged to Grade 5", () => {
  assert.equal(ITEM_GRADE_TAGS["math-number:fractions:compare-unlike"], "5");
});

it("sequenceByCurriculumTier stable-sorts T2 before T3 for 10-18", () => {
  const t3First = { id: "general-knowledge:mixed:tower-angle" };
  const t2First = { id: "general-knowledge:safety:bicycle-traffic-rules" };
  const t3Second = { id: "general-knowledge:envirothon:soils-horizons" };
  const t2Second = { id: "general-knowledge:environment:rain-shadow-systems" };
  const input = [t3First, t2First, t3Second, t2Second];

  const sorted = sequenceByCurriculumTier(input, "10-18");
  assert.deepEqual(sorted, [t2First, t2Second, t3First, t3Second]);
  // Does not mutate caller array.
  assert.deepEqual(input, [t3First, t2First, t3Second, t2Second]);
});

it("sequenceByCurriculumTier returns items unchanged for 7-10 and 18+", () => {
  const t3Item = { id: "physics:dynamics:atwood-acceleration" };
  const t2Item = { id: "physics:arrive:unit-rate" };
  const input = [t3Item, t2Item];

  assert.deepEqual(sequenceByCurriculumTier(input, "7-10"), [t3Item, t2Item]);
  assert.deepEqual(sequenceByCurriculumTier(input, "18+"), [t3Item, t2Item]);
});
