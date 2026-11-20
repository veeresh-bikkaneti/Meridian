# Branch disposition — 2026-11

Method: fresh GitHub API data (matching-refs, compare, git refs) collected 2026-11-19 against main `dfb15d5b38a7dc423b42c1efba39cb91a6e404f2`. Recommendations re-derived 2026-11-20 from git facts only (compare ahead/behind, merged PRs, per-path existence on main); [inferred] marks only the rows git facts could not settle. Owner decision column is blank.

| branch | ahead | behind | last commit date | top-level paths touched | likely superseded by | recommendation | owner decision |
|---|---|---|---|---|---|---|---|
| chore/correct-guards | 9 | 57 | 2026-11-14 | .github, AGENTS.md, eslint.config.mjs, eslint.nav.config.mjs, eslint, package.json | PR #480 (merged) | close — superseded by merged PR #480 |  |
| chore/graphify-ignore | 1 | 74 | 2026-11-13 | .gitignore, .graphifyignore |  | keep — 1 of 2 paths not on main |  |
| ci/weak-device-test-in-ci | 4 | 140 | 2026-11-12 | .github, docs, tests |  | keep — 2 of 6 paths not on main |  |
| design/detective-moments-prototype | 9 | 563 | 2026-11-06 | BRANCH_STATUS.md, prototype |  | keep — 25 of 26 paths not on main |  |
| design/hero-trekker-prototype | 5 | 569 | 2026-11-05 | BRANCH_STATUS.md, src |  | keep — 1 of 4 paths not on main |  |
| design/home-rework-variants | 3 | 569 | 2026-11-05 | BRANCH_STATUS.md, src |  | keep — 1 of 4 paths not on main |  |
| docs/agents-audit-pointer | 3 | 31 | 2026-11-16 | AGENTS.md, docs | PR #507 (merged) | close — superseded by merged PR #507 |  |
| feat/board-controls | 13 | 48 | 2026-11-16 | docs, public, scripts, src, tests |  | port — paths already on main, content not merged |  |
| feat/board-v4 | 5 | 49 | 2026-11-16 | docs, public, scripts, src, tests |  | port — paths already on main, content not merged |  |
| feat/board-v4-r2 | 6 | 30 | 2026-11-16 | docs, src, tests | PR #508 (merged) | close — superseded by merged PR #508 |  |
| feat/clue-scenes-waves-2-10 | 18 | 32 | 2026-11-16 | docs, src, tests | PR #509 (merged) | close — superseded by merged PR #509 |  |
| feat/detective-missing-clips | 1 | 90 | 2026-11-13 | docs |  | keep — 2 of 2 paths not on main |  |
| feat/journal-freedom-fighters-clips-video | 7 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 9 of 15 paths not on main |  |
| feat/journal-great-leaders-clips-video | 4 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 29 of 35 paths not on main |  |
| feat/journal-modern-world-clips-video | 5 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 33 of 39 paths not on main |  |
| feat/journal-people-places-clips-video | 8 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 12 of 22 paths not on main |  |
| feat/journal-technology-clips-video | 6 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 22 of 28 paths not on main |  |
| feat/journal-world-wars-clips-video | 6 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 24 of 29 paths not on main |  |
| feat/journal-ww2-monuments-clips-video | 3 | 90 | 2026-11-13 | .gitignore, docs, public, scripts, src |  | keep — 22 of 27 paths not on main |  |
| feat/pair-session-moments | 6 | 497 | 2026-11-10 | BRANCH_STATUS.md, playwright.config.ts, public, scripts, src, tests |  | keep — 10 of 30 paths not on main |  |
| feat/science-spec | 3 | 140 | 2026-11-10 | docs |  | keep — 2 of 2 paths not on main |  |
| feat/subject-holmes-watson-v2 | 4 | 69 | 2026-11-14 | src, tests |  | keep — 5 of 10 paths not on main |  |
| feat/why-learn-band-step | 1 | 53 | 2026-11-15 | docs, src, tests |  | keep — 4 of 21 paths not on main |  |
| feat/why-learn-film-dolly | 24 | 107 | 2026-11-12 | .gitattributes, public, scripts, src |  | keep — 29 of 31 paths not on main |  |
| feat/why-learn-film-redo | 17 | 107 | 2026-11-12 | .gitattributes, public, scripts, src |  | keep — 29 of 31 paths not on main |  |
| fix/ask-age-first | 3 | 53 | 2026-11-15 | docs, playwright.config.ts, src, tests | PR #498 (merged) | close — superseded by merged PR #498 |  |
| fix/e2e-offline-preload-assertion | 2 | 551 | 2026-11-09 | BRANCH_STATUS.md, tests |  | port — paths already on main, content not merged |  |
| fix/endgame-editions | 12 | 599 | 2026-10-29 | .council, BRANCH_STATUS.md, README.md, src, tests |  | keep — 3 of 14 paths not on main |  |
| fix/math-round-lead | 3 | 29 | 2026-11-16 | docs, scripts | PR #483 (merged) | close — superseded by merged PR #483 |  |
| fix/why-learn-fill-viewport | 1 | 70 | 2026-11-14 | docs, src, tests |  | keep — 1 of 6 paths not on main |  |
| fix/why-learn-hero-film-fit | 1 | 56 | 2026-11-14 | docs, src |  | keep — 1 of 5 paths not on main |  |
| mockup/514-lose-path-reveal | 1 | 8 | 2026-11-19 | mockup-514-after.png, mockup-514-before.png |  | keep — 2 of 2 paths not on main |  |
| mockup/scale-play-v2 | 1 | 132 | 2026-11-12 | docs |  | keep — 1 of 1 paths not on main |  |
| veer-c/adoring-volta-ql18ja | 1 | 626 | 2026-10-22 | BRANCH_STATUS.md, docs |  | keep — 1 of 2 paths not on main |  |
