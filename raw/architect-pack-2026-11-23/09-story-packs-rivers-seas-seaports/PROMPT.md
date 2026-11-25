# 09 — Story packs: Rivers · Seas & Oceans · Famous Seaports

## Intent (one line)
Three new GeoDetective/Cold Trail case packs — Rivers, Seas & Oceans, Famous Seaports — built on the shipped Capitals machinery, each with an honest point-target rule.

## Why (origin)
Owner's stated scope for the next story packs (2026-11-04). Mockups were delivered 2026-11-04 (7 phone-width screens + design note) and await his approve/revise word ("use them" or edits) plus his 1/2/3 pick on where core-deck seaport cases live.

## Scope IN
- Rivers (~24 cases): target = one famous point ON the river — its mouth, its source (only where itself famous), or the famous city it flows through. Clues written to the point; no clue may describe only the line.
- Seas & Oceans (~18 cases): target = a famous island or coastal point IN the named sea. Open water is never a target.
- Famous Seaports (~24 cases): target = the port itself (natively a point; plays like Capitals).
- Every case screen names its deck in the eyebrow ("GeoDetective · Famous Seaports ★") and states its ask in the briefing (`packBriefingText` pattern from Capitals, PR #323).
- Packs live on the deck shelf inside GeoDetective / Cold Trail — never a standalone mode, never a separate doorway.

## Scope OUT
- "Tap somewhere on the river / on the ocean" cases — unjudgeable in a point game, excluded by the target rules.
- Exhaustive coverage: curated greatest-hits only.

## Locked decisions
- Same machinery as Capitals (PR #323): manifest + sidecar, dealt from the pack's own shelf chip.
- Content is sourced, never manufactured; facts verified with citations.
- The seaport migration question is the OWNER's, undecided: **(1)** also in the pack (cases dealt from either deck) · **(2)** core-only (pack = ports not already in core; weakens the pack's greatest-hits claim — Vladivostok/Singapore-class ports would be missing) · **(3)** move to the pack (core deck shrinks; saved progress counts shift).

## Acceptance criteria
- Owner says "use them" (or names edits) AND makes the 1/2/3 seaport pick — only then does a build dispatch exist.
- Each pack PR stops at READY for the owner's per-PR merge word; cases pass the same validation gates as Capitals (incl. the Hyderabad coordinate rule).

## Assets & related work (in this folder)
- `DESIGN-NOTE.md` — the full design: target semantics, briefing/clue rules, example cases, deck-size sketches, honesty verdicts (Rivers FIT with point rule; Seas FIT only under island rule; Seaports FIT natively).
- `CHECKPOINT.md` — the mockup run's record.
- `01-shelf.png` … `07-coldtrail-seaports.png` — the 7 mockup screens (HTML sources in `~/workspace/meridian-pack-mockups/screens/`).

## Open questions for the architect
1. Are the three target rules (point-on-river, island-in-sea, port-as-point) sound game design — do they stay honest at the Giveaway clue tier?
2. On the seaport question: which of 1/2/3 serves a kid meeting Vladivostok in the "wrong" deck — the complaint that started this?
3. Deck sizes (~24/~18/~24): right weight per pack, or should one pack prove the pattern first?

## Status & evidence
- Mockups delivered 2026-11-04; no build started; both owner decisions outstanding since delivery.

**Update 2026-11-23 (pack v2):** the decision is unchanged (no pack code on main; mockups still await "use them" + the seaport pick), but the content architecture a build would use has changed: Phase 3 made literal, build-validated `SubjectItem` records the house pattern for content (all six school subjects, PRs #555/#562/#566/#568/#572), and the pack shelf now loads through the transport port (#565). A Rivers/Seaports build should be specified against validated records + build-time validation, not the older JSON-adapter route.
