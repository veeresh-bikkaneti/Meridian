# E2E posture on a weak VM — proposal for panel review

**Date:** 2026-10-22
**Author:** Claude (Opus 5), at the owner's direction
**Status:** RULED. The owner answered every open question on 2026-10-22
("Adopt all"); the rulings are recorded in §7 against each question.
**Change A (§5.1) has shipped** — PR #226, merged 2026-10-22; `main`'s `e2e`
is green again. Changes B and C (§5.2, §5.3) are **not yet built**.
This document is the permanent record of the decision; the companion
`2026-10-22-weak-vm-e2e-handoff.md` is working material and is deleted with
the PR that lands the last change.
**Owner's framing (verbatim, 2026-10-22):** *"your vm is week and our app
should work even when vm is week"*

---

## 1. Why this document exists

On 2026-10-22 four branches went red on `e2e`, all explicable as "the
Playwright VM is weak." They turned out to be three distinct problems, and
**the app was at fault in none of them**. Treating them as one bucket is how
a real gap stayed invisible, so this separates them and proposes a change of
posture.

The owner's sentence above is the whole argument in one line. Meridian
targets children's and hand-me-down devices. A weak device is not an
unlucky CI runner — it is a **user**. Our test harness currently spends its
effort escaping weakness rather than proving the app survives it.

---

## 2. What actually happened (evidence)

### 2.1 `e2e` is red on `main`, not just on the PRs

| Ref | Commit | `build (22.x)` | `e2e` |
| :--- | :--- | :--- | :--- |
| `main` (#222 merge) | `1ca4c04` | pass | **fail** (run 39712092461) |
| PR #217 | `314b66b` | pass | **fail** (job 119608941564) |
| PR #212 | `04e3f8a` | — | **fail** (job 119610150891) |
| PR #197 | `6b11c4c` | pass | pass (job 119608300852) |
| PR #219 | `aefd80a` | — | **fail** (job 119625304756) |

PR #219 is the decisive case: its entire diff against `main` is **two
markdown files** (`AGENTS.md` and this document). A docs-only change cannot
influence a Globe chunk request, and it turned `e2e` red. (The specific
failing test could not be read back — the log API's tail window reaches
only the job's cleanup steps — but the diff settles the question of cause.)

The same spec failed on `main` itself. PR #212's diff is `public/_headers`,
`BRANCH_STATUS.md` and one assertion in `scripts/security-headers.test.mjs`
— none of which can influence a Globe chunk request, and `_headers` is not
even applied by the Playwright harness, which intercepts routes directly.
PR #197 passing is the same coin landing the other way, not evidence of
health.

### 2.2 The failing assertion is a race, and the test is wrong

`tests/e2e/observability.spec.ts:238`:

```ts
expect(globeRequests).toBeGreaterThanOrEqual(1, "the real Globe chunk request was made (and is held)");
```

The test first polls (30 s, generous) for the `data_chunk_load_start`
milestone, then asserts — **without retry** — that the chunk request has
already arrived. But in `src/components/game-app.tsx:1627` the milestone is
recorded *before* the calls that trigger the dynamic import:

```ts
recordMilestone("data_chunk_load_start", { edition, regionId, chunkId: regionId });
const tierSplit = await globeTierSplitFor(edition, regionId);   // ← request happens here
```

So there is a window in which the milestone is set and `globeRequests` is
still `0`. On a fast machine the window closes before the assertion runs;
on a slow one it does not. **The app is behaving correctly. The test
assumed a speed the machine does not have.**

### 2.3 CI tests no map behaviour at all

The `e2e` job runs exactly three spec files:

```
npx playwright test tests/e2e/grownups-privacy-contact.desktop.spec.ts \
                    tests/e2e/hydration-boot.desktop.spec.ts \
                    tests/e2e/observability.spec.ts --workers=1 --reporter=line
```

Seven tests. PR #222's own commit message states the reason: *"New e2e job
runs grownups-privacy-contact, hydration-boot and observability (no WebGL
map taps)."* The map specs were deliberately excluded **because the VM is
weak**.

The consequence is the gap this document is about: the weak-device code
path — the one path a real low-end user is guaranteed to hit — is verified
by nobody on any pull request.

### 2.4 The test that would close the gap exists already, unused

PR #197 adds `tests/e2e/scout-harness-suppression.desktop.spec.ts`, a
deliberately discriminating pair:

- **Test 1** — default serve (capable-device spoof installed): the weak VM
  boots the full map, writes no stored record, shows no auto-switch note,
  and the starfield mounts.
- **Test 2** — `serveBuiltArtifact(context, { spoofCapableDevice: false })`:
  the *real* SwiftShader VM is left weak, and the app is asserted to
  degrade correctly — auto-switch to Scout, a `probe` auto record, a
  visible "You're on Scout Map" note, indicator reading `scout`.

Test 2 is precisely "the app works when the device is weak," executed
against a genuinely weak device. Neither test runs in CI.

---

## 3. Verification performed for this document

- **Local Playwright run**, built artifact, this VM: 22/22 scout specs
  passed in 3.3 min (`scout-harness-suppression`, `scout-offer`,
  `scout-capability-offer`, `scout-false-demotion`).
- **Visual pass** (delegated to a `haiku` subagent, per the AGENTS.md
  worker-role rule). Keep two things apart here:
  - *Seen in screenshots* (indicative only): default boot shows the
    starfield and a "Full map" pill; opted-out boot shows no starfield, a
    "Scout Map" pill and the auto-switch note. The two *map* screenshots
    came from Playwright failure captures after a screenshot timeout — real
    images of the map, but not taken at the intended moment.
  - *Asserted by the spec* (the actual gate): mode `scout`, a `probe` auto
    record in storage, and the auto-switch notice element present. Those
    assertions passed; the screenshots corroborate, they do not prove.

  One pre-existing blank gap in the Journal panel appears in **both** states
  and is not caused by #197.
- **Qualification order confirmed** at `src/map/capability.ts:104-129`:
  `manual` → `priorMapCrash` → `webglProbeOk` → memory.

### Not verified

- The live `meridian.knowledgetest.workers.dev` probe could not be re-run;
  the agent proxy returns 403 for that host.
- No measurement of how much wall-clock adding specs costs the CI job
  (section 5.2 gives an estimate only).

---

## 4. The posture problem, stated plainly

Today the harness treats VM weakness as an obstacle:

> The VM reads as weak → that would auto-switch us to Scout → suppress it
> so the specs can run.

That is legitimate *for specs about full-map behaviour* — they genuinely
need a capable device, and #197's device spoof is the honest way to get one
(it fakes the signals, not the decision, so the app's own qualification
path runs unmodified). But it has quietly become the **only** posture. The
inverse case — let the VM be weak, and prove the app does the right thing —
is written and passing, and runs nowhere automatic.

---

## 5. Proposal

Three changes, smallest first. **None are implemented.**

### 5.1 Fix the race (unbreaks `main`)

```diff
--- a/tests/e2e/observability.spec.ts
+++ b/tests/e2e/observability.spec.ts
@@
     armedSessionId = armed;
-    expect(globeRequests).toBeGreaterThanOrEqual(1, "the real Globe chunk request was made (and is held)");
+    await expect
+      .poll(() => globeRequests, { timeout: 15_000, message: "the real Globe chunk request was made (and is held)" })
+      .toBeGreaterThanOrEqual(1);
```

Waits for the request instead of assuming it already fired, keeping the
original assertion message via `poll`'s `message` option (Playwright 1.63
accepts it). The route handler holds the request open regardless, so the
rest of the test is unchanged. This is a test correction, not a product
change.

**Shipped.** This landed as PR #226, merged 2026-10-22, in this form.
`main`'s `e2e` is green again (run 39761267966).

**Why it matters beyond this one test:** it is the same class of bug the
whole suite is exposed to. A fixed-duration assumption is a latent failure
on every slow machine, including the users' machines.

### 5.2 Put the weak-device test in CI

Add `tests/e2e/scout-harness-suppression.desktop.spec.ts` **test 2** to the
`e2e` job's spec list.

**The spec does not exist on `main`.** It lives only on branch
`fix/154-seam-test-only` (PR #197), so this change lands inside #197 or
after it — never before.

**Mechanism (owner ruling, Q5: Option 1).** Tag test 1 `@local-only` in its
title and add `--grep-invert @local-only` to the CI command, so the file can
be listed while only test 2 runs. The workflow step carries a comment
stating the convention, why it exists, and that the runner must stay weak.
The implementing PR shows `playwright test --list` output with and without
the invert as evidence. When this lands, also wrap that spec's stored-record
read in `expect.poll` — same class of race as §5.1.

- Test 2 performs no map taps and needs no WebGL rendering — it reads
  `sessionStorage`, the mode indicator attribute and the notice element.
- **Cost:** the pair (tests 1 + 2) measured ~46 s locally. Test 2 alone is a
  fraction of that, but has not been timed in isolation, and CI runners are
  slower than this VM. An earlier draft of this document estimated "a few
  seconds"; that was roughly an order of magnitude optimistic. Budget tens
  of seconds and measure in the implementing PR.
- Effect: every PR proves the app degrades correctly on a weak device.

### 5.3 Keep test 1 out of CI, for now

Test 1 mounts the full 3D map and asserts the starfield. That is exactly
what this VM renders unreliably — the visual pass had to fall back to
failure captures because live screenshots of the map hung. Putting it in CI
buys a flaky check, not confidence. It stays a local/manual gate until
either the runner improves or the assertion is made render-independent.

---

## 6. Risks and counter-arguments

| Risk | Assessment |
| :--- | :--- |
| 5.1 masks a real app bug by waiting longer | The 15 s poll fails if the request never fires. It converts "assert instantly" into "assert within a bound" — strictly more honest, not more permissive. |
| 5.2 makes CI slower | Test 2 only, with test 1 held out by `--grep-invert @local-only`. The pair measured ~46 s locally; test 2 alone was not timed in isolation. Measure it in the implementing PR, and reconsider if test 2 alone exceeds ~30 s. |
| 5.2 is itself flaky on a loaded runner | Possible. It asserts state transitions with explicit waits and no rendering, which is the low-risk end. Mitigation: if it flakes once, fix the wait, do not quarantine it. |
| The spoof hides real weak-device failures from every other spec | **Real, and accepted.** The owner ruled (Q1) that targeted coverage is enough and declined a second all-weak CI lane. The exposure stands; it is a known, chosen limit rather than an oversight. |

---

## 7. Questions, and the owner's rulings

All five were answered by the owner on 2026-10-22 ("Adopt all"). The
question is kept with its ruling so the reasoning stays legible.

1. **Does the capable-device spoof now hide too much?** Every other spec
   runs with it on, so the app may be failing on genuinely weak devices in
   ways no spec would catch. Is a second CI lane — the whole suite run
   weak — worth its cost, or is targeted coverage (5.2) enough?
   > **RULED:** targeted weak-device coverage is enough. No second
   > all-weak CI lane.

2. **Behavioural change in #197 worth recording?** The old seam suppressed
   the auto-switch for *every* reason. The new spoof only neutralises probe
   and memory; `priorMapCrash` is checked first and still wins. A future
   spec that induces a real map crash and reloads under the default serve
   will boot Scout where it previously would not. Docstring, or a louder
   guard?
   > **RULED:** amend `serveBuiltArtifact`'s docstring — the spoof fakes
   > probe and memory only; a stored record wins first, then a seeded
   > prior-map crash. Crash-seeding specs serve with
   > `spoofCapableDevice: false` unless the crash itself is the subject.
   > No runtime guard. Rides with the #197 work.

3. **Where should 5.1 land?** Its own PR (needs a Constitution rule 2
   waiver), folded into #197, or onto this branch?
   > **RULED:** its own tiny PR, rule-2 waiver granted and recorded in that
   > PR's body. **Done — PR #226, merged 2026-10-22.** Do not rebuild
   > Change A on this branch.

4. **Is `main` being red an incident?** Four branches were hit, including a
   docs-only PR.
   > **RULED:** yes — blocking, a CI-integrity incident. Docs PRs could
   > merge with the flake named as pre-existing. Now moot: #226 fixed it.
   > `e2e` is **not** to be added to required checks.

5. **How should test 1 be held out of CI** — tag it, or split the file?
   > **RULED:** Option 1. Tag test 1 `@local-only`, add
   > `--grep-invert @local-only` to the CI command, comment the workflow
   > step (convention, why, runner must stay weak), and show
   > `playwright test --list` with and without the invert in the
   > implementing PR. Also wrap that spec's stored-record read in
   > `expect.poll` when Change B lands.

---

## 8. What this document does not propose

- No change to `src/` product code. The app is not at fault in any of the
  three failures.
- No skipping, disabling or quarantining of any test.
- No change to the Cloudflare "Workers Builds" check, which the owner has
  ruled ignorable (it fails on every branch; `main`'s deploy is green).
