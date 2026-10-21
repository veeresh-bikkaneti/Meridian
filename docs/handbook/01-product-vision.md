# Meridian Product & Decision Handbook — 01 · Product vision

*The "why" behind everything. Read this first — the rest of the handbook is a list of decisions; this page explains the reasons they keep pointing back to.*

---

## What Meridian is

Meridian is a **geography quiz game for kids** that plays in a browser. You look at an unlabeled satellite map, pin where you think a named place is, and every answer — right or wrong — shows you a **story card** about that place.

Veeresh's slogan, chosen 2026-10-01, says it in one breath:

> **"Explore the world, one pin at a time—where every guess unlocks a new story"**

Notice the order of operations in that sentence: *guess first, story as the reward.* That ordering is the whole product.

## The one-line mission

**Teach history, geography, and general knowledge to kids in a fun way, keeping them engaged while they learn.** (Veeresh, 2026-10-01.)

If a feature doesn't serve that sentence, it doesn't ship.

## Product philosophy — the four laws

Veeresh stated these explicitly on 2026-10-03, and they arbitrate nearly every design dispute in this handbook:

1. **Players are learners, not gamers.** The user is a kid who wants to grow, not a gamer chasing a leaderboard. When a choice trades "more exciting game" against "better learning," learning wins.
2. **The cards are the learning payload; the game is the delivery vehicle.** The quiz mechanics exist to get the kid's eyes onto the story card. This is why the card standards in this handbook are the strictest of all: history first, one memorable hook, retellable or it failed.
3. **Difficulty is scaffolding, not a wall.** Famous places first, obscure places as the reward for mastery. Easy / Medium / Hard on the picker is *learning scaffolding* — a ramp — never "gamer difficulty." A question a kid can't reasonably answer from the starting view isn't hard, it's broken (this principle is quoted directly in the Cold Trail sighting-anchors spec).
4. **Engagement mechanics serve retention-for-learning.** Streaks, scores, sounds, and tutorials are welcome — but only as tools that keep the kid playing long enough to learn. They are never the point.

## Success is learning + engagement, never revenue

There is no monetization target. No paywall will ever exist in Meridian. The standing copy for the voluntary donation path is locked (any alteration is a merge BLOCK):

> **"Grown-ups — buy me a coffee? ☕"**
> **"Your support keeps Meridian free for kids"**

The "Grown-ups" gate exists because the product must stay COPPA-safe: the donation path is for adults, never for kids. Analytics are likewise locked to a COPPA-safe config — no ad personalization, IP anonymization, no cross-site tracking — and measurement scope is still an open decision (GA4 remains the standing recommendation for usage stats only).

## Learning-outcomes instrumentation

On 2026-10-04 Veeresh ordered the `learningOutcomes` flag **on** (PR #45 — a config-only flip, no client release). What it does:

- From their next boot, players quietly build **per-place learning records** on their own device.
- The reveal card shows a **growth line** ("you're getting better at South America").
- The end-game summary has a **"My growth"** section.

Three guarantees that are non-negotiable:

- **Client-side only — nothing leaves the phone.** Measurement never phones home.
- **It watches but never interferes** with dealing or scoring. The measurement layer cannot change what question you get or what it scores.
- The **10 judgment calls** behind the measurement model are documented so Veeresh can overrule any of them.

## Kid-safety / COPPA posture

- Analytics components **fail closed** when tracking IDs are unset — they simply do nothing.
- Secrets and IDs are never hardcoded in source; they live in GitHub Actions secrets (`VITE_GA4_MEASUREMENT_ID`, `VITE_CLARITY_PROJECT_ID`, `VITE_KOFI_URL`), injected at build time.
- The crash-reporting pipeline is always-on production monitoring: the `meridian-crash-report` worker receives crash events and forwards them to Discord. CORS is open (`*`) by explicit owner sign-off — acceptable because the endpoint carries **no cookies and no auth**.
- Adult surfaces (donation, settings) are gated behind the "For grown-ups" path, never in the kid's flow.

## Voices, tone, and characters

Meridian has named characters with locked voices — because the tone is the teaching tool.

- **The Storyteller** — the narrator who greets and reads with the kid. Voice work decided 2026-10-11 (PR #137: TruthTeller for greetings, `am_fenrir` for story lines) — **superseded 2026-10-19 by PR #174: all 14 storyteller clips (greetings, pokes, hook, reveal, summary) are now one Grok-generated Santa voice**, produced by Veeresh in a Grok session and accepted as the storyteller voice by his ruling of 2026-10-21. The voice must sound like a human reading aloud, never robotic — the bar is a warm, natural read-along. Standing hint wordings, approved 2026-10-11: story card — *"The words are right here — read along with me. Tap the replay button to try again."*; home banner — *"Tap me to try again."*
- **Grandpa** — the Coffee Run character and the tasting-tour guide. Folksy, warm, a little funny; he is the face of the donation ask (which is why the donation copy lives next to him, not in the game). His tour ("Grandpa's tasting tour") is the first-run onboarding: the walker, the sip animation, the stop cards — all tuned so the tour never blocks play (it is skippable and timing-hardened for real-world slow devices).

Both characters speak to kids first and grown-ups second — playful, never condescending. Anything condescending fails the brand check.

## What Meridian is not

A useful newbie filter, because people keep suggesting these:

- **Not a quiz app with content.** The content (cards) *is* the product; the quiz is the hook.
- **Not a geography reference tool.** Maps have **no labels anywhere** — naming things is the game. Labeled places would hand away the answers.
- **Not free-with-ads.** There is no ad surface and no plan for one.
- **Not social.** No accounts, no friend lists, no leaderboards (average-per-place exists in scoring so comparisons are *possible* later — deliberately not shipped as a social feature).

## Sources

- `~/MEMORY.md` — product philosophy (2026-10-03), core goal (2026-10-01), slogan (2026-10-01), donation copy lock, COPPA/analytics posture, learningOutcomes flag (2026-10-04), crash-reporting posture, #136 hint wordings and #137 voices (2026-10-11), blurb principles (2026-10-01)
