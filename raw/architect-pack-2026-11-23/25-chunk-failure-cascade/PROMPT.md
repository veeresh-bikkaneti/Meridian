# 25 — Chunk-failure cascade fix (GeoDetective path)

## Intent (one line)
Fix the cascade where one failed lazy chunk on the GeoDetective path takes down more than itself — a stale-deploy/chunk-load failure should degrade to the friendly update prompt, not a dead game.

## Why (origin)
**Owner's direct order, 2026-11-04: "Fix the chunk-failure cascade."** A coordinator lane was dispatched to deliver a READY PR through the full pipeline. The lane then went silent — for about 16 days — and no PR ever arrived. The owner caught the omission himself on 2026-11-20 when auditing the open-ticket register ("silent for about 16 days with no PR").

## Scope IN
- Diagnose the cascade on the GeoDetective path: which chunk failures propagate, and why the existing guarded-reload / stale-deploy handling ("A new version of Meridian is available." + Refresh, owner-approved 2026-10-01) doesn't catch this path.
- Fix + full-pipeline PR (the original order's terms).

## Scope OUT
- Silently absorbing the failure: the player-facing behaviour on an unrecoverable stale chunk stays the approved update prompt.

## Locked decisions
- Stale-deploy handling is settled (update prompt + one-tap Refresh) — the fix extends that contract to the uncovered path; it does not redesign it.
- Meridian's PWA update prompt (2026-10-12) is part of the same contract family.

## Acceptance criteria
- A sabotage test: break the chunk on purpose in a staging build; the GeoDetective path shows the approved prompt and recovers on Refresh — no dead end, no cascade.
- Full pipeline verdict on the exact tip before merge is even requested.

## Assets & related work
- Brief-only folder: the evidence is the order + the dead lane's record (coordinator agent, created on the owner's 2026-11-04 word, last activity ~16 days before the owner caught it; a zombie "running" record still sits on the board). Related shipped work: `fix-chunk-skew-guarded-reload` (branch-status record on main) covers the sibling path.

## Open questions for the architect
1. Where should chunk-failure containment live — router level, per-route error boundary, or the service-worker/update layer — so the NEXT path can't reintroduce the cascade?
2. What monitoring would have surfaced a 16-day silent lane? (Process question, but the architect's answer shapes the fix's evidence requirements.)

## Status & evidence
- **CLOSED in product — update 2026-11-23 (pack v2).** The v1 record ("ordered 2026-11-04; lane died; no PR") was superseded by two merges:
  - **PR #532** (`5ae217c9`, "Fix the stale-tab chunk crash: the error boundary reloads itself onto the fresh build, once") fixed the actual cascade: the two recoveries deadlocked — the auto-reload handler deferred to the error boundary's stale-offer card, and the card only offered a manual Refresh tap, so a player who never tapped was never recovered, and healed skews still filed crash reports. The boundary now issues the guarded one-time reload itself (`attemptGuardedChunkReload()` in `src/lib/chunk-recovery.ts`, stamp-verified, one per episode), and chunk failures are reported only when they repeat after the reload. Behaviour-proven on the built artifact: deploy-rotation case → exactly one reload, GeoDetective loads on the fresh shell, no crash report; persistent 404 → no loop.
  - **PR #567** (`489cf864`) fixed the reload counting in the e2e helper (it double-counted the router's same-document `replaceState`): one episode now counts as one document reload; expected counts unchanged.
- Residue, moved to #26: the chunk-recovery e2e spec's test 13-E was failing identically on clean main as of 2026-11-22 (Phase 1 sweep record) — a test-side failure, not the product cascade.
- No re-dispatch is needed. The architect question changes from "fix approach" to: is the one-reload-per-episode guard the right permanent policy?
