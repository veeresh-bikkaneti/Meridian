# Status — feat/social-studies-spec

**Task:** map-based social studies mode (place, region, route, compare) on the
existing geography engine, read-only. Mission: every unit opens with a real
problem that needs the skill, then teaches it, then uses it in another subject.

**Scope (owned paths):** `docs/scaling/social-studies-spec.md`,
`docs/scaling/social-studies/**`, `src/subjects/social-studies/**`, this file.

## Stage A — research and spec: DONE (docs only; no code gates ran)
- Standard §9 block, cuts log (10 cuts, §7a) and open items in `docs/scaling/social-studies-spec.md`.
- 17 PROPOSED items (7 for 7-10, 7 for 10-18, 3 for 18+) as I2 data in `docs/scaling/social-studies/items.json`; checked with a throwaway script (shape, ids, no algebra/trig in 7-10).
- Standards: only NGS Standard 1 verified; 6.RP.A.3 and 4.MD.A.2 partial; the rest UNVERIFIED (corestandards.org 404, socialstudies.org 403).

## Stage B — route-planning build: NOT STARTED
Waiting for the owner to lift the build gate. Plan: unit `route:count-the-steps`, `trip-clock`, `scale-ratio`, `travel-time` as a subject module (I1), `released: false`, Full/Lite/Flat, tests first, all AGENTS.md gates, screen recording.

## Open
1. Build gate (owner). 2. Named educator sign-off. 3. Real math ids now in `buildsOn`; math-applied ids resolve only once `feat/math-spec` merges. 4. Road rules/signs deferred. 5. Live sources for C3 and CCSS codes. 6. Counts PROPOSED.
