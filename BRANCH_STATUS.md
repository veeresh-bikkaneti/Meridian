# BRANCH_STATUS.md — feat/ko-fi-footer

## Active work
- [x] Ko-fi tip-jar footer (Game Designer v1)
- [x] Refactor: hardcoded IDs → build-time env vars (Veeresh 2026-10-07)
- [x] tsc clean, 837/837 unit, 6/6 footer E2E, 10/10 comet E2E
- [x] Dual-build proof: fail-closed without env, tags render with env
- [x] GitHub Secrets wired in pages.yml
- [ ] Veeresh: add 3 secrets in GitHub Settings → merge PR #90

## Env vars (set in GitHub Settings → Secrets and variables → Actions)
- VITE_GA4_MEASUREMENT_ID
- VITE_CLARITY_PROJECT_ID
- VITE_KOFI_URL
