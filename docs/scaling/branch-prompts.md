# Branch prompts — one copy-paste prompt per branch, in priority order

Paste one block into any capable coding agent. Each block is self-contained;
the shared rules live in `agent-instructions.md` so the prompts stay short.
Until PR `claude/k12-plan-review` merges, the shared files are read from that
branch (the first line of every prompt does this).

Every subject prompt below also carries the headline goal (standard §0): each
unit gets a "Builds on / Real life / Environment link" entry from
`subject-progression-map.md`, and its application is a playable scene.

Run them in this order. Items 1–2 are approved to build or define; everything
else is spec work only and stays GATED on a real educator's signed rubric.

---

## 1. `feat/phase0-shell-split` — approved to build

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/phase0-shell-split; push only that branch.

Task: continue the Phase 0 shell split per docs/scaling/phase0-shell-split-spec.md
on this branch (slice 1 is partial; game-app is ~8,472 lines). Split so each
subject loads as its own lazy chunk and three.js loads only inside a chosen
subject. Measure and record the baseline: initial JS gzip, per-chunk gzip, and
tap-to-first-paint on the weak-device CI profile. Write the measured numbers
into the spec as the starting budgets (they were proposals until now).
No behaviour change to the geography game. Tier 2 per AGENTS.md: council
manifest first, then failing tests, then the minimal change.
Done = all AGENTS.md gates green, screen recording, BRANCH_STATUS.md updated.
Open or update a draft PR; never merge.
```

## 1b. Age groups in `bands.ts` — new branch `feat/age-groups` (code; build only on the owner's go)

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Cut feat/age-groups from main; push only that branch.

Task: move src/game/age-profile/bands.ts from 5-7 / 8-10 / 11-13 to the owner's
three groups 7-10 / 10-18 / 18+ (standard §1). Merge 5-7 and 8-10 into 7-10,
widen 11-13 to 10-18, add 18+ (hardest tiers, skippable narration, no timers in
7-10). Migrate stored profiles so no player loses progress. Group labels and
parent-facing strings are owner copy: leave TODO placeholders and ask; never
invent them. Never ask for an exact age. Tier 2 per AGENTS.md: council
manifest, failing tests first, minimal change, all gates, screen recording.
This is not yet approved to build: write the manifest and stop for the owner's
go before code. Draft PR only; never merge.
```

## 2. `feat/math-definition` — approved definition work

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map educator-gate-rubric; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/math-definition; push only that branch.

Task: finish docs/scaling/math-definition-spec.md. Add the standard's §9 block.
For every mode in the topic map: one observable objective, its CCSS code with
a live source, and the in-game evidence. Define math's "confident" bar for the
existing Explored/Growing/Mastered states. Replace the separate error-type deck
with a filter on the existing review deck (src/game/review-deck.ts). Describe
the play surface in Full / Lite / Flat motion tiers with learning parity.
Then assemble the educator evidence pack (rubric section "Evidence pack") for
Times Table Races so a real teacher can sign it. Age groups are 7-10, 10-18
and 18+ (standard §1): add a 7-10 entry tier (concrete, picture first) and an
18+ top tier (big-number tricks and Olympiad-style depth fit there).
Docs only; no feature code.
Done = BRANCH_STATUS.md updated; report what the educator must sign.
```

## 3. `feat/math-spec` — spec only (build follows the math sign-off)

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/math-spec; push only that branch.

Task: align docs/scaling/math-spec.md with the signed-to-be math definition:
add the §9 block, point objectives and codes at the definition (no copies),
make the review deck reuse the existing deck, add the motion-tier play surface
(three.js number line or ten-frame with a Flat SVG fallback), add the WCAG 2.2
AA items (tap alternative for drags, timers optional and switchable off,
screen-reader live region). Keep the video count TO CONFIRM. Record that the
build branch name (feat/math-spec vs feat/math-tricks) awaits owner decision D5.
Spec only; no code. Update BRANCH_STATUS.md and report.
```

## 4. `feat/science-definitions` — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/science-definitions; push only that branch.

Task: update science-definitions-spec.md and the P4/P6/P7 briefs. Add the §9
block. Pick ONE first predict-then-see system for P7 (recommend ramps and
friction) and define it as an interactive three.js scene with Full / Lite /
Flat tiers, every cause-to-effect rule sourced. Give each item an objective and
an NGSS code (life-science codes are allowed now; none on reproduction,
sexuality or gender identity). Keep the
disclosed Spatial Data Scientist seat. Spec only. Update BRANCH_STATUS.md.
```

## 5. `feat/science-spec` — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/science-spec; push only that branch.

Task: recast the 24 proposed "videos" in docs/scaling/science-spec.md as
interactive three.js predict-then-see scenes (the child changes something,
predicts, then watches). Keep video only where real footage is the point.
Add the §9 block, an objective and NGSS PS code per item (or UNVERIFIED), the
motion tiers with learning parity, and the review-deck hookup. Keep 24 as
PROPOSED. Spec only. Update BRANCH_STATUS.md.
```

## 6. `feat/physics-spec` — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/physics-spec; push only that branch.

Task: in docs/scaling/physics-spec.md add the §9 block, an objective and NGSS
PS code per item, three.js scene descriptions with Full / Lite / Flat tiers,
and the P4/P7 split (qualitative here, formulas in P4). Propose a count but
mark it PROPOSED; never decided. Spec only. Update BRANCH_STATUS.md.
```

## 7. `feat/chemistry-spec` — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/chemistry-spec; push only that branch.

Task: in docs/scaling/chemistry-spec.md add the §9 block, an objective and
NGSS PS code per item, and a safety rule: combine-and-watch happens only on
screen and never reads as at-home instructions. Reuse the P7 predict-then-see
engine (shared three.js scene shell, tiers, parity). Propose a count marked
PROPOSED. Spec only. Update BRANCH_STATUS.md.
```

## 7b. `feat/biology-spec` (new branch) — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map biology-spec; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Cut branch feat/biology-spec from main; push only that branch.

Task: move docs/scaling/biology-spec.md onto this branch and finish it. For
each proposed unit (B1-B7): bridge from the chemistry or physics unit it builds
on, a real-life and environment link, one observable objective, an NGSS LS code
with a live source (or UNVERIFIED), and a playable three.js scene with Full /
Lite / Flat tiers that reuses the predict-then-see engine and the home globe
for habitats. Out of scope: sexuality, sexual orientation, gender identity and
human reproduction (owner ruling); dissection or graphic imagery. Keep the
count TO CONFIRM. Disclose the scientist seat as an imperfect fit. Spec only.
Add BRANCH_STATUS.md and open a draft PR; never merge.
```

## 8. `feat/journal-people-places-spec` — spec only (first journal)

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/journal-people-places-spec; push only that branch.

Task: in docs/scaling/journal-people-places-spec.md, for each of the 5
proposed clips add: band, an objective, a C3 Geography or History code (live
source, or UNVERIFIED), one read-aloud retrieval check about something the clip
shows (feeds the review deck), captions + transcript, and a short three.js
globe fly-to that places the story on the map before the clip (Flat tier: a
2D map pin). Keep 5 as PROPOSED. Spec only. Update BRANCH_STATUS.md.
```

## 9. `feat/journal-technology-spec` — spec only

```
Same setup lines as prompt 8, branch feat/journal-technology-spec.
Task: same additions as prompt 8 for its 3 proposed clips (objective, C3 code,
retrieval check, captions, globe fly-to with Flat fallback). Keep 3 as PROPOSED.
Spec only. Update BRANCH_STATUS.md.
```

## 10. `feat/social-studies-spec` — spec only

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/social-studies-spec; push only that branch.

Task: in docs/scaling/social-studies-spec.md add the §9 block and make the
mode map-based on the existing geography engine (place, region, route,
compare). Each item: objective, C3 code, review-deck hookup, motion tiers.
Propose a count marked PROPOSED. Screen every item against the content rule
(standard §7a) and log cut items with the reason. Spec only. Update BRANCH_STATUS.md.
```

## 11. `feat/humanities-definitions` — spec only

```
Same setup lines as prompt 10, branch feat/humanities-definitions.
Task: add the §9 block to humanities-definitions-spec.md; give each topic an
objective and C3 code; confirm religion and mythology stay fully removed;
screen every topic against the content rule (standard §7a) and log cut items
with the reason. Spec only. Update BRANCH_STATUS.md.
```

## 12–16. History journal specs — spec only, content rule §7a applies

Owner ruled D2 on 2026-11-10 (standard §7a). One prompt, five branches:

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch <BRANCH>; push only that branch.

Task: screen docs/scaling/<FILE> against the content rule (standard §7a): no
religion, no sexuality or gender identity topics, no current or contested
politics; people are told through documented achievements and places, never
their politics; when in doubt, cut it and log why. Then for each kept clip add: band, objective, C3 History code (live source
or UNVERIFIED), one read-aloud retrieval check, captions + transcript, a globe
fly-to with Flat fallback, and the tone rules (remembrance, no graphic detail,
no battle re-enactment). Keep the clip count PROPOSED. Spec only.
Update BRANCH_STATUS.md.
```

| # | `<BRANCH>` | `<FILE>` | Proposed clips |
|---|---|---|---|
| 12 | `feat/journal-ww2-monuments-spec` | `journal-ww2-monuments-spec.md` | 2 |
| 13 | `feat/journal-world-wars-spec` | `journal-world-wars-spec.md` | 2 |
| 14 | `feat/journal-modern-world-spec` | `journal-modern-world-spec.md` | 3 |
| 15 | `feat/journal-great-leaders-spec` | `journal-great-leaders-spec.md` | 2 |
| 16 | `feat/journal-freedom-fighters-spec` | `journal-freedom-fighters-spec.md` | 2 |

## 17. `feat/general-knowledge-spec` — spec only (last)

```
Repo veeresh-bikkaneti/Meridian. First read, once:
git fetch origin claude/k12-plan-review && for f in agent-instructions k12-learning-design-standard subject-progression-map; do git show origin/claude/k12-plan-review:docs/scaling/$f.md; done
Follow them. Work only on branch feat/general-knowledge-spec; push only that branch.

Task: in docs/scaling/general-knowledge-spec.md add the §9 block and reframe
general knowledge as a mixed review round that interleaves items the child has
already met in other subjects (from the review deck), rather than new trivia.
Each new item still needs an objective and a code. Propose a count marked
PROPOSED. Spec only. Update BRANCH_STATUS.md.
```

---

## Model-neutral agent instructions (own PR, not a branch above)

```
Repo veeresh-bikkaneti/Meridian. Cut branch chore/model-neutral-agents from main.
Edit AGENTS.md ("Worker roles run on the cheapest capable model") and
docs/ops/agent-council-protocol.md (seat table) to remove every vendor and
model name. Replace with: "The orchestrator uses the strongest model the
builder can afford; worker roles use the cheapest capable model, orchestrated
as subagents; design calls go to a council of experts that reviews summaries
and diffs, not bulk output." This file is never Tier 0: follow AGENTS.md
"Prompt, skill, and persona changes — eval discipline" in full. Open a draft
PR; never merge.
```
