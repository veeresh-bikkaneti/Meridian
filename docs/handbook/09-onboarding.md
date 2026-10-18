# Meridian Product & Decision Handbook — 09 · Onboarding: your first week

Welcome. This chapter is a gentle guide to your first week — whether you're a human joining the crew or an AI agent spinning up to help. It assumes you know how to build software but know nothing about Meridian. By the end you'll know where everything lives, how work flows, how to avoid the classic mistakes, and who to ask for what.

Take it slow. Nobody expects you to ship on day one.

---

## 1. What to read first (in this order)

1. **This handbook, chapters 1–7** — the product decisions: what Meridian is, how the game works, the content standards, the voices, the rules that never bend.
2. **Chapter 8 ("How We Work")** — the collaboration system. Re-read it until the merge law feels obvious.
3. **The review pipeline skill** — `~/workspace/custom-skills/local-meridian-review-pipeline/SKILL.md`. It's the executable version of chapter 8. Every PR goes through it.
4. **The repo's `AGENTS.md`** — quality gates, card-content rules, git conventions. Short file; read all of it.

Then pick one tiny OPEN issue (not a feature) and walk the full change flow below. Small first, always.

---

## 2. Where everything lives

- **The repo:** `veeresh-bikkaneti/Meridian` on GitHub. Vite + React + TypeScript. Everything ships from `main`.
- **`docs/`** — the permanent record: ADRs, specs, ops runbooks. When a decision gets made, it lands here.
- **`BRANCH_STATUS.md`** — every feature branch carries one at the repo root. It's the branch's active work flag: done vs pending, updated as work lands, committed and pushed with the work. If you're picking up someone else's branch, read this first — then verify every claim in it independently (chapter 8, §5).
- **`public/flags.json`** — feature flags. Experimental work must never break production code; flags exist for exactly that reason. (Tier split shipped as `globeTierSplit: true`.)
- **This handbook** — `~/workspace/your_files/meridian-handbook/`.
- **Worktrees** — work happens in persistent checkouts under `~/workspace/bench-wt/` (one per branch/PR) and `~/workspace/ci-runner-fix` (ops checkout). Never in `/tmp` — a VM reboot wipes it.
- **Memory** — `~/MEMORY.md` and `~/memory/` hold the durable record: decisions, dates, commitments, people. `~/memory/groups/scrum-team.md` and `~/memory/people/liz.md` are the relationship files for the two crews you'll interact with. Search them before asking questions that might already be answered.

---

## 3. The quality gates (run these for every change)

All mandatory for a PR, in the repo's `AGENTS.md`:

| Gate | Command | Must print |
|---|---|---|
| Type check | `npx tsc --noEmit` | clean, zero errors |
| Unit tests | `npm test` | all green (src suite + scripts suite) |
| Card content gate | `node scripts/lint-cards.mjs` | `GATE PASSED` |
| Production build | `npm run build:pages` | green |
| E2E | `npx playwright test tests/e2e/<spec> --project=<project> --workers=1` | green against the built artifact |

E2E runs against the **built artifact** via `serveBuiltArtifact` (serves `dist/client` at `http://127.0.0.1:4123/Meridian/`). You do not test the dev server. Use `--workers=1` — the VM gets flaky under parallelism, and parallel failures that pass sequentially are environment noise, not regressions.

**Two environment traps, memorized so you don't fall in them:**

- The grandpa tasting-tour spec needs `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy` set **both** when building and when testing, or the spec throws at load. Record the env with every grandpa number you report.
- A stale `node_modules` can show 3–4 phantom tsc/test errors (missing `react-test-renderer`) that are identical on main — fixed by a fresh `npm ci`.

After merging, the Comprehensive System Overview runs on main (conflict-marker grep, tsc, full tests, build, E2E on touched surfaces, `flags.json` validity), and the live site gets a stamp check: `workers.dev` must serve the merge SHA, with zero console errors. See chapter 8, §2 for the full sequence.

---

## 4. How to propose a change

1. **Cut a branch from latest main.** `git fetch origin`, new worktree or branch. Branch name starts with its kind: `feat/`, `fix/`, `docs/`, `chore/`.
2. **Write `BRANCH_STATUS.md`.** What's the job, what's done, what's pending. Keep it current — it's how everyone else follows you.
3. **Work in small commits.** Every completed unit gets an atomic commit immediately. Never leave a day's work uncommitted. Stage named files only — **never `git add -A`**.
4. **Run the gates** (§3) and fix what fails. No exceptions for "it's just docs" (docs still get `npm test` — #157's precedent).
5. **Run E2E on the surfaces you touched** — and if you changed the home page, take screenshots at 390px, 1440px, 320px, and reduced-motion. Look at them. Really look.
6. **Push early and often** (the VM is not durable storage), then open the PR with a body that describes evidence, not claims.
7. **Review goes through the panel** (chapter 8, §2) — or a focused version for small PRs. Address BLOCKs; list nits. If a review asks for a live check, that's Chitti's lane.
8. **Wait for Veeresh's word.** The PR merges on his explicit per-PR command, squash, with the merge dance (drift check → merge → restore protection → delete branch). Then the post-merge verification runs. You don't merge on a green panel.

---

## 5. The five fastest ways to get a change rejected

Memorize these. Each one has happened, and each one is still an open invitation to repeat the mistake.

1. **Altering the locked donation copy.** "Grown-ups — buy me a coffee? ☕" and "Your support keeps Meridian free for kids" are byte-locked. Any alteration — even a "fix" — is an instant BLOCK. The same goes for the locked storyteller hint wordings in §6's glossary.
2. **Trusting builder claims instead of verifying.** "The branch says it's green" is a hypothesis. Re-inspect the code, re-run the tests, re-check the consumers. The #121 crew's "all green" missed 5 real BLOCKs.
3. **Writing "owner approved" without a citation.** Branch docs are claims, not facts. If you write that Veeresh decided something, cite his actual words with a date (message handle + date). An uncited owner-decision claim is itself a BLOCK.
4. **Breaking an existing feature.** New features must not break old ones — full stop. Regressions block the feature no matter how small it is. Run the full gates and the E2E for adjacent surfaces; use baseline-main runs to tell pre-existing failures from regressions.
5. **Skipping the live E2E / visual pass.** The panel can't see the screen — that gap is *your* responsibility for anything UI-facing. Screenshots at multiple viewports, real clicks on the real surfaces. If you didn't look at it, it isn't verified.

---

## 6. Glossary

**Edition.** The playable unit of Meridian. The drill-down picker goes Globe → Country → State, and each level is fully playable — never hardcoded to the 50 US states. **GeoDetective** is the fourth edition: a 5-guess mystery-place game (clues: Geography → Climate → History → Hook → Giveaway), fully unlimited — a shuffled deck across 387 curated clue files, streak = consecutive solves.

**Case file.** A GeoDetective play session ("Case #1", "Case #001"): satellite + labels guess surface, clue cards, distance rings and direction arrows on misses.

**Scout Map.** The session-only lightweight map fallback shown when the satellite tiles fail (one retry, then the dialog offers it). Veeresh's D3 decision ("Keep it", 2026-10-15) — it was the gamestudio-subagents crew's recommendation first. The choice dialog is PR #147 (OPEN).

**Tier split.** The tier split (`globeTierSplit` in `flags.json`): the Globe loads only the fame-tier files for the selected difficulty (Easy t1+t2, Medium t2–t4, Hard t4+t5) instead of all five. Shipped live by PR #148 (2026-10-15). (Low-GPU devices get the separate Scout Map offer — see ch06.)

**WS-\*.** The workstream program. The ones you'll see referenced: WS-0 test harness (recommended first), WS-2 social previews (shipped via #155 — the `og:`/`twitter:` share tags), WS-3 Scout toggle regression test, WS-4 satellite-failure phase 1 (shipped via #148), WS-5 home weight (the 377 kB `grandpa-directions.webp`).

**BRANCH_STATUS.md.** The per-branch active work flag — see §2. Read it, then verify it.

**The Hyderabad rule.** The permanent hard gate: every place's coordinates must match its claimed location. Enforced at build time (`src/game/validate-places.ts` + tests). Zero mismatches in the one-time 433-place audit.

**lint-cards.** `scripts/lint-cards.mjs` — the prebuild card-content gate. Must print `GATE PASSED`.

**Frozen press law.** The app's canonical button-press feel (inherited from the old `.atlas-card`): 200ms pop-over release at rest, 80ms glide into the press. Don't invent new press timings without a reason.

**TTS voices (the audio chapter in brief).** Narration runs on **Kokoro TTS** (Hugging Face): build-time narration with karaoke highlighting, Web Speech as fallback. Two voices, and the split is deliberate: **TruthTeller** speaks the storyteller's six greetings; **am_fenrir** speaks the story/hook/reveal/summary lines (Veeresh's #137 decision, 2026-10-11 — chosen to require zero new voice work). The storyteller poke clips (poke-01…05) are assigned to the greeting voice (TruthTeller, per #137) — **but the shipped clips are 24 kHz mono local Kokoro renders, not the greeting voice (OPEN BUG, 2026-10-16; fix waits on the owner identifying the TruthTeller source)** — and mute stays text-only.

**Storyteller.** The page's read-aloud companion and mascot. His personality is written into the kid-friendly blurb principles: (1) history first, modern identity second; (2) plain-spoken geography a kid can picture — never elevation or coordinates; (3) one memorable hook — if a kid can't retell it, the card failed; (4) short and story-like, stats only if they teach (records, firsts, biggests). His fixed lines: the home banner "Tap me to try again." and the story card "The words are right here — read along with me. Tap the replay button to try again." Per the 2026-10-14 #152 record, taps stay seen (the invite doesn't reset) — but note chapter 3's open conflict: current code also dismisses the tutorial invite card on figure tap. Unresolved; needs Veeresh's word. Double-taps debounce at 600ms. Note: the rejected SVG mascot samples are history — Veeresh picks the page-mascot replacement, nobody else.

**Grandpa.** The grandpa mascot (real sprite sheets, not the rejected chibi) and his Coffee Run — the animated donation scene with the thought bubble carrying the locked donation copy. He also runs the grandpa tasting tour (sip-drink stops along the home page's trail) and reacts to pokes. Everything about him is warm and unhurried: he exists to make asking for support feel like family, not marketing.

**Share text.** The approved three-line format: `meridian <date>`, the site URL alone on its line, then the score summary. Plus a Wordle-style spoiler-free emoji strip per place and grade tiers on the 0–415 range: 🎯 300+, 🏆 200+, 🌟 120+, 👏 60+, 🙂 1+, 💨 miss. Sessions bank totals only — no emoji strip for sessions.

**Stale-deploy handling.** When a region chunk fails because the deploy moved on, players see "A new version of Meridian is available." with a one-tap Refresh — never a dead-end error.

**PWA update rule.** Whenever there is a new build, the PWA must ask the player to update (Veeresh, 2026-10-12 — the #145 fingerprint fix).

**Crash reporting.** Always-on: game → `meridian-crash-report` worker → Discord. `npm run smoke:crash` exercises all event types. Resend API key + report email are still OPEN.

**COPPA-safe posture.** No ad personalization, IP anonymization, no cross-site tracking, no PII in analytics. Non-negotiable.

---

## 7. Who to ask for what

- **Veeresh** — product decisions, mandate questions, merge calls. Ask in numbered one-liners; answer his numbered corrections precisely. Don't ask him to re-verify things the pipeline can verify — bring evidence, not questions.
- **Chitti** — orchestration, reviews, verification, subagent crews, and anything that touches the merge dance or live checks. If you're unsure where something belongs, start with Chitti.
- **D's crew** — delegated production missions (journal wave-2 art was the first, merged 2026-10-17). Relay their instructions **verbatim**; ship incrementally; blocked-means-wait. The content boundary transfers from Liz's crew, which retired 2026-10-17.
- **The Scrum team** — review verdicts only, through Chitti. It doesn't build, it doesn't merge, and its verdicts are advisory. Don't lobby it — fix the BLOCK.
- **The handbook itself** — when in doubt about a product rule, search this handbook and `~/MEMORY.md` before asking a human. The answer is usually already written down with a date.

---

## 8. A closing note

Meridian is a geography game, but the real product is a kid learning something true about the world — and then retelling it at dinner. Every gate, every panel, every byte-level argument about an escape sequence exists to protect that moment. The bar is high because the audience is young and the trust is borrowed from parents.

You'll move faster here if you internalize two sentences: **verify, don't trust** — and **ask before you assume, cite before you claim.** The pipeline is thorough on purpose (Veeresh built it that way), the rules are written in past mistakes, and everyone on it would rather retract a false BLOCK publicly than let a real one through quietly.

Do good work. Keep the copy warm, the map honest, and the kid curious. We're glad you're here.

---

## Sources

- `~/MEMORY.md` (product decisions, voices, share text, gates, glossary facts)
- `~/AGENTS.md` (working rules, audit gates, git conventions)
- `~/workspace/custom-skills/local-meridian-review-pipeline/SKILL.md` (pipeline stages, operating rules)
- `~/memory/groups/scrum-team.md` (panel mechanics, track record)
- `~/memory/people/liz.md` (delegation boundary, relay rules)
- `~/dreams/alignment/derived/ALIGNMENT_SYNTHESIS.md` (communication norms)
- This handbook's chapter 8 ("How We Work") — the collaboration-system companion to this guide
