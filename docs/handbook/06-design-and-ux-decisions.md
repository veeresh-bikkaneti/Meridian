# Meridian Product & Decision Handbook — 06 · Design & UX decisions

> New here? Start with this page to learn *why Meridian looks the way it does*. Every decision below has an owner, a date, and a reason. Nothing here is "because someone said so" — the record says who, when, and what changed.

---

## 1. The philosophy everything hangs on

Veeresh's own words, 2026-10-03:

> "User experience, user engagement, and learning outcomes — not just the game. Our users are players who want to learn and grow."

Three consequences that shape every design call:

1. **The card is the product; the game is the delivery vehicle.** Every reveal shows a kid-friendly blurb — right or wrong — that a kid can retell. The house rule (Veeresh, 2026-10-01): history first, modern identity second; plain-spoken geography kids can picture (never elevation numbers or coordinates); one memorable hook (person/quote/event/movie/record) — *if a kid can't retell it, the card failed*.
2. **Difficulty tiers are learning scaffolding, not gamer difficulty** (famous-first → obscure), like reading levels.
3. **Accessibility is a product value, not a checklist** — see §7. When the review team and the shipping schedule collide, Veeresh has repeatedly chosen the player over the deadline.

Also permanent, from Veeresh 2026-10-01: **no paywalls, ever.** Donation copy is locked — "Grown-ups — buy me a coffee? ☕" / "Your support keeps Meridian free for kids" — and altering either line is a merge-blocker in every review.

---

## 2. Map cartography — the quiz *is* the map

**The rule (Veeresh, 2026-09-30):** boundaries reveal progressively with zoom — continents at globe view, countries mid-zoom, states/provinces close in — and **there are no labels anywhere**. Naming things is the game.

Supporting rules, all still standing:

- **Boundary lines stay subtle** so the quiz-region highlight stays dominant (a missed guess's connecting line and labeled distance are the exception — they're the feedback, so they're allowed to shout).
- **The answer mark is gold `#f2c14e`** — from the GIS cartography review (PR #60, 2026-10-05), which fixed two P0s: the gold answer mark and bearing on reveals.
- **Honesty rule:** a raw pin is never presented as a named place. A nearest-match is qualified ("near …").
- **Answer reveal framing:** correct answers dive in Google-Earth-style; wrong answers pull back to fit both the player's pin and the true spot in one frame (framing scales with the error), with a connecting line and labeled distance. The miss card leads with the distance, then a small summary.
- **Units (Veeresh, 2026-10-11):** USA answer territory → miles, rest of the world → km — territory-based, not edition-based.
- **Data:** 124,690 places from GeoNames (CC-BY 4.0 — attribution is live in the app: "Place data: GeoNames CC-BY 4.0 · place history: Wikipedia CC BY-SA"). Real difficulty tiers 1–5. The renderer is **MapLibre** on satellite tiles.
- **Hyderabad rule (Veeresh's permanent hard gate, merged via PR #15, 2026-09-30):** every place's coordinates must match its claimed location. One-time audits of the 433-place catalog found zero mismatches; a build-time gate (`src/game/validate-places.ts`) locks it in forever.

---

## 3. Home design history — atlas → premium v5

### The atlas home (until 2026-10-16)

The original home: a chart-room styled homepage with edition cards (State / Country / Globe), the storyteller banner, the grandpa tour mascot, and the GeoDetective entry. Compact eyebrow cluster (Field Atlas eyebrow → Comet emblem → sound toggle); the v5 review lives in `docs/homepage-v5-scrum-review.md`.

### The premium v5 redesign — PR #158 (merged 2026-10-16)

Liz commissioned the premium v5 build (2026-10-15), built by her crew from the mock Veeresh supplied; Veeresh accepted the design by merging PR #158 (squash e9bf739) on 2026-10-16. Liz's crew ported the mock into the real homepage (branch `feat/homepage-premium-v5`, ~25 files, +1861/−340).

What shipped (squash-merged **e9bf739**, 2026-10-16, live on `meridian.knowledgetest.workers.dev`):

- **Editorial hero card** — headline, subcopy, BEGIN EXPLORING, difficulty pills, mountain illustration.
- **Lazy Three.js globe** (`src/components/home-globe.tsx`) — `three@0.160.0`, dynamically imported only when the hero approaches (IntersectionObserver — the browser's 'nearly on screen?' signal), DPR ≤ 1.5 (pixel sharpness capped so phones don't overwork), `MeshStandardMaterial` (Three.js's standard lit material), no post-processing; reduced-motion / Save-Data / WebGL-or-import failure → static texture disc; full disposal on unmount.
- **GeoDetective / Cold Trail case cards** with icon badges, streak line, earned-badges row.
- **Dark Expeditions Map card** — the design's dark anchor hosting the three real edition actions (State / Country / Globe) at 6.94:1 focus contrast (see §7).
- **Bottom row** — Review-my-misses, journal, grown-ups cards; grandpa tour + coffee-run scene below.

Deliberate deviation from the mock (documented in the review): type uses the repo's self-hosted **Fraunces + Karla** instead of the mock's Google Fonts — preserving the offline/PWA brand system. Tap targets raised to the repo's ≥44px standard.

### The v5 review journey (worth studying)

The mock's author (Liz's crew) ran their own Scrum review first: the independent Reality Checker judged the branch **NEEDS WORK** on the corrected record, then a fix phase (test-measurement hardening only, no product-code changes) earned a quoted re-verdict of **READY — with blocker 4's live assistive-technology pass as the sole disclosed exception** (see `docs/homepage-v5-scrum-review.md`).

Chitti's independent re-review then found **two BLOCKs** on the review head:

1. **Invisible keyboard focus ring** on the dark Expeditions card — the global `:focus-visible` outline `#77591f` measured **1.37:1** against the card's forest green `#33503f`, under the 3:1 WCAG non-text bar. Cured by a scoped pale-cream ring (`#efe3bc`, **6.94:1** on the lightest gradient stop) — see §7.
2. **Documentation integrity** — the cited report didn't exist in the repo, `BRANCH_STATUS.md` was stale, and an "(owner order)" comment lacked a citation. Cured before merge — with one attribution still open: the cure's comment names "Liz's eyebrow call, 2026-10-07/08" while the repo record says "Owner directive 2026-10-09"; which is right awaits Veeresh's one-word confirm.

The live assistive-technology exception was then closed with a **literal Orca screen-reader session on the VM (2026-10-16)**: Orca 46.1 + speech-dispatcher + espeak-ng, real browser, keyboard-only. Orca announced the Scout dialog and its focus trap, read the difficulty toggles with pressed states, announced every home control with its role, and — Enter on Globe — announced the game question itself ("Find Hillsborough, Auckland, New Zealand."). One nit: "Fetching this region's places…" was announced twice. A literal NVDA/VoiceOver pass on a real device has still never run — OPEN, not claimed.

### The crowding verdict and the rejected bento (2026-10-16)

After v5 went live, Veeresh judged the shipped layout **crowded** against the reference mock (globe boxed inside the hero instead of bleeding off the page; tall portrait images squeezing text columns; too many stacked hero rows; grandpa/coffee furniture overlapping cards).

Chitti built a bento-grid rework on `fix/home-bento-grid` (one modular grid, map card as tall spanning anchor, grown-ups as a full-width band). Veeresh rejected it (👎, "stop cooking"), said **Liz's Muse had already tried replicating the mock and failed miserably**, and asked **Grok** to take over the fix instead. That branch was **never pushed, never merged, never reached production** — the live site remains the #158 build. This is recorded factually: the rejection stands, and the mock-faithful layout remains an open design item.

> **Superseded 2026-10-17:** the "live site remains the #158 build"
> ending above is history —
> - **#162 (2026-10-16):** the globe shipped contained in the bento grid
>   (`.hv5-bento`), no protection lift.
> - **#165 (2026-10-16):** tasting tour visits in page order; storyteller
>   clips restored.
> - **#168 (2026-10-17):** journal v2 consolidation (106 notes, 36 rotating
>   sets, 49 verified / 57 cited).
> - **#169 (2026-10-17):** wave-2 art — 103 drawings; all 106 notes
>   illustrated; live is now the #169 build (`f331846`).

---

## 4. Scout Map switching and the WS-4 satellite-failure fallback (D3)

Two related decisions, often confused. They are separate:

**Scout Map switching (standing policy, `docs/scout-offer-policy.md`) — rewritten by Veeresh's rulings of 2026-10-20:**

- **Weak devices auto-switch silently.** On capability detection (WebGL probe / low memory) or a map-attributed crash on the previous visit, the game starts in the lighter **Scout Map** with no dialog at all. The switch is stored as an *auto* record (the qualifying signal is kept), and auto records **decay after 7 days** — later visits re-check the device, and a device that later passes returns to the full map on its own. A stored **manual** choice (the in-game toggle) still wins over everything and never decays, and records a player accepted under the old dialog also still stand. Veeresh, 2026-10-20: **"Auto-switch silently on weak devices (my decision stands)"** — "check the device capability and auto switch; also allow user to manually switch." Silent is not invisible, though (review pipeline round 1, Block C; Veeresh approved the scope, 2026-10-20: **"Yes — small notice + visible Scout indicator"**): a boot that auto-switches shows a one-time dismissible note on Home, and Home carries the same map toggle beside a visible indicator of the current mode — flipping it there writes a manual choice and costs no game, because no game has started.
- **Flipping the in-game toggle sends you home.** The map is built once per game, so a mode change can only take effect in a new game. The toggle stores the choice, ends the current game, and returns to the home screen; the next game starts on the new map. What carries over is the *session score* — and on the run itself the toggle is **not** like the Editions exit: leaving via Editions only pauses the run (its saved record is kept, so the run can resume where it left off).
- **The toggle ends the run outright.** By contrast with the Editions pause, the toggle deletes the run's saved record (`meridian.run`), so the game it ends is over for good — a kept record would resurrect a run the player just ended. Only the session survives both exits (the whole session state carries over; it is the run that ends). The popover says this before the tap — the warning prints *above* the switch at reading size, and the landing home shows a notice that the map switched and the score was kept (review pipeline round 1, Block B; Veeresh approved the scope, 2026-10-20: **"Yes — make the warning unmissable + home notice"**). Veeresh, 2026-10-20: **"Force home on manual switch (my remedy)"** — "when you manually switch you need to reload the entire app to get all features enabled. if that's the case we should force the user back to home page."
- **Superseded (kept for history):** until 2026-10-20 the app *offered* Scout Map in a boot dialog — a capability-detected weak device got "a CHOICE, never a silent routing", an explicit answer was never re-asked, and dismissal persisted nothing — and the toggle promised "applies from the next place." A same-day investigation (code + live E2E) proved the toggle promise false: the map itself never changed mid-run, only the labels flipped. Veeresh replaced both behaviors with the rulings above. This also closes the /jury pilot's fix #2 (2026-10-20: the Scout dialog gating the entire first visit on weak devices) — there is no dialog anymore.

**The D3 tile-failure fallback (D3 = item 3 on the decision log; decided 2026-10-15):** when satellite imagery fails to load, the player gets **one retry**. If that retry also fails, the map switches automatically to Scout Map **for this visit only** — nothing is persisted, and the next visit tries the full map again. Provenance: the fallback was **recommended by the gamestudio-subagents crew** (a crew recommendation, never Veeresh's initial ruling); Veeresh adopted it with a plain **"Keep it"** on 2026-10-15. It does not touch the saved-mode rules above. (WS-4 phase 1 spec: `docs/ops/specs/ws-4-satellite-failure-phase1.md`.)

---

## 5. Share cards — PR #155 (merged 2026-10-15)

Social previews for shared sessions (WS-2):

- `og:` / `twitter:` tags injected in `__root.tsx`'s `head()` (the single `src/lib/og/share-meta.ts` owns all tag values; the ADR-0001 decision: `head()` wins on Workers).
- **Locked copy:** title "Meridian: guess the place, then read its story" (46 chars); description "Free geography game for kids, no account needed. Pin a named place on an unlabeled satellite map. Every answer shows a story card. Plays in a browser." (150 chars); alt "The word Meridian and the line 'Explore the world, one pin at a time—where every guess unlocks a new story' over a dark green and gold world map with a gold location pin."
- The three-line share text is Wordle-inspired: date line, URL alone on its line, score summary with a spoiler-free per-place emoji strip; grade tiers 🎯300+ / 🏆200+ / 🌟120+ / 👏60+ / 🙂1+ / 💨 miss.
- **CLOSED — issue #156 (2026-10-20, PR #177):** the share image `og.jpg` was replaced on the owner's pick — Veeresh, 2026-10-20: "Pick B — gold repaint, slogan added". The new image (1200×630, 135,153 B): the MERIDIAN wordmark over gold lamp-lit continents on deep green, the slogan as the only secondary text, one gold pin — no place count anywhere. The locked-copy alt above now describes this image.

---

## 6. Typography

- **#135 (2026-10-11):** two-line `.name-eyebrow` wrap is fine; `.result-story` line-height 1.5 is fine.
- **v5:** Fraunces (display) + Karla (body), **self-hosted** — deliberately not the mock's Google Fonts, so the offline/PWA brand system survives.
- **Long-name rule:** long place names may wrap to two lines rather than truncate; the eyebrow-wrap approval came from the same #135 decision.

---

## 7. Accessibility as a product value

There is a dedicated spec: `~/workspace/specs/meridian-place-accessibility-overhaul.md`. Highlights:

- **Focus-visible standard:** the blanket `:focus-visible` rule is 2px solid with 3px offset — and on every dark surface the ring must clear the **3:1 WCAG non-text contrast bar**. The v5 Expeditions card initially failed (1.37:1, #77591f on #33503f); the shipped cure is a scoped `#efe3bc` ring (**6.94:1** on the card's lightest gradient stop).
- **Reduced motion** gets a static globe disc (zero canvases) — verified in E2E.
- **Unmapped surfaces never fake affordance:** a surface with no destination yet (the search button) is `aria-disabled="true"` — focusable, inert, with an sr-only "Not yet available" description — never a fake `disabled` button that screen readers can't explain. Nav JOURNAL and the Journal card's READ THE ENTRY are no longer unmapped in that sense: both are live buttons that scroll-jump to the inline journal section (`#home-journal`) and move focus to it (nav ABOUT does the same for its section). The journal section has shipped inline since PR #165, and the Journal v2 port now runs in it: geography sets of catalog notes rotating every 2 hours, with focus-only deferral — a set never swaps while focus is inside the card or the section — a per-note confidence line, a set-geography header and an "Entry X of 36" footer, and storybook art on
**all 106 notes** (wave 2, PR #169, 2026-10-17: 103 drawings, 16,761 KiB of
new art, all 36 sets fully illustrated; the haymarket drawing shipped as a
known nit).
- **Keyboard flow:** full tab order == the reading order (verified 29-stop traversal on the v5 home), nav jumps move real focus, the Grandpa tour exposes a skip control.
- **The Orca session (2026-10-16)** is the strongest evidence: Scout dialog announced + focus-trapped with labeled buttons, toggles announced with pressed states, game question announced. **Still OPEN:** a literal NVDA/VoiceOver pass on a real device and a real-browser 400%-zoom pass.

---

## 8. The PWA rule (Veeresh, 2026-10-12)

**Whenever there is a new build, the PWA must ask the player to update.** This drove PR #145's **service-worker fingerprint**: every build stamps its identity into the SW (verified live on `workers.dev` as `meridian-<sha>`), plus a Vite plugin safety net so a build can never ship an unstamped worker. The `pwaUpdateToast` flag is the kill-switch for the whole mechanism (off → live SW unregistered, plain web app — see 07 §2).

---

## Sources

- Memory record: product philosophy, cartography, GIS review, Hyderabad rule, share copy, donation-copy lock, PWA rule, #136–#138/#135/#152 decisions, D3 adoption 2026-10-15, Orca session 2026-10-16, v5 review journey, crowding verdict + rejected bento 2026-10-16, issue #156.
- `docs/feature-flags.md` — flag catalog (incl. `pwaUpdateToast` kill-switch semantics).
- `docs/scout-offer-policy.md` — non-nag rules; D3 tile-failure charter change (crew recommendation, owner adoption 2026-10-15).
- `docs/homepage-v5-scrum-review.md` — v5 integration summary, NEEDS WORK → READY journey, focus-cure record, 8 WebP assets 3.9→0.49 MB, Fraunces/Karla deviation, tour coupling fixes.
- `~/workspace/specs/meridian-place-accessibility-overhaul.md` — accessibility overhaul spec.
