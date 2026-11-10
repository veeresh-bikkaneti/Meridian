# Times Table Races — educator evidence pack

**Status:** prepared by an agent for a human to review. **Not signed.** Nothing
here is a pass, a fix or a fail; the rubric calls (`educator-gate-rubric.md`)
belong to a real, named educator. The builder of this pack cannot sign it.

Spec: [`../../math-definition-spec.md`](../../math-definition-spec.md). Unit:
`tables` (6 items). Reviewer time estimate in the rubric: 30 to 45 minutes
(PROPOSED by the rubric, not measured).

## Pack items, keyed to the rubric ("Evidence pack", items 1 to 7)

| # | Rubric asks for | Where | State |
|---|---|---|---|
| 1 | The spec with the K-12 block filled in | spec §11.7 | Ready; boxes ticked only where the file shows the thing, open ones say why |
| 2 | Item list: objective, band, code with source link, in-game evidence | table below, from `items.json` | Ready |
| 3 | "For math: the verification-gate output on one complete mode" | spec §5.2 (earlier draft) | **Paper demonstration only.** §5.2 recomputes 5 Times Table Races problems by hand at Band A (5.NBT.5), which is the 10-18 item `tables:multi-digit`, with one honest detector gap (`54` left unclassified). It is not an implemented gate, and it does not cover the 7-10 or 18+ items; Stage B runs the gate as code on them (spec §11.5). `items.test.mjs` checks the item data only and is **not** that gate |
| 4 | Science cause → effect table | n/a | Not applicable to math |
| 5 | Journal or social studies scripts | n/a | Not applicable; no clips in this strand |
| 6 | 2 to 3 minute recording or mockup of one round per band | storyboard below | **Text storyboard only.** No recording yet; that needs the build |
| 7 | Readability report for host lines and on-screen text | `readability.mjs` output below | Ready for the 10 draft lines |

## 2. The `tables` items (for the signer)

| Id | Band | Objective | Standard (source) | In-game evidence |
|---|---|---|---|---|
| `tables:buses` | 7-10 | solve an equal-groups word problem within 100 | [3.OA.A.3](https://www.thecorestandards.org/Math/Content/3/OA/) | taps the number of buses for 24 children, 6 seats |
| `tables:facts` | 7-10 | multiply and divide within 100 with the times tables | [3.OA.C.7](https://www.thecorestandards.org/Math/Content/3/OA/) | exact answer, no hint |
| `tables:patterns` | 7-10 | spot and explain a table pattern | [3.OA.D.9](https://www.thecorestandards.org/Math/Content/3/OA/) | taps the cells that follow the pattern |
| `tables:big-products` | 7-10 | multiply up to four digits by one digit | [4.NBT.B.5](https://www.thecorestandards.org/Math/Content/4/NBT/) | builds the product from place-value parts |
| `tables:multi-digit` | 10-18 | multiply multi-digit numbers with the standard method | [5.NBT.B.5](https://www.thecorestandards.org/Math/Content/5/NBT/) | exact product, estimate check |
| `tables:mental-strategies` | 18+ | multiply two-digit numbers in the head | UNVERIFIED (no single code fits) | exact answer and the named strategy |

Full wording, the opening problem and the "use it elsewhere" round for each are
in `items.json` and the spec's table. Codes were fetched from
`thecorestandards.org` on 2026-11-10 (existence and opening wording). The
signer is asked to confirm each code's fit (rubric A3).

## 3. Where the rubric items are evidenced

Pointers only. The calls are the educator's.

| Rubric item | Where to look |
|---|---|
| A1 facts correct and sourced | `items.json` (`why`, `standard`); no real-world figures are used |
| A2 content fits the band | spec §11.1 group rule; table above |
| A3 standard codes fit | table above; fetched, sub-clauses not checked |
| 4a bridge and real-life application | `buildsOn` in `items.json`; application is a plan (spec §11.5), not built |
| 4b use-it-elsewhere, correct in that subject | `useElsewhere` on every item (the signer checks the other subject) |
| 4c why first within the first minute | every item's `why`; storyboard step 1 |
| 5 observable verb the game can see | `objective` ("shown by"); `items.test.mjs` |
| 6 predict before told | storyboard step 2 |
| 7 kind, explained feedback after a miss | draft lines `miss` and `hint` |
| 8 misses return, mixed with other skills | spec §11.4 |
| 9 mastery bar fair | spec §11.3 |
| 10 no pressure or shaming | spec §11.5 "race without a clock"; no timer in 7-10 |
| 11 session length suits the band | **not defined yet**; a build detail the signer may set |
| 12 child can tell what to do by looking | storyboard only; needs a real mockup |
| 13, 13a read-aloud, audience fit | spec §11.5 accessibility; the 18+ tier has 3 items |
| 14 no fast reflexes or precise dragging | spec §11.5: tap answers, no drag, no timer in 7-10 |
| 15 Flat tier teaches the same | spec §11.5 tiers; a parity test comes with Stage B |
| 16 no personal information | spec §11.3 and §11.6 |
| 17, 17a school and content screen | spec §11.6; `items.test.mjs` word screen |

## 4. Storyboard: one round at 7-10 (text, not a recording)

Draft wording; owner copy, not approved.

1. **Hook (about 4 seconds).** Four empty buses stand in a row, six seats drawn
   in each. Voice and text: "The class trip has 24 children. Each bus has 6
   seats."
2. **Predict.** "How many buses do we need? Tap a number." Large number
   buttons 3, 4, 5, 6. No timer, no drag.
3. **See.** Children walk onto the first bus and its counter reads 6, then
   12, 18, 24 as each bus fills. Flat tier: the same counts as a stepped 2D
   picture.
4. **Explain.** "Four buses with six seats each. That is 4 times 6."
5. **Retry or move on.** A miss says "Not quite yet. Let us count the seats bus
   by bus." and offers one retry with the hint "Look at one bus. How many seats
   is that?" Then the item goes to the review deck.
6. **Use it elsewhere (later round).** A gear with 8 teeth turns 6 times; how
   many teeth pass the mark (`tables:facts`).

For `10-18` the same shape applies to 23 rows of 47 tiles with an estimate
first (`tables:multi-digit`); for `18+`, a two-quote comparison in the head
(`tables:mental-strategies`).

## 5. Readability report

Source: `times-table-races-lines.json` (draft lines). Script:
`node docs/scaling/math/number/readability.mjs`. Flesch-Kincaid grade with a
rough syllable counter, so read each grade as plus or minus one. Limits: 7-10
at grade 5 (the top of its grades 2 to 5, standard §1); 10-18 at 12; the 18+
limit of 16 is a PROPOSED number of mine, because the standard names none.

```
| id | group | FK grade | limit | ok |
|---|---|---|---|---|
| ttr:7-10:hook-1 | 7-10 | -0.6 | 5 | yes |
| ttr:7-10:hook-2 | 7-10 | 0.6 | 5 | yes |
| ttr:7-10:see | 7-10 | -1.8 | 5 | yes |
| ttr:7-10:explain | 7-10 | -1.6 | 5 | yes |
| ttr:7-10:praise | 7-10 | 0.5 | 5 | yes |
| ttr:7-10:miss | 7-10 | -1.6 | 5 | yes |
| ttr:7-10:hint | 7-10 | -0.7 | 5 | yes |
| ttr:10-18:hook | 10-18 | 1.5 | 12 | yes |
| ttr:10-18:explain | 10-18 | 2.3 | 12 | yes |
| ttr:18+:hook | 18+ | 2.4 | 16 | yes |
```

Short sentences score at or below zero; that is the formula, not a judgement
that the lines are babyish. The 18+ line is plain by design and the signer
decides whether it "challenges an adult" (rubric 13a).

## 6. Sign-off

```
EDUCATOR SIGN-OFF
Spec: [file + commit]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

A sign-off covers the commit it names (rubric). If the build diverges from the
signed spec, it is not signed.
