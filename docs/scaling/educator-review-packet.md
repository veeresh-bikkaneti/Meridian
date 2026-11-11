# Educator review packet

**Status:** PROPOSED. Nothing here is approved to build. One named human signs. The name line below is blank on purpose. No agent can sign this.

Read time: one sitting. This file is the index. Each spec holds the full objective, sources and scripts. Do not treat a short cell as the whole item.

## What the game is

Meridian is a free learning game. No charging, ads or purchases ([k12-learning-design-standard.md](k12-learning-design-standard.md)). The player moves across real places. Each unit opens with a real problem, then the skill that solves it.

**Mission** (owner, 2026-11-10, standard and [subject-progression-map.md](subject-progression-map.md)): most children do not see why they learn multiplication, division, algebra and trigonometry. The game shows the use early, across subjects. Every unit answers "why do I need this?" before it teaches the skill.

The chain is math, then physics, then chemistry, tied to places on the globe. Biology was removed. There is no living-things content.

## Age groups

From standard §1. Nothing is made for under 7. A 10-year-old may pick either of the first two groups. The game does not ask for a birth date.

| Group | Grades | What you are checking |
|---|---|---|
| 7-10 | 2–5 | Concrete, pictures, read-aloud on, no timers. Multiplication, division and fractions in everyday problems. Algebra and trigonometry in the standard are for 10-18 and up. |
| 10-18 | 5–12 | Grade-level text. Multi-step work. Timers only if the player opts in. |
| 18+ | Adults | Harder tiers. Copy stays adult. Host voice can be skipped. |

## Content rules

From standard §7a and the owner rulings in that file. When a line is in doubt, it is left out, not softened.

- Out: religion and religious practice, pilgrimage, mythology, biology, sexuality and gender-identity topics, current or contested politics (parties, elections, ideologies, living politicians).
- War and history, if kept, are remembrance: what happened, where, when, what was built. No graphic detail. No battle replay. No praise or blame of a nation or group.
- A historical person is kept only when the story is a documented achievement or the place, not their politics. If it cannot be told that way, it is cut.

## What you are signing

Copy of the criteria in [educator-gate-rubric.md](educator-gate-rubric.md). Mark each **Pass**, **Fix** or **Fail**, with one line. This packet is the index for every subject below. A sign-off covers the commit you name. If the build later diverges, it is no longer signed.

**A. Content correctness and fit**

- [ ] 1. Every fact is correct and sourced. Nothing taught is wrong or misleading.
- [ ] 2. Each item fits the stated age group.
- [ ] 3. Standard codes are the right ones.
- [ ] 4. Sensitive topics (war, conflict, historical injustice) are truthful and gentle for the group, with no graphic detail.

**B. Learning design**

- [ ] 4a. Each unit shows how it connects to the subject before it, and a real-life use.
- [ ] 4b. Each unit has a "use it elsewhere" round, and that use is correct in the other subject.
- [ ] 4c. Why first: a real problem in the first minute, including for ages 7-10.
- [ ] 5. Each objective uses a verb the game can see.
- [ ] 6. The child predicts or tries before the answer is told.
- [ ] 7. A miss is explained kindly, in words for that group.
- [ ] 8. Misses return later, mixed with other skills.
- [ ] 9. The mastery bar is not luck and not a grind.

**C. Child-appropriate engagement**

- [ ] 10. Motivation is mastery and curiosity. No shaming. No streak-loss fear. Countdowns only where optional.
- [ ] 11. Session length suits the group.
- [ ] 12. A child of that group can see what to do.

**D. Access**

- [ ] 13. Read-aloud and captions cover every prompt. A 7-year-old can follow every 7-10 item.
- [ ] 13a. Each group gets content at its level. The top tier challenges an adult without feeling childish.
- [ ] 14. Learning does not need fast reflexes or precise dragging.
- [ ] 15. A reduced-motion version still teaches the same thing.

**E. Safety and privacy**

- [ ] 16. No personal information is asked for or can be entered.
- [ ] 17. Nothing a school would object to for that group.
- [ ] 17a. Content screen: no religion, sexuality or gender identity, or current or contested politics. History takes no side.

**Decision rule** (from the rubric): Approved for build only with no Fail, and every Fix named with an owner. Any Fail in A or E, or a Fail in 4a, 4b, 4c or 5, is Not approved.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/educator-review-packet.md at commit [ ]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

Name is blank. Do not fill it in for someone else.

## How to read the tables

Columns are the item id, age group, skill, the opening real-world problem (`why` in the data, or the topic objective where there is no `why`), the standard code as written, status, and where it lives.

Status words, and only these:

| Status | Meaning here |
|---|---|
| PROPOSED | In the spec with a code. Not signed. Not approved to build. |
| UNVERIFIED | The spec marks the code, or a taught number, as unchecked. |
| TO CONFIRM | The spec asks you, or the owner, to confirm this row before it is treated as settled. |

A row can be PROPOSED and still need you. Those are listed under "Needs your judgement" with the sensitive sets.

## Math

Specs: [math-spec.md](math-spec.md), [math-definition-spec.md](math-definition-spec.md). Rows: `math/number/items.json` and `math/applied/items.json` on main.

65 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| math-number:groups:skip-count | 7-10 | count a pile of up to 1000 objects by 5s, 10s and 100s | Forty coins are spilled on the shop counter. Counting them one by one takes ages and slips; counting in 5s is quick. | 2.NBT.A.2 | PROPOSED | main |
| math-number:groups:arrays | 7-10 | find the total in a rectangle of up to 5 rows and 5 columns by adding the rows | A wall is built from rows of bricks and the builder needs the total without counting every brick. | 2.OA.C.4 | PROPOSED | main |
| math-number:groups:equal-groups | 7-10 | explain a product as a number of equal groups of a given size | Four boxes hold 6 pencils each. How many pencils is that, and what is a short way to say it? | 3.OA.A.1 | PROPOSED | main |
| math-number:place:hundreds-tens-ones | 7-10 | say how many hundreds, tens and ones are in a three-digit number | A cashier is handed 3 hundred notes, 4 tens and 5 ones. Which number is that, and why is the 3 worth more than the 5? | 2.NBT.A.1 | PROPOSED | main |
| math-number:place:compare | 7-10 | compare two three-digit numbers | Two routes to the lake: one is 358 steps, one is 385. Which is the longer walk, and how can you tell without counting? | 2.NBT.A.4 | PROPOSED | main |
| math-number:place:round | 7-10 | round a whole number to the nearest 10 or 100 | A school fair has 287 visitors and the sign-maker wants a round number for the banner. Is it about 200 or about 300? | 3.NBT.A.1 | PROPOSED | main |
| math-number:place:ten-times | 7-10 | explain that a digit in one place is worth ten times the same digit one place to its right | A path of 70 steps is stretched by a mapmaker to ten times as long. How many steps is that, and what happened to each digit? | 4.NBT.A.1 | PROPOSED | main |
| math-number:tables:buses | 7-10 | solve a word problem about equal groups using multiplication or division within 100 | The class trip has 24 children and each bus seats 6. How many buses do we book? Counting seats one by one is slow; groups of 6 are fast. | 3.OA.A.3 | PROPOSED | main |
| math-number:tables:facts | 7-10 | multiply and divide within 100 using the times tables | A shop sells pencils in packs of 4 and a customer wants 7 packs. The answer is already known if the 4 times table is known, so there is no need to count them again. | 3.OA.C.7 | PROPOSED | main |
| math-number:tables:patterns | 7-10 | spot and explain a pattern in the multiplication table | A stall-holder wants a quick way to check their counting of packs. A pattern in the table is a free double-check. | 3.OA.D.9 | PROPOSED | main |
| math-number:tables:big-products | 7-10 | multiply a number of up to four digits by a one-digit number | A hall has 8 rows of 126 chairs for a concert. The caretaker needs the total number of seats to print the tickets. | 4.NBT.B.5 | PROPOSED | main |
| math-number:tables:multi-digit | 10-18 | multiply multi-digit whole numbers with the standard method | A floor is tiled in 23 rows of 47 tiles. Ordering by guessing wastes money; the exact total decides the order. | 5.NBT.B.5 | PROPOSED | main |
| math-number:tables:mental-strategies | 18+ | multiply two-digit numbers in their head by splitting, doubling and halving | Splitting a bill or comparing two quotes at a counter, where there is no calculator in hand, goes faster with a clean mental method. Fit: no code fits; this is an adult extension (the nearest school code is 5.NBT.B.5). | UNVERIFIED | UNVERIFIED | main |
| math-number:place:decimal-shifts | 10-18 | explain how a digit's value changes by a factor of 10 in both directions | A mapmaker draws a map at 1 cm for 10 km. The same land is then drawn ten times larger, so 1 cm stands for 1 km. Every distance must shift one place; where does each digit land? | 5.NBT.A.1 | PROPOSED | main |
| math-number:place:scientific | 10-18 | write a very large or very small number as a single digit times a power of 10 and compare two such numbers | Two quantities on the globe differ by many zeros and a long string of zeros hides which is larger. A power of 10 makes the gap visible. | 8.EE.A.3 | PROPOSED | main |
| math-number:division:fair-share | 7-10 | interpret a division as the size of each fair share | Twelve snacks and four friends: is it fair, and how many does each get? | 3.OA.A.2 | PROPOSED | main |
| math-number:division:unknown-factor | 7-10 | find a missing factor by thinking of a division as the opposite of multiplication | A box holds 8 pencils and there are 40 pencils to pack. How many boxes? Asking what times 8 makes 40 solves it. | 3.OA.B.6 | PROPOSED | main |
| math-number:division:remainders | 7-10 | solve a division problem that leaves a remainder and say what the remainder means | There are 26 children and each bus seats 6. Four buses leave two children behind, so what do we book? | 4.OA.A.3 | PROPOSED | main |
| math-number:division:big-quotients | 7-10 | divide a number of up to four digits by one digit and give the quotient and remainder | A school library has 1,248 books to put on 8 shelves, evenly. How many go on each shelf, and does any book get left over? | 4.NBT.B.6 | PROPOSED | main |
| math-number:division:two-digit-divisors | 10-18 | divide a number of up to four digits by a two-digit number | A builder has 157 bricks to load onto pallets of 12 and needs the number of pallets and bricks left over. | 5.NBT.B.6 | PROPOSED | main |
| math-number:division:standard-algorithm | 10-18 | divide multi-digit numbers with the standard method | A trip costs 4,368 in total and 28 people share the cost equally. What does each person pay? | 6.NS.B.2 | PROPOSED | main |
| math-number:fractions:fair-parts | 7-10 | name a unit fraction as one of several equal parts of a whole | Four friends share one pizza. Cut it so nobody gets a bigger piece. What do we call one piece? | 3.NF.A.1 | PROPOSED | main |
| math-number:fractions:number-line | 7-10 | place a fraction on a number line between 0 and 1 | A hiker walks 3 of 4 equal parts of a trail. Where on the trail are they now? | 3.NF.A.2 | PROPOSED | main |
| math-number:fractions:equivalent | 7-10 | identify two fractions that are the same size | Both pizzas are the same size. One friend cut a pizza into 2 pieces and took 1; another cut theirs into 4 pieces and took 2. Who has more, or do they have the same amount? | 3.NF.A.3 | PROPOSED | main |
| math-number:fractions:compare-unlike | 7-10 | compare two fractions with different denominators | Two bottles of the same size are 3/4 full and 2/3 full. Which one holds more water? | 4.NF.A.2 | PROPOSED | main |
| math-number:fractions:add-unlike | 10-18 | add fractions with unlike denominators | A recipe wants 1/2 cup of one thing and 1/3 cup of another. How much is that altogether, so the bowl is big enough? | 5.NF.A.1 | PROPOSED | main |
| math-number:fractions:multiply | 10-18 | multiply a fraction by a whole number or a fraction | A recipe needs 2/3 cup, but only half of the recipe is being made. How much is needed? | 5.NF.B.4 | PROPOSED | main |
| math-number:fractions:divide | 10-18 | divide a whole number by a fraction and a fraction by a fraction in a real situation | A roll of ribbon is 6 metres long and each ribbon takes 3/4 of a metre. How many ribbons? | 6.NS.A.1 | PROPOSED | main |
| math-number:fractions:percent | 10-18 | find a percent of a quantity as a rate per 100 | A shop takes 30% off a price of 80. What do you pay, and how much did you save? | 6.RP.A.3c | PROPOSED | main |
| math-number:fractions:combine-shares | 18+ | combine fractions, percents and a division in one multi-step situation | Four friends split a 120-coin bill: one pays 1/2, one pays 1/4, and the last two split the rest equally. One of those two equal shares gets 10% off. Who pays how much? Fit: no code fits; this is an adult extension. | UNVERIFIED | UNVERIFIED | main |
| math-applied:measure:length-cm | 7-10 | measure the length of a shelf in centimetres | A shelf must reach from one bracket to the other. Guessing the length wastes the board. What length does the ruler show? | 2.MD.A.1 | PROPOSED | main |
| math-applied:measure:longer-than | 7-10 | compare two measured lengths and compute how much longer one is | A board and a shelf are both measured. If the board is shorter, it does not reach. How many centimetres longer or shorter is it? | 2.MD.A.4 | PROPOSED | main |
| math-applied:measure:choose-unit | 7-10 | estimate a length and choose centimetres or metres | A shelf is short and the path to the river is long. A centimetre ruler is the wrong tool for the path. Which unit fits each one? | 2.MD.A.3 | PROPOSED | main |
| math-applied:measure:elapsed-time | 7-10 | compute the minutes between two clock times | The clock shows when a walk starts and when it must end. How many minutes sit between those two times? | 3.MD.A.1 | PROPOSED | main |
| math-applied:measure:perimeter | 7-10 | compute the distance around a polygon from its side lengths | A sandbox needs a border all the way around. Measuring one side does not tell how much border to cut. | 3.MD.D.8 | PROPOSED | main |
| math-applied:measure:area-tiles | 7-10 | find an area by counting unit squares with no gaps | A floor must be covered with square tiles. Gaps and overlaps waste tiles. How many tiles cover it with none left over and none missing? | 3.MD.C.6 | PROPOSED | main |
| math-applied:measure:liquid-marks | 7-10 | read a liquid volume in millilitres on a jug | A recipe asks for 250 millilitres (a quarter of a litre) of water. Which line on the jug is that amount? | 3.MD.A.2 | PROPOSED | main |
| math-applied:measure:right-angle | 7-10 | sort a corner as a right angle, sharper than a right angle, or more open than a right angle | A picture frame needs square corners. A corner that is too sharp or too open makes the frame crooked. | 4.G.A.1 | PROPOSED | main |
| math-applied:measure:angle-degrees | 7-10 | measure an angle in whole-number degrees with a protractor | A card beside a ladder shows 75. Only a protractor tells whether the ladder matches that number. | 4.MD.C.6 | PROPOSED | main |
| math-applied:measure:rect-area | 7-10 | compute the area of a rectangle from its length and its width | Counting every tile on a long floor is slow. The length and the width are known. Which multiplication gives the same count? | 4.MD.A.3 | PROPOSED | main |
| math-applied:measure:convert-metric | 10-18 | compute a length in metres from a length in kilometres | A map labels a river stretch 2.4 kilometres. The tape is marked in metres. How many metres is that walk? | 5.MD.A.1 | PROPOSED | main |
| math-applied:measure:volume-box | 10-18 | compute how many unit cubes fill a rectangular box | A crate must hold boxes. How many unit cubes fit inside before the crate is built? | 5.MD.C.5a | PROPOSED | main |
| math-applied:measure:accuracy | 10-18 | compare a reported length with the smallest mark on the tape | A tape shows centimetres. A report writes 2.4837 metres for a beam. Those extra digits are smaller than the tape can show. What should the report say? | HSN.Q.A.3 | PROPOSED | main |
| math-applied:measure:survey-check | 18+ | compare two beam measurements with the tape's smallest mark | Two crews measure one beam and disagree by more than the tape's smallest mark. Which report can a buyer use? Fit: reviewers split. One says no code fits; one says HSN.Q.A.3, which measure:accuracy already uses for how many digits to report. The human signer picks. | UNVERIFIED | UNVERIFIED | main |
| math-applied:geometry:shape-sort | 7-10 | sort rectangles out of other shapes | A frame needs a piece with four square corners. Which of these pieces is that shape? | 2.G.A.1 | PROPOSED | main |
| math-applied:geometry:scale-drawing | 10-18 | compute a real length from a scale drawing | A map says 1 centimetre stands for 2 kilometres. The river on the map is 4 centimetres long. The picture length is not the river length. How long is it on the ground? | 7.G.A.1 | PROPOSED | main |
| math-applied:geometry:coordinates | 10-18 | compute the length of a horizontal or vertical side on a coordinate grid | A grid map places a bridge and a camp on the same horizontal line. How long is the side between them, using the coordinates, without walking it? | 6.G.A.3 | PROPOSED | main |
| math-applied:geometry:pythagoras | 10-18 | compute the sloping side of a right triangle | A ramp must reach a door. The rise and the ground run are known, and the corner on the ground is square. How long is the sloping board, before it is cut? | 8.G.B.7 | PROPOSED | main |
| math-applied:geometry:distance-points | 10-18 | compute the straight-line distance between two coordinate points | A bridge and a camp sit at two grid points that do not share a line. How long is the straight line between them? | 8.G.B.8 | PROPOSED | main |
| math-applied:geometry:cylinder-volume | 10-18 | compute the volume of a cylinder | A rain barrel is a cylinder. How much water fits? Packing cubes leaves gaps at the round wall. | 8.G.C.9 | PROPOSED | main |
| math-applied:rates:unit-rate | 10-18 | compute a unit rate | One stall sells 3 metres of rope for 6 coins. Another sells 5 metres for 8 coins. Which is cheaper for one metre? Comparing the two totals does not answer it. | 6.RP.A.2 | PROPOSED | main |
| math-applied:rates:constant-speed | 10-18 | compute a steady pace and use it on a longer path | A path is 12 kilometres and takes 3 hours at one steady pace. How far in one hour, and how long for a path of 20 kilometres? | 6.RP.A.3b | PROPOSED | main |
| math-applied:rates:proportion | 10-18 | identify the constant of proportionality in a table | A walk covers the same distance each hour. A table shows hours and kilometres. Guessing a new total for each row is the slow way. What single number fills every missing row? | 7.RP.A.2b | PROPOSED | main |
| math-applied:rates:one-step | 10-18 | compute the missing part of a one-step trail problem | A trail is 12 kilometres and 5 kilometres are still ahead. How far has the walker already gone? Counting the whole trail again does not name the missing part. | 6.EE.B.7 | PROPOSED | main |
| math-applied:rates:two-step | 10-18 | compute how many cups fit a budget that has a one-time charge plus a charge per cup | A stall adds 4 coins once, then 3 coins for each cup. The budget is 19 coins. How many cups fit? Adding the 4 once does not answer it. | 7.EE.B.4a | PROPOSED | main |
| math-applied:rates:slope-speed | 10-18 | compare two distance-time lines and compute the speed the steeper line names | Two trips are drawn as lines of distance against time. The steeper line is the faster trip. Which line, and what speed does the steepness name? | 8.EE.B.5 | PROPOSED | main |
| math-applied:rates:rearrange | 10-18 | rearrange the problem's rule distance = speed × time to find the missing time | The problem states distance = speed × time. Distance and speed are known. Time is the missing number, so the rule has to be turned around. | HSA.CED.A.4 | PROPOSED | main |
| math-applied:rates:linear-model | 10-18 | explain the starting amount and the daily change in a linear tank rule | A tank starts with a stated amount of water and loses a stated amount each day. What does the starting number mean, and what does the daily number mean, for the day the tank runs out? | HSF.LE.B.5 | PROPOSED | main |
| math-applied:rates:break-even | 10-18 | compute the length where two linear quotes cost the same | Two workshops price a ramp. One charges more to show up and less per metre. The other does the reverse. At what length do they cost the same? | HSA.REI.C.6 | PROPOSED | main |
| math-applied:trig:ratios | 10-18 | compute a side ratio for an acute angle and show it stays the same when the ramp is scaled | Two ramps have the same steepness and different sizes. Rise divided by the sloping side is the same number on both. That number belongs to the angle, not to the size. | HSG.SRT.C.6 | PROPOSED | main |
| math-applied:trig:missing-side | 10-18 | compute a missing side of a right triangle from an acute angle and one side | A pole casts a shadow. The shadow length and the sun's angle above the ground are both given. How tall is the pole, without climbing it? | HSG.SRT.C.8 | PROPOSED | main |
| math-applied:trig:missing-angle | 10-18 | compute an acute angle from two sides of a right triangle | A ramp rises 1 metre over a 4 metre run. How steep is it in degrees, when a protractor cannot span the ramp? | HSG.SRT.C.8 | PROPOSED | main |
| math-applied:trig:bearings | 10-18 | compute a direction angle from two perpendicular distances | A boat must go 6 kilometres east and 8 kilometres north. Which angle from north does it point along? | HSG.SRT.C.8 | PROPOSED | main |
| math-applied:trig:triangle-area | 10-18 | compute the area of a triangle that is not a right triangle, from two sides and the included angle | A roof panel is a triangle that is not a right triangle. Two sides and the angle between them are known. How much sheet is needed? | HSG.SRT.D.9 | PROPOSED | main |
| math-applied:trig:law-of-sines | 10-18 | compute a tower height from two angles and the distance between them | A surveyor stands at two points on a straight path and measures the angles up to a tower. Neither spot is square-on to the tower. How tall is it? | HSG.SRT.D.11 | PROPOSED | main |

## Physics

Spec: [physics-spec.md](physics-spec.md). Rows: `physics/items.json` on main.

24 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| physics:push:which-way | 7-10 | predict which way a box moves when one push is stronger than the push on the other side | A box of books blocks a door. Pushing both sides the same amount does not open the door. Which way does the box move when one push is stronger? | 3-PS2-1 | PROPOSED | main |
| physics:push:equal-pushes | 7-10 | compute how many tiles a box moves after a counted number of equal pushes | The box must reach a line 8 tiles away. The first push moved it 2 tiles, and each push matches that one. How many tiles do 4 equal pushes cover? | 3-PS2-2 | PROPOSED | main |
| physics:drop:down | 7-10 | predict that a dropped ball moves down | A ball sits on a shelf above a bucket. Letting go should land it in the bucket. Which way does it move? | 5-PS2-1 | PROPOSED | main |
| physics:friction:measure-slide | 7-10 | measure how far a block slid and predict that the next equal push on the same floor matches that measurement | A crate must stop before a glass pane. The first slide was measured on this floor. Will the next equal push stop at the same mark? | 3-PS2-2 | PROPOSED | main |
| physics:ramp:faster-hits-harder | 7-10 | predict that the faster ball moves a cup farther than the slower ball | A ball rolling into a cup must not shove the cup off the table. Two balls roll into the same cup, one after the other. One ball is moving faster. After which ball does the cup slide farther? | 4-PS3-1 | PROPOSED | main |
| physics:arrive:equal-steps | 7-10 | predict which cart reaches a line first when each cart moves the same number of tiles on every step | Two carts leave for the same line. One moves 3 tiles each step. The other moves 1 tile each step. Which cart reaches the line first? | 3-PS2-2 | PROPOSED | main |
| physics:lever:seesaw | 7-10 | predict which end of a see-saw goes down when that end is pushed down | A board over a log must lift a box. You push one end down. Which end goes down? | 3-PS2-2 | PROPOSED | main |
| physics:balance:tug | 7-10 | predict that a gate stays still when the two pushes match, and moves in the direction of the stronger push when they do not | A gate is stuck. Two people push from opposite sides. When the pushes match, does the gate move? When one push is stronger, which way does the gate go? | 3-PS2-1 | PROPOSED | main |
| physics:energy:wound-moves | 7-10 | predict that a wound-up toy car moves and an unwound one stays still | A toy car must cross a mat to a friend. One car is wound up. One is not. Which car moves? | 4-PS3-4 | PROPOSED | main |
| physics:shadow:blocks | 7-10 | predict that a book is seen only when light reflected from it enters the eye, and that a sheet in that path blocks the light | A lamp is on, and a book sits where a child can look at it. A sheet of cardboard, which you cannot see through, can go in the path between the book and the eye. When is the book seen? | 4-PS4-2 | PROPOSED | main |
| physics:mirror:sends-back | 7-10 | predict that a book is seen when light bounces off it into the eye | A lamp lights a book on a shelf. Light bounces off the book into your eye, and that is how you see it. Which light is that: light bouncing off the book, or light that only shines on the shelf? | 4-PS4-2 | PROPOSED | main |
| physics:magnet:flip | 7-10 | predict that turning one magnet around changes the direction of the push or pull | A cabinet uses two magnets to stay shut. Someone turns one magnet around. Does the magnet still pull the other one, or does it now push it away? | 3-PS2-3 | PROPOSED | main |
| physics:push:mass | 10-18 | predict that the same push changes the motion of a heavier box less than a lighter box | Two carts must start with the same push. One cart holds more boxes. Which cart's motion changes more? | MS-PS2-2 | PROPOSED | main |
| physics:push:table | 10-18 | compare rows of net force, mass, and acceleration and predict which row has the larger acceleration when the mass matches and the net force is larger | A dock cart's card lists net force, mass, and acceleration for two one-dimensional trials. The mass matches. The net force does not. Which trial's motion changes more? | HS-PS2-1 | PROPOSED | main |
| physics:ramp:higher-stored | 10-18 | predict that a cart higher on a hill has more stored energy than a cart lower on the same hill | Two carts sit on one hill, one higher than the other. Which cart-and-Earth pair has more stored energy? The round asks only for more or less. | MS-PS3-2 | PROPOSED | main |
| physics:ramp:slope-ratio | 10-18 | compute which of two ramps is steeper from the rise and the run, using a trigonometric ratio | A loading ramp must meet a door. Ramp A rises 2 for a run of 4. Ramp B rises 2 for a run of 2. The taller picture is not the question. Which ramp is steeper? | HSG.SRT.C.8 | PROPOSED | main |
| physics:arrive:unit-rate | 10-18 | compute a constant speed as a unit rate and predict which cart reaches a bridge first | One cart's card says 8 metres in 2 seconds. The other's says 9 metres in 3 seconds. They leave together for the same bridge. Comparing the two totals does not answer it. Who arrives first? | 6.RP.A.3b | PROPOSED | main |
| physics:energy:transfer | 10-18 | predict that when a moving ball stops against a cup, energy has transferred to the cup | A ball rolls into a cup and stops. The cup starts to slide. Where did the ball's motion go? | MS-PS3-5 | PROPOSED | main |
| physics:sound:medium | 10-18 | predict that a sound reaches the listener through a material and not across an empty gap | A bell must be heard across a gap. One path is air. One path is drawn as empty. Which path carries the sound? | MS-PS4-2 | PROPOSED | main |
| physics:mirror:three-ways | 10-18 | sort a material as reflecting, absorbing, or transmitting light | A dark cloth, a clear sheet, and a mirror are on the table, and a lamp shines on them. The card's model key names which does which. Which material reflects? | MS-PS4-2 | PROPOSED | main |
| physics:magnet:closer | 10-18 | predict that two magnets pull harder when they are closer | A latch must hold. Two pairs of magnets match, but one pair sits closer together. Which pair pulls harder? | MS-PS2-3 | PROPOSED | main |
| physics:ramp:adult-ratio | 18+ | compute which crane boom is steeper from a given rise and run, using a trigonometric ratio | A crane drawing gives two booms. Boom A rises 3 for a run of 6. Boom B rises 4 for a run of 6. The longer boom is not the question. Which boom is steeper? Fit: this adult round extends HSG.SRT.C.8, and no single code covers it. | UNVERIFIED | UNVERIFIED | main |
| physics:arrive:adult-time | 18+ | rearrange the card's rule distance = speed × time to compute the missing time | A supply cart's card states distance = speed × time. The distance is 12 kilometres and the speed is 4 kilometres per hour. The time is missing. How long is the trip? Fit: this adult round extends HSA.CED.A.4, and no single code covers it. | UNVERIFIED | UNVERIFIED | main |
| physics:energy:missing | 18+ | compute the missing energy input from the rule the log states | A home battery log says: change in stored energy = energy in − energy out. The stored energy rose by 3 units and the house drew 2 units. How many units did the solar panels put in? Fit: this adult round extends HS-PS3-1, and no single code covers it. | UNVERIFIED | UNVERIFIED | main |

## Chemistry

Spec: [chemistry-spec.md](chemistry-spec.md). Rows: `chemistry/items.json` on main.

18 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| chemistry:states:solid-liquid | 7-10 | sort water as solid ice or liquid water when it is warmed or cooled | The ice pop is hard in the cold and drips when the room is warm. What changed it? | 2-PS1-4 | PROPOSED | main |
| chemistry:states:melt-freeze | 7-10 | predict that warming ice makes liquid water and cooling that water makes ice again | The puddle was ice this morning and water at lunch. Can it turn back into ice? | 2-PS1-4 | PROPOSED | main |
| chemistry:water:where | 7-10 | point to oceans, rivers, lakes, and ponds as liquid water, and to ice as solid water | The puddle is gone, but the lake is still there. Where is the water, and is it ice or liquid? | 2-ESS2-3 | PROPOSED | main |
| chemistry:materials:sort | 7-10 | sort materials by color, texture, hardness, or flexibility | Two spoons look the same until you notice one bends and one does not. Which property did you use? | 2-PS1-1 | PROPOSED | main |
| chemistry:materials:magnet | 7-10 | predict whether a magnet pulls a material without touching it | A pile of bits looks the same. Which ones will jump to the magnet? | 3-PS2-3 | PROPOSED | main |
| chemistry:pieces:rebuild | 7-10 | take an on-screen model apart and build a new shape from the same pieces | The bridge model is too short. Can the same pieces make a longer one? | 2-PS1-3 | PROPOSED | main |
| chemistry:states:particles | 10-18 | predict whether adding or removing warmth turns water among solid, liquid, and gas | The kettle picture goes from ice, to water, to invisible water vapour above the spout. What did the warmth change? | MS-PS1-4 | PROPOSED | main |
| chemistry:states:road-salt | 10-18 | predict that salt on ice makes the ice melt at a temperature where plain ice would stay frozen | The road is icy. Crews spread salt. Why does the ice change? Fit: no exact code; MS-PS1-4 is the nearest. | UNVERIFIED | UNVERIFIED | main |
| chemistry:water:cycle | 10-18 | order an on-screen path of water as ice or liquid, into the air, into a cloud, and back as rain or snow | The puddle disappeared and the sky has a cloud. Where did the water go, and how does it come back? | MS-ESS2-4 | PROPOSED | main |
| chemistry:mixtures:dissolve | 10-18 | pick the model that says a dissolved solid is still there as pieces too small to see | The solid in the glass picture is gone from sight. Is it gone, or still there? | 5-PS1-1 | PROPOSED | main |
| chemistry:reactions:new-look | 10-18 | predict whether an on-screen mix keeps the old look or shows a new one | A shop counter on the screen stirs two plain substances. The picture may bubble. Is that still the same stuff? | 5-PS1-4 | PROPOSED | main |
| chemistry:reactions:rust | 10-18 | compare a metal's look before and after rain and say the properties changed | A metal bike sat out in the rain. It looks different. Did the material change? | MS-PS1-2 | PROPOSED | main |
| chemistry:materials:identify | 10-18 | identify a material by properties they observe, including whether it dissolves | Three unmarked blocks could be three different materials. Which test tells them apart? | 5-PS1-3 | PROPOSED | main |
| chemistry:elements:detective | 10-18 | use a column of the periodic table to predict which of two materials is more likely to react | Sodium and potassium are both soft, shiny metals in the same column of the periodic table. Which one reacts more with oxygen? | HS-PS1-1 | PROPOSED | main |
| chemistry:reactions:weight | 10-18 | predict that the total weight stays the same when the on-screen substances are heated, cooled, or mixed | The mix looks different. Did any of it disappear, or does the scale still match? | 5-PS1-2 | PROPOSED | main |
| chemistry:reactions:explain | 18+ | revise a prediction for a simple main-group reaction drawn as a tally, using the periodic pattern | The tally on the screen does not match the first guess. Which column pattern explains it? Fit: adult extension of HS-PS1-2; no code covers beyond grade 12. | UNVERIFIED | UNVERIFIED | main |
| chemistry:reactions:mass | 18+ | show that the count of atoms, and so the mass, matches on both sides of a simple on-screen reaction | A simple reaction on the screen changes the look. Count the pieces on each side. Did any piece vanish? Fit: adult extension of HS-PS1-7; no code covers beyond grade 12. | UNVERIFIED | UNVERIFIED | main |
| chemistry:reactions:rate | 18+ | predict that a warmer mix, or a more crowded one, changes how fast a reaction runs | Two glow sticks are the same, but one sits in warm water and one in ice water. Which one fades first, and why? Fit: adult extension of HS-PS1-5; no code covers beyond grade 12. | UNVERIFIED | UNVERIFIED | main |

## Social studies

Spec: [social-studies-spec.md](social-studies-spec.md). Rows: `social-studies/items.json` on main.

17 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| social-studies:place:compass-clue | 7-10 | locate a place by following two compass clues (north, south, east, west) from a landmark already on the map | A treasure map says: two steps east of the fountain, then one step north. Where is the treasure? | UNVERIFIED | UNVERIFIED | main |
| social-studies:place:grid-reference | 7-10 | locate a place from a grid reference such as C-4 | A treasure map says the chest is in square C-4. Without a way to name squares, you would have to describe it in a paragraph. | UNVERIFIED | UNVERIFIED | main |
| social-studies:place:latlon-pin | 10-18 | locate a place from its latitude and longitude | A ship's radio gives only two numbers for where it needs help. Which patch of ocean do you send the rescue boat to? | UNVERIFIED | UNVERIFIED | main |
| social-studies:region:landform-sort | 7-10 | sort six pictured places on a satellite map into mountains, plains, coast or desert | A new village needs flat land and fresh water close by. Where on the map would you build it, and where would you not? | UNVERIFIED | UNVERIFIED | main |
| social-studies:region:area-by-squares | 7-10 | estimate and compare the areas of two regions by counting grid squares in rows | Two farmers each claim the bigger field. Counting every square one at a time is slow; counting rows of equal squares is quick. | UNVERIFIED | UNVERIFIED | main |
| social-studies:region:density | 10-18 | compare how crowded two regions are by dividing a count of people by an area | Town A has 1,000 people in 2 square km. Town B has 1,000 people in 8 square km. Which town is more crowded, and how do you know? | UNVERIFIED | UNVERIFIED | main |
| social-studies:region:flat-map-area | 18+ | explain why a flat world map makes regions near the poles look larger than they are | On a common wall map Greenland looks about as large as Africa, which is far bigger. Plan a paint shipment by the picture and you order the wrong amount. | UNVERIFIED | UNVERIFIED | main |
| social-studies:route:count-the-steps | 7-10 | find the distance between two places by counting how many scale-bar lengths fit along the route and multiplying | The class trip bus leaves at 9. The teacher wants to know how far it is from school to the museum, and the map only shows a little bar marked "10 km". | UNVERIFIED | UNVERIFIED | main |
| social-studies:route:trip-clock | 7-10 | work out how many whole hours a trip takes when the bus covers the same distance each hour | The bus drives 40 km every hour and the museum is 120 km away. Will you be back before the lunch bell? | CCSS.MATH.CONTENT.4.MD.A.2 | TO CONFIRM | main |
| social-studies:route:scale-ratio | 10-18 | convert a length measured on a map to a real distance using a ratio scale such as 1:50 000 | Your hiking map is drawn at 1:50 000, and the trail is 7 cm long on the map. How far is the real walk, and is it a stroll or an all-day climb? | CCSS.MATH.CONTENT.7.G.A.1 | UNVERIFIED | main |
| social-studies:route:travel-time | 10-18 | solve time = distance / speed for a planned route, including rearranging it to find the speed or the distance | A friend's train arrives at 3:40 pm, and you live 90 km away. If you ride at a steady 15 km/h, how long is the ride, and when must you leave? | CCSS.MATH.CONTENT.6.RP.A.3.B | TO CONFIRM | main |
| social-studies:route:fastest-or-shortest | 10-18 | choose between a short slow road and a long fast road by computing both travel times | The mountain pass is 60 km, and you ride it at 20 km/h. The valley road is 90 km, and you ride it at 60 km/h. Which road gets you home first? | UNVERIFIED | UNVERIFIED | main |
| social-studies:route:compass-bearing | 10-18 | find the compass bearing from one place to another and split a trip into its north-south and east-west parts using sine and cosine | A pilot must say which way to turn to reach an island 200 km away. Saying "somewhere that way" is not enough for a plan. | HSG-SRT.C.8 | UNVERIFIED | main |
| social-studies:route:great-circle | 18+ | explain why the shortest flight between two far-apart places looks curved on a flat map | A flight from one continent to another takes a path that bends toward the pole on the wall map. Surely a straight line is shorter? | UNVERIFIED | UNVERIFIED | main |
| social-studies:compare:farther-or-nearer | 7-10 | compare two distances on a map by eye and with the scale bar | You get to choose a picnic spot: the lake or the hill. Which one is the shorter walk from home? | UNVERIFIED | UNVERIFIED | main |
| social-studies:compare:time-zones | 10-18 | work out the clock-time difference between two places from their positions east or west of each other | Your cousin lives 6 time zones east of you. When it is 8 pm where you are, what time is it where your cousin lives? | UNVERIFIED | UNVERIFIED | main |
| social-studies:compare:trip-cost | 18+ | compare the total cost of two routes by combining distance, fuel use, a fare or toll and time | A delivery van can take the toll road or the free road. The toll saves an hour, but is an hour worth the fee and the fuel? | UNVERIFIED | UNVERIFIED | main |

## Technology

Spec: [journal-technology-spec.md](journal-technology-spec.md). Rows: `journals/technology/clips.json` on main.

3 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| technology:first-phone | 7-10 | compute how many years ago Bell's phone sent a spoken message (1876) and identify that the voice travelled down a wire | In 1876, Bell's phone sent a spoken message. How many years ago was that? | D2.His.1.3-5 | PROPOSED | main |
| technology:mobile-phone | 10-18 | solve 1876 + x = 1973 to find the years between Bell's 1876 telephone message and the first public handheld mobile phone call, and identify that the 1973 phone needed no wire | Bell's telephone carried a spoken message down a wire in 1876. The first public call from a handheld phone was made in 1973. How many years apart were they? Solve 1876 + x = 1973. | D2.His.2.6-8 | PROPOSED | main |
| technology:eniac | 7-10 | compute the floor area of ENIAC's 50-by-30-foot basement room (1,500 square feet) and compare the size of this early computer with a room | ENIAC, an early computer, was kept in a basement room 50 feet long and 30 feet wide. How much floor did that room cover? | D2.His.2.3-5 | PROPOSED | main |

## People and places

Spec: [journal-people-places-spec.md](journal-people-places-spec.md). Rows: the 5 screened clips in `journals/people-places/clips.json` on main. The live journal's older entries are not relisted here.

5 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| people-places:akashi-span | 7-10 | multiplication | The two side spans are the same length. How long are they together, and how does that compare with the middle span? | D2.Geo.2.3-5 | PROPOSED | main |
| people-places:pont-du-gard | 7-10 | multiplication | How many arches are on the top row? Multiplication turns equal groups into that count. | D2.Geo.1.3-5 | PROPOSED | main |
| people-places:eratosthenes-earth | 10-18 | proportion | How far is it from Alexandria to Syene, and how big does that make the Earth? One fiftieth of a circle means the whole is 50 times the part. | D2.Geo.3.9-12 | PROPOSED | main |
| people-places:andean-roads | 10-18 | rate | How far is this road network, and how many days would a walker need at a chosen daily distance? Predict first, then work it out. | D2.Geo.3.6-8 | PROPOSED | main |
| people-places:aconcagua-height | 18+ | trigonometry | Where is this peak, and how tall is it? Surveyors use a ground distance and an angle. Tangent turns those two measures into a height. Here the published heights disagree, so the clip does not pretend one meter figure is the height. | UNVERIFIED | UNVERIFIED | main |

## Great leaders

Spec: [journal-great-leaders-spec.md on PR 408](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/journal-great-leaders-spec/docs/scaling/journal-great-leaders-spec.md). Rows: `journals/great-leaders/clips.json`.

3 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| great-leaders:lincoln-memorial | 7-10 | compute how many years it took to build the Lincoln Memorial (from 1914 to 1922, 8 years) and identify that the statue of Abraham Lincoln inside sits rather than stands | Work on the Lincoln Memorial began in 1914. It was dedicated in 1922. How many years did it take to build? | D2.His.1.3-5 | TO CONFIRM | PR 408 |
| great-leaders:jhansi-fort | 10-18 | compute how many years ago Queen Lakshmibai began to rule Jhansi (the current year minus 1857, worked out at play time) and identify who she ruled for | Queen Lakshmibai began to rule Jhansi in 1857. How many years ago was that? | D2.His.3.6-8 | PROPOSED | PR 408 |
| great-leaders:netaji-bhawan | 10-18 | compute how many years ago Netaji Bhawan was built as Subhas Chandra Bose's family home (the current year minus 1909, worked out at play time) and identify the greeting he made famous | Netaji Bhawan was built as a family home in 1909. How many years ago was that? | D2.His.3.6-8 | PROPOSED | PR 408 |

## WW2 monuments

Spec: [journal-ww2-monuments-spec.md on PR 410](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/journal-ww2-monuments-spec/docs/scaling/journal-ww2-monuments-spec.md). Rows: `journals/ww2-monuments/clips.json`.

2 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| ww2-monuments:normandy-where | 7-10 | compute how many years ago nineteen fifty-six was | How many years ago was this place above the beach dedicated, and where is it? | D2.Geo.1.3-5 | PROPOSED | PR 410 |
| ww2-monuments:arizona-how-far | 10-18 | divide one hundred eighty-four feet into steps of ten feet | How far is it from one end of this memorial to the other, and where is it? | D2.Geo.1.6-8 | PROPOSED | PR 410 |

## Modern world

Spec: [journal-modern-world-spec.md on PR 411](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/journal-modern-world-spec/docs/scaling/journal-modern-world-spec.md). Rows: `journals/modern-world/clips.json`.

3 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| modern-world:greenwich-zero | 7-10 | locate the zero line on a map | Where is the line maps call zero? | D2.Geo.1.3-5 | PROPOSED | PR 411 |
| modern-world:liverpool-manchester | 7-10 | compute how many years ago 1830 was | How many years ago did a steam railway join Liverpool and Manchester? | D2.His.2.3-5 | PROPOSED | PR 411 |
| modern-world:hearts-content-cable | 7-10 | locate where the 1866 cable came ashore | A message once crossed under the Atlantic from Ireland. Find the place in Newfoundland where the cable came ashore. | D2.Geo.1.3-5 | PROPOSED | PR 411 |

## World wars

Spec: [journal-world-wars-spec.md on PR 412](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/journal-world-wars-spec/docs/scaling/journal-world-wars-spec.md). Rows: `journals/world-wars/clips.json`.

2 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| world-wars:school-morning | 7-10 | subtraction | The children met in 1939. How many years ago was that? | D2.His.2.3-5 | TO CONFIRM | PR 412 |
| world-wars:quiet-hour | 10-18 | subtraction | One quiet morning was in 1918. The school morning was in 1939. How many years later was the school morning? | D2.His.1.6-8 | PROPOSED | PR 412 |

## General knowledge

Spec: [general-knowledge-spec.md on PR 409](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/general-knowledge-spec/docs/scaling/general-knowledge-spec.md). Rows: `general-knowledge/items.json` plus four geography fixtures.

15 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| general-knowledge:mixed:opera-years-ago | 7-10 | compute how many years ago a landmark opened by subtracting its opening year from the current year | A postcard says the Sydney Opera House opened in 1973. How many years ago was that? Counting back one year at a time takes ages and slips; subtracting is quick. | 4.NBT.B.4 | PROPOSED | PR 409 |
| general-knowledge:mixed:eiffel-antennas | 7-10 | find how much taller the Eiffel Tower is today than when it was built by subtracting two heights in feet | When it opened in 1889, the Eiffel Tower was 1,024 feet tall. With today's antennas it is 1,083 feet. How much taller is it now? Guessing from a photo cannot tell you. | 4.NBT.B.4 | PROPOSED | PR 409 |
| general-knowledge:mixed:older-landmark | 7-10 | compare the years two landmarks were finished using < or > | The Eiffel Tower was finished in 1889 and the Sydney Opera House opened in 1973. Which is older? Both look grand in photos, so only the numbers can tell you. | 4.NBT.A.2 | PROPOSED | PR 409 |
| general-knowledge:mixed:falls-in-km | 7-10 | compare a width in metres with a width in kilometres by writing kilometres as metres | Victoria Falls is about 1,708 metres wide. A trail sign says 2 km. Is the falls wider or narrower than that? The two numbers use different units, so you cannot just look. | 4.MD.A.1 | PROPOSED | PR 409 |
| general-knowledge:mixed:trip-buses | 7-10 | find how many minibuses a group needs by dividing and rounding up | A class of 30 children and 4 adults is going to see a waterfall, and each minibus seats 8. How many minibuses do they book? These are numbers for the problem, not facts about a real trip. | 4.OA.A.3 | PROPOSED | PR 409 |
| general-knowledge:mixed:noon-shadow | 7-10 | predict which of three pictures of the Eiffel Tower's shadow was taken around noon | A visitor wants a photo of the tower with the shortest shadow. When should she go? Guessing a time wastes the trip; the pattern of shadows through the day answers it. | 5-ESS1-2 | PROPOSED | PR 409 |
| general-knowledge:mixed:everest-vs-falls | 10-18 | estimate how many times one height fits into another by dividing | Mount Everest is 8,848.86 m high. The main drop at Victoria Falls is 108 m high. How many of those drops stacked up would reach the top of Everest? A picture cannot show both at once, so you need a ratio. | 6.RP.A.3 | PROPOSED | PR 409 |
| general-knowledge:mixed:paris-sydney-flight | 10-18 | compute a travel time from a distance and a constant speed | Paris to Sydney is about 17,000 km over the globe. If a plane kept a steady 850 km/h (a round number for the problem, not a real flight), about how long is the trip? You need a rate to plan when you land. | 6.RP.A.3 | PROPOSED | PR 409 |
| general-knowledge:mixed:tower-angle | 10-18 | estimate a tower's height from a distance on the ground and the angle up to its top using the tangent ratio | No one can drop a tape measure from the top of the Eiffel Tower. Standing 1,000 feet from its centre, the top is about 47 degrees up. How tall is it? The distance and the angle are enough, with trigonometry. These two numbers are for the problem, and the answer is only about the height, since it leaves out your eye height. | HSG-SRT.C.8 | PROPOSED | PR 409 |
| general-knowledge:mixed:great-circle | 18+ | estimate the distance between two places on the globe from their latitude and longitude with the haversine formula | A straight line on a flat map is not the shortest route over a round Earth. How far is it from Everest to Victoria Falls, really? The pins give latitude and longitude; spherical trigonometry turns them into kilometres. Fit: no code fits; this is 18+ enrichment, past HSG.SRT.C.8. | UNVERIFIED | UNVERIFIED | PR 409 |
| general-knowledge:mixed:falls-flow | 18+ | convert a flow of up to 500 million litres per minute into litres per day in scientific notation | At its highest flood, up to about 500 million litres of water a minute can go over Victoria Falls. How much is that in a day? The number is too big to picture, so powers of ten keep it readable. Fit: an adult extension of 8.EE.A.4 that no single school code covers. | UNVERIFIED | UNVERIFIED | PR 409 |
| geography:globe:eiffel-tower | 7-10 | locate the Eiffel Tower on the globe | A friend sends a postcard of a tall iron tower and asks which city it is in. A name means little until you can find the place on the globe. | D2.Geo.3.3-5 | PROPOSED | PR 409 |
| geography:globe:sydney-opera-house | 7-10 | locate the Sydney Opera House on the globe | A picture shows white shell roofs on a harbour. Which side of the world is it on, and which city is it in? | D2.Geo.3.3-5 | PROPOSED | PR 409 |
| geography:globe:victoria-falls | 7-10 | locate Mosi-oa-Tunya / Victoria Falls on the globe | A wide river drops into a gorge so hard that its spray can be seen from far away. Where on Earth is that river? | D2.Geo.3.3-5 | PROPOSED | PR 409 |
| geography:globe:everest | 7-10 | locate Mount Everest on the globe | People call one mountain the highest on Earth. Which mountain range holds it, and where is that range on the globe? | D2.Geo.3.3-5 | PROPOSED | PR 409 |

## Humanities

Spec: [humanities-definitions-spec.md on PR 399](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/humanities-definitions/docs/scaling/humanities-definitions-spec.md). Topic rows from [screened-topics.md](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/humanities-definitions/docs/scaling/humanities/screened-topics.md). Place rows from [journal-places-reword.md](https://github.com/veeresh-bikkaneti/Meridian/blob/feat/humanities-definitions/docs/scaling/humanities/journal-places-reword.md).

22 rows.

| Item or clip id | Age group | Skill taught | Real-world hook | Standard code | Status | Where |
|---|---|---|---|---|---|---|
| H01 | 7-10, 10-18 | Road signs: shape, colour, meaning | After this, a child can match a road sign to what it tells a driver or walker to do, shown by a correct match from three choices. | D2.Civ (rules), 3-5 and 6-8 | UNVERIFIED | PR 399 |
| H02 | 7-10, 10-18 | Road and pedestrian rules as decisions | After this, a child can choose the safe action at a crossing or junction, shown by a decision, a short reason why the safe choice is safer, and a retry if the choice was not safe. | D2.Civ, 3-5 and 6-8 | UNVERIFIED | PR 399 |
| H03 | 10-18, 18+ | Traffic as spatial decisions | After this, a learner can pick the route that avoids a blocked road, shown by a pin or route choice. | D2.Geo, 6-8; 18+: no school band, adult use | UNVERIFIED | PR 399 |
| H04 | 7-10, 10-18 | Driving and walking directions | After this, a child can follow three direction steps to a place on a map, shown by the pin landing there. | D2.Geo, 3-5 | UNVERIFIED | PR 399 |
| H05 | 7-10, 10-18, 18+ | Social economy: prices, change, budgets | After this, a learner can work out the change from a purchase or the total of a small budget, shown by the correct amount. | D2.Eco, 3-5 / 6-8; 18+: no school band, adult use | UNVERIFIED | PR 399 |
| H06 | 7-10, 10-18, 18+ | History, journal-linked: events, places, inventions | After this, a learner can put three events in time order (18+: five events, then say which two are closest in time), shown by a correct sort. | D2.His, 3-5 / 6-8; 18+: no school band, adult use | UNVERIFIED | PR 399 |
| H07 | 10-18, 18+ | World history: early civilisations, buildings, writing, trade routes | After this, a learner can name what a civilisation built or invented and place it on the map, shown by a correct pin and label choice. | D2.His, 6-8; 18+: no school band, adult use | UNVERIFIED | PR 399 |
| H08 | 10-18, 18+ | World wars as remembrance | After this, a learner can say when and where a remembered event happened, shown by a correct date and place choice. | D2.His, 6-8; 18+: no school band, adult use | TO CONFIRM | PR 399 |
| H11 | 7-10, 10-18 | Flag beside a country name (no constitution attached) | After this, a child can match a flag to the country name shown beside it, shown by a correct match. | D2.Geo, 3-5 | UNVERIFIED | PR 399 |
| H12 | 7-10 | School-rules civics: why classes have rules, taking turns, voting for a class pet or a game | After this, a child can say why a class rule exists and who it helps, take turns in a shared game, and count a class vote to find the winning choice, shown by choosing the matching reason, a correct turn order, and the correct vote total. | D2.Civ.3.K-2 (rules in school), D2.Civ.7.3-5 (civic virtues in school), D2.Civ.9.3-5 (deciding as a group): HIGH, see Sources | PROPOSED | PR 399 |
| H13 | 7-10, 10-18, 18+ | Historical places | After this, a child can place a historical site on the map and tell one thing that happened there, shown by a pin and a retrieval answer. | D2.His / D2.Geo | UNVERIFIED | PR 399 |
| H14 | 7-10, 10-18, 18+ | Famous spots (landmarks) | After this, a child can locate a famous landmark and say what it is for, shown by a pin and a retrieval answer. | D2.Geo | UNVERIFIED | PR 399 |
| H15 | 10-18, 18+ | World War monuments | After this, a learner can say what a monument remembers and where it stands, shown by a pin and a retrieval answer. | D2.His | UNVERIFIED | PR 399 |
| H16 | 10-18, 18+ | Great leaders (historical) | After this, a learner can describe one documented achievement of a historical figure and where it happened, shown by a retrieval answer. | D2.His | UNVERIFIED | PR 399 |
| H17 | — | Covered by Great leaders (feat/journal-great-leaders-spec) | — | — | PROPOSED | PR 399 |
| H18 | 7-10, 10-18 | Himalayas and other landform geography | After this, a child can locate a mountain range and describe it in plain words, shown by a pin and a choice. | D2.Geo | UNVERIFIED | PR 399 |
| H21 | 7-10, 10-18, 18+ | GK trivia: school general knowledge per group | After this, a learner can answer a school-level question on a screened topic (7-10: pick the exact answer from three, on weather, our planet and famous landmarks; 18+: an adult general-knowledge question), shown by an exact answer. | per question | TO CONFIRM | PR 399 |
| H23 | 10-18, 18+ | GK Detective cases (P12), cross-subject | After this, a learner can use three clues to reach the one answer they point to, shown by a correct guess within the cap. | per case | UNVERIFIED | PR 399 |
| angkor | 7-10, 10-18, 18+ | Place only: size, age, materials, and the math in the reword file | Angkor Wat, a huge stone complex near Siem Reap in Cambodia, was built in the early 12th century. | — (sources in the reword file; no new code) | PROPOSED | PR 399 |
| potala | 7-10, 10-18, 18+ | Architecture only: settled building facts (size, age, materials) and the math in the reword file; nothing about who governs the region. Owner decided: keep Potala. | The palace sits on Red Mountain in the middle of the Lhasa Valley. | — (sources in the reword file; no new code) | PROPOSED | PR 399 |
| timbuktu | 7-10, 10-18, 18+ | Place only: size, age, materials, and the math in the reword file | The city in Mali stands at the edge of the Sahara Desert. | — (sources in the reword file; no new code) | PROPOSED | PR 399 |
| uluru | 7-10, 10-18, 18+ | Place only: size, age, materials, and the math in the reword file | The huge red sandstone rock rises alone from the desert in Australia's Northern Territory. | — (sources in the reword file; no new code) | PROPOSED | PR 399 |

## Needs your judgement

Every row that is not PROPOSED, then the sensitive sets even when a row is PROPOSED. One line each. Sources stay in the linked spec.

### Rows marked UNVERIFIED or TO CONFIRM

| Id | Status | Why it is on this list |
|---|---|---|
| `math-number:tables:mental-strategies` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `math-number:fractions:combine-shares` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `math-applied:measure:survey-check` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `physics:ramp:adult-ratio` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `physics:arrive:adult-time` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `physics:energy:missing` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `chemistry:states:road-salt` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `chemistry:reactions:explain` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `chemistry:reactions:mass` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `chemistry:reactions:rate` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:place:compass-clue` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:place:grid-reference` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:place:latlon-pin` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:region:landform-sort` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:region:area-by-squares` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:region:density` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:region:flat-map-area` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:route:count-the-steps` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:route:trip-clock` | TO CONFIRM | Social-studies spec: this CCSS code was only PARTIAL when the pages were checked. |
| `social-studies:route:scale-ratio` | CCSS.MATH.CONTENT.7.G.A.1 | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:route:travel-time` | TO CONFIRM | Social-studies spec: this CCSS code was only PARTIAL when the pages were checked. |
| `social-studies:route:fastest-or-shortest` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:route:compass-bearing` | HSG-SRT.C.8 | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:route:great-circle` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:compare:farther-or-nearer` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:compare:time-zones` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `social-studies:compare:trip-cost` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `people-places:aconcagua-height` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `great-leaders:lincoln-memorial` | TO CONFIRM | Open item O8: confirm whether the clip should say the memorial opened in 1922 or was dedicated then. |
| `world-wars:school-morning` | TO CONFIRM | Spec flags this as the closest call. The explain line no longer mentions the war (2026-11-11 review). You may Fail rubric 4 or 17a. |
| `general-knowledge:mixed:great-circle` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `general-knowledge:mixed:falls-flow` | UNVERIFIED | Standard code is the string UNVERIFIED, or the row still carries an unchecked mark, in the source file. |
| `H01` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H02` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H03` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H04` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H05` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H06` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H07` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H08` | TO CONFIRM | Screened list: not offered in 7-10 is proposed, and the educator is asked to confirm. |
| `H11` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H13` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H14` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H15` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H16` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H18` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |
| `H21` | TO CONFIRM | Screened list: the general-knowledge topic map per group is not set. |
| `H23` | UNVERIFIED | Screened list: every C3 indicator on that page is UNVERIFIED except the three school-rules civics codes on H12. |

### Questions answered on main (PR 417)

Answered, so they are no longer open for you: PR 408 O1, O2, O5, O6 and PR 409 G2, G3, G6, G7. Still for the educator: O8, G1, G4 and G5.

### Sensitive sets (kept and cut)

These stay even if the row above is PROPOSED. Kept means the draft still proposes it. Cut means it is not a row in the tables.

**Great leaders (PR 408).** Kept only as a place or a sourced achievement, not as politics. In the table: Lincoln Memorial (building years and a column count; the rally speech, the death, and the design dispute are left out of the clip), Jhansi Fort, Netaji Bhawan. Cut: the MLK memorial, because the story could not be told without a contested political campaign, and a place-only version was rejected as misleading. The cut stands (open item O2, answered on main by PR 417). Wording still open for the two added leaders (what was sourced, what conflicted, and which phrase to use) is in that spec's owner-decisions table. A Robben Island clip is kept on PR 407 and is not copied into the great-leaders rows until that PR merges, so it is not in the table. PR 407's old topic label is retired (PR 399 decision 3 and PR 408 owner decision 1) and is not used in this packet.

**WW2 monuments (PR 410).** Kept: two remembrance places and one sourced number each (a year, a length), plus where they are. No battle is replayed. Cut from the spoken and drawn lines: religious symbols and a shrine, landings, boats, guns, soldiers, explosions, a ship's hull, burial counts, and death tallies.

**World wars (PR 412).** Kept: a 1939 school morning (years-ago subtraction, no battle) and a 1918 quiet hour (years from 1918 to 1939). The 18+ stretch on the quiet hour (minutes between two clock times) has no C3 code of its own; the spec marks that stretch UNVERIFIED. Cut: a Christmas cease-fire draft, because it could not be told without a religious festival and a hymn; a letters-home draft, because the emotional line was unsourced and two evacuation counts were mixed. Also left out of child-facing lines: weapons, an enemy nation, poppies, and monuments (those belong to the monuments journal).

**People and places (main).** Five clips kept (bridge span, aqueduct arches, Earth size, a road network, a peak height). Cut, not softened: a Maya ceremonial-centre draft, a monastery draft, a figure whose story is a religion, a speech at a religions gathering, and a mythology draft.

**Modern world (PR 411).** Three clips kept (a zero-longitude line, an 1830 railway year, an 1866 cable landing). Cut: a 1492 voyage and empty-lands telling, a voyage-around-the-world telling that carried the same doubt, opening-day death, a political tally, and religious wording. A track length in miles is also left out because sources disagree.

**Humanities (PR 399).** Current affairs closed. Constitution picker cut. School-rules civics for ages 7-10 only (class rules, taking turns, a class vote on a pet or a game). Religious sites and mythology topics cut (H19, H20). Elections and parties cut (H24). Biology inside general knowledge cut (H25). Four live places (Angkor, Potala, Timbuktu, Uluru) stay, retold as the place only; Potala is decided: kept, architecture only (settled building facts, nothing about who governs the region), status PROPOSED. The other religious places are decided too. Sagrada Família, Fushimi Inari, Christ the Redeemer, the Alamo and Robber's Cave stay, reworded as architecture only (the Alamo as a 1718 stone and adobe mission building, no battle). For balance, Kailasa, Konark, Brihadeeswarar and "Ram Setu, also called Adam's Bridge" (geography only) are added, now merged in PR 399. The owner's rule: keep the place, teach the settled facts, leave out what is still argued over.

**General knowledge (PR 409).** Eleven mixed items plus four place fixtures. The spec says the count is not decided. Globe-deck places cut from fixtures include temple or ceremonial sites and a deck line that mentioned sacred sites. Everest is kept on a split vote, on the condition in that spec. Two items have no standard code (`great-circle`, `falls-flow`).

## Errors found

Not fixed. This packet may not edit those files.

1. [k12-learning-design-standard.md](k12-learning-design-standard.md) §7a still names a retired people-category in the parentheses after "Historical people". PR 399 decision 3 and PR 408 owner decision 1 retired that label. The standard on main was not updated.
2. PR 408's opening count says 1 clip kept and 1 cut, then the same page says 3 rows are in `clips.json` after later owner additions. The table above follows `clips.json` (3 rows).
3. PR 409 keeps Angkor Wat and Uluru as place-only fixtures, matching PR 399 (both now merged). The two drafts no longer disagree.
4. [social-studies-spec.md](social-studies-spec.md) left most C3 codes UNVERIFIED because a standards site returned 403 on 2026-11-10. The same day, PR 399 cites the official C3 PDF as downloaded for three civics codes. The social-studies block may be stale.
5. `people-places:aconcagua-height` has standard `UNVERIFIED` and `standardChecked` set to a date. Those two fields disagree.

## Spec index

| Subject | File |
|---|---|
| Rubric | [educator-gate-rubric.md](educator-gate-rubric.md) |
| Standard | [k12-learning-design-standard.md](k12-learning-design-standard.md) |
| Progression | [subject-progression-map.md](subject-progression-map.md) |
| Contracts | [contracts.md](contracts.md) |
| Math | [math-spec.md](math-spec.md), [math-definition-spec.md](math-definition-spec.md) |
| Physics | [physics-spec.md](physics-spec.md) |
| Chemistry | [chemistry-spec.md](chemistry-spec.md) |
| Social studies | [social-studies-spec.md](social-studies-spec.md) |
| Technology | [journal-technology-spec.md](journal-technology-spec.md) |
| People and places | [journal-people-places-spec.md](journal-people-places-spec.md) |
| Great leaders | [PR 408](https://github.com/veeresh-bikkaneti/Meridian/pull/408) |
| WW2 monuments | [PR 410](https://github.com/veeresh-bikkaneti/Meridian/pull/410) |
| Modern world | [PR 411](https://github.com/veeresh-bikkaneti/Meridian/pull/411) |
| World wars | [PR 412](https://github.com/veeresh-bikkaneti/Meridian/pull/412) |
| General knowledge | [PR 409](https://github.com/veeresh-bikkaneti/Meridian/pull/409) |
| Humanities | [PR 399](https://github.com/veeresh-bikkaneti/Meridian/pull/399) |
| Science definitions (read, no table) | [science-definitions-spec.md](science-definitions-spec.md) |
| Phase 0 (read, no table) | [phase0-shell-split-spec.md](phase0-shell-split-spec.md) |

PR 407 was read. Its kept clip is not a table here. See Great leaders above.
