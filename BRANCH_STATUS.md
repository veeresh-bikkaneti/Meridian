# BRANCH_STATUS.md — feat/pwa-wiring

PWA wiring for Meridian (GitHub Pages static build). Base: `origin/main` @ `7593a87`.

## Done
- [x] App icons generated: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- [x] `public/manifest.webmanifest` (static, BASE_URL-aware)
- [x] `public/sw.js` — cache-first shell, offline fallback to `offline.html`, SKIP_WAITING on message only
- [x] `public/offline.html`
- [x] `src/lib/pwa.ts` — prod-only registration, background waiting-update detection, non-blocking prompt (Later/Update), reload only after player choice, never interrupts active games
- [x] `src/routes/__root.tsx` — static manifest + apple-touch-icon links via `import.meta.env.BASE_URL`; `PwaUpdateToast` mounted
- [x] `scripts/grok-pwa-plugin.mjs` — under `GITHUB_PAGES=1`, strips only dead `/__grok/manifest.webmanifest` + `/__grok/icon-180.png` links; preserves all other injected branding/OG content
- [x] Plugin regression tests: 49/49 pass (dev keeps `/__grok/` links, Pages strips them)
- [x] `npx tsc --noEmit` clean; `npm run build:pages` succeeds
- [x] `dist/client/` verified: manifest, sw.js, offline.html, icons present; no `/__grok/manifest.webmanifest` in built shell
- [x] External PWA kit URLs (genspark) returned HTTP 403 via direct fetch — implementation recreated from verified requirements
- [x] Kit re-attempt via browser text-fetch: still HTTP 403 access-denied — kit is not retrievable; will document in PR (live-browser attempt left for parent agent if desired)

## Pending
- [x] Focused unit tests for `src/lib/pwa.ts` (13 tests: waiting detection, prompt-once, no auto-reload incl. first-claim case, unmount cleanup) — all pass; added to `npm test`
- [x] Kit retrieval attempt via live browser (likely still 403; then document in PR)
- [x] Technical-architect review: NEEDS-CHANGES — both P1s fixed: (1) first-visit reload already fixed via updateRequested gate + regression test; (2) per-build sw.js fingerprinting via __BUILD_ID__ + fingerprint-sw.mjs (postbuild:pages), 4/4 script tests; P2s fixed (toast copy differentiated, res.ok guard); P3-5 noted as theoretical
- [x] Tone/docs/accessibility review: approve-with-notes — all notes fixed (role=status on <p>, "Update now", focus to <main> on dismiss, offline :focus-visible, README PWA section, base ref); E2E 5/5 re-verified
- [x] Playwright E2E on built Pages artifact: 5/5 green (registration + no bounce, toast + no auto-reload, Update reloads once, game survives with score, offline shell fallback)
- [x] Fixed product bug found by E2E: controllerchange reloaded on ANY control change (incl. first-install claim) — now reloads only after player taps Update
- [ ] Fix review findings, re-verify (unit + E2E)
- [ ] Rebase onto latest `origin/main`, open PR, merge if all gates green
