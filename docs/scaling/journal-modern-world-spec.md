# Journal — The Modern World

- **Status:** GATED. Spec only. Stage B (films) stays shut until the owner lifts the build gate.
- **Branch:** `feat/journal-modern-world-spec`
- **Proposed clip count:** 3 — PROPOSED, not decided.
- **Screened:** 2026-11-10 against `k12-learning-design-standard.md` §7a.
- **Data:** `docs/scaling/journals/modern-world/clips.json` (contract I5, including the optional `stretch`) and `sources.md` (fact ids).
- **Mission:** every clip opens on a real question — where, how far, or how many years ago — so the math skill is the tool, not a worksheet (`k12-learning-design-standard.md` §0).

No film files. No `public/videos/journals/modern-world/manifest.json`. The integrator merges manifests later; this branch does not edit `public/videos/journal-manifest.json`.

## What changed in the screen

The previous draft had three stories: England's kingdoms becoming one country, the Age of Exploration, and the Industrial Revolution with children in factories. §7a says achievements and places, never politics, and when in doubt, cut. Council (architect, game designer, accessibility, skeptic) kept the topic — a measured place, a machine that joined two cities, a cable that joined two shores — and cut the political tellings. The educator seat is empty. Nobody here signed the rubric.

## CUT log (§7a)

| Cut | Why |
|---|---|
| Heptarchy and Æthelstan in 927, "how England became one country" | Nation-forming by taking kingdoms is politics, not an achievement or a place. Still contested. Not softened. |
| Columbus in 1492, "discover," empty lands, and a line on disease and loss of land | The public is divided. A fair telling still takes a side. Cut, not rewritten into a milder conquest. |
| Magellan's voyage as an exploration story | Same doubt. A distance-around-the-world film was considered and cut with it. |
| Children working in factories | Social conflict. The machine story does not need it. |
| Opening-day death, the prime minister on the train, the 1884 vote tally, any religious wording | Harm, politics, or religion. Left out even where a source mentions them. |
| Track length in miles | Not a content-screen cut. Sources disagree (below). Left out so no child is scored on a made-up length. |

## Kept clips (3, PROPOSED)

Same rules for each. Narration is the 7-10 film (short, read aloud). Contract I5 allows one `stretch`: a harder question after the retrieval, for 10-18, from a fact id in `sources.md`. 18+ gets that same stretch. A second older question is not stored. No algebra and no trigonometry in 7-10. No trigonometry anywhere here: no sourced angle, so none was invented. The stretch is multiplication, division, or a closest-estimate.

The film opens "Hey kids — have you heard about this place?" because `docs/journal-movies.md` requires that line. 18+ may skip the host sentence after the film (`k12-learning-design-standard.md` §1). The baked-in opening is an owner question (below), not a second film.

Loop (`k12-learning-design-standard.md` §3), same on every clip: the why-question (hook) → tap a guess (predict) → film (see) → one or two host sentences (explain) → one read-aloud retrieval. 10-18 and 18+ then get the stretch, also read aloud. A miss retries once with the host sentence, then the review deck. No timer in 7-10. No timer by default in any group.

Mastery (`k12-learning-design-standard.md` §4): confident = the post-clip check is correct on the first try. Misses use the existing deck and the `[0, 1, 3, 7, 14, 30]`-day ladder. Wiring into `src/game/review-deck.ts` is integrator-only (contract I2). Until then the journal would keep misses in its own module. Not built.

### 1. modern-world:greenwich-zero — where

- **Why (first line of play):** Where is the line maps call zero?
- **Objective (7-10):** After this, a child in 7-10 can locate the zero line, shown by a pin on the Royal Observatory, Greenwich.
- **C3:** `D2.Geo.1.3-5` — "Construct maps and other graphic representations of both familiar and unfamiliar places." Live 2026-11-10: [ESRI C3 excerpt](https://content.esri.com/esripress/steam-at-work/en/sam/sam-c3.pdf). That code matches the pin. The stretch is arithmetic, not a second code. 9-12 wording: UNVERIFIED (not fetched).
- **Place:** Royal Observatory, Greenwich. Pin 51.47687, −0.00041. [GeoNames 6295636](https://www.geonames.org/6295636/royal-greenwich-observatory.html). HIGH. The pin is the building. Kid copy does not say the GPS dot is exactly 0.
- **Facts the film may say:**
  - This line at Greenwich is the zero line on maps. It was set in 1884. [Royal Museums Greenwich](https://www.rmg.co.uk/stories/time/what-prime-meridian-why-it-greenwich). HIGH for the place and the year. The page also describes a vote. The vote is not in the film.
  - Not spoken, for the source note only: the observatory was founded in 1675 to measure longitude at sea; Airy's transit circle defined the Greenwich meridian from January 1851. Same RMG page. HIGH. Cut from the 10 seconds for length, not for doubt.
- **Retrieval (read aloud):** "Where is the zero line?" Answer: Greenwich, at the Royal Observatory.
- **Stretch (10-18, and 18+ get the same):** "A full turn is 360 degrees. The clock day has 24 hours. How many degrees is one hour?" Answer: 15. Fact `clock-model-15-degrees`. The 360 and the 24 are in the question. Clock model, not a claim about the exact spin of the Earth.
- **Use it elsewhere:** the same 15-degrees-per-hour step on a ship clock (geography). Everyday twin for 7-10: point to a place on a map and say if it is east or west of the zero line.
- **Globe:** Full and Lite fly the existing three.js globe to this pin (`import("three")` only inside the scene, as `home-globe.tsx` does). Flat shows a 2D disc and the same pin, no swoop. Reduced motion uses Flat. Learning is the same on all three tiers (`k12-learning-design-standard.md` §5.2).

### 2. modern-world:liverpool-manchester — how many years ago

- **Why:** How many years ago did a steam railway join Liverpool and Manchester?
- **Objective (7-10):** After this, a child in 7-10 can compute how many years ago 1830 was, shown by tapping the device year minus 1830. The device year is the clock, never a birthday (`k12-learning-design-standard.md` §7).
- **C3:** `D2.His.2.3-5` — "Compare life in specific historical time periods to life today." Live 2026-11-10: [Oregon C3 PDF](https://www.oregon.gov/ode/educator-resources/standards/socialsciences/Documents/C3-Framework-for-Social-Studies.pdf). That code matches the years-ago check. The stretch is arithmetic. 9-12 wording: UNVERIFIED (not fetched).
- **Place:** Liverpool, England. Pin 53.410556, −2.977778 (53°24′38″ N, 2°58′40″ W). [GeoNames search](http://www.geonames.org/search.html?q=Liverpool&country=GB). HIGH. One end of the line, not a claim about the other station.
- **Facts the film may say:**
  - In 1830 a steam railway joined Liverpool and Manchester. [Britannica](https://www.britannica.com/topic/Liverpool-and-Manchester-Railway). HIGH.
  - Host line after the film: it was the first railway in England to connect two major cities. Same page. HIGH.
  - Older checks only: in an 1829 trial the Rocket went 36 miles (58 km) per hour. Same page. HIGH for the trial, not for a timetable.
- **Length left out:** Britannica calls it a 30-mile line. [The Gazette](https://www.thegazette.co.uk/all-notices/content/100741) calls it a 35-mile line. Both seen 2026-11-10. The taught length is UNVERIFIED. No scored item uses it.
- **Retrieval (read aloud):** "The railway opened in 1830. How many years ago is that?" Answer: device year − 1830. COMPUTED, not a frozen number.
- **Stretch (10-18, and 18+ get the same):** "In an 1829 trial the Rocket went 36 miles in one hour. At that speed, how many miles in 2 hours?" Answer: 72. Fact `rocket-trial-36-mph`.
- **Use it elsewhere:** the same "how far in 2 hours" on a car trip (everyday travel). Later, speed on a ramp (physics) when that unit exists. 7-10 stays on the year subtraction plus the two city names.
- **Globe:** same three tiers. Flat pin on Liverpool.

### 3. modern-world:hearts-content-cable — how far

- **Why:** How far did a message have to go under the ocean to cross from Ireland to Newfoundland?
- **Objective (7-10):** After this, a child in 7-10 can locate where the 1866 cable came ashore, shown by a pin on Heart's Content.
- **C3:** `D2.Geo.1.3-5`, same source as clip 1. The stretch is an estimate, not a second code. 9-12 wording: UNVERIFIED.
- **Place:** Heart's Content Cable Station. Pin 47.872528, −53.368639. [Wikipedia](https://en.wikipedia.org/wiki/Heart%27s_Content_Cable_Station). MEDIUM. [HistoricPlaces.ca](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=3057) confirms the station and does not give a lat/lon. The heritage district page confirms a successful landing in Heart's Content in 1866.
- **Facts the film may say:**
  - In 1866 a cable under the sea reached Heart's Content, so a message could cross the ocean. Date and place: [IEEE milestone](https://ethw.org/Milestones:Landing_of_the_Transatlantic_Cable,_1866) (landed 27 July 1866; ship left Valentia, Ireland, 13 July 1866). HIGH.
  - Host line: this cable made an electrical link between Ireland and Newfoundland. HIGH, from the same milestone ("permanent electrical communications link"), said without "old world and new."
  - Older checks only, on the question card: 1,852 miles of that cable lay on the ocean floor after fourteen days. Same IEEE page. HIGH for those two figures. They are not converted into nautical miles here.
- **Retrieval (read aloud):** "Where did the 1866 cable come ashore in Newfoundland?" Answer: Heart's Content.
- **Stretch (10-18, and 18+ get the same):** "1,852 miles of cable were laid in 14 days. Which is closest to the miles per day: 100, 130, or 200?" Answer: 130. Fact `cable-1852-miles-14-days`. 14 × 132 = 1,848, so the true quotient is a little over 132. The check asks for the closest choice.
- **Use it elsewhere:** the same "split a long distance into days" on a map trip (geography). 7-10 only pins the place.
- **Globe:** same three tiers. Flat pin on Heart's Content.

## Captions and transcripts

Drafts, timed for a 10-second film, not yet spoken:

- `docs/scaling/journals/modern-world/greenwich-zero.vtt` and `.transcript.md`
- `docs/scaling/journals/modern-world/liverpool-manchester.vtt` and `.transcript.md`
- `docs/scaling/journals/modern-world/hearts-content-cable.vtt` and `.transcript.md`

Stage B retimes them against the real audio. Recipe: `docs/journal-movies.md` (10 s, 1152×768, 24 fps, h264 + AAC, no on-screen text, storyteller, limiter −1 dB). No new library.

## Globe fly-to and the Flat pin

One scene description for all three clips. Full: dynamic `import("three")`, camera moves to `place`, one pin, dispose on exit, pause when the tab is hidden. Lite: same pin and camera, no extra particles, cap 30 fps. Flat: a 2D disc (the reduced-motion disc the home globe already uses) and a pin at the same lat/lon. No swoop when `prefers-reduced-motion` or Save-Data is set. The question, the choices, and the score do not change with the tier. Nothing flashes. The pin is a tap target of at least 44 px. A live region says where the pin landed ("The pin is on Greenwich.").

## Readability

Local count on 2026-11-10, not a CI gate. Flesch-Kincaid grade (0.39 × words/sentences + 11.8 × syllables/words − 15.59) on the three narrations and the three 7-10 retrieval questions: 0.2, 3.7, 3.5 (narration) and 0.5, 2.7, 2.3 (questions). All under grade 5. Host lines stay one sentence. If a Stage B line scores over grade 5, cut it before anyone records.

## Bridges (subject map)

Builds on measurement and on telling where a place is (map step M1 / M3 in `subject-progression-map.md`). Environment link is the globe pin: a line used by ships, a railway across land, a cable under the sea. No plants, animals, or bodies. No campaign.

Economics only if a later round prices a ticket. Not in these three checks. No policy.

## K-12 STANDARD (`docs/scaling/k12-learning-design-standard.md`)

- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] where / years ago / how far, before the film's payoff
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] map pin is the application; bridge is measurement
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] stated per clip; not built
- Bands served: [x] 7-10 on the retrieval; 10-18 and 18+ also get the one I5 stretch
- Objective per item, observable verb, "shown by": [x]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] C3 live for the 7-10 check; 9-12 wording UNVERIFIED and not cited; no CCSS cited (not fetched)
- Loop mapped: hook / predict / see / explain / retry: [x]
- Mastery "confident" bar for this subject: [x] first-try retrieval
- Review-deck hookup (same deck, same ladder): [ ] integrator-only; not built
- Post-clip retrieval check (journal + any video): [x] one retrieval, plus one stretch for 10-18 and 18+, both read aloud
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] drafts; live region specified
- Privacy: no PII, no identifiers, local-only records: [x]
- Content screen (§7a) passed; cut items logged with reason: [x]
- Free: no revenue features; asset licences recorded: [x] no assets yet; Stage B is in-house or openly licensed, licence written next to the file
- Educator rubric (`docs/scaling/educator-gate-rubric.md`) attached: [x] unsigned

## Educator gate

The seat is empty. No agent signs. Evidence for a human: this spec, `clips.json`, the three transcripts, the retrieval wording, and (when Stage B exists) a short recording at each group. Rubric items 4, 4c, 5, and 17a are the ones this screen was written to pass. Item 4a/4b are specified, not playable yet.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-modern-world-spec.md (commit: unreleased)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

## Open questions for the owner

1. Keep these 3 after the cuts, or restore a cut story by name?
2. Who signs the rubric?
3. Stage B stays shut until you lift the build gate. Also still open from the old draft: does the 2026-11-08 listen count, or is a new listen required?
4. "Hey kids" is required by the movie recipe and sounds young for 18+. One film, or a second mix later?
5. Railway length stays out until a primary source picks 30 or 35. Leave it out?

## Stage B (not started)

When the gate lifts: films under `public/videos/journals/modern-world/`, manifest only at `public/videos/journals/modern-world/manifest.json`, recipe in `docs/journal-movies.md`. Still no edit to `public/videos/journal-manifest.json`. Playing them, and the fly-to, touches `src/` (journal player, globe). Those files are not this branch's. Ask the integrator before any of that.
