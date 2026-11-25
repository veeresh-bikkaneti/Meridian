# 27 — Small rulings owed (five, grouped)

## Intent (one line)
Five small, separate decisions that each unblock or close a record. One section per ruling; each needs the owner's word (the architect's view is welcome on #3 and #4).

---

## 27a — PR 531 record conflict

- **What:** The owner refused PR 531's vote on 2026-11-17 (recorded reason: not following coding standards), but the tracker later showed it merged by others as `2c9eb762`.
- **Needed:** a live check of what actually merged, then the owner's ruling on whether the refusal stands as his word (with the merge treated as an exception) or the record is corrected.
- **Why it matters:** "Settled" state is the product truth; a tracker that contradicts the owner's word corrupts every later decision that cites it.

## 27b — PR 469 follow-up

- **What:** A follow-up item carried on the register from PR 469, offered more than once, never answered.
- **Needed:** the owner names the follow-up's disposition (do it / drop it) — the register keeps it visible until he does.

## 27c — `meridian.run` reload-restore ruling

- **What:** The map quiz's sessionStorage reload-restore boots a reload straight back into a quiz. Open ruling since the 2026-11-08 owner play-test round: is that intended behaviour, or should the fix that made default entry land on HOME extend to reloads?
- **Needed:** owner's ruling — intended vs extend the fix.
- **Architect's angle:** a child who reloads mid-quiz (accidentally or by browser refresh) — which behaviour serves them?

## 27d — Privacy age-band wording sign-off

- **What:** The privacy age-band line from the UI/UX Round 2 work (PR 522 line) was deliberately left untouched pending the owner's explicit sign-off on the wording.
- **Needed:** owner approves the exact wording (player-facing/legal copy never ships without his explicit word).

## 27e — Review-pipeline leftovers #113 / #117

- **What:** From the full review-pipeline run (goal record): #113 is blocked on a two-line pin-tolerance fix awaiting the owner's call on who applies it; #117's closure awaits his ruling on three banner/narration divergences with #118. (#114, #115, #116, #118 merged.) Neither PR appears on today's open-PR board — the goal record and the board disagree and need reconciling as part of the ruling.
- **Needed:** owner rules on the pin-tolerance fix ownership and the three divergences; records reconciled to match.

---

## Scope IN / OUT
- IN: the five rulings above, each closed by a recorded owner decision.
- OUT: any build work — each ruling may spawn its own item later; none is authorized here.

## Acceptance criteria
- Each of the five has a dated owner decision on record, and any tracker/board that contradicted it is corrected to match.

## Assets & related work
- Brief-only folder: each section cites its own record (memory dates, PR numbers, goal `meridian-pr-review-pipeline` for 27e).

## Status & evidence
- All five open. Oldest: 27e (2026-11-05 record), 27d (2026-11-17), 27a (2026-11-17 refusal).

**Update 2026-11-23 (pack v2):** one factual shift — PRs #113/#117 are no longer among the repo's open PRs (the only open drafts are #571/#574). Their ruling residue is unchanged in the record; the other rulings are untouched by the architecture programme.
