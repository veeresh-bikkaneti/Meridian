# Branch status — chore/td-05.2-shell-sweep-mockups

## Capsule

Outcome: TD-05.2 Wave 3 mockup batch only. Two Storybook stories
compose the first two Phase 2 shell-sweep screens — the router
error screen (`src/lib/error-component.tsx`) and the boot splash
(`src/components/boot-splash.tsx`) — inside the real shared shell,
at 390 px and desktop, so Veeresh can approve the target frame
before any production screen moves. No production file, shell
component, CSS token, or baseline changes in this PR.
Done condition: both stories build in Storybook, screenshots at
390 px and desktop are in the PR body, every gate below passes,
and the PR stops as a draft for Veeresh's OK.

Base: origin/main 7dbf62eb3be0976856f174f0725874e03abbaede.
Tier 1, cap 80k tokens (estimate). Story TD-05.2.

## What the stories do

- `src/lib/error-component.stories.tsx` — title
  `Screens/ErrorComponent`, stories `Desktop` and `Mobile`. The
  meta component is the real `PageShell`; children are the real
  `AppErrorComponent` with an example `Error`. Header slots follow
  the shell stories' own patterns: `onHome` (site-header story),
  `status: null`, `mute: null` (this screen has no status readout
  and plays no audio). The footer needs a router context, so the
  story carries the memory-history router decorator from
  `site-footer.stories.tsx`. `Mobile` adds a 390 px-wide wrapper.
- `src/components/boot-splash.stories.tsx` — title
  `Screens/BootSplash`, stories `Desktop` and `Mobile`. Same
  composition: real `PageShell` around the real `BootSplash`.
- Both screens still render their own `<main>` today (their
  `pageLocalMain` baseline entries). The mockups show the target
  frame around the unchanged screen; the later production PR is
  what removes the page-local `<main>` and the baseline entries.

## Counts (measured first-hand on this base)

| Baseline | Brief (at 72b9fa03) | This base (7dbf62eb) | This PR |
| :--- | :--- | :--- | :--- |
| `noRawIo` | 13 | 10 | 10 (unchanged) |
| `noUpwardImport` | 129 | 129 | 129 (unchanged) |
| `shell-ban` | 14 | 14 | 14 (unchanged) |

The `noRawIo` delta is PR #582 (TD-02.6) merging between the
brief's tip and this base: it deleted storyteller-home's 3 rows
(13 → 10). Nothing in this PR touches a baseline.

## Gates (this tree)

- `npx tsc --noEmit` — PASS
- `npm run lint:arch` — PASS (counts unchanged, above)
- `npm run lint:nav` — PASS (shell-ban unchanged)
- `node scripts/lint-cards.mjs` — PASS (GATE PASSED)
- `npm run build:pages` — vite build and prerender PASS; the
  postbuild `fingerprint-sw` step fails on this machine with
  "placeholder __BUILD_ID__ not found in dist/client/sw.js".
  Proven environmental: the same command on the pristine base
  with this PR's story files removed fails identically. CI is
  decisive.
- `npm run check:entry-size` — PASS (323,243 B of 323,865 B;
  stories do not enter the app bundle)
- `npm run check:provenance` — see the PR body (run on the
  pushed range before push)
- Narrow tests — NOT RUN (no test covers story files; `tsc` is
  the check the brief names for stories)
- 4 production viewports — NOT RUN (stories only; 390 px and
  desktop Storybook screenshots are in the PR body)

## Next step

Stopped for Veeresh's OK. On his word, the production screen
moves start in a later PR, smallest first: error-component, then
boot-splash.

## Graph

- Adds no graph nodes or edges (stories and this status file
  only); the integrator may note the two story files under the
  shell-sweep work if wanted.
