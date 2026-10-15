# Run report — 2026-10-13 (orchestrator run, branch claude/hopeful-darwin-dp7ket)

## Consolidated
Merged `perf/globe-tier-split` (#150) and `chore/remove-unused-deps` (#149) into this branch. **Close #149 and #150 as "folded into #148"** (GitHub already shows #150 as merged because its commits are in this branch's history). `feat/scout-offer-accept-sticky` (PR #151, Scout fix 60abd46): D6 was blank, so it was left alone. I did not close PRs or delete branches.

## Workstreams
| ws | result |
| --- | --- |
| step 0 review of 62895ea + 192b2d8 | Opus ARCH: BLOCK (stale places in one commit when the Globe learning path changes). Fixed; regression E2E failed 3/3 before, passes now. |
| step 0 kill switch `globeTierSplit` | code default false (= full pool, same order as main); shipped true in `public/flags.json` in its own commit 70fa14c |
| in-run start notice | added after a UX BLOCK (silent failure of an offline "Try Medium"); UX re-review APPROVE-WITH-NITS |
| WS-0 test harness, WS-2 social previews, WS-3 Scout toggle in Globe, WS-4 satellite failure path, WS-5 home weight, branch audit (WS-7/8) | **not started** |
| WS-6 reports | done: `docs/ops/specs/ws-6-names-json.md`, `docs/ops/specs/ws-6-ios-signals.md`, final summary in `docs/perf-baseline.md` |

Pipeline: Sonnet architect wrote the spec; Opus plan review x2 (round 2 BLOCK, fixed); Haiku worker passes 1-2 + fix round + commit-2 pass; Haiku QA (red-first, then updates); Opus diff reviews (ARCH and UX); Opus UX re-review. No escalation to a Sonnet worker was needed. One real bug was found by QA (focus ring defeated by `outline-none`).

## Numbers (commands in docs/perf-baseline.md)
`node scripts/perf-globe-easy.mjs --runs 5`, 4x CPU + Slow 4G: first interactive question 23,134 -> 14,359 ms; JS on the wire 2,730,330 -> 1,335,353 B; heap 70.99 -> 60.42 MiB; home ready 5,103 -> 5,045 ms (unchanged).

## Flags
`globeTierSplit`: code default `false`; `public/flags.json` `true` (commit 70fa14c).

## Gates
See BRANCH_STATUS.md. Playwright: 515 passed / 94 failed / 19 skipped; 93 of 94 failures also on a main-equivalent build (run in this VM, Chromium 141). Your brief listed three known failures; this VM has about 93 because of the older Chromium and missing tile/GPU behaviour. The brief's `/opt/meta-chromium/chrome` path was absent; I symlinked it to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (outside the repo, not committed).

## Owner decisions / actions
- D1 Clarity secret removal, D3 satellite handling (default was set), D4 home layout, D5 branch cleanup, D6 where the Scout fix goes: blank, so nothing done.
- Close #149 and #150 (folded in); decide #147/#151.
- Copy the table from `docs/scout-offer-policy.md` (on #151's branch) into the charter once #151 lands.
- Cloudflare `Workers Builds: meridian` is red on every PR (0-second runs, no log): check the Workers Builds project settings in the Cloudflare dashboard.
- Real-device checks: offline Easy -> "Try Medium" on a phone; iOS.

## Not verified / not reproduced
Real devices; GitHub Pages / Cloudflare transfer sizes (hosts blocked); iOS; WS-3's Scout-toggle report from the owner's Chrome (not attempted).
