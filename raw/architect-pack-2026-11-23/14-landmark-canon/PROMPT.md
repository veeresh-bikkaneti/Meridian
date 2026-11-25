# 14 — Landmark canon: 37 famous landmarks on the home globe

## Intent (one line)
All major landmarks on the Home globe — tap one and the globe dives to it Google-Earth-style; landmarks reveal progressively as the player zooms, and only near where they're looking.

## Why (origin)
Owner, 2026-11-20: "can you add statues of liberty and famour landmarks like taj mahal, ramasetu, and lets users zoom in like google earth" → corrected to "**add all major landmarks on the globe not just the once i listed**" → after seeing the reveal crowding: "this one has overlaps, and thats why i said unless payer zooms in we dont want to reveal more" → "**port it**" (2026-11-20 12:36 CST).

## Scope IN
- 37 landmarks as data rows in ONE registry, built by ONE shared `buildLandmark`, placed by ONE path, driven by ONE controls module (the owner's component law, restated for this work: "component design please" + "microfront end").
- Oblique dive (finish ≈50° elevation) so landmarks stand in profile; progressive reveal in tiers (12 always · 17 at mid-zoom · 8 deep) PLUS the focus gate (reveal radius shrinks 180°→12° as the camera closes).
- Real-tap dive proven in e2e; drags and ocean taps must not dive.

## Scope OUT
- Satellite-photo terrain: the ground stays Meridian's painted relief. The clear detail at the zoom point is the landmark model itself — stated to the owner once, plainly.
- Merging: draft PR only while the freeze holds.

## Locked decisions
- Coordinates verified against cited sources (Wikipedia/UNESCO/Britannica); two forced drawn-spot nudges disclosed (Sphinx, Niagara) where true spots collide with neighbour models; spec coordinates stay true in the data.
- Budgets: ≤60 draw calls and <45k tris per frame, enforced in-spec; secular landmarks only.
- Rama Setu is modelled as a low shoal ridge — no invented structure.

## Acceptance criteria
- Full pipeline on the exact tip (panel + Silo QA + DevEx + benchmark + CI) before any merge word is sought; owner-config captures at 390/768/1280.
- Every landmark's dive close-up READS as the place (the current gap, below).

## Assets & related work (in this folder)
- `branch-status-feat-landmark-canon.md` — the port record: every port item with its commit + gate evidence, and first-hand capture verdicts.
- `MOCKUP-STATUS.md` — the mockup-stage record (design, tiers, reveal v1→v2 cure).
- PR #551 captures: `pr551-home-full-1280/390.png`, `pr551-dive-{liberty,chichen,brandenburg,petra,forbidden,grandcanyon,victoriafalls,niagara}.png`.
- Mockup-stage captures: `mockup-home-full-1280.png`, `mockup-dive-{tajmahal,christ,moai,rushmore}-1280.png` (the mockup Rushmore dive exists; the PR's Rushmore dive capture is the missing one).

## Open questions for the architect
1. **The open decision:** cure round first (Niagara rework, Grand Canyon gorge visibility, Victoria Falls curtain, Forbidden City roof dominance, Rushmore capture by another route) — or take PR #551 to the panel as-is with gaps named?
2. Water/relief features (falls, canyon, a shoal chain) systematically read worse than free-standing forms at the 50° finish. Is there a modelling idiom (vertical exaggeration? water material? camera finish per class) that fixes the class, not the instances?
3. Niagara's drawn spot parks it in Liberty's shadow — relocate the drawn spot, shrink a neighbour, or accept the composition?

## Status & evidence
- **MERGED to main 2026-11-21** (commit `65115172`), after the owner's cure-vs-panel pause. Tree-diff evidence: between the pack-record tip `7e6c1653` and the merged commit, the only change across all globe files + captures is +7 lines in `home-globe.tsx` (the #557 shader guard, folded in). `landmark-models.ts` is byte-identical.
- **The named gaps merged AS-IS — no cure round happened:** Niagara's builder on main is the port's reworked version and remains the weak read (pale drum; drawn spot 39.0/-69.0 beside Liberty); the three partial reads (Forbidden City, Grand Canyon, Victoria Falls) merged untouched; **there is still no `dive-rushmore.png`** in `docs/motion-verify/` on main — Rushmore's close-up remains unproven.
- Post-merge, PR #573 (upward-imports A) moved the globe modules from `src/components/home-globe/` to `src/lib/home-globe/` (layering; same code).
- The owner's cure-vs-panel question is therefore moot as a PR decision: the canon is live with its gaps. What remains for the architect: the model-read quality bar — is a cure lane for Niagara + the three partials + the missing Rushmore capture worth scheduling, now as a change to live code?
