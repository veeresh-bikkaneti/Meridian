# BRANCH_STATUS — fix/challenge-framing-and-map-mode

- **Branch:** `fix/challenge-framing-and-map-mode`
- **Base:** `origin/main` at `24f4d2a` (#286 merged; rebased 2026-10-30 as second in the merge queue per the coordination ledger — the only rebase conflict was this file, resolved by keeping ALL records: this branch record first, then the records carried on main, verbatim below).
- **Prior record:** this file previously carried the `fix/220-contact-wiring`
  branch record; that work merged as PR #284 and its full record lives in
  that PR and in git history.

## Task capsule

TASK / requested outcome (owner reports, 2026-10-29, from the shipped
build): two defects on the challenge-open surface.
(1) A received State/Country challenge does not zoom to or outline its
region — Play frames and gold-outlines the region, a challenge start
does not. Must hold on the full map AND Scout.
(2) A challenge receiver cannot switch map type: the in-run toggle
forces home and kills the challenge. Owner-directed fix: map selection
happens AT CHALLENGE OPEN (choose at open, or auto-select from the
existing capability computation); the force-home must never fire inside
a challenge run.

Process: diagnosis → TDD (failing-first E2E with measured before/after
values) → the 5 gates → 12-seat panel + DevEx on the final tip → PR.
NO MERGE (owner's per-PR word only).

Capsule fields: Tier 2 (multi-file feature behaviour on the challenge
surface; council manifest lineage from the challenge packages).
Ownership: coordinator + delegated workers, this workspace only.
Verification contract: the 5 AGENTS.md gates + the framing spec and
named neighbour suites, sequentially under the E2E flock. Budget:
parent cap for a Tier-2 run; consumption was dominated by coordinator
re-runs after two delegated E2E reports proved unsupported by their
own logs (see the environment note in the PR body) — no meter exists
in this repo, so no exact figure is claimed.

## Diagnosis (code-proven; measured reproduction in the PR body)

Defect 1: `challengeRunFields` (src/game/challenge.ts) sets the run's
regionName to the DISPLAY string "<Region> challenge". PlayLoaded
passes run.regionName to SatelliteMap as `regionName`; satellite-map
resolves geometry BY NAME (`lookupRegion`) — "<Region> challenge" is
not an atlas name, so it falls back to a DTO with an EMPTY polygon and
`paintRegionHighlight` paints nothing. Bounds framing resolves via
run.challengeRegionId and is unaffected in code — measured in repro.
Scout uses the same map component + painter, so one seam fixes both;
Scout's absent admin-1 BAND is a separate, owner-accepted trade and is
not touched.

Defect 2: PlayLoaded's MapModeToggle calls GameApp.handleManualMapMode,
which writes the manual record, deletes sessionStorage RUN_KEY, nulls
the run, and forces home. Inside an mc2 challenge that (a) kills the
live challenge and (b) deletes the player's preserved NORMAL run under
RUN_KEY. The welcome card offered no map display or choice, so the
lethal toggle was the receiver's only switch.

Fix: (1) PlayLoaded resolves the map's region name from the route's
real region for challenge runs. (2) MapModeToggle gains a "challenge"
context: reason copy, no switch. (3) handleManualMapMode refuses to
run while a challenge run is active (choke point). (4) The welcome
card shows the resolved map (stored manual record > capability
auto-select — the existing boot qualification, no new probe) and lets
the player flip it before Start; the flip only STAGES the pick and
Start commits it as a manual record (cure round 1 — declining the
card commits nothing; see the panel record below).

## Status

- [x] Diagnosis (code) — both defects
- [x] Reproduction spec written (failing-first) + BEFORE values captured
  (coordinator-verified runs against pre-fix main `4597669`, bundled
  Chromium, 1440×900): challenge Nebraska full — announcement
  "Nebraska challenge view", settle zoom 7, gold 131 px (noise floor —
  no outline); challenge Nebraska Scout — same announcement, gold 131;
  challenge UK full — "United Kingdom challenge view", zoom 4, gold
  122. Controls: Play Nebraska full/Scout gold 13,152 / 13,150 with the
  real "<Region> view" announcement. Zoom identical before/after —
  framing survived; the border (and the view name) was the loss.
- [x] Fix implemented (game-app.tsx, map-mode-toggle.tsx, scout-copy.ts)
- [x] AFTER values captured (same reproduction, fixed build): challenge
  Nebraska full "Nebraska view" z7 gold 12,969 (Play 12,974); Scout
  gold 13,051 at rest (Play 13,151; an earlier run's 38,182 was a
  flash-phase catch, superseded by the cure-run resting values); UK
  "United Kingdom view" z4 gold 14,348
- [x] All 5 gates + neighbouring specs — tsc exit 0, npm test exit 0,
  test:worker PASS, lint-cards GATE PASSED, build:pages PASS; framing
  spec 11/11; neighbours: mc2-receive 5/5, boot+isolation+frozen-mc1
  18/18, scout suites 17/17 (all coordinator-run)
- [x] Docs updated (feature-flags.md, scout-offer-policy.md)
- [x] Panel (12 + DevEx) on tip ad9c11a: NOT READY — 4 BLOCKs on two
  findings: (F1) welcome switch hit area ~24px tall, below the 44px
  floor (Frontend, Accessibility); (F2) the welcome flip wrote a
  permanent manual record immediately, breaking the card's
  "declining commits nothing" contract and understating the pick's
  permanence (Code Reviewer, UX Researcher; Game Designer + Security
  concurring). 8 AWN / 1 APPROVE otherwise.
- [x] Cure round 1 (this record's commit): F1 — switch hit area is
  now min 44×44px with an explicit focus ring. F2 — the flip only
  STAGES the pick (new welcomeMapPick state); Start commits it via
  handleWelcomeMapMode beside C6's displacement commit; "Not now"
  drops it unwritten; the card note and docs now state the pick
  becomes the saved manual choice (manual records never decay).
  Spec: staged-commit assertions + a flip-then-decline test + a
  same-test play-context control for the toggle test. Evidence logs
  retained in ~/workspace/meridian-challenge-framing-evidence/.
- [x] Panel re-vote on cure-1 tip 6db1ad9: 12/13 approve-family; the
  Accessibility seat escalated its focus-ring point to a BLOCK (gold
  ring ~1.65:1 on the LIGHT card surface).
- [x] Cure round 2 (2276bdd): focus ring uses the fg token — ~14:1+
  against the card surface in both schemes; one class, nothing else.
  Targeted confirmation votes (Accessibility + Frontend) on the delta.
- [x] PR #288 open — NO MERGE (owner's per-PR word only). Panel
  re-vote on the cured tip: READY 13/13 (record in the PR body).
- [x] Rebase + retest (2026-10-30, owner-authorized "Rebase + retest
  #288, then merge when green"): rebased onto main `24f4d2a` (#286
  merged first, per the queue). New tip `0eda40c`; voted code tip
  `2276bdd` is now `ef946b7`. The ONLY conflict was this file —
  resolved keeping all four records (this record first, then main's
  carried records verbatim below). game-app.tsx auto-merged.
  CLEAN-rebase proof: range-diff — commits 2–5 identical (`=`),
  commit 1 differs only in this file; the tree diff old-tip→new-tip
  outside this file carries a change-line multiset IDENTICAL to
  #286's own squash diff (1,127 lines) — both behaviours coexist,
  nothing of either PR dropped. Per the #286 Senior Architect
  precedent, a clean records-only rebase needs no panel re-vote.
  Gates on `0eda40c`: tsc 0 · npm test exit 0 (src 1832/1832) ·
  test:worker exit 0 · lint-cards GATE PASSED · build:pages exit 0.
  E2E (flock, --workers=1, bundled chromium-1243): framing spec
  12/12 · card-redesign 11/11 · mc2-review 2/3 · review-card-actions
  5/6 · mobile-home-overlap 2/26. CONTROL RUN on unmodified main
  `24f4d2a` (detached worktree, same env): mobile-home-overlap
  0/26, danger test FAILED (30s visibility, earlier than the
  branch's 240s helper timeout), mc2-review privacy FAILED (30s
  visibility) — every local failure reproduces on main: this VM's
  E2E environment, not the rebase. CI on this tip is the canonical
  full-suite read. Logs:
  ~/workspace/meridian-challenge-framing-evidence/.

Coordination: see ~/workspace/orchestrate/meridian/COORDINATION.md —
this branch is adjacent to PR #286 (Review card) in game-app.tsx;
whichever PR rebases second retests. (Done: this branch rebased
second, 2026-10-30.)

---

<!-- Records carried on origin/main (24f4d2a) kept verbatim below, per the coordination ledger: both operations' records are kept, never overwritten. -->

# BRANCH_STATUS — feat/review-card-action-model

- **Branch:** `feat/review-card-action-model`
- **Base:** `origin/main` at `4597669` (rebased 2026-10-29 after PR #284 merged; this file resolved keeping both operations' records, per the coordination ledger).
- **State:** **READY (cure round) — panel re-vote on the owner-approved cure tip `b4c2f13` is 7 APPROVE, 4 APPROVE-WITH-NITS, 1 BLOCK (Reality Checker — record-evidence only, cured in the PR record and CONFIRMED LIFTED by a fresh confirmation seat, all three items verified), DevEx PASS-WITH-NITS; Senior Developer's round-1 dark-leg BLOCK is WITHDRAWN (Item 2 CURED). PR open; NO MERGE without the owner's per-PR word; Phase 3 is a later run.** Earlier: re-vote on `6b531f0` was READY (11 APPROVE, 1 APPROVE-WITH-NITS, DevEx PASS-WITH-NITS, 0 BLOCK) before the owner's redundancy steer ordered this cure round. Round 1 (tip `2426c27`): 10 APPROVE, 2 APPROVE-WITH-NITS, DevEx PASS-WITH-NITS, 1 BLOCK (UX Researcher: B1 anchoring — NOT reproduced, withdrawn on the seat's own re-measurement; B2 SR enumeration — contested, stands as a non-blocking nit with a future owner-approved remedy; B3 forced-colors primary — sustained and cured). The F2 consistency question referred by the manifest was ruled ACCEPT by the UX Researcher seat.
- **Governing manifest:** `.council/manifests/2026-10-29-review-card-action-model.md` (this branch, commit `a8f2354`).
- **Prior record:** this file previously carried Package C's branch record; Package C merged as PR #285 at `3aa16b5`, and its full record lives in that PR and in git history.
- **Task capsule:**
  - TASK / outcome: owner report 2026-10-29 — the home Review card's action model is a mess: whole-card click target containing three look-alike text actions (Start review / Challenge a friend / Start over) with wildly different consequences. Redesign per the signed manifest: the card leaves Form S; three explicit controls (filled primary pill → outline Challenge pill → fixed-red danger footer); the REVIEW → cue is removed.
  - Tier: 2 (owner-orchestrated squads + Tier-2 council; manifest signed before code). Process: deslop (zero-behaviour) → RED tests → build → 5 gates → rebase → retest → Finish-Gate verify vs manifest → full pipeline panel (12 seats + DevEx) on the final tip → PR. STOP at PR.
  - Interpretations recorded (narrow/safe): (1) "Start over" stays on the card — relocation to "For grown-ups" is blocked in this run by the Finish-Gate veto, the PR #281 D10 ruling, and the locked opener copy; it is an open owner question in the manifest §8. (2) Danger colour is the fixed hex `#b3372a` (theme-invariant), not `var(--atlas-stamp)` — Councilor C F2: the token's night value fails the 4.5:1 floor on the parchment card. (3) The containment contract is hit-testing (`elementFromPoint`), not geometry (C F4).
  - Files in scope: `src/components/game-app.tsx` (Review branch of `Choose` only), `src/components/home-v5.css` (Review-scoped rules; deslop commit zero-behaviour), `tests/e2e/review-card-actions.desktop.spec.ts` (new), `tests/e2e/card-redesign.desktop.spec.ts` (re-spec), `tests/e2e/mobile-home-overlap.spec.ts` (re-spec), `README.md`, handbook, this file.
  - Protected (untouched): `src/game/**` incl. `RESET_HISTORY_COPY` and the reset store logic, `src/game/data/**`, `package-lock.json`, shared `.hv5-stretch` rules for sibling cards, ReviewComplete's Start-over opener (stays brown — leakage check), tour anchors, `.hv5-art` geometry.
  - Done condition: manifest §6 contracts green (hit-test probe, focus order = stack order, exact danger colour in both themes, ordered-identity state matrix, divider ownership); all 5 gates green; Finish-Gate A1–F6 evidence matrix complete; panel approves the final tip; PR open. Known follow-up (out of footprint, named in the PR body): reset confirm-success path returns no focus when the deck empties (C F8b, pre-existing).
  - E2E environment: Playwright's bundled chromium-1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — /opt/meta-chromium refuses headless launch on this VM.
- **Stage log:**
  - [x] Stage 0 — clone @ `3aa16b5`, branch created, npm ci (391 pkgs), constitution + council protocol + surfaces read and verified at source.
  - [x] Stage 1 — Phase 1 office hours: 3 squads (18/19 seats exact persona files; Master Plan Architect = disclosed `master_orchestrator.toml` nearest-match), 2 cross-squad pairs, Accessibility Auditor + Finish-Gate vetoes exercised; Tier-2 council (A: 12 Gherkin scenarios, model satisfies all; B: TDD contracts; C: CHALLENGE, 9 findings — F2/F4/F5/F7/F8 sustained as amendments, F1/F3 carried verbatim); Chair-signed manifest committed first (`a8f2354`). Perf baseline: CSS gz 9,153 B / JS gz 142,312 B (budgets restated per C F8c: JS Δ ≤ +1 KB gz, CSS Δ ≤ +1 KB gz).
  - [x] Stage 2 — Deslop commit `467e59b` (zero-behaviour: 2 stale comments + stranded focus-rule regroup; diff-audited).
  - [x] Stage 3 — RED tests committed `077a611` (all predicted signatures observed on the pre-fix build); build `74faefe` + walk cure `9dd1ed7`. Gates: tsc clean · scripts 850/850 · src 1816/1816 · worker 85/85 · lint-cards GATE PASSED · build:pages green · new spec 5/5 green. Perf (like-for-like vs a same-env main build): CSS +27 B gz, JS +19 B gz — within budget. Tab-walk flake diagnosed + cured in the test (see manifest errata).
  - [x] Stage 4 — Rebase check: origin/main still `3aa16b5` at every fetch (the external End-game PR has not landed) — no rebase needed. Retest after the cure: contract + card-redesign 16/16. Finish-Gate verify: 18-shot evidence matrix in `~/workspace/meridian-card-fix/evidence/` + coordinator eyeball PASS (hierarchy, outline-as-state, ring-hugs-control, forced-colors structure).
  - [x] Stage 5 — Panel round 1 on `2426c27`: NOT READY (1 BLOCK, UX Researcher). Cure `6b531f0` (forced-colors border; comment precision ×3 seats; anchoring assertion). Re-vote on `6b531f0`: **READY — 11 APPROVE, 1 APPROVE-WITH-NITS, DevEx PASS-WITH-NITS, 0 BLOCK.** Follow-ups recorded in the PR body: reset confirm-success focus return (pre-existing, manifest F8b); B2 naming pass (future, owner-approved); "1 cards due" grammar (pre-existing deck copy); caught-up/flag-off y-order assertion.
  - [x] Stage 6 — PR opened. NO MERGE. Phase 3 (CSO sweep, benchmark, document-generate, autoplan) is a later run after the owner's word.
  - [x] Stage 7 — Owner redundancy steer + cure round (2026-10-29, owner-approved "one cure round, then re-vote"): branch rebased onto main `4597669` (conflict only in this file; both records kept). Cure `b4c2f13`: (1) the Review card's challenge entry REMOVED (both deck branches + `.review-challenge-open` rules + all test/doc claims; ReviewComplete entry kept per this run's record disposition — basis stated in the PR body); manifest addendum items 4–6. (2) The danger test's dark leg made TRUE (emulates `colorScheme: "dark"` before its first read) — mutation proof: colour reverted to `var(--atlas-stamp)` → fails at the dark assertion with `rgb(232, 106, 92)`; restored → colour legs pass (full local completion stays CI-canonical: the VM's shared-helper wedge, same signature as pre-cure). B3 forced-colors automated lock added in the same spec (green). Gates on `b4c2f13`: tsc 0 · npm test exit 0 (scripts 850 pass, src 1832/1832) · worker 85/85 · lint-cards GATE PASSED · build:pages 0 · E2E per-file green for all changed surfaces (figures from run logs; two garbled batch deliveries discarded and re-run per file). Perf like-for-like vs main `4597669` (same-env back-to-back builds): JS −81 raw / −24 gz, CSS −170 raw / −12 gz.
  - [x] Stage 8 — Panel re-vote on `b4c2f13` (12 seats + DevEx, personas verbatim): 7 APPROVE · 4 APPROVE-WITH-NITS · 1 BLOCK (Reality Checker, record-evidence only — cured in the PR record: perf measured with named baseline, restored mutation leg re-captured in full, E2E restated per file; seat confirmation requested) · DevEx PASS-WITH-NITS. Senior Developer: Item 2 CURED, round-1 BLOCK withdrawn. This record commit (+ one stale CSS comment in the cure's footprint file, zero behaviour) follows the vote per the established pattern. NO MERGE — the owner's per-PR word is still required; the PR is now FIRST in the merge queue (#284 merged).

---

<!-- Record from origin/main (4597669 — PR #284 merged) kept below, per the coordination ledger: both operations' records are kept, never overwritten. -->

# BRANCH_STATUS — fix/220-contact-wiring

- **Branch:** `fix/220-contact-wiring`
- **Base:** `origin/main` at `6abe3e6` (Package B, PR #283, merged).
- **Prior record:** this file previously carried the Package B branch
  record; that work merged as PR #283 and its full record lives in that
  PR and in git history.
- **State:** **READY FOR PANEL** (2026-10-29, findings round 2 — F2-F5
  fixed on `bba11f9` plus this record; see "Findings round 2"). Earlier:
  blockers round. All build units landed and pushed; Option 1a pushed as `6b3c17c` on the
  owner's words (Veeresh, 2026-10-29, chat): "Yes, push 6b3c17c to
  fix/220-contact-wiring. Do not merge." The contact E2E, once
  lock-blocked, has since run green (builder-run and CI; see Option 1a
  evidence and the blockers-round record). Not merged. Issue #220: wire the
  Contact Us form's delivery (root `wrangler.jsonc` bindings) and make
  the page honest about delivery — SPEC §3 + §4 of
  `~/workspace/meridian-contact-activation/SPEC.md`. Animations are a
  separate follow-on PR and are NOT in this branch.
- **Option 1a (2026-10-29):** built on `scratch/220-option1a` (PR head
  `911fc95` + `origin/main` `3aa16b5`, merge `cb56b4a`). Builder-run
  record below; Councilor C issued a records-only CHALLENGE (F1-F4),
  corrected in this record. Pushed as `6b3c17c` (see State); not
  merged.

## Findings round 2 — review findings F2-F5 (2026-10-29, evening)

Source: the independent review of head `c05ed57` (reviewer evidence in
the reviewer workspace `/workspace/verify284/`, e.g.
`scrub-expansion.log`, `red-ui-summary.log`). The assignment to fix
these findings on this branch came through the orchestrating agent; no
separate owner quote for it is claimed here. Owner words available
this round (Veeresh, 2026-10-29, CT): "Build 1a: Option 1 plus the
linear email regex. I approve the Chair-lift for the regex edit."; "A";
"Yes, push 6b3c17c to fix/220-contact-wiring. Do not merge."; "fix
blocker"; "Verify". At about 8:12 PM CT the owner showed the Cloudflare
dashboard for the `meridian` Worker with a Production runtime secret
whose name reads "CONTACT_DISCORD…" (name truncated in the UI, value
encrypted). That is recorded as the owner's evidence that the
production contact secret exists; the exact name is to be confirmed by
the post-deploy probe (SPEC §3.4), not assumed.

Consensus Manifest (Tier 2 surface: privacy logic in the contact
handler). Recorded and committed BEFORE any source edit this round.
Builder-drafted; there is no separate Chair or Councilor C signature —
disclosed for the panel, which is the checker on the final tip.

```text
TASK / requested outcome:
  F2  No uncited owner attribution in this PR's diff: source comments
      describe the design neutrally or cite a verifiable record; this
      file's wrong file reference is fixed; the deploy-sequencing text
      reflects the owner's dashboard evidence (secret exists).
  F3  A message the page accepts (<= 1000 chars after trim) is never
      rejected by the server because scrubbing made it longer: the
      length limit applies to the raw (control-stripped, trimmed) text;
      the scrubbed text still fits Discord's 2000-char content limit.
  F4  The linear-time regression test cannot flake on a loaded runner
      and still fails with the old unanchored (quadratic) regex.
  F5  The E2E honesty check (Part 4b) asserts "no thank-you" only after
      the not-delivered response has arrived and rendered.
Interpretations considered and selected reading:
  F2: the privacy.tsx "path B, adopted by the owner 2026-10-21" line is
      CITED (owner's words "Adopt B — start the cure round" are quoted in
      docs/reviews/2026-10-21-p0-p2-remediation.md, decision 4); keep it
      and add the pointer. "owner's precedence / owner's route
      (2026-10-21)" in contact-handler.server.ts (2x), its test file
      (1x) and wrangler.jsonc (1x) are UNCITED: reword to cite issue
      #220 Step 3 (plan text) instead. Lines that only mention the owner
      as an actor (e.g. "the owner switches /api/contact on") make no
      attribution claim and are left alone; lines already on main
      (rate-limiter "owner rule: free options only", retention.ts) are
      outside this diff and out of scope.
  F3: check length on the raw text, scrub only a valid-length message;
      the Discord sink already cuts the fenced message to fit 2000
      chars (DiscordWebhookSink.format), so no new cap is added there —
      a unit test pins it for a worst-case placeholder-dense message.
      Rejected: raising the server limit (client/server would drift);
      shorter placeholders (copy change, not needed).
  F4: time stripContactDetails (where the regex runs) on 32,000-char
      inputs, take the MIN of 3 runs (load only adds time), bound
      100 ms. Measured (Node 22, f4-probe.log): new regex <0.1 ms at
      16k; old regex ~230-250 ms at 16k, ~4x per doubling, so ~1 s at
      32k. Rejected: ratio test across sizes (sub-ms timings, noisy).
      Note: after F3, validateContact no longer scrubs over-length
      text, so timing validateContact on 4000-char input would stop
      measuring the regex at all — hence the direct call.
  F5: start page.waitForResponse before the click, await it, wait for
      the not-delivered node, then a non-retrying count of the
      thank-you == 0.
Tier and rationale:
  Tier 2 (security/privacy surface: the PII scrub). Records/comments
  parts are Tier 0. Constitution rule 3: edits stay in validateContact
  (F3), the two readContact* doc comments, one wrangler.jsonc comment,
  the privacy.tsx header comment, and the named tests.
Done condition / evidence (predicted RED signatures):
  F3 RED: new unit test fails with problems
      ["message must be ≤ 1000 characters"] for a 999-char message
      ending " me@ex.io"; GREEN after.
  F4 RED: with EMAIL_IN_TEXT temporarily set back to the old regex, the
      new test fails with a min time ≥ 100 ms on the '@'-free shapes;
      GREEN with the shipped regex.
  F5 RED: with the honesty gate reverted in contact.tsx (thank-you on
      any 200), the spec fails at the new "no thank-you after the
      response" assertion (not later at the not-delivered check).
  All AGENTS.md gates; logs in /workspace/v220/gates-findings2/.
Files in scope:
  src/lib/contact/contact-handler.server.ts (validateContact; 2 doc
  comments), src/lib/contact/contact-handler.server.test.ts,
  wrangler.jsonc (1 comment), src/routes/privacy.tsx (header comment),
  tests/e2e/grownups-privacy-contact.desktop.spec.ts (Part 4b),
  BRANCH_STATUS.md, PR #284 body. Out of scope: the 42px submit button
  (pre-existing on main), the validation alert in contact.tsx, the
  honeypot message, the Workers Builds dashboard failure, workers/,
  package-lock.json, src/game/data/**.
Approvals: commit + fast-forward push to fix/220-contact-wiring and the
  PR #284 body edit (authorized for this round via the orchestrator).
  No merge, no deploy, no force-push. Checker: the review panel on the
  final tip (not the builder).
```

### Findings round 2 — results (builder-run, 2026-10-29; checker: the panel)

Code commit `bba11f9`; this record is committed on top. Logs:
`/workspace/v220/gates-findings2/`.

- F2: `contact-handler.server.ts` readContactEnv / readContactRuntimeEnv
  doc comments and the `wrangler.jsonc` env-route comment now cite
  "issue #220 Step 3, plan text" instead of "owner's precedence / owner's
  route (2026-10-21)"; the test comment likewise. `privacy.tsx` keeps
  "adopted by the owner 2026-10-21" with a pointer to the doc that quotes
  him (docs/reviews/2026-10-21-p0-p2-remediation.md, decision 4). Grep of
  the PR diff vs main for "owner": the remaining hits are actor mentions
  (README "reach the owner") and the cited privacy.tsx line. Erratum on
  the wrong file reference and the secret text: see above.
- F3: validateContact checks the 1000-char limit on the typed
  (control-stripped, trimmed) text, then scrubs. RED (old order,
  `f3-red.log`): a 999-char message ending " me@ex.io" rejected with
  "message must be ≤ 1000 characters", as predicted. GREEN
  (`f3-green.log`): 2/2; worst-case placeholder-dense message + 252-char
  replyTo formats to ≤ 2000 chars with fences intact.
- F4: the timing test calls stripContactDetails on 7 shapes of 32,000
  chars, min of 3 runs < 100 ms. GREEN (`f4-green.log`) ~8 ms for the
  whole test. RED with the old regex (`f4-red.log`): "'a' run: min
  941.2 ms ≥ 100 ms at 32000 chars".
- F5: Part 4b now awaits the POST /api/contact response and the
  not-delivered OR thank-you node before a non-retrying count of the
  thank-you. RED (honesty gate reverted in contact.tsx, variant C;
  `f5-red.log`, mutation in `f5-red-mutation.diff`): 1 failed at
  "no thank-you after a stored:false response — Expected: 0, Received:
  1" (spec line 282), as predicted; contact.tsx restored (git clean).

| Gate (`/workspace/v220/gates-findings2/`, on `bba11f9`) | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npm test` | exit 0 — scripts 861: 850 pass / 0 fail / 11 skipped; src 1832/1832 |
| `npm run test:worker` | exit 0 — 85/85 |
| `node scripts/lint-cards.mjs` | GATE PASSED |
| `npm run build` | exit 0 |
| `npm run build:pages` | exit 0 |
| E2E, 4 CI specs, `--workers=1`, under flock | 11 passed |

## Blockers round — aria-live + owner citations + PR body (2026-10-29)

Owner instruction (Veeresh, 2026-10-29 4:20 PM CT, chat message to the
agent), verbatim: "fix blocker". The blockers it refers to are the two
items the Option 1 council listed as OUT of scope for the limiter move
(aria-live, owner-citation gap) plus the stale PR #284 body. This
capsule was recorded before any source edit in this round.

```text
TASK / requested outcome:
  (1) The contact form's submit result (thank-you / not-delivered /
      rate-limited / error) is announced to screen readers reliably,
      once per result. (2) Every "owner decided/ruled/approved" line in
      this branch's record and the PR #284 body carries a citation to
      the owner's own words, or is downgraded. (3) The PR #284 body
      matches verified state at the new head.
Interpretations considered and selected reading:
  aria-live gap = src/routes/contact.tsx ContactForm: the thank-you
  (role="status") and the result alert (role="alert") are mounted in
  the same render as their text, so no live region exists before the
  update (a polite status inserted together with its content is not
  reliably announced), and a repeated identical result (e.g. two
  not-delivered sends) leaves the same node and text in place, so
  nothing is re-announced while the stale result also stays visible
  during the next send. Selected fix: keep both regions mounted from
  the form's first render, empty until a result arrives; clear the
  result when a new send starts; no nested live roles (no double
  announcement). No copy changes, no new text.
  Rejected: one combined region (moves the thank-you's visual
  position); a visually hidden duplicate region (duplicate text in
  browse mode).
Tier and rationale:
  Tier 1 for the aria-live fix (one bug, one function — ContactForm —
  clear repro, no security/privacy logic touched, no handler change).
  Tier 0 for records (BRANCH_STATUS.md, PR body). A stricter reading
  of "unsure -> Tier 2" (the page is a privacy surface) is disclosed
  for the panel.
Done condition / evidence:
  E2E (grownups-privacy-contact.desktop.spec.ts) asserts: before any
  send, a role=status region and a role=alert region exist and are
  empty; after a delivered send the thank-you is inside the status
  region; the not-delivered and 429 messages are inside the alert
  region; neither message node carries its own live role. RED on the
  unmodified page first, GREEN after. All AGENTS.md gates.
Files in scope:
  src/routes/contact.tsx (ContactForm only),
  tests/e2e/grownups-privacy-contact.desktop.spec.ts, BRANCH_STATUS.md,
  PR #284 body. Out of scope: the handler, contact-form.ts, copy text,
  source-code comments that mention the owner (listed below as open),
  workers/, wrangler.jsonc, package-lock.json, src/game/data/**.
Approvals: push to fix/220-contact-wiring (standing authorization,
  AGENTS.md Working conventions) and the PR body edit. No merge, no
  deploy. Checker: the review panel on the final tip (not the builder).
```

Blockers-round record (builder-run; not self-certified; checker = panel):

- **aria-live** (`src/routes/contact.tsx`, ContactForm only): both
  result regions (`role="status"`, `role="alert"`) are now always in
  the DOM and empty until a result; the thank-you and the error text
  render inside them and carry no role of their own; the old result is
  cleared when a new send starts. Copy unchanged. `empty:-mt-5` /
  `empty:-mt-4` cancel the column gap while a region is empty.
- **E2E** (`grownups-privacy-contact.desktop.spec.ts`, full-stack test):
  regions present and empty before any send; thank-you inside the
  status region; not-delivered and 429 texts inside the alert region;
  no inner role; a repeated identical not-delivered result (Part 4b ->
  3b) is a new DOM node (old node disconnected).
- RED on the unmodified page: 1 failed (`contact-status-region` not
  found). RED probe with only the clear-on-send removed: 1 failed
  (`isConnected` true, expected false). GREEN: 5/5 in the spec.
- Owner-citation gap: uncited "owner ruling / dispatch / owner-approved
  SPEC / owner's instruction" lines downgraded with errata (Task
  capsule, Verification record, Notes); the 3:18 PM reconfirmation now
  quotes the owner's actual reply "A". Source-code comments that still
  say "owner's precedence (2026-10-21)" (contact-handler.server.ts) and
  "owner's route, 2026-10-21" (privacy.tsx) were NOT edited (source
  comments, outside this round's file scope) — open for the panel.
  [ERRATUM, findings round 2: the "owner's route, 2026-10-21" comment was
  in `wrangler.jsonc`, not `privacy.tsx`. Both it and the two handler
  comments are now reworded to cite issue #220 Step 3 (plan text); see
  "Findings round 2".]

| Gate (`/workspace/v220/gates-blockers/`) | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | exit 0 — scripts 861: 850 pass / 0 fail / 11 skipped; src 1830/1830 |
| `npm run test:worker` | exit 0 — 85/85 |
| `node scripts/lint-cards.mjs` | GATE PASSED |
| `npm run build:pages` | exit 0 |
| `npm run build` | exit 0 |
| E2E 4 CI specs, `--workers=1`, under `flock ~/workspace/.e2e.lock` | exit 0 — 11 passed (29.2s) |

## Option 1a — limiter last + linear email regex (2026-10-29)

Owner decision, verbatim (Veeresh, 2026-10-29 2:46 PM CT): "Build 1a:
Option 1 plus the linear email regex. I approve the Chair-lift for the
regex edit."

Owner reconfirmation (Veeresh, 2026-10-29, about 3:18 PM CT), the
owner's words verbatim: "A". It was given after being told the regex
slowdown trigger is verified in Node 22 only (production Cloudflare
impact not reproduced), and it selected option A as the agent worded
it: keep the regex edit as defense-in-depth and reconfirm the
Chair-lift knowing the slowdown was verified in Node 22 only. That
option wording is the agent's, not the owner's. Erratum (blockers
round): an earlier version of this record quoted the option text as
the owner's verbatim words; corrected. Open question on lift validity
(AGENTS.md:169: "If the trigger is not verified in the manifest, the
lift is void: stop and ask the owner"): resolved by the owner's "A".

Disclosure (what this PR did before 1a): to put the honeypot silent-200
ahead of the origin gate, the PR also moved the origin gate behind the
rate limiter. On `6abe3e6` the order was origin (403) → body cap (413)
→ limiter (429) → parse (400) → validate (400) → honeypot (silent 200)
→ sink, so the origin gate ran before the limiter. On PR head `911fc95`
it was body cap (413) → JSON parse attempt → limiter (429) → honeypot
(silent 200) → origin (403) → parse-error/validation (400) → honeypot
backstop → sink. So junk with a bad or missing `Origin` spent a
sender's quota and the shared binding budget, and a sender over quota
got a 429 instead of the honeypot's silent 200. Option 1a resolves it.

What changed:

- **Order** (`handleContactRequest`, line numbers in
  `contact-handler.server.ts` as of this record's commit; at `435fc1d`
  the limiter and sink lines are 2 lower): method check (OPTIONS/405,
  423-436) → 4 KB body cap (413, 438-441) → JSON.parse attempt (450)
  → honeypot (silent 200, 458-461) → origin gate (403, 465-466) →
  parse-error (400, 468) → validation (400, 469-471) → honeypot
  backstop (silent 200, 472-478) → **rate limiter (429, 488-494)** →
  sink (495). Because the cap runs first, a
  filled-honeypot body over 4 KB gets 413, not the silent 200. The
  limiter moved from right after the JSON parse attempt to right
  before `selectSink(env)`. IP privacy (salted/daily-hashed keys), the 4 KB
  body cap, origin enforcement, honeypot silence and binding fail-open
  are unchanged.
- **Regex** (`EMAIL_IN_TEXT`): `/(?<![^\s@<>()",;:])[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}/g`.
  The old unanchored form (added by this PR in `5c4e6c2`, not on main)
  is quadratic on long runs with no `@` in Node 22 (~15 ms for 4000
  chars, ~230 ms for 16000; ~4x per doubling). In local workerd
  1.20261012 it ran far under 0.1 ms per call for every tested shape,
  so production Cloudflare impact is NOT reproduced (not disproven:
  no deployed measurement). Option 1 puts that work ahead of the
  limiter; the edit is kept as defense-in-depth because the new regex
  is output-identical and linear in both runtimes. The lookbehind only lets a match start
  at the start of a run of address characters, where a leftmost match
  always starts, so the matches are the same. Chair-lift scope: this
  constant and its doc comment only (Constitution rule 3, and rule 1 to
  the extent it applies). Manifest: builder-drafted, approved by the
  owner's explicit words above; there is no separate Chair signature
  beyond that approval, reconfirmed by the owner's reply "A" on
  2026-10-29, about 3:18 PM CT (see above).
- **Counting:** only a message that would be delivered spends quota
  (in-memory 3 per sender per 10 min + 60/h global; bindings 3/60 s per
  sender, 10/60 s global). Honeypot, wrong/missing Origin, malformed
  JSON and invalid payloads count zero. E2E: Parts 3, 4b and 3b' are
  the 3 counted messages; the honeypot (3b) is not counted; the 5th
  request (3c) is the 429.
- **Docs:** `docs/contact-rate-limiting.md` says where the limiter
  runs; its "Owner deploy step" was stale (the bindings are already in
  root `wrangler.jsonc`, `c09cec4`) and is now "Deploy config".

Evidence (builder-run; not self-certified):

| Check | Result |
|---|---|
| RED, before code change | 5 fail as predicted: junk spends quota (429 not 403); 3 invalid then valid (429 not 200); honeypot over quota (429 not 200); binding calls on junk (3 not 0); `'a'x4000` median 15.20 ms ≥ 2 ms |
| Equivalence vs old regex | 200k fixed-seed corpus in unit suite: 0 diffs. Scratch fuzz 2M cases (155,555 with a match): 0 diffs. Mutating the lookbehind makes both equivalence tests fail. Councilor C, independently: 0 diffs over 9,407,955 strings (`cc1a/equiv.txt`). |
| validateContact, 4000 chars, no `@` (Node 22) | 14.968 ms → 0.025 ms (median; `perf1a-before.txt`, `perf1a-after.txt`) |
| Old vs new regex in local workerd 1.20261012 (Councilor C) | old ≪ 0.1 ms per call for every tested shape; new likewise (`cc1a/workerd-abs.txt`, `cc1a/workerd-shapes.txt`) |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | exit 0 — scripts 861 tests: 852 pass / 0 fail / 9 skipped; src 1830/1830 pass |
| `npm run test:worker` | exit 0 — 85/85 pass |
| `node scripts/lint-cards.mjs` | exit 0 — GATE PASSED |
| `npm run build:pages` | exit 0 |
| `npm run build` | exit 0 (db:migrate skipped: DATABASE_URL not set). Built SSR bundle carries the lookbehind regex unchanged. |
| E2E: credits, grownups-privacy-contact, hydration-boot, observability (`--workers=1`, under `flock ~/workspace/.e2e.lock`) | exit 0 — 11 passed (30.3s) |

Gates ran on `435fc1d`; re-run green on `a118a49`
(`/workspace/v220/gates1a-r2/`): tsc exit 0; npm test scripts 852 pass
/ 0 fail / 9 skipped, src 1830/1830; test:worker 85/85; lint-cards
GATE PASSED; build:pages and build exit 0; E2E 4 CI specs 11 passed
(30.6s). The quadratic cost was measured in Node 22
only. Councilor C's local workerd 1.20261012 run did not reproduce it,
and no deployed Cloudflare CPU-time measurement was made, so this
record makes no claim that production exceeds any Cloudflare CPU
limit. The Chair-lift is kept as defense-in-depth (evidence above).
Records corrected 2026-10-29 after Councilor C's records-only
CHALLENGE (F1-F4): records only. No code logic or test changed; the
only source edit is one clarified comment above the limiter block.

## Task capsule

```text
TASK / requested outcome:
  Implement SPEC §3 (wiring) + §4 (honesty states). When this branch is
  done it is green (typecheck + unit suite + build + contact E2E) and
  pushed, ready for the review pipeline. No merge, no deploy.

Interpretations considered and selected reading:
  - Env route: the SPEC §3.1 "pick one" is read as: take the secret
    from the Worker runtime bindings (cloudflare:workers env /
    globalThis.__env__), with process.env ONLY as a local-dev fallback.
    nodejs_compat is NOT added. Source: issue #220 Step 3 (plan text,
    agent-written: "env read via Worker runtime bindings
    (`cloudflare:workers` env; `process.env` only as local-dev
    fallback)"). Erratum (blockers round): earlier versions called this
    "the owner's 2026-10-21 ruling". No owner words for such a ruling
    were found in this repo, issue #220, or the session, so that
    attribution is withdrawn: owner ruling NOT cited.
  - [SUPERSEDED 2026-10-29 by Option 1a, see above: the limiter now
    runs last, before the sink.]
    Handler order: the mandated move is honeypot silent-200 BEFORE the
    origin gate (SPEC §3.2, §10.1, §12 all pin exactly that). The
    existing anti-flood rate limiter keeps its position ahead of the
    honeypot check: SPEC §3.2's prose lists rate limits later in the
    pipeline, but the verdictable surfaces (§10.1 tests, §12 checklist)
    pin only honeypot-vs-origin, and moving the limiter would change
    the counted-request arithmetic the full-stack E2E verifies (the
    honeypot submission is a counted request today). Flagged here so
    the panel can challenge the reading with full information.
  - Thank-you copy: §5's new copy arrives with the animation PR. This
    PR keeps the existing thank-you wording and only gates WHEN it
    shows (stored:true), per the two-track plan (wiring+honesty first,
    animations second). Source: the build brief; owner words for it
    NOT cited (an earlier wording said "dispatch" as if owner-issued).

Tier and rationale:
  Tier 2 surface (security/privacy, 3+ files), built under SPEC.md as
  the design of record plus the env route above (issue #220 Step 3).
  Erratum (blockers round): earlier wording said "owner-approved SPEC"
  and "the owner's 2026-10-21 env-route ruling"; no owner words for
  either were found, so both are downgraded to NOT cited. Full review
  pipeline still gates the PR; merge only on the owner's word.

Done condition / scenarios / evidence:
  - Root wrangler.jsonc declares the CONTACT_DISCORD_WEBHOOK_URL secret
    (secrets.required, name only) + both ratelimits (72071 @ 3/60s,
    72072 @ 10/60s); comments describe the wired state.
  - Runtime env wins over process.env in readContactEnv /
    readContactRuntimeEnv; crash-secret isolation preserved.
  - Honeypot filled + bad/missing Origin -> silent 200; empty honeypot
    + bad origin -> 403.
  - Message text has emails + phone numbers stripped before delivery
    (kids' safeguard); replyTo is NOT stripped (it is the reply path).
  - Page: thank-you + draft clear ONLY on stored:true; stored:false
    shows the honest not-delivered state (existing not-configured copy)
    and preserves the draft verbatim.
  - Gates: npx tsc --noEmit, npm test, node scripts/lint-cards.mjs,
    npm run build + build:pages, contact E2E under the shared lock.

Files and interfaces in scope:
  wrangler.jsonc; src/lib/contact/contact-handler.server.ts (+ tests);
  src/lib/contact/contact-form.ts (+ tests); src/routes/contact.tsx;
  src/lib/contact/rate-limiter.server.ts (one stale comment line);
  src/routes/privacy.tsx (header comment only — body copy checked,
  see Notes); tests/e2e/grownups-privacy-contact.desktop.spec.ts
  (Part 4b honesty expectations); README.md (contact paragraph);
  BRANCH_STATUS.md.
  Out of scope: config/cloudflare/meridian.wrangler.toml (record only,
  no build reads it), workers/ (crash worker untouched), animations,
  flags.json, any secret value.

Verification contract (gates + isolation needs):
  AGENTS.md quality gates; E2E sequentially under flock
  ~/workspace/.e2e.lock against the built artifact.

Assumptions, risks, unknowns:
  - secrets.required is wrangler's config-level declaration of a secret
    binding by name (verified against wrangler 4.152.0's bundled
    config-schema.json). Whether a Builds deploy then preserves the
    dashboard-set value is exactly what SPEC §3.4 verifies post-merge;
    this PR cannot prove it from code.

Approvals needed (exact action + owner), checker, escalation:
  - SECRET (SPEC §3.3) — [UPDATED, findings round 2]: at about 8:12 PM
    CT on 2026-10-29 the owner showed the Cloudflare dashboard: the
    meridian Worker already has a Production runtime secret whose name
    reads "CONTACT_DISCORD…" (truncated in the UI, value encrypted). So
    no re-set is planned before deploy; the exact name (expected
    CONTACT_DISCORD_WEBHOOK_URL) is confirmed only by the post-deploy
    §3.4 verification (probe -> stored:true, message eyeballed in
    Discord, real-form submission, re-deploy probe). If the name
    differs, the owner re-sets it under the exact name.
    [ERRATUM: an earlier sentence here said "Until then the form
    correctly shows the honest not-delivered state". That was wrong:
    the form is already on in production (public/flags.json
    contactEndpoint), and until this PR merges and deploys, production
    runs main's code, which shows the old thank-you on any 200.]
  - Checker: the standing review panel on the final tip (not the
    builder).
```

## Status

- [x] Baseline: contact unit tests green on origin/main (43/43).
- [x] wrangler.jsonc — secret declaration + ratelimits + comments
      (`c09cec4`).
- [x] Handler — env precedence (runtime bindings first) (`5c4e6c2`).
- [x] Handler — honeypot before origin gate (`5c4e6c2`).
- [x] Handler — email/phone stripping in message text + tests
      (`5c4e6c2`, `b0a6c56`). NOT previously implemented — validateContact
      only stripped control chars; stripContactDetails is new.
- [x] Page — honesty states + draft preservation (+ sendOutcome helper)
      (`3c67e1b`).
- [x] E2E — Part 4b updated to the honesty contract; Part 3b's
      client-visible expectation updated with it (the honeypot 200 has
      no `stored` flag, so the client honestly treats it as
      not-delivered and keeps the text; the drop is proven server-side)
      (`c663be3`).
- [x] Docs — README contact paragraph; privacy header comment;
      rate-limiter comment line (`efe3edf`).
- [x] Gates — tsc / npm test / lint-cards / builds (numbers below).
- [x] Gates — contact E2E: was lock-blocked on the first tip (see
      Verification record, kept as history); since run green with the
      4 CI specs on `435fc1d`, `a118a49` and in the blockers round, and
      in CI (`e2e` check pass on `911fc95` and `6b3c17c`).
- [x] Pushed to origin (standing authorization; this branch only).

## Verification record (builder-run, 2026-10-29, on the final code tip)

| Check | Result |
|---|---|
| Baseline contact unit tests (origin/main, pre-change) | 43/43 pass |
| `npx tsc --noEmit` | PASS — clean, exit 0 |
| `npm test` (scripts suite) | 861 tests: 850 pass / 0 fail / 11 skipped |
| `npm test` (src suite) | 1821/1821 pass, 0 fail |
| Contact unit files (handler + form + rate-limiter + readiness) | 50/50 pass (43 baseline + 7 new/updated) |
| `node scripts/lint-cards.mjs` | GATE PASSED |
| `npm run build` (Worker build) | PASS — exit 0 |
| Emitted SSR `wrangler.json` (the deploy shape) | Verified: carries `secrets.required: ["CONTACT_DISCORD_WEBHOOK_URL"]`, both `ratelimits` (72071 @ 3/60, 72072 @ 10/60), `configPath` → root `wrangler.jsonc` |
| `npm run build:pages` | PASS — exit 0 |
| `npm run test:worker` | Not applicable — no `workers/` changes (AGENTS.md requires it only for PRs touching `workers/`) |
| Contact E2E (`tests/e2e/grownups-privacy-contact.desktop.spec.ts`) | [SUPERSEDED — since run green, see the checklist above.] At the time: **NOT RUN — lock-blocked.** The shared `~/workspace/.e2e.lock` was held continuously by the Package C crew's full-suite Playwright run (from `~/workspace/meridian-challenge-c/repo`, 41+ min elapsed at last check). Two attempts by this builder (an initial ~17 min queue, then a bounded `flock -w 600`) never acquired the lock. It was recorded, not waited out (an earlier wording said "per the owner's instruction"; owner words NOT cited, attribution withdrawn). |

## Notes for the panel

- The existing unit test "readContactEnv and readContactRuntimeEnv read
  from process.env and globalThis.__env__ (process.env wins)" pinned the
  OLD precedence. The env route (issue #220 Step 3; owner ruling NOT
  cited, see Task capsule) reverses it (runtime
  bindings first, process.env = local-dev fallback), so that test's
  expectations and title were updated to the new contract — a mandated
  behavior change, not a weakening: both sources are still exercised,
  and a new test asserts the bindings-route value is the one that wires
  the sink.
- Privacy page (§11 check): the BODY copy already describes the wired
  state ("Discord receives the message…", retention, server keeps
  nothing) and matches post-fix reality — no body change. Two flags:
  (1) its header comment still described delivery as PARKED/future
  tense — comment updated for consistency, body untouched; (2) the body
  says the server "hands on" the message without mentioning that emails
  and phone numbers typed into the message are stripped first — the
  stripping only removes data, so no promise is broken, but the owner
  may want a sentence about it in a later copy pass.
- security.txt (SPEC §9): this fix is what closes the dead-end; the
  file itself is unchanged, per spec.

---

<!-- Record from origin/main (3aa16b5) kept byte-identical below. -->

# BRANCH_STATUS — fix/wave1-p0 (Wave 1 P0, council audit)

- **Branch:** `feat/challenge-mc2-package-c`
- **Base:** `origin/main` at `6abe3e6` (Package B, PR #283, merged + live). If the external End-game PR lands first, this branch rebases and this file resolves keeping both records accurate.
- **State:** **READY — panel re-vote on the cured tip `c62378f` is 13/13 approve-family, 0 BLOCK. PR open; NO MERGE without the owner's per-PR word.** Package C of all-editions friend challenges: the (e) review-surface creation entry. Owner order 2026-10-29: "Build C".
- **Governing manifest:** `.council/manifests/2026-10-28-challenge-all-editions.md` (unchanged; the Package C note lives in `docs/feature-flags.md`, per the Package A/B convention).
- **Prior record:** this file previously carried Package B's branch record; Package B merged as PR #283 at `6abe3e6`, and its full record lives in that PR and in git history. Package A merged as PR #282 at `063de0c`.
- **Task capsule:**
  - TASK / outcome: manifest §1(e) — a deck-level "Challenge a friend — pick a map" entry on the review surfaces, opening the shipped challenge-region mini-picker, dealing a fresh five from the picked region; NEVER the deck's cards (manifest §1(e)/§3 privacy rule — the design council's Chair ruling was never-the-deck; a labelled "Beat my misses" opt-in was deferred to the owner as an open question, recommendation NO, and is still open).
  - Tier: 2 (new surface under a signed manifest; privacy-sensitive). Process: manifest already signed; TDD → gates → panel on the final tip → PR. No merge without the owner's per-PR word.
  - Interpretations recorded (narrow/safe, per the AGENTS.md ambiguity rule):
    1. "Review deck / review-complete" surfaces = the home Review card + the ReviewComplete screen — the same pair the 2026-10-28 reset manifest (D10/D16) treated as the deck's two surfaces, and the pair the BRAINSTORM §1(e) sketch names ("list row under the due-count + secondary button at review-complete"). Never per-card: nothing is added to the review run's aim/reveal phases (Package B's entries stay suppressed on review runs).
    2. Home-card visibility mirrors the reset control's D10 rule (deck total > 0 — due or caught-up states), in-flow in the text column under the due line, above the card's stretch CTA layer. ReviewComplete visibility is flag-only (the entry is not a deck operation; the deck may be empty there).
    3. Both entries reuse what already shipped: the home card reuses Choose's existing `onChallenge` handler (the mini-picker menu, card-tap sound included); ReviewComplete threads a new GameApp handler that exits the finished review exactly like Editions and opens the same menu, re-checking the flag at tap (Package B's click-atomic precedent) and degrading to the plain exit if the flag flipped off.
  - Files in scope: `src/components/game-app.tsx` (Choose card entry, ReviewComplete entry, Play/PlayLoaded prop threading, GameApp handler), `src/components/home-v5.css` (one opener class beside `.reset-history-open`), `src/game/challenge.ts` (the label constant), `src/game/challenge.test.ts` (label + privacy contract), `tests/e2e/friend-challenge-mc2-review.desktop.spec.ts` (new), `docs/feature-flags.md`, `README.md`, this file.
  - Protected (untouched): `src/game/data/**`, `package-lock.json`, the mc1 decoder path + mc1 test blocks, `tests/e2e/friend-challenge.desktop.spec.ts` (frozen), GeoDetective (`src/game/loop/**`) and Cold Trail (`src/game/coldtrail/**`).
  - Done condition: entry visible on both review surfaces with the flag on and absent with it off (E2E); the deal is proven as a SOURCE rule — dealt ids come from the picked region's catalog, never from the deck (cross-region E2E proof: Texas-seeded deck → Nebraska deal, ids ⊆ Nebraska catalog ∧ disjoint from the deck; unit construction pin). Per manifest §3 this prevents one-tap disclosure of the deck; a same-region fresh deal can coincidentally include a catalog place that is also in the deck — a catalog deal, not a deck disclosure. Preview + share path completes; all 5 gates green; panel approves the final tip.
  - E2E environment (Package B's recorded note): Playwright's bundled chromium-1243 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — /opt/meta-chromium refuses headless launch on this VM.
- **Stage log:**
  - [x] Stage 0 — clone @ `6abe3e6`, branch created, npm ci, manifest + AGENTS.md read, surfaces mapped.
  - [x] Stage 1 — TDD: label test RED with the predicted signature (`does not provide an export named 'CHALLENGE_REVIEW_LABEL'`); privacy contract written as a construction pin (the behavioural proof is the E2E); E2E RED on the unmodified build (both entry tests fail on the missing entry; the flag-off guard passes; the seeded-Texas-deck review flow itself completes, proving the harness).
  - [x] Stage 2 — Build: `CHALLENGE_REVIEW_LABEL` in challenge.ts; home-card entry in both deck branches (`.review-challenge-open`, mirroring the reset opener's geometry); ReviewComplete secondary-button entry; `handleReviewChallenge` in GameApp (Editions exit + mini-picker in one state batch, flag re-read at tap) threaded GameApp → Play → PlayLoaded → ReviewComplete, gated on PlayLoaded's boot-authoritative flag read. tsc clean; challenge unit suite 37/37.

<!-- Rebase onto main 24f4d2a: HEAD Package C record kept above per the coordination ledger; Wave 1 record kept below. Neither record overwritten. -->

- **Branch:** `fix/wave1-p0`
- **Base:** main `24f4d2a` (rebased tip 2026-10-30; prior base `45976699` superseded — see rebase record below).
- **State:** INTEGRATED — 3 shipped + Item 2 held out (see HELD-OUT record
  in Done below); tip `2c083b3` on base main `24f4d2a` (PR #286 merged);
  PR #287 OPEN (opened at prior head `c2e7648b`; this rebase updates its
  head automatically); full gates + Wave 1 suites + panel merge re-vote
  on this tip owed.
  NO MERGE without the owner's per-PR word.
- **Governing manifest:** `.council/manifests/2026-10-29-wave1-p0.md` (Tier-2,
  Chair APPROVED, token `AUTH_RUN_TDD_IMPLEMENTATION`; first commit `1fb73a0`,
  pushed to origin SHA-identical via the Git Data API owner route).
- **Prior record:** this file previously carried the Package C branch record
  (feat/challenge-mc2-package-c); Package C merged as PR #285 at `3aa16b56`,
  and its full record lives in that PR and in git history.

## Done (integrated)

- [x] Item 1 — discarded-run notice + durable shadow record
      (`meridian.discarded-notice`).
- [ ] Item 2 — HELD OUT, NOT SHIPPED: `?idle-ms=` honoured only on loopback;
      120,000 ms elsewhere. This item's diff (commit `575e7e2`, skipped in
      the rebase — see rebase record below) is NOT on this branch; its gate
      (deployed-origin live check, both production hosts) did not run, so no
      reader may conclude the loopback gate shipped. Held out of the
      merge-ready set.
- [x] Item 3 — round-loop a11y: one reveal announcer, Next-place focus,
      summary-dialog trap/Escape/return focus.
- [x] Item 4 (UNCONDITIONAL only) — build-aware share URL + dead Search hidden.
- [x] Footprint (rebased tip `ed2ff4b9` vs new base main `45976699`): raw
      +2289/−65; cap-relevant +1770/−38 — vs the amended +2100/−400 cap,
      headroom 330 (not 95). Old-base numbers (vs `3aa16b56`, integrated tip
      `b1ca852`): raw +2332/−67, cap-relevant +1855/−40; amended-waiver
      accounting at the panel-cure worktree was +2005/−62 (95 headroom at
      the time — superseded by the rebase recount).
- [x] Footprint (rebased tip `2c083b3` vs base main `24f4d2a`): raw
      +2327/−39; cap-relevant +1770/−38 — vs the amended +2100/−400 cap,
      headroom 330, unchanged from the `45976699` recount (#286 touches no
      branch file except this record).

## Blocked (no code, owner decisions)

- [ ] Q2 idle-kill policy (keep kill vs "Continue your run?" card).
- [ ] Q3 age-band pool gating (band limits pool vs never limits pool).
- [ ] Q4 preview OAuth secret (remove/rotate vs move exchange server-side).
- [ ] Share wording (CONDITIONAL): exact proposed strings in manifest §2
      Item 4 await the owner's verbatim approval; no CONDITIONAL test written.

## Pending

> **Chair footprint waiver (2026-10-29, Wave 1 P0, branch `fix/wave1-p0`):** Manifest §3 cap +1200/−400 is waived to a revised cap of **+1900/−400** (production + test diff, excluding the manifest and `BRANCH_STATUS.md`). Verified actual at integrated tip `f28e074`: **+1855/−40**. Reason: the overrun is test-driven, not production sprawl — production is ~442 lines across all four items (pre-rebase set; the rebased tip ships three — see HELD-OUT record); the excess is the manifest-mandated gating E2E bulk (15-test discarded-notice, round-loop-a11y, idle-seam live-check). No trim preserves the manifest's gating tests. This waiver covers the cap number only. Constitution rules 1 and 3 are NOT lifted; no gate, panel approval, or merge authority is waived.
>
> Coverage rule: the `BRANCH_STATUS.md` commit itself needs no waiver coverage (the manifest already excludes `BRANCH_STATUS.md` and the manifest from the footprint count). Panel-cure commits are covered only if (1) they cure panel findings on the four already-built items only — no new feature, no new scope, no protected file touched — and (2) cumulative additions stay at or under the revised +1900 cap (45 lines of headroom over the verified +1855 — old-base accounting). Any cure exceeding +1900 or adding scope must return to the Chair for a new ruling before it lands.
>
> **Chair footprint waiver, amended (2026-10-29, Wave 1 P0, branch `fix/wave1-p0`):** Manifest §3 cap +1200/−400, previously waived to +1900/−400, is amended to a revised cap of **+2100/−400** (production + test diff, excluding the manifest and `BRANCH_STATUS.md`). Verified actual at the panel-cure worktree vs base `3aa16b56`: **+2005/−62** (rename-adjusted; +2005/−114 without rename detection, still inside −400). Reason: the +105 overrun over +1900 is the panel-mandated round-1 cure set on the four already-built items only — a real wrong-numbers bug fix (killIdleSession whole-session totals fallback), two a11y correctness fixes (HUD score-span `role="status"` removal; summary-done focus return via `landHomeFocusRef`), and test-honesty fixes (gap-view fail-loudly on missing hook, denied-set test pins, source-pin rename at 0 net) — not scope growth. No cure was trimmed to fit. This waiver covers the cap number only. Constitution rules 1 and 3 are NOT lifted; no gate, panel approval, E2E result, or merge authority is waived.
>
> Amended coverage: this ruling expressly covers committing the worktree cure set as verified (stage the rename pair together so the 0-net accounting applies). Further cure commits are covered only if (i) they cure panel round-1 or re-vote findings on the four built items only, no new feature/scope/protected file/CONDITIONAL change/Item 2 gate change, and (ii) cumulative additions stay ≤ +2100 (95 lines headroom over +2005, for commit-time accounting variance only — old-base accounting; on the rebased tip headroom is 330, see Footprint above). Anything beyond +2100 or adding scope returns to the Chair for a new ruling before it lands. Not waived: the two new E2E tests (1I(2)-boot, 3A-hit) remain UNVERIFIED until VM recovery — E2E reruns, full gates on the final head, and the panel re-vote are still owed before merge-ready. Rename accounting: rename detection is the correct method (moved file byte-identical, sha256 verified, 52 lines, 0 net); without it the count would be +2005/−114, still inside −400, so the waiver holds either way.
- [ ] Full gates on the final tip (tsc, unit, worker, lint-cards,
      build:pages, changed-surface E2E + core journey regression, visual
      360×740 + 390×844). Non-E2E gates re-run per cure commit; E2E
      reruns owed on VM recovery — see E2E environment caveats
      (integrated tip `b1ca852` scope; rebased-tip gates: see the new
      paragraph below).
- [ ] Panel re-vote on the final tip (a pre-integration sign-off never counts).
- [x] Item 2 disposition RESOLVED: HELD OUT (live check did not run; item not shipped — see HELD-OUT record in Done above).
- [ ] Screen recording via parent browser delegation before any production claim.
- [ ] PR (open only, owner merges; never merge from here).

## E2E environment caveats

- VM EPERM fault since ~01:00 UTC: browser runs fail with SIGTRAP, and
  Playwright cache writes fail with EPERM (npm wrapper loads fail the
  same way). That fault — not a code failure — is why E2E reruns stopped.
- Per-suite tallies at the integrated tip `b1ca852` (code tip `f28e074`):
  discarded-notice 15/15, round-loop-a11y 6/7 then 7/7 on rerun,
  search-hidden 2/2, endgame-share 0/2 console-gate-only with functional
  pass, gap-view-reveal 3/3, edition-drilldown 8/8, cleared-mode 11/11,
  difficulty-picker 5/6 with zero clean reruns.
- Gates 1–5 at the integrated tip are DONE (tsc, unit, worker, lint-cards,
  build:pages green). E2E reruns are OWED, meaning: they must run on VM
  recovery before the panel re-vote. OWED is not a waiver, not a pass,
  and not deferred past merge-ready.

- Rebased-tip gates (tip `ed2ff4b9`, base `45976699`): tsc 0, unit 1822/0,
  worker 85/0, lint PASS, scripts suite 766/84 EPERM-only, build:pages +
  E2E blocked by EPERM on `ed2ff4b9`, 0 ran. So on the rebased tip: tsc,
  unit, worker, lint DONE; build:pages and E2E OWED (VM EPERM fault, not a
  code failure) before the panel re-vote.
- Rebase onto main `24f4d2a` (2026-10-30, VM EPERM cleared): 8 commits
  replayed — manifest `033e9dc4→480f0fb`, item4 `d6394cc6→7a94796`,
  item3 `67c3972a→1f58c28`, item1 `962852d3→d1916ab`, branch-record
  `36dd0aec→55e4eec`, waiver `c20dbce9→db376b8`, cure `ed2ff4b9→e11f93a`,
  docs `c2e7648b→2c083b3`. One conflict only, in this file (main's
  Package C record vs this branch's record — both kept per the ledger).
  No code file conflicted; Item 2 still absent (0 hits). Full gates +
  Wave 1 suites + panel merge re-vote on the post-record tip owed; the
  `ed2ff4b9` gates paragraph above is superseded for the new base.
- Closed-tab limits: "Closed-tab notice covers inactivity/new-day only; a
  closed tab's stale-scoring or challenges-off run cannot be derived from
  the shadow, and a challenge-only closed tab leaves no shadow." The
  challenges-off limb is mc1 only (mc2 challenges-off clears silently —
  a follow-up, not this cure).
- Item 1 demoted source-pin: not written. No such documentation file
  exists; do not cite one. (Item 1's pin only — distinct from Item 3's
  pin, which WAS written and renamed; see below. Do not conflate them.)
- Panel round-1 cures (this commit): code delta +150/−22, taking
  cap-relevant cumulative additions to +2005 vs the +1900 cap — 105 lines
  over. AMENDED WAIVER GRANTED (Chair ruling, recorded verbatim below);
  the cure commit lands under the amended cap. The Item 3
  demoted source-pin file (Item 3's pin, not Item 1's) is renamed,
  content-identical, from
  `src/components/round-loop-a11y.test.ts` to
  `src/components/round-loop-a11y.documentation.ts` (out of the npm test
  glob; still non-gating documentation). Two new E2E tests are UNVERIFIED
  until VM recovery: the 1I(2)-boot test in
  `tests/e2e/discarded-notice.spec.ts` and the 3A-hit test in
  `tests/e2e/round-loop-a11y.spec.ts`.

- Same-day fresh closed-tab shadow left alone (no change in this branch;
  not a shipped behaviour change).
- Session-score failure is pre-existing on the base (not introduced by
  this branch).

## Integration notes

- Patches applied in order Item 2 → Item 4 → Item 3 → Item 1. One
  `playwright.config.ts` merge conflict (Item 3 vs Item 4 project entries),
  resolved by keeping all three new project entries: `search-hidden`,
  `round-loop-a11y`, `discarded-notice`. All other files applied cleanly.
- Panel-accepted deviations (round-1 verdicts; Code Reviewer, Frontend
  Developer, and Accessibility Auditor all accepted both): (1) 3C focus
  returns to the home heading, not the End-game opener — the opener
  unmounts with the game, so a literal return is impossible; (2) the
  GameApp live-paragraph edit (~6390) sits outside the manifest's
  "continue handlers ~5632" scoping — exactly-once is unsatisfiable
  without touching the announcer paragraph. Honesty record: 3D/3E are
  GUARDs, not RED evidence, on tested paths.
- Panel question still carried to the re-vote: endgame-share spec fails
  only on VM-egress beacon console errors (functional assertions pass;
  rerun-when-quiet or panel call).

## Rebase record (rebased tip `ed2ff4b9` on main `45976699`)

- Rebased order: manifest → Item 4 → Item 3 → Item 1 → branch-record →
  waiver → cure. Per-commit SHAs, old → rebased: manifest
  `1fb73a01`→`033e9dc4`, Item 4 `f4b2a54`→`d6394cc6`, Item 3
  `349a9ec`→`67c3972a`, Item 1 `2c9dcde`→`962852d3`, branch-record
  `f28e074`→`36dd0aec`, waiver `b1ca852`→`c20dbce9`, cure→`ed2ff4b9`.
  Item 2 commit `575e7e2` was SKIPPED (held out, not rebased).
- The one resolved conflict: the cure's `session.test.ts` edits sat inside
  Item 2's deleted block; deletion won.
- Only `BRANCH_STATUS.md` overlapped main's 12-file move.
- This commit itself: docs-only DevEx round-1 block fixes on `ed2ff4b9`;
  its own SHA is the tip after this commit (verified post-push via the
  ref check, not claimed here).

## Fix round: PR #287 review findings (base main 5e5a440e, head c5d31d6)

- Tier: T2 (Chair + C) per Dinesh's standing order. Council: Chair
  APPROVED (rounds 1–2 + final decision), Councilor C challenged twice;
  final Chair decision APPROVED + AUTH_RUN_TDD_IMPLEMENTATION. Manifest:
  `~/workspace/meridian-wave1/fix-round-review/MANIFEST.md` (kept out of
  the PR diff). Independent reviewer verifies afterwards; no merge word
  is claimed here.
- Scope: 2 Medium + 5 Low findings, one commit each, PR branch only.
  Leave-alone (reported, not changed): endgame-share
  `clickShareScoreWithRetry` (separate issue owed) + share-text origin
  line (owner decision pending).
- M1 (this commit): silent mc2 discard notices with the mc2 run's own
  totals. Guard: `bootSavedRunBody(preserveNotice)` covers all 4 body
  notice sites + `killIdleSession(skipNotice)` gates only its notice
  set; shadow block skipped whole when preserving (defer, not consume).
  Summary-phase mc2 clears silently in both branches. Out of scope by
  Chair ruling: #c= mc1 displacement + unclean-shutdown breaker
  (known limitation for the PR body). Tests: 1E-mc2, 1E-mc2-dual
  (+boot-2 shadow pin), 1E-mc2-GUARD-aim, 1E-mc2-GUARD-mc1,
  1E-mc2-summary-flagoff, 1E-mc2-summary-unresumable,
  1E-mc2-unresumable. RED (pre-fix): basic/dual/unresumable failed
  with predicted signatures; GUARDs + summary passed vacuously.
  GUARD-mc1 note: mutating a played Nebraska run's regionId does NOT
  resume (pool guard trips) — the test uses a real mc1 link instead.
  GREEN-round root cause (found by probe, not by reading): the dual
  test's boot 2 first failed because `clearSession()` unconditionally
  cleared the shadow — the Dismiss click's pointerdown fired the idle
  activity listener, which persisted a null session (no session ever
  existed on that page), and `persist(null)` → `clearSession()` nuked
  the preserved shadow before boot 2 read it. Fix (in this commit,
  `src/game/session.ts`): `clearSession()` clears the shadow only when
  a session was actually stored and removed; a no-op clear leaves an
  unrelated preserved record alone. Scope note: session.ts entered
  this commit because the Chair-required dual test (dismiss + reload
  → shadow notice) cannot pass without it; the existing "clearing the
  session clears a live shadow" unit test still passes, and a new unit
  test pins the no-stored-session case. Probe spec + all probe logs
  removed; the commit diff carries no probe trace.
- M2 (this commit): vacuous gap-view test now asserts the beat really
  runs. The single 300ms spot sample became a ~100ms poll: movement
  observed → `expect(spotMoves).toBe(true)`; card appears first →
  skip (same rule as the at-entry gate), never fail; neither within
  4000ms (below the 6000ms reveal watchdog) → the assertion fails.
  RED proof (temporary animation freeze in `src/map/zoom-space.ts`,
  reverted before green, no trace in the diff): the skip test failed
  at `expect(spotMoves).toBe(true)` with the ease frozen. Disclosed
  residual (Chair-approved): a completes-but-motionless regression
  would skip, not fail — recorded here and for the PR body.
- L1 (this commit): discarded-notice Dismiss now lands focus on the
  home heading via the existing landHomeFocusRef effect (same target
  as summary-done), not <body>. Idle-notice Dismiss untouched (noted
  follow-up). Test 1J (RED pre-fix: activeElement BODY; GREEN post-fix
  in logs/l1-green.log).
- L2 (this commit): visible discarded notice drops role="status"
  (it mounted with text already present, so SRs could miss it); one
  always-present sr-only region on home
  (data-testid="discarded-notice-announcer", map-announcer pattern)
  starts empty and is filled by a post-mount effect, cleared on
  dismiss — so each notice is a real text change, announced exactly
  once. Tests 1K (observer: exactly one announcement per notice) +
  1K-repeat (dismiss clears the region; same notice announces again
  next boot). Instrument note: the observer install defers until
  documentElement exists — addInitScript runs when it is still null
  and observe() throws (probed 2026-10-30); the first GREEN run
  failed on the instrument, not the fix. Existing toHaveCount(0)
  absence assertions unaffected (they key on data-testid).
- L3 (this commit): shadows older than 24h now read as expired AND
  clear the key (read-level, the single enforcement point — the only
  production reader is the body boot's shadow block, so a stale
  record never reaches the dateKey branch). Policy: no notice after
  24h, even for a new-day discard. Boundary unit tests: 23:59:59 kept,
  exactly-24h kept (strictly-older rule; ms-tick retry so the pin is
  deterministic), 24:00:01 null + key removed, future kept, malformed
  null, 25h new-day silent + cleared. Fixture refresh: the shadow
  unit test + the M1 unit test now anchor at run-time Date.now() +
  today's dateKey (a fixed 2023 timestamp reads expired). Full 1B
  E2E suite green: whole discarded-notice spec 26/26 in
  logs/l3-green.log (Chair constraint met).
