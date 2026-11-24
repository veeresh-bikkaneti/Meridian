# Branch status — feat/td-02.7-last-ten-ports

## What this branch is

TD-02.7. The last ten raw storage, network and sound calls move onto
the platform ports. `noRawIo` goes from 10 to 0. No layout change,
no module extraction. Draft until the owner says otherwise.

## How each row was routed

- `LoopScreen` `fetch()` — `getRaw` inside `fetchJson`. The port has
  no cache field, so `cache: "no-store"` is not sent. HTTP failures
  still throw `HTTP <status> for <url>`.
- `LoopScreen` session stamp — `writeSessionItem` on
  `STORAGE_KEYS.staleRefresh` (a number, so the stored bytes stay
  decimal digits the existing reader parses with `Number()`).
- `AppErrorComponent` session read — `readSessionItem` on
  `chunkReloadAt` / `chunkReloadSurface`, passed to
  `shouldReportChunkFailure` through a small adapter. The public
  props and layout are unchanged.
- `board` six local reads and writes — `getStorageItem` /
  `setStorageItem` on `boardCalm`, `boardTheme`, and
  `boardSeenClosed`. Seen-closed still goes through
  `readSeenClosed` / `writeSeenClosed`; the page passes a port
  adapter instead of the browser store.
- `SubjectCase` `new Audio()` — `createVoice` adopts the existing
  `claimVoice("lose-support")` claim and calls `play()` before any
  await. The lose-reveal focus and announcement are unchanged.

## Notes

- `cache: "no-store"` cannot be expressed. `TransportOptions` has
  no cache field, and this branch does not add one. `getRaw` is
  used as-is.
- The session port also exports `readSessionItem` and
  `writeSessionItem` (`src/platform/storage/browser-storage.ts`).
  They call the existing session functions. The four screens use
  those names so their source does not spell the browser store.
- A private-mode throw used to make chunk reporting fail loud.
  The session port fails soft, so an unreadable stamp now stays
  silent (the missing-stamp path) instead of reporting. Other
  reads and writes keep the same bytes.

## Not in this branch

Phase 2 shell moves, Phase 4 game-app extraction, and the parallel
Wave 3 lanes.
