# Seat: geography
VERDICT: BLOCK
Rows judged: 22. Rows not listed below: APPROVE.

| Row id | Verdict | Rubric item | Exact replacement (wording or code), or the law it breaks | Label | Reason (one line) |
|---|---|---|---|---|---|
| social-studies:place:compass-clue | CHANGE | 3 | Standard: D2.Geo.1.3-5 (C3 geographic representations, grades 2-5), or no code fits | [guess] | Code is UNVERIFIED and I cannot confirm this indicator. |
| social-studies:place:grid-reference | CHANGE | 3 | Standard: D2.Geo.1.3-5 (C3, grades 2-5), or no code fits | [guess] | Grid squares are a map representation; code is UNVERIFIED. |
| social-studies:place:latlon-pin | CHANGE | 3 | Standard: D2.Geo.1.6-8 (C3), or no code fits | [guess] | Locating by latitude and longitude is a 10-18 map skill; code is UNVERIFIED. |
| social-studies:region:landform-sort | CHANGE | 3 | Standard: D2.Geo.2.3-5 (C3 physical systems, grades 2-5), or no code fits | [guess] | Sorting landforms is a physical-geography skill; code is UNVERIFIED. |
| social-studies:region:area-by-squares | CHANGE | 3 | Standard: CCSS.MATH.CONTENT.3.MD.C.6 (measure areas by counting unit squares) | [inferred] | Counting rows of equal squares is the 3.MD.C.6 skill; code is UNVERIFIED. |
| social-studies:region:density | CHANGE | 3 | Standard: CCSS.MATH.CONTENT.6.RP.A.3.B (unit rates, people per area) | [inferred] | Dividing a count by an area is a unit rate; code is UNVERIFIED. |
| social-studies:region:flat-map-area | CHANGE | 3 | No C3 code confirmed for projection distortion at 18+; mark the code as no code fits | [inferred] | Map-projection area distortion is not a verified indicator; code is UNVERIFIED. |
| social-studies:route:count-the-steps | BLOCK | 7 (law: no measurements in story text) | Hook: "The class trip bus leaves at 9. The teacher wants to know how far it is from school to the museum, using the map's scale bar." Move "10 km" into the math prompt. Code: CCSS.MATH.CONTENT.3.OA.A.3 | [measured] | Story hook carries "10 km"; owner rule 7 keeps measurements in math hooks only. |
| social-studies:route:trip-clock | BLOCK | 7 (law: no measurements in story text) | Hook: "The bus drives the same distance every hour, and the museum is far away. Will you be back before the lunch bell?" Move "40 km" and "120 km" into the math prompt. Keep CCSS.MATH.CONTENT.4.MD.A.2 | [measured] | Story hook carries "40 km" and "120 km"; keep TO CONFIRM until the pages are rechecked. |
| social-studies:route:scale-ratio | BLOCK | 7 (law: no measurements in story text) and 3 | Hook: "Your hiking map shows the trail as a long pencil line. Is that a stroll or an all-day climb?" Move "7 cm" into the math prompt. Code: CCSS.MATH.CONTENT.7.G.A.1 (scale drawings) | [inferred] | Story hook carries "7 cm"; 7.G.A.1 is the scale-drawing standard, replacing UNVERIFIED. |
| social-studies:route:travel-time | BLOCK | 7 (law: no measurements in story text) | Hook: "A friend's train arrives at 3:40, and you live a long bike ride away. When must you leave, and how fast must you ride?" Move "90 km" into the math prompt. Keep CCSS.MATH.CONTENT.6.RP.A.3 | [measured] | Story hook carries "90 km"; the code is right, TO CONFIRM stays until the pages are rechecked. |
| social-studies:route:fastest-or-shortest | BLOCK | 7 (law: no measurements in story text) | Hook: "The mountain pass looks shorter on the map but is winding and slow; the valley road is longer and fast. The shortest line may not be the quickest way home." Move "60 km" and "90 km" into the math prompt. Code: CCSS.MATH.CONTENT.6.RP.A.3.B | [measured] | Story hook carries "60 km" and "90 km"; code is UNVERIFIED. |
| social-studies:route:compass-bearing | BLOCK | 7 (law: no measurements in story text) and 3 | Hook: "A pilot must say which way to turn to reach an island on the chart. Saying 'somewhere that way' crashes planes." Move "200 km" into the math prompt. Code: CCSS.MATH.CONTENT.HSG.SRT.C.8 (trig ratios in right triangles) | [measured] | Story hook carries "200 km"; sine and cosine are fine at 10-18 but the code is UNVERIFIED. |
| social-studies:route:great-circle | CHANGE | 3 | No C3 code confirmed for great-circle routes at 18+; mark as no code fits | [inferred] | Curved path on a flat map is a projection idea; code is UNVERIFIED. |
| social-studies:compare:farther-or-nearer | CHANGE | 3 | Standard: D2.Geo.1.3-5 (C3, grades 2-5), or no code fits | [guess] | Comparing map distances by scale bar; code is UNVERIFIED. |
| social-studies:compare:time-zones | CHANGE | 3 | Standard: D2.Geo.1.6-8 (C3), or no code fits | [guess] | Time-zone offset from east-west position; code is UNVERIFIED and I cannot confirm the indicator. |
| social-studies:compare:trip-cost | CHANGE | 3 | No geography code fits a cost comparison; drop the code | [inferred] | Comparing route costs is a money-and-math decision; code is UNVERIFIED. |
| people-places:aconcagua-height | CHANGE | 3 | Standard: CCSS.MATH.CONTENT.HSG.SRT.C.8 for the trig skill; no C3 code fits; set standardChecked to match the UNVERIFIED state | [inferred] | Standard reads UNVERIFIED while standardChecked carries a date (pack error 5). |

## Open questions
(none assigned to this seat)

## Other findings
1. [measured] Owner rule 7 (no measurements in story text) is breached in six hooks, all in the social-studies route rows. The cure moves each number into the math prompt; confirm each math prompt already carries that value before cutting it from the story.
2. [inferred] Most C3 codes in this subject are my best recall, not checked against the C3 PDF. The social-studies spec says the standards site returned 403, so an educator must check the codes against the C3 document before build.
3. [measured] people-places:aconcagua-height is UNVERIFIED with a standardChecked date, the conflict already listed as pack error 5.
4. [inferred] people-places:eratosthenes-earth carries the C3 code D2.Geo.3.9-12, but the skill is proportion. CCSS.MATH.CONTENT.7.RP.A.2 fits the skill better; the geography code needs checking.
