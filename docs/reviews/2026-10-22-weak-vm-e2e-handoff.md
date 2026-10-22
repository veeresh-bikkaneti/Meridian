# Implementation brief: weak-VM E2E posture

**For:** whoever implements this (Grok or another agent)
**Rationale and evidence:** `docs/reviews/2026-10-22-weak-vm-e2e-posture.md`
(on branch `claude/hopeful-darwin-dp7ket`, PR #219). Read it first — this
file is the *how*, that one is the *why*.
**Repo:** `veeresh-bikkaneti/Meridian`
**Written:** 2026-10-22, by Claude (Opus 5), from direct observation.

**The owner has ruled on every open question** (2026-10-22, "Adopt all").
The rulings are in §8 and in the posture doc's §7 — read them before
implementing; do not re-decide anything they settle.

**Change A has already shipped** (PR #226, merged 2026-10-22). Do not
rebuild it. What remains is Change B and Change C.

Lifecycle: the posture doc is the permanent record. This file is working
material — delete it in the same PR that lands the last remaining change,
and move §6's durable pitfalls into `AGENTS.md` or `docs/ops/` at that
point.

---

## 0. State of the world when this was written

Verify each before starting; if any is false, the plan may need rework.

| Fact | How to check |
| :--- | :--- |
| `main` was at `1ca4c04` with `e2e` **red** — **now fixed** by PR #226 (merged 2026-10-22); `main` green at `05916f8`, run 39761267966 | `gh run list --branch main` |
| `main`'s `build (22.x)` is **green** | same run |
| **#197's `e2e` is GREEN** (job 119608300852) | The red ones were #212, #217 and #219, each failing *only* at `observability.spec.ts:238`. #219's diff is two `.md` files, so the cause was never any PR. |
| All four branches are 0 commits behind `main`, no conflicts | `git merge-tree --write-tree origin/<branch> origin/main` |
| "Workers Builds: meridian" fails on every branch | **Owner has ruled this ignorable.** Do not try to fix it. |

---

## 1. Change A — fix the racing assertion — **SHIPPED, do not redo**

> Landed as **PR #226, merged 2026-10-22**, in the form below with the
> assertion message preserved. `main`'s `e2e` is green (run 39761267966).
> Kept here as the record of what was done and why. Owner ruling Q3: do
> not rebuild Change A on the docs branch.

### The bug

`tests/e2e/observability.spec.ts` test `D1 real-sequence: kill during Globe
chunk load ...` (starts line 160).

It polls up to 30 s for the `data_chunk_load_start` milestone, then asserts
**without any retry** that the Globe chunk request has already been made:

```ts
expect(globeRequests).toBeGreaterThanOrEqual(1, "the real Globe chunk request was made (and is held)");
```

But in `src/components/game-app.tsx:1627` the milestone is recorded
*before* the awaits that actually issue the import:

```ts
recordMilestone("data_chunk_load_start", { edition, regionId, chunkId: regionId });
const tierSplit = await globeTierSplitFor(edition, regionId);   // ← request fires here
```

There is a window where the milestone is set and `globeRequests === 0`.
Fast machine: window closes first, test passes. Slow machine: it does not.

**The app is correct. The test assumed a speed the machine does not have.**
Do not "fix" `game-app.tsx`.

### The patch

```diff
--- a/tests/e2e/observability.spec.ts
+++ b/tests/e2e/observability.spec.ts
@@
     armedSessionId = armed;
-    expect(globeRequests).toBeGreaterThanOrEqual(1, "the real Globe chunk request was made (and is held)");
+    // The milestone above is recorded BEFORE the await that issues the
+    // chunk import (game-app.tsx), so the request may not have landed yet
+    // when the poll resolves. Wait for it rather than assuming it is here;
+    // a bare assertion makes this test a coin flip on slow machines.
+    await expect
+      .poll(() => globeRequests, { timeout: 15_000, message: "the real Globe chunk request was made (and is held)" })
+      .toBeGreaterThanOrEqual(1);
```

Notes:
- `expect.poll(...)` takes the assertion message as its `message` option
  (Playwright 1.63). Keep it — it is what the reader sees on failure.
- The route handler holds the request open regardless, so nothing else in
  the test changes.
- Keep `await`. Without it the assertion silently never runs.

### Prove it before pushing

1. **Reproduce the failure first.** On a current checkout, run the CI
   command repeatedly until it fails at least once:
   ```
   npm run build:pages
   npx playwright test tests/e2e/observability.spec.ts --workers=1 --reporter=line
   ```
   It is a race — budget several runs. Under CPU load it fails sooner
   (try `--repeat-each=3`, or run a busy loop alongside).
2. Apply the patch.
3. Run the same command several times. All green.
4. Run the full CI spec list:
   ```
   npx playwright test tests/e2e/grownups-privacy-contact.desktop.spec.ts \
                       tests/e2e/hydration-boot.desktop.spec.ts \
                       tests/e2e/observability.spec.ts \
                       --workers=1 --reporter=line
   ```

If you cannot reproduce the original failure, **say so in the PR** rather
than claiming the fix is verified. The CI evidence (four branches, one of
them docs-only) stands on its own, but a fix you could not test is a fix
you should label as such.

---

## 2. Change B — put the weak-device test in CI

### What to add

`tests/e2e/scout-harness-suppression.desktop.spec.ts` currently lives only
on branch `fix/154-seam-test-only` (PR #197). It has two tests:

- **Test 1** (line ~35) `default serve: weak VM boots full ...` — mounts
  the 3D map, asserts the starfield. **Do NOT add this to CI.** See §3.
- **Test 2** (line ~67) `opted-out serve: the same weak VM auto-switches to
  Scout (contrast pin)` — **this is the one.** It serves with
  `{ spoofCapableDevice: false }`, leaving the real SwiftShader VM weak,
  and asserts the app degrades honestly: `scout` mode, a `probe` auto
  record in storage, a visible auto-switch notice. No map taps, no WebGL
  rendering needed.

### The workflow patch

`.github/workflows/node.js.yml`, the `e2e` job (line 52), step at line 64:

```diff
     - run: >-
         npx playwright test
         tests/e2e/grownups-privacy-contact.desktop.spec.ts
         tests/e2e/hydration-boot.desktop.spec.ts
         tests/e2e/observability.spec.ts
+        tests/e2e/scout-harness-suppression.desktop.spec.ts
         --workers=1 --reporter=line
```

### The ordering problem — read this

Adding the file runs **both** tests, and test 1 is the one to keep out.

**The owner ruled Option 1** (2026-10-22). Do not use Option 2.

- **Option 1 — RULED.** Tag test 1 `@local-only` in its title and add
  `--grep-invert @local-only` to the CI command. Self-documenting, and the
  test stays runnable locally. Required with it:
  - a comment on the workflow step stating the convention, why it exists,
    and that **the runner must stay weak** (do not "fix" the VM to make
    test 1 pass in CI);
  - `playwright test --list` output, with and without the invert, in the
    implementing PR as evidence that exactly test 2 runs;
  - wrap that spec's stored-record read in `expect.poll` — it is the same
    class of race as Change A.
- **Option 2 — rejected.** Splitting test 2 into its own file breaks the
  discriminating pair's co-location, which is the point of that file's
  design (test 2 proves test 1's pass is real).

**Do not** delete or `test.skip()` test 1. It is a real gate; it just needs
a machine that can render.

### Sequencing with PR #197

The spec file does not exist on `main`. So either:

- land this inside PR #197 itself (it already owns that file), **or**
- land #197 first, then do Change B separately.

Do not add the workflow line before the spec exists on the target branch —
CI will fail on a missing file.

---

## 3. Change C — explicitly do NOT add test 1 to CI

Test 1 mounts the globe and asserts the starfield. This VM cannot render
the map reliably: during the visual verification pass, live
`page.screenshot()` of the map **hung** and the images had to be recovered
from Playwright's post-timeout failure captures.

Putting test 1 in CI buys a flaky check, not confidence. Leave it as a
local/manual gate. Revisit if the runner improves or the assertion can be
made render-independent.

---

## 4. Gates — all must pass before pushing

```
npx tsc --noEmit                 # must be clean
npm test                         # scripts + src suites, 0 failures
node scripts/lint-cards.mjs      # must print "GATE PASSED"
npm run build:pages
npm run build
npm run test:worker              # 42/42
npm run typecheck:worker
```

Plus the Playwright runs from §1.

---

## 5. Repo conventions (from `AGENTS.md` — these are binding)

1. **Do not refactor working code.** Both changes are additive/one-line.
2. **Do not create new branches or duplicate files.** Work on the branch
   you are assigned. If Change A genuinely needs its own branch, **ask the
   owner first** — this is an open question in the review doc (§7 Q3).
3. **Edit only the targeted block, in place.**
4. **Show changes as unified git diffs**, never whole-file pastes.
5. **Stage named files only — never `git add -A`.**
6. Every feature branch carries `BRANCH_STATUS.md`; update it with the work.
7. **Never change branch protection or rulesets** without the owner's
   explicit approval for that specific merge.
8. `main` is protected: branch → PR → owner merges. Do not self-merge.

---

## 6. Pitfalls I hit — save yourself the time

- **`npm ci` fails with `EUSAGE ... Missing: <pkg> from lock file`** on
  dependabot branches. Fix: `npm install --package-lock-only`, then check
  `git diff package.json` — npm likes to widen the manifest range
  unasked. Revert that with `git checkout HEAD -- package.json` and redo.
- **`npm install` can crash** with `TypeError [ERR_INVALID_ARG_TYPE]: The
  "from" argument must be of type string` inside arborist's reify.
  `--package-lock-only` avoids it.
- **Branch deletion is impossible from the cloud container** — the proxy
  refuses ref deletion with HTTP 403. Name leftover branches in your report
  and let the owner delete them in the GitHub UI.
- **`https://meridian.knowledgetest.workers.dev` is unreachable** from the
  container (proxy 403), so live header/behaviour probes cannot be re-run.
  Do not claim live verification you did not perform.
- **The GitHub job-log API truncates to the job's tail**, which is usually
  the cleanup steps. To see a failing assertion, download the
  `playwright-report` artifact instead.
- **Scout specs take ~3.3 min locally** for all 22. Budget for it.
- **Visual testing is delegated to a `haiku` subagent** per `AGENTS.md` —
  never done inline.

---

## 7. What is explicitly out of scope

- Any change to `src/` product code. The app is not at fault in any of the
  observed failures.
- Skipping, disabling or quarantining any test.
- The "Workers Builds: meridian" check — owner has ruled it ignorable.
- The 6 Dependabot vulnerabilities on the default branch (1 high, 4
  moderate, 1 low). Real, unexamined, separate piece of work.

---

## 8. Owner rulings — all settled

Answered 2026-10-22, "Adopt all". Do not re-decide these. Full wording in
the posture doc's §7.

1. **Where should Change A land?** → Its own tiny PR, Constitution rule-2
   waiver granted and recorded in that PR's body. **Done: PR #226.**
2. **Does the capable-device spoof now hide too much?** → Targeted
   weak-device coverage is enough. **No second all-weak CI lane.** The
   residual exposure is accepted, not overlooked.
3. **Option 1 or Option 2 for §2?** → **Option 1** (tag + `--grep-invert`),
   with the workflow comment, the `--list` evidence, and the `expect.poll`
   wrap. See §2.
4. **Is red `main` an incident?** → Yes, blocking — a CI-integrity
   incident. Now resolved by #226. **Do not add `e2e` to required checks.**
5. **The #197 docstring question** → Amend `serveBuiltArtifact`'s docstring
   (spoof fakes probe + memory only; a stored record wins first, then a
   seeded prior-map crash; crash-seeding specs pass
   `spoofCapableDevice: false` unless the crash is the subject). No runtime
   guard. Rides with the #197 work.

---

## 9. Definition of done

- [x] Change A pushed — **PR #226, merged 2026-10-22**.
- [x] `main`'s `e2e` green again — run 39761267966 on `05916f8`.
- [ ] Change B pushed (Option 1 mechanism per §2); CI runs the weak-device
      test on every PR, with `--list` evidence in that PR.
- [ ] Test 2's stored-record read wrapped in `expect.poll`.
- [ ] `serveBuiltArtifact`'s docstring amended per ruling 5.
- [ ] Test 1 still exists, tagged `@local-only`, still runs locally.
- [ ] Change B's cost measured and the posture doc's §5.2 estimate replaced
      with the real number.
- [ ] All gates in §4 green.
- [ ] `BRANCH_STATUS.md` updated on whichever branch carried the work.
- [ ] **Lifecycle close-out, in the PR that lands the last change:** stamp
      the posture doc's Status line as complete (it stays as the permanent
      record), move §6's durable pitfalls into `AGENTS.md` or `docs/ops/`,
      and delete this handoff file.
