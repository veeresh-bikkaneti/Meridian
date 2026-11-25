# Meridian Z1+Z2 gesture-and-chrome rework

Goal ID: goal_7edc1d7efd5d
Goal slug: meridian-z1-z2-gesture-and-chrome-rework

## Description
Crew-driven rework of the Meridian geography game. Shipped to `main`: PBI-Z1 (bottom bar → small floating dismissible bubble, full-bleed map); PBI-Z2 as revised by Veeresh — double-tap/double-click COMMITS the pin (reversing the original "double-tap never commits" rule), single tap only proposes, Drop pin button stays as the accessible commit path; plus the wheel/drag/pinch gesture restoration (MapLibre container cascade fix). In build on branch `feat/zoom-space`: PBI-Z3/Z4 as one coherent zoom/projection state machine — every view (State, Country, Globe) zooms out all the way to an Earth-from-space view with starfield; the opening animation spins the globe, narrows onto the selected region, highlights it, and settles at a regional framing without auto-zooming further in. All work happens on a local branch with no push and no deploy; the branch is handed over for Veeresh's own push.
