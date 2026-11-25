# 26 — Test debt on main: endgame-share, detective flakes, Pages workflow

## Intent (one line)
Clear the known red/flaky tests that sit on clean main, so a green suite means the game works — and stop a permanently failing workflow from crying wolf on every push.

## Why (origin)
Each item was proven against clean main (not against a branch), so none of them is any feature's regression. Together they erode the one signal every gate depends on. Standing owner rule: a green check that skips or flakes past a test is worse than a red one; every test must actually be registered.

## Scope IN (the three debts)
1. **endgame-share e2e** — FAILS standalone on clean main (`cef9af3c`, verified); intermittent in CI. Wants its own small fix lane.
2. **Detective flakes** — detective-endings POUT test (intermittent timing flake, #371 family); detective-stations audio flake; detective-sound test (f) dual-mount flake (pre-existing on main, noted at the hosts council 2026-11-06).
3. **GitHub Pages workflow** — fails on every push to main because GitHub Pages is NOT enabled for this repo (the live site is Cloudflare Workers). Removing the workflow was offered; unanswered.

## Scope OUT
- Weakening any test to make it pass (Silo QA law: never weaken a test; one flake rerun max).
- Enabling GitHub Pages as the "fix" — the deploy target is Cloudflare; the workflow is dead weight.

## Locked decisions
- Pre-existing debt is labelled as such in every PR that touches it — a feature lane never silently inherits or hides it.

## Acceptance criteria
- endgame-share passes standalone, repeatedly, on clean main.
- Each detective flake is either fixed at its timing/root cause or quarantined with a named issue and an owner-visible record — never silently retried into green.
- Pages workflow removed (on the owner's word) or explicitly kept with a reason on record.

## Assets & related work
- Brief-only folder: evidence lives in the session record (standalone failure verified on `cef9af3c`; flake families #371; Pages failure is pre-existing infra noise on every main push).

## Open questions for the architect
1. Triage order: which debt most endangers the next real gate (the landmark panel, item 14, will run detective-adjacent suites)?
2. For the audio flakes: is the root cause test-harness timing or real audio scheduling in the game — and how would you prove which before touching either?

## Status & evidence
- **Update 2026-11-23 (pack v2) — partially cured, item by item:**
  - *endgame-share:* one named cause cured — PR #557 (`d7eae370`) stopped the home globe throwing on a null shader info log; its own record states that throw "fails the end-game share e2e". Whether the spec now passes standalone was **not re-run in this review** — status: partially cured, unverified. Not closed.
  - *detective flakes:* no cure found. The Phase 1 sweep (2026-11-22) recorded detective-sound, storyteller-audible, and tap-pending (R + W) failing identically on clean main — pre-existing, still open.
  - *chunk 13-E:* joins this list from #25 (product fixed by #532/#567; the e2e test itself fails on clean main).
  - *Pages workflow:* `.github/workflows/pages.yml` is still on main @ `5930e930` — not killed. The removal still needs the owner's word.
- Still open as a bundle; the endgame-share verification and the flakes still need a lane / the owner's word.
