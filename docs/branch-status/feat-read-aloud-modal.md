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
