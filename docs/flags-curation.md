# Flags curation record — Capitals & Flags

The per-file sourcing record for every flag in the Capitals & Flags
pack (issue #344, Flagstaff gate). Facts here are **sourced, never
manufactured**: each shipped flag traces to a Wikimedia Commons file
page whose licence was verified per-file at curation time, cross-checked
against the land's Wikidata flag property (P41, via its ISO identity —
P297 for countries, the ISO 3166-2 entity for US states) with current
values preferred over historical ones. A land with no licence-verified
flag inside the size budget stays **flagless** (table 2) — its flag is
never redrawn, substituted, or generated.

Policies recorded at curation:

- **Licence URL for public-domain files:** Commons' API returns no
  per-file licence URL for PD files, so every PD entry carries the
  standard Public Domain Mark URL
  (https://creativecommons.org/publicdomain/mark/1.0/) in the machine
  record (`scripts/packs/capitals/flags/registry.json`).
- **Size cap:** the design's hard cap is 10,240 bytes per file
  (DESIGN.md §8.4). Detailed state seals and coats of arms run
  100–644 KB of genuine path data on Commons, and no faithful
  simplified rendition is published for them (Flagpedia serves the
  Commons vectors as-is; flag-icons covers countries only). Those
  flags are licence-verified but held out until an SVG optimisation
  step is approved — see table 2. Two country flags (Egypt, Portugal)
  ship as flag-icons renditions (MIT, notice in
  `src/assets/flags/NOTICE.md`) of the same PD designs.
- **Mississippi:** the current (2021 "New Magnolia") flag's Commons
  file is licensed "Copyrighted free use", which is not on the
  Flagstaff allowlist — the land is flagless on licence alone
  (table 2). Identity and currency were verified.
- **Currency traps checked:** Minnesota (2024 redesign), Utah (2024),
  Mississippi (2021), Georgia-the-state vs Georgia-the-country file
  ambiguity.
- **Wave-2 curation correction:** the pack's unique-target gate
  forbids re-entry. Five picked capitals were dropped for
  duplicating core-deck targets by GeoNames placeId — Islamabad,
  Amman, Montevideo and Riga from the authored batch, plus Kuala
  Lumpur, picked in the first swap round and dropped in a second
  round for the same reason — and the four replacements that
  shipped are Dhaka, Algiers, Quito and Tunis, Tunis taking Kuala
  Lumpur's slot, so all 16 country cases are accounted for.
  Ecuador's verified flag is 279,145 bytes (coat of arms), so
  Ecuador is flagless on size (table 2).

## 1. Shipped flags (69, 80552 bytes total)

| flagKey | Land | Commons file | Licence | Bytes |
|---|---|---|---|---|
| `ae` | United Arab Emirates | [File:Flag of the United Arab Emirates.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_United_Arab_Emirates.svg) | Public domain | 323 |
| `ar` | Argentina | [File:Flag of Argentina.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Argentina.svg) | Public domain | 4994 |
| `at` | Austria | [File:Flag of Austria.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Austria.svg) | Public domain | 218 |
| `au` | Australia | [File:Flag of Australia (converted).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Australia_(converted).svg) | Public domain | 1592 |
| `bd` | Bangladesh | [File:Flag of Bangladesh.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Bangladesh.svg) | Public domain | 156 |
| `bg` | Bulgaria | [File:Flag of Bulgaria.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Bulgaria.svg) | Public domain | 288 |
| `br` | Brazil | [File:Flag of Brazil.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Brazil.svg) | Public domain | 4243 |
| `ca` | Canada | [File:Flag of Canada (Pantone).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Canada_(Pantone).svg) | Public domain | 720 |
| `cl` | Chile | [File:Flag of Chile.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Chile.svg) | Public domain | 592 |
| `cn` | China | [File:Flag of the People's Republic of China.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_People's_Republic_of_China.svg) | Public domain | 563 |
| `co` | Colombia | [File:Flag of Colombia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Colombia.svg) | Public domain | 255 |
| `cu` | Cuba | [File:Flag of Cuba.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Cuba.svg) | Public domain | 322 |
| `cz` | Czechia | [File:Flag of the Czech Republic.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Czech_Republic.svg) | Public domain | 275 |
| `de` | Germany | [File:Flag of Germany.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Germany.svg) | Public domain | 502 |
| `dk` | Denmark | [File:Flag of Denmark.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Denmark.svg) | Public domain | 186 |
| `dz` | Algeria | [File:Flag of Algeria.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Algeria.svg) | Public domain | 311 |
| `ee` | Estonia | [File:Flag of Estonia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Estonia.svg) | Public domain | 183 |
| `eg` | Egypt | [flags/eg.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Egypt.svg) | MIT (lipis/flag-icons rendition) | 8717 |
| `et` | Ethiopia | [File:Flag of Ethiopia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Ethiopia.svg) | Public domain | 864 |
| `fi` | Finland | [File:Flag of Finland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Finland.svg) | Public domain | 241 |
| `fr` | France | [File:Flag of France.svg](https://commons.wikimedia.org/wiki/File:Flag_of_France.svg) | Public domain | 193 |
| `gb` | United Kingdom | [File:Flag of the United Kingdom (3-5).svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_United_Kingdom_(3-5).svg) | Public domain | 477 |
| `gh` | Ghana | [File:Flag of Ghana.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Ghana.svg) | Public domain | 255 |
| `gr` | Greece | [File:Flag of Greece.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Greece.svg) | Public domain | 284 |
| `hu` | Hungary | [File:Flag of Hungary.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Hungary.svg) | Public domain | 197 |
| `id` | Indonesia | [File:Flag of Indonesia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Indonesia.svg) | Public domain | 148 |
| `ie` | Ireland | [File:Flag of Ireland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg) | Public domain | 282 |
| `in` | India | [File:Flag of India.svg](https://commons.wikimedia.org/wiki/File:Flag_of_India.svg) | Public domain | 848 |
| `iq` | Iraq | [File:Flag of Iraq.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Iraq.svg) | Public domain | 1204 |
| `ir` | Iran | [File:Flag of Iran.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Iran.svg) | Public domain | 2218 |
| `is` | Iceland | [File:Flag of Iceland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Iceland.svg) | Public domain | 281 |
| `it` | Italy | [File:Flag of Italy.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Italy.svg) | Public domain | 273 |
| `jp` | Japan | [File:Flag of Japan.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Japan.svg) | Public domain | 209 |
| `kr` | South Korea | [File:Flag of South Korea.svg](https://commons.wikimedia.org/wiki/File:Flag_of_South_Korea.svg) | Public domain | 589 |
| `ma` | Morocco | [File:Flag of Morocco.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Morocco.svg) | Public domain | 264 |
| `ng` | Nigeria | [File:Flag of Nigeria.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Nigeria.svg) | Public domain | 201 |
| `nl` | Netherlands | [File:Flag of the Netherlands.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Netherlands.svg) | Public domain | 223 |
| `no` | Norway | [File:Flag of Norway.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Norway.svg) | Public domain | 319 |
| `np` | Nepal | [File:Flag of Nepal.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Nepal.svg) | Public domain | 1523 |
| `nz` | New Zealand | [File:Flag of New Zealand.svg](https://commons.wikimedia.org/wiki/File:Flag_of_New_Zealand.svg) | Public domain | 2406 |
| `pe` | Peru | [File:Flag of Peru.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Peru.svg) | Public domain | 381 |
| `ph` | Philippines | [File:Flag of the Philippines.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Philippines.svg) | Public domain | 892 |
| `pl` | Poland | [File:Flag of Poland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Poland.svg) | Public domain | 199 |
| `pt` | Portugal | [flags/pt.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Portugal.svg) | MIT (lipis/flag-icons rendition) | 8001 |
| `ro` | Romania | [File:Flag of Romania.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Romania.svg) | Public domain | 297 |
| `ru` | Russia | [File:Flag of Russia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Russia.svg) | Public domain | 200 |
| `se` | Sweden | [File:Flag of Sweden.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Sweden.svg) | Public domain | 193 |
| `sg` | Singapore | [File:Flag of Singapore.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Singapore.svg) | Public domain | 591 |
| `th` | Thailand | [File:Flag of Thailand.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Thailand.svg) | Public domain | 259 |
| `tn` | Tunisia | [File:Flag of Tunisia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Tunisia.svg) | Public domain | 278 |
| `ua` | Ukraine | [File:Flag of Ukraine.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Ukraine.svg) | Public domain | 182 |
| `us` | United States | [File:Flag of the United States.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg) | Public domain | 823 |
| `us-ak` | Alaska | [File:Flag of Alaska.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Alaska.svg) | Public domain | 1233 |
| `us-al` | Alabama | [File:Flag of Alabama.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Alabama.svg) | Public domain | 181 |
| `us-ar` | Arkansas | [File:Flag of Arkansas.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Arkansas.svg) | Public domain | 6549 |
| `us-az` | Arizona | [File:Flag of Arizona.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Arizona.svg) | Public domain | 443 |
| `us-co` | Colorado | [File:Flag of Colorado.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Colorado.svg) | Public domain | 344 |
| `us-hi` | Hawaii | [File:Flag of Hawaii.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Hawaii.svg) | Public domain | 701 |
| `us-in` | Indiana | [File:Flag of Indiana.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Indiana.svg) | Public domain | 6764 |
| `us-md` | Maryland | [File:Flag of Maryland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Maryland.svg) | Public domain | 880 |
| `us-mn` | Minnesota | [File:Flag of Minnesota.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Minnesota.svg) | Public domain | 539 |
| `us-nm` | New Mexico | [File:Flag of New Mexico.svg](https://commons.wikimedia.org/wiki/File:Flag_of_New_Mexico.svg) | Public domain | 441 |
| `us-oh` | Ohio | [File:Flag of Ohio.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Ohio.svg) | Public domain | 1715 |
| `us-ri` | Rhode Island | [File:Flag of Rhode Island.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Rhode_Island.svg) | Public domain | 6031 |
| `us-tn` | Tennessee | [File:Flag of Tennessee.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Tennessee.svg) | Public domain | 871 |
| `us-tx` | Texas | [File:Flag of Texas.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Texas.svg) | Public domain | 594 |
| `us-ut` | Utah | [File:Flag of Utah.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Utah.svg) | Public domain | 2118 |
| `vn` | Vietnam | [File:Flag of Vietnam.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Vietnam.svg) | Public domain | 283 |
| `za` | South Africa | [File:Flag of South Africa.svg](https://commons.wikimedia.org/wiki/File:Flag_of_South_Africa.svg) | Public domain | 630 |

## 2. Flagless lands (41) — recorded, never silent

| flagKey | Reason |
|---|---|
| `ec` | Licence-verified on Wikimedia Commons (Public domain): verified Public domain flag is 279145 bytes, over the pack's 10 KB/file cap (DESIGN §8.4); would-be source: https://commons.wikimedia.org/wiki/File:Flag_of_Ecuador.svg (File:Flag of Ecuador.svg). No optimisation, simplification or redraw attempted. |
| `es` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 155900 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `hr` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 68547 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `mx` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 117180 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `rs` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 37943 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `sa` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 28593 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ca` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 165633 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ct` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 82193 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-de` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 107207 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-fl` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 215729 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ga` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 46749 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ia` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 131634 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-id` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 635725 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-il` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 103521 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ks` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 246258 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ky` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 135074 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-la` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 644360 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ma` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 127961 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-me` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 235299 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-mi` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 249626 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-mo` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 181345 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ms` | No licence-verified flag: the current flag's Commons file is licensed 'Copyrighted free use', which is not on the Flagstaff allowlist (Public domain / CC0 / CC-BY / CC-BY-SA), and the only allowlist-licensed alternative depicts a detail, not the flag. Identity and currency were verified (the 2021 'New Magnolia' design); an owner decision accepting that licence would make it shippable. |
| `us-mt` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 100982 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-nc` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 15524 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-nd` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 226892 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ne` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 337407 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-nh` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 105444 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-nj` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 207219 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-nv` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 131649 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ny` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 602215 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-ok` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 98310 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-or` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 169678 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-pa` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 480411 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-sc` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 30844 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-sd` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 210716 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-va` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 396007 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-vt` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 366151 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-wa` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 265320 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-wi` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 205787 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-wv` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 581809 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |
| `us-wy` | Licence-verified on Wikimedia Commons (Public domain), but the smallest faithful file is 187330 bytes — over the 10 KB/flag design cap (detailed seal/arms path data; no faithful simplified rendition published). Ships when an SVG optimisation step is approved. |

## 3. Verification

- `npm run check:flags` re-pins every shipped file's SHA-256, byte
  count, licence class, SVG sanity and aspect against this record, and
  checks the registry against the pack's subjects both ways (no
  orphans, no unrecorded gaps). It runs in `prebuild`.
- The contact-sheet eye gate (checker ≠ builder) passed on the shipped
  set at build time; the sheet is regenerated from
  `src/assets/flags/` whenever the set changes.
