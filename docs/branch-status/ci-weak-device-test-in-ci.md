# Branch status — ci/weak-device-test-in-ci

PR 265 (draft). Run the weak-device check on every PR. Keep the 3D map-mount test local.

## Done

- Merged `origin/main` `2bd5ee96`. The workflow conflict was one insertion after `npm run build:pages`. Kept main's `npm run check:entry-size` step and this branch's `@local-only` comment.
- The e2e step still runs `tests/e2e/scout-harness-suppression.desktop.spec.ts` with `--grep-invert @local-only`. Test 1 (map mount) stays `@local-only`. Test 2 (weak VM auto-switches to Scout) runs in CI.

## Next

- Owner decides whether to merge the draft. Do not strengthen the CI runner. Test 2 needs the real SwiftShader device to read as weak.

## Open questions

- Workers Builds on the previous tip failed outside GitHub Actions. See the report for that log.

## Ruled out

- Do not drop `@local-only` to make the map-mount test pass in CI.
- Do not remove `check:entry-size`.

## Graph

No nodes.
