# 18 — Nav: frozen header + the rail proposal's seven unanswered decisions

## Intent (one line)
Settle Meridian's navigation shell: a frozen (persistent) header, and a yes/no on the side-rail proposal under the council's cure conditions.

## Why (origin)
A navigation council ran 2026-11-17 (seats staffed from the owner's two persona packs). The owner approved the first move the same day ("Frozen... continue building it") — the frozen header. The rail proposal went to council and came back with conditions, not approval.

## Scope IN
- Frozen header as the first (approved) move.
- The rail, only if it satisfies the council's cures.

## Scope OUT
- Claiming the council's seven decisions as answered — they are formally unanswered and must not be treated as given.

## Locked decisions (council outcome, 2026-11-17)
- **Zero seats approved the rail as literally specified.**
- Unanimous cures: **no rail on map or in-run screens · no rail at phone widths · never icon-only.**
- Frozen-header first move: approved by the owner 2026-11-17.

## Acceptance criteria
- The owner answers the council's seven decisions; only then is there a buildable nav spec beyond the frozen header.

## Assets & related work
- Brief-only folder: the council record lives in the session/memory record (2026-11-17 nav council). Related shipped work: the shared header/footer components and PageShell (item 19) bound what a rail could even attach to.

## Open questions for the architect
1. With the cures applied (no map/in-run, no phone, never icon-only), is a rail still a rail — or has the cure removed the thing itself? What problem does the remaining form solve that the frozen header doesn't?
2. Which of the seven unanswered decisions are actually design decisions vs owner preferences?

## Status & evidence
- Frozen header: approved direction. Rail: council-closed with cures; 7 decisions unanswered since 2026-11-17.

**Update 2026-11-23 (pack v2):** the header half of this item is DONE on main — the frozen shared header shipped in PR #529 ("One shell, one SiteNav: frozen header, logo-as-home, shell registry"), `site-header.tsx` documents the sticky frozen bar, and PRs #561/#564 retargeted the leftover nav tests to assert against that shared header (phone nav via the menu panel, 7 items). No rail exists anywhere in `src/` — the rail was never built. What remains of the 7 unanswered decisions is therefore the rail question only; the header decisions were settled by building #529.
