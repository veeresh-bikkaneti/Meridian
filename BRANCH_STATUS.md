# BRANCH_STATUS — feat/challenge-mc2-package-a

- **Branch:** `feat/challenge-mc2-package-a`
- **Base:** `origin/main` at `b09a5c3` (PR #281 merged). No rebase needed yet; if the external End-game PR lands first, this branch rebases and this file resolves keeping both records accurate.
- **State:** **BUILT — in verification.** Package A of all-editions friend challenges. Owner ruling 2026-10-28 adopted all council recommendations: Package A first (staged), GeoDetective/Cold Trail OUT, scoring-cliff tripwire test now, NO "Beat my misses".
- **Governing manifest:** `.council/manifests/2026-10-28-challenge-all-editions.md` — committed FIRST on this branch (`8ecc976`), before any implementation.
- **What shipped on this branch:**
  - mc2 codec (`#c=mc2.`, keys exactly {v,e,r,rad,s,ids,seed}, FNV-1a seal over v+e+r+rad+s+ids) beside the frozen mc1; strict per-version decoders behind the `#c=` catch-all; a pinned radius is honoured only within ±10% of the receiver's computed radius for the named region (Globe exactly 750).
  - Golden back-compat proof: 3 REAL mc1 links captured from the shipped build's own UI (fixture `src/game/__fixtures__/mc1-captured-links.json` with provenance), plus a frozen 64-region radius table.
  - Entry points: Home "Challenge a friend" picker (fresh 5 from the tapped region, preview sheet) and the run summary (primary = the sender's played route in play order, first ≤10; secondary = fresh 5 in the same region). mc1 summary surface byte-identical.
  - Rails: mc2 saves under `meridian.run.mc2` (old builds never read it); displacement only on the welcome card's Start tap, displaced run offered back on Done; guard-table boot behaviour; in-region widening chain; fairness copy exactly "Same places, same circle for everyone."; three failure-copy classes; SCORING_VERSION tripwire test.
  - Coordinator decisions D1–D9 in the run report (`~/workspace/meridian-challenge-a/REPORT.md`, untracked stage artifact). Manifest erratum noted there: Texas computes to 150 km, not the manifest prose's ≈160 (Alaska is the cap case).
- **Pending:** full gate re-run on the final tip → @old-build rehearsal (scripted-manual, recorded in the PR) → full panel on the final tip → PR. **No merge without the owner's word.**
