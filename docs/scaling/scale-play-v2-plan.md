# Scale-play v2 plan — scale features inside the prod UI

**Status:** PLAN FOR OWNER REVIEW. Step 2 (build) has NOT started.
**Base:** `origin/main` at `917c1bf` (live, 2026-11-12) — the prompt's `2bd5ee9` is its
ancestor, 8 commits behind, 0 behind/ahead conflicts. **Branch:** `mockup/scale-play-v2`
(new; `mockup/scale-play` / PR #425 untouched).
**Prod studied:** live `meridian.knowledgetest.workers.dev` (full detective playthrough:
case open → 2 guesses → win → celebration; journal player poster + playing + CC)
plus targeted reads of main at `917c1bf`. Screenshots: live prod played end-to-end
in the cloud browser (desktop width: Home, case intro → guess → win → celebration,
journal poster / playing / CC) and a local `build:pages` preview of main `917c1bf`
captured at 390 and 1280 px (Home, cases, journal, detective intro, guess step).
All shots in `~/workspace/scale-play-v2-study/shots/` (`390-*.png`, `1280-*.png`).
Caveats: the local preview's map tiles fail offline in this sandbox
(`net::ERR_TUNNEL_CONNECTION_FAILED` — same sandbox limit as the prefetch work),
so map areas render blank locally; live prod renders them. The local build's hero
copy ("Explore. Understand. Make sense of what matters.") differs from live prod's
("Hi there, I'm Meridian!") — prod deploy lags main; the plan follows main.

## 1. Prod as it is today (what the plan reuses)

- One route, one shell: TanStack Router only serves `/`, `/contact`, `/credits`,
  `/privacy`. `/` renders `GameApp` (`src/components/game-app.tsx`, 8,489 lines).
  Home is one long page; top nav is anchor links (`#home-editions`, `#home-cases`,
  `#home-about`, `#home-journal`, `#home-grownups`). Detective/journal open as
  in-page state, no URL change.
- Detective (GeoDetective): `LoopScreen` deals a case from `loop/manifest.json`
  (`dealActiveDeck`, `loop/clues/<n>.json`, exactly 5 string clues, 5 guesses max).
  The detective machine (`detective-state.ts`) runs `CASE_OPEN → READING
  (announce → watson-read → ack-decode → cut) → THINKING_BEAT → SEARCH_IDLE →
  SELECTION_READ → NOTE_MARK → ASK_NEXT → CELEBRATE | FAIL_READ → POUT → DEBRIEF`.
  Clue cards open one at a time already (each wrong guess unlocks 1 clue).
  `DetectiveHost` is an overlay of two rigs; it renders no game UI.
- Journal: `JournalPlayer`, phases `closed | loading | ready | error`. Closed =
  poster + caption + "Watch the movie · 10 sec"; error = poster + "movie isn't
  ready yet" + Try again.
- Theme: `--atlas-*` tokens in `src/styles.css` (dark default, light overrides);
  motion tiers in `src/styles/motion-tokens.css` (9 curves, `prefers-reduced-motion`
  collapses all transitions to 0.01 ms; globe falls back to a static disc).
- Flags: `src/lib/flags.ts` + `public/flags.json` (10 flags today, no `scalePlay`).

## 2. Entry point (decision)

**A new case type inside the detective flow, reached from a new home card next to
GeoDetective in the `#home-cases` section.** Why: it is the only entry that reuses
the whole existing flow (Holmes/Watson present, clue cards, result, celebration)
with no new screen and no new route. **Globe pins rejected:** the Home globe's
3 pins are decorative `THREE.Sprite` dots (no tap/raycast handler, no lat/lng
data) — pins for journals would be new interaction, not reuse. Journals stay
inline on Home via `JournalPlayer` (Lincoln uses its poster/caption state).

## 3. Flow — every step names its existing component

| Step | Existing component reused | New / gap |
|---|---|---|
| Pick case | Home case card in `GameApp` (`#home-cases`), styled from the GeoDetective card; opens a `LoopScreen`-style early-return branch on a state flag (same pattern as `loopOpen` / `coldTrailOpen`) | New card only (copy of existing card, new label) |
| Read the problem (why first) | `ClueCard` (`LoopScreen`, local, unexported) for the problem text; `DetectiveHost` + machine `READING` phase for Holmes announce → Watson read → Holmes ack | None — export `ClueCard` (or drive via a scale deal; see §4) |
| Answer | — | **NEW, the one genuine addition:** a small multiple-choice / numeric answer card (`src/scale-play/ScaleAnswerCard.tsx`), styled from `ClueCard` / mode-card, 44 px targets, keyboard reachable. `GuessInput` does NOT fit (place picks only; no choice/numeric input exists in this flow) |
| Result | `LoopReveal` (verdict + answer + stats + share + Next mystery / leave) | "You just used this in…" bridge = the item's `useElsewhere` line, rendered in the result debrief area (one small addition inside `LoopReveal`, existing copy style) |
| Celebration | `DetectiveHost` CELEBRATE phase + `CelebrationOverlay` (owned by `GameApp`) | None |
| Journal item (Lincoln) | `JournalPlayer` **closed** phase (poster + caption + button that opens the case instead of a movie) | None. The `error` phase was considered and rejected — its "Try again" button is wrong for a deliberately clip-less item |

**Voice: text only.** `src/game/audio/voice-channel.ts` does not exist on main, so
per the task's own rule there is no `claimVoice` routing and no new voice playback.
`detective-audio.ts` already plays one voice at a time (single sequential queue,
`speakingWho` tracked in the host), but scale items have no manifest mp3 clips, so
under the existing fallback law they play nothing — text only, no new audio files.

**Flag:** `scalePlay`, off by default. `?scale=1` is the turn-on **only if the owner
approves a small URL-param override in `src/lib/flags.ts`** — no such mechanism
exists today, and the prompt forbids editing `public/flags.json`. (Owner decision §6.)

## 4. Data — the 6 items

Adapter `src/scale-play/data.ts` reads the JSON only, never edits it. All 6 rows
exist; all 6 are group **7-10** (only Lincoln has a 10-18 stretch; **no 18+ question
exists yet**). Age filter via `getAgeGroup()` (`src/game/age-profile/store.ts:287`).

| Item | Row | Answer in row? |
|---|---|---|
| `math-number:groups:skip-count` | `docs/scaling/math/number/items.json` (1 of 30) | ❌ No `answer` field — derivable (40 coins by 5s = 8 groups, total 40) |
| `physics:arrive:equal-steps` | `docs/scaling/physics/items.json` (of 24) | ❌ Derivable (3-tiles-per-step cart) |
| `chemistry:states:solid-liquid` | `docs/scaling/chemistry/items.json` (of 18) | ❌ Derivable (warming melted it, solid→liquid) |
| `social-studies:route:trip-clock` | `docs/scaling/social-studies/items.json` (of 17) | ❌ Derivable (120÷40 = 3 h) — but a clock-face arrival needs a departure time the row does not give; source 404 on 2026-11-10 (MEDIUM confidence) |
| `general-knowledge:mixed:opera-years-ago` | `docs/scaling/general-knowledge/items.json` (of 11) | ❌ Formula in row (`currentYear − 1973`, device clock; 53 in 2026), no fixed value |
| `great-leaders:lincoln-memorial` | `docs/scaling/journals/great-leaders/clips.json` (1 of 3) | ✅ Only one with explicit answers ("He sits"; stretch `x = 25`). Clip mp4 **404s on main** → poster/caption fallback is required, as the task says |

**⚠️ "Answers taken only from the item rows" is impossible as written** — 5 of 6
I2 rows have no answer field (contract I2 shape: `id/group/objective/standard/why/
buildsOn/useElsewhere`). Owner must pick one before Step 2: **(a)** adapter derives
answers from `why`/`objective` with each derivation documented in the PR and
educator-signed, or **(b)** an answer source is added (NOT by editing the data
files — needs a separate owner decision on where it lives).

## 5. Files

- **New:** `docs/scaling/scale-play-v2-plan.md` (this file); `src/scale-play/data.ts`
  (adapter); `src/scale-play/ScaleAnswerCard.tsx`; `src/scale-play/scale-cases.ts`
  (scale → `LoopClueFile` mapping for the deal branch); `src/scale-play/*.test.ts`
  (adapter, 6 answer checks, current-year math, age filtering, flag-off = no change);
  `tests/e2e/scale-play.spec.ts`.
- **Edited:** `src/components/game-app.tsx` (home card + early-return branch, flag-gated);
  `src/game/loop/LoopScreen.tsx` (scale deal branch beside `dealActiveDeck`; export
  `ClueCard` / `LoopReveal` or render through the deal); `src/lib/flags.ts`
  (`scalePlay` in `FlagName` + `FLAG_DEFAULTS` false + `?scale=1` override, if approved);
  `src/game/loop/detective/*` — **no changes** (machine, host, audio untouched).
- **Not touched:** `package.json`, configs, subject registry, age profile,
  `public/flags.json`, `docs/scaling/**` data files, no new route/page, no new deps,
  no Docker/nginx/compose, three.js only where prod already uses it.

## 6. Owner decisions needed before Step 2 (all are stops, not nits)

1. **Plan OK?** (this document) — Step 2 starts only on your word.
2. **Answers:** option (a) derive + document + educator sign, or (b) separate answer source?
3. **Trip-clock:** what departure time does the clock-face arrival use?
4. **Flag turn-on:** approve the `?scale=1` override in `flags.ts`, or another route?
5. **18+ gap:** all 6 items are 7-10 — ship 7-10 only behind the flag, or wait for 18+ rows?
6. **Build gate (separate from plan OK):** `docs/scaling/agent-instructions.md` allows
   building only math-definition + Phase 0; everything else is GATED until a named
   human educator signs, and `contracts.md` keeps `released: false` until educator
   sign-off + owner go. The 2026-11-11 council review is explicitly PROPOSED, not a
   human sign-off (sign line blank). **Plan OK ≠ build approval.**
7. **Screenshots:** done for Step 1 (see header). Before/after shots for the PR
   are a Step 2 job.

## 7. Prompt corrections (verified live on main `917c1bf`)

- `src/game-app.tsx` does not exist — it is `src/components/game-app.tsx`.
- `src/game/audio/voice-channel.ts` does not exist — text-only voice, no `claimVoice`.
- No `detective-pool.ts` / case-type registry exists — plug-in is the `LoopScreen`
  deal + `LoopClueFile` shape, not the detective layer.
- `?scale=1` is not an existing mechanism — it would be new code in `flags.ts`.
- Base: prompt said "main at `2bd5ee9` or later" — live main `917c1bf` is 8 commits
  ahead of `2bd5ee9`, 0 behind. Branch is from `917c1bf`.

## 8. Step 2 checklist (for the build, not started)

`npx tsc --noEmit` · adapter + answer + year + age-filter + flag-off unit tests ·
`npm run lint:content` + `node scripts/lint-cards.mjs` · `npm run build:pages` ·
one Playwright spec (`tests/e2e/scale-play.spec.ts`, `--workers=1`: flag on plays
all 6, flag off shows today's prod, reduced motion renders, no console errors).
Review: one design/a11y reviewer seat (cheaper model) compares build screenshots
against the Step 1 prod screenshots; verdict goes in the PR verbatim; no reviewer
is stopped early; no council manifest is signed by the builder. Draft PR
"Mockup v2: scale features inside the prod UI" with before/after screenshots at
390 + 1280, `?scale=1` try-it, reused-component list, reviewer verdict, test results.
