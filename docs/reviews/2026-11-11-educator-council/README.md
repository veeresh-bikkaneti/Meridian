# AI council review: educator packet

**What this is:** an AI council review of [docs/scaling/educator-review-packet.md](../../scaling/educator-review-packet.md) at main 34020164, run 2026-11-11 on the owner's request. **It is not the human educator sign-off.** The packet's sign-off block stays blank, nothing here is approved to build, and no spec or data file is changed by this review. Proposed changes are applied only on the owner's yes.

Method: the owner's council panel loop. One evidence pack ([pack/](pack/)), then ten seats in parallel on the cheapest model tier, each with clean context, its own persona file ([personas/](personas/)) and only its slice of the rows. Seats did not browse the web; every finding is labelled [measured], [inferred] or [guess]. Full seat reports are in [seats/](seats/).

## Result

**NOT READY.** 179 rows: **120 approve, 57 change, 2 owner's call, 0 cut.** Every standing block has a proposed cure below. Not ready because the cures are proposals not yet applied, the experiential seat is vacant (there is no build to use), and many standard codes still need a human check against the source framework.

| Seat | Rows | Verdict | Change | Cut |
|---|---|---|---|---|
| Math | 65 | APPROVE-WITH-NITS | 6 | 0 |
| Physics | 24 | BLOCK | 13 | 0 |
| Chemistry | 18 | BLOCK | 7 | 0 |
| Geography | 22 | BLOCK | 18 | 0 |
| History and humanities | 35 | BLOCK | 7 | 1 |
| Environmental studies | 74 | BLOCK | 19 | 0 |
| General knowledge | 15 | BLOCK | 3 | 0 |
| Educator 7-10 | 90 | BLOCK | 15 | 0 |
| Educator 10-18 | 87 | BLOCK | 15 | 0 |
| Educator 18+ | 30 | APPROVE-WITH-NITS | 17 | 0 |
| Experiential (uses the game) | — | VACANT: no build exists to play | — | — |

Row counts overlap: rows tagged with several age groups go to each of those educators, and environmental studies reads physics, chemistry, social studies and general knowledge for cross-subject links.

## Coordinator rulings on the evidence pack

1. **"No measurements in story text" does not cover the hook column.** [measured] Six seats blocked rows for numbers in the real-world hook. `scripts/lint-content.mjs` applies the measurement rule to clue text, starter stories and place stories only (the `story` field), and the hook column is each item's `why`, which is the math hook where numbers belong (the ENIAC clip's figures, for example, sit in `why`). The pack did not say this, so those flags convert on read-back with no re-vote: `physics:push:equal-pushes`, `physics:arrive:equal-steps`, `physics:ramp:slope-ratio`, `physics:arrive:unit-rate`, `social-studies:route:count-the-steps`, `social-studies:route:trip-clock`, `general-knowledge:mixed:falls-in-km`, `technology:eniac`, `math-applied:measure:angle-degrees` are approved, and the rule-7 part of every other flag is dropped. Where a seat added missing numbers so a child can compute, that change stands.
2. **No biology.** The 7-10 educator suggested animals and plants for H21's topic list. They are left out under the owner's no-biology rule.
3. **Eiffel Tower height.** [inferred] The general-knowledge seat's block (984 ft when built) is not upheld as stated: 1,024 ft is the commonly cited 1889 height to the flagpole tip. The wording is still unclear, so a clearer line is proposed. Check both figures against the source before build.
4. **Convergence brake.** Chemistry and the 10-18 educator independently blocked `chemistry:states:particles` on the same defect (a kettle's visible cloud is liquid drops, not gas). The cure is below.

## Proposed changes

Exact wording comes from the seat reports. Seats that raised each change are named.

### Facts and wording a child would learn wrong or find unclear

- **`chemistry:states:particles`** (chemistry (BLOCK), educator 10-18. Convergence brake fired.): Hook: "The kettle picture goes from ice, to water, to invisible water vapour above the spout. What did the warmth change?" The visible cloud is tiny liquid drops, not gas.
- **`physics:mirror:sends-back`** (physics, educator 7-10): Skill: "predict that a book is seen when light bounces off it into the eye". Hook: "A lamp lights a book on a shelf. Light bounces off the book into your eye, and that is how you see it. Which light is that: light bouncing off the book, or light that only shines on the shelf?" As written it implies a bare board reflects no light.
- **`math-number:place:decimal-shifts`** (math, educator 10-18): Hook: "A mapmaker draws a map at 1 cm for 10 km. The same land is then drawn ten times larger, so 1 cm stands for 1 km. Every distance must shift one place; where does each digit land?" "Ten times closer" misstates a larger-scale map.
- **`general-knowledge:mixed:eiffel-antennas`** (general-knowledge (BLOCK, not upheld as stated), educator 7-10): Hook: "When it opened in 1889, the Eiffel Tower was 1,024 feet tall. With today's antennas it is 1,083 feet. How much taller is it now?" The 1,024 ft figure is the 1889 height to the flagpole tip, so "without its antennas" is unclear. Check both figures against the source before build.
- **`angkor`** (history, educator 18+): Hook: "Angkor Wat, a huge stone complex near Siem Reap in Cambodia, was built in the early 12th century." The wider Angkor site was built over centuries; only Angkor Wat fits the date.
- **`great-leaders:lincoln-memorial`** (history, educator 7-10, educator 10-18): Replace "It opened in 1922." with "It was dedicated in 1922." (answers O8)
- **`general-knowledge:mixed:everest-vs-falls`** (educator 10-18): Say "the main drop at Victoria Falls is 108 m high" instead of "deepest drop".
- **`general-knowledge:mixed:falls-flow`** (general-knowledge, educator 18+): Wording: "At its highest flood, up to about 500 million litres of water a minute can go over Victoria Falls." Code: 8.EE.A.4 with the 18+ use noted as an adult extension. Name the flow source before build.
- **`math-number:fractions:equivalent`** (educator 7-10, math): Add "Both pizzas are the same size." and ask "Who has more, or do they have the same amount?" As written the question presumes one has more.
- **`math-number:fractions:compare-unlike`** (math): "Two bottles of the same size are 3/4 full and 2/3 full. Which one holds more water?"
- **`math-number:division:two-digit-divisors`** (math): Change 156 bricks to 157, so there is a brick left over (13 pallets, 1 left). 156 ÷ 12 has no remainder.
- **`math-applied:measure:liquid-marks`** (math): Say "250 millilitres (a quarter of a litre)" so the child links millilitres to litres in 3.MD.A.2.
- **`physics:ramp:faster-hits-harder`** (physics): Last line: "Two balls roll into the same cup, one after the other. One ball is moving faster. After which ball does the cup slide farther?"
- **`physics:balance:tug`** (physics): Skill: "...moves in the direction of the stronger push when they do not". Last line: "When the pushes match, does the gate move? When one push is stronger, which way does the gate go?"
- **`physics:shadow:blocks`** (physics): Replace "A sheet" with "A sheet of cardboard, which you cannot see through,".
- **`physics:magnet:flip`** (physics): Last line: "Does the magnet still pull the other one, or does it now push it away?"
- **`physics:mirror:three-ways`** (physics): Hook: "A dark cloth, a clear sheet, and a mirror are on the table, and a lamp shines on them. Which material reflects?" A lamp is a light source, not a material to sort.
- **`chemistry:states:road-salt`** (chemistry, educator 10-18): Skill: "predict that salt on ice makes the ice melt at a temperature where plain ice would stay frozen." Code: no exact code; MS-PS1-4 as nearest.
- **`chemistry:elements:detective`** (chemistry): Hook: "Sodium and potassium are both soft, shiny metals in the same column of the periodic table. Which one reacts more with oxygen?" "Two materials look alike" gives the child nothing to use.
- **`chemistry:water:where`** (chemistry): Code: 2-ESS2-2 (modelling land and water), not 2-ESS2-3.
- **`technology:first-phone`** (history): Hook: "Alexander Graham Bell's telephone carried a spoken message in 1876. How many years ago was that?" "The first phone call" is a contested first; the balance rule leaves it out.
- **`technology:mobile-phone`** (history): Hook: "Bell's telephone carried a spoken message down a wire in 1876. The first public call from a handheld phone was made in 1973. How many years apart were they?"
- **`modern-world:hearts-content-cable`** (educator 7-10): Hook: "A message once crossed under the Atlantic from Ireland. Find the place in Newfoundland where the cable came ashore." The current question asks for a distance the clip never gives.

### Age fit, gentleness and missing data

- **`social-studies:place:compass-clue`** (educator 7-10, geography (code)): Hook: "A treasure map says: two steps east of the fountain, then one step north. Where is the treasure?" A friend texting a child a meeting spot in a park is a scene schools object to at 7-10.
- **`H02`** (educator 7-10): Replace "its consequence and a retry" with "a short reason why the safe choice is safer, and a retry if the choice was not safe". A crash or harm consequence can frighten a 7-year-old.
- **`world-wars:school-morning`** (educator 7-10): For 7-10, the explain line says "This was a school morning in 1939." with no mention of war. The spec already called this the closest call.
- **`social-studies:route:compass-bearing`** (educator 10-18, geography): Hook: "A pilot must say which way to turn to reach an island 200 km away. Saying 'somewhere that way' is not enough for a plan." Drop "crashes planes". Code: HSG.SRT.C.8.
- **`people-places:andean-roads`** (educator 10-18): Delete "Time is distance divided by the daily distance." End with: "How many days would a walker need at a chosen daily distance? Predict first, then work it out." The hook gives the formula before the child tries.
- **`social-studies:region:density`** (educator 10-18, geography (code)): Hook: "Town A has 1,000 people in 2 square km. Town B has 1,000 people in 8 square km. Which town is more crowded, and how do you know?" The hook gave no areas to divide by.
- **`social-studies:compare:time-zones`** (educator 10-18, geography (code)): Hook: "Your cousin lives 6 time zones east of you. When it is 8 pm where you are, what time is it where your cousin lives?" The hook never said east or west.
- **`social-studies:route:scale-ratio`** (educator 10-18, geography): Hook: "Your hiking map is drawn at 1:50 000, and the trail is 7 cm long on the map. How far is the real walk, and is it a stroll or an all-day climb?" The hook never gave the scale. Code: 7.G.A.1.
- **`social-studies:route:fastest-or-shortest`** (educator 10-18): Hook: "The mountain pass is 60 km, and you ride it at 20 km/h. The valley road is 90 km, and you ride it at 60 km/h. Which road gets you home first?" The speeds were missing.
- **`social-studies:route:travel-time`** (educator 10-18, geography): Hook: "A friend's train arrives at 3:40 pm, and you live 90 km away. If you ride at a steady 15 km/h, how long is the ride, and when must you leave?" Code: 6.RP.A.3b.
- **`general-knowledge:mixed:paris-sydney-flight`** (educator 10-18): Drop "worked out from the game's own pins", a meta note that confuses a child.
- **`general-knowledge:mixed:tower-angle`** (educator 10-18): Code written HSG.SRT.C.8 (not HSG-SRT.C.8). Teacher note: "about", ignoring eye height.
- **`social-studies:region:flat-map-area`** (educator 18+, geography): Hook: "On a common wall map Greenland looks about as large as Africa, which is far bigger. Plan a paint shipment by the picture and you order the wrong amount." Code: none fits.
- **`H05`** (educator 18+): 18+ wording: "a learner", not "a child". 18+ code cell: "no school band; adult use".
- **`H06`** (educator 18+): 18+: "put five events in time order, then say which two are closest in time". 18+ code cell: "no school band; adult use".
- **`H21`** (educator 18+, educator 7-10 (topic list overruled)): 18+: "an adult can answer a general-knowledge question on a screened topic". 7-10: "pick the exact answer from three" on weather, our planet and famous landmarks. The 7-10 seat's suggested animals and plants are left out because they are biology.
- **`H03`** (educator 18+): 18+ code cell: "no school band; adult use" (D2.Geo 6-8 covers 10-18 only).
- **`H07`** (educator 18+): 18+ code cell: "no school band; adult use".
- **`H08`** (educator 18+): 18+ code cell: "no school band; adult use". Keep the TO CONFIRM note for 7-10.

### Standard codes only

- **`physics:ramp:adult-ratio`** (physics, educator 18+): Code: HSG.SRT.C.8.
- **`physics:arrive:adult-time`** (physics, educator 18+): Code: HSA.CED.A.4.
- **`physics:energy:missing`** (physics, educator 18+): Code: HS-PS3-1. Adult hook (18+ seat): "A home battery log says: change in stored energy = energy in − energy out. The stored energy rose by 3 units and the house drew 2 units. How many units did the solar panels put in?"
- **`chemistry:reactions:explain`** (chemistry, educator 18+): Code: HS-PS1-2.
- **`chemistry:reactions:mass`** (chemistry, educator 18+): Code: HS-PS1-7.
- **`chemistry:reactions:rate`** (chemistry, educator 18+): Code: HS-PS1-5. Adult hook (18+ seat): two glow sticks, one in warm water and one in ice water; which fades first, and why?
- **`people-places:aconcagua-height`** (geography, educator 18+): Code: HSG.SRT.C.8, and set standardChecked to match (packet error 5).
- **`math-number:fractions:percent`** (math): Code: 6.RP.A.3c (the rate-per-100 part).
- **`math-number:tables:mental-strategies`** (math): Code: none fits; label as an adult extension.
- **`math-number:fractions:combine-shares`** (math): Code: none fits; adult extension. Hook with numbers: "Four friends split a 120-coin bill: one pays 1/2, one pays 1/4, and the last two split the rest equally. One of those two equal shares gets 10% off. Who pays how much?"
- **`general-knowledge:mixed:great-circle`** (general-knowledge): Code: none fits; mark as 18+ enrichment.
- **`social-studies:route:great-circle`** (geography): Code: none fits.
- **`social-studies:compare:trip-cost`** (geography): Code: drop the geography code; it is a money comparison.
- **`social-studies:region:area-by-squares`** (geography, educator 7-10): Code: a math code, 3.MD.C.6 (geography seat) or 3.MD.C.5 (7-10 seat). Seats split; the human signer picks.
- **`math-applied:measure:survey-check`** (math, educator 18+): Code: seats split. Math says no code fits; the 18+ seat says HSN.Q.A.3. The human signer picks.

## Owner's call

These touch wording you already decided, so the council does not overrule it.

- **`great-leaders:jhansi-fort`** (history, educator 10-18): Two seats want the 1858 fighting role left out and the place and year kept: "The Jhansi Fort, in Jhansi, Uttar Pradesh, is linked with the year 1858. How many years ago was that?" Your round 4 wording kept it.
- **`great-leaders:netaji-bhawan`** (history (CUT), educator 10-18 (CHANGE)): Split. History says cut (army command and the slogan are war and political roles). Educator 10-18 says keep the greeting and the place only: "Subhas Chandra Bose made the greeting 'Jai Hind' famous. What is that greeting, and which place keeps his name?" You kept it in round 4.

## Open questions: proposed answers

- **O8 (Lincoln Memorial):** say **dedicated**. Three seats agree: "Work on the Lincoln Memorial began in 1914. It was dedicated in 1922." [inferred]
- **G1 (who signs general knowledge):** two signers, one math educator for the numeric items and one geography or earth-science educator for the place fixtures and the Victoria Falls and Everest facts. Names stay blank. [inferred]
- **G4 (counts):** keep 4 place fixtures (7-10, 10-18 and 18+ seats agree). 7-10: 6 mixed items in 2 rounds of 3, so a session stays short. 10-18: 3 items is workable; the general-knowledge seat would raise it to 5. 18+: both items are unverified, so add at least 2 verified adult items before sign-off. Round counts are not in the packet, so the spec owner should state them. [guess]
- **G5 (non-US curriculum):** name the Australian Curriculum (ACARA) for mathematics and geography, with the National Curriculum in England as a second. Codes not checked. [guess]

## Not covered

- **Experiential seat vacant.** Nobody played the units; no build exists to play. Read-aloud, timers, session length and reduced motion (rubric 11 to 15) are unchecked.
- **Standard codes.** Most C3 codes (D2.Geo, D2.His, D2.Eco) are grade-band labels with no indicator number, and seats offered only guesses for `social-studies:place:grid-reference`, `social-studies:place:latlon-pin`, `social-studies:region:landform-sort`, `social-studies:compare:farther-or-nearer`. Every proposed code is [inferred] or [guess] until a human checks it against the framework document.
- **Clip explain lines** are not in the packet, so wartime wording and similar lines outside the hook were not read.
- **No web checks.** Facts were judged from subject knowledge. Rows where a figure must be checked before build are marked in their change.
- **Other notes from seats**, not changes: Potala's place line could name Red Hill (Marpo Ri) above Lhasa (history seat, [inferred]); Everest should carry both Sagarmatha and Qomolangma if the card names it (general-knowledge seat); Potala and Uluru clips should avoid "sacred", "temple" and who governs the region (10-18 educator).

## Spend

Ten seats on the cheapest model tier, about 1.6 million tokens in total (about 155,000 each, mostly re-reading the pack), plus one coordinator pass. No web use.

Per-row verdicts for all 179 rows: [row-verdicts.md](row-verdicts.md).
