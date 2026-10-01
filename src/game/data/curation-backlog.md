# Kid-friendly history notes — curation backlog

Prioritized for future curation crews. Most-played regions first: **US
states → India → UK**. Every geonameid below was verified against the built
chunks (`src/game/data/geonames/chunks/*.json`) — the id resolves to the
named place in the listed region chunk with gate-verified coordinates. Hook
angles are starting ideas, not claims; every claim still needs a
claim-by-claim Wikipedia audit (`history-sources-*.md` pattern) before a
note ships.

Covered already (do NOT re-curate): all 50 US state capitals (batch B),
30 global majors (batches A/B), crew C batch: New York City 5128581, Chicago
4887398, Los Angeles 5368361, San Francisco 5391959, New Orleans 4335045,
Miami 4164138, Mumbai 1275339, Jaipur 1269515, Agra 1279259, Edinburgh
2650225, Manchester 2643123, Oxford 2640729.

## Priority 1 — US famous non-capital cities (kids meet these in quizzes)

| State | Place | Geonameid | Chunk | Candidate hook angle |
|---|---|---|---|---|
| WA | Seattle | 5809844 | washington | 1851 Denny Party landing; Space Needle for 1962 World's Fair; Starbucks/Microsoft origins |
| TX | Houston | 4699066 | texas | Mission Control / "Houston, we have a problem"; oil boom |
| TX | Dallas | 4684888 | texas | JFK assassination 1963; Big D; cattle/oil roots |
| TX | San Antonio | 4726206 | texas | The Alamo 1836; River Walk |
| TX | Fort Worth | 4691930 | texas | Chisholm Trail cattle drives; "Cowtown" |
| TX | El Paso | 5520993 | texas | Oldest mission in Texas (Ysleta 1682); border city |
| PA | Philadelphia | 4560349 | pennsylvania | US independence: Declaration + Constitution; Liberty Bell |
| PA | Pittsburgh | 5206379 | pennsylvania | Steel city; Carnegie; three rivers confluence |
| FL | Orlando | 4167147 | florida | Disney World 1971 changed Florida; swampland-to-park story |
| FL | Tampa | 4174757 | florida | Ybor City cigars; pirate Gasparilla festival |
| FL | Jacksonville | 4160021 | florida | Largest US city by land area (contiguous); Great Fire of 1901 |
| CA | San Diego | 5391811 | california | First European landing in California (Cabrillo 1542); "birthplace of California" |
| CA | San Jose | 5392171 | california | First civilian Spanish settlement in California; capital of Silicon Valley |
| CA | Oakland | 5378538 | california | Gold Rush port; Black Panther Party founded 1966 |
| CA | Long Beach | 5367929 | california | Queen Mary ocean liner; aerospace/port history |
| CA | Fresno | 5350937 | california | Raisin capital of the world; Central Valley agriculture |
| CA | Bakersfield | 5325738 | california | Buck Owens country music; Kern River oil |
| NV | Las Vegas | 5506956 | nevada | Hoover Dam water/power; from railroad stop to casino capital |
| AZ | Tucson | 5318313 | arizona | 4,000-year-old settlement; Spanish presidio; "Old Pueblo" |
| AZ | Mesa | 5304391 | arizona | Hohokam canals; Mormon pioneer settlement |
| NM | Albuquerque | 5454711 | new-mexico | Founded 1706; Route 66; International Balloon Fiesta |
| CO | Colorado Springs | 5417598 | colorado | Pikes Peak "America the Beautiful"; Garden of the Gods |
| MI | Detroit | 4990729 | michigan | Motor City; Motown Records; founded 1701 by Cadillac |
| MN | Minneapolis | 5037649 | minnesota | Flour milling capital (Pillsbury/Washburn); St. Anthony Falls |
| WI | Milwaukee | 5263045 | wisconsin | Beer barons; Harley-Davidson; Great Lakes port |
| OH | Cincinnati | 4508722 | ohio | "Porkopolis"; first US professional baseball team (Red Stockings 1869) |
| MD | Baltimore | 4347778 | maryland | Star-Spangled Banner written at Fort McHenry 1814; first US railroad |
| TN | Memphis | 4641239 | tennessee | Blues on Beale Street; Elvis at Sun Studio; King assassination 1968 (age-appropriate framing) |
| MO | St. Louis | 4407066 | missouri | Gateway Arch; 1904 World's Fair + first Olympics in US |
| MO | Kansas City | 4393217 | missouri | Jazz + BBQ; Union Station; 1920s Pendergast era (keep kid-simple) |
| NC | Charlotte | 4460243 | north-carolina | First US gold rush (1799); NASCAR roots |
| OR | Portland | 5746545 | oregon | Founded by a coin flip (1845); Lewis & Clark endpoint |
| VA | Virginia Beach | 4791259 | virginia | First landing 1607 (Cape Henry); resort city |
| AL | Birmingham | 4049979 | alabama | Civil rights: 1963 Children's Crusade; steel city |

## Priority 2 — India (high quiz volume; 3 already shipped)

| Place | Geonameid | Candidate hook angle |
|---|---|---|
| Kolkata | 1275004 | British India's first capital (until 1911); Howrah Bridge; Durga Puja |
| Chennai | 1264527 | Fort St. George 1644; Marina Beach (one of world's longest); filter coffee & Carnatic music |
| Bengaluru | 1277333 | Garden City to Silicon Valley of India; Kempe Gowda founding |
| Ahmedabad | 1279233 | Founded 1411 by Ahmed Shah; Gandhi's Sabarmati Ashram; UNESCO heritage city |
| Pune | 1259229 | Maratha capital under the Peshwas; "Oxford of the East" |
| Lucknow | 1264733 | Nawabs of Awadh; 1857 Residency siege; tehzeeb culture |
| Kanpur | 1267995 | Industrial city; 1857 uprising site |
| Surat | 1255364 | Mughal-era port; diamond polishing capital |
| Nagpur | 1262180 | Geographic center of India (Zero Mile Stone); oranges |
| Amritsar | 1278710 | Golden Temple 1589; Jallianwala Bagh 1919 |
| Udaipur | 1253986 | City of Lakes; Mewar capital; Lake Palace |
| Mysuru | 1262321 | Wodeyar palace; Dasara festival |

## Priority 3 — UK (2 shipped; London already covered)

| Place | Geonameid | Candidate hook angle |
|---|---|---|
| Glasgow | 2648579 | Shipbuilding "Second City of the Empire"; Charles Rennie Mackintosh |
| Birmingham | 2655603 | Workshop of the world; Watt's steam engine; canals |
| Liverpool | 2644210 | The Beatles; Albert Dock; Titanic registered port |
| Cambridge | 2653941 | University 1209 (Oxford feud hook already audited for Oxford note); Newton/Darwin |
| Bath | 2656173 | Roman baths; Georgian crescents; Jane Austen |
| York | 2633352 | Viking Jorvik; city walls; Minster |
| Cardiff | 2653822 | Coal port; Welsh devolution capital; castle |
| Belfast | 2655984 | Titanic built here (Harland & Wolff); shipbuilding |

## Notes for crews
- Verification workflow: fetch the English Wikipedia article, quote the
  article for each claim with line refs, save as `history-sources-<letter>.md`.
- No LLM-generated facts; no mutable claims (mayors, populations, "largest"
  claims unless a stable record); no subjective praise.
- Coordinate gate: use geonameids from the chunks only. Anchorage
  (5879092) is NOT in the built chunks — do not attach a note to it.
- Tulsa (4544349 in some sources) collides with Oklahoma City's existing
  note key — verify the real id from the chunk index before using.
- When a note ships, the chunk must be rebuilt
  (`scripts/build-geonames-dataset.mjs`) for it to render in-game; curation
  crews land the JSON + audit, the dataset crew rebuilds chunks.
