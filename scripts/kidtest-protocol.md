# Kid test protocol — the painted Holmes & Watson gate

This is the human half of the character re-skin gate. Read it top to
bottom before you run a session. It takes about 10 minutes to read.

**What this test decides:** whether the new painted Holmes & Watson
art is allowed to replace the current pair in the game. It is a
go / no-go gate. If the art fails, it does not ship — there is no
"close enough" and no second vote. The full test runs once, at PR D
(the flip). PR A only smoke-runs the automatic measures.

**What is automatic and what is human:**

- A computer measures figure size, face size, and whether a figure
  ever covers clue text. That lives in
  `tests/e2e/pair-art-kidtest.spec.ts` and `scripts/kidtest-smoke.mjs`.
- Children measure everything else: can they **find** Holmes fast,
  can they **tell Holmes apart** from the other characters, and can
  they **read his face**. No adult guesses these answers for them,
  and no script fakes them.

---

## 1. Who takes part — and exactly how many, allocated how

**Sample allocation (panel round 1, UX researcher B2 cure — this
section replaces the old wording, which used two different
phrasings for the sample size in §1 and §7 without ever saying
whether they meant the same children):**

- **Independent observations per cell.** Each cell (see §2) is
  scored from **30 children who serve in that cell only**. No child
  takes part in more than one cell. There are 12 cells, so the
  total sample is **12 × 30 = 360 children** — that is the total N;
  there is no other reading (this also settles the old total-N
  ambiguity: N = 360 child-sessions, one cell each).
- Because every child sees exactly one cell, **every observation
  is a first exposure**: the find-Holmes measure is a naïve
  findability measure in every cell by construction, not just in
  whichever cell happened to run first. (The earlier fixed-order,
  same-cohort design measured naïve findability in cell 1 only and
  practised findability everywhere else — that design is retired.)
- If a child has in fact seen the pair art before their session
  (a sibling's session, a screenshot at home), that is recorded in
  the **first-exposure flag** on their scoring sheet and in the
  results file, and their observations are **replaced** with a
  naïve child's — a flagged observation never counts toward a bar.
- **Ages 6–12, stratified per cell:** in every cell, exactly
  **10 children aged 6–8, 10 aged 9–10, and 10 aged 11–12**.
  Stratification is per cell, not just across the whole study —
  see the per-band floors in §7 (UX researcher B3 cure).
- Children who play games on a phone or tablet at least sometimes.
  They do **not** need to know Meridian or Sherlock Holmes.
- A parent or guardian says yes first, in writing. The child can stop
  at any time, for any reason, and stopping is never counted as a
  failure.
- One adult runs the session (the "runner"). If a second adult can
  score independently, even better — disagreements get written down,
  not argued away.

## 2. The cells

Every child is tested in **cells**. A cell is one screen width × one
background:

| Widths | Backgrounds |
| --- | --- |
| 390 px (small phone) | The real game map |
| 768 px (tablet) | The real game page |
| 1280 px (laptop) | The static block (the simple still picture shown on low-memory devices) |
| 1920 px (big screen) | |

That is 4 × 3 = **12 cells**. The gate must pass in **every** cell.
One bad cell fails the gate — a size that works on a laptop but hides
Holmes on a small phone is a fail, full stop.

**Figure sizes per width** (the harness renders the biggest size in
the band — the hardest case for covering text):

| Width | Figure height | Face at least |
| --- | --- | --- |
| 390 | 112–128 px | 38 px |
| 768 | 128–144 px | 44 px |
| 1280 | 144–160 px | 48 px |
| 1920 | 160–176 px | 52 px |

## 3. What you need before a session

1. The trial manifest from the harness:
   `test-results/pair-art-kidtest/trial-manifest.json`. It lists every
   trial screen, which picture goes where, and the right answer for
   each one. If a trial says `blocked-missing-plate`, that picture is
   not ready — do not improvise a substitute; note it and move on.
2. The device (or browser window) set to the exact width of the cell
   you are running.
3. A stopwatch or phone timer for the find trials.
4. A printed scoring sheet per child (section 6), or the same table
   in a notes file.
5. A quiet room, normal indoor light. No hints on the walls, no other
   Meridian pictures open.

## 4. The three trials

Run them in this order for each cell: **find**, then **identity**,
then **expression**. Use the screens the manifest names — one figure
per find screen, placed where the manifest says.

### Trial 1 — Find Holmes

1. Show the screen. Holmes is somewhere on it, at one of the normal
   spots beside the map.
2. Ask, exactly: **"Where is Holmes?"**
3. Start the timer when you finish the question.
4. The child taps where they think Holmes is.
5. Stop the timer at the tap.
6. Score it:
   - **Pass** — the tap lands on Holmes **within 2 seconds**.
   - **Miss** — the tap lands anywhere else, or lands after 2 seconds.
7. No hints, no "look again", no pointing. One try per screen.

### Trial 2 — Identity

1. Show the screen with four characters side by side, in the order
   the manifest gives: **Holmes, Watson, the Cold Trail tracker, and
   Jolly**, shuffled.
2. Ask, exactly: **"Which one is Holmes?"**
3. The child taps one character.
4. Score it:
   - **Pass** — they tap Holmes.
   - **Miss** — they tap anyone else. **Write down who they tapped.**
     A miss where the child picked the tracker or Jolly is a
     "confusion" miss — these are counted separately at scoring time,
     because look-alike characters are exactly the failure this trial
     exists to catch.

### Trial 3 — Expression (redesigned, panel round 1, UX researcher B1 cure)

The old version of this trial showed a single oversized Holmes
face, alone on the screen. That
defeated the gate it claimed to measure: §10 requires the feeling
to read **at the cell's face floor**, and an oversized isolated
face is readable at almost any quality. The old seeded manifest
also never tested the required feelings — its 12 expression
trials were pout ×6, thinking ×2, and reading / hushed / attentive
/ marking ×1 each: **delighted ×0, surprised ×0**. Both defects
are cured here and in the harness's trial generation.

1. Show the **whole figure** (Holmes or Watson, as the manifest
   trial names) at the cell's **in-band minimum figure height**
   (112 / 128 / 144 / 160 px by width — the smallest figure the
   band allows, so the face is at the cell's floor scale). The
   trial's face is composited **on the figure** at the manifest's
   face placement. Never show a face plate alone, and never
   enlarge the face or the figure beyond the in-band size.
2. Each cell carries **six** expression trials: **delighted,
   surprised, and pout, for Holmes and for Watson** (Watson reads
   every clue aloud; his faces carry the same ≥26/30 bar — Game
   designer nit 3). The manifest records the character and the
   emotion on every trial.
3. **Counterbalance the emotion order across children:** within a
   cell, rotate the order the six trials are shown by child code —
   child 1 starts at delighted, child 2 at surprised, child 3 at
   pout, child 4 at delighted again, and so on (the two characters
   alternate inside each rotation). No child in a cell sees the
   six trials in the same order as the child before them unless
   the rotation says so.
4. Ask, exactly: **"How does Holmes feel?"** (or **"How does
   Watson feel?"**), and read out the four choices on the manifest
   (delighted, surprised, pout, neutral).
5. The child picks one feeling — by tapping it or saying it.
6. Score it:
   - **Pass** — they pick the feeling the manifest names for that
     trial.
   - **Miss** — any other feeling. Write down what they picked,
     and the trial's character + emotion.

## 5. Running the session

1. Welcome the child. Say: "We're testing some new pictures for a
   game. There are no wrong answers about *you* — if a picture is
   hard to find, that's the picture's fault, not yours."
2. One practice screen first (any picture, not scored) so the child
   knows tapping is how they answer.
3. Run the child's **one** cell (§1: each child serves in exactly
   one cell) in the order on the scoring sheet: find, identity,
   then the six expression trials in their counterbalanced order.
   Short breaks are fine. One cell is 8 trials — a single sitting
   for most children; if a sitting must split, finish the same
   cell in the second sitting and note it on the sheet.
4. Never coach. If the child asks "is that him?", say: "Pick the one
   you think." Write down that they asked.
5. Thank the child whatever the scores are.

## 6. Scoring sheet (one per child)

Copy this table. One row per trial.

| Field | What to write |
| --- | --- |
| Child code | e.g. `K01` — a code, never the child's name |
| Age band | `6–8`, `9–10`, or `11–12` |
| Cell | e.g. `390-map` (width-background) — the child's only cell |
| First exposure? | `yes` — must be yes (§1); if `no`, write why, and the child's observations are replaced, never counted |
| Trial | `find`, `identity`, or `expression` |
| Character + emotion (expression only) | e.g. `watson · surprised` — copied from the manifest trial |
| Time (find only) | Seconds to the tap, to one decimal place |
| Answer | Who/what they tapped or picked |
| Result | `pass` or `miss` |
| Notes | Anything they said, asked, or hesitated over |

## 7. The pass / fail lines (exact)

Count the passes per cell. **Each cell's trials are taken by 30
children, and each of those 30 children serves in that cell only**
(§1 — independent observations per cell; total N = 360).

| Trial | Pass line | Kill line |
| --- | --- | --- |
| Find Holmes | **27/30 or more**, in ≤2 s, in **every** cell | **25/30 or fewer in any one cell kills the art** (26/30 also fails the gate — it is below the pass line — and the art goes back for fixes, not live) |
| Identity | **27/30 or more** in every cell | More than **3/30 confusion** with the tracker or Jolly in any cell fails the gate |
| Expression | **26/30 or more** in every cell, **per character and per emotion** — each (cell × Holmes/Watson × delighted/surprised/pout) slice is scored out of its own 30 | Below 26/30 in any slice fails the gate |
| Clue-text coverage | **0 px²** at the biggest in-band size (automatic measure) | Any coverage at all fails the gate |

**Age-band floors (panel round 1, UX researcher B3 cure — written
here, before any run; §10 of the spec forbids amending bars after
the test runs):** the pooled lines above are reachable with a
youngest-band failure hidden inside them (27/30 could be 7/10
ages 6–8 plus 20/20 older children). So every cell is ALSO scored
per age band, and **each band of 10 must reach the same proportion
as the cell bar: ≥9/10 per band** for find (27/30 = 90%), identity
(27/30 = 90%), and expression (26/30 ≈ 87% → 9/10, since 8/10 = 80%
is below the proportion). **Any band below 9/10 in any cell is a
cell FAIL, whatever the pooled count says.** Band verdicts are
reported per cell in the results file, next to the pooled count —
never instead of it, never only as a study-wide average.

**A plain-language note on what these numbers mean (UX researcher
nit 1):** at n=30 the bars are **acceptance rules, not population
estimates**. A 27/30 pass is consistent with a true find rate
anywhere in a wide range (Wilson 95% confidence interval
≈ 74–97%) — the test does not prove "90% of all children will find
Holmes". And because the gate requires **every** cell to pass,
the art in practice needs a true rate well above 90% to have a
good chance of clearing all twelve cells at once. Read a pass as
"this art met the pre-committed rule", not as a measured
population percentage.

If the gate fails: the `pairArt` flag stays off, the current pair
stays in the game, and the scores go into the results file so the
next art round knows exactly what to fix.

## 8. Recording the results

Results live in **`docs/pair-art/KIDTEST_RESULTS.md`** — that file,
not chat messages and not the trial manifest.

1. After each sitting, copy the scoring sheets into the results
   file's raw table (one row per trial, same fields as section 6).
   Use child codes only — **never a child's name or photo**.
2. When a cell is complete (30 children), fill in its summary rows:
   passes out of 30 for find and identity (plus the confusion count
   for identity), passes out of 30 for **each** expression slice
   (character × emotion), and — for every one of those — the three
   age-band counts out of 10 and the first-exposure count (must be
   30/30 first-exposure; flagged observations are replaced, §1).
3. Write the verdict per cell in plain words: `PASS` or `FAIL`, and
   if `FAIL`, which line it crossed — **including a band-floor
   failure (§7): a cell whose pooled count passes but whose 6–8
   band is below 9/10 is a `FAIL`, recorded as such.**
4. The final verdict for the whole gate goes at the top of the file:
   **GO** only if every cell passed **and** the automatic measures
   (size, face, zero coverage) passed at every width. Otherwise
   **NO-GO**, with the failing cells listed.
5. Commit the results file on the PR D branch. The numbers in the
   file are the numbers that were counted from the sheets — if a
   sheet is lost or a count is unsure, write that down next to the
   number instead of tidying it up.
