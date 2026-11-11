# Council panel: generic seating loop (token-optimised)

Owner-supplied, 2026-11-10 (project chat). A reusable prompt for running a
multi-seat review council on any subject: a PR, a design, a plan, a
document. Fill the [BRACKETS] once per run. Everything else is mechanics:
copy it as-is to any agent. `AGENTS.md` §5 points here; it ranks below
`AGENTS.md` and never relaxes a safeguard.

The quality lives in the seats' **judgments**. The waste lives in every seat
re-measuring the same facts. This loop pays for facts once and judgments per
seat.

## 0. Run inputs (fill once)

- **SUBJECT:** [what is under review: PR # / branch @ tip SHA / doc / plan]
- **PROMISES:** [the owner's spec, verbatim, numbered. Seats judge against
  this text only, never against summaries of it]
- **LAWS:** [the standing constraints that bind this subject: safety, scope,
  banned content, budget ceilings]
- **SEATS:** [the roster, one persona file per seat, loaded verbatim. A seat
  with no persona file is declared VACANT, never improvised]
- **EXPERIENTIAL SEAT:** [the seat that uses the thing: plays it, runs it,
  reads it as a customer. Its vote counts only with artifacts attached: a
  timed log and captures. No artifacts = seat vacant = no READY verdict]
- **EVIDENCE HOME:** [one folder every artifact lands in, including the tally
  file]

## 1. The loop

### Wave 0: evidence pack (one agent, before any seat is briefed)

Compute the shared facts once and write them to the pack:

- the exact diff, document or artifact under review, and its checksum or tip
- every grep, count and listing two or more seats would otherwise run
- gate results already available (tests, build, linters)
- the open questions the panel must answer, listed by name

Seats cite pack sections. A seat that re-derives a pack fact is wasting the
budget; a seat that finds a pack fact wrong reports it as a finding.

### Wave 1: judgment seats (all in parallel, one dispatch)

Each seat gets: the pack, the PROMISES, its own persona, and one lens
question. Nothing else: no other seat's report, no builder's defence, no
hypotheses. Clean context is the point: a seat that knows how it was built
will excuse it.

Each seat returns, and nothing more:

- **VERDICT:** APPROVE / APPROVE-WITH-NITS / BLOCK
- findings, numbered, each labelled `[measured]` / `[inferred]` / `[guess]`
- a BLOCK names the promise it breaks and the smallest cure that would flip
  it

### Convergence brake (check as votes land)

If two seats independently BLOCK on the same defect, stop waiting for the
rest: dispatch the cure immediately. Remaining seats still finish (their
other findings matter), but nobody re-reviews the doomed tip.

### Wave 2: experiential seat (only after Wave 1 clears the core promises)

Never pay for a full use-session on a tip the code seats have already
killed. This seat uses the thing end to end, black-box, against the
PROMISES, and attaches its timed log and captures. A promise absent or
different in use is a BLOCK ("promised, not delivered").

### Verdict

Tally by name in the tally file. READY requires: every seat reported, zero
standing BLOCKs, experiential artifacts present. Anything else is NOT READY:
say which seats and which cures are outstanding, never round up.

## 2. The cure loop (where panels usually burn the budget)

1. Cures land on the same branch; the tip moves; the panel re-votes the
   cured tip. A coordinator's own check of a cure is not a vote.
2. Re-vote is scoped: only the seats whose surface the cure touched, plus
   every seat that blocked. Untouched seats' votes carry over by name.
3. Records-only cures (a missing step written into a body or record, no code
   moved) convert on the coordinator's read-back, with no re-vote round.
4. Each cure round re-runs Wave 0 for the delta only (new diff vs the voted
   tip), not the whole pack.
5. A cure that touches a new surface pulls that surface's seat into the
   re-vote. Scope follows the diff, not the original roster.

## 3. Token rules (binding on every seat)

- Read the pack first; cite it; do not re-measure what it already proves.
- Verdict first, findings numbered, no preamble, no recap of the subject.
- Do not run full test suites or builds unless your lens requires it: the
  pack carries the gate results; run only the slice your judgment depends
  on.
- One report, complete. No follow-up "also I found" messages.
- If you are blocked on access or a missing file, say so in one line and
  return a VACANT-seat report instead of retrying in a loop.

## 4. Seat brief template (copy per seat)

```text
You are the [SEAT NAME] seat. Your persona is attached verbatim; judge
from it, not from a generic idea of the role.
SUBJECT: [subject + tip]. PROMISES: [verbatim]. LAWS: [verbatim].
The evidence pack is at [path]; read it first and cite it.
Your lens: [the one question this seat exists to answer].
Return: VERDICT + numbered findings, each [measured]/[inferred]/[guess].
A BLOCK names the broken promise and the smallest cure that flips it.
Do not read other seats' reports. Do not re-run gates the pack covers.
```

## 5. Coordinator checklist

1. Fill §0, build the pack (Wave 0), verify every persona file exists.
2. Dispatch all Wave 1 seats in one message (parallel).
3. Watch for the convergence brake as votes land; tally each vote on
   arrival.
4. Dispatch the cure the moment the brake fires or the last vote lands.
5. Run Wave 2 once Wave 1 clears; run the scoped re-vote on the cured tip.
6. Deliver one verdict: tally by name, standing BLOCKs, the cures and their
   state, and what is not covered, plainly.

*Why this shape: panels burn tokens three ways: duplicated measurement,
experiential runs on doomed tips, and full re-votes for one-line cures. The
loop removes all three and keeps the two things that actually catch
defects: clean-context judgment and a real use-session with artifacts.*
