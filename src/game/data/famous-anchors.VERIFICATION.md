# famous-anchors.json — verification note (WS2, GIS Analyst)

**Method (offline, $0, no invented coordinates):** every entry's `id`, `lat`, `lon`
were copied verbatim from the repo's own GeoNames chunks
(`src/game/data/geonames/chunks/*.json`, 124,690 places). Lookup was
accent-insensitive exact name match filtered on the expected ISO-2 country
code. Each anchor then passed a data-driven Hyderabad-rule gate: its
coordinates lie inside the min/max lat/lon bounding box computed from ALL
chunk places with that same ISO-2 code (catches wrong-country matches and
lat/lon swaps). 200/200 candidates matched; 0 failed the bbox gate.

**Disambiguation rule** (14 cities have same-name twins in the chunks, e.g.
Paris FR vs Paris TX): lowest `difficulty` wins — the famous city is always
difficulty 1. Verified picks: Dallas TX gn-4684888, Houston TX gn-4699066,
Miami FL gn-4164138, Boston MA gn-4930956, Denver CO gn-5419384,
Atlanta GA gn-4180439, Philadelphia PA gn-4560349, San Diego CA gn-5391811,
San José CR (capital) gn-3621849, Perth WA gn-2063523, Anchorage AK gn-5879400,
Belém PA-BR gn-3405870, Las Vegas NV gn-5506956, Shenzhen gn-1795565.
Washington = the District of Columbia entry gn-4140963 (38.89511, -77.03637),
explicitly subdivision-filtered.

**Names that differ from the everyday spelling** (chunk names used verbatim for
traceability): Sevilla (Seville), Marrakesh (Marrakech), Bengaluru (Bangalore),
Ulan Bator (Ulaanbaatar), New York City, Acapulco de Juárez, Port-Vila,
Nuku‘alofa (Tonga capital — stored with the ʻokina as in GeoNames),
Kraków, Zürich, Mérida, San José, Montréal, São Paulo, Belém, Córdoba,
Valparaíso, Medellín, Asunción, Bogotá, Reykjavík, Nouméa.

**Replacements** (wanted city absent from chunks → substituted, never invented):
none needed — all 200 candidates were found. "Washington, D.C." is not a chunk
name; the DC-subdivision "Washington" entry was used instead.

**Acceptance:** 200 entries (T1=50, T2=75, T3=75); 6 continents;
top country United States 19/200 = 9.5% (≤15% cap); all 200 ids unique and
`gn-<n>` formatted, joinable to `src/game/data/geonames/chunks/*.json`.

**Tiers frozen at commit** per WS2 brief. Tiering followed the Research
Synthesist thresholds (T1 ≥80% kid recognition 5–7, T2 ≥60% 8–10, T3 ≥25%
floor 11–13); uncertain calls were placed LOWER (e.g. Venice T1 on landmark
fame; Giza T1 as the Pyramids anchor).
