# BRANCH_STATUS.md — fix/grandpa-mug-focus

**Branch:** `fix/grandpa-mug-focus` (from origin/main)
**Task:** Veeresh's final change (2026-10-07) — remove grandpa's head movement, make the coffee mug the attention-grabber.

## Done
- [x] Removed ALL pointer-tracking from grandpa (TSX): deleted gaze constants/helpers (`DEAD_ZONE_PX`, `SECTOR`, `HEAD_OFFSETS`, etc.), the tracking `useEffect`, sector state/refs, `data-tracking` attribute, and the inline head/pupil transforms. Head is fixed, facing the viewer.
- [x] New attention-grabber: `.seated-mug-gesture` group (arm + mug) does a gentle invite flourish every ~6s (`mug-invite` keyframes: lift + slight rotate/scale, then settle) plus a synchronized `.mug-puff` steam puff (`mug-puff` keyframes).
- [x] Kept: slow walk, halfway cheers beat, chair finale, continuous steam, donation bubble ("Help me buy coffee! / Grown-ups — donations keep Meridian free for kids"), tap→"Ask a grown-up" gate→Ko-fi.
- [x] `prefers-reduced-motion`: `.seated-mug-gesture` + `.mug-puff` in the `animation: none` list; head fixed; bubble shown statically.
- [x] E2E updated: desktop eye-tracking test → "head stays still + mug invites" (pupils have no inline transform after pointer sweeps; `mug-invite` applied; bounding-box travel ≥2px over one 6s cycle). Reduced spec: no `data-tracking` attr, gesture animation "none".
- [x] Quality gates: `tsc` clean · unit 837/837 · `lint-cards.mjs` GATE PASSED · `build:pages` green · E2E 9/9 desktop + 2/2 reduced + 3/3 mobile (one mobile flake on first run, green on two reruns — bubble-opacity timing, unrelated).
- [x] Pushed, PR opened.

## Pending
- [ ] Veeresh merges the PR (CI: GitGuardian + build).
