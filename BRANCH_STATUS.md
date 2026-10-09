# BRANCH_STATUS — fix/storyteller-dismiss-overlap

Follow-up fix for PR #114 (storyteller home handoff, merged as f9122a4).
Branch off origin/main@f9122a4. Local branch; push for PR review only.
NEVER merge — owner merges.

## Problem
QA BLOCKED finding from the #114 scrum review (landed after merge): the
44px home-greeting dismiss overhung the bubble corner at
`top:-22px; right:-14px` and overlapped the eyebrow sound toggle —
589px² @390px, 651px² @360px — stealing its taps. Live on main since f9122a4.

## Fix (CSS-only, src/components/storyteller-home.css)
Dismiss anchored mid-right inside the bubble:
`top:50%; right:6px; transform:translateY(-50%)`; bubble keeps
`padding-right:56px` so text clears the 44px button. Verified 0px²
overlap @360px and @390px on the rebuilt artifact (bounding-box
measurement, not eyeball).

No copy, JS, or behavior changes. Locked copy untouched.
