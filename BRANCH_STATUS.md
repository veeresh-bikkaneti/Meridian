# BRANCH_STATUS — fix/coldtrail-card-copy

- **Branch:** `fix/coldtrail-card-copy`
- **Base:** `main` @ `193b57c` (#321 home-card films, merged + live)

## Task capsule

TASK / requested outcome: Fix the Cold Trail home-card body copy
so it matches the now-live card film. The old copy ("A smuggler
moves between cities… make the interception") contradicts the
film, which shows Jolly (the cream plush mascot) being tracked by
a child before the trail freezes. Rewrite under the #321 panel
Narrative recommendation on record (panel VERDICT-RECORD flag 3):
keep the triangulation mechanic truth (three sightings, three
rings, tap where they cross), adopt the picture's cast inside it
(sightings of Jolly; reach Jolly where the rings cross before the
trail freezes) — do NOT rewrite to "follow Jolly" alone. Owner's
dispatch for this work — Veeresh, 2026-11-03: "work on the cards
that is not dependent on rock". Stop at PR-open; QA + panel are
separate silos. NO MERGE without the owner's per-PR word.

Tier and rationale: Tier 0/1 copy execution of a panel-recorded,
owner-open call — the wording rails were decided by the #321
panel's Narrative seat; this branch only crafts within them.
Scope is player-facing card copy + its test pin + a comment-only
fold-in in `card-media.ts`.

Done condition / evidence: new copy renders on the Cold Trail
card (verified in the built artifact); every pin of the old copy
updated or explicitly disclosed below; repo gates green; targeted
E2E green; PR opened with the full record.

Files and interfaces in scope: `src/components/game-app.tsx`
(the Cold Trail card `<p>` only), `src/components/card-film.test.ts`
(the one copy-lock pin), `src/assets/home-v5/card-media.ts`
(comments only), this file. Out of scope (NOT touched):
`src/game/coldtrail/*` (internal engine vocabulary incl.
"smuggler" names and themes.ts briefing strings), GeoDetective
card copy, the films/posters/stills and `card-film.tsx` logic,
LockedLoop, layout/CSS, and the locked strings "Case file ·
Unlimited" / "Case file · Triangulation" / "🔎 Solve a mystery" /
"❄️ Start the trail" (byte-exact — zero diff hits).

## What shipped

- **New Cold Trail card copy (123 chars, two short sentences;**
  **old copy was 110 chars rendered):**
  "Jolly was spotted in the snow. Three sightings, three rings —
  tap where they cross to reach Jolly before the trail freezes."
  The mechanic fragment "Three sightings, three rings — tap where
  they cross" is kept verbatim from the old copy; the cast is now
  Jolly (spotted → sightings of Jolly; goal = reach Jolly), and
  the freeze deadline from the film is the closing beat.
- **Pin updated:** `src/components/card-film.test.ts` copy lock —
  the old-copy fragment replaced with the new copy's fragment at
  the same lock strength (byte-exact `includes`, same position in
  the locked-strings list). No assertion weakened or loosened.
- **JSX comments checked:** the CardFilm comment block above the
  Cold Trail `<CardFilm>` (game-app.tsx ~4403) already truthfully
  describes the film (Jolly walks the footprint trail) — no change
  needed. The article header comment (~4394, "3 sightings, 3
  rings, one interception") describes the vertical slice's
  mechanic, which is unchanged — left as-is.
- **Fold-in, comment-only, `src/assets/home-v5/card-media.ts`:**
  (1) the two frame-0 extraction commands from the #321 cure
  record (`evidence/cure/CURE.md`) copied verbatim into the
  poster-derivation section; (2) ONE sentence stating the end
  axis per card (GeoDetective settles on the owner's image at the
  front angle; Cold Trail settles on the wide trail scene with
  Jolly mid-trail, still walking the footprint trail toward the
  lit cabin, which is still distant). No code lines
  changed; no asset bytes changed.

## Pin census (old copy + fragments, whole repo)

| Location | What was done |
| :--- | :--- |
| `src/components/game-app.tsx` ~4419 (the card `<p>`) | **Rewritten** — the source copy itself |
| `src/components/card-film.test.ts`:147 (copy lock) | **Updated** to the new copy, same lock strength |
| `docs/reviews/2026-10-21-wave2-mode-screens.md`:100 | **Left byte-intact on purpose** — a dated historical review record quoting the old copy as the open question (OD-1 / C-4) this PR resolves |
| `docs/handbook/02-game-design-decisions.md`:52 | **Left unchanged, disclosed** — it describes the Cold Trail edition's mechanic in the handbook's own words ("Three sightings, three rings, one interception… taps where the rings cross"), not the home-card text; it is not a pin of the card copy and the mechanic it describes is unchanged |
| `src/game/coldtrail/themes.ts` + `themes.test.ts` | **Out of scope, untouched** — different strings (in-game briefing texts for other themes); they share only the generic "Three sightings, three rings —" mechanic phrase, not this card's copy |
| README.md, e2e specs | **No pins found** — grep-verified; e2e references the card only via the untouched CTA "Cold Trail: Start the trail" |

## Redundancy audit (owner standing rule)

| Surface | Keep / remove | Reason |
| :--- | :--- | :--- |
| Card JSX `<p>` in `game-app.tsx` | **Keep — single source** | The one place the player reads this copy |
| `card-film.test.ts` copy lock | **Keep** | Deliberate byte-exact lock; it exists to fail the suite if the card copy drifts — a guard, not a second source |
| Historical review doc quote | **Keep (byte-intact)** | A dated snapshot; editing it would falsify the record of the open question |
| Handbook mechanic description | **Keep** | Describes the edition's mechanic from its own context; does not restate the card copy |

## Gates (code head 951246e; BRANCH_STATUS commit is docs-only on top)

- `npm run typecheck` — PASS (0 errors)
- `npm test` — PASS: scripts 850 pass / 11 skipped / 0 fail;
  src 1896/1896 pass
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — PASS; built artifact grep-verified:
  new copy present in `dist/client/assets/routes-*.js`, old copy
  absent
- E2E (flock `~/workspace/.e2e.lock`, --workers=1, Playwright-
  bundled Chromium 1243 — the VM's /opt/meta-chromium is not used,
  same as the #321 runs):
  - card-redesign.desktop — **11/11 PASS**
  - loading-orbs.desktop — **8/8 PASS** (builder-run result;
    incl. reduced-motion still + film-error → Cold Trail still)
  - home-visual-layout.desktop — **13/13 PASS** (copy is 13 chars
    longer rendered; the card chain has no fixed height or clamp,
    so a one-line text growth has no failure mode by construction
    — absorbed by grid stretch + auto-margin CTAs)
  - QA's combined E2E spot run had one infra flake
    (card-redesign:278 setup timeout under VM load; branch rerun
    1/1 PASS, unmodified-main control 11/11). The loading-orbs
    8/8 result above is a builder-run result that QA did not
    rerun.

## Flags for the owner / panel

- Panel approves the final tip; merge only on the owner's
  per-PR word. The Narrative seat judges the new wording.
- Eyebrows, CTAs, films, posters, stills, and LockedLoop are
  untouched — media asset bytes identical to main.
