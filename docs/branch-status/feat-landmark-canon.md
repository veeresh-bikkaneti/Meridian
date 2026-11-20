# Branch status — feat/landmark-canon

**Job:** port the owner-approved landmark globe mockup (37 landmarks,
oblique tap-to-dive, progressive reveal) from the staging branch
`mockup/famous-landmarks` @ `062093ca` to a real branch + DRAFT PR.
**Merge freeze in force** — this branch never merges on this lane;
the PR is a draft and merge waits for the owner's word + freeze lift
+ panel.

## Base + landing

- Base: origin/main `b740197d` (#544, docs-only over the mockup's
  base `dfb15d5b`).
- Landing: net patch of the four globe source files applied as
  `ee80cc1a`; verified byte-identical to staging tip `062093ca` for
  home-globe.tsx, globe-contract.ts, landmark-models.ts,
  globe-controls.ts. (Cherry-pick of the wave commits conflicted on
  an intermediate capture commit, so the brief's net-patch route was
  used.)

## Port list

- [ ] (a) Tap -> dive proven with a REAL tap (fix pointer->NDC cause)
- [ ] (b) __globeMock removed from production code
- [ ] (c) Spin-resume quirk: zoom input parks auto-spin like the dive
- [ ] (d) Weak models reworked: grandcanyon, rushmore, niagara,
      victoriafalls, chichen, brandenburg, forbidden, petra
- [ ] (e) Unit pins moved + reveal/dive coverage; gates green
- [ ] (f) Negative tests (never-happen list) in the globe spec
- [ ] Captures (home 1280/768/390/320 + 10 dives) + DRAFT PR

## Budget

- Cap 100,000 tokens; hard checkpoint at ~60,000. Spent so far:
  landing only (small).
