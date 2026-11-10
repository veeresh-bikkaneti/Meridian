# Branch prompts — one agent per branch, run in parallel

> **Mission (owner, 2026-11-10):** most children don't understand why they
> learn multiplication, division, algebra and trigonometry. Meridian helps
> them see the real application from an early age, across subject
> boundaries. Every unit answers "why do I need this?" with a real problem
> before it teaches the skill.

Each feature branch gets its own agent. Every branch carries the full plan
set under `docs/scaling/plans/` (it arrives when the branch syncs with main),
so an agent that checks out only its branch has everything: the mission,
owner rules, age groups, subject web, house stack, token economy, its task,
what it owns, what it waits on, and when it is done.

Only prompts 1 and 2 are approved to build or define. Prompt 1b writes a
manifest and stops for the owner's go. Everything else is spec work only and
stays GATED on a real educator's signed rubric.

## Run table

| # | Branch | Kind | Start after | Plan |
|---|---|---|---|---|
| 1 | `feat/phase0-shell-split` | Approved to build (Tier 2 code) | Nothing. Start now. | [plan](plans/feat-phase0-shell-split.md) |
| 1b | `feat/age-groups` | Code, NOT yet approved: manifest only, then stop for the owner's go | Phase 0 slice in progress is fine; write the manifest now, code only on the owner's go. | [plan](plans/feat-age-groups.md) |
| 2 | `feat/math-definition` | Approved definition work (docs only) | Nothing. Start now. | [plan](plans/feat-math-definition.md) |
| 3 | `feat/math-spec` | Spec only (build follows the math sign-off) | `feat/math-definition` has its objectives and codes pushed (read them from that branch; do not copy). | [plan](plans/feat-math-spec.md) |
| 4 | `feat/science-definitions` | Spec only | Nothing. Start now. | [plan](plans/feat-science-definitions.md) |
| 5 | `feat/science-spec` | Spec only | `feat/science-definitions` has pushed its P7 engine choice. | [plan](plans/feat-science-spec.md) |
| 6 | `feat/physics-spec` | Spec only | `feat/science-definitions` has pushed its P7 choice and P4/P7 split. | [plan](plans/feat-physics-spec.md) |
| 7 | `feat/chemistry-spec` | Spec only | `feat/science-definitions` (P7 engine) and `feat/physics-spec` (energy units) are pushed. | [plan](plans/feat-chemistry-spec.md) |
| 8 | `feat/journal-people-places-spec` | Spec only (first journal: sets the journal pattern) | Nothing. Start now. | [plan](plans/feat-journal-people-places-spec.md) |
| 9 | `feat/journal-technology-spec` | Spec only | `feat/journal-people-places-spec` has pushed its clip pattern. | [plan](plans/feat-journal-technology-spec.md) |
| 10 | `feat/social-studies-spec` | Spec only | Nothing. Start now. | [plan](plans/feat-social-studies-spec.md) |
| 11 | `feat/humanities-definitions` | Spec only | Nothing. Start now. | [plan](plans/feat-humanities-definitions.md) |
| 12 | `feat/journal-ww2-monuments-spec` | Spec only (content rule §7a applies) | `feat/journal-people-places-spec` (clip pattern) and `feat/humanities-definitions` (screened topics) have pushed. | [plan](plans/feat-journal-ww2-monuments-spec.md) |
| 13 | `feat/journal-world-wars-spec` | Spec only (content rule §7a applies) | `feat/journal-people-places-spec` (clip pattern) and `feat/humanities-definitions` (screened topics) have pushed. | [plan](plans/feat-journal-world-wars-spec.md) |
| 14 | `feat/journal-modern-world-spec` | Spec only (content rule §7a applies) | `feat/journal-people-places-spec` (clip pattern) and `feat/humanities-definitions` (screened topics) have pushed. | [plan](plans/feat-journal-modern-world-spec.md) |
| 15 | `feat/journal-great-leaders-spec` | Spec only (content rule §7a applies) | `feat/journal-people-places-spec` (clip pattern) and `feat/humanities-definitions` (screened topics) have pushed. | [plan](plans/feat-journal-great-leaders-spec.md) |
| 16 | `feat/journal-freedom-fighters-spec` | Spec only (content rule §7a applies) | `feat/journal-people-places-spec` (clip pattern) and `feat/humanities-definitions` (screened topics) have pushed. | [plan](plans/feat-journal-freedom-fighters-spec.md) |
| 17 | `feat/general-knowledge-spec` | Spec only (last) | The subject specs above have items listed (it reviews them). | [plan](plans/feat-general-knowledge-spec.md) |
| M | `chore/model-neutral-agents` | Process change (never Tier 0: eval discipline) | Nothing; independent. | [plan](plans/chore-model-neutral-agents.md) |

Streams that can start at once: 1, 1b (manifest), 2, 4, 8, 10, 11, M. The rest
wait on the branch named in "Start after".

## Every stream keeps up with main

Each plan carries the same standing rule: merge `origin/main` into the branch
at session start, after every merge to main, and before opening or updating a
PR; resolve conflicts; rerun checks; keep commits small and inside the files it
owns. No rebase or force-push without the owner's authorization naming that
branch and push (`AGENTS.md`).

## Likely collisions

- **All branches:** `BRANCH_STATUS.md` at the repo root (each keeps only its
  own section on top; owner decision D11 could move this to
  `docs/branch-status/<branch>.md`).
- **`feat/math-definition` and `feat/math-spec`:** objectives and codes.
- **`feat/science-definitions` with science, physics and chemistry specs:**
  the P7 engine and the P4/P7 split.
- **`feat/social-studies-spec` and `feat/humanities-definitions`:** §7a
  screening.
- **The seven journal branches:** shared clip fields.
- **`feat/phase0-shell-split` and `feat/age-groups`:** the game shell.

## Launch prompts

### 1. `feat/phase0-shell-split`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/phase0-shell-split.
git fetch origin && git checkout feat/phase0-shell-split && git merge --no-edit origin/main
Read docs/scaling/plans/feat-phase0-shell-split.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/phase0-shell-split. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 1b. `feat/age-groups`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/age-groups.
git fetch origin && git checkout -b feat/age-groups origin/main
Read docs/scaling/plans/feat-age-groups.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/age-groups. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 2. `feat/math-definition`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/math-definition.
git fetch origin && git checkout feat/math-definition && git merge --no-edit origin/main
Read docs/scaling/plans/feat-math-definition.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/math-definition. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 3. `feat/math-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/math-spec.
git fetch origin && git checkout feat/math-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-math-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/math-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 4. `feat/science-definitions`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/science-definitions.
git fetch origin && git checkout feat/science-definitions && git merge --no-edit origin/main
Read docs/scaling/plans/feat-science-definitions.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/science-definitions. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 5. `feat/science-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/science-spec.
git fetch origin && git checkout feat/science-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-science-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/science-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 6. `feat/physics-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/physics-spec.
git fetch origin && git checkout feat/physics-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-physics-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/physics-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 7. `feat/chemistry-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/chemistry-spec.
git fetch origin && git checkout feat/chemistry-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-chemistry-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/chemistry-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 8. `feat/journal-people-places-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-people-places-spec.
git fetch origin && git checkout feat/journal-people-places-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-people-places-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-people-places-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 9. `feat/journal-technology-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-technology-spec.
git fetch origin && git checkout feat/journal-technology-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-technology-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-technology-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 10. `feat/social-studies-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/social-studies-spec.
git fetch origin && git checkout feat/social-studies-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-social-studies-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/social-studies-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 11. `feat/humanities-definitions`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/humanities-definitions.
git fetch origin && git checkout feat/humanities-definitions && git merge --no-edit origin/main
Read docs/scaling/plans/feat-humanities-definitions.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/humanities-definitions. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 12. `feat/journal-ww2-monuments-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-ww2-monuments-spec.
git fetch origin && git checkout feat/journal-ww2-monuments-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-ww2-monuments-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-ww2-monuments-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 13. `feat/journal-world-wars-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-world-wars-spec.
git fetch origin && git checkout feat/journal-world-wars-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-world-wars-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-world-wars-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 14. `feat/journal-modern-world-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-modern-world-spec.
git fetch origin && git checkout feat/journal-modern-world-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-modern-world-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-modern-world-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 15. `feat/journal-great-leaders-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-great-leaders-spec.
git fetch origin && git checkout feat/journal-great-leaders-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-great-leaders-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-great-leaders-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 16. `feat/journal-freedom-fighters-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/journal-freedom-fighters-spec.
git fetch origin && git checkout feat/journal-freedom-fighters-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-journal-freedom-fighters-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/journal-freedom-fighters-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### 17. `feat/general-knowledge-spec`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch feat/general-knowledge-spec.
git fetch origin && git checkout feat/general-knowledge-spec && git merge --no-edit origin/main
Read docs/scaling/plans/feat-general-knowledge-spec.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only feat/general-knowledge-spec. Never push to main, merge a PR, rebase, force-push or delete a branch.
```

### M. `chore/model-neutral-agents`

```
Repo veeresh-bikkaneti/Meridian. You are the only agent on branch chore/model-neutral-agents.
git fetch origin && git checkout -b chore/model-neutral-agents origin/main
Read docs/scaling/plans/chore-model-neutral-agents.md and follow it; it lists the shared rules to read.
MISSION: kids see why they learn each skill (multiplication, division,
algebra, trigonometry) through real problems, across subject boundaries.
Push only chore/model-neutral-agents. Never push to main, merge a PR, rebase, force-push or delete a branch.
```
