# Branch prompts — one independent agent per branch

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

Every stream can start now. No two branches share a file, and the links
between streams go through the contracts in `contracts.md`, not through
waiting. Each stream is sized for one agent in well under a day: Stage A
research and spec, about 3 hours; Stage B, one playable v1 unit, about 4
hours. Stage B runs only once the owner lifts the build gate for that branch.
Phase 0 is already approved to build. The integrator (see
`integrator-runbook.md`) reviews and merges. Every branch stays open until
dev work is complete, even after its PRs merge (owner rule); none is deleted.

`feat/science-spec` is retired and folded in: its 14 physics items go to
`feat/physics-spec` and its 10 chemistry items to `feat/chemistry-spec`. The
branch stays as read-only reference and is not deleted.

## Ownership table (exclusive paths)

| # | Branch | Kind | Owns (plus `docs/branch-status/<branch>.md`) |
|---|---|---|---|
| 1 | `feat/phase0-shell-split` | Code, approved to build | `src/components/game-app.tsx`, `src/components/game-app-lazy-boundary.test.ts`, `src/game/shell-helpers.ts`, `src/game/shell/**`, `src/subjects/registry.ts (+ test)`, `docs/scaling/phase0-shell-split-spec.md` |
| 2 | `feat/age-groups` | Code, manifest now; code on the owner's go | `src/game/age-profile/**`, `docs/scaling/age-groups-manifest.md` |
| 3 | `feat/math-definition` | Docs approved; build gated | `docs/scaling/math-definition-spec.md`, `docs/scaling/math/number/**`, `src/subjects/math-number/**` |
| 4 | `feat/math-spec` | Spec; build gated | `docs/scaling/math-spec.md`, `docs/scaling/math/applied/**`, `src/subjects/math-applied/**` |
| 5 | `feat/science-definitions` | Spec + shared engine; build gated | `docs/scaling/science-definitions-spec.md`, `docs/scaling/p4-algebra-physics-brief.md`, `docs/scaling/p6-chemistry-brief.md`, `docs/scaling/p7-science-map-brief.md`, `src/scenes/predict-see/**` |
| 6 | `feat/physics-spec` | Spec; build gated | `docs/scaling/physics-spec.md`, `docs/scaling/physics/**`, `src/subjects/physics/**` |
| 7 | `feat/chemistry-spec` | Spec; build gated | `docs/scaling/chemistry-spec.md`, `docs/scaling/chemistry/**`, `src/subjects/chemistry/**` |
| 8 | `feat/social-studies-spec` | Spec; build gated | `docs/scaling/social-studies-spec.md`, `docs/scaling/social-studies/**`, `src/subjects/social-studies/**` |
| 9 | `feat/humanities-definitions` | Spec only | `docs/scaling/humanities-definitions-spec.md`, `docs/scaling/humanities/**` |
| 10 | `feat/journal-people-places-spec` | Spec; clips gated | `docs/scaling/journal-people-places-spec.md`, `docs/scaling/journals/people-places/**`, `public/videos/journals/people-places/**` |
| 11 | `feat/journal-technology-spec` | Spec; clips gated | `docs/scaling/journal-technology-spec.md`, `docs/scaling/journals/technology/**`, `public/videos/journals/technology/**` |
| 12 | `feat/journal-ww2-monuments-spec` | Spec; clips gated | `docs/scaling/journal-ww2-monuments-spec.md`, `docs/scaling/journals/ww2-monuments/**`, `public/videos/journals/ww2-monuments/**` |
| 13 | `feat/journal-world-wars-spec` | Spec; clips gated | `docs/scaling/journal-world-wars-spec.md`, `docs/scaling/journals/world-wars/**`, `public/videos/journals/world-wars/**` |
| 14 | `feat/journal-modern-world-spec` | Spec; clips gated | `docs/scaling/journal-modern-world-spec.md`, `docs/scaling/journals/modern-world/**`, `public/videos/journals/modern-world/**` |
| 15 | `feat/journal-great-leaders-spec` | Spec; clips gated | `docs/scaling/journal-great-leaders-spec.md`, `docs/scaling/journals/great-leaders/**`, `public/videos/journals/great-leaders/**` |
| 16 | `feat/journal-freedom-fighters-spec` | Spec; clips gated | `docs/scaling/journal-freedom-fighters-spec.md`, `docs/scaling/journals/freedom-fighters/**`, `public/videos/journals/freedom-fighters/**` |
| 17 | `feat/general-knowledge-spec` | Spec; build gated | `docs/scaling/general-knowledge-spec.md`, `docs/scaling/general-knowledge/**`, `src/subjects/general-knowledge/**` |
| 18 | `chore/model-neutral-agents` | Process change (never Tier 0) | `AGENTS.md`, `docs/ops/agent-council-protocol.md` |

**Integrator only:** root `BRANCH_STATUS.md`, `AGENTS.md` (except stream 18),
`docs/scaling/*.md` shared docs (standard, map, rubric, agent instructions,
contracts, runbook, this file), `docs/scaling/plans/**`, `src/game/review-deck.ts`,
`src/game/learning.ts`, `src/routes/**`, `src/routeTree.gen.ts`,
`public/flags.json`, `public/videos/journal-manifest.json`, `package.json`,
lockfile, Vite, TS and CI config.

## Launch prompts

### 1. `feat/phase0-shell-split`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/phase0-shell-split.
git fetch origin && git checkout feat/phase0-shell-split && git merge --no-edit origin/main
Read docs/scaling/plans/feat-phase0-shell-split.md and follow it. You may edit ONLY:
  src/components/game-app.tsx
  src/components/game-app-lazy-boundary.test.ts
  src/game/shell-helpers.ts
  src/game/shell/**
  src/subjects/registry.ts (+ test)
  docs/scaling/phase0-shell-split-spec.md
  docs/branch-status/feat-phase0-shell-split.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/phase0-shell-split. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 2. `feat/age-groups`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/age-groups.
git fetch origin && git checkout -b feat/age-groups origin/main
Read docs/scaling/plans/feat-age-groups.md and follow it. You may edit ONLY:
  src/game/age-profile/**
  docs/scaling/age-groups-manifest.md
  docs/branch-status/feat-age-groups.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/age-groups. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 3. `feat/math-definition`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/math-definition.
git fetch origin && git checkout feat/math-definition && git merge --no-edit origin/main
Read docs/scaling/plans/feat-math-definition.md and follow it. You may edit ONLY:
  docs/scaling/math-definition-spec.md
  docs/scaling/math/number/**
  src/subjects/math-number/**
  docs/branch-status/feat-math-definition.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/math-definition. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 4. `feat/math-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/math-spec.
git fetch origin && git checkout feat/math-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-math-spec.md and follow it. You may edit ONLY:
  docs/scaling/math-spec.md
  docs/scaling/math/applied/**
  src/subjects/math-applied/**
  docs/branch-status/feat-math-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/math-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 5. `feat/science-definitions`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/science-definitions.
git fetch origin && git checkout feat/science-definitions && git merge --no-edit origin/main
Read docs/scaling/plans/feat-science-definitions.md and follow it. You may edit ONLY:
  docs/scaling/science-definitions-spec.md
  docs/scaling/p4-algebra-physics-brief.md
  docs/scaling/p6-chemistry-brief.md
  docs/scaling/p7-science-map-brief.md
  src/scenes/predict-see/**
  docs/branch-status/feat-science-definitions.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/science-definitions. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 6. `feat/physics-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/physics-spec.
git fetch origin && git checkout feat/physics-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-physics-spec.md and follow it. You may edit ONLY:
  docs/scaling/physics-spec.md
  docs/scaling/physics/**
  src/subjects/physics/**
  docs/branch-status/feat-physics-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/physics-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 7. `feat/chemistry-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/chemistry-spec.
git fetch origin && git checkout feat/chemistry-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-chemistry-spec.md and follow it. You may edit ONLY:
  docs/scaling/chemistry-spec.md
  docs/scaling/chemistry/**
  src/subjects/chemistry/**
  docs/branch-status/feat-chemistry-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/chemistry-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 8. `feat/social-studies-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/social-studies-spec.
git fetch origin && git checkout feat/social-studies-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-social-studies-spec.md and follow it. You may edit ONLY:
  docs/scaling/social-studies-spec.md
  docs/scaling/social-studies/**
  src/subjects/social-studies/**
  docs/branch-status/feat-social-studies-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/social-studies-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 9. `feat/humanities-definitions`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/humanities-definitions.
git fetch origin && git checkout feat/humanities-definitions && git merge --no-edit origin/main
Read docs/scaling/plans/feat-humanities-definitions.md and follow it. You may edit ONLY:
  docs/scaling/humanities-definitions-spec.md
  docs/scaling/humanities/**
  docs/branch-status/feat-humanities-definitions.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/humanities-definitions. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 10. `feat/journal-people-places-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-people-places-spec.
git fetch origin && git checkout feat/journal-people-places-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-people-places-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-people-places-spec.md
  docs/scaling/journals/people-places/**
  public/videos/journals/people-places/**
  docs/branch-status/feat-journal-people-places-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-people-places-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 11. `feat/journal-technology-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-technology-spec.
git fetch origin && git checkout feat/journal-technology-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-technology-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-technology-spec.md
  docs/scaling/journals/technology/**
  public/videos/journals/technology/**
  docs/branch-status/feat-journal-technology-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-technology-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 12. `feat/journal-ww2-monuments-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-ww2-monuments-spec.
git fetch origin && git checkout feat/journal-ww2-monuments-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-ww2-monuments-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-ww2-monuments-spec.md
  docs/scaling/journals/ww2-monuments/**
  public/videos/journals/ww2-monuments/**
  docs/branch-status/feat-journal-ww2-monuments-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-ww2-monuments-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 13. `feat/journal-world-wars-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-world-wars-spec.
git fetch origin && git checkout feat/journal-world-wars-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-world-wars-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-world-wars-spec.md
  docs/scaling/journals/world-wars/**
  public/videos/journals/world-wars/**
  docs/branch-status/feat-journal-world-wars-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-world-wars-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 14. `feat/journal-modern-world-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-modern-world-spec.
git fetch origin && git checkout feat/journal-modern-world-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-modern-world-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-modern-world-spec.md
  docs/scaling/journals/modern-world/**
  public/videos/journals/modern-world/**
  docs/branch-status/feat-journal-modern-world-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-modern-world-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 15. `feat/journal-great-leaders-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-great-leaders-spec.
git fetch origin && git checkout feat/journal-great-leaders-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-great-leaders-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-great-leaders-spec.md
  docs/scaling/journals/great-leaders/**
  public/videos/journals/great-leaders/**
  docs/branch-status/feat-journal-great-leaders-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-great-leaders-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 16. `feat/journal-freedom-fighters-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-freedom-fighters-spec.
git fetch origin && git checkout feat/journal-freedom-fighters-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-freedom-fighters-spec.md and follow it. You may edit ONLY:
  docs/scaling/journal-freedom-fighters-spec.md
  docs/scaling/journals/freedom-fighters/**
  public/videos/journals/freedom-fighters/**
  docs/branch-status/feat-journal-freedom-fighters-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/journal-freedom-fighters-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 17. `feat/general-knowledge-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/general-knowledge-spec.
git fetch origin && git checkout feat/general-knowledge-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-general-knowledge-spec.md and follow it. You may edit ONLY:
  docs/scaling/general-knowledge-spec.md
  docs/scaling/general-knowledge/**
  src/subjects/general-knowledge/**
  docs/branch-status/feat-general-knowledge-spec.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only feat/general-knowledge-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```

### 18. `chore/model-neutral-agents`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch chore/model-neutral-agents.
git fetch origin && git checkout -b chore/model-neutral-agents origin/main
Read docs/scaling/plans/chore-model-neutral-agents.md and follow it. You may edit ONLY:
  AGENTS.md
  docs/ops/agent-council-protocol.md
  docs/branch-status/chore-model-neutral-agents.md
Anything else: ask the integrator first (say which file and why); never edit it.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
AGE GROUPS: 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = adults beyond grade 12.
Tag each item by its standard's grade (grade 5 may go in either). No algebra or
trigonometry in 7-10. Never ask for an exact age or birth date.
Merge origin/main into your branch at start, after each merge to main and before a PR.
Push only chore/model-neutral-agents. Never push to main, merge a PR, rebase, force-push or delete a branch.
This branch stays open until dev work is complete, even after a PR from it merges (owner rule).
```
