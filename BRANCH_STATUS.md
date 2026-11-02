# Branch status — chore/224-security-txt-renewal

- **Branch:** `chore/224-security-txt-renewal`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For #224 (Meridian issue-clearing wave,
PR W3) — renew `public/.well-known/security.txt` by setting a fresh
`Expires`, prove the backstop test passes, and open the PR.

Tier and rationale: Tier 0 — config / discovery file, one line, no
locked or owner-approved copy changed.

Done condition / evidence: `Expires` is `2027-11-01T00:00:00.000Z`;
both `Contact` lines byte-identical to main; `node --test
scripts/static-wellknown.test.mjs` green with sealed log + `.exit`
under `~/workspace/meridian-issue-wave/evidence/224/`; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `public/.well-known/security.txt` (one line) +
this file. Out of scope: everything else.

## What changed and why

- `Expires: 2027-10-01T00:00:00.000Z` →
  `Expires: 2027-11-01T00:00:00.000Z` — a fresh full year from this
  wave (2026-11-02), inside the backstop test's bound (in the future
  and at most one year / 366 days out) with margin.
- The file's own renewal comment names no date — it only says to
  renew `Expires` before it passes — so no comment change was needed.
  Verified: the old date `2027-10-01` occurred only on the Expires line.
- Both Contact lines are unchanged, byte-identical:
  `https://meridian.knowledgetest.workers.dev/contact` and
  `https://github.com/veeresh-bikkaneti/Meridian/security/advisories/new`.

## Contact-channel verification (2026-11-02)

- [x] `GET https://meridian.knowledgetest.workers.dev/contact` →
  HTTP 200 — re-run by this build crew on 2026-11-02.
- [x] GitHub private vulnerability reporting → enabled — API-verified
  by the coordinator on 2026-11-02 (cited, not re-derived here).

## Next renewal expectation

- **Renew before `2027-11-01T00:00:00.000Z`.** That is the new expiry
  set by this PR; the backstop test
  (`scripts/static-wellknown.test.mjs`) fails once it is in the past
  or more than a year out, so the next renewal should set a date
  within one year of that renewal run.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/224/`)

- [x] Gate: `static-wellknown.log` / `static-wellknown.exit` (=0) —
  `node --test scripts/static-wellknown.test.mjs` green.

## Redundancy audit

- One file, one line: `security.txt` is the single RFC 9116 discovery
  file; this renewal adds no duplicate path, control, or entry point.
  PASS.

## Status

- [x] Expires renewed to 2027-11-01T00:00:00.000Z
- [x] Contact lines verified unchanged; /contact re-checked (HTTP 200, 2026-11-02)
- [x] Backstop test green, sealed
- [x] PR opened against main (For #224, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only
- [ ] Next renewal — before 2027-11-01T00:00:00.000Z (see above)
