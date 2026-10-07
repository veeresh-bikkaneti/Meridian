# BRANCH_STATUS.md — feat/ko-fi-footer

## Active work
- [x] SupportFooter component (footer colophon + disclaimer, offline-hidden)
- [x] "Ask a grown-up" interstitial (native dialog, backdrop/Esc dismiss)
- [x] Wired into Chart Room home view
- [x] E2E: 6/6 green (support-footer.desktop.spec.ts)
- [x] tsc clean, unit 837/837, build:pages green
- [ ] PR open — Veeresh merges

## Context
Veeresh 2026-10-07: implement Game Designer's Ko-fi v1 UX.
Hard rules: no audio, no analytics, no Comet involvement, no gating,
plain <a> hardcoded URL, offline-hidden. Clean/minimal per Veeresh directive.
