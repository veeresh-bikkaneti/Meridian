# BRANCH_STATUS — main

**Current state (2026-10-17):** `origin/main` @ `f331846`.
PR #169 merged 2026-10-17 — all 106 journal notes are illustrated and live
on workers.dev + GitHub Pages. Post-merge Node CI and Pages green.
Branch protection intact (never lifted; required checks: GitGuardian Security Checks, build (22.x)).

## Recently merged

- #162 — globe contained in the bento grid.
- #163 — the Meridian handbook (`docs/handbook/`).
- #165 — tasting-tour page order; storyteller clips restored.
- #168 — journal v2 consolidation (106 notes, 36 rotating sets, 49 verified / 57 cited).
- #169 — wave-2 art: 103 storybook drawings; all 36 journal sets illustrated.

## Open owner decisions

- Chimney Rock citation (Q6): NPS link is dead (302 → 404); carried as-is, tier "Verified" — owner's pick pending.
- Storyteller poke clips are in the wrong voice (open bug): the 5 poke lines are local Kokoro renders, but the ruling assigns them to TruthTeller — fix waits on the owner identifying the source.
- haymarket journal drawing: shipped as a known nit (reads as a generic market street, not the warehouse/railyard district); no regen ordered.
- `feat/homepage-premium-v5` branch (@9cbbdd2): delete or keep-as-archive.

## Known pre-existing issues (not regressions)

- React #418 hydration mismatch on throttled boots (Slow 4G + 4× CPU); the app recovers.
- tapstart.desktop E2E flake family (~7–8, flips run-to-run under load) — pre-existing.
- 768px horizontal overflow on the home page — pre-existing.

## Convention

Every active branch rewrites this file as its own status log; this main-level
version was written by the docs-refresh PR (2026-10-17) from the completed
merge records. Merged-branch working logs do not belong on main.
