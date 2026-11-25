# 28 — Shorten the challenge share URL

## Intent (one line)
Replace the long hash challenge link in the "Challenge a friend!" share text with one short link that opens the same challenge in the app.

## Why (origin)
Owner, 2026-11-20 18:50 CST — he pasted the live share text into the register himself:

> Challenge a friend! 🎯 5 places · Nebraska · 87 km circle. Same places, same circle for everyone.
> (Link opens in the Meridian app — newest version.)
> https://meridian.knowledgetest.workers.dev/#c=mc3.gANXGgVNbihNZIZNWfFNV7VNYfReEYSU https://meridian.knowledgetest.workers.dev/#c=mc3.gANXGgVNbihNZIZNWfFNV7VNYfReEYSU

His instruction: "Add shortening the url" → "Add it to the spec list." It was logged on the friend-challenges goal the same day (update `goal_update_21ee43d3c5f7`).

## Scope IN
- A short link (short path/code on the app's own domain) that resolves to the identical challenge — same places, same circle — in the Meridian app.
- The share text carries the link **once** (today it pastes the long URL twice — that duplication is part of the same defect).

## Scope OUT
- Third-party shortener services (the link must live on Meridian's own domain; a kids' product's parent-shared links should not route through an outside shortener).
- Changing what a challenge contains; this is the link's shape, not the challenge format. Pairs with item 11's rulings but does not wait for all of them to be designed.

## Locked decisions
- Same challenge for everyone: the link is the whole challenge (places + circle encoded/resolvable), as today's hash link already guarantees.
- "Link opens in the Meridian app — newest version" stays true: a short link must not strand players on old app versions.

## Acceptance criteria
- Share text contains exactly one link, short enough to read at a glance in a chat message.
- Opening it in a fresh browser lands on the identical challenge (same 5 places, same circle) — verified against the long-link behaviour.
- Old long links keep working (any existing shared challenge still opens).

## Assets & related work (in this folder)
- `GOAL-friend-challenges.md` — the goal this spec item is logged on (item 11's folder carries the full challenges brief).

## Open questions for the architect
1. Encoding vs lookup: keep the challenge self-contained in a shorter encoding, or issue a short code backed by stored challenges (which introduces storage, expiry, and privacy questions on an account-free product)?
2. If stored: what is a challenge link's lifetime, and who can enumerate codes?

## Status & evidence
- Added to the spec list 2026-11-20 on the owner's word. No design or build started.

**Verified 2026-11-23 (pack v2):** unchanged — no short-link code exists in `src/` on main; ADR-0001 covers share-tag ownership, not short links. Still pairs with #11's rulings.
