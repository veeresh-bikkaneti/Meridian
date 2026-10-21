# Agent Council Protocol (TDD/ATDD)

The deliberation process for Tier 2 work. `AGENTS.md` decides which tier a task
is; this file is only read when the task is Tier 2.

The Constitution in `AGENTS.md` governs throughout. This protocol adds process;
it never relaxes a Constitution rule.

---

## 1. Seats

A "seat" is a subagent spawned with the `Agent` tool. One agent may hold several
seats on a small Tier 2 task, but Councilor C is always a separate agent: its
value is in not having written the thing it reviews.

| Seat | Model | Duty |
| :--- | :--- | :--- |
| **Chair / Arbiter** | `opus` | Lead architect and security officer. Owns system boundaries, non-functional requirements (privacy, latency, bundle size), deadlock resolution, and the veto. |
| **Councilor A** | `sonnet` or `haiku` | ATDD / customer advocate. Writes acceptance criteria as declarative `Given-When-Then`. Owns user journeys and edge cases. For Meridian, the user is a child: a criterion a child could not observe is not a criterion. |
| **Councilor B** | `sonnet` or `haiku` | TDD / unit and contract lead. Turns A's criteria into failing test contracts, mock boundaries, and interfaces. Test logic only, never production skeletons. |
| **Councilor C** | `sonnet` or `haiku` | Adversarial skeptic. Attacks assumptions, hunts boundary blind spots, flags scope creep, blocks premature refactoring. Must end with `CHALLENGE: <reasons>` or `NO OBJECTION`. |

---

## 2. Directives

1. **No implementation code before the manifest is signed.** If production code
   was written before Phase 4 completes, revert it (`git checkout --` the file)
   and restart at Phase 1. Tests and the manifest itself are not implementation.
2. **Test-first is invariant.** Behaviour maps to declarative criteria (ATDD
   gate), and every test's failure signature is agreed before any code exists
   (TDD gate).
3. **Constitution rules 1 and 3 bind the council.** No refactoring working
   adjacent code; edits stay inside the targeted functions. The Chair may lift
   this only for a verified vulnerability or an interface incompatibility, and
   must record the reason in the manifest.
4. **Constitution rule 4 binds the output.** Final plans and results are
   atomic in-place unified diffs over the scoped files.

---

## 3. Epistemic rigor and token economy

1. **Resolve context narrowly.** Use `Grep`, `Glob`, and the `Explore` agent to
   find what you need. Never load a directory tree to answer a question a
   search would answer. If a graph or index plugin is available in the session,
   prefer it; none is installed in this repo today, so do not wait for one.
2. **Verify external facts, read internal ones.**
   - External library or API behaviour, version syntax, platform limits →
     verify by web search against current official documentation. Do not answer
     from memory.
   - Anything about this repository → read the repository.
   - Place data (`history`/`fact` fields, names, geography) → card content rule
     5 in `AGENTS.md` governs and is stricter: curated notes or the verified
     pipeline only. A web search is not a source for place data.
3. **Cite and declare confidence.** Every external assertion carries its source
   URL. Every proposal carries a confidence level of High, Medium or Low. Below
   High, name the exact missing fact that would raise it.

---

## 4. Pipeline

```text
[Task]
  │
  ├─► Phase 1  ATDD criteria .................. Councilor A
  │
  ├─► Phase 2  TDD contracts .................. Councilor B
  │
  ├─► Phase 3  Adversarial cross-examination .. Councilor C
  │
  └─► Phase 4  Review and sign-off ............ Chair
         │
     Resolved?
       ├── NO, and < 2 challenge rounds spent ──► back to Phase 1 or 2
       ├── NO, and 2 rounds spent ────────────► Chair decides; the unresolved
       │                                         objection is recorded verbatim
       │                                         in the manifest
       └── YES ───────────────────────────────► Signed Consensus Manifest
```

### Phase 1 — ATDD criteria (Councilor A)

Concrete Gherkin scenarios over observable behaviour, never internals. At
minimum: 1 happy path, 2 failure or rejection paths (invalid state, malformed
input, a resource that will not load), 1 edge or boundary path.

### Phase 2 — TDD contracts (Councilor B)

- Exact test file path and test names.
- The anticipated failure: the assertion message or status the RED run prints.
- Required mocks, fixtures and isolation boundaries.
- No production logic skeletons.

### Phase 3 — Adversarial challenge (Councilor C)

Audit for: unverified or uncited external dependencies and undeclared
confidence; scope creep beyond the task; flakiness risk (async timing, races,
unmocked bindings, and in this repo any test that measures layout across two
frames); assertions loose enough to pass vacuously.

### Phase 4 — Chair sign-off

The Chair checks alignment with repository architecture, security and privacy
boundaries, and the no-refactor constraint; vetoes untargeted context loading;
returns the work with binding constraints, or signs the manifest.

---

## 5. Signed Consensus Manifest

Emit this before touching a source file.

```markdown
# COUNCIL CONSENSUS MANIFEST

## 1. ATDD acceptance scenarios
- Scenario 1: Given ... When ... Then ...
- Scenario 2: Given ... When ... Then ...

## 2. TDD test specification
- Target test file: `path/to/test.spec.ts`
- Expected initial state: RED (failure: `<exact assertion message>`)
- Target source file(s): `path/to/source.ts` (functions: `targetFunction()`)

## 3. Scope boundary
- Protected files (must not be touched): [...]
- Permitted diff footprint: max +/- N lines

## 4. Epistemic baseline
- Sources cited: [URLs verified by web search]
- Confidence: High | Medium | Low (if not High: the missing fact)

## 5. Arbiter approval
- Status: APPROVED
- Unresolved objections carried: [none, or Councilor C's words verbatim]
- Execution token: `AUTH_RUN_TDD_IMPLEMENTATION`
```

### Protected by default in this repo

Name these under "Protected files" unless the task is explicitly about them:
`src/game/data/**` (place data: card rule 5), `package-lock.json` (regenerate
with npm, never hand-edit), `.scratch/`, and any other branch's worktree.

---

## 6. Execution (after `AUTH_RUN_TDD_IMPLEMENTATION` only)

1. **RED.** Write only the agreed tests. Run them. Confirm they fail with the
   predicted signature. A test that passes before the fix exists is a broken
   test, not a head start.
2. **GREEN.** Write the minimal production logic that turns them green, inside
   the targeted functions only.
3. **Verify.** Run the full gate list in `AGENTS.md`: `npx tsc --noEmit`,
   `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`, and the
   Playwright specs that cover the changed surface. Zero regressions.
4. **Deliver.** Present the change as a unified git diff. Update
   `BRANCH_STATUS.md`, and record in it any manifest item that went unmet.
