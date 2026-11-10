# Journal — World Wars (remembrance)

- **Topic:** Two short human stories from the World Wars, each opened by a year question.
- **Status:** GATED. No educator has signed. Stage B (video files) stays closed.
- **Branch:** `feat/journal-world-wars-spec`
- **Proposed clip count:** 2 — PROPOSED, not decided.
- **Screened:** 2026-11-10 against standard §7a. Neither earlier draft is kept as written.
- **Contract rows:** [`journals/world-wars/clips.json`](journals/world-wars/clips.json). If this prose and that file disagree, the file wins.
- **Counting year for any "years ago" line:** 2026, named in the problem, never a hidden "now".

Mission: a child should see why a year calculation is useful before the story plays. Each clip opens on a real question — how many years ago — then a place on the globe. Standard §0 and §2. No algebra and no trigonometry in the 7-10 group (standard §1, progression map age note). Tone: remembrance. No graphic detail. No battle re-enactment.

## What was cut (§7a)

Dropped, not softened. Reasons also live in `clips.json` under `cuts`.

| Draft | Verdict | Why |
|---|---|---|
| Christmas Truce (24–25 Dec 1914) | CUT | Religion and religious practice. The sourced story is Christmas trees, the hymn "Stille Nacht", answering carols, and a papal appeal (Britannica, checked 2026-11-10). It cannot be told without that day. |
| Letters home, as drafted | CUT | The line "I miss you" was not sourced. A US letter page and a British evacuation were mixed. The draft's "overwhelming majority children" does not match the government history blog (over 1.5 million people, of whom 800,000 were children). A BBC page says nearly 3 million in four days. No count is taught. The folktale codename is omitted (mythology is out). |

Also left out of every child-facing line: gas masks, bombs, soldiers, guns, a nation named as an enemy, the 1940 reuse of the Compiègne clearing, poppies, and monuments. Memorials belong to the monuments journal. This spec does not claim that pin.

## Kept set (2, PROPOSED)

| Clip | Group | Skill | Opens with | C3 code |
|---|---|---|---|---|
| `school-morning` | 7-10 | subtraction | how many years ago | D2.His.2.3-5 |
| `quiet-hour` | 10-18 | subtraction | how many years ago | D2.His.1.6-8 |

Grade check: the 3–5 code matches 7-10 (grades 2–5). The 6–8 code matches 10-18 (grades 5–12). Grade 5 may sit in either group; the school-morning item stays in 7-10 because the work is one subtraction, not a formula. C3 pathways inspected on 2026-11-10 stop at grade 12, so the 18+ stretch is UNVERIFIED rather than given a 9–12 code.

**18+ is a stretch, not a third film.** Contract I5 allows one `stretch` for an older group on the same clip. On `quiet-hour` only, an 18+ player is asked which people-count to teach. The answer is none (`evac-counts-conflict` in `sources.md`). A 10-18 player does not see that question. The stretch has no C3 code of its own.

**`school-morning` is the closest call.** The 7-10 narration does not say "war". The explain line does: "It was wartime. This clip shows the school, not the war." That is so the morning is not mistaken for an ordinary school day with no reason. An educator may still Fail rubric item 4 or 17a (children leaving home). Until then it stays, flagged. The narration says they met at school at 5 in the morning. It does not say a train was on this street.

### What each clip teaches

Numbers below are the ones the game may say. Sources, conflicts, and "do not teach" lists are on the clip in `clips.json`.

1. **School morning** (7-10). How many years ago was 1939 in the counting year 2026? **87.** The narration says the date and the school. Retrieval asks the year: **1939.** Pin: Myrdle Street, Stepney, London, 51.5166 N, 0.0634 W (street center, rounded; not a surveyed school door). No train at this pin. No distance. No count of children.
2. **Quiet hour** (10-18). How many years from 1918 to 1939? **21.** The narration says 11 in the morning on 11 November 1918, when the war there went quiet. Retrieval asks the hour: **11.** Pin: the clearing at Compiègne, 49.4279 N, 2.9057 E. Not a battlefield.

## Globe

Full and Lite fly the existing globe to `place` (standard §5.1). three.js is loaded with a dynamic `import("three")` inside the scene, as `home-globe.tsx` does, and is disposed on exit. The render pauses when the tab is hidden. Flat, Save-Data, and `prefers-reduced-motion` show a 2D pin at the same lat/lon. No camera swoop on Flat. The question and the answer do not change with the tier.

## Loop (standard §3 and §4)

For every clip, in order:

1. **Hook / predict.** The prompt (`predict`) is read aloud. The child taps an answer before the clip. This is the "why" (how many years).
2. **See.** The 10-second clip, then the globe pin.
3. **Explain.** One or two sentences (`explain`), read aloud on demand.
4. **Retrieval.** One read-aloud question about a fact the narration said. A correct first try with no hint is the confident bar (standard §4, journal).
5. **Retry.** One hint (`hint`), then the same review deck and the same `[0, 1, 3, 7, 14, 30]`-day ladder. No second deck. No timer in 7-10. Timers off unless the player opts in.
6. **Use it elsewhere.** A later card (`elsewhere`) uses the same subtraction on a bridge or a ship log. Those numbers are the game's, and the file says so.

## Captions and transcript

Every narration opens with "Hey kids, have you heard about this place?" (`docs/journal-movies.md`). Spoken words are the `narration` string. Captions (timings PROPOSED until a real voice exists):

- `docs/scaling/journals/world-wars/captions/<clip>.vtt`
- transcript: `docs/scaling/journals/world-wars/captions/<clip>.txt`

Stage B copies them beside the mp4. Recipe, when the owner lifts the gate: `docs/journal-movies.md` (10 s, 1152×768, 24 fps, h264 + AAC, no on-screen text, tap to play). Manifest for that day: `public/videos/journals/world-wars/manifest.json`. Do not edit `public/videos/journal-manifest.json` on this branch.

Picture, when it is made: watercolor stills, one calm action, no words in the frame. School morning: a school at dawn, small cases, no train and no masks. Quiet hour: trees, a watch at 11, people standing still. Nothing from the "not taught" list.

Read-aloud is on by default for 7-10. Every prompt has text. The pin has a screen-reader name (the place name). No drag is required.

## Readability

`node docs/scaling/journals/world-wars/readability.mjs` prints a Flesch-Kincaid grade (heuristic, about ±1). Limits: 7-10 → 5, 10-18 → 12, 18+ → 14. All child-facing fields passed on 2026-11-10.

## Checks

```
node --test docs/scaling/journals/world-wars/clips.test.mjs
node docs/scaling/journals/world-wars/readability.mjs
```

No `AGENTS.md` code gates were run. This pass is docs and data only.

## Council (design pass, 2026-11-10)

- **Architect.** Rows follow contract I5, plus the fields the tests check. Shared files were not edited. The globe reuses the house stack (standard §5.1). No new library.
- **Game designer.** The 10-second narration cannot hold the subtraction. The predict step is before the clip. The retrieval step asks only the year or the hour the narration said.
- **Accessibility.** Captions, transcript, read-aloud, a named pin, no timer for 7-10, Flat still pins the same place.
- **Skeptic.** The Christmas draft fails §7a. The letter draft fails the source rule. Counts that disagree are not averaged. The 7-10 line says the children met at school, not that a train stood on the street. The explain must say it was wartime, or the morning looks like an ordinary school day. Compiègne is a memorial site today; the clip does not show the stone, and it does not tell the 1940 reuse.

## K-12 standard block

```
K-12 STANDARD (docs/scaling/k12-learning-design-standard.md)
- Why first (§0): unit opens with a real problem that needs the skill; "why does this matter?" answered in the first minute: [x] predict prompt before each clip
- Headline goal (§0): bridge to the previous subject + playable real-life application: [x] buildsOn + realLife on each row
- Use-it-elsewhere round in at least one other subject (cross-application web): [x] elsewhere on each row (geography)
- Bands served: [x] 7-10 (school-morning), 10-18 (quiet-hour), 18+ (stretch on quiet-hour, not a third film). 7-10 has no algebra or trigonometry.
- Objective per item, observable verb, "shown by": [x]
- Standards cited per item (CCSS / NGSS PS / C3 / NGS) or UNVERIFIED: [x] two C3 history codes checked 2026-11-10; 18+ stretch UNVERIFIED
- Loop mapped: hook / predict / see / explain / retry: [x]
- Mastery "confident" bar for this subject: [x] post-clip answer correct on the first try, no hint
- Review-deck hookup (same deck, same ladder): [x] specified; not wired (Stage B)
- Post-clip retrieval check (journal + any video): [x]
- Motion tiers: Full / Lite / Flat described, learning parity stated: [x]
- Accessibility: captions, tap alternative, no-timer default, SR live region: [x] captions drafted; live region is the pin name; no timer in 7-10
- Privacy: no PII, no identifiers, local-only records: [x] no age question, no account
- Content screen (§7a) passed; cut items logged with reason: [x] two drafts cut; school-morning flagged for the signer
- Free: no revenue features; asset licences recorded: [x] no assets yet; Stage B must use the open journal recipe
- Educator rubric (docs/scaling/educator-gate-rubric.md) attached: [x] unsigned
```

## Educator gate

Evidence prepared, not signed. A screen recording of play is open because no clip is built. The readability script is the text check.

```
EDUCATOR SIGN-OFF
Spec: docs/scaling/journal-world-wars-spec.md (commit to be named by the signer)
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

The signer should look hardest at `school-morning` for a 7-year-old (rubric items 4 and 17a) and at the choice to leave people-counts out.

## Open

- [ ] Owner: approve the proposed count of 2, the Christmas cut, and the quiet-hour clip in its place.
- [ ] Owner: name a human educator. No agent signs.
- [ ] Owner: Stage B stays shut. Only the math definition and the Phase 0 shell split are approved to build. No mp4 and no `public/videos/journals/world-wars/manifest.json` until that gate lifts.
- [ ] Owner: a non-European human story is not in this pair. None was sourced that stayed inside §7a. Not invented.
- [ ] Integrator, at Stage B only: merge manifest entries into `public/videos/journal-manifest.json`. The fly-to is not in the player yet; that change is `src/components/journal-player.tsx` (and the globe), which this branch must not edit. Not requested now.
- [ ] v3-versus-v4 listen question from the old draft: still open, and only matters at Stage B.
