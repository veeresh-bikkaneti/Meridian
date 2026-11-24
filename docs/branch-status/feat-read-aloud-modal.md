# Branch status — feat/read-aloud-modal

## What this branch is

The first-visit read-aloud sheet ("Do you like stories read aloud?
Always / Sometimes / Never") as a TRUE ARRIVAL MODAL, built in a
branch for the owner's evaluation (owner direction, 2026-11-20:
work items 1, 2 and 3 in a branch; item 3 is this sheet question).
On main the sheet is a fixed overlay with no backdrop and no scroll
lock — the page behind it stays live. Here, while the sheet is up:

- a backdrop covers the page (a tap lands on it, never behind it),
- the home page is inert (non-interactive, out of the tab order),
- scrolling is locked and focus is trapped inside the sheet,
- there is no dismiss-without-choosing (no backdrop-click close,
  no Escape close) — the three choices are the only way out.

The choices, their wording, and their persistence
(`meridian.readAloudPref.v1`) are byte-identical to main. MERGE
FREEZE is in force: this branch ends at a draft PR for the owner's
eye; nothing merges.

## Trigger-path findings (arrival only)

- The sheet (`ReadAloudPrefPrompt`) mounts in exactly ONE place:
  `game-app.tsx`'s Home (Choose) branch, inside `FirstVisitQueue`,
  only while `shouldAskReadAloudPref()` (the stored pref is unset).
  The queue is constructed only in that branch — no run, menu,
  picker or case branch builds it — so the sheet cannot surface
  mid-game or mid-case. No path needed to be left non-modal.
- `ReadAloudPrefSettings` (footer toggle on Home and in subject
  cases) is a different component: it renders null while the pref
  is unset, so it can never be the arrival sheet. Untouched.
- `ReadAloudButton` (the speaker button on cards) is not a sheet
  path. Untouched.

## How it is built (one component, existing shell system)

- `FirstVisitPrompt` gains a `modal` flag; `FirstVisitQueue` gains
  `onModalChange`. While a modal prompt is visible the queue
  renders a backdrop + the sheet (same overlay box, modal z-layer)
  through a portal to `document.body` — the portal escapes the
  host's inert subtree and waits for client mount, so prerendered
  shells never portal on the server.
- The queue owns the hold: scroll lock (body + root, restored on
  exit), initial focus on the first choice, Tab cycling, focus
  pull-back on outside focus/pointer, Escape swallowed.
- `game-app.tsx` flags only the read-aloud entry `modal: true` and
  adds `firstVisitModalOpen` to the Home wrapper's existing inert
  condition — the same mechanism as the ask-first age gate. The
  portal renders outside that wrapper, so the sheet itself is
  never inert.
- Two unit source pins updated for the deliberate wiring change
  (the queue JSX pin; the inert-expression count pin now counts
  the shared prefix, since Home's expression carries the extra
  modal term).

## Gate results

| Gate | Result |
| --- | --- |
| tsc (`npm run typecheck`) | PASS |
| lint:nav | PASS |
| check:provenance | PASS |
| Unit suite (`npm test`) | PASS — 1,220 + 3,000 tests, 0 failures |
| New e2e `read-aloud-modal.desktop.spec.ts` | PASS — 3 passed, 1 skipped (the capture test is env-gated) |
| Regression e2e: layout-overflow, grownups-privacy-contact, nav-back-first-visit | PASS — layout-overflow + nav-back green in the combined run; grownups 5/5 after its answer moved up front (below) |

One existing spec changed behaviourally: the grownups 6-viewport
test answered the sheet AFTER its viewport loop, which the modal
makes impossible by design (the loop's first menu click is exactly
what the hold blocks). Its answer moved to right after the invite
dismissal — the same "Never" tap, earlier; no assertion changed.

The new spec proves: backdrop up + dialog semantics; hero control
under an inert ancestor and hit-testing to the modal layer;
backdrop click and Escape write no preference and dismiss nothing;
scroll locked while up and restored after; focus starts inside and
Tab/Shift+Tab never leave; each of Always / Sometimes / Never
dismisses, persists, and never re-asks on return; the sheet never
appears over an in-progress Globe round.

## Captures (owner's full-page rule)

`docs/motion-verify/read-aloud-modal-full-{1280,768,390,320}px.png`
— full-page captures of the modal on the real built home page,
produced by the spec's env-gated capture test (CAPTURE_MODAL=1).
Captures are generated locally and are not stored in git (TD-13.1);
regenerate with `CAPTURE_MODAL=1` on the capture test.

## Not done / next

- No merge (freeze), no `gh pr ready`. Draft PR only.
- Owner's eye on the captures, then the panel, on his word.
- Known design note for the panel: the sheet keeps its current
  seat below the header (same box as the overlay) — only the layer,
  backdrop and hold changed. If the owner wants it centred, that
  is a follow-up design call, not a defect in this variant.

## Review fix (Nov 20)

- The arrival modal now uses the alertdialog pattern (an answer is
  required — no Escape, no backdrop close): the queue's modal layer
  renders `role="alertdialog"` with `aria-modal="true"` and names
  itself by the sheet's heading via `aria-labelledby`, taken from
  the prompt's new optional `labelledBy` field — the queue stays
  generic and holds no prompt-specific id.
- The heading id is exported once as `READ_ALOUD_PREF_HEADING_ID`
  from `ReadAloudPrefPrompt.tsx` (its `h2` and section label both
  use it); `game-app.tsx` passes it as the read-aloud entry's
  `labelledBy`. No second copy of the string.
- The backdrop color moved to a `--scrim` token in the `styles.css`
  `:root` block (same value, `rgba(21, 28, 24, 0.55)`); the backdrop
  rule now reads `var(--scrim)`. No visual change.

## Capture verification — CHECKPOINT (2026-11-20, capture re-shoot leg)

Budget: hard cap 20k tokens for this leg; checkpoint at ~12k reached.
Spent estimate: ~12k (±30% — no meter; two full doc reads, one build,
one probe run, one screenshot read). DONE below; the re-shoot REMAINS.

### Diagnosis: the "half empty" captures are a CAPTURE ARTEFACT [measured]

The owner reported the four `read-aloud-modal-full-*px.png` captures
show the hero + sheet over a blank cream void. Verdict: the page is
intact; the full-page capture method is what failed.

- While the modal is up, the below-hero sections EXIST in the DOM
  with real geometry: 76 sized elements below the fold at 1280×800
  (footer present; globe SVG parts at document tops 949/1053/1166).
- The modal's scroll lock (overflow hidden on body + root, by
  design) collapses `document.scrollHeight` to the viewport height
  (800 at 1280×800); a scripted scroll attempt stays at scrollY 0.
- After answering "Never", the same page scrolls freely (scrollY
  1400) and the below-hero sections PAINT in a real viewport:
  editions/case cards (GeoDetective, Cold Trail, Review my misses,
  Journal, For grown-ups) fully rendered in the probe screenshot.
- The returning-visit full-page capture is 1280×3642 — the same
  height as the modal-up full-page capture. The height exists; the
  modal-up fullPage shot renders it blank because Playwright's
  fullPage resize/stitch runs against a scroll-locked document with
  a fixed scrim [inferred mechanism; DOM + paint facts measured].
- Probe: temporary spec, hermetic recipe (build:pages, flock,
  --workers=1, pinned Chromium, VITE_KOFI_URL both envs), 1 passed;
  spec deleted after the run. Probe shots were kept in /tmp only.

### Remaining (next run, on the parent's continuation word)

1. Re-shoot per width (1280×800, 768×1024, 390×844, 320×568):
   (a) arrival viewport shot with the sheet up →
   `read-aloud-modal-arrival-<w>px.png`; (b) answer "Never", then
   fullPage → replaces `read-aloud-modal-full-<w>px.png` (populated).
   Cleanest path: update the CAPTURE_MODAL test in
   `tests/e2e/read-aloud-modal.desktop.spec.ts` to this two-shot
   method (it currently does fullPage with the sheet up — the void
   method) and run it with CAPTURE_MODAL=1.
2. Spot-check one arrival shot + the new full-page sizes.
3. Commit named files only (8 PNGs + the spec), provenance check,
   push (standing branch authorization).
4. Append a capture-method correction to the PR #547 body.
5. Mark this section complete in the branch status.

## Capture continuation — CHECKPOINT (2026-11-20, +15k re-baseline leg)

Budget: hard cap 15k tokens for this leg (owner-approved
re-baseline); checkpoint at ~9k (60%) reached. Spent estimate: ~9k
(±30% — no meter; sync + spec rewrite + one build + one capture run
+ dimension read + two screenshot reads). The re-shoot is DONE;
the records step is now COMPLETE (see the completion note at the
end of this section).

### Done in this leg [measured]

- Sync: worktree moved onto origin tip `2a1088d6` (the local
  checkpoint commit `32711b72` was verified status-file-only; its
  section is re-applied above as a plain edit — no rebase, no
  force-push).
- The CAPTURE_MODAL test in
  `tests/e2e/read-aloud-modal.desktop.spec.ts` now uses the TWO-SHOT
  method: (a) arrival viewport shot, sheet up →
  `read-aloud-modal-arrival-<w>px.png`; (b) answer "Never", then
  fullPage → `read-aloud-modal-full-<w>px.png`. Its comment names
  why: fullPage against the scroll-locked page stitches blank.
- Hermetic run PASSED (build:pages, flock, --workers=1, pinned
  Chromium, VITE_KOFI_URL in build + runner envs): 1 passed.
- All 8 captures written. Dimensions: arrival 1280×800, 768×1024,
  390×844, 320×568 (exact viewports); full 1280×3642, 768×4033,
  390×6288, 320×6428 (tall, populated — the 1280 height matches the
  owner-approved sample exactly).
- Spot-check [read first-hand]: arrival-390 — sheet correct
  ("Do you like stories read aloud?", Always carries the focus
  ring, page dimmed behind the scrim). full-390 — fully populated:
  hero, globe, Expeditions Map, GeoDetective / Why Learn / Cold
  Trail / Review my misses / Journal / For grown-ups cards, "How a
  round works", footer + Grandpa. No void.

### Records step — COMPLETE (2026-11-20)

1. ✅ `npm run check:provenance` — PASSED.
2. ✅ Committed named files only (8 PNGs + spec + this status
   file) as `17d018f3` "Re-shoot the read-aloud modal captures
   with the two-shot method". Owner identity, no trailers.
3. ✅ Pushed to origin `feat/read-aloud-modal`
   (`2a1088d6..17d018f3`, normal push).
4. ✅ Capture-method correction appended to the PR #547 body:
   the original captures were void by construction (fullPage
   against a scroll-locked page); replaced by arrival +
   answered full-page pairs; method named honestly.
5. ✅ Capture sections in this file marked complete (this note).
