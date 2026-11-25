# 19 — Container consistency: one PageShell column on every screen

## Intent (one line)
Every page's main container follows Home's rule — `w-full`, `max-width: var(--page-wide)` (1280px), `margin: auto` — one centred column, owned by one component (PageColumn via PageShell).

## Why (origin)
Owner, 2026-11-18, one word: "consistency" — after catching per-page width overrides drifting from Home's container on his ultra-wide screen (the 3170px margin in his session is pure auto-centring, never a value to hardcode).

## Scope IN
- Migrate the remaining screens onto PageShell/PageColumn; remove per-page width overrides.

## Scope OUT
- Any visible layout change beyond the container rule (refactors are layout-neutral; a visible delta is a design change needing mockup approval).

## Locked decisions
- The standard lives in ONE component; per-page overrides (picker's `lg:max-w-none`, TrailScreen's `lg:max-w-6xl`) are defects by definition.
- The picker's own container cure already shipped inside PR #533 — the remaining screens are the open part.

## Acceptance criteria
- Every screen renders its main column through PageShell at 390/768/1280 + ultra-wide, with before/after captures proving zero unintended visual delta.

## Assets & related work (in this folder)
- `page-shell-adoption-record.md` — the PageShell adoption record (branch-status document from the refactor line).

## Open questions for the architect
1. Is a single 1280px column right for the map/quiz surfaces, which arguably want the width — or is the owner's one-column rule the correct product call even there?
2. Migration order: which remaining screen carries the most drift risk?

## Status & evidence
- Ruling on the remaining-screens migration still pending; picker cured (PR #533). No migration lane started.
- **Update 2026-11-23 (pack v2) — partially absorbed by the architecture programme:** the shell parts now have their canonical layer-4 home (`src/components/ui/`: `page-shell`, `page-column`, `site-header`, `site-footer`, `shell-registry`), and ARCHITECTURE.md's rule for new screens is "adopt the shell" — no new screen may build its own frame. The frozen shared header shipped (#529; tests retargeted #561/#564).
- But adoption itself has barely moved: on main @ `5930e930` exactly **one** screen imports `PageShell` (`src/components/grownups/info-page.tsx`). The Phase 4 programme splits `game-app.tsx`; it does not migrate screens onto PageShell. The migration this brief asks about is still a ruling + a lane — now with a settled target: every screen onto the layer-4 shell parts, verified per screen.
