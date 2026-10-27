# BRANCH_STATUS — veer-c/adoring-volta-ql18ja

**State: DRAFT — docs-only (Tier 0). Adds the owner's ARCHETYPE v3.0 "law"
verbatim as `docs/ops/ARCHETYPE_law.md`. No source, test, config or
`AGENTS.md` is touched. Awaiting the owner's word on how it sits beside the
Constitution and `agent-council-protocol.md` (Pending, below).**

**Base:** origin/main @ `d509268` (the #154 item 5 docs fix). **Rebased onto it
2026-10-27** at the owner's order, replacing five merge commits with one clean
commit. Opened on `62b960a` (PR #229's merge); main then moved 30 commits. This
file was the only thing that ever conflicted, so the rebase resolved it once:
this record on top, main's current record intact below. Owner's choice (2026-10-22): "Adopt as governing
law + commit". The text is committed byte-for-byte as pasted, with its
`{{YOUR_TASK}}` CONFIG placeholders unfilled: they are a template slot to fill
per task.

## Done
- [x] `docs/ops/ARCHETYPE_law.md` added, verbatim (70 lines; key rules spot-checked).
- [x] Gates, last run locally 2026-10-26 on main `5f24c6c` + this docs change
      (the rebase onto `d509268` brings in only main's own already-merged code;
      CI re-runs on the rebased head, see the PR checks): `npx tsc --noEmit` clean · `npm test` scripts **832 pass / 0 fail /
      9 skip**, src **1,633 pass / 0 fail** · `node scripts/lint-cards.mjs`
      **GATE PASSED** · `npm run build:pages` green · `npm run test:worker`
      **85/85** · `npm run typecheck:worker` clean. No tracked file dirtied by
      the build. (Run by a `haiku` gate-runner; the clean-tree and
      lockfile-untouched claims were re-checked independently. The runner hit a
      stale `node_modules` missing `@cloudflare/vite-plugin`, which arrived with
      main, and fixed it with one `npm ci`; `package.json` and the lockfile are
      identical to main.)
- [x] Not run locally: Playwright E2E. The change has no source surface, and
      protocol §6 scopes Playwright to "the specs that cover the changed surface".
      CI runs the `e2e` job on the merged head.

## Pending — the owner's call
- [ ] **Where the law sits.** This PR does not edit `AGENTS.md` or
      `docs/ops/agent-council-protocol.md`. In this repo the protocol says "the
      Constitution in `AGENTS.md` governs throughout", which I read as the law's
      own "System Invariants" tier. Replace, sit beside, or fold in is undecided.
- [ ] **Overlaps with the existing protocol** (read from both files, not assumed):
      - Seats: the law adds Councilor D (Historian) and a Layer-3 execution team;
        protocol §1 has Chair + A/B/C only, requires C to be a separate agent,
        and fixes models (opus Chair, sonnet/haiku councilors).
      - Tiers: law T1/T2/T3 are **risk**-based (security/payments/auth);
        `AGENTS.md` Tier 0/1/2 are **scope**-based and convene a council only at Tier 2.
      - Budget: law caps `MAX_TOKENS: 15k/task`; protocol §3 controls cost with the
        tier gate and sets no cap.
      - Manifest: law has "Scoped Files (max 3)" and Token GRANTED/DENIED;
        protocol §5 has protected files, "max +/- N lines" and `AUTH_RUN_TDD_IMPLEMENTATION`.
      - Versioning: the law's Loop 3 mutates to "Archetype v1.1"; versioned
        copies would collide with Constitution rule 2 (no duplicate files).
- [ ] **Found on review at merge time (2026-10-26), not in the table above.**
      Read from the law and the current `AGENTS.md` / protocol; the law is left
      verbatim, so these are for the owner to rule on, not edits:
      - Precedence: the law ranks `System Invariants > Council Protocol > Task
        Config > User Request`, so the **User Request ranks last**. `AGENTS.md`
        says "an owner-set tier overrides this table", and the Constitution is
        the owner's standing word. Adopting the law as written would let the
        council protocol outrank an explicit owner instruction.
        **RULED (owner, 2026-10-27):** "You are debating that my word over
        rulebook while we both say the same thing?" Read as: no conflict, so
        merge as is. Nothing is added to `AGENTS.md`, and the law is untouched.
      - Councilor C: the law requires "3 failures, 2 scope creeps, 1 simpler
        alternative". Protocol §1 lets C end with `NO OBJECTION`. A fixed quota
        invites invented findings when there are none.
      - Layer 3 team ("Security, Consent, Accessibility, SMS, Email, QA
        Verifier") and the DAG example (`RLS`, `Email`, `Consent`, `Chat`) read
        like a different product. Meridian is a children's quiz with no
        user-account backend; those seats do not map to it.
      - `AGENTS.md` gained a **Worker roles run on the cheapest capable model**
        rule (PR #219, merged after this PR was opened). The law's Layer 3
        execution team says nothing about model tier.
      - Vote "3/4 + Chair veto" is ambiguous with Chair + Councilors A-D: four
        councilors, or four of five seats?
- [ ] An earlier, different "ARCHETYPE v3.0" (seats A-E, 7 phases, per-tier token
      budgets 6000/3000/1500) was pasted in the same session. It is superseded by
      the owner's choice above and is **not** committed here.

---

*The record below is main's `BRANCH_STATUS.md` as of this rebase
(`fix/154-item6-manual-full-tile-failure`). It is kept unmodified; this branch's own
record is the section above. When this PR was opened the record here was
`fix/serverfn-server-entry` (#229), which main has since replaced four times.*

# BRANCH_STATUS — fix/154-item6-manual-full-tile-failure

**Branch:** `fix/154-item6-manual-full-tile-failure`
**Base:** `origin/main` at `9345b4c` (2026-10-27, synced with PR #263 and PR #197 / #154 item 1 merged on `main`)
**State: CORRECTED + BUILT (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 3 of 3. Not merged —
merge is the owner's word.

> **Correction (2026-10-26, after the first push):** this branch
> originally added a new WS-4 E2E leg for item 6. A deeper
> verification pass then found the scenario ALREADY pinned on main
> (see item 6 below) — the added leg was substantially duplicative
> and has been **withdrawn** (the ws4 spec is byte-identical to
> main again). What remains is the one genuinely open remainder:
> item 5's stale comment, in its mutated form. The branch name is
> kept (renaming would orphan the PR); its content is now item 5.

## Scope: #154 items 1–7 (item 1 is now merged on `main` via PR #197 / `16ec9b3`)

Verification against `origin/main` (`16ec9b3`), file/line
evidence. Final verdicts:

| Item | Status on main | Evidence |
| :--- | :--- | :--- |
| 1. Production test seam (`__meridianSuppressScoutOffer`) | FIXED (`16ec9b3`, PR #197) | Seam removed from `src/components/game-app.tsx`; harness spoofs device signals in `tests/e2e/helpers.ts`; inverted pin in `src/map/capability.test.ts` (L456-465) and E2E pin in `tests/e2e/scout-harness-suppression.desktop.spec.ts` |
| 2. Stale decay comment | FIXED | The filed comment is gone; game-app boot comments (L1281-1305) and capability.ts L181-183 state the post-#151 / post-2026-10-20 rule |
| 3. `planBootMapMode` dead `stored` param | FIXED | Signature is `planBootMapMode(decision)` (capability.ts:322); docstring L299-305 explicitly records the item-3 resolution; unit pins cover both branches |
| 4. Offer dialog `aria-describedby` | SUPERSEDED | `scout-boot-offer.tsx` returns 404 on main — the dialog was removed by the 2026-10-20 silent-auto-switch ruling; capability.test.ts pins that it must not come back |
| 5. motionmaxxing stale comment | **STILL OPEN (mutated) — FIXED BY THIS BRANCH** | See below |
| 6. Declined-offer + WS-4 coverage gap | **ALREADY FIXED on main** | `scout-capability-offer.desktop.spec.ts`: "settled manual full → WS-4 tile failure: visit switches to scout, manual record untouched" — seeds manual full, aborts tiles, pins the Try-again card, the session-only switch, the untouched record, and the switch note; its header cites the #154 item-6 lineage. (An earlier pass missed this test; the duplicate leg added for it was withdrawn — see the correction note.) |
| 7. No unit test for accept→`accepted=true` | SUPERSEDED | The accept path no longer exists at all; its successor pin is capability.test.ts "game-app wiring: boot applies the plan's persistSource as an auto record", plus auto-record-no-accepted-flag and legacy-accepted-never-decays tests |

## Item 5, mutated form (what this branch changes)

The filed phrase ("the VM boots in scout map mode") is gone, but
its replacement comment in `tests/e2e/motionmaxxing.spec.ts`
(L180-185) is itself stale post-2026-10-20: it says the failed
WebGL probe "raises the Scout Map choice dialog instead of booting
into scout silently; the session starts in full mode either way."
There is no dialog anymore, and unpinned this VM would now boot
into Scout SILENTLY. The helper it describes (`forceFullMapMode`)
is still correct — only its explanation was wrong. This branch
rewrites that one comment to describe the silent auto-switch
ruling and why the manual pin is still needed. Comment-only;
no behavior change.

**Diff (whole branch vs main):**
`tests/e2e/motionmaxxing.spec.ts` (one comment) + this file.

## Gates (synced with `origin/main` `16ec9b3`)

- [x] `npx tsc --noEmit && npm run typecheck:worker` — clean (exit 0)
- [x] `npm test && npm run test:worker` — scripts 832 pass / 9 skip / 0 fail (841 total), src 1670 pass / 0 fail, worker 85 pass / 0 fail
- [x] `node scripts/lint-cards.mjs` — `lint-cards: GATE PASSED`
- [x] `VITE_KOFI_URL=https://ko-fi.com/meridian npm run build:pages` — exit 0
- [x] Playwright E2E against built artifact:
      - `scout-capability-offer.desktop.spec.ts`: **13/13 passed** (including #154 item 6 test)
      - `scout-harness-suppression.desktop.spec.ts`: **2/2 passed** (#154 item 1 test)
      - `ws4-tile-fallback.desktop.spec.ts`: **3/3 passed**
      - `grownups-privacy-contact.desktop.spec.ts`: **3/3 passed**
      - `hydration-boot.desktop.spec.ts`: **1/1 passed**
      - `observability.spec.ts`: **3/3 passed**
      - `motionmaxxing.reduced.spec.ts`: **6/6 passed**
      - `motionmaxxing.spec.ts`: **5/6 passed** — including M5, the test that uses `forceFullMapMode` (the helper whose comment changed). The one failure is the pre-existing "tap storm" test: 90 s test-timeout on this contended VM; it never calls the helper, the branch diff is comment-only (zero runtime surface), and tap-storm pacing is a known test-budget problem (tracked as #191).

## Out of scope

- #154 item 1 / PR #197 (production test seam) — now merged on `main` as `16ec9b3`.
- No merge, no branch-protection changes.
