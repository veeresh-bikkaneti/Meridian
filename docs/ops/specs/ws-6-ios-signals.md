# iOS: the low-memory Scout path never fires (note for the owner — nothing changed)

`readDeviceMemoryGB()` reads `navigator.deviceMemory`, which Chromium
implements and Safari/WebKit does not. On every iPhone the signal is
"unavailable", `qualifyMapMode` skips it (fail-closed → assume capable), and the
only remaining auto paths are the WebGL probe and the prior-crash flag.

Constraints I kept: **no User-Agent string**, **unavailable signal ⇒ assume
capable (fail-closed)**, an offer is a *choice dialog*, never a silent switch,
and **no auto-switch on struggle** (the "soft watchdog" is not approved, so
anything that watches live performance and flips the map is out).

| Signal | Works on Safari/iOS? | What it tells you | Trade-offs |
| --- | --- | --- | --- |
| `gl.getParameter(MAX_TEXTURE_SIZE)` / `MAX_RENDERBUFFER_SIZE` from the existing boot probe context | Yes | GPU generation (my recollection, not verified here: older iPhone GPUs report 4096, newer 8192–16384) | Zero extra cost (probe already creates a context). Proxy for age, not RAM; thresholds need a lab calibration on real devices; Android reports vary too. |
| `navigator.hardwareConcurrency` | Believed yes (from memory, not verified) | Core count | Free. Weak as a RAM proxy (core count and RAM do not track each other); whether Safari rounds or caps the value is unverified here. Use only as a secondary signal. |
| Screen pixel budget: `screen.width × screen.height × devicePixelRatio²` | Yes | Size of the canvas MapLibre must back (memory scales with it) | Free, deterministic. Penalises big new phones, rewards small old ones — a pixel budget is a cause of memory use but not a measure of free RAM. |
| Boot micro-benchmark (fixed JS + small canvas workload timed once at idle) | Yes | Actual CPU/graphics speed of this device now | Measures what we care about and is UA-free; but noisy (thermal state, background tabs), adds boot work, and is one step from the unapproved watchdog — if chosen it must only feed an *offer*, once, never re-measure or auto-switch. |
| Prior-crash flag (already built) incl. `backgrounded` classification | Yes | A real kill with the map mounted | Reactive: costs one bad session first. Best precision; already the iOS path today. |
| `navigator.connection` (`saveData`, `effectiveType`) | No (Chromium only) | Data-saver preference | Not an iOS fix; listed because it often gets suggested. |
| `performance.memory` / `measureUserAgentSpecificMemory` | No (Chromium only) | Heap | Not an iOS fix. |
| Ask the grown-up in Settings (manual toggle, exists) | Yes | Ground truth | Needs discovery; not a detection. |

Recommendation for discussion: add the WebGL limit check first (no new code
paths at boot, no new permission, fail-closed when `getParameter` returns
nothing), calibrate the threshold on two or three real older iPhones, and keep
the prior-crash flag as the catch-all. I have not measured any of these on
iOS — I have no iOS device or WebKit build in this environment.
