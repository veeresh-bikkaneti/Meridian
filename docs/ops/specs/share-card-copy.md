# Share card copy (feat/share-card)
Audience: a parent or teacher deciding whether a child should play. Limits: title <= 60 characters, description <= 155.
Written by a read-only Sonnet subagent on 2026-10-15. Lengths below were recounted by the orchestrator.
## Claims and evidence
| Claim | Allowed | Evidence |
| --- | --- | --- |
| Free | Yes (inferred) | README never says "free". No price, paywall or checkout code found. The Ko-fi tip jar is optional and never gates play (`src/components/grandpa-coffee-run.tsx` ~70). Do not write "100% free" or "nothing to buy". |
| No account | Yes | README.md:17, :36 |
| Plays in the browser | Yes | README.md:3, :17, :148 |
| Endless, ends when the player chooses End game | Yes | README.md:16, :34, :102 |
| A story for every place | Softer wording only | README.md:15, :34 say every reveal shows a story card. README.md:73 says most cards still show the plain blurb. Use "story card". |
| No ads | Yes, repo search only | No ad network, ad slot or ad library in `src/`, `public/`, `vercel.json`, `package.json`, `worker/`, `workers/`, `server/`, `.github/`. The live site was not fetched. |
| No tracking / private | **No** | Optional GA4 and Clarity tags exist (`src/routes/__root.tsx` AnalyticsTags). Only README.md:17 is usable. |
| Ages, curriculum, safety, outcomes | No | Not backed for a preview card. |

## Options

### A
- Title (50): Meridian: a free geography game that tells a story
- Description (144): Name places on a satellite map. Every answer, right or wrong, opens a story card about the place. Free, plays in the browser, no account needed.

### B
- Title (52): Meridian: geography, one pin and one story at a time
- Description (154): A free map game for curious kids. Drop a pin on the named place, then read its story card. No account, no ads, plays in a browser. Stop whenever you like.

### C
- Title (46): Meridian: guess the place, then read its story
- Description (144): Free geography game, no account needed. Kids place a pin on an unlabeled satellite map, and each answer shows a story card. Play on any browser.

## Subagent pick
B: answers cost, signup and ads, and says a child can stop any time. (Review and final choice recorded below.)
