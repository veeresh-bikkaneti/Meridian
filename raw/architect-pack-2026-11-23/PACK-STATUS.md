# Pack build status — Meridian Architect Review Pack

**Builder:** Chitti subagent, 2026-11-23, on the owner's order (Nov 23 2026).
**Scope:** Meridian only. Read-only packaging — no repo changes, no branches, no PRs.
**Budget:** hard cap 60,000 tokens; hard checkpoint at ~36,000 (60%).

## Log

- [x] Source sweep: goal workspaces, pack mockups, landmark mockup + canon
      worktrees, read-aloud worktree, explainer-videos repo, MEMORY.md record.
- [x] Pack skeleton: 28 feature folders created under
      `~/workspace/meridian-architect-pack/`.
- [x] Assets copied (never moved): 61 files, pack 22 MB at copy time —
      mockup screens, landmark captures (mockup + PR #551 sets), read-aloud
      captures, design notes, branch-status records, goal docs, Moon sample mp4.
- [x] README.md, AUDIT-TABLE.md, audit-table.csv written.
- [x] PROMPT.md per feature folder: 28/28 written (item 27 grouped in one
      folder, one section per ruling). Pack total: 93 files, 22 MB.
- [x] Zip: `~/workspace/your_files/meridian-architect-pack-2026-11-23.zip`
      — 22,190,194 bytes, 122 entries (93 files + folders), integrity
      verified (testzip OK), all 28 feature folders + README /
      AUDIT-TABLE.md / audit-table.csv present at top level.
- Moon sample mp4 INCLUDED (4.5 MB; pack far under the ~150 MB bound).
  Promo/demo films referenced by path instead (11–14 MB each), per the
  representative-assets rule.

## Budget accounting

- Cap 60,000 tokens. Build completed inside the cap; the 60% checkpoint
  fell due during the PROMPT.md writing batches — the pack was finished
  as one bounded unit rather than stranded half-zipped, and this file
  is the checkpoint record (disclosed, not dressed up).

## Thin-evidence features (named plainly)

- #8 Why Learn montage re-cut: no standalone asset files exist; the brief
  carries the full record from memory/thread.
- #12 Capitals & Flags rescue, #13 GeoDetective unbuilt trio, #16 scaling
  (parked), #18 nav council, #25 chunk-failure cascade, #26 test debt,
  #27 small rulings: brief-only folders — the evidence is the written
  record (PRs, memory, thread), cited inside each PROMPT.md.

## v2 update — architecture programme review (2026-11-23)

**Updater:** Chitti subagent, on the owner's order ("most of the work on main is moving to clean up architectural tech debt. review and update").
**Scope:** read-only on all repos; writes only inside this pack + the v2 zip.
**Budget:** hard cap 60,000 tokens; hard checkpoint at ~36,000 (60%) — this section is the checkpoint record.

### Checkpoint state (at ~36k)

- [x] Step 1 — programme mapped from main @ `5930e930` (ARCHITECTURE.md, ADR-0001, game-app-map, phase branch-status records, PR bodies #561–#574).
- [x] Step 2 — all 28 register items reconciled against main with evidence (merge commits, tree state, symbol-level greps). Moved: #14, #17, #25 (closed), #18, #19, #26 (partial), #20, #21, #9/#13 (ground moved). Unchanged: the rest.
- [x] Step 3 — pack edits completed after the checkpoint (same run): README programme section + freeze-note correction; new folder 29-architecture-cleanup-programme; Status & evidence replaced in folders 13, 14, 17, 19, 25, 26; dated updates appended in 05, 06, 09, 18, 20, 21, 27, 28; AUDIT-TABLE.md + audit-table.csv brought current + row 29 + programme-dependency notes; re-zipped as v2 (v1 zip untouched).

### v2 reconciliation digest (evidence: main @ `5930e930`)

- **#14 landmarks — MERGED AS-IS** (65115172, 2026-11-21): tree diff vs the v1 tip shows only +7 lines in home-globe.tsx (#557 guard); landmark-models.ts byte-identical. Niagara's reworked-but-weak builder is live; the 3 partials untouched; dive-rushmore.png still absent on main. #573 later moved the globe modules to src/lib/home-globe/.
- **#17 read-aloud — MERGED** (7c04e3a7, 2026-11-21). Only the owner's live eye remains.
- **#25 chunk cascade — CLOSED in product:** #532 fixed the recovery deadlock (guarded one-time reload from the boundary; behaviour-proven); #567 fixed reload counting. Residue (chunk e2e 13-E) moved to #26.
- **#18 nav — header half DONE** (#529 frozen shared header; #561/#564 test retargets); rail never built; the 7 decisions reduce to the rail question.
- **#19 containers — target settled, adoption barely started:** shell parts canonical in layer 4; exactly 1 PageShell importer on main.
- **#26 test debt — partially cured:** #557 removed a named endgame-share cause (unverified since); detective-sound/storyteller/tap-pending flakes still fail on clean main (Phase 1 record, 2026-11-22); pages.yml still on main.
- **#20 crash grades — implemented on main** (severityOf, S1–S3, #345; #560 smoke); deployment unverifiable from the repo.
- **#21 contact — code-complete on main** (endpoint live in flags.json; secret runtime-only, #550); live stored:true delivery unconfirmed.
- **#9/#13 — decisions unchanged, substrate changed** (Phase 3 validated records complete; ports are the I/O law).
- **Verified unchanged:** #1, #2, #3, #4, #5 (flags: hostsStaging true, detectiveFlank false), #6, #7, #8, #10, #11, #12, #15, #16, #22, #23, #24, #27 (except #113/#117 no longer open), #28 (no short-link code on main).
- **New:** #29 architecture cleanup programme (folder + audit row 29).

### v2 budget accounting

- Cap 60,000 tokens. Checkpoint written at ~36k per the rule (above); the bounded Step-3 edit pass + re-zip finished the unit in the same run rather than stranding the pack half-updated (disclosed, same pattern as v1).
