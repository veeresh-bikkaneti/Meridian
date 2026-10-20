# Scout Map switching — when it switches, and what is remembered

Rules the code enforces (`src/map/capability.ts`, `src/components/game-app.tsx`).
The project charter's "section 4 / non-nag rule 1" text is not in this repository;
this file is the in-repo statement of the rule and should be mirrored there.
(The filename keeps the word "offer" for link stability — the offer itself
is gone; see "Superseded" below.)

## Boot: weak devices switch silently (owner ruling, 2026-10-20)

Owner: **"Auto-switch silently on weak devices (my decision stands)"** —
"check the device capability and auto switch; also allow user to manually switch."

At boot, if no stored record stands, the device is qualified in order:
prior map-attributed crash → WebGL probe → low memory. A scout result
starts the session in Scout Map immediately — no dialog, no blocking
notice (the in-game toggle shows the state) — and is stored as an AUTO
record:

| Event | Stored as | Decays? |
| --- | --- | --- |
| Boot auto-switch (prior-crash / probe / low-memory) | `mode: scout`, `source: <signal>` | **yes, 7 days** — then the device is re-qualified; a clean probe returns it to full |
| `webglcontextlost` auto-switch (mid-game) | `mode: scout`, `source: contextlost` | yes, 7 days |
| Settings toggle (manual) | `source: manual` | never |
| Tile-failure switch (WS-4, after one failed retry) | nothing: in memory only | n/a — the next visit tries the full map again |

A stored record always stands over fresh signals: a manual choice is
never overridden by a probe, and boot never rewrites a standing record
(a rewrite would refresh `setAt` and silently defeat the 7-day decay).

## Manual switch: the toggle sends you home (owner ruling, 2026-10-20)

Owner: **"Force home on manual switch (my remedy)"** — "when you manually
switch you need to reload the entire app to get all features enabled. if
that's the case we should force the user back to home page."

The map is built once per game with the mode as a constructor input, so
a new mode can only take effect in a new game. Flipping the toggle
therefore: writes the manual record, applies the mode, and exits the
current game to the home screen — the same exit as the Editions button,
so the session (score, banked places) survives and only the in-progress
run is discarded. The popover copy warns before the tap: "Switching
sends you back home — this game ends here. Your next game uses the new
map."

Test seam: the boot auto-switch is suppressed only by
`window.__meridianSuppressScoutOffer === true` (set by the e2e harness
init script — the Playwright VM's SwiftShader renderer reads as a weak
device). There is deliberately no URL parameter for it. Whether this
seam should keep shipping in production is issue #154 item 1 — the
owner's call, still owed. (The seam's name predates the ruling: it used
to suppress the dialog below.)

## Superseded: the boot offer dialog (shipped until 2026-10-20)

Until the 2026-10-20 ruling, a fresh scout qualification showed a boot
choice dialog instead — the recorded directive was "a capability-detected
weak device gets a CHOICE, never a silent routing" — and the toggle
promised "applies from the next place" (an investigation proved that
promise false for every map feature: the map never changed mid-run).

**Non-nag rule 1 — an explicit answer is never re-asked** (historical;
the `accepted: true` rows explain records still sitting on players'
devices, which the current code continues to honor on read):

| Answer | Stored as | Decays? | Re-offered? |
| --- | --- | --- | --- |
| "Keep full map" (decline, any variant) | `mode: full`, `source: manual` | never | never |
| "Use Scout Map" from the prior-crash offer | `mode: scout`, `source: manual` | never | never |
| "Use Scout Map" from the capability offer (probe / low-memory) | `mode: scout`, `source: probe\|low-memory`, `accepted: true` | **never** | **never** |
| Settings toggle | `source: manual` | never | never |

Dismissing the dialog (scrim tap / Escape) persisted nothing — the
dialog could show again on a later boot if the device still qualified.

## Charter change: tile-failure fallback (recorded 2026-10-14; owner adoption 2026-10-15)

This is a deliberate change to the rules above. It was recommended by the
game-studio crew, implemented 2026-10-14, and adopted by the owner on
2026-10-15. It does not touch the rules in the tables.

**Tile-failure fallback (satellite map).** When the satellite imagery fails to
load, the child gets one "Try again". If that retry also fails, the map switches
automatically to Scout Map for this visit only.

| Event | Stored as | Decays? | Re-offered? |
| --- | --- | --- | --- |
| Tile-failure switch (after one failed retry) | nothing: in memory only | n/a (never stored) | the next visit tries the full map again; the fallback can trigger again if tiles still fail |

Rules for this change:
- It is never written to `meridian:map-mode`, so the saved-mode rules above are unchanged.
- A reload starts the next visit on the full map again, and the one-retry rule applies again.
- There is no boot offer anymore; the fallback interacts only with the saved record, which it never overwrites.
- The manual toggle still wins: a child who sets Scout or Full gets that choice (flipping it mid-game now goes home first — see above).
- The `webglcontextlost` rule (unanswered auto record, decays after 7 days) is unchanged.

Spec: `docs/ops/specs/ws-4-satellite-failure-phase1.md`.
