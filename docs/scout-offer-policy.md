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
