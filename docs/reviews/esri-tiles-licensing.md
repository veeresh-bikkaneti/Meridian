# Esri tile licensing review (WI-4)

Date: 2026-10-21. Docs only. No code, key, or proxy was changed or added.

Scope: the two keyless Esri endpoints the app calls straight from the browser.

| Layer | URL | Where used |
| --- | --- | --- |
| Satellite imagery | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | `src/map/imagery.ts` (all map editions), also `src/game/loop/LoopMap.tsx` |
| Place and border labels | `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` | `src/game/loop/map-labels.ts` (GeoDetective only) |

## 0. Read this first: how reliable this review is

I could not open a single primary page. From this VM every outbound host except
the search tool is blocked: `WebFetch` failed with `ENOTFOUND` for
`developers.arcgis.com`, `www.arcgis.com`, `services.arcgisonline.com`,
`www.esri.com`, `s2maps.eu`, `www.earthdata.nasa.gov` and `nasa-gibs.github.io`;
`curl` through the agent proxy got `403` on the CONNECT for all of the Esri,
NASA, EOX and Wikipedia hosts I tried. I did not try to route around that.

So everything below comes from **web-search result summaries read on
2026-10-21**. Those summaries quote or paraphrase the primary pages and name
them, but I did not see the pages themselves. Rules I followed:

- A claim is written as "per the search summary of `<URL>`". Short quotes are
  only what the summary itself quoted.
- Where the summaries disagreed or said nothing, the doc says "not found".
- No number or term is filled in from memory.

Before anyone acts on section 1 or 3, someone with normal internet access
should open the pages in the table at the end ("Reading list") and confirm. That
is a 15-minute job and it is the first owner action in section 6.

## 1. What is allowed for keyless direct tile use

**Short answer: I found no Esri text that permits an anonymous, keyless public
app to use these tile URLs. I found text that points the other way. Treat the
current setup as "not shown to be permitted", not as "forbidden".**

What the sources say (all via search summaries):

| Finding | Source (summary read 2026-10-21) |
| --- | --- |
| Basemaps listed under "For use without an API key" require "a valid ArcGIS Online organizational subscription or an ArcGIS Enterprise license". An Esri reply in the same thread says an ArcGIS Online account needs no key, but a developer account does. | Esri Community thread "Map without API key": https://community.esri.com/t5/arcgis-javascript-maps-sdk-questions/map-without-api-key/td-p/1106529 (it quotes Esri docs; the docs page itself was not reached) |
| With ArcGIS Location Platform, "all services must be authenticated", and API keys are described as the fit for public or read-only apps. | Location Platform FAQ: https://location.arcgis.com/faq/ |
| An ArcGIS Location Platform or ArcGIS Online account is needed to use the services. | https://location.arcgis.com/help |
| The World Imagery item says that beyond a narrow right to trace features and validate edits (vector data creation), "any and all other uses of the World Imagery map remain subject to" the Esri Master Agreement or Terms of Use. | World Imagery item text as quoted on https://wiki.openstreetmap.org/wiki/Esri and in the item pages (https://hub.arcgis.com/datasets/esri::world-imagery/about) |
| Esri product-specific terms (E300, dated 2025-11-13) say programmatic use of session tokens, "e.g. exporting volumes of basemap tiles", is not permitted. | https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf (via search excerpt only) |
| Esri blog (updated 2025-10-22): Location Platform is "better suited for commercial applications", ArcGIS Online is for collaboration; services from the two products cannot be mixed in one app unless a specific agreement allows it. | https://www.esri.com/arcgis-blog/products/developers/developers/arcgis-hosted-services-terms-of-use-pricing-differences (via search excerpt only) |
| Counter-evidence, weak: the OpenStreetMap wiki says Esri allows World Imagery in OSM mapping "without restrictions and requirements". That is about OSM tracing, is secondhand, and does not cover a game. | https://wiki.openstreetmap.org/wiki/Esri |

Reading of the above, in plain words:

- The "no key" path in Esri's own wording is tied to a paid ArcGIS Online
  organization or an Enterprise license. Meridian has neither.
- The path Esri offers to a developer with no organization is Location Platform
  with an API key.
- I did **not** find an official dated statement that explicitly allows or
  explicitly bans an unauthenticated public app hitting
  `server.arcgisonline.com`. The lack of a key is also not a technical block
  today (the tiles load), but "it loads" is not "it is licensed".
- I did **not** find any non-commercial or "free app" carve-out. Not finding it
  is not proof it does not exist; the full Master Agreement and the Terms of
  Use summary PDF (`https://downloads2.esri.com/arcgisonline/docs/tou_summary.pdf`)
  were not reached.
- The labels layer (`World_Boundaries_and_Places`) is a separate Esri service.
  I found nothing specific to it. Assume the same position as World Imagery
  until its item page says otherwise.

Risk if left as is: Esri could block the host for anonymous traffic, throttle
it, or ask the owner to stop. The WS-4 fallback (Scout outline map) already
covers a tile outage, which softens the damage but not the licensing question.

## 2. Attribution: what Esri wants vs what the app shows

### What Esri requires

Per the search summary of Esri's attribution docs
(https://developers.arcgis.com/documentation/esri-and-data-attribution and the
`interactive-maps` page under it; also
https://developers.arcgis.com/documentation/mapping-apis-and-services/deployment/basemap-attribution/):

| Part | What it says |
| --- | --- |
| Two kinds | **Esri attribution** ("Powered by Esri") and **data attribution** (every data provider name for the basemap or data service). Both are needed. |
| Where it counts | Applies when using any ArcGIS SDK, open-source library or third-party API with ArcGIS basemap or data services. Esri's own SDKs add it automatically; otherwise the developer adds it by hand. |
| Visibility (mandatory) | Clearly visible on the map or app, or in a window reachable from a menu or button. Not covered or blocked by other UI. Easy to find. |
| Placement and style (recommended, not mandatory) | Bottom-right; link "Esri" to esri.com; 12px or larger text, `#323232` on white at 65% opacity. |
| Names change | Provider names should be re-checked often because the providers can change. |

### What the provider string should say today

Two strings are in circulation (per the search summary of the service metadata
and Esri's data-appliance docs):

- The World Imagery **service metadata / copyright field** now credits
  "Esri, **Vantor**, Earthstar Geographics, and the GIS User Community".
  Source: https://elevation3d.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/info/metadata
  and the service page (via summary).
- Esri's **data-appliance docs** (2024, 2025, "latest") still say "Esri,
  **Maxar**, Earthstar Geographics, and the GIS User Community".
  Source: https://doc.arcgis.com/en/data-appliance/latest/maps/world-imagery.htm
  (via summary).
- A trade article says Vantor is the global satellite base of World Imagery
  alongside Airbus and Nearmap: https://geoawesome.com/esri-world-imagery-airbus-vantor-nearmap/
  I found no official Esri note confirming the rename.

I could not confirm which string Esri requires right now. The service's own
`copyrightText` is the thing to copy; it can be read with one request from any
machine with internet (see Reading list).

### What the app renders today

From `git grep -n -i -E "attribution|Esri|Maxar|Earthstar" -- src` (JSON data
chunks excluded):

| Where | What is shown | Notes |
| --- | --- | --- |
| `src/map/imagery.ts:4` `IMAGERY_ATTRIBUTION` | `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community` | Pinned by `src/map/imagery.test.ts:11-12`. Also in `README.md:170`. |
| `src/map/satellite-map.tsx:881` | MapLibre's own attribution control is **off** (`attributionControl: false`) | Replaced by a custom pill. |
| `src/map/satellite-map.tsx:1904-1945` | Collapsed pill reading `© Esri` plus an info icon. Tapping it opens a popover with the full `view.attribution`, the imagery privacy notice, and the GeoNames and Wikipedia credits. | The pill is **not rendered at all while `props.variation` is set**, i.e. whenever the reveal card or its "Result" restore pill is up (`satellite-map.tsx:1912`). |
| `src/game/loop/LoopMap.tsx:271` (GeoDetective imagery) | `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics` | Hard-coded copy. It **drops "and the GIS User Community"** and does not reuse `IMAGERY_ATTRIBUTION`. |
| `src/game/loop/map-labels.ts:17` `LOOP_LABELS_ATTRIBUTION` | `© Esri` | Only "Esri". No data-provider names for the labels layer (I do not know what its provider list is; not found). |
| `src/game/loop/LoopMap.tsx:288` | `attributionControl: { compact: true }` | MapLibre's collapsed "i" control carries the two strings above. |

### Does it match?

| Check | Result |
| --- | --- |
| "Esri" credit exists and is reachable from the map | Yes, through the pill or the compact control. |
| Visible "on the map or in a window reachable from a button" | Plausibly yes (a button opens the popover). Whether a collapsed "© Esri" pill counts as "clearly displayed" is Esri's call; I could not find a ruling. |
| Not covered by other UI | **Gap.** Hidden entirely during reveal (`variation != null`). The map is still on screen then. |
| Provider names match the service's current credit | **Unconfirmed, likely stale.** App says Maxar; service metadata says Vantor. |
| Same text on every map surface | **No.** GeoDetective is missing "and the GIS User Community", and the labels layer only says "© Esri". |
| "Powered by Esri" wording | Not present as such; the app uses "Tiles © Esri". Whether that satisfies the Esri-attribution rule was not found. |
| Hard-coded duplicates | Two copies of the imagery string (`imagery.ts` and `LoopMap.tsx`); a test pins only one. |

Conclusion: **partly matches.** The credit exists and is reachable, but it is
probably out of date (Maxar vs Vantor), inconsistent between screens, and hidden
during reveal. These are small fixes, but they are code changes, so they are
listed as follow-ups, not done here.

## 3. Volume and usage limits

| Item | Finding | Source |
| --- | --- | --- |
| Keyless direct use | **No published limit found.** No rate limit and no quota were found for anonymous tile requests. Absence of a number is not a promise of unlimited use. | search summaries above |
| Location Platform free tier, basemap tiles | "2,000,000 basemap tiles" per month free; then $0.15 per 1,000 tiles. | https://location.arcgis.com/help and https://www.esri.com/arcgis-blog/products/platform/announcements/basemap-sessions (via summary) |
| Location Platform, basemap **sessions** (the newer billing unit for Basemap Styles) | 1,000 sessions free, then $4 per 1,000. Different unit from tiles. | https://location.arcgis.com/pricing/ (via summary) |
| Beyond the free tier | Location Platform "requires activating pay-as-you-go and monthly billing" to go past the free tier. I read that as: no billing set up means no overage charge, but I did not see Esri state what happens at the cap. | Esri developer docs (via summary of https://developers.arcgis.com/documentation/glossary/arcgis-subscription/) |
| Free tier can change | Esri's FAQ says amounts change as services change. 2021 coverage said Esri had "no plans to adjust"; the later session pricing shows that is not binding. | https://location.arcgis.com/faq/ and https://digital.ebp.ch/2021/05/21/esri-devsummit-arcgis-platform/ |
| Bulk and programmatic tile pulls | Not permitted under E300 for session tokens (see section 1). Relevant if anyone ever pre-fetches or caches tiles in bulk. | E300 PDF |
| Is the free tier allowed for a public non-commercial app? | **Not found.** | n/a |

Rough scale check (my own estimate, not an Esri number): a phone or laptop map
view is about 15 to 30 tiles of 256 px, so 2,000,000 tiles is on the order of
70,000 to 130,000 fresh map views a month before any browser caching. For a
small kids' game that is probably ample, but it should be watched in the Esri
dashboard.

## 4. Free alternatives

All "fit" notes are for this app: a globe and flat map drawn with MapLibre from
raster tiles, kids 5 to 13 reading coastlines, rivers, mountains and cities from
above. Today's source layer allows zoom up to 19 (GeoDetective) and 23
(`satellite-map.tsx`, with edition caps lower).

| Option | Licence | Attribution | Limits found | Fit for this game |
| --- | --- | --- | --- | --- |
| **A. ArcGIS Location Platform, free tier, API key** (Static Basemap Tiles or Basemap Styles service; see https://developers.arcgis.com/rest/static-basemap-tiles/ and https://developers.arcgis.com/rest/basemap-styles/get-started/) | Esri terms. The key is sent as a `token` on each request. Terms for a free, non-commercial app were **not found**. | Same Esri + data-provider rules as section 2. | 2M tiles/mo free (or 1,000 sessions/mo free), see section 3. | Best. Same imagery look and detail, same zooms, raster tiles drop into the current MapLibre source. Open items: whether the labels layer has a keyed equivalent (not verified), and which exact service/URL to use. |
| **B. Sentinel-2 cloudless, EOX** (https://s2maps.eu, license page referenced as https://cloudless.eox.at/#license) | Per EOX posts: **2016 layer CC BY 4.0; 2018 to 2024 layers CC BY-NC-SA 4.0**. Free for non-commercial use with attribution; business use is separate. Offered "as is" with no warranty. Sources: https://eox.at/2025/03/sentinel-2-cloudless-2024/, https://eox.at/2023/10/sentinel-2-cloudless-2022/ | Year-specific, e.g. for 2024: `Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)`. Must be legible, near the use, with links online. | No rate limit or fair-use text found. Tile endpoint URL not read, so not stated here. | Good for globe and country views (clean, cloud-free colour). The data is 10 m class, so city-level zooms look soft compared with Esri (resolution not read from a primary page; flag as to-check). "NonCommercial" needs an owner call because the repo mentions an optional Ko-fi tip jar (`docs/ops/specs/share-card-copy.md:40`). ShareAlike should not bite for unmodified tiles, but that is a legal reading, not mine to settle. New third party. |
| **C. NASA GIBS** (https://www.earthdata.nasa.gov/gibs) | NASA open data policy (policy text not read). | NASA asks users to add an acknowledgment naming GIBS; the exact wording differs between sources (EOSDIS wording vs ESDIS/NASA-HQ wording), so copy it from the current GIBS page. | Endpoint pattern `https://gibs.earthdata.nasa.gov/{wmts\|wms\|twms}/epsg{4326\|3857\|3413\|3031}/{all\|best\|nrt\|std}`. Web Mercator (3857) supported. No auth and no rate limit were found in the summaries, and none were confirmed as absent. Layers have fixed max zoom; over-zooming returns "Bad Request". | Fine for the whole-Earth view only (coarse, MODIS-class imagery). Not usable for state or city rounds. Could serve as the far-zoom layer of a hybrid, which adds complexity. New third party. |
| **D. Self-host a low-res Earth image or Sentinel-2 tiles on our own hosting** | Depends on source: NASA data is open; EOX is the NC licence above. | As per source. | We pay for storage/bandwidth, so check against the $0 budget. | Already in the repo's plan as WS-4 Phase 2 (bundled low-res image, "licence check first, credit added") and Phase 3 (self-hosted Sentinel-2): `docs/ops/specs/ws-4-satellite-failure-phase1.md` (D-b). Zero third-party requests from kids' devices, but large effort and low detail. |

## 5. Recommendation

**Move to option A: an Esri ArcGIS Location Platform free-tier API key, using
Esri's keyed basemap tile service, with the attribution fixed. Keep option B
(Sentinel-2 cloudless 2016, the CC BY layer) as the fallback if the owner does
not want an Esri account.**

Why:

1. **No new third party.** Esri is already the imagery host and is already
   disclosed in `IMAGERY_NOTICE`. A keyed Esri tile call adds no new recipient
   of kids' IP addresses. B and C would add one each, and AGENTS.md requires
   owner approval for that.
2. **It is the supported route.** Esri says keyless basemap use belongs to
   paid-org or Enterprise accounts and that API keys are the method for public
   apps. A developer key puts Meridian on the path Esri documents.
3. **$0, with a natural stop.** 2,000,000 free tiles a month is far above the
   likely load (section 3). If pay-as-you-go is never turned on, my reading is
   that there is no card to charge; this must be confirmed in the dashboard.
4. **Keeps the product.** Same imagery, same zoom depth, same MapLibre raster
   source. B would soften city-level rounds and change the look; C only works
   for the whole-Earth view.
5. **Why not B first.** The 2018 to 2024 layers are non-commercial licensed.
   That probably suits a free game, but the optional Ko-fi tip jar makes "non
   commercial" a judgement call, and the CC BY 2016 layer is old. Good fallback,
   not the first move.

Caveats on the recommendation: whether Esri's free tier allows a free public
kids' app, and whether the labels layer has a keyed equivalent, were **not
confirmed** from any primary page. If either answer is no, switch the plan to B
for imagery (and look at labels separately; GeoDetective can already run with
the map hidden per WS-4).

### Effort (rough, for whoever builds it later)

| Task | Size |
| --- | --- |
| Create the Esri developer account, make a key scoped to basemap use, set referrer or allowed-origin limits if the dashboard offers them (not confirmed) | Owner, under an hour |
| Swap `IMAGERY_TILES` to the keyed URL, read the key from a build-time env var, never commit it | Small |
| Update `LoopMap.tsx` to reuse `IMAGERY_ATTRIBUTION` and the labels equivalent | Small |
| Update the attribution strings, pill visibility during reveal, `imagery.test.ts`, `README.md:170` | Small |
| The tile host in tests and scripts changes: about ten Playwright specs and scripts stub or abort `server.arcgisonline.com` (`tests/e2e/helpers.ts:93`, `tap-verify.spec.ts:43`, `pinch-zoom.spec.ts:69`, `ws4-tile-fallback.desktop.spec.ts:17`, `scripts/perf-globe-easy.mjs:165` and others) | Medium, mechanical |
| Re-run all gates (tsc, `npm test`, `lint-cards`, `build:pages`, Playwright) | Standard |

### Privacy angle (COPPA-sensitive, no personal info collected)

| Question | Answer |
| --- | --- |
| Do tile requests leak IPs to a third party? | **Yes, today and after.** Each tile request from a child's browser reaches Esri with the IP address, user agent, page referrer and the map area being viewed. `IMAGERY_NOTICE` already tells the user the imagery host sees the area on screen. A keyed Esri call does not change this. Only self-hosting (option D) removes it. |
| Does a key in client JS matter? | An API key for public apps is designed to be visible; it will appear in the shipped JS and in each tile URL. Risk is someone else spending the quota. It identifies the app to Esri, not the child. Keep it out of git, scope it as narrowly as the dashboard allows, and use the free tier with no pay-as-you-go so a leaked key cannot run up a bill (to be confirmed). |
| Does the key tie requests to a person? | No personal data is added by us. The Esri account itself belongs to the owner and holds the owner's details. |
| A proxy to hide IPs? | Would stop Esri seeing kids' IPs but then our server sees them, adds hosting, and may breach Esri's terms on programmatic tile use. Out of scope; not recommended. |
| Disclosure | The privacy notice and README should keep naming the imagery host. If the owner wants a legal view on COPPA and third-party IP exposure, that is a separate review, and this doc is not legal advice. |

## 6. Owner decisions needed

| # | Decision | Why it needs the owner |
| --- | --- | --- |
| 1 | **Approve the switch to a keyed Esri free-tier setup (option A), or choose B or D, or leave things as they are.** | Licence and platform choice. |
| 2 | **Create the Esri developer account** under whose name and email, and confirm it is on the free tier with pay-as-you-go **not** activated. | An account, possibly a card, and the owner's identity with Esri. |
| 3 | **Read and accept Esri's terms** for a free, non-commercial kids' app (Master Agreement, Terms of Use summary, Location Platform terms). I could not read them. | Agreeing to terms is the owner's act, and my review has gaps. |
| 4 | **Approve the key living in client JS** (and the scoping rules for it). | Security trade-off in a COPPA-sensitive app. |
| 5 | **Approve any new third party** if option B or C is chosen (EOX, NASA). | AGENTS.md: no new third parties without owner approval. |
| 6 | **If B: decide whether Ko-fi makes the game "commercial"** and whether the CC BY 2016 layer (old but unrestricted) is acceptable. | NonCommercial licence reading. |
| 7 | **Approve the attribution follow-up change** (current provider string, one shared constant, show credit during reveal, labels credit). | It is a code change and a visible UI change. |
| 8 | **Decide on interim risk** until the switch lands: leave as is, or bring forward the WS-4 Phase 2 bundled low-res image. | Risk appetite. |
| 9 | **Ask someone with internet to confirm the reading list below** before any of the above is acted on. | This review rests on search summaries only. |

## Reading list (verify before acting)

Read on a machine with open internet; none of these could be opened from this
VM on 2026-10-21.

| Page | What to confirm |
| --- | --- |
| https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson | `copyrightText` (Vantor or Maxar) and the "Terms of use" on the item page |
| https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9 | World Imagery item: access and use constraints |
| https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer?f=pjson | Labels layer: copyright text and terms |
| https://www.esri.com/en-us/legal/terms/full-master-agreement and https://downloads2.esri.com/arcgisonline/docs/tou_summary.pdf | Anything on anonymous use, free apps, non-commercial use |
| https://developers.arcgis.com/documentation/esri-and-data-attribution/interactive-maps/ | Exact attribution rules |
| https://location.arcgis.com/pricing/ and https://location.arcgis.com/faq/ | Current free tier, what happens at the cap, whether pay-as-you-go can stay off |
| https://developers.arcgis.com/rest/static-basemap-tiles/ | Keyed raster tile URL, imagery and labels styles, referrer restrictions |
| https://cloudless.eox.at/#license and https://s2maps.eu | Current licence per year, attribution, tile URL, any usage policy |
| https://www.earthdata.nasa.gov/gibs and the GIBS API pages on wiki.earthdata.nasa.gov | Acknowledgment wording, any rate limit |

## Sources seen (all via search summaries, none opened)

- https://community.esri.com/t5/arcgis-javascript-maps-sdk-questions/map-without-api-key/td-p/1106529
- https://community.esri.com/t5/arcgis-image-server-questions/arcgis-online-basemap-imagery-licensing/td-p/257788
- https://developers.arcgis.com/documentation/esri-and-data-attribution
- https://developers.arcgis.com/documentation/mapping-apis-and-services/deployment/basemap-attribution/
- https://developers.arcgis.com/rest/basemap-styles/get-started/
- https://developers.arcgis.com/rest/static-basemap-tiles/
- https://location.arcgis.com/help, https://location.arcgis.com/faq/, https://location.arcgis.com/pricing/
- https://www.esri.com/arcgis-blog/products/platform/announcements/basemap-sessions
- https://www.esri.com/arcgis-blog/products/developers/developers/arcgis-hosted-services-terms-of-use-pricing-differences
- https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf
- https://doc.arcgis.com/en/data-appliance/latest/maps/world-imagery.htm
- https://elevation3d.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/info/metadata
- https://geoawesome.com/esri-world-imagery-airbus-vantor-nearmap/
- https://wiki.openstreetmap.org/wiki/Esri
- https://eox.at/2025/03/sentinel-2-cloudless-2024/, https://eox.at/2023/10/sentinel-2-cloudless-2022/, https://maps.eox.at/
- https://www.earthdata.nasa.gov/gibs and wiki.earthdata.nasa.gov GIBS pages
