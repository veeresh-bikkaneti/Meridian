# Sports team data — sources & judgment calls

Verification date: **2026-10-01**

## League directories

The five official league team directories were the intended sources, but the
sandbox's fetch policy blocks all five league domains, so each was verified
against the documented fallback instead (substitution noted per the task).

| League | Official directory (blocked) | Fallback actually used |
|---|---|---|
| NFL (32 teams) | https://www.nfl.com/teams/ | https://en.wikipedia.org/wiki/Timeline_of_the_National_Football_League (2022–present 32-team table; cross-checked with the division-by-division franchise list) |
| MLB (30 teams) | https://www.mlb.com/teams/ | https://baseball.fandom.com/wiki/Major_League_Baseball (AL/NL × East/Central/West 30-team table, mirrors the league structure) |
| NBA (30 teams) | https://www.nba.com/teams | https://www.techbmc.com/list-of-nba-teams/ (alphabetical 30-team list) + https://www.aiscore.com/en/basketball/tournament-national-basketball-association/rn527rjsei1kevx/teams (division table) |
| NHL (32 teams) | https://www.nhl.com/teams | https://www.statmuse.com/nhl/team/2025-26-utah-mammoth-40/roster/2026 (full 2025–26 standings, all 32 clubs) |
| MLS (30 teams) | https://www.mlssoccer.com/teams/ | https://www.mlssoccer.com/news/ranking-all-30-mls-teams-by-tier-for-2025 (official MLS article enumerating all 30 clubs) |

Team names below are the official names as listed by those sources.

## Metro-anchor judgment calls

Rule: the city in the official team name maps to that city's place record.
Region/state-named teams map to the documented metro anchor. Every deviation
from "plays in the named city" is recorded here.

**NFL**
- Arizona Cardinals → Phoenix AZ (stadium in Glendale; metro anchor Phoenix)
- Buffalo Bills → Buffalo NY (stadium in Orchard Park)
- Carolina Panthers → Charlotte NC (region-named; documented metro anchor)
- Dallas Cowboys → Dallas TX (stadium in Arlington; metro anchor Dallas)
- Miami Dolphins → Miami FL (stadium in Miami Gardens)
- Minnesota Vikings → Minneapolis MN (state-named; Twin Cities anchor Minneapolis)
- New England Patriots → Boston MA (stadium in Foxborough)
- New York Giants, New York Jets → New York City NY (stadium in East Rutherford NJ)
- San Francisco 49ers → San Francisco CA (stadium in Santa Clara)
- Tampa Bay Buccaneers → Tampa FL ("Tampa Bay" → Tampa anchor)
- Tennessee Titans → Nashville TN (state-named; anchor Nashville)
- Washington Commanders → Washington DC — note: no district-of-columbia chunk
  exists; DC resolves to geonameid 4140963 ("Washington", capital of the United
  States) in `united-states.json`.

**MLB**
- Arizona Diamondbacks → Phoenix AZ (state-named; anchor Phoenix)
- Athletics → Sacramento CA — special case: the club dropped "Oakland" from its
  official name in 2025 and plays 2025–27 in West Sacramento pending a planned
  Las Vegas move. Mapped to the current home metro (Sacramento). **Time-sensitive:
  re-check if the Las Vegas relocation completes.**
- Colorado Rockies → Denver CO (state-named; anchor Denver)
- Kansas City Royals → Kansas City MO (metro anchor; MO side)
- Los Angeles Angels → Los Angeles CA (stadium in Anaheim)
- Minnesota Twins → Minneapolis MN (state-named; anchor Minneapolis)
- Tampa Bay Rays → Tampa FL (stadium in St. Petersburg)
- Texas Rangers → Dallas TX (stadium in Arlington; metro anchor Dallas per task)

**NBA**
- Brooklyn Nets → New York City NY (borough → NYC anchor)
- Golden State Warriors → San Francisco CA (plays in SF since 2019; region-named
  → SF anchor per task)
- Indiana Pacers → Indianapolis IN (state-named; anchor Indianapolis)
- Los Angeles Clippers → Los Angeles CA (arena in Inglewood)
- Minnesota Timberwolves → Minneapolis MN (state-named; anchor Minneapolis)
- Utah Jazz → Salt Lake City UT (state-named; anchor Salt Lake City)

**NHL**
- Carolina Hurricanes → Raleigh NC (plays in Raleigh; region-named → Raleigh anchor)
- Colorado Avalanche → Denver CO (state-named; anchor Denver)
- Florida Panthers → Miami FL (arena in Sunrise; Miami metro anchor per task)
- Minnesota Wild → Minneapolis MN (state-named; Twin Cities anchor Minneapolis;
  arena in Saint Paul — anchor kept consistent with the other Minnesota teams)
- New Jersey Devils → Newark NJ (arena in Newark; state-named → Newark anchor)
- New York Islanders → New York City NY (arena in Elmont)
- Utah Mammoth → Salt Lake City UT (state-named; anchor Salt Lake City). Name
  verified as the official 2025–26 name (franchise played 2024–25 as the
  Utah Hockey Club).
- Vegas Golden Knights → Las Vegas NV ("Vegas" → Las Vegas)

**MLS**
- Colorado Rapids → Denver CO (stadium in Commerce City; anchor Denver)
- FC Dallas → Dallas TX (stadium in Frisco)
- D.C. United → Washington DC (geonameid 4140963, see NFL note)
- Inter Miami CF → Miami FL (stadium in Fort Lauderdale)
- Sporting Kansas City → Kansas City MO (metro anchor; stadium is in Kansas City KS)
- LA Galaxy → Los Angeles CA (stadium in Carson)
- Los Angeles FC → Los Angeles CA — official club name is "Los Angeles Football
  Club"; displayed as the standard short name "Los Angeles FC"
- Minnesota United FC → Minneapolis MN (stadium in Saint Paul; anchor kept
  consistent with the other Minnesota teams)
- New England Revolution → Boston MA (stadium in Foxborough)
- New York Red Bulls → New York City NY (stadium in Harrison NJ)
- Philadelphia Union → Philadelphia PA (stadium in Chester)
- Real Salt Lake → Salt Lake City UT (stadium in Sandy)

**Canadian teams** (chunks: `canada.json`) — no judgment calls; city in name:
Toronto Blue Jays / Toronto Raptors / Toronto Maple Leafs / Toronto FC →
Toronto ON (gn-6167865); Montreal Canadiens / CF Montréal → Montréal QC
(gn-6077243, accent in dataset); Calgary Flames → Calgary AB (gn-5913490);
Edmonton Oilers → Edmonton AB (gn-5946768); Ottawa Senators → Ottawa ON
(gn-6094817); Vancouver Canucks / Vancouver Whitecaps FC → Vancouver BC
(gn-6173331); Winnipeg Jets → Winnipeg MB (gn-6183235).

**Dataset note:** Green Bay resolves to `gn-5254962` in `wisconsin.json` (the
dataset's GeoNames ID; the task brief's illustrative `5259466` is not the
dataset value). All cities matched by exact name within the correct state
chunk; where a chunk held duplicates, the record whose blurb marks it a city /
capital / county seat was preferred over a town record. No duplicate-name
ambiguities required a tiebreak in practice.

## Omitted teams

None. All 154 teams verified and mapped:
NFL 32 · MLB 30 · NBA 30 · NHL 32 · MLS 30 → 53 cities.
