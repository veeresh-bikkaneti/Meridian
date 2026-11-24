# Motion-verify captures

Generated captures (screenshots and screen recordings) used to verify
motion by eye. They are produced locally and are **not stored in git**.

Regenerate them with:

  node scripts/record-motion-verify.mjs

The read-aloud modal captures are produced on demand by the env-gated
capture test in `tests/e2e/read-aloud-modal.desktop.spec.ts`
(`CAPTURE_MODAL=1`).

The `*.png`, `*.mp4`, and `raw-webm/` files in this folder are ignored
by git; only this README is tracked.
