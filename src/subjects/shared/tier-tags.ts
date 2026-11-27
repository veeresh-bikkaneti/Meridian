/**
 * Internal curriculum tier and grade tags (Task 4 + W5, 2026-11-26).
 *
 * Meridian's player-facing AgeGroup stays ("7-10" | "10-18" | "18+").
 * Behind the scenes, the 92 10-18 items across all 7 subjects are tagged
 * to Middle School ("T2") vs. High School ("T3") for curriculum alignment,
 * and `math-number:fractions:compare-unlike` is tagged to Grade 5 only ("5").
 *
 * Kept in this dedicated module rather than on SubjectItem so frozen
 * record fixtures and UnitItem projections remain unchanged.
 */
import type { AgeGroup } from "../registry.ts";

export type CurriculumTierTag = "T2" | "T3";

export const ITEM_TIER_TAGS: Readonly<Record<string, CurriculumTierTag>> = {
  // Math (28 at 10-18: 14 T2, 14 T3)
  "math-number:tables:multi-digit": "T2",
  "math-applied:measure:convert-metric": "T2",
  "math-number:fractions:percent": "T2",
  "math-number:division:standard-algorithm": "T2",
  "math-number:fractions:multiply": "T2",
  "math-number:fractions:divide": "T2",
  "math-applied:rates:unit-rate": "T2",
  "math-applied:rates:constant-speed": "T2",
  "math-applied:rates:one-step": "T2",
  "math-number:division:two-digit-divisors": "T2",
  "math-number:fractions:add-unlike": "T2",
  "math-number:place:decimal-shifts": "T2",
  "math-applied:measure:volume-box": "T2",
  "math-applied:rates:two-step": "T2",

  "math-applied:geometry:scale-drawing": "T3",
  "math-applied:measure:accuracy": "T3",
  "math-applied:trig:bearings": "T3",
  "math-applied:trig:missing-angle": "T3",
  "math-applied:geometry:coordinates": "T3",
  "math-applied:geometry:pythagoras": "T3",
  "math-applied:geometry:distance-points": "T3",
  "math-applied:geometry:cylinder-volume": "T3",
  "math-applied:rates:proportion": "T3",
  "math-applied:rates:rearrange": "T3",
  "math-applied:rates:linear-model": "T3",
  "math-applied:trig:ratios": "T3",
  "math-applied:trig:missing-side": "T3",
  "math-applied:trig:triangle-area": "T3",

  // Physics (11 at 10-18: 5 T2, 6 T3)
  "physics:arrive:unit-rate": "T2",
  "physics:ramp:slope-ratio": "T2",
  "physics:magnet:closer": "T2",
  "physics:push:mass": "T2",
  "physics:push:table": "T2",

  "physics:ramp:higher-stored": "T3",
  "physics:energy:transfer": "T3",
  "physics:sound:medium": "T3",
  "physics:mirror:three-ways": "T3",
  "physics:dynamics:atwood-acceleration": "T3",
  "physics:momentum:inelastic-climb": "T3",

  // Chemistry (10 at 10-18: 5 T2, 5 T3)
  "chemistry:states:road-salt": "T2",
  "chemistry:mixtures:dissolve": "T2",
  "chemistry:reactions:weight": "T2",
  "chemistry:states:particles": "T2",
  "chemistry:water:cycle": "T2",

  "chemistry:reactions:new-look": "T3",
  "chemistry:reactions:rust": "T3",
  "chemistry:materials:identify": "T3",
  "chemistry:stoichiometry:limiting-reactant-yield": "T3",
  "chemistry:solutions:neutralization-molarity": "T3",

  // General Knowledge (20 at 10-18: 9 T2, 11 T3)
  "general-knowledge:mixed:everest-vs-falls": "T2",
  "general-knowledge:mixed:paris-sydney-flight": "T2",
  "general-knowledge:safety:bicycle-traffic-rules": "T2",
  "general-knowledge:safety:mutcd-yield-sign": "T2",
  "general-knowledge:awareness:multiple-threat-crossing": "T2",
  "general-knowledge:riddles:mislabeled-crates": "T2",
  "general-knowledge:environment:rain-shadow-systems": "T2",
  "general-knowledge:environment:plate-boundary-hazards": "T2",
  "general-knowledge:environment:watershed-limiting-resource": "T2",

  "general-knowledge:mixed:tower-angle": "T3",
  "general-knowledge:safety:teen-gdl-driving": "T3",
  "general-knowledge:riddles:sciolympiad-alibi-deduction": "T3",
  "general-knowledge:envirothon:soils-horizons": "T3",
  "general-knowledge:envirothon:aquatic-macroinvertebrates": "T3",
  "general-knowledge:envirothon:forestry-succession": "T3",
  "general-knowledge:envirothon:wildlife-habitat-carrying-capacity": "T3",
  "general-knowledge:envirothon:current-issue-station": "T3",
  "general-knowledge:envirothon:oral-presentation": "T3",
  "general-knowledge:envirothon:kansas-rangeland-management": "T3",
  "general-knowledge:envirothon:rangeland-grazing-ecology": "T3",

  // Social Studies (7 at 10-18: 3 T2, 4 T3)
  "social-studies:region:density": "T2",
  "social-studies:route:scale-ratio": "T2",
  "social-studies:route:travel-time": "T2",

  "social-studies:route:fastest-or-shortest": "T3",
  "social-studies:compare:time-zones": "T3",
  "social-studies:economics:real-purchasing-power": "T3",
  "social-studies:region:water-demand-projection": "T3",

  // Journals (7 at 10-18: 6 T2, 1 T3)
  "technology:mobile-phone": "T2",
  "great-leaders:lincoln-memorial:stretch": "T2",
  "modern-world:greenwich-zero:stretch": "T2",
  "modern-world:liverpool-manchester:stretch": "T2",
  "modern-world:hearts-content-cable:stretch": "T2",
  "people-places:eratosthenes-earth": "T2",

  "people-places:andean-roads": "T3",

  // Biology (9 at 10-18: 5 T2, 4 T3)
  "biology:life-structure:one-cell-many-jobs": "T2",
  "biology:life-health:team-inside-you": "T2",
  "biology:life-ecosystems:grass-runs-short": "T2",
  "biology:life-heredity:family-resemblance": "T2",
  "biology:life-evolution:peppered-moth": "T2",

  "biology:life-ecosystems:valley-wolves": "T3",
  "biology:life-matter:follow-carbon": "T3",
  "biology:life-heredity:molecular-inheritance": "T3",
  "biology:life-evolution:speciation-islands": "T3",
};

export const ITEM_GRADE_TAGS: Readonly<Record<string, string>> = {
  "math-number:fractions:compare-unlike": "5",
};

/**
 * Stable-sort 10-18 items so Middle School (T2) items appear before High
 * School (T3) items while preserving relative order within each tier.
 * Items for 7-10 and 18+ are returned unchanged.
 */
export function sequenceByCurriculumTier<T extends { id: string }>(
  items: readonly T[],
  group: AgeGroup,
): T[] {
  if (group !== "10-18") return [...items];
  const t2: T[] = [];
  const t3: T[] = [];
  const untagged: T[] = [];
  for (const item of items) {
    const tag = ITEM_TIER_TAGS[item.id];
    if (tag === "T2") t2.push(item);
    else if (tag === "T3") t3.push(item);
    else untagged.push(item);
  }
  return [...t2, ...t3, ...untagged];
}
