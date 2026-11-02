# Branch status — docs/301-security-txt-comments

- **Branch:** `docs/301-security-txt-comments`
- **Base:** `main` @ `2a0527fc5065ca2ec854a43e304c8c794bdaa06f` (#295 merged; tip re-read at build start 2026-11-02)

## Task capsule

TASK / requested outcome: For #301 — refresh the two stale comments in
`public/.well-known/security.txt` that predate the #284 contact wiring
(parked-form framing; "keeps nothing server-side" nuance), verified
against the live wiring from source. Open the PR; STOP at PR-open.

Interpretations considered and selected reading: The issue names
exactly two statements, both in the security.txt comment block. Scope
is that file's comments only — no repo-wide docs sweep, no other file
the issue does not name (it names none).

Tier and rationale: Tier 0 — docs/comments only, no locked or
owner-approved copy changed, no code, no field values.

Done condition / evidence: both statements rewritten so each traces to
source read on current main (table in the PR body); every non-comment
line byte-identical to main (Expires unchanged at
`2027-10-01T00:00:00.000Z`); fast gates sealed under
`~/workspace/meridian-issue-wave/evidence/301/` (tsc, npm test,
lint-cards, build:pages + grep of the built output for a corrected
phrase); PR opened against main. NO MERGE, NO Silo QA / panel in this
stage — those are separate dispatches.

Files in scope: `public/.well-known/security.txt` (comment lines only)
+ this file. Out of scope: the `Expires` value (PR #299 /
`chore/224-security-txt-renewal` owns the renewal to 2027-11-01 on its
own frozen branch — see the overlap note in the PR body), all code,
`/privacy`, README, and every frozen PR (#297/#299/#302/#305).

## What changed and why

- Statement 1 — old: the /contact form "is parked and delivers nothing
  until contact activation lands — owner call 2026-10-21, PR #222 §A".
  New: the form's wiring is on main (issue #220, PR #284); it delivers
  nothing until the owner completes activation; the page shows a
  thank-you only when the worker confirms delivery (`stored:true`);
  security reports should use GitHub's private advisory channel, which
  works now. "Parked" is gone — parked described the pre-#284 state.
- Statement 2 — old: the grown-ups form "keeps nothing server-side
  (see /privacy)". New: Meridian's own server keeps no copy (true, per
  /privacy); a delivered message is held by Discord — including an
  optional reply-to address — until deleted once resolved, within
  90 days. The old line was true of Meridian's server alone and
  incomplete standing alone in this file.

Source proof for each corrected claim is in the PR body's
per-statement table.

## Redundancy audit

- Surfaces audited: `security.txt` comment block (the only surface
  this PR touches) → keep, rewritten in place. It adds no control,
  button, link, or entry point and duplicates no other surface; the
  two `Contact:` lines are unchanged, so no duplicate contact path is
  created. PASS.

## Status

- [x] Branch off current main; coordination ledger heartbeat posted
- [x] Issue #301 read in full; both named statements listed
- [x] Each claim verified from source on main (contact page, form
  model, handler/sinks, flags, privacy page, retention constant,
  PR #284 record)
- [x] Comments rewritten — comment-only diff; non-comment lines
  byte-identical to main
- [ ] Gates sealed (tsc / npm test / lint-cards / build:pages +
  built-output grep)
- [ ] PR opened (no merge)
