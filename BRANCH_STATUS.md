# BRANCH_STATUS — fix/pre-flip-challenge-hardening

- **Branch:** `fix/pre-flip-challenge-hardening`
- **Base:** `origin/main` at `ab21c1c` (2026-10-28 — PRs #274 friend challenges, #275 high-contrast, #277 status record all merged)
- **State:** ROUND-2 CURE COMPLETE — panel round 1 returned NOT READY (3 BLOCKs, one root cause: the new fallback `<pre>`s did not wrap the challenge URL — §3). The wrap cure is implemented with RED→GREEN evidence (§2), all gates re-run green on the cured tip `f8d3495` (§3), and CI is green on that exact tip. Panel re-vote on the cured tip is the next step; merges and the flag flip wait on its READY verdict under the owner's renewed authorization (2026-10-28): "Finish it: cure the wrap, re-vote, merge, flip, verify live".
- **Task:** Pre-flag-flip hardening for `friendChallenges` (PR #274 follow-up list, `CURE-274-FINAL.md` Remaining items 2, 1, 3). Owner's order (2026-10-28): "Flip friend challenges ON — pre-flip fix first, then the flag". This branch is the "pre-flip fix first" half; the flag flip itself is a separate follow-up PR (`chore/flip-friend-challenges`) that ships only if this PR's panel verdict is READY and it merges.
- **Out of scope (owner's design call, untouched):** Remaining item 4 — `w:1` fame flattening at the share deal site.

---

## 1. What this branch changes

1. **Share-failure fallback on both challenge ShareButtons (Remaining item 2 — must-fix before flag flip).**
   Neither challenge share button passed `failureFallback`, so when the share sheet and the
   clipboard both failed, the button read "Copy manually" while the challenge URL existed
   nowhere visible — a dead end. Both now render the selectable-text fallback the app already
   uses for its other shares:
   - `src/components/run-summary.tsx` — the summary's share-a-challenge button gets the same
     `<pre>` block (same classes) as the score share directly above it; the share text is built
     once into `challengeText` so button and fallback can never drift apart.
   - `src/components/game-app.tsx` — `ChallengeComplete`'s re-share button gets the themed
     `<pre>` block (the GeoDetective share's classes); its text is likewise built once into
     `challengeText`.

2. **E2E: notice × resume combination pinned (Remaining item 1).**
   New test in `tests/e2e/friend-challenge.desktop.spec.ts`: flag ON + corrupt `#c=` link +
   a resumable saved run → the run resumes, the boot notice is absent for the whole run and
   the summary screen, and it surfaces on return Home with `CHALLENGE_CHILD_COPY` in its
   `role="status"` region (deferred, not lost — exactly the behaviour the cure record
   described; no production code change was needed).

3. **E2E hardening: seeded-profile readback (Remaining item 3).**
   `seedYoungBandProfile`'s catch comment claimed a blocked `setItem` makes the seeded test
   fail; the truth is the opposite (unset profile = x1.0 band = the 800 km pin misses either
   way, so the freeze test would pass vacuously). The comment now says so, and the new
   `expectSeededYoungBand` readback asserts the seeded `meridian.ageProfile.v1` parses back
   with band `"5-7"` inside the 800 km miss test.

4. **Round-2 cure: the fallbacks wrap (panel round-1 BLOCK).**
   Both new `<pre>`s carried `whitespace-pre-wrap` but no `overflow-wrap`, so the ~200-char
   challenge URL (one ~150-char unbroken run) stretched them to 1,334–1,474px of scroll
   width at a 390px phone viewport and overflowed the page — the "Copy manually" state the
   fix created was itself a dead end on a phone (WCAG 1.4.10). Both `<pre>`s now carry
   Tailwind's `wrap-anywhere` (`overflow-wrap: anywhere`) — the treatment `.share-pre`
   exists for in `styles.css`, applied as the equivalent property because `.share-pre`
   also sets border/background/color for the result-card surface and would override these
   two blocks' deliberate themes. Two new E2E tests pin rendered widths at a 390px
   viewport (one per surface): the `<pre>`'s `scrollWidth` must fit its `clientWidth`, and
   the document must not scroll horizontally past the viewport.

## 2. TDD evidence (tests first, predicted signatures)

New/changed tests were run against the UNMODIFIED build first (`npm run build:pages` on
`ab21c1c` sources + the new spec):

- "challenge completion share falls back…" — **RED, predicted signature:** button reached
  "Copy manually" but no `<pre>` fallback existed (`element(s) not found`).
- "summary share-a-challenge falls back…" — **RED, same signature** at the fallback
  visibility assertion.
- "corrupt #c= link over a saved run … defers the boot notice until Home" — **GREEN**
  (behaviour already correct; the test pins it).
- 800 km miss test with the new readback — **GREEN** (seed lands; freeze proof intact).

After the fix, all friend-challenge tests pass (full gate run in §3).

**Wrap cure (round 2), against the uncured build of this branch:**
- Both new 390px wrap tests — **RED, predicted signature:** the completion surface's
  `<pre>` measured scrollWidth 1334 vs clientWidth 318; the summary surface's 1474 vs 306
  (raw log preserved: `~/workspace/meridian-flip-reports/e2e-wrap-red.log`; a first attempt
  whose completion test died in gameplay — the harness's `commitMiss` taps a fixed desktop
  point outside a 390px viewport — is preserved as `e2e-wrap-red-attempt1.log`, and the
  test now resizes at the completion screen, where the wrap is pure CSS at the current
  viewport).
- After the `wrap-anywhere` cure — **GREEN:** both wrap tests pass
  (`e2e-wrap-green.log`).

## 3. Gates + review record

- Environment: Node v24.22.1 local (CI 22.x is canonical); Playwright bundled chromium-1243;
  E2E sequential under `flock ~/workspace/.e2e.lock --workers=1`.
- Gates on the fix (local, Node 24):
  - `npx tsc --noEmit` — PASS (clean).
  - `npm test` — PASS: scripts 850/850, src 1753 pass / 0 fail.
  - `npm run test:worker` — PASS: 85/85.
  - `node scripts/lint-cards.mjs` — PASS: GATE PASSED.
  - `npm run build:pages` — PASS (entry chunk 445,738 B).
  - Playwright E2E, touched surfaces — friend-challenge spec **10/10 PASS** (incl. all 3 new
    tests). The neighbouring endgame-share spec's 2 tests fail in this VM with
    `ERR_TUNNEL_CONNECTION_FAILED` — and fail **identically on unmodified main `ab21c1c`**
    in a paired run (this VM's Chromium cannot tunnel any external fetch; pre-existing
    environment failure, not a regression). CI (22.x) is the canonical reader for that
    spec; its verdict lands on this PR's checks.
- Panel round 1 (on `0a8d0a0`): **NOT READY — 3 BLOCKs, one root cause** (the unwrapped
  fallback `<pre>`s, §1 item 4), measured first-hand in headless Chromium by two seats
  (ChallengeComplete `<pre>` clientWidth 318 / scrollWidth 1,499; document scrollWidth
  1,520 at both 390px and 1280px). Everything else passed: 11 seats APPROVE / AWN /
  PASS-with-nits, CSO CONFIRMED ×2 (codec, fail-closed decode, store isolation
  byte-unchanged), benchmark PASS (entry chunk +0 B). Full record:
  `~/workspace/meridian-flip-reports/FIX-REPORT.md`.
- Gates re-run on the cured tip `f8d3495` (local, Node 24): tsc PASS ·
  `npm test` PASS (scripts 850 pass / 11 skipped of 861; src 1753/1753) ·
  `test:worker` PASS (85/85) · lint-cards GATE PASSED · `build:pages` PASS (entry chunk
  445,738 B — +0 B vs the uncured tip) · friend-challenge E2E **12/12**: one run went
  11/12 when the desktop completion-fallback test hit the 240s test timeout under VM
  load (no assertion error); its sequential re-run passed (3.7m) — contention flake per
  the AGENTS.md evidence rule, logs `e2e-full-cured.log` + `e2e-test689-rerun.log`.
- CI on the exact cured tip `f8d3495`: build (22.x) PASS · e2e PASS · GitGuardian PASS
  (the Workers Builds check fails on this branch as it does on every branch including
  main-based ones; it is not a required context and this diff touches no worker/build
  config).
- Panel re-vote on the cured tip: PENDING (this record is written before it runs).
- Merge: conditional authorization in the owner's orders (2026-10-28, as relayed) — merge
  only if the panel verdict is READY with CI green on the exact final tip and a fresh
  check read immediately before merging; otherwise stop and report. The same renewed
  authorization covers the follow-up flag-flip PR and live verification.
