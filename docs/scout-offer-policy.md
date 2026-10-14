# Scout Map offer — when it is asked, and never re-asked

Rules the code enforces (`src/map/capability.ts`, `src/components/game-app.tsx`).
The project charter's "section 4 / non-nag rule 1" text is not in this repository;
this file is the in-repo statement of the rule and should be mirrored there.

**Non-nag rule 1 — an explicit answer is never re-asked.**
A child (or grown-up) answers the boot dialog once and the answer stands:

| Answer | Stored as | Decays? | Re-offered? |
| --- | --- | --- | --- |
| "Keep full map" (decline, any variant) | `mode: full`, `source: manual` | never | never |
| "Use Scout Map" from the prior-crash offer | `mode: scout`, `source: manual` | never | never |
| "Use Scout Map" from the capability offer (probe / low-memory) | `mode: scout`, `source: probe\|low-memory`, `accepted: true` | **never** | **never** |
| Settings toggle | `source: manual` | never | never |

`source` on an accepted offer keeps the qualifying signal for telemetry only.

**Not an answer, so it can come back:**
- dismissing the dialog (scrim tap / Escape) persists nothing — the dialog may show again on a later boot if the device still qualifies;
- the `webglcontextlost` auto-switch (a crash in progress, not a choice) is an unanswered auto record and still decays after 7 days (`MAP_MODE_DECAY_MS`), after which the device is re-qualified from fresh signals.

A person can always change an accepted choice with the manual toggle, which overwrites it.

Test seam: the offer is suppressed only by `window.__meridianSuppressScoutOffer === true`
(set by the e2e harness init script). There is deliberately no URL parameter for it.

## Charter change: tile-failure fallback (recorded 2026-10-14)

This is a deliberate change to the rules above, agreed by the owner. It does not
touch the rules in the table.

**Tile-failure fallback (satellite map).** When the satellite imagery fails to
load, the child gets one "Try again". If that retry also fails, the map switches
automatically to Scout Map for this visit only.

| Event | Stored as | Decays? | Re-offered? |
| --- | --- | --- | --- |
| Tile-failure switch (after one failed retry) | nothing: in memory only | n/a (never stored) | the next visit tries the full map again; the fallback can trigger again if tiles still fail |

Rules for this change:
- It is never written to `meridian:map-mode`, so the saved-mode rules above are unchanged.
- A reload starts the next visit on the full map again, and the one-retry rule applies again.
- It is not an answer to the boot offer, and it does not suppress the boot offer.
- The manual toggle still wins: a child who sets Scout or Full in settings gets that choice.
- The `webglcontextlost` rule (unanswered, decays after 7 days) is unchanged.

Spec: WS-4 Phase 1 (spec file pending, to be added to `docs/ops/specs/`).
