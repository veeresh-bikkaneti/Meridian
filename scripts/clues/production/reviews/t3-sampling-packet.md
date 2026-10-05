# T3 Sampling-Review Packet — GeoDetective clue batch (387 sets)

**For:** Veeresh — T3 sampling review (Build Plan Phase 2 gate).
**Branch / tree:** `feat/geodetective-clues` @ `f58b161` (T1 repair + T2 rebase complete and certified; this packet changes no clue content).
**Status:** STAGED by Liz's crew per the build plan. T5 (open PR) does not proceed until your verdicts below land **and** Chitti's T4 delta verification is green.

## 1. What you are being asked

1. **A verdict for every set in §2 and §3** — one of: **accept** / **rework** (with the exact fix) / **reject**.
2. **One batch-wide call — quote widening.** Roughly 97 sets in the batch carry tier-2 quotes recorded against the older, narrower lead extracts of the earlier production strata (Phase 2 short-extract inputs; Option A fuller leads) rather than the tier-2 expansion run's inputs. Decide: **rework batch-wide** (widen those tier-2 quotes against the fuller extracts) **or accept the disclosure + future guidance** (the quotes stand as recorded — each is verbatim against its own stratum's input and re-validated 0-invalid at the milestone-0 union; see `reviews/milestone-0-review.md` Check 2). §3 shows the 10 individually named sample sets with their tier-2 quotes exactly as recorded, so the shape of the issue is visible before you decide.

**Provenance of the lists (stated plainly):** the flagged sets in §2 are resolved by placeId from the branch documents named in each entry. The ~97 figure and the 10 sample sets in §3 come from the build plan's T3 input list (Chitti's post-delivery verification side); the branch production docs do **not** contain a set-by-set enumeration of the 97. The 10 were identified by mapping the build plan's pre-repair published indices (44, 48, 74, 85, 89, 136, 151, 154, 315, 378) through the pre-repair published tree (commit `aab506b`) to placeIds, then to current indices in this tree.

**Index-shift warning:** all indices in this packet are **current** (`f58b161` tree, 387 sets). Source documents written against the 388-set assembly use pre-repair indices: Palestina's removal (old index 340) shifted every later set down one. Where a set's index changed, both are shown.

**For completeness (no verdict requested in this packet):** `tier2-run-report.md` "Flags carried forward" also lists older prior semantic flags not in the build plan's T3 input — Kawambwa gn-176555, Sisimiut gn-3419842, Torquay gn-2635650, San Antonio Oeste gn-3837980.

## Batch facts (each cited, not asserted)

| Fact | Value | Source |
|---|---|---|
| Published sets | **387** in `public/loop/clues/` | `reviews/t1-repair-certification.md`; `reviews/t2-rebase-integrity-certification.md` Claim 2 |
| Manifest | `public/loop/manifest.json` size **387** | T2 certification, Claim 2 (388/388 sha256 OK incl. manifest vs the pre-rebase assembly) |
| Leak scan (repaired batch) | **0 hits / 1,935 clue texts** | T2 certification, Claim 6 (independently re-derived; byte-identical reassembly) |
| Gates on the rebased tree | `npm test` 567/567 · `tsc --noEmit` clean · `lint-cards` GATE PASSED · `build:pages` green · clue suites 70/70 | T2 certification, Claim 5 |
| Locked prompt | sha256 `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a` (byte-untouched) | T2 certification, Claim 3 |
| Locked validator | sha256 `22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4` (byte-untouched) | T2 certification, Claim 3 |
| Run history | 388 assembled (target ≥365 met), then T1 repair → 387 | `tier2-run-report.md`; `reviews/final-certification.md`; `reviews/t1-repair-certification.md` |

## 2. Flagged sets

### 2.1 Puerto San José — `geonames:3591060` — current index **361** (pre-repair 362)

**Flag — thinnest pass of the scoping sample (tier 2).** `tier2-source-expansion-scope.md` §5: "Its quote is the Köppen label plus season boundaries ('wet season May to October, dry November to April') and the clue restates exactly that. It qualifies under the established *seasonal rhythms qualify* adjudication, but it is the floor of that class — the one sample set a human reviewer should look at first." `reviews/milestone-0-review.md` Check 2 concurs ("thin but verbatim and traceable"), and `tier2-run-report.md` carries it in "Flags carried forward". (The scope document's own label for it is "Karaj-adjacent".) Index history: 203 at the milestone-0 baseline → 362 pre-repair → **361 now** (fame-order insertions, then Palestina's removal).

- **Tier 1 — Geography.** This town is on Guatemala's Pacific coast. Its shore looks out on the wide ocean.
  - Source quote (Puerto San José): "Puerto San José, also known as Port of San José, is a town on Guatemala's Pacific Ocean coast"
- **Tier 2 — Climate.** The wet season brings rain from May to October. A dry season then runs from November to April.
  - Source quote (Puerto San José (Climate section)): "Puerto San José has a tropical savanna climate (Köppen: Aw) with a wet season from May to October, and a dry season from November to April."
- **Tier 3 — History.** For hundreds of years, ships used this port for Guatemala. Then a new port to the east took over.
  - Source quote (Puerto San José): "For centuries it served as the Pacific port for Guatemala, but was superseded in the 20th century by Puerto Quetzal, four kilometres to the east."
- **Tier 4 — Hook.** Most visitors here are weekend crowds who come from Guatemala City. The tourist trade here lives off those short trips.
  - Source quote (Puerto San José): "The local tourist industry caters largely to weekenders from Guatemala City."
- **Tier 5 — Giveaway.** This is the largest town on the whole Pacific coast of Guatemala. No other town on that coast is as big as this one.
  - Source quote (Puerto San José): "making it the largest town on the nation's Pacific coast"

### 2.2 Karaj — `geonames:128747` — current index **20** (unchanged by the repair shift)

**Flag — semantically hollow tier 2 (the original "Karaj" flag).** `validation-report.md` Gap 2: its tier-2 clue ("special weather… help shape that weather") "passes every mechanical check but is semantically hollow. Flagged for Veeresh's sampling review; semantic climate substance is a documented validator gap, not a silent pass." Carried as a standing prior semantic flag ("hollow climate") in `tier2-run-report.md` and used as the reference case ("Karaj-class") throughout the scoping and run documents.

- **Tier 1 — Geography.** This city is in Iran, in the Middle East. It is the capital of Alborz province.
  - Source quote (Karaj): "is a city in the Central District of Karaj County, Alborz province, Iran, serving as capital"
- **Tier 2 — Climate.** This place has its own special weather. Many trees, rivers, and green plains around it help shape that weather.
  - Source quote (Karaj): "This city has a unique climate due to access to natural resources such as many trees, rivers, and green plains."
- **Tier 3 — History.** People first lived here long ago in the Bronze Age. Old signs of their homes were found at Tepe Khurvin.
  - Source quote (Karaj): "Earliest evidence of inhabitation in Karaj can be dated to the Bronze Age at Tepe Khurvin."
- **Tier 4 — Hook.** Many newcomers choose to live here. After Tehran, it is the most welcoming city for them in the whole country.
  - Source quote (Karaj): "After Tehran, Karaj is the largest immigrant-friendly city in Iran"
- **Tier 5 — Giveaway.** It is the third biggest city in its country. Only Tehran and Mashhad are bigger than it.
  - Source quote (Karaj): "Karaj is also the third most populous city in Iran after Tehran and Mashhad"

### 2.3 Gaziantep — `geonames:314830` — current index **125** (unchanged by the repair shift)

**Flag — tier 2 passed narrow; 1966-vintage statistics.** `reviews/milestone-2-review.md` §4 ruling: **PASS (narrow)** — "the quote carries a quantified snow regime (4.6 snowy days/winter, 10 days of snow cover, 2.5 hail days) and the text's payload ('snow often lies on the ground for days') traces to it… Weakness noted: the stats are 1966 vintage." Carried as a reviewer watch item in `tier2-run-report.md`.

- **Tier 1 — Geography.** This big city in south central Turkey sits on a small river. It lies a short drive north of Aleppo, a famed town in Syria.
  - Source quote (Gaziantep): "is a major city in south-central Turkey. It is the capital of the Gaziantep Province, in the westernmost part of Turkey's Southeastern Anatolia Region and partially in the Mediterranean Region. It is located approximately 185 km (115 mi) east of Adana and 97 km (60 mi) north of Aleppo, Syria and situated on the Sajur River."
- **Tier 2 — Climate.** Summers here scorch and stay dry for months at a time. Winters turn cool and wet, and snow often lies on the ground for days.
  - Source quote (Gaziantep (Climate section)): "Gaziantep has a hot-summer Mediterranean climate (Köppen: Csa, Trewartha: Cs), with very hot, dry summers and cool, wet and often snowy winters. According to 1966 data, on average, Gaziantep experiences 4.6 snowy days per winter with 10 days of snow cover, along with 2.5 days of hail."
- **Tier 3 — History.** This town fell to the Ottoman Empire in the year 1516. The shift came just days before a great battle of that age.
  - Source quote (Gaziantep): "The Dulkadirid-controlled city fell to the Ottoman Empire in 1516 sometime before the Battle of Marj Dabiq."
- **Tier 4 — Hook.** After a huge quake shook this land in 2023, this town stood mostly whole. It then served as the hub where aid teams based their work.
  - Source quote (Gaziantep): "Due to its size, location and relative intactness, the city served as a regional hub for international organizations and NGOs for earthquake relief and reconstruction after the earthquake."
- **Tier 5 — Giveaway.** A grand old castle stands as a proud mark of this town. A strong quake in recent years left it scarred and in need of care.
  - Source quote (Gaziantep): "The destruction was reportedly much higher in the rural districts of Nurdağı and Islahiye, although a number of historic sites within the city such as mosques and Gaziantep Castle also suffered significant damages."

### 2.4 Mohali — `geonames:6992326` — current index **138** (unchanged by the repair shift)

**Two flags, one set.** The T3 source lists name Mohali twice — "Mohali" and "Mohali-138". Both resolve to this single placeId: 138 is this set's published index (unchanged by the repair shift; it sits below old index 340), and the two citations come from two different flag sources:

- **Flag A — tier 5 leak-scan adjudication** (`reviews/milestone-2-review.md` §6). The reviewer's independent, deliberately stricter leak scan produced 29 raw hits, all adjudicated non-leaks; the one substantive case was this set: tier 5 names Sahibzada Ajit Singh, the person the city is officially named after. Ruling: **not a leak under the locked rule** — prompt §4 bans the canonical name, its parts, recorded aliases *as substrings*, and demonyms; the recorded alias is the full string "Sahibzada Ajit Singh Nagar", which never appears, and §4 explicitly allows "people… that do not contain the name" as decisive tier 4–5 material. "Recorded here for transparency, not as a defect."
- **Flag B — tier 3 is the weakest passing history class** (`reviews/milestone-2-review.md` §4 spot-read; `tier2-run-report.md` watch items). Tier 3 is a dated administrative event — the 2006 district carve-out — "the weakest passing history class, same class as Cavite City's 1614 tenure, and a class the wave's own workers rejected elsewhere when it was *all* a lead offered". Tier 2 is an explicit "seasonal rhythm" quote with winter frost.

- **Tier 1 — Geography.** This planned city lies south-west of Chandigarh in Punjab, in the north-west of India. It is a hub for trade and state rule in its state.
  - Source quote (Mohali): "is a planned city in the Mohali district in Punjab, India, which is an administrative and a commercial hub lying south-west of Chandigarh"
- **Tier 2 — Climate.** Rain here cannot be trusted, and the heat swings wide through the year. Summers are hot, yet frost can bite in the cold weeks of mid-winter.
  - Source quote (Mohali (Climate section)): "has a sub-tropical continental monsoon climate characterised by a seasonal rhythm: hot summers, slightly cold winters, unreliable rainfall and great variation in temperature (). In winter, frost sometimes occurs during December and January."
- **Tier 3 — History.** In 2006, this place was cut out of a nearby district. It was made a district of its very own from that year on.
  - Source quote (Mohali): "was earlier a part of the Rupnagar district and was carved out and made a part of a separate district in 2006"
- **Tier 4 — Hook.** This place has grown fast as a tech hub for its whole state. Its rise in tech has made it count more and more in state life.
  - Source quote (Mohali): "has developed rapidly as an Information technology hub of the state of Punjab, and has thus grown in importance"
- **Tier 5 — Giveaway.** This city bears the name of Sahibzada Ajit Singh. He was the eldest son of Guru Gobind Singh, a great Sikh teacher.
  - Source quote (Mohali): "It is officially named after Sahibzada Ajit Singh, the eldest son of Guru Gobind Singh."

### 2.5 Cavite City — `geonames:1717641` — current index **140** (unchanged by the repair shift)

**Flag — watch-level soft spots at tiers 2 and 3.** `reviews/milestone-2-review.md` §4 (random spot-reads, 12/12 PASS): "Cavite City T2 (Aw label + pronounced wet/dry seasonal rhythm — 'seasonal rhythm' is an accepted category, and the months are exact) and T3 (provincial-seat tenure from 1614 — a dated institutional event, not a superlative)". Carried as a watch item ("soft spots") in `tier2-run-report.md`.

- **Tier 1 — Geography.** This port in the Philippines once served as the main sea gate of Manila. Big trade ships from far lands came and went from its shore.
  - Source quote (Cavite City): "was originally a small port town, Cavite Puerto, that prospered during the early Spanish colonial period, when it served as the main seaport of Manila"
- **Tier 2 — Climate.** This shore place has two clear times of year for rain. A long wet spell runs from May to November, then a dry spell from December to April.
  - Source quote (Cavite City (Climate section)): "has a tropical wet and dry climate (Köppen climate classification Aw), with a pronounced dry season from December to April, and a lengthy wet season from May to November that brings abundant rainfall into the city"
- **Tier 3 — History.** This port was the seat of its province from the year that province was set up, 1614. It kept that seat till the role moved on in 1954.
  - Source quote (Cavite City): "The city was the capital of Cavite Province from its establishment in 1614 until the title was transferred to the newly created, more accessible city of Trece Martires in 1954"
- **Tier 4 — Hook.** Big ships once left this port for Acapulco in Mexico. They were the great galleons of a famed trade that crossed the wide Pacific.
  - Source quote (Cavite City): "Cavite Puerto hosted the Manila-Acapulco galleon trade, along with other large sea-bound ships."
- **Tier 5 — Giveaway.** One famed isle that forms part of this place is Corregidor. It is an isle with a big past, and its name is known far and wide.
  - Source quote (Cavite City): "includes the communities of San Antonio (Cañacao and Sangley Point), the southern districts of Santa Cruz and Dalahican, and the outlying islands of the province, such as the historic Corregidor Island"

### 2.6 Mostar — `geonames:3194828` — current index **116** (unchanged by the repair shift)

**Flag — tier 3 passed with non-blocking notes.** `reviews/milestone-2-review.md` §4 ruling: **PASS** — tier 3 (a named ruler commissioning the city's defining bridge in the 16th century) "is a single defining event — the functional equivalent of founder+era, and it discriminates." Notes: "tiers 3 and 4 both rest on the Old Bridge (event vs. heritage status — acceptable separation), and tier 5's 'its own name… just means Old Bridge' is ambiguous in isolation; its narrowing ('confirms it by its famed Old Bridge') resolves the antecedent to the bridge, and Stari Most does mean Old Bridge, so the statement is accurate under that parse." ("Mostar-116" in the source lists is this set's published index — unchanged by the repair shift.)

- **Tier 1 — Geography.** This city sits beside a river in a small land in the south east of Europe. Long ago it was the chief town of a famed old part of that land.
  - Source quote (Mostar): "Mostar is situated on the Neretva River and is the fifth-largest city in the country."
- **Tier 2 — Climate.** This is the sunniest town in its whole land, with long bright days from June to the fall. Snow comes once in a while, and it melts away fast.
  - Source quote (Mostar (Climate section)): "Mostar is the sunniest city in the country with an average of 2431 solar hours a year."
- **Tier 3 — History.** In the 1500s, a great sultan gave an order for a new bridge. Suleiman the Magnificent had that fine bridge built across the river here.
  - Source quote (Mostar): "The Old Bridge, a UNESCO World Heritage Site, commissioned by Suleiman the Magnificent in the 16th century, is one of Bosnia and Herzegovina's most visited landmarks"
- **Tier 4 — Hook.** Its old bridge is kept safe as a world site of great worth. Folk call it a fine gem of old Islamic craft in these parts.
  - Source quote (Mostar): "The Old Bridge, a UNESCO World Heritage Site, commissioned by Suleiman the Magnificent in the 16th century, is one of Bosnia and Herzegovina's most visited landmarks, and is considered an exemplary piece of Islamic architecture in the Balkans."
- **Tier 5 — Giveaway.** A single span crosses the water at the core of this place. Its own name, in home speech, just means Old Bridge.
  - Source quote (Mostar): "It was named after the bridge keepers (mostari) who guarded the Stari Most (Old Bridge) over the Neretva during the Ottoman era."

## 3. The 10 quote-coverage sample sets

Each entry gives all five published clue texts and the **tier-2 quote exactly as recorded** in the production record — the narrow-quote shape the batch-wide call in §1 is about.

### 3.1 Denton — `geonames:4685907` — current index **44** (unchanged by the repair shift)

- **Tier 1 — Geography.** This town is the seat of its county, in the north of its state. It sits at the far north end of a vast metro zone.
- **Tier 2 — Climate.** Spring storms hit this town hard and oft. Flash floods and fierce thunder storms are a mark of the season here.
- **Tier 3 — History.** This town took its name from a militia chief of the old days. It was made a town in law in the year 1866.
- **Tier 4 — Hook.** This town is famed for its live music. Its fairs and fests draw more than three hundred thousand guests each year.
- **Tier 5 — Giveaway.** Two schools of high learning, set up in 1890 and 1901, set this town apart from all its neighbors round.
- **Tier-2 quote as recorded** (Denton, Texas (Climate section)): "Flash floods and severe thunderstorms are frequent in the spring."

### 3.2 Imphal — `geonames:1269771` — current index **48** (unchanged by the repair shift)

- **Tier 1 — Geography.** This city is the capital of a state in India. It sits in the far northeast, near the edge of the land.
- **Tier 2 — Climate.** Hills all around help keep this place mild in a hot land. Winters are cool and dry, and a hot monsoon brings the rain in summer.
- **Tier 3 — History.** In World War Two, Indian soldiers fought a big battle here for their land. A navy ship was later named to honor those men.
- **Tier 4 — Hook.** This city is famed for its weaving, and for fine work made by hand in brass and bronze.
- **Tier 5 — Giveaway.** Right in this city stand the ruins of an old royal palace and fort. A wide moat of water still rings the place.
- **Tier-2 quote as recorded** (Imphal (Climate section)): "enjoys a moderate climate tempered by its moderately high altitude and the surrounding hills"

### 3.3 Nairobi — `geonames:184745` — current index **74** (unchanged by the repair shift)

- **Tier 1 — Geography.** This town is the chief and most big town of its land, in the south-mid part. Its folk count stands at more than five million.
- **Tier 2 — Climate.** High ground keeps this town cool at night, though it sits by the equator line. In June and July the night cold bites most.
- **Tier 3 — History.** This town was set up in 1898 as a rail stop on a line to the west land. Nine years on, it took the chief town's seat from the coast.
- **Tier 4 — Hook.** This is the one chief town on Earth with a wild game park in its bounds. Folk call it the Green Town Under the Sun.
- **Tier 5 — Giveaway.** Two great world bodies keep homes in this town: one for the wild world, one a main UN base. Its mart is a giant of its continent.
- **Tier-2 quote as recorded** (Nairobi (Climate section)): "At above sea level, evenings may be cool, especially in the June/July season, when the temperature can drop to"

### 3.4 Alor Setar — `geonames:1736309` — current index **85** (unchanged by the repair shift)

- **Tier 1 — Geography.** This town is the chief town of its state, on the west shore of the long land. It is the state's second town by size.
- **Tier 2 — Climate.** The wet time here runs very long, and rain falls even in the short dry time. Days stay near one heat mark all year through.
- **Tier 3 — History.** This town was set up in 1785, with an old name of its own. It has been its state's chief town for long ages since.
- **Tier 4 — Hook.** The third most tall tower of the whole land stands in this town. The main road from the south land to the north land runs through it.
- **Tier 5 — Giveaway.** Folk count this town a core home of its folk's old ways and tongue. It has held its state's crown seat for a long age.
- **Tier-2 quote as recorded** (Alor Setar (Climate section)): "Alor Setar has a very lengthy wet season. As is common in several regions with this climate, precipitation is seen even during the short dry season."

### 3.5 Khartoum — `geonames:379252` — current index **89** (unchanged by the repair shift)

- **Tier 1 — Geography.** This town is the chief and most peopled town of its land. It stands where two great rivers meet and flow on as one.
- **Tier 2 — Climate.** Rain shuns this town for some eight months of the year. Its long dry time splits in two: a warm dry part, then a very hot dry part.
- **Tier 3 — History.** This town was set up in 1821 by a great lord of the east. He set it north of a far more old town of stone.
- **Tier 4 — Hook.** This town is one of three bound by bridge spans where two great streams join. Folk call that meet-point by a name that means The Joining.
- **Tier 5 — Giveaway.** The great town zone round here holds more than seven million folk. It is the most big town zone of the whole land.
- **Tier-2 quote as recorded** (Khartoum (Climate section)): "The climate is extremely dry for most of the year, with about eight months when average rainfall is lower than . The very long dry season is itself divided into a warm, very dry season between November and February, as well as a very hot, dry season between March and May."

### 3.6 El Obeid — `geonames:379003` — current index **136** (unchanged by the repair shift)

- **Tier 1 — Geography.** This city is the capital of a state in Sudan. Its roads and rail line link the west of the land with the east.
- **Tier 2 — Climate.** Rain falls here, yet the place still feels like a desert. Strong heat sucks the wet out fast, and a long dry spell runs from fall to spring.
- **Tier 3 — History.** The Egyptians founded the new city here in 1821. Before that, it had grown as a busy stop for trade caravans.
- **Tier 4 — Hook.** This city was wrecked and left empty in a time of revolt. It was built back up in 1899, when new rulers took charge.
- **Tier 5 — Giveaway.** Its markets are famed for gum arabic, grain, oil seeds, and herds. That rich trade marks this crossroads city at once.
- **Tier-2 quote as recorded** (El Obeid (Climate section)): "El Obeid has a hot semi-desert climate (Köppen: BSh), bordering upon a hot desert climate (BWh), despite receiving over of rain, owing to the extremely high potential evapotranspiration."

### 3.7 Birmingham — `geonames:4049979` — current index **151** (unchanged by the repair shift)

- **Tier 1 — Geography.** This city sits in the north central part of Alabama, in the Deep South of the United States. It is a hub for health care, schools, and trade in its state.
- **Tier 2 — Climate.** Summers here are hot, and winters are mild, with much rain through the year. Still, many winter nights drop to freezing or below it.
- **Tier 3 — History.** This city was founded in 1871, when three small towns joined to make one. It was built in the years just after the Civil War.
- **Tier 4 — Hook.** This place grew so fast in its early years that folks called it magic. Mines, steel works, and rail lines made it boom like few towns can.
- **Tier 5 — Giveaway.** Two big college sports leagues keep their main offices in this city. That makes this city a heart of college sports in the South.
- **Tier-2 quote as recorded** (Birmingham, Alabama (Climate section)): "characterized by hot summers, mild winters, and abundant rainfall. Birmingham is primarily in USDA Hardiness Zone 8a, with some neighborhoods in Zone 8b. January has a daily mean temperature of . There are an average of 47 days annually with a low at or below freezing"

### 3.8 Brownsville — `geonames:4676740` — current index **154** (unchanged by the repair shift)

- **Tier 1 — Geography.** This city sits on the Gulf coast in far south Texas, right by the line with Mexico. Just past that line stands a town in Mexico, face to face with this city.
- **Tier 2 — Climate.** This border city was ranked the fifth hottest in all of America one year. Its winters stay warm, but its summers turn hot and sticky.
- **Tier 3 — History.** A boat man named Charles Stillman founded this city in 1848. He had first made his name with a fleet of river boats close by.
- **Tier 4 — Hook.** Two early war fights took place here, at Palo Alto and at Resaca de la Palma. They were the first clashes of the war with Mexico.
- **Tier 5 — Giveaway.** Ships trade with the world through its deep water port, and most folks in town are Hispanic. That mix seals the name for most.
- **Tier-2 quote as recorded** (Brownsville, Texas (Climate section)): "24/7 Wall St. ranked Brownsville the fifth-hottest city in America in 2016."

### 3.9 Bsharri — `geonames:276359` — current index **315** (unchanged by the repair shift)

- **Tier 1 — Geography.** This town is in the north of Lebanon, in a high hill land. It sits at the head of the Holy Kadisha Valley.
- **Tier 2 — Climate.** This high hill town has winters that freeze hard each year. That cold helps it keep the country's oldest ski resort and its first ski lift.
- **Tier 3 — History.** Some of the first monks in the East made their homes in its valley long ago. Their faith still fills the town with close to forty churches.
- **Tier 4 — Hook.** Poet and painter Khalil Gibran was born in this town long ago. A museum here now honors his life and his art.
- **Tier 5 — Giveaway.** Its old cedar woods are a UNESCO World Heritage Site. They are the last place the famed cedar of Lebanon grows on its own.
- **Tier-2 quote as recorded** (Bsharri): "As Bsharri is mountainous and experiences freezing winters, it is home to Lebanon's oldest ski resort, the Cedars Ski Resort, as well as the country's original ski lift, which was built in 1953."

### 3.10 Seward — `geonames:5873776` — current index **377** (pre-repair 378)

- **Tier 1 — Geography.** This small town sits on a deep, narrow bay on the south coast of Alaska. A long road leads north from here to Anchorage.
- **Tier 2 — Climate.** A huge sheet of ice near this town is slowly pulling back. Its shrinking edge is called a clear sign of climate change.
- **Tier 3 — History.** This town takes its name from the man who led the deal to buy Alaska. He bought the land from Russia in the year 1867.
- **Tier 4 — Hook.** Trains from the far north end their long run here at the sea. This is the last stop on the whole rail line.
- **Tier 5 — Giveaway.** On the shore at the south end of town stands Mile 0. It marks the start of the famed old trail north.
- **Tier-2 quote as recorded** (Seward, Alaska): "Exit Glacier's receding edge as, "...as good a signpost of what we're dealing with when it comes to climate change as just about anything..."

## 4. How to verify any entry

- **Published file:** `public/loop/clues/{current index}.json` — keys `v, placeId, target{lon,lat}, clues, source{label, href}` (clues = the five texts, in tier order). Always confirm identity by the file's `placeId` field, never by index alone.
- **Full production record (per-clue source quotes):** `scripts/clues/production/records-tier2.jsonl` — the line whose `place_id` matches; each accepted record carries `clues[].source.quote` per tier, plus `answer` (name/country/coords/difficulty).
- **Stratum originals:** `records.jsonl` (Phase 2), `records-full.jsonl` (Option A), `records-scope.jsonl` (scoping sample), `records-tier2-wave1.jsonl` / `records-tier2-wave2.jsonl` (expansion waves) — the union record is byte-identical to its stratum line (milestone-0 certification, Check 1).
- **Verdicts:** return per set — accept / rework (with the exact fix) / reject — plus the batch-wide quote-widening decision (rework batch-wide, or accept the disclosure + future guidance). On receipt, Liz's crew executes any rework under the locked prompt + validator and re-stages for T4/T5.

---
*Packet staged 2026-10-04 by Liz's crew (coordinator: agents_orchestrator persona; independent verification: testing_reality_checker persona — see `reviews/t3-packet-verification.md`). Docs-only change: no clue files, records, scripts, prompt, or validator were modified.*
