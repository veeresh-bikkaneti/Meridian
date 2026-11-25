# 17 — Read-aloud sheet as a true arrival modal

## Intent (one line)
Make Home's first-visit read-aloud sheet ("Do you like stories read aloud? Always / Sometimes / Never") a true modal: backdrop, inert page, scroll lock, focus trap, no dismiss-without-choosing.

## Why (origin)
Owner direction 2026-11-20 (branch work on items 1, 2 and 3; this is item 3). On main the sheet is a fixed overlay with no backdrop and no scroll lock — the page behind it stays live, so a first-visit child can interact past the question that sets their whole audio experience.

## Scope IN
- Modal behaviour on the arrival sheet only: full-viewport scrim (hit-test proven), Home inert while up, body + root scroll lock (restored on answer), focus trap starting on the first choice, Escape swallowed.
- The three choices, their wording, and persistence (`meridian.readAloudPref.v1`) byte-identical to main.

## Scope OUT
- The footer settings toggle (`ReadAloudPrefSettings`) — a different component, untouched.
- Any mid-game surfacing: the sheet mounts in exactly ONE place (Home, inside `FirstVisitQueue`, only while the pref is unset) — verified in code; it cannot appear mid-game, so the Round 2 "no modal over gameplay" ruling is untouched.

## Locked decisions
- Built on the existing shell system: `FirstVisitPrompt` gains a `modal` flag; the queue owns the hold; the portal escapes the inert subtree (same mechanism family as the age gate).
- Disclosed in the PR: the grownups 6-viewport e2e now answers the sheet up front (zero assertions changed); two unit source pins updated for the deliberate wiring change.

## Acceptance criteria
- Gates: tsc ✓, lint:nav ✓, provenance ✓, unit suite 4,220 tests 0 failures; new spec `read-aloud-modal.desktop.spec.ts` proves backdrop hit-test, Escape/backdrop write no preference, scroll lock + restore, focus never leaves, each choice dismisses + persists + never re-asks; regressions (layout-overflow, nav-back-first-visit, grownups 5/5) green.
- Captures at 1280/768/390/320 by the two-shot method (arrival viewport with sheet up + full page after answering) — the naive full-page stitch renders blank against a locked document and was corrected on the record.

## Assets & related work (in this folder)
- `branch-status-feat-read-aloud-modal.md` — trigger-path findings, build description, gate table.
- 8 captures: `read-aloud-modal-arrival-{1280,768,390,320}px.png` + `read-aloud-modal-full-{1280,768,390,320}px.png`. The 1280 pair was shown to the owner as a sample and approved (❤️, 2026-11-20).

## Open questions for the architect
1. Is a no-exit arrival modal the right pattern for a preference question in a kids' product — or should a first-visit question always have a defer path?
2. The modal pattern (portal + queue-owned hold) — should it become the house pattern for future arrival prompts?

## Status & evidence
- **MERGED to main 2026-11-21** (commit `7c04e3a7`, head `72d37713`). The draft-PR state recorded in pack v1 (tip `315a1b26`, gates green, captures closed) is superseded: the merge the brief waited on has happened.
- Remaining: only the owner's post-merge live eye (the arrival modal on the live build). No architect design decision is outstanding on the code as merged; a verdict here is a retrospective on the modal pattern, useful as precedent for future arrival prompts.
