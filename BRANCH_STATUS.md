# BRANCH_STATUS.md — crash-investigation (P0)

**Branch:** `crash-investigation` · **Base:** `origin/main` @ `eee96c8`
**Incident:** Veeresh on iPhone Safari gets "A problem repeatedly occurred on https://veeresh-bikkaneti.github.io/Meridian/" (iOS killed the web content process) when entering **Arkansas** (state edition). Crash repeats on reload. Last good game: country edition on the pre-#38 build.

## Done
- [x] Worktree created at `~/workspace/meridian-worktrees/crash-investigation` on `crash-investigation` @ `eee96c8` (replaced stale endgame-share BRANCH_STATUS.md inherited via the #40 merge)
- [x] `node_modules` symlinked from sibling worktree (no download)
- [x] System Chromium located at `/opt/meta-chromium/chrome` for Playwright repro
- [x] **Repro (Chromium): NO REPRO** — full Arkansas flow (picker → US → Arkansas → answer → next), mobile viewport, tile-stubbed, cold load 60s: no crash, no hang, no pageerror. Heap peaked ~50MB, GC'd clean. `1152076` equally clean → not a #38/#39/#40 regression in desktop Chromium.
- [x] **Data audit: CLEAN** — all 177 Arkansas records valid; all 64 chunks zero anomalies; Arkansas bounds sane; manifest consistent.
- [x] **Live site: CLEAN** — build-meta `eee96c8185d4` == origin/main; assets all 200; sw.js current (not stale).
- [x] **PRs #38/#39/#40 ruled out on the entry path** — question-label returns bare name for state edition before touching Intl; line-clamp is CSS; share never loads in entry path.
- [x] **Intl.DisplayNames `fallback:"none"` ruled out** — unknown options are ignored per ECMA-402, never throw; a throw would be a JS exception, not a process kill; runs at boot for all editions (not Arkansas-specific).
- [x] **JS-engine differences ruled out** — exceptions are contained by try/catch; cannot kill the WebContent process.
- [x] **Confirmed crash-loop amplifier** (`src/components/game-app.tsx`): `commit()` persists `meridian.run` to sessionStorage BEFORE the game screen mounts; the mount effect auto-restores any resumable run; no error boundary around `Play`. Any mid-flight process kill → reload replays the identical heavy path → killed again = "repeatedly occurred".
- [x] **State-differentiated suspects identified** (his last good game was country): S1 projection-swap racing the 2.4s flyTo (code's own comments flag the risk); S2 admin1 boundary band at z≥6 (state settles 6.5, country 5.0) — 1.2MB JSON + topojson + 4 layers at narrow completion.
- [x] Incidental real defect found (NOT the crash): intermittent React #418 hydration error + post-reload tap stall; predates #40; sibling worktree `fix/reload-reveal-restore` already covers this area — not duplicating.

## In progress
- [ ] **Fix: crash-loop breaker** — pagehide-gated clean-exit flag: `writeRun` stamps `meridian.cleanExit="0"`; `pagehide` stamps `"1"`; the mount-restore effect skips auto-resume (clears the stale run, lands on menu) when the flag is `"0"` (previous page died without unloading). Missing flag = clean (preserves pre-update runs). Normal reloads keep the intentional resume behavior.

## Pending
- [ ] Fix through full gates (unit, typecheck, build, both reviews, E2E) → PR → merge → live verification
- [ ] Phone-side isolation steps for Veeresh (in final report): cold-load test, Arkansas-specificity (Nebraska? country on current build?), update-toast involvement, private-tab test (disables SW + no resume), close-all-tabs memory test, iOS version
- [ ] Follow-ups (NOT this fix): S1/S2 map-timing hardening needs iOS repro first; latent `boundsFor` degenerate `[0,0,0,0]` fallback; boundary layers painting over gold highlight (layer-name mismatch); React #418 hydration (other crew's area)

## Rules
- Minimal crash fix only. No game-behavior, scoring, or data changes beyond the fix.
- Push early and often; stage named files only, never `git add -A`.
