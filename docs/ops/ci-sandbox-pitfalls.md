# CI and sandbox pitfalls

Things that cost time in the cloud agent container and in CI, observed
2026-10-22 to 2026-10-27 while doing the weak-VM e2e work
(`docs/reviews/2026-10-22-weak-vm-e2e-posture.md`). They are observations, not
guarantees: the sandbox and GitHub change, so re-check before relying on one.

## Dependencies

- **`npm ci` fails with `EUSAGE ... Missing: <pkg> from lock file`** on
  Dependabot branches. Fix: `npm install --package-lock-only`, then check
  `git diff package.json`. npm tends to widen the manifest range unasked;
  revert that with `git checkout HEAD -- package.json` and redo.
- **`npm install` can crash** with `TypeError [ERR_INVALID_ARG_TYPE]: The "from"
  argument must be of type string` inside arborist's reify. `--package-lock-only`
  avoids it.
- A stale `node_modules` after merging `main` can lack a newly added package
  (seen: `@cloudflare/vite-plugin`). One `npm ci` fixes it; never `npm install`.

## GitHub and CI

- **GitHub does not start `pull_request` workflows on a PR that conflicts with
  its base.** A conflicted PR silently gets no `build` or `e2e`. If checks are
  missing on a fresh push, test for a conflict first
  (`git merge-tree --write-tree origin/<branch> origin/main`). Syncing with
  `main` restores CI.
- **`BRANCH_STATUS.md` is the usual conflict.** It changes on almost every merge
  to `main`, so a long-lived PR conflicts again and again.
- **`Workers Builds: meridian` fails on every PR head** (owner-ruled ignorable)
  and passes on nearly every `main` commit. Its `started_at` equals
  `completed_at` on passing builds too, so the zero duration means nothing. The
  failing record carries no error text; the log is behind the dashboard link.
- **The job-log API returns only the tail** of a job, usually the cleanup steps.
  To see a failing assertion, download the `playwright-report` artifact.
- **`expect.poll` takes the assertion text as its `message` option**
  (Playwright 1.63): `.poll(fn, { timeout, message })`.

## Container limits

- **Branch deletion may be refused** (the proxy returned HTTP 403). Try
  `git push origin --delete <branch>`; if refused, name the leftover branch in
  the report and let the owner delete it in the GitHub UI.
- **A force-push can be denied** by the agent permission classifier. A lease
  pinned to the old tip (`--force-with-lease=<branch>:<sha>`) is the safe form;
  the owner must authorize it first.
- **`meridian.knowledgetest.workers.dev` is unreachable** from the container
  (proxy 403), so live header or behaviour probes cannot be re-run. Do not claim
  live verification you did not perform.
- The Cloudflare connector has no tool that reads Workers Builds logs, even when
  it is connected.

## Timing

- The full scout spec set (22 tests) takes about 3.3 minutes locally. The single
  weak-device test that runs in CI takes about 17 s.
