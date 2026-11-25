# Audit table — Meridian planned features (29) — v2, 2026-11-23

**v2 update:** reconciled against main @ `5930e930` after the architecture programme landed. #17 and #25 closed; #14 merged with its gaps live; #29 is the programme itself. Rows not mentioned in the v2 notes were verified unchanged.

One row per feature. Verdicts requested per feature: **ACCEPT / REJECT / FEEDBACK**.

| # | Feature | Area | Status today | Evidence / assets in folder | Decision needed |
|---|---|---|---|---|---|
| 1 | Explainer films at Disney/Pixar acting bar | Video | Moon sample rejected as collage; template built & shelved; direction pick awaited | Moon sample mp4, TEMPLATE-STATUS.md, pipeline README, episode.json | Architect: any viable route to real acting on this hardware? Owner: direction pick |
| 2 | Per-episode style roulette (Instagram boards) | Video | Planned for episode 2+; never started; gated by #1 | episode.json (style field), TEMPLATE-STATUS.md | Architect: validate the format design |
| 3 | Promo video — full app-demo rework | Video | v2 cut delivered Oct 2026; rework ordered, not built | demo-script.md, caption-pack.md (films referenced by path) | Architect: rework scope sound? Owner: build order |
| 4 | New-features vertical demo video | Video | Recording dispatched 2026-10-28; finished video never landed | meridian-new-features-script.md (film file referenced by path) | Architect: still the right artefact? |
| 5 | Hosts everywhere (Holmes & Watson in all games) | Characters | Council done 2026-11-06; 4 rulings awaited | GOAL-friend-challenges.md (context), brief carries council positions | Owner: 4 rulings. Architect: review the council's settled positions |
| 6 | Pair programme follow-ups | Characters | Studies/tests not run; 88/1,548 names without audio (measured at flip) | GOAL-pair-build.md | Architect: prioritise the six follow-ups |
| 7 | Grandpa tasting-tour — full home journey | Characters / Home | Line-once beat live (PR #539); full trail journey unbuilt | GOAL.md (owner's journey design) | Owner: hard-reload check. Architect: journey design review |
| 8 | Why Learn montage re-cut | Video | Offered, unanswered — thin evidence (no asset files exist) | Brief only; record cited inside | Owner: yes / no |
| 9 | Story packs: Rivers · Seas & Oceans · Famous Seaports | Game content | Mockups delivered 2026-11-04; awaiting "use them" + seaport pick; build pattern changed (Phase 3 validated records — see brief) | DESIGN-NOTE.md, CHECKPOINT.md, 7 mockup screens (PNG) | Owner: approve mockups + seaport 1/2/3 pick. Architect: target-rule soundness |
| 10 | Story-pack umbrella: mountains, parks, deserts, flags | Game content | Scoped on issue #319; drafting starts when first category is named | GOAL.md | Owner: name the first category |
| 11 | Friend challenges across all editions | Game content | Council manifest signed; 4 rulings block any build | GOAL.md (manifest summary) | Owner: packaging / scope / scoring / privacy rulings |
| 12 | Capitals & Flags — 41 flagless cases rescue | Game content | 69/110 flags ship; 41 flagless; SVG-optimisation rescue open | Brief only; counts from the shipped record | Architect: rescue route (optimise vs redraw vs source) |
| 13 | GeoDetective unbuilt: first case, pity logic, Web Audio SFX | Game content | All three unbuilt; substrate changed (platform ports + validated records — see brief) | Brief only | Architect: design review of the trio |
| 14 | Landmark canon — 37 landmarks on the home globe | Globe | MERGED to main 2026-11-21 (65115172) AS-IS: Niagara weak read live, 3 partial reads untouched, Rushmore dive capture still missing | Branch status, mockup status, 15 captures (PR + mockup sets) | Architect: is a cure lane for the live gaps worth scheduling? |
| 15 | Place accessibility overhaul (Cold Trail anchors) | UX | Scrum-panel spec done; owner's other AI builds; Chitti reviews | GOAL.md (spec summary) | Architect: spec review. Owner: kid play-test is the final gate |
| 16 | Scaling beyond geography (math, science) | Game content | PARKED at the owner's word 2026-11-07 | Brief only | None sought — parked; verdict optional |
| 17 | Read-aloud arrival modal | UX | MERGED to main 2026-11-21 (7c04e3a7) | Branch status, 8 captures (4 widths × arrival/full) | Owner: post-merge live eye. Architect: retrospective on the modal pattern |
| 18 | Nav: frozen header + rail cures | UX | Frozen header SHIPPED (#529; tests retargeted #561/#564); rail never built; the 7 decisions now reduce to the rail question | Brief only; council outcome cited inside | Owner: answer the rail question |
| 19 | Container consistency (PageShell everywhere) | UX | Shell parts canonical in layer 4 (programme); adoption still 1 screen (grownups info-page); remaining-screens migration still awaits a ruling | page-shell-adoption-record.md | Owner/Architect: migration ruling |
| 20 | Crash-report watchdog — severity grades | Platform | Grades implemented in the crash worker on main (severityOf, S1–S3, #345; smoke hardened #560); deployment unverified from the repo | GOAL.md, rung-2-auto-triage-design.md | Owner: verify the deployed worker build. Architect: triage design review |
| 21 | Contact form → Discord activation | Platform | Code-complete on main: contactEndpoint live in flags.json; webhook secret runtime-only (#550); live stored:true delivery unconfirmed | GOAL.md | Owner: confirm a real submission landed in Discord |
| 22 | Game history reset | UX | Live on build b09a5c3; owner's phone check pending | GOAL.md | Owner: phone check |
| 23 | Gesture / chrome rework (P0-02/03, Z3, Z4) | UX | Branches handed to the owner in Oct; his push + phone check pending | FEATURE_MAP.md, p0-02-p0-03-final-report.md, GOAL.md | Owner: push + phone check. Architect: zoom-space design |
| 24 | Long-name display | UX | Merged & live since 2026-10-07; final label check is the owner's | long-name-design-spec.md, GOAL.md | Owner: final label check on the live site |
| 25 | Chunk-failure cascade fix (GeoDetective) | Platform / debt | CLOSED in product: recovery deadlock fixed by #532 (guarded one-time reload, behaviour-proven); counting fixed by #567; residue (chunk 13-E test) moved to #26 | Brief only; failure record cited inside | Architect: is one-reload-per-episode the right permanent policy? |
| 26 | Test debt: endgame-share, detective flakes, Pages workflow | Debt | Partially cured: endgame-share cause fixed by #557 (unverified); detective-sound/storyteller/tap-pending flakes still fail on clean main; chunk 13-E added; pages.yml still on main | Brief only; each failure's evidence cited inside | Architect: triage order. Owner: kill the Pages workflow? |
| 27 | Small rulings owed (5 in one folder) | Mixed | PR 531 conflict · PR 469 follow-up · meridian.run reload · privacy age-band · pipeline leftovers #113/#117 | Brief only; one section per ruling | Owner: rule each |
| 28 | Shorten the challenge share URL | Social | Added by the owner 2026-11-20; logged on the friend-challenges spec | GOAL-friend-challenges.md | Architect: short-link design. Pairs with #11's rulings |
| 29 | Architecture cleanup programme | Architecture | Phases 0/3 done; Phase 1A + 5 merged; 1B (#571) + Kanban (#574) in flight; Phase 4 mapped, not started; noRawIo 164→45, noUpwardImport 154→129 | Brief only; programme records on main, cited inside | Architect: sequencing vs the feature backlog; rulings for the baselined remainder |

## Summary counts

- **By area:** Video 4 · Characters 3 · Game content 7 · Globe 1 · UX 7 · Platform 3 · Debt 1 · Mixed 1 · Social 1 · Architecture 1.
- **Closed since v1:** 17 (merged, PR #547), 25 (fixed by PRs #532 + #567).
- **Merged with named gaps live:** 14 (landmarks — Niagara weak read, 3 partials, missing Rushmore capture).
- **Awaiting an owner decision first:** 1, 5, 7, 8, 9, 10, 11, 18 (rail only), 19, 22, 23, 24, 27 (13); plus owner verifications on 20 (deployed worker build) and 21 (live Discord delivery).
- **Architect design verdict is the main ask:** 2, 3, 4, 6, 12, 13, 15, 26, 29 (9); 14's ask is now the live-gaps quality bar, 25's the reload policy.
- **Parked, no decision sought:** 16.

## Programme dependencies (v2)

- **#13** builds on Phase 1's ports (the audio port is SFX's sanctioned home) and Phase 3's validated-records discipline.
- **#9 / #10** content would now be specified as validated records (the Phase 3 pattern); the pack shelf loads via the transport port (#565).
- **#19**'s target is the programme's layer-4 shell; Phase 4 does not itself migrate screens onto PageShell.
- **#29** is the programme itself; its Phase 4 sequencing question touches every feature that would add a screen.
