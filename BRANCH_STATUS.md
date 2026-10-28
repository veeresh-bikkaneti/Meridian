# BRANCH_STATUS — feat/challenge-v1 (P0-1 Stateless Friend Challenges)

- **Branch:** `feat/challenge-v1` (PR #274)
- **Base:** `origin/main` at `daa03ad` (2026-10-27)
- **State:** **CURE ROUND COMPLETE — panel BLOCKs 1–2 + DevEx FAIL cured on the owner's order (2026-10-28); ALL 5 MANDATORY GATES GREEN on the cured code tip `0a75191` & PUSHED TO `origin/feat/challenge-v1`. Awaiting panel re-vote on the cured tip; merge remains the owner's per-PR word.**
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
     - Immediately strips `#c=...` from the URL via `window.history.replaceState(null, "", window.location.pathname + window.location.search)` — synchronously, before any async work.
     - **Fall-through boot (cure round, 2026-10-28):** the saved-run boot is a named `bootSavedRun()` inside the boot effect, and every `#c=` failure exit falls through to it instead of ending the boot. **Flag OFF (`friendChallenges: false`, default):** the boot is exactly main's boot — a resumable saved run resumes (a saved challenge run is cleared by that same path, as before); no notice is shown; `[data-testid="challenge-share-container"]` stays hidden in `RunSummaryCard`. **Flag ON:** decode failure, unknown ID, and Globe-catalog load failure set the boot notice (Home shows `CHALLENGE_CHILD_COPY`, "Could not load this challenge.", in a `role="status"` region, `data-testid="challenge-boot-notice"`) and then fall through to `bootSavedRun()` too, so a broken link never costs the player a saved run.
     - **Flag ON, valid link (`friendChallenges: true`):** Decodes `#c=mc1...` against `SCORING_VERSION`, verifies every ID exists in the full Globe catalog (`placesFor("globe", "globe", undefined, false)`), and starts a deterministic Globe challenge run (`regionId: "challenge"`) in `playOrder(decoded)` sequence.
   - **750 km Globe radius freeze:** Challenge runs always use `CHALLENGE_GLOBE_RADIUS_KM` (`750`) for both `variation.radiusKm` and `onConfirm` hit evaluation, regardless of age-band profile settings.
   - **Complete store isolation:** Challenge runs (`isChallengeRun(run)`) never call `ensureSession`, never bank to `meridian.session`, never write to `meridian:learning:v1` or `meridian:review-deck:v1`, and use `memorySeenStore()` so `meridian.seen.*` no-repeat history is never touched.
   - **Completion & Share UI:** Finishing a challenge renders `<ChallengeComplete>` (`data-testid="challenge-complete"`) with warm, ~10-year-old reading-age copy and `<ShareButton label="Share this route with a friend" />` inside `data-testid="challenge-share-container"` (`data-challenge-url` `< 2000` chars). Normal Globe runs also expose the challenge share button on `RunSummaryCard` when `friendChallenges` is `true`.
4. **Playwright E2E Spec (`tests/e2e/friend-challenge.desktop.spec.ts`) & Docs (`README.md`, `docs/feature-flags.md`):**
   - 7 desktop E2E tests pinning both flag states (`friendChallenges: false` and `friendChallenges: true`), corrupt/unknown-ID boot notice (flag ON) vs silence (flag OFF), saved-run fall-through in both flag states, a behavioural 750 km pin-freeze pair (pin judged 608.4 km = hit; 809.8 km = miss), 5-place deterministic sequence, store isolation (with a seeded-sentinel control proving the `meridian:seen:v2:` scan is live), and `< 2000`-char share link.
   - Added one truthful `Friend challenge` row to the MapTap comparison table in `README.md`.

---

## 2. Review record

An earlier version of this section quoted Coordinator A and Coordinator B
"APPROVE" verdicts with no citation to any review record. Those quotes were
**deleted in the 2026-10-28 cure round** (records rule: an approval claim
without a citation to the owner's or a reviewer's actual words does not
stand). The authoritative review record for this PR is the full-pipeline
report `PIPELINE-274` (panel verdict on tip `a00cf3a`: NOT READY — 2 BLOCKs
+ DevEx FAIL), and the cure round it ordered. The cured tip returns to the
panel for a fresh re-vote before any merge word.

## 3. Verbatim Gate Results

1. **Typecheck (`./node_modules/.bin/tsc --noEmit`):**
   - Exit code `0` (0 errors).
2. **Unit & Pipeline Tests (`npm test` + `npm run test:worker`) — full gate picture on the cured tip:**
   - scripts suite: `# tests 861 | # pass 850 | # skipped 11 | # fail 0`
   - src suite: `# tests 1721 | # pass 1721 | # fail 0` (including 14 tests in `src/game/challenge.test.ts` and **44 `it()` blocks in `src/lib/flags.test.ts`** — counted on the cured tip; an earlier version of this file said 34, which was wrong).
   - worker suite (`npm run test:worker`): `# tests 85 | # pass 85 | # fail 0`.
3. **Card Content Gate (`node scripts/lint-cards.mjs`):**
   - `lint-cards: GATE PASSED` (`124690 records: 8802 with hook, 115888 hook-missing, 0 legacy, 0 curated-note violations`).
4. **Production Pages Build (`npm run build:pages`):**
   - Exit code `0`, `sw.js` and `build-meta.json` stamped.
5. **Playwright E2E (`flock ~/workspace/.e2e.lock npx playwright test tests/e2e/friend-challenge.desktop.spec.ts --workers=1`):**
   - `7 passed (4.1m)` on the cured tip (Flag OFF fail-closed + hidden UI + silence; Flag ON corrupt/unknown-ID boot notice; Flag OFF saved-run fall-through; Flag ON corrupt-link saved-run fall-through; Flag ON deterministic 5-place run + store isolation + `< 2000`-char share link; 600 km hit / 800 km miss freeze pair, judged 608.4 km / 809.8 km).
   - Environment note: local gates ran on Node v24.22.1; CI on Node 22.x is canonical. Playwright used the bundled chromium (do NOT set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`).

---

## 4. Handoff Document & Prompt for Next Agent (If Any Follow-Up Needed)

```text
Branch `feat/challenge-v1` (PR #274) is feature-complete AND cure-complete:
the review pipeline on tip a00cf3a returned NOT READY (2 panel BLOCKs +
DevEx FAIL), and the cure round ordered by the owner on 2026-10-28
("Run both cure rounds + panel re-votes (#274 first, then #275)") fixed
all of them on this branch. Verified across all 5 mandatory gates on the
cured code tip (`tsc --noEmit` clean; `npm test` scripts 850 pass /
11 skipped + src 1721 pass; `npm run test:worker` 85 pass;
`lint-cards.mjs` GATE PASSED; `build:pages` green; friend-challenge E2E
7/7) and pushed to `origin/feat/challenge-v1`.
Next step is NOT a merge: the cured tip returns to the 12-role panel for
a re-vote, and merge happens only on the owner's explicit per-PR word.
To inspect:
1. Checkout `feat/challenge-v1` in ~/workspace/meridian-takeover.
2. Local Node is v24.22.1 (CI's Node 22.x is canonical). Playwright uses
   the bundled chromium — do NOT set PLAYWRIGHT_CHROMIUM_EXECUTABLE.
   E2E: flock ~/workspace/.e2e.lock npx playwright test
   tests/e2e/friend-challenge.desktop.spec.ts --workers=1, after
   `npm run build:pages` (E2E serves the built artifact; a stale dist/
   silently tests the wrong code).
3. `friendChallenges` defaults to `false` in `src/lib/flags.ts` and
   `public/flags.json` for dark-launch safety. Flipping
   `"friendChallenges": true` in `public/flags.json` enables challenge
   link boot and the "Share this route with a friend" action in
   production.
```
