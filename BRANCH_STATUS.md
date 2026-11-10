# BRANCH_STATUS — feat/pair-session-moments (PR 2b, stacked on PR #387)

**Branch:** `feat/pair-session-moments` · **Base:** `feat/pivot-flank` @
`58de2f6d` (PR #387 head; panel-voted code tip `b8bfc8d4` + one docs commit)
**Scope (owner brief, 2026-11-10):** Holmes & Watson session + moments —
(1) tap-mode ending speech, (2) session gating, (3) solve moment,
(4) loss = truce replacing pout, (5) owner-mode session flow + state
legibility. NO panel, NO merge, NO flag flips in this PR — the panel runs
after the build report; merges stay the owner's hand.

## Task capsule

```text
TASK / requested outcome: Build PR 2b per the brief's five items, in
  priority order, stacked on the PR 2a flank tip; PR opened against
  feat/pivot-flank; independent Silo QA re-key on the final tip.
Interpretations considered and selected reading:
  - Item 1 mechanism: HOLD + LISTEN (chosen by the code). Ending bursts
    are not synchronous with one tap (win lines follow the ring + queue
    drain; the debrief is emitted on later drains; the answer read
    follows the fail), so cure 3's gesture-arm window cannot cover
    them. The player therefore HOLDS ending refs at enqueue (the
    Unit A clue-hold pattern) and the host renders a Listen surface in
    the ending phases — the exact gap the PR 2a Game Player named in
    three consecutive rounds ("no Listen surface on the ending").
  - Item 4: the POUT phase is renamed TRUCE. With pairReactions OFF the
    machine still lands in TRUCE but speaks no truce lines and the view
    keeps the shipped pout poses — flag-off is byte-close to shipped.
  - Item 2 "Case N": N is the SESSION's case ordinal (2nd case of the
    tab visit stamps "Case 2"), counted host-side in sessionStorage.
  - Item 3 flush: the shipped SELECTION_READ solve path (winning
    guess's own read completes, then endings — pinned by
    detective-endings.spec.ts) is untouched. The flush applies only
    when an ending lands while a CLUE CHAIN owns the voice (READING /
    THINKING_BEAT / NOTE_MARK / ASK_NEXT): the player drops queued +
    playing non-ending speech so no clue audio sounds after a solve.
Tier and rationale: Tier 2 shape (new feature, 3+ files) executed under
  the owner's direct brief; the design of record is the 2026-11-07
  owner rulings + the PR 2 capsule + the pivot council queue law.
Done condition / scenarios / evidence: the brief's gates, all on the
  final tip (tsc · npm test · test:worker · lint-cards · manifest gate ·
  build:pages · detective E2E by name · owner-config playthrough incl.
  endings speak in tap mode, win AND loss) + render-level screenshots
  at 390/768/1280 with 0 px² clue-text overlap + Silo QA re-key verdict.
Files and interfaces in scope: src/game/loop/detective/{detective-state,
  detective-audio, DetectiveHost, DetectivePair, detective-session (new),
  watson-walk}.ts(x), src/lib/flags.ts, public/flags.json,
  scripts/detective/render-plan.mjs (+ its test), the audio manifest
  (render pipeline only), new unit tests + new E2E specs,
  playwright.config.ts (register the new specs), docs (geodetective.md,
  handbook ch10, feature-flags.md, README pair paragraph), this file.
  Protected/out of scope: LoopScreen.tsx (no changes planned), the
  shipped CELEBRATE choreography (reused, never re-anchored), the
  donation copy, detectiveFlank (no flip).
Ownership: build coordinator (this agent), worktree
  ~/workspace/meridian-2b-build; Silo QA = a separate clean-context agent.
Assumptions, risks, unknowns: the muted-phone CASE_OPEN wedge (item 5)
  has no proven mechanism yet — an E2E probe on the base build runs
  BEFORE the cure is designed; the cure follows the probe's evidence.
Budget: parent cap per repo Tier 2 (400k, estimated, no meter).
Approvals: branch push + PR open are named in the brief; merge is NOT
  requested and will not happen.
```

## PR 2b build log

- [x] Worktree + branch from `58de2f6d`; capsule written.
- [x] Probe [measured, base build]: muted phone does NOT wedge
      CASE_OPEN (phase exits in ~5 s in off mode) but staging stalls
      at "standing" with the bench mounted — in BOTH muted and tap
      modes — whenever play never touches the map (probe: search-box
      guess spent, case at guess 2, stage still "standing", bench
      element mounted). The stall is the item-5 defect in both modes.
- [x] Item 1 — player ending hold + `playHeldEnding`; host ending
      Listen (`detective-ending-listen`) in CELEBRATE/DEBRIEF/
      FAIL_READ/TRUCE, strip-middle + fixed-wrapper forms. Built;
      E2E pins below.
- [x] Item 2 — `detective-session.ts` (sessionStorage, fail-open);
      duet + bench only on the session's first case; "Case N" stamp
      portal for fresh cases 2+; `shouldAnnounce` occasion shape
      (first/resume/later), `ANNOUNCEMENT_SESSION_CAP` retired.
- [x] Item 3 — `flushSpeech()` (no drain signal) + status-effect
      wiring; machine clueUnlocked closed-case guard. LAW CHANGE:
      clueUnlocked no longer exits TRUCE (an old U8 POUT exit;
      production never used it — the host resets per case); exits
      re-pinned to caseOpened. Solve-at-2/3 E2E pins below.
- [x] Item 4 — 7 truce renders via the pipeline (manifest +7 entries
      only; 7 drift re-renders restored byte-for-byte, VOICE
      precedent). Two Watson takes flagged for the panel ear pass:
      truce-watson-1 (108.1 Hz, inside family band) and
      truce-watson-3 (130.6 Hz, outside the family band too; the
      retry ladder moved it to speed 94 — manifest note says a
      human ear check is required; cf. shipped flagged ack-3).
      Machine TRUCE chain + truce/pennant poses built.
- [x] Item 5 — play-start entry effect (tap/off modes + later cases;
      auto + session-intro case keeps the shipped map-touch entry).
- [x] Flags: `pairReactions` (ships ON) + `trucePennant` (default FALSE).
- [ ] E2E: update endings + closed-state specs (POUT→TRUCE); new
      session spec (endings win/loss in tap mode, session gating,
      staging completion, muted completion, solve-at-2/3).
- [ ] Gates on final tip + screenshots 390/768/1280.
- [ ] Docs: geodetective.md · handbook ch10 · feature-flags.md · README.
- [ ] PR opened against `feat/pivot-flank`; Silo QA re-key.

---

# BRANCH_STATUS — feat/journal-movies

**Branch:** `feat/journal-movies` · **Base:** `origin/main` @ `f2bbf1a2` (#370)
**Rebased:** 2026-11-09 — onto main `f2bbf1a2` (#370); only conflict was
this file (docs-only); main's #370/#376 records preserved verbatim below
("Merged main record — feat/u11-clue-renders" + credits capsule). Prior panel YES on
`4964a727` does NOT transfer to the new head.
**Owner order:** 2026-11-07 — "Build all journals" (Old Faithful pilot approved)
**Status:** 106/106 clips BUILT and HOSTED (incl. pilot) — not "all
verified". All 12 batches delivered (batch 08 is 8/8 new + pilot); nothing
unbuilt. What is actually established (detail: `docs/journal-movies.md` →
"Verification actually done"):
- Verified: 106-id mapping to `JOURNAL_NOTES`, URLs serve 200 and match
  meridian-media `08c8308`, ffprobe format + full decode on all 106.
- Sampled still frames and automated video descriptions exist (8 original
  clips in an earlier automated watch; then all 106, 26 full-quality + 80
  compressed). They do not establish full visual/factual clearance.
- Reliable narration verification across 106 remains incomplete: automated
  tools were inconsistent about audio access, so trusted listening is 0/106.
  No scripts/transcripts kept. Owner's listen is the final check.
- Manifest notes are self-reported. A wording heuristic (note opens with
  Clean/Cleanest/Best clip) splits them 26 / 80; the 80 is NOT a verified
  defect count. Known fallbacks: haymarket, university-place (still +
  narration). Shipping is the owner's call.
- Not built: no app code reads the manifest; no movie plays in the app.
"Done" items below mean the coordinator's per-batch check ran — not that a
clip passed every recipe gate.
Next: see Pending. PR #369 is open; never merge without the owner's word,
per PR, per head.

## Rebase verification — onto frozen main f2bbf1a2 (#370), this run (2026-11-09)

- Gates ran on `b26c26db` (rebase-record commit); this commit adds only this
  BRANCH_STATUS.md text on top. Pushed head = this commit.
- Gates on `b26c26db`: `npx tsc --noEmit` exit 0; `npm test` exit 0 (scripts
  1161 pass / 11 skipped / 0 fail of 1172; src 2268 pass / 0 fail; validator
  suite 133/133 on a direct re-run); lint-cards GATE PASSED; `npm run
  build:pages` exit 0, buildId `b26c26db`. Logs:
  `~/workspace/gjm-movies-r2-{tsc,npmtest,lintcards,build}.log`.
- Docs-only: `git diff f2bbf1a2..HEAD --stat` = BRANCH_STATUS.md + the 5 branch
  files (validator, validator test, manifest, package.json,
  docs/journal-movies.md); no src/, tests/, workers/ changes. Branch files
  byte-identical to old head `4964a727` (`git diff 4964a727 HEAD -- <files>`
  empty); manifest byte-identical to `4964a727`.
- Prior panel YES on `4964a727` does NOT transfer. This head is ready for
  DuckDuck (testing prompt:
  `~/workspace/journal-testing-prompts-duckduck-firefox-edge.md`). No E2E /
  panel / recording in this run (gates only, per the split).

## Done
- [x] 2026-11-08 — Branch created from origin/main 9e49da3e; worktree
      `~/workspace/journal-movies-work` (clean checkout).
- [x] 2026-11-08 — `docs/journal-movies.md` (plan + pilot recipe + storage
      decision + batch table) and `public/videos/journal-manifest.json`
      (pilot entry, version 1).
- [x] 2026-11-08 — 12 worker subagents spawned in parallel (3 sets each,
      9 clips each; batch 08 has 8 new + pilot skipped; batch 12 has 7).
      Staging: `~/workspace/journal-movies-batches/batch-NN/`.
- [x] 2026-11-08 — Media repo `veeresh-bikkaneti/meridian-media` created,
      Pages enabled, pilot v4 uploaded byte-identical (sha256 5a985e28…);
      URL verified 200, 5,664,273 bytes, valid MP4.
- [x] 2026-11-08 — **Batch 01, sets 1–2: 6 clips coordinator-verified and
      LIVE** (meridian-media `488329d`, manifest v1+6 entries):
      capitol (magnus), memorial-stadium (briggs), haymarket (casper,
      still+narration FALLBACK — AI video failed no-text gate),
      pinnacle (vdc_2561), 27th-and-o (miles, bad-fit flag),
      centennial-mall (vdc_NOID19). Independent checks: ffprobe 10.000 s /
      1152x768 / 24 fps / h264+AAC, full decode exit 0, frames viewed
      (faithful, no text), audio re-measured (peaks −1.5 dB, means match
      worker to 0.1 dB, no clipping). Bed-30% per worker measurement
      (NOTES.md). Not verified by ear — owner's listen is the final check.
- [x] 2026-11-08 — Batch 01 follow-up worker spawned (set 3: sunken-gardens,
      childrens-zoo, 48th-and-o + 1 haymarket regen attempt, 4 video calls).
- [x] 2026-11-08 — **Batch 04: 9/9 coordinator-verified and LIVE**
      (meridian-media `4d35706`): woods-park, conestoga, branched-oak,
      mahoney, sac-museum, seward, homestead, pawnee-lake, platte-river-sp.
      The 6-video cap did NOT block this batch (all 9 generations
      succeeded). Flags in manifest (homestead dusk fade + gentle-motion,
      platte-river-sp gentle-motion + 0.74 s window, mahoney hard cut,
      seward sky-only settle, sac-museum close-up style drift,
      branched-oak pink pennants, woods-park crowd drift).
- [x] 2026-11-08 — **Batch 03: 3/6 delivered clips coordinator-verified
      and LIVE** (hyde, near-south, robbers-cave). **HELD, not shipped:**
      university-place (readable text "heritage" on the destination board
      — hard gate fail, confirmed in frame), havelock (invented rooster),
      southpointe (palette does not hold — saturated sunset, pilot-v1
      failure mode + fence bird). 3 unbuilt (college-view video failed,
      star-city-shores + quilt-museum capped). Follow-up spawned: 3 builds
      + 3 regens (6 calls, priority-ordered).
- [x] 2026-11-08 — **Batch 11: 5/6 delivered clips coordinator-verified
      and LIVE** (machu, fuji, chichen, stonehenge, petra). **HELD:**
      neuschwanstein (invented rooster standing on the lake ~6 s + faint
      ghost castle at 2 s). 3 unbuilt (angkor video failed on a bad path,
      table-mountain + uluru capped). Follow-up spawned: 3 builds + 1 regen.
- [x] 2026-11-08 — Independent verification of all 21 batch-03/04/11
      clips: ffprobe 10.000 s / 1152x768 / 24 fps / h264+AAC, full decode
      exit 0, audio re-measured (means match workers; peaks −1.0 to
      −1.6 dB, 0 clipped), 10 frames viewed by the coordinator
      (holds confirmed in-frame; flags confirmed). Bed-30% per worker
      measurement (NOTES.md). Not verified by ear — owner's listen is
      the final check.
- [x] 2026-11-08 — **Batch 01 follow-up DONE: set 3 verified + LIVE**
      (sunken-gardens vdc_5723, childrens-zoo casper, 48th-and-o magnus
      with bad-fit flag). **Haymarket regen FAILED the no-text gate a
      2nd time** (clock gains hands/numerals at 6/9.5 s despite the
      blank-clock prompt); fallback NOT overwritten and stands as the
      shipped version. A 3rd attempt would need a different approach
      (no clock tower in frame). Batch 01 is now 9/9 complete.
- [x] 2026-11-08 — **Batches 02, 05, 06, 07, 08, 09 landed; 40 clips
      coordinator-verified and LIVE** (meridian-media push in flight):
      02: pioneers-park, wilderness-park, antelope-park, oak-lake,
      lincoln-airport, union-plaza (6); 05: all 9; 06: old-market,
      scotts-bluff, durham, carhenge (4); 07: all 6; 08: all 6;
      09: all 6. Independent checks: ffprobe/decode/audio re-measured
      on all 48 (means match workers; peaks −0.9 to −1.6 dB, 0 clipped),
      8 decision frames viewed by the coordinator. Bed-30% per worker
      measurement. Not verified by ear — owner's listen is the final check.
- [x] 2026-11-08 — Follow-ups spawned for 02 (3 AI regens), 06 (5 regens),
      07 (3 builds), 08 (2 builds), 09 (3 builds). Batches 03 + 11
      follow-ups already running. Batches 10 + 12 still running.
- [x] 2026-11-08 — **Batch 10: 9/9 coordinator-verified and LIVE**
      (eiffel, colosseum, liberty, taj, opera-house, redeemer, sagrada,
      giza, cn-tower). Video take 1 was rejected for ALL 9 (camera zoomed
      into photoreal close-ups, invented pigeons, pseudo-text glyphs,
      statue cropped out) and re-shot with a style-lock prompt (camera
      NEVER moves, framing/style/palette NEVER change); take 2 held the
      wide watercolor shot on all 9 — confirmed at 6 s in-frame
      (colosseum, redeemer, eiffel). All 9 are static landmarks, flagged
      gentle-motion bad fits; key moment is a light change or a small
      vehicle (train, ferry, camels). Peaks −1.2 to −1.6 dB, decode 0.
      Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 12: 5/6 coordinator-verified and LIVE**
      (victoria-falls, fushimi, iguazu, tongariki, timbuktu). **HELD:**
      potala — the model re-interpreted the palace mid-clip as a different
      golden-roofed temple with Buddha statues flanking the door,
      confirmed in-frame at 6 s + 9.5 s. Tongariki ships flagged (settle
      frame pushes to a ~6-moai close-up, fifteen-in-a-row composition
      lost; reddish caps not in source art). Peaks −1.3 to −1.6 dB,
      decode 0. Bed-30% per worker measurement. Not verified by ear.
      Follow-up spawned: galapagos build (1 call, staged) + potala
      locked-wide regen reusing TTS.
- [x] 2026-11-08 — **Batch 03 follow-up DONE: 4 more clips verified +
      LIVE** (college-view, quilt-museum, havelock v2, southpointe v2).
      Havelock v2: rooster gone, confirmed in-frame at 6 s. Southpointe
      v2: intra-clip palette constant, no fence bird (v1 failure mode
      gone); caveat — framed warmer/closer than the keyframe. Batch 03
      now 7 LIVE. **Still HELD:** university-place (v2 board still not
      blank — 2nd failed regen). **Still pending:** star-city-shores
      (video call failed, not retried). Follow-up #2 spawned: 1 fresh
      star-city-shores call + university-place still+narration fallback
      (haymarket precedent — no 3rd regen).
- [x] 2026-11-08 — **Batch 11 follow-up DONE: 9/9 complete.** Neuschwanstein
      v2 PASSES — rooster + ghost castle gone, swans only, one castle,
      confirmed in-frame at 6 s. Angkor, table-mountain, uluru built.
      Peaks −1.4 to −1.5 dB, decode 0. Bed-30% per worker measurement.
      Not verified by ear.
- [x] 2026-11-08 — **Batch 08 follow-up DONE: 8/8 complete.** Niagara +
      alamo built, both flagged (niagara: Horseshoe Falls leaves frame
      from ~6 s; alamo: heavy zoom, closing line plays over a facade-only
      shot with no garden visible). Peaks −1.0/−1.5 dB, decode 0.
      Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 07 follow-up DONE: 9/9 complete.** Chadron,
      niobrara, white-house built (vdc_5723 / briggs / vdc_2561). White-house
      ships flagged: near-static after 4 s (motion diffs ~2), fountain arc
      compressed — option (b) still+narration only remains open. Niobrara
      flagged (6/9.5 s drift toward photorealism). Peaks −1.0 dB, decode 0.
      Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 02 follow-up DONE: 9/9 complete.** Holmes-lake,
      wyuka, gateway regens replace the held ffmpeg-only v1s — real bed at
      0.30 (gaps were −91.0 dB silent, now −46.6 to −47.8 dB). Gateway take 1
      rejected (invented pseudo-text signage); take 2 blank, no text.
      Wyuka flagged (headstone leaves frame, bird count varies 4→3→4);
      gateway flagged (one awning green instead of striped). Peaks −1.4/−1.5
      dB, decode 0. Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 09 follow-up DONE: 9/9 complete.** Everglades,
      death-valley, hoover built. Everglades: heron visibly lifts off at 6 s
      (fallback line not needed), confirmed in-frame. Hoover: v1 rejected
      (invented waterfall through the arch), v2 rejected (bypass bridge as
      hero); v3 locked-camera holds, no waterfall, dam is the hero —
      confirmed in-frame at 6 s. Everglades peak −0.9 dB by volumedetect
      (−1.01 dB by the worker's measure; headroom either way, no clipping).
      Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 06 follow-up DONE: 4 of 5 regens swapped.**
      Kingsley (spillway in full rush at 6 s), smith-falls (full wide flow
      with mist, child pointing), fort-robinson (flag raises, full at 9.5 s),
      chimney-rock (spire in frame at 2/6/9.5 s) — all four defects fixed,
      confirmed in-frame. Batch 06 now 8/9. **Archway NOT swapped by the
      worker** (its replace gate demanded exactly one wagon; the regen
      shows two) — see Held below: the coordinator overturned that hold.
      Peaks −1.0 dB, decode 0. Bed-30% per worker measurement.
      Not verified by ear.
- [x] 2026-11-08 — **Batch 12 follow-up DONE: 7/7 complete.** Galapagos
      built (tortoises + iguanas, real visible verb; minor flag: dark
      animals resting on the dock at 6/9.5 s). Potala v2 PASSES — the
      white-and-red palace mass on the hill holds at 2/6/9.5 s, confirmed
      in-frame at 6 s; v1's golden-temple reinterpretation gone. Voice-free
      window 2.10 s, as in the pilot. Peaks −1.4/−1.5 dB, decode 0.
      Bed-30% per worker measurement. Not verified by ear.
- [x] 2026-11-08 — **Batch 03 follow-up #2 DONE: 9/9 complete.**
      Star-city-shores built (fresh call, not a repeat of the failed one),
      flagged: tight near-photoreal close-up of two slides over one pool;
      the keyframe's wide watercolor aerial layout is gone — same failure
      mode as hyde; re-render option recorded. University-place ships as a
      still+narration FALLBACK (haymarket precedent, no 3rd regen): source
      still held 10 s with existing Casper narration + v1 audio bed at 0.30,
      peak −1.01 dB, no text possible. Batch 03 now 9/9.
- [x] 2026-11-08 — **Archway mix-only follow-up DONE: batch 06 now 9/9,
      build 106/106 COMPLETE.** The regen raw was mixed with existing
      vdc_2561 TTS (no re-render, no video call), verified, and swapped in
      as `archway.mp4` (md5 `0f12426222d1226eecd11a909523c415`, 7,043,093 B).
      Coordinator re-verified independently: 10.000 s / 1152×768 / 24 fps /
      h264+AAC, decode exit 0, peak −1.0 dB, mean −18.7 dB, bed −10.5 dB in
      the voice-free gap; 6 s + 9.5 s frames viewed — bridge hero + highway
      + cars in frame throughout, both wagons in place. The held v1 is
      preserved at `work/held-original-archway.mp4`. Bed-30% per worker
      measurement. Not verified by ear.

## Video cap (discovered 2026-11-08, affects every batch)
The media pipeline allows at most **6 successful videos per agent
message**, even when the task asks for more. Batch 01 used all 6 on sets
1–2; set 3 was unbuilt. Every batch will need a follow-up run for its
last 3 clips (batch 08: last 2; batch 12: last 1) — ~24 worker runs total
instead of 12. Follow-up spawns are new messages, so each gets a fresh
6-video budget. **Exception observed 2026-11-08: batch 04 delivered 9/9
in one run — all 9 generations succeeded, cap did not block.** The cap
is enforced per run, not per batch; do not assume it.

## Held clips — none. (Resolved holds kept below for the record.)
- archway (batch 06): hold OVERTURNED 2026-11-08 (see Resolved holds) and
  the regen is now live. Nothing is held.
- haymarket (batch 01) ships as a flagged still+narration FALLBACK
  (AI video failed the no-text gate TWICE); a 3rd attempt would need a
  different approach (no clock tower in frame).
- university-place (batch 03) ships as a flagged still+narration FALLBACK
  (v1 + v2 both failed the no-text gate); see Done above.

## Resolved holds (were held, now live — record kept here)
- archway (batch 06): the regen was first refused for showing TWO wagons
  against an "exactly one wagon" gate. Coordinator overturn: the calm
  keyframe itself contains two wagons (white-covered left, open wagon
  centre-right) and the regen shows the same two in the same positions —
  the source art's own exhibits, not a duplication. Mixed with existing
  TTS, verified, swapped in 2026-11-08. Batch 06 now 9/9.
- havelock, southpointe (batch 03): v2 regens passed, live.
- neuschwanstein (batch 11): v2 regen passed, live.
- holmes-lake, wyuka, gateway (batch 02): v2 AI regens with real bed, live.
- kingsley, smith-falls, fort-robinson, chimney-rock (batch 06): v2 regens
  with real bed + visible payoffs, live.
- potala (batch 12): v2 locked-wide regen, palace holds, live.

## Storage proposal (recorded in docs/journal-movies.md)
Movies do NOT live in this repo (~600 MB would quadruple git objects and
push Pages toward the 1 GB cap). Separate repo `veeresh-bikkaneti/meridian-media`
with its own GitHub Pages; a future player (NOT BUILT) would lazy-load by
URL on entry open, which the current CSP `media-src 'self'` would block.
Still a proposal: storage/hosting/privacy is Tier 2 and has no Consensus
Manifest or owner citation recorded here. Manifest here maps entry id → URL. R2 is the better long-term host but needs owner
provisioning; media repo needs none.

## Pending
- [ ] Create `veeresh-bikkaneti/meridian-media` repo + Pages; upload pilot
      v4 unchanged as `old-faithful.mp4`; verify URL serves. — DONE 2026-11-08
      (repo created, Pages on, pilot live; see Done above).
- [ ] Verify each batch as it lands (ffprobe/decode/frames/audio/no-text),
      upload to meridian-media, update manifest, commit + push progressively.
- [ ] Report first completed batch to owner promptly; keep reporting per batch.
- [ ] Gates before PR: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`,
      `npm run build:pages`, Playwright E2E (sequential, under `flock` lock).
      Superseded: PR #369 is open; see its body and review records for runs.
      Full E2E suite has not completed on any head.
- [ ] **Manifest validator gate — BLOCKED on Tier 2.** Independent review
      (2026-11-08) reproduced on `cb01f91c`: appending invalid JSON, deleting
      an entry, adding an unknown id, or duplicating a key in
      `public/videos/journal-manifest.json` all still pass `npm run
      build:pages`, `npm test` (scripts suite) and `lint-cards`, and ship.
      A validator (new module + test + `prebuild`/`prebuild:pages` wiring) is
      a new module across 3+ files → Tier 2 (`AGENTS.md`, tier table), and
      the protocol forbids implementation code before a signed Consensus
      Manifest (`docs/ops/agent-council-protocol.md` §2, directive 1). Draft contracts
      exist off-branch; council not convened, nothing signed.
- [ ] Manifest top-level `note` still says movies "load only on request" —
      present tense for an unbuilt player. Correct it with the validator work.
- [ ] Trusted listen of all 106 narrations against each entry's story text,
      and full-resolution visual clearance — INCOMPLETE (automated
      descriptions exist; not a clearance).
- [ ] Live six-viewport browser check of the journal on this head — NOT RUN.
- [ ] Panel review of the final tip; owner's merge word — pending.

## Never
- Never merge — merge word stays the owner's, per PR, per head.
- Never rebuild the pilot. Never bundle all 106 into the app (lazy-load only).
- No ear-verification here — owner's listen is the final check per clip.

---

# BRANCH_STATUS — feat/pivot-ack-renders (Agent VOICE)

- **Branch:** `feat/pivot-ack-renders` · **Base:** `main` @ `5e6af2f9` (#340)
- **What landed (2026-11-09):** Holmes's ack pool grows 4 → 10. Six new
  fixed lines added to `scripts/detective/render-plan.mjs` (ack-5…ack-10,
  frozen text, receipt-only register) and rendered through the pipeline
  (`render-audio.mjs --fixed`) in Holmes's cast voice `avocado_v2:atlas`
  (voice field verified per render by the renderer — a mismatch aborts):
  ack-5 "Heard, Watson." · ack-6 "I'll take that, Watson." · ack-7 "Filed,
  Watson." · ack-8 "Received, Watson." · ack-9 "Set it down, Watson." ·
  ack-10 "One moment, Watson."
- **Gates:** manifest gate clean (2,538 entries verified) · scripts suite
  1,032 tests, 0 fail (render-plan count expectations updated 4 → 10 acks,
  fixed-lines total 20 → 26).
- **Flags (pipeline's own, kept honestly):** ack-7 flagged — final take
  111.1 Hz, below the 110–160 family band's floor edge after the pitch
  ladder (speed 112); ack-8 flagged on pace only (85 wpm vs the 90 floor,
  pitch in target at 123.7 Hz). ack-5/6/9/10 ok. Human ear check owed on
  ack-7/ack-8 at panel time. *(Resolved 2026-11-09: the measurement ear
  check in the next capsule kept both clips, and the owner ear-approved
  ack-7.)*
- **Untouched on purpose:** ack-1…4, suspicion, and every other fixed
  line are byte-identical to main (the render run's collateral re-renders
  were restored); at this branch's own tip `detective-state.ts` still
  rotates 4 at this branch's own tip — the random picker is Agent
  HERALD's piece, stacked on this branch (it landed in PR #386).
- **Pending (at capsule time):** GATE opens the PR and runs integration +
  panel. No PR opened by this branch's builder. *(Done since: PR #385 was
  opened; its final tip after the merge-up is `c8f40692`.)*

## GROK-REWORK — independent verification + ear check (2026-11-09)

- **Re-verified at tip `de612a41`:** tip + clean tree confirmed; all ten
  ack clips present and playable (ffprobe); manifest gate clean (2,538
  entries); manifest diff vs main = only the six new entries (+75/−0
  lines); all 20 pre-existing fixed clips md5-identical to main; every
  ack manifest entry's text = the frozen text, voice `avocado_v2:atlas`,
  measuredHz = the record's pitch table.
- **Voice tool confirmed on this machine:** a throwaway probe render via
  `/opt/hatch/bin/tts speak --voice avocado_v2:atlas` returned the voice
  field `"avocado_v2:atlas"` — the exact cast voice is reachable here.
- **Ear check (measurement-based — no human hearing claimed):** two
  independent pitch trackers (YIN + HPS) reproduce the pipeline's Hz
  within ~5 Hz on all ten clips; pace = words/total-duration (reproduces
  manifest wpm exactly); plus ebur128 loudness, spectral centroid, and
  terminal-contour measures per clip.
- **ack-7 "Filed, Watson." — KEEP.** YIN 111.6 Hz ≈ pipeline 111.1 Hz:
  ~2 semitones below the set median but bracketed by shipped ack-3
  (114.0 Hz), pace identical to its 2-word peers (89.3 wpm), loudness
  mid-set, narrowest pitch spread of the ten — the same man at the
  family's low end, not a different, gruffer Holmes. (The manifest note
  cites the first take's 107.8 Hz; the shipped take measures 111.1.)
- **ack-8 "Received, Watson." — KEEP.** 84.7 wpm vs 89–91 for the other
  2-word lines (+72–96 ms on a ~1.35 s clip, ≈5–7% — at the edge of
  tempo perceptibility); pitch in target (YIN 128.4 Hz), widest pitch
  movement and bright timbre — deliberate, not dragging.
- **Set picture:** ack-4 stays the warm ceiling (highest pitch,
  brightest, flattest ending); no clip exceeds it, so no draw can sound
  more encouraging than the shipped reference. Panel observation only:
  ack-3 is the set's quietest (−30.5 LUFS) — pre-existing on main,
  byte-identical, left untouched.
- **No cures:** no clip was convicted, so zero re-renders and zero
  audio/manifest changes; this capsule is the only change in its commit.

## GATE integration cure — ack-pool spec pins (2026-11-09, on feat/pivot-speech @ 891031da)

- **Why:** GATE verification of HERALD's random ack picker (pool
  ack-1…ack-10, no repeat within a case) found 7 E2E failures, all one
  class — older specs pinned the exact file `fixed/ack-1.mp3` (or
  `ack-2.mp3`) the retired rotation always played. Live behaviour was
  correct in every failure: the chain fired in position with a lawful
  pool draw. The specs now assert the pool contract instead of the
  retired rotation; no assertion was weakened or deleted.
- **What changed (specs + shared harness only, no `src/`):**
  `tests/e2e/detective-u10.ts` gains the shared pool matcher
  (`ACK_POOL` = /fixed\/ack-\d+\.mp3/, plus `countAcks` / `ackFiles`)
  and `assertSubsequence` accepts RegExp needles alongside substrings.
  `detective-replay.spec.ts`: every played/network ack pin is now a
  pool count (first pass exactly 1 · after replay exactly 2 · restart
  exactly 1 · chain tail still clue → ack → decode in order); ack-1
  remains only as test (c)'s absence needle (mid-read: no ack at all).
  `detective-watson-walk.spec.ts`: the full-walk order array takes the
  pool matcher in the ack slot (order + count unchanged); the mid-walk
  arrival pin now asserts exactly 2 acks in the case so far, ALL
  DISTINCT — the no-repeat rule, stronger than the old ack-2 pin; the
  sheet test's deferred drain asserts exactly one pool ack.
  `detective-sound.spec.ts` untouched (verified pool-safe).
- **Gates:** `npx tsc --noEmit` clean; the two cured specs + the sound
  spec re-run E2E after this commit (counts in the GATE report).

---

# BRANCH_STATUS — feat/geodetective-end-game
## Merged main record — feat/watson-station (PR #372, main @ 63d82869)

Preserved from main during the rebase onto 63d82869: the watson-station
branch-status record that main carried at the merge. It is not this
branch's work; it is kept here so the rebase does not silently drop it.

### feat/watson-station record

- **Branch:** `feat/watson-station` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Task:** Watson holds the clue-card station through the guessing phases.
- **Owner defect:** 2026-11-08 ~00:53 CST — Watson standing large at the
  map's bottom-left corner on the owner's phone during guessing.
- **Diagnosis of record:** `~/workspace/meridian-detective-evidence/diag-watson-corner/DIAGNOSIS.md`
  — the walk works on live production; when a clue read ends, the state
  machine enters `SEARCH_IDLE`, whose view parked Watson at placement
  "dock" (rendered inside the map, bottom-left), and `SEARCH_AREA` /
  `SELECTION_READ` / `ASK_NEXT` kept him docked. Owner's standing ruling
  (2026-11-07): "Watson stays at the clues once play starts."

TASK / requested outcome: change Watson's placement from "dock" to
"station" in exactly four phases of `viewForState`
(`src/game/loop/detective/detective-state.ts`) — SEARCH_IDLE,
SEARCH_AREA, SELECTION_READ, ASK_NEXT — poses unchanged, no Holmes
placement or pose changed anywhere. Verify DetectiveHost needs no
logic change (it renders purely from the machine's placement), update
the unit + E2E pins that required Watson at the dock in the FULL
(non-degraded) path, and record the cure in the handbook.

Tier and rationale: Tier 1 builder silo under the coordinator's brief —
one proven mechanism, one view-table change. Independent clean-context
QA + panel verification are run by other agents, not the builder.

Done condition / evidence:
- Unit (TDD, RED first): the search-view pin flips dock → station; a
  new per-phase test pins SEARCH_AREA / SELECTION_READ / ASK_NEXT with
  Holmes-placement guards in all four phases. RED confirmed
  (dock ≠ station) before the cure; GREEN after.
- Host check: every `view.watson.placement === "dock"` consumer traced
  (`watsonOnMap`, `watsonReplayDockEl`, `mapSoundEl` guard, the map
  portal block) — all are placement-generic; in the cured phases the
  station cluster (figure, gutter transform, replay-at-station,
  station sound cluster) takes Watson and the map portal renders
  Holmes alone (the dock cluster markup is already conditional on
  `watsonOnMap`, so it tolerates Watson's absence). **Zero host logic
  changes** — only two stale comments updated.
- Degraded path untouched by design: dock-only companion
  (`data-companion="dock"` — Holmes's berth verdict), tap speech mode,
  and the "dock" member of `WatsonPlacement` (host fallback) all stay;
  E2E pins for that path were not modified.
- Gates: see Status below (real results, filled by the builder).

Files in scope: `src/game/loop/detective/detective-state.ts`,
`src/game/loop/detective/detective-state.test.ts`,
`src/game/loop/detective/DetectiveHost.tsx` (comments only),
`tests/e2e/detective-replay.spec.ts`, `tests/e2e/detective-sound.spec.ts`,
`tests/e2e/detective-visibility.spec.ts`,
`tests/e2e/detective-watson-walk.spec.ts`,
`tests/e2e/detective-endings.spec.ts` (gap-closure round),
`tests/e2e/detective-staging.spec.ts` (comment only),
`docs/handbook/10-holmes-and-watson-pair.md` (new dated record section),
this file.

Collision note: the #364 lane (`feat/holmes-follow`) touches the same
two source files (`detective-state.ts`, `DetectiveHost.tsx`). This
branch is off `main` @ `9e49da3` and merges independently; whichever
lane merges second rebases over the other.

## Status

- [x] Diagnosis read in full; mechanism confirmed in code
- [x] Unit test RED (dock ≠ station in the four phases)
- [x] Cure: four placements → "station" + plain-tone why-comments — `63879d8`, pushed
- [x] Host audit: zero logic changes needed; stale header + map-render comments updated — `45865ff`, pushed
- [x] E2E pins updated (full path only; degraded pins untouched) — `c142574`, pushed
- [x] Handbook: "Watson station cure (2026-11-08)" record section — `d732610`, pushed
- [x] Builder gates:
  - `npx tsc --noEmit` — clean
  - `npm test` — PASS (final suite 2267/2267, 0 fail; command exit 0)
  - `npm run test:worker` — PASS (145/145, 0 fail)
  - `node scripts/lint-cards.mjs` — GATE PASSED
  - `npm run build:pages` — PASS (exit 0; prerender + fingerprint-sw
    completed. Two earlier local attempts were killed by VM restarts
    mid-build — environment, not build errors — and the gate was
    re-run clean to this result.)
- [x] PR opened — PR #372 (opened by the pipeline finisher; the
  builder brief forbade the builder from opening it)
- [ ] Merge — on the owner's word / coordinator only, never the builder

## GATES STATE (finisher session, 2026-11-08 — updated after every gate)

Finisher: pipeline-finisher subagent (lane 1 of the owner's sequential
pipeline law). Base verified against **origin/main `9e49da3`** — the
local `main` ref is stale (#361-era `97d1dcf`); origin/main IS an
ancestor of this branch and the true branch diff is 11 files (709+/185−, measured at 3f3eaf0; later commits are docs-only).

- [x] Chromium launch RE-TEST: the WebGL-policy outage is OVER for the
  real spec path — Playwright + bundled chromium-1243 launches and
  renders the app. Two environment facts every E2E run here needs:
  (1) `PLAYWRIGHT_CHROMIUM_EXECUTABLE` must point at the bundled 1243
  binary (the config default `/opt/meta-chromium/chrome` refuses to
  launch); (2) runs go with `TMPDIR=$HOME/playwright-tmp` — the VM's
  /tmp is a 512 MB tmpfs that LANDED AT 100% under other lanes'
  profile/cache junk (since freed), and the home volume carries an
  EDQUOT **file-count** quota: Chromium dies with SIGBUS
  (`BUS_ADRERR`, "Creating shared memory … Disk quota exceeded (122)")
  once renderer shared-memory creation hits it.
- [x] **Gate 1a — `detective-endings.spec.ts`: RUN, 0 passed / 2 failed**
  (full reporter output read; logs in
  `~/workspace/meridian-detective-evidence/station-e2e-2026-11-08/`).
  Runs 1–3 died at the first click on environment (full /tmp, then the
  EDQUOT crash). **Run 4 (clean environment) played both tests end to
  end** — the complete WIN path and the full 5-guess FAIL path ran —
  and both failed on the NEW N2 audit windows only:
  - WIN: `WIN celebrate→debrief @ endings` — worst
    `map:high-five` over clue-2 text ("This is a hot desert cit…"),
    max overlap 4,777.5 px² over 2,900 samples.
  - FAIL: `FAIL fail-read→pout @ endings` — worst `map:think` over
    clue-4 text ("After the PEPCON disaste…"), max overlap 4,777.5 px²
    over 11,920 samples.
  - **N7 VERIFIED PASSING inside the WIN run:** no clue-3/4/5 clip in
    the play record or the network list after the guess-2 solve (the
    test reached and passed that assertion before failing at the N2
    absorb; absence checks fail loudly, so reaching the absorb proves
    them).
  - **What the failure IS (screenshots read first-hand):** at the
    1440 px endings viewport, Watson stands at his clue-card STATION
    (left gutter beside the active card — the cure working) and Holmes
    stands on the card's LEFT EDGE, his painted box overlapping the
    card's first text column. Holmes is the CELEBRATE/FAIL_READ layout
    partner placed beside Watson by the host's existing celebration
    layout — a phase this branch never touched (CELEBRATE was already
    "station" for Watson before the cure; FAIL_READ likewise). The
    sampler's "map:" prefix is its cluster label for Holmes, not a map
    position — in both failure screenshots **neither figure is on the
    map**; both stand at the clue cards. So: **pre-existing
    celebration/fail-read layout overlap, exposed by the NEW N2
    windows (Silo QA's own gap), not a regression of this cure.**
    Per the finisher brief (pin exposes a product bug → flag before
    touching production code) this is flagged to the parent for a
    routing decision; the pins are NOT loosened and production code
    is NOT touched by this session.
- [x] **Gate 1b — `detective-watson-walk.spec.ts`: 9 passed / 0 failed**
  (PLAYWRIGHT_EXIT=0, full output read; log `e2e-walk1.log` in the
  evidence dir). The main walk test at 390/768/1280 carries BOTH the
  N2 guessing-chain window (SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING sampled in order; window absorbed at 0 px²) and the clue-2
  walk window — **N2 guessing-chain half: PASSING**. The new mid-walk
  tap test passed — **N6: PASSING**. Kill-switch (watsonWalk OFF) and
  reduced-motion tests also passed.
- [x] **Gate 2 — nit-5 measurement TAKEN: maxOverlap 0 px²**
  (watsonWalk OFF via `fulfillFlagsStaging`, 390 px; throwaway probe,
  written → run → deleted; log `e2e-nit5b.log`). 9,600 figure/text
  pair samples across two 4 s windows: the first right after the
  unlock gesture (host not yet mounted — phase null, bench/CASE_OPEN
  window), the second starting 2.5 s after the guess commit (phase
  SELECTION_READ, spanning the guessing-chain into the clue-2 read).
  **No overlap anywhere on the walk-off path at 390 — nothing to
  route.** Caveat for the record: the probe's strict READING-phase
  gate never latched in the walk-off flow (the host mounts only after
  the duet drains), so the windows are labelled by their actual
  phases above, not by the intended READING label; the zero stands
  for the windows sampled.
- [x] Gate 3 — Silo QA delta re-key: the tip moved past `034535e`
  ONLY by this file's GATES-STATE commits (records, zero code/test
  changes) — the existing PASS-WITH-NITS + the now-run-verified gaps
  stand; no code delta exists to re-key. Stated per the finisher
  brief's either/or.
- [x] Gate 4 — PR opened: PR #372; the parent's routing decision
  (a) is recorded — the N2-endings failure is routed to its own
  follow-up (issue #371) and this PR proceeds with the failure
  recorded honestly in the PR body.
- [ ] Gates 5–7 — panel + DevEx + benchmark ran on `3f3eaf0`
  (panel 13/13 in: 1 APPROVE, 10 APPROVE-WITH-NITS, 2 BLOCKs both
  adjudicated pre-existing/out-of-scope — game audio → PR #370/PR 2,
  game player → issues #371/#373 + PR #370/PR 2; DevEx records cure
  applied after the panel, confirmation re-vote follows); merge
  awaits the panel verdict on the cured tip + the parent's merge
  call on the standing audio BLOCK.

> **SUPERSEDED — records cure, 2026-11-08 (pipeline finisher).**
> This capsule's per-gap run statuses below are STALE: they were written
> before the re-runs and claim several gaps are "NOT YET RUN", nit-5 is
> "not taken", and the Chromium outage is current. All three are wrong
> now. The **GATES-STATE section above is the current record**: GAP 4
> (N7) RUN VERIFIED PASSING; GAP 2 endings windows RUN — FAILED on the
> pre-existing CELEBRATE/FAIL_READ overlap (issue #371); GAP 2
> guessing-chain + GAP 3 (N6) RUN VERIFIED PASSING (walk spec 9/9);
> nit-5 MEASUREMENT TAKEN (maxOverlap 0 px²); the Chromium outage is
> OVER. Where this capsule and GATES-STATE disagree, GATES-STATE wins.

## Gap-closure round (2026-11-08, Silo QA PASS-WITH-NITS follow-up)

Test-only pins for Silo QA's N1–N7 gaps; zero production-code changes.

- [x] **GAP 1 (N1) — pinned + PASSING** (`49f210d`): unit test
  "station law past guessing: THINKING_BEAT, FAIL_READ, POUT,
  DEBRIEF and CELEBRATE never dock Watson (owner ruling 2026-11-07)"
  in `detective-state.test.ts` — Watson's placement asserted
  "station" in all five phases (CELEBRATE across all four
  choreography steps). Full suite: `npm test` 2268/2268.
- [x] **GAP 4 (N7) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1a)** (`35db604`): endings
  spec "WIN in 2" asserts, after a 2 s settle, that no
  `case-137/clue-3.mp3`, `clue-4.mp3` or `clue-5.mp3` appears in
  either the play record or the network request list. RUN: verified
  passing inside the Gate 1a endings run — the test reached and
  passed this assertion before the run's N2-window failure (absence
  checks fail loudly, so reaching the absorb proves them).
  (Correction, same day: an earlier version of this capsule
  claimed this and the N2
  endings windows were PASSING on a "2 passed" endings run.
  That was a misread of truncated, piped output: the run's full
  output shows **2 failed**, both at browser launch. No endings
  test has passed in this round.)
- [x] **GAP 2 (N2), endings half — pinned, RUN (windows FAILED on the pre-existing overlap, issue #371)**
  (`35db604`): audit windows "WIN celebrate→debrief @ endings"
  (9 s, opens at CELEBRATE) and "FAIL fail-read→pout @ endings"
  (12 s, opens at the final miss) absorbed through `AuditTrail`
  at 0 px². RUN (GATES-STATE Gate 1a): both windows absorbed
  overlap up to 4,777.5 px² from Holmes's pre-existing
  celebration/fail-read placement (issue #371).
- [x] **GAP 2 (N2), guessing-chain half — pinned, RUN VERIFIED PASSING (walk spec 9/9, GATES-STATE Gate 1b)**
  (`368c201`): in the watson-walk main test (all 3 widths), a
  12 s audit window "guessing chain selection→note→ask-next"
  opens once SELECTION_READ is live + 300 ms (the documented
  ~200 ms guess-commit FLIP exclusion kept exactly), with a
  trace assertion that SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING were sampled in order and a play-order subsequence
  (name → suspicion → ask-next → clue-2). RUN: the window
  absorbed at 0 px² at all three widths.
- [x] **GAP 3 (N6) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1b)** (`368c201`): new
  watson-walk test "watson walk: tap on Watson MID-WALK is
  ignored — one figure, walk arrives, held clue read fires
  exactly once (phone 390)". Pins the shipped behaviour: during
  a speech-gated walk the replay cue is hidden and the figure
  cluster is pointer-events:none, so the tap is a no-op — walk
  still "walking" after the tap, exactly one
  `[data-detective="watson"]` in every walking sample (never >1
  anywhere), clue-2 read + ack-2 each exactly once. RUN: passing
  in the Gate 1b walk-spec run (9/9).
- [x] **OBSERVATION (nit 5) — MEASUREMENT TAKEN: maxOverlap 0 px² (GATES-STATE Gate 2).**
  The finisher re-ran the probe (audit sampler + per-frame
  phase, watsonWalk OFF via `fulfillFlagsStaging`, 390px, two
  4 s windows, 9,600 pair samples): maxOverlap 0 px² (log
  `e2e-nit5b.log`). The probe's strict READING gate never latched
  in the walk-off flow, so the windows are recorded under their
  actual phases in GATES-STATE Gate 2.
- **Chromium outage — RESOLVED (see GATES-STATE Gate 1).** At the
  time this capsule was written, every NEW Chromium launch on
  this VM failed with `Hatch WebGL domain policy is required
  for browser startup` (chrome_main_delegate.cc:1283) — a
  runtime policy delivery break, not a code issue. The finisher
  re-test found the outage OVER on the real spec path
  (Playwright + bundled chromium-1243 launches and renders).
  The re-runs prescribed here are DONE — GATES-STATE Gates 1a/1b
  record the results. Historical detail, kept for the record:
  the endings run started 10:42 (VM clock) **failed both tests at
  browserType.launch** with exactly this error (full output in
  the run log; error contexts under `test-results/`); a bare
  `chrome --headless --dump-dom about:blank` reproduced it and
  was still failing at 11:38. The binary's strings show it
  requires `--hatch-webgl-allowed-domains-file` + `-sha256`
  switches that are not present on disk. Re-run prescription
  (DONE):
  `npx playwright test tests/e2e/detective-endings.spec.ts --workers=1`
  then `npx playwright test tests/e2e/detective-watson-walk.spec.ts --workers=1`
  (read the full reporter output — a piped `tail` masks the
  playwright exit code; that masking caused the correction
  above).
- [x] Gap-round gates: `npx tsc --noEmit` clean ·
  `npm test` PASS 2268/2268 · `npm run test:worker` PASS 145/145 ·
  `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` PASS (exit 0)

---

## Merged main record — fix/337-guess-counter (PR #340, main @ 5e6af2f9)

Preserved from main during the rebase onto 5e6af2f9: the #340
branch-status record that main carried at the merge. It is not this
branch's work; it is kept here so the rebase does not silently drop it.

### fix/337-guess-counter record (verbatim from main @ 5e6af2f9)

# BRANCH_STATUS — fix/337-guess-counter

- **Branch:** `fix/337-guess-counter`
- **Base:** `main` @ `775d8b4` (#329 merged) · synced with `main` @ `9e49da3` on 2026-11-08 (merge commit; see Sync below)

## Task capsule

TASK / requested outcome: Fix issue #337 — the GeoDetective header
counter overstates by one once a case is finished: a case lost on
its 6th guess read "Guess 7 of 6" (owner screenshot, 2026-11-03),
a 1-guess win read "Guess 2 of 5". Finished case: show the guesses
actually made. Playing state unchanged. Builder silo: build, open
the PR, stop. NO MERGE without the owner's per-PR word; Silo QA and
the panel follow as separate silos.

Tier and rationale: Tier 1 — Solo TDD. One bug, one expression, a
clear repro (the owner's screenshot + the seeded finished cases
below).

Done condition / evidence: a new E2E spec seeds finished cases and
asserts the truthful header — it fails on the unmodified build with
the exact pre-fix strings, and passes after the fix; the shipped
playing-state pins in geodetective.spec.ts stay green; all gates
green (tsc, npm test, lint-cards, build:pages).

Files in scope: `src/game/loop/LoopScreen.tsx` (the counter
expression on the LoopGame header line only),
`tests/e2e/guess-counter.desktop.spec.ts` (new), this file.
Protected / untouched: LoopScreen's deal paths and the "Case #N"
header block (owned by the parallel #336 run), every other surface.
Redundancy: grep-verified — the header counter at this line is the
only surface that renders "Guess N of {cap}" from
`guesses.length + 1`; the reveal's "Solved in X of Y guesses."
already counts actual guesses and is untouched.

Assumptions: the rendered cap for a resumed case comes from the
puzzle's deal snapshot (`dealStartClues` / `dealMaxGuesses` →
`persistedDealConfig`); the spec's seeds stamp those fields so the
asserted caps (6 for the loss, 5 for the win) are the caps the
header actually renders — confirmed by the red run's page snapshots.

## Status

- [x] Fresh clone at `~/workspace/meridian-counter-fix`, branch cut
      at `775d8b4`
- [x] RED: new spec on the unmodified build — 2 failed, both on the
      header assertion. Page snapshots in the Playwright error
      contexts show the exact pre-fix headers: `- status: Guess 7
      of 6` (lost seed) and `- status: Guess 2 of 5` (won seed).
      Both seeds validated cleanly: each case restored as its
      reveal ("Out of guesses" / "🎯 You found it!") before the
      header assertion failed
- [x] FIX: one line — `finished ? puzzle.guesses.length :
      puzzle.guesses.length + 1` (the `finished` value already in
      scope on LoopGame; the neighbouring "— N left" suffix was
      already gated on it)
- [x] GREEN + gates on the tip: `npx tsc --noEmit` exit 0 ·
      `npm test` exit 0 (scripts 943 pass / 11 skip / 0 fail;
      src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED ·
      `npm run build:pages` exit 0 · E2E under
      `flock ~/workspace/.e2e.lock`, `--workers=1`, against the
      Pages build: **19 passed / 1 failed of 20** — new spec 2/2,
      `geodetective.spec.ts` 17/18. Every counter pin stays green
      (playing state: "Guess 2 of 5" after one guess, "Guess 1 of
      5" on a fresh deal; the win-path snapshot shows the finished
      2-guess win header reading "Guess 2 of 5" — post-fix truth;
      pre-fix it read "Guess 3 of 5"), so the playing state is
      untouched. The 1 failure is NOT the counter — see next item
- [x] Pre-existing failure, proven on unmodified main: the
      geodetective win-path test (spec:199) fails at its share-text
      assertion (spec:256) — expected
      `https://meridian.knowledgetest.workers.dev/`, received the
      Pages URL `https://veeresh-bikkaneti.github.io/Meridian/`.
      Cause: the share origin follows the build's baked base
      (`shareOrigin` in `src/lib/og/share-meta.ts`); the harness
      serves the Pages build (base `/Meridian/`), while the pin
      expects the Workers origin (PR #128). Proven pre-existing:
      the identical test on unmodified main `775d8b4` (worktree,
      same Pages build recipe) fails with a byte-identical
      received share string. (One main run also flaked earlier on
      a sheet/reveal heading strict-mode race — transient timing,
      unrelated.) Out of scope for #337; flagged for the owner as
      a separate test-pin/build mismatch. Correction note: the
      first status commit claimed "21/21" — that was a misread of
      a piped E2E summary (the pipe masked Playwright's exit
      code); the true counts are as stated here
- [x] Redundancy grep on the tip: line 1134 is the only
      "Guess N of {cap}" render in `src/`; the only other
      cap-denominated surface, the reveal's "Solved in X of Y
      guesses." (line 1633), already counts actual guesses
- [x] PR opened against main — #340, still NO MERGE (owner's
      word only). The "now ticked" line in the PR body was false
      through `16daa5ad` (unchecked at `528df01` and `8e3ccda` too).

## Sync with main (2026-11-08, Rock — not a re-approval)

- Merged `origin/main` @ `9e49da3e` into this branch normally (no
  rebase, no force). The only conflict was this file (main carried
  another branch's status); resolved by keeping this PR's record.
  `LoopScreen.tsx` auto-merged; the fix line is now at line 1441
  (was 1134 at the original tip — main grew the file); it is still
  the only "Guess N of {cap}" render in `src/`.
- The panel's votes were on `8e3ccda`; this merge creates a new tip,
  so the panel must refresh on it. No merge without the owner's word.

- Gates on the merge tip `53a59b5` (2026-11-08, logs on the
  builder VM at /workspace/rock-pr340-logs): `npm ci` 0 · `tsc
  --noEmit` 0 · `typecheck:worker` 0 · `build` 0 · `npm test` 0
  (scripts 1023 pass / 9 skip / 0 fail; src 2266/2266) ·
  `test:worker` 145/145 · `lint-cards` GATE PASSED · `build:pages`
  0 · `lint:content` GATE PASSED · `check:flags` 0.
- E2E (`flock ~/workspace/.e2e.lock`, `--workers=1 --retries=0`,
  built Pages artifact). Browser: Playwright's bundled Chromium
  v1243 is NOT installed on this VM (it needs a download, not
  approved); ran with the config's documented override
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome` (Chrome
  156). `guess-counter.desktop.spec.ts` 2/2 pass;
  `geodetective.spec.ts` 17/18 — spec:199 (win path) fails at
  line 238: strict-mode violation, `heading "Ankara, Türkiye"`
  matches both the guess sheet's h2 and the reveal's h2.
  Pre-existing, not this PR: the identical test on unmodified main
  `9e49da3` fails 3/3 with the same error (`--repeat-each=3`); this
  tip also 3/3. This masks the older share-origin failure at
  spec:256 recorded above (not reached).
- GitHub's e2e job runs a fixed list of 6 specs that includes
  neither `guess-counter.desktop.spec.ts` nor
  `geodetective.spec.ts`, so CI green does not exercise this fix.

## P-Stack swarm on `16daa5ad` (2026-11-08 — not a 12-seat panel)

Owner ordered `/pstack:swarm` because the handbook persona pack
and `~/workspace/custom-skills/local-meridian-review-pipeline/SKILL.md`
are not on this machine. Role titles were not improvised as those
12 seats. Resolver `check-models-config.py` is not installed, so
each arm inherited the session model. The work model is unknown,
so this review may be same-model. Not a merge approval.

| Slice | SHA checked | Verdict |
|---|---|---|
| scope-and-regression | `16daa5ad` | PASS — 3 files; one counter line; merge-base `9e49da3` |
| counter-correctness | `16daa5ad` | PASS (SHA recorded; case table was thin — parent is re-checking the comment commit) |
| e2e-spec | `16daa5ad` | PASS |
| records-honesty | `16daa5ad` | ISSUES |

Kept from records-honesty (parent dropped two BLOCKs that treated
"not re-run in this session" as proof the builder VM log was false;
GitHub `build (22.x)` on `16daa5ad` is success and includes
`npm run build` + `npm test`):

- The PR body said a JSX why-comment was added. It was not in
  `16daa5ad`. This commit adds it above the counter. The expression
  is unchanged. It now sits under that comment (line moves by the
  comment only).
- The PR-opened checkbox was unticked. It is ticked above. PR #340
  is open. Still no merge.
- GitHub reviews API on #340 was empty. The "9 APPROVE / 3
  APPROVE-WITH-NITS on `8e3ccda`" sentence is PR-body prose, not a
  review object, and it does not cover this tip.

Independent re-run beside the builder log, not a replacement of it:
`tsc` 0, `test:worker` 145/145, `typecheck:worker` 0, lint-cards
GATE PASSED, lint-content GATE PASSED, `build:pages` 0,
`guess-counter.desktop.spec.ts` 2/2. Browser: Chrome for Testing
156.0.8078.4 (headless shell). `/usr/bin/google-chrome` was absent.
`npm test`: scripts 1021 pass / 11 skip / 0 fail, src 2266/2266.
The two extra skips versus 1023/9 are the SSR pins; `npm run build`
was not re-run here. `geodetective.spec.ts:199` was not re-run.
No Cloudflare Workers build result for `16daa5ad`.

## Sync with main (2026-11-08, verification-gate crew — not a re-approval)

- Merged `origin/main` @ `63d82869` (#372) into this branch (no
  rebase, no force; pushed by GitHub API replay — the created tree
  `e6ce631f` matched the local merge tree exactly). Merge commit
  `78b258e9`, parents `835ad2ef` + `63d82869`. The only conflict was
  this file; resolved by keeping this PR's record, per the standing
  per-branch convention. Branch diff vs main is now exactly 3 files:
  this file, `src/game/loop/LoopScreen.tsx`, and
  `tests/e2e/guess-counter.desktop.spec.ts` — the counter fix is
  unchanged (the expression sits at LoopScreen.tsx:1444 on this
  tip). GitHub reports the PR mergeable again.
- Gates on the merge tip `78b258e9` (2026-11-08, logs at
  `~/workspace/meridian-pr340-e2e/logs-gate/t340/` on this VM):
  `tsc --noEmit` 0 · `npm test` 0 (scripts 1021 pass / 11 skip /
  0 fail of 1032; src 2268/2268) · `test:worker` 145/145 ·
  `typecheck:worker` 0 · `lint-cards` GATE PASSED · `build:pages` 0.
- E2E (`flock ~/workspace/.e2e.lock`, `--workers=1`, built Pages
  artifact; browser = Playwright's bundled Chromium 1243 via the
  config's documented `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override —
  it IS installed on this VM): `guess-counter.desktop.spec.ts`
  **2/2 pass**. The 6 leftover failures from the original full-suite
  run were baseline-matched on pristine main `63d82869` first: ALL
  SIX are pre-existing, zero are regressions from this PR — five
  fail signature-identically on unmodified main
  (tutorial.spec.ts:125/166/174 strict-mode 'Take the tour' ×2;
  crash-watchdog.spec.ts:164 lastMilestone; offline-content
  .spec.ts:203 heading timeout), and offline-content.spec.ts:181 is
  a proven flake on both trees (storyteller-CSS preload console
  error; trace-settled as the test's own offline choreography).
  On this tip the same six fail with identical signatures
  (`logs-gate/t340/e2e-six.log`), plus the pre-existing
  telemetry-spill teardown error also present on main. Fixes for
  the four clusters were built under a signed Tier 2 council
  manifest on their OWN branches off main (this PR stays purely
  the counter fix): `fix/e2e-tutorial-tour-names` @ `acbd506d`,
  `fix/e2e-watchdog-milestone-assertion` @ `ed13b47f`,
  `fix/e2e-offline-loop-scenario` @ `ff0d2628`,
  `fix/e2e-offline-preload-assertion` @ `8cbe1b99` — each gated
  green on its own scope; no PRs opened for them.
- GitHub CI on `78b258e9`: `build (22.x)` SUCCESS · `e2e` (the
  fixed 6-spec job — still neither guess-counter nor geodetective)
  SUCCESS · GitGuardian SUCCESS. No Workers Builds result exists
  for this or any branch: branch builds are off account-wide
  (platform tag mismatch, fixed during PR #351 by disabling
  non-production branch builds); production Workers state is
  untouched by this work.
- This tip supersedes every earlier tip the panel or swarm looked
  at; the 12-seat panel + Reality Checker refresh on this tip is
  recorded in `~/workspace/meridian-pr340-e2e/CREW-REPORT-2.md`.
  Still NO MERGE without the owner's per-PR word.


---

## Merged main record — feat/u11-clue-renders (PR #370, main @ f2bbf1a2)

# BRANCH_STATUS — feat/u11-clue-renders

- **Branch:** `feat/u11-clue-renders` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Design of record:** clue-read diagnosis (evidence folder
  `clue-read-diagnosis/DIAGNOSIS.md`) + owner approval (Veeresh,
  2026-11-08 ~03:02 CST, in the `meridian` side chat): "Approve the
  full render — all 386 core cases."

## Task capsule

TASK / requested outcome: Phase A rendered clue audio for the
Capitals pack only, so 386 of the 387 core-deck cases had empty clue
entries in the audio manifest and their clues were never read aloud
(handbook ch.10 gate FG-3). Render all five clue reads for every core
case in Watson's cast voice, extend the manifest gate so an empty
core clue entry fails the build, and prove by ear-level E2E that a
core case's clues fetch and play.

OWNER APPROVAL (Veeresh, 2026-11-08): the full render of all 386
core cases, on the diagnosis that the playback machinery already
worked and only the renders were missing.

## Done

- [x] Pilot (cases 0–19): 105 rendered, 19% flagged, worst case
  479,225 B of the 500,000 B budget, ≈16.9 s/case at concurrency 4.
- [x] Full batch: 387/387 core cases carry all five clue reads
  (1,935 reads; case 137's five pre-existed). Core clue audio totals
  141.9 MB; the detective audio tree is 239 MB. Audio loads lazily
  per case — the entry JS chunk is unchanged (457,847 B).
- [x] Budget cures: five cases (28, 54, 87, 144, 289) busted the
  500,000 B budget on one very slow take each; re-encoding the
  affected clips at 32 kbit/s brought every case back under budget
  with pitch and duration measurements unchanged. Zero cases held.
- [x] Flagged disposition (explicit, not silent): 314 of 1,935 reads
  ship flagged by the pipeline's pitch/pace ladders — 103 outside
  Watson's family band (78–127 Hz), 6 under the 100 wpm pace floor,
  the rest inside-band pitch flags. A cure pass re-rendered the 103
  outside-band lines fresh: 0 landed inside the band, so the shipped
  takes stand. The Capitals pack ships the same flagged state
  (85 of 550) — flagged is the pipeline's designed "accepted with a
  note" state, and every flagged line is named in the PR body.
- [x] Manifest gate extended: `checkCoreCoverage` fails the build
  when a core case is neither claimed with all five reads nor on
  the explicit hold list (`coverage.coreHolds`, currently empty).
  Sabotage controls proven: an emptied entry (case 42), an
  over-budget case (case 10), and a dropped case (case 77) each
  fail the gate by name. Real tree: gate clean, 4,462 entries
  verified.
- [x] Handbook ch.10: FG-3 marked CLOSED by U11; the flip checklist's
  core-case item ticked with the closing E2E named.
- [x] Gates on the finished tree: typecheck clean · unit suites
  1,028 pass / 0 fail (scripts) + 2,266 / 2,266 (src) · worker
  145 / 145 · lint-cards GATE PASSED · build:pages green.

## Pending

- [x] E2E `tests/e2e/detective-core-audio.spec.ts` — **RUN AND
  PASSED 2026-11-09** (close-out below): all 3 tests by name —
  (a) all five clue clips fetched (HTTP 200) and play, in order ·
  (b) tap-Watson repeats the clue itself, not the ack or decode ·
  (c) solving at guess 2 flushes the queue.
- [x] Silo QA PASS @ `93a8fe52` (isolated worktree: manifest gate
  clean, typecheck, lint-cards, all suites green, silo's own
  sabotage control bites). **Key VOIDED by the close-out tip
  `fb46cf55` — Silo re-key is the next step.**
- [ ] Silo re-key, 13-seat panel vote, DevEx, benchmark; merge on
  READY under ship-when-ready; live check on both hosts.
- **LANE STOOD DOWN 2026-11-08** (owner's sequential pipeline
  law): queue position 3, behind the Watson-station cure and
  PR #364. (The lane later resumed and closed out in this file —
  see the Close-out section below; the old `RESUME-STATE.md`
  worktree file was retired 2026-11-09, its record lives in
  this file and the PR #370 body.)

## Close-out (2026-11-09, Agent ARCHIVE)

- **Merge-up done:** `origin/main` @ `5e6af2f9` merged in (merge
  commit `02798fd3`) — the two main commits past the old base
  `9e49da3` are `63d82869` (#372 Watson-station cure) and
  `5e6af2f9` (#340 guess counter). Sole conflict:
  `BRANCH_STATUS.md`, resolved keeping BOTH records (this U11
  capsule and main's #340 capsule both stand below). Handbook
  ch.10 auto-merged as a faithful union: main's Watson-station
  section came in, and this branch's FG-3 CLOSED record replaced
  main's open FG-3 text.
- **Playwright project added** (commit `6d4ad8e4`):
  `detective-core-audio` registered in `playwright.config.ts`
  immediately after `detective-berth` — the registration gap was
  why the spec never ran locally or in CI.
- **Fast gates on the merged + config tree, all PASS:**
  typecheck clean · `npm test` — scripts 1,028 pass / 0 fail,
  src 2,268 / 2,268 · worker 145 / 145 · lint-cards GATE PASSED ·
  audio manifest gate clean (4,462 entries verified) ·
  build:pages green (buildId `6d4ad8e4`).
- **E2E run 1** (log
  `~/workspace/meridian-detective-evidence/u11/e2e-core-audio.log`):
  2 passed, test (b) FAILED — a spec defect, not a product
  defect: test (b) scoped its `detective-watson-replay` locator
  inside the `loop-map` subtree, but the button renders at the
  station (the failure snapshot shows "Ask Watson to repeat this
  clue" below the map region); every other spec using this
  button scopes it page-wide. Fixed in commit `fb46cf55`
  (locator scope only — same button, same count assertion, same
  click; no assertion loosened).
- **E2E run 2** (log
  `~/workspace/meridian-detective-evidence/u11/e2e-core-audio-run2.log`):
  **3 passed (2.9 m), exit 0** — (a) core case: all five clue
  clips are fetched (HTTP 200) and play, in order · (b) core
  case: tap-Watson repeats the clue itself, not the ack or
  decode (replay started with `case-5/clue-1.mp3`) · (c) core
  case: solving at guess 2 flushes the queue — no clue audio
  fires after the solve.
- **Tip after close-out: `fb46cf55`.** Remaining: Silo re-key →
  panel → DevEx → benchmark → merge on the owner's word →
  live verification on both hosts.


---

## Merged main record — fix/credits-wait-for-content (PR #376, main @ f2bbf1a2)

## Capsule — fix/credits-wait-for-content (2026-11-09)

- **Branch:** `fix/credits-wait-for-content` · **Base:** `origin/main` @ `5e6af2f9`
- **Owner's word:** "Land the credits cure now as a tiny PR" (2026-11-09 14:36 CST).
- **Tier:** Tier 0/1 — one E2E spec file, no product code.
- **TASK:** Cure the no-wait race in `tests/e2e/credits.desktop.spec.ts`: `expectCreditsContent` read the body text once, immediately after the click/navigation, and asserted the credits strings — the credits route had not always rendered yet, so the test failed intermittently.
- **Evidence it is a spec race, not a product bug** (identical failure on unmodified main / other branches): main run `42511936129` (2026-11-08) · PR #370 tip run `42662167590` · `feat/journal-movies` run `42692238457` (2026-11-09) — while main passes other runs.
- **Cure:** `expectCreditsContent` now `expect.poll`s the body text (repo idiom, cf. band-film specs) until it carries the credits strings, then runs the original assertions unchanged — every assertion string kept at the same strength; only the waiting changed.
- **Files:** `tests/e2e/credits.desktop.spec.ts` + this capsule. Nothing else.
- **Proof:** build:pages green · credits spec 5 consecutive passes by name · full CI six-file set green once · tsc clean · lint-cards GATE PASSED (numbers in the PR body).
- **Merge:** NO MERGE without the owner's per-PR word. Once merged, PR #370 merges up and its red e2e check clears.

---

# BRANCH_STATUS — feat/pivot-flank (PR 2a integration, GATE, 2026-11-09)

- **Current tips (after the later merge-up onto main `10e8121d`, #369):** `feat/pivot-ack-renders` @ `c8f40692` (PR #385) → `feat/pivot-speech` @ `8475c111` (PR #386) → this branch @ `b8bfc8d4` (PR #387), the panel's final voting tip. The capsules below are the chronological record; where a capsule names an older tip, that tip was current when it was written.
- **Accuracy pass (pipeline tail, 2026-11-10):** the three PR 2a branch capsules in this file were re-read against the actual branch tips and diffs. The flank capsule chain below (panel → selection cure → instant-confirm cure → cure 2 → cure 3) is accurate, including its closing status line (panel complete, 0 BLOCKs on `b8bfc8d4`). The ack-renders capsule's two stale lines are annotated in place: the ack-7/ack-8 ear-check flag now carries its resolution (measurement ear check kept both clips; owner ear-approved ack-7, 2026-11-09), and its "Pending: GATE opens the PR" line is marked done (PR #385, final tip `c8f40692`). The speech piece's own capsule in this union file is the "GATE integration cure" capsule (the ack-pool spec pins landed on `feat/pivot-speech`); its gates line is historical — the cured specs were re-run repeatedly downstream, most recently in the Silo QA re-key battery on `b8bfc8d4` (replay 3/3 · watson-walk 8/9 + re-run 9/9 · sound 10/10).
- **Stack state:** the PR 2a train was rebased onto main `f2bbf1a2` (#370 + #376 merged) after #370's CSO sweep: `feat/pivot-ack-renders` @ `dcd4f717` → `feat/pivot-speech` @ `86ecbef7` → this branch. Manifest union verified: gate clean, 4,468 entries (main's 4,462 + ack-5…ack-10); fixed table 26, ack-1…ack-10 all present, `suspicion` single.
- **This commit (integration):** `playwright.config.ts` gains the `detective-flank` project (beside `detective-core-audio`, mirroring `detective-staging`), and the stale "TWO taps by design" comment in `tests/e2e/detective-sound.spec.ts` (f) is cured — the STAGE first-tap cure arms the gesture listener at player creation, so the first Listen tap now plays; assertions unchanged, second tap kept as belt-and-braces.
- **Pending:** GATE fast gates + the detective E2E set on this tip, then stacked PRs and the 13-seat panel on the final tip. No merge without the owner's per-PR word.

## Selection-read cure (PR 2a panel BLOCK cure, 2026-11-09)

- **Defect:** the speech piece's `selectionNamed` event had NO production dispatcher — `DetectiveHost` never sent it, so Holmes stayed silent from the player's pick until the guess was spent (the owner's core pivot promise: "when the player makes a selection on the map, Holmes reads it out loud acknowledging"). The shipped SELECTION_READ phase was driven only by `guessConfirmed` (the post-guess name + suspicion read) — picks (search + map tap) reached no machine input at all.
- **Cure:** the props whitelist gains `selectedPlaceId` (the player's CURRENT pick, null when nothing is picked). LoopScreen feeds it re-derived exactly as the sheet render and `onPick` re-derive it (`unlabeledSpotEntry(lon, lat).id` for `tap:` entries), so the read names the id the guess records under and the machine's dedup holds (confirming the just-named place speaks suspicion only). DetectiveHost dispatches `selectionNamed` once per pick landing (change to a new non-null id; never on clear or re-render). A clip-less pick (open water: `tap:` ids resolve to no name clip) is skipped by the player without stalling, as before.
- **Tests:** props builder unit tests (key pinned at 8, value pass-through, null default) + NEW E2E `tests/e2e/detective-selection-read.spec.ts` (registered as the `detective-selection-read` Playwright project): (a) the pick is named aloud BEFORE the guess is confirmed and the confirming guess speaks suspicion only; (b) flank ON — a pick made mid-clue-chain is held in the pending slot and named when the chain drains, before its guess is spent.
- **Records cures in the same run:** stale "count rotation" comments at the ack draw call site + the `acksPlayed` field doc now describe the random pool-minus-played draw; the `flags.ts` kill-switch comment no longer claims flag-off restores the two-tap Listen flow (the first-tap cure is ungated and stays). PR #387's body carries the "Post-merge flip — OWNED STEP" section (flip after the one-sitting train merges; kid read test n≥30 is the gate ON THE FLIP).
- **E2E on the cured tip [measured]:** selection-read **2/2** · flank 7/7 · replay 3/3 · staging 11/11 · core-audio 3/3 · sound 10/10 (one (g) failure in the batch run passed on its sequential re-run) · watson-walk 9/9 (the phone-390 main test failed twice in batch runs — its SELECTION_READ phase poll timed out at SEARCH_IDLE while the trace's network record shows the full chain playing in order (name → suspicion → ask-next → clue-2 → ack → decode) and the failure screenshot shows Clue 2 revealed with Watson stationed at it; it passed 5/5 on the next sequential run — a phase-window flake under VM load, same class as the sound (g) flake; no product defect found, no assertion touched).
- **Pending:** the panel re-vote on the cured tip. No merge without the owner's per-PR word.

## Follow-up cure — guess confirmed during the pick read (2026-11-10)

- **Defect:** a guess confirmed while the pick read is still playing lost its spoken reaction chain. Reproduced on the merge-up tip as the watson-walk phase poll timing out at SEARCH_IDLE, twice identical. **Verified mechanism [measured from the code]:** `speakSelection` does NOT change the phase, so the confirming `guessConfirmed` IS handled (from SEARCH_IDLE) — it enters SELECTION_READ and emits the guess read (suspicion only; the pick was just named) into the SAME player queue, behind the still-playing name clip. The player fires `speechEnded` ONCE per queue drain, not per clip, so the pick read and the guess read are one ladder step, never two. (The dispatch brief's inference — guessConfirmed dropped inside SELECTION_READ — does not hold; it is never sent there.)
- **Cure (final model):** a clue unlock landing in SELECTION_READ while a PICK read owns the voice (`selectionReadInFlight === false`) is stored as the deferred guess's payload PAIR — `pendingClue` (the payload) + `pendingGuessConfirm` (the marker recording whose clue it is). The single queue drain then runs the ordinary shipped bridge off `pendingClue` (miss beat → ask-next → clue); the marker starts the clue from the ASK_NEXT drain without a second ask, is cleared by a case ending or by the clue starting, and a `sheetClosed` finding it standing alone at rest reopens the bridge from it (split-drain safety net). **Suspicion is spoken exactly once** — by `guessConfirmed` at confirm time; the bridge speaks the plain ask (a unit pin counts name ×1 and suspicion ×1 across the whole flow). A guess read already in flight keeps the shipped behaviour untouched (pendingClue only, no marker). Endings keep precedence: `pendingEnd` at the drain, or the ending's direct entry once the bridge stands — the marker is cleared either way.
- **First model corrected by its own E2E:** an earlier shape of this cure settled the ladder at SEARCH_IDLE on the pick drain and opened the bridge from a LATER `sheetClosed` — but the confirm already closed the sheet before the drain, so no trigger remained and the clue never started (selection-read (b) and the new (c) timed out at the clue-2 audio poll while the name/suspicion assertions passed). The pair + drain-triggered bridge above is the correction; the `beatElapsed` suspicion arm of the first model was also removed (it would have played the suspicion a second time in real play).
- **Sibling decision:** `selectionNamed` DURING SELECTION_READ stays DROPPED (default no-op), unchanged — a guess owns the voice; that pick is still named at its own confirm via the normal guess read. The defer slot does not fit it cleanly: `pendingSelection` is discarded on guess/clue-unlock/case-end by law, and a second selection read queued behind a guess read would break those discard laws.
- **Tests:** NEW unit pins `src/game/loop/detective/detective-deferred-guess.test.ts` (6: the pair + the drain running the bridge · the bridge asks, never a second suspicion, then the clue starts · guess-read-in-flight keeps the shipped bridge · solve/fail while the bridge stands still win · solve mid-reads defers via pendingEnd and wins at the drain). NEW E2E case (c) in `tests/e2e/detective-selection-read.spec.ts`: pick → confirm INSTANTLY (no wait for the name clip) → suspicion still plays after the name, the name plays exactly once, and the case continues to clue 2. The watson-walk spec is UNMODIFIED — its assertions are the contract.
- **Gates on the cured tip [measured]:** tsc clean · `npm test` **2,315/2,315** · worker 145/145 · lint-cards GATE PASSED · manifest clean 4,468 · build green. **E2E [measured]:** selection-read **3/3** · watson-walk **9/9** (the tablet-768 main test failed the batch run at the SELECTION_READ phase poll — at recorder rate 3 that phase window is sub-second — and passed its sequential re-run; a deterministic stall cannot pass a re-run, and the audio-asserting selection-read (b)/(c) pass, so this is the known phase-window poll flake under VM contention, named as such) · flank 7/7 · replay 3/3 · sound 10/10.
- **Pending:** the panel re-vote on the final tip (touched seats) + the staged Game Player + the owner-config playthrough gate. No merge without the owner's per-PR word; merges #385 → #386 → #387 in one sitting.

## Follow-up cure 2 — guess confirmed just after the pick read ends (2026-11-10)

- **Defect:** the Game Player re-vote on `65629760` BLOCKED (leg 4): the pick (Las Vegas) was named, the player tapped "Guess this place" immediately AFTER the name clip finished, and the guess committed visibly in silence — `fixed/suspicion.mp3` never played, no ask-next, the machine sat in SEARCH_IDLE at +10/+30/+60 s. The deferred-guess pair (follow-up cure 1) covered a confirm DURING the pick read; the reaction did not provably survive the read's exit instant.
- **Verified mechanism [measured from the code + RED pins]:** a pick read never changes the phase (`speakSelection` stays in SEARCH), so its drain reaches the machine as a `speechEnded` in SEARCH_IDLE/SEARCH_AREA — an event the shipped machine drops as a no-op. `selectionReadInFlight` (set false by `speakSelection`) is therefore NEVER restored at rest: the machine carries a stale "pick read in flight" kind indefinitely, and a post-name confirm's routing depended on that stale flag instead of on any recorded arming history. The new pins (i) and (iii) fail on the unmodified tip on exactly this restoration assertion (stash-verified RED), and pass with the cure (GREEN).
- **Cure (state logic only, timing-independent):** the `speechEnded` handler gains a pre-check — a drain in SEARCH_IDLE/SEARCH_AREA with a pick read outstanding restores `selectionReadInFlight` AND leaves the arming trace standing in a new field, `selectionReadKind: "post-pick"`. `guessConfirmed` preserves a standing `"post-pick"` (a pick still playing ahead of it also arms `"post-pick"`; an ordinary at-rest guess arms `"direct"`), and `clueUnlocked` routes a `"post-pick"` read's unlock to the SAME deferred-guess pair branch as the during-read window — one mechanism, no parallel path: suspicion exactly once, then the ordinary bridge (miss beat → ask-next → clue). Endings keep precedence (`pendingEnd` at the drain, per the shipped semantics). `selectionReadDone` keeps its single shipped meaning (the sheetClosed ASK_NEXT trigger): its one writer of true stays `afterSelectionRead` on a guess read's exit — an earlier cure-2 draft overloaded it and broke the shipped U7/sheet-flow pins (`detective-state.test.ts` :402/:674 class); that draft was corrected, and those pins pass untouched.
- **Three-window law (the contract this cure pins):** (1) confirm DURING the name clip — the cure-1 pair, unchanged; (2) confirm JUST AFTER the name clip ends — the pre-check restores the kind and leaves the post-pick trace, so the confirm defers exactly as in window 1; (3) confirm at rest — the ordinary shipped path, `"direct"`, untouched. A solved confirm at the exit instant defers via `pendingEnd` and celebrates at the drain (pin (ii) — a contract pin for the shipped deferral semantics, corrected from a first draft that wrongly expected an immediate CELEBRATE from SELECTION_READ).
- **Player layer investigated and exonerated [measured]:** a candidate player-side cure (an `inFlight` guard on the selection latest-wins splice in `detective-audio.ts`) was built, then stash-tested: the pin written for it passes with the player change REMOVED (the in-flight ref is never in the queue array — the player shifts before it plays — so the splice cannot eat it). Both player files were reverted; NO player change lands in this cure. **Stated plainly:** the Game Player freeze additionally required, in that run, a drain that never reached the machine at all (it sat in SEARCH_IDLE, where a dispatched `guessConfirmed` always enters SELECTION_READ) — a host-layer path this repo has no test pattern to reach (no host-render tests exist). The machine contract is now correct for every event ordering; the staged Game Player re-play on this tip (owner tap-mode config, BOTH confirm timings) is the judge of the host path.
- **Tests:** 3 NEW unit pins in `detective-deferred-guess.test.ts` (post-name confirm keeps its reaction: suspicion ×1, name ×1, pair stored, bridge runs · solved confirm at the exit instant celebrates at the drain, no guess read into a closed case · the exit drain alone never mistakes itself for a guess read and the dedup survives it) — file now 9 pins, all green; the 6 cure-1 pins and the shipped detective-state/selection suites (97 tests across the four detective files) all pass. NEW E2E case (d) in `tests/e2e/detective-selection-read.spec.ts`: pick → wait for the name clip's own `ended` flag → confirm immediately → suspicion plays after the name, name exactly once, case continues to clue 2. Case (c) UNMODIFIED; the watson-walk spec UNTOUCHED.
- **Gates on the cured tip [measured]:** tsc clean · `npm test` scripts 1,161 pass / 0 fail · src **2,318/2,318** (2,315 + 3 new pins) · worker 145/145 · lint-cards GATE PASSED · manifest clean 4,468 · build green.
- **E2E [measured, sequential `--workers=1` under flock, chromium-1243]:** selection-read **4/4** (incl. new (d), 26.5 s) · flank **7/7** · replay **3/3** · sound **10/10** ((g) failed the batch run, passed its sequential re-run — the named flake) · watson-walk **8/9 in every run this session** — the phone-390 main test fails at the SELECTION_READ phase poll (spec line 256: 60 s poll, phase stays SEARCH_IDLE). **Control [measured]: the identical failure reproduces on the UNMODIFIED `65629760` build (stash + rebuild + same test: 1 failed / 4 passed, same signature)** — pre-existing in this environment, the same phase-window poll class cure 1's capsule recorded (it passed 5/5 sequentially in that run); NOT a cure-2 regression, and no assertion was touched. The guess path itself is proven deterministically by the audio-asserting selection-read (c)+(d) pins.
- **Pending:** Game Player RE-PLAY on this tip (both timings, owner config) → DevEx + benchmark stages → verdict to the owner. No merge without the owner's per-PR word; merges #385 → #386 → #387 in one sitting; the `detectiveFlank` flip stays gated on the kid read test.

## Follow-up cure 3 — the tap-mode silent guess (2026-11-10)

- **Defect:** the Game Player BLOCKED the stack twice in the owner's own configuration (read-aloud pref "sometimes" = TAP MODE): a guess confirmed after Holmes named the pick — DURING the name clip and in the first instant AFTER it ended — committed visibly in silence; `fixed/suspicion.mp3` never played. Cures 1 and 2 fixed the machine's routing for both windows and the auto-mode E2E proved them, but every played failure was tap-mode-only and every passing spec ran auto mode — the loss was never in the machine.
- **Verified mechanism [measured — step-0 instrumented run, evidence `pr2a/cure3/step0-probe-log.md`]:** a temporary probe in the host logged every machine dispatch and every player drain's guard inputs across a full played tap-mode session (Listen → pick → confirm, both windows). Findings: (1) the host's `onSpeakingChange` guard (`heldClueRef || deferredDrainRef`) was NEVER up — every drain logged `held=null deferred=false -> DISPATCHED`; there is no swallowed drain (the host hunt's one inferred link does not hold: `heldClueRef` is only ever set by the walk gate in AUTO mode, and `deferredDrainRef` only when a held clue is dropped, so in tap mode neither can stand). (2) `guessConfirmed` IS dispatched in tap mode and the machine answers it correctly — SELECTION_READ, `speak:fixed:suspicion` emitted, the pick drain delivered beforehand (cure 2's pre-check fires, kind "post-pick"), and the ladder bridges NOTE_MARK → ASK_NEXT → the next clue exactly as designed. (3) The emitted suspicion (and ask-next) clips NEVER reach `play()`: the player's tap branch resolves every non-selection item as skipped, and the guess read's refs (name without the selection flag, suspicion a plain fixed ref) were never marked as what they are — gesture-initiated speech, caused by the kid's own confirm tap, exactly like the pick read the selecting tap already exempts. The machine spoke; the player declined to play it, in tap mode only.
- **Cure (player marking, host-armed; the machine untouched):** `detective-audio.ts` gains a guess-read window — `armGuessRead()` / `disarmGuessRead()` on the player. Refs enqueued while armed join a `guessItems` set and take the same tap-mode path as selection reads (play for real; the sound gate still applies, the autoplay veto does not). The set is SEPARATE from `selectionItems` on purpose: the selection path's latest-wins splice removes queued items by set membership, and a guess already spent must never be spliced out by a later pick (a unit pin holds exactly that queue shape). `DetectiveHost.tsx` arms the player around its ONE `guessConfirmed` dispatch (the guess effect) and disarms immediately after — the dispatch is synchronous, so the window brackets exactly the guess read's burst and nothing else. Drain accounting is untouched: guess reads drain through the ordinary `onSpeakingChange` path. "off" mode still skips everything; auto mode is byte-for-byte the shipped behaviour (the mark is inert there).
- **Deviation from the cure brief, stated plainly:** the brief (from the host hunt) prescribed host-side drain accounting and no audio change. Step 0's measurement killed that premise — there is no swallowed drain to account for — and the hunt's own §5 set the burden for an audio change: a failing played-level pin the prescribed cure cannot fix. The pin below fails pre-cure on both beats, and drain accounting provably cannot move it (zero swallows in the session). The change therefore lands where the loss is measured to be: the player's tap-mode skip, armed from the host. `detective-state.ts` untouched, as ordered.
- **Tests:** NEW played-level pin `tests/e2e/detective-tapmode-selection.spec.ts` (registered as the `detective-tapmode-selection` Playwright project): the OWNER'S configuration — pref "sometimes" seeded before first load, flank on, 390 px, held chains released by one Listen tap — (during) pick Las Vegas, confirm while the name clip is still playing; (after) pick Paris, wait for the name element's own `ended` flag, confirm in the next breath. Both assert: suspicion plays, the name was read exactly once, the counter shows Guess 2, and clue 2's chain is what Listen releases next. **Pre-cure RED [measured]: both tests fail on the suspicion assertion (30 s poll timeout) against the unmodified `99de79f1` build** (log: `pr2a/cure3/pin-precure-red.log`). Post-cure GREEN [measured]: 2/2 (log: `pr2a/cure3/pin-postcure-green.log`). NEW unit pins in `detective-audio.test.ts` (4): armed guess read (name + suspicion) plays for real in tap mode, in order, unarmed stays skipped · the sound gate still silences an armed guess read · a pick read never splices a queued guess read · arming is inert in auto mode.
- **Gates on the cured tip [measured]:** tsc clean · `npm test` scripts 1,161 pass / 0 fail · src **2,322/2,322** (2,318 + 4 new pins) · worker 145/145 · lint-cards GATE PASSED · manifest clean 4,468 · build green. **E2E [measured, sequential `--workers=1` under flock, chromium-1243]:** the full detective battery in ONE run — selection-read **4/4** · watson-walk **9/9** · flank **7/7** · replay **3/3** · sound **10/10** · staging **11/11** · core-audio **3/3** = **47/47** (log: `pr2a/cure3/e2e-regression.log`) — plus the new tap-mode pin **2/2** above. Two adjudication re-runs were also done because the runtime's delivery of the battery output carried failure blocks that appear nowhere in the run's own log (no ✘ marks; stale test-results content): selection-read re-run **4/4** · watson-walk re-run **8/9** — the phone-390 main test failed the standalone re-run at the SELECTION_READ phase poll, the same intermittent signature control-proven pre-existing on the UNMODIFIED `65629760` build in cure 2's capsule (it passed in this cure's battery at 46.0 s); no assertion touched, and cure 3's surface (tap-mode marking + one wrapped dispatch) cannot move an auto-mode phase window.
- **Pending:** Game Player RE-PLAY on this tip (both timings, owner tap-mode config — the re-play wins any disagreement with the spec, per the hunt) → panel re-vote (touched seats) → DevEx + benchmark → verdict to the owner. No merge without the owner's per-PR word; merges #385 → #386 → #387 in one sitting; the `detectiveFlank` flip stays gated on the kid read test.
- **Status update (pipeline tail, 2026-11-10):** the re-vote round 3 code seats (Senior Developer + Game Developer) both returned APPROVE-WITH-NITS on this tip, and the Game Player re-play round 3 passed the owner-config gate — the panel is complete with 0 BLOCKs on `b8bfc8d4`. The remaining pipeline stages (Silo QA re-key, benchmark, DevEx/records) run on this tip; the verdict then goes to the owner. Merges stay the owner's hand, one sitting, #385 → #386 → #387.
- **Silo QA re-key on `b8bfc8d4` (pipeline tail, 2026-11-10) — PASS-WITH-NITS:** fast gates all green (tsc clean · scripts 1,161/0 · src 2,322/2,322 · worker 145/145 · lint-cards GATE PASSED · manifest clean 4,468 · build green, buildId `b8bfc8d4`). E2E battery (49 tests, sequential, flock, chromium-1243): **47 passed / 2 failed** — both failures were the watson-walk main test at phone 390 and desktop 1280, both on the SELECTION_READ phase poll at spec line 256 (phase stays SEARCH_IDLE), the known phase-window poll signature; the sanctioned single sequential re-run of the suite passed **9/9**. Sabotage control BITES: removing `public/audio/detective/fixed/ack-7.mp3` makes the manifest gate exit 2 naming `fixed.ack-7`; restore returns the gate to clean (4,468). CI glance: #385 fully green at `c8f40692` (build + e2e + GitGuardian); #386/#387 GitGuardian PASS, Node CI unlisted (branch-base PRs — expected). Benchmark vs main `10e8121d`: JS gzip +0.021% · CSS gzip +0.31% — **PASS** vs the ≤5% gate; manifest +2,349 B (the 6 ack entries, exactly as forecast); audio tree +78,027 B (the 6 ack clips).
