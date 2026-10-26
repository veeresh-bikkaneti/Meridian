# Branch status — fix/e2e-191-214

Issues: #191 (tap-storm test un-passable by construction) + #214 (E2E pin for the greeting path on keyboard / screen-reader). Both are E2E-only; no production code changes.

## #191 — tap storm budget arithmetic
- [x] Verified first-hand: 12 + 10 catch-and-continue clicks at a 5s per-click timeout ≈ 110s of worst-case timeout burn vs the 90s budget in `playwright.config.ts`. Pure harness arithmetic — the panel's failure snapshot showed a healthy page; no production bug is masked by this fix.
- [x] Per-click timeout 5,000 → **1,000ms** on both loops, counts kept at 12 + 10. No assertion weakened: click results were always discarded; every real assertion sits after the loops with its own timeout. Worst-case burn is now ~21s ( ~66s+ of headroom). Why not 500ms: it buys nothing needed and risks the one click that must succeed (the first State click) on this serialized, RAM-tight VM.
- [x] Figure loop also gains `force: true`: the figure's breathing animation defeats Playwright's stability check, so the 10 clicks were timing out *undelivered* and the loop proved nothing. The sibling home-visual-layout pin force-clicks the figure for the same reason. Named in a comment in the spec.
- [x] Inline comments in the spec carry the arithmetic and the honest scope note (delivered storm = 1 State click + 10 figure taps).

## #214 — keyboard / screen-reader greeting pin
- [x] New spec `tests/e2e/home-greeting-keyboard.desktop.spec.ts` (desktop project, no config change). Fresh first-visit profile, sound seeded off for a deterministic text-phase bubble, assets-manifest response awaited before the first keypress, Tab counts never hard-coded (`tabUntil` walks with a focus trail).
- [x] Test A: Tab to the figure (asserts `:focus-visible`), Enter dismisses the invite + starts the greeting; bubble is role=status with a non-empty caption, inside the viewport; dismiss is announced as "Dismiss the storyteller's greeting", measures 44×44px, is Tab-reachable; Enter dismisses it and focus returns to the first edition control (asserted on `document.activeElement`); no trap afterwards.
- [x] Test B: the invite's own "Not now" button via Space releases the greeting; Space-dismissal + focus return pinned the same way.
- [x] Honest limits documented in the spec header: `viaKeyboard` is hard-coded `true` in the dismiss onClick (focus return also fires for pointer dismissal — the pin proves the keyboard outcome, not a modality split), and there is no Escape-to-dismiss for the home bubble.
- [x] `home-visual-layout.desktop.spec.ts` header: the "pointer only" limit line now points at the new pin.

## Pending
- [ ] Gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`
- [ ] E2E (sequential, `--workers=1`, via the VM-wide flock): motionmaxxing + home-greeting-keyboard + home-visual-layout (regression neighbour)
- [ ] PR opened (no merge — owner merges)

## Notes
- **No test budget change**: the 90s global budget in `playwright.config.ts` is untouched; the fix is inside the test's own arithmetic.
- Coordinator D (QA & Performance + Narrative squad); #193 = PR #256, #200 = PR #257, #199 = PR #259.
