# AGENTS reference — Meridian

Detail moved out of `AGENTS.md` so every session does not pay to read it.
For precedence this file is part of `AGENTS.md` (rung 3). Read only the
section `AGENTS.md` points you to. Text below is carried over from the
2026-10-27 edition with tool-specific wording made neutral; no rule was
loosened. Where the text says "this file", it means `AGENTS.md` together
with this reference; "the Constitution below" is `AGENTS.md` §8.

## A. Amendments, the Chair-lift, and ARCHETYPE (#231)

A Consensus Manifest binds within its task's scope only; it cannot waive, suspend, or override anything at this rank.

**Safeguard carve-out (binds rung 2).** An owner instruction for a task governs that task, but it does not waive, suspend, or override this file's Constitution or its Non-negotiable safeguards, and no agent may treat it as doing so. The sole in-task exception is the bounded Chair-lift of Constitution rules 1 and 3 stated after the Constitution below. A Constitution rule or a safeguard changes only by explicit amendment: a PR whose body states in its first section, in so many words, that it amends the named rule or safeguard, gives the rationale, and is merged only on the owner's explicit per-PR word after the review panel approves the final tip. An instruction that would require waiving a rule or safeguard is therefore treated as a proposal to amend it: stop and ask, and do not proceed on the instruction as if the waiver had already happened.

A council or panel can reject a *method*, record dissent, and block on the
gates below. It cannot silently replace the owner's goal, expand scope, waive
a safeguard, or authorize an external action. Merge authority is stated once, canonically, in Non-negotiable safeguards → Merge authority; it is not restated here.

**ARCHETYPE law (#231) — disposition.** `docs/ops/ARCHETYPE_law.md`, proposed verbatim in PR #231, has no rung of its own in the ladder above; at most it is a convention under rung 5, and it confers no authority, budget, tier, seat, or vote in this repo. If both files are on `main`, then to the extent of any conflict this file — and, for Tier 2 process, `docs/ops/agent-council-protocol.md` — governs and supersedes the law in this repo, without editing the law's verbatim text. The governing numbers are this file's: budgets of 25k / 100k / 400k tokens by Tier 0 / 1 / 2, not the law's `MAX_TOKENS` of 15k per task; a cycle cap of 5 edit-and-verify cycles, not the law's 3 fix loops; tiers 0 / 1 / 2, scope-based, not the law's risk-based T1 / T2 / T3; seats of Chair plus Councilors A, B, and C under the protocol, with Councilor C a separate agent, not the law's Councilors A–D; and decision by the panel approving the final tip plus the owner's explicit per-PR merge word, not the law's “3/4 + Chair veto” formula. The task capsule's three files are a default scope in this file, not the law's hard “Scoped Files (max 3)” limit, and the law's provision for a loop to mutate it into “Archetype v1.1” has no effect in this repo: either file changes only by a PR. Nothing in this clause rules on items 2–5 of PR #231 — the Councilor C finding quota, the Layer-3 / DAG product mismatch, the law's silence on model tiers, and the “3/4 + Chair veto” ambiguity in the law's own text — which remain open owner decisions.

**Chair-lift (protocol §2.3) — kept, as a bounded exception granted by this file.** The council protocol (§2, directive 3) ranks below this file in the ladder, so this lift has effect only because this section grants it; the protocol may not widen it, and widening it requires an amendment under the safeguard carve-out above. The Chair may lift Constitution rules 1 and 3 only, and only for a verified vulnerability or an interface incompatibility, and only to the minimum extent the verified trigger requires. The trigger, the evidence verifying it, the rules lifted, and the exact scope of the lift must be recorded in the Consensus Manifest before implementation, and the lift must be named in the final report the owner sees. The lift never applies to Constitution rules 2 or 4, and it never lifts, waives, or substitutes for any Non-negotiable safeguard — including merge authority and panel approval of the final tip, no self-certification, the destructive-change recovery path, player-facing locks, branch protection, or the eval discipline for this file. If the trigger is not verified in the manifest, the lift is void: stop and ask the owner.

## B. Ambiguity: the full reserved-decision list

**Ambiguity.** Inspect repository evidence first. If a task has several
reasonable readings, state them and proceed on the narrow, safe, reversible
one, recording the assumption. Stop and ask only when the uncertainty touches
license/legal status, security/privacy, an irreversible or destructive
effect, external authorization, a design-of-record decision the owner reserves — namely (i) any choice where one option is better for learning and another is better for engagement, retention, score, streaks, or difficulty feel, including any change to difficulty tiers, picker bands, dealing weights, scoring multipliers, or hint defaults; (ii) any creation, change, or reinterpretation of locked or owner-approved copy, including the donation copy in Player-facing locks, the approved hint wordings (story card: "The words are right here — read along with me. Tap the replay button to try again."; home banner: "Tap me to try again."), the slogan, and the approved share-text format, in each case as recorded in the Handbook; and (iii) any lowering, exception, or reinterpretation of an accessibility floor — tap targets of at least 44px, text contrast of at least 4.5:1, and focus-ring contrast of at least 3:1 on dark surfaces — or makes acceptance impossible — and then
ask for the smallest decision that unblocks, with a compliant alternative.

## C. Destructive changes

- **Destructive changes.** Work that may destroy or irreversibly transform
  data requires, before execution: a backup/snapshot with a demonstrated
  restore (or a tested rollback), stated pre/post invariants, the exact
  target, and explicit approval. If backup is technically inapplicable, the
  owner records why and accepts the residual risk first. No verified
  recovery path, no destructive change.

## D. Monetization and telemetry (full rule)

- **Player-facing locks.** Donation copy is verbatim-locked: line 1 is
  "Grown-ups — buy me a coffee? ☕" and line 2 is
  "Your support keeps Meridian free for kids" — any change to either
  line, including punctuation, the em dash (U+2014), or the ☕ (U+2615),
  is a block.
  Monetization: no paywalls ever; no real-money purchases; no gated
  progression; and no paid clues or hints. Earnable in-game currency is
  allowed only if it is earned through gameplay, with no real-money
  purchase of it, no cash-out, and no conversion to or from real money
  or any real-money-purchasable currency. The only real-money flow is
  Ko-fi, solely as voluntary, grown-up-gated support that never locks,
  gates, or conditions access to any game, map, mystery, clue, hint, or
  progression, and gives no in-game currency, item, or advantage in
  return. COPPA-safe, scoped to what leaves the device: no PII in
  analytics or telemetry. The telemetry code does not store the raw
  user-agent string; it is read in page memory only to derive the
  parsed fields, and never leaves the device. Outbound telemetry carries a fixed, coarse field set only — the fields named in the telemetry field manifest (`src/lib/telemetry-manifest.ts`): OS family and OS version as parsed from the user-agent string, browser name and version as parsed, engine, device class (phone/tablet/desktop, never a model), form factor, device-pixel-ratio bucket, screen-size bucket, touch-point bucket, display mode, connection effective type where the browser exposes it, primary locale tag, and — as whole-session values, never combined with any stored or per-device record — `navigator.deviceMemory` as read (or the literal `unknown` where the browser does not expose it) and `navigator.hardwareConcurrency` as read (or `unknown`). The raw user-agent string itself never leaves the device, is no longer stored on the device by the telemetry code, and is deleted on arrival by the receiving worker. No identifiers, no exact screen size, no GPU strings, and no location finer than edition/region are ever carried. One carve-out: the contact form is the only place
  user-entered PII exists — what someone types there goes only to the
  contact endpoint, to handle their message, and never into analytics
  or telemetry.

## E. Prompt, skill, and persona changes: eval discipline

Changes to reusable prompts, skills, council/persona definitions, or this
file are behaviour changes and are evaluated like behaviour. Storyteller
audio clip swaps are behaviour changes under the same discipline — one
voice is the invariant (handbook ch03) — with the storyteller audio guard
(`scripts/storyteller-audio-guard.test.mjs`) as the regression check:

1. Before the run, record an eval card: stable case IDs with expected
   outcomes, **should-trigger and should-not-trigger** cases, the side
   effects that block promotion outright (any safeguard violation is
   zero-tolerance), the target revision and prompt/skill version, the
   grader, and the repetition rule.
2. Run a baseline (without the change) and the candidate in **fresh
   sessions** with state reset or uniquely namespaced. Measure
   *activation* (did it engage where it should, stay out where it
   shouldn't) separately from *correctness*.
3. Change only what an observed failure justifies. Promote only when the
   predeclared thresholds pass across the required repetitions; track
   quality alongside cost/latency.
4. Verified failures become permanent regression cases with stable IDs.
   Never promote a case that is contaminated or ambiguous.

**Eval card — the template.** Case ID · claim under test · input/trigger · expected behaviour · should-trigger or should-not-trigger · side effects that block promotion · baseline result · candidate result · verdict. A card without should-not-trigger cases is incomplete.

Reducing human review or adding autonomy for a workflow follows the same
rule at one level up: predeclared evidence thresholds, repeated success,
a demonstrated failure-detection path, a tested rollback, and a working
escalation path — never a single green run.

## F. Task capsule

Every task starts from a brief plan. Tier 2 uses the Consensus Manifest;
Tier 0/1 use this capsule (in the PR body or the branch's `docs/branch-status/<branch>.md`; full protocol: `docs/ops/agent-council-protocol.md`):

```text
TASK / requested outcome:
Interpretations considered and selected reading:
Tier and rationale:
Done condition / scenarios / evidence that will prove it:
Files and interfaces in scope (and protected files out of scope):
Dependencies / ordering (what blocks what), when multi-step:
Ownership: agent, workspace/worktree, allowed tools:
Verification contract (gates + isolation needs):
Assumptions, risks, unknowns:
Simpler or rejected approach, and why:
Budget: parent cap and child allocations:
Approvals needed (exact action + owner), checker, escalation:
```

Update the plan before implementing further if evidence changes scope,
risk, acceptance, or files. Do not silently exceed scope; three files is
the default scope, not a reason to omit a genuinely synchronized change
(e.g. a doc the code change makes stale — documentation is part of every
fix, README included, in a plain tone a new developer can onboard from).

## G. Verification and the record

- Verify against the **target revision**: read the real test, CI, lint,
  and release checks from the repo as it stands. Do not invent commands,
  and do not treat a check that was not run as a pass.
- For a bug fix, the regression check fails for the intended reason
  *before* the fix when feasible; its predicted failure signature is
  agreed up front (Tier 2: in the manifest). New non-trivial logic leaves
  a small reproducible check behind.
- Every final report states, per item: outcome, revision/files changed,
  the actual checks run with `PASS` / `FAIL` / `NOT RUN` / `UNVERIFIED`,
  the checker's verdict where one is required, remaining risks, and the
  exact external state (pushed? PR open? nothing sent?). The verification
  record names the target revision, exact commands, environment, case
  counts (pass/fail/skip), and a durable evidence path.
- **Checker unavailable ≠ deadlock, and ≠ a safeguard waiver.** If a required independent checker genuinely cannot be staffed, the gate does not silently pass: the work is reported `UNVERIFIED`, and it proceeds only on the owner's recorded risk acceptance for that specific item — a record that names the item, the missing checker, the risk accepted, and the date. Absent that record, it waits.
- **Limits on that acceptance.** The paragraph above waives nothing in the Non-negotiable safeguards. If the absent checker is the checker for a safeguard block itself — merge authority and the panel's approval of the final tip, branch protection or a ruleset, the destructive-change recovery path, a player-facing lock, or the weakening of a gate, trust-boundary validation, corruption/data-loss handling, or accessibility — owner risk acceptance does not substitute for the check: the item does not proceed. Nor does risk acceptance cure self-certification: the builder or author of the work may not supply the missing verdict, may not be recorded as its checker, and may not accept the risk on their own work; the final report still states `UNVERIFIED` and names the owner's acceptance record.

**Findings standard (every tier's review).** An actionable finding states:
concrete input/state/reachable path → expected behaviour or invariant →
observed or provable wrong result → evidence. No concrete case, no
actionable finding. Records are claims, not facts: any "owner approved /
decided / agreed" line carries a citation to the owner's actual words
(message and date), and a "safe to merge" claim lists every unresolved
block as a caveat.

## H. Push authorization, branch status, branch cleanup

- **Stage named files only, never `git add -A`** — and check `git status`
  plus the staged diff before committing on any branch a second crew
  shares; a dirty shared index sweeps other work into your commit.
- **Push early and often — standing authorization.** The owner's assignment of a task on a named branch is standing authorization to commit named files on that branch and to push that branch, and only that branch, to origin as the work lands — including updates to that branch's `docs/branch-status/<branch>.md` and cure commits to the same PR branch. A local machine is not durable storage for unpushed work, so use this authorization; do not hoard commits locally. It covers no other action in the "No unapproved side effects" bullet: opening a PR (unless the assignment itself says to open one), merge, publish, release, install, external message, production write, remote-setting change, and force-push each still need authorization for that exact action. If no branch was assigned, or the task was assigned as read-only, no push authorization exists.
- **Per-branch status record.** Every feature branch carries its own record,
  `docs/branch-status/<branch>.md` (the branch name with `/` replaced by
  `-`, e.g. `feat/math-spec` → `docs/branch-status/feat-math-spec.md`),
  tracking task, scope, done vs pending; update and push it with the work.
  Each branch edits only its own file, so concurrent branches never collide
  (owner's no-collision ask, 2026-11-10, recorded in
  `docs/scaling/plans/chore-model-neutral-agents.md`). Root
  `BRANCH_STATUS.md` is not a per-branch file: branches do not edit it; it
  is integrator-only (`docs/branch-status/README.md`). A PR whose scope is one file records its capsule and status in the PR body under the same exception.
- **A merged branch is deleted, not left behind.** Cleanup is part of the task,
  not a follow-up someone has to ask for. Keep *Settings -> General -> Pull
  Requests -> Automatically delete head branches* switched on so this happens
  with nobody's attention — note it applies to future merges only and does
  **not** retroactively remove branches already left behind. Delete by hand
  where you can (`git push origin --delete <branch>`); some environments
  refuse ref deletion. Try it, and if it is refused, name the
  leftover branch in your final report rather than going quiet.

## I. Budget meter

Token budget is a parent cap that **includes** planning, helper agents,
reviews, tools, and fixes. Child budgets are allocations inside it, not
additions. Work packaged as linked PRs for one outcome shares that
outcome's cap; splitting work to evade a cap is a violation, not a
strategy.

The tier caps above (25k / 100k / 400k) bind the parent/orchestrator's own token consumption plus all its delegates' consumption combined — they are one shared budget per task, not a per-agent allowance. The counter's owner is the parent/orchestrator. The meter is the runtime or session token count reported for the run, summed across the parent and every delegate it spawned. No meter exists in this repo — there is no token-counting script, CI job, or telemetry field for agent runs — so where the runtime reports no count, the parent states its estimate and its uncertainty and labels the report `BUDGET EXCEEDED (estimated, no meter)` rather than presenting the estimate as a meter reading.

At or before the cap: stop, report `BUDGET EXCEEDED` with what is done,
what remains, and the evidence so far. Work resumes only on the owner's
approval of a revised cap or a narrower plan. If exact counts are
unavailable, state the estimate and its uncertainty — never present an
estimate as a meter reading. The budget never waives a gate: hitting the cap stops and reports — it does not skip, defer, or soften any gate in Quality gates, and it does not waive the panel's approval of the final tip or the owner's merge word.

## J. Delegation discipline

Give each worker a brief that names the branch, what is already built, the
exact commands, and what to report — it has no other context. Match the
model to the size of the job: a one-command check does not need a mid-tier
model, and a long multi-step run on the smallest model that has to be redone
saves nothing.

Delegation helps because the worker's reading stays in the worker's
context, but it is the **third** of four savings levers — after the tier
gate and narrow context resolution, and ahead of model tier. See
`AGENTS.md` §4 for the ranking.

**Delegation discipline (all tiers).**

- A child agent inherits neither the conversation nor files already read.
  Every brief is self-contained: objective, input paths, constraints,
  permitted tools, write scope, done condition, expected evidence, budget
  share, and stop condition.
- Persona seats (review panels, crews) are staffed from the owner's
  persona files with the persona file loaded into the brief —
  a role title alone does not engage the specialist. A missing persona
  file is disclosed, never silently improvised.
- Research and review workers are read-only by default. Delegated
  execution gets least-privilege tools, its own workspace/worktree, and
  **no inherited secrets**; credentials are scoped and short-lived when a
  task genuinely needs them.
- Parallelize only independent work with separate file ownership or
  separate worktrees and a named integrator. Inspect every worker diff —
  including outside its assigned paths — and run combined checks before
  anything is called done.
- Track delegated work as `{task_id, status, owner, evidence, blocker}`
  with status one of `queued`, `running`, `blocked`, `ready_for_review`,
  `verified`, `closed`. A child's claim is unverified until checked
  against its evidence.
