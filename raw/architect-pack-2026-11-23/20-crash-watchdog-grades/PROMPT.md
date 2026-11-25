# 20 — Crash-report watchdog: severity grades (rung 2)

## Intent (one line)
Add severity grading / auto-triage to the live crash-report watchdog, so boot-failure reports arrive pre-sorted by how many players they affect and how badly.

## Why (origin)
The watchdog itself shipped: an inline ES5 fallback in `_shell.html` shows "The game couldn't start on this phone" with a report button when the bundle never boots, feeding the observability pipeline through a CORS-enabled Cloudflare Worker receiver — no email or secrets in client code (PR #347, merged and live). Rung 2 (auto-triage design) was designed but its grades still await the owner's crash-worker upload.

## Scope IN
- Severity grades on incoming crash reports per the rung-2 auto-triage design (in this folder).

## Scope OUT
- Any email addresses or secrets in client code (standing exclusion).
- Changing the shipped watchdog's player-facing fallback.

## Locked decisions
- Reports feed the existing observability pipeline; the receiver is a dedicated CORS-enabled Worker.
- The remaining step is operational, not design: the owner uploads the crash worker; grades activate with it.

## Acceptance criteria
- A test crash report lands graded end-to-end (fallback → worker → pipeline) with the grade visible where the owner reviews reports.

## Assets & related work (in this folder)
- `GOAL.md` — the watchdog goal record (#347 merged/live; grades await upload).
- `rung-2-auto-triage-design.md` — the severity/auto-triage design to implement.

## Open questions for the architect
1. Is the rung-2 grading scheme (as designed) the right severity model for a low-volume kids' game — or over-built for the report rate?
2. What retention/privacy posture should crash reports from children's devices carry?

## Status & evidence
- Watchdog live since PR #347 (2026-11-05 record). Severity grades: designed, awaiting the owner's crash-worker upload since then.

**Update 2026-11-23 (pack v2):** the grades now exist in code on main — `workers/crash-report` implements severity grades S1–S3 (`severityOf`, issue #345; its README documents severity tiers + grades), and PR #560 made the crash smoke fail when a binding or trigger is missing. What this review cannot verify from the repo is whether the current worker build is the one deployed. The owner's remaining step is therefore a deploy verification, not an upload of missing code.
