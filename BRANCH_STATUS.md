# BRANCH_STATUS — feat/challenge-v1 (P0-1 Stateless Friend Challenges)

- **Branch:** `feat/challenge-v1` (PR #274)
- **Base:** `origin/main` at `daa03ad` (2026-10-27)
- **State:** **COMPLETE — ALL 5 MANDATORY GATES GREEN & PUSHED TO `origin/feat/challenge-v1` (2026-10-27)**
- **Task ID:** `P0-1` — Stateless `#c=mc1.<base64url>` Globe Friend Challenges (`friendChallenges`, default `false`)

---

## 1. What Was Delivered on `feat/challenge-v1`

1. **Pure Challenge Codec & Dealer (`src/game/challenge.ts` + `src/game/challenge.test.ts`):**
   - Browser-native base64url encoding/decoding (`TextEncoder` + `btoa` and `atob` + `TextDecoder("utf-8", { fatal: true })`) with **zero Node.js `Buffer` dependency** (verified by unit test with `globalThis.Buffer = undefined`).
   - Strict canonical base64url validation (`/^[A-Za-z0-9_-]+$/`, `length % 4 !== 1`, and canonical zero trailing padding bits for `length % 4 === 2` and `length % 4 === 3`) returning `{ ok: false, reason: "format" }` on mutated trailing bits.
   - Input guards: `encodeChallenge(ids, scoringVersion)` throws `RangeError("invalid scoringVersion")` when `!Number.isSafeInteger(scoringVersion) || scoringVersion < 1`; `dealChallenge(entries, count, seed)` returns `[]` for non-positive or non-safe-integer `count`.
   - Frozen constants exported from `src/game/challenge.ts`:
     - `CHALLENGE_GLOBE_RADIUS_KM = 750` (750 km pin radius freeze, bypassing age-band `pinToleranceKm` scaling)
     - `CHALLENGE_REGION_ID = "challenge"`
     - `CHALLENGE_REGION_NAME = "Friend challenge"`
     - `CHALLENGE_MIN_PLACES = 5`, `CHALLENGE_MAX_PLACES = 10`
     - `CHALLENGE_SHARE_LABEL = "Share this route with a friend"`
2. **Feature Flag Registration (`src/lib/flags.ts`, `src/lib/flags.test.ts`, `public/flags.json`, `docs/feature-flags.md`):**
   - `friendChallenges: false` registered in `FLAG_DEFAULTS` and `public/flags.json`, documented in `docs/feature-flags.md`.
3. **Runtime Wiring, 750 km Pin Freeze & Store Isolation (`src/components/game-app.tsx`, `src/components/run-summary.tsx`):**
   - **Boot hash handling (`#c=...` / `#c`):**
     - Immediately strips `#c=...` from the URL via `window.history.replaceState(null, "", window.location.pathname + window.location.search)`.
     - **Flag OFF (`friendChallenges: false`, default):** Fails closed silently to Home without starting a run or throwing errors; hides `[data-testid="challenge-share-container"]` in `RunSummaryCard`.
     - **Flag ON (`friendChallenges: true`):** Decodes `#c=mc1...` against `SCORING_VERSION`, verifies every ID exists in the full Globe catalog (`placesFor("globe", "globe", undefined, false)`), fails closed to Home if any ID is unknown or decode fails, and otherwise starts a deterministic Globe challenge run (`regionId: "challenge"`) in `playOrder(decoded)` sequence.
   - **750 km Globe radius freeze:** Challenge runs always use `CHALLENGE_GLOBE_RADIUS_KM` (`750`) for both `variation.radiusKm` and `onConfirm` hit evaluation, regardless of age-band profile settings.
   - **Complete store isolation:** Challenge runs (`isChallengeRun(run)`) never call `ensureSession`, never bank to `meridian.session`, never write to `meridian:learning:v1` or `meridian:review-deck:v1`, and use `memorySeenStore()` so `meridian.seen.*` no-repeat history is never touched.
   - **Completion & Share UI:** Finishing a challenge renders `<ChallengeComplete>` (`data-testid="challenge-complete"`) with warm, ~10-year-old reading-age copy and `<ShareButton label="Share this route with a friend" />` inside `data-testid="challenge-share-container"` (`data-challenge-url` `< 2000` chars). Normal Globe runs also expose the challenge share button on `RunSummaryCard` when `friendChallenges` is `true`.
4. **Playwright E2E Spec (`tests/e2e/friend-challenge.desktop.spec.ts`) & Docs (`README.md`, `docs/feature-flags.md`):**
   - 3 desktop E2E tests pinning both flag states (`friendChallenges: false` and `friendChallenges: true`), corrupt/unknown-ID fail-closed boot, 750 km pin freeze, 5-place deterministic sequence, store isolation, and `< 2000`-char share link.
   - Added one truthful `Friend challenge` row to the MapTap comparison table in `README.md`.

---

## 2. Tier-2 Consensus Manifest (`docs/ops/agent-council-protocol.md` §5)

```yaml
Tier-2 Consensus Manifest:
  task_id: P0-1
  branch: feat/challenge-v1
  base_sha: daa03ad
  author_agent: Coordinator C (UX/UI & Frontend + Game Squad)
  peer_reviewers:
    - agent: Coordinator A (Architecture & Platform)
      verdict: APPROVE
      notes: "Browser-native TextEncoder/TextDecoder + canonical base64url bit-check eliminates Node Buffer crash in Vite bundle; fail-closed boot and store isolation verified."
    - agent: Coordinator B (Tone, Docs, Accessibility & QA)
      verdict: APPROVE
      notes: "Warm ~10yo copy ('Share this route with a friend', 'Route complete!'), dialog semantics, and dual-flag E2E coverage verified."
```

---

## 3. Verbatim Gate Results

1. **Typecheck (`./node_modules/.bin/tsc --noEmit`):**
   - Exit code `0` (0 errors).
2. **Unit & Pipeline Tests (`npm test`):**
   - `# tests 1721 | # suites 129 | # pass 1721 | # fail 0` (including 14 tests in `src/game/challenge.test.ts` and 34 tests in `src/lib/flags.test.ts`).
3. **Card Content Gate (`node scripts/lint-cards.mjs`):**
   - `lint-cards: GATE PASSED` (`124690 records: 8802 with hook, 115888 hook-missing, 0 legacy, 0 curated-note violations`).
4. **Production Pages Build (`npm run build:pages`):**
   - Exit code `0`, `sw.js` and `build-meta.json` stamped.
5. **Playwright E2E (`flock -w 300 /tmp/meridian-playwright.lock ./node_modules/.bin/playwright test tests/e2e/friend-challenge.desktop.spec.ts --workers=1`):**
   - `3 passed (47.7s)` (Flag OFF fail-closed + hidden UI; Flag ON unknown-ID fail-closed; Flag ON deterministic 5-place run + 750 km radius + store isolation + `< 2000`-char share link).

---

## 4. Handoff Document & Prompt for Next Agent (If Any Follow-Up Needed)

```text
Branch `feat/challenge-v1` (PR #274) is feature-complete, rebased on `origin/main` (`daa03ad`), verified across all 5 mandatory gates (`tsc --noEmit`, `npm test` 1721/1721, `lint-cards.mjs`, `build:pages`, and `tests/e2e/friend-challenge.desktop.spec.ts` 3/3), and pushed to `origin/feat/challenge-v1`.
To inspect or merge:
1. Checkout `feat/challenge-v1` in `/workspace/Meridian`.
2. Prepend `export PATH=/home/box/node22/bin:/tmp/node22/bin:$PATH` and `export PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome`.
3. `friendChallenges` defaults to `false` in `src/lib/flags.ts` and `public/flags.json` for dark-launch safety. Flipping `"friendChallenges": true` in `public/flags.json` enables challenge link boot and the "Share this route with a friend" action in production.
```
