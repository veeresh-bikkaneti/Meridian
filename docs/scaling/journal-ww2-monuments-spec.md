# Journal — World War monuments (remembrance)

- **Status:** GATED. Spec only. No clips until a named educator signs and the owner lifts the build gate.
- **Branch:** `feat/journal-ww2-monuments-spec`
- **Proposed clip count:** 2 — PROPOSED, not decided.
- **Date:** 2026-11-10
- **Contract:** I5 in `docs/scaling/contracts.md`, including the optional `stretch` for an older group. Rows: `docs/scaling/journals/ww2-monuments/clips.json`. Fact ids: `docs/scaling/journals/ww2-monuments/sources.md`.
- **Standard:** cite `docs/scaling/k12-learning-design-standard.md` by section. Do not copy it.

Both kept places are quiet places of remembrance. The clip teaches a math question a child can check. It does not replay a battle.

## What changed from the previous draft

The previous draft on this branch led with rows of white crosses, D-Day landings, and a death count of 1,102. Those beats are cut. See the screen log. Facts below were read from the live pages on 2026-11-10, not from that draft.

## Clips kept (2, PROPOSED)

| id | group | opens with | scored check |
|---|---|---|---|
| `ww2-monuments:normandy-where` | 7-10 | how many years ago, and where | `labeledYear - 1956` |
| `ww2-monuments:arizona-how-far` | 10-18 | how far, and where | 18 steps of 10 feet, 4 feet left |

`labeledYear` is the calendar year the game shows on that day. The spec does not store a fixed gap. Example only, not a fact: if the label is 2026, then 2026 − 1956 = 70. 184 = 18 × 10 + 4.

18+ is not a third movie. It is the I5 `stretch` on the same clip (contract, 2026-11-10). The stretch group is older than the clip's group. Eight feet is a problem unit, not a site fact. The Normandy stretch uses fact `normandy-dedicated-1956`. The Arizona stretch uses fact `arizona-length-feet`.

### Age ladder (same two movies)

| Group | Normandy movie | Arizona movie |
|---|---|---|
| 7-10 | Scored year gap. Count back by tens, then ones. No timer. | If a younger player meets this movie: "Is 184 feet longer than 100 feet?" Answer yes. |
| 10-18 | Same year gap, multi-digit subtraction, no ten-frame. | Scored: 18 steps, 4 feet left. |
| 18+ | Extra card, not a new movie: how many tens are in the gap, and what is left over? | Extra card: groups of 8 feet in 184. 8 × 23 = 184, so 23 groups and 0 left. Eight is a problem unit, not a site fact. |

Grade 5 sits on the line between 7-10 and 10-18 (standard §1). The Normandy code is an end-of-grade-5 geography indicator, so it is tagged 7-10. The Arizona code is end-of-grade-8, so it is tagged 10-18.

## I5 rows

Machine-checked by `docs/scaling/journals/ww2-monuments/clips.test.mjs`.

### 1. Normandy American Cemetery

- **id:** `ww2-monuments:normandy-where`
- **group:** 7-10
- **objective:** After this, a child in the 7-10 group can compute how many years ago nineteen fifty-six was, shown by a year-difference equal to the labeled year minus 1956.
- **standard:** `D2.Geo.1.3-5` (partial fit, below). Math code: UNVERIFIED.
- **why:** How many years ago was this quiet place above the beach dedicated, and where is it?
- **place:** 49.358627, −0.854686 — Normandy American Cemetery, Colleville-sur-Mer, France
- **file (not made):** `public/videos/journals/ww2-monuments/normandy-where.mp4`
- **captions:** `docs/scaling/journals/ww2-monuments/normandy-where.vtt`
- **retrieval (read aloud):** "How many years ago was this place dedicated?" Answer rule: `labeledYear - 1956`. Tap choices, never free text. Distractors: the true gap plus 10, the true gap minus 10, and the true gap plus 1. No timer.

### 2. USS Arizona Memorial

- **id:** `ww2-monuments:arizona-how-far`
- **group:** 10-18
- **objective:** After this, a child in the 10-18 group can divide one hundred eighty-four feet into steps of ten feet, shown by answering 18 steps with 4 feet left.
- **standard:** `D2.Geo.1.6-8` (partial fit, below). Math code: UNVERIFIED.
- **why:** How far is it from one end of this memorial to the other, and where is it?
- **place:** 21.364817, −157.949918 — USS Arizona Memorial, Pearl Harbor, Hawaiʻi
- **file (not made):** `public/videos/journals/ww2-monuments/arizona-how-far.mp4`
- **captions:** `docs/scaling/journals/ww2-monuments/arizona-how-far.vtt`
- **retrieval (read aloud):** "How many steps of ten feet is one hundred eighty-four feet, and what is left over?" Answer: "18 steps, with 4 feet left." Ten feet is the problem's step, not a claim about how visitors walk.

## Sources (accessed 2026-11-10)

Spoken lines use only the facts in the "used" column.

| Fact | Source | Used in speech? |
|---|---|---|
| Normandy American Cemetery, Colleville-sur-Mer, France. Dedicated 1956. | ABMC, https://www.abmc.gov/normandy — "Dedicated 1956", town and country in the page heading | Year in the clip. Place name in the host line and the pin, not as the scored answer. |
| "overlooking the beach" | Same page: "An orientation table overlooking the beach…" | Glossed as "above the beach." The rest of that sentence (landings) is cut. |
| 172.5 acres; half-mile access road; burials 9389; "almost 9,400"; missing 1557 | Same page | No. An older ABMC search snippet said 9,380 burials. Counts disagree, so no count is taught. |
| Pin 49.358627, −0.854686 | OpenStreetMap Nominatim, relation 9390140, query "Normandy American Cemetery, Colleville-sur-Mer, France" | Pin only. |
| ABMC degree-minute string 49° 20′ 55″ N, 0° 51′ 17″ W | Appeared in a search snippet of the ABMC page. Not in the HTML fetched the same day. | No. UNVERIFIED. Not the pin. |
| Memorial is 184 feet long. Dedicated in 1962. | NPS, https://www.nps.gov/places/uss-arizona-memorial.htm — "The 184-foot-long memorial structure… The Memorial was dedicated in 1962." | 184 feet in the clip. 1962 is not spoken (one question only). |
| "over 900 of the ship's 1,177" on December 7, 1941 | Same NPS page | No. |
| 1,102 entombed | Older draft and a Wikipedia line. Not on the NPS page fetched today. | No. Do not teach it. |
| Pin 21.364817, −157.949918 | OpenStreetMap Nominatim, memorial node 14133830914, query "USS Arizona Memorial" | Pin only. NPS page fetched today printed no coordinates. |

C3 wording, read 2026-11-10 from the NCSS 2013 framework PDF hosted by the Oregon Department of Education (`C3-Framework-for-Social-Studies.pdf`). The file is encrypted, so this environment could not re-read the bytes. A public lesson page quotes the same 6–8 sentence (https://svhs.co/lesson/d2-geo-1-6-8/, accessed 2026-11-10).

- **D2.Geo.1.3-5.** Construct maps and other graphic representations of both familiar and unfamiliar places. (By the end of grade 5.)
- **D2.Geo.1.6-8.** Construct maps to represent and explain the spatial patterns of cultural and environmental characteristics. (By the end of grade 8.)

Partial fit, on purpose: the scored check is arithmetic. The code is the globe pin, which is a map of an unfamiliar place, not a full map the child draws. Rubric item 3 may be a Fix. Do not treat the code as a perfect match.

## Loop (standard §3)

1. **Hook.** The movie asks the problem in the first 5 seconds. It does not say the answer.
2. **Predict.** The child taps an answer before the host explains. Read aloud on for 7-10; available for the other groups.
3. **See.** The globe flies to the pin. Flat shows the same pin on a 2D map with no fly.
4. **Explain.** One or two short sentences (transcripts file). France is named here, after the predict, so the movie does not give the country away before the pin.
5. **Retry.** One miss, then one hint, then the shared review deck when the integrator wires it.

**Confident** for this journal (standard §4): correct retrieval on the first try, with no hint. A miss joins the same `[0, 1, 3, 7, 14, 30]`-day ladder. Wiring into `src/game/learning.ts` and `src/game/review-deck.ts` is integrator-only. Until then, Stage B would keep misses in the journal module.

## Globe fly-to (standard §5)

Same place and the same fact on every tier. Beauty changes. The question does not.

| Tier | What the child gets |
|---|---|
| Full | `import("three")` only, same pattern as `src/components/home-globe.tsx`. Camera eases to the lat/lon on `--ease-glide`. A pin drops. Dispose on exit. Pause when the tab is hidden. |
| Lite | Same globe and the same pin. Low poly, no shadows, cap 30 fps. |
| Flat | A 2D map (SVG or CSS). A pin at the same lat/lon. No camera swoop. |

`prefers-reduced-motion` and the reduced-motion hook use the Flat pin even when WebGL is available. Nothing flashes. The screen reader hears "Pin placed at [place name]." Arrow keys or buttons can face the pin. No drag required.

Art for Stage B, if the gate opens: in-house storybook frames from the spoken facts. Not a download of ABMC or NPS photos.

- Normandy frame: cliff, grass, a path, the beach below. No marker shapes, no crosses, no stars, no chapel, no flags, no boats, no soldiers.
- Arizona frame: a white span over blue water. No hull, no wreck, no smoke, no explosion.

## Bridge and use-it-elsewhere (standard §0)

- **Bridge.** Subtraction (year gap) and division (equal groups) are the math. The place is where the child uses them. Stable math unit ids are UNVERIFIED until those items exist. Do not invent ids.
- **Use it elsewhere.** The year gap is calendar time. The 10-foot steps are a stand-in for map scale (division on a length). The 18+ cards are the second setting. They are specified, not built.

## Accessibility and privacy (standard §6, §7)

- Captions (VTT) and a transcript for each clip. Host lines have the same words on screen.
- Tap targets at least 44 px. No timer in 7-10. Timers off unless the player opts in.
- No free text, no name, no age, no account. Choices only.
- Say "Hawaii" in speech. Print Hawaiʻi with the ʻokina on the pin. Say "Colleville-sur-Mer" slowly in the host line.
- Gloss once, in the host line, not as a lesson on dying: a cemetery is a place people are remembered.

Approximate Flesch-Kincaid on the caption files is checked in `clips.test.mjs` (7-10 at or under 5.5, 10-18 at or under 8). It is a script estimate, not a certified score.

## Content screen (standard §7a)

Kept: the two places, told as where they are and one sourced number each (1956, 184 feet).

Cut, and why:

| Cut | Why |
|---|---|
| White crosses, Stars of David, the circular chapel, the word shrine, "sacred" | Religion (standard §7a). The ABMC page names a circular chapel. NPS names a shrine room. Neither is spoken or drawn. |
| D-Day landings, boats, guns, soldiers, explosions, the hull of the ship | Battle re-enactment and graphic aftermath. Out. |
| Naming an attacking country, victory, defeat, presidents, Congress | Praising or blaming a nation, or a political story. Out. |
| Burial counts, "over 900", 1,177, 1,102, "killed", "dead" | Not needed for the question. Counts also disagree across ABMC pages. Death arithmetic is the wrong tone. |
| "70 years ago" as a site fact | Not on the ABMC page. The gap is computed from the labeled year. |
| Flags, the statue "Spirit of American Youth", visitor-center cost | Not needed, and easy to turn into praise. Out. |
| A trigonometry item | No sourced angle. Inventing one is forbidden. |

Council (architect seat not split out; four reviewer seats on the summary, 2026-11-10): do not drop either place. Fix was: no religious markers, no wreck, no death counts, no frozen "70 years." Those fixes are in this spec. Both clips stay. An open gap, not a cut: both places are in US history. A non-US monument would be a third clip. Count stays 2 PROPOSED.

## Stage B — not started

The owner has approved a build only for the math definition and the Phase 0 shell split (agent instructions). This journal stays spec-only until that gate is lifted in writing and the educator block below is signed.

When both are true, produce clips with `docs/journal-movies.md` into `public/videos/journals/ww2-monuments/`, plus `manifest.json` there. Do not edit `public/videos/journal-manifest.json`. The integrator merges entries.

Recipe tensions to confirm before any render, not resolved here:

1. The 106-movie recipe opens "Hey kids, have you heard about this place?" A 10-second learning clip cannot fit that and the question. These drafts open with the question (standard §0). Owner's call.
2. Voice, 1152×768, 24 fps, h264 + AAC, bed at 30%, limiter −1 dB: follow the recipe. No vendor names in this spec.
3. The old draft's v3-versus-v4 listen question is still open. Do not treat it as answered.

No `manifest.json` and no mp4 in this pass.

## K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)

- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x]
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] described (pin + year or length). Not built.
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] calendar gap and length groups, on paper
- Bands served: [x] 7-10, 10-18, and 18+ on the same two movies
- Objective per item, observable verb, "shown by": [x]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] C3 codes with a partial-fit note; math codes UNVERIFIED
- Loop mapped: hook / predict / see / explain / retry: [x]
- Mastery "confident" bar for this subject: [x] first try, no hint
- Review-deck hookup (same deck, same ladder): [ ] integrator (`learning.ts`, `review-deck.ts`)
- Post-clip retrieval check (journal + any video): [x]
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x] not built
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] specified
- Privacy: no PII, no identifiers, local-only records: [x]
- Content screen (§7a) passed; cut items logged with reason: [x]
- Free: no revenue features; asset licences recorded: [x] no assets yet. Pin coordinates from OpenStreetMap (ODbL). Stage B art is in-house.
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] not signed

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-ww2-monuments-spec.md (this commit)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

No agent signs this block.
