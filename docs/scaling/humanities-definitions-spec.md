# Meridian Scaling — Humanities + GK Definitions Spec

**Branch:** `feat/humanities-definitions`
**Base:** `origin/main` @ `f37dea50` (verified 2026-11-10)
**Status: PREPARED — AWAITING EDUCATOR SIGN-OFF.** No educator exists; nothing
in this spec is approved. No subject build is authorized by this file.

**What this is:** definition briefs only — no code, no game, no build. Workstream 4
of the Meridian scaling-plan push (2026-11-10). It transcribes the council
verdict of 2026-11-07 (CONDITIONAL GO for definition work and Phase 0 only;
subject feature branches are NOT GO) into definition briefs for five packets
plus the three cross-cutting definitions, and it records the correction of 12
stale-doc spots in the workspace docs.

**Sources transcribed (not re-decided):**

- `~/workspace/meridian-scaling-work-packets.md` — packets P5, P8, P10, P11, P12
  (2026-11-07).
- `~/workspace/meridian-scaling-lens-breakdown.md` — §4 P5, §7 P8, §8 P10,
  §9 P11, §10 P12, §12 staleness flags, §13 open owner questions (2026-11-10).
- `~/workspace/meridian-scaling-spec-breakdown.md` — §2 platform decisions,
  §5 staleness flags (2026-11-10).
- `~/workspace/meridian-scaling-debate.md` — council debate + verdict
  (2026-11-07).

Where a source doc states a fact that current main supersedes, this spec
records the corrected fact and the superseded source — it never silently
rewrites the source's history. Workspace-file corrections are listed in §8
and applied in place in `~/workspace/meridian-scaling-*.md` (and the two
source docs they point at, `meridian-platform-project-description.md` and
`meridian-end-to-end-study.md`).

---

## §0. Scope — what is in, what is out

### In scope (approved only)

1. **P5 brief** — social studies definition: road rules + history +
   constitution picker (two branches under one definition).
2. **P8 brief** — journal global expansion definition (re-based on B8).
3. **P10 brief** — GK Trivia Quiz definition.
4. **P11 brief** — GK Current Affairs definition (ruling recorded open).
5. **P12 brief** — GK Detective definition.
6. **Cross-cutting definitions** — the 7-stage release pipeline, the host
   wrap-up rule, the lazy-load guardrail.
7. **Stale-doc corrections** — the 12 flags of spec-breakdown §5, fixed in
   place in the workspace docs and recorded here (§8).

### Out of scope (never in this workstream)

- Any game or feature code of any kind. Any subject branch build.
- Any educator sign-off (no educator exists; the seat is UNSTAFFED).
- Any decision the owner has not made (see §7 open questions — recorded,
  never settled).
- Any change to `~/workspace/meridian-main`'s working tree (another branch
  with pre-existing state — left alone).
- Merges, PRs, force-pushes. Merging stays the owner's word, per PR per head.

---

## §0.1 Hard stops

1. No merges, no PRs, no force-push.
2. No game/feature code of any kind.
3. No educator sign-off — never write "approved" for any brief. Every brief
   is marked **PREPARED — AWAITING EDUCATOR SIGN-OFF**.
4. Stage named files only — never `git add -A`.
5. No decision recorded on the owner's behalf. Open questions stay open.
6. No fact asserted without a live web source (URL + date accessed) or an
   explicit confidence level (HIGH / MEDIUM / LOW with the evidence that
   earns it). A claim without one is not done.

---

## §0.2 What counts as done

This workstream is done when, on branch `feat/humanities-definitions`:

1. §1–§5 hold the five packet briefs (P5, P8, P10, P11, P12), each with
   status, gate, scope in/out, acceptance criteria, educator sign-off
   block, open owner questions, and verification.
2. §6 holds the three cross-cutting definitions transcribed verbatim in
   substance from the packets/shared gates.
3. §7 holds the open owner questions (recorded, not decided).
4. §8 holds the correction record for all 12 stale-doc flags, with the
   workspace-file edit for each (or an explicit statement that a flag is a
   gap with no stale text to correct, and why).
5. Every research/factual claim in §1–§6 carries a live web source
   (URL + date accessed 2026-11-10) or an explicit confidence level.
6. Branch pushed to `origin/feat/humanities-definitions`; head SHA
   re-verified with `git ls-remote` before reporting.

Partial landing is acceptable if reported honestly: briefs land in the
order P5, P8, P10, P11, P12, then cross-cutting, then stale-doc fixes.
A partial landing reported honestly beats a false "done".

---

## §0.3 Verification block (for this spec)

- [ ] Branch `feat/humanities-definitions` exists on the remote; HEAD
  re-verified via `git ls-remote origin feat/humanities-definitions`.
- [ ] `docs/scaling/humanities-definitions-spec.md` is the only file added
  in the first commit; later commits add sections to the same file only
  (plus the workspace-file corrections, which live outside the repo).
- [ ] Every brief marked PREPARED — AWAITING EDUCATOR SIGN-OFF; the word
  "approved" appears nowhere as a claim about any brief.
- [ ] Every factual claim in §1–§6 has a source URL + access date or a
  confidence level. Claims from the workspace docs cite the doc + section.
- [ ] No code files touched. `git status` in the worktree shows only
  `docs/scaling/humanities-definitions-spec.md` (modified/added).

---

## §1. P5 — Social studies: road rules + history + constitution picker

*(Brief to follow: commit 2.)*

## §2. P8 — Journal global expansion

*(Brief to follow: commit 2.)*

## §3. P10 — GK Trivia Quiz

*(Brief to follow: commit 3.)*

## §4. P11 — GK Current Affairs

*(Brief to follow: commit 3.)*

## §5. P12 — GK Detective

*(Brief to follow: commit 3.)*

## §6. Cross-cutting definitions

*(To follow: commit 4.)*

## §7. Open owner questions (recorded, never decided)

*(To follow: commit 4.)*

## §8. Stale-doc correction record (12 flags)

*(To follow: commit 5, after the workspace-file edits.)*

---

*Spec written 2026-11-10. No code changed, no repo writes outside this file,
no PRs, no merges.*
