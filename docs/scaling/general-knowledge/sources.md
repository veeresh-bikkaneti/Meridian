# Sources — general-knowledge mixed review (Stage A)

Every source below was read live on 2026-11-10 by the spec agent. Confidence
uses the HIGH / MEDIUM / LOW scale of the verification protocol. A fact with no
row here is UNVERIFIED and is not used in an item.

## Standards

| ID | Source | URL | What was read | Codes used |
|---|---|---|---|---|
| S1 | Common Core State Standards for Mathematics (CCSSO, accessible PDF) | https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf | Code and opening wording of each code used | 4.OA.A.3, 4.NBT.A.2, 4.NBT.B.4, 4.MD.A.1, 6.RP.A.3 (incl. 3b constant speed), HSG-SRT.C.8; 8.EE.A.4 read for the 18+ Fit note only |
| S2 | C3 Framework for Social Studies State Standards (NCSS, rev. 2017), Table 16 "Geographic Representations" | https://www.socialstudies.org/sites/default/files/2017/Jun/c3-framework-for-social-studies-rev0617.pdf | D2.Geo.3.3-5: "Use maps of different scales to describe the locations of cultural and environmental characteristics." | D2.Geo.3.3-5 |
| S3 | NGSS, 5-ESS1-2 Earth's Place in the Universe | https://www.nextgenscience.org/pe/5-ess1-2-earths-place-universe | Performance expectation: patterns of daily changes in length and direction of shadows | 5-ESS1-2 |

Note: `thecorestandards.org` (the host the math strand cites) returned a bot
check to this agent on 2026-11-10, so S1 is the CCSSO-published PDF of the
same standards. The integrator may prefer one host for all subjects (open
question G7 in the spec).

## Facts

| ID | Fact used | Source | URL | Confidence |
|---|---|---|---|---|
| F1 | Eiffel Tower built for the 1889 Exposition Universelle | Official Eiffel Tower site, "Key figures" | https://www.toureiffel.paris/en/the-monument/key-figures | HIGH |
| F2 | Eiffel Tower: original height without antennas 1,024 feet; current height 1,083 feet | Same page as F1 | https://www.toureiffel.paris/en/the-monument/key-figures | HIGH |
| F3 | Sydney Opera House inaugurated in 1973, on a peninsula in Sydney Harbour | UNESCO World Heritage Centre, list entry 166 | https://whc.unesco.org/en/list/166/ | HIGH |
| F4 | Mosi-oa-Tunya / Victoria Falls about 1,708 m wide; deepest point 108 m; up to 500 million litres per minute | UNESCO World Heritage Centre, list entry 509 | https://whc.unesco.org/en/list/509/ | HIGH |
| F5 | Mount Everest height 8,848.86 m (2020 joint survey); summit on part of the China–Nepal border | Wikipedia, "Mount Everest" (lead, which cites National Geographic and BBC, Dec 2020) | https://en.wikipedia.org/wiki/Mount_Everest | MEDIUM (secondary source; cites primary reports) |
| F6 | A vertical post's shadow is shortest when the Sun is highest, around noon by the Sun (which can differ from clock noon) | NASA Goddard, "The Sky Above Us" | https://pwg.gsfc.nasa.gov/stargaze/Ssky.htm | HIGH |
| F7 | Earth's mean radius about 6,371 km (used in the 18+ haversine item) | Wikipedia, "Earth radius" (IUGG / NGA arithmetic mean radius) | https://en.wikipedia.org/wiki/Earth_radius | MEDIUM (secondary source; cites IUGG) |
| F8 | Place coordinates for the four original geography fixtures used in mixed-review items | The game's own globe deck, `src/game/starters.ts` (`globe-eiffel-tower`, `globe-sydney-opera-house`, `globe-victoria`, `globe-everest`) | repo, main `8dee5bad` | HIGH as a project-internal value |
| F9 | Angkor Wat is a huge stone complex near Siem Reap, Cambodia, built in the early 12th century, with five towers | UNESCO World Heritage Centre, list entry 668; Encyclopaedia Britannica, "Angkor Wat" (facts A4, A5, A7 as recorded in PR 399, `docs/scaling/humanities/journal-places-reword.md` on `feat/humanities-definitions`). Not re-fetched on this branch. The 160-hectare figure (A2) is not used in any story line | https://whc.unesco.org/en/list/668/ ; https://www.britannica.com/topic/Angkor-Wat | HIGH (cited from PR 399) |
| F10 | Uluru is a huge red sandstone rock that rises alone from the desert in Australia's Northern Territory | Parks Australia (facts U1 sandstone and U3 Northern Territory as recorded in PR 399; also the live journal entry's cited source). Not re-fetched on this branch. Height and circumference (U1, U2) are not used in any story line | https://parksaustralia.gov.au/uluru/ ; https://parksaustralia.gov.au/uluru/discover/highlights/uluru/ | HIGH (cited from PR 399) |

## Derived numbers (worked out, not looked up)

| Item | Working | Result |
|---|---|---|
| `general-knowledge:mixed:eiffel-antennas` | 1,083 − 1,024 (F2) | 59 feet |
| `general-knowledge:mixed:opera-years-ago` | currentYear − 1973 (F3), currentYear read from the device clock at play time (owner ruling, 2026-11-10) | never a literal year; never stored; never asks the child's age |
| `general-knowledge:mixed:falls-in-km` | 2 km = 2,000 m > 1,708 m (F4) | less than 2 km |
| `general-knowledge:mixed:everest-vs-falls` | 8,848.86 ÷ 108 (F4, F5) | 81.9, "about 80" |
| `general-knowledge:mixed:paris-sydney-flight` | haversine on F8 pins with R = 6,371 km (F7) = 16,964 km; 17,000 ÷ 850 | about 20 hours. 850 km/h is a round number for the problem, not a fact |
| `general-knowledge:mixed:tower-angle` | 1,000 × tan 47° | 1,072 feet, against the official 1,083 feet (F2). The 1,000 ft and 47° are problem numbers |
| `general-knowledge:mixed:great-circle` | haversine on F8 pins with R = 6,371 km (F7) | 8,318 km, band 8,000–8,500 km |
| `general-knowledge:mixed:falls-flow` | 500,000,000 × 1,440 (F4) | 7.2 × 10^11 litres per day at the stated upper flow |
| `general-knowledge:mixed:trip-buses` | (30 + 4) ÷ 8 = 4 r 2, round up | 5 minibuses. All numbers are problem numbers |
