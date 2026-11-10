# Journal — People & Places

- **Topic:** People and places that make a distance, a count, or a height need math.
- **Status:** GATED. No educator has signed. Stage B (video files) stays closed.
- **Branch:** `feat/journal-people-places-spec`
- **Proposed clip count:** 5 — PROPOSED, not decided.
- **Screened:** 2026-11-10 against standard §7a. None of the five earlier drafts is kept.
- **Contract rows:** [`journals/people-places/clips.json`](journals/people-places/clips.json). If this prose and that file disagree, the file wins.
- **Counting year for any "years ago" line:** 2026, named in the problem, never a hidden "now".

Mission: a child should see why multiplication, division, a rate, or trigonometry is useful. Each clip opens on a real question — how far, how many, or where — before the skill is used. Standard §0 and §2. No algebra and no trigonometry in the 7-10 group (standard §1, progression map age note).

## What was cut (§7a)

Dropped, not softened. Reasons also live in `clips.json` under `cuts`.

| Draft | Verdict | Why |
|---|---|---|
| Maya culture (sacred calendar, Tikal as a ceremonial center) | CUT | Religion and religious practice. Temples, priests on stelae, and a sacred 260-day calendar cannot be taught as a neutral counting lesson without softening a cut. The old Britannica link pointed at an Aztec article. Population figures conflict and are unused. |
| Shaolin Temple | CUT | A Buddhist monastery and monks at prayer are religious practice. |
| Bodhidharma | CUT | The story is the start of Chan (Zen). It cannot be told without religion. The nine-years tale stays out. |
| Vivekananda at the Parliament of Religions | CUT | The event and the theme are religion. |
| Zeus | CUT | Mythology. Owner ruling: religion, pilgrimage, and mythology are out. Not retold as a parable. |

Also left out of narration even where a source mentions them: Agrippa and Augustus (politics, not the arch count); the 1995 earthquake; Inca defence, conquest, and religious sites; any kilometer size for Eratosthenes' Earth; any single height for Aconcagua.

Chichén Itzá, the Eiffel Tower, Giza, the Golden Gate, and Machu Picchu are already in the 106. They are not reused.

## Kept set (5, PROPOSED)

| Clip | Group | Skill | Opens with | C3 code |
|---|---|---|---|---|
| `akashi-span` | 7-10 | multiplication | how far | D2.Geo.2.3-5 |
| `pont-du-gard` | 7-10 | multiplication | how many | D2.Geo.1.3-5 |
| `eratosthenes-earth` | 10-18 | proportion (× 50) | how far | D2.Geo.3.9-12 |
| `andean-roads` | 10-18 | rate (distance ÷ day) | how far | D2.Geo.3.6-8 |
| `aconcagua-height` | 18+ | trigonometry | where | UNVERIFIED |

Grade check: the 3–5 codes match 7-10 (grades 2–5). The 6–8 and 9–12 codes match 10-18 (grades 5–12). Grade 5 may sit in either group; these 3–5 items stay in 7-10 because the arithmetic is equal groups, not a formula. C3 pathways inspected on 2026-11-10 stop at grade 12, so the adult clip is UNVERIFIED rather than given a 9–12 code.

**Andean roads is the closest call.** UNESCO's own page also says "defence" and "sites of religious significance." The clip teaches only the length (about 30,000 km; the brief says "more than") and a practice rate. Religion, armies, and conquest are not in the child-facing lines. An educator may still Fail rubric item 17a. Until then it stays, flagged.

### What each clip teaches

Numbers below are the ones the game may say. Sources, conflicts, and "do not teach" lists are on the clip in `clips.json`.

1. **Akashi Kaikyo Bridge** (7-10). How far from tower to tower? Middle span **1,991 meters**. The two side spans are **960 meters** each, so together they are **1,920 meters**. Opened 5 April 1998 (not asked as "years ago", so the answer does not rot). Pin: 34.616 N, 135.021 E (gazetteer, rounded).
2. **Pont du Gard** (7-10). How many arches on the top row? **35.** Practice frame only: 5 groups of 7. Bottom row 6, middle row 11. Height and build year are **not** taught (sources disagree). Pin: 43.947 N, 4.535 E.
3. **Eratosthenes** (10-18). How far from Alexandria to Syene? The Cleomedes account uses **5,000 stadia** and **1/50** of a circle, so **50 × 5,000 = 250,000 stadia**. Other ancient accounts say 252,000. No kilometer conversion. Pin: Alexandria, 31.202 N, 29.916 E (modern city center).
4. **Andean road network** (10-18). How far? **About 30,000 kilometers.** Practice rate, not history: 100 km a day → **300 days**. Countries named in the explain line. Pin: Cusco, 13.517 S, 71.979 W, one city on the network, not the whole of it.
5. **Aconcagua** (18+). Where is the highest peak in the Americas? Argentina, on the Chilean border. Published heights **do not agree** (6,959 m on the Argentine figure Britannica quotes; a 2001 report of 6,962 m was not adopted; a later paper says 6,960 m). Practice triangle only: 100 m ground distance, 45°, tangent 1, height **100 m**. That triangle is not a survey of the mountain. Pin: 32.653 S, 70.012 W.

## Loop (standard §3 and §4)

For every clip, in order:

1. **Hook / predict.** The on-screen prompt (`predict`) is read aloud. The child taps an answer before the clip.
2. **See.** The 10-second clip (narration + globe). Full and Lite fly the existing three.js globe (`import("three")` only inside mount, as `home-globe.tsx` does). Flat, Save-Data, and `prefers-reduced-motion` show a 2D pin at the same lat/lon. No swoop on Flat. Pause when the tab is hidden. Dispose on exit.
3. **Explain.** One or two sentences (`explain`), read aloud on demand.
4. **Retrieval.** One read-aloud question (`retrieval`) about a fact the narration said. A correct first try with no hint is the confident bar (standard §4, journal).
5. **Retry.** One hint (`hint`), then the same review deck and the same `[0, 1, 3, 7, 14, 30]`-day ladder. No second deck. No timer in 7-10. Timers off unless the player opts in.
6. **Use it elsewhere.** A later card (`elsewhere`) uses the same skill in geography, everyday bricks, or a physics ramp or trip. Those numbers are the game's, and the files say so.

Learning parity: Full, Lite, and Flat ask the same question and score the same answer. Beauty changes. Content does not.

## Captions and transcript

Spoken words are the `narration` string. Captions (timings PROPOSED until a real voice exists):

- `docs/scaling/journals/people-places/captions/<clip>.vtt`
- transcript: `docs/scaling/journals/people-places/captions/<clip>.txt`

Stage B copies them beside the mp4. Recipe, when the owner lifts the gate: `docs/journal-movies.md` (10 s, 1152×768, 24 fps, h264 + AAC, no on-screen text, tap to play). Manifest for that day: `public/videos/journals/people-places/manifest.json`. Do not edit `public/videos/journal-manifest.json` on this branch.

Read-aloud is on by default for 7-10. Every prompt has text. The pin has a screen-reader name (the place name). No drag is required.

## Readability

`node docs/scaling/journals/people-places/readability.mjs` prints a Flesch-Kincaid grade (heuristic, about ±1). Limits: 7-10 → 5, 10-18 → 12, 18+ → 14. All six child-facing fields passed on 2026-11-10.

## Checks

```
node --test docs/scaling/journals/people-places/clips.test.mjs
node docs/scaling/journals/people-places/readability.mjs
```

## Council (design pass, 2026-11-10)

- **Architect.** Rows follow contract I5. Shared files were not edited. The globe reuses the house stack (standard §5.1). No new library.
- **Game designer.** The 10-second narration cannot hold the whole lesson. The predict step is before the clip. The retrieval step asks only what the narration said.
- **Accessibility.** Captions, transcript, read-aloud, a named pin, no timer for 7-10, Flat still pins the same place.
- **Skeptic.** All five drafts fail §7a or the mythology ruling. Conflicting heights, dates, and stadion lengths are not averaged into a fake fact. The Andean clip is the one an educator might still cut.

## K-12 standard block

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] predict prompt before each clip
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] buildsOn + realLife on each row
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] elsewhere on each row
- Bands served: [x] 7-10 (2), 10-18 (2), 18+ (1). 7-10 has no formula, algebra, or trigonometry.
- Objective per item, observable verb, "shown by": [x]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] four C3 codes checked 2026-11-10; adult clip UNVERIFIED
- Loop mapped: hook / predict / see / explain / retry: [x]
- Mastery "confident" bar for this subject: [x] post-clip answer correct on the first try, no hint
- Review-deck hookup (same deck, same ladder): [x] specified; not wired (Stage B)
- Post-clip retrieval check (journal + any video): [x]
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] captions drafted; live region is the pin name; no timer in 7-10
- Privacy: no PII, no identifiers, local-only records: [x] no age question, no account
- Content screen (§7a) passed; cut items logged with reason: [x] five drafts cut; Andean roads flagged
- Free: no revenue features; asset licences recorded: [x] no assets yet; Stage B must use the open journal recipe
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] unsigned
```

## Educator gate

Evidence prepared, not signed. Rubric item 6 (a screen recording of play) is open because no clip is built. Item 7 is the readability script.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-people-places-spec.md (commit to be named by the signer)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

The signer should look hardest at the Andean road clip (rubric 17a) and at every "practice, not history" number.

## Open

- [ ] Owner: accept these five replacements, or cut the Andean road clip and name another. Count stays PROPOSED until the owner says otherwise.
- [ ] Owner: name a human educator. No agent signs.
- [ ] Owner: Stage B stays shut. Only the math definition and the Phase 0 shell split are approved to build (agent instructions). No mp4 and no `public/videos/journals/people-places/manifest.json` until that gate lifts.
- [ ] Integrator, at Stage B only: merge manifest entries into `public/videos/journal-manifest.json`, and add a review-deck subject id if `src/game/learning.ts` needs one. Not requested now.
- [ ] v3-versus-v4 listen question from the old draft: still open, and only matters at Stage B.
