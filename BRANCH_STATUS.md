# BRANCH_STATUS — feat/loading-orbs

**Branch:** `feat/loading-orbs`
**Base:** origin/main @ `5f6164b` (PR #247 merged 2026-10-25 18:37 CDT; PR #243 merged 2026-10-25 15:44 CDT; PR #242 merged 2026-10-25 11:22 CDT)
**Rebased head:** `3e46c15399ec57ee06e311b4cce95e69653a1332` (`3e46c15` — the rebased equivalent of the selector-fix commit `69e9dd5`; see Rebase section below). This docs correction rides on top of `3e46c15`.
**State: PANEL-REVIEWED, REBASED onto `5f6164b`, LOCAL ONLY — NOT pushed.**
**Remote branch:** EXISTS — `origin/feat/loading-orbs` is pushed through `5f434a5`. PR #246 is OPEN at head `5f434a5`. The rebased head `3e46c15` (and this docs commit on top of it) is committed locally and NOT pushed; push awaits the owner's word.

This branch replaces the stale record that used to live here (old
card-redesign branch, base `28c5fea`, PR #242 OPEN). That record is
superseded: #242 is merged, and this branch starts from its merge.

## Rebase onto 5f6164b (2026-10-25, rebase seat)

- Old head: `69e9dd5b463df10043c936f7f0f4f0eee5df6126` (`69e9dd5`); old base `d26b90a`; new base `origin/main` = `5f6164bc4005910b2671bcb83dc66a7358b46d0d` (`5f6164b`, "feat(crash reports): Slice 1 — verdict + why line on every crash report (#247)", merged 2026-10-25 18:37 CDT).
- Rebased chain (same messages, new SHAs): `60d1666` (feat, ex-`dc8ad13`), `f74f613` (fix, ex-`a40ebff`), `b5b6b85` (test, ex-`675880a`), `34b3035` (docs, ex-`9a402e1`), `119fe0b` (docs, ex-`53a84d8`), `3e46c15` (test, ex-`69e9dd5`).
- Conflicts: BRANCH_STATUS.md ONLY, at the first replayed commit (`dc8ad13`). Two hunks, both resolved by keeping this branch's record (the `dc8ad13` version of the file, verbatim — verified byte-identical to `dc8ad13:BRANCH_STATUS.md`): hunk 1, header (crash-reports record from #247 vs orb record); hunk 2, scope/commits/evidence/gates/pending body (same sides). The #247 record is not lost — it lives on main at `5f6164b`. No code conflicts: #247's files (observability lib, crash-report worker, crash-classification spec) are disjoint from every orb file, and the replayed commits after the first applied with no further conflict.
- Code check after rebase: tree diff old head `69e9dd5` → rebased head `3e46c15` is exactly #247's five files (`src/lib/observability.ts` + test, `workers/crash-report/src/index.ts` + test, `tests/e2e/crash-classification.mobile.spec.ts`) — no orb code gained or lost, no silent side taken. BRANCH_STATUS.md is byte-identical at both ends (the conflict resolution kept the branch record and the replayed docs commits restored it), so it does not appear in the diff.
- Live PR state at rebase time: PR #246 OPEN, head `5f434a5`, mergeStateStatus DIRTY (conflicting) before the rebase. This rebased head is local only and NOT pushed; the remote still reads `5f434a5` until the owner orders a push.
- Stale lines corrected by this commit: base `d26b90a` → `5f6164b`; rebased head `9a402e1` → `3e46c15` above. No feature or src changes in this commit (BRANCH_STATUS.md only). Construction caveat (same as last rebase): the file names `3e46c15` (the rebased app head) and cannot contain its own commit SHA, which is recorded in `review-orb-rebase2/rebase-record.md` and `git log` instead.

## Rebase onto d26b90a (2026-10-25, frontend seat)

- Old head: `5f434a54ce7d5cddfd17e5aff8a947d97cdef718` (`5f434a5`); old base `ddb6d28`; new base `origin/main` = `d26b90ab0defc5609f3dc452e1ded685572aa8d0` (`d26b90a`, "Merge pull request #243").
- Rebased chain (same messages, new SHAs): `dc8ad13` (feat, ex-`1ccc1fb`), `a40ebff` (fix, ex-`bf4f8d7`), `675880a` (test, ex-`e0df8e5`), `9a402e1` (docs, ex-`5f434a5`).
- Conflicts: BRANCH_STATUS.md ONLY, at the first replayed commit (`1ccc1fb`). Two hunks, both resolved by keeping this branch's record (the `1ccc1fb` version of the file, verbatim — verified byte-identical to `1ccc1fb:BRANCH_STATUS.md`): hunk 1, header (storyteller-pending-tap record from #243 vs orb record); hunk 2, scope/commits/evidence/gates/pending body (same sides). The #243 record is not lost — it lives on main at `d26b90a`. No code conflicts: `game-app.tsx`, `home-globe.tsx`, `home-v5.css`, `home-loading-orbs.test.ts`, `lazy-home-image.tsx` all auto-merged, and the replayed commits after the first applied with no further conflict.
- Code check after rebase: tree diff old head `5f434a5` → rebased head `9a402e1`, excluding BRANCH_STATUS.md, is exactly #243's two files (`src/components/storyteller-home.tsx` +95/−1, `tests/e2e/storyteller-narration-tap-pending.desktop.spec.ts` +220) — no orb code gained or lost, no silent side taken.
- Live PR state at rebase time: PR #246 OPEN, head `5f434a5`, mergeStateStatus DIRTY (conflicting) before the rebase. This rebased head is local only and NOT pushed; the remote still reads `5f434a5` until the owner orders a push.
- Stale lines corrected by this commit: base `ddb6d28` → `d26b90a`; "remote does NOT exist / push pending" and "none pushed yet" (panel-time wording — the branch was in fact pushed through `5f434a5` before this rebase); "Head at last panel run: `e0df8e5`" → rebased head `9a402e1` above. No feature or src changes in this commit (BRANCH_STATUS.md only).

## Scope (exactly this — owner-decided, no expansion)

- **1. Globe zone loading orb** (`src/components/home-globe.tsx` +
  `src/components/home-v5.css`): a HomeGlobe-INTERNAL placeholder. New
  `textured` state (default false), plumbed via an `onTextured` callback
  into `initGlobe` so `TextureLoader`'s onLoad fires it (existing
  colorSpace/anisotropy work kept). The orb overlay renders INSIDE the
  mount div while the texture is pending, then crossfades out (CSS
  opacity transition, unmounted on a single transitionend handler — no
  timer chains). The overlay is aria-hidden, pointer-events:none,
  absolutely positioned + centered, and covers the mount opaquely (hero
  gradient) so no black/faceted pre-texture frame shows through. The
  mount keeps its aspect-ratio box: measured orb-sequence CLS is 0 at
  390/1280 (motion-ON, headless — see Gates; reduced-motion CLS was
  not measured).
- **2. Lazy card-image loading orbs** (`src/components/game-app.tsx`
  home page ONLY + new shared `src/components/lazy-home-image.tsx`):
  one wrapper rendering the same reused `.meridian-spinner` overlay
  centered over the image until onLoad fires, then the same
  fade-on-transitionend pattern. Used at exactly the six verified home
  lazy sites, each img's classes/src/alt/aria preserved exactly:
  GeoDetective `.hv5-pic` (desertRuinsUrl), Cold Trail `.hv5-pic`
  (patagoniaUrl), Review `.hv5-art` (archiveToolsUrl), journal teaser
  `.hv5-art` (journalTreeUrl), grown-ups `.hv5-art`
  (binocularsHatUrl), journal entry `.hv5-entry-art` figures
  (`journalImageUrl(note.image)`, alt kept as `note.imageAlt`). The
  wrapper carries the image's layout class, so card layout is
  unchanged. Cached images: complete && naturalWidth > 0 at mount
  skips the orb outright (no polling). On error the orb clears and
  current browser behavior applies — no error-fallback UI invented
  (that design ruling is still owed by the owner).
- **Visual correction applied:** there is NO dedicated "thinking orb"
  component in this codebase (BootSplash is text-only). Both orbs reuse
  the existing `.meridian-spinner` (border spinner, 900ms linear
  infinite; reduced-motion query kills the spin → static ring). No new
  multi-dot orb design was invented, no new image assets.

## Fix (bf4f8d7) — the deterministic E2E failure found on 1ccc1fb

The first test run on `1ccc1fb` went 7/8 with a deterministic (3/3
repeat) failure: the three `.hv5-art` spot wrappers were 0px tall
while their images were pending (measured 172×0 / 148×0 / 178×0), so
`overflow:hidden` clipped the spinner entirely even though the orb
was in DOM at opacity 1. The fix adds intrinsic `aspect-ratio` to
the three `.hv5-art` rules only (Review 400/269, journal 1/1,
grown-ups 1/1 — ratios verified against the real image files by two
seats, not taken from the fix report). Post-load geometry is
identical before/after at 390/768/1280, and held == loaded at 390,
so there is no pre→post shift. NOTE: at 390 the held boxes
(172×74.19 / 148×104.77 / 178×120.45) do NOT match the declared
ratios — a narrow-layout clamp dominates there, so the 390 mechanism
is unexplained (held == loaded saves it empirically). See Known
limits: the 390 non-square box is pre-existing baseline behavior
and deserves its own ticket.

## Explicitly NOT touched

- The globe-zone `Suspense fallback={null}` in game-app.tsx (a fallback
  swap cannot cover the post-mount waterfall — forbidden, left alone).
- No eager three.js load; the IntersectionObserver gate
  (rootMargin 200px) is unchanged — the placeholder shows when the zone
  is reached, not on first paint below the fold (expected, not a defect).
- Edition maps (Loading pill + Try-Again dialog + MapLoadingFallback),
  stories/storyteller, BootSplash, first-load/update orbs, and every
  other wait. No orbs anywhere else.
- Fallback paths unchanged: reduced-motion / Save-Data / low-memory /
  WebGL failure / import failure / texture onError all land on the
  existing static disc, with NO orb (the disc IS the content).
  Dispose/teardown leak-free: `disposed` flag guards all post-unmount
  setState.
- Reduced motion (standing law): placeholders are STATIC — overlays
  declare no animation of their own, and the spinner's existing
  reduced-motion media query kills the spin. The opacity transition is
  deliberately kept under reduced motion so the transitionend unmount
  still fires (a fade is not spinning motion, and killing the
  transition would strand the overlay in the DOM).
- No changes to #242's merged code beyond placeholder wiring. No
  refactoring of working code.

## Tests

- New `src/components/home-loading-orbs.test.ts` (16 tests, colocated
  per repo convention). No React-render/jsdom harness exists in this
  repo, so — following the `game-app-lazy-boundary.test.ts` precedent —
  the wiring is pinned by reading the source: orb shows initially, orb
  clears on load, orb clears on error, cached-complete shows no
  lingering orb, reduced-motion static variant, globe textured-state
  transition plumbing (three.js itself is NOT faked in unit tests).
  The 16 tests pass in all three seat logs that ran the full suite.
- E2E: `tests/e2e/loading-orbs.desktop.spec.ts` (8 tests, committed
  at `e0df8e5`): globe orb → crossfade at 1280 and 390; reduced-motion
  static placeholder with zero spin; card-image orb → clears on load;
  journal-entry image orb → clears on load; orb clears on image
  error; no orb on maps/stories; masked-blob orb renders inside the
  masked `.hv5-art` shape. Assertions use `toBeVisible()` on real orb
  elements (not DOM presence — DOM presence is what the 1ccc1fb bug
  hid behind). Spec-level results on `e0df8e5`: 70/70 orb assertions
  passed when the page loaded, with 2 pre-assertion harness failures
  in 72 executions (see Gates / Known limits — environmental serving
  flake, not a feature failure).

## Gates (reconciled by the test-results analyzer from seat logs — see review-orb-evidence/test-results/ANALYSIS.md)

- `npx tsc --noEmit`: CLEAN, exit 0 (log-proven on `e0df8e5` by the
  verification seat; also clean on `1ccc1fb`).
- `npm test`: GREEN, exit 0, on `e0df8e5` (verification seat,
  log-proven — the ONLY log-proven full gates on `e0df8e5`).
  Scripts suite: 841 tests (832 pass, 9 skipped, 0 fail). Src suite:
  1555 tests, 1555 pass, 0 fail, 119 suites (includes the 16 new
  home-loading-orbs tests). Combined: 2396 tests, 2387 pass,
  9 skipped, 0 fail. (Wording note: "2396 tests" is the total and
  "2387 pass" is the passing count — the same result, not two
  numbers. The verification seat's report quoted only the src line;
  its log contains both summaries.)
- Head-label honesty note: the fix seat's npm test / tsc / lint ran
  on its working tree at HEAD `1ccc1fb` (its npm-test.log stamps
  buildId `1ccc1fb`), NOT on `bf4f8d7` — only its build + E2E are
  `bf4f8d7`. Numerical impact nil (pure-CSS fix, identical totals),
  but the labels matter and are corrected here.
- `node scripts/lint-cards.mjs`: GATE PASSED, confirmed verbatim in
  3 seat logs (chunk audit 124690 records: 8802 with hook, 115888
  hook-missing, 0 legacy, 0 curated-note violations; arithmetic
  checks: 8802 + 115888 = 124690).
- `npm run build:pages`: GREEN, exit 0. Stamp verified `e0df8e5`
  (build-meta.json buildId == `e0df8e5`, sw.js VERSION ==
  `meridian-e0df8e5`) by the verification seat (live dist, mtime
  2026-10-25 18:14:53Z) and reported by the skeptic / a11y / ux /
  game seats. Earlier stale-stamp episodes (implementer built
  pre-commit at `ddb6d28`; test seat rebuilt `ddb6d28` → `1ccc1fb`;
  every panel seat rebuilt `bf4f8d7` → `e0df8e5`) were all caught by
  rebuilding before testing — no E2E ran against a stale artifact.
- CLS (measured, verification seat, motion-ON, headless Chromium
  152): orb-sequence Δ = 0 at both 1280 and 390 (page totals
  0.000097 / 0.000237, each from a single initial-load shift before
  any orb release — far below the 0.1 "good" threshold).
  Reduced-motion CLS was NOT measured; no real-device CLS exists.

## Commits (pre-rebase chain — push state: see Rebase section)

- `1ccc1fb` — feat(home): loading orbs for globe zone + lazy card images
- `bf4f8d7` — fix(home): pre-load height for .hv5-art spot wrappers so card orbs paint during wait
- `e0df8e5` — test(home): E2E spec for loading orbs (globe + lazy card images) — spec-only, 244 insertions. NOTE (honest record): this commit was made by a panel seat during the panel run, against its brief (it was told not to commit). The Chair verified it spec-only via `git show --stat` and kept it; no further panel-seat commits were authorized.
- Docs commit (this refresh + the spec comment fix) lands on top of `e0df8e5` as part of Chair close-out; the Chair re-runs gates + the spec on the docs head before pushing.
- Rebase note (2026-10-25): the pre-rebase chain above WAS pushed through `5f434a5` (PR #246 OPEN); see the Rebase section at the top of this file for the rebased chain and push state.

## Panel verdicts (all seats, head e0df8e5 unless noted)

- Code review (`1ccc1fb`): APPROVE-WITH-NITS, zero blockers.
  Fix re-check (`1ccc1fb..bf4f8d7`): APPROVE-WITH-NITS — ratios
  verified against the real image files; selectors target only the
  three spot rules; original verdict stands.
- Test verification (`e0df8e5`): PASS — gates green (log-proven),
  spec single 8/8 + repeat 24/24 + supplemental repeat 24/24 =
  56/56, orb-sequence CLS 0, fresh recordings (motion OFF/ON,
  1280/390) showing the fixed behavior, masked-blob screenshot
  captured. Qualifications: 390 non-square art box; serving-flake
  note (see below).
- Accessibility: NON-GATING — no Critical/Serious issue. Reduced
  motion evidenced (static disc, static ring, overlay still clears
  via the 0.01ms transitionend path); ARIA/keyboard/zoom/
  forced-colors clean. Limits: no live screen reader in this VM
  (DOM/ARIA + keyboard walk instead); no true browser zoom (reflow
  equivalents); no automated axe/Lighthouse scan; no real devices.
- UX: 9/10, NOTHING GATING. Issues: UX-1 globe load not announced
  to AT (minor follow-up: visually-hidden role="status" for globe
  only); UX-2 static ring under reduced motion is a weaker cue
  (cosmetic — "still parses in context; correct trade"); UX-3
  error-path broken-image glyph (minor, pre-existing); UX-4 390 box
  shorter than intrinsic ratio (cosmetic, pre-existing). Path to
  10/10 is UX-1 only, as a follow-up.
- Game design (child readability): CONDITIONAL PASS → CHAIR RULING:
  G1 (reduced-motion card orb unreadable as "loading" to a child)
  is ACCEPTED as the lawful transient ambiguity, NOT gating. Reasons:
  the standing law requires a static graphic under reduced motion
  and the static ring IS that outcome; a11y finds no barrier and UX
  rates it cosmetic; the ring still clears on load, so the
  ambiguity lasts only while loading; a static label would be a new
  visual element + copy needing the owner's decision, beyond the
  approved "reuse existing orb visual" scope. Per the game seat's
  own terms, accepting the ambiguity converts its verdict to a
  clean PASS. A static "Picture coming…" label under reduced
  motion remains an owner follow-up design consideration, not a
  PR blocker.
- Skeptic (separate, adversarial): CHALLENGE — verbatim:
  "CHALLENGE: independent full-suite green reproduced only 1 of 2
  runs (undiagnosed "not found" serving flake on run 1); "no CLS"
  claimed without CLS measurement; BRANCH_STATUS still stale
  despite code-review flag; committed spec carries a false
  "assertion fails" comment; map no-orb coverage is one edition
  only and globe texture-error has no E2E test" — CHAIR
  ADJUDICATION, point by point: (a) Flake: mechanism SUPPORTED
  (serveBuiltArtifact reads dist on disk; a failed read fulfills
  as 404 — a concurrent rebuild CAN 404 in-flight requests) but
  instance UNPROVEN (run-1 log shows only a home-heading timeout;
  no dist mtimes from that window; the "not found" screenshots do
  not survive in evidence). Absent on repeat: verification 56/56
  clean + skeptic run 2 8/8 + failing tests passing alone.
  Combined `e0df8e5` spec evidence: 70/70 orb assertions when
  loaded, 2 pre-assertion harness failures in 72 executions.
  Standing guard adopted: serialize builds and E2E across panel
  seats, or serve E2E from a per-run dist copy. (b) CLS: now
  MEASURED (orb-sequence Δ 0, motion-ON, headless) and the claim
  is corrected to that wording; reduced-motion CLS stays
  unmeasured and is listed as a limit. (c) BRANCH_STATUS: refreshed
  by THIS file — verified by reading it after edit, not promised.
  (d) Spec comment: fixed comment-only in the docs commit (no
  assertion change); spec re-run on the docs head confirms green.
  (e) Coverage gaps: Chair EXPLICITLY ACCEPTS as follow-ups, per
  the skeptic's own terms (gaps, not conditions): map no-orb
  coverage is one edition path only; globe texture-error has no
  E2E test. The skeptic has NOT re-issued a verdict; this
  adjudication is the Chair's, and the CHALLENGE stays on the
  record verbatim in the final report.
- Test-results analyzer: reconciled all numbers from logs (see
  Gates above and ANALYSIS.md §7). Advisory readiness: solid on
  unit suite / lint / tsc / deterministic failure + fix / 70-70
  orb assertions when loaded; any YES must carry the
  qualifications in Known limits.
- Panel process note: the first panel dispatch (6 seats) was lost
  to a daemon restart (all errored, no evidence) and was
  re-dispatched fresh on `e0df8e5`. No verdict from the lost run
  is quoted anywhere.

## Pending

- Push of the rebased head (`3e46c15` + this docs commit) to `origin/feat/loading-orbs` — OWNER'S CALL ONLY; not pushed by the rebase seat. Until then the remote still reads `5f434a5` and PR #246 still shows its pre-rebase head. No force-push, no rewriting beyond this rebase, no merge.
- Owner green-light / Chitti review path for this branch (per
  standing Meridian flow), then the owner's merge call.
- Owner follow-ups (NOT PR blockers — see Known limits): static
  reduced-motion label design consideration; UX-1 globe
  role="status" announcement; 390 non-square art box ticket;
  image-fallback design ruling (still owed — error path shows a
  bare broken-image glyph, pre-existing).

## Known limits (do not paper over)

- The lazy-chunk window BEFORE HomeGlobe mounts still shows Suspense
  fallback={null}: the orb covers the post-mount texture waterfall
  only, not the chunk download.
- Every home lazy image found in code is covered (six sites, verified
  by grep before editing); no home lazy image was found missing from
  the brief's list, and no listed site turned out not to be a home lazy
  image.
- Card orb overlays are transparent (spinner only, no opaque block):
  the opaque cover requirement applies to the globe mount, where a
  black pre-texture frame exists; card art areas are empty before load,
  and an opaque block would sit badly over the masked `.hv5-art` blobs.
- Unit tests pin wiring by SOURCE-READING, not rendering (no
  React-render/jsdom harness in this repo); globe-transition coverage
  is E2E, not unit.
- 390 non-square art box (pre-existing, deliberately left alone):
  journal art renders ~148×105 instead of intrinsic 148×148 at 390
  (held == loaded, so no shift; art crops via object-fit: cover,
  never distorts). The aspect-ratio fix does not produce a square
  box at 390 and the 390 clamp mechanism is unexplained — own
  layout ticket, not this PR.
- Serving flake (environmental, undiagnosed to instance): the
  skeptic's run 1 went 6/8 on pre-assertion serving failures; the
  mechanism (concurrent dist rebuild → 404) is proven in helpers.ts
  but the instance is unproven. Guard adopted: serialize builds
  and E2E, or serve from a per-run dist copy. Headline honesty:
  "70/70 orb assertions when loaded, 2 pre-assertion harness
  failures in 72 executions" on `e0df8e5` — not "8/8" alone.
- Coverage gaps (Chair-accepted follow-ups): map no-orb rendered
  check is one edition path only (State/Country never
  rendered-checked; grep argument is strong but not a rendered
  check); globe texture-error → static disc has no E2E test (code
  path only); reduced-motion CLS unmeasured; no live screen reader
  (no orca in VM — VoiceOver/NVDA smoke check on a real device
  recommended as post-merge sanity, not a blocker, since overlays
  expose nothing to announce); dark-theme orb contrast not checked;
  no real-device checks; tiles stubbed per the shared harness.
- Masked-blob claim is SPEC-LEVEL visibility (orb visible + clears,
  56/56 + 8/8), NOT exact box coincidence: the verification seat's
  own logs conflict on box coincidence (single-snapshot exact vs
  ~18px offset in the sequential capture log; entrance-rise
  explanation is single-seat).
- First-load/update/splash paths: no orb code exists for them (grep +
  diff) and BootSplash is text-only — but no seat rendered the
  splash/update path to confirm nothing changed there visually.
  Code-level, not rendered, verification.
- Production deployment is NOT verified by any seat (worktree
  builds only).
