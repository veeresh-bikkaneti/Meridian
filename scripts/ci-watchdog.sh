#!/usr/bin/env bash
# Re-runs main-branch workflow runs that were starved of GitHub-hosted runners.
#
# Incident it prevents: 2026-10-05, runs #37371985732 / #37371985856 sat queued
# ~15 min ("The job was not acquired by Runner of type hosted even after
# multiple attempts") and were auto-cancelled — zero code fault.
#
# Safety rules (never re-run these):
#   - a run containing ANY job with conclusion=failure (genuine code failure)
#   - a cancelled run WITHOUT the runner-acquisition annotation (manual cancel, other infra)
#   - a run that already had 2 auto re-runs (attempt >= MAX_ATTEMPT)
#
# Env: REPO (owner/repo, required), WINDOW_MIN (default 60), MAX_ATTEMPT (default 3).
# Needs: gh CLI authenticated with actions:write (GITHUB_TOKEN on the runner).
set -euo pipefail

REPO="${REPO:?REPO env required (owner/repo)}"
WINDOW_MIN="${WINDOW_MIN:-60}"
MAX_ATTEMPT="${MAX_ATTEMPT:-3}"
ACQ_MSG="not acquired by Runner"

cutoff=$(date -u -d "$WINDOW_MIN minutes ago" +%Y-%m-%dT%H:%M:%SZ)

mapfile -t candidates < <(gh run list --repo "$REPO" --branch main --limit 30 \
  --json databaseId,conclusion,attempt,createdAt \
  --jq -r --arg cutoff "$cutoff" --arg max "$MAX_ATTEMPT" \
  '.[] | select(.createdAt >= $cutoff
                and (.conclusion == "cancelled" or .conclusion == "failure")
                and (.attempt < ($max | tonumber)))
          | "\(.databaseId) \(.conclusion) \(.attempt)"')

reran=0
for line in ${candidates[@]+"${candidates[@]}"}; do
  read -r run_id conclusion attempt <<< "$line"
  genuine=false
  starved=false
  while read -r job_id job_conclusion; do
    if [ "$job_conclusion" = "failure" ]; then
      genuine=true
    fi
    if gh api "repos/$REPO/check-runs/$job_id/annotations" --jq '.[].message' 2>/dev/null \
        | grep -qF "$ACQ_MSG"; then
      starved=true
    fi
  done < <(gh api "repos/$REPO/actions/runs/$run_id/jobs" --jq -r '.jobs[] | "\(.id) \(.conclusion)"')

  if [ "$genuine" = true ]; then
    echo "SKIP $run_id: contains a genuine job failure — never auto re-run"
    continue
  fi
  if [ "$starved" != true ]; then
    echo "SKIP $run_id: no runner-acquisition annotation (manual cancel or other cause) — never auto re-run"
    continue
  fi
  echo "RERUN $run_id (conclusion=$conclusion attempt=$attempt): starved of runners"
  gh run rerun "$run_id" --repo "$REPO"
  reran=$((reran + 1))
done

echo "watchdog done: re-ran $reran run(s)"
