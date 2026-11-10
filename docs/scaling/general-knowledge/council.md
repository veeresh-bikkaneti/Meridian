# Design council — general-knowledge mixed review (Stage A, 2026-11-10)

**What this is.** A short council of three reviewer perspectives (standard
§8), run by the spec agent on a one-page summary of the design calls and the
draft data, once. The seats are roles, not people. **No seat certifies
anything** and none replaces the human educator (rubric, "Who can sign").
Councilors read the summary and the data diff, not bulk output.

Seats: **LD** learning designer · **ED** educator perspective (not the
educator sign-off) · **CS** child-safety and content-screen reviewer.

## Calls and outcomes

| # | Design call | LD | ED | CS | Outcome |
|---|---|---|---|---|---|
| C1 | Reframe GK from "new trivia" (P10) to a mixed review round that re-deals items met in other subjects | Keep: matches §4 "interleave 2–3 skills" and the map's "GK becomes the mixed review across the chain" | Keep: revision, not new teaching, is easier to defend to a school | Keep: smaller surface for unsourced trivia | **Adopted 3–0.** P10 trivia bank is replaced by this round in v1; P11 and P12 stay as recorded (not decided here). |
| C2 | Link to other subjects by **id** (`buildsOn`) instead of copying their items | Keep: one skill, one record, one mastery state | Keep | No view | **Adopted 3–0.** Math is linked to the real `docs/scaling/math/number/items.json` on main; geography and physics use fixtures until those subjects publish I2 data. |
| C3 | Which globe-deck places may be fixtures | Prefer places with a sourced number a child can compute with | Prefer places the 7-10 group can find on a globe | Cut any place whose story is a place of worship, a burial site, wildlife, a political symbol or a contested border | **Adopted 3–0:** Eiffel Tower, Sydney Opera House, Mosi-oa-Tunya / Victoria Falls, Mount Everest. Cuts logged in the spec's CUT log. |
| C4 | "How many years ago" items | Keep: a real why-first hook | Compute from the device year so it never goes stale | Never ask the child's age or birth year; never say "when you were born" | **Adopted 3–0.** Answer computed at play time; nothing stored; test bans age wording. |
| C5 | Problem numbers that are not facts (bus seats, plane speed, angle and distance) | Keep: needed for a clean computation | Label them on screen as "numbers for this problem" | Keep, labelled | **Adopted 3–0.** Each such item says so in its `why`; sources.md lists them as problem numbers. |
| C6 | Mount Everest as a fixture | Keep: best big-number anchor | Keep | **Doubt:** the height has been reported differently in the past, and climbing deaths must never appear | **Adopted 2–1 with a condition:** use only the 2020 joint survey height (8,848.86 m) and the location; no height history, no climbing story. CS dissent recorded. |
| C7 | 18+ items with no school code | Keep: adults need depth (haversine, powers of ten) | Mark UNVERIFIED with a Fit note, as the math strand does | No view | **Adopted 3–0.** |
| C8 | Remove vendor and voice names from the earlier spec text | — | — | Keep the spec agent-neutral (standard §8, owner rule) | **Adopted.** Earlier tooling names in the agent prompt are replaced by the house pipeline names. |

## What the council could not decide (goes to the owner)

- Whether P11 current affairs stays in scope at all after ruling D2 (§7a bans
  current or contested politics). Recorded, not decided: spec G2.
- Whether general knowledge is its own subject card or only a review mode
  inside the existing review deck. Spec G3.
