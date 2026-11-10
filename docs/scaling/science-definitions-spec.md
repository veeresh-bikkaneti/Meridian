# Science Definitions — Specification

**Branch:** `feat/science-definitions`
**Workstream:** WS3 of the Meridian scaling-plan push (P4 + P6 + P7)
**Status:** PREPARED — AWAITING EDUCATOR SIGN-OFF
**Date:** 2026-11-10
**Base:** `origin/main` @ `f37dea50`

> This file is the scope contract for the three science definition briefs on
> this branch. It is docs/briefs only — no code, no implementation, no UI code
> anywhere on this branch.

## 1. What this branch is

Meridian is a free browser geography game
(repo https://github.com/veeresh-bikkaneti/Meridian). Scaling it into a K-12
platform is a **CONDITIONAL GO for definition work and Phase 0 only**
(council verdict 2026-11-07). Subject feature branches are **NOT GO** — no
agent builds any subject game. This branch produces definition briefs only.

The three briefs on this branch:

| Brief | File | Packet |
|---|---|---|
| P4 — Algebra applied in physics | `docs/scaling/p4-algebra-physics-brief.md` | P4 |
| P6 — Chemistry, small honest scope | `docs/scaling/p6-chemistry-brief.md` | P6 |
| P7 — Science map (world that responds) | `docs/scaling/p7-science-map-brief.md` | P7 |

Sources for these briefs (read first, cited in each brief):

- `~/workspace/meridian-scaling-lens-breakdown.md` §3 (P4), §5 (P6), §6 (P7)
- `~/workspace/meridian-scaling-work-packets.md` P4, P6, P7 entries
- `~/workspace/meridian-scaling-spec-breakdown.md` §3 P4/P6/P7 entries

## 2. Scope — in

- Three definition briefs, each carrying: topic map, judging rule,
  machine-verification gate, and what a named educator must sign (listed,
  not signed).
- P6's FIRST deliverable, researched, not assumed: how much chemistry US
  schools teach per band, grounded in live sources (NGSS / state standards).
- The P4/P7 physics split, agreed in writing as a definition statement
  (P4 = algebra applied to physics quantities; P7 = predict-what-happens
  forces/motion). The split is a definition claim both packets record; it is
  not a build decision.
- Every research/factual claim carries a live web source (URL + date
  accessed) or an explicit confidence level (HIGH / MEDIUM / LOW with the
  evidence that earns it). A claim without one is not done.
- Open owner questions recorded as open, never settled.

## 3. Scope — out (hard stops)

1. **No merges, no PRs, no force-push.** Merging stays the owner's word per
   PR per head.
2. **No game/feature code of any kind.** No implementation, no UI code, no
   mockup code, no test code on this branch.
3. **No educator sign-off.** No educator exists; nothing in these briefs is
   "approved". Every brief is marked **PREPARED — AWAITING EDUCATOR
   SIGN-OFF**. Never write "approved".
4. **No invented scope.** Where the source material has no answer (e.g. a
   band assignment with no curriculum citation), the brief records it as
   OPEN / UNVERIFIED and does not guess.
5. **No settling owner questions.** Open questions are recorded with their
   decider named; the briefs do not decide them.
6. **No touching `~/workspace/meridian-main`'s working tree.** It sits on
   another branch with pre-existing state. This branch lives in its own
   worktree, `~/workspace/scaling-ws3-science`.

## 4. What counts as done

- [ ] This spec file committed and pushed to `feat/science-definitions`.
- [ ] Three briefs delivered, one per packet (P4, P6, P7), each containing:
  - Topic map (per band, with a curriculum citation per band or an
    explicit UNVERIFIED flag where none exists).
  - Judging rule stated precisely enough that a test could walk it
    (right answer / wrong answer / near-miss / equivalent-form cases
    where applicable).
  - Machine-verification gate: what is checked, against what source, and
    what failure looks like.
  - Educator sign-off list: the exact items a named educator must sign in
    writing, listed, not signed.
  - Readiness-audit four points assessed honestly (demonstrated / not
    demonstrated / blocked).
  - Open questions recorded with decider.
- [ ] P6's US-school chemistry scope answer researched from live sources
  (NGSS performance expectations per band + state-adoption caveat).
- [ ] P4/P7 physics split recorded in both briefs.
- [ ] Every brief marked PREPARED — AWAITING EDUCATOR SIGN-OFF.
- [ ] Branch and files verified on the remote before reporting
  (`git ls-remote` / `git status`).

## 5. Verification block

Verification rule (Meridian standing rule, from the lens breakdown §0
forcing rule, applied to definition work): before any question in a brief
is answered, (1) a live web search grounds the answer — answering from
memory alone is forbidden; (2) every key fact carries a named site source
(URL + access date) or an explicit confidence level HIGH / MEDIUM / LOW;
(3) any fact with no source is recorded UNVERIFIED and never asserted;
(4) time-sensitive facts are re-checked against a current source.

**Sources used (accessed 2026-11-10):**

- NGSS performance expectations PS1 (Matter and Its Interactions), via
  California Dept. of Education content-standards listing
  (https://www2.cde.ca.gov/cacs/science) — 2-PS1-3 (grade 2), 5-PS1-1
  (grade 5), MS-PS1-1/2/5/6 (grades 6–8), HS-PS1-1/2/5 (grades 9–12).
- NGSS adoption: ~20 states adopted outright, ~24 more use Framework-based
  standards; 44 states have implemented standards influenced by the
  Framework and/or NGSS (NSTA, "Ten Years of NGSS", 2023;
  https://www.nsta.org/science-and-children/science-and-children-marchapril-2023/ten-years-ngss-where-are-we-now).
- US science curriculum by band (TIMSS 2015 Encyclopedia, US chapter;
  http://timss2015.org/encyclopedia/countries/united-states/the-science-curriculum-in-primary-and-lower-secondary-grades/):
  upper-elementary physical science = states of matter and their
  properties, classifying materials; middle school = changes of state,
  solutions, simple chemical reactions; National Science Education
  Standards progression from macroscopic observation (elementary) to
  atoms/molecules/formulas (high school).
- Common Core mathematics, Expressions & Equations domain
  (http://www.thecorestandards.org/Math/Content/EE/): 6.EE (one-variable
  equations x + p = q, px = q), 7.EE (equivalent expressions, multi-step
  equations px + q = r, p(x + q) = r), 8.EE (linear equations, systems),
  8.F (functions defined, evaluated, compared, used to model).
- NGSS life/earth science per band (InnerOrbit NGSS standards index;
  https://prometheus.innerorbit.com/ngss/standards/ and California grade-5
  DCI document): 5-LS1-1 (plants get materials chiefly from air and
  water), 5-LS2-1 (movement of matter in food webs), 5-ESS2-1/2 (Earth
  systems, water distribution), MS-LS2-1/2/3 (ecosystem resources,
  interdependent relationships, cycling of matter/energy),
  MS-ESS2-4 (water cycle driven by sun + gravity).
- Physics formulas (standard textbook relations; source checked
  2026-11-10): v = d/t (average speed), F = m·a (Newton's second law),
  KE = ½mv², W = F·d, PE = m·g·h
  (https://www.toolscoops.com/2025/10/physics-formula-calculator-free-online.html).

**Confidence note:** NGSS is the reference curriculum for these briefs
because it is the national framework most states use or adapt — but it is
NOT universal: Texas and a few other states use their own frameworks, and
adoption depth varies. Every NGSS citation below is therefore a HIGH
confidence claim about *the NGSS*, and a MEDIUM claim about *what a given
child's school teaches*. The educator who signs must confirm the
jurisdiction. A web search grounds facts; it does not certify a
curriculum — that is the educator's signature, and it does not exist yet.

## 6. Gates each brief must clear before any build (recorded, not cleared)

Per the packets, each of P4/P6/P7 is GATED. Build needs, in each case:

- P2 landed (P7 additionally needs P2's simulation spike to exist and the
  shell contract to hold against it).
- P4 additionally needs P3 landed.
- This branch's definition signed by a named educator (in writing).
- The readiness audit's four points demonstrated (curriculum + topic map;
  machine-verifiable judging; correctness without an LLM near the data;
  core verb a child gets just by looking).

**None of these gates is cleared by this branch.** This branch only
prepares the definition that the educator would sign.

## 7. Open owner questions (recorded — not settled here)

| # | Question | Decider | Status |
|---|---|---|---|
| Q1 | Educator + curriculum: who is the named educator/SME, and which curriculum is the reference? | Owner | OPEN — no educator exists; no curriculum is named by the owner. NGSS is used in these briefs as the research reference only, not as a decided curriculum. |
| Q3 | Equivalent-form judging: is `2x + 6` the same as `2(x + 3)`? | P1 definition + educator | OPEN |
| Q11 | Science spike authorization (P2 simulation spike that P7 depends on) | Owner only | OPEN |
| Q14 | Lazy-load guardrail | Owner | OPEN — no written answer from the owner |
| Q15 | Passport (per the task brief) | Owner | OPEN — no written answer from the owner |
| P8 gate | P8's gate names v3 but the keeper is v4 — does the owner's listen-approval of v4 satisfy the gate? | Owner | OPEN — recorded here because it affects the scaling plan's gate language; not this workstream's to resolve |
| Constitution-first | Constitution-first ordering is conditional — if a single-jurisdiction constitution clears audit before math, build order changes | Owner / council | OPEN (conditional, not a commitment) |
| P4/P7 split | Is the split "P4 = algebra applied to physics quantities; P7 = predict-what-happens forces/motion" agreed? | Definition (both packets) | RECORDED as the agreed definition statement in both briefs; a build-time agreement is still owed when/if either packet builds |

## 8. Branch hygiene

- Named files only when staging — never `git add -A`.
- Commit early, push often; the first commit is this file so the branch
  exists on the remote.
- No other worktree touched. `~/workspace/meridian-main` left alone.
