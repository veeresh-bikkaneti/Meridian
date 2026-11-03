# BRANCH_STATUS — feat/band-motion-locked-tile

- **Branch:** `feat/band-motion-locked-tile`
- **Base:** `main` @ `5dc21b9` (rebased 2026-11-03 onto #307 + #299;
  originally cut at `5e77827` (#304); tile-relevant files verified
  unchanged since `685a94f`, see PR body)

## Task capsule

TASK / requested outcome: Little Explorer (5–7) GeoDetective locked
tile gains the sleeping-detective film the owner approved as mocked
(2026-11-03, "use them"): a picture band on top of the tile, two slow
breaths, then the picture rests on the resting still. Plus the
pre-existing hover-lift fix for the locked tile. Stop at PR open.
NO MERGE without the owner's per-PR word.

Tier and rationale: Tier 2 shape (new component + new media + CSS in
three files), run as a builder silo under the coordinator's brief;
independent Silo QA and the 12-role panel follow as separate silos.

Done condition / evidence: film encoded ≤ ~400 KB with region-motion
numbers (lamp ≈ 0, torso > 0 at breath peaks, ≈ 0 in the final
second, first frame == resting frame == last frame); gates green
(tsc, npm test, lint-cards, build:pages); home/age-band E2E run
sequentially under the shared lock, with the same specs run on
unmodified main as control; band-switch row-height parity measured;
captures in `~/workspace/meridian-band-port-evidence/`.

Files in scope: `src/components/age-profile/LockedLoop.tsx`,
`src/components/age-profile/LockedTileFilm.tsx` (new),
`src/components/age-profile/age-profile.css`, `src/styles.css`
(hover fix only), `src/assets/home-v5/geodetective-locked-{film,poster,still}`
(new), `src/assets/home-v5/locked-tile-media.ts` (new),
`src/components/age-profile/locked-tile-film.test.ts` (new),
README home-cards paragraph, this file.
Protected / untouched: `card-film.tsx`, `card-media.ts`,
`home-v5.css`, `game-app.tsx` (LockedLoop mounts the film itself;
the locked branch in game-app.tsx stays byte-identical).

Approvals: branch + PR are the assigned task. Merge: owner only.

## Status

- [x] Clone at `5e77827`, branch cut, tile-file drift vs `685a94f` checked
- [x] Film built (region-frozen composite from the resting still,
      mock grade baked in) — final encode 355,210 B
- [x] Rebased onto `main` @ `5dc21b9` — BRANCH_STATUS conflict
      resolved by hand, both records kept in this file
- [x] Component + CSS + media module
- [x] Unit tests
- [x] Gates (tsc / npm test / test:worker 85/85 / lint-cards /
      build:pages) — all exit 0 on the pre-rebase tip (app code
      identical after the rebase; the rebase touched only
      BRANCH_STATUS, security.txt, and two E2E specs). npm test:
      943 pass + 11 skip / 954 and 1978/1978. Region MAD (encoded
      film, vs frame 0; Silo QA re-measured): lamp 0.134, window
      0.043, torso peak 13.15, final second torso ≤ 0.02 /
      window 0.044
- [x] E2E home + age-band, branch vs main control — capture spec
      3/3 (row parity 561.16 px both bands, Δ 0.00; hover no-lift;
      reduced-motion still-only); age-profile-gate +
      home-visual-layout pass; card-redesign split-order pair
      passed on rerun after browser-crash failures under load
      (the VM rebooted mid-run); globe-band-switch pair fails
      identically on unmodified main — pre-existing, not this
      branch
- [x] Captures: film, settle still, band-switch geometry, side-by-side
      (sealed in `~/workspace/meridian-band-port-evidence/`)
- [x] PR open (no merge) — PR #328, https://github.com/veeresh-bikkaneti/Meridian/pull/328
- [x] Silo QA PASS — PR #328 + aa8c2ab, 10/10 items (evidence:
      `~/workspace/meridian-band-port-evidence/qa-silo/`)
- [x] Panel on aa8c2ab — 3 APPROVE / 8 APPROVE-WITH-NITS /
      1 BLOCK (Office Hours, record-only) · DevEx PASS-WITH-NITS ·
      Benchmark PASS (worst delta +0.72% vs the 5% gate)
- [x] Record cure (PR body + this file: QA-measured MAD values,
      poster wording, WCAG wording, garbled comment edited in
      place) + Office Hours re-confirmation — CONFIRM APPROVE on
      the corrected record at `f467bb1`. Re-key check PASS; CI
      green on `f467bb1` (build / GitGuardian / e2e).
- [x] **READY — PR #328, verdict keyed to `f467bb1`** (this commit
      is records-only, on top of the keyed tip). Verdict record:
      `~/workspace/meridian-band-port-evidence/panel/VERDICT-RECORD.md`.
      Merge waits for the owner's per-PR word.

## Sandbox media prep (no repo commits; PR #324 owns the card slots)

- [x] Unit 2 — LE Cold Trail ping-pong encode in evidence/media-prep
      (349,224 B, 12 s; seams: join 0.30, loop 4.05)
- [x] Unit 3 — Trail Scout Review take in evidence/media-prep
      (attempt 1 held identity: settle MAD 20.67 vs the shipped
      still, zero invented text; no re-time fallback needed)
      — prep-complete only: slot-size re-encode + its own QA/panel
      still owed after PR #324 READY

---

# Prior records preserved on rebase: main @ 5dc21b9

> Everything below this line is main's BRANCH_STATUS content at
> `5dc21b9`, kept verbatim on the rebase so no prior branch record
> is lost. The active record for this branch is above.
- 2026-11-03: merge-up onto main `a5591b3` (#309) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's app code is byte-identical to the READY tip. Checks re-read on the new tip before merging.

---

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
- [x] Gates sealed (resume crew, 2026-11-02 — the first crew died in a
  daemon restart after pushing `b10a636` with no gates run; this crew
  reconciled the branch as sound — base still current main, diff
  comment-only — re-verified every claim from source, and ran the
  gates): tsc 0 · npm test 0 (scripts 850 pass / 11 skipped; src
  1879/1879; 0 fail) · test:worker 0 (85/85, repo AGENTS.md gate) ·
  lint-cards GATE PASSED · build:pages 0 ·
  built-output grep: `dist/client/.well-known/security.txt` carries
  "stored:true" + "held by Discord", no "parked" · extra pin:
  `static-wellknown.test.mjs` 4/4, non-comment lines byte-identical to
  main. Logs: `~/workspace/meridian-issue-wave/evidence/301/`
  (first npm-test run's session was reaped before its exit file
  wrote; its complete log is kept as `npm-test.attempt1.log` and the
  gate was re-run clean for the sealed exit). E2E not run —
  deliberate: comment-only change to a static text file, no
  behaviour for E2E to exercise.
- [x] PR opened (no merge) — see PR link in the finish heartbeat
- 2026-11-03: merge-up onto main `5dc21b9` at the owner's merge word. security.txt auto-merged clean (only main's Expires 2027-11-01 from #299 added; this PR's comment refresh byte-identical). BRANCH_STATUS conflict resolved keeping both records. Checks re-read on the new tip before merging.

---
