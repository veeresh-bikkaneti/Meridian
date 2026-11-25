# 11 — Friend challenges across all Meridian editions

## Intent (one line)
Open "Challenge a friend" beyond today's Globe-only end-of-game button — to all editions and phases — under one council-designed manifest.

## Why (origin)
Owner's goal (goal_db3d8961bf6c): challenges currently exist only as a Globe end-of-game surface. A design council delivered a **signed manifest** covering edition and region handling, radii, and challenge surfaces. **Four rulings from the owner — packaging, scope, scoring, privacy — are needed before building starts.** Grandpa's video already plays on every challenge verdict (the one piece live today).

## Scope IN
- Challenge creation/sharing across editions and phases per the manifest; GeoDetective and Cold Trail **excluded by default**.
- The share surface itself (see item 28: the share link is a long hash URL and is pasted twice in today's share text — shortening is now part of this spec family).

## Scope OUT
- Any build before the four rulings. Accounts/sign-in as a challenge mechanism (Meridian is account-free; challenges ride on links).

## Locked decisions
- Council manifest is signed: edition/region handling, radii, challenge surfaces as designed; GeoDetective + Cold Trail excluded by default.
- Same challenge = same places, same circle for everyone (the share text's promise: "5 places · Nebraska · 87 km circle").

## Acceptance criteria
- Owner gives the four rulings → build brief can be written.
- A challenge opened from a link reproduces the identical challenge (places + circle) in the app.

## Assets & related work (in this folder)
- `GOAL.md` — the goal record incl. the manifest summary and the four-rulings blocker.
- Item 28's folder — the URL-shortening addition (logged on this goal 2026-11-20).

## Open questions for the architect
1. The four rulings (packaging / scope / scoring / privacy): what are the defensible defaults for a kids' product with no accounts, and where is the privacy line for shareable links?
2. Should challenges expire or live forever? What does a stale challenge link do in a newer app version?

## Status & evidence
- Manifest signed 2026-10-29 era; rulings awaited since 2026-11-07 (goal record). No build started.
