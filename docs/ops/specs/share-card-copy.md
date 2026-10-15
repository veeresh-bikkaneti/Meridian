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

## Review (Opus, read-only): APPROVE-WITH-NITS
Edited option C. Reasons: A puts "free" in the title and "free" is inferred from code only. B says "no ads", checked in the repo only (live site not fetched). C's "Play on any browser" overreaches (MapLibre needs WebGL), so it became "Plays in a browser".

## Final copy (used by the share card)
- Title (46): Meridian: guess the place, then read its story
- Description (150): Free geography game for kids, no account needed. Pin a named place on an unlabeled satellite map. Every answer shows a story card. Plays in a browser.

Claims verified by the reviewer: free (repo-only, no price/paywall code; Ko-fi tip jar is optional), no account (README.md:17,36), plays in a browser (README.md:17,148), kids (README.md:10), story card on every reveal (README.md:15,34,117), unlabeled satellite map (`src/map/imagery.ts:2`, no label layer), End game exists. Not used: no ads, no tracking, private, safe, ages, outcomes.

Nits: the word "satellite" contains the letters "lite" (a whole-word check passes; a substring lint would flag it, and "satellite" is used throughout the app already). GeoDetective uses typed guesses, not pins; the copy describes the main endless game.

Known issue found while building: `public/og.jpg` still reads "MERIDIAN / FIVE PLACES". The game is now endless, so the image tagline is out of date. Replacing the image is outside this change.
