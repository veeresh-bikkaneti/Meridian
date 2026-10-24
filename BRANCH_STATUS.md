# BRANCH_STATUS — fix/a11y-confirmed-findings

**Branch:** `fix/a11y-confirmed-findings`
**Base:** origin/main @ `c9cba12` ("docs: on-device AI story text decision
memo (WI-5) (#216)")
**State: FIXES COMPLETE — all gates run; push BLOCKED on auth (see
below).** Tier 1 Solo
TDD fixes for the axe-confirmed accessibility findings from the
2026-10-24 launch audit + live axe scan (reports:
`meridian-launch-technical-audit-2026-10-24.md`,
`meridian-scan-a11y-axe-2026-10-24.md`). It supersedes the previous
contents of this file (the `fix/footer-row-alignment` branch record,
whose history lives on its own PR).

## Scope (exactly this — no drive-by changes)

1. **F1 contrast (WCAG 1.4.3)** — the contact form's validation error
   list uses `text-red-700` (#b91c1c): 2.66:1 on the dark `--surface`
   (audit, source tokens), 2.92:1 measured live on `--bg`. Fix: a
   theme-aware `--error` token following the `--gold-ink` pattern —
   dark `#f1948a` (the value `age-profile.css` already uses for gate
   errors under `[data-theme="night"]`), light `#b91c1c` (the current
   value; already ≥4.5:1 on every light surface, so light rendering is
   unchanged). `contact.tsx` switches to `text-error`.
2. **listitem** — `<ul role="alert">` strips the list role, so its
   `<li>` children trip axe's `listitem` rule in the same error state.
   Fix: the alert role moves to a wrapping `<div>`; the `<ul>` stays a
   list. (Codebase pattern: `role="alert"` lives on `<p>`/block
   wrappers, never on a list.)
3. **label-content-name-mismatch (home, WCAG 2.5.3)** — the grandpa
   bubble-ask button's `aria-label` omits its second visible line,
   "Your support keeps Meridian free for kids". Fix: the accessible
   name now contains both visible lines verbatim, in order, keeping the
   existing trailing guidance sentence.
4. **Investigation only** — GrownUpGate's "×" cancel button was marked
   `label-content-name-mismatch` *incomplete* ×1 by axe on /contact's
   gate state. Determination + evidence in the delivery report
   (`meridian-a11y-fixes-2026-10-24.md`); no code change.

## TDD record

- `src/a11y-regressions.test.ts` (new; source-guard idiom of
  `security-headers.test.ts` / `bounded-text.test.ts`): **RED on the
  base — 10 tests, 1 pass / 9 fail.** The only pre-fix pass is "the ask
  button has an aria-label".
- After the fixes: **GREEN — 10 tests, 10 pass / 0 fail.**

## Gates (this branch, run at head `a91b844`)

- `npx tsc --noEmit` — exit 0, no output.
- `npm test` — exit 0. Scripts suite: 834 tests, 825 pass / 0 fail /
  9 skipped. Src suite: 1489 tests, 1489 pass / 0 fail (includes the
  10 new a11y-regression guards).
- `node scripts/lint-cards.mjs` — exit 0, prints `GATE PASSED`.
- `npm run build:pages` — exit 0 (also exit 0 with `VITE_KOFI_URL`
  set, as the E2E specs require).
- Playwright E2E, targeted specs only (`grownups-privacy-contact`
  desktop + grandpa-coffee-run desktop/mobile/reduced; 17 tests):
  **15 passed, 2 failed.** Both failures are animation-timing
  timeouts in the grandpa walk specs (desktop: scene beat never
  reached "kettle" within 12 s; reduced: `comet-mascot` bounding box
  timeout at 180 s). **Baseline check: the identical 2 tests fail
  the same way on pristine base `c9cba12`** (9 passed / same 2 failed
  in the two-file run) — pre-existing failures on this VM, not
  regressions from this branch. First E2E attempt aborted at spec
  load because `VITE_KOFI_URL` was unset; the runs above set it for
  both build and test, per the specs' own header.
- Full gate detail: delivery report `meridian-a11y-fixes-2026-10-24.md`.

## Push status — BLOCKED

- `git push -u origin fix/a11y-confirmed-findings` fails:
  `remote: Invalid username or token. Password authentication is not
  supported for Git operations.` The `gh` token on this VM is invalid
  and SSH is reset by the egress proxy. The branch is **local-only**
  in `~/workspace/meridian-a11y-fixes/` until the owner supplies a
  fresh one-time token. All commits are safe locally.

## Pending

- Push (blocked on auth, above).
- Owner's review word. No PR, no merge, no deploy from this branch —
  those wait for the owner.
