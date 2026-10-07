# Quote-Widening Backlog — post-launch (NOT a gate)

**Status: post-launch backlog.** This list is future Option-C targeted-rework material (rework in slack time). It is explicitly **NOT a launch blocker**, and **T5 does not wait on it**. It exists because Veeresh's T3 verdict (2026-10-04, `reviews/t3-verdicts.md`) accepted the quote-widening disclosure + future guidance with **no batch rework**: the quotes below stand as recorded, each verbatim against its own stratum's input and re-validated 0-invalid.

## Membership rule (mechanical)

A published set is a member iff its accepted production record in `scripts/clues/production/records-tier2.jsonl` carries `tier2_input_stratum` of `phase2-short-extract` or `option-a-fuller-lead` — i.e. its tier-2 quote was recorded against a **single-extract, lead-only input shape**:

- `phase2-short-extract` — the crawl cache's short lead excerpt (median ~47 words).
- `option-a-fuller-lead` — the fuller article lead (median ~181 words), still lead-only.

Both are narrower than the fullest production input shape, `expansion-section` (fuller lead **plus** the article's Climate/Geography section as a second extract, which tier 2 could cite). "Widening" a member set means re-recording its tier-2 quote against the fuller/section input shape. Derivation: `mark-record-strata.mjs` (stratum = stage records file carrying the place as accepted) joined to the live published tree; indices below were re-derived from `public/loop/clues/*.json` at emission time (post-T1-repair indices).

## Count: 185 — and why it is not "~97"

The mechanical join yields **185 sets (63 phase2-short-extract + 122 option-a-fuller-lead)**, not ~97. The ~97 figure came from Chitti's post-delivery verification side via the build plan; no set-by-set enumeration of it exists in the branch artifacts (stated plainly in `reviews/t3-sampling-packet.md` §1), so it cannot be reproduced or subset-matched from branch evidence. Under the disclosure's own definition — the packet §1 wording: tier-2 quotes "recorded against the older, narrower lead extracts of the earlier production strata … rather than the tier-2 expansion run's inputs" — the population is exactly the two baseline strata, and it is 185. The count was **not** adjusted to fit the estimate; every set meeting the stated rule is listed, so nothing in the disclosure population is missed.

One distinction for whoever picks this up: the packet's 10 named quote-coverage samples mix two different issues. Eight of them (Denton, Imphal, Nairobi, Alor Setar, Khartoum, El Obeid, Birmingham, Brownsville) are **expansion-section** sets whose recorded tier-2 quotes are short or converter-truncated spans of a section extract — a quote-*span* narrowness, not an input-shape one. They are **not** in this backlog under the rule above (their input shape was the fullest). The two baseline samples are here: Bsharri (index 315) and Seward (index 377).

## The sets (185), by current published index

| Published index | Place | PlaceId | Tier-2 input stratum |
|---|---|---|---|
| 2 | Santa Cruz de la Sierra | `geonames:3904906` | option-a-fuller-lead |
| 9 | La Rioja | `geonames:3848950` | phase2-short-extract |
| 20 | Karaj | `geonames:128747` | phase2-short-extract |
| 34 | Norman | `geonames:4543762` | option-a-fuller-lead |
| 58 | Baguio | `geonames:1728930` | phase2-short-extract |
| 80 | Cúa | `geonames:3644918` | phase2-short-extract |
| 81 | Santiago del Estero | `geonames:3835869` | option-a-fuller-lead |
| 96 | Valletta | `geonames:2562305` | option-a-fuller-lead |
| 97 | Tirana | `geonames:3183875` | phase2-short-extract |
| 121 | Chennai | `geonames:1264527` | option-a-fuller-lead |
| 148 | Minneapolis | `geonames:5037649` | option-a-fuller-lead |
| 171 | Wenchang | `geonames:1791544` | phase2-short-extract |
| 175 | N'Djamena | `geonames:2427123` | option-a-fuller-lead |
| 176 | Niamey | `geonames:2440485` | option-a-fuller-lead |
| 177 | Bandung | `geonames:1650357` | phase2-short-extract |
| 180 | Daejeon | `geonames:1835235` | option-a-fuller-lead |
| 182 | Hermosillo | `geonames:4004898` | option-a-fuller-lead |
| 184 | Nice | `geonames:2990440` | option-a-fuller-lead |
| 185 | Potosí | `geonames:3907584` | option-a-fuller-lead |
| 186 | Vladivostok | `geonames:2013348` | option-a-fuller-lead |
| 187 | Bogor | `geonames:1648473` | option-a-fuller-lead |
| 188 | Xining | `geonames:1788852` | phase2-short-extract |
| 189 | Mannheim | `geonames:2873891` | option-a-fuller-lead |
| 190 | Punta Arenas | `geonames:3874787` | phase2-short-extract |
| 193 | Harbin | `geonames:2037013` | option-a-fuller-lead |
| 194 | La Paz | `geonames:3911925` | option-a-fuller-lead |
| 195 | Wiesbaden | `geonames:2809346` | option-a-fuller-lead |
| 196 | Denizli | `geonames:317109` | option-a-fuller-lead |
| 197 | Sucre | `geonames:3903987` | option-a-fuller-lead |
| 200 | Córdoba | `geonames:2519240` | option-a-fuller-lead |
| 201 | Probolinggo | `geonames:1630634` | option-a-fuller-lead |
| 202 | Antalya | `geonames:323777` | option-a-fuller-lead |
| 204 | Stavanger | `geonames:3137115` | option-a-fuller-lead |
| 205 | Pueblo | `geonames:5435464` | option-a-fuller-lead |
| 206 | Rasht | `geonames:118743` | option-a-fuller-lead |
| 207 | Stanley | `geonames:3426691` | phase2-short-extract |
| 208 | Punta Cana | `geonames:3494242` | option-a-fuller-lead |
| 209 | Bilbao | `geonames:3128026` | option-a-fuller-lead |
| 210 | Shillong | `geonames:1256523` | option-a-fuller-lead |
| 211 | Dehradun | `geonames:1273313` | phase2-short-extract |
| 214 | Keelung | `geonames:1678228` | phase2-short-extract |
| 215 | Ocumare del Tuy | `geonames:3631412` | option-a-fuller-lead |
| 216 | Shivpuri | `geonames:1256451` | option-a-fuller-lead |
| 217 | Norilsk | `geonames:1497337` | option-a-fuller-lead |
| 218 | Ankara | `geonames:323786` | option-a-fuller-lead |
| 219 | Tarija | `geonames:3903320` | option-a-fuller-lead |
| 220 | Lethbridge | `geonames:6053154` | option-a-fuller-lead |
| 222 | Khabarovsk | `geonames:2022890` | phase2-short-extract |
| 223 | Mpanda | `geonames:153176` | option-a-fuller-lead |
| 224 | Saint-Louis | `geonames:2246452` | option-a-fuller-lead |
| 225 | Hsinchu | `geonames:1675151` | phase2-short-extract |
| 228 | Białystok | `geonames:776069` | option-a-fuller-lead |
| 229 | Dili | `geonames:1645457` | option-a-fuller-lead |
| 230 | Taiping | `geonames:1734586` | option-a-fuller-lead |
| 231 | Myingyan | `geonames:1307835` | option-a-fuller-lead |
| 232 | Villavicencio | `geonames:3665900` | option-a-fuller-lead |
| 235 | Trondheim | `geonames:3133880` | option-a-fuller-lead |
| 236 | Latacunga | `geonames:3654870` | option-a-fuller-lead |
| 238 | Kunming | `geonames:1804651` | option-a-fuller-lead |
| 239 | Amasya | `geonames:752015` | option-a-fuller-lead |
| 240 | Almería | `geonames:2521886` | option-a-fuller-lead |
| 241 | Copiapó | `geonames:3893656` | phase2-short-extract |
| 242 | Torremolinos | `geonames:2510281` | option-a-fuller-lead |
| 243 | La Esperanza | `geonames:3607966` | phase2-short-extract |
| 245 | Gävle | `geonames:2712414` | option-a-fuller-lead |
| 247 | Upington | `geonames:945945` | option-a-fuller-lead |
| 249 | Blenheim | `geonames:6243926` | phase2-short-extract |
| 250 | Ifrane | `geonames:2546917` | phase2-short-extract |
| 251 | Sandanski | `geonames:727447` | phase2-short-extract |
| 252 | Greenville | `geonames:2276600` | option-a-fuller-lead |
| 254 | Whitehorse | `geonames:6180550` | option-a-fuller-lead |
| 255 | Malmesbury | `geonames:3364346` | option-a-fuller-lead |
| 256 | Magadan | `geonames:2123628` | option-a-fuller-lead |
| 260 | Teruel | `geonames:3108126` | phase2-short-extract |
| 261 | Kawambwa | `geonames:176555` | option-a-fuller-lead |
| 262 | Pagar Alam | `geonames:1633308` | option-a-fuller-lead |
| 263 | Fier | `geonames:3185672` | option-a-fuller-lead |
| 264 | Eureka | `geonames:5563397` | option-a-fuller-lead |
| 266 | Sisimiut | `geonames:3419842` | option-a-fuller-lead |
| 268 | Vercelli | `geonames:3164565` | phase2-short-extract |
| 269 | Mollendo | `geonames:3934707` | phase2-short-extract |
| 270 | Fairbanks | `geonames:5861897` | option-a-fuller-lead |
| 272 | Akureyri | `geonames:2633274` | option-a-fuller-lead |
| 273 | Usulután | `geonames:3582883` | option-a-fuller-lead |
| 274 | Erie | `geonames:5188843` | option-a-fuller-lead |
| 275 | Guarda | `geonames:2738785` | option-a-fuller-lead |
| 276 | Lalibela | `geonames:332288` | option-a-fuller-lead |
| 277 | Paphos | `geonames:146214` | option-a-fuller-lead |
| 278 | Alushta | `geonames:713513` | option-a-fuller-lead |
| 279 | Arakkonam | `geonames:1278471` | option-a-fuller-lead |
| 280 | Torquay | `geonames:2635650` | option-a-fuller-lead |
| 281 | Safed | `geonames:293100` | option-a-fuller-lead |
| 282 | Vorkuta | `geonames:1486910` | phase2-short-extract |
| 283 | Wenling | `geonames:1791464` | phase2-short-extract |
| 284 | Tukuyu | `geonames:149437` | phase2-short-extract |
| 285 | Évora | `geonames:2268406` | phase2-short-extract |
| 286 | Puerto Peñasco | `geonames:3991347` | phase2-short-extract |
| 288 | Alice Springs | `geonames:2077895` | option-a-fuller-lead |
| 289 | Estepona | `geonames:2517816` | option-a-fuller-lead |
| 290 | Cocieri | `geonames:618057` | option-a-fuller-lead |
| 291 | Murree | `geonames:1169684` | phase2-short-extract |
| 292 | Cleethorpes | `geonames:2652885` | phase2-short-extract |
| 293 | Pato Branco | `geonames:3454818` | option-a-fuller-lead |
| 295 | Santiago de Compostela | `geonames:3109642` | phase2-short-extract |
| 296 | Kongoussi | `geonames:2359142` | option-a-fuller-lead |
| 297 | Pomasqui | `geonames:3652977` | option-a-fuller-lead |
| 298 | Hınıs | `geonames:312114` | option-a-fuller-lead |
| 299 | Machachi | `geonames:3654536` | option-a-fuller-lead |
| 300 | Palenque | `geonames:3522164` | option-a-fuller-lead |
| 301 | Puyo | `geonames:3652584` | option-a-fuller-lead |
| 302 | Launceston | `geonames:2160517` | option-a-fuller-lead |
| 304 | Am Timan | `geonames:245338` | option-a-fuller-lead |
| 305 | Iqaluit | `geonames:5983720` | option-a-fuller-lead |
| 306 | Techiman | `geonames:2294727` | option-a-fuller-lead |
| 307 | Nyköping | `geonames:2687700` | option-a-fuller-lead |
| 308 | Iriba | `geonames:243590` | option-a-fuller-lead |
| 309 | Huancavelica | `geonames:3939470` | phase2-short-extract |
| 310 | Tiquipaya | `geonames:3902949` | option-a-fuller-lead |
| 311 | Comox | `geonames:5926432` | option-a-fuller-lead |
| 312 | Villiersdorp | `geonames:3359957` | phase2-short-extract |
| 313 | Alexandria | `geonames:1023365` | phase2-short-extract |
| 315 | Bsharri | `geonames:276359` | option-a-fuller-lead |
| 316 | Brocklehurst | `geonames:5909278` | phase2-short-extract |
| 318 | Bartow | `geonames:4146723` | phase2-short-extract |
| 319 | San Antonio Oeste | `geonames:3837980` | option-a-fuller-lead |
| 320 | Catriel | `geonames:3862254` | option-a-fuller-lead |
| 321 | Sabie | `geonames:958441` | option-a-fuller-lead |
| 323 | Sarandë | `geonames:363243` | phase2-short-extract |
| 325 | Kuruman | `geonames:986134` | phase2-short-extract |
| 327 | Mejillones | `geonames:3880143` | phase2-short-extract |
| 328 | Pica | `geonames:3876353` | option-a-fuller-lead |
| 329 | Campbellton | `geonames:6696258` | phase2-short-extract |
| 331 | Los Alcázares | `geonames:2514868` | option-a-fuller-lead |
| 332 | Monte Hermoso | `geonames:3843843` | phase2-short-extract |
| 333 | El Bolsón | `geonames:3858765` | phase2-short-extract |
| 334 | Jalostotitlán | `geonames:4004153` | option-a-fuller-lead |
| 335 | Angleur | `geonames:2803183` | phase2-short-extract |
| 336 | Ilha de Itamaracá | `geonames:3397963` | option-a-fuller-lead |
| 337 | Dolores | `geonames:2518842` | option-a-fuller-lead |
| 338 | Juan Rodríguez Clara | `geonames:3520214` | option-a-fuller-lead |
| 339 | Dārzciems | `geonames:13192644` | phase2-short-extract |
| 341 | Kittilä | `geonames:652590` | option-a-fuller-lead |
| 342 | Vredendal | `geonames:3359736` | option-a-fuller-lead |
| 344 | Port Townsend | `geonames:5807239` | phase2-short-extract |
| 345 | Guadarrama | `geonames:3121058` | option-a-fuller-lead |
| 346 | Motueka | `geonames:2184361` | phase2-short-extract |
| 347 | Tewkesbury | `geonames:2636071` | option-a-fuller-lead |
| 348 | Buarcos | `geonames:2741961` | phase2-short-extract |
| 349 | Portage la Prairie | `geonames:6111529` | phase2-short-extract |
| 350 | Jindabyne | `geonames:2162255` | option-a-fuller-lead |
| 351 | Ixtlán del Río | `geonames:4004267` | option-a-fuller-lead |
| 352 | Alto Garças | `geonames:3472448` | option-a-fuller-lead |
| 353 | Warmbad | `geonames:3352263` | phase2-short-extract |
| 354 | Park City | `geonames:5779451` | option-a-fuller-lead |
| 355 | Tombel | `geonames:2221408` | option-a-fuller-lead |
| 356 | Avanos | `geonames:322965` | option-a-fuller-lead |
| 357 | Hakuba | `geonames:8630153` | option-a-fuller-lead |
| 358 | Calçoene | `geonames:3403899` | phase2-short-extract |
| 359 | Wépion | `geonames:2783850` | phase2-short-extract |
| 360 | Las Cumbres | `geonames:3706567` | option-a-fuller-lead |
| 362 | San Sebastiano al Vesuvio | `geonames:3167742` | phase2-short-extract |
| 363 | Bom Jardim de Minas | `geonames:3469455` | option-a-fuller-lead |
| 364 | Chhachhrauli | `geonames:1274380` | phase2-short-extract |
| 365 | Port Royal | `geonames:3488980` | option-a-fuller-lead |
| 366 | Rosendal | `geonames:959172` | option-a-fuller-lead |
| 367 | Starocherkasskaya | `geonames:488864` | option-a-fuller-lead |
| 368 | Medkovets | `geonames:729174` | option-a-fuller-lead |
| 369 | Lloró | `geonames:3676477` | phase2-short-extract |
| 370 | Williamstown | `geonames:2058304` | phase2-short-extract |
| 371 | Falfurrias | `geonames:4690070` | option-a-fuller-lead |
| 372 | Costa Calma | `geonames:6544327` | phase2-short-extract |
| 373 | Fauresmith | `geonames:1004406` | phase2-short-extract |
| 374 | Lismore | `geonames:2160063` | option-a-fuller-lead |
| 375 | Los Silos | `geonames:2514452` | phase2-short-extract |
| 376 | Seefeld in Tirol | `geonames:2765278` | option-a-fuller-lead |
| 377 | Seward | `geonames:5873776` | option-a-fuller-lead |
| 378 | Cortina d'Ampezzo | `geonames:3177952` | option-a-fuller-lead |
| 379 | Fermont | `geonames:5952337` | option-a-fuller-lead |
| 380 | Dosrius | `geonames:3123801` | option-a-fuller-lead |
| 381 | Dégelis | `geonames:6945985` | phase2-short-extract |
| 382 | Molina de Aragón | `geonames:3116595` | phase2-short-extract |
| 383 | Brandvlei | `geonames:1015850` | phase2-short-extract |
| 384 | Tignes | `geonames:2972607` | phase2-short-extract |
| 385 | Coober Pedy | `geonames:2073985` | phase2-short-extract |
| 386 | Risan | `geonames:3191631` | phase2-short-extract |

---
*Emitted 2026-10-04 by Liz's crew (coordinator: agents_orchestrator persona) from the stratum-marked production records at the T3-verdict follow-through. Membership and indices machine-derived; see `mark-record-strata.mjs` for the stratum derivation rule.*
