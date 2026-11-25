# 24 — Long place-name display

## Intent (one line)
Fix long place-name display across every surface where a real longest name from the dataset breaks the layout — solved as one system, not per-screen patches.

## Why (origin)
Owner-commissioned design: a nine-persona crew inventoried the real longest names in the dataset and designed one system, with brand, storytelling, and inclusivity review plus kid and screen-reader walkthroughs. The deliverable was a build-ready spec; the owner approved the design before code.

## Scope IN
- Every breaking surface the inventory found (cards, map labels, lists, verdicts).

## Scope OUT
- Truncating a place's name in a way that teaches the wrong name — the learning payload is the name itself.

## Locked decisions
- One system (shared treatment), not per-surface fixes — same one-component law as the rest of the UI.
- Design approved by the owner before any code was written.

## Acceptance criteria
- Final label check on the live site by the owner (the only open item).

## Assets & related work (in this folder)
- `long-name-design-spec.md` — the build-ready design spec.
- `GOAL.md` — the goal record (crew, inventory method, gates: 736/736-class unit discipline on its build).

## Open questions for the architect
1. The spec's treatment vs the container rule (item 19): do long names inside a fixed 1280px column need a different answer on ultra-wide?

## Status & evidence
- Merged and live since 2026-10-07 (goal record). Open item: the owner's final label check on the live site — pending since then.
